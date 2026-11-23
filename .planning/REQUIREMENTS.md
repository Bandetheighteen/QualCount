# Requirements: QualCount v2.0

**Defined:** 2026-11-21
**Core Value:** Deriving honest, objective quantitative partnership and leverage metrics strictly from live multiplex network topology without subjective scoring, while delivering zero-snap-back 2D visual manipulation in an offline desktop-ready architecture.

## Milestone v2.0 Requirements

Requirements for Version 2: Public Choice Engine, MCP & Visual Ledger.

### Design & Visual System (DES)

- [x] **DES-01**: User interface adopts the "Archival Book & Ledger" visual system defined in `PRODUCT.md` and `DESIGN.md` featuring warm archival paper canvas (`#FAF8F4`), high-contrast multiplex branch palette (`#0F6B38`, `#18181B`, `#B45309`), serif display headings (`Source Serif 4`), humanist sans body (`IBM Plex Sans`), and tabular monospace numbers (`IBM Plex Mono`), with an optional dark matte mode (`#121417`).
- [x] **DES-02**: All visual components pass the 62-rule deterministic slop detector (`npx impeccable detect src/`) with zero purple-to-blue gradients, glowing orbs, glassmorphic panels, or card-in-card nesting, preserving all v1 functional canvas invariants.

### Master Schema & Data Model (SCH)

- [x] **SCH-01**: TypeScript data schema in `src/types/schema.ts` upgrades to Schema Version 2, defining `WorkspaceManifest`, `EntitiesFile`, `WorkbookFile`, `Placement` with Public Choice attributes, `Branch` with `inKindValueInr` and resolution timestamps, and `AgentRiskAssessment`.
- [x] **SCH-02**: Schema migration layer seamlessly auto-migrates existing v1 JSON files and seed data to Version 2 on load with sensible defaults without data loss.

### Pure Domain Engines (ENG)

- [x] **ENG-05**: Pure TypeScript Public Choice utility engine (`src/engine/utility.ts`) calculates revealed co-ownership depth $O_i$, social proof screening reduction factor $S_i$, direct commitment $R_i$, ecosystem amplification $A_i$, owned conversion $V_i$, multi-thread reinforcement $C_i$, partner structural utility $U_i$, decision-cost adjusted yield $\eta_i$, and Workbook PUI with transparent 4-part additive audit decomposition.
- [x] **ENG-06**: Pure TypeScript deterministic Layer 1 risk engine (`src/engine/risk.ts`) evaluates 6 structural parameters ($R_1$ Single-Bridge Concentration, $R_2$ Unowned Dependency, $R_3$ Funding Concentration/Runway Gap, $R_4$ Public Choice Apathy, $R_5$ Decision-Cost Drag, $R_6$ Rejection Cluster Signal), returning exact offending node/branch IDs, severity thresholds, and aggregate structural risk tier.

### Maximized Full-Screen Dashboard (DASH)

- [x] **DASH-01**: User can toggle a full-screen maximized book ledger (`Cmd/Ctrl + Shift + D` or button) over the active workbook, displaying a 4-section editorial layout (Financial/In-Kind Ledger, Public Choice Utility Ledger, Two-Layer Risk Box, and Relational Node/Branch Ledgers) without losing canvas state.
- [x] **DASH-02**: Public Choice Utility Ledger table provides inline editable cells for outreach attempts (+/- touch stepper), selective incentives (tag popover), co-ownership signals (4 binary checkboxes), and strategy weight preset selection (`Balanced`, `Amplification`, `Delivery`, `Custom`).
- [x] **DASH-03**: Two-Layer Risk Assessment Box renders the Layer 1 6-parameter structural matrix (clicking a row highlights culprit nodes on canvas) alongside Layer 2 persistent agent audit briefing with editable failure scenarios and status toggles.
- [x] **DASH-04**: External changes made via MCP hot-reload the dashboard and canvas within 300ms with a subtle row highlight and an `Undo Agent Change` button backed by rolling `.snapshots/`.

### Storage Architecture & Landing Page (STOR / NAV)

- [x] **STOR-04**: Storage abstraction (`WorkspaceRepository`) supports portable Workspace Folders on disk and cloud storage containing `workspace.json`, `entities.json`, `workbooks/*.json`, and local `.snapshots/`.
- [x] **NAV-01**: Application boots to a calm Landing Page (book cover and table of contents) listing connected workspaces and workbooks with `[Local]` and `[Google Drive]` badges, summary KPIs, search bar, and Overview Map macro-graph toggle.
- [x] **NAV-02**: Persistent Legacy Menu Bar (`File`, `View`, `Tools`) provides standard menu commands and keyboard shortcuts across Landing Page and canvas, paired with a collapsible Book Index sidebar for flipping between sibling workbooks.

### Cross-Workbook Institutional Memory (MEM)

- [x] **MEM-01**: When typing >= 3 characters in node creation or notes, system performs live fuzzy detection against current `entities.json` and device-local `recent-entities-index.json` ("collectorate" lookup).
- [x] **MEM-02**: User can one-click import an existing entity from another project with self-contained origin metadata (`importedFrom`), with an optional toggle to pull confirmed downstream referral leads as dashed pending yellow branches.

### Spreadsheet I/O Pipeline (IO)

- [x] **IO-01**: Native instant export generates RFC-4180 compliant UTF-8 BOM CSV bundles (`_nodes.csv`, `_branches.csv`) and a formatted 4-tab Excel workbook (`.xlsx`) covering summary, utility decomposition, branches, and risk assessment.
- [x] **IO-02**: Unified Three-Door Import modal supports: Door 1 native template CSV/XLSX importer with entity deduplication and auto-layout; Door 2 local MCP skill execution prompt; Door 3 dynamic "Copy Web AI Conversion Prompt" bridge for ChatGPT/Claude web users.

### Local Model Context Protocol Server & Skills (MCP / SKILL)

- [x] **MCP-01**: Dedicated stdio MCP server package (`packages/mcp-server/`) built with `@modelcontextprotocol/sdk` exposing all 17 zod-validated tools across discovery, graph mutation, utility, risk, and spreadsheet batch import, sharing pure `src/engine/*` modules.
- [x] **MCP-02**: MCP server performs atomic temp-file writes (`.tmp` + rename), increments revisions, logs mutation stamps, and saves pre-write backups to `.snapshots/`.
- [x] **SKILL-01**: Four production agent skills installed in `.agent/skills/`: `partnership-graph-operator`, `public-choice-utility-analyst`, `two-layer-risk-auditor`, and `spreadsheet-to-workflow-mapper`.

### Desktop Packaging & Cloud Synchronization (DESK / SYNC)

- [ ] **DESK-01**: Application packages inside Tauri v2 for native desktop execution with native folder/file dialogs and OS file watching via `notify`.
- [ ] **DESK-02**: Touch and coarse-pointer interfaces (Android) automatically enlarge edge tick/cross buttons to 36x36px touch targets and convert drawers to slide-overs.
- [ ] **SYNC-01**: `GoogleDriveRepository` supports OAuth 2.0 `drive.file` scope, Google Picker, local mirror cache in `<AppData>/drive-cache/`, and revision-based conflict resolution dialog.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Machine Learning models for risk or scoring | Local NGO datasets (5-30 projects) lack statistical sample size for ML; deterministic structural formulas + LLM agent audits provide transparent, verifiable results. |
| Subjective 1-to-5 partner ratings / trust scores | Ordinal scale ratings cannot be mathematically averaged (Stevens 1946) and create Campbell's Law gaming; replaced by ratio-scale Public Choice utility. |
| Single-file SQLite databases for shared cloud storage | SQLite WAL / journal files risk database corruption over Google Drive sync across OSes (SQLite, 2026); replaced by portable Workspace Folder JSON layout. |
| Continuous background physics simulation | Causes cards to drift and snap back, destroying coordinator mental models and manual spatial agency. |
| URL-based routing (`react-router-dom`) | Breaks inside Tauri webview environments under local file/asset protocols. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCH-01 | Phase 5 | Complete |
| SCH-02 | Phase 5 | Complete |
| ENG-05 | Phase 5 | Complete |
| ENG-06 | Phase 5 | Complete |
| DES-01 | Phase 5 | Complete |
| DES-02 | Phase 5 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| IO-01 | Phase 5 | Complete |
| IO-02 | Phase 5 | Complete |
| STOR-04 | Phase 6 | Complete |
| NAV-01 | Phase 6 | Complete |
| NAV-02 | Phase 6 | Complete |
| MEM-01 | Phase 6 | Complete |
| MEM-02 | Phase 6 | Complete |
| MCP-01 | Phase 7 | Complete |
| MCP-02 | Phase 7 | Complete |
| DASH-04 | Phase 7 | Complete |
| SKILL-01 | Phase 7 | Complete |
| DESK-01 | Phase 8 | Pending |
| DESK-02 | Phase 8 | Pending |
| SYNC-01 | Phase 8 | Pending |

**Coverage:**
- Total v2 requirements: 23
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-21 for Milestone v2.0*
