import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function colorFor(value, min, max) {
  if (max === min) return '#e8f0fe';
  const t = (value - min) / (max - min);
  // Light blue -> dark blue
  const r = Math.round(232 - 200 * t);
  const g = Math.round(240 - 175 * t);
  const b = Math.round(254 - 70 * t);
  return `rgb(${r},${g},${b})`;
}

export default function ServiceRevenueHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API}/custom-views/service-revenue-heatmap`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading heatmap...</div>;
  if (err) return <div style={{ padding: 24, color: '#c00' }}>Error: {err}</div>;
  if (!data) return null;

  const months = data.months || [];
  const services = data.services || [];
  const { min = 0, max = 1 } = data.bounds || {};

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 6px', color: '#1a73e8' }}>Service Line Revenue Heatmap</h3>
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        Grand total: <b>${(data.grandTotal || 0).toLocaleString()}</b> across {services.length} service lines &times; {months.length} months
      </p>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', background: '#fafafa' }}>Service</th>
              {months.map(m => (
                <th key={m} style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', background: '#fafafa', fontSize: 11 }}>{m.slice(5)}</th>
              ))}
              <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', background: '#fafafa' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ fontWeight: 500 }}>{s.serviceName}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.category}</div>
                </td>
                {s.cells.map((c, j) => (
                  <td key={j} title={`${s.serviceName} - ${c.month}: $${c.revenue.toLocaleString()} (${c.deals} deals)`}
                      style={{
                        padding: '8px 4px', textAlign: 'center',
                        background: colorFor(c.revenue, min, max),
                        color: c.revenue > (min + max) / 1.5 ? '#fff' : '#333',
                        borderBottom: '1px solid #f0f0f0',
                      }}>
                    {Math.round(c.revenue / 1000)}k
                  </td>
                ))}
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>
                  ${Math.round(s.total / 1000)}k
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#666' }}>
        <span>Low</span>
        <div style={{ display: 'flex', height: 12, width: 200 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <div key={i} style={{ flex: 1, background: colorFor(min + t * (max - min), min, max) }} />
          ))}
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
