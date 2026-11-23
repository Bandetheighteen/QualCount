import React, { useState, useMemo } from 'react';
import {
  X,
  Filter,
  RotateCcw,
  Coins,
  Link2,
  GitFork,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Unplug,
  Network,
  Search,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore, computeConnectedTree } from '../../store/useWorkspaceStore';
import type { BranchStatus, BranchType } from '../../types/schema';

export interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ribbonPosition?: 'top' | 'bottom' | 'left' | 'right';
}

function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString()}`;
  }
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  ribbonPosition = 'top',
}) => {
  const filters = useWorkspaceStore((state) => state.filters);
  const setFilters = useWorkspaceStore((state) => state.setFilters);
  const resetFilters = useWorkspaceStore((state) => state.resetFilters);
  const sectors = useWorkspaceStore((state) => state.sectors);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const edges = useWorkspaceStore((state) => state.edges);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const metrics = useWorkspaceStore((state) => state.metrics);
  const theme = useWorkspaceStore((state) => state.theme);
  const isLight = theme === 'light';

  const selectedPlacementId = useWorkspaceStore((state) => state.selectedPlacementId);
  const selectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);

  const [nodeSearch, setNodeSearch] = useState('');
  const [stagedNodeIds, setStagedNodeIds] = useState<string[]>(() => filters.connectedToPlacementIds || []);

  // Sync staged nodes if external filters change
  React.useEffect(() => {
    if (filters.connectedToPlacementIds) {
      setStagedNodeIds(filters.connectedToPlacementIds);
    }
  }, [filters.connectedToPlacementIds]);

  const activeWorkbook =
    workspace && activeWorkbookId ? workspace.workbooks[activeWorkbookId] : null;
  const targetBudget = activeWorkbook?.targetBudgetInr ?? 0;
  const funding = metrics?.funding;

  const allActivePlacements =
    workspace && activeWorkbookId
      ? Object.values(workspace.placements).filter((p) => p.workbookId === activeWorkbookId)
      : [];
  const allActiveBranches =
    workspace && activeWorkbookId
      ? Object.values(workspace.branches).filter((b) => b.workbookId === activeWorkbookId)
      : [];

  const isolatedCount = allActivePlacements.filter((p) => {
    return !allActiveBranches.some(
      (b) => b.sourcePlacementId === p.placementId || b.targetPlacementId === p.placementId
    );
  }).length;
  const connectedCount = allActivePlacements.length - isolatedCount;

  // Searchable placements for connected tree filter
  const searchablePlacements = useMemo(() => {
    const list = allActivePlacements.map((p) => {
      const ent = workspace?.entities[p.entityId];
      return {
        placementId: p.placementId,
        name: ent?.name || 'Unknown',
        category: ent?.category || 'other',
        isRoot: p.isRootNgo,
      };
    });
    if (!nodeSearch.trim()) return list;
    const q = nodeSearch.toLowerCase().trim();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [allActivePlacements, workspace, nodeSearch]);

  const canvasSelectedPlacements = useMemo(() => {
    const ids = selectedPlacementIds.length > 0 ? selectedPlacementIds : selectedPlacementId ? [selectedPlacementId] : [];
    return allActivePlacements.filter((p) => ids.includes(p.placementId));
  }, [allActivePlacements, selectedPlacementId, selectedPlacementIds]);

  const activeTreePlacementIds = filters.connectedToPlacementIds || [];
  const hasActiveConnectedFilter = activeTreePlacementIds.length > 0;

  const handleFilterToTree = (placementIds: string[]) => {
    setFilters({ connectedToPlacementIds: placementIds });
  };

  if (!isOpen) return null;

  const toggleBranchType = (type: BranchType) => {
    const current = filters.branchTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    // Keep at least one or allow empty (if empty, none visible)
    setFilters({ branchTypes: next });
  };

  const toggleBranchStatus = (status: BranchStatus) => {
    const current = filters.branchStatuses;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters({ branchStatuses: next });
  };

  const toggleNodeCategory = (catId: string) => {
    const current = filters.nodeCategories;
    let next: string[];
    if (current.length === 0) {
      // If was previously 'all', clicking one excludes all others or selects just that one
      // Actually standard: clicking toggles from all. If empty, all sectors are active.
      // Selecting one means only that one is active.
      next = [catId];
    } else if (current.includes(catId)) {
      next = current.filter((c) => c !== catId);
    } else {
      next = [...current, catId];
    }
    setFilters({ nodeCategories: next });
  };

  const isAllCategoriesActive = filters.nodeCategories.length === 0;

  const panelPositionClass = {
    top: 'top-full mt-2 left-0',
    bottom: 'bottom-full mb-2 left-0',
    left: 'left-full ml-2 top-0',
    right: 'right-full mr-2 top-0',
  }[ribbonPosition] || 'top-full mt-2 left-0';

  const isFiltered =
    filters.branchTypes.length < 3 ||
    filters.branchStatuses.length < 3 ||
    filters.minFundingPct > 0 ||
    filters.nodeCategories.length > 0 ||
    filters.connectionFilter !== 'all' ||
    hasActiveConnectedFilter;

  return (
    <div
      role="region"
      aria-label="Filter Panel"
      className={clsx(
        'absolute z-40 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin rounded-2xl shadow-2xl p-4 select-none border transition-colors',
        panelPositionClass,
        isLight
          ? 'bg-white border-2 border-black text-black shadow-slate-900/15'
          : 'bg-slate-900/98 border-slate-700/90 text-slate-200 shadow-2xl'
      )}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between pb-3 border-b mb-3', isLight ? 'border-black' : 'border-slate-800')}>
        <div className="flex items-center gap-2">
          <Filter className={clsx('w-4 h-4', isLight ? 'text-black' : 'text-sky-400')} />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Filters & Visibility
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              title="Reset all filters"
              className={clsx(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer',
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-black border border-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300'
              )}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter panel"
            className={clsx(
              'p-1 rounded-lg transition-colors cursor-pointer',
              isLight
                ? 'hover:bg-slate-100 text-black hover:text-black'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Match Counter Bar */}
      <div
        className={clsx(
          'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium mb-3 border',
          isLight
            ? 'bg-slate-50 border-2 border-black text-black font-semibold'
            : 'bg-slate-950/80 border-slate-800 text-slate-300'
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Canvas:</span>
        </span>
        <span className="font-mono text-[11px] font-bold">
          {nodes.length} Nodes · {edges.length} Branches
        </span>
      </div>

      <div className="flex flex-col gap-4 text-xs">
        {/* =================================================================== */}
        {/* Category 1: Branch Filters                                          */}
        {/* =================================================================== */}
        <div className="flex flex-col gap-2">
          <span
            className={clsx(
              'font-bold text-[11px] uppercase tracking-wider',
              isLight ? 'text-black' : 'text-slate-400'
            )}
          >
            Branch Filters
          </span>

          {/* Branch Types */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">By Relationship Type</span>
            <div className="grid grid-cols-1 gap-1">
              <label
                className={clsx(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors',
                  filters.branchTypes.includes('green')
                    ? isLight
                      ? 'bg-emerald-50 border-2 border-emerald-700 text-emerald-950 font-semibold'
                      : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                <div className="flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-medium">Funding (Green)</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.branchTypes.includes('green')}
                  onChange={() => toggleBranchType('green')}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                />
              </label>

              <label
                className={clsx(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors',
                  filters.branchTypes.includes('white')
                    ? isLight
                      ? 'bg-slate-100 border-2 border-black text-black font-semibold'
                      : 'bg-slate-800 border-slate-600 text-slate-200'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                <div className="flex items-center gap-2">
                  <Link2 className={clsx('w-3.5 h-3.5', isLight ? 'text-black' : 'text-slate-200')} />
                  <span className="font-medium">Direct Relationship (White)</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.branchTypes.includes('white')}
                  onChange={() => toggleBranchType('white')}
                  className="w-3.5 h-3.5 rounded accent-slate-500 cursor-pointer"
                />
              </label>

              <label
                className={clsx(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors',
                  filters.branchTypes.includes('yellow')
                    ? isLight
                      ? 'bg-amber-50 border-2 border-amber-700 text-amber-950 font-semibold'
                      : 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                <div className="flex items-center gap-2">
                  <GitFork className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="font-medium">Network Bridge (Yellow)</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.branchTypes.includes('yellow')}
                  onChange={() => toggleBranchType('yellow')}
                  className="w-3.5 h-3.5 rounded accent-yellow-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Branch Statuses */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className={clsx('text-[11px] font-medium', isLight ? 'text-black font-semibold' : 'text-slate-500')}>By Outreach Status</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => toggleBranchStatus('tick')}
                className={clsx(
                  'flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all',
                  filters.branchStatuses.includes('tick')
                    ? isLight
                      ? 'bg-emerald-50 border-2 border-black text-black font-bold'
                      : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-600'
                )}
              >
                <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-500" />
                <span>Confirmed</span>
              </button>

              <button
                type="button"
                onClick={() => toggleBranchStatus('pending')}
                className={clsx(
                  'flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all',
                  filters.branchStatuses.includes('pending')
                    ? isLight
                      ? 'bg-amber-50 border-2 border-black text-black font-bold'
                      : 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-600'
                )}
              >
                <Clock className="w-4 h-4 mb-1 text-amber-500" />
                <span>Pending</span>
              </button>

              <button
                type="button"
                onClick={() => toggleBranchStatus('cross')}
                className={clsx(
                  'flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all',
                  filters.branchStatuses.includes('cross')
                    ? isLight
                      ? 'bg-rose-50 border-2 border-black text-black font-bold'
                      : 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                    : isLight
                    ? 'bg-slate-50 border border-black/30 text-black'
                    : 'bg-slate-950 border-slate-800 text-slate-600'
                )}
              >
                <XCircle className="w-4 h-4 mb-1 text-rose-500" />
                <span>Declined</span>
              </button>
            </div>
          </div>

          {/* Funding Raised / Allocation Min Threshold */}
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className={clsx('font-medium', isLight ? 'text-black font-semibold' : 'text-slate-400')}>
                Min Funding Allocation
              </span>
              <span className="font-mono font-bold text-emerald-600">
                {filters.minFundingPct > 0
                  ? `≥ M${filters.minFundingPct}% (${formatInr((filters.minFundingPct / 100) * targetBudget)})`
                  : 'All Amounts'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.minFundingPct}
              onChange={(e) => setFilters({ minFundingPct: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex items-center justify-between gap-1 mt-0.5">
              {[0, 10, 25, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setFilters({ minFundingPct: pct })}
                  className={clsx(
                    'flex-1 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer text-center',
                    filters.minFundingPct === pct
                      ? isLight
                        ? 'bg-emerald-600 text-white border-black shadow-sm font-bold'
                        : 'bg-emerald-600 text-white border-emerald-400'
                      : isLight
                      ? 'bg-slate-100 border border-black/30 text-black hover:bg-slate-200 hover:border-black'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  )}
                >
                  {pct === 0 ? 'All' : `≥${pct}%`}
                </button>
              ))}
            </div>

            {/* Money summary card */}
            {funding && (
              <div
                className={clsx(
                  'p-2 rounded-lg border text-[11px] flex flex-col gap-1 mt-1 font-mono',
                  isLight
                    ? 'bg-emerald-50 border-2 border-emerald-700 text-emerald-950'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={clsx('font-sans font-semibold text-[10px] uppercase tracking-wide', isLight ? 'text-black' : 'text-slate-300')}>Raised / Secured:</span>
                  <span className="font-bold">
                    M{funding.securedPct}% ({formatInr(funding.securedInr)})
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={clsx('font-sans', isLight ? 'text-black' : 'text-slate-400')}>Pending Outreach:</span>
                  <span className="font-semibold">+M{funding.pendingPct}% ({formatInr((funding.pendingPct / 100) * targetBudget)})</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={clsx('font-sans', isLight ? 'text-black' : 'text-slate-400')}>Remaining Gap:</span>
                  <span className="font-semibold">M{Math.max(0, 100 - funding.securedPct)}% ({formatInr(Math.max(0, targetBudget - funding.securedInr))})</span>
                </div>
                <div className="flex items-center justify-between text-[10px] border-t pt-1 border-current/20">
                  <span className={clsx('font-sans font-semibold', isLight ? 'text-black' : 'text-slate-300')}>Target Budget:</span>
                  <span className="font-bold">{formatInr(targetBudget)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className={clsx('h-[1px]', isLight ? 'bg-black' : 'bg-slate-800')} />

        {/* =================================================================== */}
        {/* Category 2: Node Filters                                            */}
        {/* =================================================================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className={clsx(
                'font-bold text-[11px] uppercase tracking-wider',
                isLight ? 'text-black' : 'text-slate-400'
              )}
            >
              Node Filters
            </span>
            <button
              type="button"
              onClick={() => setFilters({ nodeCategories: [] })}
              className={clsx(
                'text-[10px] underline cursor-pointer',
                isAllCategoriesActive
                  ? 'text-slate-400'
                  : isLight
                  ? 'text-black font-bold'
                  : 'text-sky-400'
              )}
            >
              {isAllCategoriesActive ? 'All Sectors Active' : 'Show All Sectors'}
            </button>
          </div>

          {/* Connection Status: Nodes without any connection */}
          <div className="flex flex-col gap-1.5">
            <span className={clsx('text-[11px] font-medium', isLight ? 'text-black' : 'text-slate-500')}>By Network Connectivity</span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setFilters({ connectionFilter: 'all' })}
                className={clsx(
                  'py-1 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all text-center',
                  filters.connectionFilter === 'all'
                    ? isLight
                      ? 'bg-black text-white border-black font-bold'
                      : 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                    : isLight
                    ? 'bg-slate-50 border-black/30 text-black hover:border-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                All Nodes ({allActivePlacements.length})
              </button>

              <button
                type="button"
                onClick={() => setFilters({ connectionFilter: 'onlyConnected' })}
                className={clsx(
                  'py-1 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all text-center flex items-center justify-center gap-1',
                  filters.connectionFilter === 'onlyConnected'
                    ? isLight
                      ? 'bg-black text-white border-black font-bold'
                      : 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                    : isLight
                    ? 'bg-slate-50 border-black/30 text-black hover:border-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                <span>Connected ({connectedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilters({ connectionFilter: 'onlyUnconnected' })}
                title="Nodes without any connection"
                className={clsx(
                  'py-1 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all text-center flex items-center justify-center gap-1',
                  filters.connectionFilter === 'onlyUnconnected'
                    ? isLight
                      ? 'bg-amber-600 text-white border-black font-bold'
                      : 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : isLight
                    ? 'bg-slate-50 border-black/30 text-black hover:border-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                )}
              >
                <Unplug className="w-3 h-3" />
                <span>Isolated ({isolatedCount})</span>
              </button>
            </div>
            {filters.connectionFilter === 'onlyUnconnected' && (
              <span className="text-[10px] text-amber-600 font-bold">
                Filtering to show only nodes without any connection
              </span>
            )}
          </div>

          {/* Sector Categories */}
          <div className="flex flex-col gap-1 mt-1">
            <span className={clsx('text-[11px] font-medium', isLight ? 'text-black' : 'text-slate-500')}>By Sector Category</span>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto scrollbar-thin pr-1">
              {sectors.map((cat) => {
                const count = allActivePlacements.filter((p) => {
                  const ent = workspace?.entities[p.entityId];
                  return ent && ent.category === cat.id;
                }).length;
                const isSelected =
                  isAllCategoriesActive || filters.nodeCategories.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={clsx(
                      'flex items-center justify-between px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer transition-colors',
                      isSelected
                        ? isLight
                          ? 'bg-slate-100 border-2 border-black text-black font-semibold'
                          : 'bg-slate-800/80 border-slate-700 text-slate-200'
                        : isLight
                        ? 'bg-white border border-black/30 text-black'
                        : 'bg-slate-950 border-slate-800 text-slate-600'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                      <span className="text-[10px] opacity-70 font-mono">({count})</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleNodeCategory(cat.id)}
                      className="w-3.5 h-3.5 rounded accent-sky-500 cursor-pointer shrink-0 ml-2"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className={clsx('h-[1px]', isLight ? 'bg-black' : 'bg-slate-800')} />

        {/* =================================================================== */}
        {/* Category 3: Connected Network / Tree Filter (Selected Nodes)         */}
        {/* =================================================================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className={clsx(
                'font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5',
                isLight ? 'text-black' : 'text-slate-400'
              )}
            >
              <Network className="w-3.5 h-3.5 text-amber-500" />
              <span>Connected Tree Filter</span>
            </span>
            {hasActiveConnectedFilter && (
              <button
                type="button"
                onClick={() => {
                  setStagedNodeIds([]);
                  setFilters({ connectedToPlacementIds: [] });
                }}
                className="text-[10px] text-amber-500 font-bold underline cursor-pointer"
              >
                Clear Tree Filter
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-tight">
            Select one or more hub nodes (e.g. Kutch Museum, HIC) and click the button to show only their connected tree, hiding all others.
          </p>

          {/* Quick pick from currently selected canvas nodes */}
          {canvasSelectedPlacements.length > 0 && (
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px]">
              <span className="truncate max-w-[170px] text-amber-600 font-medium">
                Canvas selected ({canvasSelectedPlacements.length}): {canvasSelectedPlacements.map((p) => workspace?.entities[p.entityId]?.name).filter(Boolean).join(', ')}
              </span>
              <button
                type="button"
                onClick={() => {
                  const ids = canvasSelectedPlacements.map((p) => p.placementId);
                  setStagedNodeIds(ids);
                  handleFilterToTree(ids);
                }}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black hover:bg-amber-400 transition-colors shrink-0"
              >
                Use Selected
              </button>
            </div>
          )}

          {/* Searchable Node Picker */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search partner node (e.g. Kutch Museum, HIC)..."
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              className={clsx(
                'w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg border outline-none font-sans',
                isLight
                  ? 'bg-slate-50 border-black/30 text-black placeholder-slate-400 focus:border-black'
                  : 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-sky-500'
              )}
            />
          </div>

          {/* Filtered Node List with Checkboxes and Individual Reach Counts */}
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto scrollbar-thin pr-1">
            {searchablePlacements.slice(0, 25).map((p) => {
              const isStaged = stagedNodeIds.includes(p.placementId);
              const treeReach = computeConnectedTree([p.placementId], allActiveBranches).size;

              return (
                <div
                  key={p.placementId}
                  onClick={() => {
                    const next = isStaged
                      ? stagedNodeIds.filter((id) => id !== p.placementId)
                      : [...stagedNodeIds, p.placementId];
                    setStagedNodeIds(next);
                  }}
                  className={clsx(
                    'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer select-none',
                    isStaged
                      ? isLight
                        ? 'bg-amber-100 border-2 border-amber-700 text-black font-bold'
                        : 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                      : isLight
                      ? 'bg-slate-50 border-black/20 text-black hover:bg-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <input
                      type="checkbox"
                      checked={isStaged}
                      onChange={() => {}} // Handled by container onClick
                      className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                        {treeReach} connected through here
                      </span>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      'text-[9px] uppercase px-1.5 py-0.5 rounded font-mono shrink-0',
                      isStaged ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800/40 text-slate-500'
                    )}
                  >
                    {isStaged ? 'Selected' : 'Pick'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Primary Action Button: "Show result and connect to selected nodes" */}
          <button
            type="button"
            onClick={() => {
              handleFilterToTree(stagedNodeIds);
            }}
            disabled={stagedNodeIds.length === 0 && !hasActiveConnectedFilter}
            className={clsx(
              'w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer',
              stagedNodeIds.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            )}
          >
            <Network className="w-3.5 h-3.5" />
            <span>
              {stagedNodeIds.length > 0
                ? `Show result connecting to selected nodes (${stagedNodeIds.length})`
                : 'Select nodes above to filter tree'}
            </span>
          </button>

          {/* Active Status Display with Breakdown */}
          {hasActiveConnectedFilter && (
            <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] font-mono text-amber-600 dark:text-amber-400 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Tree Filter Active ({nodes.length} nodes visible)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStagedNodeIds([]);
                    setFilters({ connectedToPlacementIds: [] });
                  }}
                  className="text-[10px] underline font-bold cursor-pointer"
                >
                  Clear ✕
                </button>
              </div>

              {/* Per-Node Breakdown */}
              <div className="pt-1 text-[10px] space-y-0.5 opacity-90 border-t border-amber-500/30">
                {activeTreePlacementIds.map((pId) => {
                  const p = allActivePlacements.find((pl) => pl.placementId === pId);
                  const name = workspace?.entities[p?.entityId || '']?.name || pId;
                  const count = computeConnectedTree([pId], allActiveBranches).size;
                  return (
                    <div key={pId} className="flex items-center justify-between">
                      <span className="truncate max-w-[170px]">• {name}:</span>
                      <span className="font-bold">{count} connecting</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] pt-1 opacity-75">
                All unlinked branches and unrelated organizations are hidden.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
