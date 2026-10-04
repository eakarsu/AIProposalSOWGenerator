'use strict';

const crypto = require('node:crypto');
const { sha256, canonical, loadReviewedDocument, assertBinding, renderPdf, problem } = require('./reviewedDocument');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function createReleaseRoutes({ express, router, workflow, db, tenant, inScope, respondError }) {
  const basePath = '/api/governed-proposal-releases';
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

  async function caseInScope(query, req, lock = false) {
    const rows = await query(
      `SELECT * FROM governed_cases WHERE id=$1 AND tenant_id=$2
       AND ($3='*' OR left(subject_ref,char_length($3))=$3) ${lock ? 'FOR UPDATE' : ''}`,
      [req.params.id, tenant(req), req.governanceScope]
    );
    if (!rows[0]) throw problem('CASE_NOT_FOUND', 'Release case not found in your tenant scope.', 404);
    return rows[0];
  }

  async function storedPdf(query, tenantId, caseId) {
    const rows = await query(
      'SELECT * FROM governed_rendered_pdfs WHERE tenant_id=$1 AND case_id=$2', [tenantId, caseId]
    );
    if (!rows[0]) throw problem('RENDERED_PDF_REQUIRED', 'A reviewed PDF must be rendered before release.');
    if (sha256(rows[0].pdf_bytes) !== rows[0].pdf_sha256) {
      throw problem('PDF_CHECKSUM_MISMATCH', 'Stored PDF bytes failed SHA-256 verification.');
    }
    return rows[0];
  }

  async function signerPackage(query, token) {
    if (!tokenPattern.test(token)) throw problem('SIGNER_LINK_INVALID', 'Signer link is invalid.', 404);
    const rows = await query(
      `SELECT p.*, r.pdf_sha256, c.state,
        EXISTS(SELECT 1 FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
          AND e.package_id=p.id AND e.event_type='handoff_recorded') AS handed_off,
        EXISTS(SELECT 1 FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
          AND e.package_id=p.id AND e.event_type='signer_accepted') AS accepted
       FROM governed_signer_packages p
       JOIN governed_rendered_pdfs r ON r.id=p.pdf_id AND r.case_id=p.case_id AND r.tenant_id=p.tenant_id
       JOIN governed_cases c ON c.id=p.case_id AND c.tenant_id=p.tenant_id
       WHERE p.token_sha256=$1`, [sha256(Buffer.from(token))]
    );
    const item = rows[0];
    if (!item || item.state !== 'exported' || !item.handed_off) {
      throw problem('SIGNER_LINK_UNAVAILABLE', 'This signer package is not available.', 404);
    }
    return item;
  }

  function publicHeaders(res) {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" });
  }

  // A possession link is handed to the named signer by an operator. No email,
  // signature provider, CRM, or independent identity verification is claimed.
  router.get('/signer/:token', async (req, res) => {
    try {
      const item = await signerPackage(db.query, req.params.token);
      publicHeaders(res);
      const path = `${basePath}/signer/${req.params.token}`;
      const accepted = item.accepted
        ? '<p>Acceptance was already recorded for this package.</p>'
        : `<form method="post" action="${path}/accept">
             <label>Your full name <input name="typedName" required maxlength="160" autocomplete="name"></label>
             <label><input type="checkbox" name="accepted" value="yes" required>
               I reviewed the PDF identified by the digest shown and accept its terms as the named signer.</label>
             <input type="hidden" name="pdfSha256" value="${item.pdf_sha256}">
             <button type="submit">Record my acceptance</button>
           </form>`;
      res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Review signer package</title>
        <style>body{font:16px system-ui;max-width:680px;margin:3rem auto;padding:0 1rem;line-height:1.5}label{display:block;margin:1rem 0}input[type=text],input:not([type]){padding:.5rem;width:100%}button{padding:.7rem 1rem}</style>
        <h1>Review ${escapeHtml(item.signer_name)}'s package</h1>
        <p>Named signer: ${escapeHtml(item.signer_name)}${item.signer_title ? ` (${escapeHtml(item.signer_title)})` : ''}</p>
        <p><a href="${path}/pdf">Open or download the exact reviewed PDF</a></p>
        <p>PDF SHA-256: <code>${item.pdf_sha256}</code></p>
        <p>Acceptance here is a named, token-based acknowledgement. Identity is not independently verified and this is not an external electronic signature.</p>
        ${accepted}</html>`);
    } catch (error) { respondError(res, error); }
  });

  router.get('/signer/:token/pdf', async (req, res) => {
    try {
      const item = await signerPackage(db.query, req.params.token);
      const pdf = await storedPdf(db.query, item.tenant_id, item.case_id);
      if (pdf.id !== item.pdf_id || pdf.pdf_sha256 !== item.pdf_sha256) {
        throw problem('PDF_CHECKSUM_MISMATCH', 'Signer package PDF reference changed.');
      }
      publicHeaders(res);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="reviewed-${item.case_id}.pdf"`,
        'Content-Length': String(pdf.pdf_bytes.length), 'X-Content-SHA256': pdf.pdf_sha256 });
      res.send(pdf.pdf_bytes);
    } catch (error) { respondError(res, error); }
  });

  router.post('/signer/:token/accept', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
    try {
      const item = await db.transaction(async query => {
        const packageRecord = await signerPackage(query, req.params.token);
        const cases = await query('SELECT state FROM governed_cases WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [packageRecord.case_id, packageRecord.tenant_id]);
        if (cases[0]?.state !== 'exported') throw problem('SIGNER_LINK_UNAVAILABLE', 'This signer package is not available.', 404);
        const pdf = await storedPdf(query, packageRecord.tenant_id, packageRecord.case_id);
        if (pdf.id !== packageRecord.pdf_id || pdf.pdf_sha256 !== packageRecord.pdf_sha256) {
          throw problem('PDF_CHECKSUM_MISMATCH', 'Signer package PDF reference changed.');
        }
        const typedName = String(req.body?.typedName || '').trim();
        if (packageRecord.accepted) throw problem('ALREADY_ACCEPTED', 'Acceptance was already recorded.');
        if (typedName.toLocaleLowerCase() !== packageRecord.signer_name.trim().toLocaleLowerCase() ||
            req.body?.accepted !== 'yes' || req.body?.pdfSha256 !== packageRecord.pdf_sha256) {
          throw problem('SIGNER_ATTESTATION_INVALID', 'Confirm the named signer, acceptance, and exact PDF digest.', 422);
        }
        const attestation = 'I reviewed the PDF identified by its SHA-256 digest and accept its terms as the named signer.';
        const occurredAt = new Date().toISOString();
        const details = { identityVerified: false, externalSignatureReceipt: false, crmReceipt: false,
          evidenceType: 'named_token_self_attestation' };
        const evidenceDigest = sha256(Buffer.from(canonical({ packageId: packageRecord.id, pdfSha256: packageRecord.pdf_sha256,
          signerName: packageRecord.signer_name, attestation, occurredAt, details }), 'utf8'));
        const rows = await query(
          `INSERT INTO governed_signer_events
           (id,tenant_id,package_id,event_type,actor_id,signer_name,pdf_sha256,
            method,attestation,evidence_sha256,details,occurred_at)
           VALUES ($1,$2,$3,'signer_accepted',NULL,$4,$5,'token_self_attestation',$6,$7,$8::jsonb,$9)
           ON CONFLICT (tenant_id,package_id,event_type) DO NOTHING RETURNING id`,
          [crypto.randomUUID(), packageRecord.tenant_id, packageRecord.id, packageRecord.signer_name,
            packageRecord.pdf_sha256, attestation, evidenceDigest, JSON.stringify(details), occurredAt]
        );
        if (!rows[0]) throw problem('ALREADY_ACCEPTED', 'Acceptance was already recorded.');
        return packageRecord;
      });
      publicHeaders(res);
      res.status(201).type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Acceptance recorded</title>
        <h1>Acceptance recorded</h1><p>${escapeHtml(item.signer_name)} accepted the reviewed PDF identified by SHA-256
        <code>${item.pdf_sha256}</code>.</p><p>This is a token-based acknowledgement, without independent identity verification or external signature receipt.</p></html>`);
    } catch (error) { respondError(res, error); }
  });

  function attachPrivate() {
    router.post('/cases/from-reviewed-document', async (req, res) => {
      try {
        const ctx = workflow.context(req.headers, req.user);
        if (!workflow.config.createRoles.includes(ctx.role)) {
          throw problem('FORBIDDEN', 'Role cannot create release cases.', 403);
        }
        const kind = String(req.body?.sourceType || '');
        const id = Number(req.body?.sourceId);
        const reviewed = await loadReviewedDocument(db.query, kind, id, ctx.actorId);
        const item = workflow.createCase({
          subjectRef: req.body?.subjectRef || `${kind}:${id}`,
          policyVersion: req.body?.policyVersion,
          effectiveAt: req.body?.effectiveAt,
          sourceSnapshot: { kind, id, version: reviewed.source.version, sha256: reviewed.digest },
        }, ctx);
        if (!inScope(req, item.subjectRef)) return res.status(403).json({ error: 'SUBJECT_SCOPE_REQUIRED' });
        const rows = await db.query(
          `INSERT INTO governed_cases
           (id,tenant_id,idempotency_key,case_type,subject_ref,state,policy_version,
            effective_at,source_snapshot,retention_until,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NULL,$10)
           ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING *`,
          [item.id,item.tenantId,item.idempotencyKey,item.caseType,item.subjectRef,item.state,
            item.policyVersion,item.effectiveAt,JSON.stringify(item.sourceSnapshot),item.createdBy]
        );
        if (rows[0]) return res.status(201).json(rows[0]);
        const prior = await db.query('SELECT * FROM governed_cases WHERE tenant_id=$1 AND idempotency_key=$2',
          [ctx.tenantId, ctx.idempotencyKey]);
        if (!prior[0] || prior[0].created_by !== ctx.actorId || prior[0].subject_ref !== item.subjectRef ||
            prior[0].policy_version !== item.policyVersion ||
            new Date(prior[0].effective_at).toISOString() !== item.effectiveAt ||
            canonical(prior[0].source_snapshot) !== canonical(item.sourceSnapshot)) {
          throw problem('IDEMPOTENCY_PAYLOAD_CONFLICT', 'Idempotency key was used for another release case.');
        }
        res.json({ ...prior[0], idempotentReplay: true });
      } catch (error) { respondError(res, error); }
    });

    router.get('/cases/:id/release-artifacts', async (req, res) => {
      try {
        const current = await caseInScope(db.query, req);
        const pdfRows = await db.query(
          `SELECT id,source_kind,source_id,source_version,source_sha256,pdf_sha256,
                  octet_length(pdf_bytes) AS byte_size,rendered_by,rendered_at
           FROM governed_rendered_pdfs WHERE tenant_id=$1 AND case_id=$2`, [tenant(req), current.id]
        );
        const packages = await db.query(
          `SELECT p.id,p.signer_name,p.signer_title,p.prepared_by,p.prepared_at,
             (SELECT e.occurred_at FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
              AND e.package_id=p.id AND e.event_type='handoff_recorded') AS handed_off_at,
             (SELECT e.method FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
              AND e.package_id=p.id AND e.event_type='handoff_recorded') AS handoff_method,
             (SELECT e.occurred_at FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
              AND e.package_id=p.id AND e.event_type='signer_accepted') AS accepted_at,
             (SELECT e.evidence_sha256 FROM governed_signer_events e WHERE e.tenant_id=p.tenant_id
              AND e.package_id=p.id AND e.event_type='signer_accepted') AS acceptance_evidence_sha256
           FROM governed_signer_packages p WHERE p.tenant_id=$1 AND p.case_id=$2
           ORDER BY p.prepared_at,p.id`, [tenant(req), current.id]
        );
        res.set('Cache-Control', 'private, no-store');
        res.json({ pdf: pdfRows[0] || null, packages,
          externalSignatureReceipt: false, crmReceipt: false });
      } catch (error) { respondError(res, error); }
    });

    router.post('/cases/:id/render-pdf', async (req, res) => {
      try {
        const ctx = workflow.context(req.headers, req.user);
        if (!['integration_operator','proposal_manager'].includes(ctx.role)) {
          throw problem('FORBIDDEN', 'A release operator is required to render the reviewed PDF.', 403);
        }
        const result = await db.transaction(async query => {
          const current = await caseInScope(query, req, true);
          const existing = await query('SELECT id,pdf_sha256 FROM governed_rendered_pdfs WHERE tenant_id=$1 AND case_id=$2',
            [ctx.tenantId,current.id]);
          if (existing[0]) return { ...existing[0], idempotentReplay: true };
          if (current.state !== 'export_queued') {
            throw problem('EXPORT_NOT_QUEUED', 'Complete governed reviews and queue export before rendering.');
          }
          const binding = current.source_snapshot;
          if (!binding || !['proposal','sow'].includes(binding.kind)) {
            throw problem('REVIEWED_SOURCE_REQUIRED', 'This case has no reviewed proposal or SOW binding.');
          }
          const evidence = await query(
            'SELECT kind,source_version,sha256 FROM governed_evidence WHERE tenant_id=$1 AND case_id=$2',
            [ctx.tenantId,current.id]
          );
          const kinds = new Set(evidence.map(item => item.kind));
          if (!['draft_version','commercial_review','legal_review','client_approval'].every(kind => kinds.has(kind)) ||
              !evidence.some(item => item.kind === 'draft_version' && Number(item.source_version) === Number(binding.version)
                && item.sha256 === binding.sha256)) {
            throw problem('REVIEW_EVIDENCE_REQUIRED', 'Draft digest, commercial, legal, and client approval evidence are required.');
          }
          const reviewed = await loadReviewedDocument(query, binding.kind, binding.id, current.created_by);
          assertBinding(binding, reviewed);
          const bytes = await renderPdf(reviewed.source);
          const pdfId = crypto.randomUUID();
          const pdfDigest = sha256(bytes);
          await query(
            `INSERT INTO governed_rendered_pdfs
             (id,tenant_id,case_id,source_kind,source_id,source_version,
              source_sha256,pdf_bytes,pdf_sha256,rendered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [pdfId,ctx.tenantId,current.id,binding.kind,binding.id,binding.version,
              binding.sha256,bytes,pdfDigest,ctx.actorId]
          );
          await query(
            `INSERT INTO governed_events
             (id,tenant_id,case_id,idempotency_key,event_type,action,from_state,to_state,
              reason,actor_id,actor_role,details)
             VALUES ($1,$2,$3,$4,'artifact','render_pdf',$5,$5,$6,$7,$8,$9::jsonb)`,
            [crypto.randomUUID(),ctx.tenantId,current.id,ctx.idempotencyKey,current.state,
              'Rendered approved source into immutable local PDF',ctx.actorId,ctx.role,
              JSON.stringify({ pdfId,pdfSha256:pdfDigest,sourceSha256:binding.sha256,
                externalRendererReceipt:false })]
          );
          return { id: pdfId, pdf_sha256: pdfDigest, byte_size: bytes.length };
        });
        res.status(result.idempotentReplay ? 200 : 201).json(result);
      } catch (error) { respondError(res, error); }
    });

    router.get('/cases/:id/pdf', async (req, res) => {
      try {
        const current = await caseInScope(db.query, req);
        const pdf = await storedPdf(db.query, tenant(req), current.id);
        res.set({ 'Content-Type':'application/pdf',
          'Content-Disposition':`attachment; filename="reviewed-${current.id}.pdf"`,
          'Content-Length':String(pdf.pdf_bytes.length), 'X-Content-SHA256':pdf.pdf_sha256,
          'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' });
        res.send(pdf.pdf_bytes);
      } catch (error) { respondError(res, error); }
    });

    router.post('/cases/:id/signer-packages', async (req, res) => {
      try {
        const ctx = workflow.context(req.headers, req.user);
        if (!['proposal_manager','account_owner'].includes(ctx.role)) {
          throw problem('FORBIDDEN', 'A proposal manager or account owner must prepare signer packages.', 403);
        }
        const signerName = String(req.body?.signerName || '').trim();
        const signerTitle = String(req.body?.signerTitle || '').trim();
        if (signerName.length < 2 || signerName.length > 160 || signerTitle.length > 160) {
          throw problem('SIGNER_REQUIRED', 'A named signer of 2-160 characters is required.', 422);
        }
        const token = crypto.randomBytes(32).toString('base64url');
        const result = await db.transaction(async query => {
          const current = await caseInScope(query, req, true);
          if (current.state !== 'exported') throw problem('PDF_NOT_EXPORTED', 'Record the reviewed PDF export before preparing a signer package.');
          const pdf = await storedPdf(query, ctx.tenantId, current.id);
          const rows = await query(
            `INSERT INTO governed_signer_packages
             (id,tenant_id,case_id,pdf_id,idempotency_key,signer_name,signer_title,token_sha256,prepared_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING id,signer_name,signer_title`,
            [crypto.randomUUID(),ctx.tenantId,current.id,pdf.id,ctx.idempotencyKey,
              signerName,signerTitle || null,sha256(Buffer.from(token)),ctx.actorId]
          );
          if (rows[0]) return { ...rows[0], signerPath:`${basePath}/signer/${token}`, tokenShownOnce:true };
          const prior = await query(
            'SELECT id,case_id,pdf_id,signer_name,signer_title,prepared_by FROM governed_signer_packages WHERE tenant_id=$1 AND idempotency_key=$2',
            [ctx.tenantId,ctx.idempotencyKey]
          );
          if (!prior[0] || prior[0].case_id !== current.id || prior[0].pdf_id !== pdf.id ||
              prior[0].signer_name !== signerName || (prior[0].signer_title || '') !== signerTitle ||
              prior[0].prepared_by !== ctx.actorId) {
            throw problem('IDEMPOTENCY_PAYLOAD_CONFLICT', 'Idempotency key belongs to a different signer package.');
          }
          return { id:prior[0].id,signer_name:signerName,signer_title:signerTitle || null,
            idempotentReplay:true,tokenShownOnce:false };
        });
        res.status(result.idempotentReplay ? 200 : 201).json(result);
      } catch (error) { respondError(res, error); }
    });

    router.post('/cases/:id/signer-packages/:packageId/handoffs', async (req, res) => {
      try {
        const ctx = workflow.context(req.headers, req.user);
        if (!['proposal_manager','account_owner'].includes(ctx.role)) {
          throw problem('FORBIDDEN', 'A proposal manager or account owner must record handoff.', 403);
        }
        const method = String(req.body?.method || '');
        const attestation = String(req.body?.attestation || '').trim();
        if (!['manual_secure_link','in_person'].includes(method) || attestation.length < 8 || attestation.length > 2000) {
          throw problem('HANDOFF_ATTESTATION_REQUIRED', 'Choose a manual channel and provide a specific 8-2000 character attestation.', 422);
        }
        const current = await caseInScope(db.query, req);
        if (current.state !== 'exported') throw problem('PDF_NOT_EXPORTED', 'This release is not in the exported state.');
        const packages = await db.query(
          'SELECT * FROM governed_signer_packages WHERE id=$1 AND tenant_id=$2 AND case_id=$3',
          [req.params.packageId,ctx.tenantId,current.id]
        );
        if (!packages[0]) throw problem('PACKAGE_NOT_FOUND', 'Signer package not found.', 404);
        const pdf = await storedPdf(db.query, ctx.tenantId, current.id);
        if (pdf.id !== packages[0].pdf_id) throw problem('PDF_CHECKSUM_MISMATCH', 'Signer package PDF reference changed.');
        const occurredAt = new Date().toISOString();
        const details = { externalDeliveryVerified:false, crmReceipt:false, recordedByRole:ctx.role };
        const evidenceDigest = sha256(Buffer.from(canonical({ packageId:packages[0].id,
          pdfSha256:pdf.pdf_sha256,method,attestation,actorId:ctx.actorId,occurredAt,details }), 'utf8'));
        const rows = await db.query(
          `INSERT INTO governed_signer_events
           (id,tenant_id,package_id,event_type,actor_id,signer_name,pdf_sha256,
            method,attestation,evidence_sha256,details,occurred_at)
           VALUES ($1,$2,$3,'handoff_recorded',$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
           ON CONFLICT (tenant_id,package_id,event_type) DO NOTHING RETURNING id,occurred_at,evidence_sha256`,
          [crypto.randomUUID(),ctx.tenantId,packages[0].id,ctx.actorId,packages[0].signer_name,
            pdf.pdf_sha256,method,attestation,evidenceDigest,JSON.stringify(details),occurredAt]
        );
        if (!rows[0]) throw problem('HANDOFF_ALREADY_RECORDED', 'A handoff was already recorded for this package.');
        res.status(201).json({ ...rows[0], evidenceType:'operator_attested_manual_handoff',
          externalDeliveryVerified:false });
      } catch (error) { respondError(res, error); }
    });
  }

  return { attachPrivate };
}

module.exports = { createReleaseRoutes };
