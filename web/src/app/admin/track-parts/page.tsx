import { createClient } from "@/lib/supabase/server";
import { partExtent, storedPartToTrackPart } from "@willcgage/module-schematic";
import { TRACK_PART_COLUMNS, rowToStoredPart, type TrackPartRow } from "@/lib/track-parts";
import {
  TextField,
  NumberField,
  TextAreaField,
  SelectField,
  CheckboxField,
  SubmitButton,
} from "@/components/form-fields";
import {
  createTrackPart,
  updateTrackPart,
  retireTrackPart,
  restoreTrackPart,
} from "./actions";

const SOURCE_OPTIONS = [
  { value: "", label: "—" },
  { value: "measured", label: "measured (someone put a rule on the part)" },
  { value: "manufacturer", label: "manufacturer (published spec)" },
  { value: "derived", label: "derived (computed from something else)" },
  { value: "unverified", label: "unverified (plausible, unconfirmed)" },
];

const KIND_OPTIONS = [
  { value: "turnout", label: "Turnout" },
  { value: "wye", label: "Wye" },
  { value: "curved-turnout", label: "Curved turnout" },
  { value: "crossover", label: "Crossover — two turnouts and the diagonal" },
  { value: "crossing", label: "Crossing" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active — drawn by the app" },
  { value: "pending_review", label: "Pending review — not drawn" },
  { value: "inactive", label: "Retired — not drawn" },
];

const n = (v: number | string | null | undefined) =>
  v == null || v === "" ? "" : String(v);

/**
 * The landmarks, drawn. Half the bad readings this library has taken were
 * landmark ambiguity rather than sloppy measuring — a frog read at the end of
 * the casting instead of the apex of the V put a wrong lead into two published
 * releases. A picture of what to put the rule against is the point.
 */
function LandmarkDiagram() {
  return (
    <svg viewBox="0 0 420 96" className="w-full max-w-lg" role="img" aria-label="Where to measure a turnout from">
      {/* tie strip */}
      <rect x="20" y="36" width="330" height="26" fill="#e7e2d6" stroke="#a89e88" />
      {/* through route */}
      <line x1="20" y1="49" x2="350" y2="49" stroke="#1e293b" strokeWidth="2" />
      {/* diverging route, peeling away from the points and crossing at the frog */}
      <path d="M 96 49 Q 150 49 220 40 L 350 24" fill="none" stroke="#1e293b" strokeWidth="2" />
      {/* the datum: ONE end of the tie strip, everything measured from here */}
      <line x1="20" y1="28" x2="20" y2="72" stroke="#dc2626" strokeWidth="2" />
      <text x="16" y="86" fontSize="10" fill="#dc2626">measure everything from THIS end</text>
      {/* points */}
      <line x1="96" y1="30" x2="96" y2="68" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="80" y="24" fontSize="10" fill="#2563eb">point tips</text>
      {/* frog apex */}
      <line x1="220" y1="26" x2="220" y2="68" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="196" y="18" fontSize="10" fill="#0f766e">frog — APEX of the V</text>
      <circle cx="220" cy="40" r="3" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      {/* NOT here */}
      <text x="256" y="86" fontSize="10" fill="#92400e">not the end of the casting →</text>
      <line x1="350" y1="30" x2="350" y2="68" stroke="#111827" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="330" y="24" fontSize="10" fill="#111827">end tie</text>
    </svg>
  );
}

/** The fields for one part, shared by the add and edit forms. */
function PartFields({ row }: { row?: TrackPartRow }) {
  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <TextField label="Slug" name="slug" defaultValue={row?.slug} placeholder="peco-c55-n-6" />
        <TextField label="Manufacturer" name="manufacturer" defaultValue={row?.manufacturer} placeholder="Peco" />
        <TextField label="Line" name="line" defaultValue={row?.line} placeholder="Code 55" />
        <TextField label="Name" name="name" defaultValue={row?.name} placeholder="#6 Turnout" />
        <SelectField label="Kind" name="kind" defaultValue={row?.kind ?? "turnout"} options={KIND_OPTIONS} />
        <NumberField label="Frog number" name="frog_number" defaultValue={n(row?.frog_number)} required={false} step="any" />
      </div>

      <p className="mb-2 text-xs font-medium text-gray-700">
        Part numbers — the number MOULDED INTO the part
      </p>
      <p className="mb-2 text-xs text-gray-500">
        The only reliable identifier. A frog number can&apos;t be inferred from a
        part&apos;s length: the Atlas #5 and #7 are both 6.00″ end to end.
      </p>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <TextField label="Left-hand" name="part_number_left" defaultValue={row?.part_number_left ?? ""} required={false} />
        <TextField label="Right-hand" name="part_number_right" defaultValue={row?.part_number_right ?? ""} required={false} />
        <TextField label="Single / no hand" name="part_number_single" defaultValue={row?.part_number_single ?? ""} required={false} />
      </div>

      <div className="mb-3 mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-700">
          Positions along the part, in inches — all from the SAME tie end
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Enter positions, not spans. The lead (points → frog) is their
          difference, so two positions check each other; a lead typed on its own
          can&apos;t be checked against anything.
        </p>
        <div className="mt-3">
          <LandmarkDiagram />
        </div>
        <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
          <NumberField label="Tie end → point tips" name="points_offset_inches" defaultValue={n(row?.points_offset_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="points_offset_source" defaultValue={row?.points_offset_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Tie end → frog (apex of the V)" name="frog_offset_inches" defaultValue={n(row?.frog_offset_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="frog_offset_source" defaultValue={row?.frog_offset_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Overall length (end tie to end tie)" name="overall_length_inches" defaultValue={n(row?.overall_length_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="overall_length_source" defaultValue={row?.overall_length_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Frog → end of the diverging rail (along the rail)" name="diverging_length_inches" defaultValue={n(row?.diverging_length_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="diverging_length_source" defaultValue={row?.diverging_length_source ?? ""} options={SOURCE_OPTIONS} required={false} />
        </div>
        <div className="mt-3">
          <CheckboxField
            label="Built from a fixture or template (Fast Tracks and the like)"
            name="buildable"
            defaultChecked={row?.buildable ?? false}
          />
          <p className="-mt-3 mb-4 text-xs text-gray-500">
            Tick this and the overall length above stops being a property of the
            part and becomes the maker&apos;s{" "}
            <span className="font-medium">default</span> — the modeller cuts the
            rail, so their turnout is whatever they built. Nothing infers where
            such a turnout stops from these numbers.
          </p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <NumberField label="Minimum built length" name="minimum_length_inches" defaultValue={n(row?.minimum_length_inches)} required={false} step="any" min={0} />
            <SelectField label="…source" name="minimum_length_source" defaultValue={row?.minimum_length_source ?? ""} options={SOURCE_OPTIONS} required={false} />
            <NumberField label="Substitution radius (curve it can stand in for)" name="substitution_radius_inches" defaultValue={n(row?.substitution_radius_inches)} required={false} step="any" min={0} />
            <SelectField label="…source" name="substitution_radius_source" defaultValue={row?.substitution_radius_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          </div>
        </div>
        <p className="mt-3 mb-2 text-xs font-medium text-gray-700">
          Crossovers only — an assembly, not a single turnout
        </p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <NumberField label="Track spacing (centre to centre)" name="track_spacing_inches" defaultValue={n(row?.track_spacing_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="track_spacing_source" defaultValue={row?.track_spacing_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Second frog angle (degrees)" name="secondary_frog_angle_deg" defaultValue={n(row?.secondary_frog_angle_deg)} required={false} step="any" min={0} />
          <SelectField label="…source" name="secondary_frog_angle_source" defaultValue={row?.secondary_frog_angle_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Built in how many identical pieces?" name="pieces_per_assembly" defaultValue={n(row?.pieces_per_assembly)} required={false} step={1} min={2} />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          ⚠️ If a part is built in pieces,{" "}
          <span className="font-medium">
            the lengths above describe ONE PIECE
          </span>
          , not the finished item. A Fast Tracks crossover fixture builds one
          symmetrical half: you build it twice, turn the second 180° and butt
          them together at the through routes and the X. Its 10.07″ is the half.
          Leave blank for anything built in one go.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          A crossover fixture is machined for{" "}
          <span className="font-medium">one</span> track spacing and can&apos;t be
          built to another, so this decides whether the part suits a standard at
          all. <span className="font-medium">Free-moN §2.0 requires 1.125″</span>
          {" "}— the Fast Tracks N crossovers build to 1.09″, which is 0.035″
          tighter. Record what the maker states; don&apos;t round it toward the
          standard.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Not every manufacturer publishes the same numbers — Fast Tracks give an
          angle, two radii and two lengths and no landmarks at all, where Atlas
          give three landmarks and one length. Leave blank whatever this maker
          doesn&apos;t state; a blank is honest, a guess is not.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          The diverging rail is a <span className="font-medium">cross-check</span>,
          not a drawing input. Measure it along the angled rail and the form will
          tell you if it disagrees with the frog: it has to be a little longer
          than the straight-line distance it covers, because it runs at an angle.
          This is what caught the Atlas 2057, whose frog was first read past the
          end of the part.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Only a <span className="font-medium">measured</span> points offset and
          overall length let the app draw where the part physically stops — the
          rest of a diverging route is the owner&apos;s flex track.
        </p>
      </div>

      <details className="mb-3 rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-700">
          Parts with no tie dimensions (a wye&apos;s lead, a curved turnout&apos;s radii)
        </summary>
        <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
          <NumberField label="Lead (points → frog), only if the offsets aren't known" name="lead_inches" defaultValue={n(row?.lead_inches)} required={false} step="any" min={0} />
          <SelectField label="…source" name="lead_source" defaultValue={row?.lead_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Outer radius" name="outer_radius_inches" defaultValue={n(row?.outer_radius_inches)} required={false} step="any" min={0} />
          <NumberField label="Inner radius" name="inner_radius_inches" defaultValue={n(row?.inner_radius_inches)} required={false} step="any" min={0} />
          <SelectField label="Radii source" name="radius_source" defaultValue={row?.radius_source ?? ""} options={SOURCE_OPTIONS} required={false} />
          <NumberField label="Actual diverging angle (°)" name="actual_angle_deg" defaultValue={n(row?.actual_angle_deg)} required={false} step="any" />
          <SelectField label="…source" name="actual_angle_source" defaultValue={row?.actual_angle_source ?? ""} options={SOURCE_OPTIONS} required={false} />
        </div>
      </details>

      <TextAreaField
        label="How it was measured — who, which physical part, and anything odd"
        name="measurement_note"
        defaultValue={row?.measurement_note ?? ""}
        rows={3}
      />
      <SelectField label="Status" name="status" defaultValue={row?.status ?? "active"} options={STATUS_OPTIONS} />
    </>
  );
}

export default async function TrackPartsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("track_parts")
    .select(TRACK_PART_COLUMNS)
    .order("manufacturer")
    .order("frog_number", { nullsFirst: false });

  const rows = (data ?? []) as unknown as TrackPartRow[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Track &amp; turnout parts</h1>
      <p className="mt-1 text-sm text-gray-600">
        The parts a module&apos;s turnouts are drawn from. A turnout is drawn at
        its part&apos;s <span className="font-medium">measured</span> dimensions,
        so adding the switch a builder actually uses is what makes it draw
        correctly — a frog number with no measured part is drawn without a part
        boundary rather than at an invented length.
      </p>
      <p className="mt-2 text-sm text-gray-600">
        The Atlas code 55 parts below shipped with the app and were seeded here,
        so this is one library: correct one of them and the correction wins.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 space-y-4">
        {rows.map((row) => {
          const part = storedPartToTrackPart(rowToStoredPart(row));
          const ext = partExtent(part);
          return (
            <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-gray-900">
                  {row.manufacturer} {row.name}{" "}
                  <span className="font-mono text-xs text-gray-500">{row.slug}</span>
                </p>
                <p className="text-xs text-gray-600">
                  {ext ? (
                    <span className="text-green-700">
                      draws its own extent — {ext.aheadOfPoints.toFixed(3)}″ of turnout past
                      the points, {ext.pastFrog.toFixed(3)}″ past the frog
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      no measured extent — turnouts of this size draw without a part boundary
                    </span>
                  )}
                  {row.status !== "active" && (
                    <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      {row.status}
                    </span>
                  )}
                </p>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-600">Edit</summary>
                <form action={updateTrackPart.bind(null, row.id)} className="mt-4">
                  <PartFields row={row} />
                  <div className="flex gap-2">
                    <SubmitButton label="Save part" variant="secondary" />
                  </div>
                </form>
                <form
                  action={row.status === "active" ? retireTrackPart.bind(null, row.id) : restoreTrackPart.bind(null, row.id)}
                  className="mt-2"
                >
                  <button
                    type="submit"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {row.status === "active" ? "Retire (keeps the measurement)" : "Restore"}
                  </button>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      <form action={createTrackPart} className="mt-8 rounded-lg border border-dashed border-gray-300 p-4">
        <p className="text-sm font-medium text-gray-700">Add a part</p>
        <div className="mt-4">
          <PartFields />
        </div>
        <SubmitButton label="Add part" />
      </form>
    </div>
  );
}
