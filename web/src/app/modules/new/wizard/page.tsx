import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchCarTypes, fetchIndustryTypes } from "@/lib/edge";
import { ModuleWizard } from "../wizard";

// The full 5-step wizard — kept reachable for owners who want to enter
// endplates, tracks and industries up front. The quick create at /modules/new
// is the default path; this is the detailed alternative.
export default async function NewModuleWizardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: categories }, { data: geometries }, industryTypes, carTypes] =
    await Promise.all([
      supabase
        .from("module_categories")
        .select("value, display_label")
        .order("display_label"),
      supabase
        .from("module_geometries")
        .select("value, display_label, requires_degrees, requires_offset_inches")
        .order("display_label"),
      fetchIndustryTypes(),
      fetchCarTypes(),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/modules/new" className="text-sm text-blue-600 hover:underline">
        ← Quick create
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">New module — detailed</h1>
      <p className="mt-1 text-sm text-gray-600">
        Walk through every step, entering endplates, tracks and industries up front.
      </p>

      <ModuleWizard
        categories={categories ?? []}
        geometries={geometries ?? []}
        industryTypes={industryTypes}
        initialCarTypes={carTypes}
      />
    </div>
  );
}
