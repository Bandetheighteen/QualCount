import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, useViewport, type EdgeProps } from '@xyflow/react';
import { Check, X, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import type { MultiplexFlowEdge } from '../../store/useWorkspaceStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { computeParallelBezierCurve } from '../../engine/parallelEdges';

function useSafeZoom(): number {
  try {
    const viewport = useViewport();
    return viewport.zoom || 1;
  } catch {
    return 1;
  }
}

export const MultiplexEdge: React.FC<EdgeProps<MultiplexFlowEdge>> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  style,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoom = useSafeZoom();

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      hoverTimeoutRef.current = null;
    }, 120);
  };

  const branch = data?.branch;
  const index = data?.index ?? 0;
  const total = data?.total ?? 1;
  const isReverse = data?.isReverse;
  const isSelected = selected || (data?.selected ?? false);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const isLocked = Boolean(data?.isLocked || isWorkspaceLocked);

  // Compute curved lateral Bezier path and exact label / button coordinates
  // buttonT is 0.88 to position the action buttons directly under the connected target node
  const geom = computeParallelBezierCurve(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    index,
    total,
    36,
    isReverse,
    0.88
  );

  const status = branch?.status ?? 'pending';
  const branchType = branch?.type ?? 'white';
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const currentTheme = useWorkspaceStore.getState().theme ?? storeTheme;
  const theme = data?.theme || currentTheme;
  const isLight = theme === 'light';

  let stroke = '#475569';
  let strokeWidth = 2;
  let strokeDasharray: string | undefined = undefined;
  let filter: string | undefined = undefined;
  let opacity: number | undefined = undefined;

  if (status === 'cross') {
    stroke = branchType === 'green' ? '#8FA397' : branchType === 'yellow' ? '#C2B9A7' : '#B4AEA3';
    strokeWidth = 1.5;
    strokeDasharray = '4 4';
    opacity = isLight ? 0.65 : 0.45;
  } else if (branchType === 'green') {
    if (status === 'tick') {
      stroke = isLight ? '#0F6B38' : '#34d399';
      strokeWidth = 3;
    } else {
      // pending
      stroke = '#2E7D52';
      strokeWidth = 2;
      strokeDasharray = '6 5';
    }
  } else if (branchType === 'white') {
    if (isLight) {
      if (status === 'tick') {
        stroke = '#18181B';
        strokeWidth = 3;
      } else {
        // pending
        stroke = '#475569';
        strokeWidth = 2;
        strokeDasharray = '6 5';
      }
    } else {
      if (status === 'tick') {
        stroke = '#F8FAFC';
        strokeWidth = 3;
      } else {
        // pending
        stroke = '#475569';
        strokeWidth = 2;
        strokeDasharray = '6 5';
      }
    }
  } else if (branchType === 'yellow') {
    if (status === 'tick') {
      stroke = isLight ? '#B45309' : '#FACC15';
      strokeWidth = 3;
    } else {
      // pending
      stroke = '#C2850C';
      strokeWidth = 2;
      strokeDasharray = '6 5';
    }
  }

  if (data?.isDimmed) {
    opacity = 0.15;
  } else if (data?.isIsolated) {
    strokeWidth = Math.max(strokeWidth, 3);
    filter = 'drop-shadow(0 0 10px #38bdf8)';
  } else if (isSelected) {
    filter = 'drop-shadow(0 0 8px #38bdf8)';
    strokeWidth = Math.max(strokeWidth, 2.5);
  }

  const setBranchStatus = useWorkspaceStore((state) => state.setBranchStatus);
  const enterIsolationMode = useWorkspaceStore((state) => state.enterIsolationMode);

  const handleTickClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!branch || isLocked) return;
    const nextStatus = branch.status === 'tick' ? 'pending' : 'tick';
    setBranchStatus(branch.branchId, nextStatus);
  };

  const handleCrossClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!branch || isLocked) return;
    const nextStatus = branch.status === 'cross' ? 'pending' : 'cross';
    setBranchStatus(branch.branchId, nextStatus);
  };

  const stopEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const isButtonsVisible = isSelected || isHovered;

  return (
    <>
      <g
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (branch?.branchId) {
            enterIsolationMode('branch', branch.branchId);
          }
        }}
        className="cursor-pointer"
      >
        <BaseEdge
          path={geom.path}
          style={{
            ...style,
            stroke,
            strokeWidth,
            strokeDasharray,
            filter,
            opacity,
            transition: 'stroke 0.15s ease, filter 0.15s ease',
          }}
        />
      </g>

      <EdgeLabelRenderer>
        {/* Mid-line M% Pill for funding (green) branches */}
        {branch && branch.type === 'green' && branch.valuePct !== undefined && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${geom.labelX}px,${geom.labelY}px)`,
            }}
            className="nodrag nopan pointer-events-auto"
            onClick={stopEvent}
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
          >
            <span
              className={clsx(
                'font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm select-none border transition-colors',
                status === 'cross'
                  ? isLight
                    ? 'bg-slate-200 text-black border-2 border-black line-through'
                    : 'bg-slate-800/80 text-slate-400 border-slate-600/40 line-through'
                  : isLight
                  ? 'bg-emerald-100 text-emerald-950 border-2 border-black shadow-sm font-bold'
                  : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
              )}
              title={branch.note ? `${branch.note} (M${branch.valuePct}%)` : `M${branch.valuePct}%`}
            >
              M{branch.valuePct}%
            </span>
          </div>
        )}

        {/* Note tag for non-funding branches if note exists */}
        {branch && branch.type !== 'green' && branch.note && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${geom.labelX}px,${geom.labelY}px)`,
            }}
            className="nodrag nopan pointer-events-auto"
            onClick={stopEvent}
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
          >
            <span
              className={clsx(
                'text-[9px] px-1.5 py-0.5 rounded max-w-[120px] truncate block select-none border',
                isLight
                  ? 'bg-white text-black border-2 border-black font-semibold'
                  : 'bg-slate-900/80 text-slate-400 border-slate-700/60'
              )}
              title={branch.note}
            >
              {branch.note}
            </span>
          </div>
        )}

        {/* Action Buttons directly under target node (Tick & Cross toggles) - visible on hover or selection, scaled with zoom */}
        {branch && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${geom.buttonX}px,${geom.buttonY}px) scale(${zoom * (isButtonsVisible ? 1 : 0.85)})`,
              transformOrigin: 'center center',
              zIndex: 30,
              opacity: isButtonsVisible ? 1 : 0,
              pointerEvents: isButtonsVisible ? 'auto' : 'none',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={clsx(
              'nodrag nopan pointer-events-auto flex items-center gap-1 p-1 rounded-full border shadow-xl backdrop-blur-md transition-colors',
              isLight
                ? 'bg-white border-2 border-black text-black shadow-black/15'
                : 'bg-slate-900/95 border-slate-600/80 text-slate-200',
              isButtonsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
            )}
            onClick={stopEvent}
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
          >
            {isLocked && (
              <span className="p-0.5 text-amber-400" title="Branch is locked">
                <Lock className="w-2.5 h-2.5" />
              </span>
            )}

            {/* Tick Button */}
            <button
              type="button"
              aria-label="Confirm branch"
              disabled={isLocked}
              title={
                isLocked
                  ? 'Locked: Cannot change status'
                  : status === 'tick'
                  ? 'Confirmed (click to set pending)'
                  : 'Mark confirmed (tick)'
              }
              onClick={handleTickClick}
              onPointerDown={stopEvent}
              onMouseDown={stopEvent}
              className={clsx(
                'p-1 rounded-full border transition-colors duration-150 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                status === 'tick'
                  ? isLight
                    ? 'bg-emerald-600 text-white border-2 border-black shadow-md'
                    : 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : isLight
                  ? 'bg-white text-black hover:bg-emerald-600 hover:text-white border-2 border-black'
                  : 'bg-slate-800 text-slate-400 hover:bg-emerald-600/70 hover:text-white border-slate-700'
              )}
            >
              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>

            {/* Cross Button */}
            <button
              type="button"
              aria-label="Decline branch"
              disabled={isLocked}
              title={
                isLocked
                  ? 'Locked: Cannot change status'
                  : status === 'cross'
                  ? 'Declined (click to set pending)'
                  : 'Mark declined (cross)'
              }
              onClick={handleCrossClick}
              onPointerDown={stopEvent}
              onMouseDown={stopEvent}
              className={clsx(
                'p-1 rounded-full border transition-colors duration-150 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                status === 'cross'
                  ? isLight
                    ? 'bg-rose-600 text-white border-2 border-black shadow-md'
                    : 'bg-rose-600 text-white border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  : isLight
                  ? 'bg-white text-black hover:bg-rose-600 hover:text-white border-2 border-black'
                  : 'bg-slate-800 text-slate-400 hover:bg-rose-600/70 hover:text-white border-slate-700'
              )}
            >
              <X className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>

      {/* Invisible wider hit-testing path for hovering branch */}
      <path
        d={geom.path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
};

export default MultiplexEdge;
