"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const PATH = "/admin/lookups";
const VALUE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

function fail(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

function readValue(formData: FormData) {
  return (formData.get("value") ?? "").toString().trim().toLowerCase();
}

function readDisplayLabel(formData: FormData) {
  return (formData.get("display_label") ?? "").toString().trim();
}

async function insertRow(table: string, row: Record<string, unknown>) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from(table).insert(row);
  if (error) fail(error.message);

  revalidatePath(PATH);
}

async function updateRow(table: string, value: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from(table).update(patch).eq("value", value);
  if (error) fail(error.message);

  revalidatePath(PATH);
}

async function deleteRow(table: string, value: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from(table).delete().eq("value", value);
  if (error) fail(error.message);

  revalidatePath(PATH);
}

// ---- module_categories ---------------------------------------------------

export async function createCategory(formData: FormData) {
  const value = readValue(formData);
  const displayLabel = readDisplayLabel(formData);
  if (!VALUE_PATTERN.test(value)) fail("Value must be lowercase snake_case, 2-40 characters.");
  if (!displayLabel) fail("Display label is required.");

  await insertRow("module_categories", { value, display_label: displayLabel });
}

export async function updateCategory(value: string, formData: FormData) {
  const displayLabel = readDisplayLabel(formData);
  if (!displayLabel) fail("Display label is required.");

  await updateRow("module_categories", value, { display_label: displayLabel });
}

export async function deleteCategory(value: string) {
  await deleteRow("module_categories", value);
}

// ---- module_geometries ----------------------------------------------------

function readGeometryFlags(formData: FormData) {
  return {
    requires_degrees: formData.get("requires_degrees") === "on",
    requires_offset_inches: formData.get("requires_offset_inches") === "on",
  };
}

export async function createGeometry(formData: FormData) {
  const value = readValue(formData);
  const displayLabel = readDisplayLabel(formData);
  if (!VALUE_PATTERN.test(value)) fail("Value must be lowercase snake_case, 2-40 characters.");
  if (!displayLabel) fail("Display label is required.");

  await insertRow("module_geometries", {
    value,
    display_label: displayLabel,
    ...readGeometryFlags(formData),
  });
}

export async function updateGeometry(value: string, formData: FormData) {
  const displayLabel = readDisplayLabel(formData);
  if (!displayLabel) fail("Display label is required.");

  await updateRow("module_geometries", value, {
    display_label: displayLabel,
    ...readGeometryFlags(formData),
  });
}

export async function deleteGeometry(value: string) {
  await deleteRow("module_geometries", value);
}

// ---- industry_types --------------------------------------------------------

export async function createIndustryType(formData: FormData) {
  const value = readValue(formData);
  const displayLabel = readDisplayLabel(formData);
  if (!VALUE_PATTERN.test(value)) fail("Value must be lowercase snake_case, 2-40 characters.");
  if (!displayLabel) fail("Display label is required.");

  await insertRow("industry_types", { value, display_label: displayLabel });
}

export async function updateIndustryType(value: string, formData: FormData) {
  const displayLabel = readDisplayLabel(formData);
  if (!displayLabel) fail("Display label is required.");

  await updateRow("industry_types", value, { display_label: displayLabel });
}

export async function deleteIndustryType(value: string) {
  await deleteRow("industry_types", value);
}

// ---- module_standards -------------------------------------------------------

function readRecordPrefix(formData: FormData) {
  return (formData.get("record_prefix") ?? "").toString().trim().toUpperCase();
}

export async function createStandard(formData: FormData) {
  const value = readValue(formData);
  const displayLabel = readDisplayLabel(formData);
  const recordPrefix = readRecordPrefix(formData);
  if (!VALUE_PATTERN.test(value)) fail("Value must be lowercase snake_case, 2-40 characters.");
  if (!displayLabel) fail("Display label is required.");
  if (!/^[A-Z]{2,10}$/.test(recordPrefix)) fail("Record prefix must be 2-10 uppercase letters.");

  await insertRow("module_standards", {
    value,
    display_label: displayLabel,
    record_prefix: recordPrefix,
  });
}

export async function updateStandard(value: string, formData: FormData) {
  const displayLabel = readDisplayLabel(formData);
  const recordPrefix = readRecordPrefix(formData);
  if (!displayLabel) fail("Display label is required.");
  if (!/^[A-Z]{2,10}$/.test(recordPrefix)) fail("Record prefix must be 2-10 uppercase letters.");

  await updateRow("module_standards", value, {
    display_label: displayLabel,
    record_prefix: recordPrefix,
  });
}

export async function deleteStandard(value: string) {
  await deleteRow("module_standards", value);
}
