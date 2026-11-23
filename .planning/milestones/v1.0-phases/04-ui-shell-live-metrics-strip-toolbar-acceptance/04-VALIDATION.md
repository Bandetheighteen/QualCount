# Phase 4 Validation Strategy: UI Shell, Live Metrics Strip & Acceptance Checklist

## Purpose
This document defines the validation criteria, automated test suites, and integration assertions required to verify that the complete QualCount application satisfies all functional and non-functional requirements and passes every item on the 10-point acceptance checklist.

---

## Acceptance Criteria & Quality Gates

| ID | Category | Requirement | Validation Method | Target Result |
|----|----------|-------------|-------------------|---------------|
| **VAL-UI-01** | Metrics Strip | Live Top Metrics Strip displays all 7 metrics with reactive updates | Unit test & store subscription | Recomputes immediately on every branch/placement edit |
| **VAL-UI-02** | Toolbar Deduplication | "Add Node" autocompletes against `state.entities` and reuses existing `entityId` | Unit test & state inspection | No duplicate entities created for matching names |
| **VAL-UI-03** | Branch Creation | "Connect Branch" allows multiplex lines and blocks self-loops | Unit test & error boundary | Rejects `source === target`; supports multiple parallel lines |
| **VAL-UI-04** | Context Inspector | Allows editing entity/branch metadata and deleting non-root placements | Unit test & store action | Root NGO removal blocked; branch deletion updates metrics |
| **VAL-UI-05** | Acceptance Checklist 1 | Root NGO at bottom, Sports Dev Office at top with "Triple-Thread (3)" | Headless state assertion | Delhi seed initial layout tiers and badge match specification |
| **VAL-UI-06** | Acceptance Checklist 2 | Faded gray path toggle hides and reappears cleanly | Store filter assertion | Cross status branches filtered when `showDeclined = false` |
| **VAL-UI-07** | Acceptance Checklist 3-4 | Persistent zero-snap-back dragging with local collision nudging | Math & engine assertion | Dragged node $dx = 0, dy = 0$; colliding neighbors shifted $\ge 24\text{px}$ |
| **VAL-UI-08** | Acceptance Checklist 5 | "Tidy Up" reorganizes cards into clean Sugiyama tiers | elkjs engine assertion | Zero overlapping boxes and ordered vertical tiers |
| **VAL-UI-09** | Acceptance Checklist 6 | Parallel curves (City Museum, Agrocell) compute non-overlapping paths | Bezier math assertion | Spacing $\ge 36\text{px}$, distinct M% pills and button coordinates |
| **VAL-UI-10** | Acceptance Checklist 7-8 | Yellow bridge status toggles dynamically promote/demote badges | Store mutation assertion | 3 $\to$ 2 ("Triple-Thread" to "2-Thread"); 3 $\to$ 4 ("Quad-Thread") |
| **VAL-UI-11** | Acceptance Checklist 9 | Strict architectural seams (zero `localStorage` leaks, pure engine) | Grep code scanning | 0 instances outside `localStorageRepository.ts` and `src/engine/*` |
| **VAL-UI-12** | Acceptance Checklist 10 | Export $\to$ Reset $\to$ Import roundtrip fidelity | Repository serialization | Exact graph topology, coordinates, M%, and notes restored |
| **VAL-UI-13** | Production Build | Full TypeScript compilation and production asset bundling | `npm run build` | Exits with code 0 and zero TypeScript errors |

---

## Test Implementation Plan (`test/phase4.test.ts`)

The Phase 4 test suite will implement comprehensive integration assertions:

1. **Top Live Metrics Strip Suite**:
   - Validates live recalculation of all 7 metrics upon mutating branches.
   - Tests funding progress percentage, INR calculation, white confirmation rate, owned conversions, multi-thread targets, top amplifier, and concentration risk alert threshold ($> 30\%$).

2. **Entity Deduplication & Branch Connection Suite**:
   - Tests `addNode` with an existing entity name (verifies `entityId` is reused and placement count increases without adding duplicate entity records).
   - Tests `addNode` with a new entity name (creates new `Entity` and `Placement`).
   - Tests `addBranch` between existing nodes, ensuring multiple branch types between the same pair succeed while self-loops fail.

3. **Context Inspector Actions Suite**:
   - Tests updating entity name, category, and notes via inspector.
   - Tests updating branch status, type, M%, and notes via inspector.
   - Tests removing non-root placement and cascades (attached branches removed cleanly).
   - Tests root NGO removal prevention.

4. **10-Point Acceptance Checklist Automated Verification Suite**:
   - Implements automated checks for every single item on the Section 12 Acceptance Checklist.
   - Emits a structured pass/fail report for each item.
