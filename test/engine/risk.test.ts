import assert from 'node:assert';
import { computeStructuralRiskReport } from '../../src/engine/risk';
import {
  seedDelhiNgoWorkspaceV2,
  PLACEMENT_IDS,
  ENTITY_IDS,
  WORKBOOK_DELHI_ID,
} from '../../src/data/seedDelhiNgo';
import type { RiskSeverity, Branch, Placement } from '../../src/types/schema';

console.log('--- Running Deterministic Structural Risk Engine Test Suite ---');

// 1. Delhi Seed Dataset Risk Assessment
console.log('1. Testing Layer 1 risk report on Delhi seed dataset...');
const ws = seedDelhiNgoWorkspaceV2;
const fixedNow = new Date('2026-11-20T10:00:00.000Z').getTime();
const riskReport = computeStructuralRiskReport(ws, ws.entities, fixedNow);

assert.ok(riskReport.aggregateTier, 'Must have aggregate risk tier');
assert.ok(
  ['low', 'moderate', 'elevated', 'critical'].includes(riskReport.aggregateTier),
  `Invalid aggregate tier: ${riskReport.aggregateTier}`
);
console.log(`  Delhi Seed Aggregate Structural Risk: ${riskReport.aggregateTier.toUpperCase()}`);

// Check all 6 parameters are present
const paramKeys = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'] as const;
for (const pKey of paramKeys) {
  const p = riskReport.parameters[pKey];
  assert.ok(p, `Parameter ${pKey} must exist in report`);
  assert.strictEqual(p.id, pKey);
  assert.ok(typeof p.score === 'number');
  assert.ok(typeof p.scoreFormatted === 'string');
  assert.ok(p.plainCommentary.length > 0);
  assert.ok(Array.isArray(p.offendingPlacementIds));
  assert.ok(Array.isArray(p.offendingBranchIds));
  console.log(`  [${pKey}] ${p.name}: ${p.scoreFormatted} (${p.severity})`);
}

// Check R1 (Single-Bridge Concentration)
const r1 = riskReport.parameters.R1;
assert.ok(r1.score >= 0 && r1.score <= 100);

// Check R2 (Unowned Dependency Exposure)
const r2 = riskReport.parameters.R2;
assert.ok(r2.score >= 0 && r2.score <= 100);

// Check R3 (Funding Concentration)
const r3 = riskReport.parameters.R3;
assert.ok(r3.score >= 0);

// Check all offending IDs are properly aggregated
assert.ok(Array.isArray(riskReport.allOffendingPlacementIds));
assert.ok(Array.isArray(riskReport.allOffendingBranchIds));

console.log('✓ Delhi seed Layer 1 parameters computed cleanly.');

// 2. Synthetic Test: Critical Single Donor Funding Concentration (R3)
console.log('2. Testing synthetic R3 Critical threshold (>65% single donor)...');
const donorStressWs = {
  ...ws,
  branches: {
    ...ws.branches,
    'br-stress-donor': {
      branchId: 'br-stress-donor',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: PLACEMENT_IDS.XYZ_CSR,
      type: 'green' as const,
      status: 'tick' as const,
      valuePct: 80, // Single donor accounts for 80% of cash
      note: 'Mega grant',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  },
};
const donorReport = computeStructuralRiskReport(donorStressWs, ws.entities, fixedNow);
assert.strictEqual(donorReport.parameters.R3.severity, 'critical');
assert.strictEqual(donorReport.aggregateTier, 'critical');
assert.ok(donorReport.parameters.R3.offendingPlacementIds.includes(PLACEMENT_IDS.XYZ_CSR));

console.log('✓ R3 Critical trigger and aggregate escalation verified.');

// 3. Synthetic Test: Rejection Cluster Signal (R6)
console.log('3. Testing synthetic R6 Category Rejection Cluster (>60% in single category with >=3 declines)...');
const clusterEntities = {
  ...ws.entities,
  'ent-comm-1': { entityId: 'ent-comm-1', name: 'Comm 1', category: 'community' as const, globalNotes: '', createdAt: '' },
  'ent-comm-2': { entityId: 'ent-comm-2', name: 'Comm 2', category: 'community' as const, globalNotes: '', createdAt: '' },
  'ent-comm-3': { entityId: 'ent-comm-3', name: 'Comm 3', category: 'community' as const, globalNotes: '', createdAt: '' },
};
const clusterPlacements = {
  ...ws.placements,
  'plc-comm-1': { placementId: 'plc-comm-1', entityId: 'ent-comm-1', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
  'plc-comm-2': { placementId: 'plc-comm-2', entityId: 'ent-comm-2', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
  'plc-comm-3': { placementId: 'plc-comm-3', entityId: 'ent-comm-3', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
};
const rejectionStressWs = {
  ...ws,
  placements: clusterPlacements,
  branches: {
    ...ws.branches,
    'br-rej-1': {
      branchId: 'br-rej-1',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-comm-1',
      type: 'white' as const,
      status: 'cross' as const,
      note: 'Declined by Comm 1',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    'br-rej-2': {
      branchId: 'br-rej-2',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-comm-2',
      type: 'white' as const,
      status: 'cross' as const,
      note: 'Declined by Comm 2',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    'br-rej-3': {
      branchId: 'br-rej-3',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-comm-3',
      type: 'white' as const,
      status: 'cross' as const,
      note: 'Declined by Comm 3',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  },
};
const rejReport = computeStructuralRiskReport(rejectionStressWs, clusterEntities, fixedNow);
assert.strictEqual(rejReport.parameters.R6.severity, 'critical');
assert.ok(rejReport.parameters.R6.plainCommentary.includes('community'));

console.log('✓ R6 Category rejection cluster detection verified.');

// 4. Synthetic Test: Public Choice Apathy Risk (R4)
console.log('4. Testing synthetic R4 Public Choice Apathy Risk (>60% cold pending)...');
const apathyEntities = {
  ...ws.entities,
  'ent-apathy-1': { entityId: 'ent-apathy-1', name: 'Cold Agency 1', category: 'government' as const, globalNotes: '', createdAt: '' },
  'ent-apathy-2': { entityId: 'ent-apathy-2', name: 'Cold Agency 2', category: 'government' as const, globalNotes: '', createdAt: '' },
  'ent-apathy-3': { entityId: 'ent-apathy-3', name: 'Cold Agency 3', category: 'government' as const, globalNotes: '', createdAt: '' },
};
const apathyPlacements = {
  ...ws.placements,
  'plc-apathy-1': { placementId: 'plc-apathy-1', entityId: 'ent-apathy-1', isRootNgo: false, x: 0, y: 0, width: 190, height: 76, selectiveIncentives: [] },
  'plc-apathy-2': { placementId: 'plc-apathy-2', entityId: 'ent-apathy-2', isRootNgo: false, x: 0, y: 0, width: 190, height: 76, selectiveIncentives: [] },
  'plc-apathy-3': { placementId: 'plc-apathy-3', entityId: 'ent-apathy-3', isRootNgo: false, x: 0, y: 0, width: 190, height: 76, selectiveIncentives: [] },
};
const apathyStressWs = {
  ...ws,
  placements: apathyPlacements,
  branches: {
    ...ws.branches,
    'br-apathy-1': {
      branchId: 'br-apathy-1',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-apathy-1',
      type: 'white' as const,
      status: 'pending' as const,
      note: 'Cold pitch 1',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    'br-apathy-2': {
      branchId: 'br-apathy-2',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-apathy-2',
      type: 'white' as const,
      status: 'pending' as const,
      note: 'Cold pitch 2',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    'br-apathy-3': {
      branchId: 'br-apathy-3',
      sourcePlacementId: PLACEMENT_IDS.YOUR_NGO,
      targetPlacementId: 'plc-apathy-3',
      type: 'white' as const,
      status: 'pending' as const,
      note: 'Cold pitch 3',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  },
};
const apathyReport = computeStructuralRiskReport(apathyStressWs, apathyEntities, fixedNow);
assert.ok(apathyReport.parameters.R4.score > 50, `R4 score should be > 50% (got ${apathyReport.parameters.R4.score})`);
assert.ok(['elevated', 'critical'].includes(apathyReport.parameters.R4.severity));
assert.ok(apathyReport.parameters.R4.offendingPlacementIds.includes('plc-apathy-1'));
assert.ok(apathyReport.parameters.R4.offendingPlacementIds.includes('plc-apathy-2'));
assert.ok(apathyReport.parameters.R4.offendingPlacementIds.includes('plc-apathy-3'));
console.log(`✓ R4 Apathy detection verified: score = ${apathyReport.parameters.R4.scoreFormatted}, severity = ${apathyReport.parameters.R4.severity}`);

// 5. Edge Cases: Empty Workspace & Disconnected Nodes
console.log('5. Testing risk engine edge cases (empty workspace, single node)...');
const emptyWs = {
  placements: {
    'plc-root': {
      placementId: 'plc-root',
      entityId: 'ent-root',
      isRootNgo: true,
      x: 0,
      y: 0,
      width: 190,
      height: 76,
    },
  },
  branches: {},
};
const emptyReport = computeStructuralRiskReport(emptyWs, {}, fixedNow);
assert.strictEqual(emptyReport.parameters.R1.severity, 'low');
assert.strictEqual(emptyReport.parameters.R2.severity, 'low');
assert.strictEqual(emptyReport.parameters.R4.severity, 'low');
assert.strictEqual(emptyReport.parameters.R5.severity, 'low');
assert.strictEqual(emptyReport.parameters.R6.severity, 'low');

console.log('✓ Risk edge cases handled cleanly.');
console.log('--- ALL DETERMINISTIC STRUCTURAL RISK TESTS PASSED (100%) ---');
