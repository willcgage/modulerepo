-- #310 — a track no longer has a car capacity, so the column must not demand one.
--
-- Will's call, 2026-08-22: capacity belongs to the rail assigned to an INDUSTRY.
-- A plain track reports a physical usable length and no car count, and MR stopped
-- deriving `Math.round(inchesToScaleFeet(toPos - fromPos))` to fill this column.
--
-- ⛔ THAT CHANGE BROKE SAVING A NEW TRACK. `capacity_scale_feet` is NOT NULL with
-- no default, so an INSERT with nothing authored failed outright:
--
--     null value in column "capacity_scale_feet" of relation "module_tracks"
--     violates not-null constraint
--
-- which surfaced in the builder as a save that simply did not happen. The
-- constraint encoded the old model — that every track has a capacity — and that
-- premise is gone. NOT NULL is dropped rather than the app inventing a number to
-- satisfy it, which is the very thing #310 removed.
--
-- ⚠️ The CHECK stays as it is. In Postgres a CHECK passes when its expression is
-- NULL, so `capacity_scale_feet > 0` still rejects 0 and negatives while allowing
-- "not recorded" — exactly the distinction the app now makes.
--
-- Existing rows are untouched: owners' stored figures are deliberately left alone.

alter table public.module_tracks
  alter column capacity_scale_feet drop not null;

comment on column public.module_tracks.capacity_scale_feet is
  'Usable capacity in scale feet, as recorded by the owner. NULL = not recorded — '
  'the app does not derive one (#310). A car count belongs to the rail assigned to '
  'an industry, not to the track.';
