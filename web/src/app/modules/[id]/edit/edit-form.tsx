"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateModuleBasics, type BasicsUpdate } from "./actions";

type Category = { value: string; display_label: string };
const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

export function EditModuleForm({
  moduleId,
  initial,
  categories,
}: {
  moduleId: number;
  initial: BasicsUpdate;
  categories: Category[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<BasicsUpdate>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

      <label className={`${labelClass} mb-4 block`}>
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

      {/* ⛔ GEOMETRY, DEGREES, OFFSET AND FOOTPRINT LENGTH ARE GONE (#120).
          They are edited in the schematic builder's Module panel, which is the
          better copy of the same four fields: it knows about SECTIONS, so it
          hides the module-level shape once the boards carry their own and
          disables a length derived from them. This page had the `hasSections`
          guard on the geometry and NONE on the length — the trap spotted and
          half-fixed. Its own comment said so: *"Same trap as the endplate
          config on the detail page."* */}
      {/* ⭐ MSS BELONGS HERE, NOT ON THE BOARD (#247) — and the reason is worth
          keeping, because the opposite looks obvious. MSS describes how a
          module is WIRED into the signal system; the schematic draws TRACK, and
          no amount of looking at track can tell you what a module's electrics
          do. So it can be neither derived from the board nor checked against it.

          ⛔⛔ AND CHECKING IT WOULD HAVE BEEN WORSE THAN USELESS. "Declares MSS
          but draws no signals" reads like a contradiction and is not one: of
          the 22 modules declaring MSS, 13 are CROSSOVER — the role that carries
          the bus across rather than signalling — and ALL 13 correctly have no
          signals. Every module that does carry signals is a cascade. Such a
          warning would have fired 13 times on modules that are exactly right,
          which is the same inverted-signal failure as the crossover rings.

          What was actually wrong was that neither word explained itself, so an
          empty board next to "MSS: Yes" read as a fault. That is fixed below. */}
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
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
      <p className="mb-4 text-xs text-gray-500">
        How this module is wired into the signal system. It&rsquo;s a fact about
        the electrics, so it lives here rather than on the board — nothing in
        the track plan can confirm or contradict it.
      </p>

      {values.has_mss && (
        <>
        <label className={`${labelClass} mb-1 block`}>
          MSS module type
          <select
            className={inputClass}
            value={values.mss_type}
            onChange={(e) => set("mss_type", e.target.value)}
          >
            <option value="">Select a type… (optional)</option>
            <option value="crossover">Crossover — carries the bus across</option>
            <option value="cascade">Cascade — this module signals</option>
          </select>
        </label>
        <p className="mb-4 text-xs text-gray-500">
          A <span className="font-medium">crossover</span> module passes the
          signal bus through without signalling itself, so having no signals on
          its board is normal and expected. A{" "}
          <span className="font-medium">cascade</span> module is a signal
          location.
        </p>
        </>
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
