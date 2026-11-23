export type {
  WorkspaceSourceType,
  EntityCategory,
  BranchType,
  BranchStatus,
  SelectiveIncentiveTag,
  CoOwnershipChecklist,
  UtilityStrategyWeights,
  EntityOriginReference,
  Entity,
  EntitiesFile,
  Placement,
  Branch,
  RiskSeverity,
  RiskFailureScenario,
  AgentRiskAssessment,
  AgentMutationStamp,
  WorkbookFile,
  WorkbookSummaryRef,
  WorkbookLink,
  WorkspaceManifest,
  RecentEntityIndexEntry,
  WorkspaceState,
} from '../../../src/types/schema';

export interface McpServerConfig {
  workspacePath: string;
  agentName?: string;
}
