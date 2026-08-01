"use client";

import {
  RAIL_GAUGE_INCHES,
  buildTrackGraph,
  flexRunEnd,
  partGeometry,
  pieceRoutePaths,
  placedJoints,
  type TrackPart,
  type TrackPiece,
} from "@/lib/module-schematic";

/**
 * THE PIECE LAYER (ADR 0001) — track drawn as the parts it is built from.
 *
 * Everything here is about the GRAPH: pieces placed on the board, and the joints
 * where they meet. It deliberately knows nothing about `pos`, lanes or the
 * mainline — those are DERIVED from this by the package, and a module authored
 * this way still produces the same ordinary document every existing reader
 * consumes.
 *
 * The geometry all comes from the package (`pieceRoutePaths`, `placedJoints`,
 * `buildTrackGraph`); this file only draws it and hit-tests it. Anything that
 * decides where track goes belongs upstream where one definition serves both
 * apps — the third time a field reached the model but not the canvas was
 * because a renderer had its own copy of the answer.
 */

export type Pt = { x: number; y: number };

/** The canvas draws with y DOWN; the model measures y UP. One flip, here. */
const sy = (y: number) => -y;
const poly = (pts: Pt[]) => pts.map((p) => `${p.x},${sy(p.y)}`).join(" ");

/** Roadbed band width — the same figure the 1-D track render uses, so a graph
 * module and a positional one look like the same railway. */
const ROADBED = 1.3;

// ─── Geometry helpers (pure) ─────────────────────────────────────────────────

/** Every route through every piece, ready to draw. */
export function piecePaths(pieces: TrackPiece[], library: TrackPart[]) {
  return pieces.map((piece) => ({
    id: piece.id,
    routes: pieceRoutePaths(piece, library).map((r) => r.points),
  }));
}

/** The piece under a point, nearest first — hit on the ROUTE, which is where the
 * track an owner is pointing at actually is. */
export function pieceAt(
  pieces: TrackPiece[],
  pt: Pt,
  library: TrackPart[],
  withinInches: number,
): TrackPiece | null {
  let best: { piece: TrackPiece; d: number } | null = null;
  for (const piece of pieces) {
    for (const { points } of pieceRoutePaths(piece, library)) {
      for (let i = 1; i < points.length; i++) {
        const d = distToSegment(pt, points[i - 1], points[i]);
        if (d <= withinInches && (!best || d < best.d)) best = { piece, d };
      }
    }
  }
  return best?.piece ?? null;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * Where a flex piece's far end should sit for a pointer at `pt`.
 *
 * ⚠️ The length is the pointer's distance ALONG the piece's own direction, not
 * its distance from the origin. Dragging sideways must not lengthen the run —
 * a piece is laid in the direction it was laid, and the joint at its near end
 * is already connected to something.
 */
export function flexLengthFor(piece: TrackPiece, pt: Pt): number {
  const rad = (piece.rotationDeg * Math.PI) / 180;
  const along = (pt.x - piece.x) * Math.cos(rad) + (pt.y - piece.y) * Math.sin(rad);
  return Math.max(1, Math.round(along * 100) / 100);
}

/** The angle a rotate-handle drag implies, degrees. */
export function rotationFor(piece: TrackPiece, pt: Pt): number {
  const deg = (Math.atan2(pt.y - piece.y, pt.x - piece.x) * 180) / Math.PI;
  return Math.round(deg * 10) / 10;
}

/** Where the rotate handle sits for a piece — off its origin, along its own
 * direction, far enough out to grab without covering the track. */
export function rotateHandleAt(piece: TrackPiece, library: TrackPart[], outInches: number): Pt {
  const part = library.find((p) => p.id === piece.partId);
  const geo = part ? partGeometry(part, library) : null;
  const span =
    part?.kind === "flex"
      ? (piece.lengthInches ?? 6)
      : Math.max(...(geo?.joints ?? [{ x: 6 }]).map((j) => j.x), 1);
  const rad = (piece.rotationDeg * Math.PI) / 180;
  // Along the piece's own axis, clear of a bent run's far end rather than on
  // top of it — turning and bending are different gestures and must not share
  // a handle.
  const d = span + outInches;
  return { x: piece.x + d * Math.cos(rad), y: piece.y + d * Math.sin(rad) };
}

/** A point in the piece's own frame, put on the board. */
function place(piece: TrackPiece, x: number, y: number): Pt {
  const rad = (piece.rotationDeg * Math.PI) / 180;
  const ly = piece.flipped ? -y : y;
  return {
    x: piece.x + x * Math.cos(rad) - ly * Math.sin(rad),
    y: piece.y + x * Math.sin(rad) + ly * Math.cos(rad),
  };
}

/** Where the BEND handle sits: the middle of the run, on the rail. */
export function bendHandleAt(piece: TrackPiece): Pt {
  const mid = flexRunEnd((piece.lengthInches ?? 0) / 2, piece.radiusInches);
  return place(piece, mid.x, mid.y);
}

/**
 * The radius a bend-drag means: how far the pointer has pulled the middle of
 * the run off its own axis.
 *
 * ⭐ SOLVED AGAINST THE PACKAGE'S OWN `flexRunEnd`, not against a formula
 * written here. A sagitta identity would be a second definition of the arc, and
 * the handle would drift away from the rail it is supposed to be dragging.
 *
 * Offset and radius run opposite ways — pull further, bend tighter — so this
 * bisects rather than inverting anything.
 */
export function radiusForBend(lengthInches: number, offsetInches: number): number | undefined {
  const want = Math.abs(offsetInches);
  // Under a rail's width of pull, the owner means "straight" — and straight has
  // no radius at all, rather than an enormous one.
  if (want < 0.15 || !(lengthInches > 0)) return undefined;
  let tight = lengthInches / (2 * Math.PI); // any tighter closes the circle
  let slack = 100000;
  for (let i = 0; i < 60; i++) {
    const mid = (tight + slack) / 2;
    if (flexRunEnd(lengthInches / 2, mid).y > want) tight = mid;
    else slack = mid;
  }
  return Math.sign(offsetInches) * ((tight + slack) / 2);
}

/** How far a point lies off a piece's own axis — signed, left positive. */
export function offAxis(piece: TrackPiece, pt: Pt): number {
  const rad = (piece.rotationDeg * Math.PI) / 180;
  const d = { x: pt.x - piece.x, y: pt.y - piece.y };
  const perp = -d.x * Math.sin(rad) + d.y * Math.cos(rad);
  return piece.flipped ? -perp : perp;
}

/**
 * Where the walks should START: the open end nearest each of endplate A's track
 * points — the first is the main, the second (a double-track end) is Main 2.
 *
 * ⭐ THE TRACK POINTS ARE THE QUESTION. A module's mains are the runs that meet
 * the endplate, so which run is Main 2 is not something an owner should have to
 * declare: it is the one arriving at the plate's second track. Nothing to
 * author, nothing to get wrong.
 *
 * ⚠️ NOT "the first piece laid". A walk runs ONE WAY from its start joint, so
 * starting in the MIDDLE of a run leaves everything behind it reported as
 * unreachable — exactly what happened the first time a second piece was snapped
 * onto the back of the first. An end of the layout is the only honest place to
 * begin.
 *
 * Derived rather than remembered, so it keeps being right as track is laid.
 */
export function startJointsFor(
  pieces: TrackPiece[],
  library: TrackPart[],
  trackPoints: Pt[],
): { startAt: { piece: string; joint: string }; start2?: { piece: string; joint: string } } | null {
  if (!pieces.length) return null;
  const graph = buildTrackGraph(pieces, library);
  const taken = new Set(graph.connections.flatMap((c) => [c.a, c.b]));
  const open = graph.joints.filter((j) => !taken.has(j.key));
  const from = trackPoints.length ? trackPoints : [{ x: 0, y: 0 }];
  const used = new Set<string>();
  const nearest = (at: Pt) => {
    let best: { key: string; piece: string; joint: string; d: number } | null = null;
    for (const j of open) {
      if (used.has(j.key)) continue; // one end cannot be both mains
      const d = Math.hypot(j.x - at.x, j.y - at.y);
      if (!best || d < best.d) best = { key: j.key, piece: j.piece, joint: j.joint, d };
    }
    if (best) used.add(best.key);
    return best;
  };
  const first = nearest(from[0]);
  // Every joint taken means a closed loop — there is no end to start from, so
  // any joint will do and the walk's own cycle guard stops it.
  if (!first)
    return { startAt: { piece: pieces[0].id, joint: graph.joints[0]?.joint ?? "a" } };
  const second = from.length > 1 ? nearest(from[1]) : null;
  return {
    startAt: { piece: first.piece, joint: first.joint },
    ...(second ? { start2: { piece: second.piece, joint: second.joint } } : {}),
  };
}

/**
 * Endplate A's track points — where its one or two tracks actually cross it,
 * ordered so the first is the one the document calls MAIN 1.
 *
 * ⚠️ THE STORED OFFSETS ARE IN THE PLATE'S OWN FRAME, and which way that points
 * depends on the plate's heading — endplate A faces west, so its "first" offset
 * came out as the UPPER track and the module was born with its mains swapped.
 * Sorted by module +y instead, which is the axis the document's own default is
 * written in: Main 2 sits above Main 1.
 *
 * ⏳ That is a DEFAULT, not a fact. Which physical track is the primary main is
 * an operating decision (a real module in the catalogue runs its through main on
 * the upper track — the case `mainsSwapped` exists for), and there is no way to
 * say so here yet. Worth offering once someone needs it.
 */
export function endplateTrackPoints(pose: {
  x: number;
  y: number;
  heading: number;
  trackOffsets?: number[];
}): Pt[] {
  const offsets = pose.trackOffsets?.length ? pose.trackOffsets : [0];
  // The face runs across the outward normal, so the offsets lie along heading+90.
  const rad = ((pose.heading + 90) * Math.PI) / 180;
  return offsets
    .map((o) => ({ x: pose.x + o * Math.cos(rad), y: pose.y + o * Math.sin(rad) }))
    .sort((a, b) => a.y - b.y);
}

/** What the palette has armed: a part, and which hand of it. */
export type PieceSpec = { partId: string; flipped?: boolean };

/** A new piece of `spec.partId`, laid flat at `pt`. */
export function newPiece(spec: PieceSpec, pt: Pt, existing: TrackPiece[], part?: TrackPart): TrackPiece {
  let n = 1;
  while (existing.some((p) => p.id === `p${n}`)) n += 1;
  return {
    id: `p${n}`,
    partId: spec.partId,
    x: pt.x,
    y: pt.y,
    rotationDeg: 0,
    ...(spec.flipped ? { flipped: true } : {}),
    // Flex is the one piece a builder cuts, so it needs a length to exist at
    // all. A foot is a piece you can see and then drag to what you meant.
    ...(part?.kind === "flex" ? { lengthInches: 12 } : {}),
  };
}

// ─── The layer ───────────────────────────────────────────────────────────────

export function PieceLayer({
  pieces,
  library,
  selectedIds,
  scale,
  laying = false,
  onSelect,
  onPieceDown,
  onHandleDown,
}: {
  pieces: TrackPiece[];
  library: TrackPart[];
  /**
   * ⭐ THE SELECTION IS ALWAYS A SET, even when it holds one piece (#94). It was
   * a single id, and adding a parallel "and also these" list would have given
   * two answers to "is this piece selected" — the exact drift this codebase
   * keeps paying for. One piece is a set of one; the inspector reads the length.
   */
  selectedIds: string[];
  /** Device pixels per inch — marks stay the same size on screen at any zoom. */
  scale: number;
  /**
   * A part is armed and the next click lays it.
   *
   * ⚠️ THE TRACK MUST STOP TAKING CLICKS WHILE THIS IS TRUE. A new piece is
   * almost always wanted at the END OF AN EXISTING RUN — which is a point ON
   * that run's band, so the band swallowed the click and selected the piece
   * instead. The one placement you make most often was the one you could not
   * make. (The turnout tool already works this way for the same reason.)
   */
  laying?: boolean;
  /**
   * `additive` is Shift/Ctrl held — toggle this piece in or out of the set
   * rather than replacing it. The MODIFIER IS READ IN THE LAYER, not by the
   * caller, because the layer is what owns the click.
   */
  onSelect?: (id: string | null, additive?: boolean) => void;
  onPieceDown?: (id: string, e: React.PointerEvent) => void;
  onHandleDown?: (id: string, handle: "rotate" | "flex" | "bend", e: React.PointerEvent) => void;
}) {
  const world = (px: number) => px / scale;
  const selected = new Set(selectedIds);
  /** Handles belong to a SINGLE selection — with several picked, the gesture on
   * offer is "move these together", and a rotate handle on one of them would
   * turn that one alone while the others sat still. */
  const lone = selectedIds.length === 1 ? selectedIds[0] : null;
  const graph = buildTrackGraph(pieces, library);
  const joined = new Set(graph.connections.flatMap((c) => [c.a, c.b]));
  const inConflict = new Set(graph.conflicts.flatMap((c) => c.joints));
  const railsVisible = RAIL_GAUGE_INCHES * scale >= 3;
  const paths = piecePaths(pieces, library);

  return (
    <g className="piece-layer">
      {/* Bands first, then rails — a later piece's 1.3″ roadbed would otherwise
          bury an earlier one's 0.03″ rails, which is exactly the bug that took
          four wrong fixes to find on the positional renderer. */}
      {paths.map((p) =>
        p.routes.map((pts, i) => (
          <polyline
            key={`band${p.id}-${i}`}
            points={poly(pts)}
            fill="none"
            stroke={selected.has(p.id) ? "#bae6fd" : "#e7e2d6"}
            strokeWidth={ROADBED}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={laying ? undefined : { cursor: "move" }}
            pointerEvents={laying ? "none" : undefined}
            onPointerDown={
              laying
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    onSelect?.(p.id, e.shiftKey || e.ctrlKey || e.metaKey);
                    onPieceDown?.(p.id, e);
                  }
            }
          />
        )),
      )}
      {paths.map((p) =>
        p.routes.map((pts, i) => (
          <g key={`rail${p.id}-${i}`} pointerEvents="none">
            {railsVisible ? (
              [RAIL_GAUGE_INCHES / 2, -RAIL_GAUGE_INCHES / 2].map((o, k) => (
                <polyline
                  key={k}
                  points={poly(offsetPath(pts, o))}
                  fill="none"
                  stroke={selected.has(p.id) ? "#0284c7" : "#334155"}
                  strokeWidth={world(0.6)}
                  strokeLinecap="round"
                />
              ))
            ) : (
              <polyline
                points={poly(pts)}
                fill="none"
                stroke={selected.has(p.id) ? "#0284c7" : "#334155"}
                strokeWidth={world(1.1)}
                strokeLinecap="round"
              />
            )}
          </g>
        )),
      )}

      {/* BUMPERS read as a STOP, not as a stub of track. Drawn as the track's
          own rails do not end in anything, a bumper piece would be a short
          orphan band that looks like unfinished track — which is the one thing
          it exists to say it is not. */}
      {pieces.map((p) => {
        const part = library.find((x) => x.id === p.partId);
        if (part?.kind !== "bumper") return null;
        const at = placedJoints([p], library)[0];
        if (!at) return null;
        const rad = (p.rotationDeg * Math.PI) / 180;
        // Across the rails, at the joint it closes.
        const nx = -Math.sin(rad);
        const ny = Math.cos(rad);
        const h = RAIL_GAUGE_INCHES * 1.1;
        return (
          <line
            key={`bmp${p.id}`}
            x1={at.x - nx * h}
            y1={sy(at.y - ny * h)}
            x2={at.x + nx * h}
            y2={sy(at.y + ny * h)}
            stroke={selected.has(p.id) ? "#0284c7" : "#7f1d1d"}
            strokeWidth={world(2.5)}
            strokeLinecap="round"
            pointerEvents="none"
          >
            <title>Bumper — the track ends here</title>
          </line>
        );
      })}

      {/* JOINTS. An open end is a hollow ring and a made connection is a solid
          dot, because "is this actually joined?" is the question this whole
          model turns on — and an owner cannot answer it from the track alone,
          since a piece 0.3″ short of snapping looks exactly like one that met. */}
      {placedJoints(pieces, library).map((j) => {
        const bad = inConflict.has(j.key);
        const made = joined.has(j.key);
        return (
          <circle
            key={j.key}
            cx={j.x}
            cy={sy(j.y)}
            r={world(made ? 2.5 : 3.5)}
            fill={bad ? "#dc2626" : made ? "#334155" : "#ffffff"}
            stroke={bad ? "#dc2626" : made ? "#334155" : "#0f172a"}
            strokeWidth={world(1)}
            pointerEvents="none"
          />
        );
      })}

      {/* Handles for the selected piece: turn it, and — on flex, the one piece a
          builder cuts — pull it to length. */}
      {pieces
        .filter((p) => p.id === lone)
        .map((p) => {
          const part = library.find((x) => x.id === p.partId);
          const rot = rotateHandleAt(p, library, world(18));
          const end = placedJoints([p], library).find((j) => j.joint === "b");
          return (
            <g key={`h${p.id}`}>
              <line
                x1={p.x}
                y1={sy(p.y)}
                x2={rot.x}
                y2={sy(rot.y)}
                stroke="#0284c7"
                strokeWidth={world(0.8)}
                strokeDasharray={`${world(3)} ${world(3)}`}
                pointerEvents="none"
              />
              <circle
                cx={rot.x}
                cy={sy(rot.y)}
                r={world(5)}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={world(1.5)}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHandleDown?.(p.id, "rotate", e);
                }}
              >
                <title>Turn this piece</title>
              </circle>
              {/* BEND — a diamond in the middle of the run, the same handle the
                  benchwork edges use to bow into an arc. Pull it off the axis
                  and the run curves; push it back and it is straight again. */}
              {part?.kind === "flex" && (p.lengthInches ?? 0) > 0 && (() => {
                const b = bendHandleAt(p);
                const k = world(4.5);
                return (
                  <rect
                    x={b.x - k}
                    y={sy(b.y) - k}
                    width={k * 2}
                    height={k * 2}
                    transform={`rotate(45 ${b.x} ${sy(b.y)})`}
                    fill={p.radiusInches ? "#f59e0b" : "#ffffff"}
                    stroke="#d97706"
                    strokeWidth={world(1.5)}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onHandleDown?.(p.id, "bend", e);
                    }}
                  >
                    <title>
                      {p.radiusInches
                        ? `Bent to ${Math.abs(p.radiusInches).toFixed(1)}″ radius — drag to change, push flat for straight`
                        : "Drag to bend this run into a curve"}
                    </title>
                  </rect>
                );
              })()}
              {part?.kind === "flex" && end && (
                <rect
                  x={end.x - world(4)}
                  y={sy(end.y) - world(4)}
                  width={world(8)}
                  height={world(8)}
                  fill="#ffffff"
                  stroke="#0284c7"
                  strokeWidth={world(1.5)}
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onHandleDown?.(p.id, "flex", e);
                  }}
                >
                  <title>Cut this run to length</title>
                </rect>
              )}
            </g>
          );
        })}
    </g>
  );
}

/** Offset a polyline sideways by `d` inches — the two rails of a run. */
function offsetPath(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}
