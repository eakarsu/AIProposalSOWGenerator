BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS governed_rendered_pdfs (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('proposal','sow')),
  source_id INTEGER NOT NULL CHECK (source_id > 0),
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  source_sha256 CHAR(64) NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_bytes BYTEA NOT NULL,
  pdf_sha256 CHAR(64) NOT NULL CHECK (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  rendered_by VARCHAR(128) NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id,case_id) REFERENCES governed_cases(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,case_id),
  UNIQUE (tenant_id,case_id,id),
  CHECK (octet_length(pdf_bytes) BETWEEN 100 AND 10485760),
  CHECK (substring(pdf_bytes FROM 1 FOR 5) = decode('255044462d','hex')),
  CHECK (encode(digest(pdf_bytes,'sha256'),'hex') = pdf_sha256)
);

CREATE TABLE IF NOT EXISTS governed_signer_packages (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  pdf_id UUID NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  signer_name VARCHAR(160) NOT NULL CHECK (char_length(trim(signer_name)) BETWEEN 2 AND 160),
  signer_title VARCHAR(160),
  token_sha256 CHAR(64) NOT NULL CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  prepared_by VARCHAR(128) NOT NULL,
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id,case_id,pdf_id)
    REFERENCES governed_rendered_pdfs(tenant_id,case_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,idempotency_key),
  UNIQUE (token_sha256),
  UNIQUE (tenant_id,id)
);

CREATE TABLE IF NOT EXISTS governed_signer_events (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  package_id UUID NOT NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('handoff_recorded','signer_accepted')),
  actor_id VARCHAR(128),
  signer_name VARCHAR(160) NOT NULL,
  pdf_sha256 CHAR(64) NOT NULL CHECK (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  method VARCHAR(64) NOT NULL,
  attestation TEXT NOT NULL CHECK (char_length(attestation) BETWEEN 8 AND 2000),
  evidence_sha256 CHAR(64) NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id,package_id)
    REFERENCES governed_signer_packages(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,package_id,event_type)
);

CREATE INDEX IF NOT EXISTS governed_signer_packages_case_idx
  ON governed_signer_packages(tenant_id,case_id,prepared_at DESC);
CREATE INDEX IF NOT EXISTS governed_signer_events_package_idx
  ON governed_signer_events(tenant_id,package_id,occurred_at);

DROP TRIGGER IF EXISTS governed_rendered_pdfs_immutable ON governed_rendered_pdfs;
CREATE TRIGGER governed_rendered_pdfs_immutable BEFORE UPDATE OR DELETE ON governed_rendered_pdfs
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_signer_packages_immutable ON governed_signer_packages;
CREATE TRIGGER governed_signer_packages_immutable BEFORE UPDATE OR DELETE ON governed_signer_packages
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_signer_events_immutable ON governed_signer_events;
CREATE TRIGGER governed_signer_events_immutable BEFORE UPDATE OR DELETE ON governed_signer_events
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();

COMMIT;
