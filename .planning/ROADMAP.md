# Roadmap: QualCount

## Overview

QualCount is an offline-first visual multiplex partnership management system for the social sector.
- **Milestone v1.0 (Phases 1-4, Complete):** Established the core prototype—normalized 5-table schema, pure calculation engines, bottom-to-top React Flow canvas with interactive tick/cross multiplex edges, live metrics strip, and 10-point acceptance verification.
- **Milestone v2.0 (Phases 5-7 & Release, Complete):** Upgrades the system into an editorial "Book & Ledger" social-sector OS featuring ratio-scale Public Choice utility, deterministic & agentic risk audit, full-screen maximized analysis, portable workspace storage, cross-workbook entity reuse, local stdio MCP server with 4 production skills, circular tree-and-loop seal branding, and Windows desktop binary packaging.

---

## Phases

### Completed (Milestone v1.0 & v2.0)
- [x] **Phase 1: Foundation, Schema & Storage Boundary** - Normalized relational data model, async WorkspaceRepository interface, LocalStorage adapter, Tauri SQLite stub, and Delhi NGO seed dataset.
- [x] **Phase 2: Pure Domain Engines** - Pure TypeScript calculation engines for live metrics, parallel Bezier curve offsets, local bounding-box anti-overlap, and bottom-to-top elkjs hierarchical layout.
- [x] **Phase 3: Bottom-to-Top Canvas & Custom Graph Elements** - React Flow v12 dark studio canvas with custom OrgNode cards, multi-thread badges, MultiplexEdge with inline tick/cross buttons, and persistent zero-snap-back dragging.
- [x] **Phase 4: UI Shell, Live Metrics Strip, Toolbar & End-to-End Acceptance** - Live top metrics dashboard, Action Toolbar with entity deduplication, Context Inspector drawer, and complete verification against the 10-point acceptance checklist.
- [x] **Phase 5: Core Domain Engines, Analytical Dashboard & Impeccable Design System** - Schema v2 upgrade, pure Public Choice utility engine, pure deterministic 6-parameter risk engine, Impeccable Archival Book & Ledger styling, Maximized Full-Screen Dashboard with Risk Assessment Box, native CSV/Excel export, and 3-door import modal.
- [x] **Phase 6: Portable Workspace Storage, Landing Page & Cross-Workbook Autocomplete** - Portable Workspace Folder format (`workspace.json`, `entities.json`, `workbooks/`), Landing Page with `Local` and `Google Drive` badges, Legacy Menu Bar, collapsible Book Index sidebar, Overview Map, and cross-workbook entity autocomplete with proven bridge pull.
- [x] **Phase 7: Local Stdio MCP Server & Production Agent Skills** - Dedicated `@modelcontextprotocol/sdk` package (`packages/mcp-server/`) exposing all 17 zod-validated tools, atomic writes, `.snapshots/` pre-write backups, live reload push, `Undo Agent Change` button, and the 4 production agent skills.
- [x] **Milestone v2.0 Delivery: Branding & Windows Executables** - Circular tree-and-loop diagram emblem logo, multi-resolution app icons, single-file installer (`QualCount-Setup.exe`), and standalone binary (`QualCount.exe`).

### Future Roadmap
- [ ] **Phase 8: Multi-Platform Tauri v2 Desktop & Cloud Sync** - Multi-OS bundling (macOS DMG / Linux AppImage), Android SAF 36px touch controls, and OAuth 2.0 Google Drive direct sync.

---

## Phase Details (Milestone v2.0)

### Phase 5: Core Domain Engines, Analytical Dashboard & Impeccable Design System
**Goal**: Implement the mathematical core of Public Choice Theory, deterministic structural risk, maximized analytical dashboard, spreadsheet I/O, and the Archival Book & Ledger design system while preserving 100% of v1 canvas interactions.
**Depends on**: Milestone v1.0 (Phases 1-4)
**Requirements**: [SCH-01, SCH-02, ENG-05, ENG-06, DES-01, DES-02, DASH-01, DASH-02, DASH-03, IO-01, IO-02]
**Success Criteria**:
  1. `src/types/schema.ts` implements Schema Version 2 with automated, lossless backward compatibility for v1 datasets.
  2. `src/engine/utility.ts` computes all Public Choice metrics ($R_i, A_i, V_i, C_i, U_i, \eta_i, S_i, \text{PUI}$) with 100% unit test coverage against the Delhi exhibition dataset.
  3. `src/engine/risk.ts` computes the 6 deterministic structural parameters ($R_1..R_6$) returning exact offending placement/branch IDs and aggregate tier.
  4. Visual redesign via `PRODUCT.md` and `DESIGN.md` establishes warm archival paper (`#FAF8F4`), high-contrast ink branches, editorial typography, and passes `npx impeccable detect src/` with zero slop findings.
  5. Maximized Full-Screen Dashboard (`Cmd/Ctrl + Shift + D`) provides 4-section editorial layout with inline-editable cells, strategy weight presets, and Two-Layer Risk Assessment Box.
  6. Native RFC-4180 CSV bundle and 4-tab Excel workbook (`.xlsx`) export instantly; 3-door import modal handles structured files, MCP instructions, and dynamic Web AI conversion prompts.
**Plans**: 5 plans

Plans:
- [x] 05-01: Schema v2 Upgrade, Migration Layer & Delhi Seed Update (src/types/schema.ts, src/data/seedDelhiNgo.ts)
- [x] 05-02: Pure Public Choice Utility & Deterministic Layer 1 Risk Engines (src/engine/utility.ts, src/engine/risk.ts)
- [x] 05-03: Archival Book & Ledger Design System (Impeccable Visual Redesign) (src/components/canvas/*, src/index.css)
- [x] 05-04: Maximized Full-Screen Dashboard & Two-Layer Risk Box (src/components/dashboard/*, src/store/*)
- [x] 05-05: Native CSV/Excel Export & 3-Door Import Pipeline (src/io/*, src/components/toolbar/*)

### Phase 6: Portable Workspace Storage, Landing Page & Cross-Workbook Autocomplete
**Goal**: Transition from single-file/localStorage state to portable Workspace Folders on disk and cloud, boot to an editorial Landing Page, provide persistent legacy menu navigation, and enable cross-project institutional entity memory.
**Depends on**: Phase 5
**Requirements**: [STOR-04, NAV-01, NAV-02, MEM-01, MEM-02]
**Success Criteria**:
  1. Workspace state serializes to portable folder structure (`workspace.json`, `entities.json`, `workbooks/*.json`, `.snapshots/`).
  2. Application boots to Landing Page (book cover and table of contents) with workspace cards, `[Local]` and `[Google Drive]` badges, summary KPIs, and Overview Map macro-graph toggle.
  3. Legacy Menu Bar (`File`, `View`, `Tools`) provides standard menu commands across Landing Page and canvas, complemented by a collapsible Book Index sidebar for sibling workbook flipping.
  4. Typing >= 3 characters in node creation triggers live fuzzy autocomplete against `entities.json` and device-local `recent-entities-index.json`, offering one-click import and optional pending yellow lead pull.
**Plans**: 4 plans

Plans:
- [x] 06-01: Portable Workspace Folder Architecture & Repository Adapters (src/storage/*, src/types/schema.ts)
- [x] 06-02: Editorial Landing Page & Overview Macro-Map (src/components/landing/*, src/store/*)
- [x] 06-03: Persistent Legacy Menu Bar & Sibling Book Index Sidebar (src/components/navigation/*, src/store/*)
- [x] 06-04: Cross-Workbook Entity Detection & One-Click Import Engine (src/engine/entityIndex.ts, src/components/toolbar/*)

### Phase 7: Local Stdio MCP Server & Production Agent Skills
**Goal**: Provide a production Model Context Protocol server enabling external AI coding agents (Claude Code, Cursor, Antigravity, Codex) to inspect, mutate, audit, and import partnership workflows safely.
**Depends on**: Phase 6
**Requirements**: [MCP-01, MCP-02, DASH-04, SKILL-01]
**Success Criteria**:
  1. `packages/mcp-server/` runs via `stdio` transport using `@modelcontextprotocol/sdk`, exposing all 17 zod-validated tools sharing `src/engine/*`.
  2. Every MCP mutation executes atomic temp-file writes, increments revision, stamps audit metadata, and copies pre-write backups into `.snapshots/`.
  3. UI detects external MCP writes and hot-reloads the active workbook within 300ms, displaying subtle row highlights and a functional `Undo Agent Change` button.
  4. Four complete production skills installed in `.agent/skills/`: `partnership-graph-operator`, `public-choice-utility-analyst`, `two-layer-risk-auditor`, and `spreadsheet-to-workflow-mapper`.
**Plans**: 4 plans

Plans:
- [x] 07-01: MCP Server Package Setup, Storage Adapter & Atomicity Protocol (packages/mcp-server/*)
- [x] 07-02: 17 Zod-Validated MCP Tools & 4 Resources Implementation (packages/mcp-server/src/*)
- [x] 07-03: Production Agent Skills Installation (4 Complete Blueprints) (.agent/skills/*, .claude/skills/*, .cursor/skills/*)
- [x] 07-04: Live UI Agent Mutation Notification & Undo Action (DASH-04) & E2E Tests (src/store/*, test/*)

### Phase 8: Cross-Platform Tauri v2 Desktop & Google Drive Sync
**Goal**: Package the application as a native desktop utility on Windows, macOS, and Linux with Android touch support and seamless Google Drive cloud synchronization.
**Depends on**: Phase 7
**Requirements**: [DESK-01, DESK-02, SYNC-01]
**Success Criteria**:
  1. Tauri v2 wrapper (`src-tauri/`) packages the application into native binaries (<15MB footprint) with native folder dialogs and OS file watching via `notify`.
  2. Android touch environments enlarge edge controls to 36x36px touch targets and convert drawers to slide-overs.
  3. `GoogleDriveRepository` supports OAuth 2.0 `drive.file` scope, Google Picker, local mirror caching under `<AppData>/drive-cache/`, and revision-based conflict resolution.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Schema & Storage Boundary | 4/4 | Complete | 2026-11-20 |
| 2. Pure Domain Engines | 4/4 | Complete | 2026-11-20 |
| 3. Bottom-to-Top Canvas & Custom Elements | 4/4 | Complete | 2026-11-20 |
| 4. UI Shell, Toolbar & Acceptance Verification | 4/4 | Complete | 2026-11-20 |
| 5. Core Engines, Analytical Dashboard & Impeccable Design | 5/5 | Complete | 2026-11-21 |
| 6. Portable Workspace Storage, Landing Page & Autocomplete | 4/4 | Complete | 2026-11-21 |
| 7. Local Stdio MCP Server & Production Agent Skills | 4/4 | Complete | 2026-11-21 |
| Release: Windows Executable & Circular Tree Logo | 1/1 | Complete | 2026-11-21 |
