/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Bottom-to-Top ELK Layout Engine (src/engine/layout.ts)
 * 
 * Computes a discrete Sugiyama layered hierarchical layout using elkjs.
 * Configured explicitly with elk.direction: "UP" so the root NGO sits at the
 * base (highest y) and target policy agencies crown the top (lowest y).
 * 
 * Read-Only Topology Guarantee: Placements and branches are strictly read-only.
 * Isolated / zero-degree nodes are staged gracefully on a baseline rack below
 * Tier 0 without crashing ELK.
 * 
 * Pure TypeScript (zero DOM/React/storage dependencies).
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { Placement, Branch } from '../types/schema';

// ---------------------------------------------------------------------------
// ELK Layout Engine Configuration
// ---------------------------------------------------------------------------

const elk = new ELK();

export const DEFAULT_LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'UP',
  'elk.edgeRouting': 'SPLINES',
  'elk.spacing.nodeNode': '72',
  'elk.layered.spacing.nodeNodeBetweenLayers': '125',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
};

// ---------------------------------------------------------------------------
// Hierarchical Layout Function
// ---------------------------------------------------------------------------

/**
 * Computes bottom-to-top hierarchical coordinates for all placements in the workbook.
 * 
 * @param placements Placement records dictionary
 * @param branches Branch records dictionary
 * @param activeWorkbookId Optional workbook ID filter
 * @returns Map of placementId -> { x, y } coordinates
 */
export async function computeHierarchicalLayout(
  placements: Record<string, Placement>,
  branches: Record<string, Branch>,
  activeWorkbookId?: string,
  direction: 'UP' | 'DOWN' | 'RIGHT' | 'LEFT' = 'UP'
): Promise<Record<string, { x: number; y: number }>> {
  const placementList = Object.values(placements).filter(
    (p) => !activeWorkbookId || p.workbookId === activeWorkbookId
  );
  const branchList = Object.values(branches).filter(
    (b) => !activeWorkbookId || b.workbookId === activeWorkbookId
  );

  if (placementList.length === 0) {
    return {};
  }

  const placementIdSet = new Set(placementList.map((p) => p.placementId));

  // Determine connected vs. isolated placements
  const connectedIdSet = new Set<string>();
  const validBranches: Branch[] = [];

  for (const b of branchList) {
    if (
      placementIdSet.has(b.sourcePlacementId) &&
      placementIdSet.has(b.targetPlacementId)
    ) {
      connectedIdSet.add(b.sourcePlacementId);
      connectedIdSet.add(b.targetPlacementId);
      validBranches.push(b);
    }
  }

  const connectedPlacements = placementList.filter((p) =>
    connectedIdSet.has(p.placementId)
  );
  const isolatedPlacements = placementList.filter(
    (p) => !connectedIdSet.has(p.placementId)
  );

  const resultPositions: Record<string, { x: number; y: number }> = {};

  let minX = 100;
  let maxY = 100;

  // 1. Layout connected placements with ELK
  if (connectedPlacements.length > 0) {
    const layoutOptions: Record<string, string> = {
      ...DEFAULT_LAYOUT_OPTIONS,
      'elk.direction': direction,
    };

    const elkGraph = {
      id: 'root',
      layoutOptions,
      children: connectedPlacements.map((p) => ({
        id: p.placementId,
        width: p.width || 190,
        height: p.height || 76,
      })),
      edges: validBranches.map((b) => ({
        id: b.branchId,
        sources: [b.sourcePlacementId],
        targets: [b.targetPlacementId],
      })),
    };

    try {
      const laidOut = await elk.layout(elkGraph);

      if (laidOut.children && laidOut.children.length > 0) {
        let currentMinX = Infinity;
        let currentMaxY = -Infinity;

        for (const node of laidOut.children) {
          const nx = Math.round(node.x ?? 0);
          const ny = Math.round(node.y ?? 0);
          resultPositions[node.id] = { x: nx, y: ny };

          if (nx < currentMinX) {
            currentMinX = nx;
          }

          const nodeHeight = node.height ?? 76;
          if (ny + nodeHeight > currentMaxY) {
            currentMaxY = ny + nodeHeight;
          }
        }

        if (currentMinX !== Infinity) {
          minX = currentMinX;
        }
        if (currentMaxY !== -Infinity) {
          maxY = currentMaxY;
        }
      }
    } catch {
      // Graceful fallback if ELK fails unexpectedly: preserve existing positions
      for (const p of connectedPlacements) {
        resultPositions[p.placementId] = {
          x: Math.round(p.x ?? 0),
          y: Math.round(p.y ?? 0),
        };
      }
    }
  }

  // 2. Stage isolated (zero-degree) placements neatly below Tier 0
  if (isolatedPlacements.length > 0) {
    const rackY = maxY + 150;
    const rackSpacing = 220;

    isolatedPlacements.forEach((p, idx) => {
      resultPositions[p.placementId] = {
        x: minX + idx * rackSpacing,
        y: rackY,
      };
    });
  }

  return resultPositions;
}
