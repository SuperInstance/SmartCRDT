/**
 * Intuitive Physics for VL-JEPA World Model
 * Human-like physics reasoning without precise calculations
 */

import type { Vector3, WorldObject } from "../types.js";

export interface PhysicsJudgment {
  type: "stable" | "unstable" | "falling" | "supported";
  confidence: number;
  reason: string;
}

export class IntuitivePhysics {
  /**
   * Judge stability of an object
   */
  judgeStability(
    object: WorldObject,
    allObjects: WorldObject[]
  ): PhysicsJudgment {
    // Check if object is on ground
    if (object.position.y <= 0.1) {
      return {
        type: "stable",
        confidence: 0.95,
        reason: "object is on ground",
      };
    }

    // Check if object is supported by another
    const supporter = this.findSupport(object, allObjects);
    if (supporter) {
      return {
        type: "supported",
        confidence: 0.8,
        reason: `supported by ${supporter.id}`,
      };
    }

    // Object is in air, will fall
    return {
      type: "falling",
      confidence: 0.9,
      reason: "object is unsupported",
    };
  }

  /**
   * Find object that supports another
   */
  private findSupport(
    object: WorldObject,
    allObjects: WorldObject[]
  ): WorldObject | null {
    for (const other of allObjects) {
      if (other.id === object.id) continue;

      // Check if other is below object
      if (other.position.y < object.position.y) {
        const dx = Math.abs(object.position.x - other.position.x);
        const dz = Math.abs(object.position.z - other.position.z);
        const dy = object.position.y - other.position.y;

        // If close horizontally and close vertically
        if (dx < 0.5 && dz < 0.5 && dy < 0.5) {
          return other;
        }
      }
    }

    return null;
  }

  /**
   * Predict if object will fall
   */
  willFall(object: WorldObject, allObjects: WorldObject[]): boolean {
    const judgment = this.judgeStability(object, allObjects);
    return judgment.type === "falling";
  }

  /**
   * Predict where object will land
   */
  predictLanding(
    object: WorldObject,
    allObjects: WorldObject[]
  ): Vector3 | null {
    // If already on ground
    if (object.position.y <= 0.1) {
      return object.position;
    }

    // Check if will land on another object
    const supporter = this.findSupport(object, allObjects);
    if (supporter) {
      return {
        x: supporter.position.x,
        y: supporter.position.y + 0.5,
        z: supporter.position.z,
      };
    }

    // Will land on ground
    return {
      x: object.position.x,
      y: 0,
      z: object.position.z,
    };
  }

  /**
   * Judge if container can hold object
   */
  canContain(container: WorldObject, object: WorldObject): boolean {
    // Simple size check
    const containerSize = 1; // Assume unit size
    const objectSize = 0.5;

    return objectSize < containerSize;
  }

  /**
   * Predict stack stability
   */
  judgeStackStability(objects: WorldObject[]): {
    stable: boolean;
    confidence: number;
    reason: string;
  } {
    if (objects.length === 0) {
      return { stable: true, confidence: 1, reason: "empty stack" };
    }

    // Check each level
    for (let i = 0; i < objects.length - 1; i++) {
      const current = objects[i];
      const above = objects[i + 1];

      const dx = Math.abs(current.position.x - above.position.x);
      const dz = Math.abs(current.position.z - above.position.z);

      // If not aligned, unstable
      if (dx > 0.3 || dz > 0.3) {
        return {
          stable: false,
          confidence: 0.7,
          reason: `misaligned at level ${i}`,
        };
      }
    }

    return {
      stable: true,
      confidence: 0.8,
      reason: "well-aligned stack",
    };
  }
}
