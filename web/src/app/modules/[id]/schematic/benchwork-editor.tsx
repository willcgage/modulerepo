"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  sampleBenchworkOutline,
  samplePath,
  divergeSideForHand,
  turnoutClosure,
  turnoutDivergingLeg,
  partOutlineAtFrog,
  crossoverAssembly,
  partExtent,
  partExtentForSize,
  turnoutFacing,
  RAIL_GAUGE_INCHES,
  FREEMO_TRACK_SPACING_INCHES,
  TIE_HALF_LENGTH_INCHES,
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  type BenchworkPoint,
  crossoverPinches,
  laneOffsetAt,
  type EndplatePose,
  type TrackPart,
  type TrackPiece,
  type TurnoutKind,
  fitFlexBetween,
  flexPieces,
  insertIntoRun,
  maxFlexPieceInches,
  snapPiece,
  sliceCenterline,
} from "@willcgage/module-schematic";
import { drawablePartFor, PART_LIBRARY } from "./part-library";
import {
  PieceLayer,
  flexLengthFor,
  newPiece,
  offAxis,
  radiusForBend,
  rotationFor,
  type PieceSpec,
} from "./piece-layer";
import {
  PieceGlyph,
  TrackPalette,
  trackPaletteEntries,
  type PaletteEntry,
} from "./track-palette";
import {
  lanePath,
  sampleAt,
  laneOffset,
  projectToCenterline,
  LANE_SPACING_INCHES,
} from "@/lib/physical-track";
import { minCurveRadius } from "@/lib/curve-radius";

type Pt = { x: number; y: number };
type ViewBox = { minX: number; minY: number; w: number; h: number };
const DEG = Math.PI / 180;
/** A 40-ft N-scale car is ~3.0″; ~3.3″ over the couplers — the real spacing a
 * train occupies. Capacity in cars reads truer than scale feet for a builder. */
const CAR_INCHES = 3.3;
// RAIL_GAUGE_INCHES + TURNOUT_LEAD_INCHES_PER_FROG come from the package, so the
// closure maths and the drawn rails can't drift apart (they were local here
// first — two copies of a shared constant is the #120 trap).
/** Railhead width, inches — N-scale code 55 is ~0.03″ across the head. Rails are
 * drawn at a constant SCREEN width when zoomed out (so they stay visible), but
 * once that would be thinner than the real railhead the real width takes over —
 * otherwise zooming in made rails ever finer instead of resolving into rail. */
const RAILHEAD_INCHES = 0.03;
/** How much of a drag counts as "I meant a RUN", not "I meant a click" (#198
 * step 4). Shorter than one piece of anything, so a click on a flex part still
 * lays the single 12″ piece it always did. */
const FILL_MIN_INCHES = 2;

/** A rail joint — where one piece of track ends and the next begins. `nx`/`ny`
 * is the unit normal, so the tick draws ACROSS the rails. */
interface Joint {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** Round a raw span up to a friendly grid increment (inches). */
function niceStep(raw: number): number {
  const steps = [0.25, 0.5, 1, 2, 3, 6, 12, 24, 48, 96];
  return steps.find((s) => s >= raw) ?? 192;
}

/** Track/feature context drawn under the benchwork layer. */
export interface CanvasTrack {
  id: string;
  lane: number;
  fromPos: number;
  toPos: number;
  /** Sidings/spurs can be dragged along the main; a derived Main 2 can't. */
  editable?: boolean;
  /** The pos on the main where this spur's turnout sits — its throat snaps
   * there when drawn as a 2-D path (#2d-track). */
  throatPos?: number;
  /** Authored 2-D path (module-local inches). When set, the track draws along
   * it instead of the lane-offset path. */
  path?: BenchworkPoint[];
  /** What kind of track this is. The canvas only needs it to spot a crossover
   * (#180) — everything else about a track is already in the fields above. */
  role?: string;
  /** `role: "crossover"` only — the product it was built from. Its track
   * spacing is what pinches the pair (#180). */
  crossoverPartId?: string;
}
export interface CanvasTurnout {
  id: string;
  pos: number;
  /** Frog number ("size") — governs the diverging angle (atan(1/size)). */
  size?: number;
  /** The track this turnout sits on (main or a spur). Defaults to the main. */
  onTrack?: string;
  /** The track id it diverges to (so the spur can start at the frog), if any. */
  divergeTrack?: string;
  /** A curved turnout — the diverging leg bows into an arc instead of leaving
   * as a straight diagonal (#turnout-palette). */
  curved?: boolean;
  /** Rotated 180° — the points face the other way along the track. */
  flipped?: boolean;
  /** The library part this turnout IS, when one is named — lets the renderer
   * draw the part's own outline rather than a shape derived from `size`. */
  partId?: string | null;
  /** Hand: left/right throw one route; a wye splits symmetrically (both routes
   * diverge ± half the frog angle), so it draws a mirrored second leg. */
  kind?: TurnoutKind;
}
export interface CanvasSignal {
  id: string;
  /** The control point this signal belongs to — what selecting it selects. */
  cp: string;
  pos: number;
  side: "above" | "below";
  /** Which way along the main it governs (AtoB = toward endplate B). */
  facing: "AtoB" | "BtoA";
}
/** An industry — a car-spot span beside a track (#industries). */
export interface CanvasIndustry {
  /** Unique render id for this spot (industry id, or `${id}#n` for extra spots). */
  id: string;
  /** The industry this spot belongs to — what selecting it selects (#54). */
  industryId: string;
  /** Whether this spot's ends are draggable (the primary spot only). */
  editable: boolean;
  /** The track this spot is on. The span RIDES that track — it used to be
   * drawn at the track's lane offset beside the module centre-line, which is
   * only the same thing while the track is straight (#186). */
  track: string;
  fromPos: number;
  toPos: number;
  side: "above" | "below";
  name: string;
  /** Secondary readout under the name (cars / inches), or "" for none. */
  sub: string;
}

/** What's selected on the canvas — the editor renders its inspector. */
export type CanvasSelection =
  /**
   * A benchwork corner. ⭐ `section` says WHICH polygon the index counts into —
   * absent means the module's own outline, a section id means that section's.
   * The canvas edits one polygon at a time (`outline` is the module's, or the
   * section being shaped), so an index alone is ambiguous the moment a module
   * has sections: "Corner 1" in the Objects list and "Corner 1" under the
   * pointer were two different points, and the inspector resolved it against
   * `state.outline`, which a sectioned module hasn't got (#273).
   */
  | { kind: "corner"; i: number; section?: string }
  | { kind: "turnout"; id: string }
  | { kind: "track"; id: string }
  | { kind: "endplate"; id: string }
  | { kind: "industry"; id: string }
  | { kind: "cp"; id: string }
  /**
   * ⭐ PIECES ARE SELECTED AS A SET (#94) — one piece is a set of one. Will's
   * rule is that everything moves independently by default and together only
   * when it was picked together, so "how many are selected" is the ONLY thing
   * that decides whether a drag moves one thing or several. A second
   * "and also these" field beside a single `id` would let the two disagree.
   */
  | { kind: "pieces"; ids: string[] };

/**
 * What a click on empty canvas means. Without this the canvas has to guess, and
 * it guessed "add a benchwork corner" — so there was no way to click background
 * and mean "nothing". Select is the default; Benchwork is the drawing mode.
 */
export type CanvasTool =
  | "select"
  | "benchwork"
  /** ⭐ TRACK BUILDING IS ONE JOB, turnouts included. There was a separate
   * Turnout tool; a turnout is not a different activity from track, it is a
   * thing you put ON track, so it is a palette inside this one. A click places
   * the armed turnout, and edits the track when nothing is armed. */
  | "track"
  | "industry"
  | "signal";
/**
 * ⛔ THERE IS NO `"pieces"` TOOL ANY MORE (#198 step 4, Will 2026-07-29).
 *
 * ADR 0001 made track a graph of placed pieces and the 1-D document a
 * derivation, but the two ways of building it were two rail buttons — so every
 * feature after it (crossings, slips, signals, industries) would have been built
 * and tested twice, once per idiom. That dual-model tax is what left "the 1-D
 * positional renderer is a different code path from all the graph work", which
 * is where the 2026-07-29 crossover bug was hiding.
 *
 * **T is now the only track button, and the MODULE says which model it is
 * built from** — see `graphAuthoring` in {@link BenchworkEditor}. New modules
 * are graph-built; a module that already carries positional track keeps the
 * 1-D affordances it was drawn with. `P` still selects Track, the way `W` does.
 */

/** A sibling section, drawn as faint context behind the board being edited. */
type ContextOutline = { id: string; name?: string; outline: { x: number; y: number }[] };

/**
 * Stable empty default for `contextOutlines`. Writing `= []` in the destructuring
 * would mint a new array on every render, so `bounds` — which reads it — could
 * never actually memoise, and the wheel listener keyed on `bounds` would unbind
 * and rebind every render. Callers with nothing to show should pass `undefined`
 * rather than a fresh `[]`, for the same reason.
 */
const NO_CONTEXT_OUTLINES: ContextOutline[] = [];

/**
 * Benchwork outline editor — draw a module's physical footprint as a polygon in
 * module-local inches (endplate A's track point at the origin, mainline +x,
 * perpendicular +y up). Edges can be straight or curved: drag the diamond on an
 * edge to bow it into an arc. The endplate FACES are drawn as anchors — drag a
 * corner near one and it snaps, so the board meets the standard interface. Empty
 * outline = the layout falls back to the endplate-width band.
 */
const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

export function BenchworkEditor({
  outline,
  outlineInner = [],
  onChange,
  contextOutlines = NO_CONTEXT_OUTLINES,
  seedOutline,
  editingLabel,
  lengthInches,
  poses,
  endplateWidths,
  endplateTrackOffsets,
  centerline = [],
  sectionBreaks = [],
  sectionSkews = [],
  mainLane = 0,
  onSectionBreakMove,
  onEndplateEndMove,
  onEndplateMove,
  tracks = [],
  unreachableTracks = EMPTY_IDS,
  turnouts = [],
  signals = [],
  industries = [],
  onTrackCurveRadii,
  onTurnoutMove,
  onTrackEndMove,
  onIndustryEndMove,
  onAddIndustry,
  mainPath = [],
  onMainPathChange,
  main2Path = [],
  onMain2PathChange,
  onTrackPathChange,
  trackMenu,
  pendingTrack = null,
  onPlaceTrack,
  onCancelPlace,
  onDropTurnout,
  onDropCrossover,
  onDropSignal,
  onTrackEndDrop,
  onTurnoutDrop,
  flexPiecesByTrack,
  selection = null,
  onSelect,
  outlineSection = null,
  graphAuthoring: graphAuthoringProp,
  onCanvasContextMenu,
  tool = "select",
  partLibrary = PART_LIBRARY,
  pieces = [],
  onPiecesChange,
  rebuildOffer,
}: {
  outline: BenchworkPoint[];
  /** A benchwork HOLE — the loop's open middle, punched out of `outline` so the
   * board reads as a donut, not a filled disc. Empty = solid board (#loop). */
  outlineInner?: BenchworkPoint[];
  /** The module's OTHER sections, drawn as faint context so you can see what
   * the board you're editing has to meet (#96 phase 2b). Not editable. */
  contextOutlines?: ContextOutline[];
  /** What "Start from a rectangle" should seed — a section's derived band
   * rather than the whole module's, when editing a section. */
  seedOutline?: { x: number; y: number }[] | null;
  /** Whose outline is being edited, for the tool header. */
  editingLabel?: string | null;
  onChange: (next: BenchworkPoint[]) => void;
  lengthInches: number;
  poses: EndplatePose[];
  endplateWidths?: Record<string, number>;
  /** Where each endplate's CENTRE sits relative to its track point, inches — a
   * double-track end is half a track spacing off so the plate centres on its
   * pair of tracks (Free-moN §2.0). Absent = centred on the track. */
  endplateTrackOffsets?: Record<string, number>;
  /** The real mainline centre-line (module-local inches) — drawn as context. */
  centerline?: Pt[];
  /** Internal section joints (inches from A) — drawn as dividers on the board. */
  sectionBreaks?: number[];
  /** How each joint is cut, degrees away from square, parallel to
   * `sectionBreaks` (#354). Absent or 0 draws the square cut it always was. */
  sectionSkews?: number[];
  /** Which lane Main 1 draws on — 0 (centre) normally, 1 when the module's
   * mains are swapped so Main 1 is the upper track (#92 / #131). */
  mainLane?: number;
  /** Fired while a section joint is dragged along the board (#96). */
  onSectionBreakMove?: (i: number, pos: number) => void;
  /** Fired while the far endplate is dragged along the main — it's the outer
   * end of the LAST board, so moving it lengthens or shortens that board and
   * with it the module (#108). */
  onEndplateEndMove?: (id: string, pos: number) => void;
  /** Reposition a placed branch endplate (C, D…) — the owner drags it and it
   * clings to the nearest benchwork edge, facing out (#170 junction). */
  onEndplateMove?: (id: string, pt: Pt) => void;
  /** Sidings/spurs/main-2, positioned along the main and offset to their lane. */
  tracks?: CanvasTrack[];
  /** Ids of tracks no turnout leads onto — derived once by the editor and
   * handed down, so the canvas and the inspector cannot disagree about which
   * track is unreachable (#350). */
  unreachableTracks?: ReadonlySet<string>;
  turnouts?: CanvasTurnout[];
  signals?: CanvasSignal[];
  /** Industries — car-spot spans beside their track. */
  industries?: CanvasIndustry[];
  /**
   * Which industry bands could NOT be placed clear of the tracks they do not
   * serve (#421).
   *
   * ⭐⭐ REPORTED UP RATHER THAN RE-DERIVED. Only the canvas knows where a band
   * actually landed — the placement depends on the DRAWN track paths (leg +
   * eased arrival + body), not on the stored extents. Working it out a second
   * time in the builder would be one fact with two implementations, which is
   * the mirror of why `unreachableTracks` is handed DOWN
   * ([[one-answer-per-drawn-fact]]).
   */
  /**
   * The tightest curve in each DRAWN track, so the builder can hold it against
   * the standard's minimum main-line radius.
   *
   * ⭐ Reported UP because only the canvas
   * knows the drawn geometry. And the split is deliberate — the canvas measures
   * the radius, the BUILDER decides which tracks are mains, because that needs
   * the endplates (a 3rd-plate route is Main 3) and the canvas has no
   * `trackId` on a pose to test.
   */
  onTrackCurveRadii?: (radii: { id: string; minRadius: number }[]) => void;
  /** Drag a turnout along the main → its new position, inches from endplate A. */
  onTurnoutMove?: (id: string, pos: number) => void;
  /** Drag a siding/spur end along the main → its new from/to position. */
  onTrackEndMove?: (id: string, end: "from" | "to", pos: number) => void;
  /** Drag an industry span end along the track → its new from/to position. */
  onIndustryEndMove?: (id: string, end: "from" | "to", pos: number) => void;
  /** In the Industry tool, a click adds an industry on `track` at `pos`. */
  onAddIndustry?: (track: string, pos: number) => void;
  /** The authored mainline path (module-local inches). Empty = derived; the
   * Track tool seeds it from the centre-line, then edits it (#2d-track). */
  mainPath?: BenchworkPoint[];
  onMainPathChange?: (next: BenchworkPoint[]) => void;
  /** Authored Main 2 centre-line + its setter, for the curvable second main (#131). */
  main2Path?: BenchworkPoint[];
  onMain2PathChange?: (next: BenchworkPoint[]) => void;
  /** Author a spur/siding's 2-D path (module-local inches) — bend/rotate it in
   * the Track tool; its throat stays snapped to its turnout (#2d-track). */
  onTrackPathChange?: (id: string, next: BenchworkPoint[]) => void;
  /** The "+ Track" add menu (owned by the editor) — shown on the Track tool. */
  trackMenu?: React.ReactNode;
  /** Draw-to-create (#51): a track role armed by the + Track menu. When set,
   * the canvas captures a press-drag and calls onPlaceTrack with the drawn
   * geometry instead of editing the main/spur. */
  pendingTrack?: "siding" | "spur" | null;
  onPlaceTrack?: (
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
  ) => void;
  onCancelPlace?: () => void;
  /** Turnout tool (W): drop a turnout of a chosen kind onto a track — from a
   * canvas click or a palette drag. It lands with a short diverging spur stub
   * (#turnout-palette). */
  onDropTurnout?: (
    spec: {
      kind: TurnoutKind;
      curved?: boolean;
      /** Frog number — the palette entry's own, not a separate control's. */
      size: number;
      /** Set only when the owner picked a REAL product. A bare `#N` stays bare:
       * `turnoutPartForSize` refuses to adopt a placeholder for one, so naming
       * the placeholder would silently drop the extent a bare #5 is drawn at. */
      partId?: string;
    },
    onTrack: string,
    pos: number,
  ) => void;
  /** Crossover glyphs (#turnout-palette): drop a self-contained crossover on the
   * main — a turnout on each of the two parallel lanes plus the diagonal
   * connector(s) between them (a double crossover has two, which cross at the
   * scissors). The canvas computes the
   * geometry (module-local inches); the editor builds/reuses the tracks. */
  onDropCrossover?: (p: {
    hand?: "left" | "right";
    double?: boolean;
    /** Frog number of the turnouts it is built from — from the palette entry. */
    size: number;
    /** The crossover PRODUCT, when one was named. It goes on the CONNECTOR, not
     * on a turnout: the fixture that set the angle also set the track spacing,
     * and that belongs to the pair of tracks (#180). */
    partId?: string;
    /** Which side of the main the parallel lane sits (from the drop point). */
    side: 1 | -1;
    /** The crossover's span along the main (inches from A). */
    posA: number;
    posB: number;
    /** The four corner points: on the main at posA/posB, and one lane over. */
    hostA: BenchworkPoint;
    hostB: BenchworkPoint;
    parA: BenchworkPoint;
    parB: BenchworkPoint;
  }) => void;
  /** Signal tool (S): a click drops a signal (a block control point) at pos on
   * the main (inches from A) (#53). */
  onDropSignal?: (pos: number) => void;
  /** Fired when a track-end drag is released — the editor merges the track into
   * one with any same-lane track it now abuts (the snap makes ends meet), and
   * reflects endplate contact (a track ON a plate = a double-track plate). */
  onTrackEndDrop?: (id: string) => void;
  /** Fired when a turnout drag is released — an End-of-Double-Track turnout
   * dragged onto the single end's plate completes the double main. */
  onTurnoutDrop?: (id: string) => void;
  /** Where the flex track is jointed on each run — ABSOLUTE inches along the
   * module, by track id (#193). The editor works these out (it owns the pieces
   * and the parts they're cut from); the canvas only has to place them, which
   * it does exactly as it places a turnout on its host. */
  /** ⭐ The PIECES, not a list of joint positions (#392). A joint is the end
   * of a piece, so the canvas slices the line it draws and reads the joints off
   * the slices — see `piecePaths`. Each entry carries the frame its spans are
   * in: `alongPath` spans are arc length on the track's own path, the rest are
   * inches along the module. */
  flexPiecesByTrack?: Record<
    string,
    { pieces: { index: number; fromPos: number; toPos: number; lengthInches: number; overlong: boolean; fromEnd: string; toEnd: string }[]; alongPath: boolean }
  >;
  /** Selection is owned by the editor, which renders the inspector for it. */
  selection?: CanvasSelection | null;
  onSelect?: (s: CanvasSelection | null) => void;
  /** Whether this module is GRAPH-built, decided once by the editor (#255).
   * Omit and the canvas falls back to working it out from its own props, which
   * is what it did before — but two copies of that predicate is the bug that
   * produced #205 and #207. */
  graphAuthoring?: boolean;
  /** A right-click on the board, in SCREEN pixels. The editor owns the menu
   * because it owns removal and the selection; the canvas only reports where
   * the pointer was (#284). */
  onCanvasContextMenu?: (at: { x: number; y: number }) => void;
  /** Whose polygon `outline` is: null for the module's own, else the id of the
   * section being shaped. Corner selections are stamped with it so an index is
   * never read against the wrong polygon (#273). */
  outlineSection?: string | null;
  /** What a background click means. See CanvasTool. */
  tool?: CanvasTool;
  /** The track/turnout parts library for this request — the admin-maintained
   * parts folded over the compiled-in ones. A turnout is drawn at its part's
   * MEASURED dimensions, so adding a part is what makes a frog number the app
   * has never seen start drawing its own extent. Defaults to the built-ins so
   * the canvas still works standalone. */
  partLibrary?: TrackPart[];
  /** The offer to rebuild this module's 1-D track as pieces (#199). Built by
   * the editor, which owns the document and the undo stack; rendered here
   * because the Pieces bar is where an owner meets the problem it solves. */
  rebuildOffer?: React.ReactNode;
  /** ⭐ THE TRACK AS PLACED PIECES (ADR 0001). Empty = this module is authored
   * positionally, and the Pieces tool has nothing to show. */
  pieces?: TrackPiece[];
  /** `commit` false = mid-drag (don't take an undo snapshot for every frame). */
  onPiecesChange?: (next: TrackPiece[], opts?: { commit?: boolean }) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "vertex" | "edge"; i: number }
    | { kind: "mainVertex"; i: number }
    | { kind: "main2Vertex"; i: number }
    | { kind: "spurVertex"; id: string; i: number }
    /** ⭐ `end` says WHICH HALF of the stretch this handle bends — the near one
     * (`bulge`) or the far one (`bulgeEnd`). Two per edge, because flex is
     * normally cut to make an S. */
    | { kind: "main2Edge"; i: number; end: "start" | "end" }
    | { kind: "spurEdge"; id: string; i: number; end: "start" | "end" }
    | { kind: "mainEdge"; i: number; end: "start" | "end" }
    | { kind: "turnout"; id: string }
    | { kind: "trackEnd"; id: string; end: "from" | "to" }
    | { kind: "sectionBreak"; i: number }
    | { kind: "endplateEnd"; id: string }
    | { kind: "endplateMove"; id: string }
    | { kind: "industryEnd"; id: string; end: "from" | "to" }
    /** ADR 0001 — moving a whole piece (`grab` = pointer offset from its
     * origin, so it doesn't jump to the pointer), or working one of its
     * handles. */
    /** ⚠️ `latest` is the piece AS THE DRAG LEFT IT. Reading it back out of
     * props on release would give whatever the last render carried, which is
     * a move behind when the release lands in the same tick as the move — and
     * a fit computed against the piece's OLD length silently does nothing. */
    | { kind: "piece"; id: string; grab: Pt; latest?: TrackPiece }
    /**
     * ⭐ A GROUP MOVE IS ONE OFFSET APPLIED TO EVERY MEMBER'S OWN ORIGIN (#94) —
     * never a chain of per-piece drags. `origins` is the geometry AS THE DRAG
     * BEGAN, so the group is rigid by construction and cannot creep from
     * rounding accumulated over a few hundred pointermoves.
     */
    | { kind: "pieces"; ids: string[]; from: Pt; origins: Record<string, Pt>; latest?: TrackPiece[] }
    | { kind: "pieceHandle"; id: string; handle: "rotate" | "flex" | "bend"; latest?: TrackPiece }
    | null
  >(null);
  /** An in-progress marquee (Shift+drag on empty canvas), in board inches. */
  const marqueeRef = useRef<{ from: Pt; to: Pt } | null>(null);
  const [marquee, setMarquee] = useState<{ from: Pt; to: Pt } | null>(null);
  /** An in-progress pan: pointer origin + the view at grab time. */
  /** An in-progress pan. `tentative` marks a press on empty canvas under the
   * Select tool, which only becomes a pan once the pointer moves — a click that
   * doesn't move still means "select nothing" (#188). */
  const panRef = useRef<{
    from: Pt;
    view: ViewBox;
    tentative?: boolean;
    moved?: boolean;
  } | null>(null);
  /** Draw-to-create in progress: the throat turnout it diverges from + live end. */
  const placeRef = useRef<{ start: Pt; end: Pt; turnoutId: string } | null>(null);
  const [placePreview, setPlacePreview] = useState<{ start: Pt; end: Pt } | null>(null);
  /** A fill-a-run drag in progress (#198 step 4): the flex part armed, where the
   * run starts, and where the pointer has got to. */
  const fillRef = useRef<{ spec: PieceSpec; start: Pt; end: Pt } | null>(null);
  const [fillPreview, setFillPreview] = useState<{ spec: PieceSpec; start: Pt; end: Pt } | null>(
    null,
  );
  const [showLegend, setShowLegend] = useState(false);
  /**
   * ⭐ ONE ARMED THING (#198 step 5). There used to be two — `armedPart` for the
   * parts palette and `armedPalette` for the turnout glyphs — which is what four
   * pickers in three idioms costs you in state. One palette, one arming, and the
   * canvas dispatches on {@link PaletteEntry.action}.
   *
   * ⚠️ NULL BY DEFAULT, and that is what makes the merge with the Track tool
   * safe. The old Turnout tool could assume a default hand because a click there
   * could only ever mean "drop a turnout". Sharing the Track tool, an armed
   * default would hijack every click meant for bending the main.
   */
  const [armedRaw, setArmed] = useState<PaletteEntry | null>(null);
  /** A palette entry being dragged toward the board, with its live client
   * position, so a ghost can follow the pointer until it's dropped. */
  const [paletteDrag, setPaletteDrag] = useState<{
    entry: PaletteEntry;
    x: number;
    y: number;
  } | null>(null);
  /** A transient warning shown in the toolbar (e.g. a curved turnout dropped on
   * straight track). Cleared on the next pointer-down. */
  const [dropWarn, setDropWarn] = useState<string | null>(null);
  /** Space-to-pan: held-key state, so any tool can pan without switching. */
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** Pointer position in world inches — drives the status-bar readout. */
  const [hover, setHover] = useState<Pt | null>(null);
  /** A live measurement shown while dragging (corner xy, track length, pos). */
  const [readout, setReadout] = useState<string | null>(null);
  /** A corner selection that names the polygon it indexes into, so a section's
   * "Corner 1" can never highlight or edit the module outline's (#273). */
  const cornerSel = (i: number): CanvasSelection =>
    outlineSection === null ? { kind: "corner", i } : { kind: "corner", i, section: outlineSection };
  /** The selected corner index, when a corner OF THE POLYGON ON SCREEN is what's
   * selected — a corner of some other section is not this canvas's to highlight. */
  const sel =
    selection?.kind === "corner" && (selection.section ?? null) === outlineSection
      ? selection.i
      : null;
  const setSel = (i: number | null) => onSelect?.(i === null ? null : cornerSel(i));

  /** The axis along an endplate's FACE — perpendicular to its track — oriented
   * to agree with the centre-line NORMAL, which is the same axis lanes (and so
   * Main 2) are offset along. Orientation matters: a pose's heading points
   * OUTWARD, so at end A it faces backwards down the module and `heading + 90`
   * alone comes out opposite to end B's. Using it raw would make one authored
   * offset jog the two plates in opposite directions, and would disagree with
   * the footprint the package computes (it keys off the normal). Flipping to
   * match the normal also covers branch endplates, whose headings are
   * arbitrary. */
  const faceAxis = (p: { x: number; y: number; heading: number; id: string }) => {
    const px = Math.cos((p.heading + 90) * DEG);
    const py = Math.sin((p.heading + 90) * DEG);
    let flip: boolean;
    if (centerline.length >= 2) {
      // Best source: the centre-line's own left normal, which also follows a
      // curved module round its bend.
      const n = sampleAt(centerline, projectToCenterline(centerline, p).pos);
      flip = px * n.nx + py * n.ny < 0;
    } else {
      // No centre-line (a module with no geometry set yet, where the canvas
      // draws the endplate-to-endplate lead instead). Fall back to the module
      // frame: end A's outward heading points back down the module, so its
      // raw axis is the reversed one. Branch endplates face across the main
      // and are left alone — their axis genuinely runs along it.
      flip = p.id === "A";
    }
    return flip ? { px: -px, py: -py } : { px, py };
  };

  /**
   * Half an endplate's face width.
   *
   * ⚠️ A plate BOUND TO A BENCHWORK EDGE (ADR 0001) takes its width from the
   * edge, not from the stored `endplateWidths` — that stored number is exactly
   * what a binding exists to stop disagreeing with the board. One definition,
   * because two would be the #120 trap: the anchors and the drawn face would
   * quietly use different widths.
   */
  const halfWidthOf = (p: EndplatePose): number =>
    (p.boundToEdge && p.widthInches && p.widthInches > 0
      ? p.widthInches
      : (endplateWidths?.[p.id] ?? 24)) / 2;

  // Endplate face corners — the anchors a board corner should meet.
  const anchors = useMemo(() => {
    const out: { x: number; y: number; id: string }[] = [];
    for (const p of poses) {
      const hw = halfWidthOf(p);
      const { px, py } = faceAxis(p);
      // Corners follow the drawn face, which a double end offsets off the track
      // point so the plate centres on its pair of tracks (#93).
      const off = endplateTrackOffsets?.[p.id] ?? 0;
      const cx = p.x + px * off;
      const cy = p.y + py * off;
      out.push({ x: cx + px * hw, y: cy + py * hw, id: p.id });
      out.push({ x: cx - px * hw, y: cy - py * hw, id: p.id });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poses, endplateWidths, endplateTrackOffsets, centerline]);

  const sampled = useMemo(() => sampleBenchworkOutline(outline, 24), [outline]);
  const sampledInner = useMemo(
    () => (outlineInner.length >= 3 ? sampleBenchworkOutline(outlineInner, 24) : []),
    [outlineInner],
  );

  // A crossover built to a spacing other than Free-moN's pulls its lane IN
  // across its own length, and back out either side (#180). Derived once here
  // and threaded through every `lanePath` call, because that function is the one
  // funnel all derived lane geometry goes through — do it there and the bands,
  // the hosts turnouts sit on, and the connector's own ends all follow the same
  // curve rather than each having to agree with the others.
  //
  // Empty for every module that hasn't named a crossover product, which is all
  // of them until an owner says what they built — so nothing moves by default.
  const pinches = useMemo(
    () => crossoverPinches(tracks, partLibrary),
    [tracks, partLibrary],
  );

  /**
   * ⛔ THE PINCH IS DRAWN, NOT ANNOTATED.
   *
   * A crossover built to 1.09″ narrows the mains by 0.035″, which is about a
   * fifth of a pixel at normal zoom — so this used to add a leader line, a
   * highlighted span and a "Crossover 1.09″" callout to make it visible, and
   * before that "0.035″ tighter than Free-moN" underneath.
   *
   * Both are gone. §2.0 fixes the spacing AT A DOUBLE-TRACK ENDPLATE and 4″
   * inboard of it, and says nothing about how far apart the mains run in
   * between — where every real crossover draws them closer. Annotating an
   * ordinary, correctly built piece of trackwork as though it were remarkable
   * is noise on the drawing (Will, 2026-07-28).
   *
   * `crossoverPinches` still supplies the geometry, and `lanePath` still draws
   * the narrowing truly. It simply is not called out.
   */

  // Track context. A track with an authored 2-D path draws along it; otherwise
  // it's laid onto the main centre-line, offset to its lane (#2d-track).
  // The polyline a turnout/track sits on: the main centre-line, or a spur's own
  // authored/lane path — so a turnout can sit on a spur (a house track, #63).
  const hostPointsOf = (onTrack: string | undefined | null): Pt[] => {
    if (!onTrack || onTrack === MAIN_TRACK_ID) return centerline;
    const host = tracks.find((x) => x.id === onTrack);
    if (!host) return centerline;
    return host.path && host.path.length >= 2
      ? samplePath(host.path)
      : lanePath(centerline, host.fromPos, host.toPos, host.lane, 24, pinches);
  };
  /** Turnout positions are ABSOLUTE (inches from A — what the inspector and the
   * operations view read). Sampling along a non-main host's polyline needs them
   * host-relative: the polyline starts at the host's fromPos end. A drawn-path
   * host keeps its own parameterisation (the ops view is approximate there). */
  /** A turnout's position is ALWAYS absolute inches from endplate A, measured
   * along the module (owner decision, #132) — even for a turnout on a spur, so
   * a value typed off an XTrkCAD drawing lands where the owner expects. These
   * two convert between that absolute figure and an arc length along whatever
   * polyline the turnout sits on, by PROJECTING each host point back onto the
   * main. The old version assumed the host ran the same direction as the main
   * and just did `dir*(abs-start)`, which flipped a spur that ran east→west so
   * a value read from the wrong end (#132). */
  /**
   * Absolute inches from A → arc length along a GIVEN polyline (#388).
   *
   * ⭐ THE POLYLINE IS A PARAMETER, and that is the whole point. The conversion
   * walks the curve you hand it, so the answer is only meaningful on THAT
   * curve — an arc length from one polyline sampled on another lands somewhere
   * else entirely, and silently. Callers therefore pass the very points they
   * are about to sample, rather than naming a track and hoping two functions
   * agree about what its geometry is.
   */
  const relAlongPoints = (pts: Pt[], abs: number): number => {
    if (pts.length < 2) return abs;
    let acc = 0;
    let prevLong = projectToCenterline(centerline, pts[0]).pos;
    if (abs <= prevLong) return 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const long = projectToCenterline(centerline, pts[i]).pos;
      const lo = Math.min(prevLong, long);
      const hi = Math.max(prevLong, long);
      if (abs >= lo && abs <= hi) {
        const f = long === prevLong ? 0 : (abs - prevLong) / (long - prevLong);
        return acc + seg * Math.max(0, Math.min(1, f));
      }
      acc += seg;
      prevLong = long;
    }
    return acc;
  };
  const toHostRel = (onTrack: string | undefined | null, abs: number): number => {
    if (!onTrack || onTrack === MAIN_TRACK_ID) return abs;
    const host = hostPointsOf(onTrack);
    if (host.length < 2) return abs;
    return relAlongPoints(host, abs);
  };
  /** Arc length along the host → absolute inches from A (its main-projection). */
  const toHostAbs = (onTrack: string | undefined | null, rel: number): number => {
    if (!onTrack || onTrack === MAIN_TRACK_ID) return rel;
    const host = hostPointsOf(onTrack);
    if (host.length < 2) return rel;
    return projectToCenterline(centerline, sampleAt(host, rel)).pos;
  };
  /** A turnout's diverging leg — the throat→frog route, sampled *along the host*
   * so it follows the mainline's curvature (a curved turnout), easing out to one
   * track over at the frog. Null if nothing diverges. */
  const frogLegOf = (
    t: CanvasTurnout,
    forceSide?: 1 | -1,
  ): {
    leg: Pt[];
    /** The FLEX from the end of the moulding, eased onto the lane the diverging
     * track runs at — null when it is already there (or there is no lane to
     * reach). The turnout stops where the part stops; this is the owner's track
     * closing the difference, which is what bends on a real board. */
    arrival: Pt[] | null;
    frog: Pt;
    frogV: [Pt, Pt];
    outline: Pt[][] | null;
    /** The measured part's tie strip, or null when the library has no part for
     * this frog number — see the note where it's built (#part-vs-track). */
    body: Pt[] | null;
    /** Rail joints where the part meets flex track ON THE THROUGH ROUTE — the
     * two ends of the moulding. Empty unless the part was measured, since
     * otherwise we don't know where it stops (#189). */
    throughJoints: Joint[];
    /** The joint at the end of the diverging rail. Drawn only when something is
     * actually connected there; otherwise that spot gets a dangling ring. */
    divergeJoint: Joint;
    /** How far this turnout REACHES — its position on the host to the end of its
     * diverging rail. Non-zero for every turnout, because `pos` marks the frog
     * and the frog is inside the part (#239). */
    reachInches: number;
  } | null => {
    const dt = tracks.find((x) => x.id === t.divergeTrack);
    if (!dt) return null;
    const host = hostPointsOf(t.onTrack);
    if (host.length < 2) return null;
    // `pos` marks the FROG (#132). Find its arc on the host, size the leg, then
    // put the throat a leg-length back so the walk lands the frog exactly at
    // pos. `m` (the turnout node) sits at the frog.
    const relFrog = toHostRel(t.onTrack, t.pos);
    const m = sampleAt(host, relFrog);
    const eps = 0.5;
    const a = sampleAt(host, Math.max(0, relFrog - eps));
    const b = sampleAt(host, relFrog + eps);
    const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / tl;
    const ty = (b.y - a.y) / tl;
    // The diverging track's far end (relative to the throat) fixes the leg's
    // longitudinal (toward) and lateral (side) sense — host-agnostic. A wye's
    // mirror leg forces the opposite side.
    const far = (() => {
      if (dt.path && dt.path.length >= 2) {
        // ⚠️ WHICHEVER END IS FURTHER FROM THIS TURNOUT — not simply the last
        // point. A crossover connector has a turnout at BOTH ends, so the one
        // sitting on the path's last point was being told its far end was its
        // own position: the direction came out degenerate and its leg drew
        // backwards, away from the pair (#180). Same rule the geometric
        // fallback below already used; it just wasn't applied to authored
        // paths, where only spurs — turnouts at one end — had exercised it.
        const a = dt.path[0];
        const b = dt.path[dt.path.length - 1];
        const da = (a.x - m.x) ** 2 + (a.y - m.y) ** 2;
        const db = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
        return db >= da ? b : a;
      }
      // The diverging track's OWN far end — whichever of its ends is further
      // from this turnout — laid on the main at its lane. The old fallback
      // stepped a fixed +tangent, so every spur diverged EAST no matter which
      // way it actually ran (a westward spur drew backwards, #FMN-0040).
      const farPos =
        Math.abs(dt.toPos - t.pos) >= Math.abs(dt.fromPos - t.pos) ? dt.toPos : dt.fromPos;
      const p = sampleAt(centerline, farPos);
      const off = laneOffset(dt.lane) || LANE_SPACING_INCHES;
      return { x: p.x + p.nx * off, y: p.y + p.ny * off };
    })();
    // Rotating the turnout 180° faces its points the other way, so the leg
    // walks the opposite direction from the throat. The geometric guess above
    // reads where the diverging TRACK went, which can't be right for a siding
    // pinned at a module end — the flip is the owner's override.
    //
    // The rule itself lives in the package: the flex solver needs the same
    // answer to know which side of `pos` the moulding extends, and a turnout's
    // body isn't symmetric about its points (#193). What's measured here is the
    // 2-D projection of the real far end; the editor measures the same thing
    // from the authored extent. One rule, two precisions.
    const toward = turnoutFacing({
      pos: 0,
      divergeFarPos: (far.x - m.x) * tx + (far.y - m.y) * ty,
      flipped: t.flipped,
    });
    // HAND decides the side, not the lane the diverging track happens to sit
    // on. A right-hand turnout throws right whichever lane its siding was
    // assigned — deriving the side from the track's position made hand a no-op
    // on the board (it already drives the dispatcher view). Geometry is only
    // the fallback for a wye or an unset hand, which have no side to state.
    // ⛔⛔ `flipped` WAS APPLIED TWICE HERE, so the 180° checkbox did NOTHING
    // (#378). `toward` above already came out of `turnoutFacing`, which applies
    // it; `divergeSideForHand` applies it again with its own
    // `* (flipped ? -1 : 1)`, and the two negations cancel — measured across
    // every hand and direction, ticking the box changed not one drawn side.
    //
    // ⭐ The package's contract is a RAW direction plus the flag: that is how
    // `moduleFeatures` calls it (`divergeSideForHand(kind, far - pos, flipped)`),
    // and it was right. So pass the raw geometric direction here, and let the
    // one application inside do the work. `toward` keeps the flip for walking
    // the leg, which is correct there.
    // ⛔ `flipped` MUST BE APPLIED EXACTLY ONCE, and `toward` is where it lives.
    //
    // It was applied TWICE (into `toward` AND again here), so the 180° box did
    // nothing at all. #378 fixed that by passing the RAW geometric direction
    // plus the flag instead — which was the wrong half of the choice: it made
    // the drawn side follow the geometry again, so dragging a turnout past its
    // track's far end still swung the leg across, with the facing pinned. That
    // is the very thing #379 is about.
    //
    // ⭐ The side is a function of HAND and FACING, and facing is the pinned
    // fact. So: pass `toward`, and do NOT pass the flag again.
    const handSide = divergeSideForHand(t.kind, toward);
    const geoSide = Math.sign((far.x - m.x) * m.nx + (far.y - m.y) * m.ny) || 1;
    // ⚠️ A CROSSOVER LEG HAS NO FREE CHOICE OF SIDE, so hand does not get a vote
    // (#196). Every other turnout throws to its hand — a right-hand turnout
    // throws right whichever lane its siding sits on, which is the rule above.
    // But a crossover connector already says where its diagonal goes: at the
    // other end of it, on the other track. A leg that obeyed its hand instead
    // pointed AWAY from the pair — the two turnouts on the parallel main drew
    // legs off the top of the module, connected to nothing.
    //
    // This is the same exemption the comment above grants a wye: a side that is
    // determined has nothing for hand to state. The hand is still right and
    // still drives the dispatcher view; it just isn't what decides this.
    const crossoverLeg = dt.role === "crossover";
    /**
     * ⛔⛔ THE LEG FOLLOWS THE TRACK'S LANE, NOT ITS OWN HAND (#398).
     *
     * This read `handSide` for every non-crossover turnout — a SECOND answer to
     * a question `moduleFeatures.resolveLane` has already settled. That function
     * signs a track's lane from the hand (and flip) of the FIRST turnout feeding
     * it; taking each leg's side from its own hand instead means the legs and
     * the body can disagree, and on FMN-0085 they did: measured across the
     * siding, the ENDS sat on side +1 and the MIDDLE on −1, so the track wove
     * across the main twice and came out **153.3″** where the module page drew
     * the same siding at **122.4″**. Same document, 31″ apart, while both views
     * agreed on the mains to the inch. Will: *"there are still issues."*
     *
     * ⭐ THE HAND STILL DECIDES THE SIDE — through `resolveLane`, once, for the
     * whole track. `geoSide` is that decision read back off the lane, so this
     * honours the hand instead of re-deriving it, and the two renderers now
     * derive the drawn side from the same fact. Same fix as #394 in
     * `physical-track.ts`; this is the other half of it.
     *
     * ⚠️ `handSide` is kept for the case `geoSide` cannot answer: a track with
     * no lane and no path has no side of its own to read.
     */
    const side =
      forceSide ?? (crossoverLeg ? geoSide : (geoSide || (handSide || undefined) || 1));
    const size = t.size && t.size > 0 ? t.size : 6;
    const effN = t.kind === "wye" ? size * 2 : size;
    /**
     * ⭐⭐ A CROSSOVER'S TURNOUTS ARE NOT GENERIC TURNOUTS, so they must not take
     * a generic lead. The assembly publishes where its own points sit relative
     * to its frogs — one gauge of lateral, `gauge / tan θ` along the track — and
     * `pos` marks the FROG (#132). Drawing the leg from the per-frog formula
     * instead started it in the wrong place: on FMN-0078's #6 the formula gives
     * 3.297″ where the assembly says 2.124″, so every leg began 1.17″ outside
     * its own point-set and the diagonal read as not meeting the frogs (Will,
     * 2026-07-30). The frog itself was always right — it is pinned to `pos` — so
     * only the throat moved, which is exactly why it looked like a gap rather
     * than a misplaced turnout.
     *
     * ⭐ Nothing new is measured: `pointsToFrogInches` falls out of the angle the
     * product already publishes. It also makes each leg exactly HALF the crossing
     * run, which is what the package's own route geometry draws for the piece
     * model — the two renderers now agree by derivation rather than by luck.
     */
    const crossoverGeom = (() => {
      if (!crossoverLeg || !dt.crossoverPartId) return null;
      const part = partLibrary.find((p) => p.id === dt.crossoverPartId);
      return part ? crossoverAssembly(part) : null;
    })();
    const crossoverLeadIn = crossoverGeom?.pointsToFrogInches ?? null;
    /**
     * ⭐⭐ THE LEG ITSELF NOW COMES FROM THE PACKAGE (#226).
     *
     * All of this used to be computed here — the lead, the closure, the body
     * span, the crossover cap, the walk — which meant the only way to know where
     * a turnout's rail actually ENDS was to be this canvas. The snap that joins
     * track to a turnout, the ring that says nothing is joined, and the flex
     * derivation that has to know a route starts at the RAIL rather than at the
     * frog were therefore three answers to one question, and two of them did not
     * exist.
     *
     * ⚠️ The HOST stays here, deliberately: which polyline a turnout sits on is a
     * fact about the module's shape (its centre-line, its lane pinches, a spur's
     * authored path), not about the turnout. `sampleAt` is passed in.
     */
    const legGeom = turnoutDivergingLeg({
      sampleAt: (rel) => sampleAt(host, rel),
      relFrogInches: relFrog,
      toward,
      side: side as 1 | -1,
      size,
      wye: t.kind === "wye",
      curved: t.curved,
      library: partLibrary,
      leadOverrideInches: crossoverLeadIn,
      // ⚠️ The gap is the PART's own spacing, never re-measured off the host —
      // through a crossover the mains pinch, so the normal is tilted (#225). The
      // projection fallback is kept for a hand-built pair that names no product.
      meetAtSpacingInches: crossoverLeg
        ? (crossoverGeom?.spacingInches ??
           Math.abs((far.x - m.x) * m.nx + (far.y - m.y) * m.ny))
        : null,
      steps: 16,
    });
    const cl = { offsetAt: legGeom.offsetAt };
    const lead = legGeom.leadInches;
    const relThroat = relFrog - toward * lead;
    /** A point `s` inches past the POINTS, along the host. */
    const at = (s: number): Pt => {
      const p = sampleAt(host, Math.max(0, relThroat + toward * s));
      const off = side * cl.offsetAt(s);
      return { x: p.x + off * p.nx, y: p.y + off * p.ny };
    };
    // The span, the body, the crossover cap and the walk are the package's now
    // (see `turnoutDivergingLeg` above) — what is left here is the drawing.
    const span = legGeom.spanInches;
    const leg: Pt[] = legGeom.points;
    const frog = (() => {
      const p = sampleAt(host, Math.max(0, relThroat + toward * lead));
      const off = side * (RAIL_GAUGE_INCHES / 2);
      return { x: p.x + off * p.nx, y: p.y + off * p.ny };
    })();
    // The frog CASTING is a V: the two rails that cross here, carried on away
    // from the points. One leg follows the through route, the other the
    // diverging route, so the wedge opens the way a real frog does. (A blob
    // centred on the crossing just hides it.)
    const e = 0.05;
    const unit = (a: Pt, b: Pt) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    };
    const dLeg = unit(at(Math.max(0, lead - e)), at(lead + e));
    const hA = sampleAt(host, Math.max(0, relFrog - toward * e));
    const hB = sampleAt(host, relFrog + toward * e);
    const dHost = unit(hA, hB);
    const vLen = RAIL_GAUGE_INCHES * 1.5;
    // A part's REAL outline, when this turnout names one (#179 stage 3). The
    // package hands it back in frog-local inches — x along the through route
    // from the frog, y lateral toward the diverging side — which is the frame
    // `at()` already walks, so it maps through the same host sampling and picks
    // up the mainline's curvature for free.
    const part = drawablePartFor(t.partId, size, partLibrary);
    const local = part ? partOutlineAtFrog(part, lead) : null;
    const outline = local
      ? local.map((poly) =>
          poly.map(({ x: px, y: py }) => {
            const p = sampleAt(host, Math.max(0, relThroat + toward * (lead + px)));
            const off = side * py;
            return { x: p.x + off * p.nx, y: p.y + off * p.ny };
          }),
        )
      : null;
    // THE PART ITSELF — its moulded tie strip, so the turnout can be told apart
    // from the track past it. The leg runs until the route ARRIVES PARALLEL,
    // which on a #7 is 10.79″; the part's own diverging rail stops at 5.375″ and
    // everything beyond is flex track the OWNER lays. Drawing the whole sweep as
    // one thing is what read as "a very long diverging route… the tracks are
    // short" — the easement was right, it was just being attributed to the part.
    //
    // Only for a part we have actually MEASURED, and only at its own frog
    // number: overall length is packaging, not a function of N (the #5 and the
    // #7 are both 6.00″), so there is nothing to interpolate. No part ⇒ no
    // boundary drawn, which is the honest answer rather than an invented one.
    // Skipped for a wye (its lead is derived) and for a curved turnout (we
    // stretch that geometry to read as an arc, so a real part's strip wouldn't
    // sit on it).
    //
    // A NAMED part answers for itself. Looking the extent up by frog number
    // picks whichever part in the library carries that number, which is only the
    // same thing while no two parts share one — so once an owner has said which
    // turnout they're laying, that part's own measurements are the answer (#187).
    const named = t.partId ? partLibrary.find((p) => p.id === t.partId) : undefined;
    const ext =
      !t.curved && t.kind !== "wye"
        ? (named ? partExtent(named) : partExtentForSize(size, partLibrary))
        : null;
    const body = ext
      ? (() => {
          const s0 = -ext.behindPoints;
          const s1 = Math.min(ext.aheadOfPoints, span);
          const n = 24;
          const near: Pt[] = [];
          const far: Pt[] = [];
          for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            const p = sampleAt(host, Math.max(0, relThroat + toward * s));
            // Behind the points the two routes are the same track, so the strip
            // is simply one track wide there.
            const d = cl.offsetAt(Math.max(0, s));
            const lo = side * -TIE_HALF_LENGTH_INCHES;
            const hi = side * (d + TIE_HALF_LENGTH_INCHES);
            near.push({ x: p.x + lo * p.nx, y: p.y + lo * p.ny });
            far.push({ x: p.x + hi * p.nx, y: p.y + hi * p.ny });
          }
          return [...near, ...far.reverse()];
        })()
      : null;
    // WHERE THE RAIL JOINTS ARE. A joint is where one piece of track ends and
    // the next begins, which is exactly what became visible once turnouts
    // stopped being drawn out to meet the track they feed (#189).
    //
    // On the through route those are the two ends of the moulding, so they're
    // known only for a measured part — the same condition that draws the tie
    // strip. Guessing here would put a joint on a piece of track whose length
    // nobody has checked.
    const jointAt = (s: number): Joint => {
      const p = sampleAt(host, Math.max(0, relThroat + toward * s));
      return { x: p.x, y: p.y, nx: p.nx, ny: p.ny };
    };
    const throughJoints: Joint[] = ext
      ? [jointAt(-ext.behindPoints), jointAt(Math.min(ext.aheadOfPoints, span))]
      : [];
    // The diverging rail's own end. Its normal comes from the leg's closing
    // direction, not the host's — the leg leaves at the frog angle, so a host
    // normal would draw the tick skewed across it.
    const divergeJoint: Joint = (() => {
      const b = leg[leg.length - 1];
      const a = leg[Math.max(0, leg.length - 2)];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: b.x, y: b.y, nx: -(b.y - a.y) / d, ny: (b.x - a.x) / d };
    })();
    /**
     * ⭐ THE FLEX BEYOND THE MOULDING, EASED ONTO THE LANE IT FEEDS.
     *
     * The leg stops at the end of the part (#189) — correctly, a turnout is as
     * long as the turnout is. But the track it feeds runs at a lane offset the
     * rail hasn't reached yet, and something has to cover the difference. That
     * something is the owner's FLEX, and flex bends: carrying straight on at the
     * frog angle and then turning square onto the lane leaves a corner no rail
     * can take (9.46° on a #6 — Will spotted it on FMN-0075).
     *
     * ⭐ `turnoutClosure` ALREADY MODELS EXACTLY THIS, and has all along:
     * "straight at the frog angle for `a`, then ease the slope from 1/N to ZERO
     * over `b`, arriving parallel at the target". Giving it `arriveAtInches`
     * yields a profile that matches the leg's own angle where the moulding ends
     * (both are still in the straight stretch there, so the tangents agree
     * exactly) and flattens to parallel at the lane. No corner at either end,
     * and no new constant — the ease defaults to the lead.
     *
     * ⚠️ This is the geometry #189 took OFF the leg, because running the leg
     * itself to parallel drew 10.79″ of turnout for a 6.00″ part. It was never
     * wrong, it was only on the wrong object: the turnout keeps its true length
     * and the FLEX does the bending, which is what happens on the board.
     */
    const arrivalTo = (targetOffset: number): Pt[] | null => {
      const from = cl.offsetAt(span);
      if (!(targetOffset > from + 0.01)) return null; // already out at the lane
      const ecl = turnoutClosure(effN, {
        leadInches: legGeom.closureLeadInches,
        arriveAtInches: targetOffset,
      });
      if (!Number.isFinite(ecl.span) || !(ecl.span > span)) return null;
      const out: Pt[] = [];
      // Sampled at least as finely as the leg itself (16), so the ease reads as
      // a curve rather than as the polygon it is.
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const s = span + ((ecl.span - span) * i) / n;
        const p = sampleAt(host, Math.max(0, relThroat + toward * s));
        const off = side * ecl.offsetAt(s);
        out.push({ x: p.x + off * p.nx, y: p.y + off * p.ny });
      }
      return out;
    };
    const divergeLane = tracks.find((x) => x.id === t.divergeTrack)?.lane;
    /**
     * ⛔⛔ THE ARRIVAL CLIMBS FROM THE HOST, NOT FROM MAIN 1 (#402).
     *
     * This passed the diverging track's ABSOLUTE lane offset, which is only the
     * distance to climb when the turnout stands on the centre line. Put the
     * turnout on Main 2 and the ease overshoots by a whole lane: the arrival
     * runs past the siding, the body then starts back at the true lane, and the
     * two meet in a CUSP. Measured on FMN-0085 — bends of 70.8° and 83.1° where
     * the head joins the body, 97.4° and 96.6° at the tail, with the head
     * curling harder and harder (9° → 24° → 48° → 70°) as it overshot. Will:
     * *"the siding has kinks in the track."*
     *
     * ⚠️ IT WAS LATENT UNTIL A TURNOUT MOVED OFF MAIN 1. Absolute and
     * host-relative are the same number on the centre line, which is why every
     * earlier module drew cleanly — and why repairing FMN-0085 to feed its
     * siding from Main 2 is what exposed it.
     *
     * ⭐ Exactly the same correction as #400 in `physical-track.ts`, which had
     * this bug too and where it was found first. Two renderers, one mistake.
     */
    const hostLane = tracks.find((x) => x.id === t.onTrack)?.lane ?? 0;
    const arrival =
      divergeLane == null
        ? null
        : arrivalTo(Math.abs(laneOffset(divergeLane) - laneOffset(hostLane)));

    return {
      leg,
      arrival,
      frog,
      outline,
      body,
      throughJoints,
      divergeJoint,
      /** How far this turnout REACHES: its position on the host (`m`, the point a
       * route is authored at) to the end of its diverging rail. A turnout's `pos`
       * marks the FROG, which is inside the part, so this is non-zero for every
       * turnout — 1.63″ on a #6, 3.04″ on a #12 (#239). */
      reachInches: Math.hypot(leg[leg.length - 1].x - m.x, leg[leg.length - 1].y - m.y),
      frogV: [
        { x: frog.x + dHost.x * vLen, y: frog.y + dHost.y * vLen },
        { x: frog.x + dLeg.x * vLen, y: frog.y + dLeg.y * vLen },
      ] as [Pt, Pt],
    };
  };
  /** The lateral side (±1) a turnout's diverging route leaves toward — so a wye
   * can render a mirror leg on the opposite side. */
  const divergeSideSign = (t: CanvasTurnout): 1 | -1 => {
    const dt = tracks.find((x) => x.id === t.divergeTrack);
    const host = hostPointsOf(t.onTrack);
    if (!dt || host.length < 2) return 1;
    const m = sampleAt(host, toHostRel(t.onTrack, t.pos));
    // Same "further end, not last end" rule as `frogLegOf` (#180): a crossover
    // connector has a turnout at BOTH ends, and the one standing on the path's
    // last point measured its far end as its own position — `Math.sign(0)` is 0,
    // so the side fell through to the +1 default and its leg drew away from the
    // pair instead of across it.
    const farEnd = (() => {
      if (!dt.path || dt.path.length < 2) return null;
      const a = dt.path[0];
      const b = dt.path[dt.path.length - 1];
      const da = (a.x - m.x) ** 2 + (a.y - m.y) ** 2;
      const db = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
      return db >= da ? b : a;
    })();
    const far =
      farEnd ??
      { x: m.x + m.nx * (laneOffset(dt.lane) || LANE_SPACING_INCHES), y: m.y + m.ny * (laneOffset(dt.lane) || LANE_SPACING_INCHES) };
    return (Math.sign((far.x - m.x) * m.nx + (far.y - m.y) * m.ny) || 1) as 1 | -1;
  };
  /** spur/siding id → its throat's curved diverging leg + endpoints, so a drawn
   * track starts at the frog (one continuous curved route with its turnout). */
  /** track id → EVERY turnout leg reaching it. A passing siding has a turnout at
   * BOTH ends and a crossover connector one on each lane, so a track can have
   * several — keeping only one left the far end visually unconnected
   * (#FMN-0040). */
  const legsByTrack = useMemo(() => {
    // `frog` is the FROG MARKER (at the turnout's pos, partway along the ramp);
    // `join` is where the ramp has cleared a full track spacing and the diverging
    // track proper begins. They were the same point while the frog was pinned to
    // the ramp's end — they aren't any more (#173).
    const map = new Map<
      string,
      { throat: Pt; frog: Pt; frogV: [Pt, Pt]; join: Pt; leg: Pt[]; arrival: Pt[] | null; outline: Pt[][] | null; body: Pt[] | null; throughJoints: Joint[]; divergeJoint: Joint; turnoutId: string; reachInches: number }[]
    >();
    if (centerline.length >= 2) {
      for (const t of turnouts) {
        if (!t.divergeTrack) continue;
        const r = frogLegOf(t);
        if (!r || r.leg.length < 2) continue;
        const list = map.get(t.divergeTrack) ?? [];
        list.push({
          throat: r.leg[0],
          frog: r.frog,
          frogV: r.frogV,
          outline: r.outline,
          body: r.body,
          throughJoints: r.throughJoints,
          divergeJoint: r.divergeJoint,
          join: r.leg[r.leg.length - 1],
          leg: r.leg,
          arrival: r.arrival,
          turnoutId: t.id,
          reachInches: r.reachInches,
        });
        map.set(t.divergeTrack, list);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnouts, tracks, centerline, lengthInches]);
  /** The primary (first) leg per track — what a drawn path pins its throat to. */
  const turnoutByTrack = useMemo(() => {
    const map = new Map<
      string,
      { throat: Pt; frog: Pt; frogV: [Pt, Pt]; join: Pt; leg: Pt[]; outline: Pt[][] | null; body: Pt[] | null; throughJoints: Joint[]; divergeJoint: Joint; turnoutId: string }
    >();
    for (const [id, legs] of legsByTrack) map.set(id, legs[0]);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnouts, tracks, centerline, lengthInches]);
  /**
   * A drawn track's path — exactly as authored.
   *
   * ⚠️ This used to PIN the first point to the turnout's leg and prepend the leg
   * to the drawn band, so a spur always appeared welded to its turnout. It no
   * longer does either. A turnout is a part of a fixed length; the track that
   * meets it is the owner's, and where it starts is theirs to say. Silently
   * moving their first point hid the gap rather than closing it, and hid it in
   * only one of the two renderers besides — the read-only view drew the raw path
   * and showed the route detached (#181, and now #189).
   *
   * The owner closes the gap by dragging the TRACK's end onto the turnout's
   * rail, where it snaps. The turnout doesn't move: it's positioned by its frog.
   */
  /**
   * An authored path, as authored — except that a CROSSOVER's ends are re-laid
   * onto the lanes as they actually run (#180).
   *
   * A connector's two points were computed at DROP time from the standard lane
   * offsets and then stored. Once the pair pinches, those stored ends no longer
   * sit on the rails they connect: the diagonal stops 0.035″ short of the track
   * it is supposed to meet. Sub-pixel, but it is a drawn claim that two rails
   * join where they don't, and the whole point of this feature is drawing the
   * geometry the module really has.
   *
   * Re-laying only the ENDS keeps any bend the owner put in the middle. Nothing
   * else is touched: every other authored path draws exactly as authored (#189).
   */
  const authoredTrackPath = (t: CanvasTrack): BenchworkPoint[] => {
    const path = t.path ?? [];
    if (t.role !== "crossover" || path.length < 2 || !pinches.length) return path;
    if (centerline.length < 2) return path;
    const relay = (p: BenchworkPoint): BenchworkPoint => {
      const { pos } = projectToCenterline(centerline, p);
      const c = sampleAt(centerline, pos);
      const off = (p.x - c.x) * c.nx + (p.y - c.y) * c.ny;
      // Which lane is this end on? The nearest one by its standard offset —
      // the stored point predates the pinch, so it is still at lane spacing.
      const lane = Math.round(off / LANE_SPACING_INCHES);
      const want = laneOffsetAt(lane, pos, pinches);
      return { ...p, x: c.x + c.nx * want, y: c.y + c.ny * want };
    };
    const out = [...path];
    out[0] = relay(out[0]);
    out[out.length - 1] = relay(out[out.length - 1]);
    return out;
  };

  /**
   * A crossover connector's band: BETWEEN THE TWO TURNOUTS' JOINS, not between
   * the two mains (#196).
   *
   * Its authored path runs main centre-line to main centre-line, which is the
   * ground the two turnouts' own diverging legs already cover — so the diagonal
   * was drawn twice, once by the connector and once by each leg, and a double
   * crossover came out as six diagonals instead of two.
   *
   * Every other track already splits this way: the turnout owns its diverging
   * rails, and the track it feeds begins where they end (#189). A siding's
   * authored path simply starts after the leg; a connector's didn't, because it
   * was generated from the two mains at drop time. Deriving it from the joins
   * makes leg → band → leg one continuous route, and lands its ends on the
   * PINCHED rails for free, since the legs are walked from the hosts and those
   * follow `lanePath` (#180).
   *
   * Null unless exactly two turnouts reach it — one at each end is what makes a
   * crossover a crossover, and anything else is data we shouldn't guess about.
   */
  const crossoverBody = (t: CanvasTrack): Pt[] | null => {
    if (t.role !== "crossover") return null;
    const legs = legsByTrack.get(t.id);
    if (!legs || legs.length !== 2) return null;
    const [a, b] = legs;
    const d = Math.hypot(a.join.x - b.join.x, a.join.y - b.join.y);
    // ⚠️ EMPTY, NOT NULL. Legs that already meet leave nothing to bridge — but
    // the caller reads `crossoverBody(t) ?? <authored path>`, so returning null
    // here does not mean "draw nothing", it means "fall back to the stored
    // main-centre-to-main-centre path" — the very path this function exists to
    // stop drawing (#196). On a correctly-spaced double crossover the two legs
    // meet within 0.01″, so the fallback fired and one of the two connectors
    // drew a full-width diagonal across the assembly.
    //
    // null is reserved for "this isn't a crossover, or its data can't be read"
    // — the cases where the fallback IS right. An empty band is dropped by the
    // caller's `pts.length > 1` filter.
    return d < 0.05 ? [] : [a.join, b.join];
  };

  /** A stub spur's diverging route, angled away like the prototype (Option 1):
   * the throat→frog leg (already at the frog angle) CONTINUES straight along the
   * frog tangent, instead of bending back to run parallel to the main. So a
   * straight turnout throws a single clean diagonal at atan(1/N); a curved one
   * carries the curve on. Length ≈ the stub's along-main span (the leg is the
   * turnout body; the tail is the track beyond it). Null → not a turnout stub. */
  const divergingStubPath = (t: CanvasTrack): Pt[] | null => {
    // Main 2 is a MAIN — it runs parallel at its lane and meets Main 1 through
    // the transition turnout's leg, so it never angles away like a spur (#131).
    if (t.id === MAIN2_TRACK_ID) return null;
    const legs = legsByTrack.get(t.id);
    // Only a genuinely single-ended track (a spur/stub) angles away. A track
    // reached by TWO turnouts is a passing siding — it must stay parallel and
    // meet the main at both ends, not swing off one (#FMN-0040).
    if (!legs || legs.length !== 1) return null;
    const sw = legs[0];
    if (sw.leg.length < 2) return null;
    const leg = sw.leg;
    const frog = leg[leg.length - 1];
    const prev = leg[leg.length - 2];
    const dl = Math.hypot(frog.x - prev.x, frog.y - prev.y) || 1;
    const dx = (frog.x - prev.x) / dl;
    const dy = (frog.y - prev.y) / dl;
    let legLen = 0;
    for (let i = 1; i < leg.length; i++)
      legLen += Math.hypot(leg[i].x - leg[i - 1].x, leg[i].y - leg[i - 1].y);
    const tailLen = Math.max(2, Math.abs(t.toPos - t.fromPos) - legLen);
    return [...leg.map((p) => ({ x: p.x, y: p.y })), { x: frog.x + dx * tailLen, y: frog.y + dy * tailLen }];
  };

  /**
   * ⭐⭐ WHERE A TRACK'S DRAWN RUN REALLY BEGINS — the flex bends off the RAIL
   * END, it does not start at the lane (#349).
   *
   * A turnout's drawn leg stops at the end of the real part (#189), and that is
   * only ~0.605″ off the main **whatever the frog number** — a #6 needs 6.75″ to
   * reach one track spacing and its part is 4.813″ long. So a body drawn at the
   * full lane offset can never meet it: 0.518″ short at lane 1, 1.643″ at lane 2.
   * Measured on prod: FMN-0083 0.52″, FMN-0085 3.23″ — the gap Will reported
   * twice.
   *
   * ⛔ AND NO DRAG COULD CLOSE IT. #189 says the run from the turnout out to the
   * track is *"flex track they lay and snap"* — but dragging an end moves it
   * ALONG the main, while the body is always drawn AT the lane. So the ring's
   * instruction, *"drag the track's end onto it"*, asked for a gesture that does
   * not exist for a siding.
   *
   * ⭐ The geometry to fix it was already built and already correct: `arrival`
   * is computed for EVERY diverging track from that track's own lane, and Main 2
   * has been using it since #189 — which is exactly why Main 2 meets its leg at
   * **0.00″** on FMN-0075 while a siding on the same module stands 0.52″ off.
   * It was never a Main 2 exception; it was the only case that had been wired up.
   *
   * ⚠️ THIS DOES NOT REVERSE #189. The track still runs between the positions
   * its owner gave it — the ease is prepended, and the body starts where the
   * ease hands over, so nothing is stretched to reach anything.
   */
  const withArrivals = (t: CanvasTrack, fromPos: number, toPos: number) => {
    let from = fromPos;
    let to = toPos;
    let head: Pt[] | null = null;
    let tail: Pt[] | null = null;
    for (const l of legsByTrack.get(t.id) ?? []) {
      if (!l.arrival || l.arrival.length < 2) continue;
      const jp = projectToCenterline(centerline, l.join).pos;
      // Where the eased arrival hands over to the plain lane run.
      const end = l.arrival[l.arrival.length - 1];
      const handover = projectToCenterline(centerline, end).pos;
      // Which END of this track the leg belongs to — compared against the
      // ORIGINAL extent, so a first leg that moves `from` cannot then mislead
      // the second into thinking it is also the western one.
      const west = Math.abs(fromPos - jp) <= Math.abs(toPos - jp);
      if (west) {
        from = handover;
        head = l.arrival;
      } else {
        to = handover;
        tail = l.arrival;
      }
    }
    return { from, to, head, tail };
  };

  /**
   * ⭐⭐ JOIN A RUN'S ARRIVALS TO ITS BODY SO THEY MEET EXACTLY (#404).
   *
   * ⛔ `withArrivals` finds the handover by PROJECTING the arrival's end onto
   * the centre-line, and `lanePath` then regenerates a point at that position.
   * That is the handover derived TWICE: the projection drops the perpendicular
   * residual, so the body begins a fraction off where the arrival really
   * finished and the line doubles back — a small hook, measured at 0.16″–0.31″
   * on FMN-0085 and reading as a kink in the rail.
   *
   * ⭐ The arrival's endpoint is the one that came from the turnout's own
   * geometry, so it wins: the body is snapped to it at both ends. ONE
   * definition, and both bodies below use it rather than repeating the splice.
   */
  const spliceArrivals = (head: Pt[] | null, body: Pt[], tail: Pt[] | null): Pt[] => {
    const back = tail ? [...tail].reverse() : [];
    /**
     * ⚠️ DROP the body's own end point rather than OVERWRITING it (#410). #404
     * set it equal to the arrival's end, which meets exactly but leaves the
     * same point in the list TWICE — a zero-length segment. Harmless on screen,
     * but `atan2(0, 0)` is 0, so every heading-based measurement reads a phantom
     * ~123° turn there. **It fooled my own kink metric twice**, and I reported a
     * visible notch that was not in the drawing: the real turn across that join
     * is 1.1° (−124.1° → −123.0°).
     *
     * The arrival owns the endpoint, so the body simply starts one sample later.
     */
    const mid = [...body];
    if (head?.length && mid.length > 1) mid.shift();
    if (back.length && mid.length > 1) mid.pop();
    return [...(head ?? []), ...mid, ...back];
  };
  /** A passing siding's BODY — the parallel run between its two turnouts,
   * clipped to their FROGS so it meets each diverging leg end-to-end. Without
   * this the body drew the full fromPos→toPos on the lane while the legs ended
   * at the frogs, so the siding read as two disjoint lines and dragging the
   * straight one pulled it out from under the legs (#133). Null unless the
   * track is genuinely reached by two turnouts. */
  const passingSidingBody = (t: CanvasTrack): Pt[] | null => {
    const legs = legsByTrack.get(t.id);
    if (!legs || legs.length < 2) return null;
    // Each bounding leg's frog, with its position along the main AND its signed
    // lateral offset from the centre-line. The body must ride the side the
    // FROGS are on, not the track's stored lane — those two can disagree (a
    // spur auto-lands on a positive lane while its leg diverges below), which
    // made the body zig-zag across the main between frogs pinned on the far
    // side (#133).
    // Measure at each leg's JOIN — where the ramp has reached full track spacing
    // and the parallel body actually starts. (The frog is only ~½″ off the main,
    // so riding the frogs' offset would draw the siding almost on top of it.)
    const at = legs
      .map((l) => {
        const c = sampleAt(centerline, projectToCenterline(centerline, l.join).pos);
        return {
          pos: projectToCenterline(centerline, l.join).pos,
          off: (l.join.x - c.x) * c.nx + (l.join.y - c.y) * c.ny,
          frog: l.join,
        };
      })
      .sort((a, b) => a.pos - b.pos);
    // A genuine passing siding has both frogs on the SAME side; if they aren't,
    // it isn't a valid siding — leave it to the lane fallback rather than draw
    // a track that crosses its own main.
    if (Math.sign(at[0].off) !== Math.sign(at[at.length - 1].off)) return null;
    // The SIDE still comes from the turnouts — a track's stored lane sign and
    // the side its frogs actually diverge to can disagree, and riding the stored
    // sign made the body zig-zag across the main (#138). But the OFFSET is the
    // track's own lane, not the leg's: the leg now stops at the end of the part,
    // barely off the main, so borrowing its offset would drag the siding down
    // on top of the mainline (#189).
    const side = Math.sign(at[0].off) || 1;
    const off = side * (Math.abs(laneOffset(t.lane)) || LANE_SPACING_INCHES);
    const body: Pt[] = [];
    // ⚠️ Runs between the track's OWN extent, not frog to frog — a passing siding
    // is as long as its owner said (#189). What changed in #349 is only that the
    // flex from each turnout is now DRAWN, easing off the rail end out to the
    // lane, instead of being left as a hole the owner could not close.
    const { from, to, head, tail } = withArrivals(t, t.fromPos, t.toPos);
    /**
     * ⭐⭐ SAMPLED BY LENGTH, the same rule as `lanePath` (#406/#408).
     *
     * ⛔ A flat 24 gave a 107″ siding 4.5″ segments while its own arrivals are
     * sampled at 1.26″, so the two met at a visible angle — a 123° notch over
     * 1.23″ where the body joins the tail, left standing after #406 fixed the
     * mains because THIS FUNCTION NEVER CALLED `lanePath`. It is a third
     * implementation of "sample a lane-offset track", and it kept its own
     * constant.
     *
     * ⚠️ Not simply delegated to `lanePath`: this one deliberately uses a FIXED
     * offset taken from the leg's own side (see above), where `lanePath` re-reads
     * `laneOffsetAt` per step. Matching the RULE is the safe half of the merge;
     * unifying the two is a bigger change than a notch is worth tonight.
     */
    const steps = Math.max(24, Math.ceil(Math.abs(to - from)));
    for (let i = 0; i <= steps; i++) {
      const pos = from + ((to - from) * i) / steps;
      const c = sampleAt(centerline, pos);
      body.push({ x: c.x + c.nx * off, y: c.y + c.ny * off });
    }
    if (body.length < 2) return null;
    // `body` runs west→east, so the west leg's ease goes in front and the east
    // leg's on the end, reversed to keep the run in one direction.
    return spliceArrivals(head, body, tail);
  };

  /** A plain lane-parallel body, CLIPPED to any turnout leg reaching it — so the
   * rails run continuously from the leg into the track instead of the body
   * carrying on underneath it. A track's stored extent ends at the turnout's
   * FROG, but the leg only becomes parallel at its JOIN further along, so the
   * two overlapped by (ramp − lead) and neither met the other end-to-end. Main 2
   * showed this plainly: body 0→17.4, leg 21.8→10.6 (#173 follow-up). Tracks
   * with two legs are handled by passingSidingBody; this covers the rest. */
  const laneBody = (t: CanvasTrack): Pt[] => {
    // ⚠️ Still not PULLED OUT to any turnout's join: the track runs between the
    // positions its owner gave it (#189). The turnout's flex is DRAWN in front
    // of that run rather than the run being stretched back to meet it (#349).
    //
    // ⛔ THIS USED TO BE A MAIN 2 EXCEPTION, on the reasoning that Main 2's
    // extent is derived and has no draggable end, so "leaving it detached would
    // show the owner a gap they have no way to close". That reasoning turns out
    // to cover EVERY track: dragging a siding's end moves it along the main
    // while its body is drawn at the lane, so no drag closes the 0.518″ that a
    // leg cannot reach. Main 2 was not the exception — it was the only case that
    // had been wired up.
    /**
     * ⭐ THE FLEX BENDS OFF THE RAIL END — it doesn't start at the lane.
     *
     * The join above was made ALONG the main and nowhere else: `l.join` was
     * projected to a position, which throws away how far off the main the leg
     * actually ended, and the body was then drawn at the FULL lane offset from
     * that position. So the two met in x and stood 0.52″ apart in y on FMN-0075
     * — the gap Will pointed at. It is bigger on a #10, whose rail ends lower.
     *
     * Neither half was wrong on its own: #189 deliberately ends the drawn leg at
     * the part's own diverging rail (running it out until parallel drew 10.79″
     * of turnout for a 6.00″ part), and this assumed reaching the same position
     * meant meeting. They were true at different times.
     *
     * So carry on from where the rail really ends, along the direction the leg
     * is really pointing, until the lane is reached — which is what the owner's
     * flex does. ⚠️ NO new constant and no eased curve: the leg leaves straight
     * at the frog angle, so continuing straight is tangent-continuous by
     * construction and there is no drawing convention to invent.
     */
    const { from, to, head, tail } = withArrivals(t, t.fromPos, t.toPos);
    // `lanePath` always runs west→east, so the west leg's arrival goes in front
    // and the east leg's on the end, reversed to keep the run in one direction.
    const body = lanePath(centerline, from, to, t.lane, 24, pinches);
    if (!body.length) return body;
    return spliceArrivals(head, body, tail);
  };

  /** A wye's mirrored second route — the leg forced to the opposite side, then
   * continued along its frog tangent to the same length as the (real) spur, so
   * the turnout reads as a symmetric Y. Rendered as a band; it isn't a separately
   * editable track (a wye is symmetric — the two routes mirror). */
  const wyeMirrorLegs = useMemo(() => {
    if (centerline.length < 2) return [];
    const out: { id: string; frog: Pt; pts: Pt[] }[] = [];
    for (const t of turnouts) {
      if (t.kind !== "wye" || !t.divergeTrack) continue;
      const spur = tracks.find((x) => x.id === t.divergeTrack);
      if (!spur) continue;
      const r = frogLegOf(t, (-divergeSideSign(t)) as 1 | -1);
      if (!r || r.leg.length < 2) continue;
      const leg = r.leg;
      const frog = leg[leg.length - 1];
      const prev = leg[leg.length - 2];
      const dl = Math.hypot(frog.x - prev.x, frog.y - prev.y) || 1;
      const dx = (frog.x - prev.x) / dl;
      const dy = (frog.y - prev.y) / dl;
      let legLen = 0;
      for (let i = 1; i < leg.length; i++)
        legLen += Math.hypot(leg[i].x - leg[i - 1].x, leg[i].y - leg[i - 1].y);
      const tailLen = Math.max(2, Math.abs(spur.toPos - spur.fromPos) - legLen);
      out.push({
        id: `${t.id}-wye`,
        frog,
        pts: [...leg.map((p) => ({ x: p.x, y: p.y })), { x: frog.x + dx * tailLen, y: frog.y + dy * tailLen }],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnouts, tracks, centerline, lengthInches]);

  /** Turnout legs that the track band itself doesn't already include — the far
   * end of a passing siding, the second turnout of a crossover connector — so
   * every turnout visibly joins what it diverges to (#FMN-0040). */
  const connectorLegs = useMemo(() => {
    const out: { id: string; pts: Pt[] }[] = [];
    for (const [trackId, legs] of legsByTrack) {
      const t = tracks.find((x) => x.id === trackId);
      if (!t) continue;
      // A turnout's own diverging rails are the TURNOUT's to draw, so they are
      // drawn here for everything — an authored path no longer prepends the leg,
      // and a passing siding's body no longer runs frog to frog (#189).
      //
      // The one exception is a bare STUB: it has no authored geometry of its
      // own, so `divergingStubPath` builds it as leg + tail in one piece and
      // already includes leg[0]. Drawing it again would double the ink.
      const authored = !!(t.path && t.path.length >= 2);
      const stub = !authored && legs.length === 1 && trackId !== MAIN2_TRACK_ID;
      const bandCarriesLeg0 = stub;
      for (let i = bandCarriesLeg0 ? 1 : 0; i < legs.length; i++) {
        out.push({ id: `${trackId}-leg${i}`, pts: legs[i].leg });
      }
    }
    return out;
  }, [legsByTrack, tracks]);

  /** The main centre-line drawn as segments, with a GAP across each wye on the
   * main — a true 2-way wye has no straight-through, so the two mirrored legs
   * take over where the straight main would otherwise bisect the Y. The main
   * stays the coordinate spine underneath; it's just not drawn across the wye. */
  const mainSegments = useMemo(() => {
    if (centerline.length < 2) return [];
    // ⚠️ THE MAIN IS NEVER GAPPED. It used to be cut across every wye (v0.15.26)
    // so a straight band would not bisect the Y — back when the main was a plain
    // band and a wye had no real geometry of its own. Two things were wrong with
    // that once wyes started drawing true mirrored legs:
    //
    //   1. The gap was as long as the DIVERGING TRACK, not the wye's legs
    //      (`|spur.toPos - spur.fromPos|`). A wye feeding a 30" siding erased
    //      30" of main. That is the "through route's rails cut off" report.
    //   2. Erasing one route to stop it overlapping another is the wrong fix.
    //      Both routes' rails should MEET, and the closure geometry now makes
    //      them meet.
    //
    // If a straight band ever appears to bisect a Y again, fix the wye's leg
    // geometry — do not delete the main to hide it.
    const clips: [number, number][] = [];
    // Main 1 rides mainLane — 0 normally, 1 when swapped so it's the upper
    // track. The swap already flips Main 2 (its doc lane); this makes the
    // realistic view honour it for Main 1 too, instead of stacking both on
    // lane 0 (#131).
    const mainAt = (s: number, e: number) =>
      lanePath(centerline, s, e, mainLane, 24, pinches);
    if (clips.length === 0) return [mainAt(0, lengthInches)];
    clips.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const c of clips) {
      const last = merged[merged.length - 1];
      if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1]);
      else merged.push([...c] as [number, number]);
    }
    const keeps: [number, number][] = [];
    let cur = 0;
    for (const [s, e] of merged) {
      if (s > cur) keeps.push([cur, s]);
      cur = Math.max(cur, e);
    }
    if (cur < lengthInches) keeps.push([cur, lengthInches]);
    return keeps.map(([s, e]) => mainAt(s, e)).filter((p) => p.length >= 2);
    // `turnouts`/`tracks` are deliberately absent: the wye gapping that used
    // them is gone (see above), so the body no longer reads either.
  }, [centerline, lengthInches, mainLane, pinches]);

  const trackPaths = useMemo(
    () =>
      centerline.length >= 2
        ? tracks
            .map((t) => ({
              id: t.id,
              pts:
                // Main 2 is a main, not a spur — its authored path draws as-is,
                // with no throat→frog leg prepended (#131).
                // Any authored path draws AS AUTHORED — Main 2 always did; every
                // other drawn track does now too (#189).
                // A crossover's band is derived from its turnouts' joins, not
                // from the stored main-to-main path — see `crossoverBody`.
                crossoverBody(t) ??
                (t.path && t.path.length >= 2
                  ? samplePath(authoredTrackPath(t))
                  : (divergingStubPath(t) ?? passingSidingBody(t) ?? laneBody(t))),
            }))
            .filter((t) => t.pts.length > 1)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerline, tracks, turnoutByTrack],
  );
  const turnoutPts = useMemo(
    () =>
      centerline.length >= 2
        ? turnouts.map((t) => {
            // The turnout sits on its host track (main or a spur); its frog node
            // marks where the diverging leg has cleared one track over.
            const m = sampleAt(hostPointsOf(t.onTrack), toHostRel(t.onTrack, t.pos));
            // The frog marker belongs to the turnout whose leg draws the route —
            // a crossover connector has a turnout on BOTH ends, and drawing the
            // shared frog from both doubled the circles at the far end.
            const sw = t.divergeTrack ? turnoutByTrack.get(t.divergeTrack) : undefined;
            // THIS turnout's own leg. `turnoutByTrack` keeps only the FIRST leg
            // reaching a track, which is right for the frog marker (a passing
            // siding's two turnouts once shared a leg and drew doubled circles,
            // #81) but wrong for the part BODY: each turnout is a separate
            // physical turnout and draws its own moulding. Without this, a
            // passing siding's second turnout showed rail joints at a tie strip
            // that was never drawn.
            const mine = t.divergeTrack
              ? legsByTrack.get(t.divergeTrack)?.find((l) => l.turnoutId === t.id)
              : undefined;
            return {
              id: t.id,
              x: m.x,
              y: m.y,
              frog: sw && sw.turnoutId === t.id ? sw.frog : null,
              outline: sw && sw.turnoutId === t.id ? sw.outline : null,
              body: mine?.body ?? null,
              frogV: sw && sw.turnoutId === t.id ? sw.frogV : null,
            };
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerline, turnouts, tracks, turnoutByTrack, legsByTrack, lengthInches],
  );
  /** Draggable end handles for sidings/spurs (not the derived Main 2). */
  const trackEnds = useMemo(() => {
    if (centerline.length < 2) return [];
    return tracks
      // A drawn spur is positioned by its path, not fromPos/toPos — no end drags.
      //
      // ⛔⛔ A PASSING SIDING USED TO BE EXCLUDED HERE — `legs < 2` — on the
      // grounds that it "is pinned to its two turnouts, move those". IT IS NOT
      // PINNED TO ANYTHING. `moveTurnout` sets the turnout's `pos` and touches
      // no track, so nothing ever carried the siding, and FMN-0064 sat at
      // 16→365 with its turnouts at 13 and 367 — ends short of both legs, and
      // the one affordance that could close the gap taken away. The siding
      // selected, and then refused to move.
      //
      // #133's real complaint was that an end drag pulled the body OFF the
      // legs, which is a case for SNAPPING the end to the leg — what the drag
      // handler now does, and what this file already documents as the intended
      // gesture: "the owner closes the gap by dragging the TRACK's end onto the
      // turnout's rail, where it snaps." Removing the handle didn't keep the
      // body on the legs; it just made the gap permanent.
      .filter((t) => t.editable && !(t.path && t.path.length >= 2))
      .flatMap((t) => {
        // A turnout stub angles away — its far end sits at the end of the
        // diverging route, and its throat is pinned to the turnout (no from
        // handle). Drag the far end to lengthen/shorten the diverging track.
        const dv = divergingStubPath(t);
        if (dv && dv.length >= 2) {
          const e = dv[dv.length - 1];
          return [{ id: t.id, end: "to" as const, x: e.x, y: e.y }];
        }
        const off = laneOffset(t.lane);
        return (["from", "to"] as const).map((end) => {
          const p = sampleAt(centerline, end === "from" ? t.fromPos : t.toPos);
          return { id: t.id, end, x: p.x + p.nx * off, y: p.y + p.ny * off };
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerline, tracks, turnoutByTrack]);
  const signalPts = useMemo(
    () =>
      centerline.length >= 2
        ? signals.map((s) => {
            const p = sampleAt(centerline, s.pos);
            const off = (s.side === "above" ? 1 : -1) * (laneOffset(1) + 1.5);
            // Base on the track it governs; head offset out to `side`, so the
            // mast can be drawn as a stem + head instead of a bare dot.
            return {
              id: s.id,
              cp: s.cp,
              facing: s.facing,
              bx: p.x,
              by: p.y,
              x: p.x + p.nx * off,
              y: p.y + p.ny * off,
            };
          })
        : [],
    [centerline, signals],
  );
  /**
   * Industries — a car-spot span drawn beyond the track it serves, on `side`.
   *
   * The span RIDES ITS TRACK (#186). It used to be sampled along the module's
   * centre-line and pushed out by the track's lane offset, which is the same
   * thing only while the track runs straight beside the main — so on a curved
   * or hand-drawn spur the track curved away and the highlight stayed straight.
   * Sampling the track's own polyline is the same operation, one level down.
   */
  const industryShapes = useMemo(() => {
    if (centerline.length < 2) return [];
    return industries.map((ind) => {
      /**
       * ⭐⭐ THE BAND FOLLOWS THE LINE THAT IS DRAWN (#412).
       *
       * ⛔ This read `hostPointsOf`, the simplified re-derivation — `lanePath`
       * over the stored extent — so the band was always a plain lane-parallel
       * strip. The canvas draws the track as leg + eased arrival + body, so
       * wherever a track leaves its turnout at an angle the band stayed
       * straight and drifted off it. Will, on FMN-0083's spur: *"the industry
       * spur is at an angle, but the industry highlight is not."*
       *
       * ⭐ Exactly #388 again, in a third consumer — the joints had it, the
       * pieces had it, and the industry band had it too. `trackPaths` is the one
       * answer to "where is this track"; sampling it means the band cannot be
       * anywhere the rail isn't.
       *
       * ⚠️ An industry on the MAIN finds no entry (only `main` is excluded from
       * `trackPaths`) and correctly falls back to the centre-line.
       */
      const drawnHost = trackPaths.find((tp) => tp.id === ind.track)?.pts;
      const host =
        drawnHost && drawnHost.length >= 2 ? drawnHost : hostPointsOf(ind.track);
      const rel = (abs: number) => relAlongPoints(host, abs);
      const midPos = (ind.fromPos + ind.toPos) / 2;
      /**
       * ⚠️ `ind.side` NO LONGER MOVES ANYTHING ON THIS CANVAS, and that is a
       * consequence worth stating rather than leaving to be rediscovered.
       *
       * Both the mark and its name now sit ON the served track, so there is no
       * "above/below" for either to take. This used to need a `sign` from the
       * side AND a `flip` settled against the centre-line, because `sampleAt`
       * returns the LEFT normal of whatever it walked — a track drawn east→west
       * has one pointing the opposite way from the module's, so "above" came
       * out below. That whole correction is gone with the offset it corrected.
       *
       * ⭐ The FIELD is untouched: it is authored, it still ships to FD, and FD
       * still places its label with it. Only this renderer stopped consulting
       * it. Whether the builder should keep offering the control is Will's
       * call, not something to settle by deleting a stored value.
       */
      const at = (abs: number, o: number) => {
        const p = sampleAt(host, rel(abs));
        return { x: p.x + p.nx * o, y: p.y + p.ny * o };
      };
      const a0 = Math.min(ind.fromPos, ind.toPos);
      const b0 = Math.max(ind.fromPos, ind.toPos);
      const steps = 16;
      const bandAt = (o: number) => {
        const out: Pt[] = [];
        for (let s = 0; s <= steps && b0 - a0 > 0.01; s++) {
          out.push(at(a0 + ((b0 - a0) * s) / steps, o));
        }
        return out;
      };
      /**
       * ⭐⭐ THE MARKER IS THE TRACK ITSELF — offset ZERO (Will, 2026-09-05:
       * *"it may be better to specifically highlight the track and not above or
       * below the track."*).
       *
       * ⛔⛔ THIS REPLACES A CLEARANCE SEARCH, AND THAT IS THE POINT. The band
       * used to be drawn BESIDE the rail — `sign * flip * LANE_SPACING × 0.9` —
       * which put a mark describing one track into the space belonging to
       * others. #421 was that mark lying across a spur it does not serve
       * (measured on FMN-0083: gap −0.226″ at x=20, +0.108″ at x=22, crossing
       * at x≈21.4), and the fix was a four-candidate search for an offset that
       * cleared everything drawn. ⭐⭐ **A mark drawn ON the thing it describes
       * cannot interfere with anything else — the whole class goes away by
       * construction rather than by a constant.** So `chooseBandOffset`, the
       * 0.35″ clearance and the "crowded" report all retire with it.
       *
       * ⭐ `side` is NOT dropped — it is authored, and it says which side the
       * building and its dock stand on. It still places the NAME, below.
       */
      const path: Pt[] = bandAt(0);
      return {
        id: ind.id,
        industryId: ind.industryId,
        editable: ind.editable,
        side: ind.side,
        name: ind.name,
        sub: ind.sub,
        path,
        ends: [
          { end: "from" as const, ...at(ind.fromPos, 0) },
          { end: "to" as const, ...at(ind.toPos, 0) },
        ],
        /**
         * ⭐⭐ THE NAME SITS ON THE HIGHLIGHT (Will, 2026-09-05: *"the text
         * should overlay over the highlight, but it needs to be readable"*).
         *
         * Offset zero, like the mark itself. Put beside the track it competed
         * for the same lane space the band used to, which is the problem this
         * whole change removes — a label off to one side is a smaller version
         * of the same mistake. Readability comes from a halo behind the glyphs
         * (`paintOrder="stroke"`), not from moving the text somewhere emptier.
         */
        label: at(midPos, 0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerline, industries, tracks, trackPaths]);

  /**
   * Measure the tightest curve in every drawn track and hand it up (#421).
   *
   * ⚠️ TURNOUT LEGS ARE EXCLUDED. `trackPaths` carries `<id>-leg<n>` entries
   * built from the turnout PART's own geometry — a #4's diverging radius is a
   * property of the product the owner chose, not of a curve they drew, and
   * warning about it would be telling them their turnout is the wrong shape.
   *
   * ⚠️ Industry bands are not in here at all; they live in `industryShapes`.
   * A survey that scanned every `<polyline>` counted "Curve Feed" as a track
   * at 6.69″ — the band, not the rail.
   */
  const curveRadii = useMemo(
    () =>
      [
        /**
         * ⛔⛔ THE MAIN IS NOT IN `trackPaths` — AND THE STANDARD IS ABOUT MAINS.
         *
         * `trackPaths` maps over `tracks`, which is the EXTRA tracks; the main
         * IS the centre-line and has no entry there. Shipped without this, the
         * check measured every track except the one the 22″ rule exists for:
         * FMN-0081's main curves at 7.7″ and the builder stayed silent while
         * happily flagging Main 2 on another module. Caught by verifying a
         * module I had predicted WOULD warn, which is the only reason it
         * surfaced.
         */
        ...(centerline.length > 2
          ? [{ id: MAIN_TRACK_ID, minRadius: minCurveRadius(centerline) }]
          : []),
        ...trackPaths
          .filter((tp) => !/-leg\d+$/.test(tp.id) && tp.pts.length > 2)
          .map((tp) => ({ id: tp.id, minRadius: minCurveRadius(tp.pts) })),
      ].filter((r) => Number.isFinite(r.minRadius)),
    [trackPaths, centerline],
  );
  // Same stability trick as below: a key that only changes when the ANSWER
  // does, so this never sets parent state on a bare re-render.
  const radiiKey = useMemo(
    () => curveRadii.map((r) => `${r.id}:${r.minRadius.toFixed(2)}`).join(","),
    [curveRadii],
  );
  useEffect(() => {
    onTrackCurveRadii?.(
      radiiKey
        ? radiiKey.split(",").map((s) => {
            const i = s.lastIndexOf(":");
            return { id: s.slice(0, i), minRadius: Number(s.slice(i + 1)) };
          })
        : [],
    );
  }, [radiiKey, onTrackCurveRadii]);

  /**
   * Tell the builder which bands could not be placed clear (#421).
   *
   * ⚠️ REPORTED THROUGH A STABLE KEY, NOT THE ARRAY. `industryShapes` is a new
   * array on every geometry change, so calling the parent with it directly
   * would set state on every render and spin. The joined id string only changes
   * when the SET changes, which is the only thing the warning list cares about.
   *
   * ⚠️ And in an effect, never during render: this writes to the parent, and a
   * write-capable call in render is the mistake the React compiler was right
   * about (#284).
   */
  /** Content bounds in world (module-local) inches — what "Fit" frames to. */
  const bounds = useMemo<ViewBox>(() => {
    const ctx = [...centerline, ...trackPaths.flatMap((t) => t.pts)];
    const other = contextOutlines.flatMap((c) => c.outline);
    const xs = [0, lengthInches, ...anchors.map((a) => a.x), ...sampled.map((p) => p.x), ...ctx.map((p) => p.x), ...other.map((p) => p.x)];
    const ys = [-16, 16, ...anchors.map((a) => a.y), ...sampled.map((p) => p.y), ...ctx.map((p) => p.y), ...other.map((p) => p.y)];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = Math.max(8, (maxX - minX) * 0.08);
    return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [lengthInches, anchors, sampled, centerline, trackPaths, contextOutlines]);

  // The viewport in world inches. `null` = follow content (auto-fit) until the
  // first zoom/pan — so a fresh module frames itself, but once you take control
  // the view stops jumping every time you drag a corner.
  const [view, setView] = useState<ViewBox | null>(null);
  const vbBox = view ?? bounds;

  // Measure the SVG in device pixels so line weights, handle sizes and grid
  // density are constant on screen instead of drifting with zoom.
  const [px, setPx] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // getBoundingClientRect is reliable for an inline SVG; ResizeObserver's
    // contentRect can report 0 height for one, which would strand `scale` on
    // its fallback (and peg the zoom readout at 100%).
    //
    // ⚠️⚠️ TWO WAYS THIS SILENTLY WRECKS THE WHOLE CANVAS, both found by
    // mounting the editor in a container that had not been laid out yet:
    //
    // 1. **A BORDERED SVG NEVER MEASURES ZERO — it measures its border, 2×2.**
    //    So a "no size yet" first paint sails through a `width && height` guard
    //    and is taken as the truth. `scale` then comes out ~600× too small and
    //    EVERY device-constant mark is drawn in board-sized inches: the corner
    //    handles become 224″ circles covering the module, invisible against the
    //    background but swallowing every click, so the canvas looks fine and is
    //    completely dead. Demand a plausible size instead.
    //
    // 2. **ResizeObserver does not fire for an inline SVG** here — the element
    //    grew from 2px to 1264 and no callback ever arrived, so nothing ever
    //    corrected (1). Observe the PARENT, which is an ordinary block box, and
    //    keep measuring the SVG itself.
    const measure = () => {
      const b = el.getBoundingClientRect();
      if (!(b.width > 4 && b.height > 4)) return false;
      setPx({ w: b.width, h: b.height });
      return true;
    };
    // 3. **AND NO EVENT EVER ARRIVES FOR A SIZE THAT WAS SIMPLY NOT THERE YET.**
    //    If the first measurement is too early and the box never changes again
    //    afterwards, both the observer and the resize listener stay silent and
    //    the canvas is stuck on its fallback scale for the life of the page —
    //    every handle drawn inches wide, and the grab radius nine inches. So
    //    keep looking for a few frames until the layout settles. This is the
    //    belt: the observer is the braces.
    let raf = 0;
    if (!measure()) {
      let tries = 0;
      const tick = () => {
        if (measure() || ++tries > 60) return;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    const ro = new ResizeObserver(() => measure());
    ro.observe(el.parentElement ?? el);
    // A window resize that doesn't change the parent's box (a zoom change, a
    // devtools dock) still changes the SVG's.
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Hold space to pan from any tool (released → back to the active tool).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
      // A palette part stays armed so a run of flex can be laid without going
      // back to the palette between pieces — which means there has to be an
      // obvious way to put it down again, or the next click on the board lays a
      // piece nobody asked for.
      if (e.key === "Escape") setArmed(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const sy = (y: number) => -y;
  const vb = `${vbBox.minX} ${-(vbBox.minY + vbBox.h)} ${vbBox.w} ${vbBox.h}`;
  // preserveAspectRatio="meet" fits the viewBox inside the element, so the true
  // uniform scale (device px per inch) is the smaller of the two ratios.
  const scale =
    px.w > 0 && px.h > 0 ? Math.min(px.w / vbBox.w, px.h / vbBox.h) : 1 / (vbBox.w * 0.006);
  const fitScale =
    px.w > 0 && px.h > 0 ? Math.min(px.w / bounds.w, px.h / bounds.h) : scale;
  /** World inches for a given screen-pixel size — keeps marks device-constant. */
  const world = (screenPx: number) => screenPx / scale;
  const r = world(4);
  const snapDist = world(10);

  // Grid: aim for ~14px minor cells, snapped to a friendly inch increment.
  const minorStep = niceStep(world(14));
  const majorStep = minorStep * (minorStep >= 12 ? 4 : minorStep >= 3 ? 4 : 6);

  const toLocal = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    const u = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    return { x: u.x, y: -u.y };
  };

  /** Zoom about a world anchor point by a multiplicative factor. Functional
   * update so it reads the live view without a stale closure. */
  const zoomAbout = (anchor: Pt, factor: number) =>
    setView((prev) => {
      const b = prev ?? bounds;
      const nw = Math.max(2, Math.min(2000, b.w * factor));
      const nh = b.h * (nw / b.w);
      return {
        w: nw,
        h: nh,
        minX: anchor.x - (anchor.x - b.minX) * (nw / b.w),
        minY: anchor.y - (anchor.y - b.minY) * (nh / b.h),
      };
    });
  const zoomButtons = (factor: number) =>
    zoomAbout({ x: vbBox.minX + vbBox.w / 2, y: vbBox.minY + vbBox.h / 2 }, factor);

  /**
   * Drag the CONTENT by a screen-pixel delta — same sense as grabbing it: +x
   * moves it right, +y moves it DOWN the screen.
   *
   * Signs are worked from the drag-pan above, which is the known-good one:
   * there it's `minX -= dxWorld`, `minY -= dyWorld`. A screen delta is
   * `dxWorld = dxPx/k` but `dyWorld = -dyPx/k` — screen y runs down, world y
   * runs up — so the y term comes out ADDED.
   */
  const panBy = (dxPx: number, dyPx: number) =>
    setView((prev) => {
      const b = prev ?? bounds;
      // The view is in inches; the deltas are pixels, so divide by the scale.
      const k = px.w > 0 && px.h > 0 ? Math.min(px.w / b.w, px.h / b.h) : 1;
      return { ...b, minX: b.minX - dxPx / k, minY: b.minY + dyPx / k };
    });

  /**
   * The wheel PANS; ctrl/⌘ + wheel zooms toward the pointer.
   *
   * It used to zoom unconditionally, which is a large part of why the canvas
   * read as "you can only zoom" (#188): a trackpad's two-finger scroll — the
   * gesture everyone reaches for first — zoomed instead of panning, so there was
   * no way to move around without knowing that Space-drag existed. This is the
   * convention every drawing tool uses, and it comes with pinch-to-zoom for
   * free: browsers deliver a trackpad pinch as ctrl+wheel.
   *
   * React's onWheel is passive (can't preventDefault the browser's own
   * zoom/scroll), so bind a native listener. Rebinds when `bounds` changes so
   * the fallback view stays current.
   */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAbout(toLocal(e), e.deltaY > 0 ? 1.12 : 1 / 1.12);
        return;
      }
      // DOM_DELTA_LINE (a notched mouse wheel) reports lines, not pixels.
      const k = e.deltaMode === 1 ? 16 : 1;
      panBy(-e.deltaX * k, -e.deltaY * k);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, px]);

  const commit = (next: BenchworkPoint[]) =>
    onChange(
      next.map((p) => ({
        x: round(p.x),
        y: round(p.y),
        ...(p.bulge ? { bulge: round(p.bulge) } : {}),
        // ⚠️ CARRIED THROUGH, AND KEPT WHEN ZERO. `bulgeEnd` is the far half's own
        // bend; zero says that half is deliberately straight, which is not the same
        // as an edge with only one bend. Dropping it here is how the first attempt
        // silently lost every S the moment it was committed.
        ...(Number.isFinite(p.bulgeEnd) ? { bulgeEnd: round(p.bulgeEnd!) } : {}),
      })),
    );

  const snapToAnchor = (pt: Pt): Pt => {
    let best = pt;
    let bestD = snapDist;
    for (const a of anchors) {
      const d = Math.hypot(pt.x - a.x, pt.y - a.y);
      if (d < bestD) {
        bestD = d;
        best = { x: a.x, y: a.y };
      }
    }
    return best;
  };

  /** Snap a mainline endpoint to the nearest endplate TRACK POINT (an endplate's
   * centre-line crossing, `pose.x/y`), generously. The endplates are the board's
   * fixed interfaces; the drawn main must begin and end on them, or the endplate
   * faces drift off the benchwork edge and the board grows (a slightly-off click
   * used to re-pin the endplate to the click, tilting the main and splaying the
   * band). A big radius so "click near one end of the board" always lands on it. */
  const snapMainEnd = (pt: Pt): Pt => {
    const r = Math.max(snapDist, lengthInches * 0.15);
    let best = pt;
    let bestD = r;
    for (const p of poses) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { x: p.x, y: p.y };
      }
    }
    return best;
  };

  /** Midpoint control handle for edge i (chord mid offset by its bulge). */
  const edgeHandle = (i: number): Pt => {
    const p0 = outline[i];
    const p1 = outline[(i + 1) % outline.length];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    const nx = -dy / c;
    const ny = dx / c;
    const b = p0.bulge ?? 0;
    return { x: (p0.x + p1.x) / 2 + nx * b, y: (p0.y + p1.y) / 2 + ny * b };
  };

  // --- Mainline path editing (#2d-track) -------------------------------------
  const commitMain = (next: BenchworkPoint[]) =>
    onMainPathChange?.(
      next.map((p) => ({
        x: round(p.x),
        y: round(p.y),
        ...(p.bulge ? { bulge: round(p.bulge) } : {}),
        // ⚠️ CARRIED THROUGH, AND KEPT WHEN ZERO. `bulgeEnd` is the far half's own
        // bend; zero says that half is deliberately straight, which is not the same
        // as an edge with only one bend. Dropping it here is how the first attempt
        // silently lost every S the moment it was committed.
        ...(Number.isFinite(p.bulgeEnd) ? { bulgeEnd: round(p.bulgeEnd!) } : {}),
      })),
    );
  /** Remove a mainline bend point (never the two endplate endpoints). */
  const removeMainVertex = (i: number) => {
    if (i <= 0 || i >= editMain.length - 1) return;
    commitMain(editMain.filter((_, j) => j !== i));
  };
  /** Seed control points from the derived centre-line: endpoints + a bulge that
   * reproduces the current curve, so drawing starts matching the geometry. */
  const seedMain = (): BenchworkPoint[] => {
    if (centerline.length < 2) return [];
    const a = centerline[0];
    const b = centerline[centerline.length - 1];
    const mid = centerline[Math.floor(centerline.length / 2)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const c = Math.hypot(dx, dy) || 1;
    const nx = -dy / c;
    const ny = dx / c;
    const sag = (mid.x - (a.x + b.x) / 2) * nx + (mid.y - (a.y + b.y) / 2) * ny;
    return [
      { x: a.x, y: a.y, ...(Math.abs(sag) > 0.5 ? { bulge: sag } : {}) },
      { x: b.x, y: b.y },
    ];
  };
  /** The path the Track tool edits when no spur is selected — the authored one, or a fresh seed. */
  const editMain = mainPath.length >= 1 ? mainPath : seedMain();

  // ─── WHICH MODEL IS THIS MODULE BUILT FROM? (#198 step 4) ──────────────────
  /**
   * Anything on this board that only the POSITIONAL model can hold: a mainline
   * the owner drew by hand, a siding/spur/Main 2, or a turnout placed at a `pos`.
   *
   * ⚠️ **NOT `centerline.length < 2`.** The scoped plan keyed a blank module on
   * that, and it is never true: `geometry.type` falls back to `"straight"` for
   * derivation (editor.tsx, #103), so EVERY module with a length derives a
   * two-point centre-line whether or not anybody drew one. Keying on it would
   * have made every new module 1-D — the exact outcome the decision below
   * exists to prevent — and it would have looked right, because on a legacy
   * module the answer is the same either way.
   *
   * ⚠️ `tracks` here already EXCLUDES Main 1 (the editor filters
   * `MAIN_TRACK_ID` out), so this asks about track someone placed, not about the
   * main every module implicitly has.
   */
  const authored1D = mainPath.length >= 2 || tracks.length > 0 || turnouts.length > 0;
  /**
   * ⭐ ADR 0001 + Will 2026-07-29: **a module is EITHER graph-built or 1-D, and
   * it says which by what it already has. NEW modules are graph-built.**
   *
   * ⛔⛔ **COMPUTED BY THE EDITOR NOW, NOT HERE (#255).** It used to be worked
   * out from this component's own props, so the editor — which gates the
   * centre-line on the same question — would have held a SECOND copy. Two
   * copies of this predicate is exactly what produced #205 and #207: each
   * overlay decided for itself whether the 1-D model applied, so gating one
   * left the next drawing a phantom main.
   *
   * ⚠️ The old local version read `tracks.length`, which INCLUDES Main 2 —
   * `state.extraTracks` does not. The editor's version keeps that reading
   * deliberately (`doc.tracks` minus the main), so a plain double-track module
   * classifies the same as it always did.
   *
   * Falls back to the local computation only when the prop is absent, so the
   * canvas still works standalone.
   */
  const graphAuthoring = graphAuthoringProp ?? (pieces.length > 0 || !authored1D);
  /** T on a graph-built module: the parts palette lays real pieces. */
  const piecesMode = tool === "track" && graphAuthoring;
  /**
   * T on a module drawn positionally: draw/bend the main, place turnouts by
   * `pos`, offer the rebuild.
   *
   * ⛔ The 1-D affordances hang off THIS, not off `tool === "track"`, so a
   * graph-built module cannot edit its own DERIVED document — under ADR 0001
   * the 1-D doc is an output, and letting an owner drag it would put two
   * authorities on the same track with no rule for which wins.
   */
  const track1D = tool === "track" && !graphAuthoring;
  /** Where the 1-D reshape handles are live at all. Select shows them too (#192
   * — selecting a track arms it), so it has to answer the same question. */
  const edit1D = !graphAuthoring && (tool === "track" || tool === "select");
  /**
   * Everything the Track tool can lay, for THIS module's authoring model
   * (#198 step 5). One builder, one entry type — the models differ only in what
   * they can honestly accept, which `trackPaletteEntries` is the single place to
   * decide.
   */
  const paletteEntries = useMemo(
    () => trackPaletteEntries(partLibrary, graphAuthoring ? "graph" : "positional"),
    [partLibrary, graphAuthoring],
  );
  /**
   * What is armed, checked against what the palette is actually offering.
   *
   * ⚠️ A REBUILD FLIPS THE MODEL UNDER THE ARMED ENTRY. Converting a legacy
   * module to pieces switches the palette to the graph model mid-session, and an
   * entry armed from the other model would still be sitting in state — the next
   * board click would then try to drop a 1-D turnout on a module that no longer
   * has a 1-D document to put it in. DERIVED rather than cleared in an effect:
   * an effect would run a render late, which is a render in which the stale
   * entry is live.
   */
  const armed = armedRaw && paletteEntries.some((e) => e.key === armedRaw.key) ? armedRaw : null;
  /** The armed entry as a PIECE, when it is one — the ADR 0001 laying path. */
  const armedPart: PieceSpec | null =
    armed?.action?.how === "piece" ? armed.action.spec : null;
  /**
   * Is Main 1 armed for editing? SELECTING it arms it, under Select or Track,
   * the same gesture as every other track (#192) — Main 2 already worked that
   * way, so Main 1 was the odd one out.
   *
   * The old route stays: the Track tool with nothing selected still edits the
   * main. That is how a blank module gets its first main drawn, and it's what
   * owners are being told to use for the #189 migration — so it keeps working,
   * it just isn't the ONLY way in any more.
   */
  const editingMain =
    edit1D && selection?.kind === "track" && selection.id === MAIN_TRACK_ID;
  /** Midpoint handle for mainline edge i (open path, no wrap). */
  const addMainVertex = (pt: Pt) => {
    if (editMain.length < 2) return;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < editMain.length - 1; i++) {
      const d = distToSegment(pt, editMain[i], editMain[i + 1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...editMain];
    next.splice(best + 1, 0, { x: pt.x, y: pt.y });
    commitMain(next);
  };

  // --- Main 2 path editing (#131) — mirrors Main 1, endplate-pinned, no throat ---
  const main2Track_ = tracks.find((t) => t.id === MAIN2_TRACK_ID);
  const isDoubleMain = !!main2Track_;
  /** Edit Main 2 when it's selected under the Track (or Select) tool. */
  const editingMain2 =
    isDoubleMain && edit1D && selection?.kind === "track" && selection.id === MAIN2_TRACK_ID;
  const commitMain2 = (next: BenchworkPoint[]) => {
    // ⭐ NOW THAT A DRAWN MAIN 2 REALLY DRAWS, its ends get the same snap a
    // spur's do (#189). This shipped once in #210 and was reverted with it —
    // not because it was wrong, but because it was pointless while the canvas
    // ignored the path it was snapping. `snapToTurnoutRail` only ever takes
    // hold of a rail belonging to a turnout that diverges to THIS track.
    const pts = next.map((pt) => ({ ...pt }));
    if (pts.length >= 2) {
      for (const i of [0, pts.length - 1]) {
        const at = snapToTurnoutRail(pts[i], MAIN2_TRACK_ID);
        if (at) pts[i] = { ...pts[i], x: at.x, y: at.y };
      }
    }
    onMain2PathChange?.(
      pts.map((pt) => ({
        x: round(pt.x),
        y: round(pt.y),
        ...(pt.bulge ? { bulge: round(pt.bulge) } : {}),
        // ⚠️ CARRIED THROUGH, AND KEPT WHEN ZERO. `bulgeEnd` is the far half's own
        // bend; zero says that half is deliberately straight, which is not the same
        // as an edge with only one bend. Dropping it here is how the first attempt
        // silently lost every S the moment it was committed.
        ...(Number.isFinite(pt.bulgeEnd) ? { bulgeEnd: round(pt.bulgeEnd!) } : {}),
      })),
    );
  };
  /** Seed Main 2's control points from where it runs today — its lane offset
   * from Main 1 across its own extent — so bending starts from the current
   * shape. */
  const seedMain2 = (): BenchworkPoint[] => {
    if (centerline.length < 2 || !main2Track_) return [];
    const off = laneOffset(main2Track_.lane ?? 1);
    const from = main2Track_.fromPos ?? 0;
    const to = main2Track_.toPos ?? lengthInches;
    const a = sampleAt(centerline, from);
    const b = sampleAt(centerline, to);
    return [
      { x: a.x + a.nx * off, y: a.y + a.ny * off },
      { x: b.x + b.nx * off, y: b.y + b.ny * off },
    ];
  };
  const editMain2 = main2Path.length >= 1 ? main2Path : seedMain2();
  /**
   * ⭐ TWO BEND HANDLES PER STRETCH OF TRACK, not one (Will, 2026-07-30).
   *
   * A length of flex is most often cut to step across to a line parallel to the
   * one it left — out of a turnout and into its lane, round something and back.
   * That is an S, and it needs curvature BOTH ways: one handle is one arc and
   * can only ever bow one way. The near handle bows the first half of the
   * stretch, the far handle the second (`bulge` / `bulgeEnd`, pkg 0.116.0).
   *
   * ⚠️ The far handle STARTS WHERE THE NEAR ONE IS (`bulgeEnd ?? bulge`), so a
   * stretch that has only ever been bowed one way shows both handles on the arc
   * it already draws, and grabbing the far one doesn't make the track jump.
   * Until it is moved, `bulgeEnd` stays unset and the edge is the same circular
   * arc it always was.
   */
  const BEND_AT = { start: 1 / 3, end: 2 / 3 } as const;
  const bendHandle = (
    pts: BenchworkPoint[],
    i: number,
    end: "start" | "end",
  ): Pt => {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    const t = BEND_AT[end];
    const b = (end === "start" ? p0.bulge : (p0.bulgeEnd ?? p0.bulge)) ?? 0;
    return { x: p0.x + dx * t + (-dy / c) * b, y: p0.y + dy * t + (dx / c) * b };
  };
  /** How far the pointer has pulled this half of the stretch off its chord. */
  const bendFromPointer = (
    pts: BenchworkPoint[],
    i: number,
    end: "start" | "end",
    p: Pt,
  ): number => {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    const t = BEND_AT[end];
    const ax = p0.x + dx * t;
    const ay = p0.y + dy * t;
    return (p.x - ax) * (-dy / c) + (p.y - ay) * (dx / c);
  };
  /** Write a dragged bend back onto its point, keeping the two halves' meanings
   * apart: a straight far half is `0`, which is a different statement from the
   * `undefined` that means "this edge has one bend". */
  const withBend = (
    pt: BenchworkPoint,
    end: "start" | "end",
    value: number,
  ): BenchworkPoint => {
    const b = Math.abs(value) < 0.5 ? 0 : value;
    return end === "start" ? { ...pt, bulge: b } : { ...pt, bulgeEnd: b };
  };

  const addMain2Vertex = (pt: Pt) => {
    if (editMain2.length < 2) return;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < editMain2.length - 1; i++) {
      const d = distToSegment(pt, editMain2[i], editMain2[i + 1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...editMain2];
    next.splice(best + 1, 0, { x: pt.x, y: pt.y });
    commitMain2(next);
  };
  const removeMain2Vertex = (i: number) => {
    if (i <= 0 || i >= editMain2.length - 1) return;
    commitMain2(editMain2.filter((_, j) => j !== i));
  };

  // --- Spur path editing (Track tool) — the selected editable spur ------------
  const editSpurTrack =
    selection?.kind === "track" && edit1D
      ? tracks.find(
          (t) =>
            t.id === selection.id &&
            t.editable &&
            // In Select, only a *drawn* spur (with a path) gets reshape handles,
            // so you can drag it to resize/reorient; a plain spur keeps its
            // along-main ○ end handles. In Track, any editable spur is shapeable.
            (track1D || (t.path != null && t.path.length >= 2)),
        )
      : undefined;
  /** Are Main 1's handles live? Either it's selected, or the Track tool is up
   * with nothing else claiming the handles (the original route, #192). */
  const mainHandlesOn =
    !pendingTrack &&
    (editingMain || (track1D && !selection && !editSpurTrack && !editingMain2));
  /**
   * Every rail end a turnout offers to connect to — the end of its diverging
   * leg, for each turnout on the board.
   *
   * These are what a track end snaps to now that nothing is auto-joined. A
   * turnout is a part with ends; track meets it there or it doesn't meet it at
   * all (#189).
   */
  const turnoutRailEnds = useMemo(() => {
    const out: { at: Pt; trackId: string; turnoutId: string; reachInches: number }[] = [];
    for (const [trackId, legs] of legsByTrack) {
      for (const l of legs) {
        if (l.leg.length < 2) continue;
        out.push({
          at: l.leg[l.leg.length - 1],
          trackId,
          turnoutId: l.turnoutId,
          reachInches: l.reachInches,
        });
      }
    }
    return out;
  }, [legsByTrack]);

  /** How close a track end has to come before it takes hold, in inches. Generous
   * on purpose: every existing module has a gap to close, and hunting for a
   * pixel would make that chore miserable. */
  const RAIL_SNAP_INCHES = 1.5;

  /**
   * The rail end a point should snap to, or null. Only ever the rail of a
   * turnout that diverges to THIS track — snapping to an unrelated turnout
   * across the board would connect two things the owner never joined.
   *
   * ⭐⭐ THE ALLOWANCE COVERS THE TURNOUT'S OWN REACH (#239).
   *
   * A flat 1.5″ was measured from the RAIL END, but a route to an endplate is
   * authored at the turnout's `pos` — and `pos` marks the FROG, which is inside
   * the part. The rail end is therefore 1.63″ away on a #6 and 3.04″ on a #12:
   * **further than the gate**. So a route the app had just created could not
   * snap to the turnout it had just been told it diverges from, drew an amber
   * "nothing is connected" ring, and only became snappable once the owner had
   * dragged it at least a tenth of an inch — worse the bigger the turnout, which
   * is the opposite of the intuition.
   *
   * Adding the turnout's reach makes the allowance measure what it always meant:
   * *"near enough to this turnout to be meant for it"*, from the turnout, rather
   * than from a rail end whose distance nobody was accounting for.
   *
   * ⚠️ NOT unconditional, deliberately. `commitSpur` applies this on every
   * pointermove, so a snap with no limit would drag the throat straight back on
   * every frame — which is precisely the *"I can't move the track"* bug #227
   * fixed and the pin #189 deleted. A throat deliberately parked well clear of
   * its turnout still stays where it was put.
   */
  const snapToTurnoutRail = (p: Pt, trackId: string): Pt | null => {
    let best: { at: Pt; d: number } | null = null;
    for (const r of turnoutRailEnds) {
      if (r.trackId !== trackId) continue;
      const d = Math.hypot(r.at.x - p.x, r.at.y - p.y);
      if (d <= RAIL_SNAP_INCHES + r.reachInches && (!best || d < best.d)) best = { at: r.at, d };
    }
    return best?.at ?? null;
  };

  /**
   * Turnout rails with nothing connected to them.
   *
   * This has to be LOUD. Removing the auto-join means every module built before
   * it has gaps its owner has never seen, and a silently disconnected route
   * would just look like a drawing bug. An open ring at the rail end says: your
   * track belongs here, drag it over (#189).
   */
  const danglingRailEnds = useMemo(() => {
    if (!turnoutRailEnds.length) return [];
    const ends: Pt[] = [];
    for (const tp of trackPaths) {
      if (tp.pts.length < 2) continue;
      /**
       * ⛔⛔ A CROSSOVER'S BAND DOES NOT GET A VOTE (#232).
       *
       * It is DERIVED from the two legs, not drawn by anyone. When they meet,
       * `crossoverBody` returns an EMPTY band (#202) and contributes nothing.
       * When they DON'T, it draws a bridge across the hole — and its endpoints
       * then landed on both rail ends and were read as "something is connected
       * here", which is the opposite of what the bridge means.
       *
       * The result was exactly backwards: FMN-0078 rang **four** times when its
       * crossover was correct (fixed in #231) and went **silent** when a frog was
       * moved 4″ out of place. A crossover leg's connection is decided by
       * `metByItsPartner` — by whether the other half actually reaches it — and
       * a band the renderer drew to cover the gap must not overrule that.
       */
      if (tracks.find((x) => x.id === tp.id)?.role === "crossover") continue;
      ends.push(tp.pts[0], tp.pts[tp.pts.length - 1]);
    }
    // ⛔ MAIN 2 IS ONLY JOINED BY DERIVATION WHILE IT IS DERIVED. Excluding it
    // outright was right when it always ran at its lane offset from Main 1 —
    // then it met its turnout by construction and a ring would have been a lie.
    // A DRAWN Main 2 is wherever the owner put it and now draws there, so it can
    // dangle like any other track and has to be able to say so.
    // ⚠️ Read from `tracks`, the same source `trackPaths` draws from, so the ring
    // and the drawing can never disagree about whether Main 2 is bent.
    const m2 = tracks.find((t) => t.id === MAIN2_TRACK_ID);
    const main2Drawn = !!m2?.path && m2.path.length >= 2;
    /**
     * ⭐⭐ TWO RAILS THAT MEET EACH OTHER ARE JOINED.
     *
     * A crossover's connector has a turnout at BOTH ends, and their legs run to
     * the same point — the scissors on a double crossover, the middle of the gap
     * on a single. Nothing is missing there, so a ring is a lie: FMN-0078 drew
     * **four** of them stacked on its scissors, each saying "drag the track's
     * end onto it" about a rail already met by the one coming the other way
     * (Will, 2026-07-30).
     *
     * The old test only ever looked for a *drawn track's* endpoint nearby, so
     * the one thing it could not recognise was a rail being met by another rail.
     *
     * ⚠️ SAME `trackId`, DIFFERENT turnout — that pairing IS the connector. A
     * siding or spur has one turnout on it and can never satisfy this, so it
     * still rings when its track is away. And the 1.5″ tolerance still applies:
     * a crossover whose halves genuinely don't meet keeps its warning.
     */
    const metByItsPartner = (r: { at: Pt; trackId: string; turnoutId: string }) =>
      turnoutRailEnds.some(
        (o) =>
          o.turnoutId !== r.turnoutId &&
          o.trackId === r.trackId &&
          Math.hypot(o.at.x - r.at.x, o.at.y - r.at.y) <= RAIL_SNAP_INCHES,
      );
    /**
     * ⭐⭐ A TRACK WHOSE PATH *IS* THE LEG IS CONNECTED TO IT (#360).
     *
     * `ends` holds only each track's FIRST and LAST point, which is the right
     * question for a track that has to be brought to a rail. But a single-turnout
     * spur is drawn by `divergingStubPath` as **the leg itself plus a tail**, so
     * the rail end is a vertex in the MIDDLE of its own path and neither endpoint
     * is anywhere near it. The check could therefore never be satisfied by a
     * stub, and rang every one — two on FMN-0086, on track that is joined by
     * construction and cannot be otherwise.
     *
     * ⛔ A ring on correctly built track is the #232 failure over again: loud when
     * it is right, and therefore ignored when it is wrong.
     *
     * ⚠️ THE TOLERANCE HERE IS NOT `RAIL_SNAP_INCHES`, AND THAT IS THE WHOLE
     * POINT. The snap is a generous 1.5″ because an owner is dragging; this asks
     * a different question — *is this rail end literally a point of that track's
     * drawn path?* At 1.5″ a lane-1 siding running past would answer yes from
     * 0.518″ away and silence a genuine dangle, which is the one outcome worse
     * than the false ring being fixed.
     */
    const SAME_POINT_INCHES = 1e-6;
    const ownPathRunsThrough = (r: { at: Pt; trackId: string }) =>
      (trackPaths.find((tp) => tp.id === r.trackId)?.pts ?? []).some(
        (p) => Math.hypot(p.x - r.at.x, p.y - r.at.y) <= SAME_POINT_INCHES,
      );
    return turnoutRailEnds.filter(
      (r) =>
        (main2Drawn || r.trackId !== MAIN2_TRACK_ID) &&
        !metByItsPartner(r) &&
        !ownPathRunsThrough(r) &&
        !ends.some((e) => Math.hypot(e.x - r.at.x, e.y - r.at.y) <= RAIL_SNAP_INCHES),
    );
  }, [turnoutRailEnds, trackPaths, tracks]);

  /**
   * Every rail joint to draw — where a piece of track ends and the next begins.
   *
   * A joint and a dangling ring are the two answers to the same question, so
   * they're mutually exclusive by construction: if nothing is connected to a
   * turnout's diverging rail you get the ring telling you to bring track to it,
   * and once you have, you get the joint saying the two pieces meet here.
   */
  /**
   * Rail joints where a crossover ASSEMBLY meets the flex track on both mains.
   *
   * A turnout's through joints come from `partExtent`, which is meaningless for
   * a crossover — it is ONE moulding carrying four point-sets, not a turnout —
   * so `ext` is null for all four and the mains ran unbroken straight through
   * the assembly with no joint anywhere. `crossoverAssembly()` supplies the
   * number that fixes it: `lengthInches`, end to end, centred on the scissors.
   *
   * ⭐ Kept OUT of `frogLegOf`. Every turnout on every module flows through that
   * function, and a field reaching the model but not the renderer has already
   * shipped three silent bugs here. This reads the same published geometry
   * independently and only ever ADDS joints.
   *
   * Both hosts are mains by construction — a connector is `role: "crossover"`
   * only when its two turnouts sit on different mains — so absolute positions
   * sample directly, with no host-relative conversion.
   *
   * A double crossover is TWO connectors over ONE assembly, so both produce the
   * same four joints; deduped by position.
   */
  const crossoverAssemblyJoints = useMemo(() => {
    if (centerline.length < 2) return [];
    const out: Joint[] = [];
    const seen = new Set<string>();
    for (const t of tracks) {
      if (t.role !== "crossover" || !t.crossoverPartId) continue;
      const part = partLibrary.find((p) => p.id === t.crossoverPartId);
      if (!part) continue;
      const asm = crossoverAssembly(part);
      if (!asm) continue;
      const sw = turnouts.filter((x) => x.divergeTrack === t.id);
      if (sw.length !== 2) continue;
      // The assembly is centred on the scissors, which sits midway between the
      // two frogs — `pos` marks the frog (#132).
      const centre = (sw[0].pos + sw[1].pos) / 2;
      const ends = [centre - asm.lengthInches / 2, centre + asm.lengthInches / 2];
      for (const s of sw) {
        const host = hostPointsOf(s.onTrack);
        if (host.length < 2) continue;
        for (const e of ends) {
          if (e < 0 || e > lengthInches) continue;
          const p = sampleAt(host, e);
          const key = `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, turnouts, partLibrary, centerline, lengthInches, pinches]);

  const trackJoints = useMemo(() => {
    const loose = new Set(danglingRailEnds.map((r) => `${r.turnoutId}|${r.trackId}`));
    const out: Joint[] = [];
    for (const [trackId, legs] of legsByTrack) {
      for (const l of legs) {
        out.push(...l.throughJoints);
        if (!loose.has(`${l.turnoutId}|${trackId}`)) out.push(l.divergeJoint);
      }
    }
    out.push(...crossoverAssemblyJoints);
    return out;
  }, [legsByTrack, danglingRailEnds, crossoverAssemblyJoints]);

  /**
   * ⭐⭐ EVERY FLEX PIECE, AS ITS OWN STRETCH OF THE DRAWN TRACK (#392 phase 1).
   *
   * Will: *"The track joints are not something that should be added after the
   * track, they are a part of each end of a piece of track."*
   *
   * ⛔ THE OLD SHAPE DISAGREED. The editor sent a bare `cuts: number[]` and this
   * placed a tick at each — a track was one line, and joints were marks put on
   * it afterwards. Because the position was worked out separately from the line,
   * the two could disagree, and on FMN-0085 four of thirteen joints landed 3.4″
   * off the rail (#388).
   *
   * ⭐ Now the run is CUT INTO PIECES on the line the canvas already draws, and
   * a joint is simply where two of them meet. There is no position to compute
   * and nothing to keep in step: a joint is an END OF A PIECE, so it is on the
   * track by construction — exactly as `pieceRoutePaths` puts it in the package,
   * *"each polyline ends exactly on its joints"*.
   *
   * `sliceCenterline` does the cutting because it already promises the ends are
   * interpolated to land exactly on the cut, which is the whole property needed.
   */
  const piecePaths = useMemo(() => {
    const out: {
      trackId: string;
      index: number;
      pts: Pt[];
      lengthInches: number;
      overlong: boolean;
      fromEnd: string;
      toEnd: string;
    }[] = [];
    for (const [trackId, f] of Object.entries(flexPiecesByTrack ?? {})) {
      /**
       * ⭐ THE LINE THAT IS ACTUALLY DRAWN (#388). `hostPointsOf` is a
       * SIMPLIFIED re-derivation — `lanePath` over the stored extent — while the
       * canvas draws `crossoverBody ?? authoredTrackPath ?? divergingStubPath ??
       * passingSidingBody ?? laneBody`, the last two of which pull each end back
       * to where the turnout's leg hands over and splice the leg on. Different
       * ends, different length; slicing one and drawing the other would put the
       * pieces somewhere the track isn't.
       *
       * ⚠️ An `alongPath` run keeps `hostPointsOf` deliberately: there the spans
       * are already arc length along the track's OWN authored path, which is the
       * frame `hostPointsOf` reproduces. Measured before touching it —
       * FMN-0068's branch joint sits 0.000″ off its rail — so that case was
       * never broken.
       */
      const drawn = trackPaths.find((tp) => tp.id === trackId)?.pts;
      const host =
        !f.alongPath && drawn && drawn.length >= 2 ? drawn : hostPointsOf(trackId);
      if (host.length < 2) continue;
      // Spans are positions along the module (or the path); the line is measured
      // in arc length. Convert ONCE per end, on the very curve being cut.
      const rel = (abs: number) => (f.alongPath ? abs : relAlongPoints(host, abs));
      for (const pc of f.pieces) {
        const from = rel(pc.fromPos);
        const to = rel(pc.toPos);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
        const pts = sliceCenterline(host, from, to) as Pt[];
        if (pts.length < 2) continue;
        out.push({
          trackId,
          index: pc.index,
          pts,
          lengthInches: pc.lengthInches,
          overlong: pc.overlong,
          fromEnd: pc.fromEnd,
          toEnd: pc.toEnd,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flexPiecesByTrack, centerline, tracks, trackPaths]);

  /**
   * Where one length of FLEX meets the next (#193) — kept apart from the joints
   * above because they answer to a different level of detail.
   *
   * A turnout's own joints are part detail: below the zoom where its rails
   * resolve, marking them is grit. Flex joints are the opposite — they're a
   * COARSE feature of the run, 30″ apart on a 96″ main, and the whole reason
   * the model exists. Gating them behind `railsVisible` meant a 96″ module
   * showed none of them at the zoom it opens at.
   *
   * ⭐⭐ READ OFF THE PIECES, NOT PLACED. A joint is the end of a piece: it is
   * the last point of a slice that meets another piece, so it cannot be
   * anywhere the track isn't. Nothing here computes a position.
   */
  const flexJoints = useMemo(() => {
    const out: Joint[] = [];
    for (const pc of piecePaths) {
      // Only where one piece meets the NEXT. Against a part the turnout draws
      // its own joint (#189), and at the end of a run there is an endplate or a
      // stop, which is not a joint at all.
      if (pc.toEnd !== "piece") continue;
      const end = pc.pts[pc.pts.length - 1];
      const prev = pc.pts[pc.pts.length - 2];
      const dx = end.x - prev.x;
      const dy = end.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      // The tick draws ACROSS the rails, so the normal is the tangent turned 90°.
      out.push({ x: end.x, y: end.y, nx: -dy / len, ny: dx / len });
    }
    return out;
  }, [piecePaths]);

  /** Where the spur body starts — the turnout's JOIN (the ramp's end, so the
   * spur is continuous with the turnout), falling back to the on-main turnout
   * point if there's no leg yet. */
  const spurThroat = (t: CanvasTrack): Pt | null => {
    const f = turnoutByTrack.get(t.id)?.join;
    if (f) return f;
    if (t.throatPos == null || centerline.length < 2) return null;
    const p = sampleAt(centerline, t.throatPos);
    return { x: p.x, y: p.y };
  };
  /** Seed a 2-point diverging path: throat on the main → stub at the lane. */
  const spurSeed = (t: CanvasTrack): BenchworkPoint[] => {
    if (centerline.length < 2) return [];
    const throatPos = t.throatPos ?? t.fromPos;
    const stubPos =
      Math.abs(t.fromPos - throatPos) >= Math.abs(t.toPos - throatPos) ? t.fromPos : t.toPos;
    const a = spurThroat(t) ?? { x: sampleAt(centerline, throatPos).x, y: sampleAt(centerline, throatPos).y };
    const s = sampleAt(centerline, stubPos);
    const off = laneOffset(t.lane);
    return [a, { x: s.x + s.nx * off, y: s.y + s.ny * off }];
  };
  const editSpur: BenchworkPoint[] = editSpurTrack
    ? editSpurTrack.path && editSpurTrack.path.length >= 2
      ? authoredTrackPath(editSpurTrack)
      : spurSeed(editSpurTrack)
    : [];
  /**
   * Commit a spur path.
   *
   * ⚠️ Point 0 is NO LONGER force-pinned to the turnout. It used to be rewritten
   * on every commit "so the spur stays connected even if the turnout later
   * moves" — which meant the owner could not put their own track where they
   * wanted it, and the connection was a fiction maintained by the renderer
   * rather than a fact about the layout. The end now SNAPS when the owner brings
   * it near a turnout's rail, and stays where they leave it otherwise (#189).
   */
  const commitSpur = (t: CanvasTrack, next: BenchworkPoint[]) => {
    if (!next.length) return;
    const pts = next.map((p) => ({
      x: round(p.x),
      y: round(p.y),
      ...(p.bulge ? { bulge: round(p.bulge) } : {}),
      // ⚠️ CARRIED THROUGH, AND KEPT WHEN ZERO — see the note on the other
      // commits. A siding's S dies right here if this line goes missing.
      ...(Number.isFinite(p.bulgeEnd) ? { bulgeEnd: round(p.bulgeEnd!) } : {}),
    }));
    const snapped = snapToTurnoutRail(pts[0], t.id);
    if (snapped) pts[0] = { ...pts[0], x: round(snapped.x), y: round(snapped.y) };
    const lastI = pts.length - 1;
    const snappedEnd = snapToTurnoutRail(pts[lastI], t.id);
    if (snappedEnd) pts[lastI] = { ...pts[lastI], x: round(snappedEnd.x), y: round(snappedEnd.y) };
    onTrackPathChange?.(t.id, pts);
  };
  /** Remove a spur bend point (never the throat or the far stub end). */
  const removeSpurVertex = (t: CanvasTrack, i: number) => {
    if (i <= 0 || i >= editSpur.length - 1) return;
    commitSpur(t, editSpur.filter((_, j) => j !== i));
  };
  const addSpurVertex = (t: CanvasTrack, pt: Pt) => {
    if (editSpur.length < 2) return;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < editSpur.length - 1; i++) {
      const d = distToSegment(pt, editSpur[i], editSpur[i + 1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...editSpur];
    next.splice(best + 1, 0, { x: pt.x, y: pt.y });
    commitSpur(t, next);
  };

  const addOnNearestEdge = (pt: Pt) => {
    if (outline.length < 2) {
      commit([...outline, { x: pt.x, y: pt.y }]);
      setSel(outline.length);
      return;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const d = distToSegment(pt, outline[i], outline[(i + 1) % outline.length]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...outline];
    next.splice(best + 1, 0, { x: pt.x, y: pt.y });
    commit(next);
    setSel(best + 1);
  };

  const onBgDown = (e: React.PointerEvent) => {
    if (dragRef.current) return;
    // ⛔ A RIGHT PRESS ON THE BACKGROUND DOES NOTHING (#284). Without this it
    // fell straight through to draw-to-create and the marquee, so opening a
    // context menu on empty board would start laying track.
    if (e.button === 2) return;
    if (dropWarn) setDropWarn(null); // any fresh action clears a stale warning
    // Space-drag or middle-button pans, whatever the tool.
    if (spaceHeld || e.button === 1) {
      e.preventDefault();
      svgRef.current?.setPointerCapture?.(e.pointerId);
      panRef.current = { from: toLocal(e), view: { ...vbBox } };
      return;
    }
    // Draw-to-create (#51): a press starts drawing a new siding/spur from a
    // turnout. The throat snaps to the nearest turnout on the main; the drag
    // sets the far end. No turnout to anchor to → nothing happens (the hint
    // tells the owner to place one first).
    if (pendingTrack && centerline.length >= 2) {
      const nt = nearestTurnout(toLocal(e));
      if (!nt) return;
      placeRef.current = { start: nt.pt, end: nt.pt, turnoutId: nt.id };
      setPlacePreview({ start: nt.pt, end: nt.pt });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    // Industry tool: a background click drops an industry on the main here.
    if (tool === "industry") {
      if (onAddIndustry && centerline.length >= 2) onAddIndustry("main", posFrom(toLocal(e)));
      return;
    }
    // Signal tool: a click drops a signal (block control point) on the main (#53).
    if (tool === "signal") {
      if (onDropSignal && centerline.length >= 2) onDropSignal(posFrom(toLocal(e)));
      return;
    }
    // ⭐ T ON A GRAPH-BUILT MODULE LAYS PIECES. An armed part lands where you
    // click; DRAGGING a flex part fills the whole run you dragged (see
    // `fillRun`). Clicking bare board with nothing armed means "select nothing",
    // same as Select.
    if (piecesMode) {
      if (armedPart) {
        // A flex part is laid by the RUN, not by the piece, so a press only
        // starts the gesture — `onUp` decides whether it was a drag (fill) or a
        // click (lay one, as before).
        if (isFlexSpec(armedPart)) {
          const at = toLocal(e);
          fillRef.current = { spec: armedPart, start: at, end: at };
          setFillPreview({ spec: armedPart, start: at, end: at });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        layPiece(armedPart, toLocal(e));
        return;
      }
      if (startMarquee(e)) return;
      onSelect?.(null);
      panRef.current = { from: toLocal(e), view: { ...vbBox }, tentative: true, moved: false };
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    // Track tool on a module drawn POSITIONALLY: a background click bends
    // whichever track is armed — the selected spur, Main 2, or Main 1 (mainline
    // + spur editing are one tool) — UNLESS a turnout is armed in the palette,
    // in which case it lands there.
    if (track1D) {
      if (armed && centerline.length >= 2) {
        dropPositionalEntry(armed, toLocal(e));
        return;
      }
      if (editSpurTrack && onTrackPathChange) addSpurVertex(editSpurTrack, toLocal(e));
      // Main 2 selected used to fall through and bend MAIN 1 instead, because
      // Main 2 isn't an editable spur so `editSpurTrack` missed it (#192).
      else if (editingMain2 && onMain2PathChange) addMain2Vertex(toLocal(e));
      else if (mainHandlesOn && onMainPathChange) {
        // No main yet (a fresh module opens blank) → draw one from scratch: each
        // click extends the mainline. Otherwise add a bend to the existing main.
        if (mainPath.length < 2 && centerline.length < 2) {
          // Each click extends the new main; snap the ends onto the endplates so
          // the drawn main stays aligned with the board (benchwork + endplates).
          onMainPathChange([...mainPath, snapMainEnd(toLocal(e))]);
        } else addMainVertex(toLocal(e));
      }
      // Something else is selected — a turnout, an endplate. A background click
      // used to bend MAIN 1 anyway, which is a surprising edit to make by
      // accident. Drop the selection instead; that arms the main, so the NEXT
      // click bends it, on purpose.
      else onSelect?.(null);
      return;
    }
    // Under SELECT, dragging empty canvas PANS — nothing is being selected out
    // there, so the drag was doing nothing, and it's the gesture people reach
    // for first (#188). A press that never moves is still a click, and a
    // background click still means "select nothing"; `onUp` decides which.
    if (tool === "select") {
      if (startMarquee(e)) return;
      svgRef.current?.setPointerCapture?.(e.pointerId);
      panRef.current = { from: toLocal(e), view: { ...vbBox }, tentative: true, moved: false };
      return;
    }
    // Every other non-drawing tool: background means "nothing selected".
    if (tool !== "benchwork") {
      onSelect?.(null);
      return;
    }
    addOnNearestEdge(snapToAnchor(toLocal(e)));
  };
  /**
   * Shift+drag on empty canvas rubber-bands a selection (#94).
   *
   * ⚠️ IT HAS TO BE SHIFT, not a plain drag. A plain drag on empty canvas is
   * the PAN (#188) — the gesture people reach for first — and taking it for a
   * marquee would trade a daily action for an occasional one. Shift is also
   * what adds to the selection by click, so the marquee ADDS rather than
   * replaces, and the two gestures say the same thing.
   *
   * Returns whether it took the press.
   */
  const startMarquee = (e: React.PointerEvent): boolean => {
    if (!e.shiftKey || pieces.length === 0 || !onSelect) return false;
    const at = toLocal(e);
    marqueeRef.current = { from: at, to: at };
    setMarquee({ from: at, to: at });
    svgRef.current?.setPointerCapture?.(e.pointerId);
    return true;
  };

  /** Every piece whose ORIGIN falls inside the box. ⭐ The origin, not the whole
   * body: a 30″ length of flex is rarely enclosed by any comfortable drag, and a
   * rule of "touches the box" would sweep up the neighbouring run every time. */
  const piecesInMarquee = (m: { from: Pt; to: Pt }): string[] => {
    const x0 = Math.min(m.from.x, m.to.x);
    const x1 = Math.max(m.from.x, m.to.x);
    const y0 = Math.min(m.from.y, m.to.y);
    const y1 = Math.max(m.from.y, m.to.y);
    return pieces.filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).map((p) => p.id);
  };

  /** What grabbing a handle selects — the editor then shows its inspector.
   * Extracted so a LEFT press (which drags) and a RIGHT press (which only
   * selects, then opens the menu) can never disagree about what was clicked. */
  const selectFromDrag = (d: NonNullable<typeof dragRef.current>) => {
    if (d.kind === "vertex") onSelect?.(cornerSel(d.i));
    else if (d.kind === "turnout") onSelect?.({ kind: "turnout", id: d.id });
    else if (d.kind === "trackEnd") onSelect?.({ kind: "track", id: d.id });
    else if (d.kind === "industryEnd") onSelect?.({ kind: "industry", id: d.id });
    // Grabbing a main's own handle selects that main, so its details open like
    // any other track's would (#192).
    else if (d.kind === "mainVertex" || d.kind === "mainEdge")
      onSelect?.({ kind: "track", id: MAIN_TRACK_ID });
    else if (d.kind === "main2Vertex" || d.kind === "main2Edge")
      onSelect?.({ kind: "track", id: MAIN2_TRACK_ID });
  };

  const beginDrag = (
    e: React.PointerEvent,
    d: NonNullable<typeof dragRef.current>,
  ) => {
    e.stopPropagation();
    // ⭐⭐ A RIGHT-CLICK SELECTS BUT NEVER DRAGS (#284). Nothing here filtered on
    // the button, so opening a context menu on an object would have grabbed it
    // at the same time — press, menu, and the thing has moved under the menu.
    // Selecting is still right: the menu then acts on what you clicked.
    if (e.button === 2) {
      selectFromDrag(d);
      return;
    }
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* best-effort */
    }
    dragRef.current = d;
    selectFromDrag(d);
  };
  /**
   * Is this turnout the current selection — i.e. has the owner already said
   * they mean IT, rather than the track it sits on? (#grab-priority)
   */
  const turnoutArmed = (id: string) =>
    selection?.kind === "turnout" && selection.id === id;

  /** Pointer → inches along the main, clamped to the module. */
  const posFrom = (p: Pt) =>
    Math.round(
      Math.max(0, Math.min(lengthInches, projectToCenterline(centerline, p).pos)) * 10,
    ) / 10;

  /** Is a track curving at `pos`? Compares the tangent a short way either side;
   * a straight run keeps the same heading, an arc turns. Used to keep a curved
   * turnout on curved track (a curved turnout belongs on a curve, per the
   * prototype). Window ±3″ with a ~4° threshold ignores sampling jitter. */
  const isCurvedAt = (pts: Pt[], pos: number): boolean => {
    if (pts.length < 2) return false;
    const eps = 3;
    const a = sampleAt(pts, Math.max(0, pos - eps));
    const b = sampleAt(pts, pos + eps);
    const dot = Math.max(-1, Math.min(1, a.nx * b.nx + a.ny * b.ny));
    return Math.acos(dot) > 4 * DEG;
  };

  /** Place a turnout from the palette, keeping a curved turnout on curved track.
   *
   * ⭐ THE SPEC NOW CARRIES ITS OWN FROG NUMBER, which is what let the separate
   * `Turnout #` dropdown go: the palette entry an owner clicked already said
   * whether it was a #6 or an Atlas #7, and a second control that could disagree
   * with the part is a contradiction you could author (#198 step 5). */
  const dropTurnoutGuarded = (
    spec: { kind: TurnoutKind; curved?: boolean; size: number; partId?: string },
    onTrack: string,
    pos: number,
  ) => {
    if (spec.curved && !isCurvedAt(hostPointsOf(onTrack), toHostRel(onTrack, pos))) {
      setDropWarn(
        "Curved turnouts go on curved track — bend the track there first, or use a straight turnout.",
      );
      return;
    }
    setDropWarn(null);
    onDropTurnout?.(spec, onTrack, pos);
  };

  /**
   * Place a crossover from the palette. Centred on the drop point; the side you
   * drop on picks where the parallel lane goes. The editor reuses a covering
   * parallel track there or creates a stub the owner draws out.
   *
   * ⚠️ THE SPAN IS FROG TO FROG, NOT CENTRE TO CENTRE (#197). It used to be
   * `size × spacing` — the run needed to cross a full track spacing at the frog
   * angle. That is the right idea measured from the wrong landmark: `posA`/
   * `posB` are turnout positions, and a turnout's `pos` marks its FROG (#132),
   * which already sits ONE GAUGE off its own centre-line.
   *
   * So between the two frogs the route only has to rise `spacing − 2 × gauge`,
   * not the whole spacing — 0.417″ of a 1.125″ pair, not 1.125″. At 1:N that is
   * `(spacing − 2 × gauge) × size`: 2.5″ for a #6, where the old formula said
   * 6.75″. Placed 6.75″ apart the diagonal ran about 1:17.7 between the frogs
   * instead of 1:6, which drew as a steep leg, a long flat, and a steep leg.
   *
   * Only NEW crossovers move: this decides `posA`/`posB` at drop time and those
   * are then stored, so anything already on a module keeps the positions its
   * owner has.
   */
  const dropCrossoverAt = (
    spec: { hand?: "left" | "right"; double?: boolean; size: number; partId?: string },
    pt: Pt,
  ) => {
    if (!onDropCrossover || centerline.length < 2) return;
    const size = spec.size > 0 ? spec.size : 6;
    const span = (LANE_SPACING_INCHES - 2 * RAIL_GAUGE_INCHES) * size;
    if (lengthInches < span + 2) {
      setDropWarn("Not enough room for a crossover at this frog number.");
      return;
    }
    const raw = projectToCenterline(centerline, pt).pos;
    const posA =
      Math.round(Math.max(1, Math.min(lengthInches - span - 1, raw - span / 2)) * 10) / 10;
    const posB = Math.round((posA + span) * 10) / 10;
    const a = sampleAt(centerline, posA);
    const b = sampleAt(centerline, posB);
    const side = (Math.sign((pt.x - a.x) * a.nx + (pt.y - a.y) * a.ny) || 1) as 1 | -1;
    const off = side * LANE_SPACING_INCHES;
    setDropWarn(null);
    onDropCrossover({
      ...spec,
      side,
      posA,
      posB,
      hostA: { x: a.x, y: a.y },
      hostB: { x: b.x, y: b.y },
      parA: { x: a.x + a.nx * off, y: a.y + a.ny * off },
      parB: { x: b.x + b.nx * off, y: b.y + b.ny * off },
    });
  };

  /** The turnout nearest a canvas point, by straight-line distance to its point
   * on its host track — so it works whether the turnout is on the main or a spur. */
  const nearestTurnout = (p: Pt): { id: string; pos: number; pt: Pt } | null => {
    if (turnouts.length === 0) return null;
    let best: { id: string; pos: number; pt: Pt } | null = null;
    let bestD = Infinity;
    for (const tn of turnouts) {
      const host = hostPointsOf(tn.onTrack);
      if (host.length < 2) continue;
      const m = sampleAt(host, toHostRel(tn.onTrack, tn.pos));
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = { id: tn.id, pos: tn.pos, pt: { x: m.x, y: m.y } };
      }
    }
    return best;
  };
  /** The track (main or a spur) nearest a canvas point, plus the position along
   * it — so the Turnout tool can drop onto a spur, not just the main (#63). */
  const nearestTrackPos = (p: Pt): { onTrack: string; pos: number } | null => {
    if (centerline.length < 2) return null;
    const cands: { onTrack: string; pts: Pt[] }[] = [
      { onTrack: MAIN_TRACK_ID, pts: centerline },
      ...tracks.map((t) => ({ onTrack: t.id, pts: hostPointsOf(t.id) })),
    ];
    let best: { onTrack: string; pos: number; dist: number } | null = null;
    for (const c of cands) {
      if (c.pts.length < 2) continue;
      const proj = projectToCenterline(c.pts, p);
      if (best === null || proj.dist < best.dist) {
        // Report ABSOLUTE inches from A (the projection is host-relative).
        best = { onTrack: c.onTrack, pos: toHostAbs(c.onTrack, proj.pos), dist: proj.dist };
      }
    }
    return best === null ? null : { onTrack: best.onTrack, pos: Math.round(best.pos * 10) / 10 };
  };

  /**
   * Place what a palette entry says, on a 1-D module. The graph model's own
   * placement (`layPiece` / `fillRun`) is a different gesture — a piece can be
   * laid on bare board, whereas a turnout has to land ON a track.
   */
  const dropPositionalEntry = (entry: PaletteEntry, pt: Pt) => {
    const a = entry.action;
    if (!a || centerline.length < 2) return;
    // ⚠️ Field by field, not `{...a}` — `how` is the palette's own discriminant
    // and has no business reaching the document.
    if (a.how === "crossover") {
      dropCrossoverAt({ hand: a.hand, double: a.double, size: a.size, partId: a.partId }, pt);
      return;
    }
    if (a.how !== "turnout" || !onDropTurnout) return;
    const hit = nearestTrackPos(pt);
    if (hit)
      dropTurnoutGuarded(
        { kind: a.kind, curved: a.curved, size: a.size, partId: a.partId },
        hit.onTrack,
        hit.pos,
      );
  };

  /** Finish a draw-to-create: turn the drawn line into track geometry, anchored
   * to its turnout(s), and hand it up to the editor to build (#51). */
  const finishPlacement = (start: Pt, end: Pt, turnoutId: string) => {
    if (!onPlaceTrack || centerline.length < 2) return;
    const drawnLen = Math.hypot(end.x - start.x, end.y - start.y);
    if (drawnLen < 2) return; // too short — treat as a mis-click, stay armed
    const fromPos = posFrom(start);
    if (pendingTrack === "siding") {
      // A passing siding connects two turnouts — the far end must land on a
      // second one (the owner places both first, then draws between them).
      const to = nearestTurnout(end);
      if (!to || to.id === turnoutId) {
        setReadout("Release on a second turnout");
        return;
      }
      onPlaceTrack({
        role: "siding",
        fromTurnoutId: turnoutId,
        toTurnoutId: to.id,
        fromPos: Math.min(fromPos, to.pos),
        toPos: Math.max(fromPos, to.pos),
      });
    } else {
      // A spur / yard lead diverges at its turnout and dead-ends at the stub;
      // its capacity is the drawn length, laid along the main from the throat.
      const endPos = posFrom(end);
      const dir = endPos >= fromPos ? 1 : -1;
      const toPos = Math.max(
        0,
        Math.min(lengthInches, Math.round((fromPos + dir * drawnLen) * 10) / 10),
      );
      onPlaceTrack({
        role: "spur",
        throatTurnoutId: turnoutId,
        fromPos,
        toPos,
        path: [
          { x: round(start.x), y: round(start.y) },
          { x: round(end.x), y: round(end.y) },
        ],
      });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    // Panning: translate the view by the pointer delta (in world inches).
    const pan = panRef.current;
    if (pan) {
      const now = toLocal(e);
      const dx = now.x - pan.from.x;
      const dy = now.y - pan.from.y;
      // A press on empty canvas under Select is only a MAYBE-pan: it becomes one
      // once the pointer actually travels, and stays a plain click otherwise, so
      // clicking background still means "select nothing" (#188).
      if (pan.tentative && !pan.moved) {
        if (Math.hypot(dx, dy) * scale < 3) return;
        pan.moved = true;
      }
      setView({
        ...pan.view,
        minX: pan.view.minX - dx,
        minY: pan.view.minY - dy,
      });
      return;
    }

    // Fill-a-run: the pointer is the far end of the run being laid. The read-out
    // says how many pieces it will actually take, because that is the number the
    // gesture exists to collapse — and the one an owner is buying.
    if (fillRef.current) {
      const pt = toLocal(e);
      setHover(pt);
      fillRef.current = { ...fillRef.current, end: pt };
      setFillPreview({ spec: fillRef.current.spec, start: fillRef.current.start, end: pt });
      const len = Math.hypot(pt.x - fillRef.current.start.x, pt.y - fillRef.current.start.y);
      const n = flexPieces({
        fromPos: 0,
        toPos: len,
        maxPieceInches: maxFlexPieceInches(fillRef.current.spec.partId, partLibrary),
      }).length;
      setReadout(`${fmt(len)}″ · ${n} piece${n === 1 ? "" : "s"}`);
      return;
    }

    // Draw-to-create: track the pointer as the far end of the new track.
    if (placeRef.current) {
      const pt = toLocal(e);
      setHover(pt);
      placeRef.current = { ...placeRef.current, end: pt };
      setPlacePreview({ start: placeRef.current.start, end: pt });
      setReadout(
        lengthLabel(Math.hypot(pt.x - placeRef.current.start.x, pt.y - placeRef.current.start.y)),
      );
      return;
    }

    const p = toLocal(e);
    setHover(p);
    if (marqueeRef.current) {
      marqueeRef.current = { ...marqueeRef.current, to: p };
      setMarquee(marqueeRef.current);
      return;
    }
    const d = dragRef.current;
    if (!d) return;

    // ⭐ THE GROUP MOVES RIGIDLY: one offset, applied to each member's own
    // origin as it was when the drag began. Nothing is re-derived from a
    // neighbour, so the pieces cannot drift apart over the drag.
    if (d.kind === "pieces") {
      const dx = p.x - d.from.x;
      const dy = p.y - d.from.y;
      const next = pieces.map((piece) => {
        const o = d.origins[piece.id];
        return o ? { ...piece, x: o.x + dx, y: o.y + dy } : piece;
      });
      d.latest = next;
      onPiecesChange?.(next);
      setReadout(`${fmt(dx)}″, ${fmt(dy)}″`);
      return;
    }

    // Pieces move in real inches — no projection onto anything. That is the
    // whole difference from the positional model above: a piece is where it is
    // on the board, and `pos` is read off it afterwards.
    if (d.kind === "piece") {
      const piece = d.latest ?? pieces.find((x) => x.id === d.id);
      if (piece) {
        const next = { ...piece, x: p.x - d.grab.x, y: p.y - d.grab.y };
        d.latest = next;
        putPiece(next);
      }
      return;
    }
    if (d.kind === "pieceHandle") {
      const piece = d.latest ?? pieces.find((x) => x.id === d.id);
      if (!piece) return;
      let next = piece;
      if (d.handle === "rotate") {
        next = { ...piece, rotationDeg: rotationFor(piece, p) };
        setReadout(`${fmt(next.rotationDeg)}°`);
      } else if (d.handle === "bend") {
        const r = radiusForBend(piece.lengthInches ?? 0, offAxis(piece, p));
        next = { ...piece, radiusInches: r };
        // The RADIUS is the number a modeller thinks in and the one the
        // standards are written in — not the offset that was dragged.
        setReadout(r ? `${fmt(Math.abs(r))}″ radius` : "straight");
      } else {
        const len = flexLengthFor(piece, p);
        next = { ...piece, lengthInches: len };
        setReadout(lengthLabel(len));
      }
      d.latest = next;
      putPiece(next);
      return;
    }

    // Track features are positional: project the pointer back onto the main.
    if (d.kind === "turnout") {
      if (centerline.length >= 2) {
        const pos = posFrom(p);
        onTurnoutMove?.(d.id, pos);
        setReadout(`${fmt(pos)}″ from A`);
      }
      return;
    }
    if (d.kind === "trackEnd") {
      if (centerline.length >= 2) {
        const t = tracks.find((x) => x.id === d.id);
        let pos = posFrom(p);
        // ⭐ SNAP THE END ONTO ITS TURNOUT'S DIVERGING ROUTE. This file already
        // described the gesture — "the owner closes the gap by dragging the
        // TRACK's end onto the turnout's rail, where it snaps" — but only a
        // drawn PATH could do it. A positional siding had no such snap, and the
        // handle that would have carried it was suppressed besides.
        //
        // `join` is where the ramp has cleared a full track spacing and the
        // diverging track proper BEGINS — the honest end of the turnout, and
        // the point the siding should meet. Projected back onto the main so it
        // can be compared with a 1-D `pos`.
        let snappedTo: string | null = null;
        for (const leg of legsByTrack.get(d.id) ?? []) {
          const legPos = projectToCenterline(centerline, leg.join).pos;
          // The window covers the turnout's own reach (#239) — the part is
          // long, and requiring the pointer within a couple of inches of a
          // point buried inside it is what made the gesture feel impossible.
          if (Math.abs(pos - legPos) <= 2 + leg.reachInches) {
            pos = Math.round(legPos * 10) / 10;
            snappedTo = leg.turnoutId;
            break;
          }
        }
        // Joining tracks: snap the dragged end onto a same-lane track's end so
        // two stubs (e.g. the parallels of two crossovers) meet EXACTLY and
        // read as one continuous track — like corners snap to endplates.
        let joined: string | null = null;
        if (t && !snappedTo) {
          for (const o of tracks) {
            if (o.id === t.id || o.lane !== t.lane || !o.editable) continue;
            if (o.path && o.path.length >= 2) continue;
            for (const end of [o.fromPos, o.toPos]) {
              if (Math.abs(pos - end) <= 2) {
                pos = end;
                joined = o.id;
              }
            }
          }
        }
        onTrackEndMove?.(d.id, d.end, pos);
        const other = t ? (d.end === "from" ? t.toPos : t.fromPos) : pos;
        const len = lengthLabel(Math.abs(pos - other));
        setReadout(
          snappedTo
            ? `${len} · on ${snappedTo}`
            : joined
              ? `${len} · meets ${joined}`
              : len,
        );
      }
      return;
    }
    if (d.kind === "endplateEnd") {
      if (centerline.length >= 2) {
        // posFrom projects onto the centre-line, which ENDS at this endplate —
        // so on its own it clamps and the end could only ever be dragged
        // inward. Past the end, measure along the closing tangent instead so
        // the board can actually be lengthened.
        let end = 0;
        for (let i = 1; i < centerline.length; i++)
          end += Math.hypot(
            centerline[i].x - centerline[i - 1].x,
            centerline[i].y - centerline[i - 1].y,
          );
        const a = centerline[centerline.length - 2];
        const b = centerline[centerline.length - 1];
        const tx = b.x - a.x;
        const ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1;
        // The grip is drawn a tab's length OUTBOARD of the endplate (see the
        // render), so pull the pointer back by the same amount before measuring
        // — otherwise grabbing it would jump the board a tab longer.
        const q = { x: p.x - (tx / tl) * ENDPLATE_TAB, y: p.y - (ty / tl) * ENDPLATE_TAB };
        // ⛔⛔ NOT `posFrom` — IT CLAMPS TO `lengthInches`, AND THIS DRAG IS WHAT
        // SETS `lengthInches`. Clamping the input to the value being set is
        // circular: the pointer can never report a position past the current
        // end, so `pos >= end` below could never fire and the whole
        // lengthen-the-board branch was unreachable.
        //
        // It only worked while the module's end and the drawn centre-line's end
        // were THE SAME NUMBER — which they were, because `poses` used to place
        // endplate B at the centre-line's end. Removing that coupling (v0.66.0,
        // Will's "moving the track must not move the endplate") let the two
        // diverge, and this clamp silently pinned endplate B in place: 6″ of
        // drag moved it 0.009″. Measured on FMN-0075, whose drawn main runs
        // 35.71″ against a 32.6″ module.
        let pos = projectToCenterline(centerline, q).pos;
        if (pos >= end - 0.01) {
          const past = ((q.x - b.x) * tx + (q.y - b.y) * ty) / tl;
          pos = end + Math.max(0, past);
        }
        // Can't drag it back over the last joint — that would invert the board
        // it terminates. Nothing bounds it going outward.
        const lo = (sectionBreaks[sectionBreaks.length - 1] ?? 0) + 1;
        pos = Math.max(lo, pos);
        // `posFrom` used to round to a tenth on the way through; keep that, so
        // dragging still lands on the round numbers a board is built to and the
        // stored length doesn't grow three decimals of pointer noise.
        pos = Math.round(pos * 10) / 10;
        onEndplateEndMove?.(d.id, pos);
        setReadout(
          `${lengthLabel(pos - (sectionBreaks[sectionBreaks.length - 1] ?? 0))} section · ${lengthLabel(pos)} module`,
        );
      }
      return;
    }
    if (d.kind === "endplateMove") {
      onEndplateMove?.(d.id, p);
      setReadout(`${fmt(p.x)}, ${fmt(p.y)}″`);
      return;
    }
    if (d.kind === "sectionBreak") {
      if (centerline.length >= 2) {
        // A joint is internal bench work, so nothing constrains where it lands
        // except its neighbours — keep an inch of board on either side.
        const lo = (sectionBreaks[d.i - 1] ?? 0) + 1;
        const hi = (sectionBreaks[d.i + 1] ?? lengthInches) - 1;
        const pos = Math.max(lo, Math.min(hi, posFrom(p)));
        onSectionBreakMove?.(d.i, pos);
        setReadout(`${lengthLabel(pos - (sectionBreaks[d.i - 1] ?? 0))} section`);
      }
      return;
    }
    if (d.kind === "industryEnd") {
      if (centerline.length >= 2) {
        const pos = posFrom(p);
        onIndustryEndMove?.(d.id, d.end, pos);
        const ind = industries.find((x) => x.id === d.id);
        const other = ind ? (d.end === "from" ? ind.toPos : ind.fromPos) : pos;
        setReadout(lengthLabel(Math.abs(pos - other)));
      }
      return;
    }
    if (d.kind === "spurVertex" || d.kind === "spurEdge") {
      if (!editSpurTrack || editSpurTrack.id !== d.id) return;
      const next = editSpur.map((pt) => ({ ...pt }));
      if (d.kind === "spurVertex") {
        // ⭐ THE THROAT MOVES LIKE ANY OTHER POINT (#189, and Will again on
        // FMN-0068 2026-07-30: *"I can't move the track"* — he had grabbed this
        // handle). It used to return early "so the throat stays snapped to the
        // turnout", which was the last survivor of the PIN that #189 deleted:
        // the rule became *your track starts where you put it and SNAPS to the
        // turnout's diverging rail within 1.5″*. `commitSpur` already applies
        // exactly that snap to `pts[0]` — this guard just meant you could never
        // reach it, on the one handle sitting where an owner naturally grabs to
        // drag a route.
        next[d.i] = { ...next[d.i], x: p.x, y: p.y };
        setReadout(`${fmt(p.x)}, ${fmt(p.y)}″`);
      } else {
        const bend = bendFromPointer(editSpur, d.i, d.end, p);
        next[d.i] = withBend(next[d.i], d.end, bend);
        setReadout(`bow ${fmt(Math.abs(bend))}″`);
      }
      commitSpur(editSpurTrack, next);
      return;
    }
    if (d.kind === "mainVertex" || d.kind === "mainEdge") {
      const next = editMain.map((pt) => ({ ...pt }));
      if (d.kind === "mainVertex") {
        if (d.i === 0) return; // endplate A anchors the frame at the origin
        next[d.i] = { ...next[d.i], x: p.x, y: p.y };
        setReadout(`${fmt(p.x)}, ${fmt(p.y)}″`);
      } else {
        const bend = bendFromPointer(editMain, d.i, d.end, p);
        next[d.i] = withBend(next[d.i], d.end, bend);
        setReadout(`bow ${fmt(Math.abs(bend))}″`);
      }
      commitMain(next);
      return;
    }
    if (d.kind === "main2Vertex" || d.kind === "main2Edge") {
      const next = editMain2.map((pt) => ({ ...pt }));
      if (d.kind === "main2Vertex") {
        next[d.i] = { ...next[d.i], x: p.x, y: p.y };
        setReadout(`${fmt(p.x)}, ${fmt(p.y)}″`);
      } else {
        const bend = bendFromPointer(editMain2, d.i, d.end, p);
        next[d.i] = withBend(next[d.i], d.end, bend);
        setReadout(`bow ${fmt(Math.abs(bend))}″`);
      }
      commitMain2(next);
      return;
    }

    const next = [...outline];
    if (d.kind === "vertex") {
      const s = snapToAnchor(p);
      next[d.i] = { ...next[d.i], x: s.x, y: s.y };
      const near = nearestAnchorDist(s);
      setReadout(
        `${fmt(s.x)}, ${fmt(s.y)}″` + (near != null ? ` · ${fmt(near)}″ to ◆` : ""),
      );
    } else {
      // Set edge i's bulge = perpendicular offset of the handle from the chord.
      const p0 = outline[d.i];
      const p1 = outline[(d.i + 1) % outline.length];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const c = Math.hypot(dx, dy) || 1;
      const nx = -dy / c;
      const ny = dx / c;
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      const bulge = (p.x - mx) * nx + (p.y - my) * ny;
      next[d.i] = { ...next[d.i], bulge: Math.abs(bulge) < 0.5 ? 0 : bulge };
      setReadout(`bow ${fmt(Math.abs(bulge))}″`);
    }
    commit(next);
  };
  // ─── Pieces (ADR 0001) ────────────────────────────────────────────────────
  /**
   * Lay a piece, then let it find its joint.
   *
   * ⭐ EVERY placement goes through `snapPiece`, including the very first click,
   * so there is one answer to "did that connect?" — the package's. It only
   * offers OPEN joints, which is how an owner is stopped from stacking a third
   * rail end on a junction rather than being told off for it afterwards.
   */
  /**
   * How near counts as "meant it".
   *
   * ⚠️⚠️ CAPPED AT HALF THE FREE-MON TRACK SPACING, and that cap is the whole
   * point on a double-track module. Its two mains are 1.125″ apart — closer
   * than 14 screen pixels at any sensible zoom — so laying Main 2 beside Main 1
   * SNAPPED IT ONTO MAIN 1, and the module came out with one main and a warning
   * instead of two mains. Past half the spacing you are nearer the other track
   * than the one you meant, so the snap must not reach there.
   */
  const grabInches = Math.min(world(14), FREEMO_TRACK_SPACING_INCHES / 2);

  /**
   * ⭐⭐ AN ENDPLATE'S OWN TRACK POINT, when a press lands within reach of one
   * (#254).
   *
   * `snapPiece` only offers the open joints of EXISTING pieces, and a blank
   * module has none — so the first run began wherever the pointer happened to
   * be, typically a fraction of an inch off the one place it almost certainly
   * belongs. That error never gets corrected: every later piece snaps to the
   * first, so the whole module ends up offset from the plate it has to join.
   *
   * ⚠️ Same `grabInches` as every other snap, so it stays CONDITIONAL — a spur
   * laid across the middle of a blank board is nowhere near a plate and is left
   * exactly where it was drawn. #239's rule: a snap needs one test proving it
   * fires and one proving it has not become unconditional.
   */
  const endplateAnchorNear = (p: Pt, within: number) => {
    let best: { pt: Pt; heading: number; id: string; d: number } | null = null;
    for (const e of poses) {
      // `EndplatePose.x/y` IS the track point — where Main 1 crosses the face.
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > within) continue;
      if (!best || d < best.d) best = { pt: { x: e.x, y: e.y }, heading: e.heading, id: e.id, d };
    }
    return best;
  };

  const layPiece = (spec: PieceSpec, at: Pt) => {
    if (!onPiecesChange) return;
    const part = partLibrary.find((p) => p.id === spec.partId);
    const fresh = newPiece(spec, at, pieces, part);

    // ⭐ AN OPEN END FIRST, THEN THE MIDDLE OF A RUN. Landing on a joint is the
    // commoner intent and the more precise one, so it wins; only when nothing
    // is in reach does dropping ONTO track mean "cut it here and let me in".
    const snapped = snapPiece(fresh, pieces, partLibrary, grabInches);
    if (snapped) {
      onPiecesChange([...pieces, snapped.piece], { commit: true });
      onSelect?.({ kind: "pieces", ids: [fresh.id] });
      return;
    }
    const cut = insertIntoRun(pieces, fresh, at, partLibrary, world(14));
    if (cut) {
      onPiecesChange(cut.pieces, { commit: true });
      onSelect?.({ kind: "pieces", ids: [cut.insertedId] });
      return;
    }
    onPiecesChange([...pieces, fresh], { commit: true });
    onSelect?.({ kind: "pieces", ids: [fresh.id] });
  };

  /** Is the armed part FLEX — the one product that is laid by the run? */
  const isFlexSpec = (spec: PieceSpec) =>
    partLibrary.find((p) => p.id === spec.partId)?.kind === "flex";

  /**
   * ⭐ FILL A RUN WITH FLEX — the gesture that makes graph authoring affordable.
   *
   * ⛔ **THIS SHIPS WITH THE P→T FOLD, NOT AFTER IT.** `maxFlexPieceInches` is
   * 30″, so a new module's 96″ main is FOUR pieces and FMN-0064's 386″ main is
   * fourteen. Making graph authoring the default without this would replace a
   * two-click mainline with fourteen placements — worse than what it replaces,
   * and owners would have been right to say so.
   *
   * Drag along where the track goes; the run is cut into buyable lengths by
   * **`flexPieces`, the package function the #199 rebuild already uses**. Not a
   * second implementation of the same computation: a run cut by hand and a run
   * cut by the rebuild must agree piece for piece, and the only way to promise
   * that is to call the same function.
   *
   * Consecutive pieces are laid at exactly their neighbour's end, so they are
   * connected BY CONSTRUCTION — `buildTrackGraph` joins joints within a
   * hundredth of an inch and these are coincident. Nothing to snap, nothing to
   * miss.
   */
  const fillRun = (spec: PieceSpec, from: Pt, to: Pt) => {
    if (!onPiecesChange) return;
    const total = Math.hypot(to.x - from.x, to.y - from.y);
    const cuts = flexPieces({
      fromPos: 0,
      toPos: total,
      maxPieceInches: maxFlexPieceInches(spec.partId, partLibrary),
    });
    if (!cuts.length) return;

    // ⭐ THE RUN'S START GOES THROUGH `snapPiece` LIKE EVERY OTHER PLACEMENT, so
    // there is one answer to "did that connect?" — the package's. When it takes
    // an open joint the run is re-aimed along THAT joint's heading and keeps the
    // length that was dragged: the start and the direction come from the rail it
    // continues, the length from the hand. Dragging roughly along the rail is
    // then enough, which is the whole point of the gesture.
    const head = newPiece(spec, from, pieces, partLibrary.find((p) => p.id === spec.partId));
    const aimed = { ...head, rotationDeg: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI };
    const snapped = snapPiece({ ...aimed, lengthInches: cuts[0].lengthInches }, pieces, partLibrary, grabInches)?.piece;
    // A piece to continue wins; failing that, an endplate's own track point —
    // which on a blank module is the only known anchor there is (#254).
    const plate = snapped ? null : endplateAnchorNear(from, grabInches);
    const origin: Pt = snapped
      ? { x: snapped.x, y: snapped.y }
      : plate
        ? plate.pt
        : { x: from.x, y: from.y };
    // ⭐ Re-aimed INWARD off the face (`heading` points outward), not merely
    // started there. Free-moN §2.0 requires track to leave a plate square and
    // stay straight for the first 4″, so squaring it up is the correct reading
    // of the gesture — the same way snapping to a joint adopts that joint's
    // heading rather than keeping the hand-drawn angle.
    const rotationDeg = snapped
      ? snapped.rotationDeg
      : plate
        ? plate.heading + 180
        : aimed.rotationDeg;
    const rad = rotationDeg * DEG;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);

    const taken = new Set(pieces.map((p) => p.id));
    let n = 1;
    const laid: TrackPiece[] = cuts.map((f) => {
      while (taken.has(`p${n}`)) n += 1;
      const id = `p${n}`;
      taken.add(id);
      return {
        id,
        partId: spec.partId,
        x: origin.x + ux * f.fromPos,
        y: origin.y + uy * f.fromPos,
        rotationDeg,
        lengthInches: f.lengthInches,
      };
    });
    onPiecesChange([...pieces, ...laid], { commit: true });
    onSelect?.({ kind: "pieces", ids: [laid[laid.length - 1].id] });
  };

  /** Replace one piece, keeping the rest. */
  const putPiece = (next: TrackPiece, commit = false) =>
    onPiecesChange?.(pieces.map((p) => (p.id === next.id ? next : p)), { commit });

  /**
   * Drag an entry out of the palette onto the board. A ghost follows the
   * pointer; releasing over the canvas places it. Window listeners, so the drag
   * survives leaving the little button.
   *
   * ⭐ ONE HANDLER FOR BOTH MODELS (#198 step 5) — there were two, differing
   * only in what they did on release, each with its own ghost element. What is
   * dragged is a palette ENTRY; where it lands is decided by the entry.
   */
  const startPaletteDrag = (entry: PaletteEntry, e: React.PointerEvent) => {
    e.preventDefault();
    setArmed(entry);
    setPaletteDrag({ entry, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setPaletteDrag({ entry, x: ev.clientX, y: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPaletteDrag(null);
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const over =
        ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!over) return;
      const at = toLocal(ev);
      if (entry.action?.how === "piece") layPiece(entry.action.spec, at);
      else dropPositionalEntry(entry, at);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onUp = (e: React.PointerEvent) => {
    // Releasing a marquee: everything whose origin it enclosed joins the
    // selection. A shift-press that never travelled encloses nothing and so
    // changes nothing — which is the right answer for a stray modifier click.
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      const hit = piecesInMarquee(m);
      if (hit.length) {
        const have = selection?.kind === "pieces" ? selection.ids : [];
        onSelect?.({ kind: "pieces", ids: [...new Set([...have, ...hit])] });
      }
      return;
    }
    // Fill-a-run: releasing lays it. A press that never travelled is still a
    // CLICK, and a click lays one piece — the gesture it always was.
    if (fillRef.current) {
      const { spec, start, end } = fillRef.current;
      fillRef.current = null;
      setFillPreview(null);
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      setReadout(null);
      if (Math.hypot(end.x - start.x, end.y - start.y) >= FILL_MIN_INCHES) fillRun(spec, start, end);
      else layPiece(spec, start);
      return;
    }
    // Draw-to-create: releasing finishes the new track.
    if (placeRef.current) {
      const { start, end, turnoutId } = placeRef.current;
      placeRef.current = null;
      setPlacePreview(null);
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      setReadout(null);
      finishPlacement(start, end, turnoutId);
      return;
    }
    if (panRef.current) {
      const { tentative, moved } = panRef.current;
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      panRef.current = null;
      // A press on empty canvas that never travelled: that's a click, and under
      // Select a background click means "select nothing" (#188).
      if (tentative && !moved) onSelect?.(null);
      return;
    }
    // Releasing a track-end drag: the editor merges the track with any same-lane
    // track it now abuts (the snap made the ends meet exactly) into ONE track,
    // and reflects endplate contact (a track ON a plate = a double-track plate).
    if (dragRef.current?.kind === "trackEnd") onTrackEndDrop?.(dragRef.current.id);
    // Releasing a turnout drag: an End-of-Double-Track turnout dragged onto the
    // single end's plate completes the double main (the editor flips the config).
    if (dragRef.current?.kind === "turnout") onTurnoutDrop?.(dragRef.current.id);
    // Releasing a piece: let it take the nearest open joint. Snapping on RELEASE
    // rather than while dragging means the piece follows the pointer honestly
    // and lands where it belongs — snapping live makes it fight the hand.
    const pd = dragRef.current;
    // ⭐ A GROUP DROP DOES NOT SNAP — Will's call. Snapping each member to its
    // own nearest joint would tear the group apart, and snapping the set as one
    // body would move pieces the owner had already placed by hand. Several
    // things picked up together land exactly where they were put down; welding
    // is then a deliberate single-piece gesture, as it is everywhere else.
    if (pd?.kind === "pieces" && onPiecesChange) {
      if (pd.latest) onPiecesChange(pd.latest, { commit: true });
      dragRef.current = null;
      setReadout(null);
      return;
    }
    if ((pd?.kind === "piece" || pd?.kind === "pieceHandle") && onPiecesChange) {
      const moved = pd.latest ?? pieces.find((p) => p.id === pd.id);
      const rest = pieces.filter((p) => p.id !== pd.id);
      if (moved && pd.kind !== "pieceHandle") {
        const snap = snapPiece(moved, rest, partLibrary, grabInches);
        if (snap) putPiece(snap.piece, true);
      }
      // ⭐ PULLING A RUN TOWARD A JOINT CUTS IT TO FIT. Letting go of the length
      // handle near an open joint sets the angle AND the length so the far end
      // lands exactly on it — which is what makes a crossover connector
      // possible by hand at all, since its ends are fixed by two turnouts.
      if (moved && pd.kind === "pieceHandle" && pd.handle === "flex") {
        const fitted = fitFlexBetween(moved, rest, partLibrary, grabInches);
        if (fitted) putPiece(fitted, true);
      }
    }
    dragRef.current = null;
    setReadout(null);
  };
  const onLeave = (e: React.PointerEvent) => {
    setHover(null);
    onUp(e);
  };

  /** Distance from a point to the nearest endplate anchor, or null if none. */
  const nearestAnchorDist = (pt: Pt): number | null => {
    let best: number | null = null;
    for (const a of anchors) {
      const d = Math.hypot(pt.x - a.x, pt.y - a.y);
      if (best == null || d < best) best = d;
    }
    return best;
  };
  const lengthLabel = (inches: number) =>
    `${fmt(inches)}″ · ${Math.floor(inches / CAR_INCHES)} cars`;

  const seedRectangle = () => {
    // Editing a section? Start from ITS band, not the whole module's — a
    // section's rectangle is its own stretch of board (#96 phase 2b).
    if (seedOutline && seedOutline.length >= 3) {
      commit(seedOutline.map((q) => ({ x: q.x, y: q.y })));
      setSel(null);
      return;
    }
    const d = 24;
    commit([
      { x: 0, y: -d / 2 },
      { x: lengthInches, y: -d / 2 },
      { x: lengthInches, y: d / 2 },
      { x: 0, y: d / 2 },
    ]);
    setSel(null);
  };

  const polyPts = sampled.map((p) => `${p.x},${sy(p.y)}`).join(" ");
  // The donut hole (loop's open middle), as an even-odd path cut from the board.
  const donutD =
    sampledInner.length >= 3
      ? `M ${sampled.map((p) => `${p.x},${sy(p.y)}`).join(" L ")} Z ` +
        `M ${sampledInner.map((p) => `${p.x},${sy(p.y)}`).join(" L ")} Z`
      : null;
  const ctxPolys = contextOutlines.map((c) => ({
    id: c.id,
    pts: c.outline.map((p) => `${p.x},${sy(p.y)}`).join(" "),
  }));

  // Grid / ruler ticks in world inches, spanning the current view.
  const ticks = (step: number, lo: number, hi: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(round(v));
    return out;
  };
  const gx = ticks(minorStep, vbBox.minX, vbBox.minX + vbBox.w);
  const gy = ticks(minorStep, vbBox.minY, vbBox.minY + vbBox.h);
  const rulerX = ticks(majorStep, vbBox.minX, vbBox.minX + vbBox.w);
  const rulerY = ticks(majorStep, vbBox.minY, vbBox.minY + vbBox.h);
  const topY = vbBox.minY + vbBox.h; // world-top of the view (rulers pin here)
  const leftX = vbBox.minX;
  const isMajor = (v: number) => Math.abs(v % majorStep) < 1e-6;
  const zoomPct = Math.round((scale / fitScale) * 100);

  // True content extent (no view padding) — the board's actual W×H, for the
  // dimension callouts and the status bar.
  const extent = (() => {
    const pts = [
      ...anchors,
      ...sampled,
      ...centerline,
      ...trackPaths.flatMap((t) => t.pts),
      { x: 0, y: 0 },
      { x: lengthInches, y: 0 },
    ];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  })();
  const extentW = extent.maxX - extent.minX;
  const extentH = extent.maxY - extent.minY;

  /**
   * ⭐⭐ THE BOARD'S OWN MAXIMUM EXTENTS — the benchwork, and nothing else.
   *
   * Will, 2026-08-01: *"maximum length for both left to right top and bottom
   * should be shown … FMN-0078 is a good example. Left to right its maximum is
   * approximately 96″ and top to bottom is 32″."*
   *
   * ⚠️ NOT `extent` ABOVE. That one measures everything DRAWN — the centre-line,
   * every track path, and the `lengthInches` axis — so a spur running past the
   * fascia would report a bigger BOARD than the owner built. The benchwork's
   * size is a fact about the benchwork (layer 1); track cannot enlarge it.
   *
   * ⭐ And these are MAXIMA on purpose: FMN-0078 is tapered, 16″ deep at end A
   * and 32″ at end B, so "the depth" is not one number. The board needs 32″ of
   * space and that is what a layout planner and a car boot both care about.
   *
   * Falls back to the whole-drawing extent when nothing has been drawn yet, so
   * a blank module still dimensions its derived band rather than showing 0.
   */
  const boardExtent = (() => {
    // ⚠️ Section shapes are not available in this component, and no module in
    // prod has one yet (#273) — when they can be authored, they belong here too.
    const pts = sampled;
    if (pts.length < 2) return { w: extentW, h: extentH, ofBoard: false };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      ofBoard: true,
    };
  })();

  // --- Track rendering -------------------------------------------------------
  // Track reads as a clean outlined band (roadbed fill + edge lines), no ties —
  // the switch points/frog emerge from where the bands converge and cross.
  const ROADBED = 1.3;
/** How far outboard of an endplate its drag tab sits, inches. Far enough to
 * clear the benchwork corner handles that share the endplate's track point. */
const ENDPLATE_TAB = 5; // ballast-shoulder band width, inches
  const poly = (pts: Pt[]) => pts.map((p) => `${p.x},${sy(p.y)}`).join(" ");
  /** Mainline + sidings/spurs as one list, so all get the same rendering.
   * `id` is the render key (the main draws as several segments, so it needs a
   * unique one per segment); `selId` is what SELECTING the line means — every
   * main segment reports the real MAIN_TRACK_ID so clicking any part of the
   * main selects the main, like every other track (#main1-select). */
  const trackLines: {
    id: string;
    selId?: string;
    pts: Pt[];
    main: boolean;
    selectable: boolean;
  }[] = [
    // The main, drawn as segments so a wye leaves a gap (no straight-through).
    //
    // ⛔ NOT ON A GRAPH-BUILT MODULE. Its pieces ARE the track, and the main
    // would be drawn from `centerline` — which, for a module carrying no
    // geometry and no `mainPath`, is a STRAIGHT LINE INVENTED BY A FALLBACK
    // (`dims.geometry_type || "straight"` in editor.tsx). Will reported it: lay
    // pieces on a new module, drag them anywhere, and a full-width mainline
    // sits across the board refusing to follow them — because it was never
    // derived from them in the first place.
    //
    // v0.15.16 already decided a fresh module has NO auto-derived main; the
    // `|| "straight"` coercion defeats that. Fixing it there reaches endplate
    // poses, the footprint and the layout map, so it is its own change. This
    // stops the ink.
    //
    // ⚠️ This also makes the derived main UNSELECTABLE on a graph module,
    // because `trackLines` drives hit-testing as well as rendering. That is the
    // same rule `track1D`/`edit1D` already enforce: under ADR 0001 the 1-D
    // document is an OUTPUT, not something an owner drags.
    ...(graphAuthoring
      ? []
      : mainSegments.map((pts, i) => ({
          id: `__main__${i}`,
          selId: MAIN_TRACK_ID,
          pts,
          main: true,
          selectable: true,
        }))),
    ...trackPaths.map((t) => ({ id: t.id, pts: t.pts, main: false, selectable: true })),
    // A wye's mirrored second route draws as a (non-selectable) band.
    ...wyeMirrorLegs.map((w) => ({ id: w.id, pts: w.pts, main: false, selectable: false })),
    // Turnout legs the bands don't already carry (a siding's far turnout, etc.).
    ...connectorLegs.map((c) => ({ id: c.id, pts: c.pts, main: false, selectable: false })),
  ];

  /** Is a rail PAIR worth drawing, or is the gauge sub-pixel at this zoom? A
   * gauge is 0.354″; below ~3 px of separation the two lines just smear. */
  const railsVisible = RAIL_GAUGE_INCHES * scale >= 3;
  type TrackLine = (typeof trackLines)[number];
  // What clicking a line selects — the main's segments all report the main.
  const trackSelId = (line: TrackLine) => line.selId ?? line.id;
  /**
   * Which track did the owner actually press on? (Will, 2026-09-05: *"I still
   * can't move the main 1 away from the turnout."*)
   *
   * ⛔⛔ HIT-TESTING FOLLOWED PAINT ORDER, AND THE BANDS ARE 1.3″ WIDE. Only the
   * roadbed pass takes pointer events — the rails are `pointerEvents="none"` —
   * so whichever band was painted LAST owned every pixel it covered. The main is
   * first in `trackLines`, so near a turnout the diverging leg's band lay over
   * it: measured on FMN-0083, a press 1.5″ west of the turnout at pos 40 landed
   * on `sid-leg1`, not the main. Selecting Main 1 there was impossible, and
   * `mainHandlesOn` needs the main SELECTED — so it could not be reshaped near a
   * turnout at all.
   *
   * ⭐ This is the hit-testing twin of the burial already recorded on
   * `renderTrackBand`: *"the main was never broken, the DOM had it as one
   * unbroken polyline the whole time — it was buried."* That fix split the
   * PAINT into two passes so the rails stay visible. The press had the same
   * problem and kept it.
   *
   * ⭐⭐ So resolve by GEOMETRY, not by z-order: the track whose drawn centre-line
   * is nearest the pointer wins. `trackLines` is what is actually on screen, so
   * this cannot disagree with what the owner sees — unlike `hostPointsOf`, the
   * simplified re-derivation that has drifted from the drawn line before.
   */
  const nearestTrackLineId = (p: Pt): string | null => {
    let best: { id: string; d: number } | null = null;
    for (const l of trackLines) {
      if (!l.selectable || l.pts.length < 2) continue;
      let d = Infinity;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const seg = distToSegment(p, l.pts[i], l.pts[i + 1]);
        if (seg < d) d = seg;
      }
      if (!best || d < best.d) best = { id: trackSelId(l), d };
    }
    return best?.id ?? null;
  };


  const trackOn = (line: TrackLine) =>
    selection?.kind === "track" && selection.id === trackSelId(line);
  const trackClick = (line: TrackLine) =>
    tool === "industry" && onAddIndustry
      ? (e: React.PointerEvent) => {
          e.stopPropagation();
          onAddIndustry(line.main ? "main" : line.id, posFrom(toLocal(e)));
        }
      : // Turnout / Signal / piece-laying: don't intercept — let the click fall
        // through to the background handler, which drops on the nearest track
        // (#63/#53) or lays the armed part (ADR 0001).
        //
        // ⚠️ PIECE-LAYING HAD TO BE ADDED HERE TOO, and forgetting it made it
        // useless on any module that already has track — which is nearly all of
        // them. The piece layer stands aside while a part is armed, but the
        // POSITIONAL track drawn underneath had its own click handler, so laying
        // a piece over an existing main just selected the main. Verified on a
        // real module before it was noticed.
        !(track1D && armed) && tool !== "signal" && !piecesMode && onSelect
        ? (e: React.PointerEvent) => {
            /**
             * ⛔⛔ NOT GATED ON `line.selectable` — THAT WAS THE SECOND HALF OF
             * THE BUG. A turnout's connector legs are drawn as bands with
             * `selectable: false`, so no handler attached to them at all and a
             * press there fell through to the background, which CLEARS the
             * selection. Measured on FMN-0083 after the first fix: pressing the
             * main 1.5″ from the turnout selected *nothing* — the leg's band
             * swallowed the press and then dropped it.
             *
             * The band being unselectable means "this line is not a thing you
             * can select", NOT "nothing here is". The press is still on drawn
             * track, so it resolves to the nearest track that IS selectable —
             * the main, at distance 0, when you are on the main's centre line.
             */
            const id = nearestTrackLineId(toLocal(e));
            // Nothing selectable near enough — let the background have it, so
            // clicking genuinely empty board still deselects.
            if (!id) return;
            e.stopPropagation();
            onSelect({ kind: "track", id });
          }
        : undefined;

  /**
   * ⚠️⚠️ TRACKS RENDER IN TWO PASSES — every roadbed band, THEN every rail.
   * Do not merge them back together.
   *
   * Drawn per track (band and rails as one group) a later track's roadbed —
   * 1.3″ wide — paints straight over an earlier track's rails, which are 0.03″.
   * The main is first in `trackLines`, so EVERY turnout leg erased the stretch of
   * Main 1 it crossed. Main 1 was never broken: the DOM had it as one unbroken
   * polyline 0→96 the whole time. It was buried.
   *
   * That is what "the through route's rails cut off, the diverging route is
   * fine" was — the diverging route is drawn last, so nothing paints over it.
   * Reported on FMN-0068, FMN-0073 and VMN-0064.
   */
  const renderTrackBand = (line: TrackLine) => {
    const on = trackOn(line);
    const click = trackClick(line);
    return (
      <g
        key={`trkb${line.id}`}
        style={click ? { cursor: "pointer" } : undefined}
        onPointerDown={click}
      >
        {on && (
          <polyline
            points={poly(line.pts)}
            fill="none"
            stroke="#38bdf8"
            strokeOpacity={0.4}
            strokeWidth={ROADBED}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Roadbed band fill. */}
        <polyline
          points={poly(line.pts)}
          fill="none"
          stroke="#e7e2d6"
          strokeWidth={ROADBED}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <title>{line.main ? "Mainline" : line.id}</title>
      </g>
    );
  };

  /* RAILS — two lines at N-scale gauge, drawn in the second pass so no other
     track's roadbed can bury them. Outlining the roadbed's shoulders instead
     made a track read as a pale ballast band with no track on it: "I'd rather
     see the tracks drawn instead of what I think is the ballast" (Steve, #173).
     LOD: a gauge is 0.354″, so on a fitted 120″ module it's only ~3 px — below
     that the pair is mush, so draw ONE line, which still reads as track. Where
     the rails DO show, the points taper and the frog X fall out of the closure
     geometry for free. Pointer events stay off so the band keeps the hit test. */
  const renderTrackRails = (line: TrackLine) => {
    const on = trackOn(line);
    const colour = on ? "#0284c7" : line.main ? "#1e293b" : "#334155";
    return (
      <g key={`trkr${line.id}`} pointerEvents="none">
        {railsVisible ? (
          [RAIL_GAUGE_INCHES / 2, -RAIL_GAUGE_INCHES / 2].map((o, k) => (
            <polyline
              key={`rail${k}`}
              points={poly(offsetPath(line.pts, o))}
              fill="none"
              stroke={colour}
              strokeWidth={Math.max(world(0.6), RAILHEAD_INCHES)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        ) : (
          <polyline
            points={poly(line.pts)}
            fill="none"
            stroke={colour}
            strokeWidth={world(1.1)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    );
  };

  /**
   * ⭐⭐ THE ONE PARTS PALETTE (#198 step 5). Same component, same entry type,
   * same builder, in both authoring models — see `track-palette.tsx`.
   *
   * ⭐ A turnout is not a different activity from track; it is a thing you put
   * ON track. It used to have its own rail button, then its own row of glyphs
   * beside a frog-number dropdown while the graph model had a separate palette
   * of products. Three idioms for one question: **what is this bit of track?**
   */
  const palette = (
    <TrackPalette
      // Keyed on the model, so the open kind resets with the entries rather
      // than pointing at a group that no longer exists.
      key={graphAuthoring ? "graph" : "positional"}
      entries={paletteEntries}
      mode={graphAuthoring ? "graph" : "positional"}
      armed={armed}
      onArm={setArmed}
      onDragStart={startPaletteDrag}
    />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Tool options (left) + view controls (right). Only the active tool's
          controls show — not a global toolbar. */}
      {/* ⭐ THE TOOL BAR IS BOUNDED, OR IT EATS THE BOARD. This row is
          `shrink-0 flex-wrap` and holds the parts palette, so arming the
          Turnout kind — 12 generic chips plus 24 products — wraps to seven
          rows and simply takes the height it wants. The `<svg>` below gets
          whatever is left, which on a laptop measured **80px**: a board
          reduced to a sliver, which is what made this unusable at 1355% zoom.
          ⚠️ Giving the COLUMN a scrollbar did not fix this on its own — the
          squeeze happens inside here, between the bar and the canvas, so the
          column had nothing to scroll. Bounding the bar is what gives the
          board its height back; a long palette scrolls within the bar. */}
      <div className="mb-2 flex max-h-[38vh] min-h-6 shrink-0 flex-wrap items-center gap-2 overflow-y-auto text-xs">
        {tool === "benchwork" ? (
          <>
            {editingLabel ? (
              <span className="font-medium text-gray-700">{editingLabel}</span>
            ) : null}
            <button type="button" onClick={seedRectangle} className={btn}>
              {outline.length ? "Reset to rectangle" : "Start from a rectangle"}
            </button>
            {outline.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  commit([]);
                  setSel(null);
                }}
                className={btn}
              >
                Clear
              </button>
            )}
            <span className="text-gray-500">
              {outline.length === 0
                ? "No outline — the layout falls back to the endplate-width band."
                : "Click an edge to add a corner · drag a corner (snaps to ◆) · drag an edge's ◇ to curve it."}
            </span>
          </>
        ) : tool === "industry" ? (
          <span className="text-gray-500">
            Click a track to place an industry there (or the main) · then set its
            name and cars in the inspector.
          </span>
        ) : tool === "signal" ? (
          <span className="text-gray-500">
            Click the main to drop a signal (a block control point) · then set its
            direction and side in the inspector.
          </span>
        ) : piecesMode ? (
          <>
            {palette}
            <span className="text-gray-500">
              {armedPart
                ? isFlexSpec(armedPart)
                  ? "Drag along where the track goes and the whole run fills with flex — or click to lay one piece. Ends snap to open joints."
                  : "Click the board to lay it. Ends snap to open joints, and dropping one ON a run cuts the run to take it."
                : "Drag a part onto the board — or click one, then click the board."}
            </span>
            {/* ⚠️ SAY WHY THE TRACK ALREADY DRAWN HERE CANNOT BE JOINED — and
                offer the way out. Pieces snap to other PIECES; the mainline on
                screen is the POSITIONAL model and has no joints at all, so a
                piece dropped against it simply sits there. Silence read as a
                broken snap and an owner reported it twice (#199). The rebuild is
                the answer: convert the board's track to pieces and there is
                something to join.
                ⚠️ It no longer says "drawn with the Track tool". A module with
                nothing authored on it reaches this bar too (that is what makes
                it graph-built), and its mainline is DERIVED from the geometry —
                nobody drew it. The sentence has to be true of both. */}
            {centerline.length >= 2 && pieces.length === 0 && (
              <>
                <span className="font-medium text-amber-700">
                  The mainline drawn here is this module&rsquo;s positional
                  model. Pieces join other pieces, so they can&rsquo;t connect to
                  it until it is rebuilt.
                </span>
                {rebuildOffer}
              </>
            )}
          </>
        ) : track1D ? (
          pendingTrack ? (
            <>
              {turnouts.length < (pendingTrack === "siding" ? 2 : 1) ? (
                <span className="font-medium text-amber-700">
                  {pendingTrack === "siding"
                    ? "A siding connects two turnouts — place two on the main first (+ Turnout)."
                    : "A spur diverges from a turnout — place one on the main first (+ Turnout)."}
                </span>
              ) : (
                <span className="font-medium text-teal-700">
                  {pendingTrack === "siding"
                    ? "Draw the siding — press on one turnout and drag to another."
                    : "Draw the spur — press on the turnout and drag out to the stub end."}
                </span>
              )}
              <button type="button" onClick={onCancelPlace} className={btn}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {trackMenu}
              {palette}
              {/* Only the WARNING lives with the palette. Sharing a bar with the
                  track controls, its old standing hint sat alongside the track
                  hint and the owner got two paragraphs telling them different
                  things; the one hint below now says whichever is true. */}
              {dropWarn && <span className="font-medium text-amber-700">{dropWarn}</span>}
              {!editSpurTrack && mainPath.length >= 2 && onMainPathChange && (
                <button type="button" onClick={() => onMainPathChange([])} className={btn}>
                  Straighten
                </button>
              )}
              {editSpurTrack?.path && editSpurTrack.path.length >= 2 && onTrackPathChange && (
                <button
                  type="button"
                  onClick={() => onTrackPathChange(editSpurTrack.id, [])}
                  className={btn}
                >
                  Un-draw
                </button>
              )}
              <span className="text-gray-500">
                {armed
                  ? armed.action?.how === "crossover"
                    ? "Click the main where the crossover goes — the side you click is the side the parallel track runs. Esc to put it down."
                    : "Click a track to drop the turnout there — it lands with a short spur you drag to size. Esc to put it down."
                  : editSpurTrack
                    ? "Drag the spur's points ○ to bend/rotate (◇ to curve · Alt-click to remove). The throat stays on its turnout."
                    : mainPath.length < 2 && centerline.length < 2
                      ? "Draw the mainline — click near one end of the board, then the other. Then drag a point ○ to move it, or an edge ◇ to curve it."
                      : "Drag the mainline's points ○ · edge ◇ to curve · click the line to add a bend · Alt-click to remove. Click any other track to edit it."}
              </span>
              {/* ⭐ THE REBUILD OFFER HAD TO REACH THIS BAR TOO, and that is the
                  one part of this fold that no type error would have caught. It
                  used to live ONLY in the Pieces tool's bar — but a module with
                  sidings and turnouts and no pieces is exactly the module the
                  parts palette is no longer shown on, so leaving it there would
                  have silently deleted the whole #199 conversion path for every
                  legacy module in the database. `RebuildAsPieces` self-gates
                  (null once a module is already built from pieces). */}
              {!armed && !editSpurTrack && rebuildOffer}
            </>
          )
        ) : (
          <span className="text-gray-500">
            {/* ⭐ "A TRACK'S END", NOT "A SIDING'S END" (#416). This line is
                always on screen and it was said of EVERY non-main track, so an
                industry spur and a yard track were both called a siding. Will:
                *"that is strange to call it a siding technically."* A SIDING IS
                A PASSING TRACK; a track serving an industry is a spur or a
                house track. The roles themselves were already right — "Passing
                siding", "Industry spur", "Yard track" — it was the prose around
                them that flattened all three into the commonest word. */}
            Click anything to select it · drag a turnout ● or a track&rsquo;s end ○
            along the main to position it · <span className="whitespace-nowrap">drag the background to pan</span>.
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {/* Pan was reachable only by Space-drag or middle-drag, with nothing on
              screen saying so — which is why it read as "you can only zoom"
              (#188). The controls now say how to move around. */}
          <span
            className="hidden text-gray-400 sm:inline"
            title="Drag the background, scroll or two-finger swipe to pan · ctrl/⌘ + scroll (or pinch) to zoom · Space-drag and middle-drag pan from any tool"
          >
            drag / scroll to pan
          </span>
          <button type="button" onClick={() => zoomButtons(1 / 1.25)} className={iconBtn} title="Zoom in (ctrl/⌘ + scroll, or pinch)">
            +
          </button>
          <button type="button" onClick={() => zoomButtons(1.25)} className={iconBtn} title="Zoom out (ctrl/⌘ + scroll, or pinch)">
            −
          </button>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className={`${btn} ${showLegend ? "bg-blue-50 text-blue-700" : ""}`}
            title="What the handles and markers mean"
          >
            Legend
          </button>
          <button
            type="button"
            onClick={() => setView(null)}
            className={btn}
            title="Fit the board to the view"
          >
            Fit
          </button>
          <span className="w-11 text-right tabular-nums text-gray-500">{zoomPct}%</span>
        </div>
      </div>

      {/* ONE drag ghost, for whatever the one palette is dragging. It says the
          same thing the button said — glyph and label together — so what is in
          the hand is never in doubt mid-drag. */}
      {paletteDrag && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-1 rounded border border-blue-500 bg-white/95 px-2 py-1 text-[11px] text-blue-700 shadow-md"
          style={{ left: paletteDrag.x + 12, top: paletteDrag.y + 12 }}
        >
          <PieceGlyph name={paletteDrag.entry.glyph} className="h-3.5 w-5 shrink-0" />
          {paletteDrag.entry.label}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className={`min-h-0 flex-1 touch-none rounded-md border border-gray-300 bg-white ${
          spaceHeld
            ? "cursor-grab"
            : piecesMode
              ? armedPart
                ? "cursor-crosshair"
                : "cursor-grab"
            : tool === "benchwork" || tool === "industry" || tool === "track" || tool === "signal"
              ? "cursor-crosshair"
              : // Select: the background is draggable, so say so (#188). Objects
                // on it set their own cursor, which wins.
                "cursor-grab"
        }`}
        onContextMenu={(e) => {
          // Suppress the browser's own menu and offer ours instead. By now the
          // right press has already selected whatever was under it.
          e.preventDefault();
          onCanvasContextMenu?.({ x: e.clientX, y: e.clientY });
        }}
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onLeave}
      >
        {/* --- Drafting grid (inches), under everything --- */}
        <g pointerEvents="none">
          {gx.map((x) => (
            <line
              key={`gx${x}`}
              x1={x}
              y1={sy(vbBox.minY)}
              x2={x}
              y2={sy(vbBox.minY + vbBox.h)}
              stroke={isMajor(x) ? "#e2e8f0" : "#f1f5f9"}
              strokeWidth={world(isMajor(x) ? 1 : 0.5)}
            />
          ))}
          {gy.map((y) => (
            <line
              key={`gy${y}`}
              x1={vbBox.minX}
              y1={sy(y)}
              x2={vbBox.minX + vbBox.w}
              y2={sy(y)}
              stroke={isMajor(y) ? "#e2e8f0" : "#f1f5f9"}
              strokeWidth={world(isMajor(y) ? 1 : 0.5)}
            />
          ))}
          {/* Origin axes — endplate A's track point (0,0) and the mainline y=0 */}
          <line x1={vbBox.minX} y1={sy(0)} x2={vbBox.minX + vbBox.w} y2={sy(0)} stroke="#cbd5e1" strokeWidth={world(1)} />
          <line x1={0} y1={sy(vbBox.minY)} x2={0} y2={sy(vbBox.minY + vbBox.h)} stroke="#cbd5e1" strokeWidth={world(1)} />
        </g>

        {/* --- Rulers, pinned to the current view's top and left edges --- */}
        <g pointerEvents="none" fill="#94a3b8" fontSize={world(10)}>
          {rulerX.map((x) => (
            <text key={`rx${x}`} x={x + world(2)} y={sy(topY) + world(11)} textAnchor="start">
              {fmt(x)}
            </text>
          ))}
          {rulerY.map((y) => (
            <text key={`ry${y}`} x={leftX + world(2)} y={sy(y) - world(2)} textAnchor="start">
              {fmt(y)}
            </text>
          ))}
        </g>

        {/* --- The board itself, as a fill under the track (a real board the
            track sits on). Its edge stroke + handles are drawn on top, below. --- */}
        {/* The module's other boards, faint — context for the one being
            shaped. Drawn outside the condition below so they still show while
            this section has no outline of its own yet. */}
        {ctxPolys.map((c) => (
          <polygon
            key={c.id}
            points={c.pts}
            fill="#f6f2ea"
            fillOpacity={0.9}
            stroke="#cbd5e1"
            strokeWidth={world(0.8)}
            pointerEvents="none"
          />
        ))}
        {sampled.length >= 2 && outline.length >= 3 && (
          donutD ? (
            <path d={donutD} fillRule="evenodd" fill="#f6f2ea" fillOpacity={0.9} pointerEvents="none" />
          ) : (
            <polygon points={polyPts} fill="#f6f2ea" fillOpacity={0.9} pointerEvents="none" />
          )
        )}

        {/* --- Track: roadbed + rails/ties (or a single line when zoomed out) --- */}
        {/* renderTrack's click handler reads the pointer via svgRef, but only
            when fired — not during render; the lint rule can't see that. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {trackLines.map(renderTrackBand)}
        {/* The turnout PART's tie strip — between ballast and rail, where the
            moulding actually sits. This is what separates the part from the
            flex track running on past it: the strip's far edge is where the
            owner's own track begins. Drawn only where a real part has been
            measured, so its absence means the library has a gap, not that the
            turnout is small. Same LOD gate as the rails — below that the whole
            turnout is a few pixels and the strip would only muddy it. */}
        {!graphAuthoring && railsVisible &&
          turnoutPts.map((t) =>
            t.body ? (
              <polygon
                key={`tb${t.id}`}
                points={t.body.map((p) => `${p.x},${sy(p.y)}`).join(" ")}
                fill="#d8cfba"
                stroke="#a89e88"
                strokeWidth={Math.max(world(0.5), RAILHEAD_INCHES)}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              >
                <title>Turnout body — the part itself; track past it is flex</title>
              </polygon>
            ) : null,
          )}
        {trackLines.map(renderTrackRails)}
        {/* RAIL JOINTS — a tick across the rails where one piece of track ends
            and the next begins. Same LOD gate as the rails: below it the whole
            turnout is a few pixels and joint marks would only be grit. */}
        {!graphAuthoring && railsVisible &&
          trackJoints.map((j, i) => {
            const h = RAIL_GAUGE_INCHES * 0.85; // just past the railheads
            return (
              <line
                key={`jt${i}`}
                x1={j.x - j.nx * h}
                y1={sy(j.y - j.ny * h)}
                x2={j.x + j.nx * h}
                y2={sy(j.y + j.ny * h)}
                stroke="#0f172a"
                // Plain pixels: non-scaling-stroke takes screen units, and a
                // world() value here would come out a sub-pixel hairline (#189).
                strokeWidth={1.4}
                strokeLinecap="butt"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              >
                <title>Rail joint — one piece of track ends and the next begins</title>
              </line>
            );
          })}
        {/* FLEX JOINTS — where one length of flex meets the next (#193). NOT
            behind the rail LOD gate: these are 30″ apart, not part detail, and
            a 96″ module opens at a zoom where the rails don't resolve — so
            gating them showed none of the thing the model is for. The tick keeps
            a minimum on-screen length for the same reason. */}
        {!graphAuthoring &&
          flexJoints.map((j, i) => {
          const h = Math.max(RAIL_GAUGE_INCHES * 0.85, 3 / scale);
          return (
            <line
              key={`fj${i}`}
              x1={j.x - j.nx * h}
              y1={sy(j.y - j.ny * h)}
              x2={j.x + j.nx * h}
              y2={sy(j.y + j.ny * h)}
              stroke="#0f172a"
              strokeWidth={1.4}
              strokeLinecap="butt"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            >
              <title>Rail joint — one length of flex track ends and the next begins</title>
            </line>
          );
        })}
        {/* Turnout rails with nothing joined to them — drag a track end here. */}
        {!graphAuthoring &&
          danglingRailEnds.map((r) => (
          <circle
            key={`dangle${r.turnoutId}-${r.trackId}`}
            cx={r.at.x}
            cy={sy(r.at.y)}
            r={world(6)}
            fill="none"
            stroke="#d97706"
            // ⚠️ PLAIN PIXELS, not world(). `non-scaling-stroke` already takes
            // its width in screen units, so passing world() converts twice and
            // leaves a 0.08px hairline — invisible, which for a marker whose
            // whole job is to be noticed is the same as not drawing it.
            // The RADIUS is different: that's geometry, so it stays in world().
            strokeWidth={2}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          >
            <title>
              Nothing is connected to this turnout&apos;s diverging rail — drag the
              track&apos;s end onto it. The turnout stays put; the track comes to it.
            </title>
          </circle>
        ))}
        {/* ⛔ TRACK NOTHING LEADS ONTO (#350) — the mirror of the dangling
            rail ring above, and the worse of the two: an unreachable track
            still counts toward capacity. Drawn at BOTH of its ends, because
            which end should have met a turnout is exactly what the owner has
            to decide. */}
        {!graphAuthoring &&
          trackPaths
            .filter((tp) => unreachableTracks.has(tp.id) && tp.pts.length >= 2)
            .flatMap((tp) => [tp.pts[0], tp.pts[tp.pts.length - 1]].map((at, k) => (
              <circle
                key={`unreachable${tp.id}-${k}`}
                cx={at.x}
                cy={sy(at.y)}
                r={world(6)}
                fill="none"
                stroke="#d97706"
                // Plain pixels, not world() — `non-scaling-stroke` already takes
                // its width in screen units (see the dangling ring above).
                strokeWidth={2}
                strokeDasharray="1 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              >
                <title>
                  Nothing leads onto this track, so no train can reach it — add a
                  turnout that diverges onto it, or drag this end onto a
                  turnout&apos;s diverging rail.
                </title>
              </circle>
            )))}
        {/* Section joints — dashed dividers where the boards split (#48). */}
        {centerline.length >= 2 &&
          sectionBreaks.map((pos, i) => {
            const p = sampleAt(centerline, pos);
            const half =
              Math.max(endplateWidths?.["A"] ?? 24, endplateWidths?.["B"] ?? 24) / 2 + 2;
            /**
             * ⭐⭐ THE LINE IS THE CUT, so it has to be drawn on the skew too
             * (#354). A cut at `skew` degrees crossing at lateral offset `u`
             * meets the spine at `pos + u·tan(skew)` — the same one formula the
             * package uses for the boards' own shapes, so the dashed line and
             * the seam between the two bands are the same line.
             *
             * ⚠️ At ±90° there is no cut across the board at all (and JS's
             * tan(90°) is a finite 1.6e16, not Infinity), so it draws square —
             * matching what the boards do, and what the panel warns about.
             */
            const skew = sectionSkews[i] ?? 0;
            const at = (u: number) => {
              const t = !skew || Math.abs(skew) >= 90 ? 0 : u * Math.tan((skew * Math.PI) / 180);
              const q = t ? sampleAt(centerline, pos + t) : p;
              return { x: q.x + q.nx * u, y: q.y + q.ny * u };
            };
            const A = at(half);
            const B = at(-half);
            return (
              <g key={`sec${i}`}>
                <line
                  x1={A.x}
                  y1={sy(A.y)}
                  x2={B.x}
                  y2={sy(B.y)}
                  stroke="#64748b"
                  strokeWidth={world(1)}
                  strokeDasharray={`${world(3)} ${world(2)}`}
                >
                  {/* Dashed on purpose: an endplate face is drawn solid because
                      it is a standardised interface; a joint is internal bench
                      work and is bound by none of those rules (#96). */}
                  <title>
                    Section joint — internal to the module. Endplate rules
                    (square crossing, 4″ setbacks, track spacing) do not apply
                    here.
                  </title>
                </line>
                <text
                  x={A.x}
                  y={sy(A.y) - world(2)}
                  textAnchor="middle"
                  fontSize={world(7)}
                  fill="#64748b"
                >
                  {`${fmt(pos)}″`}
                </text>
                {onSectionBreakMove ? (
                  <circle
                    cx={p.x}
                    cy={sy(p.y)}
                    r={world(3)}
                    fill="#fff"
                    stroke="#64748b"
                    strokeWidth={world(1)}
                    className="cursor-ew-resize"
                    onPointerDown={(e) => beginDrag(e, { kind: "sectionBreak", i })}
                  >
                    {/* ⭐ SAY WHAT A JOINT IS, not just how to move it (#96).
                        The dashed line already looks different from an
                        endplate's solid face; the wording is what stops an
                        owner reading it AS one. The standard: "standards for
                        module end interfaces do not apply to inter-section
                        interfaces, as these are considered to be internal to
                        the module." */}
                    <title>
                      Section joint — a construction and transport seam inside
                      the module, not a standardised interface. Track may cross
                      it at any angle. Drag to move it.
                    </title>
                  </circle>
                ) : null}
              </g>
            );
          })}
        {/* No centre-line yet? Show the endplate-to-endplate lead dashed. */}
        {centerline.length < 2 && poses.length >= 2 && (
          <line
            x1={poses[0].x}
            y1={sy(poses[0].y)}
            x2={poses[poses.length - 1].x}
            y2={sy(poses[poses.length - 1].y)}
            stroke="#93c5fd"
            strokeWidth={r * 0.5}
            strokeDasharray={`${r} ${r}`}
          />
        )}
        {/* Turnouts — drag along the track to set their position */}
        {!graphAuthoring &&
          turnoutPts.map((t) => {
          const on = selection?.kind === "turnout" && selection.id === t.id;
          const node = on ? "#0284c7" : "#475569";
          return (
            <g key={`to${t.id}`}>
              {/* The PART's own outline, when this turnout names a library part
                  that carries one. Drawn under the frog marker so the marker
                  stays readable — and note it is anchored on our MEASURED lead,
                  not the file's frog, so if a part's geometry disagrees its V
                  will visibly miss the marker. That gap is the validation. */}
              {railsVisible &&
                t.outline?.map((poly, i) => (
                  <polyline
                    key={`po${t.id}-${i}`}
                    points={poly.map((p) => `${p.x},${sy(p.y)}`).join(" ")}
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth={Math.max(world(0.9), RAILHEAD_INCHES)}
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ))}
              {/* Frog node — where the diverging rails cross, one track over.
                  The turnout's position IS its frog (#132), so this marker is
                  set by the position field, not dragged. A small snap circle. */}
              {t.frog &&
                (railsVisible && t.frogV ? (
                  // The frog CASTING, drawn as the V it actually is: the two
                  // rails that cross here, carried on away from the points. An
                  // opaque diamond centred on the crossing hid the very geometry
                  // it was marking (its diagonal was wider than the gauge).
                  <polyline
                    points={[t.frogV[0], t.frog, t.frogV[1]]
                      .map((p) => `${p.x},${sy(p.y)}`)
                      .join(" ")}
                    fill="none"
                    stroke={node}
                    // RAILHEAD width, not double: the V's legs ARE rails. A #6
                    // frog is only 9.46°, so at 0.531″ the two tips sit 0.087″
                    // apart — draw them any heavier and the strokes overlap for
                    // their whole length and the V merges into a blob.
                    strokeWidth={Math.max(world(0.9), RAILHEAD_INCHES)}
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    pointerEvents="none"
                  >
                    <title>Frog — where the diverging rails cross. Set by the turnout&rsquo;s position, not dragged.</title>
                  </polyline>
                ) : (
                  <circle
                    cx={t.frog.x}
                    cy={sy(t.frog.y)}
                    r={r * 0.6}
                    fill="#fff"
                    stroke={node}
                    strokeWidth={r * 0.28}
                    pointerEvents="none"
                  >
                    <title>Frog (where the diverging rails cross). Set by the turnout&rsquo;s position — not dragged here.</title>
                  </circle>
                ))}
              {/* Turnout node — the draggable control, on the track beside its
                  frog. Dragging it sets the turnout's position (its frog, #132). */}
              <circle
                cx={t.x}
                cy={sy(t.y)}
                r={r * 0.85}
                fill="#fff"
                stroke={node}
                strokeWidth={r * 0.38}
                style={
                  onTurnoutMove
                    ? { cursor: turnoutArmed(t.id) ? "ew-resize" : "pointer" }
                    : undefined
                }
                onPointerDown={
                  onTurnoutMove
                    ? (e) => {
                        /**
                         * ⭐⭐ SELECT FIRST, MOVE SECOND — GRAB PRIORITY (Will,
                         * 2026-09-05: *"when I try and move Main 1, I end up
                         * moving the switch"*).
                         *
                         * This node sits ON its host track by construction —
                         * its centre IS the frog, which is a point on the main
                         * — so every press aimed at the main near a turnout
                         * lands on it too, and SVG hit-testing follows paint
                         * order, which puts this circle on top. It used to call
                         * `beginDrag` outright, so an ambiguous press did not
                         * merely pick the wrong object: it MOVED it.
                         *
                         * An unselected turnout now only selects. Nothing on the
                         * board moves until you have said which thing you meant,
                         * and a mis-aimed press costs a click rather than an
                         * edit. `beginDrag` already had exactly this shape for
                         * the right button (#284) — "selecting is still right;
                         * the menu then acts on what you clicked".
                         *
                         * ⚠️ The turnout stays reachable: the press selects it,
                         * and the second grab drags it. Do NOT "fix" this by
                         * letting the press fall through to the track — that
                         * makes a turnout unselectable on the canvas, which is
                         * the mirror of the bug where a siding end could not be
                         * grabbed because a turnout four pixels away was
                         * painted over it.
                         */
                        if (!turnoutArmed(t.id) && e.button !== 2) {
                          e.stopPropagation();
                          onSelect?.({ kind: "turnout", id: t.id });
                          return;
                        }
                        beginDrag(e, { kind: "turnout", id: t.id });
                      }
                    : undefined
                }
              >
                <title>
                  {!onTurnoutMove
                    ? "Turnout"
                    : turnoutArmed(t.id)
                      ? "Turnout — drag along the track to move it (its position is measured to its frog)"
                      : "Turnout — click to select it; drag once selected (so a press meant for the track never moves it)"}
                </title>
              </circle>
            </g>
          );
        })}
        {/* Siding / spur end handles — drag along the main to reposition.
            ⭐⭐ RENDERED AFTER THE TURNOUTS ON PURPOSE. Painting these first put
            every turnout marker ON TOP of them, and SVG hit-testing follows
            paint order — `elementFromPoint` over FMN-0064's siding start (pos
            16) returned the TURNOUT at pos 13, four pixels away. The handle
            existed and could not be grabbed, which looks exactly like the
            handle not existing.
            ⚠️ Not an edge case: the end you are trying to join to its turnout
            is BY DEFINITION near that turnout, so they overlap precisely when
            the gesture matters. Tests and types both pass either way; only
            driving it in a browser shows the difference. */}
        {!graphAuthoring && onTrackEndMove &&
          trackEnds.map((h) => (
            <circle
              key={`end${h.id}${h.end}`}
              cx={h.x}
              cy={sy(h.y)}
              r={r * 0.7}
              fill="#fff"
              stroke="#0f766e"
              strokeWidth={r * 0.3}
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => beginDrag(e, { kind: "trackEnd", id: h.id, end: h.end })}
            >
              <title>{`Drag to move this track's ${h.end === "from" ? "start" : "end"} along the main`}</title>
            </circle>
          ))}
        {/* Signals — a mast (stem from the track it governs) + a head. */}
        {signalPts.map((s) => {
          const on = selection?.kind === "cp" && selection.id === s.cp;
          return (
            <g
              key={`sig${s.id}`}
              style={onSelect ? { cursor: "pointer" } : undefined}
              onPointerDown={
                onSelect
                  ? (e) => {
                      e.stopPropagation();
                      onSelect({ kind: "cp", id: s.cp });
                    }
                  : undefined
              }
            >
              <line
                x1={s.bx}
                y1={sy(s.by)}
                x2={s.x}
                y2={sy(s.y)}
                stroke={on ? "#0284c7" : "#334155"}
                strokeWidth={world(on ? 1.4 : 1)}
                strokeLinecap="round"
              />
              <circle
                cx={s.x}
                cy={sy(s.y)}
                r={world(3)}
                fill="#0f172a"
                stroke={on ? "#0284c7" : "#fff"}
                strokeWidth={world(on ? 1.4 : 0.8)}
              />
              <circle cx={s.x} cy={sy(s.y)} r={world(1.2)} fill="#f87171" />
              <title>{`Signal (${s.facing === "AtoB" ? "→ East" : "→ West"})`}</title>
            </g>
          );
        })}
        {/* Industries — a car-spot span beside its track, name + optional readout. */}
        {industryShapes.map((ind) => {
          const on = selection?.kind === "industry" && selection.id === ind.industryId;
          return (
            <g key={`ind${ind.id}`}>
              {ind.path.length >= 2 && (
                <polyline
                  points={ind.path.map((p) => `${p.x},${sy(p.y)}`).join(" ")}
                  fill="none"
                  stroke={on ? "#b45309" : "#d97706"}
                  /* ⭐ A HIGHLIGHTER, NOT A COVER. The mark now lies ON the
                     rail it describes, so it is drawn wide and translucent —
                     the track, its ties and its joints still read THROUGH it.
                     Painting an opaque line here would hide the very thing the
                     owner is being shown. */
                  strokeWidth={on ? world(9) : world(7)}
                  strokeOpacity={on ? 0.55 : 0.4}
                  strokeLinecap="round"
                  style={onSelect ? { cursor: "pointer" } : undefined}
                  onPointerDown={
                    onSelect
                      ? (e) => {
                          e.stopPropagation();
                          onSelect({ kind: "industry", id: ind.industryId });
                        }
                      : undefined
                  }
                >
                  <title>{ind.name || "Industry"}</title>
                </polyline>
              )}
              {/* ⭐ READABLE OVER THE HIGHLIGHT AND THE RAIL. The glyphs are
                  painted over a white halo of their own outline — `paintOrder`
                  puts the stroke UNDER the fill, so the letters keep their
                  shape instead of being thickened. That works over the amber
                  band, the rail and the ties alike, which a solid backing
                  rectangle would not: it would hide the very track the
                  highlight exists to point at. */}
              <text
                x={ind.label.x}
                y={sy(ind.label.y)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={world(9)}
                fill="#7c2d12"
                stroke="#ffffff"
                strokeWidth={world(2.6)}
                strokeLinejoin="round"
                paintOrder="stroke"
                fontWeight={700}
                pointerEvents="none"
              >
                {ind.name || "Industry"}
                {ind.sub && (
                  <tspan x={ind.label.x} dy={world(10)} fontWeight={400} fill="#a16207">
                    {ind.sub}
                  </tspan>
                )}
              </text>
              {onIndustryEndMove &&
                ind.editable &&
                ind.ends.map((h) => (
                  <rect
                    key={`ie${ind.id}${h.end}`}
                    x={h.x - world(3)}
                    y={sy(h.y) - world(3)}
                    width={world(6)}
                    height={world(6)}
                    fill="#fff"
                    stroke="#b45309"
                    strokeWidth={world(1)}
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(e) => beginDrag(e, { kind: "industryEnd", id: ind.industryId, end: h.end })}
                  >
                    <title>{`Drag to move this industry's ${h.end === "from" ? "start" : "end"}`}</title>
                  </rect>
                ))}
            </g>
          );
        })}
        {poses.map((p) => {
          const hw = halfWidthOf(p);
          // Along the face (perpendicular to the track), oriented to the
          // centre-line normal so both ends offset the same way.
          const { px: fx, py: fy } = faceAxis(p);
          // …and the outward heading itself (for the hatch ticks).
          const hxo = Math.cos(p.heading * DEG);
          const hyo = Math.sin(p.heading * DEG);
          const on = selection?.kind === "endplate" && selection.id === p.id;
          // The plate centres on the TRACKS crossing it, which on a double end
          // is half a spacing off the track point (Free-moN §2.0, #93).
          const off = endplateTrackOffsets?.[p.id] ?? 0;
          const cxp = p.x + fx * off;
          const cyp = p.y + fy * off;
          const ax = cxp - fx * hw;
          const ay = cyp - fy * hw;
          const bx = cxp + fx * hw;
          const by = cyp + fy * hw;
          // Short hatch ticks along the face — reads as the machined interface,
          // not a wall. Angled inward from the face.
          const nTicks = Math.max(3, Math.round(hw / 3));
          const ticks = Array.from({ length: nTicks + 1 }, (_, i) => {
            const t = i / nTicks;
            const cx = ax + (bx - ax) * t;
            const cy = ay + (by - ay) * t;
            const len = 1.4;
            return {
              x1: cx,
              y1: cy,
              x2: cx - (hxo + fx * 0.6) * len,
              y2: cy - (hyo + fy * 0.6) * len,
            };
          });
          return (
            <g key={p.id}>
              {ticks.map((t, i) => (
                <line
                  key={`h${i}`}
                  x1={t.x1}
                  y1={sy(t.y1)}
                  x2={t.x2}
                  y2={sy(t.y2)}
                  stroke="#93c5fd"
                  strokeWidth={world(0.8)}
                  pointerEvents="none"
                />
              ))}
              {/* Wide, invisible hit line over the face so the thin visible
                  stroke is easy to click. The benchwork corners still sit on
                  the face's ENDS, but its middle (the track point) is now a
                  fat target — and it's also selectable from the Objects list
                  (#145). */}
              {onSelect && (
                <line
                  x1={ax}
                  y1={sy(ay)}
                  x2={bx}
                  y2={sy(by)}
                  stroke="transparent"
                  strokeWidth={r * 3}
                  strokeLinecap="round"
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelect({ kind: "endplate", id: p.id });
                  }}
                />
              )}
              <line
                x1={ax}
                y1={sy(ay)}
                x2={bx}
                y2={sy(by)}
                stroke={on ? "#1d4ed8" : "#3b82f6"}
                strokeWidth={on ? r * 1.2 : r * 0.7}
                strokeLinecap="round"
                pointerEvents="none"
              >
                <title>{`Endplate ${p.id} — the standard interface`}</title>
              </line>
              {/* Grip to slide this end along the main. Only endplate B gets
                  one: A is the origin everything is measured from (dragging it
                  would move every position on the board), and a branch endplate
                  is placed in 2-D, not slid along the main (#108/#170). */}
              {onEndplateEndMove && p.id === "B" ? (
                <g>
                  {/* Sits a tab's length OUTBOARD of the plate rather than on
                      its track point. Benchwork corners land exactly there on
                      any board whose outline meets the endplate, and their
                      handles would swallow every grab — you'd drag the outline
                      thinking you were moving the end. */}
                  <line
                    x1={p.x}
                    y1={sy(p.y)}
                    x2={p.x + hxo * ENDPLATE_TAB}
                    y2={sy(p.y + hyo * ENDPLATE_TAB)}
                    stroke="#2563eb"
                    strokeWidth={world(0.8)}
                    pointerEvents="none"
                  />
                  <circle
                    cx={p.x + hxo * ENDPLATE_TAB}
                    cy={sy(p.y + hyo * ENDPLATE_TAB)}
                    r={world(3.2)}
                    fill="#fff"
                    stroke="#2563eb"
                    strokeWidth={world(1)}
                    className="cursor-ew-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      beginDrag(e, { kind: "endplateEnd", id: p.id });
                    }}
                  >
                    <title>Drag to lengthen or shorten the last section</title>
                  </circle>
                </g>
              ) : null}
              {/* A placed branch endplate (C, D…) is dragged in 2-D to sit on a
                  fascia — its face clings to the nearest benchwork edge (#170).
                  The grab sits a tab OUTBOARD of the face so it clears the
                  benchwork edge's own midpoint handle, which lands on the same
                  spot when the plate is on an edge. */}
              {onEndplateMove && p.id !== "A" && p.id !== "B" ? (
                <g>
                  <line
                    x1={cxp}
                    y1={sy(cyp)}
                    x2={cxp + hxo * ENDPLATE_TAB}
                    y2={sy(cyp + hyo * ENDPLATE_TAB)}
                    stroke="#7c3aed"
                    strokeWidth={world(0.8)}
                    pointerEvents="none"
                  />
                  <circle
                    cx={cxp + hxo * ENDPLATE_TAB}
                    cy={sy(cyp + hyo * ENDPLATE_TAB)}
                    r={world(3.4)}
                    fill="#fff"
                    stroke="#7c3aed"
                    strokeWidth={world(1)}
                    className="cursor-move"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect?.({ kind: "endplate", id: p.id });
                      beginDrag(e, { kind: "endplateMove", id: p.id });
                    }}
                  >
                    <title>Drag to place this endplate on a board edge</title>
                  </circle>
                </g>
              ) : null}
              <text x={p.x} y={sy(p.y) - r * 1.6} textAnchor="middle" fontSize={r * 2.4} fill="#2563eb">
                {p.id}
              </text>
            </g>
          );
        })}
        {/* Endplate anchor corners */}
        {anchors.map((a, i) => (
          <rect
            key={`anc${i}`}
            x={a.x - r * 0.8}
            y={sy(a.y) - r * 0.8}
            width={r * 1.6}
            height={r * 1.6}
            fill="#bfdbfe"
            stroke="#2563eb"
            strokeWidth={r * 0.3}
            transform={`rotate(45 ${a.x} ${sy(a.y)})`}
          />
        ))}

        {/* Board edge stroke — the fill is drawn earlier (under the track); this
            is just the outline. pointerEvents none so it never eats a click; its
            own handles are separate elements below. */}
        {sampled.length >= 2 && (
          <polygon
            points={polyPts}
            fill="none"
            stroke="#0284c7"
            strokeWidth={r * 0.7}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        {/* Edge midpoint (curve) handles */}
        {outline.length >= 2 &&
          outline.map((_, i) => {
            const h = edgeHandle(i);
            return (
              <rect
                key={`edge${i}`}
                x={h.x - r * 0.9}
                y={sy(h.y) - r * 0.9}
                width={r * 1.8}
                height={r * 1.8}
                fill={outline[i].bulge ? "#f59e0b" : "#fff"}
                stroke="#d97706"
                strokeWidth={r * 0.35}
                transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => beginDrag(e, { kind: "edge", i })}
              />
            );
          })}
        {/* Vertices */}
        {outline.map((p, i) => (
          <circle
            key={`v${i}`}
            cx={p.x}
            cy={sy(p.y)}
            r={r}
            fill={sel === i ? "#0284c7" : "#fff"}
            stroke="#0284c7"
            strokeWidth={r * 0.4}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => beginDrag(e, { kind: "vertex", i })}
          />
        ))}

        {/* Drawing a new main from scratch — the first placed point (#layers). */}
        {mainHandlesOn && editMain.length === 1 && (
          <circle
            cx={editMain[0].x}
            cy={sy(editMain[0].y)}
            r={r}
            fill="#c4b5fd"
            stroke="#7c3aed"
            strokeWidth={r * 0.4}
            pointerEvents="none"
          >
            <title>Mainline start — click the other end to finish</title>
          </circle>
        )}
        {/* --- Mainline edit handles — bend/drag the main once it's armed (#192) --- */}
        {mainHandlesOn && editMain.length >= 2 && (
          <>
            {editMain
              .slice(0, -1)
              .flatMap((_, i) =>
                (["start", "end"] as const).map((end) => ({ i, end })),
              )
              .map(({ i, end }) => {
                const h = bendHandle(editMain, i, end);
                const set = end === "start" ? editMain[i].bulge : editMain[i].bulgeEnd;
                return (
                  <rect
                    key={`me${i}${end}`}
                    x={h.x - r * 0.9}
                    y={sy(h.y) - r * 0.9}
                    width={r * 1.8}
                    height={r * 1.8}
                    fill={set ? "#7c3aed" : "#fff"}
                    stroke="#7c3aed"
                    strokeWidth={r * 0.35}
                    transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => beginDrag(e, { kind: "mainEdge", i, end })}
                  >
                    <title>
                      {end === "start"
                        ? "Drag to bend the near half of this stretch of mainline"
                        : "Drag to bend the far half of this stretch of mainline"}
                    </title>
                  </rect>
                );
              })}
            {editMain.map((p, i) => (
              <circle
                key={`mv${i}`}
                cx={p.x}
                cy={sy(p.y)}
                r={r}
                fill={i === 0 ? "#c4b5fd" : "#fff"}
                stroke="#7c3aed"
                strokeWidth={r * 0.4}
                style={{ cursor: i === 0 ? "default" : "grab" }}
                onPointerDown={(e) => {
                  if (e.altKey) {
                    e.stopPropagation();
                    removeMainVertex(i);
                  } else beginDrag(e, { kind: "mainVertex", i });
                }}
              >
                <title>{i === 0 ? "Endplate A (fixed origin)" : "Drag to move · Alt-click to remove"}</title>
              </circle>
            ))}
          </>
        )}

        {/* --- Main 2 edit handles — bend the second main (#131) --- */}
        {editingMain2 && !pendingTrack && editMain2.length >= 2 && (
          <>
            {editMain2
              .slice(0, -1)
              .flatMap((_, i) =>
                (["start", "end"] as const).map((end) => ({ i, end })),
              )
              .map(({ i, end }) => {
                const h = bendHandle(editMain2, i, end);
                const set =
                  end === "start" ? editMain2[i].bulge : editMain2[i].bulgeEnd;
                return (
                  <rect
                    key={`m2e${i}${end}`}
                    x={h.x - r * 0.9}
                    y={sy(h.y) - r * 0.9}
                    width={r * 1.8}
                    height={r * 1.8}
                    fill={set ? "#7c3aed" : "#fff"}
                    stroke="#7c3aed"
                    strokeWidth={r * 0.35}
                    transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => beginDrag(e, { kind: "main2Edge", i, end })}
                  >
                    <title>
                      {end === "start"
                        ? "Drag to bend the near half of this stretch — with the far handle bent the other way, that is the S a length of flex makes"
                        : "Drag to bend the far half of this stretch"}
                    </title>
                  </rect>
                );
              })}
            {editMain2.map((p, i) => (
              <circle
                key={`m2v${i}`}
                cx={p.x}
                cy={sy(p.y)}
                r={r}
                fill="#fff"
                stroke="#7c3aed"
                strokeWidth={r * 0.4}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  if (e.altKey) {
                    e.stopPropagation();
                    removeMain2Vertex(i);
                  } else beginDrag(e, { kind: "main2Vertex", i });
                }}
              >
                <title>Drag to move · Alt-click to remove</title>
              </circle>
            ))}
          </>
        )}

        {/* --- Spur edit handles (Track tool) — bend/rotate the selected spur --- */}
        {editSpurTrack && !pendingTrack && editSpur.length >= 2 && (
          <>
            {editSpur
              .slice(0, -1)
              .flatMap((_, i) =>
                (["start", "end"] as const).map((end) => ({ i, end })),
              )
              .map(({ i, end }) => {
                const h = bendHandle(editSpur, i, end);
                const set = end === "start" ? editSpur[i].bulge : editSpur[i].bulgeEnd;
                return (
                  <rect
                    key={`se${i}${end}`}
                    x={h.x - r * 0.9}
                    y={sy(h.y) - r * 0.9}
                    width={r * 1.8}
                    height={r * 1.8}
                    fill={set ? "#0d9488" : "#fff"}
                    stroke="#0f766e"
                    strokeWidth={r * 0.35}
                    transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) =>
                      beginDrag(e, { kind: "spurEdge", id: editSpurTrack.id, i, end })
                    }
                  >
                    <title>
                      {end === "start"
                        ? "Drag to bend the near half of this stretch — with the far handle bent the other way, that is the S a length of flex makes"
                        : "Drag to bend the far half of this stretch"}
                    </title>
                  </rect>
                );
              })}
            {editSpur.map((p, i) => (
              <circle
                key={`sv${i}`}
                cx={p.x}
                cy={sy(p.y)}
                r={r}
                // The throat keeps its own fill — it IS a different thing, the
                // end that meets the turnout — but it is no longer styled as
                // undraggable, because it isn't (#226).
                fill={i === 0 ? "#99f6e4" : "#fff"}
                stroke="#0f766e"
                strokeWidth={r * 0.4}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  if (e.altKey) {
                    e.stopPropagation();
                    removeSpurVertex(editSpurTrack, i);
                  } else beginDrag(e, { kind: "spurVertex", id: editSpurTrack.id, i });
                }}
              >
                <title>
                  {i === 0
                    ? "Throat — drag to move; it snaps back onto the turnout's rail when you bring it close"
                    : "Drag to move · Alt-click to remove"}
                </title>
              </circle>
            ))}
          </>
        )}

        {/* --- Draw-to-create preview (#51) — rubber-band from throat to stub --- */}
        {placePreview && (
          <g pointerEvents="none">
            <line
              x1={placePreview.start.x}
              y1={sy(placePreview.start.y)}
              x2={placePreview.end.x}
              y2={sy(placePreview.end.y)}
              stroke="#0f766e"
              strokeWidth={world(1.5)}
              strokeDasharray={`${world(2)} ${world(1.5)}`}
            />
            <circle
              cx={placePreview.start.x}
              cy={sy(placePreview.start.y)}
              r={r}
              fill="#99f6e4"
              stroke="#0f766e"
              strokeWidth={r * 0.4}
            />
          </g>
        )}

        {/* Fill-a-run in progress: the run, with a tick at every joint it will
            be cut at. The ticks are the point — they say "this is FOUR pieces
            of flex with three rail joints", which is what the run really is and
            what the derived document will carry. */}
        {fillPreview && (
          <g pointerEvents="none">
            <line
              x1={fillPreview.start.x}
              y1={sy(fillPreview.start.y)}
              x2={fillPreview.end.x}
              y2={sy(fillPreview.end.y)}
              stroke="#1d4ed8"
              strokeWidth={world(1.5)}
              strokeDasharray={`${world(3)} ${world(2)}`}
            />
            {(() => {
              const dx = fillPreview.end.x - fillPreview.start.x;
              const dy = fillPreview.end.y - fillPreview.start.y;
              const len = Math.hypot(dx, dy);
              if (!(len > 0)) return null;
              const ux = dx / len;
              const uy = dy / len;
              const h = RAIL_GAUGE_INCHES * 1.6;
              return flexPieces({
                fromPos: 0,
                toPos: len,
                maxPieceInches: maxFlexPieceInches(fillPreview.spec.partId, partLibrary),
              }).map((f) => {
                const cx = fillPreview.start.x + ux * f.toPos;
                const cy = fillPreview.start.y + uy * f.toPos;
                return (
                  <line
                    key={`fill${f.index}`}
                    x1={cx - uy * h}
                    y1={sy(cy + ux * h)}
                    x2={cx + uy * h}
                    y2={sy(cy - ux * h)}
                    stroke="#1d4ed8"
                    strokeWidth={world(1)}
                  />
                );
              });
            })()}
          </g>
        )}

        {/* ⭐ THE PIECES (ADR 0001) — drawn OVER the positional track, not
            instead of it. A module can carry both while the graph is being laid,
            and hiding one would be deciding the coexistence question by drawing
            rather than by asking. On a blank module there is nothing underneath
            anyway, which is the case this is for.

            ⚠️ DRAWN THIS LATE ON PURPOSE. Sitting with the track it was
            painted UNDER the mainline guide, the endplate faces and the board
            handles — all of which are hit-testable, so a press on a piece lying
            along the centre line went to the dashed guide instead and the piece
            could not be picked up at all. In this tool the pieces ARE the
            objects; everything else is context. */}
        {pieces.length > 0 && (
          <PieceLayer
            pieces={pieces}
            library={partLibrary}
            selectedIds={selection?.kind === "pieces" ? selection.ids : []}
            scale={scale}
            laying={piecesMode && !!armedPart}
            onSelect={(id, additive) => {
              if (!id) return onSelect?.(null);
              const have = selection?.kind === "pieces" ? selection.ids : [];
              // Shift/Ctrl toggles: clicking a picked piece again drops it out,
              // so a set can be corrected without starting over.
              const ids = additive
                ? have.includes(id)
                  ? have.filter((x) => x !== id)
                  : [...have, id]
                : // ⚠️ A PLAIN PRESS ON A PIECE ALREADY IN THE SET KEEPS THE SET.
                  // Otherwise picking the group up by one of its own members
                  // would collapse it to that one piece and move it alone —
                  // i.e. the group could be selected but never dragged.
                  have.includes(id)
                  ? have
                  : [id];
              onSelect?.(ids.length ? { kind: "pieces", ids } : null);
            }}
            onPieceDown={(id, e) => {
              if (!piecesMode && tool !== "select") return;
              const piece = pieces.find((x) => x.id === id);
              if (!piece || !onPiecesChange) return;
              const at = toLocal(e);
              const have = selection?.kind === "pieces" ? selection.ids : [];
              const additive = e.shiftKey || e.ctrlKey || e.metaKey;
              // ⚠️ A SHIFT-CLICK MUST NOT BEGIN A DRAG. Releasing a piece drag
              // snaps the piece to its nearest open joint even if the pointer
              // never travelled — so adding a piece to the selection would have
              // MOVED it, turning a selection gesture into an edit.
              if (additive) return;
              // Pressing a member of a multi-selection drags the whole set.
              if (have.length > 1 && have.includes(id)) {
                const origins: Record<string, Pt> = {};
                for (const p of pieces) if (have.includes(p.id)) origins[p.id] = { x: p.x, y: p.y };
                dragRef.current = { kind: "pieces", ids: have, from: at, origins };
                svgRef.current?.setPointerCapture?.(e.pointerId);
                return;
              }
              dragRef.current = {
                kind: "piece",
                id,
                grab: { x: at.x - piece.x, y: at.y - piece.y },
              };
              svgRef.current?.setPointerCapture?.(e.pointerId);
            }}
            onHandleDown={(id, handle, e) => {
              if (!onPiecesChange) return;
              dragRef.current = { kind: "pieceHandle", id, handle };
              svgRef.current?.setPointerCapture?.(e.pointerId);
            }}
          />
        )}
        {/* The rubber band (#94). Drawn last so it sits over everything it is
            gathering up, and never hit-testable — it is a readout of a gesture
            in progress, not an object. */}
        {marquee && (
          <rect
            x={Math.min(marquee.from.x, marquee.to.x)}
            y={sy(Math.max(marquee.from.y, marquee.to.y))}
            width={Math.abs(marquee.to.x - marquee.from.x)}
            height={Math.abs(marquee.to.y - marquee.from.y)}
            fill="#0284c7"
            fillOpacity={0.08}
            stroke="#0284c7"
            strokeWidth={world(1)}
            strokeDasharray={`${world(4)} ${world(3)}`}
            pointerEvents="none"
          />
        )}
        {/* --- Dimension callouts: the board's overall W × H, drafting-style --- */}
        {extentW > 0 && (
          <g pointerEvents="none" stroke="#cbd5e1" fill="#64748b" fontSize={world(10)}>
            {/* Overall length, below the board */}
            {(() => {
              const yd = extent.minY - world(18);
              return (
                <>
                  <line x1={extent.minX} y1={sy(extent.minY)} x2={extent.minX} y2={sy(yd)} strokeWidth={world(0.5)} />
                  <line x1={extent.maxX} y1={sy(extent.minY)} x2={extent.maxX} y2={sy(yd)} strokeWidth={world(0.5)} />
                  <line x1={extent.minX} y1={sy(yd)} x2={extent.maxX} y2={sy(yd)} strokeWidth={world(0.75)} />
                  <text
                    x={(extent.minX + extent.maxX) / 2}
                    y={sy(yd) + world(11)}
                    textAnchor="middle"
                    stroke="none"
                  >
                    {/* ⭐ The BOARD's maximum left-to-right, not the drawing's —
                        track running past a fascia must not enlarge the board
                        it sits on. Same for the depth below. */}
                    {fmt(boardExtent.w)}″ · {feetLabel(boardExtent.w)}
                  </text>
                </>
              );
            })()}
            {/* Overall depth, to the left of the board */}
            {(() => {
              const xd = extent.minX - world(18);
              return (
                <>
                  <line x1={extent.minX} y1={sy(extent.minY)} x2={xd} y2={sy(extent.minY)} strokeWidth={world(0.5)} />
                  <line x1={extent.minX} y1={sy(extent.maxY)} x2={xd} y2={sy(extent.maxY)} strokeWidth={world(0.5)} />
                  <line x1={xd} y1={sy(extent.minY)} x2={xd} y2={sy(extent.maxY)} strokeWidth={world(0.75)} />
                  <text
                    x={xd - world(3)}
                    y={sy((extent.minY + extent.maxY) / 2)}
                    textAnchor="end"
                    stroke="none"
                  >
                    {/* Given the same feet reading as the length — a 32″ board
                        is "2′8″" of shelf, and reading one dimension in feet
                        while the other is bare invites comparing unlike things. */}
                    {fmt(boardExtent.h)}″ · {feetLabel(boardExtent.h)}
                  </text>
                </>
              );
            })()}
          </g>
        )}

        {/* ⛔ NO CALLOUT ON A CROSSOVER. This drew "Crossover 1.09″" with a
            leader line beside every one, and before that "0.035″ tighter than
            Free-moN" under it. Both were noise on a correctly built piece of
            trackwork: §2.0 fixes the 1.125″ spacing AT A DOUBLE-TRACK ENDPLATE
            and 4″ inboard of it, and says nothing about how far apart the mains
            run in between — where every real crossover draws them closer
            (Will, 2026-07-28).

            The pinch is still DRAWN, because the track really does narrow
            there; it just is not annotated. `crossoverPinches` still supplies
            the geometry that narrows it. */}
      </svg>

      {/* Status bar — board size, zoom, grid, pointer. */}
      <div className="mt-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 text-[11px] text-gray-500">
        <span className="font-medium text-gray-600">
          {fmt(extentW)}″ × {fmt(extentH)}″ · {feetLabel(extentW)}
        </span>
        <span>grid {fmt(minorStep)}″</span>
        <span className="tabular-nums">{zoomPct}%</span>
        {hover && (
          <span className="tabular-nums">
            x {fmt(hover.x)} · y {fmt(hover.y)}
          </span>
        )}
        {readout && (
          <span className="ml-auto rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700 tabular-nums">
            {readout}
          </span>
        )}
      </div>
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-30 w-64 rounded-md border border-gray-200 bg-white/95 p-2 text-xs shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-gray-700">Handles &amp; markers</span>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="text-gray-400 hover:text-gray-700"
              title="Hide"
            >
              &times;
            </button>
          </div>
          <ul className="space-y-1.5 text-gray-600">
            {[
              { sw: <circle cx={8} cy={8} r={5} fill="#fff" stroke="#475569" strokeWidth={2} />, label: "Turnout — drag to move (its position is its frog)" },
              { sw: <circle cx={8} cy={8} r={3.5} fill="#fff" stroke="#475569" strokeWidth={1.6} />, label: "Frog — where the diverging rails cross. Set by the turnout's position." },
              { sw: <circle cx={8} cy={8} r={4.5} fill="#fff" stroke="#0f766e" strokeWidth={2} />, label: "Track end — drag to lengthen or shorten the track it belongs to" },
              { sw: <rect x={3} y={3} width={10} height={10} transform="rotate(45 8 8)" fill="#fff" stroke="#2563eb" strokeWidth={2} />, label: "Benchwork corner / endplate — drag to reshape" },
              { sw: <circle cx={8} cy={8} r={4.5} fill="#fff" stroke="#2563eb" strokeWidth={2} />, label: "Endplate tab (outboard) — drag to resize the last section" },
              { sw: <rect x={3} y={5} width={10} height={6} fill="#fff" stroke="#b45309" strokeWidth={2} />, label: "Industry — its car-spot extent" },
            ].map((row, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg width={16} height={16} viewBox="0 0 16 16" className="mt-0.5 shrink-0">
                  {row.sw}
                </svg>
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const btn =
  "rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50";
const iconBtn =
  "flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compact inch label — drops the trailing ".0" but keeps real fractions. */
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Inches → feet′inches″, how a modular group sizes a board ("a four-footer"). */
function feetLabel(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches - ft * 12);
  return `${ft}′${inch}″`;
}

/** True when a key event targets a text field — so space doesn't hijack typing. */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Offset a polyline perpendicular by `off` inches (per-vertex averaged normal).
 * Good enough for the gentle curves module track follows. */
function offsetPath(pts: Pt[], off: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (-dy / len) * off, y: p.y + (dx / len) * off };
  });
}

/** Tie marks perpendicular to a polyline, evenly spaced by arc length. Capped so
 * a long track can't spawn unbounded elements. */
