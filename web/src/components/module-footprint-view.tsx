import {
  moduleFootprint,
  type ModuleFootprintInput,
  type ModuleSchematicDoc,
} from "@willcgage/module-schematic";
import { physicalSchematic } from "@/lib/physical-track";

/**
 * Read-only PHYSICAL module view — the actual board (benchwork outline, or the
 * derived endplate-width band), the endplate faces, and the mainline track,
 * drawn to scale in module-local inches. This is the "what it looks like"
 * counterpart to the dispatcher schematic (SchematicPreview), rendered with the
 * shared `moduleFootprint` primitive so it matches Free-Dispatcher exactly.
 * Pure/presentational — works in a server component.
 */
export function ModuleFootprintView({
  input,
  doc = null,
  height = 160,
  className,
}: {
  input: ModuleFootprintInput;
  /** The schematic doc — when given, the full track plan (both mains, sidings,
   * spurs, turnouts) is drawn to scale; without it only the mainline spine is,
   * as before. */
  doc?: ModuleSchematicDoc | null;
  height?: number;
  className?: string;
}) {
  const fp = moduleFootprint(input);
  // A module built from shaped sections IS its sections, so draw every one —
  // together they are its footprint (#96 phase 2). Otherwise the single board.
  const boards = fp.sectionOutlines.length
    ? fp.sectionOutlines.map((sec) => sec.outline)
    : [fp.outline ?? fp.band];
  const shape = boards.flat();
  if (shape.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400 ${className ?? ""}`}
        style={{ height }}
      >
        No geometry yet
      </div>
    );
  }

  const pts = [
    ...shape,
    ...fp.centerline,
    ...fp.endplateFaces.flatMap((f) => [f.p1, f.p2]),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const pad = Math.max(4, w * 0.06);
  const vb = `${minX - pad} ${-(maxY + pad)} ${w + pad * 2} ${h + pad * 2}`;
  const sy = (y: number) => -y; // module +y up → SVG y down
  const sw = Math.max(0.6, w * 0.006);

  const polys = boards.map((b) => b.map((p) => `${p.x},${sy(p.y)}`).join(" "));
  // A return loop's board is a DONUT — the outline with an inner hole punched out.
  // Draw it as one even-odd path (outer ring + hole) so the middle reads as open,
  // not a filled disc (#loop). Only when there's a single authored board.
  const ringD = (pts: { x: number; y: number }[]) =>
    "M " + pts.map((p) => `${p.x},${sy(p.y)}`).join(" L ") + " Z";
  const hole =
    fp.outlineInner && fp.outlineInner.length >= 3 && boards.length === 1
      ? fp.outlineInner
      : null;
  // The full track plan when we have the doc; otherwise just the spine, as
  // before — so a double-track / transition module no longer shows a lone line.
  const plan = doc
    ? physicalSchematic(fp.centerline, doc)
    : {
        tracks: [{ id: "main", pts: fp.centerline, role: "main" as const }],
        turnouts: [],
        faces: [],
      };
  const poly = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${sy(p.y)}`).join(" ");

  return (
    <svg
      viewBox={vb}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className={`rounded-md bg-gray-50 ${className ?? ""}`}
      role="img"
      aria-label="Physical module footprint with track"
    >
      {/* Benchwork board(s) — one polygon per section when it has them. A loop's
          board is a donut: one even-odd path with the hole cut out. */}
      {hole ? (
        <path
          d={`${ringD(boards[0])} ${ringD(hole)}`}
          fillRule="evenodd"
          fill="#0ea5e9"
          fillOpacity={0.12}
          stroke="#0369a1"
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      ) : (
        polys.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="#0ea5e9"
            fillOpacity={0.12}
            stroke="#0369a1"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        ))
      )}
      {/* Endplate faces (the standardized interface at each end) — the axial
          A/B faces from the footprint, plus any placed branch endplates (#170). */}
      {[
        ...fp.endplateFaces.map((f, i) => ({ id: `ab${i}`, p1: f.p1, p2: f.p2 })),
        ...plan.faces,
      ].map((f) => (
        <line
          key={f.id}
          x1={f.p1.x}
          y1={sy(f.p1.y)}
          x2={f.p2.x}
          y2={sy(f.p2.y)}
          stroke="#2563eb"
          strokeWidth={sw * 1.7}
          strokeLinecap="round"
        />
      ))}
      {/* The track plan — mains, sidings, spurs, crossovers — to scale */}
      {plan.tracks
        .filter((t) => t.pts.length >= 2)
        .map((t) => (
          <polyline
            key={t.id}
            points={poly(t.pts)}
            fill="none"
            stroke="#334155"
            strokeWidth={t.role === "main" ? sw * 1.4 : sw * 1.1}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={t.role === "spur" ? `${sw * 3} ${sw * 2}` : undefined}
          />
        ))}
      {/* Turnout nodes */}
      {plan.turnouts.map((t) => (
        <circle key={t.id} cx={t.x} cy={sy(t.y)} r={sw * 1.6} fill="#334155" />
      ))}
    </svg>
  );
}

/** Build the footprint input from a module record + its schematic doc. */
export function footprintInput(
  module: {
    geometry_type?: string | null;
    geometry_degrees?: number | null;
    geometry_offset_inches?: number | null;
    length_total_inches?: number | null;
    mainline_length_inches?: number | null;
  },
  doc: ModuleSchematicDoc | null,
): ModuleFootprintInput {
  const endplateWidths: Record<string, number> = {};
  for (const e of doc?.endplates ?? []) {
    const w = (e as { widthInches?: number | null }).widthInches;
    if (typeof w === "number" && w > 0) endplateWidths[e.id] = w;
  }
  // A return loop's mainline is just the LEAD (the loop is a separate track), so
  // its length lives in the doc, not the module record's stored total — using the
  // record here ran the main straight through the loop (#loop).
  const isLoop = (doc as { loop?: boolean } | null)?.loop === true;
  const len =
    (isLoop && doc?.lengthInches
      ? doc.lengthInches
      : module.mainline_length_inches && module.mainline_length_inches > 0
        ? module.mainline_length_inches
        : module.length_total_inches && module.length_total_inches > 0
          ? module.length_total_inches
          : doc?.lengthInches) || 24;
  return {
    lengthInches: len,
    geometryType: module.geometry_type,
    geometryDegrees: module.geometry_degrees,
    geometryOffsetInches: module.geometry_offset_inches,
    endplateWidths,
    outline: (doc as { outline?: ModuleSchematicDoc["outline"] } | null)?.outline ?? null,
    // The donut hole (return-loop open middle) — so the physical view punches it
    // out of the board instead of filling a solid disc (#loop).
    outlineInner:
      (doc as { outlineInner?: ModuleSchematicDoc["outline"] } | null)?.outlineInner ?? null,
    sections: (doc as { sections?: ModuleSchematicDoc["sections"] } | null)?.sections ?? null,
    // An authored mainline path (a drawn curve, or a computed return loop) wins
    // the centre-line — without it the read-only/catalog views fell back to the
    // straight geometry and never drew the loop (#loop).
    mainPath: (doc as { mainPath?: ModuleSchematicDoc["mainPath"] } | null)?.mainPath ?? null,
    // A loop's centre-line ends at the throat — drop the spurious far endplate face.
    loop: (doc as { loop?: boolean } | null)?.loop === true,
  };
}
