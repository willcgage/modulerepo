"use client";

import { Fragment, useState } from "react";
import {
  GENERIC_TURNOUT_FROG_NUMBERS,
  partsPlaceable,
  piecePartNumber,
  type TrackPart,
  type TurnoutKind,
} from "@/lib/module-schematic";
import type { PieceSpec } from "./piece-layer";

/**
 * THE ONE PARTS PALETTE (#198 step 5).
 *
 * ⭐ ONE COMPONENT, ONE IDIOM, FOR BOTH AUTHORING MODELS. Will, 2026-07-27:
 * *"it's partially dropdown menus and icons driving this, it makes it a little
 * sloppy for a UIX."* Track building used to be four pickers in three idioms —
 * a role dropdown, a frog-number `<select>`, a row of bare glyphs, and the
 * parts palette — and which ones you got depended on how the module was built.
 *
 * Everything a piece of track can BE is now one list of labelled buttons,
 * grouped by piece kind, showing the products an owner would actually buy, with
 * anything unplaceable greyed and **the reason on screen**.
 *
 * ⭐ THE FROG-NUMBER DROPDOWN IS GONE, and that is the point of the exercise.
 * Picking "Atlas #7 LH" has already said #7; a second control that could
 * disagree with the part is a contradiction you could author. Where an owner
 * genuinely doesn't know the make, the palette says so out loud — the
 * "#6 — make unknown" entries are ADR 0004's placeholder, not a hidden default.
 *
 * ⚠️ THE TWO MODES ARE NOT TWO PALETTES. They share this component, this entry
 * type and this builder. What differs is only what the underlying model can
 * accept, and that difference is REAL rather than cosmetic:
 *
 * - **graph** (ADR 0001) lays a MEASURED part, so an entry needs the geometry
 *   `partGeometry` demands, and {@link partsPlaceable} decides.
 * - **positional** (the legacy 1-D document) draws a turnout from its FROG
 *   NUMBER alone, so an entry only needs a number. Parts that can't be laid as
 *   a piece yet can still be named here — which is exactly what the turnout
 *   inspector has always allowed.
 */

/** The piece kinds the palette is grouped by — Will's own list, in his order.
 *
 * ⚠️ `slip` is NOT a `TrackPart["kind"]`. Nothing in the package models one, so
 * no part can ever land in that group; it is here because a palette that
 * silently omits slips reads as "slips are impossible" rather than "slips are
 * not built yet", and the row of glyphs it replaces did show them. */
export type PaletteKind = TrackPart["kind"] | "slip";

const KIND_ORDER: { kind: PaletteKind; label: string }[] = [
  { kind: "straight", label: "Straight" },
  { kind: "curve", label: "Curve" },
  { kind: "flex", label: "Flex" },
  { kind: "turnout", label: "Turnout" },
  { kind: "curved-turnout", label: "Curved turnout" },
  { kind: "wye", label: "Wye" },
  { kind: "crossing", label: "Crossing" },
  { kind: "crossover", label: "Crossover" },
  { kind: "slip", label: "Slip" },
  { kind: "bumper", label: "Bumper" },
];

/**
 * The frog numbers a turnout nobody has identified can be.
 *
 * ⭐ THE PACKAGE'S OWN LIST, not a fourth copy of the same six numbers. The
 * frog-number `<select>` this palette replaces had its own literal, the turnout
 * inspector has another, and the placeholder parts are generated from this one —
 * three copies that could disagree about what an owner may choose.
 */
export const FROG_NUMBERS: readonly number[] = GENERIC_TURNOUT_FROG_NUMBERS;

/** What the placeholders are filed under, in BOTH models — a provisional part
 * may never sit beside real products as though it were one of them. */
const GENERIC_GROUP = "Generic — make unknown";

/** Which authoring model the palette is serving. */
export type PaletteMode = "graph" | "positional";

/**
 * What arming an entry MEANS. One armed thing, three ways to place it — the
 * canvas dispatches on `how` instead of keeping a separate armed state per
 * picker (which is what let a stale arming from one picker hijack the other's
 * clicks).
 */
export type PaletteAction =
  /** ADR 0001: lay the part itself. */
  | { how: "piece"; spec: PieceSpec }
  /** 1-D: drop a turnout on a track. `partId` is set only when the owner named
   * a real product — a bare `#N` deliberately stays bare (see below). */
  | {
      how: "turnout";
      kind: TurnoutKind;
      curved?: boolean;
      size: number;
      partId?: string;
    }
  /** 1-D: drop a crossover assembly across the main and a parallel lane. */
  | {
      how: "crossover";
      hand?: "left" | "right";
      double?: boolean;
      size: number;
      partId?: string;
    };

export type PaletteEntry = {
  /** Stable identity — what "is this the armed one" compares. */
  key: string;
  kind: PaletteKind;
  /** The heading this entry sits under: a manufacturer + line, or "Generic". */
  group: string;
  label: string;
  title: string;
  glyph: GlyphName;
  /** Null when the entry can't be placed — {@link PaletteEntry.blocked} says why. */
  action: PaletteAction | null;
  /** Why this can't be placed, in words an owner can act on. */
  blocked?: string;
};

// ─── Building the entries ────────────────────────────────────────────────────

/** A part's name with the manufacturer stripped — the group heading says it. */
function shortName(p: TrackPart): string {
  return p.name.replace(new RegExp(`^${p.manufacturer}\\s*`, "i"), "").replace(/^Code \d+\s*/i, "");
}

const groupOf = (p: TrackPart) => (p.provisional ? GENERIC_GROUP : `${p.manufacturer} ${p.line}`);

/** How a part reads on a button. A placeholder is filed under its own heading,
 * so repeating "(make unknown)" on every button says it twice. */
const entryLabel = (p: TrackPart) => (p.provisional ? `#${p.frogNumber}` : shortName(p));

/**
 * Is this kind HANDED — is there a left-hand one and a right-hand one to own?
 *
 * ⚠️ ASKED OF THE KIND, not of `pieceHand`. `pieceHand` answers from the part
 * NUMBERS, which is right for what to order but wrong for what to offer: a
 * placeholder has no part numbers to carry, so it came back "no hand" and the
 * palette offered one button — a generic turnout that could only ever be laid
 * left-hand, while the very same "#6" on a drawn module offered both. Nothing
 * about a turnout is symmetric; a wye is, and it has no hand for that reason.
 */
const handed = (k: TrackPart["kind"]) => k === "turnout" || k === "curved-turnout";

/**
 * ADR 0004's placeholders, as they exist in the library. They are excluded from
 * the positional palette's product list because that mode offers its own
 * "make unknown" group — see {@link genericEntries}.
 */
const isPlaceholder = (p: TrackPart) => p.provisional === true;

/** Every entry, for one library and one authoring model. */
export function trackPaletteEntries(library: TrackPart[], mode: PaletteMode): PaletteEntry[] {
  return mode === "graph" ? graphEntries(library) : positionalEntries(library);
}

/** ADR 0001: what can be LAID. The library decides, and the gap list is the
 * parts backlog — shown, not hidden, so "where is my Fast Tracks #6" has an
 * answer on screen instead of in a tooltip. */
function graphEntries(library: TrackPart[]): PaletteEntry[] {
  const { placeable, blocked } = partsPlaceable(library);
  const out: PaletteEntry[] = [];
  for (const part of placeable) {
    // ⭐ A HANDED PART IS TWO THINGS YOU CAN OWN, so it is two buttons — laying
    // a right-hand turnout should not mean laying a left one and then finding a
    // "Mirrored" checkbox. A wye has no hand and stays one button.
    const specs: PieceSpec[] = handed(part.kind)
      ? [{ partId: part.id }, { partId: part.id, flipped: true }]
      : [{ partId: part.id }];
    for (const spec of specs) {
      // ⚠️ UNFLIPPED IS THE LEFT-HAND PART (the package's rule, and the library
      // is measured off the left-hand product). `pieceHand` still answers for
      // the ORDER NUMBER, which only a real product has.
      const hand: "left" | "right" | undefined = handed(part.kind)
        ? spec.flipped
          ? "right"
          : "left"
        : undefined;
      const number = piecePartNumber(part, spec.flipped);
      out.push({
        key: `piece:${part.id}${spec.flipped ? ":r" : ""}`,
        kind: part.kind,
        group: groupOf(part),
        label: `${entryLabel(part)}${hand ? (hand === "left" ? " LH" : " RH") : ""}`,
        title: `${part.name}${number ? ` (${number})` : ""} — drag onto the board, or click to arm and then click the board`,
        glyph: glyphFor(part.kind, hand),
        action: { how: "piece", spec },
      });
    }
  }
  for (const b of blocked) {
    out.push({
      key: `blocked:${b.part.id}`,
      kind: b.part.kind,
      group: groupOf(b.part),
      label: entryLabel(b.part),
      title: `${b.part.name} — ${b.why}`,
      glyph: glyphFor(b.part.kind),
      action: null,
      blocked: b.why,
    });
  }
  return out;
}

/**
 * The 1-D document: what can be DROPPED on a drawn track.
 *
 * ⛔ A LEGACY MODULE MUST NOT LOSE A SINGLE THING IT COULD DO. The pickers this
 * replaces could drop a turnout, a wye, a curved turnout and a single or double
 * crossover at any of six frog numbers, and none of that depended on a product
 * existing. So the generic group is built from {@link FROG_NUMBERS}, not from
 * the library's placeholder parts — the library has generic TURNOUTS but no
 * generic wye, curved turnout or crossover, and deriving the group from it would
 * quietly delete three kinds from every legacy module's palette.
 */
function positionalEntries(library: TrackPart[]): PaletteEntry[] {
  return [...genericEntries(), ...namedPositionalEntries(library)];
}

/** The "I don't know what it is yet" group — a frog number and nothing more. */
function genericEntries(): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  const group = GENERIC_GROUP;
  const hands: { hand: "left" | "right"; kind: TurnoutKind; suffix: string }[] = [
    { hand: "left", kind: "left", suffix: "LH" },
    { hand: "right", kind: "right", suffix: "RH" },
  ];
  for (const n of FROG_NUMBERS) {
    for (const h of hands)
      out.push({
        key: `gen:t:${n}:${h.hand}`,
        kind: "turnout",
        group,
        label: `#${n} ${h.suffix}`,
        title: `A #${n} ${h.hand}-hand turnout of no stated make — drawn from its frog number alone`,
        glyph: glyphFor("turnout", h.hand),
        // ⛔ NO `partId`, DELIBERATELY. Naming the library's placeholder part
        // here would be worse than saying nothing: `turnoutPartForSize` refuses
        // to adopt a provisional part for a bare `#N`, so a #5 with no part
        // named is drawn at Atlas's MEASURED extent, while a #5 that names the
        // placeholder has no extent at all. Same words on the button, different
        // trackwork on the board.
        action: { how: "turnout", kind: h.kind, size: n },
      });
  }
  for (const n of FROG_NUMBERS) {
    for (const h of hands)
      out.push({
        key: `gen:ct:${n}:${h.hand}`,
        kind: "curved-turnout",
        group,
        label: `#${n} ${h.suffix}`,
        title: `A #${n} ${h.hand}-hand curved turnout of no stated make — goes on curved track`,
        glyph: glyphFor("curved-turnout", h.hand),
        action: { how: "turnout", kind: h.kind, curved: true, size: n },
      });
  }
  for (const n of FROG_NUMBERS)
    out.push({
      key: `gen:y:${n}`,
      kind: "wye",
      group,
      label: `#${n}`,
      title: `A #${n} wye of no stated make — both routes diverge`,
      glyph: "wye",
      action: { how: "turnout", kind: "wye", size: n },
    });
  for (const n of FROG_NUMBERS) {
    for (const h of hands)
      out.push({
        key: `gen:x:${n}:${h.hand}`,
        kind: "crossover",
        group,
        label: `Single #${n} ${h.suffix}`,
        title: `A single crossover built from two #${n} turnouts, throwing ${h.hand}`,
        glyph: h.hand === "left" ? "crossover-left" : "crossover-right",
        action: { how: "crossover", hand: h.hand, size: n },
      });
    out.push({
      key: `gen:xx:${n}`,
      kind: "crossover",
      group,
      label: `Double #${n}`,
      title: `A double crossover built from four #${n} turnouts — its two diagonals cross at the scissors`,
      glyph: "crossover-double",
      action: { how: "crossover", double: true, size: n },
    });
  }
  return out;
}

/** The real products a 1-D module can name. */
function namedPositionalEntries(library: TrackPart[]): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const part of library) {
    if (isPlaceholder(part)) continue;
    if (part.kind === "turnout" || part.kind === "curved-turnout") {
      if (part.frogNumber == null) {
        out.push({
          key: `blocked:${part.id}`,
          kind: part.kind,
          group: groupOf(part),
          label: shortName(part),
          title: `${part.name} — no frog number`,
          glyph: glyphFor(part.kind),
          action: null,
          // The one thing the 1-D model can't do without. The curved Atlas is
          // sold by its two radii; nothing in the document carries a radius.
          blocked: "no frog number — a turnout on a drawn module is shaped by its frog number",
        });
        continue;
      }
      for (const h of [
        { hand: "left" as const, kind: "left" as TurnoutKind, suffix: "LH" },
        { hand: "right" as const, kind: "right" as TurnoutKind, suffix: "RH" },
      ]) {
        const number = part.partNumbers?.[h.hand] ?? part.partNumbers?.single;
        out.push({
          key: `named:${part.id}:${h.hand}`,
          kind: part.kind,
          group: groupOf(part),
          label: `${shortName(part)} ${h.suffix}`,
          title: `${part.name}${number ? ` (${number})` : ""} — drops as a #${part.frogNumber} and records the part`,
          glyph: glyphFor(part.kind, h.hand),
          action: {
            how: "turnout",
            kind: h.kind,
            curved: part.kind === "curved-turnout" ? true : undefined,
            size: part.frogNumber,
            partId: part.id,
          },
        });
      }
      continue;
    }
    if (part.kind === "wye" && part.frogNumber != null) {
      out.push({
        key: `named:${part.id}`,
        kind: "wye",
        group: groupOf(part),
        label: shortName(part),
        title: `${part.name} — drops as a #${part.frogNumber} wye and records the part`,
        glyph: "wye",
        action: { how: "turnout", kind: "wye", size: part.frogNumber, partId: part.id },
      });
      continue;
    }
    if (part.kind === "crossover" && part.frogNumber != null) {
      // ⚠️ A CROSSOVER NAMES ITS PRODUCT ON THE CONNECTOR, not on a turnout —
      // the fixture that set its angle also set its TRACK SPACING, and that
      // belongs to the pair of tracks rather than to either turnout (#180).
      out.push({
        key: `named:${part.id}`,
        kind: "crossover",
        group: groupOf(part),
        label: shortName(part),
        title: `${part.name} — drops as a #${part.frogNumber} double crossover, built to this product's own track spacing`,
        glyph: "crossover-double",
        action: { how: "crossover", double: true, size: part.frogNumber, partId: part.id },
      });
    }
  }
  return out;
}

/**
 * Why a whole KIND is empty. A part-level gap comes from the package
 * (`partGeometryGap`); this answers the different question "why is there
 * nothing here at all", which no part can answer because no part exists.
 */
function emptyKindReason(kind: PaletteKind, mode: PaletteMode): string {
  if (mode === "positional") {
    switch (kind) {
      case "flex":
      case "straight":
      case "curve":
        return "A drawn module has no pieces to lay — its flex is worked out from the runs you draw. Rebuild it as pieces to lay track by the part.";
      case "bumper":
        return "A bumper closes a joint, and a drawn module has no joints. Rebuild it as pieces to place one.";
      case "crossing":
        return "A crossing (diamond) on a drawn module is added from the Objects list, where it sits at a position along a track — the palette lays measured parts, and no crossing product has been measured yet.";
      case "slip":
        return "Slips aren't modelled yet: a slip is two crossings and four sets of points in one moulding.";
      default:
        return "Nothing here yet.";
    }
  }
  switch (kind) {
    case "straight":
      return "No sectional straight products in the library yet. A straight IS its length, so there is no honest generic — the numbers have to come from a real product (Admin → Track parts).";
    case "curve":
      return "No sectional curve products in the library yet. A curve IS its radius and arc, so there is no honest generic — the numbers have to come from a real product (Admin → Track parts).";
    // ⚠️ NOT "not modelled yet" — that was true until the package learned a
    // diamond (0.115.0), and it is exactly the kind of copy that outlives the
    // gap it describes. `partGeometryGap` now returns null for a crossing that
    // carries an angle and an overall length, so the ONLY thing still missing
    // is a real product's measurements.
    case "crossing":
      return "No crossing products in the library yet. A crossing IS the angle its two tracks cross at, and that geometry is modelled — one becomes placeable as soon as a real product's angle and length are recorded (Admin → Track parts).";
    case "slip":
      return "Slips aren't modelled yet: a slip is two crossings and four sets of points in one moulding.";
    default:
      return "Nothing here yet.";
  }
}

/**
 * Why a chip is greyed. TWO different questions hide behind one grey — "we have
 * no parts of this kind at all" and "we have some and none of them can be
 * placed" — and only the first is {@link emptyKindReason}'s.
 *
 * ⚠️ Pointing it at both is what made the **Curved turnout** chip say "Nothing
 * here yet" while the panel underneath listed Atlas's curved turnout with a
 * perfectly good reason beside it. A tooltip that contradicts the panel it opens
 * is worse than no tooltip.
 */
function chipReason(entries: PaletteEntry[], kind: PaletteKind, mode: PaletteMode): string {
  if (entries.length === 0) return emptyKindReason(kind, mode);
  const reasons = [...new Set(entries.filter((e) => e.blocked).map((e) => e.blocked!))];
  return reasons.join(" · ") || emptyKindReason(kind, mode);
}

// ─── The component ───────────────────────────────────────────────────────────

export function TrackPalette({
  entries,
  mode,
  armed,
  onArm,
  onDragStart,
}: {
  entries: PaletteEntry[];
  mode: PaletteMode;
  armed: PaletteEntry | null;
  onArm: (entry: PaletteEntry | null) => void;
  onDragStart: (entry: PaletteEntry, e: React.PointerEvent) => void;
}) {
  const kinds = KIND_ORDER.map((k) => ({
    ...k,
    entries: entries.filter((e) => e.kind === k.kind),
    any: entries.some((e) => e.kind === k.kind && e.action),
  }));
  // Open on the first kind with something in it — Flex in the graph model (the
  // workhorse: arming it turns a drag into a whole run), Turnout on a drawn one.
  const first = kinds.find((k) => k.any)?.kind ?? "turnout";
  const [openKind, setOpenKind] = useState<PaletteKind | null>(null);
  const shown = kinds.find((k) => k.kind === (openKind ?? first)) ?? kinds[0];

  const groups = new Map<string, PaletteEntry[]>();
  for (const e of shown.entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  // The reasons, deduped — several parts usually share one gap, and repeating
  // "no points offset" ten times says less than saying it once.
  const reasons = [...new Set(shown.entries.filter((e) => e.blocked).map((e) => e.blocked!))];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {/* Kind chips — every kind of track piece there is, including the ones
          nobody can place yet. A kind missing from the list would read as
          "impossible" rather than "not built yet". */}
      <div className="flex flex-wrap items-center gap-1">
        {kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setOpenKind(k.kind)}
            aria-pressed={shown.kind === k.kind}
            title={k.any ? undefined : chipReason(k.entries, k.kind, mode)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
              shown.kind === k.kind
                ? "border-blue-600 bg-blue-600 text-white"
                : k.any
                  ? "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[...groups.entries()].map(([group, list]) => (
          <Fragment key={group}>
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {group}
            </span>
            {list.map((e) => {
              const on = armed?.key === e.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  title={e.title}
                  aria-pressed={on}
                  disabled={!e.action}
                  onPointerDown={e.action ? (ev) => onDragStart(e, ev) : undefined}
                  onClick={e.action ? () => onArm(on ? null : e) : undefined}
                  className={`flex items-center gap-1 rounded border px-1.5 py-1 text-xs transition ${
                    on
                      ? "border-blue-600 bg-blue-600 text-white"
                      : e.action
                        ? "cursor-grab border-gray-300 bg-white text-gray-700 hover:border-gray-400 active:cursor-grabbing"
                        : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  <PieceGlyph name={e.glyph} className="h-3.5 w-5 shrink-0" />
                  {e.label}
                </button>
              );
            })}
          </Fragment>
        ))}
        {shown.entries.length === 0 && (
          <span className="text-[11px] text-gray-500">{emptyKindReason(shown.kind, mode)}</span>
        )}
      </div>
      {/* ⭐ THE REASON IS ON SCREEN, not only in a tooltip. A greyed button with
          the explanation hidden behind a hover is how "why can't I use my Fast
          Tracks #6" became a support question. */}
      {reasons.length > 0 && (
        <div className="text-[11px] leading-snug text-gray-500">
          {reasons.map((r) => (
            <div key={r}>Greyed out: {r}.</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Glyphs ──────────────────────────────────────────────────────────────────

export type GlyphName =
  | "straight"
  | "curve"
  | "flex"
  | "turnout-left"
  | "turnout-right"
  | "curved-left"
  | "curved-right"
  | "wye"
  | "crossing"
  | "crossover-left"
  | "crossover-right"
  | "crossover-double"
  | "slip"
  | "bumper";

function glyphFor(kind: TrackPart["kind"], hand?: "left" | "right"): GlyphName {
  switch (kind) {
    case "turnout":
      return hand === "right" ? "turnout-right" : "turnout-left";
    case "curved-turnout":
      return hand === "right" ? "curved-right" : "curved-left";
    case "wye":
      return "wye";
    case "crossover":
      return "crossover-double";
    case "crossing":
      return "crossing";
    case "flex":
      return "flex";
    case "straight":
      return "straight";
    case "curve":
      return "curve";
    case "bumper":
      return "bumper";
  }
}

/** A little schematic icon per piece kind, so the palette reads like the track
 * it lays. Every entry gets one — a picker that is icons for some things and
 * words for others is the sloppiness this palette exists to end, so these sit
 * BESIDE a label rather than instead of one. */
export function PieceGlyph({ name, className }: { name: GlyphName; className?: string }) {
  const s = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const main = <line x1={3} y1={9} x2={25} y2={9} {...s} />;
  const body = (() => {
    switch (name) {
      case "straight":
        return main;
      case "curve":
        return <path d="M3 14 Q14 4 25 4" {...s} />;
      case "flex":
        return <path d="M3 12 Q9 4 14 9 T25 6" {...s} />;
      case "turnout-right":
        return (
          <>
            {main}
            <path d="M10 9 L25 3" {...s} />
          </>
        );
      case "turnout-left":
        return (
          <>
            {main}
            <path d="M10 9 L25 15" {...s} />
          </>
        );
      case "wye":
        return (
          <>
            <line x1={3} y1={9} x2={11} y2={9} {...s} />
            <path d="M11 9 L25 4 M11 9 L25 14" {...s} />
          </>
        );
      case "curved-right":
        return (
          <>
            <path d="M3 9 Q16 10 25 13" {...s} />
            <path d="M10 9 Q19 6 25 3" {...s} />
          </>
        );
      case "curved-left":
        return (
          <>
            <path d="M3 9 Q16 8 25 5" {...s} />
            <path d="M10 9 Q19 12 25 15" {...s} />
          </>
        );
      case "crossing":
        return <path d="M4 3 L24 15 M4 15 L24 3" {...s} />;
      case "crossover-left":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 13 L18 5" {...s} />
          </>
        );
      case "crossover-right":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 5 L18 13" {...s} />
          </>
        );
      case "crossover-double":
        return (
          <>
            <line x1={3} y1={5} x2={25} y2={5} {...s} />
            <line x1={3} y1={13} x2={25} y2={13} {...s} />
            <path d="M10 5 L18 13 M18 5 L10 13" {...s} />
          </>
        );
      case "slip":
        return (
          <>
            <path d="M4 4 L24 14 M4 14 L24 4" {...s} />
            <path d="M9 6.5 Q14 9 19 11.5 M9 11.5 Q14 9 19 6.5" {...s} />
          </>
        );
      case "bumper":
        return (
          <>
            <line x1={3} y1={9} x2={19} y2={9} {...s} />
            <line x1={19} y1={4} x2={19} y2={14} {...s} />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 28 18" className={className} aria-hidden>
      {body}
    </svg>
  );
}
