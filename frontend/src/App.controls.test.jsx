import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App, { AIGenerator } from './App';

let host;
let root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  jest.spyOn(axios, 'post');
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

it('loads every generator preset without making a generation request', () => {
  act(() => root.render(<AIGenerator />));
  const presets = [...host.querySelectorAll('button')].filter(button =>
    ['E-Commerce Platform', 'Healthcare Mobile App', 'CRM System Integration', 'AI Chatbot Solution', 'Cloud Migration Project'].includes(button.textContent.trim()));
  expect(presets).toHaveLength(5);
  for (const button of presets) {
    act(() => button.click());
    expect(host.querySelector('textarea').value.length).toBeGreaterThan(100);
    expect(host.querySelector('select').value).toBeTruthy();
  }
  expect(axios.post).not.toHaveBeenCalled();
});

(process.env.REACT_APP_DEMO_EMAIL && process.env.REACT_APP_DEMO_PASSWORD ? it : it.skip)('fills the configured demo credentials without submitting', () => {
  expect(process.env.REACT_APP_DEMO_EMAIL).toBeTruthy();
  expect(process.env.REACT_APP_DEMO_PASSWORD).toBeTruthy();
  window.history.replaceState({}, '', '/login');
  localStorage.removeItem('token');
  act(() => root.render(<App />));
  const button = [...host.querySelectorAll('button')].find(item => item.textContent.includes('Fill Demo Credentials'));
  expect(button).toBeTruthy();
  act(() => button.click());
  const inputs = host.querySelectorAll('input');
  expect(inputs[0].value).toBe(process.env.REACT_APP_DEMO_EMAIL);
  expect(inputs[1].value).toBe(process.env.REACT_APP_DEMO_PASSWORD);
  expect(axios.post).not.toHaveBeenCalled();
});
