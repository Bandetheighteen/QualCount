import React, { useEffect, useState } from 'react';
import { X, HardDrive, Download, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { FinancialLedgerSection } from './FinancialLedgerSection';
import { UtilityLedgerSection } from './UtilityLedgerSection';
import { RiskAssessmentBox } from './RiskAssessmentBox';
import { NodeBranchLedgerSection } from './NodeBranchLedgerSection';
import { exportCsvBundle, exportExcelWorkbook, downloadFile } from '../../io/spreadsheetExport';
import { computePublicChoiceUtilityReport } from '../../engine/utility';
import { computeStructuralRiskReport } from '../../engine/risk';
import { SpreadsheetImportModal } from '../toolbar/SpreadsheetImportModal';
import { QualCountLogo } from '../common/QualCountLogo';

interface MaximizedDashboardProps {
  onOpenExport?: () => void;
  onOpenImport?: () => void;
}

export const MaximizedDashboard: React.FC<MaximizedDashboardProps> = ({
  onOpenExport,
  onOpenImport,
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const isDashboardMaximized = useWorkspaceStore((state) => state.isDashboardMaximized);
  const setDashboardMaximized = useWorkspaceStore((state) => state.setDashboardMaximized);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const theme = useWorkspaceStore((state) => state.theme);
  const selectPlacement = useWorkspaceStore((state) => state.selectPlacement);
  const setHighlightedPlacements = useWorkspaceStore((state) => state.setHighlightedPlacements);
  const updatePlacementPublicChoice = useWorkspaceStore((state) => state.updatePlacementPublicChoice);
  const updateUtilityWeights = useWorkspaceStore((state) => state.updateUtilityWeights);
  const updateRiskScenarioStatus = useWorkspaceStore((state) => state.updateRiskScenarioStatus);
  const setBranchStatus = useWorkspaceStore((state) => state.setBranchStatus);
  const agentMutationNotification = useWorkspaceStore((state) => state.agentMutationNotification);
  const revertLastAgentChange = useWorkspaceStore((state) => state.revertLastAgentChange);
  const dismissAgentNotification = useWorkspaceStore((state) => state.dismissAgentNotification);

  // Global Keyboard Listener for Cmd/Ctrl + Shift + D and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Ctrl/Cmd + Shift + D
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDashboardMaximized(!isDashboardMaximized);
      } else if (e.key === 'Escape' && isDashboardMaximized) {
        e.preventDefault();
        setDashboardMaximized(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDashboardMaximized, setDashboardMaximized]);

  if (!isDashboardMaximized || !workspace || !activeWorkbookId) {
    return null;
  }

  const activeWorkbook = workspace.workbooks[activeWorkbookId];

  const handleExportCsv = () => {
    if (onOpenExport) {
      onOpenExport();
      return;
    }
    const wbContext = {
      ...workspace,
      activeWorkbookId,
      utilityWeights: activeWorkbook?.utilityWeights,
      targetBudgetInr: activeWorkbook?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, workspace.entities);
    const bundle = exportCsvBundle(wbContext, workspace.entities, uReport);
    const slug = (activeWorkbook?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(bundle.nodesCsv, `${slug}_nodes.csv`, 'text/csv;charset=utf-8');
    downloadFile(bundle.branchesCsv, `${slug}_branches.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportExcel = async () => {
    if (onOpenExport) {
      onOpenExport();
      return;
    }
    const wbContext = {
      ...workspace,
      activeWorkbookId,
      utilityWeights: activeWorkbook?.utilityWeights,
      targetBudgetInr: activeWorkbook?.targetBudgetInr,
    };
    const uReport = computePublicChoiceUtilityReport(wbContext, workspace.entities);
    const rReport = computeStructuralRiskReport(wbContext, workspace.entities);
    const blob = await exportExcelWorkbook(wbContext, workspace.entities, uReport, rReport);
    const slug = (activeWorkbook?.title || 'qualcount').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadFile(blob, `${slug}_workbook.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleJumpToNode = (placementId: string) => {
    setDashboardMaximized(false);
    selectPlacement(placementId);
    setHighlightedPlacements([placementId]);
  };

  const handleSelectCulprits = (placementIds: string[]) => {
    setDashboardMaximized(false);
    setHighlightedPlacements(placementIds);
    if (placementIds.length > 0) {
      selectPlacement(placementIds[0]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Maximized Analytical Dashboard"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#FAF8F4] dark:bg-[#121417] text-[#1C1B18] dark:text-[#F4F2ED] transition-colors"
    >
      {/* Editorial Folio Header */}
      <header className="sticky top-0 z-40 bg-[#F2EFE9]/95 dark:bg-[#181B20]/95 backdrop-blur-md border-b border-[#DDD6C8] dark:border-[#2D333B] px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <QualCountLogo size={22} showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg font-bold tracking-tight text-[#1C1B18] dark:text-[#F4F2ED]">
                {activeWorkbook?.title || 'QualCount Analytical Ledger'}
              </h1>
              {/* Workspace Source Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider bg-[#EFECE6] text-[#3D3830] border border-[#CFC7B8] dark:bg-[#2D333B] dark:text-[#E2E8F0] dark:border-[#4B5563]">
                <HardDrive className="w-2.5 h-2.5" />
                Local
              </span>
            </div>
            <p className="text-[11px] text-[#8A8377] dark:text-[#6B7280]">
              Institutional Partnership & Decision-Cost Ledger · Press{' '}
              <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-[#DDD6C8]/40 dark:bg-[#2D333B] border border-[#BEB5A4] dark:border-[#4B5563]">
                Cmd/Ctrl+Shift+D
              </kbd>{' '}
              or <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-[#DDD6C8]/40 dark:bg-[#2D333B] border border-[#BEB5A4] dark:border-[#4B5563]">Esc</kbd> to return to canvas
            </p>
          </div>
        </div>

        {/* Header Action Triggers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#BEB5A4] dark:border-[#4B5563] text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED] bg-[#FFFFFF] dark:bg-[#1E2228] hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] transition-colors cursor-pointer"
            title="Export CSV Bundle (UTF-8 BOM)"
          >
            <Download className="w-3.5 h-3.5 text-[#0F6B38] dark:text-[#34D399]" />
            <span>CSV Bundle</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#BEB5A4] dark:border-[#4B5563] text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED] bg-[#FFFFFF] dark:bg-[#1E2228] hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] transition-colors cursor-pointer"
            title="Export Multi-Tab Excel Workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F6B38] dark:text-[#34D399]" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenImport) onOpenImport();
              else setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#BEB5A4] dark:border-[#4B5563] text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED] bg-[#FFFFFF] dark:bg-[#1E2228] hover:bg-[#F2EFE9] dark:hover:bg-[#2D333B] transition-colors cursor-pointer"
            title="Open 3-Door Spreadsheet Importer"
          >
            <Upload className="w-3.5 h-3.5 text-[#B45309] dark:text-[#FACC15]" />
            <span>Import</span>
          </button>

          {/* Close / Return to Canvas */}
          <button
            type="button"
            onClick={() => setDashboardMaximized(false)}
            aria-label="Close dashboard"
            className="p-1.5 rounded-[4px] border border-[#BEB5A4] dark:border-[#4B5563] text-[#1C1B18] dark:text-[#F4F2ED] hover:bg-[#DDD6C8]/40 dark:hover:bg-[#2D333B] transition-colors cursor-pointer ml-1"
            title="Return to canvas (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* DASH-04 Agent Mutation Banner & Undo Action */}
      {agentMutationNotification && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#FAF0E6] dark:bg-[#2A2318] border-b border-[#DDD6C8] dark:border-[#4A3D2A] px-6 py-2.5 flex items-center justify-between text-xs font-mono animate-fade-in"
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-900 dark:text-amber-300 shrink-0">
              Agent Edit [{agentMutationNotification.agentName}]:
            </span>
            <span className="text-stone-700 dark:text-stone-300 truncate max-w-xl" title={agentMutationNotification.summary}>
              {agentMutationNotification.summary}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 shrink-0">
              ({new Date(agentMutationNotification.timestamp).toLocaleTimeString()})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={revertLastAgentChange}
              className="px-2.5 py-1 rounded border border-amber-600/40 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/70 text-amber-950 dark:text-amber-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
              title="Undo agent change and restore prior snapshot"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo Agent Change</span>
            </button>
            <button
              type="button"
              onClick={dismissAgentNotification}
              className="p-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet Import Modal Mount */}
      <SpreadsheetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Main Container - 4 Ledger Sections */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Section 1: Financial & In-Kind Ledger */}
        <FinancialLedgerSection
          workspace={workspace}
          activeWorkbookId={activeWorkbookId}
          theme={theme}
          onJumpToNode={handleJumpToNode}
        />

        {/* Section 2: Public Choice Utility Ledger */}
        <UtilityLedgerSection
          workspace={workspace}
          activeWorkbookId={activeWorkbookId}
          theme={theme}
          onUpdatePlacement={updatePlacementPublicChoice}
          onUpdateWeights={updateUtilityWeights}
          onJumpToNode={handleJumpToNode}
        />

        {/* Section 3: Two-Layer Risk Assessment Box */}
        <RiskAssessmentBox
          workspace={workspace}
          activeWorkbookId={activeWorkbookId}
          theme={theme}
          onJumpToNode={handleJumpToNode}
          onUpdateScenarioStatus={updateRiskScenarioStatus}
          onSelectCulprits={handleSelectCulprits}
        />

        {/* Section 4: Node & Branch Ledger */}
        <NodeBranchLedgerSection
          workspace={workspace}
          activeWorkbookId={activeWorkbookId}
          theme={theme}
          onJumpToNode={handleJumpToNode}
          onUpdateBranchStatus={setBranchStatus}
        />
      </main>
    </div>
  );
};
