import assert from 'node:assert';
import { seedDelhiNgoWorkspace } from '../src/data/seedDelhiNgo';
import {
  serializeWorkspaceToFolder,
  deserializeFolderToWorkspace,
  exportWorkspaceBundle,
  importWorkspaceBundle,
  type WorkspaceFolderBundle,
} from '../src/storage/folderSerializer';
import {
  FolderWorkspaceRepository,
  MemoryOrLocalStorageBackend,
} from '../src/storage/folderWorkspaceRepository';
import type { WorkspaceState, Workbook } from '../src/types/schema';

console.log('--- Running QualCount Portable Folder Storage & Serialization Test Suite ---');

async function runFolderStorageSuite() {
  const seedState = seedDelhiNgoWorkspace;
  const seedActiveWb = seedState.activeWorkbookId;

  // 1. Serialization test
  console.log('1. Testing serialization of WorkspaceState to portable folder structure...');
  const folder = serializeWorkspaceToFolder(seedState);

  assert.strictEqual(folder.manifest.schemaVersion, 2, 'Manifest must have schemaVersion 2');
  assert.ok(folder.manifest.workspaceId, 'Manifest must have workspaceId');
  assert.ok(folder.manifest.name, 'Manifest must have workspace name');
  assert.ok(folder.manifest.workbooks[seedActiveWb], 'Manifest must list active workbook');

  assert.strictEqual(folder.entitiesFile.schemaVersion, 2, 'Entities file must have schemaVersion 2');
  assert.strictEqual(
    Object.keys(folder.entitiesFile.entities).length,
    Object.keys(seedState.entities).length,
    'Entities count must match exactly'
  );

  assert.ok(folder.workbookFiles[seedActiveWb], 'Workbook file must exist for seed workbook');
  const wbFile = folder.workbookFiles[seedActiveWb];
  assert.strictEqual(wbFile.schemaVersion, 2, 'Workbook file must have schemaVersion 2');
  assert.strictEqual(
    Object.keys(wbFile.placements).length,
    Object.keys(seedState.placements).length,
    'Placements count must match'
  );
  assert.strictEqual(
    Object.keys(wbFile.branches).length,
    Object.keys(seedState.branches).length,
    'Branches count must match'
  );
  console.log('✓ Serialization produced canonical workspace.json, entities.json, and workbooks/wb_*.json.');

  // 2. Roundtrip Deserialization test
  console.log('2. Testing roundtrip deserialization fidelity...');
  const roundtripState = deserializeFolderToWorkspace(
    folder.manifest,
    folder.entitiesFile,
    folder.workbookFiles
  );

  assert.strictEqual(roundtripState.schemaVersion, 2);
  assert.strictEqual(roundtripState.activeWorkbookId, seedActiveWb);
  assert.strictEqual(
    Object.keys(roundtripState.entities).length,
    Object.keys(seedState.entities).length
  );
  assert.strictEqual(
    Object.keys(roundtripState.workbooks).length,
    Object.keys(seedState.workbooks).length
  );
  assert.strictEqual(
    Object.keys(roundtripState.placements).length,
    Object.keys(seedState.placements).length
  );
  assert.strictEqual(
    Object.keys(roundtripState.branches).length,
    Object.keys(seedState.branches).length
  );

  // Spot-check deep placement properties
  for (const [id, originalPlc] of Object.entries(seedState.placements)) {
    const recoveredPlc = roundtripState.placements[id];
    assert.ok(recoveredPlc, `Placement ${id} must exist in roundtrip state`);
    assert.strictEqual(recoveredPlc.entityId, originalPlc.entityId);
    assert.strictEqual(recoveredPlc.isRootNgo, originalPlc.isRootNgo);
    assert.strictEqual(recoveredPlc.outreachAttempts, originalPlc.outreachAttempts);
  }
  console.log('✓ Roundtrip deserialization preserves 100% data fidelity.');

  // 3. Multi-Workbook Isolation test
  console.log('3. Testing multi-workbook placement and branch isolation...');
  const secondWbId = 'wb_mumbai_health';
  const secondWb: Workbook = {
    workbookId: secondWbId,
    title: 'Mumbai Health Coalition',
    description: 'Public health delivery network in Mumbai',
    targetBudgetInr: 25000000,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const multiWbState: WorkspaceState = {
    ...seedState,
    workbooks: {
      ...seedState.workbooks,
      [secondWbId]: secondWb,
    },
    placements: {
      ...seedState.placements,
      plc_mumbai_root: {
        placementId: 'plc_mumbai_root',
        workbookId: secondWbId,
        entityId: 'ent_delhi_trust', // Reusing an existing entity in a new workbook!
        isRootNgo: true,
        x: 100,
        y: 200,
        width: 190,
        height: 76,
      },
    },
  };

  const multiFolder = serializeWorkspaceToFolder(multiWbState);
  assert.strictEqual(Object.keys(multiFolder.workbookFiles).length, 2);
  assert.ok(multiFolder.workbookFiles[seedActiveWb]);
  assert.ok(multiFolder.workbookFiles[secondWbId]);
  assert.ok(!multiFolder.workbookFiles[seedActiveWb].placements['plc_mumbai_root'], 'Mumbai placement must not leak into Delhi workbook');
  assert.ok(multiFolder.workbookFiles[secondWbId].placements['plc_mumbai_root'], 'Mumbai placement must be in Mumbai workbook');

  const multiRecovered = deserializeFolderToWorkspace(
    multiFolder.manifest,
    multiFolder.entitiesFile,
    multiFolder.workbookFiles
  );
  assert.strictEqual(Object.keys(multiRecovered.workbooks).length, 2);
  assert.ok(multiRecovered.placements['plc_mumbai_root']);
  console.log('✓ Multi-workbook separation and placement scoping verified.');

  // 4. Bundle Export & Import (JSON string and format)
  console.log('4. Testing bundle export and import...');
  const bundleBlob = await exportWorkspaceBundle(multiWbState);
  assert.ok(bundleBlob instanceof Blob, 'Export must return a Blob');
  assert.strictEqual(bundleBlob.type, 'application/json;charset=utf-8');

  // Import from Blob
  const importedFromBlob = await importWorkspaceBundle(bundleBlob);
  assert.strictEqual(Object.keys(importedFromBlob.workbooks).length, 2);
  assert.ok(importedFromBlob.placements['plc_mumbai_root']);

  // Import from raw string
  const bundleText = await bundleBlob.text();
  const importedFromString = await importWorkspaceBundle(bundleText);
  assert.strictEqual(Object.keys(importedFromString.workbooks).length, 2);
  console.log('✓ Bundle packaging and roundtrip import verified.');

  // 5. FolderWorkspaceRepository & Snapshot lifecycle
  console.log('5. Testing FolderWorkspaceRepository backend and rolling snapshots...');
  const memBackend = new MemoryOrLocalStorageBackend('test_qualcount');
  const repo = new FolderWorkspaceRepository(memBackend);

  await repo.saveWorkspace(multiWbState);

  // Check that files were written
  const manifestContent = await memBackend.readFile('workspace.json');
  assert.ok(manifestContent, 'workspace.json must be written to backend');
  const entitiesContent = await memBackend.readFile('entities.json');
  assert.ok(entitiesContent, 'entities.json must be written to backend');
  const wbDelhiContent = await memBackend.readFile(`workbooks/wb_${seedActiveWb}.json`);
  assert.ok(wbDelhiContent, 'Delhi workbook must be written to backend');

  // Load through repo
  const loadedState = await repo.loadWorkspace();
  assert.ok(loadedState, 'Repository loadWorkspace must succeed');
  assert.strictEqual(loadedState?.activeWorkbookId, multiWbState.activeWorkbookId);

  // Test manual snapshot
  const snapshotPath = await repo.saveSnapshot(multiWbState, 'pre_audit');
  assert.ok(snapshotPath.startsWith('.snapshots/full_ws_'), 'Snapshot path must be under .snapshots/');

  const snapshotList = await repo.listSnapshots();
  assert.ok(snapshotList.length >= 1, 'Snapshots list must include saved snapshot');

  const snapshotRestored = await repo.loadSnapshot(snapshotPath);
  assert.ok(snapshotRestored, 'Restoring from snapshot must succeed');
  assert.strictEqual(Object.keys(snapshotRestored!.workbooks).length, 2);
  console.log('✓ FolderWorkspaceRepository persistence, snapshots, and recovery verified.');

  // 6. Test Workbook Deletion and Orphan File Pruning (No resurrection)
  console.log('6. Testing workbook deletion and orphan file pruning (no resurrection)...');
  const deletedSecondWbState: WorkspaceState = {
    ...multiWbState,
    workbooks: {
      [seedActiveWb]: multiWbState.workbooks[seedActiveWb],
    },
  };
  await repo.saveWorkspace(deletedSecondWbState);

  // Verify second workbook file was pruned
  const prunedWbContent = await memBackend.readFile(`workbooks/wb_${secondWbId}.json`);
  assert.strictEqual(prunedWbContent, null, 'Deleted workbook file must be pruned from backend');

  // Load through repo and verify second workbook is NOT resurrected
  const stateAfterDelete = await repo.loadWorkspace();
  assert.ok(stateAfterDelete);
  assert.strictEqual(
    Object.keys(stateAfterDelete.workbooks).length,
    1,
    'Deleted workbook must not be resurrected'
  );
  assert.strictEqual(stateAfterDelete.workbooks[secondWbId], undefined);
  console.log('✓ Deleted workbook cleanly pruned and not resurrected on load.');

  console.log('--- ALL PORTABLE FOLDER STORAGE TESTS PASSED (100%) ---');
}

runFolderStorageSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
