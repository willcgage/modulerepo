# Architecture decision records

One file per decision that would be expensive to reverse or confusing to
rediscover. Numbered, immutable once accepted: a decision that changes gets a
NEW record that supersedes the old one, so the reasoning at the time survives.

A record is worth writing when the answer to "why is it like this?" is longer
than a code comment and older than the code.

| # | Decision | Status |
|---|---|---|
| [0001](0001-piece-graph-authoring.md) | Author track as a graph of pieces, derive the topology | **Accepted** 2026-07-26 |
