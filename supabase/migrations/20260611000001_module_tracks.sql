-- =============================================================================
-- Migration: module_tracks (spurs/sidings)
--
-- Introduces a module-scoped `module_tracks` table representing physical
-- spurs/sidings, each with its own capacity. A track can host multiple
-- industries. `freemon_industries.track_id` is a nullable FK: NULL means the
-- industry is served directly off the mainline (no dedicated spur).
--
-- Replaces the per-industry `spur_capacity_scale_feet` column, which
-- incorrectly assumed every industry has its own spur with its own capacity.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- module_tracks  (one row per physical spur/siding on a module)
-- ---------------------------------------------------------------------------
CREATE TABLE module_tracks (
    id                  SERIAL          PRIMARY KEY,
    module_id           INTEGER         NOT NULL REFERENCES freemon_modules(id) ON DELETE CASCADE,
    track_number        SMALLINT        NOT NULL CHECK (track_number >= 1),
    label               VARCHAR(10)     NOT NULL,       -- TRK-1, TRK-2, …
    track_name          VARCHAR(120),
    capacity_scale_feet SMALLINT        NOT NULL CHECK (capacity_scale_feet > 0),
    notes               VARCHAR(500),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT module_tracks_unique UNIQUE (module_id, track_number),
    CONSTRAINT module_tracks_id_module_unique UNIQUE (id, module_id)
);

CREATE INDEX idx_module_tracks_module
    ON module_tracks(module_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, auto-assign track_number, auto-derive label,
-- renumber after delete (mirrors freemon_industries patterns)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_module_tracks_updated_at
    BEFORE UPDATE ON module_tracks
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE FUNCTION fn_assign_track_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    next_num SMALLINT;
BEGIN
    SELECT COALESCE(MAX(track_number), 0) + 1
    INTO next_num
    FROM module_tracks
    WHERE module_id = NEW.module_id;

    NEW.track_number := next_num;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_module_tracks_assign_number
    BEFORE INSERT ON module_tracks
    FOR EACH ROW EXECUTE FUNCTION fn_assign_track_number();

CREATE OR REPLACE FUNCTION fn_assign_track_label()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.label := 'TRK-' || NEW.track_number;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_module_tracks_label
    BEFORE INSERT OR UPDATE OF track_number ON module_tracks
    FOR EACH ROW EXECUTE FUNCTION fn_assign_track_label();

CREATE OR REPLACE FUNCTION fn_renumber_tracks()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY track_number) AS new_num
        FROM module_tracks
        WHERE module_id = OLD.module_id
    )
    UPDATE module_tracks mt
    SET track_number = ranked.new_num,
        label         = 'TRK-' || ranked.new_num
    FROM ranked
    WHERE mt.id = ranked.id
      AND (mt.track_number <> ranked.new_num);

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_module_tracks_renumber
    AFTER DELETE ON module_tracks
    FOR EACH ROW EXECUTE FUNCTION fn_renumber_tracks();

-- ---------------------------------------------------------------------------
-- RLS — same 5-policy pattern as freemon_endplates / freemon_industries
-- ---------------------------------------------------------------------------
ALTER TABLE module_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_module_tracks_active_modules"
    ON module_tracks FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_tracks.module_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "owner_read_own_module_tracks"
    ON module_tracks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_tracks.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_read_all_module_tracks"
    ON module_tracks FOR SELECT
    TO authenticated
    USING (fn_is_admin());

CREATE POLICY "owner_write_module_tracks"
    ON module_tracks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_tracks.module_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_tracks.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_write_module_tracks"
    ON module_tracks FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ---------------------------------------------------------------------------
-- freemon_industries: add nullable track_id (NULL = mainline-served)
-- ---------------------------------------------------------------------------
ALTER TABLE freemon_industries
    ADD COLUMN track_id INTEGER NULL,
    ADD CONSTRAINT fk_industries_track
        FOREIGN KEY (track_id, module_id) REFERENCES module_tracks(id, module_id)
        ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Data migration: give every existing industry its own track, preserving its
-- former spur_capacity_scale_feet as that track's capacity. Owners can later
-- consolidate multiple industries onto one track via the UI.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    industry_record RECORD;
    new_track_id INTEGER;
BEGIN
    FOR industry_record IN
        SELECT id, module_id, spur_capacity_scale_feet
        FROM freemon_industries
        ORDER BY module_id, industry_number
    LOOP
        INSERT INTO module_tracks (module_id, capacity_scale_feet)
        VALUES (industry_record.module_id, industry_record.spur_capacity_scale_feet)
        RETURNING id INTO new_track_id;

        UPDATE freemon_industries
        SET track_id = new_track_id
        WHERE id = industry_record.id;
    END LOOP;
END;
$$;

ALTER TABLE freemon_industries
    DROP COLUMN spur_capacity_scale_feet;
