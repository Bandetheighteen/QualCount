/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Deterministic Structural Risk Engine (src/engine/risk.ts)
 * 
 * Computes Layer 1 structural risk across 6 explicit parameters with pinpointed
 * offending placement and branch IDs.
 * Zero machine learning, zero black boxes, zero DOM/React/storage dependencies.
 * 
 * Parameters:
 * R1: Single-Bridge Concentration Risk (Freeman Articulation Loss)
 * R2: Unowned Dependency Exposure (Ostrom Durability Risk)
 * R3: Funding Concentration & Runway Gap
 * R4: Public Choice Apathy Risk (Olson Cold-Pitch Risk)
 * R5: Decision-Cost Drag & Stale Pipeline (Buchanan Decision Sinks)
 * R6: Rejection Cluster Signal (Contagion/Decline Clusters)
 */

import type {
  Entity,
  RiskSeverity,
  WorkspaceState,
} from '../types/schema';
import type { WorkbookLike } from './utility';

export interface RiskParameterResult {
  id: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  name: string;
  score: number;
  scoreFormatted: string;
  severity: RiskSeverity;
  thresholdDescription: string;
  plainCommentary: string;
  offendingPlacementIds: string[];
  offendingBranchIds: string[];
}

export interface StructuralRiskReport {
  aggregateTier: RiskSeverity;
  assessedAt: string;
  parameters: Record<'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6', RiskParameterResult>;
  allOffendingPlacementIds: string[];
  allOffendingBranchIds: string[];
}

/**
 * Computes the 6-parameter deterministic Layer 1 structural risk report.
 */
export function computeStructuralRiskReport(
  workbook: WorkbookLike,
  entities: Record<string, Entity>,
  referenceTimeMs: number = Date.now()
): StructuralRiskReport {
  const placementsList = Object.values(workbook.placements);
  const branchesList = Object.values(workbook.branches);
  const rootPlacement = placementsList.find((p) => p.isRootNgo);
  const rootPlacementId = rootPlacement?.placementId || '';

  // ---------------------------------------------------------------------------
  // Parameter R1: Single-Bridge Concentration (Freeman Articulation Loss)
  // ---------------------------------------------------------------------------
  // Build confirmed yellow graph adjacency
  const yellowAdj: Record<string, string[]> = {};
  for (const b of branchesList) {
    if (b.type === 'yellow' && b.status === 'tick') {
      if (!yellowAdj[b.sourcePlacementId]) yellowAdj[b.sourcePlacementId] = [];
      yellowAdj[b.sourcePlacementId].push(b.targetPlacementId);
    }
  }

  // Find all nodes reachable at distance >= 2 from Root NGO via ticked yellow paths
  // Distance 1 = direct yellow from root
  const distFromRoot: Record<string, number> = {};
  if (rootPlacementId) {
    const q: Array<{ id: string; dist: number }> = [{ id: rootPlacementId, dist: 0 }];
    distFromRoot[rootPlacementId] = 0;
    while (q.length > 0) {
      const { id, dist } = q.shift()!;
      for (const next of yellowAdj[id] || []) {
        if (distFromRoot[next] === undefined) {
          distFromRoot[next] = dist + 1;
          q.push({ id: next, dist: dist + 1 });
        }
      }
    }
  }

  const indirectNodes = Object.keys(distFromRoot).filter(
    (id) => id !== rootPlacementId && distFromRoot[id] >= 2
  );

  let maxLossPct = 0;
  let topBridgeId = '';
  const r1OffendingPlacements: string[] = [];
  const r1OffendingBranches: string[] = [];

  if (indirectNodes.length > 0) {
    // Non-root intermediate nodes that could act as bridges
    const candidateBridges = Object.keys(distFromRoot).filter(
      (id) => id !== rootPlacementId && (yellowAdj[id] || []).length > 0
    );

    for (const bridgeId of candidateBridges) {
      // Simulate removing bridgeId: how many indirectNodes become unreachable from Root?
      const simVisited = new Set<string>();
      const simQ: string[] = [rootPlacementId];
      simVisited.add(rootPlacementId);

      while (simQ.length > 0) {
        const curr = simQ.shift()!;
        for (const next of yellowAdj[curr] || []) {
          if (next !== bridgeId && !simVisited.has(next)) {
            simVisited.add(next);
            simQ.push(next);
          }
        }
      }

      const evalNodes = indirectNodes.filter((id) => id !== bridgeId);
      const lostCount = evalNodes.filter((id) => !simVisited.has(id)).length;
      const lossPct = evalNodes.length > 0 ? (lostCount / evalNodes.length) * 100 : 0;
      if (lossPct > maxLossPct) {
        maxLossPct = lossPct;
        topBridgeId = bridgeId;
      }
    }
  }

  let r1Severity: RiskSeverity = 'low';
  if (maxLossPct > 70) r1Severity = 'critical';
  else if (maxLossPct >= 50) r1Severity = 'elevated';
  else if (maxLossPct >= 35) r1Severity = 'moderate';

  if (topBridgeId && r1Severity !== 'low') {
    r1OffendingPlacements.push(topBridgeId);
    const bridgeBranches = branchesList
      .filter(
        (b) =>
          (b.sourcePlacementId === topBridgeId || b.targetPlacementId === topBridgeId) &&
          b.type === 'yellow' &&
          b.status === 'tick'
      )
      .map((b) => b.branchId);
    r1OffendingBranches.push(...bridgeBranches);
  }

  const bridgeName = topBridgeId ? entities[workbook.placements[topBridgeId]?.entityId]?.name || topBridgeId : 'None';
  const r1: RiskParameterResult = {
    id: 'R1',
    name: 'Single-Bridge Concentration',
    score: Number(maxLossPct.toFixed(1)),
    scoreFormatted: `${maxLossPct.toFixed(1)}%`,
    severity: r1Severity,
    thresholdDescription: 'Low < 35% | Mod 35-50% | Elev 50-70% | Crit > 70%',
    plainCommentary:
      maxLossPct === 0
        ? 'No articulation bridge bottleneck detected. Network pathways are either direct or diversified.'
        : `${maxLossPct.toFixed(1)}% of indirect downstream network depends on a single bridge (${bridgeName}).`,
    offendingPlacementIds: r1OffendingPlacements,
    offendingBranchIds: r1OffendingBranches,
  };

  // ---------------------------------------------------------------------------
  // Parameter R2: Unowned Dependency Exposure (Ostrom Durability Risk)
  // ---------------------------------------------------------------------------
  // Yellow-referred nodes: non-root nodes receiving at least one confirmed yellow branch
  const yellowReferredNodes = new Set<string>();
  for (const b of branchesList) {
    if (b.type === 'yellow' && b.status === 'tick') {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt && !tgt.isRootNgo) {
        yellowReferredNodes.add(b.targetPlacementId);
      }
    }
  }

  const unownedNodes = Array.from(yellowReferredNodes).filter((targetId) => {
    // Check if Root NGO has a direct ticked white branch to targetId
    const hasWhiteTick = branchesList.some(
      (b) =>
        b.sourcePlacementId === rootPlacementId &&
        b.targetPlacementId === targetId &&
        b.type === 'white' &&
        b.status === 'tick'
    );
    return !hasWhiteTick;
  });

  const r2Score =
    yellowReferredNodes.size > 0 ? (unownedNodes.length / yellowReferredNodes.size) * 100 : 0;

  let r2Severity: RiskSeverity = 'low';
  if (r2Score > 75) r2Severity = 'critical';
  else if (r2Score >= 50) r2Severity = 'elevated';
  else if (r2Score >= 30) r2Severity = 'moderate';

  const r2OffendingPlacements = r2Severity !== 'low' ? unownedNodes : [];
  const r2: RiskParameterResult = {
    id: 'R2',
    name: 'Unowned Dependency Exposure',
    score: Number(r2Score.toFixed(1)),
    scoreFormatted: `${r2Score.toFixed(1)}%`,
    severity: r2Severity,
    thresholdDescription: 'Low < 30% | Mod 30-50% | Elev 50-75% | Crit > 75%',
    plainCommentary:
      yellowReferredNodes.size === 0
        ? 'No referred nodes in workspace.'
        : `${unownedNodes.length} of ${yellowReferredNodes.size} referred partners (${r2Score.toFixed(1)}%) lack a direct confirmed working relationship with the lead NGO.`,
    offendingPlacementIds: r2OffendingPlacements,
    offendingBranchIds: [],
  };

  // ---------------------------------------------------------------------------
  // Parameter R3: Funding Concentration & Runway Gap
  // ---------------------------------------------------------------------------
  const greenBranches = branchesList.filter((b) => b.type === 'green');
  const securedCashPct = greenBranches
    .filter((b) => b.status === 'tick')
    .reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const pendingCashPct = greenBranches
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + (b.valuePct || 0), 0);

  // Group secured funding by donor placement
  const donorSecured: Record<string, number> = {};
  for (const b of greenBranches) {
    if (b.status === 'tick' && b.valuePct) {
      donorSecured[b.targetPlacementId] = (donorSecured[b.targetPlacementId] || 0) + b.valuePct;
    }
  }

  let topDonorPlacementId = '';
  let topDonorSecuredPct = 0;
  for (const [plcId, val] of Object.entries(donorSecured)) {
    if (val > topDonorSecuredPct) {
      topDonorSecuredPct = val;
      topDonorPlacementId = plcId;
    }
  }

  const topDonorShareOfSecured =
    securedCashPct > 0 ? (topDonorSecuredPct / securedCashPct) * 100 : 0;
  const combinedFunding = securedCashPct + pendingCashPct;

  let r3Severity: RiskSeverity = 'low';
  if (topDonorShareOfSecured > 65 || combinedFunding < 50) {
    r3Severity = 'critical';
  } else if (topDonorShareOfSecured > 50) {
    r3Severity = 'elevated';
  } else if (topDonorShareOfSecured > 35 || combinedFunding < 75) {
    r3Severity = 'moderate';
  }

  const r3OffendingPlacements: string[] = [];
  const r3OffendingBranches: string[] = [];
  if (topDonorPlacementId && (r3Severity === 'elevated' || r3Severity === 'critical')) {
    r3OffendingPlacements.push(topDonorPlacementId);
    const donorBranches = greenBranches
      .filter((b) => b.targetPlacementId === topDonorPlacementId && b.status === 'tick')
      .map((b) => b.branchId);
    r3OffendingBranches.push(...donorBranches);
  }

  const r3: RiskParameterResult = {
    id: 'R3',
    name: 'Funding Concentration & Runway Gap',
    score: Number(topDonorShareOfSecured.toFixed(1)),
    scoreFormatted: `${topDonorShareOfSecured.toFixed(1)}% / ${combinedFunding.toFixed(1)}%`,
    severity: r3Severity,
    thresholdDescription: 'Crit: single donor >65% OR combined <50% | Elev: single >50%',
    plainCommentary: `Top donor accounts for ${topDonorShareOfSecured.toFixed(1)}% of secured cash. Combined pipeline covers ${combinedFunding.toFixed(1)}% of budget.`,
    offendingPlacementIds: r3OffendingPlacements,
    offendingBranchIds: r3OffendingBranches,
  };

  // ---------------------------------------------------------------------------
  // Parameter R4: Public Choice Apathy Risk (Olson Cold-Pitch Risk)
  // ---------------------------------------------------------------------------
  const nonRootPlacements = placementsList.filter((p) => !p.isRootNgo);
  // Candidates: active pending non-root prospects without confirmed commitment
  const pendingPartners = nonRootPlacements.filter((p) => {
    const hasTick = branchesList.some(
      (b) => b.targetPlacementId === p.placementId && b.status === 'tick'
    );
    if (hasTick) return false;
    const hasPending = branchesList.some(
      (b) => b.targetPlacementId === p.placementId && b.status === 'pending'
    );
    const hasAnyIncoming = branchesList.some(
      (b) => b.targetPlacementId === p.placementId
    );
    return hasAnyIncoming ? hasPending : true;
  });

  const apathyPartners = pendingPartners.filter((p) => {
    const yellowIn = branchesList.filter(
      (b) => b.targetPlacementId === p.placementId && b.type === 'yellow' && b.status === 'tick'
    ).length;
    const incentivesCount = p.selectiveIncentives?.length ?? 0;
    return yellowIn === 0 && incentivesCount === 0;
  });

  const denominator = pendingPartners.length > 0 ? pendingPartners.length : nonRootPlacements.length;
  const r4Score = denominator > 0 ? (apathyPartners.length / denominator) * 100 : 0;

  let r4Severity: RiskSeverity = 'low';
  if (r4Score > 60) r4Severity = 'critical';
  else if (r4Score >= 40) r4Severity = 'elevated';
  else if (r4Score >= 20) r4Severity = 'moderate';

  const r4OffendingPlacements = r4Severity !== 'low' ? apathyPartners.map((p) => p.placementId) : [];
  const r4: RiskParameterResult = {
    id: 'R4',
    name: 'Public Choice Apathy Risk',
    score: Number(r4Score.toFixed(1)),
    scoreFormatted: `${r4Score.toFixed(1)}%`,
    severity: r4Severity,
    thresholdDescription: 'Low < 20% | Mod 20-40% | Elev 40-60% | Crit > 60%',
    plainCommentary:
      apathyPartners.length === 0
        ? 'No apathy risk detected. All pending prospects possess either selective incentives or institutional referrals.'
        : `${apathyPartners.length} unconfirmed prospects lack both selective incentives and referrals (high probability of rational apathy).`,
    offendingPlacementIds: r4OffendingPlacements,
    offendingBranchIds: [],
  };

  // ---------------------------------------------------------------------------
  // Parameter R5: Decision-Cost Drag & Stale Pipeline
  // ---------------------------------------------------------------------------
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const staleBranches = branchesList.filter((b) => {
    if (b.status !== 'pending') return false;
    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    return createdMs > 0 && referenceTimeMs - createdMs > FOURTEEN_DAYS_MS;
  });

  // Partners with outreachAttempts >= 4 and zero ticks
  const highFrictionPartners = nonRootPlacements.filter((p) => {
    const touches = p.outreachAttempts ?? 1;
    if (touches < 4) return false;
    const hasTick = branchesList.some(
      (b) => (b.targetPlacementId === p.placementId || b.sourcePlacementId === p.placementId) && b.status === 'tick'
    );
    return !hasTick;
  });

  const r5Score = staleBranches.length + highFrictionPartners.length;

  let r5Severity: RiskSeverity = 'low';
  if (r5Score >= 6) r5Severity = 'critical';
  else if (r5Score >= 3) r5Severity = 'elevated';
  else if (r5Score >= 1) r5Severity = 'moderate';

  const r5OffendingPlacements = r5Severity !== 'low' ? highFrictionPartners.map((p) => p.placementId) : [];
  const r5OffendingBranches = r5Severity !== 'low' ? staleBranches.map((b) => b.branchId) : [];

  const r5: RiskParameterResult = {
    id: 'R5',
    name: 'Decision-Cost Drag & Stale Pipeline',
    score: r5Score,
    scoreFormatted: `${r5Score} issues`,
    severity: r5Severity,
    thresholdDescription: 'Low = 0 | Mod = 1-2 | Elev = 3-5 | Crit >= 6',
    plainCommentary:
      r5Score === 0
        ? 'Pipeline is fresh and active. No stale branches or decision-sink partners.'
        : `${staleBranches.length} branches unresolved >14 days; ${highFrictionPartners.length} partners at >=4 touches with 0 commitments.`,
    offendingPlacementIds: r5OffendingPlacements,
    offendingBranchIds: r5OffendingBranches,
  };

  // ---------------------------------------------------------------------------
  // Parameter R6: Rejection Cluster Signal
  // ---------------------------------------------------------------------------
  const totalTicks = branchesList.filter((b) => b.status === 'tick').length;
  const totalCrosses = branchesList.filter((b) => b.status === 'cross').length;
  const totalResolved = totalTicks + totalCrosses;
  const overallRejectionRate = totalResolved > 0 ? (totalCrosses / totalResolved) * 100 : 0;

  // Check category-specific clusters (>= 3 declines & > 60% failure rate)
  const categoryDeclines: Record<string, { tick: number; cross: number }> = {};
  for (const b of branchesList) {
    if (b.status === 'tick' || b.status === 'cross') {
      const tgt = workbook.placements[b.targetPlacementId];
      if (tgt) {
        const cat = entities[tgt.entityId]?.category || 'other';
        if (!categoryDeclines[cat]) categoryDeclines[cat] = { tick: 0, cross: 0 };
        if (b.status === 'tick') categoryDeclines[cat].tick++;
        if (b.status === 'cross') categoryDeclines[cat].cross++;
      }
    }
  }

  let hasCategoryCluster = false;
  let clusteredCategory = '';
  for (const [cat, counts] of Object.entries(categoryDeclines)) {
    const total = counts.tick + counts.cross;
    if (counts.cross >= 3 && counts.cross / total > 0.60) {
      hasCategoryCluster = true;
      clusteredCategory = cat;
      break;
    }
  }

  let r6Severity: RiskSeverity = 'low';
  if (overallRejectionRate > 65 || hasCategoryCluster) {
    r6Severity = 'critical';
  } else if (overallRejectionRate >= 45) {
    r6Severity = 'elevated';
  } else if (overallRejectionRate >= 25) {
    r6Severity = 'moderate';
  }

  const r6OffendingBranches = branchesList.filter((b) => b.status === 'cross').map((b) => b.branchId);
  const r6OffendingPlacements = branchesList
    .filter((b) => b.status === 'cross')
    .map((b) => b.targetPlacementId);

  const r6: RiskParameterResult = {
    id: 'R6',
    name: 'Rejection Cluster Signal',
    score: Number(overallRejectionRate.toFixed(1)),
    scoreFormatted: `${overallRejectionRate.toFixed(1)}%`,
    severity: r6Severity,
    thresholdDescription: 'Low < 25% | Mod 25-45% | Elev 45-65% | Crit > 65%',
    plainCommentary: hasCategoryCluster
      ? `Rejection cluster detected in '${clusteredCategory}' sector (>=3 declines, >60% decline rate).`
      : `${totalCrosses} total declines out of ${totalResolved} resolved branches (${overallRejectionRate.toFixed(1)}% decline rate).`,
    offendingPlacementIds: r6Severity !== 'low' ? Array.from(new Set(r6OffendingPlacements)) : [],
    offendingBranchIds: r6Severity !== 'low' ? r6OffendingBranches : [],
  };

  // ---------------------------------------------------------------------------
  // Aggregate Structural Risk Tier
  // ---------------------------------------------------------------------------
  const params = { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6 };
  const severities = Object.values(params).map((p) => p.severity);
  const criticalCount = severities.filter((s) => s === 'critical').length;
  const elevatedCount = severities.filter((s) => s === 'elevated').length;
  const moderateCount = severities.filter((s) => s === 'moderate').length;

  let aggregateTier: RiskSeverity = 'low';
  if (criticalCount >= 1 || elevatedCount >= 3) {
    aggregateTier = 'critical';
  } else if (elevatedCount >= 1 || moderateCount >= 3) {
    aggregateTier = 'elevated';
  } else if (moderateCount >= 1) {
    aggregateTier = 'moderate';
  }

  // Pinpoint all unique offending placement and branch IDs
  const allOffendingPlacements = Array.from(
    new Set(Object.values(params).flatMap((p) => p.offendingPlacementIds))
  );
  const allOffendingBranches = Array.from(
    new Set(Object.values(params).flatMap((p) => p.offendingBranchIds))
  );

  return {
    aggregateTier,
    assessedAt: new Date(referenceTimeMs).toISOString(),
    parameters: params,
    allOffendingPlacementIds: allOffendingPlacements,
    allOffendingBranchIds: allOffendingBranches,
  };
}

/**
 * Convenient helper to assess a workbook's structural risk report
 * directly from workspace state and workbookId.
 */
export function assessWorkbookStructuralRisk(
  workspace: WorkspaceState,
  workbookId: string,
  referenceTimeMs?: number
): StructuralRiskReport {
  const wb = workspace.workbooks[workbookId];
  const wbContext: WorkbookLike = {
    ...workspace,
    activeWorkbookId: workbookId,
    utilityWeights: wb?.utilityWeights,
    targetBudgetInr: wb?.targetBudgetInr,
  };
  return computeStructuralRiskReport(wbContext, workspace.entities, referenceTimeMs);
}
