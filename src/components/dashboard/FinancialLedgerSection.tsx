import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle, Clock, XCircle, Gift } from 'lucide-react';
import type { WorkspaceState } from '../../types/schema';

interface FinancialLedgerSectionProps {
  workspace: WorkspaceState;
  activeWorkbookId: string;
  theme: 'dark' | 'night' | 'light';
  onJumpToNode?: (placementId: string) => void;
}

function formatInr(val: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return `₹${val.toLocaleString()}`;
  }
}

export const FinancialLedgerSection: React.FC<FinancialLedgerSectionProps> = ({
  workspace,
  activeWorkbookId,
  theme: _theme,
  onJumpToNode,
}) => {
  const workbook = workspace.workbooks[activeWorkbookId];
  const targetBudget = workbook?.targetBudgetInr ?? 1000000;

  const branches = Object.values(workspace.branches).filter(
    (b) => !b.workbookId || b.workbookId === activeWorkbookId
  );
  const greenBranches = branches.filter((b) => b.type === 'green');

  // Metrics calculation
  const securedPct = greenBranches
    .filter((b) => b.status === 'tick')
    .reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const securedInr = Math.round((securedPct / 100) * targetBudget);

  const pendingPct = greenBranches
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + (b.valuePct || 0), 0);
  const pendingInr = Math.round((pendingPct / 100) * targetBudget);

  const inKindInr = branches
    .filter((b) => b.type === 'white' && b.status === 'tick' && typeof b.inKindValueInr === 'number')
    .reduce((sum, b) => sum + (b.inKindValueInr || 0), 0);
  const inKindPct = targetBudget > 0 ? Number(((inKindInr / targetBudget) * 100).toFixed(1)) : 0;

  const declinedCount = greenBranches.filter((b) => b.status === 'cross').length;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DDD6C8] dark:border-[#2D333B] pb-2">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-[#1C1B18] dark:text-[#F4F2ED]">
            I. Financial & In-Kind Ledger
          </h2>
          <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF]">
            Verifiable funding progress, CSR sponsorships, and non-cash asset equivalents.
          </p>
        </div>
      </div>

      {/* KPI Ledger Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Target Budget */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8377] dark:text-[#6B7280]">
            Target Budget
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED] mt-1">
            {formatInr(targetBudget)}
          </div>
          <div className="text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mt-0.5">Campaign Total</div>
        </div>

        {/* Secured Cash */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#0F6B38] dark:text-[#34D399]">
            <span>Secured Cash</span>
            <CheckCircle className="w-3 h-3" />
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED] mt-1">
            M{securedPct.toFixed(1)}%
          </div>
          <div className="font-mono text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mt-0.5">
            {formatInr(securedInr)}
          </div>
        </div>

        {/* Pending Pipeline */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#C2850C] dark:text-[#FACC15]">
            <span>Pending Pipeline</span>
            <Clock className="w-3 h-3" />
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED] mt-1">
            M{pendingPct.toFixed(1)}%
          </div>
          <div className="font-mono text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mt-0.5">
            {formatInr(pendingInr)}
          </div>
        </div>

        {/* In-Kind Equivalent */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#1C1B18] dark:text-[#F4F2ED]">
            <span>In-Kind Asset</span>
            <Gift className="w-3 h-3" />
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED] mt-1">
            M_eq {inKindPct}%
          </div>
          <div className="font-mono text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mt-0.5">
            {formatInr(inKindInr)}
          </div>
        </div>

        {/* Declined CSR */}
        <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] p-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#8A8377] dark:text-[#6B7280]">
            <span>Declined / Cross</span>
            <XCircle className="w-3 h-3" />
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[#1C1B18] dark:text-[#F4F2ED] mt-1">
            {declinedCount}
          </div>
          <div className="text-[10px] text-[#5A554C] dark:text-[#9CA3AF] mt-0.5">Resolved Stalled</div>
        </div>
      </div>

      {/* CSR Branches Table */}
      <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] overflow-hidden shadow-sm">
        <div className="bg-[#F2EFE9] dark:bg-[#181B20] px-4 py-2 border-b border-[#DDD6C8] dark:border-[#2D333B] flex items-center justify-between">
          <span className="font-serif text-xs font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
            Funding (Green) Branch Ledger ({greenBranches.length})
          </span>
          <span className="text-[10px] text-[#8A8377] dark:text-[#6B7280]">
            Ratio-scale % strictly relative to target budget
          </span>
        </div>

        {greenBranches.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8A8377] dark:text-[#6B7280]">
            No financial funding branches defined in this workbook.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DDD6C8] dark:border-[#2D333B] bg-[#FAF8F4]/50 dark:bg-[#121417]/50 text-[10px] font-bold uppercase tracking-wider text-[#5A554C] dark:text-[#9CA3AF]">
                  <th className="py-2 px-3">Donor / Partner</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">M% Value</th>
                  <th className="py-2 px-3 text-right">INR Value</th>
                  <th className="py-2 px-3">Notes & Commitments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD6C8]/60 dark:divide-[#2D333B]/60 font-sans">
                {greenBranches.map((branch) => {
                  const targetPlacement = workspace.placements[branch.targetPlacementId];
                  const targetEntity = targetPlacement ? workspace.entities[targetPlacement.entityId] : undefined;
                  const partnerName = targetEntity?.name || branch.targetPlacementId;
                  const branchValueInr = branch.valuePct
                    ? Math.round((branch.valuePct / 100) * targetBudget)
                    : 0;

                  return (
                    <tr
                      key={branch.branchId}
                      className="hover:bg-[#F2EFE9]/50 dark:hover:bg-[#181B20]/50 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium text-[#1C1B18] dark:text-[#F4F2ED]">
                        <button
                          type="button"
                          onClick={() => onJumpToNode?.(branch.targetPlacementId)}
                          className="hover:underline text-left cursor-pointer font-semibold"
                          title="Click to view on canvas"
                        >
                          {partnerName}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider border',
                            branch.status === 'tick'
                              ? 'bg-[#E6F4EC] text-[#0F6B38] border-[#0F6B38]/30 dark:bg-[#064E3B] dark:text-[#A7F3D0]'
                              : branch.status === 'pending'
                              ? 'bg-[#FEF3C7] text-[#92400E] border-[#B45309]/30 dark:bg-[#451A03] dark:text-[#FDE68A]'
                              : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                          )}
                        >
                          {branch.status === 'tick' ? 'Confirmed' : branch.status === 'pending' ? 'Pending' : 'Declined'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-right tabular-nums text-[#1C1B18] dark:text-[#F4F2ED]">
                        M{branch.valuePct ?? 0}%
                      </td>
                      <td className="py-2 px-3 font-mono text-right tabular-nums text-[#5A554C] dark:text-[#9CA3AF]">
                        {formatInr(branchValueInr)}
                      </td>
                      <td className="py-2 px-3 text-[#5A554C] dark:text-[#9CA3AF] max-w-[260px] truncate" title={branch.note}>
                        {branch.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
