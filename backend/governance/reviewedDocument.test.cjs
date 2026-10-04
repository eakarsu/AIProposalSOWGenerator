'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshot, assertBinding, renderPdf, sha256 } = require('./reviewedDocument');

test('approved proposal and SOW content is pinned before local PDF rendering', async () => {
  for (const kind of ['proposal','sow']) {
    const row = {
      id: 7, version: 3, status: 'approved', title: `Reviewed ${kind}`,
      company_name: 'Client Ltd', total_amount: '1200.00',
      executive_summary: 'Reviewed summary', scope_of_work: 'Reviewed proposal scope',
      scope: 'Reviewed SOW scope', acceptance_criteria: 'Accepted on delivery',
    };
    const reviewed = snapshot(kind, row);
    assertBinding({ kind, id:7, version:3, sha256:reviewed.digest }, reviewed);
    assert.throws(() => assertBinding({ kind, id:7, version:3, sha256:'0'.repeat(64) }, reviewed), /no longer matches/);
    const changed = snapshot(kind, { ...row, title:'Changed after review' });
    assert.notEqual(changed.digest, reviewed.digest);
    const pdf = await renderPdf(reviewed.source);
    assert.equal(pdf.subarray(0,5).toString(), '%PDF-');
    assert.ok(pdf.length > 100);
    assert.match(sha256(pdf), /^[a-f0-9]{64}$/);
  }
});

test('unapproved source cannot become a reviewed PDF binding', () => {
  assert.throws(() => snapshot('proposal', { id:1,version:1,status:'draft',title:'Draft' }), /approved/);
});
