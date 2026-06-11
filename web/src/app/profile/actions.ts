"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = (formData.get("display_name") ?? "").toString().trim();
  const firstName = (formData.get("first_name") ?? "").toString().trim();
  const lastName = (formData.get("last_name") ?? "").toString().trim();
  const contactEmail = (formData.get("contact_email") ?? "").toString().trim();
  const phone = (formData.get("phone") ?? "").toString().trim();
  const location = (formData.get("location") ?? "").toString().trim();

  if (!displayName) {
    redirect(`/profile?error=${encodeURIComponent("Display name is required.")}`);
  }

  const { error } = await supabase
    .from("owner_profiles")
    .update({
      display_name: displayName,
      first_name: firstName || null,
      last_name: lastName || null,
      contact_email: contactEmail || null,
      phone: phone || null,
      location: location || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/dashboard?updated=profile");
}
