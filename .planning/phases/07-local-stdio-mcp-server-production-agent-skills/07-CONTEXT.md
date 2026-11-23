# Phase 7 Context: Local Stdio MCP Server & Production Agent Skills

## Goal
Implement a production-grade Model Context Protocol (MCP) server under `packages/mcp-server/` using `@modelcontextprotocol/sdk` and `zod`, providing external AI coding agents (Claude Code, Cursor, Windsurf, Google Antigravity, OpenAI Codex) with a complete 17-tool operational interface and 4 read-only resources over portable QualCount Workspace Folders. Complement this with atomic temp-file writes, `.snapshots/` rolling backups, live UI agent-mutation feedback with `Undo Agent Change` (`DASH-04`), and 4 complete production agent skills installed in `.agent/skills/`.

## Requirements Covered
- `MCP-01`: Dedicated stdio MCP server package (`packages/mcp-server/`) built with `@modelcontextprotocol/sdk` exposing all 17 zod-validated tools across discovery, graph mutation, utility, risk, and spreadsheet batch import, sharing pure `src/engine/*` modules.
- `MCP-02`: MCP server performs atomic temp-file writes (`.tmp` + rename), increments revisions, logs mutation stamps, and saves pre-write backups to `.snapshots/`.
- `DASH-04`: External changes made via MCP hot-reload the dashboard and canvas within 300ms with a subtle row highlight and an `Undo Agent Change` button backed by rolling `.snapshots/`.
- `SKILL-01`: Four production agent skills installed in `.agent/skills/` (and mirrored to `.claude/skills/` and `.cursor/skills/`): `partnership-graph-operator`, `public-choice-utility-analyst`, `two-layer-risk-auditor`, and `spreadsheet-to-workflow-mapper`.

## Architectural Invariants
1. **Engine Sharing**: The MCP server must share or directly import pure TypeScript engines (`src/engine/utility.ts`, `src/engine/risk.ts`, `src/engine/layout.ts`, `src/engine/entityIndex.ts`) and `src/storage/folderSerializer.ts`. Pure engines have zero DOM/React/localStorage dependencies.
2. **Atomic Writes & Rolling Undo**:
   - Write to `<filepath>.tmp` followed by atomic `rename`.
   - Before mutating any workbook, copy current content to `<Workspace>/.snapshots/<wbId>_<timestamp>.json`.
   - Automatically prune `.snapshots/` to retain at most the last 20 snapshots per workbook.
   - Increment `revision`, update `updatedAt`, and append an audit record to `lastAgentMutation`:
     `{ agentName: string, toolName: string, summary: string, timestamp: string }`.
3. **17 Zod-Validated MCP Tools**:
   - **Discovery**: `list_workbooks`, `get_workbook_full`, `search_entities`
   - **Graph Mutation**: `create_workbook`, `add_or_import_entity`, `update_placement_attributes`, `create_branch`, `update_branch`, `delete_branch`, `run_tidy_up_layout`
   - **Public Choice Utility**: `get_public_choice_utility_report`, `update_utility_strategy_weights`, `patch_workbook_metadata`
   - **Two-Layer Risk**: `get_structural_risk_report`, `write_risk_assessment_box`
   - **Spreadsheet Interop**: `export_workbook_spreadsheet`, `batch_import_workflow_rows`
4. **4 MCP Resources**:
   - `partnership://workspace/overview`
   - `partnership://workspace/entities`
   - `partnership://workbook/{id}/graph`
   - `partnership://workbook/{id}/metrics`
5. **DASH-04 UI Experience**:
   - The UI watches/detects workspace updates or recent `lastAgentMutation`.
   - When an agent mutation is detected, the UI flashes subtle row highlights and renders an "Undo Agent Change" banner/button in the toolbar or maximized dashboard.
   - Clicking `Undo Agent Change` restores state from the most recent snapshot in `.snapshots/`.
6. **4 Agent Skills**:
   - Written according to the blueprints in Section 9 of the master architecture specification.
   - Installed in `.agent/skills/`, `.claude/skills/`, and `.cursor/skills/`.

## References
- `version_2_master_architecture_public_choice_engine_mcp_build_protocols.txt` (Sections 8 & 9)
- `PRODUCT.md` and `DESIGN.md`
