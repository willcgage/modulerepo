import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import {
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  SubmitButton,
} from "@/components/form-fields";
import {
  addEndplate,
  addIndustry,
  deleteEndplate,
  deleteImage,
  deleteIndustry,
  deleteModule,
  setIndustryCarTypes,
  updateEndplate,
  updateIndustry,
  updateModuleStatus,
  uploadImage,
} from "./actions";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const TRACK_CONFIG_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
];

// PostgREST returns a single embedded row for a many-to-one join, but without
// generated DB types supabase-js can't infer the cardinality and types it as
// an array — normalize both shapes here.
function embeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const moduleId = Number(id);
  if (!Number.isInteger(moduleId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("freemon_modules")
    .select(
      "id, record_number, module_name, description, category, geometry_type, geometry_degrees, geometry_offset_inches, length_feet, length_inches, endplate_count, has_mss, mss_block_count, status, owner_id, updated_at",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (!module) notFound();
  const isOwner = module.owner_id === user.id;

  const [
    { data: endplates },
    { data: industries },
    { data: images },
    { data: industryTypes },
    { data: carTypeOptions },
  ] = await Promise.all([
    supabase
      .from("freemon_endplates")
      .select("id, endplate_number, label, track_config, width_inches, height_inches, notes")
      .eq("module_id", moduleId)
      .order("endplate_number"),
    supabase
      .from("freemon_industries")
      .select(
        "id, industry_number, label, industry_name, industry_type, spur_capacity_scale_feet, notes, freemon_industry_car_types(id, car_type_id, rail_car_types(value, display_label))",
      )
      .eq("module_id", moduleId)
      .order("industry_number"),
    supabase
      .from("module_images")
      .select("id, storage_path, caption, display_order")
      .eq("module_id", moduleId)
      .order("display_order"),
    supabase.from("industry_types").select("value, display_label").order("display_label"),
    supabase
      .from("rail_car_types")
      .select("id, value, display_label")
      .eq("status", "active")
      .order("display_label"),
  ]);

  const carTypeFieldOptions = (carTypeOptions ?? []).map((ct) => ({
    value: String(ct.id),
    label: ct.display_label,
  }));

  const imagesWithUrls = await Promise.all(
    (images ?? []).map(async (image) => {
      const { data: signed } = await supabase.storage
        .from("module-images")
        .createSignedUrl(image.storage_path, 3600);
      return { ...image, url: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{module.record_number}</p>
          <h1 className="text-2xl font-semibold text-gray-900">{module.module_name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={module.status} />
            <span className="text-sm text-gray-500">
              {module.category} · {module.geometry_type}
            </span>
          </div>
        </div>
        {isOwner && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              href={`/modules/${module.id}/edit`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </Link>
            <form action={updateModuleStatus.bind(null, module.id)} className="flex items-center gap-2">
              <select
                name="status"
                defaultValue={module.status}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Update status
              </button>
            </form>
            <form action={deleteModule.bind(null, module.id)}>
              <button
                type="submit"
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Delete module
              </button>
            </form>
          </div>
        )}
      </div>

      {module.description && (
        <p className="mt-4 text-sm text-gray-700">{module.description}</p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-3">
        <Fact label="Length" value={`${module.length_feet}' ${module.length_inches}"`} />
        <Fact label="Endplates" value={String(module.endplate_count)} />
        {module.geometry_degrees != null && (
          <Fact label="Curve degrees" value={String(module.geometry_degrees)} />
        )}
        {module.geometry_offset_inches != null && (
          <Fact label="Offset (in)" value={String(module.geometry_offset_inches)} />
        )}
        <Fact label="MSS" value={module.has_mss ? `Yes (${module.mss_block_count} blocks)` : "No"} />
      </dl>

      {/* ---- Endplates ------------------------------------------------- */}
      <Section title="Endplates">
        <ul className="space-y-3">
          {(endplates ?? []).map((ep) => (
            <li key={ep.id} className="rounded-lg border border-gray-200 bg-white p-4">
              {isOwner ? (
                <form action={updateEndplate.bind(null, ep.id, module.id)} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{ep.label}</span>
                    <button
                      formAction={deleteEndplate.bind(null, ep.id, module.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <SelectField
                      label="Track"
                      name="track_config"
                      defaultValue={ep.track_config}
                      options={TRACK_CONFIG_OPTIONS}
                    />
                    <NumberField label="Width (in)" name="width_inches" defaultValue={ep.width_inches ?? undefined} step="0.01" />
                    <NumberField label="Height (in)" name="height_inches" defaultValue={ep.height_inches ?? undefined} step="0.01" required={false} />
                    <TextField label="Notes" name="notes" defaultValue={ep.notes ?? ""} required={false} />
                  </div>
                  <SubmitButton label="Save" variant="secondary" />
                </form>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{ep.label}</span>
                  <span className="text-gray-600">
                    {ep.track_config} · {ep.width_inches}&quot; wide
                    {ep.height_inches != null ? ` · ${ep.height_inches}" tall` : ""}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form action={addEndplate.bind(null, module.id)} className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Add endplate</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SelectField label="Track" name="track_config" defaultValue="single" options={TRACK_CONFIG_OPTIONS} />
              <NumberField label="Width (in)" name="width_inches" step="0.01" />
              <NumberField label="Height (in)" name="height_inches" step="0.01" required={false} />
              <TextField label="Notes" name="notes" required={false} />
            </div>
            <SubmitButton label="Add endplate" />
          </form>
        )}
      </Section>

      {/* ---- Industries ------------------------------------------------ */}
      <Section title="Industries">
        <ul className="space-y-4">
          {(industries ?? []).map((industry) => {
            const linkedIds = new Set(
              industry.freemon_industry_car_types?.map((j) => j.car_type_id) ?? [],
            );
            return (
              <li key={industry.id} className="rounded-lg border border-gray-200 bg-white p-4">
                {isOwner ? (
                  <>
                    <form action={updateIndustry.bind(null, industry.id, module.id)} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{industry.label}</span>
                        <button
                          formAction={deleteIndustry.bind(null, industry.id, module.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <TextField label="Name" name="industry_name" defaultValue={industry.industry_name} maxLength={120} />
                        <SelectField
                          label="Type"
                          name="industry_type"
                          defaultValue={industry.industry_type}
                          options={(industryTypes ?? []).map((t) => ({ value: t.value, label: t.display_label }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <NumberField label="Spur capacity (scale ft)" name="spur_capacity_scale_feet" defaultValue={industry.spur_capacity_scale_feet} />
                        <TextField label="Notes" name="notes" defaultValue={industry.notes ?? ""} required={false} />
                      </div>
                      <SubmitButton label="Save" variant="secondary" />
                    </form>

                    <form action={setIndustryCarTypes.bind(null, industry.id, module.id)} className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-2 text-xs font-medium text-gray-500">Rail car types served</p>
                      <div className="flex flex-wrap gap-3">
                        {carTypeFieldOptions.map((ct) => (
                          <label key={ct.value} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              name="car_type_ids"
                              value={ct.value}
                              defaultChecked={linkedIds.has(Number(ct.value))}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {ct.label}
                          </label>
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="mt-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Save car types
                      </button>
                    </form>
                  </>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {industry.label} — {industry.industry_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {industry.industry_type} · spur capacity {industry.spur_capacity_scale_feet} scale ft
                    </p>
                    {(industry.freemon_industry_car_types?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-gray-600">
                        Car types:{" "}
                        {industry.freemon_industry_car_types
                          ?.map((j) => embeddedOne(j.rail_car_types)?.display_label)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {isOwner && (
          <form action={addIndustry.bind(null, module.id)} className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Add industry</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Name" name="industry_name" maxLength={120} />
              <SelectField
                label="Type"
                name="industry_type"
                placeholder="Select a type…"
                options={(industryTypes ?? []).map((t) => ({ value: t.value, label: t.display_label }))}
              />
            </div>
            <NumberField label="Spur capacity (scale ft)" name="spur_capacity_scale_feet" />
            <TextField label="Notes" name="notes" required={false} />
            <SubmitButton label="Add industry" />
          </form>
        )}
      </Section>

      {/* ---- Images ----------------------------------------------------- */}
      <Section title="Images">
        {imagesWithUrls.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {imagesWithUrls.map((image) => (
              <figure key={image.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={image.caption ?? ""} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                    Unavailable
                  </div>
                )}
                <figcaption className="flex items-center justify-between gap-2 p-2 text-xs text-gray-600">
                  <span className="truncate">{image.caption || "—"}</span>
                  {isOwner && (
                    <form action={deleteImage.bind(null, image.id, module.id, image.storage_path)}>
                      <button type="submit" className="font-medium text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {isOwner && (
          <form
            action={uploadImage.bind(null, module.id)}
            encType="multipart/form-data"
            className="rounded-lg border border-dashed border-gray-300 p-4"
          >
            <p className="mb-3 text-sm font-medium text-gray-700">Upload image</p>
            <input
              type="file"
              name="file"
              accept="image/*"
              required
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <div className="mt-3">
              <TextField label="Caption" name="caption" required={false} />
            </div>
            <SubmitButton label="Upload" />
          </form>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
