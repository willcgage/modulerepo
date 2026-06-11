-- Add optional first/last name fields to owner profiles, separate from
-- display_name (which remains the name shown throughout the app).
ALTER TABLE owner_profiles
    ADD COLUMN first_name text,
    ADD COLUMN last_name text,
    ADD CONSTRAINT chk_owner_profiles_first_name_length CHECK (char_length(first_name) <= 60),
    ADD CONSTRAINT chk_owner_profiles_last_name_length CHECK (char_length(last_name) <= 60);
