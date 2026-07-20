"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  stateToDoc,
  buildTransition,
  buildCrossover,
  isTransitionTurnout,
  deriveEndplatePoses,
  poseNeedsManual,
  moduleFootprint,
  endplateTrackOffsetFor,
  checkEndplateWidth,
  nextId,
  inchesToScaleFeet,
  carCapacity,
  type BenchworkPoint,
  type EditorState,
  type TrackRole,
  type TurnoutKind,
  type SignalFacing,
  type IndustryLabelMode,
} from "@/lib/module-schematic";
import { SchematicPreview } from "./schematic-preview";
import {
  BenchworkEditor,
  type CanvasSelection,
  type CanvasTool,
  type CanvasIndustry,
} from "./benchwork-editor";
import {
  saveModuleSchematic,
  updateModuleDimensions,
  type ModuleDimensions,
} from "./actions";
import { submitCarTypeSuggestion } from "../../new/actions";

type CarTypeOption = { value: string; display_label: string };

/** A 40-ft N-scale car is ~3.3″ over the couplers — the length a car occupies
 * on a track. Capacity in cars reads truer than scale feet for a builder. */
const CAR_INCHES = 3.3;

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
    s.kind === "endplate" ||
    s.kind === "industry" ||
    s.kind === "cp");

export function SchematicEditor({
  moduleId,
  recordNumber,
  moduleName,
  initial,
  newModule = false,
  lockedConfigs = { a: false, b: false },
  geometries = [],
  industryTypes = [],
  carTypes = [],
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
  /** Industry type choices for the industry inspector. */
  industryTypes?: { value: string; display_label: string }[];
  /** Car type choices for the industry inspector's multiselect. */
  carTypes?: { value: string; display_label: string }[];
  /** The module's geometry + lengths — editable here, since they size the board. */
  initialDimensions: ModuleDimensions;
}) {
  const [state, setState] = useState<EditorState>(initial);
  /** What's selected — drives the one inspector on the right. */
  const [selection, setSelection] = useState<Selection | null>(null);
  /** What a canvas background click means. */
  const [tool, setTool] = useState<CanvasTool>("select");
  /** Draw-to-create: a track role armed from the + Track menu, waiting to be
   * drawn on the canvas (#51). null = not placing. */
  const [pendingTrack, setPendingTrack] = useState<"siding" | "spur" | null>(null);
  /** The frog number the Turnout (W) tool drops (#52). */
  const [turnoutSize, setTurnoutSize] = useState(6);
  /** Car-type choices, seeded from the server + grown by suggestions. */
  const [carTypeOptions, setCarTypeOptions] = useState<CarTypeOption[]>(carTypes);
  const addCarTypeOption = (o: CarTypeOption) =>
    setCarTypeOptions((prev) => (prev.some((c) => c.value === o.value) ? prev : [...prev, o]));
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
  const mainDrawn = state.mainPath.length >= 2;
  const footprint = useMemo(
    () =>
      moduleFootprint({
        lengthInches: state.lengthInches,
        geometryType: geometry.type,
        geometryDegrees: geometry.degrees,
        geometryOffsetInches: geometry.offset,
        endplateWidths: state.endplateWidths,
        // A double-track end centres its PLATE on the pair of tracks (Free-moN
        // §2.0: each track 9/16″ from the plate centre), not on Main 1 (#93).
        endplateTrackOffsets: {
          A: endplateTrackOffsetFor(state.configA),
          B: endplateTrackOffsetFor(state.configB),
        },
        outline: state.outline,
        mainPath: state.mainPath,
      }),
    [
      state.lengthInches,
      state.endplateWidths,
      state.configA,
      state.configB,
      state.outline,
      state.mainPath,
      geometry,
    ],
  );
  // When the mainline is drawn, BOTH endplates follow the track's tangent: A
  // faces back along the start tangent (outward = west for a straight), B sits
  // at the path's end facing the final tangent — so both endplate faces and the
  // layout joins follow the drawn shape (not just B).
  const poses = useMemo(() => {
    if (!mainDrawn) return derivedPoses;
    const c = footprint.centerline;
    if (c.length < 2) return derivedPoses;
    const deg = (dx: number, dy: number) => (Math.atan2(dy, dx) * 180) / Math.PI;
    const start = c[0];
    const startNext = c[1];
    const aHeading = deg(start.x - startNext.x, start.y - startNext.y); // outward
    const end = c[c.length - 1];
    const prev = c[c.length - 2];
    const bHeading = deg(end.x - prev.x, end.y - prev.y);
    return derivedPoses.map((p) =>
      p.id === "A"
        ? { ...p, x: start.x, y: start.y, heading: aHeading }
        : p.id === "B"
          ? { ...p, x: end.x, y: end.y, heading: bHeading }
          : p,
    );
  }, [mainDrawn, derivedPoses, footprint]);

  /** Everything except the main itself — the main IS the centre-line. */
  const canvasTracks = useMemo(() => {
    // Where each spur meets the main — the pos of the turnout diverging to it.
    const throatOf = new Map<string, number>();
    for (const tn of state.turnouts) if (tn.divergeTrack) throatOf.set(tn.divergeTrack, tn.pos);
    return (doc.tracks ?? [])
      .filter((t) => t.id !== MAIN_TRACK_ID)
      .map((t) => {
        const et = state.extraTracks.find((x) => x.id === t.id);
        return {
          id: t.id,
          lane: t.lane ?? 1,
          fromPos: t.fromPos ?? 0,
          toPos: t.toPos ?? state.lengthInches,
          // Sidings/spurs are the owner's to place; Main 2 is derived.
          editable: !!et,
          // Where the spur's throat snaps (its turnout on the main), + its
          // authored 2-D path when drawn (#2d-track stage C).
          throatPos: throatOf.get(t.id),
          path: et?.path,
        };
      });
  }, [doc, state.lengthInches, state.extraTracks, state.turnouts]);
  const canvasTurnouts = useMemo(
    () =>
      state.turnouts.map((t) => ({
        id: t.id,
        pos: t.pos,
        size: t.size,
        // The host track (main or a spur) + what it diverges to; the canvas
        // derives the frog geometry from these.
        onTrack: t.onTrack,
        divergeTrack: t.divergeTrack || undefined,
        curved: t.curved,
        kind: t.kind,
      })),
    [state.turnouts],
  );
  const canvasSignals = useMemo(
    () =>
      state.controlPoints.flatMap((cp) =>
        cp.signals.map((s) => ({
          id: s.id,
          cp: cp.id,
          pos: s.pos,
          side: s.side,
          facing: s.facing,
        })),
      ),
    [state.controlPoints],
  );
  /** Signal (S) tool: drop a block control point with one signal at `pos` on the
   * main, then select it to set direction/side in the inspector (#53). */
  const onDropSignal = (pos: number) => {
    const id = nextId("cp", state.controlPoints.map((c) => c.id));
    patch((s) => {
      s.controlPoints.push({
        id,
        name: "",
        turnouts: [],
        signals: [
          { id: `${id}-AtoB`, pos: Math.round(pos), track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
        ],
      });
    });
    setSelection({ kind: "cp", id });
  };
  /** Lane of any track id (mains fixed; extras by their record). */
  const laneOfTrack = useMemo(() => {
    const m = new Map<string, number>();
    m.set(MAIN_TRACK_ID, 0);
    m.set(MAIN2_TRACK_ID, 1);
    for (const t of state.extraTracks) m.set(t.id, t.lane);
    return m;
  }, [state.extraTracks]);
  const canvasIndustries = useMemo<CanvasIndustry[]>(
    () =>
      state.industries.flatMap((ind) => {
        // One render span per spot: the primary track + any house-track spots.
        const spot = (
          id: string,
          track: string,
          fromPos: number,
          toPos: number,
          side: "above" | "below",
          editable: boolean,
        ): CanvasIndustry => {
          const cars = carCapacity(fromPos, toPos);
          const sub =
            ind.labelMode === "cars"
              ? `${cars} cars`
              : ind.labelMode === "inches"
                ? `${Math.round(Math.abs(toPos - fromPos))}″`
                : "";
          return {
            id,
            industryId: ind.id,
            editable,
            lane: laneOfTrack.get(track) ?? 0,
            fromPos,
            toPos,
            side,
            name: ind.name,
            sub,
          };
        };
        return [
          spot(ind.id, ind.track, ind.fromPos, ind.toPos, ind.side, true),
          ...(ind.spots ?? []).map((sp, i) =>
            spot(`${ind.id}#${i}`, sp.track, sp.fromPos, sp.toPos, sp.side ?? ind.side, false),
          ),
        ];
      }),
    [state.industries, laneOfTrack],
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

  // --- Draw-to-create sidings & spurs (#51) ---------------------------------
  // Picking Siding/Spur from the + Track menu no longer drops a track at a
  // default spot — it arms placement and the canvas captures the draw, which
  // calls onPlaceTrack below with the drawn geometry.
  function armSiding() {
    setPendingTrack("siding");
    setTool("track");
  }
  function armSpur() {
    setPendingTrack("spur");
    setTool("track");
  }
  const nextLane = (s: EditorState) => {
    // Lane 1 is Main 2 on a double module; first free lane is above it.
    const base = s.configA === "double" || s.configB === "double" ? 2 : 1;
    return Math.max(base, ...s.extraTracks.map((t) => t.lane + 1));
  };
  /** A spur / yard lead diverging from `throatTurnoutId`, drawn out to a stub. */
  function placeSpur(
    throatTurnoutId: string,
    fromPos: number,
    toPos: number,
    path: BenchworkPoint[],
  ) {
    const id = nextId("spur", state.extraTracks.map((t) => t.id));
    patch((s) => {
      s.extraTracks.push({
        id,
        role: "spur",
        lane: nextLane(s),
        fromPos,
        toPos,
        ...(path.length >= 2 ? { path } : {}),
        moduleTrackId: null,
        trackName: "",
      });
      // Link the throat turnout to the new spur so it reads (and snaps) as one.
      const tn = s.turnouts.find((t) => t.id === throatTurnoutId);
      if (tn) tn.divergeTrack = id;
    });
    // Select it so the Track tool edits the new spur (not the mainline) next.
    setSelection({ kind: "track", id });
  }
  /** A passing siding drawn between two already-placed turnouts. */
  function placeSiding(
    fromTurnoutId: string,
    toTurnoutId: string,
    fromPos: number,
    toPos: number,
  ) {
    const id = nextId("sid", state.extraTracks.map((t) => t.id));
    patch((s) => {
      s.extraTracks.push({
        id,
        role: "siding",
        lane: nextLane(s),
        fromPos,
        toPos,
        moduleTrackId: null,
        trackName: "Passing siding",
      });
      // Both turnouts now diverge to this siding.
      for (const t of s.turnouts)
        if (t.id === fromTurnoutId || t.id === toTurnoutId) t.divergeTrack = id;
    });
    setSelection({ kind: "track", id });
  }
  const onPlaceTrack = (
    p:
      | {
          role: "spur";
          throatTurnoutId: string;
          fromPos: number;
          toPos: number;
          path?: BenchworkPoint[];
        }
      | {
          role: "siding";
          fromTurnoutId: string;
          toTurnoutId: string;
          fromPos: number;
          toPos: number;
        },
  ) => {
    if (p.role === "siding") placeSiding(p.fromTurnoutId, p.toTurnoutId, p.fromPos, p.toPos);
    else placeSpur(p.throatTurnoutId, p.fromPos, p.toPos, p.path ?? []);
    setPendingTrack(null);
  };
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
        size: turnoutSize,
      });
    });
  }
  /** Turnout (W) tool: drop a turnout of a chosen hand at `pos` on a track, and
   * give it a short diverging spur stub straight away (#turnout-palette). The
   * turnout is a point placement — no drag-length — and the stub is positioned by
   * its `toPos`, so dragging its ○ end to size it can't shift what you dropped
   * (the old draw-to-create re-projected the drawn end and changed the length).
   * The stub is selected so its end handle is right there to pull out. */
  const onDropTurnout = (
    spec: { kind: TurnoutKind; curved?: boolean },
    onTrack: string,
    pos: number,
  ) => {
    const swId = nextId("sw", state.turnouts.map((t) => t.id));
    const spId = nextId("spur", state.extraTracks.map((t) => t.id));
    const p = Math.round(pos * 10) / 10;
    // A short default the owner extends — ~12% of the board, at least 6″, and
    // never past the far endplate.
    const stub =
      Math.round(Math.max(6, Math.min(state.lengthInches - p, state.lengthInches * 0.12)) * 10) /
      10;
    patch((s) => {
      s.extraTracks.push({
        id: spId,
        role: "spur",
        lane: nextLane(s),
        fromPos: p,
        toPos: Math.min(s.lengthInches, p + stub),
        moduleTrackId: null,
        trackName: "",
      });
      s.turnouts.push({
        id: swId,
        name: "",
        pos: p,
        onTrack,
        divergeTrack: spId,
        kind: spec.kind,
        size: turnoutSize,
        ...(spec.curved ? { curved: true } : {}),
      });
    });
    // Select the stub — its end ○ is now the thing to drag to length.
    setSelection({ kind: "track", id: spId });
  };
  /** Crossover drop (#turnout-palette): a self-contained element between the
   * main and a parallel lane — a turnout on each end + the diagonal connector(s)
   * (double = scissors). A plain parallel track already covering the span on
   * that side is reused (a siding, say); otherwise a short parallel stub is
   * created for the owner to draw out to length. The connector carries an
   * authored 2-pt path (host end → parallel end) so the canvas renders the
   * diagonal and the leg walks the right way for both slants. */
  const onDropCrossover = (p: {
    hand?: "left" | "right";
    double?: boolean;
    side: 1 | -1;
    posA: number;
    posB: number;
    hostA: BenchworkPoint;
    hostB: BenchworkPoint;
    parA: BenchworkPoint;
    parB: BenchworkPoint;
  }) => {
    const lane = p.side;
    const existing = state.extraTracks.find(
      (t) =>
        t.lane === lane &&
        !(t.path && t.path.length >= 2) &&
        t.fromPos <= p.posA &&
        t.toPos >= p.posB,
    );
    const ids = state.extraTracks.map((t) => t.id);
    const parId = existing?.id ?? nextId("sid", ids);
    const xoA = nextId("xo", [...ids, parId]);
    const xoB = nextId("xo", [...ids, parId, xoA]);
    const swIds = state.turnouts.map((t) => t.id);
    const sw1 = nextId("sw", swIds);
    const sw2 = nextId("sw", [...swIds, sw1]);
    const sw3 = nextId("sw", [...swIds, sw1, sw2]);
    const sw4 = nextId("sw", [...swIds, sw1, sw2, sw3]);
    // Turnout positions are ABSOLUTE (inches from A) everywhere — the canvas
    // converts to host-relative when sampling the parallel track's polyline.
    const stubFrom = existing ? existing.fromPos : Math.max(0, Math.round((p.posA - 6) * 10) / 10);
    // The hand is the way the diagonal throws facing B: diverging left with the
    // parallel above means the diagonal runs forward; below, backward.
    const forward = p.double ? true : (p.side > 0) === (p.hand === "left");
    const opp = (k: TurnoutKind): TurnoutKind => (k === "left" ? "right" : "left");
    patch((s) => {
      if (!existing) {
        s.extraTracks.push({
          id: parId,
          role: "siding",
          lane,
          fromPos: stubFrom,
          toPos: Math.min(s.lengthInches, Math.round((p.posB + 6) * 10) / 10),
          moduleTrackId: null,
          trackName: "",
        });
      }
      const conn = (id: string, fwd: boolean) =>
        s.extraTracks.push({
          id,
          role: "crossover",
          lane,
          fromPos: p.posA,
          toPos: p.posB,
          path: fwd ? [p.hostA, p.parB] : [p.hostB, p.parA],
          moduleTrackId: null,
          trackName: "Crossover",
        });
      const swp = (id: string, pos: number, onTrack: string, diverge: string, kind: TurnoutKind) =>
        s.turnouts.push({ id, name: "Crossover", pos, onTrack, divergeTrack: diverge, kind, size: turnoutSize });
      if (p.double) {
        conn(xoA, true);
        conn(xoB, false);
        // Host-side turnout FIRST per connector — the canvas draws its leg.
        swp(sw1, p.posA, MAIN_TRACK_ID, xoA, p.side > 0 ? "left" : "right");
        swp(sw2, p.posB, parId, xoA, p.side > 0 ? "right" : "left");
        swp(sw3, p.posB, MAIN_TRACK_ID, xoB, p.side > 0 ? "right" : "left");
        swp(sw4, p.posA, parId, xoB, p.side > 0 ? "left" : "right");
      } else {
        conn(xoA, forward);
        const hand = p.hand ?? "left";
        swp(sw1, forward ? p.posA : p.posB, MAIN_TRACK_ID, xoA, hand);
        swp(sw2, forward ? p.posB : p.posA, parId, xoA, opp(hand));
      }
    });
    // Select the parallel track — its ends are what the owner draws out next.
    setSelection({ kind: "track", id: parId });
  };
  /** Joined tracks become ONE track (#track-end-snap). When a track-end drag is
   * released with its end abutting another same-lane track's end (the snap made
   * them meet exactly), merge: the dragged track absorbs the other — union span,
   * every reference (turnouts, industries, crossings, signals) re-pointed — and
   * the other record is removed. Spurs (throat-directional) and crossover
   * connectors are never merged. */
  const mergeAbutting = (id: string) => {
    let select: { kind: "track"; id: string } | null = null;
    patch((s) => {
      /** Re-point every reference from one track id to another. */
      const repoint = (from: string, to: string) => {
        for (const sw of s.turnouts) {
          if (sw.onTrack === from) sw.onTrack = to;
          if (sw.divergeTrack === from) sw.divergeTrack = to;
        }
        for (const ind of s.industries) {
          if (ind.track === from) ind.track = to;
          for (const sp of ind.spots) if (sp.track === from) sp.track = to;
        }
        for (const x of s.crossings) {
          if (x.trackA === from) x.trackA = to;
          if (x.trackB === from) x.trackB = to;
        }
        for (const cp of s.controlPoints)
          for (const sig of cp.signals) if (sig.track === from) sig.track = to;
      };
      const plain = (t: (typeof s.extraTracks)[number]) =>
        !(t.path && t.path.length >= 2) && t.role !== "spur" && t.role !== "crossover";
      const A = s.extraTracks.find((t) => t.id === id);
      if (!A || !plain(A)) return;
      // ---- Merge: joined tracks become ONE track ------------------------------
      const eps = 0.05;
      const B = s.extraTracks.find(
        (t) =>
          t.id !== A.id &&
          t.lane === A.lane &&
          plain(t) &&
          [t.fromPos, t.toPos].some(
            (e) => Math.abs(e - A.fromPos) < eps || Math.abs(e - A.toPos) < eps,
          ),
      );
      if (B) {
        const lo = Math.min(A.fromPos, A.toPos, B.fromPos, B.toPos);
        const hi = Math.max(A.fromPos, A.toPos, B.fromPos, B.toPos);
        A.fromPos = Math.round(lo * 10) / 10;
        A.toPos = Math.round(hi * 10) / 10;
        if (!A.trackName && B.trackName) A.trackName = B.trackName;
        // Keep the DB row linkage if the survivor doesn't have one yet.
        if (A.moduleTrackId == null && B.moduleTrackId != null) A.moduleTrackId = B.moduleTrackId;
        repoint(B.id, A.id);
        s.extraTracks.splice(s.extraTracks.findIndex((t) => t.id === B.id), 1);
      }
      select = { kind: "track", id: A.id };
      // ---- Endplate contact: a track ON a plate = a DOUBLE-TRACK plate --------
      // (FD snaps modules by endplate config, so the config must follow the
      // geometry.) The track becomes Main 2: both plates touched → full double;
      // one plate → a transition module, with the End-of-Double-Track turnout +
      // control point at the drawn track's inner end.
      if (A.lane !== 1 || s.loop) return;
      if (s.configA === "double" || s.configB === "double") return;
      const plateEps = 0.5;
      const lo2 = Math.min(A.fromPos, A.toPos);
      const hi2 = Math.max(A.fromPos, A.toPos);
      const touchesA = lo2 <= plateEps;
      const touchesB = hi2 >= s.lengthInches - plateEps;
      if (!touchesA && !touchesB) return;
      // Endplate records are authoritative — never override a locked config.
      if ((touchesA && lockedConfigs.a) || (touchesB && lockedConfigs.b)) return;
      repoint(A.id, MAIN2_TRACK_ID);
      s.extraTracks.splice(s.extraTracks.findIndex((t) => t.id === A.id), 1);
      select = null;
      if (touchesA) s.configA = "double";
      if (touchesB) s.configB = "double";
      if (touchesA !== touchesB) {
        // Transition module: Main 2 ends where the drawn track ended.
        const p = Math.round((touchesA ? hi2 : lo2) * 10) / 10;
        const swId = nextId("sw", s.turnouts.map((x) => x.id));
        s.turnouts.push({
          id: swId,
          name: "End of Double Track",
          pos: p,
          onTrack: MAIN2_TRACK_ID,
          divergeTrack: MAIN_TRACK_ID,
          kind: touchesA ? "left" : "right",
          size: turnoutSize,
        });
        const cpId = nextId("cp", s.controlPoints.map((c) => c.id));
        s.controlPoints.push({
          id: cpId,
          name: "End of Double Track",
          turnouts: [swId],
          signals: [
            { id: `${cpId}-AtoB`, pos: p, track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
            { id: `${cpId}-BtoA`, pos: p, track: MAIN_TRACK_ID, facing: "BtoA", side: "below" },
          ],
        });
      }
    });
    setSelection(select);
  };
  /** Completing the double: an End-of-Double-Track turnout dragged onto the
   * single end's plate means the double now spans the module — flip that plate
   * to double and retire the transition (turnout + its control point). */
  const onTurnoutDrop = (id: string) => {
    patch((s) => {
      const sw = s.turnouts.find((x) => x.id === id);
      if (!sw || !isTransitionTurnout(sw) || s.loop) return;
      const aD = s.configA === "double";
      const bD = s.configB === "double";
      if (aD === bD) return; // not a transition module
      const eps = 0.5;
      const atFarPlate = aD ? sw.pos >= s.lengthInches - eps : sw.pos <= eps;
      if (!atFarPlate) return;
      if (aD ? lockedConfigs.b : lockedConfigs.a) return;
      if (aD) s.configB = "double";
      else s.configA = "double";
      s.turnouts.splice(s.turnouts.findIndex((x) => x.id === sw.id), 1);
      for (const cp of s.controlPoints) cp.turnouts = cp.turnouts.filter((t) => t !== id);
      const cpi = s.controlPoints.findIndex(
        (cp) => cp.name === "End of Double Track" && cp.turnouts.length === 0,
      );
      if (cpi >= 0) s.controlPoints.splice(cpi, 1);
    });
  };
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
  function addIndustry() {
    patch((s) => {
      const spur = s.extraTracks.find((t) => t.role === "spur") ?? s.extraTracks[0];
      const track = spur?.id ?? MAIN_TRACK_ID;
      const from = spur ? spur.fromPos : Math.round(s.lengthInches * 0.35);
      const to = spur ? spur.toPos : Math.round(s.lengthInches * 0.6);
      s.industries.push({
        id: nextId("ind", s.industries.map((i) => i.id)),
        name: "",
        type: "",
        track,
        fromPos: from,
        toPos: to,
        spots: [],
        side: "below",
        labelMode: "none",
        carTypes: [],
        moduleIndustryId: null,
      });
    });
  }
  /** Place an industry where the Industry tool was clicked, then edit it. */
  function addIndustryAt(track: string, pos: number) {
    const id = nextId("ind", state.industries.map((i) => i.id));
    const half = Math.max(6, Math.round(state.lengthInches * 0.08));
    patch((s) => {
      s.industries.push({
        id,
        name: "",
        type: "",
        track,
        fromPos: Math.max(0, Math.round(pos - half)),
        toPos: Math.min(s.lengthInches, Math.round(pos + half)),
        spots: [],
        side: "below",
        labelMode: "none",
        carTypes: [],
        moduleIndustryId: null,
      });
    });
    setSelection({ kind: "industry", id });
    setTool("select");
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
    if (
      !window.confirm(
        "Clear the whole schematic — outline, track, turnouts, signals, industries?",
      )
    )
      return;
    patch((s) => {
      s.outline = [];
      s.mainPath = [];
      s.extraTracks = [];
      s.turnouts = [];
      s.crossings = [];
      s.branches = [];
      s.controlPoints = [];
      s.industries = [];
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
        else if (e.key === "t" || e.key === "T") setTool("track");
        else if (e.key === "w" || e.key === "W") setTool("turnout");
        else if (e.key === "s" || e.key === "S") setTool("signal");
        else if (e.key === "i" || e.key === "I") setTool("industry");
        else if (e.key === "Escape") {
          setSelection(null);
          setPendingTrack(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Seed a rectangular board the first time a brand-new module opens, so the
  // canvas starts as a real board (not an empty SVG with a button). Autosave
  // persists it; the owner can reshape or undo it.
  const seeded = useRef(false);
  useEffect(() => {
    if (!newModule || seeded.current) return;
    if (state.outline.length > 0 || state.lengthInches <= 0) return;
    seeded.current = true;
    const L = state.lengthInches;
    const d = 24;
    // Defer out of the effect body: this is a persisted edit (autosave picks it
    // up), not render-synchronous state React should batch.
    queueMicrotask(() =>
      patch((s) => {
        s.outline = [
          { x: 0, y: -d / 2 },
          { x: L, y: -d / 2 },
          { x: L, y: d / 2 },
          { x: 0, y: d / 2 },
        ];
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared "+ Track" wiring — used both on the Track drawing tool (canvas
  // context bar) and in the Objects list.
  const trackAdd = {
    passingSiding: armSiding,
    spur: armSpur,
    crossover: addCrossover,
    mainline: (config: "single" | "double") =>
      patch((s) => {
        s.configA = config;
        if (s.configB !== "none") s.configB = config;
      }),
  };
  const canCrossover =
    !state.loop && (state.configA === "double" || state.configB === "double");
  const trackMenu = (
    <AddTrackMenu
      add={trackAdd}
      mainlineDouble={isDouble}
      mainlineLocked={lockedConfigs.a || lockedConfigs.b}
      canCrossover={canCrossover}
      turnoutCount={state.turnouts.length}
      align="left"
    />
  );

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
          {/* Autosave already runs ~1s after a change; this Save flushes it now
              for anyone who wants to save explicitly (or retry after an error). */}
          <button
            type="button"
            onClick={() => void runSave()}
            disabled={saveState === "saved" || saveState === "saving"}
            title="Save now (changes also autosave)"
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save
          </button>
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
                poses={poses}
                mainPath={state.mainPath}
                onMainPathChange={(next) => patch((s) => (s.mainPath = next))}
                endplateWidths={state.endplateWidths}
                centerline={footprint.centerline}
                sectionBreaks={state.sectionBreaks}
                tracks={canvasTracks}
                turnouts={canvasTurnouts}
                signals={canvasSignals}
                industries={canvasIndustries}
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
                onIndustryEndMove={(id, end, pos) =>
                  patch((s) => {
                    const ind = s.industries.find((x) => x.id === id);
                    if (!ind) return;
                    if (end === "from") ind.fromPos = pos;
                    else ind.toPos = pos;
                  })
                }
                onAddIndustry={addIndustryAt}
                trackMenu={trackMenu}
                pendingTrack={pendingTrack}
                onPlaceTrack={onPlaceTrack}
                onCancelPlace={() => setPendingTrack(null)}
                onDropTurnout={onDropTurnout}
                onDropCrossover={onDropCrossover}
                onDropSignal={onDropSignal}
                onTrackEndDrop={mergeAbutting}
                onTurnoutDrop={onTurnoutDrop}
                turnoutSize={turnoutSize}
                onTurnoutSizeChange={setTurnoutSize}
                onTrackPathChange={(id, path) =>
                  patch((s) => {
                    const t = s.extraTracks.find((x) => x.id === id);
                    if (t) t.path = path.length >= 2 ? path : undefined;
                  })
                }
                selection={isCanvasSel(selection) ? selection : null}
                onSelect={setSelection}
              />
            </div>
          </div>
          <DispatcherStrip
            doc={doc}
            highlightId={
              selection &&
              (selection.kind === "turnout" ||
                selection.kind === "track" ||
                selection.kind === "crossing")
                ? selection.id
                : null
            }
          />
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
            industryTypes={industryTypes}
            carTypes={carTypeOptions}
            onCarTypeSuggested={addCarTypeOption}
          />
          <ObjectsList
            state={state}
            selection={selection}
            select={setSelection}
            setTool={setTool}
            add={{
              ...trackAdd,
              turnout: addTurnout,
              crossing: addCrossing,
              controlPoint: addControlPoint,
              industry: addIndustry,
            }}
            mainlineDouble={isDouble}
            mainlineLocked={lockedConfigs.a || lockedConfigs.b}
          />
        </aside>
      </div>
    </div>
  );
}

/** The tools that decide what a canvas click means. Select and Benchwork are
 * live; the rest are placeholders for later stages (drawn track, signals…) so
 * the rail's shape is settled. Each has a single-key shortcut. */
type RailTool = {
  id?: CanvasTool;
  key: string;
  label: string;
  glyph: string;
  hint: string;
  soon?: boolean;
};

// Grouped so the rail reads in sections: the pointer, then everything you draw
// on the board (board → main → sidings → turnouts → signals), then the
// operations overlay. Turnouts and signals sit with the track tools, not below
// Industry. Dividers separate the groups.
const TOOL_GROUPS: RailTool[][] = [
  [{ id: "select", key: "V", label: "Select", glyph: "▶", hint: "Select & move (V)" }],
  [
    { id: "benchwork", key: "B", label: "Benchwork", glyph: "▱", hint: "Draw the board outline (B)" },
    { id: "track", key: "T", label: "Track", glyph: "═", hint: "Draw the mainline · bend a siding or spur (T)" },
    { id: "turnout", key: "W", label: "Turnout", glyph: "⋋", hint: "Drop a turnout on the main (W)" },
    { id: "signal", key: "S", label: "Signal", glyph: "⚑", hint: "Drop a signal / control point on the main (S)" },
  ],
  [{ id: "industry", key: "I", label: "Industry", glyph: "▢", hint: "Place an industry on a track (I)" }],
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
      {TOOL_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <div className="my-1 h-px w-6 bg-gray-200" />}
          {group.map((t) => {
            if (t.soon || !t.id) {
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled
                  title={t.hint}
                  className="flex h-9 w-9 cursor-not-allowed flex-col items-center justify-center rounded-md text-base leading-none text-gray-300"
                >
                  <span>{t.glyph}</span>
                  <span className="mt-0.5 text-[9px] font-medium">{t.key}</span>
                </button>
              );
            }
            const on = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id!)}
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
        </Fragment>
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
function DispatcherStrip({
  doc,
  highlightId,
}: {
  doc: ReturnType<typeof stateToDoc>;
  highlightId: string | null;
}) {
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
          <SchematicPreview doc={doc} highlightId={highlightId} />
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
    id: "industries",
    label: "Industries",
    hint: (s) =>
      s.industries.length
        ? `${s.industries.length} industr${s.industries.length === 1 ? "y" : "ies"}`
        : "none placed",
    // Optional: a module may legitimately have no industries, so "done" once
    // there's track to place them on (never blocks completion).
    done: (s) => s.industries.length > 0 || s.extraTracks.length === 0,
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
  industryTypes,
  carTypes,
  onCarTypeSuggested,
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
  industryTypes: { value: string; display_label: string }[];
  carTypes: { value: string; display_label: string }[];
  onCarTypeSuggested: (o: { value: string; display_label: string }) => void;
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
          <label className="block text-xs font-medium text-gray-600">
            Footprint length (in)
            <input
              type="number"
              step={0.001}
              value={dims.length_total_inches}
              onChange={(e) => setDim({ length_total_inches: e.target.value })}
              className={`mt-0.5 ${inp}`}
              title="The physical length of the board. Draw the mainline (M) if the rail runs a different distance than the board."
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Sections
            <input
              type="number"
              min={1}
              max={12}
              step={1}
              value={state.sectionBreaks.length + 1}
              onChange={(e) => {
                const n = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
                patch((s) => {
                  const L = s.lengthInches;
                  s.sectionBreaks = Array.from({ length: n - 1 }, (_, i) =>
                    Math.round((L * (i + 1)) / n),
                  );
                });
              }}
              className={`mt-0.5 ${inp}`}
              title="How many bench-work sections the module is built from. The joints are marked on the board; the module still operates as one unit."
            />
          </label>
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
          {/* Which main draws above. MR puts Main 1 on the centre line by
              default, but on some modules the UPPER track is the through/
              primary main (#FMN-0043) — swap the drawn positions. */}
          {(state.configA === "double" || state.configB === "double") && (
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={state.mainsSwapped ?? false}
                onChange={(e) => patch((s) => (s.mainsSwapped = e.target.checked))}
              />
              <span>
                <span className="font-medium">Swap Main 1 / Main 2 positions</span> —
                draw Main 1 above and Main 2 on the centre line, for a module whose
                upper track is the primary main. Names and everything attached stay
                put; only where they&rsquo;re drawn changes.
              </span>
            </label>
          )}
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
            this end. Free-moN §1.1 requires a 12″ minimum (24″ is our common
            default, not a standard), and §2.0 requires every track crossing to
            clear either fascia by 4″ — both checked below. */}
        <label className="block text-xs font-medium text-gray-600">
          Face width (in)
          <input
            type="number"
            min={12}
            step={0.5}
            value={state.endplateWidths[id] ?? 24}
            onChange={(e) => setEndplateWidth(id, e.target.value)}
            className={`mt-0.5 ${inp}`}
            title="Free-moN §1.1: endplates shall be a minimum 12 in wide. Track must also clear either fascia by 4 in (§2.0)."
          />
        </label>
        {checkEndplateWidth({
          widthInches: state.endplateWidths[id],
          config: id === "A" ? state.configA : id === "B" ? state.configB : "single",
        }).map((issue) => (
          <p
            key={issue.code}
            className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800"
            role="status"
          >
            ⚠ {issue.message}
          </p>
        ))}

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
        <div className="grid grid-cols-2 gap-2">
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
          <label className="block text-xs font-medium text-gray-600">
            Turnout # (size)
            <select
              value={t.size ?? 6}
              onChange={(e) => patch((s) => (s.turnouts[i].size = Number(e.target.value)))}
              className={`mt-0.5 ${inp}`}
              title="Frog number — governs the diverging angle."
            >
              {[4, 5, 6, 7, 8, 10].map((n) => (
                <option key={n} value={n}>#{n}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={!!t.curved}
            onChange={(e) =>
              patch((s) => (s.turnouts[i].curved = e.target.checked || undefined))
            }
          />
          Curved — the diverging leg bows into an arc
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

  // ---- Industry ----
  if (selection.kind === "industry") {
    const idx = state.industries.findIndex((x) => x.id === selection.id);
    if (idx < 0) return null;
    const ind = state.industries[idx];
    const up = (fn: (x: EditorState["industries"][number]) => void) =>
      patch((s) => fn(s.industries[idx]));
    const cars =
      carCapacity(ind.fromPos, ind.toPos) +
      ind.spots.reduce((n, sp) => n + carCapacity(sp.fromPos, sp.toPos), 0);
    return shell(
      `Industry · ${ind.name || "unnamed"}`,
      <>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={ind.name}
            onChange={(e) => up((x) => (x.name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="e.g. Ace Feed & Grain"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Type
          <select
            value={ind.type}
            onChange={(e) => up((x) => (x.type = e.target.value))}
            className={`mt-0.5 ${inp}`}
          >
            <option value="">—</option>
            {industryTypes.map((o) => (
              <option key={o.value} value={o.value}>{o.display_label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          On track
          <select
            value={ind.track}
            onChange={(e) => up((x) => (x.track = e.target.value))}
            className={`mt-0.5 ${inp}`}
          >
            {trackOptions.map((o) => (
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
              value={ind.fromPos}
              onChange={(e) => up((x) => (x.fromPos = Number(e.target.value)))}
              className={`mt-0.5 ${inp}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Ends (in from A)
            <input
              type="number"
              step={0.5}
              value={ind.toPos}
              onChange={(e) => up((x) => (x.toPos = Number(e.target.value)))}
              className={`mt-0.5 ${inp}`}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Side
            <select
              value={ind.side}
              onChange={(e) => up((x) => (x.side = e.target.value as "above" | "below"))}
              className={`mt-0.5 ${inp}`}
            >
              <option value="above">Above track</option>
              <option value="below">Below track</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Capacity
            <div className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`} title="Total across all this industry's tracks.">
              {cars} cars
            </div>
          </label>
        </div>
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">House-track spots</span>
            <button
              type="button"
              onClick={() =>
                up((x) => {
                  const t = state.extraTracks[0]?.id ?? ind.track;
                  x.spots = [
                    ...x.spots,
                    {
                      track: t,
                      fromPos: Math.round(state.lengthInches * 0.4),
                      toPos: Math.round(state.lengthInches * 0.5),
                      side: x.side,
                    },
                  ];
                })
              }
              className={addBtn}
            >
              + Add track
            </button>
          </div>
          {ind.spots.length === 0 ? (
            <p className="mt-1 text-xs font-normal text-gray-400">
              Served by one track. Add a track to spot cars on a house track&rsquo;s
              other tracks too.
            </p>
          ) : (
            <div className="mt-1 space-y-2">
              {ind.spots.map((sp, si) => (
                <div key={si} className="space-y-1 rounded-md border border-gray-200 p-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={sp.track}
                      onChange={(e) => up((x) => (x.spots[si].track = e.target.value))}
                      className={`${inp} text-xs`}
                    >
                      {trackOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => up((x) => x.spots.splice(si, 1))}
                      className="shrink-0 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step={0.5}
                      value={sp.fromPos}
                      onChange={(e) => up((x) => (x.spots[si].fromPos = Number(e.target.value)))}
                      className={`${inp} text-xs`}
                      title="Starts (in from A)"
                    />
                    <input
                      type="number"
                      step={0.5}
                      value={sp.toPos}
                      onChange={(e) => up((x) => (x.spots[si].toPos = Number(e.target.value)))}
                      className={`${inp} text-xs`}
                      title="Ends (in from A)"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="block text-xs font-medium text-gray-600">
          Label on canvas
          <select
            value={ind.labelMode}
            onChange={(e) => up((x) => (x.labelMode = e.target.value as IndustryLabelMode))}
            className={`mt-0.5 ${inp}`}
          >
            <option value="none">Name only</option>
            <option value="cars">Name + car count</option>
            <option value="inches">Name + length</option>
          </select>
        </label>
        <div className="text-xs font-medium text-gray-600">
          Cars received
          {carTypes.length === 0 ? (
            <p className="mt-0.5 font-normal text-gray-400">No car types available.</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1">
              {carTypes.map((ct) => {
                const on = ind.carTypes.includes(ct.value);
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() =>
                      up((x) => {
                        x.carTypes = on
                          ? x.carTypes.filter((v) => v !== ct.value)
                          : [...x.carTypes, ct.value];
                      })
                    }
                    className={`rounded-full border px-2 py-0.5 text-xs font-normal transition ${
                      on
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {ct.display_label}
                  </button>
                );
              })}
            </div>
          )}
          <CarTypeSuggest
            onSuggested={(o) => {
              onCarTypeSuggested(o);
              up((x) => {
                if (!x.carTypes.includes(o.value)) x.carTypes = [...x.carTypes, o.value];
              });
            }}
          />
        </div>
      </>,
      { fn: () => patch((s) => s.industries.splice(idx, 1)), label: "Remove industry" },
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
          Capacity
          <div className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`} title="Derived from the drawn length — not typed.">
            {Math.floor(Math.abs(t.toPos - t.fromPos) / CAR_INCHES)} cars ·{" "}
            {Math.round(inchesToScaleFeet(Math.abs(t.toPos - t.fromPos)))} ft
          </div>
        </label>
      </div>
      {/* Promote a parallel lane-1 track to MAIN 2 — the module becomes double
          track (both endplates), Main 2 runs endplate to endplate, and
          everything attached to this track moves onto it (#double-mainline). */}
      {t.lane === 1 &&
        !(t.path && t.path.length >= 2) &&
        t.role !== "spur" &&
        t.role !== "crossover" &&
        state.configA !== "double" &&
        state.configB !== "double" &&
        !state.loop &&
        !lockedConfigs.a &&
        !lockedConfigs.b && (
          <button
            type="button"
            onClick={() => {
              patch((s) => {
                const tr = s.extraTracks.find((x) => x.id === t.id);
                if (!tr) return;
                s.configA = "double";
                s.configB = "double";
                for (const sw of s.turnouts) {
                  if (sw.onTrack === tr.id) sw.onTrack = MAIN2_TRACK_ID;
                  if (sw.divergeTrack === tr.id) sw.divergeTrack = MAIN2_TRACK_ID;
                }
                for (const ind of s.industries) {
                  if (ind.track === tr.id) ind.track = MAIN2_TRACK_ID;
                  for (const sp of ind.spots) if (sp.track === tr.id) sp.track = MAIN2_TRACK_ID;
                }
                for (const x of s.crossings) {
                  if (x.trackA === tr.id) x.trackA = MAIN2_TRACK_ID;
                  if (x.trackB === tr.id) x.trackB = MAIN2_TRACK_ID;
                }
                for (const cp of s.controlPoints)
                  for (const sig of cp.signals) if (sig.track === tr.id) sig.track = MAIN2_TRACK_ID;
                s.extraTracks.splice(s.extraTracks.findIndex((x) => x.id === tr.id), 1);
              });
              select(null);
            }}
            className="w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            title="Both endplates become double-track; Main 2 runs endplate to endplate, and everything on this track (turnouts, industries, signals) moves onto it."
          >
            Make this the second main (double mainline)
          </button>
        )}
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

/** Suggest a car type that isn't in the list yet (admin-reviewed, usable now). */
function CarTypeSuggest({
  onSuggested,
}: {
  onSuggested: (o: { value: string; display_label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-blue-600 hover:underline"
      >
        Don&rsquo;t see it? Suggest a car type…
      </button>
    );
  }
  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await submitCarTypeSuggestion(value, label, "");
      if (r.ok) {
        onSuggested(r.option);
        setOpen(false);
        setValue("");
        setLabel("");
      } else {
        setErr(r.message);
      }
    });
  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      {err && <p className="mb-1 text-xs text-red-700">{err}</p>}
      <input
        className={inp}
        placeholder="value (e.g. wood_chip_car)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input
        className={`${inp} mt-1`}
        placeholder="Label (e.g. Wood Chip Car)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim() || !label.trim()}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Suggest"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Everything on the module, as a list. This is where things that aren't spatial
 * live — a control point is a named group, not a shape, and a group needs a
 * tree. It's also how you add things until the tool palette lands (stage 2).
 */
/** The unified "add track" menu: the mainline's single/double config, plus
 * adding a siding or a spur/yard (and a crossover on a double main). */
function AddTrackMenu({
  add,
  mainlineDouble,
  mainlineLocked,
  canCrossover,
  turnoutCount,
  align = "right",
}: {
  add: {
    passingSiding: () => void;
    spur: () => void;
    crossover: () => void;
    mainline: (config: "single" | "double") => void;
  };
  mainlineDouble: boolean;
  mainlineLocked: boolean;
  canCrossover: boolean;
  turnoutCount: number;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={addBtn}>
        + Track ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${align === "left" ? "left-0" : "right-0"}`}>
            <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Mainline
            </div>
            <button type="button" className={item} disabled={mainlineLocked} onClick={() => run(() => add.mainline("single"))}>
              <span className="w-3 text-blue-600">{!mainlineDouble ? "●" : "○"}</span> Single track
            </button>
            <button type="button" className={item} disabled={mainlineLocked} onClick={() => run(() => add.mainline("double"))}>
              <span className="w-3 text-blue-600">{mainlineDouble ? "●" : "○"}</span> Double track
            </button>
            {mainlineLocked && (
              <div className="px-2 py-0.5 text-[10px] text-gray-400">
                Set on the module&rsquo;s endplate records.
              </div>
            )}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              className={item}
              disabled={turnoutCount < 2}
              onClick={() => run(add.passingSiding)}
            >
              Siding
            </button>
            <button
              type="button"
              className={item}
              disabled={turnoutCount < 1}
              onClick={() => run(add.spur)}
            >
              Spur / Yard
            </button>
            {turnoutCount < 2 && (
              <div className="px-2 py-0.5 text-[10px] text-gray-400">
                {turnoutCount < 1
                  ? "Add a turnout first — sidings & spurs diverge from one."
                  : "A siding needs a second turnout."}
              </div>
            )}
            {canCrossover && (
              <button type="button" className={item} onClick={() => run(add.crossover)}>
                Crossover
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ObjectsList({
  state,
  selection,
  select,
  setTool,
  add,
  mainlineDouble,
  mainlineLocked,
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
    industry: () => void;
    mainline: (config: "single" | "double") => void;
  };
  mainlineDouble: boolean;
  mainlineLocked: boolean;
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
          <AddTrackMenu
            add={add}
            mainlineDouble={mainlineDouble}
            mainlineLocked={mainlineLocked}
            canCrossover={canCrossover}
            turnoutCount={state.turnouts.length}
          />
        }
      >
        {state.extraTracks.map((t) =>
          // Round to 0.1″ — raw float math read as 18.800000000000004″.
          row(t.id, t.trackName || t.id, { kind: "track", id: t.id }, `${Math.round(Math.abs(t.toPos - t.fromPos) * 10) / 10}″`),
        )}
      </Group>

      <Group
        title="Industries"
        count={state.industries.length}
        actions={
          <button type="button" onClick={add.industry} className={addBtn} title="A rail-served customer — a car-spot span on a track.">
            + Industry
          </button>
        }
      >
        {state.industries.map((ind) =>
          row(
            ind.id,
            ind.name || "unnamed",
            { kind: "industry", id: ind.id },
            `${carCapacity(ind.fromPos, ind.toPos)} cars`,
          ),
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
          row(t.id, t.name || t.id, { kind: "turnout", id: t.id }, `${Math.round(t.pos * 10) / 10}″`),
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
          row(x.id, x.name || x.id, { kind: "crossing", id: x.id }, `${Math.round(x.pos * 10) / 10}″`),
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
