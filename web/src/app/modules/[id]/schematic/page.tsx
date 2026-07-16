import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { docToState } from "@/lib/module-schematic";
import { SchematicEditor } from "./editor";

export default async function ModuleSchematicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
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
      "id, owner_id, record_number, module_name, length_total_inches, mainline_length_inches, schematic, geometry_type, geometry_degrees, geometry_offset_inches",
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

  // Geometry choices — the builder's first stage edits these, since they size
  // the board everything else is drawn on.
  const { data: geometries } = await supabase
    .from("module_geometries")
    .select("value, display_label, requires_degrees, requires_offset_inches")
    .order("value");

  // The module's endplate records are AUTHORITATIVE for the main-track config
  // (single/double per end) — the schematic mirrors them, like the mainline
  // length. Without this, a single↔double module (FMN-0038) opened the builder
  // as single/single and the transition prompt never fired.
  const { data: endplateRows } = await supabase
    .from("freemon_endplates")
    .select("endplate_number, track_config")
    .eq("module_id", moduleId)
    .order("endplate_number");

  const cfgOf = (n: number): "single" | "double" | null => {
    const v = (endplateRows?.[n]?.track_config ?? "").trim().toLowerCase();
    return v === "double" ? "double" : v === "single" ? "single" : null;
  };
  const epA = cfgOf(0);
  const epB = cfgOf(1);

  const fallbackLength =
    Number(module.mainline_length_inches ?? module.length_total_inches) || 24;
  const initial = docToState(module.schematic, fallbackLength, moduleTracks ?? []);
  // Override the doc with the module's endplate configs (non-loop; a loop's
  // B carries interchange semantics the endplate rows don't describe).
  if (epA) initial.configA = epA;
  if (epB && !initial.loop) initial.configB = epB;

  // An editor is not an article: full-bleed, viewport-height, no page scroll —
  // the canvas gets the room, and each panel scrolls itself.
  return (
    <div className="h-dvh overflow-hidden">
      <SchematicEditor
        moduleId={moduleId}
        recordNumber={module.record_number}
        moduleName={module.module_name}
        initial={initial}
        hadSchematic={module.schematic != null}
        newModule={isNew === "1"}
        lockedConfigs={{ a: epA != null, b: epB != null && !initial.loop }}
        geometries={geometries ?? []}
        initialDimensions={{
          geometry_type: module.geometry_type ?? "",
          geometry_degrees: module.geometry_degrees?.toString() ?? "",
          geometry_offset_inches: module.geometry_offset_inches?.toString() ?? "",
          length_total_inches: module.length_total_inches?.toString() ?? "",
          mainline_length_inches: module.mainline_length_inches?.toString() ?? "",
        }}
      />
    </div>
  );
}
