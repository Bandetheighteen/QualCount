# Phase 4 Context: UI Shell, Live Metrics Strip, Toolbar & End-to-End Acceptance

**Phase Goal:** Complete the QualCount user interface by assembling the Live Top Metrics Strip, the Action Toolbar with entity deduplication, the Context Inspector Drawer, and the unified desktop application shell (`App.tsx`), followed by exhaustive programmatic and structural verification against the 10-point acceptance checklist.

---

## Requirements Covered

- **UI-01**: Live Top Metrics Strip (`src/components/metrics/MetricsStrip.tsx`) permanently visible above the canvas, dynamically reflecting all 7 topology metrics on every graph mutation without subjective 1-to-5 ratings:
  1. Funding Secured (`M%` vs Target Budget INR, pending %, and absolute amounts).
  2. Direct White Relationships (confirmed, pending, declined, confirmation rate %).
  3. Confirmed Yellow Bridges (count of active network bridges).
  4. Owned Conversions (`converted / referred` count and conversion rate %).
  5. Multi-Thread Targets (2x / 3x / 4x+ badges, plus names with $\ge 3$ threads).
  6. Top Amplifier (partner name, direct yellow out-degree, unique confirmed downstream reach).
  7. Bridge Concentration Risk ($R_{\text{total}}$ vs $R_{\text{without } b}$, highlighted in red if $> 30\%$).

- **UI-02**: Compact Action Toolbar (`src/components/toolbar/ActionToolbar.tsx`):
  1. Add Node Controls: Organization name autocomplete against `state.entities` (ensuring shared entities are reused rather than duplicated), category selector (`csr`, `government`, `institution`, `community`, `other`), non-overlapping placement insertion, and auto-selection.
  2. Connect Branch Controls: Source and Target dropdowns, Line Type selector (Green funding, White relationship, Yellow bridge), Status selector (Pending, Tick, Cross), conditional `M%` or Note inputs, self-loop prevention, and multi-edge creation.
  3. Canvas Controls: `"Tidy Up (Bottom-to-Top)"` button triggering Sugiyama layout, `"Show Declined (Gray) Paths"` checkbox (default: checked).
  4. Storage Controls: `"Export JSON"`, `"Import JSON"`, and `"Reset Demo"` calling `WorkspaceRepository` exclusively.

- **UI-03**: Collapsible Context Inspector Drawer (`src/components/inspector/InspectorDrawer.tsx`):
  - Node Inspector: Edit entity name, category, global notes; view attached branches, yellow in-degree, downstream reach; remove placement (disabled for Root NGO).
  - Branch Inspector: View source/target names; edit status (Pending/Tick/Cross), type (Green/White/Yellow), `M%` value (for Green), and qualitative note; delete branch.
  - Symmetrical selection clearing and escape key binding.

- **ARCH-01**: Application Assembly & Offline Desktop Architecture (`src/App.tsx`):
  - Dark studio theme (`#0b0f17`) with zero URL history routing (preserving webview file protocol safety in Tauri v2).
  - Responsive flex layout with error boundary, loading states, and clean keyboard accessibility.
  - Complete verification against the 10-point Acceptance Checklist before concluding.

---

## Invariants & Critical Constraints

1. **Storage Isolation**: Zero `localStorage` or `FileReader` calls in any UI component; all persistence calls strictly go through `WorkspaceRepository`.
2. **Engine Purity**: Zero DOM/React imports in `src/engine/*`.
3. **Desktop Routing Safety**: No `react-router-dom` or HTML5 pushState routing; application state uses Zustand and React state exclusively.
4. **Zero-Snap-Back Persistence**: All layout changes, node drags, and connection edits persist immediately and recover with 100% roundtrip fidelity.
