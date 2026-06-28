-- Expand geometry_degrees to 3 decimal places (was 2) and restrict curve
-- modules to the valid range 1–359 degrees.

ALTER TABLE freemon_modules
  ALTER COLUMN geometry_degrees TYPE DECIMAL(6,3);

ALTER TABLE freemon_modules
  DROP CONSTRAINT chk_geometry_curve,
  ADD CONSTRAINT chk_geometry_curve CHECK (
    geometry_type <> 'curve'
    OR (
      geometry_degrees IS NOT NULL
      AND geometry_degrees >= 1
      AND geometry_degrees <= 359
    )
  );
