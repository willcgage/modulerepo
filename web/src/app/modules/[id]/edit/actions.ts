"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateModuleName } from "@/lib/edge";

/**
 * The module's NON-GEOMETRIC facts — the ones a board cannot tell you.
 *
 * ⛔ GEOMETRY AND LENGTH ARE NOT HERE ANY MORE (#120). `geometry_type`,
 * `geometry_degrees`, `geometry_offset_inches` and `length_total_inches` are
 * edited in the schematic builder's Module panel, which has always been the
 * better copy: it knows about SECTIONS, so it hides the module-level shape once
 * the boards carry their own and disables a length that is derived from them.
 * This page offered the same four with a `hasSections` guard on the geometry and
 * NONE on the length — half the trap, spotted and half-fixed, its own comment
 * reading *"Same trap as the endplate config on the detail page"*.
 *
 * ⚠️ `mainline_length_inches` is gone from here too, and NOT because it moved:
 * it never had an input on this page at all — it was round-tripped through the
 * form untouched. See #120's audit; it is read by the builder as the basis for
 * the entire canvas and is authored NOWHERE, which is its own issue.
 */
export type BasicsUpdate = {
  module_name: string;
  description: string;
  category: string;
  has_mss: boolean;
  mss_type: string; // "" | "crossover" | "cascade" — only meaningful when has_mss
};

export async function updateModuleBasics(
  moduleId: number,
  input: BasicsUpdate,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select("id, owner_id, module_name")
    .eq("id", moduleId)
    .maybeSingle();

  if (!module || module.owner_id !== user.id) {
    redirect(`/modules/${moduleId}`);
  }

  const trimmedName = input.module_name.trim();
  if (trimmedName.toLowerCase() !== module.module_name.toLowerCase()) {
    const nameCheck = await validateModuleName(trimmedName, moduleId);
    if (!nameCheck.valid) {
      return { error: nameCheck.message };
    }
  }

  const { error } = await supabase
    .from("freemon_modules")
    .update({
      module_name: trimmedName,
      description: input.description.trim() || null,
      category: input.category,
      has_mss: input.has_mss,
      mss_type: input.has_mss ? input.mss_type.trim() || null : null,
    })
    .eq("id", moduleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/modules/${moduleId}`);
  redirect(`/modules/${moduleId}`);
}
