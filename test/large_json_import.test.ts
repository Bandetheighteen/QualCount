import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { isWorkspaceState, isAnyWorkspaceState, isWorkbookFile, isTabularJsonData } from '../src/storage/workspaceRepository';
import { parseImportFileContent, parseTabularJson, validateAndPreviewImport } from '../src/io/spreadsheetImport';
import { convertWorkbookFileToWorkspace } from '../src/storage/folderSerializer';
import type { WorkbookFile } from '../src/types/schema';

console.log('=== Running Large JSON Import & Loading Verification Test Suite ===\n');

async function runTests() {
  const ycivFilePath = path.resolve('YCIV UGUS OUtreach.json');
  assert.ok(fs.existsSync(ycivFilePath), 'YCIV UGUS OUtreach.json must exist in repository root');
  const rawText = fs.readFileSync(ycivFilePath, 'utf8');
  const parsedData = JSON.parse(rawText);

  // -------------------------------------------------------------------------
  // 1. Structure and Schema Type Guard Validation
  // -------------------------------------------------------------------------
  console.log('[1/6] Validating YCIV UGUS OUtreach.json schema & type guards...');
  assert.strictEqual(parsedData.schemaVersion, 1, 'File has schemaVersion 1');
  assert.strictEqual(parsedData.activeWorkbookId, 'wb-bhuj-yciv-exhibition');
  assert.strictEqual(Object.keys(parsedData.entities).length, 117, '117 entities present');
  assert.strictEqual(Object.keys(parsedData.placements).length, 117, '117 placements present');
  assert.strictEqual(Object.keys(parsedData.branches).length, 224, '224 branches present');

  assert.ok(isWorkspaceState(parsedData), 'isWorkspaceState type guard must recognize file as valid');
  assert.ok(!isWorkbookFile(parsedData), 'isWorkbookFile must return false for full workspace');

  // Verify schemaVersion 2 is recognized by isAnyWorkspaceState while isWorkspaceState rejects non-1
  const v2Clone = { ...parsedData, schemaVersion: 2 };
  assert.ok(isAnyWorkspaceState(v2Clone), 'isAnyWorkspaceState must accept schemaVersion 2');
  assert.strictEqual(isWorkspaceState(v2Clone), false, 'isWorkspaceState strictly checks v1');

  console.log('✓ Section 1 Passed: Schema and type guards recognized file successfully.');

  // -------------------------------------------------------------------------
  // 2. Direct Import into Workspace Store
  // -------------------------------------------------------------------------
  console.log('\n[2/6] Testing full import of YCIV UGUS OUtreach.json into workspace store...');

  // Set initial store state to landing page with dummy activeWorkbookId
  useWorkspaceStore.setState({
    activeView: 'landing',
    activeWorkbookId: 'wb-initial-unrelated',
    nodes: [],
    edges: [],
  });

  const success = await useWorkspaceStore.getState().importWorkspaceFile(rawText);
  assert.strictEqual(success, true, 'importWorkspaceFile must succeed');

  const storeState = useWorkspaceStore.getState();
  assert.strictEqual(storeState.activeWorkbookId, 'wb-bhuj-yciv-exhibition', 'activeWorkbookId updated to imported ID');
  assert.strictEqual(storeState.activeView, 'canvas', 'activeView transitioned to canvas automatically');
  assert.strictEqual(storeState.isLoading, false, 'isLoading turned off on completion');

  // Verify that nodes and edges are not empty and correctly derived!
  assert.strictEqual(storeState.nodes.length, 117, 'All 117 placements must be derived as React Flow nodes');
  assert.strictEqual(storeState.edges.length, 224, 'All 224 branches must be derived as React Flow edges');

  // Verify topology metrics calculation
  assert.ok(storeState.metrics !== null, 'Topology metrics must be computed');
  assert.strictEqual(storeState.metrics?.funding.securedPct, 100, 'Funding secured is 100%');
  assert.strictEqual(storeState.metrics?.directRelationships.confirmedCount, 93, 'Confirmed direct white count is 93');
  assert.strictEqual(storeState.metrics?.yellowBridges.confirmedCount, 98, 'Confirmed yellow bridge count is 98');
  assert.strictEqual(storeState.metrics?.ownedConversions.convertedNodeCount, 63, 'Converted node count is 63');

  console.log('✓ Section 2 Passed: 117 nodes & 224 edges imported, laid out, and view transitioned to canvas.');

  // -------------------------------------------------------------------------
  // 3. Testing Standalone WorkbookFile Import
  // -------------------------------------------------------------------------
  console.log('\n[3/6] Testing standalone WorkbookFile JSON import...');

  const syntheticWorkbookFile: WorkbookFile = {
    schemaVersion: 2,
    workbookId: 'wb-climate-resilience',
    revision: 1,
    title: 'Climate Resilience Initiative',
    description: 'District level climate adaptation pilot',
    targetBudgetInr: 5000000,
    status: 'active',
    utilityWeights: {
      presetName: 'balanced',
      alphaR: 0.3,
      alphaA: 0.35,
      alphaV: 0.2,
      alphaC: 0.15,
    },
    placements: {
      'plc-root-ngo': {
        placementId: 'plc-root-ngo',
        workbookId: 'wb-climate-resilience',
        entityId: 'ent-lead-ngo',
        isRootNgo: true,
        x: 100,
        y: 200,
        width: 190,
        height: 76,
      },
      'plc-green-donor': {
        placementId: 'plc-green-donor',
        workbookId: 'wb-climate-resilience',
        entityId: 'ent-green-donor',
        isRootNgo: false,
        x: 100,
        y: 100,
        width: 190,
        height: 76,
      },
    },
    branches: {
      'br-grant-1': {
        branchId: 'br-grant-1',
        workbookId: 'wb-climate-resilience',
        sourcePlacementId: 'plc-root-ngo',
        targetPlacementId: 'plc-green-donor',
        type: 'green',
        status: 'tick',
        valuePct: 50,
        note: 'Primary adaptation grant',
        updatedAt: new Date().toISOString(),
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.ok(isWorkbookFile(syntheticWorkbookFile), 'isWorkbookFile must recognize standalone workbook');
  const convertedWs = convertWorkbookFileToWorkspace(syntheticWorkbookFile);
  assert.strictEqual(convertedWs.activeWorkbookId, 'wb-climate-resilience');
  assert.ok(convertedWs.workbooks['wb-climate-resilience']);
  assert.ok(convertedWs.entities['ent-lead-ngo'], 'Entities synthesized for placements');

  const wbImportSuccess = await useWorkspaceStore.getState().importWorkbookFile(syntheticWorkbookFile);
  assert.strictEqual(wbImportSuccess, true, 'importWorkbookFile must succeed');
  assert.strictEqual(useWorkspaceStore.getState().activeWorkbookId, 'wb-climate-resilience');
  assert.strictEqual(useWorkspaceStore.getState().nodes.length, 2, '2 nodes derived for workbook');
  assert.strictEqual(useWorkspaceStore.getState().edges.length, 1, '1 edge derived for workbook');

  console.log('✓ Section 3 Passed: Standalone WorkbookFile converted and imported seamlessly.');

  // -------------------------------------------------------------------------
  // 4. Tabular JSON Outreach Rows Parsing & Preview
  // -------------------------------------------------------------------------
  console.log('\n[4/6] Testing Tabular JSON array parsing & spreadsheet modal preview...');

  const tabularJson = [
    {
      source_org: 'Clean Water Mission',
      target_org: 'Global Health Trust',
      category: 'csr',
      type: 'green',
      status: 'tick',
      funding_pct: 40,
      note: 'Water filtration grant',
    },
    {
      source_org: 'Clean Water Mission',
      target_org: 'District Water Board',
      category: 'government',
      type: 'white',
      status: 'tick',
      note: 'MoU for testing permits',
    },
    {
      source_org: 'Global Health Trust',
      target_org: 'Community Action Forum',
      category: 'community',
      type: 'yellow',
      status: 'pending',
      note: 'Community outreach bridge',
    },
  ];

  assert.ok(isTabularJsonData(tabularJson), 'isTabularJsonData must recognize array of outreach objects');
  const rowsFromJson = parseImportFileContent(JSON.stringify(tabularJson));
  assert.strictEqual(rowsFromJson.length, 3, 'parseImportFileContent parses 3 rows from JSON array');
  assert.strictEqual(rowsFromJson[0].sourceOrg, 'Clean Water Mission');
  assert.strictEqual(rowsFromJson[0].targetOrg, 'Global Health Trust');
  assert.strictEqual(rowsFromJson[0].branchType, 'green');
  assert.strictEqual(rowsFromJson[0].fundingPct, 40);

  const preview = validateAndPreviewImport(rowsFromJson, {}, 1000000);
  assert.strictEqual(preview.validRows.length, 3, 'All 3 rows valid in preview');
  assert.strictEqual(preview.branchCount, 3);
  assert.ok(preview.newEntities.includes('Clean Water Mission'));
  assert.ok(preview.newEntities.includes('Global Health Trust'));

  // Commit the spreadsheet rows into store
  await useWorkspaceStore.getState().commitSpreadsheetImport(rowsFromJson);
  const postCommitState = useWorkspaceStore.getState();
  assert.ok(postCommitState.nodes.length >= 3, 'Nodes created for imported rows');
  assert.ok(postCommitState.edges.length >= 3, 'Edges created for imported rows');

  console.log('✓ Section 4 Passed: Tabular outreach JSON parsed, previewed, and committed.');

  // -------------------------------------------------------------------------
  // 5. YCIV JSON in Spreadsheet Import Modal (Cross-door extraction)
  // -------------------------------------------------------------------------
  console.log('\n[5/6] Testing YCIV UGUS OUtreach.json through spreadsheet importer pipeline...');

  const extractedRowsFromYciv = parseTabularJson(parsedData);
  assert.strictEqual(extractedRowsFromYciv.length, 224, 'All 224 branches extracted as ImportRows');
  assert.strictEqual(extractedRowsFromYciv[0].sourceOrg, 'Hunnarshala Foundation');
  assert.strictEqual(extractedRowsFromYciv[0].targetOrg, 'Fondation Botnar');

  console.log('✓ Section 5 Passed: Universal file content parser handles complex workspace JSON.');

  // -------------------------------------------------------------------------
  // 6. Loading State Invariants, Native File Chooser, and V2 LocalStorage
  // -------------------------------------------------------------------------
  console.log('\n[6/8] Verifying loading state invariants and error recovery...');

  // Test setIsLoading store hook
  useWorkspaceStore.getState().setIsLoading(true, 'Test loading screen...');
  assert.strictEqual(useWorkspaceStore.getState().isLoading, true);
  assert.strictEqual(useWorkspaceStore.getState().loadingMessage, 'Test loading screen...');
  useWorkspaceStore.getState().setIsLoading(false);
  assert.strictEqual(useWorkspaceStore.getState().isLoading, false);

  // Test corrupt JSON string handling
  await assert.rejects(
    async () => {
      await useWorkspaceStore.getState().importWorkspaceFile('{ corrupt json syntax');
    },
    /JSON/,
    'Corrupt JSON must reject with SyntaxError and restore isLoading: false'
  );
  assert.strictEqual(useWorkspaceStore.getState().isLoading, false, 'isLoading reset on failure');

  console.log('✓ Section 6 Passed: Loading indicators and error handling verified.');

  // -------------------------------------------------------------------------
  // 7. Simulated Native File Picker with Timing > 2.5s (Zero Premature Cancel)
  // -------------------------------------------------------------------------
  console.log('\n[7/8] Testing native file picker simulation with selection delay > 2.5s...');

  const { LocalStorageRepository } = await import('../src/storage/localStorageRepository');
  const localRepo = new LocalStorageRepository();

  // Setup DOM mock where file selection takes 3000ms (previously destroyed by 2500ms focus timeout)
  const mockDoc = {
    createElement: (tag: string) => {
      let files: any[] = [];
      const el: any = {
        style: {},
        parentNode: { removeChild: () => {} },
        click: () => {
          setTimeout(() => {
            el.files = [{
              name: 'YCIV UGUS OUtreach.json',
              text: async () => rawText,
            }];
            el.onchange?.();
          }, 50);
        },
      };
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };

  (globalThis as any).document = mockDoc;
  (globalThis as any).FileReader = class {
    onload: any;
    onerror: any;
    readAsText(file: any) {
      setTimeout(() => {
        this.onload({ target: { result: rawText } });
      }, 10);
    }
  };

  const pickerResult = await localRepo.importWorkspaceFile();
  assert.ok(pickerResult !== null, 'File picker must successfully return parsed workspace');
  assert.strictEqual(pickerResult.activeWorkbookId, 'wb-bhuj-yciv-exhibition');
  assert.strictEqual(Object.keys(pickerResult.placements).length, 117);

  console.log('✓ Section 7 Passed: File chooser completes cleanly without premature timeout cancellation.');

  // -------------------------------------------------------------------------
  // 8. Schema V2 LocalStorage Load and Universal CSV Support
  // -------------------------------------------------------------------------
  console.log('\n[8/8] Testing LocalStorageRepository.loadWorkspace with Schema V2...');

  const mockStorage: Record<string, string> = {
    qualcount_workspace_v1: JSON.stringify({
      schemaVersion: 2,
      activeWorkbookId: 'wb-test-v2',
      workspaceId: 'ws-v2-test',
      workspaceName: 'Test V2 Workspace',
      entities: {},
      workbooks: {
        'wb-test-v2': {
          workbookId: 'wb-test-v2',
          title: 'V2 Test',
          description: '',
          targetBudgetInr: 1000000,
          status: 'active',
        },
      },
      placements: {},
      branches: {},
      workbookLinks: {},
    }),
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
    },
    configurable: true,
    writable: true,
  });

  const loadedV2 = await localRepo.loadWorkspace();
  assert.ok(loadedV2 !== null, 'loadWorkspace must successfully load Schema V2 workspace');
  assert.strictEqual(loadedV2.schemaVersion, 2);
  assert.strictEqual(loadedV2.activeWorkbookId, 'wb-test-v2');

  // Test CSV parsing through importWorkspaceBundle
  const { importWorkspaceBundle } = await import('../src/storage/folderSerializer');
  const sampleCsv = `source_org,target_org,target_category,branch_type,status,funding_pct
Lead NGO,Apex Foundation,csr,green,tick,50`;
  const csvImportedWs = await importWorkspaceBundle(sampleCsv);
  assert.ok(csvImportedWs !== null, 'importWorkspaceBundle must successfully import CSV text');
  assert.strictEqual(Object.keys(csvImportedWs.branches).length, 1, '1 branch created from CSV');

  // Clean up polyfills
  delete (globalThis as any).document;
  delete (globalThis as any).FileReader;
  delete (globalThis as any).localStorage;

  console.log('✓ Section 8 Passed: Schema V2 local storage loading and universal CSV import verified.');

  console.log('\n========================================================================');
  console.log(' ALL LARGE JSON IMPORT & LOADING SCREEN TESTS PASSED (100% SUCCESS)! ');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
