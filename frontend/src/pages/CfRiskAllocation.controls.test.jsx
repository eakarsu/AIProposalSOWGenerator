import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import CfRiskAllocation from './CfRiskAllocation';

it('fills a feature preset without submitting and formats returned JSON', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ result: { approved: false, count: 0, note: '', items: [{ name: 'Scope', score: 0 }] } }),
  });
  act(() => root.render(<CfRiskAllocation />));
  const preset = [...host.querySelectorAll('button')].find(item => item.textContent === 'Delivery review');
  act(() => preset.click());
  expect(host.querySelector('textarea').value).toContain('client-owned data cleansing');
  expect(fetchMock).not.toHaveBeenCalled();
  const run = [...host.querySelectorAll('button')].find(item => item.textContent === 'Run');
  await act(async () => { run.click(); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('Approved');
  expect(host.textContent).toContain('No');
  expect(host.textContent).toContain('(empty)');
  expect(host.querySelector('table')).toBeTruthy();
  act(() => root.unmount());
  host.remove();
  fetchMock.mockRestore();
});
