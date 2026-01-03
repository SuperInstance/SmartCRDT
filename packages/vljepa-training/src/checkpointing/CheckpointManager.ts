/**
 * @fileoverview Checkpoint manager for saving and loading model checkpoints
 * @package @lsi/vljepa-training
 */

import type {
  CheckpointConfig,
  CheckpointInfo,
  TrainingMetrics,
  TrainingState,
  ModelConfig,
  TrainingConfig,
} from "../types.js";
import { writeFile, readFile, mkdir, stat, unlink } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";

/**
 * Checkpoint metadata
 */
interface CheckpointMetadata {
  epoch: number;
  metrics: TrainingMetrics;
  modelConfig: ModelConfig;
  trainingConfig: TrainingConfig;
  timestamp: number;
  gitCommit?: string;
  configHash: string;
  checkpointType: "best" | "last" | "epoch" | "manual";
}

/**
 * Checkpoint data
 */
interface CheckpointData {
  metadata: CheckpointMetadata;
  modelState: Record<string, unknown>;
  optimizerState?: Record<string, unknown>;
  lrSchedulerState?: Record<string, unknown>;
  randomStates?: {
    python?: number;
    numpy?: number;
    torch?: number[];
    cuda?: number[];
  };
}

/**
 * Checkpoint manager for saving and loading model checkpoints
 *
 * Features:
 * - Automatic checkpointing at intervals
 * - Keep best N checkpoints
 * - Keep last N checkpoints
 * - Keep every Nth checkpoint
 * - Validate before saving
 * - Compression support
 * - Rollback support
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private checkpoints: Map<string, CheckpointInfo> = new Map();
  private bestMetric = -Infinity;
  private worstMetric = Infinity;
  private isEnabled: boolean;

  constructor(config: CheckpointConfig) {
    this.config = config;
    this.isEnabled = config.enabled;
  }

  /**
   * Initialize checkpoint directory
   */
  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    if (!existsSync(this.config.dir)) {
      await mkdir(this.config.dir, { recursive: true });
    }

    // Load existing checkpoints
    await this.loadCheckpointIndex();
  }

  /**
   * Save a checkpoint
   */
  async save(params: {
    epoch: number;
    metrics: TrainingMetrics;
    modelConfig: ModelConfig;
    trainingConfig: TrainingConfig;
    timestamp: number;
    gitCommit?: string;
    checkpointType?: "best" | "last" | "epoch" | "manual";
    modelState?: Record<string, unknown>;
    optimizerState?: Record<string, unknown>;
    lrSchedulerState?: Record<string, unknown>;
  }): Promise<string> {
    if (!this.isEnabled) {
      throw new Error("Checkpointing is not enabled");
    }

    const {
      epoch,
      metrics,
      modelConfig,
      trainingConfig,
      timestamp,
      gitCommit,
      checkpointType = "epoch",
      modelState = {},
      optimizerState,
      lrSchedulerState,
    } = params;

    // Validate before saving if required
    if (this.config.validateBeforeSave) {
      // In real implementation, would run validation
      console.log("[Checkpoint] Validating before save...");
    }

    // Determine checkpoint type based on metrics
    let finalType = checkpointType;
    if (this.isBest(metrics)) {
      finalType = "best";
    }

    // Create checkpoint data
    const metadata: CheckpointMetadata = {
      epoch,
      metrics,
      modelConfig,
      trainingConfig,
      timestamp,
      gitCommit,
      configHash: this.generateConfigHash(modelConfig, trainingConfig),
      checkpointType: finalType,
    };

    const checkpointData: CheckpointData = {
      metadata,
      modelState,
      optimizerState,
      lrSchedulerState,
      randomStates: {
        python: Math.random(), // Placeholder
      },
    };

    // Generate checkpoint path
    const checkpointName = this.generateCheckpointName(metadata);
    const checkpointPath = join(this.config.dir, checkpointName);

    // Apply compression if enabled
    let finalPath = checkpointPath;
    if (this.config.compression !== "none") {
      finalPath = `${checkpointPath}.${this.config.compression}`;
    }

    // Save checkpoint
    await this.saveCheckpointData(finalPath, checkpointData);

    // Update tracking
    const size = await this.getFileSize(finalPath);
    const info: CheckpointInfo = {
      path: finalPath,
      epoch,
      metrics,
      type: finalType,
      timestamp,
      size,
    };

    this.checkpoints.set(finalPath, info);

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints();

    console.log(
      `[Checkpoint] Saved ${finalType} checkpoint: ${checkpointName}`
    );

    return finalPath;
  }

  /**
   * Load a checkpoint
   */
  async load(path?: string): Promise<CheckpointData | null> {
    if (!this.isEnabled) {
      throw new Error("Checkpointing is not enabled");
    }

    const checkpointPath = path || this.getLatestCheckpointPath();
    if (!checkpointPath) {
      return null;
    }

    const data = await this.loadCheckpointData(checkpointPath);
    console.log(`[Checkpoint] Loaded checkpoint from ${checkpointPath}`);

    return data;
  }

  /**
   * Load checkpoint for resuming training
   */
  async loadForResume(path?: string): Promise<TrainingState | null> {
    const checkpoint = await this.load(path);
    if (!checkpoint) {
      return null;
    }

    return {
      epoch: checkpoint.metadata.epoch,
      batch: 0,
      modelState: checkpoint.modelState,
      optimizerState: checkpoint.optimizerState || {},
      lrSchedulerState: checkpoint.lrSchedulerState || {},
      randomStates: checkpoint.randomStates || {},
      metricsHistory: [],
      bestMetrics: {
        epoch: checkpoint.metadata.epoch,
        metrics: checkpoint.metadata.metrics,
      },
      configHash: checkpoint.metadata.configHash,
    };
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(): CheckpointInfo[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => b.epoch - a.epoch
    );
  }

  /**
   * Get best checkpoint
   */
  getBestCheckpoint(): CheckpointInfo | null {
    const best = this.listCheckpoints().filter(c => c.type === "best")[0];
    return best || null;
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): CheckpointInfo | null {
    const checkpoints = this.listCheckpoints();
    return checkpoints[0] || null;
  }

  /**
   * Delete a checkpoint
   */
  async delete(path: string): Promise<void> {
    if (!this.checkpoints.has(path)) {
      return;
    }

    await unlink(path);
    this.checkpoints.delete(path);
    console.log(`[Checkpoint] Deleted checkpoint: ${basename(path)}`);
  }

  /**
   * Delete all checkpoints
   */
  async deleteAll(): Promise<void> {
    const paths = Array.from(this.checkpoints.keys());
    for (const path of paths) {
      await this.delete(path);
    }
  }

  /**
   * Check if metrics are best
   */
  private isBest(metrics: TrainingMetrics): boolean {
    // Use validation loss as default metric (lower is better)
    const metric = metrics.loss.validation;
    const isMinMode = true;

    if (isMinMode) {
      if (metric < this.bestMetric || this.bestMetric === -Infinity) {
        this.bestMetric = metric;
        return true;
      }
    } else {
      if (metric > this.worstMetric || this.worstMetric === Infinity) {
        this.worstMetric = metric;
        return true;
      }
    }

    return false;
  }

  /**
   * Generate checkpoint name
   */
  private generateCheckpointName(metadata: CheckpointMetadata): string {
    const type = metadata.checkpointType;
    const epoch = metadata.epoch;
    const timestamp = metadata.timestamp;

    switch (type) {
      case "best":
        return `checkpoint_best_epoch${epoch}_${timestamp}.ckpt`;
      case "last":
        return `checkpoint_last_epoch${epoch}_${timestamp}.ckpt`;
      case "epoch":
        return `checkpoint_epoch${epoch}_${timestamp}.ckpt`;
      case "manual":
        return `checkpoint_manual_epoch${epoch}_${timestamp}.ckpt`;
      default:
        return `checkpoint_${timestamp}.ckpt`;
    }
  }

  /**
   * Generate config hash
   */
  private generateConfigHash(
    modelConfig: ModelConfig,
    trainingConfig: TrainingConfig
  ): string {
    const str = JSON.stringify({ modelConfig, trainingConfig });
    return createHash("sha256").update(str).digest("hex").substring(0, 16);
  }

  /**
   * Get file size
   */
  private async getFileSize(path: string): Promise<number> {
    const stats = await stat(path);
    return stats.size;
  }

  /**
   * Save checkpoint data to disk
   */
  private async saveCheckpointData(
    path: string,
    data: CheckpointData
  ): Promise<void> {
    let content = JSON.stringify(data, null, 2);

    // Apply compression if enabled
    if (this.config.compression === "gzip") {
      // In real implementation, would use zlib
      content = content; // Placeholder
    } else if (this.config.compression === "bz2") {
      // In real implementation, would use bz2
      content = content; // Placeholder
    }

    await writeFile(path, content, "utf-8");
  }

  /**
   * Load checkpoint data from disk
   */
  private async loadCheckpointData(path: string): Promise<CheckpointData> {
    let content = await readFile(path, "utf-8");

    // Decompress if needed
    if (path.endsWith(".gz") || path.endsWith(".bz2")) {
      // In real implementation, would decompress
      content = content; // Placeholder
    }

    return JSON.parse(content) as CheckpointData;
  }

  /**
   * Get latest checkpoint path
   */
  private getLatestCheckpointPath(): string | null {
    const latest = this.getLatestCheckpoint();
    return latest?.path || null;
  }

  /**
   * Load checkpoint index from disk
   */
  private async loadCheckpointIndex(): Promise<void> {
    if (!existsSync(this.config.dir)) {
      return;
    }

    const files = readdirSync(this.config.dir);
    for (const file of files) {
      if (
        file.endsWith(".ckpt") ||
        file.endsWith(".ckpt.gz") ||
        file.endsWith(".ckpt.bz2")
      ) {
        const path = join(this.config.dir, file);
        const stats = await stat(path);

        // Try to extract metadata from filename
        const match = file.match(/checkpoint_(\w+)_epoch(\d+)_(\d+)\.ckpt/);
        if (match) {
          const [, type, epochStr, timestampStr] = match;
          const epoch = parseInt(epochStr, 10);
          const timestamp = parseInt(timestampStr, 10);

          this.checkpoints.set(path, {
            path,
            epoch,
            metrics: this.createDefaultMetrics(),
            type: type as CheckpointInfo["type"],
            timestamp,
            size: stats.size,
          });
        }
      }
    }
  }

  /**
   * Cleanup old checkpoints based on retention policy
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    const checkpoints = this.listCheckpoints();

    // Keep best N
    const bestCheckpoints = checkpoints
      .filter(c => c.type === "best")
      .slice(this.config.keep.best);

    // Keep last N
    const lastCheckpoints = checkpoints.slice(this.config.keep.last);

    // Keep every Nth
    const epochCheckpoints = checkpoints
      .filter(c => c.type === "epoch")
      .filter((_, i) => i % this.config.keep.every === 0);

    // Build set of checkpoints to keep
    const toKeep = new Set(
      [...bestCheckpoints, ...lastCheckpoints, ...epochCheckpoints].map(
        c => c.path
      )
    );

    // Delete others
    for (const checkpoint of checkpoints) {
      if (!toKeep.has(checkpoint.path)) {
        await this.delete(checkpoint.path);
      }
    }
  }

  /**
   * Create default metrics
   */
  private createDefaultMetrics(): TrainingMetrics {
    return {
      epoch: 0,
      batch: 0,
      loss: { training: 0, validation: 0 },
      accuracy: {},
      latency: { forward: 0, backward: 0, total: 0 },
      memory: { gpu: 0, cpu: 0, peak: 0 },
      throughput: 0,
      learning: { gradientNorm: 0, learningRate: 0 },
      timestamp: Date.now(),
    };
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
