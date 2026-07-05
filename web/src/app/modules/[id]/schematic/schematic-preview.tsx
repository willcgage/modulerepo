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
  const feet = Math.round((doc.lengthInches / 12) * 10) / 10;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>Operations preview (West → East)</span>
        <span>
          {doc.lengthInches}&Prime; · {feet} ft
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

        {/* Sidings / spurs */}
        {f.extraTracks.map((t) => (
          <line
            key={t.id}
            x1={px(t.fromFrac)}
            y1={laneY(t.lane)}
            x2={px(t.toFrac)}
            y2={laneY(t.lane)}
            stroke="#64748b"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeDasharray={t.role === "spur" ? "3 2" : undefined}
          >
            <title>{t.role}</title>
          </line>
        ))}

        {/* Turnouts — diverging connector */}
        {f.turnouts.map((t) => {
          const dir = t.posFrac < 0.5 ? 1 : -1;
          return (
            <line
              key={t.id}
              x1={px(t.posFrac) - dir * 10}
              y1={laneY(t.onLane)}
              x2={px(t.posFrac)}
              y2={laneY(t.divergeLane)}
              stroke="#64748b"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <title>{t.name || "Turnout"}</title>
            </line>
          );
        })}

        {/* Signals — drawn parallel to the track, pointing in the facing
            direction, so two at the same spot (opposite ways) don't stack. */}
        {f.signals.map((s) => {
          const sx = px(s.posFrac);
          const sy = laneY(s.lane) - 4;
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
