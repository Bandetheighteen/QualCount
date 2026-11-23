# Multiplex Network Topology and 7 Quantitative Metrics

> Sources: Concept Note, 2026-11-21; Antigravity Master Build Prompt, 2026-11-21
> Raw: [Concept Note](../../raw/qualcount/2026-11-21-concept-note-and-system-architecture.md); [Technical Specification](../../raw/qualcount/2026-11-21-technical-specification.md)
> Updated: 2026-11-21

## Overview

QualCount replaces subjective scoring and flat volume funnels with an objective multiplex network model. Institutional partnerships are represented as directed graphs where multiple distinct relationship types connect the same pair of organizations. Objective progress figures are computed directly from verifiable graph topology and edge action states.

## Multiplex Branch Structure

Relationships in QualCount are structured into three distinct branch layers:

- **Green Branches (Financial Funding)**: Represent funding commitments and grant proposals, tracking target budgets and secured amounts in INR.
- **White Branches (Direct Working Relationships)**: Represent operational non-monetary collaborations, including venue access, exhibition co-hosting, and joint program delivery.
- **Yellow Branches (Institutional Bridges)**: Represent institutional introductions, referrals, and brokerage across public agencies and community partners.

Every branch carries an action state: pending, confirmed, or declined.

## The 7 Quantitative Topology-Derived Metrics

Progress is measured through 7 mathematical indicators derived from live network topology:

1. **Funding Secured (%)**: Ratio of secured green funding relative to the total target budget.
2. **Direct Relationships**: Count of confirmed, pending, and declined direct white working relationships, along with the confirmation rate.
3. **Confirmed Yellow Bridges**: Count of confirmed and pending institutional referrals.
4. **Owned Conversions**: Conversion rate of referred partner nodes into confirmed direct collaborators.
5. **Multi-Thread Targets**: Identifies target organizations triangulated by multiple confirmed yellow bridges (classified into 2-Thread, Triple-Thread, and Quad-Thread).
6. **Top Amplifier Reach**: Breadth-first search (BFS) graph traversal calculating the maximum downstream institutional reach through an individual partner.
7. **Bridge Concentration Risk (%)**: Calculates structural dependency on a single bridge partner by comparing total reachable network nodes against reach when that bridge is removed.

## Pure Domain Engines

Four isolated domain calculation engines power canvas positioning and analytics:

- **Hierarchical Layout Engine (`src/engine/layout.ts`)**: Uses `elkjs` with `elk.direction: "UP"` to position foundational entities at Tier 0 ascending to higher partner tiers.
- **Parallel Edge Engine (`src/engine/parallelEdges.ts`)**: Computes canonical lateral Bezier normal curve offsets for parallel branches sharing the same endpoints.
- **Local Anti-Overlap Engine (`src/engine/overlap.ts`)**: Detects axis-aligned bounding box (AABB) collisions with 24px clearance, nudging adjacent nodes without altering user-anchored positions.
- **Metrics Engine (`src/engine/metrics.ts`)**: Evaluates all 7 graph metrics from normalized placement and branch collections.

## See Also

- [System Architecture](system-architecture.md)
- [Desktop Shell and Packaging](desktop-shell-and-packaging.md)
- [QualCount Project Archive](qualcount-project-archive.md)
