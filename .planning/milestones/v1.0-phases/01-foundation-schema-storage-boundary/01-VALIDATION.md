# Phase 1 Validation Strategy: Foundation, Schema & Storage Boundary

**Phase:** 1 (Foundation, Schema & Storage Boundary)
**Date:** 2026-11-20

## Verification Matrix

| Requirement | Test / Verification Method | Expected Result |
|---|---|---|
| **DATA-01** (Schema) | `npx tsc --noEmit` on `src/types/schema.ts` | Zero TypeScript errors; all 5 relational tables declared with JSON-serializable types |
| **DATA-02** (Seed Data) | Runtime assertion script importing `seedDelhiNgo.ts` | Exactly 11 entities, 11 placements (4 tiers, 1 root), and 15 branches (2 green, 3 white, 10 yellow) |
| **STOR-01** (Repository Interface) | Interface typecheck in `src/storage/workspaceRepository.ts` | Complete definition of `loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, `importWorkspaceFile` |
| **STOR-02** (LocalStorage Adapter) | Validation logic in `src/storage/localStorageRepository.ts` | Validates schema version = 1; roundtrip JSON serialization test passes |
| **STOR-03** (Tauri SQLite Stub) | Provider factory in `src/storage/index.ts` | Detects `__TAURI_INTERNALS__` in window or defaults to `LocalStorageRepository` |

## Automated Verification Commands

```bash
# Verify TypeScript strict compilation
npx tsc --noEmit

# Verify Vite build
npx vite build
```
