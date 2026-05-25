CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'pending', 'approved', 'rejected', 'executed', 'failed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_action AS ENUM (
    'set_budget', 'activate', 'create_campaign', 'duplicate_campaign'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS mutation_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  proposed_by     TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  action          proposal_action NOT NULL,
  scope           TEXT NOT NULL,
  scope_id        TEXT,
  scope_name      TEXT,
  payload         JSONB NOT NULL,
  current_state   JSONB,
  reason          TEXT,
  status          proposal_status NOT NULL DEFAULT 'pending',
  decided_at      TIMESTAMPTZ,
  decided_by      TEXT,
  decision_note   TEXT,
  executed_at     TIMESTAMPTZ,
  meta_response   JSONB,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_status_expires
  ON mutation_proposals(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_proposals_account
  ON mutation_proposals(account_id, created_at DESC);

/* ---------- Multi-user auth ---------- */

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'operator',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));

CREATE TABLE IF NOT EXISTS user_account_access (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id   TEXT NOT NULL,
  account_name TEXT,
  granted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_user_account_user ON user_account_access(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit_log(action, created_at DESC);
