import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { MetricsStrip } from '../src/components/metrics/MetricsStrip';
import { OrgNode } from '../src/components/canvas/OrgNode';
import { InspectorDrawer } from '../src/components/inspector/InspectorDrawer';

async function runNeonDashboardAndPocTests() {
  console.log('--- Running Neon Dashboard & Point of Contact Node Verification Suite ---');

  // Initialize store
  await useWorkspaceStore.getState().init();
  const state = useWorkspaceStore.getState();
  assert.ok(state.workspace, 'Workspace must be loaded from seed');

  // =========================================================================
  // 1. Neon-Colored Accent Dashboard Verification
  // =========================================================================
  console.log('[1/4] Verifying Dashboard Neon Accent Logos, Highlights, Bars & Normal Writings...');
  
  // Set theme to dark mode for neon glow verification
  useWorkspaceStore.getState().setTheme('dark');
  const metricsDarkHtml = renderToStaticMarkup(React.createElement(MetricsStrip));

  // Verify Neon Accents on Logos (drop-shadow glowing effects)
  assert.ok(
    metricsDarkHtml.includes('drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]') ||
    metricsDarkHtml.includes('drop-shadow-[0_0_8px'),
    'MetricsStrip must render neon glowing drop-shadows on logos'
  );

  // Verify Neon Accent Boxes and Borders
  assert.ok(
    metricsDarkHtml.includes('border-emerald-500/50') &&
    metricsDarkHtml.includes('shadow-[0_0_14px_rgba(16,185,129,0.2)]'),
    'Funding box must have neon emerald accent border and glow'
  );
  assert.ok(
    metricsDarkHtml.includes('border-cyan-400/50') || metricsDarkHtml.includes('border-cyan-500'),
    'Direct relations box must have neon cyan accent'
  );
  assert.ok(
    metricsDarkHtml.includes('border-yellow-400/50') || metricsDarkHtml.includes('border-yellow-500'),
    'Yellow bridges box must have neon yellow accent'
  );
  assert.ok(
    metricsDarkHtml.includes('border-sky-400/50') || metricsDarkHtml.includes('border-sky-500'),
    'Conversions box must have neon sky accent'
  );
  assert.ok(
    metricsDarkHtml.includes('border-amber-400/50') || metricsDarkHtml.includes('border-amber-500'),
    'Multi-thread box must have neon amber accent'
  );
  assert.ok(
    metricsDarkHtml.includes('border-fuchsia-400/50') || metricsDarkHtml.includes('border-fuchsia-500'),
    'Top amplifier box must have neon fuchsia accent'
  );

  // Verify Neon Glowing Bars and Bar Graphs
  assert.ok(
    metricsDarkHtml.includes('shadow-[0_0_10px_rgba(52,211,153,0.9)]') ||
    metricsDarkHtml.includes('shadow-[0_0_10px'),
    'Progress bars must render with neon glowing shadow effects'
  );
  assert.ok(
    metricsDarkHtml.includes('Confirmation Rate') || metricsDarkHtml.includes('bg-cyan-400'),
    'Direct relations must include neon confirmation rate bar graph'
  );
  assert.ok(
    metricsDarkHtml.includes('Conversion Rate') || metricsDarkHtml.includes('bg-sky-400'),
    'Conversions must include neon conversion rate bar graph'
  );

  // Verify Normal Writings (Text Readability)
  assert.ok(metricsDarkHtml.includes('Funding Secured'), 'Must contain clean readable "Funding Secured" title');
  assert.ok(metricsDarkHtml.includes('Direct Relations'), 'Must contain clean readable "Direct Relations" title');
  assert.ok(metricsDarkHtml.includes('Yellow Bridges'), 'Must contain clean readable "Yellow Bridges" title');
  assert.ok(metricsDarkHtml.includes('active bridges'), 'Must contain clean readable "active bridges" label');
  assert.ok(metricsDarkHtml.includes('Conversions'), 'Must contain clean readable "Conversions" title');
  assert.ok(metricsDarkHtml.includes('Multi-Thread'), 'Must contain clean readable "Multi-Thread" title');
  assert.ok(metricsDarkHtml.includes('Top Amplifier'), 'Must contain clean readable "Top Amplifier" title');
  assert.ok(metricsDarkHtml.includes('Concentration Risk'), 'Must contain clean readable "Concentration Risk" title');

  // Verify Light Mode Neon Accents and High-Contrast Text
  useWorkspaceStore.getState().setTheme('light');
  const metricsLightHtml = renderToStaticMarkup(React.createElement(MetricsStrip));
  assert.ok(metricsLightHtml.includes('text-black'), 'Light mode must maintain normal text-black writings');
  assert.ok(metricsLightHtml.includes('border-emerald-500'), 'Light mode must maintain neon emerald border');
  console.log('✓ Section 1 Passed: Neon accent boxes, logos, highlights, bars and normal text verified.');

  // =========================================================================
  // 2. Point of Contact on OrgNode (No Large Modal Box Over Nodes)
  // =========================================================================
  console.log('\n[2/4] Verifying OrgNode Point of Contact Presentation...');
  
  // Use Agrocell CSR node which has points of contact in the seed
  const agroPlacement = Object.values(state.workspace.placements).find(
    (p) => state.workspace!.entities[p.entityId]?.name === 'Agrocell CSR'
  );
  assert.ok(agroPlacement, 'Agrocell CSR placement must exist in seed');
  const agroEntity = state.workspace.entities[agroPlacement.entityId];
  assert.ok(agroEntity.pointsOfContact && agroEntity.pointsOfContact.length > 0, 'Agrocell must have contacts');
  const primaryContact = agroEntity.pointsOfContact.find((c) => !c.isInternal) || agroEntity.pointsOfContact[0];

  const orgNodeProps = {
    id: agroPlacement.placementId,
    type: 'orgNode' as const,
    data: {
      entity: agroEntity,
      placement: agroPlacement,
      stats: {
        incomingGreenFundingPct: 20,
        incomingConfirmed: 2,
        incomingPending: 0,
        outgoingTotal: 1,
      },
      yellowInDegree: 0,
      isDimmed: false,
      isIsolated: false,
    },
    selected: false,
    zIndex: 1,
    isConnectable: true,
    positionAbsoluteX: 100,
    positionAbsoluteY: 200,
    dragging: false,
  };

  const orgNodeHtml = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(OrgNode, orgNodeProps as any)
    )
  );

  // 1. Must NOT render PointsOfContactModal or any rectangular popover box inside OrgNode markup
  assert.strictEqual(
    orgNodeHtml.includes('role="dialog"'),
    false,
    'OrgNode must NOT render modal dialog over the node'
  );
  assert.strictEqual(
    orgNodeHtml.includes('aria-labelledby="poc-modal-title"'),
    false,
    'OrgNode must NOT render PointsOfContactModal'
  );
  assert.strictEqual(
    orgNodeHtml.includes('absolute top-8'),
    false,
    'OrgNode must NOT render floating popover box over node'
  );
  assert.strictEqual(
    orgNodeHtml.includes('w-60'),
    false,
    'OrgNode must NOT render wide rectangular popover box over node'
  );

  // 2. Must render contact who is going to get contacted (primaryContact.name) on the node
  assert.ok(
    orgNodeHtml.includes(primaryContact.name),
    `OrgNode must render the contact who is going to get contacted (${primaryContact.name})`
  );
  if (primaryContact.designation) {
    assert.ok(
      orgNodeHtml.includes(primaryContact.designation),
      `OrgNode must display contact designation (${primaryContact.designation})`
    );
  }

  // 3. Contact person button must have title mentioning the contact
  assert.ok(
    orgNodeHtml.includes(`Point of Contact: ${primaryContact.name}`),
    'Point of contact button must have descriptive title attribute'
  );

  // 4. Hover metrics tooltip must also include the contact
  assert.ok(
    orgNodeHtml.includes('Contact:'),
    'Hover metrics tooltip must display Contact row'
  );

  // 5. Selected state displays contact clearly
  const selectedNodeProps = {
    ...orgNodeProps,
    selected: true,
  };
  const selectedNodeHtml = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(OrgNode, selectedNodeProps as any)
    )
  );
  assert.ok(
    selectedNodeHtml.includes(primaryContact.name),
    'Selected node must display contact person clearly'
  );
  assert.strictEqual(
    selectedNodeHtml.includes('absolute top-8'),
    false,
    'Selected node must NOT open any rectangular box over the node'
  );

  console.log('✓ Section 2 Passed: OrgNode displays contact name directly and does not render modal box over node.');

  // =========================================================================
  // 3. InspectorDrawer Side Panel Integration
  // =========================================================================
  console.log('\n[3/4] Verifying InspectorDrawer Side Panel Point of Contact Management...');
  
  // Select Agrocell placement in store
  useWorkspaceStore.getState().selectPlacement(agroPlacement.placementId);
  const drawerHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));

  // Side panel must display points of contact list
  assert.ok(
    drawerHtml.includes(primaryContact.name),
    'InspectorDrawer must list point of contact name'
  );
  assert.ok(
    drawerHtml.includes('Manage Points of Contact'),
    'InspectorDrawer must provide Manage Points of Contact action'
  );
  assert.ok(
    drawerHtml.includes('+ Manage / Edit'),
    'InspectorDrawer must provide Manage / Edit link'
  );

  console.log('✓ Section 3 Passed: Side panel clearly displays contacts and management controls.');

  // =========================================================================
  // 4. Edge Cases: Node with Zero Contacts
  // =========================================================================
  console.log('\n[4/4] Verifying Edge Cases: Node with Zero Contacts...');
  
  const emptyEntity = {
    ...agroEntity,
    entityId: 'ent-empty-test',
    name: 'Test Org Without Contacts',
    pointsOfContact: [],
  };
  const emptyNodeProps = {
    ...orgNodeProps,
    data: {
      ...orgNodeProps.data,
      entity: emptyEntity,
    },
  };

  const emptyNodeHtml = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(OrgNode, emptyNodeProps as any)
    )
  );

  assert.ok(
    emptyNodeHtml.includes('Test Org Without Contacts'),
    'Node renders without error when pointsOfContact is empty'
  );
  assert.strictEqual(
    emptyNodeHtml.includes('role="dialog"'),
    false,
    'Empty node also does not render modal dialog'
  );

  console.log('✓ Section 4 Passed: Zero-contact edge cases handled safely.');

  console.log('\n========================================================================');
  console.log(' ALL NEON DASHBOARD & POINT OF CONTACT REQUIREMENTS VERIFIED (100%!)');
  console.log('========================================================================\n');
}

runNeonDashboardAndPocTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
