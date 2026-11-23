# Phase 2 Context: Pure Domain Engines

**Phase Goal:** Implement four pure TypeScript engines in `src/engine/` (`metrics.ts`, `parallelEdges.ts`, `overlap.ts`, `layout.ts`) with zero imports from `react`, `window`, `document`, or `localStorage`.

## Requirements Covered

- **ENG-01**: Pure layout engine (`src/engine/layout.ts`) executing bottom-to-top Sugiyama layered drawing using `elkjs` (`elk.direction: "UP"`, `elk.algorithm: "layered"`) with a read-only topology guarantee and isolated node resilience.
- **ENG-02**: Pure local anti-overlap engine (`src/engine/overlap.ts`) resolving rectangular bounding-box collisions with a 24px safety margin, nudging only colliding neighbors while keeping the user's dragged card anchored.
- **ENG-03**: Pure parallel edge engine (`src/engine/parallelEdges.ts`) computing lateral Bezier curve offsets for concurrent multiplex branches connecting the same pair of nodes.
- **ENG-04**: Pure quantitative metrics engine (`src/engine/metrics.ts`) computing all 7 topology metrics (Funding % & INR, Direct White ties & confirmation rate %, Confirmed Yellow Bridges, Owned Conversions, Multi-Thread Targets, Top Amplifier Reach BFS, and Bridge Concentration Risk %) with zero subjective scoring.

## Critical Invariants & Constraints

1. **Pure Engine Isolation**: Zero imports of `react`, `window`, `document`, or `localStorage` inside `src/engine/*`.
2. **Read-Only Topology**: Layout and overlap engines compute spatial coordinates only. They never add, remove, or modify branches.
3. **Deterministic Math**: Given the same inputs, all engines return identical coordinate mappings and metric calculations.
4. **Isolated Node Resilience**: Layout and metrics engines must never crash when isolated nodes (zero degree) exist.
