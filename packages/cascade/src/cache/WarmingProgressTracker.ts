/**
 * WarmingProgressTracker - Track and report cache warming progress
 *
 * Provides detailed progress tracking for cache warming operations,
 * including stage progression, metrics calculation, and real-time reporting.
 *
 * Features:
 * - Stage-based progress tracking
 * - Real-time metrics calculation
 * - ETA estimation
 * - Hit rate monitoring
 * - Memory usage tracking
 * - Progress callbacks
 * - Snapshot history
 *
 * Example:
 * ```ts
 * const tracker = new WarmingProgressTracker();
 * tracker.on('progress', (progress) => {
 *   console.log(`${progress.stage}: ${progress.progress.toFixed(1)}%`);
 * });
 * tracker.startStage('initializing', 5);
 * tracker.updateProgress(2);
 * tracker.completeStage();
 * ```
 */

import type {
  WarmingProgress,
  WarmingStage,
  WarmingProgressCallback,
} from "@lsi/protocol";

/**
 * Progress event types
 */
type ProgressEventType = "stage_start" | "progress_update" | "stage_complete" | "warming_complete" | "error";

/**
 * Progress event
 */
interface ProgressEvent {
  type: ProgressEventType;
  progress: WarmingProgress;
  timestamp: number;
}

/**
 * Stage configuration
 */
interface StageConfig {
  name: WarmingStage;
  estimatedDuration: number; // milliseconds
  weight: number; // Relative weight in overall progress
}

/**
 * WarmingProgressTracker - Track cache warming progress
 */
export class WarmingProgressTracker {
  private currentStage: WarmingStage = "initializing";
  private stageStartTime: number = 0;
  private overallStartTime: number = 0;
  private queriesWarmed: number = 0;
  private totalQueries: number = 0;
  private progressSnapshots: WarmingProgress[] = [];
  private eventListeners: Map<ProgressEventType, Array<(event: ProgressEvent) => void>> = new Map();
  private progressCallback: WarmingProgressCallback | null = null;

  // Stage configurations with estimates
  private readonly stageConfigs: Map<WarmingStage, StageConfig> = new Map([
    ["initializing", { name: "initializing", estimatedDuration: 1000, weight: 0.05 }],
    ["loading_patterns", { name: "loading_patterns", estimatedDuration: 3000, weight: 0.1 }],
    ["generating_predictions", { name: "generating_predictions", estimatedDuration: 2000, weight: 0.1 }],
    ["warming_cache", { name: "warming_cache", estimatedDuration: 20000, weight: 0.7 }],
    ["verifying", { name: "verifying", estimatedDuration: 2000, weight: 0.05 }],
    ["complete", { name: "complete", estimatedDuration: 0, weight: 0 }],
    ["failed", { name: "failed", estimatedDuration: 0, weight: 0 }],
  ]);

  constructor(callback?: WarmingProgressCallback) {
    this.progressCallback = callback ?? null;
  }

  /**
   * Start warming operation
   */
  start(): void {
    this.overallStartTime = Date.now();
    this.queriesWarmed = 0;
    this.totalQueries = 0;
    this.progressSnapshots = [];
    this.startStage("initializing");
  }

  /**
   * Start a new warming stage
   *
   * @param stage - Stage to start
   * @param totalQueries - Total queries for this stage (if applicable)
   */
  startStage(stage: WarmingStage, totalQueries?: number): void {
    this.currentStage = stage;
    this.stageStartTime = Date.now();

    if (totalQueries !== undefined) {
      this.totalQueries = totalQueries;
    }

    this.emitEvent("stage_start", this.getCurrentProgress());
  }

  /**
   * Update progress within current stage
   *
   * @param queriesWarmed - Number of queries warmed so far
   */
  updateProgress(queriesWarmed: number): void {
    this.queriesWarmed = queriesWarmed;
    this.emitEvent("progress_update", this.getCurrentProgress());
  }

  /**
   * Increment progress by one query
   */
  incrementProgress(): void {
    this.queriesWarmed++;
    this.emitEvent("progress_update", this.getCurrentProgress());
  }

  /**
   * Complete current stage
   */
  completeStage(): void {
    const progress = this.getCurrentProgress();
    this.emitEvent("stage_complete", progress);

    // Determine next stage
    const stages: WarmingStage[] = [
      "initializing",
      "loading_patterns",
      "generating_predictions",
      "warming_cache",
      "verifying",
      "complete",
    ];
    const currentIndex = stages.indexOf(this.currentStage);

    if (currentIndex < stages.length - 1) {
      this.startStage(stages[currentIndex + 1]);
    } else {
      this.complete();
    }
  }

  /**
   * Complete warming operation
   */
  complete(): void {
    this.currentStage = "complete";
    const progress = this.getCurrentProgress();
    this.emitEvent("warming_complete", progress);
  }

  /**
   * Mark warming as failed
   *
   * @param error - Error message
   */
  fail(error: string): void {
    this.currentStage = "failed";
    const progress = this.getCurrentProgress();
    progress.progress = 0;
    this.emitEvent("error", progress);
  }

  /**
   * Get current progress state
   *
   * @returns Current progress
   */
  getCurrentProgress(): WarmingProgress {
    const now = Date.now();
    const stageProgress = this.calculateStageProgress();
    const overallProgress = this.calculateOverallProgress();

    return {
      stage: this.currentStage,
      progress: overallProgress,
      queriesWarmed: this.queriesWarmed,
      totalQueries: this.totalQueries,
      currentStrategy: "static", // Would be passed in real usage
      startTime: this.overallStartTime,
      estimatedTimeRemaining: this.calculateETA(),
      currentHitRate: 0, // Would be passed from cache
    };
  }

  /**
   * Calculate progress within current stage
   *
   * @returns Stage progress percentage (0-100)
   */
  private calculateStageProgress(): number {
    if (this.totalQueries === 0) {
      return 0;
    }

    return (this.queriesWarmed / this.totalQueries) * 100;
  }

  /**
   * Calculate overall progress across all stages
   *
   * @returns Overall progress percentage (0-100)
   */
  private calculateOverallProgress(): number {
    const stages: WarmingStage[] = [
      "initializing",
      "loading_patterns",
      "generating_predictions",
      "warming_cache",
      "verifying",
      "complete",
    ];

    let overallProgress = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const config = this.stageConfigs.get(stage);

      if (!config) continue;

      if (stage === this.currentStage) {
        // Current stage: add weighted progress
        overallProgress += config.weight * (this.calculateStageProgress() / 100);
      } else if (stages.indexOf(stage) < stages.indexOf(this.currentStage)) {
        // Completed stages: add full weight
        overallProgress += config.weight;
      }
      // Future stages: add nothing
    }

    return Math.min(100, overallProgress * 100);
  }

  /**
   * Calculate estimated time to completion
   *
   * @returns ETA in milliseconds
   */
  private calculateETA(): number {
    const stages: WarmingStage[] = [
      "initializing",
      "loading_patterns",
      "generating_predictions",
      "warming_cache",
      "verifying",
    ];

    let remainingTime = 0;
    const currentStageIndex = stages.indexOf(this.currentStage);

    // Add estimated time for current stage
    if (this.currentStage !== "complete" && this.currentStage !== "failed") {
      const config = this.stageConfigs.get(this.currentStage);
      if (config) {
        const stageElapsed = Date.now() - this.stageStartTime;
        const stageProgress = this.calculateStageProgress() / 100;

        if (stageProgress > 0) {
          // Estimate based on progress
          const estimatedTotal = stageElapsed / stageProgress;
          remainingTime += estimatedTotal - stageElapsed;
        } else {
          // Use default estimate
          remainingTime += config.estimatedDuration;
        }
      }
    }

    // Add estimated time for remaining stages
    for (let i = currentStageIndex + 1; i < stages.length; i++) {
      const config = this.stageConfigs.get(stages[i]);
      if (config) {
        remainingTime += config.estimatedDuration;
      }
    }

    return Math.max(0, remainingTime);
  }

  /**
   * Emit progress event
   *
   * @param type - Event type
   * @param progress - Progress data
   */
  private emitEvent(type: ProgressEventType, progress: WarmingProgress): void {
    const event: ProgressEvent = {
      type,
      progress: { ...progress }, // Clone to prevent mutation
      timestamp: Date.now(),
    };

    // Store snapshot
    this.progressSnapshots.push(event.progress);

    // Call callback if provided
    if (this.progressCallback) {
      this.progressCallback(event.progress);
    }

    // Notify event listeners
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Register event listener
   *
   * @param type - Event type
   * @param listener - Event listener callback
   */
  on(type: ProgressEventType, listener: (event: ProgressEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * Unregister event listener
   *
   * @param type - Event type
   * @param listener - Event listener callback
   */
  off(type: ProgressEventType, listener: (event: ProgressEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get progress snapshots
   *
   * @returns Array of progress snapshots
   */
  getSnapshots(): WarmingProgress[] {
    return [...this.progressSnapshots];
  }

  /**
   * Get current stage
   *
   * @returns Current stage
   */
  getCurrentStage(): WarmingStage {
    return this.currentStage;
  }

  /**
   * Check if warming is complete
   *
   * @returns True if complete
   */
  isComplete(): boolean {
    return this.currentStage === "complete";
  }

  /**
   * Check if warming failed
   *
   * @returns True if failed
   */
  isFailed(): boolean {
    return this.currentStage === "failed";
  }

  /**
   * Check if warming is in progress
   *
   * @returns True if in progress
   */
  isInProgress(): boolean {
    return !this.isComplete() && !this.isFailed();
  }

  /**
   * Get elapsed time since start
   *
   * @returns Elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.overallStartTime;
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      currentStage: this.currentStage,
      elapsedTime: this.getElapsedTime(),
      queriesWarmed: this.queriesWarmed,
      totalQueries: this.totalQueries,
      progress: this.calculateOverallProgress(),
      eta: this.calculateETA(),
      snapshotCount: this.progressSnapshots.length,
    };
  }

  /**
   * Reset tracker state
   */
  reset(): void {
    this.currentStage = "initializing";
    this.stageStartTime = 0;
    this.overallStartTime = 0;
    this.queriesWarmed = 0;
    this.totalQueries = 0;
    this.progressSnapshots = [];
  }

  /**
   * Generate progress report
   *
   * @returns Progress report string
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push("=== Cache Warming Progress Report ===");
    lines.push(`Current Stage: ${stats.currentStage}`);
    lines.push(`Overall Progress: ${stats.progress.toFixed(1)}%`);
    lines.push(`Queries Warmed: ${stats.queriesWarmed}/${stats.totalQueries}`);
    lines.push(`Elapsed Time: ${(stats.elapsedTime / 1000).toFixed(1)}s`);
    lines.push(`Estimated Time Remaining: ${(stats.eta / 1000).toFixed(1)}s`);
    lines.push(`Progress Snapshots: ${stats.snapshotCount}`);

    return lines.join("\n");
  }
}

/**
 * Create a warming progress tracker with console logging
 *
 * @param verbose - Whether to log verbose output
 * @returns Progress tracker instance
 */
export function createConsoleTracker(verbose: boolean = false): WarmingProgressTracker {
  const tracker = new WarmingProgressTracker();

  tracker.on("stage_start", (event) => {
    console.log(`[Warming] Starting stage: ${event.progress.stage}`);
  });

  tracker.on("progress_update", (event) => {
    if (verbose || event.progress.progress % 10 < 1) {
      console.log(
        `[Warming] ${event.progress.stage}: ${event.progress.progress.toFixed(1)}% (${event.progress.queriesWarmed}/${event.progress.totalQueries} queries)`
      );
    }
  });

  tracker.on("stage_complete", (event) => {
    console.log(`[Warming] Completed stage: ${event.progress.stage}`);
  });

  tracker.on("warming_complete", (event) => {
    console.log(`[Warming] Complete! ${event.progress.queriesWarmed} queries warmed in ${(event.progress.estimatedTimeRemaining ?? 0 / 1000).toFixed(1)}s`);
  });

  tracker.on("error", (event) => {
    console.error(`[Warming] Failed at stage: ${event.progress.stage}`);
  });

  return tracker;
}

/**
 * Default export
 */
export default WarmingProgressTracker;
