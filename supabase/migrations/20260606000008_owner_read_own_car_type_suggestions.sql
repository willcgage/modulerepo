-- =============================================================================
-- Migration 008: Owner visibility into their own rail_car_types suggestions
-- Module Repository — Milestone 2 fix
--
-- owner_suggest_car_type (migration 006) lets an owner INSERT a
-- pending_review suggestion, but no SELECT policy let them read it back.
-- Clients that request the inserted row (Prefer: return=representation,
-- supabase-js .insert().select(), incl. car-types-suggest/index.ts) got a
-- "new row violates row-level security policy" error even though the
-- insert itself succeeded, because Postgres can't return a row to a role
-- with no SELECT visibility into it.
-- =============================================================================

CREATE POLICY "owner_read_own_car_type_suggestions"
    ON rail_car_types FOR SELECT
    TO authenticated
    USING (suggested_by = auth.uid());
