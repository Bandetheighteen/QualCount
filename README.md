<div align="center">
  <img src="assets/logo.png" alt="QualCount Logo" width="180"/>
  
  # QualCount
  
  **Visual Multiplex Partnership Navigation & Analytical Accounting System**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
  [![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-blue.svg)](#downloads--releases)
  [![Release: v2.0.0](https://img.shields.io/badge/Release-v2.0.0-green.svg)](https://github.com/Bandetheighteen/QualCount/releases)
  [![Stack: TypeScript + React](https://img.shields.io/badge/Stack-TypeScript%20%7C%20React%20%7C%20@xyflow-blue.svg)](https://github.com/xyflow/xyflow)
  [![Engine: Pure TypeScript Math](https://img.shields.io/badge/Engine-Zero%20Dependency%20Graph%20Metrics-orange.svg)](#architecture--engineering)
  [![Offline: 100%](https://img.shields.io/badge/Offline-100%25-green.svg)](#)
</div>

Social sector leadership and NGO outreach teams often struggle to manage multi-tiered institutional coalitions. Traditional CRMs force non-profits into commercial sales funnels, while spreadsheet trackers fail to capture non-financial institutional bridges, multi-threaded connections, and concentration bottlenecks.

**QualCount** is an offline-first visual partnership management application that models institutional relationships as a bottom-to-top directed multiplex network. It derives honest, objective quantitative metrics strictly from live graph topology—without subjective 1-to-5 ratings or arbitrary scoring rubrics.

---

## 📥 Downloads & Releases

Pre-compiled standalone desktop binaries for Windows:

| Platform | Package Format | Direct Download | File Size |
|---|---|---|---|
| **Windows 10 / 11** | Single-File Installer (`QualCount-Setup.exe`) | [`release/QualCount-Setup.exe`](release/QualCount-Setup.exe) | 4.67 MB |
| **Windows 10 / 11** | Standalone Portable Executable (`QualCount.exe`) | [`release/QualCount.exe`](release/QualCount.exe) | 21.72 MB |

> 🚀 **QualCount Version 2.0 (v2.0.0) is officially live!**
> Built on a desktop-ready native WebView2 shell with zero cloud dependencies. Download, launch, and operate your partnership ledger offline.

---

## ✨ Key Features

- **Bottom-to-Top Directed Multiplex Network:** Maps financial grants (green), direct operational relationships (white), and institutional bridge introductions (yellow) across clear hierarchical tiers.
- **Pure Quantitative 7-Metric Topology Engine:** Computes real-time analytical metrics derived strictly from graph mathematics:
  - Total Verified Funding vs Target Budget
  - Direct Relationship Count
  - Active Yellow Bridges
  - Owned Conversions
  - Multi-Thread Target Triangulation
  - Top Amplifier BFS Reach
  - Bridge Concentration Risk Percentage
- **Universal Single Workbook Architecture:** Every project corresponds to a single, standalone `.json` workbook with zero workspace clutter.
- **Native OS File System Integration:** Direct "Save" (`Ctrl+S`) and "Save As" (`Ctrl+Shift+S`) invoking the native Windows File Explorer to store workbooks anywhere on your PC.
- **Strict Single-Root Invariant:** Enforces a single designated root node per workbook with right-click reassignment guards.
- **Dense Graph Search Bar (`Ctrl+F`):** Rapid sub-millisecond search across 115+ nodes by organization name, internal lead, POC names, designations, emails, and phone numbers, complete with smooth camera auto-centering and elevated visual beacon pulsing.
- **Advanced Selection Modes:**
  - Hold `B` + click individual nodes for collective multi-selection and simultaneous group dragging.
  - Adobe Illustrator-style double-click isolation mode with marquee box selection strictly filtering for highlighted/connected nodes.
- **Universal Themes:** Instant toggle between high-contrast **White Paper** (light) and **Charcoal Matte** (dark) parchment themes.

---

## 🤖 Model Context Protocol (MCP) & Coding Agent Skills

QualCount includes a first-class Model Context Protocol (MCP) server and structured AI Agent skills, enabling autonomous coding agents (Claude Code, Google Antigravity, Cursor, Codex) to programmatically operate, analyze, and mutate the partnership graph.

### 1. Standalone MCP Server (`@qualcount/mcp-server`)
Located in [`packages/mcp-server`](packages/mcp-server), the server exposes standardized JSON-RPC tools and resources:

| MCP Tool | Description |
|---|---|
| `QualCount-list-workbooks` | Lists all available workbooks in the local workspace directory |
| `QualCount-get-workbook` | Retrieves full JSON graph topology (entities, placements, branches, budget) |
| `QualCount-search-entities` | Queries organizations and points of contact across workbooks |
| `QualCount-batch-mutate` | Atomically adds entities, creates placements, and links branches |
| `QualCount-compute-risk-audit` | Computes two-layer structural and qualitative bridge risk metrics |
| `QualCount-parse-spreadsheet` | Parses raw Excel (`.xlsx`) or CSV outreach sheets into workbook graphs |

### 2. Specialized Agent Skills (`.agent/skills/`)
The repository includes production-ready Agent Skills conforming to the standard `SKILL.md` specification:

- **`QualCount-partnership-graph-operator`**: Operational instructions for agents to build, modify, and tidy bottom-to-top multiplex workbooks without violating ownership or hierarchy rules.
- **`QualCount-spreadsheet-to-workflow-mapper`**: Systematic pipeline to convert messy outreach spreadsheets into deduplicated graph structures.
- **`QualCount-two-layer-risk-auditor`**: Guides agents through running quantitative risk audits and publishing structured assessments to the workbook.

#### Configuring MCP in Your Agent
Add the server configuration to your `mcp_config.json`:
```json
{
  "mcpServers": {
    "qualcount-ledger": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "QUALCOUNT_DATA_DIR": "./data"
      }
    }
  }
}
```

---

## 🛠️ Architecture & Engineering

```
┌────────────────────────────────────────────────────────┐
│               QualCount UI (React 18 / @xyflow)        │
│   • Top Menu Bar (File, View, Tools, Settings)         │
│   • Action Toolbar (Pointer, Pan, Search, Add, Tidy)   │
│   • Interactive 2D Canvas (Custom Nodes & Multiplex)   │
│   • Real-Time Analytical HUD & Search Drawer           │
└───────────────────────────┬────────────────────────────┘
                            │ Zustand Store
                            ▼
┌────────────────────────────────────────────────────────┐
│            Pure TypeScript Engine Core (Zero React)    │
│   • 7-Metric Topological Engine (src/engine/metrics)   │
│   • Sugiyama Inverted Layout (elkjs UP-direction)      │
│   • Parallel Bezier Lateral Separation                 │
│   • AABB Collision & Local Anti-Overlap Engine         │
│   • Subgraph Isolation & Marquee Filter Engine         │
└───────────────────────────┬────────────────────────────┘
                            │ WorkspaceRepository
                            ▼
┌────────────────────────────────────────────────────────┐
│            Persistence & Desktop Shell Layer           │
│   • Native File System Access (FilePicker / JSON)      │
│   • Tauri v2 Windows Shell (WebView2, zero Chromium)   │
│   • Local Single-File Database & Snapshot Backups      │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm
- Rust toolchain (`cargo` / `rustc`) *only required if building native Windows desktop binary*

### Development & Testing
```bash
# 1. Install dependencies
npm install

# 2. Run the full automated test suite (22 verification suites)
npm test

# 3. Launch Vite local dev server
npm run dev

# 4. Build web production bundle & compile MCP server
npm run build

# 5. Compile standalone Windows executable bundle (.exe)
npm run build:exe
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + F` | Open / focus dense node & contact search bar |
| `Ctrl + S` | Save workbook to disk |
| `Ctrl + Shift + S` | Save workbook As (opens native OS file explorer) |
| `Hold B + Click` | Multi-select individual nodes collectively |
| `Double Click Node` | Enter Adobe Illustrator-style subgraph isolation mode |
| `Space + Drag` | Pan canvas viewport |
| `Escape` | Clear selection or exit isolation mode |

---

## 🤝 Contributing

Contributions and community extensions are welcome:

1. Fork the repository (`git fork https://github.com/Bandetheighteen/QualCount`).
2. Create a feature branch (`git checkout -b feature/new-analytics`).
3. Commit your changes (`git commit -m 'feat: add new analytics view'`).
4. Ensure all 22 test suites pass (`npm test`).
5. Open a Pull Request.

---

## 👨‍💻 Author

Designed and built by **Shounak Saha** ([@Bandetheighteen](https://github.com/Bandetheighteen)).

- **GitHub:** [@Bandetheighteen](https://github.com/Bandetheighteen)
- **Portfolio / Connect:** [linktr.ee/shounaksaha2000b](https://linktr.ee/shounaksaha2000b)

---

## 📄 License

QualCount is licensed under the [MIT License](LICENSE-MIT).
