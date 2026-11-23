# Phase 5 Validation Strategy: Core Engines, Analytical Dashboard & Impeccable Design

## Validation Architecture

1. **Deterministic Unit Tests**:
   - `test/engine/utility.test.ts`: Asserts exact Public Choice formulas ($O_i, S_i, R_i, A_i, V_i, C_i, U_i, \eta_i, \text{PUI}$) on the 11-node Delhi exhibition scenario.
   - `test/engine/risk.test.ts`: Asserts all 6 structural parameters ($R_1..R_6$) and aggregate tier matches.
   - `test/schema_v2.test.ts`: Verifies v1-to-v2 auto-migration lossless fidelity.
   - `test/spreadsheet_io.test.ts`: Verifies CSV RFC-4180 export and 3-door import JSON validation.
2. **Deterministic Static Checks**:
   - `npx tsc --noEmit` verifies strict TypeScript compilation.
   - `npx impeccable detect src/` verifies 0 slop findings across all modified UI components.
3. **Interactive & Canvas Invariant Tests**:
   - Verify React Flow handle positions (`Top` source, `Bottom` target) and `elkjs` UP layout.
   - Verify `stopPropagation()` on edge tick/cross buttons.
   - Verify `Cmd/Ctrl + Shift + D` toggles maximized dashboard without resetting canvas pan/zoom.

## Automated Verification Commands
```bash
npx tsc --noEmit
npx tsx test/engine/utility.test.ts
npx tsx test/engine/risk.test.ts
npx tsx test/schema_v2.test.ts
npx tsx test/spreadsheet_io.test.ts
```
