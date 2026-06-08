import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profiles";
import { TextField, SubmitButton } from "@/components/form-fields";
import { approveCarType, rejectCarType } from "./actions";

export default async function CarTypeSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: suggestions } = await supabase
    .from("rail_car_types")
    .select("id, value, display_label, suggestion_notes, suggested_by, created_at")
    .eq("status", "pending_review")
    .order("created_at");

  const names = await fetchDisplayNames(supabase, (suggestions ?? []).map((s) => s.suggested_by));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Car type suggestions</h1>
      <p className="mt-1 text-sm text-gray-600">
        Owners suggest new car types from the module wizard&apos;s &quot;Other&quot;
        field. Approve to publish them for everyone, or reject to keep them out
        of the public picker.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!suggestions || suggestions.length === 0 ? (
        <p className="mt-8 text-sm text-gray-600">No suggestions awaiting review.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {suggestions.map((s) => {
            const suggesterName = (s.suggested_by && names.get(s.suggested_by)) ?? "an owner";
            return (
              <li key={s.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-sm text-gray-500">{s.value}</p>
                  <p className="text-xs text-gray-500">
                    Suggested by {suggesterName} on{" "}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>

                {s.suggestion_notes && (
                  <p className="mt-2 text-sm text-gray-600">&ldquo;{s.suggestion_notes}&rdquo;</p>
                )}

                <form action={approveCarType.bind(null, s.id)} className="mt-4 flex items-end gap-3">
                  <div className="flex-1">
                    <TextField
                      label="Display label"
                      name="display_label"
                      defaultValue={s.display_label}
                      maxLength={60}
                    />
                  </div>
                  <div className="mb-4 flex gap-2">
                    <SubmitButton label="Approve" />
                    <button
                      type="submit"
                      formAction={rejectCarType.bind(null, s.id)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Reject
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
