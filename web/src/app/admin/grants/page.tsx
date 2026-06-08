import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profiles";
import { TextField, SelectField, SubmitButton } from "@/components/form-fields";
import { createGrant, revokeGrant } from "./actions";

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; filter?: string }>;
}) {
  const { error, filter } = await searchParams;
  const showAll = filter === "all";
  const supabase = await createClient();

  let query = supabase
    .from("show_master_grants")
    .select("id, user_id, event_name, granted_by, granted_at, expires_at, revoked_at")
    .order("granted_at", { ascending: false });

  if (!showAll) {
    query = query.is("revoked_at", null);
  }

  const [{ data: grants }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("owner_profiles").select("id, display_name, contact_email").order("display_name"),
  ]);

  const allUserIds = (grants ?? []).flatMap((g) => [g.user_id, g.granted_by]);
  const names = await fetchDisplayNames(supabase, allUserIds);

  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Show master grants</h1>
      <p className="mt-1 text-sm text-gray-600">
        Event-scoped access that lets an owner act as show master — see active
        modules/industries the same way the public does, regardless of their
        own module visibility.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={createGrant} className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-5">
        <p className="text-sm font-medium text-gray-700">Issue a grant</p>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <SelectField
              label="Owner"
              name="user_id"
              placeholder="Select an owner…"
              options={(profiles ?? []).map((p) => ({
                value: p.id,
                label: p.contact_email ? `${p.display_name} (${p.contact_email})` : p.display_name,
              }))}
            />
          </div>
          <div className="flex-1">
            <TextField label="Event name" name="event_name" placeholder="e.g. Spring Meet 2026" maxLength={120} />
          </div>
          <div className="w-44">
            <TextField label="Expires (optional)" name="expires_at" type="date" required={false} />
          </div>
          <div className="mb-4">
            <SubmitButton label="Issue grant" />
          </div>
        </div>
      </form>

      <div className="mt-8 flex items-center gap-4 text-sm">
        <Link href="/admin/grants" className={!showAll ? "font-medium text-gray-900" : "text-blue-600 hover:underline"}>
          Active only
        </Link>
        <Link href="/admin/grants?filter=all" className={showAll ? "font-medium text-gray-900" : "text-blue-600 hover:underline"}>
          All grants
        </Link>
      </div>

      {!grants || grants.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">No grants to show.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {grants.map((g) => {
            const isExpired = g.expires_at != null && new Date(g.expires_at) <= now;
            const isActive = g.revoked_at == null && !isExpired;
            return (
              <li key={g.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {names.get(g.user_id) ?? g.user_id} · {g.event_name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Granted by {names.get(g.granted_by) ?? g.granted_by} on{" "}
                    {new Date(g.granted_at).toLocaleDateString()}
                    {g.expires_at && ` · expires ${new Date(g.expires_at).toLocaleDateString()}`}
                    {g.revoked_at && ` · revoked ${new Date(g.revoked_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      isActive
                        ? "bg-green-50 text-green-700 ring-green-600/20"
                        : "bg-gray-100 text-gray-600 ring-gray-500/20"
                    }`}
                  >
                    {g.revoked_at ? "revoked" : isExpired ? "expired" : "active"}
                  </span>
                  {isActive && (
                    <form action={revokeGrant.bind(null, g.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
