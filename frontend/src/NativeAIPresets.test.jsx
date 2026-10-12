import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { AIPricingSuggester, AIWinLossAnalyzer, AICompetitorDifferentiator, AITimelineGenerator, AIRiskAssessment } from './App';

const pages = [AIPricingSuggester, AIWinLossAnalyzer, AICompetitorDifferentiator, AITimelineGenerator, AIRiskAssessment];

it.each(pages)('%s fills its visible AI form without posting', (Page) => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [] } });
  const post = jest.spyOn(axios, 'post');
  act(() => root.render(<MemoryRouter><Page /></MemoryRouter>));
  const open = host.querySelector('.page-header button');
  expect(open).toBeTruthy();
  act(() => open.click());
  const presets = [...host.querySelectorAll('.example-buttons button')];
  expect(presets.length).toBeGreaterThanOrEqual(2);
  for (const preset of presets) {
    act(() => preset.click());
    const fields = [...host.querySelectorAll('.modal .form-grid input, .modal .form-grid textarea, .modal .form-grid select')];
    expect(fields.length).toBeGreaterThanOrEqual(3);
    for (const field of fields) expect(String(field.value).length).toBeGreaterThan(0);
  }
  expect(post).not.toHaveBeenCalled();
  act(() => root.unmount()); host.remove(); get.mockRestore(); post.mockRestore();
});
