# ModuleRepo (MR)

MR is one of **three repos in one product family**. Features routinely ship across all three
at once — check the other two before changing anything on the contract.

| Repo | Path | Role |
|---|---|---|
| **MR** (this repo) | `C:\dev\modulerepo` | Next.js authoring app. Owners author modules. |
| **pkg** | `C:\dev\module-schematic` | `@willcgage/module-schematic` — the MR↔FD contract. |
| **FD** | `C:\dev\free-dispatcher` | Electron dispatcher. Consumes published modules. |

Never change the pkg schema from one side alone: MR authors it, FD renders it, and the two
have disagreed before (see the endplate-offset-framings memory).

## Memory

Durable knowledge for **all three repos** lives in ONE shared store, not one per repo:

    ~/.claude/projects/freemon-family/memory/

`.claude/settings.local.json` sets `autoMemoryDirectory` to it, so this repo reads *and*
writes there natively — no import needed. `module-schematic` and `free-dispatcher` point at
the same directory. A feature's MR side and FD side are deliberately kept in one entry, which
is why the store is shared rather than split.

Entries carry a `scope:` field — `mr`, `fd`, `pkg`, `family`, `domain`, `ops` — use it to skip
the parts of the index that can't be relevant. `archive/` is off the retrieval path: read it
only to reconstruct why something was decided.
