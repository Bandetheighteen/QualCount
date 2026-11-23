# Phase 6 Research & Engineering Specification

## 1. Portable Workspace Folder Architecture (`STOR-04`)

### Why Portable Folders over SQLite
Single-file SQLite databases with `-wal` and `-shm` files risk silent corruption when synced across cloud storage providers (Google Drive, Dropbox, OneDrive) and heterogeneous OSes (SQLite, 2026). Plain JSON files inside a clean folder structure guarantee:
- Conflict safety (each workbook is an independent JSON file).
- Human inspectability and git diffability.
- Native node.js fs and Tauri fs interoperability without C bindings.
- Local MCP server access without database locking conflicts.

### File Schema Specifications
1. **`workspace.json`** (`WorkspaceManifest`):
   ```json
   {
     "schemaVersion": 2,
     "workspaceId": "ws_delhi_coalitions",
     "name": "Delhi Civil Alliances",
     "revision": 1,
     "workbooks": {
       "wb_youth_exhibition": {
         "workbookId": "wb_youth_exhibition",
         "fileName": "workbooks/wb_youth_exhibition.json",
         "title": "Delhi Youth Governance Exhibition",
         "status": "active",
         "updatedAt": "2026-11-21T10:00:00Z"
       }
     },
     "workbookLinks": {},
     "createdAt": "2026-11-21T10:00:00Z",
     "updatedAt": "2026-11-21T10:00:00Z"
   }
   ```
2. **`entities.json`** (`EntitiesFile`):
   Master deduplicated registry of organizations across all workbooks in this workspace.
3. **`workbooks/wb_<id>.json`** (`WorkbookFile`):
   Self-contained workbook containing placements, branches, utility weights, and risk assessment.
4. **`.snapshots/wb_<id>_<timestamp>.json`**:
   Rolling 20 backups per workbook for instant undo.

---

## 2. Editorial Landing Page & Overview Macro-Map (`NAV-01`)

### View State Architecture
In keeping with `ARCH-01` (webview-safe state navigation, zero URL routing that breaks in WebView2 file protocols):
- Zustand store manages `activeView: 'landing' | 'canvas'`.
- Application boots default to `'landing'`.
- Clicking any workbook row sets `activeWorkbookId` and flips `activeView` to `'canvas'`.
- "Back to Cover & Index" button in menu or Book Index flips back to `'landing'`.

### Overview Macro-Map
- When user toggles "Overview Map" on the Landing Page:
  - Workbooks render as macro-nodes.
  - Edges connect workbooks that share entities (edge label: e.g. "3 shared partners").
  - Explicit `workbookLinks` (e.g. "predecessor", "spinoff", "parallel track") render as styled directional lines.

---

## 3. Persistent Legacy Menu Bar & Sibling Book Index (`NAV-02`)

### Menu Hierarchy
- `File`:
  - New Workbook (Cmd/Ctrl + N)
  - New Workspace Folder
  - Open Local Workspace Folder (Cmd/Ctrl + O)
  - Connect Google Drive Folder
  - Separator
  - Save (Cmd/Ctrl + S)
  - Save Copy / Snapshot
  - Separator
  - Import > (Workbook JSON, Structured CSV/Excel, Messy Spreadsheet via AI)
  - Export > (Workbook JSON, CSV Bundle, Excel Workbook)
  - Separator
  - Return to Cover & Landing Page
- `View`:
  - Maximize Dashboard (Cmd/Ctrl + Shift + D)
  - Toggle Book Index Sidebar
  - Show Declined (Gray) Paths
  - Theme: Warm Paper (Light) / Charcoal Matte (Dark)
- `Tools`:
  - Tidy Up (Bottom-to-Top) (Cmd/Ctrl + Shift + L)
  - MCP Server Setup & Connection Info

### Book Index Sidebar
- Positioned on the left margin (width 220px, collapsible to 24px tab).
- Lists all sibling workbooks in the open workspace folder.
- Displays workbook title, status pill, and summary metric chip (`PUI` or `M%`).
- Clicking a sibling switches the active workbook instantly without page reload.

---

## 4. Cross-Workbook Entity Autocomplete & Proven Bridges (`MEM-01`, `MEM-02`)

### Local Cross-Workspace Index
- Stored in browser storage / local config as `recent-entities-index.json`.
- Indexed entry:
  `{ entityId, name, normalizedName, category, workspaceId, workspaceName, sourceType, workbookMentions: [...] }`
- Matching logic:
  - Input length $\ge 3$ characters.
  - Normalize query: lowercase, trim, remove non-alphanumeric.
  - Search order: current workspace `entities.json` matches first, then external workspaces from recent index.

### Proven-Bridge Pull Semantics
- When an entity from Project 1 (e.g. City Museum) is imported into Project 2:
  - If user selects "Import + Proven Yellow Leads":
    - Find all non-root nodes that received confirmed yellow branches from City Museum in Project 1.
    - If those target entities do not exist in Project 2, add them to `entities.json`.
    - Create placements for them on Project 2's canvas.
    - Create yellow branches `City Museum -> Target` with `status: "pending"` (dashed yellow).
    - NEVER auto-tick imported branches. New projects must verify actions independently!
