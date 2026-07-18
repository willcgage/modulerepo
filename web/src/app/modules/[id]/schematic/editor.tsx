"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  BenchworkEditor,
  type CanvasSelection,
  type CanvasTool,
} from "./benchwork-editor";
import {
  saveModuleSchematic,
  updateModuleDimensions,
  type ModuleDimensions,
} from "./actions";

const inp =
  "block w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const addBtn =
  "rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50";
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

/**
 * What's selected. A superset of what the CANVAS can hit: crossings and control
 * points have no shape (a control point is a named *group*), so they're selected
 * from the Objects list instead. One selection drives one inspector either way.
 */
type Selection =
  | CanvasSelection
  | { kind: "crossing"; id: string }
  | { kind: "cp"; id: string };

const isCanvasSel = (s: Selection | null): s is CanvasSelection =>
  s !== null &&
  (s.kind === "corner" ||
    s.kind === "turnout" ||
    s.kind === "track" ||
    s.kind === "endplate");

export function SchematicEditor({
  moduleId,
  recordNumber,
  moduleName,
  initial,
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
  /** What's selected — drives the one inspector on the right. */
  const [selection, setSelection] = useState<Selection | null>(null);
  /** What a canvas background click means. */
  const [tool, setTool] = useState<CanvasTool>("select");
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

  // --- Undo / redo -----------------------------------------------------------
  // The whole document is `state` + `dims`, both replaced immutably, so history
  // is just a stack of snapshots. Rapid changes within one gesture (a drag) are
  // coalesced into a single entry so one Ctrl+Z doesn't rewind pixel by pixel.
  type Snap = { state: EditorState; dims: ModuleDimensions };
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const lastEditAt = useRef(0);
  // Mirror the stack depths into state so the undo/redo buttons re-render
  // without reading refs during render (which React forbids).
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const syncHist = () => setHist({ undo: past.current.length, redo: future.current.length });

  const snapshot = () => {
    const now = Date.now();
    const coalesce = now - lastEditAt.current < 450 && past.current.length > 0;
    lastEditAt.current = now;
    if (coalesce) return; // same gesture — fold into the existing entry
    past.current = [...past.current.slice(-99), { state, dims }];
    future.current = [];
    syncHist();
  };
  const restore = (snap: Snap) => {
    setState(snap.state);
    setDims(snap.dims);
    lastEditAt.current = 0; // the next edit starts a fresh history entry
  };
  const undo = useCallback(() => {
    const prev = past.current[past.current.length - 1];
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, { state, dims }];
    restore(prev);
    syncHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dims]);
  const redo = useCallback(() => {
    const next = future.current[future.current.length - 1];
    if (!next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, { state, dims }];
    restore(next);
    syncHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dims]);

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

  const patch = (fn: (s: EditorState) => void) => {
    snapshot();
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  /**
   * Edit a dimension. The doc's mainline length follows the module's (mainline
   * length if set, else the footprint length) so the board and the schematic
   * can't drift apart.
   */
  const setDim = (p: Partial<ModuleDimensions>) => {
    snapshot();
    const next = { ...dims, ...p };
    setDims(next);
    const len = Number(next.mainline_length_inches || next.length_total_inches) || 0;
    // NB: patch() also snapshots, but snapshot() coalesces within a gesture, so
    // the dims + length change land in one undo entry.
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

  // --- Autosave --------------------------------------------------------------
  // No Save button: persist automatically ~1s after the last edit. Dimensions
  // live on the module record and the rest in the doc, so each half is written
  // only when its own signature changed. Refs (not closures) hold the live
  // values so a save scheduled in one render still writes the latest.
  type SaveState = "saved" | "unsaved" | "saving" | "error";
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const docSig = useMemo(() => JSON.stringify(doc), [doc]);
  const dimsSig = useMemo(() => JSON.stringify(dims), [dims]);
  const docRef = useRef(doc);
  const dimsRef = useRef(dims);
  const sigRef = useRef({ doc: docSig, dims: dimsSig });
  const savedSig = useRef({ doc: docSig, dims: dimsSig }); // last persisted
  const savingRef = useRef(false);
  // Keep the "live value" refs current for a save scheduled a second ago
  // (writing refs during render is disallowed; this effect runs after commit).
  useEffect(() => {
    docRef.current = doc;
    dimsRef.current = dims;
    sigRef.current = { doc: docSig, dims: dimsSig };
  });

  const runSave = useCallback(async () => {
    if (savingRef.current) return; // in flight; its finally re-checks
    const target = { ...sigRef.current };
    if (target.doc === savedSig.current.doc && target.dims === savedSig.current.dims) {
      setSaveState("saved");
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setError(null);
    try {
      if (target.dims !== savedSig.current.dims) {
        const r = await updateModuleDimensions(moduleId, dimsRef.current);
        if (r && "error" in r) throw new Error(r.error);
        savedSig.current.dims = target.dims;
      }
      if (target.doc !== savedSig.current.doc) {
        const r = await saveModuleSchematic(moduleId, docRef.current);
        if (r && "error" in r) throw new Error(r.error);
        savedSig.current.doc = target.doc;
      }
      const clean =
        sigRef.current.doc === savedSig.current.doc &&
        sigRef.current.dims === savedSig.current.dims;
      setSaveState(clean ? "saved" : "unsaved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaveState("error");
    } finally {
      savingRef.current = false;
      // Edited while saving? A later effect run already scheduled the next pass.
    }
  }, [moduleId]);

  // Debounce: settle 1s after the last change, then persist.
  useEffect(() => {
    if (docSig === savedSig.current.doc && dimsSig === savedSig.current.dims) {
      if (!savingRef.current) setSaveState("saved");
      return;
    }
    setSaveState((s) => (s === "saving" ? s : "unsaved"));
    const t = setTimeout(() => void runSave(), 1000);
    return () => clearTimeout(t);
  }, [docSig, dimsSig, runSave]);

  /** Erase the drawing (kept as a deliberate, confirmed action). Autosave then
   * persists the emptied module. */
  const clearDrawing = () => {
    if (!window.confirm("Clear the whole schematic — outline, track, signals?")) return;
    patch((s) => {
      s.outline = [];
      s.extraTracks = [];
      s.turnouts = [];
      s.crossings = [];
      s.branches = [];
      s.controlPoints = [];
      s.poseOverrides = {};
    });
  };

  // --- Keyboard: tool shortcuts, undo/redo, pan (space handled in canvas) -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!mod && !e.altKey) {
        if (e.key === "v" || e.key === "V") setTool("select");
        else if (e.key === "b" || e.key === "B") setTool("benchwork");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-100">
      {/* Top bar — identity, readiness, save. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3">
        <Link
          href={`/modules/${moduleId}`}
          className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title="Back to module"
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{moduleName}</div>
          <div className="truncate text-xs text-gray-500">{recordNumber}</div>
        </div>
        <Readiness state={state} onGo={setTool} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={hist.undo === 0}
            title="Undo (Ctrl+Z)"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={hist.redo === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            ↷
          </button>
          <span className="mx-1 h-5 w-px bg-gray-200" />
          <SaveBadge state={saveState} error={error} />
          <button
            type="button"
            onClick={clearDrawing}
            title="Clear the whole schematic"
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-700"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Body: tool rail | canvas (+ dispatcher strip) | inspector */}
      <div className="flex min-h-0 flex-1">
        <ToolRail tool={tool} setTool={setTool} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="min-h-0 flex-1 rounded-lg border border-gray-200 bg-white p-2">
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
                tool={tool}
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
                selection={isCanvasSel(selection) ? selection : null}
                onSelect={setSelection}
              />
            </div>
          </div>
          <DispatcherStrip doc={doc} />
        </div>

        {/* The one inspector. */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">
          <Inspector
            selection={selection}
            select={setSelection}
            state={state}
            patch={patch}
            dims={dims}
            setDim={setDim}
            geometries={geometries}
            geoSpec={geoSpec}
            lockedConfigs={lockedConfigs}
            derivedPoses={derivedPoses}
            wantsManualPose={wantsManualPose}
            setEndplateWidth={setEndplateWidth}
            trackOptions={trackOptions}
          />
          <ObjectsList
            state={state}
            selection={selection}
            select={setSelection}
            setTool={setTool}
            add={{
              passingSiding: addPassingSiding,
              spur: addSpur,
              crossover: addCrossover,
              turnout: addTurnout,
              crossing: addCrossing,
              controlPoint: addControlPoint,
            }}
          />
        </aside>
      </div>
    </div>
  );
}

/** The tools that decide what a canvas click means. Select and Benchwork are
 * live; the rest are placeholders for later stages (drawn track, signals…) so
 * the rail's shape is settled. Each has a single-key shortcut. */
const TOOLS: {
  id: CanvasTool;
  key: string;
  label: string;
  glyph: string;
  hint: string;
  soon?: boolean;
}[] = [
  { id: "select", key: "V", label: "Select", glyph: "▶", hint: "Select & move (V)" },
  { id: "benchwork", key: "B", label: "Benchwork", glyph: "▱", hint: "Draw the board outline (B)" },
];
const SOON_TOOLS = [
  { key: "T", label: "Track", glyph: "═" },
  { key: "W", label: "Turnout", glyph: "⋋" },
  { key: "S", label: "Signal", glyph: "⚑" },
  { key: "I", label: "Industry", glyph: "▢" },
];

function ToolRail({
  tool,
  setTool,
}: {
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;
}) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-2">
      {TOOLS.map((t) => {
        const on = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.hint}
            aria-pressed={on}
            className={`flex h-9 w-9 flex-col items-center justify-center rounded-md text-base leading-none transition ${
              on ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{t.glyph}</span>
            <span className="mt-0.5 text-[9px] font-medium">{t.key}</span>
          </button>
        );
      })}
      <div className="my-1 h-px w-6 bg-gray-200" />
      {SOON_TOOLS.map((t) => (
        <button
          key={t.label}
          type="button"
          disabled
          title={`${t.label} — coming soon`}
          className="flex h-9 w-9 cursor-not-allowed flex-col items-center justify-center rounded-md text-base leading-none text-gray-300"
        >
          <span>{t.glyph}</span>
          <span className="mt-0.5 text-[9px] font-medium">{t.key}</span>
        </button>
      ))}
    </div>
  );
}

/** Autosave status pill in the top bar (replaces the Save button). */
function SaveBadge({
  state,
  error,
}: {
  state: "saved" | "unsaved" | "saving" | "error";
  error: string | null;
}) {
  if (state === "error") {
    return (
      <span className="max-w-[16rem] truncate text-xs font-medium text-red-700" title={error ?? undefined}>
        ⚠ {error ?? "Save failed"}
      </span>
    );
  }
  const map = {
    saved: { text: "Saved", cls: "text-green-700" },
    saving: { text: "Saving…", cls: "text-gray-500" },
    unsaved: { text: "Unsaved", cls: "text-amber-600" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

/** True when a key event targets a text field — so shortcuts don't hijack typing. */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
}

/** The derived dispatcher view. Never authored — so it gets a strip, not a
 * column. It's glanceable because it's *why* the module data exists. */
function DispatcherStrip({ doc }: { doc: ReturnType<typeof stateToDoc> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="shrink-0 border-t border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
        Dispatcher view
        <span className="font-normal text-gray-400">— derived, West → East</span>
      </button>
      {open && (
        <div className="max-h-44 overflow-auto px-3 pb-3">
          <SchematicPreview doc={doc} />
        </div>
      )}
    </div>
  );
}

/**
 * Build order, as advice rather than a gate. The stage rail used to hide fields
 * to enforce this order; the hints were the only completeness signal in the app,
 * so they survive here — now they say what's missing without locking anything.
 */
const STAGES: {
  id: string;
  label: string;
  hint: (s: EditorState) => string;
  done: (s: EditorState) => boolean;
  tool?: CanvasTool;
}[] = [
  {
    id: "mainline",
    label: "Dimensions & endplates",
    hint: (s) =>
      `${s.lengthInches}″ · ${s.configA}${s.configB === "none" ? "" : ` / ${s.configB}`}`,
    done: (s) => s.lengthInches > 0,
  },
  {
    id: "benchwork",
    label: "Benchwork",
    hint: (s) => (s.outline.length ? `${s.outline.length}-corner shape` : "not drawn"),
    done: (s) => s.outline.length >= 3,
    tool: "benchwork",
  },
  {
    id: "track",
    label: "Track",
    hint: (s) =>
      `${s.extraTracks.length} track${s.extraTracks.length === 1 ? "" : "s"} · ${s.turnouts.length} turnout${s.turnouts.length === 1 ? "" : "s"}`,
    done: (s) => s.extraTracks.length > 0,
  },
  {
    id: "operations",
    label: "Operations",
    hint: (s) =>
      `${s.controlPoints.length} control point${s.controlPoints.length === 1 ? "" : "s"}`,
    done: (s) => s.controlPoints.length > 0,
  },
];

function Readiness({
  state,
  onGo,
}: {
  state: EditorState;
  onGo: (t: CanvasTool) => void;
}) {
  const left = STAGES.filter((s) => !s.done(state)).length;
  return (
    <details className="relative shrink-0">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
        <span className={left ? "text-amber-500" : "text-green-600"}>{left ? "⚠" : "✓"}</span>
        {left ? `${left} to do` : "Complete"}
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
        <p className="px-1 pb-1 text-xs text-gray-400">
          Built in order: the dimensions size the board, the board carries the
          track, the track carries the signals.
        </p>
        {STAGES.map((s) => {
          const ok = s.done(state);
          return (
            <div key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs">
              <span className={ok ? "text-green-600" : "text-amber-500"}>{ok ? "✓" : "⚠"}</span>
              <span className="font-medium text-gray-800">{s.label}</span>
              <span className="ml-auto text-gray-500">{s.hint(state)}</span>
              {!ok && s.tool && (
                <button
                  type="button"
                  onClick={() => onGo(s.tool!)}
                  className="shrink-0 font-medium text-blue-600 hover:underline"
                >
                  Draw it
                </button>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

/**
 * The one inspector. With nothing selected it shows the MODULE's properties —
 * which is where the old "mainline" stage's fields live now. That's what lets
 * the stage rail die without orphaning them.
 */
function Inspector({
  selection,
  select,
  state,
  patch,
  dims,
  setDim,
  geometries,
  geoSpec,
  lockedConfigs,
  derivedPoses,
  wantsManualPose,
  setEndplateWidth,
  trackOptions,
}: {
  selection: Selection | null;
  select: (s: Selection | null) => void;
  state: EditorState;
  patch: (fn: (s: EditorState) => void) => void;
  dims: ModuleDimensions;
  setDim: (p: Partial<ModuleDimensions>) => void;
  geometries: { value: string; display_label: string; requires_degrees: boolean; requires_offset_inches: boolean }[];
  geoSpec?: { requires_degrees: boolean; requires_offset_inches: boolean };
  lockedConfigs: { a: boolean; b: boolean };
  derivedPoses: { id: string; x: number; y: number; heading: number }[];
  wantsManualPose: boolean;
  setEndplateWidth: (id: string, raw: string) => void;
  trackOptions: { value: string; label: string }[];
}) {
  const head = (title: string, sub?: string) => (
    <div className="mb-3 border-b border-gray-100 pb-2">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
  const box = "shrink-0 p-3";

  // ---- Nothing selected → the module itself ----
  if (!selection) {
    return (
      <div className={box}>
        {head("Module", "Nothing selected — these size the board everything else is drawn on.")}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-600">
            Geometry
            <select
              value={dims.geometry_type}
              onChange={(e) =>
                setDim({ geometry_type: e.target.value, geometry_degrees: "", geometry_offset_inches: "" })
              }
              className={`mt-0.5 ${inp}`}
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
            <label className="block text-xs font-medium text-gray-600">
              Degrees
              <input
                type="number"
                step={0.001}
                value={dims.geometry_degrees}
                onChange={(e) => setDim({ geometry_degrees: e.target.value })}
                className={`mt-0.5 ${inp}`}
              />
            </label>
          )}
          {geoSpec?.requires_offset_inches && (
            <label className="block text-xs font-medium text-gray-600">
              Offset (in)
              <input
                type="number"
                step={0.001}
                value={dims.geometry_offset_inches}
                onChange={(e) => setDim({ geometry_offset_inches: e.target.value })}
                className={`mt-0.5 ${inp}`}
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-gray-600">
              Footprint length (in)
              <input
                type="number"
                step={0.001}
                value={dims.length_total_inches}
                onChange={(e) => setDim({ length_total_inches: e.target.value })}
                className={`mt-0.5 ${inp}`}
                title="The physical length of the board."
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Mainline length (in)
              <input
                type="number"
                step={0.001}
                value={dims.mainline_length_inches}
                onChange={(e) => setDim({ mainline_length_inches: e.target.value })}
                className={`mt-0.5 ${inp}`}
                placeholder={dims.length_total_inches || "same"}
                title="Only when the rail distance through the module differs from the footprint (curves, wyes). Blank = same as the footprint length."
              />
            </label>
          </div>
          <label className="flex gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
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
            <span>
              <span className="font-medium">Loop module</span> — the main runs the
              lead and turns back at the balloon (positions past the throat are
              inside the loop). A standard endplate B on the balloon makes it an
              interchange.
            </span>
          </label>
          {state.loop && state.configA === "double" && (
            <label className="block text-xs font-medium text-gray-600">
              Loop returns onto
              <select
                value={state.loopReturn}
                onChange={(e) => patch((s) => (s.loopReturn = e.target.value as "same" | "main2"))}
                className={`mt-0.5 ${inp}`}
                title="On a double-track main, the balloon can be a directional return: out on Main 1, back on Main 2 — drawn as a U joining the two mains."
              >
                <option value="same">Same main (turnback)</option>
                <option value="main2">Main 2 (directional return)</option>
              </select>
            </label>
          )}
          {/* Transition module (FMN-0038): one end single, the other double —
              the main line needs a turnout where Main 2 begins. */}
          {!state.loop &&
            (state.configA === "double") !== (state.configB === "double") &&
            !state.turnouts.some(isTransitionTurnout) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <p>
                  One end is single track and the other double — the main line
                  needs a transition turnout where Main 2{" "}
                  {state.configA === "double" ? "ends" : "begins"}. This adds the
                  switch and an <em>End of Double Track</em> control point with
                  signals; adjust its position afterwards.
                </p>
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
                  className="mt-2 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                >
                  + Add transition
                </button>
              </div>
            )}
          <p className="text-xs text-gray-400">
            Select an endplate, corner, track or turnout on the canvas to edit it.
          </p>
        </div>
      </div>
    );
  }

  const shell = (title: string, body: React.ReactNode, remove?: { fn: () => void; label: string }) => (
    <div className={box}>
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={() => select(null)}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-700"
        >
          Done
        </button>
      </div>
      <div className="space-y-3">{body}</div>
      {remove && (
        <button
          type="button"
          onClick={() => {
            remove.fn();
            select(null);
          }}
          className="mt-3 w-full rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          {remove.label}
        </button>
      )}
    </div>
  );

  // ---- Endplate ----
  if (selection.kind === "endplate") {
    const id = selection.id;
    const pose = derivedPoses.find((p) => p.id === id);
    if (!pose) return null;
    const o = state.poseOverrides[id];
    const setPose = (k: "x" | "y" | "heading", v: string) =>
      patch((s) => {
        const base = s.poseOverrides[id] ?? { x: pose.x, y: pose.y, heading: pose.heading };
        s.poseOverrides[id] = { ...base, [k]: Number(v) || 0 };
      });
    // A/B are the schematic's drawing axis; C+ are authored branches.
    const bi = id.charCodeAt(0) - 67;
    const branch = bi >= 0 ? state.branches[bi] : undefined;
    const locked = (id === "A" && lockedConfigs.a) || (id === "B" && lockedConfigs.b && !state.loop);

    return shell(
      `Endplate ${id}`,
      <>
        {branch ? (
          <>
            <label className="block text-xs font-medium text-gray-600">
              Name / destination
              <input
                value={branch.label}
                onChange={(e) => patch((s) => (s.branches[bi].label = e.target.value))}
                className={`mt-0.5 ${inp}`}
                placeholder="MoPac West"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-gray-600">
                Position (in from A)
                <input
                  type="number"
                  min={0}
                  value={branch.pos}
                  onChange={(e) => patch((s) => (s.branches[bi].pos = Number(e.target.value) || 0))}
                  className={`mt-0.5 ${inp}`}
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Side
                <select
                  value={branch.side}
                  onChange={(e) => patch((s) => (s.branches[bi].side = e.target.value as "up" | "down"))}
                  className={`mt-0.5 ${inp}`}
                >
                  <option value="up">Up (north)</option>
                  <option value="down">Down (south)</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-gray-600">
              Endplate track
              <select
                value={branch.config}
                onChange={(e) => patch((s) => (s.branches[bi].config = e.target.value as "single" | "double"))}
                className={`mt-0.5 ${inp}`}
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </label>
          </>
        ) : (
          <label className="block text-xs font-medium text-gray-600">
            {id === "A"
              ? state.loop
                ? "Entry (A) main track"
                : "West end (A) main track"
              : state.loop
                ? "Interchange (B) endplate on the balloon"
                : "East end (B) main track"}
            <select
              value={id === "A" ? state.configA : state.configB}
              disabled={locked}
              title={
                locked
                  ? "Mirrors the module's endplate record — change it in the module's Endplates section."
                  : undefined
              }
              onChange={(e) =>
                patch((s) => {
                  if (id === "A") s.configA = e.target.value as "single" | "double";
                  else s.configB = e.target.value as "single" | "double" | "none";
                })
              }
              className={`mt-0.5 ${inp} ${locked ? "bg-gray-50 text-gray-600" : ""}`}
            >
              {id === "B" && state.loop && <option value="none">None — pure turnback</option>}
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
        )}

        {/* Endplate FACE width — the physical size of the standard interface at
            this end (Free-moN: 12″ minimum, 24″ recommended). */}
        <label className="block text-xs font-medium text-gray-600">
          Face width (in)
          <input
            type="number"
            min={12}
            step={0.5}
            value={state.endplateWidths[id] ?? 24}
            onChange={(e) => setEndplateWidth(id, e.target.value)}
            className={`mt-0.5 ${inp}`}
            title="Free-moN endplate face width: 12 in minimum, 24 in recommended."
          />
        </label>

        {/* Pose (#175 phase 1b) — the layout map's geometry. */}
        <details open={wantsManualPose} className="rounded-md border border-gray-200 p-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-gray-600">
            Pose {o ? <span className="text-amber-600">(manual)</span> : <span className="text-gray-400">(derived)</span>}
          </summary>
          <p className="mt-1 text-xs text-gray-500">
            Where this endplate sits (inches from A, outward heading) — what the
            layout map is built from.{" "}
            {wantsManualPose
              ? "This shape needs a hand-entered pose."
              : "Override only if the map looks wrong."}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="block text-xs font-medium text-gray-600">
              X (in)
              <input
                type="number"
                step="0.1"
                value={Math.round((o?.x ?? pose.x) * 10) / 10}
                onChange={(e) => setPose("x", e.target.value)}
                className={`mt-0.5 ${inp}`}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Y (in)
              <input
                type="number"
                step="0.1"
                value={Math.round((o?.y ?? pose.y) * 10) / 10}
                onChange={(e) => setPose("y", e.target.value)}
                className={`mt-0.5 ${inp}`}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Heading °
              <input
                type="number"
                step="1"
                value={Math.round(o?.heading ?? pose.heading)}
                onChange={(e) => setPose("heading", e.target.value)}
                className={`mt-0.5 ${inp}`}
              />
            </label>
          </div>
          {o && (
            <button
              type="button"
              onClick={() =>
                patch((s) => {
                  delete s.poseOverrides[id];
                })
              }
              className={`mt-2 ${xBtn}`}
            >
              Reset to derived
            </button>
          )}
        </details>
      </>,
      branch
        ? { fn: () => patch((s) => s.branches.splice(bi, 1)), label: `Remove endplate ${id}` }
        : undefined,
    );
  }

  // ---- Benchwork corner ----
  if (selection.kind === "corner") {
    const i = selection.i;
    const c = state.outline[i];
    if (!c) return null;
    const set = (k: "x" | "y", v: string) =>
      patch((s) => (s.outline[i] = { ...s.outline[i], [k]: Number(v) }));
    return shell(
      `Benchwork corner ${i + 1}`,
      <>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            X (in)
            <input type="number" step={0.5} value={c.x} onChange={(e) => set("x", e.target.value)} className={`mt-0.5 ${inp}`} />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Y (in)
            <input type="number" step={0.5} value={c.y} onChange={(e) => set("y", e.target.value)} className={`mt-0.5 ${inp}`} />
          </label>
        </div>
        {c.bulge ? (
          <button
            type="button"
            onClick={() =>
              // Drop the bulge on the edge LEAVING this corner.
              patch((s) => (s.outline[i] = { x: s.outline[i].x, y: s.outline[i].y }))
            }
            className={addBtn}
          >
            Straighten this edge
          </button>
        ) : (
          <p className="text-xs text-gray-400">
            Drag the ◇ on an edge to curve it into an arc.
          </p>
        )}
      </>,
      { fn: () => patch((s) => s.outline.splice(i, 1)), label: "Remove corner" },
    );
  }

  // ---- Turnout ----
  if (selection.kind === "turnout") {
    const i = state.turnouts.findIndex((t) => t.id === selection.id);
    if (i < 0) return null;
    const t = state.turnouts[i];
    return shell(
      `Turnout · ${t.name || t.id}`,
      <>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={t.name}
            onChange={(e) => patch((s) => (s.turnouts[i].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="West Siding"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Position (in from A)
          <input
            type="number"
            step={0.5}
            value={t.pos}
            onChange={(e) => patch((s) => (s.turnouts[i].pos = Number(e.target.value)))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            On track
            <select
              value={t.onTrack}
              onChange={(e) => patch((s) => (s.turnouts[i].onTrack = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Diverges to
            <select
              value={t.divergeTrack}
              onChange={(e) => patch((s) => (s.turnouts[i].divergeTrack = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-gray-600">
          Hand
          <select
            value={t.kind}
            onChange={(e) => patch((s) => (s.turnouts[i].kind = e.target.value as TurnoutKind))}
            className={`mt-0.5 ${inp}`}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </>,
      { fn: () => patch((s) => s.turnouts.splice(i, 1)), label: "Remove turnout" },
    );
  }

  // ---- Crossing (diamond) ----
  if (selection.kind === "crossing") {
    const i = state.crossings.findIndex((x) => x.id === selection.id);
    if (i < 0) return null;
    const x = state.crossings[i];
    return shell(
      `Crossing · ${x.name || x.id}`,
      <>
        <p className="text-xs text-gray-500">
          Where two tracks cross at grade with no route choice.
        </p>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={x.name}
            onChange={(e) => patch((s) => (s.crossings[i].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="Diamond"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Position (in from A)
          <input
            type="number"
            min={0}
            value={x.pos}
            onChange={(e) => patch((s) => (s.crossings[i].pos = Number(e.target.value) || 0))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Track A
            <select
              value={x.trackA}
              onChange={(e) => patch((s) => (s.crossings[i].trackA = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Track B
            <select
              value={x.trackB}
              onChange={(e) => patch((s) => (s.crossings[i].trackB = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </>,
      { fn: () => patch((s) => s.crossings.splice(i, 1)), label: "Remove crossing" },
    );
  }

  // ---- Control point (a named GROUP — no shape, so it's list-selected) ----
  if (selection.kind === "cp") {
    const ci = state.controlPoints.findIndex((c) => c.id === selection.id);
    if (ci < 0) return null;
    const c = state.controlPoints[ci];
    return shell(
      `Control point · ${c.name || c.id}`,
      <>
        <p className="text-xs text-gray-500">
          An interlocking — a named group of signals and the turnout(s) it
          governs. These become the Section &amp; District boundaries the layout
          builder works from.
        </p>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={c.name}
            onChange={(e) => patch((s) => (s.controlPoints[ci].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="West Siding"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-gray-600">Turnouts</span>
          {state.turnouts.length === 0 ? (
            <p className="text-xs text-gray-400">None yet — add a passing siding or a turnout.</p>
          ) : (
            <div className="mt-1 space-y-1">
              {state.turnouts.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={c.turnouts.includes(t.id)}
                    onChange={(e) =>
                      patch((s) => {
                        const cp = s.controlPoints[ci];
                        cp.turnouts = e.target.checked
                          ? [...cp.turnouts, t.id]
                          : cp.turnouts.filter((v) => v !== t.id);
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

        {state.crossings.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-600">Crossings</span>
            <div className="mt-1 space-y-1">
              {state.crossings.map((x) => (
                <label key={x.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={(c.crossings ?? []).includes(x.id)}
                    onChange={(e) =>
                      patch((s) => {
                        const cp = s.controlPoints[ci];
                        const cur = cp.crossings ?? [];
                        cp.crossings = e.target.checked ? [...cur, x.id] : cur.filter((v) => v !== x.id);
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

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Signals</span>
            <button
              type="button"
              onClick={() =>
                patch((s) => {
                  const cp = s.controlPoints[ci];
                  // Add the opposite-direction signal of the last one so a
                  // control point builds a proper both-ways pair (above/below)
                  // rather than stacking identical masts.
                  const last = cp.signals[cp.signals.length - 1];
                  const facing = last?.facing === "AtoB" ? "BtoA" : "AtoB";
                  cp.signals.push({
                    id: `${cp.id}-${nextId("s", cp.signals.map((x) => x.id))}`,
                    pos: last?.pos ?? Math.round(s.lengthInches * 0.25),
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
            <div key={s.id} className="mt-2 rounded-md border border-gray-200 p-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-gray-600">
                  Position (in)
                  <input
                    type="number"
                    min={0}
                    value={s.pos}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].pos = Number(e.target.value) || 0))}
                    className={`mt-0.5 ${inp}`}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Track
                  <select
                    value={s.track}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].track = e.target.value))}
                    className={`mt-0.5 ${inp}`}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Facing
                  <select
                    value={s.facing}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].facing = e.target.value as SignalFacing))}
                    className={`mt-0.5 ${inp}`}
                  >
                    <option value="AtoB">West → East</option>
                    <option value="BtoA">East → West</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Side
                  <select
                    value={s.side}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].side = e.target.value as "above" | "below"))}
                    className={`mt-0.5 ${inp}`}
                  >
                    <option value="above">Above track</option>
                    <option value="below">Below track</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => patch((st) => st.controlPoints[ci].signals.splice(si, 1))}
                className={`mt-1.5 ${xBtn}`}
              >
                Remove signal
              </button>
            </div>
          ))}
        </div>
      </>,
      { fn: () => patch((s) => s.controlPoints.splice(ci, 1)), label: "Remove control point" },
    );
  }

  // ---- Track ----
  const i = state.extraTracks.findIndex((t) => t.id === selection.id);
  if (i < 0) return null;
  const t = state.extraTracks[i];
  return shell(
    `Track · ${t.trackName || t.id}`,
    <>
      <label className="block text-xs font-medium text-gray-600">
        Name
        <input
          value={t.trackName ?? ""}
          onChange={(e) => patch((s) => (s.extraTracks[i].trackName = e.target.value))}
          className={`mt-0.5 ${inp}`}
          placeholder="e.g. Siding 1"
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Kind
        <select
          value={t.role}
          onChange={(e) => patch((s) => (s.extraTracks[i].role = e.target.value as TrackRole))}
          className={`mt-0.5 ${inp}`}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-gray-600">
          Starts (in from A)
          <input
            type="number"
            step={0.5}
            value={t.fromPos}
            onChange={(e) => patch((s) => (s.extraTracks[i].fromPos = Number(e.target.value)))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Ends (in from A)
          <input
            type="number"
            step={0.5}
            value={t.toPos}
            onChange={(e) => patch((s) => (s.extraTracks[i].toPos = Number(e.target.value)))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-gray-600">
          Lane
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
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Capacity (N)
          <div className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`}>
            {Math.round(inchesToScaleFeet(Math.abs(t.toPos - t.fromPos)))} ft
          </div>
        </label>
      </div>
      {state.loop && (
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={t.inLoop ?? false}
            onChange={(e) => patch((s) => (s.extraTracks[i].inLoop = e.target.checked))}
          />
          <span title="This track sits inside the balloon (past the throat) — it renders in the loop's ladder.">
            Inside the loop
          </span>
        </label>
      )}
    </>,
    { fn: () => patch((s) => s.extraTracks.splice(i, 1)), label: "Remove track" },
  );
}

/**
 * Everything on the module, as a list. This is where things that aren't spatial
 * live — a control point is a named group, not a shape, and a group needs a
 * tree. It's also how you add things until the tool palette lands (stage 2).
 */
function ObjectsList({
  state,
  selection,
  select,
  setTool,
  add,
}: {
  state: EditorState;
  selection: Selection | null;
  select: (s: Selection | null) => void;
  setTool: (t: CanvasTool) => void;
  add: {
    passingSiding: () => void;
    spur: () => void;
    crossover: () => void;
    turnout: () => void;
    crossing: () => void;
    controlPoint: () => void;
  };
}) {
  /** Corners are keyed by index, everything else by id — compare accordingly. */
  const on = (s: Selection) => {
    if (selection === null || selection.kind !== s.kind) return false;
    if (selection.kind === "corner" && s.kind === "corner") return selection.i === s.i;
    return "id" in selection && "id" in s && selection.id === s.id;
  };

  const row = (key: string, label: string, sel: Selection, sub?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => select(sel)}
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${
        on(sel) ? "bg-blue-50 font-medium text-blue-900" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="truncate">{label}</span>
      {sub && <span className="ml-auto shrink-0 text-gray-400">{sub}</span>}
    </button>
  );

  const canCrossover =
    !state.loop && (state.configA === "double" || state.configB === "double");

  return (
    <div className="mt-auto shrink-0 border-t border-gray-200 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Objects
      </h2>

      <Group title="Benchwork" count={state.outline.length}>
        {state.outline.length === 0 ? (
          <button
            type="button"
            onClick={() => setTool("benchwork")}
            className={addBtn}
          >
            Draw the benchwork
          </button>
        ) : (
          state.outline.map((_, i) => row(`c${i}`, `Corner ${i + 1}`, { kind: "corner", i }))
        )}
      </Group>

      <Group
        title="Track"
        count={state.extraTracks.length}
        actions={
          <>
            <button type="button" onClick={add.passingSiding} className={addBtn} title="Adds a switch at each end and control-point signals for both directions automatically.">
              + Siding
            </button>
            <button type="button" onClick={add.spur} className={addBtn}>
              + Spur
            </button>
            {canCrossover && (
              <button type="button" onClick={add.crossover} className={addBtn} title="A crossover between Main 1 and Main 2 — a turnout on each main joined by a diagonal.">
                + Crossover
              </button>
            )}
          </>
        }
      >
        {state.extraTracks.map((t) =>
          row(t.id, t.trackName || t.id, { kind: "track", id: t.id }, `${Math.abs(t.toPos - t.fromPos)}″`),
        )}
      </Group>

      <Group
        title="Turnouts"
        count={state.turnouts.length}
        actions={
          <button type="button" onClick={add.turnout} className={addBtn}>
            + Turnout
          </button>
        }
      >
        {state.turnouts.map((t) =>
          row(t.id, t.name || t.id, { kind: "turnout", id: t.id }, `${t.pos}″`),
        )}
      </Group>

      <Group
        title="Crossings"
        count={state.crossings.length}
        actions={
          <button type="button" onClick={add.crossing} className={addBtn}>
            + Crossing
          </button>
        }
      >
        {state.crossings.map((x) =>
          row(x.id, x.name || x.id, { kind: "crossing", id: x.id }, `${x.pos}″`),
        )}
      </Group>

      <Group
        title="Control points"
        count={state.controlPoints.length}
        actions={
          <button type="button" onClick={add.controlPoint} className={addBtn}>
            + CP
          </button>
        }
      >
        {state.controlPoints.map((c) =>
          row(
            c.id,
            c.name || c.id,
            { kind: "cp", id: c.id },
            `${c.signals.length} signal${c.signals.length === 1 ? "" : "s"}`,
          ),
        )}
      </Group>
    </div>
  );
}

function Group({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details open={count > 0} className="group mb-1">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded px-1 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
        <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
        {title}
        {count > 0 && (
          <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-600">
            {count}
          </span>
        )}
        {actions && <span className="ml-auto flex gap-1">{actions}</span>}
      </summary>
      <div className="ml-4 mt-0.5 space-y-0.5">{children}</div>
    </details>
  );
}
