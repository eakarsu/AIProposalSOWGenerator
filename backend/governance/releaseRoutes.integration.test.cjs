'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { createWorkflow } = require('./workflowCore');
const { createGovernedRouter } = require('./routerFactory');
const config = require('./config');
const { sha256 } = require('./reviewedDocument');

test('reviewed PDF and named signer package record local evidence without provider claims', {
  skip: process.env.RUN_RELEASE_DB_TEST !== '1' && 'requires a disposable migrated PostgreSQL database',
}, async () => {
  const pool = require('../db');
  const database = (await pool.query('SELECT current_database() AS name')).rows[0].name;
  if (!/^codex_proposal_release_test_/.test(database)) {
    await pool.end();
    throw new Error('integration test refuses a non-disposable database');
  }
  const tenant = 'tenant-release-test';
  const people = {};
  for (const [token, role] of Object.entries({
    manager: 'proposal_manager', editor: 'proposal_editor', delivery: 'delivery_reviewer',
    commercial: 'commercial_reviewer', account: 'account_owner', operator: 'integration_operator',
    outsider: 'auditor',
  })) {
    people[token] = (await pool.query(
      'INSERT INTO users(email,password,first_name) VALUES ($1,$2,$3) RETURNING id',
      [`${token}@release.test`, 'test-hash', token]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO governed_tenant_memberships(tenant_id,actor_id,role,granted_by)
       VALUES ($1,$2,$3,'test')`, [token === 'outsider' ? 'tenant-other-test' : tenant,String(people[token]),role]
    );
  }
  const client = (await pool.query(
    "INSERT INTO clients(company_name) VALUES ('Example Client') RETURNING id"
  )).rows[0].id;
  const proposal = (await pool.query(
    `INSERT INTO proposals(title,client_id,status,version,executive_summary,scope_of_work,
      deliverables,timeline,pricing_summary,terms_conditions,total_amount,created_by)
     VALUES ('Reviewed Migration Proposal',$1,'approved',1,'Executive summary text',
      'Install reviewed workflow','Working release','Four weeks','Fixed fee','Payment in 30 days',1200,$2)
     RETURNING id`, [client,people.manager]
  )).rows[0].id;
  const auth = (req, res, next) => {
    const token = String(req.get('Authorization') || '').replace(/^Bearer /, '');
    if (!people[token]) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = { id: people[token] };
    next();
  };
  const db = {
    query: async (sql, params) => (await pool.query(sql, params)).rows,
    transaction: async work => {
      const clientConnection = await pool.connect();
      try {
        await clientConnection.query('BEGIN');
        const value = await work(async (sql, params) => (await clientConnection.query(sql, params)).rows);
        await clientConnection.query('COMMIT');
        return value;
      } catch (error) {
        await clientConnection.query('ROLLBACK');
        throw error;
      } finally { clientConnection.release(); }
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/governed-proposal-releases', createGovernedRouter({ express, workflow:createWorkflow(config), auth, db }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = `${origin}/api/governed-proposal-releases`;
  const request = (path, identity, options = {}) => fetch(`${base}${path}`, {
    ...options,
    headers: { 'X-Tenant-Id': tenant, ...(identity ? { Authorization:`Bearer ${identity}` } : {}),
      ...options.headers },
  });
  const write = (path, identity, body, key = crypto.randomUUID()) => request(path, identity, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Idempotency-Key':key },
    body:JSON.stringify(body),
  });

  try {
    const created = await write('/cases/from-reviewed-document', 'manager', {
      sourceType:'proposal', sourceId:proposal, subjectRef:'opportunity:reviewed-1',
      policyVersion:'v1',effectiveAt:'2026-10-04T12:00:00Z',
    });
    assert.equal(created.status, 201, await created.clone().text());
    const bound = await created.json();
    const caseId = bound.id;
    assert.equal(bound.source_snapshot.kind, 'proposal');
    assert.match(bound.source_snapshot.sha256, /^[a-f0-9]{64}$/);
    assert.equal((await write(`/cases/${caseId}/render-pdf`, 'operator', {})).status, 409);

    const kinds = ['draft_version','commercial_review','legal_review','client_approval'];
    for (const kind of kinds) {
      const digest = kind === 'draft_version' ? bound.source_snapshot.sha256 : sha256(Buffer.from(kind));
      const response = await write(`/cases/${caseId}/evidence`, 'manager', {
        kind,sourceRef:`vault:${kind}`,sourceVersion:kind === 'draft_version' ? '1' : 'review-1',
        sha256:digest,capturedAt:'2026-10-04T12:05:00Z',metadata:{},
      });
      assert.equal(response.status, 201, await response.clone().text());
    }

    let version = bound.version;
    const step = async (identity, action) => {
      const response = await write(`/cases/${caseId}/transitions`, identity,
        { action,reason:`Reviewed evidence for ${action}`,expectedVersion:version });
      assert.equal(response.status, 200, await response.clone().text());
      const updated = await response.json();
      version = updated.version;
      return updated;
    };
    await step('manager','lock_evidence');
    await step('editor','record_draft');
    await step('delivery','submit_content_review');
    await step('commercial','submit_commercial_legal');
    await step('account','record_client_approval');
    await step('manager','queue_export');
    assert.equal((await write(`/cases/${caseId}/transitions`, 'operator', {
      action:'record_export',reason:'Reviewed PDF must exist first',expectedVersion:version,
    })).status, 409);

    await pool.query('UPDATE proposals SET scope_of_work=$1 WHERE id=$2', ['Changed after review',proposal]);
    assert.equal((await write(`/cases/${caseId}/render-pdf`, 'operator', {})).status, 409);
    await pool.query('UPDATE proposals SET scope_of_work=$1 WHERE id=$2', ['Install reviewed workflow',proposal]);
    const rendered = await write(`/cases/${caseId}/render-pdf`, 'operator', {});
    assert.equal(rendered.status, 201, await rendered.clone().text());
    const pdfMeta = await rendered.json();
    assert.match(pdfMeta.pdf_sha256, /^[a-f0-9]{64}$/);
    assert.equal((await request(`/cases/${caseId}/pdf`)).status, 401);
    assert.equal((await request(`/cases/${caseId}/pdf`, 'outsider', {
      headers:{ 'X-Tenant-Id':'tenant-other-test' },
    })).status, 404);
    const downloaded = await request(`/cases/${caseId}/pdf`, 'manager');
    assert.equal(downloaded.status, 200);
    const pdfBytes = Buffer.from(await downloaded.arrayBuffer());
    assert.equal(pdfBytes.subarray(0,5).toString(), '%PDF-');
    assert.equal(sha256(pdfBytes), pdfMeta.pdf_sha256);
    await assert.rejects(pool.query('UPDATE governed_rendered_pdfs SET pdf_bytes=$1 WHERE case_id=$2',
      [Buffer.from('tampered'),caseId]), /append-only/);
    await step('operator','record_export');

    const prepared = await write(`/cases/${caseId}/signer-packages`, 'account', {
      signerName:'Ada Reviewer',signerTitle:'Director',
    });
    assert.equal(prepared.status, 201, await prepared.clone().text());
    const packageRecord = await prepared.json();
    assert.match(packageRecord.signerPath, /\/signer\/[A-Za-z0-9_-]{43}$/);
    const signerUrl = `${origin}${packageRecord.signerPath}`;
    assert.equal((await fetch(signerUrl)).status, 404);
    const handoff = await write(`/cases/${caseId}/signer-packages/${packageRecord.id}/handoffs`, 'manager', {
      method:'manual_secure_link',attestation:'I gave the reviewed link to Ada in person.',
    });
    assert.equal(handoff.status, 201, await handoff.clone().text());
    assert.equal((await handoff.json()).externalDeliveryVerified, false);
    const signerPage = await fetch(signerUrl);
    assert.equal(signerPage.status, 200);
    assert.match(await signerPage.text(), /Ada Reviewer/);
    const signerPdf = await fetch(`${signerUrl}/pdf`);
    assert.equal(signerPdf.status, 200);
    assert.equal(sha256(Buffer.from(await signerPdf.arrayBuffer())), pdfMeta.pdf_sha256);
    assert.equal((await fetch(`${signerUrl}/accept`, {
      method:'POST',headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({typedName:'Different Person',accepted:'yes',pdfSha256:pdfMeta.pdf_sha256}),
    })).status, 422);
    const accepted = await fetch(`${signerUrl}/accept`, {
      method:'POST',headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({typedName:'Ada Reviewer',accepted:'yes',pdfSha256:pdfMeta.pdf_sha256}),
    });
    assert.equal(accepted.status, 201, await accepted.clone().text());
    assert.match(await accepted.text(), /without independent identity verification/);
    assert.equal((await fetch(`${signerUrl}/accept`, {
      method:'POST',headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({typedName:'Ada Reviewer',accepted:'yes',pdfSha256:pdfMeta.pdf_sha256}),
    })).status, 409);
    const artifacts = await request(`/cases/${caseId}/release-artifacts`, 'manager');
    assert.equal(artifacts.status, 200);
    const record = await artifacts.json();
    assert.equal(record.pdf.pdf_sha256, pdfMeta.pdf_sha256);
    assert.equal(record.packages[0].signer_name, 'Ada Reviewer');
    assert.ok(record.packages[0].accepted_at);
    assert.match(record.packages[0].acceptance_evidence_sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.externalSignatureReceipt, false);
    assert.equal(record.crmReceipt, false);
    assert.equal((await request(`/cases/${caseId}/release-artifacts`, 'outsider', {
      headers:{ 'X-Tenant-Id':'tenant-other-test' },
    })).status, 404);
    await assert.rejects(pool.query('UPDATE governed_signer_events SET signer_name=$1 WHERE package_id=$2',
      ['Other',packageRecord.id]), /append-only/);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
