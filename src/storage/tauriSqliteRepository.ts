import type { WorkspaceState } from '../types/schema';
import type { WorkspaceRepository } from './workspaceRepository';
import { LocalStorageRepository } from './localStorageRepository';

/**
 * Phase 2 Desktop Target Adapter Stub & Desktop Hybrid Driver:
 * Connects QualCount to persistent storage inside the Tauri desktop runtime.
 * In desktop runtime, provides zero-configuration persistent storage
 * using the repository fallback pipeline and native DOM download/upload handlers.
 */
export class TauriSqliteRepository implements WorkspaceRepository {
  private fallback = new LocalStorageRepository();

  async loadWorkspace(): Promise<WorkspaceState | null> {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        return await this.fallback.loadWorkspace();
      } catch (err) {
        console.warn('[TauriSqliteRepository] Fallback load failed:', err);
      }
    }
    console.warn('[TauriSqliteRepository] Tauri IPC stub called in Phase 1 environment');
    return null;
  }

  async saveWorkspace(state: WorkspaceState): Promise<void> {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        await this.fallback.saveWorkspace(state);
        return;
      } catch (err) {
        console.warn('[TauriSqliteRepository] Fallback save failed:', err);
      }
    }
    console.warn('[TauriSqliteRepository] saveWorkspace stubbed in Phase 1 environment', state.activeWorkbookId);
  }

  async exportWorkspaceFile(state: WorkspaceState): Promise<void> {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      await this.fallback.exportWorkspaceFile(state);
      return;
    }
    console.warn('[TauriSqliteRepository] exportWorkspaceFile stubbed in Phase 1 environment', state.activeWorkbookId);
  }

  async importWorkspaceFile(): Promise<WorkspaceState | null> {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return this.fallback.importWorkspaceFile();
    }
    console.warn('[TauriSqliteRepository] importWorkspaceFile stubbed in Phase 1 environment');
    return null;
  }
}
