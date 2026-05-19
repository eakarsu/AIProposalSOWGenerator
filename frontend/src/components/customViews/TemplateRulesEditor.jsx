import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function authHeaders() {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const EMPTY = {
  tier_name: '',
  min_amount: 0,
  max_amount: 0,
  discount_pct: 0,
  payment_terms: 'Net 30',
  terms_conditions: '',
};

export default function TemplateRulesEditor() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/custom-views/template-rules`, { headers: authHeaders() });
      const j = await r.json();
      setRules(j.rules || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const url = editId
        ? `${API}/custom-views/template-rules/${editId}`
        : `${API}/custom-views/template-rules`;
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Save failed');
      setForm(EMPTY);
      setEditId(null);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this pricing tier?')) return;
    try {
      await fetch(`${API}/custom-views/template-rules/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({
      tier_name: r.tier_name || '',
      min_amount: Number(r.min_amount) || 0,
      max_amount: Number(r.max_amount) || 0,
      discount_pct: Number(r.discount_pct) || 0,
      payment_terms: r.payment_terms || '',
      terms_conditions: r.terms_conditions || '',
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY);
  }

  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
  const labelStyle = { display: 'block', fontSize: 11, color: '#555', marginBottom: 4, fontWeight: 500 };

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 6px', color: '#1a73e8' }}>Proposal Template Rules (Pricing Tiers & T&Cs)</h3>
      <p style={{ margin: '0 0 16px', color: '#666', fontSize: 13 }}>
        Configure pricing tiers, discount rates, payment terms, and terms & conditions applied to generated proposals.
      </p>

      {err && <div style={{ background: '#fee', padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 13, color: '#c00' }}>{err}</div>}

      <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 6, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Tier Name *</label>
            <input style={inputStyle} value={form.tier_name} onChange={e => setForm({ ...form, tier_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Min Amount ($)</label>
            <input type="number" style={inputStyle} value={form.min_amount} onChange={e => setForm({ ...form, min_amount: +e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Max Amount ($)</label>
            <input type="number" style={inputStyle} value={form.max_amount} onChange={e => setForm({ ...form, max_amount: +e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Discount %</label>
            <input type="number" step="0.1" style={inputStyle} value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: +e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Payment Terms</label>
            <input style={inputStyle} value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Terms & Conditions</label>
            <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.terms_conditions} onChange={e => setForm({ ...form, terms_conditions: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={save} disabled={busy || !form.tier_name}
            style={{ padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
          >
            {editId ? 'Update Tier' : 'Add Tier'}
          </button>
          {editId && (
            <button onClick={cancelEdit} style={{ padding: '8px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Tier</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Range</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Discount</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Payment</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>T&Cs</th>
              <th style={{ padding: 8, borderBottom: '2px solid #e0e0e0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No tiers configured yet.</td></tr>
            )}
            {rules.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8, fontWeight: 600 }}>{r.tier_name}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>${Number(r.min_amount).toLocaleString()} - ${Number(r.max_amount).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.discount_pct).toFixed(1)}%</td>
                <td style={{ padding: 8 }}>{r.payment_terms}</td>
                <td style={{ padding: 8, maxWidth: 280, fontSize: 12, color: '#555' }}>{r.terms_conditions}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                  <button onClick={() => startEdit(r)} style={{ marginRight: 6, padding: '4px 10px', background: '#fff', border: '1px solid #1a73e8', color: '#1a73e8', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                  <button onClick={() => remove(r.id)} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #ea4335', color: '#ea4335', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
