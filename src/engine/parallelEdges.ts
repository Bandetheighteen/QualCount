/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Parallel Bezier Curve Offset Engine (src/engine/parallelEdges.ts)
 * 
 * Computes lateral Bezier curve offsets for concurrent multiplex branches
 * connecting the same pair of nodes (e.g. Funding Green + Relationship White +
 * Bridge Yellow) so lines, mid-line M% pills (t = 0.5), and end-of-line
 * Tick/Cross buttons (t = 0.8) never stack or collide.
 * 
 * Pure TypeScript (zero DOM/React/storage dependencies).
 */

import type { Branch } from '../types/schema';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface EdgeEndpoint {
  x: number;
  y: number;
}

export interface ParallelBranchGeometry {
  path: string;
  labelX: number;
  labelY: number;
  buttonX: number;
  buttonY: number;
  offsetDistance: number;
}

// ---------------------------------------------------------------------------
// Branch Grouping
// ---------------------------------------------------------------------------

/**
 * Groups branches connecting the same pair of placements regardless of direction,
 * using a canonical undirected pair key.
 */
export function groupParallelBranches(branches: Branch[]): Map<string, Branch[]> {
  const groups = new Map<string, Branch[]>();

  for (const branch of branches) {
    const p1 = branch.sourcePlacementId;
    const p2 = branch.targetPlacementId;
    const key = p1 < p2 ? `${p1}---${p2}` : `${p2}---${p1}`;

    const list = groups.get(key);
    if (list) {
      list.push(branch);
    } else {
      groups.set(key, [branch]);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Cubic Bezier Math Helper
// ---------------------------------------------------------------------------

/**
 * Evaluates a 1D cubic Bezier coordinate at parameter t in [0, 1].
 * B(t) = (1-t)^3 * p0 + 3(1-t)^2 * t * p1 + 3(1-t) * t^2 * p2 + t^3 * p3
 */
export function evaluateCubicBezier1D(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const s = 1 - t;
  return (
    s * s * s * p0 +
    3 * s * s * t * p1 +
    3 * s * t * t * p2 +
    t * t * t * p3
  );
}

// ---------------------------------------------------------------------------
// Lateral Bezier Curve Computation
// ---------------------------------------------------------------------------

/**
 * Computes symmetric lateral Bezier curve offset and exact coordinates for:
 * - Mid-line M% pill (t = 0.5)
 * - End-of-line Tick / Cross buttons (t = 0.8)
 * 
 * @param source Starting endpoint (x, y)
 * @param target Ending endpoint (x, y)
 * @param index 0-based index of this branch within its parallel group
 * @param total Total number of parallel branches connecting this pair
 * @param spacing Lateral pixel clearance between parallel branches (default 36px)
 * @param isReverse Optional boolean indicating if this branch runs in reverse of canonical pair direction
 * @param buttonT Optional parameter t for positioning action buttons (default 0.8, or ~0.88-0.92 under target node)
 */
export function computeParallelBezierCurve(
  source: EdgeEndpoint,
  target: EdgeEndpoint,
  index: number,
  total: number,
  spacing: number = 36,
  isReverse?: boolean,
  buttonT: number = 0.8
): ParallelBranchGeometry {
  // Symmetric displacement offset: e.g. for total = 2, offsets are -18 and +18.
  // For total = 1, offset is strictly 0.
  const d = total <= 1 ? 0 : (index - (total - 1) / 2) * spacing;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // If endpoints are virtually identical (degenerate edge), return zero-length line
  if (len < 1) {
    return {
      path: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
      labelX: source.x,
      labelY: source.y,
      buttonX: target.x,
      buttonY: target.y,
      offsetDistance: 0,
    };
  }

  // Canonical ordering for consistent lateral offset direction in world space:
  // In bottom-to-top layout, canonical direction is bottom (larger y) to top (smaller y).
  // If endpoints have identical y, canonical direction is left (smaller x) to right (larger x).
  const isReversed =
    isReverse !== undefined
      ? isReverse
      : source.y < target.y || (source.y === target.y && source.x > target.x);

  // Invert displacement offset along local normal when branch is reversed,
  // preventing opposing parallel branches from curving into the same lane.
  const effectiveD = isReversed ? -d : d;

  // Unit normal vector perpendicular to direction vector (dx, dy)
  const nx = -dy / len;
  const ny = dx / len;

  // Control points: baseline vertical curvature with lateral normal offset
  const cp1x = source.x + nx * effectiveD;
  const cp1y = source.y + dy * 0.35 + ny * effectiveD;

  const cp2x = target.x + nx * effectiveD;
  const cp2y = target.y - dy * 0.35 + ny * effectiveD;

  const path = `M ${source.x} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${target.x} ${target.y}`;

  // Evaluate exact coordinates at t = 0.5 (midpoint) and t = buttonT (near target / under node)
  const labelX = evaluateCubicBezier1D(source.x, cp1x, cp2x, target.x, 0.5);
  const labelY = evaluateCubicBezier1D(source.y, cp1y, cp2y, target.y, 0.5);

  const buttonX = evaluateCubicBezier1D(source.x, cp1x, cp2x, target.x, buttonT);
  const buttonY = evaluateCubicBezier1D(source.y, cp1y, cp2y, target.y, buttonT);

  return {
    path,
    labelX,
    labelY,
    buttonX,
    buttonY,
    offsetDistance: d,
  };
}
