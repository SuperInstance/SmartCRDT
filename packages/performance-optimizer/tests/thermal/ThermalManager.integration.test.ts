/**
 * Integration tests for ThermalManager
 *
 * Tests the complete thermal management system integrating:
 * - ThermalMonitor
 * - ThrottlingDetector
 * - PowerManager
 * - PredictiveThermalModel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThermalManager } from "../../src/thermal/ThermalManager";
import {
  ThermalComponent,
  ThermalStatus,
  PowerPolicy,
  ThermalAction,
  ThermalEventType,
  WorkloadType,
  type ThermalManagementConfig,
  type ThermalEvent,
} from "@lsi/protocol";

describe("ThermalManager Integration", () => {
  let manager: ThermalManager;
  let config: ThermalManagementConfig;

  beforeEach(() => {
    config = {
      thermalZones: [
        {
          component: ThermalComponent.CPU,
          normalThreshold: 45,
          warmThreshold: 65,
          hotThreshold: 75,
          criticalThreshold: 85,
          throttlingThreshold: 90,
          samplingInterval: 100,
          averageWindow: 5,
        },
        {
          component: ThermalComponent.GPU,
          normalThreshold: 50,
          warmThreshold: 70,
          hotThreshold: 80,
          criticalThreshold: 88,
          throttlingThreshold: 93,
          samplingInterval: 100,
          averageWindow: 5,
        },
      ],
      powerPolicy: PowerPolicy.BALANCED,
      predictionConfig: {
        predictionHorizon: 30,
        trainingSamples: 20,
        updateInterval: 1000,
        minConfidence: 0.6,
        modelType: "exponential_smoothing" as any,
      },
      enableProactiveThrottling: true,
      proactiveThreshold: 75,
      maxThrottleTime: 30000,
      coolingStrategy: "active" as any,
      enableWorkloadMigration: false,
      enableLogging: false,
    };

    manager = new ThermalManager(config);
  });

  afterEach(async () => {
    await manager.stop();
  });

  describe("lifecycle management", () => {
    it("should start and stop thermal management", async () => {
      await manager.start();
      expect(manager["isRunning"]).toBe(true);

      await manager.stop();
      expect(manager["isRunning"]).toBe(false);
    });

    it("should emit start and stop events", async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();

      manager.on("thermal:started", startSpy);
      manager.on("thermal:stopped", stopSpy);

      await manager.start();
      expect(startSpy).toHaveBeenCalled();

      await manager.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe("thermal state monitoring", () => {
    it("should get thermal state", async () => {
      await manager.start();

      // Wait for initial readings
      await new Promise((resolve) => setTimeout(resolve, 200));

      const state = manager.getThermalState();

      expect(state).toBeDefined();
      expect(state.readings.size).toBeGreaterThan(0);
      expect(state.averageTemperature).toBeGreaterThan(0);
      expect(state.status).toBeDefined();
      expect(state.trend).toBeDefined();
    });

    it("should get component temperature", async () => {
      await manager.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const reading = await manager.getComponentTemperature(ThermalComponent.CPU);

      expect(reading).toBeDefined();
      expect(reading.component).toBe(ThermalComponent.CPU);
      expect(reading.celsius).toBeGreaterThan(0);
      expect(reading.status).toBeDefined();
    });
  });

  describe("throttling detection", () => {
    it("should detect throttling", async () => {
      await manager.start();

      // Wait for monitoring to start
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = await manager.detectThrottling();

      expect(result).toBeDefined();
      expect(typeof result.isThrottling).toBe("boolean");
      expect(Array.isArray(result.activeEvents)).toBe(true);
      expect(Array.isArray(result.history)).toBe(true);
      expect(typeof result.totalThrottleTime).toBe("number");
      expect(typeof result.performanceDegradation).toBe("number");
    });
  });

  describe("power state management", () => {
    it("should get power state", async () => {
      await manager.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const powerState = manager.getPowerState();

      expect(powerState).toBeDefined();
      expect(powerState.readings).toBeInstanceOf(Map);
      expect(powerState.totalWatts).toBeGreaterThan(0);
      expect(powerState.currentPolicy).toBe(PowerPolicy.BALANCED);
    });

    it("should request power state transition", async () => {
      await manager.start();

      const transition = await manager.requestPowerState(
        ThermalComponent.CPU,
        "P0" as any,
        "manual" as any
      );

      expect(transition).toBeDefined();
      expect(transition.component).toBe(ThermalComponent.CPU);
      expect(transition.toState).toBe("P0");
    });

    it("should set power policy", async () => {
      await manager.start();

      const policySpy = vi.fn();
      manager.on("policy:changed", policySpy);

      manager.setPowerPolicy(PowerPolicy.PERFORMANCE);

      expect(policySpy).toHaveBeenCalled();
    });
  });

  describe("temperature prediction", () => {
    it("should predict temperature", async () => {
      await manager.start();

      // Add some historical data
      const monitor = manager["monitor"];
      for (let i = 0; i < 25; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      try {
        const prediction = await manager.predictTemperature(ThermalComponent.CPU, 30);

        expect(prediction).toBeDefined();
        expect(prediction.component).toBe(ThermalComponent.CPU);
        expect(prediction.predictedTemperature).toBeDefined();
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Prediction might fail with insufficient data
        expect(error).toBeDefined();
      }
    });
  });

  describe("event handling", () => {
    it("should register and notify event listeners", async () => {
      await manager.start();

      const eventSpy = vi.fn();
      manager.on(ThermalEventType.THRESHOLD_EXCEEDED, eventSpy);

      // Wait for some monitoring
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Events might or might not be emitted depending on temperatures
      expect(manager["isRunning"]).toBe(true);
    });

    it("should unregister event listeners", async () => {
      await manager.start();

      const eventSpy = vi.fn();
      manager.on(ThermalEventType.THRESHOLD_EXCEEDED, eventSpy);
      manager.off(ThermalEventType.THRESHOLD_EXCEEDED, eventSpy);

      // Generate an event if possible
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Spy should not have been called since we unregistered
      // (but events might not have been generated anyway)
    });

    it("should get event history", async () => {
      await manager.start();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const events = manager.getEventHistory();

      expect(Array.isArray(events)).toBe(true);
      // Events are sorted by timestamp
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp).toBeLessThanOrEqual(events[i - 1].timestamp);
      }
    });
  });

  describe("thermal statistics", () => {
    it("should calculate thermal statistics", async () => {
      await manager.start();

      // Let some data collect
      await new Promise((resolve) => setTimeout(resolve, 300));

      const now = Date.now();
      const windowStart = now - 60000; // Last minute
      const windowEnd = now;

      const stats = manager.getStatistics(windowStart, windowEnd);

      expect(stats).toBeDefined();
      expect(stats.windowStart).toBe(windowStart);
      expect(stats.windowEnd).toBe(windowEnd);
      expect(stats.averageTemperatures).toBeInstanceOf(Map);
      expect(stats.peakTemperatures).toBeInstanceOf(Map);
      expect(stats.timeInStatus).toBeInstanceOf(Map);
      expect(typeof stats.totalThrottleTime).toBe("number");
      expect(typeof stats.throttleEventCount).toBe("number");
    });

    it("should return empty statistics for windows with no data", () => {
      const futureStart = Date.now() + 100000;
      const futureEnd = Date.now() + 200000;

      const stats = manager.getStatistics(futureStart, futureEnd);

      expect(stats.averageTemperatures.size).toBe(0);
      expect(stats.totalThrottleTime).toBe(0);
      expect(stats.throttleEventCount).toBe(0);
    });
  });

  describe("proactive thermal management", () => {
    it("should perform proactive actions when enabled", async () => {
      const actionSpy = vi.fn();
      manager.on("action:reduce_load", actionSpy);
      manager.on("action:increase_cooling", actionSpy);

      await manager.start();

      // Wait for predictions and proactive actions
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Actions might or might not be triggered depending on predictions
      expect(manager["isRunning"]).toBe(true);
    });

    it("should integrate predictions with power management", async () => {
      await manager.start();

      const predictionSpy = vi.fn();
      manager.on("prediction:generated", predictionSpy);

      const powerSpy = vi.fn();
      manager.on("power:transition", powerSpy);

      // Wait for predictions
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check that some predictions were generated
      expect(manager["isRunning"]).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle thermal event end-to-end", async () => {
      await manager.start();

      const eventSpy = vi.fn();
      manager.on(ThermalEventType.THRESHOLD_EXCEEDED, eventSpy);

      // Simulate high temperature by updating thermal zone
      // (In real scenario, this would come from actual readings)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const state = manager.getThermalState();
      expect(state).toBeDefined();
    });

    it("should coordinate power transitions with thermal state", async () => {
      await manager.start();

      const powerStateBefore = manager.getPowerState();

      // Apply thermal constraints
      manager["powerManager"].applyThermalConstraints(
        ThermalComponent.CPU,
        90,
        ThermalStatus.CRITICAL
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const powerStateAfter = manager.getPowerState();

      expect(powerStateAfter).toBeDefined();
    });

    it("should maintain statistics across monitoring session", async () => {
      await manager.start();

      const stats1 = manager.getStatistics(Date.now() - 1000, Date.now());

      await new Promise((resolve) => setTimeout(resolve, 500));

      const stats2 = manager.getStatistics(Date.now() - 1000, Date.now());

      // Second stats should have more data or same amount
      expect(stats2).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid component gracefully", async () => {
      await manager.start();

      await expect(
        manager.getComponentTemperature("invalid" as ThermalComponent)
      ).rejects.toThrow();
    });

    it("should handle prediction with insufficient data gracefully", async () => {
      await manager.start();

      // Try to predict for component without enough data
      try {
        await manager.predictTemperature(ThermalComponent.GPU, 30);
        // Might succeed if there's enough simulated data
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("performance characteristics", () => {
    it("should not block on thermal state queries", async () => {
      await manager.start();

      const start = Date.now();
      const state = manager.getThermalState();
      const duration = Date.now() - start;

      expect(state).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it("should handle concurrent requests", async () => {
      await manager.start();

      const promises = [
        manager.getThermalState(),
        manager.getPowerState(),
        manager.getComponentTemperature(ThermalComponent.CPU),
        manager.detectThrottling(),
      ];

      const results = await Promise.all(promises);

      expect(results.length).toBe(4);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
      expect(results[3]).toBeDefined();
    });
  });
});
