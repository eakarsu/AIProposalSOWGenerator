// Custom Views router: 4 endpoints (2 VIZ + 2 NON-VIZ)
// 1. /win-rate (VIZ) - Proposal win rate chart, computed from the proposals table
// 2. /service-revenue-heatmap (VIZ) - Service line revenue heatmap, computed from
//    proposal_items joined to services; empty state when no line items exist
// 3. /sow-pdf/:id (NON-VIZ) - SOW document PDF export; 404 for missing/unauthorized
//    SOWs (never fabricates a document)
// 4. /template-rules (NON-VIZ CRUD) - Proposal template rules (pricing tiers, T&Cs);
//    reads for any authenticated user, writes restricted to admin/manager
//
// All endpoints require the same JWT auth middleware used by the rest of the API.

const express = require('express');
const PDFDocument = require('pdfkit');

function createCustomViewsRouter({ pool, authMiddleware, checkRole }) {
  if (!pool || !authMiddleware || !checkRole) {
    throw new Error('customViews router requires { pool, authMiddleware, checkRole }');
  }

  const router = express.Router();
  router.use(authMiddleware);

  const isPrivileged = (user) => !!user && (user.role === 'admin' || user.role === 'manager');

  async function ensureRulesTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS proposal_template_rules (
      id SERIAL PRIMARY KEY,
      tier_name VARCHAR(120) NOT NULL,
      min_amount NUMERIC(12,2) DEFAULT 0,
      max_amount NUMERIC(12,2) DEFAULT 0,
      discount_pct NUMERIC(5,2) DEFAULT 0,
      payment_terms TEXT DEFAULT '',
      terms_conditions TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const cnt = await pool.query('SELECT COUNT(*)::int AS c FROM proposal_template_rules');
    if (cnt.rows[0].c === 0) {
      await pool.query(`INSERT INTO proposal_template_rules (tier_name, min_amount, max_amount, discount_pct, payment_terms, terms_conditions)
        VALUES
        ('Starter', 0, 25000, 0, 'Net 30', '50% upfront, 50% on delivery. 30 day acceptance window.'),
        ('Growth', 25000, 100000, 5, 'Net 30', '30% upfront, 40% midpoint, 30% completion. Quarterly business reviews.'),
        ('Enterprise', 100000, 1000000, 10, 'Net 45', 'Milestone billing. Dedicated CSM. SLA 99.9%. Annual review.'),
        ('Strategic', 1000000, 99999999, 15, 'Net 60', 'Custom MSA. Executive sponsor. Mutual NDA. Liability cap 2x fees.')`);
    }
  }

  // =================== VIZ 1: Proposal Win Rate Chart ===================
  router.get('/win-rate', async (req, res) => {
    try {
      const emptyTotals = { won: 0, lost: 0, pending: 0, total: 0, winRate: 0 };

      const r = await pool.query(`
        SELECT status, COUNT(*)::int AS c, COALESCE(SUM(total_amount),0)::float AS amt
        FROM proposals GROUP BY status
      `);
      const totals = { ...emptyTotals };
      r.rows.forEach(row => {
        const s = (row.status || '').toLowerCase();
        if (s.includes('accept') || s === 'won' || s === 'approved') totals.won += row.c;
        else if (s.includes('reject') || s === 'lost' || s.includes('decline')) totals.lost += row.c;
        else totals.pending += row.c;
        totals.total += row.c;
      });
      totals.winRate = (totals.won + totals.lost) > 0
        ? +(totals.won / (totals.won + totals.lost) * 100).toFixed(1)
        : 0;

      const m = await pool.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
               COUNT(*)::int AS total,
               SUM(CASE WHEN LOWER(status) IN ('accepted','approved','won') THEN 1 ELSE 0 END)::int AS won,
               SUM(CASE WHEN LOWER(status) IN ('rejected','lost','declined') THEN 1 ELSE 0 END)::int AS lost
        FROM proposals
        WHERE created_at IS NOT NULL
        GROUP BY 1 ORDER BY 1 DESC LIMIT 12
      `);
      const monthly = m.rows.reverse().map(row => ({
        month: row.month,
        total: row.total,
        won: row.won,
        lost: row.lost,
        winRate: (row.won + row.lost) > 0 ? +(row.won / (row.won + row.lost) * 100).toFixed(1) : 0,
      }));

      res.json({
        ok: true,
        hasData: monthly.length > 0,
        totals,
        monthly,
        message: monthly.length > 0 ? null : 'No proposals recorded yet.',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('win-rate error:', err.message);
      res.status(500).json({
        ok: false,
        error: err.message,
        totals: { won: 0, lost: 0, pending: 0, total: 0, winRate: 0 },
        monthly: [],
      });
    }
  });

  // =================== VIZ 2: Service Line Revenue Heatmap ===================
  router.get('/service-revenue-heatmap', async (req, res) => {
    try {
      const now = new Date();
      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return d.toISOString().slice(0, 7);
      });

      // Real revenue per service line per month, from proposal line items.
      const r = await pool.query(`
        SELECT TO_CHAR(p.created_at, 'YYYY-MM') AS month,
               s.id AS service_id,
               s.name AS service_name,
               s.category AS category,
               COALESCE(SUM(pi.total_price), 0)::float AS revenue,
               COUNT(DISTINCT p.id)::int AS deals
          FROM proposal_items pi
          JOIN proposals p ON p.id = pi.proposal_id
          JOIN services s ON s.id = pi.service_id
         WHERE p.created_at >= date_trunc('month', NOW()) - interval '5 months'
         GROUP BY 1, 2, 3, 4
         ORDER BY 1
      `);

      const byService = new Map();
      for (const row of r.rows) {
        if (!byService.has(row.service_id)) {
          byService.set(row.service_id, {
            serviceId: row.service_id,
            serviceName: row.service_name,
            category: row.category || 'General',
            cells: new Map(),
          });
        }
        byService.get(row.service_id).cells.set(row.month, {
          revenue: Number(row.revenue) || 0,
          deals: row.deals || 0,
        });
      }

      const services = [...byService.values()].map(svc => {
        const cells = months.map(m => svc.cells.get(m) || { month: m, revenue: 0, deals: 0 });
        return {
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
          category: svc.category,
          cells,
          total: cells.reduce((s, c) => s + c.revenue, 0),
        };
      });

      const revenues = services.flatMap(s => s.cells.map(c => c.revenue));
      const max = revenues.length ? Math.max(...revenues) : 0;
      const min = revenues.length ? Math.min(...revenues) : 0;

      res.json({
        ok: true,
        hasData: services.length > 0,
        months,
        services,
        bounds: { min, max },
        grandTotal: services.reduce((s, row) => s + row.total, 0),
        message: services.length > 0
          ? null
          : 'No proposal line items referencing services in the last 6 months.',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('service-revenue-heatmap error:', err.message);
      res.status(500).json({ ok: false, error: err.message, months: [], services: [] });
    }
  });

  // =================== NON-VIZ 1: SOW Document PDF Export ===================
  router.get('/sow-pdf/:id?', async (req, res) => {
    try {
      const id = req.params.id;
      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({ ok: false, error: 'A numeric SOW id is required' });
      }

      const r = await pool.query('SELECT * FROM sows WHERE id = $1', [id]);
      if (r.rows.length === 0) {
        return res.status(404).json({ ok: false, error: `SOW ${id} not found` });
      }
      const sow = r.rows[0];

      // Scope non-privileged users to SOWs they created (legacy rows without a
      // creator remain readable, matching the generic CRUD list behavior).
      if (!isPrivileged(req.user) && sow.created_by != null && Number(sow.created_by) !== Number(req.user.id)) {
        return res.status(404).json({ ok: false, error: `SOW ${id} not found` });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="SOW-${sow.id}.pdf"`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.pipe(res);

      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a73e8').text('Statement of Work', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').fillColor('#666').text(`SOW #${sow.id} - ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(1.5);

      const section = (title, body) => {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a73e8').text(title);
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').fillColor('#3c4043').text(body || 'N/A', { width: 495, align: 'justify' });
        doc.moveDown(1);
      };

      section('Title', sow.title || 'Untitled SOW');
      section('Scope of Work', sow.scope || '');
      section('Deliverables', sow.deliverables || '');
      section('Timeline', sow.timeline || '');
      section('Total Contract Value', `$${Number(sow.total_amount || 0).toLocaleString()}`);
      section('Status', String(sow.status || 'draft').toUpperCase());

      doc.moveDown(1);
      doc.fontSize(9).fillColor('#888').text('Generated by ProposalGen Custom Views', { align: 'center' });

      doc.end();
    } catch (err) {
      console.error('sow-pdf error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: err.message });
      }
    }
  });

  // =================== NON-VIZ 2: Proposal Template Rules Editor (CRUD) ===================
  router.get('/template-rules', async (req, res) => {
    try {
      await ensureRulesTable();
      const r = await pool.query('SELECT * FROM proposal_template_rules ORDER BY min_amount ASC');
      res.json({ ok: true, rules: r.rows, count: r.rows.length });
    } catch (err) {
      console.error('template-rules list error:', err.message);
      res.status(500).json({ ok: false, error: err.message, rules: [] });
    }
  });

  router.post('/template-rules', checkRole('admin', 'manager'), async (req, res) => {
    try {
      await ensureRulesTable();
      const { tier_name, min_amount, max_amount, discount_pct, payment_terms, terms_conditions } = req.body || {};
      if (!tier_name) return res.status(400).json({ ok: false, error: 'tier_name is required' });
      const r = await pool.query(
        `INSERT INTO proposal_template_rules (tier_name, min_amount, max_amount, discount_pct, payment_terms, terms_conditions)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tier_name, min_amount || 0, max_amount || 0, discount_pct || 0, payment_terms || '', terms_conditions || '']
      );
      res.json({ ok: true, rule: r.rows[0] });
    } catch (err) {
      console.error('template-rules create error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.put('/template-rules/:id', checkRole('admin', 'manager'), async (req, res) => {
    try {
      await ensureRulesTable();
      const { tier_name, min_amount, max_amount, discount_pct, payment_terms, terms_conditions, active } = req.body || {};
      const r = await pool.query(
        `UPDATE proposal_template_rules SET
           tier_name = COALESCE($1, tier_name),
           min_amount = COALESCE($2, min_amount),
           max_amount = COALESCE($3, max_amount),
           discount_pct = COALESCE($4, discount_pct),
           payment_terms = COALESCE($5, payment_terms),
           terms_conditions = COALESCE($6, terms_conditions),
           active = COALESCE($7, active),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [tier_name, min_amount, max_amount, discount_pct, payment_terms, terms_conditions, active, req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, rule: r.rows[0] });
    } catch (err) {
      console.error('template-rules update error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.delete('/template-rules/:id', checkRole('admin', 'manager'), async (req, res) => {
    try {
      await ensureRulesTable();
      const r = await pool.query('DELETE FROM proposal_template_rules WHERE id = $1 RETURNING id', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, deleted: req.params.id });
    } catch (err) {
      console.error('template-rules delete error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = createCustomViewsRouter;
