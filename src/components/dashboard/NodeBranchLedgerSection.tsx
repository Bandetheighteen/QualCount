import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Search } from 'lucide-react';
import type { WorkspaceState, BranchStatus } from '../../types/schema';

interface NodeBranchLedgerSectionProps {
  workspace: WorkspaceState;
  activeWorkbookId: string;
  theme: 'dark' | 'night' | 'light';
  onJumpToNode?: (placementId: string) => void;
  onUpdateBranchStatus?: (branchId: string, status: BranchStatus) => void;
}

export const NodeBranchLedgerSection: React.FC<NodeBranchLedgerSectionProps> = ({
  workspace,
  activeWorkbookId,
  theme: _theme,
  onJumpToNode,
  onUpdateBranchStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'branches'>('nodes');

  const placements = Object.values(workspace.placements).filter((p) => !p.isRootNgo);
  const branches = Object.values(workspace.branches).filter(
    (b) => !b.workbookId || b.workbookId === activeWorkbookId
  );

  const filteredPlacements = placements.filter((p) => {
    const ent = workspace.entities[p.entityId];
    const name = ent?.name || '';
    const cat = ent?.category || '';
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
  });

  const filteredBranches = branches.filter((b) => {
    const srcPlc = workspace.placements[b.sourcePlacementId];
    const tgtPlc = workspace.placements[b.targetPlacementId];
    const srcName = (srcPlc ? workspace.entities[srcPlc.entityId]?.name : '') || '';
    const tgtName = (tgtPlc ? workspace.entities[tgtPlc.entityId]?.name : '') || '';
    const note = b.note || '';
    const q = searchQuery.toLowerCase();
    return (
      srcName.toLowerCase().includes(q) ||
      tgtName.toLowerCase().includes(q) ||
      note.toLowerCase().includes(q) ||
      b.type.includes(q)
    );
  });

  return (
    <section className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#DDD6C8] dark:border-[#2D333B] pb-2 gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-[#1C1B18] dark:text-[#F4F2ED]">
            IV. Relational Node & Branch Registry
          </h2>
          <p className="text-xs text-[#5A554C] dark:text-[#9CA3AF]">
            Complete auditable directory of all coalition participants and multiplex linkages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab buttons */}
          <div className="inline-flex rounded-[4px] border border-[#DDD6C8] dark:border-[#2D333B] bg-[#FFFFFF] dark:bg-[#1E2228] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('nodes')}
              className={clsx(
                'px-2.5 py-1 rounded-[3px] font-semibold transition-colors cursor-pointer',
                activeTab === 'nodes'
                  ? 'bg-[#1C1B18] text-[#FFFFFF] dark:bg-[#F4F2ED] dark:text-[#1C1B18]'
                  : 'text-[#5A554C] dark:text-[#9CA3AF] hover:text-[#1C1B18]'
              )}
            >
              Organizations ({placements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              className={clsx(
                'px-2.5 py-1 rounded-[3px] font-semibold transition-colors cursor-pointer',
                activeTab === 'branches'
                  ? 'bg-[#1C1B18] text-[#FFFFFF] dark:bg-[#F4F2ED] dark:text-[#1C1B18]'
                  : 'text-[#5A554C] dark:text-[#9CA3AF] hover:text-[#1C1B18]'
              )}
            >
              Branches ({branches.length})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8377] dark:text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[4px] pl-8 pr-3 py-1 text-xs text-[#1C1B18] dark:text-[#F4F2ED] placeholder-[#8A8377] focus:outline-none w-44 md:w-56"
            />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-[#FFFFFF] dark:bg-[#1E2228] border border-[#DDD6C8] dark:border-[#2D333B] rounded-[6px] overflow-hidden shadow-sm">
        {activeTab === 'nodes' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DDD6C8] dark:border-[#2D333B] bg-[#FAF8F4]/50 dark:bg-[#121417]/50 text-[10px] font-bold uppercase tracking-wider text-[#5A554C] dark:text-[#9CA3AF]">
                  <th className="py-2.5 px-3">Organization Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-2 text-center">Touches</th>
                  <th className="py-2.5 px-3">Selective Incentives</th>
                  <th className="py-2.5 px-3">Global Notes</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD6C8]/60 dark:divide-[#2D333B]/60 font-sans">
                {filteredPlacements.map((plc) => {
                  const ent = workspace.entities[plc.entityId];
                  return (
                    <tr key={plc.placementId} className="hover:bg-[#F2EFE9]/40 dark:hover:bg-[#181B20]/40 transition-colors">
                      <td className="py-2 px-3 font-semibold text-[#1C1B18] dark:text-[#F4F2ED]">
                        {ent?.name || 'Unknown'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#EFECE6] dark:bg-[#2D333B] text-[#5A554C] dark:text-[#9CA3AF]">
                          {ent?.category || 'other'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-mono tabular-nums">
                        {plc.outreachAttempts ?? 1}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#5A554C] dark:text-[#9CA3AF]">
                        {plc.selectiveIncentives && plc.selectiveIncentives.length > 0
                          ? plc.selectiveIncentives.join(', ')
                          : 'None'}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#5A554C] dark:text-[#9CA3AF] max-w-[280px] truncate" title={ent?.globalNotes}>
                        {ent?.globalNotes || '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => onJumpToNode?.(plc.placementId)}
                          className="text-[#0F6B38] dark:text-[#34D399] hover:underline font-semibold text-[10px] cursor-pointer"
                        >
                          Canvas
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DDD6C8] dark:border-[#2D333B] bg-[#FAF8F4]/50 dark:bg-[#121417]/50 text-[10px] font-bold uppercase tracking-wider text-[#5A554C] dark:text-[#9CA3AF]">
                  <th className="py-2.5 px-3">Source Partner</th>
                  <th className="py-2.5 px-2">Type</th>
                  <th className="py-2.5 px-3">Target Partner</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Commitment Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD6C8]/60 dark:divide-[#2D333B]/60 font-sans">
                {filteredBranches.map((br) => {
                  const srcPlc = workspace.placements[br.sourcePlacementId];
                  const tgtPlc = workspace.placements[br.targetPlacementId];
                  const srcName = srcPlc ? workspace.entities[srcPlc.entityId]?.name : br.sourcePlacementId;
                  const tgtName = tgtPlc ? workspace.entities[tgtPlc.entityId]?.name : br.targetPlacementId;

                  return (
                    <tr key={br.branchId} className="hover:bg-[#F2EFE9]/40 dark:hover:bg-[#181B20]/40 transition-colors">
                      <td className="py-2 px-3 font-medium text-[#1C1B18] dark:text-[#F4F2ED]">
                        {srcName}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={clsx(
                            'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                            br.type === 'green'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : br.type === 'yellow'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {br.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-[#1C1B18] dark:text-[#F4F2ED]">
                        {tgtName}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={br.status}
                          onChange={(e) => onUpdateBranchStatus?.(br.branchId, e.target.value as BranchStatus)}
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border cursor-pointer focus:outline-none',
                            br.status === 'tick'
                              ? 'bg-[#E6F4EC] text-[#0F6B38] border-[#0F6B38]/30 dark:bg-[#064E3B] dark:text-[#A7F3D0]'
                              : br.status === 'pending'
                              ? 'bg-[#FEF3C7] text-[#92400E] border-[#B45309]/30 dark:bg-[#451A03] dark:text-[#FDE68A]'
                              : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                          )}
                        >
                          <option value="pending">Pending</option>
                          <option value="tick">Confirmed (Tick)</option>
                          <option value="cross">Declined (Cross)</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#5A554C] dark:text-[#9CA3AF] max-w-[260px] truncate" title={br.note}>
                        {br.note || '—'}
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
