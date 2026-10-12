// // === Batch 07 Gaps & Frontend Mounts ===
import React, { useState } from 'react';
import FormattedAIReport from '../components/FormattedAIReport';

export default function CfProposalTemplateLibrary() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sampleRequests = [
    { label: "Project scenario", value: "A consulting team needs reusable discovery, implementation, pricing, and legal sections for mid-market cloud migration proposals.\nPrepare a practical project-specific response with scope, deliverables, assumptions, missing prerequisites, risks, and next decisions." },
    { label: "Delivery review", value: "A consulting team needs reusable discovery, implementation, pricing, and legal sections for mid-market cloud migration proposals.\nReview the delivery plan: identify dependencies, owners by role, milestones, acceptance evidence, likely blockers, and mitigation options. Do not invent record IDs." },
    { label: "Executive brief", value: "A consulting team needs reusable discovery, implementation, pricing, and legal sections for mid-market cloud migration proposals.\nWrite a concise executive brief with business outcome, estimated effort, commercial considerations, key risks, and decisions needed before approval." }
  ];

  const applySampleRequest = (value) => {
    setInput(value);
    setError(null);
  };

  async function run() {
    setLoading(true); setError(null); setOutput(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch('/api/cf-proposal-template-library', {
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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Proposal template library</h1>
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
      {output !== null && <FormattedAIReport response={output} title="AI result" />}
    </div>
  );
}
