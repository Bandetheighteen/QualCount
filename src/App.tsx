import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { MetricsStrip } from './components/metrics/MetricsStrip';
import { ActionToolbar } from './components/toolbar/ActionToolbar';
import { PartnershipCanvas } from './components/canvas/PartnershipCanvas';
import { InspectorDrawer } from './components/inspector/InspectorDrawer';
import { RiskNotifications } from './components/notifications/RiskNotifications';
import { MaximizedDashboard } from './components/dashboard/MaximizedDashboard';
import { LegacyMenuBar } from './components/navigation/LegacyMenuBar';
import { BookIndexSidebar } from './components/navigation/BookIndexSidebar';
import { LandingPage } from './components/landing/LandingPage';
import { LoadingIndicator } from './components/common/LoadingIndicator';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { isFullscreenActive } from './utils/fullscreen';

export const App: React.FC = () => {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const selectedPlacementId = useWorkspaceStore((state) => state.selectedPlacementId);
  const selectedBranchId = useWorkspaceStore((state) => state.selectedBranchId);
  const selectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);
  const selectedBranchIds = useWorkspaceStore((state) => state.selectedBranchIds);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const theme = useWorkspaceStore((state) => state.theme);
  const highContrast = useWorkspaceStore((state) => state.highContrast);

  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const setSelection = useWorkspaceStore((state) => state.setSelection);
  const deleteBranch = useWorkspaceStore((state) => state.deleteBranch);
  const removePlacement = useWorkspaceStore((state) => state.removePlacement);
  const batchDelete = useWorkspaceStore((state) => state.batchDelete);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const setIsFullscreen = useWorkspaceStore((state) => state.setIsFullscreen);
  const init = useWorkspaceStore((state) => state.init);

  // Initialize workspace repository on mount
  useEffect(() => {
    init();
  }, [init]);

  // Synchronize light/dark class on document root for full Tailwind contrast
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    }
  }, [theme]);

  // Sync fullscreen change with store
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, [setIsFullscreen]);

  // Global keyboard shortcuts (Undo/Redo with Ctrl+Z / Ctrl+Y, Escape to deselect, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInputFocused =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // If typing in an input, do not capture canvas keyboard commands
      if (isInputFocused) return;

      // If a modal dialog is open, let modal handle its own key events
      const isModalOpen =
        typeof document !== 'undefined' &&
        Boolean(document.querySelector && document.querySelector('[role="dialog"]'));
      if (isModalOpen) return;

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Select All: Ctrl+A / Cmd+A (selects all currently visible nodes & branches)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const currentNodes = useWorkspaceStore.getState().nodes;
        const currentEdges = useWorkspaceStore.getState().edges;
        setSelection(
          currentNodes.map((n) => n.id),
          currentEdges.map((e) => e.id)
        );
        return;
      }

      if (e.key === 'Escape') {
        clearSelection();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isWorkspaceLocked) {
        if (selectedPlacementIds.length + selectedBranchIds.length > 1) {
          e.preventDefault();
          batchDelete();
        } else if (selectedBranchId) {
          e.preventDefault();
          deleteBranch(selectedBranchId);
        } else if (selectedPlacementId) {
          e.preventDefault();
          removePlacement(selectedPlacementId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedPlacementId,
    selectedBranchId,
    selectedPlacementIds,
    selectedBranchIds,
    isWorkspaceLocked,
    clearSelection,
    setSelection,
    deleteBranch,
    removePlacement,
    batchDelete,
    undo,
    redo,
  ]);

  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const dashboardPosition = useWorkspaceStore((state) => state.dashboardPosition);
  const ribbonPosition = useWorkspaceStore((state) => state.ribbonPosition);

  const appBg =
    theme === 'night'
      ? 'bg-black text-[#F4F2ED]'
      : theme === 'light'
      ? 'bg-[#FAF8F4] text-[#1C1B18]'
      : 'bg-[#0b0f17] text-[#F4F2ED]';

  const isRowLayout = dashboardPosition === 'left' || dashboardPosition === 'right';
  const isDashboardFirst = dashboardPosition === 'top' || dashboardPosition === 'left';

  const ribbonPositionClass = {
    top: 'top-3 left-3',
    bottom: 'bottom-3 left-28',
    left: 'top-16 left-3',
    right: 'top-16 right-3',
  }[ribbonPosition] || 'top-3 left-3';

  // Drag-and-drop loading disabled; standard Import / Open option is used exclusively.
  // Prevent default browser file navigation when dragging/dropping over the window.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={clsx(
        'w-screen h-screen overflow-hidden flex flex-col font-sans select-none transition-colors duration-150',
        isFullscreen && 'fixed inset-0 z-50',
        appBg,
        highContrast && 'contrast-125'
      )}
    >
      {/* 0. Persistent Top Legacy Menu Bar */}
      <LegacyMenuBar />

      {/* 1. View Routing: Landing Page Cover vs Canvas */}
      <div className={clsx('flex-1 overflow-hidden relative', activeView !== 'landing' && 'hidden')}>
        <LandingPage />
      </div>

      <div
        className={clsx(
          'flex-1 overflow-hidden flex relative min-w-0 min-h-0',
          activeView !== 'canvas' && 'hidden',
          isRowLayout ? 'flex-row' : 'flex-col'
        )}
      >
        {/* Quantitative Metrics Strip (when positioned top or left) */}
        {isDashboardFirst && <MetricsStrip />}

        {/* Interactive Workspace Area */}
        <div className="flex-1 flex flex-row relative overflow-hidden min-w-0 min-h-0">
          {/* Sibling Book Index Sidebar */}
          <BookIndexSidebar />

          {/* Canvas Viewport */}
          <main className="flex-1 relative overflow-hidden min-w-0 min-h-0">
            <PartnershipCanvas />

            {/* Floating Action Toolbar */}
            <div className={clsx('absolute z-10 pointer-events-auto', ribbonPositionClass)}>
              <ActionToolbar />
            </div>

            {/* Top-Right Overlays: Risk Alerts & Context Inspector Drawer */}
            <div
              className={clsx(
                'absolute top-3 z-20 pointer-events-auto flex flex-col items-end gap-2.5 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin',
                ribbonPosition === 'right' ? 'right-16' : 'right-3'
              )}
            >
              <RiskNotifications />
              <InspectorDrawer />
            </div>
          </main>
        </div>

        {/* Quantitative Metrics Strip (when positioned bottom or right) */}
        {!isDashboardFirst && <MetricsStrip />}
      </div>

      {/* Maximized Full-Screen Analytical Dashboard Overlay (Cmd/Ctrl + Shift + D) */}
      <MaximizedDashboard />

      {/* Modern High-Performance Network Building & Dataset Loading Indicator */}
      <LoadingIndicator />
    </div>
  );
};

export default App;
