/**
 * Physical track geometry — maps the schematic's positional model (inches along
 * the mainline + a lane index) onto real points on the module's centre-line, so
 * sidings, turnouts and signals can be drawn on the PHYSICAL canvas instead of
 * only in the straightened dispatcher view. Pure.
 */
export interface Pt {
  x: number;
  y: number;
}

import { FREEMO_TRACK_SPACING_INCHES } from "@/lib/module-schematic";

/** Free-moN double-track centre spacing (inches) — one lane step. Re-exported
 * from the shared contract so this app and Free-Dispatcher can't drift: the
 * standard fixes it at 1.125″ ("Double track endplates must have a track
 * spacing of 1.125 inches"). */
export const LANE_SPACING_INCHES = FREEMO_TRACK_SPACING_INCHES;

/** Cumulative arc length at each vertex of the centre-line. */
function cumulative(center: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < center.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(center[i].x - center[i - 1].x, center[i].y - center[i - 1].y),
    );
  }
  return cum;
}

/** Total centre-line length in inches. */
export function centerlineLength(center: Pt[]): number {
  const cum = cumulative(center);
  return cum[cum.length - 1] ?? 0;
}

/**
 * The point `pos` inches along the centre-line from endplate A, plus the unit
 * LEFT normal there (for offsetting lanes / signal sides). Clamps to the ends.
 */
export function sampleAt(center: Pt[], pos: number): Pt & { nx: number; ny: number } {
  if (center.length === 0) return { x: 0, y: 0, nx: 0, ny: 1 };
  if (center.length === 1) return { ...center[0], nx: 0, ny: 1 };
  const cum = cumulative(center);
  const total = cum[cum.length - 1] || 1;
  const d = Math.max(0, Math.min(total, pos));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = center[i - 1];
  const b = center[i];
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / segLen;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    nx: -dy / len, // left normal
    ny: dx / len,
  };
}

/** Offset (inches) of a lane from the mainline: lane 0 = the main itself. */
export function laneOffset(lane: number): number {
  return (lane ?? 0) * LANE_SPACING_INCHES;
}

/**
 * The inverse of sampleAt: project an arbitrary point onto the centre-line and
 * return how many inches along the main the nearest point is (plus how far off
 * it was). This is what turns "I dragged a turnout to here on the board" back
 * into the schematic's positional model.
 */
export function projectToCenterline(
  center: Pt[],
  p: Pt,
): { pos: number; dist: number } {
  if (center.length < 2) return { pos: 0, dist: Infinity };
  let best = { pos: 0, dist: Infinity };
  let acc = 0;
  for (let i = 1; i < center.length; i++) {
    const a = center[i - 1];
    const b = center[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < best.dist) best = { pos: acc + segLen * t, dist: d };
    acc += segLen;
  }
  return best;
}

/**
 * The physical path of a track that runs from `fromPos` to `toPos` inches along
 * the mainline, offset to its lane — i.e. a siding/spur drawn on the real board,
 * following the module's curvature.
 */
export function lanePath(
  center: Pt[],
  fromPos: number,
  toPos: number,
  lane: number,
  steps = 24,
): Pt[] {
  if (center.length < 2) return [];
  const off = laneOffset(lane);
  const a = Math.min(fromPos, toPos);
  const b = Math.max(fromPos, toPos);
  if (b - a < 0.01) return [];
  const out: Pt[] = [];
  for (let s = 0; s <= steps; s++) {
    const p = sampleAt(center, a + ((b - a) * s) / steps);
    out.push({ x: p.x + p.nx * off, y: p.y + p.ny * off });
  }
  return out;
}
