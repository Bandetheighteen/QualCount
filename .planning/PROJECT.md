# QualCount: Visual Multiplex Partnership Management System

## What This Is

QualCount is an offline-first visual partnership navigation and analytics application designed for social sector and NGO teams. It models institutional relationships directly as a bottom-to-top directed multiplex network (tracking financial funding, direct working relationships, and institutional bridges) and derives honest, objective quantitative progress metrics strictly from live graph topology without subjective 1-to-5 ratings or flat volume funnels.

Version 2 upgrades the single-canvas prototype into a durable, cross-device, agent-connected social-sector operating system with an editorial "Book & Ledger" aesthetic, a mathematically grounded Public Choice utility engine, a two-layer risk engine, portable JSON workspace folders, a maximized full-screen analytical ledger, and a local Model Context Protocol (MCP) server with four specialized agent skills.

## Core Value

Deriving honest, objective quantitative partnership and leverage metrics strictly from live multiplex network topology without subjective scoring, while delivering zero-snap-back 2D visual manipulation in an offline desktop-ready architecture.

## Current Milestone: v2.0 Public Choice Engine, MCP & Visual Ledger

**Goal:** Transform QualCount from a single-canvas prototype into an editorial Book & Ledger operating system featuring ratio-scale Public Choice utility, deterministic & agentic risk audit, full-screen maximized analysis, portable workspace storage, cross-workbook entity reuse, and local MCP server integration.

**Target Features:**
1. **Editorial "Book & Ledger" UI via Impeccable Plugin**: Archival warm paper (`#FAF8F4`), high-contrast ink branches (`#0F6B38`, `#18181B`, `#B45309`), sharp 6px card radius, serif display, monospace tabular metrics, and dark matte toggle, verified with `PRODUCT.md` and `DESIGN.md`.
2. **Public Choice Utility Engine**: Ratio-scale mathematical formulation in pure `src/engine/utility.ts` computing Buchanan-Tullock decision costs, Olson selective incentives, Niskanen bureaucratic utility, Ostrom credible commitments/durability, and Centola-Macy social proof screening ($R_i, A_i, V_i, C_i, U_i, \eta_i, S_i, \text{PUI}$).
3. **Two-Layer Risk Engine**: Pure TypeScript Layer 1 evaluating 6 deterministic structural parameters ($R_1..R_6$) with pinpointed node/edge IDs, plus Layer 2 persistent `AgentRiskAssessment` Box with failure scenarios and public choice diagnosis.
4. **Maximized Full-Screen Dashboard**: Four-section editorial ledger (`Cmd/Ctrl + Shift + D`) with financial/in-kind ledger, public choice utility ledger with strategy weight presets, risk audit box, and inline-editable node/branch tables with live MCP hot-reload and undo snapshot support.
5. **Portable Workspace Folder & Landing Page**: Multi-workbook JSON folder architecture (`workspace.json`, `entities.json`, `workbooks/*.json`), Landing Page book cover/table of contents, persistent Legacy Menu Bar (`File`, `View`, `Tools`), and live cross-workbook entity lookup ("collectorate" autocomplete with one-click import and proven bridge pull).
6. **Hybrid Spreadsheet Pipeline**: Native instant CSV bundle and 4-tab Excel (`.xlsx`) export; 3-door import modal (structured CSV/XLSX template, local MCP agent skill, and dynamic copyable Web AI conversion prompt).
7. **Local Stdio MCP Server & 4 Agent Skills**: Dedicated `@modelcontextprotocol/sdk` package (`packages/mcp-server/`) exposing 17 zod-validated tools, atomic writes, `.snapshots/` rolling backups, live reload push, and 4 production `SKILL.md` agent skills.
8. **Tauri v2 Desktop & Cloud Sync**: Desktop packaging for Windows/macOS/Linux with Android SAF touch adaptations, plus `GoogleDriveRepository` with mirror cache and conflict resolution.

## Requirements

### Validated (v1.0 Prototype)

- [x] **DATA-01**: Normalized 5-table relational schema decoupling master entities from workbook placements
- [x] **DATA-02**: Pre-loaded 11-node, 15-branch Delhi Youth Governance Exhibition seed dataset
- [x] **STOR-01**: Strict async `WorkspaceRepository` boundary
- [x] **STOR-02**: Web persistence adapter (`LocalStorageRepository`) with JSON export/import
- [x] **STOR-03**: Desktop repository stub (`TauriSqliteRepository`)
- [x] **ENG-01**: Pure layout engine (`src/engine/layout.ts`) using `elkjs` bottom-to-top (`elk.direction: "UP"`)
- [x] **ENG-02**: Pure local rectangular bounding-box anti-overlap engine (`src/engine/overlap.ts`) with 24px margin
- [x] **ENG-03**: Pure parallel edge math engine (`src/engine/parallelEdges.ts`) computing Bezier offsets
- [x] **ENG-04**: Pure quantitative metrics engine (`src/engine/metrics.ts`) computing 7 topology indicators
- [x] **CANV-01**: Dark studio bottom-to-top canvas (`PartnershipCanvas.tsx`) with inverted handles
- [x] **CANV-02**: Custom `OrgNode.tsx` with category styling, root marker, and multi-thread badges
- [x] **CANV-03**: Custom `MultiplexEdge.tsx` with color/dash/glow/gray matrix for 3 types and 3 states
- [x] **CANV-04**: Interactive edge mid-line pills and end-of-line Tick/Cross buttons via `EdgeLabelRenderer`
- [x] **CANV-05**: Persistent zero-snap-back dragging with position commits
- [x] **UI-01**: Live Top Metrics Strip (`MetricsStrip.tsx`) updating on all mutations
- [x] **UI-02**: Action Toolbar (`ActionToolbar.tsx`) with entity deduplication and controls
- [x] **UI-03**: Collapsible Context Inspector Drawer (`InspectorDrawer.tsx`)
- [x] **ARCH-01**: Webview-safe navigation (no URL router) and Vite `base: './'`

### Active (v2.0 Milestone)

- [ ] **DES-01**: Editorial "Book & Ledger" design system specified in `PRODUCT.md` and `DESIGN.md` featuring warm archival paper (`#FAF8F4`), high-contrast ink branch tones, editorial typography (`Source Serif 4`, `IBM Plex Sans`, `IBM Plex Mono`), 6px card radius, and dark matte toggle, verified with `npx impeccable detect src/`.
- [ ] **SCH-01**: Master TypeScript Data Schema Version 2 in `src/types/schema.ts` defining `WorkspaceManifest`, `EntitiesFile`, `WorkbookFile`, `Placement` with Public Choice attributes, `Branch` with in-kind values, `AgentRiskAssessment`, and seamless backward-compatible v1 migration.
- [ ] **ENG-05**: Pure Public Choice Utility Engine (`src/engine/utility.ts`) computing ratio-scale metrics: Co-ownership $O_i$, Social proof $S_i$, Direct commitment $R_i$, Ecosystem amplification $A_i$, Owned conversion $V_i$, Multi-thread reinforcement $C_i$, Partner utility $U_i$, Decision-cost yield $\eta_i$, and Workbook PUI with transparent 4-part additive audit decomposition.
- [ ] **ENG-06**: Pure Deterministic Layer 1 Risk Engine (`src/engine/risk.ts`) computing 6 structural parameters ($R_1$ Single-Bridge Concentration, $R_2$ Unowned Dependency, $R_3$ Funding Runway Gap, $R_4$ Public Choice Apathy, $R_5$ Decision-Cost Drag, $R_6$ Rejection Cluster Signal) with exact offending placement/branch IDs and aggregate risk tier.
- [ ] **DASH-01**: Maximized Full-Screen Analytical Dashboard (`Cmd/Ctrl + Shift + D`) with 4-section editorial layout: Financial & In-Kind Ledger, Public Choice Utility Ledger (with editable incentives, co-ownership checks, touch steppers, and strategy presets), Two-Layer Risk Assessment Box, and inline-editable Node/Branch ledgers.
- [ ] **DASH-02**: Risk Assessment Box supporting Layer 1 deterministic matrix alongside Layer 2 persistent agent audit (`overallPosition`, editable failure scenarios with status toggles, public choice diagnosis, and copy prompt fallback).
- [ ] **DASH-03**: Live UI reload on external agent file changes with 150ms debounce, subtle row highlight, and `.snapshots/` backed `Undo Agent Change` capability.
- [ ] **STOR-04**: Portable Workspace Folder storage architecture (`workspace.json`, `entities.json`, `workbooks/*.json`, `.snapshots/`) implemented via `WorkspaceRepository` adapters.
- [ ] **NAV-01**: Landing Page book cover and table of contents showing workspace groups, `[Local]` and `[Google Drive]` badges, summary KPIs, search bar, and Overview Map macro-graph toggle.
- [ ] **NAV-02**: Persistent Legacy Menu Bar (`File`, `View`, `Tools`) across landing page and canvas with keyboard shortcuts and collapsible Book Index sidebar for sibling workbooks.
- [ ] **MEM-01**: Cross-Workbook Entity Detection: live 3-character autocomplete against `entities.json` and device-local `recent-entities-index.json` ("collectorate" lookup) with one-click entity import and optional pending yellow lead pull.
- [ ] **IO-01**: Native RFC-4180 UTF-8 BOM CSV bundle export (`_nodes.csv`, `_branches.csv`) and 4-tab Excel workbook (`.xlsx`) export (`src/io/spreadsheetExport.ts`).
- [ ] **IO-02**: Three-Door Spreadsheet Import modal: Door 1 native template CSV/XLSX importer with preview and auto-tidy; Door 2 local MCP skill guidance; Door 3 dynamic "Copy Web AI Conversion Prompt" bridge.
- [ ] **MCP-01**: Standalone Node.js TypeScript MCP server in `packages/mcp-server/` with `@modelcontextprotocol/sdk` (`stdio` transport) exposing all 17 zod-validated tools across discovery, graph mutation, utility, risk, and spreadsheet batch import.
- [ ] **MCP-02**: MCP atomic file writes (`.tmp` + rename), revision increments, audit trail stamps, and pre-write rolling backups in `.snapshots/`.
- [ ] **SKILL-01**: Production agent skills installed and verified in `.agent/skills/`: `partnership-graph-operator`, `public-choice-utility-analyst`, `two-layer-risk-auditor`, and `spreadsheet-to-workflow-mapper`.
- [ ] **DESK-01**: Tauri v2 desktop packaging (`src-tauri/`) with native file dialogs, OS file watcher integration, and Android touch adaptation (36px minimum touch targets).
- [ ] **SYNC-01**: `GoogleDriveRepository` implementing OAuth 2.0 `drive.file` scope, local mirror cache under `<AppData>/drive-cache/`, and conflict resolution dialog.

### Out of Scope

- Machine Learning models for risk or scoring (statistically invalid due to small sample size; pure deterministic Layer 1 + agentic Layer 2 replaces ML).
- Subjective 1-to-5 partner ratings or composite trust scores (violates Stevens 1946; replaced by ratio-scale Public Choice utility).
- Single-file SQLite databases for shared cloud storage (WAL / journal files risk corruption over cloud sync; replaced by portable JSON Workspace Folder).
- Continuous background force simulations that snap cards back during manual positioning.
- URL-based history routing (breaks inside webviews under local file protocols).

## Context

Social sector alliances combine financial capital (CSR grants), direct non-monetary assets (venues, co-hosting), and institutional brokerage (referrals across government ministries and public bodies). Version 2 transitions QualCount from an isolated single-diagram tool into an agent-connected visual operating system. Coordinators manage multiple projects within portable Workspace Folders, run rigorous Public Choice utility audits, evaluate structural risks deterministically, export and import clean spreadsheets, and collaborate with AI agents through the Model Context Protocol.

## Constraints

- **Tech Stack**: TypeScript (strict mode), React 18/19, Tailwind CSS, @xyflow/react, elkjs, Zustand, Lucide React, @modelcontextprotocol/sdk, Tauri v2.
- **Storage Boundary**: All state I/O must strictly implement `WorkspaceRepository` interface with portable Workspace Folder JSON layout.
- **Engine Isolation**: `src/engine/*` must remain 100% pure TypeScript (zero imports from `react`, `window`, `document`, or `localStorage`) so `packages/mcp-server` imports them directly.
- **Preserve Canvas Invariants**: Bottom-to-top layout (`direction: "UP"`), zero-snap-back dragging, local rectangular anti-overlap, parallel curved branches, inline tick/cross buttons with `stopPropagation()`.
- **Offline-First**: Must operate fully offline without external API dependencies.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Portable Workspace Folder of JSONs over single SQLite | SQLite WAL files corrupt over Google Drive sync across OSes; plain JSON files sync reliably, remain human-readable, and allow local MCP server access without native drivers. | Approved |
| Ratio-scale Public Choice Theory over arbitrary points | Arbitrary points invite Campbell's Law gaming; Public Choice (Buchanan-Tullock, Olson, Niskanen, Ostrom) grounds scores in verifiable behaviors, screening reduction, and decision touches. | Approved |
| Two-Layer Risk Engine (Zero ML) | Small NGO workspaces cannot train valid ML models; deterministic 6-parameter graph matrix + agentic LLM risk briefing provides transparent, auditable risk analysis. | Approved |
| "Archival Book & Ledger" Impeccable Design System | Replaces generic AI dark-glass aesthetics with high-contrast archival ink and warm paper tones suited for intensive operational work; includes optional dark matte mode. | Approved |
| Local stdio MCP Server with 17 Tools & 4 Skills | Enables Claude Code, Cursor, Codex, and Antigravity to operate the workspace safely with atomic writes and rolling `.snapshots/` undo. | Approved |
| 3-Door Spreadsheet Import | Real NGO files are unstructured; provides structured template import, local MCP agent import, and zero-setup web AI prompt bridge. | Approved |

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
*Last updated: 2026-11-21 for Milestone v2.0 kick-off*
