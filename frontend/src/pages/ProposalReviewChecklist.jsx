import React, { useState } from 'react';
import { checkProposalInputs } from './proposalReviewChecks';

export default function ProposalReviewChecklist() {
  const [input, setInput] = useState({
    brief: '', scope: '', acceptance: '', rateCard: '[]', approvedClauses: '', draftClauses: '',
  });
  const [flags, setFlags] = useState(null);
  const [error, setError] = useState('');
  function run(event) {
    event.preventDefault();
    setError('');
    try {
      const rateCard = JSON.parse(input.rateCard);
      if (!Array.isArray(rateCard)) throw new Error('Rate card must be a JSON array.');
      setFlags(checkProposalInputs({ ...input, rateCard }));
    } catch (e) { setError(e.message); }
  }
  const fields = [
    ['brief', 'Client brief: one requirement per line'],
    ['scope', 'Draft SOW scope: one deliverable per line'],
    ['acceptance', 'Acceptance criteria: one criterion per line'],
    ['rateCard', 'Rate card comparison: JSON array with service, approvedRate and quotedRate'],
    ['approvedClauses', 'Approved clauses: one clause ID | text per line'],
    ['draftClauses', 'Draft SOW clause text'],
  ];
  return <section style={{ marginTop: 32, padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
    <h2>Brief and rate card review</h2>
    <p>These are local rule-based review prompts, not AI findings or legal approval. The text stays in this browser session and is not submitted to the release API. Confirm every flag against the source documents.</p>
    <form onSubmit={run}>
      {fields.map(([key, label]) => <label key={key} style={{ display: 'block', marginBottom: 12 }}>
        {label}<textarea rows={key === 'brief' || key === 'scope' ? 5 : 3} style={{ display: 'block', width: '100%' }}
          value={input[key]} onChange={e => setInput({ ...input, [key]: e.target.value })} />
      </label>)}
      <button type="submit">Check for review gaps</button>
    </form>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {flags && <div>
      <h3>{flags.length ? `${flags.length} item(s) to review` : 'No rule-based gaps found'}</h3>
      {flags.length === 0 && <p>Human delivery, commercial and legal review is still required.</p>}
      <ul>{flags.map((flag, index) => <li key={index}><strong>{flag.source}:</strong> {flag.message}</li>)}</ul>
    </div>}
  </section>;
}
