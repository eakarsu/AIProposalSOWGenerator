const crypto = require('node:crypto');

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SENSITIVE_KEY = /(^|_)(raw|content|name|email|phone|address|birth|dob|ssn|mrn|diagnosis|medication|note|patient|client)(_|$)/i;
const MAX_JSON_BYTES = 64 * 1024;

function problem(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function checkedObject(value, field) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw problem('OBJECT_REQUIRED', `${field} must be an object.`);
  }
  if (Object.keys(value).some((key) => SENSITIVE_KEY.test(key))) {
    throw problem('SENSITIVE_FIELD_REJECTED', `${field} may contain opaque references and versions only.`);
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_JSON_BYTES) {
    throw problem('PAYLOAD_TOO_LARGE', `${field} exceeds 64 KiB.`, 413);
  }
  return value;
}

function createWorkflow(config) {
  const stateSet = new Set(config.states);
  if (!stateSet.has(config.initialState)) throw new Error('Workflow initial state is invalid.');
  const transitionMap = new Map();
  for (const item of config.transitions) {
    if (!stateSet.has(item.from) || !stateSet.has(item.to) || !ID.test(item.action)) {
      throw new Error('Workflow transition configuration is invalid.');
    }
    const key = `${item.from}:${item.action}`;
    if (transitionMap.has(key)) throw new Error(`Duplicate workflow transition: ${key}`);
    transitionMap.set(key, item);
  }
  const assessmentRoles = new Set(config.assessmentRoles || [
    ...config.createRoles,
    ...config.transitions.flatMap((item) => item.roles),
  ]);

  function context(headers, user) {
    const tenantId = String(headers['x-tenant-id'] || '');
    const idempotencyKey = String(headers['idempotency-key'] || '');
    const actorId = String(user && user.id || '');
    const role = String(user && user.role || '');
    if (!ID.test(tenantId)) throw problem('TENANT_REQUIRED', 'A valid X-Tenant-Id is required.');
    if (!ID.test(idempotencyKey)) throw problem('IDEMPOTENCY_REQUIRED', 'A valid Idempotency-Key is required.');
    if (!ID.test(actorId) || !ID.test(role)) {
      throw problem('AUTH_CONTEXT_INVALID', 'Authenticated user context is incomplete.', 401);
    }
    return { tenantId, idempotencyKey, actorId, role };
  }

  function createCase(input, ctx) {
    if (!ID.test(String(input.subjectRef || ''))) {
      throw problem('SUBJECT_REQUIRED', 'subjectRef must be an opaque reference, not personal data.');
    }
    if (!ID.test(String(input.policyVersion || ''))) {
      throw problem('POLICY_VERSION_REQUIRED', 'policyVersion is required.');
    }
    if (!input.effectiveAt || Number.isNaN(Date.parse(input.effectiveAt))) {
      throw problem('EFFECTIVE_DATE_REQUIRED', 'effectiveAt must be an ISO date.');
    }
    if (input.retentionUntil && Number.isNaN(Date.parse(input.retentionUntil))) {
      throw problem('RETENTION_DATE_INVALID', 'retentionUntil must be an ISO date.');
    }
    if (!config.createRoles.includes(ctx.role)) throw problem('FORBIDDEN', 'Role cannot create cases.', 403);
    return {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      idempotencyKey: ctx.idempotencyKey,
      subjectRef: String(input.subjectRef),
      caseType: config.caseType,
      state: config.initialState,
      policyVersion: String(input.policyVersion),
      effectiveAt: new Date(input.effectiveAt).toISOString(),
      sourceSnapshot: checkedObject(input.sourceSnapshot, 'sourceSnapshot'),
      retentionUntil: input.retentionUntil ? new Date(input.retentionUntil).toISOString() : null,
      createdBy: ctx.actorId,
    };
  }

  function evidence(input) {
    if (!config.evidenceKinds.includes(input.kind)) {
      throw problem('EVIDENCE_KIND_INVALID', 'Unsupported evidence kind.');
    }
    if (!ID.test(String(input.sourceVersion || ''))) {
      throw problem('SOURCE_VERSION_REQUIRED', 'sourceVersion is required.');
    }
    if (!input.capturedAt || Number.isNaN(Date.parse(input.capturedAt))) {
      throw problem('CAPTURE_TIME_REQUIRED', 'capturedAt must be an ISO date.');
    }
    if (input.rawContent !== undefined) {
      throw problem('RAW_CONTENT_REJECTED', 'Raw sensitive content must remain in approved encrypted storage.');
    }
    const sourceRef = String(input.sourceRef || '');
    if (!sourceRef || sourceRef.length > 512 || /\s/.test(sourceRef)) {
      throw problem('SOURCE_REF_REQUIRED', 'sourceRef must be a non-sensitive opaque reference.');
    }
    const digest = String(input.sha256 || '').toLowerCase();
    if (!DIGEST.test(digest)) throw problem('DIGEST_REQUIRED', 'sha256 must be a 64-character digest.');
    return {
      id: crypto.randomUUID(),
      kind: input.kind,
      sourceRef,
      sourceVersion: String(input.sourceVersion),
      sha256: digest,
      capturedAt: new Date(input.capturedAt).toISOString(),
      consentBasis: input.consentBasis || null,
      metadata: checkedObject(input.metadata, 'metadata'),
    };
  }

  function transition(record, input, ctx) {
    if (!stateSet.has(record.state)) throw problem('STATE_CORRUPT', 'Stored case state is invalid.', 409);
    const expectedVersion = Number(input.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw problem('EXPECTED_VERSION_REQUIRED', 'expectedVersion must be a positive integer.');
    }
    if (expectedVersion !== Number(record.version)) {
      throw problem('VERSION_CONFLICT', 'Case changed since it was read.', 409);
    }
    const rule = transitionMap.get(`${record.state}:${input.action}`);
    if (!rule) throw problem('TRANSITION_INVALID', `Action ${input.action} is not allowed from ${record.state}.`, 409);
    if (!rule.roles.includes(ctx.role)) throw problem('FORBIDDEN', 'Role cannot perform this transition.', 403);
    if (rule.requiresEvidence && Number(record.evidenceCount || 0) < 1) {
      throw problem('EVIDENCE_REQUIRED', 'At least one evidence record is required.', 409);
    }
    if (rule.dualControl && [record.createdBy, record.lastActorId].map(String).includes(ctx.actorId)) {
      throw problem('DUAL_CONTROL_REQUIRED', 'A second person must perform this decision.', 409);
    }
    const reason = String(input.reason || '').trim();
    if (reason.length < 8 || reason.length > 2000) {
      throw problem('REASON_REQUIRED', 'A specific decision reason of 8-2000 characters is required.');
    }
    return { to: rule.to, action: rule.action, eventId: crypto.randomUUID(), reason };
  }

  function deterministicAssessment(input, ctx) {
    if (!assessmentRoles.has(ctx.role)) throw problem('FORBIDDEN', 'Role cannot assess this case.', 403);
    const missing = config.requiredSignals.filter((key) => input[key] === undefined || input[key] === null || input[key] === '');
    if (missing.length) {
      return { disposition: 'insufficient_evidence', missing, automatedDecision: false, requiresHumanReview: true };
    }
    if (!ID.test(String(input.policyVersion || ''))) {
      throw problem('POLICY_VERSION_REQUIRED', 'policyVersion is invalid.');
    }
    const assessment = config.assess(Object.freeze({ ...input }));
    if (!assessment || !ID.test(String(assessment.disposition || ''))) {
      throw problem('ASSESSMENT_SCHEMA_INVALID', 'Deterministic assessment returned an invalid schema.', 500);
    }
    return {
      ...assessment,
      automatedDecision: false,
      requiresHumanReview: true,
      policyVersion: String(input.policyVersion),
    };
  }

  return { config, context, createCase, evidence, transition, deterministicAssessment, problem };
}

module.exports = { createWorkflow, problem };


