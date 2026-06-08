"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const PATH = "/admin/users";

function fail(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

export async function updateUserRole(targetUserId: string, formData: FormData) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  if (targetUserId === admin.id) {
    fail("You can't change your own role — ask another admin to do it.");
  }

  const role = (formData.get("role") ?? "").toString();
  if (role !== "owner" && role !== "admin") {
    fail("Invalid role.");
  }

  const { error } = await supabase.from("owner_profiles").update({ role }).eq("id", targetUserId);
  if (error) fail(error.message);

  revalidatePath(PATH);
  revalidatePath("/admin");
}
