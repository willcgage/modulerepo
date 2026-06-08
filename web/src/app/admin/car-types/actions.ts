"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const PATH = "/admin/car-types";

export async function approveCarType(carTypeId: number, formData: FormData) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const displayLabel = (formData.get("display_label") ?? "").toString().trim();
  if (!displayLabel) {
    redirect(`${PATH}?error=${encodeURIComponent("Display label is required.")}`);
  }

  const { error } = await supabase
    .from("rail_car_types")
    .update({
      status: "active",
      display_label: displayLabel,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", carTypeId)
    .eq("status", "pending_review");

  if (error) {
    redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(PATH);
  revalidatePath("/admin");
}

export async function rejectCarType(carTypeId: number) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const { error } = await supabase
    .from("rail_car_types")
    .update({
      status: "inactive",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", carTypeId)
    .eq("status", "pending_review");

  if (error) {
    redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(PATH);
  revalidatePath("/admin");
}
