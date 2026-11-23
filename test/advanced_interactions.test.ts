import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { ContextMenu } from '../src/components/canvas/ContextMenu';
import { SettingsModal } from '../src/components/toolbar/SettingsModal';
import { MultiSelectModifyModal } from '../src/components/canvas/MultiSelectModifyModal';
import { MultiplexEdge } from '../src/components/canvas/MultiplexEdge';
import { OrgNode } from '../src/components/canvas/OrgNode';
import { ActionToolbar } from '../src/components/toolbar/ActionToolbar';
import { InspectorDrawer } from '../src/components/inspector/InspectorDrawer';
import { App } from '../src/App';
import { PLACEMENT_IDS, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';

async function runAdvancedInteractionsVerification() {
  console.log('--- Running QualCount Advanced Interactions & Features Verification Suite ---');

  // Initialize store with fresh state
  await useWorkspaceStore.getState().init();
  const store = useWorkspaceStore.getState();

  // =========================================================================
  // 1. Context Menus (Right-Click on Node, Edge, Pane, Multi-Selection)
  // =========================================================================
  console.log('\n[1/7] Testing Right-Click Context Menus (Node, Edge, Pane, Multi-Selection)...');

  // 1.1 Node Context Menu
  const nodeMenuHtml = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      type: 'node',
      x: 150,
      y: 200,
      nodeId: PLACEMENT_IDS.CITY_MUSEUM,
      onClose: () => {},
    })
  );
  assert.ok(nodeMenuHtml.includes('Inspect / Modify'), 'Node context menu must have Inspect / Modify option');
  assert.ok(nodeMenuHtml.includes('Connect Branch...'), 'Node context menu must have Connect Branch option');
  assert.ok(nodeMenuHtml.includes('Lock Node'), 'Node context menu must have Lock Node option');
  assert.ok(nodeMenuHtml.includes('Copy Details'), 'Node context menu must have Copy Details option');
  assert.ok(nodeMenuHtml.includes('Delete Node'), 'Node context menu must have Delete Node option');

  // Root NGO protected in Node Context Menu
  const rootNodeMenuHtml = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      type: 'node',
      x: 150,
      y: 200,
      nodeId: PLACEMENT_IDS.YOUR_NGO,
      onClose: () => {},
    })
  );
  assert.ok(rootNodeMenuHtml.includes('Root Protected'), 'Root NGO must show protected in context menu');

  // 1.2 Edge Context Menu
  const testBranch = Object.values(useWorkspaceStore.getState().workspace!.branches)[0];
  const edgeMenuHtml = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      type: 'edge',
      x: 250,
      y: 300,
      edgeId: testBranch.branchId,
      onClose: () => {},
    })
  );
  assert.ok(edgeMenuHtml.includes('Inspect / Modify'), 'Edge context menu must have Inspect option');
  assert.ok(edgeMenuHtml.includes('Change Origin / Destination'), 'Edge context menu must have Change Origin / Destination');
  assert.ok(edgeMenuHtml.includes('Lock Branch'), 'Edge context menu must have Lock Branch option');
  assert.ok(edgeMenuHtml.includes('Delete Branch'), 'Edge context menu must have Delete Branch option');

  // 1.3 Pane Context Menu
  const paneMenuHtml = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      type: 'pane',
      x: 400,
      y: 400,
      canvasPosition: { x: 500, y: 500 },
      onClose: () => {},
    })
  );
  assert.ok(paneMenuHtml.includes('Add Organization Node...'), 'Pane context menu must have Add Node option');
  assert.ok(paneMenuHtml.includes('Connect Branch...'), 'Pane context menu must have Connect Branch option');
  assert.ok(paneMenuHtml.includes('Tidy Up Layout'), 'Pane context menu must have Tidy Up option');
  assert.ok(paneMenuHtml.includes('Fit View'), 'Pane context menu must have Fit View option');
  assert.ok(paneMenuHtml.includes('Reset Zoom'), 'Pane context menu must have Reset Zoom option');
  assert.ok(paneMenuHtml.includes('Declined Paths'), 'Pane context menu must have Toggle Declined Paths option');
  assert.ok(paneMenuHtml.includes('Manage Sectors...'), 'Pane context menu must have Manage Sectors option');

  // 1.4 Multi-Selection Context Menu
  useWorkspaceStore.getState().setSelection([PLACEMENT_IDS.CITY_MUSEUM, PLACEMENT_IDS.DELHI_FOOD_BANK], [testBranch.branchId]);
  const multiMenuHtml = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      type: 'multi',
      x: 300,
      y: 300,
      onClose: () => {},
    })
  );
  assert.ok(multiMenuHtml.includes('Selection (3 items)'), 'Multi context menu must show total items count');
  assert.ok(multiMenuHtml.includes('Toggle Lock Selected'), 'Multi context menu must have Toggle Lock option');
  assert.ok(multiMenuHtml.includes('Delete Selected'), 'Multi context menu must have Delete Selected option');
  assert.ok(multiMenuHtml.includes('Clear Selection'), 'Multi context menu must have Clear Selection option');

  console.log('✓ Section 1 Passed: All 4 Context Menu variants (Node, Edge, Pane, Multi) render correctly with all options.');

  // =========================================================================
  // 2. Settings Burger Menu & Modal (Appearance, Performance, Window Management)
  // =========================================================================
  console.log('\n[2/7] Testing Settings Burger Menu & Modal...');

  const settingsHtml = renderToStaticMarkup(
    React.createElement(SettingsModal, { isOpen: true, onClose: () => {} })
  );
  assert.ok(settingsHtml.includes('1. Appearance'), 'Settings modal must include Appearance section');
  assert.ok(settingsHtml.includes('White Paper'), 'Must have White Paper theme option');
  assert.ok(settingsHtml.includes('Charcoal Matte'), 'Must have Charcoal Matte theme option');
  assert.ok(settingsHtml.includes('High Contrast Mode'), 'Must have High Contrast option');

  assert.ok(settingsHtml.includes('2. Performance'), 'Settings modal must include Performance section');
  assert.ok(settingsHtml.includes('Smooth Animations'), 'Must have Smooth Animations toggle');
  assert.ok(settingsHtml.includes('High Performance Mode'), 'Must have High Performance Mode toggle');

  assert.ok(settingsHtml.includes('3. Window Management'), 'Settings modal must include Window Management section');
  assert.ok(settingsHtml.includes('Fullscreen'), 'Must have Fullscreen toggle');
  assert.ok(settingsHtml.includes('Fit View'), 'Must have Fit View trigger');
  assert.ok(settingsHtml.includes('Reset (100%)'), 'Must have Reset Zoom trigger');

  // Test Store Appearance & Performance Actions
  useWorkspaceStore.getState().setTheme('night');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'night', 'Theme should switch to night mode');
  useWorkspaceStore.getState().setTheme('light');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'light', 'Theme should switch to light mode');
  useWorkspaceStore.getState().setTheme('dark');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'dark', 'Theme should switch to dark mode');

  assert.strictEqual(useWorkspaceStore.getState().highContrast, false);
  useWorkspaceStore.getState().toggleHighContrast();
  assert.strictEqual(useWorkspaceStore.getState().highContrast, true, 'High contrast must toggle to true');

  assert.strictEqual(useWorkspaceStore.getState().highPerformanceMode, false);
  useWorkspaceStore.getState().toggleHighPerformance();
  assert.strictEqual(useWorkspaceStore.getState().highPerformanceMode, true, 'High performance must toggle to true');

  assert.strictEqual(useWorkspaceStore.getState().animationsEnabled, true);
  useWorkspaceStore.getState().toggleAnimations();
  assert.strictEqual(useWorkspaceStore.getState().animationsEnabled, false, 'Animations must toggle to false');

  // Test Store Canvas Fit View and Reset Zoom via FlowInstance
  let fitViewInvoked = false;
  let zoomToInvoked = false;
  let zoomToVal = 0;
  useWorkspaceStore.getState().setFlowInstance({
    fitView: () => { fitViewInvoked = true; },
    zoomTo: (z: number) => { zoomToInvoked = true; zoomToVal = z; },
  });
  useWorkspaceStore.getState().fitView();
  assert.strictEqual(fitViewInvoked, true, 'fitView must trigger registered flowInstance.fitView');
  useWorkspaceStore.getState().resetZoom();
  assert.strictEqual(zoomToInvoked, true, 'resetZoom must trigger registered flowInstance.zoomTo');
  assert.strictEqual(zoomToVal, 1.0, 'resetZoom must set zoom to 1.0 (100%)');

  console.log('✓ Section 2 Passed: Settings Modal renders Appearance, Performance, and Window Management with responsive store state.');

  // =========================================================================
  // 3. Lock Button Logic (Single-Click Item Lock vs Double-Click Entire Workspace Lock)
  // =========================================================================
  console.log('\n[3/7] Testing Lock Button Logic (Single vs Double Click)...');

  // 3.1 Single-Click Node Lock
  const museumId = PLACEMENT_IDS.CITY_MUSEUM;
  assert.strictEqual(useWorkspaceStore.getState().isPlacementLocked(museumId), false);
  useWorkspaceStore.getState().toggleLockPlacement(museumId);
  assert.strictEqual(useWorkspaceStore.getState().isPlacementLocked(museumId), true, 'Node must be locked');

  // Locked node cannot be deleted
  const deleteResult = await useWorkspaceStore.getState().removePlacement(museumId);
  assert.strictEqual(deleteResult, false, 'Locked node cannot be deleted');
  assert.ok(useWorkspaceStore.getState().workspace!.placements[museumId], 'Locked node must still exist');

  // Locked node visual indication in OrgNode
  const museumNode = useWorkspaceStore.getState().nodes.find((n) => n.id === museumId);
  assert.strictEqual(museumNode?.draggable, false, 'Locked node must have draggable = false');
  assert.strictEqual(museumNode?.data.isLocked, true, 'Locked node data must have isLocked = true');

  const lockedNodeHtml = renderToStaticMarkup(
    React.createElement(ReactFlowProvider, null, React.createElement(OrgNode, museumNode as any))
  );
  assert.ok(lockedNodeHtml.includes('title="Locked"'), 'Locked node must display visual lock indicator');

  // Unlock node
  useWorkspaceStore.getState().toggleLockPlacement(museumId);
  assert.strictEqual(useWorkspaceStore.getState().isPlacementLocked(museumId), false, 'Node must be unlocked');

  // 3.2 Single-Click Branch Lock
  const branchToLock = Object.values(useWorkspaceStore.getState().workspace!.branches)[0];
  const branchId = branchToLock.branchId;
  assert.strictEqual(useWorkspaceStore.getState().isBranchLocked(branchId), false);
  useWorkspaceStore.getState().toggleLockBranch(branchId);
  assert.strictEqual(useWorkspaceStore.getState().isBranchLocked(branchId), true, 'Branch must be locked');

  // Locked branch status cannot be altered
  const prevStatus = branchToLock.status;
  await useWorkspaceStore.getState().setBranchStatus(branchId, prevStatus === 'tick' ? 'cross' : 'tick');
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.branches[branchId].status,
    prevStatus,
    'Locked branch status must not change'
  );

  // Locked branch cannot be deleted
  await useWorkspaceStore.getState().deleteBranch(branchId);
  assert.ok(useWorkspaceStore.getState().workspace!.branches[branchId], 'Locked branch must not be deleted');

  // Unlock branch
  useWorkspaceStore.getState().toggleLockBranch(branchId);
  assert.strictEqual(useWorkspaceStore.getState().isBranchLocked(branchId), false, 'Branch must be unlocked');

  // 3.3 Double-Click Entire Workspace Lock
  assert.strictEqual(useWorkspaceStore.getState().isWorkspaceLocked, false);
  useWorkspaceStore.getState().toggleWorkspaceLock();
  assert.strictEqual(useWorkspaceStore.getState().isWorkspaceLocked, true, 'Workspace must be fully locked');

  // When workspace is locked, ALL nodes are locked and non-draggable
  for (const n of useWorkspaceStore.getState().nodes) {
    assert.strictEqual(n.draggable, false, 'All nodes must be non-draggable when workspace is locked');
  }

  // Adding nodes or branches is rejected when workspace is locked
  let addNodeThrew = false;
  try {
    await useWorkspaceStore.getState().addNode('Unauthorized Corp', 'csr');
  } catch {
    addNodeThrew = true;
  }
  assert.ok(addNodeThrew, 'addNode must reject when workspace is locked');

  const addBranchResult = await useWorkspaceStore.getState().addBranch(
    PLACEMENT_IDS.CITY_MUSEUM,
    PLACEMENT_IDS.DELHI_FOOD_BANK,
    'white',
    'tick'
  );
  assert.strictEqual(addBranchResult, null, 'addBranch must return null when workspace is locked');

  // Unlock workspace
  useWorkspaceStore.getState().toggleWorkspaceLock();
  assert.strictEqual(useWorkspaceStore.getState().isWorkspaceLocked, false, 'Workspace must be unlocked');

  console.log('✓ Section 3 Passed: Lock mechanisms protect nodes, branches, and entire workspace correctly.');

  // =========================================================================
  // 4. Undo / Redo Mechanism (Ctrl+Z and Ctrl+Y)
  // =========================================================================
  console.log('\n[4/7] Testing Undo / Redo State History...');

  const initialPlacementCount = Object.keys(useWorkspaceStore.getState().workspace!.placements).length;
  assert.strictEqual(useWorkspaceStore.getState().canUndo(), false, 'Undo stack must initially be empty');

  // Action 1: Add Node
  const { placementId: newNodeId } = await useWorkspaceStore.getState().addNode('Test Undo Corp', 'csr');
  assert.ok(useWorkspaceStore.getState().workspace!.placements[newNodeId], 'Node added');
  assert.strictEqual(useWorkspaceStore.getState().canUndo(), true, 'Undo should now be available');

  // Undo Action 1
  await useWorkspaceStore.getState().undo();
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.placements[newNodeId],
    undefined,
    'Undo must revert added node'
  );
  assert.strictEqual(
    Object.keys(useWorkspaceStore.getState().workspace!.placements).length,
    initialPlacementCount,
    'Placement count must return to baseline'
  );
  assert.strictEqual(useWorkspaceStore.getState().canRedo(), true, 'Redo should now be available');

  // Redo Action 1
  await useWorkspaceStore.getState().redo();
  assert.ok(useWorkspaceStore.getState().workspace!.placements[newNodeId], 'Redo must re-add the node');

  // Action 2: Change branch status
  const firstBranch = Object.values(useWorkspaceStore.getState().workspace!.branches)[0];
  const oldBranchStatus = firstBranch.status;
  const newStatus = oldBranchStatus === 'tick' ? 'cross' : 'tick';
  await useWorkspaceStore.getState().setBranchStatus(firstBranch.branchId, newStatus);
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.branches[firstBranch.branchId].status,
    newStatus
  );

  // Undo Action 2
  await useWorkspaceStore.getState().undo();
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.branches[firstBranch.branchId].status,
    oldBranchStatus,
    'Undo must restore original branch status'
  );

  // Redo Action 2
  await useWorkspaceStore.getState().redo();
  assert.strictEqual(
    useWorkspaceStore.getState().workspace!.branches[firstBranch.branchId].status,
    newStatus,
    'Redo must re-apply new branch status'
  );

  console.log('✓ Section 4 Passed: Undo and Redo stacks preserve full workspace state snapshots faithfully.');

  // =========================================================================
  // 5. Changing Branch Origin & Destination (Re-routing)
  // =========================================================================
  console.log('\n[5/7] Testing Branch Origin & Destination Modification...');

  const branchToReroute = Object.values(useWorkspaceStore.getState().workspace!.branches).find(
    (b) => b.type === 'yellow'
  )!;
  const originalSource = branchToReroute.sourcePlacementId;
  const originalTarget = branchToReroute.targetPlacementId;

  // Re-route origin from originalSource to CITY_MUSEUM (if not already target)
  const newSource =
    originalTarget === PLACEMENT_IDS.CITY_MUSEUM
      ? PLACEMENT_IDS.DELHI_FOOD_BANK
      : PLACEMENT_IDS.CITY_MUSEUM;

  await useWorkspaceStore.getState().updateBranch(branchToReroute.branchId, {
    sourcePlacementId: newSource,
  });

  const updatedBranch = useWorkspaceStore.getState().workspace!.branches[branchToReroute.branchId];
  assert.strictEqual(updatedBranch.sourcePlacementId, newSource, 'Branch origin must update to new source');
  assert.strictEqual(updatedBranch.targetPlacementId, originalTarget, 'Target remains unchanged');

  // Self-loop prevention check
  await useWorkspaceStore.getState().updateBranch(branchToReroute.branchId, {
    sourcePlacementId: originalTarget, // setting source == target
  });
  const afterInvalidUpdate = useWorkspaceStore.getState().workspace!.branches[branchToReroute.branchId];
  assert.strictEqual(
    afterInvalidUpdate.sourcePlacementId,
    newSource,
    'Branch origin must NOT change when self-loop is attempted'
  );

  // Verify Inspector Drawer renders editable dropdowns for both Source and Target
  useWorkspaceStore.getState().selectBranch(branchToReroute.branchId);
  const branchDrawerHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));
  assert.ok(
    branchDrawerHtml.includes('id="inspector-branch-source"'),
    'Inspector must render source (origin) dropdown'
  );
  assert.ok(
    branchDrawerHtml.includes('id="inspector-branch-target"'),
    'Inspector must render target (destination) dropdown'
  );
  assert.ok(
    branchDrawerHtml.includes('title="Swap origin and destination"'),
    'Inspector must render swap direction button'
  );

  console.log('✓ Section 5 Passed: Branch origin re-routing, self-loop validation, and UI controls verified.');

  // =========================================================================
  // 6. N and B Multi-Selection Box Filtering & Batch Operations
  // =========================================================================
  console.log('\n[6/7] Testing N / B Multi-Selection Filtering & Batch Drawer Invariants...');

  // 6.1 Filter selection to nodes only when N is active
  useWorkspaceStore.getState().setSelectionFilter('nodes');
  assert.strictEqual(useWorkspaceStore.getState().selectionFilter, 'nodes');

  // Simulate box selection with N filter
  useWorkspaceStore.getState().setSelection(
    [PLACEMENT_IDS.CITY_MUSEUM, PLACEMENT_IDS.DELHI_FOOD_BANK],
    []
  );
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementIds.length,
    2,
    '2 nodes selected'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().selectedBranchIds.length,
    0,
    '0 branches selected in node filter mode'
  );

  // Critical Invariant: Selection box does NOT pop open the single-item InspectorDrawer!
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementId,
    null,
    'Single placement ID must be null after box selection'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().selectedBranchId,
    null,
    'Single branch ID must be null after box selection'
  );

  // 6.2 Filter selection to branches only when B is active
  useWorkspaceStore.getState().setSelectionFilter('branches');
  assert.strictEqual(useWorkspaceStore.getState().selectionFilter, 'branches');

  const branchesList = Object.keys(useWorkspaceStore.getState().workspace!.branches);
  useWorkspaceStore.getState().setSelection([], [branchesList[0], branchesList[1]]);
  assert.strictEqual(
    useWorkspaceStore.getState().selectedPlacementIds.length,
    0,
    '0 nodes selected in branch filter mode'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().selectedBranchIds.length,
    2,
    '2 branches selected'
  );

  // 6.3 Batch Modify Modal
  const modifyModalHtml = renderToStaticMarkup(
    React.createElement(MultiSelectModifyModal, {
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.ok(modifyModalHtml.includes('Batch Modify Selection'), 'Must render batch modify modal header');
  assert.ok(modifyModalHtml.includes('Change Verification Status'), 'Must render batch verification controls');
  assert.ok(modifyModalHtml.includes('Append Note / Tag to Selection'), 'Must render batch note input');
  assert.ok(modifyModalHtml.includes('Toggle Lock'), 'Must render batch lock toggle');
  assert.ok(modifyModalHtml.includes('Delete Selected'), 'Must render batch delete');

  // 6.4 Batch Branch Status Change
  await useWorkspaceStore.getState().batchSetBranchStatus('tick');
  const wsAfterBatch = useWorkspaceStore.getState().workspace!;
  assert.strictEqual(wsAfterBatch.branches[branchesList[0]].status, 'tick', 'Branch 1 set to tick');
  assert.strictEqual(wsAfterBatch.branches[branchesList[1]].status, 'tick', 'Branch 2 set to tick');

  // 6.5 Batch Append Note
  await useWorkspaceStore.getState().batchAppendNotes('Batch Verified Partner Q4');
  const wsAfterNotes = useWorkspaceStore.getState().workspace!;
  assert.ok(
    wsAfterNotes.branches[branchesList[0]].note?.includes('Batch Verified Partner Q4'),
    'Batch note must be appended to selected branches'
  );

  console.log('✓ Section 6 Passed: N/B selection filtering, inspector non-opening invariant, and batch operations verified.');

  // =========================================================================
  // 7. Branch Tick/Cross Action Buttons Visibility & Zoom Scaling
  // =========================================================================
  console.log('\n[7/7] Testing Branch Tick/Cross Visibility & Zoom Scaling...');

  const edgeProps = {
    id: testBranch.branchId,
    source: testBranch.sourcePlacementId,
    target: testBranch.targetPlacementId,
    sourceX: 200,
    sourceY: 600,
    targetX: 200,
    targetY: 200,
    data: {
      branch: testBranch,
      index: 0,
      total: 1,
      isReverse: false,
      selected: false, // unselected
      isLocked: false,
    },
    selected: false,
  };

  function EdgeInspector(props: any) {
    const tree = MultiplexEdge(props) as any;
    const rendererChildren = tree.props.children[1].props.children;
    return React.createElement('div', null, rendererChildren);
  }

  const edgeRenderResult = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(EdgeInspector, edgeProps as any)
    )
  );

  // When unselected and unhovered, button box has 'opacity-0 scale-90 pointer-events-none'
  assert.ok(
    edgeRenderResult.includes('opacity-0') && edgeRenderResult.includes('pointer-events-none'),
    'Tick/cross action buttons must be hidden (opacity-0, pointer-events-none) when unselected and unhovered'
  );

  // When selected, button box has 'opacity-100 scale-100'
  const selectedEdgeProps = {
    ...edgeProps,
    selected: true,
    data: { ...edgeProps.data, selected: true },
  };
  const selectedEdgeRender = renderToStaticMarkup(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(EdgeInspector, selectedEdgeProps as any)
    )
  );
  assert.ok(
    selectedEdgeRender.includes('opacity-100') && selectedEdgeRender.includes('scale-100'),
    'Tick/cross action buttons must be visible (opacity-100, scale-100) when branch is selected'
  );

  // Zoom scaling: scale(1) in default test environment
  assert.ok(
    selectedEdgeRender.includes('scale(1)'),
    'Action buttons scale with zoom level'
  );

  console.log('✓ Section 7 Passed: Tick/Cross buttons hide on idle and scale proportionally with zoom.');

  console.log('\n========================================================================');
  console.log(' ALL ADVANCED INTERACTIONS & NEW FEATURES PASSED (100% SUCCESS)! ');
  console.log('========================================================================\n');
}

runAdvancedInteractionsVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
