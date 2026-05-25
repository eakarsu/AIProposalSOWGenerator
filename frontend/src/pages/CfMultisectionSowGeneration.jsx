// // === Batch 07 Gaps & Frontend Mounts ===
import React, { useState } from 'react';

export default function CfMultisectionSowGeneration() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sampleRequests = [
      {
          "label": "Scenario",
          "value": "Run Multi-section SOW generation for a realistic customer case.\nContext: a team needs a practical recommendation based on incomplete operating data.\nGoal: identify the best action, key risks, missing information, and expected business impact.\nReturn: summary, prioritized action plan, assumptions, and follow-up questions."
      },
      {
          "label": "Data sample",
          "value": "Analyze this Multi-section SOW generation data sample.\nInput records:\n- Record 1: urgent, customer impact high, owner unassigned\n- Record 2: medium priority, blocked by missing data\n- Record 3: recurring issue, automation opportunity\nReturn structured findings, anomalies, recommendations, and confidence."
      },
      {
          "label": "Executive review",
          "value": "Prepare an executive review for Multi-section SOW generation.\nAudience: business owner, operations lead, and implementation team.\nInclude impact, risk, estimated effort, decision points, and a concise next-step plan."
      }
  ];

  const applySampleRequest = (value) => {
    setInput(value);
    setError(null);
  };

  async function run() {
    setLoading(true); setError(null); setOutput(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch('/api/cf-multisection-sow-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ input }),
      });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('json') ? await res.json() : { text: await res.text() };
      if (!res.ok) throw new Error((data && data.error) || res.statusText);
      setOutput(data);
    } catch (e) {
      setError(e && e.message ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Multi-section SOW generation</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>AIProposalSOWGenerator - Custom feature</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {sampleRequests.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => applySampleRequest(sample.value)}
              style={{ padding: '6px 10px', background: '#eef2ff', color: '#1e3a8a', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {sample.label}
            </button>
          ))}
        </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe inputs or paste context..."
        style={{ width: '100%', minHeight: 160, padding: 10, border: '1px solid #ddd', borderRadius: 6, fontFamily: 'inherit' }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={run} disabled={loading}
          style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          {loading ? 'Running...' : 'Run'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fee', color: '#900', borderRadius: 6 }}>{error}</div>
      )}
      {output && (
        <pre style={{ marginTop: 16, padding: 12, background: '#f7f7f7', borderRadius: 6, overflow: 'auto', maxHeight: 480 }}>
{JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}
