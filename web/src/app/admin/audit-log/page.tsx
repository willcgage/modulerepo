import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profiles";

const TABLES = [
  "owner_profiles",
  "rail_car_types",
  "show_master_grants",
  "freemon_modules",
  "module_categories",
  "module_geometries",
  "industry_types",
  "module_standards",
];

const ACTIONS = ["INSERT", "UPDATE", "DELETE"];

const ACTION_STYLES: Record<string, string> = {
  INSERT: "bg-green-50 text-green-700 ring-green-600/20",
  UPDATE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  DELETE: "bg-red-50 text-red-700 ring-red-600/20",
};

function filterHref(table?: string, action?: string) {
  const params = new URLSearchParams();
  if (table) params.set("table", table);
  if (action) params.set("action", action);
  const qs = params.toString();
  return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
        active
          ? "bg-gray-900 text-white ring-gray-900"
          : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; action?: string }>;
}) {
  const { table, action } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, old_data, new_data, performed_by, performed_at")
    .order("performed_at", { ascending: false })
    .limit(100);

  if (table) query = query.eq("table_name", table);
  if (action) query = query.eq("action", action);

  const { data: entries } = await query;
  const names = await fetchDisplayNames(supabase, (entries ?? []).map((e) => e.performed_by));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Audit log</h1>
      <p className="mt-1 text-sm text-gray-600">
        The most recent 100 changes to admin-relevant tables — profiles/roles,
        car-type suggestions, grants, modules, and lookup tables.
      </p>

      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Table:</span>
          <FilterLink href={filterHref(undefined, action)} active={!table}>All</FilterLink>
          {TABLES.map((t) => (
            <FilterLink key={t} href={filterHref(t, action)} active={table === t}>
              {t}
            </FilterLink>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Action:</span>
          <FilterLink href={filterHref(table, undefined)} active={!action}>All</FilterLink>
          {ACTIONS.map((a) => (
            <FilterLink key={a} href={filterHref(table, a)} active={action === a}>
              {a}
            </FilterLink>
          ))}
        </div>
      </div>

      {!entries || entries.length === 0 ? (
        <p className="mt-8 text-sm text-gray-600">No matching activity recorded.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-gray-200 bg-white">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ACTION_STYLES[entry.action] ?? ""}`}
                    >
                      {entry.action}
                    </span>
                    <span className="font-mono text-xs text-gray-500">{entry.table_name}</span>
                    <span className="text-gray-900">#{entry.record_id}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {(entry.performed_by && names.get(entry.performed_by)) ?? "system"} ·{" "}
                    {new Date(entry.performed_at).toLocaleString()}
                  </span>
                </summary>
                <div className="grid grid-cols-1 gap-4 border-t border-gray-100 px-4 py-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Before</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                      {entry.old_data ? JSON.stringify(entry.old_data, null, 2) : "—"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">After</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                      {entry.new_data ? JSON.stringify(entry.new_data, null, 2) : "—"}
                    </pre>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
