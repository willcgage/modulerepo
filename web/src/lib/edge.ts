import { createClient } from "@/lib/supabase/server";

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

async function callEdgeFunction(path: string, init?: RequestInit) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);
  headers.set("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${FUNCTIONS_URL}/${path}`, { ...init, headers });
  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

export type ReferenceOption = { value: string; display_label: string };

export async function fetchIndustryTypes(): Promise<ReferenceOption[]> {
  const { ok, body } = await callEdgeFunction("industry-types");
  return ok ? (body as ReferenceOption[]) : [];
}

export async function fetchCarTypes(): Promise<ReferenceOption[]> {
  const { ok, body } = await callEdgeFunction("car-types");
  return ok ? (body as ReferenceOption[]) : [];
}

export type ValidateNameResult =
  | { valid: true }
  | { valid: false; message: string };

export async function validateModuleName(
  moduleName: string,
  excludeModuleId?: number,
): Promise<ValidateNameResult> {
  const { ok, body } = await callEdgeFunction("modules-validate-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_name: moduleName,
      exclude_module_id: excludeModuleId ?? null,
    }),
  });

  if (ok) return { valid: true };
  return { valid: false, message: body?.message ?? "That name isn't available." };
}

export type SuggestCarTypeResult =
  | { ok: true; option: ReferenceOption }
  | { ok: false; message: string };

export async function suggestCarType(
  value: string,
  displayLabel: string,
  suggestionNotes?: string,
): Promise<SuggestCarTypeResult> {
  const { ok, body } = await callEdgeFunction("car-types-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      value,
      display_label: displayLabel,
      suggestion_notes: suggestionNotes || null,
    }),
  });

  if (ok) {
    return { ok: true, option: { value: body.value, display_label: body.display_label } };
  }
  return { ok: false, message: body?.message ?? "Could not submit that suggestion." };
}
