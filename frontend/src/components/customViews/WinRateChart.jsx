import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function WinRateChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API}/custom-views/win-rate`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading win-rate chart...</div>;
  if (err) return <div style={{ padding: 24, color: '#c00' }}>Error: {err}</div>;
  if (!data) return null;

  const monthly = data.monthly || [];
  const maxTotal = Math.max(1, ...monthly.map(m => m.total));
  const chartH = 220;

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 6px', color: '#1a73e8' }}>Proposal Win Rate</h3>
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        Overall: <b>{data.totals?.winRate || 0}%</b> &nbsp;|&nbsp; Won: {data.totals?.won || 0} &nbsp;|&nbsp;
        Lost: {data.totals?.lost || 0} &nbsp;|&nbsp; Pending: {data.totals?.pending || 0}
      </p>

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, height: chartH,
        marginTop: 24, padding: '0 8px', borderBottom: '2px solid #e0e0e0',
      }}>
        {monthly.map((m, i) => {
          const wonH = (m.won / maxTotal) * chartH;
          const lostH = (m.lost / maxTotal) * chartH;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div title={`Win rate: ${m.winRate}%`} style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{m.winRate}%</div>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', width: '70%', minWidth: 24 }}>
                <div style={{ height: wonH, background: '#34a853', borderRadius: '4px 4px 0 0' }} title={`Won: ${m.won}`} />
                <div style={{ height: lostH, background: '#ea4335' }} title={`Lost: ${m.lost}`} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, padding: '0 8px' }}>
        {monthly.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#777' }}>{m.month?.slice(5)}</div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#34a853', marginRight: 6 }} />Won</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#ea4335', marginRight: 6 }} />Lost</span>
      </div>
    </div>
  );
}
