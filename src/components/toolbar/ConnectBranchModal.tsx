import React, { useState, useEffect, useMemo } from 'react';
import { X, GitCommit, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { BranchType, BranchStatus } from '../../types/schema';

interface ConnectBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSourceId?: string;
}

export const ConnectBranchModal: React.FC<ConnectBranchModalProps> = ({
  isOpen,
  onClose,
  initialSourceId,
}) => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const selectedPlacementId = useWorkspaceStore((state) => state.selectedPlacementId);
  const addBranch = useWorkspaceStore((state) => state.addBranch);

  const placements = useMemo(() => {
    return Object.values(workspace?.placements ?? {}).filter(
      (p) => p.workbookId === activeWorkbookId
    );
  }, [workspace?.placements, activeWorkbookId]);

  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [sortMode, setSortMode] = useState<'a-z' | 'z-a' | 'category' | 'appearance'>('a-z');
  const [type, setType] = useState<BranchType>('white');
  const [status, setStatus] = useState<BranchStatus>('tick');
  const [valuePct, setValuePct] = useState<number>(10);
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getEntityName = (placementId: string) => {
    const p = workspace?.placements[placementId];
    if (!p) return placementId;
    const e = workspace?.entities[p.entityId];
    return e?.name ?? p.placementId;
  };

  const getEntityCategory = (placementId: string) => {
    const p = workspace?.placements[placementId];
    if (!p) return '';
    const e = workspace?.entities[p.entityId];
    return e?.category ?? '';
  };

  const sortedPlacements = useMemo(() => {
    const list = [...placements];
    if (sortMode === 'a-z') {
      return list.sort((a, b) =>
        getEntityName(a.placementId).localeCompare(getEntityName(b.placementId))
      );
    }
    if (sortMode === 'z-a') {
      return list.sort((a, b) =>
        getEntityName(b.placementId).localeCompare(getEntityName(a.placementId))
      );
    }
    if (sortMode === 'category') {
      return list.sort((a, b) => {
        const catA = getEntityCategory(a.placementId);
        const catB = getEntityCategory(b.placementId);
        const catCmp = catA.localeCompare(catB);
        if (catCmp !== 0) return catCmp;
        return getEntityName(a.placementId).localeCompare(getEntityName(b.placementId));
      });
    }
    return list;
  }, [placements, sortMode, workspace]);

  // Initialize source/target once on modal open
  useEffect(() => {
    if (!isOpen) return;
    if (placements.length >= 2) {
      if (initialSourceId && placements.some((p) => p.placementId === initialSourceId)) {
        setSourceId(initialSourceId);
        const other = placements.find((p) => p.placementId !== initialSourceId);
        if (other) setTargetId(other.placementId);
      } else if (selectedPlacementId && placements.some((p) => p.placementId === selectedPlacementId)) {
        setSourceId(selectedPlacementId);
        const other = placements.find((p) => p.placementId !== selectedPlacementId);
        if (other) setTargetId(other.placementId);
      } else {
        setSourceId(placements[0].placementId);
        setTargetId(placements[1].placementId);
      }
    }
    setErrorMsg(null);
  }, [isOpen, initialSourceId, selectedPlacementId, placements]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isSelfLoop = Boolean(sourceId && targetId && sourceId === targetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId) {
      setErrorMsg('Please select both a source and a target organization');
      return;
    }
    if (isSelfLoop) {
      setErrorMsg('Self-loops are not permitted in QualCount network topology');
      return;
    }

    try {
      await addBranch(
        sourceId,
        targetId,
        type,
        status,
        type === 'green' ? Math.max(1, Math.min(100, Number(valuePct) || 10)) : undefined,
        note.trim()
      );
      setErrorMsg(null);
      setNote('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect branch');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-branch-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-150"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-emerald-400" />
            <h3 id="connect-branch-title" className="text-base font-semibold text-slate-100">
              Connect Multiplex Branch
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {placements.length < 2 ? (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
              At least 2 organizations are required in the workbook to connect a branch.
            </div>
          ) : (
            <>
              {/* Sorting Feature: A to Z, Z to A, Category, Appearance */}
              <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[11px] font-medium text-slate-400">Sort Organizations:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSortMode('a-z')}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer border',
                      sortMode === 'a-z'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    )}
                  >
                    A → Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('z-a')}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer border',
                      sortMode === 'z-a'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    )}
                  >
                    Z → A
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('category')}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer border',
                      sortMode === 'category'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    )}
                  >
                    Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('appearance')}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer border',
                      sortMode === 'appearance'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    )}
                  >
                    Appearance
                  </button>
                </div>
              </div>

              {/* Source Placement Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="source-placement-select" className="text-xs font-medium text-slate-300">
                  Source Organization (Origin)
                </label>
                <select
                  id="source-placement-select"
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {sortedPlacements.map((p) => {
                    const cat = getEntityCategory(p.placementId);
                    return (
                      <option key={p.placementId} value={p.placementId}>
                        {getEntityName(p.placementId)} {cat ? `[${cat.toUpperCase()}]` : ''} {p.isRootNgo ? '(Root NGO)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Target Placement Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="target-placement-select" className="text-xs font-medium text-slate-300">
                  Target Organization (Destination)
                </label>
                <select
                  id="target-placement-select"
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {sortedPlacements.map((p) => {
                    const cat = getEntityCategory(p.placementId);
                    return (
                      <option key={p.placementId} value={p.placementId}>
                        {getEntityName(p.placementId)} {cat ? `[${cat.toUpperCase()}]` : ''} {p.isRootNgo ? '(Root NGO)' : ''}
                      </option>
                    );
                  })}
                </select>
                {isSelfLoop && (
                  <span className="text-[11px] text-rose-400">
                    Self-loops are not allowed (source and target must differ).
                  </span>
                )}
              </div>

              {/* Line Type Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Line Type (Relationship Vector)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-label="Green Funding"
                    onClick={() => setType('green')}
                    className={clsx(
                      'px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      type === 'green'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Funding
                  </button>
                  <button
                    type="button"
                    aria-label="White Direct"
                    onClick={() => setType('white')}
                    className={clsx(
                      'px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      type === 'white'
                        ? 'border-slate-300 bg-slate-100/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Direct
                  </button>
                  <button
                    type="button"
                    aria-label="Yellow Bridge"
                    onClick={() => setType('yellow')}
                    className={clsx(
                      'px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      type === 'yellow'
                        ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Bridge
                  </button>
                </div>
              </div>

              {/* Initial Status Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Verification Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('pending')}
                    className={clsx(
                      'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      status === 'pending'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('tick')}
                    className={clsx(
                      'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      status === 'tick'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('cross')}
                    className={clsx(
                      'px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                      status === 'cross'
                        ? 'border-slate-500 bg-slate-700/40 text-slate-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    Declined
                  </button>
                </div>
              </div>

              {/* Conditional Inputs */}
              {type === 'green' ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="green-m-pct-input" className="text-xs font-medium text-slate-300">
                    Funding Allocation
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="green-m-pct-input"
                      type="number"
                      min={1}
                      max={100}
                      value={valuePct}
                      onChange={(e) => setValuePct(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      className="w-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">%</span>
                    <span className="text-xs text-emerald-400/80 font-mono">
                      (M{valuePct} allocation)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="branch-qual-note-input" className="text-xs font-medium text-slate-300">
                    Qualitative Note / Referral Context
                  </label>
                  <textarea
                    id="branch-qual-note-input"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      type === 'yellow'
                        ? 'e.g. Referred via City Museum Trustee, warm outreach...'
                        : 'e.g. In-kind venue partner, memorandum of understanding...'
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSelfLoop || !sourceId || !targetId || placements.length < 2}
              className={clsx(
                'px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-md',
                !isSelfLoop && sourceId && targetId && placements.length >= 2
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              )}
            >
              Connect Branch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectBranchModal;
