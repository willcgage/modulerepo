"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  MAIN_TRACK_ID,
  stateToDoc,
  buildPassingSiding,
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
  // Track dropdowns show the owner's track name, not the internal id.
  const trackOptions = useMemo(
    () => [
      { value: MAIN_TRACK_ID, label: "Main" },
      ...state.extraTracks.map((t) => ({
        value: t.id,
        label: t.trackName || t.id,
      })),
    ],
    [state.extraTracks],
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
      const lane = Math.max(1, ...s.extraTracks.map((t) => t.lane + 1));
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
            West end (A) main track
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
            East end (B) main track
            <select
              value={state.configB}
              onChange={(e) => patch((s) => (s.configB = e.target.value as "single" | "double"))}
              className={`mt-1 ${inp}`}
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
        </div>
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
                <Field label="Lane">
                  <input
                    type="number"
                    min={1}
                    value={t.lane}
                    onChange={(e) => patch((s) => (s.extraTracks[i].lane = Number(e.target.value) || 1))}
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
