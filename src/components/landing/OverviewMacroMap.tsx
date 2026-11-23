import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Network,
  ArrowRight,
  Layers,
  DollarSign,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatRupeeCompact } from '../../utils/currency';
import type { WorkspaceState } from '../../types/schema';

export interface MacroNode {
  workbookId: string;
  workspaceId?: string;
  workspaceName?: string;
  title: string;
  status: 'active' | 'draft' | 'archived';
  entityCount: number;
  placementCount: number;
  targetBudgetInr: number;
  x: number;
  y: number;
}

export interface MacroEdge {
  id: string;
  sourceWbId: string;
  targetWbId: string;
  sharedEntityCount: number;
  sharedEntityNames: string[];
  relationLabel?: string;
}

export interface MacroWorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  workbooksCount: number;
  entitiesCount: number;
  state?: WorkspaceState;
}

/**
 * Computes inter-workbook and inter-workspace connections:
 * 1. Shared entity overlap count between workbook pairs.
 * 2. Explicit workbookLinks from workspace.json.
 */
export function computeMultiWorkspaceMacroGraph(
  workspaces: WorkspaceState[],
  selectedWbId: string | null = null,
  includeNeighbors = true
): { nodes: MacroNode[]; edges: MacroEdge[] } {
  // Aggregate all workbooks, placements, and entities from the provided workspaces
  const allWorkbooks: Record<string, { wb: any; wsId: string; wsName: string }> = {};
  const wbEntitiesMap: Record<string, Set<string>> = {};
  const wbPlacementsCount: Record<string, number> = {};
  const entitiesMap: Record<string, any> = {};
  const explicitLinks: Record<string, any> = {};

  for (const ws of workspaces) {
    for (const [id, ent] of Object.entries(ws.entities || {})) {
      entitiesMap[id] = ent;
    }
    for (const [id, link] of Object.entries(ws.workbookLinks || {})) {
      explicitLinks[id] = link;
    }
    const wsId = ws.workspaceId || 'default-ws';
    const wsName = ws.workspaceName || 'Default Workspace';
    for (const [wbId, wb] of Object.entries(ws.workbooks || {})) {
      allWorkbooks[wbId] = { wb, wsId, wsName };
      wbEntitiesMap[wbId] = new Set<string>();
      wbPlacementsCount[wbId] = 0;
    }
    for (const plc of Object.values(ws.placements || {})) {
      const wbId = plc.workbookId || ws.activeWorkbookId;
      if (wbId && wbEntitiesMap[wbId]) {
        wbEntitiesMap[wbId].add(plc.entityId);
        wbPlacementsCount[wbId]++;
      }
    }
  }

  // Pre-calculate inter-workbook overlaps
  const rawEdges: MacroEdge[] = [];
  const wbIds = Object.keys(allWorkbooks);

  for (let i = 0; i < wbIds.length; i++) {
    for (let j = i + 1; j < wbIds.length; j++) {
      const wbA = wbIds[i];
      const wbB = wbIds[j];
      const setA = wbEntitiesMap[wbA];
      const setB = wbEntitiesMap[wbB];
      if (!setA || !setB) continue;

      const sharedIds: string[] = [];
      for (const entId of setA) {
        if (setB.has(entId)) {
          sharedIds.push(entId);
        }
      }

      if (sharedIds.length > 0) {
        const pairKey = `${wbA}::${wbB}`;
        const sharedNames = sharedIds.map((id) => entitiesMap[id]?.name || id);
        rawEdges.push({
          id: `macro-edge-${pairKey}`,
          sourceWbId: wbA,
          targetWbId: wbB,
          sharedEntityCount: sharedIds.length,
          sharedEntityNames: sharedNames,
        });
      }
    }
  }

  // Add explicit links
  for (const [linkId, link] of Object.entries(explicitLinks)) {
    if (allWorkbooks[link.sourceWorkbookId] && allWorkbooks[link.targetWorkbookId]) {
      rawEdges.push({
        id: `explicit-${linkId}`,
        sourceWbId: link.sourceWorkbookId,
        targetWbId: link.targetWorkbookId,
        sharedEntityCount: 0,
        sharedEntityNames: [],
        relationLabel: link.relationLabel || 'Linked Initiative',
      });
    }
  }

  // Filter if a single workbook is selected
  let visibleWbIds = new Set<string>(wbIds);
  if (selectedWbId && allWorkbooks[selectedWbId]) {
    if (includeNeighbors) {
      visibleWbIds = new Set<string>([selectedWbId]);
      for (const edge of rawEdges) {
        if (edge.sourceWbId === selectedWbId) {
          visibleWbIds.add(edge.targetWbId);
        } else if (edge.targetWbId === selectedWbId) {
          visibleWbIds.add(edge.sourceWbId);
        }
      }
    } else {
      visibleWbIds = new Set<string>([selectedWbId]);
    }
  }

  const filteredWbList = Array.from(visibleWbIds)
    .filter((id) => allWorkbooks[id])
    .map((id) => ({ wbId: id, ...allWorkbooks[id] }));

  const total = filteredWbList.length;

  // Position nodes in a 2D circle or grid
  const nodes: MacroNode[] = filteredWbList.map((item, idx) => {
    let x = 450;
    let y = 280;

    if (total === 1) {
      x = 450;
      y = 280;
    } else if (total === 2) {
      x = idx === 0 ? 270 : 630;
      y = 280;
    } else {
      const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
      const radiusX = Math.min(360, 240 + total * 15);
      const radiusY = Math.min(220, 150 + total * 10);
      x = 450 + radiusX * Math.cos(angle);
      y = 280 + radiusY * Math.sin(angle);
    }

    return {
      workbookId: item.wbId,
      workspaceId: item.wsId,
      workspaceName: item.wsName,
      title: item.wb.title || 'Untitled Workbook',
      status: item.wb.status || 'active',
      entityCount: wbEntitiesMap[item.wbId]?.size || 0,
      placementCount: wbPlacementsCount[item.wbId] || 0,
      targetBudgetInr: item.wb.targetBudgetInr || 0,
      x,
      y,
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.workbookId, n]));
  const edges: MacroEdge[] = rawEdges.filter(
    (e) => nodeMap.has(e.sourceWbId) && nodeMap.has(e.targetWbId)
  );

  return { nodes, edges };
}

/**
 * Single-workspace backwards-compatible computation function.
 */
export function computeMacroGraph(
  workbooks: Record<string, any>,
  placements: Record<string, any>,
  entities: Record<string, any>,
  workbookLinks: Record<string, any> = {}
): { nodes: MacroNode[]; edges: MacroEdge[] } {
  const ws: WorkspaceState = {
    schemaVersion: 1,
    activeWorkbookId: Object.keys(workbooks)[0] || 'wb_default',
    workbooks,
    placements,
    branches: {},
    entities,
    workbookLinks,
  };
  return computeMultiWorkspaceMacroGraph([ws]);
}

interface OverviewMacroMapProps {
  onClose?: () => void;
}

export const OverviewMacroMap: React.FC<OverviewMacroMapProps> = ({ onClose }) => {
  const storeWs = useWorkspaceStore((state) => state.workspace);
  const currentWorkspace = useWorkspaceStore.getState().workspace ?? storeWs;
  const storeSaved = useWorkspaceStore((state) => state.savedWorkspaces || []);
  const savedWorkspaces = useWorkspaceStore.getState().savedWorkspaces ?? storeSaved;
  const openWorkbook = useWorkspaceStore((state) => state.openWorkbook);
  const storeTheme = useWorkspaceStore((state) => state.theme);
  const theme = useWorkspaceStore.getState().theme ?? storeTheme;

  // Collect available workspaces (current active workspace + any saved in store)
  const availableWorkspaces = useMemo<WorkspaceState[]>(() => {
    const map = new Map<string, WorkspaceState>();
    if (currentWorkspace?.workspaceId) {
      map.set(currentWorkspace.workspaceId, currentWorkspace);
    }
    for (const ws of savedWorkspaces) {
      if (ws.workspaceId && !map.has(ws.workspaceId)) {
        map.set(ws.workspaceId, ws);
      }
    }
    return Array.from(map.values());
  }, [currentWorkspace, savedWorkspaces]);

  // All available workspaces
  const allWorkspaces = availableWorkspaces;

  // Selected workbook filter: null = all
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string | null>(null);
  const [includeConnectedOverlaps, setIncludeConnectedOverlaps] = useState<boolean>(true);

  // All workbooks available across the ecosystem
  const availableWorkbooks = useMemo(() => {
    const wbs: { id: string; title: string }[] = [];
    for (const ws of allWorkspaces) {
      for (const [id, wb] of Object.entries(ws.workbooks || {})) {
        wbs.push({ id, title: wb.title || 'Untitled Workbook' });
      }
    }
    return wbs;
  }, [allWorkspaces]);

  const { nodes, edges } = useMemo(() => {
    return computeMultiWorkspaceMacroGraph(
      allWorkspaces,
      selectedWorkbookId,
      includeConnectedOverlaps
    );
  }, [allWorkspaces, selectedWorkbookId, includeConnectedOverlaps]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.workbookId, n])), [nodes]);

  const isDark = theme === 'dark' || theme === 'night';

  return (
    <div
      className={clsx(
        'relative w-full rounded-md border overflow-hidden flex flex-col shadow-sm transition-colors',
        isDark ? 'bg-[#121417] border-[#2D333B]' : 'bg-[#FAF8F4] border-[#DDD6C8]'
      )}
    >
      {/* Top Header Bar */}
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-2.5 border-b text-xs select-none',
          isDark ? 'bg-[#181B20] border-[#2D333B] text-[#F4F2ED]' : 'bg-[#F2EFE9] border-[#DDD6C8] text-[#1C1B18]'
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="w-4 h-4 text-[#B45309]" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Ecosystem Overview Macro-Map
          </span>
          <span className="text-[11px] font-mono text-[#8A8377]">
            ({nodes.length} Workbook{nodes.length !== 1 ? 's' : ''}, {edges.length} Cross-Initiative Tie{edges.length !== 1 ? 's' : ''})
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={clsx(
              'px-2 py-1 rounded text-xs font-mono transition-colors',
              isDark
                ? 'text-[#8A8377] hover:text-[#F4F2ED] hover:bg-[#252A32]'
                : 'text-[#8A8377] hover:text-[#1C1B18] hover:bg-[#EAE6DF]'
            )}
          >
            Close Map ✕
          </button>
        )}
      </div>

      {/* Scope Controls Toolbar */}
      <div
        className={clsx(
          'px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 text-xs',
          isDark ? 'bg-[#15181D] border-[#2D333B] text-[#F4F2ED]' : 'bg-[#F9F7F4] border-[#E8E2D8] text-[#1C1B18]'
        )}
      >
        {/* Direct Workbook Connections Scope */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-[#8A8377] flex items-center gap-1 font-medium">
            <Filter className="w-3 h-3 text-[#B45309]" />
            Focus on Workbook:
          </span>

          <select
            value={selectedWorkbookId || 'all'}
            onChange={(e) =>
              setSelectedWorkbookId(e.target.value === 'all' ? null : e.target.value)
            }
            className={clsx(
              'px-2 py-1 text-xs rounded border outline-none font-sans cursor-pointer transition-colors max-w-[240px] truncate',
              isDark
                ? 'bg-[#1E2228] border-[#2D333B] text-[#F4F2ED]'
                : 'bg-[#EDE8DE] border-[#5A554C] text-[#1C1B18]'
            )}
          >
            <option value="all">All Workbooks ({availableWorkbooks.length})</option>
            {availableWorkbooks.map((wb) => (
              <option key={wb.id} value={wb.id}>
                {wb.title}
              </option>
            ))}
          </select>

          {selectedWorkbookId && (
            <button
              onClick={() => setSelectedWorkbookId(null)}
              className={clsx(
                'px-2 py-0.5 rounded text-[11px] font-mono border transition-colors',
                isDark
                  ? 'bg-[#1E2228] border-[#2D333B] text-[#8A8377] hover:text-[#F4F2ED]'
                  : 'bg-[#EDE8DE] border-[#5A554C] text-[#5A554C] hover:text-[#1C1B18]'
              )}
            >
              Show All
            </button>
          )}
        </div>

        {/* Cross-Initiative Ties Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedWorkbookId && (
            <button
              onClick={() => setIncludeConnectedOverlaps(!includeConnectedOverlaps)}
              className={clsx(
                'px-2 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer',
                includeConnectedOverlaps
                  ? 'bg-[#0F6B38] text-white border-[#0F6B38]'
                  : isDark
                  ? 'bg-[#1E2228] border-[#2D333B] text-[#8A8377]'
                  : 'bg-[#EDE8DE] border-[#5A554C] text-[#5A554C]'
              )}
            >
              {includeConnectedOverlaps ? '✓ Shared Ties Included' : 'Isolated Workbook'}
            </button>
          )}

          {selectedWorkbookId !== null && (
            <button
              onClick={() => {
                setSelectedWorkbookId(null);
              }}
              title="Reset view filters"
              className={clsx(
                'px-2 py-1 rounded text-[11px] font-mono border flex items-center gap-1 transition-colors',
                isDark
                  ? 'bg-[#1E2228] border-[#2D333B] text-[#8A8377] hover:text-[#F4F2ED]'
                  : 'bg-[#EDE8DE] border-[#5A554C] text-[#8A8377] hover:text-[#1C1B18]'
              )}
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 2D Visual Map Canvas */}
      <div className="relative w-full h-[540px] overflow-auto p-4">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Network className="w-8 h-8 text-[#8A8377] mb-2 opacity-40" />
            <p className={clsx("text-xs font-serif font-medium", isDark ? "text-[#F4F2ED]" : "text-[#1C1B18]")}>
              No workbooks match the selected workbook filter.
            </p>
            <button
              onClick={() => {
                setSelectedWorkbookId(null);
              }}
              className="mt-3 px-3 py-1.5 rounded text-xs bg-[#B45309] text-white hover:bg-[#92400E] font-mono transition-colors"
            >
              Reset Macro-Map Filters
            </button>
          </div>
        ) : (
          <>
            <svg className="absolute inset-0 w-full h-full pointer-events-none min-w-[900px] min-h-[500px]">
              {edges.map((edge) => {
                const s = nodeMap.get(edge.sourceWbId);
                const t = nodeMap.get(edge.targetWbId);
                if (!s || !t) return null;

                const midX = (s.x + t.x) / 2;
                const midY = (s.y + t.y) / 2;

                return (
                  <g key={edge.id}>
                    {/* Connecting Inter-Workbook Line */}
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={edge.relationLabel ? '#B45309' : '#0F6B38'}
                      strokeWidth={2}
                      strokeDasharray={edge.relationLabel ? '4 3' : undefined}
                      opacity={0.75}
                    />
                    {/* Midpoint Overlap Pill */}
                    <foreignObject
                      x={midX - 75}
                      y={midY - 14}
                      width={150}
                      height={28}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        title={
                          edge.sharedEntityNames.length > 0
                            ? `Shared Organizations: ${edge.sharedEntityNames.join(', ')}`
                            : edge.relationLabel
                        }
                        className={clsx(
                          'px-2 py-0.5 rounded text-[10px] font-mono font-medium text-center shadow-xs border cursor-default truncate',
                          isDark
                            ? 'bg-[#181B20] border-[#2D333B] text-[#FDE68A]'
                            : 'bg-[#EDE8DE] border-[#5A554C] text-[#92400E]'
                        )}
                      >
                        {edge.relationLabel ||
                          `${edge.sharedEntityCount} shared partner${
                            edge.sharedEntityCount > 1 ? 's' : ''
                          }`}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Workbook Node Cards */}
            {nodes.map((node) => {
              const isSelected = selectedWorkbookId === node.workbookId;
              return (
                <div
                  key={node.workbookId}
                  style={{
                    position: 'absolute',
                    left: `${node.x - 115}px`,
                    top: `${node.y - 55}px`,
                    width: '230px',
                  }}
                  onClick={() => openWorkbook(node.workbookId)}
                  className={clsx(
                    'group rounded-sm border p-3 cursor-pointer shadow-xs transition-all duration-150 select-none hover:shadow-md hover:scale-[1.02]',
                    isSelected
                      ? isDark
                        ? 'bg-[#1E2228] border-[#B45309] ring-2 ring-[#B45309]/50'
                        : 'bg-[#EDE8DE] border-[#B45309] ring-2 ring-[#B45309]/40 text-[#1C1B18]'
                      : isDark
                      ? 'bg-[#1E2228] border-[#2D333B] hover:border-[#F4F2ED]'
                      : 'bg-[#EDE8DE] border-[#5A554C] hover:border-[#1C1B18] text-[#1C1B18]'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={clsx(
                        'text-xs font-serif font-semibold truncate',
                        isDark ? 'text-[#F4F2ED]' : 'text-[#1C1B18]'
                      )}
                      title={node.title}
                    >
                      {node.title}
                    </span>
                    <span
                      className={clsx(
                        'text-[9px] uppercase font-mono px-1.5 py-0.2 rounded-xs border shrink-0',
                        node.status === 'active'
                          ? 'bg-[#E6F4EC] text-[#0F6B38] border-[#C3E4D1]'
                          : 'bg-[#F2EFE9] text-[#8A8377] border-[#DDD6C8]'
                      )}
                    >
                      {node.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-[#8A8377] mt-1.5">
                    <div className="flex items-center gap-1" title="Organizations placed">
                      <Layers className="w-3 h-3 text-[#5A554C]" />
                      <span>{node.entityCount} orgs</span>
                    </div>
                    <div className="flex items-center gap-1" title="Target budget">
                      <DollarSign className="w-3 h-3 text-[#5A554C]" />
                      <span>{formatRupeeCompact(node.targetBudgetInr)}</span>
                    </div>
                  </div>

                  <div className={clsx(
                    'mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] text-[#B45309] font-medium group-hover:translate-x-0.5 transition-transform',
                    isDark ? 'border-[#2D333B]' : 'border-[#5A554C]/30'
                  )}>
                    <span>Open in Canvas</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
