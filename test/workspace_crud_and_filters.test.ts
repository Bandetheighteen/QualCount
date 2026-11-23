import assert from 'node:assert';
import { useWorkspaceStore, computeConnectedTree } from '../src/store/useWorkspaceStore';
import { computeTopologyMetrics } from '../src/engine/metrics';
import { computeMultiWorkspaceMacroGraph } from '../src/components/landing/OverviewMacroMap';
import { seedDelhiNgoWorkspace, WORKBOOK_DELHI_ID } from '../src/data/seedDelhiNgo';
import { serializeWorkspaceToFolder, deserializeFolderToWorkspace } from '../src/storage/folderSerializer';
import type { Branch, WorkspaceState } from '../src/types/schema';

console.log('--- Running QualCount Workspace CRUD, Connected Tree Filter & Macro-Map Scope Test Suite ---');

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = new MockLocalStorage();

async function runTests() {
  // Reset store to known seed state
  useWorkspaceStore.setState({
    workspace: JSON.parse(JSON.stringify(seedDelhiNgoWorkspace)),
    savedWorkspaces: [JSON.parse(JSON.stringify(seedDelhiNgoWorkspace))],
    activeWorkbookId: WORKBOOK_DELHI_ID,
  });

  const store = useWorkspaceStore.getState();

  // 1. Workspace CRUD tests
  console.log('1. Testing Workspace CRUD operations...');
  const newWsId = await store.createWorkspace('Maharashtra Alliance', 'Apex NGO');
  assert.ok(newWsId.startsWith('ws_'), 'createWorkspace must return a valid workspace ID');
  const createdWs = useWorkspaceStore.getState().workspace;
  assert.strictEqual(createdWs?.workspaceName, 'Maharashtra Alliance');
  assert.ok(createdWs?.entities, 'New workspace must contain root entity');
  assert.strictEqual(useWorkspaceStore.getState().savedWorkspaces.length, 2, 'savedWorkspaces must contain 2 entries');

  // Test Update Workspace
  await useWorkspaceStore.getState().updateWorkspace({ workspaceName: 'Maharashtra Western Alliance' });
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceName, 'Maharashtra Western Alliance');

  // Test Copy Workspace
  const copyWsId = await useWorkspaceStore.getState().copyWorkspace();
  assert.ok(copyWsId.startsWith('ws_copy_'), 'copyWorkspace must return valid copy ID');
  assert.ok(useWorkspaceStore.getState().workspace?.workspaceName.includes('(Copy)'));
  assert.strictEqual(useWorkspaceStore.getState().savedWorkspaces.length, 3, 'savedWorkspaces must contain 3 entries');

  // Test Delete Workspace (deletes active copy, switches to remaining sample workspace)
  await useWorkspaceStore.getState().deleteWorkspace();
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceId, 'ws_sample_workspace');
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceName, 'Sample Workspace');
  assert.strictEqual(useWorkspaceStore.getState().savedWorkspaces.length, 2, 'savedWorkspaces must contain 2 entries after deleting copy');
  console.log('✓ Workspace CRUD operations passed.');

  // 2. Workbook CRUD tests
  console.log('2. Testing Workbook CRUD operations...');
  const currentWs = useWorkspaceStore.getState().workspace!;
  const originalWbCount = Object.keys(currentWs.workbooks).length;

  // Test Copy Workbook
  const copyWbId = await useWorkspaceStore.getState().copyWorkbook(WORKBOOK_DELHI_ID);
  assert.ok(copyWbId, 'copyWorkbook must return new workbook ID');
  const postCopyWs = useWorkspaceStore.getState().workspace!;
  assert.strictEqual(Object.keys(postCopyWs.workbooks).length, originalWbCount + 1);
  assert.ok(postCopyWs.workbooks[copyWbId].title.includes('(Copy)'));

  // Test Update Workbook
  await useWorkspaceStore.getState().updateWorkbook(copyWbId, {
    title: 'Delhi Heritage Renovation',
    targetBudgetInr: 35000000,
    status: 'draft',
  });
  const updatedWb = useWorkspaceStore.getState().workspace!.workbooks[copyWbId];
  assert.strictEqual(updatedWb.title, 'Delhi Heritage Renovation');
  assert.strictEqual(updatedWb.targetBudgetInr, 35000000);
  assert.strictEqual(updatedWb.status, 'draft');

  // Test Delete Workbook
  const deleted = await useWorkspaceStore.getState().deleteWorkbook(copyWbId);
  assert.strictEqual(deleted, true);
  assert.strictEqual(Object.keys(useWorkspaceStore.getState().workspace!.workbooks).length, originalWbCount);

  // Verify sample dataset title is clearly marked
  const sampleWb = useWorkspaceStore.getState().workspace!.workbooks[WORKBOOK_DELHI_ID];
  assert.ok(sampleWb.title.startsWith('[Sample]'), 'Sample dataset title must clearly indicate [Sample]');

  // Test Delete the only workbook (Sample Workbook)
  const deletedSample = await useWorkspaceStore.getState().deleteWorkbook(WORKBOOK_DELHI_ID);
  assert.strictEqual(deletedSample, true, 'Deleting the only workbook (Sample) must succeed');
  assert.strictEqual(Object.keys(useWorkspaceStore.getState().workspace!.workbooks).length, 0, 'Workspace workbooks must be empty');
  assert.strictEqual(useWorkspaceStore.getState().activeWorkbookId, '', 'activeWorkbookId must be empty string');
  assert.strictEqual(useWorkspaceStore.getState().nodes.length, 0, 'Canvas nodes must be empty');
  assert.strictEqual(useWorkspaceStore.getState().edges.length, 0, 'Canvas edges must be empty');

  // Verify reload does not resurrect the deleted sample workbook
  await useWorkspaceStore.getState().init();
  assert.strictEqual(
    Object.keys(useWorkspaceStore.getState().workspace!.workbooks).length,
    0,
    'Sample workbook must remain deleted after store init/re-open'
  );

  // Test creating a new workbook after deleting sample
  const newCustomWbId = await useWorkspaceStore.getState().createWorkbook('Mumbai Clean Air Coalition', 'Civic action', 4000000);
  assert.ok(newCustomWbId, 'createWorkbook must return a valid ID');
  const wsAfterCreate = useWorkspaceStore.getState().workspace!;
  assert.strictEqual(Object.keys(wsAfterCreate.workbooks).length, 1);
  assert.strictEqual(wsAfterCreate.workbooks[newCustomWbId].title, 'Mumbai Clean Air Coalition');
  assert.strictEqual(useWorkspaceStore.getState().nodes.length, 0, 'Clean new workbook starts with empty canvas');
  assert.strictEqual(useWorkspaceStore.getState().savedWorkspaces[0].workbooks[newCustomWbId].title, 'Mumbai Clean Air Coalition', 'savedWorkspaces must be synchronized');

  // Test folder serialization preserves userDeletedSample flag
  const folderBundle = serializeWorkspaceToFolder(wsAfterCreate);
  assert.strictEqual(folderBundle.manifest.userDeletedSample, true, 'Manifest must preserve userDeletedSample: true');
  const deserializedWs = deserializeFolderToWorkspace(folderBundle.manifest, folderBundle.entitiesFile, folderBundle.workbookFiles);
  assert.strictEqual(deserializedWs.userDeletedSample, true, 'Deserialized workspace must preserve userDeletedSample: true');

  // Verify reload maintains custom workbook without resurrecting Delhi sample
  await useWorkspaceStore.getState().init();
  assert.strictEqual(
    Object.keys(useWorkspaceStore.getState().workspace!.workbooks).length,
    1,
    'Custom workbook must remain intact after reload without sample resurrecting'
  );
  assert.ok(
    !useWorkspaceStore.getState().workspace!.workbooks[WORKBOOK_DELHI_ID],
    'Delhi sample must NOT be present after custom workbook creation'
  );

  // Verify resetToDelhiSeed restores it on explicit user request
  await useWorkspaceStore.getState().resetToDelhiSeed();
  assert.ok(
    useWorkspaceStore.getState().workspace!.workbooks[WORKBOOK_DELHI_ID],
    'Explicit resetToDelhiSeed must restore sample dataset'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().workspace?.workspaceName,
    'Sample Workspace',
    'Seed workspace name must be "Sample Workspace"'
  );
  console.log('✓ Workbook CRUD operations and Sample removability passed.');

  // Test full deletion of Sample Workspace
  console.log('2b. Testing complete deletion of Sample Workspace...');
  const sampleDeleted = await useWorkspaceStore.getState().deleteWorkspace('ws_sample_workspace');
  assert.strictEqual(sampleDeleted, true, 'Deleting Sample Workspace must succeed');
  assert.strictEqual(
    useWorkspaceStore.getState().savedWorkspaces.some((w) => w.workspaceId === 'ws_sample_workspace'),
    false,
    'Sample Workspace must be removed from savedWorkspaces'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().workspace?.userDeletedSample,
    true,
    'Remaining workspace must retain userDeletedSample: true'
  );

  // Verify reload does not resurrect the deleted Sample Workspace
  await useWorkspaceStore.getState().init();
  assert.strictEqual(
    useWorkspaceStore.getState().savedWorkspaces.some((w) => w.workspaceId === 'ws_sample_workspace'),
    false,
    'Sample Workspace must remain deleted after store init'
  );

  // Test deleting the last remaining workspace
  const remainingWsId = useWorkspaceStore.getState().workspace?.workspaceId;
  assert.ok(remainingWsId, 'Must have a remaining workspace');
  await useWorkspaceStore.getState().deleteWorkspace(remainingWsId);
  const emptyState = useWorkspaceStore.getState();
  assert.strictEqual(emptyState.workspace?.workspaceName, 'New Workspace', 'Deleting last workspace must transition to "New Workspace"');
  assert.strictEqual(Object.keys(emptyState.workspace?.workbooks || {}).length, 0, 'New Workspace must have 0 workbooks');
  assert.strictEqual(emptyState.workspace?.userDeletedSample, true, 'New Workspace must retain userDeletedSample: true');

  // Verify restart does not reload sample dataset
  await useWorkspaceStore.getState().init();
  assert.strictEqual(
    Object.keys(useWorkspaceStore.getState().workspace?.workbooks || {}).length,
    0,
    'No workbooks should resurrect on restart after full deletion'
  );

  // Restore sample dataset for remaining test suite
  await useWorkspaceStore.getState().resetToDelhiSeed();

  // Test legacy pre-existing "Delhi Civil Alliances Workspace" migration
  console.log('2c. Testing legacy pre-existing "Delhi Civil Alliances Workspace" migration...');
  const legacyStorageData: WorkspaceState = {
    schemaVersion: 2,
    workspaceId: 'ws_delhi_coalitions',
    workspaceName: 'Delhi Civil Alliances Workspace',
    activeWorkbookId: WORKBOOK_DELHI_ID,
    entities: {},
    workbooks: {
      [WORKBOOK_DELHI_ID]: {
        workbookId: WORKBOOK_DELHI_ID,
        title: 'Delhi Youth Governance Exhibition',
        description: 'Legacy test workbook',
        targetBudgetInr: 10000000,
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    },
    placements: {},
    branches: {},
    workbookLinks: {},
  };
  globalThis.localStorage.setItem('qualcount_workspace_v1', JSON.stringify(legacyStorageData));
  globalThis.localStorage.setItem('qualcount_saved_workspaces_v1', JSON.stringify([legacyStorageData]));
  globalThis.localStorage.removeItem('qualcount_sample_deleted');

  await useWorkspaceStore.getState().init();
  const migratedWs = useWorkspaceStore.getState().workspace;
  assert.strictEqual(migratedWs?.workspaceName, 'Sample Workspace', 'Legacy Delhi workspace must be migrated to "Sample Workspace"');
  assert.strictEqual(migratedWs?.workspaceId, 'ws_sample_workspace', 'Legacy Delhi workspace ID must be migrated to "ws_sample_workspace"');
  assert.strictEqual(
    useWorkspaceStore.getState().savedWorkspaces[0]?.workspaceName,
    'Sample Workspace',
    'Saved workspaces list must also migrate legacy workspace to "Sample Workspace"'
  );
  assert.strictEqual(
    migratedWs?.workbooks[WORKBOOK_DELHI_ID]?.title,
    '[Sample] Delhi Youth Governance Exhibition',
    'Legacy Delhi workbook title must be normalized with [Sample]'
  );

  // Test switchWorkspace persistence
  console.log('2d. Testing switchWorkspace persistence across reloads...');
  const alphaId = await useWorkspaceStore.getState().createWorkspace('Alpha Project', 'Anchor NGO');
  assert.ok(alphaId);
  await useWorkspaceStore.getState().switchWorkspace('ws_sample_workspace');
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceId, 'ws_sample_workspace');
  // Verify switch was persisted to repository
  const repoWs = await (await import('../src/storage')).getWorkspaceRepository().loadWorkspace();
  assert.strictEqual(repoWs?.workspaceId, 'ws_sample_workspace', 'switchWorkspace must persist the switched workspace to storage');

  // Clean up Alpha Project
  await useWorkspaceStore.getState().deleteWorkspace(alphaId);
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceId, 'ws_sample_workspace');

  // Test 2e: Custom workspace containing "delhi" in its title is preserved when Sample Workspace is deleted
  console.log('2e. Testing preservation of custom workspace named "South Delhi Slum Education"...');
  await useWorkspaceStore.getState().createWorkspace('South Delhi Slum Education', 'Education Lead');
  assert.strictEqual(useWorkspaceStore.getState().workspace?.workspaceName, 'South Delhi Slum Education');
  await useWorkspaceStore.getState().deleteWorkspace('ws_sample_workspace');
  const savedAfterSampleDel = useWorkspaceStore.getState().savedWorkspaces;
  assert.ok(
    savedAfterSampleDel.some((w) => w.workspaceName === 'South Delhi Slum Education'),
    'South Delhi Slum Education must not be deleted when sample workspace is deleted'
  );
  await useWorkspaceStore.getState().init();
  const savedAfterInitReload = useWorkspaceStore.getState().savedWorkspaces;
  assert.ok(
    savedAfterInitReload.some((w) => w.workspaceName === 'South Delhi Slum Education'),
    'South Delhi Slum Education must persist across init reloads'
  );
  assert.strictEqual(
    useWorkspaceStore.getState().workspace?.workspaceName,
    'South Delhi Slum Education',
    'Active workspace must remain South Delhi Slum Education without phantom New Workspace injection'
  );

  // Restore Sample Workspace for remaining tests
  await useWorkspaceStore.getState().resetToDelhiSeed();

  console.log('✓ Complete deletion, legacy migration, substring safety, and persistence of Sample Workspace verified.');

  // 3. Connected Tree Filtering Algorithm
  console.log('3. Testing computeConnectedTree and filterToConnectedNodes...');
  const sampleBranches: Branch[] = [
    {
      branchId: 'b1',
      sourcePlacementId: 'p_root',
      targetPlacementId: 'p_museum',
      type: 'white',
      status: 'tick',
      note: 'direct',
      updatedAt: '',
    },
    {
      branchId: 'b2',
      sourcePlacementId: 'p_museum',
      targetPlacementId: 'p_food',
      type: 'yellow',
      status: 'tick',
      note: 'bridge',
      updatedAt: '',
    },
    {
      branchId: 'b3',
      sourcePlacementId: 'p_food',
      targetPlacementId: 'p_sports',
      type: 'white',
      status: 'tick',
      note: 'working',
      updatedAt: '',
    },
    {
      branchId: 'b4',
      sourcePlacementId: 'p_isolated_org',
      targetPlacementId: 'p_isolated_target',
      type: 'white',
      status: 'tick',
      note: 'isolated island',
      updatedAt: '',
    },
  ];

  // Seed with p_museum: should reach p_root, p_food, and p_sports (4 total), but NOT isolated island
  const reached = computeConnectedTree(['p_museum'], sampleBranches);
  assert.strictEqual(reached.size, 4);
  assert.ok(reached.has('p_root'));
  assert.ok(reached.has('p_museum'));
  assert.ok(reached.has('p_food'));
  assert.ok(reached.has('p_sports'));
  assert.ok(!reached.has('p_isolated_org'));
  assert.ok(!reached.has('p_isolated_target'));

  // Test store action filterToConnectedNodes
  useWorkspaceStore.getState().filterToConnectedNodes(['plc-museum']);
  assert.deepStrictEqual(useWorkspaceStore.getState().filters.connectedToPlacementIds, ['plc-museum']);
  useWorkspaceStore.getState().filterToConnectedNodes([]);
  assert.deepStrictEqual(useWorkspaceStore.getState().filters.connectedToPlacementIds, []);
  console.log('✓ Connected tree filtering algorithm verified.');

  // 4. Macro-Map Scoping (Single Workbook, Single Workspace, Multi-Workspace)
  console.log('4. Testing OverviewMacroMap multi-workspace and single-workbook graph derivation...');
  const wsA: WorkspaceState = JSON.parse(JSON.stringify(seedDelhiNgoWorkspace));
  const wsB: WorkspaceState = {
    schemaVersion: 1,
    workspaceId: 'ws_gujarat_kutch',
    workspaceName: 'Kutch Preservation Alliance',
    activeWorkbookId: 'wb_kutch_crafts',
    workbooks: {
      wb_kutch_crafts: {
        workbookId: 'wb_kutch_crafts',
        title: 'Kutch Artisan Network',
        description: 'Rural handicrafts',
        targetBudgetInr: 12000000,
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    },
    entities: {
      'ent-city-museum': {
        entityId: 'ent-city-museum',
        name: 'City Museum',
        category: 'institution',
        globalNotes: '',
        createdAt: '',
      },
    },
    placements: {
      plc_kutch_museum: {
        placementId: 'plc_kutch_museum',
        workbookId: 'wb_kutch_crafts',
        entityId: 'ent-city-museum',
        isRootNgo: false,
        x: 100,
        y: 100,
        width: 240,
        height: 160,
      },
    },
    branches: {},
    workbookLinks: {},
  };

  // Compute macro graph across both workspaces
  const multiGraph = computeMultiWorkspaceMacroGraph([wsA, wsB]);
  assert.strictEqual(multiGraph.nodes.length, 2, 'Should contain 2 workbooks across 2 workspaces');
  const sharedEdge = multiGraph.edges.find((e) => e.sharedEntityCount > 0);
  assert.ok(sharedEdge, 'Must detect shared City Museum between Delhi and Kutch');
  assert.strictEqual(sharedEdge.sharedEntityNames[0], 'City Museum');

  // Compute macro graph for ONLY single workbook (without neighbors)
  const singleWbGraph = computeMultiWorkspaceMacroGraph([wsA, wsB], 'wb_kutch_crafts', false);
  assert.strictEqual(singleWbGraph.nodes.length, 1);
  assert.strictEqual(singleWbGraph.nodes[0].workbookId, 'wb_kutch_crafts');
  assert.strictEqual(singleWbGraph.edges.length, 0);

  // Compute macro graph for single workbook WITH neighbors
  const neighborGraph = computeMultiWorkspaceMacroGraph([wsA, wsB], 'wb_kutch_crafts', true);
  assert.strictEqual(neighborGraph.nodes.length, 2);
  assert.strictEqual(neighborGraph.edges.length, 1);
  console.log('✓ Macro-map scoping and multi-workspace derivation verified.');

  // 5. Performance benchmark for O(N + M) derivation on large graph
  console.log('5. Benchmarking metrics computation on 500-node, 1000-branch graph...');
  const largePlacements: Record<string, any> = {};
  const largeBranches: Record<string, any> = {};
  const largeEntities: Record<string, any> = {};

  const N = 500;
  for (let i = 0; i < N; i++) {
    const id = `plc_perf_${i}`;
    const entId = `ent_perf_${i}`;
    largeEntities[entId] = { entityId: entId, name: `Org ${i}`, category: 'ngo', globalNotes: '', createdAt: '' };
    largePlacements[id] = {
      placementId: id,
      workbookId: 'wb_perf',
      entityId: entId,
      isRootNgo: i === 0,
      x: i * 10,
      y: i * 10,
      width: 240,
      height: 160,
    };
  }

  for (let i = 1; i < N; i++) {
    const bId = `br_perf_${i}`;
    largeBranches[bId] = {
      branchId: bId,
      workbookId: 'wb_perf',
      sourcePlacementId: `plc_perf_${Math.floor(i / 2)}`,
      targetPlacementId: `plc_perf_${i}`,
      type: i % 3 === 0 ? 'yellow' : i % 3 === 1 ? 'white' : 'green',
      status: 'tick',
      valuePct: 1,
      note: '',
      updatedAt: '',
    };
  }

  const largeWs: WorkspaceState = {
    schemaVersion: 1,
    activeWorkbookId: 'wb_perf',
    workbooks: {
      wb_perf: {
        workbookId: 'wb_perf',
        title: 'Large Performance Benchmark Initiative',
        description: 'Testing 500 nodes',
        targetBudgetInr: 100000000,
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    },
    entities: largeEntities,
    placements: largePlacements,
    branches: largeBranches,
    workbookLinks: {},
  };

  const start = performance.now();
  const perfMetrics = computeTopologyMetrics(largeWs, 'wb_perf');
  const duration = performance.now() - start;

  assert.ok(perfMetrics, 'Metrics must compute without throwing');
  assert.ok(duration < 25, `O(N+M) metrics computation must execute in <25ms (took ${duration.toFixed(2)}ms)`);
  console.log(`✓ Performance benchmark passed: 500 nodes / 1000 branches computed in ${duration.toFixed(2)}ms.`);

  console.log('\n=======================================================');
  console.log(' ALL WORKSPACE CRUD, FILTER & MACRO-MAP TESTS PASSED! ');
  console.log('=======================================================\n');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
