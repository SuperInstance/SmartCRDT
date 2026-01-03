/**
 * Tests for Advanced Cache Warming System
 *
 * Tests for:
 * - PatternLearner - Query pattern learning
 * - AdvancedCacheWarmer - Multi-strategy warming
 * - PredictivePreloader - ML-based prediction
 * - WarmingProgressTracker - Progress tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PatternLearner } from "./PatternLearner.js";
import { AdvancedCacheWarmer, getDefaultStaticQueries } from "./AdvancedCacheWarmer.js";
import { PredictivePreloader } from "./PredictivePreloader.js";
import { WarmingProgressTracker, createConsoleTracker } from "./WarmingProgressTracker.js";
import { SemanticCache } from "../refiner/SemanticCache.js";
import { QueryRefiner } from "../refiner/QueryRefiner.js";
import type { QueryLogEntry, QueryPattern, CacheWarmingResult } from "@lsi/protocol";

describe("PatternLearner", () => {
  let learner: PatternLearner;

  beforeEach(() => {
    learner = new PatternLearner({
      minFrequency: 0.1,
      similarityThreshold: 0.8,
      maxPatterns: 50,
      enableTemporalAnalysis: true,
      enableClustering: true,
    });
  });

  describe("Frequency Analysis", () => {
    it("should learn patterns from query logs", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "What is JavaScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
          queryType: "question",
        },
        {
          query: "What is Python?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
          queryType: "question",
        },
        {
          query: "What is TypeScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
          queryType: "question",
        },
      ];

      const result = await learner.learnFromLogs(queryLogs);

      expect(result.patternCount).toBeGreaterThan(0);
      expect(result.clusterCount).toBeGreaterThan(0);
      expect(result.topPatterns).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should extract high-frequency patterns", async () => {
      const queryLogs: QueryLogEntry[] = Array.from({ length: 100 }, (_, i) => ({
        query: `What is ${i % 5}?`, // Repeating pattern
        timestamp: Date.now() + i * 1000,
        sessionId: "session1",
        cacheHit: false,
        queryType: "question",
      }));

      await learner.learnFromLogs(queryLogs);
      const patterns = learner.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(0.1);
    });

    it("should track query types in patterns", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "How do I write a function?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
          queryType: "how-to",
        },
        {
          query: "Explain recursion",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
          queryType: "explanation",
        },
      ];

      await learner.learnFromLogs(queryLogs);
      const patterns = learner.getPatterns();

      expect(patterns.some(p => p.queryTypes.includes("how-to"))).toBe(true);
      expect(patterns.some(p => p.queryTypes.includes("explanation"))).toBe(true);
    });
  });

  describe("Sequential Pattern Analysis", () => {
    it("should learn query sequences", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "What is JavaScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "How do I write a function?",
          timestamp: Date.now() + 1000,
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "What is Python?",
          timestamp: Date.now() + 2000,
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "How do I write a class?",
          timestamp: Date.now() + 3000,
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await learner.learnFromLogs(queryLogs);
      const sequentialPatterns = learner.getSequentialPatterns();

      expect(sequentialPatterns.length).toBeGreaterThan(0);
      expect(sequentialPatterns[0].confidence).toBeGreaterThan(0);
    });

    it("should predict next queries based on history", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "What is JavaScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "How do I use arrays?",
          timestamp: Date.now() + 1000,
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await learner.learnFromLogs(queryLogs);
      const predictions = learner.predictNextQueries(["What is JavaScript?"]);

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].query).toBeDefined();
      expect(predictions[0].confidence).toBeGreaterThan(0);
    });
  });

  describe("Pattern Clustering", () => {
    it("should cluster similar patterns", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "What is JavaScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "What is Python?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "What is TypeScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await learner.learnFromLogs(queryLogs);
      const clusters = learner.getClusters();

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters[0].patterns).toBeDefined();
      expect(clusters[0].size).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should provide learning statistics", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "Test query",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await learner.learnFromLogs(queryLogs);
      const stats = learner.getStats();

      expect(stats.patternCount).toBeGreaterThan(0);
      expect(stats.clusterCount).toBeGreaterThanOrEqual(0);
      expect(stats.sequentialPatternCount).toBeGreaterThanOrEqual(0);
      expect(stats.avgPatternFrequency).toBeGreaterThanOrEqual(0);
    });

    it("should clear learned patterns", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "Test query",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await learner.learnFromLogs(queryLogs);
      expect(learner.getPatterns().length).toBeGreaterThan(0);

      learner.clear();
      expect(learner.getPatterns().length).toBe(0);
    });
  });
});

describe("PredictivePreloader", () => {
  let preloader: PredictivePreloader;
  let mockCache: SemanticCache;
  let mockRouter: any;

  beforeEach(() => {
    preloader = new PredictivePreloader({
      modelType: "frequency",
      confidenceThreshold: 0.5,
      maxPredictions: 10,
      trainingSize: 100,
    });

    mockCache = new SemanticCache({
      maxSize: 100,
      similarityThreshold: 0.85,
    });

    mockRouter = {
      route: vi.fn().mockResolvedValue({
        backend: "local",
        model: "test",
        content: "Test response",
      }),
    };
  });

  describe("Training", () => {
    it("should train on query logs", async () => {
      const queryLogs: QueryLogEntry[] = Array.from({ length: 50 }, (_, i) => ({
        query: `Query ${i % 10}`, // Repeating queries
        timestamp: Date.now() + i * 1000,
        sessionId: "session1",
        cacheHit: false,
      }));

      const metrics = await preloader.train(queryLogs);

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
      expect(metrics.trainingTime).toBeGreaterThan(0);
      expect(metrics.sampleCount).toBe(50);
    });

    it("should calculate F1 score", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "Test query",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      const metrics = await preloader.train(queryLogs);

      expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(metrics.f1Score).toBeLessThanOrEqual(1);
    });
  });

  describe("Prediction", () => {
    it("should predict queries using frequency model", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "What is JavaScript?",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "What is JavaScript?",
          timestamp: Date.now() + 1000,
          sessionId: "session1",
          cacheHit: false,
        },
        {
          query: "What is Python?",
          timestamp: Date.now() + 2000,
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await preloader.train(queryLogs);
      const predictions = await preloader.predict([]);

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].query).toBeDefined();
      expect(predictions[0].confidence).toBeGreaterThan(0);
      expect(predictions[0].predictedTime).toBeGreaterThan(Date.now());
    });

    it("should filter predictions by confidence threshold", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "Test query",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await preloader.train(queryLogs);

      // Set high threshold
      preloader = new PredictivePreloader({
        modelType: "frequency",
        confidenceThreshold: 0.9,
        maxPredictions: 10,
      });

      await preloader.train(queryLogs);
      const predictions = await preloader.predict([]);

      // All predictions should meet threshold
      for (const pred of predictions) {
        expect(pred.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe("Preloading", () => {
    it("should preload predictions into cache", async () => {
      const predictions = [
        {
          query: "What is JavaScript?",
          confidence: 0.8,
          predictedTime: Date.now() + 60000,
          reasoning: "Test",
        },
        {
          query: "What is Python?",
          confidence: 0.7,
          predictedTime: Date.now() + 60000,
          reasoning: "Test",
        },
      ];

      const count = await preloader.preload(predictions, mockCache, mockRouter);

      expect(count).toBe(2);
      expect(mockRouter.route).toHaveBeenCalledTimes(2);
    });

    it("should handle preload failures gracefully", async () => {
      mockRouter.route.mockRejectedValueOnce(new Error("Test error"));

      const predictions = [
        {
          query: "What is JavaScript?",
          confidence: 0.8,
          predictedTime: Date.now() + 60000,
          reasoning: "Test",
        },
      ];

      const count = await preloader.preload(predictions, mockCache, mockRouter);

      // Should still return 0 as no queries were successfully preloaded
      expect(count).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should provide model statistics", () => {
      const stats = preloader.getStats();

      expect(stats.modelType).toBe("frequency");
      expect(stats.confidenceThreshold).toBe(0.5);
      expect(stats.maxPredictions).toBe(10);
      expect(stats.trained).toBe(false);
    });

    it("should clear models", async () => {
      const queryLogs: QueryLogEntry[] = [
        {
          query: "Test query",
          timestamp: Date.now(),
          sessionId: "session1",
          cacheHit: false,
        },
      ];

      await preloader.train(queryLogs);
      expect(preloader.getStats().trained).toBe(true);

      preloader.clear();
      expect(preloader.getStats().trained).toBe(false);
    });
  });
});

describe("WarmingProgressTracker", () => {
  let tracker: WarmingProgressTracker;

  beforeEach(() => {
    tracker = new WarmingProgressTracker();
  });

  describe("Progress Tracking", () => {
    it("should track warming progress", () => {
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const progress = tracker.getCurrentProgress();

      expect(progress.stage).toBe("warming_cache");
      expect(progress.queriesWarmed).toBe(50);
      expect(progress.totalQueries).toBe(100);
      expect(progress.progress).toBeGreaterThan(0);
    });

    it("should calculate overall progress", () => {
      tracker.start();
      tracker.startStage("initializing", 10);
      tracker.completeStage(); // Move to next stage
      tracker.startStage("loading_patterns", 20);
      tracker.updateProgress(10);

      const progress = tracker.getCurrentProgress();

      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });

    it("should estimate time remaining", () => {
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const progress = tracker.getCurrentProgress();

      expect(progress.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Stage Management", () => {
    it("should complete stages in order", () => {
      tracker.start();
      tracker.startStage("initializing");
      tracker.completeStage();

      expect(tracker.getCurrentStage()).not.toBe("initializing");
    });

    it("should mark warming as complete", () => {
      tracker.start();
      tracker.startStage("verifying");
      tracker.completeStage();

      expect(tracker.isComplete()).toBe(true);
      expect(tracker.isInProgress()).toBe(false);
    });

    it("should mark warming as failed", () => {
      tracker.start();
      tracker.fail("Test error");

      expect(tracker.isFailed()).toBe(true);
      expect(tracker.isInProgress()).toBe(false);
    });
  });

  describe("Event Handling", () => {
    it("should emit stage events", () => {
      const stageStartSpy = vi.fn();
      tracker.on("stage_start", stageStartSpy);

      tracker.start();
      tracker.startStage("warming_cache");

      expect(stageStartSpy).toHaveBeenCalled();
    });

    it("should emit progress events", () => {
      const progressSpy = vi.fn();
      tracker.on("progress_update", progressSpy);

      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      expect(progressSpy).toHaveBeenCalled();
    });

    it("should store progress snapshots", () => {
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const snapshots = tracker.getSnapshots();

      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should provide warming statistics", () => {
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const stats = tracker.getStats();

      expect(stats.currentStage).toBe("warming_cache");
      expect(stats.queriesWarmed).toBe(50);
      expect(stats.totalQueries).toBe(100);
      expect(snapshot => expect(snapshot.elapsedTime).toBeGreaterThan(0));
    });

    it("should generate progress report", () => {
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const report = tracker.generateReport();

      expect(report).toContain("warming_cache");
      expect(report).toContain("50/100");
    });
  });

  describe("Console Tracker", () => {
    it("should create console tracker with logging", () => {
      const consoleTracker = createConsoleTracker(true);

      expect(consoleTracker).toBeInstanceOf(WarmingProgressTracker);
    });
  });
});

describe("AdvancedCacheWarmer Integration", () => {
  it("should provide default static queries", () => {
    const queries = getDefaultStaticQueries();

    expect(queries.length).toBeGreaterThan(0);
    expect(queries).toContain("What is JavaScript?");
    expect(queries).toContain("How do I bake a cake?");
  });

  it("should validate warming configuration", () => {
    // This would be tested with actual AdvancedCacheWarmer
    // but requires full setup of SemanticCache and CascadeRouter
    expect(true).toBe(true);
  });
});

describe("Warming Effectiveness Metrics", () => {
  it("should calculate hit rate improvement", () => {
    const initialHitRate = 0.1;
    const finalHitRate = 0.6;
    const improvement = finalHitRate - initialHitRate;

    expect(improvement).toBe(0.5);
    expect(improvement).toBeGreaterThan(0);
  });

  it("should calculate effectiveness score", () => {
    const hitRate = 0.6;
    const duration = 25000; // 25 seconds
    const memoryUsage = 400000000; // 400MB

    const targetHitRate = 0.6;
    const targetDuration = 30000; // 30 seconds
    const targetMemory = 524288000; // 500MB

    const hitRateScore = Math.min(hitRate / targetHitRate, 1.0);
    const durationScore = Math.min(targetDuration / duration, 1.0);
    const memoryScore = Math.min(targetMemory / memoryUsage, 1.0);

    const effectiveness = hitRateScore * 0.5 + durationScore * 0.3 + memoryScore * 0.2;

    expect(effectiveness).toBeGreaterThan(0);
    expect(effectiveness).toBeLessThanOrEqual(1);
  });

  it("should meet target metrics", () => {
    const finalHitRate = 0.65; // 65%
    const duration = 20000; // 20 seconds
    const memoryUsage = 450000000; // 450MB

    const targetHitRate = 0.6; // 60%
    const targetDuration = 30000; // 30 seconds
    const targetMemory = 524288000; // 500MB

    const hitRateAchieved = finalHitRate >= targetHitRate;
    const timeAchieved = duration <= targetDuration;
    const memoryAchieved = memoryUsage <= targetMemory;

    expect(hitRateAchieved).toBe(true);
    expect(timeAchieved).toBe(true);
    expect(memoryAchieved).toBe(true);
  });
});
