// =============================================================================
// Edge Function: GET /api/v1/car-types
// Module Repository — Milestone 2
//
// Returns all active rail car types — used to populate dropdowns in the
// owner portal's Add/Edit Module wizard (Step 3: Industries).
//
// Deploy: supabase functions deploy car-types
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed", message: "Use GET" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase
    .from("rail_car_types")
    .select("value, display_label")
    .eq("status", "active")
    .order("display_label", { ascending: true });

  if (error) {
    console.error("car-types query error:", error);
    return jsonResponse({ error: "query_failed", message: error.message }, 500);
  }

  return jsonResponse(data ?? [], 200);
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
