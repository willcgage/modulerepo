/**
 * Module schematic (track-graph) — the structured doc an owner authors here and
 * Free-Dispatcher imports and composes into a layout. Topological and
 * straightened-first: positions are 1-D inches along the module (from endplate
 * A), lanes are integer track indices (0 = primary main). See the format spec in
 * the free-dispatcher repo: docs/module-schematic-format.md.
 *
 * This module holds the doc types, the pure feature resolver the live preview
 * draws, and the editor <-> doc conversions.
 */

export type TrackConfig = "single" | "double";
export type TrackRole = "main" | "siding" | "spur" | "yard" | "crossover";
export type TurnoutKind = "left" | "right" | "wye";
export type SignalFacing = "AtoB" | "BtoA";

export interface SchematicEndplate {
  id: string; // "A" (West) | "B" (East)
  label?: string;
  tracks: { trackId: string; lane: number; config: TrackConfig }[];
}
export interface SchematicTrack {
  id: string;
  role: TrackRole;
  lane: number;
  from?: string;
  to?: string;
  fromPos?: number;
  toPos?: number;
  capacityFeet?: number | null;
  /** The module_tracks row this track is (single source of truth); null = new. */
  moduleTrackId?: number | null;
  /** Owner's track name, mirrored to module_tracks.track_name. */
  trackName?: string;
}
export interface SchematicTurnout {
  id: string;
  pos: number;
  onTrack: string;
  divergeTrack: string;
  kind: TurnoutKind;
  name?: string;
}
export interface SchematicSignal {
  id: string;
  pos: number;
  track: string;
  facing: SignalFacing;
  kind: "mast" | "dwarf";
  name?: string;
  /** Turnout this control point is attached to (absent = standalone block signal). */
  turnout?: string;
}
/**
 * A control point is an interlocking: a named group of one or more signals and
 * zero or more turnouts. A passing siding has two (West/East); a lone block
 * signal is a control point with one signal and no turnouts.
 */
export interface SchematicControlPoint {
  id: string;
  name: string;
  turnouts: string[]; // turnout ids
  signals: { id: string; pos: number; track: string; facing: SignalFacing; kind: "mast" | "dwarf" }[];
}
export interface ModuleSchematicDoc {
  version: number;
  module?: string;
  lengthInches: number;
  endplates: SchematicEndplate[];
  tracks: SchematicTrack[];
  turnouts?: SchematicTurnout[];
  controlPoints?: SchematicControlPoint[];
  /** @deprecated pre-grouping flat signals; read for back-compat. */
  signals?: SchematicSignal[];
}

// ---- Editor state (a flatter shape the form binds to) ---------------------

export interface EditorTrack {
  id: string;
  role: TrackRole;
  lane: number;
  fromPos: number;
  toPos: number;
  /** module_tracks row id (single source of truth), or null for a new track. */
  moduleTrackId: number | null;
  /** Owner's track name → module_tracks.track_name. */
  trackName: string;
}

/** A module_tracks row as loaded for the editor. */
export interface ModuleTrackRow {
  id: number;
  track_name: string | null;
  capacity_scale_feet: number | null;
}
export interface EditorTurnout {
  id: string;
  name: string;
  pos: number;
  onTrack: string;
  divergeTrack: string;
  kind: TurnoutKind;
}
export interface EditorCpSignal {
  id: string;
  pos: number;
  track: string;
  facing: SignalFacing;
}
export interface EditorControlPoint {
  id: string;
  name: string;
  turnouts: string[]; // turnout ids grouped under this control point
  signals: EditorCpSignal[];
}
export interface EditorState {
  lengthInches: number;
  configA: TrackConfig;
  configB: TrackConfig;
  extraTracks: EditorTrack[]; // sidings/spurs/…; the main track is implicit
  turnouts: EditorTurnout[];
  controlPoints: EditorControlPoint[];
}

export const MAIN_TRACK_ID = "main";

// North American N scale (1:160): 396 real inches → 5280 scale feet = one mile.
export const N_SCALE_RATIO = 160;
/** Real inches on the module → scale feet of prototype track represented. */
export function inchesToScaleFeet(inches: number, ratio = N_SCALE_RATIO): number {
  return (inches * ratio) / 12;
}
/** Scale feet of prototype track → real inches on the module. */
export function scaleFeetToInches(feet: number, ratio = N_SCALE_RATIO): number {
  return (feet * 12) / ratio;
}

/** Parse a jsonb value into a schematic doc, or null if it isn't one. */
export function asModuleSchematic(x: unknown): ModuleSchematicDoc | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  if (typeof d.version !== "number") return null;
  if (!Array.isArray(d.endplates) || !Array.isArray(d.tracks)) return null;
  return d as unknown as ModuleSchematicDoc;
}

/** Build the empty editor state for a module of the given length. */
export function emptyEditorState(lengthInches: number): EditorState {
  return {
    lengthInches: lengthInches > 0 ? lengthInches : 24,
    configA: "single",
    configB: "single",
    extraTracks: [],
    turnouts: [],
    controlPoints: [],
  };
}

/** Assemble a spec-conformant doc from the editor state. */
export function stateToDoc(
  state: EditorState,
  recordNumber: string,
): ModuleSchematicDoc {
  return {
    version: 1,
    module: recordNumber,
    lengthInches: state.lengthInches,
    endplates: [
      { id: "A", label: "West", tracks: [{ trackId: MAIN_TRACK_ID, lane: 0, config: state.configA }] },
      { id: "B", label: "East", tracks: [{ trackId: MAIN_TRACK_ID, lane: 0, config: state.configB }] },
    ],
    tracks: [
      { id: MAIN_TRACK_ID, role: "main", lane: 0, from: "A", to: "B" },
      ...state.extraTracks.map((t) => ({
        id: t.id,
        role: t.role,
        lane: t.lane,
        fromPos: t.fromPos,
        toPos: t.toPos,
        moduleTrackId: t.moduleTrackId,
        trackName: t.trackName || undefined,
        capacityFeet: Math.round(inchesToScaleFeet(Math.abs(t.toPos - t.fromPos))),
      })),
    ],
    turnouts: state.turnouts.map((t) => ({
      id: t.id,
      pos: t.pos,
      onTrack: t.onTrack,
      divergeTrack: t.divergeTrack,
      kind: t.kind,
      name: t.name || undefined,
    })),
    controlPoints: state.controlPoints.map((c) => ({
      id: c.id,
      name: c.name,
      turnouts: c.turnouts,
      signals: c.signals.map((s) => ({
        id: s.id,
        pos: s.pos,
        track: s.track,
        facing: s.facing,
        kind: "mast" as const,
      })),
    })),
  };
}

/**
 * Derive editor state from the doc and the module's Track section rows. Tracks
 * are the single source of truth for name/capacity (module_tracks), while the
 * schematic doc adds geometry (lane, positions). We merge: doc tracks first
 * (they carry geometry + their moduleTrackId link), then any module_tracks not
 * yet positioned in the schematic.
 */
export function docToState(
  doc: unknown,
  fallbackLength: number,
  moduleTracks: ModuleTrackRow[] = [],
): EditorState {
  const base = emptyEditorState(fallbackLength);
  const d =
    doc && typeof doc === "object" ? (doc as ModuleSchematicDoc) : null;
  const hasDoc = d && typeof d.lengthInches === "number" && Array.isArray(d.tracks);
  const len = hasDoc ? d!.lengthInches : fallbackLength;

  const nameOf = (id: number | null | undefined): string => {
    const mt = id != null ? moduleTracks.find((m) => m.id === id) : undefined;
    return mt?.track_name ?? "";
  };

  const extraTracks: EditorTrack[] = [];
  const usedMt = new Set<number>();
  if (hasDoc) {
    for (const t of d!.tracks) {
      if (t.role === "main") continue;
      const moduleTrackId = t.moduleTrackId ?? null;
      if (moduleTrackId != null) usedMt.add(moduleTrackId);
      extraTracks.push({
        id: t.id,
        role: (t.role as TrackRole) ?? "siding",
        lane: t.lane ?? 1,
        fromPos: t.fromPos ?? 0,
        toPos: t.toPos ?? len,
        moduleTrackId,
        trackName: t.trackName ?? nameOf(moduleTrackId),
      });
    }
  }
  // Link pre-migration doc tracks (no moduleTrackId yet) to unused module_tracks
  // by order — keeping the doc track's id so turnout/signal references stay
  // valid. Only after that do leftover module_tracks become new tracks.
  const unused = moduleTracks.filter((mt) => !usedMt.has(mt.id));
  let ui = 0;
  for (const et of extraTracks) {
    if (et.moduleTrackId == null && ui < unused.length) {
      const mt = unused[ui++];
      et.moduleTrackId = mt.id;
      if (!et.trackName) et.trackName = mt.track_name ?? "";
      usedMt.add(mt.id);
    }
  }
  let lane = Math.max(0, ...extraTracks.map((t) => t.lane));
  for (const mt of moduleTracks) {
    if (usedMt.has(mt.id)) continue;
    lane += 1;
    extraTracks.push({
      id: `mt${mt.id}`,
      role: "siding",
      lane,
      fromPos: Math.round(len * 0.2),
      toPos: Math.round(len * 0.8),
      moduleTrackId: mt.id,
      trackName: mt.track_name ?? "",
    });
  }

  if (!hasDoc) return { ...base, lengthInches: len, extraTracks };

  const configOf = (id: string): TrackConfig => {
    const ep = (d!.endplates ?? []).find((e) => e.id === id);
    return ep?.tracks?.[0]?.config === "double" ? "double" : "single";
  };
  return {
    lengthInches: len,
    configA: configOf("A"),
    configB: configOf("B"),
    extraTracks,
    turnouts: (d!.turnouts ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "",
      pos: t.pos,
      onTrack: t.onTrack,
      divergeTrack: t.divergeTrack,
      kind: (t.kind as TurnoutKind) ?? "right",
    })),
    controlPoints: readControlPoints(d!),
  };
}

/** Control points from a doc, migrating pre-grouping flat signals into groups. */
function readControlPoints(d: ModuleSchematicDoc): EditorControlPoint[] {
  if (Array.isArray(d.controlPoints)) {
    return d.controlPoints.map((c) => ({
      id: c.id,
      name: c.name ?? "",
      turnouts: c.turnouts ?? [],
      signals: (c.signals ?? []).map((s) => ({
        id: s.id,
        pos: s.pos,
        track: s.track,
        facing: (s.facing as SignalFacing) ?? "AtoB",
      })),
    }));
  }
  // Back-compat: group old flat signals by their turnout (or standalone).
  const groups = new Map<string, EditorControlPoint>();
  let n = 0;
  for (const s of d.signals ?? []) {
    const key = s.turnout || `blk-${s.id}`;
    let cp = groups.get(key);
    if (!cp) {
      cp = { id: `cp${++n}`, name: s.name ?? "", turnouts: s.turnout ? [s.turnout] : [], signals: [] };
      groups.set(key, cp);
    }
    cp.signals.push({
      id: s.id,
      pos: s.pos,
      track: s.track,
      facing: (s.facing as SignalFacing) ?? "AtoB",
    });
  }
  return [...groups.values()];
}

/** Find an unused `${prefix}${n}` id given the ones already present. */
export function nextId(prefix: string, existing: string[]): string {
  let n = 1;
  while (existing.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/**
 * Build a passing siding as one unit: the siding track, a switch at each end,
 * and control-point signals for both directions at each end (prototype Station
 * Entering Signal). Returns the new items to merge into the editor state.
 */
export function buildPassingSiding(state: EditorState): {
  track: EditorTrack;
  turnouts: EditorTurnout[];
  controlPoints: EditorControlPoint[];
} {
  const len = state.lengthInches > 0 ? state.lengthInches : 24;
  const inset = Math.max(6, Math.round(len * 0.08));
  const fromPos = inset;
  const toPos = Math.max(fromPos + 1, len - inset);
  const lane = Math.max(1, ...state.extraTracks.map((t) => t.lane + 1));

  const trackIds = [MAIN_TRACK_ID, ...state.extraTracks.map((t) => t.id)];
  const sidId = nextId("sid", trackIds);
  const track: EditorTrack = {
    id: sidId,
    role: "siding",
    lane,
    fromPos,
    toPos,
    moduleTrackId: null,
    trackName: "Passing siding",
  };

  const swIds = state.turnouts.map((t) => t.id);
  const swW = nextId("sw", swIds);
  const swE = nextId("sw", [...swIds, swW]);
  const turnouts: EditorTurnout[] = [
    { id: swW, name: "West Siding", pos: fromPos, onTrack: MAIN_TRACK_ID, divergeTrack: sidId, kind: "right" },
    { id: swE, name: "East Siding", pos: toPos, onTrack: MAIN_TRACK_ID, divergeTrack: sidId, kind: "left" },
  ];

  // One control point at each end, each grouping its switch and both-direction
  // signals on the main (prototype Station Entering Signal).
  const cpIds = state.controlPoints.map((c) => c.id);
  const cpW = nextId("cp", cpIds);
  const cpE = nextId("cp", [...cpIds, cpW]);
  const sig = (cpId: string, pos: number, facing: SignalFacing): EditorCpSignal => ({
    id: `${cpId}-${facing}`,
    pos,
    track: MAIN_TRACK_ID,
    facing,
  });
  const controlPoints: EditorControlPoint[] = [
    { id: cpW, name: "West Siding", turnouts: [swW], signals: [sig(cpW, fromPos, "AtoB"), sig(cpW, fromPos, "BtoA")] },
    { id: cpE, name: "East Siding", turnouts: [swE], signals: [sig(cpE, toPos, "AtoB"), sig(cpE, toPos, "BtoA")] },
  ];

  return { track, turnouts, controlPoints };
}

// ---- Pure feature resolver (the preview draws these) ----------------------

export interface DrawTrack {
  id: string;
  role: TrackRole;
  lane: number;
  fromFrac: number;
  toFrac: number;
}
export interface DrawTurnout {
  id: string;
  name: string;
  posFrac: number;
  onLane: number;
  divergeLane: number;
}
export interface DrawSignal {
  id: string;
  name: string;
  posFrac: number;
  lane: number;
  facing: SignalFacing;
}
export interface ModuleFeatures {
  doubleMain: boolean;
  extraTracks: DrawTrack[];
  turnouts: DrawTurnout[];
  signals: DrawSignal[];
}

/** Resolve a doc into positioned drawables (fractions of the module length). */
export function moduleFeatures(doc: ModuleSchematicDoc): ModuleFeatures {
  const len = doc.lengthInches > 0 ? doc.lengthInches : 1;
  // To-scale: a feature renders at its true position along the module (its
  // inches from endplate A), clamped only to the module's own extent. Signals
  // near an end therefore read at their real spot, not bunched at an inset.
  const clampFrac = (p: number) => Math.min(1, Math.max(0, p / len));

  const trackLane = new Map<string, number>();
  for (const t of doc.tracks) trackLane.set(t.id, t.lane);

  const endplatePos = new Map<string, number>();
  doc.endplates.forEach((e, i) => endplatePos.set(e.id, i === 0 ? 0 : len));
  const turnoutPos = new Map<string, number>();
  for (const t of doc.turnouts ?? []) turnoutPos.set(t.id, t.pos);
  const posOf = (nodeId?: string): number | null => {
    if (nodeId == null) return null;
    if (endplatePos.has(nodeId)) return endplatePos.get(nodeId)!;
    if (turnoutPos.has(nodeId)) return turnoutPos.get(nodeId)!;
    return null;
  };

  const doubleMain = doc.endplates.some((e) =>
    e.tracks?.some((t) => t.config === "double"),
  );

  const extraTracks: DrawTrack[] = [];
  for (const t of doc.tracks) {
    if (t.role === "main") continue;
    const from = t.fromPos ?? posOf(t.from);
    const to = t.toPos ?? posOf(t.to);
    if (from == null || to == null) continue;
    extraTracks.push({
      id: t.id,
      role: t.role,
      lane: t.lane,
      fromFrac: clampFrac(Math.min(from, to)),
      toFrac: clampFrac(Math.max(from, to)),
    });
  }

  const turnouts: DrawTurnout[] = (doc.turnouts ?? []).map((t) => ({
    id: t.id,
    name: t.name ?? "",
    posFrac: clampFrac(t.pos),
    onLane: trackLane.get(t.onTrack) ?? 0,
    divergeLane: trackLane.get(t.divergeTrack) ?? 1,
  }));
  // Signals come from control-point groups; fall back to pre-grouping flat
  // signals for docs authored before the model changed.
  const signals: DrawSignal[] = Array.isArray(doc.controlPoints)
    ? doc.controlPoints.flatMap((c) =>
        c.signals.map((s) => ({
          id: s.id,
          name: c.name,
          posFrac: clampFrac(s.pos),
          lane: trackLane.get(s.track) ?? 0,
          facing: s.facing,
        })),
      )
    : (doc.signals ?? []).map((s) => ({
        id: s.id,
        name: s.name ?? "",
        posFrac: clampFrac(s.pos),
        lane: trackLane.get(s.track) ?? 0,
        facing: s.facing,
      }));

  return { doubleMain, extraTracks, turnouts, signals };
}
