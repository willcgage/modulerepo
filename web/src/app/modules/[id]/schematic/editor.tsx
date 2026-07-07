"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  stateToDoc,
  buildPassingSiding,
  buildTransition,
  nextId,
  inchesToScaleFeet,
  type EditorState,
  type TrackRole,
  type TurnoutKind,
  type SignalFacing,
} from "@/lib/module-schematic";
import { SchematicPreview } from "./schematic-preview";
import { saveModuleSchematic } from "./actions";

const inp =
  "block w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const addBtn =
  "rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50";
const xBtn = "text-xs font-medium text-red-600 hover:underline";

const ROLE_OPTIONS: { value: TrackRole; label: string }[] = [
  { value: "siding", label: "Passing siding" },
  { value: "spur", label: "Industry spur" },
  { value: "yard", label: "Yard track" },
];
const KIND_OPTIONS: { value: TurnoutKind; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "wye", label: "Wye" },
];

export function SchematicEditor({
  moduleId,
  recordNumber,
  moduleName,
  initial,
  hadSchematic,
  newModule = false,
}: {
  moduleId: number;
  recordNumber: string;
  moduleName: string;
  initial: EditorState;
  hadSchematic: boolean;
  newModule?: boolean;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const doc = useMemo(() => stateToDoc(state, recordNumber), [state, recordNumber]);
  const isDouble = state.configA === "double" || state.configB === "double";
  // Track dropdowns show the owner's track name, not the internal id. On a
  // double-track module, Main 2 is a real track — a turnout on it diverges
  // outward instead of drawing a crossover from Main 1 (modulerepo#14).
  const trackOptions = useMemo(
    () => [
      { value: MAIN_TRACK_ID, label: isDouble ? "Main 1" : "Main" },
      ...(isDouble ? [{ value: MAIN2_TRACK_ID, label: "Main 2" }] : []),
      ...state.extraTracks.map((t) => ({
        value: t.id,
        label: t.trackName || t.id,
      })),
    ],
    [state.extraTracks, isDouble],
  );

  const patch = (fn: (s: EditorState) => void) =>
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  function addPassingSiding() {
    patch((s) => {
      const { track, turnouts, controlPoints } = buildPassingSiding(s);
      s.extraTracks.push(track);
      s.turnouts.push(...turnouts);
      s.controlPoints.push(...controlPoints);
    });
  }
  function addSpur() {
    patch((s) => {
      // Lane 1 is Main 2 on a double module; first free lane is above it.
      const base = s.configA === "double" || s.configB === "double" ? 2 : 1;
      const lane = Math.max(base, ...s.extraTracks.map((t) => t.lane + 1));
      s.extraTracks.push({
        id: nextId("spur", s.extraTracks.map((t) => t.id)),
        role: "spur",
        lane,
        fromPos: Math.round(s.lengthInches * 0.4),
        toPos: Math.round(s.lengthInches * 0.7),
        moduleTrackId: null,
        trackName: "",
      });
    });
  }
  function addTurnout() {
    patch((s) => {
      const diverge = s.extraTracks[0]?.id ?? MAIN_TRACK_ID;
      s.turnouts.push({
        id: nextId("sw", s.turnouts.map((t) => t.id)),
        name: "",
        pos: Math.round(s.lengthInches * 0.5),
        onTrack: MAIN_TRACK_ID,
        divergeTrack: diverge,
        kind: "right",
      });
    });
  }
  function addCrossing() {
    patch((s) => {
      s.crossings.push({
        id: nextId("x", s.crossings.map((x) => x.id)),
        name: "",
        pos: Math.round(s.lengthInches * 0.5),
        trackA: MAIN_TRACK_ID,
        trackB: s.extraTracks[0]?.id ?? MAIN_TRACK_ID,
      });
    });
  }
  function addControlPoint() {
    patch((s) => {
      const id = nextId("cp", s.controlPoints.map((c) => c.id));
      s.controlPoints.push({
        id,
        name: "",
        turnouts: [],
        signals: [
          { id: `${id}-AtoB`, pos: Math.round(s.lengthInches * 0.25), track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
        ],
      });
    });
  }

  function save(clear: boolean) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveModuleSchematic(moduleId, clear ? null : doc);
      if (result && "error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-5">
      {newModule && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="font-semibold">Module created — last step.</span> Lay
          out the operations schematic below, then <span className="font-medium">Save</span>.
          You can always come back to it.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Operations schematic</h1>
          <p className="text-sm text-gray-500">
            {recordNumber} · {moduleName}
          </p>
        </div>
        <Link href={`/modules/${moduleId}`} className="text-sm text-blue-600 hover:underline">
          {newModule ? "Skip for now →" : "← Back to module"}
        </Link>
      </div>

      <p className="text-sm text-gray-600">
        Depict this module the way a dispatcher reads it: the mainline runs West →
        East, with any sidings, spurs, turnouts and signals placed by position
        along the module. Free-Dispatcher imports this directly when the module is
        added to a layout.
      </p>

      {/* Live preview */}
      <SchematicPreview doc={doc} />

      {/* Mainline */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Mainline</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Mainline length (inches)
            <input
              type="number"
              value={state.lengthInches}
              readOnly
              className={`mt-1 ${inp} bg-gray-50 text-gray-600`}
              title="The module's mainline length — change it in Edit module basics; the schematic is measured against it."
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {state.loop ? "Entry (A) main track" : "West end (A) main track"}
            <select
              value={state.configA}
              onChange={(e) => patch((s) => (s.configA = e.target.value as "single" | "double"))}
              className={`mt-1 ${inp}`}
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {state.loop ? "Interchange (B) endplate on the balloon" : "East end (B) main track"}
            <select
              value={state.configB}
              onChange={(e) =>
                patch((s) => (s.configB = e.target.value as "single" | "double" | "none"))
              }
              className={`mt-1 ${inp}`}
            >
              {state.loop && <option value="none">None — pure turnback</option>}
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={state.loop}
            onChange={(e) =>
              patch((s) => {
                s.loop = e.target.checked;
                // Toggling loop shouldn't silently create an interchange —
                // default to a pure turnback; a standard endplate B on the
                // balloon (pick Single/Double) makes it an interchange.
                if (s.loop) s.configB = "none";
                else {
                  if (s.configB === "none") s.configB = "single";
                  s.loopReturn = "same";
                }
              })
            }
          />
          Loop module — the main runs the lead and turns back at the balloon
          (positions past the throat are inside the loop). A standard endplate
          B on the balloon makes it an interchange.
        </label>
        {/* Transition module (FMN-0038): one end single, the other double —
            the main line needs a turnout where Main 2 begins. */}
        {!state.loop &&
          (state.configA === "double") !== (state.configB === "double") &&
          !state.turnouts.some((t) => t.divergeTrack === MAIN2_TRACK_ID) && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
              <span>
                One end is single track and the other double — the main line
                needs a transition turnout where Main 2{" "}
                {state.configA === "double" ? "ends" : "begins"}. This adds the
                switch and an <em>End of Double Track</em> control point with
                signals; adjust its position afterwards.
              </span>
              <button
                type="button"
                onClick={() =>
                  patch((s) => {
                    const built = buildTransition(s);
                    if (built) {
                      s.turnouts.push(built.turnout);
                      s.controlPoints.push(built.controlPoint);
                    }
                  })
                }
                className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500"
              >
                + Add transition
              </button>
            </div>
          )}
        {state.loop && state.configA === "double" && (
          <label className="mt-2 block text-sm font-medium text-gray-700 sm:max-w-xs">
            Loop returns onto
            <select
              value={state.loopReturn}
              onChange={(e) =>
                patch((s) => (s.loopReturn = e.target.value as "same" | "main2"))
              }
              className={`mt-1 ${inp}`}
              title="On a double-track main, the balloon can be a directional return: out on Main 1, back on Main 2 — drawn as a U joining the two mains."
            >
              <option value="same">Same main (turnback)</option>
              <option value="main2">Main 2 (directional return)</option>
            </select>
          </label>
        )}
      </section>

      {/* Tracks */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sidings &amp; spurs</h2>
          <div className="flex gap-2">
            <button type="button" onClick={addPassingSiding} className={addBtn}>
              + Passing siding
            </button>
            <button type="button" onClick={addSpur} className={addBtn}>
              + Spur
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A passing siding adds a switch at each end and control-point signals for
          both directions automatically.
        </p>
        {state.extraTracks.length === 0 ? (
          <p className="text-sm text-gray-500">
            None yet. Add a passing siding or an industry spur.
          </p>
        ) : (
          <div className="space-y-2">
            {state.extraTracks.map((t, i) => (
              <div key={t.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-7">
                <Field label="Track name">
                  <input
                    value={t.trackName}
                    onChange={(e) => patch((s) => (s.extraTracks[i].trackName = e.target.value))}
                    className={inp}
                    placeholder="e.g. Siding 1"
                  />
                </Field>
                <Field label="Kind">
                  <select
                    value={t.role}
                    onChange={(e) => patch((s) => (s.extraTracks[i].role = e.target.value as TrackRole))}
                    className={inp}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lane (−1 = below Main 1)">
                  <input
                    type="number"
                    min={-2}
                    value={t.lane}
                    title="Stacking row: 1+ above the main(s), −1 below Main 1 (the outside on a double-track module)"
                    onChange={(e) =>
                      patch((s) => {
                        const n = Number(e.target.value);
                        s.extraTracks[i].lane = Number.isFinite(n) && n !== 0 ? n : 1;
                      })
                    }
                    className={inp}
                  />
                </Field>
                <Field label="From (in)">
                  <input
                    type="number"
                    min={0}
                    value={t.fromPos}
                    onChange={(e) => patch((s) => (s.extraTracks[i].fromPos = Number(e.target.value) || 0))}
                    className={inp}
                  />
                </Field>
                <Field label="To (in)">
                  <input
                    type="number"
                    min={0}
                    value={t.toPos}
                    onChange={(e) => patch((s) => (s.extraTracks[i].toPos = Number(e.target.value) || 0))}
                    className={inp}
                  />
                </Field>
                <Field label="Capacity (N)">
                  <div className={`${inp} bg-gray-50 text-gray-600`}>
                    {Math.round(inchesToScaleFeet(Math.abs(t.toPos - t.fromPos)))} ft
                  </div>
                </Field>
                {state.loop && (
                  <Field label="In loop">
                    <label
                      className="flex h-9 items-center justify-center"
                      title="This track sits inside the balloon (past the throat) — it renders in the loop's ladder and, later, its geometric view."
                    >
                      <input
                        type="checkbox"
                        checked={t.inLoop ?? false}
                        onChange={(e) =>
                          patch((s) => (s.extraTracks[i].inLoop = e.target.checked))
                        }
                      />
                    </label>
                  </Field>
                )}
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => patch((s) => s.extraTracks.splice(i, 1))}
                    className={xBtn}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Turnouts */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Turnouts</h2>
          <button type="button" onClick={addTurnout} className={addBtn}>
            + Turnout
          </button>
        </div>
        {state.turnouts.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <div className="space-y-2">
            {state.turnouts.map((t, i) => (
              <div key={t.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
                <Field label="Name">
                  <input
                    value={t.name}
                    onChange={(e) => patch((s) => (s.turnouts[i].name = e.target.value))}
                    className={inp}
                    placeholder="West Siding"
                  />
                </Field>
                <Field label="Position (in)">
                  <input
                    type="number"
                    min={0}
                    value={t.pos}
                    onChange={(e) => patch((s) => (s.turnouts[i].pos = Number(e.target.value) || 0))}
                    className={inp}
                  />
                </Field>
                <Field label="On track">
                  <select
                    value={t.onTrack}
                    onChange={(e) => patch((s) => (s.turnouts[i].onTrack = e.target.value))}
                    className={inp}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Diverges to">
                  <select
                    value={t.divergeTrack}
                    onChange={(e) => patch((s) => (s.turnouts[i].divergeTrack = e.target.value))}
                    className={inp}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Hand">
                  <select
                    value={t.kind}
                    onChange={(e) => patch((s) => (s.turnouts[i].kind = e.target.value as TurnoutKind))}
                    className={inp}
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => patch((s) => s.turnouts.splice(i, 1))}
                    className={xBtn}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Crossings (diamonds) + branch endplate — junction features (#170) */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Crossings &amp; branch</h2>
          <button type="button" onClick={addCrossing} className={addBtn}>
            + Crossing
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A crossing (diamond) is where two tracks cross at grade with no route
          choice. A branch endplate is a third connection off the module — a
          junction to another line, drawn as a named arrow on the schematic.
        </p>
        {state.crossings.length > 0 && (
          <div className="mb-3 space-y-2">
            {state.crossings.map((x, i) => (
              <div key={x.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                <Field label="Name">
                  <input
                    value={x.name}
                    onChange={(e) => patch((s) => (s.crossings[i].name = e.target.value))}
                    className={inp}
                    placeholder="Diamond"
                  />
                </Field>
                <Field label="Position (in)">
                  <input
                    type="number"
                    min={0}
                    value={x.pos}
                    onChange={(e) => patch((s) => (s.crossings[i].pos = Number(e.target.value) || 0))}
                    className={inp}
                  />
                </Field>
                <Field label="Track A">
                  <select
                    value={x.trackA}
                    onChange={(e) => patch((s) => (s.crossings[i].trackA = e.target.value))}
                    className={inp}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Track B">
                  <select
                    value={x.trackB}
                    onChange={(e) => patch((s) => (s.crossings[i].trackB = e.target.value))}
                    className={inp}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => patch((s) => s.crossings.splice(i, 1))}
                    className={xBtn}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={state.branch != null}
            onChange={(e) =>
              patch((s) => {
                s.branch = e.target.checked
                  ? { label: "", pos: Math.round(s.lengthInches / 2), side: "down", config: "single" }
                  : null;
              })
            }
          />
          Branch endplate — a third connection (junction) off the module
        </label>
        {state.branch && (
          <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
            <Field label="Branch name / destination">
              <input
                value={state.branch.label}
                onChange={(e) => patch((s) => (s.branch!.label = e.target.value))}
                className={inp}
                placeholder="Bowl Idaho"
              />
            </Field>
            <Field label="Position (in from A)">
              <input
                type="number"
                min={0}
                value={state.branch.pos}
                onChange={(e) => patch((s) => (s.branch!.pos = Number(e.target.value) || 0))}
                className={inp}
              />
            </Field>
            <Field label="Side">
              <select
                value={state.branch.side}
                onChange={(e) => patch((s) => (s.branch!.side = e.target.value as "up" | "down"))}
                className={inp}
              >
                <option value="up">Up (north)</option>
                <option value="down">Down (south)</option>
              </select>
            </Field>
            <Field label="Endplate track">
              <select
                value={state.branch.config}
                onChange={(e) => patch((s) => (s.branch!.config = e.target.value as "single" | "double"))}
                className={inp}
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </Field>
          </div>
        )}
      </section>

      {/* Control Points (signals — at a turnout, or a standalone block signal) */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Control Points</h2>
          <button type="button" onClick={addControlPoint} className={addBtn}>
            + Control Point
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A control point is an interlocking — a named group of signals and the
          turnout(s) it governs (a standalone block signal is a control point with
          no turnout). These become the Section &amp; District boundaries the layout
          builder works from.
        </p>
        {state.controlPoints.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <div className="space-y-3">
            {state.controlPoints.map((c, ci) => (
              <div key={c.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={c.name}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].name = e.target.value))}
                    className={`${inp} max-w-xs font-medium`}
                    placeholder="Control point name (e.g. West Siding)"
                  />
                  <button
                    type="button"
                    onClick={() => patch((st) => st.controlPoints.splice(ci, 1))}
                    className={`${xBtn} ml-auto`}
                  >
                    Remove CP
                  </button>
                </div>

                {/* Turnouts governed by this control point */}
                <div className="mt-2">
                  <span className="text-xs font-medium text-gray-600">Turnouts</span>
                  {state.turnouts.length === 0 ? (
                    <p className="text-xs text-gray-400">Add turnouts above (or a passing siding).</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {state.turnouts.map((t) => (
                        <label key={t.id} className="flex items-center gap-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={c.turnouts.includes(t.id)}
                            onChange={(e) =>
                              patch((st) => {
                                const cp = st.controlPoints[ci];
                                cp.turnouts = e.target.checked
                                  ? [...cp.turnouts, t.id]
                                  : cp.turnouts.filter((x) => x !== t.id);
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                          />
                          {t.name || t.id}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Crossings protected by this control point (#170) */}
                {state.crossings.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-600">Crossings</span>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {state.crossings.map((x) => (
                        <label key={x.id} className="flex items-center gap-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={(c.crossings ?? []).includes(x.id)}
                            onChange={(e) =>
                              patch((st) => {
                                const cp = st.controlPoints[ci];
                                const cur = cp.crossings ?? [];
                                cp.crossings = e.target.checked
                                  ? [...cur, x.id]
                                  : cur.filter((v) => v !== x.id);
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                          />
                          {x.name || x.id}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signals in this control point */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Signals</span>
                    <button
                      type="button"
                      onClick={() =>
                        patch((st) => {
                          const cp = st.controlPoints[ci];
                          cp.signals.push({
                            id: `${cp.id}-${nextId("s", cp.signals.map((x) => x.id))}`,
                            pos: cp.signals[0]?.pos ?? Math.round(st.lengthInches * 0.25),
                            track: MAIN_TRACK_ID,
                            facing: "AtoB",
                            side: cp.signals.length % 2 === 0 ? "above" : "below",
                          });
                        })
                      }
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      + Signal
                    </button>
                  </div>
                  {c.signals.map((s, si) => (
                    <div key={s.id} className="mt-1 grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                      <Field label="Position (in)">
                        <input
                          type="number"
                          min={0}
                          value={s.pos}
                          onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].pos = Number(e.target.value) || 0))}
                          className={inp}
                        />
                      </Field>
                      <Field label="Track">
                        <select
                          value={s.track}
                          onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].track = e.target.value))}
                          className={inp}
                        >
                          {trackOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Facing">
                        <select
                          value={s.facing}
                          onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].facing = e.target.value as SignalFacing))}
                          className={inp}
                        >
                          <option value="AtoB">West → East</option>
                          <option value="BtoA">East → West</option>
                        </select>
                      </Field>
                      <Field label="Side">
                        <select
                          value={s.side}
                          onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].side = e.target.value as "above" | "below"))}
                          className={inp}
                        >
                          <option value="above">Above track</option>
                          <option value="below">Below track</option>
                        </select>
                      </Field>
                      <div className="pb-1">
                        <button
                          type="button"
                          onClick={() => patch((st) => st.controlPoints[ci].signals.splice(si, 1))}
                          className={xBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && !error && (
        <p className="flex items-center justify-between gap-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          <span>Schematic saved.</span>
          {newModule && (
            <Link
              href={`/modules/${moduleId}`}
              className="shrink-0 font-medium text-green-800 hover:underline"
            >
              Done — go to module →
            </Link>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save schematic"}
        </button>
        {hadSchematic && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Clear schematic
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
