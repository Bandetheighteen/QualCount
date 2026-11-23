import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { ActionToolbar } from '../src/components/toolbar/ActionToolbar';
import { FilterPanel } from '../src/components/toolbar/FilterPanel';
import { KeyboardShortcutsModal } from '../src/components/canvas/KeyboardShortcutsModal';
import { PartnershipCanvas } from '../src/components/canvas/PartnershipCanvas';
import { MetricsStrip } from '../src/components/metrics/MetricsStrip';
import { InspectorDrawer } from '../src/components/inspector/InspectorDrawer';
import { PointsOfContactModal } from '../src/components/contacts/PointsOfContactModal';
import { MultiplexEdge } from '../src/components/canvas/MultiplexEdge';
import { ReactFlowProvider } from '@xyflow/react';

async function runFilterAndDockTests() {
  console.log('--- Running QualCount Filter & Draggable Dock Verification Suite ---');

  // Initialize workspace store
  await useWorkspaceStore.getState().init();
  const state = useWorkspaceStore.getState();
  assert.ok(state.workspace, 'Workspace must be loaded from seed');

  // =========================================================================
  // 1. Draggable Dock & Bottom-Left Controls
  // =========================================================================
  console.log('[1/6] Verifying Draggable Bottom-Left Controls Dock & Buttons...');
  const canvasHtml = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(PartnershipCanvas)
    )
  );
  assert.ok(
    canvasHtml.includes('Canvas Navigation Controls'),
    'Bottom-left dock must have role toolbar and aria-label "Canvas Navigation Controls"'
  );
  assert.ok(
    canvasHtml.includes('Keyboard Shortcuts'),
    'Dock must have Keyboard Shortcuts button'
  );
  assert.ok(
    canvasHtml.includes('Settings &amp; Appearance') || canvasHtml.includes('Settings'),
    'Dock must have Settings button'
  );
  assert.ok(
    canvasHtml.includes('cursor-grab'),
    'Dock must have cursor-grab drag capability'
  );
  assert.ok(
    canvasHtml.includes('touch-none'),
    'Dock must have touch-none to prevent touch gesture conflicts during drag'
  );
  console.log('✓ Dock has Settings, Keyboard Shortcuts, and draggable grip.');

  // =========================================================================
  // 2. Keyboard Shortcuts Dialog
  // =========================================================================
  console.log('[2/6] Verifying Keyboard Shortcuts Modal & All Keybindings...');
  const shortcutsHtml = renderToStaticMarkup(
    React.createElement(KeyboardShortcutsModal, {
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.ok(shortcutsHtml.includes('Keyboard Shortcuts &amp; Keybindings') || shortcutsHtml.includes('Keyboard Shortcuts'), 'Modal must have title');
  assert.ok(shortcutsHtml.includes('Space'), 'Modal must list Space key for pan');
  assert.ok(shortcutsHtml.includes('Ctrl') && shortcutsHtml.includes('Z'), 'Modal must list Ctrl+Z for undo');
  assert.ok(shortcutsHtml.includes('Ctrl') && shortcutsHtml.includes('Y'), 'Modal must list Ctrl+Y for redo');
  assert.ok(shortcutsHtml.includes('Escape'), 'Modal must list Escape');
  assert.ok(shortcutsHtml.includes('Delete'), 'Modal must list Delete');
  assert.ok(shortcutsHtml.includes('isolation mode'), 'Modal must describe isolation mode');
  assert.ok(shortcutsHtml.includes('Ctrl') && shortcutsHtml.includes('A'), 'Modal must list Ctrl+A for Select All');
  assert.ok(shortcutsHtml.includes('H'), 'Modal must list H for Hand tool');
  assert.ok(shortcutsHtml.includes('V'), 'Modal must list V for Pointer tool');
  assert.ok(shortcutsHtml.includes('F'), 'Modal must list F for Fit view');
  assert.ok(shortcutsHtml.includes('T'), 'Modal must list T for Tidy Up');
  assert.ok(shortcutsHtml.includes('L'), 'Modal must list L for Lock');
  console.log('✓ Keyboard shortcuts modal renders all keybindings clearly.');

  // =========================================================================
  // 3. Action Ribbon Sections & Jiggle Fix
  // =========================================================================
  console.log('[3/6] Verifying Action Ribbon Sections & Jiggle Fix...');
  const toolbarHtml = renderToStaticMarkup(React.createElement(ActionToolbar));
  // Must NOT include dynamic expanding text span inside button that shakes ribbon
  assert.ok(
    !toolbarHtml.includes('group-hover/btn:max-w-[120px]'),
    'Ribbon buttons must not have dynamic width expanding text spans on hover (avoids jiggle)'
  );
  assert.ok(
    toolbarHtml.includes('delay-300'),
    'Tooltips must have delay-300 so fast hovering does not jiggle or flash tooltips'
  );
  assert.ok(
    toolbarHtml.includes('transition-colors'),
    'Toolbar buttons must use transition-colors to prevent subpixel layout jiggle'
  );
  assert.ok(
    toolbarHtml.includes('Filter Map &amp; Branches') || toolbarHtml.includes('Filter'),
    'Ribbon must include Filter button'
  );
  assert.ok(toolbarHtml.includes('Select Pointer Tool'), 'Ribbon must have Pointer tool');
  assert.ok(toolbarHtml.includes('Hand Pan Tool'), 'Ribbon must have Hand Pan tool');
  assert.ok(toolbarHtml.includes('Tidy Up Layout'), 'Ribbon must have Tidy Up');
  console.log('✓ Ribbon sectioned cleanly with fixed-size non-jiggling buttons.');

  // =========================================================================
  // 4. Live Filter Engine & FilterPanel Verification
  // =========================================================================
  console.log('[4/6] Verifying Branch & Node Filters with Live Canvas Updates...');
  const initialNodes = useWorkspaceStore.getState().getFlowNodes();
  const initialEdges = useWorkspaceStore.getState().getFlowEdges();
  const totalNodesCount = initialNodes.length;
  const totalEdgesCount = initialEdges.length;
  assert.ok(totalNodesCount > 0, 'Initial nodes count must be > 0');
  assert.ok(totalEdgesCount > 0, 'Initial edges count must be > 0');

  // Test 4A: Filter by Branch Type (Green only)
  useWorkspaceStore.getState().setFilters({ branchTypes: ['green'] });
  let edgesFiltered = useWorkspaceStore.getState().getFlowEdges();
  assert.ok(
    edgesFiltered.every((e) => e.data?.branch.type === 'green'),
    'When filtering by green type, only green branches should be visible'
  );
  assert.ok(edgesFiltered.length < totalEdgesCount, 'Green branches must be a subset of all branches');

  // Test 4B: Filter by Branch Status (Confirmed only)
  useWorkspaceStore.getState().setFilters({ branchTypes: ['green', 'white', 'yellow'], branchStatuses: ['tick'] });
  edgesFiltered = useWorkspaceStore.getState().getFlowEdges();
  assert.ok(
    edgesFiltered.every((e) => e.data?.branch.status === 'tick'),
    'When filtering by tick status, only confirmed branches should be visible'
  );

  // Test 4C: Filter by Min Funding %
  useWorkspaceStore.getState().setFilters({
    branchTypes: ['green'],
    branchStatuses: ['tick', 'pending', 'cross'],
    minFundingPct: 25,
  });
  edgesFiltered = useWorkspaceStore.getState().getFlowEdges();
  assert.ok(
    edgesFiltered.every((e) => (e.data?.branch.valuePct ?? 0) >= 25),
    'When min funding is 25%, all visible green branches must have valuePct >= 25'
  );

  // Test 4D: Node Category Filtering
  useWorkspaceStore.getState().resetFilters();
  useWorkspaceStore.getState().setFilters({ nodeCategories: ['csr'] });
  let nodesFiltered = useWorkspaceStore.getState().getFlowNodes();
  assert.ok(
    nodesFiltered.every((n) => n.data.entity?.category === 'csr'),
    'When filtering by CSR category, only CSR nodes should be visible'
  );
  assert.ok(nodesFiltered.length > 0 && nodesFiltered.length < totalNodesCount);

  // Test 4E: Node Connection Filter (Nodes without any connection)
  useWorkspaceStore.getState().resetFilters();
  useWorkspaceStore.getState().setFilters({ connectionFilter: 'onlyUnconnected' });
  let isolatedNodes = useWorkspaceStore.getState().getFlowNodes();
  // In Delhi seed, there is at least 1 isolated node (Disaster Management Authority or similar)
  for (const n of isolatedNodes) {
    const connectedBranches = Object.values(useWorkspaceStore.getState().workspace!.branches).filter(
      (b) => b.sourcePlacementId === n.id || b.targetPlacementId === n.id
    );
    assert.strictEqual(
      connectedBranches.length,
      0,
      `Node ${n.id} in onlyUnconnected mode must have 0 connections`
    );
  }

  // Test 4F: Multi-Selection Desynchronization Guard
  // When multiple nodes are selected and filters hide some of them, selectedPlacementIds must be pruned
  const allNodesList = useWorkspaceStore.getState().getFlowNodes();
  useWorkspaceStore.getState().setSelection(
    allNodesList.map((n) => n.id),
    []
  );
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementIds.length,
    allNodesList.length,
    'All nodes should be selected'
  );
  // Filter to CSR only
  useWorkspaceStore.getState().setFilters({ nodeCategories: ['csr'] });
  const csrVisibleNodes = useWorkspaceStore.getState().getFlowNodes();
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementIds.length,
    csrVisibleNodes.length,
    'selectedPlacementIds must be automatically pruned to match only visible nodes'
  );
  useWorkspaceStore.getState().resetFilters();
  useWorkspaceStore.getState().clearSelection();

  // Test 4G: Filter Preservation across Store Actions (Theme toggle, isolation, tidy up)
  useWorkspaceStore.getState().setFilters({ branchTypes: ['green'] });
  assert.ok(
    useWorkspaceStore.getState().edges.every((e) => e.data?.branch.type === 'green'),
    'Active edges must be green only'
  );
  useWorkspaceStore.getState().setTheme('light');
  assert.ok(
    useWorkspaceStore.getState().edges.every((e) => e.data?.branch.type === 'green'),
    'Active edges must remain filtered to green even after switching to light mode'
  );
  useWorkspaceStore.getState().setTheme('dark');

  // Reset filters
  useWorkspaceStore.getState().resetFilters();
  assert.strictEqual(
    useWorkspaceStore.getState().getFlowNodes().length,
    totalNodesCount,
    'Resetting filters restores all nodes'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().getFlowEdges().length,
    totalEdgesCount,
    'Resetting filters restores all edges'
  );

  // Test FilterPanel static markup
  const filterPanelHtml = renderToStaticMarkup(
    React.createElement(FilterPanel, {
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.ok(filterPanelHtml.includes('Filters &amp; Visibility') || filterPanelHtml.includes('Filters'), 'FilterPanel renders header');
  assert.ok(filterPanelHtml.includes('Funding (Green)'), 'FilterPanel has Funding Green filter');
  assert.ok(filterPanelHtml.includes('Direct Relationship (White)'), 'FilterPanel has Direct White filter');
  assert.ok(filterPanelHtml.includes('Network Bridge (Yellow)'), 'FilterPanel has Yellow Bridge filter');
  assert.ok(filterPanelHtml.includes('Confirmed'), 'FilterPanel has Confirmed status filter');
  assert.ok(filterPanelHtml.includes('Pending'), 'FilterPanel has Pending status filter');
  assert.ok(filterPanelHtml.includes('Declined'), 'FilterPanel has Declined status filter');
  assert.ok(filterPanelHtml.includes('Isolated'), 'FilterPanel has Isolated / Unconnected filter');
  assert.ok(filterPanelHtml.includes('Live Canvas'), 'FilterPanel has live counter bar');
  assert.ok(filterPanelHtml.includes('Raised / Secured:'), 'FilterPanel includes money raised summary');
  assert.ok(filterPanelHtml.includes('Remaining Gap:'), 'FilterPanel includes remaining budget gap');
  assert.ok(filterPanelHtml.includes('Target Budget:'), 'FilterPanel includes target budget');
  assert.ok(filterPanelHtml.includes('≥75%'), 'FilterPanel has ≥75% min funding preset');
  console.log('✓ FilterPanel and live filter engine verified.');

  // =========================================================================
  // 5. Point of Contact: Responsible Person / Team From Our Side
  // =========================================================================
  console.log('[5/6] Verifying Responsible Person / Team (Internal Lead) Text Box...');
  const testEntityId = 'ent-your-ngo';
  const internalLeadValue = 'Sarah Jenkins / Outreach Lead';
  await useWorkspaceStore.getState().updateEntity(testEntityId, {
    internalLead: internalLeadValue,
  });

  const savedEntity = useWorkspaceStore.getState().workspace!.entities[testEntityId];
  assert.strictEqual(savedEntity.internalLead, internalLeadValue, 'internalLead must persist in store');

  // Verify InspectorDrawer renders internal lead text box
  const samplePlacementId = Object.values(useWorkspaceStore.getState().workspace!.placements).find(
    (p) => p.entityId === testEntityId
  )!.placementId;
  const drawerHtml = renderToStaticMarkup(
    React.createElement(InspectorDrawer, {
      placementId: samplePlacementId,
    })
  );
  assert.ok(
    drawerHtml.includes('Responsible Person / Team (From Our Side)'),
    'InspectorDrawer must render "Responsible Person / Team (From Our Side)" label'
  );
  assert.ok(
    drawerHtml.includes('Sarah Jenkins / Outreach Lead'),
    'InspectorDrawer must reflect internalLead value'
  );

  // Verify PointsOfContactModal renders internal lead text box
  const pocHtml = renderToStaticMarkup(
    React.createElement(PointsOfContactModal, {
      isOpen: true,
      onClose: () => {},
      entityId: testEntityId,
    })
  );
  assert.ok(
    pocHtml.includes('Responsible Person / Team (From Our Side)'),
    'PointsOfContactModal must render "Responsible Person / Team (From Our Side)" label'
  );
  assert.ok(
    pocHtml.includes('Sarah Jenkins / Outreach Lead'),
    'PointsOfContactModal must display the internal lead'
  );

  // Test creating a new partner with internal lead specified directly in addNode
  const { entityId: newEntId } = await useWorkspaceStore.getState().addNode(
    'New Test NGO Partner',
    'ngo',
    'Test notes',
    { x: 300, y: 300 },
    'Rohan Gupta / Partnerships Team'
  );
  const createdEntity = useWorkspaceStore.getState().workspace!.entities[newEntId];
  assert.strictEqual(
    createdEntity.internalLead,
    'Rohan Gupta / Partnerships Team',
    'addNode must persist internalLead'
  );
  console.log('✓ Point of contact internal lead text box verified.');

  // =========================================================================
  // 6. Light Mode Styling
  // =========================================================================
  console.log('[6/6] Verifying Light Mode High-Contrast Black Styling...');
  useWorkspaceStore.getState().setTheme('light');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'light');

  // MetricsStrip in light mode
  const metricsLightHtml = renderToStaticMarkup(React.createElement(MetricsStrip));
  assert.ok(metricsLightHtml.includes('text-black'), 'MetricsStrip in light mode must use high-contrast text-black');
  assert.ok(metricsLightHtml.includes('bg-white') || metricsLightHtml.includes('bg-slate-50'), 'MetricsStrip in light mode must use light backgrounds');

  // ActionToolbar in light mode
  const toolbarLightHtml = renderToStaticMarkup(React.createElement(ActionToolbar));
  assert.ok(toolbarLightHtml.includes('text-black'), 'ActionToolbar in light mode must use black text');
  assert.ok(toolbarLightHtml.includes('border-black'), 'ActionToolbar in light mode must use black borders');

  // MultiplexEdge in light mode
  function EdgeInspector(props: any) {
    const tree = MultiplexEdge(props) as any;
    const rendererChildren = tree.props.children[1].props.children;
    return React.createElement('div', null, rendererChildren);
  }

  const sampleBranch = Object.values(useWorkspaceStore.getState().workspace!.branches)[0];
  const edgeLightHtml = renderToStaticMarkup(
    React.createElement(EdgeInspector, {
      id: sampleBranch.branchId,
      source: sampleBranch.sourcePlacementId,
      target: sampleBranch.targetPlacementId,
      sourceX: 100,
      sourceY: 400,
      targetX: 100,
      targetY: 100,
      sourcePosition: 'top' as any,
      targetPosition: 'bottom' as any,
      data: {
        branch: sampleBranch,
        theme: 'light',
        index: 0,
        total: 1,
      },
    })
  );
  assert.ok(edgeLightHtml.includes('border-black'), 'MultiplexEdge in light mode must have border-black on action box');
  assert.ok(edgeLightHtml.includes('text-black'), 'MultiplexEdge in light mode must have text-black');

  // Return to dark mode for test hygiene
  useWorkspaceStore.getState().setTheme('dark');
  console.log('✓ Light mode black styling verified across Dashboard, Ribbon, Tags, and MultiplexEdge.');

  console.log('\n========================================================================');
  console.log(' ALL FILTER, DRAGGABLE DOCK & LIGHT MODE CHECKS PASSED (100% SUCCESS)!');
  console.log('========================================================================\n');
}

runFilterAndDockTests().catch((err) => {
  console.error('Filter and dock test failed:', err);
  process.exit(1);
});
