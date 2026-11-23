import type { WorkspaceState, RecentEntityIndexEntry, WorkbookFile } from '../types/schema';
import {
  type WorkspaceRepository,
  isWorkspaceState,
  isWorkspaceV2State,
  isWorkbookFile,
  isWorkspaceFolderBundle,
  isTabularJsonData,
} from './workspaceRepository';
import { migrateToSchemaV2 } from '../types/schema';
import {
  deserializeFolderToWorkspace,
  convertWorkbookFileToWorkspace,
  type WorkspaceFolderBundle,
} from './folderSerializer';
import { parseTabularJson, commitImportedRows } from '../io/spreadsheetImport';

const STORAGE_KEY = 'qualcount_workspace_v1';

/**
 * Phase 1 Web persistence adapter:
 * Persists validated WorkspaceState JSON to browser localStorage
 * and handles web-based JSON file export and import.
 */
export class LocalStorageRepository implements WorkspaceRepository {
  async loadWorkspace(): Promise<WorkspaceState | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (isWorkspaceState(parsed) || isWorkspaceV2State(parsed)) {
        return parsed;
      }
      console.warn('[LocalStorageRepository] Invalid workspace schema in storage. Ignoring.');
      return null;
    } catch (err) {
      console.error('[LocalStorageRepository] Failed to read from localStorage:', err);
      return null;
    }
  }

  async saveWorkspace(state: WorkspaceState): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('[LocalStorageRepository] localStorage is not available in current environment');
    }
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (err) {
      console.error('[LocalStorageRepository] Failed to save to localStorage:', err);
      throw err;
    }
  }

  async exportWorkspaceFile(state: WorkspaceState): Promise<void> {
    if (typeof document === 'undefined') {
      throw new Error('[LocalStorageRepository] document is not available in current environment');
    }
    try {
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `qualcount-workspace-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Defer URL revocation so async browser download managers can safely read the Blob stream
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[LocalStorageRepository] Failed to export workspace file:', err);
      throw err;
    }
  }

  async importWorkspaceFile(): Promise<WorkspaceState | null> {
    if (typeof document === 'undefined') {
      throw new Error('[LocalStorageRepository] document is not available in current environment');
    }
    return new Promise<WorkspaceState | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      let resolved = false;

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      const handleDone = (result: WorkspaceState | null) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          handleDone(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
              handleDone(null);
              return;
            }
            const parsed: unknown = JSON.parse(text);

            if (isWorkspaceState(parsed)) {
              handleDone(parsed);
            } else if (isWorkspaceV2State(parsed)) {
              handleDone(parsed);
            } else if (isWorkspaceFolderBundle(parsed)) {
              const bundle = parsed as WorkspaceFolderBundle;
              handleDone(
                deserializeFolderToWorkspace(bundle.manifest, bundle.entitiesFile, bundle.workbookFiles)
              );
            } else if (isWorkbookFile(parsed)) {
              handleDone(convertWorkbookFileToWorkspace(parsed as WorkbookFile));
            } else if (isTabularJsonData(parsed)) {
              const rows = parseTabularJson(parsed);
              if (rows.length > 0) {
                const baseState = migrateToSchemaV2({
                  schemaVersion: 2,
                  activeWorkbookId: 'wb-imported',
                  entities: {},
                  workbooks: {
                    'wb-imported': {
                      workbookId: 'wb-imported',
                      title: file.name.replace(/\.[^/.]+$/, ''),
                      description: 'Imported from tabular outreach JSON',
                      targetBudgetInr: 1000000,
                      status: 'active',
                    },
                  },
                  placements: {},
                  branches: {},
                  workbookLinks: {},
                });
                const converted = await commitImportedRows(rows, 'wb-imported', baseState);
                handleDone(converted);
              } else {
                handleDone(null);
              }
            } else {
              // Graceful fallback: try migrating as unified state
              try {
                const migrated = migrateToSchemaV2(parsed);
                if (
                  Object.keys(migrated.workbooks).length > 0 &&
                  (Object.keys(migrated.entities).length > 0 || Object.keys(migrated.placements).length > 0)
                ) {
                  handleDone(migrated);
                } else {
                  console.warn('[LocalStorageRepository] Imported file does not match WorkspaceState schema.');
                  handleDone(null);
                }
              } catch {
                console.warn('[LocalStorageRepository] Imported file does not match WorkspaceState schema.');
                handleDone(null);
              }
            }
          } catch (err) {
            console.error('[LocalStorageRepository] Failed to parse imported JSON file:', err);
            handleDone(null);
          }
        };

        reader.onerror = () => {
          console.error('[LocalStorageRepository] FileReader error:', reader.error);
          handleDone(null);
        };

        reader.readAsText(file);
      };

      input.oncancel = () => {
        handleDone(null);
      };

      if (typeof input.addEventListener === 'function') {
        input.addEventListener('cancel', () => {
          handleDone(null);
        });
      }

      document.body.appendChild(input);
      input.click();
    });
  }
}

const RECENT_INDEX_STORAGE_KEY = 'qualcount_recent_entities_index';
const SAMPLE_DELETED_KEY = 'qualcount_sample_deleted';
const SAVED_WORKSPACES_KEY = 'qualcount_saved_workspaces_v1';

/**
 * Checks whether the sample workspace was permanently deleted by the user.
 */
export function isSampleDeletedPersisted(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(SAMPLE_DELETED_KEY) === 'true';
}

/**
 * Persists or clears the sample workspace deletion tombstone.
 */
export function setSampleDeletedPersisted(deleted: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (deleted) {
      localStorage.setItem(SAMPLE_DELETED_KEY, 'true');
    } else {
      localStorage.removeItem(SAMPLE_DELETED_KEY);
    }
  } catch {
    // Ignore storage quota
  }
}

/**
 * Loads the active workspace synchronously from storage if valid.
 */
export function loadActiveWorkspaceSync(): WorkspaceState | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isWorkspaceState(parsed) || isWorkspaceV2State(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads the list of saved workspaces from storage.
 */
export function loadSavedWorkspacesList(): WorkspaceState[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(SAVED_WORKSPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves the list of saved workspaces to storage.
 */
export function saveSavedWorkspacesList(workspaces: WorkspaceState[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(SAVED_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {
    // Ignore storage quota
  }
}

/**
 * Loads device-local recent entities index from localStorage.
 */
export function loadRecentEntitiesIndex(): RecentEntityIndexEntry[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(RECENT_INDEX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves device-local recent entities index to localStorage.
 */
export function saveRecentEntitiesIndex(index: RecentEntityIndexEntry[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(RECENT_INDEX_STORAGE_KEY, JSON.stringify(index));
  } catch {
    // Ignore storage quota
  }
}
