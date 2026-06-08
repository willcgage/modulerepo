-- =============================================================================
-- Migration 011: Audit log triggers
-- Module Repository — Milestone 5 (Admin GUI)
--
-- The `audit_log` table and its admin-only read policy have existed since
-- Migration 002/006 ("written server-side"), but nothing ever wrote to it.
-- This adds a generic trigger that logs INSERT/UPDATE/DELETE on the tables
-- whose changes matter for admin oversight: profiles/roles, the car-type
-- suggestion workflow, show-master grants, modules themselves, and the
-- admin-managed lookup tables. High-churn owner-editing detail tables
-- (endplates, industries, industry_car_types, images) are deliberately left
-- out — auditing them would flood the log with routine wizard activity and
-- bury the admin-relevant signal.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
    row_data JSONB := to_jsonb(COALESCE(NEW, OLD));
BEGIN
    -- Tables in scope are keyed by either `id` (most) or `value` (lookup
    -- tables) — to_jsonb + ->> resolves whichever exists without erroring
    -- on the other, unlike a direct NEW.id/NEW.value field reference would.
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, performed_by)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(row_data->>'id', row_data->>'value'),
        TG_OP,
        CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
        auth.uid()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_owner_profiles
    AFTER INSERT OR UPDATE OR DELETE ON owner_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_rail_car_types
    AFTER INSERT OR UPDATE OR DELETE ON rail_car_types
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_show_master_grants
    AFTER INSERT OR UPDATE OR DELETE ON show_master_grants
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_freemon_modules
    AFTER INSERT OR UPDATE OR DELETE ON freemon_modules
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_module_categories
    AFTER INSERT OR UPDATE OR DELETE ON module_categories
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_module_geometries
    AFTER INSERT OR UPDATE OR DELETE ON module_geometries
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_industry_types
    AFTER INSERT OR UPDATE OR DELETE ON industry_types
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_module_standards
    AFTER INSERT OR UPDATE OR DELETE ON module_standards
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
