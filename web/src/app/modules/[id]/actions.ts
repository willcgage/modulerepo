"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function path(moduleId: number) {
  return `/modules/${moduleId}`;
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

// ⛔ addEndplate / updateEndplate / deleteEndplate are GONE (#120). The
// schematic builder authors endplates now — it is the only place that can
// PLACE one, and `saveModuleSchematic` syncs the `freemon_endplates` rows from
// the document on every save, so anything written here was overwritten or
// orphaned. See the note on the module detail page for the whole rule.

// ⛔ addTrack / updateTrack / deleteTrack are GONE (#120) — already unreachable
// before this change: the Tracks section had been read-only for some time, so
// nothing called them. `saveModuleSchematic` owns `module_tracks`, deriving
// each track's capacity from its span between the governing clearance points.

// ⛔ addIndustry / updateIndustry / deleteIndustry / setIndustryCarTypes are
// GONE (#120). An industry is a car-spot SPAN on a track — the builder places
// it, sizes it and reads its capacity off the rail, none of which this page
// could do. And `saveModuleSchematic` DELETES any `freemon_industries` row the
// document does not carry, so an industry added here survived only until the
// next schematic save.

// ---- Images ---------------------------------------------------------------

export async function uploadImage(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const caption = (formData.get("caption") ?? "").toString().trim() || null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${moduleId}/${randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("module-images")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    redirect(`${path(moduleId)}?error=${encodeURIComponent(`Image upload failed: ${uploadError.message}`)}`);
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

// ---- Schematics (CAD drawings) --------------------------------------------

// Maps a filename extension to the file_format values allowed by the
// module_schematics CHECK constraint. Unknown extensions fall back to "other".
function schematicFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "dwg":
      return "dwg";
    case "dxf":
      return "dxf";
    case "any":
      return "anyrail";
    case "scarm":
      return "scarm";
    case "xtc":
    case "trk":
      return "xtrackcad";
    case "box":
      return "templot";
    case "rmz":
      return "railmodeller";
    case "3pi":
      return "thirdplanit";
    case "pdf":
      return "pdf";
    default:
      return "other";
  }
}

export async function uploadSchematic(moduleId: number, formData: FormData) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const caption = (formData.get("caption") ?? "").toString().trim() || null;
  const storagePath = `${moduleId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("module-schematics")
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    return;
  }

  const { count } = await supabase
    .from("module_schematics")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  await supabase.from("module_schematics").insert({
    module_id: moduleId,
    storage_path: storagePath,
    file_name: file.name,
    file_format: schematicFormat(file.name),
    caption,
    display_order: count ?? 0,
  });
  revalidatePath(path(moduleId));
}

export async function deleteSchematic(schematicId: number, moduleId: number, storagePath: string) {
  const supabase = await createClient();
  await requireOwnedModule(supabase, moduleId);

  await supabase.from("module_schematics").delete().eq("id", schematicId);
  await supabase.storage.from("module-schematics").remove([storagePath]);
  revalidatePath(path(moduleId));
}
