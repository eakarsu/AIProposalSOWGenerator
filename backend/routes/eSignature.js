/**
 * E-signature workflow.
 *
 * Replaces `gap-no-esignature-workflow`. The host had a proposal share link and
 * an approve endpoint, but no *signature* record: no named signer, no
 * captured consent, no tamper-evident snapshot of what was signed.
 *
 * What this adds:
 *   - a signing request with a single-use token and an expiry
 *   - a hash of the document content at signing time, so a later edit is
 *     detectable (a signature over content nobody pinned is not evidence)
 *   - named signer, title, consent flag, IP and timestamp
 *   - void/revocation before signing
 *
 * Contract:
 *   POST /api/e-signatures                      request signature
 *   GET  /api/e-signatures?proposalId=&sowId=   list requests
 *   GET  /api/e-signatures/:token/public        signing page payload (no auth)
 *   POST /api/e-signatures/:token/sign          capture the signature
 *   POST /api/e-signatures/:id/void             revoke before signing
 */
const crypto = require('crypto');
const express = require('express');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function createESignRouter({ pool, authMiddleware, checkRole }) {
  const router = express.Router();

  const TABLE = `
    CREATE TABLE IF NOT EXISTS signature_requests (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
      sow_id INTEGER REFERENCES sows(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      signer_name VARCHAR(255) NOT NULL,
      signer_email VARCHAR(255) NOT NULL,
      signer_title VARCHAR(255),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      document_digest VARCHAR(64) NOT NULL,
      signature_digest VARCHAR(64),
      consent_text TEXT,
      signer_ip VARCHAR(64),
      signed_at TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      voided_at TIMESTAMP,
      void_reason TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  let ready = false;
  async function ensureTable() {
    if (ready) return;
    await pool.query(TABLE);
    ready = true;
  }

  /**
   * Canonical snapshot of what the signer is agreeing to. We hash the fields
   * that constitute the agreement rather than a rendered PDF so the digest is
   * stable and reproducible.
   */
  function documentSnapshot(row) {
    return [
      `title:${row.title ?? ''}`,
      `amount:${row.total_amount ?? ''}`,
      `scope:${row.scope_of_work ?? row.scope ?? ''}`,
      `deliverables:${row.deliverables ?? ''}`,
      `timeline:${row.timeline ?? ''}`,
      `terms:${row.terms_conditions ?? row.payment_terms ?? ''}`,
    ].join('\n');
  }

  async function loadDocument(proposalId, sowId) {
    if (proposalId) {
      const r = await pool.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
      return r.rows[0] ? { kind: 'proposal', row: r.rows[0] } : null;
    }
    const r = await pool.query('SELECT * FROM sows WHERE id = $1', [sowId]);
    return r.rows[0] ? { kind: 'sow', row: r.rows[0] } : null;
  }

  const CONSENT_TEXT =
    'I confirm I am authorised to sign on behalf of the named party, I have reviewed the ' +
    'document presented, and I agree to be bound by its terms electronically.';

  // Admins and managers may act on any signature request; everyone else is
  // scoped to the requests and documents they own.
  const isPrivileged = (user) => !!user && (user.role === 'admin' || user.role === 'manager');

  router.post('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { proposalId, sowId, signerName, signerEmail, signerTitle, expiresInHours } = req.body || {};
      if (!proposalId && !sowId) return res.status(400).json({ error: 'proposalId or sowId is required' });
      if (!signerName || !String(signerName).trim()) return res.status(400).json({ error: 'signerName is required' });
      if (!signerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(signerEmail))) {
        return res.status(400).json({ error: 'A valid signerEmail is required' });
      }

      const doc = await loadDocument(proposalId, sowId);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      if (!isPrivileged(req.user) && doc.row.created_by != null && Number(doc.row.created_by) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'You do not own this document' });
      }

      const hours = Math.min(Math.max(Number(expiresInHours) || 168, 1), 24 * 90);
      const token = crypto.randomBytes(32).toString('hex');
      const digest = sha256(documentSnapshot(doc.row));

      const insert = await pool.query(
        `INSERT INTO signature_requests
           (proposal_id, sow_id, token_hash, signer_name, signer_email, signer_title,
            status, document_digest, consent_text, expires_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,NOW() + ($9 || ' hours')::interval, $10)
         RETURNING id, proposal_id, sow_id, signer_name, signer_email, signer_title,
                   status, document_digest, expires_at, created_at`,
        [proposalId || null, sowId || null, sha256(token), String(signerName).trim(),
         String(signerEmail).toLowerCase().trim(), signerTitle || null,
         digest, CONSENT_TEXT, String(hours), req.user.id]
      );

      res.status(201).json({
        request: insert.rows[0],
        // Returned once to the caller for delivery; only the hash is stored.
        signingToken: token,
        consentText: CONSENT_TEXT,
        documentDigest: digest,
        delivery: {
          configured: false,
          note: 'No automated email/SMS delivery is configured. Deliver the signing token to the signer out-of-band.',
        },
      });
    } catch (err) {
      console.error('e-sign request error:', err);
      res.status(500).json({ error: err.message || 'Failed to create signature request' });
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { proposalId, sowId, status } = req.query;
      const where = [];
      const args = [];
      if (!isPrivileged(req.user)) { args.push(req.user.id); where.push(`created_by = $${args.length}`); }
      if (proposalId) { args.push(proposalId); where.push(`proposal_id = $${args.length}`); }
      if (sowId) { args.push(sowId); where.push(`sow_id = $${args.length}`); }
      if (status) { args.push(status); where.push(`status = $${args.length}`); }
      const sql =
        `SELECT id, proposal_id, sow_id, signer_name, signer_email, signer_title, status,
                document_digest, signature_digest, signer_ip, signed_at, expires_at,
                voided_at, void_reason, created_at
           FROM signature_requests` +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY id DESC LIMIT 200';
      const r = await pool.query(sql, args);
      res.json({ requests: r.rows });
    } catch (err) {
      console.error('e-sign list error:', err);
      res.status(500).json({ error: err.message || 'Failed to list signature requests' });
    }
  });

  /**
   * Public payload for the signing page. Deliberately exposes no internal ids
   * beyond what the signer needs, and refuses expired/voided requests.
   */
  router.get('/:token/public', async (req, res) => {
    try {
      await ensureTable();
      const tokenHash = sha256(req.params.token);
      const r = await pool.query('SELECT * FROM signature_requests WHERE token_hash = $1', [tokenHash]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Signing link not found' });
      const reqRow = r.rows[0];

      if (reqRow.status === 'signed') {
        return res.status(409).json({ error: 'This document has already been signed', status: 'signed' });
      }
      if (reqRow.status === 'voided') {
        return res.status(409).json({ error: 'This signing request was revoked', status: 'voided' });
      }
      if (new Date(reqRow.expires_at) < new Date()) {
        await pool.query(
          `UPDATE signature_requests SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
          [reqRow.id]
        );
        return res.status(410).json({ error: 'This signing link has expired', status: 'expired' });
      }

      const doc = await loadDocument(reqRow.proposal_id, reqRow.sow_id);
      res.json({
        signerName: reqRow.signer_name,
        signerEmail: reqRow.signer_email,
        signerTitle: reqRow.signer_title,
        consentText: reqRow.consent_text,
        expiresAt: reqRow.expires_at,
        document: doc
          ? {
              type: doc.kind,
              title: doc.row.title,
              totalAmount: doc.row.total_amount,
              scope: doc.row.scope_of_work || doc.row.scope,
              deliverables: doc.row.deliverables,
              timeline: doc.row.timeline,
            }
          : null,
        documentDigest: reqRow.document_digest,
      });
    } catch (err) {
      console.error('e-sign public error:', err);
      res.status(500).json({ error: err.message || 'Failed to load signing page' });
    }
  });

  router.post('/:token/sign', async (req, res) => {
    try {
      await ensureTable();
      const tokenHash = sha256(req.params.token);
      const r = await pool.query('SELECT * FROM signature_requests WHERE token_hash = $1', [tokenHash]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Signing link not found' });
      const reqRow = r.rows[0];

      if (reqRow.status !== 'pending') {
        return res.status(409).json({ error: `This request is ${reqRow.status} and cannot be signed` });
      }
      if (new Date(reqRow.expires_at) < new Date()) {
        await pool.query(`UPDATE signature_requests SET status = 'expired' WHERE id = $1`, [reqRow.id]);
        return res.status(410).json({ error: 'This signing link has expired' });
      }

      const { signerName, signerTitle, acceptedConsent, expectedDigest } = req.body || {};
      if (acceptedConsent !== true) {
        return res.status(400).json({ error: 'acceptedConsent must be true to sign' });
      }
      if (!signerName || !String(signerName).trim()) {
        return res.status(400).json({ error: 'signerName is required' });
      }

      // Detect a document edited after the request was created: the signer must
      // never be agreeing to content that changed under the link.
      const doc = await loadDocument(reqRow.proposal_id, reqRow.sow_id);
      const currentDigest = sha256(documentSnapshot(doc.row));
      if (expectedDigest && expectedDigest !== currentDigest) {
        return res.status(409).json({
          error: 'The document changed after this signing request was created. Request a new link.',
        });
      }
      if (currentDigest !== reqRow.document_digest) {
        return res.status(409).json({
          error: 'The document changed after this signing request was created. Request a new link.',
        });
      }

      // Signature evidence: signer identity + document digest + timestamp.
      const signedAtIso = new Date().toISOString();
      const signatureDigest = sha256(
        [reqRow.document_digest, reqRow.signer_email, signedAtIso, String(signerName).trim()].join('|')
      );
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

      await pool.query(
        `UPDATE signature_requests
           SET status = 'signed', signer_name = $2, signer_title = $3,
               signature_digest = $4, signer_ip = $5, signed_at = NOW()
         WHERE id = $1`,
        [reqRow.id, String(signerName).trim(), signerTitle || reqRow.signer_title,
         signatureDigest, ip ? String(ip).slice(0, 64) : null]
      );

      // Reflect the signature on the owning document.
      if (reqRow.proposal_id) {
        await pool.query(
          `UPDATE proposals SET accepted_at = NOW(),
             status = CASE WHEN status = 'sent' THEN 'accepted' ELSE status END
           WHERE id = $1`,
          [reqRow.proposal_id]
        );
      }
      if (reqRow.sow_id) {
        await pool.query(
          `UPDATE sows SET signed_at = NOW(),
             status = CASE WHEN status IN ('draft','final') THEN 'signed' ELSE status END
           WHERE id = $1`,
          [reqRow.sow_id]
        );
      }

      res.json({
        signed: true,
        signatureDigest,
        documentDigest: reqRow.document_digest,
        signedAt: signedAtIso,
        signerName: String(signerName).trim(),
        signerEmail: reqRow.signer_email,
      });
    } catch (err) {
      console.error('e-sign sign error:', err);
      res.status(500).json({ error: err.message || 'Failed to record signature' });
    }
  });

  router.post('/:id/void', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { reason } = req.body || {};
      const existing = await pool.query(
        'SELECT id, created_by, status FROM signature_requests WHERE id = $1',
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Signing request not found' });
      }
      if (!isPrivileged(req.user) && Number(existing.rows[0].created_by) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'You do not own this signing request' });
      }
      const r = await pool.query(
        `UPDATE signature_requests
           SET status = 'voided', voided_by = $2, voided_at = NOW(), void_reason = $3
         WHERE id = $1 AND status = 'pending' RETURNING id, status, voided_at, void_reason`,
        [req.params.id, req.user.id, reason || null]
      );
      if (r.rows.length === 0) {
        return res.status(409).json({ error: 'Only a pending signing request can be revoked' });
      }
      res.json(r.rows[0]);
    } catch (err) {
      console.error('e-sign void error:', err);
      res.status(500).json({ error: err.message || 'Failed to revoke signing request' });
    }
  });

  return router;
}

module.exports = createESignRouter;
