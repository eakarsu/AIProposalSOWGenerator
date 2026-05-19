// AI Multi-section SOW generation
// AI generates scope statement, deliverables, milestones, acceptance criteria
const express = require('express');
const router = express.Router();
const pool = require('../db');
// no auth middleware available

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
// TODO: configure credentials — set process.env.OPENROUTER_API_KEY

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
    await pool.query(`CREATE TABLE IF NOT EXISTS ai_results (id SERIAL PRIMARY KEY, user_id INTEGER, endpoint VARCHAR(120), input_data JSONB, result TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query('INSERT INTO ai_results (user_id, endpoint, input_data, result) VALUES ($1,$2,$3,$4)',
      [userId || null, endpoint, JSON.stringify(inputData || {}), typeof result === 'string' ? result : JSON.stringify(result)]);
  } catch (err) { console.error('persist failed:', err.message); }
}


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
    await persistResult(req.user?.id, 'sow-generate', context, parsed);
    res.json({ feature: 'sow-generate', model: MODEL, result: parsed });
  } catch (err) {
    console.error('[sow-generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /history — recent results for current user
router.get('/history', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, endpoint, input_data, result, created_at FROM ai_results WHERE endpoint=$1 ORDER BY created_at DESC LIMIT 50', ['sow-generate']);
    res.json({ items: r.rows });
  } catch (err) {
    res.json({ items: [], error: err.message });
  }
});

module.exports = router;
