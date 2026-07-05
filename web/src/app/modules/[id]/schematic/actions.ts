"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  inchesToScaleFeet,
  type ModuleSchematicDoc,
} from "@/lib/module-schematic";

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

    // Remove Track-section rows the owner deleted in the builder.
    const del = supabase.from("module_tracks").delete().eq("module_id", moduleId);
    const { error: delErr } = keptIds.length
      ? await del.not("id", "in", `(${keptIds.join(",")})`)
      : await del;
    if (delErr) return { error: delErr.message };
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
