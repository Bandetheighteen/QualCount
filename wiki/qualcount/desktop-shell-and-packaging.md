# Desktop Application Shell and Tauri SQLite Packaging

> Sources: Technical Specification, 2026-11-21; QualCount Project Roadmap, 2026-11-21
> Raw: [Technical Specification](../../raw/qualcount/2026-11-21-technical-specification.md); [Project Roadmap](../../raw/qualcount/2026-11-21-project-requirements-and-roadmap.md)
> Updated: 2026-11-21

## Overview

QualCount is designed as an offline-first desktop environment for social sector coordination. While the user interface is developed with Vite, React, and Tailwind CSS, the desktop distribution is packaged using Tauri v2 and backed by a local SQLite relational storage layer.

## Desktop Shell Architecture

The desktop implementation leverages Tauri v2 to achieve high performance with a minimal disk and memory footprint:

- **OS-Native WebView Engine**: Uses the Windows Edge WebView2 runtime rather than bundling Chromium and Node.js runtimes.
- **Single-File Distribution**: Configured with the NSIS bundler to generate a self-contained setup executable requiring no separate external DLLs or administrator privileges.
- **Zero URL Routing**: Navigation avoids URL pushState routing, ensuring smooth execution across desktop webview environments.

## Relational Storage Mapping

The application state is fully normalized across five relational collections:

1. `entities`: Master profiles of institutions, organizations, and points of contact.
2. `workbooks`: Initiative containers holding budgets and targets.
3. `placements`: Spatial coordinates and node tiers within specific workbooks.
4. `branches`: Directed relationships (financial funding, direct working relationships, institutional bridges).
5. `workbook_links`: Cross-workbook connections enabling institutional memory across programs.

This schema maps 1-to-1 with local SQLite tables, ensuring atomic persistence and exportable JSON workspace backups.

## See Also

- [System Architecture](system-architecture.md)
- [Multiplex Network and Metrics](multiplex-network-and-metrics.md)
- [QualCount Project Archive](qualcount-project-archive.md)
