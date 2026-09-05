/**
 * Which of a section's edges are INTERNAL SEAMS against a neighbouring section
 * (#96).
 *
 * ⛔ THE DEFECT THIS ANSWERS. The endplate binding control offers every edge of
 * every section, gated only on whether the edge is straight. On Blairstown — a
 * real 96″ × 12″ board split at x=48 — that means four 12″ straight candidates,
 * and TWO OF THEM ARE THE SAME INTERNAL SEAM seen from either side (`sec1`
 * edge 1 and `sec2` edge 3). They read identically to the module's genuine ends;
 * only the compass direction in the label distinguishes them, and only to an
 * owner who works it out.
 *
 * ⭐⭐ THIS DOES NOT FORBID AN ENDPLATE AT A SEAM, AND MUST NOT. Will, on #96:
 * *"some module owners built all of the module sections to have standard
 * endplates. This allows them to be used together or independently."* A section
 * with conforming plates at both ends IS a module by the standard's own
 * mechanical test, so a seam carrying two endplates is a real and intended
 * arrangement. What the standard says is that endplate rules are not *required*
 * across an internal boundary — *"standards for module end interfaces do not
 * apply to inter-section interfaces"* — so the owner is told what an edge IS
 * and left to decide ([[flagged-never-corrected]]).
 *
 * ⭐ Adjacency comes from SHARED POLYGON EDGES, not list order — the model Will
 * settled on for #96 phase 2c, precisely so a peninsula hanging off the back of
 * a band is a first-class neighbour of it rather than an entry two slots away
 * in an array.
 */
import type { BenchworkPoint } from "@willcgage/module-schematic";

/** How far apart two edges may sit and still be judged the same seam (inches).
 * Outlines are authored by dragging, so two boards drawn to meet rarely agree
 * to the last thousandth. */
const SEAM_TOLERANCE_INCHES = 0.1;

/** Overlap shorter than this is a corner touching a corner, not a seam. */
const MIN_SEAM_INCHES = 0.5;

export type SectionSeam = {
  /** The section on the other side of this seam. */
  otherSectionId: string;
  /** Length of the shared run, in inches. */
  inches: number;
  /** How much of THIS edge the seam covers, 0..1.
   *
   * ⚠️ DELIBERATELY ASYMMETRIC. Where a narrow peninsula meets the long edge of
   * a band, the peninsula's edge is entirely a seam while the band's is a seam
   * for a fraction of its run — and an endplate can still legitimately sit on
   * the part of the band's edge that faces open air. One number cannot describe
   * both sides, so each edge reports its own. */
  fraction: number;
};

type Section = { id: string; outline?: BenchworkPoint[] | null };

/** Key into the returned map: the same `section:index` key the endplate edge
 * control already uses. */
export function seamKey(sectionId: string, edgeIndex: number): string {
  return `${sectionId}:${edgeIndex}`;
}

/**
 * Every section edge that runs against another section, keyed `section:index`.
 *
 * An edge missing from the map faces open air (or is curved — see below) and is
 * an ordinary candidate for an endplate.
 *
 * ⚠️ CURVED EDGES ARE NOT CONSIDERED. An edge whose start vertex carries a
 * `bulge` bows away from its chord, so testing the chord would call two edges
 * coincident that are up to the bulge apart at their middles. An endplate face
 * must be straight anyway, so such an edge is already unusable for binding, and
 * saying nothing is honest where the alternative is a guess.
 */
export function sectionSeams(sections: readonly Section[]): Map<string, SectionSeam> {
  const seams = new Map<string, SectionSeam>();
  const shaped = sections.filter((s) => (s.outline?.length ?? 0) >= 3);

  for (const a of shaped) {
    for (let i = 0; i < a.outline!.length; i++) {
      const segA = straightEdge(a.outline!, i);
      if (!segA) continue;
      let best: SectionSeam | null = null;
      for (const b of shaped) {
        if (b.id === a.id) continue;
        for (let j = 0; j < b.outline!.length; j++) {
          const segB = straightEdge(b.outline!, j);
          if (!segB) continue;
          const inches = collinearOverlapInches(segA, segB);
          if (inches < MIN_SEAM_INCHES) continue;
          if (!best || inches > best.inches)
            best = { otherSectionId: b.id, inches, fraction: Math.min(1, inches / segA.length) };
        }
      }
      if (best) seams.set(seamKey(a.id, i), best);
    }
  }
  return seams;
}

type Seg = { x0: number; y0: number; ux: number; uy: number; length: number };

/** Edge `i` as a unit-direction segment, or null when it is curved or has no
 * length. A zero-length edge has no direction at all, and asking for one is how
 * this repo has invented geometry before. */
function straightEdge(outline: BenchworkPoint[], i: number): Seg | null {
  const p0 = outline[i];
  const p1 = outline[(i + 1) % outline.length];
  if (p0.bulge) return null; // bows away from its chord
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  return { x0: p0.x, y0: p0.y, ux: dx / length, uy: dy / length, length };
}

/**
 * How much of `a` is covered by `b`, in inches, when the two are collinear —
 * 0 when they are not.
 *
 * Direction is ignored: a seam is the same seam whichever way round each
 * section happens to wind, and on Blairstown the two sides genuinely run
 * opposite ways.
 */
function collinearOverlapInches(a: Seg, b: Seg): number {
  // Parallel? |sin| between the unit directions, so this is an angle test that
  // does not care about either length.
  const sin = Math.abs(a.ux * b.uy - a.uy * b.ux);
  if (sin * Math.min(a.length, b.length) > SEAM_TOLERANCE_INCHES) return 0;

  // ...and on the SAME line, not merely parallel to it: the perpendicular
  // distance from a's line to both of b's endpoints.
  const perp = (px: number, py: number) =>
    Math.abs((px - a.x0) * -a.uy + (py - a.y0) * a.ux);
  const b1x = b.x0 + b.ux * b.length;
  const b1y = b.y0 + b.uy * b.length;
  if (perp(b.x0, b.y0) > SEAM_TOLERANCE_INCHES) return 0;
  if (perp(b1x, b1y) > SEAM_TOLERANCE_INCHES) return 0;

  // Overlap of the two runs, measured along a's own direction.
  const along = (px: number, py: number) => (px - a.x0) * a.ux + (py - a.y0) * a.uy;
  const t0 = along(b.x0, b.y0);
  const t1 = along(b1x, b1y);
  const lo = Math.max(0, Math.min(t0, t1));
  const hi = Math.min(a.length, Math.max(t0, t1));
  return Math.max(0, hi - lo);
}
