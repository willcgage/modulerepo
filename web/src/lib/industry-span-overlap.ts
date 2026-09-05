/**
 * Industries claiming the same stretch of the same track (#443).
 *
 * ⛔ FOUND ON A REAL MODULE, NOT IMAGINED. FMN-0011 "Blairstown" has FOUR
 * industries — Hydro Gas, Phillips Petroleum, Kelsey Feed & Grain and the
 * Freight house — each authored `fromPos: 13, toPos: 73` on the siding `mt5`,
 * which is the whole of it. They draw one mark and one legible name where there
 * are four of each, and the owner has nothing telling them the other three are
 * under it.
 *
 * ⭐⭐ AND IT IS NOT ONLY A DRAWING PROBLEM, which is why it is worth a warning
 * rather than a nicer layout. #310 measures capacity against the rail an
 * industry spots on, PER INDUSTRY — so one 60″ siding claimed four times
 * reports 60″ of room four times over, and **neither industry looks wrong on
 * its own**. An owner planning car spots from those figures is working from a
 * total that does not exist.
 *
 * ⛔⛔ THIS REPORTS; IT MUST NOT REARRANGE. The spans are AUTHORED. #342/#344
 * already settled the neighbouring question — the app picks good defaults for
 * spans it CREATES, and on a fully-claimed track it returns the preferred span
 * unchanged rather than inventing one elsewhere. Moving what an owner wrote is
 * a different act entirely ([[flagged-never-corrected]]). Four businesses along
 * one team track is a real arrangement; the app's job is to say that the
 * figures behave as though they are one.
 */

/** One claim on a track — an industry's own span, or one of its spots. */
export type SpanClaim = {
  /** The industry this claim belongs to (a spot reports its parent). */
  industryId: string;
  name: string;
  track: string;
  from: number;
  to: number;
  /** True when this is a spot on a second track rather than the industry's own
   * span — worth distinguishing, because the fix differs. */
  spot: boolean;
};

export type OverlapGroup = {
  track: string;
  /** The stretch every member of the group has in common, in inches. */
  from: number;
  to: number;
  claims: SpanClaim[];
};

/** Below this two spans are touching end-to-end, not sharing rail. An industry
 * ending at 40 and the next starting at 40 are neighbours, and flagging that
 * would be the "flag on correctly built trackwork" that teaches owners to
 * ignore warnings. */
const MIN_SHARED_INCHES = 0.01;

type IndustryLike = {
  id: string;
  name?: string | null;
  track: string;
  fromPos: number;
  toPos: number;
  spots?: { track: string; fromPos: number; toPos: number }[] | null;
};

/** Every claim an industry makes, its own span first then each spot. */
function claimsOf(ind: IndustryLike): SpanClaim[] {
  const name = ind.name || "Industry";
  const one = (track: string, a: number, b: number, spot: boolean): SpanClaim => ({
    industryId: ind.id,
    name,
    track,
    from: Math.min(a, b),
    to: Math.max(a, b),
    spot,
  });
  return [
    one(ind.track, ind.fromPos, ind.toPos, false),
    ...(ind.spots ?? []).map((sp) => one(sp.track, sp.fromPos, sp.toPos, true)),
  ];
}

/**
 * Groups of claims that share rail on one track.
 *
 * ⚠️ Grouped TRANSITIVELY, by connected overlap: A overlapping B and B
 * overlapping C puts all three in one group even where A and C do not touch,
 * because the owner's question is "what is stacked on this stretch of track"
 * and answering it three separate times would read as three separate faults.
 * The reported `from`/`to` is then the widest run the group covers.
 */
export function overlappingSpanGroups(industries: readonly IndustryLike[]): OverlapGroup[] {
  const byTrack = new Map<string, SpanClaim[]>();
  for (const ind of industries)
    for (const c of claimsOf(ind)) {
      if (!(c.to - c.from > MIN_SHARED_INCHES)) continue; // a zero-length claim shares nothing
      byTrack.set(c.track, [...(byTrack.get(c.track) ?? []), c]);
    }

  const out: OverlapGroup[] = [];
  for (const [track, claims] of byTrack) {
    // Sweep in order; a claim joins the run it overlaps, otherwise starts one.
    const sorted = [...claims].sort((a, b) => a.from - b.from || a.to - b.to);
    let run: SpanClaim[] = [];
    let end = -Infinity;
    const flush = () => {
      if (run.length > 1)
        out.push({
          track,
          from: Math.min(...run.map((c) => c.from)),
          to: Math.max(...run.map((c) => c.to)),
          claims: run,
        });
      run = [];
    };
    for (const c of sorted) {
      if (run.length && c.from < end - MIN_SHARED_INCHES) {
        run.push(c);
        end = Math.max(end, c.to);
        continue;
      }
      flush();
      run = [c];
      end = c.to;
    }
    flush();
  }
  return out;
}
