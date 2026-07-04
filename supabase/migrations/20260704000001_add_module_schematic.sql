-- Owner-authored module schematic (track-graph) — the structured doc Free
-- Dispatcher imports and composes into a layout. Topological, straightened-first
-- (1-D pos + lane); see free-dispatcher docs/module-schematic-format.md.
alter table freemon_modules add column if not exists schematic jsonb;
alter table freemon_modules add column if not exists schematic_version integer;
