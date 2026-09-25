/**
 * Change-order tracking.
 *
 * Replaces `gap-no-changeorder-tracking`, which only logged that the feature
 * was missing. Scope creep is the primary SOW dispute source: every change to
 * an agreed SOW needs a numbered record with its own cost/schedule impact and
 * an explicit approval, so the contract total can always be reconstructed.
 *
 * Contract:
 *   GET    /api/change-orders?sowId=…            list (filterable)
 *   GET    /api/change-orders/:id                one, with its approval trail
 *   POST   /api/change-orders                    raise against a SOW
 *   POST   /api/change-orders/:id/approve        approve (or reject) — role gated
 *   GET    /api/change-orders/:id/impact         running impact on the SOW
 *
 * Mounted as a factory so it shares the host's auth/RBAC middleware rather
 * than re-implementing them.
 */
const express = require('express');

const OPEN_STATUSES = ['draft', 'submitted'];
const DECISION_STATUSES = ['approved', 'rejected'];

function createChangeOrderRouter({ pool, authMiddleware, checkRole }) {
  const router = express.Router();

  const CO_TABLE = `
    CREATE TABLE IF NOT EXISTS change_orders (
      id SERIAL PRIMARY KEY,
      sow_id INTEGER REFERENCES sows(id) ON DELETE CASCADE,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
      co_number VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      reason TEXT,
      scope_delta TEXT,
      cost_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
      schedule_delta_days INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      raised_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decided_at TIMESTAMP,
      decision_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (sow_id, co_number)
    )`;

  let ready = false;
  async function ensureTable() {
    if (ready) return;
    await pool.query(CO_TABLE);
    ready = true;
  }

  async function nextCoNumber(sowId) {
    const r = await pool.query(
      'SELECT co_number FROM change_orders WHERE sow_id = $1 ORDER BY id DESC LIMIT 1',
      [sowId]
    );
    const last = r.rows[0]?.co_number;
    const seq = last ? parseInt(String(last).replace(/\D/g, ''), 10) + 1 : 1;
    return `CO-${String(seq).padStart(3, '0')}`;
  }

  /** Recalculate the contracted totals a SOW would have after approved COs. */
  async function impact(sowId) {
    const sowRes = await pool.query('SELECT total_amount FROM sows WHERE id = $1', [sowId]);
    if (sowRes.rows.length === 0) return null;
    const base = Number(sowRes.rows[0].total_amount || 0);

    const agg = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'approved' THEN cost_delta ELSE 0 END), 0) AS approved_cost,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN schedule_delta_days ELSE 0 END), 0) AS approved_days,
         COUNT(*) FILTER (WHERE status IN ('draft','submitted')) AS open_count,
         COUNT(*) AS total_count
       FROM change_orders WHERE sow_id = $1`,
      [sowId]
    );
    const a = agg.rows[0];
    return {
      sowId,
      baseAmount: base,
      approvedCostDelta: Number(a.approved_cost),
      revisedAmount: base + Number(a.approved_cost),
      approvedScheduleDeltaDays: Number(a.approved_days),
      openChangeOrders: parseInt(a.open_count, 10),
      totalChangeOrders: parseInt(a.total_count, 10),
    };
  }

  router.get('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { sowId, proposalId, status } = req.query;
      const where = [];
      const args = [];
      if (sowId) { args.push(sowId); where.push(`sow_id = $${args.length}`); }
      if (proposalId) { args.push(proposalId); where.push(`proposal_id = $${args.length}`); }
      if (status) { args.push(status); where.push(`status = $${args.length}`); }
      const sql =
        'SELECT * FROM change_orders' +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY id DESC LIMIT 200';
      const r = await pool.query(sql, args);
      res.json({ changeOrders: r.rows, openStatuses: OPEN_STATUSES, decisionStatuses: DECISION_STATUSES });
    } catch (err) {
      console.error('change-orders list error:', err);
      res.status(500).json({ error: err.message || 'Failed to list change orders' });
    }
  });

  router.get('/impact/:sowId', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const result = await impact(Number(req.params.sowId));
      if (!result) return res.status(404).json({ error: 'SOW not found' });
      res.json(result);
    } catch (err) {
      console.error('change-orders impact error:', err);
      res.status(500).json({ error: err.message || 'Failed to compute impact' });
    }
  });

  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const r = await pool.query('SELECT * FROM change_orders WHERE id = $1', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Change order not found' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('change-orders get error:', err);
      res.status(500).json({ error: err.message || 'Failed to load change order' });
    }
  });

  router.post('/', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const { sowId, proposalId, title, reason, scopeDelta, costDelta, scheduleDeltaDays } = req.body || {};
      if (!sowId) return res.status(400).json({ error: 'sowId is required' });
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'title is required' });

      const cost = Number(costDelta ?? 0);
      const days = Number(scheduleDeltaDays ?? 0);
      if (!Number.isFinite(cost)) return res.status(400).json({ error: 'costDelta must be a number' });
      if (!Number.isFinite(days)) return res.status(400).json({ error: 'scheduleDeltaDays must be a number' });

      const sow = await pool.query('SELECT id FROM sows WHERE id = $1', [sowId]);
      if (sow.rows.length === 0) return res.status(404).json({ error: 'SOW not found' });

      const coNumber = await nextCoNumber(Number(sowId));
      const insert = await pool.query(
        `INSERT INTO change_orders
           (sow_id, proposal_id, co_number, title, reason, scope_delta, cost_delta, schedule_delta_days, status, raised_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9)
         RETURNING *`,
        [sowId, proposalId || null, coNumber, String(title).trim(), reason || null,
         scopeDelta || null, cost, days, req.user.id]
      );
      res.status(201).json(insert.rows[0]);
    } catch (err) {
      console.error('change-orders create error:', err);
      res.status(500).json({ error: err.message || 'Failed to create change order' });
    }
  });

  router.post('/:id/submit', authMiddleware, async (req, res) => {
    try {
      await ensureTable();
      const r = await pool.query(
        `UPDATE change_orders SET status = 'submitted', updated_at = NOW()
         WHERE id = $1 AND status = 'draft' RETURNING *`,
        [req.params.id]
      );
      if (r.rows.length === 0) {
        return res.status(409).json({ error: 'Only a draft change order can be submitted' });
      }
      res.json(r.rows[0]);
    } catch (err) {
      console.error('change-orders submit error:', err);
      res.status(500).json({ error: err.message || 'Failed to submit change order' });
    }
  });

  /**
   * Decision is deliberately role-gated and records who decided — the whole
   * point of the feature is that scope changes are never implicit.
   */
  router.post('/:id/decision', authMiddleware, checkRole('admin', 'manager'), async (req, res) => {
    try {
      await ensureTable();
      const { decision, note } = req.body || {};
      if (!DECISION_STATUSES.includes(decision)) {
        return res.status(400).json({ error: `decision must be one of: ${DECISION_STATUSES.join(', ')}` });
      }
      const current = await pool.query('SELECT * FROM change_orders WHERE id = $1', [req.params.id]);
      if (current.rows.length === 0) return res.status(404).json({ error: 'Change order not found' });
      if (!OPEN_STATUSES.includes(current.rows[0].status)) {
        return res.status(409).json({ error: 'This change order has already been decided' });
      }

      const r = await pool.query(
        `UPDATE change_orders
           SET status = $2, decided_by = $3, decided_at = NOW(), decision_note = $4, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id, decision, req.user.id, note || null]
      );
      res.json({ changeOrder: r.rows[0], impact: await impact(r.rows[0].sow_id) });
    } catch (err) {
      console.error('change-orders decision error:', err);
      res.status(500).json({ error: err.message || 'Failed to record decision' });
    }
  });

  return router;
}

module.exports = createChangeOrderRouter;
