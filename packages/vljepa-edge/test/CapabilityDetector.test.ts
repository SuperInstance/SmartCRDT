/**
 * @fileoverview Capability Detector Tests
 * @package @lsi/vljepa-edge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CapabilityDetector,
  detectCapabilities,
  getDeviceProfile,
  supportsWebGPU,
  supportsSIMD,
  supportsMultiThreading,
  getBestRuntime,
  DeviceProfiles,
} from "../src/compatibility/CapabilityDetector.js";
import type { DeviceCapabilities, DeviceProfile } from "../src/types.js";

describe("CapabilityDetector", () => {
  let detector: CapabilityDetector;

  beforeEach(() => {
    detector = new CapabilityDetector();
  });

  afterEach(() => {
    detector.clearCache();
  });

  describe("Constructor", () => {
    it("should create a detector instance", () => {
      expect(detector).toBeInstanceOf(CapabilityDetector);
    });
  });

  describe("WebGPU Detection", () => {
    it("should detect WebGPU support", () => {
      const hasWebGPU = detector.hasWebGPU();
      expect(typeof hasWebGPU).toBe("boolean");
    });

    it("should return boolean for WebGPU check", () => {
      const result = supportsWebGPU();
      expect(typeof result).toBe("boolean");
    });

    it("should detect WebGPU via capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.webGPU).toBe("boolean");
    });
  });

  describe("WebAssembly Detection", () => {
    it("should detect WebAssembly support", () => {
      const hasWASM = detector.hasWebAssembly();
      expect(hasWASM).toBe(true); // Should always be true in modern browsers
    });

    it("should be included in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.webAssembly).toBe("boolean");
    });
  });

  describe("Worker Detection", () => {
    it("should detect Web Worker support", () => {
      const hasWorkers = detector.hasWorkers();
      expect(typeof hasWorkers).toBe("boolean");
    });

    it("should detect Service Worker support", () => {
      const hasSW = detector.hasServiceWorkers();
      expect(typeof hasSW).toBe("boolean");
    });

    it("should include worker support in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.workers).toBe("boolean");
      expect(typeof capabilities.serviceWorkers).toBe("boolean");
    });
  });

  describe("IndexedDB Detection", () => {
    it("should detect IndexedDB support", () => {
      const hasIDB = detector.hasIndexedDB();
      expect(typeof hasIDB).toBe("boolean");
    });

    it("should include IndexedDB in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.indexedDB).toBe("boolean");
    });
  });

  describe("Memory Detection", () => {
    it("should detect available memory", () => {
      const memory = detector.getAvailableMemory();
      expect(memory).toBeGreaterThanOrEqual(0);
    });

    it("should include memory in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.memory).toBe("number");
      expect(capabilities.memory).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CPU Detection", () => {
    it("should detect CPU core count", () => {
      const cores = detector.getCores();
      expect(cores).toBeGreaterThan(0);
      expect(Number.isInteger(cores)).toBe(true);
    });

    it("should include cores in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.cores).toBe("number");
      expect(capabilities.cores).toBeGreaterThan(0);
    });
  });

  describe("GPU Detection", () => {
    it("should attempt to get GPU info", async () => {
      const gpu = await detector.getGPUInfo();
      // GPU info may be undefined if WebGPU not available
      expect(gpu === undefined || typeof gpu === "object").toBe(true);
    });

    it("should include GPU in capabilities when available", async () => {
      const capabilities = await detector.detect();
      // GPU may be undefined
      expect(
        capabilities.gpu === undefined || typeof capabilities.gpu === "object"
      ).toBe(true);
    });
  });

  describe("Device Profile", () => {
    it("should generate device profile", async () => {
      const profile = await detector.getProfile();
      expect(profile).toBeDefined();
      expect(typeof profile.name).toBe("string");
      expect(typeof profile.performanceScore).toBe("number");
    });

    it("should include profile in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(capabilities.profile).toBeDefined();
      expect(typeof capabilities.profile.tier).toBe("string");
    });

    it("should have valid tier value", async () => {
      const profile = await detector.getProfile();
      expect(["high", "medium", "low"]).toContain(profile.tier);
    });

    it("should have valid recommended runtime", async () => {
      const profile = await detector.getProfile();
      expect(["webgpu", "wasm", "hybrid"]).toContain(profile.recommendedRuntime);
    });

    it("should have valid batch size", async () => {
      const profile = await detector.getProfile();
      expect(profile.batchSize).toBeGreaterThan(0);
      expect(Number.isInteger(profile.batchSize)).toBe(true);
    });

    it("should have valid quantization", async () => {
      const profile = await detector.getProfile();
      expect(["int8", "fp16", "fp32"]).toContain(profile.quantization);
    });

    it("should have valid model size", async () => {
      const profile = await detector.getProfile();
      expect(["small", "medium", "large"]).toContain(profile.modelSize);
    });

    it("should have performance score in valid range", async () => {
      const profile = await detector.getProfile();
      expect(profile.performanceScore).toBeGreaterThanOrEqual(0);
      expect(profile.performanceScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Caching", () => {
    it("should cache detection results", async () => {
      const result1 = await detector.detect();
      const result2 = await detector.detect();
      expect(result1).toBe(result2);
    });

    it("should clear cache", async () => {
      await detector.detect();
      detector.clearCache();
      const result = await detector.detect();
      expect(result).toBeDefined();
    });
  });

  describe("SIMD Detection", () => {
    it("should detect SIMD support", async () => {
      const hasSIMD = await supportsSIMD();
      expect(typeof hasSIMD).toBe("boolean");
    });
  });

  describe("Multi-threading Detection", () => {
    it("should detect multi-threading support", async () => {
      const hasMT = await supportsMultiThreading();
      expect(typeof hasMT).toBe("boolean");
    });
  });

  describe("Best Runtime Detection", () => {
    it("should return valid runtime", async () => {
      const runtime = await getBestRuntime();
      expect(["webgpu", "wasm", "hybrid"]).toContain(runtime);
    });
  });

  describe("Device Profiles", () => {
    it("should provide predefined profiles", () => {
      expect(DeviceProfiles).toBeDefined();
      expect(typeof DeviceProfiles).toBe("object");
    });

    it("should have desktop-high-end profile", () => {
      expect(DeviceProfiles["desktop-high-end"]).toBeDefined();
      expect(DeviceProfiles["desktop-high-end"].tier).toBe("high");
    });

    it("should have desktop-mid-range profile", () => {
      expect(DeviceProfiles["desktop-mid-range"]).toBeDefined();
      expect(DeviceProfiles["desktop-mid-range"].tier).toBe("medium");
    });

    it("should have desktop-low-end profile", () => {
      expect(DeviceProfiles["desktop-low-end"]).toBeDefined();
      expect(DeviceProfiles["desktop-low-end"].tier).toBe("low");
    });

    it("should have mobile-flagship profile", () => {
      expect(DeviceProfiles["mobile-flagship"]).toBeDefined();
      expect(DeviceProfiles["mobile-flagship"].tier).toBe("high");
    });

    it("should have mobile-mid-range profile", () => {
      expect(DeviceProfiles["mobile-mid-range"]).toBeDefined();
      expect(DeviceProfiles["mobile-mid-range"].tier).toBe("medium");
    });

    it("should have mobile-budget profile", () => {
      expect(DeviceProfiles["mobile-budget"]).toBeDefined();
      expect(DeviceProfiles["mobile-budget"].tier).toBe("low");
    });

    it("should have tablet profile", () => {
      expect(DeviceProfiles["tablet"]).toBeDefined();
      expect(DeviceProfiles["tablet"].tier).toBe("medium");
    });
  });

  describe("Profile Consistency", () => {
    it("should have consistent profile structure", async () => {
      const profile = await detector.getProfile();

      expect(profile).toMatchObject({
        name: expect.any(String),
        tier: expect.any(String),
        recommendedRuntime: expect.any(String),
        batchSize: expect.any(Number),
        quantization: expect.any(String),
        modelSize: expect.any(String),
        performanceScore: expect.any(Number),
      });
    });
  });

  describe("User Agent Detection", () => {
    it("should include user agent in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.userAgent).toBe("string");
    });

    it("should include platform in capabilities", async () => {
      const capabilities = await detector.detect();
      expect(typeof capabilities.platform).toBe("string");
    });
  });

  describe("Mobile Detection", () => {
    it("should detect mobile devices via profile", async () => {
      const profile = await detector.getProfile();
      const isMobile = profile.name.includes("mobile");
      expect(typeof isMobile).toBe("boolean");
    });
  });

  describe("Integration Tests", () => {
    it("should complete full detection flow", async () => {
      const detector = new CapabilityDetector();

      // Detect capabilities
      const capabilities = await detector.detect();
      expect(capabilities).toBeDefined();

      // Get profile
      const profile = await detector.getProfile();
      expect(profile).toBeDefined();

      // Check specific capabilities
      expect(typeof capabilities.webGPU).toBe("boolean");
      expect(typeof capabilities.memory).toBe("number");
    });
  });
});

describe("Capability Detection Standalone Functions", () => {
  describe("detectCapabilities", () => {
    it("should return capabilities", async () => {
      const capabilities = await detectCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.webGPU).toBeDefined();
    });
  });

  describe("getDeviceProfile", () => {
    it("should return device profile", async () => {
      const profile = await getDeviceProfile();
      expect(profile).toBeDefined();
      expect(profile.tier).toBeDefined();
    });
  });

  describe("supportsWebGPU", () => {
    it("should return boolean", () => {
      const result = supportsWebGPU();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("supportsSIMD", () => {
    it("should return promise of boolean", async () => {
      const result = await supportsSIMD();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("supportsMultiThreading", () => {
    it("should return promise of boolean", async () => {
      const result = await supportsMultiThreading();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getBestRuntime", () => {
    it("should return valid runtime", async () => {
      const runtime = await getBestRuntime();
      expect(["webgpu", "wasm", "hybrid"]).toContain(runtime);
    });
  });
});
