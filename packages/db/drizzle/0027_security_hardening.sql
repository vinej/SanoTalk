-- Security Hardening: updatedAt trigger, CHECK constraints, RLS policies

-- ──────────────────────────────────────────────────────────────────────────────
-- L-1: Auto-update updatedAt timestamp trigger
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sanotalk_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  -- user
  CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON sanotalk_user
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- session (auth)
  CREATE TRIGGER trg_session_updated_at BEFORE UPDATE ON sanotalk_session
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- account
  CREATE TRIGGER trg_account_updated_at BEFORE UPDATE ON sanotalk_account
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- symptom_log
  CREATE TRIGGER trg_symptom_log_updated_at BEFORE UPDATE ON sanotalk_symptom_log
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- breach_record
  CREATE TRIGGER trg_breach_record_updated_at BEFORE UPDATE ON sanotalk_breach_record
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- data_retention_policy
  CREATE TRIGGER trg_data_retention_policy_updated_at BEFORE UPDATE ON sanotalk_data_retention_policy
    FOR EACH ROW EXECUTE FUNCTION sanotalk_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- H-5: Row-Level Security (RLS) on user-data tables
-- The application connects as a single DB role, so RLS is set up here for
-- defense-in-depth. Policies use a session variable (app.current_user_id)
-- that must be set by the application before each request.
-- NOTE: RLS is not enforced until the application sets the session variable
-- and connects as a non-superuser role. This migration creates the policies
-- so they are ready when the infrastructure supports per-request role switching.
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable RLS on user-data tables (does not block superuser/table owner)
ALTER TABLE sanotalk_user_property ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_vital_sign ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_medication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_symptom_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_allergy ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_chat_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanotalk_consent_record ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own rows
-- These use current_setting('app.current_user_id', true) which returns NULL if not set,
-- effectively denying access when the variable is missing (fail-closed).

CREATE POLICY user_property_owner ON sanotalk_user_property
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY vital_sign_owner ON sanotalk_vital_sign
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY medication_owner ON sanotalk_medication
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY symptom_log_owner ON sanotalk_symptom_log
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY allergy_owner ON sanotalk_allergy
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY chat_message_owner ON sanotalk_chat_message
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY consent_record_owner ON sanotalk_consent_record
  USING (user_id = current_setting('app.current_user_id', true));
