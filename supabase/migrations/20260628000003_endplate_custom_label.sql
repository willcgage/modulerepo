-- Allow module owners to give endplates meaningful names (e.g. "West", "East")
-- instead of the auto-generated "EP-1", "EP-2" labels.
--
-- Changes:
--   1. Increase the label length limit from 10 to 30 characters.
--   2. Modify fn_assign_endplate_label so it only fires on INSERT and only
--      when no label is explicitly provided, preserving user-supplied values
--      on both INSERT and UPDATE.

-- 1. Relax length constraint
ALTER TABLE freemon_endplates
  DROP CONSTRAINT chk_freemon_endplates_label_length;

ALTER TABLE freemon_endplates
  ADD CONSTRAINT chk_freemon_endplates_label_length
    CHECK (char_length(label) <= 30);

-- 2. Replace trigger function — skip auto-label when caller supplied one
CREATE OR REPLACE FUNCTION fn_assign_endplate_label()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.label IS NULL OR trim(NEW.label) = '' THEN
        NEW.label := 'EP-' || NEW.endplate_number;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Restrict trigger to INSERT only so UPDATE preserves user-set labels
DROP TRIGGER trg_freemon_endplates_label ON freemon_endplates;

CREATE TRIGGER trg_freemon_endplates_label
    BEFORE INSERT ON freemon_endplates
    FOR EACH ROW EXECUTE FUNCTION fn_assign_endplate_label();
