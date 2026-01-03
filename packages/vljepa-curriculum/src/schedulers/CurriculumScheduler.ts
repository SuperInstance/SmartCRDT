/**
 * Curriculum Scheduler
 *
 * Orchestrates progression through curriculum stages with:
 * - Sequential stages: Complete stage N before N+1
 * - Mastery gating: Advance only when threshold met
 * - Adaptive pacing: Slow down if struggling
 * - Replay buffer: Revisit difficult examples
 */

import type {
  CurriculumStage,
  CurriculumProgress,
  StageProgress,
  SchedulerConfig,
  SchedulingStrategy,
  PacingStrategy,
  ReplayConfig,
  AdaptiveConfig,
  StageStatus,
  ProgressEvent,
  CompletionPrediction,
  TrainingExample,
  StageEvaluator,
} from "../types.js";

import { ProgressMonitor } from "./ProgressMonitor.js";
import { AdaptiveController } from "./AdaptiveController.js";
import { ReplayBuffer } from "../samplers/ReplayBuffer.js";

export class CurriculumScheduler {
  private config: SchedulerConfig;
  private monitor: ProgressMonitor;
  private adaptive: AdaptiveController;
  private replayBuffer: ReplayBuffer;
  private currentStage: number = 0;
  private stageHistory: Map<number, StageProgress> = new Map();
  private eventHistory: ProgressEvent[] = [];

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      stages: [],
      strategy: "sequential",
      pacing: "dynamic",
      replay: {
        enabled: true,
        bufferSize: 1000,
        strategy: ["prioritize_hard", "prioritize_recent"],
        frequency: 5,
      },
      adaptive: {
        enabled: true,
        metrics: ["loss", "accuracy", "mastery"],
        thresholds: [0.3, 0.7, 0.85],
        actions: ["increase_epochs", "replay_stage", "adjust_difficulty"],
      },
      ...config,
    };

    this.monitor = new ProgressMonitor(this.config.stages);
    this.adaptive = new AdaptiveController(this.config.adaptive);
    this.replayBuffer = new ReplayBuffer(this.config.replay.bufferSize);
  }

  /**
   * Initialize the scheduler with stages
   */
  async initialize(stages: CurriculumStage[]): Promise<void> {
    this.config.stages = stages;
    this.monitor = new ProgressMonitor(stages);
    this.currentStage = 0;
    this.stageHistory.clear();
    this.eventHistory = [];
  }

  /**
   * Start training at the current stage
   */
  async startStage(stageIndex: number): Promise<void> {
    if (stageIndex < 0 || stageIndex >= this.config.stages.length) {
      throw new Error(`Invalid stage index: ${stageIndex}`);
    }

    const stage = this.config.stages[stageIndex];

    // Check prerequisites
    if (!this.checkPrerequisites(stage)) {
      throw new Error(`Prerequisites not met for stage: ${stage.id}`);
    }

    this.currentStage = stageIndex;
    const progress = this.monitor.getStageProgress(stageIndex);

    if (progress.status === "not_started") {
      progress.status = "in_progress";
      progress.startedAt = Date.now();

      this.recordEvent({
        type: "stage_started",
        stage: stageIndex,
        timestamp: Date.now(),
        data: { stageId: stage.id },
      });
    }
  }

  /**
   * Update progress for the current stage
   */
  updateProgress(
    stageIndex: number,
    metrics: {
      epoch: number;
      examples: number;
      loss: number;
      accuracy: number;
      mastery: number;
    }
  ): void {
    const progress = this.monitor.getStageProgress(stageIndex);
    const stage = this.config.stages[stageIndex];

    progress.epochs = metrics.epoch;
    progress.examples = metrics.examples;
    progress.loss = metrics.loss;
    progress.accuracy = metrics.accuracy;
    progress.mastery = metrics.mastery;

    // Check for stage completion
    const evaluator = stage.evaluator;
    if (evaluator.isMastered(progress)) {
      this.completeStage(stageIndex);
    }

    // Adaptive actions
    if (this.config.adaptive.enabled) {
      const action = this.adaptive.shouldTakeAction(progress, metrics);
      if (action && action !== "none") {
        this.executeAdaptiveAction(stageIndex, action);
      }
    }

    this.recordEvent({
      type: "progress_updated",
      stage: stageIndex,
      timestamp: Date.now(),
      data: { ...metrics },
    });
  }

  /**
   * Complete a stage
   */
  completeStage(stageIndex: number): void {
    const progress = this.monitor.getStageProgress(stageIndex);
    const stage = this.config.stages[stageIndex];

    if (progress.status === "mastered") {
      return; // Already completed
    }

    progress.status = "mastered";
    progress.completedAt = Date.now();

    this.recordEvent({
      type: "stage_completed",
      stage: stageIndex,
      timestamp: Date.now(),
      data: {
        stageId: stage.id,
        epochs: progress.epochs,
        mastery: progress.mastery,
      },
    });

    // Auto-advance to next stage if sequential
    if (
      this.config.strategy === "sequential" &&
      stageIndex < this.config.stages.length - 1
    ) {
      this.advanceToStage(stageIndex + 1);
    }
  }

  /**
   * Advance to the next stage
   */
  async advanceToStage(stageIndex: number): Promise<void> {
    if (stageIndex >= this.config.stages.length) {
      // All stages complete
      this.recordEvent({
        type: "curriculum_completed",
        stage: this.config.stages.length - 1,
        timestamp: Date.now(),
        data: { totalStages: this.config.stages.length },
      });
      return;
    }

    await this.startStage(stageIndex);
  }

  /**
   * Check if prerequisites are met
   */
  private checkPrerequisites(stage: CurriculumStage): boolean {
    if (
      !stage.config.prerequisites ||
      stage.config.prerequisites.length === 0
    ) {
      return true;
    }

    for (const prereqId of stage.config.prerequisites) {
      const prereqIndex = this.config.stages.findIndex(s => s.id === prereqId);
      if (prereqIndex === -1) {
        continue; // Prerequisite not in curriculum
      }

      const progress = this.monitor.getStageProgress(prereqIndex);
      if (progress.status !== "mastered") {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute adaptive action
   */
  private executeAdaptiveAction(stageIndex: number, action: string): void {
    const stage = this.config.stages[stageIndex];

    this.recordEvent({
      type: "adaptive_action",
      stage: stageIndex,
      timestamp: Date.now(),
      data: { action },
    });

    switch (action) {
      case "increase_epochs":
        stage.config.epochs += 5;
        break;

      case "decrease_epochs":
        stage.config.epochs = Math.max(5, stage.config.epochs - 5);
        break;

      case "replay_stage":
        // Will be handled by the training loop
        this.recordEvent({
          type: "replay_triggered",
          stage: stageIndex,
          timestamp: Date.now(),
          data: { reason: "adaptive" },
        });
        break;

      case "adjust_difficulty":
        // Difficulty adjustment would be handled by the sampler
        break;

      case "skip_stage":
        this.completeStage(stageIndex);
        break;
    }
  }

  /**
   * Get batch of examples for current stage
   */
  getBatch(batchSize: number): TrainingExample[] {
    const stage = this.config.stages[this.currentStage];
    const progress = this.monitor.getStageProgress(this.currentStage);

    // Determine if we should include replay examples
    const includeReplay =
      this.config.replay.enabled &&
      progress.epochs > 0 &&
      progress.epochs % this.config.replay.frequency === 0;

    if (includeReplay && this.replayBuffer.size() > 0) {
      // Mix current stage examples with replay buffer
      const replaySize = Math.floor(batchSize * 0.2);
      const currentSize = batchSize - replaySize;

      const replayExamples = this.replayBuffer.sample(replaySize);
      // Note: Current stage examples would be generated by the stage's data generator
      return replayExamples;
    }

    return [];
  }

  /**
   * Add example to replay buffer
   */
  addToReplayBuffer(example: TrainingExample, loss: number): void {
    if (!this.config.replay.enabled) {
      return;
    }

    // Calculate priority based on loss (higher loss = higher priority)
    const priority = loss;

    this.replayBuffer.add(example, priority);
  }

  /**
   * Get current curriculum progress
   */
  getProgress(): CurriculumProgress {
    const stageProgress: StageProgress[] = [];

    for (let i = 0; i < this.config.stages.length; i++) {
      stageProgress.push(this.monitor.getStageProgress(i));
    }

    const overallMastery = this.calculateOverallMastery(stageProgress);
    const timeSpent = this.calculateTimeSpent(stageProgress);
    const predictions = this.generatePredictions(stageProgress);

    return {
      currentStage: this.currentStage,
      stageProgress,
      overallMastery,
      timeSpent,
      predictions,
      history: [...this.eventHistory],
    };
  }

  /**
   * Calculate overall mastery across all stages
   */
  private calculateOverallMastery(stageProgress: StageProgress[]): number {
    const mastered = stageProgress.filter(p => p.status === "mastered").length;
    return mastered / stageProgress.length;
  }

  /**
   * Calculate total time spent
   */
  private calculateTimeSpent(stageProgress: StageProgress[]): number {
    let total = 0;

    for (const progress of stageProgress) {
      if (progress.startedAt && progress.completedAt) {
        total += progress.completedAt - progress.startedAt;
      } else if (progress.startedAt) {
        total += Date.now() - progress.startedAt;
      }
    }

    return total;
  }

  /**
   * Generate completion predictions
   */
  private generatePredictions(
    stageProgress: StageProgress[]
  ): CompletionPrediction[] {
    const predictions: CompletionPrediction[] = [];

    for (let i = 0; i < stageProgress.length; i++) {
      const progress = stageProgress[i];

      if (progress.status === "mastered") {
        predictions.push({
          stage: i,
          estimatedEpochs: progress.epochs,
          estimatedTime:
            (progress.completedAt || Date.now()) -
            (progress.startedAt || Date.now()),
          confidence: 1.0,
        });
      } else if (progress.status === "in_progress") {
        const epochsPerStage = progress.config.epochs;
        const epochsRemaining = epochsPerStage - progress.epochs;
        const avgTimePerEpoch = 1000; // Placeholder: would be calculated from actual data

        predictions.push({
          stage: i,
          estimatedEpochs: epochsPerStage,
          estimatedTime: epochsRemaining * avgTimePerEpoch,
          confidence: Math.min(0.9, progress.mastery / 0.85),
        });
      } else {
        const typicalEpochs = 10; // Default estimate
        predictions.push({
          stage: i,
          estimatedEpochs: typicalEpochs,
          estimatedTime: typicalEpochs * 1000,
          confidence: 0.5,
        });
      }
    }

    return predictions;
  }

  /**
   * Check if should transition to next stage
   */
  shouldTransition(stageIndex: number): boolean {
    const progress = this.monitor.getStageProgress(stageIndex);
    const stage = this.config.stages[stageIndex];

    // Must meet mastery threshold
    if (progress.mastery < stage.config.masteryThreshold) {
      return false;
    }

    // Check patience (minimum epochs)
    if (progress.epochs < stage.config.epochs * 0.5) {
      return false;
    }

    // Check if loss is stable
    if (this.monitor.isLossStable(stageIndex)) {
      return true;
    }

    return progress.status === "mastered";
  }

  /**
   * Get current stage index
   */
  getCurrentStage(): number {
    return this.currentStage;
  }

  /**
   * Get stage configuration
   */
  getStageConfig(stageIndex: number): unknown {
    return this.config.stages[stageIndex]?.config;
  }

  /**
   * Reset curriculum to beginning
   */
  reset(): void {
    this.currentStage = 0;
    this.stageHistory.clear();
    this.eventHistory = [];
    this.replayBuffer.clear();
    this.monitor.reset();
  }

  /**
   * Record event
   */
  private recordEvent(event: ProgressEvent): void {
    this.eventHistory.push(event);

    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  /**
   * Get event history
   */
  getEventHistory(): ProgressEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }
}
