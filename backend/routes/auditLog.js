/**
 * Audit log.
 *
 * Replaces the audit half of `gap-no-notifications-audit-log-or-rbac`. RBAC
 * already exists in the host (`checkRole`), but nothing recorded who changed
 * what. For a contract tool the trail matters: a proposal/SOW revision without
 * an attributable actor is not evidence.
 *
 * Contract:
 *   GET  /api/audit?entityType=…&entityId=…   filterable trail
 *   POST /api/audit                           record an event (server-side callers)
 *
 * Events are append-only. There is deliberately no update/delete endpoint.
 */
const express = require('express');

function createAuditRouter({ pool, authMiddleware, checkRole }) {
  const router = express.Router();

  const AUDIT_TABLE = `
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_email VARCHAR(255),
      action VARCHAR(128) NOT NULL,
      entity_type VARCHAR(64),
      entity_id VARCHAR(64),
      summary TEXT,
      before_state JSONB,
      after_state JSONB,
      ip_address VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  let ready = false;
  async function ensureTable() {
    if (ready) return;
    await pool.query(AUDIT_TABLE);
    ready = true;
  }

  /**
   * Append one event. Safe to call from other modules; never throws into the
   * caller's happy path — an audit failure is logged loudly but must not roll
   * back the business action that triggered it.
   */
  async function record(event) {
    try {
      await ensureTable();
      await pool.query(
        `INSERT INTO audit_log
           (actor_id, actor_email, action, entity_type, entity_id, summary, before_state, after_state, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          event.actorId ?? null,
          event.actorEmail ?? null,
          event.action,
          event.entityType ?? null,
          event.entityId != null ? String(event.entityId) : null,
          event.summary ?? null,
          event.before ? JSON.stringify(event.before) : null,
          event.after ? JSON.stringify(event.after) : null,
          event.ip ?? null,
        ]
      );
      return true;
    } catch (err) {
      console.error('audit record failed:', err.message);
      return false;
    }
  }

  router.get('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { entityType, entityId, action, actorId, limit } = req.query;
      const where = [];
      const args = [];
      if (entityType) { args.push(entityType); where.push(`entity_type = $${args.length}`); }
      if (entityId) { args.push(String(entityId)); where.push(`entity_id = $${args.length}`); }
      if (action) { args.push(action); where.push(`action = $${args.length}`); }
      if (actorId) { args.push(actorId); where.push(`actor_id = $${args.length}`); }

      const take = Math.min(parseInt(limit, 10) || 100, 500);
      args.push(take);
      const sql =
        'SELECT * FROM audit_log' +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        ` ORDER BY id DESC LIMIT $${args.length}`;
      const r = await pool.query(sql, args);
      res.json({ events: r.rows, appendOnly: true });
    } catch (err) {
      console.error('audit list error:', err);
      res.status(500).json({ error: err.message || 'Failed to read audit log' });
    }
  });

  /**
   * Explicit write endpoint for actions performed outside the API layer
   * (e.g. approval links, scheduled jobs). Any authenticated actor may record
   * an event, but the actor is always taken from the token — the caller cannot
   * attribute an action to someone else. Application writes should call
   * `record()` directly rather than round-tripping through here.
   */
  router.post('/', authMiddleware, async (req, res) => {
    const b = req.body || {};
    if (!b.action || !String(b.action).trim()) {
      return res.status(400).json({ error: 'action is required' });
    }
    const ok = await record({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: String(b.action).trim(),
      entityType: b.entityType,
      entityId: b.entityId,
      summary: b.summary,
      before: b.before,
      after: b.after,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    });
    if (!ok) return res.status(500).json({ error: 'Failed to record audit event' });
    res.status(201).json({ recorded: true, actorFromToken: true });
  });

  // Expose the recorder on the router so other modules can call
  // `router.record({...})` without round-tripping through HTTP.
  router.record = record;

  return router;
}

module.exports = createAuditRouter;
