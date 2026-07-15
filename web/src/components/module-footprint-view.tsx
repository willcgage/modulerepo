import {
  moduleFootprint,
  type ModuleFootprintInput,
  type ModuleSchematicDoc,
} from "@willcgage/module-schematic";

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
  height = 160,
  className,
}: {
  input: ModuleFootprintInput;
  height?: number;
  className?: string;
}) {
  const fp = moduleFootprint(input);
  const shape = fp.outline ?? fp.band;
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

  const poly = shape.map((p) => `${p.x},${sy(p.y)}`).join(" ");
  const track = fp.centerline.map((p) => `${p.x},${sy(p.y)}`).join(" ");

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
      {/* Benchwork board */}
      <polygon
        points={poly}
        fill="#0ea5e9"
        fillOpacity={0.12}
        stroke="#0369a1"
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* Endplate faces (the standardized interface at each end) */}
      {fp.endplateFaces.map((f, i) => (
        <line
          key={i}
          x1={f.p1.x}
          y1={sy(f.p1.y)}
          x2={f.p2.x}
          y2={sy(f.p2.y)}
          stroke="#2563eb"
          strokeWidth={sw * 1.7}
          strokeLinecap="round"
        />
      ))}
      {/* Mainline track */}
      <polyline
        points={track}
        fill="none"
        stroke="#334155"
        strokeWidth={sw * 1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
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
  const len =
    (module.mainline_length_inches && module.mainline_length_inches > 0
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
  };
}
