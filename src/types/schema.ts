/**
 * QualCount: Visual Multiplex Partnership Management System
 * Normalized Relational Schema (Version 2)
 * 
 * Maps 1-to-1 with Phase 2 Rust / SQLite relational schema and
 * portable Workspace Folder JSON contracts.
 * All collections are normalized records keyed by UUID/ID strings.
 * All dates are ISO 8601 strings for Rust Serde compatibility.
 */

export type WorkspaceSourceType = 'local' | 'gdrive';

export type EntityCategory =
  | 'ngo'
  | 'csr'
  | 'government'
  | 'institution'
  | 'community'
  | 'other'
  | (string & {});

export type BranchType = 'green' | 'white' | 'yellow';
// green  = Financial / CSR funding only
// white  = Direct working relationship (venue, attendance, co-host, goodwill)
// yellow = Network bridge / referral / amplification gateway

export type BranchStatus = 'pending' | 'tick' | 'cross';
// pending = Planned outreach or awaiting reply (dashed normal hue)
// tick    = Verified partner action / commitment (solid glowing/ink hue)
// cross   = Declined / stalled outreach (faded gray or grayish-green)

export type SelectiveIncentiveTag =
  | 'csr_compliance'
  | 'brand_visibility'
  | 'institutional_mandate'
  | 'policy_influence'
  | 'network_prestige'
  | 'asset_activation'
  | 'community_legitimacy';

export interface CoOwnershipChecklist {
  writtenCommitment: boolean;
  brandOrLogoShared: boolean;
  staffAssigned: boolean;
  networkMobilized: boolean;
}

export interface UtilityStrategyWeights {
  presetName: 'balanced' | 'amplification' | 'delivery' | 'custom';
  alphaR: number; // Direct commitment & co-ownership (default 0.30)
  alphaA: number; // Ecosystem brokerage / amplification (default 0.35)
  alphaV: number; // Owned relationship conversion (default 0.20)
  alphaC: number; // Multi-thread reinforcement (default 0.15)
}

export const DEFAULT_UTILITY_WEIGHTS: UtilityStrategyWeights = {
  presetName: 'balanced',
  alphaR: 0.30,
  alphaA: 0.35,
  alphaV: 0.20,
  alphaC: 0.15,
};

export const UTILITY_PRESETS: Record<'balanced' | 'amplification' | 'delivery', UtilityStrategyWeights> = {
  balanced: {
    presetName: 'balanced',
    alphaR: 0.30,
    alphaA: 0.35,
    alphaV: 0.20,
    alphaC: 0.15,
  },
  amplification: {
    presetName: 'amplification',
    alphaR: 0.20,
    alphaA: 0.45,
    alphaV: 0.15,
    alphaC: 0.20,
  },
  delivery: {
    presetName: 'delivery',
    alphaR: 0.50,
    alphaA: 0.20,
    alphaV: 0.20,
    alphaC: 0.10,
  },
};

export interface EntityOriginReference {
  workspaceName: string;
  workbookTitle: string;
  originalEntityId: string;
  importedAt: string;
}

export interface PointOfContact {
  id: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
  description: string;
  habitOrPeculiarity: string; // Habit, peculiarity, or leverage point
  isInternal?: boolean; // True = Contact person from our side/organization responsible for this partner
}

export interface Entity {
  entityId: string;
  name: string;
  category: EntityCategory;
  globalNotes: string;
  createdAt: string; // ISO 8601 string
  updatedAt?: string;
  pointsOfContact?: PointOfContact[];
  internalLead?: string; // Responsible person or team from our side contacting this entity
  importedFrom?: EntityOriginReference; // Present when copied across workspaces
}

export interface EntitiesFile {
  schemaVersion: 2;
  revision: number;
  updatedAt: string;
  entities: Record<string, Entity>;
}

export interface WorkspaceFilters {
  branchTypes: BranchType[];
  branchStatuses: BranchStatus[];
  minFundingPct: number;
  nodeCategories: string[];
  connectionFilter: 'all' | 'onlyConnected' | 'onlyUnconnected';
  connectedToPlacementIds?: string[];
}

export type RiskSeverity = 'low' | 'moderate' | 'elevated' | 'critical';

export interface RiskFailureScenario {
  id: string;
  title: string;
  severity: RiskSeverity;
  likelihood: 'low' | 'medium' | 'high';
  triggerCondition: string;
  affectedPlacementIds: string[];
  mitigationAction: string;
  status: 'open' | 'mitigating' | 'resolved';
}

export interface AgentRiskAssessment {
  assessedAt: string;
  assessedBy: string; // e.g., "Claude Code via MCP" or "Human"
  overallPosition: string;
  parameterCommentary: Record<'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6', string>;
  failureScenarios: RiskFailureScenario[];
  publicChoiceDiagnosis: string;
}

export interface AgentMutationStamp {
  agentName: string;
  toolName: string;
  summary: string;
  timestamp: string;
}

export interface Workbook {
  workbookId: string;
  title: string;
  description: string;
  targetBudgetInr: number;
  status: 'active' | 'archived' | 'draft';
  schemaVersion?: number;
  revision?: number;
  utilityWeights?: UtilityStrategyWeights;
  riskAssessment?: AgentRiskAssessment;
  lastAgentMutation?: AgentMutationStamp;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export interface Placement {
  placementId: string;
  workbookId?: string;
  entityId: string;
  isRootNgo: boolean;
  // Visual placement geometry
  x: number;
  y: number;
  width: number;
  height: number;
  // Version 2 Public Choice Theory attributes
  selectiveIncentives?: SelectiveIncentiveTag[];
  coOwnershipSignals?: CoOwnershipChecklist;
  outreachAttempts?: number; // Integer >= 1 (Buchanan-Tullock decision cost)
}

export interface Branch {
  branchId: string;
  workbookId?: string;
  sourcePlacementId: string;
  targetPlacementId: string;
  type: BranchType;
  status: BranchStatus;
  valuePct?: number;       // Strict percentage of targetBudgetInr (Green only)
  inKindValueInr?: number; // White only: optional verifiable asset value in INR
  note: string;
  createdAt?: string;      // ISO 8601 string
  updatedAt: string;       // ISO 8601 string
  resolvedAt?: string;     // ISO 8601 string when confirmed/declined
}

export interface WorkbookFile {
  schemaVersion: 2;
  workbookId: string;
  revision: number;
  title: string;
  description: string;
  targetBudgetInr: number;
  status: 'active' | 'draft' | 'archived';
  utilityWeights: UtilityStrategyWeights;
  placements: Record<string, Placement>;
  branches: Record<string, Branch>;
  entities?: Record<string, Entity>;
  riskAssessment?: AgentRiskAssessment;
  lastAgentMutation?: AgentMutationStamp;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbookSummaryRef {
  workbookId: string;
  fileName: string; // e.g., "workbooks/wb_youth_exhibition.json"
  title: string;
  status: 'active' | 'draft' | 'archived';
  updatedAt: string;
}

export interface WorkbookLink {
  linkId: string;
  sourceWorkbookId: string;
  targetWorkbookId: string;
  relationLabel: string;
  note: string;
}

export interface WorkspaceManifest {
  schemaVersion: 2;
  workspaceId: string;
  name: string;
  revision: number;
  workbooks: Record<string, WorkbookSummaryRef>;
  workbookLinks: Record<string, WorkbookLink>;
  createdAt: string;
  updatedAt: string;
  sourceType?: WorkspaceSourceType;
  folderPath?: string;
  gdriveSyncStatus?: 'Synced' | 'Syncing' | 'Conflict' | 'Offline Cache';
  userDeletedSample?: boolean;
}

export interface RecentEntityIndexEntry {
  entityId: string;
  name: string;
  normalizedName: string;
  category: EntityCategory;
  workspaceId: string;
  workspaceName: string;
  sourceType: WorkspaceSourceType;
  workbookMentions: Array<{ workbookId: string; workbookTitle: string; lastSeenAt: string }>;
  confirmedYellowOutCount?: number;
  targetYellowLeads?: Array<{
    targetEntityId: string;
    targetEntityName: string;
    targetCategory: EntityCategory;
    note: string;
  }>;
  historySummary?: string;
}

export interface WorkspaceState {
  schemaVersion: 1 | 2;
  activeWorkbookId: string;
  workspaceId?: string;
  workspaceName?: string;
  sourceType?: WorkspaceSourceType;
  folderPath?: string;
  gdriveSyncStatus?: 'Synced' | 'Syncing' | 'Conflict' | 'Offline Cache';
  userDeletedSample?: boolean;
  entities: Record<string, Entity>;
  workbooks: Record<string, Workbook>;
  placements: Record<string, Placement>;
  branches: Record<string, Branch>;
  workbookLinks: Record<string, WorkbookLink>;
}

export const DEFAULT_CO_OWNERSHIP_SIGNALS: CoOwnershipChecklist = {
  writtenCommitment: false,
  brandOrLogoShared: false,
  staffAssigned: false,
  networkMobilized: false,
};

/**
 * Lossless migration layer upgrading any v1 or partially-typed workspace state to Version 2.
 */
export function migrateToSchemaV2(raw: any): WorkspaceState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot migrate non-object to Schema V2');
  }

  const activeWorkbookId = typeof raw.activeWorkbookId === 'string' ? raw.activeWorkbookId : 'wb-default';
  const entities: Record<string, Entity> = {};
  if (raw.entities && typeof raw.entities === 'object') {
    for (const [id, ent] of Object.entries(raw.entities as Record<string, any>)) {
      entities[id] = {
        ...ent,
        entityId: ent.entityId || id,
        name: ent.name || 'Unnamed Organization',
        category: ent.category || 'other',
        globalNotes: ent.globalNotes || '',
        createdAt: ent.createdAt || new Date().toISOString(),
        updatedAt: ent.updatedAt || ent.createdAt || new Date().toISOString(),
      };
    }
  }

  const workbooks: Record<string, Workbook> = {};
  if (raw.workbooks && typeof raw.workbooks === 'object') {
    for (const [id, wb] of Object.entries(raw.workbooks as Record<string, any>)) {
      workbooks[id] = {
        ...wb,
        workbookId: wb.workbookId || id,
        title: wb.title || 'Untitled Workbook',
        description: wb.description || '',
        targetBudgetInr: typeof wb.targetBudgetInr === 'number' ? wb.targetBudgetInr : 0,
        status: wb.status || 'active',
        createdAt: wb.createdAt || new Date().toISOString(),
        updatedAt: wb.updatedAt || new Date().toISOString(),
        utilityWeights: wb.utilityWeights || { ...DEFAULT_UTILITY_WEIGHTS },
      };
    }
  }

  const placements: Record<string, Placement> = {};
  if (raw.placements && typeof raw.placements === 'object') {
    for (const [id, plc] of Object.entries(raw.placements as Record<string, any>)) {
      placements[id] = {
        ...plc,
        placementId: plc.placementId || id,
        entityId: plc.entityId || '',
        isRootNgo: Boolean(plc.isRootNgo),
        x: typeof plc.x === 'number' ? plc.x : 0,
        y: typeof plc.y === 'number' ? plc.y : 0,
        width: typeof plc.width === 'number' ? plc.width : 190,
        height: typeof plc.height === 'number' ? plc.height : 76,
        outreachAttempts: typeof plc.outreachAttempts === 'number' && plc.outreachAttempts >= 1 ? plc.outreachAttempts : 1,
        coOwnershipSignals: plc.coOwnershipSignals ? {
          writtenCommitment: Boolean(plc.coOwnershipSignals.writtenCommitment),
          brandOrLogoShared: Boolean(plc.coOwnershipSignals.brandOrLogoShared),
          staffAssigned: Boolean(plc.coOwnershipSignals.staffAssigned),
          networkMobilized: Boolean(plc.coOwnershipSignals.networkMobilized),
        } : { ...DEFAULT_CO_OWNERSHIP_SIGNALS },
        selectiveIncentives: Array.isArray(plc.selectiveIncentives) ? [...plc.selectiveIncentives] : [],
      };
    }
  }

  const branches: Record<string, Branch> = {};
  if (raw.branches && typeof raw.branches === 'object') {
    for (const [id, br] of Object.entries(raw.branches as Record<string, any>)) {
      branches[id] = {
        ...br,
        branchId: br.branchId || id,
        sourcePlacementId: br.sourcePlacementId || '',
        targetPlacementId: br.targetPlacementId || '',
        type: br.type || 'white',
        status: br.status || 'pending',
        valuePct: typeof br.valuePct === 'number' ? br.valuePct : undefined,
        inKindValueInr: typeof br.inKindValueInr === 'number' ? br.inKindValueInr : undefined,
        note: br.note || '',
        createdAt: br.createdAt || br.updatedAt || new Date().toISOString(),
        updatedAt: br.updatedAt || new Date().toISOString(),
        resolvedAt: br.resolvedAt,
      };
    }
  }

  const workbookLinks: Record<string, WorkbookLink> = {};
  if (raw.workbookLinks && typeof raw.workbookLinks === 'object') {
    for (const [id, link] of Object.entries(raw.workbookLinks as Record<string, any>)) {
      workbookLinks[id] = { ...link };
    }
  }

  return {
    schemaVersion: 2,
    activeWorkbookId,
    workspaceId:
      typeof raw.workspaceId === 'string' && raw.workspaceId.trim().length > 0
        ? raw.workspaceId
        : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceName:
      typeof raw.workspaceName === 'string' && raw.workspaceName.trim().length > 0
        ? raw.workspaceName
        : (Object.values(workbooks)[0]?.title || 'Imported Workspace'),
    sourceType: raw.sourceType === 'gdrive' || raw.sourceType === 'local' ? raw.sourceType : undefined,
    folderPath: typeof raw.folderPath === 'string' ? raw.folderPath : undefined,
    gdriveSyncStatus: raw.gdriveSyncStatus,
    userDeletedSample: Boolean(raw.userDeletedSample),
    entities,
    workbooks,
    placements,
    branches,
    workbookLinks,
  };
}
