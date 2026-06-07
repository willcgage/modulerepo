-- =============================================================================
-- Migration 001: Lookup Tables + Seed Data
-- Module Repository — Milestone 1 v3.0
-- Tables: module_standards, module_categories, module_geometries,
--         industry_types, rail_car_types
-- =============================================================================

-- ---------------------------------------------------------------------------
-- module_standards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_standards (
    id          SERIAL PRIMARY KEY,
    value       VARCHAR(20)  NOT NULL UNIQUE,
    display_label VARCHAR(60) NOT NULL,
    record_prefix VARCHAR(10) NOT NULL UNIQUE,   -- e.g. 'FMN'
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO module_standards (value, display_label, record_prefix) VALUES
    ('freemon', 'Free-moN', 'FMN');

-- ---------------------------------------------------------------------------
-- module_categories  (operational category)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_categories (
    value         VARCHAR(30) PRIMARY KEY,
    display_label VARCHAR(60) NOT NULL
);

INSERT INTO module_categories (value, display_label) VALUES
    ('yard',            'Yard'),
    ('industry_spur',   'Industry / Spur'),
    ('siding_passing',  'Siding / Passing'),
    ('interchange',     'Interchange'),
    ('scenic',          'Scenic / No Industry'),
    ('other',           'Other');

-- ---------------------------------------------------------------------------
-- module_geometries  (physical shape)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_geometries (
    value           VARCHAR(20) PRIMARY KEY,
    display_label   VARCHAR(40) NOT NULL,
    requires_degrees        BOOLEAN NOT NULL DEFAULT false,
    requires_offset_inches  BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO module_geometries
    (value, display_label, requires_degrees, requires_offset_inches)
VALUES
    ('straight',   'Straight',          false, false),
    ('curve',      'Curve',             true,  false),
    ('offset',     'Offset',            false, true),
    ('corner_45',  'Corner (45°)',      false, false),
    ('corner_90',  'Corner (90°)',      false, false),
    ('wye',        'Wye / Junction',    false, false),
    ('dead_end',   'Dead End / Bumper', false, false),
    ('other',      'Other',             false, false);

-- ---------------------------------------------------------------------------
-- industry_types  (admin-managed controlled list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS industry_types (
    value         VARCHAR(40) PRIMARY KEY,
    display_label VARCHAR(60) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO industry_types (value, display_label) VALUES
    ('lumber_yard',             'Lumber Yard'),
    ('grain_elevator',          'Grain Elevator'),
    ('fuel_oil_depot',          'Fuel / Oil Depot'),
    ('coal_mine_tipple',        'Coal Mine / Tipple'),
    ('sawmill',                 'Sawmill'),
    ('factory_manufacturing',   'Factory / Manufacturing'),
    ('warehouse_distribution',  'Warehouse / Distribution'),
    ('farm_agricultural',       'Farm / Agricultural'),
    ('food_processing',         'Food Processing'),
    ('paper_mill',              'Paper Mill'),
    ('steel_mill_foundry',      'Steel Mill / Foundry'),
    ('chemical_plant',          'Chemical Plant'),
    ('intermodal_container',    'Intermodal / Container Facility'),
    ('passenger_station',       'Passenger Station'),
    ('other',                   'Other');

-- ---------------------------------------------------------------------------
-- rail_car_types  (controlled list with suggestion workflow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rail_car_types (
    id                SERIAL PRIMARY KEY,
    value             VARCHAR(40)  NOT NULL UNIQUE,
    display_label     VARCHAR(60)  NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'pending_review', 'inactive')),
    suggested_by      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    suggestion_notes  VARCHAR(255),
    reviewed_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- value is immutable after first use (enforced via trigger in 005)
    CONSTRAINT rail_car_types_value_not_empty CHECK (char_length(trim(value)) > 0)
);

-- Admin-added seed data (status = active, no suggestion fields)
INSERT INTO rail_car_types (value, display_label, status) VALUES
    ('boxcar',          'Boxcar',                   'active'),
    ('flatcar',         'Flatcar',                  'active'),
    ('gondola',         'Gondola',                  'active'),
    ('hopper',          'Hopper',                   'active'),
    ('tank_car',        'Tank Car',                 'active'),
    ('reefer',          'Refrigerator Car (Reefer)', 'active'),
    ('auto_rack',       'Auto Rack',                'active'),
    ('covered_hopper',  'Covered Hopper',           'active'),
    ('coal_hopper',     'Coal Hopper',              'active'),
    ('log_car',         'Log Car',                  'active'),
    ('ore_car',         'Ore Car',                  'active'),
    ('passenger_car',   'Passenger Car',            'active'),
    ('caboose',         'Caboose',                  'active'),
    ('other',           'Other',                    'active');
