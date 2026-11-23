import React, { useState } from 'react';
import {
  Coins,
  Link2,
  GitFork,
  CheckCircle2,
  Layers,
  Megaphone,
  AlertTriangle,
  Maximize2,
  Edit3,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

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

export const MetricsStrip: React.FC = () => {
  const storeMetrics = useWorkspaceStore((state) => state.metrics);
  const storeWorkspace = useWorkspaceStore((state) => state.workspace);
  const storeActiveWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const dashboardPosition = useWorkspaceStore((state) => state.dashboardPosition);
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const toggleDashboardMaximized = useWorkspaceStore((state) => state.toggleDashboardMaximized);
  const theme = useWorkspaceStore.getState().theme ?? storeTheme;
  const isLight = theme === 'light';

  const isVertical = dashboardPosition === 'left' || dashboardPosition === 'right';

  const metrics = useWorkspaceStore.getState().metrics ?? storeMetrics;
  const workspace = useWorkspaceStore.getState().workspace ?? storeWorkspace;
  const activeWorkbookId = useWorkspaceStore.getState().activeWorkbookId ?? storeActiveWorkbookId;

  const activeWorkbook =
    workspace && activeWorkbookId ? workspace.workbooks[activeWorkbookId] : null;
  const targetBudget = activeWorkbook?.targetBudgetInr ?? 0;
  const updateWorkbook = useWorkspaceStore((state) => state.updateWorkbook);

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const handleOpenBudgetEdit = () => {
    setBudgetInput(targetBudget ? String(targetBudget) : '0');
    setIsEditingBudget(true);
  };

  const handleSaveBudget = async () => {
    if (!activeWorkbookId) return;
    const parsed = Math.max(0, parseFloat(budgetInput) || 0);
    await updateWorkbook(activeWorkbookId, { targetBudgetInr: parsed });
    setIsEditingBudget(false);
  };

  const handleAdjustBudget = (delta: number) => {
    const current = parseFloat(budgetInput) || targetBudget || 0;
    const next = Math.max(0, current + delta);
    setBudgetInput(String(next));
  };

  // Default fallbacks while metrics load
  const funding = metrics?.funding ?? {
    securedPct: 0,
    pendingPct: 0,
    declinedCount: 0,
    securedInr: 0,
  };
  const directRel = metrics?.directRelationships ?? {
    confirmedCount: 0,
    pendingCount: 0,
    declinedCount: 0,
    confirmationRatePct: 0,
  };
  const yellowBridges = metrics?.yellowBridges ?? {
    confirmedCount: 0,
    pendingCount: 0,
    declinedCount: 0,
  };
  const conversions = metrics?.ownedConversions ?? {
    referredNodeCount: 0,
    convertedNodeCount: 0,
    conversionRatePct: 0,
  };
  const multiThread = metrics?.multiThreadTargets ?? {
    doubleThreadCount: 0,
    tripleThreadCount: 0,
    quadPlusThreadCount: 0,
    triplePlusNames: [],
  };
  const topAmp = metrics?.topAmplifier ?? {
    entityId: null,
    entityName: 'None',
    directOutDegree: 0,
    downstreamReachCount: 0,
  };
  const concentration = metrics?.bridgeConcentration ?? {
    bridgeEntityName: 'None',
    concentrationPct: 0,
    unreachableCount: 0,
  };

  const isRiskHigh = concentration.concentrationPct > 30;

  return (
    <header
      aria-label="Quantitative Metrics Dashboard"
      className={clsx(
        'backdrop-blur-md z-20 select-none scrollbar-thin shrink-0 transition-colors',
        isLight
          ? 'bg-white text-black'
          : 'bg-slate-900/95 text-slate-200 border-b border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]',
        isVertical
          ? clsx(
              'w-72 h-full flex flex-col gap-2.5 overflow-y-auto p-3',
              dashboardPosition === 'left'
                ? isLight ? 'border-r-2 border-black' : 'border-r border-slate-800'
                : isLight ? 'border-l-2 border-black' : 'border-l border-slate-800'
            )
          : clsx(
              'w-full flex items-stretch gap-2.5 overflow-x-auto px-4 py-2',
              dashboardPosition === 'bottom'
                ? isLight ? 'border-t-2 border-black' : 'border-t border-slate-800'
                : isLight ? 'border-b-2 border-black' : 'border-b border-slate-800'
            )
      )}
    >
      {/* 1. Funding Secured - Neon Mint / Emerald Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[210px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)] text-black'
            : 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:shadow-[0_0_18px_rgba(16,185,129,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <Coins className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
            Funding Secured
          </span>
          <span
            className={clsx(
              'font-bold text-xs px-1.5 py-0.5 rounded border transition-all',
              isLight
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
            )}
          >
            M{funding.securedPct}%
          </span>
        </div>
        {/* Neon Glowing Progress Bar */}
        <div className={clsx('w-full h-2 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] h-full transition-all duration-300"
            style={{ width: `${Math.min(100, funding.securedPct)}%` }}
            title={`Secured: M${funding.securedPct}%`}
          />
          <div
            className="bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] h-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100 - funding.securedPct, funding.pendingPct))}%` }}
            title={`Pending: M${funding.pendingPct}%`}
          />
        </div>
        <div className={clsx('flex items-center justify-between text-[11px] mt-0.5', isLight ? 'text-black' : 'text-slate-400')}>
          <div className="flex items-center gap-1.5 font-mono font-bold">
            <span className={isLight ? 'text-black' : 'text-slate-200'}>
              {formatInr(funding.securedInr)}
            </span>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={handleOpenBudgetEdit}
              className={clsx(
                'group flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors',
                isLight
                  ? 'text-black hover:bg-slate-100 border border-transparent hover:border-black'
                  : 'text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700'
              )}
              title="Click to edit or adjust target budget/amount"
            >
              <span>{formatInr(targetBudget)}</span>
              <Edit3 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 text-[#B45309]" />
            </button>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {funding.pendingPct > 0 && (
              <span className={isLight ? 'text-amber-800 font-bold' : 'text-amber-300 font-semibold'}>
                +M{funding.pendingPct}% pend
              </span>
            )}
            {funding.declinedCount > 0 && (
              <span className={isLight ? 'text-black font-semibold' : 'text-slate-500'}>
                • {funding.declinedCount} decl
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Target Budget Edit Modal */}
      {isEditingBudget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingBudget(false);
          }}
        >
          <div
            className={clsx(
              'w-full max-w-sm rounded-lg border p-5 shadow-2xl flex flex-col gap-4 font-sans',
              isLight
                ? 'bg-white border-black text-black'
                : 'bg-slate-900 border-slate-700 text-slate-100'
            )}
          >
            <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold">Edit Target Budget</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Target Budget Amount (INR ₹)
              </label>
              <input
                type="number"
                min="0"
                step="100000"
                autoFocus
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 text-sm font-mono rounded border outline-none font-bold',
                  isLight
                    ? 'bg-slate-50 border-black text-black focus:ring-1 focus:ring-black'
                    : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-emerald-400'
                )}
                placeholder="Enter amount (e.g. 15000000)"
              />
              <div className="text-[11px] font-mono text-[#B45309]">
                Formatted: {formatInr(parseFloat(budgetInput) || 0)}
              </div>
            </div>

            {/* Quick Adjustment Increment/Decrement Buttons */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Quick Adjustments
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdjustBudget(1000000)}
                  className="px-2 py-1 text-[11px] font-mono rounded border hover:bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  +10 Lakh
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustBudget(5000000)}
                  className="px-2 py-1 text-[11px] font-mono rounded border hover:bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  +50 Lakh
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustBudget(-1000000)}
                  className="px-2 py-1 text-[11px] font-mono rounded border hover:bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  -10 Lakh
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetInput('0')}
                  className="px-2 py-1 text-[11px] font-mono rounded border hover:bg-slate-500/10 border-slate-500/40 text-slate-400 cursor-pointer"
                >
                  Zero ₹0
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBudget}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow"
              >
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Direct White Relationships - Neon Cyan Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[170px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.25)] text-black'
            : 'bg-slate-900/90 border-cyan-400/50 shadow-[0_0_14px_rgba(6,182,212,0.2)] hover:border-cyan-300 hover:shadow-[0_0_18px_rgba(6,182,212,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <Link2 className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] shrink-0" />
            Direct Relations
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all',
              isLight
                ? 'bg-cyan-50 border-cyan-500 text-cyan-700 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]'
            )}
          >
            {directRel.confirmationRatePct}%
          </span>
        </div>
        {/* Neon Confirmation Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)] h-full transition-all duration-300"
            style={{ width: `${Math.min(100, directRel.confirmationRatePct)}%` }}
            title={`Confirmation Rate: ${directRel.confirmationRatePct}%`}
          />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={clsx('text-base font-bold', isLight ? 'text-black' : 'text-slate-100')}>
              {directRel.confirmedCount}
            </span>
            <span className={clsx('text-[11px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>confirmed</span>
          </div>
          <div className={clsx('flex items-center gap-1.5 text-[10px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            <span>{directRel.pendingCount} pend</span>
            <span>•</span>
            <span className={isLight ? 'text-black font-semibold' : 'text-slate-500'}>{directRel.declinedCount} decl</span>
          </div>
        </div>
      </div>

      {/* 3. Confirmed Yellow Bridges - Neon Yellow Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[140px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.25)] text-black'
            : 'bg-slate-900/90 border-yellow-400/50 shadow-[0_0_14px_rgba(250,204,21,0.2)] hover:border-yellow-300 hover:shadow-[0_0_18px_rgba(250,204,21,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <GitFork className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] shrink-0" />
            Yellow Bridges
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all',
              isLight
                ? 'bg-yellow-50 border-yellow-500 text-yellow-800 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                : 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.4)]'
            )}
          >
            Active
          </span>
        </div>
        {/* Neon Bridge Activity Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.85)] h-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (yellowBridges.confirmedCount + yellowBridges.pendingCount) > 0 ? (yellowBridges.confirmedCount / (yellowBridges.confirmedCount + yellowBridges.pendingCount)) * 100 : 0)}%`,
            }}
            title={`Active Bridges: ${yellowBridges.confirmedCount}`}
          />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={clsx('text-base font-bold', isLight ? 'text-black' : 'text-slate-100')}>
              {yellowBridges.confirmedCount}
            </span>
            <span className={clsx('text-[11px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>active bridges</span>
          </div>
          <div className={clsx('text-[10px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            {yellowBridges.pendingCount} pend
          </div>
        </div>
      </div>

      {/* 4. Owned Conversions - Neon Sky Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[150px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.25)] text-black'
            : 'bg-slate-900/90 border-sky-400/50 shadow-[0_0_14px_rgba(56,189,248,0.2)] hover:border-sky-300 hover:shadow-[0_0_18px_rgba(56,189,248,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <CheckCircle2 className="w-4 h-4 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)] shrink-0" />
            Conversions
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all',
              isLight
                ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-[0_0_8px_rgba(14,165,233,0.3)]'
                : 'bg-sky-500/20 border-sky-400/60 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
            )}
          >
            {conversions.conversionRatePct}%
          </span>
        </div>
        {/* Neon Conversion Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)] h-full transition-all duration-300"
            style={{ width: `${Math.min(100, conversions.conversionRatePct)}%` }}
            title={`Conversion Rate: ${conversions.conversionRatePct}%`}
          />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={clsx('text-base font-bold', isLight ? 'text-black' : 'text-slate-100')}>
              {conversions.convertedNodeCount}
            </span>
            <span className={clsx('text-[11px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>
              / {conversions.referredNodeCount} referred
            </span>
          </div>
          <div className={clsx('text-[10px] truncate', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            receptive partner conversion
          </div>
        </div>
      </div>

      {/* 5. Multi-Thread Targets - Neon Amber Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[200px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)] text-black'
            : 'bg-slate-900/90 border-amber-400/50 shadow-[0_0_14px_rgba(251,191,36,0.2)] hover:border-amber-300 hover:shadow-[0_0_18px_rgba(251,191,36,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <Layers className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] shrink-0" />
            Multi-Thread
          </span>
          <div className="flex items-center gap-1">
            <span
              className={clsx(
                'px-1 py-0.5 rounded text-[10px] font-semibold border transition-all',
                isLight
                  ? 'bg-amber-100 text-amber-950 border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.25)]'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.35)]'
              )}
              title="2-Thread Targets"
            >
              {multiThread.doubleThreadCount}x 2T
            </span>
            <span
              className={clsx(
                'px-1 py-0.5 rounded text-[10px] font-semibold border transition-all',
                isLight
                  ? 'bg-amber-200 text-amber-950 border-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                  : 'bg-amber-400/30 text-amber-200 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
              )}
              title="3-Thread Targets"
            >
              {multiThread.tripleThreadCount}x 3T
            </span>
            <span
              className={clsx(
                'px-1 py-0.5 rounded text-[10px] font-semibold border transition-all',
                isLight
                  ? 'bg-yellow-200 text-yellow-950 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]'
                  : 'bg-yellow-400/40 text-yellow-100 border-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.75)]'
              )}
              title="4+-Thread Targets"
            >
              {multiThread.quadPlusThreadCount}x 4+
            </span>
          </div>
        </div>
        {/* Neon Triangulation Spectrum Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)] h-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (multiThread.doubleThreadCount + multiThread.tripleThreadCount * 2 + multiThread.quadPlusThreadCount * 3) * 15)}%`,
            }}
            title="Triangulated Targets Level"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <div className={clsx('text-xs font-semibold truncate max-w-[150px]', isLight ? 'text-black' : 'text-slate-200')}>
            {multiThread.triplePlusNames.length > 0
              ? multiThread.triplePlusNames.join(', ')
              : 'No 3T+ targets'}
          </div>
          <div className={clsx('text-[10px] truncate', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            triangulated targets
          </div>
        </div>
      </div>

      {/* 6. Top Amplifier - Neon Fuchsia Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[170px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isLight
            ? 'bg-white border-2 border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.25)] text-black'
            : 'bg-slate-900/90 border-fuchsia-400/50 shadow-[0_0_14px_rgba(232,121,249,0.2)] hover:border-fuchsia-300 hover:shadow-[0_0_18px_rgba(232,121,249,0.35)] text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <Megaphone className="w-4 h-4 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.9)] shrink-0" />
            Top Amplifier
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all',
              isLight
                ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-800 shadow-[0_0_8px_rgba(217,70,239,0.3)]'
                : 'bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,0.4)]'
            )}
          >
            Reach {topAmp.downstreamReachCount}
          </span>
        </div>
        {/* Neon Amplifier Reach Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className="bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.85)] h-full transition-all duration-300"
            style={{ width: `${Math.min(100, topAmp.downstreamReachCount * 25)}%` }}
            title={`Downstream Reach: ${topAmp.downstreamReachCount}`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <div
            className={clsx('text-xs font-bold truncate max-w-[110px]', isLight ? 'text-purple-950' : 'text-slate-100')}
            title={topAmp.entityName}
          >
            {topAmp.entityName}
          </div>
          <div className={clsx('text-[10px]', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            Direct: {topAmp.directOutDegree}
          </div>
        </div>
      </div>

      {/* 7. Bridge Concentration Risk - Neon Rose / Emerald Accent */}
      <div
        className={clsx(
          isVertical ? 'w-full flex-none' : 'flex-1 min-w-[180px]',
          'rounded-xl px-3 py-2 flex flex-col justify-between transition-all duration-200 border',
          isRiskHigh
            ? isLight
              ? 'border-2 border-rose-600 bg-white text-black shadow-[0_0_10px_rgba(244,63,94,0.3)]'
              : 'border-rose-500 bg-rose-950/30 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.4)] hover:shadow-[0_0_22px_rgba(244,63,94,0.6)]'
            : isLight
            ? 'bg-white border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)] text-black'
            : 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.2)] hover:border-emerald-400 text-slate-300'
        )}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={clsx('flex items-center gap-1.5 font-semibold', isLight ? 'text-black' : 'text-slate-300')}>
            <AlertTriangle
              className={clsx(
                'w-4 h-4 shrink-0 transition-all',
                isRiskHigh
                  ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.9)]'
                  : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]'
              )}
            />
            Concentration Risk
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all',
              isRiskHigh
                ? isLight
                  ? 'bg-rose-50 text-rose-700 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  : 'bg-rose-500/30 text-rose-200 border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]'
                : isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
            )}
          >
            {concentration.concentrationPct}%
          </span>
        </div>
        {/* Neon Risk Gauge Bar Graph */}
        <div className={clsx('w-full h-1.5 rounded-full overflow-hidden flex my-1', isLight ? 'bg-slate-100 border border-black' : 'bg-slate-800/90 border border-slate-700/60')}>
          <div
            className={clsx(
              'h-full transition-all duration-300',
              isRiskHigh
                ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]'
                : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]'
            )}
            style={{ width: `${Math.min(100, concentration.concentrationPct)}%` }}
            title={`Concentration Risk: ${concentration.concentrationPct}%`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <div
            className={clsx(
              'text-xs font-semibold truncate max-w-[120px]',
              isRiskHigh ? (isLight ? 'text-black font-bold' : 'text-rose-200') : (isLight ? 'text-black font-bold' : 'text-slate-100')
            )}
            title={concentration.bridgeEntityName}
          >
            {concentration.bridgeEntityName}
          </div>
          <div className={clsx('text-[10px] truncate', isLight ? 'text-black font-medium' : 'text-slate-400')}>
            {isRiskHigh ? 'Critical risk' : 'Balanced'}
          </div>
        </div>
      </div>

      {/* Maximize Analytical Dashboard Button */}
      <div className={clsx(isVertical ? 'w-full flex-none' : 'flex-none self-center', 'flex items-center')}>
        <button
          type="button"
          onClick={toggleDashboardMaximized}
          aria-label="Maximize analytical dashboard"
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
            isLight
              ? 'bg-white hover:bg-slate-100 text-black border-2 border-black shadow-sm'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
          )}
          title="Maximize Full-Screen Analytical Dashboard (Cmd/Ctrl + Shift + D)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Maximize</span>
        </button>
      </div>
    </header>
  );
};

export default MetricsStrip;
