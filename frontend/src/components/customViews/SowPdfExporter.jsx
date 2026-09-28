import React, { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function SowPdfExporter() {
  const [sowId, setSowId] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setStatus('');
    try {
      const token = localStorage.getItem('token') || '';
      const id = sowId.trim();
      if (!/^\d+$/.test(id)) throw new Error('Enter the numeric id of an existing SOW. No sample document is generated.');
      const url = `${API}/custom-views/sow-pdf/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dl;
      a.download = `SOW-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dl);
      setStatus(`PDF downloaded (${Math.round(blob.size / 1024)} KB).`);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 6px', color: '#1a73e8' }}>SOW Document PDF Export</h3>
      <p style={{ margin: '0 0 14px', color: '#666', fontSize: 13 }}>
        Export an existing Statement of Work by id. Missing or unauthorized ids return an error — no sample document is generated.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="SOW id"
          value={sowId}
          onChange={e => setSowId(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, minWidth: 200 }}
        />
        <button
          onClick={download}
          disabled={busy || !sowId.trim()}
          style={{
            padding: '9px 18px', background: '#1a73e8', color: '#fff',
            border: 'none', borderRadius: 6, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Generating...' : 'Download SOW PDF'}
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: status.startsWith('Error') ? '#fee' : '#e8f5e9', borderRadius: 4, fontSize: 13 }}>
          {status}
        </div>
      )}
    </div>
  );
}
