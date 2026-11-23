/**
 * QualCount: Visual Multiplex Partnership Management System
 * Pure Local Rectangular Anti-Overlap Engine (src/engine/overlap.ts)
 * 
 * Detects rectangular bounding-box collisions with a 24px safety margin.
 * When the user drags and drops a node card, the dropped card remains strictly
 * anchored at its exact coordinates, while only colliding neighbor cards are
 * nudged apart along the axis of minimum penetration.
 * 
 * Pure TypeScript (zero DOM/React/storage dependencies).
 */

import type { Placement } from '../types/schema';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFixed?: boolean;
}

export interface CollisionResolutionResult {
  positions: Record<string, { x: number; y: number }>;
  movedNodeIds: string[];
}

// ---------------------------------------------------------------------------
// AABB Collision Detection with Margin
// ---------------------------------------------------------------------------

/**
 * Checks whether two rectangular bounding boxes collide, enforcing a minimum
 * clearance safety margin on all sides.
 * 
 * @param boxA First bounding box
 * @param boxB Second bounding box
 * @param margin Required clearance distance between boxes (default 24px)
 */
export function checkAABBCollision(
  boxA: BoundingBox,
  boxB: BoundingBox,
  margin: number = 24
): { collides: boolean; overlapX: number; overlapY: number } {
  const centerAX = boxA.x + boxA.width / 2;
  const centerAY = boxA.y + boxA.height / 2;
  const centerBX = boxB.x + boxB.width / 2;
  const centerBY = boxB.y + boxB.height / 2;

  const halfWidthA = boxA.width / 2;
  const halfWidthB = boxB.width / 2;
  const halfHeightA = boxA.height / 2;
  const halfHeightB = boxB.height / 2;

  const dx = Math.abs(centerBX - centerAX);
  const dy = Math.abs(centerBY - centerAY);

  const reqDistanceX = halfWidthA + halfWidthB + margin;
  const reqDistanceY = halfHeightA + halfHeightB + margin;

  const overlapX = reqDistanceX - dx;
  const overlapY = reqDistanceY - dy;

  if (overlapX > 0 && overlapY > 0) {
    return {
      collides: true,
      overlapX,
      overlapY,
    };
  }

  return {
    collides: false,
    overlapX: Math.max(0, overlapX),
    overlapY: Math.max(0, overlapY),
  };
}

// ---------------------------------------------------------------------------
// Iterative Local Anti-Overlap Resolution
// ---------------------------------------------------------------------------

/**
 * Iteratively resolves bounding-box overlaps among cards.
 * If anchoredPlacementId is specified, that card remains strictly fixed in place
 * (its x and y coordinates are never modified), and only colliding neighbors are shifted.
 * Uninvolved cards stay completely stationary.
 */
export function resolveLocalCollisions(
  placements: Record<string, Placement>,
  anchoredPlacementId?: string,
  margin: number = 24,
  maxIterations: number = 50
): CollisionResolutionResult {
  const boxes: Map<string, BoundingBox> = new Map();

  for (const [id, p] of Object.entries(placements)) {
    boxes.set(id, {
      id,
      x: p.x ?? 0,
      y: p.y ?? 0,
      width: p.width || 190,
      height: p.height || 76,
      isFixed: id === anchoredPlacementId,
    });
  }

  const boxList = Array.from(boxes.values());

  for (let iter = 0; iter < maxIterations; iter++) {
    let hasCollision = false;
    // Sweep-and-prune spatial optimization: sort by X axis to skip distant non-overlapping pairs
    boxList.sort((a, b) => a.x - b.x);

    for (let i = 0; i < boxList.length; i++) {
      const boxA = boxList[i];
      const maxReachX = boxA.x + boxA.width + margin;

      for (let j = i + 1; j < boxList.length; j++) {
        const boxB = boxList[j];
        if (boxB.x > maxReachX) {
          // Since boxList is sorted by x, no subsequent box can overlap with boxA in x
          break;
        }

        const { collides, overlapX, overlapY } = checkAABBCollision(
          boxA,
          boxB,
          margin
        );

        if (!collides) {
          continue;
        }

        hasCollision = true;

        const centerAX = boxA.x + boxA.width / 2;
        const centerAY = boxA.y + boxA.height / 2;
        const centerBX = boxB.x + boxB.width / 2;
        const centerBY = boxB.y + boxB.height / 2;

        // Displace along axis of minimum penetration
        if (overlapX < overlapY) {
          // Horizontal shift
          const dir = centerBX >= centerAX ? 1 : -1;

          if (boxA.isFixed && !boxB.isFixed) {
            boxB.x += dir * overlapX;
          } else if (boxB.isFixed && !boxA.isFixed) {
            boxA.x -= dir * overlapX;
          } else if (!boxA.isFixed && !boxB.isFixed) {
            boxA.x -= dir * (overlapX / 2);
            boxB.x += dir * (overlapX / 2);
          }
        } else {
          // Vertical shift
          const dir = centerBY >= centerAY ? 1 : -1;

          if (boxA.isFixed && !boxB.isFixed) {
            boxB.y += dir * overlapY;
          } else if (boxB.isFixed && !boxA.isFixed) {
            boxA.y -= dir * overlapY;
          } else if (!boxA.isFixed && !boxB.isFixed) {
            boxA.y -= dir * (overlapY / 2);
            boxB.y += dir * (overlapY / 2);
          }
        }
      }
    }

    if (!hasCollision) {
      break;
    }
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const movedNodeIds: string[] = [];

  for (const [id, box] of boxes.entries()) {
    const finalX = Math.round(box.x);
    const finalY = Math.round(box.y);
    positions[id] = { x: finalX, y: finalY };

    const orig = placements[id];
    if (orig && (finalX !== Math.round(orig.x) || finalY !== Math.round(orig.y))) {
      movedNodeIds.push(id);
    }
  }

  return {
    positions,
    movedNodeIds,
  };
}
