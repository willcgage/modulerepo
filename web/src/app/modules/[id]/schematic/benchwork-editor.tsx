"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  sampleBenchworkOutline,
  samplePath,
  type BenchworkPoint,
  type EndplatePose,
} from "@willcgage/module-schematic";
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
}
export interface CanvasTurnout {
  id: string;
  pos: number;
}
export interface CanvasSignal {
  id: string;
  pos: number;
  side: "above" | "below";
}
/** An industry — a car-spot span beside a track (#industries). */
export interface CanvasIndustry {
  id: string;
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
  | { kind: "industry"; id: string };

/**
 * What a click on empty canvas means. Without this the canvas has to guess, and
 * it guessed "add a benchwork corner" — so there was no way to click background
 * and mean "nothing". Select is the default; Benchwork is the drawing mode.
 */
export type CanvasTool = "select" | "benchwork" | "industry" | "track";

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
  onChange,
  lengthInches,
  poses,
  endplateWidths,
  centerline = [],
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
  onTrackPathChange,
  trackMenu,
  pendingTrack = null,
  onPlaceTrack,
  onCancelPlace,
  selection = null,
  onSelect,
  tool = "select",
}: {
  outline: BenchworkPoint[];
  onChange: (next: BenchworkPoint[]) => void;
  lengthInches: number;
  poses: EndplatePose[];
  endplateWidths?: Record<string, number>;
  /** The real mainline centre-line (module-local inches) — drawn as context. */
  centerline?: Pt[];
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
    | { kind: "spurVertex" | "spurEdge"; id: string; i: number }
    | { kind: "turnout"; id: string }
    | { kind: "trackEnd"; id: string; end: "from" | "to" }
    | { kind: "industryEnd"; id: string; end: "from" | "to" }
    | null
  >(null);
  /** An in-progress pan: pointer origin + the view at grab time. */
  const panRef = useRef<{ from: Pt; view: ViewBox } | null>(null);
  /** Draw-to-create in progress: the throat turnout it diverges from + live end. */
  const placeRef = useRef<{ start: Pt; end: Pt; turnoutId: string } | null>(null);
  const [placePreview, setPlacePreview] = useState<{ start: Pt; end: Pt } | null>(null);
  /** Space-to-pan: held-key state, so any tool can pan without switching. */
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** Pointer position in world inches — drives the status-bar readout. */
  const [hover, setHover] = useState<Pt | null>(null);
  /** A live measurement shown while dragging (corner xy, track length, pos). */
  const [readout, setReadout] = useState<string | null>(null);
  /** The selected corner index, when a corner is what's selected. */
  const sel = selection?.kind === "corner" ? selection.i : null;
  const setSel = (i: number | null) => onSelect?.(i === null ? null : { kind: "corner", i });

  // Endplate face corners — the anchors a board corner should meet.
  const anchors = useMemo(() => {
    const out: { x: number; y: number; id: string }[] = [];
    for (const p of poses) {
      const hw = (endplateWidths?.[p.id] ?? 24) / 2;
      const px = Math.cos((p.heading + 90) * DEG);
      const py = Math.sin((p.heading + 90) * DEG);
      out.push({ x: p.x + px * hw, y: p.y + py * hw, id: p.id });
      out.push({ x: p.x - px * hw, y: p.y - py * hw, id: p.id });
    }
    return out;
  }, [poses, endplateWidths]);

  const sampled = useMemo(() => sampleBenchworkOutline(outline, 24), [outline]);

  // Track context. A track with an authored 2-D path draws along it; otherwise
  // it's laid onto the main centre-line, offset to its lane (#2d-track).
  const trackPaths = useMemo(
    () =>
      centerline.length >= 2
        ? tracks
            .map((t) => ({
              id: t.id,
              pts:
                t.path && t.path.length >= 2
                  ? samplePath(t.path)
                  : lanePath(centerline, t.fromPos, t.toPos, t.lane),
            }))
            .filter((t) => t.pts.length > 1)
        : [],
    [centerline, tracks],
  );
  const turnoutPts = useMemo(
    () =>
      centerline.length >= 2
        ? turnouts.map((t) => ({ id: t.id, ...sampleAt(centerline, t.pos) }))
        : [],
    [centerline, turnouts],
  );
  /** Draggable end handles for sidings/spurs (not the derived Main 2). */
  const trackEnds = useMemo(() => {
    if (centerline.length < 2) return [];
    return tracks
      // A drawn spur is positioned by its path, not fromPos/toPos — no end drags.
      .filter((t) => t.editable && !(t.path && t.path.length >= 2))
      .flatMap((t) => {
        const off = laneOffset(t.lane);
        return (["from", "to"] as const).map((end) => {
          const p = sampleAt(centerline, end === "from" ? t.fromPos : t.toPos);
          return { id: t.id, end, x: p.x + p.nx * off, y: p.y + p.ny * off };
        });
      });
  }, [centerline, tracks]);
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
    const xs = [0, lengthInches, ...anchors.map((a) => a.x), ...sampled.map((p) => p.x), ...ctx.map((p) => p.x)];
    const ys = [-16, 16, ...anchors.map((a) => a.y), ...sampled.map((p) => p.y), ...ctx.map((p) => p.y)];
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
  const editMain = mainPath.length >= 2 ? mainPath : seedMain();
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

  // --- Spur path editing (Track tool) — the selected editable spur ------------
  const editSpurTrack =
    tool === "track" && selection?.kind === "track"
      ? tracks.find((t) => t.id === selection.id && t.editable)
      : undefined;
  /** The throat point (on the main at the spur's turnout), or null. */
  const spurThroat = (t: CanvasTrack): Pt | null => {
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
      ? editSpurTrack.path
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
    // Track tool: a background click bends the selected spur, or the mainline
    // when no spur is selected (mainline + spur editing are one tool now).
    if (tool === "track") {
      if (editSpurTrack && onTrackPathChange) addSpurVertex(editSpurTrack, toLocal(e));
      else if (onMainPathChange) addMainVertex(toLocal(e));
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

  /** The turnout nearest a canvas point, by position along the main. */
  const nearestTurnout = (p: Pt): { id: string; pos: number; pt: Pt } | null => {
    if (centerline.length < 2 || turnouts.length === 0) return null;
    const at = posFrom(p);
    let best: CanvasTurnout | null = null;
    let bestD = Infinity;
    for (const tn of turnouts) {
      const d = Math.abs(tn.pos - at);
      if (d < bestD) {
        bestD = d;
        best = tn;
      }
    }
    if (!best) return null;
    const m = sampleAt(centerline, best.pos);
    return { id: best.id, pos: best.pos, pt: { x: m.x, y: m.y } };
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
        const pos = posFrom(p);
        onTrackEndMove?.(d.id, d.end, pos);
        const t = tracks.find((x) => x.id === d.id);
        const other = t ? (d.end === "from" ? t.toPos : t.fromPos) : pos;
        setReadout(lengthLabel(Math.abs(pos - other)));
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

  // --- Track fidelity (stage 4) ----------------------------------------------
  // Rails and ties only read once the ~0.35″ N gauge spans a few screen pixels;
  // below that a single weighted line is cleaner. All physical (inches), so they
  // scale with the board.
  const GAUGE = 0.354; // N-scale track gauge (9 mm), inches
  const ROADBED = 1.3; // ballast-shoulder band width, inches
  const showRails = GAUGE * scale > 4;
  const railW = world(1);
  const poly = (pts: Pt[]) => pts.map((p) => `${p.x},${sy(p.y)}`).join(" ");
  /** Mainline + sidings/spurs as one list, so all get the same rendering. */
  const trackLines: { id: string; pts: Pt[]; main: boolean; selectable: boolean }[] = [
    ...(centerline.length >= 2
      ? [{ id: "__main__", pts: centerline, main: true, selectable: false }]
      : []),
    ...trackPaths.map((t) => ({ id: t.id, pts: t.pts, main: false, selectable: true })),
  ];

  const renderTrack = (line: (typeof trackLines)[number]) => {
    const on = selection?.kind === "track" && selection.id === line.id;
    const click =
      tool === "industry" && onAddIndustry
        ? (e: React.PointerEvent) => {
            e.stopPropagation();
            onAddIndustry(line.main ? "main" : line.id, posFrom(toLocal(e)));
          }
        : line.selectable && onSelect
          ? (e: React.PointerEvent) => {
              e.stopPropagation();
              onSelect({ kind: "track", id: line.id });
            }
          : undefined;
    return (
      <g
        key={`trk${line.id}`}
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
        {/* Roadbed — subtle ballast band under the rails. */}
        <polyline
          points={poly(line.pts)}
          fill="none"
          stroke="#e9e2d4"
          strokeWidth={ROADBED}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showRails ? (
          <>
            {tiesAlong(line.pts, 1.4, GAUGE * 1.35).map((ti, k) => (
              <line
                key={`tie${k}`}
                x1={ti.x1}
                y1={sy(ti.y1)}
                x2={ti.x2}
                y2={sy(ti.y2)}
                stroke="#a8a29e"
                strokeWidth={world(0.8)}
              />
            ))}
            {[GAUGE / 2, -GAUGE / 2].map((o, k) => (
              <polyline
                key={`rail${k}`}
                points={poly(offsetPath(line.pts, o))}
                fill="none"
                stroke={on ? "#0284c7" : "#475569"}
                strokeWidth={railW}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </>
        ) : (
          <polyline
            points={poly(line.pts)}
            fill="none"
            stroke={on ? "#0284c7" : line.main ? "#64748b" : "#94a3b8"}
            strokeWidth={on ? r * 0.9 : line.main ? r * 0.7 : r * 0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <title>{line.main ? "Mainline" : line.id}</title>
      </g>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tool options (left) + view controls (right). Only the active tool's
          controls show — not a global toolbar. */}
      <div className="mb-2 flex min-h-6 shrink-0 flex-wrap items-center gap-2 text-xs">
        {tool === "benchwork" ? (
          <>
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
            onClick={() => setView(null)}
            className={btn}
            title="Fit the board to the view"
          >
            Fit
          </button>
          <span className="w-11 text-right tabular-nums text-gray-500">{zoomPct}%</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className={`min-h-0 flex-1 touch-none rounded-md border border-gray-300 bg-white ${
          spaceHeld
            ? "cursor-grab"
            : tool === "benchwork" || tool === "industry" || tool === "track"
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
        {sampled.length >= 2 && outline.length >= 3 && (
          <polygon points={polyPts} fill="#f6f2ea" fillOpacity={0.9} pointerEvents="none" />
        )}

        {/* --- Track: roadbed + rails/ties (or a single line when zoomed out) --- */}
        {/* renderTrack's click handler reads the pointer via svgRef, but only
            when fired — not during render; the lint rule can't see that. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {trackLines.map(renderTrack)}
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
          return (
            <circle
              key={`to${t.id}`}
              cx={t.x}
              cy={sy(t.y)}
              r={onTurnoutMove ? r * 0.7 : r * 0.5}
              fill={on ? "#0284c7" : "#475569"}
              stroke={on ? "#0284c7" : "none"}
              strokeWidth={r * 0.5}
              strokeOpacity={0.3}
              style={onTurnoutMove ? { cursor: "ew-resize" } : undefined}
              onPointerDown={
                onTurnoutMove ? (e) => beginDrag(e, { kind: "turnout", id: t.id }) : undefined
              }
            >
              {onTurnoutMove && <title>Drag along the track to move this turnout</title>}
            </circle>
          );
        })}
        {/* Signals — a mast (stem from the track it governs) + a head. */}
        {signalPts.map((s) => (
          <g key={`sig${s.id}`}>
            <line
              x1={s.bx}
              y1={sy(s.by)}
              x2={s.x}
              y2={sy(s.y)}
              stroke="#334155"
              strokeWidth={world(1)}
              strokeLinecap="round"
            />
            <circle cx={s.x} cy={sy(s.y)} r={world(3)} fill="#0f172a" stroke="#fff" strokeWidth={world(0.8)} />
            <circle cx={s.x} cy={sy(s.y)} r={world(1.2)} fill="#f87171" />
          </g>
        ))}
        {/* Industries — a car-spot span beside its track, name + optional readout. */}
        {industryShapes.map((ind) => {
          const on = selection?.kind === "industry" && selection.id === ind.id;
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
                          onSelect({ kind: "industry", id: ind.id });
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
                    onPointerDown={(e) => beginDrag(e, { kind: "industryEnd", id: ind.id, end: h.end })}
                  >
                    <title>{`Drag to move this industry's ${h.end === "from" ? "start" : "end"}`}</title>
                  </rect>
                ))}
            </g>
          );
        })}
        {poses.map((p) => {
          const hw = (endplateWidths?.[p.id] ?? 24) / 2;
          // Along the face (perpendicular to the outward heading)…
          const fx = Math.cos((p.heading + 90) * DEG);
          const fy = Math.sin((p.heading + 90) * DEG);
          // …and the outward heading itself (for the hatch ticks).
          const hxo = Math.cos(p.heading * DEG);
          const hyo = Math.sin(p.heading * DEG);
          const on = selection?.kind === "endplate" && selection.id === p.id;
          const ax = p.x - fx * hw;
          const ay = p.y - fy * hw;
          const bx = p.x + fx * hw;
          const by = p.y + fy * hw;
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
              <line
                x1={ax}
                y1={sy(ay)}
                x2={bx}
                y2={sy(by)}
                stroke={on ? "#1d4ed8" : "#3b82f6"}
                strokeWidth={on ? r * 1.2 : r * 0.7}
                strokeLinecap="round"
                style={onSelect ? { cursor: "pointer" } : undefined}
                onPointerDown={
                  onSelect
                    ? (e) => {
                        e.stopPropagation(); // don't draw through the endplate
                        onSelect({ kind: "endplate", id: p.id });
                      }
                    : undefined
                }
              >
                <title>{`Endplate ${p.id} — the standard interface`}</title>
              </line>
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

        {/* --- Mainline edit handles (Track tool, no spur selected) — bend/drag the main --- */}
        {tool === "track" && !editSpurTrack && !pendingTrack && editMain.length >= 2 && (
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
function tiesAlong(
  pts: Pt[],
  spacing: number,
  half: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg = Math.hypot(dx, dy);
    if (seg === 0) continue;
    const nx = -dy / seg;
    const ny = dx / seg;
    for (let d = carry; d < seg; d += spacing) {
      const t = d / seg;
      const cx = a.x + dx * t;
      const cy = a.y + dy * t;
      out.push({ x1: cx - nx * half, y1: cy - ny * half, x2: cx + nx * half, y2: cy + ny * half });
      if (out.length > 600) return out;
    }
    carry = spacing - ((seg - carry) % spacing);
  }
  return out;
}
