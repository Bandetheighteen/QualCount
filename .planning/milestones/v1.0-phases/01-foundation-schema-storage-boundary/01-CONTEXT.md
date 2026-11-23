# Phase 1 Context: Foundation, Schema & Storage Boundary

**Phase Goal:** Establish the project toolchain, normalized 5-table relational schema, async storage repository boundary, and pre-loaded Delhi NGO seed scenario.

## Requirements Covered

- **DATA-01**: Normalized relational schema (`entities`, `workbooks`, `placements`, `branches`, `workbook_links`) decoupling master organization profiles from per-workbook placement coordinates and isolating graph topology.
- **DATA-02**: Pre-loaded Delhi Youth Governance Exhibition seed scenario (`seedDelhiNgo.ts`) with 11 nodes and 15 directed branches across 4 tiers in a bottom-to-top layout.
- **STOR-01**: All persistent operations flow exclusively through an async `WorkspaceRepository` interface (`loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, `importWorkspaceFile`).
- **STOR-02**: Web persistence adapter (`LocalStorageRepository`) persists validated `WorkspaceState` JSON to browser `localStorage` and provides schema-validated JSON export/import.
- **STOR-03**: Phase 2 desktop adapter stub (`TauriSqliteRepository`) defines typed Tauri v2 Rust IPC commands (`load_workspace`, `save_workspace`, etc.) with an environment-aware repository selector (`src/storage/index.ts`).

## Critical Architectural Constraints

1. **Vite Relative Paths**: `vite.config.ts` must set `base: './'` so compiled production assets load properly via `file://` or custom URI schemes in Windows WebView2.
2. **Storage Decoupling**: ZERO `localStorage`, `FileReader`, or `<input type="file">` calls outside `src/storage/localStorageRepository.ts`.
3. **Pure Schema Types**: `src/types/schema.ts` must use plain JSON-serializable types (ISO date strings, plain records) compatible with Phase 2 Rust Serde deserialization.
4. **Offline First**: All dependencies must be locally bundleable without runtime external CDN dependencies.
