# Pitfalls Research

**Domain:** Visual Multiplex Graph Navigation & Analytics System for Social Sector Partnerships
**Researched:** 2026-11-20
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Canvas Drag Event Stealing on Edge Buttons

**What goes wrong:**
Clicking the inline Tick or Cross button on a curved branch initiates a canvas drag/pan gesture or deselects the branch instead of toggling its status.

**Why it happens:**
React Flow captures pointer events on the canvas overlay SVG layer. Without explicit pointer event isolation and event propagation stopping, `pointerdown` and `click` bubble up to the canvas viewport pan handler.

**How to avoid:**
1. Render button containers inside React Flow's `EdgeLabelRenderer`.
2. Apply CSS classes `nodrag nopan pointer-events-auto` to the button wrapper element.
3. Call `e.stopPropagation()` on both `onClick` and `onPointerDown` handlers.
4. Position buttons slightly offset from the target arrowhead (`t = 0.8`) so they never overlap the target node's border.

**Warning signs:**
Users have to click multiple times to toggle a tick, or clicking a tick causes the canvas to jump slightly.

**Phase to address:** Phase 3 (Canvas & Multiplex Edge implementation).

---

### Pitfall 2: Overlapping Parallel Multiplex Branches

**What goes wrong:**
When two organizations share multiple relationships (e.g. Your NGO -> Agrocell CSR holding both green funding and yellow bridge), default SVG edges render on top of each other, completely obscuring one branch, overlapping their M% pills, and making tick/cross buttons unclickable.

**Why it happens:**
Standard graph drawing libraries assume a simple graph with at most one directed edge per node pair.

**How to avoid:**
1. Implement a pure geometric module (`src/engine/parallelEdges.ts`) that groups all visible branches by normalized placement pair: `[min(src, tgt), max(src, tgt)]`.
2. For pairs with $N > 1$ branches, compute a symmetric lateral displacement offset $d_i$ for each branch $i$ (e.g. $-36px, 0px, +36px$).
3. Shift the quadratic or cubic Bezier control points along the normal vector perpendicular to the source-target axis.
4. Offset the mid-line pill and end-of-line button coordinates along the exact same evaluated Bezier curve point.

**Warning signs:**
Only one line is visible between Your NGO and City Museum or Agrocell CSR; seed data shows 13 visual lines instead of 15.

**Phase to address:** Phase 2 (Engine - Parallel Edges).

---

### Pitfall 3: Continuous Layout Drift & Drag Snap-Back

**What goes wrong:**
A coordinator drags "Ministry of Agriculture" to a specific place on the canvas, but upon release, the card snaps back to its old position, or a continuous physics simulation causes surrounding nodes to drift unpredictably.

**Why it happens:**
D3 force-directed or reactive layout hooks that run on every state change re-compute positions and overwrite user coordinates.

**How to avoid:**
1. Zero continuous background physics simulation.
2. Store coordinates directly in `state.placements[id].x` and `y`.
3. In `onNodeDragStop`, commit final dropped coordinates to state and `WorkspaceRepository`.
4. Run anti-overlap as an isolated, deterministic bounding-box check that nudges only colliding neighbor rectangles by minimal clearance, keeping the dragged card anchored.
5. "Tidy Up" must be a discrete, user-initiated button press using `elkjs`, animating cards smoothly over ~400ms and leaving them permanently placed.

**Warning signs:**
Cards snap back when dropped; moving one card causes the whole network to jitter.

**Phase to address:** Phase 2 (Engine - Overlap) & Phase 3 (Canvas dragging).

---

### Pitfall 4: ELK Layered Layout Failure on Disconnected Nodes

**What goes wrong:**
Calling `elkjs` layout when an organization has no branches (e.g. a newly added partner before connections are drawn) throws an unhandled exception or stacks disconnected nodes at `(0, 0)`.

**Why it happens:**
ELK's layered algorithm expects a connected directed acyclic graph (DAG) structure and requires explicit bounding-box dimensions (`width` and `height`) on all node descriptors.

**How to avoid:**
1. Always pass measured `width` (e.g. 190px) and `height` (e.g. 76px) in ELK node objects.
2. Configure ELK with:
   - `"elk.algorithm": "layered"`
   - `"elk.direction": "UP"`
   - `"elk.spacing.nodeNode": "72"`
   - `"elk.layered.spacing.nodeNodeBetweenLayers": "125"`
3. Partition connected vs. isolated nodes: layout connected components with ELK, and place isolated nodes in a neat baseline staging rack below Tier 0.

**Warning signs:**
Clicking "Tidy Up" crashes when an isolated node exists; console error `Cannot read property of undefined` in elkjs.

**Phase to address:** Phase 2 (Engine - Layout).

---

### Pitfall 5: Leaking Browser Storage Details into UI Components

**What goes wrong:**
Developers scatter `localStorage.getItem`, `localStorage.setItem`, or HTML `<input type="file">` handlers across React components and toolbar buttons. When migrating to Phase 2 (Tauri desktop with SQLite), all these components break and require refactoring.

**Why it happens:**
Convenience shortcuts during web prototype development.

**How to avoid:**
1. Define the async `WorkspaceRepository` interface in `src/storage/workspaceRepository.ts` before writing UI components.
2. Implement `LocalStorageRepository` solely within `src/storage/`.
3. Create `TauriSqliteRepository` stub with planned Tauri IPC commands.
4. Components and Zustand actions must only talk to the repository interface.

**Warning signs:**
`localStorage` or `FileReader` appears in any `src/components/*` or `src/store/*` file.

**Phase to address:** Phase 1 (Foundation & Storage).

---

### Pitfall 6: Subjective Rating Metric Distortion (Campbell's Law)

**What goes wrong:**
Product requirements creep in asking for a "1-to-5 trust score" or "partnership strength composite index". Teams spend time debating whether an official is a 3 or a 4, generating artificial precision.

**Why it happens:**
Traditional CRM habits where every relationship is given a subjective score.

**How to avoid:**
1. Strictly enforce the 7 topology-derived metrics (Centola & Macy, Freeman, Wasserman & Faust).
2. Quantify outcomes solely based on observable, verifiable behavioral commitments: tick = confirmed action, cross = declined action.
3. Pair amplifier reach with Bridge Concentration Risk to prevent single-point-of-failure blindness.

**Warning signs:**
Any UI field or schema property asking for a numeric "rating" or "score".

**Phase to address:** Phase 1 (Schema) & Phase 2 (Engine - Metrics).

---

## "Looks Done But Isn't" Checklist

- [ ] **Multiplex Edges:** Appears to work with single edges, but parallel edges between same pair collapse into a single line. Verify with Delhi seed dataset (Your NGO -> City Museum has both White & Yellow).
- [ ] **Tick/Cross Buttons:** Looks clickable, but clicking triggers canvas panning. Verify clicking tick does NOT drag canvas.
- [ ] **Tidy Up Animation:** Realigns nodes, but subsequent dragging snaps back to Tidy Up positions. Verify manual drag works with zero snap-back after Tidy Up.
- [ ] **Declined Gray Paths:** Gray paths render, but unchecking "Show Declined" fails to remove them from layout or canvas. Verify toggle cleanly hides/shows gray edges.
- [ ] **JSON Export/Import:** Downloads file, but re-importing alters node coordinates or loses branch notes. Verify exact roundtrip fidelity.

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Storage boundary leak | Phase 1 (Foundation) | Grep check: zero `localStorage` outside `src/storage/` |
| Overlapping parallel edges | Phase 2 (Engines) | Visual verification of Delhi seed 15 branches (all distinct) |
| Layout collapse on isolated nodes | Phase 2 (Engines) | Add isolated node -> click Tidy Up -> verify no crash |
| Canvas drag event stealing | Phase 3 (Canvas) | Click Tick/Cross on edge -> verify state toggles without canvas movement |
| Coordinate snap-back | Phase 3 (Canvas) | Drag node -> release -> click elsewhere -> verify card remains at dropped position |
| Metrics divergence | Phase 4 (Integration) | Verify Delhi seed metrics match expected values (Funding: M40 / ₹400,000; Triple-Thread: 1) |

---
*Pitfalls research for: QualCount (Visual Multiplex Partnership Management System)*
*Researched: 2026-11-20*
