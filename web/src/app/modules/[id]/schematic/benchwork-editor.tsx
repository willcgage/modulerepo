"use client";

import { useMemo, useRef, useState } from "react";
import {
  sampleBenchworkOutline,
  type BenchworkPoint,
  type EndplatePose,
} from "@willcgage/module-schematic";
import { lanePath, sampleAt, laneOffset, projectToCenterline } from "@/lib/physical-track";

type Pt = { x: number; y: number };
const DEG = Math.PI / 180;

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
  | { kind: "track"; id: string };

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
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "vertex" | "edge"; i: number }
    | { kind: "turnout"; id: string }
    | { kind: "trackEnd"; id: string; end: "from" | "to" }
    | null
  >(null);
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

  const bounds = useMemo(() => {
    const ctx = [...centerline, ...trackPaths.flatMap((t) => t.pts)];
    const xs = [0, lengthInches, ...anchors.map((a) => a.x), ...sampled.map((p) => p.x), ...ctx.map((p) => p.x)];
    const ys = [-16, 16, ...anchors.map((a) => a.y), ...sampled.map((p) => p.y), ...ctx.map((p) => p.y)];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = Math.max(8, (maxX - minX) * 0.06);
    return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [lengthInches, anchors, sampled, centerline, trackPaths]);

  const sy = (y: number) => -y;
  const vb = `${bounds.minX} ${-(bounds.minY + bounds.h)} ${bounds.w} ${bounds.h}`;
  const r = Math.max(1.5, bounds.w * 0.006);
  const snapDist = Math.max(3, bounds.w * 0.02);

  const toLocal = (e: React.PointerEvent): Pt => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    const u = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    return { x: u.x, y: -u.y };
  };

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
    const d = dragRef.current;
    if (!d) return;
    const p = toLocal(e);

    // Track features are positional: project the pointer back onto the main.
    if (d.kind === "turnout") {
      if (centerline.length >= 2) onTurnoutMove?.(d.id, posFrom(p));
      return;
    }
    if (d.kind === "trackEnd") {
      if (centerline.length >= 2) onTrackEndMove?.(d.id, d.end, posFrom(p));
      return;
    }

    const next = [...outline];
    if (d.kind === "vertex") {
      const s = snapToAnchor(p);
      next[d.i] = { ...next[d.i], x: s.x, y: s.y };
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
    }
    commit(next);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const removeSel = () => {
    if (sel === null) return;
    commit(outline.filter((_, i) => i !== sel));
    setSel(null);
  };
  const straightenSel = () => {
    if (sel === null) return;
    const next = [...outline];
    next[sel] = { x: next[sel].x, y: next[sel].y }; // drop bulge on the edge leaving sel
    commit(next);
  };
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

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
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
            ? "No outline — the layout uses the endplate-width band. Start from a rectangle, then shape it."
            : "Click an edge to add a corner · drag a corner (snaps to endplate anchors ◆) · drag an edge's ◇ to curve it · drag a turnout ● or a siding's end ○ along the main to position it."}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="360"
        preserveAspectRatio="xMidYMid meet"
        className="touch-none rounded-md border border-gray-300 bg-gray-50"
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
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
          return (
            <g key={p.id}>
              <line
                x1={p.x - nx * hw}
                y1={sy(p.y - ny * hw)}
                x2={p.x + nx * hw}
                y2={sy(p.y + ny * hw)}
                stroke="#3b82f6"
                strokeWidth={r * 0.7}
                strokeLinecap="round"
              />
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

        {/* Outline polygon (arcs sampled) */}
        {sampled.length >= 2 && (
          <polygon
            points={polyPts}
            fill="#0ea5e9"
            fillOpacity={outline.length >= 3 ? 0.14 : 0}
            stroke="#0284c7"
            strokeWidth={r * 0.7}
            strokeLinejoin="round"
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
      </svg>

      {sel !== null && outline[sel] && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Corner {sel + 1}:</span>
          <label className="flex items-center gap-1">
            x
            <input
              type="number"
              step={0.5}
              value={outline[sel].x}
              onChange={(e) => {
                const next = [...outline];
                next[sel] = { ...next[sel], x: Number(e.target.value) };
                commit(next);
              }}
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            y
            <input
              type="number"
              step={0.5}
              value={outline[sel].y}
              onChange={(e) => {
                const next = [...outline];
                next[sel] = { ...next[sel], y: Number(e.target.value) };
                commit(next);
              }}
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          {outline[sel].bulge ? (
            <button type="button" onClick={straightenSel} className={btn}>
              Straighten this edge
            </button>
          ) : null}
          <button
            type="button"
            onClick={removeSel}
            className="rounded-md border border-red-300 px-3 py-1 font-medium text-red-700 hover:bg-red-50"
          >
            Remove corner
          </button>
        </div>
      )}
    </div>
  );
}

const btn =
  "rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
