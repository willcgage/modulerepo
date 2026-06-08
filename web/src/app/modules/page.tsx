import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
      "id, record_number, module_name, category, status, endplate_count, updated_at",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My modules</h1>
          <p className="mt-1 text-sm text-gray-600">
            Free-moN modules you own and maintain.
          </p>
        </div>
        <Link
          href="/modules/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New module
        </Link>
      </div>

      {!modules || modules.length === 0 ? (
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
        <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {modules.map((module) => (
            <li key={module.id}>
              <Link
                href={`/modules/${module.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {module.module_name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {module.record_number} · {module.category} ·{" "}
                    {module.endplate_count} endplate
                    {module.endplate_count === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={module.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
