/**
 * ExperimentDashboard - A/B testing and experiment analytics dashboard
 */

import { EventEmitter } from "eventemitter3";
import type {
  Experiment,
  ExperimentResults,
  DashboardConfig,
} from "../types.js";

export class ExperimentDashboard extends EventEmitter {
  private config: DashboardConfig;
  private experiments: Map<string, Experiment> = new Map();
  private experimentData: Map<
    string,
    Array<{
      userId: string;
      variant: string;
      metrics: Record<string, number>;
      timestamp: number;
    }>
  > = new Map();

  constructor(config: DashboardConfig) {
    super();
    this.config = config;
  }

  /**
   * Create an experiment
   */
  createExperiment(experiment: Omit<Experiment, "id">): Experiment {
    const id = this.generateId();
    const newExperiment: Experiment = {
      id,
      ...experiment,
    };

    this.experiments.set(id, newExperiment);
    this.emit("experimentCreated", newExperiment);

    return newExperiment;
  }

  /**
   * Get experiment
   */
  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  /**
   * Get all experiments
   */
  getAllExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get active experiments
   */
  getActiveExperiments(): Experiment[] {
    return Array.from(this.experiments.values()).filter(
      e => e.status === "running"
    );
  }

  /**
   * Start experiment
   */
  startExperiment(id: string): void {
    const experiment = this.experiments.get(id);
    if (experiment) {
      experiment.status = "running";
      experiment.startDate = Date.now();
      this.emit("experimentStarted", experiment);
    }
  }

  /**
   * Pause experiment
   */
  pauseExperiment(id: string): void {
    const experiment = this.experiments.get(id);
    if (experiment) {
      experiment.status = "paused";
      this.emit("experimentPaused", experiment);
    }
  }

  /**
   * Complete experiment
   */
  completeExperiment(id: string): void {
    const experiment = this.experiments.get(id);
    if (experiment) {
      experiment.status = "completed";
      experiment.endDate = Date.now();
      experiment.results = this.calculateResults(id);
      this.emit("experimentCompleted", experiment);
    }
  }

  /**
   * Record experiment data
   */
  recordData(
    experimentId: string,
    userId: string,
    variant: string,
    metrics: Record<string, number>
  ): void {
    if (!this.experimentData.has(experimentId)) {
      this.experimentData.set(experimentId, []);
    }

    this.experimentData.get(experimentId)!.push({
      userId,
      variant,
      metrics,
      timestamp: Date.now(),
    });

    this.emit("dataRecorded", { experimentId, userId, variant, metrics });
  }

  /**
   * Get experiment results
   */
  getResults(id: string): ExperimentResults | undefined {
    const experiment = this.experiments.get(id);
    if (!experiment) return undefined;

    return experiment.results || this.calculateResults(id);
  }

  /**
   * Calculate experiment results
   */
  private calculateResults(id: string): ExperimentResults | undefined {
    const experiment = this.experiments.get(id);
    if (!experiment) return undefined;

    const data = this.experimentData.get(id) || [];
    const variantData = new Map<
      string,
      Array<{ metrics: Record<string, number> }>
    >();

    for (const record of data) {
      if (!variantData.has(record.variant)) {
        variantData.set(record.variant, []);
      }
      variantData.get(record.variant)!.push({ metrics: record.metrics });
    }

    const totalParticipants = data.length;
    let totalConversions = 0;

    const variants = experiment.variants.map(variant => {
      const records = variantData.get(variant.id) || [];
      const participants = records.length;
      const conversions = records.filter(r => r.metrics.converted === 1).length;
      totalConversions += conversions;

      const conversionRate =
        participants > 0 ? (conversions / participants) * 100 : 0;

      return {
        id: variant.id,
        participants,
        conversions,
        conversionRate,
        confidence: 0.95, // Placeholder - would need statistical calculation
        significance: 0.05, // Placeholder
      };
    });

    // Find winner (highest conversion rate)
    const winner = variants.reduce((best, current) =>
      current.conversionRate > best.conversionRate ? current : best
    );

    // Calculate uplift vs control
    const control = variants[0];
    if (winner.id !== control.id) {
      winner.uplift =
        control.conversionRate > 0
          ? ((winner.conversionRate - control.conversionRate) /
              control.conversionRate) *
            100
          : 0;
      winner.improvement = winner.conversionRate - control.conversionRate;
    }

    return {
      totalParticipants,
      totalConversions,
      variants,
      winner: winner.id,
      recommended:
        winner.uplift && winner.uplift > 5 && winner.significance < 0.05,
    };
  }

  /**
   * Assign user to variant
   */
  assignVariant(experimentId: string, userId: string): string | undefined {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") {
      return undefined;
    }

    // Check if user already assigned
    const existingData = this.experimentData.get(experimentId);
    if (existingData) {
      const existing = existingData.find(d => d.userId === userId);
      if (existing) {
        return existing.variant;
      }
    }

    // Assign based on traffic allocation
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.traffic;
      if (random <= cumulative) {
        return variant.id;
      }
    }

    return experiment.variants[0]?.id;
  }

  /**
   * Delete experiment
   */
  deleteExperiment(id: string): boolean {
    this.experimentData.delete(id);
    return this.experiments.delete(id);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
