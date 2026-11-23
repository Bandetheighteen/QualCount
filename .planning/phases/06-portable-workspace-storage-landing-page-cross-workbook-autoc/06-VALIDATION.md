# Phase 6 Validation Strategy: Portable Workspace Storage, Landing Page & Cross-Workbook Autocomplete

## Validation Architecture

1. **Deterministic Unit Tests**:
   - `test/folder_storage.test.ts`:
     - Verifies serialization and deserialization of the canonical Workspace Folder layout (`workspace.json`, `entities.json`, `workbooks/*.json`).
     - Verifies bundle zip/json export and import with multi-workbook fidelity.
   - `test/landing_page_and_navigation.test.ts`:
     - Verifies view state transitions between Landing Page and Canvas.
     - Verifies Overview Map topology calculation (shared entity links and `workbookLinks`).
     - Verifies Legacy Menu Bar command dispatch and keyboard shortcuts.
   - `test/entity_autocomplete.test.ts`:
     - Verifies 3-character fuzzy search against `entities.json` and cross-workspace index.
     - Verifies self-contained import semantics (provenance metadata `importedFrom`).
     - Verifies proven-bridge pull creates strictly dashed `pending` yellow branches with zero false confirmations.

2. **Deterministic Static Checks**:
   - `npx tsc --noEmit` verifies strict TypeScript compilation.
   - `npm test` runs full regression test suite (all 13 existing suites + new Phase 6 suites).
   - `npm run build` verifies production Vite bundle.

## Automated Verification Commands
```bash
npx tsc --noEmit
npx tsx test/folder_storage.test.ts
npx tsx test/landing_page_and_navigation.test.ts
npx tsx test/entity_autocomplete.test.ts
npm test
```
