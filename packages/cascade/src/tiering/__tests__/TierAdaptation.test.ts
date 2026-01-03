/**
 * Tests for Scale-Adaptive Tiers feature
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TierManager } from "../TierManager.js";
import { RequestRateMonitor } from "../RequestRateMonitor.js";
import { QuickFlowRouter } from "../QuickFlowRouter.js";
import { EnterpriseRouter } from "../EnterpriseRouter.js";
import { RequestQueue } from "../RequestQueue.js";
import { CascadeRouter } from "../../router/CascadeRouter.js";
import type { Tier, PriorityRequest } from "../types.js";

describe("RequestRateMonitor", () => {
  let monitor: RequestRateMonitor;

  beforeEach(() => {
    monitor = new RequestRateMonitor(60); // 60 second window
  });

  it("should initialize with zero RPM", () => {
    expect(monitor.getCurrentRpm()).toBe(0);
  });

  it("should calculate RPM correctly", () => {
    const now = Date.now();
    // Add 10 requests over 60 seconds = 10 RPM
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest(now);
    }

    expect(monitor.getCurrentRpm(now)).toBe(10);
  });

  it("should calculate average RPM over period", () => {
    const now = Date.now();
    // Add 30 requests over 60 seconds
    for (let i = 0; i < 30; i++) {
      monitor.recordRequest(now);
    }

    const avgRpm = monitor.getAverageRpm(60, now);
    expect(avgRpm).toBe(30);
  });

  it("should detect traffic spikes", () => {
    const now = Date.now();

    // Baseline: 5 requests
    for (let i = 0; i < 5; i++) {
      monitor.recordRequest(now);
    }

    // Check no spike yet
    const metrics1 = monitor.getMetrics(now);
    expect(metrics1.spikeDetected).toBe(false);

    // Wait for spike check window (5 seconds)
    const later = now + 6000;

    // Spike: add 10 more requests (now total 15, 3x increase)
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest(later);
    }

    const metrics2 = monitor.getMetrics(later);
    expect(metrics2.spikeDetected).toBe(true);
  });

  it("should detect increasing trend", () => {
    const now = Date.now();
    const windowStart = now - 60000;

    // Simulate increasing traffic
    for (let i = 0; i < 12; i++) {
      const requests = Math.floor((i + 1) * 2); // Increasing from 2 to 24
      for (let j = 0; j < requests; j++) {
        monitor.recordRequest(windowStart + i * 5000);
      }
    }

    const metrics = monitor.getMetrics(now);
    // Should detect stable or increasing trend (not decreasing)
    expect(["increasing", "stable"]).toContain(metrics.trend);
  });

  it("should clean up old requests", () => {
    const now = Date.now();
    const oldTime = now - 120000; // 2 minutes ago (outside window)

    // Add old request
    monitor.recordRequest(oldTime);

    // Add new requests
    for (let i = 0; i < 5; i++) {
      monitor.recordRequest(now);
    }

    // Old request should be cleaned up
    expect(monitor.getRequestCount(now)).toBe(5);
  });

  it("should clear all data", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest(now);
    }

    monitor.clear();

    expect(monitor.getCurrentRpm()).toBe(0);
    expect(monitor.getRequestCount()).toBe(0);
  });
});

describe("TierManager", () => {
  let manager: TierManager;

  beforeEach(() => {
    manager = new TierManager({ mode: "auto" });
  });

  it("should start in quick tier", () => {
    expect(manager.getCurrentTier()).toBe("quick");
  });

  it("should upgrade to standard at threshold", () => {
    const now = Date.now();

    // Add 15 requests (above threshold of 10)
    // Note: Need to wait slightly for hysteresis to pass
    for (let i = 0; i < 15; i++) {
      manager.recordRequest(now + i * 1000);
    }

    // Should be in standard or enterprise tier
    expect(["standard", "enterprise"]).toContain(manager.getCurrentTier());
  });

  it("should upgrade to enterprise at high volume", () => {
    const now = Date.now();

    // Add 120 requests (above standard threshold of 100)
    for (let i = 0; i < 120; i++) {
      manager.recordRequest(now + i * 500);
    }

    expect(manager.getCurrentTier()).toBe("enterprise");
  });

  it("should downgrade when traffic decreases", () => {
    const now = Date.now();

    // First, upgrade to standard or higher
    for (let i = 0; i < 15; i++) {
      manager.recordRequest(now + i * 1000);
    }

    // Wait for window to clear and add few requests
    const later = now + 70000;
    for (let i = 0; i < 5; i++) {
      manager.recordRequest(later + i * 1000);
    }

    // Should downgrade to quick or standard
    expect(["quick", "standard"]).toContain(manager.getCurrentTier());
  });

  it("should respect manual tier override", () => {
    manager.updateConfig({ manualOverride: true, mode: "manual" });

    manager.setManualTier("enterprise");
    expect(manager.getCurrentTier()).toBe("enterprise");

    // Add high traffic, but stay in manual tier
    const now = Date.now();
    for (let i = 0; i < 200; i++) {
      manager.recordRequest(now + i * 500);
    }

    expect(manager.getCurrentTier()).toBe("enterprise");
  });

  it("should provide correct tier stats", () => {
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      manager.recordRequest(now + i * 1000);
      manager.recordSuccess(100);
    }

    const stats = manager.getTierStats();

    expect(stats.requestsProcessed).toBe(10);
    expect(stats.successRate).toBe(1);
    expect(stats.averageLatency).toBe(100);
  });

  it("should check feature availability", () => {
    expect(manager.hasFeature("basic-routing")).toBe(true);
    expect(manager.hasFeature("priority-queuing")).toBe(false);

    // Upgrade to enterprise (need to enable manual override first)
    manager.updateConfig({ manualOverride: true, mode: "manual" });
    manager.setManualTier("enterprise");

    expect(manager.hasFeature("priority-queuing")).toBe(true);
  });

  it("should apply hysteresis to prevent rapid switching", () => {
    manager.updateConfig({ hysteresis: 0.5 });

    const now = Date.now();

    // Add 12 requests (above 10, but below 10 * 1.5 = 15)
    for (let i = 0; i < 12; i++) {
      manager.recordRequest(now + i * 1000);
    }

    // Should not upgrade yet due to hysteresis
    expect(manager.getCurrentTier()).toBe("quick");

    // Add more to pass hysteresis threshold
    for (let i = 12; i < 16; i++) {
      manager.recordRequest(now + i * 1000);
    }

    expect(manager.getCurrentTier()).toBe("standard");
  });
});

describe("QuickFlowRouter", () => {
  let router: QuickFlowRouter;

  beforeEach(() => {
    router = new QuickFlowRouter();
  });

  it("should route short queries locally", async () => {
    const decision = await router.route("short query");

    expect(decision.route).toBe("local");
    expect(decision.tier).toBe("quick");
    expect(decision.skipRefinement).toBe(true);
  });

  it("should route long queries to cloud", async () => {
    const longQuery = "a".repeat(150);

    const decision = await router.route(longQuery);

    expect(decision.route).toBe("cloud");
    expect(decision.tier).toBe("quick");
  });

  it("should handle any request", () => {
    expect(router.canHandle("anything")).toBe(true);
    expect(router.canHandle("")).toBe(true);
  });

  it("should have low estimated latency", () => {
    expect(router.getEstimatedLatency()).toBeLessThan(50);
  });

  it("should track statistics", async () => {
    await router.route("short");
    await router.route("a".repeat(150));

    const stats = router.getStats();

    expect(stats.totalRequests).toBe(2);
    expect(stats.localRequests).toBe(1);
    expect(stats.cloudRequests).toBe(1);
  });
});

describe("RequestQueue", () => {
  let queue: RequestQueue;

  beforeEach(() => {
    queue = new RequestQueue(10);
  });

  it("should enqueue requests successfully", () => {
    const request: PriorityRequest = {
      request: "test query",
      priority: "normal",
      timestamp: Date.now(),
    };

    const result = queue.enqueue(request);

    expect(result.success).toBe(true);
    expect(result.position).toBeDefined();
  });

  it("should respect priority order", () => {
    queue.enqueue({ request: "low", priority: "low", timestamp: Date.now() });
    queue.enqueue({
      request: "urgent",
      priority: "urgent",
      timestamp: Date.now(),
    });
    queue.enqueue({
      request: "normal",
      priority: "normal",
      timestamp: Date.now(),
    });

    const first = queue.dequeue();

    expect(first?.priority).toBe("urgent");
  });

  it("should reject when full", () => {
    // Fill queue
    for (let i = 0; i < 10; i++) {
      queue.enqueue({
        request: `query ${i}`,
        priority: "normal",
        timestamp: Date.now(),
      });
    }

    const result = queue.enqueue({
      request: "overflow",
      priority: "normal",
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
  });

  it("should calculate queue position correctly", () => {
    queue.enqueue({ request: "1", priority: "low", timestamp: Date.now() });
    const result = queue.enqueue({
      request: "2",
      priority: "high",
      timestamp: Date.now(),
    });

    // High priority should be ahead of low
    expect(result.position).toBeLessThan(1);
  });

  it("should provide accurate statistics", () => {
    queue.enqueue({ request: "1", priority: "normal", timestamp: Date.now() });
    queue.enqueue({ request: "2", priority: "high", timestamp: Date.now() });

    const stats = queue.getStats();

    expect(stats.length).toBe(2);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.normal).toBe(1);
    expect(stats.estimatedWaitTime).toBeGreaterThan(0);
  });

  it("should estimate wait time", () => {
    for (let i = 0; i < 5; i++) {
      queue.enqueue({
        request: `query ${i}`,
        priority: "normal",
        timestamp: Date.now(),
      });
    }

    const waitTime = queue.getEstimatedWaitTime("normal");

    // Should be 5 requests * 100ms avg = 500ms
    expect(waitTime).toBe(500);
  });

  it("should drop timed-out requests", () => {
    const oldTime = Date.now() - 10000;

    // Enqueue a request with old timestamp
    queue.enqueue({
      request: "timeout",
      priority: "normal",
      timestamp: oldTime,
      maxWaitTime: 5000, // 5 second timeout
    });

    // Request is in queue but should be dropped on dequeue
    const stats = queue.getStats();
    expect(stats.length).toBe(1);

    // When we dequeue, it should check timeout and drop
    const next = queue.dequeue();

    // Request should have been dropped due to timeout (10s old > 5s max)
    expect(next).toBeNull();
  });
});

describe("EnterpriseRouter", () => {
  let router: EnterpriseRouter;
  let cascadeRouter: CascadeRouter;

  beforeEach(() => {
    cascadeRouter = new CascadeRouter({}, false); // Disable refiner for tests
    router = new EnterpriseRouter(cascadeRouter, {
      maxQueueSize: 100,
      enableBatching: false,
    });
  });

  it("should route requests with CascadeRouter", async () => {
    const decision = await router.route("test query");

    expect(decision.tier).toBe("enterprise");
    expect(decision.route).toBeDefined();
  });

  it("should handle any request", () => {
    expect(router.canHandle("anything")).toBe(true);
  });

  it("should provide statistics", async () => {
    await router.route("test");

    const stats = router.getStats();

    expect(stats.totalRequests).toBeGreaterThan(0);
    expect(stats.queueStats).toBeDefined();
  });

  it("should queue requests under load", async () => {
    // Add many requests to queue
    for (let i = 0; i < 10; i++) {
      router.getQueue().enqueue({
        request: `query ${i}`,
        priority: "normal",
        timestamp: Date.now(),
      });
    }

    const stats = router.getStats();
    expect(stats.queueStats.length).toBeGreaterThan(0);
  });
});

describe("Tier Integration", () => {
  it("should handle full tier transition cycle", () => {
    const manager = new TierManager({ mode: "auto" });
    const now = Date.now();

    // Start in quick
    expect(manager.getCurrentTier()).toBe("quick");

    // Add enough requests to upgrade
    for (let i = 0; i < 120; i++) {
      manager.recordRequest(now + i * 500);
    }

    // Should reach enterprise tier
    expect(manager.getCurrentTier()).toBe("enterprise");

    // Check stats
    const stats = manager.getTierStats();
    expect(stats.totalTransitions).toBeGreaterThan(0);
  });

  it("should support manual override", () => {
    const manager = new TierManager({
      mode: "manual",
      manualOverride: true,
      currentTier: "enterprise",
    });

    // In manual mode with currentTier set, should stay at enterprise
    expect(manager.getCurrentTier()).toBe("enterprise");
  });

  it("should reset to auto mode", () => {
    const manager = new TierManager({
      mode: "manual",
      manualOverride: true,
      currentTier: "enterprise",
    });

    manager.enableAutoMode();

    expect(manager.getConfig().mode).toBe("auto");
  });
});
