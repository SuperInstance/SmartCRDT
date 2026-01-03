/**
 * @fileoverview Rollback manager for reverting to previous model states
 * @package @lsi/vljepa-training
 */

import type { CheckpointInfo, TrainingState } from "../types.js";
import { CheckpointManager } from "./CheckpointManager.js";
import { ModelRegistry } from "./ModelRegistry.js";
import { rename, copyFile } from "fs/promises";
import { join, basename } from "path";

/**
 * Rollback point information
 */
interface RollbackPoint {
  id: string;
  checkpointPath: string;
  epoch: number;
  metrics: {
    loss: number;
    accuracy?: number;
  };
  timestamp: number;
  description?: string;
}

/**
 * Rollback options
 */
interface RollbackOptions {
  createBackup: boolean;
  backupSuffix: string;
  validateAfterRollback: boolean;
  keepCurrentState: boolean;
}

/**
 * Rollback manager for reverting training to previous states
 *
 * Features:
 * - Create rollback points
 * - Rollback to specific checkpoint
 * - Rollback to best checkpoint
 * - Rollback to specific epoch
 * - Backup current state before rollback
 * - Validation after rollback
 */
export class RollbackManager {
  private checkpointManager: CheckpointManager;
  private modelRegistry: ModelRegistry;
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private rollbackHistory: RollbackPoint[] = [];
  private maxHistorySize = 100;

  constructor(
    checkpointManager: CheckpointManager,
    modelRegistry: ModelRegistry
  ) {
    this.checkpointManager = checkpointManager;
    this.modelRegistry = modelRegistry;
  }

  /**
   * Create a rollback point
   */
  async createRollbackPoint(params: {
    epoch: number;
    metrics: { loss: number; accuracy?: number };
    description?: string;
  }): Promise<string> {
    const { epoch, metrics, description } = params;

    // Get current checkpoint
    const latestCheckpoint = this.checkpointManager.getLatestCheckpoint();
    if (!latestCheckpoint) {
      throw new Error("No checkpoint available for rollback point");
    }

    // Create rollback point
    const id = `rollback_${epoch}_${Date.now()}`;
    const rollbackPoint: RollbackPoint = {
      id,
      checkpointPath: latestCheckpoint.path,
      epoch,
      metrics,
      timestamp: Date.now(),
      description,
    };

    this.rollbackPoints.set(id, rollbackPoint);
    this.rollbackHistory.push(rollbackPoint);

    // Limit history size
    if (this.rollbackHistory.length > this.maxHistorySize) {
      const removed = this.rollbackHistory.shift()!;
      this.rollbackPoints.delete(removed.id);
    }

    console.log(`[RollbackManager] Created rollback point: ${id}`);

    return id;
  }

  /**
   * Rollback to a specific rollback point
   */
  async rollbackTo(
    rollbackPointId: string,
    options: Partial<RollbackOptions> = {}
  ): Promise<TrainingState> {
    const opts: RollbackOptions = {
      createBackup: true,
      backupSuffix: ".before_rollback",
      validateAfterRollback: true,
      keepCurrentState: false,
      ...options,
    };

    const rollbackPoint = this.rollbackPoints.get(rollbackPointId);
    if (!rollbackPoint) {
      throw new Error(`Rollback point ${rollbackPointId} not found`);
    }

    console.log(`[RollbackManager] Rolling back to ${rollbackPointId}`);

    // Create backup if requested
    if (opts.createBackup) {
      await this.createBackup(rollbackPoint.checkpointPath, opts.backupSuffix);
    }

    // Load checkpoint
    const state = await this.checkpointManager.loadForResume(
      rollbackPoint.checkpointPath
    );
    if (!state) {
      throw new Error("Failed to load checkpoint for rollback");
    }

    // Validate if requested
    if (opts.validateAfterRollback) {
      const isValid = await this.validateRollback(state);
      if (!isValid) {
        throw new Error("Rollback validation failed");
      }
    }

    console.log(
      `[RollbackManager] Rollback complete to epoch ${rollbackPoint.epoch}`
    );

    return state;
  }

  /**
   * Rollback to best checkpoint
   */
  async rollbackToBest(
    options: Partial<RollbackOptions> = {}
  ): Promise<TrainingState> {
    const bestCheckpoint = this.checkpointManager.getBestCheckpoint();
    if (!bestCheckpoint) {
      throw new Error("No best checkpoint available");
    }

    // Find or create rollback point for best checkpoint
    let rollbackPointId: string | null = null;
    for (const [id, point] of this.rollbackPoints) {
      if (point.checkpointPath === bestCheckpoint.path) {
        rollbackPointId = id;
        break;
      }
    }

    if (!rollbackPointId) {
      rollbackPointId = await this.createRollbackPoint({
        epoch: bestCheckpoint.epoch,
        metrics: {
          loss: bestCheckpoint.metrics.loss.validation,
          accuracy: bestCheckpoint.metrics.accuracy.top1,
        },
        description: "Best checkpoint rollback",
      });
    }

    return await this.rollbackTo(rollbackPointId, options);
  }

  /**
   * Rollback to specific epoch
   */
  async rollbackToEpoch(
    epoch: number,
    options: Partial<RollbackOptions> = {}
  ): Promise<TrainingState> {
    const checkpoints = this.checkpointManager.listCheckpoints();
    const targetCheckpoint = checkpoints.find(c => c.epoch === epoch);

    if (!targetCheckpoint) {
      throw new Error(`No checkpoint found for epoch ${epoch}`);
    }

    // Find or create rollback point
    let rollbackPointId: string | null = null;
    for (const [id, point] of this.rollbackPoints) {
      if (point.checkpointPath === targetCheckpoint.path) {
        rollbackPointId = id;
        break;
      }
    }

    if (!rollbackPointId) {
      rollbackPointId = await this.createRollbackPoint({
        epoch,
        metrics: {
          loss: targetCheckpoint.metrics.loss.validation,
          accuracy: targetCheckpoint.metrics.accuracy.top1,
        },
        description: `Epoch ${epoch} rollback`,
      });
    }

    return await this.rollbackTo(rollbackPointId, options);
  }

  /**
   * List available rollback points
   */
  listRollbackPoints(): RollbackPoint[] {
    return Array.from(this.rollbackPoints.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get rollback point
   */
  getRollbackPoint(id: string): RollbackPoint | null {
    return this.rollbackPoints.get(id) || null;
  }

  /**
   * Delete a rollback point
   */
  async deleteRollbackPoint(id: string): Promise<void> {
    this.rollbackPoints.delete(id);
    this.rollbackHistory = this.rollbackHistory.filter(p => p.id !== id);
    console.log(`[RollbackManager] Deleted rollback point: ${id}`);
  }

  /**
   * Get rollback history
   */
  getHistory(): RollbackPoint[] {
    return [...this.rollbackHistory];
  }

  /**
   * Clear all rollback points
   */
  async clearAll(): Promise<void> {
    this.rollbackPoints.clear();
    this.rollbackHistory = [];
    console.log("[RollbackManager] Cleared all rollback points");
  }

  /**
   * Create backup of checkpoint
   */
  private async createBackup(
    checkpointPath: string,
    suffix: string
  ): Promise<void> {
    const backupPath = checkpointPath + suffix;
    await copyFile(checkpointPath, backupPath);
    console.log(`[RollbackManager] Created backup: ${basename(backupPath)}`);
  }

  /**
   * Validate rollback state
   */
  private async validateRollback(state: TrainingState): Promise<boolean> {
    // In a real implementation, would run validation checks
    console.log(
      `[RollbackManager] Validating rollback to epoch ${state.epoch}`
    );

    // Check if state has required fields
    if (state.epoch < 0) {
      return false;
    }

    if (!state.modelState) {
      return false;
    }

    return true;
  }

  /**
   * Compare metrics between rollback points
   */
  compareMetrics(
    id1: string,
    id2: string
  ): {
    point1: RollbackPoint;
    point2: RollbackPoint;
    lossDiff: number;
    accuracyDiff?: number;
  } | null {
    const point1 = this.rollbackPoints.get(id1);
    const point2 = this.rollbackPoints.get(id2);

    if (!point1 || !point2) {
      return null;
    }

    const lossDiff = point2.metrics.loss - point1.metrics.loss;
    const accuracyDiff =
      point1.metrics.accuracy !== undefined &&
      point2.metrics.accuracy !== undefined
        ? point2.metrics.accuracy - point1.metrics.accuracy
        : undefined;

    return {
      point1,
      point2,
      lossDiff,
      accuracyDiff,
    };
  }

  /**
   * Get recommended rollback point based on metrics
   */
  getRecommendedRollback(): RollbackPoint | null {
    const points = this.listRollbackPoints();
    if (points.length === 0) {
      return null;
    }

    // Return point with lowest loss
    return points.reduce((best, current) =>
      current.metrics.loss < best.metrics.loss ? current : best
    );
  }

  /**
   * Export rollback points as JSON
   */
  exportRollbackPoints(): string {
    return JSON.stringify(this.rollbackHistory, null, 2);
  }

  /**
   * Import rollback points from JSON
   */
  importRollbackPoints(json: string): void {
    const points = JSON.parse(json) as RollbackPoint[];
    this.rollbackHistory = points;
    this.rollbackPoints.clear();

    for (const point of points) {
      this.rollbackPoints.set(point.id, point);
    }

    console.log(`[RollbackManager] Imported ${points.length} rollback points`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRollbackPoints: number;
    historySize: number;
    earliestEpoch: number;
    latestEpoch: number;
  } {
    const points = this.listRollbackPoints();
    const epochs = points.map(p => p.epoch);

    return {
      totalRollbackPoints: this.rollbackPoints.size,
      historySize: this.rollbackHistory.length,
      earliestEpoch: epochs.length > 0 ? Math.min(...epochs) : 0,
      latestEpoch: epochs.length > 0 ? Math.max(...epochs) : 0,
    };
  }
}
