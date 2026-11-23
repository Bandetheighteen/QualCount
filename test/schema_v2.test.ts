import assert from 'node:assert';
import {
  migrateToSchemaV2,
  DEFAULT_UTILITY_WEIGHTS,
  DEFAULT_CO_OWNERSHIP_SIGNALS,
  type WorkspaceState,
} from '../src/types/schema';
import {
  seedDelhiNgoWorkspace,
  seedDelhiNgoWorkspaceV2,
  PLACEMENT_IDS,
  ENTITY_IDS,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo';

console.log('--- Running QualCount Schema V2 & Migration Test Suite ---');

// 1. Auto-migration test from legacy v1 object
console.log('1. Testing legacy v1 migration to Schema V2...');
const legacyV1State: any = {
  schemaVersion: 1,
  activeWorkbookId: 'wb-legacy-test',
  entities: {
    'ent-legacy-1': {
      entityId: 'ent-legacy-1',
      name: 'Legacy Partner',
      category: 'ngo',
      globalNotes: 'Notes from v1',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
  workbooks: {
    'wb-legacy-test': {
      workbookId: 'wb-legacy-test',
      title: 'Legacy Workbook',
      description: 'A v1 workbook without v2 attributes',
      targetBudgetInr: 500000,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
  placements: {
    'plc-legacy-1': {
      placementId: 'plc-legacy-1',
      workbookId: 'wb-legacy-test',
      entityId: 'ent-legacy-1',
      isRootNgo: false,
      x: 100,
      y: 200,
      width: 190,
      height: 76,
    },
  },
  branches: {
    'br-legacy-1': {
      branchId: 'br-legacy-1',
      workbookId: 'wb-legacy-test',
      sourcePlacementId: 'plc-root',
      targetPlacementId: 'plc-legacy-1',
      type: 'white',
      status: 'pending',
      note: 'Legacy branch without resolvedAt',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
  workbookLinks: {},
};

const migrated = migrateToSchemaV2(legacyV1State);

assert.strictEqual(migrated.schemaVersion, 2, 'Migrated state must have schemaVersion = 2');
assert.strictEqual(migrated.activeWorkbookId, 'wb-legacy-test');

// Placements must receive default Public Choice attributes
const p1 = migrated.placements['plc-legacy-1'];
assert.ok(p1, 'Placement must exist in migrated state');
assert.strictEqual(p1.outreachAttempts, 1, 'Default outreachAttempts must be 1');
assert.deepStrictEqual(p1.selectiveIncentives, [], 'Default selectiveIncentives must be empty array');
assert.deepStrictEqual(p1.coOwnershipSignals, DEFAULT_CO_OWNERSHIP_SIGNALS, 'Default co-ownership signals must all be false');

// Workbooks must receive default utility strategy weights
const wb = migrated.workbooks['wb-legacy-test'];
assert.ok(wb, 'Workbook must exist in migrated state');
assert.deepStrictEqual(wb.utilityWeights, DEFAULT_UTILITY_WEIGHTS, 'Workbook must receive default balanced weights');

console.log('✓ Legacy v1 migration passed with all defaults successfully populated.');

// 2. Delhi Seed Dataset Schema V2 Conformance
console.log('2. Testing Delhi seed dataset under Schema V2...');
const v2State = seedDelhiNgoWorkspaceV2;

assert.strictEqual(v2State.schemaVersion, 2, 'V2 state must have schemaVersion = 2');
assert.strictEqual(v2State.activeWorkbookId, WORKBOOK_DELHI_ID);

// Verify City Museum Public Choice attributes
const museumPlacement = v2State.placements[PLACEMENT_IDS.CITY_MUSEUM];
assert.ok(museumPlacement, 'City Museum placement must exist');
assert.strictEqual(museumPlacement.outreachAttempts, 3, 'City Museum outreach attempts must be 3');
assert.ok(
  museumPlacement.selectiveIncentives?.includes('institutional_mandate'),
  'City Museum must have institutional_mandate tag'
);
assert.ok(
  museumPlacement.selectiveIncentives?.includes('brand_visibility'),
  'City Museum must have brand_visibility tag'
);
assert.ok(
  museumPlacement.selectiveIncentives?.includes('asset_activation'),
  'City Museum must have asset_activation tag'
);
assert.strictEqual(
  museumPlacement.coOwnershipSignals?.writtenCommitment,
  true,
  'City Museum writtenCommitment must be true'
);
assert.strictEqual(
  museumPlacement.coOwnershipSignals?.brandOrLogoShared,
  true,
  'City Museum brandOrLogoShared must be true'
);
assert.strictEqual(
  museumPlacement.coOwnershipSignals?.staffAssigned,
  true,
  'City Museum staffAssigned must be true'
);
assert.strictEqual(
  museumPlacement.coOwnershipSignals?.networkMobilized,
  true,
  'City Museum networkMobilized must be true'
);

// Verify In-Kind branch attribute on City Museum
const museumBranch = v2State.branches['br-6'];
assert.ok(museumBranch, 'Branch br-6 must exist');
assert.strictEqual(museumBranch.inKindValueInr, 750000, 'br-6 in-kind value must be 750,000 INR');
assert.ok(museumBranch.resolvedAt, 'br-6 must have resolvedAt timestamp');

// Verify Sports Dev Office co-ownership & outreach
const sportsPlacement = v2State.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(sportsPlacement.outreachAttempts, 4);
assert.strictEqual(sportsPlacement.coOwnershipSignals?.networkMobilized, true);

console.log('✓ Delhi seed dataset conforms strictly to Schema Version 2.');
console.log('--- ALL SCHEMA V2 TESTS PASSED (100%) ---');
