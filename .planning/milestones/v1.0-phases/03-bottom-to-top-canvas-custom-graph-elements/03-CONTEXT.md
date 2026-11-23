# Phase 3 Context: Bottom-to-Top Canvas & Custom Graph Elements

**Phase Goal:** Build the interactive React Flow v12 2D graph canvas, custom `OrgNode` cards with live multi-thread badges, custom `MultiplexEdge` with parallel Bezier routing and inline tick/cross action buttons, and persistent zero-snap-back dragging backed by Zustand.

## Requirements Covered

- **CANV-01**: Canvas (`PartnershipCanvas.tsx`) renders in a dark high-contrast studio theme (`#0b0f17`) with a subtle dot grid, inverted handles (source Top, target Bottom), and smooth pan/zoom controls.
- **CANV-02**: Custom node card (`OrgNode.tsx`) displays entity name, sector category pill, root NGO indicator, live multi-thread badge ("2-Thread", "Triple-Thread (3)", "Quad-Thread (N)"), and hover metrics tooltip.
- **CANV-03**: Custom edge component (`MultiplexEdge.tsx`) renders curved parallel Bezier paths with a strict color/dash/glow/gray matrix across 3 branch types (green/white/yellow) and 3 states (pending/tick/cross).
- **CANV-04**: Edge renders interactive mid-line M% pills (for green branches) or note tags, plus end-of-line Tick and Cross buttons via `EdgeLabelRenderer` with `stopPropagation` to prevent canvas drag.
- **CANV-05**: User can drag any card with persistent zero-snap-back positioning, triggering local anti-overlap nudging on drop and committing coordinates permanently to state and repository.

## Critical Invariants & Constraints

1. **Zero-Snap-Back Dragging**: Dragging a node updates coordinates live, and dropping commits them permanently to state and repository. NO continuous force physics or reactive auto-reversion.
2. **Event Isolation on Edge Buttons**: All interactive edge controls (M% pills, Tick, Cross) MUST use `EdgeLabelRenderer`, have `pointer-events-auto nodrag nopan`, and call `e.stopPropagation()` on both `onClick` and `onPointerDown`.
3. **Inverted Handle Orientation**: Source handles are Top center (`Position.Top`); target handles are Bottom center (`Position.Bottom`) so edges flow upward from base to target.
4. **Multiplex Separation**: Multiple branches between the same placement pair must curve cleanly apart using `computeParallelBezierCurve` without stacking lines or buttons.
