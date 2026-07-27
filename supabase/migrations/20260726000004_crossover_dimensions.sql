-- Crossovers are an ASSEMBLY, and carry dimensions no single turnout has —
-- modulerepo#180. Parts themselves live in the package built-ins
-- (@willcgage/module-schematic 0.81.0); these columns exist so that an admin
-- edit round-trips losslessly, because `mergeStoredParts` replaces a built-in
-- WHOLESALE and any dimension with nowhere to live is deleted on save (see
-- 20260726000002 for the incident that established this).
--
--   track_spacing         centre-to-centre of the two parallel tracks the
--                         crossover joins. ⚠️ A crossover fixture is machined
--                         for ONE spacing and is not adjustable, so this
--                         decides whether the part suits a standard at all.
--                         The Fast Tracks N crossovers build to 1.09" while
--                         Free-moN §2.0 requires 1.125" — 0.035" tighter. That
--                         is recorded as a fact about the product, not
--                         reconciled: the endplates fix 1.125" at both ends, so
--                         the tracks pinch through the crossover and open back
--                         out, and a builder is better served by the true
--                         number than a convenient one.
--
--   secondary_frog_angle  the SECOND frog on a part that has two — the diamond
--                         where the diagonals of a scissors crossover meet.
--                         Published as twice the first angle (19° for the #6,
--                         14.3° for the #8), which is what two diagonals each
--                         leaving at the frog angle must make, and is therefore
--                         a free cross-check on the pair.
alter table track_parts
  add column if not exists track_spacing_inches numeric,
  add column if not exists track_spacing_source text,
  add column if not exists secondary_frog_angle_deg numeric,
  add column if not exists secondary_frog_angle_source text;
