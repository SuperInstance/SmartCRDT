/**
 * Progress Monitor
 *
 * Tracks learning progress across curriculum stages including:
 * - Loss curves and convergence detection
 * - Accuracy trends and mastery assessment
 * - Timing information and performance metrics
 */

import type {
  CurriculumStage,
  StageProgress,
  StageStatus,
  StageMetrics,
  MetricsEvent,
} from "../types.js";

export class ProgressMonitor {
  private stages: CurriculumStage[];
  private stageProgress: Map<number, StageProgress> = new Map();
  private stageMetrics: Map<number, StageMetrics> = new Map();
  private lossHistory: Map<number, number[]> = new Map();
  private accuracyHistory: Map<number, number[]> = new Map();

  constructor(stages: CurriculumStage[]) {
    this.stages = stages;
    this.initializeProgress();
  }

  /**
   * Initialize progress tracking for all stages
   */
  private initializeProgress(): void {
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];

      this.stageProgress.set(i, {
        stage: i,
        stageId: stage.id,
        epochs: 0,
        examples: 0,
        loss: Infinity,
        accuracy: 0,
        mastery: 0,
        status: "not_started",
      });

      this.lossHistory.set(i, []);
      this.accuracyHistory.set(i, []);

      this.stageMetrics.set(i, {
        stageId: stage.id,
        loss: {
          values: [],
          timestamps: [],
          min: Infinity,
          max: -Infinity,
          mean: 0,
          std: 0,
        },
        accuracy: {
          values: [],
          timestamps: [],
          min: Infinity,
          max: -Infinity,
          mean: 0,
          std: 0,
        },
        mastery: {
          values: [],
          timestamps: [],
          min: Infinity,
          max: -Infinity,
          mean: 0,
          std: 0,
        },
        timing: {
          values: [],
          timestamps: [],
          min: Infinity,
          max: -Infinity,
          mean: 0,
          std: 0,
        },
        custom: new Map(),
      });
    }
  }

  /**
   * Get progress for a specific stage
   */
  getStageProgress(stageIndex: number): StageProgress {
    if (!this.stageProgress.has(stageIndex)) {
      throw new Error(`Invalid stage index: ${stageIndex}`);
    }
    return { ...this.stageProgress.get(stageIndex)! };
  }

  /**
   * Update progress for a stage
   */
  updateProgress(
    stageIndex: number,
    metrics: {
      loss: number;
      accuracy: number;
      mastery: number;
      epoch: number;
      examples: number;
    }
  ): void {
    const progress = this.stageProgress.get(stageIndex);
    if (!progress) {
      return;
    }

    // Update progress
    progress.loss = metrics.loss;
    progress.accuracy = metrics.accuracy;
    progress.mastery = metrics.mastery;
    progress.epochs = metrics.epoch;
    progress.examples = metrics.examples;

    // Update history
    this.lossHistory.get(stageIndex)!.push(metrics.loss);
    this.accuracyHistory.get(stageIndex)!.push(metrics.accuracy);

    // Update metrics
    this.updateMetrics(stageIndex, metrics);
  }

  /**
   * Update metrics for a stage
   */
  private updateMetrics(
    stageIndex: number,
    metrics: {
      loss: number;
      accuracy: number;
      mastery: number;
    }
  ): void {
    const stageMetrics = this.stageMetrics.get(stageIndex);
    if (!stageMetrics) {
      return;
    }

    const timestamp = Date.now();

    // Update loss metrics
    stageMetrics.loss.values.push(metrics.loss);
    stageMetrics.loss.timestamps.push(timestamp);
    this.updateMetricSeries(stageMetrics.loss);

    // Update accuracy metrics
    stageMetrics.accuracy.values.push(metrics.accuracy);
    stageMetrics.accuracy.timestamps.push(timestamp);
    this.updateMetricSeries(stageMetrics.accuracy);

    // Update mastery metrics
    stageMetrics.mastery.values.push(metrics.mastery);
    stageMetrics.mastery.timestamps.push(timestamp);
    this.updateMetricSeries(stageMetrics.mastery);
  }

  /**
   * Update a metric series (min, max, mean, std)
   */
  private updateMetricSeries(series: {
    values: number[];
    min: number;
    max: number;
    mean: number;
    std: number;
  }): void {
    const values = series.values;

    if (values.length === 0) {
      return;
    }

    series.min = Math.min(...values);
    series.max = Math.max(...values);
    series.mean = values.reduce((sum, v) => sum + v, 0) / values.length;

    // Calculate standard deviation
    const variance =
      values.reduce((sum, v) => sum + (v - series.mean) ** 2, 0) /
      values.length;
    series.std = Math.sqrt(variance);
  }

  /**
   * Check if loss has stabilized (convergence detection)
   */
  isLossStable(
    stageIndex: number,
    window: number = 5,
    threshold: number = 0.01
  ): boolean {
    const history = this.lossHistory.get(stageIndex);
    if (!history || history.length < window) {
      return false;
    }

    const recent = history.slice(-window);
    const mean = recent.reduce((sum, v) => sum + v, 0) / window;
    const variance =
      recent.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window;
    const std = Math.sqrt(variance);

    return std < threshold;
  }

  /**
   * Check if accuracy has plateaued
   */
  isAccuracyPlateaued(
    stageIndex: number,
    window: number = 5,
    threshold: number = 0.005
  ): boolean {
    const history = this.accuracyHistory.get(stageIndex);
    if (!history || history.length < window) {
      return false;
    }

    const recent = history.slice(-window);
    const max = Math.max(...recent);
    const min = Math.min(...recent);

    return max - min < threshold;
  }

  /**
   * Get metrics for a stage
   */
  getMetrics(stageIndex: number): StageMetrics {
    const metrics = this.stageMetrics.get(stageIndex);
    if (!metrics) {
      throw new Error(`No metrics found for stage: ${stageIndex}`);
    }

    // Return deep copy
    return {
      stageId: metrics.stageId,
      loss: { ...metrics.loss },
      accuracy: { ...metrics.accuracy },
      mastery: { ...metrics.mastery },
      timing: { ...metrics.timing },
      custom: new Map(metrics.custom),
    };
  }

  /**
   * Get loss history for a stage
   */
  getLossHistory(stageIndex: number): number[] {
    return [...(this.lossHistory.get(stageIndex) || [])];
  }

  /**
   * Get accuracy history for a stage
   */
  getAccuracyHistory(stageIndex: number): number[] {
    return [...(this.accuracyHistory.get(stageIndex) || [])];
  }

  /**
   * Get overall progress across all stages
   */
  getOverallProgress(): {
    completed: number;
    inProgress: number;
    notStarted: number;
    total: number;
    averageMastery: number;
  } {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalMastery = 0;

    for (const progress of this.stageProgress.values()) {
      switch (progress.status) {
        case "mastered":
          completed++;
          break;
        case "in_progress":
          inProgress++;
          break;
        case "not_started":
          notStarted++;
          break;
      }
      totalMastery += progress.mastery;
    }

    return {
      completed,
      inProgress,
      notStarted,
      total: this.stages.length,
      averageMastery: totalMastery / this.stages.length,
    };
  }

  /**
   * Set stage status
   */
  setStageStatus(stageIndex: number, status: StageStatus): void {
    const progress = this.stageProgress.get(stageIndex);
    if (progress) {
      progress.status = status;

      if (status === "in_progress" && !progress.startedAt) {
        progress.startedAt = Date.now();
      }

      if (status === "mastered" && !progress.completedAt) {
        progress.completedAt = Date.now();
      }
    }
  }

  /**
   * Reset progress for a specific stage or all stages
   */
  reset(stageIndex?: number): void {
    if (stageIndex !== undefined) {
      const stage = this.stages[stageIndex];
      this.stageProgress.set(stageIndex, {
        stage: stageIndex,
        stageId: stage.id,
        epochs: 0,
        examples: 0,
        loss: Infinity,
        accuracy: 0,
        mastery: 0,
        status: "not_started",
      });
      this.lossHistory.set(stageIndex, []);
      this.accuracyHistory.set(stageIndex, []);
    } else {
      this.initializeProgress();
    }
  }

  /**
   * Get all stage progress
   */
  getAllStageProgress(): StageProgress[] {
    return Array.from(this.stageProgress.values()).map(p => ({ ...p }));
  }

  /**
   * Export progress as JSON
   */
  exportProgress(): string {
    const data = {
      stages: Array.from(this.stageProgress.entries()).map(
        ([index, progress]) => ({
          index,
          ...progress,
        })
      ),
      metrics: Array.from(this.stageMetrics.entries()).map(
        ([index, metrics]) => ({
          index,
          stageId: metrics.stageId,
          loss: metrics.loss,
          accuracy: metrics.accuracy,
          mastery: metrics.mastery,
        })
      ),
      overall: this.getOverallProgress(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import progress from JSON
   */
  importProgress(json: string): void {
    try {
      const data = JSON.parse(json);

      for (const stage of data.stages) {
        const index = stage.index;
        this.stageProgress.set(index, {
          stage: index,
          stageId: stage.stageId,
          epochs: stage.epochs,
          examples: stage.examples,
          loss: stage.loss,
          accuracy: stage.accuracy,
          mastery: stage.mastery,
          status: stage.status,
          startedAt: stage.startedAt,
          completedAt: stage.completedAt,
        });
      }
    } catch (error) {
      throw new Error(`Failed to import progress: ${error}`);
    }
  }
}
