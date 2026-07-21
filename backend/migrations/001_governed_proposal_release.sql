BEGIN;

CREATE TABLE IF NOT EXISTS governed_tenant_memberships (
  tenant_id VARCHAR(128) NOT NULL,
  actor_id VARCHAR(128) NOT NULL,
  role VARCHAR(80) NOT NULL CHECK (role ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'),
  subject_ref_prefix VARCHAR(128) NOT NULL DEFAULT '*'
    CHECK (subject_ref_prefix = '*' OR subject_ref_prefix ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by VARCHAR(128) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, actor_id)
);

CREATE TABLE IF NOT EXISTS governed_cases (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  case_type VARCHAR(80) NOT NULL CHECK (case_type = 'approved_proposal_sow_release'),
  subject_ref VARCHAR(128) NOT NULL,
  state VARCHAR(64) NOT NULL,
  policy_version VARCHAR(128) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_snapshot) = 'object'),
  retention_until TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (retention_until IS NULL OR retention_until > effective_at),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS governed_evidence (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  kind VARCHAR(80) NOT NULL,
  source_ref VARCHAR(512) NOT NULL CHECK (source_ref <> ''),
  source_version VARCHAR(128) NOT NULL,
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  captured_at TIMESTAMPTZ NOT NULL,
  consent_basis VARCHAR(160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, case_id, sha256)
);

CREATE TABLE IF NOT EXISTS governed_events (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  action VARCHAR(80) NOT NULL,
  from_state VARCHAR(64) NOT NULL,
  to_state VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 2000),
  actor_id VARCHAR(128) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id)
    REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS governed_connector_failures (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  provider VARCHAR(128) NOT NULL,
  operation VARCHAR(128) NOT NULL,
  error_code VARCHAR(128) NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  actor_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS governed_cases_tenant_state_idx
  ON governed_cases(tenant_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS governed_evidence_case_idx
  ON governed_evidence(tenant_id, case_id, captured_at);
CREATE INDEX IF NOT EXISTS governed_events_case_idx
  ON governed_events(tenant_id, case_id, created_at);
CREATE INDEX IF NOT EXISTS governed_failures_open_idx
  ON governed_connector_failures(tenant_id, last_seen_at DESC)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION reject_governance_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'governance history is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION protect_governed_case_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'governed cases cannot be deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.case_type IS DISTINCT FROM OLD.case_type
     OR NEW.subject_ref IS DISTINCT FROM OLD.subject_ref
     OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
     OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
     OR NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot
     OR NEW.retention_until IS DISTINCT FROM OLD.retention_until
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'governed case identity and evidence pointers are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS governed_case_identity_immutable ON governed_cases;
CREATE TRIGGER governed_case_identity_immutable
BEFORE UPDATE OR DELETE ON governed_cases
FOR EACH ROW EXECUTE FUNCTION protect_governed_case_identity();

DROP TRIGGER IF EXISTS governed_evidence_immutable ON governed_evidence;
CREATE TRIGGER governed_evidence_immutable
BEFORE UPDATE OR DELETE ON governed_evidence
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();

DROP TRIGGER IF EXISTS governed_events_immutable ON governed_events;
CREATE TRIGGER governed_events_immutable
BEFORE UPDATE OR DELETE ON governed_events
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();

COMMIT;


