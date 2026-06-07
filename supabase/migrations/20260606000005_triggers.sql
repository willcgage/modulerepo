-- =============================================================================
-- Migration 005: Triggers
-- Module Repository — Milestone 1 v3.0
--
-- Triggers implemented:
--   1. set_updated_at          — updates updated_at on any row change
--   2. generate_record_number  — auto-generates FMN-XXXX on insert
--   3. immutable_owner_id      — prevents owner_id from being changed
--   4. sync_endplate_count     — keeps freemon_modules.endplate_count accurate
--   5. assign_industry_number  — auto-assigns industry_number on insert
--   6. renumber_industries     — renumbers remaining industries after delete
--   7. assign_endplate_label   — auto-derives EP-N label from endplate_number
--   8. assign_industry_label   — auto-derives IND-N label from industry_number
--   9. immutable_car_type_value — prevents rail_car_types.value from changing
--      after first use (i.e. once at least one freemon_industry_car_types
--      row references this car type)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generic updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_modules_updated_at
    BEFORE UPDATE ON freemon_modules
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_freemon_industries_updated_at
    BEFORE UPDATE ON freemon_industries
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_owner_profiles_updated_at
    BEFORE UPDATE ON owner_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Auto-generate FMN-XXXX record_number on insert
--    Format: FMN- followed by zero-padded sequence number (min 4 digits)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_freemon_record_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('freemon_record_number_seq');
    NEW.record_number := 'FMN-' || lpad(seq_val::text, 4, '0');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_modules_record_number
    BEFORE INSERT ON freemon_modules
    FOR EACH ROW EXECUTE FUNCTION fn_generate_freemon_record_number();

-- ---------------------------------------------------------------------------
-- 3. Prevent owner_id from changing after insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_immutable_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.owner_id <> OLD.owner_id THEN
        RAISE EXCEPTION 'owner_id is immutable after insert';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_modules_immutable_owner
    BEFORE UPDATE OF owner_id ON freemon_modules
    FOR EACH ROW EXECUTE FUNCTION fn_immutable_owner_id();

-- ---------------------------------------------------------------------------
-- 4. Sync endplate_count on freemon_modules
--    Increments on endplate INSERT, decrements on DELETE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_endplate_count()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE freemon_modules
        SET endplate_count = endplate_count + 1
        WHERE id = NEW.module_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE freemon_modules
        SET endplate_count = endplate_count - 1
        WHERE id = OLD.module_id;
    END IF;
    RETURN NULL;  -- AFTER trigger; return value ignored
END;
$$;

CREATE TRIGGER trg_freemon_endplates_sync_count
    AFTER INSERT OR DELETE ON freemon_endplates
    FOR EACH ROW EXECUTE FUNCTION fn_sync_endplate_count();

-- ---------------------------------------------------------------------------
-- 5. Auto-assign industry_number on INSERT
--    Picks max(industry_number) + 1 for the module, starting at 1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assign_industry_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    next_num SMALLINT;
BEGIN
    SELECT COALESCE(MAX(industry_number), 0) + 1
    INTO next_num
    FROM freemon_industries
    WHERE module_id = NEW.module_id;

    NEW.industry_number := next_num;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_industries_assign_number
    BEFORE INSERT ON freemon_industries
    FOR EACH ROW EXECUTE FUNCTION fn_assign_industry_number();

-- ---------------------------------------------------------------------------
-- 6. Renumber industries after DELETE
--    Closes gaps so industry_number stays 1, 2, 3… with no holes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_renumber_industries()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- Re-sequence remaining rows for the module in creation order
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY industry_number) AS new_num
        FROM freemon_industries
        WHERE module_id = OLD.module_id
    )
    UPDATE freemon_industries fi
    SET industry_number = ranked.new_num,
        label           = 'IND-' || ranked.new_num
    FROM ranked
    WHERE fi.id = ranked.id
      AND (fi.industry_number <> ranked.new_num);

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_freemon_industries_renumber
    AFTER DELETE ON freemon_industries
    FOR EACH ROW EXECUTE FUNCTION fn_renumber_industries();

-- ---------------------------------------------------------------------------
-- 7. Auto-derive endplate label: 'EP-' || endplate_number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assign_endplate_label()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.label := 'EP-' || NEW.endplate_number;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_endplates_label
    BEFORE INSERT OR UPDATE OF endplate_number ON freemon_endplates
    FOR EACH ROW EXECUTE FUNCTION fn_assign_endplate_label();

-- ---------------------------------------------------------------------------
-- 8. Auto-derive industry label: 'IND-' || industry_number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assign_industry_label()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.label := 'IND-' || NEW.industry_number;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freemon_industries_label
    BEFORE INSERT OR UPDATE OF industry_number ON freemon_industries
    FOR EACH ROW EXECUTE FUNCTION fn_assign_industry_label();

-- ---------------------------------------------------------------------------
-- 9. Prevent rail_car_types.value from changing once in use
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_immutable_car_type_value()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.value <> OLD.value THEN
        -- Allow change only if no industry references this car type
        IF EXISTS (
            SELECT 1 FROM freemon_industry_car_types
            WHERE car_type_id = OLD.id
            LIMIT 1
        ) THEN
            RAISE EXCEPTION
                'rail_car_types.value is immutable once referenced by an industry';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rail_car_types_immutable_value
    BEFORE UPDATE OF value ON rail_car_types
    FOR EACH ROW EXECUTE FUNCTION fn_immutable_car_type_value();
