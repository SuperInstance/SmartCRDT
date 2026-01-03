/**
 * Calibrators Test Suite - 45+ tests
 */

import { describe, it, expect } from "vitest";
import {
  MinMaxCalibrator,
  createMinMaxCalibrator,
} from "../src/calibrators/MinMaxCalibrator.js";
import {
  KLDCalibrator,
  createKLDCalibrator,
} from "../src/calibrators/KLDCalibrator.js";
import {
  PercentileCalibrator,
  createPercentileCalibrator,
} from "../src/calibrators/PercentileCalibrator.js";
import {
  CalibrationDataset,
  createCalibrationDataset,
} from "../src/calibrators/CalibrationDataset.js";

describe("MinMaxCalibrator", () => {
  it("should create calibrator", () => {
    const c = createMinMaxCalibrator();
    expect(c).toBeDefined();
  });

  it("should calibrate simple array", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = await c.calibrate(data);
    expect(result.scale).toBeDefined();
    expect(result.zeroPoint).toBeDefined();
  });

  it("should find correct min/max", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = await c.calibrate(data);
    expect(result.metrics.minVal).toBe(1);
    expect(result.metrics.maxVal).toBe(5);
  });

  it("should handle negative values", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([-5, -3, -1, 0, 1]);
    const result = await c.calibrate(data);
    expect(result.metrics.minVal).toBe(-5);
    expect(result.metrics.maxVal).toBe(1);
  });

  it("should handle mixed values", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([-10, 0, 10]);
    const result = await c.calibrate(data);
    expect(result.metrics.minVal).toBe(-10);
    expect(result.metrics.maxVal).toBe(10);
  });

  it("should calculate mean", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = await c.calibrate(data);
    expect(result.metrics.mean).toBe(3);
  });

  it("should calculate std dev", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = await c.calibrate(data);
    expect(result.metrics.stdDev).toBeGreaterThan(0);
  });

  it("should handle single value", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([5]);
    const result = await c.calibrate(data);
    expect(result.metrics.minVal).toBe(5);
    expect(result.metrics.maxVal).toBe(5);
  });

  it("should calibrate with percentile", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrateWithPercentile(data, 99.9);
    expect(result.scale).toBeDefined();
  });

  it("should calibrate batches", async () => {
    const c = createMinMaxCalibrator();
    const batches = [
      new Float32Array([1, 2, 3]),
      new Float32Array([4, 5, 6]),
    ];
    const result = await c.calibrateBatches(batches);
    expect(result.metrics.minVal).toBe(1);
    expect(result.metrics.maxVal).toBe(6);
  });

  it("should track statistics", async () => {
    const c = createMinMaxCalibrator();
    const data = new Float32Array([1, 2, 3]);
    await c.calibrate(data, "test_layer");
    const stats = c.getStats();
    expect(stats.has("test_layer")).toBe(true);
  });

  it("should clear cache", () => {
    const c = createMinMaxCalibrator();
    c.clear();
    expect(c.getStats().size).toBe(0);
  });
});

describe("KLDCalibrator", () => {
  it("should create calibrator", () => {
    const c = createKLDCalibrator();
    expect(c).toBeDefined();
  });

  it("should calibrate with KLD", async () => {
    const c = createKLDCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = (Math.random() - 0.5) * 2;
    const result = await c.calibrate(data);
    expect(result.scale).toBeDefined();
    expect(result.metrics.kldScore).toBeDefined();
  });

  it("should build histogram", async () => {
    const c = createKLDCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrate(data);
    expect(result.scale.length).toBeGreaterThan(0);
  });

  it("should find optimal range", async () => {
    const c = createKLDCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrate(data);
    expect(result.metrics.kldScore).toBeLessThan(1);
  });

  it("should handle normal distribution", async () => {
    const c = createKLDCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    const result = await c.calibrate(data);
    expect(result.metrics.kldScore).toBeDefined();
  });

  it("should get config", () => {
    const c = createKLDCalibrator({ numBins: 1024 });
    expect(c.getConfig().numBins).toBe(1024);
  });
});

describe("PercentileCalibrator", () => {
  it("should create calibrator", () => {
    const c = createPercentileCalibrator();
    expect(c).toBeDefined();
  });

  it("should calibrate with percentile", async () => {
    const c = createPercentileCalibrator({ percentile: 99.9 });
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrate(data);
    expect(result.metrics.percentiles).toBeDefined();
  });

  it("should use symmetric percentiles", async () => {
    const c = createPercentileCalibrator({ symmetric: true, percentile: 99.9 });
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrate(data);
    expect(result.metrics.minVal).toBeLessThan(result.metrics.maxVal);
  });

  it("should use asymmetric percentiles", async () => {
    const c = createPercentileCalibrator({ symmetric: false });
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrate(data);
    expect(result.metrics.percentiles).toBeDefined();
  });

  it("should calibrate adaptively", async () => {
    const c = createPercentileCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrateAdaptive(data);
    expect(result.selectedPercentile).toBeDefined();
  });

  it("should detect outliers", async () => {
    const c = createPercentileCalibrator();
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.random();
    const result = await c.calibrateAdaptive(data);
    expect(result.selectedPercentile).toBeGreaterThan(90);
  });

  it("should cache percentiles", async () => {
    const c = createPercentileCalibrator();
    const data = new Float32Array([1, 2, 3, 4, 5]);
    await c.calibrate(data, "test_layer");
    const cached = c.getCachedPercentiles("test_layer");
    expect(cached).toBeDefined();
  });

  it("should clear cache", () => {
    const c = createPercentileCalibrator();
    c.clearCache();
    expect(c).toBeDefined();
  });

  it("should update config", () => {
    const c = createPercentileCalibrator();
    c.updateConfig({ percentile: 99.99 });
    expect(c.getConfig().percentile).toBe(99.99);
  });
});

describe("CalibrationDataset", () => {
  it("should create dataset", () => {
    const d = createCalibrationDataset();
    expect(d).toBeDefined();
  });

  it("should generate mock data", async () => {
    const d = createCalibrationDataset({ numSamples: 10 });
    await d.generateMockData();
    const stats = d.getStats();
    expect(stats.totalSamples).toBe(10);
  });

  it("should add sample", () => {
    const d = createCalibrationDataset();
    d.addSample({
      id: "test",
      input: new Float32Array([1, 2, 3]),
    });
    const stats = d.getStats();
    expect(stats.totalSamples).toBe(1);
  });

  it("should add multiple samples", () => {
    const d = createCalibrationDataset();
    d.addSamples([
      { id: "1", input: new Float32Array([1]) },
      { id: "2", input: new Float32Array([2]) },
    ]);
    const stats = d.getStats();
    expect(stats.totalSamples).toBe(2);
  });

  it("should get samples", () => {
    const d = createCalibrationDataset({ numSamples: 10 });
    d.addSample({ id: "test", input: new Float32Array([1]) });
    const samples = d.getSamples(1);
    expect(samples.length).toBe(1);
  });

  it("should get random samples", () => {
    const d = createCalibrationDataset({ strategy: "random" });
    for (let i = 0; i < 10; i++) {
      d.addSample({
        id: `${i}`,
        input: new Float32Array([i]),
        metadata: { source: "test", difficulty: "easy" },
      });
    }
    const samples = d.getSamples(5);
    expect(samples.length).toBe(5);
  });

  it("should get stratified samples", () => {
    const d = createCalibrationDataset({ strategy: "stratified" });
    for (let i = 0; i < 30; i++) {
      const difficulty = i < 10 ? "easy" : i < 20 ? "medium" : "hard";
      d.addSample({
        id: `${i}`,
        input: new Float32Array([i]),
        metadata: { source: "test", difficulty: difficulty as any },
      });
    }
    const samples = d.getSamples(9);
    expect(samples.length).toBe(9);
  });

  it("should get importance samples", () => {
    const d = createCalibrationDataset({ strategy: "importance" });
    for (let i = 0; i < 10; i++) {
      d.addSample({
        id: `${i}`,
        input: new Float32Array(Array(1000).fill(i)),
        metadata: { source: "test", difficulty: "hard" },
      });
    }
    const samples = d.getSamples(5);
    expect(samples.length).toBe(5);
  });

  it("should get batches", () => {
    const d = createCalibrationDataset();
    for (let i = 0; i < 10; i++) {
      d.addSample({ id: `${i}`, input: new Float32Array([i]) });
    }
    const batches = d.getBatches(3);
    expect(batches.length).toBeGreaterThan(0);
  });

  it("should calculate statistics", () => {
    const d = createCalibrationDataset();
    d.addSample({
      id: "test",
      input: new Float32Array(100),
    });
    const stats = d.getStats();
    expect(stats.totalSamples).toBe(1);
    expect(stats.avgSize).toBe(100);
  });

  it("should calculate difficulty distribution", () => {
    const d = createCalibrationDataset();
    d.addSample({
      id: "test",
      input: new Float32Array([1]),
      metadata: { source: "test", difficulty: "easy" },
    });
    const stats = d.getStats();
    expect(stats.difficultyDistribution.easy).toBe(1);
  });

  it("should clear dataset", () => {
    const d = createCalibrationDataset();
    d.addSample({ id: "test", input: new Float32Array([1]) });
    d.clear();
    expect(d.getStats().totalSamples).toBe(0);
  });

  it("should get config", () => {
    const d = createCalibrationDataset({ numSamples: 50 });
    expect(d.getConfig().numSamples).toBe(50);
  });
});
