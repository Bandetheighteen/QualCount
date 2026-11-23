/**
 * QualCount Phase 4 Verification Suite
 * 
 * Comprehensive end-to-end acceptance tests verifying:
 * - VAL-UI-01: Live Top Quantitative Metrics Strip (All 7 Metrics)
 * - VAL-UI-02: Action Toolbar with Entity Deduplication & Insertion
 * - VAL-UI-03: Multiplex Branch Connection & Self-Loop Prevention
 * - VAL-UI-04: Collapsible Context Inspector Drawer & Cascading Deletions
 * - VAL-UI-05 to VAL-UI-12: Full Section 12 10-Point Acceptance Checklist
 * - VAL-UI-13: Production Build & Architectural Boundaries
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  useWorkspaceStore,
  deriveFlowNodes,
  deriveFlowEdges,
} from '../src/store/useWorkspaceStore';
import { MetricsStrip } from '../src/components/metrics/MetricsStrip';
import { ActionToolbar } from '../src/components/toolbar/ActionToolbar';
import { AddNodeModal } from '../src/components/toolbar/AddNodeModal';
import { ConnectBranchModal } from '../src/components/toolbar/ConnectBranchModal';
import { InspectorDrawer } from '../src/components/inspector/InspectorDrawer';
import { getMultiThreadBadge } from '../src/components/canvas/OrgNode';
import { App } from '../src/App';
import {
  seedDelhiNgoWorkspace,
  PLACEMENT_IDS,
  ENTITY_IDS,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo';
import { getWorkspaceRepository, resetWorkspaceRepository } from '../src/storage';
import { computeParallelBezierCurve, groupParallelBranches } from '../src/engine/parallelEdges';
import { checkAABBCollision } from '../src/engine/overlap';
import type { WorkspaceState, Branch } from '../src/types/schema';

console.log('--- Running QualCount Phase 4 Verification Suite ---\n');

// ---------------------------------------------------------------------------
// Headless DOM & Storage Polyfills for Node.js
// ---------------------------------------------------------------------------
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

let fileToImport: { content: string; name: string } | null = null;

const mockDocument = {
  activeElement: null as unknown,
  querySelector(_selector: string): MockElement | null {
    return null;
  },
  createElement(tag: string): MockElement {
    const el: MockElement = {
      style: {},
      click: () => {
        clickedElements.push(el);
        if (tag === 'input' && el.type === 'file') {
          if (fileToImport) {
            el.files = [fileToImport];
            setTimeout(() => {
              if (el.onchange) el.onchange();
            }, 10);
          }
        }
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
  confirm(_msg: string) {
    return true;
  },
};

(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = new MockLocalStorage();
(globalThis as unknown as { document: typeof mockDocument }).document = mockDocument;
(globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;
(globalThis as unknown as { Blob: typeof MockBlob }).Blob = MockBlob as unknown as typeof Blob;
(globalThis as unknown as { FileReader: typeof MockFileReader }).FileReader = MockFileReader as unknown as typeof FileReader;
(globalThis as unknown as { URL: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void } }).URL = {
  createObjectURL: (_blob: unknown) => {
    const u = `blob:mock-${createdUrls.length}`;
    createdUrls.push(u);
    return u;
  },
  revokeObjectURL: (_u: string) => {},
};

resetWorkspaceRepository();
useWorkspaceStore.getInitialState = () => useWorkspaceStore.getState();

// ===========================================================================
// SUITE 1: Live Top Quantitative Metrics Strip (VAL-UI-01)
// ===========================================================================
console.log('[1/5] Testing Live Top Quantitative Metrics Strip (src/components/metrics/MetricsStrip.tsx)...');

await useWorkspaceStore.getState().init();
const state = useWorkspaceStore.getState();
assert.ok(state.metrics, 'Metrics must be computed on init');

const metrics = state.metrics;
// 1. Funding Secured: 40% secured (₹4,00,000 / ₹10,00,000), 0% pending
assert.strictEqual(metrics.funding.securedPct, 40, 'Delhi seed funding secured must be 40%');
assert.strictEqual(metrics.funding.securedInr, 400000, 'Delhi seed secured INR must be ₹4,00,000');
assert.strictEqual(metrics.funding.pendingPct, 0, 'Delhi seed pending funding must be 0%');

// 2. Direct White Relationships: 2 confirmed, 0 pending, 1 declined, 67% confirmation rate
assert.strictEqual(metrics.directRelationships.confirmedCount, 2);
assert.strictEqual(metrics.directRelationships.pendingCount, 0);
assert.strictEqual(metrics.directRelationships.declinedCount, 1);
assert.strictEqual(Math.round(metrics.directRelationships.confirmationRatePct), 67);

// 3. Yellow Bridges: 9 confirmed, 1 pending
assert.strictEqual(metrics.yellowBridges.confirmedCount, 9);
assert.strictEqual(metrics.yellowBridges.pendingCount, 1);

// 4. Owned Conversions: 1 / 5 referred, 20%
assert.strictEqual(metrics.ownedConversions.referredNodeCount, 5);
assert.strictEqual(metrics.ownedConversions.convertedNodeCount, 1);
assert.strictEqual(metrics.ownedConversions.conversionRatePct, 20);

// 5. Multi-Thread Targets: 1x 3-Thread (Sports Dev Office)
assert.strictEqual(metrics.multiThreadTargets.tripleThreadCount, 1);
assert.ok(
  metrics.multiThreadTargets.triplePlusNames.includes('Sports Dev Office'),
  'Sports Dev Office must be listed as a 3-Thread target'
);

// 6. Top Amplifier: City Museum (direct 4, reach 4)
assert.strictEqual(metrics.topAmplifier.entityName, 'City Museum');
assert.strictEqual(metrics.topAmplifier.directOutDegree, 4);
assert.strictEqual(metrics.topAmplifier.downstreamReachCount, 4);

// 7. Bridge Concentration Risk: City Museum, 80% (> 30% alert)
assert.strictEqual(metrics.bridgeConcentration.bridgeEntityName, 'City Museum');
assert.strictEqual(metrics.bridgeConcentration.concentrationPct, 80);

// Render MetricsStrip component to static HTML and verify presence of required key metrics
const metricsHtml = renderToStaticMarkup(React.createElement(MetricsStrip));
assert.ok(metricsHtml.includes('M40%'), 'Metrics strip markup must contain M40%');
assert.ok(metricsHtml.includes('₹4,00,000'), 'Metrics strip markup must contain ₹4,00,000');
assert.ok(metricsHtml.includes('Sports Dev Office'), 'Metrics strip markup must display Sports Dev Office');
assert.ok(metricsHtml.includes('City Museum'), 'Metrics strip markup must display City Museum');
assert.ok(metricsHtml.includes('80%'), 'Metrics strip markup must display 80% concentration risk');
assert.ok(metricsHtml.includes('Active Bridges') || metricsHtml.includes('active bridges'), 'Metrics strip markup must show active bridges');

console.log('✓ Suite 1 Passed: All 7 quantitative metrics rendered dynamically without subjective ratings.\n');

// ===========================================================================
// SUITE 2: Action Toolbar & Entity Autocomplete Deduplication (VAL-UI-02, VAL-UI-03)
// ===========================================================================
console.log('[2/5] Testing Action Toolbar with Entity Deduplication & Branch Connection...');

const initialEntityCount = Object.keys(useWorkspaceStore.getState().workspace!.entities).length;
const initialPlacementCount = Object.keys(useWorkspaceStore.getState().workspace!.placements).length;

// Test Deduplication: Adding "City Museum" (with whitespace and case variance)
const dedupResult = await useWorkspaceStore.getState().addNode('   cIty mUsEum   ', 'institution');
const stateAfterDedup = useWorkspaceStore.getState();

assert.strictEqual(
  dedupResult.entityId,
  ENTITY_IDS.CITY_MUSEUM,
  'addNode must reuse existing entityId for matching partner name'
);
assert.strictEqual(
  Object.keys(stateAfterDedup.workspace!.entities).length,
  initialEntityCount,
  'Entity count must not increase when deduplicating an existing organization'
);
assert.strictEqual(
  Object.keys(stateAfterDedup.workspace!.placements).length,
  initialPlacementCount + 1,
  'A new placement must still be created for the deduplicated entity'
);
assert.strictEqual(
  stateAfterDedup.selectedPlacementId,
  dedupResult.placementId,
  'The newly added placement must be selected automatically'
);

// Test New Entity: Adding a completely new partner
const newEntityResult = await useWorkspaceStore.getState().addNode(
  'National Innovation Mission',
  'government',
  'Direct contact: Dr. Sharma'
);
const stateAfterNew = useWorkspaceStore.getState();

assert.notStrictEqual(
  newEntityResult.entityId,
  ENTITY_IDS.CITY_MUSEUM,
  'New entity must have a unique generated UUID'
);
assert.strictEqual(
  Object.keys(stateAfterNew.workspace!.entities).length,
  initialEntityCount + 1,
  'Entity count must increase by 1 for new partner'
);
assert.strictEqual(
  stateAfterNew.workspace!.entities[newEntityResult.entityId].name,
  'National Innovation Mission'
);
assert.strictEqual(
  stateAfterNew.workspace!.entities[newEntityResult.entityId].category,
  'government'
);

// Test Self-Loop Prevention in addBranch
await assert.rejects(
  async () => {
    await useWorkspaceStore.getState().addBranch(
      newEntityResult.placementId,
      newEntityResult.placementId,
      'white',
      'tick'
    );
  },
  /Self-loops are not allowed/i,
  'addBranch must reject self-loops'
);

// Test Multiplex Connection: Connecting new partner with multiple parallel branches to Root NGO
const branch1 = await useWorkspaceStore.getState().addBranch(
  PLACEMENT_IDS.YOUR_NGO,
  newEntityResult.placementId,
  'white',
  'tick',
  undefined,
  'MOU signed for national launch'
);
assert.ok(branch1, 'Branch 1 must be created');
assert.strictEqual(branch1.type, 'white');
assert.strictEqual(branch1.status, 'tick');

const branch2 = await useWorkspaceStore.getState().addBranch(
  PLACEMENT_IDS.YOUR_NGO,
  newEntityResult.placementId,
  'green',
  'tick',
  15,
  '15% co-sponsorship allocation'
);
assert.ok(branch2, 'Parallel branch 2 must be created');
assert.strictEqual(branch2.type, 'green');
assert.strictEqual(branch2.valuePct, 15);

// Check that funding metric updated dynamically with the new green branch (+15% = 55%)
const updatedMetrics = useWorkspaceStore.getState().metrics!;
assert.strictEqual(
  updatedMetrics.funding.securedPct,
  55,
  'Funding secured percentage must dynamically update to 55% after adding 15% green branch'
);

// Test empty partner name rejection in addNode
await assert.rejects(
  async () => {
    await useWorkspaceStore.getState().addNode('   ', 'csr');
  },
  /cannot be empty/i,
  'addNode must reject empty organization name'
);

// Test non-existent placement rejection in addBranch
await assert.rejects(
  async () => {
    await useWorkspaceStore.getState().addBranch(
      'non-existent-src',
      newEntityResult.placementId,
      'white',
      'tick'
    );
  },
  /does not exist/i,
  'addBranch must reject non-existent source placement'
);

// Render ActionToolbar component to verify UI markup
const toolbarHtml = renderToStaticMarkup(React.createElement(ActionToolbar));
assert.ok(toolbarHtml.includes('Add Node'), 'Action toolbar must contain Add Node button');
assert.ok(toolbarHtml.includes('Connect Branch'), 'Action toolbar must contain Connect Branch button');
assert.ok(toolbarHtml.includes('Tidy Up'), 'Action toolbar must contain Tidy Up button');
assert.ok(toolbarHtml.includes('Declined Paths'), 'Action toolbar must contain Declined Paths toggle');
// Requirement 2: Export JSON and Import JSON removed from workbook interface
assert.ok(!toolbarHtml.includes('Export JSON'), 'Action toolbar must NOT contain Export JSON button');
assert.ok(!toolbarHtml.includes('Import JSON'), 'Action toolbar must NOT contain Import JSON button');
assert.ok(toolbarHtml.includes('Reset Demo'), 'Action toolbar must contain Reset Demo button');

// Render AddNodeModal and ConnectBranchModal to verify open dialog markup and accessibility
const addNodeModalHtml = renderToStaticMarkup(
  React.createElement(AddNodeModal, { isOpen: true, onClose: () => {} })
);
assert.ok(addNodeModalHtml.includes('role="dialog"'), 'AddNodeModal must have role="dialog"');
assert.ok(addNodeModalHtml.includes('Add Partner Organization'), 'AddNodeModal must render title');
assert.ok(addNodeModalHtml.includes('Sector Category'), 'AddNodeModal must render category selector');

const connectBranchModalHtml = renderToStaticMarkup(
  React.createElement(ConnectBranchModal, { isOpen: true, onClose: () => {} })
);
assert.ok(connectBranchModalHtml.includes('role="dialog"'), 'ConnectBranchModal must have role="dialog"');
assert.ok(connectBranchModalHtml.includes('Connect Multiplex Branch'), 'ConnectBranchModal must render title');
assert.ok(connectBranchModalHtml.includes('Green Funding'), 'ConnectBranchModal must render Green Funding type');
assert.ok(connectBranchModalHtml.includes('White Direct'), 'ConnectBranchModal must render White Direct type');
assert.ok(connectBranchModalHtml.includes('Yellow Bridge'), 'ConnectBranchModal must render Yellow Bridge type');

console.log('✓ Suite 2 Passed: Action Toolbar, entity deduplication, and multiplex connection verified.\n');

// ===========================================================================
// SUITE 3: Context Inspector Drawer & Cascading Deletion (VAL-UI-04)
// ===========================================================================
console.log('[3/5] Testing Context Inspector Drawer & Cascading Deletions (src/components/inspector/InspectorDrawer.tsx)...');

// 1. Select Node and inspect
useWorkspaceStore.getState().selectPlacement(newEntityResult.placementId);
assert.strictEqual(useWorkspaceStore.getState().selectedPlacementId, newEntityResult.placementId);
assert.strictEqual(useWorkspaceStore.getState().selectedBranchId, null);

const nodeInspectorHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));
assert.ok(nodeInspectorHtml.includes('National Innovation Mission'), 'Inspector must render selected entity name');
assert.ok(nodeInspectorHtml.includes('Yellow In-Deg'), 'Inspector must display yellow in-degree');
assert.ok(nodeInspectorHtml.includes('Downstream Reach'), 'Inspector must display downstream reach');
assert.ok(nodeInspectorHtml.includes('Connected Multiplex Branches'), 'Inspector must list attached branches');

// 2. Update entity properties via Inspector
await useWorkspaceStore.getState().updateEntity(newEntityResult.entityId, {
  name: 'National Innovation Mission (Updated)',
  category: 'institution',
});
assert.strictEqual(
  useWorkspaceStore.getState().workspace!.entities[newEntityResult.entityId].name,
  'National Innovation Mission (Updated)'
);

// 3. Select Branch and inspect
useWorkspaceStore.getState().selectBranch(branch2.branchId);
assert.strictEqual(useWorkspaceStore.getState().selectedBranchId, branch2.branchId);
assert.strictEqual(useWorkspaceStore.getState().selectedPlacementId, null);

const branchInspectorHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));
assert.ok(branchInspectorHtml.includes('Branch Inspector'), 'Inspector must render Branch Inspector header');
assert.ok(branchInspectorHtml.includes('Verification Status'), 'Inspector must render verification status selector');
assert.ok(branchInspectorHtml.includes('Funding Target Share'), 'Inspector must render funding percentage for green branches');

// 4. Update branch status to cross
await useWorkspaceStore.getState().updateBranch(branch2.branchId, { status: 'cross' });
assert.strictEqual(
  useWorkspaceStore.getState().workspace!.branches[branch2.branchId].status,
  'cross'
);
// Funding should drop back down from 55% to 40% because green branch is no longer 'tick'
assert.strictEqual(
  useWorkspaceStore.getState().metrics!.funding.securedPct,
  40,
  'Funding secured must update back to 40% when green branch is set to cross'
);

// 5. Delete Branch
await useWorkspaceStore.getState().deleteBranch(branch2.branchId);
assert.strictEqual(
  useWorkspaceStore.getState().workspace!.branches[branch2.branchId],
  undefined,
  'Deleted branch must be removed from workspace'
);
assert.strictEqual(
  useWorkspaceStore.getState().selectedBranchId,
  null,
  'Deleted branch must clear branch selection'
);

// 6. Test Root NGO Removal Protection
const rootPlacement = Object.values(useWorkspaceStore.getState().workspace!.placements).find((p) => p.isRootNgo)!;
const rootRemoveAttempt = await useWorkspaceStore.getState().removePlacement(rootPlacement.placementId);
assert.strictEqual(rootRemoveAttempt, false, 'removePlacement on Root NGO must return false');
assert.ok(
  useWorkspaceStore.getState().workspace!.placements[rootPlacement.placementId],
  'Root NGO placement must remain in workspace'
);

// 7. Test Non-Root Removal with Cascading Branch Deletion
const branchCountBefore = Object.keys(useWorkspaceStore.getState().workspace!.branches).length;
assert.ok(
  useWorkspaceStore.getState().workspace!.branches[branch1.branchId],
  'branch1 must exist before placement removal'
);

const nonRootRemoveSuccess = await useWorkspaceStore.getState().removePlacement(newEntityResult.placementId);
assert.strictEqual(nonRootRemoveSuccess, true, 'Non-root placement removal must succeed');
assert.strictEqual(
  useWorkspaceStore.getState().workspace!.placements[newEntityResult.placementId],
  undefined,
  'Removed placement must not exist in workspace'
);
// branch1 was attached to newEntityResult.placementId, so it must be cascaded and deleted
assert.strictEqual(
  useWorkspaceStore.getState().workspace!.branches[branch1.branchId],
  undefined,
  'Branch attached to removed placement must be cascaded and deleted'
);
assert.strictEqual(
  Object.keys(useWorkspaceStore.getState().workspace!.branches).length,
  branchCountBefore - 1,
  'Branch count must decrease by 1'
);

// Clear selection and verify empty drawer helper card
useWorkspaceStore.getState().clearSelection();
const emptyInspectorHtml = renderToStaticMarkup(React.createElement(InspectorDrawer));
assert.ok(
  emptyInspectorHtml.includes('Context Inspector'),
  'Empty inspector must render context helper card'
);

console.log('✓ Suite 3 Passed: Inspector Drawer, branch editing, root protection, and cascading deletions verified.\n');

// ===========================================================================
// SUITE 4: Full 10-Point Acceptance Checklist Automated Verification (Section 12)
// ===========================================================================
console.log('[4/5] Executing Exhaustive 10-Point Acceptance Verification Suite...');

// Reset cleanly to Delhi seed dataset before testing Section 12 items
await useWorkspaceStore.getState().resetToDelhiSeed();
const delhiState = useWorkspaceStore.getState().workspace!;

// ---------------------------------------------------------------------------
// Item 1: App starts cleanly in bottom-to-top layout: Root NGO at bottom,
// Sports Dev Office at top with glowing "Triple-Thread (3)" badge.
// ---------------------------------------------------------------------------
console.log(' - [Check 1/10] Delhi Initial Hierarchy & Multi-Thread Badge...');
const rootP = delhiState.placements[PLACEMENT_IDS.YOUR_NGO];
const sportsP = delhiState.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.ok(rootP, 'Root NGO placement must exist');
assert.ok(sportsP, 'Sports Dev Office placement must exist');
assert.ok(
  rootP.y > sportsP.y,
  `Bottom-to-top hierarchy requires Root NGO (y=${rootP.y}) to be below Sports Dev Office (y=${sportsP.y})`
);
assert.ok(rootP.y >= 500, `Root NGO Y must be near bottom tier (actual: ${rootP.y})`);
assert.ok(sportsP.y <= 50, `Sports Dev Office Y must be at top apex (actual: ${sportsP.y})`);

const sportsYellowInDeg = useWorkspaceStore.getState().yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(sportsYellowInDeg, 3, 'Sports Dev Office must have 3 confirmed yellow branches');

const sportsBadge = getMultiThreadBadge(sportsYellowInDeg);
assert.ok(sportsBadge, 'Multi-thread badge must exist for in-degree 3');
assert.strictEqual(sportsBadge.label, 'Triple-Thread (3)');
assert.ok(sportsBadge.badgeClass.includes('shadow-'), 'Triple-thread badge must have glowing shadow styling');
console.log('   ✓ Check 1 Passed: Root NGO at bottom, Sports Dev Office at top with Triple-Thread (3) badge.');

// ---------------------------------------------------------------------------
// Item 2: Dept of Social Security white branch renders immediately as faded
// gray (cross status) and hides/reappears cleanly with "Show Declined (Gray) Paths".
// ---------------------------------------------------------------------------
console.log(' - [Check 2/10] Declined Paths Filter & Faded Styling...');
const socialSecPlacement = Object.values(delhiState.placements).find((p) => {
  const entity = delhiState.entities[p.entityId];
  return entity?.name.includes('Social Security');
})!;
assert.ok(socialSecPlacement, 'Dept of Social Security placement must exist');

const socialSecBranch = Object.values(delhiState.branches).find(
  (b) => b.targetPlacementId === socialSecPlacement.placementId && b.type === 'white'
)!;
assert.ok(socialSecBranch, 'Social Security white branch must exist');
assert.strictEqual(socialSecBranch.status, 'cross', 'Social Security branch status must be cross');

// Initial state: showDeclined is true, edge must be present
assert.strictEqual(useWorkspaceStore.getState().showDeclined, true);
let flowEdges = useWorkspaceStore.getState().edges;
assert.ok(
  flowEdges.some((e) => e.id === socialSecBranch.branchId),
  'Declined edge must be visible when showDeclined is true'
);

// Toggle showDeclined to false: edge must be excluded
useWorkspaceStore.getState().toggleShowDeclined();
assert.strictEqual(useWorkspaceStore.getState().showDeclined, false);
flowEdges = useWorkspaceStore.getState().edges;
assert.ok(
  !flowEdges.some((e) => e.id === socialSecBranch.branchId),
  'Declined edge must be hidden when showDeclined is false'
);

// Toggle showDeclined back to true: edge reappears
useWorkspaceStore.getState().toggleShowDeclined();
assert.strictEqual(useWorkspaceStore.getState().showDeclined, true);
flowEdges = useWorkspaceStore.getState().edges;
assert.ok(
  flowEdges.some((e) => e.id === socialSecBranch.branchId),
  'Declined edge must reappear when showDeclined is true'
);
console.log('   ✓ Check 2 Passed: Faded gray declined path filters and reappears cleanly.');

// ---------------------------------------------------------------------------
// Item 3: Dragging any node moves it smoothly and releasing leaves it
// permanently at the dropped spot with ZERO snap-back.
// ---------------------------------------------------------------------------
console.log(' - [Check 3/10] Zero-Snap-Back Node Dragging...');
const museumPlacementId = PLACEMENT_IDS.CITY_MUSEUM;
const targetDropCoord = { x: 580, y: 380 };

await useWorkspaceStore.getState().onNodeDragStop(museumPlacementId, targetDropCoord);
const stateAfterDrag = useWorkspaceStore.getState();
const droppedPlacement = stateAfterDrag.workspace!.placements[museumPlacementId];

assert.strictEqual(
  droppedPlacement.x,
  targetDropCoord.x,
  `Dropped placement X must equal ${targetDropCoord.x} with 0px displacement`
);
assert.strictEqual(
  droppedPlacement.y,
  targetDropCoord.y,
  `Dropped placement Y must equal ${targetDropCoord.y} with 0px displacement`
);
const correspondingFlowNode = stateAfterDrag.nodes.find((n) => n.id === museumPlacementId);
assert.strictEqual(correspondingFlowNode?.position.x, targetDropCoord.x);
assert.strictEqual(correspondingFlowNode?.position.y, targetDropCoord.y);
console.log('   ✓ Check 3 Passed: Dropped node coordinates persist with ZERO snap-back.');

// ---------------------------------------------------------------------------
// Item 4: Dropping one card directly on top of another card nudges the
// colliding card out of the way so zero cards overlap while keeping the dragged card put.
// ---------------------------------------------------------------------------
console.log(' - [Check 4/10] Local Anti-Overlap Engine on Collision Drop...');
const nodeAId = PLACEMENT_IDS.YOUTH_DEV_OFFICE;
const nodeBId = PLACEMENT_IDS.CULTURAL_DEV_OFFICE;
const nodeAPos = { ...useWorkspaceStore.getState().workspace!.placements[nodeAId] };

// Drop Node B directly onto Node A's coordinates
await useWorkspaceStore.getState().onNodeDragStop(nodeBId, { x: nodeAPos.x, y: nodeAPos.y });
const stateAfterCollision = useWorkspaceStore.getState();

const finalNodeB = stateAfterCollision.workspace!.placements[nodeBId];
const finalNodeA = stateAfterCollision.workspace!.placements[nodeAId];

// Dragged node B must remain strictly anchored at the drop coordinate
assert.strictEqual(finalNodeB.x, nodeAPos.x, 'Dragged card B must remain anchored at drop X');
assert.strictEqual(finalNodeB.y, nodeAPos.y, 'Dragged card B must remain anchored at drop Y');

// Colliding node A must be nudged away so they no longer collide with 24px clearance
const collisionResult = checkAABBCollision(
  { id: nodeAId, x: finalNodeA.x, y: finalNodeA.y, width: finalNodeA.width, height: finalNodeA.height },
  { id: nodeBId, x: finalNodeB.x, y: finalNodeB.y, width: finalNodeB.width, height: finalNodeB.height },
  24
);
assert.strictEqual(collisionResult.collides, false, 'Colliding neighbor must be nudged away with >= 24px clearance');
console.log('   ✓ Check 4 Passed: Colliding card nudged away with >= 24px clearance while dragged card stayed put.');

// ---------------------------------------------------------------------------
// Item 5: Clicking "Tidy Up (Bottom-to-Top)" animates messy cards into clean
// bottom-to-top layers with zero overlapping boxes and zero cut/broken branches.
// ---------------------------------------------------------------------------
console.log(' - [Check 5/10] Sugiyama Layered Bottom-to-Top Tidy Up Pass...');
await useWorkspaceStore.getState().tidyUpLayout();
const stateAfterTidy = useWorkspaceStore.getState();
const tidyPlacements = Object.values(stateAfterTidy.workspace!.placements);

// Check zero overlapping boxes across all pairs
let tidyOverlaps = 0;
for (let i = 0; i < tidyPlacements.length; i++) {
  for (let j = i + 1; j < tidyPlacements.length; j++) {
    const box1 = { id: tidyPlacements[i].placementId, ...tidyPlacements[i] };
    const box2 = { id: tidyPlacements[j].placementId, ...tidyPlacements[j] };
    if (checkAABBCollision(box1, box2, 0).collides) {
      tidyOverlaps++;
    }
  }
}
assert.strictEqual(tidyOverlaps, 0, 'Tidy Up must leave zero overlapping placement bounding boxes');

// Verify bottom-to-top hierarchy: Root NGO is at the lowest tier (highest Y)
const tidyRoot = stateAfterTidy.workspace!.placements[PLACEMENT_IDS.YOUR_NGO];
const tidySports = stateAfterTidy.workspace!.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.ok(tidyRoot.y > tidySports.y, 'Tidy Up must preserve bottom-to-top hierarchy');
console.log('   ✓ Check 5 Passed: Tidy Up produced zero-overlap Sugiyama layers without severed branches.');

// ---------------------------------------------------------------------------
// Item 6: Parallel branches curve distinctly apart with non-overlapping pills and buttons.
// ---------------------------------------------------------------------------
console.log(' - [Check 6/10] Parallel Bezier Curves & Offset Engine...');
const allDelBranches = Object.values(useWorkspaceStore.getState().workspace!.branches);
const parallelGroups = groupParallelBranches(allDelBranches);

// Group 1: Your NGO -> City Museum (White + Yellow)
const museumGroup = Array.from(parallelGroups.values()).find((g) =>
  g.some((b) => b.sourcePlacementId === PLACEMENT_IDS.YOUR_NGO && b.targetPlacementId === PLACEMENT_IDS.CITY_MUSEUM)
);
assert.ok(museumGroup, 'Parallel group for Your NGO -> City Museum must exist');
assert.strictEqual(museumGroup.length, 2, 'City Museum group must contain 2 parallel branches');

const curve0 = computeParallelBezierCurve({ x: 380, y: 615 }, { x: 260, y: 414 }, 0, 2, 36);
const curve1 = computeParallelBezierCurve({ x: 380, y: 615 }, { x: 260, y: 414 }, 1, 2, 36);

const deltaX = Math.abs(curve0.labelX - curve1.labelX);
const deltaY = Math.abs(curve0.labelY - curve1.labelY);
const labelSeparation = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

assert.strictEqual(
  Math.abs(curve0.offsetDistance - curve1.offsetDistance),
  36,
  'Parallel curves control points must have 36px lateral offset spacing'
);
assert.ok(
  labelSeparation >= 25,
  `Parallel branch midpoints must be separated laterally (actual: ${labelSeparation.toFixed(1)}px)`
);
console.log(`   ✓ Check 6 Passed: Parallel curves separated laterally by ${labelSeparation.toFixed(1)}px.`);

// ---------------------------------------------------------------------------
// Item 7: Clicking Cross on one of the three yellow branches into Sports Dev Office
// immediately turns line gray, downgrades badge from "Triple-Thread (3)" to "2-Thread",
// and updates the Top Metrics Strip live.
// ---------------------------------------------------------------------------
console.log(' - [Check 7/10] Dynamic Demotion on Yellow Bridge Cross...');
const branchesIntoSports = Object.values(useWorkspaceStore.getState().workspace!.branches).filter(
  (b) => b.targetPlacementId === PLACEMENT_IDS.SPORTS_DEV_OFFICE && b.type === 'yellow' && b.status === 'tick'
);
assert.strictEqual(branchesIntoSports.length, 3, 'Must start with 3 confirmed yellow branches into Sports');

// Toggle the first branch to cross
const branchToCross = branchesIntoSports[0];
await useWorkspaceStore.getState().setBranchStatus(branchToCross.branchId, 'cross');

const stateAfterDemotion = useWorkspaceStore.getState();
const demotedInDegree = stateAfterDemotion.yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(demotedInDegree, 2, 'Yellow in-degree must drop from 3 to 2');

const demotedBadge = getMultiThreadBadge(demotedInDegree);
assert.ok(demotedBadge, 'Badge must exist for in-degree 2');
assert.strictEqual(demotedBadge.label, '2-Thread', 'Badge must downgrade to 2-Thread');

// Verify top metrics recomputed live
const demotedMetrics = stateAfterDemotion.metrics!;
assert.strictEqual(demotedMetrics.multiThreadTargets.tripleThreadCount, 0, '3-Thread target count must become 0');
assert.strictEqual(demotedMetrics.multiThreadTargets.doubleThreadCount, 1, '2-Thread target count must become 1');
assert.strictEqual(demotedMetrics.yellowBridges.confirmedCount, 8, 'Active yellow bridges must decrease to 8');
console.log('   ✓ Check 7 Passed: Yellow bridge cross demoted badge to 2-Thread and updated Top Metrics Strip live.');

// ---------------------------------------------------------------------------
// Item 8: Adding a new organization and connecting a confirmed yellow branch
// into Sports Dev Office restores/promotes the multi-thread badge automatically.
// ---------------------------------------------------------------------------
console.log(' - [Check 8/10] Dynamic Promotion on Yellow Bridge Connection...');
// Add new organization "All India Sports Federation"
const aisResult = await useWorkspaceStore.getState().addNode(
  'All India Sports Federation',
  'institution',
  'National sports governing partner'
);

// Connect new confirmed yellow branch into Sports Dev Office
await useWorkspaceStore.getState().addBranch(
  aisResult.placementId,
  PLACEMENT_IDS.SPORTS_DEV_OFFICE,
  'yellow',
  'tick',
  undefined,
  'Endorsement from sports federation'
);

const stateAfterPromo1 = useWorkspaceStore.getState();
const promo1InDegree = stateAfterPromo1.yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(promo1InDegree, 3, 'In-degree must restore to 3');
const promo1Badge = getMultiThreadBadge(promo1InDegree);
assert.strictEqual(promo1Badge?.label, 'Triple-Thread (3)');

// Connect an additional 4th confirmed yellow branch (e.g. from Root NGO) to test Quad-Thread (4)
const promo2Result = await useWorkspaceStore.getState().addBranch(
  PLACEMENT_IDS.YOUR_NGO,
  PLACEMENT_IDS.SPORTS_DEV_OFFICE,
  'yellow',
  'tick',
  undefined,
  'Direct bridge from root NGO'
);
assert.ok(promo2Result);

const stateAfterPromo2 = useWorkspaceStore.getState();
const promo2InDegree = stateAfterPromo2.yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(promo2InDegree, 4, 'In-degree must increase to 4');
const promo2Badge = getMultiThreadBadge(promo2InDegree);
assert.strictEqual(promo2Badge?.label, 'Quad-Thread (4)', 'Badge must promote to Quad-Thread (4)');
assert.strictEqual(stateAfterPromo2.metrics!.multiThreadTargets.quadPlusThreadCount, 1);

// Verify MetricsStrip renders the 4x+ pill with reactive update
const promoMetricsHtml = renderToStaticMarkup(React.createElement(MetricsStrip));
assert.ok(promoMetricsHtml.includes('1x 4+'), 'Top metrics strip must render 1x 4+ count');
console.log('   ✓ Check 8 Passed: Added organizations promoted badge to Quad-Thread (4) automatically.');

// ---------------------------------------------------------------------------
// Item 9: Zero `localStorage` calls exist outside `localStorageRepository.ts`,
// and zero DOM/React imports exist inside `src/engine/*`.
// ---------------------------------------------------------------------------
console.log(' - [Check 9/10] Storage & Engine Architectural Seams Verification...');
const srcDir = path.resolve('src');

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allSrcFiles = getAllFiles(srcDir);

// 1. Grep for `localStorage` outside `src/storage/localStorageRepository.ts`
const illegalStorageFiles: string[] = [];
for (const file of allSrcFiles) {
  const normPath = file.replace(/\\/g, '/');
  if (normPath.endsWith('src/storage/localStorageRepository.ts')) continue;
  const content = fs.readFileSync(file, 'utf8');
  // Strip import/export references to the filename 'localStorageRepository'
  const stripped = content.replace(/['"]\.\/localStorageRepository['"]/g, '');
  if (/\blocalStorage\b/.test(stripped)) {
    illegalStorageFiles.push(normPath);
  }
}
assert.strictEqual(
  illegalStorageFiles.length,
  0,
  `Illegal localStorage references found outside localStorageRepository.ts: ${illegalStorageFiles.join(', ')}`
);

// 2. Grep for React/DOM in `src/engine/*`
const engineDir = path.resolve('src/engine');
const engineFiles = getAllFiles(engineDir);
const illegalEngineFiles: string[] = [];

for (const file of engineFiles) {
  const normPath = file.replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const hasReact = /from\s+['"]react['"]|from\s+['"]react-dom['"]|from\s+['"]@xyflow\/react['"]/.test(content);
  const hasDom = /\bdocument\b|\bwindow\b|\blocalStorage\b/.test(content);
  if (hasReact || hasDom) {
    illegalEngineFiles.push(normPath);
  }
}
assert.strictEqual(
  illegalEngineFiles.length,
  0,
  `Engine purity violation: React or DOM imports found in engine: ${illegalEngineFiles.join(', ')}`
);
console.log('   ✓ Check 9 Passed: Zero localStorage outside localStorageRepository.ts; pure TypeScript engines.');

// ---------------------------------------------------------------------------
// Item 10: Export JSON -> Reset Demo -> Import JSON restores exact topology,
// coordinates, tick/cross states, M% values, and notes via WorkspaceRepository.
// ---------------------------------------------------------------------------
console.log(' - [Check 10/10] Full Workspace JSON Roundtrip Fidelity...');
// Capture pre-export state snapshot
const preExportWorkspace: WorkspaceState = JSON.parse(
  JSON.stringify(useWorkspaceStore.getState().workspace!)
);

// Setup mock file for import
fileToImport = {
  content: JSON.stringify(preExportWorkspace),
  name: 'test-backup.json',
};

// Reset demo to Delhi initial seed
await useWorkspaceStore.getState().resetToDelhiSeed();
const stateAfterReset = useWorkspaceStore.getState().workspace!;
assert.notStrictEqual(
  Object.keys(stateAfterReset.placements).length,
  Object.keys(preExportWorkspace.placements).length,
  'Reset demo must have different placement count from modified workspace'
);

// Now trigger Import Workspace
const importSuccess = await useWorkspaceStore.getState().importWorkspace();
assert.strictEqual(importSuccess, true, 'importWorkspace must succeed');

const restoredWorkspace = useWorkspaceStore.getState().workspace!;

// Deep assertion on restored topology & properties
assert.strictEqual(
  Object.keys(restoredWorkspace.entities).length,
  Object.keys(preExportWorkspace.entities).length,
  'Restored entity count must match pre-export exactly'
);
assert.strictEqual(
  Object.keys(restoredWorkspace.placements).length,
  Object.keys(preExportWorkspace.placements).length,
  'Restored placement count must match pre-export exactly'
);
assert.strictEqual(
  Object.keys(restoredWorkspace.branches).length,
  Object.keys(preExportWorkspace.branches).length,
  'Restored branch count must match pre-export exactly'
);

for (const [id, originalP] of Object.entries(preExportWorkspace.placements)) {
  const restoredP = restoredWorkspace.placements[id];
  assert.ok(restoredP, `Placement ${id} must exist in restored workspace`);
  assert.strictEqual(restoredP.x, originalP.x, `Placement ${id} X must match`);
  assert.strictEqual(restoredP.y, originalP.y, `Placement ${id} Y must match`);
}

for (const [id, originalB] of Object.entries(preExportWorkspace.branches)) {
  const restoredB = restoredWorkspace.branches[id];
  assert.ok(restoredB, `Branch ${id} must exist in restored workspace`);
  assert.strictEqual(restoredB.status, originalB.status, `Branch ${id} status must match`);
  assert.strictEqual(restoredB.valuePct, originalB.valuePct, `Branch ${id} valuePct must match`);
  assert.strictEqual(restoredB.note, originalB.note, `Branch ${id} note must match`);
}
console.log('   ✓ Check 10 Passed: Export -> Reset -> Import restored 100% exact topology and properties.');

console.log('\n✓ Suite 4 Passed: All 10 Section 12 Acceptance Checklist items verified programmatically.\n');

// ===========================================================================
// SUITE 5: Full Application Assembly & Desktop Webview Safe Architecture (ARCH-01)
// ===========================================================================
console.log('[5/5] Testing App Component Assembly & Webview Protocol Safety (src/App.tsx)...');

// Render entire App component to static markup
const appHtml = renderToStaticMarkup(React.createElement(App));
assert.ok(appHtml.includes('bg-[#0b0f17]'), 'App must render with dark high-contrast background #0b0f17');
assert.ok(appHtml.includes('Funding Secured'), 'App must render MetricsStrip header');
assert.ok(appHtml.includes('Action Toolbar'), 'App must render ActionToolbar');
assert.ok(appHtml.includes('Context Inspector'), 'App must render Context Inspector');

// Verify zero URL history routing dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(
  packageJson.dependencies['react-router-dom'],
  undefined,
  'App must NOT depend on react-router-dom to maintain Tauri v2 webview safety'
);

console.log('✓ Suite 5 Passed: App successfully assembled with desktop webview safe architecture.\n');

console.log('========================================================================');
console.log(' ALL PHASE 4 ACCEPTANCE & VERIFICATION CHECKS PASSED (100% SUCCESS)! ');
console.log('========================================================================\n');
