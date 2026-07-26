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
  // Branch routes carry their own lane in those extents (#181), so there's no
  // spare-lane headroom to add here.
  const laneTop = Math.max(f.laneMax, f.doubleMain ? 1 : 0);
  const laneBot = Math.min(f.laneMin, 0);
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
        {/* Only label the far end if there IS one. An end of the line or a
            pocket presents a single face and the track just stops, so a "B"
            there would announce a plate the module hasn't got (#184/#191). */}
        {!f.loop && f.hasEndplateB && (
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
          // Diverge at 45° — run out equals the drop between lanes (Steve, #173).
          // A dispatcher panel draws every diverging route at one fixed angle;
          // the old span-proportional taper meant a long siding got a shallow
          // diagonal and a short one a steep one, so nothing lined up. 45° also
          // matches the single↔double transition, which already used G = LANE_GAP.
          // A multi-lane diverge gets a proportionally longer run, staying 45°.
          // STILL CLAMPED: a spur has ONE dip so it may use the whole span; a
          // siding dips at EACH end, so its run can be at most half — otherwise
          // the two overshoot, the flat between them reverses, and the track
          // draws as a crossed tepee (a 17″ siding on a 384″ module hit exactly
          // that). A track too short for 45° draws steeper rather than inverting.
          const span = Math.abs(ex - tx);
          const drop = Math.abs(yl - ym) || LANE_GAP;
          const thr = Math.min(drop, isSpur ? span : span / 2);
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

        {/* Routes to a third endplate. An endplate is an endplate whatever
            letter it carries (#183), so this is drawn the way A and B are: it
            diverges from its host main at 45°, runs to the EDGE of the module,
            and terminates in an endplate face carrying its letter.
            It sits a clear lane's gap beyond everything else — running the full
            width, it would otherwise read as one more parallel main, which is
            precisely the confusion a dispatcher must not have.
            The LETTER is the module's own fact. The DESTINATION is not: which
            railroad lies beyond that plate depends on what's physically attached,
            so Free-Dispatcher derives that at runtime. */}
        {f.branchConnectors.map((b) => {
          const x0 = px(b.posFrac);
          const xe = px(b.endFrac);
          const y0 = laneY(b.fromLane); // a branch need not leave Main 1
          const yl = laneY(b.lane);
          const dir = xe >= x0 ? 1 : -1;
          // 45°, and never longer than the run itself (#173).
          const thr = Math.min(Math.abs(yl - y0), Math.abs(xe - x0));
          const isMain = b.kind === "main";
          const tick = 5; // the endplate face it ends at
          return (
            <g key={b.id}>
              <polyline
                points={`${x0},${y0} ${x0 + dir * thr},${yl} ${xe},${yl}`}
                fill="none"
                stroke={hi(b.trackId) ? HL : isMain ? "#2563eb" : "#64748b"}
                strokeWidth={hi(b.trackId) ? 3 : isMain ? 2.4 : 1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <line
                x1={xe}
                y1={yl - tick}
                x2={xe}
                y2={yl + tick}
                stroke="#94a3b8"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
              {/* Its letter, drawn like A and B are at their ends. */}
              <text
                x={dir > 0 ? xe - 3 : xe + 3}
                y={yl - tick - 3}
                fontSize="7"
                fill="#94a3b8"
                textAnchor={dir > 0 ? "end" : "start"}
              >
                {b.id}
              </text>
              <title>
                {`${b.name || (isMain ? "Main" : "Branch")} — ${
                  isMain ? "a main" : "a branch"
                } leaving the module at endplate ${b.id}${
                  b.label && b.label !== b.id ? ` (${b.label})` : ""
                }, ${Math.round(b.lengthInches * 10) / 10}″ on this module`}
              </title>
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
