/**
 * QualCount Phase 2 Verification Suite
 * Tests all 4 pure domain engines:
 * 1. Quantitative 7-Metric Engine (src/engine/metrics.ts)
 * 2. Parallel Bezier Curve Offset Engine (src/engine/parallelEdges.ts)
 * 3. Local Rectangular Anti-Overlap Engine (src/engine/overlap.ts)
 * 4. Bottom-to-Top ELK Layout Engine (src/engine/layout.ts)
 */

import assert from 'node:assert';
import {
  computeTopologyMetrics,
  getNodeYellowInDegree,
  getNodeAmplifierReach,
} from '../src/engine/metrics.ts';
import {
  groupParallelBranches,
  computeParallelBezierCurve,
  evaluateCubicBezier1D,
} from '../src/engine/parallelEdges.ts';
import {
  checkAABBCollision,
  resolveLocalCollisions,
} from '../src/engine/overlap.ts';
import {
  computeHierarchicalLayout,
} from '../src/engine/layout.ts';
import {
  seedDelhiNgoWorkspace,
  PLACEMENT_IDS,
  ENTITY_IDS,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo.ts';
import type { WorkspaceState, Placement, Branch } from '../src/types/schema.ts';

console.log('--- Running QualCount Phase 2 Verification Suite ---');

// ===========================================================================
// SECTION 1: Quantitative 7-Metric Engine (ENG-04)
// ===========================================================================
console.log('\n[1/4] Testing Pure Quantitative 7-Metric Engine (src/engine/metrics.ts)...');

const metrics = computeTopologyMetrics(seedDelhiNgoWorkspace, WORKBOOK_DELHI_ID);

// 1.1 Funding Metrics
console.log(' - Verifying Funding metrics on Delhi seed...');
assert.strictEqual(metrics.funding.securedPct, 40, 'Funding securedPct must be 40% (25 + 15)');
assert.strictEqual(metrics.funding.pendingPct, 0, 'Funding pendingPct must be 0%');
assert.strictEqual(metrics.funding.declinedCount, 0, 'Funding declinedCount must be 0');
assert.strictEqual(metrics.funding.securedInr, 400000, 'Funding securedInr must be 400,000 INR');

// 1.2 Direct White Relationships (from root NGO)
console.log(' - Verifying Direct White Relationship metrics...');
// Seed has 3 direct white ties from Your NGO:
// br-6 -> City Museum (tick)
// br-8 -> Dept of Social Security (cross)
// br-15 -> Youth Dev Office (tick)
assert.strictEqual(metrics.directRelationships.confirmedCount, 2, 'Confirmed white ties must be 2');
assert.strictEqual(metrics.directRelationships.pendingCount, 0, 'Pending white ties must be 0');
assert.strictEqual(metrics.directRelationships.declinedCount, 1, 'Declined white ties must be 1');
const expectedWhiteRate = (2 / 3) * 100;
assert.ok(
  Math.abs(metrics.directRelationships.confirmationRatePct - expectedWhiteRate) < 0.001,
  'White confirmation rate must be 66.67%'
);

// 1.3 Confirmed Yellow Bridges
console.log(' - Verifying Yellow Bridges metrics...');
// Total 10 yellow branches: 9 tick (br-3, br-4, br-7, br-9, br-10, br-11, br-12, br-13, br-14), 1 pending (br-5)
assert.strictEqual(metrics.yellowBridges.confirmedCount, 9, 'Confirmed yellow bridges must be 9');
assert.strictEqual(metrics.yellowBridges.pendingCount, 1, 'Pending yellow bridges must be 1');
assert.strictEqual(metrics.yellowBridges.declinedCount, 0, 'Declined yellow bridges must be 0');

// 1.4 Owned Conversions
console.log(' - Verifying Owned Conversions metrics...');
// Referred nodes: 5 non-root nodes with incoming ticked yellow branches from partner:
// Ministry of Food (br-4), Collectorate Office (br-9), Youth Dev Office (br-10), Cultural Dev Office (br-11), Sports Dev Office (br-12, 13, 14)
// Note: Ministry of Agriculture has br-5 with status 'pending' and is correctly excluded from confirmed referrals.
// Converted nodes: Youth Dev Office holds direct confirmed white tie from root NGO (br-15)
assert.strictEqual(metrics.ownedConversions.referredNodeCount, 5, 'Referred node count must be 5');
assert.strictEqual(metrics.ownedConversions.convertedNodeCount, 1, 'Converted node count must be 1');
const expectedConversionRate = (1 / 5) * 100;
assert.strictEqual(
  metrics.ownedConversions.conversionRatePct,
  20,
  'Conversion rate must be exactly 20% (1 / 5)'
);

// 1.5 Multi-Thread Targets
console.log(' - Verifying Multi-Thread Target triangulation metrics...');
assert.strictEqual(metrics.multiThreadTargets.doubleThreadCount, 0, 'Double thread count must be 0');
assert.strictEqual(metrics.multiThreadTargets.tripleThreadCount, 1, 'Triple thread count must be 1 (Sports Dev Office)');
assert.strictEqual(metrics.multiThreadTargets.quadPlusThreadCount, 0, 'Quad-plus thread count must be 0');
assert.deepStrictEqual(
  metrics.multiThreadTargets.triplePlusNames,
  ['Sports Dev Office'],
  'Triple-plus entity name must be Sports Dev Office'
);

// 1.6 Top Amplifier Reach (BFS)
console.log(' - Verifying Top Amplifier BFS reach metrics...');
assert.strictEqual(metrics.topAmplifier.entityId, ENTITY_IDS.CITY_MUSEUM);
assert.strictEqual(metrics.topAmplifier.entityName, 'City Museum');
assert.strictEqual(metrics.topAmplifier.directOutDegree, 4, 'City Museum direct ticked yellow out-degree must be 4');
assert.strictEqual(metrics.topAmplifier.downstreamReachCount, 4, 'City Museum downstream reach must be 4');

// Helper functions direct checks
const sportsInDegree = getNodeYellowInDegree(
  PLACEMENT_IDS.SPORTS_DEV_OFFICE,
  seedDelhiNgoWorkspace.branches
);
assert.strictEqual(sportsInDegree, 3, 'getNodeYellowInDegree for Sports Dev Office must be 3');

const museumReach = getNodeAmplifierReach(
  PLACEMENT_IDS.CITY_MUSEUM,
  seedDelhiNgoWorkspace.placements,
  seedDelhiNgoWorkspace.branches,
  PLACEMENT_IDS.YOUR_NGO
);
assert.strictEqual(museumReach, 4, 'City Museum BFS downstream reach must be 4');

const agrocellReach = getNodeAmplifierReach(
  PLACEMENT_IDS.AGROCELL_CSR,
  seedDelhiNgoWorkspace.placements,
  seedDelhiNgoWorkspace.branches,
  PLACEMENT_IDS.YOUR_NGO
);
assert.strictEqual(agrocellReach, 1, 'Agrocell CSR BFS downstream reach must be 1 (Ministry of Food)');

// 1.7 Bridge Concentration Risk (%)
console.log(' - Verifying Bridge Concentration Risk calculation...');
// Total indirect reach from root via ticked yellow paths of length >= 2:
// Food, Collectorate, Youth Dev, Cultural Dev, Sports Dev = 5 nodes.
// Removing City Museum leaves only Food (lost = 4 nodes).
// Concentration risk = 4 / 5 * 100 = 80%.
assert.strictEqual(metrics.bridgeConcentration.bridgeEntityName, 'City Museum');
assert.strictEqual(metrics.bridgeConcentration.concentrationPct, 80, 'Concentration risk must be 80%');
assert.strictEqual(metrics.bridgeConcentration.unreachableCount, 4, 'Lost reach count must be 4');

// 1.8 Metrics Edge Cases
console.log(' - Testing metrics edge cases (empty workspace, 0 budget, zero divisions)...');
const emptyWorkspace: WorkspaceState = {
  schemaVersion: 1,
  activeWorkbookId: 'wb-empty',
  entities: {},
  workbooks: {
    'wb-empty': {
      workbookId: 'wb-empty',
      title: 'Empty',
      description: '',
      targetBudgetInr: 0,
      status: 'active',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  },
  placements: {},
  branches: {},
  workbookLinks: {},
};

const emptyMetrics = computeTopologyMetrics(emptyWorkspace, 'wb-empty');
assert.strictEqual(emptyMetrics.funding.securedPct, 0);
assert.strictEqual(emptyMetrics.funding.securedInr, 0);
assert.strictEqual(emptyMetrics.directRelationships.confirmationRatePct, 0);
assert.strictEqual(emptyMetrics.ownedConversions.conversionRatePct, 0);
assert.strictEqual(emptyMetrics.topAmplifier.entityId, null);
assert.strictEqual(emptyMetrics.bridgeConcentration.concentrationPct, 0);

// 1.9 Cyclic Yellow Bridges Network (Robustness against cycles)
console.log(' - Testing cyclic yellow bridge network reach and concentration risk...');
const cyclicWs: WorkspaceState = {
  schemaVersion: 1,
  activeWorkbookId: 'wb-cycle',
  entities: {
    'ent-root': { entityId: 'ent-root', name: 'Root NGO', category: 'ngo', globalNotes: '', createdAt: '' },
    'ent-b1': { entityId: 'ent-b1', name: 'Bridge 1', category: 'institution', globalNotes: '', createdAt: '' },
    'ent-n1': { entityId: 'ent-n1', name: 'Node 1', category: 'government', globalNotes: '', createdAt: '' },
    'ent-n2': { entityId: 'ent-n2', name: 'Node 2', category: 'government', globalNotes: '', createdAt: '' },
  },
  workbooks: {
    'wb-cycle': { workbookId: 'wb-cycle', title: 'Cycle Test', description: '', targetBudgetInr: 1000, status: 'active', createdAt: '', updatedAt: '' },
  },
  placements: {
    'p-root': { placementId: 'p-root', workbookId: 'wb-cycle', entityId: 'ent-root', isRootNgo: true, x: 0, y: 0, width: 190, height: 76 },
    'p-b1': { placementId: 'p-b1', workbookId: 'wb-cycle', entityId: 'ent-b1', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
    'p-n1': { placementId: 'p-n1', workbookId: 'wb-cycle', entityId: 'ent-n1', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
    'p-n2': { placementId: 'p-n2', workbookId: 'wb-cycle', entityId: 'ent-n2', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
  },
  branches: {
    'br-1': { branchId: 'br-1', workbookId: 'wb-cycle', sourcePlacementId: 'p-root', targetPlacementId: 'p-b1', type: 'yellow', status: 'tick', updatedAt: '' },
    'br-2': { branchId: 'br-2', workbookId: 'wb-cycle', sourcePlacementId: 'p-b1', targetPlacementId: 'p-n1', type: 'yellow', status: 'tick', updatedAt: '' },
    'br-3': { branchId: 'br-3', workbookId: 'wb-cycle', sourcePlacementId: 'p-n1', targetPlacementId: 'p-n2', type: 'yellow', status: 'tick', updatedAt: '' },
    'br-4': { branchId: 'br-4', workbookId: 'wb-cycle', sourcePlacementId: 'p-n2', targetPlacementId: 'p-n1', type: 'yellow', status: 'tick', updatedAt: '' }, // 2-hop cycle!
  },
  workbookLinks: {},
};

const cyclicMetrics = computeTopologyMetrics(cyclicWs, 'wb-cycle');
assert.strictEqual(cyclicMetrics.bridgeConcentration.bridgeEntityName, 'Bridge 1');
assert.strictEqual(cyclicMetrics.bridgeConcentration.concentrationPct, 100);
assert.strictEqual(cyclicMetrics.bridgeConcentration.unreachableCount, 2);

console.log('✓ Section 1 Passed: 7-Metric Engine is mathematically verified and robust.');

// ===========================================================================
// SECTION 2: Parallel Bezier Curve Offset Engine (ENG-03)
// ===========================================================================
console.log('\n[2/4] Testing Pure Parallel Bezier Curve Offset Engine (src/engine/parallelEdges.ts)...');

// 2.1 Branch Grouping
console.log(' - Verifying canonical parallel branch grouping...');
const branchGroups = groupParallelBranches(Object.values(seedDelhiNgoWorkspace.branches));

// Find group connecting Your NGO and Agrocell CSR (has green br-2 and yellow br-3)
const agrocellKey = [PLACEMENT_IDS.YOUR_NGO, PLACEMENT_IDS.AGROCELL_CSR].sort().join('---');
const agrocellGroup = branchGroups.get(agrocellKey);
assert.ok(agrocellGroup, 'Must find parallel group for Your NGO <-> Agrocell CSR');
assert.strictEqual(agrocellGroup.length, 2, 'Your NGO <-> Agrocell CSR group must contain 2 parallel branches');

// Find group connecting Your NGO and City Museum (has white br-6 and yellow br-7)
const museumKey = [PLACEMENT_IDS.YOUR_NGO, PLACEMENT_IDS.CITY_MUSEUM].sort().join('---');
const museumGroup = branchGroups.get(museumKey);
assert.ok(museumGroup, 'Must find parallel group for Your NGO <-> City Museum');
assert.strictEqual(museumGroup.length, 2, 'Your NGO <-> City Museum group must contain 2 parallel branches');

// 2.2 Single Branch (total = 1)
console.log(' - Verifying single branch geometry (offset = 0)...');
const singleGeom = computeParallelBezierCurve({ x: 450, y: 650 }, { x: 550, y: 450 }, 0, 1);
assert.strictEqual(singleGeom.offsetDistance, 0, 'Single edge must have offsetDistance === 0');
assert.ok(singleGeom.path.startsWith('M 450 650 C'), 'Path must be a valid cubic Bezier');
assert.ok(!Number.isNaN(singleGeom.labelX) && !Number.isNaN(singleGeom.labelY));
assert.ok(!Number.isNaN(singleGeom.buttonX) && !Number.isNaN(singleGeom.buttonY));

// 2.3 Dual Parallel Branches (total = 2, offsets = -18 and +18)
console.log(' - Verifying dual parallel branches lateral separation...');
const edge0 = computeParallelBezierCurve({ x: 450, y: 650 }, { x: 550, y: 450 }, 0, 2, 36);
const edge1 = computeParallelBezierCurve({ x: 450, y: 650 }, { x: 550, y: 450 }, 1, 2, 36);

assert.strictEqual(edge0.offsetDistance, -18, 'Index 0 offset must be -18');
assert.strictEqual(edge1.offsetDistance, 18, 'Index 1 offset must be +18');
assert.notStrictEqual(edge0.path, edge1.path, 'Parallel paths must be distinct');

// Label pills (t = 0.5) must be laterally separated
const labelDist = Math.sqrt(
  Math.pow(edge0.labelX - edge1.labelX, 2) + Math.pow(edge0.labelY - edge1.labelY, 2)
);
assert.ok(labelDist > 20, `Parallel label pills must be separated by > 20px (actual: ${labelDist.toFixed(1)}px)`);

// End-of-line buttons (t = 0.8) must be laterally separated
const buttonDist = Math.sqrt(
  Math.pow(edge0.buttonX - edge1.buttonX, 2) + Math.pow(edge0.buttonY - edge1.buttonY, 2)
);
assert.ok(buttonDist > 12, `Parallel buttons must be separated by > 12px (actual: ${buttonDist.toFixed(1)}px)`);

// 2.4 Bidirectional Parallel Branches (Opposing directions A -> B and B -> A)
console.log(' - Verifying bidirectional parallel branches lateral separation (A -> B vs B -> A)...');
const edgeFwd = computeParallelBezierCurve({ x: 100, y: 500 }, { x: 100, y: 100 }, 0, 2, 36);
const edgeRev = computeParallelBezierCurve({ x: 100, y: 100 }, { x: 100, y: 500 }, 1, 2, 36);

assert.notStrictEqual(edgeFwd.path, edgeRev.path, 'Opposite-direction paths must be distinct');
const biLabelDist = Math.hypot(edgeFwd.labelX - edgeRev.labelX, edgeFwd.labelY - edgeRev.labelY);
assert.ok(
  biLabelDist > 20,
  `Bidirectional parallel label pills must be separated by > 20px (actual: ${biLabelDist.toFixed(1)}px)`
);
const biButtonDist = Math.hypot(edgeFwd.buttonX - edgeRev.buttonX, edgeFwd.buttonY - edgeRev.buttonY);
assert.ok(
  biButtonDist > 20,
  `Bidirectional buttons must be separated by > 20px (actual: ${biButtonDist.toFixed(1)}px)`
);

// 2.5 Degenerate Edge (< 1px)
console.log(' - Testing degenerate endpoint fallback (< 1px distance)...');
const degenGeom = computeParallelBezierCurve({ x: 100, y: 100 }, { x: 100.2, y: 100.1 }, 0, 1);
assert.ok(degenGeom.path.includes('L'), 'Degenerate edge must fallback to straight segment without NaN');
assert.strictEqual(degenGeom.offsetDistance, 0);

// 2.6 1D Bezier helper
const mid = evaluateCubicBezier1D(0, 0, 100, 100, 0.5);
assert.strictEqual(mid, 50, 'Symmetric cubic Bezier midpoint must evaluate to 50');

console.log('✓ Section 2 Passed: Parallel Bezier Curve Offset Engine is mathematically verified.');

// ===========================================================================
// SECTION 3: Pure Local Rectangular Anti-Overlap Engine (ENG-02)
// ===========================================================================
console.log('\n[3/4] Testing Pure Local Anti-Overlap Engine (src/engine/overlap.ts)...');

// 3.1 Bounding Box Collision Detection
console.log(' - Verifying AABB collision detection with 24px margin...');
const boxA = { id: 'a', x: 100, y: 100, width: 190, height: 76 };
const boxBOverlap = { id: 'b', x: 150, y: 120, width: 190, height: 76 };
const boxCSeparated = { id: 'c', x: 400, y: 100, width: 190, height: 76 };

const colOverlap = checkAABBCollision(boxA, boxBOverlap, 24);
assert.strictEqual(colOverlap.collides, true, 'Partially overlapping boxes must collide');
assert.ok(colOverlap.overlapX > 0 && colOverlap.overlapY > 0);

const colSeparated = checkAABBCollision(boxA, boxCSeparated, 24);
assert.strictEqual(colSeparated.collides, false, 'Distant boxes (gap > 24px) must not collide');

// 3.2 Anchored Card Coordinate Immutability & Minimal Neighbor Nudging
console.log(' - Verifying anchored card immutability during collision resolution...');
const testPlacements: Record<string, Placement> = {
  // Box A is existing neighbor
  'box-a': {
    placementId: 'box-a',
    workbookId: 'wb-test',
    entityId: 'ent-a',
    isRootNgo: false,
    x: 200,
    y: 200,
    width: 190,
    height: 76,
  },
  // Box B was dragged directly on top of Box A
  'box-b': {
    placementId: 'box-b',
    workbookId: 'wb-test',
    entityId: 'ent-b',
    isRootNgo: false,
    x: 210,
    y: 205,
    width: 190,
    height: 76,
  },
  // Box C is distant and uninvolved
  'box-c': {
    placementId: 'box-c',
    workbookId: 'wb-test',
    entityId: 'ent-c',
    isRootNgo: false,
    x: 800,
    y: 800,
    width: 190,
    height: 76,
  },
};

// Box B is anchored (the user just released it)
const resolution = resolveLocalCollisions(testPlacements, 'box-b', 24);

// 1. Anchored card must remain strictly unchanged
assert.strictEqual(
  resolution.positions['box-b'].x,
  210,
  'Anchored box-b X coordinate must remain strictly unchanged'
);
assert.strictEqual(
  resolution.positions['box-b'].y,
  205,
  'Anchored box-b Y coordinate must remain strictly unchanged'
);

// 2. Uninvolved box-c must remain strictly unchanged and NOT in movedNodeIds
assert.strictEqual(resolution.positions['box-c'].x, 800);
assert.strictEqual(resolution.positions['box-c'].y, 800);
assert.ok(
  !resolution.movedNodeIds.includes('box-c'),
  'Uninvolved box-c must not appear in movedNodeIds'
);

// 3. Colliding neighbor box-a must have been nudged out of collision
assert.ok(
  resolution.movedNodeIds.includes('box-a'),
  'Colliding box-a must be recorded in movedNodeIds'
);

const finalBoxA = {
  id: 'box-a',
  x: resolution.positions['box-a'].x,
  y: resolution.positions['box-a'].y,
  width: 190,
  height: 76,
};
const finalBoxB = {
  id: 'box-b',
  x: resolution.positions['box-b'].x,
  y: resolution.positions['box-b'].y,
  width: 190,
  height: 76,
};

const finalCol = checkAABBCollision(finalBoxA, finalBoxB, 24);
assert.strictEqual(
  finalCol.collides,
  false,
  'Post-resolution boxes must have zero collision and respect 24px clearance'
);

// 3.3 Concentric Multi-Card Collision Resolution (Cascade)
console.log(' - Verifying concentric multi-box collision resolution...');
const concentricPlacements: Record<string, Placement> = {
  'c1': { placementId: 'c1', workbookId: 'w', entityId: 'e1', isRootNgo: false, x: 100, y: 100, width: 190, height: 76 },
  'c2': { placementId: 'c2', workbookId: 'w', entityId: 'e2', isRootNgo: false, x: 100, y: 100, width: 190, height: 76 },
  'c3': { placementId: 'c3', workbookId: 'w', entityId: 'e3', isRootNgo: false, x: 100, y: 100, width: 190, height: 76 },
  'c4': { placementId: 'c4', workbookId: 'w', entityId: 'e4', isRootNgo: false, x: 100, y: 100, width: 190, height: 76 },
};
const concentricRes = resolveLocalCollisions(concentricPlacements, 'c1', 24);
assert.strictEqual(concentricRes.positions['c1'].x, 100, 'Anchored c1 X must remain 100');
assert.strictEqual(concentricRes.positions['c1'].y, 100, 'Anchored c1 Y must remain 100');
assert.ok(!concentricRes.movedNodeIds.includes('c1'), 'Anchored c1 must not be in movedNodeIds');
assert.strictEqual(concentricRes.movedNodeIds.length, 3, '3 non-anchored cards must be moved');

// Verify all pairs are non-colliding
const cKeys = Object.keys(concentricPlacements);
for (let i = 0; i < cKeys.length; i++) {
  for (let j = i + 1; j < cKeys.length; j++) {
    const b1 = { id: cKeys[i], ...concentricRes.positions[cKeys[i]], width: 190, height: 76 };
    const b2 = { id: cKeys[j], ...concentricRes.positions[cKeys[j]], width: 190, height: 76 };
    assert.strictEqual(
      checkAABBCollision(b1, b2, 24).collides,
      false,
      `Pair ${cKeys[i]} and ${cKeys[j]} must have zero collision after resolution`
    );
  }
}

console.log('✓ Section 3 Passed: Local Anti-Overlap Engine protects anchored nodes and clears collisions.');

// ===========================================================================
// SECTION 4: Bottom-to-Top ELK Layout Engine (ENG-01)
// ===========================================================================
console.log('\n[4/4] Testing Pure Bottom-to-Top ELK Layout Engine (src/engine/layout.ts)...');

// 4.1 Layout on Delhi Seed Dataset
console.log(' - Running computeHierarchicalLayout on Delhi seed dataset...');
const layoutPositions = await computeHierarchicalLayout(
  seedDelhiNgoWorkspace.placements,
  seedDelhiNgoWorkspace.branches,
  WORKBOOK_DELHI_ID
);

// All 11 placements must have coordinates
const placementKeys = Object.keys(seedDelhiNgoWorkspace.placements);
assert.strictEqual(
  Object.keys(layoutPositions).length,
  11,
  'Layout must return coordinates for all 11 placements'
);

for (const id of placementKeys) {
  assert.ok(layoutPositions[id], `Placement ${id} must have layout coordinates`);
  assert.ok(typeof layoutPositions[id].x === 'number' && !Number.isNaN(layoutPositions[id].x));
  assert.ok(typeof layoutPositions[id].y === 'number' && !Number.isNaN(layoutPositions[id].y));
}

// 4.2 Verify Bottom-to-Top Hierarchy (elk.direction: "UP")
// Root NGO (Tier 0) must sit at the bottom (highest Y).
// Sports Dev Office (Tier 3) must sit at the top (lowest Y).
const rootY = layoutPositions[PLACEMENT_IDS.YOUR_NGO].y;
const museumY = layoutPositions[PLACEMENT_IDS.CITY_MUSEUM].y;
const foodY = layoutPositions[PLACEMENT_IDS.MINISTRY_FOOD].y;
const sportsY = layoutPositions[PLACEMENT_IDS.SPORTS_DEV_OFFICE].y;

console.log(`   Tier coordinates: Root Y=${rootY}, Museum Y=${museumY}, Food Y=${foodY}, Sports Y=${sportsY}`);

assert.ok(
  rootY > museumY,
  `Bottom-to-Top: Root NGO (y=${rootY}) must sit below Tier 1 City Museum (y=${museumY})`
);
assert.ok(
  museumY > sportsY,
  `Bottom-to-Top: Tier 1 City Museum (y=${museumY}) must sit below Tier 3 Sports Dev (y=${sportsY})`
);
assert.ok(
  foodY > sportsY,
  `Bottom-to-Top: Tier 2 Ministry of Food (y=${foodY}) must sit below Tier 3 Sports Dev (y=${sportsY})`
);

// 4.3 Read-Only Topology Preservation
console.log(' - Verifying read-only topology preservation...');
assert.strictEqual(
  Object.keys(seedDelhiNgoWorkspace.branches).length,
  15,
  'Branch count must remain strictly 15 (read-only topology)'
);
assert.strictEqual(
  Object.keys(seedDelhiNgoWorkspace.placements).length,
  11,
  'Placement count must remain strictly 11'
);

// 4.4 Isolated / Zero-Degree Node Handling
console.log(' - Verifying isolated node staging rack below Tier 0...');
const mixedPlacements: Record<string, Placement> = {
  ...seedDelhiNgoWorkspace.placements,
  'isolated-1': {
    placementId: 'isolated-1',
    workbookId: WORKBOOK_DELHI_ID,
    entityId: 'ent-iso-1',
    isRootNgo: false,
    x: 0,
    y: 0,
    width: 190,
    height: 76,
  },
  'isolated-2': {
    placementId: 'isolated-2',
    workbookId: WORKBOOK_DELHI_ID,
    entityId: 'ent-iso-2',
    isRootNgo: false,
    x: 0,
    y: 0,
    width: 190,
    height: 76,
  },
};

const mixedLayout = await computeHierarchicalLayout(
  mixedPlacements,
  seedDelhiNgoWorkspace.branches,
  WORKBOOK_DELHI_ID
);

assert.strictEqual(
  Object.keys(mixedLayout).length,
  13,
  'Mixed layout must return coordinates for all 13 placements (including 2 isolated)'
);

const iso1Pos = mixedLayout['isolated-1'];
const iso2Pos = mixedLayout['isolated-2'];

assert.ok(iso1Pos && iso2Pos, 'Isolated nodes must receive coordinates');
assert.ok(
  iso1Pos.y > rootY,
  `Isolated nodes (y=${iso1Pos.y}) must be staged below Tier 0 (root y=${rootY})`
);
assert.strictEqual(
  iso1Pos.y,
  iso2Pos.y,
  'Isolated nodes must sit on the same horizontal baseline rack'
);
assert.strictEqual(
  iso2Pos.x - iso1Pos.x,
  220,
  'Isolated nodes must be spaced horizontally by 220px'
);

// 4.5 Empty & Isolated-Only Graphs
console.log(' - Verifying empty and isolated-only edge cases...');
const emptyLayout = await computeHierarchicalLayout({}, {});
assert.deepStrictEqual(emptyLayout, {}, 'Empty graph must return empty record');

const isolatedOnlyLayout = await computeHierarchicalLayout(
  {
    'iso-a': {
      placementId: 'iso-a',
      workbookId: 'wb-iso',
      entityId: 'ent-a',
      isRootNgo: false,
      x: 0,
      y: 0,
      width: 190,
      height: 76,
    },
    'iso-b': {
      placementId: 'iso-b',
      workbookId: 'wb-iso',
      entityId: 'ent-b',
      isRootNgo: false,
      x: 0,
      y: 0,
      width: 190,
      height: 76,
    },
  },
  {}
);
assert.strictEqual(Object.keys(isolatedOnlyLayout).length, 2);
assert.strictEqual(isolatedOnlyLayout['iso-b'].x - isolatedOnlyLayout['iso-a'].x, 220);

// 4.6 Cycles and Self-Loops in Hierarchical Layout (Robustness)
console.log(' - Verifying layout handles cycles and self-loops gracefully...');
const cyclicLayoutPlacements: Record<string, Placement> = {
  'p1': { placementId: 'p1', workbookId: 'w', entityId: 'e1', isRootNgo: true, x: 0, y: 0, width: 190, height: 76 },
  'p2': { placementId: 'p2', workbookId: 'w', entityId: 'e2', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
  'p3': { placementId: 'p3', workbookId: 'w', entityId: 'e3', isRootNgo: false, x: 0, y: 0, width: 190, height: 76 },
};
const cyclicLayoutBranches: Record<string, Branch> = {
  'b1': { branchId: 'b1', workbookId: 'w', sourcePlacementId: 'p1', targetPlacementId: 'p2', type: 'yellow', status: 'tick', updatedAt: '' },
  'b2': { branchId: 'b2', workbookId: 'w', sourcePlacementId: 'p2', targetPlacementId: 'p3', type: 'yellow', status: 'tick', updatedAt: '' },
  'b3': { branchId: 'b3', workbookId: 'w', sourcePlacementId: 'p3', targetPlacementId: 'p1', type: 'yellow', status: 'tick', updatedAt: '' },
  'b4': { branchId: 'b4', workbookId: 'w', sourcePlacementId: 'p1', targetPlacementId: 'p1', type: 'yellow', status: 'tick', updatedAt: '' }, // self loop
};
const cyclicLayoutRes = await computeHierarchicalLayout(cyclicLayoutPlacements, cyclicLayoutBranches, 'w');
assert.strictEqual(Object.keys(cyclicLayoutRes).length, 3, 'All 3 cyclic nodes must receive valid layout coordinates');
assert.ok(!Number.isNaN(cyclicLayoutRes['p1'].x) && !Number.isNaN(cyclicLayoutRes['p1'].y));
assert.ok(!Number.isNaN(cyclicLayoutRes['p2'].x) && !Number.isNaN(cyclicLayoutRes['p2'].y));
assert.ok(!Number.isNaN(cyclicLayoutRes['p3'].x) && !Number.isNaN(cyclicLayoutRes['p3'].y));

console.log('✓ Section 4 Passed: Bottom-to-Top ELK Layout Engine preserves topology and stages isolated nodes.');

console.log('\n=======================================================');
console.log(' ALL PHASE 2 ENGINE TESTS PASSED SUCCESSFULLY! (100%) ');
console.log('=======================================================\n');
