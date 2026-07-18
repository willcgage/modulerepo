import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuickCreate } from "./quick-create";

export default async function NewModulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: categories }, { data: geometries }] = await Promise.all([
    supabase
      .from("module_categories")
      .select("value, display_label")
      .order("display_label"),
    supabase
      .from("module_geometries")
      .select("value, display_label, requires_degrees, requires_offset_inches")
      .order("display_label"),
  ]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link href="/modules" className="text-sm text-blue-600 hover:underline">
        ← Back to my modules
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">New module</h1>
      <p className="mt-1 mb-5 text-sm text-gray-600">
        Enough to start drawing — you&rsquo;ll lay out the board and track on the canvas.
      </p>

      <QuickCreate categories={categories ?? []} geometries={geometries ?? []} />
    </div>
  );
}
