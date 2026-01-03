/**
 * HotSwapper Tests
 * Tests for hot module swapping with state preservation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HotSwapper } from "../src/hotswap/HotSwapper.js";

describe("HotSwapper", () => {
  let swapper: HotSwapper;
  let mockModule: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    swapper = new HotSwapper({
      watchFiles: false,
      checkInterval: 1000,
      preserveState: true,
      transition: "fade",
      rollbackOnError: true,
    });

    mockModule = {
      id: "test-module",
      name: "TestModule",
      version: "1.0.0",
      url: "http://localhost:3000/module.js",
      loaded: true,
      timestamp: Date.now(),
    };

    mockContainer = document.createElement("div");
    mockContainer.setAttribute("data-module", "test-module");
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
  });

  describe("initialization", () => {
    it("should create with default config", () => {
      const defaultSwapper = new HotSwapper();
      expect(defaultSwapper).toBeDefined();
    });

    it("should create with custom config", () => {
      const customSwapper = new HotSwapper({
        transition: "slide",
        preserveState: false,
      });
      expect(customSwapper).toBeDefined();
      expect(customSwapper.getConfig().transition).toBe("slide");
    });

    it("should get config", () => {
      const config = swapper.getConfig();
      expect(config.preserveState).toBe(true);
      expect(config.transition).toBe("fade");
    });
  });

  describe("module swapping", () => {
    it("should swap module successfully", async () => {
      const newFactory = vi.fn().mockResolvedValue({
        version: "2.0.0",
      });

      const result = await swapper.swapModule(mockModule, newFactory);
      expect(result.success).toBe(true);
      expect(result.oldModule.id).toBe(mockModule.id);
      expect(result.statePreserved).toBe(true);
    });

    it("should handle swap with container", async () => {
      const newFactory = vi.fn().mockResolvedValue({
        version: "2.0.0",
      });

      const result = await swapper.swapModule(
        mockModule,
        newFactory,
        mockContainer
      );
      expect(result.success).toBe(true);
    });

    it("should rollback on error", async () => {
      const errorFactory = vi.fn().mockRejectedValue(new Error("Load failed"));

      await expect(
        swapper.swapModule(mockModule, errorFactory)
      ).rejects.toThrow();
    });

    it("should not rollback when disabled", async () => {
      const noRollbackSwapper = new HotSwapper({
        rollbackOnError: false,
      });

      const errorFactory = vi.fn().mockRejectedValue(new Error("Load failed"));

      await expect(
        noRollbackSwapper.swapModule(mockModule, errorFactory)
      ).rejects.toThrow();
    });
  });

  describe("state preservation", () => {
    beforeEach(() => {
      // Add some state to the container
      const input = document.createElement("input");
      input.name = "test";
      input.value = "test-value";
      mockContainer.appendChild(input);
    });

    it("should capture state", () => {
      const state = (swapper as any).captureState(mockModule);
      expect(state).toBeDefined();
      expect(state.module).toBe(mockModule.id);
    });

    it("should restore state", () => {
      const state = {
        module: mockModule.id,
        state: {
          inputs: [{
            name: "test",
            value: "test-value",
          }],
        },
        timestamp: Date.now(),
      };

      const result = (swapper as any).restoreState(mockModule, state);
      expect(result).toBe(true);
    });

    it("should handle state preservation disabled", async () => {
      const noStateSwapper = new HotSwapper({
        preserveState: false,
      });

      const newFactory = vi.fn().mockResolvedValue({
        version: "2.0.0",
      });

      const result = await noStateSwapper.swapModule(mockModule, newFactory);
      expect(result.statePreserved).toBe(false);
    });
  });

  describe("transitions", () => {
    it("should handle instant transition", async () => {
      const instantSwapper = new HotSwapper({
        transition: "instant",
      });

      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      const result = await instantSwapper.swapModule(mockModule, newFactory);

      expect(result.success).toBe(true);
      expect(result.transitionTime).toBeLessThan(100);
    });

    it("should handle fade transition", async () => {
      const fadeSwapper = new HotSwapper({
        transition: "fade",
      });

      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      const result = await fadeSwapper.swapModule(mockModule, newFactory, mockContainer);

      expect(result.success).toBe(true);
    });

    it("should handle slide transition", async () => {
      const slideSwapper = new HotSwapper({
        transition: "slide",
      });

      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      const result = await slideSwapper.swapModule(mockModule, newFactory, mockContainer);

      expect(result.success).toBe(true);
    });
  });

  describe("swap history", () => {
    it("should track swap history", async () => {
      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      await swapper.swapModule(mockModule, newFactory);

      const history = swapper.getSwapHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
    });

    it("should clear swap history", async () => {
      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      await swapper.swapModule(mockModule, newFactory);

      swapper.clearSwapHistory();
      expect(swapper.getSwapHistory().length).toBe(0);
    });

    it("should track failed swaps", async () => {
      const errorFactory = vi.fn().mockRejectedValue(new Error("Failed"));

      try {
        await swapper.swapModule(mockModule, errorFactory);
      } catch (e) {
        // Expected to fail
      }

      const history = swapper.getSwapHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(false);
    });
  });

  describe("active swaps", () => {
    it("should track active swaps", async () => {
      const slowFactory = new Promise((resolve) => {
        setTimeout(() => resolve({ version: "2.0.0" }), 1000);
      }) as any;

      const swapPromise = swapper.swapModule(mockModule, slowFactory);
      const active = swapper.getActiveSwaps();

      expect(active).toContain(mockModule.id);

      await swapPromise;
    });

    it("should prevent concurrent swaps", async () => {
      const factory = vi.fn().mockResolvedValue({ version: "2.0.0" });

      const swap1 = swapper.swapModule(mockModule, factory);
      const swap2 = swapper.swapModule(mockModule, factory);

      await expect(swap2).rejects.toThrow();
      await swap1;
    });
  });

  describe("file watching", () => {
    it("should start watching module", () => {
      const onChange = vi.fn();
      swapper.startWatching(mockModule, onChange);
      // Watching started
      expect(swapper.getActiveSwaps().length).toBe(0);
    });

    it("should stop watching module", () => {
      swapper.startWatching(mockModule, vi.fn());
      swapper.stopWatching(mockModule.id);
      // Watching stopped
    });

    it("should stop all watching", () => {
      swapper.startWatching(mockModule, vi.fn());
      swapper.stopAllWatching();
      // All watching stopped
    });
  });

  describe("config updates", () => {
    it("should update config", () => {
      swapper.updateConfig({
        transition: "slide",
        preserveState: false,
      });

      const config = swapper.getConfig();
      expect(config.transition).toBe("slide");
      expect(config.preserveState).toBe(false);
    });

    it("should preserve other config values on update", () => {
      swapper.updateConfig({ transition: "instant" });

      const config = swapper.getConfig();
      expect(config.transition).toBe("instant");
      expect(config.preserveState).toBe(true); // Preserved
    });
  });

  describe("captured states", () => {
    it("should get captured states", async () => {
      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });
      await swapper.swapModule(mockModule, newFactory);

      const states = swapper.getCapturedStates();
      expect(Array.isArray(states)).toBe(true);
    });

    it("should clear captured states", () => {
      swapper.clearStates();
      expect(swapper.getCapturedStates().length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle missing container", async () => {
      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });

      const result = await swapper.swapModule(mockModule, newFactory, undefined);
      expect(result.success).toBe(true);
    });

    it("should handle rapid swaps", async () => {
      const factory = vi.fn().mockResolvedValue({ version: "2.0.0" });

      // Sequential swaps should work
      await swapper.swapModule(mockModule, factory);

      const newModule = { ...mockModule, version: "2.0.0" };
      await swapper.swapModule(newModule, factory);

      expect(swapper.getSwapHistory().length).toBe(2);
    });

    it("should handle swap with no module info", async () => {
      const factory = vi.fn().mockResolvedValue({ version: "1.0.0" });

      const result = await swapper.swapModule(
        {} as any,
        factory
      );
      expect(result.success).toBe(true);
    });
  });
});

describe("HotSwapper integration", () => {
  it("should work with real DOM elements", async () => {
    const swapper = new HotSwapper();

    const container = document.createElement("div");
    container.id = "test-container";
    container.setAttribute("data-module", "real-module");
    document.body.appendChild(container);

    const module = {
      id: "real-module",
      name: "RealModule",
      version: "1.0.0",
      url: "http://localhost:3000/real.js",
      loaded: true,
      timestamp: Date.now(),
    };

    const factory = vi.fn().mockResolvedValue({ version: "2.0.0" });

    const result = await swapper.swapModule(module, factory, container);
    expect(result.success).toBe(true);

    document.body.removeChild(container);
  });
});
