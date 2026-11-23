# QualCount System Architecture

> Sources: QualCount Architecture Team, 2026-11-21; Concept Note, 2026-11-21
> Raw: [Concept Note](../../raw/qualcount/2026-11-21-concept-note-and-system-architecture.md); [Technical Specification](../../raw/qualcount/2026-11-21-technical-specification.md)
> Updated: 2026-11-21

## Overview

QualCount is an offline-first visual partnership management application designed for social sector and NGO teams. Rather than treating partner outreach as a flat volume funnel or relying on subjective 1-to-5 ratings, QualCount models relationships directly as a bottom-to-top directed multiplex network. Every institution sits as a persistent node, interactions flow across color-coded branches (financial funding, direct working relationships, and institutional bridges), and progress metrics are derived strictly from live graph topology.

## Hybrid Two-Layer Architecture

The system uses a deliberate hybrid architecture combining a Node.js / TypeScript frontend with a native desktop shell:

- **Layer 1 (Node.js Toolchain + TypeScript / React Canvas)**:
  Node.js serves as the development and Vite bundling toolchain for a TypeScript, React, React Flow, and elkjs frontend. This layer owns 2D visual rendering, parallel Bezier curve routing, inline action controls, bottom-to-top layered layout, local anti-overlap geometry, and quantitative graph calculations.
- **Layer 2 (Rust Desktop Shell + Local SQLite via Tauri v2)**:
  The compiled frontend bundle is wrapped within a Tauri v2 Rust desktop shell running on Windows WebView2. Rust owns native OS file dialogs, compact offline packaging, and atomic persistence to a single local SQLite database file.

## Architectural Boundaries and Isolation

To ensure stability across phases, QualCount enforces two architectural boundaries:

1. **Storage Boundary (`WorkspaceRepository`)**:
   All state persistence is isolated behind an asynchronous `WorkspaceRepository` interface (`loadWorkspace`, `saveWorkspace`, `exportWorkspaceFile`, and `importWorkspaceFile`). UI components and canvas views never interact directly with low-level storage engines.
2. **Engine Isolation (`src/engine/*`)**:
   Pure domain engines (metrics calculation, parallel Bezier curve offsets, local bounding-box anti-overlap, and hierarchical layout) are implemented in pure TypeScript with zero imports from DOM, React, or browser storage APIs.

## See Also

- [Multiplex Network and Metrics](multiplex-network-and-metrics.md)
- [Desktop Shell and Packaging](desktop-shell-and-packaging.md)
- [QualCount Project Archive](qualcount-project-archive.md)
