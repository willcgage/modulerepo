"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const PATH = "/admin/grants";

function fail(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

export async function createGrant(formData: FormData) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const eventName = (formData.get("event_name") ?? "").toString().trim();
  const expiresAt = (formData.get("expires_at") ?? "").toString().trim();

  if (!userId) fail("Choose an owner to grant access to.");
  if (!eventName) fail("Event name is required.");

  const { error } = await supabase.from("show_master_grants").insert({
    user_id: userId,
    event_name: eventName,
    granted_by: admin.id,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  });

  if (error) fail(error.message);

  revalidatePath(PATH);
  revalidatePath("/admin");
}

export async function revokeGrant(grantId: number) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("show_master_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .is("revoked_at", null);

  if (error) fail(error.message);

  revalidatePath(PATH);
  revalidatePath("/admin");
}
