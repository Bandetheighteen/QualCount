# Feature Research

**Domain:** Visual Multiplex Graph Navigation & Analytics System for Social Sector Partnerships
**Researched:** 2026-11-20
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features required for a usable visual partnership mapping and tracking tool. Missing any makes the tool feel broken or unusable in real NGO operations.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bottom-to-Top Hierarchical Canvas | Mirrors natural relationship building from foundational NGO (base) upward into public sector targets | MEDIUM | React Flow canvas inverted handle setup: source at Top, target at Bottom |
| Custom Organization Node Cards | Coordinators need to see institution name, sector category, and status at a glance | LOW | Rounded dark cards with border accents, category pill, and root NGO indicator |
| Directed Multiplex Branches | Two organizations often have concurrent ties (e.g. CSR grant + ministerial bridge) | HIGH | Support multiple parallel edges with distinct types (green/white/yellow) between same two nodes |
| Parallel Curved Edge Offsets | Parallel edges must not render directly over each other | HIGH | Pure geometric quadratic/cubic Bezier offset calculations based on edge index and total count |
| 3-State Verification (Tick / Cross) | Outreach starts as planned/wishlist and must be verifiable before counting as secured | MEDIUM | Pending (dashed), Confirmed/Tick (solid neon glow), Declined/Cross (faded gray) |
| Mid-Line M% and Note Pills | Immediate visibility of funding percentage or relational context along the branch | MEDIUM | Mounted via `EdgeLabelRenderer` at path midpoint (`t = 0.5`) |
| Interactive End-of-Line Buttons | Coordinators need 1-click status toggling directly on the visual path | HIGH | Mounted via `EdgeLabelRenderer` near target end (`t = 0.8`), with `stopPropagation` to prevent canvas drag |
| Show Declined (Gray) Paths Toggle | Teams must review rejections without cluttering active planning view | LOW | Checkbox in toolbar (default ON) dynamically filtering gray branches |
| Persistent Zero-Snap-Back Dragging | Manual spatial arrangement is critical for coordinator mental models | MEDIUM | Dragging updates coordinates directly; drop commits to state with zero auto-reversion |
| Local Bounding-Box Anti-Overlap | Dropping cards on top of each other creates unreadable chaos | MEDIUM | Fast rectangular collision detection; nudges only colliding neighbors by minimum clearance with 24px margin |
| Bottom-to-Top Tidy Up | Rapid automatic realignment when graphs grow complex | HIGH | One-shot `elkjs` layered pass with read-only topology preservation and smooth transition animation |
| Live 7-Metric Topology Strip | Instant feedback on funding, relationship count, bridges, and risks without manual calculation | HIGH | Pure quantitative computation re-evaluated on state changes; zero manual double-entry |
| Action Toolbar & Deduplication | Fast addition of nodes and branches without creating duplicate organizations | MEDIUM | Autocomplete against existing `entities` table to prevent duplicates; connect dialog with validation |
| Context Inspector Drawer | In-depth viewing and editing of node notes, branch values, and deletion | MEDIUM | Collapsible side panel synced with selected canvas elements |
| JSON Workspace Export / Import | Backup, sharing, and migration between workstations | LOW | Handled strictly through `WorkspaceRepository` with schema validation |

### Differentiators (Competitive Advantage)

Features that fundamentally elevate QualCount beyond existing spreadsheets and generic CRM dashboards.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Objective Topology-Derived Metrics | Eliminates fake precision from subjective 1-5 rating scales; metrics reflect verifiable partner actions | MEDIUM | Pure topological math (Centola & Macy, Wasserman & Faust, Freeman) |
| Multi-Thread Reinforcement Badges | Visualizes complex contagion: targets receiving 2, 3, or 4+ confirmed referrals display live status badges | MEDIUM | Live computed confirmed yellow in-degree displayed as "2-Thread", "Triple-Thread (3)", "Quad-Thread (N)" |
| Owned Conversions Metric | Measures whether borrowed bridge access was successfully converted into direct NGO relationships | MEDIUM | Non-root nodes holding both incoming ticked yellow and incoming ticked white from root NGO |
| Top Amplifier BFS & Concentration Risk | Identifies single points of failure in referral networks (Freeman betweenness/reach) | HIGH | BFS reach per partner + percentage of downstream nodes lost if single top amplifier is removed |
| Cross-Workbook Institutional Memory (Phase 2) | Prevents institutional amnesia across consecutive projects | HIGH | Shared master entity directory with "N Workbooks" history drawer and "Pull Proven Bridges" lead reuse |
| Overview Multi-Workbook Map (Phase 2) | Portfolio-level view of multiple projects linked by shared organizations | HIGH | Macro-graph view of workbooks connected by common institutional touchpoints |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing in product demos but actively harm field operations or violate scientific foundations.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Subjective 1-to-5 "Relationship Strength" Scoring | Teams want a single composite score for partners | Ordinal scales cannot be mathematically averaged (Stevens, 1946); causes Campbell's Law gaming where staff optimize for scores rather than outcomes | Track concrete, observable behavioral commitments (Outcome Mapping, Earl et al. 2001) |
| Continuous Force-Directed Physics | Looks dynamic and fluid in tech demos | Nodes constantly drift, wobble, and snap back, destroying coordinator mental maps and layout intent | One-shot on-demand "Tidy Up" button + local bounding-box anti-overlap on release |
| Direct `localStorage` calls in React Components | Quick to implement in v1 | Violates separation of concerns, complicates testing, and forces complete rewrite when wrapping in Tauri SQLite | Single async `WorkspaceRepository` interface with swappable adapters |
| URL-Based React Routing (`react-router-dom`) | Standard web development practice | Breaks in desktop webviews with local asset protocols (`tauri://` or `file://`) upon page refresh | Pure component/Zustand view state (`activeView: 'canvas' | 'opening'`) |
| Real-Time Collaborative Web Cloud Backend (v1) | Stakeholders ask for "Google Docs style" collaboration | Introduces authentication servers, CRDT synchronization overhead, and internet dependency for field staff in low-connectivity areas | Offline-first local JSON import/export and single-file portable SQLite database |

## Feature Dependencies

```
[Normalized Schema (schema.ts)]
    └──requires──> [WorkspaceRepository Interface]
                       └──requires──> [Zustand Store (useWorkspaceStore)]
                                          ├──requires──> [Pure Engine Modules (metrics, layout, overlap, parallel)]
                                          └──requires──> [React Flow Canvas & Custom Elements]
                                                             ├──requires──> [OrgNode (handles, badges, hover)]
                                                             └──requires──> [MultiplexEdge (curved Bezier, pills, tick/cross)]
```

## MVP Definition

### Launch With (v1 - Phase 1 Web Prototype)
- [x] Normalized 5-table relational schema
- [x] Strict async WorkspaceRepository boundary (LocalStorageRepository adapter)
- [x] Pure engine modules (metrics, layout, overlap, parallel Bezier math)
- [x] Dark studio bottom-to-top canvas with custom OrgNode and MultiplexEdge
- [x] Inline M% funding pills and interactive Tick/Cross buttons
- [x] Persistent zero-snap-back dragging and local anti-overlap nudging
- [x] One-click bottom-to-top Tidy Up via elkjs
- [x] Live 7-metric top strip with amplifier reach and concentration risk
- [x] Action toolbar with Add Node deduplication autocomplete, Connect Branch, Gray toggle, JSON I/O
- [x] Context inspector drawer for nodes and branches
- [x] Delhi Youth Governance Exhibition seed dataset (11 nodes, 15 branches)
- [x] Webview-safe navigation and relative Vite bundle config

### Add in Phase 2 (Desktop Tauri v2 Suite)
- [ ] Tauri v2 Rust desktop application shell
- [ ] `TauriSqliteRepository` backing state with atomic SQLite reads/writes
- [ ] Multi-workbook Opening Page (Grid cards + Overview Macro-Map)
- [ ] Cross-workbook institutional memory drawer and "Pull Proven Bridges" feature

## Sources

- Concept note: `concept_note_and_system_architecture.txt`
- Build prompt and technical specification: `antigravity_build_prompt_and_technical_specification.txt`
- Outcome Mapping: Building Learning and Reflection into Development Programs (Earl, Carden, & Smutylo, 2001)
- The Tyranny of Metrics (Muller, 2018)

---
*Feature research for: QualCount (Visual Multiplex Partnership Management System)*
*Researched: 2026-11-20*
