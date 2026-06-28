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
      "id, owner_id, module_name, description, category, geometry_type, geometry_degrees, geometry_offset_inches, length_total_inches, mainline_length_inches, has_mss, mss_type",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (!module) notFound();
  if (module.owner_id !== user.id) redirect(`/modules/${moduleId}`);

  const [{ data: categories }, { data: geometries }] = await Promise.all([
    supabase.from("module_categories").select("value, display_label").order("display_label"),
    supabase
      .from("module_geometries")
      .select("value, display_label, requires_degrees, requires_offset_inches")
      .order("display_label"),
  ]);

  const initial: BasicsUpdate = {
    module_name: module.module_name,
    description: module.description ?? "",
    category: module.category,
    geometry_type: module.geometry_type,
    geometry_degrees: module.geometry_degrees != null ? String(module.geometry_degrees) : "",
    geometry_offset_inches:
      module.geometry_offset_inches != null ? String(module.geometry_offset_inches) : "",
    length_total_inches: String(module.length_total_inches),
    mainline_length_inches: module.mainline_length_inches != null ? String(module.mainline_length_inches) : "",
    has_mss: module.has_mss,
    mss_type: module.mss_type ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href={`/modules/${moduleId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to module
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Edit module basics</h1>
        <p className="mt-1 text-sm text-gray-600">
          Endplates, industries, and images are managed directly from the module page.
        </p>
      </div>

      <EditModuleForm
        moduleId={moduleId}
        initial={initial}
        categories={categories ?? []}
        geometries={geometries ?? []}
      />
    </div>
  );
}
