"use client";

/**
 * Live preview of a module's operations schematic — the same straightened view
 * Free-Dispatcher renders (Main 1 continuous; a second main / sidings / spurs as
 * lanes; turnouts diverge; signal masts). Pure render from the doc.
 */
import { moduleFeatures, type ModuleSchematicDoc } from "@/lib/module-schematic";

const LANE_GAP = 12;
const PAD = 10;

export function SchematicPreview({ doc }: { doc: ModuleSchematicDoc }) {
  const f = moduleFeatures(doc);
  const W = 300; // logical width; positions are fractions of it
  const px = (frac: number) => PAD + frac * (W - 2 * PAD);
  const lengthInches = doc.lengthInches ?? 0;
  const feet = Math.round((lengthInches / 12) * 10) / 10;
  // Vertical space follows the lane extents — negative lanes (a track outside
  // Main 1) grow the canvas downward, extra lanes upward (modulerepo#14).
  // Branch connectors (#170) need a lane of headroom on their side.
  const hasUpBranch = f.branchConnectors.some((b) => b.side === "up");
  const hasDownBranch = f.branchConnectors.some((b) => b.side === "down");
  const laneTop = Math.max(f.laneMax, f.doubleMain ? 1 : 0) + (hasUpBranch ? 1 : 0);
  const laneBot = Math.min(f.laneMin, 0) - (hasDownBranch ? 1 : 0);
  const Y0 = 14 + laneTop * LANE_GAP; // Main 1; higher lanes stack upward
  const HEIGHT = Y0 - laneBot * LANE_GAP + 14;
  const laneY = (lane: number) => Y0 - lane * LANE_GAP;

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
        height={HEIGHT * 2}
        preserveAspectRatio="xMidYMid meet"
        className="rounded bg-white"
      >
        <text x={2} y={laneY(0) - LANE_GAP / 2} fontSize="7" fill="#94a3b8" dominantBaseline="middle">
          {f.loop ? "Entry" : "W"}
        </text>
        {!f.loop && (
          <text x={W - 2} y={laneY(0) - LANE_GAP / 2} fontSize="7" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
            E
          </text>
        )}

        {/* Main 1 — continuous; a loop turns back at a terminal bulb, or a
            Main 2 return joins the two lanes in a U (transit idiom). */}
        <line
          x1={px(0)}
          y1={laneY(0)}
          x2={f.loop && f.loopReturn !== "main2" ? px(1) - 7 : px(1)}
          y2={laneY(0)}
          stroke="#2563eb"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        {f.loop && f.loopReturn === "main2" && (
          <>
            {/* Main 2 runs the lead too; the balloon is the U between them */}
            <line x1={px(0)} y1={laneY(1)} x2={px(1)} y2={laneY(1)} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
            <path
              d={`M ${px(1)} ${laneY(0)} A ${(laneY(0) - laneY(1)) / 2} ${(laneY(0) - laneY(1)) / 2} 0 0 0 ${px(1)} ${laneY(1)}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              <title>Directional return — out on Main 1, back on Main 2</title>
            </path>
            {/* direction arrow on the U */}
            <polygon
              points={`${px(1) + (laneY(0) - laneY(1)) / 2 - 1},${(laneY(0) + laneY(1)) / 2 - 3} ${px(1) + (laneY(0) - laneY(1)) / 2 - 1},${(laneY(0) + laneY(1)) / 2 + 3} ${px(1) + (laneY(0) - laneY(1)) / 2 + 3},${(laneY(0) + laneY(1)) / 2}`}
              fill="#2563eb"
            />
          </>
        )}
        {f.loop && f.loopReturn !== "main2" && (
          <>
            <circle
              cx={px(1) - 4}
              cy={laneY(0)}
              r={4.5}
              fill="none"
              stroke="#2563eb"
              strokeWidth={1.6}
            >
              <title>
                {f.loopInterchange
                  ? "Balloon loop with interchange — a second route connects here"
                  : "Balloon loop — trains turn back"}
              </title>
            </circle>
            {/* circulation arrow on the bulb */}
            <polygon
              points={`${px(1) - 4 - 3},${laneY(0) - 4.5 - 2} ${px(1) - 4 + 3},${laneY(0) - 4.5 - 2} ${px(1) - 4},${laneY(0) - 4.5 + 2.5}`}
              fill="#2563eb"
              transform={`rotate(180 ${px(1) - 4} ${laneY(0) - 4.5})`}
            />
            {/* A standard endplate B on the balloon = interchange branch */}
            {f.loopInterchange && (
              <>
                <line
                  x1={px(1) - 4}
                  y1={laneY(0) - 4.5}
                  x2={px(1) - 4}
                  y2={laneY(0) - 13}
                  stroke="#2563eb"
                  strokeWidth={1.6}
                />
                <line
                  x1={px(1) - 8}
                  y1={laneY(0) - 13}
                  x2={px(1)}
                  y2={laneY(0) - 13}
                  stroke="#94a3b8"
                  strokeWidth={1.4}
                >
                  <title>Interchange endplate (B)</title>
                </line>
              </>
            )}
          </>
        )}
        {/* Main 2 — full length when both ends are double; on a transition
            module it runs between the mainline turnout and the double end,
            with a diverge diagonal at the transition. */}
        {f.doubleMain && !f.loop && !f.main2Extent && (
          <line x1={px(0)} y1={laneY(1)} x2={px(1)} y2={laneY(1)} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
        )}
        {f.main2Extent && !f.loop && (
          <>
            <line
              x1={px(f.main2Extent.fromFrac)}
              y1={laneY(1)}
              x2={px(f.main2Extent.toFrac)}
              y2={laneY(1)}
              stroke="#2563eb"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            {/* diverge from Main 1 at the transition end */}
            <line
              x1={px(f.main2Extent.fromFrac > 0 ? f.main2Extent.fromFrac : f.main2Extent.toFrac) + (f.main2Extent.fromFrac > 0 ? -10 : 10)}
              y1={laneY(0)}
              x2={px(f.main2Extent.fromFrac > 0 ? f.main2Extent.fromFrac : f.main2Extent.toFrac)}
              y2={laneY(1)}
              stroke="#2563eb"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <title>Single↔double transition</title>
            </line>
          </>
        )}

        {/* Sidings (passing loops, dipping to the main at each turnout) and
            spurs (rise + stub). */}
        {f.extraTracks.map((t) => {
          const yl = laneY(t.lane);
          // Diverge from the main the track's turnout sits on — a team track
          // off Main 2 starts at lane 1, not as a crossover from Main 1.
          const ym = laneY(t.divergesFromLane);
          const isSpur = t.role === "spur";
          // A spur's throat is at its turnout (either end, #bug3); the stub runs
          // to the far end. A siding dips to the main at both ends.
          const tx = px(isSpur ? t.throatFrac : t.fromFrac);
          const ex = px(isSpur ? t.stubFrac : t.toFrac);
          const dir = ex >= tx ? 1 : -1;
          const thr = Math.min(Math.abs(ex - tx) * 0.3 + 6, Math.abs(ex - tx));
          const pts = isSpur
            ? `${tx},${ym} ${tx + dir * thr},${yl} ${ex},${yl}`
            : `${tx},${ym} ${tx + thr},${yl} ${ex - thr},${yl} ${ex},${ym}`;
          return (
            <polyline
              key={t.id}
              points={pts}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={isSpur ? "3 2" : undefined}
            >
              <title>{t.role}</title>
            </polyline>
          );
        })}

        {/* Crossovers — a straight diagonal joining the two mains (#bug2) */}
        {f.crossovers.map((x) => (
          <line
            key={x.id}
            x1={px(x.fromPosFrac)}
            y1={laneY(x.fromLane)}
            x2={px(x.toPosFrac)}
            y2={laneY(x.toLane)}
            stroke="#64748b"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            <title>{x.name || "Crossover"}</title>
          </line>
        ))}

        {/* Turnout markers on the main */}
        {f.turnouts.map((t) => (
          <circle key={t.id} cx={px(t.posFrac)} cy={laneY(t.onLane)} r={2} fill="#64748b">
            <title>{t.name || "Turnout"}</title>
          </circle>
        ))}

        {/* Crossings (diamonds) — an X spanning the two lanes (#170) */}
        {f.crossings.map((x) => {
          const cx = px(x.posFrac);
          const yA = laneY(x.laneA);
          const yB = laneY(x.laneB);
          const cy = (yA + yB) / 2;
          const h = Math.max(Math.abs(yA - yB) / 2, 4);
          return (
            <g key={x.id} stroke="#dc2626" strokeWidth={1.6} strokeLinecap="round">
              <line x1={cx - 4} y1={cy - h} x2={cx + 4} y2={cy + h} />
              <line x1={cx - 4} y1={cy + h} x2={cx + 4} y2={cy - h} />
              <title>{`Crossing${x.name ? ` · ${x.name}` : ""}`}</title>
            </g>
          );
        })}

        {/* Branch endplates — named connector arrows off the module (#170) */}
        {f.branchConnectors.map((b) => {
          const bx = px(b.posFrac);
          const dir = b.side === "down" ? 1 : -1;
          const y0 = laneY(0);
          const yTip = y0 + dir * (LANE_GAP + 2);
          return (
            <g key={b.id}>
              <line x1={bx} y1={y0} x2={bx + 8 * 0.6} y2={yTip} stroke="#2563eb" strokeWidth={1.8} strokeLinecap="round" />
              <polygon
                points={`${bx + 4.8 - 3},${yTip} ${bx + 4.8 + 3},${yTip} ${bx + 4.8},${yTip + dir * 4}`}
                fill="#2563eb"
              />
              <text
                x={bx + 8}
                y={yTip + dir * 6}
                fontSize="6"
                fill="#64748b"
                dominantBaseline={b.side === "down" ? "hanging" : "auto"}
              >
                {`to ${b.label}`}
              </text>
              <title>{`Branch endplate — to ${b.label}`}</title>
            </g>
          );
        })}

        {/* Signals — drawn parallel to the track, pointing in the facing
            direction, so two at the same spot (opposite ways) don't stack. */}
        {f.signals.map((s) => {
          const sx = px(s.posFrac);
          // Fan stacked signals (several at one interlocking) off the track.
          const off = 4 + s.stack * 4;
          const sy = s.side === "below" ? laneY(s.lane) + off : laneY(s.lane) - off;
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
