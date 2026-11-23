# Phase 1 Research: Foundation, Schema & Storage Boundary

**Phase:** 1
**Domain:** Foundation, Schema Design & Storage Architecture
**Date:** 2026-11-20
**Confidence:** HIGH

## Technical Implementation Approach

### 1. Toolchain & Configuration

- **Vite 6**:
  - `vite.config.ts`: Must configure `base: './'` for Tauri webview relative path resolution.
  - `@vitejs/plugin-react` for JSX runtime.
- **TypeScript**:
  - `tsconfig.json`: `strict: true`, `noImplicitAny: true`, `target: ES2022`, `moduleResolution: bundler`.
- **Tailwind CSS**:
  - `tailwind.config.js`: Configure dark palette with `#0b0f17` studio background, neon accents (`#39ff14`, `#fde047`, `#38bdf8`), and muted states (`#52525b`, `#4b5d52`).
  - `postcss.config.js`: Standard `tailwindcss` and `autoprefixer`.

### 2. Normalized Relational Schema (`src/types/schema.ts`)

Must strictly declare the 5 relational tables:
- `EntityCategory`: `'ngo' | 'csr' | 'government' | 'institution' | 'community' | 'other'`
- `BranchType`: `'green' | 'white' | 'yellow'`
- `BranchStatus`: `'pending' | 'tick' | 'cross'`
- `Entity`: `{ entityId, name, category, globalNotes, createdAt }`
- `Workbook`: `{ workbookId, title, description, targetBudgetInr, status: 'active' | 'archived' | 'draft', createdAt, updatedAt }`
- `Placement`: `{ placementId, workbookId, entityId, isRootNgo, x, y, width, height }`
- `Branch`: `{ branchId, workbookId, sourcePlacementId, targetPlacementId, type, status, valuePct?, note, updatedAt }`
- `WorkbookLink`: `{ linkId, sourceWorkbookId, targetWorkbookId, relationLabel, note }`
- `WorkspaceState`: `{ schemaVersion: 1, activeWorkbookId, entities, workbooks, placements, branches, workbookLinks }`

### 3. Storage Repository Layer (`src/storage/`)

- `workspaceRepository.ts`: Defines async interface and schema validation guard `isWorkspaceState(data: unknown): data is WorkspaceState`.
- `localStorageRepository.ts`: Implements browser `localStorage` persistence under key `qualcount_workspace_v1`. Implements `exportWorkspaceFile` creating a downloadable Blob and `importWorkspaceFile` using an ephemeral hidden file input returning a Promise.
- `tauriSqliteRepository.ts`: Stub implementing `WorkspaceRepository` documenting planned `@tauri-apps/api/core` `invoke()` calls.
- `index.ts`: Evaluates `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window` to return `tauriSqliteRepository` or `localStorageRepository`.

### 4. Delhi Seed Dataset (`src/data/seedDelhiNgo.ts`)

- 11 Nodes arranged in 4 tiers:
  - **Tier 0 (Root NGO)**: Your NGO ($x=450, y=650$)
  - **Tier 1 (Direct Outreach)**: Agrocell CSR ($x=100, y=450$), XYZ CSR ($x=320, y=450$), City Museum ($x=550, y=450$), Dept of Social Security ($x=800, y=450$)
  - **Tier 2 (Referrals)**: Ministry of Food ($x=50, y=250$), Ministry of Agriculture ($x=250, y=250$), Collectorate Office ($x=450, y=250$), Youth Dev Office ($x=650, y=250$), Cultural Dev Office ($x=850, y=250$)
  - **Tier 3 (Converged Target)**: Sports Dev Office ($x=650, y=50$)
- 15 Directed Branches:
  - 1: Your NGO -> XYZ CSR (green, tick, M25, "CSR grant + co-partner credit")
  - 2: Your NGO -> Agrocell CSR (green, tick, M15, "Partial CSR grant")
  - 3: Your NGO -> Agrocell CSR (yellow, tick, "Ministry gateway partner")
  - 4: Agrocell CSR -> Ministry of Food (yellow, tick, "Formal intro confirmed")
  - 5: Agrocell CSR -> Ministry of Agriculture (yellow, pending, "Intro email requested")
  - 6: Your NGO -> City Museum (white, tick, "Exhibition venue + co-host")
  - 7: Your NGO -> City Museum (yellow, tick, "Institutional network amplifier")
  - 8: Your NGO -> Dept of Social Security (white, cross, "Declined attendance (visible gray)")
  - 9: City Museum -> Collectorate Office (yellow, tick, "Formal museum referral")
  - 10: City Museum -> Youth Dev Office (yellow, tick, "Active co-amplifier")
  - 11: City Museum -> Cultural Dev Office (yellow, tick, "Active co-amplifier")
  - 12: City Museum -> Sports Dev Office (yellow, tick, "Referral 1 of 3")
  - 13: Youth Dev Office -> Sports Dev Office (yellow, tick, "Referral 2 of 3")
  - 14: Cultural Dev Office -> Sports Dev Office (yellow, tick, "Referral 3 of 3")
  - 15: Your NGO -> Youth Dev Office (white, tick, "Converted to direct NGO contact")

## Validation Architecture

1. `npm run build` or `npx tsc --noEmit`: Confirms TypeScript strict compilation with zero type errors.
2. Unit verification script: Asserts `isWorkspaceState(seedDelhiNgo)` returns `true` and contains 11 entities, 11 placements, and 15 branches.
3. Repository contract verification: Asserts repository operations correctly serialize and deserialize `WorkspaceState`.
