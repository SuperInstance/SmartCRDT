/**
 * @fileoverview ExperimentManager - Manage A/B test experiments lifecycle
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  Experiment,
  ExperimentConfig,
  ExperimentStatus,
  Variant,
  AllocationConfig,
  ExperimentStorage,
} from "../types.js";

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  minSampleSize: 100,
  significanceLevel: 0.05,
  power: 0.8,
  mde: 0.1, // 10% minimum detectable effect
};

// ============================================================================
// EXPERIMENT MANAGER
// ============================================================================

/**
 * ExperimentManager - Manage A/B testing experiments
 *
 * Handles creation, lifecycle management, and execution of A/B tests.
 */
export class ExperimentManager {
  private storage: ExperimentStorage;
  private config: typeof DEFAULT_CONFIG;

  constructor(
    storage: ExperimentStorage,
    config?: Partial<typeof DEFAULT_CONFIG>
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new experiment
   */
  async createExperiment(config: ExperimentConfig): Promise<Experiment> {
    const now = new Date();

    // Validate variants
    if (!config.variants || config.variants.length < 2) {
      throw new Error("Experiment must have at least 2 variants");
    }

    // Validate allocations sum to 100
    const totalAllocation = config.variants.reduce(
      (sum, v) => sum + v.allocation,
      0
    );
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error(
        `Variant allocations must sum to 100, got ${totalAllocation}`
      );
    }

    // Ensure exactly one control variant
    const controls = config.variants.filter(v => v.isControl);
    if (controls.length !== 1) {
      throw new Error("Experiment must have exactly one control variant");
    }

    // Normalize allocations
    const variants = this.normalizeAllocations(config.variants);

    const experiment: Experiment = {
      id: config.id || this.generateId(),
      name: config.name,
      description: config.description,
      status: "draft",
      variants,
      allocationStrategy: config.allocationStrategy,
      metrics: config.metrics,
      primaryMetric: config.primaryMetric,
      secondaryMetrics: config.secondaryMetrics || [],
      goals: config.goals,
      targetSampleSize: config.targetSampleSize,
      minSampleSize: config.minSampleSize || this.config.minSampleSize,
      significanceLevel:
        config.significanceLevel || this.config.significanceLevel,
      power: config.power || this.config.power,
      mde: config.mde || this.config.mde,
      duration: config.duration,
      createdAt: now,
      updatedAt: now,
      createdBy: (config.metadata?.createdBy as string) || "system",
      metadata: config.metadata,
    };

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== "draft" && experiment.status !== "paused") {
      throw new Error(
        `Cannot start experiment in status: ${experiment.status}`
      );
    }

    experiment.status = "running";
    if (!experiment.duration) {
      experiment.duration = { start: new Date() };
    } else if (!experiment.duration.start) {
      experiment.duration.start = new Date();
    }
    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Pause a running experiment
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== "running") {
      throw new Error(
        `Cannot pause experiment in status: ${experiment.status}`
      );
    }

    experiment.status = "paused";
    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Resume a paused experiment
   */
  async resumeExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== "paused") {
      throw new Error(
        `Cannot resume experiment in status: ${experiment.status}`
      );
    }

    experiment.status = "running";
    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Complete an experiment
   */
  async completeExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status === "completed" || experiment.status === "archived") {
      throw new Error(`Experiment already completed or archived`);
    }

    experiment.status = "completed";
    if (experiment.duration) {
      experiment.duration.end = new Date();
    }
    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Archive an experiment
   */
  async archiveExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== "completed") {
      throw new Error("Can only archive completed experiments");
    }

    experiment.status = "archived";
    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status === "running") {
      throw new Error(
        "Cannot delete running experiment. Pause or complete it first."
      );
    }

    await this.storage.deleteExperiment(experimentId);
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<Experiment | null> {
    return this.storage.getExperiment(experimentId);
  }

  /**
   * List all experiments
   */
  async listExperiments(filter?: {
    status?: ExperimentStatus;
  }): Promise<Experiment[]> {
    return this.storage.listExperiments(filter);
  }

  /**
   * Update experiment configuration
   */
  async updateExperiment(
    experimentId: string,
    updates: Partial<Omit<ExperimentConfig, "id" | "createdAt" | "createdBy">>
  ): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status === "running") {
      throw new Error("Cannot update running experiment. Pause it first.");
    }

    // Apply updates
    if (updates.name) experiment.name = updates.name;
    if (updates.description !== undefined)
      experiment.description = updates.description;
    if (updates.variants) {
      const totalAllocation = updates.variants.reduce(
        (sum, v) => sum + v.allocation,
        0
      );
      if (Math.abs(totalAllocation - 100) > 0.01) {
        throw new Error("Variant allocations must sum to 100");
      }
      experiment.variants = this.normalizeAllocations(updates.variants);
    }
    if (updates.metrics) experiment.metrics = updates.metrics;
    if (updates.primaryMetric) experiment.primaryMetric = updates.primaryMetric;
    if (updates.secondaryMetrics)
      experiment.secondaryMetrics = updates.secondaryMetrics;
    if (updates.goals) experiment.goals = updates.goals;
    if (updates.targetSampleSize !== undefined)
      experiment.targetSampleSize = updates.targetSampleSize;
    if (updates.minSampleSize !== undefined)
      experiment.minSampleSize = updates.minSampleSize;
    if (updates.significanceLevel !== undefined)
      experiment.significanceLevel = updates.significanceLevel;
    if (updates.power !== undefined) experiment.power = updates.power;
    if (updates.mde !== undefined) experiment.mde = updates.mde;
    if (updates.duration) experiment.duration = updates.duration;
    if (updates.metadata)
      experiment.metadata = { ...experiment.metadata, ...updates.metadata };

    experiment.updatedAt = new Date();

    await this.storage.saveExperiment(experiment);
    return experiment;
  }

  /**
   * Get control variant for experiment
   */
  getControlVariant(experiment: Experiment): Variant {
    const control = experiment.variants.find(v => v.isControl);
    if (!control) {
      throw new Error("No control variant found");
    }
    return control;
  }

  /**
   * Get treatment variants for experiment
   */
  getTreatmentVariants(experiment: Experiment): Variant[] {
    return experiment.variants.filter(v => !v.isControl);
  }

  /**
   * Validate experiment is ready to start
   */
  validateExperimentReady(experiment: Experiment): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (experiment.variants.length < 2) {
      errors.push("Must have at least 2 variants");
    }

    const controls = experiment.variants.filter(v => v.isControl);
    if (controls.length !== 1) {
      errors.push("Must have exactly 1 control variant");
    }

    if (!experiment.primaryMetric) {
      errors.push("Must specify a primary metric");
    }

    if (!experiment.metrics || experiment.metrics.length === 0) {
      errors.push("Must specify at least one metric");
    }

    const totalAllocation = experiment.variants.reduce(
      (sum, v) => sum + v.allocation,
      0
    );
    if (Math.abs(totalAllocation - 100) > 0.01) {
      errors.push("Variant allocations must sum to 100");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate traffic split for variants
   */
  calculateTrafficSplit(experiment: Experiment): number[] {
    return experiment.variants.map(v => v.allocation / 100);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Normalize variant allocations to sum to 100
   */
  private normalizeAllocations(variants: Variant[]): Variant[] {
    const total = variants.reduce((sum, v) => sum + v.allocation, 0);
    if (Math.abs(total - 100) < 0.01) {
      return variants;
    }

    // Normalize proportionally
    return variants.map(v => ({
      ...v,
      allocation: (v.allocation / total) * 100,
    }));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// IN-MEMORY STORAGE (Default implementation)
// ============================================================================

/**
 * In-memory storage for experiments (for development/testing)
 */
export class InMemoryExperimentStorage implements ExperimentStorage {
  private experiments: Map<string, Experiment> = new Map();

  async getExperiment(id: string): Promise<Experiment | null> {
    return this.experiments.get(id) || null;
  }

  async saveExperiment(experiment: Experiment): Promise<void> {
    this.experiments.set(experiment.id, experiment);
  }

  async deleteExperiment(id: string): Promise<void> {
    this.experiments.delete(id);
  }

  async listExperiments(filter?: {
    status?: ExperimentStatus;
  }): Promise<Experiment[]> {
    let experiments = Array.from(this.experiments.values());
    if (filter?.status) {
      experiments = experiments.filter(e => e.status === filter.status);
    }
    return experiments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /** Clear all experiments (for testing) */
  clear(): void {
    this.experiments.clear();
  }

  /** Get storage size (for testing) */
  size(): number {
    return this.experiments.size;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an experiment manager with default in-memory storage
 */
export function createExperimentManager(
  config?: Partial<typeof DEFAULT_CONFIG>
): ExperimentManager {
  const storage = new InMemoryExperimentStorage();
  return new ExperimentManager(storage, config);
}
