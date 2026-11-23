import type { WorkspaceState, WorkbookFile } from '../types/schema';

/**
 * Async boundary interface decoupling all persistence from the UI/engine layer.
 * All persistent operations must flow exclusively through this interface.
 */
export interface WorkspaceRepository {
  loadWorkspace(): Promise<WorkspaceState | null>;
  saveWorkspace(state: WorkspaceState): Promise<void>;
  exportWorkspaceFile(state: WorkspaceState): Promise<void>;
  importWorkspaceFile(): Promise<WorkspaceState | null>;
  revertLastSnapshot?(workbookId: string): Promise<boolean>;
  getAvailableSnapshots?(workbookId: string): Promise<string[]>;
}

/**
 * Runtime type guard validating raw JSON or deserialized data conforms to WorkspaceState schema version 1.
 */
export function isWorkspaceState(data: unknown): data is WorkspaceState {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return false;
  }

  if (typeof obj.activeWorkbookId !== 'string') {
    return false;
  }

  const isPlainRecord = (val: unknown): boolean =>
    typeof val === 'object' && val !== null && !Array.isArray(val);

  if (
    !isPlainRecord(obj.entities) ||
    !isPlainRecord(obj.workbooks) ||
    !isPlainRecord(obj.placements) ||
    !isPlainRecord(obj.branches) ||
    !isPlainRecord(obj.workbookLinks)
  ) {
    return false;
  }

  // If workbooks are present, activeWorkbookId must be a valid non-empty string
  const wbCount = Object.keys(obj.workbooks as Record<string, unknown>).length;
  if (wbCount > 0 && obj.activeWorkbookId.trim().length === 0) {
    return false;
  }

  // Ensure entries inside dictionaries are valid objects (not null or primitive)
  const dictionaries = [
    obj.entities as Record<string, unknown>,
    obj.workbooks as Record<string, unknown>,
    obj.placements as Record<string, unknown>,
    obj.branches as Record<string, unknown>,
    obj.workbookLinks as Record<string, unknown>,
  ];

  for (const dict of dictionaries) {
    for (const val of Object.values(dict)) {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Runtime type guard validating raw JSON conforms to WorkspaceState schema version 2.
 */
export function isWorkspaceV2State(data: unknown): data is WorkspaceState {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj.schemaVersion !== 2) {
    return false;
  }
  return isWorkspaceState({ ...obj, schemaVersion: 1 });
}

/**
 * Accepts both Version 1 and Version 2 WorkspaceState JSON formats.
 */
export function isAnyWorkspaceState(data: unknown): data is WorkspaceState {
  return isWorkspaceState(data) || isWorkspaceV2State(data);
}

/**
 * Runtime type guard validating whether raw JSON is a single WorkbookFile export.
 */
export function isWorkbookFile(data: unknown): data is WorkbookFile {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  const isPlainRecord = (val: unknown): boolean =>
    typeof val === 'object' && val !== null && !Array.isArray(val);

  // Must have placements and branches dictionaries
  if (!isPlainRecord(obj.placements) || !isPlainRecord(obj.branches)) {
    return false;
  }

  // If it already has entities and workbooks dictionaries, it is a WorkspaceState, not a WorkbookFile
  if (isPlainRecord(obj.entities) && isPlainRecord(obj.workbooks)) {
    return false;
  }

  return true;
}

/**
 * Runtime type guard validating whether raw JSON is a multi-file WorkspaceFolderBundle package.
 */
export function isWorkspaceFolderBundle(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.bundleFormat === 'qualcount-folder-bundle-v2' ||
    (typeof obj.manifest === 'object' &&
      obj.manifest !== null &&
      typeof obj.entitiesFile === 'object' &&
      obj.entitiesFile !== null &&
      typeof obj.workbookFiles === 'object' &&
      obj.workbookFiles !== null)
  );
}

/**
 * Checks whether raw data is tabular outreach JSON (array of objects or object with rows array).
 */
export function isTabularJsonData(data: unknown): boolean {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    return true;
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (
      Array.isArray(obj.rows) ||
      Array.isArray(obj.data) ||
      Array.isArray(obj.partnerships) ||
      Array.isArray(obj.records) ||
      Array.isArray(obj.items)
    ) {
      return true;
    }
  }
  return false;
}

