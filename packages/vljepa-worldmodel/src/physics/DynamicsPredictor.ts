/**
 * Dynamics Predictor for VL-JEPA World Model
 * Predicts object motion and dynamics
 */

import type { Vector3, WorldObject, WorldState } from "../types.js";

export interface DynamicsPrediction {
  objectId: string;
  futurePositions: Vector3[];
  velocities: Vector3[];
  timestamps: number[];
  confidence: number;
}

export class DynamicsPredictor {
  /**
   * Predict future motion
   */
  predict(
    object: WorldObject,
    history: WorldState[],
    duration: number,
    steps: number = 10
  ): DynamicsPrediction | null {
    if (history.length < 2) {
      // Assume no motion
      return this.createStaticPrediction(object, duration, steps);
    }

    // Estimate velocity from history
    const velocity = this.estimateVelocity(history, object.id);
    if (!velocity) {
      return this.createStaticPrediction(object, duration, steps);
    }

    const positions: Vector3[] = [];
    const velocities: Vector3[] = [];
    const timestamps: number[] = [];
    const dt = duration / steps;

    for (let i = 0; i <= steps; i++) {
      const t = (i * dt) / 1000; // Convert to seconds
      positions.push({
        x: object.position.x + velocity.x * t,
        y: Math.max(0, object.position.y + velocity.y * t - 4.9 * t * t), // Add gravity
        z: object.position.z + velocity.z * t,
      });
      velocities.push({
        x: velocity.x,
        y: velocity.y - 9.8 * t, // Apply gravity
        z: velocity.z,
      });
      timestamps.push(Date.now() + i * dt);
    }

    return {
      objectId: object.id,
      futurePositions: positions,
      velocities,
      timestamps,
      confidence: this.calculateConfidence(history, object.id),
    };
  }

  /**
   * Create static prediction (no motion)
   */
  private createStaticPrediction(
    object: WorldObject,
    duration: number,
    steps: number
  ): DynamicsPrediction {
    const positions: Vector3[] = [];
    const velocities: Vector3[] = [];
    const timestamps: number[] = [];
    const dt = duration / steps;

    for (let i = 0; i <= steps; i++) {
      const t = (i * dt) / 1000;
      positions.push({
        x: object.position.x,
        y: Math.max(0, object.position.y - 4.9 * t * t),
        z: object.position.z,
      });
      velocities.push({ x: 0, y: -9.8 * t, z: 0 });
      timestamps.push(Date.now() + i * dt);
    }

    return {
      objectId: object.id,
      futurePositions: positions,
      velocities,
      timestamps,
      confidence: 0.5,
    };
  }

  /**
   * Estimate velocity from history
   */
  private estimateVelocity(
    history: WorldState[],
    objectId: string
  ): Vector3 | null {
    const recent = history
      .filter(s => s.objects.some(o => o.id === objectId))
      .slice(-5);

    if (recent.length < 2) return null;

    const first = recent[0].objects.find(o => o.id === objectId);
    const last = recent[recent.length - 1].objects.find(o => o.id === objectId);

    if (!first || !last) return null;

    const dt = Math.max(1, 1); // Assume 1 second if no timestamp

    return {
      x: (last.position.x - first.position.x) / dt,
      y: (last.position.y - first.position.y) / dt,
      z: (last.position.z - first.position.z) / dt,
    };
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(history: WorldState[], objectId: string): number {
    const relevant = history.filter(s =>
      s.objects.some(o => o.id === objectId)
    );

    if (relevant.length < 3) return 0.3;
    if (relevant.length < 5) return 0.5;
    return 0.8;
  }
}
