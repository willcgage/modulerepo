-- =============================================================================
-- Migration 009: Auto-create owner_profiles on signup; first user becomes admin
-- Module Repository — Milestone 3
--
-- Supabase Auth creates rows directly in auth.users (signup, admin API, etc.)
-- with no client-writable path to owner_profiles.role — by design, since a
-- client must never be able to self-assign 'admin'. This trigger creates the
-- matching owner_profiles row server-side immediately after the auth.users
-- row appears, granting 'admin' only when no profiles exist yet (i.e. this is
-- the very first account in the project) and 'owner' otherwise.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    assigned_role VARCHAR(20);
BEGIN
    IF (SELECT COUNT(*) FROM owner_profiles) = 0 THEN
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
