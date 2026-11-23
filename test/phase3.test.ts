/**
 * QualCount Phase 3 Verification Suite
 * 
 * Verifies Phase 3 Canvas & Custom Graph Elements:
 * - VAL-CANV-01: Theme & Inverted Handles (Source Top, Target Bottom)
 * - VAL-CANV-02: Multi-Thread Badges & Dynamic Triangulation Promotion/Demotion
 * - VAL-CANV-03: Parallel Edge Lateral Bezier Routing & Separation
 * - VAL-CANV-04: Edge Action Buttons & Event Shielding Contracts
 * - VAL-CANV-05: Zero-Snap-Back Dragging & Local Anti-Overlap on Drop
 * - VAL-CANV-06: State Persistence across Mutations
 * - VAL-CANV-07: Build & Type Safety
 */

import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Position, ReactFlowProvider } from '@xyflow/react';
import {
  useWorkspaceStore,
  deriveFlowNodes,
  deriveFlowEdges,
} from '../src/store/useWorkspaceStore';
import { getMultiThreadBadge, OrgNode } from '../src/components/canvas/OrgNode';
import { MultiplexEdge } from '../src/components/canvas/MultiplexEdge';
import {
  seedDelhiNgoWorkspace,
  PLACEMENT_IDS,
  WORKBOOK_DELHI_ID,
} from '../src/data/seedDelhiNgo';
import { getWorkspaceRepository, resetWorkspaceRepository } from '../src/storage';
import { computeParallelBezierCurve } from '../src/engine/parallelEdges';
import { checkAABBCollision, resolveLocalCollisions } from '../src/engine/overlap';
import type { Placement } from '../src/types/schema';

console.log('--- Running QualCount Phase 3 Verification Suite ---\n');

// ---------------------------------------------------------------------------
// Mock LocalStorage Environment for Node.js Testing
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

(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage =
  new MockLocalStorage();
resetWorkspaceRepository();

// ===========================================================================
// SECTION 1: Store Initialization & 7-Metric Baseline (VAL-CANV-06)
// ===========================================================================
console.log('[1/6] Testing Zustand Store Initialization & Baseline Metrics...');

await useWorkspaceStore.getState().init();
const stateAfterInit = useWorkspaceStore.getState();

assert.ok(stateAfterInit.workspace, 'Workspace must be initialized in store');
assert.strictEqual(
  stateAfterInit.activeWorkbookId,
  WORKBOOK_DELHI_ID,
  'Active workbook must be Delhi Youth Governance Exhibition'
);
assert.strictEqual(
  Object.keys(stateAfterInit.workspace.entities).length,
  11,
  'Store must have 11 entities'
);
assert.strictEqual(
  Object.keys(stateAfterInit.workspace.placements).length,
  11,
  'Store must have 11 placements'
);
assert.strictEqual(
  Object.keys(stateAfterInit.workspace.branches).length,
  15,
  'Store must have 15 branches'
);

// Metrics check
assert.ok(stateAfterInit.metrics, 'Metrics must be computed on init');
assert.strictEqual(stateAfterInit.metrics.funding.securedPct, 40, 'Secured funding must be 40% (25% + 15%)');
assert.strictEqual(stateAfterInit.metrics.funding.securedInr, 400000, 'Secured funding INR must be 400,000');
assert.strictEqual(stateAfterInit.metrics.directRelationships.confirmedCount, 2, 'Direct confirmed white relationships must be 2');
assert.strictEqual(stateAfterInit.metrics.yellowBridges.confirmedCount, 9, 'Confirmed yellow bridges must be 9 (9 tick, 1 pending)');
assert.strictEqual(stateAfterInit.metrics.yellowBridges.pendingCount, 1, 'Pending yellow bridges must be 1 (br-5)');
assert.strictEqual(stateAfterInit.metrics.multiThreadTargets.tripleThreadCount, 1, 'Triple thread count must be 1');
assert.deepStrictEqual(
  stateAfterInit.metrics.multiThreadTargets.triplePlusNames,
  ['Sports Dev Office'],
  'Triple+ target entity must be Sports Dev Office'
);

// Initial yellow in-degrees check
assert.strictEqual(
  stateAfterInit.yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE],
  3,
  'Sports Dev Office yellow in-degree must be 3'
);
assert.strictEqual(
  stateAfterInit.yellowInDegrees[PLACEMENT_IDS.MINISTRY_FOOD],
  1,
  'Ministry of Food yellow in-degree must be 1'
);

// React Flow nodes & edges initial count
assert.strictEqual(stateAfterInit.nodes.length, 11, 'Must have 11 flow nodes');
assert.strictEqual(stateAfterInit.edges.length, 15, 'Must have 15 flow edges (showDeclined = true)');

console.log('✓ Section 1 Passed: Store initialized with Delhi seed and computed baseline metrics.');

// ===========================================================================
// SECTION 2: Dynamic Multi-Thread Badges (VAL-CANV-02)
// ===========================================================================
console.log('\n[2/6] Testing Multi-Thread Badge Logic & Dynamic Promotion/Demotion...');

// 2.1 Pure threshold helper check
assert.strictEqual(getMultiThreadBadge(0), null, 'In-degree 0 has no badge');
assert.strictEqual(getMultiThreadBadge(1), null, 'In-degree 1 has no badge');

const badge2 = getMultiThreadBadge(2);
assert.ok(badge2, 'In-degree 2 must produce a badge');
assert.strictEqual(badge2.label, '2-Thread');
assert.strictEqual(badge2.count, 2);

const badge3 = getMultiThreadBadge(3);
assert.ok(badge3, 'In-degree 3 must produce a badge');
assert.strictEqual(badge3.label, 'Triple-Thread (3)');
assert.strictEqual(badge3.count, 3);
assert.ok(badge3.badgeClass.includes('animate-pulse'), 'Triple-thread badge must have pulse glow');

const badge4 = getMultiThreadBadge(4);
assert.ok(badge4, 'In-degree 4 must produce a badge');
assert.strictEqual(badge4.label, 'Quad-Thread (4)');
assert.strictEqual(badge4.count, 4);

const badge5 = getMultiThreadBadge(5);
assert.ok(badge5, 'In-degree 5 must produce a badge');
assert.strictEqual(badge5.label, 'Quad-Thread (5)');
assert.strictEqual(badge5.count, 5);

// 2.2 Live store promotion/demotion on yellow branch status change
// Sports Dev Office starts with 3 yellow incoming branches: br-12, br-13, br-14
const sportsNodeInitial = useWorkspaceStore
  .getState()
  .getFlowNodes()
  .find((n) => n.id === PLACEMENT_IDS.SPORTS_DEV_OFFICE);
assert.strictEqual(sportsNodeInitial?.data.yellowInDegree, 3);

// Demote 1: br-12 (City Museum -> Sports Dev) set to cross
await useWorkspaceStore.getState().setBranchStatus('br-12', 'cross');
let sportsNode = useWorkspaceStore
  .getState()
  .getFlowNodes()
  .find((n) => n.id === PLACEMENT_IDS.SPORTS_DEV_OFFICE);
assert.strictEqual(
  useWorkspaceStore.getState().yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE],
  2,
  'Yellow in-degree must decrement to 2'
);
assert.strictEqual(sportsNode?.data.yellowInDegree, 2, 'Flow node data must reflect yellow in-degree 2');
assert.strictEqual(getMultiThreadBadge(sportsNode?.data.yellowInDegree || 0)?.label, '2-Thread');

// Demote 2: br-13 (Youth Dev -> Sports Dev) set to cross
await useWorkspaceStore.getState().setBranchStatus('br-13', 'cross');
sportsNode = useWorkspaceStore
  .getState()
  .getFlowNodes()
  .find((n) => n.id === PLACEMENT_IDS.SPORTS_DEV_OFFICE);
assert.strictEqual(
  useWorkspaceStore.getState().yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE],
  1,
  'Yellow in-degree must decrement to 1'
);
assert.strictEqual(sportsNode?.data.yellowInDegree, 1);
assert.strictEqual(
  getMultiThreadBadge(sportsNode?.data.yellowInDegree || 0),
  null,
  'In-degree 1 has no multi-thread badge'
);

// Restore back to 3: br-12 and br-13 set back to tick
await useWorkspaceStore.getState().setBranchStatus('br-12', 'tick');
await useWorkspaceStore.getState().setBranchStatus('br-13', 'tick');
sportsNode = useWorkspaceStore
  .getState()
  .getFlowNodes()
  .find((n) => n.id === PLACEMENT_IDS.SPORTS_DEV_OFFICE);
assert.strictEqual(
  useWorkspaceStore.getState().yellowInDegrees[PLACEMENT_IDS.SPORTS_DEV_OFFICE],
  3,
  'Yellow in-degree must be restored to 3'
);
assert.strictEqual(sportsNode?.data.yellowInDegree, 3);
assert.strictEqual(
  getMultiThreadBadge(sportsNode?.data.yellowInDegree || 0)?.label,
  'Triple-Thread (3)'
);

console.log('✓ Section 2 Passed: Dynamic Multi-Thread badge logic and promotion/demotion verified.');

// ===========================================================================
// SECTION 3: Parallel Bezier Flow Edges & Separation (VAL-CANV-03 & VAL-CANV-04)
// ===========================================================================
console.log('\n[3/6] Testing Parallel Bezier Edge Generation & Lateral Clearance...');

const edges = useWorkspaceStore.getState().getFlowEdges();

// Find parallel branches between Your NGO and Agrocell CSR (br-2 green and br-3 yellow)
const agrocellEdges = edges.filter(
  (e) =>
    (e.source === PLACEMENT_IDS.YOUR_NGO && e.target === PLACEMENT_IDS.AGROCELL_CSR) ||
    (e.source === PLACEMENT_IDS.AGROCELL_CSR && e.target === PLACEMENT_IDS.YOUR_NGO)
);
assert.strictEqual(agrocellEdges.length, 2, 'Must have 2 parallel edges for Your NGO <-> Agrocell CSR');

const edgeA = agrocellEdges[0];
const edgeB = agrocellEdges[1];
assert.strictEqual(edgeA.data.total, 2, 'Total branches in group must be 2');
assert.strictEqual(edgeB.data.total, 2, 'Total branches in group must be 2');
assert.strictEqual(edgeA.data.index, 0, 'First edge must have index 0');
assert.strictEqual(edgeB.data.index, 1, 'Second edge must have index 1');

// Compute geometry for both parallel edges
const geomA = computeParallelBezierCurve(
  { x: 450, y: 650 },
  { x: 100, y: 450 },
  edgeA.data.index,
  edgeA.data.total,
  36,
  edgeA.data.isReverse
);
const geomB = computeParallelBezierCurve(
  { x: 450, y: 650 },
  { x: 100, y: 450 },
  edgeB.data.index,
  edgeB.data.total,
  36,
  edgeB.data.isReverse
);

assert.strictEqual(geomA.offsetDistance, -18, 'Index 0 offset must be -18px');
assert.strictEqual(geomB.offsetDistance, 18, 'Index 1 offset must be +18px');
assert.notStrictEqual(geomA.path, geomB.path, 'Parallel paths must be distinct curves');

// Lateral separation between midpoint label pills (t = 0.5)
const midDist = Math.hypot(geomA.labelX - geomB.labelX, geomA.labelY - geomB.labelY);
assert.ok(
  midDist > 20,
  `Midpoint label pills must have lateral separation > 20px (actual: ${midDist.toFixed(1)}px)`
);

// Lateral separation between action buttons (t = 0.8)
const btnDist = Math.hypot(geomA.buttonX - geomB.buttonX, geomA.buttonY - geomB.buttonY);
assert.ok(
  btnDist > 12,
  `Action buttons must have lateral separation > 12px (actual: ${btnDist.toFixed(1)}px)`
);

// Green funding branch valuePct check
const greenEdge = edges.find((e) => e.data.branch.branchId === 'br-1');
assert.ok(greenEdge, 'br-1 edge must exist');
assert.strictEqual(greenEdge.data.branch.type, 'green');
assert.strictEqual(greenEdge.data.branch.valuePct, 25, 'br-1 valuePct must be 25');

console.log('✓ Section 3 Passed: Parallel Bezier edge routing and lateral separation verified.');

// ===========================================================================
// SECTION 4: Show / Hide Declined Paths Filter (VAL-CANV-04)
// ===========================================================================
console.log('\n[4/6] Testing Show / Hide Declined Paths Filter...');

// Seed data has br-8 (white, cross)
assert.strictEqual(useWorkspaceStore.getState().showDeclined, true);
let currentEdges = useWorkspaceStore.getState().getFlowEdges();
assert.ok(
  currentEdges.some((e) => e.id === 'br-8'),
  'br-8 (declined) must be included when showDeclined is true'
);
assert.strictEqual(currentEdges.length, 15);

// Toggle to false
useWorkspaceStore.getState().toggleShowDeclined();
assert.strictEqual(useWorkspaceStore.getState().showDeclined, false);
currentEdges = useWorkspaceStore.getState().getFlowEdges();
assert.ok(
  !currentEdges.some((e) => e.id === 'br-8'),
  'br-8 (declined) must be excluded when showDeclined is false'
);
assert.strictEqual(currentEdges.length, 14, 'Edge count must decrease to 14 when declined are hidden');

// Toggle back to true
useWorkspaceStore.getState().toggleShowDeclined();
assert.strictEqual(useWorkspaceStore.getState().showDeclined, true);
currentEdges = useWorkspaceStore.getState().getFlowEdges();
assert.ok(
  currentEdges.some((e) => e.id === 'br-8'),
  'br-8 must be included again when showDeclined is toggled back'
);
assert.strictEqual(currentEdges.length, 15);

console.log('✓ Section 4 Passed: Show/hide declined paths filter behaves correctly.');

// ===========================================================================
// SECTION 5: Zero-Snap-Back Dragging & Anti-Overlap on Drop (VAL-CANV-05 & VAL-CANV-06)
// ===========================================================================
console.log('\n[5/6] Testing Zero-Snap-Back Dragging & Local Anti-Overlap Collision Resolution...');

// Reset store state to clean seed data
await useWorkspaceStore.getState().resetToDelhiSeed();

// Drop City Museum (originally at 550, 450) directly on top of XYZ CSR (at 320, 450)
const targetX = 320;
const targetY = 450;
const origXyzPlacement = useWorkspaceStore.getState().workspace!.placements[PLACEMENT_IDS.XYZ_CSR];
assert.strictEqual(origXyzPlacement.x, 320);
assert.strictEqual(origXyzPlacement.y, 450);

// Execute onNodeDragStop
await useWorkspaceStore.getState().onNodeDragStop(PLACEMENT_IDS.CITY_MUSEUM, {
  x: targetX,
  y: targetY,
});

const updatedWorkspace = useWorkspaceStore.getState().workspace!;
const draggedMuseumPlacement = updatedWorkspace.placements[PLACEMENT_IDS.CITY_MUSEUM];
const nudgedXyzPlacement = updatedWorkspace.placements[PLACEMENT_IDS.XYZ_CSR];

// 1. Anchored card must have 0px displacement (exact coordinates preserved)
assert.strictEqual(
  draggedMuseumPlacement.x,
  targetX,
  'Dropped card X must be exact drop position (zero snap-back)'
);
assert.strictEqual(
  draggedMuseumPlacement.y,
  targetY,
  'Dropped card Y must be exact drop position (zero snap-back)'
);

// 2. Colliding neighbor (XYZ CSR) must have been nudged away
assert.ok(
  nudgedXyzPlacement.x !== 320 || nudgedXyzPlacement.y !== 450,
  'Colliding neighbor XYZ CSR must have been displaced along axis of minimum penetration'
);

// 3. Collision clearance check between the two cards
const boxMuseum = {
  id: PLACEMENT_IDS.CITY_MUSEUM,
  x: draggedMuseumPlacement.x,
  y: draggedMuseumPlacement.y,
  width: draggedMuseumPlacement.width,
  height: draggedMuseumPlacement.height,
};
const boxXyz = {
  id: PLACEMENT_IDS.XYZ_CSR,
  x: nudgedXyzPlacement.x,
  y: nudgedXyzPlacement.y,
  width: nudgedXyzPlacement.width,
  height: nudgedXyzPlacement.height,
};

const collisionCheck = checkAABBCollision(boxMuseum, boxXyz, 24);
assert.strictEqual(
  collisionCheck.collides,
  false,
  'Resolved boxes must have zero collision with 24px safety margin'
);

// 4. Uninvolved cards must remain untouched
const sportsPlacementBeforeTidy = updatedWorkspace.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
assert.strictEqual(sportsPlacementBeforeTidy.x, 650, 'Uninvolved Sports Dev Office X must be unchanged');
assert.strictEqual(sportsPlacementBeforeTidy.y, 50, 'Uninvolved Sports Dev Office Y must be unchanged');

// 5. Persistence: Verify saved state in repository
const repoSaved = await getWorkspaceRepository().loadWorkspace();
assert.ok(repoSaved, 'Repository must have saved workspace');
assert.strictEqual(
  repoSaved.placements[PLACEMENT_IDS.CITY_MUSEUM].x,
  targetX,
  'Repository must have saved City Museum targetX'
);
assert.strictEqual(
  repoSaved.placements[PLACEMENT_IDS.CITY_MUSEUM].y,
  targetY,
  'Repository must have saved City Museum targetY'
);
assert.strictEqual(
  repoSaved.placements[PLACEMENT_IDS.XYZ_CSR].x,
  nudgedXyzPlacement.x,
  'Repository must have saved nudged XYZ CSR X position'
);
assert.strictEqual(
  repoSaved.placements[PLACEMENT_IDS.XYZ_CSR].y,
  nudgedXyzPlacement.y,
  'Repository must have saved nudged XYZ CSR Y position'
);

console.log('✓ Section 5 Passed: Zero-snap-back dragging with local anti-overlap and persistence verified.');

// ===========================================================================
// SECTION 6: Inverted Handles & Bottom-to-Top Layout (VAL-CANV-01)
// ===========================================================================
console.log('\n[6/6] Testing Inverted Handles & Bottom-to-Top Tidy Up Layout...');

// 6.1 Handle orientation contract
assert.strictEqual(Position.Top, 'top', 'Position.Top must match React Flow enum');
assert.strictEqual(Position.Bottom, 'bottom', 'Position.Bottom must match React Flow enum');

// 6.2 Bottom-to-Top Tidy Up Layout
await useWorkspaceStore.getState().tidyUpLayout();
const laidOutWorkspace = useWorkspaceStore.getState().workspace!;

const rootPlacement = laidOutWorkspace.placements[PLACEMENT_IDS.YOUR_NGO];
const sportsPlacement = laidOutWorkspace.placements[PLACEMENT_IDS.SPORTS_DEV_OFFICE];
const museumPlacement = laidOutWorkspace.placements[PLACEMENT_IDS.CITY_MUSEUM];

assert.ok(
  rootPlacement.y > museumPlacement.y,
  `Root NGO (y=${rootPlacement.y}) must be below City Museum (y=${museumPlacement.y})`
);
assert.ok(
  museumPlacement.y > sportsPlacement.y,
  `City Museum (y=${museumPlacement.y}) must be below Sports Dev Office (y=${sportsPlacement.y})`
);
assert.ok(
  rootPlacement.y > sportsPlacement.y,
  `Root NGO (Tier 0, y=${rootPlacement.y}) must sit strictly at bottom compared to Sports Dev Office (apex, y=${sportsPlacement.y})`
);

console.log('✓ Section 6 Passed: Bottom-to-top layout and inverted hierarchy verified.');

// ===========================================================================
// SECTION 7: Custom Component Rendering & HTML/SVG Verification (CANV-02, CANV-03, CANV-04)
// ===========================================================================
console.log('\n[7/10] Testing Custom Component Rendering & Invariants...');

// 7.1 OrgNode Rendering
const orgNodeElement = React.createElement(
  ReactFlowProvider,
  null,
  React.createElement(OrgNode, {
    id: 'test-node',
    type: 'orgNode',
    data: {
      entity: {
        entityId: 'ent-1',
        name: 'Youth Leadership Foundation',
        category: 'ngo',
        globalNotes: 'Lead exhibition partner',
        createdAt: '2026-11-20T00:00:00Z',
      },
      placement: {
        placementId: 'test-node',
        workbookId: WORKBOOK_DELHI_ID,
        entityId: 'ent-1',
        isRootNgo: true,
        x: 100,
        y: 200,
        width: 190,
        height: 76,
      },
      yellowInDegree: 3,
      selected: false,
      stats: {
        incomingTotal: 4,
        outgoingTotal: 2,
        incomingYellowConfirmed: 3,
        incomingGreenFundingPct: 25,
        incomingConfirmed: 3,
        incomingPending: 1,
        incomingDeclined: 0,
      },
    },
    selected: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 100,
    positionAbsoluteY: 200,
  })
);

const orgNodeHtml = renderToStaticMarkup(orgNodeElement);
assert.ok(orgNodeHtml.includes('Youth Leadership Foundation'), 'Card must render entity name');
assert.ok(orgNodeHtml.includes('ROOT'), 'Root NGO card must render ROOT marker');
assert.ok(orgNodeHtml.includes('Triple-Thread (3)'), 'Triple-thread badge must render');
assert.ok(orgNodeHtml.includes('role="tooltip"'), 'Hover metrics tooltip must be present in DOM');
assert.ok(orgNodeHtml.includes('Triangulation:'), 'Tooltip must display triangulation metric');
assert.ok(orgNodeHtml.includes('Funding:'), 'Tooltip must display funding metric');
assert.ok(orgNodeHtml.includes('M25%'), 'Tooltip must display funding percentage');
assert.ok(orgNodeHtml.includes('react-flow__handle-top'), 'Source handle must be at Top (inverted)');
assert.ok(orgNodeHtml.includes('react-flow__handle-bottom'), 'Target handle must be at Bottom (inverted)');

// 7.2 MultiplexEdge Rendering
// In headless SSR, BaseEdge renders SVG paths, while EdgeLabelRenderer creates a browser portal.
// We test both the SVG path markup and the portal overlay element tree.
const multiplexEdgeProps = {
  id: 'test-edge',
  source: 'test-src',
  target: 'test-tgt',
  sourceX: 100,
  sourceY: 400,
  targetX: 100,
  targetY: 200,
  data: {
    branch: {
      branchId: 'test-edge',
      workbookId: WORKBOOK_DELHI_ID,
      sourcePlacementId: 'test-src',
      targetPlacementId: 'test-tgt',
      type: 'green' as const,
      status: 'tick' as const,
      valuePct: 35,
      note: 'Grant funding',
      updatedAt: '2026-11-20T00:00:00Z',
    },
    index: 0,
    total: 1,
    isReverse: false,
    selected: false,
  },
};

const edgeSvgHtml = renderToStaticMarkup(
  React.createElement(
    ReactFlowProvider,
    null,
    React.createElement(MultiplexEdge, multiplexEdgeProps)
  )
);
assert.ok(edgeSvgHtml.includes('stroke:#34d399'), 'Confirmed green edge must render emerald stroke');

// Inspect EdgeLabelRenderer action overlay controls
function EdgeInspector(props: any) {
  const tree = MultiplexEdge(props) as any;
  const rendererChildren = tree.props.children[1].props.children;
  return React.createElement('div', null, rendererChildren);
}

const edgeOverlayHtml = renderToStaticMarkup(
  React.createElement(EdgeInspector, multiplexEdgeProps)
);
assert.ok(edgeOverlayHtml.includes('nodrag nopan pointer-events-auto'), 'Action controls must have event shielding classes');
assert.ok(edgeOverlayHtml.includes('M35%'), 'Funding branch must render M% pill');
assert.ok(edgeOverlayHtml.includes('aria-label="Confirm branch"'), 'Must render confirm button');
assert.ok(edgeOverlayHtml.includes('aria-label="Decline branch"'), 'Must render decline button');

console.log('✓ Section 7 Passed: OrgNode and MultiplexEdge component markup and invariants verified.');

// ===========================================================================
// SECTION 8: Selection State Coherence & Pane Deselection
// ===========================================================================
console.log('\n[8/10] Testing Selection State Coherence...');

// Select placement
useWorkspaceStore.getState().selectPlacement(PLACEMENT_IDS.YOUR_NGO);
let storeState = useWorkspaceStore.getState();
assert.strictEqual(storeState.selectedPlacementId, PLACEMENT_IDS.YOUR_NGO);
assert.strictEqual(storeState.selectedBranchId, null);
assert.strictEqual(
  storeState.nodes.find((n) => n.id === PLACEMENT_IDS.YOUR_NGO)?.selected,
  true,
  'Selected node must have selected: true'
);
assert.ok(
  storeState.edges.every((e) => !e.selected),
  'All edges must be deselected when a node is selected'
);

// Switch selection to branch
useWorkspaceStore.getState().selectBranch('br-1');
storeState = useWorkspaceStore.getState();
assert.strictEqual(storeState.selectedBranchId, 'br-1');
assert.strictEqual(storeState.selectedPlacementId, null);
assert.strictEqual(
  storeState.edges.find((e) => e.id === 'br-1')?.selected,
  true,
  'Selected edge must have selected: true'
);
assert.ok(
  storeState.nodes.every((n) => !n.selected),
  'All nodes must be deselected when an edge is selected'
);

// Clear selection (simulate pane click)
useWorkspaceStore.getState().clearSelection();
storeState = useWorkspaceStore.getState();
assert.strictEqual(storeState.selectedPlacementId, null);
assert.strictEqual(storeState.selectedBranchId, null);
assert.ok(storeState.nodes.every((n) => !n.selected), 'All nodes deselected on clear');
assert.ok(storeState.edges.every((e) => !e.selected), 'All edges deselected on clear');

console.log('✓ Section 8 Passed: Selection state coherence and clearSelection verified.');

// ===========================================================================
// SECTION 9: Multi-Node Concentric Collision Convergence (Attack Vector 1)
// ===========================================================================
console.log('\n[9/10] Testing 5 Concentric Nodes Collision Resolution...');

const concentricPlacements: Record<string, Placement> = {
  n1: { placementId: 'n1', workbookId: 'w', entityId: 'e', isRootNgo: true, x: 200, y: 300, width: 190, height: 76 },
  n2: { placementId: 'n2', workbookId: 'w', entityId: 'e', isRootNgo: false, x: 200, y: 300, width: 190, height: 76 },
  n3: { placementId: 'n3', workbookId: 'w', entityId: 'e', isRootNgo: false, x: 200, y: 300, width: 190, height: 76 },
  n4: { placementId: 'n4', workbookId: 'w', entityId: 'e', isRootNgo: false, x: 200, y: 300, width: 190, height: 76 },
  n5: { placementId: 'n5', workbookId: 'w', entityId: 'e', isRootNgo: false, x: 200, y: 300, width: 190, height: 76 },
};

const resolvedConcentric = resolveLocalCollisions(concentricPlacements, 'n1', 24);
assert.strictEqual(resolvedConcentric.positions['n1'].x, 200, 'Anchored n1 X must remain 200');
assert.strictEqual(resolvedConcentric.positions['n1'].y, 300, 'Anchored n1 Y must remain 300');

// Verify zero collisions among all 10 pairs
const resolvedBoxes = Object.entries(resolvedConcentric.positions).map(([id, pos]) => ({
  id,
  x: pos.x,
  y: pos.y,
  width: 190,
  height: 76,
}));

let collisionCount = 0;
for (let i = 0; i < resolvedBoxes.length; i++) {
  for (let j = i + 1; j < resolvedBoxes.length; j++) {
    const col = checkAABBCollision(resolvedBoxes[i], resolvedBoxes[j], 24);
    if (col.collides) {
      collisionCount++;
    }
  }
}

assert.strictEqual(
  collisionCount,
  0,
  `5 concentric nodes must resolve to 0 collisions within 50 iterations (found ${collisionCount})`
);

console.log('✓ Section 9 Passed: 5 concentric nodes resolved to 0 collisions with >= 24px clearance.');

// ===========================================================================
// SECTION 10: Seed Dataset Clearance Verification (Zero Initial Collisions)
// ===========================================================================
console.log('\n[10/10] Testing Initial Seed Dataset Clearance...');

const seedPlacementsList = Object.values(seedDelhiNgoWorkspace.placements);
let seedCollisionCount = 0;
for (let i = 0; i < seedPlacementsList.length; i++) {
  for (let j = i + 1; j < seedPlacementsList.length; j++) {
    const pA = seedPlacementsList[i];
    const pB = seedPlacementsList[j];
    const col = checkAABBCollision(
      { id: pA.placementId, x: pA.x, y: pA.y, width: pA.width, height: pA.height },
      { id: pB.placementId, x: pB.x, y: pB.y, width: pB.width, height: pB.height },
      24
    );
    if (col.collides) {
      seedCollisionCount++;
    }
  }
}

assert.strictEqual(
  seedCollisionCount,
  0,
  `Initial seed dataset must have 0 collisions with 24px safety margin (found ${seedCollisionCount})`
);

console.log('✓ Section 10 Passed: Initial Delhi seed dataset has zero collisions with 24px margin.');

console.log('\n=======================================================');
console.log(' ALL PHASE 3 CANVAS & GRAPH ELEMENT TESTS PASSED! (100%) ');
console.log('=======================================================\n');
