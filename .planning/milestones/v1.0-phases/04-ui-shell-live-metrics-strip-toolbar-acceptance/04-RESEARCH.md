# Phase 4 Research: UI Shell, Live Metrics Strip, Toolbar & End-to-End Acceptance

## Executive Summary

Phase 4 unites all preceding phases into a finished, offline-ready desktop web application. The UI shell consists of four integrated components:
1. **Live Top Quantitative Metrics Strip** (`src/components/metrics/MetricsStrip.tsx`)
2. **Compact Action Toolbar** (`src/components/toolbar/ActionToolbar.tsx`) with modal dialogs for node creation and branch connections
3. **Collapsible Context Inspector Drawer** (`src/components/inspector/InspectorDrawer.tsx`)
4. **Desktop Application Shell** (`src/App.tsx`)

This research establishes the component architecture, state synchronization, entity deduplication mechanics, modal interaction patterns, and programmatic verification against the 10-point acceptance checklist.

---

## 1. Top Live Quantitative Metrics Strip Design

### 7-Metric Dashboard Cards
The metrics strip sits directly above the canvas, spanning the full viewport width. It provides immediate, objective quantitative feedback derived strictly from live graph topology:

| Metric | Visual Representation | Edge/Branch Status Rule |
|--------|-----------------------|-------------------------|
| **1. Funding Secured** | Dual-tier progress bar: Secured `M{securedPct}` (green solid) + Pending `M{pendingPct}` (green dashed); displays formatted INR (`₹4,00,000 / ₹10,00,000`). | Strict `status === 'tick'` for secured; `status === 'pending'` for pending. |
| **2. Direct Relationships** | White ring indicator: `confirmed` (bright white) / `pending` / `declined` counts, plus confirmation rate %. | Strict count of white branches grouped by status. |
| **3. Confirmed Bridges** | Yellow network icon with total confirmed yellow branch count. | Strict count of `type === 'yellow'` and `status === 'tick'`. |
| **4. Owned Conversions** | Pill badge: `converted / referred` count and `conversionPct%`. | Receptive referrals with confirmed white relationship. |
| **5. Multi-Thread Targets** | Triangulation pills: `2-Thread` (amber), `3-Thread` (glowing amber), `4x+` (gold); displays target partner names. | Placements with confirmed yellow in-degree $\ge 2$. |
| **6. Top Amplifier** | Partner name, direct yellow out-degree, and total unique confirmed downstream reachable count via BFS. | Computed from `getNodeAmplifierReach()`. |
| **7. Concentration Risk** | Risk percentage (`concentrationPct%`) and single-point-of-failure partner name. | Highlighted in `rose-400 bg-rose-500/10 border-rose-500/30` if $> 30\%$. |

---

## 2. Action Toolbar & Modal Workflows

### 2.1 Entity Deduplication in "Add Node"
In social sector ecosystems, multiple workbooks and campaigns frequently engage the same corporate partners or government departments.
- **Workflow**:
  1. The user types into the "Organization Name" text field.
  2. The input presents live autocomplete recommendations from `state.entities` (case-insensitive substring matching).
  3. If the user selects an existing entity, its `entityId` is reused, preventing duplicated entity records in storage.
  4. If the user types a new entity name, a new `Entity` record is created with a generated UUID.
  5. The new `Placement` is positioned at a clear coordinate (e.g., horizontally centered, vertical tier offset) and checked via `resolveLocalCollisions()` to ensure zero overlap.
  6. The new placement is automatically selected in state, opening the inspector drawer.

### 2.2 "Connect Branch" Dialog
- **Workflow**:
  1. Select Source Node and Target Node (dropdowns listing all active placements with entity names).
  2. Prevent self-loops: Submit button disabled if `sourcePlacementId === targetPlacementId`.
  3. Select Line Type:
     - `Green: Financial Funding`
     - `White: Direct Relationship`
     - `Yellow: Network Bridge`
  4. Select Initial Status: `Pending`, `Tick (Confirmed)`, or `Cross (Declined)`.
  5. Conditional Inputs:
     - When `Green` is selected: Numeric `M%` input (strict percentage 1-100 of workbook target budget).
     - When `White` or `Yellow` is selected: Qualitative `Note` input.
  6. Clicking `"Connect"` creates the `Branch` record with a UUID, updates live metrics, and commits to `WorkspaceRepository`. Multiple branches between the same placement pair are fully supported and will curve apart automatically.

### 2.3 Canvas & Storage Controls
- **Tidy Up**: Invokes `tidyUpLayout()` from the store, reorganizing placements into bottom-to-top Sugiyama tiers via `computeHierarchicalLayout()`.
- **Show Declined Paths**: Checkbox/toggle bound to `showDeclined` in Zustand store (default: `true`). When unchecked, cross-status edges are filtered out of the canvas.
- **Export JSON**: Calls `getWorkspaceRepository().exportWorkspaceFile(activeWorkbookId)` which triggers a webview-safe client-side download.
- **Import JSON**: Calls `getWorkspaceRepository().importWorkspaceFile()`, validates the schema, updates the store, and recalculates all layout coordinates and metrics.
- **Reset Demo**: Prompts confirmation, resets workspace to the Delhi Youth Governance Exhibition seed dataset, and saves to repository.

---

## 3. Context Inspector Drawer

### 3.1 Node Inspector (when `selectedPlacementId` is active)
- Header: Entity Name input (editable), Category dropdown (`ngo`, `csr`, `government`, `institution`, `community`, `other`).
- Status Badge: Root NGO indicator or sector category pill.
- Global Notes: Textarea for partner context and history.
- Live Metrics Card:
  - Yellow in-degree (with live multi-thread badge preview).
  - Downstream reachable network reach count.
  - Attached incoming and outgoing branches list with quick-jump links.
- Action: "Remove Organization from Workbook" button (disabled for `isRootNgo === true` to protect foundational base).

### 3.2 Branch Inspector (when `selectedBranchId` is active)
- Header: Source Entity $\to$ Target Entity with type indicator.
- Status Toggle: Radio/pill buttons for `Pending`, `Tick (Confirmed)`, and `Cross (Declined)`.
- Branch Type Selector: `Funding (Green)`, `Relationship (White)`, `Bridge (Yellow)`.
- Conditional Value: `M%` number input when branch is Green.
- Qualitative Note: Textarea for notes and referral tracking.
- Action: "Delete Branch" button (removes branch and immediately updates topology metrics).

---

## 4. Acceptance Checklist Verification Strategy

The 10-point Acceptance Checklist from Section 12 of the technical specification must be verified through automated integration tests in `test/phase4.test.ts`:

1. **Delhi Initial Hierarchy**: Root NGO at bottom ($y \approx 615$), Sports Dev Office at top ($y \approx 12$) with `"Triple-Thread (3)"` badge.
2. **Declined Paths**: Dept of Social Security white branch renders as cross/faded gray and cleanly hides when `showDeclined = false`.
3. **Zero-Snap-Back Dragging**: Dragging a node updates its position; release commits exact coordinates with 0px displacement.
4. **Local Anti-Overlap**: Dropping one node onto another nudges the neighbor box away with $\ge 24\text{px}$ clearance without displacing the dropped node.
5. **Tidy Up Sugiyama Pass**: `tidyUpLayout()` orders cards into hierarchical tiers without overlapping bounding boxes or broken branches.
6. **Parallel Bezier Curves**: Concurrent edges between the same pair (e.g. City Museum white + yellow; Agrocell CSR green + yellow) compute distinct lateral Bezier offsets ($\ge 36\text{px}$ clearance).
7. **Cross-Demotion on Yellow Bridge**: Toggling one yellow branch into Sports Dev Office to `cross` demotes badge from `"Triple-Thread (3)"` to `"2-Thread"` and updates live metrics.
8. **Promotion on Yellow Bridge**: Connecting a 4th confirmed yellow branch promotes badge to `"Quad-Thread (4)"`.
9. **Storage & Engine Boundaries**: Zero `localStorage` outside `localStorageRepository.ts`; zero DOM/React in `src/engine/*`.
10. **JSON Roundtrip Fidelity**: Export JSON $\to$ Reset Demo $\to$ Import JSON restores identical graph topology, coordinates, statuses, and M% values.
