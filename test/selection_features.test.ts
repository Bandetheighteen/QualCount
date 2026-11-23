/**
 * QualCount: Visual Multiplex Partnership Management System
 * Test Suite: Selection Features & Isolation Mode Marquee Filtering
 * 
 * Verifies:
 * 1. Hold 'B' key and click individual nodes for collective multi-selection.
 * 2. Toggling nodes on/off while holding 'B'.
 * 3. Preserving multi-selection when 'B' is released until cleared or clicked outside.
 * 4. Multi-node collective dragging by the same delta (zero snap-back for all selected nodes).
 * 5. Single-click without 'B' held resets to single-node selection.
 * 6. Illustrator-style isolation mode (`isolatedPlacementId` & `isolatedElement`).
 * 7. Marquee selection box inside isolation mode strictly filters out dimmed/non-isolated nodes,
 *    selecting ONLY highlighted / connected nodes in the isolated subgraph.
 * 8. Pure engine isolation utilities (`src/engine/isolation.ts`) handling all edge cases.
 */

import assert from 'node:assert';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { PLACEMENT_IDS, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';
import {
  getIsolatedHighlightedPlacementIds,
  getIsolatedHighlightedBranchIds,
  isPlacementDimmedInIsolation,
  isBranchDimmedInIsolation,
  filterSelectionByIsolation,
} from '../src/engine/isolation';

async function runSelectionFeaturesTests() {
  console.log('--- Running QualCount Selection & Isolation Features Test Suite ---');

  // Initialize workspace store
  await useWorkspaceStore.getState().init();
  await useWorkspaceStore.getState().resetToDelhiSeed();

  const store = useWorkspaceStore.getState();
  const rootId = PLACEMENT_IDS.YOUR_NGO;
  const collectorateId = PLACEMENT_IDS.COLLECTORATE_OFFICE;
  const cityMuseumId = PLACEMENT_IDS.CITY_MUSEUM;
  const xyzCsrId = PLACEMENT_IDS.XYZ_CSR;

  // =========================================================================
  // SECTION 1: Hold 'B' Key and Click Individual Nodes for Multi-Selection
  // =========================================================================
  console.log('\n[1/4] Testing Hold B Key Multi-Selection & Toggle Behavior...');

  useWorkspaceStore.getState().clearSelection();
  assert.strictEqual(useWorkspaceStore.getState().selectedPlacementIds.length, 0);
  assert.strictEqual(useWorkspaceStore.getState().isHoldingB, false);

  // 1. Press and hold B
  useWorkspaceStore.getState().setIsHoldingB(true);
  assert.strictEqual(useWorkspaceStore.getState().isHoldingB, true, 'isHoldingB must be true');

  // 2. Click Collectorate Office while holding B
  useWorkspaceStore.getState().selectPlacement(collectorateId);
  let state = useWorkspaceStore.getState();
  assert.deepStrictEqual(
    state.selectedPlacementIds,
    [collectorateId],
    'First clicked node must be selected in selectedPlacementIds'
  );
  assert.strictEqual(state.selectedPlacementId, collectorateId);

  // 3. Click City Museum while still holding B
  useWorkspaceStore.getState().selectPlacement(cityMuseumId);
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.selectedPlacementIds.length, 2, 'Two nodes must be collectively selected');
  assert.ok(state.selectedPlacementIds.includes(collectorateId), 'Collectorate must remain selected');
  assert.ok(state.selectedPlacementIds.includes(cityMuseumId), 'City Museum must be selected');
  assert.strictEqual(state.selectedPlacementId, null, 'selectedPlacementId is null when > 1 node selected');

  // Verify derived flow nodes have selected: true
  const flowNodes = state.getFlowNodes();
  const nodeCollectorate = flowNodes.find((n) => n.id === collectorateId);
  const nodeMuseum = flowNodes.find((n) => n.id === cityMuseumId);
  const nodeXyz = flowNodes.find((n) => n.id === xyzCsrId);

  assert.strictEqual(nodeCollectorate?.selected, true, 'Collectorate flow node must be selected: true');
  assert.strictEqual(nodeMuseum?.selected, true, 'City Museum flow node must be selected: true');
  assert.strictEqual(nodeXyz?.selected, false, 'Unclicked node must be selected: false');

  // 4. Click XYZ CSR while still holding B -> 3 nodes selected
  useWorkspaceStore.getState().selectPlacement(xyzCsrId);
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.selectedPlacementIds.length, 3, 'Three nodes must be collectively selected');

  // 5. Click City Museum again while holding B -> toggles OFF City Museum
  useWorkspaceStore.getState().selectPlacement(cityMuseumId);
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.selectedPlacementIds.length, 2, 'City Museum must be toggled off');
  assert.ok(!state.selectedPlacementIds.includes(cityMuseumId), 'City Museum must no longer be in selection');
  assert.ok(state.selectedPlacementIds.includes(collectorateId), 'Collectorate remains selected');
  assert.ok(state.selectedPlacementIds.includes(xyzCsrId), 'XYZ CSR remains selected');

  // 6. Release 'B' -> multi-selection MUST be preserved!
  useWorkspaceStore.getState().setIsHoldingB(false);
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.isHoldingB, false, 'isHoldingB is false');
  assert.strictEqual(state.selectedPlacementIds.length, 2, 'Selection must persist after releasing B');
  assert.ok(state.selectedPlacementIds.includes(collectorateId));
  assert.ok(state.selectedPlacementIds.includes(xyzCsrId));

  console.log('✓ Section 1 Passed: Hold B key multi-selection and toggle persistence verified.');

  // =========================================================================
  // SECTION 2: Multi-Node Collective Dragging by Same Delta
  // =========================================================================
  console.log('\n[2/4] Testing Collective Multi-Node Dragging by Same Delta...');

  // Reset to Delhi seed for clean coordinates
  await useWorkspaceStore.getState().resetToDelhiSeed();

  // Select Collectorate Office and XYZ CSR collectively
  useWorkspaceStore.getState().clearSelection();
  useWorkspaceStore.getState().setIsHoldingB(true);
  useWorkspaceStore.getState().selectPlacement(collectorateId);
  useWorkspaceStore.getState().selectPlacement(xyzCsrId);
  useWorkspaceStore.getState().setIsHoldingB(false);

  state = useWorkspaceStore.getState();
  const origCollectorate = { ...state.workspace!.placements[collectorateId] };
  const origXyz = { ...state.workspace!.placements[xyzCsrId] };
  const origRoot = { ...state.workspace!.placements[rootId] };

  // Drag Collectorate Office by delta (+60, -40)
  const deltaX = 60;
  const deltaY = -40;
  const targetCollectoratePos = {
    x: origCollectorate.x + deltaX,
    y: origCollectorate.y + deltaY,
  };

  await useWorkspaceStore.getState().onNodeDragStop(collectorateId, targetCollectoratePos);
  state = useWorkspaceStore.getState();

  const movedCollectorate = state.workspace!.placements[collectorateId];
  const movedXyz = state.workspace!.placements[xyzCsrId];
  const unselectedRoot = state.workspace!.placements[rootId];

  // 1. Directly dragged card must be exactly at target drop coordinate
  assert.strictEqual(
    movedCollectorate.x,
    targetCollectoratePos.x,
    'Dragged card X must match drop coordinate'
  );
  assert.strictEqual(
    movedCollectorate.y,
    targetCollectoratePos.y,
    'Dragged card Y must match drop coordinate'
  );

  // 2. Collectively selected partner node (XYZ CSR) must move by the EXACT SAME DELTA
  assert.strictEqual(
    movedXyz.x,
    origXyz.x + deltaX,
    `Selected partner node X must move by delta (${origXyz.x} + ${deltaX} = ${origXyz.x + deltaX})`
  );
  assert.strictEqual(
    movedXyz.y,
    origXyz.y + deltaY,
    `Selected partner node Y must move by delta (${origXyz.y} + ${deltaY} = ${origXyz.y + deltaY})`
  );

  // 3. Unselected root node must not move
  assert.strictEqual(unselectedRoot.x, origRoot.x, 'Unselected node X must remain unchanged');
  assert.strictEqual(unselectedRoot.y, origRoot.y, 'Unselected node Y must remain unchanged');

  // 4. Test explicit multi-node drag stop (as emitted by React Flow with `nodes` array)
  const reactFlowMultiDrop = [
    { id: collectorateId, position: { x: 700, y: 300 } },
    { id: xyzCsrId, position: { x: 450, y: 550 } },
  ];
  await useWorkspaceStore.getState().onNodeDragStop(collectorateId, { x: 700, y: 300 }, reactFlowMultiDrop);
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.workspace!.placements[collectorateId].x, 700);
  assert.strictEqual(state.workspace!.placements[collectorateId].y, 300);
  assert.strictEqual(state.workspace!.placements[xyzCsrId].x, 450);
  assert.strictEqual(state.workspace!.placements[xyzCsrId].y, 550);

  // 4b. Test partial allMovedNodes: all collectively selected nodes must still move by delta
  useWorkspaceStore.getState().setIsHoldingB(true);
  useWorkspaceStore.getState().selectPlacement(cityMuseumId);
  useWorkspaceStore.getState().setIsHoldingB(false);
  state = useWorkspaceStore.getState();
  assert.ok(state.selectedPlacementIds.includes(collectorateId));
  assert.ok(state.selectedPlacementIds.includes(xyzCsrId));
  assert.ok(state.selectedPlacementIds.includes(cityMuseumId));

  const origMuseumX = state.workspace!.placements[cityMuseumId].x;
  const origMuseumY = state.workspace!.placements[cityMuseumId].y;

  // React Flow emits drop for collectorate at +50, +50 but omits cityMuseum
  await useWorkspaceStore.getState().onNodeDragStop(
    collectorateId,
    { x: 750, y: 350 },
    [{ id: collectorateId, position: { x: 750, y: 350 } }]
  );
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.workspace!.placements[collectorateId].x, 750);
  assert.strictEqual(state.workspace!.placements[collectorateId].y, 350);
  assert.strictEqual(
    state.workspace!.placements[cityMuseumId].x,
    origMuseumX + 50,
    'City Museum must move by delta +50 even when omitted from React Flow allMovedNodes'
  );
  assert.strictEqual(
    state.workspace!.placements[cityMuseumId].y,
    origMuseumY + 50,
    'City Museum must move by delta +50 even when omitted from React Flow allMovedNodes'
  );

  // 5. Test single-click without 'B' resets to single-node selection
  useWorkspaceStore.getState().selectPlacement(cityMuseumId);
  state = useWorkspaceStore.getState();
  assert.deepStrictEqual(state.selectedPlacementIds, [cityMuseumId]);
  assert.strictEqual(state.selectedPlacementId, cityMuseumId);

  // 6. Test clearSelection clears completely
  useWorkspaceStore.getState().clearSelection();
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.selectedPlacementIds.length, 0);
  assert.strictEqual(state.selectedPlacementId, null);

  console.log('✓ Section 2 Passed: Multi-node dragging by same delta and zero snap-back verified.');

  // =========================================================================
  // SECTION 3: Pure Isolation Engine Logic (src/engine/isolation.ts)
  // =========================================================================
  console.log('\n[3/4] Testing Pure Isolation Engine & Subgraph Calculation...');

  await useWorkspaceStore.getState().resetToDelhiSeed();
  state = useWorkspaceStore.getState();
  const branches = state.workspace!.branches;

  // 1. When isolatedElement is null -> no filtering
  assert.strictEqual(getIsolatedHighlightedPlacementIds(null, branches), null);
  assert.strictEqual(getIsolatedHighlightedBranchIds(null, branches), null);
  assert.strictEqual(isPlacementDimmedInIsolation(rootId, null, branches), false);

  // 2. Isolate Root NGO
  const rootIsolated = { type: 'node' as const, id: rootId };
  const rootHighlightedPlacements = getIsolatedHighlightedPlacementIds(rootIsolated, branches, WORKBOOK_DELHI_ID);
  assert.ok(rootHighlightedPlacements !== null);
  assert.ok(rootHighlightedPlacements.has(rootId), 'Root NGO must be highlighted in its own isolation');

  // Verify direct neighbors connected to Root NGO are highlighted
  const branchesFromRoot = Object.values(branches).filter(
    (b) => b.workbookId === WORKBOOK_DELHI_ID && (b.sourcePlacementId === rootId || b.targetPlacementId === rootId)
  );
  for (const b of branchesFromRoot) {
    assert.ok(
      rootHighlightedPlacements.has(b.sourcePlacementId),
      `Source ${b.sourcePlacementId} must be highlighted`
    );
    assert.ok(
      rootHighlightedPlacements.has(b.targetPlacementId),
      `Target ${b.targetPlacementId} must be highlighted`
    );
  }

  // Find an unconnected / distant node in the 4-tier hierarchy (Sports Dev Office at the top)
  const sportsDevId = PLACEMENT_IDS.SPORTS_DEV_OFFICE;
  const isSportsConnectedToRootDirectly = branchesFromRoot.some(
    (b) => b.sourcePlacementId === sportsDevId || b.targetPlacementId === sportsDevId
  );
  if (!isSportsConnectedToRootDirectly) {
    assert.ok(
      !rootHighlightedPlacements.has(sportsDevId),
      'Sports Dev Office (tier 3) must NOT be in 1-hop isolation of Root NGO'
    );
    assert.strictEqual(
      isPlacementDimmedInIsolation(sportsDevId, rootIsolated, branches, WORKBOOK_DELHI_ID),
      true,
      'Sports Dev Office must be dimmed when Root NGO is isolated'
    );
  }

  // 3. Test branch isolation
  const firstBranch = Object.values(branches)[0];
  const branchIsolated = { type: 'branch' as const, id: firstBranch.branchId };
  const branchPlacements = getIsolatedHighlightedPlacementIds(branchIsolated, branches, WORKBOOK_DELHI_ID);
  assert.ok(branchPlacements !== null);
  assert.strictEqual(branchPlacements.size, 2);
  assert.ok(branchPlacements.has(firstBranch.sourcePlacementId));
  assert.ok(branchPlacements.has(firstBranch.targetPlacementId));

  console.log('✓ Section 3 Passed: Pure isolation engine correctly resolves connected subgraphs.');

  // =========================================================================
  // SECTION 4: Isolation Mode Marquee Selection Filtering
  // =========================================================================
  console.log('\n[4/4] Testing Isolation Mode Selection Rectangle (Marquee Filtering)...');

  // Activate isolation mode by isolating Root NGO
  useWorkspaceStore.getState().enterIsolationMode('node', rootId);
  state = useWorkspaceStore.getState();

  assert.deepStrictEqual(state.isolatedElement, { type: 'node', id: rootId });
  assert.strictEqual(state.isolatedPlacementId, rootId, 'isolatedPlacementId must be set to rootId');

  // Verify nodes in store have isDimmed set properly
  const isoFlowNodes = state.getFlowNodes();
  const isoRootNode = isoFlowNodes.find((n) => n.id === rootId);
  assert.strictEqual(isoRootNode?.data.isIsolated, true);
  assert.strictEqual(isoRootNode?.data.isDimmed, false);

  // Suppose marquee box touches Root NGO (highlighted), Collectorate (highlighted), and Sports Dev (dimmed)
  const highlightedSet = getIsolatedHighlightedPlacementIds(
    state.isolatedElement,
    state.workspace!.branches,
    WORKBOOK_DELHI_ID
  )!;

  const candidateNodes = [rootId, collectorateId, sportsDevId];
  const candidateBranches = Object.keys(branches).slice(0, 3);

  // Apply isolation filter
  const filtered = filterSelectionByIsolation(
    { placementIds: candidateNodes, branchIds: candidateBranches },
    state.isolatedElement,
    state.workspace!.branches,
    WORKBOOK_DELHI_ID
  );

  // Assert only highlighted / isolated nodes are in filtered result
  assert.ok(filtered.placementIds.includes(rootId), 'Root NGO must be selected');
  if (highlightedSet.has(collectorateId)) {
    assert.ok(filtered.placementIds.includes(collectorateId), 'Connected Collectorate must be selected');
  }
  assert.ok(
    !filtered.placementIds.includes(sportsDevId),
    'Dimmed Sports Dev Office inside marquee rectangle MUST NOT be selected'
  );

  // Suppose marquee box ONLY touches dimmed nodes
  const dimmedOnlyCandidates = [sportsDevId];
  const dimmedFiltered = filterSelectionByIsolation(
    { placementIds: dimmedOnlyCandidates, branchIds: [] },
    state.isolatedElement,
    state.workspace!.branches,
    WORKBOOK_DELHI_ID
  );
  assert.strictEqual(
    dimmedFiltered.placementIds.length,
    0,
    'Marquee box containing only dimmed nodes must select 0 nodes'
  );

  // Store-level integration: setSelection in isolation mode must strip dimmed nodes
  useWorkspaceStore.getState().setSelection([rootId, collectorateId, sportsDevId], []);
  state = useWorkspaceStore.getState();
  assert.ok(state.selectedPlacementIds.includes(rootId));
  assert.ok(
    !state.selectedPlacementIds.includes(sportsDevId),
    'setSelection must strictly strip dimmed sportsDevId during isolation mode'
  );

  // Store-level integration: onNodesChange attempting to select dimmed node in isolation must be sanitized
  useWorkspaceStore.getState().onNodesChange([
    { type: 'select', id: sportsDevId, selected: true },
  ]);
  state = useWorkspaceStore.getState();
  const dimmedNodeInStore = state.nodes.find((n) => n.id === sportsDevId);
  assert.strictEqual(
    dimmedNodeInStore?.selected,
    false,
    'onNodesChange must sanitize dimmed node to selected: false in isolation mode'
  );

  // Store-level integration: selectPlacement and toggleSelectPlacement on dimmed node must be rejected
  useWorkspaceStore.getState().selectPlacement(sportsDevId);
  state = useWorkspaceStore.getState();
  assert.ok(!state.selectedPlacementIds.includes(sportsDevId), 'selectPlacement must reject dimmed node in isolation mode');

  useWorkspaceStore.getState().toggleSelectPlacement(sportsDevId);
  state = useWorkspaceStore.getState();
  assert.ok(!state.selectedPlacementIds.includes(sportsDevId), 'toggleSelectPlacement must reject dimmed node in isolation mode');

  // Exit isolation mode
  useWorkspaceStore.getState().exitIsolationMode();
  state = useWorkspaceStore.getState();
  assert.strictEqual(state.isolatedElement, null);
  assert.strictEqual(state.isolatedPlacementId, null);

  // When isolation is OFF, all candidates inside marquee are selected
  useWorkspaceStore.getState().setSelection(candidateNodes, []);
  state = useWorkspaceStore.getState();
  assert.deepStrictEqual(
    state.selectedPlacementIds,
    candidateNodes,
    'Without isolation, all nodes in marquee rectangle must be selected'
  );

  console.log('✓ Section 4 Passed: Marquee rectangle in isolation mode strictly filters out dimmed nodes.');

  console.log('\n========================================================================');
  console.log(' ALL SELECTION & ISOLATION FEATURES VERIFICATIONS PASSED (100% SUCCESS)!');
  console.log('========================================================================\n');
}

runSelectionFeaturesTests().catch((err) => {
  console.error('Selection features test failed:', err);
  process.exit(1);
});
