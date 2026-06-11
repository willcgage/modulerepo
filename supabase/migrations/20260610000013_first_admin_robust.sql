-- Fix handle_new_user(): "first admin" must mean "no admin exists yet",
-- not "no profiles exist yet". Migration 007 seeds owner_profiles with two
-- demo accounts (role = 'owner') *before* this trigger existed, so the
-- original COUNT(*) = 0 check never granted 'admin' to any real signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    assigned_role VARCHAR(20);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM owner_profiles WHERE role = 'admin') THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'owner';
    END IF;

    INSERT INTO owner_profiles (id, display_name, contact_email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        assigned_role
    );

    RETURN NEW;
END;
$$;
