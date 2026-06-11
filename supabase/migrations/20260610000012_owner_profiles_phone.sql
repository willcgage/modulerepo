-- Add an optional phone number to owner profiles.
ALTER TABLE owner_profiles
    ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
