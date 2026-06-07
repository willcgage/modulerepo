// =============================================================================
// Edge Function: POST /api/v1/modules/validate-name
// Module Repository — Milestone 2
//
// Validation-only endpoint for the Add/Edit Module wizard: checks whether
// a proposed module_name would collide with one of the caller's existing
// modules BEFORE they submit the full form. Returns a friendly,
// field-scoped error rather than letting the owner hit the raw Postgres
// unique-constraint violation (freemon_modules_name_owner_unique, see
// migration 003) on submit.
//
// This does not replace the DB constraint — it's a UX layer in front of it.
// The constraint remains the source of truth and guards against races.
//
// Request body:
//   { "module_name": "Cascade Lumber & Grain", "exclude_module_id": 2 }
//   (exclude_module_id is optional — pass the module's own id when editing
//   so it doesn't flag a collision with itself)
//
// Deploy: supabase functions deploy modules-validate-name
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", message: "Use POST" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "unauthorized", message: "Sign in to validate a module name." }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_request", message: "Body must be valid JSON." }, 400);
  }

  const moduleName = (body?.module_name ?? "").toString().trim();
  const excludeModuleId = body?.exclude_module_id != null ? Number(body.exclude_module_id) : null;

  if (!moduleName) {
    return jsonResponse(
      { error: "validation_failed", message: "Please fix the highlighted fields.",
        details: { module_name: "Required." } },
      400,
    );
  }
  if (moduleName.length > 120) {
    return jsonResponse(
      { error: "validation_failed", message: "Please fix the highlighted fields.",
        details: { module_name: "Must be 120 characters or fewer." } },
      400,
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized", message: "Could not verify session." }, 401);
  }
  const userId = userData.user.id;

  // Case-insensitive collision check, scoped to this owner, excluding self when editing.
  let query = supabase
    .from("freemon_modules")
    .select("id, module_name")
    .eq("owner_id", userId)
    .ilike("module_name", moduleName);

  if (excludeModuleId != null && Number.isFinite(excludeModuleId)) {
    query = query.neq("id", excludeModuleId);
  }

  const { data: collisions, error: queryError } = await query;

  if (queryError) {
    console.error("modules/validate-name query error:", queryError);
    return jsonResponse({ error: "query_failed", message: queryError.message }, 500);
  }

  if (collisions && collisions.length > 0) {
    return jsonResponse(
      {
        valid: false,
        error: "duplicate_module_name",
        message: `You already have a module named "${collisions[0].module_name}". ` +
                 `Module names must be unique per owner — choose a different name.`,
        details: { module_name: "Already in use by one of your modules." },
      },
      409,
    );
  }

  return jsonResponse({ valid: true }, 200);
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
