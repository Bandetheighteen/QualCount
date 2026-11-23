import type {
  WorkspaceState,
  WorkspaceManifest,
  EntitiesFile,
  WorkbookFile,
  WorkbookSummaryRef,
  Workbook,
  Placement,
  Branch,
  Entity,
} from '../types/schema';
import { migrateToSchemaV2, DEFAULT_UTILITY_WEIGHTS } from '../types/schema';
import {
  isWorkbookFile,
  isWorkspaceFolderBundle,
  isTabularJsonData,
} from './workspaceRepository';
import { parseTabularJson, parseStructuredCsv, commitImportedRows } from '../io/spreadsheetImport';

export interface SerializedFolderWorkspace {
  manifest: WorkspaceManifest;
  entitiesFile: EntitiesFile;
  workbookFiles: Record<string, WorkbookFile>;
}

export interface WorkspaceFolderBundle {
  bundleFormat: 'qualcount-folder-bundle-v2';
  manifest: WorkspaceManifest;
  entitiesFile: EntitiesFile;
  workbookFiles: Record<string, WorkbookFile>;
  exportedAt: string;
}

/**
 * Deconstructs a unified WorkspaceState into a canonical portable Workspace Folder
 * consisting of workspace.json (manifest), entities.json, and workbooks/wb_<id>.json.
 */
export function serializeWorkspaceToFolder(state: WorkspaceState): SerializedFolderWorkspace {
  const v2State = migrateToSchemaV2(state);
  const now = new Date().toISOString();

  // 1. Entities file (entities.json)
  const entitiesFile: EntitiesFile = {
    schemaVersion: 2,
    revision: 1,
    updatedAt: now,
    entities: { ...v2State.entities },
  };

  // 2. Map of workbooks and their respective placements & branches
  const workbookFiles: Record<string, WorkbookFile> = {};
  const workbookSummaries: Record<string, WorkbookSummaryRef> = {};

  const allWbEntries = Object.entries(v2State.workbooks);
  const singleWbId = allWbEntries.length === 1 ? allWbEntries[0][0] : null;

  for (const [wbId, wb] of allWbEntries) {
    // Collect placements for this workbook
    const wbPlacements: Record<string, Placement> = {};
    for (const [plcId, plc] of Object.entries(v2State.placements)) {
      if (plc.workbookId === wbId || (singleWbId && !plc.workbookId)) {
        wbPlacements[plcId] = {
          ...plc,
          workbookId: wbId,
        };
      }
    }

    // Collect branches for this workbook
    const wbBranches: Record<string, Branch> = {};
    for (const [brId, br] of Object.entries(v2State.branches)) {
      if (
        br.workbookId === wbId ||
        (singleWbId && !br.workbookId) ||
        (wbPlacements[br.sourcePlacementId] && wbPlacements[br.targetPlacementId])
      ) {
        wbBranches[brId] = {
          ...br,
          workbookId: wbId,
        };
      }
    }

    const wbFile: WorkbookFile = {
      schemaVersion: 2,
      workbookId: wb.workbookId,
      revision: wb.revision || 1,
      title: wb.title,
      description: wb.description || '',
      targetBudgetInr: wb.targetBudgetInr || 0,
      status: wb.status || 'active',
      utilityWeights: wb.utilityWeights || { ...DEFAULT_UTILITY_WEIGHTS },
      placements: wbPlacements,
      branches: wbBranches,
      riskAssessment: wb.riskAssessment,
      lastAgentMutation: wb.lastAgentMutation,
      createdAt: wb.createdAt || now,
      updatedAt: wb.updatedAt || now,
    };

    workbookFiles[wbId] = wbFile;

    workbookSummaries[wbId] = {
      workbookId: wb.workbookId,
      fileName: `workbooks/wb_${wb.workbookId}.json`,
      title: wb.title,
      status: wb.status,
      updatedAt: wb.updatedAt,
    };
  }

  // 3. Manifest file (workspace.json)
  const activeWb = v2State.workbooks[v2State.activeWorkbookId] || Object.values(v2State.workbooks)[0];
  const manifest: WorkspaceManifest = {
    schemaVersion: 2,
    workspaceId: v2State.workspaceId || `ws_${v2State.activeWorkbookId || 'default'}`,
    name: v2State.workspaceName || (activeWb?.title ? `${activeWb.title} Workspace` : 'QualCount Workspace'),
    revision: 1,
    workbooks: workbookSummaries,
    workbookLinks: { ...v2State.workbookLinks },
    sourceType: v2State.sourceType,
    folderPath: v2State.folderPath,
    gdriveSyncStatus: v2State.gdriveSyncStatus,
    userDeletedSample: v2State.userDeletedSample,
    createdAt: activeWb?.createdAt || now,
    updatedAt: now,
  };

  return {
    manifest,
    entitiesFile,
    workbookFiles,
  };
}

/**
 * Reassembles disparate folder files (workspace.json, entities.json, workbooks/*.json)
 * into a unified WorkspaceState with full data fidelity and schema validation.
 */
export function deserializeFolderToWorkspace(
  manifest: WorkspaceManifest,
  entitiesFile: EntitiesFile,
  workbookFiles: Record<string, WorkbookFile>
): WorkspaceState {
  if (!manifest || !entitiesFile || !workbookFiles) {
    throw new Error('[deserializeFolderToWorkspace] Missing required folder files');
  }

  const workbooks: Record<string, Workbook> = {};
  const placements: Record<string, Placement> = {};
  const branches: Record<string, Branch> = {};

  for (const [wbKey, wbFile] of Object.entries(workbookFiles)) {
    const wbId = wbFile.workbookId || wbKey;
    workbooks[wbId] = {
      workbookId: wbId,
      title: wbFile.title || 'Untitled Workbook',
      description: wbFile.description || '',
      targetBudgetInr: typeof wbFile.targetBudgetInr === 'number' ? wbFile.targetBudgetInr : 0,
      status: wbFile.status || 'active',
      schemaVersion: 2,
      revision: wbFile.revision || 1,
      utilityWeights: wbFile.utilityWeights || { ...DEFAULT_UTILITY_WEIGHTS },
      riskAssessment: wbFile.riskAssessment,
      lastAgentMutation: wbFile.lastAgentMutation,
      createdAt: wbFile.createdAt || new Date().toISOString(),
      updatedAt: wbFile.updatedAt || new Date().toISOString(),
    };

    if (wbFile.placements && typeof wbFile.placements === 'object') {
      for (const [plcId, plc] of Object.entries(wbFile.placements)) {
        placements[plcId] = {
          ...plc,
          placementId: plc.placementId || plcId,
          workbookId: wbId,
        };
      }
    }

    if (wbFile.branches && typeof wbFile.branches === 'object') {
      for (const [brId, br] of Object.entries(wbFile.branches)) {
        branches[brId] = {
          ...br,
          branchId: br.branchId || brId,
          workbookId: wbId,
        };
      }
    }
  }

  // Determine active workbook
  const wbIds = Object.keys(workbooks);
  const candidateActiveId = Object.keys(manifest.workbooks || {})[0] || wbIds[0] || '';
  const activeWorkbookId = wbIds.includes(candidateActiveId) ? candidateActiveId : (wbIds[0] || '');

  const rawState = {
    schemaVersion: 2,
    activeWorkbookId,
    workspaceId: manifest.workspaceId,
    workspaceName: manifest.name,
    sourceType: manifest.sourceType,
    folderPath: manifest.folderPath,
    gdriveSyncStatus: manifest.gdriveSyncStatus,
    entities: entitiesFile.entities || {},
    workbooks,
    placements,
    branches,
    workbookLinks: manifest.workbookLinks || {},
    userDeletedSample: Boolean(manifest.userDeletedSample),
  };

  return migrateToSchemaV2(rawState);
}

/**
 * Packages the multi-file workspace folder into a portable JSON bundle for download.
 */
export async function exportWorkspaceBundle(state: WorkspaceState): Promise<Blob> {
  const folder = serializeWorkspaceToFolder(state);
  const bundle: WorkspaceFolderBundle = {
    bundleFormat: 'qualcount-folder-bundle-v2',
    manifest: folder.manifest,
    entitiesFile: folder.entitiesFile,
    workbookFiles: folder.workbookFiles,
    exportedAt: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(bundle, null, 2);
  return new Blob([jsonString], { type: 'application/json;charset=utf-8' });
}

/**
 * Converts a single standalone WorkbookFile into a valid unified WorkspaceState,
 * synthesizing any missing entities or merging into an optional baseState.
 */
export function convertWorkbookFileToWorkspace(
  wbFile: WorkbookFile,
  baseState?: WorkspaceState | null
): WorkspaceState {
  const now = new Date().toISOString();
  const wbId = wbFile.workbookId || `wb_${Date.now()}`;

  const workbook: Workbook = {
    workbookId: wbId,
    title: wbFile.title || 'Imported Workbook',
    description: wbFile.description || '',
    targetBudgetInr: typeof wbFile.targetBudgetInr === 'number' ? wbFile.targetBudgetInr : 0,
    status: wbFile.status || 'active',
    schemaVersion: 2,
    revision: wbFile.revision || 1,
    utilityWeights: wbFile.utilityWeights || { ...DEFAULT_UTILITY_WEIGHTS },
    riskAssessment: wbFile.riskAssessment,
    lastAgentMutation: wbFile.lastAgentMutation,
    createdAt: wbFile.createdAt || now,
    updatedAt: wbFile.updatedAt || now,
  };

  const existingEntities: Record<string, Entity> = baseState?.entities ? { ...baseState.entities } : {};
  const existingWorkbooks: Record<string, Workbook> = baseState?.workbooks ? { ...baseState.workbooks } : {};
  const existingPlacements: Record<string, Placement> = baseState?.placements ? { ...baseState.placements } : {};
  const existingBranches: Record<string, Branch> = baseState?.branches ? { ...baseState.branches } : {};
  const existingLinks = baseState?.workbookLinks ? { ...baseState.workbookLinks } : {};

  existingWorkbooks[wbId] = workbook;

  // Import self-contained entities from standalone Workbook file if present
  if (wbFile.entities && typeof wbFile.entities === 'object') {
    for (const [id, ent] of Object.entries(wbFile.entities)) {
      if (ent && typeof ent === 'object') {
        existingEntities[id] = {
          ...ent,
          entityId: ent.entityId || id,
          name: ent.name || 'Unnamed Organization',
          category: ent.category || 'other',
          globalNotes: ent.globalNotes || '',
          createdAt: ent.createdAt || now,
          updatedAt: ent.updatedAt || now,
        };
      }
    }
  }

  for (const [plcId, plc] of Object.entries(wbFile.placements || {})) {
    const pId = plc.placementId || plcId;
    existingPlacements[pId] = {
      ...plc,
      placementId: pId,
      workbookId: wbId,
    };
    if (plc.entityId && !existingEntities[plc.entityId]) {
      existingEntities[plc.entityId] = {
        entityId: plc.entityId,
        name: (plc as any).name || (plc as any).entityName || plc.entityId,
        category: (plc as any).category || 'other',
        globalNotes: 'Imported with workbook',
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  for (const [brId, br] of Object.entries(wbFile.branches || {})) {
    const bId = br.branchId || brId;
    existingBranches[bId] = {
      ...br,
      branchId: bId,
      workbookId: wbId,
    };
  }

  const rawState = {
    schemaVersion: 2,
    activeWorkbookId: wbId,
    workspaceId: baseState?.workspaceId || `ws_${wbId}`,
    workspaceName: baseState?.workspaceName || (workbook.title ? `${workbook.title} Workspace` : 'Imported Workspace'),
    entities: existingEntities,
    workbooks: existingWorkbooks,
    placements: existingPlacements,
    branches: existingBranches,
    workbookLinks: existingLinks,
  };

  return migrateToSchemaV2(rawState);
}

/**
 * Parses an uploaded workspace bundle (Blob or JSON string) with strict schema validation.
 * Supports multi-file folder bundles, unified JSON files, standalone workbook files, and tabular JSON.
 */
export async function importWorkspaceBundle(
  bundleInput: Blob | string,
  currentState?: WorkspaceState | null
): Promise<WorkspaceState> {
  let jsonText: string;

  if (typeof bundleInput === 'string') {
    jsonText = bundleInput;
  } else if (typeof bundleInput.text === 'function') {
    jsonText = await bundleInput.text();
  } else {
    jsonText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(bundleInput);
    });
  }

  const trimmed = jsonText.trim();
  let parsed: unknown;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Fall through to CSV
    }
  }

  // If not JSON or failed JSON, try parsing as structured CSV
  if (!parsed) {
    const rows = parseStructuredCsv(jsonText);
    if (rows.length > 0) {
      const targetWbId = currentState?.activeWorkbookId || 'wb-imported';
      const baseState = currentState || migrateToSchemaV2({
        schemaVersion: 2,
        activeWorkbookId: targetWbId,
        entities: {},
        workbooks: {
          [targetWbId]: {
            workbookId: targetWbId,
            title: 'Imported CSV Outreach Data',
            description: 'Imported from structured CSV spreadsheet',
            targetBudgetInr: 1000000,
            status: 'active',
          },
        },
        placements: {},
        branches: {},
        workbookLinks: {},
      });
      return await commitImportedRows(rows, targetWbId, baseState);
    }
    throw new Error('Unrecognized file format: neither valid JSON nor structured CSV.');
  }

  // 1. Check if it is a folder bundle package
  if (
    parsed &&
    typeof parsed === 'object' &&
    (isWorkspaceFolderBundle(parsed) ||
      'bundleFormat' in parsed ||
      ('manifest' in parsed && 'entitiesFile' in parsed && 'workbookFiles' in parsed))
  ) {
    const bundle = parsed as WorkspaceFolderBundle;
    return deserializeFolderToWorkspace(bundle.manifest, bundle.entitiesFile, bundle.workbookFiles);
  }

  // 2. Check if it is a single standalone WorkbookFile
  if (isWorkbookFile(parsed)) {
    return convertWorkbookFileToWorkspace(parsed as WorkbookFile, currentState);
  }

  // 3. Check if it is tabular JSON array of outreach rows
  if (isTabularJsonData(parsed)) {
    const rows = parseTabularJson(parsed);
    if (rows.length > 0) {
      const targetWbId = currentState?.activeWorkbookId || 'wb-imported';
      const baseState = currentState || migrateToSchemaV2({
        schemaVersion: 2,
        activeWorkbookId: targetWbId,
        entities: {},
        workbooks: {
          [targetWbId]: {
            workbookId: targetWbId,
            title: 'Imported Outreach Data',
            description: 'Imported from tabular outreach JSON',
            targetBudgetInr: 1000000,
            status: 'active',
          },
        },
        placements: {},
        branches: {},
        workbookLinks: {},
      });
      return await commitImportedRows(rows, targetWbId, baseState);
    }
  }

  // 4. Standard WorkspaceState or fallback: migrate as unified state
  return migrateToSchemaV2(parsed);
}

/**
 * Serializes a single standalone Workbook into a self-contained WorkbookFile JSON object
 * containing its metadata, placements, branches, utility weights, risk assessment,
 * and all referenced entities.
 */
export function serializeWorkbookToFile(
  state: WorkspaceState,
  workbookId: string
): WorkbookFile {
  const v2State = migrateToSchemaV2(state);
  const now = new Date().toISOString();
  const wb = v2State.workbooks[workbookId] || Object.values(v2State.workbooks)[0];
  const wbId = wb?.workbookId || workbookId;

  const wbPlacements: Record<string, Placement> = {};
  const wbEntities: Record<string, Entity> = {};

  const singleWb = Object.keys(v2State.workbooks).length <= 1;

  for (const [plcId, plc] of Object.entries(v2State.placements)) {
    if (plc.workbookId === wbId || (singleWb && !plc.workbookId)) {
      wbPlacements[plcId] = {
        ...plc,
        workbookId: wbId,
      };
      if (plc.entityId && v2State.entities[plc.entityId]) {
        wbEntities[plc.entityId] = { ...v2State.entities[plc.entityId] };
      }
    }
  }

  // Retain all referenced or existing entities for complete standalone fidelity
  for (const [entId, ent] of Object.entries(v2State.entities)) {
    if (!wbEntities[entId]) {
      wbEntities[entId] = { ...ent };
    }
  }

  const wbBranches: Record<string, Branch> = {};
  for (const [brId, br] of Object.entries(v2State.branches)) {
    if (
      br.workbookId === wbId ||
      (singleWb && !br.workbookId) ||
      (wbPlacements[br.sourcePlacementId] && wbPlacements[br.targetPlacementId])
    ) {
      wbBranches[brId] = {
        ...br,
        workbookId: wbId,
      };
    }
  }

  return {
    schemaVersion: 2,
    workbookId: wbId,
    revision: (wb?.revision || 1) + 1,
    title: wb?.title || 'Untitled Workbook',
    description: wb?.description || '',
    targetBudgetInr: wb?.targetBudgetInr || 0,
    status: wb?.status || 'active',
    utilityWeights: wb?.utilityWeights || { ...DEFAULT_UTILITY_WEIGHTS },
    placements: wbPlacements,
    branches: wbBranches,
    entities: wbEntities,
    riskAssessment: wb?.riskAssessment,
    lastAgentMutation: wb?.lastAgentMutation,
    createdAt: wb?.createdAt || now,
    updatedAt: now,
  };
}
