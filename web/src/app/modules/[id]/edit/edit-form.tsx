"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateModuleBasics, type BasicsUpdate } from "./actions";

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

export function EditModuleForm({
  moduleId,
  initial,
  categories,
  geometries,
}: {
  moduleId: number;
  initial: BasicsUpdate;
  categories: Category[];
  geometries: Geometry[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<BasicsUpdate>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedGeometry = geometries.find((g) => g.value === values.geometry_type);

  function set<K extends keyof BasicsUpdate>(key: K, value: BasicsUpdate[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateModuleBasics(moduleId, values);
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6">
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <label className={`${labelClass} mb-4 block`}>
        Module name
        <input
          className={inputClass}
          value={values.module_name}
          onChange={(e) => set("module_name", e.target.value)}
          required
          maxLength={120}
        />
      </label>

      <label className={`${labelClass} mb-4 block`}>
        Description
        <textarea
          className={inputClass}
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className={labelClass}>
          Category
          <select
            className={inputClass}
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            required
          >
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
            value={values.geometry_type}
            onChange={(e) => {
              set("geometry_type", e.target.value);
              set("geometry_degrees", "");
              set("geometry_offset_inches", "");
            }}
            required
          >
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
            value={values.geometry_degrees}
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
            value={values.geometry_offset_inches}
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
            value={values.length_total_inches}
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
            value={values.mainline_length_inches}
            onChange={(e) => set("mainline_length_inches", e.target.value)}
          />
        </label>
        <p className="mb-4 text-xs text-gray-500">
          The length of the mainline track through this module. Leave blank if
          it matches the footprint. Enter a different value for curves or wyes.
        </p>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={values.has_mss}
          onChange={(e) => {
            set("has_mss", e.target.checked);
            if (!e.target.checked) set("mss_type", "");
          }}
        />
        Supports Modular Signal System (MSS)
      </label>

      {values.has_mss && (
        <label className={`${labelClass} mb-4 block`}>
          MSS module type
          <select
            className={inputClass}
            value={values.mss_type}
            onChange={(e) => set("mss_type", e.target.value)}
          >
            <option value="">Select a type… (optional)</option>
            <option value="crossover">Crossover</option>
            <option value="cascade">Cascade (signal)</option>
          </select>
        </label>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/modules/${moduleId}`)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
