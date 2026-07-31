"use client";

import { partsByManufacturer, crossoverParts } from "./part-library";
import { FROG_NUMBERS } from "./track-palette";
import { RebuildAsPieces } from "./rebuild-as-pieces";

/**
 * The frog number a turnout gets when NOBODY WAS ASKED — the Objects list's
 * "+ Turnout", and the transition turnout the app derives when a drawn second
 * main is snapped onto an endplate. Both create a turnout with no gesture that
 * could have named a part.
 *
 * ⭐ IT IS NO LONGER A CONTROL (#198 step 5). The `Turnout #` dropdown that used
 * to hold this went with the one palette: every turnout an owner places
 * deliberately now says its own frog number on the button they clicked, and a
 * second control that could disagree with the part is a contradiction you could
 * author. #6 because that is the standard's floor for a main line — and the
 * turnout inspector's own size field is right there to change it.
 */
const DEFAULT_TURNOUT_SIZE = 6;
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  MAIN_TRACK_ID,
  MAIN2_TRACK_ID,
  stateToDoc,
  implicitCrossings,
  type ImplicitCrossing,
  docToState,
  graphToDoc,
  docToGraph,
  deriveGraphDoc,
  type ConversionAnswers,
  type TrackPiece,
  buildTransition,
  buildCrossover,
  isTransitionTurnout,
  deriveEndplatePoses,
  endplateEdgePose,
  type EndplatePose,
  poseNeedsManual,
  moduleFootprint,
  endplateCentreOffsetInches,
  endplateTrackOffsetInches,
  pathLengthInches,
  measuredAlongPath,
  checkEndplateWidth,
  flexPieces,
  flexUsage,
  flexParts,
  flexPartFor,
  maxFlexPieceInches,
  resizeFlexPiece,
  turnoutFacing,
  turnoutOccupiedSpan,
  spanOverhang,
  assessSectionEnd,
  assessSectionJoint,
  usableCapacity,
  FREEMO_TRACK_SPACING_INCHES,
  partExtent,
  partExtentForSize,
  DEFAULT_FLEX_PART_ID,
  type FlexPiece,
  type TrackPart,
  type TrackConfig,
  nextId,
  carCapacity,
  type BenchworkPoint,
  type EditorState,
  type TrackRole,
  type TurnoutKind,
  type SignalFacing,
  type IndustryLabelMode,
  moduleLengthFromSections,
  sectionBreaksFromSections,
  sectionBand,
  sectionAdjacency,
  sectionSpansOrWhole,
  remapPos,
  sectionNeighbours,
  sectionComponents,
  sectionSpans,
  endplateLead,
  type SchematicSection,
} from "@/lib/module-schematic";
import { snapPoseToOutline, sampleAt } from "@/lib/physical-track";
import { partLibraryWith } from "./part-library";
import { endplateTrackPoints, startJointsFor } from "./piece-layer";
import type { StoredTrackPart } from "@willcgage/module-schematic";
import {
  returnLoop,
  type ReturnLoopShape,
  FREEMO_ENDPLATE_WIDTH_RECOMMENDED_INCHES,
  FREEMO_MAIN_MIN_RADIUS_INCHES,
} from "@/lib/module-schematic";
import { SchematicPreview } from "./schematic-preview";
import {
  BenchworkEditor,
  type CanvasSelection,
  type CanvasTool,
  type CanvasIndustry,
} from "./benchwork-editor";
import {
  saveModuleSchematic,
  updateModuleDimensions,
  type ModuleDimensions,
} from "./actions";
import { submitCarTypeSuggestion } from "../../new/actions";

type CarTypeOption = { value: string; display_label: string };

// NB: a local `CAR_INCHES = 3.3` used to live here, duplicating the package's
// `N_CAR_LENGTH_INCHES` — whose own comment calls it "the single constant every
// repo reads so a track's car count matches everywhere". Capacity now comes from
// `usableCapacity`, which uses that constant, so the copy is gone (#19/#20).

const inp =
  "block w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const addBtn =
  "rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50";
const xBtn = "text-xs font-medium text-red-600 hover:underline";

const ROLE_OPTIONS: { value: TrackRole; label: string }[] = [
  { value: "siding", label: "Passing siding" },
  { value: "spur", label: "Industry spur" },
  { value: "yard", label: "Yard track" },
];
const KIND_OPTIONS: { value: TurnoutKind; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "wye", label: "Wye" },
];

/**
 * What's selected. A superset of what the CANVAS can hit: crossings and control
 * points have no shape (a control point is a named *group*), so they're selected
 * from the Objects list instead. One selection drives one inspector either way.
 */
type Selection =
  | CanvasSelection
  | { kind: "crossing"; id: string }
  | { kind: "cp"; id: string }
  // A length of flex track (#193) — identified by its run and its place along
  // it, because that IS what a piece is: the stretch between two joints.
  | { kind: "flex"; id: string; index: number };

const isCanvasSel = (s: Selection | null): s is CanvasSelection =>
  s !== null &&
  (s.kind === "corner" ||
    s.kind === "turnout" ||
    s.kind === "track" ||
    s.kind === "endplate" ||
    s.kind === "industry" ||
    s.kind === "cp" ||
    s.kind === "piece");

export function SchematicEditor({
  moduleId,
  recordNumber,
  moduleName,
  initial,
  newModule = false,
  readOnly = false,
  lockedConfigs = { a: false, b: false },
  geometries = [],
  industryTypes = [],
  carTypes = [],
  initialDimensions,
  storedParts = [],
}: {
  moduleId: number;
  recordNumber: string;
  moduleName: string;
  initial: EditorState;
  hadSchematic: boolean;
  newModule?: boolean;
  /** Inspect-only: an ADMIN viewing a module they don't own. Every mutation is
   * inert and nothing is ever saved (the server actions are owner-only too). */
  readOnly?: boolean;
  /** True when the module's endplate records define the config — the selects
   * mirror them read-only (edit endplates on the module page instead). */
  lockedConfigs?: { a: boolean; b: boolean };
  /** Geometry choices from the lookup table (which need degrees / offset). */
  geometries?: {
    value: string;
    display_label: string;
    requires_degrees: boolean;
    requires_offset_inches: boolean;
  }[];
  /** Industry type choices for the industry inspector. */
  industryTypes?: { value: string; display_label: string }[];
  /** Car type choices for the industry inspector's multiselect. */
  carTypes?: { value: string; display_label: string }[];
  /** The module's geometry + lengths — editable here, since they size the board. */
  initialDimensions: ModuleDimensions;
  /** The stored track/turnout parts library, loaded per request. Turnouts are
   * drawn at their part's measured dimensions, so this is what an admin adding
   * a part changes. Absent = the compiled-in built-ins. */
  storedParts?: StoredTrackPart[];
}) {
  const [state, setState] = useState<EditorState>(initial);
  /**
   * ⭐⭐ HAS A PERSON ACTUALLY EDITED THIS MODULE? (#222)
   *
   * Autosave used to fire on "the serialisation differs", which is not the same
   * question and nearly cost FMN-0078 its crossover: `docToState` rounded the
   * authored positions as the module LOADED, the derived doc therefore didn't
   * match the stored one, and a write was scheduled a second later with nobody
   * having touched anything (#220). It landed before the undo stack existed, so
   * the app's own safety net couldn't reach it and the module needed SQL.
   *
   * That rounding is fixed, but the rule that turned it into data loss was the
   * general one. **A difference is not a reason to write.** Every mutation entry
   * point sets this — the same four that already guard `readOnly`, plus undo/redo
   * — and the debounce below refuses to schedule anything until one of them has.
   * A load-time transformation now changes what you SEE and waits to be asked.
   */
  const userEdited = useRef(false);
  const markEdited = () => {
    userEdited.current = true;
  };
  /** So the round-trip warning below is said once per module, not once a render. */
  const warnedRoundTrip = useRef(false);
  /** The parts library this board draws with — admin-maintained parts folded
   * over the compiled-in ones (the same library, later). */
  const partLibrary = useMemo(() => partLibraryWith(storedParts), [storedParts]);
  /** What's selected — drives the one inspector on the right. */
  const [selection, setSelection] = useState<Selection | null>(null);
  /** What a canvas background click means. */
  const [tool, setTool] = useState<CanvasTool>("select");
  /** Draw-to-create: a track role armed from the + Track menu, waiting to be
   * drawn on the canvas (#51). null = not placing. */
  const [pendingTrack, setPendingTrack] = useState<"siding" | "spur" | null>(null);
  /** Car-type choices, seeded from the server + grown by suggestions. */
  const [carTypeOptions, setCarTypeOptions] = useState<CarTypeOption[]>(carTypes);
  const addCarTypeOption = (o: CarTypeOption) =>
    setCarTypeOptions((prev) => (prev.some((c) => c.value === o.value) ? prev : [...prev, o]));
  /** The module's geometry + lengths. Editing these reshapes the board live. */
  const [dims, setDims] = useState<ModuleDimensions>(initialDimensions);
  const geometry = useMemo(
    () => ({
      // Fall back to straight for DERIVATION only (#103). A null geometry gives
      // moduleCenterline nothing to work with, and everything keyed off the
      // centre-line — section joints, lane offsets, endplate normals — then
      // silently stops drawing on a board that otherwise looks complete. New
      // modules are created straight now, but plenty already exist with it
      // unset. The Geometry select still binds to the raw value, so the field
      // keeps reading "—" and the owner can see it's theirs to set.
      type: dims.geometry_type || "straight",
      degrees: dims.geometry_degrees ? Number(dims.geometry_degrees) : null,
      offset: dims.geometry_offset_inches ? Number(dims.geometry_offset_inches) : null,
    }),
    [dims],
  );
  const geoSpec = geometries.find((g) => g.value === dims.geometry_type);
  const [error, setError] = useState<string | null>(null);

  // --- Undo / redo -----------------------------------------------------------
  // The whole document is `state` + `dims`, both replaced immutably, so history
  // is just a stack of snapshots. Rapid changes within one gesture (a drag) are
  // coalesced into a single entry so one Ctrl+Z doesn't rewind pixel by pixel.
  type Snap = { state: EditorState; dims: ModuleDimensions };
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const lastEditAt = useRef(0);
  // Mirror the stack depths into state so the undo/redo buttons re-render
  // without reading refs during render (which React forbids).
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const syncHist = () => setHist({ undo: past.current.length, redo: future.current.length });

  const snapshot = () => {
    const now = Date.now();
    const coalesce = now - lastEditAt.current < 450 && past.current.length > 0;
    lastEditAt.current = now;
    if (coalesce) return; // same gesture — fold into the existing entry
    past.current = [...past.current.slice(-99), { state, dims }];
    future.current = [];
    syncHist();
  };
  const restore = (snap: Snap) => {
    // Undo and redo ARE user edits — putting a module back the way it was is a
    // decision that has to persist (#222). Nothing else here reaches `restore`.
    markEdited();
    setState(snap.state);
    setDims(snap.dims);
    lastEditAt.current = 0; // the next edit starts a fresh history entry
  };
  const undo = useCallback(() => {
    const prev = past.current[past.current.length - 1];
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, { state, dims }];
    restore(prev);
    syncHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dims]);
  const redo = useCallback(() => {
    const next = future.current[future.current.length - 1];
    if (!next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, { state, dims }];
    restore(next);
    syncHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dims]);

  const doc = useMemo(() => stateToDoc(state, recordNumber), [state, recordNumber]);
  /** Crossings the drawing implies and the document never declared — a spur
   * thrown past Main 2 is drawn straight through it, and that is a diamond
   * somebody has to build (Will, 2026-07-30). Flagged, never created: crossing
   * geometry isn't modelled yet, so inventing the part would be inventing
   * measurements nobody took. */
  const undeclaredCrossings = useMemo(() => implicitCrossings(doc), [doc]);
  const isDouble = state.configA === "double" || state.configB === "double";
  // Derived endplate poses (#175 phase 1b) — the auto-computed geometry the
  // owner can override for shapes the fields can't express (wye/loop/other).
  const derivedPoses = useMemo(
    () =>
      deriveEndplatePoses({
        lengthInches: state.lengthInches,
        geometryType: geometry.type,
        geometryDegrees: geometry.degrees,
        geometryOffsetInches: geometry.offset,
        // ⚠️ Pass "none" THROUGH. This used to coerce it to "single", which is
        // the same coercion the package used to do — so a single-ended module
        // still derived a pose for a plate it hasn't got, and endplate B stayed
        // in the Objects list after the owner removed it (#184).
        endplateConfigs: [state.configA, state.configB],
        branches: state.branches.map((b, i) => ({
          id: String.fromCharCode(67 + i),
          atPos: b.pos,
          side: b.side,
          config: b.config,
        })),
        // The module's real end is where its boards finish (#108) — without
        // this, endplate B sits where a straight module of this length would
        // have ended, not at the end of the chain.
        sections: state.sections,
        // A balloon/return loop turns back on itself — one endplate (A), no
        // spurious far B at the throat where the loop closes (#loop).
        loop: state.loop,
        // How deep the board is, so a BRANCH endplate lands on the benchwork
        // edge rather than on the centre line — a side-facing plate buried
        // mid-board is a place no train can leave from.
        endplateWidths: state.endplateWidths,
        // ⭐ An endplate BOUND TO A BENCHWORK EDGE (ADR 0001) reads its position,
        // heading and width off the board, so they cannot drift apart from it.
        // Wins over a pose, and — unlike a pose — keeps following the board when
        // its shape changes.
        endplateEdges: state.endplateEdges,
        outline: state.outline,
        poseOverrides: state.poseOverrides,
      }),
    [state, geometry],
  );
  const wantsManualPose = poseNeedsManual(geometry.type) || state.loop;
  // Where each plate's CENTRE sits relative to its track point, in inches —
  // the renderer's framing, the negation of the authored offset. Unauthored
  // ends fall back to Free-moN §2.0's recommendation: a single end centred, a
  // double end straddling the centre at ∓ half the 1.125″ track spacing.
  const renderTrackOffsets = useMemo(() => {
    // Main 2 sits above Main 1 by default, below when swapped (#131). A double
    // end's plate centre is the midpoint of the two mains, so its default
    // follows Main 2's side. An OWNER-authored offset always wins. The rule
    // itself lives in the package, so this view and the read-only one can't
    // drift apart again (#190).
    const off = (config: "single" | "double" | "none", authored?: number) =>
      endplateCentreOffsetInches({
        config,
        authoredTrackOffsetInches: authored,
        main2Below: state.mainsSwapped === true,
      });
    return {
      A: off(state.configA, state.endplateTrackOffsets.A),
      B: off(state.configB, state.endplateTrackOffsets.B),
    };
  }, [state.configA, state.configB, state.endplateTrackOffsets, state.mainsSwapped]);
  // The real physical module — its centre-line drives where track, turnouts and
  // signals actually sit on the board (not just in the straightened view).
  const mainDrawn = state.mainPath.length >= 2;
  const footprint = useMemo(
    () =>
      moduleFootprint({
        lengthInches: state.lengthInches,
        geometryType: geometry.type,
        geometryDegrees: geometry.degrees,
        geometryOffsetInches: geometry.offset,
        endplateWidths: state.endplateWidths,
        endplateTrackOffsets: renderTrackOffsets,
        outline: state.outline,
        // Shaped sections take over as the module's footprint (#96 phase 2);
        // authoring them per-section is 2b, this just keeps the derived
        // footprint honest for docs that already carry them.
        sections: state.sections,
        mainPath: state.mainPath,
        // A loop's centre-line ends at the throat — no far endplate face there.
        loop: state.loop,
        // …and neither does an end of the line / pocket, which presents one face
        // and stops. Without this the board drew a plate at an end it hasn't got
        // (#191).
        endplateConfigs: [state.configA, state.configB],
      }),
    [
      state.lengthInches,
      state.endplateWidths,
      renderTrackOffsets,
      state.outline,
      state.sections,
      state.mainPath,
      state.loop,
      state.configA,
      state.configB,
      geometry,
    ],
  );
  // When the mainline is drawn, BOTH endplates follow the track's tangent: A
  // faces back along the start tangent (outward = west for a straight), B sits
  // at the path's end facing the final tangent — so both endplate faces and the
  // layout joins follow the drawn shape (not just B).
  const poses = useMemo(() => {
    if (!mainDrawn) return derivedPoses;
    const c = footprint.centerline;
    if (c.length < 2) return derivedPoses;
    const deg = (dx: number, dy: number) => (Math.atan2(dy, dx) * 180) / Math.PI;
    const start = c[0];
    const startNext = c[1];
    const aHeading = deg(start.x - startNext.x, start.y - startNext.y); // outward
    const end = c[c.length - 1];
    const prev = c[c.length - 2];
    const bHeading = deg(end.x - prev.x, end.y - prev.y);
    return derivedPoses.map((p) =>
      p.id === "A"
        ? { ...p, x: start.x, y: start.y, heading: aHeading }
        : p.id === "B"
          ? { ...p, x: end.x, y: end.y, heading: bHeading }
          : p,
    );
  }, [mainDrawn, derivedPoses, footprint]);

  /** Everything except the main itself — the main IS the centre-line. */
  const canvasTracks = useMemo(() => {
    // Where each spur meets the main — the pos of the turnout diverging to it.
    const throatOf = new Map<string, number>();
    for (const tn of state.turnouts) if (tn.divergeTrack) throatOf.set(tn.divergeTrack, tn.pos);
    return (doc.tracks ?? [])
      .filter((t) => t.id !== MAIN_TRACK_ID)
      .map((t) => {
        const et = state.extraTracks.find((x) => x.id === t.id);
        return {
          id: t.id,
          lane: t.lane ?? 1,
          fromPos: t.fromPos ?? 0,
          toPos: t.toPos ?? state.lengthInches,
          // Sidings/spurs are the owner's to place; Main 2 is derived.
          editable: !!et,
          // Where the spur's throat snaps (its turnout on the main), + its
          // authored 2-D path when drawn (#2d-track stage C).
          throatPos: throatOf.get(t.id),
          // ⭐ ANY TRACK THAT WAS DRAWN DRAWS AS DRAWN — mains included (Will,
          // 2026-07-30). `et` is an `extraTracks` lookup and Main 2 is a MAIN,
          // so it never matched: a bent Main 2 was stored, its length was read
          // back into the inspector, and the canvas quietly drew the derived
          // lane body instead. The handles looked dead and the document drifted
          // away from the picture with nothing on screen to show it.
          path: t.id === MAIN2_TRACK_ID && state.main2Path.length >= 2
            ? state.main2Path
            : et?.path,
          // The canvas needs BOTH to work out a crossover pinch (#180): the role
          // says which tracks are crossovers, and the part says what spacing it
          // was built to. Dropping either here is silent — `crossoverPinches`
          // simply finds nothing and the pair draws parallel, which is
          // indistinguishable from an owner who hasn't named a product.
          role: t.role,
          crossoverPartId: et?.crossoverPartId ?? t.crossoverPartId ?? undefined,
        };
      });
  }, [doc, state.lengthInches, state.extraTracks, state.turnouts, state.main2Path]);
  /**
   * The two mains as list entries. They aren't `extraTracks` — the main IS the
   * module's centre-line — so the Objects pane has to be told about them
   * explicitly, and #185's shortcut row wasn't a real selectable object (#192).
   *
   * How long each main is: its DRAWN path when the owner has bent one, otherwise
   * the derived run. Main 2's derived extent is whatever `stateToDoc` worked out
   * from the transition turnouts, so read it off the doc rather than guessing.
   */
  const mainRows = useMemo(() => {
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const m2 = (doc.tracks ?? []).find((t) => t.id === MAIN2_TRACK_ID);
    const m1 = (doc.tracks ?? []).find((t) => t.id === MAIN_TRACK_ID);
    const entry = (
      id: string,
      label: string,
      drawn: boolean,
      lengthInches: number,
      lane: number,
      from: number,
      to: number,
    ) => ({
      id,
      label,
      drawn,
      lengthInches: round1(lengthInches),
      lane,
      fromPos: round1(from),
      toPos: round1(to),
      sub: `${round1(lengthInches)}″ · ${drawn ? "drawn" : "derived"}`,
    });
    const rows = [
      entry(
        MAIN_TRACK_ID,
        isDouble ? "Main 1" : "Main",
        mainDrawn,
        mainDrawn ? pathLengthInches(state.mainPath) : state.lengthInches,
        m1?.lane ?? 0,
        0,
        state.lengthInches,
      ),
    ];
    if (isDouble && m2) {
      const bent = state.main2Path.length >= 2;
      const from = m2.fromPos ?? 0;
      const to = m2.toPos ?? state.lengthInches;
      rows.push(
        entry(
          MAIN2_TRACK_ID,
          "Main 2",
          bent,
          bent ? pathLengthInches(state.main2Path) : to - from,
          m2.lane ?? 1,
          from,
          to,
        ),
      );
    }
    return rows;
  }, [doc, isDouble, mainDrawn, state.mainPath, state.main2Path, state.lengthInches]);
  /**
   * Every run cut into lengths of flex track (#193).
   *
   * Everything that isn't a turnout or a crossing is flex, and flex comes in
   * pieces with a maximum — 30″ Atlas, 36″ Micro Engineering. So a 96″ main is
   * four lengths with three rail joints in it, and this is what says where they
   * fall and how much to buy.
   *
   * Derived until the owner touches one, which is what lets every module that
   * already exists arrive already cut up without anyone re-authoring a thing.
   */
  const flexByTrack = useMemo(() => {
    const tracks = doc.tracks ?? [];
    // Where each track ends up, for the facing rule — the end of a diverging
    // track furthest from its turnout is the way that turnout points.
    const extentOf = (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (!t) return null;
      return { from: t.fromPos ?? 0, to: t.toPos ?? state.lengthInches };
    };
    /**
     * How much track a run actually IS. A DRAWN run is as long as the line the
     * owner drew — the same number its Objects row reports (#192) — not the
     * stretch of module its endpoints claim. FMN-0043's Main 2 is drawn 15.2″
     * but its record says it reaches a turnout at 17.4″, and cutting to the
     * record put "15.2″ · drawn" next to a 17.4″ piece: two lengths for one
     * track. The drawn line is the physical truth, so it wins.
     *
     * A run measured along its OWN path (a route across the board) never gets
     * here — it is parameterised in route-local inches below, where 0 is its
     * throat rather than endplate A.
     */
    const runLengthOf = (id: string, ext: { from: number; to: number }) => {
      const posExtent = Math.abs(ext.to - ext.from);
      const et = state.extraTracks.find((x) => x.id === id);
      const drawn =
        id === MAIN_TRACK_ID
          ? state.mainPath
          : id === MAIN2_TRACK_ID
            ? state.main2Path
            : et?.path;
      const len = drawn && drawn.length >= 2 ? pathLengthInches(drawn) : 0;
      return len > 0 ? len : posExtent;
    };
    const out: Record<
      string,
      {
        pieces: ReturnType<typeof flexPieces>;
        partId: string;
        authored: boolean;
        runInches: number;
        /** True when this run's positions are arc length along its own drawn
         * path rather than inches from endplate A — see {@link measuredAlongPath}.
         * The canvas needs it to place the joints: a route-local cut is already
         * an arc length on the polyline it draws, so projecting it back onto the
         * main (what `toHostRel` does) would collapse it to nothing. */
        alongPath: boolean;
        /** Set when the run was deliberately left uncut because something sits
         * on it whose position cannot be expressed in this run's frame. */
        unmapped: boolean;
      }
    > = {};
    for (const t of tracks) {
      const claimed = extentOf(t.id)!;
      /**
       * ⭐⭐ WHICH AXIS THIS RUN IS MEASURED ALONG (#226).
       *
       * A route to a third endplate crosses the board, so the stretch of MODULE
       * it covers is degenerate — FMN-0068's runs 27.8 → 27.8 — and cutting it
       * against that axis asks `flexPieces` for the joints in a zero-length run,
       * which is why it returned none. Its positions are arc length along the
       * line the owner drew: 0 at the throat, `pathLengthInches` at the endplate.
       *
       * ⭐ The two measure the SAME polyline — `pathLengthInches` and the
       * canvas's `hostPointsOf` both go through `samplePath` — so a cut at 30 is
       * 30″ along the drawn route on screen, with no conversion in between.
       */
      const alongPath = measuredAlongPath(t);
      // Measured from the run's start, so a drawn run that stops short of what
      // its record claims is cut to what was actually drawn.
      const ext = alongPath
        ? { from: 0, to: pathLengthInches(t.path) }
        : {
            from: claimed.from,
            to: claimed.from + runLengthOf(t.id, claimed) * (claimed.to < claimed.from ? -1 : 1),
          };
      // What this run gives up to parts. A turnout's moulding is only known for
      // a MEASURED part — `turnoutOccupiedSpan` returns null otherwise, and a
      // guessed body would put a rail joint on track nobody has checked (#189).
      const occupied: { fromPos: number; toPos: number }[] = [];
      for (const sw of state.turnouts) {
        if (sw.onTrack !== t.id) continue;
        const size = sw.size ?? 6;
        // A named part answers for itself, exactly as the tie strip does — the
        // two must agree, or the flex would start somewhere the drawn moulding
        // doesn't end (#187).
        const named = sw.partId ? partLibrary.find((p) => p.id === sw.partId) : undefined;
        const span = turnoutOccupiedSpan({
          pos: sw.pos,
          extent:
            sw.curved || sw.kind === "wye"
              ? null
              : named
                ? partExtent(named)
                : partExtentForSize(size, partLibrary),
          facing: turnoutFacing({
            pos: sw.pos,
            divergeFarPos: (() => {
              const d = sw.divergeTrack ? extentOf(sw.divergeTrack) : null;
              if (!d) return null;
              return Math.abs(d.to - sw.pos) >= Math.abs(d.from - sw.pos) ? d.to : d.from;
            })(),
            flipped: sw.flipped,
          }),
        });
        if (span) occupied.push(span);
      }
      // A crossing breaks the run at a point whose extent nobody has measured —
      // a zero-length span, so it joints the track without eating any of it.
      for (const x of state.crossings)
        if (x.trackA === t.id || x.trackB === t.id)
          occupied.push({ fromPos: x.pos, toPos: x.pos });

      const f = state.flexByTrack?.[t.id];
      const partId = f?.partId ?? DEFAULT_FLEX_PART_ID;
      /**
       * ⛔ NOTHING ON A ROUTE-LOCAL RUN CAN BE POSITIONED ALONG IT — yet.
       *
       * A turnout's `pos` is absolute inches from endplate A (#132, the owner's
       * call), and mapping that onto a route that crosses the board means
       * projecting it back onto the main: the very collapse this frame exists to
       * escape. So the position of anything sitting on such a route is genuinely
       * unknown, and a guessed one would put a rail joint on track nobody has
       * checked (#189). Leave the run uncut and let the panel say why.
       *
       * In practice this is empty — a route to an endplate is a single run from
       * its turnout to the face — so the ordinary case derives.
       */
      const unmapped = alongPath && occupied.length > 0;
      out[t.id] = {
        partId,
        authored: f?.cuts != null,
        alongPath,
        unmapped,
        /**
         * ⭐⭐ ONE COMPUTATION OF "HOW LONG IS THIS RUN" — `ext`, whichever frame
         * it was built in. A route to an endplate used to need its own copy of
         * this, because `ext` was always along the module and always zero for it
         * (#229 fixed the number and left the duplicate). Two computations of one
         * quantity is exactly how that fix missed the Objects row (#230); now the
         * frame is decided once, above, and everything reads it.
         */
        runInches: Math.abs(ext.to - ext.from),
        pieces: unmapped
          ? []
          : flexPieces({
              fromPos: ext.from,
              toPos: ext.to,
              maxPieceInches: maxFlexPieceInches(partId, partLibrary),
              occupied,
              cuts: f?.cuts ?? null,
            }),
      };
    }
    return out;
  }, [
    doc,
    state.turnouts,
    state.crossings,
    state.flexByTrack,
    state.lengthInches,
    state.extraTracks,
    state.mainPath,
    state.main2Path,
    partLibrary,
  ]);

  /**
   * Just the joint positions, for the canvas to draw a tick at each.
   *
   * ⚠️ EACH ENTRY CARRIES THE FRAME ITS POSITIONS ARE IN. A bare `number[]` was
   * fine while every run was measured from endplate A; a route-local cut is arc
   * length along the track's own path, and the two are not interchangeable —
   * feeding one to the other's sampler is silently wrong rather than obviously
   * wrong. Shipping the number without the frame is how a new field reaches the
   * model but not the code that draws it.
   */
  const flexCutsByTrack = useMemo(() => {
    const out: Record<string, { cuts: number[]; alongPath: boolean }> = {};
    for (const [id, f] of Object.entries(flexByTrack)) {
      // Only the joints BETWEEN two pieces of flex — where a piece meets a
      // turnout or a crossing the part already draws its own (#189), and where
      // it meets the end of the run there's an endplate, not a joint.
      const cuts = f.pieces.filter((p) => p.toEnd === "piece").map((p) => p.toPos);
      if (cuts.length) out[id] = { cuts, alongPath: f.alongPath };
    }
    return out;
  }, [flexByTrack]);

  const canvasTurnouts = useMemo(
    () =>
      state.turnouts.map((t) => ({
        id: t.id,
        pos: t.pos,
        size: t.size,
        // The host track (main or a spur) + what it diverges to; the canvas
        // derives the frog geometry from these.
        onTrack: t.onTrack,
        divergeTrack: t.divergeTrack || undefined,
        curved: t.curved,
        flipped: t.flipped,
        partId: t.partId,
        kind: t.kind,
      })),
    [state.turnouts],
  );
  const canvasSignals = useMemo(
    () =>
      state.controlPoints.flatMap((cp) =>
        cp.signals.map((s) => ({
          id: s.id,
          cp: cp.id,
          pos: s.pos,
          side: s.side,
          facing: s.facing,
        })),
      ),
    [state.controlPoints],
  );
  /** Signal (S) tool: drop a block control point with one signal at `pos` on the
   * main, then select it to set direction/side in the inspector (#53). */
  const onDropSignal = (pos: number) => {
    const id = nextId("cp", state.controlPoints.map((c) => c.id));
    patch((s) => {
      s.controlPoints.push({
        id,
        name: "",
        turnouts: [],
        signals: [
          { id: `${id}-AtoB`, pos: Math.round(pos), track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
        ],
      });
    });
    setSelection({ kind: "cp", id });
  };
  // NB: `laneOfTrack` used to live here — a track id → lane map, whose only
  // caller was the industry spans. Those ride their track's own path now (#186),
  // so nothing needs it. Deleted rather than left lying about: it pinned Main 2
  // to lane 1, which is already wrong on a module with the mains swapped (#131),
  // so the next caller to reach for it would have inherited that.
  const canvasIndustries = useMemo<CanvasIndustry[]>(
    () =>
      state.industries.flatMap((ind) => {
        // One render span per spot: the primary track + any house-track spots.
        const spot = (
          id: string,
          track: string,
          fromPos: number,
          toPos: number,
          side: "above" | "below",
          editable: boolean,
        ): CanvasIndustry => {
          const cars = carCapacity(fromPos, toPos);
          const sub =
            ind.labelMode === "cars"
              ? `${cars} cars`
              : ind.labelMode === "inches"
                ? `${Math.round(Math.abs(toPos - fromPos))}″`
                : "";
          return {
            id,
            industryId: ind.id,
            editable,
            // The TRACK, not its lane: the span rides the track's own path, so
            // a curved or hand-drawn spur takes its industry with it (#186).
            track,
            fromPos,
            toPos,
            side,
            name: ind.name,
            sub,
          };
        };
        return [
          spot(ind.id, ind.track, ind.fromPos, ind.toPos, ind.side, true),
          ...(ind.spots ?? []).map((sp, i) =>
            spot(`${ind.id}#${i}`, sp.track, sp.fromPos, sp.toPos, sp.side ?? ind.side, false),
          ),
        ];
      }),
    [state.industries],
  );
  // Track dropdowns show the owner's track name, not the internal id. On a
  // double-track module, Main 2 is a real track — a turnout on it diverges
  // outward instead of drawing a crossover from Main 1 (modulerepo#14).
  const trackOptions = useMemo(
    () => [
      { value: MAIN_TRACK_ID, label: isDouble ? "Main 1" : "Main" },
      ...(isDouble ? [{ value: MAIN2_TRACK_ID, label: "Main 2" }] : []),
      ...state.extraTracks.map((t, i) => ({
        value: t.id,
        label: trackLabel(t, i),
      })),
    ],
    [state.extraTracks, isDouble],
  );

  const patch = (fn: (s: EditorState) => void) => {
    // An admin inspecting someone else's module is READ-ONLY, and the cheapest
    // honest way to mean it is to make every mutation inert at the source: no
    // state change ⇒ the doc signature never moves ⇒ autosave never fires, and
    // every tool, drag and inspector field goes dead without having to be
    // disabled one by one (miss one and autosave writes to an owner's module).
    // The server actions stay owner-only regardless.
    if (readOnly) return;
    markEdited();
    snapshot();
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  /**
   * Re-read this module's tracks and turnouts from its pieces.
   *
   * ⭐⭐ **ONE DERIVATION SITE.** Both the rebuild offer and every later edit go
   * through here, so there is exactly one answer to "what do these pieces mean"
   * and it is the package's own `deriveGraphDoc` — the same function
   * Free-Dispatcher's document comes out of. A second, editor-local derivation
   * would be two things to keep in step, which is the class of bug ADR 0001
   * exists to remove.
   *
   * ⚠️ **A MODULE WITHOUT A GRAPH IS UNTOUCHED.** `deriveGraphDoc` returns the
   * SAME OBJECT when there is no graph, so the 1-D path is not merely preserved
   * but literally not executed — ADR 0001's coexistence, by construction rather
   * than by a flag someone could get wrong.
   *
   * ⚠️ It rebuilds the whole editor state from the derived document. That is
   * safe because `docToState(stateToDoc(s))` is a fixed point — verified against
   * a module carrying benchwork, endplate edge bindings, widths, a spur with an
   * owner's capacity and module_tracks link, an industry and a signal.
   */
  const deriveFromPieces = (s: EditorState): EditorState => {
    if (!s.graph?.pieces?.length) return s;
    const { doc: derived } = deriveGraphDoc(stateToDoc(s, recordNumber), partLibrary);
    return docToState(derived, s.lengthInches);
  };

  /**
   * Lay out the pieces (ADR 0001).
   *
   * ⚠️ `commit` false is a MID-DRAG frame: it must not take an undo snapshot,
   * or one Ctrl+Z rewinds a single pixel of a drag. `patch` coalesces rapid
   * edits, but a drag emits far more than that window forgives.
   *
   * ⭐ On commit the module's tracks and turnouts follow the pieces, through
   * {@link deriveFromPieces}. That is only ever true of a module that IS
   * authored as pieces: without a graph the derivation is not executed at all,
   * so laying a piece still cannot rewrite positional track an owner has drawn.
   * Adopting a graph in the first place remains an explicit, offered act
   * (ADR 0002) — this is what keeps a module in step once it has one.
   */
  const setPieces = (next: TrackPiece[], opts?: { commit?: boolean }) => {
    if (readOnly) return;
    // ⚠️ Marked on EVERY call, not just a commit (#222). Mid-gesture calls
    // deliberately skip `snapshot()` so a drag is one undo entry — but they do
    // change the document, and a drag that ends without a commit would otherwise
    // leave a real edit that could never be saved.
    markEdited();
    if (opts?.commit) snapshot();
    setState((prev) => {
      // ⚠️ The start is DERIVED every time, not remembered. The walk runs one way
      // from it, so a start in the middle of a run reports everything behind it
      // as unreachable — which is what "the first piece laid" gives you the
      // moment a second piece is snapped onto its back.
      const a = poses.find((p) => p.id === "A");
      // ⭐ Both starts come from the ENDPLATE'S TRACK POINTS: a double end has
      // two, and the run meeting the second one is Main 2. Nothing for an owner
      // to declare, and nothing that can contradict what they drew.
      const starts = startJointsFor(next, partLibrary, a ? endplateTrackPoints(a) : []);
      const moved = {
        ...prev,
        graph: next.length && starts ? { pieces: next, ...starts } : undefined,
      };
      // ⭐ ON COMMIT, THE TRACK FOLLOWS THE PIECES. Mid-gesture it does not:
      // a drag emits a position per pointer move, and re-deriving the whole
      // module on each of them would be work nobody sees (the live read-out
      // above the canvas is already showing what the pieces say).
      return opts?.commit ? deriveFromPieces(moved) : moved;
    });
  };

  /**
   * Rebuild this module's 1-D track as pieces (MR #199, ADR 0001 amendment).
   *
   * ⭐ **THE OWNER ASKED FOR IT, AND ONE UNDO PUTS IT BACK.** Unlike
   * {@link setPieces}, this DOES rewrite the module's tracks and turnouts —
   * that is the whole point, and why it can only run from the offer. Storing
   * the graph alone would leave the module drawing its old positional track and
   * the new pieces on top of each other.
   *
   * The derivation is the package's own `deriveGraphDoc`, so the tracks that
   * come out are exactly the ones Free-Dispatcher will read — there is no
   * second, editor-local idea of what the pieces mean.
   */
  const rebuildAsPieces = (answers: ConversionAnswers) => {
    if (readOnly) return;
    const conv = docToGraph(doc, answers, partLibrary);
    if (!conv.graph) return;
    const { doc: derived } = deriveGraphDoc({ ...doc, graph: conv.graph }, partLibrary);
    markEdited();
    snapshot();
    // Straight to `docToState` rather than through {@link deriveFromPieces},
    // because the graph being adopted is not in the state yet — this is the one
    // moment a module acquires one.
    setState(docToState(derived, state.lengthInches));
  };

  /** What the pieces currently say the module is — read off the graph, live.
   * This is the whole claim of ADR 0001 made visible while you draw: lay a
   * turnout and a siding appears here, with the positions the dispatcher view
   * would get. */
  const graphReadout = useMemo(() => {
    const pieces = state.graph?.pieces ?? [];
    if (!pieces.length) return null;
    const { startAt, start2 } = state.graph!;
    if (!pieces.some((p) => p.id === startAt.piece)) return null;
    const { doc: derived, walk, warnings } = graphToDoc(pieces, {
      startAt,
      start2,
      library: partLibrary,
    });
    return { derived, walk, warnings };
  }, [state.graph, partLibrary]);

  /**
   * Edit a dimension. The doc's mainline length follows the module's (mainline
   * length if set, else the footprint length) so the board and the schematic
   * can't drift apart.
   */
  const setDim = (p: Partial<ModuleDimensions>) => {
    // Dimensions persist via updateModuleDimensions, a separate path from the
    // doc — so read-only has to stop here too, not just in patch().
    if (readOnly) return;
    markEdited();
    snapshot();
    const next = { ...dims, ...p };
    setDims(next);
    const len = Number(next.mainline_length_inches || next.length_total_inches) || 0;
    // NB: patch() also snapshots, but snapshot() coalesces within a gesture, so
    // the dims + length change land in one undo entry.
    if (len > 0 && len !== state.lengthInches) patch((s) => (s.lengthInches = len));
  };

  /** Store an authored endplate face width, or clear it back to the default. */
  const setEndplateWidth = (id: string, raw: string) =>
    patch((s) => {
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v > 0) s.endplateWidths[id] = v;
      else delete s.endplateWidths[id];
    });

  /** Which board the bench-work tool is shaping. An outline belongs to a
   * SECTION now, so "the outline" is only meaningful once you say whose (#96
   * phase 2b). Defaults to the first section below. */
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  /** Replace the module's section list (#108). The module's length is the SUM
   * of its sections, so it's written straight back here rather than authored —
   * that's what keeps `lengthInches` (which the whole canvas is measured in)
   * honest, and what removes the old "sections divide into a fixed total"
   * fight where every edit stole from its neighbour. */
  const setSections = (next: SchematicSection[]) => {
    const total = moduleLengthFromSections({ sections: next });
    // Everything on the board is positioned in absolute inches from endplate
    // A, so moving or resizing a section would leave its track, turnouts,
    // signals and industries behind — silently pointing at whatever board now
    // occupies those inches. Read each position against the OLD spans and
    // write it against the new, so it travels with the board it's on (#109).
    const before = sectionSpansOrWhole({ sections: state.sections }, state.lengthInches);
    const after = sectionSpansOrWhole({ sections: next }, total ?? state.lengthInches);
    const at = (pos: number) => remapPos(pos, before, after) ?? pos;
    patch((s) => {
      s.sections = next;
      for (const t of s.extraTracks) {
        t.fromPos = at(t.fromPos);
        t.toPos = at(t.toPos);
      }
      for (const t of s.turnouts) t.pos = at(t.pos);
      // NB no pinBranchRoutes here: resizing boards changes the centre-line, and
      // the memo still holds the OLD one inside this patch — pinning against it
      // would write a wrong start rather than leave a stale one. Renderers pin
      // on read anyway, and the next turnout edit rewrites it (#181).
      for (const c of s.crossings) c.pos = at(c.pos);
      // A control point has no position of its own — it groups turnouts — but
      // its signals do.
      for (const cp of s.controlPoints) for (const sig of cp.signals) sig.pos = at(sig.pos);
      for (const ind of s.industries) {
        ind.fromPos = at(ind.fromPos);
        ind.toPos = at(ind.toPos);
        // A house-track SPOT is a position like any other and was being left
        // behind — the industry moved with its board and its extra spots didn't
        // (#195). Each spot rides its own track (#186), but they're all measured
        // in the same inches from endplate A.
        for (const sp of ind.spots ?? []) {
          sp.fromPos = at(sp.fromPos);
          sp.toPos = at(sp.toPos);
        }
      }
      // A 3rd+ endplate is PLACED at a position along the module (#170), so it
      // belongs to a board and has to travel with it.
      for (const b of s.branches) b.pos = at(b.pos);
      // Rail joints are positions along a run (#193) — an owner's deliberate cut
      // would otherwise end up on a different board.
      for (const f of Object.values(s.flexByTrack ?? {})) {
        if (f.cuts) f.cuts = f.cuts.map(at).sort((x, y) => x - y);
      }
      if (total && total > 0) s.lengthInches = total;
      // Joints are derived from the sections now; a stale authored copy would
      // draw dividers that no longer match any board.
      if (next.length) s.sectionBreaks = [];
    });
    if (total && total > 0) setDims((d) => ({ ...d, length_total_inches: String(total) }));
  };

  /**
   * How many placed objects stand on a given board (#195).
   *
   * Every other section edit is safe — `setSections` reads each position
   * against the old spans and writes it against the new, so it travels with its
   * board. REMOVING a board is the exception: there's no new span to write to,
   * so whatever stood on it keeps a stale absolute and lands on whichever board
   * takes over those inches. This is what lets the remove button say so.
   */
  const countOnSection = useCallback(
    (sectionId: string) => {
      const sp = sectionSpansOrWhole({ sections: state.sections }, state.lengthInches).find(
        (x) => x.id === sectionId,
      );
      if (!sp) return 0;
      const on = (p: number) => p >= sp.fromPos && p < sp.toPos;
      // A span counts if ANY of it is on this board — a siding that crosses the
      // joint still loses its footing when the board goes.
      const spans = (a: number, b: number) =>
        Math.max(Math.min(a, b), sp.fromPos) < Math.min(Math.max(a, b), sp.toPos);
      let n = 0;
      for (const t of state.extraTracks) if (spans(t.fromPos, t.toPos)) n++;
      for (const t of state.turnouts) if (on(t.pos)) n++;
      for (const c of state.crossings) if (on(c.pos)) n++;
      for (const cp of state.controlPoints) for (const sig of cp.signals) if (on(sig.pos)) n++;
      for (const ind of state.industries) {
        if (spans(ind.fromPos, ind.toPos)) n++;
        for (const s of ind.spots ?? []) if (spans(s.fromPos, s.toPos)) n++;
      }
      for (const b of state.branches) if (on(b.pos)) n++;
      return n;
    },
    [state],
  );

  /** The section the bench-work tool is editing — the chosen one, else the
   * first. Null when this module doesn't use sections, in which case the
   * module's own outline is still what gets edited. */
  // An EXPLICIT pick ("Shape this board") always wins. Otherwise only fall back
  // to the first section when the sections actually own the shape — a lone
  // shapeless section used to hijack outline editing, so the module's authored
  // corners were drawn by nobody and couldn't be edited at all (#173).
  const activeSection =
    state.sections.find((sec) => sec.id === activeSectionId) ??
    (footprint.sectionOutlines.length ? (state.sections[0] ?? null) : null);

  /** The band this section would occupy if it had no authored shape — what
   * "Start from a rectangle" seeds, so a section's rectangle is its own
   * stretch of board rather than the whole module's. */
  const activeSectionBand = useMemo(() => {
    if (!activeSection) return null;
    const sp = sectionSpans({ sections: state.sections }).find((x) => x.id === activeSection.id);
    if (!sp) return null;
    return sectionBand(
      footprint.centerline,
      sp.fromPos,
      sp.toPos,
      state.endplateWidths.A ?? 24,
      state.endplateWidths.B ?? 24,
      renderTrackOffsets.A,
      renderTrackOffsets.B,
    );
  }, [activeSection, state.sections, state.endplateWidths, footprint.centerline, renderTrackOffsets]);

  /** Every OTHER section's shape, drawn as context behind the one being
   * edited so you can see what the board has to meet. */
  const otherSectionOutlines = useMemo(
    () =>
      footprint.sectionOutlines.filter(
        // Drop only the active section's AUTHORED shape — that one is drawn as
        // the editable polygon. A derived active section still has to be drawn
        // here, or the board you're standing on disappears while you shape it.
        (sec) => !(sec.id === activeSection?.id && !sec.derived),
      ),
    [footprint.sectionOutlines, activeSection],
  );

  /** Which boards actually MEET, from shared edges rather than list order
   * (#96 phase 2c) — a peninsula off the back of a band neighbours that band,
   * not whichever section happens to sit beside it in the list. */
  const sectionMeets = useMemo(
    () => sectionAdjacency(footprint.sectionOutlines),
    [footprint.sectionOutlines],
  );

  /** Boards not connected to the piece endplate A is on. A module is one piece
   * of bench work; anything else is a board drawn somewhere it can't be. */
  const floatingSections = useMemo(() => {
    // A loop's balloon boards form a RING that closes back on itself; the
    // linear "does each board meet a neighbour" check can't model that closure,
    // so it would flag every balloon board as floating. Skip it for loops (#loop).
    if (state.loop) return new Set<string>();
    if (state.sections.length < 2) return new Set<string>();
    const groups = sectionComponents(
      state.sections.map((sec) => sec.id),
      sectionMeets,
    );
    if (groups.length < 2) return new Set<string>();
    const main = groups.find((g) => g.includes(state.sections[0].id)) ?? groups[0];
    return new Set(groups.filter((g) => g !== main).flat());
  }, [state.sections, sectionMeets, state.loop]);

  /** The joints the canvas should draw. A sectioned module derives them from
   * cumulative section lengths; an unsectioned one still uses its authored
   * ones (#108). */
  const canvasSectionBreaks = useMemo(
    () =>
      state.sections.length
        ? sectionBreaksFromSections({ sections: state.sections })
        : state.sectionBreaks,
    [state.sections, state.sectionBreaks],
  );

  /** Dragging a joint on a sectioned module resizes the two boards it divides,
   * leaving every other board — and the module's overall length — alone. Same
   * feel as dragging a joint always had, just expressed as section lengths. */
  const moveSectionJoint = (i: number, pos: number) => {
    if (!state.sections.length) {
      patch((s) => {
        const next = [...s.sectionBreaks];
        next[i] = Math.round(pos * 1000) / 1000;
        s.sectionBreaks = next;
      });
      return;
    }
    const spans = sectionSpans({ sections: state.sections });
    const a = spans[i];
    const b = spans[i + 1];
    if (!a || !b) return;
    const MIN = 1;
    const lo = a.fromPos + MIN;
    const hi = b.toPos - MIN;
    if (hi <= lo) return;
    const at = Math.max(lo, Math.min(hi, pos));
    const lenA = Math.round((at - a.fromPos) * 1000) / 1000;
    const lenB = Math.round((b.toPos - at) * 1000) / 1000;
    setSections(
      state.sections.map((sec) =>
        sec.id === a.id
          ? { ...sec, lengthInches: lenA }
          : sec.id === b.id
            ? { ...sec, lengthInches: lenB }
            : sec,
      ),
    );
  };

  /** Dragging the far endplate resizes the LAST board — it is that board's
   * outer end — and so the module's overall length with it. On a module with
   * no sections it just sets the authored length, which is the same gesture
   * meaning the same thing (#108). */
  const moveEndplateEnd = (_id: string, pos: number) => {
    const L = Math.round(pos * 1000) / 1000;
    if (L <= 0) return;
    if (!state.sections.length) {
      patch((s) => (s.lengthInches = L));
      setDims((d) => ({ ...d, length_total_inches: String(L) }));
      return;
    }
    const spans = sectionSpans({ sections: state.sections });
    const last = spans[spans.length - 1];
    if (!last) return;
    const len = Math.round((L - last.fromPos) * 1000) / 1000;
    if (len < 1) return;
    // A drag that doesn't actually change the length shouldn't land an undo
    // entry — pointermove fires constantly.
    const cur = state.sections.find((sec) => sec.id === last.id)?.lengthInches;
    if (cur === len) return;
    setSections(
      state.sections.map((sec) => (sec.id === last.id ? { ...sec, lengthInches: len } : sec)),
    );
  };

  /** Store where this end's Main 1 crosses, as a signed distance from the
   * plate CENTRE (§2.0's own framing). Blank clears back to the default —
   * 0 is NOT blank, it means "explicitly centred". */
  const setEndplateTrackOffset = (id: string, raw: string) =>
    patch((s) => {
      const v = parseFloat(raw);
      if (raw.trim() !== "" && Number.isFinite(v)) s.endplateTrackOffsets[id] = v;
      else delete s.endplateTrackOffsets[id];
    });

  // --- Place-an-endplate (#170 junction authoring) --------------------------
  // A 3rd+ endplate (C, D…) is PLACED on the board, then track is drawn to it
  // separately (per the owner's model). Adding one creates no track or turnout.
  const addEndplate = () => {
    const id = String.fromCharCode(67 + state.branches.length); // C, D, E…
    patch((s) => {
      const midX = Math.max(1, Math.round(s.lengthInches / 2));
      s.branches.push({
        label: `Branch ${s.branches.length + 1}`,
        pos: midX,
        side: "up",
        config: "single",
        // ⭐⭐ A ROUTE THAT REACHES AN ENDPLATE IS A **MAIN** (#181, restated by
        // Will on FMN-0068 2026-07-30: *"this is not a branch since FD would
        // decide that. It is still a mainline since it goes to an endplate."*).
        // Whether it is operationally a branch line is a question about the
        // LAYOUT, and only Free-Dispatcher can see the layout. The module's own
        // fact is narrower and certain: there is an endplate here and track
        // reaches it. `label` is still the owner's word for it.
        kind: "main",
        trackId: null,
      });
      // ⚠️ NO pose override. This used to write one — `snapPoseToOutline(outline)
      // ?? { y: 12 }` — which is the exact thing #182 fixed for endplates A and
      // B: a DERIVED pose silently pinned as if the owner had placed it, so it
      // then stopped following the board.
      //
      // The hard-coded 12 was also only right on a 24″ board, and it became the
      // live path the moment a new module stopped carrying an authored outline.
      // `deriveEndplatePoses` now puts a branch plate on the benchwork edge at
      // the board's real depth, so letting it derive is both correct and
      // self-maintaining. Dragging the plate writes the override, as it should.
    });
    setSelection({ kind: "endplate", id });
  };
  /** Drag a placed endplate along the perimeter — its face clings to the
   * nearest benchwork edge, facing out; the ops-preview arrow follows. */
  const moveEndplate = (id: string, pt: { x: number; y: number }) =>
    patch((s) => {
      const pose = snapPoseToOutline(s.outline, pt) ?? { x: pt.x, y: pt.y, heading: 90 };
      s.poseOverrides[id] = { x: pose.x, y: pose.y, heading: pose.heading };
      const bi = id.charCodeAt(0) - 67;
      if (bi >= 0 && s.branches[bi]) {
        s.branches[bi].pos = Math.max(0, Math.min(s.lengthInches, Math.round(pose.x)));
        s.branches[bi].side = pose.heading > 180 ? "down" : "up";
      }
    });

  // --- Draw-to-create sidings & spurs (#51) ---------------------------------
  // Picking Siding/Spur from the + Track menu no longer drops a track at a
  // default spot — it arms placement and the canvas captures the draw, which
  // calls onPlaceTrack below with the drawn geometry.
  function armSiding() {
    setPendingTrack("siding");
    setTool("track");
  }
  function armSpur() {
    setPendingTrack("spur");
    setTool("track");
  }
  const nextLane = (s: EditorState) => {
    // Lane 1 is Main 2 on a double module; first free lane is above it.
    const base = s.configA === "double" || s.configB === "double" ? 2 : 1;
    return Math.max(base, ...s.extraTracks.map((t) => t.lane + 1));
  };
  /** A spur / yard lead diverging from `throatTurnoutId`, drawn out to a stub. */
  function placeSpur(
    throatTurnoutId: string,
    fromPos: number,
    toPos: number,
    path: BenchworkPoint[],
  ) {
    const id = nextId("spur", state.extraTracks.map((t) => t.id));
    patch((s) => {
      s.extraTracks.push({
        id,
        role: "spur",
        lane: nextLane(s),
        fromPos,
        toPos,
        ...(path.length >= 2 ? { path } : {}),
        moduleTrackId: null,
        trackName: "",
      });
      // Link the throat turnout to the new spur so it reads (and snaps) as one.
      const tn = s.turnouts.find((t) => t.id === throatTurnoutId);
      if (tn) tn.divergeTrack = id;
    });
    // Select it so the Track tool edits the new spur (not the mainline) next.
    setSelection({ kind: "track", id });
  }
  /** A passing siding drawn between two already-placed turnouts. */
  function placeSiding(
    fromTurnoutId: string,
    toTurnoutId: string,
    fromPos: number,
    toPos: number,
  ) {
    const id = nextId("sid", state.extraTracks.map((t) => t.id));
    patch((s) => {
      s.extraTracks.push({
        id,
        role: "siding",
        lane: nextLane(s),
        fromPos,
        toPos,
        moduleTrackId: null,
        trackName: "Passing siding",
      });
      // Both turnouts now diverge to this siding.
      for (const t of s.turnouts)
        if (t.id === fromTurnoutId || t.id === toTurnoutId) t.divergeTrack = id;
    });
    setSelection({ kind: "track", id });
  }
  /** Turnout-first track creation (#136): from a turnout's "Diverges to", make
   * a NEW spur or siding for it to feed, named so the owner can rename it, with
   * a short default stub they then shape by dragging its end. Steve Branton's
   * suggestion — the reverse of drawing a track and having it mint the turnout. */
  const newDivergeTrack = (turnoutId: string, role: "spur" | "siding") => {
    const tn = state.turnouts.find((t) => t.id === turnoutId);
    if (!tn) return;
    const id = nextId(role === "spur" ? "spur" : "sid", state.extraTracks.map((t) => t.id));
    const p = Math.round(tn.pos * 10) / 10;
    const stub =
      Math.round(Math.max(6, Math.min(state.lengthInches - p, state.lengthInches * 0.12)) * 10) / 10;
    patch((s) => {
      s.extraTracks.push({
        id,
        role,
        lane: nextLane(s),
        fromPos: p,
        toPos: Math.min(s.lengthInches, p + stub),
        moduleTrackId: null,
        trackName: role === "spur" ? "New spur" : "New siding",
      });
      const t = s.turnouts.find((x) => x.id === turnoutId);
      if (t) t.divergeTrack = id;
    });
    // Select the new track so its name / kind / extent are right there to edit.
    setSelection({ kind: "track", id });
  };

  /**
   * Move a turnout — from the canvas drag OR the inspector's position field.
   * Both go through one handler so the two can't drift apart.
   *
   * ⚠️ This used to drag every endplate-bound branch route along with the turnout
   * (#181). It doesn't any more (#189): a branch is ordinary track, so it stays
   * where its owner put it and SNAPS to the turnout's diverging rail when they
   * bring it near. Moving a turnout away from its route now leaves a visible
   * gap, marked by a ring — which is the truth, where the old auto-pin was the
   * renderer asserting a connection the layout didn't have.
   */
  const moveTurnout = (id: string, pos: number) =>
    patch((s) => {
      const t = s.turnouts.find((x) => x.id === id);
      if (t) t.pos = pos;
    });

  /** Draw a branch route from a turnout on the main out to a placed endplate
   * (#170 junction). The default path leaves the turnout and meets the endplate
   * FACE square, with the mandated §2.0 straight lead; the owner then shapes the
   * middle (bend handles) to match the real build. Links the turnout's
   * divergeTrack AND the endplate's trackId to the new track. */
  const divergeToEndplate = (turnoutId: string, endplateId: string) => {
    const tn = state.turnouts.find((t) => t.id === turnoutId);
    const epPose = poses.find((p) => p.id === endplateId);
    const center = footprint.centerline;
    if (!tn || !epPose || center.length < 2) return;
    const id = nextId("branch", state.extraTracks.map((t) => t.id));
    const rnd = (v: number) => Math.round(v * 1000) / 1000;
    const start = sampleAt(center, tn.pos); // the turnout's point on the main
    const lead = endplateLead(epPose); // face + the 4″ perpendicular lead inboard
    // start → inboard(4″ off the face) → face. The lead segment is straight and
    // square by construction; the owner bows the start→inboard leg into place.
    const path = [
      { x: rnd(start.x), y: rnd(start.y) },
      { x: rnd(lead.inboard.x), y: rnd(lead.inboard.y) },
      { x: rnd(lead.face.x), y: rnd(lead.face.y) },
    ];
    patch((s) => {
      s.extraTracks.push({
        id,
        role: "branch",
        lane: nextLane(s),
        fromPos: tn.pos,
        toPos: tn.pos,
        path,
        moduleTrackId: null,
        trackName: `To endplate ${endplateId}`,
      });
      const t = s.turnouts.find((x) => x.id === turnoutId);
      if (t) t.divergeTrack = id;
      const bi = endplateId.charCodeAt(0) - 67;
      if (bi >= 0 && s.branches[bi]) s.branches[bi].trackId = id;
    });
    setSelection({ kind: "track", id });
  };

  const onPlaceTrack = (
    p:
      | {
          role: "spur";
          throatTurnoutId: string;
          fromPos: number;
          toPos: number;
          path?: BenchworkPoint[];
        }
      | {
          role: "siding";
          fromTurnoutId: string;
          toTurnoutId: string;
          fromPos: number;
          toPos: number;
        },
  ) => {
    if (p.role === "siding") placeSiding(p.fromTurnoutId, p.toTurnoutId, p.fromPos, p.toPos);
    else placeSpur(p.throatTurnoutId, p.fromPos, p.toPos, p.path ?? []);
    setPendingTrack(null);
  };
  function addCrossover() {
    patch((s) => {
      const built = buildCrossover(s);
      if (built) {
        s.extraTracks.push(built.track);
        s.turnouts.push(...built.turnouts);
      }
    });
  }
  function addTurnout() {
    patch((s) => {
      const diverge = s.extraTracks[0]?.id ?? MAIN_TRACK_ID;
      s.turnouts.push({
        id: nextId("sw", s.turnouts.map((t) => t.id)),
        name: "",
        pos: Math.round(s.lengthInches * 0.5),
        onTrack: MAIN_TRACK_ID,
        divergeTrack: diverge,
        kind: "right",
        size: DEFAULT_TURNOUT_SIZE,
      });
    });
  }
  /** Turnout (W) tool: drop a turnout of a chosen hand at `pos` on a track, and
   * give it a short diverging spur stub straight away (#turnout-palette). The
   * turnout is a point placement — no drag-length — and the stub is positioned by
   * its `toPos`, so dragging its ○ end to size it can't shift what you dropped
   * (the old draw-to-create re-projected the drawn end and changed the length).
   * The stub is selected so its end handle is right there to pull out. */
  const onDropTurnout = (
    spec: { kind: TurnoutKind; curved?: boolean; size: number; partId?: string },
    onTrack: string,
    pos: number,
  ) => {
    const swId = nextId("sw", state.turnouts.map((t) => t.id));
    const spId = nextId("spur", state.extraTracks.map((t) => t.id));
    const p = Math.round(pos * 10) / 10;
    // A short default the owner extends — ~12% of the board, at least 6″, and
    // never past the far endplate.
    const stub =
      Math.round(Math.max(6, Math.min(state.lengthInches - p, state.lengthInches * 0.12)) * 10) /
      10;
    patch((s) => {
      s.extraTracks.push({
        id: spId,
        role: "spur",
        lane: nextLane(s),
        fromPos: p,
        toPos: Math.min(s.lengthInches, p + stub),
        moduleTrackId: null,
        trackName: "",
      });
      s.turnouts.push({
        id: swId,
        name: "",
        pos: p,
        onTrack,
        divergeTrack: spId,
        kind: spec.kind,
        // ⭐ THE PALETTE ENTRY ANSWERS BOTH QUESTIONS (#198 step 5). "Atlas #7
        // LH" has already said #7, so there is no second control to disagree
        // with it — and naming the part here is exactly what the turnout
        // inspector's own Part picker does one click later (#187).
        size: spec.size,
        ...(spec.partId ? { partId: spec.partId } : {}),
        ...(spec.curved ? { curved: true } : {}),
      });
    });
    // Select the stub — its end ○ is now the thing to drag to length.
    setSelection({ kind: "track", id: spId });
  };
  /** Crossover drop (#turnout-palette): a self-contained element between the
   * main and a parallel lane — a turnout on each end + the diagonal connector(s)
   * (a double crossover has two, crossing at the scissors). A plain parallel
   * track already covering the span on
   * that side is reused (a siding, say); otherwise a short parallel stub is
   * created for the owner to draw out to length. The connector carries an
   * authored 2-pt path (host end → parallel end) so the canvas renders the
   * diagonal and the leg walks the right way for both slants. */
  const onDropCrossover = (p: {
    hand?: "left" | "right";
    double?: boolean;
    size: number;
    partId?: string;
    side: 1 | -1;
    posA: number;
    posB: number;
    hostA: BenchworkPoint;
    hostB: BenchworkPoint;
    parA: BenchworkPoint;
    parB: BenchworkPoint;
  }) => {
    const lane = p.side;
    const existing = state.extraTracks.find(
      (t) =>
        t.lane === lane &&
        !(t.path && t.path.length >= 2) &&
        t.fromPos <= p.posA &&
        t.toPos >= p.posB,
    );
    const ids = state.extraTracks.map((t) => t.id);
    const parId = existing?.id ?? nextId("sid", ids);
    const xoA = nextId("xo", [...ids, parId]);
    const xoB = nextId("xo", [...ids, parId, xoA]);
    const swIds = state.turnouts.map((t) => t.id);
    const sw1 = nextId("sw", swIds);
    const sw2 = nextId("sw", [...swIds, sw1]);
    const sw3 = nextId("sw", [...swIds, sw1, sw2]);
    const sw4 = nextId("sw", [...swIds, sw1, sw2, sw3]);
    // Turnout positions are ABSOLUTE (inches from A) everywhere — the canvas
    // converts to host-relative when sampling the parallel track's polyline.
    const stubFrom = existing ? existing.fromPos : Math.max(0, Math.round((p.posA - 6) * 10) / 10);
    // The hand is the way the diagonal throws facing B: diverging left with the
    // parallel above means the diagonal runs forward; below, backward.
    const forward = p.double ? true : (p.side > 0) === (p.hand === "left");
    const opp = (k: TurnoutKind): TurnoutKind => (k === "left" ? "right" : "left");
    patch((s) => {
      if (!existing) {
        s.extraTracks.push({
          id: parId,
          role: "siding",
          lane,
          fromPos: stubFrom,
          toPos: Math.min(s.lengthInches, Math.round((p.posB + 6) * 10) / 10),
          moduleTrackId: null,
          trackName: "",
        });
      }
      const conn = (id: string, fwd: boolean) =>
        s.extraTracks.push({
          id,
          role: "crossover",
          lane,
          fromPos: p.posA,
          toPos: p.posB,
          path: fwd ? [p.hostA, p.parB] : [p.hostB, p.parA],
          moduleTrackId: null,
          trackName: "Crossover",
          // The product goes on the CONNECTOR — its track spacing is what
          // pinches the pair, and that belongs to the pair, not to a turnout.
          ...(p.partId ? { crossoverPartId: p.partId } : {}),
        });
      const swp = (id: string, pos: number, onTrack: string, diverge: string, kind: TurnoutKind) =>
        s.turnouts.push({ id, name: "Crossover", pos, onTrack, divergeTrack: diverge, kind, size: p.size });
      if (p.double) {
        conn(xoA, true);
        conn(xoB, false);
        // Host-side turnout FIRST per connector — the canvas draws its leg.
        swp(sw1, p.posA, MAIN_TRACK_ID, xoA, p.side > 0 ? "left" : "right");
        swp(sw2, p.posB, parId, xoA, p.side > 0 ? "right" : "left");
        swp(sw3, p.posB, MAIN_TRACK_ID, xoB, p.side > 0 ? "right" : "left");
        swp(sw4, p.posA, parId, xoB, p.side > 0 ? "left" : "right");
      } else {
        conn(xoA, forward);
        const hand = p.hand ?? "left";
        swp(sw1, forward ? p.posA : p.posB, MAIN_TRACK_ID, xoA, hand);
        swp(sw2, forward ? p.posB : p.posA, parId, xoA, opp(hand));
      }
    });
    // Select the parallel track — its ends are what the owner draws out next.
    setSelection({ kind: "track", id: parId });
  };
  /** Joined tracks become ONE track (#track-end-snap). When a track-end drag is
   * released with its end abutting another same-lane track's end (the snap made
   * them meet exactly), merge: the dragged track absorbs the other — union span,
   * every reference (turnouts, industries, crossings, signals) re-pointed — and
   * the other record is removed. Spurs (throat-directional) and crossover
   * connectors are never merged. */
  const mergeAbutting = (id: string) => {
    let select: { kind: "track"; id: string } | null = null;
    patch((s) => {
      /** Re-point every reference from one track id to another. */
      const repoint = (from: string, to: string) => {
        for (const sw of s.turnouts) {
          if (sw.onTrack === from) sw.onTrack = to;
          if (sw.divergeTrack === from) sw.divergeTrack = to;
        }
        for (const ind of s.industries) {
          if (ind.track === from) ind.track = to;
          for (const sp of ind.spots) if (sp.track === from) sp.track = to;
        }
        for (const x of s.crossings) {
          if (x.trackA === from) x.trackA = to;
          if (x.trackB === from) x.trackB = to;
        }
        for (const cp of s.controlPoints)
          for (const sig of cp.signals) if (sig.track === from) sig.track = to;
      };
      const plain = (t: (typeof s.extraTracks)[number]) =>
        !(t.path && t.path.length >= 2) && t.role !== "spur" && t.role !== "crossover";
      const A = s.extraTracks.find((t) => t.id === id);
      if (!A || !plain(A)) return;
      // ---- Merge: joined tracks become ONE track ------------------------------
      const eps = 0.05;
      const B = s.extraTracks.find(
        (t) =>
          t.id !== A.id &&
          t.lane === A.lane &&
          plain(t) &&
          [t.fromPos, t.toPos].some(
            (e) => Math.abs(e - A.fromPos) < eps || Math.abs(e - A.toPos) < eps,
          ),
      );
      if (B) {
        const lo = Math.min(A.fromPos, A.toPos, B.fromPos, B.toPos);
        const hi = Math.max(A.fromPos, A.toPos, B.fromPos, B.toPos);
        A.fromPos = Math.round(lo * 10) / 10;
        A.toPos = Math.round(hi * 10) / 10;
        if (!A.trackName && B.trackName) A.trackName = B.trackName;
        // Keep the DB row linkage if the survivor doesn't have one yet.
        if (A.moduleTrackId == null && B.moduleTrackId != null) A.moduleTrackId = B.moduleTrackId;
        repoint(B.id, A.id);
        s.extraTracks.splice(s.extraTracks.findIndex((t) => t.id === B.id), 1);
      }
      select = { kind: "track", id: A.id };
      // ---- Endplate contact: a track ON a plate = a DOUBLE-TRACK plate --------
      // (FD snaps modules by endplate config, so the config must follow the
      // geometry.) The track becomes Main 2: both plates touched → full double;
      // one plate → a transition module, with the End-of-Double-Track turnout +
      // control point at the drawn track's inner end.
      if (A.lane !== 1 || s.loop) return;
      if (s.configA === "double" || s.configB === "double") return;
      const plateEps = 0.5;
      const lo2 = Math.min(A.fromPos, A.toPos);
      const hi2 = Math.max(A.fromPos, A.toPos);
      const touchesA = lo2 <= plateEps;
      const touchesB = hi2 >= s.lengthInches - plateEps;
      if (!touchesA && !touchesB) return;
      // Endplate records are authoritative — never override a locked config.
      if ((touchesA && lockedConfigs.a) || (touchesB && lockedConfigs.b)) return;
      repoint(A.id, MAIN2_TRACK_ID);
      s.extraTracks.splice(s.extraTracks.findIndex((t) => t.id === A.id), 1);
      select = null;
      if (touchesA) s.configA = "double";
      if (touchesB) s.configB = "double";
      if (touchesA !== touchesB) {
        // Transition module: Main 2 ends where the drawn track ended.
        const p = Math.round((touchesA ? hi2 : lo2) * 10) / 10;
        const swId = nextId("sw", s.turnouts.map((x) => x.id));
        s.turnouts.push({
          id: swId,
          name: "End of Double Track",
          pos: p,
          // On the mainline (Main 1), diverging to the second main (#131).
          onTrack: MAIN_TRACK_ID,
          divergeTrack: MAIN2_TRACK_ID,
          // Hand so the leg lands on Main 2's side (matches buildTransition):
          // Main 2 extends toward the double end (touchesA = double at A/west).
          kind:
            (touchesA ? -1 : 1) === (s.mainsSwapped ? -1 : 1) ? "left" : "right",
          size: DEFAULT_TURNOUT_SIZE,
        });
        const cpId = nextId("cp", s.controlPoints.map((c) => c.id));
        s.controlPoints.push({
          id: cpId,
          name: "End of Double Track",
          turnouts: [swId],
          signals: [
            { id: `${cpId}-AtoB`, pos: p, track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
            { id: `${cpId}-BtoA`, pos: p, track: MAIN_TRACK_ID, facing: "BtoA", side: "below" },
          ],
        });
      }
    });
    setSelection(select);
  };
  /** Completing the double: an End-of-Double-Track turnout dragged onto the
   * single end's plate means the double now spans the module — flip that plate
   * to double and retire the transition (turnout + its control point). */
  const onTurnoutDrop = (id: string) => {
    patch((s) => {
      const sw = s.turnouts.find((x) => x.id === id);
      if (!sw || !isTransitionTurnout(sw) || s.loop) return;
      const aD = s.configA === "double";
      const bD = s.configB === "double";
      if (aD === bD) return; // not a transition module
      const eps = 0.5;
      const atFarPlate = aD ? sw.pos >= s.lengthInches - eps : sw.pos <= eps;
      if (!atFarPlate) return;
      if (aD ? lockedConfigs.b : lockedConfigs.a) return;
      if (aD) s.configB = "double";
      else s.configA = "double";
      s.turnouts.splice(s.turnouts.findIndex((x) => x.id === sw.id), 1);
      for (const cp of s.controlPoints) cp.turnouts = cp.turnouts.filter((t) => t !== id);
      const cpi = s.controlPoints.findIndex(
        (cp) => cp.name === "End of Double Track" && cp.turnouts.length === 0,
      );
      if (cpi >= 0) s.controlPoints.splice(cpi, 1);
    });
  };
  function addCrossing() {
    patch((s) => {
      s.crossings.push({
        id: nextId("x", s.crossings.map((x) => x.id)),
        name: "",
        pos: Math.round(s.lengthInches * 0.5),
        trackA: MAIN_TRACK_ID,
        trackB: s.extraTracks[0]?.id ?? MAIN_TRACK_ID,
      });
    });
  }
  function addControlPoint() {
    patch((s) => {
      const id = nextId("cp", s.controlPoints.map((c) => c.id));
      s.controlPoints.push({
        id,
        name: "",
        turnouts: [],
        signals: [
          { id: `${id}-AtoB`, pos: Math.round(s.lengthInches * 0.25), track: MAIN_TRACK_ID, facing: "AtoB", side: "above" },
        ],
      });
    });
  }
  function addIndustry() {
    patch((s) => {
      const spur = s.extraTracks.find((t) => t.role === "spur") ?? s.extraTracks[0];
      const track = spur?.id ?? MAIN_TRACK_ID;
      const from = spur ? spur.fromPos : Math.round(s.lengthInches * 0.35);
      const to = spur ? spur.toPos : Math.round(s.lengthInches * 0.6);
      s.industries.push({
        id: nextId("ind", s.industries.map((i) => i.id)),
        name: "",
        type: "",
        track,
        fromPos: from,
        toPos: to,
        spots: [],
        side: "below",
        labelMode: "none",
        carTypes: [],
        moduleIndustryId: null,
      });
    });
  }
  /** Place an industry where the Industry tool was clicked, then edit it. */
  function addIndustryAt(track: string, pos: number) {
    const id = nextId("ind", state.industries.map((i) => i.id));
    const half = Math.max(6, Math.round(state.lengthInches * 0.08));
    patch((s) => {
      s.industries.push({
        id,
        name: "",
        type: "",
        track,
        fromPos: Math.max(0, Math.round(pos - half)),
        toPos: Math.min(s.lengthInches, Math.round(pos + half)),
        spots: [],
        side: "below",
        labelMode: "none",
        carTypes: [],
        moduleIndustryId: null,
      });
    });
    setSelection({ kind: "industry", id });
    setTool("select");
  }

  // --- Autosave --------------------------------------------------------------
  // No Save button: persist automatically ~1s after the last edit. Dimensions
  // live on the module record and the rest in the doc, so each half is written
  // only when its own signature changed. Refs (not closures) hold the live
  // values so a save scheduled in one render still writes the latest.
  type SaveState = "saved" | "unsaved" | "saving" | "error";
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const docSig = useMemo(() => JSON.stringify(doc), [doc]);
  const dimsSig = useMemo(() => JSON.stringify(dims), [dims]);
  const docRef = useRef(doc);
  const dimsRef = useRef(dims);
  const sigRef = useRef({ doc: docSig, dims: dimsSig });
  const savedSig = useRef({ doc: docSig, dims: dimsSig }); // last persisted
  const savingRef = useRef(false);
  // Keep the "live value" refs current for a save scheduled a second ago
  // (writing refs during render is disallowed; this effect runs after commit).
  // What a keyboard shortcut needs to read WITHOUT re-binding its listener on
  // every keystroke of state — the same reason the save refs above exist.
  const selectionRef = useRef(selection);
  const stateRef = useRef(state);
  useEffect(() => {
    docRef.current = doc;
    dimsRef.current = dims;
    sigRef.current = { doc: docSig, dims: dimsSig };
    selectionRef.current = selection;
    stateRef.current = state;
  });

  const runSave = useCallback(async () => {
    if (readOnly) return; // inspect-only: never write someone else's module
    // The same invariant as the debounce, stated where the write happens (#222).
    // The Save button is disabled without an edit, but "nothing writes this
    // module unless a person changed it" is worth being true at the call site
    // rather than only upstream of it.
    if (!userEdited.current) return;
    if (savingRef.current) return; // in flight; its finally re-checks
    const target = { ...sigRef.current };
    if (target.doc === savedSig.current.doc && target.dims === savedSig.current.dims) {
      setSaveState("saved");
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setError(null);
    try {
      if (target.dims !== savedSig.current.dims) {
        const r = await updateModuleDimensions(moduleId, dimsRef.current);
        if (r && "error" in r) throw new Error(r.error);
        savedSig.current.dims = target.dims;
      }
      if (target.doc !== savedSig.current.doc) {
        const r = await saveModuleSchematic(moduleId, docRef.current);
        if (r && "error" in r) throw new Error(r.error);
        savedSig.current.doc = target.doc;
      }
      const clean =
        sigRef.current.doc === savedSig.current.doc &&
        sigRef.current.dims === savedSig.current.dims;
      setSaveState(clean ? "saved" : "unsaved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaveState("error");
    } finally {
      savingRef.current = false;
      // Edited while saving? A later effect run already scheduled the next pass.
    }
  }, [moduleId, readOnly]);

  // Debounce: settle 1s after the last EDIT, then persist.
  useEffect(() => {
    if (docSig === savedSig.current.doc && dimsSig === savedSig.current.dims) {
      if (!savingRef.current) setSaveState("saved");
      return;
    }
    // ⭐⭐ A DIFFERENCE IS NOT A REASON TO WRITE (#222). Reaching here means the
    // document this editor would save differs from the one it loaded — which is
    // a necessary condition for saving, never a sufficient one. Until somebody
    // edits something, a difference means the LOAD changed the module, and the
    // honest response to that is to show it and leave the stored copy alone.
    // #220 is what this costs when it's the other way round.
    if (!userEdited.current) {
      // Say it once. A module that doesn't round-trip is a DEFECT to surface,
      // not a change to persist — #220 went unnoticed until a crossover visibly
      // disagreed with its own geometry.
      if (!warnedRoundTrip.current) {
        warnedRoundTrip.current = true;
        console.warn(
          `[schematic] This module does not round-trip: loading it produced a different ${
            docSig !== savedSig.current.doc ? "document" : "set of dimensions"
          } from the one stored. Nothing has been saved (modulerepo#222).`,
        );
      }
      return;
    }
    setSaveState((s) => (s === "saving" ? s : "unsaved"));
    const t = setTimeout(() => void runSave(), 1000);
    return () => clearTimeout(t);
  }, [docSig, dimsSig, runSave]);

  /** Erase the drawing (kept as a deliberate, confirmed action). Autosave then
   * persists the emptied module. */
  const clearDrawing = () => {
    if (
      !window.confirm(
        "Clear the whole schematic — outline, track, turnouts, signals, industries?",
      )
    )
      return;
    patch((s) => {
      s.outline = [];
      s.mainPath = [];
      s.extraTracks = [];
      s.turnouts = [];
      s.crossings = [];
      s.branches = [];
      s.controlPoints = [];
      s.industries = [];
      s.poseOverrides = {};
    });
  };

  // --- Keyboard: tool shortcuts, undo/redo, pan (space handled in canvas) -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!mod && !e.altKey) {
        if (e.key === "v" || e.key === "V") setTool("select");
        else if (e.key === "b" || e.key === "B") setTool("benchwork");
        else if (e.key === "t" || e.key === "T") setTool("track");
        // W still works: it was the Turnout tool's key for a long time, and it
        // now takes you to the tool that owns turnouts.
        else if (e.key === "w" || e.key === "W") setTool("track");
        else if (e.key === "s" || e.key === "S") setTool("signal");
        else if (e.key === "i" || e.key === "I") setTool("industry");
        // P still works too: it was the Pieces tool's key, and Track now owns
        // laying pieces (#198 step 4) — same courtesy as W above.
        else if (e.key === "p" || e.key === "P") setTool("track");
        else if (e.key === "Escape") {
          setSelection(null);
          setPendingTrack(null);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          // A laid piece is the one object with no other way to remove it — the
          // rest are removed from their inspector, and this one can be too, but
          // laying track is a fast loop and reaching for the panel breaks it.
          if (selectionRef.current?.kind === "piece") {
            e.preventDefault();
            const id = selectionRef.current.id;
            setPieces((stateRef.current.graph?.pieces ?? []).filter((p) => p.id !== id), {
              commit: true,
            });
            setSelection(null);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `setPieces` is read through refs on purpose — listing it would re-bind the
    // listener on every keystroke of state for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  /**
   * Seed a brand-new module: ONE SECTION carrying the length and shape just
   * entered, plus a rectangular board so the canvas starts as a real board and
   * not an empty SVG with a button. Autosave persists it; undo drops it.
   *
   * ⭐ A module is **born sections-first** (#108). It used to be created with a
   * module-level length and no sections at all, so its very first act was to be
   * the thing sections-first replaced — and an owner adding a second board had
   * to find "Build this module from sections →" before they could. That button
   * is now what it should be: a migration for modules authored before this.
   *
   * The length is the same number the owner typed; it just belongs to the board
   * rather than to the module, so the module's length is derived from the start
   * and a second board adds to it instead of stealing from it.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (!newModule || seeded.current) return;
    if (state.outline.length > 0 || state.sections.length > 0 || state.lengthInches <= 0) return;
    seeded.current = true;
    const L = state.lengthInches;
    // Defer out of the effect body: this is a persisted edit (autosave picks it
    // up), not render-synchronous state React should batch.
    queueMicrotask(() =>
      patch((s) => {
        s.sections = [
          {
            id: nextId("sec", []),
            lengthInches: L,
            // Whatever shape the new-module form was told — a curved first board
            // is ordinary, and this is what makes it the SECTION's shape.
            geometryType: geometry.type || "straight",
            ...(geometry.degrees ? { geometryDegrees: geometry.degrees } : {}),
            ...(geometry.offset ? { geometryOffsetInches: geometry.offset } : {}),
          },
        ];
        // ⚠️ NO module-level outline. It used to seed a rectangle here, which
        // went STALE the moment a second board was added: the module grew to
        // 72″ while its authored board polygon stayed at the 48″ it was created
        // with. On a sections-first module the BOARDS are the shape, so a
        // module outline is a second source of it that can only disagree.
        // Without one the derived band draws, which is a real board on screen.
        // "Shape this board" still gives any board its own polygon.
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared "+ Track" wiring — used both on the Track drawing tool (canvas
  // context bar) and in the Objects list.
  const trackAdd = {
    passingSiding: armSiding,
    spur: armSpur,
    crossover: addCrossover,
    /**
     * Choose whether the main is single or double — it does NOT add one. Every
     * module already has a main: it IS the centre-line, from the moment the
     * module has a length.
     *
     * An owner building a 12″ single-track control point read this as "add a
     * single track", clicked it on a module that was ALREADY single, and got a
     * silent no-op: *"I could not add the track… I selected Single Track radio
     * button but couldn't determine how to actually add the track segment"*
     * (#210). So it now also SELECTS the main, which opens its panel and puts
     * its handles on the board — answering the question they were really
     * asking, which is "where is my track?".
     */
    mainline: (config: "single" | "double") => {
      patch((s) => {
        s.configA = config;
        if (s.configB !== "none") s.configB = config;
      });
      setSelection({ kind: "track", id: MAIN_TRACK_ID });
    },
  };
  const canCrossover =
    !state.loop && (state.configA === "double" || state.configB === "double");
  const trackMenu = (
    <AddTrackMenu
      add={trackAdd}
      mainlineDouble={isDouble}
      mainlineLocked={lockedConfigs.a || lockedConfigs.b}
      canCrossover={canCrossover}
      turnoutCount={state.turnouts.length}
      align="left"
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-100">
      {/* Top bar — identity, readiness, save. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3">
        <Link
          href={`/modules/${moduleId}`}
          className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title="Back to module"
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{moduleName}</div>
          <div className="truncate text-xs text-gray-500">{recordNumber}</div>
        </div>
        <Readiness state={state} onGo={setTool} />
        {readOnly && (
          <span
            className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"
            title="You are an admin viewing a module you don't own. Nothing you do here is saved."
            role="status"
          >
            👁 Viewing as admin — read-only
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!readOnly && (
          <>
          <button
            type="button"
            onClick={undo}
            disabled={hist.undo === 0}
            title="Undo (Ctrl+Z)"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={hist.redo === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            ↷
          </button>
          <span className="mx-1 h-5 w-px bg-gray-200" />
          <SaveBadge state={saveState} error={error} />
          {/* Autosave already runs ~1s after a change; this Save flushes it now
              for anyone who wants to save explicitly (or retry after an error). */}
          <button
            type="button"
            onClick={() => void runSave()}
            disabled={saveState === "saved" || saveState === "saving"}
            title="Save now (changes also autosave)"
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={clearDrawing}
            title="Clear the whole schematic"
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-700"
          >
            Clear
          </button>
          </>
          )}
        </div>
      </header>

      {/* Body: tool rail | canvas (+ dispatcher strip) | inspector */}
      <div className="flex min-h-0 flex-1">
        <ToolRail tool={tool} setTool={setTool} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="min-h-0 flex-1 rounded-lg border border-gray-200 bg-white p-2">
              <BenchworkEditor
                outline={activeSection ? (activeSection.outline ?? []) : state.outline}
                // The loop's donut hole — only for the whole-module board, not a
                // section being shaped on its own.
                outlineInner={activeSection ? [] : state.outlineInner}
                onChange={(next) =>
                  activeSection
                    ? setSections(
                        state.sections.map((sec) =>
                          sec.id === activeSection.id
                            ? { ...sec, outline: next.length >= 3 ? next : null }
                            : sec,
                        ),
                      )
                    : patch((s) => (s.outline = next))
                }
                // `undefined`, not `[]`: a fresh array here would change identity
                // every render and defeat the memo that reads it.
                contextOutlines={activeSection ? otherSectionOutlines : undefined}
                seedOutline={activeSectionBand}
                editingLabel={
                  activeSection
                    ? `Shaping ${activeSection.name || `section ${state.sections.indexOf(activeSection) + 1}`}`
                    : null
                }
                lengthInches={state.lengthInches}
                poses={poses}
                mainPath={state.mainPath}
                onMainPathChange={(next) => patch((s) => (s.mainPath = next))}
                main2Path={state.main2Path}
                onMain2PathChange={(next) => patch((s) => (s.main2Path = next))}
                endplateWidths={state.endplateWidths}
                endplateTrackOffsets={renderTrackOffsets}
                centerline={footprint.centerline}
                mainLane={doc.tracks.find((t) => t.id === MAIN_TRACK_ID)?.lane ?? 0}
                sectionBreaks={canvasSectionBreaks}
                onSectionBreakMove={moveSectionJoint}
                onEndplateEndMove={moveEndplateEnd}
                onEndplateMove={moveEndplate}
                tracks={canvasTracks}
                turnouts={canvasTurnouts}
                signals={canvasSignals}
                industries={canvasIndustries}
                tool={tool}
                pieces={state.graph?.pieces ?? []}
                onPiecesChange={setPieces}
                rebuildOffer={
                  <RebuildAsPieces
                    doc={doc}
                    library={partLibrary}
                    readOnly={readOnly}
                    onRebuild={rebuildAsPieces}
                  />
                }
                onTurnoutMove={moveTurnout}
                onTrackEndMove={(id, end, pos) =>
                  patch((s) => {
                    const t = s.extraTracks.find((x) => x.id === id);
                    if (!t) return;
                    if (end === "from") t.fromPos = pos;
                    else t.toPos = pos;
                  })
                }
                onIndustryEndMove={(id, end, pos) =>
                  patch((s) => {
                    const ind = s.industries.find((x) => x.id === id);
                    if (!ind) return;
                    if (end === "from") ind.fromPos = pos;
                    else ind.toPos = pos;
                  })
                }
                onAddIndustry={addIndustryAt}
                trackMenu={trackMenu}
                pendingTrack={pendingTrack}
                onPlaceTrack={onPlaceTrack}
                onCancelPlace={() => setPendingTrack(null)}
                onDropTurnout={onDropTurnout}
                onDropCrossover={onDropCrossover}
                onDropSignal={onDropSignal}
                flexCutsByTrack={flexCutsByTrack}
                onTrackEndDrop={mergeAbutting}
                onTurnoutDrop={onTurnoutDrop}
                onTrackPathChange={(id, path) =>
                  patch((s) => {
                    const t = s.extraTracks.find((x) => x.id === id);
                    if (t) t.path = path.length >= 2 ? path : undefined;
                  })
                }
                selection={isCanvasSel(selection) ? selection : null}
                onSelect={setSelection}
                partLibrary={partLibrary}
              />
            </div>
          </div>
          <DispatcherStrip
            doc={doc}
            highlightId={
              selection &&
              (selection.kind === "turnout" ||
                selection.kind === "track" ||
                selection.kind === "crossing")
                ? selection.id
                : null
            }
          />
        </div>

        {/* The one inspector. */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">
          <Inspector
            selection={selection}
            select={setSelection}
            state={state}
            patch={patch}
            setPieces={setPieces}
            graphReadout={graphReadout}
            onTurnoutPos={moveTurnout}
            mains={mainRows}
            flex={flexByTrack}
            partLibrary={partLibrary}
            dims={dims}
            setDim={setDim}
            geometries={geometries}
            geoSpec={geoSpec}
            lockedConfigs={lockedConfigs}
            derivedPoses={derivedPoses}
            wantsManualPose={wantsManualPose}
            setEndplateWidth={setEndplateWidth}
            setEndplateTrackOffset={setEndplateTrackOffset}
            setSections={setSections}
            countOnSection={countOnSection}
            onNewDivergeTrack={newDivergeTrack}
            onDivergeToEndplate={divergeToEndplate}
            activeSectionId={activeSectionId ?? state.sections[0]?.id ?? null}
            onShapeSection={(id) => {
              setActiveSectionId(id);
              setTool("benchwork");
            }}
            sectionMeets={sectionMeets}
            floatingSections={floatingSections}
            trackOptions={trackOptions}
            industryTypes={industryTypes}
            carTypes={carTypeOptions}
            onCarTypeSuggested={addCarTypeOption}
          />
          <ObjectsList
            state={state}
            selection={selection}
            select={setSelection}
            setTool={setTool}
            add={{
              ...trackAdd,
              turnout: addTurnout,
              crossing: addCrossing,
              controlPoint: addControlPoint,
              industry: addIndustry,
              endplate: addEndplate,
            }}
            mains={mainRows}
            flex={flexByTrack}
            mainlineDouble={isDouble}
            mainlineLocked={lockedConfigs.a || lockedConfigs.b}
            endplates={poses.map((p) => ({ id: p.id, config: p.trackConfig }))}
            undeclaredCrossings={undeclaredCrossings}
          />
        </aside>
      </div>
    </div>
  );
}

/** The tools that decide what a canvas click means. Select and Benchwork are
 * live; the rest are placeholders for later stages (drawn track, signals…) so
 * the rail's shape is settled. Each has a single-key shortcut. */
type RailTool = {
  id?: CanvasTool;
  key: string;
  label: string;
  glyph: string;
  hint: string;
  soon?: boolean;
};

// Grouped so the rail reads in sections: the pointer, then everything you draw
// on the board (board → main → sidings → turnouts → signals), then the
// operations overlay. Turnouts and signals sit with the track tools, not below
// Industry. Dividers separate the groups.
const TOOL_GROUPS: RailTool[][] = [
  [{ id: "select", key: "V", label: "Select", glyph: "▶", hint: "Select & move (V)" }],
  [
    { id: "benchwork", key: "B", label: "Benchwork", glyph: "▱", hint: "Draw the board outline (B)" },
    {
      id: "track",
      key: "T",
      label: "Track",
      glyph: "═",
      // ⭐ ONE JOB, AND NOW ONE BUTTON FOR IT. A turnout is a thing you put on
      // track, not a separate activity, so its palette lives here rather than in
      // a rail button of its own — and laying track as the PIECES it is built
      // from (ADR 0001) is not a separate activity either, so the Pieces tool
      // (P) folded in here too (#198 step 4). The MODULE decides which of the
      // two models this click means; see `graphAuthoring` in benchwork-editor.
      hint: "Build track — lay the pieces, or draw the main and drop a turnout (T)",
    },
    { id: "signal", key: "S", label: "Signal", glyph: "⚑", hint: "Drop a signal / control point on the main (S)" },
  ],
  [{ id: "industry", key: "I", label: "Industry", glyph: "▢", hint: "Place an industry on a track (I)" }],
];

/** The section lengths implied by the joint positions — the gaps between end A,
 * each joint, and end B. A module always has one more section than joints. */
function sectionLengths(breaks: number[], lengthInches: number): number[] {
  const edges = [0, ...breaks, lengthInches];
  return edges.slice(1).map((e, i) => e - edges[i]);
}

/**
 * A number field that COMMITS ON BLUR (or Enter), not per keystroke.
 *
 * ⭐ Two separate bugs live here, and both are why a per-keystroke number input
 * is almost always wrong:
 *
 * 1. **You cannot type a negative number.** The "−" of "−6" parses as NaN on its
 *    own, so whatever the handler does with NaN happens before you've typed the
 *    6 — the value is zeroed, cleared, or corrupted, and the field fights you.
 *    An owner reported it on the benchwork corners: *"I can't enter '-6'.
 *    Instead I have to enter 0 and press − until I get a value −6.xxx and then
 *    delete the trailing digits"* (#209). `LaneField` below exists for exactly
 *    this on lanes (#134); this is the same fix for every other signed field.
 * 2. **A committed value clamped against a neighbour shrinks as you type** —
 *    "18" applies 1 first, the neighbour absorbs 29, and there's nothing left
 *    to give by the time you reach the 8. That's the flex piece length (#193)
 *    and the section lengths below.
 *
 * Holding a draft until blur fixes both: what you type is what gets applied.
 *
 * `value: null` shows an empty field, and clearing one commits `null` — for a
 * field whose blank is meaningful ("use the standard's recommendation").
 */
/**
 * What the pieces derive to, live (ADR 0001).
 *
 * ⭐ This is the whole claim made visible while you draw: lay a turnout and a
 * siding appears here, with the very positions the dispatcher view will get,
 * because it IS the derivation — `graphToDoc`, the same function, not a preview
 * of it.
 *
 * The warnings matter more than the tally. An open end or a stacked joint is
 * the difference between track that is joined and track that merely looks it,
 * and it cannot be seen from the drawing: a piece a third of an inch short of
 * snapping is drawn exactly like one that met.
 */
function GraphReadout({
  readout,
}: {
  readout: {
    derived: ReturnType<typeof graphToDoc>["doc"];
    walk: ReturnType<typeof graphToDoc>["walk"];
    warnings: string[];
  } | null;
}) {
  if (!readout) return null;
  const { derived, warnings } = readout;
  const extra = derived.tracks.filter((t) => t.role !== "main");
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-600">
      <div className="font-medium text-gray-700">These pieces make</div>
      <div>
        Main {derived.lengthInches?.toFixed(1)}″
        {extra.length > 0 &&
          ` · ${extra.map((t) => `${t.role} ${t.fromPos?.toFixed(1)}–${t.toPos?.toFixed(1)}″`).join(" · ")}`}
        {derived.turnouts?.length ? ` · ${derived.turnouts.length} turnout${derived.turnouts.length > 1 ? "s" : ""}` : ""}
      </div>
      {warnings.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-700">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommitNumberField({
  value,
  onCommit,
  inp,
  title,
  step = 0.5,
  placeholder,
}: {
  value: number | null;
  /** `null` = the field was cleared. */
  onCommit: (n: number | null) => void;
  inp: string;
  title?: string;
  step?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim();
    setDraft(null);
    if (raw === "") onCommit(null);
    else {
      const n = Number(raw);
      // Unparseable ("−", "1e", "abc") reverts to the current value rather than
      // committing a NaN — dropping the draft has already done that.
      if (Number.isFinite(n)) onCommit(n);
    }
  };
  return (
    <input
      type="number"
      step={step}
      value={draft ?? (value ?? "")}
      title={title}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`mt-0.5 ${inp}`}
    />
  );
}

/** Re-derive the joints after retyping ONE section's length (#96 phase 1).
 * The difference is absorbed by the NEXT section, so the module's overall
 * length never changes and nothing downstream has to move — track, turnouts,
 * signals and industries are all positioned in absolute inches from end A.
 * That's also why the last section is derived rather than editable. */
function resizeSection(
  breaks: number[],
  lengthInches: number,
  index: number,
  nextLength: number,
): number[] {
  const lens = sectionLengths(breaks, lengthInches);
  if (index < 0 || index >= lens.length - 1) return breaks;
  if (!Number.isFinite(nextLength)) return breaks;
  const MIN = 1; // a section thinner than an inch is a slip of the keyboard
  const pair = lens[index] + lens[index + 1];
  if (pair < 2 * MIN) return breaks;
  const v = Math.max(MIN, Math.min(pair - MIN, nextLength));
  lens[index] = v;
  lens[index + 1] = pair - v;
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < lens.length - 1; i++) {
    acc += lens[i];
    out.push(Math.round(acc * 1000) / 1000);
  }
  return out;
}

/** Per-section length fields. Deliberately COMMITS ON BLUR, not per keystroke:
 * resizeSection takes the difference from the next section and clamps to it, so
 * committing mid-typing shrinks the pair under you. Typing "72" over a 24 next
 * to a 24 used to commit "7" first (neighbour → 41), leaving only 47 of headroom
 * for the real value — silently wrong, and you had to retype several times to
 * creep up on it. Holding a draft until blur/Enter means what you type is what
 * gets applied. */
/** What to call a track in the UI. IDs are minted from whatever tool made the
 * track and then never change — they're references (a turnout's divergeTrack
 * points at one), so renaming them would break those links. But a stub dropped
 * with a turnout and later set to "Passing siding" would still read "spur2",
 * which is just confusing. So the label follows the track's KIND, and the id
 * stays put underneath. An owner-typed name always wins. */
function trackLabel(
  t: { id: string; role?: string | null; trackName?: string | null },
  index: number,
): string {
  if (t.trackName) return t.trackName;
  const n = index + 1;
  switch (t.role) {
    case "siding":
      return `Siding ${n}`;
    case "spur":
      return `Spur ${n}`;
    case "crossover":
      return `Crossover ${n}`;
    case "main":
      return `Main ${n}`;
    default:
      return t.id;
  }
}

/** The track's lane (stacking row). Commits on blur, not per keystroke, so a
 * NEGATIVE lane can be typed — the "-" of "-1" would otherwise parse as NaN
 * and snap to 1 before you finished, which is exactly why an owner couldn't
 * put a siding below the main (#134). Lane 0 is Main 1, so 0 is rejected. */
function LaneField({
  value,
  onCommit,
  inp,
}: {
  value: number;
  onCommit: (n: number) => void;
  inp: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n !== 0) onCommit(n);
    setDraft(null);
  };
  return (
    <input
      type="number"
      step={1}
      value={draft ?? value}
      title="Stacking row: 1+ above the main(s), −1 below Main 1 (the outside on a double-track module). Applied when you leave the field."
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className={`mt-0.5 ${inp}`}
    />
  );
}

function SectionLengths({
  breaks,
  lengthInches,
  onResize,
  inp,
}: {
  breaks: number[];
  lengthInches: number;
  onResize: (i: number, v: number) => void;
  inp: string;
}) {
  const lens = sectionLengths(breaks, lengthInches);
  const [draft, setDraft] = useState<{ i: number; text: string } | null>(null);
  const commit = () => {
    if (!draft) return;
    const v = parseFloat(draft.text);
    if (Number.isFinite(v)) onResize(draft.i, v);
    setDraft(null);
  };
  return (
    <div className="rounded-md border border-gray-200 p-2">
      <p className="text-xs font-medium text-gray-600">Section lengths (in)</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Joints can sit anywhere. A section boundary is internal to the module, so
        unlike an endplate it has no standard to meet — track may cross it at any
        angle. A length is applied when you leave the field; the difference comes
        out of the next section, so the last one is derived.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {lens.map((len, i, all) => {
          const last = i === all.length - 1;
          return (
            <label key={i} className="block text-xs font-medium text-gray-600">
              {`Section ${i + 1}`}
              {last && <span className="text-gray-400"> (derived)</span>}
              <input
                type="number"
                min={1}
                step={0.25}
                value={draft?.i === i ? draft.text : Math.round(len * 100) / 100}
                disabled={last}
                onChange={(e) => setDraft({ i, text: e.target.value })}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setDraft(null);
                }}
                className={`mt-0.5 ${inp} ${last ? "bg-gray-50 text-gray-600" : ""}`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Turn a module's existing joints into real sections (#108). Each gap becomes
 * a board, seeded from the module's own geometry — which is exactly right,
 * because until now that geometry WAS every board's geometry. From there the
 * owner can make individual boards curve. */
function sectionsFromBreaks(
  breaks: number[],
  lengthInches: number,
  geometryType: string,
  geometryDegrees: string,
  geometryOffsetInches: string,
): SchematicSection[] {
  const edges = [0, ...breaks, lengthInches];
  const lens = edges.slice(1).map((e, i) => e - edges[i]).filter((L) => L > 0);
  return lens.map((L, i) => ({
    id: `sec${i + 1}`,
    lengthInches: Math.round(L * 1000) / 1000,
    // Only the FIRST board inherits a turn: a 90° module is one 90° corner, not
    // N of them. The rest carry on straight from where it leaves off.
    ...(i === 0 && geometryType && geometryType !== "straight"
      ? {
          geometryType,
          ...(geometryDegrees ? { geometryDegrees: Number(geometryDegrees) } : {}),
          ...(geometryOffsetInches ? { geometryOffsetInches: Number(geometryOffsetInches) } : {}),
        }
      : {}),
  }));
}

/** The module's sections — what you author FIRST (#108). Each board carries its
 * own length and shape; the module's length and centre-line are derived by
 * chaining them. That's the only way to describe a module like One Mile, which
 * runs straight for most of its length with a couple of curved boards in the
 * middle — no single module-level geometry can say that. */
function SectionList({
  sections,
  geometries,
  onChange,
  onBoard,
  main2Below,
  activeId,
  onShape,
  meets,
  floating,
  inp,
}: {
  sections: SchematicSection[];
  geometries: {
    value: string;
    display_label: string;
    requires_degrees: boolean;
    requires_offset_inches: boolean;
  }[];
  onChange: (next: SchematicSection[]) => void;
  /** How many placed objects stand on this board — so removing it can say so
   * rather than silently displacing them (#195). */
  onBoard?: (sectionId: string) => number;
  /** Whether Main 2 runs below Main 1 — a double end's recommended offset flips
   * with it (#190), so an end authored for a swapped module must not read as
   * off-centre (#130). */
  main2Below?: boolean;
  activeId: string | null;
  onShape: (id: string) => void;
  meets: { a: string; b: string; lengthInches: number }[];
  floating: Set<string>;
  inp: string;
}) {
  // Length commits on blur, for the same reason the old joint fields had to: a
  // half-typed number shouldn't reshape the board under you.
  const [draft, setDraft] = useState<{ i: number; text: string } | null>(null);
  const set = (i: number, next: Partial<SchematicSection>) =>
    onChange(sections.map((sec, j) => (j === i ? { ...sec, ...next } : sec)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const n = sections.reduce((m, sec) => {
      const k = /^sec(\d+)$/.exec(sec.id);
      return k ? Math.max(m, Number(k[1])) : m;
    }, sections.length);
    onChange([...sections, { id: `sec${n + 1}`, lengthInches: 24 }]);
  };
  const total = sections.reduce((a, sec) => a + (sec.lengthInches ?? 0), 0);

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-2">
      <div className="flex items-baseline gap-2">
        <p className="text-xs font-medium text-gray-600">Sections</p>
        <p className="ml-auto text-xs text-gray-500">
          {sections.length} &middot; {Math.round(total * 100) / 100}&Prime; total
        </p>
      </div>
      <p className="text-xs text-gray-500">
        The boards this module is built from, west to east. Each carries its own
        length and shape &mdash; the module&rsquo;s length and centre-line are
        derived by chaining them, so a mostly-straight module can still have a
        couple of curved boards in the middle.
      </p>
      {sections.map((sec, i) => {
        const spec = geometries.find((g) => g.value === (sec.geometryType || "straight"));
        return (
          <div
            key={sec.id}
            className={`space-y-1.5 rounded border p-1.5 ${
              sec.id === activeId ? "border-blue-400 bg-blue-50/40" : "border-gray-200"
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-500">{i + 1}</span>
              <input
                type="text"
                value={sec.name ?? ""}
                placeholder={`Section ${i + 1}`}
                onChange={(e) => set(i, { name: e.target.value })}
                className={`${inp} flex-1`}
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Move west"
                className="rounded px-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &uarr;
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === sections.length - 1}
                title="Move east"
                className="rounded px-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &darr;
              </button>
              {/* ⚠️ Removing a board is the one section edit the remap CAN'T
                  rescue: everything else moves with its board, but a board
                  that's gone has nowhere to send what stood on it, so those
                  positions keep a stale absolute and quietly land on whatever
                  board now occupies those inches (#195). Say what's on it. */}
              <button
                type="button"
                onClick={() => {
                  const n = onBoard?.(sec.id) ?? 0;
                  if (
                    n > 0 &&
                    !window.confirm(
                      `Remove this board?\n\n${n} thing${n === 1 ? "" : "s"} — track, turnouts, ` +
                        `signals or industries — ${n === 1 ? "is" : "are"} placed on it. ` +
                        `${n === 1 ? "It" : "They"} won't be removed, but with the board gone ` +
                        `${n === 1 ? "it has" : "they have"} nowhere to go, so ${n === 1 ? "it" : "they"} ` +
                        `will end up on whichever board takes over those inches.\n\n` +
                        `Move ${n === 1 ? "it" : "them"} off this board first if that's not what you want.`,
                    )
                  )
                    return;
                  onChange(sections.filter((_, j) => j !== i));
                }}
                title="Remove this section"
                className="rounded px-1 text-xs text-red-600 hover:bg-red-50"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block text-xs font-medium text-gray-600">
                Length (in)
                <input
                  type="number"
                  min={1}
                  step={0.25}
                  value={draft?.i === i ? draft.text : (sec.lengthInches ?? "")}
                  onChange={(e) => setDraft({ i, text: e.target.value })}
                  onBlur={() => {
                    if (draft?.i !== i) return;
                    const v = parseFloat(draft.text);
                    if (Number.isFinite(v) && v > 0) set(i, { lengthInches: v });
                    setDraft(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setDraft(null);
                  }}
                  className={`mt-0.5 ${inp}`}
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Shape
                <select
                  value={sec.geometryType || "straight"}
                  onChange={(e) =>
                    set(i, {
                      geometryType: e.target.value,
                      geometryDegrees: null,
                      geometryOffsetInches: null,
                    })
                  }
                  className={`mt-0.5 ${inp}`}
                >
                  {geometries.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.display_label}
                    </option>
                  ))}
                </select>
              </label>
              {spec?.requires_degrees && (
                <label className="block text-xs font-medium text-gray-600">
                  Degrees
                  <input
                    type="number"
                    step={0.001}
                    value={sec.geometryDegrees ?? ""}
                    onChange={(e) =>
                      set(i, { geometryDegrees: e.target.value ? Number(e.target.value) : null })
                    }
                    className={`mt-0.5 ${inp}`}
                  />
                </label>
              )}
              {spec?.requires_offset_inches && (
                <label className="block text-xs font-medium text-gray-600">
                  Offset (in)
                  <input
                    type="number"
                    step={0.001}
                    value={sec.geometryOffsetInches ?? ""}
                    onChange={(e) =>
                      set(i, {
                        geometryOffsetInches: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={`mt-0.5 ${inp}`}
                  />
                </label>
              )}
            </div>
            {(() => {
              const names = sectionNeighbours(sec.id, meets).map((id) => {
                const k = sections.findIndex((x) => x.id === id);
                return sections[k]?.name || `section ${k + 1}`;
              });
              if (floating.has(sec.id))
                return (
                  <p className="rounded bg-amber-50 px-1.5 py-1 text-xs text-amber-800" role="status">
                    ⚠ Doesn&rsquo;t touch the rest of the module. A module is one
                    piece of bench work — give this board a shape that meets a
                    neighbour, or change its length.
                  </p>
                );
              return (
                <p className="text-xs text-gray-500">
                  {names.length ? `Meets ${names.join(", ")}` : "Meets nothing yet"}
                </p>
              );
            })()}
            {/* THIS BOARD'S TWO ENDS (#130). Owner's question was "how would I
                update my section joints to be endplates from within MR?" — you
                describe the end, and whether it IS one is derived. There is
                deliberately no "this is an endplate" tickbox: ticked wrongly, the
                registry would promise Free-Dispatcher a mating surface that
                isn't there. */}
            <div className="rounded border border-gray-200 p-1.5">
              <p className="mb-1 text-xs font-medium text-gray-600">Ends of this board</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["endA", "endB"] as const).map((key) => {
                  const end = sec[key] ?? null;
                  const a = assessSectionEnd(end, { main2Below });
                  return (
                    <div key={key} className="space-y-1">
                      <label className="block text-[11px] font-medium text-gray-500">
                        {key === "endA" ? "West end" : "East end"}
                        <select
                          value={end?.config ?? ""}
                          onChange={(e) =>
                            set(i, {
                              [key]: e.target.value
                                ? { ...(end ?? {}), config: e.target.value as TrackConfig | "none" }
                                : null,
                            })
                          }
                          className={`mt-0.5 ${inp} text-xs`}
                        >
                          <option value="">Internal joint</option>
                          <option value="single">Endplate · single</option>
                          <option value="double">Endplate · double</option>
                          <option value="none">Closed (bumper)</option>
                        </select>
                      </label>
                      {a.described && (
                        <label className="block text-[11px] font-medium text-gray-500">
                          Face width (in)
                          <input
                            type="number"
                            min={12}
                            step={0.5}
                            value={end?.widthInches ?? ""}
                            placeholder="24"
                            onChange={(e) =>
                              set(i, {
                                [key]: {
                                  ...(end ?? {}),
                                  widthInches: e.target.value ? Number(e.target.value) : null,
                                },
                              })
                            }
                            className={`mt-0.5 ${inp} text-xs`}
                          />
                        </label>
                      )}
                      {a.described &&
                        (a.conforming ? (
                          <p className="text-[11px] text-green-700">
                            ✓ A standard endplate — this board can be used on its own.
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700">⚠ {a.issues[0]?.message}</p>
                        ))}
                    </div>
                  );
                })}
              </div>
              {/* What the JOINT with the next board is, once both sides are described. */}
              {(() => {
                const next = sections[i + 1];
                if (!next) return null;
                const j = assessSectionJoint(sec.endB, next.endA, { main2Below });
                if (j.standardInterface)
                  return (
                    <p className="mt-1 text-[11px] text-green-700">
                      ✓ Standard interface with {next.name || `section ${i + 2}`} — these two
                      boards could be separated and each used against any module.
                    </p>
                  );
                if (j.west.described || j.east.described)
                  return <p className="mt-1 text-[11px] text-amber-700">⚠ Joint: {j.reason}</p>;
                return null;
              })()}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={sec.outline ? "text-gray-600" : "text-gray-400"}>
                {sec.outline ? "Shape: drawn" : "Shape: derived from length"}
              </span>
              <button
                type="button"
                onClick={() => onShape(sec.id)}
                className="ml-auto font-medium text-blue-600 hover:underline"
              >
                Shape this board
              </button>
              {sec.outline && (
                <button
                  type="button"
                  onClick={() => set(i, { outline: null })}
                  title="Go back to the band derived from this section's length"
                  className="text-gray-500 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="w-full rounded border border-dashed border-gray-300 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        + Add section
      </button>
    </div>
  );
}

function ToolRail({
  tool,
  setTool,
}: {
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;
}) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-2">
      {TOOL_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <div className="my-1 h-px w-6 bg-gray-200" />}
          {group.map((t) => {
            if (t.soon || !t.id) {
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled
                  title={t.hint}
                  className="flex h-9 w-9 cursor-not-allowed flex-col items-center justify-center rounded-md text-base leading-none text-gray-300"
                >
                  <span>{t.glyph}</span>
                  <span className="mt-0.5 text-[9px] font-medium">{t.key}</span>
                </button>
              );
            }
            const on = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id!)}
                title={t.hint}
                aria-pressed={on}
                className={`flex h-9 w-9 flex-col items-center justify-center rounded-md text-base leading-none transition ${
                  on ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{t.glyph}</span>
                <span className="mt-0.5 text-[9px] font-medium">{t.key}</span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Autosave status pill in the top bar (replaces the Save button). */
function SaveBadge({
  state,
  error,
}: {
  state: "saved" | "unsaved" | "saving" | "error";
  error: string | null;
}) {
  if (state === "error") {
    return (
      <span className="max-w-[16rem] truncate text-xs font-medium text-red-700" title={error ?? undefined}>
        ⚠ {error ?? "Save failed"}
      </span>
    );
  }
  const map = {
    saved: { text: "Saved", cls: "text-green-700" },
    saving: { text: "Saving…", cls: "text-gray-500" },
    unsaved: { text: "Unsaved", cls: "text-amber-600" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

/** True when a key event targets a text field — so shortcuts don't hijack typing. */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
}

/** The derived dispatcher view. Never authored — so it gets a strip, not a
 * column. It's glanceable because it's *why* the module data exists. */
function DispatcherStrip({
  doc,
  highlightId,
}: {
  doc: ReturnType<typeof stateToDoc>;
  highlightId: string | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="shrink-0 border-t border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
        Dispatcher view
        <span className="font-normal text-gray-400">— derived, A → B</span>
      </button>
      {open && (
        <div className="max-h-44 overflow-auto px-3 pb-3">
          <SchematicPreview doc={doc} highlightId={highlightId} />
        </div>
      )}
    </div>
  );
}

/**
 * Build order, as advice rather than a gate. The stage rail used to hide fields
 * to enforce this order; the hints were the only completeness signal in the app,
 * so they survive here — now they say what's missing without locking anything.
 */
const STAGES: {
  id: string;
  label: string;
  hint: (s: EditorState) => string;
  done: (s: EditorState) => boolean;
  tool?: CanvasTool;
}[] = [
  {
    id: "mainline",
    label: "Dimensions & endplates",
    hint: (s) =>
      `${s.lengthInches}″ · ${s.configA}${s.configB === "none" ? "" : ` / ${s.configB}`}`,
    done: (s) => s.lengthInches > 0,
  },
  {
    id: "benchwork",
    label: "Benchwork",
    hint: (s) => (s.outline.length ? `${s.outline.length}-corner shape` : "not drawn"),
    done: (s) => s.outline.length >= 3,
    tool: "benchwork",
  },
  {
    id: "track",
    label: "Track",
    hint: (s) =>
      `${s.extraTracks.length} track${s.extraTracks.length === 1 ? "" : "s"} · ${s.turnouts.length} turnout${s.turnouts.length === 1 ? "" : "s"}`,
    done: (s) => s.extraTracks.length > 0,
  },
  {
    id: "industries",
    label: "Industries",
    hint: (s) =>
      s.industries.length
        ? `${s.industries.length} industr${s.industries.length === 1 ? "y" : "ies"}`
        : "none placed",
    // Optional: a module may legitimately have no industries, so "done" once
    // there's track to place them on (never blocks completion).
    done: (s) => s.industries.length > 0 || s.extraTracks.length === 0,
  },
  {
    id: "operations",
    label: "Operations",
    hint: (s) =>
      `${s.controlPoints.length} control point${s.controlPoints.length === 1 ? "" : "s"}`,
    done: (s) => s.controlPoints.length > 0,
  },
];

function Readiness({
  state,
  onGo,
}: {
  state: EditorState;
  onGo: (t: CanvasTool) => void;
}) {
  const left = STAGES.filter((s) => !s.done(state)).length;
  return (
    <details className="relative shrink-0">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
        <span className={left ? "text-amber-500" : "text-green-600"}>{left ? "⚠" : "✓"}</span>
        {left ? `${left} to do` : "Complete"}
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
        <p className="px-1 pb-1 text-xs text-gray-400">
          Built in order: the dimensions size the board, the board carries the
          track, the track carries the signals.
        </p>
        {STAGES.map((s) => {
          const ok = s.done(state);
          return (
            <div key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs">
              <span className={ok ? "text-green-600" : "text-amber-500"}>{ok ? "✓" : "⚠"}</span>
              <span className="font-medium text-gray-800">{s.label}</span>
              <span className="ml-auto text-gray-500">{s.hint(state)}</span>
              {!ok && s.tool && (
                <button
                  type="button"
                  onClick={() => onGo(s.tool!)}
                  className="shrink-0 font-medium text-blue-600 hover:underline"
                >
                  Draw it
                </button>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

/**
 * The one inspector. With nothing selected it shows the MODULE's properties —
 * which is where the old "mainline" stage's fields live now. That's what lets
 * the stage rail die without orphaning them.
 */
function Inspector({
  selection,
  select,
  state,
  patch,
  onTurnoutPos,
  mains,
  flex,
  partLibrary,
  dims,
  setDim,
  geometries,
  geoSpec,
  lockedConfigs,
  derivedPoses,
  wantsManualPose,
  setEndplateWidth,
  setEndplateTrackOffset,
  setSections,
  countOnSection,
  onNewDivergeTrack,
  onDivergeToEndplate,
  activeSectionId,
  onShapeSection,
  sectionMeets,
  floatingSections,
  trackOptions,
  industryTypes,
  carTypes,
  onCarTypeSuggested,
  setPieces,
  graphReadout,
}: {
  selection: Selection | null;
  select: (s: Selection | null) => void;
  state: EditorState;
  patch: (fn: (s: EditorState) => void) => void;
  /** Lay out the pieces (ADR 0001) — the graph's own setter, because it also
   * keeps `startAt` pointing at a piece that still exists. */
  setPieces: (next: TrackPiece[], opts?: { commit?: boolean }) => void;
  /** What the pieces currently derive to — null when none are laid. */
  graphReadout: {
    derived: ReturnType<typeof graphToDoc>["doc"];
    walk: ReturnType<typeof graphToDoc>["walk"];
    warnings: string[];
  } | null;
  /** Moving a turnout carries its branch route with it, which needs the
   * centre-line — so it's the parent's job, not a raw patch here (#181). */
  onTurnoutPos: (id: string, pos: number) => void;
  /** The mains, with the facts their panels report (#192). */
  mains: {
    id: string;
    label: string;
    drawn: boolean;
    lengthInches: number;
    lane: number;
    fromPos: number;
    toPos: number;
    sub: string;
  }[];
  /** Each run cut into lengths of flex track, by track id (#193). */
  flex: Record<
    string,
    { pieces: FlexPiece[]; partId: string; authored: boolean; runInches: number; alongPath: boolean; unmapped: boolean }
  >;
  partLibrary: TrackPart[];
  dims: ModuleDimensions;
  setDim: (p: Partial<ModuleDimensions>) => void;
  geometries: { value: string; display_label: string; requires_degrees: boolean; requires_offset_inches: boolean }[];
  geoSpec?: { requires_degrees: boolean; requires_offset_inches: boolean };
  lockedConfigs: { a: boolean; b: boolean };
  derivedPoses: EndplatePose[];
  wantsManualPose: boolean;
  setEndplateWidth: (id: string, raw: string) => void;
  setEndplateTrackOffset: (id: string, raw: string) => void;
  setSections: (next: SchematicSection[]) => void;
  /** How many placed objects stand on a board — the remove guard (#195). */
  countOnSection: (sectionId: string) => number;
  onNewDivergeTrack: (turnoutId: string, role: "spur" | "siding") => void;
  onDivergeToEndplate: (turnoutId: string, endplateId: string) => void;
  activeSectionId: string | null;
  onShapeSection: (id: string) => void;
  sectionMeets: { a: string; b: string; lengthInches: number }[];
  floatingSections: Set<string>;
  trackOptions: { value: string; label: string }[];
  industryTypes: { value: string; display_label: string }[];
  carTypes: { value: string; display_label: string }[];
  onCarTypeSuggested: (o: { value: string; display_label: string }) => void;
}) {
  const [loopShape, setLoopShape] = useState<ReturnLoopShape>("teardrop");
  /** Turn the lead into a return loop of the chosen shape: a computed loop
   * centre-line (a section chain can't express the sharp wye at the throat) set
   * as the module's mainPath, plus a wye turnout where the loop rejoins the
   * lead. Tuned visually per shape (#loop). */
  const makeReturnLoop = (shape: ReturnLoopShape) =>
    patch((s) => {
      const L = 48; // lead length (in)
      const R = 24; // balloon radius (in) — ≥ the 22″ Free-moN minimum
      // The lead/interface board must be at least as wide as endplate A, so the
      // benchwork is never narrower than the endplate at the face (Free-moN §2.0).
      const epA = s.endplateWidths["A"] ?? FREEMO_ENDPLATE_WIDTH_RECOMMENDED_INCHES;
      const g = returnLoop(shape, {
        leadInches: L,
        radius: R,
        endplateHalfWidth: epA / 2,
      }); // tested geometry
      // The MAIN is the straight lead (A → throat); the loop is its own track
      // that diverges from the wye and returns to it (a real return loop).
      s.mainPath = [];
      s.lengthInches = L;
      s.sections = [];
      s.outline = g.outlineOuter.map((p) => ({ x: p.x, y: p.y }));
      // The open middle of the loop — makes the board a DONUT, not a filled disc.
      s.outlineInner = g.outlineInner.map((p) => ({ x: p.x, y: p.y }));
      s.loop = true;
      s.configB = "none"; // a pure turnback
      // Regenerating REPLACES the previous loop — drop the old return-loop track
      // and its wye, or each "Make loop" would stack another loop on top.
      const oldLoopIds = new Set(
        s.extraTracks.filter((t) => t.role === "branch" && t.trackName === "Return loop").map((t) => t.id),
      );
      s.extraTracks = s.extraTracks.filter((t) => !oldLoopIds.has(t.id));
      s.turnouts = s.turnouts.filter((t) => !(t.kind === "wye" && oldLoopIds.has(t.divergeTrack ?? "")));
      // The return-loop track: diverges from the wye, around, back to the wye.
      const loopId = nextId("loop", s.extraTracks.map((t) => t.id));
      s.extraTracks.push({
        id: loopId,
        role: "branch",
        lane: 1,
        fromPos: L,
        toPos: L,
        path: g.loop.map((p) => ({ x: p.x, y: p.y })),
        moduleTrackId: null,
        trackName: "Return loop",
      });
      // The wye at the throat, diverging to the loop track.
      const swId = nextId("sw", s.turnouts.map((t) => t.id));
      s.turnouts.push({ id: swId, pos: L, onTrack: MAIN_TRACK_ID, divergeTrack: loopId, kind: "wye", name: "Wye" });
    });
  const head = (title: string, sub?: string) => (
    <div className="mb-3 border-b border-gray-100 pb-2">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
  const box = "shrink-0 p-3";

  // ---- Nothing selected → the module itself ----
  const hasSections = state.sections.length > 0;
  if (!selection) {
    return (
      <div className={box}>
        {head("Module", "Nothing selected — these size the board everything else is drawn on.")}
        <div className="space-y-3">
          {/* Shape and length belong to the SECTIONS once a module has any
              (#108) — the module-level fields can't describe a board that
              curves partway along, so they step aside rather than sit there
              contradicting the section list. */}
          {!hasSections && (
            <label className="block text-xs font-medium text-gray-600">
              Geometry
              <select
                value={dims.geometry_type}
                onChange={(e) =>
                  setDim({ geometry_type: e.target.value, geometry_degrees: "", geometry_offset_inches: "" })
                }
                className={`mt-0.5 ${inp}`}
              >
                <option value="">—</option>
                {geometries.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.display_label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!hasSections && geoSpec?.requires_degrees && (
            <label className="block text-xs font-medium text-gray-600">
              Degrees
              <input
                type="number"
                step={0.001}
                value={dims.geometry_degrees}
                onChange={(e) => setDim({ geometry_degrees: e.target.value })}
                className={`mt-0.5 ${inp}`}
              />
            </label>
          )}
          {!hasSections && geoSpec?.requires_offset_inches && (
            <label className="block text-xs font-medium text-gray-600">
              Offset (in)
              <input
                type="number"
                step={0.001}
                value={dims.geometry_offset_inches}
                onChange={(e) => setDim({ geometry_offset_inches: e.target.value })}
                className={`mt-0.5 ${inp}`}
              />
            </label>
          )}
          <label className="block text-xs font-medium text-gray-600">
            Footprint length (in)
            {hasSections && <span className="text-gray-400"> (derived)</span>}
            <input
              type="number"
              step={0.001}
              value={dims.length_total_inches}
              disabled={hasSections}
              onChange={(e) => setDim({ length_total_inches: e.target.value })}
              className={`mt-0.5 ${inp} ${hasSections ? "bg-gray-50 text-gray-600" : ""}`}
              title={
                hasSections
                  ? "The sum of this module's section lengths — edit the sections to change it."
                  : "The physical length of the board. Draw the mainline (M) if the rail runs a different distance than the board."
              }
            />
          </label>
          {hasSections ? (
            <SectionList
              sections={state.sections}
              geometries={geometries}
              onChange={setSections}
              onBoard={countOnSection}
              main2Below={state.mainsSwapped === true}
              activeId={activeSectionId}
              onShape={onShapeSection}
              meets={sectionMeets}
              floating={floatingSections}
              inp={inp}
            />
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-600">
                Sections
                <input
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={state.sectionBreaks.length + 1}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
                    patch((s) => {
                      const L = s.lengthInches;
                      s.sectionBreaks = Array.from({ length: n - 1 }, (_, i) =>
                        Math.round((L * (i + 1)) / n),
                      );
                    });
                  }}
                  className={`mt-0.5 ${inp}`}
                  title="How many bench-work sections the module is built from. The joints are marked on the board; the module still operates as one unit."
                />
              </label>
              {state.sectionBreaks.length > 0 && (
                <SectionLengths
                  breaks={state.sectionBreaks}
                  lengthInches={state.lengthInches}
                  onResize={(i, v) =>
                    patch((s) => {
                      s.sectionBreaks = resizeSection(s.sectionBreaks, s.lengthInches, i, v);
                    })
                  }
                  inp={inp}
                />
              )}
              {/* The way out of module-level geometry. Seeds each board from the
                  joints already drawn — from here individual boards can curve,
                  which is what a module like One Mile needs (#108). */}
              <button
                type="button"
                onClick={() =>
                  setSections(
                    sectionsFromBreaks(
                      state.sectionBreaks,
                      state.lengthInches,
                      dims.geometry_type,
                      dims.geometry_degrees,
                      dims.geometry_offset_inches,
                    ),
                  )
                }
                className="w-full rounded border border-dashed border-gray-300 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Build this module from sections &rarr;
              </button>
              <p className="text-xs text-gray-500">
                Gives every board its own length and shape, so the module can be
                straight for most of its run and still curve partway along.
              </p>
            </>
          )}
          {/* A module presents one conforming face, or two, or more. The
              standard governs the faces it OFFERS for joining, never how many it
              must offer — an end of the line or a pocket has one and the track
              simply stops (#184). This lives here rather than on endplate B's
              inspector for a plain reason: once B is gone there is no B to
              select, so the way back has to be somewhere that always exists. */}
          {!state.loop && (
            <label className="flex gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={state.configB === "none"}
                onChange={(e) =>
                  patch((s) => {
                    s.configB = e.target.checked ? "none" : "single";
                  })
                }
              />
              <span>
                <span className="font-medium">Only one endplate</span> — an end of
                the line or a pocket. End B has no plate and the track just stops
                there; nothing can couple to that end.
              </span>
            </label>
          )}
          <label className="flex gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={state.loop}
              onChange={(e) =>
                patch((s) => {
                  s.loop = e.target.checked;
                  // Toggling loop shouldn't silently create an interchange —
                  // default to a pure turnback; a standard endplate B on the
                  // balloon (pick Single/Double) makes it an interchange.
                  if (s.loop) s.configB = "none";
                  else {
                    if (s.configB === "none") s.configB = "single";
                    s.loopReturn = "same";
                  }
                })
              }
            />
            <span>
              <span className="font-medium">Loop module</span> — the main runs the
              lead and turns back at the balloon (positions past the throat are
              inside the loop). A standard endplate B on the balloon makes it an
              interchange.
            </span>
          </label>
          {/* Turn the lead into a return loop of the chosen shape, with a wye at
              the throat where the loop rejoins the lead (#loop). */}
          <div className="rounded-md border border-gray-200 p-2">
            <p className="mb-1 text-xs font-medium text-gray-700">Return loop (balloon)</p>
            <p className="mb-1.5 text-[11px] text-gray-500">
              Turns the lead into a loop that returns to a wye at the throat.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={loopShape}
                onChange={(e) => setLoopShape(e.target.value as ReturnLoopShape)}
                className={inp}
              >
                <option value="teardrop">Teardrop</option>
                <option value="circle">Circle</option>
                <option value="offset-teardrop">Offset teardrop</option>
                <option value="square">Square</option>
              </select>
              <button
                type="button"
                onClick={() => makeReturnLoop(loopShape)}
                className={`${addBtn} shrink-0`}
              >
                Make loop →
              </button>
            </div>
          </div>
          {/* Which main draws above. MR puts Main 1 on the centre line by
              default, but on some modules the UPPER track is the through/
              primary main (#FMN-0043) — swap the drawn positions. */}
          {(state.configA === "double" || state.configB === "double") && (
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={state.mainsSwapped ?? false}
                onChange={(e) =>
                  patch((s) => {
                    s.mainsSwapped = e.target.checked;
                    // The transition turnout's hand is coupled to which side
                    // Main 2 is on, so re-derive it when the swap flips —
                    // otherwise its leg keeps pointing at where Main 2 used to
                    // be and stops connecting (#149). Same formula as
                    // buildTransition: the leg lands on Main 2's side.
                    const aDouble = s.configA === "double";
                    const kind =
                      (aDouble ? -1 : 1) === (s.mainsSwapped ? -1 : 1) ? "left" : "right";
                    for (const t of s.turnouts) if (isTransitionTurnout(t)) t.kind = kind;
                  })
                }
              />
              <span>
                <span className="font-medium">Draw Main 2 below Main 1</span> — put
                the second main on the lower side of the mainline (the default is
                above). Main 1 stays on the centre line; only Main 2 moves.
              </span>
            </label>
          )}
          {state.loop && state.configA === "double" && (
            <label className="block text-xs font-medium text-gray-600">
              Loop returns onto
              <select
                value={state.loopReturn}
                onChange={(e) => patch((s) => (s.loopReturn = e.target.value as "same" | "main2"))}
                className={`mt-0.5 ${inp}`}
                title="On a double-track main, the balloon can be a directional return: out on Main 1, back on Main 2 — drawn as a U joining the two mains."
              >
                <option value="same">Same main (turnback)</option>
                <option value="main2">Main 2 (directional return)</option>
              </select>
            </label>
          )}
          {/* Transition module (FMN-0038): one end single, the other double —
              the main line needs a turnout where Main 2 begins. */}
          {!state.loop &&
            (state.configA === "double") !== (state.configB === "double") &&
            !state.turnouts.some(isTransitionTurnout) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <p>
                  One end is single track and the other double — the main line
                  needs a transition turnout where Main 2{" "}
                  {state.configA === "double" ? "ends" : "begins"}. This adds the
                  turnout and an <em>End of Double Track</em> control point with
                  signals; adjust its position afterwards.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    patch((s) => {
                      const built = buildTransition(s);
                      if (built) {
                        s.turnouts.push(built.turnout);
                        s.controlPoints.push(built.controlPoint);
                      }
                    })
                  }
                  className="mt-2 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                >
                  + Add transition
                </button>
              </div>
            )}
          <p className="text-xs text-gray-400">
            Select an endplate, corner, track or turnout on the canvas to edit it.
          </p>
        </div>
      </div>
    );
  }

  const shell = (title: string, body: React.ReactNode, remove?: { fn: () => void; label: string }) => (
    <div className={box}>
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={() => select(null)}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-700"
        >
          Done
        </button>
      </div>
      <div className="space-y-3">{body}</div>
      {remove && (
        <button
          type="button"
          onClick={() => {
            remove.fn();
            select(null);
          }}
          className="mt-3 w-full rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          {remove.label}
        </button>
      )}
    </div>
  );

  // ---- Endplate ----
  if (selection.kind === "endplate") {
    const id = selection.id;
    const pose = derivedPoses.find((p) => p.id === id);
    if (!pose) return null;
    const o = state.poseOverrides[id];
    const setPose = (k: "x" | "y" | "heading", v: number | null) =>
      patch((s) => {
        const base = s.poseOverrides[id] ?? { x: pose.x, y: pose.y, heading: pose.heading };
        s.poseOverrides[id] = { ...base, [k]: v ?? 0 };
      });
    // A/B are the schematic's drawing axis; C+ are authored branches.
    const bi = id.charCodeAt(0) - 67;
    const branch = bi >= 0 ? state.branches[bi] : undefined;
    const locked = (id === "A" && lockedConfigs.a) || (id === "B" && lockedConfigs.b && !state.loop);
    // The benchwork's edges, as things an endplate can BE (ADR 0001). A curved
    // edge is offered but disabled rather than hidden, so it is clear why it
    // can't be chosen instead of leaving someone hunting for a missing option.
    const bound = state.endplateEdges?.[id];
    const edgeChoices = (state.outline ?? []).map((p0, i, arr) => {
      const p1 = arr[(i + 1) % arr.length];
      const len = Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) * 10) / 10;
      const e = endplateEdgePose(state.outline, { index: i });
      const compass = (deg: number) =>
        ["east", "north", "west", "south"][Math.round(((deg % 360) + 360) % 360 / 90) % 4];
      return {
        index: i,
        usable: !!e,
        label: e
          ? `Edge ${i + 1} — ${len}″, faces ${compass(e.heading)}`
          : `Edge ${i + 1} — ${len}″, curved (an endplate face must be straight)`,
      };
    });

    return shell(
      `Endplate ${id}`,
      <>
        {branch ? (
          <>
            <label className="block text-xs font-medium text-gray-600">
              Name
              <input
                value={branch.label}
                onChange={(e) => patch((s) => (s.branches[bi].label = e.target.value))}
                className={`mt-0.5 ${inp}`}
                placeholder="e.g. North branch"
              />
            </label>
            <p className="text-[11px] text-gray-400">
              A local name for this endplate. The destination shown on the
              dispatcher panel comes from whatever module is attached here.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-gray-600">
                Position (in from A)
                <input
                  type="number"
                  min={0}
                  value={branch.pos}
                  onChange={(e) => patch((s) => (s.branches[bi].pos = Number(e.target.value) || 0))}
                  className={`mt-0.5 ${inp}`}
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Side
                <select
                  value={branch.side}
                  onChange={(e) => patch((s) => (s.branches[bi].side = e.target.value as "up" | "down"))}
                  className={`mt-0.5 ${inp}`}
                >
                  <option value="up">Up (north)</option>
                  <option value="down">Down (south)</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-gray-600">
                Endplate track
                <select
                  value={branch.config}
                  onChange={(e) => patch((s) => (s.branches[bi].config = e.target.value as "single" | "double"))}
                  className={`mt-0.5 ${inp}`}
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                </select>
              </label>
            </div>
            {/* ⛔ THE "Route is a… Branch line / Diverging main" SELECT IS GONE.
                It asked the module to declare something it cannot know. Whether
                this route is a branch line is a fact about the LAYOUT — which
                railroad owns it, where it goes — and only Free-Dispatcher can
                see that. What the module knows is that an endplate is here and
                track reaches it, and a route reaching an endplate is a MAIN
                (#181/#183, restated by Will on FMN-0068, 2026-07-30).
                ⚠️ Old docs that stored `kind: "branch"` are READ unchanged —
                nothing is auto-migrated (standing constraint). They keep their
                stored value until their owner saves. */}
            <p className="text-[11px] text-gray-400">
              Drag the endplate on the board to place it on a fascia, then draw
              track to it. Track must cross square and run straight for 4″ from
              the face (Free-moN §2.0).
            </p>
          </>
        ) : (
          <label className="block text-xs font-medium text-gray-600">
            {id === "A"
              ? state.loop
                ? "Entry (A) main track"
                : "End A main track"
              : state.loop
                ? "Interchange (B) endplate on the balloon"
                : "End B main track"}
            <select
              value={id === "A" ? state.configA : state.configB}
              disabled={locked}
              title={
                locked
                  ? "Mirrors the module's endplate record — change it in the module's Endplates section."
                  : undefined
              }
              onChange={(e) =>
                patch((s) => {
                  if (id === "A") s.configA = e.target.value as "single" | "double";
                  else s.configB = e.target.value as "single" | "double" | "none";
                })
              }
              className={`mt-0.5 ${inp} ${locked ? "bg-gray-50 text-gray-600" : ""}`}
            >
              {id === "B" && state.loop && <option value="none">None — pure turnback</option>}
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
        )}

        {/* Endplate FACE width — the physical size of the standard interface at
            this end. Free-moN §1.1 requires a 12″ minimum (24″ is our common
            default, not a standard), and §2.0 requires every track crossing to
            clear either fascia by 4″ — both checked below. */}
        <label className="block text-xs font-medium text-gray-600">
          Face width (in)
          <input
            type="number"
            min={12}
            step={0.5}
            value={state.endplateWidths[id] ?? 24}
            onChange={(e) => setEndplateWidth(id, e.target.value)}
            className={`mt-0.5 ${inp}`}
            title="Free-moN §1.1: endplates shall be a minimum 12 in wide. Track must also clear either fascia by 4 in (§2.0)."
          />
        </label>
        {/* Where MAIN 1 crosses this plate. §2.0 requires only that every track
            clear either fascia by 4″; the 20220628 revision relaxed centring to
            a recommendation, so an offset end is legal — a transition section
            commonly offsets its single end so the through main lines up with
            one of the two tracks at its double end. */}
        <label className="block text-xs font-medium text-gray-600">
          Main 1 offset from plate centre (in)
          {/* SIGNED by definition — a double end's own recommended value is
              −0.5625 — and blank is meaningful ("use the recommendation"). Per
              keystroke the "−" parsed as NaN and DELETED the offset, so the
              standard's own default could not be typed (#209). */}
          <CommitNumberField
            step={0.0625}
            value={state.endplateTrackOffsets[id] ?? null}
            placeholder={String(
              endplateTrackOffsetInches(
                undefined,
                id === "A" ? state.configA : id === "B" ? state.configB : "single",
                state.mainsSwapped === true,
              ),
            )}
            onCommit={(v) => setEndplateTrackOffset(id, v == null ? "" : String(v))}
            inp={inp}
            title="Signed distance of Main 1 from the centre of this endplate. Leave blank for the standard's recommendation (single centred, double straddling the centre). 0 means explicitly centred."
          />
        </label>
        <p className="text-xs text-gray-500">
          Blank uses the recommended placement. Track always crosses the plate at
          90°, and on a double end the two tracks stay 1.125″ apart.
        </p>
        {checkEndplateWidth({
          widthInches: state.endplateWidths[id],
          config: id === "A" ? state.configA : id === "B" ? state.configB : "single",
          trackOffsetInches: state.endplateTrackOffsets[id],
          // Which side Main 2 is on decides which track sits nearest a fascia,
          // and whether the pair straddles the plate at all (#190).
          main2Below: state.mainsSwapped === true,
        }).map((issue) => (
          <p
            key={issue.code}
            className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800"
            role="status"
          >
            ⚠ {issue.message}
          </p>
        ))}

        {/* ⭐ THE ENDPLATE'S EDGE OF THE BENCHWORK (ADR 0001). Above the pose
            because it supersedes it: bound, the plate reads its place, facing
            and WIDTH off the board and keeps following it. */}
        <div className="rounded-md border border-gray-200 p-2">
          <label className="block text-xs font-medium text-gray-600">
            Which edge of the benchwork is this?
            <select
              value={bound ? String(bound.index) : ""}
              onChange={(e) =>
                patch((s) => {
                  const v = e.target.value;
                  if (!s.endplateEdges) s.endplateEdges = {};
                  if (v === "") delete s.endplateEdges[id];
                  else {
                    s.endplateEdges[id] = { index: Number(v) };
                    // A binding replaces a hand-placed pose — keeping both would
                    // leave the plate pinned to a point it no longer sits on.
                    delete s.poseOverrides[id];
                  }
                })
              }
              className={`mt-0.5 ${inp}`}
              disabled={!edgeChoices.length}
            >
              <option value="">Not on an edge — placed by hand</option>
              {edgeChoices.map((c) => (
                <option key={c.index} value={c.index} disabled={!c.usable}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {!edgeChoices.length ? (
            <p className="mt-1 text-xs text-gray-500">
              Draw the benchwork first and this endplate can sit on one of its
              edges — then its width and facing come from the board itself.
            </p>
          ) : bound && pose.boundToEdge ? (
            <p className="mt-1 text-xs text-gray-600">
              On the board&apos;s edge, <span className="font-medium">{Math.round((pose.widthInches ?? 0) * 10) / 10}″</span> wide,
              facing {Math.round(pose.heading)}°. Reshape the benchwork and this
              endplate moves with it — its width is the edge&apos;s own, so the
              two can&apos;t disagree.
            </p>
          ) : bound ? (
            <p className="mt-1 text-xs text-amber-700">
              ⚠ That edge isn&apos;t usable any more — the board may have been
              reshaped, or the edge is curved. An endplate face has to be
              straight (Free-moN §2.0 wants the track square and level across
              it), so this is falling back to the derived position.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Pick an edge and this endplate becomes part of the benchwork: its
              position, facing and width all come from the board.
            </p>
          )}
        </div>

        {/* Pose (#175 phase 1b) — the layout map's geometry. */}
        <details open={wantsManualPose} className="rounded-md border border-gray-200 p-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-gray-600">
            Pose {o ? <span className="text-amber-600">(manual)</span> : <span className="text-gray-400">(derived)</span>}
          </summary>
          <p className="mt-1 text-xs text-gray-500">
            Where this endplate sits (inches from A, outward heading) — what the
            layout map is built from.{" "}
            {wantsManualPose
              ? "This shape needs a hand-entered pose."
              : "Override only if the map looks wrong."}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {/* All three are SIGNED (a plate west of A, below the centre line,
                or facing −90°). Per keystroke, `Number("−") || 0` snapped the
                field to 0 before the digits arrived (#209). */}
            <label className="block text-xs font-medium text-gray-600">
              X (in)
              <CommitNumberField
                step={0.1}
                value={Math.round((o?.x ?? pose.x) * 10) / 10}
                onCommit={(v) => setPose("x", v)}
                inp={inp}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Y (in)
              <CommitNumberField
                step={0.1}
                value={Math.round((o?.y ?? pose.y) * 10) / 10}
                onCommit={(v) => setPose("y", v)}
                inp={inp}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Heading °
              <CommitNumberField
                step={1}
                value={Math.round(o?.heading ?? pose.heading)}
                onCommit={(v) => setPose("heading", v)}
                inp={inp}
              />
            </label>
          </div>
          {o && (
            <button
              type="button"
              onClick={() =>
                patch((s) => {
                  delete s.poseOverrides[id];
                })
              }
              className={`mt-2 ${xBtn}`}
            >
              Reset to derived
            </button>
          )}
        </details>
      </>,
      branch
        ? {
            fn: () =>
              patch((s) => {
                // Cascade: drop the diverging track this endplate owns and clear
                // any turnout that fed it, so nothing is left dangling (#170).
                const trackId = s.branches[bi]?.trackId;
                if (trackId) {
                  s.extraTracks = s.extraTracks.filter((t) => t.id !== trackId);
                  for (const tn of s.turnouts) if (tn.divergeTrack === trackId) tn.divergeTrack = "";
                }
                delete s.poseOverrides[id];
                s.branches.splice(bi, 1);
              }),
            label: `Remove endplate ${id}`,
          }
        : undefined,
    );
  }

  // ---- Benchwork corner ----
  if (selection.kind === "corner") {
    const i = selection.i;
    const c = state.outline[i];
    if (!c) return null;
    // Both are SIGNED — a corner below the centre line or west of endplate A is
    // ordinary — so both commit on blur. Per keystroke, the "−" of "−6" parsed
    // as NaN and wrote it straight into the corner (#209).
    const set = (k: "x" | "y", v: number | null) =>
      patch((s) => (s.outline[i] = { ...s.outline[i], [k]: v ?? 0 }));
    return shell(
      `Benchwork corner ${i + 1}`,
      <>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            X (in)
            <CommitNumberField value={c.x} onCommit={(v) => set("x", v)} inp={inp} />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Y (in)
            <CommitNumberField value={c.y} onCommit={(v) => set("y", v)} inp={inp} />
          </label>
        </div>
        {c.bulge ? (
          <button
            type="button"
            onClick={() =>
              // Drop the bulge on the edge LEAVING this corner.
              patch((s) => (s.outline[i] = { x: s.outline[i].x, y: s.outline[i].y }))
            }
            className={addBtn}
          >
            Straighten this edge
          </button>
        ) : (
          <p className="text-xs text-gray-400">
            Drag the ◇ on an edge to curve it into an arc.
          </p>
        )}
      </>,
      { fn: () => patch((s) => s.outline.splice(i, 1)), label: "Remove corner" },
    );
  }

  // ---- Turnout ----
  if (selection.kind === "turnout") {
    const i = state.turnouts.findIndex((t) => t.id === selection.id);
    if (i < 0) return null;
    const t = state.turnouts[i];
    // The part this turnout IS, if the owner has named one — and every part
    // they could name, grouped by manufacturer (#187).
    const namedPart = t.partId ? (partLibrary.find((p) => p.id === t.partId) ?? null) : null;
    const partGroups = partsByManufacturer(partLibrary);
    return shell(
      `Turnout · ${t.name || t.id}`,
      <>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={t.name}
            onChange={(e) => patch((s) => (s.turnouts[i].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="West Siding"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Frog position (in from A)
          <input
            type="number"
            step={0.5}
            value={t.pos}
            title="Inches from endplate A to the turnout's FROG (where the diverging rails cross), measured along the module — the same whether the turnout sits on the main or a spur."
            onChange={(e) => onTurnoutPos(t.id, Number(e.target.value))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            On track
            <select
              value={t.onTrack}
              onChange={(e) =>
                patch((s) => {
                  const v = e.target.value;
                  const cur = s.turnouts[i];
                  // Picking the track it currently diverges to would make it
                  // diverge into itself (onTrack === divergeTrack) — the false
                  // "no second route" warning on a reversed transition (#172).
                  // Swap instead, so it keeps a valid second route.
                  if (cur.divergeTrack === v) cur.divergeTrack = cur.onTrack;
                  cur.onTrack = v;
                })
              }
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Diverges to
            <select
              value={t.divergeTrack}
              onChange={(e) => {
                const v = e.target.value;
                // Turnout-first creation (#136): these mint a new track for the
                // turnout to feed instead of picking an existing one.
                if (v === "__new_spur__") onNewDivergeTrack(t.id, "spur");
                else if (v === "__new_siding__") onNewDivergeTrack(t.id, "siding");
                else if (v.startsWith("__to_ep__"))
                  onDivergeToEndplate(t.id, v.slice("__to_ep__".length));
                else patch((s) => (s.turnouts[i].divergeTrack = v));
              }}
              className={`mt-0.5 ${inp}`}
            >
              {/* A turnout can't diverge into the track it sits on — there'd be
                  no second route, so nothing renders and the turnout silently
                  does nothing. The list used to offer it. */}
              {trackOptions
                .filter((o) => o.value !== t.onTrack)
                .map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              <option disabled>──────────</option>
              <option value="__new_spur__">＋ New spur…</option>
              <option value="__new_siding__">＋ New siding…</option>
              {/* Draw a branch route out to a placed 3rd+ endplate (#170). */}
              {state.branches.map((_, bi) => {
                const epId = String.fromCharCode(67 + bi);
                return (
                  <option key={`ep${epId}`} value={`__to_ep__${epId}`}>
                    → Endplate {epId}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        {t.divergeTrack === t.onTrack && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800" role="status">
            ⚠ This turnout diverges into the track it sits on, so it has no
            second route and nothing will draw. Pick a different track above.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Hand
            <select
              value={t.kind}
              onChange={(e) => patch((s) => (s.turnouts[i].kind = e.target.value as TurnoutKind))}
              className={`mt-0.5 ${inp}`}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Turnout # (size)
            {/* Derived once a part is named: the part IS a #7, so a second
                control saying otherwise would be a contradiction you could
                author. Editable only while no part is chosen (#187). */}
            {namedPart?.frogNumber != null ? (
              <div
                className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`}
                title="Comes from the part you chose."
              >
                #{namedPart.frogNumber}
              </div>
            ) : (
              <select
                value={t.size ?? 6}
                onChange={(e) => patch((s) => (s.turnouts[i].size = Number(e.target.value)))}
                className={`mt-0.5 ${inp}`}
                title="Frog number — governs the diverging angle."
              >
                {/* The stock range, plus whatever this turnout already is — a
                    part can leave behind a frog number the list doesn't carry
                    (Atlas's wye is a #2.5), and a select with no matching
                    option renders blank, which reads as "unset" (#187). */}
                {[...new Set([...FROG_NUMBERS, t.size ?? DEFAULT_TURNOUT_SIZE])]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>#{n}</option>
                  ))}
              </select>
            )}
          </label>
        </div>
        {/* THE PART — grouped by manufacturer, from the LIVE library so a part
            an admin adds shows up here (#187). */}
        <label className="block text-xs font-medium text-gray-600">
          Part
          <select
            value={t.partId ?? ""}
            onChange={(e) =>
              patch((s) => {
                const id = e.target.value || undefined;
                s.turnouts[i].partId = id;
                // The part carries the frog number, so adopt it. Everything
                // downstream — lead, extent, where the flex begins — is keyed
                // off `size`, and leaving it stale would draw one part at
                // another's dimensions.
                const p = id ? partLibrary.find((x) => x.id === id) : null;
                if (p?.frogNumber != null) s.turnouts[i].size = p.frogNumber;
              })
            }
            className={`mt-0.5 ${inp}`}
            title="The turnout you're actually laying. Its own measurements drive how long it is drawn and where your flex track starts."
          >
            <option value="">Not specified — draw from the frog number</option>
            {partGroups.map((g) => (
              <optgroup key={g.manufacturer} label={g.manufacturer}>
                {g.parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.partNumbers
                      ? ` (${[p.partNumbers.left, p.partNumbers.right, p.partNumbers.single].filter(Boolean).join(" / ")})`
                      : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {namedPart ? (
            <span className="mt-1 block font-normal text-[11px] text-gray-500">
              {namedPart.segments?.length
                ? "Drawn from the part’s own outline. Its frog should sit on the turnout’s position marker — if it misses, the part’s geometry disagrees with our measurements."
                : partExtent(namedPart)
                  ? "Drawn at this part’s measured length, so the rail joints mark where your own flex track starts."
                  : "This part has no measured length yet, so the turnout is drawn from its frog number. Adding measurements at Admin → Track parts is what fixes that."}
            </span>
          ) : (
            <span className="mt-1 block font-normal text-[11px] text-gray-500">
              Drawn from the frog number alone — a reasoned shape, not a
              particular product. Name the turnout you&rsquo;re laying and it is
              drawn at that part&rsquo;s own measurements.
            </span>
          )}
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={!!t.curved}
            onChange={(e) =>
              patch((s) => (s.turnouts[i].curved = e.target.checked || undefined))
            }
          />
          Curved — the diverging leg bows into an arc
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={!!t.flipped}
            onChange={(e) =>
              patch((s) => (s.turnouts[i].flipped = e.target.checked || undefined))
            }
          />
          Rotated 180° — the points face the other way
        </label>
      </>,
      { fn: () => patch((s) => s.turnouts.splice(i, 1)), label: "Remove turnout" },
    );
  }

  // ---- Crossing (diamond) ----
  if (selection.kind === "crossing") {
    const i = state.crossings.findIndex((x) => x.id === selection.id);
    if (i < 0) return null;
    const x = state.crossings[i];
    return shell(
      `Crossing · ${x.name || x.id}`,
      <>
        <p className="text-xs text-gray-500">
          Where two tracks cross at grade with no route choice.
        </p>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={x.name}
            onChange={(e) => patch((s) => (s.crossings[i].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="Diamond"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Position (in from A)
          <input
            type="number"
            min={0}
            value={x.pos}
            onChange={(e) => patch((s) => (s.crossings[i].pos = Number(e.target.value) || 0))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Track A
            <select
              value={x.trackA}
              onChange={(e) => patch((s) => (s.crossings[i].trackA = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Track B
            <select
              value={x.trackB}
              onChange={(e) => patch((s) => (s.crossings[i].trackB = e.target.value))}
              className={`mt-0.5 ${inp}`}
            >
              {trackOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </>,
      { fn: () => patch((s) => s.crossings.splice(i, 1)), label: "Remove crossing" },
    );
  }

  // ---- A PIECE OF TRACK (ADR 0001) ----
  if (selection.kind === "piece") {
    const pieces = state.graph?.pieces ?? [];
    const piece = pieces.find((p) => p.id === selection.id);
    if (!piece) return null;
    const part = partLibrary.find((p) => p.id === piece.partId);
    const isFlex = part?.kind === "flex";
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const editPiece = (fields: Partial<TrackPiece>) =>
      setPieces(
        pieces.map((p) => (p.id === piece.id ? { ...p, ...fields } : p)),
        { commit: true },
      );
    return shell(
      `Piece · ${part?.name ?? piece.partId}`,
      <>
        <p className="text-xs text-gray-500">
          {isFlex
            ? "Flex track is the one piece you cut. Drag the square handle to length, the ◇ in the middle to bend it, the round handle to turn it — or drag the piece itself to move it."
            : "A part is the shape it is built to — it can only be moved and turned. Its ends snap to any open joint."}
        </p>
        {isFlex && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-gray-600">
              Length (in)
              <CommitNumberField
                step={0.25}
                value={r2(piece.lengthInches ?? 0)}
                onCommit={(v) => editPiece({ lengthInches: Math.max(1, v ?? 1) })}
                inp={inp}
              />
            </label>
            {/* ⚠️ The radius is SIGNED — the sign is which way it bends, so a
                blank field is a straight run and not a radius of nothing. The
                length stays the ARC: bending a piece of flex does not shorten
                the rail, it only changes where the far end ends up. */}
            <label className="block text-xs font-medium text-gray-600" title="Blank = straight. Negative bends the other way.">
              Radius (in)
              <CommitNumberField
                step={1}
                value={piece.radiusInches != null ? r2(piece.radiusInches) : null}
                placeholder="straight"
                onCommit={(v) => editPiece({ radiusInches: v == null || v === 0 ? undefined : v })}
                inp={inp}
              />
            </label>
          </div>
        )}
        {/* ⭐ FLAGGED, NEVER CORRECTED — the house rule for everything the
            standard has an opinion about (#190's off-centre plate, #193's
            over-long piece, #194's capacity). And it says MAIN LINE, because
            the standard does: a spur or a yard lead may legitimately be
            tighter, and calling that an error would teach owners to ignore
            these notes. */}
        {isFlex && piece.radiusInches != null &&
          Math.abs(piece.radiusInches) < FREEMO_MAIN_MIN_RADIUS_INCHES && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              {Math.abs(piece.radiusInches).toFixed(1)}″ is tighter than Free-moN&rsquo;s{" "}
              {FREEMO_MAIN_MIN_RADIUS_INCHES}″ minimum <strong>main-line</strong> radius. Fine on a
              spur or a yard lead; not on the main.
            </p>
          )}
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            X (in)
            <CommitNumberField
              step={0.25}
              value={r2(piece.x)}
              onCommit={(v) => v != null && editPiece({ x: v })}
              inp={inp}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Y (in)
            <CommitNumberField
              step={0.25}
              value={r2(piece.y)}
              onCommit={(v) => v != null && editPiece({ y: v })}
              inp={inp}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Angle°
            <CommitNumberField
              step={1}
              value={r2(piece.rotationDeg)}
              onCommit={(v) => v != null && editPiece({ rotationDeg: v })}
              inp={inp}
            />
          </label>
        </div>
        {part && part.kind !== "flex" && (
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={!!piece.flipped}
              onChange={(e) => editPiece({ flipped: e.target.checked })}
            />
            Mirrored (a left-hand part from a right)
          </label>
        )}
        <GraphReadout readout={graphReadout} />
      </>,
      {
        fn: () => setPieces(pieces.filter((p) => p.id !== piece.id), { commit: true }),
        label: "Remove piece",
      },
    );
  }

  // ---- Control point (a named GROUP — no shape, so it's list-selected) ----
  if (selection.kind === "cp") {
    const ci = state.controlPoints.findIndex((c) => c.id === selection.id);
    if (ci < 0) return null;
    const c = state.controlPoints[ci];
    return shell(
      `Control point · ${c.name || c.id}`,
      <>
        <p className="text-xs text-gray-500">
          An interlocking — a named group of signals and the turnout(s) it
          governs. These become the Section &amp; District boundaries the layout
          builder works from.
        </p>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={c.name}
            onChange={(e) => patch((s) => (s.controlPoints[ci].name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="West Siding"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-gray-600">Turnouts</span>
          {state.turnouts.length === 0 ? (
            <p className="text-xs text-gray-400">None yet — add a passing siding or a turnout.</p>
          ) : (
            <div className="mt-1 space-y-1">
              {state.turnouts.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={c.turnouts.includes(t.id)}
                    onChange={(e) =>
                      patch((s) => {
                        const cp = s.controlPoints[ci];
                        cp.turnouts = e.target.checked
                          ? [...cp.turnouts, t.id]
                          : cp.turnouts.filter((v) => v !== t.id);
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                  />
                  {t.name || t.id}
                </label>
              ))}
            </div>
          )}
        </div>

        {state.crossings.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-600">Crossings</span>
            <div className="mt-1 space-y-1">
              {state.crossings.map((x) => (
                <label key={x.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={(c.crossings ?? []).includes(x.id)}
                    onChange={(e) =>
                      patch((s) => {
                        const cp = s.controlPoints[ci];
                        const cur = cp.crossings ?? [];
                        cp.crossings = e.target.checked ? [...cur, x.id] : cur.filter((v) => v !== x.id);
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                  />
                  {x.name || x.id}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Signals</span>
            <button
              type="button"
              onClick={() =>
                patch((s) => {
                  const cp = s.controlPoints[ci];
                  // Add the opposite-direction signal of the last one so a
                  // control point builds a proper both-ways pair (above/below)
                  // rather than stacking identical masts.
                  const last = cp.signals[cp.signals.length - 1];
                  const facing = last?.facing === "AtoB" ? "BtoA" : "AtoB";
                  cp.signals.push({
                    id: `${cp.id}-${nextId("s", cp.signals.map((x) => x.id))}`,
                    pos: last?.pos ?? Math.round(s.lengthInches * 0.25),
                    track: last?.track ?? MAIN_TRACK_ID,
                    facing,
                    side: facing === "AtoB" ? "above" : "below",
                  });
                })
              }
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              + Signal
            </button>
          </div>
          {c.signals.map((s, si) => (
            <div key={s.id} className="mt-2 rounded-md border border-gray-200 p-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-gray-600">
                  Position (in)
                  <input
                    type="number"
                    min={0}
                    value={s.pos}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].pos = Number(e.target.value) || 0))}
                    className={`mt-0.5 ${inp}`}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Track
                  <select
                    value={s.track}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].track = e.target.value))}
                    className={`mt-0.5 ${inp}`}
                  >
                    {trackOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Facing
                  <select
                    value={s.facing}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].facing = e.target.value as SignalFacing))}
                    className={`mt-0.5 ${inp}`}
                  >
                    {/* A and B, not compass: the same board can be installed
                        either way round, so only the layout knows which way is
                        east. The stored values were already AtoB/BtoA. */}
                    <option value="AtoB">A → B</option>
                    <option value="BtoA">B → A</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Side
                  <select
                    value={s.side}
                    onChange={(e) => patch((st) => (st.controlPoints[ci].signals[si].side = e.target.value as "above" | "below"))}
                    className={`mt-0.5 ${inp}`}
                  >
                    <option value="above">Above track</option>
                    <option value="below">Below track</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => patch((st) => st.controlPoints[ci].signals.splice(si, 1))}
                className={`mt-1.5 ${xBtn}`}
              >
                Remove signal
              </button>
            </div>
          ))}
        </div>
      </>,
      { fn: () => patch((s) => s.controlPoints.splice(ci, 1)), label: "Remove control point" },
    );
  }

  // ---- Industry ----
  if (selection.kind === "industry") {
    const idx = state.industries.findIndex((x) => x.id === selection.id);
    if (idx < 0) return null;
    const ind = state.industries[idx];
    const up = (fn: (x: EditorState["industries"][number]) => void) =>
      patch((s) => fn(s.industries[idx]));
    const cars =
      carCapacity(ind.fromPos, ind.toPos) +
      ind.spots.reduce((n, sp) => n + carCapacity(sp.fromPos, sp.toPos), 0);
    /**
     * Does this spot's span actually fit on the track it spots (#194)? Nothing
     * checked, so an industry could claim car spots with no rail under them —
     * and its capacity counted them.
     *
     * Deliberately a WARNING, not a correction: the numbers are the owner's, the
     * fix is theirs to choose (shorten the span, or lengthen the track), and
     * that's how an off-centre endplate (#190) and an over-long flex piece
     * (#193) are handled too.
     */
    const spanWarning = (track: string, fromPos: number, toPos: number) => {
      // The mains carry their extents already (#192); everything else is an
      // extraTrack. A spot on a track that no longer exists warns about nothing.
      const m = mains.find((x) => x.id === track);
      const et = state.extraTracks.find((x) => x.id === track);
      const ext = m
        ? { from: m.fromPos, to: m.toPos }
        : et
          ? { from: et.fromPos, to: et.toPos }
          : null;
      if (!ext) return null;
      const o = spanOverhang({
        fromPos,
        toPos,
        trackFromPos: ext.from,
        trackToPos: ext.to,
      });
      if (o.overhangInches < 0.05) return null;
      const name =
        trackOptions.find((x) => x.value === track)?.label ?? track;
      const lost = carCapacity(fromPos, toPos) - carCapacity(0, o.onTrackInches);
      const r1 = (v: number) => Math.round(v * 10) / 10;
      const ends = [
        o.beforeInches >= 0.05 ? `${r1(o.beforeInches)}″ before its start` : null,
        o.afterInches >= 0.05 ? `${r1(o.afterInches)}″ past its end` : null,
      ].filter(Boolean);
      return (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800" role="status">
          ⚠ This span runs off <span className="font-medium">{name}</span> —{" "}
          {ends.join(" and ")}. Only {r1(o.onTrackInches)}″ of it has rail under it
          {lost > 0
            ? `, so ${lost} of the cars counted below can't actually be spotted`
            : ""}
          . Shorten the span, or extend the track to meet it.
        </p>
      );
    };
    return shell(
      `Industry · ${ind.name || "unnamed"}`,
      <>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={ind.name}
            onChange={(e) => up((x) => (x.name = e.target.value))}
            className={`mt-0.5 ${inp}`}
            placeholder="e.g. Ace Feed & Grain"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Type
          <select
            value={ind.type}
            onChange={(e) => up((x) => (x.type = e.target.value))}
            className={`mt-0.5 ${inp}`}
          >
            <option value="">—</option>
            {industryTypes.map((o) => (
              <option key={o.value} value={o.value}>{o.display_label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          On track
          <select
            value={ind.track}
            onChange={(e) => up((x) => (x.track = e.target.value))}
            className={`mt-0.5 ${inp}`}
          >
            {trackOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Starts (in from A)
            <input
              type="number"
              step={0.5}
              value={ind.fromPos}
              onChange={(e) => up((x) => (x.fromPos = Number(e.target.value)))}
              className={`mt-0.5 ${inp}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Ends (in from A)
            <input
              type="number"
              step={0.5}
              value={ind.toPos}
              onChange={(e) => up((x) => (x.toPos = Number(e.target.value)))}
              className={`mt-0.5 ${inp}`}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Side
            <select
              value={ind.side}
              onChange={(e) => up((x) => (x.side = e.target.value as "above" | "below"))}
              className={`mt-0.5 ${inp}`}
            >
              <option value="above">Above track</option>
              <option value="below">Below track</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Capacity
            <div className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`} title="Total across all this industry's tracks.">
              {cars} cars
            </div>
          </label>
        </div>
        {spanWarning(ind.track, ind.fromPos, ind.toPos)}
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">House-track spots</span>
            <button
              type="button"
              onClick={() =>
                up((x) => {
                  const t = state.extraTracks[0]?.id ?? ind.track;
                  x.spots = [
                    ...x.spots,
                    {
                      track: t,
                      fromPos: Math.round(state.lengthInches * 0.4),
                      toPos: Math.round(state.lengthInches * 0.5),
                      side: x.side,
                    },
                  ];
                })
              }
              className={addBtn}
            >
              + Add track
            </button>
          </div>
          {ind.spots.length === 0 ? (
            <p className="mt-1 text-xs font-normal text-gray-400">
              Served by one track. Add a track to spot cars on a house track&rsquo;s
              other tracks too.
            </p>
          ) : (
            <div className="mt-1 space-y-2">
              {ind.spots.map((sp, si) => (
                <div key={si} className="space-y-1 rounded-md border border-gray-200 p-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={sp.track}
                      onChange={(e) => up((x) => (x.spots[si].track = e.target.value))}
                      className={`${inp} text-xs`}
                    >
                      {trackOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => up((x) => x.spots.splice(si, 1))}
                      className="shrink-0 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step={0.5}
                      value={sp.fromPos}
                      onChange={(e) => up((x) => (x.spots[si].fromPos = Number(e.target.value)))}
                      className={`${inp} text-xs`}
                      title="Starts (in from A)"
                    />
                    <input
                      type="number"
                      step={0.5}
                      value={sp.toPos}
                      onChange={(e) => up((x) => (x.spots[si].toPos = Number(e.target.value)))}
                      className={`${inp} text-xs`}
                      title="Ends (in from A)"
                    />
                  </div>
                  {/* Each spot rides its own track, so each is checked (#194). */}
                  {spanWarning(sp.track, sp.fromPos, sp.toPos)}
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="block text-xs font-medium text-gray-600">
          Label on canvas
          <select
            value={ind.labelMode}
            onChange={(e) => up((x) => (x.labelMode = e.target.value as IndustryLabelMode))}
            className={`mt-0.5 ${inp}`}
          >
            <option value="none">Name only</option>
            <option value="cars">Name + car count</option>
            <option value="inches">Name + length</option>
          </select>
        </label>
        <div className="text-xs font-medium text-gray-600">
          Cars received
          {carTypes.length === 0 ? (
            <p className="mt-0.5 font-normal text-gray-400">No car types available.</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1">
              {carTypes.map((ct) => {
                const on = ind.carTypes.includes(ct.value);
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() =>
                      up((x) => {
                        x.carTypes = on
                          ? x.carTypes.filter((v) => v !== ct.value)
                          : [...x.carTypes, ct.value];
                      })
                    }
                    className={`rounded-full border px-2 py-0.5 text-xs font-normal transition ${
                      on
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {ct.display_label}
                  </button>
                );
              })}
            </div>
          )}
          <CarTypeSuggest
            onSuggested={(o) => {
              onCarTypeSuggested(o);
              up((x) => {
                if (!x.carTypes.includes(o.value)) x.carTypes = [...x.carTypes, o.value];
              });
            }}
          />
        </div>
      </>,
      { fn: () => patch((s) => s.industries.splice(idx, 1)), label: "Remove industry" },
    );
  }

  /**
   * What a run is laid with, and what that costs (#193). Shown on every track's
   * panel — a main, a siding, a spur: they're all flex between the parts.
   */
  /** A crossover connector's product, and what its spacing does to the pair.
   *
   * The spacing is the reason this picker exists. A crossover fixture is
   * machined for ONE track spacing and can't be built to another, so naming the
   * product is what lets the board draw the pair as it really runs — the Fast
   * Tracks N crossovers are 1.09″ against Free-moN's 1.125″ (#180). */
  const crossoverBlock = (i: number) => {
    const t = state.extraTracks[i];
    if (!t || t.role !== "crossover") return null;
    const options = crossoverParts(partLibrary);
    if (!options.length) return null;
    const part = options.find((p) => p.id === t.crossoverPartId) ?? null;
    const spacing = part?.trackSpacing?.inches ?? null;
    const off = spacing == null ? 0 : spacing - FREEMO_TRACK_SPACING_INCHES;
    return (
      <div className="rounded-md bg-gray-50 px-2 py-1.5">
        <label className="block text-xs font-medium text-gray-600">
          Built from
          <select
            value={t.crossoverPartId ?? ""}
            onChange={(e) =>
              patch((s) => {
                const v = e.target.value;
                if (v) s.extraTracks[i].crossoverPartId = v;
                else delete s.extraTracks[i].crossoverPartId;
              })
            }
            className={`mt-0.5 ${inp}`}
          >
            <option value="">Not said</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.manufacturer} {p.name}
              </option>
            ))}
          </select>
        </label>
        {part ? (
          <p className="mt-1 text-xs text-gray-600">
            {spacing != null && Math.abs(off) > 1e-9 ? (
              <>
                Built to <span className="font-medium">{spacing}″</span> track
                spacing, where Free-moN wants{" "}
                {FREEMO_TRACK_SPACING_INCHES}″ — so the two tracks are{" "}
                <span className="font-medium">
                  {Math.abs(off).toFixed(3)}″ {off < 0 ? "closer" : "further apart"}
                </span>{" "}
                across the crossover, and ease back out either side. The board
                draws that pinch. A crossover fixture is cut for one spacing and
                can&apos;t be built to another.
              </>
            ) : (
              <>Built to Free-moN&apos;s {FREEMO_TRACK_SPACING_INCHES}″ spacing — the pair stays parallel.</>
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            Say what you built it on and the board can draw the pair at its real
            spacing. Left unsaid, both tracks stay a standard{" "}
            {FREEMO_TRACK_SPACING_INCHES}″ apart.
          </p>
        )}
      </div>
    );
  };

  const flexBlock = (trackId: string) => {
    const f = flex[trackId];
    if (!f) return null;
    const u = flexUsage(f.pieces);
    const part = flexPartFor(f.partId, partLibrary);
    /**
     * ⚠️ GATED ON WHAT IS TRUE, NOT ON A ZERO — the rule that had to be learned
     * twice here. This first keyed off `runInches < 0.01`, which held only
     * BECAUSE the length was broken; when #229 gave the route its real length the
     * test fell through and the module announced "No flex on this run — the parts
     * fill it", which was false. It then keyed off `role === "branch"`, which is
     * the owner's label rather than a fact about the run (#226).
     *
     * What is actually true: a run is uncuttable when something sits on it whose
     * position cannot be expressed in the run's own frame. A route across the
     * board is no longer that by default — it is cut along itself now.
     */
    if (f.unmapped || f.runInches < 0.01)
      return (
        <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">
          {f.unmapped
            ? "Something sits on this route whose position is recorded along the module, not along the route, so its lengths of flex aren’t worked out."
            : "This run has no length yet, so its lengths of flex aren’t worked out."}
        </p>
      );
    return (
      <div className="space-y-1 border-t border-gray-100 pt-2">
        <label className="block text-xs font-medium text-gray-600">
          Flex track
          <select
            value={f.partId}
            onChange={(e) =>
              patch((s) => {
                const next = { ...(s.flexByTrack[trackId] ?? {}) };
                next.partId = e.target.value;
                // Changing the product changes the maximum piece, so cuts made
                // for the OLD one are no longer the owner's answer to this
                // question — drop them and re-derive rather than leave lengths
                // that the new product can't supply.
                delete next.cuts;
                s.flexByTrack[trackId] = next;
              })
            }
            className={`mt-0.5 ${inp}`}
          >
            {flexParts(partLibrary).map((p) => (
              <option key={p.id} value={p.id}>
                {p.manufacturer} {p.line} — {p.overallLength?.inches ?? "?"}″ lengths
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-gray-500">
          {u.pieces === 0 ? (
            "No flex on this run — the parts fill it."
          ) : (
            <>
              <span className="font-medium text-gray-700">
                {u.pieces} piece{u.pieces === 1 ? "" : "s"}
              </span>{" "}
              · {Math.round(u.totalInches * 10) / 10}″ of flex
              {f.authored ? " · cut by hand" : " · cut automatically"}
            </>
          )}
        </p>
        {u.overlong > 0 && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800" role="status">
            ⚠ {u.overlong} piece{u.overlong === 1 ? " is" : "s are"} longer than a{" "}
            {part?.overallLength?.inches}″ length of {part?.manufacturer} flex. Add a joint, or
            pick a product that comes longer.
          </p>
        )}
        {f.authored && (
          <button
            type="button"
            onClick={() =>
              patch((s) => {
                const next = { ...(s.flexByTrack[trackId] ?? {}) };
                delete next.cuts;
                if (!next.partId) delete s.flexByTrack[trackId];
                else s.flexByTrack[trackId] = next;
              })
            }
            className={`${addBtn} w-full`}
          >
            Re-cut automatically
          </button>
        )}
      </div>
    );
  };

  // ---- A length of flex track (#193) ---------------------------------------
  // Each piece is a real object: it has a length you can change, and ends that
  // meet its neighbours, the parts, and the endplates.
  if (selection.kind === "flex") {
    const f = flex[selection.id];
    const piece = f?.pieces[selection.index];
    if (!f || !piece) return null;
    const part = flexPartFor(f.partId, partLibrary);
    const max = maxFlexPieceInches(f.partId, partLibrary);
    const trackName =
      mains.find((m) => m.id === selection.id)?.label ??
      (() => {
        const i = state.extraTracks.findIndex((t) => t.id === selection.id);
        return i >= 0 ? trackLabel(state.extraTracks[i], i) : selection.id;
      })();
    const meets = (e: FlexPiece["fromEnd"]) =>
      e === "piece" ? "the next piece" : e === "part" ? "a turnout or crossing" : "the end of the run";
    /** Move the joint at this piece's far end. Its neighbour gives up (or gains)
     * exactly what this piece takes — which is what cutting really does. The
     * rule (and the clamp that stops a too-long value reordering the joints)
     * lives in the package, with `resizeSection`'s lesson already learnt. */
    const resize = (want: number) => {
      const next = resizeFlexPiece(f.pieces, selection.index, want);
      if (!next) return;
      patch((s) => {
        // The first edit turns the whole run's derived cuts into the owner's
        // own, so moving one joint doesn't leave the rest free to re-derive
        // around it.
        s.flexByTrack[selection.id] = { ...(s.flexByTrack[selection.id] ?? {}), cuts: next };
      });
    };
    return shell(
      `${trackName} · Piece ${selection.index + 1}`,
      <>
        <p className="text-xs text-gray-500">
          A length of {part?.manufacturer} {part?.line} flex. It runs from{" "}
          {Math.round(piece.fromPos * 10) / 10}″ to {Math.round(piece.toPos * 10) / 10}″ along{" "}
          {trackName}.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-gray-500">Meets</dt>
          <dd className="text-gray-800">
            {meets(piece.fromEnd)} at the west end, {meets(piece.toEnd)} at the east
          </dd>
          <dt className="text-gray-500">Longest</dt>
          <dd className="text-gray-800">{max}″ for this product</dd>
        </dl>
        {piece.toEnd === "piece" ? (
          <label className="block text-xs font-medium text-gray-600">
            Length (in)
            <CommitNumberField
              value={Math.round(piece.lengthInches * 100) / 100}
              // Blank isn't a length — clearing it leaves the piece as it was.
              onCommit={(v) => v != null && resize(v)}
              inp={inp}
              title="Moves the joint at this piece's east end. Its neighbour takes up the difference — which is what cutting one longer really does."
            />
          </label>
        ) : (
          <p className="text-xs text-gray-400">
            {Math.round(piece.lengthInches * 100) / 100}″ — this piece runs to{" "}
            {meets(piece.toEnd)}, so its length is set by what it meets. Resize the piece before it,
            or move what it butts against.
          </p>
        )}
        {piece.overlong && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800" role="status">
            ⚠ Longer than a {max}″ length — this piece can&rsquo;t be laid in one.
          </p>
        )}
      </>,
    );
  }

  // ---- The mains (Main 1 / Main 2) ----------------------------------------
  // Neither is an `extraTrack` — the main IS the module's centre-line — so both
  // are handled here rather than falling through to the track panel below. #185
  // gave the mainline a list row but no details; this is the details (#192).
  const main = mains.find((m) => m.id === selection.id);
  if (main) {
    const isMain2 = main.id === MAIN2_TRACK_ID;
    const partial = isMain2 && (main.fromPos > 0 || main.toPos < state.lengthInches);
    return shell(
      main.label,
      <>
        <p className="text-xs text-gray-500">
          {isMain2
            ? "The second main. Left alone it runs parallel to Main 1 at standard spacing."
            : "The through main — it runs the module on the centre line. Left alone it follows the module's shape."}{" "}
          It&rsquo;s selected, so its points are live on the canvas: drag one to
          move it, or a ◆ to bow that stretch into a curve.
        </p>
        {/* The facts, as a definition list — the same shape a siding shows. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-gray-500">Length</dt>
          <dd className="text-gray-800">
            {main.lengthInches}″
            <span className="text-gray-400">
              {" "}
              ({main.drawn ? "measured along the path you drew" : "derived"})
            </span>
          </dd>
          <dt className="text-gray-500">Shape</dt>
          <dd className="text-gray-800">
            {main.drawn
              ? "bent by hand"
              : isMain2
                ? "parallel to Main 1"
                : "derived from the module shape"}
          </dd>
          <dt className="text-gray-500">Lane</dt>
          <dd className="text-gray-800">
            {main.lane}
            <span className="text-gray-400">
              {" "}
              {main.lane === 0
                ? "(the centre line)"
                : main.lane > 0
                  ? "(above the centre line)"
                  : "(below the centre line)"}
            </span>
          </dd>
          {partial && (
            <>
              <dt className="text-gray-500">Runs</dt>
              <dd className="text-gray-800">
                {main.fromPos}″ → {main.toPos}″
                <span className="text-gray-400"> (between its turnouts)</span>
              </dd>
            </>
          )}
        </dl>
        {/* Length is NOT editable here on purpose. A derived main's length IS the
            module's length, and a second field for it would be a second source
            of truth; a drawn main's length is whatever the path measures. Change
            it by dragging the end, or by editing the module's length. */}
        <p className="text-xs text-gray-400">
          {main.drawn
            ? "To change the length, drag the end of the line."
            : isMain2
              ? "Its extent follows the turnouts that open and close it."
              : "Its length is the module's length — change that in the Module panel, or drag the end to draw a shorter main."}
        </p>
        {main.drawn && (
          <button
            type="button"
            onClick={() =>
              patch((s) => {
                if (isMain2) s.main2Path = [];
                else s.mainPath = [];
              })
            }
            className={`${addBtn} w-full`}
          >
            {isMain2 ? "Straighten (back to parallel)" : "Straighten (back to derived)"}
          </button>
        )}
        {flexBlock(main.id)}
      </>,
    );
  }

  // ---- Track ----
  const i = state.extraTracks.findIndex((t) => t.id === selection.id);
  if (i < 0) return null;
  const t = state.extraTracks[i];
  // What this track actually holds, to the clearance-point standard (#19/#20).
  const cap = usableCapacity({
    fromPos: t.fromPos,
    toPos: t.toPos,
    governing: state.turnouts.filter((sw) => sw.divergeTrack === t.id),
    measuredUsableInches: t.measuredUsableInches,
    library: partLibrary,
  });
  const round1 = (v: number) => Math.round(v * 10) / 10;
  /**
   * ⭐ A RUN AUTHORED BY ITS PATH GETS THE COMPACT INSPECTOR — because it has no
   * siding-style extent, kind or capacity to edit, which is a fact about how it
   * was drawn, not about what it is FOR.
   *
   * ⚠️ This used to ask `role === "branch"`. That is the owner's LABEL (#226 —
   * what a route means operationally is the layout's question), and it was wrong
   * at both ends: a return loop is drawn the same way and was told it ran to
   * "endplate ?", while the same panel insisted a route out was a "branch". The
   * geometry answers both — {@link measuredAlongPath} — and the copy now says
   * which of the two this is instead of assuming.
   */
  if (measuredAlongPath(t)) {
    const bIdx = state.branches.findIndex((b) => b.trackId === t.id);
    const epId = bIdx >= 0 ? String.fromCharCode(67 + bIdx) : null;
    return shell(
      `Track · ${trackLabel(t, i)}`,
      <>
        <label className="block text-xs font-medium text-gray-600">
          Name
          <input
            value={t.trackName ?? ""}
            onChange={(e) => patch((s) => (s.extraTracks[i].trackName = e.target.value))}
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <p className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
          {epId ? (
            <>
              A main to <span className="font-medium">endplate {epId}</span> — it
              reaches an end of the module, so it is a route out, whatever the
              layout beyond makes of it. Drag its handles on the board to match
              the build; it meets the endplate square, straight for 4″ from the
              face (Free-moN §2.0).
            </>
          ) : (
            <>
              Drawn as a path across the board rather than measured along the
              module, so it is authored by its shape — drag its handles to match
              the build. Its length and its rail joints are measured along the
              route itself.
            </>
          )}
        </p>
        {flexBlock(t.id)}
      </>,
      {
        fn: () =>
          patch((s) => {
            const removed = s.extraTracks[i]?.id;
            s.extraTracks.splice(i, 1);
            if (removed) {
              for (const tn of s.turnouts) if (tn.divergeTrack === removed) tn.divergeTrack = "";
              for (const b of s.branches) if (b.trackId === removed) b.trackId = null;
            }
          }),
        label: "Remove this route",
      },
    );
  }
  return shell(
    `Track · ${trackLabel(t, i)}`,
    <>
      <label className="block text-xs font-medium text-gray-600">
        Name
        <input
          value={t.trackName ?? ""}
          onChange={(e) => patch((s) => (s.extraTracks[i].trackName = e.target.value))}
          className={`mt-0.5 ${inp}`}
          placeholder="e.g. Siding 1"
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Kind
        <select
          value={t.role}
          onChange={(e) => patch((s) => (s.extraTracks[i].role = e.target.value as TrackRole))}
          className={`mt-0.5 ${inp}`}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-gray-600">
          Starts (in from A)
          <input
            type="number"
            step={0.5}
            value={t.fromPos}
            onChange={(e) =>
              patch((s) => {
                s.extraTracks[i].fromPos = Number(e.target.value);
                // A hand-drawn 2-D path WINS over from/to on the board, so
                // retyping the extent used to move the numbers, the dispatcher
                // view and nothing else — the drawn track stayed the old shape
                // and length. Typing an extent is the more explicit statement,
                // so it drops the stale path and the track re-derives on its
                // lane.
                s.extraTracks[i].path = [];
              })
            }
            className={`mt-0.5 ${inp}`}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Ends (in from A)
          <input
            type="number"
            step={0.5}
            value={t.toPos}
            onChange={(e) =>
              patch((s) => {
                s.extraTracks[i].toPos = Number(e.target.value);
                s.extraTracks[i].path = []; // see Starts, above
              })
            }
            className={`mt-0.5 ${inp}`}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-gray-600">
          Lane
          <LaneField
            value={t.lane}
            onCommit={(n) => patch((s) => (s.extraTracks[i].lane = n))}
            inp={inp}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Capacity
          <div
            className={`mt-0.5 ${inp} bg-gray-50 text-gray-600`}
            title="Usable capacity — measured from the governing turnout's clearance point, not rail end to rail end."
          >
            {cap.cars} cars · {cap.scaleFeet} ft
          </div>
        </label>
      </div>
      {/* ⭐ USABLE capacity, per the clearance-point standard (#19). Physical
          length is not capacity: a car standing short of the clearance point
          fouls the route it diverged from, so those inches hold nothing. */}
      <div className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Drawn</span>
          <span className="tabular-nums">{round1(cap.drawnInches)}″</span>
        </div>
        {cap.givenUpInches > 0.05 && (
          <div className="flex justify-between text-gray-500">
            <span>
              {t.measuredUsableInches != null ? "Not usable (measured)" : "Clearance point"}
            </span>
            <span className="tabular-nums">−{round1(cap.givenUpInches)}″</span>
          </div>
        )}
        <div className="mt-0.5 flex justify-between border-t border-gray-200 pt-0.5 font-medium text-gray-800">
          <span>Usable</span>
          <span className="tabular-nums">{round1(cap.usableInches)}″</span>
        </div>
      </div>
      <label className="block text-xs font-medium text-gray-600">
        Measured usable length (in)
        <CommitNumberField
          value={t.measuredUsableInches ?? null}
          placeholder={String(round1(cap.usableInches))}
          onCommit={(v) =>
            patch((s) => {
              if (v == null || v < 0) delete s.extraTracks[i].measuredUsableInches;
              else s.extraTracks[i].measuredUsableInches = v;
            })
          }
          inp={inp}
          title="Put a tape on the real track: clearance point to the end of the track (or clearance point to clearance point on a siding). Leave blank and it's worked out from the drawing."
        />
        <span className="mt-1 block font-normal text-[11px] text-gray-500">
          {t.measuredUsableInches != null
            ? "Your measurement, used instead of the drawing."
            : "Blank — worked out from the drawing and the turnouts' clearance points. Type a figure if you've measured the real thing."}
        </span>
      </label>
      {/* Promote a parallel lane-1 track to MAIN 2 — the module becomes double
          track (both endplates), Main 2 runs endplate to endplate, and
          everything attached to this track moves onto it (#double-mainline). */}
      {t.lane === 1 &&
        !(t.path && t.path.length >= 2) &&
        t.role !== "spur" &&
        t.role !== "crossover" &&
        state.configA !== "double" &&
        state.configB !== "double" &&
        !state.loop &&
        !lockedConfigs.a &&
        !lockedConfigs.b && (
          <button
            type="button"
            onClick={() => {
              patch((s) => {
                const tr = s.extraTracks.find((x) => x.id === t.id);
                if (!tr) return;
                s.configA = "double";
                s.configB = "double";
                for (const sw of s.turnouts) {
                  if (sw.onTrack === tr.id) sw.onTrack = MAIN2_TRACK_ID;
                  if (sw.divergeTrack === tr.id) sw.divergeTrack = MAIN2_TRACK_ID;
                }
                for (const ind of s.industries) {
                  if (ind.track === tr.id) ind.track = MAIN2_TRACK_ID;
                  for (const sp of ind.spots) if (sp.track === tr.id) sp.track = MAIN2_TRACK_ID;
                }
                for (const x of s.crossings) {
                  if (x.trackA === tr.id) x.trackA = MAIN2_TRACK_ID;
                  if (x.trackB === tr.id) x.trackB = MAIN2_TRACK_ID;
                }
                for (const cp of s.controlPoints)
                  for (const sig of cp.signals) if (sig.track === tr.id) sig.track = MAIN2_TRACK_ID;
                s.extraTracks.splice(s.extraTracks.findIndex((x) => x.id === tr.id), 1);
              });
              select(null);
            }}
            className="w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            title="Both endplates become double-track; Main 2 runs endplate to endplate, and everything on this track (turnouts, industries, signals) moves onto it."
          >
            Make this the second main (double mainline)
          </button>
        )}
      {state.loop && (
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={t.inLoop ?? false}
            onChange={(e) => patch((s) => (s.extraTracks[i].inLoop = e.target.checked))}
          />
          <span title="This track sits inside the balloon (past the throat) — it renders in the loop's ladder.">
            Inside the loop
          </span>
        </label>
      )}
      {crossoverBlock(i)}
      {flexBlock(t.id)}
    </>,
    {
      fn: () =>
        patch((s) => {
          const removed = s.extraTracks[i]?.id;
          s.extraTracks.splice(i, 1);
          if (removed) {
            // Clear references so a branch endplate / turnout doesn't point at a
            // track that no longer exists (#170).
            for (const tn of s.turnouts) if (tn.divergeTrack === removed) tn.divergeTrack = "";
            for (const b of s.branches) if (b.trackId === removed) b.trackId = null;
          }
        }),
      label: "Remove track",
    },
  );
}

/** Suggest a car type that isn't in the list yet (admin-reviewed, usable now). */
function CarTypeSuggest({
  onSuggested,
}: {
  onSuggested: (o: { value: string; display_label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-blue-600 hover:underline"
      >
        Don&rsquo;t see it? Suggest a car type…
      </button>
    );
  }
  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await submitCarTypeSuggestion(value, label, "");
      if (r.ok) {
        onSuggested(r.option);
        setOpen(false);
        setValue("");
        setLabel("");
      } else {
        setErr(r.message);
      }
    });
  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      {err && <p className="mb-1 text-xs text-red-700">{err}</p>}
      <input
        className={inp}
        placeholder="value (e.g. wood_chip_car)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input
        className={`${inp} mt-1`}
        placeholder="Label (e.g. Wood Chip Car)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim() || !label.trim()}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Suggest"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Everything on the module, as a list. This is where things that aren't spatial
 * live — a control point is a named group, not a shape, and a group needs a
 * tree. It's also how you add things until the tool palette lands (stage 2).
 */
/** The unified "add track" menu: the mainline's single/double config, plus
 * adding a siding or a spur/yard (and a crossover on a double main). */
function AddTrackMenu({
  add,
  mainlineDouble,
  mainlineLocked,
  canCrossover,
  turnoutCount,
  align = "right",
}: {
  add: {
    passingSiding: () => void;
    spur: () => void;
    crossover: () => void;
    mainline: (config: "single" | "double") => void;
  };
  mainlineDouble: boolean;
  mainlineLocked: boolean;
  canCrossover: boolean;
  turnoutCount: number;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={addBtn}>
        + Track ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${align === "left" ? "left-0" : "right-0"}`}>
            <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Mainline
            </div>
            {/* ⚠️ These do NOT add a track — every module already has a main;
                it IS the centre-line. Read as "add a single track", they were a
                silent no-op on a module that was already single (#210). Say
                what they do, and the header above says the main is already
                there. */}
            <div className="px-2 pb-1 text-[10px] leading-snug text-gray-400">
              Already on the board — it runs the length of the module. These
              choose how many tracks it is.
            </div>
            <button type="button" className={item} disabled={mainlineLocked} onClick={() => run(() => add.mainline("single"))}>
              <span className="w-3 text-blue-600">{!mainlineDouble ? "●" : "○"}</span> Single track
            </button>
            <button type="button" className={item} disabled={mainlineLocked} onClick={() => run(() => add.mainline("double"))}>
              <span className="w-3 text-blue-600">{mainlineDouble ? "●" : "○"}</span> Double track
            </button>
            {mainlineLocked && (
              <div className="px-2 py-0.5 text-[10px] text-gray-400">
                Set on the module&rsquo;s endplate records.
              </div>
            )}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              className={item}
              disabled={turnoutCount < 2}
              onClick={() => run(add.passingSiding)}
            >
              Siding
            </button>
            <button
              type="button"
              className={item}
              disabled={turnoutCount < 1}
              onClick={() => run(add.spur)}
            >
              Spur / Yard
            </button>
            {turnoutCount < 2 && (
              <div className="px-2 py-0.5 text-[10px] text-gray-400">
                {turnoutCount < 1
                  ? "Add a turnout first — sidings & spurs diverge from one."
                  : "A siding needs a second turnout."}
              </div>
            )}
            {canCrossover && (
              <button type="button" className={item} onClick={() => run(add.crossover)}>
                Crossover
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ObjectsList({
  state,
  selection,
  select,
  setTool,
  add,
  mains,
  flex,
  mainlineDouble,
  mainlineLocked,
  endplates,
  undeclaredCrossings,
}: {
  state: EditorState;
  selection: Selection | null;
  select: (s: Selection | null) => void;
  setTool: (t: CanvasTool) => void;
  add: {
    passingSiding: () => void;
    spur: () => void;
    crossover: () => void;
    turnout: () => void;
    crossing: () => void;
    controlPoint: () => void;
    industry: () => void;
    mainline: (config: "single" | "double") => void;
    endplate: () => void;
  };
  /** The mains as rows — they aren't `extraTracks`, so they're passed in (#192). */
  mains: { id: string; label: string; sub: string }[];
  /** Each run cut into lengths of flex track, by track id (#193). */
  flex: Record<
    string,
    { pieces: FlexPiece[]; partId: string; authored: boolean; runInches: number; alongPath: boolean; unmapped: boolean }
  >;
  mainlineDouble: boolean;
  mainlineLocked: boolean;
  endplates: { id: string; config?: string }[];
  /** Crossings the drawing implies that nobody authored (#crossings). */
  undeclaredCrossings: ImplicitCrossing[];
}) {
  /** Corners are keyed by index, everything else by id — compare accordingly.
   * A flex piece needs BOTH: several pieces share one track id (#193). */
  const on = (s: Selection) => {
    if (selection === null || selection.kind !== s.kind) return false;
    if (selection.kind === "corner" && s.kind === "corner") return selection.i === s.i;
    if (selection.kind === "flex" && s.kind === "flex")
      return selection.id === s.id && selection.index === s.index;
    return "id" in selection && "id" in s && selection.id === s.id;
  };

  const row = (
    key: string,
    label: string,
    sel: Selection,
    sub?: string,
    opts?: { indent?: boolean; warn?: boolean },
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => select(sel)}
      className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left text-xs ${
        opts?.indent ? "pl-5" : "pl-2"
      } ${on(sel) ? "bg-blue-50 font-medium text-blue-900" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <span className="truncate">{label}</span>
      {sub && (
        <span className={`ml-auto shrink-0 ${opts?.warn ? "text-amber-600" : "text-gray-400"}`}>
          {sub}
        </span>
      )}
    </button>
  );

  /** What to call a track in prose — the same words its row carries, so a
   * warning about "Main 2" names the row the owner can see. */
  const namedTrack = (id: string) => {
    const main = mains.find((m) => m.id === id);
    if (main) return main.label;
    const i = state.extraTracks.findIndex((t) => t.id === id);
    return i >= 0 ? trackLabel(state.extraTracks[i], i) : id;
  };

  /** A run's rows: the track itself, then the lengths of flex it's made of. */
  const trackRows = (id: string, label: string, sel: Selection, sub?: string) => {
    const f = flex[id];
    return [
      row(id, label, sel, sub),
      ...(f?.pieces ?? []).map((p) =>
        row(
          `${id}#${p.index}`,
          `Piece ${p.index + 1}`,
          { kind: "flex" as const, id, index: p.index },
          `${Math.round(p.lengthInches * 10) / 10}″${p.overlong ? " ⚠" : ""}`,
          { indent: true, warn: p.overlong },
        ),
      ),
    ];
  };

  const canCrossover =
    !state.loop && (state.configA === "double" || state.configB === "double");

  return (
    <div className="mt-auto shrink-0 border-t border-gray-200 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Objects
      </h2>

      {endplates.length > 0 && (
        <Group
          title="Endplates"
          count={endplates.length}
          actions={
            <button
              type="button"
              onClick={add.endplate}
              className={addBtn}
              title="Add a 3rd+ endplate (a junction) — placed on the board; draw track to it separately."
            >
              + Endplate
            </button>
          }
        >
          {endplates.map((e) =>
            row(
              `ep${e.id}`,
              e.id === "A" ? "Endplate A (west)" : e.id === "B" ? "Endplate B (east)" : `Endplate ${e.id}`,
              { kind: "endplate", id: e.id },
              e.config === "double" ? "double" : "single",
            ),
          )}
        </Group>
      )}

      <Group title="Benchwork" count={state.outline.length}>
        {state.outline.length === 0 ? (
          <button
            type="button"
            onClick={() => setTool("benchwork")}
            className={addBtn}
          >
            Draw the benchwork
          </button>
        ) : (
          state.outline.map((_, i) => row(`c${i}`, `Corner ${i + 1}`, { kind: "corner", i }))
        )}
      </Group>

      <Group
        title="Track"
        count={state.extraTracks.length + mains.length}
        actions={
          <AddTrackMenu
            add={add}
            mainlineDouble={mainlineDouble}
            mainlineLocked={mainlineLocked}
            canCrossover={canCrossover}
            turnoutCount={state.turnouts.length}
          />
        }
      >
        {/* THE MAINS. #185 gave the mainline an entry here, but only as a tool
            shortcut — it wasn't selectable and had no details. Both mains are
            now ordinary rows: they select like a siding, and selecting one is
            what arms its handles (#192). They aren't `extraTracks` because the
            main IS the module's centre-line, so they're listed explicitly. */}
        {mains.map((m) => trackRows(m.id, m.label, { kind: "track", id: m.id }, m.sub))}
        {state.extraTracks.map((t, i) => {
          // ⭐⭐ ONE SOURCE FOR "HOW LONG IS THIS RUN": `flexByTrack.runInches`,
          // the same number the flex panel and the cut list read. This row used
          // to recompute it as `toPos − fromPos`, which is the stretch of MODULE
          // a run covers rather than its length — so a route to an endplate,
          // which crosses the board, reported 0″ for 22″ of track (#226).
          // ⚠️ TWO COMPUTATIONS OF ONE QUANTITY is exactly why the 0″ survived
          // the first fix: `runInches` was corrected and this line wasn't.
          const len = flex[t.id]?.runInches ?? Math.abs(t.toPos - t.fromPos);
          // Round to 0.1″ — raw float math read as 18.800000000000004″.
          return trackRows(
            t.id,
            trackLabel(t, i),
            { kind: "track", id: t.id },
            `${Math.round(len * 10) / 10}″`,
          );
        })}
      </Group>

      <Group
        title="Industries"
        count={state.industries.length}
        actions={
          <button type="button" onClick={add.industry} className={addBtn} title="A rail-served customer — a car-spot span on a track.">
            + Industry
          </button>
        }
      >
        {state.industries.map((ind) =>
          row(
            ind.id,
            ind.name || "unnamed",
            { kind: "industry", id: ind.id },
            `${carCapacity(ind.fromPos, ind.toPos)} cars`,
          ),
        )}
      </Group>

      <Group
        title="Turnouts"
        count={state.turnouts.length}
        actions={
          <button type="button" onClick={add.turnout} className={addBtn}>
            + Turnout
          </button>
        }
      >
        {state.turnouts.map((t) =>
          row(t.id, t.name || t.id, { kind: "turnout", id: t.id }, `${Math.round(t.pos * 10) / 10}″`),
        )}
      </Group>

      <Group
        title="Crossings"
        count={state.crossings.length}
        warn={undeclaredCrossings.length}
        actions={
          <button type="button" onClick={add.crossing} className={addBtn}>
            + Crossing
          </button>
        }
      >
        {state.crossings.map((x) =>
          row(x.id, x.name || x.id, { kind: "crossing", id: x.id }, `${Math.round(x.pos * 10) / 10}″`),
        )}
        {/* Track drawn through track with nothing at the junction. Reported here
            because this is the list an owner would come to to fix it — and the
            position named is the TURNOUT's, never the diamond's: that sits a
            lead beyond, which this document doesn't measure. */}
        {undeclaredCrossings.map((c) => (
          <p
            key={`${c.turnoutId}·${c.crossesTrackId}`}
            className="mx-2 my-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800"
            role="status"
          >
            <span className="font-medium">
              {namedTrack(c.trackId)} is drawn through {namedTrack(c.crossesTrackId)}.
            </span>{" "}
            It leaves the turnout at {Math.round(c.atInches * 10) / 10}″ and has to cross{" "}
            {namedTrack(c.crossesTrackId)} to reach its own side — that junction is a diamond, and
            nothing here records one. Add a crossing, or start this track from{" "}
            {namedTrack(c.crossesTrackId)} instead.
          </p>
        ))}
      </Group>

      <Group
        title="Control points"
        count={state.controlPoints.length}
        actions={
          <button type="button" onClick={add.controlPoint} className={addBtn}>
            + CP
          </button>
        }
      >
        {state.controlPoints.map((c) =>
          row(
            c.id,
            c.name || c.id,
            { kind: "cp", id: c.id },
            `${c.signals.length} signal${c.signals.length === 1 ? "" : "s"}`,
          ),
        )}
      </Group>
    </div>
  );
}

function Group({
  title,
  count,
  warn = 0,
  actions,
  children,
}: {
  title: string;
  count: number;
  /** Things in this group that need attention but are NOT objects in the
   * document — kept apart from `count` because that badge means "this many
   * exist", and a warning about a crossing nobody authored must not be counted
   * as a crossing. It opens the group and marks it: a section that stays shut
   * because it holds no objects would hide the very thing it is warning about. */
  warn?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details open={count > 0 || warn > 0} className="group mb-1">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded px-1 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
        <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
        {title}
        {count > 0 && (
          <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-600">
            {count}
          </span>
        )}
        {warn > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
            ⚠ {warn}
          </span>
        )}
        {actions && <span className="ml-auto flex gap-1">{actions}</span>}
      </summary>
      <div className="ml-4 mt-0.5 space-y-0.5">{children}</div>
    </details>
  );
}
