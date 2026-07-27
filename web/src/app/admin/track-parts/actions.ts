"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const PATH = "/admin/track-parts";

const SOURCES = ["manufacturer", "measured", "derived", "unverified"] as const;

const fail = (message: string): never =>
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);

const text = (f: FormData, k: string): string | null => {
  const v = (f.get(k) ?? "").toString().trim();
  return v === "" ? null : v;
};

const number = (f: FormData, k: string): number | null => {
  const v = text(f, k);
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`${k.replace(/_/g, " ")} must be a number.`);
  return n;
};

const source = (f: FormData, k: string): string | null => {
  const v = text(f, k);
  if (v == null) return null;
  if (!(SOURCES as readonly string[]).includes(v)) fail(`Unknown source "${v}".`);
  return v;
};

/**
 * Build a part record from the form.
 *
 * ⚠️ Deliberately collects POSITIONS, not spans: the points and the frog are
 * both measured from the SAME end of the tie strip, and the lead is derived from
 * their difference. A lead entered directly can't be cross-checked — two
 * positions can, and that check is what caught a bad reading which had already
 * shipped in two releases.
 */
function readPart(formData: FormData) {
  const slug = text(formData, "slug");
  const manufacturer = text(formData, "manufacturer");
  const line = text(formData, "line");
  const name = text(formData, "name");
  if (!slug || !manufacturer || !line || !name)
    fail("Slug, manufacturer, line and name are all required.");

  const points = number(formData, "points_offset_inches");
  const frog = number(formData, "frog_offset_inches");
  const overall = number(formData, "overall_length_inches");
  const diverging = number(formData, "diverging_length_inches");
  const minimum = number(formData, "minimum_length_inches");
  const buildable = formData.get("buildable") != null;

  // The database enforces these too; checking here turns a constraint violation
  // into a sentence that says which landmark is wrong.
  if (points != null && frog != null && frog <= points)
    fail(
      "The frog must be further from the tie end than the points. " +
        "Both are measured from the SAME end — and the frog means the APEX of " +
        "the V, not the end of the casting.",
    );
  if (frog != null && overall != null && frog >= overall)
    fail("The frog must sit inside the part — check which end you measured from.");

  // A minimum length only means anything on a fixture, and it has to be a
  // floor: a part that can't be built shorter than its default has no range.
  if (minimum != null && !buildable)
    fail(
      "A minimum length only applies to a part you BUILD — tick “built from a " +
        "fixture” if that's what this is. A finished product has one length.",
    );
  if (minimum != null && overall != null && minimum >= overall)
    fail(
      `A minimum length of ${minimum}" is not shorter than the default ` +
        `${overall}". On a fixture the default is what the maker suggests and ` +
        "the minimum is the floor, so the minimum has to be the smaller number.",
    );

  // The diverging rail is the hypotenuse of the angle it leaves at, so it must
  // run LONGER than the straight-line distance it covers. This is the check
  // that caught the Atlas 2057 (modulerepo#180): its frog first read 5 5/32"
  // against a 5" overall length, and a 1 30/32" diverging rail made that
  // impossible. Cheap, and it fires while the part is still in your hand.
  if (diverging != null && frog != null && overall != null) {
    const axial = overall - frog;
    if (diverging <= axial)
      fail(
        `A diverging rail of ${diverging}" is too short to reach the end of the ` +
          `part: it has to cover ${axial.toFixed(4)}" along the part's length, and ` +
          "it runs at an angle, so it must be LONGER than that. One of the frog, " +
          "the overall length or this reading is wrong.",
      );
    if (diverging / axial > 1.15)
      fail(
        `A diverging rail of ${diverging}" is more than 15% longer than the ` +
          `${axial.toFixed(4)}" it has to cover. At turnout angles that is too ` +
          "steep to be the angle — check whether the frog was measured to the " +
          "APEX of the V rather than the end of the casting.",
      );
  }

  return {
    slug,
    manufacturer,
    line,
    scale: "N",
    name,
    kind: text(formData, "kind") ?? "turnout",
    part_number_left: text(formData, "part_number_left"),
    part_number_right: text(formData, "part_number_right"),
    part_number_single: text(formData, "part_number_single"),
    frog_number: number(formData, "frog_number"),
    points_offset_inches: points,
    points_offset_source: source(formData, "points_offset_source"),
    frog_offset_inches: frog,
    frog_offset_source: source(formData, "frog_offset_source"),
    overall_length_inches: overall,
    overall_length_source: source(formData, "overall_length_source"),
    diverging_length_inches: diverging,
    diverging_length_source: source(formData, "diverging_length_source"),
    minimum_length_inches: minimum,
    minimum_length_source: source(formData, "minimum_length_source"),
    substitution_radius_inches: number(formData, "substitution_radius_inches"),
    substitution_radius_source: source(formData, "substitution_radius_source"),
    buildable,
    lead_inches: number(formData, "lead_inches"),
    lead_source: source(formData, "lead_source"),
    outer_radius_inches: number(formData, "outer_radius_inches"),
    inner_radius_inches: number(formData, "inner_radius_inches"),
    radius_source: source(formData, "radius_source"),
    actual_angle_deg: number(formData, "actual_angle_deg"),
    actual_angle_source: source(formData, "actual_angle_source"),
    measurement_note: text(formData, "measurement_note"),
    status: text(formData, "status") ?? "active",
  };
}

export async function createTrackPart(formData: FormData) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const { error } = await supabase
    .from("track_parts")
    .insert({ ...readPart(formData), submitted_by: admin.id });

  if (error) fail(error.message);
  revalidatePath(PATH);
}

export async function updateTrackPart(id: number, formData: FormData) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const { error } = await supabase
    .from("track_parts")
    .update({
      ...readPart(formData),
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) fail(error.message);
  revalidatePath(PATH);
}

/**
 * Retire a part rather than deleting it: a module's turnout may name it, and its
 * dimensions are the record of a measurement someone actually took. `inactive`
 * drops it out of every renderer without losing the reading.
 */
export async function retireTrackPart(id: number) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  const { error } = await supabase
    .from("track_parts")
    .update({
      status: "inactive",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) fail(error.message);
  revalidatePath(PATH);
}

export async function restoreTrackPart(id: number) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("track_parts")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) fail(error.message);
  revalidatePath(PATH);
}
