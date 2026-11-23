import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  ConnectionMode,
  SelectionMode,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import {
  Plus,
  Minus,
  Move,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Keyboard,
  Settings,
  GripVertical,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore, type OrgFlowNode, type MultiplexFlowEdge } from '../../store/useWorkspaceStore';
import { computeParallelBezierCurve, groupParallelBranches } from '../../engine/parallelEdges';
import { filterSelectionByIsolation, getIsolatedHighlightedPlacementIds, getIsolatedHighlightedBranchIds } from '../../engine/isolation';
import { OrgNode } from './OrgNode';
import { MultiplexEdge } from './MultiplexEdge';
import { ContextMenu } from './ContextMenu';
import { MultiSelectModifyModal } from './MultiSelectModifyModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { AddNodeModal } from '../toolbar/AddNodeModal';
import { ConnectBranchModal } from '../toolbar/ConnectBranchModal';
import { ManageSectorsModal } from '../toolbar/ManageSectorsModal';
import { SettingsModal } from '../toolbar/SettingsModal';
import { requestFullscreenSafe, exitFullscreenSafe, isFullscreenActive } from '../../utils/fullscreen';

// Memoized custom component registrations outside component render loop
const nodeTypes = {
  orgNode: OrgNode,
};

const edgeTypes = {
  multiplexEdge: MultiplexEdge,
};

interface SelectionBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function checkBranchInBox(
  srcPos: { x: number; y: number },
  tgtPos: { x: number; y: number },
  index: number,
  total: number,
  isReverse: boolean,
  box: SelectionBox
): boolean {
  const geom = computeParallelBezierCurve(srcPos, tgtPos, index, total, 36, isReverse, 0.88);

  // Check button / label coordinates
  if (geom.buttonX >= box.minX && geom.buttonX <= box.maxX && geom.buttonY >= box.minY && geom.buttonY <= box.maxY) {
    return true;
  }
  if (geom.labelX >= box.minX && geom.labelX <= box.maxX && geom.labelY >= box.minY && geom.labelY <= box.maxY) {
    return true;
  }

  // Parse path: 'M sx sy C cp1x cp1y, cp2x cp2y, tx ty'
  const match = /M\s*([\d.-]+)\s+([\d.-]+)\s+C\s*([\d.-]+)\s+([\d.-]+)[,\s]+([\d.-]+)\s+([\d.-]+)[,\s]+([\d.-]+)\s+([\d.-]+)/.exec(geom.path);
  if (!match) return false;
  const [_, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y] = match.map(Number);

  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const inv = 1 - t;
    const x = inv * inv * inv * p0x + 3 * inv * inv * t * p1x + 3 * inv * t * t * p2x + t * t * t * p3x;
    const y = inv * inv * inv * p0y + 3 * inv * inv * t * p1y + 3 * inv * t * t * p2y + t * t * t * p3y;
    if (x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY) {
      return true;
    }
  }
  return false;
}

export const PartnershipCanvas: React.FC = () => {
  const nodes = useWorkspaceStore((state) => state.nodes);
  const edges = useWorkspaceStore((state) => state.edges);
  const theme = useWorkspaceStore((state) => state.theme);
  const isWorkspaceLocked = useWorkspaceStore((state) => state.isWorkspaceLocked);
  const selectedPlacementIds = useWorkspaceStore((state) => state.selectedPlacementIds);
  const selectedBranchIds = useWorkspaceStore((state) => state.selectedBranchIds);

  const init = useWorkspaceStore((state) => state.init);
  const onNodesChange = useWorkspaceStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkspaceStore((state) => state.onEdgesChange);
  const onNodeDragStopAction = useWorkspaceStore((state) => state.onNodeDragStop);
  const selectPlacement = useWorkspaceStore((state) => state.selectPlacement);
  const selectBranch = useWorkspaceStore((state) => state.selectBranch);
  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const setSelection = useWorkspaceStore((state) => state.setSelection);
  const setSelectionFilter = useWorkspaceStore((state) => state.setSelectionFilter);
  const setIsHoldingB = useWorkspaceStore((state) => state.setIsHoldingB);
  const dragConnectEnabled = useWorkspaceStore((state) => state.dragConnectEnabled);
  const onConnectAction = useWorkspaceStore((state) => state.onConnect);
  const setConnecting = useWorkspaceStore((state) => state.setConnecting);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const isolatedElement = useWorkspaceStore((state) => state.isolatedElement);
  const enterIsolationMode = useWorkspaceStore((state) => state.enterIsolationMode);
  const exitIsolationMode = useWorkspaceStore((state) => state.exitIsolationMode);
  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const setIsFullscreen = useWorkspaceStore((state) => state.setIsFullscreen);
  const toggleWorkspaceLock = useWorkspaceStore((state) => state.toggleWorkspaceLock);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const tidyUpLayout = useWorkspaceStore((state) => state.tidyUpLayout);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const activeWorkbookId = useWorkspaceStore((state) => state.activeWorkbookId);
  const updateBranch = useWorkspaceStore((state) => state.updateBranch);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const flowInstanceRef = useRef<ReactFlowInstance<OrgFlowNode, MultiplexFlowEdge> | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    type: 'node' | 'edge' | 'pane' | 'multi';
    x: number;
    y: number;
    nodeId?: string | null;
    edgeId?: string | null;
    canvasPosition?: { x: number; y: number };
  } | null>(null);

  // Modals initiated from canvas context menus
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [addNodePos, setAddNodePos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [isConnectBranchOpen, setIsConnectBranchOpen] = useState(false);
  const [connectBranchSourceId, setConnectBranchSourceId] = useState<string | undefined>(undefined);
  const [isManageSectorsOpen, setIsManageSectorsOpen] = useState(false);
  const [isMultiModifyOpen, setIsMultiModifyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Draggable bottom-left controls dock state
  const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingDockRef = useRef(false);
  const dockDragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number } | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);

  const handleDockPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    e.preventDefault();
    const dockEl = dockRef.current;
    if (!dockEl) return;
    const parentEl = dockEl.parentElement;
    const parentRect = parentEl?.getBoundingClientRect();
    const dockRect = dockEl.getBoundingClientRect();
    const parentLeft = parentRect ? parentRect.left : 0;
    const parentTop = parentRect ? parentRect.top : 0;

    const currentX = dockPos ? dockPos.x : (dockRect.left - parentLeft);
    const currentY = dockPos ? dockPos.y : (dockRect.top - parentTop);
    dockDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    };
    isDraggingDockRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDockPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDockRef.current || !dockDragStartRef.current) return;
    const dx = e.clientX - dockDragStartRef.current.clientX;
    const dy = e.clientY - dockDragStartRef.current.clientY;
    const dockEl = dockRef.current;
    const parentEl = dockEl?.parentElement;
    const maxW = parentEl ? parentEl.clientWidth : (window.innerWidth || 1200);
    const maxH = parentEl ? parentEl.clientHeight : (window.innerHeight || 800);
    const dockW = dockEl?.offsetWidth || 44;
    const dockH = dockEl?.offsetHeight || 260;
    const newX = Math.max(8, Math.min(maxW - dockW - 8, dockDragStartRef.current.initialX + dx));
    const newY = Math.max(8, Math.min(maxH - dockH - 8, dockDragStartRef.current.initialY + dy));
    setDockPos({ x: newX, y: newY });
  };

  const handleDockPointerUp = (e: React.PointerEvent) => {
    isDraggingDockRef.current = false;
    dockDragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keep dock clamped inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setDockPos((prev) => {
        if (!prev) return null;
        const dockEl = dockRef.current;
        const parentEl = dockEl?.parentElement;
        const maxW = parentEl ? parentEl.clientWidth : (window.innerWidth || 1200);
        const maxH = parentEl ? parentEl.clientHeight : (window.innerHeight || 800);
        const dockW = dockEl?.offsetWidth || 44;
        const dockH = dockEl?.offsetHeight || 260;
        return {
          x: Math.max(8, Math.min(maxW - dockW - 8, prev.x)),
          y: Math.max(8, Math.min(maxH - dockH - 8, prev.y)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Key modifiers for N and B box selection
  const [activeFilter, setActiveFilter] = useState<'all' | 'nodes' | 'branches'>('all');
  const activeFilterRef = useRef<'all' | 'nodes' | 'branches'>('all');
  activeFilterRef.current = activeFilter;

  // Initialize store and load workspace on mount
  useEffect(() => {
    init();
  }, [init]);

  // Auto-center and fit view whenever active workbook changes or new nodes arrive
  useEffect(() => {
    if (nodes.length > 0 && flowInstanceRef.current) {
      const timer = setTimeout(() => {
        flowInstanceRef.current?.fitView({ duration: 300, padding: 0.15 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeWorkbookId]);

  // Track 'N' (nodes only), 'B' (branches only), Zoom (+/-), and '?' (shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInput =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        exitIsolationMode();
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setIsShortcutsOpen((prev) => !prev);
      } else if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        flowInstanceRef.current?.zoomIn({ duration: 200 });
      } else if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.metaKey) {
        flowInstanceRef.current?.zoomOut({ duration: 200 });
      } else if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
        setActiveTool(activeTool === 'hand' ? 'pointer' : 'hand');
      } else if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('pointer');
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        flowInstanceRef.current?.fitView({ duration: 300, padding: 0.1 });
      } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !isWorkspaceLocked) {
        tidyUpLayout();
      } else if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey) {
        toggleWorkspaceLock();
      } else if (e.key === 'n' || e.key === 'N') {
        if (!e.repeat) {
          setActiveFilter('nodes');
          setSelectionFilter('nodes');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        if (!e.repeat) {
          setActiveFilter('branches');
          setSelectionFilter('branches');
          setIsHoldingB(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'b' || e.key === 'B') {
        setIsHoldingB(false);
      }
      if (e.key === 'n' || e.key === 'N' || e.key === 'b' || e.key === 'B') {
        setActiveFilter('all');
        setSelectionFilter('all');
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsHoldingB(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setSelectionFilter, exitIsolationMode]);

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
      console.warn('[PartnershipCanvas] Fullscreen toggle error:', err);
      setIsFullscreen(!isFullscreen);
    }
  };

  // Handle persistent zero-snap-back node drag release (single or multi-node selection)
  const handleNodeDragStop = useCallback<OnNodeDrag<OrgFlowNode>>(
    (_event, node, nodes) => {
      const movedNodes = nodes && nodes.length > 0 ? nodes : [node];
      onNodeDragStopAction(
        node.id,
        node.position,
        movedNodes.map((n) => ({ id: n.id, position: n.position }))
      );
    },
    [onNodeDragStopAction]
  );

  // Context Menu Handlers
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      const { selectedPlacementIds: currentPlacements, selectedBranchIds: currentBranches } =
        useWorkspaceStore.getState();
      if (
        currentPlacements.length + currentBranches.length > 1 &&
        currentPlacements.includes(node.id)
      ) {
        setContextMenu({
          type: 'multi',
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      setContextMenu({
        type: 'node',
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    []
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      const { selectedPlacementIds: currentPlacements, selectedBranchIds: currentBranches } =
        useWorkspaceStore.getState();
      if (
        currentPlacements.length + currentBranches.length > 1 &&
        currentBranches.includes(edge.id)
      ) {
        setContextMenu({
          type: 'multi',
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      setContextMenu({
        type: 'edge',
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      });
    },
    []
  );

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const { selectedPlacementIds: currentPlacements, selectedBranchIds: currentBranches } =
        useWorkspaceStore.getState();
      if (currentPlacements.length + currentBranches.length > 1) {
        setContextMenu({
          type: 'multi',
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      const canvasPos = flowInstanceRef.current
        ? flowInstanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };
      setContextMenu({
        type: 'pane',
        x: event.clientX,
        y: event.clientY,
        canvasPosition: canvasPos,
      });
    },
    []
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: 'multi',
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  // Selection Change Handler: Filter nodes / branches based on held N / B key and isolation mode
  const handleSelectionChange = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      const filter = activeFilterRef.current;
      const { isolatedElement, workspace, activeWorkbookId } = useWorkspaceStore.getState();

      let candidateNodes = params.nodes;
      let candidateEdges = params.edges;

      if (isolatedElement && workspace) {
        const highlightedPlacements = getIsolatedHighlightedPlacementIds(
          isolatedElement,
          workspace.branches,
          activeWorkbookId || undefined
        );
        const highlightedBranches = getIsolatedHighlightedBranchIds(
          isolatedElement,
          workspace.branches,
          activeWorkbookId || undefined
        );

        if (highlightedPlacements) {
          candidateNodes = candidateNodes.filter((n) => highlightedPlacements.has(n.id));
        }
        if (highlightedBranches) {
          candidateEdges = candidateEdges.filter((e) => highlightedBranches.has(e.id));
        }
      }

      const nodeIds = candidateNodes.map((n) => n.id);
      const edgeIds = candidateEdges.map((e) => e.id);

      if (filter === 'nodes') {
        setSelection(nodeIds, []);
      } else if (filter === 'branches') {
        setSelection([], edgeIds);
      } else if (isolatedElement) {
        // Feature 2: In isolation mode, strictly enforce isolation even with filter === 'all'
        setSelection(nodeIds, edgeIds);
      }
    },
    [setSelection]
  );

  const isHand = activeTool === 'hand' || isSpacePressed;

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (isWorkspaceLocked) return;
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return;
      updateBranch(oldEdge.id, {
        sourcePlacementId: newConnection.source,
        targetPlacementId: newConnection.target,
      });
    },
    [isWorkspaceLocked, updateBranch]
  );

  const pointerDownRef = useRef<{ clientX: number; clientY: number; time: number } | null>(null);

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (isHand || e.button !== 0) return;
    pointerDownRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      time: Date.now(),
    };
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (isHand || e.button !== 0 || !pointerDownRef.current) return;
    const start = pointerDownRef.current;
    pointerDownRef.current = null;

    const dx = Math.abs(e.clientX - start.clientX);
    const dy = Math.abs(e.clientY - start.clientY);

    // If mouse was dragged more than 8 pixels, process marquee box selection
    if (dx > 8 || dy > 8) {
      if (!flowInstanceRef.current) return;
      const p1 = flowInstanceRef.current.screenToFlowPosition({ x: start.clientX, y: start.clientY });
      const p2 = flowInstanceRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const box: SelectionBox = {
        minX: Math.min(p1.x, p2.x),
        maxX: Math.max(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxY: Math.max(p1.y, p2.y),
      };

      const filter = activeFilterRef.current;
      const { workspace, activeWorkbookId, showDeclined } = useWorkspaceStore.getState();
      if (!workspace || !activeWorkbookId) return;

      // 1. Identify touched nodes
      const activePlacements = Object.values(workspace.placements).filter(
        (p) => p.workbookId === activeWorkbookId
      );
      const touchedNodeIds = activePlacements
        .filter((p) => {
          const w = p.width ?? 220;
          const h = p.height ?? 110;
          return !(p.x + w < box.minX || p.x > box.maxX || p.y + h < box.minY || p.y > box.maxY);
        })
        .map((p) => p.placementId);

      // 2. Identify touched branches
      const allBranches = Object.values(workspace.branches).filter(
        (b) => b.workbookId === activeWorkbookId
      );
      const visibleBranches = showDeclined
        ? allBranches
        : allBranches.filter((b) => b.status !== 'cross');

      const groups = groupParallelBranches(visibleBranches);
      const touchedBranchIds: string[] = [];

      for (const group of groups.values()) {
        const total = group.length;
        group.forEach((branch, index) => {
          const srcP = workspace.placements[branch.sourcePlacementId];
          const tgtP = workspace.placements[branch.targetPlacementId];
          if (!srcP || !tgtP) return;

          const isReverse = srcP.y < tgtP.y || (srcP.y === tgtP.y && srcP.x > tgtP.x);
          const inBox = checkBranchInBox(
            { x: srcP.x, y: srcP.y },
            { x: tgtP.x, y: tgtP.y },
            index,
            total,
            isReverse,
            box
          );
          if (inBox) {
            touchedBranchIds.push(branch.branchId);
          }
        });
      }

      // Feature 2: When isolation mode is active, filter candidates so ONLY highlighted/connected nodes & branches are selected
      let effectiveNodeIds = touchedNodeIds;
      let effectiveBranchIds = touchedBranchIds;
      const currentIsolated = useWorkspaceStore.getState().isolatedElement;
      if (currentIsolated) {
        const filtered = filterSelectionByIsolation(
          { placementIds: touchedNodeIds, branchIds: touchedBranchIds },
          currentIsolated,
          workspace.branches,
          activeWorkbookId
        );
        effectiveNodeIds = filtered.placementIds;
        effectiveBranchIds = filtered.branchIds;
      }

      // 3. Apply active key filter (N, B, or All)
      let finalNodes: string[] = [];
      let finalBranches: string[] = [];

      if (filter === 'nodes') {
        finalNodes = effectiveNodeIds;
        finalBranches = [];
      } else if (filter === 'branches') {
        finalNodes = [];
        finalBranches = effectiveBranchIds;
      } else {
        finalNodes = effectiveNodeIds;
        finalBranches = effectiveBranchIds;
      }

      if (finalNodes.length === 0 && finalBranches.length === 0) {
        clearSelection();
      } else {
        setSelection(finalNodes, finalBranches);
      }
    }
  };

  const canvasBgColor =
    theme === 'night' ? '#121417' : theme === 'light' ? '#FAF8F4' : '#121417';
  const gridColor =
    theme === 'night' ? '#2D333B' : theme === 'light' ? '#C8BFB0' : '#2D333B';

  const activePlacements = workspace && activeWorkbookId
    ? Object.values(workspace.placements).filter((p) => p.workbookId === activeWorkbookId)
    : [];

  const isolatedBranch =
    isolatedElement && isolatedElement.type === 'branch' && workspace
      ? workspace.branches[isolatedElement.id]
      : null;

  const isolatedPlacement =
    isolatedElement && isolatedElement.type === 'node' && workspace
      ? workspace.placements[isolatedElement.id]
      : null;

  const isolatedEntityName = isolatedPlacement && workspace
    ? workspace.entities[isolatedPlacement.entityId]?.name || 'Partner Card'
    : 'Selected Branch';

  return (
    <div
      style={{ backgroundColor: canvasBgColor }}
      className={clsx(
        'w-full h-full relative select-none',
        isHand ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      )}
      onPointerDown={handleContainerPointerDown}
      onPointerUp={handleContainerPointerUp}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
          useWorkspaceStore.getState().setFlowInstance(instance);
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => {
          clearSelection();
          setContextMenu(null);
          exitIsolationMode();
        }}
        onNodeClick={(event, node) => {
          const isMulti = event.shiftKey || event.ctrlKey || event.metaKey;
          selectPlacement(node.id, isMulti);
          setContextMenu(null);
        }}
        onNodeDoubleClick={(_, node) => {
          selectPlacement(node.id);
          enterIsolationMode('node', node.id);
        }}
        onEdgeClick={(_, edge) => {
          selectBranch(edge.id);
          setContextMenu(null);
        }}
        onEdgeDoubleClick={(_, edge) => {
          selectBranch(edge.id);
          enterIsolationMode('branch', edge.id);
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        onSelectionChange={handleSelectionChange}
        onReconnect={handleReconnect}
        edgesReconnectable={!isWorkspaceLocked}
        selectionOnDrag={!isHand}
        panOnDrag={isHand ? true : false}
        panActivationKeyCode="Space"
        multiSelectionKeyCode={['Control', 'Meta', 'b', 'B', 'KeyB']}
        selectionMode={SelectionMode.Partial}
        onConnect={dragConnectEnabled && !isWorkspaceLocked ? onConnectAction : undefined}
        nodesConnectable={dragConnectEnabled && !isWorkspaceLocked}
        nodesDraggable={!isWorkspaceLocked}
        elementsSelectable={true}
        connectionMode={ConnectionMode.Loose}
        onConnectStart={(_event, params) => setConnecting(true, params.nodeId, params.handleId)}
        onConnectEnd={() => setConnecting(false, null, null)}
        onlyRenderVisibleElements={true}
        elevateNodesOnSelect={false}
        fitView
        minZoom={0.2}
        maxZoom={2.0}
      >
        <Background color={gridColor} gap={20} size={1} />
      </ReactFlow>

      {/* Adobe Illustrator Style Isolation Mode Banner */}
      {isolatedElement && (
        <div
          className={clsx(
            'absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-md text-xs animate-in fade-in slide-in-from-top-2 border shadow-2xl',
            theme === 'light'
              ? 'bg-[#FAF8F4]/95 border-[#5A554C] text-[#1C1B18] shadow-[0_4px_16px_rgba(28,27,24,0.15)]'
              : 'bg-slate-900/95 border-sky-400 text-slate-200 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            <span className={theme === 'light' ? 'text-[#5A554C]' : 'text-slate-400'}>Isolation Mode:</span>
            <span className={clsx('font-bold', theme === 'light' ? 'text-sky-800' : 'text-sky-300')}>
              {isolatedElement.type === 'node'
                ? isolatedEntityName
                : isolatedBranch
                ? `${isolatedBranch.type.toUpperCase()} branch`
                : 'Connection Branch'}
            </span>
          </div>

          {/* Quick origin / target rerouting when branch is isolated */}
          {isolatedElement.type === 'branch' && isolatedBranch && (
            <div className={clsx('flex items-center gap-2 border-l pl-3', theme === 'light' ? 'border-[#DDD6C8]' : 'border-slate-700')}>
              <span className={clsx('text-[11px]', theme === 'light' ? 'text-[#5A554C]' : 'text-slate-400')}>Origin:</span>
              <select
                aria-label="Branch Origin"
                value={isolatedBranch.sourcePlacementId}
                disabled={isWorkspaceLocked}
                onChange={(e) =>
                  updateBranch(isolatedBranch.branchId, { sourcePlacementId: e.target.value })
                }
                className={clsx(
                  'px-2 py-0.5 border rounded text-xs cursor-pointer',
                  theme === 'light'
                    ? 'bg-white border-[#BEB5A4] text-[#1C1B18]'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
                )}
              >
                {activePlacements.map((p) => (
                  <option key={p.placementId} value={p.placementId}>
                    {workspace?.entities[p.entityId]?.name || p.placementId}
                  </option>
                ))}
              </select>

              <span className={clsx('text-[11px]', theme === 'light' ? 'text-[#5A554C]' : 'text-slate-400')}>Target:</span>
              <select
                aria-label="Branch Target"
                value={isolatedBranch.targetPlacementId}
                disabled={isWorkspaceLocked}
                onChange={(e) =>
                  updateBranch(isolatedBranch.branchId, { targetPlacementId: e.target.value })
                }
                className={clsx(
                  'px-2 py-0.5 border rounded text-xs cursor-pointer',
                  theme === 'light'
                    ? 'bg-white border-[#BEB5A4] text-[#1C1B18]'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
                )}
              >
                {activePlacements.map((p) => (
                  <option key={p.placementId} value={p.placementId}>
                    {workspace?.entities[p.entityId]?.name || p.placementId}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={clsx('border-l pl-3 flex items-center gap-2', theme === 'light' ? 'border-[#DDD6C8]' : 'border-slate-700')}>
            <button
              type="button"
              onClick={exitIsolationMode}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer text-xs transition-colors"
            >
              Exit Isolation (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Draggable Bottom-Left Controls Bar (Zoom, Lock, Fullscreen, Keyboard Shortcuts, Settings) */}
      <div
        ref={dockRef}
        role="toolbar"
        aria-label="Canvas Navigation Controls"
        style={
          dockPos
            ? {
                position: 'absolute',
                left: `${dockPos.x}px`,
                top: `${dockPos.y}px`,
                bottom: 'auto',
              }
            : undefined
        }
        onPointerDown={handleDockPointerDown}
        onPointerMove={handleDockPointerMove}
        onPointerUp={handleDockPointerUp}
        onPointerCancel={handleDockPointerUp}
        className={clsx(
          'z-20 flex flex-col rounded-xl shadow-2xl backdrop-blur-md p-1 gap-1 select-none border transition-colors cursor-grab active:cursor-grabbing touch-none',
          !dockPos && 'absolute bottom-5 left-5',
          theme === 'light'
            ? 'bg-white border-2 border-black text-black shadow-slate-300/50'
            : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
        )}
      >
        {/* Drag Handle Bar */}
        <div
          title="Drag navigation controls"
          className={clsx(
            'w-full flex items-center justify-center py-0.5 cursor-grab active:cursor-grabbing',
            theme === 'light' ? 'text-black hover:text-black' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <GripVertical className="w-3.5 h-3.5 rotate-90" />
        </div>

        <button
          type="button"
          onClick={() => flowInstanceRef.current?.zoomIn({ duration: 200 })}
          title="Zoom In (+)"
          aria-label="Zoom In"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 hover:text-white'
          )}
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => flowInstanceRef.current?.zoomOut({ duration: 200 })}
          title="Zoom Out (-)"
          aria-label="Zoom Out"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 hover:text-white'
          )}
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => flowInstanceRef.current?.fitView({ duration: 300, padding: 0.1 })}
          title="Fit to Screen"
          aria-label="Fit to Screen"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 hover:text-white'
          )}
        >
          <Move className="w-4 h-4" />
        </button>

        <div className={clsx('w-full h-[1px] my-0.5', theme === 'light' ? 'bg-black' : 'bg-slate-800')} />

        <button
          type="button"
          onClick={toggleWorkspaceLock}
          title={isWorkspaceLocked ? 'Workspace Locked (Click to Unlock)' : 'Lock Workspace'}
          aria-label="Lock Workspace"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            isWorkspaceLocked
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
              : theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 hover:text-white text-slate-400'
          )}
        >
          {isWorkspaceLocked ? <Lock className="w-4 h-4 text-rose-500" /> : <Unlock className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label="Toggle Fullscreen"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            isFullscreen
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
              : theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 hover:text-white text-slate-400'
          )}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-sky-400" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div className={clsx('w-full h-[1px] my-0.5', theme === 'light' ? 'bg-black' : 'bg-slate-800')} />

        {/* Keyboard Shortcuts Button */}
        <button
          type="button"
          onClick={() => setIsShortcutsOpen(true)}
          title="Keyboard Shortcuts & Keybindings"
          aria-label="Keyboard Shortcuts"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          )}
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          title="Settings & Appearance"
          aria-label="Settings"
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            theme === 'light'
              ? 'hover:bg-slate-100 text-black hover:text-black'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Mode / Multi-Selection Floating Overlay Banner */}
      {activeFilter === 'nodes' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-sky-950/90 border border-sky-500/60 text-sky-200 text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-none z-30 flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>Node Selection Mode: Box selects nodes only (N key held)</span>
        </div>
      )}

      {activeFilter === 'branches' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-none z-30 flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Branch Selection Mode: Box selects branches only (B key held)</span>
        </div>
      )}

      {selectedPlacementIds.length + selectedBranchIds.length > 1 && (
        <div
          className={clsx(
            'absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-md text-xs z-30 animate-in fade-in border shadow-2xl',
            theme === 'light'
              ? 'bg-[#FAF8F4]/95 border-[#5A554C] text-[#1C1B18] shadow-[0_4px_16px_rgba(28,27,24,0.15)]'
              : 'bg-slate-900/95 border-sky-500/50 text-slate-200 shadow-2xl'
          )}
        >
          <span className={clsx('font-semibold', theme === 'light' ? 'text-sky-800' : 'text-sky-300')}>
            {selectedPlacementIds.length} Nodes · {selectedBranchIds.length} Branches Selected
          </span>
          <span className={clsx('text-[11px] border-l pl-2', theme === 'light' ? 'text-[#5A554C] border-[#DDD6C8]' : 'text-slate-400 border-slate-700')}>
            Right-click to inspect or batch edit
          </span>
          <button
            type="button"
            onClick={() => setIsMultiModifyOpen(true)}
            className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] transition-colors cursor-pointer"
          >
            Modify
          </button>
          <button
            type="button"
            onClick={clearSelection}
            title="Clear selection (Esc)"
            className={clsx('transition-colors cursor-pointer text-xs', theme === 'light' ? 'text-[#5A554C] hover:text-[#1C1B18]' : 'text-slate-400 hover:text-white')}
          >
            ✕
          </button>
        </div>
      )}

      {(!activeWorkbookId || Object.keys(workspace?.workbooks || {}).length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="p-6 rounded-lg bg-white/95 dark:bg-[#181B20]/95 border border-[#DDD6C8] dark:border-[#2D333B] shadow-2xl text-center max-w-sm pointer-events-auto backdrop-blur-xs">
            <h3 className="font-serif font-bold text-sm text-[#1C1B18] dark:text-[#F4F2ED] mb-1.5">
              No Active Workbook
            </h3>
            <p className="text-xs text-[#8A8377] mb-4 leading-relaxed">
              There is currently no active workbook on this canvas. Switch to the Landing Page to create or open a partnership ledger.
            </p>
            <button
              type="button"
              onClick={() => useWorkspaceStore.getState().setActiveView('landing')}
              className="px-3.5 py-1.5 rounded-xs bg-[#1C1B18] dark:bg-[#FAF8F4] text-[#FAF8F4] dark:text-[#1C1B18] text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Go to Landing Page & Index
            </button>
          </div>
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          type={contextMenu.type}
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          canvasPosition={contextMenu.canvasPosition}
          onClose={() => setContextMenu(null)}
          onOpenAddNode={(pos) => {
            setAddNodePos(pos);
            setIsAddNodeOpen(true);
          }}
          onOpenConnectBranch={(srcId) => {
            setConnectBranchSourceId(srcId);
            setIsConnectBranchOpen(true);
          }}
          onOpenManageSectors={() => setIsManageSectorsOpen(true)}
          onOpenModifyModal={() => setIsMultiModifyOpen(true)}
        />
      )}

      {/* Context Menu Modals */}
      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        initialPosition={addNodePos}
      />
      <ConnectBranchModal
        isOpen={isConnectBranchOpen}
        onClose={() => setIsConnectBranchOpen(false)}
        initialSourceId={connectBranchSourceId}
      />
      <ManageSectorsModal
        isOpen={isManageSectorsOpen}
        onClose={() => setIsManageSectorsOpen(false)}
      />
      <MultiSelectModifyModal
        isOpen={isMultiModifyOpen}
        onClose={() => setIsMultiModifyOpen(false)}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default PartnershipCanvas;
