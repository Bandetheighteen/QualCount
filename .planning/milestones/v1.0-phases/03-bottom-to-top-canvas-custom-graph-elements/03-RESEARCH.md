# Phase 3 Research: Bottom-to-Top Canvas & Custom Graph Elements

## Executive Overview

Phase 3 transforms the pure domain engines from Phase 2 and the relational storage repository from Phase 1 into an interactive 2D canvas using `@xyflow/react` v12, Zustand v5, and Tailwind CSS. The canvas operates in a dark studio theme (`#0b0f17`) with an inverted bottom-to-top layout, custom `OrgNode` cards with live multi-thread badges, custom `MultiplexEdge` elements with parallel Bezier separation and inline tick/cross action buttons, and persistent zero-snap-back dragging with automatic local anti-overlap collision resolution on drop.

---

## Technical Stack & API Findings

### 1. `@xyflow/react` v12 Integration Patterns

- **Import Convention**: In `@xyflow/react` v12:
  ```typescript
  import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    Position,
    EdgeLabelRenderer,
    BaseEdge,
    useReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type NodeProps,
    type EdgeProps,
    type NodeChange,
    type EdgeChange,
  } from '@xyflow/react';
  import '@xyflow/react/dist/style.css';
  ```
- **Custom Node/Edge Registration**:
  `nodeTypes` and `edgeTypes` objects must be declared outside the React component or strictly memoized with `useMemo` to prevent React Flow from re-mounting nodes and edges on every render:
  ```typescript
  const nodeTypes = { orgNode: OrgNode };
  const edgeTypes = { multiplexEdge: MultiplexEdge };
  ```

### 2. Inverted Handles & Bottom-to-Top Flow

- **Flow Hierarchy**: Social sector partnership networks build upwards from the foundational NGO (`isRootNgo: true`) up through CSR funders and institutional bridges to high-level ministries and government bodies.
- **Handle Placement**:
  - Outgoing connections originate from the **Top** of the card: `<Handle type="source" position={Position.Top} className="..." />`
  - Incoming connections enter the **Bottom** of the card: `<Handle type="target" position={Position.Bottom} className="..." />`
  - Inverted handles ensure default edge tangents flow smoothly upward from source to target.

### 3. EdgeLabelRenderer & Event Shielding

- **DOM Portal Mechanics**: In `@xyflow/react`, `EdgeLabelRenderer` portals HTML controls into an overlay div positioned directly above the SVG viewport.
- **Click & Drag Isolation**: Because React Flow captures mouse events on the canvas, any interactive HTML element inside `EdgeLabelRenderer` (such as M% pills, Tick buttons, and Cross buttons) will trigger canvas selection or panning unless shielded:
  ```tsx
  <div
    style={{ transform: `translate(-50%, -50%) translate(${buttonX}px,${buttonY}px)` }}
    className="nodrag nopan pointer-events-auto flex items-center gap-1.5"
    onClick={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleSetStatus('tick');
      }}
      className="..."
    >
      <Check className="w-3 h-3" />
    </button>
  </div>
  ```
- **Requirements**:
  - Class names `nodrag nopan` prevent React Flow from treating the click as a canvas pan or drag.
  - `pointer-events-auto` ensures clicks reach the button through the transparent overlay.
  - Calling `e.stopPropagation()` on both `onClick` and `onPointerDown` isolates canvas interactions.

### 4. Parallel Multiplex Bezier Routing

- In Phase 2, `src/engine/parallelEdges.ts` implemented:
  - `groupParallelBranches(branches: Branch[])`: Grouping branches by canonical undirected pair key (`p1 < p2 ? p1---p2 : p2---p1`).
  - `computeParallelBezierCurve(source, target, index, total, spacing, isReverse)`: Evaluates symmetric lateral Bezier offsets and computes exact coordinates for:
    - Path string `M ... C ...`
    - Mid-line M% label `(labelX, labelY)` at $t = 0.5$
    - Action buttons `(buttonX, buttonY)` at $t = 0.8$
- When transforming `Branch` objects into React Flow `Edge` objects:
  - We pre-calculate each branch's group index and total count within its placement pair.
  - Pass `{ branch, index, total, isReverse }` in `edge.data`.
  - Inside `MultiplexEdge.tsx`, endpoints are retrieved from `sourceX, sourceY, targetX, targetY`.

### 5. Multi-Thread Badge Logic

- Driven strictly by **confirmed (ticked)** yellow incoming bridges (`yellowInDegree`):
  - `yellowInDegree === 2`: Amber pill `"2-Thread"` (`bg-amber-500/20 text-amber-300 border border-amber-500/40`)
  - `yellowInDegree === 3`: Glowing amber-yellow pill `"Triple-Thread (3)"` (`bg-amber-400/25 text-amber-200 border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse`)
  - `yellowInDegree >= 4`: Bright gold pill `"Quad-Thread ({count})"` (`bg-yellow-400/30 text-yellow-100 border border-yellow-300 shadow-[0_0_16px_rgba(234,179,8,0.7)]`)
  - `yellowInDegree < 2`: No badge displayed.
- Dynamic responsiveness: When any yellow branch into an entity changes status (e.g. from `tick` to `cross` or `pending`), `yellowInDegree` is recomputed live, immediately promoting or demoting the badge.

### 6. Zero-Snap-Back Dragging & Anti-Overlap on Drop

- **The Problem**: Continuous physics (like D3 force layouts) cause nodes to drift or snap back to algorithmic positions, destroying spatial agency.
- **The Solution**:
  - React Flow manages free drag movements during pointer dragging.
  - On `onNodeDragStop(event, node)`:
    1. The dragged node's coordinates are fixed at their exact drop coordinates `(node.position.x, node.position.y)`.
    2. We invoke `resolveLocalCollisions(placements, draggedPlacementId, 24)` from `src/engine/overlap.ts`.
    3. The dragged node is strictly anchored (0px drift). If it landed on top of neighbor nodes, only colliding neighbors are nudged apart along the axis of minimum penetration.
    4. The updated placements are committed to Zustand and saved asynchronously to `WorkspaceRepository`.
    5. The layout remains static with zero drift.

---

## Color & Styling Specifications

| Element | State | Styling & Color Code |
|---------|-------|----------------------|
| **Canvas Background** | Default | `#0b0f17` (Tailwind slate-950 / zinc-950 blend) with `#1e293b` dots |
| **Node Card Base** | Normal | `w-52 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-lg backdrop-blur-md` |
| **Node Card Selected** | Selected | `ring-2 ring-blue-500 border-blue-400 shadow-blue-500/20` |
| **Category: NGO** | Pill | `bg-sky-500/20 text-sky-300 border-sky-500/30` |
| **Category: CSR** | Pill | `bg-emerald-500/20 text-emerald-300 border-emerald-500/30` |
| **Category: Government**| Pill | `bg-amber-500/20 text-amber-300 border-amber-500/30` |
| **Category: Institution**| Pill | `bg-purple-500/20 text-purple-300 border-purple-500/30` |
| **Category: Community** | Pill | `bg-rose-500/20 text-rose-300 border-rose-500/30` |
| **Branch: Green (Funding)** | Pending | Emerald dashed line (`stroke: #10b981, strokeDasharray: 6 4`) |
| **Branch: Green (Funding)** | Tick | Glowing emerald solid line (`stroke: #34d399, filter: drop-shadow(0 0 6px #10b981)`) |
| **Branch: White (Working)** | Pending | Slate-300 dashed line (`stroke: #cbd5e1, strokeDasharray: 5 4`) |
| **Branch: White (Working)** | Tick | Bright white solid line (`stroke: #ffffff, filter: drop-shadow(0 0 6px rgba(255,255,255,0.7))`) |
| **Branch: Yellow (Bridge)** | Pending | Amber dashed line (`stroke: #f59e0b, strokeDasharray: 6 4`) |
| **Branch: Yellow (Bridge)** | Tick | Glowing amber solid line (`stroke: #fbbf24, filter: drop-shadow(0 0 8px #f59e0b)`) |
| **Any Branch** | Cross | Faded gray dashed line (`stroke: #64748b, opacity: 0.4, strokeDasharray: 4 4`) |
| **M% Pill** | Green Branch | `bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-mono text-xs px-2 py-0.5 rounded-full` |
| **Tick Button** | Default | `p-1 rounded-full bg-slate-800 text-slate-400 hover:bg-emerald-600 hover:text-white border border-slate-600` |
| **Tick Button** | Active (Ticked)| `p-1 rounded-full bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]` |
| **Cross Button** | Default | `p-1 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-slate-600` |
| **Cross Button** | Active (Cross) | `p-1 rounded-full bg-rose-600 text-white border border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]` |

---

## State Management Architecture (Zustand v5)

The store `useWorkspaceStore` provides a unified reactive boundary for:
1. `workspace`: normalized `WorkspaceState` loaded from `WorkspaceRepository`.
2. `metrics`: quantitative 7-metric calculations derived from `computeQuantitativeMetrics(placements, branches)`.
3. `showDeclined`: toggle to show or hide/dim branches with `status === 'cross'`.
4. `flowNodes` & `flowEdges`: reactive getters translating relational placements and branches into React Flow structures.
5. Mutations:
   - `onNodesChange`: React Flow node change updates.
   - `commitNodeDrag(placementId, x, y)`: invokes `resolveLocalCollisions`, commits updated coordinates to repository.
   - `setBranchStatus(branchId, status)`: updates status, recalculates metrics, commits to repository.
   - `tidyUpLayout()`: runs `computeHierarchicalLayout`, animates nodes to new positions, commits to repository.
