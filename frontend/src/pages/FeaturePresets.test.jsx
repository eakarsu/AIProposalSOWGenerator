import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import CfMultisectionSowGeneration from './CfMultisectionSowGeneration';
import CfProposalTemplateLibrary from './CfProposalTemplateLibrary';
import CfPricingIntelligence from './CfPricingIntelligence';
import CfRiskAllocation from './CfRiskAllocation';
import CfContractClauseRecommender from './CfContractClauseRecommender';
import CfPostsignatureTracking from './CfPostsignatureTracking';
import GapNoAiSowGenerationEndpoint from './GapNoAiSowGenerationEndpoint';
import GapNoAiProposalfrombriefGeneration from './GapNoAiProposalfrombriefGeneration';
import GapNoAiClausetermRecommendation from './GapNoAiClausetermRecommendation';
import GapNoAiPricingIntelligence from './GapNoAiPricingIntelligence';
import GapNoAiRiskAllocationGeneration from './GapNoAiRiskAllocationGeneration';
import GapNoClientProjectOrProposalCrud from './GapNoClientProjectOrProposalCrud';
import GapNoTemplateLibraryOrSectionSnippets from './GapNoTemplateLibraryOrSectionSnippets';
import GapNoPricingratecardManagement from './GapNoPricingratecardManagement';
import GapNoPdfExportRouteCodebaseImportsPdfLib from './GapNoPdfExportRouteCodebaseImportsPdfLib';
import GapNoNotificationsAuditLogOrRbac from './GapNoNotificationsAuditLogOrRbac';
import GapNoEsignatureWorkflow from './GapNoEsignatureWorkflow';
import GapNoChangeorderTracking from './GapNoChangeorderTracking';

const pages = [CfMultisectionSowGeneration, CfProposalTemplateLibrary, CfPricingIntelligence,
  CfRiskAllocation, CfContractClauseRecommender, CfPostsignatureTracking,
  GapNoAiSowGenerationEndpoint, GapNoAiProposalfrombriefGeneration,
  GapNoAiClausetermRecommendation, GapNoAiPricingIntelligence,
  GapNoAiRiskAllocationGeneration, GapNoClientProjectOrProposalCrud,
  GapNoTemplateLibraryOrSectionSnippets, GapNoPricingratecardManagement,
  GapNoPdfExportRouteCodebaseImportsPdfLib, GapNoNotificationsAuditLogOrRbac,
  GapNoEsignatureWorkflow, GapNoChangeorderTracking];

it.each(pages)('%s offers three fill-only domain presets', (Page) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const fetchMock = jest.spyOn(global, 'fetch');
  act(() => root.render(<Page />));
  const presets = [...host.querySelectorAll('button')].filter(item =>
    ['Project scenario', 'Delivery review', 'Executive brief'].includes(item.textContent));
  expect(presets).toHaveLength(3);
  for (const preset of presets) {
    act(() => preset.click());
    expect(host.querySelector('textarea').value.length).toBeGreaterThan(150);
  }
  expect(fetchMock).not.toHaveBeenCalled();
  act(() => root.unmount());
  host.remove();
  fetchMock.mockRestore();
});
