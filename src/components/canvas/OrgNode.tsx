import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { Crown, Network, ArrowDownLeft, ArrowUpRight, Coins, Lock, Users, User } from 'lucide-react';
import { clsx } from 'clsx';
import type { OrgFlowNode } from '../../store/useWorkspaceStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export interface MultiThreadBadgeInfo {
  label: string;
  badgeClass: string;
  count: number;
}

/**
 * Returns multi-thread badge configuration based on confirmed yellow in-degree.
 * Strictly adheres to QualCount triangulation thresholds:
 * - yellowInDegree === 2: "2-Thread"
 * - yellowInDegree === 3: "Triple-Thread (3)"
 * - yellowInDegree >= 4: "Quad-Thread ({count})"
 * - yellowInDegree < 2: null
 */
export function getMultiThreadBadge(yellowInDegree: number): MultiThreadBadgeInfo | null {
  if (yellowInDegree < 2) return null;
  if (yellowInDegree === 2) {
    return {
      label: '2-Thread',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      count: 2,
    };
  }
  if (yellowInDegree === 3) {
    return {
      label: 'Triple-Thread (3)',
      badgeClass:
        'bg-amber-400/25 text-amber-200 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse',
      count: 3,
    };
  }
  return {
    label: `Quad-Thread (${yellowInDegree})`,
    badgeClass:
      'bg-yellow-400/30 text-yellow-100 border-yellow-300 shadow-[0_0_16px_rgba(234,179,8,0.7)]',
    count: yellowInDegree,
  };
}

const CATEGORY_STYLES: Record<string, string> = {
  ngo: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  csr: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  government: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  institution: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  community: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  other: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const CATEGORY_STYLES_LIGHT: Record<string, string> = {
  ngo: 'bg-sky-100 text-sky-900 border-sky-400 font-bold',
  csr: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
  government: 'bg-amber-100 text-amber-900 border-amber-500 font-bold',
  institution: 'bg-purple-100 text-purple-900 border-purple-400 font-bold',
  community: 'bg-rose-100 text-rose-900 border-rose-400 font-bold',
  other: 'bg-[#DDD6C8] text-[#1C1B18] border-[#BEB5A4] font-bold',
};

export const OrgNode: React.FC<NodeProps<OrgFlowNode>> = ({ data, selected }) => {
  const { entity, placement, yellowInDegree, selected: isDataSelected, stats } = data;
  const isSelected = selected || isDataSelected;
  const isRootNgo = placement?.isRootNgo ?? false;

  const [isHovered, setIsHovered] = useState(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const updateNodeInternals = useUpdateNodeInternals();
  const dragConnectEnabled = useWorkspaceStore((state) => state.dragConnectEnabled);
  const connectingNodeId = useWorkspaceStore((state) => state.connectingNodeId);
  const selectPlacement = useWorkspaceStore((state) => state.selectPlacement);
  const enterIsolationMode = useWorkspaceStore((state) => state.enterIsolationMode);
  const sectors = useWorkspaceStore((state) => state.sectors);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const flashingPlacementId = useWorkspaceStore((state) => state.flashingPlacementId);
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const currentTheme = useWorkspaceStore.getState().theme ?? storeTheme;
  const theme = data?.theme || currentTheme;
  const isLightMode = theme === 'light';
  const isFlashing = Boolean(placement?.placementId && flashingPlacementId === placement.placementId);

  const isConnectingThisNode = connectingNodeId === placement?.placementId;
  const showExpanded = isHovered || isConnectingThisNode;

  // React Flow handle bounds re-calculation on hover/expansion across animation frames
  useEffect(() => {
    if (!placement?.placementId) return;
    const pId = placement.placementId;
    updateNodeInternals(pId);

    let rafId: number;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = 240;

    const step = (now: number) => {
      updateNodeInternals(pId);
      if (now - startTime < duration) {
        if (typeof requestAnimationFrame !== 'undefined') {
          rafId = requestAnimationFrame(step);
        }
      } else {
        updateNodeInternals(pId);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(step);
    } else {
      const t = setTimeout(() => updateNodeInternals(pId), 210);
      return () => clearTimeout(t);
    }

    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [showExpanded, placement?.placementId, updateNodeInternals]);

  const category = entity?.category || 'other';
  const categoryItem = sectors.find((s) => s.id === category);
  const categoryLabel = categoryItem?.label || category;
  const categoryStyles = isLightMode ? CATEGORY_STYLES_LIGHT : CATEGORY_STYLES;
  const categoryStyle =
    categoryStyles[category] ||
    (isLightMode
      ? 'bg-indigo-100 text-indigo-900 border-indigo-400 font-bold'
      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30');
  const threadBadge = getMultiThreadBadge(yellowInDegree);
  const allContacts = entity?.pointsOfContact || [];
  const partnerContacts = allContacts.filter((c) => !c.isInternal);
  const contactsToDisplay = partnerContacts.length > 0 ? partnerContacts : allContacts;
  const primaryPoc = contactsToDisplay[0];
  const pocCount = allContacts.length;

  // Diagram alignment: source/target handle orientation
  const alignment = data.diagramAlignment || 'bottomToTop';
  const sourcePosition =
    alignment === 'leftToRight'
      ? Position.Right
      : alignment === 'rightToLeft'
      ? Position.Left
      : alignment === 'topToBottom'
      ? Position.Bottom
      : Position.Top;

  const targetPosition =
    alignment === 'leftToRight'
      ? Position.Left
      : alignment === 'rightToLeft'
      ? Position.Right
      : alignment === 'topToBottom'
      ? Position.Top
      : Position.Bottom;

  const isHorizontal = alignment === 'leftToRight' || alignment === 'rightToLeft';

  // Handle offset styling based on orientation
  const sourceGreenStyle = isHorizontal
    ? {
        top: showExpanded ? 'calc(50% - 20px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'top 0.2s ease, opacity 0.15s ease',
      }
    : {
        left: showExpanded ? 'calc(50% - 24px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'left 0.2s ease, opacity 0.15s ease',
      };

  const sourceYellowStyle = isHorizontal
    ? {
        top: '50%',
        opacity: 1,
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      }
    : {
        left: '50%',
        opacity: 1,
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      };

  const sourceWhiteStyle = isHorizontal
    ? {
        top: showExpanded ? 'calc(50% + 20px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'top 0.2s ease, opacity 0.15s ease',
      }
    : {
        left: showExpanded ? 'calc(50% + 24px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'left 0.2s ease, opacity 0.15s ease',
      };

  const targetGreenStyle = isHorizontal
    ? {
        top: showExpanded ? 'calc(50% - 20px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'top 0.2s ease, opacity 0.15s ease',
      }
    : {
        left: showExpanded ? 'calc(50% - 24px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'left 0.2s ease, opacity 0.15s ease',
      };

  const targetYellowStyle = isHorizontal
    ? {
        top: '50%',
        opacity: 1,
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      }
    : {
        left: '50%',
        opacity: 1,
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      };

  const targetWhiteStyle = isHorizontal
    ? {
        top: showExpanded ? 'calc(50% + 20px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'top 0.2s ease, opacity 0.15s ease',
      }
    : {
        left: showExpanded ? 'calc(50% + 24px)' : '50%',
        opacity: showExpanded ? 1 : 0,
        pointerEvents: (showExpanded ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'left 0.2s ease, opacity 0.15s ease',
      };

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={(e) => {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (pointerDownPosRef.current) {
            const dist = Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y);
            pointerDownPosRef.current = null;
            if (dist > 5) {
              // Drag release: do not trigger single click selection collapse
              return;
            }
          }
          if (placement?.placementId) {
            const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
            selectPlacement(placement.placementId, isMulti);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (placement?.placementId) {
            selectPlacement(placement.placementId);
            enterIsolationMode('node', placement.placementId);
          }
        }}
        className={clsx(
          'group relative w-[190px] min-h-[76px] rounded-[6px] p-2.5 select-none transition-all duration-150',
          isLightMode
            ? 'bg-[#EDE8DE] border border-[#5A554C] text-[#1C1B18] shadow-[0_2px_6px_rgba(28,27,24,0.08)]'
            : 'bg-[#1E2228] border border-[#2D333B] text-[#F4F2ED] shadow-sm',
          data.isDimmed && 'opacity-25 scale-95 transition-all duration-300',
          data.isIsolated && 'ring-2 ring-sky-500 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] z-30',
          isFlashing
            ? isLightMode
              ? 'node-flash-active-light ring-4 ring-amber-500 border-amber-600 z-30 relative'
              : 'node-flash-active-dark ring-4 ring-amber-400 border-amber-300 z-30 relative'
            : isSelected
            ? isLightMode
              ? 'ring-2 ring-[#1C1B18] border-[#1C1B18] shadow-md'
              : 'ring-2 ring-[#BEB5A4] border-[#BEB5A4] shadow-md'
            : isRootNgo
            ? isLightMode
              ? 'border-2 border-amber-800 shadow-md'
              : 'border-amber-600/70 shadow-sm'
            : isLightMode
            ? 'hover:border-[#1C1B18] hover:shadow-md'
            : 'hover:border-slate-500'
        )}
      >
        {/* Outgoing handles: Green, Yellow, White */}
        {/* 1. Green Handle */}
        <Handle
          type="source"
          position={sourcePosition}
          id="source-green"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={sourceGreenStyle}
          className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.7)] hover:!scale-125 transition-transform"
          title="Connect Green Funding Branch"
        />

        {/* 2. Yellow Handle (Center - single dot when unhovered, yellow when expanded) */}
        <Handle
          type="source"
          position={sourcePosition}
          id="source-yellow"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={sourceYellowStyle}
          className={clsx(
            '!w-2.5 !h-2.5 !border-2 !border-slate-900 transition-all',
            showExpanded
              ? '!bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)] hover:!scale-125'
              : isLightMode
              ? '!bg-slate-700 group-hover:!bg-sky-500'
              : '!bg-slate-400 group-hover:!bg-sky-400'
          )}
          title={showExpanded ? 'Connect Yellow Bridge Branch' : undefined}
        />

        {/* 3. White Handle (In light mode turns black) */}
        <Handle
          type="source"
          position={sourcePosition}
          id="source-white"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={sourceWhiteStyle}
          className={clsx(
            '!w-2.5 !h-2.5 !border-2 hover:!scale-125 transition-transform',
            isLightMode
              ? '!bg-slate-900 !border-slate-300 shadow-[0_0_8px_rgba(0,0,0,0.6)]'
              : '!bg-white !border-slate-900 shadow-[0_0_8px_rgba(255,255,255,0.7)]'
          )}
          title="Connect White Direct Working Branch"
        />

        {/* Card Header: Category, POC Logo Button & Indicators */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span
            className={clsx(
              'text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border truncate max-w-[100px]',
              categoryStyle
            )}
            title={categoryLabel}
          >
            {categoryLabel}
          </span>

          <div className="flex items-center gap-1 relative">
            {/* Contact Person Name Icon Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (placement?.placementId) {
                  const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                  selectPlacement(placement.placementId, isMulti);
                }
              }}
              title={
                primaryPoc
                  ? `Point of Contact: ${primaryPoc.name}${primaryPoc.designation ? ` (${primaryPoc.designation})` : ''} · Click to inspect in side panel`
                  : 'Point of Contact · Click to manage in side panel'
              }
              aria-label={
                primaryPoc
                  ? `Point of contact: ${primaryPoc.name}`
                  : 'Point of contact'
              }
              className={clsx(
                'flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer',
                isSelected
                  ? isLightMode
                    ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                    : 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                  : pocCount > 0
                  ? isLightMode
                    ? 'bg-sky-100 text-sky-900 border-sky-400 hover:bg-sky-200'
                    : 'bg-sky-500/20 text-sky-400 border-sky-500/40 hover:bg-sky-500/30'
                  : isLightMode
                  ? 'bg-[#E5E0D4] text-[#5A554C] border-[#BEB5A4] hover:text-[#1C1B18] hover:bg-[#DDD6C8]'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700'
              )}
            >
              <User className={clsx('w-2.5 h-2.5 shrink-0', isLightMode ? 'text-sky-700' : 'text-sky-400')} />
              {primaryPoc ? (
                <span className="truncate max-w-[70px]">{primaryPoc.name.split(' ')[0]}</span>
              ) : (
                <span>POC</span>
              )}
            </button>

            {(data.isLocked || isWorkspaceLocked) && (
              <span
                className={clsx(
                  'flex items-center gap-0.5 text-[9px] font-bold tracking-wider uppercase px-1 py-0.5 rounded border',
                  isLightMode
                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                    : 'bg-slate-800 text-amber-400 border-amber-500/40'
                )}
                title="Locked"
              >
                <Lock className="w-2.5 h-2.5" />
              </span>
            )}

            {entity?.importedFrom && (
              <span
                className="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.2 rounded bg-[#E8F0FE] text-[#174EA6] border border-[#AECBFA] truncate max-w-[110px]"
                title={`Imported from: ${entity.importedFrom.workspaceName} (${entity.importedFrom.workbookTitle || 'Workspace'})`}
              >
                From: {entity.importedFrom.workspaceName}
              </span>
            )}

            {Boolean(data.siblingWorkbookCount && data.siblingWorkbookCount > 1) && (
              <span
                className="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.2 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] cursor-pointer"
                title={`Present in ${data.siblingWorkbookCount} sibling workbooks: ${data.siblingWorkbookTitles?.join(', ')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  useWorkspaceStore.getState().setBookIndexOpen(true);
                }}
              >
                {data.siblingWorkbookCount} Workbooks
              </span>
            )}

            {isRootNgo && (
              <span
                className={clsx(
                  'flex items-center gap-0.5 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border',
                  isLightMode
                    ? 'bg-amber-100 text-amber-900 border-amber-500 shadow-xs'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                )}
              >
                <Crown className={clsx('w-2.5 h-2.5', isLightMode ? 'text-amber-800' : 'text-amber-400')} />
                ROOT
              </span>
            )}
          </div>
        </div>

        {/* Entity Name */}
        <div
          className={clsx(
            'font-semibold text-xs truncate',
            isLightMode ? 'text-[#1C1B18]' : 'text-slate-100'
          )}
          title={entity?.name || 'Unknown Entity'}
        >
          {entity?.name || 'Unknown Entity'}
        </div>

        {/* Contact who is going to get contacted in that organization */}
        {primaryPoc ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (placement?.placementId) {
                const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                selectPlacement(placement.placementId, isMulti);
              }
            }}
            className={clsx(
              'flex items-center gap-1 text-[10px] truncate mt-0.5 font-medium transition-colors cursor-pointer',
              isLightMode ? 'text-sky-900' : 'text-sky-300',
              isSelected && (isLightMode ? 'font-semibold text-sky-950' : 'font-semibold text-sky-400')
            )}
            title={`Point of Contact: ${primaryPoc.name}${primaryPoc.designation ? ` (${primaryPoc.designation})` : ''} · Click to inspect in side panel`}
          >
            <User className={clsx('w-2.5 h-2.5 shrink-0', isLightMode ? 'text-sky-700' : 'text-sky-400')} />
            <span className="truncate font-semibold">{primaryPoc.name}</span>
            {primaryPoc.designation && (
              <span className={clsx('text-[9px] truncate', isLightMode ? 'text-[#5A554C]' : 'text-slate-400 opacity-75')}>
                · {primaryPoc.designation}
              </span>
            )}
          </div>
        ) : isSelected ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (placement?.placementId) {
                const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                selectPlacement(placement.placementId, isMulti);
              }
            }}
            className={clsx(
              'flex items-center gap-1 text-[9px] italic mt-0.5 cursor-pointer',
              isLightMode ? 'text-[#5A554C]' : 'text-slate-400'
            )}
            title="Click to add point of contact in side panel"
          >
            <User className="w-2.5 h-2.5 shrink-0 opacity-50" />
            <span>No contact listed</span>
          </div>
        ) : null}

        {/* Multi-Thread Triangulation Badge & Footer Details */}
        <div className="mt-1 flex items-center justify-between gap-1 text-[10px]">
          {threadBadge ? (
            <span
              className={clsx(
                'flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border',
                isLightMode
                  ? yellowInDegree === 2
                    ? 'bg-amber-100 text-amber-950 border-amber-500 font-bold'
                    : yellowInDegree === 3
                    ? 'bg-amber-200 text-amber-950 border-amber-500 font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse'
                    : 'bg-yellow-200 text-yellow-950 border-yellow-500 font-bold shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                  : threadBadge.badgeClass
              )}
              title={`Triangulated by ${threadBadge.count} confirmed yellow bridges`}
            >
              <Network className={clsx('w-2.5 h-2.5', isLightMode ? 'text-amber-800' : undefined)} />
              {threadBadge.label}
            </span>
          ) : (
            <span
              className={clsx(
                'text-[10px] truncate max-w-[170px]',
                isLightMode ? 'text-[#5A554C]' : 'text-slate-500'
              )}
              title={entity?.globalNotes}
            >
              {entity?.globalNotes || 'Direct contact'}
            </span>
          )}
        </div>

        {/* Hover Metrics Tooltip (CANV-02) */}
        <div
          role="tooltip"
          className={clsx(
            'absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[220px] p-2.5 rounded-xl z-50 text-[10px] backdrop-blur-md transition-all duration-150',
            isLightMode
              ? 'bg-[#FAF8F4]/98 border border-[#5A554C] shadow-2xl text-[#1C1B18]'
              : 'bg-slate-950/95 border border-slate-700/80 shadow-2xl text-slate-300',
            'pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100'
          )}
        >
          <div className={clsx('flex items-center justify-between gap-1 mb-1.5 pb-1 border-b', isLightMode ? 'border-[#DDD6C8]' : 'border-slate-800')}>
            <span className={clsx('font-bold truncate max-w-[140px] text-[11px]', isLightMode ? 'text-[#1C1B18]' : 'text-slate-100')}>
              {entity?.name || 'Unknown Entity'}
            </span>
            <span className={clsx('text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded border', categoryStyle)}>
              {category}
            </span>
          </div>

          <div className="space-y-1">
            {/* Triangulation Metric */}
            <div className="flex items-center justify-between">
              <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                <Network className={clsx('w-2.5 h-2.5', isLightMode ? 'text-amber-700' : 'text-amber-400')} />
                Triangulation:
              </span>
              <span className={clsx('font-semibold', yellowInDegree >= 2 ? (isLightMode ? 'text-amber-800' : 'text-amber-300') : (isLightMode ? 'text-[#8A8377]' : 'text-slate-400'))}>
                {yellowInDegree >= 2 ? `${yellowInDegree} Bridges` : 'None'}
              </span>
            </div>

            {/* Funding Metric (if applicable) */}
            {(stats?.incomingGreenFundingPct ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                  <Coins className={clsx('w-2.5 h-2.5', isLightMode ? 'text-emerald-700' : 'text-emerald-400')} />
                  Funding:
                </span>
                <span className={clsx('font-semibold font-mono', isLightMode ? 'text-emerald-800' : 'text-emerald-300')}>
                  M{stats?.incomingGreenFundingPct}%
                </span>
              </div>
            )}

            {/* Incoming Connections Breakdown */}
            <div className="flex items-center justify-between">
              <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                <ArrowDownLeft className={clsx('w-2.5 h-2.5', isLightMode ? 'text-sky-700' : 'text-sky-400')} />
                Incoming:
              </span>
              <span className={isLightMode ? 'text-[#1C1B18]' : 'text-slate-200'}>
                {stats?.incomingConfirmed ?? 0} confirmed · {stats?.incomingPending ?? 0} pending
              </span>
            </div>

            {/* Outgoing Connections */}
            <div className="flex items-center justify-between">
              <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                <ArrowUpRight className={clsx('w-2.5 h-2.5', isLightMode ? 'text-purple-700' : 'text-purple-400')} />
                Outgoing:
              </span>
              <span className={isLightMode ? 'text-[#1C1B18]' : 'text-slate-200'}>
                {stats?.outgoingTotal ?? 0} {stats?.outgoingTotal === 1 ? 'branch' : 'branches'}
              </span>
            </div>

            {/* Responsible Person / Team From Our Side (Internal Lead) */}
            {entity?.internalLead && (
              <div className={clsx('flex items-center justify-between pt-0.5 border-t', isLightMode ? 'border-[#DDD6C8]' : 'border-slate-800')}>
                <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                  <Users className={clsx('w-2.5 h-2.5', isLightMode ? 'text-emerald-700' : 'text-emerald-400')} />
                  Our Lead:
                </span>
                <span className={clsx('font-semibold truncate max-w-[130px]', isLightMode ? 'text-emerald-800' : 'text-emerald-300')} title={entity.internalLead}>
                  {entity.internalLead}
                </span>
              </div>
            )}

            {/* Point of Contact to reach */}
            {primaryPoc && (
              <div className={clsx('flex items-center justify-between pt-0.5 border-t', isLightMode ? 'border-[#DDD6C8]' : 'border-slate-800')}>
                <span className={clsx('flex items-center gap-1', isLightMode ? 'text-[#5A554C]' : 'text-slate-400')}>
                  <User className={clsx('w-2.5 h-2.5', isLightMode ? 'text-sky-700' : 'text-sky-400')} />
                  Contact:
                </span>
                <span className={clsx('font-semibold truncate max-w-[130px]', isLightMode ? 'text-sky-800' : 'text-sky-300')} title={`${primaryPoc.name}${primaryPoc.designation ? ` (${primaryPoc.designation})` : ''}`}>
                  {primaryPoc.name}
                </span>
              </div>
            )}
          </div>

          {/* Notes preview */}
          {entity?.globalNotes && (
            <div className={clsx('mt-1.5 pt-1 border-t text-[9px] italic line-clamp-2', isLightMode ? 'border-[#DDD6C8] text-[#5A554C]' : 'border-slate-800 text-slate-400')}>
              {entity.globalNotes}
            </div>
          )}
        </div>

        {/* Incoming Target Handles: Green, Yellow, White */}
        {/* 1. Target Green Handle */}
        <Handle
          type="target"
          position={targetPosition}
          id="target-green"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={targetGreenStyle}
          className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.7)] hover:!scale-125 transition-transform"
          title="Target for Green Funding Branch"
        />

        {/* 2. Target Yellow Handle (Center - single dot when unhovered, yellow when expanded) */}
        <Handle
          type="target"
          position={targetPosition}
          id="target-yellow"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={targetYellowStyle}
          className={clsx(
            '!w-2.5 !h-2.5 !border-2 !border-slate-900 transition-all',
            showExpanded
              ? '!bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)] hover:!scale-125'
              : isLightMode
              ? '!bg-slate-700 group-hover:!bg-sky-500'
              : '!bg-slate-400 group-hover:!bg-sky-400'
          )}
          title={showExpanded ? 'Target for Yellow Bridge Branch' : undefined}
        />

        {/* 3. Target White Handle (In light mode turns black) */}
        <Handle
          type="target"
          position={targetPosition}
          id="target-white"
          isConnectable={dragConnectEnabled}
          isConnectableStart={dragConnectEnabled}
          isConnectableEnd={dragConnectEnabled}
          style={targetWhiteStyle}
          className={clsx(
            '!w-2.5 !h-2.5 !border-2 hover:!scale-125 transition-transform',
            isLightMode
              ? '!bg-slate-900 !border-slate-300 shadow-[0_0_8px_rgba(0,0,0,0.6)]'
              : '!bg-white !border-slate-900 shadow-[0_0_8px_rgba(255,255,255,0.7)]'
          )}
          title="Target for White Direct Working Branch"
        />
      </div>
    </>
  );
};

export default OrgNode;
