import { create } from 'zustand';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type {
  WorkspaceState,
  BranchStatus,
  BranchType,
  EntityCategory,
  Entity,
  Placement,
  Branch,
  WorkspaceFilters,
  UtilityStrategyWeights,
  AgentRiskAssessment,
  Workbook,
  WorkspaceSourceType,
  WorkbookFile,
  WorkbookLink,
} from '../types/schema';
import { DEFAULT_UTILITY_WEIGHTS, migrateToSchemaV2 } from '../types/schema';
import {
  computeTopologyMetrics,
  type WorkspaceTopologyMetrics,
} from '../engine/metrics';
import { groupParallelBranches } from '../engine/parallelEdges';
import { resolveLocalCollisions } from '../engine/overlap';
import { computeHierarchicalLayout } from '../engine/layout';
import { filterSelectionByIsolation, isPlacementDimmedInIsolation } from '../engine/isolation';
import {
  getWorkspaceRepository,
  isSampleDeletedPersisted,
  setSampleDeletedPersisted,
  loadSavedWorkspacesList,
  saveSavedWorkspacesList,
  loadActiveWorkspaceSync,
} from '../storage';
import { isWorkbookFile, isWorkspaceState } from '../storage/workspaceRepository';
import {
  importWorkspaceBundle,
  convertWorkbookFileToWorkspace,
} from '../storage/folderSerializer';
import { saveWorkbookNative } from '../io/nativeFileSave';
import { seedDelhiNgoWorkspace, WORKBOOK_DELHI_ID, WORKSPACE_SAMPLE_ID } from '../data/seedDelhiNgo';
import { commitImportedRows, type ImportRow } from '../io/spreadsheetImport';
import type { EntitySearchResult } from '../engine/entityIndex';

export interface SectorCategoryItem {
  id: string;
  label: string;
  isDefault?: boolean;
}

export const DEFAULT_SECTOR_CATEGORIES: SectorCategoryItem[] = [
  { id: 'csr', label: 'CSR / Corporate Funder', isDefault: true },
  { id: 'government', label: 'Government / Ministry Department', isDefault: true },
  { id: 'institution', label: 'Institution / Foundation', isDefault: true },
  { id: 'community', label: 'Community / Grassroots', isDefault: true },
  { id: 'ngo', label: 'NGO / Civil Society', isDefault: true },
  { id: 'other', label: 'Other Sector Partner', isDefault: true },
];

export interface OrgNodeConnectionStats {
  incomingTotal: number;
  outgoingTotal: number;
  incomingYellowConfirmed: number;
  incomingGreenFundingPct: number;
  incomingConfirmed: number;
  incomingPending: number;
  incomingDeclined: number;
}

export interface OrgNodeData extends Record<string, unknown> {
  entity: Entity | undefined;
  placement: Placement;
  yellowInDegree: number;
  selected: boolean;
  stats: OrgNodeConnectionStats;
  isLocked?: boolean;
  isIsolated?: boolean;
  isDimmed?: boolean;
  diagramAlignment?: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft';
  siblingWorkbookCount?: number;
  siblingWorkbookTitles?: string[];
  theme?: 'dark' | 'night' | 'light';
}

export interface MultiplexEdgeData extends Record<string, unknown> {
  branch: Branch;
  index: number;
  total: number;
  isReverse: boolean;
  selected: boolean;
  isLocked?: boolean;
  isIsolated?: boolean;
  isDimmed?: boolean;
  theme?: 'dark' | 'night' | 'light';
}

export type OrgFlowNode = Node<OrgNodeData, 'orgNode'>;
export type MultiplexFlowEdge = Edge<MultiplexEdgeData, 'multiplexEdge'>;

let memorySampleDeleted = false;

export interface WorkspaceStoreState {
  workspace: WorkspaceState | null;
  savedWorkspaces: WorkspaceState[];
  activeWorkbookId: string | null;
  selectedPlacementId: string | null;
  selectedBranchId: string | null;
  selectedPlacementIds: string[];
  selectedBranchIds: string[];
  lockedPlacementIds: string[];
  lockedBranchIds: string[];
  isWorkspaceLocked: boolean;
  showDeclined: boolean;
  filters: WorkspaceFilters;
  isLayoutRunning: boolean;
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;
  setIsLoading: (loading: boolean, message?: string) => void;
  metrics: WorkspaceTopologyMetrics | null;
  yellowInDegrees: Record<string, number>;
  nodes: OrgFlowNode[];
  edges: MultiplexFlowEdge[];
  sectors: SectorCategoryItem[];
  dragConnectEnabled: boolean;
  isConnecting: boolean;
  connectingNodeId: string | null;
  connectingHandleId: string | null;
  selectionFilter: 'all' | 'nodes' | 'branches';
  flowInstance: any | null;

  // Appearance, Positioning & Performance Settings
  theme: 'dark' | 'night' | 'light';
  highContrast: boolean;
  animationsEnabled: boolean;
  highPerformanceMode: boolean;
  isFullscreen: boolean;
  dashboardPosition: 'top' | 'bottom' | 'left' | 'right';
  ribbonPosition: 'top' | 'bottom' | 'left' | 'right';
  diagramAlignment: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft';
  isRibbonPinned: boolean;

  // Maximized Dashboard & Highlighting
  isDashboardMaximized: boolean;
  highlightedPlacementIds: string[];
  toggleDashboardMaximized: () => void;
  setDashboardMaximized: (maximized: boolean) => void;
  setHighlightedPlacements: (ids: string[]) => void;
  // Node Search & Flash Beacon
  isSearchOpen: boolean;
  searchFocusTrigger: number;
  flashingPlacementId: string | null;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  setFlashingPlacement: (placementId: string | null) => void;
  updatePlacementPublicChoice: (placementId: string, updates: Partial<Placement>) => Promise<void>;
  updateUtilityWeights: (weights: UtilityStrategyWeights) => Promise<void>;
  updateRiskScenarioStatus: (scenarioId: string, status: 'open' | 'mitigating' | 'resolved') => Promise<void>;
  updateRiskAssessment: (assessment: AgentRiskAssessment) => Promise<void>;
  commitSpreadsheetImport: (rows: ImportRow[]) => Promise<void>;

  // Interaction Tools & Isolation Mode
  activeTool: 'pointer' | 'hand';
  isolatedElement: { type: 'node' | 'branch'; id: string } | null;
  isolatedPlacementId: string | null;
  isInspectorDismissed: boolean;
  dismissedNotificationIds: string[];

  // History (Undo / Redo)
  undoStack: WorkspaceState[];
  redoStack: WorkspaceState[];
  pushHistory: (currentState: WorkspaceState) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Lock Actions
  toggleLockPlacement: (placementId: string) => void;
  toggleLockBranch: (branchId: string) => void;
  toggleLockSelected: () => void;
  toggleWorkspaceLock: () => void;
  isPlacementLocked: (placementId: string) => boolean;
  isBranchLocked: (branchId: string) => boolean;
  batchLock: (lock?: boolean) => void;

  // Selection Actions
  isHoldingB: boolean;
  setIsHoldingB: (holding: boolean) => void;
  toggleSelectPlacement: (placementId: string) => void;
  setSelection: (placementIds: string[], branchIds: string[]) => void;
  setSelectionFilter: (filter: 'all' | 'nodes' | 'branches') => void;
  batchDelete: () => Promise<void>;
  batchSetBranchStatus: (status: BranchStatus) => Promise<void>;
  batchSetCategory: (category: EntityCategory) => Promise<void>;
  batchAppendNotes: (notes: string) => Promise<void>;

  // Settings & Positioning Actions
  setTheme: (theme: 'dark' | 'night' | 'light') => void;
  toggleHighContrast: () => void;
  toggleAnimations: () => void;
  toggleHighPerformance: () => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setDashboardPosition: (pos: 'top' | 'bottom' | 'left' | 'right') => void;
  setRibbonPosition: (pos: 'top' | 'bottom' | 'left' | 'right') => void;
  setIsRibbonPinned: (pinned: boolean) => void;
  toggleRibbonPinned: () => void;
  setDiagramAlignment: (align: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft') => void;
  setActiveTool: (tool: 'pointer' | 'hand') => void;
  enterIsolationMode: (type: 'node' | 'branch', id: string) => void;
  exitIsolationMode: () => void;
  setIsInspectorDismissed: (dismissed: boolean) => void;
  dismissNotification: (id: string) => void;
  clearDismissedNotifications: () => void;
  setFlowInstance: (instance: any | null) => void;
  fitView: () => void;
  resetZoom: () => void;

  // Actions
  init: () => Promise<void>;
  selectPlacement: (id: string | null, forceMulti?: boolean) => void;
  selectBranch: (id: string | null) => void;
  clearSelection: () => void;
  toggleShowDeclined: () => void;
  setFilters: (filters: Partial<WorkspaceFilters>) => void;
  resetFilters: () => void;
  setConnecting: (isConnecting: boolean, nodeId?: string | null, handleId?: string | null) => void;
  setDragConnectEnabled: (enabled: boolean) => void;
  toggleDragConnect: () => void;
  onConnect: (connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => Promise<void>;
  addSector: (label: string) => string;
  updateSector: (id: string, newLabel: string) => Promise<void>;
  deleteSector: (id: string) => Promise<void>;
  resetSectors: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStop: (
    placementId: string,
    position: { x: number; y: number },
    allMovedNodes?: Array<{ id: string; position: { x: number; y: number } }>
  ) => Promise<void>;
  setBranchStatus: (branchId: string, status: BranchStatus) => Promise<void>;
  tidyUpLayout: () => Promise<void>;
  resetToDelhiSeed: () => Promise<void>;

  // Creation, editing, and deletion actions
  addNode: (
    name: string,
    category: EntityCategory,
    globalNotes?: string,
    initialPosition?: { x: number; y: number },
    internalLead?: string
  ) => Promise<{ placementId: string; entityId: string }>;
  addBranch: (
    sourcePlacementId: string,
    targetPlacementId: string,
    type: BranchType,
    status: BranchStatus,
    valuePct?: number,
    note?: string
  ) => Promise<Branch | null>;
  updateEntity: (entityId: string, updates: Partial<Entity>) => Promise<void>;
  updateBranch: (branchId: string, updates: Partial<Branch>) => Promise<void>;
  deleteBranch: (branchId: string) => Promise<void>;
  removePlacement: (placementId: string) => Promise<boolean>;
  exportWorkspace: () => Promise<void>;
  importWorkspace: () => Promise<boolean>;
  importWorkspaceFile: (fileOrData?: File | string | WorkspaceState) => Promise<boolean>;
  importWorkbookFile: (fileOrData?: File | string | WorkbookFile) => Promise<boolean>;
  loadWorkspace: () => Promise<void>;

  // Workspace CRUD operations
  createWorkspace: (name: string, rootNgoName?: string) => Promise<string>;
  updateWorkspace: (updates: { workspaceName?: string }, workspaceId?: string) => Promise<void>;
  copyWorkspace: (workspaceIdOrName?: string, customName?: string) => Promise<string>;
  deleteWorkspace: (workspaceId?: string) => Promise<boolean>;
  downloadWorkspace: (workspaceId?: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<boolean>;

  // Workbook CRUD operations
  updateWorkbook: (workbookId: string, updates: Partial<Workbook>) => Promise<void>;
  copyWorkbook: (workbookId: string) => Promise<string>;
  deleteWorkbook: (workbookId: string) => Promise<boolean>;
  downloadWorkbook: (workbookId: string) => Promise<void>;
  saveWorkbookToDisk: (workbookId?: string, forceSaveAs?: boolean) => Promise<{ success: boolean; canceled?: boolean; fileName?: string }>;
  setRootPlacement: (placementId: string, isRoot?: boolean) => Promise<void>;

  // Connected Tree Filtering
  filterToConnectedNodes: (placementIds: string[]) => void;

  // Phase 6 View, Navigation & Cross-Workbook Autocomplete
  activeView: 'landing' | 'canvas';
  setActiveView: (view: 'landing' | 'canvas') => void;
  openWorkbook: (workbookId: string) => void;
  createWorkbook: (title: string, description?: string, targetBudgetInr?: number) => Promise<string>;
  setSourceType: (sourceType: WorkspaceSourceType, folderPath?: string) => Promise<void>;
  isBookIndexOpen: boolean;
  toggleBookIndex: () => void;
  setBookIndexOpen: (open: boolean) => void;
  importEntityWithProvenBridges: (entityResult: EntitySearchResult, pullBridges: boolean) => Promise<void>;
  deriveNodesWith: (state: WorkspaceStoreState, ws?: WorkspaceState) => OrgFlowNode[];
  deriveEdgesWith: (state: WorkspaceStoreState, ws?: WorkspaceState) => MultiplexFlowEdge[];

  // Phase 7 MCP Agent Mutation & Rollback
  agentMutationNotification: {
    agentName: string;
    toolName: string;
    summary: string;
    timestamp: string;
  } | null;
  revertLastAgentChange: () => Promise<void>;
  dismissAgentNotification: () => void;
  reloadFromStorage: () => Promise<void>;

  // Getters
  getFlowNodes: () => OrgFlowNode[];
  getFlowEdges: () => MultiplexFlowEdge[];
}

/**
 * Breadth-first search finding all placements reachable via active branches
 * from one or more seed placement cards.
 */
export function computeConnectedTree(
  seedPlacementIds: string[],
  branches: Branch[]
): Set<string> {
  const visited = new Set<string>(seedPlacementIds);
  const queue = [...seedPlacementIds];
  const adj = new Map<string, string[]>();

  for (const b of branches) {
    if (!adj.has(b.sourcePlacementId)) adj.set(b.sourcePlacementId, []);
    if (!adj.has(b.targetPlacementId)) adj.set(b.targetPlacementId, []);
    adj.get(b.sourcePlacementId)!.push(b.targetPlacementId);
    adj.get(b.targetPlacementId)!.push(b.sourcePlacementId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  return visited;
}

/**
 * Derives React Flow nodes from relational workspace placements.
 */
export function deriveFlowNodes(
  workspace: WorkspaceState | null,
  activeWorkbookId: string | null,
  selectedPlacementId: string | null,
  yellowInDegrees: Record<string, number>,
  selectedPlacementIds: string[] = [],
  lockedPlacementIds: string[] = [],
  isWorkspaceLocked: boolean = false,
  isolatedElement: { type: 'node' | 'branch'; id: string } | null = null,
  diagramAlignment: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft' = 'bottomToTop',
  filters?: WorkspaceFilters,
  theme: 'dark' | 'night' | 'light' = 'dark'
): OrgFlowNode[] {
  if (!workspace || !activeWorkbookId) return [];

  const branches = Object.values(workspace.branches).filter(
    (b) => b.workbookId === activeWorkbookId
  );

  // Pre-index branches for O(1) lookups across large datasets
  const incomingMap = new Map<string, Branch[]>();
  const outgoingMap = new Map<string, Branch[]>();
  const degreeMap = new Map<string, number>();

  for (const b of branches) {
    let inc = incomingMap.get(b.targetPlacementId);
    if (!inc) {
      inc = [];
      incomingMap.set(b.targetPlacementId, inc);
    }
    inc.push(b);

    let out = outgoingMap.get(b.sourcePlacementId);
    if (!out) {
      out = [];
      outgoingMap.set(b.sourcePlacementId, out);
    }
    out.push(b);

    degreeMap.set(b.targetPlacementId, (degreeMap.get(b.targetPlacementId) || 0) + 1);
    degreeMap.set(b.sourcePlacementId, (degreeMap.get(b.sourcePlacementId) || 0) + 1);
  }

  // Pre-index entity workbook placements
  const entityWorkbookMap = new Map<string, Set<string>>();
  for (const p of Object.values(workspace.placements)) {
    let set = entityWorkbookMap.get(p.entityId);
    if (!set) {
      set = new Set<string>();
      entityWorkbookMap.set(p.entityId, set);
    }
    if (p.workbookId) set.add(p.workbookId);
  }

  // Connected tree filter computation
  let connectedTreePlacementIds: Set<string> | null = null;
  if (filters?.connectedToPlacementIds && filters.connectedToPlacementIds.length > 0) {
    connectedTreePlacementIds = computeConnectedTree(filters.connectedToPlacementIds, branches);
  }

  const placements = Object.values(workspace.placements).filter((p) => {
    if (p.workbookId !== activeWorkbookId) return false;
    if (connectedTreePlacementIds && !connectedTreePlacementIds.has(p.placementId)) {
      return false;
    }
    if (filters) {
      if (filters.nodeCategories && filters.nodeCategories.length > 0) {
        const entity = workspace.entities[p.entityId];
        if (!entity || !filters.nodeCategories.includes(entity.category)) {
          return false;
        }
      }
      if (filters.connectionFilter === 'onlyConnected' || filters.connectionFilter === 'onlyUnconnected') {
        const total = degreeMap.get(p.placementId) || 0;
        if (filters.connectionFilter === 'onlyConnected' && total === 0) return false;
        if (filters.connectionFilter === 'onlyUnconnected' && total > 0) return false;
      }
    }
    return true;
  });

  let isNodeDimmed = (_pId: string): boolean => false;
  let isNodeIsolated = (_pId: string): boolean => false;

  if (isolatedElement) {
    if (isolatedElement.type === 'node') {
      const targetId = isolatedElement.id;
      const connectedNeighborIds = new Set<string>([targetId]);
      for (const b of branches) {
        if (b.sourcePlacementId === targetId) connectedNeighborIds.add(b.targetPlacementId);
        if (b.targetPlacementId === targetId) connectedNeighborIds.add(b.sourcePlacementId);
      }
      isNodeIsolated = (pId: string) => pId === targetId;
      isNodeDimmed = (pId: string) => !connectedNeighborIds.has(pId);
    } else if (isolatedElement.type === 'branch') {
      const b = workspace.branches[isolatedElement.id];
      const endpoints = new Set<string>();
      if (b) {
        endpoints.add(b.sourcePlacementId);
        endpoints.add(b.targetPlacementId);
      }
      isNodeDimmed = (pId: string) => !endpoints.has(pId);
    }
  }

  return placements.map((placement) => {
    const entity = workspace.entities[placement.entityId];
    const yellowInDeg = yellowInDegrees[placement.placementId] ?? 0;

    const incoming = incomingMap.get(placement.placementId) || [];
    const outgoing = outgoingMap.get(placement.placementId) || [];

    const stats: OrgNodeConnectionStats = {
      incomingTotal: incoming.length,
      outgoingTotal: outgoing.length,
      incomingYellowConfirmed: yellowInDeg,
      incomingGreenFundingPct: incoming
        .filter((b) => b.type === 'green' && b.status === 'tick')
        .reduce((sum, b) => sum + (b.valuePct ?? 0), 0),
      incomingConfirmed: incoming.filter((b) => b.status === 'tick').length,
      incomingPending: incoming.filter((b) => b.status === 'pending').length,
      incomingDeclined: incoming.filter((b) => b.status === 'cross').length,
    };

    const isLocked = isWorkspaceLocked || lockedPlacementIds.includes(placement.placementId);
    const isSelected =
      placement.placementId === selectedPlacementId ||
      selectedPlacementIds.includes(placement.placementId);
    const isIsolated = isNodeIsolated(placement.placementId);
    const isDimmed = isNodeDimmed(placement.placementId);

    // Count distinct workbooks where this entity is placed
    const siblingWbIdSet = entityWorkbookMap.get(placement.entityId) || new Set<string>();
    const siblingWorkbookCount = siblingWbIdSet.size;
    const siblingWorkbookTitles = Array.from(siblingWbIdSet)
      .map((id) => workspace.workbooks[id]?.title || id)
      .filter(Boolean);

    return {
      id: placement.placementId,
      type: 'orgNode',
      position: { x: placement.x, y: placement.y },
      selected: isSelected,
      draggable: !isLocked && !isWorkspaceLocked,
      data: {
        entity,
        placement,
        yellowInDegree: yellowInDeg,
        selected: isSelected,
        stats,
        isLocked,
        isIsolated,
        isDimmed,
        diagramAlignment,
        siblingWorkbookCount,
        siblingWorkbookTitles,
        theme,
      },
    };
  });
}

/**
 * Derives React Flow edges from relational workspace branches with parallel grouping.
 */
export function deriveFlowEdges(
  workspace: WorkspaceState | null,
  activeWorkbookId: string | null,
  selectedBranchId: string | null,
  showDeclined: boolean,
  selectedBranchIds: string[] = [],
  lockedBranchIds: string[] = [],
  isWorkspaceLocked: boolean = false,
  isolatedElement: { type: 'node' | 'branch'; id: string } | null = null,
  theme: 'dark' | 'night' | 'light' = 'dark',
  filters?: WorkspaceFilters
): MultiplexFlowEdge[] {
  if (!workspace || !activeWorkbookId) return [];

  const allBranches = Object.values(workspace.branches).filter(
    (b) => b.workbookId === activeWorkbookId
  );

  let connectedTreePlacementIds: Set<string> | null = null;
  if (filters?.connectedToPlacementIds && filters.connectedToPlacementIds.length > 0) {
    connectedTreePlacementIds = computeConnectedTree(filters.connectedToPlacementIds, allBranches);
  }

  let visiblePlacementIds: Set<string> | null = null;
  if (
    filters &&
    ((filters.nodeCategories && filters.nodeCategories.length > 0) ||
      (filters.connectionFilter && filters.connectionFilter !== 'all') ||
      connectedTreePlacementIds)
  ) {
    const degMap = new Map<string, number>();
    for (const b of allBranches) {
      degMap.set(b.sourcePlacementId, (degMap.get(b.sourcePlacementId) || 0) + 1);
      degMap.set(b.targetPlacementId, (degMap.get(b.targetPlacementId) || 0) + 1);
    }

    visiblePlacementIds = new Set(
      Object.values(workspace.placements)
        .filter((p) => {
          if (p.workbookId !== activeWorkbookId) return false;
          if (connectedTreePlacementIds && !connectedTreePlacementIds.has(p.placementId)) {
            return false;
          }
          if (filters.nodeCategories && filters.nodeCategories.length > 0) {
            const entity = workspace.entities[p.entityId];
            if (!entity || !filters.nodeCategories.includes(entity.category)) return false;
          }
          if (filters.connectionFilter === 'onlyConnected' || filters.connectionFilter === 'onlyUnconnected') {
            const total = degMap.get(p.placementId) || 0;
            if (filters.connectionFilter === 'onlyConnected' && total === 0) return false;
            if (filters.connectionFilter === 'onlyUnconnected' && total > 0) return false;
          }
          return true;
        })
        .map((p) => p.placementId)
    );
  }

  const visibleBranches = allBranches.filter((b) => {
    if (connectedTreePlacementIds) {
      if (!connectedTreePlacementIds.has(b.sourcePlacementId) || !connectedTreePlacementIds.has(b.targetPlacementId)) {
        return false;
      }
    }

    if (!filters) {
      return showDeclined ? true : b.status !== 'cross';
    }

    if (filters.branchTypes && !filters.branchTypes.includes(b.type)) {
      return false;
    }

    if (filters.branchStatuses && !filters.branchStatuses.includes(b.status)) {
      return false;
    }

    if (filters.minFundingPct > 0 && b.type === 'green') {
      if ((b.valuePct ?? 0) < filters.minFundingPct) {
        return false;
      }
    }

    if (visiblePlacementIds) {
      if (!visiblePlacementIds.has(b.sourcePlacementId) || !visiblePlacementIds.has(b.targetPlacementId)) {
        return false;
      }
    }

    return true;
  });

  const groups = groupParallelBranches(visibleBranches);
  const edges: MultiplexFlowEdge[] = [];

  let isEdgeDimmed = (_b: Branch): boolean => false;
  let isEdgeIsolated = (_b: Branch): boolean => false;

  if (isolatedElement) {
    if (isolatedElement.type === 'branch') {
      isEdgeIsolated = (b: Branch) => b.branchId === isolatedElement.id;
      isEdgeDimmed = (b: Branch) => b.branchId !== isolatedElement.id;
    } else if (isolatedElement.type === 'node') {
      const targetId = isolatedElement.id;
      isEdgeDimmed = (b: Branch) =>
        b.sourcePlacementId !== targetId && b.targetPlacementId !== targetId;
    }
  }

  for (const group of groups.values()) {
    const total = group.length;
    group.forEach((branch, index) => {
      const srcP = workspace.placements[branch.sourcePlacementId];
      const tgtP = workspace.placements[branch.targetPlacementId];
      // Canonical bottom-to-top direction: higher y (base) to lower y (apex)
      const isReverse =
        srcP && tgtP
          ? srcP.y < tgtP.y || (srcP.y === tgtP.y && srcP.x > tgtP.x)
          : false;

      const isLocked = isWorkspaceLocked || lockedBranchIds.includes(branch.branchId);
      const isSelected =
        branch.branchId === selectedBranchId ||
        selectedBranchIds.includes(branch.branchId);
      const isIsolated = isEdgeIsolated(branch);
      const isDimmed = isEdgeDimmed(branch);

      edges.push({
        id: branch.branchId,
        source: branch.sourcePlacementId,
        target: branch.targetPlacementId,
        sourceHandle: `source-${branch.type}`,
        targetHandle: `target-${branch.type}`,
        type: 'multiplexEdge',
        selected: isSelected,
        reconnectable: !isLocked,
        data: {
          branch,
          index,
          total,
          isReverse,
          selected: isSelected,
          isLocked,
          isIsolated,
          isDimmed,
          theme,
        },
      });
    });
  }

  return edges;
}

function computeAllYellowInDegrees(
  workspace: WorkspaceState,
  workbookId: string
): Record<string, number> {
  const yellowInDegrees: Record<string, number> = {};
  const activePlacements = Object.values(workspace.placements).filter(
    (p) => p.workbookId === workbookId
  );
  const activeBranches = Object.values(workspace.branches).filter(
    (b) => b.workbookId === workbookId
  );
  for (const b of activeBranches) {
    if (b.type === 'yellow' && b.status === 'tick') {
      yellowInDegrees[b.targetPlacementId] = (yellowInDegrees[b.targetPlacementId] || 0) + 1;
    }
  }
  for (const p of activePlacements) {
    if (yellowInDegrees[p.placementId] === undefined) {
      yellowInDegrees[p.placementId] = 0;
    }
  }
  return yellowInDegrees;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

export function isSampleWorkspace(w: WorkspaceState | null | undefined): boolean {
  if (!w) return false;
  return (
    w.workspaceId === WORKSPACE_SAMPLE_ID ||
    w.workspaceId === 'ws_delhi_coalitions' ||
    Boolean(w.workbooks?.[WORKBOOK_DELHI_ID]) ||
    w.workspaceName === 'Sample Workspace' ||
    w.workspaceName === '[Sample] Workspace' ||
    w.workspaceName === 'Delhi Civil Alliances Workspace'
  );
}

function getInitialStoreWorkspace(): {
  workspace: WorkspaceState;
  savedWorkspaces: WorkspaceState[];
  activeWorkbookId: string;
} {
  const isDeleted = isSampleDeletedPersisted() || memorySampleDeleted;
  const activeStored = loadActiveWorkspaceSync();
  let rawSaved = loadSavedWorkspacesList();
  if (rawSaved.length === 0 && activeStored) {
    rawSaved = [activeStored];
  }

  if (rawSaved && rawSaved.length > 0) {
    const migrated = rawSaved.map((w) => {
      const m = migrateToSchemaV2(w);
      if (m.workspaceName === 'Delhi Civil Alliances Workspace') {
        m.workspaceName = 'Sample Workspace';
      }
      if (m.workspaceId === 'ws_delhi_coalitions') {
        m.workspaceId = WORKSPACE_SAMPLE_ID;
      }
      if (m.workbooks[WORKBOOK_DELHI_ID] && m.workbooks[WORKBOOK_DELHI_ID].title === 'Delhi Youth Governance Exhibition') {
        m.workbooks[WORKBOOK_DELHI_ID].title = '[Sample] Delhi Youth Governance Exhibition';
      }
      return m;
    });

    const filtered = isDeleted ? migrated.filter((w) => !isSampleWorkspace(w)) : migrated;
    // Deduplicate by workspaceId
    const seen = new Set<string>();
    const deduplicated = filtered.filter((w) => {
      const id = w.workspaceId || '';
      if (id && seen.has(id)) return false;
      if (id) seen.add(id);
      return true;
    });

    if (deduplicated.length > 0) {
      let active = deduplicated[0];
      if (activeStored) {
        const found = deduplicated.find((w) => w.workspaceId === activeStored.workspaceId);
        if (found) {
          active = found;
        }
      }
      return {
        workspace: active,
        savedWorkspaces: deduplicated,
        activeWorkbookId: active.activeWorkbookId || Object.keys(active.workbooks)[0] || '',
      };
    }
  }

  if (isDeleted) {
    const emptyWs: WorkspaceState = migrateToSchemaV2({
      schemaVersion: 2,
      activeWorkbookId: '',
      workspaceId: 'ws_empty_start',
      workspaceName: 'New Workspace',
      entities: {},
      workbooks: {},
      placements: {},
      branches: {},
      workbookLinks: {},
      userDeletedSample: true,
    });
    return {
      workspace: emptyWs,
      savedWorkspaces: [emptyWs],
      activeWorkbookId: '',
    };
  }

  const seed: WorkspaceState = JSON.parse(JSON.stringify(seedDelhiNgoWorkspace));
  seed.workspaceId = WORKSPACE_SAMPLE_ID;
  seed.workspaceName = 'Sample Workspace';
  return {
    workspace: seed,
    savedWorkspaces: [seed],
    activeWorkbookId: seed.activeWorkbookId || WORKBOOK_DELHI_ID,
  };
}

const initialStoreState = getInitialStoreWorkspace();
const initialSeedWorkspace: WorkspaceState = initialStoreState.workspace;
const initialActiveWbId = initialStoreState.activeWorkbookId;
const initialMetrics = computeTopologyMetrics(initialSeedWorkspace, initialActiveWbId);
const initialYellowInDegrees = initialActiveWbId ? computeAllYellowInDegrees(initialSeedWorkspace, initialActiveWbId) : {};
const initialNodes = initialActiveWbId ? deriveFlowNodes(initialSeedWorkspace, initialActiveWbId, null, initialYellowInDegrees) : [];
const initialEdges = initialActiveWbId ? deriveFlowEdges(initialSeedWorkspace, initialActiveWbId, null, true) : [];

const defaultWorkspaceFilters: WorkspaceFilters = {
  branchTypes: ['green', 'white', 'yellow'],
  branchStatuses: ['tick', 'pending', 'cross'],
  minFundingPct: 0,
  nodeCategories: [],
  connectionFilter: 'all',
  connectedToPlacementIds: [],
};

function deriveStoreNodes(
  state: WorkspaceStoreState,
  overrideWs?: WorkspaceState | null,
  overridePlacementId?: string | null,
  overridePlacementIds?: string[],
  overrideYellowInDegrees?: Record<string, number>,
  overrideLockedPlacements?: string[],
  overrideIsolatedElement?: { type: 'node' | 'branch'; id: string } | null,
  overrideAlignment?: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft',
  overrideFilters?: WorkspaceFilters,
  overrideActiveWorkbookId?: string | null,
  overrideTheme?: 'dark' | 'night' | 'light'
): OrgFlowNode[] {
  const ws = overrideWs !== undefined ? overrideWs : state.workspace;
  const targetWbId =
    overrideActiveWorkbookId !== undefined
      ? overrideActiveWorkbookId
      : (overrideWs?.activeWorkbookId || state.activeWorkbookId);
  return deriveFlowNodes(
    ws,
    targetWbId,
    overridePlacementId !== undefined ? overridePlacementId : state.selectedPlacementId,
    overrideYellowInDegrees !== undefined ? overrideYellowInDegrees : state.yellowInDegrees,
    overridePlacementIds !== undefined
      ? overridePlacementIds
      : state.highlightedPlacementIds && state.highlightedPlacementIds.length > 0
      ? [...state.selectedPlacementIds, ...state.highlightedPlacementIds]
      : state.selectedPlacementIds,
    overrideLockedPlacements !== undefined ? overrideLockedPlacements : state.lockedPlacementIds,
    state.isWorkspaceLocked,
    overrideIsolatedElement !== undefined ? overrideIsolatedElement : state.isolatedElement,
    overrideAlignment !== undefined ? overrideAlignment : state.diagramAlignment,
    overrideFilters !== undefined ? overrideFilters : state.filters,
    overrideTheme !== undefined ? overrideTheme : state.theme
  );
}

function deriveStoreEdges(
  state: WorkspaceStoreState,
  overrideWs?: WorkspaceState | null,
  overrideBranchId?: string | null,
  overrideBranchIds?: string[],
  overrideShowDeclined?: boolean,
  overrideLockedBranches?: string[],
  overrideIsolatedElement?: { type: 'node' | 'branch'; id: string } | null,
  overrideTheme?: 'dark' | 'night' | 'light',
  overrideFilters?: WorkspaceFilters,
  overrideActiveWorkbookId?: string | null
): MultiplexFlowEdge[] {
  const ws = overrideWs !== undefined ? overrideWs : state.workspace;
  const targetWbId =
    overrideActiveWorkbookId !== undefined
      ? overrideActiveWorkbookId
      : (overrideWs?.activeWorkbookId || state.activeWorkbookId);
  return deriveFlowEdges(
    ws,
    targetWbId,
    overrideBranchId !== undefined ? overrideBranchId : state.selectedBranchId,
    overrideShowDeclined !== undefined ? overrideShowDeclined : state.showDeclined,
    overrideBranchIds !== undefined ? overrideBranchIds : state.selectedBranchIds,
    overrideLockedBranches !== undefined ? overrideLockedBranches : state.lockedBranchIds,
    state.isWorkspaceLocked,
    overrideIsolatedElement !== undefined ? overrideIsolatedElement : state.isolatedElement,
    overrideTheme !== undefined ? overrideTheme : state.theme,
    overrideFilters !== undefined ? overrideFilters : state.filters
  );
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspace: initialSeedWorkspace,
  savedWorkspaces: initialStoreState.savedWorkspaces,
  activeWorkbookId: initialActiveWbId,
  activeView: 'landing',
  setActiveView: (view: 'landing' | 'canvas') => set({ activeView: view }),
  isBookIndexOpen: true,
  toggleBookIndex: () => set((state) => ({ isBookIndexOpen: !state.isBookIndexOpen })),
  setBookIndexOpen: (open: boolean) => set({ isBookIndexOpen: open }),
  selectedPlacementId: null,
  selectedBranchId: null,
  selectedPlacementIds: [],
  selectedBranchIds: [],
  isHoldingB: false,
  setIsHoldingB: (holding: boolean) => set({ isHoldingB: holding }),
  lockedPlacementIds: [],
  lockedBranchIds: [],
  isWorkspaceLocked: false,
  isLoading: false,
  loadingMessage: '',
  setLoading: (loading: boolean, message = '') => set({ isLoading: loading, loadingMessage: message }),
  setIsLoading: (loading: boolean, message = '') => set({ isLoading: loading, loadingMessage: message }),
  selectionFilter: 'all',
  flowInstance: null,
  agentMutationNotification: null,

  theme: 'dark',
  highContrast: false,
  animationsEnabled: true,
  highPerformanceMode: false,
  isFullscreen: false,
  isDashboardMaximized: false,
  highlightedPlacementIds: [],
  isSearchOpen: false,
  searchFocusTrigger: 0,
  flashingPlacementId: null,
  toggleDashboardMaximized: () =>
    set((state) => ({ isDashboardMaximized: !state.isDashboardMaximized })),
  setDashboardMaximized: (maximized: boolean) => set({ isDashboardMaximized: maximized }),
  setHighlightedPlacements: (ids: string[]) => {
    set((state) => {
      const nextState = { ...state, highlightedPlacementIds: ids };
      return {
        highlightedPlacementIds: ids,
        nodes: deriveStoreNodes(nextState),
      };
    });
  },
  openSearch: () =>
    set((state) => ({
      activeView: 'canvas',
      isSearchOpen: true,
      searchFocusTrigger: state.searchFocusTrigger + 1,
    })),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleSearch: () =>
    set((state) => ({
      activeView: !state.isSearchOpen ? 'canvas' : state.activeView,
      isSearchOpen: !state.isSearchOpen,
      searchFocusTrigger: !state.isSearchOpen ? state.searchFocusTrigger + 1 : state.searchFocusTrigger,
    })),
  setFlashingPlacement: (placementId: string | null) => {
    set({ flashingPlacementId: placementId });
    if (placementId) {
      setTimeout(() => {
        if (useWorkspaceStore.getState().flashingPlacementId === placementId) {
          useWorkspaceStore.setState({ flashingPlacementId: null });
        }
      }, 3500);
    }
  },
  dashboardPosition: 'top',
  ribbonPosition: 'top',
  isRibbonPinned: true,
  diagramAlignment: 'bottomToTop',
  activeTool: 'pointer',
  isolatedElement: null,
  isolatedPlacementId: null,
  isInspectorDismissed: false,
  dismissedNotificationIds: [],

  undoStack: [],
  redoStack: [],

  showDeclined: true,
  filters: defaultWorkspaceFilters,
  isLayoutRunning: false,
  metrics: initialMetrics,
  yellowInDegrees: initialYellowInDegrees,
  nodes: initialNodes,
  edges: initialEdges,
  sectors: DEFAULT_SECTOR_CATEGORIES,
  dragConnectEnabled: true,
  isConnecting: false,
  connectingNodeId: null,
  connectingHandleId: null,

  pushHistory: (currentState: WorkspaceState) => {
    const { undoStack } = get();
    const clone = JSON.parse(JSON.stringify(currentState)) as WorkspaceState;
    const newStack = [...undoStack, clone].slice(-50);
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: async () => {
    const {
      undoStack,
      redoStack,
      workspace,
      activeWorkbookId,
    } = get();
    if (undoStack.length === 0 || !workspace) return;
    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const currentClone = JSON.parse(JSON.stringify(workspace)) as WorkspaceState;
    const newRedoStack = [...redoStack, currentClone].slice(-50);

    const targetWbId = activeWorkbookId ?? previousState.activeWorkbookId;
    const metrics = computeTopologyMetrics(previousState, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(previousState, targetWbId);

    const nodes = deriveStoreNodes(get(), previousState, null, [], yellowInDegrees);
    const edges = deriveStoreEdges(get(), previousState, null, []);

    set({
      workspace: previousState,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(previousState);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after undo:', err);
    }
  },

  redo: async () => {
    const {
      undoStack,
      redoStack,
      workspace,
      activeWorkbookId,
    } = get();
    if (redoStack.length === 0 || !workspace) return;
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const currentClone = JSON.parse(JSON.stringify(workspace)) as WorkspaceState;
    const newUndoStack = [...undoStack, currentClone].slice(-50);

    const targetWbId = activeWorkbookId ?? nextState.activeWorkbookId;
    const metrics = computeTopologyMetrics(nextState, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(nextState, targetWbId);

    const nodes = deriveStoreNodes(get(), nextState, null, [], yellowInDegrees);
    const edges = deriveStoreEdges(get(), nextState, null, []);

    set({
      workspace: nextState,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(nextState);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after redo:', err);
    }
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  toggleLockPlacement: (placementId: string) => {
    const {
      lockedPlacementIds,
      workspace,
      selectedPlacementId,
      yellowInDegrees,
      selectedPlacementIds,
    } = get();
    const isCurrentlyLocked = lockedPlacementIds.includes(placementId);
    const newLocked = isCurrentlyLocked
      ? lockedPlacementIds.filter((id) => id !== placementId)
      : [...lockedPlacementIds, placementId];

    const nodes = deriveStoreNodes(get(), workspace, selectedPlacementId, selectedPlacementIds, yellowInDegrees, newLocked);
    set({ lockedPlacementIds: newLocked, nodes });
  },

  toggleLockBranch: (branchId: string) => {
    const {
      lockedBranchIds,
      workspace,
      selectedBranchId,
      showDeclined,
      selectedBranchIds,
    } = get();
    const isCurrentlyLocked = lockedBranchIds.includes(branchId);
    const newLocked = isCurrentlyLocked
      ? lockedBranchIds.filter((id) => id !== branchId)
      : [...lockedBranchIds, branchId];

    const edges = deriveStoreEdges(get(), workspace, selectedBranchId, selectedBranchIds, showDeclined, newLocked);
    set({ lockedBranchIds: newLocked, edges });
  },

  toggleLockSelected: () => {
    const {
      selectedPlacementId,
      selectedBranchId,
      selectedPlacementIds,
      selectedBranchIds,
      toggleLockPlacement,
      toggleLockBranch,
      batchLock,
    } = get();
    if (selectedPlacementIds.length + selectedBranchIds.length > 1) {
      batchLock();
      return;
    }
    if (selectedPlacementId) {
      toggleLockPlacement(selectedPlacementId);
      return;
    }
    if (selectedBranchId) {
      toggleLockBranch(selectedBranchId);
      return;
    }
    if (selectedPlacementIds.length === 1) {
      toggleLockPlacement(selectedPlacementIds[0]);
      return;
    }
    if (selectedBranchIds.length === 1) {
      toggleLockBranch(selectedBranchIds[0]);
      return;
    }
  },

  toggleWorkspaceLock: () => {
    const { isWorkspaceLocked } = get();
    const nextLocked = !isWorkspaceLocked;
    const stateWithNextLock = { ...get(), isWorkspaceLocked: nextLocked };
    const nodes = deriveStoreNodes(stateWithNextLock);
    const edges = deriveStoreEdges(stateWithNextLock);
    set({ isWorkspaceLocked: nextLocked, nodes, edges });
  },

  isPlacementLocked: (placementId: string) => {
    const { isWorkspaceLocked, lockedPlacementIds } = get();
    return isWorkspaceLocked || lockedPlacementIds.includes(placementId);
  },

  isBranchLocked: (branchId: string) => {
    const { isWorkspaceLocked, lockedBranchIds } = get();
    return isWorkspaceLocked || lockedBranchIds.includes(branchId);
  },

  batchLock: (lock?: boolean) => {
    const {
      selectedPlacementIds,
      selectedBranchIds,
      lockedPlacementIds,
      lockedBranchIds,
      workspace,
      selectedPlacementId,
      selectedBranchId,
      showDeclined,
      yellowInDegrees,
    } = get();
    const anyUnlocked =
      selectedPlacementIds.some((id) => !lockedPlacementIds.includes(id)) ||
      selectedBranchIds.some((id) => !lockedBranchIds.includes(id));
    const shouldLock = lock !== undefined ? lock : anyUnlocked;

    let nextLockedPlacements = [...lockedPlacementIds];
    let nextLockedBranches = [...lockedBranchIds];

    if (shouldLock) {
      for (const id of selectedPlacementIds) {
        if (!nextLockedPlacements.includes(id)) nextLockedPlacements.push(id);
      }
      for (const id of selectedBranchIds) {
        if (!nextLockedBranches.includes(id)) nextLockedBranches.push(id);
      }
    } else {
      nextLockedPlacements = nextLockedPlacements.filter(
        (id) => !selectedPlacementIds.includes(id)
      );
      nextLockedBranches = nextLockedBranches.filter((id) => !selectedBranchIds.includes(id));
    }

    const nodes = deriveStoreNodes(get(), workspace, selectedPlacementId, selectedPlacementIds, yellowInDegrees, nextLockedPlacements);
    const edges = deriveStoreEdges(get(), workspace, selectedBranchId, selectedBranchIds, showDeclined, nextLockedBranches);

    set({
      lockedPlacementIds: nextLockedPlacements,
      lockedBranchIds: nextLockedBranches,
      nodes,
      edges,
    });
  },

  toggleSelectPlacement: (placementId: string) => {
    const { workspace, selectedPlacementIds, isolatedElement, activeWorkbookId } = get();
    if (!workspace) return;

    // Feature 2: In isolation mode, dimmed nodes cannot be selected
    if (isolatedElement && isPlacementDimmedInIsolation(placementId, isolatedElement, workspace.branches, activeWorkbookId || undefined)) {
      return;
    }

    const exists = selectedPlacementIds.includes(placementId);
    const nextSelectedPlacementIds = exists
      ? selectedPlacementIds.filter((id) => id !== placementId)
      : [...selectedPlacementIds, placementId];

    const nextSelectedPlacementId =
      nextSelectedPlacementIds.length === 1 ? nextSelectedPlacementIds[0] : null;

    const nodes = deriveStoreNodes(
      get(),
      workspace,
      nextSelectedPlacementId,
      nextSelectedPlacementIds
    );
    const edges = deriveStoreEdges(get(), workspace, null, []);

    set({
      selectedPlacementId: nextSelectedPlacementId,
      selectedPlacementIds: nextSelectedPlacementIds,
      selectedBranchId: null,
      selectedBranchIds: [],
      nodes,
      edges,
    });
  },

  setSelection: (placementIds: string[], branchIds: string[]) => {
    const { workspace, isolatedElement, activeWorkbookId } = get();
    let finalPlacementIds = placementIds;
    let finalBranchIds = branchIds;

    // Feature 2: In isolation mode, strictly filter out any dimmed nodes or branches
    if (isolatedElement && workspace) {
      const filtered = filterSelectionByIsolation(
        { placementIds, branchIds },
        isolatedElement,
        workspace.branches,
        activeWorkbookId || undefined
      );
      finalPlacementIds = filtered.placementIds;
      finalBranchIds = filtered.branchIds;
    }

    const nextSelectedPlacementId =
      finalPlacementIds.length === 1 ? finalPlacementIds[0] : null;
    const nextSelectedBranchId =
      finalBranchIds.length === 1 ? finalBranchIds[0] : null;

    const nodes = deriveStoreNodes(get(), workspace, nextSelectedPlacementId, finalPlacementIds);
    const edges = deriveStoreEdges(get(), workspace, nextSelectedBranchId, finalBranchIds);
    set({
      selectedPlacementId: nextSelectedPlacementId,
      selectedBranchId: nextSelectedBranchId,
      selectedPlacementIds: finalPlacementIds,
      selectedBranchIds: finalBranchIds,
      nodes,
      edges,
    });
  },

  setSelectionFilter: (filter: 'all' | 'nodes' | 'branches') => {
    set({ selectionFilter: filter });
  },

  batchDelete: async () => {
    const {
      workspace,
      activeWorkbookId,
      selectedPlacementIds,
      selectedBranchIds,
      lockedPlacementIds,
      lockedBranchIds,
      isWorkspaceLocked,
    } = get();
    if (!workspace || isWorkspaceLocked) return;

    const branchesToDelete = selectedBranchIds.filter((bId) => !lockedBranchIds.includes(bId));
    const placementsToDelete = selectedPlacementIds.filter((pId) => {
      const p = workspace.placements[pId];
      return p && !p.isRootNgo && !lockedPlacementIds.includes(pId);
    });

    if (branchesToDelete.length === 0 && placementsToDelete.length === 0) return;

    get().pushHistory(workspace);

    const updatedBranches = { ...workspace.branches };
    for (const bId of branchesToDelete) {
      delete updatedBranches[bId];
    }

    const updatedPlacements = { ...workspace.placements };
    for (const pId of placementsToDelete) {
      delete updatedPlacements[pId];
      for (const [bId, b] of Object.entries(updatedBranches)) {
        if (b.sourcePlacementId === pId || b.targetPlacementId === pId) {
          delete updatedBranches[bId];
        }
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      placements: updatedPlacements,
      branches: updatedBranches,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, null, [], yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, null, []);

    set({
      workspace: updatedWorkspace,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after batch delete:', err);
    }
  },

  batchSetBranchStatus: async (status: BranchStatus) => {
    const {
      workspace,
      activeWorkbookId,
      selectedBranchIds,
      lockedBranchIds,
      isWorkspaceLocked,
      selectedPlacementIds,
    } = get();
    if (!workspace || isWorkspaceLocked) return;

    const branchesToUpdate = selectedBranchIds.filter((bId) => !lockedBranchIds.includes(bId));
    if (branchesToUpdate.length === 0) return;

    get().pushHistory(workspace);

    const updatedBranches = { ...workspace.branches };
    for (const bId of branchesToUpdate) {
      if (updatedBranches[bId]) {
        updatedBranches[bId] = {
          ...updatedBranches[bId],
          status,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      branches: updatedBranches,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, null, selectedPlacementIds, yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, null, selectedBranchIds);

    set({
      workspace: updatedWorkspace,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after batch status change:', err);
    }
  },

  batchSetCategory: async (category: EntityCategory) => {
    const {
      workspace,
      activeWorkbookId,
      selectedPlacementIds,
      lockedPlacementIds,
      isWorkspaceLocked,
      selectedBranchIds,
    } = get();
    if (!workspace || isWorkspaceLocked) return;

    const placementsToUpdate = selectedPlacementIds.filter(
      (pId) => !lockedPlacementIds.includes(pId)
    );
    if (placementsToUpdate.length === 0) return;

    get().pushHistory(workspace);

    const updatedEntities = { ...workspace.entities };
    for (const pId of placementsToUpdate) {
      const p = workspace.placements[pId];
      if (p && updatedEntities[p.entityId]) {
        updatedEntities[p.entityId] = {
          ...updatedEntities[p.entityId],
          category,
        };
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      entities: updatedEntities,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, null, selectedPlacementIds, yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, null, selectedBranchIds);

    set({
      workspace: updatedWorkspace,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after batch category change:', err);
    }
  },

  batchAppendNotes: async (notes: string) => {
    const trimmed = notes.trim();
    if (!trimmed) return;
    const {
      workspace,
      activeWorkbookId,
      selectedPlacementIds,
      selectedBranchIds,
      lockedPlacementIds,
      lockedBranchIds,
      isWorkspaceLocked,
    } = get();
    if (!workspace || isWorkspaceLocked) return;

    get().pushHistory(workspace);

    const updatedEntities = { ...workspace.entities };
    for (const pId of selectedPlacementIds) {
      if (lockedPlacementIds.includes(pId)) continue;
      const p = workspace.placements[pId];
      if (p && updatedEntities[p.entityId]) {
        const prev = updatedEntities[p.entityId].globalNotes;
        updatedEntities[p.entityId] = {
          ...updatedEntities[p.entityId],
          globalNotes: prev ? `${prev}\n${trimmed}` : trimmed,
        };
      }
    }

    const updatedBranches = { ...workspace.branches };
    for (const bId of selectedBranchIds) {
      if (lockedBranchIds.includes(bId)) continue;
      const b = updatedBranches[bId];
      if (b) {
        const prev = b.note;
        updatedBranches[bId] = {
          ...b,
          note: prev ? `${prev} · ${trimmed}` : trimmed,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      entities: updatedEntities,
      branches: updatedBranches,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, null, selectedPlacementIds, yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, null, selectedBranchIds);

    set({
      workspace: updatedWorkspace,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after batch append notes:', err);
    }
  },

  setTheme: (theme: 'dark' | 'night' | 'light') => {
    const nextState = { ...get(), theme };
    const nodes = deriveStoreNodes(nextState);
    const edges = deriveStoreEdges(nextState);
    set({ theme, nodes, edges });
  },

  setDashboardPosition: (pos: 'top' | 'bottom' | 'left' | 'right') => {
    set({ dashboardPosition: pos });
  },

  setRibbonPosition: (pos: 'top' | 'bottom' | 'left' | 'right') => {
    set({ ribbonPosition: pos });
  },

  setIsRibbonPinned: (pinned: boolean) => {
    set({ isRibbonPinned: pinned });
  },

  toggleRibbonPinned: () => {
    set((state) => ({ isRibbonPinned: !state.isRibbonPinned }));
  },

  setDiagramAlignment: (align: 'bottomToTop' | 'topToBottom' | 'leftToRight' | 'rightToLeft') => {
    const nodes = deriveStoreNodes(get(), undefined, undefined, undefined, undefined, undefined, undefined, align);
    set({ diagramAlignment: align, nodes });
  },

  setActiveTool: (tool: 'pointer' | 'hand') => {
    set({ activeTool: tool });
  },

  enterIsolationMode: (type: 'node' | 'branch', id: string) => {
    const isolatedElement = { type, id };
    const isolatedPlacementId = type === 'node' ? id : null;
    const nodes = deriveStoreNodes(get(), undefined, undefined, undefined, undefined, undefined, isolatedElement);
    const edges = deriveStoreEdges(get(), undefined, undefined, undefined, undefined, undefined, isolatedElement);
    set({ isolatedElement, isolatedPlacementId, nodes, edges });
  },

  exitIsolationMode: () => {
    const nodes = deriveStoreNodes(get(), undefined, undefined, undefined, undefined, undefined, null);
    const edges = deriveStoreEdges(get(), undefined, undefined, undefined, undefined, undefined, null);
    set({ isolatedElement: null, isolatedPlacementId: null, nodes, edges });
  },

  setIsInspectorDismissed: (dismissed: boolean) => {
    set({ isInspectorDismissed: dismissed });
  },

  dismissNotification: (id: string) => {
    set((state) => ({
      dismissedNotificationIds: state.dismissedNotificationIds.includes(id)
        ? state.dismissedNotificationIds
        : [...state.dismissedNotificationIds, id],
    }));
  },

  clearDismissedNotifications: () => {
    set({ dismissedNotificationIds: [] });
  },

  toggleHighContrast: () => {
    set((state) => ({ highContrast: !state.highContrast }));
  },

  toggleAnimations: () => {
    set((state) => ({ animationsEnabled: !state.animationsEnabled }));
  },

  toggleHighPerformance: () => {
    set((state) => ({ highPerformanceMode: !state.highPerformanceMode }));
  },

  setIsFullscreen: (isFullscreen: boolean) => {
    set({ isFullscreen });
  },

  setFlowInstance: (instance: any | null) => {
    set({ flowInstance: instance });
  },

  fitView: () => {
    const { flowInstance } = get();
    if (flowInstance && typeof flowInstance.fitView === 'function') {
      flowInstance.fitView({ duration: 300, padding: 0.1 });
    }
  },

  resetZoom: () => {
    const { flowInstance } = get();
    if (flowInstance && typeof flowInstance.zoomTo === 'function') {
      flowInstance.zoomTo(1.0, { duration: 300 });
    }
  },

  setConnecting: (isConnecting: boolean, nodeId?: string | null, handleId?: string | null) => {
    set({
      isConnecting,
      connectingNodeId: isConnecting ? (nodeId ?? null) : null,
      connectingHandleId: isConnecting ? (handleId ?? null) : null,
    });
  },

  setDragConnectEnabled: (enabled: boolean) => {
    set({ dragConnectEnabled: enabled });
  },

  toggleDragConnect: () => {
    set((state) => ({ dragConnectEnabled: !state.dragConnectEnabled }));
  },

  onConnect: async (connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => {
    const { dragConnectEnabled, addBranch, connectingNodeId, connectingHandleId } = get();
    if (!dragConnectEnabled) return;
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    let branchType: BranchType = 'white';
    // Prioritize the handle where the user initiated the drag
    const startHandle = (connectingHandleId || connection.sourceHandle || '').toLowerCase();
    const endHandle = (connection.targetHandle || '').toLowerCase();
    const allHandles = `${startHandle} ${endHandle}`;

    if (startHandle.includes('green')) {
      branchType = 'green';
    } else if (startHandle.includes('yellow')) {
      branchType = 'yellow';
    } else if (startHandle.includes('white')) {
      branchType = 'white';
    } else if (allHandles.includes('green')) {
      branchType = 'green';
    } else if (allHandles.includes('yellow')) {
      branchType = 'yellow';
    } else if (allHandles.includes('white')) {
      branchType = 'white';
    }

    // Determine actual source and target placement IDs respecting drag origin
    let sourceId = connection.source;
    let targetId = connection.target;
    if (connectingNodeId && connectingNodeId === connection.target && connectingNodeId !== connection.source) {
      sourceId = connection.target;
      targetId = connection.source;
    }

    try {
      await addBranch(
        sourceId,
        targetId,
        branchType,
        'tick',
        branchType === 'green' ? 10 : undefined
      );
    } catch (err) {
      console.warn('[useWorkspaceStore] onConnect failed:', err);
    }
  },

  addSector: (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return '';
    const id =
      trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      generateId();
    const existing = get().sectors.find(
      (s) => s.id === id || s.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return existing.id;
    }
    const newSector: SectorCategoryItem = { id, label: trimmed };
    set((state) => ({ sectors: [...state.sectors, newSector] }));
    return id;
  },

  updateSector: async (id: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const { sectors, workspace } = get();
    const updatedSectors = sectors.map((s) => (s.id === id ? { ...s, label: trimmed } : s));
    set({ sectors: updatedSectors });

    if (workspace) {
      // Re-derive flow nodes so badges update their label immediately
      const nodes = deriveStoreNodes(get(), workspace);
      set({ nodes });
      try {
        await getWorkspaceRepository().saveWorkspace(workspace);
      } catch (err) {
        console.warn('[useWorkspaceStore] Failed to save workspace after sector update:', err);
      }
    }
  },

  deleteSector: async (id: string) => {
    const { sectors, workspace } = get();
    const updatedSectors = sectors.filter((s) => s.id !== id);
    set({ sectors: updatedSectors });

    if (workspace) {
      const fallbackCategory = updatedSectors.some((s) => s.id === 'other')
        ? 'other'
        : updatedSectors[0]?.id || 'other';

      let changed = false;
      const updatedEntities = { ...workspace.entities };
      for (const [k, ent] of Object.entries(updatedEntities)) {
        if (ent.category === id) {
          updatedEntities[k] = { ...ent, category: fallbackCategory as EntityCategory };
          changed = true;
        }
      }
      if (changed) {
        const updatedWs: WorkspaceState = { ...workspace, entities: updatedEntities };
        try {
          await getWorkspaceRepository().saveWorkspace(updatedWs);
        } catch (err) {
          console.warn('[useWorkspaceStore] Failed to save workspace after sector deletion:', err);
        }
        const nodes = deriveStoreNodes(get(), updatedWs);
        set({ workspace: updatedWs, nodes });
      }
    }
  },

  resetSectors: () => {
    set({ sectors: DEFAULT_SECTOR_CATEGORIES });
  },

  init: async () => {
    const repo = getWorkspaceRepository();
    let ws = await repo.loadWorkspace();
    const storedSampleDeleted = isSampleDeletedPersisted();
    const isSampleWsDeleted = memorySampleDeleted || storedSampleDeleted;
    if (isSampleWsDeleted) {
      memorySampleDeleted = true;
    }

    let rawSaved = loadSavedWorkspacesList();
    if (rawSaved.length === 0 && ws) {
      rawSaved = [ws];
    }

    let sanitized = rawSaved
      .map((w) => {
        const mig = migrateToSchemaV2(w);
        if (
          mig.workspaceName === 'Delhi Civil Alliances Workspace' ||
          mig.workspaceId === 'ws_delhi_coalitions'
        ) {
          mig.workspaceName = 'Sample Workspace';
          mig.workspaceId = WORKSPACE_SAMPLE_ID;
        }
        if (mig.workbooks[WORKBOOK_DELHI_ID] && mig.workbooks[WORKBOOK_DELHI_ID].title === 'Delhi Youth Governance Exhibition') {
          mig.workbooks[WORKBOOK_DELHI_ID].title = '[Sample] Delhi Youth Governance Exhibition';
        }
        if (mig.userDeletedSample && mig.workbooks[WORKBOOK_DELHI_ID]) {
          delete mig.workbooks[WORKBOOK_DELHI_ID];
        }
        return mig;
      })
      .filter((w) => {
        if (!isSampleWsDeleted) return true;
        return !isSampleWorkspace(w);
      });

    // Deduplicate saved workspaces by workspaceId
    const seenSaved = new Set<string>();
    sanitized = sanitized.filter((w) => {
      const id = w.workspaceId || '';
      if (id && seenSaved.has(id)) return false;
      if (id) seenSaved.add(id);
      return true;
    });

    if (ws) {
      ws = migrateToSchemaV2(ws);
      if (
        ws.workspaceName === 'Delhi Civil Alliances Workspace' ||
        ws.workspaceId === 'ws_delhi_coalitions'
      ) {
        ws.workspaceName = 'Sample Workspace';
        ws.workspaceId = WORKSPACE_SAMPLE_ID;
      }
      if (ws.workbooks[WORKBOOK_DELHI_ID] && ws.workbooks[WORKBOOK_DELHI_ID].title === 'Delhi Youth Governance Exhibition') {
        ws.workbooks[WORKBOOK_DELHI_ID].title = '[Sample] Delhi Youth Governance Exhibition';
      }
      if (ws.userDeletedSample && ws.workbooks[WORKBOOK_DELHI_ID]) {
        delete ws.workbooks[WORKBOOK_DELHI_ID];
      }
      if (isSampleWsDeleted && isSampleWorkspace(ws)) {
        ws = null;
      }
    }

    if (!ws) {
      if (sanitized.length > 0) {
        ws = sanitized[0];
      } else if (isSampleWsDeleted) {
        ws = migrateToSchemaV2({
          schemaVersion: 2,
          activeWorkbookId: '',
          workspaceId: 'ws_empty_start',
          workspaceName: 'New Workspace',
          entities: {},
          workbooks: {},
          placements: {},
          branches: {},
          workbookLinks: {},
          userDeletedSample: true,
        });
        sanitized = [ws];
      } else {
        const initialWs: WorkspaceState = JSON.parse(JSON.stringify(seedDelhiNgoWorkspace));
        initialWs.workspaceId = initialWs.workspaceId || WORKSPACE_SAMPLE_ID;
        initialWs.workspaceName = initialWs.workspaceName || 'Sample Workspace';
        ws = initialWs;
        sanitized = [initialWs];
      }
    } else {
      const activeIdx = sanitized.findIndex((w) => w.workspaceId === ws!.workspaceId);
      if (activeIdx >= 0) {
        sanitized[activeIdx] = ws;
      } else {
        sanitized.unshift(ws);
      }
    }

    const activeWs: WorkspaceState = ws!;
    const wbKeys = Object.keys(activeWs.workbooks);
    const activeWbId = (activeWs.activeWorkbookId && activeWs.workbooks[activeWs.activeWorkbookId])
      ? activeWs.activeWorkbookId
      : (wbKeys.length > 0 ? wbKeys[0] : '');

    const metrics = computeTopologyMetrics(activeWs, activeWbId);
    const yellowInDegrees = activeWbId ? computeAllYellowInDegrees(activeWs, activeWbId) : {};
    const showDeclined = true;

    const nodes = activeWbId ? deriveStoreNodes(get(), activeWs, null, [], yellowInDegrees) : [];
    const edges = activeWbId ? deriveStoreEdges(get(), activeWs, null, [], showDeclined) : [];

    // Discover any custom entity categories from loaded workspace into sectors
    const currentSectors = get().sectors;
    const knownIds = new Set(currentSectors.map((s) => s.id));
    const extraSectors: SectorCategoryItem[] = [];
    if (activeWs) {
      for (const ent of Object.values(activeWs.entities)) {
        if (ent.category && !knownIds.has(ent.category)) {
          knownIds.add(ent.category);
          extraSectors.push({
            id: ent.category,
            label: ent.category.charAt(0).toUpperCase() + ent.category.slice(1),
          });
        }
      }
    }
    const finalSectors = extraSectors.length > 0 ? [...currentSectors, ...extraSectors] : currentSectors;

    const activeWb = activeWbId ? activeWs.workbooks[activeWbId] : null;
    const agentMutationNotification = activeWb?.lastAgentMutation || null;

    saveSavedWorkspacesList(sanitized);
    try {
      await repo.saveWorkspace(activeWs);
    } catch (err) {
      console.warn('[useWorkspaceStore] init repository save skipped or failed:', err);
    }

    set({
      workspace: activeWs,
      savedWorkspaces: sanitized,
      activeWorkbookId: activeWbId,
      selectedPlacementId: null,
      selectedBranchId: null,
      showDeclined,
      isLayoutRunning: false,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
      sectors: finalSectors,
      agentMutationNotification,
    });
  },

  selectPlacement: (id: string | null, forceMulti?: boolean) => {
    const { workspace, isHoldingB, isolatedElement, activeWorkbookId } = get();
    if (!workspace) return;

    // Feature 2: In isolation mode, dimmed nodes cannot be selected
    if (id && isolatedElement && isPlacementDimmedInIsolation(id, isolatedElement, workspace.branches, activeWorkbookId || undefined)) {
      return;
    }

    if (id && (isHoldingB || forceMulti)) {
      get().toggleSelectPlacement(id);
      return;
    }

    const newPlacementId = id;
    const newBranchId = id ? null : get().selectedBranchId;
    const selectedPlacementIds = id ? [id] : [];
    const nodes = deriveStoreNodes(get(), workspace, newPlacementId, selectedPlacementIds);
    const edges = deriveStoreEdges(get(), workspace, newBranchId, []);
    set({
      selectedPlacementId: newPlacementId,
      selectedBranchId: newBranchId,
      selectedPlacementIds,
      selectedBranchIds: [],
      nodes,
      edges,
    });
  },

  selectBranch: (id: string | null) => {
    const { workspace } = get();
    const newBranchId = id;
    const newPlacementId = id ? null : get().selectedPlacementId;
    const selectedBranchIds = id ? [id] : [];
    const nodes = deriveStoreNodes(get(), workspace, newPlacementId, []);
    const edges = deriveStoreEdges(get(), workspace, newBranchId, selectedBranchIds);
    set({
      selectedBranchId: newBranchId,
      selectedPlacementId: newPlacementId,
      selectedPlacementIds: [],
      selectedBranchIds,
      nodes,
      edges,
    });
  },

  clearSelection: () => {
    const { workspace } = get();
    const nodes = deriveStoreNodes(get(), workspace, null, []);
    const edges = deriveStoreEdges(get(), workspace, null, []);
    set({
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      nodes,
      edges,
    });
  },

  toggleShowDeclined: () => {
    const { showDeclined, filters } = get();
    const nextShowDeclined = !showDeclined;
    const nextStatuses = nextShowDeclined
      ? Array.from(new Set([...filters.branchStatuses, 'cross' as const]))
      : filters.branchStatuses.filter((s) => s !== 'cross');
    const nextFilters = { ...filters, branchStatuses: nextStatuses };
    const edges = deriveStoreEdges({ ...get(), showDeclined: nextShowDeclined, filters: nextFilters });
    set({ showDeclined: nextShowDeclined, filters: nextFilters, edges });
  },

  setFilters: (newFilters: Partial<WorkspaceFilters>) => {
    const current = get().filters;
    const merged: WorkspaceFilters = { ...current, ...newFilters };
    const nextShowDeclined = merged.branchStatuses.includes('cross');
    const stateWithFilters = { ...get(), filters: merged, showDeclined: nextShowDeclined };
    const nodes = deriveStoreNodes(stateWithFilters);
    const edges = deriveStoreEdges(stateWithFilters);
    let nextSelectedPlacementId = get().selectedPlacementId;
    if (nextSelectedPlacementId && !nodes.some((n) => n.id === nextSelectedPlacementId)) {
      nextSelectedPlacementId = null;
    }
    let nextSelectedBranchId = get().selectedBranchId;
    if (nextSelectedBranchId && !edges.some((e) => e.id === nextSelectedBranchId)) {
      nextSelectedBranchId = null;
    }
    const nextSelectedPlacementIds = get().selectedPlacementIds.filter((id) =>
      nodes.some((n) => n.id === id)
    );
    const nextSelectedBranchIds = get().selectedBranchIds.filter((id) =>
      edges.some((e) => e.id === id)
    );
    set({
      filters: merged,
      showDeclined: nextShowDeclined,
      selectedPlacementId: nextSelectedPlacementId,
      selectedBranchId: nextSelectedBranchId,
      selectedPlacementIds: nextSelectedPlacementIds,
      selectedBranchIds: nextSelectedBranchIds,
      nodes,
      edges,
    });
  },

  resetFilters: () => {
    const defaultFilters: WorkspaceFilters = {
      branchTypes: ['green', 'white', 'yellow'],
      branchStatuses: ['tick', 'pending', 'cross'],
      minFundingPct: 0,
      nodeCategories: [],
      connectionFilter: 'all',
    };
    const stateWithFilters = { ...get(), filters: defaultFilters, showDeclined: true };
    const nodes = deriveStoreNodes(stateWithFilters);
    const edges = deriveStoreEdges(stateWithFilters);
    set({ filters: defaultFilters, showDeclined: true, nodes, edges });
  },

  onNodesChange: (changes: NodeChange[]) => {
    const { isolatedElement, workspace, activeWorkbookId } = get();
    let sanitizedChanges = changes;

    // Feature 2: In isolation mode, ensure React Flow select changes never set selected: true on dimmed nodes
    if (isolatedElement && workspace) {
      sanitizedChanges = changes.map((ch) => {
        if (ch.type === 'select' && ch.selected) {
          const isDimmed = isPlacementDimmedInIsolation(
            ch.id,
            isolatedElement,
            workspace.branches,
            activeWorkbookId || undefined
          );
          if (isDimmed) {
            return { ...ch, selected: false };
          }
        }
        return ch;
      });
    }

    const currentNodes = get().nodes;
    const updatedNodes = applyNodeChanges(sanitizedChanges, currentNodes) as OrgFlowNode[];
    set({ nodes: updatedNodes });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const currentEdges = get().edges;
    const updatedEdges = applyEdgeChanges(changes, currentEdges) as MultiplexFlowEdge[];
    set({ edges: updatedEdges });
  },

  onNodeDragStop: async (
    placementId: string,
    position: { x: number; y: number },
    allMovedNodes?: Array<{ id: string; position: { x: number; y: number } }>
  ) => {
    const {
      workspace,
      lockedPlacementIds,
      isWorkspaceLocked,
      selectedPlacementIds,
    } = get();
    if (!workspace || isWorkspaceLocked) return;
    if (lockedPlacementIds.includes(placementId)) return;
    const placement = workspace.placements[placementId];
    if (!placement) return;

    get().pushHistory(workspace);

    const updatedPlacements: Record<string, Placement> = {
      ...workspace.placements,
    };

    const isMultiDrag = selectedPlacementIds.includes(placementId) && selectedPlacementIds.length > 1;

    if (allMovedNodes && allMovedNodes.length > 1) {
      // 1. Explicit multi-node positions passed from React Flow drag stop
      const movedSet = new Set<string>();
      for (const moved of allMovedNodes) {
        movedSet.add(moved.id);
        if (!lockedPlacementIds.includes(moved.id) && updatedPlacements[moved.id]) {
          updatedPlacements[moved.id] = {
            ...updatedPlacements[moved.id],
            x: moved.position.x,
            y: moved.position.y,
          };
        }
      }
      // Also ensure any collectively selected node not explicitly in allMovedNodes moves by the same delta
      if (isMultiDrag) {
        const dx = position.x - placement.x;
        const dy = position.y - placement.y;
        for (const pId of selectedPlacementIds) {
          if (!movedSet.has(pId) && !lockedPlacementIds.includes(pId) && updatedPlacements[pId]) {
            updatedPlacements[pId] = {
              ...updatedPlacements[pId],
              x: updatedPlacements[pId].x + dx,
              y: updatedPlacements[pId].y + dy,
            };
          }
        }
      }
    } else if (isMultiDrag) {
      // 2. Multi-selection delta calculation (e.g. headless tests or single node drag event with multi-selection)
      const dx = position.x - placement.x;
      const dy = position.y - placement.y;
      for (const pId of selectedPlacementIds) {
        if (!lockedPlacementIds.includes(pId) && updatedPlacements[pId]) {
          updatedPlacements[pId] = {
            ...updatedPlacements[pId],
            x: pId === placementId ? position.x : updatedPlacements[pId].x + dx,
            y: pId === placementId ? position.y : updatedPlacements[pId].y + dy,
          };
        }
      }
    } else {
      // 3. Single node drag drop
      updatedPlacements[placementId] = {
        ...placement,
        x: position.x,
        y: position.y,
      };

      // Filter to active workbook placements only for high-performance collision resolution
      const activeWbPlacements: Record<string, Placement> = {};
      for (const [id, p] of Object.entries(updatedPlacements)) {
        if (p.workbookId === placement.workbookId) {
          activeWbPlacements[id] = p;
        }
      }

      // Resolve local collisions with 24px margin while keeping the dropped placement strictly anchored
      const { positions } = resolveLocalCollisions(activeWbPlacements, placementId, 24);

      for (const [id, pos] of Object.entries(positions)) {
        if (updatedPlacements[id]) {
          updatedPlacements[id] = {
            ...updatedPlacements[id],
            x: pos.x,
            y: pos.y,
          };
        }
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      placements: updatedPlacements,
    };

    const nodes = deriveStoreNodes(get(), updatedWorkspace);
    const edges = deriveStoreEdges(get(), updatedWorkspace);

    set({
      workspace: updatedWorkspace,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after node drag:', err);
    }
  },

  setBranchStatus: async (branchId: string, status: BranchStatus) => {
    const {
      workspace,
      activeWorkbookId,
      lockedBranchIds,
      isWorkspaceLocked,
    } = get();
    if (!workspace || isWorkspaceLocked || lockedBranchIds.includes(branchId)) return;
    const branch = workspace.branches[branchId];
    if (!branch) return;

    get().pushHistory(workspace);

    const updatedBranches: Record<string, Branch> = {
      ...workspace.branches,
      [branchId]: {
        ...branch,
        status,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      branches: updatedBranches,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace);
    const edges = deriveStoreEdges(get(), updatedWorkspace);

    set({
      workspace: updatedWorkspace,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after branch status change:', err);
    }
  },

  tidyUpLayout: async () => {
    const {
      workspace,
      activeWorkbookId,
      isWorkspaceLocked,
      diagramAlignment,
    } = get();
    if (!workspace || isWorkspaceLocked) return;

    get().pushHistory(workspace);
    set({ isLayoutRunning: true });
    try {
      const dirMap: Record<string, 'UP' | 'DOWN' | 'RIGHT' | 'LEFT'> = {
        bottomToTop: 'UP',
        topToBottom: 'DOWN',
        leftToRight: 'RIGHT',
        rightToLeft: 'LEFT',
      };
      const elkDir = dirMap[diagramAlignment] || 'UP';

      const newPositions = await computeHierarchicalLayout(
        workspace.placements,
        workspace.branches,
        activeWorkbookId ?? undefined,
        elkDir
      );

      const updatedPlacements: Record<string, Placement> = { ...workspace.placements };
      for (const [id, pos] of Object.entries(newPositions)) {
        if (updatedPlacements[id]) {
          updatedPlacements[id] = {
            ...updatedPlacements[id],
            x: pos.x,
            y: pos.y,
          };
        }
      }

      const updatedWorkspace: WorkspaceState = {
        ...workspace,
        placements: updatedPlacements,
      };

      const nodes = deriveStoreNodes(get(), updatedWorkspace);
      const edges = deriveStoreEdges(get(), updatedWorkspace);

      set({
        workspace: updatedWorkspace,
        nodes,
        edges,
        isLayoutRunning: false,
      });

      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Tidy up layout failed:', err);
      set({ isLayoutRunning: false });
    }
  },

  resetToDelhiSeed: async () => {
    memorySampleDeleted = false;
    setSampleDeletedPersisted(false);
    const { workspace } = get();
    if (workspace) {
      get().pushHistory(workspace);
    }
    const cloned: WorkspaceState = JSON.parse(JSON.stringify(seedDelhiNgoWorkspace));
    cloned.workspaceId = WORKSPACE_SAMPLE_ID;
    cloned.workspaceName = 'Sample Workspace';
    const repo = getWorkspaceRepository();
    try {
      await repo.saveWorkspace(cloned);
    } catch (err) {
      console.warn('[useWorkspaceStore] Reset seed save skipped or failed:', err);
    }

    const activeWbId = cloned.activeWorkbookId;
    const metrics = computeTopologyMetrics(cloned, activeWbId);
    const yellowInDegrees = computeAllYellowInDegrees(cloned, activeWbId);
    const showDeclined = true;

    const nodes = deriveStoreNodes(get(), cloned, null, [], yellowInDegrees, []);
    const edges = deriveStoreEdges(get(), cloned, null, [], showDeclined, []);

    saveSavedWorkspacesList([cloned]);

    set({
      workspace: cloned,
      savedWorkspaces: [cloned],
      activeWorkbookId: activeWbId,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      isHoldingB: false,
      isolatedElement: null,
      isolatedPlacementId: null,
      lockedPlacementIds: [],
      lockedBranchIds: [],
      isWorkspaceLocked: false,
      showDeclined,
      isLayoutRunning: false,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });
  },

  addNode: async (
    name: string,
    category: EntityCategory,
    globalNotes?: string,
    initialPosition?: { x: number; y: number },
    internalLead?: string
  ) => {
    const {
      workspace,
      activeWorkbookId,
      isWorkspaceLocked,
    } = get();
    if (!workspace || !activeWorkbookId) {
      throw new Error('Workspace is not initialized');
    }
    if (isWorkspaceLocked) {
      throw new Error('Workspace is locked');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Organization name cannot be empty');
    }

    get().pushHistory(workspace);

    // Entity deduplication: check if an entity with this name already exists (case-insensitive)
    const existingEntity = Object.values(workspace.entities).find(
      (e) => e.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    let entityId: string;
    const updatedEntities: Record<string, Entity> = { ...workspace.entities };

    if (existingEntity) {
      entityId = existingEntity.entityId;
      const updates: Partial<Entity> = {};
      if (globalNotes && !existingEntity.globalNotes) {
        updates.globalNotes = globalNotes;
      }
      if (internalLead && !existingEntity.internalLead) {
        updates.internalLead = internalLead.trim();
      }
      if (Object.keys(updates).length > 0) {
        updatedEntities[entityId] = {
          ...existingEntity,
          ...updates,
        };
      }
    } else {
      entityId = generateId();
      const now = new Date().toISOString();
      const newEntity: Entity = {
        entityId,
        name: trimmedName,
        category,
        globalNotes: globalNotes ?? '',
        createdAt: now,
        internalLead: internalLead?.trim() || undefined,
      };
      updatedEntities[entityId] = newEntity;
    }

    // Determine initial coordinates: custom initialPosition or center of existing placements in active workbook
    let posX = initialPosition?.x ?? 400;
    let posY = initialPosition?.y ?? 300;
    if (!initialPosition) {
      const existingPlacements = Object.values(workspace.placements).filter(
        (p) => p.workbookId === activeWorkbookId
      );
      if (existingPlacements.length > 0) {
        const xs = existingPlacements.map((p) => p.x);
        const ys = existingPlacements.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        posX = Math.round((minX + maxX) / 2);
        posY = Math.round((minY + maxY) / 2);
      }
    }

    const placementId = generateId();
    const newPlacement: Placement = {
      placementId,
      workbookId: activeWorkbookId,
      entityId,
      isRootNgo: false,
      x: posX,
      y: posY,
      width: 220,
      height: 110,
    };

    const updatedPlacements: Record<string, Placement> = {
      ...workspace.placements,
      [placementId]: newPlacement,
    };

    // Run local anti-overlap collision resolution with 24px margin while keeping new node anchored
    const { positions } = resolveLocalCollisions(updatedPlacements, placementId, 24);
    for (const [id, pos] of Object.entries(positions)) {
      if (updatedPlacements[id]) {
        updatedPlacements[id] = {
          ...updatedPlacements[id],
          x: pos.x,
          y: pos.y,
        };
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      entities: updatedEntities,
      placements: updatedPlacements,
    };

    const metrics = computeTopologyMetrics(updatedWorkspace, activeWorkbookId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, activeWorkbookId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, placementId, [placementId], yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, null, []);

    set({
      workspace: updatedWorkspace,
      selectedPlacementId: placementId,
      selectedBranchId: null,
      selectedPlacementIds: [placementId],
      selectedBranchIds: [],
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after adding node:', err);
    }

    return { placementId, entityId };
  },

  addBranch: async (
    sourcePlacementId: string,
    targetPlacementId: string,
    type: BranchType,
    status: BranchStatus,
    valuePct?: number,
    note?: string
  ) => {
    const {
      workspace,
      activeWorkbookId,
      isWorkspaceLocked,
    } = get();
    if (!workspace || !activeWorkbookId) return null;
    if (isWorkspaceLocked) return null;
    if (sourcePlacementId === targetPlacementId) {
      throw new Error('Self-loops are not allowed in QualCount network topology');
    }
    const src = workspace.placements[sourcePlacementId];
    const tgt = workspace.placements[targetPlacementId];
    if (!src || !tgt) {
      throw new Error('Source or target placement does not exist in workspace');
    }

    get().pushHistory(workspace);

    const branchId = generateId();
    const now = new Date().toISOString();
    const newBranch: Branch = {
      branchId,
      workbookId: activeWorkbookId,
      sourcePlacementId,
      targetPlacementId,
      type,
      status,
      valuePct: type === 'green' ? valuePct : undefined,
      note: note ?? '',
      updatedAt: now,
    };

    const updatedBranches: Record<string, Branch> = {
      ...workspace.branches,
      [branchId]: newBranch,
    };

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      branches: updatedBranches,
    };

    const metrics = computeTopologyMetrics(updatedWorkspace, activeWorkbookId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, activeWorkbookId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, null, [], yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, branchId, [branchId]);

    set({
      workspace: updatedWorkspace,
      selectedBranchId: branchId,
      selectedPlacementId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [branchId],
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after adding branch:', err);
    }

    return newBranch;
  },

  updateEntity: async (entityId: string, updates: Partial<Entity>) => {
    const {
      workspace,
      activeWorkbookId,
      isWorkspaceLocked,
    } = get();
    if (!workspace || isWorkspaceLocked) return;
    const existing = workspace.entities[entityId];
    if (!existing) return;

    get().pushHistory(workspace);

    const updatedEntities: Record<string, Entity> = {
      ...workspace.entities,
      [entityId]: {
        ...existing,
        ...updates,
      },
    };

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      entities: updatedEntities,
    };

    const metrics = activeWorkbookId
      ? computeTopologyMetrics(updatedWorkspace, activeWorkbookId)
      : get().metrics;

    const nodes = deriveStoreNodes(get(), updatedWorkspace);

    set({
      workspace: updatedWorkspace,
      metrics,
      nodes,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after entity update:', err);
    }
  },

  updatePlacementPublicChoice: async (placementId: string, updates: Partial<Placement>) => {
    const { workspace, isWorkspaceLocked } = get();
    if (!workspace || isWorkspaceLocked) return;
    const oldPlc = workspace.placements[placementId];
    if (!oldPlc) return;

    get().pushHistory(workspace);
    const updatedPlacements = {
      ...workspace.placements,
      [placementId]: {
        ...oldPlc,
        ...updates,
      },
    };
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      placements: updatedPlacements,
    };
    set({
      workspace: updatedWorkspace,
      nodes: deriveStoreNodes(get(), updatedWorkspace),
    });
    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after placement public choice update:', err);
    }
  },

  updateUtilityWeights: async (weights: UtilityStrategyWeights) => {
    const { workspace, activeWorkbookId, isWorkspaceLocked } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked) return;
    const oldWb = workspace.workbooks[activeWorkbookId];
    if (!oldWb) return;

    get().pushHistory(workspace);
    const updatedWorkbooks = {
      ...workspace.workbooks,
      [activeWorkbookId]: {
        ...oldWb,
        utilityWeights: weights,
        updatedAt: new Date().toISOString(),
      },
    };
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      workbooks: updatedWorkbooks,
    };
    set({ workspace: updatedWorkspace });
    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after utility weights update:', err);
    }
  },

  updateRiskScenarioStatus: async (scenarioId: string, status: 'open' | 'mitigating' | 'resolved') => {
    const { workspace, activeWorkbookId, isWorkspaceLocked } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked) return;
    const oldWb = workspace.workbooks[activeWorkbookId];
    if (!oldWb || !oldWb.riskAssessment) return;

    get().pushHistory(workspace);
    const updatedScenarios = oldWb.riskAssessment.failureScenarios.map((sc) =>
      sc.id === scenarioId ? { ...sc, status } : sc
    );
    const updatedAssessment: AgentRiskAssessment = {
      ...oldWb.riskAssessment,
      failureScenarios: updatedScenarios,
    };
    const updatedWorkbooks = {
      ...workspace.workbooks,
      [activeWorkbookId]: {
        ...oldWb,
        riskAssessment: updatedAssessment,
        updatedAt: new Date().toISOString(),
      },
    };
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      workbooks: updatedWorkbooks,
    };
    set({ workspace: updatedWorkspace });
    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after risk scenario status update:', err);
    }
  },

  updateRiskAssessment: async (assessment: AgentRiskAssessment) => {
    const { workspace, activeWorkbookId, isWorkspaceLocked } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked) return;
    const oldWb = workspace.workbooks[activeWorkbookId];
    if (!oldWb) return;

    get().pushHistory(workspace);
    const updatedWorkbooks = {
      ...workspace.workbooks,
      [activeWorkbookId]: {
        ...oldWb,
        riskAssessment: assessment,
        updatedAt: new Date().toISOString(),
      },
    };
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      workbooks: updatedWorkbooks,
    };
    set({ workspace: updatedWorkspace });
    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.warn('[useWorkspaceStore] Failed to save workspace after risk assessment update:', err);
    }
  },

  commitSpreadsheetImport: async (rows: ImportRow[]) => {
    const { workspace, activeWorkbookId, isWorkspaceLocked } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked || rows.length === 0) return;

    set({ isLoading: true, loadingMessage: `Importing ${rows.length} rows & tidying layout...` });
    await new Promise((r) => setTimeout(r, 40));
    try {
      get().pushHistory(workspace);
      const updatedWorkspace = await commitImportedRows(rows, activeWorkbookId, workspace);
      const metrics = computeTopologyMetrics(updatedWorkspace, activeWorkbookId);
      const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, activeWorkbookId);

      const tempState: WorkspaceStoreState = {
        ...get(),
        workspace: updatedWorkspace,
        activeWorkbookId,
      };

      set({
        workspace: updatedWorkspace,
        activeView: 'canvas',
        metrics,
        yellowInDegrees,
        nodes: deriveStoreNodes(tempState, updatedWorkspace, null, [], yellowInDegrees),
        edges: deriveStoreEdges(tempState, updatedWorkspace, null, [], true),
        isLoading: false,
      });

      setTimeout(() => {
        get().flowInstance?.fitView({ duration: 300, padding: 0.15 });
      }, 50);

      try {
        await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
      } catch (err) {
        console.warn('[useWorkspaceStore] Failed to save workspace after spreadsheet import:', err);
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateBranch: async (branchId: string, updates: Partial<Branch>) => {
    const {
      workspace,
      activeWorkbookId,
      lockedBranchIds,
      isWorkspaceLocked,
    } = get();
    if (!workspace || isWorkspaceLocked || lockedBranchIds.includes(branchId)) return;
    const branch = workspace.branches[branchId];
    if (!branch) return;

    const newSource = updates.sourcePlacementId ?? branch.sourcePlacementId;
    const newTarget = updates.targetPlacementId ?? branch.targetPlacementId;
    if (newSource === newTarget) {
      console.warn('[useWorkspaceStore] Cannot update branch: source and target cannot be identical');
      return;
    }
    if (!workspace.placements[newSource] || !workspace.placements[newTarget]) {
      console.warn('[useWorkspaceStore] Cannot update branch: placement does not exist');
      return;
    }

    get().pushHistory(workspace);

    const updatedBranch: Branch = {
      ...branch,
      ...updates,
      sourcePlacementId: newSource,
      targetPlacementId: newTarget,
      updatedAt: new Date().toISOString(),
    };
    if (updates.type && updates.type !== 'green') {
      updatedBranch.valuePct = undefined;
    }

    const updatedBranches: Record<string, Branch> = {
      ...workspace.branches,
      [branchId]: updatedBranch,
    };

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      branches: updatedBranches,
    };

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace);
    const edges = deriveStoreEdges(get(), updatedWorkspace);

    set({
      workspace: updatedWorkspace,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after branch update:', err);
    }
  },

  deleteBranch: async (branchId: string) => {
    const {
      workspace,
      activeWorkbookId,
      selectedBranchId,
      lockedBranchIds,
      isWorkspaceLocked,
      selectedBranchIds,
    } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked || lockedBranchIds.includes(branchId)) return;
    if (!workspace.branches[branchId]) return;

    get().pushHistory(workspace);

    const updatedBranches: Record<string, Branch> = { ...workspace.branches };
    delete updatedBranches[branchId];

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      branches: updatedBranches,
    };

    const nextSelectedBranchId = selectedBranchId === branchId ? null : selectedBranchId;
    const nextSelectedBranchIds = selectedBranchIds.filter((id) => id !== branchId);
    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace);
    const edges = deriveStoreEdges(
      get(),
      updatedWorkspace,
      nextSelectedBranchId,
      nextSelectedBranchIds
    );

    set({
      workspace: updatedWorkspace,
      selectedBranchId: nextSelectedBranchId,
      selectedBranchIds: nextSelectedBranchIds,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after branch deletion:', err);
    }
  },

  removePlacement: async (placementId: string) => {
    const {
      workspace,
      activeWorkbookId,
      selectedPlacementId,
      selectedBranchId,
      lockedPlacementIds,
      isWorkspaceLocked,
      selectedPlacementIds,
      selectedBranchIds,
    } = get();
    if (!workspace || !activeWorkbookId || isWorkspaceLocked || lockedPlacementIds.includes(placementId)) return false;
    const placement = workspace.placements[placementId];
    if (!placement) return false;

    // Protected: Root NGO cannot be removed
    if (placement.isRootNgo) {
      console.warn('[useWorkspaceStore] Cannot remove Root NGO placement');
      return false;
    }

    get().pushHistory(workspace);

    // Remove placement
    const updatedPlacements: Record<string, Placement> = { ...workspace.placements };
    delete updatedPlacements[placementId];

    // Cascading deletion: remove all branches connected to this placement
    const updatedBranches: Record<string, Branch> = { ...workspace.branches };
    for (const [bId, b] of Object.entries(updatedBranches)) {
      if (b.sourcePlacementId === placementId || b.targetPlacementId === placementId) {
        delete updatedBranches[bId];
      }
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      placements: updatedPlacements,
      branches: updatedBranches,
    };

    const nextSelectedPlacementId = selectedPlacementId === placementId ? null : selectedPlacementId;
    const nextSelectedPlacementIds = selectedPlacementIds.filter((id) => id !== placementId);
    const nextSelectedBranchId =
      selectedBranchId && !updatedBranches[selectedBranchId] ? null : selectedBranchId;
    const nextSelectedBranchIds = selectedBranchIds.filter((id) => updatedBranches[id]);

    const targetWbId = activeWorkbookId ?? updatedWorkspace.activeWorkbookId;
    const metrics = computeTopologyMetrics(updatedWorkspace, targetWbId);
    const yellowInDegrees = computeAllYellowInDegrees(updatedWorkspace, targetWbId);

    const nodes = deriveStoreNodes(get(), updatedWorkspace, nextSelectedPlacementId, nextSelectedPlacementIds, yellowInDegrees);
    const edges = deriveStoreEdges(get(), updatedWorkspace, nextSelectedBranchId, nextSelectedBranchIds);

    set({
      workspace: updatedWorkspace,
      selectedPlacementId: nextSelectedPlacementId,
      selectedPlacementIds: nextSelectedPlacementIds,
      selectedBranchId: nextSelectedBranchId,
      selectedBranchIds: nextSelectedBranchIds,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(updatedWorkspace);
    } catch (err) {
      console.error('[useWorkspaceStore] Failed to save workspace after placement removal:', err);
    }

    return true;
  },

  exportWorkspace: async () => {
    const { workspace } = get();
    if (!workspace) return;
    const repo = getWorkspaceRepository();
    await repo.exportWorkspaceFile(workspace);
  },

  downloadWorkspace: async (workspaceId?: string) => {
    const target = workspaceId
      ? get().savedWorkspaces.find((w) => w.workspaceId === workspaceId) || get().workspace
      : get().workspace;
    if (!target) return;
    const repo = getWorkspaceRepository();
    await repo.exportWorkspaceFile(target);
  },

  loadWorkspace: async () => {
    await get().init();
  },

  importWorkspace: async () => {
    return get().importWorkspaceFile();
  },

  importWorkspaceFile: async (fileOrData?: File | string | WorkspaceState) => {
    set({ isLoading: true, loadingMessage: 'Selecting and reading workspace JSON...' });
    // Yield to let browser paint the modern animated loading screen
    await new Promise((r) => setTimeout(r, 60));
    try {
      let imported: WorkspaceState | null = null;

      if (!fileOrData) {
        const repo = getWorkspaceRepository();
        imported = await repo.importWorkspaceFile();
      } else if (typeof fileOrData === 'string') {
        set({ loadingMessage: 'Parsing JSON data...' });
        await new Promise((r) => setTimeout(r, 40));
        imported = await importWorkspaceBundle(fileOrData, get().workspace);
      } else if (typeof (fileOrData as File).text === 'function') {
        set({ loadingMessage: `Reading ${(fileOrData as File).name}...` });
        await new Promise((r) => setTimeout(r, 40));
        const text = await (fileOrData as File).text();
        imported = await importWorkspaceBundle(text, get().workspace);
      } else if (typeof fileOrData === 'object' && fileOrData !== null) {
        if (isWorkbookFile(fileOrData)) {
          imported = convertWorkbookFileToWorkspace(fileOrData as WorkbookFile, get().workspace);
        } else if (isWorkspaceState(fileOrData)) {
          imported = migrateToSchemaV2(fileOrData);
        } else {
          imported = migrateToSchemaV2(fileOrData);
        }
      }

      if (!imported) {
        set({ isLoading: false });
        return false;
      }

      // Ensure imported workspace is fully migrated to Schema V2 with robust IDs
      const migratedState = migrateToSchemaV2(imported);

      set({ loadingMessage: 'Constructing multiplex topology & calculating metrics...' });
      await new Promise((r) => setTimeout(r, 40));

      const activeWbId =
        migratedState.activeWorkbookId || Object.keys(migratedState.workbooks)[0] || 'wb-default';
      const metrics = computeTopologyMetrics(migratedState, activeWbId);
      const yellowInDegrees = computeAllYellowInDegrees(migratedState, activeWbId);
      const showDeclined = true;

      // Anti-collapse & initial layout check:
      // If active placements are all stacked at (0,0) or unpositioned, calculate hierarchical layout
      const activePlacements = Object.values(migratedState.placements).filter(
        (p) => !p.workbookId || p.workbookId === activeWbId
      );
      const needsLayout =
        activePlacements.length > 0 &&
        activePlacements.every((p) => p.x === 0 && p.y === 0);

      let finalImported = migratedState;
      if (needsLayout) {
        set({ loadingMessage: 'Computing bottom-to-top hierarchical layout...' });
        await new Promise((r) => setTimeout(r, 40));
        try {
          const layoutCoords = await computeHierarchicalLayout(
            migratedState.placements,
            migratedState.branches,
            activeWbId,
            'UP'
          );
          const updatedPlacements: Record<string, Placement> = { ...migratedState.placements };
          for (const [id, coord] of Object.entries(layoutCoords)) {
            if (updatedPlacements[id]) {
              updatedPlacements[id] = { ...updatedPlacements[id], x: coord.x, y: coord.y };
            }
          }
          finalImported = { ...migratedState, placements: updatedPlacements };
        } catch (err) {
          console.warn('[useWorkspaceStore] Layout pass failed on import:', err);
        }
      }

      const tempState: WorkspaceStoreState = {
        ...get(),
        workspace: finalImported,
        activeWorkbookId: activeWbId,
        filters: defaultWorkspaceFilters,
      };

      const nodes = deriveStoreNodes(tempState, finalImported, null, [], yellowInDegrees);
      const edges = deriveStoreEdges(tempState, finalImported, null, [], showDeclined);

      const currentSaved = get().savedWorkspaces;
      const updatedSaved = currentSaved.some((w) => w.workspaceId === finalImported.workspaceId)
        ? currentSaved.map((w) => (w.workspaceId === finalImported.workspaceId ? finalImported : w))
        : [...currentSaved, finalImported];

      set({
        workspace: finalImported,
        savedWorkspaces: updatedSaved,
        activeWorkbookId: activeWbId,
        activeView: 'canvas',
        selectedPlacementId: null,
        selectedBranchId: null,
        selectedPlacementIds: [],
        selectedBranchIds: [],
        showDeclined,
        isLayoutRunning: false,
        metrics,
        yellowInDegrees,
        nodes,
        edges,
        isLoading: false,
      });

      saveSavedWorkspacesList(updatedSaved);

      // Frame and center all imported nodes on canvas
      setTimeout(() => {
        get().flowInstance?.fitView({ duration: 300, padding: 0.15 });
      }, 50);

      try {
        await getWorkspaceRepository().saveWorkspace(finalImported);
      } catch (err) {
        console.error('[useWorkspaceStore] Failed to save workspace after import:', err);
      }

      return true;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  importWorkbookFile: async (fileOrData?: File | string | WorkbookFile) => {
    set({ isLoading: true, loadingMessage: 'Importing workbook JSON...' });
    await new Promise((r) => setTimeout(r, 50));
    try {
      let wbFile: WorkbookFile | null = null;
      if (!fileOrData) {
        const repo = getWorkspaceRepository();
        const imported = await repo.importWorkspaceFile();
        if (imported) {
          return true;
        }
        set({ isLoading: false });
        return false;
      } else if (typeof fileOrData === 'string') {
        wbFile = JSON.parse(fileOrData);
      } else if (typeof (fileOrData as File).text === 'function') {
        const text = await (fileOrData as File).text();
        wbFile = JSON.parse(text);
      } else {
        wbFile = fileOrData as WorkbookFile;
      }

      if (!wbFile) {
        set({ isLoading: false });
        return false;
      }

      const convertedWorkspace = convertWorkbookFileToWorkspace(wbFile, get().workspace);
      return await get().importWorkspaceFile(convertedWorkspace);
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  createWorkspace: async (name: string, rootNgoName = 'Lead Foundation') => {
    const now = new Date().toISOString();
    const newWsId = `ws_${Date.now()}`;
    const initWbId = `wb_${Date.now()}`;
    const rootEntityId = `ent_${Date.now()}`;
    const rootPlcId = `plc_${Date.now()}`;

    const isSampleDeleted = isSampleDeletedPersisted() || memorySampleDeleted;
    const newWorkspace: WorkspaceState = {
      schemaVersion: 2,
      workspaceId: newWsId,
      workspaceName: name.trim() || 'Untitled Workspace',
      activeWorkbookId: initWbId,
      sourceType: 'local',
      userDeletedSample: isSampleDeleted ? true : undefined,
      workbooks: {
        [initWbId]: {
          workbookId: initWbId,
          title: 'Initial Initiative',
          description: 'Primary partnership initiative',
          targetBudgetInr: 10000000,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          utilityWeights: { ...DEFAULT_UTILITY_WEIGHTS },
        },
      },
      entities: {
        [rootEntityId]: {
          entityId: rootEntityId,
          name: rootNgoName.trim() || 'Lead Foundation',
          category: 'ngo',
          globalNotes: 'Host Anchor NGO',
          createdAt: now,
          updatedAt: now,
        },
      },
      placements: {
        [rootPlcId]: {
          placementId: rootPlcId,
          workbookId: initWbId,
          entityId: rootEntityId,
          isRootNgo: true,
          x: 400,
          y: 500,
          width: 240,
          height: 160,
          coOwnershipSignals: {
            writtenCommitment: true,
            brandOrLogoShared: true,
            staffAssigned: true,
            networkMobilized: true,
          },
          selectiveIncentives: ['brand_visibility', 'csr_compliance'],
          outreachAttempts: 1,
        },
      },
      branches: {},
      workbookLinks: {},
    };

    const metrics = computeTopologyMetrics(newWorkspace, initWbId);
    const yellowInDegrees = computeAllYellowInDegrees(newWorkspace, initWbId);
    const tempState = { ...get(), workspace: newWorkspace, activeWorkbookId: initWbId, filters: defaultWorkspaceFilters };
    const nodes = deriveStoreNodes(tempState, newWorkspace, null, [], yellowInDegrees);
    const edges = deriveStoreEdges(tempState, newWorkspace, null, [], true);

    const updatedSaved = [...get().savedWorkspaces, newWorkspace];
    set({
      workspace: newWorkspace,
      savedWorkspaces: updatedSaved,
      activeWorkbookId: initWbId,
      activeView: 'landing',
      metrics,
      yellowInDegrees,
      nodes,
      edges,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      filters: defaultWorkspaceFilters,
    });

    saveSavedWorkspacesList(updatedSaved);

    try {
      await getWorkspaceRepository().saveWorkspace(newWorkspace);
    } catch (e) {
      console.warn('Failed to save new workspace:', e);
    }
    return newWsId;
  },

  updateWorkspace: async (updates: { workspaceName?: string }, workspaceId?: string) => {
    const { workspace, savedWorkspaces, pushHistory } = get();
    const targetWsId = workspaceId || workspace?.workspaceId;
    if (!targetWsId) return;

    if (workspace && targetWsId === workspace.workspaceId) {
      pushHistory(workspace);
      const updated: WorkspaceState = {
        ...workspace,
        workspaceName:
          updates.workspaceName !== undefined
            ? updates.workspaceName.trim() || workspace.workspaceName
            : workspace.workspaceName,
      };
      const updatedSaved = savedWorkspaces.map((w) =>
        w.workspaceId === updated.workspaceId ? updated : w
      );
      set({
        workspace: updated,
        savedWorkspaces: updatedSaved,
      });
      saveSavedWorkspacesList(updatedSaved);
      try {
        await getWorkspaceRepository().saveWorkspace(updated);
      } catch (e) {
        console.warn('Failed to save workspace after name update:', e);
      }
    } else {
      const updatedSaved = savedWorkspaces.map((w) => {
        if (w.workspaceId === targetWsId) {
          return {
            ...w,
            workspaceName:
              updates.workspaceName !== undefined
                ? updates.workspaceName.trim() || w.workspaceName
                : w.workspaceName,
          };
        }
        return w;
      });
      set({ savedWorkspaces: updatedSaved });
      saveSavedWorkspacesList(updatedSaved);
      const target = updatedSaved.find((w) => w.workspaceId === targetWsId);
      if (target) {
        try {
          await getWorkspaceRepository().saveWorkspace(target);
        } catch (e) {
          console.warn('Failed to save workspace after name update:', e);
        }
      }
    }
  },

  copyWorkspace: async (workspaceIdOrName?: string, customName?: string) => {
    const { workspace, savedWorkspaces, pushHistory } = get();
    let sourceWs = workspace;
    let targetName: string | undefined;

    if (workspaceIdOrName && savedWorkspaces.some((w) => w.workspaceId === workspaceIdOrName)) {
      sourceWs = savedWorkspaces.find((w) => w.workspaceId === workspaceIdOrName) || workspace;
      targetName = customName;
    } else if (workspaceIdOrName) {
      targetName = workspaceIdOrName;
    }

    if (!sourceWs) return '';
    if (workspace) pushHistory(workspace);

    const copyId = `ws_copy_${Date.now()}`;
    const name = targetName || `${sourceWs.workspaceName} (Copy)`;
    const copied: WorkspaceState = {
      ...JSON.parse(JSON.stringify(sourceWs)),
      workspaceId: copyId,
      workspaceName: name,
    };
    const updatedSaved = [...get().savedWorkspaces, copied];
    set({
      workspace: copied,
      savedWorkspaces: updatedSaved,
    });
    saveSavedWorkspacesList(updatedSaved);
    try {
      await getWorkspaceRepository().saveWorkspace(copied);
    } catch (e) {
      console.warn('Failed to save duplicated workspace:', e);
    }
    return copyId;
  },

  deleteWorkspace: async (workspaceId?: string) => {
    const { workspace, savedWorkspaces, pushHistory } = get();
    if (!workspace) return false;
    pushHistory(workspace);

    const targetWsId =
      workspaceId ||
      workspace.workspaceId ||
      savedWorkspaces[0]?.workspaceId ||
      WORKSPACE_SAMPLE_ID;

    const targetWs =
      savedWorkspaces.find((w) => w.workspaceId === targetWsId) ||
      (workspace.workspaceId === targetWsId ? workspace : null);

    const isSample =
      isSampleWorkspace(targetWs) ||
      targetWsId === WORKSPACE_SAMPLE_ID ||
      targetWsId === 'ws_delhi_coalitions';

    if (isSample) {
      memorySampleDeleted = true;
      setSampleDeletedPersisted(true);
    }

    const remaining = savedWorkspaces.filter((w) => {
      if (w.workspaceId === targetWsId) return false;
      if (isSample && isSampleWorkspace(w)) return false;
      return true;
    });

    if (remaining.length > 0) {
      let nextActive = workspace.workspaceId === targetWsId ? remaining[0] : workspace;
      if (isSample && isSampleWorkspace(nextActive)) {
        nextActive = remaining[0];
      }
      if (isSample) {
        nextActive = { ...nextActive, userDeletedSample: true };
      }
      const activeWbId = nextActive.activeWorkbookId || Object.keys(nextActive.workbooks)[0] || '';
      const metrics = computeTopologyMetrics(nextActive, activeWbId);
      const yellowInDegrees = activeWbId ? computeAllYellowInDegrees(nextActive, activeWbId) : {};
      const tempState = { ...get(), workspace: nextActive, activeWorkbookId: activeWbId, filters: defaultWorkspaceFilters };
      const nodes = activeWbId ? deriveStoreNodes(tempState, nextActive, null, [], yellowInDegrees) : [];
      const edges = activeWbId ? deriveStoreEdges(tempState, nextActive, null, [], true) : [];

      const updatedSaved = remaining.map((w) =>
        w.workspaceId === nextActive.workspaceId
          ? nextActive
          : isSample
          ? { ...w, userDeletedSample: true }
          : w
      );

      set({
        workspace: nextActive,
        savedWorkspaces: updatedSaved,
        activeWorkbookId: activeWbId,
        activeView: activeWbId ? get().activeView : 'landing',
        metrics,
        yellowInDegrees,
        nodes,
        edges,
        selectedPlacementId: null,
        selectedBranchId: null,
        selectedPlacementIds: [],
        selectedBranchIds: [],
        filters: defaultWorkspaceFilters,
      });

      saveSavedWorkspacesList(updatedSaved);

      try {
        await getWorkspaceRepository().saveWorkspace(nextActive);
      } catch (e) {
        console.warn('Failed to save workspace after deletion:', e);
      }
      return true;
    }

    // Default clean empty workspace when no workspaces remain
    const emptyWs: WorkspaceState = migrateToSchemaV2({
      schemaVersion: 2,
      activeWorkbookId: '',
      workspaceId: `ws_${Date.now()}`,
      workspaceName: 'New Workspace',
      entities: {},
      workbooks: {},
      placements: {},
      branches: {},
      workbookLinks: {},
      userDeletedSample: true,
    });

    memorySampleDeleted = true;
    setSampleDeletedPersisted(true);

    const metrics = computeTopologyMetrics(emptyWs, '');
    const nodes: OrgFlowNode[] = [];
    const edges: MultiplexFlowEdge[] = [];

    set({
      workspace: emptyWs,
      savedWorkspaces: [emptyWs],
      activeWorkbookId: '',
      activeView: 'landing',
      metrics,
      yellowInDegrees: {},
      nodes,
      edges,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      filters: defaultWorkspaceFilters,
    });

    saveSavedWorkspacesList([emptyWs]);

    try {
      await getWorkspaceRepository().saveWorkspace(emptyWs);
    } catch (e) {
      console.warn('Failed to save empty workspace after deletion:', e);
    }
    return true;
  },

  switchWorkspace: async (workspaceId: string) => {
    const { savedWorkspaces, workspace } = get();
    if (workspace?.workspaceId === workspaceId) return true;
    const target = savedWorkspaces.find((w) => w.workspaceId === workspaceId);
    if (!target) return false;

    const activeWbId = target.activeWorkbookId || Object.keys(target.workbooks)[0] || '';
    const metrics = computeTopologyMetrics(target, activeWbId);
    const yellowInDegrees = activeWbId ? computeAllYellowInDegrees(target, activeWbId) : {};
    const tempState = { ...get(), workspace: target, activeWorkbookId: activeWbId, filters: defaultWorkspaceFilters };
    const nodes = activeWbId ? deriveStoreNodes(tempState, target, null, [], yellowInDegrees) : [];
    const edges = activeWbId ? deriveStoreEdges(tempState, target, null, [], true) : [];

    set({
      workspace: target,
      activeWorkbookId: activeWbId,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
      filters: defaultWorkspaceFilters,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(target);
    } catch (e) {
      console.warn('Failed to save switched workspace:', e);
    }
    return true;
  },

  updateWorkbook: async (workbookId: string, updates: Partial<Workbook>) => {
    const { workspace, pushHistory } = get();
    if (!workspace || !workspace.workbooks[workbookId]) return;
    pushHistory(workspace);
    const currentWb = workspace.workbooks[workbookId];
    const updatedWb: Workbook = {
      ...currentWb,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const nextWorkspace: WorkspaceState = {
      ...workspace,
      workbooks: {
        ...workspace.workbooks,
        [workbookId]: updatedWb,
      },
    };
    const metrics = computeTopologyMetrics(nextWorkspace, get().activeWorkbookId || workbookId);
    const currentSaved = get().savedWorkspaces;
    const updatedSaved = currentSaved.map((w) =>
      w.workspaceId === nextWorkspace.workspaceId ? nextWorkspace : w
    );
    set({ workspace: nextWorkspace, savedWorkspaces: updatedSaved, metrics });
    try {
      await getWorkspaceRepository().saveWorkspace(nextWorkspace);
    } catch (e) {
      console.warn('Failed to save workbook updates:', e);
    }
  },

  copyWorkbook: async (workbookId: string) => {
    const { workspace, pushHistory } = get();
    if (!workspace || !workspace.workbooks[workbookId]) return '';
    pushHistory(workspace);

    const srcWb = workspace.workbooks[workbookId];
    const newWbId = generateId();
    const now = new Date().toISOString();

    const newWb: Workbook = {
      ...JSON.parse(JSON.stringify(srcWb)),
      workbookId: newWbId,
      title: `${srcWb.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    const nextPlacements = { ...workspace.placements };
    const nextBranches = { ...workspace.branches };
    const placementIdMap = new Map<string, string>();

    const srcPlacements = Object.values(workspace.placements).filter(
      (p) => p.workbookId === workbookId
    );

    for (const p of srcPlacements) {
      const newPlacementId = generateId();
      placementIdMap.set(p.placementId, newPlacementId);
      nextPlacements[newPlacementId] = {
        ...JSON.parse(JSON.stringify(p)),
        placementId: newPlacementId,
        workbookId: newWbId,
        createdAt: now,
        updatedAt: now,
      };
    }

    const srcBranches = Object.values(workspace.branches).filter(
      (b) => b.workbookId === workbookId
    );

    for (const b of srcBranches) {
      const newSourceId = placementIdMap.get(b.sourcePlacementId);
      const newTargetId = placementIdMap.get(b.targetPlacementId);
      if (newSourceId && newTargetId) {
        const newBranchId = generateId();
        nextBranches[newBranchId] = {
          ...JSON.parse(JSON.stringify(b)),
          branchId: newBranchId,
          workbookId: newWbId,
          sourcePlacementId: newSourceId,
          targetPlacementId: newTargetId,
          createdAt: now,
          updatedAt: now,
        };
      }
    }

    const nextWorkspace: WorkspaceState = {
      ...workspace,
      workbooks: {
        ...workspace.workbooks,
        [newWbId]: newWb,
      },
      placements: nextPlacements,
      branches: nextBranches,
    };

    const currentSaved = get().savedWorkspaces;
    const updatedSaved = currentSaved.map((w) =>
      w.workspaceId === nextWorkspace.workspaceId ? nextWorkspace : w
    );
    set({ workspace: nextWorkspace, savedWorkspaces: updatedSaved });
    try {
      await getWorkspaceRepository().saveWorkspace(nextWorkspace);
    } catch (e) {
      console.warn('Failed to save copied workbook:', e);
    }
    return newWbId;
  },

  deleteWorkbook: async (workbookId: string) => {
    const { workspace, pushHistory } = get();
    if (!workspace || !workspace.workbooks[workbookId]) return false;
    pushHistory(workspace);

    const targetWb = workspace.workbooks[workbookId];
    const isSample =
      workbookId === WORKBOOK_DELHI_ID ||
      targetWb?.title === '[Sample] Delhi Youth Governance Exhibition' ||
      targetWb?.title === 'Delhi Youth Governance Exhibition';

    const nextWorkbooks = { ...workspace.workbooks };
    delete nextWorkbooks[workbookId];

    const nextPlacements: Record<string, Placement> = {};
    for (const [id, p] of Object.entries(workspace.placements)) {
      if (p.workbookId !== workbookId) {
        nextPlacements[id] = p;
      }
    }

    const nextBranches: Record<string, Branch> = {};
    for (const [id, b] of Object.entries(workspace.branches)) {
      if (b.workbookId !== workbookId) {
        nextBranches[id] = b;
      }
    }

    const nextWorkbookLinks: Record<string, WorkbookLink> = {};
    for (const [id, link] of Object.entries(workspace.workbookLinks || {})) {
      if (link.sourceWorkbookId !== workbookId && link.targetWorkbookId !== workbookId) {
        nextWorkbookLinks[id] = link;
      }
    }

    const remainingKeys = Object.keys(nextWorkbooks);
    const nextActiveWbId =
      remainingKeys.length > 0
        ? (get().activeWorkbookId === workbookId
            ? remainingKeys[0]
            : (get().activeWorkbookId && nextWorkbooks[get().activeWorkbookId!]
                ? get().activeWorkbookId!
                : remainingKeys[0]))
        : '';

    const nextWorkspace: WorkspaceState = {
      ...workspace,
      activeWorkbookId: nextActiveWbId,
      workbooks: nextWorkbooks,
      placements: nextPlacements,
      branches: nextBranches,
      workbookLinks: nextWorkbookLinks,
      userDeletedSample: isSample ? true : workspace.userDeletedSample,
    };

    const metrics = computeTopologyMetrics(nextWorkspace, nextActiveWbId);
    const yellowInDegrees = nextActiveWbId ? computeAllYellowInDegrees(nextWorkspace, nextActiveWbId) : {};
    const tempState = { ...get(), workspace: nextWorkspace, activeWorkbookId: nextActiveWbId };
    const nodes = nextActiveWbId ? deriveStoreNodes(tempState, nextWorkspace, null, [], yellowInDegrees) : [];
    const edges = nextActiveWbId ? deriveStoreEdges(tempState, nextWorkspace, null, [], true) : [];

    const currentSaved = get().savedWorkspaces;
    const updatedSaved = currentSaved.map((w) =>
      w.workspaceId === nextWorkspace.workspaceId ? nextWorkspace : w
    );

    set({
      workspace: nextWorkspace,
      savedWorkspaces: updatedSaved,
      activeWorkbookId: nextActiveWbId,
      metrics,
      yellowInDegrees,
      nodes,
      edges,
    });

    saveSavedWorkspacesList(updatedSaved);

    try {
      await getWorkspaceRepository().saveWorkspace(nextWorkspace);
    } catch (e) {
      console.warn('Failed to save workspace after deleting workbook:', e);
    }
    return true;
  },

  downloadWorkbook: async (workbookId: string) => {
    const { workspace } = get();
    if (!workspace || !workspace.workbooks[workbookId]) return;
    await get().saveWorkbookToDisk(workbookId, true);
  },

  saveWorkbookToDisk: async (workbookId?: string, forceSaveAs = false) => {
    const ws = get().workspace;
    const targetWbId = workbookId || get().activeWorkbookId;
    if (!ws || !targetWbId) return { success: false };

    // Ensure state is persisted internally first
    try {
      await getWorkspaceRepository().saveWorkspace(ws);
    } catch (e) {
      console.warn('Local repository save warning:', e);
    }

    // Trigger native OS save file picker / fallback download
    return await saveWorkbookNative(ws, targetWbId, forceSaveAs);
  },

  setRootPlacement: async (placementId: string, isRoot = true) => {
    const { workspace, activeWorkbookId, pushHistory } = get();
    if (!workspace || !activeWorkbookId) return;

    const updatedPlacements: Record<string, Placement> = { ...workspace.placements };
    const targetPlc = updatedPlacements[placementId];
    if (!targetPlc) return;

    if (isRoot) {
      // Enforce strict single-root rule: prevent other nodes from being set as root
      // if a root node is already designated in this workbook
      const existingRoot = Object.values(updatedPlacements).find(
        (p) =>
          p.placementId !== placementId &&
          (p.workbookId === activeWorkbookId || (!p.workbookId && activeWorkbookId === workspace.activeWorkbookId)) &&
          p.isRootNgo
      );

      if (existingRoot) {
        console.warn(
          `[useWorkspaceStore] Workbook already has a Root Node (${existingRoot.placementId}). Unset it before designating another node.`
        );
        return;
      }
      pushHistory(workspace);
      updatedPlacements[placementId] = { ...targetPlc, isRootNgo: true };
    } else {
      pushHistory(workspace);
      updatedPlacements[placementId] = { ...targetPlc, isRootNgo: false };
    }

    const nextWorkspace: WorkspaceState = {
      ...workspace,
      placements: updatedPlacements,
    };

    const metrics = computeTopologyMetrics(nextWorkspace, activeWorkbookId);
    const nodes = get().deriveNodesWith(get(), nextWorkspace);
    const edges = get().deriveEdgesWith(get(), nextWorkspace);

    set({
      workspace: nextWorkspace,
      nodes,
      edges,
      metrics,
    });

    try {
      await getWorkspaceRepository().saveWorkspace(nextWorkspace);
    } catch (err) {
      console.warn('Failed to save workspace after updating root placement:', err);
    }
  },

  filterToConnectedNodes: (placementIds: string[]) => {
    get().setFilters({ connectedToPlacementIds: placementIds });
  },

  deriveNodesWith: (state: WorkspaceStoreState, ws?: WorkspaceState) => {
    return deriveStoreNodes(state, ws);
  },

  deriveEdgesWith: (state: WorkspaceStoreState, ws?: WorkspaceState) => {
    return deriveStoreEdges(state, ws);
  },

  openWorkbook: (workbookId: string) => {
    const { workspace } = get();
    if (!workspace || !workspace.workbooks[workbookId]) {
      return;
    }
    const nextWorkspace = {
      ...workspace,
      activeWorkbookId: workbookId,
    };
    const yellowInDegrees = computeAllYellowInDegrees(nextWorkspace, workbookId);
    let metrics: WorkspaceTopologyMetrics | null = null;
    try {
      metrics = computeTopologyMetrics(nextWorkspace, workbookId);
    } catch {
      // Ignore
    }

    set((state) => {
      const tempState: WorkspaceStoreState = {
        ...state,
        workspace: nextWorkspace,
        activeWorkbookId: workbookId,
        activeView: 'canvas',
        yellowInDegrees,
        metrics,
        selectedPlacementId: null,
        selectedBranchId: null,
        selectedPlacementIds: [],
        selectedBranchIds: [],
        highlightedPlacementIds: [],
      };
      const nodes = deriveStoreNodes(tempState, nextWorkspace, null, [], yellowInDegrees);
      const edges = deriveStoreEdges(tempState, nextWorkspace, null, [], state.showDeclined);
      return {
        workspace: nextWorkspace,
        activeWorkbookId: workbookId,
        activeView: 'canvas',
        yellowInDegrees,
        metrics,
        nodes,
        edges,
        selectedPlacementId: null,
        selectedBranchId: null,
        selectedPlacementIds: [],
        selectedBranchIds: [],
        highlightedPlacementIds: [],
        agentMutationNotification: nextWorkspace.workbooks[workbookId]?.lastAgentMutation || null,
      };
    });
  },

  createWorkbook: async (title: string, description = '', targetBudgetInr = 0) => {
    const { workspace, pushHistory } = get();
    if (!workspace) return '';
    pushHistory(workspace);
    const newWbId = generateId();
    const now = new Date().toISOString();
    const newWb: Workbook = {
      workbookId: newWbId,
      title: title || 'Untitled Workbook',
      description,
      targetBudgetInr,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      utilityWeights: { ...DEFAULT_UTILITY_WEIGHTS },
    };
    const nextWorkspace: WorkspaceState = {
      ...workspace,
      activeWorkbookId: newWbId,
      workbooks: {
        ...workspace.workbooks,
        [newWbId]: newWb,
      },
    };
    const metrics = computeTopologyMetrics(nextWorkspace, newWbId);
    const currentSaved = get().savedWorkspaces;
    const updatedSaved = currentSaved.map((w) =>
      w.workspaceId === nextWorkspace.workspaceId ? nextWorkspace : w
    );
    set({
      workspace: nextWorkspace,
      savedWorkspaces: updatedSaved,
      activeWorkbookId: newWbId,
      activeView: 'canvas',
      nodes: [],
      edges: [],
      yellowInDegrees: {},
      metrics,
      selectedPlacementId: null,
      selectedBranchId: null,
      selectedPlacementIds: [],
      selectedBranchIds: [],
    });
    try {
      await getWorkspaceRepository().saveWorkspace(nextWorkspace);
    } catch (e) {
      console.warn('Failed to save workspace after creating workbook:', e);
    }
    return newWbId;
  },

  setSourceType: async (sourceType: WorkspaceSourceType, folderPath?: string) => {
    const { workspace, pushHistory } = get();
    if (!workspace) return;
    pushHistory(workspace);
    const updated: WorkspaceState = {
      ...workspace,
      sourceType,
      folderPath: folderPath ?? (sourceType === 'gdrive' ? 'G:\\My Drive\\QualCount Alliances' : 'C:\\Documents\\QualCount'),
      gdriveSyncStatus: sourceType === 'gdrive' ? 'Synced' : undefined,
    };
    set({ workspace: updated });
    try {
      await getWorkspaceRepository().saveWorkspace(updated);
    } catch (e) {
      console.warn('Failed to save workspace after updating source type:', e);
    }
  },

  importEntityWithProvenBridges: async (entityResult: EntitySearchResult, pullBridges: boolean) => {
    const { workspace, activeWorkbookId, pushHistory, showDeclined } = get();
    if (!workspace || !activeWorkbookId) return;
    pushHistory(workspace);

    const nextEntities = { ...workspace.entities };
    const nextPlacements = { ...workspace.placements };
    const nextBranches = { ...workspace.branches };
    const now = new Date().toISOString();

    // 1. Ensure entity exists in entities
    const entId = entityResult.entityId;
    if (!nextEntities[entId]) {
      nextEntities[entId] = {
        entityId: entId,
        name: entityResult.name,
        category: entityResult.category,
        globalNotes: entityResult.historySummary || '',
        createdAt: now,
        updatedAt: now,
        importedFrom: {
          workspaceName: entityResult.workspaceName || 'External Workspace',
          workbookTitle: entityResult.workbookTitle || '',
          originalEntityId: entId,
          importedAt: now,
        },
      };
    }

    // 2. Ensure placement exists in active workbook
    const existingPlc = Object.values(nextPlacements).find(
      (p) => p.entityId === entId && p.workbookId === activeWorkbookId
    );

    let mainPlcId = existingPlc?.placementId;
    if (!mainPlcId) {
      mainPlcId = generateId();
      nextPlacements[mainPlcId] = {
        placementId: mainPlcId,
        workbookId: activeWorkbookId,
        entityId: entId,
        isRootNgo: false,
        x: 350,
        y: 150,
        width: 190,
        height: 76,
        outreachAttempts: 1,
      };
    }

    // 3. If pullBridges is true, import target leads as pending yellow branches
    if (pullBridges && entityResult.targetYellowLeads && entityResult.targetYellowLeads.length > 0) {
      entityResult.targetYellowLeads.forEach((lead, idx) => {
        const leadEntId = lead.targetEntityId || generateId();
        if (!nextEntities[leadEntId]) {
          nextEntities[leadEntId] = {
            entityId: leadEntId,
            name: lead.targetEntityName,
            category: lead.targetCategory,
            globalNotes: lead.note || '',
            createdAt: now,
            updatedAt: now,
            importedFrom: {
              workspaceName: entityResult.workspaceName || 'External Workspace',
              workbookTitle: entityResult.workbookTitle || '',
              originalEntityId: leadEntId,
              importedAt: now,
            },
          };
        }

        const targetPlc = Object.values(nextPlacements).find(
          (p) => p.entityId === leadEntId && p.workbookId === activeWorkbookId
        );
        let targetPlcId = targetPlc?.placementId;
        if (!targetPlcId) {
          targetPlcId = generateId();
          nextPlacements[targetPlcId] = {
            placementId: targetPlcId,
            workbookId: activeWorkbookId,
            entityId: leadEntId,
            isRootNgo: false,
            x: 250 + idx * 220,
            y: 350,
            width: 190,
            height: 76,
            outreachAttempts: 1,
          };
        }

        // Create pending yellow branch (never tick!)
        const branchKey = Object.values(nextBranches).find(
          (b) =>
            b.workbookId === activeWorkbookId &&
            b.sourcePlacementId === mainPlcId &&
            b.targetPlacementId === targetPlcId &&
            b.type === 'yellow'
        );
        if (!branchKey) {
          const newBrId = generateId();
          nextBranches[newBrId] = {
            branchId: newBrId,
            workbookId: activeWorkbookId,
            sourcePlacementId: mainPlcId!,
            targetPlacementId: targetPlcId,
            type: 'yellow',
            status: 'pending', // Strictly pending!
            note: lead.note || 'Imported referral bridge',
            createdAt: now,
            updatedAt: now,
          };
        }
      });
    }

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      entities: nextEntities,
      placements: nextPlacements,
      branches: nextBranches,
    };

    // 4. Layout bottom-to-top
    let layoutedState = updatedWorkspace;
    try {
      const newPositions = await computeHierarchicalLayout(
        updatedWorkspace.placements,
        updatedWorkspace.branches,
        activeWorkbookId,
        'UP'
      );
      const placed: Record<string, Placement> = { ...updatedWorkspace.placements };
      for (const [id, pos] of Object.entries(newPositions)) {
        if (placed[id]) {
          placed[id] = { ...placed[id], x: pos.x, y: pos.y };
        }
      }
      layoutedState = { ...updatedWorkspace, placements: placed };
    } catch (e) {
      console.warn('Layout failed after entity import:', e);
    }

    const yellowInDegrees = computeAllYellowInDegrees(layoutedState, activeWorkbookId);
    const metrics = computeTopologyMetrics(layoutedState, activeWorkbookId);

    set((state) => {
      const tempState: WorkspaceStoreState = {
        ...state,
        workspace: layoutedState,
        yellowInDegrees,
        metrics,
        selectedPlacementId: mainPlcId!,
      };
      const nodes = deriveStoreNodes(tempState, layoutedState, mainPlcId!, [mainPlcId!], yellowInDegrees);
      const edges = deriveStoreEdges(tempState, layoutedState, null, [], showDeclined);
      return {
        workspace: layoutedState,
        nodes,
        edges,
        yellowInDegrees,
        metrics,
        selectedPlacementId: mainPlcId!,
        selectedPlacementIds: [mainPlcId!],
      };
    });

    try {
      await getWorkspaceRepository().saveWorkspace(layoutedState);
    } catch (e) {
      console.warn('Failed to save workspace after entity import:', e);
    }
  },

  revertLastAgentChange: async () => {
    const { activeWorkbookId } = get();
    if (!activeWorkbookId) return;
    const repo = getWorkspaceRepository();
    if (typeof repo.revertLastSnapshot === 'function') {
      const reverted = await repo.revertLastSnapshot(activeWorkbookId);
      if (reverted) {
        const reloaded = await repo.loadWorkspace();
        if (reloaded) {
          const yellowInDegrees = computeAllYellowInDegrees(reloaded, activeWorkbookId);
          let metrics: WorkspaceTopologyMetrics | null = null;
          try {
            metrics = computeTopologyMetrics(reloaded, activeWorkbookId);
          } catch {
            // ignore
          }
          set((state) => {
            const tempState: WorkspaceStoreState = {
              ...state,
              workspace: reloaded,
              activeWorkbookId,
              yellowInDegrees,
              metrics,
              agentMutationNotification: null,
            };
            const nodes = deriveStoreNodes(tempState, reloaded, null, [], yellowInDegrees);
            const edges = deriveStoreEdges(tempState, reloaded, null, [], state.showDeclined);
            return {
              workspace: reloaded,
              activeWorkbookId,
              yellowInDegrees,
              metrics,
              nodes,
              edges,
              agentMutationNotification: null,
            };
          });
        }
      }
    }
  },

  dismissAgentNotification: () => {
    set({ agentMutationNotification: null });
  },

  reloadFromStorage: async () => {
    const repo = getWorkspaceRepository();
    const reloaded = await repo.loadWorkspace();
    if (!reloaded) return;
    const { activeWorkbookId } = get();
    const wbId = activeWorkbookId || reloaded.activeWorkbookId;
    const yellowInDegrees = computeAllYellowInDegrees(reloaded, wbId);
    let metrics: WorkspaceTopologyMetrics | null = null;
    try {
      metrics = computeTopologyMetrics(reloaded, wbId);
    } catch {
      // ignore
    }
    const activeWb = reloaded.workbooks[wbId];
    set((state) => {
      const tempState: WorkspaceStoreState = {
        ...state,
        workspace: reloaded,
        activeWorkbookId: wbId,
        yellowInDegrees,
        metrics,
        agentMutationNotification: activeWb?.lastAgentMutation || null,
      };
      const nodes = deriveStoreNodes(tempState, reloaded, null, [], yellowInDegrees);
      const edges = deriveStoreEdges(tempState, reloaded, null, [], state.showDeclined);
      return {
        workspace: reloaded,
        activeWorkbookId: wbId,
        yellowInDegrees,
        metrics,
        nodes,
        edges,
        agentMutationNotification: activeWb?.lastAgentMutation || null,
      };
    });
  },

  getFlowNodes: () => {
    const {
      workspace,
      activeWorkbookId,
      selectedPlacementId,
      yellowInDegrees,
      selectedPlacementIds,
      lockedPlacementIds,
      isWorkspaceLocked,
      isolatedElement,
      diagramAlignment,
      filters,
    } = get();
    return deriveFlowNodes(
      workspace,
      activeWorkbookId,
      selectedPlacementId,
      yellowInDegrees,
      selectedPlacementIds,
      lockedPlacementIds,
      isWorkspaceLocked,
      isolatedElement,
      diagramAlignment,
      filters
    );
  },

  getFlowEdges: () => {
    const {
      workspace,
      activeWorkbookId,
      selectedBranchId,
      showDeclined,
      selectedBranchIds,
      lockedBranchIds,
      isWorkspaceLocked,
      isolatedElement,
      theme,
      filters,
    } = get();
    return deriveFlowEdges(
      workspace,
      activeWorkbookId,
      selectedBranchId,
      showDeclined,
      selectedBranchIds,
      lockedBranchIds,
      isWorkspaceLocked,
      isolatedElement,
      theme,
      filters
    );
  },
}));
