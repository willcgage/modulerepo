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

/**
 * The parts an owner can name on a turnout, grouped by manufacturer (#187).
 *
 * ⚠️ This replaces `DRAWABLE_PARTS`, which filtered to parts carrying an
 * imported OUTLINE (`segments`). Only the hand-built dev fixture above has one,
 * so **exactly one entry was ever offered** — the fixture, not any of the
 * measured parts. Will: *"I gave you more than 1 turnout with measurements …
 * but there is still only one that is in the list."*
 *
 * That filter was defensible when an outline was all a part contributed. It
 * isn't any more: a part also supplies its **lead** and its **extent** — where
 * the moulding stops and the owner's flex track begins (#189) — and those are
 * what every measured part has. So the test is now "does naming this change
 * anything that gets drawn", which is still an honest bar: it keeps out a part
 * that is only a name.
 *
 * Takes the LIVE library, not the compiled-in constant. The old export was a
 * module-level array built from `PART_LIBRARY`, so a part an admin added at
 * `/admin/track-parts` could never appear in the picker — the whole supply side
 * was invisible to the consumption side.
 */
export function selectableParts(library: TrackPart[] = PART_LIBRARY): TrackPart[] {
  const affectsDrawing = (p: TrackPart) =>
    !!p.segments?.length ||
    // A FROG NUMBER counts. Naming a part adopts its frog number (#187), and
    // that drives the drawn angle, the lead and where the flex begins — so a
    // part identified only by its number is still a real choice, and excluding
    // it would hide a part an owner is holding. (The Atlas 2057 wye used to be
    // the example here; both wyes are fully measured as of #180, so the rule now
    // earns its keep on whatever gets added next rather than on a live case.)
    p.frogNumber != null ||
    !!p.lead ||
    !!p.pointsOffset ||
    !!p.frogOffset ||
    !!p.overallLength ||
    !!p.outerRadius ||
    !!p.innerRadius;
  // ⚠️ CROSSOVERS ARE EXCLUDED, and not as an oversight. This picker sets
  // `partId` on ONE turnout, and a crossover is an ASSEMBLY — two turnouts plus
  // the diagonal, sold as a single fixture. Offering it here would let a lone
  // turnout claim the 10.07″ length of the whole crossover and read, in a field
  // asking "which switch is this?", as an answer that isn't a switch. The parts
  // are in the library for the canvas's own crossover tool to use; they just
  // aren't a single turnout's identity.
  return library.filter(
    (p) => p.kind !== "flex" && p.kind !== "crossover" && affectsDrawing(p),
  );
}

/**
 * The crossover products a connector can name — the assemblies deliberately
 * kept out of {@link selectableParts}, which answers "which switch is this?".
 *
 * A crossover names its product on the CONNECTOR because the fixture that set
 * its angle also set its track spacing, and that spacing belongs to the pair of
 * tracks rather than to either turnout. Naming one is what lets the physical
 * view draw the pair at the spacing it was really built to (#180).
 */
export function crossoverParts(library: TrackPart[] = PART_LIBRARY): TrackPart[] {
  return library
    .filter((p) => p.kind === "crossover")
    .sort((a, b) => (a.frogNumber ?? 0) - (b.frogNumber ?? 0));
}

/** {@link selectableParts}, grouped for a manufacturer-then-part picker. */
export function partsByManufacturer(
  library: TrackPart[] = PART_LIBRARY,
): { manufacturer: string; parts: TrackPart[] }[] {
  const groups = new Map<string, TrackPart[]>();
  for (const p of selectableParts(library)) {
    const list = groups.get(p.manufacturer) ?? [];
    list.push(p);
    groups.set(p.manufacturer, list);
  }
  return [...groups.entries()]
    .map(([manufacturer, parts]) => ({
      manufacturer,
      // Frog number ascending, so a manufacturer's range reads in order; parts
      // without one (curved turnouts) sort last by name.
      parts: parts.sort(
        (a, b) =>
          (a.frogNumber ?? Infinity) - (b.frogNumber ?? Infinity) ||
          a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));
}
