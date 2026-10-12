import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FormattedAIReport from './FormattedAIReport';

it('renders returned and saved structured facts, lists, tables, false, zero and empty strings', () => {
  const payload = { ok: false, budget: 0, note: '', risks: [
    { name: 'Data migration', impact: 0, mitigated: false },
    { name: 'Vendor delay', impact: 2, mitigated: true },
  ], sections: { scope: ['Discovery', 'Implementation'] } };
  for (const response of [payload, { id: 17, ai_response: JSON.stringify(payload) }]) {
    const html = renderToStaticMarkup(<FormattedAIReport response={response} />);
    expect(html).toContain('Ok');
    expect(html).toContain('No');
    expect(html).toContain('Budget');
    expect(html).toContain('0');
    expect(html).toContain('(empty)');
    expect(html).toContain('<table');
    expect(html).toContain('Data migration');
    expect(html).toContain('Discovery');
    expect(html).not.toContain('{&quot;');
  }
});
