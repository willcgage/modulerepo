/**
 * How tight is the tightest curve in a drawn track? (#421 follow-up)
 *
 * ⛔ THE STANDARD'S OWN RULE WAS NOT BEING APPLIED TO DRAWN TRACK. MR already
 * warns when a FLEX PIECE is tighter than `FREEMO_MAIN_MIN_RADIUS_INCHES`, but
 * that check is gated on `isFlex && piece.radiusInches != null`. A track drawn
 * as a path with bend handles has no per-piece radius, so nothing ever measured
 * it. FMN-0068's branch to endplate C runs at **4.1″** against a 22″ standard
 * and the builder said nothing at all.
 *
 * ⭐⭐ CIRCUMRADIUS, NOT TURN-PER-STEP. The obvious metric — degrees turned
 * between consecutive segments — depends on how finely the path happens to be
 * sampled, so it says different things about the same curve at two zoom levels.
 * The circle through three consecutive points does not: it is the radius of the
 * arc they lie on, whatever the spacing. Measured against both on FMN-0040, the
 * turn metric called a 4-point polyline a "15° kink" while the circle through
 * those same points is 113″ — because that is a CORNER between long straights,
 * not a tight curve. Two different questions; this file answers the radius one.
 */

import { samplePath } from "@willcgage/module-schematic";

export type Pt = { x: number; y: number };

/**
 * The radius of the tightest arc in `points`, in the same units as the points.
 * `Infinity` for anything straight (or too short to have a curve).
 *
 * ⚠️ Returns the TIGHTEST, not an average: a curve is only as good as its worst
 * spot, and an easement that eases into one tight patch is still limited by the
 * patch.
 */
export function minCurveRadius(points: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length - 1; i++) {
    const r = radiusThrough(points[i - 1], points[i], points[i + 1]);
    if (r < best) best = r;
  }
  return best;
}

/**
 * The radius of the circle through three points — `Infinity` when they are
 * collinear or coincident.
 *
 * ⚠️ A DUPLICATED POINT IS NOT A ZERO-RADIUS CURVE. Two identical points make a
 * degenerate triangle whose area is 0, and `abc / 4K` would then divide by zero
 * and report an infinitely sharp bend that nobody drew. This repo has been
 * burned by exactly that shape before — `atan2(0, 0)` returning 0 invented a
 * 123° notch in a rail that was smooth to 1.1° — so the degenerate cases are
 * checked first and answer "straight", which is the honest reading of a segment
 * with no length and no direction.
 */
export function radiusThrough(a: Pt, b: Pt, c: Pt): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  if (ab < 1e-9 || bc < 1e-9) return Infinity; // a repeated point, not a bend
  // Twice the triangle's signed area; zero means the three lie on a line.
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const area2 = Math.abs(cross);
  if (area2 < 1e-12) return Infinity; // straight
  return (ab * bc * ca) / (2 * area2);
}

/**
 * Bends drawn with BOTH handles that a single bend would hold wider (#435).
 *
 * ⛔⛔ ONE BEND, TWO REPRESENTATIONS, AND ONE IS STRICTLY WORSE. `samplePath`
 * draws an edge as a TRUE CIRCULAR ARC while `bulgeEnd` is unset, and as a cubic
 * with its controls pinned at ⅓/⅔ once it is set. The far handle starts exactly
 * where the near one is, so touching it changes nothing on screen at that
 * instant — but the edge has silently become the cubic, whose curvature is
 * tightest in the middle. Measured on an 83° turn authored at 22″: the arc reads
 * **22.00″** and the cubic **19.27″** for the same authored bow. An owner can
 * make a compliant curve permanently non-compliant with a drag that looks like a
 * small adjustment, and nothing tells them the representation changed.
 *
 * ⭐⭐ THIS ONLY REPORTS. Will, asked directly: *"flag it, don't collapse."*
 * Rewriting `bulgeEnd` away would change a drawn shape the owner authored —
 * slightly, and for the better on paper, but it is theirs
 * ([[flagged-never-corrected]]).
 *
 * ⚠️ SYMMETRIC BENDS ONLY, and the tolerance is the stored precision. Two
 * handles pulled in OPPOSITE directions make an S, which a single arc cannot
 * express at all — telling that owner to use one bend would be telling them to
 * flatten a shape they meant. Unequal same-way handles are a deliberate
 * asymmetry for the same reason. Only a bow that is symmetric to the last stored
 * digit is one the arc branch can hold identically.
 */
export function bendsWiderAsArc(
  path: readonly { x: number; y: number; bulge?: number; bulgeEnd?: number }[],
): { index: number; asDrawnInches: number; asArcInches: number }[] {
  const out: { index: number; asDrawnInches: number; asArcInches: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    const near = p0.bulge ?? 0;
    const far = p0.bulgeEnd;
    if (far == null) continue; // already the arc branch
    if (!near || !far) continue; // nothing bowed on one side; not a symmetric bow
    if (Math.sign(near) !== Math.sign(far)) continue; // an S — an arc cannot say it
    if (Math.abs(near - far) > 0.011) continue; // authored asymmetry, not this bug
    const asDrawn = minCurveRadius(samplePath([{ ...p0 }, { ...p1 }] as never));
    const asArc = minCurveRadius(
      samplePath([{ x: p0.x, y: p0.y, bulge: near }, { x: p1.x, y: p1.y }] as never),
    );
    if (!Number.isFinite(asDrawn) || !Number.isFinite(asArc)) continue;
    if (asArc > asDrawn + 0.05) out.push({ index: i, asDrawnInches: asDrawn, asArcInches: asArc });
  }
  return out;
}

