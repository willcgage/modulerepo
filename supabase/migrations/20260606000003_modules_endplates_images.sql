-- =============================================================================
-- Migration 003: freemon_modules, freemon_endplates, module_images
-- Module Repository — Milestone 1 v3.0
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FMN record_number sequence
-- Generates FMN-0001, FMN-0002, … (padded to 4 digits, grows past 9999)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS freemon_record_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

-- ---------------------------------------------------------------------------
-- freemon_modules  (core module record)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS freemon_modules (
    id                      SERIAL          PRIMARY KEY,
    record_number           VARCHAR(12)     NOT NULL UNIQUE,  -- FMN-XXXX; auto-generated
    module_name             VARCHAR(120)    NOT NULL,
    description             TEXT,
    owner_id                UUID            NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    category                VARCHAR(30)     NOT NULL REFERENCES module_categories(value),
    geometry_type           VARCHAR(20)     NOT NULL REFERENCES module_geometries(value),
    geometry_degrees        DECIMAL(5,2),
    geometry_offset_inches  DECIMAL(6,2),
    length_feet             SMALLINT        NOT NULL CHECK (length_feet >= 0),
    length_inches           SMALLINT        NOT NULL CHECK (length_inches BETWEEN 0 AND 11),
    endplate_count          SMALLINT        NOT NULL DEFAULT 0,   -- maintained by trigger
    has_mss                 BOOLEAN         NOT NULL DEFAULT false,
    mss_block_count         SMALLINT,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'inactive', 'archived')),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Geometry constraints
    CONSTRAINT chk_geometry_curve
        CHECK (
            geometry_type <> 'curve'
            OR (geometry_degrees IS NOT NULL AND geometry_degrees > 0)
        ),
    CONSTRAINT chk_geometry_offset
        CHECK (
            geometry_type <> 'offset'
            OR (geometry_offset_inches IS NOT NULL AND geometry_offset_inches <> 0)
        ),
    CONSTRAINT chk_geometry_no_extra_fields
        CHECK (
            geometry_type IN ('curve', 'offset')
            OR (geometry_degrees IS NULL AND geometry_offset_inches IS NULL)
        ),
    -- Curve may not also carry offset, and vice-versa
    CONSTRAINT chk_geometry_exclusive_fields
        CHECK (
            NOT (geometry_degrees IS NOT NULL AND geometry_offset_inches IS NOT NULL)
        ),

    -- MSS constraints
    CONSTRAINT chk_mss_false_no_count
        CHECK (has_mss = true OR mss_block_count IS NULL),
    CONSTRAINT chk_mss_true_has_count
        CHECK (has_mss = false OR (mss_block_count IS NOT NULL AND mss_block_count >= 1)),

    -- module_name unique per owner
    CONSTRAINT freemon_modules_name_owner_unique UNIQUE (owner_id, module_name)
);

-- owner_id is immutable after insert — enforced by trigger in 005
CREATE INDEX IF NOT EXISTS idx_freemon_modules_owner
    ON freemon_modules(owner_id);
CREATE INDEX IF NOT EXISTS idx_freemon_modules_status
    ON freemon_modules(status);
CREATE INDEX IF NOT EXISTS idx_freemon_modules_category
    ON freemon_modules(category);

-- ---------------------------------------------------------------------------
-- freemon_endplates  (one row per endplate on a module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS freemon_endplates (
    id               SERIAL          PRIMARY KEY,
    module_id        INTEGER         NOT NULL REFERENCES freemon_modules(id) ON DELETE CASCADE,
    endplate_number  SMALLINT        NOT NULL CHECK (endplate_number >= 1),
    label            VARCHAR(10)     NOT NULL,           -- EP-1, EP-2, …
    track_config     VARCHAR(10)     NOT NULL CHECK (track_config IN ('single', 'double')),
    width_inches     DECIMAL(5,2)    NOT NULL CHECK (width_inches > 0),
    height_inches    DECIMAL(5,2),                       -- NULL = standard grade
    notes            VARCHAR(255),

    CONSTRAINT freemon_endplates_unique UNIQUE (module_id, endplate_number)
);

CREATE INDEX IF NOT EXISTS idx_freemon_endplates_module
    ON freemon_endplates(module_id);

-- ---------------------------------------------------------------------------
-- module_images  (one-to-many photos per module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_images (
    id             SERIAL          PRIMARY KEY,
    module_id      INTEGER         NOT NULL REFERENCES freemon_modules(id) ON DELETE CASCADE,
    storage_path   TEXT            NOT NULL,             -- Supabase Storage path
    caption        VARCHAR(255),
    display_order  SMALLINT        NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT module_images_unique_order UNIQUE (module_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_module_images_module
    ON module_images(module_id);
