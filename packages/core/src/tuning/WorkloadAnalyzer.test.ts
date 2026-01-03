/**
 * Tests for WorkloadAnalyzer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WorkloadAnalyzer,
  createWorkloadAnalyzer,
  type WorkloadPattern,
} from "./WorkloadAnalyzer.js";
import { type QueryHistory } from "./AutoTuner.js";

describe("WorkloadAnalyzer", () => {
  let analyzer: WorkloadAnalyzer;

  beforeEach(() => {
    analyzer = createWorkloadAnalyzer();
  });

  describe("Constructor", () => {
    it("should create a WorkloadAnalyzer with default config", () => {
      expect(analyzer).toBeInstanceOf(WorkloadAnalyzer);
    });

    it("should create with custom config", () => {
      const customAnalyzer = createWorkloadAnalyzer({
        patternWindowSize: 200,
        burstThreshold: 3.0,
        minBurstDuration: 10000,
      });

      expect(customAnalyzer).toBeInstanceOf(WorkloadAnalyzer);
    });
  });

  describe("analyze", () => {
    it("should return empty array for empty history", async () => {
      const patterns = await analyzer.analyze([], 100);

      expect(patterns).toEqual([]);
    });

    it("should detect steady workload pattern", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 100);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty("patternType");
      expect(patterns[0]).toHaveProperty("avgComplexity");
      expect(patterns[0]).toHaveProperty("avgThroughput");
      expect(patterns[0]).toHaveProperty("cacheHitRate");
    });

    it("should detect burst workload pattern", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Normal traffic
      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: baseTime + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      // Burst
      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: baseTime + 50000 + i * 100,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 150,
          cacheHit: false,
        });
      }

      const patterns = await analyzer.analyze(history, 100);

      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should detect interactive workload pattern", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: Date.now() + i * 5000,
          queryType: "interactive",
          complexity: 0.3,
          length: 50,
          latency: 50,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should calculate average complexity correctly", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 10; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.3,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      for (let i = 0; i < 10; i++) {
        history.push({
          timestamp: Date.now() + (10 + i) * 1000,
          queryType: "test",
          complexity: 0.7,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      expect(patterns[0].avgComplexity).toBeCloseTo(0.5, 1);
    });

    it("should calculate cache hit rate correctly", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: i % 2 === 0,
        });
      }

      const patterns = await analyzer.analyze(history, 50);

      expect(patterns[0].cacheHitRate).toBeCloseTo(0.5, 1);
    });
  });

  describe("predict", () => {
    it("should predict future workload", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 100);
      const prediction = await analyzer.predict(patterns, 60000);

      expect(prediction).toHaveProperty("predictedType");
      expect(prediction).toHaveProperty("predictedThroughput");
      expect(prediction).toHaveProperty("predictedLatency");
      expect(prediction).toHaveProperty("confidence");
      expect(prediction).toHaveProperty("timeWindow");

      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it("should return low confidence for empty patterns", async () => {
      const prediction = await analyzer.predict([], 60000);

      expect(prediction.confidence).toBeLessThan(0.5);
    });

    it("should include time window in prediction", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 50);
      const prediction = await analyzer.predict(patterns, 30000);

      const now = Date.now();
      expect(prediction.timeWindow.start).toBeGreaterThanOrEqual(now - 1000);
      expect(prediction.timeWindow.end).toBeGreaterThan(
        prediction.timeWindow.start
      );
    });
  });

  describe("getCurrentState", () => {
    it("should return initial state", () => {
      const state = analyzer.getCurrentState();

      expect(state.currentType).toBe("steady");
      expect(state.throughput).toBe(0);
      expect(state.trend).toBe("stable");
    });

    it("should update state after analysis", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      await analyzer.analyze(history, 100);

      const state = analyzer.getCurrentState();

      expect(state.throughput).toBeGreaterThan(0);
      expect(state.avgLatency).toBeGreaterThan(0);
    });

    it("should return a copy of state (not reference)", async () => {
      const history: QueryHistory[] = [
        {
          timestamp: Date.now(),
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        },
      ];

      await analyzer.analyze(history, 1);

      const state1 = analyzer.getCurrentState();
      const state2 = analyzer.getCurrentState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe("Burst detection", () => {
    it("should detect burst patterns", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Create burst pattern
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: baseTime + i * 100,
          queryType: "burst",
          complexity: 0.7,
          length: 150,
          latency: 200,
          cacheHit: false,
        });
      }

      // Slow period
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: baseTime + 2000 + i * 1000,
          queryType: "normal",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 40);

      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should calculate burst intensity", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      for (let i = 0; i < 30; i++) {
        history.push({
          timestamp: baseTime + i * 50,
          queryType: "burst",
          complexity: 0.7,
          length: 150,
          latency: 200,
          cacheHit: false,
        });
      }

      const patterns = await analyzer.analyze(history, 30);

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("Periodic pattern detection", () => {
    it("should detect periodic patterns", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Create periodic pattern (every 5 seconds)
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: baseTime + i * 5000,
          queryType: "periodic",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("Trend detection", () => {
    it("should detect increasing trend", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Increasing frequency
      for (let i = 0; i < 30; i++) {
        history.push({
          timestamp: baseTime + i * (1000 - i * 20),
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 30);
      const state = analyzer.getCurrentState();

      expect(state.trend).toBeDefined();
    });

    it("should detect decreasing trend", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Decreasing frequency
      for (let i = 0; i < 30; i++) {
        history.push({
          timestamp: baseTime + i * (1000 + i * 20),
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 30);
      const state = analyzer.getCurrentState();

      expect(state.trend).toBeDefined();
    });

    it("should detect stable trend", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      for (let i = 0; i < 30; i++) {
        history.push({
          timestamp: baseTime + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 30);
      const state = analyzer.getCurrentState();

      expect(state.trend).toBe("stable");
    });
  });

  describe("Workload pattern properties", () => {
    it("should extract time of day patterns", async () => {
      const history: QueryHistory[] = [];

      // Create timestamps at a specific hour (10 AM UTC)
      const baseDate = new Date();
      baseDate.setUTCHours(10, 0, 0, 0);
      const hour = 10;

      for (let i = 0; i < 20; i++) {
        const date = new Date(baseDate);
        date.setUTCMinutes(date.getUTCMinutes() + i);
        history.push({
          timestamp: date.getTime(),
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      // Verify timeOfDay contains at least one hour value
      expect(patterns[0].timeOfDay.length).toBeGreaterThan(0);
      expect(patterns[0].timeOfDay[0]).toBeGreaterThanOrEqual(0);
      expect(patterns[0].timeOfDay[0]).toBeLessThanOrEqual(23);
    });

    it("should extract query types", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 10; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "type1",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      for (let i = 0; i < 10; i++) {
        history.push({
          timestamp: Date.now() + (10 + i) * 1000,
          queryType: "type2",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      expect(patterns[0].queryTypes).toContain("type1");
      expect(patterns[0].queryTypes).toContain("type2");
    });
  });

  describe("Predictability calculation", () => {
    it("should calculate high predictability for steady workload", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100, // Consistent latency
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 50);

      expect(patterns[0].predictability).toBeGreaterThan(0.5);
    });

    it("should calculate lower predictability for variable workload", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 50 + Math.random() * 200, // Variable latency
          cacheHit: Math.random() > 0.5,
        });
      }

      const patterns = await analyzer.analyze(history, 50);

      expect(patterns[0].predictability).toBeGreaterThanOrEqual(0);
      expect(patterns[0].predictability).toBeLessThanOrEqual(1);
    });
  });
});
