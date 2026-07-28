# ADR 0003 — An assembly sold as one product is one piece

- **Status:** **Accepted**
- **Date:** 2026-07-28
- **Accepted by:** Will Gage
- **Amends:** [ADR 0001](0001-piece-graph-authoring.md) — makes explicit what "a piece" means for a multi-part product. ADR 0001 otherwise stands.

## Context

ADR 0001 lists *"Track, Switches, Crossings, Double Crossovers, etc."* among the things that are pieces. The first implementation of conversion nevertheless built a double crossover out of its constituent turnouts. Will named the error:

> If you treat double crossovers as 4 separate turnouts, then this will cause the issues you showed.

The resulting failure was the worst kind. Two Atlas #7s 2.5″ apart have mouldings that overlap by 3.5″. `flexPieces` merges overlapping occupied spans by design — so that a crossover's two turnouts do not carve the same inch twice — which meant nothing complained: the pieces were left intersecting, the walk threaded a path through geometry that cannot exist, and it emitted two turnouts at 91.9″ with the crossovers relabelled as 11.8″ sidings. **A module nobody has, presented as a successful rebuild.**

A first fix treated the symptom, refusing the pair for "overlap". That blames the owner for a real and perfectly ordinary piece of trackwork.

## Decision

**Where a manufacturer sells an assembly as one product, it is one piece.**

Its point-sets sit closer together than the separate parts ever could — that is what the assembly is *for* — so decomposing it is not a simplification, it is a different and unbuildable thing.

A double crossover is therefore one piece with **four joints and four routes**: straight on either track, and a crossing each way. Four routes is what makes it one moulding rather than four turnouts near each other.

### The geometry was published all along

What was missing was reading Fast Tracks' figure as the half-assembly they say it is:

- **length** = `overallLength × piecesPerAssembly` — the fixture builds a symmetrical half, made twice and butted together after turning the second 180°. A #6 is 10.07″ × 2 = 20.14″.
- **crossing run** = `spacing / tan θ` — how far along the track a route takes to reach the other one, so the two point-sets on one track are that far apart. For a #6 at 1.09″ that is 6.54″.

**Cross-check.** Both crossing routes are centred, so they meet at twice the frog angle. Fast Tracks publish that scissors angle *separately* — 19° and 14.3°, against exact doubles of 18.92° and 14.26°, inside their own rounding. Two independent readings agreeing is what makes this a derivation and not a guess. It is the same falsifier discipline that caught a bad wye measurement in the parts work.

## Correction to the standard as recorded

Part data described the fixture's 1.09″ spacing as *"tighter than the standard"*, which reads as non-conformance and is wrong.

Free-moN §2.0 fixes 1.125″ **at the endplate** — *"Double track endplates must have a track spacing of 1.125 inches"* — with all track crossing the endplate perpendicular, straight and level for at least 4″ from the outside face. **What the two mains do in between is the module builder's business**, and every real double crossover pinches them closer.

**A mid-module pinch is not a violation and must not be flagged as one.**

## Consequences

- **The pinch stops being a special case.** The piece **is** 1.09″ wide and the flex bends to meet its joints — retiring `LanePinch`, `laneOffsetAt`'s pinch handling and the invented `PINCH_EASE_INCHES`, exactly as ADR 0001's own table predicted.
- **An owner is not asked to identify the point-sets of a product they have already named.** Before this, a module with #6 crossovers was asked for a measured #6 *turnout*, which has nothing to do with it.
- **The same rule governs what comes next.** A single slip, a double slip and a three-way are single assemblies too, and must not be built out of turnouts.
- A stored document may disagree with the product it names. The product is authoritative for shape; the document is authoritative for where it sits; the difference is reported.
