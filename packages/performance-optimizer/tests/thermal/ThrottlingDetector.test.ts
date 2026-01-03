/**
 * Tests for ThrottlingDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThrottlingDetector } from "../../src/thermal/ThrottlingDetector";
import {
  ThermalComponent,
  ThrottlingType,
  ThermalStatus,
  PowerState,
} from "@lsi/protocol";

describe("ThrottlingDetector", () => {
  let detector: ThrottlingDetector;

  beforeEach(() => {
    detector = new ThrottlingDetector();
  });

  afterEach(async () => {
    await detector.stop();
  });

  describe("initialization", () => {
    it("should initialize with default config", () => {
      expect(detector["config"].baselineSamples).toBe(100);
      expect(detector["config"].performanceThreshold).toBe(0.15);
    });

    it("should initialize with custom config", () => {
      const customDetector = new ThrottlingDetector({
        baselineSamples: 200,
        performanceThreshold: 0.2,
      });

      expect(customDetector["config"].baselineSamples).toBe(200);
      expect(customDetector["config"].performanceThreshold).toBe(0.2);
    });
  });

  describe("detection lifecycle", () => {
    it("should start and stop detection", async () => {
      await detector.start();
      expect(detector["isRunning"]).toBe(true);

      await detector.stop();
      expect(detector["isRunning"]).toBe(false);
    });
  });

  describe("performance measurement", () => {
    it("should record performance measurements", () => {
      const measurement = {
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        operationsPerSecond: 1000,
        latency: 10,
        temperature: 60,
        frequency: 3000,
      };

      detector.recordPerformance(measurement);

      const measurements = detector["recentMeasurements"].get(ThermalComponent.CPU);
      expect(measurements).toBeDefined();
      expect(measurements?.length).toBe(1);
    });

    it("should maintain baseline performance", () => {
      // Record multiple measurements to establish baseline
      for (let i = 0; i < 10; i++) {
        detector.recordPerformance({
          timestamp: Date.now() + i * 100,
          component: ThermalComponent.CPU,
          operationsPerSecond: 1000,
          latency: 10,
          temperature: 55,
          frequency: 3000,
        });
      }

      const baseline = detector["performanceBaseline"].get(ThermalComponent.CPU);
      expect(baseline).toBeDefined();
      expect(baseline?.avgOpsPerSecond).toBeCloseTo(1000, 0);
    });
  });

  describe("temperature-based throttling detection", () => {
    it("should detect throttling from temperature readings", async () => {
      await detector.start();

      // Simulate critical temperature reading
      const reading = {
        celsius: 95,
        fahrenheit: 203,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.THROTTLING as ThermalStatus,
      };

      detector.recordTemperature(reading);

      const activeEvents = detector.getActiveEvents();
      expect(activeEvents.length).toBeGreaterThan(0);
      expect(activeEvents[0].component).toBe(ThermalComponent.CPU);
      expect(activeEvents[0].type).toBe(ThrottlingType.THERMAL);
    });

    it("should detect critical temperature", async () => {
      await detector.start();

      const reading = {
        celsius: 90,
        fahrenheit: 194,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.CRITICAL as ThermalStatus,
      };

      detector.recordTemperature(reading);

      const activeEvents = detector.getActiveEvents();
      expect(activeEvents.length).toBeGreaterThan(0);
    });
  });

  describe("throttling detection result", () => {
    it("should build detection result", async () => {
      await detector.start();

      // Record some measurements
      for (let i = 0; i < 5; i++) {
        detector.recordPerformance({
          timestamp: Date.now() + i * 100,
          component: ThermalComponent.CPU,
          operationsPerSecond: 1000,
          latency: 10,
          temperature: 55,
          frequency: 3000,
        });
      }

      const result = await detector.detectThrottling();

      expect(result).toBeDefined();
      expect(typeof result.isThrottling).toBe("boolean");
      expect(Array.isArray(result.activeEvents)).toBe(true);
      expect(Array.isArray(result.history)).toBe(true);
      expect(typeof result.totalThrottleTime).toBe("number");
      expect(typeof result.performanceDegradation).toBe("number");
    });
  });

  describe("throttling history", () => {
    it("should maintain throttling history", async () => {
      await detector.start();

      // Simulate throttling
      detector.recordTemperature({
        celsius: 95,
        fahrenheit: 203,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.THROTTLING as ThermalStatus,
      });

      const history = detector.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it("should clear history", async () => {
      await detector.start();

      detector.recordTemperature({
        celsius: 95,
        fahrenheit: 203,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.THROTTLING as ThermalStatus,
      });

      detector.clearHistory();

      const history = detector.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("recommended actions", () => {
    it("should recommend no action when no throttling", () => {
      const action = detector.getRecommendedAction();
      expect(action).toBe("none");
    });

    it("should recommend aggressive action for severe throttling", async () => {
      await detector.start();

      // Simulate severe throttling
      detector.recordTemperature({
        celsius: 100,
        fahrenheit: 212,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.THROTTLING as ThermalStatus,
      });

      const action = detector.getRecommendedAction();
      expect(["pause_compute", "throttle_cpu", "throttle_gpu"]).toContain(action);
    });
  });

  describe("severity calculation", () => {
    it("should calculate severity based on temperature", () => {
      const detector = new ThrottlingDetector();

      // Access private method through type assertion
      const severity95 = detector["calculateSeverity"](95);
      const severity85 = detector["calculateSeverity"](85);
      const severity75 = detector["calculateSeverity"](75);

      expect(severity95).toBeGreaterThan(severity85);
      expect(severity85).toBeGreaterThan(severity75);
    });
  });

  describe("event emission", () => {
    it("should emit throttling detected event", async () => {
      const spy = vi.fn();
      detector.on("throttling:detected", spy);

      await detector.start();

      detector.recordTemperature({
        celsius: 95,
        fahrenheit: 203,
        timestamp: Date.now(),
        component: ThermalComponent.CPU,
        status: ThermalStatus.THROTTLING as ThermalStatus,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(spy).toHaveBeenCalled();
    });

    it("should emit baseline updated event", async () => {
      const spy = vi.fn();
      detector.on("baseline:updated", spy);

      // Record enough measurements to trigger baseline update
      for (let i = 0; i < 150; i++) {
        detector.recordPerformance({
          timestamp: Date.now() + i * 10,
          component: ThermalComponent.CPU,
          operationsPerSecond: 1000,
          latency: 10,
          temperature: 55,
          frequency: 3000,
        });
      }

      // Baseline should be updated
      const baseline = detector["performanceBaseline"].get(ThermalComponent.CPU);
      expect(baseline).toBeDefined();
    });
  });

  describe("performance impact estimation", () => {
    it("should estimate performance impact", () => {
      const detector = new ThrottlingDetector();

      const impact100 = detector["estimateImpact"](100);
      const impact70 = detector["estimateImpact"](70);

      expect(impact100).toBeGreaterThan(impact70);
      expect(impact70).toBe(0); // Below threshold
      expect(impact100).toBeCloseTo(1, 0); // Near maximum
    });
  });
});
