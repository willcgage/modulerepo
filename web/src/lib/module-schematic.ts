/**
 * Module schematic (track-graph) — the doc types, feature resolver, N-scale
 * helpers, and editor state machine now live in the shared
 * `@willcgage/module-schematic` package so this repo and Free-Dispatcher stay
 * in lock-step. This barrel re-exports them under the historical import path.
 * Format spec: docs/module-schematic-format.md in the free-dispatcher repo.
 */
export * from "@willcgage/module-schematic";
