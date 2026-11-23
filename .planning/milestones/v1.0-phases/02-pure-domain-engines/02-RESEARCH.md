# Phase 2 Research: Pure Domain Engines

**Phase:** 2
**Domain:** Quantitative Graph Metrics & Geometric Coordinate Algorithms
**Date:** 2026-11-20
**Confidence:** HIGH

## Technical Implementation Approach

### 1. Quantitative Metrics Engine (`src/engine/metrics.ts`)

Pure functions operating over `WorkspaceState` or `{ placements, branches, workbook }`:
- **Funding**:
  - `securedPct`: $\sum$ `valuePct` for branches with `type === 'green' && status === 'tick'`
  - `pendingPct`: $\sum$ `valuePct` for branches with `type === 'green' && status === 'pending'`
  - `declinedCount`: count of `type === 'green' && status === 'cross'`
  - `securedInr`: `(securedPct / 100) * workbook.targetBudgetInr`
- **Direct White Ties**:
  - Filter `type === 'white' && sourcePlacementId === rootPlacementId`
  - `confirmedCount` (`status === 'tick'`), `pendingCount` (`status === 'pending'`), `declinedCount` (`status === 'cross'`)
  - `confirmationRatePct`: `(confirmed / (confirmed + declined)) * 100` (0 if denominator is 0)
- **Confirmed Yellow Bridges**:
  - Filter `type === 'yellow' && status === 'tick'`
  - Counts for confirmed, pending, declined
- **Owned Conversions**:
  - Non-root placements with $\ge 1$ incoming ticked yellow branch = $N_{\text{referred}}$
  - Non-root placements with BOTH $\ge 1$ incoming ticked yellow AND $\ge 1$ incoming ticked white from root NGO = $N_{\text{converted}}$
  - `conversionRatePct`: `(N_converted / N_referred) * 100` (0 if $N_{\text{referred}} === 0$)
- **Multi-Thread Targets**:
  - For each placement $p$, compute `yellowInDegree(p)` = count of incoming yellow branches with `status === 'tick'`
  - Count placements where `yellowInDegree === 2`, `=== 3`, and $\ge 4$
  - Return names of organizations with $\ge 3$
- **Top Amplifier Reach (BFS)**:
  - Directed graph along ticked yellow branches
  - For every non-root placement $u$, execute BFS to discover unique downstream nodes reachable from $u$ (excluding $u$ and root)
  - Return top amplifier `{ entityId, entityName, directOutDegree, downstreamReachCount }`
- **Bridge Concentration Risk**:
  - Compute total unique indirect reach from root NGO via ticked yellow paths of length $\ge 2$: $R_{\text{total}}$
  - Remove highest-reach bridge $b$ and recompute reachable set without $b$: $R_{\text{without } b}$
  - `concentrationPct = ((|R_total| - |R_without_b|) / |R_total|) * 100` (0 if $|R_{\text{total}}| === 0$)

### 2. Parallel Bezier Curve Routing (`src/engine/parallelEdges.ts`)

When multiple branches connect the same pair of nodes (e.g. Your NGO -> Agrocell CSR with Green + Yellow, or Your NGO -> City Museum with White + Yellow):
- Identify all parallel branches between placement pair $(u, v)$ regardless of direction
- For $k$ parallel branches, assign index $i \in [0, k-1]$
- Compute normal vector $N = (-V_y/L, V_x/L)$ to the source-to-target segment
- Compute offset distance $d_i = (i - (k - 1) / 2) \times 36$ pixels
- Control points for cubic Bezier:
  - $CP_1 = (x_1, y_1 - \Delta y/3) + N \cdot d_i$
  - $CP_2 = (x_2, y_2 + \Delta y/3) + N \cdot d_i$
- Evaluate point at $t = 0.5$ for mid-line M% pill
- Evaluate point at $t = 0.8$ for end-of-line Tick/Cross buttons

### 3. Local Anti-Overlap Engine (`src/engine/overlap.ts`)

- Bounding box collision detection using `(x, y, width, height)` with $24\text{px}$ margin
- Keep dragged placement fixed at its dropped coordinates $(x_d, y_d)$
- Detect overlapping neighbor boxes
- Iteratively shift colliding neighbors by minimum displacement along the axis of minimum penetration ($dx$ or $dy$)
- Converge within $\le 20$ iterations; uninvolved boxes remain completely stationary

### 4. Layout Engine (`src/engine/layout.ts`)

- Import `ELK from 'elkjs/lib/elk.bundled.js'`
- Construct ELK node hierarchy with measured dimensions (default 190x76)
- Apply Sugiyama layout with `elk.direction: "UP"`
- Handle isolated nodes (nodes with 0 edges) by isolating them and arranging them neatly on a baseline rack below the root NGO, preventing ELK crashes or $(0,0)$ collapses

## Validation Architecture

Author comprehensive unit tests in `test/phase2.test.ts`:
1. `metrics.ts`: Test against the Delhi seed dataset (funding = M40 / ₹400,000; direct ties: 1 confirmed, 1 declined; 1 triple-thread target; City Museum as top amplifier with reach = 5; concentration risk calculation).
2. `parallelEdges.ts`: Test that 2 parallel edges produce different Bezier control points and non-overlapping label/button coordinates.
3. `overlap.ts`: Test that dropping a box directly over another nudges the neighbor box out of collision while leaving the dragged box at the exact drop location.
4. `layout.ts`: Test that elkjs computes layered bottom-to-top positions with root NGO at the lowest level (highest $y$) and target at top (lowest $y$), and verify isolated node resilience.
