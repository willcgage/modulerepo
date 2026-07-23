import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { asModuleSchematic } from "@/lib/module-schematic";
import { SchematicPreview } from "@/app/modules/[id]/schematic/schematic-preview";
import { ModuleFootprintView, footprintInput } from "@/components/module-footprint-view";
import { StatusBadge } from "@/components/status-badge";

export default async function ModulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: modules } = await supabase
    .from("freemon_modules")
    .select(
      "id, record_number, module_name, category, status, endplate_count, updated_at, schematic, geometry_type, geometry_degrees, geometry_offset_inches, length_total_inches, mainline_length_inches",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const list = modules ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My modules</h1>
          <p className="mt-1 text-sm text-gray-600">
            Free-moN modules you own and maintain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/catalog"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Catalog
          </Link>
          <Link
            href="/help#creating-module"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Help
          </Link>
          <Link
            href="/modules/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New module
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">
            You haven&apos;t added any modules yet.
          </p>
          <Link
            href="/modules/new"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Create your first module
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((module) => {
            const doc = asModuleSchematic(module.schematic);
            return (
              <Link
                key={module.id}
                href={`/modules/${module.id}`}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {module.module_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {module.record_number} · {module.category} ·{" "}
                      {module.endplate_count} endplate
                      {module.endplate_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={module.status} />
                </div>

                <div className="mt-3 space-y-2">
                  {/* Physical board (to scale) — what it looks like */}
                  <ModuleFootprintView input={footprintInput(module, doc)} doc={doc} height={90} />
                  {/* Dispatcher schematic — how it operates */}
                  {doc ? (
                    <SchematicPreview doc={doc} />
                  ) : (
                    <div className="flex h-12 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-400">
                      No schematic yet
                    </div>
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
