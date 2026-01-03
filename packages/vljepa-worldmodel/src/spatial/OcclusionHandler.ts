/**
 * Occlusion Handler for VL-JEPA World Model
 * Handles occluded objects and visibility
 */

import type { BoundingBox, Vector2 } from "../types.js";

export interface OcclusionResult {
  occluded: boolean;
  occluder: string | null;
  visibleRegion: BoundingBox | null;
}

export class OcclusionHandler {
  /**
   * Check if box is occluded by another
   */
  isOccluded(
    box: BoundingBox,
    by: BoundingBox,
    zOrder: number
  ): OcclusionResult {
    // Check for overlap
    const overlap = this.getOverlap(box, by);

    if (!overlap) {
      return {
        occluded: false,
        occluder: null,
        visibleRegion: box,
      };
    }

    // Check if completely occluded
    const isComplete =
      overlap.width >= box.width && overlap.height >= box.height;

    if (isComplete) {
      return {
        occluded: true,
        occluder: "unknown",
        visibleRegion: null,
      };
    }

    // Partial occlusion
    return {
      occluded: false,
      occluder: null,
      visibleRegion: overlap,
    };
  }

  /**
   * Get overlap between two boxes
   */
  private getOverlap(boxA: BoundingBox, boxB: BoundingBox): BoundingBox | null {
    const x1 = Math.max(boxA.x, boxB.x);
    const y1 = Math.max(boxA.y, boxB.y);
    const x2 = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
    const y2 = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

    if (x2 > x1 && y2 > y1) {
      return {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      };
    }

    return null;
  }

  /**
   * Handle multiple occluders
   */
  handleMultiple(
    target: BoundingBox,
    occluders: Array<{ box: BoundingBox; zIndex: number }>
  ): OcclusionResult {
    let visibleRegion = target;
    let anyOccluded = false;

    // Sort by z-index (higher values occlude lower)
    const sorted = [...occluders].sort((a, b) => b.zIndex - a.zIndex);

    for (const occluder of sorted) {
      const result = this.isOccluded(
        visibleRegion,
        occluder.box,
        occluder.zIndex
      );

      if (result.visibleRegion) {
        visibleRegion = result.visibleRegion;
      } else {
        return {
          occluded: true,
          occluder: "unknown",
          visibleRegion: null,
        };
      }

      anyOccluded = anyOccluded || result.occluded;
    }

    return {
      occluded: anyOccluded,
      occluder: anyOccluded ? "multiple" : null,
      visibleRegion,
    };
  }

  /**
   * Calculate occlusion percentage
   */
  calculateOcclusionPercentage(
    target: BoundingBox,
    occluders: BoundingBox[]
  ): number {
    let occludedArea = 0;
    const targetArea = target.width * target.height;

    for (const occluder of occluders) {
      const overlap = this.getOverlap(target, occluder);
      if (overlap) {
        occludedArea += overlap.width * overlap.height;
      }
    }

    return Math.min(1, occludedArea / targetArea);
  }
}
