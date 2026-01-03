/**
 * Bounding Box Tracker for VL-JEPA World Model
 * Tracks bounding boxes over time
 */

import type { BoundingBox, Vector2 } from "../types.js";

export interface TrackedBox {
  id: string;
  box: BoundingBox;
  velocity: Vector2;
  timestamp: number;
  visible: boolean;
}

export class BoundingBoxTracker {
  private trackedBoxes: Map<string, TrackedBox> = new Map();
  private maxAge = 1000; // 1 second

  /**
   * Update tracking for a box
   */
  update(id: string, box: BoundingBox, timestamp: number): TrackedBox {
    const existing = this.trackedBoxes.get(id);

    if (existing) {
      // Calculate velocity
      const dt = Math.max(1, timestamp - existing.timestamp);
      const velocity = {
        x: (box.x - existing.box.x) / dt,
        y: (box.y - existing.box.y) / dt,
      };

      const tracked: TrackedBox = {
        id,
        box,
        velocity,
        timestamp,
        visible: true,
      };

      this.trackedBoxes.set(id, tracked);
      return tracked;
    } else {
      // New box
      const tracked: TrackedBox = {
        id,
        box,
        velocity: { x: 0, y: 0 },
        timestamp,
        visible: true,
      };

      this.trackedBoxes.set(id, tracked);
      return tracked;
    }
  }

  /**
   * Get tracked box
   */
  get(id: string): TrackedBox | undefined {
    return this.trackedBoxes.get(id);
  }

  /**
   * Remove box
   */
  remove(id: string): boolean {
    return this.trackedBoxes.delete(id);
  }

  /**
   * Predict future position
   */
  predictPosition(id: string, deltaTime: number): BoundingBox | null {
    const tracked = this.trackedBoxes.get(id);
    if (!tracked) return null;

    return {
      x: tracked.box.x + tracked.velocity.x * deltaTime,
      y: tracked.box.y + tracked.velocity.y * deltaTime,
      width: tracked.box.width,
      height: tracked.box.height,
    };
  }

  /**
   * Clean up old boxes
   */
  cleanup(currentTime: number): void {
    for (const [id, box] of this.trackedBoxes) {
      if (currentTime - box.timestamp > this.maxAge) {
        this.trackedBoxes.delete(id);
      }
    }
  }

  /**
   * Get all tracked boxes
   */
  getAll(): TrackedBox[] {
    return Array.from(this.trackedBoxes.values());
  }

  /**
   * Clear all tracking
   */
  clear(): void {
    this.trackedBoxes.clear();
  }
}
