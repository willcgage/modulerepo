// =============================================================================
// Edge Function: POST /api/v1/car-types/suggest
// Module Repository — Milestone 2
//
// Owner-facing endpoint backing the "Other" field in the Add/Edit Module
// wizard Step 3 (Industries). Inserts a new rail_car_types row with
// status = pending_review and suggested_by = caller's user ID. The
// suggestion is immediately usable by the suggesting owner.
//
// Requires a valid user JWT (Authorization: Bearer <token>) — RLS policy
// "owner_suggest_car_type" additionally enforces suggested_by = auth.uid()
// and status = 'pending_review' at the database layer; this function adds
// friendlier validation and conflict handling on top.
//
// Deploy: supabase functions deploy car-types-suggest
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALUE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/; // snake_case, 2-40 chars

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", message: "Use POST" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(
      { error: "unauthorized", message: "Sign in to suggest a car type." },
      401,
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_request", message: "Body must be valid JSON." }, 400);
  }

  const value = (body?.value ?? "").toString().trim().toLowerCase();
  const displayLabel = (body?.display_label ?? "").toString().trim();
  const suggestionNotes = body?.suggestion_notes != null
    ? body.suggestion_notes.toString().trim()
    : null;

  // ---- Validation -----------------------------------------------------
  const fieldErrors: Record<string, string> = {};
  if (!value) {
    fieldErrors.value = "Required.";
  } else if (!VALUE_PATTERN.test(value)) {
    fieldErrors.value = "Use lowercase snake_case, 2-40 characters (e.g. 'wood_chip_car').";
  }
  if (!displayLabel) {
    fieldErrors.display_label = "Required.";
  } else if (displayLabel.length > 60) {
    fieldErrors.display_label = "Must be 60 characters or fewer.";
  }
  if (suggestionNotes && suggestionNotes.length > 255) {
    fieldErrors.suggestion_notes = "Must be 255 characters or fewer.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return jsonResponse(
      { error: "validation_failed", message: "Please fix the highlighted fields.", details: fieldErrors },
      400,
    );
  }

  // Client bound to the caller's JWT — RLS enforces ownership of the insert.
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized", message: "Could not verify session." }, 401);
  }
  const userId = userData.user.id;

  // ---- Conflict check (friendly 409 before hitting the unique constraint) ----
  const { data: existing, error: lookupError } = await supabase
    .from("rail_car_types")
    .select("value, status")
    .eq("value", value)
    .maybeSingle();

  if (lookupError) {
    console.error("car-types/suggest lookup error:", lookupError);
    return jsonResponse({ error: "query_failed", message: lookupError.message }, 500);
  }
  if (existing) {
    return jsonResponse(
      {
        error: "duplicate_value",
        message: `A car type with value "${value}" already exists (status: ${existing.status}). ` +
                 `Use the existing entry instead of suggesting a duplicate.`,
      },
      409,
    );
  }

  // ---- Insert as pending_review ----------------------------------------
  const { data: inserted, error: insertError } = await supabase
    .from("rail_car_types")
    .insert({
      value,
      display_label: displayLabel,
      status: "pending_review",
      suggested_by: userId,
      suggestion_notes: suggestionNotes,
    })
    .select("id, value, display_label, status, created_at")
    .single();

  if (insertError) {
    console.error("car-types/suggest insert error:", insertError);
    // Unique violation race condition
    if (insertError.code === "23505") {
      return jsonResponse(
        { error: "duplicate_value", message: `A car type with value "${value}" already exists.` },
        409,
      );
    }
    return jsonResponse({ error: "insert_failed", message: insertError.message }, 500);
  }

  return jsonResponse(inserted, 201);
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
