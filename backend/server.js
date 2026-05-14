const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const PDFDocument = require('pdfkit');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// AI Rate Limiter: 20 requests per hour per user/IP
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { error: 'AI rate limit exceeded. Max 20 requests per hour.' }
});

// ============ JSON PARSER HELPERS ============
function stripMarkdownFences(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function repairJSON(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;
  let repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');
  let openBraces = 0, openBrackets = 0, inString = false, escape = false;
  for (const ch of repaired) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }
  if (inString) repaired += '"';
  while (openBraces > 0) { repaired += '}'; openBraces--; }
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  return repaired;
}

/**
 * 3-strategy parseAIJson:
 * 1. Direct parse after fence strip
 * 2. Extract first JSON object/array via regex
 * 3. Repair and parse
 */
function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(stripMarkdownFences(text)); } catch (_) {}
  try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (_) {}
  try { const m = text.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); } catch (_) {}
  try { return JSON.parse(repairJSON(stripMarkdownFences(text))); } catch (_) {}
  return null;
}

// ============ AI RESULT PERSISTENCE ============
async function persistAiResult(userId, endpoint, entityType, entityId, prompt, rawResponse, tokensUsed, parsedJson) {
  try {
    await pool.query(
      `INSERT INTO ai_results (user_id, endpoint, entity_type, entity_id, model, prompt, raw_response, parsed_json, tokens_used, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'success')`,
      [userId || null, endpoint, entityType || null, entityId || null,
       process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
       prompt, rawResponse, parsedJson ? JSON.stringify(parsedJson) : null, tokensUsed || 0]
    );
  } catch (e) { console.error('Failed to persist AI result:', e.message); }
}

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// RBAC Middleware
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email, hashedPassword, firstName, lastName, 'user']
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [hashedToken, expires, email]
    );
    // In dev, log token to console
    console.log(`\n=== PASSWORD RESET TOKEN ===`);
    console.log(`Email: ${email}`);
    console.log(`Token: ${token}`);
    console.log(`Reset URL: http://localhost:3000/reset-password/${token}`);
    console.log(`Expires: ${expires.toISOString()}`);
    console.log(`============================\n`);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [hashedToken]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, result.rows[0].id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    });
  } catch (err) {
    console.error('Auth /me Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile
app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Profile Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, email, currentPassword, newPassword } = req.body;
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }
    // Check if email is taken by another user
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET first_name = $1, last_name = $2, email = $3, password = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
        [firstName, lastName, email, hashedPassword, req.user.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [firstName, lastName, email, req.user.id]
      );
    }
    const updated = await pool.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [req.user.id]);
    const user = updated.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    });
  } catch (err) {
    console.error('Profile Update Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ GENERIC CRUD HELPERS ============
const ALLOWED_COLUMNS = {};

const createCrudRoutes = (tableName, columns, idColumn = 'id', options = {}) => {
  // Store allowed columns for SQL injection prevention in sorting
  ALLOWED_COLUMNS[tableName] = [idColumn, ...columns, 'created_at', 'updated_at'];

  const { writeRoles, deleteRoles } = options;

  // GET all with pagination and sorting
  app.get(`/api/${tableName}`, authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const offset = (page - 1) * limit;

      // Validate sortBy against allowed columns to prevent SQL injection
      const allowedCols = ALLOWED_COLUMNS[tableName] || [idColumn];
      let sortBy = req.query.sortBy || idColumn;
      if (!allowedCols.includes(sortBy)) sortBy = idColumn;
      const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

      const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      const result = await pool.query(
        `SELECT * FROM ${tableName} ORDER BY ${sortBy} ${sortOrder} LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({
        data: result.rows,
        total,
        page,
        limit,
        totalPages
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET one
  app.get(`/api/${tableName}/:id`, authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} WHERE ${idColumn} = $1`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST create
  const postMiddleware = writeRoles ? [authMiddleware, checkRole(...writeRoles)] : [authMiddleware];
  app.post(`/api/${tableName}`, ...postMiddleware, async (req, res) => {
    try {
      const keys = Object.keys(req.body).filter(k => columns.includes(k));
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PUT update
  const putMiddleware = writeRoles ? [authMiddleware, checkRole(...writeRoles)] : [authMiddleware];
  app.put(`/api/${tableName}/:id`, ...putMiddleware, async (req, res) => {
    try {
      const keys = Object.keys(req.body).filter(k => columns.includes(k));
      const values = keys.map(k => req.body[k]);
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

      const query = `UPDATE ${tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $${keys.length + 1} RETURNING *`;
      const result = await pool.query(query, [...values, req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE
  const deleteMiddleware = deleteRoles ? [authMiddleware, checkRole(...deleteRoles)] : [authMiddleware];
  app.delete(`/api/${tableName}/:id`, ...deleteMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} = $1 RETURNING *`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Bulk DELETE
  const bulkDeleteMiddleware = deleteRoles ? [authMiddleware, checkRole(...deleteRoles)] : [authMiddleware];
  app.post(`/api/${tableName}/bulk-delete`, ...bulkDeleteMiddleware, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
      }
      const result = await pool.query(
        `DELETE FROM ${tableName} WHERE ${idColumn} = ANY($1) RETURNING ${idColumn}`,
        [ids]
      );
      res.json({ message: `Deleted ${result.rowCount} items`, deleted: result.rowCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
};

// Create CRUD routes for all entities (with RBAC options where needed)
createCrudRoutes('clients', ['company_name', 'contact_name', 'email', 'phone', 'address', 'city', 'state', 'country', 'industry', 'website', 'notes', 'status']);
createCrudRoutes('team_members', ['first_name', 'last_name', 'email', 'phone', 'role', 'department', 'hourly_rate', 'availability', 'skills', 'bio', 'avatar_url', 'status'], 'id', { writeRoles: ['admin', 'manager'], deleteRoles: ['admin', 'manager'] });
createCrudRoutes('services', ['name', 'description', 'category', 'base_price', 'unit', 'estimated_hours', 'deliverables', 'status']);
createCrudRoutes('pricing', ['name', 'description', 'pricing_type', 'base_amount', 'currency', 'billing_frequency', 'discount_percentage', 'minimum_commitment', 'features', 'status']);
createCrudRoutes('templates', ['name', 'type', 'category', 'description', 'content', 'variables', 'is_default', 'usage_count', 'status']);
createCrudRoutes('projects', ['name', 'client_id', 'description', 'status', 'priority', 'start_date', 'end_date', 'budget', 'actual_cost', 'project_manager_id', 'team_members', 'tags']);
createCrudRoutes('proposals', ['title', 'client_id', 'project_id', 'template_id', 'status', 'version', 'executive_summary', 'scope_of_work', 'deliverables', 'timeline', 'pricing_summary', 'terms_conditions', 'total_amount', 'valid_until', 'sent_at', 'viewed_at', 'accepted_at', 'rejected_at', 'created_by']);
createCrudRoutes('sows', ['title', 'client_id', 'project_id', 'proposal_id', 'template_id', 'status', 'version', 'introduction', 'objectives', 'scope', 'deliverables', 'timeline', 'milestones', 'assumptions', 'constraints', 'acceptance_criteria', 'payment_terms', 'change_management', 'governance', 'total_amount', 'signed_at', 'created_by']);
createCrudRoutes('documents', ['name', 'type', 'category', 'file_url', 'file_size', 'mime_type', 'client_id', 'project_id', 'proposal_id', 'sow_id', 'uploaded_by', 'description', 'tags', 'status']);
createCrudRoutes('ai_generations', ['type', 'prompt', 'response', 'model', 'tokens_used', 'client_id', 'project_id', 'proposal_id', 'sow_id', 'created_by', 'status']);
createCrudRoutes('analytics', ['metric_name', 'metric_value', 'metric_type', 'period', 'period_start', 'period_end', 'client_id', 'project_id', 'metadata']);
createCrudRoutes('settings', ['key', 'value', 'type', 'category', 'description', 'is_public'], 'id', { writeRoles: ['admin'], deleteRoles: ['admin'] });

// New AI Feature Tables CRUD Routes
createCrudRoutes('pricing_suggestions', ['project_name', 'client_id', 'project_id', 'project_type', 'complexity', 'duration_weeks', 'team_size', 'suggested_min_price', 'suggested_max_price', 'suggested_hourly_rate', 'pricing_strategy', 'rationale', 'market_comparison', 'confidence_score', 'ai_response', 'status', 'created_by']);
createCrudRoutes('win_loss_analyses', ['proposal_id', 'client_id', 'proposal_title', 'outcome', 'proposal_value', 'competitor_name', 'key_factors', 'strengths', 'weaknesses', 'lessons_learned', 'recommendations', 'client_feedback', 'ai_analysis', 'status', 'created_by']);
createCrudRoutes('competitor_differentiators', ['competitor_name', 'industry', 'client_id', 'our_strengths', 'competitor_strengths', 'our_weaknesses', 'competitor_weaknesses', 'key_differentiators', 'positioning_strategy', 'talking_points', 'win_themes', 'ai_analysis', 'status', 'created_by']);
createCrudRoutes('timeline_generations', ['project_name', 'project_id', 'client_id', 'project_type', 'start_date', 'end_date', 'total_weeks', 'phases', 'milestones', 'dependencies', 'resource_allocation', 'critical_path', 'buffer_time', 'ai_timeline', 'status', 'created_by']);
createCrudRoutes('risk_sections', ['project_name', 'project_id', 'client_id', 'project_type', 'risk_category', 'identified_risks', 'risk_matrix', 'mitigation_strategies', 'contingency_plans', 'risk_owners', 'monitoring_approach', 'escalation_process', 'ai_assessment', 'status', 'created_by']);

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const [clients, projects, proposals, sows, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM clients WHERE status = $1', ['active']),
      pool.query('SELECT COUNT(*) FROM projects WHERE status IN ($1, $2)', ['in_progress', 'planning']),
      pool.query('SELECT COUNT(*) FROM proposals WHERE status = $1', ['sent']),
      pool.query('SELECT COUNT(*) FROM sows WHERE status IN ($1, $2)', ['draft', 'signed']),
      pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM proposals WHERE status = $1', ['accepted'])
    ]);

    res.json({
      activeClients: parseInt(clients.rows[0].count),
      activeProjects: parseInt(projects.rows[0].count),
      pendingProposals: parseInt(proposals.rows[0].count),
      activeSows: parseInt(sows.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI HELPERS ============

/**
 * Repair truncated JSON by closing unclosed brackets/braces.
 * Handles cases where AI response was cut off due to token limits.
 */
function repairJSON(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;

  // Remove trailing commas before closing brackets/braces
  let repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');

  // Count open/close brackets and braces
  let openBraces = 0, openBrackets = 0;
  let inString = false, escape = false;

  for (const ch of repaired) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  // Close any unclosed strings
  if (inString) repaired += '"';

  // Close unclosed braces and brackets (inner-most first)
  while (openBraces > 0) { repaired += '}'; openBraces--; }
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }

  return repaired;
}

/**
 * Strip markdown code fences (```json ... ```) that AI models sometimes wrap responses in.
 */
function stripMarkdownFences(text) {
  if (!text || typeof text !== 'string') return text;
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

/**
 * Centralized OpenRouter API call with all safety measures:
 * - Strips markdown code fences
 * - Uses 4096 token limit by default
 * - Logs errors properly
 * - Returns parsed response
 */
async function callOpenRouter({ systemPrompt, userPrompt, maxTokens = 4096, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
    throw new Error('OpenRouter API key not configured. Please add OPENROUTER_API_KEY to .env file.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
      'X-Title': 'AI Proposal/SOW Generator'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('OpenRouter API Error:', data.error);
    throw new Error(data.error.message || 'AI generation failed');
  }

  if (data.choices?.[0]?.finish_reason === 'length') {
    console.warn('OpenRouter response truncated (finish_reason: length). Consider increasing max_tokens.');
  }

  // Strip markdown fences from content
  const rawContent = data.choices?.[0]?.message?.content || '';
  const content = stripMarkdownFences(rawContent);
  const tokensUsed = data.usage?.total_tokens || 0;

  return { content, tokensUsed, raw: data };
}

// ============ AI GENERATION ROUTES ============
app.post('/api/ai/generate', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { type, prompt, clientId, projectId, proposalId, sowId } = req.body;

    const systemPrompt = `You are a senior business consultant and professional writer with 15+ years of experience crafting high-impact ${type}s for Fortune 500 companies and growth-stage startups alike.

Your writing style:
- Clear, confident, and authoritative tone
- Data-driven language with specific, measurable outcomes where possible
- Industry-standard terminology appropriate for C-level executives
- Concise paragraphs with strong topic sentences
- Action-oriented language that drives decisions
- Professional formatting with clear section headers

Guidelines:
- Lead with value and business impact, not features
- Use active voice throughout
- Avoid jargon that doesn't add clarity
- Include specific deliverables, timelines, and success metrics when context allows
- Tailor language to the client's industry and business maturity
- End sections with clear next steps or calls to action`;

    const { content, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt: prompt });

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO ai_generations (type, prompt, response, model, tokens_used, client_id, project_id, proposal_id, sow_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [type, prompt, content, process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5', tokensUsed, clientId || null, projectId || null, proposalId || null, sowId || null, req.user.id, 'completed']
    );

    res.json({
      content,
      tokensUsed,
      generation: insertResult.rows[0]
    });
  } catch (err) {
    console.error('AI Generation Error:', err);
    res.status(500).json({ error: err.message || 'AI generation failed' });
  }
});

app.post('/api/ai/generate-proposal', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { clientId, projectName, serviceIds, requirements } = req.body;

    // Get client info
    let clientInfo = '';
    if (clientId) {
      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0) {
        const client = clientResult.rows[0];
        clientInfo = `Client: ${client.company_name}, Industry: ${client.industry}, Contact: ${client.contact_name || 'N/A'}`;
      }
    }

    // Get services info
    let servicesInfo = '';
    if (serviceIds && serviceIds.length > 0) {
      const servicesResult = await pool.query('SELECT * FROM services WHERE id = ANY($1)', [serviceIds]);
      servicesInfo = servicesResult.rows.map(s => `- ${s.name}: ${s.description} (Base price: $${s.base_price}, Est. hours: ${s.estimated_hours || 'TBD'})`).join('\n');
    }

    const systemPrompt = `You are a senior business development director with 20+ years of experience winning multi-million dollar deals at top-tier consulting firms (McKinsey, Deloitte, Accenture). You specialize in writing proposals that consistently achieve 70%+ win rates.

Your proposal writing principles:
- Open with a compelling executive summary that demonstrates deep understanding of the client's challenges
- Mirror the client's language and industry terminology to build rapport
- Quantify value wherever possible (ROI, time savings, revenue impact, cost reduction)
- Structure deliverables with clear acceptance criteria
- Present pricing as an "investment" tied to measurable outcomes
- Include risk mitigation to build confidence
- Create urgency without being pushy
- End with a clear, easy-to-accept call to action

Formatting rules:
- Use professional markdown formatting with clear headers (##)
- Use bullet points for lists and deliverables
- Bold key value propositions and differentiators
- Keep paragraphs to 3-4 sentences maximum
- Use tables for pricing breakdowns when applicable`;

    const userPrompt = `Generate a comprehensive, client-ready business proposal with the following sections. Each section should be substantive and tailored:

1. **Executive Summary** — 2-3 paragraphs capturing the client's challenge, our solution, and expected outcomes. Lead with their pain point.
2. **Project Understanding** — Demonstrate deep understanding of the client's situation, industry trends, and why this project matters now.
3. **Proposed Solution** — Detail our approach, methodology, and how it addresses each requirement. Explain WHY this approach, not just WHAT.
4. **Scope of Work** — Clearly define what's included AND excluded. Use bullet points for clarity.
5. **Deliverables** — List each deliverable with description, format, and acceptance criteria.
6. **Timeline** — Provide a phase-by-phase timeline with key milestones and dependencies.
7. **Investment** — Present pricing with clear breakdown. Frame as investment with expected returns.
8. **Why Choose Us** — 3-5 compelling differentiators with evidence/proof points.
9. **Next Steps** — Clear action items with suggested dates to maintain momentum.

Context:
${clientInfo || 'Client: To be specified'}
Project: ${projectName}
Requirements: ${requirements || 'General project requirements to be refined'}

Services to include:
${servicesInfo || 'Services to be determined based on requirements'}

Write the full proposal now. Make it compelling, specific, and ready to present to a C-level executive.`;

    const { content, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    res.json({ content, tokensUsed });
  } catch (err) {
    console.error('AI Proposal Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate proposal' });
  }
});

app.post('/api/ai/generate-sow', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { clientId, projectName, scope, deliverables, timeline } = req.body;

    let clientInfo = '';
    if (clientId) {
      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0) {
        const client = clientResult.rows[0];
        clientInfo = `Client: ${client.company_name}, Industry: ${client.industry || 'N/A'}, Contact: ${client.contact_name || 'N/A'}`;
      }
    }

    const systemPrompt = `You are a senior project delivery director and contract specialist with 20+ years of experience writing Statements of Work for enterprise technology engagements at firms like Deloitte, PwC, and IBM Global Services.

Your SOW writing principles:
- Every section must be precise enough to be legally enforceable and clear enough for non-technical stakeholders
- Deliverables must have measurable acceptance criteria — never vague language like "as needed" or "best effort"
- Timelines must include specific milestones with clear dependencies
- Assumptions and constraints protect both parties and prevent scope creep
- Payment terms should be tied to deliverable milestones, not arbitrary dates
- Change management process must be explicit to avoid disputes
- Governance structure defines decision-making authority and escalation paths

Formatting rules:
- Use professional markdown with numbered sections and clear subsections
- Use tables for deliverable matrices and milestone schedules
- Bold critical terms, deadlines, and acceptance criteria
- Use bullet points for lists — no long run-on paragraphs
- Include placeholder references like [CLIENT_NAME] and [EFFECTIVE_DATE] where appropriate`;

    const userPrompt = `Generate a comprehensive, legally-sound Statement of Work (SOW) ready for executive signature. Include ALL of the following sections with substantive, detailed content:

1. **Introduction** — Purpose of the SOW, parties involved, relationship to any master agreement, effective date
2. **Project Objectives** — 4-6 SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound)
3. **Scope of Work** — Detailed description of work to be performed. Clearly state what is IN scope and OUT of scope.
4. **Deliverables** — Table format with: Deliverable name, Description, Format/Medium, Acceptance Criteria, Due Date
5. **Timeline and Milestones** — Phase-by-phase breakdown with start/end dates, dependencies, and milestone checkpoints
6. **Assumptions** — All project assumptions that, if changed, would impact scope, timeline, or budget
7. **Constraints** — Technical, resource, budget, and timeline constraints
8. **Acceptance Criteria** — Detailed process for deliverable review, approval workflow, revision limits, and sign-off procedures
9. **Payment Terms** — Milestone-based payment schedule, invoicing process, payment timeline, late payment terms
10. **Change Management Process** — How scope changes are requested, evaluated, approved, and priced
11. **Governance** — Project roles and responsibilities, meeting cadence, reporting requirements, escalation matrix, communication protocols

Context:
${clientInfo || 'Client: To be specified'}
Project: ${projectName}
Scope: ${scope || 'To be defined in detail'}
Deliverables: ${deliverables || 'To be specified based on scope'}
Timeline: ${timeline || 'To be determined'}

Write the complete SOW now. Every section must be substantive — no placeholder text or "TBD" except for specific dates/names.`;

    const { content, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    res.json({ content, tokensUsed });
  } catch (err) {
    console.error('AI SOW Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate SOW' });
  }
});

app.post('/api/ai/improve-text', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { text, style } = req.body;

    const stylePrompts = {
      professional: `Rewrite this text to sound like it was written by a senior partner at a top-tier consulting firm. Use confident, authoritative language. Replace weak verbs with strong action verbs. Eliminate filler words and hedge language ("might", "could", "perhaps"). Ensure every sentence adds value.`,
      concise: `Rewrite this text to be 40-60% shorter while preserving ALL key information and business value. Cut redundancy, merge related points, use active voice, and replace wordy phrases with precise alternatives. Every word must earn its place.`,
      persuasive: `Rewrite this text to be highly persuasive and compelling. Lead with benefits and outcomes. Use power words that evoke confidence and urgency. Include social proof language. Frame features as solutions to pain points. End with a clear value proposition or call to action.`,
      technical: `Rewrite this text to be more technically precise and detailed. Use correct industry terminology. Add specificity to vague claims. Include technical depth while remaining accessible to informed stakeholders. Ensure accuracy and completeness.`,
      friendly: `Rewrite this text to be warm, approachable, and conversational while maintaining professionalism. Use "we" and "you" to create partnership feel. Replace corporate jargon with plain language. Add human touches without being casual. Keep it genuine, not salesy.`
    };

    const systemPrompt = `You are an elite business writing coach who has trained executives at Fortune 100 companies. You transform ordinary business text into compelling, polished prose that drives action and builds credibility.

Rules:
- Return ONLY the improved text — no explanations, preambles, or commentary
- Maintain the original meaning and all factual content
- Preserve any specific names, numbers, dates, and technical terms
- Keep the same approximate structure (paragraphs, bullet points, etc.)
- Improve clarity, impact, and readability simultaneously`;

    const userPrompt = `${stylePrompts[style] || stylePrompts.professional}

Text to improve:
---
${text}
---

Return only the improved text.`;

    const { content, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    res.json({ content, tokensUsed });
  } catch (err) {
    console.error('AI Improve Text Error:', err);
    res.status(500).json({ error: err.message || 'Failed to improve text' });
  }
});

// ============ AI PRICING SUGGESTER ============
app.post('/api/ai/suggest-pricing', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { projectName, projectType, complexity, durationWeeks, teamSize, requirements, clientId, projectId } = req.body;

    let clientInfo = '';
    if (clientId) {
      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0) {
        const client = clientResult.rows[0];
        clientInfo = `Client: ${client.company_name}, Industry: ${client.industry}`;
      }
    }

    const systemPrompt = `You are a veteran pricing strategist with 20+ years at top technology consulting firms. You have priced thousands of projects ranging from $10K to $50M+ across every industry vertical.

Your pricing methodology:
- Bottom-up estimation: Calculate effort hours × blended rate, then adjust for complexity, risk, and market positioning
- Market validation: Compare against published benchmarks (Gartner, Forrester, industry reports)
- Value-based adjustment: Factor in business impact and ROI the client will receive
- Risk premium: Add appropriate margin for complexity, unknowns, and client factors
- Competitive positioning: Price to win while maintaining healthy margins (typically 25-40%)

Key rate benchmarks you reference:
- Junior developers: $75-125/hr | Mid-level: $125-200/hr | Senior/Lead: $200-350/hr
- Project managers: $150-250/hr | Architects: $250-400/hr | Strategy consultants: $300-500/hr
- Adjust rates by ±20-30% based on geography, industry, and client size

CRITICAL: You MUST respond using EXACTLY the format shown below. Do NOT add any fields not listed. Follow this format exactly.`;

    const userPrompt = `Analyze this project and provide detailed pricing recommendations:

Project Details:
- Project Name: ${projectName}
- Project Type: ${projectType}
- Complexity: ${complexity}
- Duration: ${durationWeeks} weeks
- Team Size: ${teamSize} people
${clientInfo ? `- ${clientInfo}` : ''}
${requirements ? `- Requirements: ${requirements}` : ''}

Calculate pricing using your methodology: (team_size × avg_hourly_rate × weekly_hours × duration_weeks), adjusted for complexity and market factors.

CRITICAL: Respond in EXACTLY this format. Do NOT add any extra fields. Each field on its own line:
MIN_PRICE: [number only, no $ or commas]
MAX_PRICE: [number only, no $ or commas]
HOURLY_RATE: [blended rate, number only]
STRATEGY: [one of: fixed-price, time-and-materials, value-based, milestone-based, retainer, hybrid]
RATIONALE: [3-5 sentences explaining the pricing logic, market factors, and why this range is appropriate]
MARKET_COMPARISON: [2-3 sentences comparing to similar projects in the market]
CONFIDENCE: [number 0-100 based on how much detail was provided]`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    // Parse the response
    const parseValue = (text, key) => {
      const regex = new RegExp(`${key}:\\s*([^\\n]+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const minPrice = parseFloat(parseValue(aiResponse, 'MIN_PRICE').replace(/[^0-9.]/g, '')) || 0;
    const maxPrice = parseFloat(parseValue(aiResponse, 'MAX_PRICE').replace(/[^0-9.]/g, '')) || 0;
    const hourlyRate = parseFloat(parseValue(aiResponse, 'HOURLY_RATE').replace(/[^0-9.]/g, '')) || 0;
    const strategy = parseValue(aiResponse, 'STRATEGY');
    const rationale = parseValue(aiResponse, 'RATIONALE');
    const marketComparison = parseValue(aiResponse, 'MARKET_COMPARISON');
    const confidence = parseFloat(parseValue(aiResponse, 'CONFIDENCE').replace(/[^0-9.]/g, '')) || 75;

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO pricing_suggestions (project_name, client_id, project_id, project_type, complexity, duration_weeks, team_size, suggested_min_price, suggested_max_price, suggested_hourly_rate, pricing_strategy, rationale, market_comparison, confidence_score, ai_response, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [projectName, clientId || null, projectId || null, projectType, complexity, durationWeeks, teamSize, minPrice, maxPrice, hourlyRate, strategy, rationale, marketComparison, confidence, aiResponse, req.user.id]
    );

    res.json({
      suggestion: insertResult.rows[0],
      aiResponse,
      parsed: { minPrice, maxPrice, hourlyRate, strategy, rationale, marketComparison, confidence },
      tokensUsed
    });
  } catch (err) {
    console.error('AI Pricing Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate pricing suggestion' });
  }
});

// ============ AI WIN/LOSS ANALYZER ============
app.post('/api/ai/analyze-win-loss', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { proposalTitle, outcome, proposalValue, competitorName, clientFeedback, proposalId, clientId } = req.body;

    const outcomeLabel = outcome === 'won' ? 'WIN' : outcome === 'lost' ? 'LOSS' : outcome?.toUpperCase() || 'OUTCOME';

    const systemPrompt = `You are a senior sales strategy director with 20+ years of experience in B2B technology sales. You have analyzed 5,000+ proposal outcomes across enterprise software, consulting, and professional services firms.

Your analytical framework (based on Miller Heiman, SPIN Selling, and Challenger Sale methodologies):
- Decision Driver Analysis: Identify the 3-5 factors that actually drove the decision (not surface-level symptoms)
- Competitive Positioning Assessment: How our value proposition compared against alternatives
- Relationship & Trust Evaluation: Strength of stakeholder relationships and credibility
- Solution Fit Analysis: How well our proposed solution matched the client's real needs (stated AND unstated)
- Commercial Competitiveness: Pricing position relative to value delivered and competition
- Process Execution: How well we ran the sales process (timing, stakeholder coverage, follow-up)

Your insights should be:
- Brutally honest — avoid sugarcoating losses or over-celebrating wins
- Actionable — every recommendation must be something the team can implement on the next proposal
- Specific — reference the actual proposal details, not generic advice
- Pattern-aware — connect this outcome to common industry patterns

CRITICAL: Respond using EXACTLY the format shown in the user prompt. Do NOT add any extra fields beyond what is requested.`;

    const userPrompt = `Perform a deep-dive ${outcomeLabel} analysis for this proposal and extract actionable intelligence:

Proposal Details:
- Title: ${proposalTitle}
- Outcome: ${outcome} ${outcome === 'won' ? '(we won this deal)' : outcome === 'lost' ? '(we lost this deal)' : ''}
- Deal Value: ${proposalValue ? `$${proposalValue}` : 'Not specified'}
- Competitor: ${competitorName || 'Unknown / Not disclosed'}
- Client Feedback: ${clientFeedback || 'No formal feedback received — infer from available context'}

Analyze through each lens of the framework. Be specific to THIS deal, not generic.

CRITICAL: Respond in EXACTLY this format. Do NOT add any extra fields:
KEY_FACTORS: [comma-separated list of 3-5 specific factors that drove this ${outcome}]
STRENGTHS: [2-3 detailed paragraphs on what we did well, with specific examples from this proposal]
WEAKNESSES: [2-3 detailed paragraphs on gaps and areas for improvement, be brutally honest]
LESSONS_LEARNED: [3-5 specific, actionable lessons the team should internalize]
RECOMMENDATIONS: [5-7 specific action items for future proposals, prioritized by impact]
ANALYSIS: [Comprehensive 2-3 paragraph executive summary tying everything together]`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    const parseValue = (text, key) => {
      const regex = new RegExp(`${key}:\\s*([^\\n]+(?:\\n(?![A-Z_]+:)[^\\n]+)*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const keyFactors = parseValue(aiResponse, 'KEY_FACTORS').split(',').map(s => s.trim()).filter(s => s);
    const strengths = parseValue(aiResponse, 'STRENGTHS');
    const weaknesses = parseValue(aiResponse, 'WEAKNESSES');
    const lessonsLearned = parseValue(aiResponse, 'LESSONS_LEARNED');
    const recommendations = parseValue(aiResponse, 'RECOMMENDATIONS');
    const analysis = parseValue(aiResponse, 'ANALYSIS');

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO win_loss_analyses (proposal_id, client_id, proposal_title, outcome, proposal_value, competitor_name, key_factors, strengths, weaknesses, lessons_learned, recommendations, client_feedback, ai_analysis, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [proposalId || null, clientId || null, proposalTitle, outcome, parseFloat(proposalValue) || null, competitorName || null, keyFactors, strengths, weaknesses, lessonsLearned, recommendations, clientFeedback || null, aiResponse, req.user.id]
    );

    res.json({
      analysis: insertResult.rows[0],
      aiResponse,
      parsed: { keyFactors, strengths, weaknesses, lessonsLearned, recommendations, analysis },
      tokensUsed
    });
  } catch (err) {
    console.error('AI Win/Loss Error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze win/loss' });
  }
});

// ============ AI COMPETITOR DIFFERENTIATOR ============
app.post('/api/ai/differentiate-competitor', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { competitorName, industry, ourServices, clientId } = req.body;

    const systemPrompt = `You are a senior competitive intelligence director who has led battle card programs at Gartner, Forrester, and top-tier consulting firms. You specialize in creating actionable competitive positioning strategies for technology services companies.

Your competitive analysis framework:
- SWOT Cross-Analysis: Map our strengths against their weaknesses and vice versa to find exploitable gaps
- Value Chain Differentiation: Identify where in the delivery lifecycle we create superior value
- Perception vs. Reality Assessment: Distinguish between actual capabilities and market perception
- Buyer Journey Mapping: Understand at which stages we win or lose against this competitor
- Counter-Positioning: Develop specific responses to the competitor's likely sales narratives

Strategic principles:
- Never bash the competitor directly — reframe the conversation around client outcomes
- Lead with unique value, not feature comparisons
- Acknowledge competitor strengths honestly — credibility matters more than bravado
- Focus on "why us" not "why not them"
- Identify 2-3 "silver bullet" differentiators that are nearly impossible for the competitor to replicate

CRITICAL: Respond using EXACTLY the format shown in the user prompt. Do NOT add any extra fields beyond what is requested.`;

    const userPrompt = `Create a comprehensive competitive battle card for selling against this competitor:

Competitor: ${competitorName}
Industry Context: ${industry}
Our Services: ${ourServices || 'Full-service technology consulting and development'}

Analyze our competitive position deeply. Consider the competitor's likely market positioning, typical client base, known strengths, and common vulnerabilities in the ${industry} space.

CRITICAL: Respond in EXACTLY this format. Do NOT add any extra fields:
OUR_STRENGTHS: [3-5 specific strengths we have versus ${competitorName}, with evidence/proof points for each]
COMPETITOR_STRENGTHS: [3-5 honest assessments of where ${competitorName} is strong — credibility requires honesty]
OUR_WEAKNESSES: [2-3 areas where we may be at a disadvantage — and how to mitigate each in conversations]
COMPETITOR_WEAKNESSES: [3-5 exploitable gaps in ${competitorName}'s offering, delivery, or positioning]
KEY_DIFFERENTIATORS: [3-5 unique value propositions that ${competitorName} cannot easily replicate]
POSITIONING_STRATEGY: [2-3 paragraphs on how to position against ${competitorName} — the overall narrative and approach]
TALKING_POINTS: [5-7 specific phrases/messages sales reps should use in conversations when ${competitorName} comes up]
WIN_THEMES: [3-5 themes to emphasize in proposals when competing against ${competitorName}]`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    const parseValue = (text, key) => {
      const regex = new RegExp(`${key}:\\s*([^\\n]+(?:\\n(?![A-Z_]+:)[^\\n]+)*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const ourStrengths = parseValue(aiResponse, 'OUR_STRENGTHS');
    const competitorStrengths = parseValue(aiResponse, 'COMPETITOR_STRENGTHS');
    const ourWeaknesses = parseValue(aiResponse, 'OUR_WEAKNESSES');
    const competitorWeaknesses = parseValue(aiResponse, 'COMPETITOR_WEAKNESSES');
    const keyDifferentiators = parseValue(aiResponse, 'KEY_DIFFERENTIATORS');
    const positioningStrategy = parseValue(aiResponse, 'POSITIONING_STRATEGY');
    const talkingPoints = parseValue(aiResponse, 'TALKING_POINTS');
    const winThemes = parseValue(aiResponse, 'WIN_THEMES');

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO competitor_differentiators (competitor_name, industry, client_id, our_strengths, competitor_strengths, our_weaknesses, competitor_weaknesses, key_differentiators, positioning_strategy, talking_points, win_themes, ai_analysis, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [competitorName, industry, clientId || null, ourStrengths, competitorStrengths, ourWeaknesses, competitorWeaknesses, keyDifferentiators, positioningStrategy, talkingPoints, winThemes, aiResponse, req.user.id]
    );

    res.json({
      differentiator: insertResult.rows[0],
      aiResponse,
      parsed: { ourStrengths, competitorStrengths, ourWeaknesses, competitorWeaknesses, keyDifferentiators, positioningStrategy, talkingPoints, winThemes },
      tokensUsed
    });
  } catch (err) {
    console.error('AI Competitor Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate competitor analysis' });
  }
});

// ============ AI TIMELINE GENERATOR ============
app.post('/api/ai/generate-timeline', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { projectName, projectType, startDate, durationWeeks, teamSize, requirements, clientId, projectId } = req.body;

    const systemPrompt = `You are a PMP-certified senior project manager with 20+ years of experience delivering complex technology projects on time and on budget. You have managed portfolios exceeding $100M across Agile, Waterfall, and hybrid methodologies.

Your timeline planning methodology:
- Work Breakdown Structure (WBS): Decompose the project into manageable phases with clear entry/exit criteria
- Critical Path Method: Identify the longest dependency chain that determines the minimum project duration
- Resource Leveling: Ensure no team member is over-allocated across concurrent phases
- Buffer Strategy: Apply 15-20% buffer on the critical path and 10% on non-critical paths (PERT-based estimation)
- Milestone Design: Place milestones at decision points, deliverable completions, and stakeholder review gates
- Risk-Adjusted Scheduling: Factor in known risks and their potential timeline impact
- Dependency Mapping: Identify Finish-to-Start, Start-to-Start, and Finish-to-Finish dependencies

Phase sizing guidelines for ${durationWeeks}-week projects:
- Discovery/Planning: 10-15% of total duration
- Design/Architecture: 15-20% of total duration
- Development/Implementation: 35-45% of total duration
- Testing/QA: 15-20% of total duration
- Deployment/Launch: 5-10% of total duration
- Post-Launch Support: 5-10% of total duration

CRITICAL: For PHASES and MILESTONES fields, you MUST return valid JSON arrays with EXACTLY the fields shown. Do NOT add any extra fields like "description", "deliverables", "resources", etc. Follow the schema EXACTLY.`;

    const userPrompt = `Create a detailed, realistic project timeline:

Project Details:
- Name: ${projectName}
- Type: ${projectType}
- Start Date: ${startDate}
- Duration: ${durationWeeks} weeks
- Team Size: ${teamSize} people
${requirements ? `- Key Requirements: ${requirements}` : ''}

Calculate phase durations using the sizing guidelines. Ensure phases sum to approximately ${durationWeeks} weeks (including overlaps). Place milestones at critical decision points.

CRITICAL: Respond in EXACTLY this format. Do NOT add any extra fields:
PHASES: [{"name":"Phase Name","weeks":X},{"name":"Phase Name","weeks":X}] (valid JSON array, each object has ONLY "name" and "weeks" fields)
MILESTONES: [{"name":"Milestone Name","week":X},{"name":"Milestone Name","week":X}] (valid JSON array, each object has ONLY "name" and "week" fields)
DEPENDENCIES: [describe which phases depend on others and the type of dependency]
RESOURCE_ALLOCATION: [how to distribute the ${teamSize} team members across phases, with role recommendations]
CRITICAL_PATH: [identify the critical path and explain why these phases determine the minimum duration]
BUFFER_TIME: [specific buffer recommendations with rationale, e.g., "Add 2 weeks buffer after Phase 3 due to integration risk"]
TIMELINE: [detailed narrative walking through the project week-by-week or phase-by-phase]`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    const parseValue = (text, key) => {
      const regex = new RegExp(`${key}:\\s*([^\\n]+(?:\\n(?![A-Z_]+:)[^\\n]+)*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const parseJSON = (text, key) => {
      try {
        const value = parseValue(text, key);
        const jsonMatch = value.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) return [];
        const repaired = repairJSON(jsonMatch[0]);
        return JSON.parse(repaired);
      } catch (err) {
        console.error(`Failed to parse JSON for ${key}:`, err.message);
        return [];
      }
    };

    const phases = parseJSON(aiResponse, 'PHASES');
    const milestones = parseJSON(aiResponse, 'MILESTONES');
    const dependencies = parseValue(aiResponse, 'DEPENDENCIES');
    const resourceAllocation = parseValue(aiResponse, 'RESOURCE_ALLOCATION');
    const criticalPath = parseValue(aiResponse, 'CRITICAL_PATH');
    const bufferTime = parseValue(aiResponse, 'BUFFER_TIME');
    const timeline = parseValue(aiResponse, 'TIMELINE');

    // Calculate end date
    const start = new Date(startDate);
    const endDate = new Date(start.getTime() + (durationWeeks * 7 * 24 * 60 * 60 * 1000));

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO timeline_generations (project_name, project_id, client_id, project_type, start_date, end_date, total_weeks, phases, milestones, dependencies, resource_allocation, critical_path, buffer_time, ai_timeline, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [projectName, projectId || null, clientId || null, projectType, startDate, endDate.toISOString().split('T')[0], durationWeeks, JSON.stringify({phases}), JSON.stringify({milestones}), dependencies, resourceAllocation, criticalPath, bufferTime, aiResponse, req.user.id]
    );

    res.json({
      timeline: insertResult.rows[0],
      aiResponse,
      parsed: { phases, milestones, dependencies, resourceAllocation, criticalPath, bufferTime, timeline },
      tokensUsed
    });
  } catch (err) {
    console.error('AI Timeline Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate timeline' });
  }
});

// ============ AI RISK SECTION WRITER ============
app.post('/api/ai/generate-risk-section', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { projectName, projectType, riskCategory, projectDescription, clientId, projectId } = req.body;

    const systemPrompt = `You are a senior risk management consultant with 20+ years of experience, certified in PMI-RMP (Risk Management Professional) and ISO 31000. You have conducted risk assessments for $1B+ enterprise programs across technology, finance, healthcare, and government sectors.

Your risk assessment methodology (based on ISO 31000 and PMBOK):
- Risk Identification: Systematic identification using categories (Technical, Schedule, Resource, External, Organizational, Compliance)
- Qualitative Analysis: Probability × Impact scoring on a 5×5 matrix (1-25 scale)
  * Probability: Very Low (1), Low (2), Medium (3), High (4), Very High (5)
  * Impact: Negligible (1), Minor (2), Moderate (3), Major (4), Critical (5)
  * Score = Probability × Impact
  * Risk levels: Low (1-5), Medium (6-12), High (13-19), Critical (20-25)
- Mitigation Strategy Types: Avoid, Transfer, Mitigate, Accept (with justification for each)
- Contingency Planning: Pre-defined response plans triggered by specific risk indicators
- Monitoring: Leading indicators, key risk indicators (KRIs), and review cadence

Risk categories to consider for ${projectType} projects:
- Technical: Architecture complexity, integration challenges, technology maturity, data migration
- Schedule: Dependency delays, resource availability, scope creep, seasonal impacts
- Resource: Key person dependency, skill gaps, team turnover, vendor reliability
- External: Regulatory changes, market shifts, client organizational changes, third-party dependencies
- Financial: Budget overruns, currency fluctuation, cost estimation accuracy
- Compliance: Data privacy (GDPR/CCPA), industry regulations, security requirements

CRITICAL: For the RISKS field, you MUST return a valid JSON array with EXACTLY the fields shown: "name", "probability", "impact", "score". Do NOT add any extra fields like "category", "mitigation", "owner", "description", etc. Follow the schema EXACTLY.`;

    const userPrompt = `Create a comprehensive, board-ready risk assessment for this project:

Project Details:
- Name: ${projectName}
- Type: ${projectType}
- Risk Category Focus: ${riskCategory || 'All categories — provide comprehensive coverage'}
${projectDescription ? `- Description: ${projectDescription}` : ''}

Identify 8-12 specific risks relevant to this project type. Score each using the 5×5 probability × impact matrix. Include a mix of risk levels.

CRITICAL: Respond in EXACTLY this format. Do NOT add any extra fields:
RISKS: [{"name":"Specific Risk Name","probability":"low","impact":"high","score":10}] (valid JSON array, each object has ONLY "name", "probability", "impact", and "score" fields — NO other fields)
RISK_MATRIX: [Summary of risk distribution: how many Critical/High/Medium/Low risks, and what this means for the project's risk profile]
MITIGATION: [For each High/Critical risk, provide: the risk name, mitigation strategy type (Avoid/Transfer/Mitigate/Accept), specific actions, responsible party, and timeline]
CONTINGENCY: [Pre-defined response plans for the top 3-5 risks if they materialize, including trigger conditions and immediate actions]
OWNERS: [Recommended risk ownership structure: who should own which risk categories, and the RACI for risk management]
MONITORING: [Specific Key Risk Indicators (KRIs) to track, review cadence (weekly/biweekly), and reporting format]
ESCALATION: [Clear escalation matrix: what triggers escalation, who to escalate to at each level, expected response times]
ASSESSMENT: [2-3 paragraph executive summary of the overall risk posture, key concerns, and confidence level in the mitigation plan]`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });

    const parseValue = (text, key) => {
      const regex = new RegExp(`${key}:\\s*([^\\n]+(?:\\n(?![A-Z_]+:)[^\\n]+)*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const parseJSON = (text, key) => {
      try {
        const value = parseValue(text, key);
        const jsonMatch = value.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) return [];
        const repaired = repairJSON(jsonMatch[0]);
        return JSON.parse(repaired);
      } catch (err) {
        console.error(`Failed to parse JSON for ${key}:`, err.message);
        return [];
      }
    };

    const risks = parseJSON(aiResponse, 'RISKS');
    const riskMatrix = parseValue(aiResponse, 'RISK_MATRIX');
    const mitigation = parseValue(aiResponse, 'MITIGATION');
    const contingency = parseValue(aiResponse, 'CONTINGENCY');
    const owners = parseValue(aiResponse, 'OWNERS');
    const monitoring = parseValue(aiResponse, 'MONITORING');
    const escalation = parseValue(aiResponse, 'ESCALATION');
    const assessment = parseValue(aiResponse, 'ASSESSMENT');

    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO risk_sections (project_name, project_id, client_id, project_type, risk_category, identified_risks, risk_matrix, mitigation_strategies, contingency_plans, risk_owners, monitoring_approach, escalation_process, ai_assessment, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [projectName, projectId || null, clientId || null, projectType, riskCategory || 'General', JSON.stringify({risks}), riskMatrix, mitigation, contingency, owners, monitoring, escalation, aiResponse, req.user.id]
    );

    res.json({
      riskSection: insertResult.rows[0],
      aiResponse,
      parsed: { risks, riskMatrix, mitigation, contingency, owners, monitoring, escalation, assessment },
      tokensUsed
    });
  } catch (err) {
    console.error('AI Risk Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate risk section' });
  }
});

// ============ PDF EXPORT - PROPOSAL ============
app.get('/api/proposals/:id/export-pdf', authMiddleware, async (req, res) => {
  try {
    const proposalResult = await pool.query(`
      SELECT p.*, c.company_name, c.contact_name, c.email as client_email,
             u.first_name || ' ' || u.last_name as creator_name
      FROM proposals p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`, [req.params.id]);
    if (proposalResult.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = proposalResult.rows[0];

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.id}.pdf"`);
    doc.pipe(res);

    // Cover page
    doc.rect(0, 0, 612, 150).fill('#1a73e8');
    doc.fillColor('#fff').fontSize(26).font('Helvetica-Bold').text('PROPOSAL', 50, 50, { align: 'center' });
    doc.fontSize(16).font('Helvetica').text(proposal.title || 'Untitled Proposal', 50, 85, { align: 'center' });
    doc.fontSize(11).text(`Prepared for: ${proposal.company_name || 'Client'}`, 50, 115, { align: 'center' });
    doc.fillColor('#000').moveDown(5);
    doc.fontSize(9).fillColor('#888').text(`Version ${proposal.version || 1} | Generated: ${new Date().toLocaleDateString()} | Status: ${proposal.status}`, { align: 'right' });
    doc.fillColor('#000').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').stroke();
    doc.moveDown(1);

    const section = (title) => {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a73e8').text(title);
      doc.fillColor('#000').moveDown(0.3);
    };
    const body = (text) => {
      if (!text) return;
      doc.fontSize(10).font('Helvetica').fillColor('#3c4043').text(text, { width: 495 });
      doc.moveDown(0.8);
    };

    if (proposal.executive_summary) { section('Executive Summary'); body(proposal.executive_summary); }
    if (proposal.scope_of_work) { section('Scope of Work'); body(proposal.scope_of_work); }
    if (proposal.deliverables) { section('Deliverables'); body(proposal.deliverables); }
    if (proposal.timeline) { section('Timeline'); body(proposal.timeline); }
    if (proposal.pricing_summary) { section('Pricing'); body(proposal.pricing_summary); }
    if (proposal.total_amount) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0d904f')
        .text(`Total Investment: $${Number(proposal.total_amount).toLocaleString()}`, { align: 'right' });
      doc.moveDown(0.8).fillColor('#000');
    }
    if (proposal.terms_conditions) { section('Terms & Conditions'); body(proposal.terms_conditions); }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#888').text('This proposal is confidential and prepared exclusively for the named recipient.', { align: 'center' });
    doc.end();
  } catch (err) {
    console.error('Proposal PDF Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ PDF EXPORT - SOW ============
app.get('/api/sows/:id/export-pdf', authMiddleware, async (req, res) => {
  try {
    const sowResult = await pool.query(`
      SELECT s.*, c.company_name, c.contact_name
      FROM sows s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.id = $1`, [req.params.id]);
    if (sowResult.rows.length === 0) return res.status(404).json({ error: 'SOW not found' });
    const sow = sowResult.rows[0];

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sow-${sow.id}.pdf"`);
    doc.pipe(res);

    // Cover page
    doc.rect(0, 0, 612, 150).fill('#0d904f');
    doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold').text('STATEMENT OF WORK', 50, 45, { align: 'center' });
    doc.fontSize(16).font('Helvetica').text(sow.title || 'Untitled SOW', 50, 78, { align: 'center' });
    doc.fontSize(11).text(`Client: ${sow.company_name || 'Client'} | Version ${sow.version || 1}`, 50, 110, { align: 'center' });
    doc.fillColor('#000').moveDown(5);
    doc.fontSize(9).fillColor('#888').text(`Generated: ${new Date().toLocaleDateString()} | Status: ${sow.status}`, { align: 'right' });
    doc.fillColor('#000').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').stroke();
    doc.moveDown(1);

    const section = (title) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0d904f').text(title);
      doc.fillColor('#000').moveDown(0.3);
    };
    const body = (text) => {
      if (!text) return;
      doc.fontSize(10).font('Helvetica').fillColor('#3c4043').text(text, { width: 495 });
      doc.moveDown(0.8);
    };

    if (sow.introduction) { section('1. Introduction'); body(sow.introduction); }
    if (sow.objectives) { section('2. Project Objectives'); body(sow.objectives); }
    if (sow.scope) { section('3. Scope of Work'); body(sow.scope); }
    if (sow.deliverables) { section('4. Deliverables'); body(sow.deliverables); }
    if (sow.timeline) { section('5. Timeline'); body(sow.timeline); }
    if (sow.milestones) { section('6. Milestones'); body(sow.milestones); }
    if (sow.assumptions) { section('7. Assumptions'); body(sow.assumptions); }
    if (sow.constraints) { section('8. Constraints'); body(sow.constraints); }
    if (sow.acceptance_criteria) { section('9. Acceptance Criteria'); body(sow.acceptance_criteria); }
    if (sow.payment_terms) { section('10. Payment Terms'); body(sow.payment_terms); }
    if (sow.change_management) { section('11. Change Management'); body(sow.change_management); }
    if (sow.governance) { section('12. Governance'); body(sow.governance); }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#888').text('This Statement of Work is a binding document once signed by both parties.', { align: 'center' });
    doc.end();
  } catch (err) {
    console.error('SOW PDF Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ CLIENT PORTAL ============
// Generate public access token for a proposal
app.post('/api/proposals/:id/create-link', authMiddleware, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(
      'UPDATE proposals SET public_token = $1 WHERE id = $2 RETURNING *',
      [token, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const portalUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/proposals/${token}`;
    res.json({ token, portalUrl, proposal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public proposal view (no auth required)
app.get('/api/public/proposals/:token', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.status, p.version, p.executive_summary, p.scope_of_work,
             p.deliverables, p.timeline, p.pricing_summary, p.terms_conditions,
             p.total_amount, p.valid_until, p.portal_approved_at,
             c.company_name, c.contact_name
      FROM proposals p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.public_token = $1`, [req.params.token]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found or link expired' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client digital approval via public token
app.post('/api/public/proposals/:token/approve', async (req, res) => {
  try {
    const { approvedBy, signature } = req.body;
    if (!approvedBy) return res.status(400).json({ error: 'approvedBy name is required' });
    const result = await pool.query(`
      UPDATE proposals
      SET portal_approved_at = NOW(), portal_approved_by = $1, status = 'accepted', accepted_at = NOW()
      WHERE public_token = $2 AND portal_approved_at IS NULL
      RETURNING id, title, status, portal_approved_at`,
      [approvedBy, req.params.token]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found, already approved, or link expired' });
    res.json({ message: 'Proposal approved successfully', proposal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PROPOSAL TEMPLATES ============
app.get('/api/proposal-templates', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const count = await pool.query('SELECT COUNT(*) FROM proposal_templates WHERE status = $1', ['active']);
    const result = await pool.query(
      'SELECT * FROM proposal_templates WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ['active', limit, offset]
    );
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count), totalPages: Math.ceil(count.rows[0].count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/proposal-templates', authMiddleware, async (req, res) => {
  try {
    const { name, type, description, sections, variables, is_default } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO proposal_templates (name, type, description, sections, variables, is_default, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, type || 'proposal', description || null,
       sections ? JSON.stringify(sections) : null,
       variables ? JSON.stringify(variables) : null,
       is_default || false, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/proposal-templates/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proposal_templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/proposal-templates/:id', authMiddleware, async (req, res) => {
  try {
    const { name, type, description, sections, variables, is_default } = req.body;
    const result = await pool.query(
      `UPDATE proposal_templates SET name=$1,type=$2,description=$3,sections=$4,variables=$5,is_default=$6,updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, type, description, sections ? JSON.stringify(sections) : null, variables ? JSON.stringify(variables) : null, is_default || false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/proposal-templates/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE proposal_templates SET status=$1 WHERE id=$2', ['deleted', req.params.id]);
    res.json({ message: 'Template deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create proposal from template (merge engine)
app.post('/api/proposals/from-template', authMiddleware, async (req, res) => {
  try {
    const { templateId, clientId, projectId, title, variables } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });

    const tmplResult = await pool.query('SELECT * FROM proposal_templates WHERE id = $1', [templateId]);
    if (tmplResult.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const template = tmplResult.rows[0];

    // Merge variables into template sections
    const mergeVars = (text, vars) => {
      if (!text || !vars) return text;
      let result = text;
      Object.entries(vars).forEach(([key, val]) => {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
        result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), val || '');
      });
      return result;
    };

    const sections = template.sections || {};
    const merged = {};
    Object.entries(sections).forEach(([key, val]) => {
      merged[key] = mergeVars(typeof val === 'string' ? val : JSON.stringify(val), variables || {});
    });

    // Get client info for context
    let clientInfo = {};
    if (clientId) {
      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0) clientInfo = clientResult.rows[0];
    }

    // Create the proposal
    const propResult = await pool.query(
      `INSERT INTO proposals (title, client_id, project_id, template_id, status, version,
         executive_summary, scope_of_work, deliverables, timeline, pricing_summary, terms_conditions, created_by)
       VALUES ($1,$2,$3,$4,'draft',1,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title || template.name, clientId || null, projectId || null, templateId,
       merged.executive_summary || merged.executiveSummary || null,
       merged.scope_of_work || merged.scopeOfWork || null,
       merged.deliverables || null,
       merged.timeline || null,
       merged.pricing_summary || merged.pricingSummary || null,
       merged.terms_conditions || merged.termsConditions || null,
       req.user.id]
    );

    // Update template usage count
    await pool.query('UPDATE proposal_templates SET usage_count = usage_count + 1 WHERE id = $1', [templateId]);

    res.status(201).json({ proposal: propResult.rows[0], template, mergedSections: merged });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ REVISION TRACKING ============
// Get revision history for a proposal
app.get('/api/proposals/:id/revisions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, u.first_name || ' ' || u.last_name as changed_by_name
       FROM proposal_revisions pr
       LEFT JOIN users u ON pr.changed_by = u.id
       WHERE pr.proposal_id = $1 ORDER BY pr.version DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper: create revision on proposal update
async function createRevision(proposalId, content, changeSummary, userId) {
  try {
    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version), 0) as maxv FROM proposal_revisions WHERE proposal_id = $1', [proposalId]
    );
    const nextVersion = parseInt(versionResult.rows[0].maxv) + 1;
    await pool.query(
      `INSERT INTO proposal_revisions (proposal_id, version, content, change_summary, changed_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [proposalId, nextVersion, JSON.stringify(content), changeSummary || 'Manual edit', userId]
    );
  } catch (e) { console.error('Failed to create revision:', e.message); }
}

// Intercept proposal updates to create revisions - add revision middleware
app.use('/api/proposals/:id', authMiddleware, async (req, res, next) => {
  if (req.method === 'PUT' && req.params.id && !isNaN(req.params.id)) {
    // Get current state before update
    try {
      const current = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
      if (current.rows.length > 0) {
        req._proposalBeforeUpdate = current.rows[0];
      }
    } catch (e) {}
  }
  next();
});

// ============ AI SCOPE REFINER ============
app.post('/api/proposals/:id/ai-refine-scope', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = result.rows[0];

    const systemPrompt = `You are a senior project delivery expert and proposal strategist with 20+ years of experience.
You specialize in identifying scope gaps, ambiguities, and risks in project proposals.`;

    const userPrompt = `Analyze this proposal and provide structured improvement suggestions.

Proposal Title: ${proposal.title}
Executive Summary: ${proposal.executive_summary || 'Not provided'}
Scope of Work: ${proposal.scope_of_work || 'Not provided'}
Deliverables: ${proposal.deliverables || 'Not provided'}
Timeline: ${proposal.timeline || 'Not provided'}
Pricing: ${proposal.pricing_summary || 'Not provided'}
Terms: ${proposal.terms_conditions || 'Not provided'}

Respond with ONLY valid JSON:
{
  "clarityIssues": [{"section":"text","issue":"text","suggestion":"text"}],
  "missingDeliverables": ["deliverable1","deliverable2"],
  "identifiedRisks": [{"risk":"text","severity":"high|medium|low","mitigation":"text"}],
  "scopeGaps": ["gap1","gap2"],
  "strengthsToKeep": ["strength1","strength2"],
  "overallScore": number (0-100),
  "priorityActions": ["action1","action2","action3"],
  "improvedScopeSuggestion": "text"
}`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });
    const parsed = parseAIJson(aiResponse);
    await persistAiResult(req.user.id, 'ai-refine-scope', 'proposal', proposal.id, userPrompt, aiResponse, tokensUsed, parsed);

    res.json({ refinement: parsed || {}, rawResponse: aiResponse, proposal: { id: proposal.id, title: proposal.title } });
  } catch (err) {
    console.error('AI Scope Refiner Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ AI PRICING ANALYZER ============
app.post('/api/proposals/:id/ai-price-check', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = result.rows[0];

    const systemPrompt = `You are a veteran pricing strategist with 20+ years at top technology consulting firms.
You benchmark project pricing against current market rates and industry standards.`;

    const userPrompt = `Analyze the pricing in this proposal against industry benchmarks.

Proposal Title: ${proposal.title}
Scope: ${proposal.scope_of_work || 'Not specified'}
Deliverables: ${proposal.deliverables || 'Not specified'}
Timeline: ${proposal.timeline || 'Not specified'}
Pricing Summary: ${proposal.pricing_summary || 'Not specified'}
Total Amount: ${proposal.total_amount ? '$' + Number(proposal.total_amount).toLocaleString() : 'Not specified'}

Respond with ONLY valid JSON:
{
  "pricingAssessment": "under_market|fair|over_market",
  "marketRate": {"low": number, "mid": number, "high": number},
  "currentTotal": number,
  "recommendedRange": {"min": number, "max": number},
  "percentageFromMarket": number,
  "flags": [{"issue":"text","severity":"high|medium|low","detail":"text"}],
  "pricingBreakdown": [{"item":"text","estimatedHours":number,"rate":number,"total":number}],
  "recommendations": ["rec1","rec2"],
  "confidence": number (0-100),
  "analysis": "narrative text"
}`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt });
    const parsed = parseAIJson(aiResponse);
    await persistAiResult(req.user.id, 'ai-price-check', 'proposal', proposal.id, userPrompt, aiResponse, tokensUsed, parsed);

    res.json({ priceCheck: parsed || {}, rawResponse: aiResponse, proposal: { id: proposal.id, title: proposal.title, totalAmount: proposal.total_amount } });
  } catch (err) {
    console.error('AI Price Check Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ CONTRACT GENERATOR ============
app.post('/api/proposals/:id/generate-contract', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.company_name, c.contact_name, c.address as client_address,
             c.city as client_city, c.state as client_state
      FROM proposals p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = result.rows[0];

    const systemPrompt = `You are a senior contract attorney and business development expert specializing in technology services contracts.
You transform approved proposals into formal, legally-sound contracts with appropriate protective clauses.`;

    const userPrompt = `Transform this approved proposal into a formal contract.

Proposal: ${proposal.title}
Client: ${proposal.company_name || 'Client'}
Status: ${proposal.status}
Scope: ${proposal.scope_of_work || 'As specified in proposal'}
Deliverables: ${proposal.deliverables || 'As specified in proposal'}
Timeline: ${proposal.timeline || 'As mutually agreed'}
Pricing: ${proposal.pricing_summary || 'As specified'}
Total: ${proposal.total_amount ? '$' + Number(proposal.total_amount).toLocaleString() : 'TBD'}
Terms: ${proposal.terms_conditions || 'Standard terms apply'}

Generate a comprehensive contract. Respond with ONLY valid JSON:
{
  "contractTitle": "text",
  "effectiveDate": "text",
  "parties": {"serviceProvider": "text", "client": "text"},
  "recitals": "text",
  "scope": "text",
  "deliverables": "text",
  "timeline": "text",
  "paymentTerms": "text",
  "ipClauses": "text",
  "liabilityLimitations": "text",
  "confidentiality": "text",
  "termination": "text",
  "disputeResolution": "text",
  "governingLaw": "text",
  "fullContractText": "complete formatted contract text"
}`;

    const { content: aiResponse, tokensUsed } = await callOpenRouter({ systemPrompt, userPrompt, maxTokens: 6000 });
    const parsed = parseAIJson(aiResponse);
    await persistAiResult(req.user.id, 'generate-contract', 'proposal', proposal.id, userPrompt, aiResponse, tokensUsed, parsed);

    res.json({ contract: parsed || {}, rawResponse: aiResponse, proposal: { id: proposal.id, title: proposal.title } });
  } catch (err) {
    console.error('Contract Generator Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ AI RESULTS CRUD ============
app.get('/api/ai-results', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const count = await pool.query('SELECT COUNT(*) FROM ai_results');
    const result = await pool.query('SELECT * FROM ai_results ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count), totalPages: Math.ceil(count.rows[0].count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// AI feature mount: sow-generate
app.use('/api/ai/sow-generate', require('./routes/ai-sow-generate'));
// === Batch 07 Gaps & Frontend Mounts ===
app.use('/api/gap-no-ai-sow-generation-endpoint', require('./routes/gap-no-ai-sow-generation-endpoint'));
app.use('/api/gap-no-ai-proposalfrombrief-generation', require('./routes/gap-no-ai-proposalfrombrief-generation'));
app.use('/api/gap-no-ai-clauseterm-recommendation', require('./routes/gap-no-ai-clauseterm-recommendation'));
app.use('/api/gap-no-ai-pricing-intelligence', require('./routes/gap-no-ai-pricing-intelligence'));
app.use('/api/gap-no-ai-risk-allocation-generation', require('./routes/gap-no-ai-risk-allocation-generation'));
app.use('/api/gap-no-client-project-or-proposal-crud', require('./routes/gap-no-client-project-or-proposal-crud'));
app.use('/api/gap-no-template-library-or-section-snippets', require('./routes/gap-no-template-library-or-section-snippets'));
app.use('/api/gap-no-pricingratecard-management', require('./routes/gap-no-pricingratecard-management'));
app.use('/api/gap-no-pdf-export-route-codebase-imports-pdf-lib', require('./routes/gap-no-pdf-export-route-codebase-imports-pdf-lib'));
app.use('/api/gap-no-esignature-workflow', require('./routes/gap-no-esignature-workflow'));
app.use('/api/gap-no-changeorder-tracking', require('./routes/gap-no-changeorder-tracking'));
app.use('/api/gap-no-notifications-audit-log-or-rbac', require('./routes/gap-no-notifications-audit-log-or-rbac'));
// === End Batch 07 ===
