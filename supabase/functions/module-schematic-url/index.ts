// =============================================================================
// Edge Function: GET /functions/v1/module-schematic-url?path=<storage_path>
// Module Repository — mint a short-lived signed URL for an owner-uploaded module
// schematic file. The module-schematics bucket is PRIVATE, so Free Dispatcher
// asks this endpoint on demand instead of caching a URL.
//
// Safety: only paths that belong to an ACTIVE module's schematic are signed, so
// the endpoint can't be used to read arbitrary objects in the bucket.
//
// Deploy: supabase functions deploy module-schematic-url
// Invoke: GET /functions/v1/module-schematic-url?path=19/....pdf
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const BUCKET = "module-schematics";
const EXPIRES_IN = 300; // seconds

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return json({ error: "method_not_allowed", message: "Use GET" }, 405);
  }

  const path = new URL(req.url).searchParams.get("path")?.trim();
  if (!path) {
    return json({ error: "bad_request", message: "path is required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only sign paths that belong to an active module's schematic.
  const { data: rows, error: lookupErr } = await admin
    .from("module_schematics")
    .select("storage_path, file_name, file_format, freemon_modules!inner(status)")
    .eq("storage_path", path)
    .eq("freemon_modules.status", "active")
    .limit(1);

  if (lookupErr) {
    console.error("schematic lookup error:", lookupErr);
    return json({ error: "query_failed", message: lookupErr.message }, 500);
  }
  const row = rows?.[0];
  if (!row) {
    return json({ error: "not_found", message: "No active schematic for that path." }, 404);
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRES_IN);

  if (signErr || !signed?.signedUrl) {
    console.error("sign error:", signErr);
    return json({ error: "sign_failed", message: signErr?.message ?? "could not sign" }, 500);
  }

  return json(
    {
      url: signed.signedUrl,
      file_name: row.file_name,
      file_format: row.file_format,
      expires_in: EXPIRES_IN,
    },
    200,
  );
});
