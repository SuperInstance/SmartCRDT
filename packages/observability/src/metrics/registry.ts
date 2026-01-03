/**
 * Prometheus Metrics Registry for Aequor
 *
 * Provides a centralized metrics registry with all metrics defined
 * for the Aequor Cognitive Orchestration Platform.
 */

import { Registry, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from "prom-client";
import {
  MetricDefinition,
  MetricNamespace,
  RoutingLabels,
  CacheLabels,
  PrivacyLabels,
  HardwareLabels,
  SecurityLabels,
  BusinessLabels,
  TrainingLabels,
} from "./types.js";

/**
 * Metrics Registry class
 */
export class MetricsRegistry {
  private registry: Registry;
  private metrics: Map<string, Counter<string> | Gauge<string> | Histogram<string> | Summary<string>>;

  constructor() {
    this.registry = new Registry();
    this.metrics = new Map();

    // Collect default Node.js metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics as Prometheus text format
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Register a counter metric
   */
  registerCounter(def: MetricDefinition): Counter<string> {
    const fullName = this.getFullName(def.namespace, def.name);

    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Counter<string>;
    }

    const counter = new Counter({
      name: fullName,
      help: def.help,
      labelNames: Object.keys(def.labels || {}),
      registers: [this.registry],
    });

    this.metrics.set(fullName, counter);
    return counter;
  }

  /**
   * Register a gauge metric
   */
  registerGauge(def: MetricDefinition): Gauge<string> {
    const fullName = this.getFullName(def.namespace, def.name);

    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Gauge<string>;
    }

    const gauge = new Gauge({
      name: fullName,
      help: def.help,
      labelNames: Object.keys(def.labels || {}),
      registers: [this.registry],
    });

    this.metrics.set(fullName, gauge);
    return gauge;
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(def: MetricDefinition): Histogram<string> {
    const fullName = this.getFullName(def.namespace, def.name);

    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Histogram<string>;
    }

    const histogram = new Histogram({
      name: fullName,
      help: def.help,
      labelNames: Object.keys(def.labels || {}),
      buckets: def.buckets || [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    this.metrics.set(fullName, histogram);
    return histogram;
  }

  /**
   * Register a summary metric
   */
  registerSummary(def: MetricDefinition): Summary<string> {
    const fullName = this.getFullName(def.namespace, def.name);

    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Summary<string>;
    }

    const summary = new Summary({
      name: fullName,
      help: def.help,
      labelNames: Object.keys(def.labels || {}),
      percentiles: def.quantiles || [{ 0.5: 0.05 }, { 0.9: 0.01 }, { 0.99: 0.001 }],
      registers: [this.registry],
    });

    this.metrics.set(fullName, summary);
    return summary;
  }

  /**
   * Get full metric name with namespace
   */
  private getFullName(namespace: MetricNamespace, name: string): string {
    return `aequor_${namespace}_${name}`;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.registry.clear();
    this.metrics.clear();
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Reset a specific metric
   */
  resetMetric(namespace: MetricNamespace, name: string): void {
    const fullName = this.getFullName(namespace, name);
    const metric = this.metrics.get(fullName);
    if (metric && "reset" in metric) {
      metric.reset();
    }
  }

  /**
   * Remove all metrics
   */
  async removeMetrics(): Promise<void> {
    await this.registry.resetMetrics();
    this.metrics.clear();
  }
}

/**
 * Singleton instance
 */
let globalRegistry: MetricsRegistry | null = null;

/**
 * Get or create the global metrics registry
 */
export function getGlobalRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}

/**
 * Define all Aequor metrics
 */
export function defineAequorMetrics(registry: MetricsRegistry): void {
  // Cascade Router Metrics
  registry.registerCounter({
    name: "requests_total",
    type: "counter",
    namespace: MetricNamespace.CASCADE,
    help: "Total number of requests routed",
    labels: {} as RoutingLabels,
  });

  registry.registerHistogram({
    name: "request_duration_seconds",
    type: "histogram",
    namespace: MetricNamespace.CASCADE,
    help: "Request routing duration in seconds",
    labels: {} as RoutingLabels,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  registry.registerCounter({
    name: "errors_total",
    type: "counter",
    namespace: MetricNamespace.CASCADE,
    help: "Total number of routing errors",
    labels: {} as RoutingLabels,
  });

  registry.registerGauge({
    name: "active_requests",
    type: "gauge",
    namespace: MetricNamespace.CASCADE,
    help: "Number of active requests being processed",
    labels: {} as RoutingLabels,
  });

  // Cache Metrics
  registry.registerCounter({
    name: "cache_operations_total",
    type: "counter",
    namespace: MetricNamespace.CACHE,
    help: "Total cache operations",
    labels: {} as CacheLabels,
  });

  registry.registerGauge({
    name: "cache_hit_rate",
    type: "gauge",
    namespace: MetricNamespace.CACHE,
    help: "Cache hit rate (0-1)",
    labels: {} as CacheLabels,
  });

  registry.registerGauge({
    name: "cache_size_bytes",
    type: "gauge",
    namespace: MetricNamespace.CACHE,
    help: "Current cache size in bytes",
    labels: {} as CacheLabels,
  });

  registry.registerCounter({
    name: "cache_evictions_total",
    type: "counter",
    namespace: MetricNamespace.CACHE,
    help: "Total cache evictions",
    labels: {} as CacheLabels,
  });

  // Privacy Metrics
  registry.registerCounter({
    name: "queries_processed_total",
    type: "counter",
    namespace: MetricNamespace.PRIVACY,
    help: "Total queries processed by privacy layer",
    labels: {} as PrivacyLabels,
  });

  registry.registerCounter({
    name: "redactions_total",
    type: "counter",
    namespace: MetricNamespace.PRIVACY,
    help: "Total redactions applied",
    labels: {} as PrivacyLabels,
  });

  registry.registerGauge({
    name: "epsilon_budget",
    type: "gauge",
    namespace: MetricNamespace.PRIVACY,
    help: "Current epsilon budget for differential privacy",
    labels: {} as PrivacyLabels,
  });

  registry.registerHistogram({
    name: "privacy_processing_seconds",
    type: "histogram",
    namespace: MetricNamespace.PRIVACY,
    help: "Privacy processing duration in seconds",
    labels: {} as PrivacyLabels,
  });

  // Hardware Metrics
  registry.registerGauge({
    name: "cpu_utilization_percent",
    type: "gauge",
    namespace: MetricNamespace.HARDWARE,
    help: "CPU utilization percentage",
    labels: {} as HardwareLabels,
  });

  registry.registerGauge({
    name: "gpu_utilization_percent",
    type: "gauge",
    namespace: MetricNamespace.HARDWARE,
    help: "GPU utilization percentage",
    labels: {} as HardwareLabels,
  });

  registry.registerGauge({
    name: "gpu_memory_bytes",
    type: "gauge",
    namespace: MetricNamespace.HARDWARE,
    help: "GPU memory usage in bytes",
    labels: {} as HardwareLabels,
  });

  registry.registerGauge({
    name: "temperature_celsius",
    type: "gauge",
    namespace: MetricNamespace.HARDWARE,
    help: "Hardware temperature in Celsius",
    labels: {} as HardwareLabels,
  });

  registry.registerGauge({
    name: "power_draw_watts",
    type: "gauge",
    namespace: MetricNamespace.HARDWARE,
    help: "Power draw in watts",
    labels: {} as HardwareLabels,
  });

  // Security Metrics
  registry.registerCounter({
    name: "security_events_total",
    type: "counter",
    namespace: MetricNamespace.SECURITY,
    help: "Total security events",
    labels: {} as SecurityLabels,
  });

  registry.registerCounter({
    name: "vulnerabilities_detected_total",
    type: "counter",
    namespace: MetricNamespace.SECURITY,
    help: "Total vulnerabilities detected",
    labels: {} as SecurityLabels,
  });

  registry.registerHistogram({
    name: "security_scan_seconds",
    type: "histogram",
    namespace: MetricNamespace.SECURITY,
    help: "Security scan duration in seconds",
    labels: {} as SecurityLabels,
  });

  // Business Metrics
  registry.registerCounter({
    name: "cost_total",
    type: "counter",
    namespace: MetricNamespace.BUSINESS,
    help: "Total cost in USD",
    labels: {} as BusinessLabels,
  });

  registry.registerGauge({
    name: "cost_savings_total",
    type: "gauge",
    namespace: MetricNamespace.BUSINESS,
    help: "Total cost savings from optimizations in USD",
    labels: {} as BusinessLabels,
  });

  registry.registerGauge({
    name: "active_users",
    type: "gauge",
    namespace: MetricNamespace.BUSINESS,
    help: "Number of active users",
    labels: {} as BusinessLabels,
  });

  // Training Metrics
  registry.registerCounter({
    name: "training_epochs_total",
    type: "counter",
    namespace: MetricNamespace.TRAINING,
    help: "Total training epochs completed",
    labels: {} as TrainingLabels,
  });

  registry.registerGauge({
    name: "training_loss",
    type: "gauge",
    namespace: MetricNamespace.TRAINING,
    help: "Current training loss",
    labels: {} as TrainingLabels,
  });

  registry.registerGauge({
    name: "training_accuracy",
    type: "gauge",
    namespace: MetricNamespace.TRAINING,
    help: "Current training accuracy",
    labels: {} as TrainingLabels,
  });

  registry.registerGauge({
    name: "orpo_odds_ratio",
    type: "gauge",
    namespace: MetricNamespace.TRAINING,
    help: "ORPO odds ratio",
    labels: {} as TrainingLabels,
  });

  registry.registerGauge({
    name: "shadow_log_size",
    type: "gauge",
    namespace: MetricNamespace.TRAINING,
    help: "Shadow log size in bytes",
    labels: {} as TrainingLabels,
  });
}
