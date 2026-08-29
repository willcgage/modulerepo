import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  docToState,
  defaultEndplateLabel,
  nextId,
  MAIN_TRACK_ID,
} from "@/lib/module-schematic";
import { fetchIndustryTypes, fetchCarTypes } from "@/lib/edge";
import { loadStoredTrackParts } from "@/lib/track-parts";
import { SchematicEditorClient } from "./editor-client";

export default async function ModuleSchematicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  // ⏱ TEMPORARY INSTRUMENTATION (#373) — /modules/[id]/schematic times out at
  // Vercel's 300s ceiling with memory climbing 218→340MB, and it does NOT
  // reproduce locally in dev or a production build over the same document,
  // parts library and rows. So make production say which phase burns the time.
  //
  // ⚠️ No timestamps here on purpose: `Date.now()` in a component is an IMPURE
  // CALL DURING RENDER and this repo's lint rejects it — the same rule that was
  // right about a write-capable function in render (#284). Vercel stamps every
  // log line, so the deltas come from the log viewer for free.
  //
  // Read it like this: the LAST phase logged is the one that never finished.
  // If "handing off to render" appears and the request still times out, the
  // hang is in SSR of SchematicEditor itself, not in this page's own work.
  const lap = (phase: string) => console.log(`[schematic-page] ${phase}`);

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

  lap("loaded module");
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

  lap("auth+owner check");
  const { data: moduleTracks } = await supabase
    .from("module_tracks")
    .select("id, track_name, capacity_scale_feet")
    .eq("module_id", moduleId)
    .order("id");

  // Existing industries (rows of record) + the type/car lookups for the inspector.
  // The turnout parts library — turnouts are drawn at their part's measured
  // dimensions, so this is what an admin adding a manufacturer's turnout changes.
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

  lap("parallel lookups");
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
  lap("car types");
  const { data: geometries } = await supabase
    .from("module_geometries")
    .select("value, display_label, requires_degrees, requires_offset_inches")
    .order("value");

  // ⚠️ THE ROWS SEED, THEY NO LONGER DECIDE. This comment used to say the
  // endplate records were AUTHORITATIVE and the schematic mirrored them; that
  // has been backwards for some time and #120 settles it — the DOC owns the
  // config, `saveModuleSchematic` rewrites these rows from it on every save,
  // and the read-only mirror the claim justified (`lockedConfigs`) was dead
  // code hard-coded to false at this very call site.
  //
  // What the rows are still for: a LEGACY module whose doc predates the sync
  // opens with the right configs. Without it a single↔double module (FMN-0038)
  // opened as single/single and the transition prompt never fired. The label is
  // seeded the same way, for the same reason, just below.
  lap("geometries");
  const { data: endplateRows } = await supabase
    .from("freemon_endplates")
    .select("endplate_number, track_config, label")
    .eq("module_id", moduleId)
    .order("endplate_number");

  const cfgOf = (n: number): "single" | "double" | null => {
    const v = (endplateRows?.[n]?.track_config ?? "").trim().toLowerCase();
    return v === "double" ? "double" : v === "single" ? "single" : null;
  };
  const epA = cfgOf(0);
  const epB = cfgOf(1);

  /**
   * The owner's NAME for an end, seeded from the row (#120).
   *
   * Naming an endplate used to live on the module detail page, and eleven
   * modules on prod carry a real one — "UP Spokane N", "MR St Maries e",
   * "South EP". Those names are in `freemon_endplates.label` and NOT in any
   * document, because `stateToDoc` wrote a constant there until 0.123.0. So the
   * builder seeds from the row exactly as it already does for track_config: the
   * name is in the Name box the first time its owner opens the board, and their
   * first save carries it into the document for good.
   *
   * ⚠️ `EP-1`/`EP-2` are what `saveModuleSchematic` inserts when it creates a
   * row, and the default words are what the emitter writes — neither is
   * anybody's name, and seeding one would turn a placeholder into an override.
   */
  const nameOf = (n: number, id: "A" | "B"): string | null => {
    const raw = (endplateRows?.[n]?.label ?? "").trim();
    if (!raw || /^EP-\d+$/.test(raw)) return null;
    return raw === defaultEndplateLabel(id, false) || raw === defaultEndplateLabel(id, true)
      ? null
      : raw;
  };

  lap("endplate rows");
  const fallbackLength =
    Number(module.mainline_length_inches ?? module.length_total_inches) || 24;
  const initial = docToState(module.schematic, fallbackLength, moduleTracks ?? []);
  // Override the doc with the module's endplate configs (non-loop; a loop's
  // B carries interchange semantics the endplate rows don't describe).
  if (epA) initial.configA = epA;
  if (epB && !initial.loop) initial.configB = epB;
  // Seed a name only where the document has none — a doc that already carries
  // one is the newer truth, and overwriting it with the row would undo the last
  // save. Same shape as the config seeding above, opposite precedence for the
  // same reason: the row is the legacy source, the doc is the live one.
  for (const [n, id] of [[0, "A"], [1, "B"]] as const) {
    const name = nameOf(n, id);
    if (name && !initial.endplateLabels[id]) initial.endplateLabels[id] = name;
  }

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

  lap("state built — handing off to render");
  // An editor is not an article: full-bleed, viewport-height, no page scroll —
  // the canvas gets the room, and each panel scrolls itself.
  return (
    <div className="h-dvh overflow-hidden">
      <SchematicEditorClient
        moduleId={moduleId}
        recordNumber={module.record_number}
        moduleName={module.module_name}
        initial={initial}
        hadSchematic={module.schematic != null}
        // A new module SEEDS its board on first open — that's a write, so never
        // let it fire on someone else's module.
        newModule={isNew === "1" && !readOnly}
        readOnly={readOnly}
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
