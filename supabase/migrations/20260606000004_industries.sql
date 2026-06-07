-- =============================================================================
-- Migration 004: freemon_industries, freemon_industry_car_types
-- Module Repository — Milestone 1 v3.0
-- =============================================================================

-- ---------------------------------------------------------------------------
-- freemon_industries  (one row per industry on a module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS freemon_industries (
    id                       SERIAL          PRIMARY KEY,
    module_id                INTEGER         NOT NULL REFERENCES freemon_modules(id) ON DELETE CASCADE,
    industry_number          SMALLINT        NOT NULL CHECK (industry_number >= 1),
    label                    VARCHAR(10)     NOT NULL,       -- IND-1, IND-2, …
    industry_name            VARCHAR(120)    NOT NULL,
    industry_type            VARCHAR(40)     NOT NULL REFERENCES industry_types(value),
    spur_capacity_scale_feet SMALLINT        NOT NULL CHECK (spur_capacity_scale_feet > 0),
    notes                    VARCHAR(500),
    created_at               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT freemon_industries_unique UNIQUE (module_id, industry_number)
);

CREATE INDEX IF NOT EXISTS idx_freemon_industries_module
    ON freemon_industries(module_id);

-- ---------------------------------------------------------------------------
-- freemon_industry_car_types  (junction: industry ↔ rail_car_types)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS freemon_industry_car_types (
    id           SERIAL      PRIMARY KEY,
    industry_id  INTEGER     NOT NULL REFERENCES freemon_industries(id) ON DELETE CASCADE,
    car_type_id  INTEGER     NOT NULL REFERENCES rail_car_types(id) ON DELETE RESTRICT,
    notes        VARCHAR(255),

    CONSTRAINT freemon_industry_car_types_unique UNIQUE (industry_id, car_type_id)
);

CREATE INDEX IF NOT EXISTS idx_freemon_industry_car_types_industry
    ON freemon_industry_car_types(industry_id);
CREATE INDEX IF NOT EXISTS idx_freemon_industry_car_types_car_type
    ON freemon_industry_car_types(car_type_id);
