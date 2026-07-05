"use client";

/**
 * Live preview of a module's operations schematic — the same straightened view
 * Free-Dispatcher renders (Main 1 continuous; a second main / sidings / spurs as
 * lanes; turnouts diverge; signal masts). Pure render from the doc.
 */
import { moduleFeatures, type ModuleSchematicDoc } from "@/lib/module-schematic";

const LANE_GAP = 12;
const PAD = 10;
const Y0 = 46; // Main 1 (lower); higher lanes stack upward
const HEIGHT = 60;
const laneY = (lane: number) => Y0 - lane * LANE_GAP;

export function SchematicPreview({ doc }: { doc: ModuleSchematicDoc }) {
  const f = moduleFeatures(doc);
  const W = 300; // logical width; positions are fractions of it
  const px = (frac: number) => PAD + frac * (W - 2 * PAD);
  const lengthInches = doc.lengthInches ?? 0;
  const feet = Math.round((lengthInches / 12) * 10) / 10;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>Operations preview (West → East)</span>
        <span>
          {lengthInches}&Prime; · {feet} ft
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${HEIGHT}`}
        width="100%"
        height="120"
        preserveAspectRatio="xMidYMid meet"
        className="rounded bg-white"
      >
        <text x={2} y={laneY(0) - LANE_GAP / 2} fontSize="7" fill="#94a3b8" dominantBaseline="middle">
          W
        </text>
        <text x={W - 2} y={laneY(0) - LANE_GAP / 2} fontSize="7" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
          E
        </text>

        {/* Main 1 — continuous */}
        <line x1={px(0)} y1={laneY(0)} x2={px(1)} y2={laneY(0)} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
        {/* Main 2 — full length when double */}
        {f.doubleMain && (
          <line x1={px(0)} y1={laneY(1)} x2={px(1)} y2={laneY(1)} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
        )}

        {/* Sidings (passing loops, dipping to the main at each turnout) and
            spurs (rise + stub). */}
        {f.extraTracks.map((t) => {
          const x1 = px(t.fromFrac);
          const x2 = px(t.toFrac);
          const yl = laneY(t.lane);
          const ym = laneY(0);
          const thr = (x2 - x1) * 0.12 + 6;
          const pts =
            t.role === "spur"
              ? `${x1},${ym} ${x1 + thr},${yl} ${x2},${yl}`
              : `${x1},${ym} ${x1 + thr},${yl} ${x2 - thr},${yl} ${x2},${ym}`;
          return (
            <polyline
              key={t.id}
              points={pts}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={t.role === "spur" ? "3 2" : undefined}
            >
              <title>{t.role}</title>
            </polyline>
          );
        })}

        {/* Turnout markers on the main */}
        {f.turnouts.map((t) => (
          <circle key={t.id} cx={px(t.posFrac)} cy={laneY(t.onLane)} r={2} fill="#64748b">
            <title>{t.name || "Turnout"}</title>
          </circle>
        ))}

        {/* Signals — drawn parallel to the track, pointing in the facing
            direction, so two at the same spot (opposite ways) don't stack. */}
        {f.signals.map((s) => {
          const sx = px(s.posFrac);
          const sy = s.side === "below" ? laneY(s.lane) + 4 : laneY(s.lane) - 4;
          const dir = s.facing === "BtoA" ? -1 : 1;
          const L = 10;
          return (
            <g key={s.id}>
              <line x1={sx} y1={sy} x2={sx + dir * L} y2={sy} stroke="#0f172a" strokeWidth={1} />
              <circle cx={sx + dir * L} cy={sy} r={2} fill="#0f172a" />
              <title>{`${s.name || "Signal"} (${s.facing})`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
