// Without generated Supabase DB types, supabase-js infers many-to-one
// embedded selects (e.g. `owner_profiles!user_id(display_name)`) as arrays,
// but PostgREST returns a single object at runtime for such joins.
export function embeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
