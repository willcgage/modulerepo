/**
 * Do a siding's two turnouts agree which side of the main it sits on? (#371)
 *
 * Pure and on its own, for the same reason as `track-adrift`: the builder is
 * 8,000 lines of component, and a rule buried in it can only be exercised by
 * copying it — which is testing a copy, not the code that ships.
 */
import { divergeSideForHand, turnoutFacing, type TurnoutKind } from "@/lib/module-schematic";

export type SidingHandConflict = {
  /** The two turnouts that disagree, in position order. */
  a: { id: string; kind: TurnoutKind; pos: number; side: number };
  b: { id: string; kind: TurnoutKind; pos: number; side: number };
};

/**
 * Sidings whose two turnouts imply OPPOSITE sides of the main (#371).
 *
 * ⛔ THE APP HAD EVERY NUMBER AND NO OPINION. Will, editing FMN-0085: *"sw2
 * should be the opposing to build a siding, technically."* A passing siding
 * sits on ONE side of the main, and its second turnout faces the other way
 * along the main — so **the same side is reached by the OPPOSITE hand.**
 * FMN-0085 carried `right`/`right`: a siding that leaves below the main and
 * rejoins above it, which is not a thing that can be built. It drew happily.
 *
 * ⛔⛔ And the drawing takes its side from the THROAT turnout alone, so the
 * second turnout's hand is never read. Measured on FMN-0085 with everything
 * else held constant, `sw2.kind` `"right"` and `"left"` both gave siding lane
 * −2 — meaning Will's correction changed nothing on screen and the
 * contradiction stayed invisible. This is what makes it worth saying out loud.
 *
 * ⭐ FLAGGED, NEVER CORRECTED ([[flagged-never-corrected]]). Which hand is
 * wrong is the owner's call — either turnout could be the one they meant — so
 * this reports the disagreement and rewrites nothing.
 *
 * ⭐ IT EXCLUDES CROSSOVERS BY CONSTRUCTION, NOT BY SPECIAL CASE. Only turnouts
 * sharing the SAME host track are paired. A crossover's two turnouts sit on
 * DIFFERENT mains (FMN-0078: `main` and `main2`), because the whole point of a
 * crossover is to change tracks — so it is never a pair here and no rule about
 * it has to be written down or kept in step.
 *
 * ⚠️ A WYE IS SKIPPED, NOT FLAGGED. `divergeSideForHand` returns 0 for a wye:
 * it has no hand and throws both ways, so it can meet a siding on either side
 * and contradicts nothing. Treating 0 as a side would report a conflict against
 * every ordinary turnout it was paired with.
 */
export function sidingHandConflicts(s: {
  extraTracks: { id: string; fromPos: number; toPos: number }[];
  turnouts: {
    id: string;
    pos: number;
    kind?: TurnoutKind | null;
    onTrack?: string | null;
    divergeTrack?: string | null;
    /** ⚠️ `null`/absent means "never stated, derive"; only a real boolean is the
     * owner speaking (#379). Passed through untouched — never coerced. */
    flipped?: boolean | null;
  }[];
}): Map<string, SidingHandConflict> {
  const out = new Map<string, SidingHandConflict>();
  for (const t of s.extraTracks) {
    // A route drawn along its own path has no direction to sign.
    if (t.fromPos === t.toPos) continue;
    const feeding = s.turnouts.filter((sw) => sw.divergeTrack === t.id);
    // Group by host: the pair that makes a passing siding stands on ONE track.
    // A mid-siding spur's turnout sits on the siding itself, not the main, so
    // it groups separately and never pollutes the pair.
    for (const host of new Set(feeding.map((sw) => sw.onTrack ?? ""))) {
      const pair = feeding
        .filter((sw) => (sw.onTrack ?? "") === host)
        .sort((x, y) => x.pos - y.pos);
      // Exactly two ends is what a passing siding is. One is a spur; three or
      // more is a ladder, and neither carries this constraint.
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      if (a.pos === b.pos) continue;
      // ⭐⭐ ASK THE PACKAGE WHICH WAY THE TURNOUT FACES — never re-derive it.
      // `turnoutFacing` is where `flipped` is applied, and #379 settled that it
      // is applied EXACTLY ONCE: an owner who has ticked Rotate has PINNED the
      // facing, and raw geometry no longer gets a vote. Working the direction
      // out from the track's ends here would give a second answer that
      // disagrees with the drawing on precisely the modules where the owner has
      // been most explicit.
      //
      // The far end is whichever of the track's ends is further from this
      // turnout — not always `toPos`: at a siding's east end `toPos` IS its own
      // position, which would sign zero.
      const towardOf = (sw: (typeof pair)[number]) =>
        turnoutFacing({
          pos: sw.pos,
          divergeFarPos:
            Math.abs(t.fromPos - sw.pos) >= Math.abs(t.toPos - sw.pos) ? t.fromPos : t.toPos,
          flipped: sw.flipped,
        });
      const sideA = divergeSideForHand(a.kind ?? "right", towardOf(a));
      const sideB = divergeSideForHand(b.kind ?? "right", towardOf(b));
      // 0 is a wye — no hand, no opinion, nothing to contradict.
      if (sideA === 0 || sideB === 0) continue;
      if (sideA === sideB) continue;
      out.set(t.id, {
        a: { id: a.id, kind: a.kind ?? "right", pos: a.pos, side: sideA },
        b: { id: b.id, kind: b.kind ?? "right", pos: b.pos, side: sideB },
      });
    }
  }
  return out;
}
