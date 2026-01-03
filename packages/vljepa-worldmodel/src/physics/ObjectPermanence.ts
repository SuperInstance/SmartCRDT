/**
 * Object Permanence for VL-JEPA World Model
 * Tracks objects through occlusion and predicts reappearance
 */

import type {
  PermanenceConfig,
  ObjectTracking,
  StateSnapshot,
  Vector3,
  Trajectory,
} from "../types.js";

export class ObjectPermanence {
  private config: PermanenceConfig;
  private trackedObjects: Map<string, ObjectTracking> = new Map();

  constructor(config?: Partial<PermanenceConfig>) {
    this.config = {
      maxOcclusionTime: 5000, // 5 seconds
      predictionUncertainty: 0.1, // 10% growth per second
      memoryDecay: 0.95,
      occlusionTolerance: 10,
      ...config,
    };
  }

  /**
   * Update tracking for an object
   */
  updateObject(
    objectId: string,
    snapshot: StateSnapshot,
    visible: boolean
  ): ObjectTracking | null {
    let tracking = this.trackedObjects.get(objectId);

    if (!tracking) {
      tracking = this.createTracking(objectId, snapshot);
      this.trackedObjects.set(objectId, tracking);
    }

    if (visible) {
      // Object is visible, update tracking
      this.updateVisible(tracking, snapshot);
    } else {
      // Object is occluded, predict position
      this.updateOccluded(tracking, snapshot);
    }

    // Check if object has been occluded too long
    const occludedDuration = Date.now() - tracking.occludedSince;
    if (occludedDuration > this.config.maxOcclusionTime) {
      this.trackedObjects.delete(objectId);
      return null;
    }

    return tracking;
  }

  /**
   * Create new tracking entry
   */
  private createTracking(
    objectId: string,
    snapshot: StateSnapshot
  ): ObjectTracking {
    return {
      objectId,
      visible: true,
      lastSeen: snapshot,
      predictedPosition: { ...snapshot.position },
      uncertainty: 0,
      trajectory: {
        positions: [{ ...snapshot.position }],
        velocities: [{ ...snapshot.velocity }],
        timestamps: [snapshot.timestamp],
      },
      occludedSince: Date.now(),
      reappearanceProb: 1.0,
    };
  }

  /**
   * Update tracking for visible object
   */
  private updateVisible(
    tracking: ObjectTracking,
    snapshot: StateSnapshot
  ): void {
    tracking.visible = true;
    tracking.lastSeen = snapshot;
    tracking.predictedPosition = { ...snapshot.position };
    tracking.uncertainty = 0;
    tracking.occludedSince = Date.now();
    tracking.reappearanceProb = 1.0;

    // Update trajectory
    this.updateTrajectory(tracking, snapshot);
  }

  /**
   * Update tracking for occluded object
   */
  private updateOccluded(
    tracking: ObjectTracking,
    snapshot: StateSnapshot
  ): void {
    tracking.visible = false;

    // Predict position based on velocity
    const timeDiff = (snapshot.timestamp - tracking.lastSeen.timestamp) / 1000;
    const velocity = tracking.lastSeen.velocity;

    tracking.predictedPosition = {
      x: tracking.lastSeen.position.x + velocity.x * timeDiff,
      y: tracking.lastSeen.position.y + velocity.y * timeDiff,
      z: tracking.lastSeen.position.z + velocity.z * timeDiff,
    };

    // Increase uncertainty over time
    tracking.uncertainty = Math.min(
      1.0,
      tracking.uncertainty + timeDiff * this.config.predictionUncertainty
    );

    // Decay reappearance probability
    tracking.reappearanceProb *= Math.pow(this.config.memoryDecay, timeDiff);
  }

  /**
   * Update trajectory history
   */
  private updateTrajectory(
    tracking: ObjectTracking,
    snapshot: StateSnapshot
  ): void {
    const trajectory = tracking.trajectory;

    // Add new position
    trajectory.positions.push({ ...snapshot.position });
    trajectory.velocities.push({ ...snapshot.velocity });
    trajectory.timestamps.push(snapshot.timestamp);

    // Keep only last 100 positions to manage memory
    if (trajectory.positions.length > 100) {
      trajectory.positions.shift();
      trajectory.velocities.shift();
      trajectory.timestamps.shift();
    }
  }

  /**
   * Predict where an occluded object will reappear
   */
  predictReappearance(objectId: string): Vector3 | null {
    const tracking = this.trackedObjects.get(objectId);
    if (!tracking) return null;

    // If visible, return actual position
    if (tracking.visible) {
      return { ...tracking.lastSeen.position };
    }

    // If occluded, predict based on trajectory
    const now = Date.now();
    const timeSinceOcclusion = (now - tracking.occludedSince) / 1000;

    // Use velocity from last seen
    const velocity = tracking.lastSeen.velocity;
    const position = tracking.lastSeen.position;

    return {
      x: position.x + velocity.x * timeSinceOcclusion,
      y: position.y + velocity.y * timeSinceOcclusion,
      z: position.z + velocity.z * timeSinceOcclusion,
    };
  }

  /**
   * Get tracking info for an object
   */
  getTracking(objectId: string): ObjectTracking | undefined {
    return this.trackedObjects.get(objectId);
  }

  /**
   * Get all tracked objects
   */
  getAllTracking(): ObjectTracking[] {
    return Array.from(this.trackedObjects.values());
  }

  /**
   * Get only occluded objects
   */
  getOccludedObjects(): ObjectTracking[] {
    return Array.from(this.trackedObjects.values()).filter(t => !t.visible);
  }

  /**
   * Get only visible objects
   */
  getVisibleObjects(): ObjectTracking[] {
    return Array.from(this.trackedObjects.values()).filter(t => t.visible);
  }

  /**
   * Remove tracking for an object
   */
  removeObject(objectId: string): boolean {
    return this.trackedObjects.delete(objectId);
  }

  /**
   * Check if an object is being tracked
   */
  isTracking(objectId: string): boolean {
    return this.trackedObjects.has(objectId);
  }

  /**
   * Predict trajectory for an object
   */
  predictTrajectory(objectId: string, duration: number): Vector3[] | null {
    const tracking = this.trackedObjects.get(objectId);
    if (!tracking) return null;

    const positions: Vector3[] = [];
    const velocity = tracking.lastSeen.velocity;
    const position = tracking.visible
      ? tracking.lastSeen.position
      : tracking.predictedPosition;

    const steps = Math.ceil(duration / 100); // 100ms steps

    for (let i = 0; i <= steps; i++) {
      const t = (i * 100) / 1000; // Convert to seconds
      positions.push({
        x: position.x + velocity.x * t,
        y: position.y + velocity.y * t,
        z: position.z + velocity.z * t,
      });
    }

    return positions;
  }

  /**
   * Handle object that disappeared and reappeared
   */
  handleReappearance(
    objectId: string,
    newPosition: Vector3,
    timestamp: number
  ): StateSnapshot | null {
    const tracking = this.trackedObjects.get(objectId);
    if (!tracking) return null;

    // Check if reappearance is consistent with prediction
    const predicted = tracking.predictedPosition;
    const distance = Math.sqrt(
      (newPosition.x - predicted.x) ** 2 +
        (newPosition.y - predicted.y) ** 2 +
        (newPosition.z - predicted.z) ** 2
    );

    // If too far from prediction, might be a different object
    if (distance > 100) {
      // 100 pixels tolerance
      return null;
    }

    // Update tracking with new position
    const snapshot: StateSnapshot = {
      timestamp,
      position: newPosition,
      velocity: tracking.lastSeen.velocity, // Keep previous velocity
      rotation: tracking.lastSeen.rotation,
      appearance: tracking.lastSeen.appearance,
    };

    this.updateVisible(tracking, snapshot);

    return snapshot;
  }

  /**
   * Estimate object velocity from trajectory
   */
  estimateVelocity(objectId: string): Vector3 | null {
    const tracking = this.trackedObjects.get(objectId);
    if (!tracking || tracking.trajectory.positions.length < 2) {
      return null;
    }

    const trajectory = tracking.trajectory;
    const recentPositions = trajectory.positions.slice(-5);
    const recentTimestamps = trajectory.timestamps.slice(-5);

    // Fit line to recent positions
    let sumX = 0,
      sumY = 0,
      sumZ = 0;
    let sumT = 0;
    let count = 0;

    for (let i = 1; i < recentPositions.length; i++) {
      const dt = (recentTimestamps[i] - recentTimestamps[i - 1]) / 1000;
      if (dt > 0) {
        sumX += (recentPositions[i].x - recentPositions[i - 1].x) / dt;
        sumY += (recentPositions[i].y - recentPositions[i - 1].y) / dt;
        sumZ += (recentPositions[i].z - recentPositions[i - 1].z) / dt;
        sumT += dt;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
    };
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.trackedObjects.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTracked: number;
    visibleCount: number;
    occludedCount: number;
    avgUncertainty: number;
  } {
    const all = Array.from(this.trackedObjects.values());
    const visible = all.filter(t => t.visible);
    const occluded = all.filter(t => !t.visible);

    const avgUncertainty =
      all.length > 0
        ? all.reduce((sum, t) => sum + t.uncertainty, 0) / all.length
        : 0;

    return {
      totalTracked: all.length,
      visibleCount: visible.length,
      occludedCount: occluded.length,
      avgUncertainty,
    };
  }
}
