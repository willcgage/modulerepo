"use client";

import { useMemo, useRef, useState } from "react";
import type { EndplatePose } from "@willcgage/module-schematic";

type Pt = { x: number; y: number };

/**
 * Benchwork outline editor — draw a module's physical footprint as a polygon in
 * module-local inches (endplate A's track point at the origin, mainline +x,
 * perpendicular +y up). The endplate poses are drawn as a faint reference. Click
 * an edge to add a vertex, drag a vertex to move it, select one to remove or type
 * exact inches. Empty outline = the layout falls back to the endplate-width band.
 */
export function BenchworkEditor({
  outline,
  onChange,
  lengthInches,
  poses,
}: {
  outline: Pt[];
  onChange: (next: Pt[]) => void;
  lengthInches: number;
  poses: EndplatePose[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  // View box around the track + outline, module-local (before the y flip).
  const bounds = useMemo(() => {
    const xs = [0, lengthInches, ...poses.map((p) => p.x), ...outline.map((p) => p.x)];
    const ys = [-14, 14, ...poses.map((p) => p.y), ...outline.map((p) => p.y)];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = Math.max(8, (maxX - minX) * 0.08);
    return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [lengthInches, poses, outline]);

  const sy = (y: number) => -y; // module +y up → SVG y down
  const vb = `${bounds.minX} ${-(bounds.minY + bounds.h)} ${bounds.w} ${bounds.h}`;
  const r = Math.max(1.5, bounds.w * 0.008); // vertex handle radius, inches

  const toLocal = (e: React.PointerEvent): Pt => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    const u = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    return { x: u.x, y: -u.y };
  };

  const set = (next: Pt[]) => onChange(next.map((p) => ({ x: round(p.x), y: round(p.y) })));

  /** Insert a click point onto the nearest edge (so the ring stays sensible). */
  const addOnNearestEdge = (pt: Pt) => {
    if (outline.length < 2) {
      set([...outline, pt]);
      setSel(outline.length);
      return;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const d = distToSegment(pt, a, b);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...outline];
    next.splice(best + 1, 0, pt);
    set(next);
    setSel(best + 1);
  };

  const onBgDown = (e: React.PointerEvent) => {
    if (dragRef.current !== null) return;
    addOnNearestEdge(toLocal(e));
  };
  const onVertexDown = (e: React.PointerEvent, i: number) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* best-effort */
    }
    dragRef.current = i;
    setSel(i);
  };
  const onMove = (e: React.PointerEvent) => {
    const i = dragRef.current;
    if (i === null) return;
    const p = toLocal(e);
    const next = [...outline];
    next[i] = p;
    set(next);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const removeSel = () => {
    if (sel === null) return;
    set(outline.filter((_, i) => i !== sel));
    setSel(null);
  };
  const seedRectangle = () => {
    const d = 24; // Free-moN recommended depth to start from; drag to the real shape
    set([
      { x: 0, y: -d / 2 },
      { x: lengthInches, y: -d / 2 },
      { x: lengthInches, y: d / 2 },
      { x: 0, y: d / 2 },
    ]);
    setSel(null);
  };

  const poly = outline.map((p) => `${p.x},${sy(p.y)}`).join(" ");

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={seedRectangle}
          className="rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50"
        >
          {outline.length ? "Reset to rectangle" : "Start from a rectangle"}
        </button>
        {outline.length > 0 && (
          <button
            type="button"
            onClick={() => {
              set([]);
              setSel(null);
            }}
            className="rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
        <span className="text-gray-500">
          {outline.length === 0
            ? "No outline — the layout uses the endplate-width band. Start from a rectangle, then drag corners."
            : "Click an edge to add a corner · drag a corner to move · select one to remove / type exact inches."}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        height="240"
        preserveAspectRatio="xMidYMid meet"
        className="touch-none rounded-md border border-gray-300 bg-gray-50"
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {/* Track reference: chord A→B + endplate faces */}
        {poses.length >= 2 && (
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
        {poses.map((p) => {
          const nx = Math.cos((p.heading + 90) * (Math.PI / 180));
          const ny = Math.sin((p.heading + 90) * (Math.PI / 180));
          const hw = 12;
          return (
            <g key={p.id}>
              <line
                x1={p.x - nx * hw}
                y1={sy(p.y - ny * hw)}
                x2={p.x + nx * hw}
                y2={sy(p.y + ny * hw)}
                stroke="#3b82f6"
                strokeWidth={r * 0.6}
                strokeLinecap="round"
              />
              <text x={p.x} y={sy(p.y) - r * 1.5} textAnchor="middle" fontSize={r * 2.2} fill="#2563eb">
                {p.id}
              </text>
            </g>
          );
        })}

        {/* Outline polygon */}
        {outline.length >= 2 && (
          <polygon
            points={poly}
            fill="#0ea5e9"
            fillOpacity={outline.length >= 3 ? 0.14 : 0}
            stroke="#0284c7"
            strokeWidth={r * 0.7}
            strokeLinejoin="round"
          />
        )}
        {/* Vertices */}
        {outline.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={sy(p.y)}
            r={r}
            fill={sel === i ? "#0284c7" : "#fff"}
            stroke="#0284c7"
            strokeWidth={r * 0.4}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onVertexDown(e, i)}
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
                set(next);
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
                set(next);
              }}
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </label>
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
