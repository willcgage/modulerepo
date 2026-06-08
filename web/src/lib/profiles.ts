import { createClient } from "@/lib/supabase/server";

// owner_profiles.id and columns like audit_log.performed_by both reference
// auth.users(id), but there's no direct FK between those tables — so
// PostgREST can't embed owner_profiles via `!column_name(...)`. Resolve
// display names with a separate lookup instead.
export async function fetchDisplayNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();

  const { data } = await supabase.from("owner_profiles").select("id, display_name").in("id", ids);

  return new Map((data ?? []).map((p) => [p.id as string, p.display_name as string]));
}
