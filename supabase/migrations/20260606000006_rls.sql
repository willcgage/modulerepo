-- =============================================================================
-- Migration 006: Row-Level Security
-- Module Repository — Milestone 1 v3.0
--
-- Roles:
--   anon          — unauthenticated public
--   authenticated — any logged-in user
--
-- Helper functions:
--   fn_is_admin()        — true if current user has role = 'admin' in owner_profiles
--   fn_is_show_master()  — true if current user has an active show_master_grant
--
-- Policy matrix (§12.5):
--   Public:       SELECT active modules + endplates + industries + active car types
--   Owner:        SELECT own inactive/archived; INSERT/UPDATE/DELETE own modules + children
--                 INSERT rail_car_types with status = pending_review
--   Show Master:  SELECT active modules + endplates + industries (same as public)
--   Admin:        Full access everywhere
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM owner_profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- ---------------------------------------------------------------------------
-- Helper: does the current user have an active show_master grant?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_show_master()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM show_master_grants
        WHERE user_id = auth.uid()
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
    );
$$;

-- ===========================================================================
-- LOOKUP TABLES (read-only for non-admins)
-- ===========================================================================

-- module_categories
ALTER TABLE module_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_module_categories"
    ON module_categories FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "admin_manage_module_categories"
    ON module_categories FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- module_geometries
ALTER TABLE module_geometries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_module_geometries"
    ON module_geometries FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "admin_manage_module_geometries"
    ON module_geometries FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- industry_types
ALTER TABLE industry_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_industry_types"
    ON industry_types FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "admin_manage_industry_types"
    ON industry_types FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- module_standards
ALTER TABLE module_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_module_standards"
    ON module_standards FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "admin_manage_module_standards"
    ON module_standards FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ===========================================================================
-- rail_car_types  (special: owners can INSERT pending_review)
-- ===========================================================================
ALTER TABLE rail_car_types ENABLE ROW LEVEL SECURITY;

-- Public reads active car types
CREATE POLICY "public_read_active_car_types"
    ON rail_car_types FOR SELECT
    TO anon, authenticated
    USING (status = 'active');

-- Admin reads all (including pending / inactive)
CREATE POLICY "admin_read_all_car_types"
    ON rail_car_types FOR SELECT
    TO authenticated
    USING (fn_is_admin());

-- Owners may INSERT a suggestion (status must be pending_review, suggested_by must be self)
CREATE POLICY "owner_suggest_car_type"
    ON rail_car_types FOR INSERT
    TO authenticated
    WITH CHECK (
        NOT fn_is_admin()
        AND status = 'pending_review'
        AND suggested_by = auth.uid()
    );

-- Admins INSERT as active (or any status)
CREATE POLICY "admin_insert_car_type"
    ON rail_car_types FOR INSERT
    TO authenticated
    WITH CHECK (fn_is_admin());

-- Only admins may UPDATE (approve / reject / merge) or DELETE
CREATE POLICY "admin_update_car_type"
    ON rail_car_types FOR UPDATE
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

CREATE POLICY "admin_delete_car_type"
    ON rail_car_types FOR DELETE
    TO authenticated
    USING (fn_is_admin());

-- ===========================================================================
-- owner_profiles
-- ===========================================================================
ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;

-- Owners see their own profile; admins see all
CREATE POLICY "owner_read_own_profile"
    ON owner_profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR fn_is_admin());

CREATE POLICY "owner_insert_own_profile"
    ON owner_profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "owner_update_own_profile"
    ON owner_profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR fn_is_admin())
    WITH CHECK (id = auth.uid() OR fn_is_admin());

CREATE POLICY "admin_delete_profile"
    ON owner_profiles FOR DELETE
    TO authenticated
    USING (fn_is_admin());

-- ===========================================================================
-- show_master_grants  (admin-managed)
-- ===========================================================================
ALTER TABLE show_master_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_grants"
    ON show_master_grants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR fn_is_admin());

CREATE POLICY "admin_manage_grants"
    ON show_master_grants FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ===========================================================================
-- audit_log  (admin-only read; written server-side)
-- ===========================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log"
    ON audit_log FOR SELECT
    TO authenticated
    USING (fn_is_admin());

-- No direct INSERT/UPDATE/DELETE from client; audit rows are written
-- by server-side triggers or Edge Functions running as service_role.

-- ===========================================================================
-- freemon_modules
-- ===========================================================================
ALTER TABLE freemon_modules ENABLE ROW LEVEL SECURITY;

-- Public + show_master: SELECT active modules only
CREATE POLICY "public_read_active_modules"
    ON freemon_modules FOR SELECT
    TO anon, authenticated
    USING (status = 'active');

-- Owners: also see their own inactive / archived modules
CREATE POLICY "owner_read_own_all_status"
    ON freemon_modules FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- Admins: see everything
CREATE POLICY "admin_read_all_modules"
    ON freemon_modules FOR SELECT
    TO authenticated
    USING (fn_is_admin());

-- Owners: INSERT own modules
CREATE POLICY "owner_insert_module"
    ON freemon_modules FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid() AND NOT fn_is_admin());

-- Admins: INSERT any module
CREATE POLICY "admin_insert_module"
    ON freemon_modules FOR INSERT
    TO authenticated
    WITH CHECK (fn_is_admin());

-- Owners: UPDATE own modules
CREATE POLICY "owner_update_module"
    ON freemon_modules FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Admins: UPDATE any module
CREATE POLICY "admin_update_module"
    ON freemon_modules FOR UPDATE
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- Owners: DELETE own modules
CREATE POLICY "owner_delete_module"
    ON freemon_modules FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- Admins: DELETE any module
CREATE POLICY "admin_delete_module"
    ON freemon_modules FOR DELETE
    TO authenticated
    USING (fn_is_admin());

-- ===========================================================================
-- freemon_endplates  (access derived from parent module ownership)
-- ===========================================================================
ALTER TABLE freemon_endplates ENABLE ROW LEVEL SECURITY;

-- Public + show_master: read endplates on active modules
CREATE POLICY "public_read_endplates_active_modules"
    ON freemon_endplates FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_endplates.module_id
              AND m.status = 'active'
        )
    );

-- Owners: read endplates on their own modules (any status)
CREATE POLICY "owner_read_own_endplates"
    ON freemon_endplates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_endplates.module_id
              AND m.owner_id = auth.uid()
        )
    );

-- Admins: read all endplates
CREATE POLICY "admin_read_all_endplates"
    ON freemon_endplates FOR SELECT
    TO authenticated
    USING (fn_is_admin());

-- Owners: INSERT/UPDATE/DELETE endplates on own modules
CREATE POLICY "owner_write_endplates"
    ON freemon_endplates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_endplates.module_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_endplates.module_id
              AND m.owner_id = auth.uid()
        )
    );

-- Admins: full access
CREATE POLICY "admin_write_endplates"
    ON freemon_endplates FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ===========================================================================
-- freemon_industries
-- ===========================================================================
ALTER TABLE freemon_industries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_industries_active_modules"
    ON freemon_industries FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_industries.module_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "owner_read_own_industries"
    ON freemon_industries FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_industries.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_read_all_industries"
    ON freemon_industries FOR SELECT
    TO authenticated
    USING (fn_is_admin());

CREATE POLICY "owner_write_industries"
    ON freemon_industries FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_industries.module_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = freemon_industries.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_write_industries"
    ON freemon_industries FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ===========================================================================
-- freemon_industry_car_types  (access via grandparent module)
-- ===========================================================================
ALTER TABLE freemon_industry_car_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_industry_car_types_active"
    ON freemon_industry_car_types FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM freemon_industries ind
            JOIN freemon_modules m ON m.id = ind.module_id
            WHERE ind.id = freemon_industry_car_types.industry_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "owner_read_own_industry_car_types"
    ON freemon_industry_car_types FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM freemon_industries ind
            JOIN freemon_modules m ON m.id = ind.module_id
            WHERE ind.id = freemon_industry_car_types.industry_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_read_all_industry_car_types"
    ON freemon_industry_car_types FOR SELECT
    TO authenticated
    USING (fn_is_admin());

CREATE POLICY "owner_write_industry_car_types"
    ON freemon_industry_car_types FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM freemon_industries ind
            JOIN freemon_modules m ON m.id = ind.module_id
            WHERE ind.id = freemon_industry_car_types.industry_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM freemon_industries ind
            JOIN freemon_modules m ON m.id = ind.module_id
            WHERE ind.id = freemon_industry_car_types.industry_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_write_industry_car_types"
    ON freemon_industry_car_types FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- ===========================================================================
-- module_images  (same ownership model as endplates)
-- ===========================================================================
ALTER TABLE module_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_images_active_modules"
    ON module_images FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_images.module_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "owner_read_own_images"
    ON module_images FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_images.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_read_all_images"
    ON module_images FOR SELECT
    TO authenticated
    USING (fn_is_admin());

CREATE POLICY "owner_write_images"
    ON module_images FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_images.module_id
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id = module_images.module_id
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_write_images"
    ON module_images FOR ALL
    TO authenticated
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());
