"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  inchesToScaleFeet,
  endplateWidthInches,
  type ModuleSchematicDoc,
} from "@/lib/module-schematic";

/** The dimensions that size the board — edited in the schematic builder's first
 * stage, because everything downstream is measured against them. */
export type ModuleDimensions = {
  geometry_type: string;
  geometry_degrees: string;
  geometry_offset_inches: string;
  length_total_inches: string;
  mainline_length_inches: string;
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * Update just the module's geometry + lengths (owner-only). Narrower than the
 * edit page's updateModuleBasics — no name validation, no redirect — so the
 * schematic builder can save dimensions alongside the doc without leaving.
 */
export async function updateModuleDimensions(
  moduleId: number,
  input: ModuleDimensions,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select("id, owner_id")
    .eq("id", moduleId)
    .maybeSingle();
  if (!module || module.owner_id !== user.id) redirect(`/modules/${moduleId}`);

  const footprint = toNullableNumber(input.length_total_inches);
  if (footprint == null || footprint <= 0) {
    return { error: "Module footprint length is required." };
  }

  const { error } = await supabase
    .from("freemon_modules")
    .update({
      geometry_type: input.geometry_type || null,
      geometry_degrees: toNullableNumber(input.geometry_degrees),
      geometry_offset_inches: toNullableNumber(input.geometry_offset_inches),
      length_total_inches: footprint,
      mainline_length_inches: toNullableNumber(input.mainline_length_inches),
    })
    .eq("id", moduleId);
  if (error) return { error: error.message };

  revalidatePath(`/modules/${moduleId}`);
  revalidatePath(`/modules/${moduleId}/schematic`);
}

/**
 * Save (or clear) a module's operations schematic. Owner-only. The schematic's
 * tracks are the single source of truth for the module's Track section
 * (module_tracks): this syncs those rows to match — inserting new tracks,
 * updating names/capacities (capacity computed from the track's inch length),
 * and deleting tracks the owner removed in the builder — then stores the doc.
 */
export async function saveModuleSchematic(
  moduleId: number,
  doc: ModuleSchematicDoc | null,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select("id, owner_id, schematic_version")
    .eq("id", moduleId)
    .maybeSingle();

  if (!module || module.owner_id !== user.id) {
    redirect(`/modules/${moduleId}`);
  }

  if (doc) {
    if (
      typeof doc.lengthInches !== "number" ||
      !Array.isArray(doc.endplates) ||
      !Array.isArray(doc.tracks)
    ) {
      return { error: "Invalid schematic — missing length, endplates or tracks." };
    }

    // Sync the module's Track section (module_tracks) from the schematic tracks.
    const extraTracks = doc.tracks.filter((t) => t.role !== "main");
    const keptIds: number[] = [];
    for (const t of extraTracks) {
      const capacity =
        t.capacityFeet ??
        Math.round(inchesToScaleFeet(Math.abs((t.toPos ?? 0) - (t.fromPos ?? 0))));
      const trackName = t.trackName?.trim() || null;

      if (t.moduleTrackId != null) {
        const { error } = await supabase
          .from("module_tracks")
          .update({ track_name: trackName, capacity_scale_feet: capacity })
          .eq("id", t.moduleTrackId)
          .eq("module_id", moduleId);
        if (error) return { error: error.message };
        keptIds.push(t.moduleTrackId);
      } else {
        const { data: inserted, error } = await supabase
          .from("module_tracks")
          .insert({ module_id: moduleId, track_name: trackName, capacity_scale_feet: capacity })
          .select("id")
          .single();
        if (error || !inserted) return { error: error?.message ?? "insert failed" };
        t.moduleTrackId = inserted.id;
        keptIds.push(inserted.id);
      }
    }

    // NB: removing Track-section rows is deferred to the END of this block —
    // freemon_industries.track_id is a RESTRICT foreign key, so a track can't be
    // deleted while an industry still references it. Industries are re-pointed
    // (and removed ones deleted) first, below, then the tracks are cleaned up.

    // Sync freemon_industries from the schematic's industries. The doc holds
    // the geometry (span/side/label); freemon_industries is the row of record
    // (name/type/track) the catalog and Free-Dispatcher read. Map each
    // industry's doc track id → its module_tracks id (null = on the main).
    const trackIdOf = (docTrackId: string): number | null =>
      doc.tracks.find((t) => t.id === docTrackId)?.moduleTrackId ?? null;
    const industries = doc.industries ?? [];
    const keptInd: number[] = [];
    // New rows get industry_number above the current max, so we never collide
    // with a kept row (in case (module_id, industry_number) is unique).
    const { data: maxRow } = await supabase
      .from("freemon_industries")
      .select("industry_number")
      .eq("module_id", moduleId)
      .order("industry_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextNum = (maxRow?.industry_number ?? 0) + 1;
    for (const ind of industries) {
      const name = ind.name?.trim() || "Industry";
      const type = (ind.type ?? "").trim() || "other";
      const track_id = trackIdOf(ind.track);
      if (ind.moduleIndustryId != null) {
        const { error } = await supabase
          .from("freemon_industries")
          .update({ industry_name: name, industry_type: type, track_id })
          .eq("id", ind.moduleIndustryId)
          .eq("module_id", moduleId);
        if (error) return { error: error.message };
        keptInd.push(ind.moduleIndustryId);
      } else {
        // NOT-NULL columns without a default (label, industry_number) are set
        // explicitly so an insert never depends on a DB trigger.
        const { data: inserted, error } = await supabase
          .from("freemon_industries")
          .insert({
            module_id: moduleId,
            industry_number: nextNum++,
            label: name,
            industry_name: name,
            industry_type: type,
            track_id,
          })
          .select("id")
          .single();
        if (error || !inserted) return { error: error?.message ?? "industry insert failed" };
        ind.moduleIndustryId = inserted.id;
        keptInd.push(inserted.id);
      }
    }
    // Remove industries the owner deleted (car-type links cascade).
    const delInd = supabase.from("freemon_industries").delete().eq("module_id", moduleId);
    const { error: delIndErr } = keptInd.length
      ? await delInd.not("id", "in", `(${keptInd.join(",")})`)
      : await delInd;
    if (delIndErr) return { error: delIndErr.message };

    // Sync each industry's car types (freemon_industry_car_types). Resolve the
    // authored car-type VALUES to rail_car_types ids, then replace each
    // industry's links (delete-then-insert — the sets are tiny).
    const wantedValues = [...new Set(industries.flatMap((i) => i.carTypes ?? []))];
    const idOfValue = new Map<string, number>();
    if (wantedValues.length) {
      const { data: rows, error } = await supabase
        .from("rail_car_types")
        .select("id, value")
        .in("value", wantedValues);
      if (error) return { error: error.message };
      for (const r of rows ?? []) idOfValue.set(r.value, r.id);
    }
    for (const ind of industries) {
      if (ind.moduleIndustryId == null) continue;
      const { error: clearErr } = await supabase
        .from("freemon_industry_car_types")
        .delete()
        .eq("industry_id", ind.moduleIndustryId);
      if (clearErr) return { error: clearErr.message };
      const links = (ind.carTypes ?? [])
        .map((v) => idOfValue.get(v))
        .filter((id): id is number => id != null)
        .map((car_type_id) => ({ industry_id: ind.moduleIndustryId!, car_type_id }));
      if (links.length) {
        const { error: insErr } = await supabase
          .from("freemon_industry_car_types")
          .insert(links);
        if (insErr) return { error: insErr.message };
      }
    }

    // Now that industries are re-pointed and removed ones deleted, it's safe to
    // remove the Track-section rows the owner deleted. First null any remaining
    // industry reference to a track about to go (RESTRICT FK), then delete.
    if (keptIds.length) {
      const { error: nullErr } = await supabase
        .from("freemon_industries")
        .update({ track_id: null })
        .eq("module_id", moduleId)
        .not("track_id", "in", `(${keptIds.join(",")})`);
      if (nullErr) return { error: nullErr.message };
    }
    const del = supabase.from("module_tracks").delete().eq("module_id", moduleId);
    const { error: delErr } = keptIds.length
      ? await del.not("id", "in", `(${keptIds.join(",")})`)
      : await del;
    if (delErr) return { error: delErr.message };

    // Sync freemon_endplates from the doc's endplate configs — downstream
    // (Free-Dispatcher) snaps modules together by these rows, so a track drawn
    // onto a plate ("a track on an endplate = a double-track endplate") must be
    // reflected here. A → endplate_number 1, B → 2. Existing rows keep their
    // hand-authored width/label/notes; only track_config follows the doc (and
    // width when the doc carries an authored width). Rows are never deleted
    // here — quick-create modules gain their rows on first save.
    const { data: epRows, error: epReadErr } = await supabase
      .from("freemon_endplates")
      .select("id, endplate_number, track_config, width_inches")
      .eq("module_id", moduleId);
    if (epReadErr) return { error: epReadErr.message };
    for (const [n, epId] of [
      [1, "A"],
      [2, "B"],
    ] as const) {
      const ep = doc.endplates.find((e) => e.id === epId && !e.at);
      if (!ep) continue; // e.g. a pure turnback loop has no B
      const cfg = ep.tracks?.[0]?.config === "double" ? "double" : "single";
      const authoredWidth =
        typeof ep.widthInches === "number" && ep.widthInches > 0 ? ep.widthInches : null;
      const row = epRows?.find((r) => r.endplate_number === n);
      if (row) {
        const patch: { track_config?: string; width_inches?: number } = {};
        if (row.track_config !== cfg) patch.track_config = cfg;
        if (authoredWidth != null && Number(row.width_inches) !== authoredWidth)
          patch.width_inches = authoredWidth;
        if (Object.keys(patch).length) {
          const { error } = await supabase
            .from("freemon_endplates")
            .update(patch)
            .eq("id", row.id);
          if (error) return { error: error.message };
        }
      } else {
        const { error } = await supabase.from("freemon_endplates").insert({
          module_id: moduleId,
          endplate_number: n,
          label: `EP-${n}`,
          track_config: cfg,
          width_inches: authoredWidth ?? endplateWidthInches(ep),
        });
        if (error) return { error: error.message };
      }
    }
  }

  const nextVersion = doc ? (module.schematic_version ?? 0) + 1 : null;
  const { error } = await supabase
    .from("freemon_modules")
    .update({ schematic: doc, schematic_version: nextVersion })
    .eq("id", moduleId);

  if (error) return { error: error.message };

  revalidatePath(`/modules/${moduleId}`);
  revalidatePath(`/modules/${moduleId}/schematic`);
}
