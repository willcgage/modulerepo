-- =============================================================================
-- Migration 002: Owner Profiles, Show Master Grants, Audit Log
-- Module Repository — Milestone 1 v3.0
-- =============================================================================

-- ---------------------------------------------------------------------------
-- owner_profiles  (extended profile, 1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name  VARCHAR(120) NOT NULL,
    contact_email VARCHAR(255),                    -- may differ from auth email
    location      VARCHAR(120),                    -- city / region / club
    role          VARCHAR(20)  NOT NULL DEFAULT 'owner'
                      CHECK (role IN ('owner', 'admin')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- show_master_grants  (event-scoped show_master access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS show_master_grants (
    id          SERIAL      PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name  VARCHAR(120) NOT NULL,
    granted_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    granted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,                        -- NULL = no expiry
    revoked_at  TIMESTAMPTZ,                        -- NULL = still active

    CONSTRAINT show_master_grants_unique UNIQUE (user_id, event_name)
);

CREATE INDEX IF NOT EXISTS idx_show_master_grants_user
    ON show_master_grants(user_id)
    WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- audit_log  (full action history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGSERIAL   PRIMARY KEY,
    table_name    VARCHAR(60)  NOT NULL,
    record_id     TEXT         NOT NULL,            -- stringified PK
    action        VARCHAR(10)  NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data      JSONB,                            -- NULL on INSERT
    new_data      JSONB,                            -- NULL on DELETE
    performed_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
    ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at
    ON audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by
    ON audit_log(performed_by);
