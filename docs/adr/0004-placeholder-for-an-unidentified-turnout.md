# ADR 0004 — A placeholder for a turnout nobody has identified

- **Status:** **Accepted**
- **Date:** 2026-07-28
- **Accepted by:** Will Gage
- **Issue:** [#199](https://github.com/willcgage/modulerepo/issues/199)
- **Answers:** the first open question of [ADR 0002](0002-owner-initiated-conversion.md)

## Context

ADR 0002 left this open, and framed the trap:

> What an owner does when they genuinely cannot answer what a turnout is. Today the module simply does not convert. A generic placeholder that **claims geometry** would be the dishonest fix; one that **claims none** may still be useful.

The cost of leaving it open is most of the database. Across production, **35 turnouts state no part and no frog number** — their documents never recorded what was laid, and their owners may genuinely not know. Refusing to convert until someone can name a product blocks them on a fact nobody has.

## The constraint that decided the shape

A frog number yields some of a turnout's geometry and not all of it.

| dimension | from a frog number? |
|---|---|
| lead (points → frog) | ✅ interpolated across the measured parts |
| length past the frog | ✅ interpolated the same way |
| **points offset** (tie end → points) | ❌ **not a function of N** |

The measured Atlas parts read **1.75″, 0.625″ and 0.5625″** for the #5, #7 and #10. That is not geometry, it is a moulding decision, and there is nothing to interpolate along.

## Decision

**A placeholder is the turnout's working geometry and nothing else: points → frog → end, with no moulded approach track in front of the points.**

Setting the points offset to zero is not a guess about the owner's part. It is the statement that we are modelling *a turnout* and not *some product's tie strip* — which is also, exactly, what a hand-laid turnout is.

The lead and the length past the frog are interpolated by the same functions the 1-D model has always drawn an unidentified `#N` with. **Nothing new is invented here; what changes is that it is now labelled.**

### Every dimension is `derived`, and two things follow — both wanted

- `partGeometry` reports `source: "derived"`, so any surface can say the shape is provisional.
- `partExtent` returns **null**, so no renderer draws a boundary claiming to know where this turnout's body ends. The drawing declines rather than laundering an interpolation into something an owner would read as a measurement of their own track.

### ⛔ Never adopted automatically

This is the half that matters most. A placeholder is something an owner **chooses** when they cannot answer; resolving a bare `#6` to one behind their back would be precisely the invention ADR 0001 forbids.

`provisional` parts are therefore excluded from:

- `turnoutPartForSize` — what a bare `#N` resolves to
- `leadInchesForSize` — both its exact-match path and its interpolation basis
- the conversion report's automatic resolution **and its candidate list**

A bare `#6` still reports *"no measured #6 in the parts library yet"*. In the offer, placeholders sit in their own group, below the real products, labelled "I don't know what make they are" → "#6 — make unknown", and choosing one says what it costs at the moment it is chosen.

### It stays visible afterwards

The document records `partId: "generic-turnout-6"`, so a converted module still knows which turnouts were never identified. Re-running the report on the converted document returns the placeholder rather than pretending the question was settled. An owner can come back and name the real part whenever they find out, and the drawing sharpens.

## Consequences

**Good** — an owner who cannot answer is no longer blocked, and what they could not answer is not lost. The library's invariant that no *product* carries a guessed dimension is now sharper rather than weaker: a derived lead may appear **only** on a provisional part, and a provisional part never carries a manufacturer's part number or a name without "unknown" in it.

**Bad** — a placeholder is a real answer that is not a real part, and someone will eventually read a converted module as more precisely known than it is. The naming, the grouping and the `derived` provenance are the defences; none of them is proof.

**Neutral** — placeholders are placeable, so they also appear in the piece palette under "Generic". An owner building new track who has not decided on a brand is in the same position as one who has forgotten, and the same honest answer serves both.

## Still open

- **Two mains joined partway along, written as bare turnouts.** ELM Yard has `sw7` and `sw8` crossing between its mains with no connector track between them. That is a crossover, and [ADR 0003](0003-an-assembly-is-one-piece.md) says an assembly is one piece — but there is nothing in the document to lay one *from*. Reported rather than dropped; supporting it means recognising the pair as a crossover and asking which product it is.

## Resolved since

- **A main that begins or ends at a turnout** — a transition module. Both shapes now convert (pkg 0.109.0). One that BEGINS at a turnout is laid by the branch pass; one that ENDS at a turnout is closed onto it as a siding closes onto its far turnout. Both keep their `main` role, and a second main that does not cross the endplates no longer claims to.
