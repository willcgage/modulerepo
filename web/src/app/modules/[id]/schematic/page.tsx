import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { docToState, nextId, MAIN_TRACK_ID } from "@/lib/module-schematic";
import { fetchIndustryTypes, fetchCarTypes } from "@/lib/edge";
import { loadStoredTrackParts } from "@/lib/track-parts";
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
  // An ADMIN may open anyone's builder to diagnose a report, but READ-ONLY: the
  // canvas and inspector are the only place a lot of this is visible, and
  // reproducing an owner's module from scratch to debug it is guesswork.
  // Read-only is enforced twice — `patch()` is inert here (so autosave never
  // sees a dirty doc), AND saveModuleSchematic/updateModuleDimensions stay
  // owner-only server-side. ⚠️ RLS grants admins UPDATE on every module, so the
  // database will NOT stop an admin write — those action checks are the guard.
  // Don't relax them for admins without replacing this invariant.
  let readOnly = false;
  if (module.owner_id !== user.id) {
    const { data: profile } = await supabase
      .from("owner_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") redirect(`/modules/${moduleId}`);
    readOnly = true;
  }

  const { data: moduleTracks } = await supabase
    .from("module_tracks")
    .select("id, track_name, capacity_scale_feet")
    .eq("module_id", moduleId)
    .order("id");

  // Existing industries (rows of record) + the type/car lookups for the inspector.
  // The turnout parts library — turnouts are drawn at their part's measured
  // dimensions, so this is what an admin adding a manufacturer's switch changes.
  const [{ data: industryRows }, industryTypes, carTypes, storedParts] = await Promise.all([
    supabase
      .from("freemon_industries")
      .select("id, industry_name, industry_type, track_id")
      .eq("module_id", moduleId)
      .order("id"),
    fetchIndustryTypes(),
    fetchCarTypes(),
    loadStoredTrackParts(),
  ]);

  // Car types spotted at each industry (join → rail_car_types.value).
  const carTypesByIndustry = new Map<number, string[]>();
  const industryIds = (industryRows ?? []).map((r) => r.id);
  if (industryIds.length) {
    const { data: links } = await supabase
      .from("freemon_industry_car_types")
      .select("industry_id, rail_car_types(value)")
      .in("industry_id", industryIds);
    for (const l of links ?? []) {
      const rel = l.rail_car_types as { value: string } | { value: string }[] | null;
      const value = Array.isArray(rel) ? rel[0]?.value : rel?.value;
      if (!value) continue;
      const arr = carTypesByIndustry.get(l.industry_id) ?? [];
      arr.push(value);
      carTypesByIndustry.set(l.industry_id, arr);
    }
  }

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

  // Reconcile industries of record with the doc: the doc carries geometry
  // (span/side) for industries already placed; any freemon_industries row not
  // yet placed is added positionless so the owner can drop it on the canvas.
  const placed = new Set(
    initial.industries.map((i) => i.moduleIndustryId).filter((v): v is number => v != null),
  );
  for (const row of industryRows ?? []) {
    if (placed.has(row.id)) continue;
    const onTrack = initial.extraTracks.find((t) => t.moduleTrackId === row.track_id);
    initial.industries.push({
      id: nextId("ind", initial.industries.map((i) => i.id)),
      name: row.industry_name ?? "",
      type: row.industry_type ?? "",
      track: onTrack?.id ?? MAIN_TRACK_ID,
      fromPos: onTrack ? onTrack.fromPos : Math.round(initial.lengthInches * 0.35),
      toPos: onTrack ? onTrack.toPos : Math.round(initial.lengthInches * 0.6),
      spots: [],
      side: "below",
      labelMode: "none",
      carTypes: [],
      moduleIndustryId: row.id,
    });
  }
  // Car types are the row's source of truth — apply them over any doc copy.
  for (const ind of initial.industries) {
    if (ind.moduleIndustryId != null) {
      ind.carTypes = carTypesByIndustry.get(ind.moduleIndustryId) ?? ind.carTypes;
    }
  }

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
        // A new module SEEDS its board on first open — that's a write, so never
        // let it fire on someone else's module.
        newModule={isNew === "1" && !readOnly}
        readOnly={readOnly}
        // Endplate rows FOLLOW the schematic now (saveModuleSchematic syncs
        // track_config on every save), so existing rows no longer lock the
        // configs — the canvas is the source of truth; rows still SEED the
        // configs above for legacy modules whose doc predates the sync.
        lockedConfigs={{ a: false, b: false }}
        geometries={geometries ?? []}
        industryTypes={industryTypes}
        carTypes={carTypes}
        storedParts={storedParts}
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
