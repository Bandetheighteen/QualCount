import React from 'react';
import {
  X,
  Settings,
  Moon,
  Sun,
  Eye,
  Zap,
  Activity,
  Maximize2,
  Minimize2,
  ZoomIn,
  Move,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { requestFullscreenSafe, exitFullscreenSafe, isFullscreenActive } from '../../utils/fullscreen';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFitView?: () => void;
  onResetZoom?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onFitView,
  onResetZoom,
}) => {
  const theme = useWorkspaceStore((state) => state.theme);
  const highContrast = useWorkspaceStore((state) => state.highContrast);
  const animationsEnabled = useWorkspaceStore((state) => state.animationsEnabled);
  const highPerformanceMode = useWorkspaceStore((state) => state.highPerformanceMode);
  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const dashboardPosition = useWorkspaceStore((state) => state.dashboardPosition);
  const ribbonPosition = useWorkspaceStore((state) => state.ribbonPosition);
  const isRibbonPinned = useWorkspaceStore((state) => state.isRibbonPinned);
  const diagramAlignment = useWorkspaceStore((state) => state.diagramAlignment);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const deleteWorkbook = useWorkspaceStore((state) => state.deleteWorkbook);
  const activeWorkbook =
    workspace && activeWorkbookId ? workspace.workbooks[activeWorkbookId] : null;

  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const toggleHighContrast = useWorkspaceStore((state) => state.toggleHighContrast);
  const toggleAnimations = useWorkspaceStore((state) => state.toggleAnimations);
  const toggleHighPerformance = useWorkspaceStore((state) => state.toggleHighPerformance);
  const setIsFullscreen = useWorkspaceStore((state) => state.setIsFullscreen);
  const setDashboardPosition = useWorkspaceStore((state) => state.setDashboardPosition);
  const setRibbonPosition = useWorkspaceStore((state) => state.setRibbonPosition);
  const toggleRibbonPinned = useWorkspaceStore((state) => state.toggleRibbonPinned);
  const setDiagramAlignment = useWorkspaceStore((state) => state.setDiagramAlignment);
  const storeFitView = useWorkspaceStore((state) => state.fitView);
  const storeResetZoom = useWorkspaceStore((state) => state.resetZoom);

  if (!isOpen) return null;

  const handleToggleFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      const active = isFullscreenActive() || isFullscreen;
      if (!active) {
        await requestFullscreenSafe();
        setIsFullscreen(true);
      } else {
        await exitFullscreenSafe();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('[SettingsModal] Fullscreen toggle error:', err);
      setIsFullscreen(!isFullscreen);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-5 text-xs text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-400" />
            <h2 id="settings-dialog-title" className="text-sm font-bold text-slate-100">
              Settings & Appearance
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

        {/* 1. Appearance Section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            1. Appearance
          </span>

          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <label className="text-slate-300 font-semibold mb-1">Canvas & UI Theme</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                  theme === 'light'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)] font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                )}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>White Paper</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                  theme === 'dark' || theme === 'night'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.25)] font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                )}
              >
                <Moon className="w-4 h-4 text-sky-400" />
                <span>Charcoal Matte</span>
              </button>
            </div>

            {/* High Contrast Toggle */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-850">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 font-medium">High Contrast Mode</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                onClick={toggleHighContrast}
                className={clsx(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer',
                  highContrast ? 'bg-sky-500' : 'bg-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                    highContrast ? 'translate-x-3.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Performance Section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            2. Performance
          </span>

          <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {/* Smooth Animations */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <div className="text-slate-300 font-medium">Smooth Animations</div>
                  <div className="text-[10px] text-slate-500">Fluid transitions & pulsing glows</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={animationsEnabled}
                onClick={toggleAnimations}
                className={clsx(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer',
                  animationsEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                    animationsEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* High Performance Rendering Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-850">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <div className="text-slate-300 font-medium">High Performance Mode</div>
                  <div className="text-[10px] text-slate-500">Disables SVG drop-shadow filters for fast FPS</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highPerformanceMode}
                onClick={toggleHighPerformance}
                className={clsx(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer',
                  highPerformanceMode ? 'bg-amber-500' : 'bg-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                    highPerformanceMode ? 'translate-x-3.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Window Management Section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            3. Window Management
          </span>

          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-sky-400" />
                  <span className="text-[11px]">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-sky-400" />
                  <span className="text-[11px]">Fullscreen</span>
                </>
              )}
            </button>

            {/* Fit View */}
            <button
              type="button"
              onClick={() => {
                if (onFitView) {
                  onFitView();
                } else {
                  storeFitView();
                }
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Move className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px]">Fit View</span>
            </button>

            {/* Reset Zoom */}
            <button
              type="button"
              onClick={() => {
                if (onResetZoom) {
                  onResetZoom();
                } else {
                  storeResetZoom();
                }
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4 text-amber-400" />
              <span className="text-[11px]">Reset (100%)</span>
            </button>
          </div>
        </div>

        {/* 4. Layout & Positioning Section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            4. Layout & Positioning
          </span>

          <div className="flex flex-col gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {/* Dashboard Location */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-semibold text-[11px]">Dashboard Location</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setDashboardPosition(pos)}
                    className={clsx(
                      'py-1.5 px-2 rounded-lg border text-xs capitalize font-medium transition-all cursor-pointer',
                      dashboardPosition === pos
                        ? 'border-sky-400 bg-sky-500/20 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Ribbon Location */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-850">
              <label className="text-slate-300 font-semibold text-[11px]">Toolbar Ribbon Location</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setRibbonPosition(pos)}
                    className={clsx(
                      'py-1.5 px-2 rounded-lg border text-xs capitalize font-medium transition-all cursor-pointer',
                      ribbonPosition === pos
                        ? 'border-sky-400 bg-sky-500/20 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Hide Ribbon (Office Style) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-850">
              <div>
                <div className="text-slate-300 font-medium">Auto-Hide Toolbar Ribbon</div>
                <div className="text-[10px] text-slate-500">Shrinks ribbon when idle; hover edge to expand (Office style)</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!isRibbonPinned}
                onClick={toggleRibbonPinned}
                className={clsx(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer',
                  !isRibbonPinned ? 'bg-sky-500' : 'bg-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                    !isRibbonPinned ? 'translate-x-3.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* Diagram Alignment */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-850">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold text-[11px]">Diagram Alignment</label>
                <span className="text-[10px] text-amber-400">Flexibly tidied</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'bottomToTop', label: 'Bottom to Top' },
                  { id: 'topToBottom', label: 'Top to Bottom' },
                  { id: 'leftToRight', label: 'Left to Right' },
                  { id: 'rightToLeft', label: 'Right to Left' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDiagramAlignment(item.id as any)}
                    className={clsx(
                      'py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center',
                      diagramAlignment === item.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Clicking the "Tidy Up" button will automatically reorganize the graph into this selected alignment.
              </p>
            </div>

            {/* Danger Zone: Delete Workbook */}
            <div className="flex flex-col gap-2 pt-3 border-t border-rose-900/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-rose-400 font-semibold text-xs flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Workbook</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Permanently delete "{activeWorkbook?.title || 'Current Workbook'}" and its relationship graph.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const wbTitle = activeWorkbook?.title || 'Current Workbook';
                    const confirmed = window.confirm(
                      `Are you sure you want to delete workbook "${wbTitle}"? All of its placement cards and relationship branches will be permanently removed.`
                    );
                    if (confirmed && activeWorkbookId) {
                      onClose();
                      await deleteWorkbook(activeWorkbookId);
                      const remainingCount = workspace ? Object.keys(workspace.workbooks).length - 1 : 0;
                      if (remainingCount <= 0) {
                        useWorkspaceStore.getState().setActiveView('landing');
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
                >
                  Delete Workbook
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
