# Phase 5 Research & Engineering Specification

## 1. Public Choice Theory Utility Engine (`src/engine/utility.ts`)

### Theoretical Background
Standard CRMs rely on flat volume funnels and subjective 1-to-5 surveys. Public Choice Theory applies microeconomic incentives and institutional economics to civic and public sector alliances.

### Mathematical Definitions

#### Layer A: Funding Metric (Preserved Unchanged)
$$M_{\text{secured}} = \sum_{e \in E^{\text{tick}}_{\text{green}}} \text{valuePct}(e), \qquad M_{\text{pending}} = \sum_{e \in E^{\text{pending}}_{\text{green}}} \text{valuePct}(e)$$
$$\text{INR}_{\text{secured}} = \frac{M_{\text{secured}}}{100} \times \text{targetBudgetInr}$$

#### Layer B: Partner-Side Screening & Incentives (Per Placement $i$)
1. **Revealed Co-Ownership Depth ($O_i \in [0, 1]$)**:
   $$O_i = \frac{\mathbb{I}(\text{written}) + \mathbb{I}(\text{logo}) + \mathbb{I}(\text{staff}) + \mathbb{I}(\text{network})}{4}$$
2. **Social Proof / Screening Reduction Factor ($S_i \in [0, 1)$)**:
   Let $k^{\text{in}}_Y(i)$ be confirmed incoming yellow branches:
   $$S_i = 1 - \frac{1}{1 + k^{\text{in}}_Y(i)}$$
3. **Incentive Alignment Flag ($I_i \in \{0, 1\}$)**:
   $I_i = 1$ if $|\text{selectiveIncentives}_i| \ge 1$, else $0$.
   If pending partner has $I_i = 0$ and $S_i = 0$, emit `isApathyRisk: true`.

#### Layer C: NGO-Side Structural Utility (Per Placement $i$)
1. **Direct Commitment Component ($R_i \in [0, 1]$)**:
   Let $w_i = 1$ if ticked white branch exists from Root NGO to $i$, else $0$.
   $$R_i = w_i \cdot (0.50 + 0.50 \cdot O_i)$$
2. **Ecosystem Brokerage / Amplification Component ($A_i \in [0, 1]$)**:
   Let $D^{\text{reach}}_Y(i)$ be count of unique non-root nodes reachable downstream via ticked yellow paths (BFS).
   $$A_i = \frac{D^{\text{reach}}_Y(i)}{\max(1, N_{\text{conf}})}$$
3. **Owned Conversion Contribution ($V_i \in [0, 1]$)**:
   Ratio of outgoing ticked yellow targets that also hold a direct ticked white branch from Root NGO.
4. **Multi-Thread Reinforcement Contribution ($C_i \in [0, 1]$)**:
   Ratio of multi-thread targets ($k^{\text{in}}_Y \ge 2$) to which partner $i$ supplies a confirmed yellow branch.
5. **Partner Structural Utility ($U_i \in [0, 100]$)**:
   $$U_i = 100 \times (\alpha_R R_i + \alpha_A A_i + \alpha_V V_i + \alpha_C C_i)$$
   Default balanced weights: $\alpha_R = 0.30, \alpha_A = 0.35, \alpha_V = 0.20, \alpha_C = 0.15$.
6. **Decision-Cost Adjusted Yield ($\eta_i$)**:
   $$\eta_i = \frac{U_i}{\max(1, \text{outreachAttempts}_i)}$$

#### Layer D: Workbook Partnership Utility Index (PUI $\in [0, 100]$)
$$\text{PUI} = 100 \times (0.35 \bar{R} + 0.25 \bar{V} + 0.20 \bar{C} + 0.20 \bar{I})$$
- Confirmed Actions per Touch: $\text{Total Ticked Branches} / \sum_i \max(1, d_i)$
- In-Kind Asset Equivalent: $\sum \text{inKindValueInr} / \text{targetBudgetInr} \times 100\%$

---

## 2. Deterministic Structural Risk Engine (`src/engine/risk.ts`)

Layer 1 computes 6 parameters without machine learning:
- **R1: Single-Bridge Concentration**: Percentage of indirect downstream nodes lost if highest-reach bridge node is removed. Low <35%, Moderate 35-50%, Elevated 50-70%, Critical >70%.
- **R2: Unowned Dependency Exposure**: Percentage of confirmed yellow-referred nodes lacking direct white tie from Root NGO. Low <30%, Moderate 30-50%, Elevated 50-75%, Critical >75%.
- **R3: Funding Concentration & Runway Gap**: Critical if top donor >65% secured cash OR combined secured+pending <50% target; Elevated if single donor >50%.
- **R4: Public Choice Apathy Risk**: Percentage of pending non-root nodes with $k^{\text{in}}_Y = 0$ AND no selective incentives. Low <20%, Moderate 20-40%, Elevated 40-60%, Critical >60%.
- **R5: Decision-Cost Drag & Stale Pipeline**: Count of pending branches >14 days old plus partners with $\ge 4$ touches and 0 ticks. Low = 0, Moderate = 1-2, Elevated = 3-5, Critical $\ge 6$.
- **R6: Rejection Cluster Signal**: Overall resolved rejection ratio $\text{cross}/(\text{tick} + \text{cross})$ or single entity/category with $\ge 3$ declines and >60% decline rate. Low <25%, Moderate 25-45%, Elevated 45-65%, Critical >65%.
- **Aggregate Structural Tier**: Critical if any Critical or $\ge 3$ Elevated; Elevated if 1-2 Elevated or $\ge 3$ Moderate; Moderate if 1-2 Moderate; Low if all Low.

---

## 3. Impeccable Archival Book & Ledger Design System

- Surface tokens: Warm archival paper (`#FAF8F4`), margin surface (`#F2EFE9`), white card (`#FFFFFF`), hairline rule (`#DDD6C8`), strong border (`#BEB5A4`), primary ink (`#1C1B18`).
- High-contrast branches:
  - Green CSR: Pending `#2E7D52` (dashed 6 5, 2px), Tick `#0F6B38` (solid, 3px, pill `#E6F4EC`/#0F6B38), Cross `#8FA397` (solid, 1.5px, 0.65 opacity).
  - Charcoal Owned: Pending `#475569` (dashed, 2px), Tick `#18181B` (solid, 3px, pill `#18181B`/#FAF8F4), Cross `#B4AEA3` (solid, 1.5px, 0.55 opacity).
  - Amber Bridge: Pending `#C2850C` (dashed, 2px), Tick `#B45309` (solid, 3px, pill `#FEF3C7`/#92400E), Cross `#C2B9A7` (solid, 1.5px, 0.55 opacity).
- Anti-slop: zero purple-to-blue gradients, glowing orbs, or glass panels. 6px sharp card radius.

---

## 4. Maximized Analytical Dashboard Architecture

- Key combo: `Cmd/Ctrl + Shift + D` toggles state `isDashboardMaximized` in Zustand store.
- 4 Sections:
  1. Financial/In-Kind Ledger
  2. Public Choice Utility Ledger (with inline +/- touch steppers, incentive popover, co-ownership checklist, weight presets)
  3. Two-Layer Risk Assessment Box (Layer 1 matrix + Layer 2 agent briefing with scenario status toggles)
  4. Relational Node & Branch Ledgers (searchable/filterable tables with inline editing)

---

## 5. Spreadsheet I/O Pipeline

- **Export**: UTF-8 BOM-prefixed CSV bundles and `.xlsx` multi-tab workbook (`exceljs` or `xlsx`).
- **Import**:
  - Door 1: Native CSV/XLSX template parser with entity deduplication and auto-layout.
  - Door 2: Instruction card for connected MCP agents (`spreadsheet-to-workflow-mapper`).
  - Door 3: One-click "Copy Web AI Conversion Prompt" generator with dynamic workbook metadata, existing entity list, and JSON schema contract.
