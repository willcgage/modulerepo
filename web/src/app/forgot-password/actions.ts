"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const email = formData.get("email") as string;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Always report success — don't reveal whether an account exists for this email.
  redirect("/forgot-password?sent=1");
}
