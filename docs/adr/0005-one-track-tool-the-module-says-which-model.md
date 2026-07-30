# ADR 0005 — One Track tool; the module says which model it is built from

- **Status:** **Accepted**
- **Date:** 2026-07-29
- **Accepted by:** Will Gage
- **Issue:** [#198](https://github.com/willcgage/modulerepo/issues/198) (step 4)
- **Amends:** [ADR 0001](0001-piece-graph-authoring.md) — bounds its *"two authoring paths coexist for a long time"*

## Context

ADR 0001 made track a graph of placed pieces and the 1-D document a derivation. It shipped as a **second rail button**: Track (T) drew the positional model, Pieces (P) laid the graph. Both were live on every module, so the canvas had two answers to "what does this click mean" and no rule for choosing.

That is a tax, not an inconvenience. Every feature after ADR 0001 — crossings, slips, signals, industries, capacity — has to be built and tested twice, once per idiom. It is also what left *"the 1-D positional renderer is a different code path from all the graph work"*, which is where the 2026-07-29 crossover render bug was hiding for two earlier attempts at it.

Will asked for the merge as UI work: *"it's partially dropdown menus and icons driving this, it makes it a little sloppy for a UIX."* The blocker was not UI. **One button cannot mean both until a module can say which model it is built from** — and a brand-new module, having nothing on it, could not say.

## Decision

**T is the only track button. The module decides what it does, and NEW MODULES ARE GRAPH-BUILT.**

```
graph-built   this module has pieces, OR it has nothing at all       → the parts palette
1-D           this module already carries positional track           → draw/bend/drop, as before
```

"Already carries positional track" means a hand-drawn `mainPath`, a siding/spur/Main 2, or a turnout placed at a `pos`. A legacy module keeps exactly the affordances it was drawn with. A new module opens in the parts palette.

### On a graph-built module the 1-D document is not editable

This follows from ADR 0001 rather than adding to it: the derived tracks and turnouts are an **output**. Dragging them would put two authorities on the same piece of track with no rule for which wins. The pieces are where you change it.

### The rebuild offer has to reach the 1-D bar

It used to live only in the Pieces tool's bar. But a module with sidings and turnouts and no pieces is exactly the module the parts palette is no longer shown on, so leaving it there would have deleted the whole [ADR 0002](0002-owner-initiated-conversion.md) conversion path for every legacy module in the database — silently, and with no type error. It now appears on the T bar in **either** mode, wherever a module still has 1-D track and no pieces.

### A module with only a main is graph-built, and that is a real consequence

`tracks` here means placed track — a siding, a spur, Main 2 — not the main every module implicitly has, because `stateToDoc` emits a main entry for every module ever saved and a predicate that counted it would never be false. So ~11 existing single-track modules (a bridge, a defect detector, two end-of-line boards, some plain curves) are graph-built by this rule: they have a derived main and nothing else. Nothing is lost — they have no sidings or turnouts to give up — and the rebuild offer is right there on the same bar to lay their main as flex. But it is a change to modules whose owners did not ask for one, and it is stated here rather than discovered.

## What made this affordable: fill-a-run

`maxFlexPieceInches` is **30″**. Real flex genuinely comes in 30″ lengths, so a 96″ main is four pieces and FMN-0064's 386″ main is fourteen. Making the graph the default without a bulk gesture would have replaced a two-click mainline with fourteen placements.

**Dragging along the run fills it with flex**, cut by `flexPieces` — the same package function the conversion already uses, so a run laid by hand and a run laid by a rebuild agree piece for piece. This ships in the same change as the fold, deliberately: shipped alone, the fold would have been a downgrade.

## Alternatives considered

- **A blank module's T bar offers both**, first touch decides. Rejected: it keeps both models alive indefinitely, which is the tax.
- **An explicit "Build this from pieces →" on a blank module**, mirroring the sections button. Rejected for the same reason, plus it asks an owner to make a modelling decision before they have drawn anything.
- **Keep P.** Rejected: it is the status quo whose cost is the reason for this ADR.

A rejected objection, recorded because it was raised and answered: *(a) forces every owner to name their parts.* It does not. The palette carries **20 placeable entries including `#4…#10 Turnout (make unknown)`** ([ADR 0004](0004-placeholder-for-an-unidentified-turnout.md)), while T's own bar asks for a frog number from a `<select>` of the same numbers. Both paths ask for exactly the same thing.

## Consequences

**Good** — one code path for new work. ADR 0001's model stops being an opt-in that half the app ignores. The palette (#198's remaining step) gets built once, in one idiom, rather than twice.

**Bad** — the 1-D draw flow is no longer reachable for a new module. An owner who wants the old way must have a module that already has track. This is the deliberate cost of ending the dual model, and it is why the decision is recorded rather than assumed.

**Neutral** — `P` still selects Track, the way `W` does since the Turnout tool merged. No document changes; nothing is converted by this.

## A correction worth keeping

The plan for this change specified the predicate as `pieces.length > 0 || (mainPath.length < 2 && centerline.length < 2)`, reading a blank module off its centre-line. **That second clause is never true.** `geometry.type` falls back to `"straight"` for derivation (#103), so every module with a length derives a two-point centre-line whether or not anyone drew one — and keying on it would have made every new module 1-D, the exact outcome this ADR exists to prevent. It would also have looked correct, because on a legacy module both predicates give the same answer.
