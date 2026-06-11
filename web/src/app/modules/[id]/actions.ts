"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function path(moduleId: number) {
  return `/modules/${moduleId}`;
}

function toNullableNumber(value: FormDataEntryValue | null): number | null {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

async function requireOwnedModule(supabase: Awaited<ReturnType<typeof createClient>>, moduleId: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select("id, owner_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (!module || module.owner_id !== user.id) {
    redirect(path(moduleId));
  }
  return module;
}

// ---- Module status / delete -------------------------------------------

export async function updateModuleStatus(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const status = (formData.get("status") ?? "").toString();
  await supabase.from("freemon_modules").update({ status }).eq("id", moduleId);
  revalidatePath(path(moduleId));
}

export async function deleteModule(moduleId: number) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("freemon_modules").delete().eq("id", moduleId);
  redirect("/modules");
}

// ---- Endplates ----------------------------------------------------------

export async function addEndplate(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const { count } = await supabase
    .from("freemon_endplates")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  await supabase.from("freemon_endplates").insert({
    module_id: moduleId,
    endplate_number: (count ?? 0) + 1,
    track_config: (formData.get("track_config") ?? "single").toString(),
    width_inches: toNullableNumber(formData.get("width_inches")),
    height_inches: toNullableNumber(formData.get("height_inches")),
    notes: (formData.get("notes") ?? "").toString().trim() || null,
  });
  revalidatePath(path(moduleId));
}

export async function updateEndplate(endplateId: number, moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase
    .from("freemon_endplates")
    .update({
      track_config: (formData.get("track_config") ?? "single").toString(),
      width_inches: toNullableNumber(formData.get("width_inches")),
      height_inches: toNullableNumber(formData.get("height_inches")),
      notes: (formData.get("notes") ?? "").toString().trim() || null,
    })
    .eq("id", endplateId);
  revalidatePath(path(moduleId));
}

export async function deleteEndplate(endplateId: number, moduleId: number) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("freemon_endplates").delete().eq("id", endplateId);
  revalidatePath(path(moduleId));
}

// ---- Tracks ---------------------------------------------------------------

export async function addTrack(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("module_tracks").insert({
    module_id: moduleId,
    track_name: (formData.get("track_name") ?? "").toString().trim() || null,
    capacity_scale_feet: toNullableNumber(formData.get("capacity_scale_feet")),
    notes: (formData.get("notes") ?? "").toString().trim() || null,
  });
  revalidatePath(path(moduleId));
}

export async function updateTrack(trackId: number, moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase
    .from("module_tracks")
    .update({
      track_name: (formData.get("track_name") ?? "").toString().trim() || null,
      capacity_scale_feet: toNullableNumber(formData.get("capacity_scale_feet")),
      notes: (formData.get("notes") ?? "").toString().trim() || null,
    })
    .eq("id", trackId);
  revalidatePath(path(moduleId));
}

export async function deleteTrack(trackId: number, moduleId: number) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const { error } = await supabase.from("module_tracks").delete().eq("id", trackId);
  if (error) {
    redirect(`${path(moduleId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(path(moduleId));
}

// ---- Industries ----------------------------------------------------------

export async function addIndustry(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("freemon_industries").insert({
    module_id: moduleId,
    industry_name: (formData.get("industry_name") ?? "").toString().trim(),
    industry_type: (formData.get("industry_type") ?? "").toString(),
    track_id: toNullableNumber(formData.get("track_id")),
    notes: (formData.get("notes") ?? "").toString().trim() || null,
  });
  revalidatePath(path(moduleId));
}

export async function updateIndustry(industryId: number, moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase
    .from("freemon_industries")
    .update({
      industry_name: (formData.get("industry_name") ?? "").toString().trim(),
      industry_type: (formData.get("industry_type") ?? "").toString(),
      track_id: toNullableNumber(formData.get("track_id")),
      notes: (formData.get("notes") ?? "").toString().trim() || null,
    })
    .eq("id", industryId);
  revalidatePath(path(moduleId));
}

export async function deleteIndustry(industryId: number, moduleId: number) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("freemon_industries").delete().eq("id", industryId);
  revalidatePath(path(moduleId));
}

export async function setIndustryCarTypes(industryId: number, moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const selectedIds = formData
    .getAll("car_type_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  const { data: existing } = await supabase
    .from("freemon_industry_car_types")
    .select("id, car_type_id")
    .eq("industry_id", industryId);

  const existingIds = new Set((existing ?? []).map((row) => row.car_type_id));
  const selectedSet = new Set(selectedIds);

  const toRemove = (existing ?? []).filter((row) => !selectedSet.has(row.car_type_id));
  const toAdd = selectedIds.filter((id) => !existingIds.has(id));

  if (toRemove.length > 0) {
    await supabase
      .from("freemon_industry_car_types")
      .delete()
      .in("id", toRemove.map((row) => row.id));
  }
  if (toAdd.length > 0) {
    await supabase.from("freemon_industry_car_types").insert(
      toAdd.map((carTypeId) => ({ industry_id: industryId, car_type_id: carTypeId })),
    );
  }
  revalidatePath(path(moduleId));
}

// ---- Images ---------------------------------------------------------------

export async function uploadImage(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const caption = (formData.get("caption") ?? "").toString().trim() || null;
  const storagePath = `${moduleId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("module-images")
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    return;
  }

  const { count } = await supabase
    .from("module_images")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  await supabase.from("module_images").insert({
    module_id: moduleId,
    storage_path: storagePath,
    caption,
    display_order: count ?? 0,
  });
  revalidatePath(path(moduleId));
}

export async function deleteImage(imageId: number, moduleId: number, storagePath: string) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("module_images").delete().eq("id", imageId);
  await supabase.storage.from("module-images").remove([storagePath]);
  revalidatePath(path(moduleId));
}
