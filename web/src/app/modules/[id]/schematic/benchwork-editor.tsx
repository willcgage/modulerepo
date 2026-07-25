"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  sampleBenchworkOutline,
  samplePath,
  divergeSideForHand,
  turnoutClosure,
  leadInchesForSize,
  partOutlineAtFrog,
  RAIL_GAUGE_INCHES,
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  type BenchworkPoint,
  type EndplatePose,
  type TurnoutKind,
} from "@willcgage/module-schematic";
import { drawablePartFor } from "./part-library";
import {
  lanePath,
  sampleAt,
  laneOffset,
  projectToCenterline,
  LANE_SPACING_INCHES,
} from "@/lib/physical-track";

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

/** Round a raw span up to a friendly grid increment (inches). */
function niceStep(raw: number): number {
  const steps = [0.25, 0.5, 1, 2, 3, 6, 12, 24, 48, 96];
  return steps.find((s) => s >= raw) ?? 192;
}

/** The turnout kinds the palette offers. left/right/wye place today; the rest
 * need geometry the package doesn't model yet, so they show as "coming soon"
 * placeholders — settling the palette's final shape (#turnout-palette). */
type PaletteKind =
  | TurnoutKind
  | "curved-left"
  | "curved-right"
  | "crossover-lh"
  | "crossover-rh"
  | "crossover-double"
  | "slip-single"
  | "slip-double";

const TURNOUT_PALETTE: { kind: PaletteKind; label: string; soon?: boolean }[] = [
  { kind: "right", label: "Right-hand" },
  { kind: "left", label: "Left-hand" },
  { kind: "wye", label: "Wye" },
  { kind: "curved-right", label: "Curved right" },
  { kind: "curved-left", label: "Curved left" },
  { kind: "crossover-lh", label: "Single crossover (LH)" },
  { kind: "crossover-rh", label: "Single crossover (RH)" },
  { kind: "crossover-double", label: "Double crossover" },
  { kind: "slip-single", label: "Single slip", soon: true },
  { kind: "slip-double", label: "Double slip", soon: true },
];

/** A palette glyph → the turnout it drops: its hand + whether the diverging leg
 * is curved. Null for the not-yet-buildable kinds (crossover/slip). */
function specForPalette(k: PaletteKind): { kind: TurnoutKind; curved: boolean } | null {
  switch (k) {
    case "left":
      return { kind: "left", curved: false };
    case "right":
      return { kind: "right", curved: false };
    case "wye":
      return { kind: "wye", curved: false };
    case "curved-left":
      return { kind: "left", curved: true };
    case "curved-right":
      return { kind: "right", curved: true };
    default:
      return null;
  }
}

/** A crossover glyph → its spec: the hand (which way the single diagonal throws,
 * facing endplate B) or double (a scissors). Null for non-crossover kinds. */
function crossoverSpecForPalette(
  k: PaletteKind,
): { hand?: "left" | "right"; double?: boolean } | null {
  switch (k) {
    case "crossover-lh":
      return { hand: "left" };
    case "crossover-rh":
      return { hand: "right" };
    case "crossover-double":
      return { double: true };
    default:
      return null;
  }
}

/** A little schematic icon for each turnout kind — a straight route plus the
 * diverging leg(s), so the palette reads like the switches it drops. */
function TurnoutGlyph({ kind, className }: { kind: PaletteKind; className?: string }) {
  const s = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const main = <line x1={3} y1={9} x2={25} y2={9} {...s} />;
  const body = (() => {
    switch (kind) {
      case "right":
        return (
          <>
            {main}
            <path d="M10 9 L25 3" {...s} />
          </>
        );
      case "left":
        return (
          <>
            {main}
            <path d="M10 9 L25 15" {...s} />
          </>
        );
      case "wye":
        return (
          <>
            <line x1={3} y1={9} x2={11} y2={9} {...s} />
            <path d="M11 9 L25 4 M11 9 L25 14" {...s} />
          </>
        );
      case "curved-right":
        return (
          <>
            <path d="M3 9 Q16 10 25 13" {...s} />
            <path d="M10 9 Q19 6 25 3" {...s} />
          </>
        );
      case "curved-left":
        return (
          <>
            <path d="M3 9 Q16 8 25 5" {...s} />
            <path d="M10 9 Q19 12 25 15" {...s} />
          </>
        );
      case "crossover-lh":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 13 L18 5" {...s} />
          </>
        );
      case "crossover-rh":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 5 L18 13" {...s} />
          </>
        );
      case "crossover-double":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 5 L18 13 M18 5 L10 13" {...s} />
          </>
        );
      case "slip-single":
        return (
          <>
            <path d="M4 4 L24 14 M4 14 L24 4" {...s} />
            <path d="M9 6.5 Q14 9 19 11.5" {...s} />
          </>
        );
      case "slip-double":
        return (
          <>
            <path d="M4 4 L24 14 M4 14 L24 4" {...s} />
            <path d="M9 6.5 Q14 9 19 11.5 M9 11.5 Q14 9 19 6.5" {...s} />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 28 18" className={className} aria-hidden>
      {body}
    </svg>
  );
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
  /** Lane of the track it spots on (to offset it beside that track). */
  lane: number;
  fromPos: number;
  toPos: number;
  side: "above" | "below";
  name: string;
  /** Secondary readout under the name (cars / inches), or "" for none. */
  sub: string;
}

/** What's selected on the canvas — the editor renders its inspector. */
export type CanvasSelection =
  | { kind: "corner"; i: number }
  | { kind: "turnout"; id: string }
  | { kind: "track"; id: string }
  | { kind: "endplate"; id: string }
  | { kind: "industry"; id: string }
  | { kind: "cp"; id: string };

/**
 * What a click on empty canvas means. Without this the canvas has to guess, and
 * it guessed "add a benchwork corner" — so there was no way to click background
 * and mean "nothing". Select is the default; Benchwork is the drawing mode.
 */
export type CanvasTool = "select" | "benchwork" | "industry" | "track" | "turnout" | "signal";

/**
 * Benchwork outline editor — draw a module's physical footprint as a polygon in
 * module-local inches (endplate A's track point at the origin, mainline +x,
 * perpendicular +y up). Edges can be straight or curved: drag the diamond on an
 * edge to bow it into an arc. The endplate FACES are drawn as anchors — drag a
 * corner near one and it snaps, so the board meets the standard interface. Empty
 * outline = the layout falls back to the endplate-width band.
 */
export function BenchworkEditor({
  outline,
  outlineInner = [],
  onChange,
  contextOutlines = [],
  seedOutline,
  editingLabel,
  lengthInches,
  poses,
  endplateWidths,
  endplateTrackOffsets,
  centerline = [],
  sectionBreaks = [],
  mainLane = 0,
  onSectionBreakMove,
  onEndplateEndMove,
  onEndplateMove,
  tracks = [],
  turnouts = [],
  signals = [],
  industries = [],
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
  turnoutSize = 6,
  onTurnoutSizeChange,
  selection = null,
  onSelect,
  tool = "select",
}: {
  outline: BenchworkPoint[];
  /** A benchwork HOLE — the loop's open middle, punched out of `outline` so the
   * board reads as a donut, not a filled disc. Empty = solid board (#loop). */
  outlineInner?: BenchworkPoint[];
  /** The module's OTHER sections, drawn as faint context so you can see what
   * the board you're editing has to meet (#96 phase 2b). Not editable. */
  contextOutlines?: { id: string; name?: string; outline: { x: number; y: number }[] }[];
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
  turnouts?: CanvasTurnout[];
  signals?: CanvasSignal[];
  /** Industries — car-spot spans beside their track. */
  industries?: CanvasIndustry[];
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
    spec: { kind: TurnoutKind; curved?: boolean },
    onTrack: string,
    pos: number,
  ) => void;
  /** Crossover glyphs (#turnout-palette): drop a self-contained crossover on the
   * main — a turnout on each of the two parallel lanes plus the diagonal
   * connector(s) between them (double = scissors). The canvas computes the
   * geometry (module-local inches); the editor builds/reuses the tracks. */
  onDropCrossover?: (p: {
    hand?: "left" | "right";
    double?: boolean;
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
  /** The frog number the Turnout tool drops (governs the diverging angle). */
  turnoutSize?: number;
  onTurnoutSizeChange?: (size: number) => void;
  /** Selection is owned by the editor, which renders the inspector for it. */
  selection?: CanvasSelection | null;
  onSelect?: (s: CanvasSelection | null) => void;
  /** What a background click means. See CanvasTool. */
  tool?: CanvasTool;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "vertex" | "edge"; i: number }
    | { kind: "mainVertex" | "mainEdge"; i: number }
    | { kind: "main2Vertex" | "main2Edge"; i: number }
    | { kind: "spurVertex" | "spurEdge"; id: string; i: number }
    | { kind: "turnout"; id: string }
    | { kind: "trackEnd"; id: string; end: "from" | "to" }
    | { kind: "sectionBreak"; i: number }
    | { kind: "endplateEnd"; id: string }
    | { kind: "endplateMove"; id: string }
    | { kind: "industryEnd"; id: string; end: "from" | "to" }
    | null
  >(null);
  /** An in-progress pan: pointer origin + the view at grab time. */
  const panRef = useRef<{ from: Pt; view: ViewBox } | null>(null);
  /** Draw-to-create in progress: the throat turnout it diverges from + live end. */
  const placeRef = useRef<{ start: Pt; end: Pt; turnoutId: string } | null>(null);
  const [placePreview, setPlacePreview] = useState<{ start: Pt; end: Pt } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  /** The turnout armed in the palette — a canvas click drops this one, and it's
   * what a palette drag carries (#turnout-palette). */
  const [armedPalette, setArmedPalette] = useState<PaletteKind>("right");
  /** A palette glyph being dragged toward the board: its kind + live client
   * position, so a ghost can follow the pointer until it's dropped. */
  const [paletteDrag, setPaletteDrag] = useState<{ kind: PaletteKind; x: number; y: number } | null>(
    null,
  );
  /** A transient warning shown in the toolbar (e.g. a curved turnout dropped on
   * straight track). Cleared on the next pointer-down. */
  const [dropWarn, setDropWarn] = useState<string | null>(null);
  /** Space-to-pan: held-key state, so any tool can pan without switching. */
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** Pointer position in world inches — drives the status-bar readout. */
  const [hover, setHover] = useState<Pt | null>(null);
  /** A live measurement shown while dragging (corner xy, track length, pos). */
  const [readout, setReadout] = useState<string | null>(null);
  /** The selected corner index, when a corner is what's selected. */
  const sel = selection?.kind === "corner" ? selection.i : null;
  const setSel = (i: number | null) => onSelect?.(i === null ? null : { kind: "corner", i });

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
    let px = Math.cos((p.heading + 90) * DEG);
    let py = Math.sin((p.heading + 90) * DEG);
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

  // Endplate face corners — the anchors a board corner should meet.
  const anchors = useMemo(() => {
    const out: { x: number; y: number; id: string }[] = [];
    for (const p of poses) {
      const hw = (endplateWidths?.[p.id] ?? 24) / 2;
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
      : lanePath(centerline, host.fromPos, host.toPos, host.lane);
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
  const toHostRel = (onTrack: string | undefined | null, abs: number): number => {
    if (!onTrack || onTrack === MAIN_TRACK_ID) return abs;
    const host = hostPointsOf(onTrack);
    if (host.length < 2) return abs;
    let acc = 0;
    let prevLong = projectToCenterline(centerline, host[0]).pos;
    if (abs <= prevLong) return 0;
    for (let i = 1; i < host.length; i++) {
      const seg = Math.hypot(host[i].x - host[i - 1].x, host[i].y - host[i - 1].y);
      const long = projectToCenterline(centerline, host[i]).pos;
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
  ): { leg: Pt[]; frog: Pt; frogV: [Pt, Pt]; outline: Pt[][] | null } | null => {
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
      if (dt.path && dt.path.length >= 2) return dt.path[dt.path.length - 1];
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
    const toward =
      (Math.sign((far.x - m.x) * tx + (far.y - m.y) * ty) || 1) * (t.flipped ? -1 : 1);
    // HAND decides the side, not the lane the diverging track happens to sit
    // on. A right-hand turnout throws right whichever lane its siding was
    // assigned — deriving the side from the track's position made hand a no-op
    // on the board (it already drives the dispatcher view). Geometry is only
    // the fallback for a wye or an unset hand, which have no side to state.
    const handSide = divergeSideForHand(t.kind, toward, t.flipped);
    const side =
      forceSide ??
      (handSide || undefined) ??
      (Math.sign((far.x - m.x) * m.nx + (far.y - m.y) * m.ny) || 1);
    const size = t.size && t.size > 0 ? t.size : 6;
    // A curved turnout sweeps over a LONGER leg so its diverging route reads as a
    // pronounced arc (carrying the curve well past a bare frog, per the curved-
    // turnout prototype) instead of a subtle bow; a straight turnout uses the
    // nominal points→frog length.
    // The RAMP: how far the diverging route runs to reach one full track spacing
    // — its slope is the frog ratio 1:N, so this is what makes the leg leave at
    // the right angle. It is NOT points→frog (that mistake put the throat a whole
    // ramp-length back, so facing turnouts 11″ apart drew overlapping, #173).
    const L = size * LANE_SPACING_INCHES * (t.curved ? 2.2 : 1);
    // The CLOSURE: points start ON the stock rail, reach one GAUGE of lateral at
    // the frog (where the inner rails truly cross, so the frog lands exactly on
    // `pos`), and leave at the frog angle 1/N. A curved turnout stretches the
    // whole thing so its diverging route reads as a pronounced arc.
    const stretch = t.curved ? 2.2 : 1;
    // A wye splits SYMMETRICALLY — each route takes HALF the divergence, i.e.
    // each leg leaves at half the frog angle, which is a #2N.
    const effN = t.kind === "wye" ? size * 2 : size;
    // The lead comes from the PARTS LIBRARY when a real part matches this frog
    // number — an Atlas code 55 #7 is drawn at its measured 3⅜″, not a formula.
    // Sizes with no part fall back to the per-frog rule (#179 stage 3).
    // The lateral the diverging route must ARRIVE AT, parallel — the lane of
    // the track it feeds.
    const targetOff = Math.abs(laneOffset(dt.lane)) || LANE_SPACING_INCHES;
    const leadIn = leadInchesForSize(effN) * stretch;
    // How much track there actually IS to run into — the diverging track's far
    // end, from the frog. The ease has to fit inside it.
    const farEnd =
      Math.abs(dt.toPos - t.pos) >= Math.abs(dt.fromPos - t.pos) ? dt.toPos : dt.fromPos;
    const available = Math.abs(farEnd - t.pos);
    // A longer ease costs LENGTH: it gains offset at half the rate of the
    // straight, so span = lead + (target−g)/m + b/2. Un-eased is the shortest
    // the route can be, so the ease gets whatever is left over — and on a track
    // too short even for that, it goes to zero rather than overrunning.
    // ⚠️ Overrunning is not cosmetic: laneBody pulls the track's near end out to
    // the join, so a join past the far end INVERTS the body and the track
    // disappears. That is worse than the kink the ease exists to remove.
    const straightSpan = leadIn + Math.max(0, (targetOff - RAIL_GAUGE_INCHES) * effN);
    const easeIn = Math.max(0, Math.min(leadIn, 2 * (available - straightSpan)));
    const cl = turnoutClosure(effN, {
      leadInches: leadIn,
      arriveAtInches: targetOff,
      easeInches: easeIn,
    });
    const lead = Math.min(L, cl.lead);
    // Walk the host from the throat so the leg follows the mainline's curvature,
    // laying the closure's lateral offset on the normal. Sampled finely enough
    // that the curve near the points reads as a curve.
    const steps = 16;
    const relThroat = relFrog - toward * lead;
    /** A point `s` inches past the POINTS, along the host. */
    const at = (s: number): Pt => {
      const p = sampleAt(host, Math.max(0, relThroat + toward * s));
      const off = side * cl.offsetAt(s);
      return { x: p.x + off * p.nx, y: p.y + off * p.ny };
    };
    // Run the leg until it REACHES the diverging track's own lane — not a fixed
    // span. Past the frog the closure is straight at 1/N, so solve for it. A
    // fixed span left the leg short of the lane (0.997″ vs 1.125″ on a #6), and
    // the rails jogged sideways where the leg met the body.
    // Run to where the closure ARRIVES PARALLEL, not where it first reaches the
    // lane. Solving for the offset (what this did) got there still climbing at
    // 1/N while the track it joins runs parallel — an instantaneous change of
    // direction. That kink is what read as "the rails don't line up": each rail
    // is offset perpendicular to its own heading, so at a kink the two rails
    // meet at different points. The closure now eases out and `span` includes it.
    const span = Math.max(lead, cl.span);
    const leg: Pt[] = [];
    for (let i = 0; i <= steps; i++) leg.push(at((span * i) / steps));
    // The frog — `pos` marks it (#132), and the closure is built so the rails
    // cross exactly there.
    // ⚠️ NOT at(lead). `at` walks the DIVERGING CENTRE-LINE, which is one full
    // gauge out at the frog — that is the definition of the lead. But the frog
    // is where the two INNER RAILS cross, and those meet HALF a gauge off the
    // through centre-line: the through route's inner rail sits at +g/2, the
    // diverging route's inner rail at d−g/2, and d = g there. Using at(lead)
    // put the marker and the V's apex 0.177″ off the rails they mark.
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
    const part = drawablePartFor(t.partId, size);
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
    return {
      leg,
      frog,
      outline,
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
    const far =
      dt.path && dt.path.length >= 2
        ? dt.path[dt.path.length - 1]
        : { x: m.x + m.nx * (laneOffset(dt.lane) || LANE_SPACING_INCHES), y: m.y + m.ny * (laneOffset(dt.lane) || LANE_SPACING_INCHES) };
    return (Math.sign((far.x - m.x) * m.nx + (far.y - m.y) * m.ny) || 1) as 1 | -1;
  };
  /** spur/siding id → its throat's curved diverging leg + endpoints, so a drawn
   * track starts at the frog (one continuous curved route with its turnout). */
  /** track id → EVERY switch leg reaching it. A passing siding has a turnout at
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
      { throat: Pt; frog: Pt; frogV: [Pt, Pt]; join: Pt; leg: Pt[]; outline: Pt[][] | null; turnoutId: string }[]
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
          join: r.leg[r.leg.length - 1],
          leg: r.leg,
          turnoutId: t.id,
        });
        map.set(t.divergeTrack, list);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnouts, tracks, centerline, lengthInches]);
  /** The primary (first) leg per track — what a drawn path pins its throat to. */
  const switchByTrack = useMemo(() => {
    const map = new Map<
      string,
      { throat: Pt; frog: Pt; frogV: [Pt, Pt]; join: Pt; leg: Pt[]; outline: Pt[][] | null; turnoutId: string }
    >();
    for (const [id, legs] of legsByTrack) map.set(id, legs[0]);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnouts, tracks, centerline, lengthInches]);
  /** A drawn spur's path with its authored point 0 pinned to the frog. Used for
   * editing (the throat→frog leg belongs to the turnout, not the spur body). */
  const frogPinnedPath = (t: CanvasTrack): BenchworkPoint[] => {
    const path = t.path;
    if (!path || path.length < 2) return path ?? [];
    // Pin to the JOIN (the ramp's end), not the frog — spurTrackPath prepends the
    // whole leg and drops this point, so it has to be the leg's last point.
    const f = switchByTrack.get(t.id)?.join;
    return f ? [{ ...path[0], x: f.x, y: f.y }, ...path.slice(1)] : path;
  };
  /** The path to *render as track*: the diverging leg (throat → frog) plus the
   * spur body (frog → stub), so the whole switch reads as one ballasted track. */
  const spurTrackPath = (t: CanvasTrack): BenchworkPoint[] => {
    const base = frogPinnedPath(t);
    const sw = switchByTrack.get(t.id);
    // Prepend the curved throat→frog leg; base[0] is the frog, so drop it.
    return sw ? [...sw.leg.map((p) => ({ x: p.x, y: p.y })), ...base.slice(1)] : base;
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
    const off = (at[0].off + at[at.length - 1].off) / 2;
    const steps = 24;
    const body: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const pos = at[0].pos + ((at[at.length - 1].pos - at[0].pos) * i) / steps;
      const c = sampleAt(centerline, pos);
      body.push({ x: c.x + c.nx * off, y: c.y + c.ny * off });
    }
    if (body.length < 2) return null;
    // Pin the exact ends to the frogs so leg and body share a vertex.
    body[0] = { x: at[0].frog.x, y: at[0].frog.y };
    body[body.length - 1] = { x: at[at.length - 1].frog.x, y: at[at.length - 1].frog.y };
    return body;
  };

  /** A plain lane-parallel body, CLIPPED to any switch leg reaching it — so the
   * rails run continuously from the leg into the track instead of the body
   * carrying on underneath it. A track's stored extent ends at the turnout's
   * FROG, but the leg only becomes parallel at its JOIN further along, so the
   * two overlapped by (ramp − lead) and neither met the other end-to-end. Main 2
   * showed this plainly: body 0→17.4, leg 21.8→10.6 (#173 follow-up). Tracks
   * with two legs are handled by passingSidingBody; this covers the rest. */
  const laneBody = (t: CanvasTrack): Pt[] => {
    let from = t.fromPos;
    let to = t.toPos;
    for (const l of legsByTrack.get(t.id) ?? []) {
      const jp = projectToCenterline(centerline, l.join).pos;
      // Pull whichever end this leg reaches out to the join.
      if (Math.abs(from - jp) <= Math.abs(to - jp)) from = jp;
      else to = jp;
    }
    return lanePath(centerline, from, to, t.lane);
  };

  /** A wye's mirrored second route — the leg forced to the opposite side, then
   * continued along its frog tangent to the same length as the (real) spur, so
   * the switch reads as a symmetric Y. Rendered as a band; it isn't a separately
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

  /** Switch legs that the track band itself doesn't already include — the far
   * end of a passing siding, the second turnout of a crossover connector — so
   * every turnout visibly joins what it diverges to (#FMN-0040). */
  const connectorLegs = useMemo(() => {
    const out: { id: string; pts: Pt[] }[] = [];
    for (const [trackId, legs] of legsByTrack) {
      const t = tracks.find((x) => x.id === trackId);
      if (!t) continue;
      // legs[0] is already drawn by the band itself when the track is an
      // authored path (spurTrackPath prepends it) or a single-ended stub
      // (divergingStubPath starts with it); otherwise draw them all.
      const authored = !!(t.path && t.path.length >= 2);
      const stub = !authored && legs.length === 1;
      // legs[0] is already carried by the band for an authored path
      // (spurTrackPath prepends it) or a single-ended stub (divergingStubPath
      // starts with it). A passing siding's body now runs frog→frog, so its
      // legs are NOT in the band — draw them all (#133).
      // Main 2 is the exception: it draws PARALLEL (lanePath / its own authored
      // path, never spurTrackPath/divergingStubPath), so its band carries no
      // leg. The transition turnout's throat→frog leg — the diverging rails
      // joining Main 1 to Main 2 — must be drawn here or the transition shows
      // only a bare frog dot (#131 regression: Main-2-parallel orphaned it).
      const bandCarriesLeg0 = trackId !== MAIN2_TRACK_ID && (authored || stub);
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
    const mainAt = (s: number, e: number) => lanePath(centerline, s, e, mainLane);
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
  }, [turnouts, tracks, centerline, lengthInches, mainLane]);

  const trackPaths = useMemo(
    () =>
      centerline.length >= 2
        ? tracks
            .map((t) => ({
              id: t.id,
              pts:
                // Main 2 is a main, not a spur — its authored path draws as-is,
                // with no throat→frog leg prepended (#131).
                t.id === MAIN2_TRACK_ID && t.path && t.path.length >= 2
                  ? samplePath(t.path)
                  : t.path && t.path.length >= 2
                    ? samplePath(spurTrackPath(t))
                    : (divergingStubPath(t) ?? passingSidingBody(t) ?? laneBody(t)),
            }))
            .filter((t) => t.pts.length > 1)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerline, tracks, switchByTrack],
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
            const sw = t.divergeTrack ? switchByTrack.get(t.divergeTrack) : undefined;
            return {
              id: t.id,
              x: m.x,
              y: m.y,
              frog: sw && sw.turnoutId === t.id ? sw.frog : null,
              outline: sw && sw.turnoutId === t.id ? sw.outline : null,
              frogV: sw && sw.turnoutId === t.id ? sw.frogV : null,
            };
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerline, turnouts, tracks, switchByTrack, lengthInches],
  );
  /** Draggable end handles for sidings/spurs (not the derived Main 2). */
  const trackEnds = useMemo(() => {
    if (centerline.length < 2) return [];
    return tracks
      // A drawn spur is positioned by its path, not fromPos/toPos — no end drags.
      // A passing siding is pinned to its two turnouts — move those, not its
      // ends; independent end drags pulled the body off the legs (#133).
      .filter(
        (t) =>
          t.editable &&
          !(t.path && t.path.length >= 2) &&
          (legsByTrack.get(t.id)?.length ?? 0) < 2,
      )
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
  }, [centerline, tracks, switchByTrack]);
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
  /** Industries — a car-spot span drawn beyond the track it serves, on `side`. */
  const industryShapes = useMemo(() => {
    if (centerline.length < 2) return [];
    return industries.map((ind) => {
      const sign = ind.side === "above" ? 1 : -1;
      // Beyond the track's rails, on the industry's side.
      const off = laneOffset(ind.lane) + sign * (LANE_SPACING_INCHES * 0.9);
      const a0 = Math.min(ind.fromPos, ind.toPos);
      const b0 = Math.max(ind.fromPos, ind.toPos);
      const path: Pt[] = [];
      const steps = 16;
      for (let s = 0; s <= steps && b0 - a0 > 0.01; s++) {
        const p = sampleAt(centerline, a0 + ((b0 - a0) * s) / steps);
        path.push({ x: p.x + p.nx * off, y: p.y + p.ny * off });
      }
      const a = sampleAt(centerline, ind.fromPos);
      const b = sampleAt(centerline, ind.toPos);
      const mid = sampleAt(centerline, (ind.fromPos + ind.toPos) / 2);
      const labelOff = off + sign * 2.2;
      return {
        id: ind.id,
        industryId: ind.industryId,
        editable: ind.editable,
        side: ind.side,
        name: ind.name,
        sub: ind.sub,
        path,
        ends: [
          { end: "from" as const, x: a.x + a.nx * off, y: a.y + a.ny * off },
          { end: "to" as const, x: b.x + b.nx * off, y: b.y + b.ny * off },
        ],
        label: { x: mid.x + mid.nx * labelOff, y: mid.y + mid.ny * labelOff },
      };
    });
  }, [centerline, industries]);

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
  }, [lengthInches, anchors, sampled, centerline, trackPaths]);

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
    const measure = () => {
      const b = el.getBoundingClientRect();
      if (b.width && b.height) setPx({ w: b.width, h: b.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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

  // Wheel-to-zoom toward the pointer. React's onWheel is passive (can't
  // preventDefault the browser's own zoom/scroll), so bind a native listener.
  // Rebinds when `bounds` changes so the fallback view stays current.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      zoomAbout(toLocal(e), e.deltaY > 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  const commit = (next: BenchworkPoint[]) =>
    onChange(
      next.map((p) => ({
        x: round(p.x),
        y: round(p.y),
        ...(p.bulge ? { bulge: round(p.bulge) } : {}),
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
  /** Midpoint handle for mainline edge i (open path, no wrap). */
  const mainEdgeHandle = (i: number): Pt => {
    const p0 = editMain[i];
    const p1 = editMain[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    return {
      x: (p0.x + p1.x) / 2 + (-dy / c) * (p0.bulge ?? 0),
      y: (p0.y + p1.y) / 2 + (dx / c) * (p0.bulge ?? 0),
    };
  };
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
    isDoubleMain &&
    (tool === "track" || tool === "select") &&
    selection?.kind === "track" &&
    selection.id === MAIN2_TRACK_ID;
  const commitMain2 = (next: BenchworkPoint[]) =>
    onMain2PathChange?.(
      next.map((pt) => ({
        x: round(pt.x),
        y: round(pt.y),
        ...(pt.bulge ? { bulge: round(pt.bulge) } : {}),
      })),
    );
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
  const main2EdgeHandle = (i: number): Pt => {
    const p0 = editMain2[i];
    const p1 = editMain2[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    return {
      x: (p0.x + p1.x) / 2 + (-dy / c) * (p0.bulge ?? 0),
      y: (p0.y + p1.y) / 2 + (dx / c) * (p0.bulge ?? 0),
    };
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
    selection?.kind === "track" && (tool === "track" || tool === "select")
      ? tracks.find(
          (t) =>
            t.id === selection.id &&
            t.editable &&
            // In Select, only a *drawn* spur (with a path) gets reshape handles,
            // so you can drag it to resize/reorient; a plain spur keeps its
            // along-main ○ end handles. In Track, any editable spur is shapeable.
            (tool === "track" || (t.path != null && t.path.length >= 2)),
        )
      : undefined;
  /** Where the spur body starts — the turnout's JOIN (the ramp's end, so the
   * spur is continuous with the switch), falling back to the on-main turnout
   * point if there's no leg yet. */
  const spurThroat = (t: CanvasTrack): Pt | null => {
    const f = switchByTrack.get(t.id)?.join;
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
      ? frogPinnedPath(editSpurTrack)
      : spurSeed(editSpurTrack)
    : [];
  /** Commit a spur path — the throat (point 0) is always re-pinned to its
   * turnout, so the spur stays connected even if the turnout later moves. */
  const commitSpur = (t: CanvasTrack, next: BenchworkPoint[]) => {
    if (!next.length) return;
    const pinned = next.map((p) => ({
      x: round(p.x),
      y: round(p.y),
      ...(p.bulge ? { bulge: round(p.bulge) } : {}),
    }));
    const th = spurThroat(t);
    if (th) pinned[0] = { ...pinned[0], x: round(th.x), y: round(th.y) };
    onTrackPathChange?.(t.id, pinned);
  };
  /** Remove a spur bend point (never the throat or the far stub end). */
  const removeSpurVertex = (t: CanvasTrack, i: number) => {
    if (i <= 0 || i >= editSpur.length - 1) return;
    commitSpur(t, editSpur.filter((_, j) => j !== i));
  };
  const spurEdgeHandle = (pts: BenchworkPoint[], i: number): Pt => {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = Math.hypot(dx, dy) || 1;
    return {
      x: (p0.x + p1.x) / 2 + (-dy / c) * (p0.bulge ?? 0),
      y: (p0.y + p1.y) / 2 + (dx / c) * (p0.bulge ?? 0),
    };
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
    // Turnout tool: a click on a track drops the armed turnout there — a palette
    // drag can also land it (below). Either way it arrives with a spur stub.
    if (tool === "turnout") {
      if (centerline.length < 2) return;
      const xo = crossoverSpecForPalette(armedPalette);
      if (xo) {
        dropCrossoverAt(xo, toLocal(e));
        return;
      }
      const spec = specForPalette(armedPalette);
      if (onDropTurnout && spec) {
        const hit = nearestTrackPos(toLocal(e));
        if (hit) dropTurnoutGuarded(spec, hit.onTrack, hit.pos);
      }
      return;
    }
    // Track tool: a background click bends the selected spur, or the mainline
    // when no spur is selected (mainline + spur editing are one tool now).
    if (tool === "track") {
      if (editSpurTrack && onTrackPathChange) addSpurVertex(editSpurTrack, toLocal(e));
      else if (onMainPathChange) {
        // No main yet (a fresh module opens blank) → draw one from scratch: each
        // click extends the mainline. Otherwise add a bend to the existing main.
        if (mainPath.length < 2 && centerline.length < 2) {
          // Each click extends the new main; snap the ends onto the endplates so
          // the drawn main stays aligned with the board (benchwork + endplates).
          onMainPathChange([...mainPath, snapMainEnd(toLocal(e))]);
        } else addMainVertex(toLocal(e));
      }
      return;
    }
    // Only the Benchwork tool draws. Under Select, background means "nothing" —
    // which is what makes deselecting possible at all.
    if (tool !== "benchwork") {
      onSelect?.(null);
      return;
    }
    addOnNearestEdge(snapToAnchor(toLocal(e)));
  };
  const beginDrag = (
    e: React.PointerEvent,
    d: NonNullable<typeof dragRef.current>,
  ) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* best-effort */
    }
    dragRef.current = d;
    // Grabbing something selects it — the editor shows its inspector.
    if (d.kind === "vertex") onSelect?.({ kind: "corner", i: d.i });
    else if (d.kind === "turnout") onSelect?.({ kind: "turnout", id: d.id });
    else if (d.kind === "trackEnd") onSelect?.({ kind: "track", id: d.id });
    else if (d.kind === "industryEnd") onSelect?.({ kind: "industry", id: d.id });
  };
  /** Pointer → inches along the main, clamped to the module. */
  const posFrom = (p: Pt) =>
    Math.round(
      Math.max(0, Math.min(lengthInches, projectToCenterline(centerline, p).pos)) * 10,
    ) / 10;

  /** Is a track curving at `pos`? Compares the tangent a short way either side;
   * a straight run keeps the same heading, an arc turns. Used to keep a curved
   * turnout on curved track (a curved switch belongs on a curve, per the
   * prototype). Window ±3″ with a ~4° threshold ignores sampling jitter. */
  const isCurvedAt = (pts: Pt[], pos: number): boolean => {
    if (pts.length < 2) return false;
    const eps = 3;
    const a = sampleAt(pts, Math.max(0, pos - eps));
    const b = sampleAt(pts, pos + eps);
    const dot = Math.max(-1, Math.min(1, a.nx * b.nx + a.ny * b.ny));
    return Math.acos(dot) > 4 * DEG;
  };

  /** Place a turnout from the palette, keeping a curved turnout on curved track. */
  const dropTurnoutGuarded = (
    spec: { kind: TurnoutKind; curved?: boolean },
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

  /** Place a crossover from the palette. The span follows the prototype: the
   * diagonal clears one track-spacing at the frog angle atan(1/#), so its run
   * along the main = # × spacing (tt-n-c-*). Centred on the drop point; the
   * side you drop on picks where the parallel lane goes. The editor reuses a
   * covering parallel track there or creates a stub the owner draws out. */
  const dropCrossoverAt = (
    spec: { hand?: "left" | "right"; double?: boolean },
    pt: Pt,
  ) => {
    if (!onDropCrossover || centerline.length < 2) return;
    const size = turnoutSize > 0 ? turnoutSize : 6;
    const span = size * LANE_SPACING_INCHES;
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

  /** Drag a turnout out of the palette and onto the board. A ghost follows the
   * pointer; releasing over a track drops the turnout there (snapped to the
   * nearest track), with its spur stub. Releasing off-board just cancels. Uses
   * window listeners so the drag survives leaving the little glyph button. */
  const startPaletteDrag = (kind: PaletteKind, e: React.PointerEvent) => {
    e.preventDefault();
    setArmedPalette(kind);
    setPaletteDrag({ kind, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setPaletteDrag({ kind, x: ev.clientX, y: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPaletteDrag(null);
      const svg = svgRef.current;
      if (!svg || centerline.length < 2) return;
      const r = svg.getBoundingClientRect();
      const over =
        ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!over) return;
      const pt = toLocal(ev);
      const xo = crossoverSpecForPalette(kind);
      if (xo) {
        dropCrossoverAt(xo, pt);
        return;
      }
      const spec = specForPalette(kind);
      if (!spec || !onDropTurnout) return;
      const hit = nearestTrackPos(pt);
      if (hit) dropTurnoutGuarded(spec, hit.onTrack, hit.pos);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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
      setView({
        ...pan.view,
        minX: pan.view.minX - (now.x - pan.from.x),
        minY: pan.view.minY - (now.y - pan.from.y),
      });
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
    const d = dragRef.current;
    if (!d) return;

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
        // Joining tracks: snap the dragged end onto a same-lane track's end so
        // two stubs (e.g. the parallels of two crossovers) meet EXACTLY and
        // read as one continuous track — like corners snap to endplates.
        let joined: string | null = null;
        if (t) {
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
        setReadout(joined ? `${len} · meets ${joined}` : len);
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
        let pos = posFrom(q);
        if (pos >= end - 0.01) {
          const past = ((q.x - b.x) * tx + (q.y - b.y) * ty) / tl;
          pos = end + Math.max(0, past);
        }
        // Can't drag it back over the last joint — that would invert the board
        // it terminates. Nothing bounds it going outward.
        const lo = (sectionBreaks[sectionBreaks.length - 1] ?? 0) + 1;
        pos = Math.max(lo, pos);
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
        if (d.i === 0) return; // the throat stays snapped to the turnout
        next[d.i] = { ...next[d.i], x: p.x, y: p.y };
        setReadout(`${fmt(p.x)}, ${fmt(p.y)}″`);
      } else {
        const p0 = editSpur[d.i];
        const p1 = editSpur[d.i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const c = Math.hypot(dx, dy) || 1;
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const bulge = (p.x - mx) * (-dy / c) + (p.y - my) * (dx / c);
        next[d.i] = { ...next[d.i], bulge: Math.abs(bulge) < 0.5 ? 0 : bulge };
        setReadout(`bow ${fmt(Math.abs(bulge))}″`);
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
        const p0 = editMain[d.i];
        const p1 = editMain[d.i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const c = Math.hypot(dx, dy) || 1;
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const bulge = (p.x - mx) * (-dy / c) + (p.y - my) * (dx / c);
        next[d.i] = { ...next[d.i], bulge: Math.abs(bulge) < 0.5 ? 0 : bulge };
        setReadout(`bow ${fmt(Math.abs(bulge))}″`);
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
        const p0 = editMain2[d.i];
        const p1 = editMain2[d.i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const c = Math.hypot(dx, dy) || 1;
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const bulge = (p.x - mx) * (-dy / c) + (p.y - my) * (dx / c);
        next[d.i] = { ...next[d.i], bulge: Math.abs(bulge) < 0.5 ? 0 : bulge };
        setReadout(`bow ${fmt(Math.abs(bulge))}″`);
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
  const onUp = (e: React.PointerEvent) => {
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
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      panRef.current = null;
    }
    // Releasing a track-end drag: the editor merges the track with any same-lane
    // track it now abuts (the snap made the ends meet exactly) into ONE track,
    // and reflects endplate contact (a track ON a plate = a double-track plate).
    if (dragRef.current?.kind === "trackEnd") onTrackEndDrop?.(dragRef.current.id);
    // Releasing a turnout drag: an End-of-Double-Track turnout dragged onto the
    // single end's plate completes the double main (the editor flips the config).
    if (dragRef.current?.kind === "turnout") onTurnoutDrop?.(dragRef.current.id);
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
    ...mainSegments.map((pts, i) => ({
      id: `__main__${i}`,
      selId: MAIN_TRACK_ID,
      pts,
      main: true,
      selectable: true,
    })),
    ...trackPaths.map((t) => ({ id: t.id, pts: t.pts, main: false, selectable: true })),
    // A wye's mirrored second route draws as a (non-selectable) band.
    ...wyeMirrorLegs.map((w) => ({ id: w.id, pts: w.pts, main: false, selectable: false })),
    // Switch legs the bands don't already carry (a siding's far turnout, etc.).
    ...connectorLegs.map((c) => ({ id: c.id, pts: c.pts, main: false, selectable: false })),
  ];

  /** Is a rail PAIR worth drawing, or is the gauge sub-pixel at this zoom? A
   * gauge is 0.354″; below ~3 px of separation the two lines just smear. */
  const railsVisible = RAIL_GAUGE_INCHES * scale >= 3;
  type TrackLine = (typeof trackLines)[number];
  // What clicking a line selects — the main's segments all report the main.
  const trackSelId = (line: TrackLine) => line.selId ?? line.id;
  const trackOn = (line: TrackLine) =>
    selection?.kind === "track" && selection.id === trackSelId(line);
  const trackClick = (line: TrackLine) =>
    tool === "industry" && onAddIndustry
      ? (e: React.PointerEvent) => {
          e.stopPropagation();
          onAddIndustry(line.main ? "main" : line.id, posFrom(toLocal(e)));
        }
      : // Turnout / Signal tools: don't intercept — let the click fall through
        // to the background handler, which drops on the nearest track (#63/#53).
        tool !== "turnout" && tool !== "signal" && line.selectable && onSelect
        ? (e: React.PointerEvent) => {
            e.stopPropagation();
            onSelect({ kind: "track", id: trackSelId(line) });
          }
        : undefined;

  /**
   * ⚠️⚠️ TRACKS RENDER IN TWO PASSES — every roadbed band, THEN every rail.
   * Do not merge them back together.
   *
   * Drawn per track (band and rails as one group) a later track's roadbed —
   * 1.3″ wide — paints straight over an earlier track's rails, which are 0.03″.
   * The main is first in `trackLines`, so EVERY switch leg erased the stretch of
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

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Tool options (left) + view controls (right). Only the active tool's
          controls show — not a global toolbar. */}
      <div className="mb-2 flex min-h-6 shrink-0 flex-wrap items-center gap-2 text-xs">
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
        ) : tool === "turnout" ? (
          <>
            <label className="flex items-center gap-1 font-medium text-gray-600">
              Turnout #
              <select
                value={turnoutSize}
                onChange={(e) => onTurnoutSizeChange?.(Number(e.target.value))}
                className="rounded border border-gray-300 px-1 py-0.5 text-xs"
              >
                {[4, 5, 6, 7, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    #{n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-0.5">
              {TURNOUT_PALETTE.map((p) => {
                const armed = !p.soon && armedPalette === p.kind;
                return (
                  <button
                    key={p.kind}
                    type="button"
                    title={p.soon ? `${p.label} — coming soon` : `${p.label} — drag onto a track, or click it then click the board`}
                    disabled={p.soon}
                    onPointerDown={p.soon ? undefined : (e) => startPaletteDrag(p.kind, e)}
                    onClick={p.soon ? undefined : () => setArmedPalette(p.kind)}
                    className={`flex h-7 w-8 items-center justify-center rounded border ${
                      armed
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    } ${p.soon ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"}`}
                  >
                    <TurnoutGlyph kind={p.kind} className="h-4 w-6" />
                  </button>
                );
              })}
            </div>
            {dropWarn ? (
              <span className="font-medium text-amber-700">{dropWarn}</span>
            ) : (
              <span className="text-gray-500">
                Drag a turnout onto a track — it lands with a short spur you drag to
                size. (Or click a glyph, then click the board.)
              </span>
            )}
          </>
        ) : tool === "track" ? (
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
                {editSpurTrack
                  ? "Drag the spur's points ○ to bend/rotate (◇ to curve · Alt-click to remove). The throat stays on its turnout."
                  : mainPath.length < 2 && centerline.length < 2
                    ? "Draw the mainline — click near one end of the board, then the other. Then drag a point ○ to move it, or an edge ◇ to curve it."
                    : "Drag the mainline's points ○ · edge ◇ to curve · click the line to add a bend · Alt-click to remove. Click a siding or spur to edit it."}
              </span>
            </>
          )
        ) : (
          <span className="text-gray-500">
            Click anything to select it · drag a turnout ● or a siding&rsquo;s end ○
            along the main to position it.
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => zoomButtons(1 / 1.25)} className={iconBtn} title="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomButtons(1.25)} className={iconBtn} title="Zoom out">
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

      {paletteDrag && (
        <div
          className="pointer-events-none fixed z-50 flex h-8 w-10 items-center justify-center rounded border border-blue-500 bg-white/95 text-blue-700 shadow-md"
          style={{ left: paletteDrag.x + 12, top: paletteDrag.y + 12 }}
        >
          <TurnoutGlyph kind={paletteDrag.kind} className="h-4 w-6" />
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
            : tool === "benchwork" || tool === "industry" || tool === "track" || tool === "turnout" || tool === "signal"
              ? "cursor-crosshair"
              : ""
        }`}
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
        {trackLines.map(renderTrackRails)}
        {/* Section joints — dashed dividers where the boards split (#48). */}
        {centerline.length >= 2 &&
          sectionBreaks.map((pos, i) => {
            const p = sampleAt(centerline, pos);
            const half =
              Math.max(endplateWidths?.["A"] ?? 24, endplateWidths?.["B"] ?? 24) / 2 + 2;
            return (
              <g key={`sec${i}`}>
                <line
                  x1={p.x + p.nx * half}
                  y1={sy(p.y + p.ny * half)}
                  x2={p.x - p.nx * half}
                  y2={sy(p.y - p.ny * half)}
                  stroke="#64748b"
                  strokeWidth={world(1)}
                  strokeDasharray={`${world(3)} ${world(2)}`}
                />
                <text
                  x={p.x + p.nx * half}
                  y={sy(p.y + p.ny * half) - world(2)}
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
                    <title>Drag to move this section joint</title>
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
        {/* Siding / spur end handles — drag along the main to reposition */}
        {onTrackEndMove &&
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
        {/* Turnouts — drag along the track to set their position */}
        {turnoutPts.map((t) => {
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
                style={onTurnoutMove ? { cursor: "ew-resize" } : undefined}
                onPointerDown={
                  onTurnoutMove ? (e) => beginDrag(e, { kind: "turnout", id: t.id }) : undefined
                }
              >
                <title>
                  {onTurnoutMove
                    ? "Turnout — drag along the track to move it (its position is measured to its frog)"
                    : "Turnout"}
                </title>
              </circle>
            </g>
          );
        })}
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
                  strokeWidth={on ? world(4) : world(2.5)}
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
              <text
                x={ind.label.x}
                y={sy(ind.label.y)}
                textAnchor="middle"
                fontSize={world(9)}
                fill="#92400e"
                fontWeight={600}
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
          const hw = (endplateWidths?.[p.id] ?? 24) / 2;
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
        {tool === "track" && !editSpurTrack && !editingMain2 && !pendingTrack && editMain.length === 1 && (
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
        {/* --- Mainline edit handles (Track tool, no spur selected) — bend/drag the main --- */}
        {tool === "track" && !editSpurTrack && !editingMain2 && !pendingTrack && editMain.length >= 2 && (
          <>
            {editMain.slice(0, -1).map((_, i) => {
              const h = mainEdgeHandle(i);
              return (
                <rect
                  key={`me${i}`}
                  x={h.x - r * 0.9}
                  y={sy(h.y) - r * 0.9}
                  width={r * 1.8}
                  height={r * 1.8}
                  fill={editMain[i].bulge ? "#7c3aed" : "#fff"}
                  stroke="#7c3aed"
                  strokeWidth={r * 0.35}
                  transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => beginDrag(e, { kind: "mainEdge", i })}
                >
                  <title>Drag to bow this stretch of mainline into a curve</title>
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
            {editMain2.slice(0, -1).map((_, i) => {
              const h = main2EdgeHandle(i);
              return (
                <rect
                  key={`m2e${i}`}
                  x={h.x - r * 0.9}
                  y={sy(h.y) - r * 0.9}
                  width={r * 1.8}
                  height={r * 1.8}
                  fill={editMain2[i].bulge ? "#7c3aed" : "#fff"}
                  stroke="#7c3aed"
                  strokeWidth={r * 0.35}
                  transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => beginDrag(e, { kind: "main2Edge", i })}
                >
                  <title>Drag to bow this stretch of Main 2 into a curve</title>
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
            {editSpur.slice(0, -1).map((_, i) => {
              const h = spurEdgeHandle(editSpur, i);
              return (
                <rect
                  key={`se${i}`}
                  x={h.x - r * 0.9}
                  y={sy(h.y) - r * 0.9}
                  width={r * 1.8}
                  height={r * 1.8}
                  fill={editSpur[i].bulge ? "#0d9488" : "#fff"}
                  stroke="#0f766e"
                  strokeWidth={r * 0.35}
                  transform={`rotate(45 ${h.x} ${sy(h.y)})`}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => beginDrag(e, { kind: "spurEdge", id: editSpurTrack.id, i })}
                >
                  <title>Drag to bow this stretch into a curve</title>
                </rect>
              );
            })}
            {editSpur.map((p, i) => (
              <circle
                key={`sv${i}`}
                cx={p.x}
                cy={sy(p.y)}
                r={r}
                fill={i === 0 ? "#99f6e4" : "#fff"}
                stroke="#0f766e"
                strokeWidth={r * 0.4}
                style={{ cursor: i === 0 ? "default" : "grab" }}
                onPointerDown={(e) => {
                  if (e.altKey) {
                    e.stopPropagation();
                    removeSpurVertex(editSpurTrack, i);
                  } else beginDrag(e, { kind: "spurVertex", id: editSpurTrack.id, i });
                }}
              >
                <title>{i === 0 ? "Throat — snapped to the turnout" : "Drag to move · Alt-click to remove"}</title>
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
                    {fmt(extentW)}″ · {feetLabel(extentW)}
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
                    {fmt(extentH)}″
                  </text>
                </>
              );
            })()}
          </g>
        )}
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
              { sw: <circle cx={8} cy={8} r={4.5} fill="#fff" stroke="#0f766e" strokeWidth={2} />, label: "Track end — drag to lengthen or shorten a spur / siding" },
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
