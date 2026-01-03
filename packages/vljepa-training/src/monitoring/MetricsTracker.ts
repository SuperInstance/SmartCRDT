/**
 * @fileoverview Metrics tracker for training metrics
 * @package @lsi/vljepa-training
 */

import type {
  MetricsConfig,
  TrainingMetrics,
  AggregationType,
  MetricStorageConfig,
} from "../types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Aggregated metrics over a window
 */
interface AggregatedMetrics {
  window: number;
  metrics: {
    [key: string]: number;
  };
}

/**
 * Metrics storage backend interface
 */
interface MetricsStorage {
  save(metrics: TrainingMetrics[]): Promise<void>;
  load(): Promise<TrainingMetrics[]>;
  clear(): Promise<void>;
}

/**
 * In-memory storage
 */
class MemoryStorage implements MetricsStorage {
  private metrics: TrainingMetrics[] = [];

  async save(metrics: TrainingMetrics[]): Promise<void> {
    this.metrics = metrics;
  }

  async load(): Promise<TrainingMetrics[]> {
    return this.metrics;
  }

  async clear(): Promise<void> {
    this.metrics = [];
  }
}

/**
 * File-based storage
 */
class FileStorage implements MetricsStorage {
  private filePath: string;

  constructor(config: MetricStorageConfig) {
    this.filePath = config.path || "metrics.json";
  }

  async save(metrics: TrainingMetrics[]): Promise<void> {
    const dir = join(this.filePath, "..");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(this.filePath, JSON.stringify(metrics, null, 2));
  }

  async load(): Promise<TrainingMetrics[]> {
    // In a real implementation, read from file
    return [];
  }

  async clear(): Promise<void> {
    this.metrics = [];
  }

  private metrics: TrainingMetrics[] = [];
}

/**
 * Metrics tracker for training
 *
 * Tracks all training metrics with support for:
 * - Scalar metrics (loss, accuracy, etc.)
 * - Histogram metrics (weights, gradients)
 * - Aggregation over windows
 * - Multiple storage backends
 */
export class MetricsTracker {
  private config: MetricsConfig;
  private storage: MetricsStorage;
  private history: TrainingMetrics[] = [];
  private currentWindow: TrainingMetrics[] = [];
  private aggregations: Map<string, AggregatedMetrics[]> = new Map();
  private scalars: Map<string, number[]> = new Map();
  private histograms: Map<string, number[][]> = new Map();

  constructor(config: MetricsConfig) {
    this.config = config;

    // Initialize storage backend
    switch (config.storage.backend) {
      case "memory":
        this.storage = new MemoryStorage();
        break;
      case "file":
        this.storage = new FileStorage(config.storage);
        break;
      default:
        this.storage = new MemoryStorage();
    }

    // Initialize scalar tracking
    for (const scalar of config.scalars) {
      this.scalars.set(scalar, []);
    }

    // Initialize histogram tracking
    for (const hist of config.histograms) {
      this.histograms.set(hist, []);
    }
  }

  /**
   * Log metrics
   */
  logMetrics(metrics: TrainingMetrics): void {
    this.history.push(metrics);
    this.currentWindow.push(metrics);

    // Extract scalars
    this.extractScalars(metrics);

    // Check aggregation
    if (this.currentWindow.length >= 100) {
      this.aggregate();
    }
  }

  /**
   * Log a scalar metric
   */
  logScalar(tag: string, value: number, step: number): void {
    if (!this.scalars.has(tag)) {
      this.scalars.set(tag, []);
    }
    this.scalars.get(tag)!.push(value);
  }

  /**
   * Log a histogram metric
   */
  logHistogram(tag: string, values: number[], step: number): void {
    if (!this.histograms.has(tag)) {
      this.histograms.set(tag, []);
    }
    this.histograms.get(tag)!.push(values);
  }

  /**
   * Extract scalars from metrics
   */
  private extractScalars(metrics: TrainingMetrics): void {
    // Loss
    this.logScalar("loss_training", metrics.loss.training, metrics.epoch);
    this.logScalar("loss_validation", metrics.loss.validation, metrics.epoch);

    // Accuracy
    if (metrics.accuracy.top1 !== undefined) {
      this.logScalar("accuracy_top1", metrics.accuracy.top1, metrics.epoch);
    }
    if (metrics.accuracy.top5 !== undefined) {
      this.logScalar("accuracy_top5", metrics.accuracy.top5, metrics.epoch);
    }

    // Latency
    this.logScalar("latency_forward", metrics.latency.forward, metrics.epoch);
    this.logScalar("latency_backward", metrics.latency.backward, metrics.epoch);
    this.logScalar("latency_total", metrics.latency.total, metrics.epoch);

    // Memory
    this.logScalar("memory_gpu", metrics.memory.gpu, metrics.epoch);
    this.logScalar("memory_cpu", metrics.memory.cpu, metrics.epoch);
    this.logScalar("memory_peak", metrics.memory.peak, metrics.epoch);

    // Throughput
    this.logScalar("throughput", metrics.throughput, metrics.epoch);

    // Learning
    this.logScalar(
      "gradient_norm",
      metrics.learning.gradientNorm,
      metrics.epoch
    );
    this.logScalar(
      "learning_rate",
      metrics.learning.learningRate,
      metrics.epoch
    );
  }

  /**
   * Aggregate metrics over current window
   */
  private aggregate(): void {
    for (const aggType of this.config.aggregations) {
      const result = this.computeAggregation(aggType);
      const key = `${aggType}_${this.history.length}`;

      if (!this.aggregations.has(aggType)) {
        this.aggregations.set(aggType, []);
      }

      this.aggregations.get(aggType)!.push({
        window: this.history.length,
        metrics: result,
      });
    }

    this.currentWindow = [];
  }

  /**
   * Compute aggregation over current window
   */
  private computeAggregation(type: AggregationType): Record<string, number> {
    const result: Record<string, number> = {};

    for (const metrics of this.currentWindow) {
      // Aggregate training loss
      if (!result.loss_training) {
        result.loss_training = metrics.loss.training;
      } else {
        result.loss_training = this.combine(
          result.loss_training,
          metrics.loss.training,
          type
        );
      }

      // Aggregate validation loss
      if (!result.loss_validation) {
        result.loss_validation = metrics.loss.validation;
      } else {
        result.loss_validation = this.combine(
          result.loss_validation,
          metrics.loss.validation,
          type
        );
      }

      // Aggregate accuracy
      if (metrics.accuracy.top1 !== undefined) {
        if (!result.accuracy_top1) {
          result.accuracy_top1 = metrics.accuracy.top1;
        } else {
          result.accuracy_top1 = this.combine(
            result.accuracy_top1,
            metrics.accuracy.top1,
            type
          );
        }
      }
    }

    return result;
  }

  /**
   * Combine two values using aggregation type
   */
  private combine(a: number, b: number, type: AggregationType): number {
    switch (type) {
      case "mean":
        return (a + b) / 2;
      case "sum":
        return a + b;
      case "min":
        return Math.min(a, b);
      case "max":
        return Math.max(a, b);
      default:
        return a;
    }
  }

  /**
   * Get metric history
   */
  getHistory(): TrainingMetrics[] {
    return [...this.history];
  }

  /**
   * Get latest metrics
   */
  getLatest(): TrainingMetrics | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  /**
   * Get scalar history
   */
  getScalar(tag: string): number[] {
    return this.scalars.get(tag) || [];
  }

  /**
   * Get histogram history
   */
  getHistogram(tag: string): number[][] {
    return this.histograms.get(tag) || [];
  }

  /**
   * Get aggregated metrics
   */
  getAggregations(type: AggregationType): AggregatedMetrics[] {
    return this.aggregations.get(type) || [];
  }

  /**
   * Compute statistics for a metric
   */
  getStatistics(tag: string): {
    min: number;
    max: number;
    mean: number;
    std: number;
    median: number;
  } | null {
    const values = this.scalars.get(tag);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;
    const std = Math.sqrt(variance);

    return { min, max, mean, std, median };
  }

  /**
   * Save metrics to storage
   */
  async save(): Promise<void> {
    await this.storage.save(this.history);
  }

  /**
   * Load metrics from storage
   */
  async load(): Promise<void> {
    this.history = await this.storage.load();

    // Rebuild scalar tracking
    for (const metrics of this.history) {
      this.extractScalars(metrics);
    }
  }

  /**
   * Clear all metrics
   */
  async clear(): Promise<void> {
    this.history = [];
    this.currentWindow = [];
    this.aggregations.clear();
    this.scalars.clear();
    this.histograms.clear();
    await this.storage.clear();
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): Record<string, unknown> {
    return {
      totalSteps: this.history.length,
      scalars: Object.fromEntries(
        Array.from(this.scalars.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            latest: values[values.length - 1],
          },
        ])
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
          },
        ])
      ),
    };
  }
}
