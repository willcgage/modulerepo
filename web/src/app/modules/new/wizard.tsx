"use client";

import { useState, useTransition } from "react";
import { WizardSteps } from "@/components/wizard-steps";
import type { ReferenceOption } from "@/lib/edge";
import {
  checkModuleName,
  createModule,
  submitCarTypeSuggestion,
  type BasicsInput,
  type EndplateInput,
  type IndustryInput,
  type TrackInput,
} from "./actions";

type Category = { value: string; display_label: string };
type Geometry = {
  value: string;
  display_label: string;
  requires_degrees: boolean;
  requires_offset_inches: boolean;
};

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

const EMPTY_BASICS: BasicsInput = {
  module_name: "",
  description: "",
  category: "",
  geometry_type: "",
  geometry_degrees: "",
  geometry_offset_inches: "",
  length_total_inches: "",
  mainline_length_inches: "",
  has_mss: false,
  mss_type: "",
};

export function ModuleWizard({
  categories,
  geometries,
  industryTypes,
  initialCarTypes,
}: {
  categories: Category[];
  geometries: Geometry[];
  industryTypes: ReferenceOption[];
  initialCarTypes: ReferenceOption[];
}) {
  const [step, setStep] = useState(1);
  const [basics, setBasics] = useState<BasicsInput>(EMPTY_BASICS);
  const [endplates, setEndplates] = useState<EndplateInput[]>([]);
  const [tracks, setTracks] = useState<TrackInput[]>([]);
  const [industries, setIndustries] = useState<IndustryInput[]>([]);
  const [carTypes, setCarTypes] = useState<ReferenceOption[]>(initialCarTypes);
  const [nameStatus, setNameStatus] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedGeometry = geometries.find((g) => g.value === basics.geometry_type);

  async function handleNameBlur() {
    const name = basics.module_name.trim();
    if (!name) {
      setNameStatus("idle");
      return;
    }
    setNameStatus("checking");
    const result = await checkModuleName(name);
    if (result.valid) {
      setNameStatus("ok");
    } else {
      setNameStatus("taken");
      setError(result.message);
    }
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      if (
        !basics.module_name.trim() ||
        !basics.category ||
        !basics.geometry_type ||
        !basics.length_total_inches
      ) {
        setError("Please fill in the required fields before continuing.");
        return;
      }
      if (nameStatus === "taken") {
        setError("Choose a different module name before continuing.");
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createModule(basics, endplates, tracks, industries);
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  function addEndplate() {
    setEndplates((rows) => [
      ...rows,
      {
        endplate_number: rows.length + 1,
        label: "",
        track_config: "single",
        width_inches: "",
        height_inches: "",
        notes: "",
      },
    ]);
  }
  function updateEndplate(index: number, patch: Partial<EndplateInput>) {
    setEndplates((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeEndplate(index: number) {
    setEndplates((rows) =>
      rows
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, endplate_number: i + 1 })),
    );
  }

  function addTrack() {
    setTracks((rows) => [
      ...rows,
      {
        track_name: "",
        capacity_scale_feet: "",
        notes: "",
      },
    ]);
  }
  function updateTrack(index: number, patch: Partial<TrackInput>) {
    setTracks((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeTrack(index: number) {
    setTracks((rows) => rows.filter((_, i) => i !== index));
    setIndustries((rows) =>
      rows.map((row) => {
        if (row.track_index === "") return row;
        const trackIndex = Number(row.track_index);
        if (trackIndex === index) return { ...row, track_index: "" };
        if (trackIndex > index) return { ...row, track_index: String(trackIndex - 1) };
        return row;
      }),
    );
  }

  function addIndustry() {
    setIndustries((rows) => [
      ...rows,
      {
        industry_name: "",
        industry_type: "",
        track_index: "",
        notes: "",
        car_type_values: [],
      },
    ]);
  }
  function updateIndustry(index: number, patch: Partial<IndustryInput>) {
    setIndustries((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeIndustry(index: number) {
    setIndustries((rows) => rows.filter((_, i) => i !== index));
  }
  function toggleCarType(industryIndex: number, value: string) {
    setIndustries((rows) =>
      rows.map((row, i) => {
        if (i !== industryIndex) return row;
        const has = row.car_type_values.includes(value);
        return {
          ...row,
          car_type_values: has
            ? row.car_type_values.filter((v) => v !== value)
            : [...row.car_type_values, value],
        };
      }),
    );
  }

  return (
    <div className="mt-8">
      <WizardSteps current={step} />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === 1 && (
        <BasicsStep
          basics={basics}
          setBasics={setBasics}
          categories={categories}
          geometries={geometries}
          selectedGeometry={selectedGeometry}
          nameStatus={nameStatus}
          onNameChange={() => setNameStatus("idle")}
          onNameBlur={handleNameBlur}
        />
      )}
      {step === 2 && (
        <EndplatesStep
          endplates={endplates}
          onAdd={addEndplate}
          onUpdate={updateEndplate}
          onRemove={removeEndplate}
        />
      )}
      {step === 3 && (
        <TracksStep
          tracks={tracks}
          onAdd={addTrack}
          onUpdate={updateTrack}
          onRemove={removeTrack}
        />
      )}
      {step === 4 && (
        <IndustriesStep
          industries={industries}
          industryTypes={industryTypes}
          tracks={tracks}
          carTypes={carTypes}
          setCarTypes={setCarTypes}
          onAdd={addIndustry}
          onUpdate={updateIndustry}
          onRemove={removeIndustry}
          onToggleCarType={toggleCarType}
        />
      )}
      {step === 5 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
          You can add photos once the module is created — finish here and
          you&apos;ll land on the module page, where you can upload images.
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Back
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create module"}
          </button>
        )}
      </div>
    </div>
  );
}

function BasicsStep({
  basics,
  setBasics,
  categories,
  geometries,
  selectedGeometry,
  nameStatus,
  onNameChange,
  onNameBlur,
}: {
  basics: BasicsInput;
  setBasics: React.Dispatch<React.SetStateAction<BasicsInput>>;
  categories: Category[];
  geometries: Geometry[];
  selectedGeometry?: Geometry;
  nameStatus: "idle" | "checking" | "ok" | "taken";
  onNameChange: () => void;
  onNameBlur: () => void;
}) {
  function set<K extends keyof BasicsInput>(key: K, value: BasicsInput[K]) {
    setBasics((b) => ({ ...b, [key]: value }));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <label className={`${labelClass} mb-1`}>
        Module name
        <input
          className={inputClass}
          value={basics.module_name}
          onChange={(e) => {
            set("module_name", e.target.value);
            onNameChange();
          }}
          onBlur={onNameBlur}
          required
          maxLength={120}
        />
      </label>
      <p className="mb-4 mt-1 text-xs">
        {nameStatus === "checking" && (
          <span className="text-gray-500">Checking availability…</span>
        )}
        {nameStatus === "ok" && (
          <span className="text-green-700">Name is available.</span>
        )}
        {nameStatus === "taken" && (
          <span className="text-red-700">That name is already in use.</span>
        )}
      </p>

      <label className={`${labelClass} mb-4 block`}>
        Description
        <textarea
          className={inputClass}
          rows={3}
          value={basics.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className={labelClass}>
          Category
          <select
            className={inputClass}
            value={basics.category}
            onChange={(e) => set("category", e.target.value)}
            required
          >
            <option value="" disabled>
              Select a category…
            </option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.display_label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Geometry
          <select
            className={inputClass}
            value={basics.geometry_type}
            onChange={(e) => {
              set("geometry_type", e.target.value);
              set("geometry_degrees", "");
              set("geometry_offset_inches", "");
            }}
            required
          >
            <option value="" disabled>
              Select a geometry…
            </option>
            {geometries.map((g) => (
              <option key={g.value} value={g.value}>
                {g.display_label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedGeometry?.requires_degrees && (
        <label className={`${labelClass} mb-4 block`}>
          Curve degrees
          <input
            className={inputClass}
            type="number"
            min="1"
            max="359"
            step="0.001"
            value={basics.geometry_degrees}
            onChange={(e) => set("geometry_degrees", e.target.value)}
            required
          />
        </label>
      )}
      {selectedGeometry?.requires_offset_inches && (
        <label className={`${labelClass} mb-4 block`}>
          Offset (inches)
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={basics.geometry_offset_inches}
            onChange={(e) => set("geometry_offset_inches", e.target.value)}
            required
          />
        </label>
      )}

      <div className="mb-1">
        <label className={`${labelClass} mb-1 block`}>
          Module footprint length (inches)
          <input
            className={inputClass}
            type="number"
            min="0.001"
            step="0.001"
            value={basics.length_total_inches}
            onChange={(e) => set("length_total_inches", e.target.value)}
            required
          />
        </label>
        <p className="mb-4 text-xs text-gray-500">
          The physical end-to-end length of the module itself.
        </p>
      </div>

      <div className="mb-1">
        <label className={`${labelClass} mb-1 block`}>
          Mainline track length (inches) — optional
          <input
            className={inputClass}
            type="number"
            min="0.001"
            step="0.001"
            value={basics.mainline_length_inches}
            onChange={(e) => set("mainline_length_inches", e.target.value)}
          />
        </label>
        <p className="mb-4 text-xs text-gray-500">
          The length of the mainline track running through this module. Leave blank if
          it equals the module footprint (common for straight modules). Enter a
          different value for curves or wyes where the rail distance differs from the
          straight-line footprint.
        </p>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={basics.has_mss}
          onChange={(e) => {
            set("has_mss", e.target.checked);
            if (!e.target.checked) set("mss_type", "");
          }}
        />
        Supports Modular Signal System (MSS)
      </label>

      {basics.has_mss && (
        <label className={`${labelClass} mb-4 block`}>
          MSS module type
          <select
            className={inputClass}
            value={basics.mss_type}
            onChange={(e) => set("mss_type", e.target.value)}
          >
            <option value="">Select a type… (optional)</option>
            <option value="crossover">Crossover</option>
            <option value="cascade">Cascade (signal)</option>
          </select>
        </label>
      )}
    </div>
  );
}

function EndplatesStep({
  endplates,
  onAdd,
  onUpdate,
  onRemove,
}: {
  endplates: EndplateInput[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<EndplateInput>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Add a row for each endplate on this module. Give each one a meaningful
        label such as "West" or "East" — if you leave the label blank it
        defaults to EP-1, EP-2, etc.
      </p>
      {endplates.map((ep, index) => (
        <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Endplate {ep.endplate_number} (EP-{ep.endplate_number})
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Label (e.g. West)
              <input
                className={inputClass}
                value={ep.label}
                onChange={(e) => onUpdate(index, { label: e.target.value })}
                maxLength={30}
                placeholder="EP-1 (auto)"
              />
            </label>
            <label className={labelClass}>
              Track configuration
              <select
                className={inputClass}
                value={ep.track_config}
                onChange={(e) => onUpdate(index, { track_config: e.target.value })}
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </label>
            <label className={labelClass}>
              Width (inches)
              <input
                className={inputClass}
                type="number"
                step="0.01"
                min="0.01"
                value={ep.width_inches}
                onChange={(e) => onUpdate(index, { width_inches: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Height (inches) — leave blank for standard grade
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={ep.height_inches}
                onChange={(e) => onUpdate(index, { height_inches: e.target.value })}
              />
            </label>
            <label className={labelClass}>
              Notes
              <input
                className={inputClass}
                value={ep.notes}
                onChange={(e) => onUpdate(index, { notes: e.target.value })}
                maxLength={255}
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        + Add endplate
      </button>
    </div>
  );
}

function TracksStep({
  tracks,
  onAdd,
  onUpdate,
  onRemove,
}: {
  tracks: TrackInput[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<TrackInput>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Add a row for each spur or siding on this module. The label (TRK-1,
        TRK-2, …) is assigned automatically. Industries served directly off
        the mainline don&apos;t need a track here.
      </p>
      {tracks.map((track, index) => (
        <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Track {index + 1} (TRK-{index + 1})
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Track name (optional)
              <input
                className={inputClass}
                value={track.track_name}
                onChange={(e) => onUpdate(index, { track_name: e.target.value })}
                maxLength={120}
                placeholder="e.g. House Track"
              />
            </label>
            <label className={labelClass}>
              Capacity (scale feet)
              <input
                className={inputClass}
                type="number"
                min="1"
                value={track.capacity_scale_feet}
                onChange={(e) => onUpdate(index, { capacity_scale_feet: e.target.value })}
                required
              />
            </label>
          </div>
          <label className={`${labelClass} mt-4 block`}>
            Notes
            <input
              className={inputClass}
              value={track.notes}
              onChange={(e) => onUpdate(index, { notes: e.target.value })}
              maxLength={500}
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        + Add track
      </button>
    </div>
  );
}

function IndustriesStep({
  industries,
  industryTypes,
  tracks,
  carTypes,
  setCarTypes,
  onAdd,
  onUpdate,
  onRemove,
  onToggleCarType,
}: {
  industries: IndustryInput[];
  industryTypes: ReferenceOption[];
  tracks: TrackInput[];
  carTypes: ReferenceOption[];
  setCarTypes: React.Dispatch<React.SetStateAction<ReferenceOption[]>>;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<IndustryInput>) => void;
  onRemove: (index: number) => void;
  onToggleCarType: (industryIndex: number, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Add a row for each industry served by this module, and pick the rail
        car types it handles.
      </p>
      {industries.map((industry, index) => (
        <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Industry {index + 1} (IND-{index + 1})
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Industry name
              <input
                className={inputClass}
                value={industry.industry_name}
                onChange={(e) => onUpdate(index, { industry_name: e.target.value })}
                maxLength={120}
                required
              />
            </label>
            <label className={labelClass}>
              Industry type
              <select
                className={inputClass}
                value={industry.industry_type}
                onChange={(e) => onUpdate(index, { industry_type: e.target.value })}
                required
              >
                <option value="" disabled>
                  Select a type…
                </option>
                {industryTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.display_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Track
              <select
                className={inputClass}
                value={industry.track_index}
                onChange={(e) => onUpdate(index, { track_index: e.target.value })}
              >
                <option value="">Mainline (no spur)</option>
                {tracks.map((track, trackIndex) => (
                  <option key={trackIndex} value={String(trackIndex)}>
                    TRK-{trackIndex + 1}
                    {track.track_name ? ` — ${track.track_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Notes
              <input
                className={inputClass}
                value={industry.notes}
                onChange={(e) => onUpdate(index, { notes: e.target.value })}
                maxLength={500}
              />
            </label>
          </div>

          <div className="mt-4">
            <span className={labelClass}>Rail car types served</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {carTypes.map((ct) => {
                const selected = industry.car_type_values.includes(ct.value);
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => onToggleCarType(index, ct.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {ct.display_label}
                  </button>
                );
              })}
            </div>
            <CarTypeSuggestForm
              onSuggested={(option) => {
                setCarTypes((options) =>
                  options.some((o) => o.value === option.value)
                    ? options
                    : [...options, option].sort((a, b) =>
                        a.display_label.localeCompare(b.display_label),
                      ),
                );
                onToggleCarType(index, option.value);
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        + Add industry
      </button>
    </div>
  );
}

function CarTypeSuggestForm({
  onSuggested,
}: {
  onSuggested: (option: ReferenceOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-blue-600 hover:underline"
      >
        Don&apos;t see it? Suggest a new car type…
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCarTypeSuggestion(value, displayLabel, notes);
      if (result.ok) {
        onSuggested(result.option);
        setOpen(false);
        setValue("");
        setDisplayLabel("");
        setNotes("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs text-gray-600">
        Suggest a new car type (reviewed by an admin, but usable by you right
        away).
      </p>
      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          className={`${inputClass} mt-0`}
          placeholder="value (snake_case, e.g. wood_chip_car)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <input
          className={`${inputClass} mt-0`}
          placeholder="Display label (e.g. Wood Chip Car)"
          value={displayLabel}
          onChange={(e) => setDisplayLabel(e.target.value)}
        />
      </div>
      <input
        className={`${inputClass} mt-2`}
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !value.trim() || !displayLabel.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit suggestion"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
