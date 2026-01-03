/**
 * Metrics Tracker
 *
 * Tracks training metrics across stages with:
 * - Loss, accuracy, mastery tracking
 * - Timing metrics
 * - Custom metrics support
 */

import type {
  MetricsTracker as IMetricsTracker,
  MetricsEvent,
  StageMetrics,
  MetricSeries,
} from "../types.js";

export class MetricsTracker implements IMetricsTracker {
  private stageMetrics: Map<string, StageMetrics> = new Map();
  private eventHistory: MetricsEvent[] = [];

  /**
   * Track a metric event
   */
  track(event: MetricsEvent): void {
    this.eventHistory.push(event);

    let metrics = this.stageMetrics.get(event.stageId);
    if (!metrics) {
      metrics = this.createStageMetrics(event.stageId);
      this.stageMetrics.set(event.stageId, metrics);
    }

    this.updateStageMetrics(metrics, event);

    // Keep only recent events
    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-5000);
    }
  }

  /**
   * Get metrics for a stage
   */
  getMetrics(stageId: string): StageMetrics {
    const metrics = this.stageMetrics.get(stageId);
    if (!metrics) {
      return this.createStageMetrics(stageId);
    }
    return this.cloneStageMetrics(metrics);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, StageMetrics> {
    const result = new Map<string, StageMetrics>();
    for (const [stageId, metrics] of this.stageMetrics.entries()) {
      result.set(stageId, this.cloneStageMetrics(metrics));
    }
    return result;
  }

  /**
   * Reset metrics for a stage or all
   */
  reset(stageId?: string): void {
    if (stageId) {
      this.stageMetrics.delete(stageId);
      this.eventHistory = this.eventHistory.filter(e => e.stageId !== stageId);
    } else {
      this.stageMetrics.clear();
      this.eventHistory = [];
    }
  }

  /**
   * Create new stage metrics
   */
  private createStageMetrics(stageId: string): StageMetrics {
    return {
      stageId,
      loss: this.createMetricSeries(),
      accuracy: this.createMetricSeries(),
      mastery: this.createMetricSeries(),
      timing: this.createMetricSeries(),
      custom: new Map(),
    };
  }

  /**
   * Create empty metric series
   */
  private createMetricSeries(): MetricSeries {
    return {
      values: [],
      timestamps: [],
      min: Infinity,
      max: -Infinity,
      mean: 0,
      std: 0,
    };
  }

  /**
   * Update stage metrics with event
   */
  private updateStageMetrics(metrics: StageMetrics, event: MetricsEvent): void {
    const series = this.getSeriesForType(metrics, event.type);

    series.values.push(event.value);
    series.timestamps.push(event.timestamp);

    this.updateMetricSeriesStats(series);
  }

  /**
   * Get metric series for event type
   */
  private getSeriesForType(metrics: StageMetrics, type: string): MetricSeries {
    switch (type) {
      case "loss":
        return metrics.loss;
      case "accuracy":
        return metrics.accuracy;
      case "mastery":
        return metrics.mastery;
      case "timing":
        return metrics.timing;
      case "custom":
        const customName = `custom_${Date.now()}`;
        const series = this.createMetricSeries();
        metrics.custom.set(customName, series);
        return series;
      default:
        return metrics.custom.get(type) || this.createMetricSeries();
    }
  }

  /**
   * Update metric series statistics
   */
  private updateMetricSeriesStats(series: MetricSeries): void {
    const values = series.values;
    if (values.length === 0) return;

    series.min = Math.min(...values);
    series.max = Math.max(...values);
    series.mean = values.reduce((sum, v) => sum + v, 0) / values.length;

    const variance =
      values.reduce((sum, v) => sum + (v - series.mean) ** 2, 0) /
      values.length;
    series.std = Math.sqrt(variance);
  }

  /**
   * Clone stage metrics (deep copy)
   */
  private cloneStageMetrics(metrics: StageMetrics): StageMetrics {
    return {
      stageId: metrics.stageId,
      loss: {
        ...metrics.loss,
        values: [...metrics.loss.values],
        timestamps: [...metrics.loss.timestamps],
      },
      accuracy: {
        ...metrics.accuracy,
        values: [...metrics.accuracy.values],
        timestamps: [...metrics.accuracy.timestamps],
      },
      mastery: {
        ...metrics.mastery,
        values: [...metrics.mastery.values],
        timestamps: [...metrics.mastery.timestamps],
      },
      timing: {
        ...metrics.timing,
        values: [...metrics.timing.values],
        timestamps: [...metrics.timing.timestamps],
      },
      custom: new Map(metrics.custom),
    };
  }

  /**
   * Get event history
   */
  getEventHistory(): MetricsEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events for a specific stage
   */
  getEventsForStage(stageId: string): MetricsEvent[] {
    return this.eventHistory.filter(e => e.stageId === stageId);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const data = {
      stageMetrics: Array.from(this.stageMetrics.entries()).map(
        ([stageId, metrics]) => ({
          stageId,
          loss: metrics.loss,
          accuracy: metrics.accuracy,
          mastery: metrics.mastery,
          timing: metrics.timing,
        })
      ),
      eventCount: this.eventHistory.length,
    };

    return JSON.stringify(data, null, 2);
  }
}
