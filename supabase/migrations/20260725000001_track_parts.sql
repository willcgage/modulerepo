-- THE track/turnout parts library — the physical parts a module's geometry is
-- drawn from. Not a second library beside the built-in one: the package's
-- ATLAS_CODE55_N parts are SEEDED here, so there is a single list an admin sees
-- and edits, including correcting a built-in.
--
-- The package constant stays as the compiled-in floor (Free-Dispatcher and the
-- pure geometry functions have no database), but where a slug exists in both,
-- this table wins — otherwise a part could only be corrected by shipping a
-- release, which is the limitation this removes.
--
-- ⚠️ POSITIONS, NOT SPANS. points_offset and frog_offset are both measured from
-- the SAME end of the tie strip, and the lead is their difference. A lead
-- entered directly cannot be cross-checked; two positions can, and that check is
-- what caught a bad reading which had already shipped in two releases. The frog
-- position means the APEX OF THE V, not the end of the casting — on a shallow
-- #10 those are ¾″ apart, and that exact confusion put a wrong #10 lead into the
-- library and spawned a whole false model.
--
-- ⚠️ Every dimension records WHERE IT CAME FROM. A derived number that looks
-- like a spec is how bad geometry becomes permanent. Only `measured` dimensions
-- are allowed to draw a part's real extent.
create table if not exists track_parts (
  id bigint generated always as identity primary key,
  -- Matches the package's TrackPart.id, e.g. "atlas-c55-n-7" — the join between
  -- this table and the built-ins.
  slug text not null unique,
  manufacturer text not null,
  line text not null,
  scale text not null default 'N',
  name text not null,
  kind text not null default 'turnout'
    check (kind in ('turnout', 'wye', 'curved-turnout', 'crossing')),

  -- The number MOULDED INTO THE PART — the only reliable identifier. Inferring a
  -- frog number from a part's length does not work: the Atlas #5 and #7 are both
  -- 6.00″ end to end.
  part_number_left text,
  part_number_right text,
  part_number_single text,
  frog_number numeric,

  -- Tie end → the point tips.
  points_offset_inches numeric check (points_offset_inches >= 0),
  -- Tie end → the APEX of the frog V, from the SAME end as points_offset.
  frog_offset_inches numeric check (frog_offset_inches >= 0),
  -- End tie to end tie.
  overall_length_inches numeric check (overall_length_inches > 0),
  -- Points → frog. Normally the difference of the two offsets; stored only for a
  -- part whose offsets aren't known (the wye).
  lead_inches numeric check (lead_inches > 0),
  -- Curved turnouts: the two concentric radii.
  outer_radius_inches numeric check (outer_radius_inches > 0),
  inner_radius_inches numeric check (inner_radius_inches > 0),
  -- The angle the part ACTUALLY diverges at, where that differs from atan(1/N).
  actual_angle_deg numeric,

  -- Provenance, one per dimension. Mirrors DimensionSource in the package.
  points_offset_source text check (points_offset_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  frog_offset_source text check (frog_offset_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  overall_length_source text check (overall_length_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  lead_source text check (lead_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  radius_source text check (radius_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  actual_angle_source text check (actual_angle_source in ('manufacturer', 'measured', 'derived', 'unverified')),
  -- Who measured it and how, so it can be re-checked.
  measurement_note text,

  -- A submitted part enters unreviewed and is promoted deliberately; only
  -- `active` parts are read by the app.
  status text not null default 'active'
    check (status in ('active', 'pending_review', 'inactive')),
  submitted_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The frog must sit between the points and the end of the part, or the drawn
  -- turnout is not a turnout. Cheap, and it catches a landmark read off the
  -- wrong feature — which is a mistake this library has actually made.
  constraint track_parts_frog_after_points check (
    points_offset_inches is null or frog_offset_inches is null
    or frog_offset_inches > points_offset_inches
  ),
  constraint track_parts_frog_within_part check (
    overall_length_inches is null or frog_offset_inches is null
    or frog_offset_inches < overall_length_inches
  )
);

create index if not exists track_parts_status_idx on track_parts (status);
create index if not exists track_parts_frog_idx on track_parts (frog_number);

alter table track_parts enable row level security;

-- Reference data: everyone reads the active library, because every renderer
-- needs it to draw a turnout.
drop policy if exists public_read_active_track_parts on track_parts;
create policy public_read_active_track_parts on track_parts
  for select using (status = 'active');

drop policy if exists admin_read_all_track_parts on track_parts;
create policy admin_read_all_track_parts on track_parts
  for select using (fn_is_admin());

drop policy if exists admin_manage_track_parts on track_parts;
create policy admin_manage_track_parts on track_parts
  for all using (fn_is_admin()) with check (fn_is_admin());

-- ---------------------------------------------------------------------------
-- Seed: the built-in Atlas code 55 parts, so this table IS the library rather
-- than an addition to it. Values and provenance carried over verbatim from
-- ATLAS_CODE55_N; re-running is a no-op.
-- ---------------------------------------------------------------------------
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
  ('atlas-c55-n-5', 'Atlas', 'Code 55', 'N', '#5 Turnout', 'turnout', '2050', '2051', null, 5,
   1.75, 'measured', 4.75, 'measured', 6.0, 'measured', 3.0, 'measured', null, null, null, 11.25, 'unverified',
   'Will Gage, physical Atlas 2050 (#5). Tie end to point tips 1 3/4"; tie end to the APEX of the V 4 3/4"; 6.00" end tie to end tie. The 3.00" lead refuted both standing models. 11.25 deg is exactly 1/32 of a circle - Atlas build to sectional angles, not true frog ratios.'),
  ('atlas-c55-n-7', 'Atlas', 'Code 55', 'N', '#7 Turnout', 'turnout', '2052', '2053', null, 7,
   0.625, 'measured', 4.21875, 'measured', 6.0, 'measured', 3.59375, 'measured', null, null, null, 8.13, 'unverified',
   'Will Gage, physical Atlas 2052 (#7). Tie end to point tips 10/16"; tie end to the apex of the V 4 7/32"; 6.00" overall - the SAME 6" as the #5, which is what proves length is not a function of frog number. Supersedes Steve Branton''s 3 3/8" lead, the library''s founding measurement, which was 7/32" short. Angle disputed between sources, so theory atan(1/7) is used.'),
  ('atlas-c55-n-10', 'Atlas', 'Code 55', 'N', '#10 Turnout', 'turnout', '2054', '2055', null, 10,
   0.5625, 'measured', 5.5, 'measured', 8.0, 'measured', 4.9375, 'measured', null, null, null, 5.74, 'unverified',
   'Will Gage, physical Atlas 2054 (#10). Tie end to point tips 9/16"; tie end to the apex of the V 5 1/2"; 8.00" overall. The lead was CORRECTED from 4 3/16", which had been read to the END OF THE FROG CASTING - a #10 V is shallow, so its apex is 3/4" back from that. Angle corroborated by XTrkCAD and the AnyRail forum, which agree with each other and not with theory.'),
  ('atlas-c55-n-wye', 'Atlas', 'Code 55', 'N', '#2.5 Wye', 'wye', null, null, '2056', 2.5,
   null, null, null, null, null, null, 1.205, 'derived', null, null, null, null, null,
   'NOT MEASURED. The lead is scaled from a per-frog rule that has since been refuted, so it rests on nothing - this part is the library''s known gap. Nobody has put a rule against a physical 2056 yet.'),
  ('atlas-c55-n-curved-21-15', 'Atlas', 'Code 55', 'N', 'Curved Turnout 21.25 / 15', 'curved-turnout', '2058', '2059', null, null,
   null, null, null, null, null, null, null, null, 21.25, 15, 'manufacturer', null, null,
   'Radii from the Atlas product listing. No tie dimensions known.')
on conflict (slug) do nothing;
