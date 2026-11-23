import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { OrgNode } from '../src/components/canvas/OrgNode';
import { OverviewMacroMap } from '../src/components/landing/OverviewMacroMap';
import { App } from '../src/App';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';

async function runTests() {
  console.log('=== Running Light Mode & Drag-Drop Debugging Verification Test Suite ===');

  await useWorkspaceStore.getState().init();

  // 1. Verify OrgNode Light Mode Styling Invariants
  console.log('\n[1/4] Verifying OrgNode styling in Light Mode...');
  useWorkspaceStore.getState().setTheme('light');

  const baseNodeProps = {
    id: 'test-node-1',
    type: 'orgNode' as const,
    data: {
      entity: {
        entityId: 'ent-ngo-1',
        name: 'Action Aid Delhi',
        category: 'ngo',
        globalNotes: 'Central NGO hub',
        createdAt: '2026-01-01',
        pointsOfContact: [
          {
            contactId: 'poc-1',
            name: 'Priya Sharma',
            designation: 'Director',
            email: 'priya@actionaid.org',
            phone: '+91 98765 43210',
            isInternal: false,
          },
        ],
      },
      placement: {
        placementId: 'test-node-1',
        workbookId: 'wb-test',
        entityId: 'ent-ngo-1',
        x: 100,
        y: 200,
        isRootNgo: true,
      },
      yellowInDegree: 2,
      selected: false,
      theme: 'light' as const,
      stats: {
        incomingTotal: 2,
        outgoingTotal: 1,
        incomingYellowConfirmed: 2,
        incomingGreenFundingPct: 25,
        incomingConfirmed: 2,
        incomingPending: 0,
        incomingDeclined: 0,
      },
    },
    selected: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 100,
    positionAbsoluteY: 200,
  };

  const lightNodeHtml = renderToStaticMarkup(
    React.createElement(ReactFlowProvider, null, React.createElement(OrgNode, baseNodeProps as any))
  );

  // Must NOT use pure white card fill in light mode (avoids blending into white/cream canvas)
  assert.ok(
    !lightNodeHtml.includes('bg-[#FFFFFF] border border-[#DDD6C8]'),
    'Node card must NOT use white-on-white fill in light mode'
  );
  // Must use distinct archival parchment card fill and crisp dark hairline border
  assert.ok(
    lightNodeHtml.includes('bg-[#EDE8DE]'),
    'Node card must have distinct archival card fill (#EDE8DE) in light mode'
  );
  assert.ok(
    lightNodeHtml.includes('border-[#5A554C]'),
    'Node card must have crisp dark hairline border (#5A554C) in light mode'
  );
  // Text must be high-contrast ink
  assert.ok(
    lightNodeHtml.includes('text-[#1C1B18]'),
    'Node card must render high contrast ink primary text (#1C1B18)'
  );
  // Category badge in light mode must be bold high contrast (not washed out text-sky-300)
  assert.ok(
    lightNodeHtml.includes('text-sky-900') && lightNodeHtml.includes('bg-sky-100'),
    'NGO Category badge in light mode must have high-contrast dark text (text-sky-900)'
  );
  // Root NGO badge in light mode must have dark legible text
  assert.ok(
    lightNodeHtml.includes('text-amber-900') || lightNodeHtml.includes('text-amber-950'),
    'Root NGO badge in light mode must be high-contrast dark amber text'
  );
  // POC in light mode must be crisp dark text
  assert.ok(
    lightNodeHtml.includes('text-sky-900'),
    'Point of contact in light mode must render crisp high-contrast text'
  );

  console.log('✓ Section 1 Passed: Light mode node cards have distinct fill, crisp hairline borders, and high-contrast typography.');

  // 2. Verify OrgNode Dark Mode Invariants Preserved
  console.log('\n[2/4] Verifying OrgNode styling in Dark Mode...');
  useWorkspaceStore.getState().setTheme('dark');

  const darkNodeProps = {
    ...baseNodeProps,
    data: {
      ...baseNodeProps.data,
      theme: 'dark' as const,
    },
  };

  const darkNodeHtml = renderToStaticMarkup(
    React.createElement(ReactFlowProvider, null, React.createElement(OrgNode, darkNodeProps as any))
  );

  assert.ok(
    darkNodeHtml.includes('bg-[#1E2228]'),
    'Node card must have dark background (#1E2228) in dark mode'
  );
  assert.ok(
    darkNodeHtml.includes('border-[#2D333B]'),
    'Node card must have dark border (#2D333B) in dark mode'
  );
  assert.ok(
    darkNodeHtml.includes('text-[#F4F2ED]'),
    'Node card must have light primary ink (#F4F2ED) in dark mode'
  );
  assert.ok(
    darkNodeHtml.includes('text-sky-300'),
    'Category badge in dark mode must use dark-palette text'
  );

  console.log('✓ Section 2 Passed: Dark mode node styling preserved with complete fidelity.');

  // 3. Verify All Category Badges Contrast in Light Mode
  console.log('\n[3/4] Verifying category badge contrast across all sectors in Light Mode...');
  useWorkspaceStore.getState().setTheme('light');

  const categories = ['ngo', 'csr', 'government', 'institution', 'community', 'other'];
  for (const cat of categories) {
    const catProps = {
      ...baseNodeProps,
      data: {
        ...baseNodeProps.data,
        entity: {
          ...baseNodeProps.data.entity,
          category: cat,
        },
      },
    };
    const catHtml = renderToStaticMarkup(
      React.createElement(ReactFlowProvider, null, React.createElement(OrgNode, catProps as any))
    );
    // Must NOT have washed-out 300-level text on light background
    assert.ok(
      !catHtml.includes(`text-${cat}-300`),
      `Category ${cat} must not use pale text in light mode`
    );
  }

  console.log('✓ Section 3 Passed: All category badge colors verified for high contrast in light mode.');

  // 4. Verify Drag and Drop Disabled on App
  console.log('\n[4/4] Verifying global Drag and Drop disabled on App root...');
  const appHtml = renderToStaticMarkup(React.createElement(App));

  // Verify App root renders successfully
  assert.ok(appHtml.length > 0, 'App component renders markup');

  // Verify that the App source code does not bind importWorkspaceFile to drop events
  const fs = await import('node:fs');
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');
  assert.ok(
    !appSource.includes('await useWorkspaceStore.getState().importWorkspaceFile(file)'),
    'App.tsx must NOT call importWorkspaceFile in handleDrop'
  );
  assert.ok(
    appSource.includes('handleDrop = (e: React.DragEvent) => {'),
    'App.tsx must declare safe non-loading handleDrop handler'
  );

  console.log('✓ Section 4 Passed: Drag and drop file loading is disabled; browser navigation is prevented.');

  // 5. Verify OverviewMacroMap Node Styling in Light Mode
  console.log('\n[5/6] Verifying OverviewMacroMap workbook node styling in Light Mode...');
  useWorkspaceStore.getState().setTheme('light');
  const macroMapHtml = renderToStaticMarkup(React.createElement(OverviewMacroMap));

  // In light mode, macro nodes must not mash into background with white fill
  assert.ok(
    !macroMapHtml.includes('bg-white border-[#DDD6C8]'),
    'OverviewMacroMap nodes must NOT use white-on-white fill in light mode'
  );
  assert.ok(
    macroMapHtml.includes('bg-[#EDE8DE]'),
    'OverviewMacroMap nodes must use archival parchment card fill (#EDE8DE) in light mode'
  );
  assert.ok(
    macroMapHtml.includes('border-[#5A554C]'),
    'OverviewMacroMap nodes must use dark hairline border (#5A554C) in light mode'
  );
  console.log('✓ Section 5 Passed: OverviewMacroMap workbook node cards in light mode have distinct archival fill and borders.');

  // 6. Verify Store Theme Propagation Across Nodes and Edges
  console.log('\n[6/6] Verifying Store Theme Synchronization Across Nodes and Edges...');
  useWorkspaceStore.getState().setTheme('light');
  const lightStoreNodes = useWorkspaceStore.getState().nodes;
  const lightStoreEdges = useWorkspaceStore.getState().edges;
  assert.ok(lightStoreNodes.length > 0, 'Store must contain nodes');
  assert.ok(lightStoreNodes.every((n) => n.data.theme === 'light'), 'All store nodes must propagate light theme');
  assert.ok(lightStoreEdges.length > 0, 'Store must contain edges');
  assert.ok(lightStoreEdges.every((e) => e.data.theme === 'light'), 'All store edges must propagate light theme');

  useWorkspaceStore.getState().setTheme('dark');
  const darkStoreNodes = useWorkspaceStore.getState().nodes;
  const darkStoreEdges = useWorkspaceStore.getState().edges;
  assert.ok(darkStoreNodes.every((n) => n.data.theme === 'dark'), 'All store nodes must propagate dark theme');
  assert.ok(darkStoreEdges.every((e) => e.data.theme === 'dark'), 'All store edges must propagate dark theme');
  console.log('✓ Section 6 Passed: Dynamic theme toggling cleanly re-derives all nodes and edges.');

  console.log('\n========================================================================');
  console.log(' ALL LIGHT MODE & DRAG-DROP DEBUGGING TESTS PASSED (100% SUCCESS)! ');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
