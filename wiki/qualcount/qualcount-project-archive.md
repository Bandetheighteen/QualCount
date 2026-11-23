# QualCount Project Archive

> Sources: [QualCount System Architecture](system-architecture.md); [Multiplex Network Topology and 7 Quantitative Metrics](multiplex-network-and-metrics.md); [Desktop Application Shell and Tauri SQLite Packaging](desktop-shell-and-packaging.md)
> Archived: 2026-11-21

## Overview

This document archives the complete design, engineering implementation, and verification history of the QualCount partnership management system. QualCount models institutional partnerships as a bottom-to-top directed multiplex network, deriving honest quantitative progress metrics directly from live graph topology without subjective ratings or volume funnels.

## Multi-Phase Implementation Summary

The project was executed across four primary engineering phases followed by advanced interaction polish and desktop compilation:

### Phase 1: Foundation Schema & Storage Boundary
- Established normalized 5-table relational schema (`entities`, `workbooks`, `placements`, `branches`, `workbook_links`) decoupling entity profiles from canvas coordinates.
- Implemented asynchronous `WorkspaceRepository` interface with `LocalStorageRepository` and `TauriSqliteRepository` stub.
- Pre-loaded Delhi Youth Governance Exhibition seed dataset with 11 nodes and 15 branches in bottom-to-top hierarchy.

### Phase 2: Pure Domain Engines
- Developed 4 isolated domain calculation engines in pure TypeScript with zero DOM/storage dependencies:
  - `metrics.ts`: 7 topology-derived indicators (Funding %, Direct Relationships, Yellow Bridges, Owned Conversions, Multi-Thread Triangulation, Top Amplifier Reach, Bridge Concentration Risk).
  - `parallelEdges.ts`: Canonical parallel edge grouping with lateral Bezier offsets.
  - `overlap.ts`: Local AABB collision detection and resolution with 24px clearance.
  - `layout.ts`: Bottom-to-top hierarchical layout via `elkjs` (`elk.direction: "UP"`).

### Phase 3: Canvas & Custom Graph Elements
- Implemented dark studio canvas using React Flow v12 (`@xyflow/react`).
- Created custom `OrgNode.tsx` with dynamic multi-thread badges, 3-dot hover connector handles, and inline point of contact display.
- Created custom `MultiplexEdge.tsx` with parallel curved Bezier paths and interactive tick/cross action buttons.
- Delivered persistent zero-snap-back node dragging.

### Phase 4: UI Shell & Metrics Strip
- Built live top/bottom/left/right configurable `MetricsStrip.tsx` with neon accents and high-contrast typography.
- Built sectioned `ActionToolbar.tsx` with auto-hide slide-out support and pointer/hand tool toggles.
- Built non-modal floating `FilterPanel.tsx` for real-time live canvas filtering by branch type, status, funding %, entity category, and isolated nodes.
- Built collapsible `InspectorDrawer.tsx` for inspecting and modifying nodes and branches.

### Advanced Polish & Interaction Features
- Double-click Adobe Illustrator-style isolation mode.
- Dual marquee box selection (`N` for nodes, `B` for branches).
- Right-click context menus for canvas and elements.
- Bottom-left draggable controls dock with Settings modal and Keyboard Shortcuts modal (`?`).
- Point of Contact management with internal lead / responsible team assignment.

### Native Desktop Packaging
- Packaged into a standalone Windows desktop executable via Tauri v2 and NSIS (`QualCount-Setup.exe`).

## Verification Record

All 9 automated test suites execute and pass with 100% success:
- `test/phase1.test.ts` (PASS)
- `test/phase2.test.ts` (PASS)
- `test/phase3.test.ts` (PASS)
- `test/phase4.test.ts` (PASS)
- `test/debug_features.test.ts` (PASS)
- `test/advanced_interactions.test.ts` (PASS)
- `test/modifications_verification.test.ts` (PASS)
- `test/filter_and_dock.test.ts` (PASS)
- `test/neon_dashboard_and_poc.test.ts` (PASS)

## See Also

- [System Architecture](system-architecture.md)
- [Multiplex Network and Metrics](multiplex-network-and-metrics.md)
- [Desktop Shell and Packaging](desktop-shell-and-packaging.md)
