"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateModuleName } from "@/lib/edge";

export type BasicsUpdate = {
  module_name: string;
  description: string;
  category: string;
  geometry_type: string;
  geometry_degrees: string;
  geometry_offset_inches: string;
  length_feet: string;
  length_inches: string;
  has_mss: boolean;
  mss_block_count: string;
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

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
      geometry_type: input.geometry_type,
      geometry_degrees: toNullableNumber(input.geometry_degrees),
      geometry_offset_inches: toNullableNumber(input.geometry_offset_inches),
      length_feet: Number(input.length_feet),
      length_inches: Number(input.length_inches),
      has_mss: input.has_mss,
      mss_block_count: input.has_mss ? toNullableNumber(input.mss_block_count) : null,
    })
    .eq("id", moduleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/modules/${moduleId}`);
  redirect(`/modules/${moduleId}`);
}
