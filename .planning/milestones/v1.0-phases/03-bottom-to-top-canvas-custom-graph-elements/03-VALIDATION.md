# Phase 3 Validation Strategy: Bottom-to-Top Canvas & Custom Graph Elements

## Purpose

This document outlines the verification criteria, automated tests, and interactive quality checks required to ensure that Phase 3 deliverables meet all specified requirements before proceeding to Phase 4.

---

## Acceptance Criteria & Quality Gates

| ID | Category | Requirement | Validation Method | Target Result |
|----|----------|-------------|-------------------|---------------|
| **VAL-CANV-01** | Theme & Inverted Handles | Canvas mounts with `#0b0f17` background and handles are inverted (source = Top, target = Bottom) | Code inspection & TypeScript check | Source handle `Position.Top`, target handle `Position.Bottom` |
| **VAL-CANV-02** | Multi-Thread Badging | Node card renders dynamic badge based on confirmed yellow in-degree | Unit & integration test | 2: `"2-Thread"`, 3: `"Triple-Thread (3)"`, 4+: `"Quad-Thread (N)"`, <2: none |
| **VAL-CANV-03** | Parallel Edge Routing | Concurrent branches between same pair compute distinct Bezier offsets | Unit test & visual math | Spacing >= 36px, zero line collision, separate pill & button coordinates |
| **VAL-CANV-04** | Edge Action Buttons | Tick and Cross buttons update branch status with complete event isolation | Unit test & event handler verification | `e.stopPropagation()` on click/pointerDown, status transitions cleanly |
| **VAL-CANV-05** | Zero-Snap-Back & Anti-Overlap | Dropping a dragged node preserves its coordinates while nudging colliding neighbors | Anti-overlap unit test | Dragged node dx=0, dy=0; colliding neighbors shifted >= 24px margin |
| **VAL-CANV-06** | State Persistence | All coordinate nudges and status toggles commit to `WorkspaceRepository` | Mock repository spy | `saveWorkspace()` invoked with updated state matching schema |
| **VAL-CANV-07** | Build & Type Safety | Zero TypeScript compiler errors or bundling warnings | `npm run build` | `tsc && vite build` exits 0 with zero errors |

---

## Test Implementation Plan: `test/phase3.test.ts`

1. **Zustand Workspace Store Tests**:
   - `store.init()`: Successfully initializes with Delhi seed data when repository is empty.
   - `store.setBranchStatus(branchId, status)`: Updates status, recomputes live metrics, and updates `yellowInDegree` on target placements.
   - Dynamic Multi-Thread Badge Promotion/Demotion:
     - Target node with 3 ticked yellow branches starts with `"Triple-Thread (3)"`.
     - Toggling one yellow branch to `cross` demotes badge to `"2-Thread"`.
     - Toggling another to `cross` removes the badge (< 2).
     - Restoring branches to `tick` restores `"Triple-Thread (3)"`.
   - `store.onNodeDragStop(placementId, newPos)`:
     - Dragged node coordinates are exact (`x = newPos.x, y = newPos.y`).
     - Overlapping neighbors are nudged away without displacing the dragged node.
     - New coordinates are saved to repository.
   - `store.tidyUpLayout()`:
     - Updates all placements using bottom-to-top layout.
     - Confirms root NGO is at bottom (largest y) and target ministries at top (smallest y).

2. **Flow Transformation Tests**:
   - `getFlowNodes(workspace)`: Generates valid React Flow `Node` array with `type: 'orgNode'`, correct handle settings, and multi-thread badges.
   - `getFlowEdges(workspace, showDeclined)`: Generates valid React Flow `Edge` array with parallel curve indices, M% values, and filters/dims cross edges when `showDeclined = false`.

3. **Event Shielding & DOM Contract Tests**:
   - Verifies class name contract: `nodrag`, `nopan`, `pointer-events-auto` are attached to edge action containers.
