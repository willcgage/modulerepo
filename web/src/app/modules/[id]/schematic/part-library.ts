import {
  BUILT_IN_TRACK_PARTS,
  mergeImportedParts,
  mergeStoredParts,
  parseXtpLibrary,
  type StoredTrackPart,
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
 * The library as it stands for this request: the admin-maintained parts folded
 * over the compiled-in ones.
 *
 * This is the SAME library, not a second one — the `track_parts` table was
 * seeded from these built-ins, so a stored row is the built-in as an admin has
 * since corrected it, and it wins. With no stored parts (or an unreachable
 * table) this is exactly `PART_LIBRARY`, so turnouts still draw.
 */
export function partLibraryWith(stored: StoredTrackPart[] | null | undefined): TrackPart[] {
  return stored?.length ? mergeStoredParts(stored, PART_LIBRARY) : PART_LIBRARY;
}

/**
 * The part a turnout should be DRAWN as — only ever one it NAMES.
 *
 * ⚠️ There is deliberately NO fallback to matching the frog number. An earlier
 * version had one, so any #7 in any module drew the fixture outline above — and
 * that outline is hand-built, not measured. That put invented geometry in front
 * of owners looking like real part data. Until parts come from a real import,
 * an outline appears only where someone explicitly bound one.
 *
 * When real libraries arrive this stays explicit anyway: several parts can share
 * a frog number, so guessing from `size` would pick one arbitrarily.
 */
export function drawablePartFor(
  partId: string | null | undefined,
  _size: number | null | undefined,
  library: TrackPart[] = PART_LIBRARY,
): TrackPart | null {
  if (!partId) return null;
  const named = library.find((p) => p.id === partId);
  return named?.segments?.length ? named : null;
}

/** Parts that actually carry an outline, so the inspector only offers choices
 * that change what is drawn. Naming a part with no geometry would look like a
 * setting that does nothing. */
export const DRAWABLE_PARTS: TrackPart[] = PART_LIBRARY.filter(
  (p) => p.segments?.length,
);
