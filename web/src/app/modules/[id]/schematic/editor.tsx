"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  stateToDoc,
  buildPassingSiding,
  buildTransition,
  buildCrossover,
  isTransitionTurnout,
  deriveEndplatePoses,
  poseNeedsManual,
  moduleFootprint,
  nextId,
  inchesToScaleFeet,
  type EditorState,
  type TrackRole,
  type TurnoutKind,
  type SignalFacing,
} from "@/lib/module-schematic";
import { SchematicPreview } from "./schematic-preview";
import { BenchworkEditor, type CanvasSelection } from "./benchwork-editor";
import {
  saveModuleSchematic,
  updateModuleDimensions,
  type ModuleDimensions,
} from "./actions";

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
  lockedConfigs = { a: false, b: false },
  geometries = [],
  initialDimensions,
}: {
  moduleId: number;
  recordNumber: string;
  moduleName: string;
  initial: EditorState;
  hadSchematic: boolean;
  newModule?: boolean;
  /** True when the module's endplate records define the config — the selects
   * mirror them read-only (edit endplates on the module page instead). */
  lockedConfigs?: { a: boolean; b: boolean };
  /** Geometry choices from the lookup table (which need degrees / offset). */
  geometries?: {
    value: string;
    display_label: string;
    requires_degrees: boolean;
    requires_offset_inches: boolean;
  }[];
  /** The module's geometry + lengths — editable here, since they size the board. */
  initialDimensions: ModuleDimensions;
}) {
  const [state, setState] = useState<EditorState>(initial);
  /** What's selected on the physical canvas — drives the contextual inspector. */
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  /** Build order: each stage's output is the next one's substrate. */
  const [stage, setStage] = useState<Stage>("mainline");
  /** The module's geometry + lengths. Editing these reshapes the board live. */
  const [dims, setDims] = useState<ModuleDimensions>(initialDimensions);
  const geometry = useMemo(
    () => ({
      type: dims.geometry_type || null,
      degrees: dims.geometry_degrees ? Number(dims.geometry_degrees) : null,
      offset: dims.geometry_offset_inches ? Number(dims.geometry_offset_inches) : null,
    }),
    [dims],
  );
  const geoSpec = geometries.find((g) => g.value === dims.geometry_type);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const doc = useMemo(() => stateToDoc(state, recordNumber), [state, recordNumber]);
  const isDouble = state.configA === "double" || state.configB === "double";
  // Derived endplate poses (#175 phase 1b) — the auto-computed geometry the
  // owner can override for shapes the fields can't express (wye/loop/other).
  const derivedPoses = useMemo(
    () =>
      deriveEndplatePoses({
        lengthInches: state.lengthInches,
        geometryType: geometry.type,
        geometryDegrees: geometry.degrees,
        geometryOffsetInches: geometry.offset,
        endplateConfigs: [
          state.configA,
          state.configB === "none" ? "single" : state.configB,
        ],
        branches: state.branches.map((b, i) => ({
          id: String.fromCharCode(67 + i),
          atPos: b.pos,
          side: b.side,
          config: b.config,
        })),
        poseOverrides: state.poseOverrides,
      }),
    [state, geometry],
  );
  const wantsManualPose = poseNeedsManual(geometry.type) || state.loop;
  // The real physical module — its centre-line drives where track, turnouts and
  // signals actually sit on the board (not just in the straightened view).
  const footprint = useMemo(
    () =>
      moduleFootprint({
        lengthInches: state.lengthInches,
        geometryType: geometry.type,
        geometryDegrees: geometry.degrees,
        geometryOffsetInches: geometry.offset,
        endplateWidths: state.endplateWidths,
        outline: state.outline,
      }),
    [state.lengthInches, state.endplateWidths, state.outline, geometry],
  );
  /** Everything except the main itself — the main IS the centre-line. */
  const canvasTracks = useMemo(
    () =>
      (doc.tracks ?? [])
        .filter((t) => t.id !== MAIN_TRACK_ID)
        .map((t) => ({
          id: t.id,
          lane: t.lane ?? 1,
          fromPos: t.fromPos ?? 0,
          toPos: t.toPos ?? state.lengthInches,
          // Sidings/spurs are the owner's to place; Main 2 is derived.
          editable: state.extraTracks.some((x) => x.id === t.id),
        })),
    [doc, state.lengthInches, state.extraTracks],
  );
  const canvasTurnouts = useMemo(
    () => state.turnouts.map((t) => ({ id: t.id, pos: t.pos })),
    [state.turnouts],
  );
  const canvasSignals = useMemo(
    () =>
      state.controlPoints.flatMap((cp) =>
        cp.signals.map((s) => ({ id: s.id, pos: s.pos, side: s.side })),
      ),
    [state.controlPoints],
  );
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

  /**
   * Edit a dimension. The doc's mainline length follows the module's (mainline
   * length if set, else the footprint length) so the board and the schematic
   * can't drift apart.
   */
  const setDim = (p: Partial<ModuleDimensions>) => {
    const next = { ...dims, ...p };
    setDims(next);
    const len = Number(next.mainline_length_inches || next.length_total_inches) || 0;
    if (len > 0 && len !== state.lengthInches) patch((s) => (s.lengthInches = len));
  };

  /** Store an authored endplate face width, or clear it back to the default. */
  const setEndplateWidth = (id: string, raw: string) =>
    patch((s) => {
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v > 0) s.endplateWidths[id] = v;
      else delete s.endplateWidths[id];
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
  function addCrossover() {
    patch((s) => {
      const built = buildCrossover(s);
      if (built) {
        s.extraTracks.push(built.track);
        s.turnouts.push(...built.turnouts);
      }
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
      // Dimensions live on the module record, the rest in the doc — but they're
      // one edit to the owner, so one Save writes both. Dimensions first: the
      // doc is measured against them.
      const dimsChanged = (Object.keys(dims) as (keyof ModuleDimensions)[]).some(
        (k) => dims[k] !== initialDimensions[k],
      );
      if (dimsChanged) {
        const dimResult = await updateModuleDimensions(moduleId, dims);
        if (dimResult && "error" in dimResult) {
          setError(dimResult.error);
          return;
        }
      }
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

      {/* Form (left) + sticky live preview (right) — the preview stays in view
          while scrolling the form. */}
      <div className="grid items-start gap-5 lg:grid-cols-[176px_minmax(0,1fr)_340px]">
        <StageRail stage={stage} setStage={setStage} state={state} />
        <div className="min-w-0 space-y-5">
      {/* Mainline */}
      {stage === "mainline" && (
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Dimensions & endplates</h2>
        <p className="mb-3 max-w-2xl text-sm text-gray-600">
          These size the board everything else is drawn on — change them and the
          canvas below reshapes as you type. Saved with the schematic.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Geometry
            <select
              value={dims.geometry_type}
              onChange={(e) =>
                setDim({
                  geometry_type: e.target.value,
                  geometry_degrees: "",
                  geometry_offset_inches: "",
                })
              }
              className={`mt-1 ${inp}`}
            >
              <option value="">—</option>
              {geometries.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.display_label}
                </option>
              ))}
            </select>
          </label>
          {geoSpec?.requires_degrees && (
            <label className="block text-sm font-medium text-gray-700">
              Degrees
              <input
                type="number"
                step={0.001}
                value={dims.geometry_degrees}
                onChange={(e) => setDim({ geometry_degrees: e.target.value })}
                className={`mt-1 ${inp}`}
              />
            </label>
          )}
          {geoSpec?.requires_offset_inches && (
            <label className="block text-sm font-medium text-gray-700">
              Offset (inches)
              <input
                type="number"
                step={0.001}
                value={dims.geometry_offset_inches}
                onChange={(e) => setDim({ geometry_offset_inches: e.target.value })}
                className={`mt-1 ${inp}`}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-gray-700">
            Module footprint length (in)
            <input
              type="number"
              step={0.001}
              value={dims.length_total_inches}
              onChange={(e) => setDim({ length_total_inches: e.target.value })}
              className={`mt-1 ${inp}`}
              title="The physical length of the board."
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Mainline length (in)
            <input
              type="number"
              step={0.001}
              value={dims.mainline_length_inches}
              onChange={(e) => setDim({ mainline_length_inches: e.target.value })}
              className={`mt-1 ${inp}`}
              placeholder={dims.length_total_inches || "same as footprint"}
              title="Only when the rail distance through the module differs from the footprint (curves, wyes). Blank = same as the footprint length."
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {state.loop ? "Entry (A) main track" : "West end (A) main track"}
            <select
              value={state.configA}
              disabled={lockedConfigs.a}
              title={
                lockedConfigs.a
                  ? "Mirrors the module's endplate record — change it in the module's Endplates section."
                  : undefined
              }
              onChange={(e) => patch((s) => (s.configA = e.target.value as "single" | "double"))}
              className={`mt-1 ${inp} ${lockedConfigs.a ? "bg-gray-50 text-gray-600" : ""}`}
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {state.loop ? "Interchange (B) endplate on the balloon" : "East end (B) main track"}
            <select
              value={state.configB}
              disabled={lockedConfigs.b && !state.loop}
              title={
                lockedConfigs.b && !state.loop
                  ? "Mirrors the module's endplate record — change it in the module's Endplates section."
                  : undefined
              }
              onChange={(e) =>
                patch((s) => (s.configB = e.target.value as "single" | "double" | "none"))
              }
              className={`mt-1 ${inp} ${lockedConfigs.b && !state.loop ? "bg-gray-50 text-gray-600" : ""}`}
            >
              {state.loop && <option value="none">None — pure turnback</option>}
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
        </div>
        {/* Endplate FACE width — the physical size of the standard interface at
            each end (Free-moN: 12″ minimum, 24″ recommended). A module may differ
            end to end; the layout draws each end and the benchwork band to match. */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            {state.loop ? "Entry (A)" : "West end (A)"} endplate face width (in)
            <input
              type="number"
              min={12}
              step={0.5}
              value={state.endplateWidths.A ?? 24}
              onChange={(e) => setEndplateWidth("A", e.target.value)}
              className={`mt-1 ${inp}`}
              title="Free-moN endplate face width: 12 in minimum, 24 in recommended."
            />
          </label>
          {state.configB !== "none" && (
            <label className="block text-sm font-medium text-gray-700">
              {state.loop ? "Interchange (B)" : "East end (B)"} endplate face width (in)
              <input
                type="number"
                min={12}
                step={0.5}
                value={state.endplateWidths.B ?? 24}
                onChange={(e) => setEndplateWidth("B", e.target.value)}
                className={`mt-1 ${inp}`}
                title="Free-moN endplate face width: 12 in minimum, 24 in recommended."
              />
            </label>
          )}
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
          !state.turnouts.some(isTransitionTurnout) && (
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
      )}

      {/* Track: sidings & spurs · turnouts · crossings */}
      {stage === "track" && (
        <>
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
            {!state.loop &&
              (state.configA === "double" || state.configB === "double") && (
                <button
                  type="button"
                  onClick={addCrossover}
                  className={addBtn}
                  title="A crossover between Main 1 and Main 2 — a turnout on each main joined by a diagonal."
                >
                  + Crossover
                </button>
              )}
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

      {/* Turnouts (advanced — the one-click builders create these for you) */}
      <Collapsible
        title="Turnouts"
        hint="usually built for you"
        count={state.turnouts.length}
        defaultOpen={state.turnouts.length > 0}
      >
        <div className="mb-3 flex justify-end">
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
      </Collapsible>

      {/* Crossings (diamonds) + branch endplate — junction features (#170) */}
      <Collapsible
        title="Crossings & additional endplates"
        hint="junctions — rare"
        count={state.crossings.length + state.branches.length}
        defaultOpen={state.crossings.length + state.branches.length > 0}
      >
        <div className="mb-3 flex justify-end">
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Additional endplates — every endplate is the same standard Free-moN
            interface (A/B are just the schematic&rsquo;s drawing axis). A set
            carrying a second line through has two more (in at one, out at the
            other); which route is &ldquo;the main&rdquo; is decided by the
            layout, not the module.
          </span>
          <button
            type="button"
            onClick={() =>
              patch((s) =>
                s.branches.push({
                  label: "",
                  pos: Math.round(s.lengthInches / 2),
                  side: "down",
                  config: "single",
                }),
              )
            }
            className={addBtn}
          >
            + Endplate
          </button>
        </div>
        {state.branches.map((b, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
            <Field label={`Endplate ${String.fromCharCode(67 + i)} — name / destination`}>
              <input
                value={b.label}
                onChange={(e) => patch((s) => (s.branches[i].label = e.target.value))}
                className={inp}
                placeholder="MoPac West"
              />
            </Field>
            <Field label="Position (in from A)">
              <input
                type="number"
                min={0}
                value={b.pos}
                onChange={(e) => patch((s) => (s.branches[i].pos = Number(e.target.value) || 0))}
                className={inp}
              />
            </Field>
            <Field label="Side">
              <select
                value={b.side}
                onChange={(e) => patch((s) => (s.branches[i].side = e.target.value as "up" | "down"))}
                className={inp}
              >
                <option value="up">Up (north)</option>
                <option value="down">Down (south)</option>
              </select>
            </Field>
            <Field label="Endplate track">
              <select
                value={b.config}
                onChange={(e) => patch((s) => (s.branches[i].config = e.target.value as "single" | "double"))}
                className={inp}
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </Field>
            <div className="pb-1">
              <button
                type="button"
                onClick={() => patch((s) => s.branches.splice(i, 1))}
                className={xBtn}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </Collapsible>
        </>
      )}

      {/* Endplate poses (#175 phase 1b) — the layout map's geometry. Auto-
          derived; owners hand-tune shapes the fields can't express. */}
      {stage === "benchwork" && (
      <Collapsible title="Endplate poses" hint="auto-derived — advanced">
        <p className="mb-3 text-sm text-gray-500">
          Where each endplate sits (inches from endplate A, with an outward
          heading) — this is what the layout map is built from. Auto-derived
          from the module&rsquo;s geometry;{" "}
          {wantsManualPose
            ? "this shape needs a hand-entered pose — adjust the values below."
            : "override a value only if the map looks wrong."}
        </p>
        <div className="space-y-2">
          {derivedPoses.map((p) => {
            const o = state.poseOverrides[p.id];
            const setField = (k: "x" | "y" | "heading", v: string) =>
              patch((s) => {
                const base = s.poseOverrides[p.id] ?? {
                  x: p.x,
                  y: p.y,
                  heading: p.heading,
                };
                s.poseOverrides[p.id] = { ...base, [k]: Number(v) || 0 };
              });
            return (
              <div key={p.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                <div className="text-sm font-medium text-gray-700">
                  Endplate {p.id}
                  {o && <span className="ml-1 text-xs text-amber-600">(manual)</span>}
                </div>
                <Field label="X (in)">
                  <input
                    type="number"
                    step="0.1"
                    value={Math.round((o?.x ?? p.x) * 10) / 10}
                    onChange={(e) => setField("x", e.target.value)}
                    className={inp}
                  />
                </Field>
                <Field label="Y (in)">
                  <input
                    type="number"
                    step="0.1"
                    value={Math.round((o?.y ?? p.y) * 10) / 10}
                    onChange={(e) => setField("y", e.target.value)}
                    className={inp}
                  />
                </Field>
                <Field label="Heading (°)">
                  <input
                    type="number"
                    step="1"
                    value={Math.round(o?.heading ?? p.heading)}
                    onChange={(e) => setField("heading", e.target.value)}
                    className={inp}
                  />
                </Field>
                <div className="pb-1">
                  {o ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch((s) => {
                          delete s.poseOverrides[p.id];
                        })
                      }
                      className={xBtn}
                    >
                      Reset
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">derived</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Collapsible>
      )}

      {/* Control Points (signals — at a turnout, or a standalone block signal) */}
      {stage === "operations" && (
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
                          // Add the opposite-direction signal of the last one
                          // so a control point builds a proper both-ways pair
                          // (above/below) rather than stacking identical masts.
                          const last = cp.signals[cp.signals.length - 1];
                          const facing = last?.facing === "AtoB" ? "BtoA" : "AtoB";
                          cp.signals.push({
                            id: `${cp.id}-${nextId("s", cp.signals.map((x) => x.id))}`,
                            pos: last?.pos ?? Math.round(st.lengthInches * 0.25),
                            track: last?.track ?? MAIN_TRACK_ID,
                            facing,
                            side: facing === "AtoB" ? "above" : "below",
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
      )}

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

        {/* Sticky live preview */}
        <div className="lg:sticky lg:top-4">
          <SchematicPreview doc={doc} />
          <p className="mt-1 px-1 text-xs text-gray-400">
            Updates live as you edit. West → East.
          </p>
        </div>
      </div>

      {/* Benchwork footprint — full width; it needs room to draw (#benchwork) */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Benchwork &amp; track</h2>
          <span className="text-sm text-gray-500">
            {state.outline.length ? `${state.outline.length}-corner shape` : "physical canvas"}
          </span>
        </div>
        <p className="mb-3 max-w-3xl text-sm text-gray-600">
          The module as it physically is, to scale: the mainline, sidings, turnouts
          and signals are drawn where they actually sit on the board. Draw the
          benchwork around them — click an edge to add a corner, drag a corner (the
          endplate faces show as ◆ anchors to snap to), or drag an edge&apos;s ◇ to
          curve it. Free-Dispatcher draws this real shape in the layout map; leave it
          empty to fall back to the endplate-width band. Measurements are in inches.
        </p>
        <BenchworkEditor
          outline={state.outline}
          onChange={(next) => patch((s) => (s.outline = next))}
          lengthInches={state.lengthInches}
          poses={derivedPoses}
          endplateWidths={state.endplateWidths}
          centerline={footprint.centerline}
          tracks={canvasTracks}
          turnouts={canvasTurnouts}
          signals={canvasSignals}
          onTurnoutMove={(id, pos) =>
            patch((s) => {
              const t = s.turnouts.find((x) => x.id === id);
              if (t) t.pos = pos;
            })
          }
          onTrackEndMove={(id, end, pos) =>
            patch((s) => {
              const t = s.extraTracks.find((x) => x.id === id);
              if (!t) return;
              if (end === "from") t.fromPos = pos;
              else t.toPos = pos;
            })
          }
          selection={selection}
          onSelect={setSelection}
        />
        <CanvasInspector
          selection={selection}
          state={state}
          patch={patch}
          clear={() => setSelection(null)}
          trackOptions={trackOptions}
        />
      </section>
    </div>
  );
}

/** Authoring stages, in the order a module actually gets built. */
type Stage = "mainline" | "benchwork" | "track" | "operations";
const STAGES: {
  id: Stage;
  label: string;
  hint: (s: EditorState) => string;
}[] = [
  {
    id: "mainline",
    label: "Dimensions & endplates",
    hint: (s) =>
      `${s.lengthInches}″ · ${s.configA}${s.configB === "none" ? "" : ` / ${s.configB}`}`,
  },
  {
    id: "benchwork",
    label: "Benchwork",
    hint: (s) => (s.outline.length ? `${s.outline.length}-corner shape` : "not drawn"),
  },
  {
    id: "track",
    label: "Track",
    hint: (s) =>
      `${s.extraTracks.length} track${s.extraTracks.length === 1 ? "" : "s"} · ${s.turnouts.length} turnout${s.turnouts.length === 1 ? "" : "s"}`,
  },
  {
    id: "operations",
    label: "Operations",
    hint: (s) =>
      `${s.controlPoints.length} control point${s.controlPoints.length === 1 ? "" : "s"}`,
  },
];

/**
 * Build-order rail. Each stage's output is the next one's substrate — the
 * dimensions size the board, the board carries the track, the track carries the
 * signals — so the rail runs in the order you'd actually build the module. It
 * filters the tools; the physical canvas below stays visible throughout.
 */
function StageRail({
  stage,
  setStage,
  state,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
  state: EditorState;
}) {
  return (
    <nav className="lg:sticky lg:top-4">
      <ol className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
        {STAGES.map((st, i) => {
          const on = stage === st.id;
          return (
            <li key={st.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => setStage(st.id)}
                aria-current={on ? "step" : undefined}
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  on
                    ? "border-blue-500 bg-blue-50"
                    : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className={`block text-sm font-medium ${on ? "text-blue-900" : "text-gray-800"}`}>
                  {i + 1}. {st.label}
                </span>
                <span className="block text-xs text-gray-500">{st.hint(state)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 hidden px-3 text-xs text-gray-400 lg:block">
        Built in order: the dimensions size the board, the board carries the track,
        the track carries the signals.
      </p>
    </nav>
  );
}

/**
 * Contextual inspector — edits whatever is selected on the physical canvas, in
 * place, instead of making you find it in the form sections below. Corners are
 * handled by the canvas itself; this covers the track features.
 */
function CanvasInspector({
  selection,
  state,
  patch,
  clear,
  trackOptions,
}: {
  selection: CanvasSelection | null;
  state: EditorState;
  patch: (fn: (s: EditorState) => void) => void;
  clear: () => void;
  trackOptions: { value: string; label: string }[];
}) {
  if (!selection || selection.kind === "corner") return null;

  const shell = (title: string, body: React.ReactNode, onRemove: () => void, removeLabel: string) => (
    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-gray-700">
          Done
        </button>
      </div>
      {body}
      <button
        type="button"
        onClick={() => {
          onRemove();
          clear();
        }}
        className="mt-2 rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {removeLabel}
      </button>
    </div>
  );

  if (selection.kind === "turnout") {
    const i = state.turnouts.findIndex((t) => t.id === selection.id);
    if (i < 0) return null;
    const t = state.turnouts[i];
    return shell(
      `Turnout · ${t.name || t.id}`,
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Name">
          <input
            value={t.name}
            onChange={(e) => patch((s) => (s.turnouts[i].name = e.target.value))}
            className={inp}
          />
        </Field>
        <Field label="Position (in from A)">
          <input
            type="number"
            step={0.5}
            value={t.pos}
            onChange={(e) => patch((s) => (s.turnouts[i].pos = Number(e.target.value)))}
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
              <option key={o.value} value={o.value}>{o.label}</option>
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
              <option key={o.value} value={o.value}>{o.label}</option>
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
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>,
      () => patch((s) => s.turnouts.splice(i, 1)),
      "Remove turnout",
    );
  }

  const i = state.extraTracks.findIndex((t) => t.id === selection.id);
  if (i < 0) return null;
  const t = state.extraTracks[i];
  return shell(
    `Track · ${t.trackName || t.id}`,
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Field label="Name">
        <input
          value={t.trackName ?? ""}
          onChange={(e) => patch((s) => (s.extraTracks[i].trackName = e.target.value))}
          className={inp}
        />
      </Field>
      <Field label="Kind">
        <select
          value={t.role}
          onChange={(e) => patch((s) => (s.extraTracks[i].role = e.target.value as TrackRole))}
          className={inp}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Starts (in from A)">
        <input
          type="number"
          step={0.5}
          value={t.fromPos}
          onChange={(e) => patch((s) => (s.extraTracks[i].fromPos = Number(e.target.value)))}
          className={inp}
        />
      </Field>
      <Field label="Ends (in from A)">
        <input
          type="number"
          step={0.5}
          value={t.toPos}
          onChange={(e) => patch((s) => (s.extraTracks[i].toPos = Number(e.target.value)))}
          className={inp}
        />
      </Field>
      <Field label="Capacity (N)">
        <div className={`${inp} bg-gray-50 text-gray-600`}>
          {Math.round(inchesToScaleFeet(Math.abs(t.toPos - t.fromPos)))} ft
        </div>
      </Field>
    </div>,
    () => patch((s) => s.extraTracks.splice(i, 1)),
    "Remove track",
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

/** An advanced section that collapses by default so the common path stays
 * front-and-centre. Opens automatically when it already holds content. */
function Collapsible({
  title,
  hint,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-gray-200 bg-white [&>summary]:list-none"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-4">
        <span className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">{title}</span>
          {count ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {count}
            </span>
          ) : null}
          {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </span>
        <span className="text-gray-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-gray-100 p-4 pt-3">{children}</div>
    </details>
  );
}
