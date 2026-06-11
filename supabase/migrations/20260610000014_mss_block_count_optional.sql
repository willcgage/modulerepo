-- MSS block count is hidden in the UI for now (pending further research into
-- how Modular Signal System block counts should be modeled), so it's no
-- longer required when has_mss = true.
ALTER TABLE freemon_modules
    DROP CONSTRAINT IF EXISTS chk_mss_true_has_count;
