-- =============================================================================
-- Migration: module_schematics
-- Module Repository — schematic / CAD drawing attachments
--
-- One-to-many drawing files per module (DWG, DXF, model-railroad CAD formats,
-- and PDF exports). Mirrors the module_images table and its RLS so ownership,
-- admin access, and public read of active modules behave identically.
--
-- Files live in the `module-schematics` Storage bucket; storage.objects RLS
-- is defined in the companion migration 20260624000002.
-- Path convention: {module_id}/{uuid}-{filename}
-- =============================================================================

-- ---------------------------------------------------------------------------
-- module_schematics  (one-to-many drawing files per module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_schematics (
    id             SERIAL          PRIMARY KEY,
    module_id      INTEGER         NOT NULL REFERENCES freemon_modules(id) ON DELETE CASCADE,
    storage_path   TEXT            NOT NULL,             -- Supabase Storage path
    file_name      TEXT            NOT NULL,             -- original filename, shown for download
    file_format    VARCHAR(20)     NOT NULL DEFAULT 'other'
                       CHECK (file_format IN (
                           'dwg',       -- AutoCAD
                           'dxf',       -- Drawing Interchange Format
                           'anyrail',   -- AnyRail (.any)
                           'scarm',     -- SCARM (.scarm)
                           'xtrackcad', -- XTrackCAD (.xtc / .trk)
                           'templot',   -- Templot (.box)
                           'railmodeller', -- RailModeller (.rmz)
                           'thirdplanit',  -- 3rd PlanIt (.3pi)
                           'pdf',       -- PDF export
                           'other'
                       )),
    caption        VARCHAR(255),
    display_order  SMALLINT        NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT module_schematics_unique_order UNIQUE (module_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_module_schematics_module
    ON module_schematics(module_id);

-- ---------------------------------------------------------------------------
-- Row-level security (same ownership model as module_images, see migration 006)
-- ---------------------------------------------------------------------------
ALTER TABLE module_schematics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_schematics_active_modules"
    ON module_schematics FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_schematics.module_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "owner_read_own_schematics"
    ON module_schematics FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_schematics.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_read_all_schematics"
    ON module_schematics FOR SELECT
    TO authenticated
    USING (fn_is_admin());

CREATE POLICY "owner_write_schematics"
    ON module_schematics FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_schematics.module_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_schematics.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_write_schematics"
    ON module_schematics FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());
