import assert from 'node:assert';
import { isWorkspaceState } from '../src/storage/workspaceRepository.ts';
import {
  seedDelhiNgoWorkspace,
  ENTITY_IDS,
  PLACEMENT_IDS,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo.ts';
import {
  getWorkspaceRepository,
  resetWorkspaceRepository,
  TauriSqliteRepository,
  LocalStorageRepository,
} from '../src/storage/index.ts';

console.log('--- Running QualCount Phase 1 Verification Suite ---');

// ---------------------------------------------------------------------------
// 1. DATA-01 & DATA-02: Seed Data Validation & Relational Schema
// ---------------------------------------------------------------------------
console.log('Testing seed dataset and schema structure...');

// Schema verification
assert.strictEqual(seedDelhiNgoWorkspace.schemaVersion, 1, 'Schema version must be 1');
assert.strictEqual(
  seedDelhiNgoWorkspace.activeWorkbookId,
  WORKBOOK_DELHI_ID,
  'Active workbook must match Delhi workbook ID'
);

// Entities check (11 total)
const entityKeys = Object.keys(seedDelhiNgoWorkspace.entities);
assert.strictEqual(entityKeys.length, 11, 'Seed dataset must contain exactly 11 entities');

// Placements check (11 total)
const placementKeys = Object.keys(seedDelhiNgoWorkspace.placements);
assert.strictEqual(placementKeys.length, 11, 'Seed dataset must contain exactly 11 placements');

// Root NGO check
const rootPlacements = Object.values(seedDelhiNgoWorkspace.placements).filter((p) => p.isRootNgo);
assert.strictEqual(rootPlacements.length, 1, 'Must have exactly one root NGO placement');
assert.strictEqual(rootPlacements[0].placementId, PLACEMENT_IDS.YOUR_NGO);
assert.strictEqual(rootPlacements[0].y, 650, 'Root NGO must sit at bottom (Tier 0, y=650)');

// Workbook target budget check
const workbook = seedDelhiNgoWorkspace.workbooks[WORKBOOK_DELHI_ID];
assert.ok(workbook, 'Delhi workbook must exist');
assert.strictEqual(workbook.targetBudgetInr, 1000000, 'Target budget must be 1,000,000 INR (10 Lakh)');
assert.strictEqual(workbook.status, 'active', 'Workbook status must be active');

// Branches check (15 total)
const branches = Object.values(seedDelhiNgoWorkspace.branches);
assert.strictEqual(branches.length, 15, 'Seed dataset must contain exactly 15 directed branches');

// Branch type distribution: 2 green, 3 white, 10 yellow (15 total)
const greenBranches = branches.filter((b) => b.type === 'green');
const whiteBranches = branches.filter((b) => b.type === 'white');
const yellowBranches = branches.filter((b) => b.type === 'yellow');
assert.strictEqual(greenBranches.length, 2, 'Must have exactly 2 green branches');
assert.strictEqual(whiteBranches.length, 3, 'Must have exactly 3 white branches');
assert.strictEqual(yellowBranches.length, 10, 'Must have exactly 10 yellow branches');

// Branch status distribution: 13 tick, 1 pending, 1 cross
const tickBranches = branches.filter((b) => b.status === 'tick');
const pendingBranches = branches.filter((b) => b.status === 'pending');
const crossBranches = branches.filter((b) => b.status === 'cross');
assert.strictEqual(tickBranches.length, 13, 'Must have 13 confirmed (tick) branches');
assert.strictEqual(pendingBranches.length, 1, 'Must have 1 pending branch');
assert.strictEqual(crossBranches.length, 1, 'Must have 1 declined (cross) branch');

// ValuePct verification on green branches
const b1 = seedDelhiNgoWorkspace.branches['br-1'];
const b2 = seedDelhiNgoWorkspace.branches['br-2'];
assert.strictEqual(b1.valuePct, 25, 'Branch br-1 must have valuePct = 25');
assert.strictEqual(b2.valuePct, 15, 'Branch br-2 must have valuePct = 15');

// Declined branch check (br-8 Dept of Social Security)
const b8 = seedDelhiNgoWorkspace.branches['br-8'];
assert.strictEqual(b8.status, 'cross', 'Branch br-8 must have cross status');
assert.strictEqual(b8.targetPlacementId, PLACEMENT_IDS.DEPT_SOCIAL_SECURITY);

// Triple-Thread incoming yellow branch check on Sports Dev Office
const sportsYellowIn = yellowBranches.filter(
  (b) => b.targetPlacementId === PLACEMENT_IDS.SPORTS_DEV_OFFICE && b.status === 'tick'
);
assert.strictEqual(sportsYellowIn.length, 3, 'Sports Dev Office must have exactly 3 confirmed yellow incoming branches');
const sportsSources = new Set(sportsYellowIn.map((b) => b.sourcePlacementId));
assert.ok(sportsSources.has(PLACEMENT_IDS.CITY_MUSEUM), 'Sports Dev source 1 must be City Museum');
assert.ok(sportsSources.has(PLACEMENT_IDS.YOUTH_DEV_OFFICE), 'Sports Dev source 2 must be Youth Dev Office');
assert.ok(sportsSources.has(PLACEMENT_IDS.CULTURAL_DEV_OFFICE), 'Sports Dev source 3 must be Cultural Dev Office');

// Bottom-to-top layout tier checking:
// Tier 0 (Root NGO): y = 650
// Tier 1: y = 450
// Tier 2: y = 250
// Tier 3: y = 50
assert.strictEqual(seedDelhiNgoWorkspace.placements[PLACEMENT_IDS.YOUR_NGO].y, 650);
assert.strictEqual(seedDelhiNgoWorkspace.placements[PLACEMENT_IDS.AGROCELL_CSR].y, 450);
assert.strictEqual(seedDelhiNgoWorkspace.placements[PLACEMENT_IDS.MINISTRY_FOOD].y, 250);
assert.strictEqual(seedDelhiNgoWorkspace.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE].y, 50);

// Multi-workbook hygiene: every placement and branch references the active workbook
for (const placement of Object.values(seedDelhiNgoWorkspace.placements)) {
  assert.strictEqual(placement.workbookId, WORKBOOK_DELHI_ID);
  assert.ok(seedDelhiNgoWorkspace.entities[placement.entityId], `Entity ${placement.entityId} must exist`);
}
for (const branch of Object.values(seedDelhiNgoWorkspace.branches)) {
  assert.strictEqual(branch.workbookId, WORKBOOK_DELHI_ID);
  assert.ok(seedDelhiNgoWorkspace.placements[branch.sourcePlacementId], `Source placement ${branch.sourcePlacementId} must exist`);
  assert.ok(seedDelhiNgoWorkspace.placements[branch.targetPlacementId], `Target placement ${branch.targetPlacementId} must exist`);
}

console.log('✓ DATA-01 & DATA-02: Seed dataset and relational schema validated.');

// ---------------------------------------------------------------------------
// 2. STOR-01 & STOR-02: Schema Validation Type Guard Edge Cases
// ---------------------------------------------------------------------------
console.log('Testing isWorkspaceState type guard edge cases...');

// Positive case
assert.strictEqual(isWorkspaceState(seedDelhiNgoWorkspace), true, 'Seed workspace must pass type guard');

// Edge cases & negative cases
assert.strictEqual(isWorkspaceState(null), false, 'null is rejected');
assert.strictEqual(isWorkspaceState(undefined), false, 'undefined is rejected');
assert.strictEqual(isWorkspaceState('string'), false, 'string is rejected');
assert.strictEqual(isWorkspaceState(123), false, 'number is rejected');
assert.strictEqual(isWorkspaceState([]), false, 'array is rejected');
assert.strictEqual(isWorkspaceState({}), false, 'empty object is rejected');

// Corrupted schemaVersion
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, schemaVersion: 2 }),
  false,
  'Non-1 schemaVersion is rejected'
);

// Empty or whitespace activeWorkbookId
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, activeWorkbookId: '' }),
  false,
  'Empty activeWorkbookId is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, activeWorkbookId: '   ' }),
  false,
  'Whitespace activeWorkbookId is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, activeWorkbookId: 123 }),
  false,
  'Non-string activeWorkbookId is rejected'
);

// Array in place of records
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, entities: [] }),
  false,
  'Array entities is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, placements: [] }),
  false,
  'Array placements is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, branches: null }),
  false,
  'null branches is rejected'
);

// Corrupted child entries within record dictionaries
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, entities: { 'ent-1': null } }),
  false,
  'null entity record is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, entities: { 'ent-1': 'invalid-primitive' } }),
  false,
  'string entity record is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, placements: { 'plc-1': null } }),
  false,
  'null placement record is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, branches: { 'br-1': 42 } }),
  false,
  'number branch record is rejected'
);
assert.strictEqual(
  isWorkspaceState({ ...seedDelhiNgoWorkspace, workbookLinks: { 'lnk-1': [] } }),
  false,
  'array workbook link record is rejected'
);

console.log('✓ STOR-01 & STOR-02: Type guard handles all edge cases correctly.');

// ---------------------------------------------------------------------------
// 3. STOR-01, STOR-02 & STOR-03: Repository Layer & Stubs
// ---------------------------------------------------------------------------
console.log('Testing storage repository layer and factory...');

// Tauri stub verification
const tauriRepo = new TauriSqliteRepository();
const tauriLoadResult = await tauriRepo.loadWorkspace();
assert.strictEqual(tauriLoadResult, null, 'Tauri stub loadWorkspace returns null in Phase 1');
const tauriImportResult = await tauriRepo.importWorkspaceFile();
assert.strictEqual(tauriImportResult, null, 'Tauri stub importWorkspaceFile returns null in Phase 1');
await tauriRepo.saveWorkspace(seedDelhiNgoWorkspace); // Should not crash
await tauriRepo.exportWorkspaceFile(seedDelhiNgoWorkspace); // Should not crash

// Environment-aware factory: Default environment
resetWorkspaceRepository();
const defaultRepo = getWorkspaceRepository();
assert.ok(defaultRepo instanceof LocalStorageRepository, 'Default environment repository is LocalStorageRepository');

// Environment-aware factory: Tauri detection
(globalThis as unknown as { window: { __TAURI_INTERNALS__: Record<string, unknown> } }).window = {
  __TAURI_INTERNALS__: {},
};
resetWorkspaceRepository();
const tauriDetectedRepo = getWorkspaceRepository();
assert.ok(tauriDetectedRepo instanceof TauriSqliteRepository, 'Tauri environment returns TauriSqliteRepository');

// Clean up window polyfill
delete (globalThis as unknown as { window?: unknown }).window;
resetWorkspaceRepository();

// Mock localStorage to verify LocalStorageRepository roundtrip in Node
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

// Polyfill global localStorage for the roundtrip test
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = new MockLocalStorage();

const localRepo = new LocalStorageRepository();
// Initial load from empty storage
const initialLoad = await localRepo.loadWorkspace();
assert.strictEqual(initialLoad, null, 'Empty storage returns null');

// Save workspace
await localRepo.saveWorkspace(seedDelhiNgoWorkspace);

// Load saved workspace
const reloaded = await localRepo.loadWorkspace();
assert.ok(reloaded !== null, 'Reloaded state must not be null');
assert.strictEqual(reloaded.schemaVersion, 1);
assert.strictEqual(reloaded.activeWorkbookId, WORKBOOK_DELHI_ID);
assert.strictEqual(Object.keys(reloaded.entities).length, 11);
assert.strictEqual(Object.keys(reloaded.placements).length, 11);
assert.strictEqual(Object.keys(reloaded.branches).length, 15);

// Test corrupt JSON in localStorage
globalThis.localStorage.setItem('qualcount_workspace_v1', '{ invalid json ');
const corruptLoad = await localRepo.loadWorkspace();
assert.strictEqual(corruptLoad, null, 'Corrupt JSON returns null gracefully without throwing');

// Test invalid schema in localStorage
globalThis.localStorage.setItem('qualcount_workspace_v1', JSON.stringify({ schemaVersion: 99 }));
const invalidSchemaLoad = await localRepo.loadWorkspace();
assert.strictEqual(invalidSchemaLoad, null, 'Invalid schema returns null gracefully without throwing');

// Test quota exceeded propagation on saveWorkspace
const faultyStorage = new MockLocalStorage();
faultyStorage.setItem = () => {
  throw new Error('QuotaExceededError');
};
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = faultyStorage;
await assert.rejects(
  async () => {
    await localRepo.saveWorkspace(seedDelhiNgoWorkspace);
  },
  /QuotaExceededError/,
  'QuotaExceededError must bubble up to caller'
);

// Restore valid mock storage
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = new MockLocalStorage();

console.log('✓ STOR-01, STOR-02 & STOR-03: Repository contracts and storage handling validated.');

// ---------------------------------------------------------------------------
// 4. File Export & Import (DOM Polyfill Simulation)
// ---------------------------------------------------------------------------
console.log('Testing exportWorkspaceFile and importWorkspaceFile DOM handlers...');

// Minimal in-memory DOM mocks
interface MockElement {
  type?: string;
  accept?: string;
  href?: string;
  download?: string;
  style: Record<string, string>;
  files?: Array<{ content: string; name: string }>;
  parentNode?: { removeChild: (child: MockElement) => void } | null;
  click: () => void;
  onchange?: () => void;
  oncancel?: () => void;
}

let clickedElements: MockElement[] = [];
let appendedElements: MockElement[] = [];
let revokedUrls: string[] = [];
let createdUrls: string[] = [];

class MockBlob {
  content: string[];
  options?: { type?: string };
  constructor(content: string[], options?: { type?: string }) {
    this.content = content;
    this.options = options;
  }
}

class MockFileReader {
  onload?: (e: { target: { result: string } }) => void;
  onerror?: () => void;
  error?: Error;
  readAsText(file: { content: string }): void {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: file.content } });
      }
    }, 10);
  }
}

const mockDocument = {
  createElement(tag: string): MockElement {
    const el: MockElement = {
      style: {},
      click: () => {
        clickedElements.push(el);
      },
      parentNode: null,
    };
    return el;
  },
  body: {
    appendChild(el: MockElement): void {
      appendedElements.push(el);
      el.parentNode = mockDocument.body;
    },
    removeChild(el: MockElement): void {
      el.parentNode = null;
    },
  },
};

const mockWindow = {
  addEventListener(_event: string, _fn: () => void, _opts?: unknown) {},
  removeEventListener(_event: string, _fn: () => void) {},
};

(globalThis as unknown as { document: typeof mockDocument }).document = mockDocument;
(globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;
(globalThis as unknown as { Blob: typeof MockBlob }).Blob = MockBlob as unknown as typeof Blob;
(globalThis as unknown as { FileReader: typeof MockFileReader }).FileReader = MockFileReader as unknown as typeof FileReader;
(globalThis as unknown as { URL: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void } }).URL = {
  createObjectURL: (blob: unknown) => {
    const u = `blob:mock-${createdUrls.length}`;
    createdUrls.push(u);
    return u;
  },
  revokeObjectURL: (url: string) => {
    revokedUrls.push(url);
  },
};

// 4a. Test exportWorkspaceFile
clickedElements = [];
await localRepo.exportWorkspaceFile(seedDelhiNgoWorkspace);
assert.strictEqual(clickedElements.length, 1, 'exportWorkspaceFile triggered a link click');
assert.ok(clickedElements[0].download?.startsWith('qualcount-workspace-'), 'download filename prefix is correct');
assert.ok(clickedElements[0].href?.startsWith('blob:mock-'), 'blob href set correctly');

// Wait for deferred URL revocation
await new Promise((r) => setTimeout(r, 1100));
assert.ok(revokedUrls.length > 0, 'Blob URL was cleanly revoked after export');

// 4b. Test importWorkspaceFile with valid file
let activeInputElement: MockElement | null = null;
const originalCreateElement = mockDocument.createElement;
mockDocument.createElement = (tag: string) => {
  const el = originalCreateElement(tag);
  if (tag === 'input') {
    activeInputElement = el;
    el.click = () => {
      // Simulate file selection
      setTimeout(() => {
        el.files = [{ content: JSON.stringify(seedDelhiNgoWorkspace), name: 'workspace.json' }];
        el.onchange?.();
      }, 5);
    };
  }
  return el;
};

const importedState = await localRepo.importWorkspaceFile();
assert.ok(importedState !== null, 'Imported state must not be null');
assert.strictEqual(importedState.schemaVersion, 1);
assert.strictEqual(importedState.activeWorkbookId, WORKBOOK_DELHI_ID);
assert.strictEqual(Object.keys(importedState.entities).length, 11);

// 4c. Test importWorkspaceFile when user cancels dialog (oncancel)
mockDocument.createElement = (tag: string) => {
  const el = originalCreateElement(tag);
  if (tag === 'input') {
    el.click = () => {
      setTimeout(() => {
        el.oncancel?.();
      }, 5);
    };
  }
  return el;
};
const cancelledResult = await localRepo.importWorkspaceFile();
assert.strictEqual(cancelledResult, null, 'User cancellation via oncancel resolves to null');

// 4d. Test importWorkspaceFile when file contains corrupted JSON
mockDocument.createElement = (tag: string) => {
  const el = originalCreateElement(tag);
  if (tag === 'input') {
    el.click = () => {
      setTimeout(() => {
        el.files = [{ content: '{ corrupt json ', name: 'bad.json' }];
        el.onchange?.();
      }, 5);
    };
  }
  return el;
};
const corruptImportResult = await localRepo.importWorkspaceFile();
assert.strictEqual(corruptImportResult, null, 'Corrupt JSON file resolves to null');

// 4e. Test importWorkspaceFile when file schema is invalid
mockDocument.createElement = (tag: string) => {
  const el = originalCreateElement(tag);
  if (tag === 'input') {
    el.click = () => {
      setTimeout(() => {
        el.files = [{ content: JSON.stringify({ schemaVersion: 99 }), name: 'invalid-schema.json' }];
        el.onchange?.();
      }, 5);
    };
  }
  return el;
};
const invalidSchemaImportResult = await localRepo.importWorkspaceFile();
assert.strictEqual(invalidSchemaImportResult, null, 'Invalid schema JSON resolves to null');

// Clean up DOM polyfills
delete (globalThis as unknown as { document?: unknown }).document;
delete (globalThis as unknown as { window?: unknown }).window;
delete (globalThis as unknown as { FileReader?: unknown }).FileReader;

console.log('✓ File Export & Import: DOM operations, FileReader lifecycle, and cancel fallbacks validated.');

console.log('\n--- ALL PHASE 1 CHECKS PASSED (100% SUCCESS) ---');
