import { createClient } from "@/lib/supabase/server";
import { TextField, CheckboxField, SubmitButton } from "@/components/form-fields";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createGeometry,
  updateGeometry,
  deleteGeometry,
  createIndustryType,
  updateIndustryType,
  deleteIndustryType,
  createStandard,
  updateStandard,
  deleteStandard,
} from "./actions";

function DeleteButton() {
  return (
    <button
      type="submit"
      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
    >
      Delete
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export default async function LookupTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [
    { data: categories },
    { data: geometries },
    { data: industryTypes },
    { data: standards },
  ] = await Promise.all([
    supabase.from("module_categories").select("value, display_label").order("value"),
    supabase
      .from("module_geometries")
      .select("value, display_label, requires_degrees, requires_offset_inches")
      .order("value"),
    supabase.from("industry_types").select("value, display_label").order("value"),
    supabase.from("module_standards").select("value, display_label, record_prefix").order("value"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Lookup tables</h1>
      <p className="mt-1 text-sm text-gray-600">
        Reference data the owner portal&apos;s wizard reads from. The{" "}
        <span className="font-mono text-xs">value</span> column is the stable
        key other tables reference, so it can&apos;t be changed once created —
        only retired (deleted, if nothing uses it).
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Section title="Module categories" description="Operational classification shown on every module.">
        {(categories ?? []).map((row) => (
          <div key={row.value} className="rounded-lg border border-gray-200 bg-white p-4">
            <form action={updateCategory.bind(null, row.value)} className="flex items-end gap-3">
              <p className="mb-4 w-32 shrink-0 truncate font-mono text-xs text-gray-500">{row.value}</p>
              <div className="flex-1">
                <TextField label="Display label" name="display_label" defaultValue={row.display_label} maxLength={60} />
              </div>
              <div className="mb-4 flex gap-2">
                <SubmitButton label="Save" variant="secondary" />
              </div>
            </form>
            <form action={deleteCategory.bind(null, row.value)} className="mt-1">
              <DeleteButton />
            </form>
          </div>
        ))}

        <form action={createCategory} className="rounded-lg border border-dashed border-gray-300 p-4">
          <p className="text-sm font-medium text-gray-700">Add category</p>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-48">
              <TextField label="Value (snake_case)" name="value" placeholder="e.g. team_track" />
            </div>
            <div className="flex-1">
              <TextField label="Display label" name="display_label" maxLength={60} />
            </div>
            <div className="mb-4">
              <SubmitButton label="Add" />
            </div>
          </div>
        </form>
      </Section>

      <Section title="Module geometries" description="Shapes a module can take, with conditional fields the wizard reveals.">
        {(geometries ?? []).map((row) => (
          <div key={row.value} className="rounded-lg border border-gray-200 bg-white p-4">
            <form action={updateGeometry.bind(null, row.value)}>
              <div className="flex items-end gap-3">
                <p className="mb-4 w-32 shrink-0 truncate font-mono text-xs text-gray-500">{row.value}</p>
                <div className="flex-1">
                  <TextField label="Display label" name="display_label" defaultValue={row.display_label} maxLength={40} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <CheckboxField label="Requires degrees" name="requires_degrees" defaultChecked={row.requires_degrees} />
                <CheckboxField label="Requires offset (inches)" name="requires_offset_inches" defaultChecked={row.requires_offset_inches} />
                <SubmitButton label="Save" variant="secondary" />
              </div>
            </form>
            <form action={deleteGeometry.bind(null, row.value)} className="mt-1">
              <DeleteButton />
            </form>
          </div>
        ))}

        <form action={createGeometry} className="rounded-lg border border-dashed border-gray-300 p-4">
          <p className="text-sm font-medium text-gray-700">Add geometry</p>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-48">
              <TextField label="Value (snake_case)" name="value" placeholder="e.g. corner_30" />
            </div>
            <div className="flex-1">
              <TextField label="Display label" name="display_label" maxLength={40} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <CheckboxField label="Requires degrees" name="requires_degrees" />
            <CheckboxField label="Requires offset (inches)" name="requires_offset_inches" />
            <SubmitButton label="Add" />
          </div>
        </form>
      </Section>

      <Section title="Industry types" description="Admin-managed controlled list of industries owners can attach to a module.">
        {(industryTypes ?? []).map((row) => (
          <div key={row.value} className="rounded-lg border border-gray-200 bg-white p-4">
            <form action={updateIndustryType.bind(null, row.value)} className="flex items-end gap-3">
              <p className="mb-4 w-32 shrink-0 truncate font-mono text-xs text-gray-500">{row.value}</p>
              <div className="flex-1">
                <TextField label="Display label" name="display_label" defaultValue={row.display_label} maxLength={60} />
              </div>
              <div className="mb-4 flex gap-2">
                <SubmitButton label="Save" variant="secondary" />
              </div>
            </form>
            <form action={deleteIndustryType.bind(null, row.value)} className="mt-1">
              <DeleteButton />
            </form>
          </div>
        ))}

        <form action={createIndustryType} className="rounded-lg border border-dashed border-gray-300 p-4">
          <p className="text-sm font-medium text-gray-700">Add industry type</p>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-48">
              <TextField label="Value (snake_case)" name="value" placeholder="e.g. cold_storage" />
            </div>
            <div className="flex-1">
              <TextField label="Display label" name="display_label" maxLength={60} />
            </div>
            <div className="mb-4">
              <SubmitButton label="Add" />
            </div>
          </div>
        </form>
      </Section>

      <Section title="Module standards" description="Naming standards a module can follow (controls the record-number prefix).">
        {(standards ?? []).map((row) => (
          <div key={row.value} className="rounded-lg border border-gray-200 bg-white p-4">
            <form action={updateStandard.bind(null, row.value)} className="flex items-end gap-3">
              <p className="mb-4 w-32 shrink-0 truncate font-mono text-xs text-gray-500">{row.value}</p>
              <div className="flex-1">
                <TextField label="Display label" name="display_label" defaultValue={row.display_label} maxLength={60} />
              </div>
              <div className="w-32">
                <TextField label="Record prefix" name="record_prefix" defaultValue={row.record_prefix} maxLength={10} />
              </div>
              <div className="mb-4 flex gap-2">
                <SubmitButton label="Save" variant="secondary" />
              </div>
            </form>
            <form action={deleteStandard.bind(null, row.value)} className="mt-1">
              <DeleteButton />
            </form>
          </div>
        ))}

        <form action={createStandard} className="rounded-lg border border-dashed border-gray-300 p-4">
          <p className="text-sm font-medium text-gray-700">Add standard</p>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-48">
              <TextField label="Value (snake_case)" name="value" placeholder="e.g. nmra_s" />
            </div>
            <div className="flex-1">
              <TextField label="Display label" name="display_label" maxLength={60} />
            </div>
            <div className="w-32">
              <TextField label="Record prefix" name="record_prefix" placeholder="e.g. NMS" maxLength={10} />
            </div>
            <div className="mb-4">
              <SubmitButton label="Add" />
            </div>
          </div>
        </form>
      </Section>
    </div>
  );
}
