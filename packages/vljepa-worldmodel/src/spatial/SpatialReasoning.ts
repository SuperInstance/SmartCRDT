/**
 * Spatial Reasoning for VL-JEPA World Model
 * Handles spatial relationships and reasoning
 */

import type { Vector3, SpatialRelation, WorldObject } from "../types.js";

export class SpatialReasoner {
  /**
   * Determine spatial relationship between two objects
   */
  determineRelation(
    objA: WorldObject,
    objB: WorldObject
  ): SpatialRelation | null {
    const posA = objA.position;
    const posB = objB.position;

    // Calculate relative position
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;

    // Check for "above"/"below" (Y-axis)
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)) {
      return {
        id: `rel-${objA.id}-${objB.id}`,
        subject: objA.id,
        object: objB.id,
        relation: dy > 0 ? "above" : "below",
        confidence: this.calculateConfidence(dx, dy, dz),
      };
    }

    // Check for "left"/"right" (X-axis)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
      return {
        id: `rel-${objA.id}-${objB.id}`,
        subject: objA.id,
        object: objB.id,
        relation: dx > 0 ? "right" : "left",
        confidence: this.calculateConfidence(dx, dy, dz),
      };
    }

    // Check for "front"/"behind" (Z-axis)
    if (Math.abs(dz) > Math.abs(dx) && Math.abs(dz) > Math.abs(dy)) {
      return {
        id: `rel-${objA.id}-${objB.id}`,
        subject: objA.id,
        object: objB.id,
        relation: dz > 0 ? "front" : "behind",
        confidence: this.calculateConfidence(dx, dy, dz),
      };
    }

    // Check for "near" (all axes small)
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance < 2) {
      return {
        id: `rel-${objA.id}-${objB.id}`,
        subject: objA.id,
        object: objB.id,
        relation: "near",
        confidence: 1 - distance / 2,
      };
    }

    return null;
  }

  /**
   * Calculate confidence in spatial relation
   */
  private calculateConfidence(dx: number, dy: number, dz: number): number {
    const magnitudes = [Math.abs(dx), Math.abs(dy), Math.abs(dz)];
    const max = Math.max(...magnitudes);
    const sum = magnitudes.reduce((a, b) => a + b, 0);

    return max / sum;
  }

  /**
   * Calculate distance between two positions
   */
  distance(posA: Vector3, posB: Vector3): number {
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find nearest object to a position
   */
  findNearest(objects: WorldObject[], position: Vector3): WorldObject | null {
    let nearest: WorldObject | null = null;
    let minDistance = Infinity;

    for (const obj of objects) {
      const dist = this.distance(position, obj.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = obj;
      }
    }

    return nearest;
  }

  /**
   * Find objects within radius
   */
  findWithinRadius(
    objects: WorldObject[],
    position: Vector3,
    radius: number
  ): WorldObject[] {
    return objects.filter(
      obj => this.distance(position, obj.position) <= radius
    );
  }

  /**
   * Check if point is inside bounding box
   */
  isInside(point: Vector3, min: Vector3, max: Vector3): boolean {
    return (
      point.x >= min.x &&
      point.x <= max.x &&
      point.y >= min.y &&
      point.y <= max.y &&
      point.z >= min.z &&
      point.z <= max.z
    );
  }

  /**
   * Get bounding box of object
   */
  getBoundingBox(obj: WorldObject): { min: Vector3; max: Vector3 } {
    const halfSize = 0.5; // Assuming unit size

    return {
      min: {
        x: obj.position.x - halfSize,
        y: obj.position.y - halfSize,
        z: obj.position.z - halfSize,
      },
      max: {
        x: obj.position.x + halfSize,
        y: obj.position.y + halfSize,
        z: obj.position.z + halfSize,
      },
    };
  }
}
