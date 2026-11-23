import React, { useEffect, useRef } from 'react';
import {
  Edit3,
  Trash2,
  Lock,
  Unlock,
  GitCommit,
  Copy,
  Plus,
  Wand2,
  Eye,
  EyeOff,
  Layers,
  ArrowLeftRight,
  Check,
  X,
  SlidersHorizontal,
  Move,
  ZoomIn,
  Network,
  Star,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface ContextMenuProps {
  type: 'node' | 'edge' | 'pane' | 'multi';
  x: number;
  y: number;
  nodeId?: string | null;
  edgeId?: string | null;
  canvasPosition?: { x: number; y: number };
  onClose: () => void;
  onOpenAddNode?: (pos?: { x: number; y: number }) => void;
  onOpenConnectBranch?: (sourcePlacementId?: string) => void;
  onOpenManageSectors?: () => void;
  onOpenModifyModal?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  type,
  x,
  y,
  nodeId,
  edgeId,
  canvasPosition,
  onClose,
  onOpenAddNode,
  onOpenConnectBranch,
  onOpenManageSectors,
  onOpenModifyModal,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const storeWorkspace = useWorkspaceStore((state) => state.workspace);
  const storeSelectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);
  const storeSelectedBranchIds = useWorkspaceStore((state) => state.selectedBranchIds);
  const storeLockedPlacementIds = useWorkspaceStore((state) => state.lockedPlacementIds);
  const storeLockedBranchIds = useWorkspaceStore((state) => state.lockedBranchIds);
  const storeIsWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const storeShowDeclined = useWorkspaceStore((state) => state.showDeclined);

  // Synchronize with live store state for headless SSR / testing environments
  const workspace = useWorkspaceStore.getState().workspace ?? storeWorkspace;
  const selectedPlacementIds = useWorkspaceStore.getState().selectedPlacementIds ?? storeSelectedPlacementIds;
  const selectedBranchIds = useWorkspaceStore.getState().selectedBranchIds ?? storeSelectedBranchIds;
  const lockedPlacementIds = useWorkspaceStore.getState().lockedPlacementIds ?? storeLockedPlacementIds;
  const lockedBranchIds = useWorkspaceStore.getState().lockedBranchIds ?? storeLockedBranchIds;
  const isWorkspaceLocked = useWorkspaceStore.getState().isWorkspaceLocked ?? storeIsWorkspaceLocked;
  const showDeclined = useWorkspaceStore.getState().showDeclined ?? storeShowDeclined;

  const selectPlacement = useWorkspaceStore((state) => state.selectPlacement);
  const selectBranch = useWorkspaceStore((state) => state.selectBranch);
  const removePlacement = useWorkspaceStore((state) => state.removePlacement);
  const deleteBranch = useWorkspaceStore((state) => state.deleteBranch);
  const setBranchStatus = useWorkspaceStore((state) => state.setBranchStatus);
  const toggleLockPlacement = useWorkspaceStore((state) => state.toggleLockPlacement);
  const toggleLockBranch = useWorkspaceStore((state) => state.toggleLockBranch);
  const batchLock = useWorkspaceStore((state) => state.batchLock);
  const batchDelete = useWorkspaceStore((state) => state.batchDelete);
  const batchSetBranchStatus = useWorkspaceStore((state) => state.batchSetBranchStatus);
  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const tidyUpLayout = useWorkspaceStore((state) => state.tidyUpLayout);
  const toggleShowDeclined = useWorkspaceStore((state) => state.toggleShowDeclined);
  const fitView = useWorkspaceStore((state) => state.fitView);
  const resetZoom = useWorkspaceStore((state) => state.resetZoom);
  const setRootPlacement = useWorkspaceStore((state) => state.setRootPlacement);

  const activeWorkbookId = workspace?.activeWorkbookId;
  const existingRootPlacement = workspace
    ? Object.values(workspace.placements).find(
        (p) =>
          (p.workbookId === activeWorkbookId || (!p.workbookId && activeWorkbookId === workspace.activeWorkbookId)) &&
          p.isRootNgo
      )
    : null;
  const existingRootEntityName =
    existingRootPlacement && workspace?.entities[existingRootPlacement.entityId]
      ? workspace.entities[existingRootPlacement.entityId].name
      : 'Root NGO';

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Viewport clamping
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const menuWidth = 220;
  const menuHeight = 280;
  const posX = Math.max(10, Math.min(x, winWidth - menuWidth - 16));
  const posY = Math.max(10, Math.min(y, winHeight - menuHeight - 16));

  // Node details if type === 'node'
  const placement = nodeId && workspace ? workspace.placements[nodeId] : null;
  const entity = placement && workspace ? workspace.entities[placement.entityId] : null;
  const isNodeLocked = nodeId ? lockedPlacementIds.includes(nodeId) || isWorkspaceLocked : false;
  const isRootNgo = placement?.isRootNgo ?? false;

  // Branch details if type === 'edge'
  const branch = edgeId && workspace ? workspace.branches[edgeId] : null;
  const isEdgeLocked = edgeId ? lockedBranchIds.includes(edgeId) || isWorkspaceLocked : false;

  const handleCopyNode = () => {
    if (entity) {
      const text = `${entity.name} (${entity.category})\n${entity.globalNotes || 'No notes'}`;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    }
    onClose();
  };

  const handleDeleteNode = async () => {
    if (!nodeId || isRootNgo || isNodeLocked) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete organization "${entity?.name ?? nodeId}"?`) : true;
    if (confirmed) {
      await removePlacement(nodeId);
    }
    onClose();
  };

  const handleDeleteBranch = async () => {
    if (!edgeId || isEdgeLocked) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete ${branch?.type.toUpperCase()} branch?`) : true;
    if (confirmed) {
      await deleteBranch(edgeId);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: posY,
        left: posX,
        zIndex: 9999,
      }}
      aria-label="Context Menu"
      className="w-56 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-0.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. NODE CONTEXT MENU */}
      {type === 'node' && (
        <>
          <div className="px-2 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 truncate flex items-center justify-between">
            <span className="truncate max-w-[130px] text-slate-200">{entity?.name || 'Node Options'}</span>
            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-800 text-sky-400 border border-slate-700">
              {entity?.category || 'org'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (nodeId) selectPlacement(nodeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Inspect / Modify</span>
          </button>

          {/* Designate or Unset Root Node (Strict Single-Root Enforcement) */}
          {isRootNgo ? (
            <button
              type="button"
              disabled={isNodeLocked}
              onClick={async () => {
                if (nodeId) await setRootPlacement(nodeId, false);
                onClose();
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer text-left disabled:opacity-50"
              title="Unset this organization as the Root Node"
            >
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>Unset Root Node</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isNodeLocked || Boolean(existingRootPlacement)}
              onClick={async () => {
                if (existingRootPlacement) {
                  alert(
                    `This workbook already has a Root Node ("${existingRootEntityName}"). Only one Root Node is allowed per workbook. Please unset the current root node first.`
                  );
                  return;
                }
                if (nodeId) await setRootPlacement(nodeId, true);
                onClose();
              }}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left',
                existingRootPlacement
                  ? 'opacity-50 cursor-not-allowed text-slate-400'
                  : 'hover:bg-slate-800 text-amber-300 hover:text-amber-200 cursor-pointer'
              )}
              title={
                existingRootPlacement
                  ? `Root node already set ("${existingRootEntityName}"). Unset it first.`
                  : 'Designate this organization as the Root Node for this workbook'
              }
            >
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>{existingRootPlacement ? 'Make Root Node (Root Set)' : 'Make Root Node'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (nodeId) {
                useWorkspaceStore.getState().filterToConnectedNodes([nodeId]);
              }
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer text-left"
          >
            <Network className="w-3.5 h-3.5 text-amber-400" />
            <span>Filter Connected Tree</span>
          </button>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (nodeId && onOpenConnectBranch) onOpenConnectBranch(nodeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect Branch...</span>
          </button>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (nodeId) toggleLockPlacement(nodeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            {isNodeLocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unlock Node</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lock Node</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyNode}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Copy Details</span>
          </button>

          <div className="h-[1px] bg-slate-800 my-1" />

          <button
            type="button"
            disabled={isRootNgo || isNodeLocked}
            onClick={handleDeleteNode}
            title={isRootNgo ? 'Root NGO cannot be deleted' : isNodeLocked ? 'Node is locked' : undefined}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left',
              isRootNgo || isNodeLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer'
            )}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{isRootNgo ? 'Root Protected' : 'Delete Node'}</span>
          </button>
        </>
      )}

      {/* 2. EDGE / BRANCH CONTEXT MENU */}
      {type === 'edge' && (
        <>
          <div className="px-2 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 truncate flex items-center justify-between">
            <span className="uppercase text-slate-200">{branch?.type || 'Branch'} Vector</span>
            <span
              className={clsx(
                'text-[9px] uppercase px-1 py-0.2 rounded border',
                branch?.status === 'tick' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                branch?.status === 'cross' && 'text-slate-400 border-slate-600 bg-slate-800',
                branch?.status === 'pending' && 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              )}
            >
              {branch?.status || 'status'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (edgeId) selectBranch(edgeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Inspect / Modify</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (edgeId) selectBranch(edgeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-sky-300" />
            <span>Change Origin / Destination</span>
          </button>

          <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-slate-500 uppercase">
            Quick Status
          </div>

          <div className="grid grid-cols-3 gap-1 px-1 mb-1">
            <button
              type="button"
              disabled={isEdgeLocked}
              onClick={() => {
                if (edgeId) setBranchStatus(edgeId, 'tick');
                onClose();
              }}
              title="Mark Confirmed (Tick)"
              className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 border border-slate-700 hover:border-emerald-500 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>
            <button
              type="button"
              disabled={isEdgeLocked}
              onClick={() => {
                if (edgeId) setBranchStatus(edgeId, 'pending');
                onClose();
              }}
              title="Mark Pending"
              className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-slate-700 hover:border-amber-500 text-[10px] font-bold cursor-pointer disabled:opacity-50"
            >
              ...
            </button>
            <button
              type="button"
              disabled={isEdgeLocked}
              onClick={() => {
                if (edgeId) setBranchStatus(edgeId, 'cross');
                onClose();
              }}
              title="Mark Declined (Cross)"
              className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 hover:border-rose-500 cursor-pointer disabled:opacity-50"
            >
              <X className="w-3 h-3 stroke-[3]" />
            </button>
          </div>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (edgeId) toggleLockBranch(edgeId);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            {isEdgeLocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unlock Branch</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lock Branch</span>
              </>
            )}
          </button>

          <div className="h-[1px] bg-slate-800 my-1" />

          <button
            type="button"
            disabled={isEdgeLocked}
            onClick={handleDeleteBranch}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left',
              isEdgeLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer'
            )}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Branch</span>
          </button>
        </>
      )}

      {/* 3. PANE / BLANK SPACE CONTEXT MENU */}
      {type === 'pane' && (
        <>
          <div className="px-2 py-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase">
            Workbook Actions
          </div>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (onOpenAddNode) onOpenAddNode(canvasPosition);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Add Organization Node...</span>
          </button>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (onOpenConnectBranch) onOpenConnectBranch();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect Branch...</span>
          </button>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              if (onOpenManageSectors) onOpenManageSectors();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Manage Sectors...</span>
          </button>

          <div className="h-[1px] bg-slate-800 my-1" />

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              tidyUpLayout();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Tidy Up Layout</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fitView();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <Move className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fit View</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetZoom();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Zoom (100%)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              toggleShowDeclined();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            {showDeclined ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Hide Declined Paths</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>Show Declined Paths</span>
              </>
            )}
          </button>
        </>
      )}

      {/* 4. MULTI-SELECTION CONTEXT MENU */}
      {type === 'multi' && (
        <>
          <div className="px-2 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-sky-400 truncate flex items-center justify-between">
            <span>Selection ({selectedPlacementIds.length + selectedBranchIds.length} items)</span>
            <span className="text-[10px] text-slate-400">
              {selectedPlacementIds.length}N · {selectedBranchIds.length}B
            </span>
          </div>

          {onOpenModifyModal && (
            <button
              type="button"
              onClick={() => {
                onOpenModifyModal();
                onClose();
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>Inspect / Batch Modify</span>
            </button>
          )}

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => {
              batchLock();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Toggle Lock Selected</span>
          </button>

          {selectedPlacementIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                useWorkspaceStore.getState().filterToConnectedNodes(selectedPlacementIds);
                onClose();
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer text-left"
            >
              <Network className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter Tree from Selected ({selectedPlacementIds.length})</span>
            </button>
          )}

          {selectedBranchIds.length > 0 && (
            <>
              <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-slate-500 uppercase">
                Batch Status
              </div>
              <div className="grid grid-cols-3 gap-1 px-1 mb-1">
                <button
                  type="button"
                  disabled={isWorkspaceLocked}
                  onClick={() => {
                    batchSetBranchStatus('tick');
                    onClose();
                  }}
                  className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 border border-slate-700 hover:border-emerald-500 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Tick
                </button>
                <button
                  type="button"
                  disabled={isWorkspaceLocked}
                  onClick={() => {
                    batchSetBranchStatus('pending');
                    onClose();
                  }}
                  className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-slate-700 hover:border-amber-500 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Pending
                </button>
                <button
                  type="button"
                  disabled={isWorkspaceLocked}
                  onClick={() => {
                    batchSetBranchStatus('cross');
                    onClose();
                  }}
                  className="flex items-center justify-center p-1 rounded bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 hover:border-rose-500 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cross
                </button>
              </div>
            </>
          )}

          <div className="h-[1px] bg-slate-800 my-1" />

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={async () => {
              const confirmed = typeof window !== 'undefined' ? window.confirm('Delete all selected items?') : true;
              if (confirmed) {
                await batchDelete();
              }
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Selected</span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearSelection();
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-left"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Selection</span>
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
