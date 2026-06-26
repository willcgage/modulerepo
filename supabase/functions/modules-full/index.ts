// =============================================================================
// Edge Function: GET /api/v1/modules/full
// Module Repository — Milestone 2
//
// Returns active modules with endplates, tracks, and industries (each
// industry carrying its accepted car_types and the label of the track it
// sits on, if any) nested inline. This is the primary integration endpoint
// for Free Dispatcher (read-only, per ADR-001).
//
// Deploy: supabase functions deploy modules-full
// Invoke: GET /functions/v1/api/v1/modules/full
//         ?status=active&category=industry_spur&updated_since=2026-01-01T00:00:00Z
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed", message: "Use GET" }, 405);
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "active";
    const category = url.searchParams.get("category");
    const updatedSince = url.searchParams.get("updated_since");

    // Base the client on the anon key so RLS is always enforced. When the
    // caller supplies a real user JWT (3-part token), forward it so RLS
    // applies as that user (e.g. an admin can request inactive modules).
    // A non-JWT credential — such as a `sb_publishable_…` key — is ignored
    // for auth purposes and the request runs at anon level.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isJwt = token.split(".").length === 3;
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: isJwt ? { headers: { Authorization: authHeader } } : {},
    });

    // Non-admins may only request status=active. We don't know the caller's
    // role here without a lookup, so we defer the real enforcement to RLS —
    // this guard just prevents an obviously-wrong request from an anon caller.
    if (status !== "active" && !isJwt) {
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
        mss_type,
        status,
        updated_at,
        freemon_endplates (
          endplate_number,
          label,
          track_config,
          width_inches,
          height_inches
        ),
        module_tracks (
          track_number,
          label,
          track_name,
          capacity_scale_feet,
          notes
        ),
        module_schematics (
          storage_path,
          file_name,
          file_format,
          caption,
          display_order
        ),
        freemon_industries (
          industry_number,
          label,
          industry_name,
          industry_type,
          notes,
          track:module_tracks ( label ),
          freemon_industry_car_types (
            notes,
            rail_car_types ( value, display_label )
          )
        )
      `)
      .eq("status", status)
      .order("record_number", { ascending: true })
      .order("endplate_number", { foreignTable: "freemon_endplates", ascending: true })
      .order("track_number", { foreignTable: "module_tracks", ascending: true })
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
      mss_type: m.mss_type,
      status: m.status,
      updated_at: m.updated_at,
      endplates: (m.freemon_endplates ?? []).map((ep: any) => ({
        endplate_number: ep.endplate_number,
        label: ep.label,
        track_config: ep.track_config,
        width_inches: ep.width_inches,
        height_inches: ep.height_inches,
      })),
      tracks: (m.module_tracks ?? []).map((t: any) => ({
        track_number: t.track_number,
        label: t.label,
        track_name: t.track_name,
        capacity_scale_feet: t.capacity_scale_feet,
        notes: t.notes,
      })),
      schematics: (m.module_schematics ?? [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((s: any) => ({
          storage_path: s.storage_path,
          file_name: s.file_name,
          file_format: s.file_format,
          caption: s.caption,
        })),
      industries: (m.freemon_industries ?? []).map((ind: any) => ({
        industry_number: ind.industry_number,
        label: ind.label,
        industry_name: ind.industry_name,
        industry_type: ind.industry_type,
        track_label: ind.track?.label ?? null,
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
