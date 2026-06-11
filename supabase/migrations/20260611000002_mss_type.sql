-- Replace mss_block_count with mss_type: a categorization of the module's
-- role within the Modular Signal System (crossover vs. cascade/signal
-- module). Only meaningful when has_mss = true; the wizard/edit form ask
-- for it conditionally but it is not required.
ALTER TABLE freemon_modules
    DROP CONSTRAINT IF EXISTS chk_mss_false_no_count;

ALTER TABLE freemon_modules
    DROP COLUMN IF EXISTS mss_block_count;

ALTER TABLE freemon_modules
    ADD COLUMN mss_type VARCHAR(20),
    ADD CONSTRAINT chk_mss_type_values
        CHECK (mss_type IS NULL OR mss_type IN ('crossover', 'cascade')),
    ADD CONSTRAINT chk_mss_false_no_type
        CHECK (has_mss = true OR mss_type IS NULL);

-- Demo data: give the two existing MSS-equipped seed modules an example type.
UPDATE freemon_modules SET mss_type = 'crossover' WHERE record_number = 'FMN-0002';
UPDATE freemon_modules SET mss_type = 'cascade' WHERE record_number = 'FMN-0005';
