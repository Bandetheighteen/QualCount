/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Quantitative 7-Metric Engine (src/engine/metrics.ts)
 * 
 * Derives honest, objective quantitative partnership indicators strictly from
 * live graph topology with zero subjective scoring (1-to-5 ratings) and zero
 * DOM/React/storage dependencies.
 */

import type { WorkspaceState, Branch, Placement } from '../types/schema';

// ---------------------------------------------------------------------------
// Metric Return Types
// ---------------------------------------------------------------------------

export interface FundingMetrics {
  securedPct: number;
  pendingPct: number;
  declinedCount: number;
  securedInr: number;
}

export interface DirectRelationshipMetrics {
  confirmedCount: number;
  pendingCount: number;
  declinedCount: number;
  confirmationRatePct: number;
}

export interface YellowBridgeMetrics {
  confirmedCount: number;
  pendingCount: number;
  declinedCount: number;
}

export interface OwnedConversionMetrics {
  referredNodeCount: number;
  convertedNodeCount: number;
  conversionRatePct: number;
}

export interface MultiThreadMetrics {
  doubleThreadCount: number;
  tripleThreadCount: number;
  quadPlusThreadCount: number;
  triplePlusNames: string[];
}

export interface TopAmplifierMetrics {
  entityId: string | null;
  entityName: string;
  directOutDegree: number;
  downstreamReachCount: number;
}

export interface BridgeConcentrationMetrics {
  bridgeEntityName: string;
  concentrationPct: number;
  unreachableCount: number;
}

export interface WorkspaceTopologyMetrics {
  funding: FundingMetrics;
  directRelationships: DirectRelationshipMetrics;
  yellowBridges: YellowBridgeMetrics;
  ownedConversions: OwnedConversionMetrics;
  multiThreadTargets: MultiThreadMetrics;
  topAmplifier: TopAmplifierMetrics;
  bridgeConcentration: BridgeConcentrationMetrics;
}

// ---------------------------------------------------------------------------
// Helper: Normalize Branches
// ---------------------------------------------------------------------------

function toBranchArray(branches: Record<string, Branch> | Branch[]): Branch[] {
  return Array.isArray(branches) ? branches : Object.values(branches);
}

// ---------------------------------------------------------------------------
// Metric 5 Helper: Node-level Confirmed Yellow In-Degree
// ---------------------------------------------------------------------------

/**
 * Computes confirmed yellow in-degree for a specific placement card.
 * In QualCount, multiple ticked yellow branches converging on a single target
 * indicate multi-thread endorsement / triangulation.
 */
export function getNodeYellowInDegree(
  placementId: string,
  branches: Record<string, Branch> | Branch[]
): number {
  const branchList = toBranchArray(branches);
  return branchList.filter(
    (b) =>
      b.type === 'yellow' &&
      b.status === 'tick' &&
      b.targetPlacementId === placementId
  ).length;
}

// ---------------------------------------------------------------------------
// Metric 6 Helper: Node-level Downstream BFS Reach
// ---------------------------------------------------------------------------

function bfsReachFromAdj(
  placementId: string,
  adj: Map<string, string[]>,
  rootPlacementId?: string
): number {
  const visited = new Set<string>();
  const queue: string[] = [];

  const neighbors = adj.get(placementId) || [];
  for (const next of neighbors) {
    if (next !== placementId && next !== rootPlacementId && !visited.has(next)) {
      visited.add(next);
      queue.push(next);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextNeighbors = adj.get(current) || [];
    for (const next of nextNeighbors) {
      if (next !== placementId && next !== rootPlacementId && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.size;
}

/**
 * Runs Breadth-First Search (BFS) along confirmed (ticked) yellow referral branches
 * originating from a given placement, discovering all unique downstream placements.
 * Excludes self and root NGO from the reach set.
 */
export function getNodeAmplifierReach(
  placementId: string,
  _placements: Record<string, Placement>,
  branches: Record<string, Branch> | Branch[],
  rootPlacementId?: string
): number {
  const branchList = toBranchArray(branches);

  // Build adjacency list for ticked yellow edges
  const adj = new Map<string, string[]>();
  for (const b of branchList) {
    if (b.type === 'yellow' && b.status === 'tick') {
      let list = adj.get(b.sourcePlacementId);
      if (!list) {
        list = [];
        adj.set(b.sourcePlacementId, list);
      }
      list.push(b.targetPlacementId);
    }
  }

  return bfsReachFromAdj(placementId, adj, rootPlacementId);
}

// ---------------------------------------------------------------------------
// Main Engine: Compute All 7 Quantitative Topology Metrics
// ---------------------------------------------------------------------------

/**
 * Pure calculation engine computing all seven quantitative partnership metrics
 * directly from live graph records in the active workbook.
 */
export function computeTopologyMetrics(
  state: WorkspaceState,
  activeWorkbookId?: string
): WorkspaceTopologyMetrics {
  const targetWorkbookId = activeWorkbookId ?? state.activeWorkbookId;
  const workbook = state.workbooks[targetWorkbookId];

  const placements = Object.values(state.placements).filter(
    (p) => p.workbookId === targetWorkbookId
  );
  const branches = Object.values(state.branches).filter(
    (b) => b.workbookId === targetWorkbookId
  );

  const rootPlacement = placements.find((p) => p.isRootNgo);
  const rootPlacementId = rootPlacement?.placementId;

  // 1. Single-pass branch evaluation for funding, white ties, yellow bridges, and topology indexing
  let securedPct = 0;
  let pendingPct = 0;
  let greenDeclinedCount = 0;

  let whiteConfirmedCount = 0;
  let whitePendingCount = 0;
  let whiteDeclinedCount = 0;

  let yellowConfirmedCount = 0;
  let yellowPendingCount = 0;
  let yellowDeclinedCount = 0;

  const yellowInDegreeMap = new Map<string, number>();
  const incomingPartnerYellowCount = new Map<string, number>();
  const directWhiteFromRoot = new Set<string>();
  const directYellowOutDegreeMap = new Map<string, number>();
  const yellowAdj = new Map<string, string[]>();

  for (const b of branches) {
    if (b.type === 'green') {
      if (b.status === 'tick') {
        securedPct += b.valuePct || 0;
      } else if (b.status === 'pending') {
        pendingPct += b.valuePct || 0;
      } else if (b.status === 'cross') {
        greenDeclinedCount += 1;
      }
    } else if (b.type === 'white') {
      if (rootPlacementId && b.sourcePlacementId === rootPlacementId) {
        if (b.status === 'tick') {
          whiteConfirmedCount += 1;
        } else if (b.status === 'pending') {
          whitePendingCount += 1;
        } else if (b.status === 'cross') {
          whiteDeclinedCount += 1;
        }
      }
      if (b.status === 'tick' && rootPlacementId && b.sourcePlacementId === rootPlacementId) {
        directWhiteFromRoot.add(b.targetPlacementId);
      }
    } else if (b.type === 'yellow') {
      if (b.status === 'tick') {
        yellowConfirmedCount += 1;
        yellowInDegreeMap.set(b.targetPlacementId, (yellowInDegreeMap.get(b.targetPlacementId) || 0) + 1);
        directYellowOutDegreeMap.set(b.sourcePlacementId, (directYellowOutDegreeMap.get(b.sourcePlacementId) || 0) + 1);
        if (!rootPlacementId || b.sourcePlacementId !== rootPlacementId) {
          incomingPartnerYellowCount.set(b.targetPlacementId, (incomingPartnerYellowCount.get(b.targetPlacementId) || 0) + 1);
        }
        let list = yellowAdj.get(b.sourcePlacementId);
        if (!list) {
          list = [];
          yellowAdj.set(b.sourcePlacementId, list);
        }
        list.push(b.targetPlacementId);
      } else if (b.status === 'pending') {
        yellowPendingCount += 1;
      } else if (b.status === 'cross') {
        yellowDeclinedCount += 1;
      }
    }
  }

  const targetBudgetInr = workbook?.targetBudgetInr ?? 0;
  const securedInr = (securedPct / 100) * targetBudgetInr;

  const funding: FundingMetrics = {
    securedPct,
    pendingPct,
    declinedCount: greenDeclinedCount,
    securedInr,
  };

  const decidedWhiteTies = whiteConfirmedCount + whiteDeclinedCount;
  const confirmationRatePct =
    decidedWhiteTies > 0 ? (whiteConfirmedCount / decidedWhiteTies) * 100 : 0;

  const directRelationships: DirectRelationshipMetrics = {
    confirmedCount: whiteConfirmedCount,
    pendingCount: whitePendingCount,
    declinedCount: whiteDeclinedCount,
    confirmationRatePct,
  };

  const yellowBridges: YellowBridgeMetrics = {
    confirmedCount: yellowConfirmedCount,
    pendingCount: yellowPendingCount,
    declinedCount: yellowDeclinedCount,
  };

  // 4. Owned Conversions
  // Measures conversion of borrowed bridge reach into owned direct ties.
  // Referred nodes: non-root placements that have incoming yellow referral branches from a partner (source !== root).
  // Converted nodes: referred nodes that now also hold a direct confirmed white tie from root NGO.
  const nonRootPlacements = placements.filter((p) => !p.isRootNgo);

  let referredNodeCount = 0;
  let convertedNodeCount = 0;

  for (const p of nonRootPlacements) {
    const incomingPartnerCount = incomingPartnerYellowCount.get(p.placementId) || 0;
    if (incomingPartnerCount > 0) {
      referredNodeCount += 1;
      if (directWhiteFromRoot.has(p.placementId)) {
        convertedNodeCount += 1;
      }
    }
  }

  const conversionRatePct =
    referredNodeCount > 0 ? (convertedNodeCount / referredNodeCount) * 100 : 0;

  const ownedConversions: OwnedConversionMetrics = {
    referredNodeCount,
    convertedNodeCount,
    conversionRatePct,
  };

  // 5. Multi-Thread Targets
  let doubleThreadCount = 0;
  let tripleThreadCount = 0;
  let quadPlusThreadCount = 0;
  const triplePlusNames: string[] = [];

  for (const p of nonRootPlacements) {
    const inDeg = yellowInDegreeMap.get(p.placementId) || 0;
    if (inDeg === 2) {
      doubleThreadCount += 1;
    } else if (inDeg === 3) {
      tripleThreadCount += 1;
    } else if (inDeg >= 4) {
      quadPlusThreadCount += 1;
    }

    if (inDeg >= 3) {
      const entity = state.entities[p.entityId];
      if (entity?.name) {
        triplePlusNames.push(entity.name);
      }
    }
  }

  const multiThreadTargets: MultiThreadMetrics = {
    doubleThreadCount,
    tripleThreadCount,
    quadPlusThreadCount,
    triplePlusNames,
  };

  // 6. Top Amplifier (BFS reach)
  let bestAmplifierPlacement: Placement | null = null;
  let bestReachCount = 0;
  let bestDirectOutDegree = 0;

  const placementsById = new Map<string, Placement>();
  for (const p of placements) {
    placementsById.set(p.placementId, p);
  }

  for (const p of nonRootPlacements) {
    const directOutDegree = directYellowOutDegreeMap.get(p.placementId) || 0;
    if (directOutDegree === 0) continue; // Skip leaf nodes with no yellow out-degree

    const reachCount = bfsReachFromAdj(
      p.placementId,
      yellowAdj,
      rootPlacementId
    );

    if (
      reachCount > bestReachCount ||
      (reachCount === bestReachCount && directOutDegree > bestDirectOutDegree)
    ) {
      bestReachCount = reachCount;
      bestDirectOutDegree = directOutDegree;
      bestAmplifierPlacement = p;
    }
  }

  let topAmplifier: TopAmplifierMetrics;
  if (bestAmplifierPlacement && (bestReachCount > 0 || bestDirectOutDegree > 0)) {
    const entity = state.entities[bestAmplifierPlacement.entityId];
    topAmplifier = {
      entityId: bestAmplifierPlacement.entityId,
      entityName: entity?.name || '',
      directOutDegree: bestDirectOutDegree,
      downstreamReachCount: bestReachCount,
    };
  } else {
    topAmplifier = {
      entityId: null,
      entityName: '',
      directOutDegree: 0,
      downstreamReachCount: 0,
    };
  }

  // 7. Bridge Concentration Risk (%)
  // Computes percentage of confirmed indirect downstream nodes (path length >= 2 from root)
  // that become unreachable if the highest-reach bridge node is removed.
  let bridgeConcentration: BridgeConcentrationMetrics = {
    bridgeEntityName: '',
    concentrationPct: 0,
    unreachableCount: 0,
  };

  if (rootPlacementId) {
    // 1. Find unique direct bridge nodes from root (Level 1)
    const directBridgePlacementIds = Array.from(
      new Set(
        branches
          .filter(
            (b) =>
              b.type === 'yellow' &&
              b.status === 'tick' &&
              b.sourcePlacementId === rootPlacementId
          )
          .map((b) => b.targetPlacementId)
      )
    );

    // 2. Compute R_total: all unique placements reachable via ticked yellow paths of length >= 2 from root
    // Level 0: rootPlacementId
    // Level 1: directBridgePlacementIds
    // Level >= 2: indirect placements reachable from Level 1
    const getReachableFrom = (
      startIds: string[],
      blockedId?: string
    ): Set<string> => {
      const reached = new Set<string>();
      const queue = [...startIds].filter((id) => id !== blockedId);
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === blockedId) continue;
        const neighbors = yellowAdj.get(curr) || [];
        for (const n of neighbors) {
          if (n !== rootPlacementId && n !== blockedId) {
            reached.add(n);
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
      }

      // Filter out level 1 direct bridges from indirect reach set
      for (const bId of directBridgePlacementIds) {
        reached.delete(bId);
      }
      return reached;
    };

    const rTotal = getReachableFrom(directBridgePlacementIds);

    if (rTotal.size > 0 && directBridgePlacementIds.length > 0) {
      // Find the highest-reach bridge node b among direct bridges,
      // breaking any reach ties by lost reach count
      let worstBridgeId = directBridgePlacementIds[0];
      let maxReach = -1;
      let maxLostCount = -1;

      for (const bId of directBridgePlacementIds) {
        const reach = getNodeAmplifierReach(
          bId,
          state.placements,
          branches,
          rootPlacementId
        );
        const remainingBridgeIds = directBridgePlacementIds.filter(
          (id) => id !== bId
        );
        const rWithoutB = getReachableFrom(remainingBridgeIds, bId);
        const lostCount = rTotal.size - rWithoutB.size;

        if (
          reach > maxReach ||
          (reach === maxReach && lostCount > maxLostCount)
        ) {
          maxReach = reach;
          maxLostCount = lostCount;
          worstBridgeId = bId;
        }
      }

      const bridgePlacement = state.placements[worstBridgeId];
      const bridgeEntity = bridgePlacement
        ? state.entities[bridgePlacement.entityId]
        : null;

      const concentrationPct = (maxLostCount / rTotal.size) * 100;

      bridgeConcentration = {
        bridgeEntityName: bridgeEntity?.name || '',
        concentrationPct,
        unreachableCount: maxLostCount,
      };
    }
  }

  return {
    funding,
    directRelationships,
    yellowBridges,
    ownedConversions,
    multiThreadTargets,
    topAmplifier,
    bridgeConcentration,
  };
}
