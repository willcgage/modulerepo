-- The SECOND Atlas Code 55 wye.
--
-- Will Gage, 2026-07-26: "2057 is 3.5, 2056 is 2.5". The two moulded numbers are
-- different FROG NUMBERS, not a left/right pair of one part — a wye has no hand,
-- both legs diverge. The 2056 half of that confirms the row seeded in
-- 20260725000001; this is the part the library didn't have at all.
--
-- NO DIMENSIONS. We know which part it is and nothing else. That is deliberately
-- recorded as absence rather than as a derived figure: the #2.5's lead is scaled
-- from a per-frog rule that has since been refuted, and repeating that here would
-- turn one unchecked number into two. Absent, the renderer interpolates across
-- the MEASURED parts at the wye's effective frog (3.5 x 2 = 7), which lands on
-- the measured #7 rather than on a guess.
--
-- Positions to fill in, all from the SAME tie end: tie end -> point tips, tie end
-- -> the APEX OF THE V (not the end of the casting), and overall length.
insert into track_parts (
  slug, manufacturer, line, scale, name, kind,
  part_number_left, part_number_right, part_number_single, frog_number,
  points_offset_inches, points_offset_source,
  frog_offset_inches, frog_offset_source,
  overall_length_inches, overall_length_source,
  lead_inches, lead_source,
  outer_radius_inches, inner_radius_inches, radius_source,
  actual_angle_deg, actual_angle_source,
  measurement_note
) values
  ('atlas-c55-n-wye-35', 'Atlas', 'Code 55', 'N', '#3.5 Wye', 'wye', null, null, '2057', 3.5,
   null, null, null, null, null, null, null, null, null, null, null, null, null,
   'NOT MEASURED. Identified by Will Gage 2026-07-26 ("2057 is 3.5, 2056 is 2.5") - the frog number is the only thing known about this part. No lead is recorded on purpose: the #2.5 wye''s is derived from a rule that has since been refuted, so a matching figure here would rest on nothing. Needs three positions from the same tie end - point tips, apex of the V, overall length.')
on conflict (slug) do nothing;
