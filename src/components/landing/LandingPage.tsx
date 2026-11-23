import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  Search,
  Network,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Building2,
  Edit3,
  Copy,
  Download,
  Trash2,
  Check,
  Upload,
  Sparkles,
  Sun,
  Moon,
  Layers,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { OverviewMacroMap } from './OverviewMacroMap';
import { QualCountLogo } from '../common/QualCountLogo';
import { AboutQualCountModal } from '../common/AboutQualCountModal';
import { computeTopologyMetrics } from '../../engine/metrics';
import { computeWorkbookUtilityReport } from '../../engine/utility';
import { assessWorkbookStructuralRisk } from '../../engine/risk';
import { formatRupeeCompact } from '../../utils/currency';
import { pickAndReadJsonFile, cacheWorkbookFileHandle } from '../../io/nativeFileSave';
import type { RiskSeverity } from '../../types/schema';

export const LandingPage: React.FC = () => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const openWorkbook = useWorkspaceStore((state) => state.openWorkbook);
  const createWorkbook = useWorkspaceStore((state) => state.createWorkbook);
  const updateWorkbook = useWorkspaceStore((state) => state.updateWorkbook);
  const copyWorkbook = useWorkspaceStore((state) => state.copyWorkbook);
  const deleteWorkbook = useWorkspaceStore((state) => state.deleteWorkbook);
  const saveWorkbookToDisk = useWorkspaceStore((state) => state.saveWorkbookToDisk);
  const importWorkbookFile = useWorkspaceStore((state) => state.importWorkbookFile);
  const importWorkspaceFile = useWorkspaceStore((state) => state.importWorkspaceFile);
  const theme = useWorkspaceStore((state) => state.theme);
  const setTheme = useWorkspaceStore((state) => state.setTheme);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMacroMap, setShowMacroMap] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // New Project modal states
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isCreatingScratch, setIsCreatingScratch] = useState(false);
  const [scratchTitle, setScratchTitle] = useState('');
  const [scratchBudget, setScratchBudget] = useState('');

  // Edit & Delete Workbook states
  const [editingWb, setEditingWb] = useState<{
    id: string;
    title: string;
    description: string;
    targetBudgetInr: number;
    status: 'active' | 'draft' | 'archived';
  } | null>(null);

  const [deletingWbId, setDeletingWbId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const isDark = theme === 'dark' || theme === 'night';

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Compute metrics and risk summaries for all workbooks
  const workbookLedger = useMemo(() => {
    if (!workspace) return [];

    return Object.entries(workspace.workbooks).map(([wbId, wb]) => {
      let metrics;
      let utility;
      let risk;

      try {
        metrics = computeTopologyMetrics(workspace, wbId);
      } catch {
        // Fallback
      }

      try {
        utility = computeWorkbookUtilityReport(workspace, wbId);
      } catch {
        // Fallback
      }

      try {
        risk = assessWorkbookStructuralRisk(workspace, wbId);
      } catch {
        // Fallback
      }

      const confirmedCount = metrics ? metrics.directRelationships.confirmedCount : 0;
      const tripleThreadsCount = metrics
        ? metrics.multiThreadTargets.tripleThreadCount + metrics.multiThreadTargets.quadPlusThreadCount
        : 0;
      const fundingPct = metrics ? metrics.funding.securedPct : 0;
      const fundingInr = metrics ? metrics.funding.securedInr : 0;
      const puiScore = utility ? utility.pui : 0;
      const riskTier: RiskSeverity = risk ? risk.aggregateTier : 'low';

      return {
        wbId,
        workbook: wb,
        metrics,
        utility,
        risk,
        confirmedCount,
        tripleThreadsCount,
        fundingPct,
        fundingInr,
        puiScore,
        riskTier,
      };
    });
  }, [workspace]);

  // Real-time search filter across workbooks and entities
  const filteredLedger = useMemo(() => {
    if (!searchQuery.trim()) return workbookLedger;
    const q = searchQuery.toLowerCase().trim();

    return workbookLedger.filter((item) => {
      if (item.workbook.title.toLowerCase().includes(q)) return true;
      if (item.workbook.description?.toLowerCase().includes(q)) return true;

      // Check if any entity in this workbook matches
      if (workspace) {
        const placementsInWb = Object.values(workspace.placements).filter(
          (p) => p.workbookId === item.wbId || (!p.workbookId && item.wbId === workspace.activeWorkbookId)
        );
        for (const plc of placementsInWb) {
          const ent = workspace.entities[plc.entityId];
          if (ent && ent.name.toLowerCase().includes(q)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [workbookLedger, searchQuery, workspace]);

  // Matched individual entities for search suggestion chips
  const matchedEntities = useMemo(() => {
    if (!workspace || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return Object.values(workspace.entities)
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [workspace, searchQuery]);

  // Handle Create Scratch Submit
  const handleCreateScratchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scratchTitle.trim()) return;
    const budget = parseFloat(scratchBudget) || 0;
    await createWorkbook(scratchTitle.trim(), '', budget);
    setIsNewProjectModalOpen(false);
    setIsCreatingScratch(false);
    setScratchTitle('');
    setScratchBudget('');
    showNotification('Created new workbook.');
  };

  // Handle Import JSON from Computer
  const handleImportJson = async () => {
    setIsNewProjectModalOpen(false);
    try {
      const picked = await pickAndReadJsonFile();
      if (!picked) return;
      const parsed = JSON.parse(picked.content);
      if (parsed.workbookId || parsed.placements) {
        await importWorkbookFile(parsed);
        if (picked.handle) {
          const wbId = parsed.workbookId || useWorkspaceStore.getState().activeWorkbookId;
          if (wbId) cacheWorkbookFileHandle(wbId, picked.handle);
        }
        showNotification(`Imported workbook "${parsed.title || picked.name}".`);
      } else {
        await importWorkspaceFile(picked.content);
        showNotification(`Imported project "${picked.name}".`);
      }
    } catch (err: any) {
      showNotification(`Failed to import JSON: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle Edit Workbook Submit
  const handleEditWorkbookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWb || !editingWb.title.trim()) return;
    await updateWorkbook(editingWb.id, {
      title: editingWb.title.trim(),
      description: editingWb.description.trim(),
      targetBudgetInr: editingWb.targetBudgetInr,
      status: editingWb.status,
    });
    setEditingWb(null);
    showNotification('Workbook details updated.');
  };

  const getRiskBadgeStyles = (tier: RiskSeverity) => {
    switch (tier) {
      case 'critical':
        return 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
      case 'elevated':
        return 'bg-[#FFEDD5] text-[#B54708] border-[#FED7AA]';
      case 'moderate':
        return 'bg-[#FEF3C7] text-[#9A5B00] border-[#FDE68A]';
      case 'low':
      default:
        return 'bg-[#E6F4EC] text-[#0F6B38] border-[#C3E4D1]';
    }
  };

  return (
    <div
      className={clsx(
        'w-screen h-screen overflow-y-auto select-none font-sans',
        isDark ? 'bg-[#121417] text-[#F4F2ED]' : 'bg-[#FAF8F4] text-[#1C1B18]'
      )}
    >
      {/* Action Notification Toast */}
      {actionFeedback && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xs shadow-lg font-mono text-xs flex items-center gap-2 bg-[#1C1B18] text-[#FAF8F4] border border-[#B45309] animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Top Banner / Cover */}
      <header
        className={clsx(
          'border-b px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4',
          isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-[#F2EFE9] border-[#DDD6C8]'
        )}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              title="Click to view full QualCount Circular Emblem & Specifications"
            >
              <QualCountLogo size={32} showText={false} className="shadow-xs" />
            </button>
            <h1
              className={clsx(
                'text-xl md:text-2xl font-serif font-bold tracking-tight',
                isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
              )}
            >
              QualCount
            </h1>
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className={clsx(
                'text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs border ml-1 cursor-pointer transition-colors hover:border-[#B45309]',
                isDark
                  ? 'border-[#2D333B] text-[#8A8377] hover:text-[#FAF8F4]'
                  : 'border-[#CFC7B8] text-[#5A554C] bg-[#FAF8F4] hover:text-[#1C1B18]'
              )}
              title="Click to view Version 2.0 specifications"
            >
              Archival Ledger v2.0
            </button>
          </div>
          <p
            className={clsx(
              'text-xs',
              isDark ? 'text-[#8A8377]' : 'text-[#5A554C]'
            )}
          >
            Visual Multiplex Partnership Management System · Standalone Workbooks & Objective Topological Metrics
          </p>
        </div>

        {/* Action Controls & Universal Theme Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Universal Theme Switcher: White Paper vs Charcoal Matte */}
          <div
            className={clsx(
              'flex items-center rounded-xs border p-0.5 text-xs font-mono',
              isDark ? 'bg-[#1E2228] border-[#2D333B]' : 'bg-[#EAE6DF] border-[#DDD6C8]'
            )}
          >
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={clsx(
                'px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer text-xs',
                theme === 'light'
                  ? 'bg-white text-[#1C1B18] shadow-xs font-medium'
                  : isDark
                  ? 'text-[#8A8377] hover:text-[#F4F2ED]'
                  : 'text-[#5A554C] hover:text-[#1C1B18]'
              )}
              title="Switch to White Paper (Light) theme"
            >
              <Sun className="w-3 h-3 text-[#B45309]" />
              <span>White Paper</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={clsx(
                'px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer text-xs',
                theme !== 'light'
                  ? 'bg-[#1C1B18] text-[#FAF8F4] shadow-xs font-medium'
                  : isDark
                  ? 'text-[#8A8377] hover:text-[#F4F2ED]'
                  : 'text-[#5A554C] hover:text-[#1C1B18]'
              )}
              title="Switch to Charcoal Matte (Dark) theme"
            >
              <Moon className="w-3 h-3 text-sky-400" />
              <span>Charcoal Matte</span>
            </button>
          </div>

          {/* New Project (or New Workbook) Button */}
          <button
            onClick={() => {
              setIsCreatingScratch(false);
              setScratchTitle('');
              setScratchBudget('');
              setIsNewProjectModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[#B45309] text-white text-xs font-medium hover:bg-[#92400E] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </header>

      {/* Main Ledger Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Search & Overview Map Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8A8377]" />
            <input
              type="text"
              placeholder="Filter workbooks, partners, or government departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'w-full pl-9 pr-4 py-2 text-xs rounded-xs border transition-colors outline-none font-sans',
                isDark
                  ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] placeholder-[#8A8377] focus:border-[#B45309]'
                  : 'bg-white border-[#DDD6C8] text-[#1C1B18] placeholder-[#8A8377] focus:border-[#B45309]'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={clsx(
                  'absolute right-2.5 top-2.5 text-xs transition-colors',
                  isDark ? 'text-[#8A8377] hover:text-[#F4F2ED]' : 'text-[#8A8377] hover:text-[#1C1B18]'
                )}
              >
                ✕
              </button>
            )}
          </div>

          {/* Overview Map Toggle Button */}
          <button
            onClick={() => setShowMacroMap(!showMacroMap)}
            className={clsx(
              'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xs border text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer',
              showMacroMap
                ? 'bg-[#B45309] text-white border-[#92400E]'
                : isDark
                ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] hover:bg-[#252A32]'
                : 'bg-white border-[#DDD6C8] text-[#1C1B18] hover:bg-[#F9F7F4]'
            )}
          >
            <Network className="w-4 h-4" />
            <span>{showMacroMap ? 'Hide Overview Map' : 'Ecosystem Macro-Map'}</span>
          </button>
        </div>

        {/* Matching Entity Tags (when searching) */}
        {matchedEntities.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-mono text-[#8A8377]">Matching Partners:</span>
            {matchedEntities.map((ent) => (
              <span
                key={ent.entityId}
                className={clsx(
                  'px-2 py-0.5 rounded-xs text-[11px] font-mono border flex items-center gap-1',
                  isDark
                    ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]'
                    : 'bg-[#EDE8DE] border-[#5A554C] text-[#1C1B18]'
                )}
              >
                <Building2 className="w-3 h-3 text-[#B45309]" />
                {ent.name}
              </span>
            ))}
          </div>
        )}

        {/* Interactive 2D Macro Map */}
        {showMacroMap && (
          <div className="animate-fadeIn">
            <OverviewMacroMap onClose={() => setShowMacroMap(false)} />
          </div>
        )}

        {/* Standalone Workbooks Section */}
        <section
          className={clsx(
            'rounded-sm border overflow-hidden shadow-xs',
            isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
          )}
        >
          {/* Header */}
          <div
            className={clsx(
              'px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4',
              isDark ? 'bg-[#15181D] border-[#2D333B]' : 'bg-[#FAF8F4] border-[#DDD6C8]'
            )}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-[#B45309]" />
              <div>
                <h2
                  className={clsx(
                    'text-sm font-semibold font-serif',
                    isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                  )}
                >
                  Partnership Workbooks
                </h2>
                <p className="text-[11px] font-mono text-[#8A8377] mt-0.5">
                  Standalone Multiplex Ledgers · {filteredLedger.length} active files
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportJson}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xs border text-xs font-mono font-medium transition-colors cursor-pointer',
                  isDark
                    ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] hover:bg-[#252A32]'
                    : 'bg-white border-[#DDD6C8] text-[#1C1B18] hover:bg-[#F2EFE9]'
                )}
                title="Import JSON from computer"
              >
                <Upload className="w-3.5 h-3.5 text-[#0F6B38]" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>

          {/* Table of Contents / Workbook Ledger Rows */}
          <div
            className={clsx(
              'divide-y',
              isDark ? 'divide-[#2D333B]' : 'divide-[#DDD6C8]'
            )}
          >
            {Object.keys(workspace?.workbooks || {}).length === 0 ? (
              <div className="px-6 py-12 text-center flex flex-col items-center justify-center gap-3">
                <Building2 className="w-8 h-8 text-[#8A8377]/60" />
                <div className={clsx('text-sm font-serif font-bold', isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]')}>
                  No Workbooks Available
                </div>
                <p className="text-xs text-[#8A8377] max-w-sm text-center leading-relaxed">
                  Start fresh with a new project or import an existing partnership workbook JSON file from your computer.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingScratch(false);
                    setScratchTitle('');
                    setScratchBudget('');
                    setIsNewProjectModalOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[#B45309] text-white text-xs font-medium hover:bg-[#92400E] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs text-[#8A8377] font-mono">
                No workbooks matched the search criteria.
              </div>
            ) : (
              filteredLedger.map((row) => (
                <div
                  key={row.wbId}
                  className={clsx(
                    'px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors group',
                    isDark ? 'hover:bg-[#1E2228]' : 'hover:bg-[#FAF8F4]'
                  )}
                >
                  {/* Left: Title & Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={clsx(
                          'font-serif font-semibold text-sm truncate',
                          isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                        )}
                      >
                        {row.workbook.title}
                      </span>
                      <span
                        className={clsx(
                          'text-[9px] uppercase font-mono px-1.5 py-0.2 rounded-xs border',
                          row.workbook.status === 'active'
                            ? 'bg-[#E6F4EC] text-[#0F6B38] border-[#C3E4D1]'
                            : 'bg-[#F2EFE9] text-[#8A8377] border-[#DDD6C8]'
                        )}
                      >
                        {row.workbook.status}
                      </span>
                    </div>
                    <p
                      className={clsx(
                        'text-xs line-clamp-1 mb-1',
                        isDark ? 'text-[#8A8377]' : 'text-[#5A554C]'
                      )}
                    >
                      {row.workbook.description || 'Institutional partnership multiplex ledger'}
                    </p>
                    <div className="text-[10px] font-mono text-[#8A8377]">
                      Updated: {new Date(row.workbook.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Middle: Tabular Quantitative KPIs */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap font-mono text-xs">
                    {/* Funding M% */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#8A8377] uppercase">Funding M%</span>
                      <span className="font-semibold text-[#0F6B38]">
                        {row.fundingPct.toFixed(1)}% ({formatRupeeCompact(row.fundingInr)})
                      </span>
                    </div>

                    {/* PUI */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#8A8377] uppercase">PUI (0-100)</span>
                      <div className="flex items-center gap-1 font-semibold text-[#B45309]">
                        <TrendingUp className="w-3 h-3" />
                        <span>{row.puiScore.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Confirmed Ties */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#8A8377] uppercase">Confirmed</span>
                      <span
                        className={clsx(
                          'font-semibold',
                          isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                        )}
                      >
                        {row.confirmedCount}
                      </span>
                    </div>

                    {/* Triple Threads */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#8A8377] uppercase">Triple+</span>
                      <span
                        className={clsx(
                          'font-semibold',
                          isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                        )}
                      >
                        {row.tripleThreadsCount}
                      </span>
                    </div>

                    {/* Structural Risk Chip */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#8A8377] uppercase">Risk Tier</span>
                      <span
                        className={clsx(
                          'text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs border font-medium flex items-center gap-1',
                          getRiskBadgeStyles(row.riskTier)
                        )}
                      >
                        {row.riskTier === 'critical' && <AlertTriangle className="w-3 h-3" />}
                        {row.riskTier}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions (Edit, Copy, Save to Disk, Delete, Open Canvas) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Edit Workbook */}
                    <button
                      onClick={() =>
                        setEditingWb({
                          id: row.wbId,
                          title: row.workbook.title,
                          description: row.workbook.description || '',
                          targetBudgetInr: row.workbook.targetBudgetInr || 0,
                          status: row.workbook.status || 'active',
                        })
                      }
                      title="Edit Workbook Details"
                      className={clsx(
                        'p-1.5 rounded-xs border text-xs transition-colors cursor-pointer',
                        isDark
                          ? 'bg-[#181B20] border-[#2D333B] text-[#8A8377] hover:text-[#F4F2ED]'
                          : 'bg-white border-[#DDD6C8] text-[#5A554C] hover:text-[#1C1B18]'
                      )}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate Workbook */}
                    <button
                      onClick={async () => {
                        const newId = await copyWorkbook(row.wbId);
                        if (newId) showNotification('Workbook duplicated.');
                      }}
                      title="Duplicate Workbook"
                      className={clsx(
                        'p-1.5 rounded-xs border text-xs transition-colors cursor-pointer',
                        isDark
                          ? 'bg-[#181B20] border-[#2D333B] text-[#8A8377] hover:text-[#F4F2ED]'
                          : 'bg-white border-[#DDD6C8] text-[#5A554C] hover:text-[#1C1B18]'
                      )}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Save to PC (Native File Picker) */}
                    <button
                      onClick={async () => {
                        await saveWorkbookToDisk(row.wbId, true);
                        showNotification(`Saved "${row.workbook.title}" to local disk.`);
                      }}
                      title="Save Workbook directly to your PC as JSON"
                      className={clsx(
                        'p-1.5 rounded-xs border text-xs transition-colors cursor-pointer',
                        isDark
                          ? 'bg-[#181B20] border-[#2D333B] text-[#0F6B38] hover:bg-[#1C2520]'
                          : 'bg-white border-[#DDD6C8] text-[#0F6B38] hover:bg-[#E6F4EC]'
                      )}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Workbook */}
                    <button
                      onClick={() => setDeletingWbId(row.wbId)}
                      title="Delete Workbook"
                      className={clsx(
                        'p-1.5 rounded-xs border text-xs transition-colors text-[#991B1B] cursor-pointer',
                        isDark
                          ? 'bg-[#181B20] border-[#2D333B] hover:bg-[#2D1B1B]'
                          : 'bg-white border-[#DDD6C8] hover:bg-[#FEE2E2]'
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Open Action Button */}
                    <button
                      onClick={() => openWorkbook(row.wbId)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium hover:bg-[#2F2D29] transition-all group-hover:translate-x-0.5 ml-1 cursor-pointer"
                    >
                      <span>Open Canvas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Modal: New Project (Choose Scratch vs Import) */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className={clsx(
              'w-full max-w-lg rounded-sm border p-6 shadow-xl transition-all',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            {!isCreatingScratch ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className={clsx(
                      'text-base font-serif font-bold',
                      isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                    )}
                  >
                    New Partnership Project
                  </h3>
                  <button
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="text-xs text-[#8A8377] hover:text-[#1C1B18] dark:hover:text-[#F4F2ED] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-[#8A8377] mb-5">
                  Initialize a standalone multiplex partnership workbook. Choose an option below:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* Option A: Create from scratch */}
                  <button
                    type="button"
                    onClick={() => setIsCreatingScratch(true)}
                    className={clsx(
                      'p-4 rounded-xs border text-left flex flex-col justify-between gap-3 group transition-all cursor-pointer',
                      isDark
                        ? 'bg-[#1E2228] border-[#2D333B] hover:border-[#B45309] hover:bg-[#252A32]'
                        : 'bg-[#FAF8F4] border-[#DDD6C8] hover:border-[#B45309] hover:bg-white'
                    )}
                  >
                    <div>
                      <div className="w-8 h-8 rounded-xs bg-[#B45309]/10 text-[#B45309] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className={clsx('text-xs font-serif font-bold mb-1', isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]')}>
                        Create from Scratch
                      </h4>
                      <p className="text-[11px] text-[#8A8377] leading-relaxed">
                        Start with a clean blank canvas. Specify your project title and optional budget.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#B45309] font-medium flex items-center gap-1">
                      Start fresh <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>

                  {/* Option B: Import existing JSON file */}
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className={clsx(
                      'p-4 rounded-xs border text-left flex flex-col justify-between gap-3 group transition-all cursor-pointer',
                      isDark
                        ? 'bg-[#1E2228] border-[#2D333B] hover:border-[#0F6B38] hover:bg-[#252A32]'
                        : 'bg-[#FAF8F4] border-[#DDD6C8] hover:border-[#0F6B38] hover:bg-white'
                    )}
                  >
                    <div>
                      <div className="w-8 h-8 rounded-xs bg-[#0F6B38]/10 text-[#0F6B38] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <h4 className={clsx('text-xs font-serif font-bold mb-1', isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]')}>
                        Import Existing JSON
                      </h4>
                      <p className="text-[11px] text-[#8A8377] leading-relaxed">
                        Import an existing standalone workbook (.json) or workspace file from your computer.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#0F6B38] font-medium flex items-center gap-1">
                      Browse PC <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className={clsx(
                      'px-3 py-1.5 rounded-xs text-xs font-mono transition-colors cursor-pointer',
                      isDark ? 'text-[#8A8377] hover:text-[#F4F2ED]' : 'text-[#5A554C] hover:text-[#1C1B18]'
                    )}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Create Scratch Form */
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3
                    className={clsx(
                      'text-base font-serif font-bold',
                      isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                    )}
                  >
                    Create Workbook from Scratch
                  </h3>
                  <button
                    onClick={() => setIsCreatingScratch(false)}
                    className="text-xs text-[#8A8377] hover:text-[#1C1B18] dark:hover:text-[#F4F2ED] cursor-pointer"
                  >
                    Back
                  </button>
                </div>
                <p className="text-xs text-[#8A8377] mb-4">
                  Initialize a blank partnership graph without any pre-generated nodes.
                </p>

                <form onSubmit={handleCreateScratchSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[#8A8377] mb-1">
                      Workbook Title *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Mumbai Urban Sanitation Coalition"
                      value={scratchTitle}
                      onChange={(e) => setScratchTitle(e.target.value)}
                      className={clsx(
                        'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-sans',
                        isDark
                          ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] focus:border-[#B45309]'
                          : 'bg-transparent border-[#DDD6C8] text-[#1C1B18] focus:border-[#B45309]'
                      )}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-mono text-[#8A8377]">
                        Initial Target Budget (INR)
                      </label>
                      <span className="text-[10px] font-mono text-[#8A8377]">
                        Optional · Can edit anytime
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      placeholder="e.g. 15000000 (₹1.50 Cr) or leave blank"
                      value={scratchBudget}
                      onChange={(e) => setScratchBudget(e.target.value)}
                      className={clsx(
                        'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-mono',
                        isDark
                          ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] focus:border-[#B45309]'
                          : 'bg-transparent border-[#DDD6C8] text-[#1C1B18] focus:border-[#B45309]'
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#DDD6C8]/60 dark:border-[#2D333B]">
                    <button
                      type="button"
                      onClick={() => setIsCreatingScratch(false)}
                      className={clsx(
                        'px-3 py-1.5 rounded-xs text-xs font-mono transition-colors cursor-pointer',
                        isDark ? 'text-[#8A8377] hover:text-[#F4F2ED]' : 'text-[#5A554C] hover:text-[#1C1B18]'
                      )}
                    >
                      Back
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!scratchTitle.trim()) return;
                          await createWorkbook(scratchTitle.trim(), '', 0);
                          setIsNewProjectModalOpen(false);
                          setIsCreatingScratch(false);
                          setScratchTitle('');
                          setScratchBudget('');
                          showNotification('Created workbook with no initial budget.');
                        }}
                        className={clsx(
                          'px-3 py-1.5 rounded-xs border text-xs font-mono transition-colors cursor-pointer',
                          isDark
                            ? 'border-[#2D333B] text-[#8A8377] hover:text-[#F4F2ED] hover:bg-[#252A32]'
                            : 'border-[#DDD6C8] text-[#5A554C] hover:text-[#1C1B18] hover:bg-[#F2EFE9]'
                        )}
                        title="Create workbook now and set budget later"
                      >
                        Skip Budget
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xs bg-[#1C1B18] dark:bg-[#FAF8F4] text-[#FAF8F4] dark:text-[#1C1B18] text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                      >
                        Create & Open
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit Workbook */}
      {editingWb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className={clsx(
              'w-full max-w-md rounded-sm border p-6 shadow-xl',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            <h3
              className={clsx(
                'text-base font-serif font-bold mb-1',
                isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
              )}
            >
              Edit Workbook
            </h3>
            <p className="text-xs text-[#8A8377] mb-4">
              Update workbook parameters, target budget, and status.
            </p>
            <form onSubmit={handleEditWorkbookSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-mono text-[#8A8377] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editingWb.title}
                  onChange={(e) => setEditingWb({ ...editingWb, title: e.target.value })}
                  className={clsx(
                    'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-sans',
                    isDark
                      ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] focus:border-[#B45309]'
                      : 'bg-transparent border-[#DDD6C8] text-[#1C1B18] focus:border-[#B45309]'
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8A8377] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingWb.description}
                  onChange={(e) => setEditingWb({ ...editingWb, description: e.target.value })}
                  className={clsx(
                    'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-sans',
                    isDark
                      ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] focus:border-[#B45309]'
                      : 'bg-transparent border-[#DDD6C8] text-[#1C1B18] focus:border-[#B45309]'
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8A8377] mb-1">
                  Target Budget (INR)
                </label>
                <input
                  type="number"
                  value={editingWb.targetBudgetInr}
                  onChange={(e) =>
                    setEditingWb({
                      ...editingWb,
                      targetBudgetInr: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={clsx(
                    'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-mono',
                    isDark
                      ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED] focus:border-[#B45309]'
                      : 'bg-transparent border-[#DDD6C8] text-[#1C1B18] focus:border-[#B45309]'
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8A8377] mb-1">
                  Status
                </label>
                <select
                  value={editingWb.status}
                  onChange={(e) =>
                    setEditingWb({
                      ...editingWb,
                      status: e.target.value as 'active' | 'draft' | 'archived',
                    })
                  }
                  className={clsx(
                    'w-full px-3 py-1.5 text-xs rounded-xs border outline-none font-sans',
                    isDark
                      ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED]'
                      : 'bg-white border-[#DDD6C8] text-[#1C1B18]'
                  )}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[#DDD6C8]/60">
                <button
                  type="button"
                  onClick={() => setEditingWb(null)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xs text-xs transition-colors cursor-pointer',
                    isDark ? 'text-[#8A8377] hover:text-[#F4F2ED]' : 'text-[#5A554C] hover:text-[#1C1B18]'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xs bg-[#1C1B18] text-[#FAF8F4] text-xs font-medium hover:bg-[#2F2D29] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Workbook */}
      {deletingWbId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className={clsx(
              'w-full max-w-md rounded-sm border p-6 shadow-xl',
              isDark ? 'bg-[#181B20] border-[#2D333B]' : 'bg-white border-[#DDD6C8]'
            )}
          >
            <div className="flex items-center gap-2 text-[#991B1B] mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-serif font-bold">Delete Workbook</h3>
            </div>
            <p className="text-xs text-[#8A8377] mb-4 leading-relaxed">
              Are you sure you want to delete this workbook? All of its placement cards and relationship branches will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDD6C8]/60">
              <button
                type="button"
                onClick={() => setDeletingWbId(null)}
                className={clsx(
                  'px-3 py-1.5 rounded-xs text-xs transition-colors cursor-pointer',
                  isDark ? 'text-[#8A8377] hover:text-[#F4F2ED]' : 'text-[#5A554C] hover:text-[#1C1B18]'
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const deleted = await deleteWorkbook(deletingWbId);
                  setDeletingWbId(null);
                  if (deleted) showNotification('Workbook deleted.');
                }}
                className="px-4 py-1.5 rounded-xs bg-[#991B1B] text-white text-xs font-medium hover:bg-[#7F1D1D] cursor-pointer"
              >
                Yes, Delete Workbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master About QualCount Modal */}
      <AboutQualCountModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
};
