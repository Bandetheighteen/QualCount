# Project Research Summary

**Project:** QualCount (Visual Multiplex Partnership Management System)
**Domain:** Visual Multiplex Graph Navigation & Analytics for Social Sector Partnerships
**Researched:** 2026-11-20
**Confidence:** HIGH

## Executive Summary

QualCount solves a fundamental breakdown in conventional NGO partnership tracking. Traditional CRMs and spreadsheets reduce relationship building to flat conversion funnels and subjective 1-to-5 ratings ("trust scores"), hiding massive force multipliers (such as an engaged municipal museum introducing an NGO to 14 government agencies) and encouraging metric fixation (Campbell's Law). QualCount visualizes institutional outreach as an offline-first, bottom-to-top directed multiplex network, deriving honest quantitative progress metrics strictly from verifiable live graph topology.

To balance rich 2D interactive diagramming (parallel curved Bezier edges, HTML-over-SVG tick/cross buttons, port-aware hierarchical layouts) with lightweight offline desktop execution, QualCount employs a hybrid architecture:
1. **Layer 1 (Vite + TypeScript + React Flow + elkjs + Zustand + Tailwind CSS):** Renders the dark studio canvas, handles zero-snap-back dragging, executes pure geometric/topological engines, and persists state behind an async `WorkspaceRepository` interface.
2. **Layer 2 (Tauri v2 + Rust + SQLite Target):** Packages the exact compiled frontend inside a native desktop shell using Windows WebView2 and atomic SQLite storage for multi-workbook portfolios.

The four research dimensions confirm that Phase 1 can be built with complete architectural purity, ensuring Phase 2 requires zero rewrites of canvas or domain engine code.

## Key Findings

### Recommended Stack

- **Toolchain & Frontend:** Vite 6 + TypeScript 5.6 (strict mode) + React 18/19 + Tailwind CSS.
- **Graph Canvas:** `@xyflow/react` (React Flow v12) using `EdgeLabelRenderer` for HTML portal buttons along Bezier curves.
- **Hierarchical Layout:** `elkjs` (0.9.3) executing the Sugiyama layered algorithm with `elk.direction: "UP"` for bottom-to-top organization.
- **State Management:** `zustand` 5 for lightweight reactive graph state decoupled from storage.
- **Storage Seam:** Async `WorkspaceRepository` with `LocalStorageRepository` for web prototype and `TauriSqliteRepository` stub for Phase 2.

### Expected Features

- **Table Stakes:**
  - Bottom-to-top directed canvas (Tier 0 root NGO at bottom, Tier 3+ at top)
  - Custom `OrgNode` card with sector styling, root marker, and live multi-thread badges
  - Directed multiplex branches (green financial M%, white direct relationship, yellow network bridge)
  - Curved parallel Bezier offset routing to prevent overlapping lines
  - 3-state verification (pending dashed, tick neon glow, cross faded gray)
  - Mid-line M% / note pills and end-of-line interactive tick/cross buttons
  - "Show Declined (Gray) Paths" toggle
  - Persistent zero-snap-back dragging and local rectangular anti-overlap nudging (24px margin)
  - One-click bottom-to-top Tidy Up layout via `elkjs`
  - Live 7-metric top strip
  - Toolbar with Add Node deduplication autocomplete, Connect dialog, and JSON export/import
  - Context inspector drawer for editing nodes and branches
  - Delhi Youth Governance Exhibition seed dataset (11 nodes, 15 branches)
- **Differentiators:**
  - Zero subjective 1-to-5 ratings; pure topology-derived metrics
  - Multi-thread reinforcement badges (2-Thread, Triple-Thread, Quad-Thread) based on complex contagion theory (Centola & Macy)
  - Owned conversions metric tracking conversion of borrowed bridge reach into owned direct ties
  - Bridge concentration risk BFS metric identifying single points of failure
  - Phase 2 multi-workbook overview map and proven bridge reuse across projects
- **Anti-Features:**
  - Subjective rating numbers or composite "strength" indexes (statistically invalid ordinal math per Stevens 1946)
  - Continuous force-directed physics that drift or snap cards back
  - Direct `localStorage` calls in React components
  - URL routing (`react-router-dom`) that breaks in desktop webviews

### Architecture Approach

Strict separation of concerns across four guardrails:
1. **Repository Boundary:** All I/O passes through async `WorkspaceRepository`.
2. **Pure Engine Isolation:** `src/engine/*` (`metrics.ts`, `layout.ts`, `overlap.ts`, `parallelEdges.ts`) contains pure TypeScript with zero DOM/React/storage dependencies.
3. **Webview-Safe Navigation:** View switching (`canvas` vs `opening`) is managed via Zustand state without URL history routing.
4. **Topology vs. Geometry Separation:** Manual dragging commits `(x, y)` directly; anti-overlap nudges only colliding neighbor cards; Tidy Up is an explicit one-shot layout pass.

### Critical Pitfalls

1. **Canvas Drag Event Stealing:** Clicking edge tick/cross buttons initiates canvas dragging unless wrapped in `nodrag nopan pointer-events-auto` with `e.stopPropagation()`.
2. **Overlapping Parallel Edges:** Concurrent branches between the same two nodes stack on top of each other unless displaced by lateral Bezier normal offset math.
3. **Layout Collapse on Disconnected Nodes:** ELK layered layout fails on isolated nodes without explicit bounding boxes and partitioning.
4. **Storage Boundary Leaks:** Scattered `localStorage` calls block clean Tauri SQLite adoption.

## Implications for Roadmap

The standard 4-phase architecture provides optimal balance, safety, and testability:

### Phase 1: Foundation, Schema & Storage Boundary
- **Rationale:** Establishes the 5-table relational data model, storage repository abstraction, pre-loaded Delhi seed dataset, and Vite/Tailwind configuration before any UI or math is written.
- **Delivers:** `src/types/schema.ts`, `src/storage/workspaceRepository.ts`, `src/storage/localStorageRepository.ts`, `src/storage/tauriSqliteRepository.ts`, `src/storage/index.ts`, `src/data/seedDelhiNgo.ts`, `vite.config.ts` (`base: './'`).
- **Avoids:** Storage boundary leaks, untyped state, webview path errors.

### Phase 2: Pure Domain Engines
- **Rationale:** Builds and tests all business logic and geometric algorithms as pure TypeScript modules before connecting to React Flow or canvas rendering.
- **Delivers:**
  - `src/engine/metrics.ts` (7 topology metrics, BFS amplifier reach, concentration risk)
  - `src/engine/parallelEdges.ts` (lateral Bezier curve offsets for concurrent multiplex branches)
  - `src/engine/overlap.ts` (24px bounding-box minimum-displacement anti-overlap)
  - `src/engine/layout.ts` (bottom-to-top `elkjs` Sugiyama layout with read-only topology guarantee)
- **Avoids:** Overlapping parallel edges, layout crashes on isolated nodes, subjective rating creep.

### Phase 3: Bottom-to-Top Canvas & Custom Graph Elements
- **Rationale:** Implements the visual interactive experience, node cards, curved edges, and direct manipulation controls.
- **Delivers:**
  - `src/store/useWorkspaceStore.ts` (Zustand store connecting state and repository)
  - `src/components/canvas/OrgNode.tsx` (top-source/bottom-target handles, category pill, root marker, multi-thread badge, hover tooltip)
  - `src/components/canvas/MultiplexEdge.tsx` (color/dash/neon/gray matrix, M% pills, note tags, interactive tick/cross buttons with `stopPropagation`)
  - `src/components/canvas/PartnershipCanvas.tsx` (persistent zero-snap-back dragging, drop anti-overlap hook, dark studio grid)
- **Avoids:** Canvas event stealing, coordinate snap-back, handle inversion.

### Phase 4: UI Shell, Live Metrics Strip, Toolbar & End-to-End Verification
- **Rationale:** Completes the user interface, connects live metrics, provides management controls, and validates the complete system against all acceptance criteria.
- **Delivers:**
  - `src/components/metrics/MetricsStrip.tsx` (live top strip for all 7 metrics)
  - `src/components/toolbar/ActionToolbar.tsx` (Add Node with autocomplete deduplication, Connect Branch, Tidy Up, Gray toggle, JSON import/export, Reset demo)
  - `src/components/inspector/InspectorDrawer.tsx` (selection editor for nodes and branches)
  - `src/App.tsx` (full layout assembly, view state container)
  - Full end-to-end acceptance verification (Delhi seed 11-node/15-branch scenario, tick/cross state changes, JSON roundtrip fidelity).
- **Avoids:** Entity duplication, broken JSON export/import, desynced metrics.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified compatible: Vite 6, React Flow v12, elkjs, Zustand, Tailwind |
| Features | HIGH | Exhaustive specification from concept note and build prompt |
| Architecture | HIGH | Clean 2-layer hybrid separation with clear storage repository boundary |
| Pitfalls | HIGH | Specific mitigations identified for canvas events, parallel edges, and layout |

**Overall confidence:** HIGH

---
*Research completed: 2026-11-20*
*Ready for roadmap: yes*
