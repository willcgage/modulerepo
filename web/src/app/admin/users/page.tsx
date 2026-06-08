import { createClient } from "@/lib/supabase/server";
import { SelectField, SubmitButton } from "@/components/form-fields";
import { updateUserRole } from "./actions";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("owner_profiles")
    .select("id, display_name, contact_email, role, created_at")
    .order("created_at");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
      <p className="mt-1 text-sm text-gray-600">
        Everyone with an account. Promote a trusted owner to admin, or demote an
        admin back to owner.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!profiles || profiles.length === 0 ? (
        <p className="mt-8 text-sm text-gray-600">No users yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {profiles.map((p) => {
            const isSelf = p.id === user?.id;
            return (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{p.display_name}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {p.contact_email ?? "—"} · joined {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>

                {isSelf ? (
                  <p className="shrink-0 text-xs text-gray-500">
                    This is you (admin) — ask another admin to change your role.
                  </p>
                ) : (
                  <form
                    action={updateUserRole.bind(null, p.id)}
                    className="flex shrink-0 items-end gap-2"
                  >
                    <div className="w-36">
                      <SelectField label="Role" name="role" defaultValue={p.role} options={ROLE_OPTIONS} />
                    </div>
                    <div className="mb-4">
                      <SubmitButton label="Save" variant="secondary" />
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
