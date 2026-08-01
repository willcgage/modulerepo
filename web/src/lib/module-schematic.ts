/**
 * Module schematic (track-graph) — the doc types, feature resolver, N-scale
 * helpers, and editor state machine now live in the shared
 * `@willcgage/module-schematic` package so this repo and Free-Dispatcher stay
 * in lock-step. This barrel re-exports them under the historical import path.
 * Format spec: docs/module-schematic-format.md in the free-dispatcher repo.
 */
export * from "@willcgage/module-schematic";

import { asModuleSchematic } from "@willcgage/module-schematic";

/**
 * How many endplates a module presents — ONE definition, because this number
 * had two answers on adjacent pages (#245).
 *
 * ⛔ `freemon_modules.endplate_count` is maintained by a DB trigger on
 * `freemon_endplates`, and `saveModuleSchematic` only writes rows for A and B.
 * So the column is wrong in BOTH directions: a module with a branch endplate
 * placed on the board (FMN-0068, FMN-0077) under-reports it, while a module
 * carrying a row its document never knew about (FMN-0026) over-reports.
 *
 * The document owns the endplates (#120), so it answers. The column is the
 * fallback for a module that has no document at all — for those, it is the only
 * thing that knows anything about their ends.
 */
export function endplateCountOf(
  module: { schematic?: unknown; endplate_count?: number | null },
): number {
  const doc = asModuleSchematic(module.schematic);
  return doc?.endplates?.length ?? module.endplate_count ?? 0;
}
