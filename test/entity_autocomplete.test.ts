import assert from 'node:assert';
import { seedDelhiNgoWorkspace, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';
import {
  searchCrossWorkbookEntities,
  updateRecentEntitiesIndex,
  type RecentEntityIndexEntry,
} from '../src/engine/entityIndex';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import {
  setWorkspaceRepository,
  FolderWorkspaceRepository,
  MemoryFolderStorageBackend,
} from '../src/storage';
import type { WorkspaceState } from '../src/types/schema';

console.log('--- Running Cross-Workbook Entity Autocomplete & Import Test Suite ---');

async function runAutocompleteSuite() {
  const seedState = seedDelhiNgoWorkspace;

  // 1. Query length gating
  console.log('1. Testing query length gating (<3 characters returns empty)...');
  const emptyRes1 = searchCrossWorkbookEntities(
    '',
    seedState.entities,
    [],
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.strictEqual(emptyRes1.length, 0);

  const emptyRes2 = searchCrossWorkbookEntities(
    'co',
    seedState.entities,
    [],
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.strictEqual(emptyRes2.length, 0, '2-character query must return empty array');

  const validRes = searchCrossWorkbookEntities(
    'col',
    seedState.entities,
    [],
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.ok(validRes.length > 0, '>=3 character query must return matches');
  console.log('✓ Query length gating validated.');

  // 2. Fuzzy / Substring matching
  console.log('2. Testing entity search against Delhi seed entities...');
  const collectorateMatches = searchCrossWorkbookEntities(
    'collectorate',
    seedState.entities,
    [],
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.ok(collectorateMatches.length >= 1);
  assert.strictEqual(collectorateMatches[0].name, 'Collectorate Office');
  assert.strictEqual(collectorateMatches[0].source, 'current_workspace');
  console.log('✓ "collectorate" matched "Collectorate Office" with current_workspace provenance.');

  // 3. Proven bridge detection
  console.log('3. Testing confirmed yellow referral bridge detection...');
  // In Delhi seed, City Museum has confirmed yellow branches pointing to Dept of Social Security & Food Ministry!
  const museumMatches = searchCrossWorkbookEntities(
    'museum',
    seedState.entities,
    [],
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.ok(museumMatches.length >= 1);
  const cityMuseum = museumMatches[0];
  assert.strictEqual(cityMuseum.name, 'City Museum');
  assert.ok(cityMuseum.confirmedYellowOutCount > 0, 'City Museum must have confirmed yellow referral leads');
  assert.ok(cityMuseum.targetYellowLeads.length > 0);
  console.log(`✓ City Museum identified with ${cityMuseum.targetYellowLeads.length} proven yellow referral leads.`);

  // 4. External workspace index matching
  console.log('4. Testing external workspace search from recent-entities-index...');
  const externalIndex: RecentEntityIndexEntry[] = [
    {
      entityId: 'ent_bangalore_water',
      name: 'Bangalore Water Supply Board',
      normalizedName: 'bangalore water supply board',
      category: 'government',
      workspaceId: 'ws_karnataka_water',
      workspaceName: 'Karnataka Water Resilience',
      sourceType: 'gdrive',
      workbookMentions: [
        {
          workbookId: 'wb_cauvery',
          workbookTitle: 'Cauvery Basin Management',
          lastSeenAt: new Date().toISOString(),
        },
      ],
    },
  ];

  const externalMatches = searchCrossWorkbookEntities(
    'water',
    seedState.entities,
    externalIndex,
    seedState.workbooks,
    seedState.branches,
    seedState.placements
  );
  assert.strictEqual(externalMatches.length, 1);
  assert.strictEqual(externalMatches[0].name, 'Bangalore Water Supply Board');
  assert.strictEqual(externalMatches[0].source, 'external_workspace');
  assert.strictEqual(externalMatches[0].workspaceName, 'Karnataka Water Resilience');
  console.log('✓ External workspace entities surfaced with full origin metadata.');

  // Test updateRecentEntitiesIndex pure generator
  const updatedRecentIndex = updateRecentEntitiesIndex(seedState, 'Delhi Alliances', 'local', externalIndex);
  assert.ok(updatedRecentIndex.length >= 2, 'Recent index should combine previous entries and workspace entities');
  assert.ok(updatedRecentIndex.some((e) => e.name === 'Bangalore Water Supply Board'));
  const museumIndexed = updatedRecentIndex.find((e) => e.name === 'City Museum');
  assert.ok(museumIndexed, 'City Museum must be indexed');
  assert.ok(museumIndexed.confirmedYellowOutCount! > 0, 'City Museum confirmed yellow count must be preserved in index');
  assert.ok(museumIndexed.targetYellowLeads!.length > 0, 'City Museum referral leads must be preserved in index');

  // Verify external search surfaces proven yellow leads from index
  const externalMuseumMatches = searchCrossWorkbookEntities('museum', {}, updatedRecentIndex);
  assert.ok(externalMuseumMatches.length >= 1);
  assert.strictEqual(externalMuseumMatches[0].source, 'external_workspace');
  assert.ok(externalMuseumMatches[0].confirmedYellowOutCount > 0);
  assert.ok(externalMuseumMatches[0].targetYellowLeads.length > 0);
  console.log('✓ updateRecentEntitiesIndex successfully merged and indexed workspace entities with proven leads.');

  // 5. One-click entity import with proven bridge pull into a new workbook
  console.log('5. Testing one-click entity import with proven bridge pull...');
  const memBackend = new MemoryFolderStorageBackend('test_autocomplete');
  const folderRepo = new FolderWorkspaceRepository(memBackend);
  setWorkspaceRepository(folderRepo);

  // Initialize store with fresh state
  useWorkspaceStore.setState({
    workspace: JSON.parse(JSON.stringify(seedDelhiNgoWorkspace)),
    activeWorkbookId: WORKBOOK_DELHI_ID,
  });

  // Create a clean second workbook in the store
  const newWbId = await useWorkspaceStore.getState().createWorkbook('Jaipur Heritage Alliance');
  assert.strictEqual(useWorkspaceStore.getState().activeWorkbookId, newWbId);
  assert.strictEqual(useWorkspaceStore.getState().nodes.length, 0);

  // Import City Museum + proven bridges into Jaipur workbook
  await useWorkspaceStore.getState().importEntityWithProvenBridges(cityMuseum, true);

  const postImportStore = useWorkspaceStore.getState();
  const currentNodes = postImportStore.nodes;
  const currentEdges = postImportStore.edges;

  // City Museum + its target leads must be placed on Jaipur canvas
  assert.ok(currentNodes.length >= 2, 'City Museum and referral target nodes must be placed');
  const cityMuseumNode = currentNodes.find((n) => n.data.entity?.name === 'City Museum');
  assert.ok(cityMuseumNode, 'City Museum node must exist on canvas');

  // CRITICAL REQUIREMENT: Verify imported yellow branches are strictly PENDING (never tick!)
  assert.ok(currentEdges.length > 0, 'Imported yellow branches must be created');
  for (const edge of currentEdges) {
    assert.strictEqual(edge.data?.branch.type, 'yellow', 'Imported branches must be yellow');
    assert.strictEqual(
      edge.data?.branch.status,
      'pending',
      'CRITICAL: Imported referral bridge MUST be status "pending" (dashed yellow), NEVER auto-ticked!'
    );
  }
  console.log('✓ CRITICAL: Imported proven bridges are strictly "pending" dashed branches with zero false confirmations.');

  // 6. External entity import with importedFrom provenance and referral leads
  console.log('6. Testing external entity import self-containment (importedFrom metadata)...');
  await useWorkspaceStore.getState().importEntityWithProvenBridges(externalMatches[0], false);

  const finalStore = useWorkspaceStore.getState();
  const importedEnt = finalStore.workspace?.entities['ent_bangalore_water'];
  assert.ok(importedEnt, 'External entity must be copied into target workspace entities.json');
  assert.ok(importedEnt.importedFrom, 'Must contain importedFrom provenance');
  assert.strictEqual(importedEnt.importedFrom.workspaceName, 'Karnataka Water Resilience');
  console.log('✓ Self-contained cross-workspace import verified with full provenance.');

  // 7. Verify persistent repository state in FolderWorkspaceRepository
  console.log('7. Verifying persistent FolderWorkspaceRepository state...');
  const repoLoadedState = await folderRepo.loadWorkspace();
  assert.ok(repoLoadedState, 'Loaded workspace from FolderWorkspaceRepository must exist');
  assert.ok(repoLoadedState.workbooks[newWbId], 'Jaipur workbook must be saved in folder storage');
  assert.ok(repoLoadedState.entities['ent_bangalore_water'], 'Imported external entity must be in entities.json');
  console.log('✓ End-to-end repository persistence verified.');

  console.log('--- ALL CROSS-WORKBOOK ENTITY AUTOCOMPLETE TESTS PASSED (100%) ---');
}

runAutocompleteSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
