import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { docToState } from "@/lib/module-schematic";
import { SchematicEditor } from "./editor";

export default async function ModuleSchematicPage({
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
      "id, owner_id, record_number, module_name, length_total_inches, mainline_length_inches, schematic",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (!module) notFound();
  if (module.owner_id !== user.id) redirect(`/modules/${moduleId}`);

  const { data: moduleTracks } = await supabase
    .from("module_tracks")
    .select("id, track_name, capacity_scale_feet")
    .eq("module_id", moduleId)
    .order("id");

  const fallbackLength =
    Number(module.mainline_length_inches ?? module.length_total_inches) || 24;
  const initial = docToState(module.schematic, fallbackLength, moduleTracks ?? []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SchematicEditor
        moduleId={moduleId}
        recordNumber={module.record_number}
        moduleName={module.module_name}
        initial={initial}
        hadSchematic={module.schematic != null}
      />
    </div>
  );
}
