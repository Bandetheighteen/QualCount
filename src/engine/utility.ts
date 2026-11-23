/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Public Choice Theory Utility Engine (src/engine/utility.ts)
 * 
 * Computes objective, ratio-scale microeconomic utility metrics strictly from
 * live multiplex network topology without subjective 1-to-5 surveys.
 * 
 * Rooted in:
 * - Buchanan & Tullock (1962): Decision-making costs & touch efficiency (eta_i)
 * - Olson (1965): Selective incentives (I_i) & collective action screening
 * - Niskanen (1971): Bureaucratic inertia & screening cost reduction
 * - Ostrom (1990): Credible commitments, co-ownership depth (O_i) & owned conversion (V_i)
 * - Centola & Macy (2007): Social proof via multi-thread referrals (S_i, C_i)
 * 
 * Engine Isolation: Pure TypeScript. Zero imports from external DOM or storage runtimes.
 */

import type {
  Placement,
  Branch,
  Entity,
  UtilityStrategyWeights,
  CoOwnershipChecklist,
  WorkspaceState,
} from '../types/schema';
import { DEFAULT_UTILITY_WEIGHTS } from '../types/schema';

export interface PartnerUtilityDecomposition {
  R: number; // Direct commitment [0, 1]
  A: number; // Ecosystem amplification reach [0, 1]
  V: number; // Owned relationship conversion [0, 1]
  C: number; // Multi-thread reinforcement [0, 1]
  weightedR: number; // 100 * alphaR * R
  weightedA: number; // 100 * alphaA * A
  weightedV: number; // 100 * alphaV * V
  weightedC: number; // 100 * alphaC * C
}

export interface PartnerUtilityMetrics {
  placementId: string;
  entityId: string;
  entityName: string;
  coOwnershipO: number; // [0, 1]
  socialProofS: number; // [0, 1)
  incentiveFlagI: boolean;
  directCommitmentR: number; // [0, 1]
  amplificationA: number; // [0, 1]
  ownedConversionV: number; // [0, 1]
  multiThreadReinforcementC: number; // [0, 1]
  utilityScoreU: number; // [0, 100]
  utilityYieldEta: number; // U_i / max(1, outreachAttempts_i)
  decomposition: PartnerUtilityDecomposition;
  isApathyWarning: boolean;
}

export interface WorkbookUtilityReport {
  pui: number; // Workbook Partnership Utility Index [0, 100]
  actionsPerTouch: number; // Total confirmed actions / sum of touches
  inKindEquivalentPct: number; // In-kind asset equivalent % of target budget
  inKindEquivalentInr: number; // Total in-kind asset INR
  partners: Record<string, PartnerUtilityMetrics>;
  weights: UtilityStrategyWeights;
  strategyPreset: string;
}

export type WorkbookLike = {
  activeWorkbookId?: string;
  workbooks?: Record<string, { targetBudgetInr?: number; utilityWeights?: UtilityStrategyWeights }>;
  targetBudgetInr?: number;
  utilityWeights?: UtilityStrategyWeights;
  placements: Record<string, Placement>;
  branches: Record<string, Branch>;
};

/**
 * Normalizes utility strategy weights so alphaR + alphaA + alphaV + alphaC === 1.00.
 * Falls back to DEFAULT_UTILITY_WEIGHTS if sum is <= 0 or non-numeric.
 */
export function normalizeWeights(weights?: UtilityStrategyWeights): UtilityStrategyWeights {
  if (!weights) return DEFAULT_UTILITY_WEIGHTS;
  const rawSum = weights.alphaR + weights.alphaA + weights.alphaV + weights.alphaC;
  if (rawSum <= 0 || isNaN(rawSum)) {
    return DEFAULT_UTILITY_WEIGHTS;
  }
  if (Math.abs(rawSum - 1.0) < 0.001) {
    return weights;
  }
  return {
    ...weights,
    alphaR: weights.alphaR / rawSum,
    alphaA: weights.alphaA / rawSum,
    alphaV: weights.alphaV / rawSum,
    alphaC: weights.alphaC / rawSum,
  };
}

/**
 * 1. Revealed Co-Ownership Depth (O_i in [0, 1])
 * Ostrom's credible commitment index based on verifiable institutional behaviors:
 * written commitment, shared logo/branding, assigned staff, mobilized network.
 */
export function computeCoOwnershipDepth(signals?: CoOwnershipChecklist): number {
  if (!signals) return 0;
  const count =
    (signals.writtenCommitment ? 1 : 0) +
    (signals.brandOrLogoShared ? 1 : 0) +
    (signals.staffAssigned ? 1 : 0) +
    (signals.networkMobilized ? 1 : 0);
  return count / 4;
}

/**
 * 2. Social Proof / Screening Cost Reduction Factor (S_i in [0, 1))
 * Centola & Macy complex contagion curve modeling diminishing marginal friction:
 * S_i = 1 - 1 / (1 + k_in_Y(i))
 */
export function computeSocialProofFactor(yellowInDegree: number): number {
  const k = Math.max(0, yellowInDegree);
  return 1 - 1 / (1 + k);
}

/**
 * 3. Downstream Ecosystem Reach (D_reach_Y(i))
 * Count of unique non-root placements reachable strictly downstream from partner i
 * via confirmed (tick) yellow branches using Breadth-First Search (BFS).
 */
export function computeDownstreamAmplifierReach(
  placementId: string,
  placements: Record<string, Placement>,
  branches: Record<string, Branch>
): number {
  // Build adjacency list for confirmed yellow edges
  const adj: Record<string, string[]> = {};
  for (const br of Object.values(branches)) {
    if (br.type === 'yellow' && br.status === 'tick') {
      if (!adj[br.sourcePlacementId]) adj[br.sourcePlacementId] = [];
      adj[br.sourcePlacementId].push(br.targetPlacementId);
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [placementId];
  visited.add(placementId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj[curr] || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  // Remove starting placement and any root NGO node from reach count
  visited.delete(placementId);
  for (const [id, plc] of Object.entries(placements)) {
    if (plc.isRootNgo) {
      visited.delete(id);
    }
  }

  return visited.size;
}

/**
 * 4. Partner Structural Utility (U_i in [0, 100])
 * Computes all 4 additive components for a single non-root partner placement.
 */
export function computePartnerUtility(
  placementId: string,
  workbook: WorkbookLike,
  entities: Record<string, Entity>,
  rootPlacementId: string
): PartnerUtilityMetrics {
  const placement = workbook.placements[placementId];
  if (!placement) {
    throw new Error(`Placement ${placementId} not found in workbook`);
  }

  const entity = entities[placement.entityId];
  const entityName = entity?.name || 'Unknown Partner';

  const activeWb =
    workbook.activeWorkbookId && workbook.workbooks
      ? workbook.workbooks[workbook.activeWorkbookId]
      : undefined;
  const rawWeights = workbook.utilityWeights || activeWb?.utilityWeights || DEFAULT_UTILITY_WEIGHTS;
  const weights = normalizeWeights(rawWeights);
  const branchesList = Object.values(workbook.branches);

  // Incoming confirmed yellow branches to placementId
  const yellowInBranches = branchesList.filter(
    (b) => b.targetPlacementId === placementId && b.type === 'yellow' && b.status === 'tick'
  );
  const yellowInDegree = yellowInBranches.length;

  // Co-ownership & Social proof
  const coOwnershipO = computeCoOwnershipDepth(placement.coOwnershipSignals);
  const socialProofS = computeSocialProofFactor(yellowInDegree);
  const incentiveFlagI = Boolean(placement.selectiveIncentives && placement.selectiveIncentives.length >= 1);

  // Public Choice Apathy Warning
  // Partner is pending without any selective incentive AND has zero social proof
  const hasIncomingActive = branchesList.some(
    (b) => b.targetPlacementId === placementId && (b.status === 'tick' || b.status === 'pending')
  );
  const hasConfirmedDirect = branchesList.some(
    (b) => b.targetPlacementId === placementId && (b.type === 'white' || b.type === 'green') && b.status === 'tick'
  );
  const isApathyWarning = !hasConfirmedDirect && hasIncomingActive && !incentiveFlagI && yellowInDegree === 0;

  // Direct Commitment Component (R_i in [0, 1])
  // Let w_i = 1 if there is a ticked white branch from Root NGO to i, else 0
  const hasTickedWhiteFromRoot = branchesList.some(
    (b) =>
      b.sourcePlacementId === rootPlacementId &&
      b.targetPlacementId === placementId &&
      b.type === 'white' &&
      b.status === 'tick'
  );
  const directCommitmentR = hasTickedWhiteFromRoot ? 0.50 + 0.50 * coOwnershipO : 0;

  // Ecosystem Brokerage / Amplification Component (A_i in [0, 1])
  // N_conf = count of unique non-root placements with at least one confirmed (tick) incoming branch of any color
  const confTargets = new Set<string>();
  for (const b of branchesList) {
    if (b.status === 'tick' && workbook.placements[b.targetPlacementId] && !workbook.placements[b.targetPlacementId].isRootNgo) {
      confTargets.add(b.targetPlacementId);
    }
  }
  const nConf = Math.max(1, confTargets.size);
  const reachCount = computeDownstreamAmplifierReach(placementId, workbook.placements, workbook.branches);
  const amplificationA = Math.min(1, reachCount / nConf);

  // Owned Conversion Contribution (V_i in [0, 1])
  // Ratio of outgoing ticked yellow targets that also hold a direct ticked white branch from Root NGO
  const directYellowTargets = branchesList
    .filter((b) => b.sourcePlacementId === placementId && b.type === 'yellow' && b.status === 'tick')
    .map((b) => b.targetPlacementId);

  let ownedConversionV = 0;
  if (directYellowTargets.length > 0) {
    const ownedCount = directYellowTargets.filter((targetId) =>
      branchesList.some(
        (b) =>
          b.sourcePlacementId === rootPlacementId &&
          b.targetPlacementId === targetId &&
          b.type === 'white' &&
          b.status === 'tick'
      )
    ).length;
    ownedConversionV = ownedCount / directYellowTargets.length;
  }

  // Multi-Thread Reinforcement Contribution (C_i in [0, 1])
  // Targets v with k_in_Y(v) >= 2 to which partner i supplies a confirmed yellow branch
  const multiThreadTargets = new Set<string>();
  for (const pId of Object.keys(workbook.placements)) {
    if (pId === rootPlacementId) continue;
    const inY = branchesList.filter(
      (b) => b.targetPlacementId === pId && b.type === 'yellow' && b.status === 'tick'
    ).length;
    if (inY >= 2) {
      multiThreadTargets.add(pId);
    }
  }

  let multiThreadReinforcementC = 0;
  if (multiThreadTargets.size > 0) {
    const suppliedCount = directYellowTargets.filter((targetId) => multiThreadTargets.has(targetId)).length;
    multiThreadReinforcementC = suppliedCount / multiThreadTargets.size;
  }

  // 4-Part Additive Utility Decomposition
  const weightedR = Number((100 * weights.alphaR * directCommitmentR).toFixed(2));
  const weightedA = Number((100 * weights.alphaA * amplificationA).toFixed(2));
  const weightedV = Number((100 * weights.alphaV * ownedConversionV).toFixed(2));
  const weightedC = Number((100 * weights.alphaC * multiThreadReinforcementC).toFixed(2));

  const utilityScoreU = Number(
    (100 * (weights.alphaR * directCommitmentR +
            weights.alphaA * amplificationA +
            weights.alphaV * ownedConversionV +
            weights.alphaC * multiThreadReinforcementC)).toFixed(1)
  );

  const outreachAttempts = Math.max(1, placement.outreachAttempts ?? 1);
  const utilityYieldEta = Number((utilityScoreU / outreachAttempts).toFixed(1));

  return {
    placementId,
    entityId: placement.entityId,
    entityName,
    coOwnershipO: Number(coOwnershipO.toFixed(2)),
    socialProofS: Number(socialProofS.toFixed(3)),
    incentiveFlagI,
    directCommitmentR: Number(directCommitmentR.toFixed(2)),
    amplificationA: Number(amplificationA.toFixed(2)),
    ownedConversionV: Number(ownedConversionV.toFixed(2)),
    multiThreadReinforcementC: Number(multiThreadReinforcementC.toFixed(2)),
    utilityScoreU,
    utilityYieldEta,
    decomposition: {
      R: Number(directCommitmentR.toFixed(2)),
      A: Number(amplificationA.toFixed(2)),
      V: Number(ownedConversionV.toFixed(2)),
      C: Number(multiThreadReinforcementC.toFixed(2)),
      weightedR,
      weightedA,
      weightedV,
      weightedC,
    },
    isApathyWarning,
  };
}

/**
 * 5. Complete Workbook Public Choice Utility Report
 * Computes PUI macro score, Buchanan-Tullock efficiency, in-kind asset value,
 * and individual utility scores for all non-root partner placements.
 */
export function computePublicChoiceUtilityReport(
  workbook: WorkbookLike,
  entities: Record<string, Entity>
): WorkbookUtilityReport {
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const rootPlacement = placementsList.find((p) => p.isRootNgo);
  const rootPlacementId = rootPlacement?.placementId || '';

  const activeWb =
    workbook.activeWorkbookId && workbook.workbooks
      ? workbook.workbooks[workbook.activeWorkbookId]
      : undefined;
  const rawWeights = workbook.utilityWeights || activeWb?.utilityWeights || DEFAULT_UTILITY_WEIGHTS;
  const weights = normalizeWeights(rawWeights);
  const partners: Record<string, PartnerUtilityMetrics> = {};

  // Compute metrics for all non-root partners
  for (const placement of placementsList) {
    if (placement.isRootNgo) continue;
    partners[placement.placementId] = computePartnerUtility(
      placement.placementId,
      workbook,
      entities,
      rootPlacementId
    );
  }

  // --- MACRO PUI COMPONENTS ---
  // 1. Direct Confirmation & Co-Ownership Realization (R_bar in [0, 1])
  // Mean of (0.50 + 0.50 O_i) across all resolved direct white outreach targets from Root NGO (cross = 0)
  const directWhiteTargets = branchesList.filter(
    (b) => b.sourcePlacementId === rootPlacementId && b.type === 'white' && (b.status === 'tick' || b.status === 'cross')
  );

  let rBar = 0;
  if (directWhiteTargets.length > 0) {
    let rSum = 0;
    for (const b of directWhiteTargets) {
      if (b.status === 'tick') {
        const targetPlacement = workbook.placements[b.targetPlacementId];
        const oDepth = computeCoOwnershipDepth(targetPlacement?.coOwnershipSignals);
        rSum += 0.50 + 0.50 * oDepth;
      }
      // Declined (cross) contributes 0
    }
    rBar = rSum / directWhiteTargets.length;
  }

  // 2. Owned Conversion Rate (V_bar in [0, 1])
  // Total referred nodes = unique nodes receiving at least 1 confirmed yellow branch
  const referredNodeIds = new Set<string>();
  for (const b of branchesList) {
    if (b.type === 'yellow' && b.status === 'tick') {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt && !tgt.isRootNgo) {
        referredNodeIds.add(b.targetPlacementId);
      }
    }
  }

  const convertedNodeIds = new Set<string>();
  for (const refId of referredNodeIds) {
    const hasWhiteTick = branchesList.some(
      (b) => b.sourcePlacementId === rootPlacementId && b.targetPlacementId === refId && b.type === 'white' && b.status === 'tick'
    );
    if (hasWhiteTick) {
      convertedNodeIds.add(refId);
    }
  }

  const vBar = referredNodeIds.size > 0 ? convertedNodeIds.size / referredNodeIds.size : 0;

  // 3. Multi-Thread Depth Coverage (C_bar in [0, 1])
  // Nodes with k_in_Y >= 2 / max(1, Total Referred Nodes)
  let multiThreadCount = 0;
  for (const refId of referredNodeIds) {
    const inY = branchesList.filter(
      (b) => b.targetPlacementId === refId && b.type === 'yellow' && b.status === 'tick'
    ).length;
    if (inY >= 2) {
      multiThreadCount++;
    }
  }
  const cBar = referredNodeIds.size > 0 ? multiThreadCount / referredNodeIds.size : 0;

  // 4. Incentive Alignment Coverage (I_bar in [0, 1])
  // Fraction of active non-root partners with >= 1 articulated selective incentive OR k_in_Y >= 1
  const nonRootPlacements = placementsList.filter((p) => !p.isRootNgo);
  let alignedCount = 0;
  for (const plc of nonRootPlacements) {
    const hasIncentive = Boolean(plc.selectiveIncentives && plc.selectiveIncentives.length >= 1);
    const hasIncomingYellow = branchesList.some(
      (b) => b.targetPlacementId === plc.placementId && b.type === 'yellow' && b.status === 'tick'
    );
    if (hasIncentive || hasIncomingYellow) {
      alignedCount++;
    }
  }
  const iBar = nonRootPlacements.length > 0 ? alignedCount / nonRootPlacements.length : 0;

  // Workbook PUI (0 - 100)
  const pui = Number((100 * (0.35 * rBar + 0.25 * vBar + 0.20 * cBar + 0.20 * iBar)).toFixed(1));

  // Actions per Touch (Buchanan-Tullock efficiency)
  const totalTickedBranches = branchesList.filter((b) => b.status === 'tick').length;
  const totalTouches = nonRootPlacements.reduce((sum, p) => sum + Math.max(1, p.outreachAttempts ?? 1), 0);
  const actionsPerTouch = totalTouches > 0 ? Number((totalTickedBranches / totalTouches).toFixed(2)) : 0;

  // In-Kind Asset Equivalent
  const inKindEquivalentInr = branchesList.reduce((sum, b) => {
    if (b.type === 'white' && b.status === 'tick' && typeof b.inKindValueInr === 'number') {
      return sum + b.inKindValueInr;
    }
    return sum;
  }, 0);

  const targetBudgetInr = workbook.targetBudgetInr ?? activeWb?.targetBudgetInr ?? 0;
  const inKindEquivalentPct =
    targetBudgetInr > 0
      ? Number(((inKindEquivalentInr / targetBudgetInr) * 100).toFixed(1))
      : 0;

  return {
    pui,
    actionsPerTouch,
    inKindEquivalentPct,
    inKindEquivalentInr,
    partners,
    weights,
    strategyPreset: weights.presetName || 'balanced',
  };
}

/**
 * Convenient helper to compute a workbook's Public Choice utility report
 * directly from workspace state and workbookId.
 */
export function computeWorkbookUtilityReport(
  workspace: WorkspaceState,
  workbookId: string
): WorkbookUtilityReport {
  const wb = workspace.workbooks[workbookId];
  const wbContext: WorkbookLike = {
    ...workspace,
    activeWorkbookId: workbookId,
    utilityWeights: wb?.utilityWeights,
    targetBudgetInr: wb?.targetBudgetInr,
  };
  return computePublicChoiceUtilityReport(wbContext, workspace.entities);
}
