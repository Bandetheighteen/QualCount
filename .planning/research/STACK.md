# Stack Research

**Domain:** Visual Multiplex Graph Navigation & Analytics System for Social Sector Partnerships
**Researched:** 2026-11-20
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.6.0 | Strict type safety across schema, engines, and UI | Guarantees zero `any`, prevents runtime property errors on complex graph structures, and aligns with Phase 2 Rust Serde types |
| Vite | ^6.0.0 | Frontend build tool and dev server | Sub-second HMR, optimal bundle splitting, and simple `base: './'` relative pathing required by Tauri's webview |
| React | ^18.3.0 / ^19.0.0 | Declarative UI framework | Robust ecosystem for 2D diagramming, mature state hooks, and native compatibility with React Flow |
| @xyflow/react | ^12.3.0 | Interactive 2D graph canvas | Modern successor to reactflow v11; native `EdgeLabelRenderer` for HTML-over-SVG interactive controls, custom node/edge registration, and smooth viewport management |
| elkjs | ^0.9.3 | Eclipse Layout Kernel JavaScript port | Battle-tested Sugiyama layered graph drawing with native bottom-to-top (`elk.direction: "UP"`) hierarchical layout and crossing minimization |
| Zustand | ^5.0.0 | Lightweight reactive state management | Minimal boilerplate, unopinionated store structure, fast selector-based re-renders, and trivial integration with external async repository patterns |
| Tailwind CSS | ^3.4.0 | Utility-first CSS framework | Dark high-contrast palette (`#0b0f17`), responsive utility classes, and tight styling control for canvas HUD elements |
| Lucide React | ^0.460.0 | Clean iconography | Standard modern icons for tick (`Check`), cross (`X`), tidy up, zoom, and entity categories |
| Tauri v2 (Phase 2 Target) | ^2.0.0 | Native desktop application shell | Lightweight Rust wrapper using OS-native webviews (WebView2 on Windows) without bundling Chromium or Node.js runtime (<15MB footprint) |
| SQLite (Phase 2 Target) | 3.x via `rusqlite` / `sqlx` | Local single-file workspace database | Atomic, crash-safe, zero-config relational storage mapping 1-to-1 with normalized schema |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx / tailwind-merge | ^2.5.0 | Dynamic className composition | Merging conditional Tailwind styles for node borders, pills, and edge button states |
| canvas-confetti | ^1.9.0 | Visual celebration feedback | Optional polish when reaching milestone targets (e.g. 100% funding) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Dev server & production bundler | Set `base: './'` in `vite.config.ts` to ensure assets load from file:// protocols in WebView2 |
| PostCSS / Autoprefixer | CSS preprocessing | Standard Tailwind toolchain |
| Rust toolchain (cargo/rustc) | Native desktop build (Phase 2) | rustc 1.100.0 / cargo installed on system |

## Installation

```bash
# Core dependencies
npm install @xyflow/react elkjs zustand lucide-react clsx tailwind-merge

# Dev dependencies
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/elkjs tailwindcss postcss autoprefixer
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React Flow (@xyflow/react) | Cytoscape.js | Network biology or massive networks (10,000+ nodes) where WebGL rendering is essential; unsuitable here because custom HTML buttons on curved Bezier edges require DOM portal overlays |
| React Flow (@xyflow/react) | D3.js force-directed | Exploratory physics layouts; unsuitable because continuous physics destroys spatial agency and user placement |
| elkjs | Dagre / @dagrejs/dagre | Legacy hierarchical layout; Dagre is unmaintained, lacks robust bottom-to-top port constraints, and causes overlapping parallel edges |
| Tauri v2 | Electron | Legacy desktop packaging; bundles 150MB+ Chromium and Node.js runtimes, causing high RAM usage and sluggish cold starts |
| Zustand | Redux Toolkit | Large multi-team web apps with complex middleware; overkill and excessive boilerplate for local graph state |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React Router / URL history routing | Webview file protocol (`tauri://` or `http://localhost`) breaks with standard pushState paths on desktop reload | React/Zustand view state (`activeView: 'canvas' | 'opening'`) |
| Continuous D3 force layout | Nodes continually drift and snap back, destroying manual coordinator positioning and mental maps | Pure discrete "Tidy Up" pass via `elkjs` plus local bounding-box anti-overlap |
| Direct `localStorage` in UI components | Leaks storage details into presentation layer and blocks clean Phase 2 SQLite migration | Strict async `WorkspaceRepository` boundary |
| HTML5 drag-and-drop API | Incompatible with SVG canvas coordinate transforms | React Flow built-in pointer drag events (`onNodeDragStop`) |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @xyflow/react@12.x | React 18 & 19 | Compatible with modern React JSX runtime |
| elkjs@0.9.x | Vite 6.x | Requires web-worker or standard direct execution (`import ELK from 'elkjs/lib/elk.bundled.js'`) |
| Tauri v2 | Vite 6 | Fully supported with `base: './'` and standard dist build output |

## Sources

- React Flow official documentation (EdgeLabelRenderer, v12 migration guide)
- Eclipse Layout Kernel (ELK) documentation & elkjs repository
- Tauri v2 architecture specifications
- Concept note and technical specification: `concept_note_and_system_architecture.txt`

---
*Stack research for: QualCount (Visual Multiplex Partnership Management System)*
*Researched: 2026-11-20*
