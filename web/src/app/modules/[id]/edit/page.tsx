import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditModuleForm } from "./edit-form";
import type { BasicsUpdate } from "./actions";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const moduleId = Number(id);
  if (!Number.isInteger(moduleId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select(
      "id, owner_id, module_name, description, category, has_mss, mss_type",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (!module) notFound();
  if (module.owner_id !== user.id) redirect(`/modules/${moduleId}`);

  const { data: categories } = await supabase
    .from("module_categories")
    .select("value, display_label")
    .order("display_label");

  // ⛔ The `hasSections` guard went with the fields it guarded (#120). Sections
  // own a module's shape and length once it has any (#108) — and that is now the
  // builder's problem alone, because the builder is the only place those are
  // edited. This page had the guard on the geometry and not on the length.
  const initial: BasicsUpdate = {
    module_name: module.module_name,
    description: module.description ?? "",
    category: module.category,
    has_mss: module.has_mss,
    mss_type: module.mss_type ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href={`/modules/${moduleId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to module
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Edit module details</h1>
        {/* This used to say endplates and industries were managed on the module
            page. They were, and that was the bug (#120) — they are authored on
            the board now, and the module page no longer offers them either. */}
        <p className="mt-1 text-sm text-gray-600">
          The module&rsquo;s shape and length, its endplates, track and
          industries are all drawn in the{" "}
          <Link href={`/modules/${moduleId}/schematic`} className="font-medium text-blue-600 hover:underline">
            schematic builder
          </Link>
          ; images are on the module page.
        </p>
      </div>

      <EditModuleForm
        moduleId={moduleId}
        initial={initial}
        categories={categories ?? []}
      />
    </div>
  );
}
