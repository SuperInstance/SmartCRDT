/**
 * Metrics Integration Examples
 *
 * This file demonstrates how to integrate the metrics system
 * with existing Aequor components.
 */

import { MetricsCollector } from "./MetricsCollector.js";
import type { RouteDecision } from "../types.js";

/**
 * Example 1: Recording metrics from routing decisions
 *
 * Shows how to wrap routing to collect metrics.
 */
export function recordRouteMetrics(
  collector: MetricsCollector,
  decision: RouteDecision,
  query: string,
  latency: number,
  context?: { sessionId?: string }
): void {
  collector.recordRequest({
    backend: decision.route,
    model: "unknown", // Model selection happens at adapter level
    queryType: "general",
    latency,
    success: true,
    cost: decision.estimatedCost || 0,
    sessionId: context?.sessionId || "default",
    query: query.slice(0, 500),
  });
}

/**
 * Example 2: Recording routing errors
 */
export function recordRouteError(
  collector: MetricsCollector,
  error: Error,
  query: string,
  latency: number,
  context?: { sessionId?: string }
): void {
  collector.recordError({
    errorType: error.constructor.name,
    message: error.message,
    backend: "local",
    stack: error.stack,
  });

  collector.recordRequest({
    backend: "local",
    model: "unknown",
    queryType: "general",
    latency,
    success: false,
    cost: 0,
    sessionId: context?.sessionId || "default",
    query: query.slice(0, 500),
  });
}

/**
 * Example 3: Recording cache operations
 */
export function recordCacheOperation(
  collector: MetricsCollector,
  cacheType: "semantic" | "embedding" | "lru",
  hit: boolean,
  entrySize?: number
): void {
  collector.recordCache({
    cacheType,
    hit,
    entrySize,
  });
}

/**
 * Example 4: Recording adapter requests
 */
export function recordAdapterRequest(
  collector: MetricsCollector,
  backend: "local" | "cloud" | "hybrid",
  model: string,
  latency: number,
  success: boolean,
  cost: number,
  query: string,
  sessionId: string,
  error?: string
): void {
  collector.recordRequest({
    backend,
    model,
    queryType: "completion",
    latency,
    success,
    cost,
    sessionId,
    query: query.slice(0, 500),
    ...(error && { error }),
  });

  if (!success && error) {
    collector.recordError({
      errorType: "AdapterError",
      message: error,
      backend,
      model,
    });
  }
}

/**
 * Example 5: Setting up health monitoring
 */
export class HealthMonitor {
  private collector: MetricsCollector;
  private interval: NodeJS.Timeout | null = null;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Start periodic health checks
   */
  start(checkIntervalMs: number = 30000): void {
    this.interval = setInterval(async () => {
      await this.checkAllBackends();
    }, checkIntervalMs);
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Check all backends and record health status
   */
  private async checkAllBackends(): Promise<void> {
    await this.checkLocalBackend();
    await this.checkCloudBackend();
  }

  /**
   * Check local backend health
   */
  private async checkLocalBackend(): Promise<void> {
    const startTime = Date.now();

    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(5000),
      });
      const healthy = response.ok;

      this.collector.updateHealth({
        backend: "local",
        healthy,
        responseTime: Date.now() - startTime,
      });
    } catch {
      this.collector.updateHealth({
        backend: "local",
        healthy: false,
        responseTime: Date.now() - startTime,
        error: "Connection failed",
        consecutiveFailures: 1,
      });
    }
  }

  /**
   * Check cloud backend health
   */
  private async checkCloudBackend(): Promise<void> {
    const startTime = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Skip health check if no API key
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      const healthy = response.ok;

      this.collector.updateHealth({
        backend: "cloud",
        healthy,
        responseTime: Date.now() - startTime,
      });
    } catch {
      this.collector.updateHealth({
        backend: "cloud",
        healthy: false,
        responseTime: Date.now() - startTime,
        error: "Connection failed",
        consecutiveFailures: 1,
      });
    }
  }
}

/**
 * Example 6: Monitoring system metrics
 */
export class SystemMetricsMonitor {
  private collector: MetricsCollector;
  private interval: NodeJS.Timeout | null = null;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Start monitoring system metrics
   */
  start(updateIntervalMs: number = 5000): void {
    this.interval = setInterval(() => {
      this.updateSystemMetrics();
    }, updateIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.collector.updateSystemMetrics({
      queueDepth: 0, // Would need actual queue implementation
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      activeConnections: 0, // Would need actual connection tracking
    });
  }
}

/**
 * Example 7: Cost tracking helper
 */
export class CostTracker {
  private costPer1kTokens: Record<string, number> = {
    "gpt-4": 0.03,
    "gpt-3.5-turbo": 0.002,
    llama2: 0,
    mistral: 0,
  };

  /**
   * Calculate cost for a request
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const rate = this.costPer1kTokens[model] || 0;
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / 1000) * rate;
  }

  /**
   * Record request with cost
   */
  recordRequestWithCost(
    collector: MetricsCollector,
    model: string,
    inputTokens: number,
    outputTokens: number,
    backend: "local" | "cloud",
    latency: number,
    sessionId: string,
    query: string
  ): void {
    const cost = this.calculateCost(model, inputTokens, outputTokens);

    collector.recordRequest({
      backend,
      model,
      queryType: "completion",
      latency,
      success: true,
      cost,
      sessionId,
      query: query.slice(0, 500),
    });
  }

  /**
   * Set custom pricing
   */
  setPricing(model: string, costPer1k: number): void {
    this.costPer1kTokens[model] = costPer1k;
  }
}

/**
 * Example 8: Complete setup example
 *
 * Shows how to set up a fully instrumented system.
 */
export async function setupMetrics() {
  // Create metrics collector
  const collector = new MetricsCollector({
    enabled: true,
    retentionHours: 24,
    maxDataPoints: 10000,
    sampleRate: 1.0,
    server: {
      enabled: true,
      port: 3000,
      host: "0.0.0.0",
    },
    storage: {
      type: "memory",
    },
    dashboard: {
      enabled: true,
      path: "/metrics",
      updateInterval: 1000,
    },
  });

  // Start health monitoring
  const healthMonitor = new HealthMonitor(collector);
  healthMonitor.start(30000); // Check every 30 seconds

  // Start system metrics monitoring
  const systemMonitor = new SystemMetricsMonitor(collector);
  systemMonitor.start(5000); // Update every 5 seconds

  // Start metrics server
  const { MetricsServer } = await import("./MetricsServer.js");
  const server = new MetricsServer(collector);
  await server.start();

  console.log("Metrics dashboard started at http://localhost:3000/metrics");

  return {
    collector,
    server,
    healthMonitor,
    systemMonitor,
  };
}
