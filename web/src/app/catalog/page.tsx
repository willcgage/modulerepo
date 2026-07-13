import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { asModuleSchematic } from "@/lib/module-schematic";
import { SchematicPreview } from "@/app/modules/[id]/schematic/schematic-preview";
import { StatusBadge } from "@/components/status-badge";

/**
 * Catalog — every module the viewer is allowed to see across all owners.
 * RLS does the scoping: `public_read_active_modules` exposes all active modules,
 * and `owner_read_own_all_status` adds the viewer's own (any status), so a query
 * with no owner filter returns exactly the right set. Each card renders the live
 * operations schematic so the whole roster can be eyeballed at a glance.
 */
export default async function CatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: modules } = await supabase
    .from("freemon_modules")
    .select(
      "id, record_number, module_name, category, status, endplate_count, owner_id, updated_at, schematic",
    )
    .order("record_number", { ascending: true });

  // Owner display names come from a public, name-only view (module_owner_names).
  // If it isn't present yet the catalog still works — just without owner labels.
  const ownerIds = [...new Set((modules ?? []).map((m) => m.owner_id))];
  const ownerName = new Map<string, string>();
  if (ownerIds.length) {
    const { data: owners } = await supabase
      .from("module_owner_names")
      .select("id, display_name")
      .in("id", ownerIds);
    for (const o of owners ?? []) ownerName.set(o.id, o.display_name ?? "");
  }

  const list = modules ?? [];
  const withSchematic = list.filter((m) => asModuleSchematic(m.schematic)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Module catalog</h1>
          <p className="mt-1 text-sm text-gray-600">
            Every published module across all owners{" "}
            <span className="text-gray-400">
              · {list.length} module{list.length === 1 ? "" : "s"} · {withSchematic}{" "}
              with a schematic
            </span>
          </p>
        </div>
        <Link href="/modules" className="text-sm text-gray-500 hover:text-gray-700">
          My modules →
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">No modules to show yet.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const doc = asModuleSchematic(m.schematic);
            const owner = ownerName.get(m.owner_id);
            const mine = m.owner_id === user.id;
            return (
              <Link
                key={m.id}
                href={`/modules/${m.id}`}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {m.module_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {m.record_number} · {m.category} · {m.endplate_count} endplate
                      {m.endplate_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                <div className="mt-3">
                  {doc ? (
                    <SchematicPreview doc={doc} />
                  ) : (
                    <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-400">
                      No schematic yet
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate">
                    {owner ? `by ${owner}` : mine ? "by you" : ""}
                  </span>
                  {mine && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      yours
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
