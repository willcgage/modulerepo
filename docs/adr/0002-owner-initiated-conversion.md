# ADR 0002 — Conversion to pieces is allowed when the owner asks for it

- **Status:** **Accepted**
- **Date:** 2026-07-28
- **Accepted by:** Will Gage
- **Issue:** [#199](https://github.com/willcgage/modulerepo/issues/199)
- **Amends:** [ADR 0001](0001-piece-graph-authoring.md) — narrows *"No auto-migration"*, and answers its first open question. ADR 0001 otherwise stands.

## Context

ADR 0001's *"No auto-migration"* clause was written against conversion happening **to** an owner: silently, in bulk, on load. It was read afterwards — by me, repeatedly — as forbidding conversion at all.

That reading left owners stuck. Pieces snap only to pieces, so on a module whose track was drawn with the Track tool a dropped piece simply sat there and nothing happened. Will hit this twice from two directions and reported it both times; MR v0.47.1 only made the silence explain itself.

Asked to choose between indefinite coexistence and a conversion, Will's instinct was to convert for owners rather than leave them stranded:

> What if we convert them for them? It would be cleaner potentially, yes?

and then chose the shape: **offered per module, never run silently.**

## What the production database showed

`moduleConversionReport` was run over every module carrying a schematic before this was designed — 32 modules, 50 turnouts:

| | |
|---|---|
| turnouts naming a part | **0** |
| turnouts stating no frog number either | **35** |
| resolve automatically | 9 |
| **need the owner** | **41** |
| need a measurement from us (no measured #6) | 6 |
| modules converting with nothing asked | 17 (nearly all have no turnouts) |
| modules needing something from the owner | 14 |
| modules withheld entirely | 1 (Harrisonville — two diamonds) |

**Identity is the gate, not geometry.** Conversion is blocked far more often by not knowing *which turnout it is* than by any missing measurement — and no amount of measuring fixes that, because for 35 turnouts the document never recorded what was laid. Only the owner knows. That is why conversion asks rather than guesses, and why "convert for them" is a questionnaire rather than a button.

A second finding shaped the safeguards. Four real modules draw named, capacity-bearing track that **no turnout reaches** — Idaho Falls Grain Yard has five yard tracks and no turnouts at all; Magnolia Yard's "Track 4" is 3000 ft and joined to nothing. The 1-D model draws a siding from its lane and position alone and never notices; a piece has to join something. A report that looked only at turnouts called all four ready to convert, which would have dropped nine named tracks silently.

## Decision

**An owner may convert one of their modules to pieces, having been shown what it will do. Nothing converts on its own.**

ADR 0001's prohibition stands where it was aimed: **no automatic migration, no bulk conversion, nothing on load or on a schedule.** What changes is that conversion is no longer forbidden *as such*. It supplies geometry the document never recorded — which is unacceptable behind an owner's back, and an ordinary edit in front of them, with the cost shown and their answer taken.

### Invariants the implementation must keep

1. **Per module, and offered — never run.** No bulk path, no conversion on load.
2. **The cost is shown before consent.** The offer displays what will be laid, what will be asked, and what cannot be laid — computed by running the conversion itself on the current answers, not by describing it. A preview that can drift from the result is not a disclosure.
3. **One question for the whole module**, with per-turnout overrides for the exceptions. Owners lay one kind of turnout throughout; asking per turnout asks the same question eight times on a yard, and would have been 41 questions instead of 14 across the database.
4. **Only parts that can actually be drawn are offered.** A part we cannot place is an answer that does not answer.
5. **Anything not laid is named, in the owner's own words.** An owner knows "yard 1", not `mt16`. Unshown, a "successful" rebuild would quietly be missing a named siding.
6. **A blocker withholds the offer entirely.** A diamond and a balloon have no piece to become; no answer supplies one, so the offer is not made and then abandoned half way.
7. **A product's geometry wins; its position is the owner's.** Where a document's figures disagree with the part it names, the part is authoritative, the assembly is placed where the owner put it, and the difference is reported rather than absorbed.
8. **One undo restores it.** Conversion rewrites tracks and turnouts, which is the point — storing the graph alone would leave a module drawing its old positional track with the new pieces on top of it.
9. **A guess is never substituted for an answer.** A #6 does not become the #7 we happen to have measured. Nearby parts are offered as candidates for the owner to choose, never adopted.

## Consequences

**Good**

- The two models stop being a dead end for existing owners.
- The parts library gains a reason to be filled in that owners can feel.
- Conversion surfaces real incompleteness that the 1-D model tolerates silently: track nothing reaches, and ladders pitched tighter than any available turnout allows.

**Bad**

- Most modules cannot convert without owner input, and that input is work.
- Six turnouts are blocked on a measurement we owe rather than on anything an owner can supply.

**Neutral**

- Free-Dispatcher is unaffected. Conversion produces the same document by the same pure function.

## What this still does not commit us to

- **No automatic or bulk conversion**, on any trigger.
- **No change to the dispatcher/operations view.**
- **No rewrite of Free-Dispatcher.**

## Waiting on

The **points offset** for a #6. Free-moN §2.0 requires main-line turnouts of at least #6, so a #6 is the likeliest answer for the 35 turnouts whose documents say nothing — and it is the one answer we cannot currently offer. Measuring it turns much of the questionnaire into a single confirmation.

## Still open

- ~~What an owner does when they genuinely cannot answer what a turnout is.~~ **Answered by [ADR 0004](0004-placeholder-for-an-unidentified-turnout.md).**
- ~~Whether the derivation should run on every save, so that moving a piece after conversion re-derives the tracks.~~ **Answered:** it runs on every commit, through one derivation site; a module without a graph is untouched because `deriveGraphDoc` returns the same object.
- **A main that begins at a turnout** — a single-to-double transition module. Conversion is withheld for that shape; see [ADR 0004](0004-placeholder-for-an-unidentified-turnout.md)'s open question.
