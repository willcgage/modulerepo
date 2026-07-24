"use client";

/**
 * Live preview of a module's operations schematic — the same straightened view
 * Free-Dispatcher renders (Main 1 continuous; a second main / sidings / spurs as
 * lanes; turnouts diverge; signal masts). Pure render from the doc.
 */
import { moduleFeatures, type ModuleSchematicDoc } from "@/lib/module-schematic";

const LANE_GAP = 12;
const PAD = 10;

export function SchematicPreview({
  doc,
  highlightId = null,
}: {
  doc: ModuleSchematicDoc;
  /** Feature id selected on the physical canvas — drawn emphasised here, so the
   * physical ↔ dispatcher mapping is visible (#linked-selection). */
  highlightId?: string | null;
}) {
  const f = moduleFeatures(doc);
  const hi = (id: string) => highlightId != null && id === highlightId;
  const HL = "#0284c7"; // highlight stroke/fill
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

  // Ends are labelled A and B, not W and E. A module has no compass direction
  // of its own — the same board can be installed either way round, or on
  // either axis, so a compass letter here could only contradict the layout
  // that placed it. Free-Dispatcher owns direction.
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>Operations preview (A → B)</span>
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
          {f.loop ? "Entry" : "A"}
        </text>
        {!f.loop && (
          <text x={W - 2} y={laneY(0) - LANE_GAP / 2} fontSize="7" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
            B
          </text>
        )}

        {/* Single↔double transition: the through main (whichever the turnout
            sits on) runs full length; the branch main exists only on the double
            side and merges at the junction (#FMN-0043). */}
        {f.transition &&
          (() => {
            const t = f.transition;
            const thY = laneY(t.throughLane);
            const brY = laneY(t.branchLane);
            const jx = px(t.atFrac);
            const west = t.doubleSide === "west";
            const G = 12;
            return (
              <>
                <line x1={px(0)} y1={thY} x2={px(1)} y2={thY} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
                <line
                  x1={west ? px(0) : jx + G}
                  y1={brY}
                  x2={west ? jx - G : px(1)}
                  y2={brY}
                  stroke="#2563eb"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                <line x1={west ? jx - G : jx + G} y1={brY} x2={jx} y2={thY} stroke="#2563eb" strokeWidth={2}>
                  <title>Single↔double transition</title>
                </line>
              </>
            );
          })()}

        {/* Main 1 — continuous; a loop turns back at a terminal bulb, or a
            Main 2 return joins the two lanes in a U (transit idiom). */}
        {!f.transition && (
          <line
            x1={px(0)}
            y1={laneY(0)}
            x2={f.loop && f.loopReturn !== "main2" ? px(1) - 7 : px(1)}
            y2={laneY(0)}
            stroke="#2563eb"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )}
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
        {f.doubleMain && !f.loop && !f.main2Extent && !f.transition && (
          <line x1={px(0)} y1={laneY(f.main2Lane ?? 1)} x2={px(1)} y2={laneY(f.main2Lane ?? 1)} stroke="#2563eb" strokeWidth={2.4} strokeLinecap="round" />
        )}
        {f.main2Extent && !f.loop && !f.transition && (
          <>
            <line
              x1={px(f.main2Extent.fromFrac)}
              y1={laneY(f.main2Lane ?? 1)}
              x2={px(f.main2Extent.toFrac)}
              y2={laneY(f.main2Lane ?? 1)}
              stroke="#2563eb"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            {/* A diverge at EACH bounded end. A module that's single at both
                ends and double in the middle — the ordinary passing siding —
                transitions twice, and drawing only one left the other end of
                Main 2 hanging in mid-air (#118). An end that runs to its
                endplate is not a transition and gets nothing. */}
            {f.main2Extent.fromFrac > 0 && (
              <line
                x1={px(f.main2Extent.fromFrac) - 10}
                y1={laneY(0)}
                x2={px(f.main2Extent.fromFrac)}
                y2={laneY(f.main2Lane ?? 1)}
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <title>Single↔double transition (west)</title>
              </line>
            )}
            {f.main2Extent.toFrac < 1 && (
              <line
                x1={px(f.main2Extent.toFrac)}
                y1={laneY(f.main2Lane ?? 1)}
                x2={px(f.main2Extent.toFrac) + 10}
                y2={laneY(0)}
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <title>Single↔double transition (east)</title>
              </line>
            )}
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
          // to the far end. A siding dips to the main at both ends — UNLESS
          // nothing switches into it (no turnout diverges to it) while turnouts
          // sit ON it: then its connection is elsewhere (a crossover's diagonal),
          // so it draws flat with square ends instead of spurious end-dips.
          const flat =
            !isSpur &&
            !(doc.turnouts ?? []).some((sw) => sw.divergeTrack === t.id) &&
            (doc.turnouts ?? []).some((sw) => sw.onTrack === t.id);
          const tx = px(isSpur ? t.throatFrac : t.fromFrac);
          const ex = px(isSpur ? t.stubFrac : t.toFrac);
          const throat = (doc.turnouts ?? []).find((sw) => sw.divergeTrack === t.id);
          // A flipped turnout faces its points the other way, so its throat
          // taper leaves in the opposite direction (#turnout-flip).
          const dir = (ex >= tx ? 1 : -1) * (throat?.flipped ? -1 : 1);
          // Keep the throat short (orig 0.12): on a ladder, turnouts sit ON a
          // siding/spur, and a long taper would push its flat part past them so
          // their dots float off the diagonal.
          // A spur has ONE dip so it may use the whole span; a siding has one at
          // EACH end, so its taper can be at most half — otherwise the two dips
          // overshoot each other, the flat run between them reverses, and the
          // track draws as a crossed tepee instead of a siding. A 17″ siding on
          // a 384″ module hit exactly that.
          const span = Math.abs(ex - tx);
          const thr = Math.min(span * 0.12 + 6, isSpur ? span : span / 2);
          const pts = flat
            ? `${tx},${yl} ${ex},${yl}`
            : isSpur
              ? `${tx},${ym} ${tx + dir * thr},${yl} ${ex},${yl}`
              : // `dir` here too, so a siding stored east-to-west doesn't invert.
                `${tx},${ym} ${tx + dir * thr},${yl} ${ex - dir * thr},${yl} ${ex},${ym}`;
          return (
            <polyline
              key={t.id}
              points={pts}
              fill="none"
              stroke={hi(t.id) ? HL : "#64748b"}
              strokeWidth={hi(t.id) ? 3 : 1.8}
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
          <circle
            key={t.id}
            cx={px(t.posFrac)}
            cy={laneY(t.onLane)}
            r={hi(t.id) ? 3.2 : 2}
            fill={hi(t.id) ? HL : "#64748b"}
          >
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

        {/* Branch endplates — the diverging track leaves the main at its turnout
            and runs to the MODULE EDGE, drawn with an endplate tick. No "to X"
            label here: Free-Dispatcher adds destination labels for the panel; the
            schematic just shows a track exiting the module (#170). */}
        {f.branchConnectors.map((b) => {
          const bx = px(b.posFrac);
          const dir = b.side === "down" ? 1 : -1;
          const y0 = laneY(0);
          const yEdge = y0 + dir * (LANE_GAP + 2); // out to the module edge
          const xEdge = bx + 6; // lean toward B so it reads as a diverge, not a crossing
          const tick = 5; // the endplate face at the module edge
          return (
            <g key={b.id}>
              <line x1={bx} y1={y0} x2={xEdge} y2={yEdge} stroke="#2563eb" strokeWidth={2.2} strokeLinecap="round" />
              <line
                x1={xEdge - tick}
                y1={yEdge}
                x2={xEdge + tick}
                y2={yEdge}
                stroke="#2563eb"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
              <title>{`Branch to the module edge${b.label ? ` — ${b.label}` : ""}`}</title>
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
