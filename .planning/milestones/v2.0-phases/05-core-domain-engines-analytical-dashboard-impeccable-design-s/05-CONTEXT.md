# Phase 5 Context: Core Domain Engines, Analytical Dashboard & Impeccable Design System

## Goal
Implement the core mathematical engines of Public Choice Theory and deterministic structural risk, upgrade the data schema to Version 2, restyle the application with the "Archival Book & Ledger" Impeccable design system, create the Maximized Full-Screen Dashboard (`Cmd/Ctrl + Shift + D`) with a persistent Two-Layer Risk Assessment Box, and provide native CSV/Excel export and a 3-door import pipeline—all while strictly preserving 100% of v1.0 canvas interaction behavior.

## Requirements Covered
- `SCH-01`: Master TypeScript Data Schema Version 2 in `src/types/schema.ts` (`WorkspaceManifest`, `EntitiesFile`, `WorkbookFile`, `Placement` with Public Choice attributes, `Branch` with `inKindValueInr` and resolution timestamps, `AgentRiskAssessment`).
- `SCH-02`: Schema auto-migration layer for seamless, lossless upgrade of v1 JSON files and seed data.
- `ENG-05`: Pure TypeScript Public Choice utility engine (`src/engine/utility.ts`) computing $O_i, S_i, R_i, A_i, V_i, C_i, U_i, \eta_i, \text{PUI}$ and transparent 4-part additive audit decomposition.
- `ENG-06`: Pure TypeScript deterministic Layer 1 risk engine (`src/engine/risk.ts`) computing 6 structural parameters ($R_1..R_6$) with pinpointed offending placement/branch IDs and aggregate tier.
- `DES-01`: Archival Book & Ledger visual system (`PRODUCT.md`, `DESIGN.md`) featuring warm archival paper (`#FAF8F4`), high-contrast ink branches (`#0F6B38`, `#18181B`, `#B45309`), serif display headings, humanist sans body, monospace tabular numbers, and dark matte toggle.
- `DES-02`: 62-rule deterministic slop detection compliance (`npx impeccable detect src/`), eliminating purple/blue gradients and card-in-card nesting while preserving all v1 canvas invariants.
- `DASH-01`: Maximized Full-Screen Analytical Dashboard (`Cmd/Ctrl + Shift + D`) over the active workbook with a 4-section editorial layout.
- `DASH-02`: Public Choice Utility Ledger table with inline editable cells (touch steppers, selective incentive tags, co-ownership checkboxes, strategy weight presets).
- `DASH-03`: Two-Layer Risk Assessment Box with Layer 1 deterministic matrix alongside Layer 2 persistent agent audit briefing.
- `IO-01`: Native RFC-4180 UTF-8 BOM CSV bundles and 4-tab Excel workbook (`.xlsx`) export.
- `IO-02`: Three-Door Spreadsheet Import modal (structured template CSV/XLSX, local MCP skill instructions, dynamic Web AI conversion prompt).

## Non-Negotiable Invariants
1. **Preserve Canvas Invariants**: Do NOT alter React Flow handle positions (`Position.Top` source, `Position.Bottom` target), `elkjs` UP layout direction, anti-overlap nudging on drop, `EdgeLabelRenderer` portals, or `event.stopPropagation()` on tick/cross buttons.
2. **Ratio-Scale Mathematics Only**: Never introduce subjective 1-to-5 ratings or arbitrary point scores. All utility scores are derived from verifiable behavioral facts ($O_i$), incoming yellow referral topology ($S_i$), and decision touches ($d_i$).
3. **Pure TypeScript Engines**: `src/engine/utility.ts` and `src/engine/risk.ts` must have zero imports from `react`, `window`, `document`, or `localStorage` to ensure direct sharing with `packages/mcp-server/`.
4. **Offline-First & Lossless Migration**: Everything must run fully offline without external API requirements; v1 data loads without loss.

## References
- `version_2_master_architecture_public_choice_engine_mcp_build_protocols.txt` (Sections 1-5, 7, 10)
- `PRODUCT.md` and `DESIGN.md` in repository root
