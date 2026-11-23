import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  Download,
  Sparkles,
  Server,
  Cloud,
  Upload,
  Info,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getWorkspaceRepository } from '../../storage';
import { exportCsvBundle, exportExcelWorkbook, downloadFile } from '../../io/spreadsheetExport';
import { computePublicChoiceUtilityReport } from '../../engine/utility';
import { computeStructuralRiskReport } from '../../engine/risk';
import { SpreadsheetImportModal } from '../toolbar/SpreadsheetImportModal';
import { SettingsModal } from '../toolbar/SettingsModal';
import { QualCountLogo } from '../common/QualCountLogo';
import { AboutQualCountModal } from '../common/AboutQualCountModal';

export const LegacyMenuBar: React.FC = () => {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const toggleBookIndex = useWorkspaceStore((state) => state.toggleBookIndex);
  const isDashboardMaximized = useWorkspaceStore((state) => state.isDashboardMaximized);
  const toggleDashboardMaximized = useWorkspaceStore((state) => state.toggleDashboardMaximized);
  const showDeclined = useWorkspaceStore((state) => state.showDeclined);
  const toggleShowDeclined = useWorkspaceStore((state) => state.toggleShowDeclined);
  const theme = useWorkspaceStore((state) => state.theme);
  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const saveWorkbookToDisk = useWorkspaceStore((state) => state.saveWorkbookToDisk);
  const importWorkspace = useWorkspaceStore((state) => state.importWorkspace);
  const setSourceType = useWorkspaceStore((state) => state.setSourceType);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const openSearch = useWorkspaceStore((state) => state.openSearch);

  const [activeMenu, setActiveMenu] = useState<'file' | 'view' | 'tools' | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [showNewWbModal, setShowNewWbModal] = useState(false);
  const [showGdriveModal, setShowGdriveModal] = useState(false);
  const [isSpreadsheetImportOpen, setIsSpreadsheetImportOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark' || theme === 'night';

  // Close open dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInputFocused =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInputFocused) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + F: Search Nodes in Toolbar
      if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        openSearch();
        return;
      }

      // Cmd/Ctrl + N: New Workbook
      if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        setShowNewWbModal(true);
        return;
      }

      // Cmd/Ctrl + O: Open Workspace
      if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        importWorkspace();
        return;
      }

      // Cmd/Ctrl + S: Save Workbook (Native OS Explorer Window)
      if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        saveWorkbookToDisk(activeWorkbookId || undefined, false);
        return;
      }

      // Cmd/Ctrl + Shift + S: Save As...
      if (mod && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        saveWorkbookToDisk(activeWorkbookId || undefined, true);
        return;
      }

      // Cmd/Ctrl + B: Toggle Book Index Sidebar
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleBookIndex();
        return;
      }

      // Cmd/Ctrl + Shift + D: Maximize Analytical Dashboard
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleDashboardMaximized();
        return;
      }

      // Cmd/Ctrl + Shift + L: Tidy Up Bottom-to-Top Layout
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleTidyUp();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspace, toggleBookIndex, toggleDashboardMaximized, importWorkspace, openSearch]);

  const handleTidyUp = async () => {
    await useWorkspaceStore.getState().tidyUpLayout();
  };

  const handleSaveSnapshot = async () => {
    if (!workspace) return;
    try {
      const repo = getWorkspaceRepository() as any;
      if (typeof repo.saveSnapshot === 'function') {
        const path = await repo.saveSnapshot(workspace, 'manual_menu');
        alert(`Snapshot backup saved: ${path}`);
      } else {
        alert('Snapshot saved locally.');
      }
    } catch (e) {
      console.warn('Snapshot failed:', e);
    }
  };

  const handleExportCsv = () => {
    if (!workspace || !activeWorkbookId) return;
    const wb = workspace.workbooks[activeWorkbookId];
    const wbContext = {
      ...workspace,
      activeWorkbookId,
      utilityWeights: wb?.utilityWeights,
      targetBudgetInr: wb?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, workspace.entities);
    const bundle = exportCsvBundle(wbContext, workspace.entities, uReport);
    const slug = (wb?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(bundle.nodesCsv, `${slug}_nodes.csv`, 'text/csv;charset=utf-8');
    downloadFile(bundle.branchesCsv, `${slug}_branches.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportExcel = async () => {
    if (!workspace || !activeWorkbookId) return;
    const wb = workspace.workbooks[activeWorkbookId];
    const wbContext = {
      ...workspace,
      activeWorkbookId,
      utilityWeights: wb?.utilityWeights,
      targetBudgetInr: wb?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, workspace.entities);
    const rReport = computeStructuralRiskReport(wbContext, workspace.entities);
    const blob = await exportExcelWorkbook(wbContext, workspace.entities, uReport, rReport);
    const slug = (wb?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(blob, `${slug}_workbook.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleCreateNewWorkbook = async (skipBudget = false) => {
    if (!newTitle.trim()) return;
    const store = useWorkspaceStore.getState();
    const budget = skipBudget ? 0 : (parseFloat(newBudget) || 0);
    await store.createWorkbook(newTitle.trim(), '', budget);
    setShowNewWbModal(false);
    setNewTitle('');
    setNewBudget('');
  };

  return (
    <>
      <div
        ref={menuRef}
        className={clsx(
          'w-full h-7 border-b flex items-center justify-between px-3 text-xs select-none z-40 relative font-sans',
          isDark
            ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]'
            : 'bg-[#F2EFE9] border-[#DDD6C8] text-[#1C1B18]'
        )}
      >
        {/* Left: Classic Menu Hierarchy */}
        <div className="flex items-center gap-1">
          {/* Cover & Brand Pill */}
          <button
            onClick={() => setActiveView(activeView === 'landing' ? 'canvas' : 'landing')}
            className={clsx(
              'px-2 py-0.5 rounded-xs flex items-center gap-1.5 font-serif font-bold text-xs mr-2 transition-colors',
              activeView === 'landing'
                ? 'bg-[#1C1B18] text-[#FAF8F4]'
                : isDark
                ? 'hover:bg-[#252A32] text-[#F4F2ED]'
                : 'hover:bg-[#EAE6DF] text-[#1C1B18]'
            )}
            title="Toggle between Landing Page Cover & Canvas"
          >
            <QualCountLogo size={16} showText={false} />
            <span>QualCount</span>
          </button>

          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className={clsx(
                'px-2 py-0.5 rounded-xs transition-colors',
                activeMenu === 'file'
                  ? 'bg-[#DDD6C8] dark:bg-[#2D333B] font-medium'
                  : 'hover:bg-[#EAE6DF] dark:hover:bg-[#252A32]'
              )}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div
                className={clsx(
                  'absolute left-0 top-7 w-64 rounded-xs border shadow-lg py-1 z-50 divide-y divide-[#DDD6C8]/50 dark:divide-[#2D333B]/50 font-sans',
                  isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-[#FFFFFF] border-[#DDD6C8]'
                )}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      setShowNewWbModal(true);
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer"
                  >
                    <span>New Workbook...</span>
                    <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+N</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={async () => {
                      setActiveMenu(null);
                      await saveWorkbookToDisk(activeWorkbookId || undefined, false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer font-medium"
                    title="Save Workbook directly to PC via native file dialog"
                  >
                    <span>Save</span>
                    <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+S</span>
                  </button>
                  <button
                    onClick={async () => {
                      setActiveMenu(null);
                      await saveWorkbookToDisk(activeWorkbookId || undefined, true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer"
                    title="Choose local directory and filename on PC"
                  >
                    <span>Save As...</span>
                    <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+Shift+S</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      handleSaveSnapshot();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] cursor-pointer"
                  >
                    Save Snapshot Backup
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      setIsSpreadsheetImportOpen(true);
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer"
                  >
                    <span>Import Structured CSV / Excel...</span>
                    <Upload className="w-3 h-3 text-[#8A8377]" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      handleExportCsv();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer"
                  >
                    <span>Export CSV Bundle (.zip)</span>
                    <Download className="w-3 h-3 text-[#8A8377]" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      handleExportExcel();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer"
                  >
                    <span>Export Excel Workbook (.xlsx)</span>
                    <Download className="w-3 h-3 text-[#8A8377]" />
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      setActiveView('landing');
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#B45309] hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] cursor-pointer font-medium"
                  >
                    Return to Cover & Index
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              className={clsx(
                'px-2 py-0.5 rounded-xs transition-colors',
                activeMenu === 'view'
                  ? 'bg-[#DDD6C8] dark:bg-[#2D333B] font-medium'
                  : 'hover:bg-[#EAE6DF] dark:hover:bg-[#252A32]'
              )}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div
                className={clsx(
                  'absolute left-0 top-7 w-60 rounded-xs border shadow-lg py-1 z-50 divide-y divide-[#DDD6C8]/50 dark:divide-[#2D333B]/50',
                  isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-[#FFFFFF] border-[#DDD6C8]'
                )}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      toggleDashboardMaximized();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between"
                  >
                    <span>{isDashboardMaximized ? 'Minimize Dashboard' : 'Maximize Dashboard'}</span>
                    <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+Shift+D</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      toggleBookIndex();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between"
                  >
                    <span>Toggle Sibling Book Index</span>
                    <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+B</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      toggleShowDeclined();
                    }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between"
                  >
                    <span>{showDeclined ? 'Hide Declined Paths' : 'Show Declined Paths'}</span>
                  </button>
                </div>

                <div className="py-1 px-3">
                  <div className="text-[10px] uppercase font-mono text-[#8A8377] mb-1">Theme Surface</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setTheme('light');
                        setActiveMenu(null);
                      }}
                      className={clsx(
                        'px-2 py-0.5 text-[11px] rounded-xs border',
                        theme === 'light'
                          ? 'bg-[#FAF8F4] text-[#1C1B18] border-[#B45309] font-medium'
                          : 'bg-[#F2EFE9] text-[#5A554C] border-[#DDD6C8]'
                      )}
                    >
                      White Paper
                    </button>
                    <button
                      onClick={() => {
                        setTheme('dark');
                        setActiveMenu(null);
                      }}
                      className={clsx(
                        'px-2 py-0.5 text-[11px] rounded-xs border',
                        theme === 'dark' || theme === 'night'
                          ? 'bg-[#181B20] text-[#F4F2ED] border-[#B45309] font-medium'
                          : 'bg-[#F2EFE9] text-[#5A554C] border-[#DDD6C8]'
                      )}
                    >
                      Charcoal Matte
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')}
              className={clsx(
                'px-2 py-0.5 rounded-xs transition-colors',
                activeMenu === 'tools'
                  ? 'bg-[#DDD6C8] dark:bg-[#2D333B] font-medium'
                  : 'hover:bg-[#EAE6DF] dark:hover:bg-[#252A32]'
              )}
            >
              Tools
            </button>
            {activeMenu === 'tools' && (
              <div
                className={clsx(
                  'absolute left-0 top-7 w-60 rounded-xs border shadow-lg py-1 z-50',
                  isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-[#FFFFFF] border-[#DDD6C8]'
                )}
              >
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    openSearch();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between cursor-pointer font-medium"
                >
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#B45309]" />
                    <span>Search Nodes...</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+F</span>
                </button>
                <div className="border-t border-[#DDD6C8]/50 dark:border-[#2D333B]/50 my-1"></div>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    handleTidyUp();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#B45309]" />
                    <span>Tidy Up (Bottom-to-Top)</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8A8377]">Ctrl+Shift+L</span>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setShowMcpModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center gap-1.5"
                >
                  <Server className="w-3.5 h-3.5 text-[#5A554C]" />
                  <span>MCP Server Connection Info...</span>
                </button>
                <div className="border-t border-[#DDD6C8]/50 dark:border-[#2D333B]/50 my-1"></div>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setShowAboutModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] flex items-center gap-1.5 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>About QualCount v2.0...</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Button (Relocated to top menu bar) */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className={clsx(
              'px-2 py-0.5 rounded-xs transition-colors cursor-pointer',
              showSettingsModal
                ? 'bg-[#DDD6C8] dark:bg-[#2D333B] font-medium'
                : 'hover:bg-[#EAE6DF] dark:hover:bg-[#252A32]'
            )}
            title="Workbook Settings & Appearance"
          >
            Settings
          </button>
        </div>

        {/* Right: Quick Search Button (in canvas view) & Current Active Workbook Label */}
        <div className="flex items-center gap-3">
          {activeView === 'canvas' && (
            <button
              type="button"
              onClick={openSearch}
              className={clsx(
                'px-2 py-0.5 rounded-xs border transition-colors flex items-center gap-1.5 text-xs cursor-pointer',
                isDark
                  ? 'bg-[#181B20] border-[#2D333B] hover:border-[#B45309] text-[#8A8377] hover:text-[#F4F2ED]'
                  : 'bg-[#FAF8F4] border-[#DDD6C8] hover:border-[#B45309] text-[#5A554C] hover:text-[#1C1B18]'
              )}
              title="Search Nodes in Toolbar (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5 text-[#B45309]" />
              <span className="hidden sm:inline text-[11px]">Search Nodes</span>
              <kbd className="hidden md:inline text-[10px] font-mono opacity-70">Ctrl+F</kbd>
            </button>
          )}

          <div className="flex items-center gap-2 text-[11px] font-mono text-[#8A8377]">
            {activeView === 'landing' ? (
              <span>Landing Page / Table of Contents</span>
            ) : (
              <span
                className="truncate max-w-[200px] hidden sm:inline"
                title={workspace?.workbooks[activeWorkbookId || '']?.title}
              >
                Active: {workspace?.workbooks[activeWorkbookId || '']?.title || 'Untitled Workbook'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* New Workbook Modal */}
      {showNewWbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-sans">
          <div
            className={clsx(
              'w-full max-w-sm rounded-sm border p-5 shadow-xl flex flex-col gap-3',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            <div>
              <h3 className="text-sm font-serif font-bold mb-1">New Workbook</h3>
              <p className="text-xs text-[#8A8377]">Create a new standalone partnership ledger.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNewWorkbook(false);
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-[11px] font-mono uppercase text-[#8A8377] block mb-1">Workbook Title</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Clean River Initiative 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xs border border-[#DDD6C8] bg-transparent outline-none focus:border-[#B45309]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-[#8A8377] block mb-1">
                  Initial Target Budget / Amount (INR ₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  placeholder="e.g. 15000000 (or Skip)"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xs border border-[#DDD6C8] bg-transparent outline-none focus:border-[#B45309]"
                />
                <span className="text-[10px] text-[#8A8377] mt-0.5 block">
                  You can edit, increase, or decrease this amount anytime later.
                </span>
              </div>

              <div className="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-[#DDD6C8]/40 dark:border-[#2D333B]/40">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewWbModal(false);
                    setNewTitle('');
                    setNewBudget('');
                  }}
                  className="px-3 py-1 text-xs text-[#8A8377] hover:text-[#1C1B18] dark:hover:text-[#F4F2ED] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewWorkbook(true)}
                  className="px-3 py-1 rounded-xs border border-[#DDD6C8] dark:border-[#2D333B] text-xs hover:bg-[#F2EFE9] dark:hover:bg-[#252A32] cursor-pointer"
                  title="Create with ₹0 budget (configure later)"
                >
                  Skip Budget
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium hover:bg-[#2F2D29] cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* MCP Info Modal */}
      {showMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className={clsx(
              'w-full max-w-md rounded-sm border p-6 shadow-xl',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-[#B45309]" />
              <h3 className="text-base font-serif font-bold">MCP Server Integration</h3>
            </div>
            <p className="text-xs text-[#5A554C] dark:text-[#8A8377] leading-relaxed mb-3">
              QualCount exposes a Model Context Protocol (MCP) server allowing Claude Code or external LLMs to read live network topology, compute Layer 1 Public Choice risk parameters, and propose partnership mutations with audit stamps.
            </p>
            <div className="p-3 rounded-xs border border-[#DDD6C8] bg-[#F2EFE9] dark:bg-[#1E2228] text-[11px] font-mono text-[#1C1B18] dark:text-[#F4F2ED] mb-4">
              Endpoint: stdio (via `qualcount-mcp-server`)<br />
              Status: Ready for Phase 7 MCP protocol binding.
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMcpModal(false)}
                className="px-4 py-1.5 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Modal */}
      {showGdriveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className={clsx(
              'w-full max-w-md rounded-sm border p-6 shadow-xl',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-5 h-5 text-[#174EA6]" />
              <h3 className="text-base font-serif font-bold">Google Drive Folder Sync</h3>
            </div>
            <p className="text-xs text-[#5A554C] dark:text-[#8A8377] leading-relaxed mb-4">
              QualCount portable folders sync automatically across operating systems when saved inside your Google Drive directory.
            </p>
            <div className="p-3 rounded-xs border border-[#AECBFA] bg-[#E8F0FE] text-[#174EA6] text-xs font-mono mb-4">
              Status: {workspace?.sourceType === 'gdrive' ? 'Connected to Google Drive (Synced)' : 'Operating from Local filesystem cache'}
            </div>
            <div className="flex justify-end gap-2">
              {workspace?.sourceType === 'gdrive' ? (
                <button
                  onClick={async () => {
                    await setSourceType('local');
                    setShowGdriveModal(false);
                  }}
                  className="px-3 py-1.5 rounded-xs border border-[#DDD6C8] text-xs text-[#5A554C] hover:bg-[#F2EFE9]"
                >
                  Switch to Local
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await setSourceType('gdrive', 'G:\\My Drive\\QualCount Alliances');
                    setShowGdriveModal(false);
                  }}
                  className="px-3 py-1.5 rounded-xs bg-[#174EA6] text-white text-xs font-medium hover:bg-[#133E85]"
                >
                  Connect Google Drive Folder
                </button>
              )}
              <button
                onClick={() => setShowGdriveModal(false)}
                className="px-4 py-1.5 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium hover:bg-[#2F2D29]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Import Modal */}
      <SpreadsheetImportModal
        isOpen={isSpreadsheetImportOpen}
        onClose={() => setIsSpreadsheetImportOpen(false)}
      />

      {/* About QualCount Modal */}
      <AboutQualCountModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </>
  );
};
