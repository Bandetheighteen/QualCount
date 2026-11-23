import React from 'react';
import { clsx } from 'clsx';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { computeTopologyMetrics } from '../../engine/metrics';
import { formatRupeeCompact } from '../../utils/currency';

export const BookIndexSidebar: React.FC = () => {
  const isBookIndexOpen = useWorkspaceStore((state) => state.isBookIndexOpen);
  const toggleBookIndex = useWorkspaceStore((state) => state.toggleBookIndex);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const openWorkbook = useWorkspaceStore((state) => state.openWorkbook);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const createWorkbook = useWorkspaceStore((state) => state.createWorkbook);
  const deleteWorkbook = useWorkspaceStore((state) => state.deleteWorkbook);
  const theme = useWorkspaceStore((state) => state.theme);

  const isDark = theme === 'dark' || theme === 'night';

  if (!workspace) return null;

  const workbooks = Object.values(workspace.workbooks);

  return (
    <aside
      className={clsx(
        'relative h-full border-r transition-all duration-200 select-none flex flex-col z-30 font-sans',
        isBookIndexOpen ? 'w-56' : 'w-7',
        isDark ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]' : 'bg-[#F2EFE9] border-[#DDD6C8] text-[#1C1B18]'
      )}
    >
      {/* Collapsed Strip */}
      {!isBookIndexOpen && (
        <div className="h-full flex flex-col items-center py-3 justify-between">
          <button
            onClick={toggleBookIndex}
            className="p-1 rounded-xs hover:bg-[#DDD6C8] dark:hover:bg-[#2D333B] text-[#8A8377] hover:text-[#1C1B18]"
            title="Expand Sibling Book Index (Ctrl+B)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span
            className="text-[10px] font-mono text-[#8A8377] uppercase tracking-widest writing-vertical rotate-180 cursor-pointer"
            onClick={toggleBookIndex}
          >
            Sibling Index
          </span>
          <button
            onClick={() => setActiveView('landing')}
            className="p-1 rounded-xs hover:bg-[#DDD6C8] text-[#8A8377]"
            title="Cover & Index"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Sidebar */}
      {isBookIndexOpen && (
        <>
          {/* Header */}
          <div className="p-3 border-b border-[#DDD6C8] dark:border-[#2D333B] flex items-center justify-between">
            <button
              onClick={() => setActiveView('landing')}
              className="flex items-center gap-1.5 text-xs font-serif font-bold hover:text-[#B45309] transition-colors"
              title="Return to Landing Page Cover & Index"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Cover & Index</span>
            </button>
            <button
              onClick={toggleBookIndex}
              className="p-1 rounded-xs hover:bg-[#DDD6C8] dark:hover:bg-[#2D333B] text-[#8A8377]"
              title="Collapse Sibling Index (Ctrl+B)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Subtitle & Quick Add */}
          <div className="px-3 py-2 flex items-center justify-between text-[10px] font-mono uppercase text-[#8A8377] border-b border-[#DDD6C8]/40 dark:border-[#2D333B]/40">
            <span>Sibling Workbooks ({workbooks.length})</span>
            <button
              onClick={async () => {
                const title = prompt('Enter new workbook title:');
                if (!title || !title.trim()) return;
                const budgetInput = prompt(
                  `Enter initial target budget for "${title.trim()}" in INR (or leave blank to skip):`,
                  ''
                );
                const budget = budgetInput ? Math.max(0, parseFloat(budgetInput) || 0) : 0;
                await createWorkbook(title.trim(), '', budget);
              }}
              className="p-0.5 rounded-xs hover:bg-[#DDD6C8] dark:hover:bg-[#2D333B] text-[#1C1B18] dark:text-[#F4F2ED]"
              title="Add Sibling Workbook"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Workbook List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#DDD6C8]/40 dark:divide-[#2D333B]/40">
            {workbooks.map((wb) => {
              const isActive = wb.workbookId === activeWorkbookId;
              let metrics;
              try {
                metrics = computeTopologyMetrics(workspace, wb.workbookId);
              } catch {
                // Ignore
              }

              const fundingPct = metrics ? metrics.funding.securedPct : 0;
              const directTies = metrics ? metrics.directRelationships.confirmedCount : 0;

              return (
                <div
                  key={wb.workbookId}
                  onClick={() => openWorkbook(wb.workbookId)}
                  className={clsx(
                    'p-2.5 cursor-pointer transition-colors relative flex flex-col gap-1',
                    isActive
                      ? isDark
                        ? 'bg-[#1E2228] text-[#F4F2ED]'
                        : 'bg-[#EDE8DE] text-[#1C1B18] shadow-xs'
                      : isDark
                      ? 'hover:bg-[#1E2228]/50 text-[#8A8377]'
                      : 'hover:bg-[#EAE6DF] text-[#5A554C]'
                  )}
                >
                  {/* Left Active Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B45309]" />
                  )}

                  <div className="flex items-center justify-between gap-1 pl-1">
                    <span className="text-xs font-serif font-semibold truncate" title={wb.title}>
                      {wb.title}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={clsx(
                          'text-[8px] uppercase font-mono px-1 py-0.2 rounded-xs border',
                          wb.status === 'active'
                            ? 'bg-[#E6F4EC] text-[#0F6B38] border-[#C3E4D1]'
                            : 'bg-[#F2EFE9] text-[#8A8377] border-[#DDD6C8]'
                        )}
                      >
                        {wb.status}
                      </span>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = typeof window !== 'undefined'
                            ? window.confirm(`Delete workbook "${wb.title}"? All its nodes and branches will be permanently removed.`)
                            : true;
                          if (confirmed) {
                            await deleteWorkbook(wb.workbookId);
                          }
                        }}
                        className="p-0.5 rounded-xs hover:bg-[#DDD6C8] dark:hover:bg-[#2D333B] text-[#8A8377] hover:text-[#991B1B] transition-colors"
                        title={`Delete workbook "${wb.title}"`}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Micro KPIs */}
                  <div className="flex items-center gap-2.5 text-[10px] font-mono text-[#8A8377] pl-1">
                    <span className="text-[#0F6B38] font-medium" title="Funding %">
                      {fundingPct.toFixed(0)}%
                    </span>
                    <span>·</span>
                    <span title="Direct ties">{directTies} ties</span>
                    <span>·</span>
                    <span title="Target Budget">{formatRupeeCompact(wb.targetBudgetInr)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Metadata */}
          <div className="p-2 border-t border-[#DDD6C8] dark:border-[#2D333B] text-[10px] font-mono text-[#8A8377] text-center">
            {workspace.workspaceName || 'QualCount Workspace'}
          </div>
        </>
      )}
    </aside>
  );
};
