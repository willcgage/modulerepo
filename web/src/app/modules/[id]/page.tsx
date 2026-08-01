import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { asModuleSchematic, endplateCountOf } from "@/lib/module-schematic";
import { SchematicPreview } from "./schematic/schematic-preview";
import { DeleteModuleButton } from "./delete-module-button";
import { ModuleFootprintView, footprintInput } from "@/components/module-footprint-view";
import { StatusBadge } from "@/components/status-badge";
import { TextField, SubmitButton } from "@/components/form-fields";
import {
  deleteImage,
  deleteSchematic,
  updateModuleStatus,
  uploadImage,
  uploadSchematic,
} from "./actions";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const SCHEMATIC_FORMAT_LABELS: Record<string, string> = {
  dwg: "AutoCAD (DWG)",
  dxf: "DXF",
  anyrail: "AnyRail",
  scarm: "SCARM",
  xtrackcad: "XTrackCAD",
  templot: "Templot",
  railmodeller: "RailModeller",
  thirdplanit: "3rd PlanIt",
  pdf: "PDF",
  other: "Other",
};

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
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
      "id, record_number, module_name, description, category, geometry_type, geometry_degrees, geometry_offset_inches, length_total_inches, mainline_length_inches, endplate_count, has_mss, mss_type, status, owner_id, updated_at, schematic",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (!module) notFound();
  const isOwner = module.owner_id === user.id;

  const [{ data: images }, { data: schematics }] = await Promise.all([
    supabase
      .from("module_images")
      .select("id, storage_path, caption, display_order")
      .eq("module_id", moduleId)
      .order("display_order"),
    supabase
      .from("module_schematics")
      .select("id, storage_path, file_name, file_format, caption, display_order")
      .eq("module_id", moduleId)
      .order("display_order"),
  ]);

  const doc = asModuleSchematic(module.schematic);

  const endplateCount = endplateCountOf(module);

  const imagesWithUrls = await Promise.all(
    (images ?? []).map(async (image) => {
      const { data: signed } = await supabase.storage
        .from("module-images")
        .createSignedUrl(image.storage_path, 3600);
      return { ...image, url: signed?.signedUrl ?? null };
    }),
  );

  const schematicsWithUrls = await Promise.all(
    (schematics ?? []).map(async (schematic) => {
      const { data: signed } = await supabase.storage
        .from("module-schematics")
        .createSignedUrl(schematic.storage_path, 3600);
      return { ...schematic, url: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/modules" className="text-sm text-blue-600 hover:underline">
        ← Back to my modules
      </Link>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="mt-2 flex items-start justify-between gap-4">
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
            <Link
              href={`/modules/${module.id}/schematic`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit schematic
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
            <DeleteModuleButton moduleId={module.id} moduleName={module.module_name} />
          </div>
        )}
      </div>

      {module.description && (
        <p className="mt-4 text-sm text-gray-700">{module.description}</p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-3">
        <Fact label="Module length" value={`${module.length_total_inches}"`} />
        {module.mainline_length_inches != null && module.mainline_length_inches !== module.length_total_inches && (
          <Fact label="Mainline length" value={`${module.mainline_length_inches}"`} />
        )}
        <Fact label="Endplates" value={String(endplateCount)} />
        {module.geometry_degrees != null && (
          <Fact label="Curve degrees" value={String(module.geometry_degrees)} />
        )}
        {module.geometry_offset_inches != null && (
          <Fact label="Offset (in)" value={String(module.geometry_offset_inches)} />
        )}
        <Fact
          label="MSS"
          value={
            module.has_mss
              ? module.mss_type === "crossover"
                ? "Yes (Crossover)"
                : module.mss_type === "cascade"
                  ? "Yes (Cascade — signal)"
                  : "Yes"
              : "No"
          }
        />
      </dl>

      {/* ---- The module, two ways: physical board + dispatcher schematic --- */}
      <Section title="Module">
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                What it looks like
              </h3>
              <ModuleFootprintView
                input={footprintInput(module, doc)}
                doc={doc}
                height={200}
              />
              <p className="mt-1 text-xs text-gray-400">
                Physical benchwork + mainline, to scale.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                How it operates
              </h3>
              {doc ? (
                <SchematicPreview doc={doc} />
              ) : isOwner ? (
                <Link
                  href={`/modules/${module.id}/schematic`}
                  className="inline-block rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-blue-600 hover:bg-gray-50"
                >
                  Build the operations schematic — sidings, turnouts and signals →
                </Link>
              ) : (
                <p className="text-sm text-gray-500">No operations schematic yet.</p>
              )}
            </div>
          </div>
          {isOwner && doc && (
            <Link
              href={`/modules/${module.id}/schematic`}
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Edit schematic →
            </Link>
          )}
        </div>
      </Section>

      {/* ⛔ THE ENDPLATES, TRACKS AND INDUSTRIES SECTIONS ARE GONE (#120).
          Will, 2026-07-31: *"we should move the endplate creation to the
          schematic builder instead of on this page. The track section is
          already a part of the schematic builder, so it can be removed along
          with Industries."*

          The rule they broke — and it is the rule, not a preference: IF THE
          SCHEMATIC DOC OWNS A VALUE, THIS PAGE MUST NOT OFFER TO EDIT IT.
          Every field that did was a silent-revert bug waiting to be reported,
          and two of them were reported:

          · Endplate Track (single/double) — `saveModuleSchematic` rewrites
            `freemon_endplates` from the doc, so an owner set both ends single,
            saw it change, and watched it come back. The stopgap was a disabled
            select pointing at the builder; this is the fix.
          · An industry added here — the same save DELETES any
            `freemon_industries` row the doc does not carry, so this form's
            output was destroyed by the next schematic save.

          Creation moves too, not just configuration. A 3rd+ endplate is PLACED
          on the board (`at.pos` / `at.side` / a pose), and this page could not
          place one — so anything it created was half an endplate: a row with no
          position. That is not untidy, it is a hole in live geometry, because
          as of module-schematic 0.120.0 THE ENDPLATE DECIDES WHICH SIDE A ROUTE
          LEAVES ON.

          Naming an end moved to the builder's endplate inspector, which needed
          module-schematic 0.123.0 — until then `stateToDoc` wrote a constant
          "West"/"East" over any name that got into the doc. */}

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

      {/* ---- Schematics (CAD drawings) ---------------------------------- */}
      <Section title="Schematics & CAD drawings">
        {schematicsWithUrls.length > 0 && (
          <ul className="mb-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {schematicsWithUrls.map((schematic) => (
              <li key={schematic.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  {schematic.url ? (
                    <a
                      href={schematic.url}
                      download={schematic.file_name}
                      className="truncate font-medium text-blue-600 hover:underline"
                    >
                      {schematic.file_name}
                    </a>
                  ) : (
                    <span className="truncate text-gray-400">{schematic.file_name} (unavailable)</span>
                  )}
                  <p className="text-xs text-gray-500">
                    {SCHEMATIC_FORMAT_LABELS[schematic.file_format] ?? schematic.file_format}
                    {schematic.caption ? ` · ${schematic.caption}` : ""}
                  </p>
                </div>
                {isOwner && (
                  <form action={deleteSchematic.bind(null, schematic.id, module.id, schematic.storage_path)}>
                    <button type="submit" className="shrink-0 text-xs font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <form
            action={uploadSchematic.bind(null, module.id)}
            encType="multipart/form-data"
            className="rounded-lg border border-dashed border-gray-300 p-4"
          >
            <p className="mb-3 text-sm font-medium text-gray-700">Upload schematic</p>
            <input
              type="file"
              name="file"
              accept=".dwg,.dxf,.any,.scarm,.xtc,.trk,.box,.rmz,.3pi,.pdf"
              required
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-2 text-xs text-gray-500">
              DWG, DXF, AnyRail, SCARM, XTrackCAD, Templot, RailModeller, 3rd PlanIt, or PDF.
            </p>
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
