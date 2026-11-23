import React, { useState } from 'react';
import { X, SlidersHorizontal, Lock, Trash2, Check, Clock } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { BranchType, EntityCategory } from '../../types/schema';

export interface MultiSelectModifyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiSelectModifyModal: React.FC<MultiSelectModifyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const storeSelectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);
  const storeSelectedBranchIds = useWorkspaceStore((state) => state.selectedBranchIds);
  const storeSectors = useWorkspaceStore((state) => state.sectors);
  const storeIsWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);

  // Synchronize with live store state for headless SSR / testing environments
  const selectedPlacementIds = useWorkspaceStore.getState().selectedPlacementIds ?? storeSelectedPlacementIds;
  const selectedBranchIds = useWorkspaceStore.getState().selectedBranchIds ?? storeSelectedBranchIds;
  const sectors = useWorkspaceStore.getState().sectors ?? storeSectors;
  const isWorkspaceLocked = useWorkspaceStore.getState().isWorkspaceLocked ?? storeIsWorkspaceLocked;

  const batchLock = useWorkspaceStore((state) => state.batchLock);
  const batchDelete = useWorkspaceStore((state) => state.batchDelete);
  const batchSetBranchStatus = useWorkspaceStore((state) => state.batchSetBranchStatus);
  const batchSetCategory = useWorkspaceStore((state) => state.batchSetCategory);
  const batchAppendNotes = useWorkspaceStore((state) => state.batchAppendNotes);
  const updateBranch = useWorkspaceStore((state) => state.updateBranch);

  const [selectedCategory, setSelectedCategory] = useState<EntityCategory>(sectors[0]?.id || 'csr');
  const [batchNoteText, setBatchNoteText] = useState('');

  if (!isOpen) return null;

  const totalItems = selectedPlacementIds.length + selectedBranchIds.length;

  const handleApplyCategory = async () => {
    if (selectedPlacementIds.length > 0) {
      await batchSetCategory(selectedCategory);
    }
  };

  const handleBatchType = async (type: BranchType) => {
    for (const bId of selectedBranchIds) {
      await updateBranch(bId, { type });
    }
  };

  const handleDelete = async () => {
    const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete all ${totalItems} selected items?`) : true;
    if (confirmed) {
      await batchDelete();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="multi-modify-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-xs text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <h2 id="multi-modify-title" className="text-sm font-bold text-slate-100">
              Batch Modify Selection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection Overview Chip */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <span className="text-slate-400">Total Selected:</span>
          <span className="font-semibold text-sky-300">
            {selectedPlacementIds.length} Nodes · {selectedBranchIds.length} Branches
          </span>
        </div>

        {/* 1. Node Category Update */}
        {selectedPlacementIds.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <label htmlFor="multi-category-select" className="font-semibold text-slate-300">
              Change Sector Category ({selectedPlacementIds.length} nodes)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="multi-category-select"
                value={selectedCategory}
                disabled={isWorkspaceLocked}
                onChange={(e) => setSelectedCategory(e.target.value as EntityCategory)}
                className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={handleApplyCategory}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* 2. Branch Status Update */}
        {selectedBranchIds.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="font-semibold text-slate-300">
              Change Verification Status ({selectedBranchIds.length} branches)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => batchSetBranchStatus('tick')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all font-semibold cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmed</span>
              </button>
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => batchSetBranchStatus('pending')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 transition-all font-semibold cursor-pointer disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending</span>
              </button>
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => batchSetBranchStatus('cross')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 transition-all font-semibold cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Declined</span>
              </button>
            </div>

            <span className="font-semibold text-slate-300 mt-2">
              Change Vector Type
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => handleBatchType('green')}
                className="py-1.5 px-2 rounded-lg bg-slate-900 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/40 text-center font-medium cursor-pointer disabled:opacity-50"
              >
                Funding
              </button>
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => handleBatchType('white')}
                className="py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-500/50 text-slate-200 hover:bg-slate-800 text-center font-medium cursor-pointer disabled:opacity-50"
              >
                Direct
              </button>
              <button
                type="button"
                disabled={isWorkspaceLocked}
                onClick={() => handleBatchType('yellow')}
                className="py-1.5 px-2 rounded-lg bg-slate-900 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-950/40 text-center font-medium cursor-pointer disabled:opacity-50"
              >
                Bridge
              </button>
            </div>
          </div>
        )}

        {/* 3. Batch Append Note / Tag */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <label htmlFor="multi-batch-note" className="font-semibold text-slate-300">
            Append Note / Tag to Selection
          </label>
          <div className="flex items-center gap-2">
            <input
              id="multi-batch-note"
              type="text"
              placeholder="e.g. Priority Review, Verified Partner"
              value={batchNoteText}
              disabled={isWorkspaceLocked}
              onChange={(e) => setBatchNoteText(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              disabled={isWorkspaceLocked || !batchNoteText.trim()}
              onClick={async () => {
                await batchAppendNotes(batchNoteText);
                setBatchNoteText('');
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Note
            </button>
          </div>
        </div>

        {/* 4. Global Batch Actions (Lock & Delete) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={() => batchLock()}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Toggle Lock</span>
          </button>

          <button
            type="button"
            disabled={isWorkspaceLocked}
            onClick={handleDelete}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Selected</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiSelectModifyModal;
