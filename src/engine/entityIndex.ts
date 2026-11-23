import type {
  Entity,
  EntityCategory,
  Placement,
  Branch,
  Workbook,
  WorkbookFile,
  WorkspaceState,
  RecentEntityIndexEntry,
  WorkspaceSourceType,
} from '../types/schema';

export interface TargetYellowLead {
  targetEntityId: string;
  targetEntityName: string;
  targetCategory: EntityCategory;
  note: string;
}

export interface EntitySearchResult {
  entityId: string;
  name: string;
  category: EntityCategory;
  source: 'current_workspace' | 'external_workspace';
  workspaceName?: string;
  workbookTitle?: string;
  historySummary: string;
  confirmedYellowOutCount: number;
  targetYellowLeads: TargetYellowLead[];
}

/**
 * Builds or updates the cross-workspace recent index from a workspace.
 * Pure TypeScript function with zero DOM/storage dependencies.
 */
export function updateRecentEntitiesIndex(
  workspace: WorkspaceState,
  workspaceName: string,
  sourceType: WorkspaceSourceType = 'local',
  existingIndex: RecentEntityIndexEntry[] = []
): RecentEntityIndexEntry[] {
  const indexMap = new Map<string, RecentEntityIndexEntry>();

  for (const entry of existingIndex) {
    indexMap.set(entry.entityId, entry);
  }

  const now = new Date().toISOString();
  const wsId = workspace.workspaceId || 'ws_default';

  for (const [entityId, entity] of Object.entries(workspace.entities)) {
    const normalizedName = normalizeEntityName(entity.name);

    // Collect workbook mentions
    const mentions: Array<{ workbookId: string; workbookTitle: string; lastSeenAt: string }> = [];
    for (const plc of Object.values(workspace.placements)) {
      if (plc.entityId === entityId && plc.workbookId) {
        const wb = workspace.workbooks[plc.workbookId];
        mentions.push({
          workbookId: plc.workbookId,
          workbookTitle: wb?.title || 'Untitled Workbook',
          lastSeenAt: now,
        });
      }
    }

    // Collect confirmed outgoing yellow referral leads
    const targetYellowLeads: TargetYellowLead[] = [];
    const seenTargetIds = new Set<string>();
    const matchingPlacements = Object.values(workspace.placements).filter((p) => p.entityId === entityId);

    for (const plc of matchingPlacements) {
      for (const br of Object.values(workspace.branches)) {
        if (
          br.sourcePlacementId === plc.placementId &&
          br.type === 'yellow' &&
          br.status === 'tick'
        ) {
          const targetPlc = workspace.placements[br.targetPlacementId];
          if (targetPlc) {
            const targetEnt = workspace.entities[targetPlc.entityId];
            if (targetEnt && !seenTargetIds.has(targetEnt.entityId)) {
              seenTargetIds.add(targetEnt.entityId);
              targetYellowLeads.push({
                targetEntityId: targetEnt.entityId,
                targetEntityName: targetEnt.name,
                targetCategory: targetEnt.category,
                note: br.note || 'Proven referral gateway',
              });
            }
          }
        }
      }
    }

    const confirmedYellowOutCount = targetYellowLeads.length;
    const historySummary = confirmedYellowOutCount > 0
      ? `Proven bridge with ${confirmedYellowOutCount} confirmed referral${confirmedYellowOutCount > 1 ? 's' : ''}`
      : entity.pointsOfContact && entity.pointsOfContact.length > 0
      ? `${entity.pointsOfContact.length} documented point${entity.pointsOfContact.length > 1 ? 's' : ''} of contact`
      : `Found in ${workspaceName} [${sourceType === 'gdrive' ? 'Google Drive' : 'Local'}]`;

    indexMap.set(entityId, {
      entityId,
      name: entity.name,
      normalizedName,
      category: entity.category,
      workspaceId: wsId,
      workspaceName,
      sourceType,
      workbookMentions: mentions.length > 0 ? mentions : [
        {
          workbookId: workspace.activeWorkbookId,
          workbookTitle: workspace.workbooks[workspace.activeWorkbookId]?.title || 'Active Workbook',
          lastSeenAt: now,
        },
      ],
      confirmedYellowOutCount,
      targetYellowLeads,
      historySummary,
    });
  }

  return Array.from(indexMap.values());
}
export function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Searches across current workspace entities and device-local recent cross-workspace index.
 * Gated at query length >= 3 characters.
 */
export function searchCrossWorkbookEntities(
  query: string,
  currentEntities: Record<string, Entity>,
  recentIndex: RecentEntityIndexEntry[] = [],
  currentWorkbooks: Record<string, WorkbookFile | Workbook> = {},
  currentBranches: Record<string, Branch> = {},
  currentPlacements: Record<string, Placement> = {}
): EntitySearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const queryLower = trimmed.toLowerCase();
  const queryNormalized = normalizeEntityName(trimmed);
  const results: EntitySearchResult[] = [];
  const seenEntityNames = new Set<string>();

  // 1. Search current workspace entities
  for (const [entityId, entity] of Object.entries(currentEntities)) {
    const entNameLower = entity.name.toLowerCase();
    const entNameNorm = normalizeEntityName(entity.name);

    if (entNameLower.includes(queryLower) || entNameNorm.includes(queryNormalized)) {
      seenEntityNames.add(entNameNorm);

      // Find all placements for this entity
      const matchingPlacements = Object.values(currentPlacements).filter(
        (p) => p.entityId === entityId
      );

      // Find confirmed outgoing yellow bridges from this entity's placements
      const targetYellowLeads: TargetYellowLead[] = [];
      const seenTargetIds = new Set<string>();

      for (const plc of matchingPlacements) {
        for (const br of Object.values(currentBranches)) {
          if (
            br.sourcePlacementId === plc.placementId &&
            br.type === 'yellow' &&
            br.status === 'tick'
          ) {
            const targetPlc = currentPlacements[br.targetPlacementId];
            if (targetPlc) {
              const targetEnt = currentEntities[targetPlc.entityId];
              if (targetEnt && !seenTargetIds.has(targetEnt.entityId)) {
                seenTargetIds.add(targetEnt.entityId);
                targetYellowLeads.push({
                  targetEntityId: targetEnt.entityId,
                  targetEntityName: targetEnt.name,
                  targetCategory: targetEnt.category,
                  note: br.note || 'Proven referral gateway',
                });
              }
            }
          }
        }
      }

      // Determine active workbook context
      const firstPlc = matchingPlacements[0];
      const wbTitle = firstPlc?.workbookId && currentWorkbooks[firstPlc.workbookId]
        ? currentWorkbooks[firstPlc.workbookId].title
        : undefined;

      const historySummary = targetYellowLeads.length > 0
        ? `Proven bridge with ${targetYellowLeads.length} confirmed referral${targetYellowLeads.length > 1 ? 's' : ''}`
        : entity.pointsOfContact && entity.pointsOfContact.length > 0
        ? `${entity.pointsOfContact.length} documented point${entity.pointsOfContact.length > 1 ? 's' : ''} of contact`
        : 'Registered organization in current workspace';

      results.push({
        entityId,
        name: entity.name,
        category: entity.category,
        source: 'current_workspace',
        workbookTitle: wbTitle,
        historySummary,
        confirmedYellowOutCount: targetYellowLeads.length,
        targetYellowLeads,
      });
    }
  }

  // 2. Search external recent index
  for (const entry of recentIndex) {
    const entryNameNorm = normalizeEntityName(entry.name);
    if (seenEntityNames.has(entryNameNorm)) {
      continue; // Skip if already present in current workspace results
    }

    if (
      entry.name.toLowerCase().includes(queryLower) ||
      entry.normalizedName.includes(queryNormalized)
    ) {
      seenEntityNames.add(entryNameNorm);
      const lastMention = entry.workbookMentions[0];
      const targetYellowLeads: TargetYellowLead[] = entry.targetYellowLeads || [];
      const confirmedYellowOutCount = entry.confirmedYellowOutCount ?? targetYellowLeads.length;
      const historySummary = entry.historySummary ||
        (confirmedYellowOutCount > 0
          ? `Proven referral gateway with ${confirmedYellowOutCount} confirmed lead${confirmedYellowOutCount > 1 ? 's' : ''} in ${entry.workspaceName}`
          : `Found in ${entry.workspaceName} [${entry.sourceType === 'gdrive' ? 'Google Drive' : 'Local'}]`);

      results.push({
        entityId: entry.entityId,
        name: entry.name,
        category: entry.category,
        source: 'external_workspace',
        workspaceName: entry.workspaceName,
        workbookTitle: lastMention?.workbookTitle,
        historySummary,
        confirmedYellowOutCount,
        targetYellowLeads,
      });
    }
  }

  return results;
}
