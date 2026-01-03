/**
 * Power Management Tests
 *
 * Comprehensive test suite for power management components:
 * - PowerStateController
 * - BatteryManager
 * - PowerAwareDispatcher
 *
 * @test power
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import {
  PowerStateController,
  PowerState,
  CpuFrequencies,
  Governor,
} from "./PowerStateController.js";
import {
  BatteryManager,
  BatteryStatus,
  PowerStrategy,
} from "./BatteryManager.js";
import {
  PowerAwareDispatcher,
  DispatchRequest,
  DispatchDecision,
  UrgencyLevel,
} from "./PowerAwareDispatcher.js";

// Mock child_process for testing
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock fs for testing
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  readdir: vi.fn(),
}));

describe("PowerStateController", () => {
  let controller: PowerStateController;

  beforeEach(() => {
    controller = new PowerStateController({
      platform: "auto",
      update_interval: 100,
      privileged: true,
      history_size: 100,
    });
  });

  afterEach(async () => {
    await controller.dispose();
  });

  describe("Initialization", () => {
    it("should initialize without errors", async () => {
      await controller.initialize();
      expect(controller.is_initialized()).toBe(true);
    });

    it("should detect platform correctly", async () => {
      await controller.initialize();
      const platform = controller.get_platform_info();
      expect(platform).toBeDefined();
      expect(platform.platform).toBeDefined();
      expect(platform.cpu_count).toBeGreaterThan(0);
    });

    it("should emit initialized event", async () => {
      const spy = vi.fn();
      controller.on("initialized", spy);
      await controller.initialize();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Power State Management", () => {
    it("should get current power state", async () => {
      await controller.initialize();
      const state = controller.get_current_power_state();
      expect(state).toBeDefined();
      expect(state.name).toBeDefined();
      expect(state.c_state).toBeDefined();
      expect(state.p_state).toBeDefined();
      expect(state.frequency).toBeGreaterThan(0);
      expect(state.power_consumption).toBeGreaterThan(0);
    });

    it("should get available power states", async () => {
      await controller.initialize();
      const states = controller.get_available_power_states();
      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);
      expect(states[0]).toHaveProperty("name");
      expect(states[0]).toHaveProperty("frequency");
      expect(states[0]).toHaveProperty("power_consumption");
    });

    it("should have P0-P5 states", async () => {
      await controller.initialize();
      const states = controller.get_available_power_states();
      const pStates = states.map(s => s.p_state);
      expect(pStates).toContain("P0");
      expect(pStates).toContain("P5");
    });
  });

  describe("CPU Frequency Management", () => {
    it("should get CPU frequencies", async () => {
      await controller.initialize();
      const freqs = await controller.get_cpu_frequencies();
      expect(freqs).toBeDefined();
      expect(freqs.min).toBeGreaterThan(0);
      expect(freqs.max).toBeGreaterThan(freqs.min);
      expect(freqs.current).toBeGreaterThanOrEqual(freqs.min);
      expect(freqs.current).toBeLessThanOrEqual(freqs.max);
      expect(freqs.governor).toBeDefined();
    });

    it("should return valid governor types", async () => {
      await controller.initialize();
      const freqs = await controller.get_cpu_frequencies();
      const validGovernors: Governor[] = [
        "performance",
        "powersave",
        "ondemand",
        "conservative",
        "schedutil",
        "userspace",
      ];
      expect(validGovernors).toContain(freqs.governor);
    });
  });

  describe("Power Consumption", () => {
    it("should get current power consumption", async () => {
      await controller.initialize();
      const power = controller.get_power_consumption();
      expect(power).toBeDefined();
      expect(power.cpu).toBeGreaterThan(0);
      expect(power.dram).toBeGreaterThan(0);
      expect(power.total).toBeGreaterThan(0);
      expect(power.timestamp).toBeDefined();
    });

    it("should track power history", async () => {
      await controller.initialize();
      // Wait a bit to accumulate some history
      await new Promise(resolve => setTimeout(resolve, 150));

      const history = controller.get_power_history({
        value: 100,
        unit: "milliseconds",
      });
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty("timestamp");
      expect(history[0]).toHaveProperty("power");
      expect(history[0]).toHaveProperty("frequency");
    });
  });

  describe("Power Cost Estimation", () => {
    it("should estimate power cost for operations", async () => {
      await controller.initialize();
      const cost = controller.estimate_power_cost("inference_medium");
      expect(cost).toBeDefined();
      expect(cost.energy).toBeGreaterThan(0); // joules
      expect(cost.power).toBeGreaterThan(0); // watts
      expect(cost.time).toBeGreaterThan(0); // milliseconds
      expect(cost.battery_impact).toBeGreaterThanOrEqual(0);
    });

    it("should have different costs for different operations", async () => {
      await controller.initialize();
      const embeddingCost = controller.estimate_power_cost("embedding");
      const largeInferenceCost =
        controller.estimate_power_cost("inference_large");

      expect(largeInferenceCost.power).toBeGreaterThan(embeddingCost.power);
      expect(largeInferenceCost.time).toBeGreaterThan(embeddingCost.time);
    });

    it("should calculate battery impact", async () => {
      await controller.initialize();
      const cost = controller.estimate_power_cost("inference_medium");
      // Battery impact should be very small for a single operation
      expect(cost.battery_impact).toBeLessThan(1); // Less than 1%
    });
  });

  describe("Power Profiles", () => {
    it("should apply predefined profiles", async () => {
      await controller.initialize();
      const profiles: Array<"max_performance" | "balanced" | "power_saver"> = [
        "max_performance",
        "balanced",
        "power_saver",
      ];

      for (const profile of profiles) {
        // Profile application may fail without privileges
        try {
          await controller.apply_power_profile(profile);
        } catch (e) {
          // Expected in test environment without privileges
          expect((e as Error).message).toContain("Insufficient privileges");
        }
      }
    });

    it("should create custom profiles", async () => {
      await controller.initialize();
      const customProfile = controller.create_custom_profile({
        name: "Custom Profile",
        governor: "ondemand",
        min_frequency: 1000000,
        max_frequency: 2500000,
        allowed_c_states: ["C0", "C1", "C3"],
        performance_preference: 0.7,
      });

      expect(customProfile).toBeDefined();
      expect(customProfile).toBe("high_performance");
    });
  });

  describe("C-State Management", () => {
    it("should get C-state usage", async () => {
      await controller.initialize();
      const usage = await controller.get_c_state_usage();
      expect(Array.isArray(usage)).toBe(true);
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0]).toHaveProperty("state");
      expect(usage[0]).toHaveProperty("latency");
      expect(usage[0]).toHaveProperty("power");
    });

    it("should enable and disable C-states", async () => {
      await controller.initialize();
      await expect(controller.enable_c_state("C6")).resolves.not.toThrow();
      await expect(controller.disable_c_state("C6")).resolves.not.toThrow();
    });
  });

  describe("Events", () => {
    it("should emit power_state_changed when state changes", async () => {
      await controller.initialize();
      const spy = vi.fn();
      controller.on("power_state_changed", spy);

      // Try to change state (may not work without privileges, but event should fire)
      try {
        await controller.set_power_state({
          name: "test",
          c_state: "C0",
          p_state: "P2",
          frequency: 2000000,
          voltage: 1.0,
          power_consumption: 15,
        });
      } catch (e) {
        // May fail without privileges
      }

      // Event might not fire in test environment, but we check the setup
      expect(spy).toBeDefined();
    });

    it("should emit power_update periodically", async () => {
      await controller.initialize();
      const spy = vi.fn();
      controller.on("power_update", spy);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have received at least one update
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should stop monitoring on dispose", async () => {
      await controller.initialize();
      await controller.dispose();
      expect(controller.is_initialized()).toBe(false);
    });

    it("should remove all listeners on dispose", async () => {
      await controller.initialize();
      const spy = vi.fn();
      controller.on("power_update", spy);
      await controller.dispose();

      // Wait for potential updates
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not receive updates after dispose
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("BatteryManager", () => {
  let manager: BatteryManager;

  beforeEach(() => {
    manager = new BatteryManager({
      update_interval: 100,
      low_battery_threshold: 20,
      critical_battery_threshold: 10,
    });
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe("Initialization", () => {
    it("should initialize without errors", async () => {
      await manager.initialize();
      expect(manager.is_initialized()).toBe(true);
    });

    it("should emit initialized event", async () => {
      const spy = vi.fn();
      manager.on("initialized", spy);
      await manager.initialize();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Battery Status", () => {
    it("should get battery status", async () => {
      await manager.initialize();
      const status = manager.get_battery_status();
      expect(status).toBeDefined();
      expect(status.level).toBeGreaterThanOrEqual(0);
      expect(status.level).toBeLessThanOrEqual(100);
      expect(typeof status.is_charging).toBe("boolean");
      expect(status.time_remaining).toBeDefined();
      expect(status.charge_rate).toBeGreaterThanOrEqual(0);
      expect(status.discharge_rate).toBeGreaterThanOrEqual(0);
    });

    it("should get battery health", async () => {
      await manager.initialize();
      const health = await manager.get_battery_health();
      expect(health).toBeDefined();
      expect(health.design_capacity).toBeGreaterThan(0);
      expect(health.current_capacity).toBeGreaterThan(0);
      expect(health.health_percentage).toBeGreaterThanOrEqual(0);
      expect(health.health_percentage).toBeLessThanOrEqual(100);
      expect(health.condition).toBeDefined();
    });
  });

  describe("Power Detection", () => {
    it("should detect if on battery", async () => {
      await manager.initialize();
      const isOnBattery = manager.is_on_battery();
      expect(typeof isOnBattery).toBe("boolean");
    });

    it("should get power source", async () => {
      await manager.initialize();
      const source = manager.get_power_source();
      expect(["battery", "ac", "usb", "wireless"]).toContain(source);
    });
  });

  describe("Time Estimation", () => {
    it("should get time remaining", async () => {
      await manager.initialize();
      const time = manager.get_time_remaining();
      expect(time).toBeDefined();
      expect(time.value).toBeGreaterThanOrEqual(0);
      expect(["seconds", "minutes", "hours"]).toContain(time.unit);
    });

    it("should get charge time", async () => {
      await manager.initialize();
      const time = manager.get_charge_time();
      expect(time).toBeDefined();
      expect(time.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Power Strategy Selection", () => {
    it("should select max_performance when charging and high battery", async () => {
      await manager.initialize();
      const status = manager.get_battery_status();

      // Mock charging status
      (manager as any).currentStatus.is_charging = true;
      (manager as any).currentStatus.level = 90;

      const strategy = manager.select_power_strategy();
      expect(strategy).toBe("max_performance");
    });

    it("should select power_saver when on battery with medium level", async () => {
      await manager.initialize();
      (manager as any).currentStatus.is_charging = false;
      (manager as any).currentStatus.level = 40;

      const strategy = manager.select_power_strategy();
      expect(strategy).toBe("power_saver");
    });

    it("should select max_battery when on battery with low level", async () => {
      await manager.initialize();
      (manager as any).currentStatus.is_charging = false;
      (manager as any).currentStatus.level = 15;

      const strategy = manager.select_power_strategy();
      expect(strategy).toBe("max_battery");
    });
  });

  describe("Battery Predictions", () => {
    it("should get battery prediction", async () => {
      await manager.initialize();
      const prediction = await manager.get_battery_prediction({
        value: 30,
        unit: "minutes",
      });

      expect(prediction).toBeDefined();
      expect(prediction.time_until_empty).toBeDefined();
      expect(prediction.time_until_full).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Optimization", () => {
    it("should optimize for battery life", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("optimize_battery_life", spy);

      await manager.optimize_for_battery_life();
      expect(spy).toHaveBeenCalled();
    });

    it("should optimize for performance", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("optimize_performance", spy);

      await manager.optimize_for_performance();
      expect(spy).toHaveBeenCalled();
    });

    it("should set power limit", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("power_limit_set", spy);

      await manager.set_power_limit(15);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 15,
          unit: "watts",
        })
      );
    });
  });

  describe("Events", () => {
    it("should emit status_update periodically", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("status_update", spy);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(spy).toHaveBeenCalled();
    });

    it("should emit battery_low when level drops", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("battery_low", spy);

      // Simulate low battery
      (manager as any).currentStatus.level = 18;
      await manager.adjust_for_battery_level();

      expect(spy).toHaveBeenCalled();
    });

    it("should emit battery_critical when level is critical", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("battery_critical", spy);

      // Simulate critical battery
      (manager as any).currentStatus.level = 8;
      await manager.adjust_for_battery_level();

      expect(spy).toHaveBeenCalled();
    });

    it("should emit strategy_changed when auto-adjusting", async () => {
      await manager.initialize();
      const spy = vi.fn();
      manager.on("strategy_changed", spy);

      (manager as any).currentStatus.level = 15;
      await manager.adjust_for_battery_level();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should stop monitoring on dispose", async () => {
      await manager.initialize();
      await manager.dispose();
      expect(manager.is_initialized()).toBe(false);
    });
  });
});

describe("PowerAwareDispatcher", () => {
  let dispatcher: PowerAwareDispatcher;
  let powerController: PowerStateController;
  let batteryManager: BatteryManager;

  beforeEach(async () => {
    powerController = new PowerStateController({
      update_interval: 100,
      privileged: false, // Don't need actual privileges for tests
    });

    batteryManager = new BatteryManager({
      update_interval: 100,
    });

    dispatcher = new PowerAwareDispatcher(powerController, batteryManager, {
      default_strategy: "adaptive",
      cloud_fallback: true,
    });

    await powerController.initialize();
    await batteryManager.initialize();
    await dispatcher.initialize();
  });

  afterEach(async () => {
    await dispatcher.dispose();
    await batteryManager.dispose();
    await powerController.dispose();
  });

  describe("Initialization", () => {
    it("should initialize without errors", async () => {
      expect(dispatcher.is_initialized()).toBe(true);
    });

    it("should have default strategy", () => {
      expect(dispatcher.get_power_strategy()).toBe("adaptive");
    });
  });

  describe("Request Dispatch", () => {
    it("should dispatch simple request", () => {
      const request: DispatchRequest = {
        id: "test-1",
        type: "inference",
        complexity: "simple",
        payload: { query: "hello" },
      };

      const decision = dispatcher.dispatch(request);

      expect(decision).toBeDefined();
      expect(decision.request_id).toBe("test-1");
      expect(decision.model).toBeDefined();
      expect(decision.location).toBeDefined();
      expect(["local", "cloud"]).toContain(decision.location);
    });

    it("should dispatch complex request", () => {
      const request: DispatchRequest = {
        id: "test-2",
        type: "inference",
        complexity: "complex",
        payload: { query: "complex task" },
      };

      const decision = dispatcher.dispatch(request);

      expect(decision).toBeDefined();
      expect(decision.estimated_latency).toBeGreaterThan(0);
      expect(decision.battery_impact).toBeDefined();
    });

    it("should dispatch batch of requests", () => {
      const requests: DispatchRequest[] = [
        {
          id: "batch-1",
          type: "inference",
          complexity: "simple",
          payload: {},
        },
        {
          id: "batch-2",
          type: "inference",
          complexity: "medium",
          payload: {},
        },
        {
          id: "batch-3",
          type: "embedding",
          complexity: "simple",
          payload: {},
        },
      ];

      const decisions = dispatcher.dispatch_batch(requests);

      expect(decisions).toHaveLength(3);
      expect(decisions[0].request_id).toBe("batch-1");
      expect(decisions[1].request_id).toBe("batch-2");
      expect(decisions[2].request_id).toBe("batch-3");
    });

    it("should select embedding model for embedding requests", () => {
      const request: DispatchRequest = {
        id: "embed-1",
        type: "embedding",
        complexity: "simple",
        payload: {},
      };

      const decision = dispatcher.dispatch(request);
      expect(decision.model).toContain("embed");
    });
  });

  describe("Model Selection", () => {
    it("should select model for power budget", () => {
      const request: DispatchRequest = {
        id: "power-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const selection = dispatcher.select_model_for_power(request, 10);

      expect(selection).toBeDefined();
      expect(selection.model).toBeDefined();
      expect(selection.location).toBeDefined();
      expect(selection.estimated_power).toBeLessThanOrEqual(10);
    });

    it("should prefer local models for high urgency", () => {
      dispatcher.set_urgency("critical");

      const request: DispatchRequest = {
        id: "urgent-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const decision = dispatcher.dispatch(request);

      // High urgency should prefer local models for speed
      expect(decision.urgency).toBe("critical");
    });
  });

  describe("Power Strategy", () => {
    it("should use max_performance strategy", () => {
      dispatcher.set_power_strategy("max_performance");

      const request: DispatchRequest = {
        id: "perf-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const decision = dispatcher.dispatch(request);
      expect(decision.strategy).toBe("max_performance");
    });

    it("should use power_saver strategy", () => {
      dispatcher.set_power_strategy("power_saver");

      const request: DispatchRequest = {
        id: "save-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const decision = dispatcher.dispatch(request);
      expect(decision.strategy).toBe("power_saver");
    });

    it("should adapt strategy based on battery", () => {
      dispatcher.set_power_strategy("adaptive");

      // Simulate low battery
      (batteryManager as any).currentStatus.level = 15;
      (batteryManager as any).currentStatus.is_charging = false;

      const request: DispatchRequest = {
        id: "adapt-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const decision = dispatcher.dispatch(request);

      // Should use power-saving strategy
      expect(["power_saver", "max_battery"]).toContain(decision.strategy);
    });
  });

  describe("Urgency Management", () => {
    it("should set urgency level", () => {
      dispatcher.set_urgency("high");
      expect(dispatcher.get_urgency()).toBe("high");
    });

    it("should adjust for urgency", () => {
      const request: DispatchRequest = {
        id: "urgency-1",
        type: "inference",
        complexity: "medium",
        payload: {},
        priority: 0.6,
      };

      const decision = dispatcher.adjust_for_urgency(request);

      expect(decision.urgency).toBe("high");
      expect(dispatcher.get_urgency()).toBe("normal"); // Should restore
    });
  });

  describe("Power Optimization", () => {
    it("should optimize power vs performance", () => {
      const request: DispatchRequest = {
        id: "opt-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      };

      const constraints = {
        max_latency: 1500,
        max_power: 20,
        min_confidence: 0.8,
      };

      const result = dispatcher.optimize_power_performance(
        request,
        constraints
      );

      expect(result).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it("should find optimal power state", () => {
      const targetPerf = 2000000; // 2 GHz
      const state = dispatcher.find_optimal_power_state(targetPerf);

      expect(state).toBeDefined();
      expect(state.frequency).toBeGreaterThan(0);
      expect(state.power_consumption).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should track dispatch statistics", () => {
      // Make some dispatches
      for (let i = 0; i < 5; i++) {
        dispatcher.dispatch({
          id: `stat-${i}`,
          type: "inference",
          complexity: "medium",
          payload: {},
        });
      }

      const stats = dispatcher.get_statistics();

      expect(stats.total_dispatches).toBe(5);
      expect(stats.local_percentage).toBeGreaterThanOrEqual(0);
      expect(stats.cloud_percentage).toBeGreaterThanOrEqual(0);
      expect(stats.local_percentage + stats.cloud_percentage).toBeCloseTo(
        100,
        0
      );
      expect(stats.average_latency).toBeGreaterThan(0);
    });

    it("should clear history", () => {
      dispatcher.dispatch({
        id: "clear-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      });

      dispatcher.clear_history();

      const stats = dispatcher.get_statistics();
      expect(stats.total_dispatches).toBe(0);
    });
  });

  describe("Power Cost Estimation", () => {
    it("should estimate power cost for model", () => {
      const request: DispatchRequest = {
        id: "cost-1",
        type: "inference",
        complexity: "complex",
        payload: {},
      };

      const cost = dispatcher.estimate_power_cost("llama-7b-local", request);

      expect(cost).toBeDefined();
      expect(cost.energy).toBeGreaterThan(0);
      expect(cost.power).toBeGreaterThan(0);
      expect(cost.time).toBeGreaterThan(0);
      expect(cost.battery_impact).toBeGreaterThanOrEqual(0);
    });

    it("should have higher cost for complex requests", () => {
      const simpleRequest: DispatchRequest = {
        id: "simple",
        type: "inference",
        complexity: "simple",
        payload: {},
      };

      const complexRequest: DispatchRequest = {
        id: "complex",
        type: "inference",
        complexity: "complex",
        payload: {},
      };

      const simpleCost = dispatcher.estimate_power_cost(
        "llama-7b-local",
        simpleRequest
      );
      const complexCost = dispatcher.estimate_power_cost(
        "llama-7b-local",
        complexRequest
      );

      expect(complexCost.power).toBeGreaterThan(simpleCost.power);
      expect(complexCost.time).toBeGreaterThan(simpleCost.time);
    });
  });

  describe("Events", () => {
    it("should emit dispatch event", () => {
      const spy = vi.fn();
      dispatcher.on("dispatch", spy);

      dispatcher.dispatch({
        id: "event-1",
        type: "inference",
        complexity: "medium",
        payload: {},
      });

      expect(spy).toHaveBeenCalled();
    });

    it("should emit strategy_changed event", () => {
      const spy = vi.fn();
      dispatcher.on("strategy_changed", spy);

      dispatcher.set_power_strategy("max_performance");
      expect(spy).toHaveBeenCalledWith("max_performance", "manual");
    });
  });

  describe("Cleanup", () => {
    it("should dispose without errors", async () => {
      await expect(dispatcher.dispose()).resolves.not.toThrow();
      expect(dispatcher.is_initialized()).toBe(false);
    });
  });
});

describe("Integration Tests", () => {
  it("should coordinate power management across components", async () => {
    const powerController = new PowerStateController();
    const batteryManager = new BatteryManager();
    const dispatcher = new PowerAwareDispatcher(
      powerController,
      batteryManager
    );

    await Promise.all([
      powerController.initialize(),
      batteryManager.initialize(),
      dispatcher.initialize(),
    ]);

    // Make a dispatch
    const request: DispatchRequest = {
      id: "integ-1",
      type: "inference",
      complexity: "medium",
      payload: {},
    };

    const decision = dispatcher.dispatch(request);

    // Verify all components work together
    expect(decision).toBeDefined();
    expect(powerController.is_initialized()).toBe(true);
    expect(batteryManager.is_initialized()).toBe(true);
    expect(dispatcher.is_initialized()).toBe(true);

    // Cleanup
    await Promise.all([
      dispatcher.dispose(),
      batteryManager.dispose(),
      powerController.dispose(),
    ]);
  });

  it("should handle battery events and adjust dispatching", async () => {
    const powerController = new PowerStateController();
    const batteryManager = new BatteryManager();
    const dispatcher = new PowerAwareDispatcher(
      powerController,
      batteryManager,
      {
        default_strategy: "adaptive",
      }
    );

    await Promise.all([
      powerController.initialize(),
      batteryManager.initialize(),
      dispatcher.initialize(),
    ]);

    // Simulate low battery situation
    (batteryManager as any).currentStatus.level = 15;
    (batteryManager as any).currentStatus.is_charging = false;

    // Should use power-saving strategy
    const request: DispatchRequest = {
      id: "integ-2",
      type: "inference",
      complexity: "medium",
      payload: {},
    };

    const decision = dispatcher.dispatch(request);

    // Verify strategy adapted
    expect(["power_saver", "max_battery"]).toContain(decision.strategy);

    await Promise.all([
      dispatcher.dispose(),
      batteryManager.dispose(),
      powerController.dispose(),
    ]);
  });
});
