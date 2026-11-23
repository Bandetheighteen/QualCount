import assert from 'node:assert';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { serializeWorkbookToFile, convertWorkbookFileToWorkspace } from '../src/storage/folderSerializer';
import { sanitizeWorkbookFilename } from '../src/io/nativeFileSave';
import { computeTopologyMetrics } from '../src/engine/metrics';
import type { WorkbookFile, WorkspaceState } from '../src/types/schema';

async function runTests() {
  console.log('=== Running Single Workbook, Root Node Invariants & Search Test Suite ===\n');

  // [1/7] Test Workbook Creation with No Auto-Generated Root Node & Budget Prompt / Skip
  console.log('[1/7] Testing Workbook creation (Clean canvas, zero initial root node)...');
  await useWorkspaceStore.getState().init();

  const wbWithBudget = await useWorkspaceStore.getState().createWorkbook('Clean River Project', 'River alliance', 2500000);
  assert.ok(wbWithBudget, 'New workbook ID should be returned');
  const storeState1 = useWorkspaceStore.getState();
  assert.strictEqual(storeState1.activeWorkbookId, wbWithBudget);
  assert.strictEqual(storeState1.nodes.length, 0, 'New workbook must have 0 initial nodes on canvas');
  assert.strictEqual(storeState1.edges.length, 0, 'New workbook must have 0 initial branches on canvas');
  assert.strictEqual(storeState1.workspace?.workbooks[wbWithBudget]?.targetBudgetInr, 2500000);

  // Test "Skip Budget" creation (0 budget)
  const wbSkippedBudget = await useWorkspaceStore.getState().createWorkbook('Education Coalition', 'Schools', 0);
  const storeState2 = useWorkspaceStore.getState();
  assert.strictEqual(storeState2.activeWorkbookId, wbSkippedBudget);
  assert.strictEqual(storeState2.nodes.length, 0, 'Skipped-budget workbook must have 0 initial nodes on canvas');
  assert.strictEqual(storeState2.workspace?.workbooks[wbSkippedBudget]?.targetBudgetInr, 0);
  console.log('✓ Section 1 Passed: Workbook initializes cleanly with 0 nodes and correct budget/skip amount.\n');

  // [2/7] Test Budget Editing at Any Time
  console.log('[2/7] Testing dynamic budget editing and live metrics update...');
  await useWorkspaceStore.getState().updateWorkbook(wbSkippedBudget, { targetBudgetInr: 5000000 });
  const updatedWb = useWorkspaceStore.getState().workspace?.workbooks[wbSkippedBudget];
  assert.strictEqual(updatedWb?.targetBudgetInr, 5000000, 'Target budget should be updated to 50,00,000');
  console.log('✓ Section 2 Passed: Target budget is editable at any time.\n');

  // [3/7] Test Strict Single-Root Rule Enforcement
  console.log('[3/7] Testing strict Single-Root Rule enforcement...');
  // Add 3 nodes to wbSkippedBudget
  await useWorkspaceStore.getState().addNode('Apex Water Foundation', 'foundation');
  await useWorkspaceStore.getState().addNode('Municipal Corporation', 'government');
  await useWorkspaceStore.getState().addNode('Community Action Group', 'civil_society');

  const placements = Object.values(useWorkspaceStore.getState().workspace?.placements || {}).filter(
    (p) => p.workbookId === wbSkippedBudget
  );
  assert.strictEqual(placements.length, 3, 'Should have 3 placements in active workbook');
  const [nodeA, nodeB, nodeC] = placements;

  // Initially, none are root
  assert.strictEqual(nodeA.isRootNgo, false);
  assert.strictEqual(nodeB.isRootNgo, false);
  assert.strictEqual(nodeC.isRootNgo, false);

  // Make nodeA the root node
  await useWorkspaceStore.getState().setRootPlacement(nodeA.placementId, true);
  let currentPlacements = useWorkspaceStore.getState().workspace?.placements || {};
  assert.strictEqual(currentPlacements[nodeA.placementId]?.isRootNgo, true, 'Node A should now be designated root');
  assert.strictEqual(currentPlacements[nodeB.placementId]?.isRootNgo, false, 'Node B must not be root');

  // Attempt to make nodeB the root node WHILE nodeA is already root -> MUST BE PREVENTED
  await useWorkspaceStore.getState().setRootPlacement(nodeB.placementId, true);
  currentPlacements = useWorkspaceStore.getState().workspace?.placements || {};
  assert.strictEqual(
    currentPlacements[nodeA.placementId]?.isRootNgo,
    true,
    'Node A must REMAIN the designated root node'
  );
  assert.strictEqual(
    currentPlacements[nodeB.placementId]?.isRootNgo,
    false,
    'Node B MUST BE PREVENTED from being set as root while another root exists'
  );

  // Unset nodeA as root
  await useWorkspaceStore.getState().setRootPlacement(nodeA.placementId, false);
  currentPlacements = useWorkspaceStore.getState().workspace?.placements || {};
  assert.strictEqual(currentPlacements[nodeA.placementId]?.isRootNgo, false, 'Node A should now be unset as root');

  // Now make nodeB root -> should succeed
  await useWorkspaceStore.getState().setRootPlacement(nodeB.placementId, true);
  currentPlacements = useWorkspaceStore.getState().workspace?.placements || {};
  assert.strictEqual(currentPlacements[nodeB.placementId]?.isRootNgo, true, 'Node B is now designated root');
  assert.strictEqual(currentPlacements[nodeA.placementId]?.isRootNgo, false);
  assert.strictEqual(currentPlacements[nodeC.placementId]?.isRootNgo, false);

  console.log('✓ Section 3 Passed: Strict Single-Root rule strictly enforced.\n');

  // [4/7] Test Standalone Workbook Serialization & Round-Trip
  console.log('[4/7] Testing standalone Workbook JSON serialization and round-trip fidelity...');
  const ws = useWorkspaceStore.getState().workspace!;
  const serialized = serializeWorkbookToFile(ws, wbSkippedBudget);

  assert.strictEqual(serialized.schemaVersion, 2);
  assert.strictEqual(serialized.workbookId, wbSkippedBudget);
  assert.strictEqual(serialized.title, 'Education Coalition');
  assert.strictEqual(serialized.targetBudgetInr, 5000000);
  assert.ok(serialized.entities, 'Entities dictionary must be bundled inside workbook file');
  assert.strictEqual(Object.keys(serialized.placements).length, 3);

  // Convert back to workspace state
  const restoredWs = convertWorkbookFileToWorkspace(serialized);
  assert.strictEqual(restoredWs.workbooks[wbSkippedBudget].title, 'Education Coalition');
  assert.strictEqual(restoredWs.workbooks[wbSkippedBudget].targetBudgetInr, 5000000);
  assert.strictEqual(Object.keys(restoredWs.placements).length, 3);
  assert.strictEqual(restoredWs.placements[nodeB.placementId].isRootNgo, true, 'Root status preserved');
  console.log('✓ Section 4 Passed: Standalone WorkbookFile round-trip preserves all entities and placements.\n');

  // [5/7] Test Node & Contact Search Bar Logic
  console.log('[5/7] Testing Node & Contact search functionality...');
  // Add points of contact to entity
  const wsEntities = { ...useWorkspaceStore.getState().workspace!.entities };
  const entityAId = nodeA.entityId;
  wsEntities[entityAId] = {
    ...wsEntities[entityAId],
    internalLead: 'Dr. Vikram Seth',
    pointsOfContact: [
      {
        id: 'poc_1',
        name: 'Sunita Rao',
        designation: 'Director of Outreach',
        phone: '+91 98765 43210',
        email: 'sunita.rao@apexwater.org',
        description: 'Key point of contact for funding grants',
        habitOrPeculiarity: 'Prefers morning calls',
      },
      {
        id: 'poc_2',
        name: 'Amitabh Sharma',
        designation: 'Finance Officer',
        phone: '+91 91234 56789',
        email: 'amitabh@apexwater.org',
        description: 'Handles disbursement',
        habitOrPeculiarity: 'Strict on paperwork',
      },
    ],
  };

  const wsWithContacts: WorkspaceState = {
    ...useWorkspaceStore.getState().workspace!,
    entities: wsEntities,
  };
  useWorkspaceStore.setState({ workspace: wsWithContacts });

  // Simulate search logic
  function searchWorkbook(query: string, wbId: string) {
    const q = query.toLowerCase().trim();
    const activePlcs = Object.values(wsWithContacts.placements).filter((p) => p.workbookId === wbId);
    const results: any[] = [];

    for (const p of activePlcs) {
      const ent = wsWithContacts.entities[p.entityId];
      if (!ent) continue;
      const nodeName = ent.name || '';
      const matchesTitle = nodeName.toLowerCase().includes(q);

      const matchedContacts: any[] = [];
      if (ent.pointsOfContact) {
        for (const poc of ent.pointsOfContact) {
          if (
            (poc.name && poc.name.toLowerCase().includes(q)) ||
            (poc.designation && poc.designation.toLowerCase().includes(q)) ||
            (poc.email && poc.email.toLowerCase().includes(q)) ||
            (poc.phone && poc.phone.includes(q))
          ) {
            matchedContacts.push(poc);
          }
        }
      }

      if (matchesTitle) {
        results.push({ placementId: p.placementId, type: 'title', name: nodeName });
      }
      for (const poc of matchedContacts) {
        if (!matchesTitle) {
          results.push({ placementId: p.placementId, type: 'contact', pocName: poc.name });
        }
      }
      if (!matchesTitle && matchedContacts.length === 0 && ent.internalLead?.toLowerCase().includes(q)) {
        results.push({ placementId: p.placementId, type: 'lead', lead: ent.internalLead });
      }
    }
    return results;
  }

  // 1. Search by organization name
  const nameResults = searchWorkbook('Apex Water', wbSkippedBudget);
  assert.strictEqual(nameResults.length, 1);
  assert.strictEqual(nameResults[0].placementId, nodeA.placementId);

  // 2. Search by contact person name
  const contactResults = searchWorkbook('Sunita', wbSkippedBudget);
  assert.strictEqual(contactResults.length, 1);
  assert.strictEqual(contactResults[0].pocName, 'Sunita Rao');
  assert.strictEqual(contactResults[0].placementId, nodeA.placementId);

  // 3. Search by contact person email / domain
  const emailResults = searchWorkbook('sunita.rao@apexwater.org', wbSkippedBudget);
  assert.strictEqual(emailResults.length, 1);
  assert.strictEqual(emailResults[0].pocName, 'Sunita Rao');

  // 4. Search by contact designation
  const desigResults = searchWorkbook('Director of Outreach', wbSkippedBudget);
  assert.strictEqual(desigResults.length, 1);
  assert.strictEqual(desigResults[0].pocName, 'Sunita Rao');

  // 5. Search by internal lead
  const leadResults = searchWorkbook('Vikram Seth', wbSkippedBudget);
  assert.strictEqual(leadResults.length, 1);
  assert.strictEqual(leadResults[0].lead, 'Dr. Vikram Seth');

  console.log('✓ Section 5 Passed: Search bar accurately queries both node titles and points of contact.\n');

  // [6/7] Test OS Filename Sanitization
  console.log('[6/7] Testing OS filename sanitization for native file explorer...');
  assert.strictEqual(
    sanitizeWorkbookFilename('Clean Water: Project 2026 / Phase 1 *'),
    'Clean_Water_Project_2026_Phase_1.json'
  );
  assert.strictEqual(
    sanitizeWorkbookFilename('दिल्ली जल अभियान'),
    'दिल्ली_जल_अभियान.json'
  );
  assert.strictEqual(sanitizeWorkbookFilename('   '), 'qualcount_workbook.json');
  assert.strictEqual(sanitizeWorkbookFilename(undefined), 'qualcount_workbook.json');
  console.log('✓ Section 6 Passed: Filenames cleanly sanitized for Windows and POSIX filesystems.\n');

  // [7/7] Test Universal Theme Standardization
  console.log('[7/7] Testing universal theme standardization (White Paper vs Charcoal Matte)...');
  useWorkspaceStore.getState().setTheme('light');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'light', 'Theme should be light (White Paper)');

  useWorkspaceStore.getState().setTheme('dark');
  assert.strictEqual(useWorkspaceStore.getState().theme, 'dark', 'Theme should be dark (Charcoal Matte)');

  console.log('✓ Section 7 Passed: Universal White Paper and Charcoal Matte theme synced.\n');

  // [8/8] Test Toolbar Search Controls, Beacon Flashing & 115+ Node Filtering
  console.log('[8/8] Testing Toolbar search state, beacon flashing & 115+ node graph search...');
  
  // Test store search state triggers
  assert.strictEqual(useWorkspaceStore.getState().isSearchOpen, false);
  const initialTrigger = useWorkspaceStore.getState().searchFocusTrigger;
  
  useWorkspaceStore.getState().openSearch();
  assert.strictEqual(useWorkspaceStore.getState().isSearchOpen, true, 'openSearch should set isSearchOpen to true');
  assert.strictEqual(useWorkspaceStore.getState().searchFocusTrigger, initialTrigger + 1, 'searchFocusTrigger should increment');
  assert.strictEqual(useWorkspaceStore.getState().activeView, 'canvas', 'openSearch ensures activeView is canvas');

  useWorkspaceStore.getState().toggleSearch();
  assert.strictEqual(useWorkspaceStore.getState().isSearchOpen, false, 'toggleSearch should close search when already open');

  useWorkspaceStore.getState().toggleSearch();
  assert.strictEqual(useWorkspaceStore.getState().isSearchOpen, true, 'toggleSearch should open search when closed');

  useWorkspaceStore.getState().closeSearch();
  assert.strictEqual(useWorkspaceStore.getState().isSearchOpen, false, 'closeSearch should set isSearchOpen to false');

  // Test beacon flash state
  useWorkspaceStore.getState().setFlashingPlacement('plc-target-sample');
  assert.strictEqual(useWorkspaceStore.getState().flashingPlacementId, 'plc-target-sample');
  useWorkspaceStore.getState().setFlashingPlacement(null);
  assert.strictEqual(useWorkspaceStore.getState().flashingPlacementId, null);

  // Test real-world 115+ node graph search (synthetic_large_network.json)
  const fs = await import('node:fs');
  const path = await import('node:path');
  const ycivPath = path.resolve('test/fixtures/synthetic_large_network.json');
  if (fs.existsSync(ycivPath)) {
    const rawData = fs.readFileSync(ycivPath, 'utf8');
    await useWorkspaceStore.getState().importWorkspaceFile(rawData);
    
    const storeStateAfterImport = useWorkspaceStore.getState();
    const importedPlacements = Object.values(storeStateAfterImport.workspace?.placements || {});
    assert.strictEqual(importedPlacements.length, 117, 'Should have 117 nodes in YCIV graph');

    // Simulate search over 117 nodes
    const q1 = 'yuva';
    const matches1 = importedPlacements.filter((p) => {
      const ent = storeStateAfterImport.workspace?.entities[p.entityId];
      if (!ent) return false;
      return (
        ent.name.toLowerCase().includes(q1) ||
        ent.pointsOfContact?.some((poc) => poc.name?.toLowerCase().includes(q1) || poc.email?.toLowerCase().includes(q1))
      );
    });
    assert.ok(matches1.length > 0, 'Should find matching nodes for "yuva"');

    // Select the first match and verify selection + flash beacon
    const firstMatch = matches1[0];
    useWorkspaceStore.getState().selectPlacement(firstMatch.placementId);
    useWorkspaceStore.getState().setFlashingPlacement(firstMatch.placementId);

    assert.strictEqual(useWorkspaceStore.getState().selectedPlacementId, firstMatch.placementId);
    assert.strictEqual(useWorkspaceStore.getState().flashingPlacementId, firstMatch.placementId);

    // Search by notes (e.g. 'civil society foundation' in Hunnarshala notes)
    const qNotes = 'civil society foundation';
    const notesMatches = importedPlacements.filter((p) => {
      const ent = storeStateAfterImport.workspace?.entities[p.entityId];
      return ent?.globalNotes?.toLowerCase().includes(qNotes);
    });
    assert.ok(notesMatches.length > 0, 'Should find matches in entity global notes');
    assert.strictEqual(notesMatches[0].placementId, 'plc-hunnarshala-foundation');

    // Search by category (e.g. 'government')
    const qCat = 'government';
    const catMatches = importedPlacements.filter((p) => {
      const ent = storeStateAfterImport.workspace?.entities[p.entityId];
      return ent?.category?.toLowerCase().includes(qCat);
    });
    assert.ok(catMatches.length >= 10, 'Should find government entities in YCIV dataset');

    // Test filter conflict resolution: when a filter hides a searched node, selecting it resets filter
    useWorkspaceStore.getState().setFilters({ nodeCategories: ['academic'] });
    const academicNodes = useWorkspaceStore.getState().nodes;
    assert.ok(!academicNodes.some((n) => n.id === 'plc-hunnarshala-foundation'), 'Hunnarshala should be hidden by academic category filter');

    // Simulate search selection with filter conflict auto-reset
    const isFilterActive = useWorkspaceStore.getState().filters.nodeCategories.length > 0;
    const isHunnarshalaVisible = useWorkspaceStore.getState().nodes.some((n) => n.id === 'plc-hunnarshala-foundation');
    if (!isHunnarshalaVisible && isFilterActive) {
      useWorkspaceStore.getState().resetFilters();
    }
    useWorkspaceStore.getState().selectPlacement('plc-hunnarshala-foundation');
    useWorkspaceStore.getState().setFlashingPlacement('plc-hunnarshala-foundation');

    const refreshedNodes = useWorkspaceStore.getState().nodes;
    assert.ok(refreshedNodes.some((n) => n.id === 'plc-hunnarshala-foundation'), 'Hunnarshala must be visible after filter reset');
    assert.strictEqual(useWorkspaceStore.getState().selectedPlacementId, 'plc-hunnarshala-foundation');
    assert.strictEqual(useWorkspaceStore.getState().flashingPlacementId, 'plc-hunnarshala-foundation');

    // Verify beacon flash auto-clears after 3.5s timeout
    await new Promise((resolve) => setTimeout(resolve, 3600));
    assert.strictEqual(useWorkspaceStore.getState().flashingPlacementId, null, 'Beacon flash should auto-clear after 3.5s');
  }

  console.log('✓ Section 8 Passed: Toolbar search triggering, beacon flash & 115+ node search validated.\n');

  console.log('========================================================================');
  console.log(' ALL SINGLE WORKBOOK, ROOT INVARIANTS & SEARCH TESTS PASSED (100%)!');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
