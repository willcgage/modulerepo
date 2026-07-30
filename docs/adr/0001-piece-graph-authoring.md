# ADR 0001 — Author track as a graph of pieces, derive the topology

- **Status:** **Accepted**, amended
- **Date:** 2026-07-26 (proposed and accepted same day)
- **Accepted by:** Will Gage
- **Issue:** [#179](https://github.com/willcgage/modulerepo/issues/179)
- **Supersedes:** the 2026-07-16 verdict *"do NOT rewrite the model to 2-D. Not yet, maybe never."* and its 2026-07-18 partial reversal (*"physical view only"*)
- **Amended by:**
  - [ADR 0002](0002-owner-initiated-conversion.md) (2026-07-28) — an owner may convert one module, having been shown the cost. Narrows "no auto-migration"; answers open question 1.
  - [ADR 0003](0003-an-assembly-is-one-piece.md) (2026-07-28) — a double crossover is one piece, not four turnouts.
  - [ADR 0005](0005-one-track-tool-the-module-says-which-model.md) (2026-07-29) — one Track tool; the module says which model it is built from, and new modules are graph-built. Bounds "two authoring paths coexist for a long time" below.

## Context

The app models track **topologically**: a position in inches from endplate A plus an integer lane. The physical drawing is projected from that on demand. #179 already established that this single fact explains why turnouts don't read as turnouts, why rails aren't seamless, why nothing snaps, why tracks are always parallel at a fixed spacing, and why easements are impossible.

Will restated the same thing from the owner's side on 2026-07-26:

> Endplates are a part of the benchwork. We have separated them causing some challenges. […] Track, Switches, Crossings, Double Crossovers, etc. should all be considered individual track. Each piece should be draggable to a place on the benchwork. […] Each piece of tracks end (joint) is a place where another one connects. […] the mainline track(s) are not movable, but should be. […] Only Flex Track should be resized or even bend to create curves.

Those are not four features. They are one model.

### What a day of bug-fixing showed

Six defects fixed on 2026-07-26 were not coding mistakes. Each is the topological model failing to hold a physical fact:

| Fixed | In a piece model |
|---|---|
| #197 crossover span formula (`size × spacing`, measured from the wrong landmark) | You drag a crossover. There is no span formula. |
| #196 leg overshoot — two turnout bodies wanting 1.208″ of a 1.09″ gap | Pieces butt at joints. Overlap is unrepresentable. |
| #196 duplicate diagonals — connector and legs both drawing the route | One piece draws itself once. |
| #196 Main 2's legs pointing away from the pair | A piece has an orientation. You rotate it. |
| #180 the crossover pinch — `LanePinch`, `laneOffsetAt`, and an invented `PINCH_EASE_INCHES` | The piece **is** 1.09″ wide. Flex bends to meet its joints. |
| Junction endplate drawn on the module centre line | An endplate is a benchwork edge. It cannot be elsewhere. |

`PINCH_EASE_INCHES` is the clearest signal: a drawing convention invented and explicitly documented as *not a measurement*, because physical reality had nowhere honest to live.

## Decision

**Owners author a graph of placed pieces. The 1-D document becomes a derived artifact.**

```
Part       a library entry with real geometry: segments, and ENDS carrying
           position AND tangent            (already stubbed: PartSegment, PartEnd)
Piece      a Part placed: { partId, x, y, rotation, flipped }
Joint      one end of a placed piece, in module coordinates
Connection two joints in the same place. That is the entire rule.
Flex       the ONLY piece with editable geometry
Benchwork  a polygon; an ENDPLATE IS AN EDGE OF IT, not a separate object
```

Everything positional is **derived by walking the graph**: `pos` is arc length from endplate A along the route actually travelled; a siding is a branch that left the main at one turnout and returned at another; lane is the side the piece is on.

Crucially, **the derivation emits the existing `ModuleSchematicDoc`**. `moduleFeatures` is unchanged, so the dispatcher view and all of Free-Dispatcher are unaffected.

## Evidence

A spike was run before proposing this (code: session scratchpad, `spike/`; not shipped).

**Reproduces a real module.** FMN-0011 "Blairstown" was built from 11 pieces and the derived document diffed against the stored one:

```
OK   lengthInches              96                     96
OK   track ids                 [main,mt5,spur1]       [main,mt5,spur1]
OK   mt5 lane/from/to          [1,13,73]              [1,13,73]
OK   spur1 lane/from/to        [-1,19,85]             [-1,19,85]
OK   turnout positions         [13,19,73,85]          [13,19,73,85]
OK   turnout -> diverge track  [mt5,spur1,mt5,spur1]  [mt5,spur1,mt5,spur1]
OK   features.tracks           identical
```

**A three-deep yard ladder resolves exactly.** ELM Yard's east side (`sw1` on the main, `sw2` on `mt20`, `sw3` on `mt21`) derived to 8 / 13 / 18, each turnout on a different route. This is the case currently documented as *"operations view for NESTED tracks is APPROXIMATE"*. It also reports that the tightest #6 ladder pitch is 4.81″ and ELM's 5″ leaves 0.19″ of flex — a buildability check the present model cannot make.

**Curves measure as rail, not as x.** A 90°/R30 corner derives 47.124″ where a chord measure loses 4.69″. The same module laid at 37° measures identically.

**Hand disappears.** The stored document calls `sw1` "left" and `sw2` "right" for *the same siding*. The graph never asks — the side is where the piece is. The ~120-line hand/lane reconciliation, the documented source of three shipped bugs, becomes unnecessary rather than fixed.

**A loop terminates** (2 ms, follows the balloon, closes on the wye). **A crossover is walked through.** **Dangling ends are reported** instead of drawn as phantom sidings.

## Consequences

**Good**

- A whole class of bug becomes unrepresentable: joins are shared endpoints, not two computations expected to agree at a constant.
- Nesting, curves and buildability become exact where they are approximate or unchecked today.
- Drag, rotate, flip and snap are the natural gestures, which is the UX Will asked for.
- The parts library stops being a side quest and becomes the substrate.

**Bad**

- Two authoring paths coexist for a long time.
- The editor becomes the hard part: snapping, tolerance, rejection, and flex bending are real interaction work.
- The library must cover what owners actually have. Today: Atlas and Fast Tracks only.

**Neutral**

- Free-Dispatcher does not change. Same document, same pure function.
- No new stack. Naive joint matching costs 2 ms at 50 pieces and 21 ms at 200; a grid hash is the known fix if modules ever get large.

## Gaps that must be designed before building

1. **A joint currently accepts more than one connection.** Three joints placed on one point caused the walk to silently pick one and drop a piece out of the layout — the same failure that broke the spike's own first fixture. An occupied joint must refuse a second suitor, or owners will stack track and lose pieces invisibly. **This is the one that would bite users.**
2. **Loops are followed but not labelled.** The walk closes on the wye without recording "this route rejoins itself".

## What this does not commit us to

- **No auto-migration.** Converting a 1-D document into pieces would invent leads, frog numbers and radii nobody measured. Existing modules stay on the existing path, untouched, and keep working. — *Narrowed by [ADR 0002](0002-owner-initiated-conversion.md): still no automatic conversion, but an owner may convert one module themselves. The clause was written against conversion happening **to** an owner; it was read afterwards as forbidding conversion at all.*
- **No change to the dispatcher/operations view**, which stays derived and straightened.
- **No rewrite of Free-Dispatcher.**

## Alternatives considered

- **Keep the topological model and keep patching.** Rejected: six defects in one day were model artifacts, and #179 documents four more strains (rescale divergence, `role: "branch"` absent from the operations view entirely, Main 2's path stored twice).
- **Physical view only** (the 2026-07-18 position). Insufficient: it leaves the connectivity inferred from coordinates, which is what produces the join bugs.
- **Adopt a CAD library / go offline.** Unnecessary: the geometry is tens of pieces and the interaction is well understood. Being online is the product's advantage and is not threatened.

## Why the earlier "don't" no longer holds

The 2026-07-16 verdict rested on three objections:

1. *"Migration can't be honest."* **Still true, and now irrelevant** — the graph produces a document, so the two models coexist and nothing is auto-converted.
2. *"Owners would have to know frog numbers and radii."* **Now backwards** — after the 2026-07-26 parts work they pick "Atlas #7" from a library instead of typing `siding, 14→31.2`.
3. *"`projectToCenterline` already converts a drawn point to `pos`."* True, but it projects onto a spine. It is the mechanism being replaced, not a reason to keep it.

## Open questions

- ~~Do the two authoring paths coexist indefinitely, or is there an owner-driven conversion?~~ **Answered by [ADR 0002](0002-owner-initiated-conversion.md):** they coexist, and there is an owner-driven conversion.
- What does an owner do when they don't know the brand of a turnout — a generic placeholder, and does it claim geometry or stay honest about not knowing? **Partly answered by [ADR 0002](0002-owner-initiated-conversion.md):** conversion asks, offers only parts it can actually draw, and holds the module back rather than inventing a generic. What an owner does when they genuinely cannot answer is still open.
- Do industries, signals and control points become properties of pieces, or stay positional along a derived route?

## Not yet validated

Industries and signals on nested tracks · multi-section modules · control points · module-to-module joins in Free-Dispatcher's layout composition.
