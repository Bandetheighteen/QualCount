# Architecture Research

**Domain:** Visual Multiplex Graph Navigation & Analytics System for Social Sector Partnerships
**Researched:** 2026-11-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 1: REACT FLOW & UI RUNTIME                       │
│  (Compiled via Node.js toolchain & Vite, runs in browser / desktop webview) │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │    Top Metrics Strip  │  │     Action Toolbar    │  │ Inspector Drawer│  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └────────┬────────┘  │
│              │                          │                       │           │
│  ┌───────────┴──────────────────────────┴───────────────────────┴────────┐  │
│  │                    React Flow Canvas (@xyflow/react)                  │  │
│  │    ┌────────────────────────┐      ┌───────────────────────────────┐  │  │
│  │    │  Custom OrgNode Cards  │      │  Custom Multiplex Curved Edge │  │  │
│  │    │  (Badges, Hover Stats) │      │  (M% Pills, Tick/Cross Portal)│  │  │
│  │    └────────────────────────┘      └───────────────────────────────┘  │  │
│  └──────────────────────────────────────┬────────────────────────────────┘  │
│                                         │                                   │
├─────────────────────────────────────────┴───────────────────────────────────┤
│                   IN-MEMORY APPLICATION STATE (Zustand Store)                │
│                         useWorkspaceStore.ts                                │
│       - activeWorkbookId, entities, workbooks, placements, branches         │
├─────────────────────────────────────────────────────────────────────────────┤
│                   PURE DOMAIN ENGINES (Zero DOM/React/Storage)              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │   metrics.ts │   │   layout.ts  │   │  overlap.ts  │   │parallelEdges │  │
│  │  (7 Metrics) │   │ (elkjs UP)   │   │  (Anti-Box)  │   │(Bezier Math) │  │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                   ASYNC STORAGE BOUNDARY: WorkspaceRepository                │
│  ┌──────────────────────────────────────┐  ┌─────────────────────────────┐  │
│  │   LocalStorageRepository (Phase 1)   │  │ TauriSqliteRepository (Ph 2)│  │
│  │   - Browser storage + JSON export    │  │ - Rust IPC invoke() contract│  │
│  └──────────────────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ (Phase 2 IPC seam)
┌─────────────────────────────────┴───────────────────────────────────────────┐
│              LAYER 2: TAURI v2 RUST DESKTOP CORE (Phase 2 Target)            │
│  ┌──────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │    Native Windows Webview│  │      Rust Core (src-tauri/src/main.rs)  │  │
│  │    (WebView2 runner)     │  │      - SQLite local database storage    │  │
│  └──────────────────────────┘  │      - Native OS file dialogs           │  │
│                                └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation Details |
|-----------|----------------|------------------------|
| `src/types/schema.ts` | Single source of truth for normalized 5-table data model | Strict TypeScript interfaces matching Phase 2 SQLite tables 1-to-1 |
| `src/storage/workspaceRepository.ts` | Contract for all persistent data operations | Async interface: `loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, `importWorkspaceFile` |
| `src/storage/localStorageRepository.ts` | Phase 1 web persistence and JSON file upload/download | Validates schema version, handles browser LocalStorage and Blob download |
| `src/storage/tauriSqliteRepository.ts` | Phase 2 desktop persistence stub | Defines typed Rust IPC commands: `load_workspace`, `save_workspace`, etc. |
| `src/storage/index.ts` | Runtime-aware repository provider factory | Detects `'__TAURI_INTERNALS__' in window` or falls back to LocalStorage |
| `src/engine/metrics.ts` | Pure 7-metric calculation engine | Computes funding, direct ties, bridges, owned conversions, multi-thread targets, amplifier BFS reach, concentration risk |
| `src/engine/layout.ts` | Bottom-to-top hierarchical auto-layout | Runs `elkjs` (`elk.direction: "UP"`, `elk.algorithm: "layered"`), read-only topology preservation |
| `src/engine/overlap.ts` | Local rectangular collision resolution | Nudges colliding cards by minimum clearance (24px margin), anchors dragged card |
| `src/engine/parallelEdges.ts` | Multiplex curve separation | Calculates lateral quadratic/cubic Bezier control point offsets for concurrent edges |
| `src/store/useWorkspaceStore.ts` | Zustand central state container | Holds active state, triggers repository saves, exposes reactive actions |
| `src/components/canvas/OrgNode.tsx` | Visual organization card | Handles, category colors, multi-thread badge (2/3/4+), hover metrics tooltip |
| `src/components/canvas/MultiplexEdge.tsx` | Visual multiplex connection | Custom SVG path, color/dash styling, mid-line M% pill, end-of-line tick/cross buttons via `EdgeLabelRenderer` |
| `src/components/metrics/MetricsStrip.tsx` | Top quantitative dashboard strip | Live rendering of all 7 metrics above canvas |
| `src/components/toolbar/ActionToolbar.tsx` | Command toolbar | Add Node with autocomplete deduplication, Connect Branch, Tidy Up, Gray toggle, JSON actions |
| `src/components/inspector/InspectorDrawer.tsx` | Selection context editor | Inspect/edit/delete selected node or branch |

## Recommended Project Structure

```
c:/Users/shoun/Desktop/Dokumen/QualCount/
├── package.json
├── tsconfig.json
├── vite.config.ts                     # base: './' configured for Tauri webview
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── types/
│   │   └── schema.ts                  # Normalized 5-table schema & WorkspaceState
│   ├── storage/
│   │   ├── workspaceRepository.ts     # Async interface & schema validators
│   │   ├── localStorageRepository.ts  # Browser LocalStorage & JSON file I/O
│   │   ├── tauriSqliteRepository.ts   # Phase 2 Tauri v2 Rust IPC stub
│   │   └── index.ts                   # Environment repository selector
│   ├── data/
│   │   └── seedDelhiNgo.ts            # Preloaded 11-node, 15-branch Delhi scenario
│   ├── engine/
│   │   ├── layout.ts                  # Pure elkjs bottom-to-top layout
│   │   ├── overlap.ts                 # Pure local rectangular anti-overlap
│   │   ├── metrics.ts                 # Pure 7-metric topology calculation engine
│   │   └── parallelEdges.ts           # Pure lateral Bezier offset math
│   ├── store/
│   │   └── useWorkspaceStore.ts       # Zustand store with async repository hookup
│   ├── components/
│   │   ├── metrics/
│   │   │   └── MetricsStrip.tsx       # Live quantitative metrics top strip
│   │   ├── toolbar/
│   │   │   └── ActionToolbar.tsx      # Add Node, Connect, Tidy Up, Gray toggle, JSON
│   │   ├── canvas/
│   │   │   ├── PartnershipCanvas.tsx  # React Flow canvas wrapper & handlers
│   │   │   ├── OrgNode.tsx            # Node card + multi-thread badge + tooltip
│   │   │   └── MultiplexEdge.tsx      # Curved edge + M% pill + tick/cross buttons
│   │   └── inspector/
│   │       └── InspectorDrawer.tsx    # Context inspector for node/edge editing
│   ├── App.tsx                        # View state container (no React Router)
│   ├── index.css                      # Tailwind base & custom glow utilities
│   └── main.tsx                       # React application mount
```

## Architectural Patterns

### Pattern 1: Strict Repository Boundary (Storage Decoupling)

**What:** All loading, saving, importing, and exporting flow through an async `WorkspaceRepository` interface. React components, toolbar actions, and Zustand mutations NEVER call `localStorage` or `FileReader` directly.
**When to use:** Crucial for enabling Phase 2 transition to Tauri v2 + SQLite without rewriting UI components.

```typescript
export interface WorkspaceRepository {
  loadWorkspace(): Promise<WorkspaceState | null>;
  saveWorkspace(state: WorkspaceState): Promise<void>;
  exportWorkspaceFile(state: WorkspaceState): Promise<void>;
  importWorkspaceFile(): Promise<WorkspaceState | null>;
}
```

### Pattern 2: Pure Domain Engine Isolation

**What:** Layout, collision removal, parallel edge calculations, and metrics logic live strictly in `src/engine/*` as pure TypeScript functions with zero imports from `react`, `window`, `document`, or `localStorage`.
**When to use:** Ensures all business math and geometry algorithms are easily testable, free of side effects, and portable.

### Pattern 3: Discrete Layout vs. Persistent Dragging

**What:** Node dragging updates coordinates directly in placement state with zero snap-back. On drag release, a localized bounding-box anti-overlap pass nudges only colliding neighbor boxes. Layout reorganization ("Tidy Up") is an explicit, one-shot user action using `elkjs` that animates cards smoothly and leaves them permanently placed.
**When to use:** Protects coordinator spatial agency and cognitive maps while preventing visual overlapping.

## Build and Dependency Order

```
Phase 1 Foundation:
  1. Project scaffold & configs (vite.config.ts with base: './', tsconfig, tailwind)
  2. Normalized schema (src/types/schema.ts)
  3. Storage boundary (workspaceRepository.ts, localStorageRepository.ts, tauriSqliteRepository.ts)
  4. Delhi seed dataset (src/data/seedDelhiNgo.ts)

Phase 2 Pure Engines:
  5. Metrics engine (src/engine/metrics.ts)
  6. Parallel edges math (src/engine/parallelEdges.ts)
  7. Local anti-overlap engine (src/engine/overlap.ts)
  8. Layout engine (src/engine/layout.ts via elkjs)

Phase 3 State & Canvas Elements:
  9. Zustand store (src/store/useWorkspaceStore.ts)
  10. Custom OrgNode (src/components/canvas/OrgNode.tsx)
  11. Custom MultiplexEdge (src/components/canvas/MultiplexEdge.tsx)
  12. PartnershipCanvas wrapper (src/components/canvas/PartnershipCanvas.tsx)

Phase 4 UI Controls & Integration:
  13. Live Top Metrics Strip (src/components/metrics/MetricsStrip.tsx)
  14. Action Toolbar with Add Node deduplication (src/components/toolbar/ActionToolbar.tsx)
  15. Inspector Drawer (src/components/inspector/InspectorDrawer.tsx)
  16. App assembly & end-to-end verification (App.tsx, JSON roundtrip, acceptance checklist)
```

## Sources

- Concept note: `concept_note_and_system_architecture.txt`
- Build prompt and technical specification: `antigravity_build_prompt_and_technical_specification.txt`
- Relational database normalization: Codd (1970)
- Layered graph drawing: Sugiyama et al. (1981), Gansner et al. (1993)
- Fast overlap removal: Dwyer, Marriott, & Stuckey (2006)

---
*Architecture research for: QualCount (Visual Multiplex Partnership Management System)*
*Researched: 2026-11-20*
