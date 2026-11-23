import type { WorkspaceRepository } from './workspaceRepository';
import { LocalStorageRepository } from './localStorageRepository';
import { TauriSqliteRepository } from './tauriSqliteRepository';

export * from './workspaceRepository';
export * from './localStorageRepository';
export * from './tauriSqliteRepository';
export * from './folderSerializer';
export * from './folderWorkspaceRepository';

let repositoryInstance: WorkspaceRepository | null = null;

/**
 * Resets the cached repository instance (used for environment switching and testing).
 */
export function resetWorkspaceRepository(): void {
  repositoryInstance = null;
}

/**
 * Sets a custom repository instance.
 */
export function setWorkspaceRepository(repo: WorkspaceRepository): void {
  repositoryInstance = repo;
}

/**
 * Environment-aware repository factory:
 * Detects whether running inside a Tauri v2 WebView2 host or a standard browser,
 * returning the appropriate persistent repository instance.
 */
export function getWorkspaceRepository(): WorkspaceRepository {
  if (repositoryInstance) {
    return repositoryInstance;
  }

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    repositoryInstance = new TauriSqliteRepository();
  } else {
    repositoryInstance = new LocalStorageRepository();
  }

  return repositoryInstance;
}
