-- Replace the two-column length representation (length_feet SMALLINT +
-- length_inches SMALLINT) with a single length_total_inches DECIMAL(7,3)
-- that supports fractional inches (e.g. 1.375") and total-inches entry.
-- Also adds an optional mainline_length_inches column for cases where the
-- mainline track through a module is a different length than the module's
-- physical footprint (e.g. a curve whose chord length ≠ arc length).

-- 1. Add new columns
ALTER TABLE freemon_modules
  ADD COLUMN length_total_inches  DECIMAL(7,3),
  ADD COLUMN mainline_length_inches DECIMAL(7,3);

-- 2. Migrate existing data (length_feet * 12 + length_inches)
UPDATE freemon_modules
  SET length_total_inches = (length_feet * 12.0) + length_inches;

-- 3. Enforce NOT NULL and positivity on the footprint column
ALTER TABLE freemon_modules
  ALTER COLUMN length_total_inches SET NOT NULL;

ALTER TABLE freemon_modules
  ADD CONSTRAINT chk_length_total_inches_positive
    CHECK (length_total_inches > 0);

ALTER TABLE freemon_modules
  ADD CONSTRAINT chk_mainline_length_inches_positive
    CHECK (mainline_length_inches IS NULL OR mainline_length_inches > 0);

-- 4. Drop old columns (constraints/indexes referencing them are dropped automatically)
ALTER TABLE freemon_modules
  DROP COLUMN length_feet,
  DROP COLUMN length_inches;
