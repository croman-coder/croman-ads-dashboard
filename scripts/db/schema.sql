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
