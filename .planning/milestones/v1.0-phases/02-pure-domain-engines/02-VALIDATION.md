# Phase 2 Validation Strategy: Pure Domain Engines

**Phase:** 2 (Pure Domain Engines)
**Date:** 2026-11-20

## Verification Matrix

| Requirement | Test / Verification Method | Expected Result |
|---|---|---|
| **ENG-01** (Layout) | Automated test in `test/phase2.test.ts` running `computeHierarchicalLayout` on seed graph | Returns coordinates where Tier 0 $y >$ Tier 1 $y >$ Tier 2 $y >$ Tier 3 $y$; isolated nodes handled without error |
| **ENG-02** (Overlap) | Automated test running `resolveLocalCollisions` with overlapping boxes | Displaces neighbor box by minimum distance $\ge$ overlap; dragged box coordinates unchanged |
| **ENG-03** (Parallel Curves) | Automated test running `computeParallelBezierCurve` on single and multi-edge pairs | Single edge offset = 0; dual parallel edges have distinct symmetric offsets ($d_1 = -18, d_2 = +18$) |
| **ENG-04** (Metrics) | Automated test running `computeTopologyMetrics` against Delhi seed dataset | Secured: 40% (₹400,000); Direct white ties: 1 tick, 1 cross; Yellow bridges: 9 tick, 1 pending; Multi-thread: 1 triple-thread (Sports Dev); Owned conversions: 1 / 6; Top amplifier: City Museum |

## Automated Verification Commands

```bash
# Typecheck
npx tsc --noEmit

# Run Phase 2 engine test suite
npm run test:phase2
```
