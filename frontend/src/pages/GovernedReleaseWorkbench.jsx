import React, { useState } from 'react';
import axios from 'axios';
import ProposalReviewChecklist from './ProposalReviewChecklist';

const base = `${process.env.REACT_APP_API_URL || '/api'}/governed-proposal-releases`;
const storageKey = 'proposal-governed-tenant';
const now = () => new Date().toISOString();
const message = error => error.response?.data?.message || error.response?.data?.error || error.message;

export default function GovernedReleaseWorkbench() {
  const [tenant, setTenant] = useState(localStorage.getItem(storageKey) || '');
  const [policy, setPolicy] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [releaseArtifacts, setReleaseArtifacts] = useState({ pdf: null, packages: [] });
  const [history, setHistory] = useState([]);
  const [subjectRef, setSubjectRef] = useState('');
  const [sourceType, setSourceType] = useState('proposal');
  const [sourceId, setSourceId] = useState('');
  const [policyVersion, setPolicyVersion] = useState('v1');
  const [evidence, setEvidence] = useState({ kind: 'client_requirement_version', sourceRef: '', sourceVersion: '', sha256: '', consentBasis: '' });
  const [assessment, setAssessment] = useState('');
  const [decision, setDecision] = useState({ action: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [signer, setSigner] = useState({ name: '', title: '' });
  const [signerLink, setSignerLink] = useState('');
  const [handoff, setHandoff] = useState({ packageId: '', method: 'manual_secure_link', attestation: '' });

  function headers(write = false) {
    return { 'X-Tenant-Id': tenant.trim(), ...(write ? { 'Idempotency-Key': crypto.randomUUID() } : {}) };
  }
  async function request(method, path, body, write = false) {
    return axios({ method, url: `${base}${path}`, data: body, headers: headers(write) });
  }
  async function refresh() {
    if (!tenant.trim()) return;
    try {
      const [p, c] = await Promise.all([request('get', '/policy'), request('get', '/cases')]);
      setPolicy(p.data);
      setCases(Array.isArray(c.data) ? c.data : []);
      setError('');
    } catch (e) { setError(message(e)); }
  }
  async function selectCase(row) {
    setError('');
    if (selected?.id !== row.id) setSignerLink('');
    try {
      const [detail, events, artifacts] = await Promise.all([
        request('get', `/cases/${row.id}`), request('get', `/cases/${row.id}/history`),
        request('get', `/cases/${row.id}/release-artifacts`),
      ]);
      setSelected(detail.data);
      setHistory(Array.isArray(events.data) ? events.data : []);
      setReleaseArtifacts(artifacts.data);
    } catch (e) { setError(message(e)); }
  }
  async function mutate(task, success) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); await refresh(); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  function createCase(event) {
    event.preventDefault();
    mutate(async () => {
      const response = await request('post', '/cases/from-reviewed-document', {
        subjectRef: subjectRef.trim(), policyVersion: policyVersion.trim(),
        effectiveAt: now(), sourceType, sourceId: Number(sourceId),
      }, true);
      await selectCase(response.data);
    }, 'Versioned release case created.');
  }
  function addEvidence(event) {
    event.preventDefault();
    mutate(async () => {
      await request('post', `/cases/${selected.id}/evidence`, {
        ...evidence, sha256: evidence.sha256.toLowerCase().trim(), capturedAt: now(),
        metadata: {},
      }, true);
      await selectCase(selected);
    }, 'Evidence reference recorded.');
  }
  function assess(event) {
    event.preventDefault();
    let body;
    try { body = JSON.parse(assessment); }
    catch { setError('Assessment signals must be a JSON object.'); return; }
    mutate(async () => {
      const response = await request('post', `/cases/${selected.id}/assess`, body, true);
      setAssessmentResult(response.data);
      await selectCase(selected);
    }, 'Deterministic assessment recorded for human review.');
  }
  function transition(event) {
    event.preventDefault();
    mutate(async () => {
      await request('post', `/cases/${selected.id}/transitions`, {
        action: decision.action, reason: decision.reason.trim(), expectedVersion: selected.version,
      }, true);
      await selectCase(selected);
    }, 'Transition recorded.');
  }
  function renderReviewedPdf() {
    mutate(async () => {
      await request('post', `/cases/${selected.id}/render-pdf`, {}, true);
      await selectCase(selected);
    }, 'Reviewed source rendered and stored with an immutable PDF digest.');
  }
  async function downloadReviewedPdf() {
    try {
      const response = await axios({ method: 'get', url: `${base}/cases/${selected.id}/pdf`,
        headers: headers(), responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reviewed-${selected.id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(message(e)); }
  }
  function prepareSigner(event) {
    event.preventDefault();
    mutate(async () => {
      const response = await request('post', `/cases/${selected.id}/signer-packages`, {
        signerName: signer.name.trim(), signerTitle: signer.title.trim(),
      }, true);
      setSignerLink(response.data.signerPath
        ? new URL(response.data.signerPath, new URL(base, window.location.origin)).href : '');
      await selectCase(selected);
    }, 'Named signer package prepared. Copy its one-time link for manual handoff.');
  }
  function recordHandoff(event) {
    event.preventDefault();
    mutate(async () => {
      await request('post', `/cases/${selected.id}/signer-packages/${handoff.packageId}/handoffs`, {
        method: handoff.method, attestation: handoff.attestation.trim(),
      }, true);
      await selectCase(selected);
    }, 'Manual handoff attestation recorded; external delivery remains unverified.');
  }
  const actions = (policy?.transitions || []).filter(item => item.from === selected?.state);
  return <div className="page-content" style={{ padding: 24 }}>
    <h1>Governed proposal release</h1>
    <p>Track brief, rate card, draft, review, approval and export evidence. After review, this workbench renders and stores a local PDF and prepares a named signer link. Link handoff is operator attested; signer acceptance is token based and does not verify identity or create an external signature or CRM receipt.</p>
    <p>An operator must apply the governed migration and assign your account a tenant membership and workflow role before this page can load cases.</p>
    <label>Tenant ID <input value={tenant} onChange={e => { setTenant(e.target.value); localStorage.setItem(storageKey, e.target.value); }} placeholder="Your assigned tenant ID" /></label>
    <button type="button" onClick={refresh} disabled={!tenant.trim()}>Refresh</button>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {policy && <p>Required human review: {policy.professionalBoundary}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(420px, 2fr)', gap: 24 }}>
      <div>
        <h2>Release cases</h2>
        <form onSubmit={createCase}>
          <label>Approved source <select value={sourceType} onChange={e => setSourceType(e.target.value)}><option value="proposal">Proposal</option><option value="sow">Statement of work</option></select></label>
          <label>Approved source ID <input type="number" min="1" required value={sourceId} onChange={e => setSourceId(e.target.value)} /></label>
          <label>Opaque brief or opportunity reference <input required value={subjectRef} onChange={e => setSubjectRef(e.target.value)} placeholder="opportunity:123" /></label>
          <label>Policy version <input required value={policyVersion} onChange={e => setPolicyVersion(e.target.value)} /></label>
          <button disabled={busy || !tenant.trim()} type="submit">Create case</button>
        </form>
        {cases.length === 0 ? <p>No cases in this tenant.</p> : <ul>{cases.map(row =>
          <li key={row.id}><button type="button" onClick={() => selectCase(row)}>{row.subject_ref} · {row.state} · v{row.version}</button></li>
        )}</ul>}
      </div>
      <div>
        {!selected ? <p>Select a release case to inspect its evidence and reviews.</p> : <>
          <h2>{selected.subject_ref}</h2>
          <p>State: {selected.state}; version {selected.version}</p>
          <p>Frozen reviewed source: {selected.source_snapshot?.kind || 'unbound'} #{selected.source_snapshot?.id || '—'} · version {selected.source_snapshot?.version || '—'} · SHA-256 {selected.source_snapshot?.sha256 || '—'}</p>
          <h3>Evidence references</h3>
          <ul>{(selected.evidence || []).map(item => <li key={item.id}>{item.kind} · {item.source_ref} · {item.source_version} · SHA-256 {item.sha256}</li>)}</ul>
          <form onSubmit={addEvidence}>
            <select value={evidence.kind} onChange={e => setEvidence({ ...evidence, kind: e.target.value })}>
              {(policy?.evidenceKinds || []).map(kind => <option key={kind} value={kind}>{kind}</option>)}
            </select>
            <input required placeholder="Opaque storage reference" value={evidence.sourceRef} onChange={e => setEvidence({ ...evidence, sourceRef: e.target.value })} />
            <input required placeholder="Source version" value={evidence.sourceVersion} onChange={e => setEvidence({ ...evidence, sourceVersion: e.target.value })} />
            <input required minLength="64" maxLength="64" placeholder="SHA-256 digest" value={evidence.sha256} onChange={e => setEvidence({ ...evidence, sha256: e.target.value })} />
            <input placeholder="Consent or processing basis" value={evidence.consentBasis} onChange={e => setEvidence({ ...evidence, consentBasis: e.target.value })} />
            <button disabled={busy} type="submit">Record evidence</button>
          </form>
          <p>For draft_version evidence, use the frozen source version and SHA-256 shown above. PDF rendering also requires commercial, legal, and client approval evidence.</p>
          <h3>Assess release signals</h3>
          <p>Paste versioned signals from approved sources. This check flags missing or inconsistent signals and never sends or signs a proposal.</p>
          <form onSubmit={assess}>
            <textarea rows="7" style={{ width: '100%' }} required value={assessment} onChange={e => setAssessment(e.target.value)}
              placeholder='{"requirementsVersion":"r1","scopeVersion":"s1","rateCardVersion":"rate1","clauseLibraryVersion":"c1","draftVersion":"d1","acceptanceCoverage":1,"pricingReconciliationStatus":"balanced","legalReviewStatus":"passed","deliveryFeasibilityStatus":"verified","privacyStatus":"passed","exportProfile":"pdf_a","policyVersion":"v1"}' />
            <button disabled={busy} type="submit">Assess for review</button>
          </form>
          {assessmentResult && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(assessmentResult, null, 2)}</pre>}
          <h3>Human decision</h3>
          <form onSubmit={transition}>
            <select required value={decision.action} onChange={e => setDecision({ ...decision, action: e.target.value })}>
              <option value="">Choose action</option>{actions.map(item => <option key={item.action} value={item.action}>{item.action} → {item.to}</option>)}
            </select>
            <input required minLength="8" placeholder="Specific decision reason" value={decision.reason} onChange={e => setDecision({ ...decision, reason: e.target.value })} />
            <button disabled={busy || !actions.length} type="submit">Record decision</button>
          </form>
          <h3>Reviewed PDF</h3>
          {selected.state === 'export_queued' && <button type="button" disabled={busy} onClick={renderReviewedPdf}>Render and store reviewed PDF</button>}
          {releaseArtifacts.pdf ? <div>
            <p>Stored PDF SHA-256: {releaseArtifacts.pdf.pdf_sha256} · {releaseArtifacts.pdf.byte_size} bytes</p>
            <button type="button" onClick={downloadReviewedPdf}>Download exact stored PDF</button>
          </div> : <p>No reviewed PDF stored yet. Record export only after rendering.</p>}
          {selected.state === 'exported' && releaseArtifacts.pdf && <>
            <h3>Named signer package</h3>
            <form onSubmit={prepareSigner}>
              <label>Signer full name <input required minLength="2" maxLength="160" value={signer.name} onChange={e => setSigner({ ...signer, name: e.target.value })} /></label>
              <label>Signer title <input maxLength="160" value={signer.title} onChange={e => setSigner({ ...signer, title: e.target.value })} /></label>
              <button disabled={busy} type="submit">Prepare signer link</button>
            </form>
            {signerLink && <p>One-time signer link: <a href={signerLink} target="_blank" rel="noopener noreferrer">{signerLink}</a>. Copy it now; the token is not stored in readable form.</p>}
            <ul>{(releaseArtifacts.packages || []).map(item => <li key={item.id}>
              {item.signer_name}{item.signer_title ? ` · ${item.signer_title}` : ''} · prepared {item.prepared_at}
              {item.handed_off_at ? ` · manual handoff ${item.handed_off_at}` : ' · no handoff attestation'}
              {item.accepted_at ? ` · token acceptance ${item.accepted_at} · evidence SHA-256 ${item.acceptance_evidence_sha256}` : ' · no signer acceptance'}
            </li>)}</ul>
            {(releaseArtifacts.packages || []).some(item => !item.handed_off_at) && <form onSubmit={recordHandoff}>
              <label>Package <select required value={handoff.packageId} onChange={e => setHandoff({ ...handoff, packageId: e.target.value })}>
                <option value="">Choose package</option>{releaseArtifacts.packages.filter(item => !item.handed_off_at).map(item => <option key={item.id} value={item.id}>{item.signer_name} · {item.id}</option>)}
              </select></label>
              <label>Handoff channel <select value={handoff.method} onChange={e => setHandoff({ ...handoff, method: e.target.value })}>
                <option value="manual_secure_link">Manually shared secure link</option><option value="in_person">In person</option>
              </select></label>
              <label>Specific handoff attestation <input required minLength="8" maxLength="2000" value={handoff.attestation} onChange={e => setHandoff({ ...handoff, attestation: e.target.value })} /></label>
              <button disabled={busy} type="submit">Record manual handoff</button>
            </form>}
          </>}
          <h3>Audit trail</h3>
          <ul>{history.map(item => <li key={item.id}>{item.created_at}: {item.actor_id} · {item.action} · {item.reason}</li>)}</ul>
        </>}
      </div>
    </div>
    <ProposalReviewChecklist />
  </div>;
}
