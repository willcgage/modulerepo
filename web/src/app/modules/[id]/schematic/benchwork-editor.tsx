"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  sampleBenchworkOutline,
  type BenchworkPoint,
  type EndplatePose,
} from "@willcgage/module-schematic";
import { lanePath, sampleAt, laneOffset, projectToCenterline } from "@/lib/physical-track";

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

/** What's selected on the canvas — the editor renders its inspector. */
export type CanvasSelection =
  | { kind: "corner"; i: number }
  | { kind: "turnout"; id: string }
  | { kind: "track"; id: string }
  | { kind: "endplate"; id: string };

/**
 * What a click on empty canvas means. Without this the canvas has to guess, and
 * it guessed "add a benchwork corner" — so there was no way to click background
 * and mean "nothing". Select is the default; Benchwork is the drawing mode.
 */
export type CanvasTool = "select" | "benchwork";

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
  onTurnoutMove,
  onTrackEndMove,
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
  /** Drag a turnout along the main → its new position, inches from endplate A. */
  onTurnoutMove?: (id: string, pos: number) => void;
  /** Drag a siding/spur end along the main → its new from/to position. */
  onTrackEndMove?: (id: string, end: "from" | "to", pos: number) => void;
  /** Selection is owned by the editor, which renders the inspector for it. */
  selection?: CanvasSelection | null;
  onSelect?: (s: CanvasSelection | null) => void;
  /** What a background click means. See CanvasTool. */
  tool?: CanvasTool;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "vertex" | "edge"; i: number }
    | { kind: "turnout"; id: string }
    | { kind: "trackEnd"; id: string; end: "from" | "to" }
    | null
  >(null);
  /** An in-progress pan: pointer origin + the view at grab time. */
  const panRef = useRef<{ from: Pt; view: ViewBox } | null>(null);
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

  // Track context, laid onto the real centre-line (read-only under the board).
  const trackPaths = useMemo(
    () =>
      centerline.length >= 2
        ? tracks
            .map((t) => ({ id: t.id, pts: lanePath(centerline, t.fromPos, t.toPos, t.lane) }))
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
      .filter((t) => t.editable)
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
            return { id: s.id, x: p.x + p.nx * off, y: p.y + p.ny * off };
          })
        : [],
    [centerline, signals],
  );

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
  };
  /** Pointer → inches along the main, clamped to the module. */
  const posFrom = (p: Pt) =>
    Math.round(
      Math.max(0, Math.min(lengthInches, projectToCenterline(centerline, p).pos)) * 10,
    ) / 10;

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
          spaceHeld ? "cursor-grab" : tool === "benchwork" ? "cursor-crosshair" : ""
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

        {/* --- Track context: the REAL module, drawn under the board --- */}
        {/* Sidings / spurs / Main 2 — positioned along the main, offset to lane */}
        {trackPaths.map((t) => {
          const on = selection?.kind === "track" && selection.id === t.id;
          return (
            <polyline
              key={`trk${t.id}`}
              points={t.pts.map((p) => `${p.x},${sy(p.y)}`).join(" ")}
              fill="none"
              stroke={on ? "#0284c7" : "#94a3b8"}
              strokeWidth={on ? r * 0.9 : r * 0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={onSelect ? { cursor: "pointer" } : undefined}
              onPointerDown={
                onSelect
                  ? (e) => {
                      e.stopPropagation(); // don't add a benchwork corner
                      onSelect({ kind: "track", id: t.id });
                    }
                  : undefined
              }
            >
              <title>{t.id}</title>
            </polyline>
          );
        })}
        {/* Mainline — the real centre-line (follows the module's curvature) */}
        {centerline.length >= 2 ? (
          <polyline
            points={centerline.map((p) => `${p.x},${sy(p.y)}`).join(" ")}
            fill="none"
            stroke="#64748b"
            strokeWidth={r * 0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          poses.length >= 2 && (
            <line
              x1={poses[0].x}
              y1={sy(poses[0].y)}
              x2={poses[poses.length - 1].x}
              y2={sy(poses[poses.length - 1].y)}
              stroke="#93c5fd"
              strokeWidth={r * 0.5}
              strokeDasharray={`${r} ${r}`}
            />
          )
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
        {/* Signals */}
        {signalPts.map((s) => (
          <circle
            key={`sig${s.id}`}
            cx={s.x}
            cy={sy(s.y)}
            r={r * 0.45}
            fill="#fff"
            stroke="#475569"
            strokeWidth={r * 0.25}
          />
        ))}
        {poses.map((p) => {
          const hw = (endplateWidths?.[p.id] ?? 24) / 2;
          const nx = Math.cos((p.heading + 90) * DEG);
          const ny = Math.sin((p.heading + 90) * DEG);
          const on = selection?.kind === "endplate" && selection.id === p.id;
          return (
            <g key={p.id}>
              <line
                x1={p.x - nx * hw}
                y1={sy(p.y - ny * hw)}
                x2={p.x + nx * hw}
                y2={sy(p.y + ny * hw)}
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

        {/* Outline polygon (arcs sampled). The board is CONTEXT drawn over the
            track, so it must not eat their clicks — without this its fill sits
            on top of every turnout, signal and endplate and makes them
            unselectable. Its own handles are separate elements below. */}
        {sampled.length >= 2 && (
          <polygon
            points={polyPts}
            fill="#0ea5e9"
            fillOpacity={outline.length >= 3 ? 0.14 : 0}
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
