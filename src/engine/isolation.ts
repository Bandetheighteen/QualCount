/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Isolation Mode & Marquee Filtering Engine (src/engine/isolation.ts)
 * 
 * Provides deterministic topology filtering for Illustrator-style isolation mode.
 * When a node or branch is isolated, non-connected elements are visually dimmed.
 * When a user draws a marquee selection box in isolation mode, candidates are strictly
 * filtered so that ONLY highlighted (isolated & connected) elements are selected.
 * 
 * Pure TypeScript (zero DOM/React/storage dependencies).
 */

import type { Branch } from '../types/schema';

export type IsolatedElement = {
  type: 'node' | 'branch';
  id: string;
} | null;

/**
 * Returns a Set of placement IDs that are highlighted (not dimmed) in isolation mode.
 * If isolation mode is not active (isolatedElement is null), returns null (indicating all nodes are valid).
 * 
 * - When a node is isolated: contains the target node and all 1-hop connected neighbors (both incoming and outgoing).
 * - When a branch is isolated: contains the source and target placement endpoints.
 * 
 * @param isolatedElement Currently isolated node or branch, or null
 * @param branches All branches in the workspace (Record or Array)
 * @param activeWorkbookId Optional active workbook filter
 */
export function getIsolatedHighlightedPlacementIds(
  isolatedElement: IsolatedElement,
  branches: Record<string, Branch> | Branch[],
  activeWorkbookId?: string
): Set<string> | null {
  if (!isolatedElement) return null;

  const branchList = Array.isArray(branches) ? branches : Object.values(branches);
  const relevantBranches = activeWorkbookId
    ? branchList.filter((b) => b.workbookId === activeWorkbookId)
    : branchList;

  const highlighted = new Set<string>();

  if (isolatedElement.type === 'node') {
    const targetId = isolatedElement.id;
    highlighted.add(targetId);
    for (const b of relevantBranches) {
      if (b.sourcePlacementId === targetId) {
        highlighted.add(b.targetPlacementId);
      }
      if (b.targetPlacementId === targetId) {
        highlighted.add(b.sourcePlacementId);
      }
    }
  } else if (isolatedElement.type === 'branch') {
    const branch = relevantBranches.find((b) => b.branchId === isolatedElement.id);
    if (branch) {
      highlighted.add(branch.sourcePlacementId);
      highlighted.add(branch.targetPlacementId);
    }
  }

  return highlighted;
}

/**
 * Returns a Set of branch IDs that are highlighted (not dimmed) in isolation mode.
 * If isolation mode is not active, returns null (indicating all branches are valid).
 * 
 * - When a node is isolated: contains all branches connected to that node.
 * - When a branch is isolated: contains only that isolated branch.
 * 
 * @param isolatedElement Currently isolated node or branch, or null
 * @param branches All branches in the workspace (Record or Array)
 * @param activeWorkbookId Optional active workbook filter
 */
export function getIsolatedHighlightedBranchIds(
  isolatedElement: IsolatedElement,
  branches: Record<string, Branch> | Branch[],
  activeWorkbookId?: string
): Set<string> | null {
  if (!isolatedElement) return null;

  const branchList = Array.isArray(branches) ? branches : Object.values(branches);
  const relevantBranches = activeWorkbookId
    ? branchList.filter((b) => b.workbookId === activeWorkbookId)
    : branchList;

  const highlighted = new Set<string>();

  if (isolatedElement.type === 'branch') {
    highlighted.add(isolatedElement.id);
  } else if (isolatedElement.type === 'node') {
    const targetId = isolatedElement.id;
    for (const b of relevantBranches) {
      if (b.sourcePlacementId === targetId || b.targetPlacementId === targetId) {
        highlighted.add(b.branchId);
      }
    }
  }

  return highlighted;
}

/**
 * Checks whether a given placement is dimmed under the active isolation mode.
 */
export function isPlacementDimmedInIsolation(
  placementId: string,
  isolatedElement: IsolatedElement,
  branches: Record<string, Branch> | Branch[],
  activeWorkbookId?: string
): boolean {
  if (!isolatedElement) return false;
  const highlighted = getIsolatedHighlightedPlacementIds(isolatedElement, branches, activeWorkbookId);
  return highlighted !== null && !highlighted.has(placementId);
}

/**
 * Checks whether a given branch is dimmed under the active isolation mode.
 */
export function isBranchDimmedInIsolation(
  branchId: string,
  isolatedElement: IsolatedElement,
  branches: Record<string, Branch> | Branch[],
  activeWorkbookId?: string
): boolean {
  if (!isolatedElement) return false;
  const highlighted = getIsolatedHighlightedBranchIds(isolatedElement, branches, activeWorkbookId);
  return highlighted !== null && !highlighted.has(branchId);
}

/**
 * Filters marquee candidate selections against isolation mode rules.
 * Any dimmed / non-isolated nodes and branches are stripped out.
 * 
 * @param candidates Object containing touched placementIds and branchIds
 * @param isolatedElement Current isolation element or null
 * @param branches All branches in workspace
 * @param activeWorkbookId Optional active workbook filter
 * @returns Filtered selection containing ONLY highlighted/isolated elements
 */
export function filterSelectionByIsolation(
  candidates: { placementIds: string[]; branchIds: string[] },
  isolatedElement: IsolatedElement,
  branches: Record<string, Branch> | Branch[],
  activeWorkbookId?: string
): { placementIds: string[]; branchIds: string[] } {
  if (!isolatedElement) {
    return candidates;
  }

  const highlightedPlacements = getIsolatedHighlightedPlacementIds(
    isolatedElement,
    branches,
    activeWorkbookId
  );
  const highlightedBranches = getIsolatedHighlightedBranchIds(
    isolatedElement,
    branches,
    activeWorkbookId
  );

  const filteredPlacements = highlightedPlacements !== null
    ? candidates.placementIds.filter((id) => highlightedPlacements.has(id))
    : candidates.placementIds;

  const filteredBranches = highlightedBranches !== null
    ? candidates.branchIds.filter((id) => highlightedBranches.has(id))
    : candidates.branchIds;

  return {
    placementIds: filteredPlacements,
    branchIds: filteredBranches,
  };
}
