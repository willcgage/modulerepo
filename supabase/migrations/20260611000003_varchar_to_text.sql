-- Supabase/Postgres recommend text over varchar(n): there is no
-- performance benefit to varchar(n), and a CHECK constraint is more
-- flexible than a fixed type modifier. Convert all varchar(n) columns
-- to text, preserving the original length limits as CHECK constraints.

-- Note: freemon_modules.status and rail_car_types.status are intentionally
-- left as varchar(20) — they're referenced (directly or via subquery) by
-- numerous RLS policies across several tables, and Postgres refuses
-- ALTER COLUMN TYPE on a column used in any policy definition. Converting
-- them would require dropping and recreating ~9 policies for no functional
-- benefit (varchar(n) and text are identical on disk in Postgres).

ALTER TABLE audit_log
    ALTER COLUMN table_name TYPE text,
    ALTER COLUMN action TYPE text,
    ADD CONSTRAINT chk_audit_log_table_name_length CHECK (char_length(table_name) <= 60),
    ADD CONSTRAINT chk_audit_log_action_length CHECK (char_length(action) <= 10);

ALTER TABLE freemon_endplates
    ALTER COLUMN label TYPE text,
    ALTER COLUMN track_config TYPE text,
    ALTER COLUMN notes TYPE text,
    ADD CONSTRAINT chk_freemon_endplates_label_length CHECK (char_length(label) <= 10),
    ADD CONSTRAINT chk_freemon_endplates_track_config_length CHECK (char_length(track_config) <= 10),
    ADD CONSTRAINT chk_freemon_endplates_notes_length CHECK (char_length(notes) <= 255);

ALTER TABLE freemon_industries
    ALTER COLUMN label TYPE text,
    ALTER COLUMN industry_name TYPE text,
    ALTER COLUMN industry_type TYPE text,
    ALTER COLUMN notes TYPE text,
    ADD CONSTRAINT chk_freemon_industries_label_length CHECK (char_length(label) <= 10),
    ADD CONSTRAINT chk_freemon_industries_industry_name_length CHECK (char_length(industry_name) <= 120),
    ADD CONSTRAINT chk_freemon_industries_industry_type_length CHECK (char_length(industry_type) <= 40),
    ADD CONSTRAINT chk_freemon_industries_notes_length CHECK (char_length(notes) <= 500);

ALTER TABLE freemon_industry_car_types
    ALTER COLUMN notes TYPE text,
    ADD CONSTRAINT chk_freemon_industry_car_types_notes_length CHECK (char_length(notes) <= 255);

ALTER TABLE freemon_modules
    ALTER COLUMN record_number TYPE text,
    ALTER COLUMN module_name TYPE text,
    ALTER COLUMN category TYPE text,
    ALTER COLUMN geometry_type TYPE text,
    ALTER COLUMN mss_type TYPE text,
    ADD CONSTRAINT chk_freemon_modules_record_number_length CHECK (char_length(record_number) <= 12),
    ADD CONSTRAINT chk_freemon_modules_module_name_length CHECK (char_length(module_name) <= 120),
    ADD CONSTRAINT chk_freemon_modules_category_length CHECK (char_length(category) <= 30),
    ADD CONSTRAINT chk_freemon_modules_geometry_type_length CHECK (char_length(geometry_type) <= 20),
    ADD CONSTRAINT chk_freemon_modules_mss_type_length CHECK (char_length(mss_type) <= 20);

ALTER TABLE industry_types
    ALTER COLUMN value TYPE text,
    ALTER COLUMN display_label TYPE text,
    ADD CONSTRAINT chk_industry_types_value_length CHECK (char_length(value) <= 40),
    ADD CONSTRAINT chk_industry_types_display_label_length CHECK (char_length(display_label) <= 60);

ALTER TABLE module_categories
    ALTER COLUMN value TYPE text,
    ALTER COLUMN display_label TYPE text,
    ADD CONSTRAINT chk_module_categories_value_length CHECK (char_length(value) <= 30),
    ADD CONSTRAINT chk_module_categories_display_label_length CHECK (char_length(display_label) <= 60);

ALTER TABLE module_geometries
    ALTER COLUMN value TYPE text,
    ALTER COLUMN display_label TYPE text,
    ADD CONSTRAINT chk_module_geometries_value_length CHECK (char_length(value) <= 20),
    ADD CONSTRAINT chk_module_geometries_display_label_length CHECK (char_length(display_label) <= 40);

ALTER TABLE module_images
    ALTER COLUMN caption TYPE text,
    ADD CONSTRAINT chk_module_images_caption_length CHECK (char_length(caption) <= 255);

ALTER TABLE module_standards
    ALTER COLUMN value TYPE text,
    ALTER COLUMN display_label TYPE text,
    ALTER COLUMN record_prefix TYPE text,
    ADD CONSTRAINT chk_module_standards_value_length CHECK (char_length(value) <= 20),
    ADD CONSTRAINT chk_module_standards_display_label_length CHECK (char_length(display_label) <= 60),
    ADD CONSTRAINT chk_module_standards_record_prefix_length CHECK (char_length(record_prefix) <= 10);

ALTER TABLE module_tracks
    ALTER COLUMN label TYPE text,
    ALTER COLUMN track_name TYPE text,
    ALTER COLUMN notes TYPE text,
    ADD CONSTRAINT chk_module_tracks_label_length CHECK (char_length(label) <= 10),
    ADD CONSTRAINT chk_module_tracks_track_name_length CHECK (char_length(track_name) <= 120),
    ADD CONSTRAINT chk_module_tracks_notes_length CHECK (char_length(notes) <= 500);

ALTER TABLE owner_profiles
    ALTER COLUMN display_name TYPE text,
    ALTER COLUMN contact_email TYPE text,
    ALTER COLUMN location TYPE text,
    ALTER COLUMN role TYPE text,
    ALTER COLUMN phone TYPE text,
    ADD CONSTRAINT chk_owner_profiles_display_name_length CHECK (char_length(display_name) <= 120),
    ADD CONSTRAINT chk_owner_profiles_contact_email_length CHECK (char_length(contact_email) <= 255),
    ADD CONSTRAINT chk_owner_profiles_location_length CHECK (char_length(location) <= 120),
    ADD CONSTRAINT chk_owner_profiles_role_length CHECK (char_length(role) <= 20),
    ADD CONSTRAINT chk_owner_profiles_phone_length CHECK (char_length(phone) <= 40);

-- trg_rail_car_types_immutable_value fires "BEFORE UPDATE OF value", which
-- creates a dependency on the column that blocks ALTER COLUMN TYPE.
DROP TRIGGER trg_rail_car_types_immutable_value ON rail_car_types;

ALTER TABLE rail_car_types
    ALTER COLUMN value TYPE text,
    ALTER COLUMN display_label TYPE text,
    ALTER COLUMN suggestion_notes TYPE text,
    ADD CONSTRAINT chk_rail_car_types_value_length CHECK (char_length(value) <= 40),
    ADD CONSTRAINT chk_rail_car_types_display_label_length CHECK (char_length(display_label) <= 60),
    ADD CONSTRAINT chk_rail_car_types_suggestion_notes_length CHECK (char_length(suggestion_notes) <= 255);

CREATE TRIGGER trg_rail_car_types_immutable_value
    BEFORE UPDATE OF value ON rail_car_types
    FOR EACH ROW EXECUTE FUNCTION fn_immutable_car_type_value();

ALTER TABLE show_master_grants
    ALTER COLUMN event_name TYPE text,
    ADD CONSTRAINT chk_show_master_grants_event_name_length CHECK (char_length(event_name) <= 120);
