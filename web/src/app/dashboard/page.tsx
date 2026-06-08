import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("owner_profiles")
    .select("display_name, contact_email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Log out
          </button>
        </form>
      </div>

      {updated === "profile" && (
        <p className="mt-6 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Your profile has been updated.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          href="/modules"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          My modules
        </Link>
        <Link
          href="/profile"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit profile
        </Link>
      </div>

      <dl className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        <Row label="Display name" value={profile?.display_name ?? "—"} />
        <Row label="Email" value={profile?.contact_email ?? user.email ?? "—"} />
        <Row label="Role" value={profile?.role ?? "—"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-6 py-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
