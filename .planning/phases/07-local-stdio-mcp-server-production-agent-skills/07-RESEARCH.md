# Phase 7 Research: Local Stdio MCP Server & Production Agent Skills

## Technology & Protocol Analysis

### 1. `@modelcontextprotocol/sdk` (v1.x) Stdio Server
The Model Context Protocol TypeScript SDK uses `Server` from `@modelcontextprotocol/sdk/server/index.js` and `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
Tool definitions are registered with `server.setRequestHandler(ListToolsRequestSchema, ...)` and `server.setRequestHandler(CallToolRequestSchema, ...)` or via higher-level `McpServer` class.
The modern v1 SDK provides `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "partnership-ledger",
  version: "2.0.0"
});

server.tool(
  "tool_name",
  "tool description",
  { param: z.string().describe("...") },
  async ({ param }) => {
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```
This API allows typing and validation directly via `zod`.

### 2. Pure Engine Integration
The MCP server needs access to:
- `calculatePublicChoiceUtility` from `src/engine/utility.ts`
- `calculateDeterministicRisk` from `src/engine/risk.ts`
- `computeHierarchicalLayout` from `src/engine/layout.ts`
- `searchEntities` from `src/engine/entityIndex.ts`
- Schema types from `src/types/schema.ts`
- Storage serialization from `src/storage/folderSerializer.ts`

Because all these modules are pure TypeScript (zero DOM/React/localStorage imports), they can either be referenced directly via relative TypeScript paths (`../../src/engine/...`) or re-exported via root build artifacts.

### 3. File Atomicity & Snapshot Rolling Strategy
When an MCP tool mutates files:
1. Snapshotting:
   - Path: `<workspaceRoot>/.snapshots/wb_<workbookId>_<timestamp>.json`
   - Read the existing `workbooks/wb_<id>.json` content.
   - Write snapshot copy.
   - List all snapshots matching `wb_<workbookId>_*.json` in `.snapshots/`. If count > 20, sort by filename/mtime and remove the oldest files so only 20 remain.
2. Atomic Writing:
   - Write JSON payload to `<targetFile>.tmp`.
   - Call `fs.promises.rename(<targetFile>.tmp, targetFile)`.
   - On Windows, `fs.promises.rename` can occasionally throw `EPERM` if another process briefly locks the file. Best practice is to use an atomic helper with retry/unlink fallback.
3. Revision & Stamp:
   - Increment `workbook.revision = (workbook.revision || 1) + 1`.
   - Set `workbook.updatedAt = new Date().toISOString()`.
   - Stamp `workbook.lastAgentMutation = { agentName: agentName || "AI Agent", toolName, summary, timestamp: new Date().toISOString() }`.

### 4. UI Hot Reload & `Undo Agent Change` Button (`DASH-04`)
In the web/desktop UI:
- When a user is viewing a workbook, we can track `lastAgentMutation` and `revision`.
- If `lastAgentMutation` timestamp is within the last few minutes or if a new revision was loaded, the UI renders:
  - An "Agent edit by <agentName>: <summary>" notification banner in `ActionToolbar` and `MaximizedDashboard`.
  - An `Undo Agent Change` button.
  - Temporary subtle highlight animation or amber/emerald indicator on modified items.
- Clicking `Undo Agent Change`:
  - Scans `<Workspace>/.snapshots/` for the latest snapshot of the active workbook.
  - Replaces `workbooks/wb_<id>.json` with the snapshot data.
  - Updates Zustand state so the canvas immediately reflects the reverted state.
  - Provides a celebratory/toast feedback: "Reverted to snapshot prior to <agentName>'s edit".

### 5. Four Production Agent Skills (Section 9)
The skills must be written in canonical Markdown format with frontmatter:
1. `partnership-graph-operator`:
   - Rules: Search before creating, strict 3-color branch semantics, ownership separation (white vs yellow), preserve declined memory (status: "cross"), no false confirmations, keep canvas clean (`run_tidy_up_layout`).
2. `public-choice-utility-analyst`:
   - Rules: Diagnose Olson/Niskanen incentive blindness, audit Ostrom credible commitments, audit Buchanan-Tullock efficiency $\eta_i$, audit Ostrom durability (borrowed vs owned).
3. `two-layer-risk-auditor`:
   - Rules: Synthesize Layer 1 parameters $R_1..R_6$ with Layer 2 qualitative context, write 3-6 failure scenarios (title, severity, likelihood, affectedPlacementIds, triggerCondition, mitigationAction), write publicChoiceDiagnosis, call `write_risk_assessment_box`.
4. `spreadsheet-to-workflow-mapper`:
   - Rules: Prevent 100-node canvas tangle (group/filter cold leads), normalize India-aware currency strings (₹2.5L, 1 Cr, 50k), map statuses, detect referral chains, commit via `batch_import_workflow_rows` with `runTidyUpAfter: true`.

Each skill will be placed in:
- `.agent/skills/<skill-name>/SKILL.md` (for Antigravity)
- `.claude/skills/<skill-name>/SKILL.md` (for Claude Code)
- `.cursor/skills/<skill-name>/SKILL.md` (for Cursor)
