-- AssetX Estate case workflow
-- Run once in Supabase Dashboard > SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workflow_cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code        TEXT NOT NULL UNIQUE,
  valuation_id     INTEGER REFERENCES valuations(id) ON DELETE SET NULL,
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  case_name        TEXT NOT NULL DEFAULT '',
  contact_name     TEXT NOT NULL DEFAULT '',
  transaction_type TEXT NOT NULL DEFAULT '',
  phase            SMALLINT NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 4),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'hold', 'completed', 'cancelled')),
  priority         TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  owner_name       TEXT NOT NULL DEFAULT '',
  next_action      TEXT NOT NULL DEFAULT '',
  due_date         DATE,
  checklist        JSONB NOT NULL DEFAULT '{}'::jsonb,
  phase_notes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_case_events (
  id          BIGSERIAL PRIMARY KEY,
  case_id     UUID NOT NULL REFERENCES workflow_cases(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  from_phase  SMALLINT,
  to_phase    SMALLINT,
  note        TEXT NOT NULL DEFAULT '',
  actor       TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_cases_phase_status_idx
  ON workflow_cases (phase, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS workflow_cases_due_date_idx
  ON workflow_cases (due_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS workflow_case_events_case_idx
  ON workflow_case_events (case_id, created_at DESC);

ALTER TABLE workflow_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON workflow_cases;
DROP POLICY IF EXISTS "allow_all" ON workflow_case_events;
CREATE POLICY "allow_all" ON workflow_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON workflow_case_events FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE workflow_cases IS 'Operational case pipeline from intake through legal closing';
COMMENT ON TABLE workflow_case_events IS 'Append-only audit trail for workflow case changes';
