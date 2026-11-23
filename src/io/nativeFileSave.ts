import type { WorkspaceState } from '../types/schema';
import { serializeWorkbookToFile } from '../storage/folderSerializer';

// In-memory cache of native file system handles per workbook ID (session-based)
const activeFileHandles = new Map<string, any>();

/**
 * Caches an open/saved file handle for a given workbook ID
 * so subsequent Ctrl+S / Save commands write directly back to this file.
 */
export function cacheWorkbookFileHandle(workbookId: string, handle: any): void {
  if (workbookId && handle) {
    activeFileHandles.set(workbookId, handle);
  }
}

/**
 * Robustly sanitizes a workbook title into a valid OS filename,
 * preserving meaningful Unicode characters while stripping forbidden filesystem symbols.
 */
export function sanitizeWorkbookFilename(title?: string): string {
  if (!title) return 'qualcount_workbook.json';
  const sanitized = title
    .trim()
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${sanitized || 'qualcount_workbook'}.json`;
}

/**
 * Triggers the native OS file explorer window (via window.showSaveFilePicker)
 * or falls back to browser download if the File System Access API is unavailable.
 * Directs save to local PC file system so user can choose any directory.
 */
export async function saveWorkbookNative(
  state: WorkspaceState,
  workbookId: string,
  forceSaveAs = false
): Promise<{ success: boolean; canceled?: boolean; fileName?: string }> {
  const wbFile = serializeWorkbookToFile(state, workbookId);
  const jsonString = JSON.stringify(wbFile, null, 2);
  const suggestedName = sanitizeWorkbookFilename(wbFile.title);

  // 1. Try reusing existing handle if "Save" (not "Save As") and handle is available
  if (!forceSaveAs && activeFileHandles.has(workbookId)) {
    const existingHandle = activeFileHandles.get(workbookId);
    try {
      const writable = await existingHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return { success: true, fileName: existingHandle.name || suggestedName };
    } catch (e) {
      console.warn('[nativeFileSave] Existing handle write failed, requesting new file picker:', e);
      activeFileHandles.delete(workbookId);
    }
  }

  // 2. File System Access API (window.showSaveFilePicker)
  // Supported in modern Chrome, Edge, Chromium, and WebView2 (Windows desktop)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const pickerOpts = {
        suggestedName,
        types: [
          {
            description: 'QualCount Workbook (*.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      };
      // @ts-ignore
      const handle = await window.showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      activeFileHandles.set(workbookId, handle);
      return { success: true, fileName: handle.name || suggestedName };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, canceled: true };
      }
      console.warn('[nativeFileSave] showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // 3. Fallback: Standard browser download
  if (typeof document !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, fileName: suggestedName };
  }

  return { success: false };
}

/**
 * Triggers the native OS file picker to open and read a JSON file from disk.
 */
export async function pickAndReadJsonFile(): Promise<{ file?: File; content: string; name: string; handle?: any } | null> {
  // 1. Try showOpenFilePicker if supported
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      // @ts-ignore
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'QualCount Workbook / JSON File (*.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      const content = await file.text();
      return { file, content, name: file.name, handle };
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      console.warn('[pickAndReadJsonFile] showOpenFilePicker failed, falling back to file input:', err);
    }
  }

  // 2. Fallback using standard file input element
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    let resolved = false;

    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
        return;
      }
      try {
        const content = await file.text();
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ file, content, name: file.name });
        }
      } catch (err) {
        console.error('Failed to read file:', err);
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}
