"use client";

import { useState, useTransition } from "react";
import { checkModuleName, createModule, type BasicsInput } from "./actions";

type Option = { value: string; display_label: string };

const inp =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/**
 * The fast path to a new module: just what's needed to start drawing — name,
 * category and footprint length — then straight to the canvas with a blank
 * board. The mainline, track and industries are drawn there, layer by layer,
 * not up front — which as of #120 is the ONLY way to author them, so this is
 * now the single path to a new module rather than the fast one of two.
 */
export function QuickCreate({
  categories,
}: {
  categories: Option[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [length, setLength] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    name.trim() && category && Number(length) > 0 && nameStatus !== "taken";

  function submit() {
    setError(null);
    const basics: BasicsInput = {
      module_name: name,
      description: "",
      category,
      // ⭐⭐ BLANK, because a new module is GRAPH-BUILT and has no main until
      // one is laid (#255, ADR 0001). This used to write "straight" literally
      // (#103) so that the derived centre-line had something to work with —
      // but that recorded a geometry the owner never chose, and it recorded it
      // as though they had. The document said "straight" about a board with no
      // track on it at all.
      //
      // ⚠️ #103's fear is still real for 1-D modules, and still handled: the
      // editor keeps coercing a null geometry to "straight" FOR DERIVATION
      // (`editor.tsx`, `geometry` memo), so an older module with the field
      // unset draws exactly as it did. What changes is only that a new module
      // stops claiming a shape it hasn't got — and a graph module derives no
      // centre-line anyway, so it has nothing to lose.
      geometry_type: "",
      geometry_degrees: "",
      geometry_offset_inches: "",
      length_total_inches: length,
      mainline_length_inches: "",
      has_mss: false,
      mss_type: "",
    };
    startTransition(async () => {
      const result = await createModule(basics);
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

        {/* ⚠️ This is the FIRST BOARD's length, not a module total. A module's
            length is the sum of the boards it's built from (#108), so asking for
            a total up front is the thing that made a multi-board module fight
            you: every section then had to divide INTO a fixed number. */}
        <label className="block text-sm font-medium text-gray-700">
          First board&rsquo;s length (in)
          <input
            type="number"
            min={1}
            step={0.5}
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className={inp}
            placeholder="48"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            How long this board runs. A module built from several boards gets the
            rest added on the canvas, and its length is the sum of them — you
            don&rsquo;t have to know the total now.
          </span>
        </label>

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

      {/* ⛔ THE LINK TO THE DETAILED WIZARD IS GONE (#120), and so is the
          wizard. Its whole offer was *"enter endplates, tracks and industries
          up front"* — the three things that moved onto the board, because none
          of them can be PLACED in a form. What it produced was a module born
          with rows the schematic did not know about. Everything else it asked
          for is still editable: name, description, category and MSS on the
          module's Edit page, geometry and lengths in the builder's first
          stage. */}
    </div>
  );
}
