import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { AIPricingSuggester } from './App';

it('formats a saved AI history record when opened from the list', async () => {
  const saved = { id: 7, project_name: 'Portal', project_type: 'Web Application', pricing_strategy: 'fixed',
    suggested_min_price: 0, suggested_max_price: 100, suggested_hourly_rate: 0,
    confidence_score: 0, duration_weeks: 4, team_size: 2,
    ai_response: JSON.stringify({ approved: false, budget: 0, note: '', phases: [{ name: 'Discovery', weeks: 0 }] }) };
  const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [saved] } });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<MemoryRouter><AIPricingSuggester /></MemoryRouter>); await Promise.resolve(); });
  expect(host.querySelector('.ai-item')).toBeTruthy();
  act(() => host.querySelector('.ai-item').click());
  const report = host.querySelector('.ai-report');
  expect(report).toBeTruthy();
  expect(report.textContent).toContain('Approved');
  expect(report.textContent).toContain('No');
  expect(report.textContent).toContain('(empty)');
  expect(report.querySelector('table')).toBeTruthy();
  act(() => root.unmount()); host.remove(); get.mockRestore();
});
