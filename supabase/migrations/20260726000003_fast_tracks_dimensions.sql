-- Fast Tracks publish a DIFFERENT dimension set from Atlas — modulerepo#180.
--
-- Will Gage: "not every manufacturer has all the same numbers." Fast Tracks
-- state none of Atlas's three landmarks (points offset, frog V offset, lead)
-- and four things Atlas never state. The parts themselves live in the package's
-- built-ins (@willcgage/module-schematic 0.80.0) and need no rows here — a part
-- with no stored row simply resolves to its built-in.
--
-- ⛔ BUT THE COLUMNS ARE NOT OPTIONAL. `mergeStoredParts` replaces a built-in
-- WHOLESALE, so the moment an admin opens a Fast Tracks part at
-- /admin/track-parts and saves it, the row that comes back defines the part —
-- and any dimension with no column to live in is deleted. That is exactly how
-- both Atlas wyes were left looking unmeasured in production (see
-- 20260726000002). Adding the columns keeps the round-trip lossless.
--
--   minimum_length      the shortest the part can be BUILT. A Fast Tracks
--                       product is a fixture, so the modeller cuts the rail:
--                       overall_length is the maker's DEFAULT, not a property
--                       of the part, and this is the floor.
--   substitution_radius the plain-curve radius the turnout can stand in for.
--                       A layout-planning figure; nothing draws with it.
--   buildable           marks the part as a fixture/template rather than a
--                       finished product. Not cosmetic: it is what says the
--                       length is a choice, so nothing may infer where an
--                       owner's actual turnout ends from the default.
alter table track_parts
  add column if not exists minimum_length_inches numeric,
  add column if not exists minimum_length_source text,
  add column if not exists substitution_radius_inches numeric,
  add column if not exists substitution_radius_source text,
  add column if not exists buildable boolean not null default false;
