import React from 'react';
import WinRateChart from '../components/customViews/WinRateChart';
import ServiceRevenueHeatmap from '../components/customViews/ServiceRevenueHeatmap';
import SowPdfExporter from '../components/customViews/SowPdfExporter';
import TemplateRulesEditor from '../components/customViews/TemplateRulesEditor';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>Proposal Views</h1>
        <p style={{ color: '#666', margin: 0 }}>
          Custom views for proposal & SOW analytics, document export, and pricing tier configuration.
        </p>
      </div>

      <WinRateChart />
      <ServiceRevenueHeatmap />
      <SowPdfExporter />
      <TemplateRulesEditor />
    </div>
  );
}
