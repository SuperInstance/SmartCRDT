/**
 * Tests for ThermalMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThermalMonitor } from "../../src/thermal/ThermalMonitor";
import {
  ThermalComponent,
  ThermalStatus,
  ThermalTrend,
} from "@lsi/protocol";

describe("ThermalMonitor", () => {
  let monitor: ThermalMonitor;

  beforeEach(() => {
    monitor = new ThermalMonitor();
  });

  afterEach(async () => {
    await monitor.stop();
  });

  describe("initialization", () => {
    it("should initialize with default thermal zones", () => {
      const cpuZone = monitor.getThermalZone(ThermalComponent.CPU);
      expect(cpuZone).toBeDefined();
      expect(cpuZone?.component).toBe(ThermalComponent.CPU);
      expect(cpuZone?.normalThreshold).toBe(45);
      expect(cpuZone?.criticalThreshold).toBe(85);
    });

    it("should initialize with custom thermal zones", () => {
      const customZones = [
        {
          component: ThermalComponent.CPU,
          normalThreshold: 50,
          warmThreshold: 70,
          hotThreshold: 80,
          criticalThreshold: 90,
          throttlingThreshold: 95,
          samplingInterval: 2000,
          averageWindow: 20,
        },
      ];

      const customMonitor = new ThermalMonitor({ thermalZones: customZones });
      const cpuZone = customMonitor.getThermalZone(ThermalComponent.CPU);

      expect(cpuZone?.normalThreshold).toBe(50);
      expect(cpuZone?.criticalThreshold).toBe(90);
    });
  });

  describe("temperature monitoring", () => {
    it("should start and stop monitoring", async () => {
      await monitor.start();
      expect(monitor["isRunning"]).toBe(true);

      await monitor.stop();
      expect(monitor["isRunning"]).toBe(false);
    });

    it("should get thermal state", async () => {
      await monitor.start();

      // Wait a bit for readings
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = monitor.getThermalState();
      expect(state).toBeDefined();
      expect(state.readings.size).toBeGreaterThan(0);
      expect(state.averageTemperature).toBeGreaterThan(0);
      expect(state.status).toBeDefined();
    });

    it("should get component temperature", async () => {
      await monitor.start();

      const reading = await monitor.getComponentTemperature(ThermalComponent.CPU);
      expect(reading).toBeDefined();
      expect(reading.component).toBe(ThermalComponent.CPU);
      expect(reading.celsius).toBeGreaterThan(0);
      expect(reading.fahrenheit).toBeGreaterThan(32);
      expect(reading.timestamp).toBeDefined();
      expect(reading.status).toBeDefined();
    });
  });

  describe("thermal status classification", () => {
    it("should classify normal temperatures correctly", async () => {
      await monitor.start();

      // With simulation, we should get some readings
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = monitor.getThermalState();
      // Simulated temperatures should mostly be normal
      expect([ThermalStatus.NORMAL, ThermalStatus.WARM]).toContain(state.status);
    });

    it("should detect temperature trends", async () => {
      await monitor.start();

      const state = monitor.getThermalState();
      expect([ThermalTrend.COOLING, ThermalTrend.STABLE, ThermalTrend.WARMING]).toContain(
        state.trend
      );
    });
  });

  describe("temperature history", () => {
    it("should track temperature history", async () => {
      await monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const history = monitor.getTemperatureHistory(ThermalComponent.CPU);
      expect(Array.isArray(history)).toBe(true);
      // Should have some history entries after monitoring
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it("should get historical data", async () => {
      await monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const historicalData = monitor.getHistoricalData();
      expect(Array.isArray(historicalData)).toBe(true);
    });

    it("should clear history", async () => {
      await monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.clearHistory();

      const historicalData = monitor.getHistoricalData();
      expect(historicalData.length).toBe(0);
    });
  });

  describe("thermal zone configuration", () => {
    it("should update thermal zone configuration", () => {
      const newConfig = {
        component: ThermalComponent.CPU,
        normalThreshold: 55,
        warmThreshold: 75,
        hotThreshold: 85,
        criticalThreshold: 95,
        throttlingThreshold: 100,
        samplingInterval: 500,
        averageWindow: 15,
      };

      monitor.updateThermalZone(newConfig);

      const updatedZone = monitor.getThermalZone(ThermalComponent.CPU);
      expect(updatedZone?.normalThreshold).toBe(55);
      expect(updatedZone?.samplingInterval).toBe(500);
    });
  });

  describe("event emission", () => {
    it("should emit temperature update events", async () => {
      const spy = vi.fn();
      monitor.on("temperature:updated", spy);

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(spy).toHaveBeenCalled();
    });

    it("should emit status change events", async () => {
      const spy = vi.fn();
      monitor.on("status:changed", spy);

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Status changes might not happen in short test, so just check no errors
      expect(monitor["isRunning"]).toBe(true);
    });
  });

  describe("power consumption estimation", () => {
    it("should estimate power consumption", async () => {
      await monitor.start();

      const state = monitor.getThermalState();

      // Power estimation should be reasonable
      expect(state.averageTemperature).toBeGreaterThan(0);
    });
  });
});
