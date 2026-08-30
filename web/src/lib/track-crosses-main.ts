/**
 * Does a track sit on the far side of Main 2 from the main it diverges off?
 * (#386)
 *
 * Pure and on its own, like `track-adrift` and `siding-hands`: the builder is
 * 8,000 lines and a rule buried in it can only be exercised by copying it.
 */

export type StrandedTrack = {
  /** The track's own lane, and the main it has to cross to be reached. */
  lane: number;
  main2Lane: number;
  /** The turnouts that open it — all of them sit on the far side. */
  turnoutIds: string[];
};

/**
 * Tracks whose throat must cross Main 2 to reach them (#386).
 *
 * ⛔ THE APP PUT THEM THERE. `nextLane` started at lane 2 on a double-track
 * module, so every siding and spur was placed BEYOND Main 2 (lane ±1) while
 * still diverging from Main 1 on the centre line. Will, on FMN-0085: *"the 2D
 * has the siding crossing over the two mainlines. That is incorrect."* He was
 * right, and it was not a drawing fault — `moduleFeatures` really did resolve
 * `sid1` to lane 4 with `divergesFromLane: 0`, Main 2 at lane 1 between them.
 *
 * ⭐ WHY IT IS FLAGGED RATHER THAN MOVED. A lane is not exposed anywhere in the
 * UI, so an owner cannot correct one — but it is also the only record of where
 * they put the track, and silently restacking it could move a siding they have
 * already dimensioned and filled with industries. So this SAYS SO, names the
 * remedy, and changes nothing ([[flagged-never-corrected]]).
 *
 * ⚠️ Only a track diverging from the OPPOSITE side of Main 2 is stranded. One
 * that hangs off Main 2 itself is reached without crossing anything and is
 * perfectly ordinary — a team track off the second main, say. The test is
 * therefore about the HOST's lane, not just the track's.
 */
export function tracksStrandedAcrossMain2(s: {
  extraTracks: { id: string; lane: number }[];
  turnouts: { id: string; onTrack?: string | null; divergeTrack?: string | null }[];
  configA?: string;
  configB?: string;
  mainsSwapped?: boolean;
}): Map<string, StrandedTrack> {
  const out = new Map<string, StrandedTrack>();
  const isDouble = s.configA === "double" || s.configB === "double";
  if (!isDouble) return out;
  // Mirrors the package's `main2Track`: +1, or -1 when the mains are swapped.
  const main2Lane = s.mainsSwapped ? -1 : 1;
  for (const t of s.extraTracks) {
    // Same side as Main 2, and further out than it.
    if (Math.sign(t.lane) !== Math.sign(main2Lane)) continue;
    if (Math.abs(t.lane) <= Math.abs(main2Lane)) continue;
    // Reached from Main 1 (the centre line) — so the throat crosses Main 2. A
    // track fed from Main 2 itself never crosses anything.
    const feeding = s.turnouts.filter((sw) => sw.divergeTrack === t.id);
    if (!feeding.length) continue;
    if (!feeding.every((sw) => (sw.onTrack ?? "") !== "main2")) continue;
    out.set(t.id, { lane: t.lane, main2Lane, turnoutIds: feeding.map((sw) => sw.id) });
  }
  return out;
}
