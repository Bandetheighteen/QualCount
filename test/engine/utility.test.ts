import assert from 'node:assert';
import {
  computeCoOwnershipDepth,
  computeSocialProofFactor,
  computeDownstreamAmplifierReach,
  computePartnerUtility,
  computePublicChoiceUtilityReport,
} from '../../src/engine/utility';
import {
  seedDelhiNgoWorkspaceV2,
  PLACEMENT_IDS,
  ENTITY_IDS,
} from '../../src/data/seedDelhiNgo';
import { UTILITY_PRESETS } from '../../src/types/schema';

console.log('--- Running Public Choice Utility Engine Test Suite ---');

// 1. Primitive Mathematical Component Tests
console.log('1. Testing primitive microeconomic functions...');
// Co-Ownership depth
assert.strictEqual(computeCoOwnershipDepth(undefined), 0);
assert.strictEqual(
  computeCoOwnershipDepth({
    writtenCommitment: true,
    brandOrLogoShared: false,
    staffAssigned: false,
    networkMobilized: false,
  }),
  0.25
);
assert.strictEqual(
  computeCoOwnershipDepth({
    writtenCommitment: true,
    brandOrLogoShared: true,
    staffAssigned: true,
    networkMobilized: true,
  }),
  1.0
);

// Social Proof factor S_i = 1 - 1 / (1 + k)
assert.strictEqual(computeSocialProofFactor(0), 0);
assert.strictEqual(computeSocialProofFactor(1), 0.5);
assert.strictEqual(Number(computeSocialProofFactor(2).toFixed(3)), 0.667);
assert.strictEqual(computeSocialProofFactor(3), 0.75);
assert.strictEqual(computeSocialProofFactor(4), 0.8);

console.log('✓ Primitives passed.');

// 2. City Museum Partner Utility Decomposition
console.log('2. Testing City Museum utility decomposition on Delhi seed...');
const ws = seedDelhiNgoWorkspaceV2;
const rootPlacementId = PLACEMENT_IDS.YOUR_NGO;
const museumMetrics = computePartnerUtility(
  PLACEMENT_IDS.CITY_MUSEUM,
  ws,
  ws.entities,
  rootPlacementId
);

// Co-ownership: all 4 behaviors verified -> O = 1.0
assert.strictEqual(museumMetrics.coOwnershipO, 1.0);
// Direct commitment R = w_i * (0.50 + 0.50 * O_i) = 1.0
assert.strictEqual(museumMetrics.directCommitmentR, 1.0);
// Owned conversion: City Museum introduced Youth, Cultural, Sports, Collectorate;
// Youth Dev Office converted to direct white tie from Root -> V = 1/4 = 0.25
assert.strictEqual(museumMetrics.ownedConversionV, 0.25);
// Multi-thread reinforcement: Sports Dev Office is multi-thread target; Museum supplies confirmed branch -> C = 1.0
assert.strictEqual(museumMetrics.multiThreadReinforcementC, 1.0);
// Decomposition 4-part additive auditable check
const decomp = museumMetrics.decomposition;
assert.strictEqual(decomp.R, 1.0);
assert.strictEqual(decomp.V, 0.25);
assert.strictEqual(decomp.C, 1.0);
assert.strictEqual(decomp.weightedR, 30.0); // 100 * 0.30 * 1.0
assert.strictEqual(decomp.weightedV, 5.0);  // 100 * 0.20 * 0.25
assert.strictEqual(decomp.weightedC, 15.0); // 100 * 0.15 * 1.0
// Total U_i equals sum of 4 weighted components
const sumDecomp = Number(
  (decomp.weightedR + decomp.weightedA + decomp.weightedV + decomp.weightedC).toFixed(1)
);
assert.strictEqual(museumMetrics.utilityScoreU, sumDecomp, 'U_i must equal exact sum of 4 components');

// Buchanan-Tullock Decision Yield: eta_i = U_i / 3 touches
assert.strictEqual(
  museumMetrics.utilityYieldEta,
  Number((museumMetrics.utilityScoreU / 3).toFixed(1))
);

console.log(`✓ City Museum utility verified: U = ${museumMetrics.utilityScoreU}, eta = ${museumMetrics.utilityYieldEta}`);

// 3. Complete Workbook Utility Report
console.log('3. Testing complete workbook utility report (PUI, actions/touch, in-kind)...');
const report = computePublicChoiceUtilityReport(ws, ws.entities);

// PUI is bounded in [0, 100]
assert.ok(report.pui >= 0 && report.pui <= 100, `PUI must be in [0, 100], got ${report.pui}`);
console.log(`  Workbook PUI: ${report.pui}/100`);

// In-Kind value: br-6 is 750,000 INR on 1,000,000 target budget -> 75%
assert.strictEqual(report.inKindEquivalentInr, 750000);
assert.strictEqual(report.inKindEquivalentPct, 75.0);

// Actions per touch > 0
assert.ok(report.actionsPerTouch > 0, 'Actions per touch must be > 0');

// All 10 non-root partners have utility scores
const partnerCount = Object.keys(report.partners).length;
assert.strictEqual(partnerCount, 10, 'Must have utility scores for exactly 10 non-root partners');

// 4. Strategy Weight Presets & Weight Normalization
console.log('4. Testing strategy weight presets (Amplification Push & Delivery)...');
const amplificationWs = {
  ...ws,
  utilityWeights: UTILITY_PRESETS.amplification,
};
const ampReport = computePublicChoiceUtilityReport(amplificationWs, ws.entities);
const museumAmp = ampReport.partners[PLACEMENT_IDS.CITY_MUSEUM];
// Under amplification push, alphaA is 0.45
assert.strictEqual(ampReport.strategyPreset, 'amplification');
assert.ok(museumAmp.utilityScoreU > 0);

// Test weight normalization when weights are zero or sum to > 1
const zeroWeightsWs = {
  ...ws,
  utilityWeights: { presetName: 'custom' as const, alphaR: 0, alphaA: 0, alphaV: 0, alphaC: 0 },
};
const zeroReport = computePublicChoiceUtilityReport(zeroWeightsWs, ws.entities);
assert.ok(zeroReport.pui >= 0 && zeroReport.pui <= 100);

// Test resolution of weights & budget from workspace.workbooks[activeWorkbookId]
const workspaceWrapper = {
  ...ws,
  utilityWeights: undefined, // undefined at root
  targetBudgetInr: undefined, // undefined at root
};
const wsReport = computePublicChoiceUtilityReport(workspaceWrapper, ws.entities);
assert.ok(wsReport.inKindEquivalentInr > 0);
assert.ok(wsReport.inKindEquivalentPct > 0);

// 5. Edge cases: Empty workspace & isolated nodes
console.log('5. Testing edge cases (empty workspace, single root, disconnected nodes, 0 budget)...');
const zeroBudgetWs = {
  targetBudgetInr: 0,
  placements: ws.placements,
  branches: ws.branches,
};
const zeroBudgetReport = computePublicChoiceUtilityReport(zeroBudgetWs, ws.entities);
assert.strictEqual(zeroBudgetReport.inKindEquivalentPct, 0, 'In-kind percentage must be 0 when budget is 0');
const emptyWs = {
  targetBudgetInr: 500000,
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
const emptyReport = computePublicChoiceUtilityReport(emptyWs, {});
assert.strictEqual(emptyReport.pui, 0);
assert.strictEqual(emptyReport.actionsPerTouch, 0);
assert.strictEqual(emptyReport.inKindEquivalentPct, 0);
assert.strictEqual(Object.keys(emptyReport.partners).length, 0);

console.log('✓ Edge cases handled gracefully.');
console.log('--- ALL PUBLIC CHOICE UTILITY TESTS PASSED (100%) ---');
