"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suggestCarType, validateModuleName } from "@/lib/edge";

export type BasicsInput = {
  module_name: string;
  description: string;
  category: string;
  geometry_type: string;
  geometry_degrees: string;
  geometry_offset_inches: string;
  length_total_inches: string;
  mainline_length_inches: string;
  has_mss: boolean;
  mss_type: string; // "" | "crossover" | "cascade" — only meaningful when has_mss
};

// ⛔ EndplateInput / TrackInput / IndustryInput are GONE with the detailed
// wizard (#120). A module is no longer BORN with endplates, tracks and
// industries typed up front: all three are authored on the board, where they
// can be placed. Creating them here made rows the schematic did not know
// about, from the very first moment of a module's life — an endplate with no
// position, and an industry the first schematic save would delete.

export async function checkModuleName(moduleName: string) {
  if (!moduleName.trim()) return { valid: true as const };
  return validateModuleName(moduleName.trim());
}

export async function submitCarTypeSuggestion(
  value: string,
  displayLabel: string,
  notes: string,
) {
  return suggestCarType(value, displayLabel, notes);
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export async function createModule(
  basics: BasicsInput,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: module, error: moduleError } = await supabase
    .from("freemon_modules")
    .insert({
      owner_id: user.id,
      module_name: basics.module_name.trim(),
      description: basics.description.trim() || null,
      category: basics.category,
      // A blank module carries no geometry — it's drawn on the canvas, not
      // declared. Empty → NULL so the FK to module_geometries is satisfied
      // (the column is nullable; an empty string is not a valid geometry key).
      geometry_type: basics.geometry_type || null,
      geometry_degrees: toNullableNumber(basics.geometry_degrees),
      geometry_offset_inches: toNullableNumber(basics.geometry_offset_inches),
      length_total_inches: Number(basics.length_total_inches),
      mainline_length_inches: toNullableNumber(basics.mainline_length_inches),
      has_mss: basics.has_mss,
      mss_type: basics.has_mss ? basics.mss_type.trim() || null : null,
    })
    .select("id")
    .single();

  if (moduleError || !module) {
    return { error: moduleError?.message ?? "Could not create the module." };
  }

  const moduleId = module.id;

  // Land in the schematic builder — where a module is actually authored: the
  // mainline, the track, the endplates it presents and the industries it
  // serves are all drawn there, on a board, in the place they physically sit.
  redirect(`/modules/${moduleId}/schematic?new=1`);
}
