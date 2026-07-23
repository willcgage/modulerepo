/**
 * Physical track geometry — maps the schematic's positional model (inches along
 * the mainline + a lane index) onto real points on the module's centre-line, so
 * sidings, turnouts and signals can be drawn on the PHYSICAL canvas instead of
 * only in the straightened dispatcher view. Pure.
 */
export interface Pt {
  x: number;
  y: number;
}

import {
  FREEMO_TRACK_SPACING_INCHES,
  moduleFeatures,
  samplePath,
  type ModuleSchematicDoc,
} from "@/lib/module-schematic";

/** Free-moN double-track centre spacing (inches) — one lane step. Re-exported
 * from the shared contract so this app and Free-Dispatcher can't drift: the
 * standard fixes it at 1.125″ ("Double track endplates must have a track
 * spacing of 1.125 inches"). */
export const LANE_SPACING_INCHES = FREEMO_TRACK_SPACING_INCHES;

/** Cumulative arc length at each vertex of the centre-line. */
function cumulative(center: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < center.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(center[i].x - center[i - 1].x, center[i].y - center[i - 1].y),
    );
  }
  return cum;
}

/** Total centre-line length in inches. */
export function centerlineLength(center: Pt[]): number {
  const cum = cumulative(center);
  return cum[cum.length - 1] ?? 0;
}

/**
 * The point `pos` inches along the centre-line from endplate A, plus the unit
 * LEFT normal there (for offsetting lanes / signal sides). Clamps to the ends.
 */
export function sampleAt(center: Pt[], pos: number): Pt & { nx: number; ny: number } {
  if (center.length === 0) return { x: 0, y: 0, nx: 0, ny: 1 };
  if (center.length === 1) return { ...center[0], nx: 0, ny: 1 };
  const cum = cumulative(center);
  const total = cum[cum.length - 1] || 1;
  const d = Math.max(0, Math.min(total, pos));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = center[i - 1];
  const b = center[i];
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / segLen;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    nx: -dy / len, // left normal
    ny: dx / len,
  };
}

/** Offset (inches) of a lane from the mainline: lane 0 = the main itself. */
export function laneOffset(lane: number): number {
  return (lane ?? 0) * LANE_SPACING_INCHES;
}

/**
 * The inverse of sampleAt: project an arbitrary point onto the centre-line and
 * return how many inches along the main the nearest point is (plus how far off
 * it was). This is what turns "I dragged a turnout to here on the board" back
 * into the schematic's positional model.
 */
export function projectToCenterline(
  center: Pt[],
  p: Pt,
): { pos: number; dist: number } {
  if (center.length < 2) return { pos: 0, dist: Infinity };
  let best = { pos: 0, dist: Infinity };
  let acc = 0;
  for (let i = 1; i < center.length; i++) {
    const a = center[i - 1];
    const b = center[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < best.dist) best = { pos: acc + segLen * t, dist: d };
    acc += segLen;
  }
  return best;
}

export type ReturnLoopShape = "teardrop" | "circle" | "offset-teardrop" | "square";

/**
 * A computed return-loop centre-line: the LEAD (straight, from endplate A east
 * to the throat) then the loop track, which curls around the chosen shape and
 * returns to the throat. Used as the module's authored `mainPath` so the physical
 * view draws the real teardrop/circle/square (a section chain can't express the
 * sharp wye kink at the throat). `throat` is where the loop rejoins the lead — a
 * wye turnout sits there. Pure geometry; tuned visually per shape (#loop).
 */
export function returnLoopPath(
  shape: ReturnLoopShape,
  opts: { leadInches: number; radius: number; boardHalfWidth?: number },
): { path: Pt[]; outline: Pt[]; throat: Pt } {
  const L = Math.max(1, opts.leadInches);
  const R = Math.max(1, opts.radius);
  const hw = opts.boardHalfWidth ?? 6; // half the board width (fascia offset)
  const T = { x: L, y: 0 };
  const path: Pt[] = [{ x: 0, y: 0 }, { x: L, y: 0 }]; // A → lead → throat
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const rd = (pts: Pt[]) => pts.map((p) => ({ x: r2(p.x), y: r2(p.y) }));

  if (shape === "square") {
    const s = 2 * R;
    for (const p of [
      { x: L, y: R },
      { x: L + s, y: R },
      { x: L + s, y: -R },
      { x: L, y: -R },
      { x: L, y: 0 },
    ])
      path.push(p);
    // Benchwork: the lead + the square, one padded rectangle.
    const outline = [
      { x: 0, y: hw },
      { x: L + s + hw, y: hw },
      { x: L + s + hw, y: -R - hw },
      { x: 0, y: -R - hw },
    ];
    return { path: rd(path), outline: rd(outline), throat: T };
  }

  // teardrop / circle / offset-teardrop: a circle whose centre sits ahead of the
  // throat; the loop is the MAJOR (far) arc between the two tangent points, so
  // the two throat legs meet at a point (the teardrop). A near centre → round
  // (circle); a far centre → a narrow point (teardrop).
  // throat → circle-centre. Near R → the throat sits just off the circle: a
  // full round loop (circle) or a teardrop with short converging legs at the
  // point and a dominant bulb. Far → a stretched, narrow teardrop (avoid).
  const D = shape === "circle" ? R * 1.05 : R * 1.25;
  const offY = shape === "offset-teardrop" ? R * 0.8 : 0;
  const C = { x: L + D, y: offY };
  const dist = Math.hypot(C.x - T.x, C.y - T.y) || R;
  const ac = Math.acos(Math.min(1, R / dist)); // half-angle of the tangent legs
  const base = Math.atan2(T.y - C.y, T.x - C.x); // C → T direction
  const a1 = base + ac;
  const a2 = base - ac;
  path.push({ x: C.x + R * Math.cos(a1), y: C.y + R * Math.sin(a1) }); // leg → P1
  const steps = 60;
  for (let i = 1; i <= steps; i++) {
    const a = a1 + (a2 + 2 * Math.PI - a1) * (i / steps); // MAJOR (far) arc
    path.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) });
  }
  path.push({ x: T.x, y: T.y }); // leg P2 → throat

  // Benchwork = the lead rectangle merged smoothly into the bulb circle (outer
  // radius R + halfwidth): the lead's top/bottom edges run east until they meet
  // the circle, then the major arc closes the bulb — a smooth teardrop, no band
  // lumps or throat notch.
  const Ro = R + hw;
  const xTop = C.x - Math.sqrt(Math.max(0, Ro * Ro - (hw - C.y) ** 2));
  const xBot = C.x - Math.sqrt(Math.max(0, Ro * Ro - (-hw - C.y) ** 2));
  const thTop = Math.atan2(hw - C.y, xTop - C.x);
  const thBot = Math.atan2(-hw - C.y, xBot - C.x);
  const outline: Pt[] = [
    { x: 0, y: hw },
    { x: xTop, y: hw },
  ];
  for (let i = 1; i <= steps; i++) {
    const a = thTop + (thBot - 2 * Math.PI - thTop) * (i / steps); // top → far → bottom
    outline.push({ x: C.x + Ro * Math.cos(a), y: C.y + Ro * Math.sin(a) });
  }
  outline.push({ x: xBot, y: -hw }, { x: 0, y: -hw });
  return { path: rd(path), outline: rd(outline), throat: T };
}

/**
 * The physical path of a track that runs from `fromPos` to `toPos` inches along
 * the mainline, offset to its lane — i.e. a siding/spur drawn on the real board,
 * following the module's curvature.
 */
export function lanePath(
  center: Pt[],
  fromPos: number,
  toPos: number,
  lane: number,
  steps = 24,
): Pt[] {
  if (center.length < 2) return [];
  const off = laneOffset(lane);
  const a = Math.min(fromPos, toPos);
  const b = Math.max(fromPos, toPos);
  if (b - a < 0.01) return [];
  const out: Pt[] = [];
  for (let s = 0; s <= steps; s++) {
    const p = sampleAt(center, a + ((b - a) * s) / steps);
    out.push({ x: p.x + p.nx * off, y: p.y + p.ny * off });
  }
  return out;
}

/**
 * Snap a point to the module's benchwork perimeter and return where an endplate
 * placed there sits: the nearest point on the outline boundary + the edge's
 * OUTWARD-normal heading (degrees, 0 = +x east). This is how a placed 3rd
 * endplate lands on a fascia — the owner drags it and it clings to the board
 * edge, facing out. Returns null when there's no real outline yet.
 */
export function snapPoseToOutline(
  outline: Pt[],
  p: Pt,
): { x: number; y: number; heading: number } | null {
  if (!outline || outline.length < 2) return null;
  let cx = 0;
  let cy = 0;
  for (const v of outline) {
    cx += v.x;
    cy += v.y;
  }
  cx /= outline.length;
  cy /= outline.length;
  let best: { x: number; y: number; d: number; heading: number } | null = null;
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + dx * t;
    const qy = a.y + dy * t;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (!best || d < best.d) {
      // Edge normal, flipped to point away from the polygon centroid (outward).
      let nx = -dy;
      let ny = dx;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      if ((qx - cx) * nx + (qy - cy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      best = { x: qx, y: qy, d, heading: (Math.atan2(ny, nx) * 180) / Math.PI };
    }
  }
  if (!best) return null;
  return { x: best.x, y: best.y, heading: ((best.heading % 360) + 360) % 360 };
}

export interface PhysTrack {
  id: string;
  pts: Pt[];
  role: "main" | "siding" | "spur" | "crossover" | "branch";
}
export interface PhysTurnout {
  id: string;
  x: number;
  y: number;
}
/** A drawn endplate face (the standardized interface) as a segment, for the ends
 * moduleFootprint doesn't emit — i.e. the placed branch endplates C, D…. */
export interface PhysFace {
  id: string;
  p1: Pt;
  p2: Pt;
}

/**
 * The full track plan of a module, laid on its real (to-scale, curve-following)
 * centre-line — every main, siding and spur plus turnout nodes, in module-local
 * inches. This is the physical counterpart of the straightened operations
 * preview (SchematicPreview): it consumes the SAME `moduleFeatures` extraction
 * so the two views can't disagree, then maps each feature's (fraction-along,
 * lane) onto the centre-line so a double-track, a single↔double transition, a
 * passing siding or a spur all draw as the actual board shows them — not just
 * the lone spine the footprint used to render (#131 / physical-double-track).
 */
export function physicalSchematic(
  center: Pt[],
  doc: ModuleSchematicDoc,
): { tracks: PhysTrack[]; turnouts: PhysTurnout[]; faces: PhysFace[] } {
  if (center.length < 2) return { tracks: [], turnouts: [], faces: [] };
  const f = moduleFeatures(doc);
  const len = centerlineLength(center) || 1;
  const c01 = (v: number) => Math.max(0, Math.min(1, v));
  /** A point at (fraction along the main, lane offset). */
  const P = (frac: number, lane: number): Pt => {
    const s = sampleAt(center, c01(frac) * len);
    const o = laneOffset(lane);
    return { x: s.x + s.nx * o, y: s.y + s.ny * o };
  };
  /** A body between two fractions at a lane, order-preserving (follows curves). */
  const body = (f0: number, f1: number, lane: number, steps = 24): Pt[] => {
    const a = c01(f0) * len;
    const b = c01(f1) * len;
    const o = laneOffset(lane);
    const out: Pt[] = [];
    for (let s = 0; s <= steps; s++) {
      const p = sampleAt(center, a + ((b - a) * s) / steps);
      out.push({ x: p.x + p.nx * o, y: p.y + p.ny * o });
    }
    return out;
  };
  // A turnout body spans a few track-spacings along the main; as a fraction it
  // sets the diverge diagonal's run and each siding/spur's throat taper.
  const gapFrac = Math.min(0.06, (LANE_SPACING_INCHES * 4) / len);
  const tracks: PhysTrack[] = [];

  // --- Mains: through/branch of a transition, a partial Main 2, a full double,
  //     or just the single spine — mirroring SchematicPreview's cases. --------
  if (f.transition) {
    const { throughLane, branchLane, atFrac, doubleSide } = f.transition;
    const west = doubleSide === "west";
    tracks.push({ id: "main1", pts: body(0, 1, throughLane), role: "main" });
    tracks.push({
      id: "main2",
      pts: west
        ? body(0, atFrac - gapFrac, branchLane)
        : body(atFrac + gapFrac, 1, branchLane),
      role: "main",
    });
    tracks.push({
      id: "main2-diverge",
      pts: [P(west ? atFrac - gapFrac : atFrac + gapFrac, branchLane), P(atFrac, throughLane)],
      role: "main",
    });
  } else {
    tracks.push({ id: "main1", pts: body(0, 1, 0), role: "main" });
    if (f.main2Extent) {
      const { fromFrac, toFrac } = f.main2Extent;
      tracks.push({ id: "main2", pts: body(fromFrac, toFrac, 1), role: "main" });
      if (fromFrac > 0)
        tracks.push({ id: "main2-w", pts: [P(fromFrac - gapFrac, 0), P(fromFrac, 1)], role: "main" });
      if (toFrac < 1)
        tracks.push({ id: "main2-e", pts: [P(toFrac, 1), P(toFrac + gapFrac, 0)], role: "main" });
    } else if (f.doubleMain && !f.loop) {
      tracks.push({ id: "main2", pts: body(0, 1, 1), role: "main" });
    }
  }

  // --- Sidings & spurs — a body on their lane, dipping to the main they
  //     diverge from at each turnout end (a spur dips once, a siding twice). ---
  const divergesTo = (id: string) => (doc.turnouts ?? []).some((sw) => sw.divergeTrack === id);
  const onTrackHas = (id: string) => (doc.turnouts ?? []).some((sw) => sw.onTrack === id);
  for (const t of f.extraTracks) {
    const isSpur = t.role === "spur";
    // A track that turnouts sit ON but nothing switches INTO (a crossover leg)
    // stays flat — its connection is the crossover diagonal, not an end dip.
    const flat = !isSpur && !divergesTo(t.id) && onTrackHas(t.id);
    const tx = isSpur ? t.throatFrac : t.fromFrac;
    const ex = isSpur ? t.stubFrac : t.toFrac;
    const spanFrac = Math.abs(ex - tx);
    const thr = Math.min(spanFrac * 0.12 + gapFrac, isSpur ? spanFrac : spanFrac / 2);
    const dir = ex >= tx ? 1 : -1;
    const pts = flat
      ? body(tx, ex, t.lane)
      : isSpur
        ? [P(tx, t.divergesFromLane), ...body(tx + dir * thr, ex, t.lane)]
        : [
            P(tx, t.divergesFromLane),
            ...body(tx + dir * thr, ex - dir * thr, t.lane),
            P(ex, t.divergesFromLane),
          ];
    tracks.push({ id: t.id, pts, role: isSpur ? "spur" : "siding" });
  }

  // --- Crossovers — a straight diagonal joining the two mains. --------------
  for (const x of f.crossovers)
    tracks.push({
      id: x.id,
      pts: [P(x.fromPosFrac, x.fromLane), P(x.toPosFrac, x.toLane)],
      role: "crossover",
    });

  const turnouts: PhysTurnout[] = f.turnouts.map((t) => {
    const p = P(t.posFrac, t.onLane);
    return { id: t.id, x: p.x, y: p.y };
  });

  // --- Branch routes to placed endplates (#170) — an authored 2-D path that
  //     leaves the main, so it's read straight off the doc, not the (frac,lane)
  //     model that can't express a 90° exit. -------------------------------
  for (const t of doc.tracks ?? []) {
    if (t.role !== "branch" || !t.path || t.path.length < 2) continue;
    const pts = samplePath(t.path);
    if (pts.length >= 2) tracks.push({ id: t.id, pts, role: "branch" });
  }

  // --- Placed branch-endplate faces (C, D…) — moduleFootprint only emits the
  //     axial A/B faces, so draw these from the endplate's placed pose. -----
  const DEG = Math.PI / 180;
  const faces: PhysFace[] = [];
  for (const e of doc.endplates ?? []) {
    if (e.id === "A" || e.id === "B") continue;
    const pose = e.pose;
    if (!pose) continue;
    const hw = (typeof e.widthInches === "number" && e.widthInches > 0 ? e.widthInches : 24) / 2;
    // Face runs perpendicular to the outward normal (heading).
    const fx = Math.cos((pose.heading + 90) * DEG);
    const fy = Math.sin((pose.heading + 90) * DEG);
    faces.push({
      id: e.id,
      p1: { x: pose.x - fx * hw, y: pose.y - fy * hw },
      p2: { x: pose.x + fx * hw, y: pose.y + fy * hw },
    });
  }

  return { tracks, turnouts, faces };
}
