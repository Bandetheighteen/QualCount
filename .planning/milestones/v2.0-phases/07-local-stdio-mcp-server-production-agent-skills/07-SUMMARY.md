# Phase 7 Milestone Summary: Local Stdio MCP Server & Production Agent Skills

## Overview
Phase 7 delivers a production-grade Model Context Protocol (MCP) server under `packages/mcp-server/` using `@modelcontextprotocol/sdk` and `zod`, providing external AI coding agents (Google Antigravity, Claude Code, Cursor, Windsurf, OpenAI Codex) with a comprehensive 17-tool operational interface and 4 read-only resources over portable QualCount Workspace Folders. Complementing this is an atomic file writing protocol with rolling 20-snapshot pre-write backups, full UI live reload and undo capability (`DASH-04`), and 4 complete production agent skills installed across `.agent/`, `.claude/`, and `.cursor/` (12 files total).

## Requirements Completed
- `MCP-01`: Dedicated stdio MCP server package (`packages/mcp-server/`) built with `@modelcontextprotocol/sdk` exposing all 17 zod-validated tools across discovery, graph mutation, utility, risk, and spreadsheet batch import, sharing pure `src/engine/*` modules. Bundled via esbuild (`scripts/build-mcp.mjs`) into a standalone executable at `packages/mcp-server/dist/index.js`.
- `MCP-02`: MCP server performs atomic temp-file writes (`.tmp` + rename), increments revisions, logs mutation stamps, and saves pre-write backups to `.snapshots/` with rolling 20-snapshot limit and graceful rollback handling.
- `DASH-04`: External changes made via MCP hot-reload the dashboard and canvas with an archival notification banner and `Undo Agent Change` button backed by rolling `.snapshots/`.
- `SKILL-01`: Four production agent skills installed in `.agent/skills/` (and mirrored to `.claude/skills/` and `.cursor/skills/`): `partnership-graph-operator`, `public-choice-utility-analyst`, `two-layer-risk-auditor`, and `spreadsheet-to-workflow-mapper`.

## Architecture Delivered

### 1. 17 Zod-Validated MCP Tools
| Category | Tool | Description |
|---|---|---|
| **Discovery** | `list_workbooks` | Lists workspace metadata and workbooks with summary KPIs (funding %, PUI, risk tier, counts). |
| | `get_workbook_full` | Full workbook JSON with resolved entity names, utility report, and structural risk report. |
| | `search_entities` | Fuzzy entity search preventing duplicates before creation with consistent count/matches keys. |
| **Mutation** | `create_workbook` | Creates workbook with Root NGO anchored at Tier 0 (x: 400, y: 600, w: 190, h: 76) with collision protection. |
| | `add_or_import_entity` | Deduplicates against `entities.json`, adds placement with public choice attributes, imports bidirectional proven referral bridges as `pending` without duplication. |
| | `update_placement_attributes` | Updates selective incentives, co-ownership signals, and outreach touches without altering coordinates. |
| | `create_branch` | Validates no self-loops, creates directed multiplex branches (green, white, yellow), and strictly enforces ownership separation. |
| | `update_branch` | Toggles pending/tick/cross or updates values/notes, enforcing ownership rules on type transitions. |
| | `delete_branch` | Removes branch cleanly. |
| | `run_tidy_up_layout` | Executes pure `elkjs` bottom-to-top hierarchical layout (`direction: "UP"`). |
| **Utility** | `get_public_choice_utility_report` | Computes PUI, decision-cost efficiency, and per-partner metrics ($R_i, A_i, V_i, C_i, U_i, \eta_i, S_i$). |
| | `update_utility_strategy_weights` | Updates strategy weights with strict sum validation (1.00 ± 0.001). |
| | `patch_workbook_metadata` | Edits workbook-level dashboard header settings and manifest. |
| **Risk** | `get_structural_risk_report` | Computes 6 Layer 1 structural parameters ($R_1..R_6$) and aggregate tier. |
| | `write_risk_assessment_box` | Publishes persistent Layer 2 Risk Assessment Box with actionable failure scenarios. |
| **Spreadsheet** | `export_workbook_spreadsheet` | Generates RFC-4180 CSV bundles and 4-tab Excel spreadsheets with directory path protection. |
| | `batch_import_workflow_rows` | Batch-imports spreadsheet rows with entity deduplication, branch generation, and layout. |

### 2. 4 Read-Only MCP Resources
- `partnership://workspace/overview`: Active workspace manifest and list of workbooks.
- `partnership://workspace/entities`: Full master `entities.json` database.
- `partnership://workbook/{id}/graph`: Full workbook JSON graph data (placements and branches).
- `partnership://workbook/{id}/metrics`: Live Funding, Public Choice Utility, and Structural Risk metrics.

### 3. Atomicity, Snapshot Rolling Cap & UI Rollback
- Storage mutations write to `<target>.tmp` followed by atomic `rename` with Windows lock recovery.
- Pre-write snapshots are saved to `.snapshots/wb_<wbId>_<ts>.json`.
- Rolling 20-snapshot cap per workbook automatically prunes oldest snapshots when count > 20.
- `revertLastSnapshot` restores prior snapshot state, increments revision, pops the snapshot stack, and handles exhaustion safely.
- `useWorkspaceStore` tracks `agentMutationNotification` and provides `revertLastAgentChange()`.
- `ActionToolbar` and `MaximizedDashboard` render archival-styled notification banners (`#FAF8F4` warm paper, `#DDD6C8` hairline borders, `font-mono` typography) with an immediate `Undo Agent Change` trigger.

### 4. Production Agent Skills
Installed identically across `.agent/skills/`, `.claude/skills/`, and `.cursor/skills/` (12 files total):
1. `partnership-graph-operator/SKILL.md`: Master graph manipulation adhering to three-color multiplex semantics, ownership separation, and declined memory preservation.
2. `public-choice-utility-analyst/SKILL.md`: Objective Public Choice diagnosis without arbitrary 1-5 point scores, covering Olson/Niskanen incentive blindness, Ostrom credible commitments, and Buchanan-Tullock efficiency.
3. `two-layer-risk-auditor/SKILL.md`: Two-layer risk audit publishing structural parameters and qualitative failure scenarios to the Maximized Dashboard.
4. `spreadsheet-to-workflow-mapper/SKILL.md`: Robust ingestion of messy outreach spreadsheets with Indian currency parsing, status mapping, and 100-node tangle prevention.

## Verification Evidence
- `npx tsc --noEmit`: 0 errors across root and mcp-server.
- `npm run test:phase7`: 13/13 test suites passed (100%), including live child process stdio transport verification.
- `npm run build`: built production frontend bundles and packaged standalone MCP bundle in `packages/mcp-server/dist/index.js`.
- `npm test`: all 17 test suites across Phases 1-7 passed cleanly.
