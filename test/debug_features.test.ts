import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { OrgNode } from '../src/components/canvas/OrgNode';
import { MultiplexEdge } from '../src/components/canvas/MultiplexEdge';
import { ActionToolbar } from '../src/components/toolbar/ActionToolbar';
import { ManageSectorsModal } from '../src/components/toolbar/ManageSectorsModal';
import { ConnectBranchModal } from '../src/components/toolbar/ConnectBranchModal';
import { AddNodeModal } from '../src/components/toolbar/AddNodeModal';
import { InspectorDrawer } from '../src/components/inspector/InspectorDrawer';
import { computeParallelBezierCurve } from '../src/engine/parallelEdges';
import { PLACEMENT_IDS, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';

async function runDebugFeaturesVerification() {
  console.log('--- Running QualCount Debug Features Verification Suite ---');

  // Initialize workspace store
  await useWorkspaceStore.getState().init();

  // =========================================================================
  // 1. Double-click Node to Open Description Box
  // =========================================================================
  console.log('\n[1/5] Testing Node Double-Click Selection...');
  useWorkspaceStore.getState().clearSelection();
  assert.strictEqual(useWorkspaceStore.getState().selectedPlacementId, null);

  // Simulate double-click select placement
  useWorkspaceStore.getState().selectPlacement(PLACEMENT_IDS.CITY_MUSEUM);
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementId,
    PLACEMENT_IDS.CITY_MUSEUM,
    'Double-clicking must select placement in workspace store'
  );

  const drawerHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));
  assert.ok(
    drawerHtml.includes('City Museum'),
    'Inspector Drawer must open with selected node details'
  );
  assert.ok(
    drawerHtml.includes('Partner Notes') && drawerHtml.includes('inspector-global-notes'),
    'Inspector Drawer must display partner description/notes box'
  );
  console.log('✓ Section 1 Passed: Node selection opens description box in Inspector Drawer.');

  // =========================================================================
  // 2. Three Colored Dots (Green, Yellow, White) on Hover
  // =========================================================================
  console.log('\n[2/5] Testing Three Colored Connection Handles on OrgNode...');
  const orgNodeProps = {
    id: PLACEMENT_IDS.CITY_MUSEUM,
    type: 'orgNode' as const,
    data: {
      entity: useWorkspaceStore.getState().workspace!.entities['ent-city-museum'],
      placement: useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.CITY_MUSEUM],
      yellowInDegree: 2,
      selected: false,
      stats: {
        incomingTotal: 2,
        outgoingTotal: 1,
        incomingYellowConfirmed: 2,
        incomingGreenFundingPct: 0,
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

  const orgNodeHtml = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(OrgNode, orgNodeProps)
    )
  );

  // Verify all 3 top source handles exist
  assert.ok(orgNodeHtml.includes('source-green'), 'OrgNode must include green source handle');
  assert.ok(orgNodeHtml.includes('source-yellow'), 'OrgNode must include yellow source handle');
  assert.ok(orgNodeHtml.includes('source-white'), 'OrgNode must include white source handle');

  // Verify all 3 bottom target handles exist
  assert.ok(orgNodeHtml.includes('target-green'), 'OrgNode must include green target handle');
  assert.ok(orgNodeHtml.includes('target-yellow'), 'OrgNode must include yellow target handle');
  assert.ok(orgNodeHtml.includes('target-white'), 'OrgNode must include white target handle');
  console.log('✓ Section 2 Passed: OrgNode provides green, yellow, and white handles for top and bottom.');

  // =========================================================================
  // 3. Drag to Connect Toggle & OnConnect Action
  // =========================================================================
  console.log('\n[3/5] Testing Drag to Connect Toggle & onConnect action...');
  assert.strictEqual(useWorkspaceStore.getState().dragConnectEnabled, true, 'Default drag connect must be true');

  // Toggle drag connect off and on
  useWorkspaceStore.getState().toggleDragConnect();
  assert.strictEqual(useWorkspaceStore.getState().dragConnectEnabled, false, 'Toggle must turn drag connect off');
  useWorkspaceStore.getState().setDragConnectEnabled(true);
  assert.strictEqual(useWorkspaceStore.getState().dragConnectEnabled, true, 'setDragConnectEnabled must turn on');

  // Test onConnect creating a green branch
  const preBranchesCount = Object.keys(useWorkspaceStore.getState().workspace!.branches).length;
  await useWorkspaceStore.getState().onConnect({
    source: PLACEMENT_IDS.YOUR_NGO,
    target: PLACEMENT_IDS.COLLECTORATE_OFFICE,
    sourceHandle: 'source-green',
    targetHandle: 'target-green',
  });
  const postBranchesCount = Object.keys(useWorkspaceStore.getState().workspace!.branches).length;
  assert.strictEqual(postBranchesCount, preBranchesCount + 1, 'onConnect must create a new branch');

  // Verify created branch has green type
  const createdBranch = Object.values(useWorkspaceStore.getState().workspace!.branches).find(
    (b) =>
      b.sourcePlacementId === PLACEMENT_IDS.YOUR_NGO &&
      b.targetPlacementId === PLACEMENT_IDS.COLLECTORATE_OFFICE &&
      b.type === 'green'
  );
  assert.ok(createdBranch, 'onConnect with green handle must create green branch');
  assert.strictEqual(createdBranch.status, 'tick', 'Created branch should default to tick confirmed');
  assert.strictEqual(createdBranch.valuePct, 10, 'Green branch should default to 10%');

  // Verify handle precedence: dragging from white handle to green target MUST create WHITE branch
  await useWorkspaceStore.getState().onConnect({
    source: PLACEMENT_IDS.YOUR_NGO,
    target: PLACEMENT_IDS.CITY_MUSEUM,
    sourceHandle: 'source-white',
    targetHandle: 'target-green',
  });
  const whiteBranch = Object.values(useWorkspaceStore.getState().workspace!.branches).find(
    (b) =>
      b.sourcePlacementId === PLACEMENT_IDS.YOUR_NGO &&
      b.targetPlacementId === PLACEMENT_IDS.CITY_MUSEUM &&
      b.type === 'white'
  );
  assert.ok(whiteBranch, 'Dragging from white source handle must create white branch');

  // Verify Flow edges have matching sourceHandle and targetHandle
  const flowEdges = useWorkspaceStore.getState().getFlowEdges();
  const testedEdge = flowEdges.find((e) => e.id === createdBranch.branchId);
  assert.ok(testedEdge, 'Flow edge must exist');
  assert.strictEqual(testedEdge.sourceHandle, 'source-green', 'Green branch edge must attach to source-green');
  assert.strictEqual(testedEdge.targetHandle, 'target-green', 'Green branch edge must attach to target-green');

  // Self-loop prevention check
  const countBeforeSelfLoop = Object.keys(useWorkspaceStore.getState().workspace!.branches).length;
  await useWorkspaceStore.getState().onConnect({
    source: PLACEMENT_IDS.YOUR_NGO,
    target: PLACEMENT_IDS.YOUR_NGO,
    sourceHandle: 'source-yellow',
  });
  assert.strictEqual(
    Object.keys(useWorkspaceStore.getState().workspace!.branches).length,
    countBeforeSelfLoop,
    'Self-loop connection must be silently ignored without creating branch'
  );

  // Verify ActionToolbar renders switch and Add Sector
  const toolbarHtml = renderToStaticMarkup(React.createElement(ActionToolbar));
  assert.ok(toolbarHtml.includes('role="switch"'), 'ActionToolbar must render switch toggle for Drag Connect');
  assert.ok(toolbarHtml.includes('Add Sector'), 'ActionToolbar must render Add Sector button');

  console.log('✓ Section 3 Passed: Drag to connect toggle and onConnect branch creation verified.');

  // =========================================================================
  // 4. Custom Sector Category Management (Add, Edit, Rename, Delete)
  // =========================================================================
  console.log('\n[4/5] Testing Custom Sector Categories Management...');
  const initialSectors = useWorkspaceStore.getState().sectors;
  assert.ok(initialSectors.length >= 6, 'Must have at least 6 default sectors');

  // Add custom sector
  const newSectorId = useWorkspaceStore.getState().addSector('Renewable Energy');
  assert.ok(newSectorId, 'addSector must return sector id');
  assert.ok(
    useWorkspaceStore.getState().sectors.some((s) => s.label === 'Renewable Energy'),
    'New sector must be present in store sectors array'
  );

  // Rename custom sector
  await useWorkspaceStore.getState().updateSector(newSectorId, 'Clean Tech & Climate');
  assert.ok(
    useWorkspaceStore.getState().sectors.some((s) => s.label === 'Clean Tech & Climate'),
    'Sector label must be updated'
  );

  // Add a node with the custom sector
  const customNodeResult = await useWorkspaceStore.getState().addNode(
    'Solar Alliance India',
    newSectorId,
    'Clean energy initiative partner'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.entities[customNodeResult.entityId].category,
    newSectorId,
    'Entity must use custom sector category'
  );

  // Delete custom sector
  await useWorkspaceStore.getState().deleteSector(newSectorId);
  assert.ok(
    !useWorkspaceStore.getState().sectors.some((s) => s.id === newSectorId),
    'Sector must be removed from sectors array'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.entities[customNodeResult.entityId].category,
    'other',
    'Entity using deleted sector must fallback to other'
  );

  // Render ManageSectorsModal markup
  const manageModalHtml = renderToStaticMarkup(
    React.createElement(ManageSectorsModal, { isOpen: true, onClose: () => {} })
  );
  assert.ok(manageModalHtml.includes('Manage Sector Categories'), 'ManageSectorsModal must render title');
  assert.ok(manageModalHtml.includes('Add Sector'), 'ManageSectorsModal must render Add Sector button');

  // Render AddNodeModal markup with custom sectors
  const addModalHtml = renderToStaticMarkup(
    React.createElement(AddNodeModal, { isOpen: true, onClose: () => {} })
  );
  assert.ok(addModalHtml.includes('+ Add / Manage Sectors'), 'AddNodeModal must have + Add / Manage Sectors button');
  console.log('✓ Section 4 Passed: Custom sector categories addition, renaming, deletion, and UI verified.');

  // =========================================================================
  // 5. ConnectBranchModal Sorting & Tick/Cross Button Geometry Under Target Node
  // =========================================================================
  console.log('\n[5/5] Testing ConnectBranchModal Sorting & MultiplexEdge Button Box...');
  const connectModalHtml = renderToStaticMarkup(
    React.createElement(ConnectBranchModal, { isOpen: true, onClose: () => {} })
  );
  assert.ok(connectModalHtml.includes('Sort Organizations:'), 'ConnectBranchModal must render sort controls');
  assert.ok(connectModalHtml.includes('A → Z'), 'Must render A to Z sort option');
  assert.ok(connectModalHtml.includes('Z → A'), 'Must render Z to A sort option');
  assert.ok(connectModalHtml.includes('Category'), 'Must render Category sort option');
  assert.ok(connectModalHtml.includes('Appearance'), 'Must render Appearance sort option');

  // Verify MultiplexEdge button geometry at t = 0.88 is closer to target than t = 0.8
  const geomStandard = computeParallelBezierCurve({ x: 100, y: 500 }, { x: 100, y: 100 }, 0, 1, 36, false, 0.8);
  const geomUnderNode = computeParallelBezierCurve({ x: 100, y: 500 }, { x: 100, y: 100 }, 0, 1, 36, false, 0.88);
  const distToTargetStd = Math.hypot(geomStandard.buttonX - 100, geomStandard.buttonY - 100);
  const distToTargetUnder = Math.hypot(geomUnderNode.buttonX - 100, geomUnderNode.buttonY - 100);
  assert.ok(
    distToTargetUnder < distToTargetStd,
    `Button at t=0.88 (${distToTargetUnder.toFixed(1)}px) must be closer to target node than t=0.8 (${distToTargetStd.toFixed(1)}px)`
  );

  // Render MultiplexEdge and verify tick/cross box markup
  const multiplexEdgeProps = {
    id: createdBranch!.branchId,
    source: PLACEMENT_IDS.YOUR_NGO,
    target: PLACEMENT_IDS.COLLECTORATE_OFFICE,
    sourceX: 100,
    sourceY: 400,
    targetX: 100,
    targetY: 200,
    data: {
      branch: createdBranch!,
      index: 0,
      total: 1,
      isReverse: false,
      selected: false,
    },
  };

  function EdgeRenderer(props: any) {
    const tree = MultiplexEdge(props) as any;
    const rendererChildren = tree.props.children[1].props.children;
    return React.createElement('div', null, rendererChildren);
  }

  const edgeOverlayHtml = renderToStaticMarkup(
    React.createElement(EdgeRenderer, multiplexEdgeProps)
  );
  assert.ok(edgeOverlayHtml.includes('aria-label="Confirm branch"'), 'Must render Confirm (Tick) button');
  assert.ok(edgeOverlayHtml.includes('aria-label="Decline branch"'), 'Must render Decline (Cross) button');
  assert.ok(edgeOverlayHtml.includes('shadow-xl backdrop-blur-md'), 'Button box must have high-visibility styling');
  console.log('✓ Section 5 Passed: ConnectBranchModal sorting and MultiplexEdge button placement verified.');

  // =========================================================================
  // 6. Hold 'B' Multi-Selection Drag & Isolation Mode Marquee Filtering
  // =========================================================================
  console.log('\n[6/6] Testing Hold B Key Multi-Selection & Isolation Marquee Filtering...');
  await useWorkspaceStore.getState().resetToDelhiSeed();

  // Test Hold 'B' multi-selection
  useWorkspaceStore.getState().clearSelection();
  useWorkspaceStore.getState().setIsHoldingB(true);
  useWorkspaceStore.getState().selectPlacement(PLACEMENT_IDS.CITY_MUSEUM);
  useWorkspaceStore.getState().selectPlacement(PLACEMENT_IDS.XYZ_CSR);
  useWorkspaceStore.getState().setIsHoldingB(false);

  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementIds.length,
    2,
    'Holding B and clicking nodes must multi-select both nodes'
  );
  assert.ok(useWorkspaceStore.getState().selectedPlacementIds.includes(PLACEMENT_IDS.CITY_MUSEUM));
  assert.ok(useWorkspaceStore.getState().selectedPlacementIds.includes(PLACEMENT_IDS.XYZ_CSR));

  // Test collective multi-node dragging
  const curMuseum = { ...useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.CITY_MUSEUM] };
  const curXyz = { ...useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.XYZ_CSR] };
  const dX = 30;
  const dY = -20;

  await useWorkspaceStore.getState().onNodeDragStop(PLACEMENT_IDS.CITY_MUSEUM, {
    x: curMuseum.x + dX,
    y: curMuseum.y + dY,
  });

  const movedMuseum = useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.CITY_MUSEUM];
  const movedXyz = useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.XYZ_CSR];
  assert.strictEqual(movedMuseum.x, curMuseum.x + dX);
  assert.strictEqual(movedMuseum.y, curMuseum.y + dY);
  assert.strictEqual(movedXyz.x, curXyz.x + dX, 'Multi-selected XYZ CSR must move by exact same delta X');
  assert.strictEqual(movedXyz.y, curXyz.y + dY, 'Multi-selected XYZ CSR must move by exact same delta Y');

  // Test isolation mode marquee filtering
  useWorkspaceStore.getState().enterIsolationMode('node', PLACEMENT_IDS.YOUR_NGO);
  assert.strictEqual(useWorkspaceStore.getState().isolatedPlacementId, PLACEMENT_IDS.YOUR_NGO);

  const { filterSelectionByIsolation } = await import('../src/engine/isolation');
  const ws = useWorkspaceStore.getState().workspace!;
  const candidatePlacements = [
    PLACEMENT_IDS.YOUR_NGO,
    PLACEMENT_IDS.COLLECTORATE_OFFICE,
    PLACEMENT_IDS.SPORTS_DEV_OFFICE,
  ];
  const filteredMarquee = filterSelectionByIsolation(
    { placementIds: candidatePlacements, branchIds: [] },
    useWorkspaceStore.getState().isolatedElement,
    ws.branches,
    useWorkspaceStore.getState().activeWorkbookId || undefined
  );

  assert.ok(
    filteredMarquee.placementIds.includes(PLACEMENT_IDS.YOUR_NGO),
    'Isolated root node must be selected by marquee'
  );
  assert.ok(
    !filteredMarquee.placementIds.includes(PLACEMENT_IDS.SPORTS_DEV_OFFICE),
    'Dimmed node must be excluded from marquee selection in isolation mode'
  );

  // Store-level integration: setSelection in isolation mode must strip dimmed nodes
  useWorkspaceStore.getState().setSelection(candidatePlacements, []);
  assert.ok(useWorkspaceStore.getState().selectedPlacementIds.includes(PLACEMENT_IDS.YOUR_NGO));
  assert.ok(!useWorkspaceStore.getState().selectedPlacementIds.includes(PLACEMENT_IDS.SPORTS_DEV_OFFICE));

  // Store-level integration: onNodesChange attempting to select dimmed node in isolation must be sanitized
  useWorkspaceStore.getState().onNodesChange([
    { type: 'select', id: PLACEMENT_IDS.SPORTS_DEV_OFFICE, selected: true },
  ]);
  const dimmedNode = useWorkspaceStore.getState().nodes.find((n) => n.id === PLACEMENT_IDS.SPORTS_DEV_OFFICE);
  assert.strictEqual(dimmedNode?.selected, false, 'Dimmed node must not have selected: true in isolation mode');

  useWorkspaceStore.getState().exitIsolationMode();
  assert.strictEqual(useWorkspaceStore.getState().isolatedPlacementId, null);
  console.log('✓ Section 6 Passed: Hold B multi-selection, multi-drag and isolation marquee filtering verified.');

  console.log('\n========================================================================');
  console.log(' ALL DEBUG & NEW FEATURE VERIFICATIONS PASSED (100% SUCCESS)! ');
  console.log('========================================================================\n');
}

runDebugFeaturesVerification().catch((err) => {
  console.error('Debug features verification failed:', err);
  process.exit(1);
});
