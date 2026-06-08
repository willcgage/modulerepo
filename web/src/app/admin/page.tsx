import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profiles";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: pendingSuggestions },
    { count: activeGrants },
    { count: totalOwners },
    { count: totalAdmins },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("rail_car_types")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("show_master_grants")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null),
    supabase
      .from("owner_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner"),
    supabase
      .from("owner_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
    supabase
      .from("audit_log")
      .select("id, table_name, record_id, action, performed_at, performed_by")
      .order("performed_at", { ascending: false })
      .limit(5),
  ]);

  const names = await fetchDisplayNames(supabase, (recentActivity ?? []).map((a) => a.performed_by));

  const cards = [
    { label: "Pending suggestions", value: pendingSuggestions ?? 0, href: "/admin/car-types" },
    { label: "Active grants", value: activeGrants ?? 0, href: "/admin/grants" },
    { label: "Owners", value: totalOwners ?? 0, href: "/admin/users" },
    { label: "Admins", value: totalAdmins ?? 0, href: "/admin/users" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">
        Review suggestions, manage reference data, and oversee the repository.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50"
          >
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            <p className="mt-1 text-sm text-gray-600">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
          <Link href="/admin/audit-log" className="text-sm text-blue-600 hover:underline">
            View audit log →
          </Link>
        </div>

        {!recentActivity || recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">No activity recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-gray-900">
                  <span className="font-medium">{entry.action}</span> on{" "}
                  <span className="font-mono text-xs">{entry.table_name}</span> #{entry.record_id}
                </span>
                <span className="text-xs text-gray-500">
                  {(entry.performed_by && names.get(entry.performed_by)) ?? "system"} ·{" "}
                  {new Date(entry.performed_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
