// =============================================================================
// Edge Function: GET /api/v1/modules/full
// Module Repository — Milestone 2
//
// Returns active modules with endplates and industries (each industry
// carrying its accepted car_types) nested inline. This is the primary
// integration endpoint for Free Dispatcher (read-only, per ADR-001).
//
// Deploy: supabase functions deploy modules-full
// Invoke: GET /functions/v1/api/v1/modules/full
//         ?status=active&category=industry_spur&updated_since=2026-01-01T00:00:00Z
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed", message: "Use GET" }, 405);
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "active";
    const category = url.searchParams.get("category");
    const updatedSince = url.searchParams.get("updated_since");

    // Forward the caller's JWT so RLS applies as that user would see it.
    // Falls back to anon-level access if no Authorization header is present.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Non-admins may only request status=active. We don't know the caller's
    // role here without a lookup, so we defer the real enforcement to RLS —
    // this guard just prevents an obviously-wrong request from an anon caller.
    if (status !== "active" && !authHeader) {
      return jsonResponse(
        { error: "forbidden", message: "Only active modules are visible without authentication." },
        403,
      );
    }

    let query = supabase
      .from("freemon_modules")
      .select(`
        id,
        record_number,
        module_name,
        description,
        category,
        geometry_type,
        geometry_degrees,
        geometry_offset_inches,
        length_feet,
        length_inches,
        endplate_count,
        has_mss,
        mss_block_count,
        status,
        updated_at,
        freemon_endplates (
          endplate_number,
          label,
          track_config,
          width_inches,
          height_inches
        ),
        freemon_industries (
          industry_number,
          label,
          industry_name,
          industry_type,
          spur_capacity_scale_feet,
          notes,
          freemon_industry_car_types (
            notes,
            rail_car_types ( value, display_label )
          )
        )
      `)
      .eq("status", status)
      .order("record_number", { ascending: true })
      .order("endplate_number", { foreignTable: "freemon_endplates", ascending: true })
      .order("industry_number", { foreignTable: "freemon_industries", ascending: true });

    if (category) query = query.eq("category", category);
    if (updatedSince) query = query.gte("updated_at", updatedSince);

    const { data, error } = await query;

    if (error) {
      console.error("modules/full query error:", error);
      return jsonResponse(
        { error: "query_failed", message: error.message },
        500,
      );
    }

    // Reshape: flatten the car_types junction rows into { value, display_label, notes }
    const modules = (data ?? []).map((m: any) => ({
      id: m.id,
      record_number: m.record_number,
      module_name: m.module_name,
      description: m.description,
      category: m.category,
      geometry_type: m.geometry_type,
      geometry_degrees: m.geometry_degrees,
      geometry_offset_inches: m.geometry_offset_inches,
      length_feet: m.length_feet,
      length_inches: m.length_inches,
      endplate_count: m.endplate_count,
      has_mss: m.has_mss,
      mss_block_count: m.mss_block_count,
      status: m.status,
      updated_at: m.updated_at,
      endplates: (m.freemon_endplates ?? []).map((ep: any) => ({
        endplate_number: ep.endplate_number,
        label: ep.label,
        track_config: ep.track_config,
        width_inches: ep.width_inches,
        height_inches: ep.height_inches,
      })),
      industries: (m.freemon_industries ?? []).map((ind: any) => ({
        industry_number: ind.industry_number,
        label: ind.label,
        industry_name: ind.industry_name,
        industry_type: ind.industry_type,
        spur_capacity_scale_feet: ind.spur_capacity_scale_feet,
        notes: ind.notes,
        car_types: (ind.freemon_industry_car_types ?? []).map((ct: any) => ({
          value: ct.rail_car_types?.value,
          display_label: ct.rail_car_types?.display_label,
          notes: ct.notes,
        })),
      })),
    }));

    return jsonResponse(modules, 200);
  } catch (err) {
    console.error("modules/full unexpected error:", err);
    return jsonResponse(
      { error: "internal_error", message: "Unexpected server error" },
      500,
    );
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Cache hint for Free Dispatcher's polling sync — short TTL, must-revalidate
      "Cache-Control": "public, max-age=30, must-revalidate",
    },
  });
}
