"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { checkModuleName, createModule, type BasicsInput } from "./actions";

type Option = { value: string; display_label: string };
type Geometry = Option & {
  requires_degrees: boolean;
  requires_offset_inches: boolean;
};

const inp =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/**
 * The fast path to a new module: just what's needed to start drawing — name,
 * category, geometry and footprint length — then straight to the canvas with a
 * board already seeded. Endplates, track and industries are authored there, not
 * up front. The detailed wizard stays one link away for anyone who wants it.
 */
export function QuickCreate({
  categories,
  geometries,
}: {
  categories: Option[];
  geometries: Geometry[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [geometryType, setGeometryType] = useState("");
  const [degrees, setDegrees] = useState("");
  const [offset, setOffset] = useState("");
  const [length, setLength] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const geo = geometries.find((g) => g.value === geometryType);

  async function onNameBlur() {
    const n = name.trim();
    if (!n) return setNameStatus("idle");
    setNameStatus("checking");
    const result = await checkModuleName(n);
    if (result.valid) setNameStatus("ok");
    else {
      setNameStatus("taken");
      setError(result.message);
    }
  }

  const ready =
    name.trim() &&
    category &&
    geometryType &&
    Number(length) > 0 &&
    nameStatus !== "taken" &&
    (!geo?.requires_degrees || degrees !== "") &&
    (!geo?.requires_offset_inches || offset !== "");

  function submit() {
    setError(null);
    const basics: BasicsInput = {
      module_name: name,
      description: "",
      category,
      geometry_type: geometryType,
      geometry_degrees: geo?.requires_degrees ? degrees : "",
      geometry_offset_inches: geo?.requires_offset_inches ? offset : "",
      length_total_inches: length,
      mainline_length_inches: "",
      has_mss: false,
      mss_type: "",
    };
    startTransition(async () => {
      // No endplates / tracks / industries — those are drawn on the canvas.
      const result = await createModule(basics, [], [], []);
      if (result && "error" in result) setError(result.error);
      // On success createModule redirects to the schematic canvas.
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Module name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameStatus("idle");
            }}
            onBlur={onNameBlur}
            className={inp}
            placeholder="e.g. Cedar Falls Yard"
            autoFocus
          />
          <span className="mt-1 block h-4 text-xs">
            {nameStatus === "checking" && <span className="text-gray-500">Checking…</span>}
            {nameStatus === "ok" && <span className="text-green-700">Name is available.</span>}
            {nameStatus === "taken" && <span className="text-red-600">That name is taken.</span>}
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.display_label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-gray-700">
            Geometry
            <select
              value={geometryType}
              onChange={(e) => {
                setGeometryType(e.target.value);
                setDegrees("");
                setOffset("");
              }}
              className={inp}
            >
              <option value="">Choose…</option>
              {geometries.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.display_label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Footprint length (in)
            <input
              type="number"
              min={1}
              step={0.5}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className={inp}
              placeholder="48"
            />
          </label>
          {geo?.requires_degrees && (
            <label className="block text-sm font-medium text-gray-700">
              Degrees
              <input
                type="number"
                step={0.5}
                value={degrees}
                onChange={(e) => setDegrees(e.target.value)}
                className={inp}
              />
            </label>
          )}
          {geo?.requires_offset_inches && (
            <label className="block text-sm font-medium text-gray-700">
              Offset (in)
              <input
                type="number"
                step={0.5}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                className={inp}
              />
            </label>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={!ready || isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create & draw →"}
        </button>
      </div>

      <p className="mt-4 border-t border-gray-100 pt-4 text-center text-xs text-gray-500">
        Prefer to enter endplates, tracks and industries up front?{" "}
        <Link href="/modules/new/wizard" className="font-medium text-blue-600 hover:underline">
          Use the detailed wizard →
        </Link>
      </p>
    </div>
  );
}
