/**
 * Temporal Model for VL-JEPA World Model
 * Handles temporal reasoning and motion prediction
 */

import type {
  WorldState,
  MotionPrediction,
  EventPrediction,
  Vector3,
} from "../types.js";

export class TemporalModel {
  private history: WorldState[] = [];
  private maxHistorySize = 100;

  /**
   * Add state to history
   */
  addState(state: WorldState): void {
    this.history.push({ ...state });

    // Keep only recent history
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Predict future motion of an object
   */
  predictMotion(objectId: string, duration: number): MotionPrediction | null {
    if (this.history.length < 2) return null;

    // Find object in recent states
    const recentStates = this.history.slice(-10);
    const positions: Vector3[] = [];
    const velocities: Vector3[] = [];
    const timestamps: number[] = [];

    for (const state of recentStates) {
      const obj = state.objects.find(o => o.id === objectId);
      if (obj) {
        positions.push({ ...obj.position });
        timestamps.push(state.timestamp);
      }
    }

    if (positions.length < 2) return null;

    // Calculate velocity from recent positions
    const lastPos = positions[positions.length - 1];
    const prevPos = positions[positions.length - 2];
    const lastTime = timestamps[timestamps.length - 1];
    const prevTime = timestamps[timestamps.length - 2];
    const dt = Math.max(1, lastTime - prevTime) / 1000; // Convert to seconds

    const velocity = {
      x: (lastPos.x - prevPos.x) / dt,
      y: (lastPos.y - prevPos.y) / dt,
      z: (lastPos.z - prevPos.z) / dt,
    };

    // Predict future positions
    const predictionSteps = Math.ceil(duration / 100);
    for (let i = 0; i <= predictionSteps; i++) {
      const t = (i * 100) / 1000;
      positions.push({
        x: lastPos.x + velocity.x * t,
        y: lastPos.y + velocity.y * t,
        z: lastPos.z + velocity.z * t,
      });
      velocities.push({ ...velocity });
      timestamps.push(lastTime + i * 100);
    }

    return {
      objectId,
      positions,
      velocities,
      timestamps,
      confidence: this.calculateMotionConfidence(positions),
    };
  }

  /**
   * Calculate confidence in motion prediction
   */
  private calculateMotionConfidence(positions: Vector3[]): number {
    if (positions.length < 3) return 0.5;

    // Check for linearity (more linear = more confident)
    let error = 0;
    for (let i = 1; i < positions.length - 1; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const next = positions[i + 1];

      // Expected position if linear
      const expectedX = prev.x + (next.x - prev.x) / 2;
      const expectedY = prev.y + (next.y - prev.y) / 2;
      const expectedZ = prev.z + (next.z - prev.z) / 2;

      const deviation = Math.sqrt(
        (curr.x - expectedX) ** 2 +
          (curr.y - expectedY) ** 2 +
          (curr.z - expectedZ) ** 2
      );

      error += deviation;
    }

    // Convert error to confidence
    return Math.max(0, Math.min(1, 1 - error / 10));
  }

  /**
   * Predict next event
   */
  predictNextEvent(): EventPrediction | null {
    if (this.history.length < 2) return null;

    // Look for patterns in recent events
    const recentStates = this.history.slice(-20);
    const eventTypes = new Map<string, number>();

    for (const state of recentStates) {
      for (const event of state.events) {
        const count = eventTypes.get(event.type) || 0;
        eventTypes.set(event.type, count + 1);
      }
    }

    // Find most common event type
    let maxCount = 0;
    let mostCommonType: string | null = null;

    for (const [type, count] of eventTypes) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    }

    if (!mostCommonType) return null;

    return {
      eventType: mostCommonType,
      probability: maxCount / recentStates.length,
      participants: [],
      timeframe: [0, 1000],
      conditions: [],
    };
  }

  /**
   * Detect temporal patterns
   */
  detectPatterns(): Array<{ pattern: string; confidence: number }> {
    const patterns: Array<{ pattern: string; confidence: number }> = [];

    // Check for periodic events
    if (this.history.length > 10) {
      const intervals: number[] = [];

      for (let i = 2; i < this.history.length; i++) {
        const prev = this.history[i - 1];
        const curr = this.history[i];

        if (prev.events.length > 0 && curr.events.length > 0) {
          intervals.push(curr.timestamp - prev.timestamp);
        }
      }

      if (intervals.length > 3) {
        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance =
          intervals.reduce((sum, val) => sum + (val - avgInterval) ** 2, 0) /
          intervals.length;
        const stdDev = Math.sqrt(variance);

        // If low variance, it's periodic
        if (stdDev / avgInterval < 0.2) {
          patterns.push({
            pattern: `periodic_${Math.round(avgInterval)}ms`,
            confidence: 1 - stdDev / avgInterval,
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Get history
   */
  getHistory(): WorldState[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }
}
