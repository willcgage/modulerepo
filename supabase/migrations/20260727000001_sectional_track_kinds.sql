-- Sectional straights and curves, and the kinds the library could never hold (#198).
--
-- ⚠️ THE `kind` CHECK ALLOWED FOUR VALUES while the application's type had
-- nine. An admin could not add a crossover, a length of flex, a bumper or any
-- sectional piece at all — the form simply had no way to say what they were.
-- The two lists have to agree, so this brings the constraint up to the type.
alter table public.track_parts
  drop constraint if exists track_parts_kind_check;

alter table public.track_parts
  add constraint track_parts_kind_check
  check (kind in (
    'turnout',
    'wye',
    'curved-turnout',
    'crossover',
    'crossing',
    'flex',
    'straight',
    'curve',
    'bumper'
  ));

-- A SECTIONAL CURVE'S OWN RADIUS, which is not one of a curved turnout's pair —
-- `outer_radius_inches`/`inner_radius_inches` are the two concentric routes of a
-- curved turnout, and calling a plain curve's radius "outer" would say there is
-- another one.
alter table public.track_parts
  add column if not exists radius_inches numeric check (radius_inches > 0);

-- How far the piece turns. Radius and arc are how curves are SOLD ("19in
-- radius, 30 degrees"), so they are what an owner can read off the box; the
-- length is the arc between them and is deliberately never stored, because a
-- chord recorded as a length would shorten every curve on the module.
alter table public.track_parts
  add column if not exists arc_degrees numeric
    check (arc_degrees > 0 and arc_degrees <= 360);

comment on column public.track_parts.radius_inches is
  'Sectional curve only: the single radius it is built to. Not a curved turnout''s pair.';
comment on column public.track_parts.arc_degrees is
  'Sectional curve only: how much of a circle the piece covers. Its length is the arc, derived.';
