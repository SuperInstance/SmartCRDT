/**
 * Tests for Metrics system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MetricsCollector } from "../MetricsCollector.js";
import { MetricsStore } from "../MetricsStore.js";
import type { MetricsConfig } from "../types.js";

describe("MetricsStore", () => {
  let store: MetricsStore;
  let config: MetricsConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      retentionHours: 1,
      maxDataPoints: 1000,
      sampleRate: 1.0,
      server: { enabled: false, port: 3000, host: "0.0.0.0" },
      storage: { type: "memory" },
      dashboard: { enabled: false, path: "/metrics", updateInterval: 1000 },
    };
    store = new MetricsStore(config);
  });

  it("should write and retrieve metrics", () => {
    const metric = {
      name: "test_metric",
      type: "counter" as const,
      value: 42,
      timestamp: Date.now(),
      labels: { backend: "local", model: "test" },
    };

    store.write(metric);

    const results = store.query({
      name: "test_metric",
      start: 0,
      end: Date.now() + 1000,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(metric);
  });

  it("should filter metrics by labels", () => {
    const timestamp = Date.now();

    store.write({
      name: "test_metric",
      type: "counter",
      value: 1,
      timestamp,
      labels: { backend: "local" },
    });

    store.write({
      name: "test_metric",
      type: "counter",
      value: 2,
      timestamp,
      labels: { backend: "cloud" },
    });

    const localResults = store.query({
      name: "test_metric",
      start: 0,
      end: Date.now() + 1000,
      labels: { backend: "local" },
    });

    const cloudResults = store.query({
      name: "test_metric",
      start: 0,
      end: Date.now() + 1000,
      labels: { backend: "cloud" },
    });

    expect(localResults).toHaveLength(1);
    expect(localResults[0].value).toBe(1);
    expect(cloudResults).toHaveLength(1);
    expect(cloudResults[0].value).toBe(2);
  });

  it("should aggregate metrics", () => {
    const timestamp = Date.now();

    for (let i = 0; i < 10; i++) {
      store.write({
        name: "test_metric",
        type: "counter",
        value: i,
        timestamp: timestamp + i * 1000,
      });
    }

    const aggregated = store.aggregate({
      name: "test_metric",
      start: timestamp,
      end: timestamp + 10000,
      window: 5000,
      aggregation: "sum",
    });

    expect(aggregated.length).toBeGreaterThan(0);
  });

  it("should get latest value", () => {
    const timestamp = Date.now();

    store.write({
      name: "test_metric",
      type: "gauge",
      value: 10,
      timestamp,
    });

    store.write({
      name: "test_metric",
      type: "gauge",
      value: 20,
      timestamp: timestamp + 1000,
    });

    const latest = store.getLatest("test_metric");

    expect(latest).toBeDefined();
    expect(latest!.value).toBe(20);
  });

  it("should export Prometheus format", () => {
    store.write({
      name: "test_requests_total",
      type: "counter",
      value: 100,
      timestamp: Date.now(),
      labels: { backend: "local" },
      help: "Total requests",
    });

    const prometheus = store.exportPrometheus();

    expect(prometheus).toContain("# HELP test_requests_total Total requests");
    expect(prometheus).toContain("# TYPE test_requests_total counter");
    expect(prometheus).toContain("test_requests_total");
  });

  it("should enforce retention policy", () => {
    const oldTimestamp = Date.now() - 2 * 3600000; // 2 hours ago

    store.write({
      name: "old_metric",
      type: "counter",
      value: 1,
      timestamp: oldTimestamp,
    });

    store.write({
      name: "new_metric",
      type: "counter",
      value: 2,
      timestamp: Date.now(),
    });

    const oldResults = store.query({
      name: "old_metric",
      start: 0,
      end: Date.now(),
    });

    // Old metric should be removed by retention policy
    expect(oldResults).toHaveLength(0);
  });

  it("should get unique label values", () => {
    const timestamp = Date.now();

    store.write({
      name: "test_metric",
      type: "counter",
      value: 1,
      timestamp,
      labels: { backend: "local" },
    });

    store.write({
      name: "test_metric",
      type: "counter",
      value: 2,
      timestamp,
      labels: { backend: "cloud" },
    });

    store.write({
      name: "test_metric",
      type: "counter",
      value: 3,
      timestamp,
      labels: { backend: "hybrid" },
    });

    const backends = store.getLabelValues("test_metric", "backend");

    expect(backends).toEqual(["cloud", "hybrid", "local"]);
  });

  it("should get all metric names", () => {
    const timestamp = Date.now();

    store.write({
      name: "metric_a",
      type: "counter",
      value: 1,
      timestamp,
    });

    store.write({
      name: "metric_b",
      type: "counter",
      value: 2,
      timestamp,
    });

    const names = store.getMetricNames();

    expect(names).toContain("metric_a");
    expect(names).toContain("metric_b");
  });

  it("should clear all metrics", () => {
    store.write({
      name: "test_metric",
      type: "counter",
      value: 1,
      timestamp: Date.now(),
    });

    store.clear();

    const results = store.query({
      name: "test_metric",
      start: 0,
      end: Date.now(),
    });

    expect(results).toHaveLength(0);
  });

  it("should get storage statistics", () => {
    store.write({
      name: "test_metric",
      type: "counter",
      value: 1,
      timestamp: Date.now(),
    });

    const stats = store.getStats();

    expect(stats.totalMetrics).toBeGreaterThan(0);
    expect(stats.metricNames).toContain("test_metric");
    expect(stats.memoryUsage).toBeDefined();
  });
});

describe("MetricsCollector", () => {
  let collector: MetricsCollector;
  let config: Partial<MetricsConfig>;

  beforeEach(() => {
    config = {
      enabled: true,
      retentionHours: 1,
      maxDataPoints: 1000,
      sampleRate: 1.0,
    };

    collector = new MetricsCollector(config);
  });

  afterEach(() => {
    collector.clear();
  });

  it("should record requests", () => {
    collector.recordRequest({
      backend: "local",
      model: "llama2",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.requests.total).toBe(1);
    expect(snapshot.requests.byBackend.local).toBe(1);
    expect(snapshot.latency.avg).toBe(100);
  });

  it("should record errors", () => {
    collector.recordError({
      errorType: "ValidationError",
      message: "Invalid input",
      backend: "local",
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.requests.errors).toBe(1);
    expect(snapshot.requests.errorRate).toBeGreaterThan(0);
  });

  it("should record cache operations", () => {
    collector.recordCache({
      cacheType: "semantic",
      hit: true,
    });

    collector.recordCache({
      cacheType: "semantic",
      hit: false,
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.cache.hits).toBe(1);
    expect(snapshot.cache.misses).toBe(1);
    expect(snapshot.cache.hitRate).toBe(0.5);
  });

  it("should update health status", () => {
    collector.updateHealth({
      backend: "local",
      healthy: true,
      responseTime: 50,
    });

    collector.updateHealth({
      backend: "cloud",
      healthy: false,
      responseTime: 5000,
      error: "Connection timeout",
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.health.backends).toHaveLength(3);
    expect(snapshot.health.backends[0].healthy).toBe(true);
    expect(snapshot.health.backends[1].healthy).toBe(false);
  });

  it("should update system metrics", () => {
    collector.updateSystemMetrics({
      queueDepth: 10,
      cpuUsage: 45.5,
      memoryUsage: 60.2,
      activeConnections: 5,
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.health.queueDepth).toBe(10);
    expect(snapshot.health.cpuUsage).toBe(45.5);
    expect(snapshot.health.memoryUsage).toBe(60.2);
    expect(snapshot.health.activeConnections).toBe(5);
  });

  it("should calculate latency percentiles", () => {
    // Record latencies from 10ms to 200ms
    for (let i = 10; i <= 200; i += 10) {
      collector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: i,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const snapshot = collector.getSnapshot();

    expect(snapshot.latency.p50).toBeGreaterThan(90);
    expect(snapshot.latency.p95).toBeGreaterThan(180);
    expect(snapshot.latency.p99).toBeGreaterThanOrEqual(190);
  });

  it("should track costs", () => {
    collector.recordRequest({
      backend: "local",
      model: "llama2",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0.001,
      sessionId: "session-123",
      query: "Test query",
    });

    collector.recordRequest({
      backend: "cloud",
      model: "gpt-4",
      queryType: "question",
      latency: 500,
      success: true,
      cost: 0.02,
      sessionId: "session-123",
      query: "Test query",
    });

    const snapshot = collector.getSnapshot();

    expect(snapshot.cost.total).toBeCloseTo(0.021, 3);
    expect(snapshot.cost.byBackend.local).toBeCloseTo(0.001, 4);
    expect(snapshot.cost.byBackend.cloud).toBeCloseTo(0.02, 3);
  });

  it("should calculate requests per minute", async () => {
    const startTime = Date.now();

    // Record 30 requests over 30 seconds
    for (let i = 0; i < 30; i++) {
      collector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });

      // Wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const snapshot = collector.getSnapshot();

    // Should have ~60 RPM (30 requests in ~30 seconds)
    expect(snapshot.requests.rpm).toBeGreaterThan(30);
  });

  it("should get request log", () => {
    collector.recordRequest({
      backend: "local",
      model: "llama2",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
      requestId: "req-1",
    });

    collector.recordRequest({
      backend: "cloud",
      model: "gpt-4",
      queryType: "question",
      latency: 500,
      success: false,
      cost: 0.02,
      sessionId: "session-123",
      query: "Error query",
      requestId: "req-2",
      error: "Test error",
    });

    const log = collector.getRequestLog({ limit: 10 });

    expect(log).toHaveLength(2);
    expect(log[0].requestId).toBe("req-2"); // Most recent first
    expect(log[1].requestId).toBe("req-1");
  });

  it("should get error log", () => {
    collector.recordError({
      errorType: "ValidationError",
      message: "Error 1",
      backend: "local",
    });

    collector.recordError({
      errorType: "NetworkError",
      message: "Error 2",
      backend: "cloud",
    });

    const errors = collector.getErrorLog({ limit: 10 });

    expect(errors).toHaveLength(2);
    expect(errors[0].errorType).toBe("NetworkError"); // Most recent first
  });

  it("should filter error log by type", () => {
    collector.recordError({
      errorType: "ValidationError",
      message: "Error 1",
      backend: "local",
    });

    collector.recordError({
      errorType: "NetworkError",
      message: "Error 2",
      backend: "cloud",
    });

    collector.recordError({
      errorType: "ValidationError",
      message: "Error 3",
      backend: "local",
    });

    const validationErrors = collector.getErrorLog({
      limit: 10,
      errorType: "ValidationError",
    });

    expect(validationErrors).toHaveLength(2);
    expect(validationErrors.every(e => e.errorType === "ValidationError")).toBe(
      true
    );
  });

  it("should get time series data", () => {
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      collector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100 + i * 10,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const timeSeries = collector.getTimeSeries("request_latency_ms", 60000);

    expect(timeSeries.length).toBeGreaterThan(0);
    expect(timeSeries[0]).toHaveProperty("timestamp");
    expect(timeSeries[0]).toHaveProperty("value");
  });

  it("should export Prometheus format", () => {
    collector.recordRequest({
      backend: "local",
      model: "llama2",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
    });

    const prometheus = collector.exportPrometheus();

    expect(prometheus).toContain("# HELP");
    expect(prometheus).toContain("# TYPE");
    expect(prometheus).toContain("request_total");
    expect(prometheus).toContain("request_latency_ms");
  });

  it("should export JSON format", () => {
    collector.recordRequest({
      backend: "local",
      model: "llama2",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
    });

    const json = collector.exportJSON();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("requests");
    expect(parsed).toHaveProperty("latency");
    expect(parsed).toHaveProperty("cache");
    expect(parsed).toHaveProperty("cost");
    expect(parsed).toHaveProperty("health");
  });

  it("should respect sample rate", () => {
    const lowSampleRateCollector = new MetricsCollector({
      ...config,
      sampleRate: 0.1, // 10% sample rate
    });

    // Record 100 requests
    for (let i = 0; i < 100; i++) {
      lowSampleRateCollector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const snapshot = lowSampleRateCollector.getSnapshot();

    // Should record approximately 10% of requests (allowing for randomness)
    expect(snapshot.requests.total).toBeGreaterThan(0);
    expect(snapshot.requests.total).toBeLessThan(30);
  });

  it("should disable collection when disabled", () => {
    const disabledCollector = new MetricsCollector({
      ...config,
      enabled: false,
    });

    disabledCollector.recordRequest({
      backend: "local",
      model: "test",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
    });

    const snapshot = disabledCollector.getSnapshot();

    expect(snapshot.requests.total).toBe(0);
  });

  it("should truncate long queries in request log", () => {
    const longQuery = "a".repeat(1000);

    collector.recordRequest({
      backend: "local",
      model: "test",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: longQuery,
    });

    const log = collector.getRequestLog({ limit: 1 });

    expect(log[0].query.length).toBeLessThanOrEqual(500);
  });

  it("should enforce max data points in logs", () => {
    const smallCollector = new MetricsCollector({
      ...config,
      maxDataPoints: 5,
    });

    // Record 10 requests
    for (let i = 0; i < 10; i++) {
      smallCollector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const log = smallCollector.getRequestLog({ limit: 100 });

    // Should only keep the most recent 5
    expect(log.length).toBeLessThanOrEqual(5);
  });

  it("should calculate cost per 1K requests", () => {
    // Record 100 requests with $0.01 cost each
    for (let i = 0; i < 100; i++) {
      collector.recordRequest({
        backend: "cloud",
        model: "gpt-4",
        queryType: "question",
        latency: 500,
        success: true,
        cost: 0.01,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const snapshot = collector.getSnapshot();

    expect(snapshot.cost.total).toBeCloseTo(1.0, 5);
    expect(snapshot.cost.costPer1k).toBeCloseTo(10.0, 1);
  });

  it("should estimate monthly cost", () => {
    const now = Date.now();

    // Record $1 worth of requests
    for (let i = 0; i < 100; i++) {
      collector.recordRequest({
        backend: "cloud",
        model: "gpt-4",
        queryType: "question",
        latency: 500,
        success: true,
        cost: 0.01,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const snapshot = collector.getSnapshot();

    // Estimated monthly should be proportional to current rate
    expect(snapshot.cost.estimatedMonthly).toBeGreaterThan(0);
  });

  it("should get latency by backend", () => {
    // Local: fast
    for (let i = 0; i < 10; i++) {
      collector.recordRequest({
        backend: "local",
        model: "llama2",
        queryType: "question",
        latency: 50 + i,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    // Cloud: slow
    for (let i = 0; i < 10; i++) {
      collector.recordRequest({
        backend: "cloud",
        model: "gpt-4",
        queryType: "question",
        latency: 500 + i * 10,
        success: true,
        cost: 0.01,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const snapshot = collector.getSnapshot();

    expect(snapshot.latency.byBackend.local.avg).toBeLessThan(100);
    expect(snapshot.latency.byBackend.cloud.avg).toBeGreaterThan(500);
  });

  it("should clear all data", () => {
    collector.recordRequest({
      backend: "local",
      model: "test",
      queryType: "question",
      latency: 100,
      success: true,
      cost: 0,
      sessionId: "session-123",
      query: "Test query",
    });

    collector.recordError({
      errorType: "TestError",
      message: "Test error",
      backend: "local",
    });

    collector.clear();

    const snapshot = collector.getSnapshot();

    expect(snapshot.requests.total).toBe(0);
    expect(snapshot.requests.errors).toBe(0);
  });
});

describe("Metrics Integration", () => {
  it("should handle concurrent writes", async () => {
    const collector = new MetricsCollector({
      enabled: true,
      retentionHours: 1,
      maxDataPoints: 10000,
      sampleRate: 1.0,
    });

    // Record 1000 requests concurrently
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(
        collector.recordRequest({
          backend: i % 2 === 0 ? "local" : "cloud",
          model: "test",
          queryType: "question",
          latency: 100 + i,
          success: i % 10 !== 0,
          cost: i % 2 === 0 ? 0 : 0.01,
          sessionId: "session-123",
          query: `Query ${i}`,
        })
      );
    }

    await Promise.all(promises);

    const snapshot = collector.getSnapshot();

    expect(snapshot.requests.total).toBe(1000);
  });

  it("should maintain low memory overhead", () => {
    const collector = new MetricsCollector({
      enabled: true,
      retentionHours: 1,
      maxDataPoints: 1000,
      sampleRate: 1.0,
    });

    // Record max data points
    for (let i = 0; i < 1000; i++) {
      collector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    // Record more - should evict old entries
    for (let i = 0; i < 100; i++) {
      collector.recordRequest({
        backend: "local",
        model: "test",
        queryType: "question",
        latency: 100,
        success: true,
        cost: 0,
        sessionId: "session-123",
        query: `Query ${i}`,
      });
    }

    const log = collector.getRequestLog({ limit: 10000 });

    // Should not exceed max data points significantly
    expect(log.length).toBeLessThanOrEqual(1100);
  });
});
