"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ModuleSchematicDoc } from "@/lib/module-schematic";

/**
 * Save (or clear) a module's operations schematic (track-graph). Owner-only. The
 * doc conforms to docs/module-schematic-format.md in the free-dispatcher repo.
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
    // Basic shape guard — the client builds this, but never trust the wire.
    if (
      typeof doc.lengthInches !== "number" ||
      !Array.isArray(doc.endplates) ||
      !Array.isArray(doc.tracks)
    ) {
      return { error: "Invalid schematic — missing length, endplates or tracks." };
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
