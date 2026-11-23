import type { WorkspaceState } from '../types/schema';
import type { WorkspaceRepository } from './workspaceRepository';
import {
  serializeWorkspaceToFolder,
  deserializeFolderToWorkspace,
  exportWorkspaceBundle,
  importWorkspaceBundle,
  type SerializedFolderWorkspace,
} from './folderSerializer';

export interface FolderStorageBackend {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
  deleteFile?(path: string): Promise<void>;
}

/**
 * In-memory storage backend partitioned by file paths.
 */
export class MemoryFolderStorageBackend implements FolderStorageBackend {
  private memoryStore: Map<string, string> = new Map();
  private basePrefix: string;

  constructor(basePrefix = 'qualcount_folder_ws') {
    this.basePrefix = basePrefix;
  }

  private getKey(path: string): string {
    return `${this.basePrefix}:${path.replace(/\\/g, '/')}`;
  }

  async readFile(path: string): Promise<string | null> {
    const key = this.getKey(path);
    return this.memoryStore.get(key) ?? null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const key = this.getKey(path);
    this.memoryStore.set(key, content);
  }

  async listFiles(prefix = ''): Promise<string[]> {
    const results = new Set<string>();
    const expectedKeyPrefix = `${this.basePrefix}:${prefix.replace(/\\/g, '/')}`;

    for (const k of this.memoryStore.keys()) {
      if (k.startsWith(expectedKeyPrefix)) {
        results.add(k.substring(this.basePrefix.length + 1));
      }
    }

    return Array.from(results);
  }

  async deleteFile(path: string): Promise<void> {
    const key = this.getKey(path);
    this.memoryStore.delete(key);
  }
}

export const MemoryOrLocalStorageBackend = MemoryFolderStorageBackend;

/**
 * Unified FolderWorkspaceRepository implementing WorkspaceRepository.
 * Manages portable folder structure:
 *  - workspace.json
 *  - entities.json
 *  - workbooks/wb_<id>.json
 *  - .snapshots/wb_<id>_<timestamp>.json (rolling 20 snapshots)
 */
export class FolderWorkspaceRepository implements WorkspaceRepository {
  private backend: FolderStorageBackend;
  private maxSnapshotsPerWorkbook = 20;

  constructor(backend?: FolderStorageBackend) {
    this.backend = backend || new MemoryOrLocalStorageBackend();
  }

  /**
   * Loads and deserializes the workspace folder.
   */
  async loadWorkspace(): Promise<WorkspaceState | null> {
    try {
      const manifestRaw = await this.backend.readFile('workspace.json');
      const entitiesRaw = await this.backend.readFile('entities.json');

      if (!manifestRaw || !entitiesRaw) {
        return null;
      }

      const manifest = JSON.parse(manifestRaw);
      const entitiesFile = JSON.parse(entitiesRaw);

      const workbookFiles: Record<string, any> = {};
      const manifestWbKeys = Object.keys(manifest.workbooks || {});

      if (manifestWbKeys.length > 0) {
        for (const wbId of manifestWbKeys) {
          const summary = manifest.workbooks[wbId];
          const filePath = summary?.fileName || `workbooks/wb_${wbId}.json`;
          const content = await this.backend.readFile(filePath);
          if (content) {
            const wbFile = JSON.parse(content);
            workbookFiles[wbId] = wbFile;
          }
        }
      } else {
        const allFiles = await this.backend.listFiles('workbooks/');
        for (const filePath of allFiles) {
          if (filePath.endsWith('.json')) {
            const content = await this.backend.readFile(filePath);
            if (content) {
              const wbFile = JSON.parse(content);
              const wbId = wbFile.workbookId || filePath.replace(/^workbooks\/wb_/, '').replace(/\.json$/, '');
              workbookFiles[wbId] = wbFile;
            }
          }
        }
      }

      return deserializeFolderToWorkspace(manifest, entitiesFile, workbookFiles);
    } catch (err) {
      console.error('[FolderWorkspaceRepository] Failed to load workspace:', err);
      return null;
    }
  }

  /**
   * Saves the workspace by splitting into workspace.json, entities.json,
   * individual workbooks, and creating a snapshot.
   */
  async saveWorkspace(state: WorkspaceState): Promise<void> {
    try {
      const folder = serializeWorkspaceToFolder(state);

      // Write manifest
      await this.backend.writeFile('workspace.json', JSON.stringify(folder.manifest, null, 2));

      // Write entities file
      await this.backend.writeFile('entities.json', JSON.stringify(folder.entitiesFile, null, 2));

      // Write each workbook file
      for (const [wbId, wbFile] of Object.entries(folder.workbookFiles)) {
        const filePath = `workbooks/wb_${wbId}.json`;
        await this.backend.writeFile(filePath, JSON.stringify(wbFile, null, 2));

        // Save rolling snapshot for active workbook
        if (wbId === state.activeWorkbookId) {
          await this.saveWorkbookSnapshot(wbId, wbFile);
        }
      }

      // Prune deleted workbooks from backend if deleteFile is supported
      if (typeof this.backend.deleteFile === 'function') {
        const existingFiles = await this.backend.listFiles('workbooks/');
        const currentFilePaths = new Set(
          Object.keys(folder.workbookFiles).map((id) => `workbooks/wb_${id}.json`)
        );
        for (const file of existingFiles) {
          if (file.endsWith('.json') && !currentFilePaths.has(file)) {
            await this.backend.deleteFile(file);
          }
        }
      }
    } catch (err) {
      console.error('[FolderWorkspaceRepository] Failed to save workspace:', err);
      throw err;
    }
  }

  /**
   * Creates a rolling snapshot under .snapshots/wb_<id>_<timestamp>.json
   */
  private async saveWorkbookSnapshot(wbId: string, wbFile: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = `.snapshots/wb_${wbId}_${timestamp}.json`;
    await this.backend.writeFile(snapshotPath, JSON.stringify(wbFile, null, 2));

    // Prune snapshots if count exceeds limit
    try {
      const allSnapshots = await this.backend.listFiles(`.snapshots/wb_${wbId}_`);
      if (allSnapshots.length > this.maxSnapshotsPerWorkbook) {
        // Sort oldest first
        allSnapshots.sort();
        const toRemove = allSnapshots.slice(0, allSnapshots.length - this.maxSnapshotsPerWorkbook);
        for (const file of toRemove) {
          if (this.backend.deleteFile) {
            await this.backend.deleteFile(file);
          }
        }
      }
    } catch {
      // Ignore prune errors
    }

    return snapshotPath;
  }

  /**
   * Saves a manual snapshot for the active or all workbooks.
   */
  async saveSnapshot(state: WorkspaceState, label?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = label ? `_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const folder = serializeWorkspaceToFolder(state);
    const snapshotPath = `.snapshots/full_ws_${timestamp}${safeLabel}.json`;

    await this.backend.writeFile(snapshotPath, JSON.stringify(folder, null, 2));
    return snapshotPath;
  }

  /**
   * Lists all existing snapshots.
   */
  async listSnapshots(): Promise<string[]> {
    const files = await this.backend.listFiles('.snapshots/');
    return files.filter((f) => f.endsWith('.json')).sort().reverse();
  }

  /**
   * Lists available snapshot filenames for a specific workbook, newest first.
   */
  async getAvailableSnapshots(workbookId: string): Promise<string[]> {
    try {
      const files = await this.backend.listFiles(`.snapshots/wb_${workbookId}_`);
      return files.filter((f) => f.endsWith('.json')).sort().reverse();
    } catch {
      return [];
    }
  }

  /**
   * Reverts active workbook file to the most recent snapshot from .snapshots/wb_<id>_<timestamp>.json
   */
  async revertLastSnapshot(workbookId: string): Promise<boolean> {
    try {
      const files = await this.backend.listFiles(`.snapshots/wb_${workbookId}_`);
      const matchingSnapshots = files.filter((f) => f.endsWith('.json')).sort();
      if (matchingSnapshots.length === 0) {
        return false;
      }
      const latestSnapshotPath = matchingSnapshots[matchingSnapshots.length - 1];
      const snapshotRaw = await this.backend.readFile(latestSnapshotPath);
      if (!snapshotRaw) return false;

      const wbFile = JSON.parse(snapshotRaw);
      wbFile.revision = (wbFile.revision || 1) + 1;
      wbFile.updatedAt = new Date().toISOString();
      wbFile.lastAgentMutation = {
        agentName: 'System',
        toolName: 'revertLastSnapshot',
        summary: `Reverted to snapshot ${latestSnapshotPath}`,
        timestamp: wbFile.updatedAt,
      };

      const targetPath = `workbooks/wb_${workbookId}.json`;
      await this.backend.writeFile(targetPath, JSON.stringify(wbFile, null, 2));

      // Remove the used snapshot so subsequent undo steps backward
      if (typeof this.backend.deleteFile === 'function') {
        await this.backend.deleteFile(latestSnapshotPath);
      }

      return true;
    } catch (err) {
      console.error('[FolderWorkspaceRepository] Failed to revert snapshot:', err);
      return false;
    }
  }

  /**
   * Loads a snapshot by path or id.
   */
  async loadSnapshot(snapshotPath: string): Promise<WorkspaceState | null> {
    const content = await this.backend.readFile(snapshotPath);
    if (!content) return null;

    try {
      const parsed = JSON.parse(content);
      if (parsed.manifest && parsed.entitiesFile && parsed.workbookFiles) {
        return deserializeFolderToWorkspace(parsed.manifest, parsed.entitiesFile, parsed.workbookFiles);
      }
      return null;
    } catch (e) {
      console.error('[FolderWorkspaceRepository] Failed to parse snapshot:', e);
      return null;
    }
  }

  /**
   * Returns current in-memory folder layout for external inspectability.
   */
  getFolderFiles(state: WorkspaceState): SerializedFolderWorkspace {
    return serializeWorkspaceToFolder(state);
  }

  /**
   * Browser DOM Export: downloads multi-file workspace folder as bundle JSON.
   */
  async exportWorkspaceFile(state: WorkspaceState): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }
    const blob = await exportWorkspaceBundle(state);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const wsName = (state.workspaceName || 'workspace').toLowerCase().replace(/\s+/g, '-');
    link.href = url;
    link.download = `qualcount-${wsName}-${dateStr}.bundle.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Browser DOM Import: opens file picker for bundle or legacy JSON.
   */
  async importWorkspaceFile(): Promise<WorkspaceState | null> {
    if (typeof document === 'undefined') {
      return null;
    }
    return new Promise<WorkspaceState | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const state = await importWorkspaceBundle(file);
          resolve(state);
        } catch (err) {
          console.error('[FolderWorkspaceRepository] Failed to import bundle:', err);
          resolve(null);
        } finally {
          if (input.parentNode) input.parentNode.removeChild(input);
        }
      };

      input.oncancel = () => {
        resolve(null);
        if (input.parentNode) input.parentNode.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  }
}
