# QualCount Project Requirements and Roadmap

> Source: .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md
> Collected: 2026-11-21
> Published: Unknown

# QualCount: Visual Multiplex Partnership Management System

## What This Is

QualCount is an offline-first visual partnership navigation and analytics application designed for social sector and NGO teams. It models institutional relationships directly as a bottom-to-top directed multiplex network (tracking financial funding, direct working relationships, and institutional bridges) and derives honest, objective quantitative progress metrics strictly from live graph topology without subjective 1-to-5 ratings or flat volume funnels.

## Core Value

Deriving honest, objective quantitative partnership and leverage metrics strictly from live multiplex network topology without subjective scoring, while delivering zero-snap-back 2D visual manipulation in an offline desktop-ready architecture.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **DATA-01**: Normalized relational data schema (`entities`, `workbooks`, `placements`, `branches`, `workbook_links`) decoupling master entity profiles from per-workbook coordinates and isolating graph topology
- [ ] **STOR-01**: Strict async `WorkspaceRepository` boundary (`loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, `importWorkspaceFile`) with Phase 1 `LocalStorageRepository` and Phase 2 `TauriSqliteRepository` stub
- [ ] **ENG-01**: Pure layout engine (`src/engine/layout.ts`) using `elkjs` (`elk.direction: "UP"`, `elk.algorithm: "layered"`) with read-only topology guarantee
- [ ] **ENG-02**: Pure local rectangular bounding-box anti-overlap engine (`src/engine/overlap.ts`) nudging colliding neighboring cards with 24px clearance while preserving user-anchored position
- [ ] **ENG-03**: Pure parallel edge math engine (`src/engine/parallelEdges.ts`) computing lateral Bezier offsets for multiplex branches
- [ ] **ENG-04**: Pure quantitative metrics engine (`src/engine/metrics.ts`) computing all 7 topology-derived indicators (Funding %, Direct Relationships, Confirmed Yellow Bridges, Owned Conversions, Multi-Thread Targets, Top Amplifier Reach BFS, Bridge Concentration Risk %)
- [ ] **CANV-01**: Dark studio bottom-to-top canvas (`PartnershipCanvas.tsx`) using React Flow v12 (`@xyflow/react`) with top-source and bottom-target handles
- [ ] **CANV-02**: Custom `OrgNode.tsx` component with category styling, root NGO marker, live multi-thread badge (2-Thread, Triple-Thread, Quad-Thread), and hover metrics tooltip
- [ ] **CANV-03**: Custom `MultiplexEdge.tsx` with color/dash/neon/gray matrix for 3 branch types (green/white/yellow) and 3 states (pending/tick/cross)
- [ ] **CANV-04**: Interactive edge mid-line pills (M% funding pill, context note tag) and end-of-line Tick and Cross buttons mounted via `EdgeLabelRenderer` with `stopPropagation()`
- [ ] **CANV-05**: Persistent zero-snap-back dragging with position commits to state and repository on drag release
- [ ] **UI-01**: Live Top Metrics Strip (`MetricsStrip.tsx`) displaying all 7 topology metrics in real-time above the canvas
- [ ] **UI-02**: Action Toolbar (`ActionToolbar.tsx`) with entity-deduplicated Add Node autocomplete, Connect Branch controls, Tidy Up trigger, Show Declined Gray Paths toggle, and JSON Export/Import
- [ ] **UI-03**: Collapsible Context Inspector Drawer (`InspectorDrawer.tsx`) for inspecting and editing selected nodes and branches
- [ ] **DATA-02**: Pre-loaded Delhi Youth Governance Exhibition seed scenario (`seedDelhiNgo.ts`) with 11 nodes and 15 branches in bottom-to-top layout
- [ ] **ARCH-01**: Webview-safe state navigation (no URL router) and Vite `base: './'` configuration ready for Phase 2 Tauri v2 desktop integration

### Out of Scope

- Subjective 1-to-5 partner ratings or composite trust scores (statistically invalid and distorts field behavior per Stevens 1946 & Campbell 1979)
- Continuous background force simulations that snap cards back during manual positioning
- Direct localStorage or FileReader calls inside React components (violates WorkspaceRepository boundary)
- React Router or window.history URL routing (breaks local webview asset loading in Tauri)
- Full Electron bundling (bundles Chromium + Node.js runtime, high resource bloat)
- Multi-user real-time collaborative cloud syncing in v1 (offline-first single-tenant desktop tool is core)

## Context

Grassroots and urban governance projects combine three forms of capital: financial (CSR grants), direct non-monetary assets (venues, co-hosting), and institutional brokerage (introductions across government ministries and public bodies). Standard CRMs treat outreach as a flat volume funnel and subjective rating surveys produce artificial precision.
The system uses a hybrid architecture:
- Layer 1 (Phase 1): Node.js toolchain, Vite, TypeScript, React Flow (@xyflow/react), elkjs, Zustand, Tailwind CSS.
- Layer 2 (Phase 2): Rust desktop shell via Tauri v2, backed by local SQLite file storage, multi-workbook opening page, and cross-project institutional memory.

## Constraints

- **Tech Stack**: TypeScript (strict mode), React 18/19, Tailwind CSS, @xyflow/react, elkjs, Zustand, Lucide React — chosen for rich 2D canvas interaction and ecosystem maturity.
- **Storage Boundary**: All state I/O must strictly implement `WorkspaceRepository` interface.
- **Engine Isolation**: `src/engine/*` must be pure TypeScript (zero imports from `react`, `window`, `document`, or `localStorage`).
- **Phase 2 Compatibility**: Relational schema must map 1-to-1 with SQLite schema; JSON-serializable state; Vite `base: './'`.
- **Offline-First**: Must operate fully offline without external API dependencies.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Node.js/TS frontend + Rust/Tauri v2 core | Pure Rust lacks mature 2D interactive canvas tools (egui lacks curved hit-testing and port-aware layout); Electron is too heavy. Hybrid provides rich React Flow UI with compact native desktop shell. | — Pending |
| Bottom-to-top layout direction | Mirrors natural relationship building: foundational NGO at Tier 0 ascending to direct partners (Tier 1), referrals (Tier 2), and converged targets (Tier 3+). | — Pending |
| Topology-derived metrics over subjective scores | Avoids fake precision and Campbell's Law distortions; metric calculations reflect verifiable network realities (ticked actions). | — Pending |
| Strict WorkspaceRepository interface | Enables seamless transition from Phase 1 LocalStorage to Phase 2 Tauri SQLite without modifying canvas or UI code. | — Pending |
| Discrete Tidy Up pass rather than continuous force layout | Gives users full spatial agency with persistent zero-snap-back dragging while providing on-demand hierarchical clean-up. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-20 after initialization*


# Requirements: QualCount

**Defined:** 2026-11-20
**Core Value:** Deriving honest, objective quantitative partnership and leverage metrics strictly from live multiplex network topology without subjective scoring, while delivering zero-snap-back 2D visual manipulation in an offline desktop-ready architecture.

## v1 Requirements

Requirements for Phase 1 single-workbook interactive prototype.

### Data & Storage Boundary (DATA / STOR)

- [x] **DATA-01**: User data is organized in a normalized 5-table relational schema (`entities`, `workbooks`, `placements`, `branches`, `workbook_links`) decoupling master organization profiles from per-workbook placement coordinates and isolating graph topology.
- [x] **DATA-02**: Workspace boots pre-loaded with the Delhi Youth Governance Exhibition scenario containing 11 nodes and 15 directed branches across 4 tiers in a bottom-to-top layout.
- [x] **STOR-01**: All persistent operations flow exclusively through an async `WorkspaceRepository` interface (`loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, `importWorkspaceFile`).
- [x] **STOR-02**: Web persistence adapter (`LocalStorageRepository`) persists validated `WorkspaceState` JSON to browser `localStorage` and provides schema-validated JSON export/import.
- [x] **STOR-03**: Phase 2 desktop adapter stub (`TauriSqliteRepository`) defines typed Tauri v2 Rust IPC commands (`load_workspace`, `save_workspace`, etc.) with an environment-aware repository selector.

### Pure Domain Engines (ENG)

- [x] **ENG-01**: Pure layout engine (`src/engine/layout.ts`) executes bottom-to-top Sugiyama layered drawing using `elkjs` (`elk.direction: "UP"`, `elk.algorithm: "layered"`) with a read-only topology guarantee.
- [x] **ENG-02**: Pure local anti-overlap engine (`src/engine/overlap.ts`) resolves rectangular collisions with a 24px safety margin, nudging only colliding neighbors while keeping the user's dragged card anchored.
- [x] **ENG-03**: Pure parallel edge engine (`src/engine/parallelEdges.ts`) computes lateral quadratic/cubic Bezier offsets for concurrent branches connecting the same pair of nodes.
- [x] **ENG-04**: Pure quantitative metrics engine (`src/engine/metrics.ts`) computes all 7 topology metrics (Funding % & INR, Direct White ties & confirmation rate %, Confirmed Yellow Bridges, Owned Conversions, Multi-Thread Targets, Top Amplifier Reach BFS, and Bridge Concentration Risk %) with zero subjective scoring.

### Interactive 2D Graph Canvas (CANV)

- [ ] **CANV-01**: Canvas (`PartnershipCanvas.tsx`) renders in a dark high-contrast studio theme (`#0b0f17`) with a subtle dot grid, inverted handles (source Top, target Bottom), and smooth pan/zoom controls.
- [ ] **CANV-02**: Custom node card (`OrgNode.tsx`) displays entity name, sector category pill, root NGO indicator, live multi-thread badge ("2-Thread", "Triple-Thread (3)", "Quad-Thread (N)"), and hover metrics tooltip.
- [ ] **CANV-03**: Custom edge component (`MultiplexEdge.tsx`) renders curved parallel Bezier paths with a strict color/dash/glow/gray matrix across 3 branch types (green/white/yellow) and 3 states (pending/tick/cross).
- [ ] **CANV-04**: Edge renders interactive mid-line M% pills (for green branches) or note tags, plus end-of-line Tick and Cross buttons via `EdgeLabelRenderer` with `stopPropagation` to prevent canvas drag.
- [ ] **CANV-05**: User can drag any card with persistent zero-snap-back positioning, triggering local anti-overlap nudging on drop and committing coordinates permanently to state and repository.

### User Interface & Controls (UI / ARCH)

- [ ] **UI-01**: Live Top Metrics Strip (`MetricsStrip.tsx`) is fixed above the canvas, dynamically updating all 7 metrics on every node, branch, or status mutation.
- [ ] **UI-02**: Action Toolbar (`ActionToolbar.tsx`) provides entity-deduplicated Add Node autocomplete, Connect Branch controls with validation, bottom-to-top Tidy Up trigger, Show Declined Gray Paths toggle, and JSON Export/Import.
- [ ] **UI-03**: Collapsible Context Inspector Drawer (`InspectorDrawer.tsx`) enables detailed editing of selected node/branch properties, notes, and deletion.
- [ ] **ARCH-01**: Application uses Zustand/React state-driven view navigation (no URL router) and compiles with Vite `base: './'` for desktop webview compatibility.

## v2 Requirements (Phase 2 Desktop Suite)

Deferred to Phase 2 native desktop release.

### Desktop Shell & SQLite Storage (DESK)

- **DESK-01**: Application packages inside a native Tauri v2 Rust desktop shell for Windows (WebView2) with compact binary size (<15MB).
- **DESK-02**: Rust backend manages atomic, crash-safe reads and writes to a portable single-file SQLite database (`.sqlite`) via `TauriSqliteRepository`.
- **DESK-03**: Opening Page provides a Workbook Cards Grid and an Overview Macro-Map linking workbooks by shared partner institutions.
- **DESK-04**: Cross-workbook institutional memory enables viewing partner history across past projects and a "Pull Proven Bridges" feature to reuse confirmed referral pathways.

## Out of Scope

Explicitly excluded to protect scientific integrity and project scope.

| Feature | Reason |
|---------|--------|
| Subjective 1-to-5 partner ratings / trust scores | Ordinal scale ratings cannot be mathematically averaged (Stevens 1946) and create Campbell's Law gaming where staff optimize for scores rather than missions. |
| Continuous background physics simulation | Causes cards to drift and snap back, destroying coordinator mental models and manual spatial agency. |
| Direct `localStorage` calls in React components | Leaks browser storage details into presentation code and complicates Phase 2 SQLite migration. |
| URL-based routing (`react-router-dom`) | Breaks inside Tauri webview environments under local file/asset protocols. |
| Full Electron desktop packaging | Bundles entire Chromium browser and Node.js runtime, creating excessive memory bloat for an offline utility. |
| Real-time multi-user cloud backend (v1) | Introduces cloud server dependencies, authentication infrastructure, and network requirements that fail in low-connectivity field areas. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 1 | Complete |
| STOR-03 | Phase 1 | Complete |
| ENG-01 | Phase 2 | Complete |
| ENG-02 | Phase 2 | Complete |
| ENG-03 | Phase 2 | Complete |
| ENG-04 | Phase 2 | Complete |
| CANV-01 | Phase 3 | Pending |
| CANV-02 | Phase 3 | Pending |
| CANV-03 | Phase 3 | Pending |
| CANV-04 | Phase 3 | Pending |
| CANV-05 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| ARCH-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-20*
*Last updated: 2026-11-20 after initial definition*


# Roadmap: QualCount

## Overview

QualCount builds an offline-first visual multiplex partnership management system for the social sector. The project proceeds across 4 balanced phases: establishing the normalized 5-table schema and storage boundary, building the pure domain engines (metrics, layout, anti-overlap, parallel curves), creating the interactive bottom-to-top React Flow canvas with custom nodes and edges, and delivering the complete UI shell with live metrics, toolbar controls, and end-to-end acceptance verification.

## Phases

- [x] **Phase 1: Foundation, Schema & Storage Boundary** - Normalized relational data model, async WorkspaceRepository interface, LocalStorage adapter, Tauri SQLite stub, and Delhi NGO seed dataset.
- [x] **Phase 2: Pure Domain Engines** - Pure TypeScript calculation engines for live metrics, parallel Bezier curve offsets, local bounding-box anti-overlap, and bottom-to-top elkjs hierarchical layout.
- [x] **Phase 3: Bottom-to-Top Canvas & Custom Graph Elements** - React Flow v12 dark studio canvas with custom OrgNode cards, multi-thread badges, MultiplexEdge with inline tick/cross buttons, and persistent zero-snap-back dragging.
- [x] **Phase 4: UI Shell, Live Metrics Strip, Toolbar & End-to-End Acceptance** - Live top metrics dashboard, Action Toolbar with entity deduplication, Context Inspector drawer, and complete verification against the 10-point acceptance checklist.

## Phase Details

### Phase 1: Foundation, Schema & Storage Boundary
**Goal**: Establish the normalized relational data model, async storage abstraction, pre-loaded Delhi seed dataset, and project build configuration.
**Depends on**: Nothing (first phase)
**Requirements**: [DATA-01, DATA-02, STOR-01, STOR-02, STOR-03]
**Success Criteria**:
  1. Vite dev server runs with `base: './'` and TypeScript strict mode enabled with zero errors.
  2. Normalized 5-table data model (`entities`, `workbooks`, `placements`, `branches`, `workbook_links`) compiles cleanly in `src/types/schema.ts`.
  3. `WorkspaceRepository` interface is fully implemented by `LocalStorageRepository` and stubbed for `TauriSqliteRepository`.
  4. Delhi Youth Governance Exhibition seed dataset (`seedDelhiNgo.ts`) loads cleanly into state with 11 nodes and 15 branches across 4 tiers.
**Plans**: 4 plans

Plans:
- [x] 01-01: Project scaffold and toolchain setup (package.json, vite.config.ts with base: './', tsconfig, Tailwind CSS, Lucide React)
- [x] 01-02: Normalized schema implementation (src/types/schema.ts)
- [x] 01-03: Storage repository layer (src/storage/workspaceRepository.ts, localStorageRepository.ts, tauriSqliteRepository.ts, index.ts)
- [x] 01-04: Pre-loaded Delhi NGO seed data (src/data/seedDelhiNgo.ts)

### Phase 2: Pure Domain Engines
**Goal**: Deliver testable, pure TypeScript geometric and topological calculation engines with zero DOM/React/storage dependencies.
**Depends on**: Phase 1
**Requirements**: [ENG-01, ENG-02, ENG-03, ENG-04]
**Success Criteria**:
  1. `metrics.ts` correctly computes all 7 topology metrics, BFS amplifier reach, and Bridge Concentration Risk from placement/branch records.
  2. `parallelEdges.ts` computes distinct lateral Bezier curve offsets for multiple concurrent branches between the same node pair.
  3. `overlap.ts` resolves rectangular bounding-box collisions with 24px margin, nudging only colliding neighbor boxes while preserving dragged card position.
  4. `layout.ts` runs a bottom-to-top (`elk.direction: "UP"`) Sugiyama layered layout via `elkjs` with a read-only topology guarantee.
**Plans**: 4 plans

Plans:
- [x] 02-01: Pure quantitative 7-metric engine (src/engine/metrics.ts)
- [x] 02-02: Pure parallel Bezier curve offset engine (src/engine/parallelEdges.ts)
- [x] 02-03: Pure local rectangular anti-overlap engine (src/engine/overlap.ts)
- [x] 02-04: Pure bottom-to-top elkjs layout engine (src/engine/layout.ts)

### Phase 3: Bottom-to-Top Canvas & Custom Graph Elements
**Goal**: Deliver the interactive 2D graph canvas with inverted bottom-to-top orientation, custom node cards with multi-thread badges, multiplex edges with tick/cross buttons, and persistent zero-snap-back dragging.
**Depends on**: Phase 2
**Requirements**: [CANV-01, CANV-02, CANV-03, CANV-04, CANV-05]
**Success Criteria**:
  1. Canvas renders with dark high-contrast theme (`#0b0f17`), dot grid, and inverted handles (source Top, target Bottom).
  2. `OrgNode.tsx` renders sector category pills, root NGO marker, dynamic multi-thread badges (2-Thread, Triple-Thread, Quad-Thread), and hover metrics tooltip.
  3. `MultiplexEdge.tsx` renders parallel curved lines with strict color/dash/neon/gray matrix, M% pills, note tags, and end-of-line Tick/Cross buttons via `EdgeLabelRenderer`.
  4. Clicking Tick or Cross buttons toggles branch state without dragging or panning the canvas (`stopPropagation`).
  5. Dragging any card updates coordinates live, resolves local collisions on release without snapping back, and commits coordinates permanently.
**Plans**: 4 plans

Plans:
- [x] 03-01: Zustand workspace store (src/store/useWorkspaceStore.ts)
- [x] 03-02: Custom OrgNode component (src/components/canvas/OrgNode.tsx)
- [x] 03-03: Custom MultiplexEdge component (src/components/canvas/MultiplexEdge.tsx)
- [x] 03-04: PartnershipCanvas integration (src/components/canvas/PartnershipCanvas.tsx)

### Phase 4: UI Shell, Live Metrics Strip, Toolbar & End-to-End Acceptance
**Goal**: Assemble the complete user interface with top live metrics strip, toolbar controls, inspector drawer, and verify all 10 acceptance checklist items.
**Depends on**: Phase 3
**Requirements**: [UI-01, UI-02, UI-03, ARCH-01]
**Success Criteria**:
  1. Live Top Metrics Strip displays all 7 metrics above the canvas, updating immediately on state changes.
  2. Action Toolbar supports Add Node with entity autocomplete deduplication, Connect Branch dialog, Tidy Up trigger, Show Declined toggle, and JSON Export/Import.
  3. Context Inspector drawer allows inspecting and editing selected node and branch details.
  4. Full acceptance checklist passes: Delhi scenario initial state, gray path toggle, zero-snap-back dragging, anti-overlap nudging, Tidy Up animation, parallel curve separation, multi-thread badge promotion/demotion, and JSON export/reset/import roundtrip fidelity.
**Plans**: 4 plans

Plans:
- [x] 04-01: Live Top Metrics Strip (src/components/metrics/MetricsStrip.tsx)
- [x] 04-02: Action Toolbar with Add Node deduplication (src/components/toolbar/ActionToolbar.tsx)
- [x] 04-03: Context Inspector Drawer (src/components/inspector/InspectorDrawer.tsx)
- [x] 04-04: Application assembly, webview-safe navigation, and full acceptance verification (src/App.tsx)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Schema & Storage Boundary | 4/4 | Complete | 2026-11-20 |
| 2. Pure Domain Engines | 4/4 | Complete | 2026-11-20 |
| 3. Bottom-to-Top Canvas & Custom Elements | 4/4 | Complete | 2026-11-20 |
| 4. UI Shell, Toolbar & Acceptance Verification | 4/4 | Complete | 2026-11-20 |
