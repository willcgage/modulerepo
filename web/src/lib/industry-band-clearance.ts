/**
 * Where an industry's band can sit without lying across a track it does not
 * serve (#421).
 *
 * ⛔ THE BUG THIS EXISTS FOR. The band was placed at a fixed
 * `LANE_SPACING_INCHES * 0.9` on the industry's declared side, computed from
 * its HOST track alone. Nothing looked at what else was drawn there. On
 * FMN-0083 that put "Ace Feed"'s spot — a spot on the SIDING — straight through
 * the diagonal spur: measured on the live canvas, the gap between band and spur
 * ran −0.226″ at x=20 and +0.108″ at x=22, so it crossed the rail at x≈21.4 and
 * then drifted away from it. Will: *"it should never interfere."*
 *
 * ⭐⭐ WHY A SMALLER CONSTANT IS NOT THE FIX. Lanes are `LANE_SPACING_INCHES`
 * apart, so it is tempting to keep the band inside its own lane's half-corridor
 * and call the problem solved. That only holds while every track runs parallel.
 * A spur leaving a turnout crosses lanes diagonally, so it can pass through
 * ANY constant offset at some position — the spur here sits at y≈−1.9 where the
 * siding's band starts and y≈−3.7 where it ends. Clearance has to be MEASURED
 * against what is actually drawn, not assumed from the lane grid.
 *
 * ⭐ The band's own side is tried FIRST and only abandoned if that side cannot
 * be made to clear — an industry's `side` is the owner's, and moving it to the
 * other side of the rail is a bigger lie than pulling it in a little
 * ([[flagged-never-corrected]]). Order: declared side out, declared side in,
 * then the other side.
 */

export type Pt = { x: number; y: number };

/** Distance from a point to a segment — the standard projection, clamped. */
function pointToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  // A zero-length segment is a POINT, and its distance is well defined. Do not
  // let it divide — this is the `atan2(0,0)` trap in another costume
  // ([[fixtures-must-be-faithful]]).
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * The closest approach between two polylines, sampled at `a`'s vertices.
 *
 * ⚠️ Vertex sampling, not true segment-to-segment: exact only when `a` is
 * sampled finely enough that no segment of it dips toward `b` between two of
 * its own vertices. The band is emitted at 16+ steps over a span of a few
 * inches, so its vertices are well under an inch apart and this is tight enough
 * to place a marker by. It is NOT tight enough to prove a crossing — for that,
 * ask whether the sign of the side changes.
 */
export function polylineClearance(a: Pt[], b: Pt[]): number {
  if (a.length === 0 || b.length < 2) return Infinity;
  let best = Infinity;
  for (const p of a) {
    for (let i = 0; i < b.length - 1; i++) {
      const d = pointToSegment(p, b[i], b[i + 1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export type BandPlacement = {
  /** The signed offset to draw at. */
  off: number;
  /** How close the band comes to the nearest track it does not serve. */
  clearance: number;
  /** Did anything reach the required clearance? `false` = best effort only. */
  clears: boolean;
  /** True when the chosen offset is not the one the industry's side asked for. */
  moved: boolean;
};

/**
 * Pick the offset to draw an industry's band at.
 *
 * `buildBand(off)` must return the band's points for a candidate offset — the
 * caller owns the sampling, because only it knows the host path and how the
 * span maps onto it. `others` is every track path the industry does NOT serve.
 *
 * Returns the first candidate clearing `minClearance`; if none does, the one
 * that comes closest to clearing, with `clears: false` so the caller can say so
 * rather than drawing a lie quietly.
 */
export function chooseBandOffset(
  buildBand: (off: number) => Pt[],
  others: Pt[][],
  preferred: number,
  minClearance: number,
): BandPlacement {
  // Declared side first, pulled in before it is given up; the far side last.
  const candidates = [preferred, preferred * 0.55, -preferred, -preferred * 0.55];
  let best: BandPlacement | null = null;
  for (const off of candidates) {
    const band = buildBand(off);
    const clearance = others.length
      ? Math.min(...others.map((o) => polylineClearance(band, o)))
      : Infinity;
    const moved = off !== preferred;
    if (clearance >= minClearance) return { off, clearance, clears: true, moved };
    if (!best || clearance > best.clearance) best = { off, clearance, clears: false, moved };
  }
  // `others` empty and no candidate returned is impossible (Infinity clears),
  // so `best` is set — but keep the fallback total rather than asserting.
  return best ?? { off: preferred, clearance: Infinity, clears: true, moved: false };
}
