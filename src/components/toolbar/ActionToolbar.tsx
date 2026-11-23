import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Hand,
  Search,
  Plus,
  GitCommit,
  Wand2,
  Filter,
  Eye,
  EyeOff,
  Download,
  RotateCcw,
  Layers,
  Lock,
  Unlock,
  Undo2,
  Redo2,
  Menu,
  Pin,
  PinOff,
  Link2,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { WorkbookSearchBar } from '../canvas/WorkbookSearchBar';
import { AddNodeModal } from './AddNodeModal';
import { ConnectBranchModal } from './ConnectBranchModal';
import { ManageSectorsModal } from './ManageSectorsModal';
import { FilterPanel } from './FilterPanel';
import { SpreadsheetImportModal } from './SpreadsheetImportModal';
import { exportCsvBundle, exportExcelWorkbook, downloadFile } from '../../io/spreadsheetExport';
import { computePublicChoiceUtilityReport } from '../../engine/utility';
import { computeStructuralRiskReport } from '../../engine/risk';

export const ActionToolbar: React.FC = () => {
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [isConnectBranchOpen, setIsConnectBranchOpen] = useState(false);
  const [isManageSectorsOpen, setIsManageSectorsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSpreadsheetImportOpen, setIsSpreadsheetImportOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRibbonPinned =
    typeof window !== 'undefined'
      ? useWorkspaceStore((state) => state.isRibbonPinned)
      : useWorkspaceStore.getState().isRibbonPinned;
  const toggleRibbonPinned = useWorkspaceStore((state) => state.toggleRibbonPinned);
  const isPinned = isRibbonPinned;

  const showDeclined = useWorkspaceStore((state) => state.showDeclined);
  const isLayoutRunning = useWorkspaceStore((state) => state.isLayoutRunning);
  const dragConnectEnabled = useWorkspaceStore((state) => state.dragConnectEnabled);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const selectedPlacementId = useWorkspaceStore((state) => state.selectedPlacementId);
  const selectedBranchId = useWorkspaceStore((state) => state.selectedBranchId);
  const selectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);
  const selectedBranchIds = useWorkspaceStore((state) => state.selectedBranchIds);
  const lockedPlacementIds = useWorkspaceStore((state) => state.lockedPlacementIds);
  const lockedBranchIds = useWorkspaceStore((state) => state.lockedBranchIds);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const ribbonPosition = useWorkspaceStore((state) => state.ribbonPosition);
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const theme = useWorkspaceStore.getState().theme ?? storeTheme;
  const isLight = theme === 'light';
  const filters = useWorkspaceStore((state) => state.filters);

  const isFilterActive =
    filters.branchTypes.length < 3 ||
    filters.branchStatuses.length < 3 ||
    filters.minFundingPct > 0 ||
    filters.nodeCategories.length > 0 ||
    filters.connectionFilter !== 'all';

  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const toggleDragConnect = useWorkspaceStore((state) => state.toggleDragConnect);
  const toggleShowDeclined = useWorkspaceStore((state) => state.toggleShowDeclined);
  const tidyUpLayout = useWorkspaceStore((state) => state.tidyUpLayout);
  const resetToDelhiSeed = useWorkspaceStore((state) => state.resetToDelhiSeed);
  const agentMutationNotification = useWorkspaceStore((state) => state.agentMutationNotification);
  const revertLastAgentChange = useWorkspaceStore((state) => state.revertLastAgentChange);
  const dismissAgentNotification = useWorkspaceStore((state) => state.dismissAgentNotification);
  const toggleLockSelected = useWorkspaceStore((state) => state.toggleLockSelected);
  const toggleWorkspaceLock = useWorkspaceStore((state) => state.toggleWorkspaceLock);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const canUndo = useWorkspaceStore((state) => state.canUndo);
  const canRedo = useWorkspaceStore((state) => state.canRedo);
  const isSearchOpen = useWorkspaceStore((state) => state.isSearchOpen);
  const openSearch = useWorkspaceStore((state) => state.openSearch);
  const closeSearch = useWorkspaceStore((state) => state.closeSearch);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  // Global Ctrl+F / Cmd+F handler to open toolbar search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInput =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (activeEl as HTMLElement)?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        if (!isInput || !isSearchOpen) {
          e.preventDefault();
          openSearch();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch, isSearchOpen]);

  const handleResetDemo = async () => {
    const confirmed = window.confirm(
      'Reset workspace to the Sample Workspace seed dataset? Any unsaved modifications will be reverted.'
    );
    if (confirmed) {
      await resetToDelhiSeed();
    }
  };

  const handleExportCsv = () => {
    const ws = useWorkspaceStore.getState().workspace;
    const wbId = useWorkspaceStore.getState().activeWorkbookId;
    if (!ws || !wbId) return;
    const wb = ws.workbooks[wbId];
    const wbContext = {
      ...ws,
      activeWorkbookId: wbId,
      utilityWeights: wb?.utilityWeights,
      targetBudgetInr: wb?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, ws.entities);
    const bundle = exportCsvBundle(wbContext, ws.entities, uReport);
    const slug = (wb?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(bundle.nodesCsv, `${slug}_nodes.csv`, 'text/csv;charset=utf-8');
    downloadFile(bundle.branchesCsv, `${slug}_branches.csv`, 'text/csv;charset=utf-8');
    setIsExportMenuOpen(false);
  };

  const handleExportExcel = async () => {
    const ws = useWorkspaceStore.getState().workspace;
    const wbId = useWorkspaceStore.getState().activeWorkbookId;
    if (!ws || !wbId) return;
    const wb = ws.workbooks[wbId];
    const wbContext = {
      ...ws,
      activeWorkbookId: wbId,
      utilityWeights: wb?.utilityWeights,
      targetBudgetInr: wb?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, ws.entities);
    const rReport = computeStructuralRiskReport(wbContext, ws.entities);
    const blob = await exportExcelWorkbook(wbContext, ws.entities, uReport, rReport);
    const slug = (wb?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(blob, `${slug}_workbook.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setIsExportMenuOpen(false);
  };

  // Lock button: single click locks selected item, double click locks entire workspace
  const handleLockClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      toggleWorkspaceLock();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (isWorkspaceLocked) {
          toggleWorkspaceLock();
        } else {
          toggleLockSelected();
        }
      }, 320);
    }
  };

  const handleLockDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    toggleWorkspaceLock();
  };

  // Determine current lock state indicator
  const isSelectedLocked =
    (selectedPlacementId && lockedPlacementIds.includes(selectedPlacementId)) ||
    (selectedBranchId && lockedBranchIds.includes(selectedBranchId)) ||
    (selectedPlacementIds.length > 0 && selectedPlacementIds.every((id) => lockedPlacementIds.includes(id))) ||
    (selectedBranchIds.length > 0 && selectedBranchIds.every((id) => lockedBranchIds.includes(id)));

  const isExpanded = isPinned || isHovered || isSearchOpen;
  const isVertical = ribbonPosition === 'left' || ribbonPosition === 'right';

  const getTooltipClass = (isFirst = false) =>
    clsx(
      'absolute px-2.5 py-1 rounded text-[11px] whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-300 delay-300 ease-out z-50 shadow-2xl font-bold',
      isLight
        ? 'bg-black text-white border border-black shadow-slate-900/20'
        : 'bg-slate-950 border border-slate-700 text-slate-200',
      ribbonPosition === 'left'
        ? 'left-full ml-2 top-1/2 -translate-y-1/2'
        : ribbonPosition === 'right'
        ? 'right-full mr-2 top-1/2 -translate-y-1/2'
        : ribbonPosition === 'bottom'
        ? clsx('bottom-full mb-1.5', isFirst ? 'left-0' : 'left-1/2 -translate-x-1/2')
        : clsx('top-full mt-1.5', isFirst ? 'left-0' : 'left-1/2 -translate-x-1/2')
    );

  const separatorClass = isVertical
    ? clsx('w-5 h-[1px] my-1 shrink-0', isLight ? 'bg-black' : 'bg-slate-700/80')
    : clsx('w-[1px] h-5 mx-1 shrink-0', isLight ? 'bg-black' : 'bg-slate-700/80');

  return (
    <>
      {agentMutationNotification && (
        <div
          role="status"
          aria-live="polite"
          className={clsx(
            'fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-lg border shadow-xl font-mono text-[11px] flex items-center justify-between gap-3 animate-fade-in transition-all',
            'bg-[#FAF8F4] text-[#2C2825] border-[#DDD6C8] dark:bg-[#1A1C23] dark:text-[#E2D9C8] dark:border-[#3A3D4A]'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-900 dark:text-amber-400 shrink-0">
              Agent [{agentMutationNotification.agentName}]:
            </span>
            <span className="truncate max-w-[280px] text-stone-700 dark:text-stone-300" title={agentMutationNotification.summary}>
              {agentMutationNotification.summary}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={revertLastAgentChange}
              className="px-2 py-0.5 rounded border border-[#BEB5A4] dark:border-amber-700/60 bg-[#F2EFE9] hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer text-[10px]"
              title="Undo agent change and restore previous snapshot"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Undo Agent Change</span>
            </button>
            <button
              type="button"
              onClick={dismissAgentNotification}
              className="p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group transition-colors duration-300"
      >
        {/* Shrunk-down Tab Indicator when ribbon is auto-hidden and unhovered */}
        {!isExpanded ? (
          <div
            className={clsx(
              'rounded-xl border shadow-2xl backdrop-blur-md cursor-pointer transition-all duration-200',
              isLight
                ? 'bg-white border-2 border-black text-black hover:bg-slate-100'
                : 'bg-slate-900/90 hover:bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white',
              isVertical
                ? 'flex flex-col items-center gap-1.5 px-2 py-2.5'
                : 'flex items-center gap-1.5 px-3 py-1.5'
            )}
          >
            <Menu className={clsx('w-4 h-4', isLight ? 'text-black' : 'text-sky-400')} />
            {!isVertical && <span className="text-[11px] font-semibold tracking-wide">Toolbar</span>}
            <div
              className={clsx(
                'opacity-70',
                isVertical ? 'flex flex-col items-center gap-1 mt-0.5' : 'flex items-center gap-1 ml-1'
              )}
            >
              <MousePointer className="w-3 h-3" />
              <Plus className="w-3 h-3" />
              <Wand2 className="w-3 h-3" />
            </div>
          </div>
        ) : (
          /* Full Sectioned Action Ribbon (Fixed-size buttons, non-jiggling hover) */
          <nav
            aria-label="Action Toolbar"
            className={clsx(
              'rounded-xl px-2 py-1.5 shadow-2xl backdrop-blur-md select-none border transition-colors duration-200',
              isLight
                ? 'bg-white border-2 border-black text-black shadow-slate-900/15'
                : 'bg-slate-900/95 border-slate-700/80 text-slate-200',
              isVertical ? 'flex flex-col items-center gap-1' : 'flex items-center gap-1'
            )}
          >
            {/* ============================================================= */}
            {/* SECTION 1: Navigation & Interaction Tools                    */}
            {/* ============================================================= */}
            {/* Tool 1: Pointer Selection Tool */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => setActiveTool('pointer')}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  activeTool === 'pointer'
                    ? isLight
                      ? 'bg-black text-white border-black font-bold shadow-sm'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                    : isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                )}
                aria-label="Select Pointer Tool"
              >
                <MousePointer className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass(true)}>
                Pointer Tool (Hold Space to Pan)
              </div>
            </div>

            {/* Tool 2: Hand Pan Tool */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => setActiveTool(activeTool === 'hand' ? 'pointer' : 'hand')}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  activeTool === 'hand'
                    ? isLight
                      ? 'bg-black text-white border-black font-bold shadow-sm'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                )}
                aria-label="Hand Pan Tool"
              >
                <Hand className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Hand Pan Tool
              </div>
            </div>

            {/* Tool 3: Search Node Tool */}
            {isSearchOpen && !isVertical ? (
              <div className="relative flex items-center">
                <WorkbookSearchBar
                  variant="toolbar"
                  autoFocus
                  onClose={() => closeSearch()}
                  dropdownPlacement={ribbonPosition === 'bottom' ? 'top' : 'bottom'}
                />
              </div>
            ) : (
              <div className="relative group/tooltip flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isSearchOpen) {
                      closeSearch();
                    } else {
                      openSearch();
                    }
                  }}
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                    isSearchOpen
                      ? isLight
                        ? 'bg-amber-600 text-white border-black font-bold shadow-sm'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                      : isLight
                      ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                  )}
                  aria-label="Search Node"
                  title="Search Node (Ctrl+F)"
                >
                  <Search className="w-4 h-4 shrink-0" />
                </button>
                {!isSearchOpen && (
                  <div className={getTooltipClass()}>
                    <span>Search Node</span>
                    <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+F)</span>
                  </div>
                )}

                {/* Vertical ribbon floating search popover */}
                {isSearchOpen && isVertical && (
                  <div
                    className={clsx(
                      'absolute z-50 animate-in fade-in zoom-in-95 duration-150',
                      ribbonPosition === 'left' ? 'left-full ml-2 top-0' : 'right-full mr-2 top-0'
                    )}
                  >
                    <WorkbookSearchBar
                      variant="toolbar"
                      autoFocus
                      onClose={() => closeSearch()}
                      dropdownPlacement="bottom"
                      dropdownAlign={ribbonPosition === 'right' ? 'right' : 'left'}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Separator Bar */}
            <div className={separatorClass} />

            {/* ============================================================= */}
            {/* SECTION 2: Creation & Connectivity                            */}
            {/* ============================================================= */}
            {/* Add Node Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => setIsAddNodeOpen(true)}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-sky-600 text-white hover:bg-sky-700 border-black shadow-sm'
                    : 'bg-sky-600/90 text-white hover:bg-sky-500 border-sky-400/60 shadow-[0_0_8px_rgba(2,132,199,0.3)]'
                )}
                aria-label="Add Node"
              >
                <Plus className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Add Organization Card
              </div>
            </div>

            {/* Manage Sectors Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => setIsManageSectorsOpen(true)}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-slate-100 text-indigo-950 border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-indigo-400 hover:bg-slate-700 hover:text-indigo-300 border-slate-700'
                )}
                aria-label="Add Sector / Manage Categories"
              >
                <Layers className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Manage Sector Categories
              </div>
            </div>

            {/* Connect Branch Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => setIsConnectBranchOpen(true)}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-slate-100 text-emerald-950 border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300 border-slate-700'
                )}
                aria-label="Connect Branch"
              >
                <GitCommit className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Connect Multiplex Branch
              </div>
            </div>

            {/* Drag to Connect Toggle */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                role="switch"
                aria-checked={dragConnectEnabled}
                disabled={isWorkspaceLocked}
                onClick={toggleDragConnect}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
                  dragConnectEnabled
                    ? isLight
                      ? 'bg-black text-white border-black font-bold shadow-sm'
                      : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                    : isLight
                    ? 'bg-slate-100 text-black/60 border-black hover:text-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                )}
                aria-label="Toggle Drag to Connect"
              >
                <Link2 className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                {dragConnectEnabled ? 'Drag Connect Handles (Enabled)' : 'Drag Connect Handles (Disabled)'}
              </div>
            </div>

            {/* Separator Bar */}
            <div className={separatorClass} />

            {/* ============================================================= */}
            {/* SECTION 3: Layout Automation                                  */}
            {/* ============================================================= */}
            {/* Tidy Up (Hierarchical Layout Pass) */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={tidyUpLayout}
                disabled={isLayoutRunning || isWorkspaceLocked}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-slate-100 text-amber-950 border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-amber-400 border-amber-500/30 hover:bg-slate-700 hover:border-amber-400/60',
                  isLayoutRunning && 'animate-spin'
                )}
                aria-label="Tidy Up Layout"
              >
                <Wand2 className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Tidy Up Layout (Hierarchical)
              </div>
            </div>

            {/* Separator Bar */}
            <div className={separatorClass} />

            {/* ============================================================= */}
            {/* SECTION 4: Filters & Visibility                               */}
            {/* ============================================================= */}
            {/* Filter Panel Toggle Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={clsx(
                  'w-8 h-8 relative flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isFilterOpen || isFilterActive
                    ? isLight
                      ? 'bg-black text-white border-black font-bold shadow-sm'
                      : 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                    : isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                )}
                aria-label="Filter Map & Branches"
              >
                <Filter className="w-4 h-4 shrink-0" />
                {isFilterActive && (
                  <span className={clsx('absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-400 ring-2', isLight ? 'ring-black' : 'ring-slate-900')} />
                )}
              </button>
              <div className={getTooltipClass()}>
                {isFilterActive ? 'Filters Active (Click to edit)' : 'Filters (Branches & Nodes)'}
              </div>
            </div>

            {/* Show / Hide Declined Paths */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={toggleShowDeclined}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  showDeclined
                    ? isLight
                      ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    : isLight
                    ? 'bg-slate-100 text-black/40 border-black hover:text-black hover:bg-slate-200'
                    : 'bg-slate-850 text-slate-500 border-slate-800 hover:text-slate-400'
                )}
                aria-label="Toggle Declined Paths"
              >
                {showDeclined ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
              </button>
              <div className={getTooltipClass()}>
                {showDeclined ? 'Declined Paths: Visible' : 'Declined Paths: Hidden'}
              </div>
            </div>

            {/* Separator Bar */}
            <div className={separatorClass} />

            {/* ============================================================= */}
            {/* SECTION 5: History (Undo / Redo)                              */}
            {/* ============================================================= */}
            {/* Undo Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => undo()}
                disabled={!canUndo()}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700'
                )}
                aria-label="Undo"
              >
                <Undo2 className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Undo (Ctrl+Z)
              </div>
            </div>

            {/* Redo Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => redo()}
                disabled={!canRedo()}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
                  isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700'
                )}
                aria-label="Redo"
              >
                <Redo2 className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Redo (Ctrl+Y)
              </div>
            </div>

            {/* Separator Bar */}
            <div className={separatorClass} />

            {/* ============================================================= */}
            {/* SECTION 6: Workspace & Storage Actions                        */}
            {/* ============================================================= */}
            {/* Lock Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={handleLockClick}
                onDoubleClick={handleLockDoubleClick}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isWorkspaceLocked
                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse'
                    : isSelectedLocked
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                )}
                aria-label="Lock / Unlock"
              >
                {isWorkspaceLocked ? (
                  <Lock className="w-4 h-4 text-rose-500 shrink-0" />
                ) : isSelectedLocked ? (
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Unlock className="w-4 h-4 shrink-0" />
                )}
              </button>
              <div className={getTooltipClass()}>
                {isWorkspaceLocked ? 'Workbook Locked' : isSelectedLocked ? 'Item Locked' : 'Lock Item / Workbook'}
              </div>
            </div>

            {/* Export Menu */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700'
                )}
                aria-label="Export Data"
              >
                <Download className="w-4 h-4 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Export Data
              </div>

              {/* Export Dropdown Menu */}
              {isExportMenuOpen && (
                <div className="absolute top-10 left-0 z-50 w-48 bg-white dark:bg-[#1E2228] border border-[#BEB5A4] dark:border-[#4B5563] rounded-[6px] shadow-xl py-1 text-xs">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] text-[#1C1B18] dark:text-[#F4F2ED] font-medium cursor-pointer"
                  >
                    Export CSV Bundle (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] text-[#1C1B18] dark:text-[#F4F2ED] font-medium cursor-pointer"
                  >
                    Export Excel Workbook (.xls)
                  </button>
                </div>
              )}
            </div>

            {/* Import Spreadsheet (CSV / Excel) */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsSpreadsheetImportOpen(true)}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isLight
                    ? 'bg-slate-100 text-black border-black hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700'
                )}
                aria-label="Import Spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#0F6B38] dark:text-[#34D399]" />
              </button>
              <div className={getTooltipClass()}>
                Import Spreadsheet (3-Door)
              </div>
            </div>

            {/* Reset Demo */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={handleResetDemo}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isLight
                    ? 'bg-slate-100 text-rose-700 hover:bg-rose-50 border-rose-600'
                    : 'bg-slate-800 text-rose-300 hover:bg-rose-500/20 border-slate-700'
                )}
                aria-label="Reset Demo"
              >
                <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
              </button>
              <div className={getTooltipClass()}>
                Reset to Sample Seed Dataset
              </div>
            </div>

            {/* Ribbon Auto-Hide Pin Toggle (Word/Excel style) */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                type="button"
                onClick={toggleRibbonPinned}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors duration-300 ease-out cursor-pointer shrink-0',
                  isPinned
                    ? isLight
                      ? 'bg-black text-white border-black font-bold'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400'
                    : isLight
                    ? 'bg-slate-100 text-black/60 border-black hover:text-black hover:bg-slate-200'
                    : 'bg-slate-850 text-slate-500 border-slate-700 hover:text-slate-300'
                )}
                aria-label={isPinned ? 'Unpin Ribbon (Auto-Hide)' : 'Pin Ribbon'}
              >
                {isPinned ? <Pin className="w-4 h-4 shrink-0" /> : <PinOff className="w-4 h-4 shrink-0" />}
              </button>
              <div className={getTooltipClass()}>
                {isPinned ? 'Unpin Ribbon (Auto-Hide)' : 'Pin Ribbon'}
              </div>
            </div>
          </nav>
        )}

        {/* Adjoining Filter Panel (Floating next to ribbon, live changes, zero blur) */}
        <FilterPanel
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          ribbonPosition={ribbonPosition}
        />
      </div>

      {/* Modals */}
      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
      />
      <ConnectBranchModal
        isOpen={isConnectBranchOpen}
        onClose={() => setIsConnectBranchOpen(false)}
      />
      <ManageSectorsModal
        isOpen={isManageSectorsOpen}
        onClose={() => setIsManageSectorsOpen(false)}
      />
      <SpreadsheetImportModal
        isOpen={isSpreadsheetImportOpen}
        onClose={() => setIsSpreadsheetImportOpen(false)}
      />
    </>
  );
};

export default ActionToolbar;
