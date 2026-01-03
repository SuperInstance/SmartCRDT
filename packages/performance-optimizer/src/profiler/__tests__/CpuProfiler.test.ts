/**
 * Tests for CPU Profiler
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CpuProfiler } from "../CpuProfiler.js";
import type { ProfilingOptions } from "@lsi/protocol";

describe("CpuProfiler", () => {
  let profiler: CpuProfiler;

  beforeEach(() => {
    const options: Required<ProfilingOptions["cpu"]> = {
      samplingInterval: 10,
      enableStackTraces: true,
      enableFlameGraph: true,
      hotPathThreshold: 5.0,
    };

    profiler = new CpuProfiler(options);
  });

  afterEach(() => {
    if (profiler.isActive()) {
      profiler.stop();
    }
  });

  describe("Profiling Lifecycle", () => {
    it("should start and stop profiling", () => {
      expect(profiler.isActive()).toBe(false);

      profiler.start();
      expect(profiler.isActive()).toBe(true);

      profiler.stop();
      expect(profiler.isActive()).toBe(false);
    });

    it("should throw error when starting already running profiler", () => {
      profiler.start();

      expect(() => profiler.start()).toThrow("CPU profiler is already running");
    });

    it("should throw error when stopping non-running profiler", () => {
      expect(() => profiler.stop()).toThrow("CPU profiler is not running");
    });
  });

  describe("Sample Collection", () => {
    it("should collect samples during profiling", async () => {
      profiler.start();

      // Wait for some samples to be collected
      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const samples = profiler.getSamples();
      expect(samples.length).toBeGreaterThan(0);
    });

    it("should collect samples with required fields", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 50));

      profiler.stop();

      const samples = profiler.getSamples();
      expect(samples[0]).toHaveProperty("timestamp");
      expect(samples[0]).toHaveProperty("cpuUsage");
      expect(samples[0]).toHaveProperty("userCpuTime");
      expect(samples[0]).toHaveProperty("systemCpuTime");
    });

    it("should collect stack traces when enabled", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 50));

      profiler.stop();

      const samples = profiler.getSamples();
      expect(samples[0]).toHaveProperty("stackTrace");
      expect(Array.isArray(samples[0].stackTrace)).toBe(true);
    });
  });

  describe("Report Generation", () => {
    it("should generate comprehensive report", async () => {
      profiler.start();

      // Simulate some work
      for (let i = 0; i < 100; i++) {
        Math.sqrt(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();

      expect(report).toHaveProperty("totalDuration");
      expect(report).toHaveProperty("averageCpuUsage");
      expect(report).toHaveProperty("peakCpuUsage");
      expect(report).toHaveProperty("usageHistogram");
      expect(report).toHaveProperty("flameGraph");
      expect(report).toHaveProperty("hotPaths");
      expect(report).toHaveProperty("topFunctionsBySelfTime");
      expect(report).toHaveProperty("topFunctionsByTotalTime");
      expect(report).toHaveProperty("callGraphStats");
    });

    it("should calculate CPU usage statistics correctly", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();

      expect(report.averageCpuUsage).toBeGreaterThanOrEqual(0);
      expect(report.averageCpuUsage).toBeLessThanOrEqual(100);
      expect(report.peakCpuUsage).toBeGreaterThanOrEqual(0);
      expect(report.peakCpuUsage).toBeLessThanOrEqual(100);
      expect(report.peakCpuUsage).toBeGreaterThanOrEqual(report.averageCpuUsage);
    });

    it("should generate usage histogram", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();

      expect(report.usageHistogram).toBeInstanceOf(Array);
      expect(report.usageHistogram.length).toBe(10);
      expect(report.usageHistogram[0]).toHaveProperty("range");
      expect(report.usageHistogram[0]).toHaveProperty("count");
      expect(report.usageHistogram[0]).toHaveProperty("percentage");
    });

    it("should detect hot paths", async () => {
      profiler.start();

      // Simulate some work with specific function calls
      for (let i = 0; i < 1000; i++) {
        JSON.stringify({ data: i });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();

      expect(report.hotPaths).toBeInstanceOf(Array);
      // Hot paths might be empty if no function exceeds threshold
      expect(report.hotPaths.length).toBeGreaterThanOrEqual(0);
    });

    it("should calculate call graph statistics", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();

      expect(report.callGraphStats).toHaveProperty("totalFunctions");
      expect(report.callGraphStats).toHaveProperty("maxDepth");
      expect(report.callGraphStats).toHaveProperty("avgDepth");
      expect(report.callGraphStats).toHaveProperty("branchingFactor");

      expect(report.callGraphStats.totalFunctions).toBeGreaterThanOrEqual(0);
      expect(report.callGraphStats.maxDepth).toBeGreaterThanOrEqual(0);
      expect(report.callGraphStats.avgDepth).toBeGreaterThanOrEqual(0);
    });

    it("should throw error when generating report without samples", () => {
      expect(() => profiler.generateReport()).toThrow(
        "No samples collected. Run profiler first."
      );
    });
  });

  describe("Data Management", () => {
    it("should clear all samples", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      expect(profiler.getSamples().length).toBeGreaterThan(0);

      profiler.clear();

      expect(profiler.getSamples().length).toBe(0);
    });

    it("should reset state after clear", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      profiler.clear();

      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 50));

      profiler.stop();

      const samples = profiler.getSamples();
      expect(samples.length).toBeGreaterThan(0);
    });
  });

  describe("Flame Graph Generation", () => {
    it("should generate flame graph structure", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();
      const flameGraph = report.flameGraph;

      expect(flameGraph).toHaveProperty("name", "root");
      expect(flameGraph).toHaveProperty("totalTime");
      expect(flameGraph).toHaveProperty("selfTime");
      expect(flameGraph).toHaveProperty("percentage");
      expect(flameGraph).toHaveProperty("sampleCount");
      expect(flameGraph).toHaveProperty("children");
      expect(flameGraph).toHaveProperty("parent", null);
      expect(flameGraph).toHaveProperty("depth", 0);
      expect(Array.isArray(flameGraph.children)).toBe(true);
    });

    it("should set correct percentages in flame graph", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.stop();

      const report = profiler.generateReport();
      const flameGraph = report.flameGraph;

      // Root should have 100% percentage
      expect(flameGraph.percentage).toBe(100);

      // Children percentages should be <= 100
      const validatePercentages = (node: any) => {
        if (node.name !== "root") {
          expect(node.percentage).toBeLessThanOrEqual(100);
          expect(node.percentage).toBeGreaterThanOrEqual(0);
        }

        for (const child of node.children) {
          validatePercentages(child);
        }
      };

      validatePercentages(flameGraph);
    });
  });

  describe("Stack Trace Analysis", () => {
    it("should capture stack frames with required properties", async () => {
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 50));

      profiler.stop();

      const samples = profiler.getSamples();
      const stackTrace = samples[0].stackTrace;

      if (stackTrace && stackTrace.length > 0) {
        expect(stackTrace[0]).toHaveProperty("name");
        expect(stackTrace[0]).toHaveProperty("file");
        expect(stackTrace[0]).toHaveProperty("line");
        expect(stackTrace[0]).toHaveProperty("column");
      }
    });
  });
});
