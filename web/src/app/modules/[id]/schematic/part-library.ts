import {
  BUILT_IN_TRACK_PARTS,
  mergeImportedParts,
  parseXtpLibrary,
  type TrackPart,
} from "@willcgage/module-schematic";

/**
 * ⚠️ DEV FIXTURE — not real product data, and not a place to accumulate parts.
 *
 * We deliberately redistribute no XTrkCAD `.xtp` content: those files ship with
 * a GPL program, carry individual attribution and no license of their own. This
 * is a hand-built record in the same shape, here only so the outline renderer
 * has something to draw before an owner supplies their own file. Replace this
 * whole module with a real import path (a per-user store, see modulerepo#180) —
 * do NOT grow it into a bundled library.
 *
 * The geometry is a plausible Atlas #7, not a measurement. Its part number
 * matches the built-in 2052, so `mergeImportedParts` folds it into that entry
 * rather than appending — which also means it can only contribute the outline:
 * every dimension the built-in already holds wins.
 */
const FIXTURE_XTP = [
  'TURNOUT N "Atlas\t#7 LH Switch\t2052"',
  "\tE 0.000000 0.000000 270.000000",
  "\tE 6.000000 0.000000 90.000000",
  "\tE 6.000000 0.625000 81.818182",
  "\tS 0 0.000000 0.000000 0.000000 6.000000 0.000000",
  "\tC 0 0.000000 -18.176138 0.353124 18.176138 171.818106 8.181970",
  "\tS 0 0.000000 2.938900 0.184880 6.000000 0.625000",
  "\tEND",
].join("\n");

/** The parts MR draws with: our measured built-ins plus any imported outlines. */
export const PART_LIBRARY: TrackPart[] = mergeImportedParts(
  parseXtpLibrary(FIXTURE_XTP),
  BUILT_IN_TRACK_PARTS,
  "dev fixture",
);

/**
 * The part a turnout should be DRAWN as.
 *
 * An explicit `partId` always wins — that is the real binding. Absent one, fall
 * back to a part with the same frog number that actually carries an outline, so
 * existing turnouts pick up real geometry without every module needing to be
 * re-authored. ⚠️ That fallback is a convenience of the fixture stage; once
 * owners import their own libraries, several parts may share a frog number and
 * the choice has to become explicit.
 */
export function drawablePartFor(
  partId: string | null | undefined,
  size: number | null | undefined,
  library: TrackPart[] = PART_LIBRARY,
): TrackPart | null {
  if (partId) {
    const named = library.find((p) => p.id === partId);
    return named?.segments?.length ? named : null;
  }
  if (size == null) return null;
  return (
    library.find(
      (p) => p.kind === "turnout" && p.frogNumber === size && p.segments?.length,
    ) ?? null
  );
}
