/**
 * Does a siding or spur still reach the turnout that opens it? (#372)
 *
 * Pure and on its own so it can be exercised against real documents — the
 * builder is 8,000 lines of component and a rule buried in it can only be
 * tested by copying it, which is testing a copy.
 */
import { pastFrogInchesForSize, type TrackPart } from "@/lib/module-schematic";

/**
 * Tracks whose END no longer reaches the TURNOUT that opens it (#372).
 *
 * ⛔ THE APP HAS BOTH NUMBERS AND USED TO SAY NOTHING. On FMN-0085 the owner
 * moved a passing siding's two turnouts to 20″ and 160″ and left the siding
 * recorded at 84″–126.7″. Every renderer then drew something different — the
 * builder bridged the gap with legs, the module page drew the track floating,
 * the dispatcher panel drew the stale extent — and none of them said why.
 *
 * ⭐ FLAGGED, NEVER CORRECTED. Moving a turnout deliberately does NOT drag the
 * track: "sidings/spurs are the owner's to place". So this reports the
 * disagreement and leaves both numbers alone.
 *
 * The threshold is the PART's own reach, not a magic number: a turnout's `pos`
 * is its FROG, and its diverging rail keeps going `pastFrogInchesForSize` beyond
 * that before the owner's flex begins. Anything inside that is the track meeting
 * its turnout; the margin absorbs ordinary authoring slop.
 *
 * ⚠️ Only the end NEAREST each turnout is judged. A siding has a turnout at both
 * ends and both are checked; a spur has one, and its stub is the owner's to put
 * wherever they like. A route drawn along its own path (fromPos === toPos) has
 * no meaningful extent on this axis and is skipped.
 */
export function tracksAdriftFromTurnouts(
  s: {
    extraTracks: { id: string; role?: string | null; fromPos: number; toPos: number }[];
    turnouts: { id: string; pos: number; size?: number | null; divergeTrack?: string | null }[];
  },
  library?: TrackPart[],
): Map<string, { gapInches: number; turnoutId: string; turnoutPos: number }> {
  /** Slop allowed on top of the turnout's own diverging rail, inches. */
  const MARGIN = 1;
  const out = new Map<string, { gapInches: number; turnoutId: string; turnoutPos: number }>();
  for (const sw of s.turnouts) {
    if (!sw.divergeTrack) continue;
    const t = s.extraTracks.find((x) => x.id === sw.divergeTrack);
    if (!t || t.fromPos === t.toPos) continue;
    const reach = pastFrogInchesForSize(sw.size ?? 6, library) + MARGIN;
    const near = Math.abs(t.fromPos - sw.pos) <= Math.abs(t.toPos - sw.pos) ? t.fromPos : t.toPos;
    const gap = Math.abs(near - sw.pos) - reach;
    if (gap <= 0) continue;
    // Worst offender wins, so one line names the biggest problem.
    const prev = out.get(t.id);
    if (!prev || gap > prev.gapInches)
      out.set(t.id, { gapInches: gap, turnoutId: sw.id, turnoutPos: sw.pos });
  }
  return out;
}
