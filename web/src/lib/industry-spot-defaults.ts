/**
 * Which track a NEW car-spot should default to (#421).
 *
 * ⛔ THE DEFAULT THIS REPLACES WAS `state.extraTracks[0]` FLAT — the first extra
 * track on the module, whatever it happened to be, regardless of what the
 * industry already works. On FMN-0083 that silently put a grain elevator's spot
 * on the passing siding; Will, seeing it: *"that is strange to call it a siding
 * technically."* It is worse when the industry is itself on the first extra
 * track, because then "+ Add track" hands back the track the industry is
 * already on — a second span on one rail, which is not what adding a *track*
 * means.
 *
 * ⭐ A spot exists to name ANOTHER track this industry works, so the default is
 * the first track it is not already on. Falling back to a repeat only when it
 * is already on all of them, because a control that does nothing is worse than
 * one that picks imperfectly — the owner can change it, and now there is a
 * side control beside it to change too.
 *
 * ⭐ This is a DEFAULT the app picks for an object it is creating, not an
 * authored value, so choosing it well is the app's business (#342/#344 — see
 * [[flagged-never-corrected]] for where that stops).
 */
export function defaultSpotTrack(
  industry: { track: string; spots?: { track: string }[] },
  extraTracks: readonly { id: string }[],
): string {
  const used = new Set([
    industry.track,
    ...(industry.spots ?? []).map((s) => s.track),
  ]);
  return (
    extraTracks.find((t) => !used.has(t.id))?.id ??
    extraTracks[0]?.id ??
    industry.track
  );
}
