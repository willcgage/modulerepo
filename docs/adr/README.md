# Architecture decision records

One file per decision that would be expensive to reverse or confusing to
rediscover. Numbered, immutable once accepted: a decision that changes gets a
NEW record that supersedes the old one, so the reasoning at the time survives.

A record that **narrows or clarifies** an earlier one without replacing it
*amends* it: a new record saying what changed and why, and a pointer back from
the original so nobody reads a clause that no longer holds on its own. The
original's text is left as it was written.

A record is worth writing when the answer to "why is it like this?" is longer
than a code comment and older than the code.

| # | Decision | Status |
|---|---|---|
| [0001](0001-piece-graph-authoring.md) | Author track as a graph of pieces, derive the topology | **Accepted** 2026-07-26 · amended by 0002, 0003 |
| [0002](0002-owner-initiated-conversion.md) | Conversion to pieces is allowed when the owner asks for it | **Accepted** 2026-07-28 · amends 0001 |
| [0003](0003-an-assembly-is-one-piece.md) | An assembly sold as one product is one piece | **Accepted** 2026-07-28 · amends 0001 |
