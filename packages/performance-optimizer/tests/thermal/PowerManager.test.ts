/**
 * Tests for PowerManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PowerManager } from "../../src/thermal/PowerManager";
import {
  ThermalComponent,
  PowerState,
  PowerPolicy,
  PowerTransitionReason,
} from "@lsi/protocol";

describe("PowerManager", () => {
  let powerManager: PowerManager;

  beforeEach(() => {
    powerManager = new PowerManager();
  });

  afterEach(async () => {
    await powerManager.stop();
  });

  describe("initialization", () => {
    it("should initialize with default config", () => {
      const state = powerManager["state"];

      expect(state.currentPolicy).toBe(PowerPolicy.BALANCED);
      expect(state.isRunning).toBe(false);
      expect(state.componentStates.size).toBeGreaterThan(0);
    });

    it("should initialize with custom config", () => {
      const customManager = new PowerManager({
        defaultPolicy: PowerPolicy.PERFORMANCE,
        enableAutoTransition: false,
        thermalThreshold: 80,
      });

      expect(customManager["state"].currentPolicy).toBe(PowerPolicy.PERFORMANCE);
      expect(customManager["config"].enableAutoTransition).toBe(false);
      expect(customManager["config"].thermalThreshold).toBe(80);
    });

    it("should have default power states for CPU and GPU", () => {
      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      const gpuState = powerManager.getComponentState(ThermalComponent.GPU);

      expect(cpuState).toBeDefined();
      expect(gpuState).toBeDefined();

      expect(cpuState?.currentState).toBe(PowerState.P2);
      expect(gpuState?.currentState).toBe(PowerState.P2);
    });
  });

  describe("lifecycle", () => {
    it("should start and stop power management", async () => {
      await powerManager.start();
      expect(powerManager["state"].isRunning).toBe(true);

      await powerManager.stop();
      expect(powerManager["state"].isRunning).toBe(false);
    });

    it("should emit events on start and stop", async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();

      powerManager.on("power:started", startSpy);
      powerManager.on("power:stopped", stopSpy);

      await powerManager.start();
      expect(startSpy).toHaveBeenCalled();

      await powerManager.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe("power state queries", () => {
    it("should get current power state", () => {
      const powerState = powerManager.getPowerState();

      expect(powerState).toBeDefined();
      expect(powerState.readings).toBeInstanceOf(Map);
      expect(powerState.totalWatts).toBeGreaterThan(0);
      expect(powerState.cpuPowerPercentage).toBeGreaterThanOrEqual(0);
      expect(powerState.gpuPowerPercentage).toBeGreaterThanOrEqual(0);
      expect(powerState.currentPolicy).toBe(PowerPolicy.BALANCED);
    });
  });

  describe("power state transitions", () => {
    it("should request power state transition", async () => {
      const transition = await powerManager.requestPowerState(
        ThermalComponent.CPU,
        PowerState.P0,
        PowerTransitionReason.MANUAL
      );

      expect(transition).toBeDefined();
      expect(transition.component).toBe(ThermalComponent.CPU);
      expect(transition.fromState).toBe(PowerState.P2);
      expect(transition.toState).toBe(PowerState.P0);
      expect(transition.reason).toBe(PowerTransitionReason.MANUAL);
    });

    it("should validate power state bounds", async () => {
      await expect(
        powerManager.requestPowerState(
          ThermalComponent.CPU,
          "INVALID" as PowerState,
          PowerTransitionReason.MANUAL
        )
      ).rejects.toThrow();
    });

    it("should not transition if already in target state", async () => {
      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      const currentState = cpuState!.currentState;

      const transition = await powerManager.requestPowerState(
        ThermalComponent.CPU,
        currentState,
        PowerTransitionReason.MANUAL
      );

      expect(transition.fromState).toBe(transition.toState);
      expect(transition.performanceImpact).toBe(0);
      expect(transition.powerSavings).toBe(0);
    });

    it("should emit transition event", async () => {
      const spy = vi.fn();
      powerManager.on("power:transition", spy);

      await powerManager.requestPowerState(
        ThermalComponent.CPU,
        PowerState.P0,
        PowerTransitionReason.MANUAL
      );

      expect(spy).toHaveBeenCalled();
      const transition = spy.mock.calls[0][0];
      expect(transition.component).toBe(ThermalComponent.CPU);
    });
  });

  describe("power policy management", () => {
    it("should set power policy", () => {
      const oldPolicy = powerManager["state"].currentPolicy;

      powerManager.setPowerPolicy(PowerPolicy.PERFORMANCE);

      expect(powerManager["state"].currentPolicy).toBe(PowerPolicy.PERFORMANCE);
    });

    it("should emit policy changed event", () => {
      const spy = vi.fn();
      powerManager.on("policy:changed", spy);

      powerManager.setPowerPolicy(PowerPolicy.POWER_SAVING);

      expect(spy).toHaveBeenCalled();
      const event = spy.mock.calls[0][0];
      expect(event.oldPolicy).toBe(PowerPolicy.BALANCED);
      expect(event.newPolicy).toBe(PowerPolicy.POWER_SAVING);
    });

    it("should apply performance policy", async () => {
      await powerManager.start();

      powerManager.setPowerPolicy(PowerPolicy.PERFORMANCE);

      // Wait for policy to be applied
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      expect(cpuState?.currentState).toBe(PowerState.P0);
    });

    it("should apply power saving policy", async () => {
      await powerManager.start();

      powerManager.setPowerPolicy(PowerPolicy.POWER_SAVING);

      // Wait for policy to be applied
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      expect(cpuState?.currentState).toBe(PowerState.P4);
    });
  });

  describe("thermal constraints", () => {
    it("should apply thermal constraints to power states", async () => {
      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      cpuState!.currentState = PowerState.P0; // Start at max

      powerManager.applyThermalConstraints(ThermalComponent.CPU, 90, "critical" as any);

      // Should reduce power state
      const newCpuState = powerManager.getComponentState(ThermalComponent.CPU);
      expect(newCpuState?.currentState).not.toBe(PowerState.P0);
    });

    it("should not change power state for normal temperatures", async () => {
      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      const originalState = cpuState!.currentState;

      powerManager.applyThermalConstraints(ThermalComponent.CPU, 50, "normal" as any);

      const newCpuState = powerManager.getComponentState(ThermalComponent.CPU);
      expect(newCpuState?.currentState).toBe(originalState);
    });
  });

  describe("workload optimization", () => {
    it("should optimize for high CPU workload", async () => {
      await powerManager.start();

      powerManager.optimizeForWorkload({
        cpuUtilization: 0.9,
        gpuUtilization: 0.2,
        memoryUtilization: 0.5,
        powerConsumption: 100,
        workloadType: "heavy_compute" as any,
        heatGeneration: 20,
      });

      // Wait for optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      // Should be high performance for high CPU workload
      expect([PowerState.P0, PowerState.P1]).toContain(cpuState?.currentState);
    });

    it("should optimize for idle workload", async () => {
      await powerManager.start();

      powerManager.optimizeForWorkload({
        cpuUtilization: 0.05,
        gpuUtilization: 0.02,
        memoryUtilization: 0.3,
        powerConsumption: 20,
        workloadType: "idle" as any,
        heatGeneration: 5,
      });

      // Wait for optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cpuState = powerManager.getComponentState(ThermalComponent.CPU);
      // Should be power saving for idle workload
      expect([PowerState.P3, PowerState.P4]).toContain(cpuState?.currentState);
    });
  });

  describe("power readings", () => {
    it("should record power readings", () => {
      const reading = {
        component: ThermalComponent.CPU,
        watts: 45,
        powerState: PowerState.P1,
        timestamp: Date.now(),
      };

      powerManager.recordPowerReading(reading);

      const readings = powerManager["state"].currentReadings;
      expect(readings.get(ThermalComponent.CPU)).toBeDefined();
    });

    it("should emit power reading events", () => {
      const spy = vi.fn();
      powerManager.on("power:reading", spy);

      const reading = {
        component: ThermalComponent.CPU,
        watts: 45,
        powerState: PowerState.P1,
        timestamp: Date.now(),
      };

      powerManager.recordPowerReading(reading);

      expect(spy).toHaveBeenCalledWith(reading);
    });

    it("should update total power consumption", () => {
      const initialTotal = powerManager["state"].totalPowerConsumption;

      powerManager.recordPowerReading({
        component: ThermalComponent.CPU,
        watts: 50,
        powerState: PowerState.P1,
        timestamp: Date.now(),
      });

      expect(powerManager["state"].totalPowerConsumption).not.toBe(initialTotal);
    });
  });

  describe("power calculations", () => {
    it("should calculate power percentage correctly", () => {
      const cpuPercentage = powerManager["calculatePowerPercentage"](ThermalComponent.CPU);
      const gpuPercentage = powerManager["calculatePowerPercentage"](ThermalComponent.GPU);

      expect(cpuPercentage).toBeGreaterThanOrEqual(0);
      expect(cpuPercentage).toBeLessThanOrEqual(1);
      expect(gpuPercentage).toBeGreaterThanOrEqual(0);
      expect(gpuPercentage).toBeLessThanOrEqual(1);
    });

    it("should estimate power savings for transitions", async () => {
      const transition = await powerManager.requestPowerState(
        ThermalComponent.CPU,
        PowerState.P4,
        PowerTransitionReason.MANUAL
      );

      // Transitioning from P2 to P4 should save power
      expect(transition.powerSavings).toBeGreaterThan(0);
    });
  });

  describe("component state management", () => {
    it("should update component state configuration", () => {
      const newConfig = {
        component: ThermalComponent.CPU,
        currentState: PowerState.P2,
        minState: PowerState.P3,
        maxState: PowerState.P0,
        transitionLatency: 20,
        powerByState: new Map([
          [PowerState.P0, 70],
          [PowerState.P1, 50],
          [PowerState.P2, 30],
          [PowerState.P3, 20],
          [PowerState.P4, 10],
        ]),
        performanceByState: new Map([
          [PowerState.P0, 1.0],
          [PowerState.P1, 0.9],
          [PowerState.P2, 0.7],
          [PowerState.P3, 0.5],
          [PowerState.P4, 0.3],
        ]),
      };

      powerManager.updateComponentState(newConfig);

      const updated = powerManager.getComponentState(ThermalComponent.CPU);
      expect(updated?.minState).toBe(PowerState.P3);
      expect(updated?.maxState).toBe(PowerState.P0);
    });
  });
});
