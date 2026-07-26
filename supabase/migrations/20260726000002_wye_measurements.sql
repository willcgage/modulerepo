-- Both Atlas Code 55 wyes measured off the physical parts (Will Gage,
-- 2026-07-26) — modulerepo#180.
--
-- ⛔ WHY THIS MIGRATION IS THE POINT, not a footnote to the package release.
-- `mergeStoredParts` replaces a built-in WHOLESALE, and both wyes already had
-- rows here carrying null offsets from the original seed. Measuring them in
-- @willcgage/module-schematic 0.78.0 therefore changed nothing in production:
-- the stored rows kept winning, the parts kept looking unmeasured, and the
-- 2056 kept serving the `derived` 1.205" lead the release had just retired.
-- Nothing errored. It simply had no effect.
--
--     wye           points    frog V     overall   lead        past frog
--     #2.5 (2056)   1 5/8"    4 1/8"     6.50"     2.50000"    2.375"
--     #3.5 (2057)   3/4"      3 5/32"    5.00"     2.40625"    1.84375"
--
-- The lead is NOT stored as an independent datum: storedPartToTrackPart derives
-- it from the two offsets whenever both are present, because they are read from
-- the same tie end and their difference is the lead by construction. The
-- lead_inches values below are written only so the column stops disagreeing
-- with the positions it is meant to summarise.

-- Frog apex -> end of the diverging rail, measured ALONG that rail. A
-- FALSIFIER, not a source: it must exceed the axial (overall - frog), so a
-- reading that makes that difference negative means a mis-read frog. That is
-- exactly how the 2057's first frog reading (5 5/32", past its own 5" end) was
-- caught. Too insensitive to recover an angle from — at these angles 1/32" of
-- slop swings the implied half-angle by 6 degrees.
alter table track_parts
  add column if not exists diverging_length_inches numeric,
  add column if not exists diverging_length_source text;

update track_parts set
  points_offset_inches   = 1.625,
  points_offset_source   = 'measured',
  frog_offset_inches     = 4.125,
  frog_offset_source     = 'measured',
  overall_length_inches  = 6.5,
  overall_length_source  = 'measured',
  diverging_length_inches = 2.4375,
  diverging_length_source = 'measured',
  lead_inches            = 2.5,
  lead_source            = 'measured',
  measurement_note       = 'Will Gage, physical Atlas 2056, 2026-07-26. Points 1 5/8", '
                        || 'frog V 4 1/8", overall 6 1/2", each diverging rail 2 7/16". '
                        || 'Lead 2.5" is the difference of the two offsets. RETIRES a '
                        || 'derived 1.205" — the per-frog rule was off by more than 2x, '
                        || 'its worst showing yet.',
  updated_at             = now()
where slug = 'atlas-c55-n-wye';

update track_parts set
  points_offset_inches   = 0.75,
  points_offset_source   = 'measured',
  frog_offset_inches     = 3.15625,
  frog_offset_source     = 'measured',
  overall_length_inches  = 5,
  overall_length_source  = 'measured',
  diverging_length_inches = 1.9375,
  diverging_length_source = 'measured',
  lead_inches            = 2.40625,
  lead_source            = 'measured',
  measurement_note       = 'Will Gage, physical Atlas 2057, 2026-07-26. Points 3/4", '
                        || 'frog V 3 5/32", overall 5", each diverging rail 1 30/32". '
                        || 'The frog is a RE-READ: it first came in at 5 5/32", which is '
                        || 'past the part''s own 5" end, and the diverging rail plus the '
                        || 'points+lead sum both said ~3 1/8". Lead 2.40625" is the '
                        || 'difference of the two offsets.',
  updated_at             = now()
where slug = 'atlas-c55-n-wye-35';
