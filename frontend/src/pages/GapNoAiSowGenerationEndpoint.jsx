// // === Batch 07 Gaps & Frontend Mounts ===
import React, { useState } from 'react';

export default function GapNoAiSowGenerationEndpoint() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true); setError(null); setOutput(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch('/api/gap-no-ai-sow-generation-endpoint', {
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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>No AI SOW generation endpoint</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>AIProposalSOWGenerator - Gap feature</p>
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
