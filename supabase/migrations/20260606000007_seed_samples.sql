-- =============================================================================
-- Migration 007: Sample Data (dev only — do NOT apply to production)
-- Module Repository — Milestone 1 v3.0
--
-- Creates two placeholder owners in owner_profiles (bypassing auth — run as
-- service_role in the Supabase SQL editor, which lets you INSERT into
-- auth.users directly, or substitute real UUIDs from your dev auth users).
--
-- Pattern: create fake auth.users rows, then owner_profiles, then modules.
-- In a real dev environment use the Supabase Dashboard to create users first
-- and paste their UUIDs here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Placeholder UUIDs (replace with real auth user UUIDs if you prefer)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    owner1_id UUID := '00000000-0000-0000-0000-000000000001';
    owner2_id UUID := '00000000-0000-0000-0000-000000000002';

    -- Module IDs (populated by INSERT … RETURNING)
    mod1_id INTEGER;
    mod2_id INTEGER;
    mod3_id INTEGER;
    mod4_id INTEGER;
    mod5_id INTEGER;

    -- Industry IDs
    ind1_id INTEGER;
    ind2_id INTEGER;
    ind3_id INTEGER;
    ind4_id INTEGER;

    -- Car type IDs
    ct_boxcar_id        INTEGER;
    ct_flatcar_id       INTEGER;
    ct_gondola_id       INTEGER;
    ct_hopper_id        INTEGER;
    ct_tank_id          INTEGER;
    ct_reefer_id        INTEGER;
    ct_covered_hopper_id INTEGER;
    ct_log_car_id       INTEGER;

BEGIN
    -- -----------------------------------------------------------------------
    -- Lookup car type IDs from seed data
    -- -----------------------------------------------------------------------
    SELECT id INTO ct_boxcar_id        FROM rail_car_types WHERE value = 'boxcar';
    SELECT id INTO ct_flatcar_id       FROM rail_car_types WHERE value = 'flatcar';
    SELECT id INTO ct_gondola_id       FROM rail_car_types WHERE value = 'gondola';
    SELECT id INTO ct_hopper_id        FROM rail_car_types WHERE value = 'hopper';
    SELECT id INTO ct_tank_id          FROM rail_car_types WHERE value = 'tank_car';
    SELECT id INTO ct_reefer_id        FROM rail_car_types WHERE value = 'reefer';
    SELECT id INTO ct_covered_hopper_id FROM rail_car_types WHERE value = 'covered_hopper';
    SELECT id INTO ct_log_car_id       FROM rail_car_types WHERE value = 'log_car';

    -- -----------------------------------------------------------------------
    -- Fake auth users (service_role only — skip if inserting real UUIDs)
    -- -----------------------------------------------------------------------
    INSERT INTO auth.users (id, email, created_at, updated_at)
    VALUES
        (owner1_id, 'alice@example.com', now(), now()),
        (owner2_id, 'bob@example.com',   now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- -----------------------------------------------------------------------
    -- Owner profiles
    -- -----------------------------------------------------------------------
    INSERT INTO owner_profiles (id, display_name, contact_email, location, role)
    VALUES
        (owner1_id, 'Alice Modeler', 'alice@example.com', 'Portland, OR', 'owner'),
        (owner2_id, 'Bob Railfan',   'bob@example.com',   'Seattle, WA',  'owner')
    ON CONFLICT (id) DO NOTHING;

    -- -----------------------------------------------------------------------
    -- Module 1: Straight scenic — no industries
    -- -----------------------------------------------------------------------
    INSERT INTO freemon_modules
        (module_name, description, owner_id, category, geometry_type,
         length_feet, length_inches, has_mss, status)
    VALUES
        ('Columbia River Gorge', 'Scenic straight depicting the Columbia River Gorge.',
         owner1_id, 'scenic', 'straight', 4, 0, false, 'active')
    RETURNING id INTO mod1_id;

    -- Endplates
    INSERT INTO freemon_endplates (module_id, endplate_number, track_config, width_inches)
    VALUES
        (mod1_id, 1, 'single', 3.5),
        (mod1_id, 2, 'single', 3.5);

    -- -----------------------------------------------------------------------
    -- Module 2: Industry/Spur — lumber yard + grain elevator
    -- -----------------------------------------------------------------------
    INSERT INTO freemon_modules
        (module_name, description, owner_id, category, geometry_type,
         length_feet, length_inches, has_mss, mss_block_count, status)
    VALUES
        ('Cascade Lumber & Grain', 'Two-industry module: lumber yard and grain elevator with passing siding.',
         owner1_id, 'industry_spur', 'straight', 6, 0, true, 2, 'active')
    RETURNING id INTO mod2_id;

    INSERT INTO freemon_endplates (module_id, endplate_number, track_config, width_inches)
    VALUES
        (mod2_id, 1, 'double', 7.0),
        (mod2_id, 2, 'double', 7.0);

    -- Industry 1: Lumber Yard
    INSERT INTO freemon_industries
        (module_id, industry_name, industry_type, spur_capacity_scale_feet, notes)
    VALUES
        (mod2_id, 'Cascade Lumber Co.', 'lumber_yard', 120,
         'Accessible from west end only. Loads outbound flatcars and gondolas.')
    RETURNING id INTO ind1_id;

    INSERT INTO freemon_industry_car_types (industry_id, car_type_id, notes)
    VALUES
        (ind1_id, ct_flatcar_id,  'Primary — lumber loads'),
        (ind1_id, ct_gondola_id,  'Secondary — wood chips'),
        (ind1_id, ct_log_car_id,  'Log loads from the woods');

    -- Industry 2: Grain Elevator
    INSERT INTO freemon_industries
        (module_id, industry_name, industry_type, spur_capacity_scale_feet, notes)
    VALUES
        (mod2_id, 'Sunflower Grain Elevator', 'grain_elevator', 80,
         'Covered hoppers only. Run-around required.')
    RETURNING id INTO ind2_id;

    INSERT INTO freemon_industry_car_types (industry_id, car_type_id, notes)
    VALUES
        (ind2_id, ct_covered_hopper_id, 'Empties in, loads out'),
        (ind2_id, ct_hopper_id,         'Older open hoppers accepted');

    -- -----------------------------------------------------------------------
    -- Module 3: Curve
    -- -----------------------------------------------------------------------
    INSERT INTO freemon_modules
        (module_name, description, owner_id, category, geometry_type,
         geometry_degrees, length_feet, length_inches, has_mss, status)
    VALUES
        ('Multnomah Curve', '22.5° curve module, standard Free-moN radius.',
         owner1_id, 'scenic', 'curve', 22.5, 2, 6, false, 'active')
    RETURNING id INTO mod3_id;

    INSERT INTO freemon_endplates (module_id, endplate_number, track_config, width_inches)
    VALUES
        (mod3_id, 1, 'single', 3.5),
        (mod3_id, 2, 'single', 3.5);

    -- -----------------------------------------------------------------------
    -- Module 4: Industry/Spur — fuel depot (owner2)
    -- -----------------------------------------------------------------------
    INSERT INTO freemon_modules
        (module_name, description, owner_id, category, geometry_type,
         length_feet, length_inches, has_mss, status)
    VALUES
        ('Willamette Fuel Depot', 'Tank car loading/unloading facility.',
         owner2_id, 'industry_spur', 'straight', 4, 6, false, 'active')
    RETURNING id INTO mod4_id;

    INSERT INTO freemon_endplates (module_id, endplate_number, track_config, width_inches)
    VALUES
        (mod4_id, 1, 'single', 3.5),
        (mod4_id, 2, 'single', 3.5);

    INSERT INTO freemon_industries
        (module_id, industry_name, industry_type, spur_capacity_scale_feet, notes)
    VALUES
        (mod4_id, 'Willamette Valley Fuel', 'fuel_oil_depot', 60,
         '40ft max car length. Unloads inbound, reloads empties.')
    RETURNING id INTO ind3_id;

    INSERT INTO freemon_industry_car_types (industry_id, car_type_id, notes)
    VALUES
        (ind3_id, ct_tank_id, 'Tank cars — petroleum products only');

    -- -----------------------------------------------------------------------
    -- Module 5: Yard — no industries
    -- -----------------------------------------------------------------------
    INSERT INTO freemon_modules
        (module_name, description, owner_id, category, geometry_type,
         length_feet, length_inches, has_mss, mss_block_count, status)
    VALUES
        ('Portland Classification Yard', '3-track classification yard with runaround.',
         owner2_id, 'yard', 'straight', 8, 0, true, 3, 'active')
    RETURNING id INTO mod5_id;

    INSERT INTO freemon_endplates (module_id, endplate_number, track_config, width_inches)
    VALUES
        (mod5_id, 1, 'double', 10.5),
        (mod5_id, 2, 'double', 10.5);

END $$;

-- ---------------------------------------------------------------------------
-- Quick sanity check — run after applying
-- ---------------------------------------------------------------------------
-- SELECT m.record_number, m.module_name, m.endplate_count,
--        COUNT(DISTINCT ind.id) AS industry_count,
--        COUNT(DISTINCT ict.id) AS car_type_count
-- FROM freemon_modules m
-- LEFT JOIN freemon_industries ind ON ind.module_id = m.id
-- LEFT JOIN freemon_industry_car_types ict ON ict.industry_id = ind.id
-- GROUP BY m.record_number, m.module_name, m.endplate_count
-- ORDER BY m.record_number;
