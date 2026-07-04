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
}
export interface ModuleSchematicDoc {
  version: number;
  module?: string;
  lengthInches: number;
  endplates: SchematicEndplate[];
  tracks: SchematicTrack[];
  turnouts?: SchematicTurnout[];
  signals?: SchematicSignal[];
}

// ---- Editor state (a flatter shape the form binds to) ---------------------

export interface EditorTrack {
  id: string;
  role: TrackRole;
  lane: number;
  fromPos: number;
  toPos: number;
  capacityFeet?: number | null;
}
export interface EditorTurnout {
  id: string;
  name: string;
  pos: number;
  onTrack: string;
  divergeTrack: string;
  kind: TurnoutKind;
}
export interface EditorSignal {
  id: string;
  name: string;
  pos: number;
  track: string;
  facing: SignalFacing;
}
export interface EditorState {
  lengthInches: number;
  configA: TrackConfig;
  configB: TrackConfig;
  extraTracks: EditorTrack[]; // sidings/spurs/…; the main track is implicit
  turnouts: EditorTurnout[];
  signals: EditorSignal[];
}

export const MAIN_TRACK_ID = "main";

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
    signals: [],
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
        capacityFeet: t.capacityFeet ?? null,
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
    signals: state.signals.map((s) => ({
      id: s.id,
      pos: s.pos,
      track: s.track,
      facing: s.facing,
      kind: "mast" as const,
      name: s.name || undefined,
    })),
  };
}

/** Derive editor state from an existing doc (or defaults if there is none). */
export function docToState(
  doc: unknown,
  fallbackLength: number,
): EditorState {
  const base = emptyEditorState(fallbackLength);
  if (!doc || typeof doc !== "object") return base;
  const d = doc as ModuleSchematicDoc;
  if (typeof d.lengthInches !== "number" || !Array.isArray(d.tracks)) return base;

  const configOf = (id: string): TrackConfig => {
    const ep = (d.endplates ?? []).find((e) => e.id === id);
    return ep?.tracks?.[0]?.config === "double" ? "double" : "single";
  };
  return {
    lengthInches: d.lengthInches,
    configA: configOf("A"),
    configB: configOf("B"),
    extraTracks: d.tracks
      .filter((t) => t.role !== "main")
      .map((t) => ({
        id: t.id,
        role: (t.role as TrackRole) ?? "siding",
        lane: t.lane ?? 1,
        fromPos: t.fromPos ?? 0,
        toPos: t.toPos ?? d.lengthInches,
        capacityFeet: t.capacityFeet ?? null,
      })),
    turnouts: (d.turnouts ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "",
      pos: t.pos,
      onTrack: t.onTrack,
      divergeTrack: t.divergeTrack,
      kind: (t.kind as TurnoutKind) ?? "right",
    })),
    signals: (d.signals ?? []).map((s) => ({
      id: s.id,
      name: s.name ?? "",
      pos: s.pos,
      track: s.track,
      facing: (s.facing as SignalFacing) ?? "AtoB",
    })),
  };
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
  const signals: DrawSignal[] = (doc.signals ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "",
    posFrac: clampFrac(s.pos),
    lane: trackLane.get(s.track) ?? 0,
    facing: s.facing,
  }));

  return { doubleMain, extraTracks, turnouts, signals };
}
