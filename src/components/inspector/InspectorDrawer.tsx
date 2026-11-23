import React, { useState } from 'react';
import {
  X,
  Trash2,
  Building2,
  GitCommit,
  ArrowDownLeft,
  ArrowUpRight,
  Network,
  ShieldAlert,
  Info,
  Lock,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getNodeAmplifierReach } from '../../engine/metrics';
import { getMultiThreadBadge } from '../canvas/OrgNode';
import { ManageSectorsModal } from '../toolbar/ManageSectorsModal';
import { PointsOfContactModal } from '../contacts/PointsOfContactModal';
import type { EntityCategory } from '../../types/schema';

export interface InspectorDrawerProps {
  placementId?: string | null;
  branchId?: string | null;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  placementId: propPlacementId,
  branchId: propBranchId,
}) => {
  const [isManageSectorsOpen, setIsManageSectorsOpen] = useState(false);
  const [isPocOpen, setIsPocOpen] = useState(false);
  const isInspectorDismissed = useWorkspaceStore((state) => state.isInspectorDismissed);
  const setIsInspectorDismissed = useWorkspaceStore((state) => state.setIsInspectorDismissed);
  const sectors = useWorkspaceStore((state) => state.sectors);
  const storeWorkspace = useWorkspaceStore((state) => state.workspace);
  const storeActiveWbId = useWorkspaceStore((state) => state.activeWorkbookId);
  const storePlacementId = useWorkspaceStore((state) => state.selectedPlacementId);
  const storeBranchId = useWorkspaceStore((state) => state.selectedBranchId);
  const storeYellowInDegrees = useWorkspaceStore((state) => state.yellowInDegrees);
  const lockedPlacementIds = useWorkspaceStore((state) => state.lockedPlacementIds);
  const lockedBranchIds = useWorkspaceStore((state) => state.lockedBranchIds);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const theme = useWorkspaceStore.getState().theme ?? storeTheme;
  const isLight = theme === 'light';

  // Synchronize with live store state for headless SSR / testing environments
  const workspace = useWorkspaceStore.getState().workspace ?? storeWorkspace;
  const activeWorkbookId = useWorkspaceStore.getState().activeWorkbookId ?? storeActiveWbId;
  const yellowInDegrees = useWorkspaceStore.getState().yellowInDegrees ?? storeYellowInDegrees;

  const selectedPlacementId =
    propPlacementId !== undefined
      ? propPlacementId
      : (useWorkspaceStore.getState().selectedPlacementId ?? storePlacementId);

  const selectedBranchId =
    propBranchId !== undefined
      ? propBranchId
      : (useWorkspaceStore.getState().selectedBranchId ?? storeBranchId);

  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const selectBranch = useWorkspaceStore((state) => state.selectBranch);
  const updateEntity = useWorkspaceStore((state) => state.updateEntity);
  const updateBranch = useWorkspaceStore((state) => state.updateBranch);
  const deleteBranch = useWorkspaceStore((state) => state.deleteBranch);
  const removePlacement = useWorkspaceStore((state) => state.removePlacement);

  const selectedPlacement =
    workspace && selectedPlacementId ? workspace.placements[selectedPlacementId] : null;
  const selectedEntity =
    workspace && selectedPlacement ? workspace.entities[selectedPlacement.entityId] : null;

  const selectedBranch =
    workspace && selectedBranchId ? workspace.branches[selectedBranchId] : null;

  // If nothing is selected, render subtle collapsed/empty hint unless dismissed
  if (!selectedPlacement && !selectedBranch) {
    if (isInspectorDismissed) return null;
    return (
      <aside aria-label="Context Inspector" className="hidden lg:flex flex-col w-80 bg-slate-900/80 border border-slate-700/60 rounded-2xl shadow-xl backdrop-blur-md p-4 text-slate-400 select-none animate-in fade-in">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Context Inspector</span>
          </div>
          <button
            type="button"
            onClick={() => setIsInspectorDismissed(true)}
            title="Dismiss notification"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Select any partner card or connection branch on the canvas to inspect topology metrics, edit properties, or manage multiplex links.
        </p>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // View 1: Node (Placement & Entity) Inspector
  // ---------------------------------------------------------------------------
  if (selectedPlacement && selectedEntity) {
    const isRootNgo = selectedPlacement.isRootNgo;
    const isNodeLocked = lockedPlacementIds.includes(selectedPlacement.placementId) || isWorkspaceLocked;
    const yellowInDeg = yellowInDegrees[selectedPlacement.placementId] ?? 0;
    const badge = getMultiThreadBadge(yellowInDeg);

    // Compute downstream unique reach
    const rootPlacement = Object.values(workspace?.placements ?? {}).find(
      (p) => p.workbookId === activeWorkbookId && p.isRootNgo
    );
    const downstreamReach = workspace
      ? getNodeAmplifierReach(
          selectedPlacement.placementId,
          workspace.placements,
          workspace.branches,
          rootPlacement?.placementId
        )
      : 0;

    // Attached branches
    const allBranches = Object.values(workspace?.branches ?? {}).filter(
      (b) => b.workbookId === activeWorkbookId
    );
    const incomingBranches = allBranches.filter(
      (b) => b.targetPlacementId === selectedPlacement.placementId
    );
    const outgoingBranches = allBranches.filter(
      (b) => b.sourcePlacementId === selectedPlacement.placementId
    );

    const getPlacementName = (pId: string) => {
      const p = workspace?.placements[pId];
      if (!p) return pId;
      const e = workspace?.entities[p.entityId];
      return e?.name ?? pId;
    };

    const handleRemovePlacement = async () => {
      if (isRootNgo || isNodeLocked) return;
      const confirmed = window.confirm(
        `Remove "${selectedEntity.name}" from this workbook? All connected branches will be deleted.`
      );
      if (confirmed) {
        await removePlacement(selectedPlacement.placementId);
      }
    };

    return (
      <>
        <aside
          aria-label="Context Inspector"
          className={clsx(
            'w-80 max-w-[360px] rounded-2xl shadow-2xl backdrop-blur-md flex flex-col z-20 overflow-hidden select-none transition-opacity duration-150 max-h-[calc(100vh-5rem)] border',
            isLight
              ? 'bg-white border-2 border-black text-black'
              : 'bg-slate-900/95 border-slate-700/80 text-slate-200'
          )}
        >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between px-4 py-3 border-b',
            isLight ? 'border-black bg-slate-50 text-black' : 'border-slate-800 bg-slate-800/50'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className={clsx('w-4 h-4 shrink-0', isLight ? 'text-black' : 'text-sky-400')} />
            <span className={clsx('text-xs font-bold uppercase tracking-wider', isLight ? 'text-black' : 'text-slate-300')}>
              Organization Details
            </span>
            {isNodeLocked && (
              <span className={clsx('flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border', isLight ? 'bg-amber-100 text-amber-950 border-black' : 'bg-slate-800 text-amber-400 border-amber-500/40')}>
                <Lock className="w-2.5 h-2.5" />
                Locked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className={clsx('p-1 rounded-lg transition-colors cursor-pointer', isLight ? 'text-black hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin text-xs">
          {/* Entity Name Field */}
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-entity-name" className={clsx('font-medium', isLight ? 'text-black' : 'text-slate-400')}>Organization Name</label>
            <input
              id="inspector-entity-name"
              type="text"
              disabled={isNodeLocked}
              value={selectedEntity.name}
              onChange={(e) =>
                updateEntity(selectedEntity.entityId, { name: e.target.value })
              }
              className={clsx(
                'w-full px-2.5 py-1.5 rounded-lg text-sm font-semibold focus:outline-none border',
                isLight
                  ? 'bg-slate-50 border-black text-black focus:border-black'
                  : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-sky-500',
                isNodeLocked && 'opacity-60 cursor-not-allowed'
              )}
            />
          </div>

          {/* Sector Category */}
          <div className="flex flex-col gap-1">
            <div className={clsx('flex items-center justify-between text-xs font-medium', isLight ? 'text-black' : 'text-slate-400')}>
              <label htmlFor="inspector-entity-category">Sector Category</label>
              <button
                type="button"
                disabled={isNodeLocked}
                onClick={() => setIsManageSectorsOpen(true)}
                className={clsx('text-[11px] underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed', isLight ? 'text-black font-semibold' : 'text-sky-400 hover:text-sky-300')}
              >
                + Add / Manage Sectors
              </button>
            </div>
            <select
              id="inspector-entity-category"
              value={selectedEntity.category}
              disabled={isNodeLocked}
              onChange={(e) =>
                updateEntity(selectedEntity.entityId, {
                  category: e.target.value as EntityCategory,
                })
              }
              className={clsx(
                'w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none border cursor-pointer',
                isLight
                  ? 'bg-slate-50 border-black text-black font-semibold focus:border-black'
                  : 'bg-slate-950 border-slate-700 text-slate-200 focus:border-sky-500',
                isNodeLocked && 'opacity-60 cursor-not-allowed'
              )}
            >
              {sectors.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Points of Contact Button & List */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={clsx('font-medium', isLight ? 'text-black' : 'text-slate-400')}>Points of Contact</label>
              <button
                type="button"
                onClick={() => setIsPocOpen(true)}
                className={clsx('text-[11px] underline cursor-pointer', isLight ? 'text-black font-semibold' : 'text-sky-400 hover:text-sky-300')}
              >
                + Manage / Edit
              </button>
            </div>

            {selectedEntity.pointsOfContact && selectedEntity.pointsOfContact.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {selectedEntity.pointsOfContact.map((poc) => (
                  <div
                    key={poc.id}
                    className={clsx(
                      'p-2 rounded-lg border flex flex-col gap-0.5',
                      isLight
                        ? 'bg-slate-50 border-black text-black'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <Users className={clsx('w-3.5 h-3.5', isLight ? 'text-black' : 'text-sky-400')} />
                        {poc.name}
                      </span>
                      {poc.isInternal && (
                        <span className={clsx('text-[9px] px-1.5 py-0.2 rounded border font-semibold', isLight ? 'bg-slate-200 text-black border-black' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')}>
                          Internal
                        </span>
                      )}
                    </div>
                    {poc.designation && (
                      <span className={clsx('text-[10px] font-medium', isLight ? 'text-slate-700' : 'text-slate-400')}>
                        {poc.designation}
                      </span>
                    )}
                    {(poc.email || poc.phone) && (
                      <div className={clsx('flex items-center gap-2 text-[9px] mt-0.5', isLight ? 'text-slate-600' : 'text-slate-500')}>
                        {poc.email && <span>✉ {poc.email}</span>}
                        {poc.email && poc.phone && <span>•</span>}
                        {poc.phone && <span>☎ {poc.phone}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsPocOpen(true)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm group border',
                isLight
                  ? 'bg-white border-black text-black hover:bg-slate-100'
                  : 'bg-slate-950 border-slate-700 hover:border-sky-500 text-slate-200 hover:text-white'
              )}
            >
              <div className="flex items-center gap-2">
                <Users className={clsx('w-3.5 h-3.5 transition-transform group-hover:scale-110', isLight ? 'text-black' : 'text-sky-400')} />
                <span>Manage Points of Contact</span>
              </div>
              <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', isLight ? 'bg-slate-100 text-black border-black' : 'bg-sky-500/20 text-sky-300 border-sky-500/40')}>
                {selectedEntity.pointsOfContact?.length ?? 0} listed
              </span>
            </button>
          </div>

          {/* Responsible Person / Team From Our Side (Internal Lead) */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="inspector-entity-internal-lead"
              className={clsx('font-medium flex items-center justify-between', isLight ? 'text-black font-semibold' : 'text-slate-400')}
            >
              <span>Responsible Person / Team (From Our Side)</span>
              <span className={clsx('text-[10px]', isLight ? 'text-black font-medium' : 'text-slate-500')}>Internal Lead</span>
            </label>
            <input
              id="inspector-entity-internal-lead"
              type="text"
              disabled={isNodeLocked}
              value={selectedEntity.internalLead || ''}
              onChange={(e) =>
                updateEntity(selectedEntity.entityId, { internalLead: e.target.value })
              }
              placeholder="e.g. Sarah / Partnerships Team"
              className={clsx(
                'w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none border',
                isLight
                  ? 'bg-slate-50 border-black text-black placeholder-slate-400 focus:border-black font-medium'
                  : 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-sky-500',
                isNodeLocked && 'opacity-60 cursor-not-allowed'
              )}
            />
          </div>

          {/* Root NGO or Multi-Thread Indicator */}
          {isRootNgo ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-sky-400" />
              <span>Root NGO: Foundational base of the workbook network.</span>
            </div>
          ) : badge ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-amber-500/40">
              <span className="text-slate-300 font-medium">Triangulation:</span>
              <span className={clsx('px-2 py-0.5 rounded text-[11px] font-bold border', badge.badgeClass)}>
                {badge.label}
              </span>
            </div>
          ) : null}

          {/* Live Topology Indicators */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-slate-400 flex items-center gap-1" title="Yellow In-Degree">
                <Network className="w-3.5 h-3.5 text-yellow-400" />
                Bridge In-Degree
                <span className="sr-only">Yellow In-Deg</span>
              </span>
              <span className="text-lg font-bold text-yellow-300 mt-1">
                {yellowInDeg}
              </span>
              <span className="text-[10px] text-slate-500">endorsing bridges</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Network className="w-3.5 h-3.5 text-purple-400" />
                Downstream Reach
              </span>
              <span className="text-lg font-bold text-purple-300 mt-1">
                {downstreamReach}
              </span>
              <span className="text-[10px] text-slate-500">unique reachable</span>
            </div>
          </div>

          {/* Global Notes */}
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-global-notes" className="text-slate-400 font-medium">Partner Notes & Context</label>
            <textarea
              id="inspector-global-notes"
              rows={3}
              value={selectedEntity.globalNotes}
              onChange={(e) =>
                updateEntity(selectedEntity.entityId, { globalNotes: e.target.value })
              }
              placeholder="Partner history, key contacts, or engagement notes..."
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Attached Connections List */}
          <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-3">
            <span className="font-semibold text-slate-300 text-xs">
              Connected Multiplex Branches ({incomingBranches.length + outgoingBranches.length})
            </span>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {incomingBranches.map((b) => (
                <button
                  key={b.branchId}
                  type="button"
                  onClick={() => selectBranch(b.branchId)}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate text-slate-300 font-medium">
                      from {getPlacementName(b.sourcePlacementId)}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0',
                      b.type === 'green' && 'text-emerald-400 bg-emerald-500/10',
                      b.type === 'white' && 'text-slate-200 bg-slate-700/60',
                      b.type === 'yellow' && 'text-yellow-400 bg-yellow-500/10'
                    )}
                  >
                    {b.type} • {b.status}
                  </span>
                </button>
              ))}

              {outgoingBranches.map((b) => (
                <button
                  key={b.branchId}
                  type="button"
                  onClick={() => selectBranch(b.branchId)}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ArrowUpRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate text-slate-300 font-medium">
                      to {getPlacementName(b.targetPlacementId)}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0',
                      b.type === 'green' && 'text-emerald-400 bg-emerald-500/10',
                      b.type === 'white' && 'text-slate-200 bg-slate-700/60',
                      b.type === 'yellow' && 'text-yellow-400 bg-yellow-500/10'
                    )}
                  >
                    {b.type} • {b.status}
                  </span>
                </button>
              ))}

              {incomingBranches.length === 0 && outgoingBranches.length === 0 && (
                <span className="text-slate-500 text-[11px] italic">
                  No active connections attached.
                </span>
              )}
            </div>
          </div>

          {/* Removal Action */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              disabled={isRootNgo || isNodeLocked}
              onClick={handleRemovePlacement}
              title={
                isRootNgo
                  ? 'Root NGO cannot be removed from workbook'
                  : isNodeLocked
                  ? 'Node is locked'
                  : 'Remove partner card and delete all attached branches'
              }
              className={clsx(
                'w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                isRootNgo || isNodeLocked
                  ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 cursor-pointer'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isRootNgo ? 'Root NGO Protected' : isNodeLocked ? 'Node Locked' : 'Remove from Workbook'}
              </span>
            </button>
          </div>
        </div>
      </aside>
      <ManageSectorsModal
        isOpen={isManageSectorsOpen}
        onClose={() => setIsManageSectorsOpen(false)}
      />
      <PointsOfContactModal
        isOpen={isPocOpen}
        onClose={() => setIsPocOpen(false)}
        entityId={selectedEntity.entityId}
      />
    </>
  );
  }

  // ---------------------------------------------------------------------------
  // View 2: Branch Inspector
  // ---------------------------------------------------------------------------
  if (selectedBranch) {
    const srcPlacement = workspace?.placements[selectedBranch.sourcePlacementId];
    const tgtPlacement = workspace?.placements[selectedBranch.targetPlacementId];
    const srcEntity = srcPlacement ? workspace?.entities[srcPlacement.entityId] : null;
    const tgtEntity = tgtPlacement ? workspace?.entities[tgtPlacement.entityId] : null;
    const isBranchLocked = lockedBranchIds.includes(selectedBranch.branchId) || isWorkspaceLocked;

    const activePlacements = Object.values(workspace?.placements ?? {}).filter(
      (p) => p.workbookId === activeWorkbookId
    );

    const getPlacementName = (pId: string) => {
      const p = workspace?.placements[pId];
      if (!p) return pId;
      const e = workspace?.entities[p.entityId];
      return e?.name ?? pId;
    };

    const handleDeleteBranch = async () => {
      if (isBranchLocked) return;
      const confirmed = window.confirm(
        `Delete this ${selectedBranch.type.toUpperCase()} branch between "${srcEntity?.name ?? 'Source'}" and "${tgtEntity?.name ?? 'Target'}"?`
      );
      if (confirmed) {
        await deleteBranch(selectedBranch.branchId);
      }
    };

    return (
      <>
        <aside aria-label="Context Inspector" className="w-80 max-w-[360px] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col z-20 overflow-hidden select-none transition-opacity duration-150 max-h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2 min-w-0">
            <GitCommit className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider truncate">
              Branch Inspector
            </span>
            {isBranchLocked && (
              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/40">
                <Lock className="w-2.5 h-2.5" />
                Locked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin text-xs">
          {/* Pathway Source -> Target with editable Origin & Destination */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
              <span>Source (Origin)</span>
              <span>Target (Destination)</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Origin / Source Selector */}
              <select
                id="inspector-branch-source"
                aria-label="Source Placement (Origin)"
                value={selectedBranch.sourcePlacementId}
                disabled={isBranchLocked}
                onChange={(e) =>
                  updateBranch(selectedBranch.branchId, { sourcePlacementId: e.target.value })
                }
                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500 truncate cursor-pointer disabled:opacity-50"
              >
                {activePlacements
                  .filter((p) => p.placementId !== selectedBranch.targetPlacementId)
                  .map((p) => (
                    <option key={p.placementId} value={p.placementId}>
                      {getPlacementName(p.placementId)}
                    </option>
                  ))}
              </select>

              {/* Swap Origin / Target Direction */}
              <button
                type="button"
                disabled={isBranchLocked}
                title="Swap origin and destination"
                onClick={() =>
                  updateBranch(selectedBranch.branchId, {
                    sourcePlacementId: selectedBranch.targetPlacementId,
                    targetPlacementId: selectedBranch.sourcePlacementId,
                  })
                }
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              {/* Target / Destination Selector */}
              <select
                id="inspector-branch-target"
                aria-label="Target Placement (Destination)"
                value={selectedBranch.targetPlacementId}
                disabled={isBranchLocked}
                onChange={(e) =>
                  updateBranch(selectedBranch.branchId, { targetPlacementId: e.target.value })
                }
                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500 truncate cursor-pointer disabled:opacity-50"
              >
                {activePlacements
                  .filter((p) => p.placementId !== selectedBranch.sourcePlacementId)
                  .map((p) => (
                    <option key={p.placementId} value={p.placementId}>
                      {getPlacementName(p.placementId)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Verification Status Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-medium">Verification Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { status: 'pending' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.status === 'pending'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { status: 'tick' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.status === 'tick'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Tick
              </button>
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { status: 'cross' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.status === 'cross'
                    ? 'border-slate-400 bg-slate-700/60 text-slate-200'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Cross
              </button>
            </div>
          </div>

          {/* Line Type Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-medium">Relationship Vector Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { type: 'green' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.type === 'green'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Funding
              </button>
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { type: 'white' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.type === 'white'
                    ? 'border-slate-300 bg-slate-100/10 text-white font-semibold'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => updateBranch(selectedBranch.branchId, { type: 'yellow' })}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                  selectedBranch.type === 'yellow'
                    ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300 font-semibold'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                )}
              >
                Bridge
              </button>
            </div>
          </div>

          {/* Conditional M% for Green Funding */}
          {selectedBranch.type === 'green' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-branch-funding-pct" className="text-slate-400 font-medium">
                Funding Target Share
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="inspector-branch-funding-pct"
                  type="number"
                  min={1}
                  max={100}
                  value={selectedBranch.valuePct ?? 10}
                  onChange={(e) =>
                    updateBranch(selectedBranch.branchId, {
                      valuePct: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-24 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">% of workbook target</span>
              </div>
            </div>
          )}

          {/* Qualitative Note */}
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-branch-qual-note" className="text-slate-400 font-medium">Qualitative Context / Referral Note</label>
            <textarea
              id="inspector-branch-qual-note"
              rows={3}
              value={selectedBranch.note}
              onChange={(e) =>
                updateBranch(selectedBranch.branchId, { note: e.target.value })
              }
              placeholder="Referral introduction source, MoUs, deliverables, or decline reasons..."
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Delete Branch Action */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={handleDeleteBranch}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Branch</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
  }

  return null;
};

export default InspectorDrawer;
