# Phase 6 Context: Portable Workspace Storage, Landing Page & Cross-Workbook Autocomplete

## Goal
Transition QualCount from a single-file/localStorage prototype into a multi-project desktop operating system using portable Workspace Folders (`workspace.json`, `entities.json`, `workbooks/*.json`), an editorial Landing Page (book cover + table of contents), a persistent Legacy Menu Bar (`File`, `View`, `Tools`), a collapsible Book Index sidebar, and live cross-project entity memory with autocomplete and proven bridge reuse.

## Requirements Covered
- `STOR-04`: Portable Workspace Folder storage architecture (`workspace.json`, `entities.json`, `workbooks/*.json`, `.snapshots/`) implemented via `WorkspaceRepository`.
- `NAV-01`: Editorial Landing Page (book cover and table of contents) listing connected workspaces and workbooks with `[Local]` and `[Google Drive]` badges, summary KPIs, search bar, and Overview Map macro-graph toggle.
- `NAV-02`: Persistent Legacy Menu Bar (`File`, `View`, `Tools`) with keyboard shortcuts across Landing Page and canvas, paired with a collapsible Book Index sidebar for sibling workbook flipping.
- `MEM-01`: Live 3-character fuzzy entity autocomplete against `entities.json` and device-local `recent-entities-index.json` ("collectorate" lookup).
- `MEM-02`: One-click entity import with self-contained origin metadata (`importedFrom`), with an optional toggle to pull confirmed downstream referral leads as dashed pending yellow branches.

## Architecture & Storage Invariants
1. **Folder Layout**:
   ```
   <WorkspaceName>/
   ├── workspace.json            # Manifest, workbook list, workbookLinks
   ├── entities.json             # Deduplicated organization directory
   ├── workbooks/
   │   ├── wb_<uuid>.json        # Placements, branches, weights, risk
   │   └── ...
   └── .snapshots/               # Local-only rolling backups
       └── wb_<uuid>_<ts>.json
   ```
2. **Self-Containment**: A Workspace Folder shared across teams (via Google Drive or USB) must remain 100% self-contained. When importing an entity from an external workspace, copy the entity record into the target `entities.json` with an `importedFrom` provenance record.
3. **No False Confirmations**: When pulling proven bridges from another project, imported referral connections MUST start as **dashed pending** (`status: "pending"`) yellow branches, never auto-ticked.
4. **Editorial Aesthetic**: Follow `PRODUCT.md` and `DESIGN.md`—warm paper surfaces (`#FAF8F4`), crisp 1px borders (`#DDD6C8`), serif titles (`Source Serif 4`), monospace tabular KPIs (`IBM Plex Mono`), zero card-in-card nesting.

## References
- `version_2_master_architecture_public_choice_engine_mcp_build_protocols.txt` (Section 6: Pillar 5)
- `PRODUCT.md` and `DESIGN.md`
