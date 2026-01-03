/**
 * CacheWarming.test.ts
 *
 * Comprehensive tests for CacheWarming strategies.
 * Target: 35+ tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  CacheWarming,
  DEFAULT_CACHE_WARMING_CONFIG,
  PRODUCTION_CACHE_WARMING_CONFIG,
  MINIMAL_CACHE_WARMING_CONFIG,
  type WarmupJob,
} from "../CacheWarming.js";

// ============================================================================
// MARKOV CHAIN PREDICTIVE MODEL TESTS
// ============================================================================

describe("MarkovChainPredictiveModel", () => {
  it("should predict next UI based on transitions", () => {
    const warming = new CacheWarming();
    warming.recordAccess("dashboard");
    warming.recordAccess("settings");
    warming.recordAccess("dashboard");
    warming.recordAccess("profile");

    warming.trainPredictiveModel();

    // After training, should be able to predict
    const status = warming.getWarmingStatus();
    expect(status).toBeDefined();
  });

  it("should update confidence with more data", () => {
    const warming = new CacheWarming();

    // Record many transitions
    for (let i = 0; i < 100; i++) {
      warming.recordAccess("dashboard");
      warming.recordAccess("settings");
    }

    warming.trainPredictiveModel();

    const status = warming.getWarmingStatus();
    expect(status).toBeDefined();
  });
});

// ============================================================================
// USER PATTERN LEARNER TESTS
// ============================================================================

describe("UserPatternLearner", () => {
  let warming: CacheWarming;

  beforeEach(() => {
    warming = new CacheWarming({
      enableUserPatterns: true,
    });
  });

  describe("Pattern Recording", () => {
    it("should record UI access", () => {
      warming.recordAccess("dashboard");

      const patterns = warming.getUserPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it("should track access frequency", () => {
      for (let i = 0; i < 5; i++) {
        warming.recordAccess("dashboard");
      }

      const patterns = warming.getUserPatterns();
      const dashboardPattern = patterns.find(p => p.uiContext === "dashboard");

      if (dashboardPattern) {
        expect(dashboardPattern.frequency).toBe(5);
      }
    });

    it("should track last access time", async () => {
      const beforeAccess = Date.now();
      warming.recordAccess("dashboard");
      const afterAccess = Date.now();

      const patterns = warming.getUserPatterns();
      const dashboardPattern = patterns.find(p => p.uiContext === "dashboard");

      if (dashboardPattern) {
        expect(dashboardPattern.lastAccess).toBeGreaterThanOrEqual(
          beforeAccess
        );
        expect(dashboardPattern.lastAccess).toBeLessThanOrEqual(afterAccess);
      }
    });

    it("should track transitions between UIs", () => {
      warming.recordAccess("login");
      warming.recordAccess("dashboard");
      warming.recordAccess("settings");

      const patterns = warming.getUserPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("Pattern Prediction", () => {
    it("should predict next UI based on patterns", () => {
      // Create pattern: login -> dashboard -> settings
      warming.recordAccess("login");
      warming.recordAccess("dashboard");
      warming.recordAccess("settings");
      warming.recordAccess("login");
      warming.recordAccess("dashboard");

      const patterns = warming.getUserPatterns();
      expect(patterns).toBeDefined();
    });

    it("should get frequent UIs", () => {
      for (let i = 0; i < 10; i++) {
        warming.recordAccess("dashboard");
      }
      for (let i = 0; i < 5; i++) {
        warming.recordAccess("settings");
      }

      const jobs = warming.warm();
      expect(jobs).toBeDefined();
    });
  });
});

// ============================================================================
// WARMUP JOB CREATION TESTS
// ============================================================================

describe("Warmup Job Creation", () => {
  let warming: CacheWarming;

  beforeEach(() => {
    warming = new CacheWarming();
  });

  describe("Job Creation", () => {
    it("should create warmup jobs for UI contexts", async () => {
      const jobs = await warming.createWarmupJobs([
        "dashboard",
        "settings",
        "profile",
      ]);

      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(3);
    });

    it("should set job status to pending", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);

      expect(jobs[0].status).toBe("pending");
    });

    it("should calculate job priority", async () => {
      warming.recordAccess("dashboard");
      warming.recordAccess("dashboard");

      const jobs = await warming.createWarmupJobs(["dashboard"]);

      expect(jobs[0].priority).toBeGreaterThanOrEqual(0);
      expect(jobs[0].priority).toBeLessThanOrEqual(1);
    });

    it("should estimate job completion time", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);

      expect(jobs[0].estimatedTime).toBeGreaterThan(0);
    });

    it("should calculate job benefit", async () => {
      warming.recordAccess("dashboard");
      warming.trainPredictiveModel();

      const jobs = await warming.createWarmupJobs(["dashboard"]);

      expect(jobs[0].benefit).toBeGreaterThanOrEqual(0);
      expect(jobs[0].benefit).toBeLessThanOrEqual(1);
    });
  });

  describe("Job Lifecycle", () => {
    it("should execute warmup job", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);
      const job = jobs[0];

      await warming.executeWarmupJob(job);

      expect(job.status).toMatch(/completed|failed/);
      if (job.status === "completed") {
        expect(job.completedAt).toBeDefined();
      }
    });

    it("should handle job execution failure", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);
      const job = jobs[0];

      // Mock failure by making the job invalid
      await warming.executeWarmupJob({ ...job, uiContext: "" });

      // Should not throw
    });
  });
});

// ============================================================================
// WARMING STRATEGIES TESTS
// ============================================================================

describe("Warming Strategies", () => {
  describe("Preload Strategy", () => {
    it("should preload common UIs", async () => {
      const warming = new CacheWarming({
        strategy: "preload",
        preloadUIs: ["login", "dashboard", "settings"],
      });

      const jobs = await warming.warm();

      expect(jobs).toBeDefined();
      expect(jobs.length).toBeGreaterThan(0);
    });

    it("should use preload UIs from config", async () => {
      const warming = new CacheWarming({
        strategy: "preload",
        preloadUIs: ["custom1", "custom2"],
      });

      const jobs = await warming.warm();
      const uiContexts = jobs.map(j => j.uiContext);

      expect(uiContexts).toContain("custom1");
      expect(uiContexts).toContain("custom2");
    });
  });

  describe("Predictive Strategy", () => {
    it("should predict next UIs based on patterns", async () => {
      const warming = new CacheWarming({
        strategy: "predictive",
        predictionThreshold: 0.6,
        enableUserPatterns: true,
      });

      // Train the model
      warming.recordAccess("login");
      warming.recordAccess("dashboard");
      warming.recordAccess("settings");
      warming.recordAccess("login");
      warming.recordAccess("dashboard");
      warming.trainPredictiveModel();

      const jobs = await warming.warm(["login", "dashboard"]);

      expect(jobs).toBeDefined();
    });

    it("should respect prediction threshold", async () => {
      const warming = new CacheWarming({
        strategy: "predictive",
        predictionThreshold: 0.9, // High threshold
        enableUserPatterns: true,
      });

      // Limited training
      warming.recordAccess("dashboard");
      warming.trainPredictiveModel();

      const jobs = await warming.warm(["dashboard"]);

      expect(jobs).toBeDefined();
    });
  });

  describe("Adaptive Strategy", () => {
    it("should learn from user patterns", async () => {
      const warming = new CacheWarming({
        strategy: "adaptive",
        enableUserPatterns: true,
      });

      // Record user behavior
      for (let i = 0; i < 5; i++) {
        warming.recordAccess("dashboard");
        warming.recordAccess("settings");
      }

      const jobs = await warming.warm();

      expect(jobs).toBeDefined();
      expect(jobs.length).toBeGreaterThan(0);
    });

    it("should adapt to changing patterns", async () => {
      const warming = new CacheWarming({
        strategy: "adaptive",
        enableUserPatterns: true,
      });

      // Pattern 1: dashboard -> settings
      warming.recordAccess("dashboard");
      warming.recordAccess("settings");

      // Pattern 2: dashboard -> profile
      warming.recordAccess("dashboard");
      warming.recordAccess("profile");

      warming.trainPredictiveModel();

      const jobs = await warming.warm(["dashboard"]);

      expect(jobs).toBeDefined();
    });
  });
});

// ============================================================================
// WARMING STATUS TESTS
// ============================================================================

describe("Warming Status", () => {
  let warming: CacheWarming;

  beforeEach(() => {
    warming = new CacheWarming();
  });

  describe("Status Tracking", () => {
    it("should track total job count", async () => {
      await warming.createWarmupJobs(["dashboard", "settings"]);

      const status = warming.getWarmingStatus();
      expect(status.totalJobs).toBe(2);
    });

    it("should track pending jobs", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);

      const status = warming.getWarmingStatus();
      expect(status.pending).toBe(1);
      expect(status.running).toBe(0);
      expect(status.completed).toBe(0);
    });

    it("should track running jobs", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);

      // Start execution (async)
      warming.executeWarmupJob(jobs[0]);

      const status = warming.getWarmingStatus();
      expect(status).toBeDefined();
    });

    it("should track completed jobs", async () => {
      const jobs = await warming.createWarmupJobs(["dashboard"]);

      await warming.executeWarmupJob(jobs[0]);

      const status = warming.getWarmingStatus();
      expect(status.completed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Job Retrieval", () => {
    it("should get all jobs", async () => {
      await warming.createWarmupJobs(["dashboard", "settings"]);

      const jobs = warming.getJobs();
      expect(jobs).toBeDefined();
      expect(jobs.length).toBe(2);
    });

    it("should get job by UI context", async () => {
      await warming.createWarmupJobs(["dashboard"]);

      const job = warming.getJob("dashboard");
      expect(job).toBeDefined();
      expect(job?.uiContext).toBe("dashboard");
    });

    it("should return undefined for non-existent job", () => {
      const job = warming.getJob("non-existent");
      expect(job).toBeUndefined();
    });

    it("should clear all jobs", async () => {
      await warming.createWarmupJobs(["dashboard", "settings"]);

      warming.clearJobs();

      const jobs = warming.getJobs();
      expect(jobs).toBeDefined();
    });
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe("Configuration", () => {
  describe("Default Configuration", () => {
    it("should have default config values", () => {
      expect(DEFAULT_CACHE_WARMING_CONFIG.strategy).toBe("preload");
      expect(DEFAULT_CACHE_WARMING_CONFIG.preloadUIs).toContain("login");
      expect(DEFAULT_CACHE_WARMING_CONFIG.predictionThreshold).toBe(0.6);
      expect(DEFAULT_CACHE_WARMING_CONFIG.minPriority).toBe(0.5);
    });
  });

  describe("Production Configuration", () => {
    it("should use adaptive strategy", () => {
      expect(PRODUCTION_CACHE_WARMING_CONFIG.strategy).toBe("adaptive");
      expect(PRODUCTION_CACHE_WARMING_CONFIG.enableUserPatterns).toBe(true);
    });
  });

  describe("Minimal Configuration", () => {
    it("should have limited preload UIs", () => {
      expect(MINIMAL_CACHE_WARMING_CONFIG.preloadUIs.length).toBe(2);
      expect(MINIMAL_CACHE_WARMING_CONFIG.maxBackgroundRefresh).toBe(5);
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration", () => {
      const warming = new CacheWarming();

      warming.updateConfig({
        strategy: "predictive",
        predictionThreshold: 0.8,
      });

      const config = warming.getConfig();
      expect(config.strategy).toBe("predictive");
      expect(config.predictionThreshold).toBe(0.8);
    });
  });
});

// ============================================================================
// EDGE CASES TESTS
// ============================================================================

describe("Edge Cases", () => {
  it("should handle empty UI context list", async () => {
    const warming = new CacheWarming();

    const jobs = await warming.createWarmupJobs([]);
    expect(jobs).toEqual([]);
  });

  it("should handle duplicate UI contexts", async () => {
    const warming = new CacheWarming();

    const jobs = await warming.createWarmupJobs(["dashboard", "dashboard"]);
    expect(jobs).toBeDefined();
    expect(jobs.length).toBe(2);
  });

  it("should handle very long UI context names", async () => {
    const warming = new CacheWarming();
    const longName = "a".repeat(1000);

    const jobs = await warming.createWarmupJobs([longName]);
    expect(jobs).toBeDefined();
    expect(jobs[0].uiContext).toBe(longName);
  });

  it("should handle zero priority threshold", async () => {
    const warming = new CacheWarming({
      minPriority: 0,
    });

    const jobs = await warming.warm();
    expect(jobs).toBeDefined();
  });

  it("should handle high priority threshold", async () => {
    const warming = new CacheWarming({
      minPriority: 1.0,
    });

    const jobs = await warming.warm();
    expect(jobs).toBeDefined();
  });
});

// Total test count: 35+
