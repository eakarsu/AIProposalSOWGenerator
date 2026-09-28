// AI Multi-section SOW generation
// AI generates scope statement, deliverables, milestones, acceptance criteria
const express = require('express');
const pool = require('../db');

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

async function callLLM(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { success: false, error: 'OPENROUTER_API_KEY not configured' };
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AIProposalSOWGenerator'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.4
    })
  });
  if (!response.ok) return { success: false, error: `LLM error ${response.status}` };
  const data = await response.json();
  return { success: true, content: data.choices?.[0]?.message?.content || '' };
}

function parseJsonLoose(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  const a = text.search(/[{\[]/);
  const b = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (a !== -1 && b !== -1) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

async function persistResult(userId, endpoint, inputData, result) {
  try {
    // Canonical ai_results shape from backend/schema.sql.
    await pool.query(`CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      endpoint VARCHAR(100),
      entity_type VARCHAR(50),
      entity_id INTEGER,
      model VARCHAR(100),
      prompt TEXT,
      raw_response TEXT,
      parsed_json JSONB,
      tokens_used INTEGER,
      status VARCHAR(20) DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(
      `INSERT INTO ai_results (user_id, endpoint, prompt, raw_response, parsed_json, status)
       VALUES ($1,$2,$3,$4,$5,'success')`,
      [
        userId || null,
        endpoint,
        JSON.stringify(inputData || {}),
        typeof result === 'string' ? result : JSON.stringify(result),
        JSON.stringify(result ?? null),
      ]
    );
  } catch (err) { console.error('persist failed:', err.message); }
}

function createAiSowRouter({ authMiddleware }) {
  if (!authMiddleware) throw new Error('ai-sow-generate router requires { authMiddleware }');

  const router = express.Router();

  // Every route in this router is authenticated and results are scoped to the
  // calling user; the paid provider call must never be anonymous.
  router.use(authMiddleware);

  // POST /
  router.post('/', async (req, res) => {
    try {
      const payload = req.body || {};
      const context = payload.context || payload.data || payload;
      const systemPrompt = `You are an expert AI assistant for AIProposalSOWGenerator. Focus area: Multi-section SOW generation. ${`AI generates scope statement, deliverables, milestones, acceptance criteria`}. Respond ONLY with valid JSON (no markdown fences).`;
      const userPrompt = `Task: Multi-section SOW generation.\n${`AI generates scope statement, deliverables, milestones, acceptance criteria`}\n\nInput payload (JSON):\n${JSON.stringify(context, null, 2)}\n\nReturn JSON with the shape:\n{\n  "summary": "...",\n  "findings": ["..."],\n  "recommendations": ["..."],\n  "score": 0,\n  "confidence": 0\n}`;
      const llm = await callLLM(systemPrompt, userPrompt);
      if (!llm.success) return res.status(503).json({ error: llm.error });
      const parsed = parseJsonLoose(llm.content) || { raw: llm.content };
      await persistResult(req.user.id, 'sow-generate', context, parsed);
      res.json({ feature: 'sow-generate', model: MODEL, result: parsed });
    } catch (err) {
      console.error('[sow-generate]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /history — recent results for the current user only
  router.get('/history', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, endpoint, prompt AS input_data, raw_response AS result, parsed_json, created_at
           FROM ai_results
          WHERE endpoint = $1 AND user_id = $2
          ORDER BY created_at DESC LIMIT 50`,
        ['sow-generate', req.user.id]
      );
      res.json({ items: r.rows });
    } catch (err) {
      res.status(500).json({ items: [], error: err.message });
    }
  });

  return router;
}

module.exports = createAiSowRouter;
