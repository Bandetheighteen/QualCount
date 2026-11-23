import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  WorkspaceManifest,
  EntitiesFile,
  WorkbookFile,
} from './types';

/**
 * Resilient cross-platform atomic file write.
 * Writes to a temporary file in the target directory and renames atomically.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.promises.writeFile(tmpPath, content, 'utf-8');
  try {
    await fs.promises.rename(tmpPath, filePath);
  } catch (err: any) {
    if (err.code === 'EEXIST' || err.code === 'EPERM') {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore if file did not exist
      }
      await fs.promises.rename(tmpPath, filePath);
    } else {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // ignore
      }
      throw err;
    }
  }
}

/**
 * Resolves the target workspace path from CLI arguments, environment variables,
 * or default locations.
 */
export function resolveWorkspacePath(cliWorkspaceArg?: string): string {
  // 1. Explicit CLI argument
  if (cliWorkspaceArg && cliWorkspaceArg.trim()) {
    return path.resolve(process.cwd(), cliWorkspaceArg.trim());
  }

  // 2. Command-line flags --workspace <dir> in process.argv
  const args = process.argv;
  const wsIndex = args.indexOf('--workspace');
  if (wsIndex !== -1 && args[wsIndex + 1]) {
    return path.resolve(process.cwd(), args[wsIndex + 1]);
  }

  // 3. Environment variables
  const envPath = process.env.QUALCOUNT_WORKSPACE || process.env.PARTNERSHIP_WORKSPACE;
  if (envPath && envPath.trim()) {
    return path.resolve(process.cwd(), envPath.trim());
  }

  // 4. Config file pointer at ~/.partnership-ledger/config.json
  try {
    const configPath = path.join(os.homedir(), '.partnership-ledger', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.activeWorkspacePath && typeof config.activeWorkspacePath === 'string') {
        return path.resolve(config.activeWorkspacePath);
      }
    }
  } catch {
    // Ignore config read error
  }

  // 5. Current working directory if workspace.json exists
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'workspace.json'))) {
    return cwd;
  }

  // 6. Default fallback
  return path.resolve(cwd, 'workspace');
}

/**
 * High-reliability Node.js file storage adapter for portable Workspace Folders.
 * Manages atomic writes, rolling 20 pre-write snapshots per workbook, and revision tracking.
 */
export class McpWorkspaceStorage {
  private workspacePath: string;
  private maxSnapshotsPerWorkbook: number = 20;

  constructor(workspacePath?: string) {
    this.workspacePath = resolveWorkspacePath(workspacePath);
  }

  public getWorkspacePath(): string {
    return this.workspacePath;
  }

  public async ensureWorkspaceInitialized(defaultName: string = 'QualCount Workspace'): Promise<void> {
    await fs.promises.mkdir(this.workspacePath, { recursive: true });
    await fs.promises.mkdir(path.join(this.workspacePath, 'workbooks'), { recursive: true });
    await fs.promises.mkdir(path.join(this.workspacePath, '.snapshots'), { recursive: true });

    const manifestPath = path.join(this.workspacePath, 'workspace.json');
    if (!fs.existsSync(manifestPath)) {
      const now = new Date().toISOString();
      const manifest: WorkspaceManifest = {
        schemaVersion: 2,
        workspaceId: `ws-${Date.now()}`,
        name: defaultName,
        revision: 1,
        workbooks: {},
        workbookLinks: {},
        createdAt: now,
        updatedAt: now,
        sourceType: 'local',
      };
      await this.writeManifest(manifest);
    }

    const entitiesPath = path.join(this.workspacePath, 'entities.json');
    if (!fs.existsSync(entitiesPath)) {
      const now = new Date().toISOString();
      const entitiesFile: EntitiesFile = {
        schemaVersion: 2,
        revision: 1,
        updatedAt: now,
        entities: {},
      };
      await this.writeEntities(entitiesFile);
    }
  }

  public async readManifest(): Promise<WorkspaceManifest> {
    const manifestPath = path.join(this.workspacePath, 'workspace.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Workspace manifest not found at: ${manifestPath}`);
    }
    const raw = await fs.promises.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as WorkspaceManifest;
  }

  public async writeManifest(manifest: WorkspaceManifest): Promise<void> {
    const manifestPath = path.join(this.workspacePath, 'workspace.json');
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  public async readEntities(): Promise<EntitiesFile> {
    const entitiesPath = path.join(this.workspacePath, 'entities.json');
    if (!fs.existsSync(entitiesPath)) {
      throw new Error(`Entities file not found at: ${entitiesPath}`);
    }
    const raw = await fs.promises.readFile(entitiesPath, 'utf-8');
    return JSON.parse(raw) as EntitiesFile;
  }

  public async writeEntities(entitiesFile: EntitiesFile): Promise<void> {
    const entitiesPath = path.join(this.workspacePath, 'entities.json');
    await atomicWriteFile(entitiesPath, JSON.stringify(entitiesFile, null, 2));
  }

  public async readWorkbook(workbookId: string): Promise<WorkbookFile> {
    let filePath = path.join(this.workspacePath, 'workbooks', `wb_${workbookId}.json`);
    if (!fs.existsSync(filePath)) {
      // Check manifest for custom filename
      try {
        const manifest = await this.readManifest();
        const ref = manifest.workbooks[workbookId];
        if (ref && ref.fileName) {
          filePath = path.join(this.workspacePath, ref.fileName);
        }
      } catch {
        // ignore
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Workbook not found: ${workbookId} (at ${filePath})`);
    }

    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as WorkbookFile;
  }

  public async writeWorkbookDirect(workbook: WorkbookFile): Promise<void> {
    const filePath = path.join(this.workspacePath, 'workbooks', `wb_${workbook.workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(workbook, null, 2));

    // Update manifest entry
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbook.workbookId] = {
        workbookId: workbook.workbookId,
        fileName: `workbooks/wb_${workbook.workbookId}.json`,
        title: workbook.title,
        status: workbook.status,
        updatedAt: workbook.updatedAt,
      };
      manifest.updatedAt = workbook.updatedAt;
      await this.writeManifest(manifest);
    } catch {
      // ignore manifest errors if workspace is partial
    }
  }

  /**
   * Performs an atomic workbook mutation with pre-write snapshot and rolling backup pruning.
   */
  public async writeWorkbookWithSnapshot(
    workbookId: string,
    mutator: (current: WorkbookFile) => Promise<WorkbookFile> | WorkbookFile,
    audit: { agentName: string; toolName: string; summary: string }
  ): Promise<WorkbookFile> {
    const current = await this.readWorkbook(workbookId);

    // 1. Pre-write Snapshot
    const snapshotsDir = path.join(this.workspacePath, '.snapshots');
    await fs.promises.mkdir(snapshotsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFilename = `wb_${workbookId}_${timestamp}.json`;
    const snapshotPath = path.join(snapshotsDir, snapshotFilename);
    await atomicWriteFile(snapshotPath, JSON.stringify(current, null, 2));

    // 2. Prune old snapshots (keep at most 20 for this workbook)
    try {
      const allFiles = await fs.promises.readdir(snapshotsDir);
      const prefix = `wb_${workbookId}_`;
      const matchingSnapshots = allFiles
        .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
        .sort(); // Lexicographical sort corresponds to chronological ISO sort

      if (matchingSnapshots.length > this.maxSnapshotsPerWorkbook) {
        const toRemove = matchingSnapshots.slice(0, matchingSnapshots.length - this.maxSnapshotsPerWorkbook);
        for (const file of toRemove) {
          try {
            await fs.promises.unlink(path.join(snapshotsDir, file));
          } catch {
            // ignore unlink errors
          }
        }
      }
    } catch {
      // ignore snapshot pruning errors
    }

    // 3. Execute mutator
    // Clone to ensure immutability before mutation
    const currentClone: WorkbookFile = JSON.parse(JSON.stringify(current));
    const mutated = await mutator(currentClone);

    // 4. Update revision and audit stamp
    mutated.revision = (current.revision || 1) + 1;
    mutated.updatedAt = new Date().toISOString();
    mutated.lastAgentMutation = {
      agentName: audit.agentName,
      toolName: audit.toolName,
      summary: audit.summary,
      timestamp: mutated.updatedAt,
    };

    // 5. Atomic write
    const filePath = path.join(this.workspacePath, 'workbooks', `wb_${workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(mutated, null, 2));

    // 6. Update manifest
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbookId] = {
        workbookId,
        fileName: `workbooks/wb_${workbookId}.json`,
        title: mutated.title,
        status: mutated.status,
        updatedAt: mutated.updatedAt,
      };
      manifest.updatedAt = mutated.updatedAt;
      manifest.revision = (manifest.revision || 1) + 1;
      await this.writeManifest(manifest);
    } catch {
      // ignore
    }

    return mutated;
  }

  /**
   * Reverts active workbook to the most recent pre-write snapshot.
   */
  public async revertLastSnapshot(workbookId: string): Promise<{
    reverted: boolean;
    snapshotFilename?: string;
    workbook?: WorkbookFile;
  }> {
    const snapshotsDir = path.join(this.workspacePath, '.snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      return { reverted: false };
    }

    const allFiles = await fs.promises.readdir(snapshotsDir);
    const prefix = `wb_${workbookId}_`;
    const matchingSnapshots = allFiles
      .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
      .sort(); // ascending

    if (matchingSnapshots.length === 0) {
      return { reverted: false };
    }

    // Latest snapshot is the last in sorted order
    const latestSnapshot = matchingSnapshots[matchingSnapshots.length - 1];
    const snapshotPath = path.join(snapshotsDir, latestSnapshot);
    const snapshotRaw = await fs.promises.readFile(snapshotPath, 'utf-8');
    const restoredWb = JSON.parse(snapshotRaw) as WorkbookFile;

    // Increment revision so UI detects change
    restoredWb.revision = (restoredWb.revision || 1) + 1;
    restoredWb.updatedAt = new Date().toISOString();
    restoredWb.lastAgentMutation = {
      agentName: 'System',
      toolName: 'revertLastSnapshot',
      summary: `Reverted to snapshot ${latestSnapshot}`,
      timestamp: restoredWb.updatedAt,
    };

    const filePath = path.join(this.workspacePath, 'workbooks', `wb_${workbookId}.json`);
    await atomicWriteFile(filePath, JSON.stringify(restoredWb, null, 2));

    // Remove the used snapshot so subsequent reverts pop the stack
    try {
      await fs.promises.unlink(snapshotPath);
    } catch {
      // ignore
    }

    // Update manifest
    try {
      const manifest = await this.readManifest();
      manifest.workbooks[workbookId] = {
        workbookId,
        fileName: `workbooks/wb_${workbookId}.json`,
        title: restoredWb.title,
        status: restoredWb.status,
        updatedAt: restoredWb.updatedAt,
      };
      manifest.updatedAt = restoredWb.updatedAt;
      manifest.revision = (manifest.revision || 1) + 1;
      await this.writeManifest(manifest);
    } catch {
      // ignore
    }

    return {
      reverted: true,
      snapshotFilename: latestSnapshot,
      workbook: restoredWb,
    };
  }

  /**
   * Lists available snapshot files for a workbook, newest first.
   */
  public async listSnapshots(workbookId: string): Promise<string[]> {
    const snapshotsDir = path.join(this.workspacePath, '.snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      return [];
    }

    const allFiles = await fs.promises.readdir(snapshotsDir);
    const prefix = `wb_${workbookId}_`;
    return allFiles
      .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
      .sort()
      .reverse();
  }
}
