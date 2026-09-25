/**
 * Clause / term recommendation.
 *
 * Replaces `gap-no-ai-clauseterm-recommendation`. Unlike the stub — which sent
 * a generic prompt to a model and logged the gap — this treats clauses as
 * *records*: each recommendation names the clause type, the risk it addresses,
 * the fallback position to negotiate toward, and is stored against the
 * proposal/SOW it was produced for so it can be reviewed before it reaches a
 * client.
 *
 * Contract:
 *   POST /api/clause-terms/recommend     recommend clauses for a proposal/SOW
 *   GET  /api/clause-terms?proposalId=   stored recommendations
 *   POST /api/clause-terms/:id/accept    accept a recommendation into the document
 *   POST /api/clause-terms/:id/reject    reject with a reason
 *
 * Recommendations are advisory and require explicit acceptance — generated
 * contract language must never silently enter a client-facing document.
 */
const express = require('express');

const CLAUSE_TYPES = [
  'scope_change_control',
  'payment_terms',
  'intellectual_property',
  'confidentiality',
  'limitation_of_liability',
  'warranty_disclaimer',
  'termination',
  'acceptance_criteria',
  'data_protection',
  'dispute_resolution',
];

function createClauseRouter({ pool, authMiddleware, checkRole, callOpenRouter, aiRateLimiter }) {
  const router = express.Router();

  const TABLE = `
    CREATE TABLE IF NOT EXISTS clause_recommendations (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
      sow_id INTEGER REFERENCES sows(id) ON DELETE CASCADE,
      clause_type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      rationale TEXT,
      risk_addressed TEXT,
      fallback_position TEXT,
      recommended_text TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'proposed',
      decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decided_at TIMESTAMP,
      decision_note TEXT,
      model VARCHAR(128),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  let ready = false;
  async function ensureTable() {
    if (ready) return;
    await pool.query(TABLE);
    ready = true;
  }

  const SYSTEM_PROMPT = `You are a contracts counsel for technology professional services with 20 years of experience negotiating SOWs and MSAs.

For each clause you recommend you MUST return a JSON object with exactly these keys:
  clause_type       one of the supplied clause type identifiers
  title             short human name for the clause
  rationale         why this clause belongs in this agreement (2-3 sentences)
  risk_addressed    the specific commercial or legal risk it mitigates
  fallback_position the weaker position to accept if the client pushes back
  recommended_text  the clause language itself, ready to paste

Rules:
- Clause language must be enforceable and unambiguous; avoid vague terms like "reasonable efforts" without a definition.
- Tailor to the supplied jurisdiction, deal size and client type.
- Do not invent statutory citations.
- Return ONLY a JSON array, no surrounding prose.`;

  function extractJson(text) {
    const trimmed = String(text).trim();
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('Model did not return a JSON array');
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  router.post('/recommend', authMiddleware, aiRateLimiter, async (req, res) => {
    try {
      await ensureTable();
      const {
        proposalId, sowId, clauseTypes, jurisdiction,
        dealSize, clientType, specialTerms,
      } = req.body || {};

      if (!proposalId && !sowId) {
        return res.status(400).json({ error: 'proposalId or sowId is required' });
      }

      let context = '';
      if (proposalId) {
        const p = await pool.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
        if (p.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
        const row = p.rows[0];
        context =
          `Document type: Proposal\nTitle: ${row.title}\n` +
          `Status: ${row.status}\nTotal: ${row.total_amount ?? 'n/a'}\n` +
          `Scope of work: ${String(row.scope_of_work || '').slice(0, 2000)}`;
      } else {
        const s = await pool.query('SELECT * FROM sows WHERE id = $1', [sowId]);
        if (s.rows.length === 0) return res.status(404).json({ error: 'SOW not found' });
        const row = s.rows[0];
        context =
          `Document type: Statement of Work\nTitle: ${row.title}\n` +
          `Status: ${row.status}\nTotal: ${row.total_amount ?? 'n/a'}\n` +
          `Scope: ${String(row.scope || '').slice(0, 2000)}\n` +
          `Payment terms: ${String(row.payment_terms || '').slice(0, 800)}`;
      }

      const types = (Array.isArray(clauseTypes) && clauseTypes.length ? clauseTypes : CLAUSE_TYPES)
        .filter((t) => CLAUSE_TYPES.includes(t));
      if (types.length === 0) {
        return res.status(400).json({ error: `clauseTypes must be drawn from: ${CLAUSE_TYPES.join(', ')}` });
      }

      const userPrompt =
        `Document under review:\n${context}\n\n` +
        `Jurisdiction: ${jurisdiction || 'unspecified'}\n` +
        `Deal size: ${dealSize || 'unspecified'}\n` +
        `Client type: ${clientType || 'unspecified'}\n` +
        (specialTerms ? `Special terms to account for: ${specialTerms}\n` : '') +
        `\nRecommend clauses for exactly these clause types: ${types.join(', ')}.\n` +
        `Return one JSON array element per clause type.`;

      const { content, tokensUsed, raw } = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt });

      let parsed;
      try {
        parsed = extractJson(content);
      } catch (e) {
        return res.status(502).json({ error: `Model returned unparseable output: ${e.message}` });
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return res.status(502).json({ error: 'Model returned no clauses' });
      }

      const saved = [];
      for (const c of parsed) {
        const clauseType = CLAUSE_TYPES.includes(c.clause_type) ? c.clause_type : 'scope_change_control';
        const text = String(c.recommended_text || '').trim();
        if (!text) continue;
        const insert = await pool.query(
          `INSERT INTO clause_recommendations
             (proposal_id, sow_id, clause_type, title, rationale, risk_addressed,
              fallback_position, recommended_text, status, model, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'proposed',$9,$10) RETURNING *`,
          [
            proposalId || null, sowId || null, clauseType,
            String(c.title || clauseType).slice(0, 255),
            c.rationale || null, c.risk_addressed || null, c.fallback_position || null,
            text, process.env.OPENROUTER_MODEL || null, req.user.id,
          ]
        );
        saved.push(insert.rows[0]);
      }

      res.status(201).json({
        recommendations: saved,
        clauseTypes: types,
        tokensUsed: tokensUsed ?? raw?.usage?.total_tokens ?? 0,
        advisory: 'Recommendations are proposed only. Accept one to add it to the document.',
      });
    } catch (err) {
      console.error('clause recommend error:', err);
      res.status(500).json({ error: err.message || 'Failed to recommend clauses' });
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { proposalId, sowId, status } = req.query;
      const where = [];
      const args = [];
      if (proposalId) { args.push(proposalId); where.push(`proposal_id = $${args.length}`); }
      if (sowId) { args.push(sowId); where.push(`sow_id = $${args.length}`); }
      if (status) { args.push(status); where.push(`status = $${args.length}`); }
      const sql =
        'SELECT * FROM clause_recommendations' +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY id DESC LIMIT 200';
      const r = await pool.query(sql, args);
      res.json({ recommendations: r.rows, clauseTypes: CLAUSE_TYPES });
    } catch (err) {
      console.error('clause list error:', err);
      res.status(500).json({ error: err.message || 'Failed to list recommendations' });
    }
  });

  async function decide(req, res, status) {
    try {
      await ensureTable();
      const { note } = req.body || {};
      const current = await pool.query('SELECT * FROM clause_recommendations WHERE id = $1', [req.params.id]);
      if (current.rows.length === 0) return res.status(404).json({ error: 'Recommendation not found' });
      if (current.rows[0].status !== 'proposed') {
        return res.status(409).json({ error: 'This recommendation has already been decided' });
      }
      const r = await pool.query(
        `UPDATE clause_recommendations
           SET status = $2, decided_by = $3, decided_at = NOW(), decision_note = $4
         WHERE id = $1 RETURNING *`,
        [req.params.id, status, req.user.id, note || null]
      );

      // Accepting folds the clause text into the owning document's terms field
      // so generated language never reaches a client without a human decision.
      if (status === 'accepted') {
        const rec = r.rows[0];
        const append = `\n\n## ${rec.title}\n${rec.recommended_text}`;
        if (rec.sow_id) {
          await pool.query(
            `UPDATE sows SET change_management = COALESCE(change_management,'') || $2, version = version + 1, updated_at = NOW()
             WHERE id = $1`,
            [rec.sow_id, append]
          );
        } else if (rec.proposal_id) {
          await pool.query(
            `UPDATE proposals SET terms_conditions = COALESCE(terms_conditions,'') || $2, version = version + 1, updated_at = NOW()
             WHERE id = $1`,
            [rec.proposal_id, append]
          );
        }
      }

      res.json(r.rows[0]);
    } catch (err) {
      console.error('clause decision error:', err);
      res.status(500).json({ error: err.message || 'Failed to record decision' });
    }
  }

  router.post('/:id/accept', authMiddleware, checkRole('admin', 'manager'), (req, res) => decide(req, res, 'accepted'));
  router.post('/:id/reject', authMiddleware, checkRole('admin', 'manager'), (req, res) => decide(req, res, 'rejected'));

  return router;
}

module.exports = createClauseRouter;
