import { checkProposalInputs } from './proposalReviewChecks';

test('cites source lines for missing deliverables, vague acceptance, rate drift and absent approved clauses', () => {
  const flags = checkProposalInputs({
    brief: 'Deliver a customer dashboard\nMigrate historical records',
    scope: 'Build the customer dashboard',
    acceptance: 'The experience should be user friendly',
    rateCard: [{ service: 'Design', approvedRate: 125, quotedRate: 150 }],
    approvedClauses: 'IP-1 | Client owns final deliverables',
    draftClauses: 'The vendor retains all ownership',
  });
  expect(flags.map(flag => flag.source)).toEqual([
    'Brief line 2', 'Acceptance line 1', 'Rate card entry 1 · Design', 'Approved clause line 1 · IP-1',
  ]);
});
