# Phase 7 Validation Protocol

## Automated Test Coverage

1. **Test Suite `test/mcp_server_and_skills.test.ts`**:
   - **MCP Server Initialization & Transport**:
     - Boots the `McpServer` instance and verifies tool registration (all 17 tools listed and schemas valid).
     - Verifies 4 MCP resources registration (`partnership://...`).
   - **Discovery Tools**:
     - `list_workbooks`: returns accurate summaries for all workbooks in a mock workspace folder.
     - `get_workbook_full`: returns resolved entity names and computed utility/risk reports.
     - `search_entities`: finds matches using fuzzy keywords (e.g., "museum", "collectorate").
   - **Graph Mutation Tools**:
     - `create_workbook`: creates valid `wb_<id>.json` with Tier 0 Root NGO and updates `workspace.json`.
     - `add_or_import_entity`: deduplicates by name, places card, optionally pulls yellow pending branches.
     - `update_placement_attributes`: updates selective incentives, co-ownership booleans, outreach touches.
     - `create_branch`: validates rules, generates branch, stamps audit trail.
     - `update_branch`: toggles status, updates in-kind value.
     - `delete_branch`: deletes branch cleanly.
     - `run_tidy_up_layout`: computes non-overlapping bottom-to-top layout and updates positions.
   - **Utility & Risk Tools**:
     - `get_public_choice_utility_report`: matches pure engine outputs.
     - `update_utility_strategy_weights`: validates sum = 1.00 and saves weights.
     - `patch_workbook_metadata`: edits title/budget.
     - `get_structural_risk_report`: returns 6 parameters and tier.
     - `write_risk_assessment_box`: updates Layer 2 audit fields.
   - **Spreadsheet Interop**:
     - `export_workbook_spreadsheet`: outputs valid CSV/XLSX file.
     - `batch_import_workflow_rows`: parses rows, creates placements and branches, performs tidy up.
   - **Atomicity & Snapshots**:
     - Verifies `.tmp` file is used during write.
     - Verifies `.snapshots/` file is created before each mutation.
     - Verifies rolling cap: creates 22 snapshots and verifies only the latest 20 are retained.
     - Verifies snapshot rollback restores prior state exactly.
   - **UI Integration (DASH-04)**:
     - Verifies UI state detects `lastAgentMutation`.
     - Verifies `Undo Agent Change` triggers rollback and updates Zustand store.
   - **Skills Verification**:
     - Verifies that all 4 `SKILL.md` files exist in `.agent/skills/`, `.claude/skills/`, and `.cursor/skills/` with valid YAML frontmatter and comprehensive instructions.

## Verification Commands
- `npx tsc --noEmit`
- `npx tsx test/mcp_server_and_skills.test.ts`
- `npm test`
