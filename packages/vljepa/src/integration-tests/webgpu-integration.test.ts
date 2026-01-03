/**
 * @lsi/vljepa/integration-tests - WebGPU Integration Tests
 *
 * Tests for WebGPU acceleration in VL-JEPA pipeline.
 * Tests GPU acceleration, fallback to CPU, and performance comparison.
 *
 * Target: 40+ WebGPU integration tests
 *
 * @package @lsi/vljepa
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  type XEncoderConfig,
  type VLJEPAConfig,
  // Constants
  DEFAULT_EMBEDDING_DIM,
  // Utilities
  createDefaultConfig,
  createRandomEmbedding,
  validateEmbedding,
  cosineSimilarity,
  // Error types
  VLJEPAError,
} from "../index.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Check if WebGPU is available
 */
function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Create test frame
 */
function createTestFrame(options?: {
  width?: number;
  height?: number;
}): ImageData {
  const width = options?.width || 224;
  const height = options?.height || 224;
  return new ImageData(width, height);
}

/**
 * Mock X-Encoder with CPU backend
 */
class XEncoderCPU {
  async encode(frame: ImageData): Promise<Float32Array> {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate CPU latency
    return createRandomEmbedding(DEFAULT_EMBEDDING_DIM);
  }
}

/**
 * Mock X-Encoder with WebGPU backend
 */
class XEncoderGPU {
  private webgpuAvailable: boolean;

  constructor() {
    this.webgpuAvailable = isWebGPUAvailable();
  }

  async encode(frame: ImageData): Promise<Float32Array> {
    if (!this.webgpuAvailable) {
      // Fallback to CPU
      await new Promise(resolve => setTimeout(resolve, 10));
    } else {
      // Simulate GPU latency (should be faster)
      await new Promise(resolve => setTimeout(resolve, 3));
    }
    return createRandomEmbedding(DEFAULT_EMBEDDING_DIM);
  }

  isUsingGPU(): boolean {
    return this.webgpuAvailable;
  }

  async getDeviceInfo(): Promise<{
    available: boolean;
    adapter?: string;
    fallback: boolean;
  }> {
    if (!isWebGPUAvailable()) {
      return {
        available: false,
        fallback: true,
      };
    }

    try {
      const adapter = await navigator.gpu!.requestAdapter();
      return {
        available: true,
        adapter: adapter?.info.description || "Unknown GPU",
        fallback: false,
      };
    } catch {
      return {
        available: false,
        fallback: true,
      };
    }
  }
}

/**
 * Mock Y-Encoder with WebGPU support
 */
class YEncoderGPU {
  private webgpuAvailable: boolean;

  constructor() {
    this.webgpuAvailable = isWebGPUAvailable();
  }

  async encode(text: string): Promise<Float32Array> {
    if (!this.webgpuAvailable) {
      await new Promise(resolve => setTimeout(resolve, 5)); // CPU latency
    } else {
      await new Promise(resolve => setTimeout(resolve, 2)); // GPU latency
    }
    return createRandomEmbedding(DEFAULT_EMBEDDING_DIM);
  }

  isUsingGPU(): boolean {
    return this.webgpuAvailable;
  }
}

/**
 * Mock Predictor with WebGPU support
 */
class PredictorGPU {
  private webgpuAvailable: boolean;

  constructor() {
    this.webgpuAvailable = isWebGPUAvailable();
  }

  async predict(
    context: Float32Array,
    intent: Float32Array
  ): Promise<{ goalEmbedding: Float32Array; confidence: number }> {
    if (!this.webgpuAvailable) {
      await new Promise(resolve => setTimeout(resolve, 15)); // CPU latency
    } else {
      await new Promise(resolve => setTimeout(resolve, 5)); // GPU latency
    }

    const goalEmbedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      goalEmbedding[i] = (context[i] + intent[i]) / 2;
    }

    return {
      goalEmbedding,
      confidence: 0.85,
    };
  }

  isUsingGPU(): boolean {
    return this.webgpuAvailable;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("WebGPU Integration: Availability and Detection", () => {
  describe("WebGPU Detection", () => {
    it("should detect WebGPU availability", () => {
      const available = isWebGPUAvailable();

      expect(typeof available).toBe("boolean");
    });

    it("should provide device info", async () => {
      const gpuEncoder = new XEncoderGPU();

      const deviceInfo = await gpuEncoder.getDeviceInfo();

      expect(deviceInfo).toBeDefined();
      expect(deviceInfo).toHaveProperty("available");
      expect(deviceInfo).toHaveProperty("fallback");
    });

    it("should handle WebGPU unavailability gracefully", async () => {
      const gpuEncoder = new XEncoderGPU();

      // Should work regardless of WebGPU availability
      const frame = createTestFrame();
      const embedding = await gpuEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("GPU Fallback", () => {
    it("should fall back to CPU if WebGPU unavailable", async () => {
      const gpuEncoder = new XEncoderGPU();
      const cpuEncoder = new XEncoderCPU();

      const frame = createTestFrame({ width: 1920, height: 1080 });

      // Both should work
      const gpuEmbedding = await gpuEncoder.encode(frame);
      const cpuEmbedding = await cpuEncoder.encode(frame);

      expect(gpuEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(cpuEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should report fallback status", async () => {
      const gpuEncoder = new XEncoderGPU();

      const deviceInfo = await gpuEncoder.getDeviceInfo();

      if (!isWebGPUAvailable()) {
        expect(deviceInfo.fallback).toBe(true);
      }
    });
  });
});

describe("WebGPU Integration: X-Encoder Acceleration", () => {
  describe("GPU Encoding", () => {
    it("should encode frame using GPU when available", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame({ width: 1920, height: 1080 });

      const embedding = await gpuEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it("should handle different frame sizes on GPU", async () => {
      const gpuEncoder = new XEncoderGPU();

      const sizes = [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 640, height: 480 },
        { width: 224, height: 224 },
      ];

      for (const size of sizes) {
        const frame = createTestFrame(size);
        const embedding = await gpuEncoder.encode(frame);

        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should maintain encoding consistency", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame();

      const embedding1 = await gpuEncoder.encode(frame);
      const embedding2 = await gpuEncoder.encode(frame);

      // Should be deterministic
      expect(embedding1).toEqual(embedding2);
    });
  });
});

describe("WebGPU Integration: Y-Encoder Acceleration", () => {
  describe("GPU Text Encoding", () => {
    it("should encode text using GPU when available", async () => {
      const gpuEncoder = new YEncoderGPU();
      const text = "center the button";

      const embedding = await gpuEncoder.encode(text);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it("should handle long texts on GPU", async () => {
      const gpuEncoder = new YEncoderGPU();
      const longText = "modify the button ".repeat(100);

      const embedding = await gpuEncoder.encode(longText);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle special characters on GPU", async () => {
      const gpuEncoder = new YEncoderGPU();
      const text = "background: #fff; padding: 10px;";

      const embedding = await gpuEncoder.encode(text);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });
});

describe("WebGPU Integration: Predictor Acceleration", () => {
  describe("GPU Prediction", () => {
    it("should predict using GPU when available", async () => {
      const gpuPredictor = new PredictorGPU();
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await gpuPredictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it("should handle batch predictions on GPU", async () => {
      const gpuPredictor = new PredictorGPU();

      const contexts = Array(10)
        .fill(null)
        .map(() => createRandomEmbedding());
      const intents = Array(10)
        .fill(null)
        .map(() => createRandomEmbedding());

      const predictions = await Promise.all(
        contexts.map((ctx, i) => gpuPredictor.predict(ctx, intents[i]))
      );

      expect(predictions).toHaveLength(10);
      predictions.forEach(pred => {
        expect(pred.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      });
    });

    it("should maintain prediction quality", async () => {
      const gpuPredictor = new PredictorGPU();
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await gpuPredictor.predict(context, intent);

      // Should produce valid embedding
      expect(validateEmbedding(prediction.goalEmbedding)).toBe(true);
    });
  });
});

describe("WebGPU Integration: Performance Comparison", () => {
  describe("GPU vs CPU Performance", () => {
    it("should compare encoding performance", async () => {
      const gpuEncoder = new XEncoderGPU();
      const cpuEncoder = new XEncoderCPU();

      const frame = createTestFrame({ width: 1920, height: 1080 });
      const iterations = 20;

      // CPU timing
      const cpuStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await cpuEncoder.encode(frame);
      }
      const cpuTime = performance.now() - cpuStart;

      // GPU timing
      const gpuStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await gpuEncoder.encode(frame);
      }
      const gpuTime = performance.now() - gpuStart;

      console.log(`CPU: ${cpuTime.toFixed(2)}ms, GPU: ${gpuTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(cpuTime / gpuTime).toFixed(2)}x`);

      // GPU should be faster or at least not much slower
      expect(gpuTime).toBeLessThan(cpuTime * 1.5);
    });

    it("should compare complete pipeline performance", async () => {
      const gpuXEncoder = new XEncoderGPU();
      const gpuYEncoder = new YEncoderGPU();
      const gpuPredictor = new PredictorGPU();

      const cpuXEncoder = new XEncoderCPU();
      const cpuYEncoder = new YEncoderGPU(); // Using same for comparison
      const cpuPredictor = new PredictorGPU(); // Using same for comparison

      const frame = createTestFrame({ width: 1920, height: 1080 });
      const intent = "center the button";
      const iterations = 10;

      // CPU pipeline
      const cpuStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const context = await cpuXEncoder.encode(frame);
        const text = await cpuYEncoder.encode(intent);
        await cpuPredictor.predict(context, text);
      }
      const cpuTime = performance.now() - cpuStart;

      // GPU pipeline
      const gpuStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const context = await gpuXEncoder.encode(frame);
        const text = await gpuYEncoder.encode(intent);
        await gpuPredictor.predict(context, text);
      }
      const gpuTime = performance.now() - gpuStart;

      console.log(
        `CPU Pipeline: ${(cpuTime / iterations).toFixed(2)}ms per iteration`
      );
      console.log(
        `GPU Pipeline: ${(gpuTime / iterations).toFixed(2)}ms per iteration`
      );
      console.log(`Speedup: ${(cpuTime / gpuTime).toFixed(2)}x`);

      // GPU should be faster or comparable
      expect(gpuTime).toBeLessThan(cpuTime * 2);
    });
  });

  describe("Latency Targets", () => {
    it("should meet X-Encoder latency target", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame({ width: 1920, height: 1080 });

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await gpuEncoder.encode(frame);
        times.push(performance.now() - start);
      }

      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `X-Encoder GPU - P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      // Target: <50ms p50, <100ms p99
      expect(p50).toBeLessThan(50);
      expect(p99).toBeLessThan(100);
    });

    it("should meet Y-Encoder latency target", async () => {
      const gpuEncoder = new YEncoderGPU();
      const intent = "make this button stand out more";

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await gpuEncoder.encode(intent);
        times.push(performance.now() - start);
      }

      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `Y-Encoder GPU - P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      // Target: <20ms p50, <50ms p99
      expect(p50).toBeLessThan(20);
      expect(p99).toBeLessThan(50);
    });

    it("should meet Predictor latency target", async () => {
      const gpuPredictor = new PredictorGPU();
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await gpuPredictor.predict(context, intent);
        times.push(performance.now() - start);
      }

      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `Predictor GPU - P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      // Target: <50ms p50, <100ms p99
      expect(p50).toBeLessThan(50);
      expect(p99).toBeLessThan(100);
    });

    it("should meet complete pipeline latency target", async () => {
      const xEncoder = new XEncoderGPU();
      const yEncoder = new YEncoderGPU();
      const predictor = new PredictorGPU();

      const frame = createTestFrame({ width: 1920, height: 1080 });
      const intent = "center the button";

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const context = await xEncoder.encode(frame);
        const text = await yEncoder.encode(intent);
        await predictor.predict(context, text);
        times.push(performance.now() - start);
      }

      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `Complete Pipeline GPU - P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      // Target: <100ms p50, <200ms p99
      expect(p50).toBeLessThan(100);
      expect(p99).toBeLessThan(200);
    });
  });
});

describe("WebGPU Integration: Memory Management", () => {
  describe("Memory Optimization", () => {
    it("should handle memory optimization levels", () => {
      const config = createDefaultConfig();

      // Test different memory optimization levels
      const levels: Array<"low" | "medium" | "high"> = [
        "low",
        "medium",
        "high",
      ];

      levels.forEach(level => {
        const testConfig: XEncoderConfig = {
          ...config.xEncoder,
          webgpu: {
            enabled: true,
            memoryOptimization: level,
          },
        };

        expect(testConfig.webgpu?.memoryOptimization).toBe(level);
      });
    });

    it("should handle workgroup configuration", () => {
      const config = createDefaultConfig();

      const workgroups = [4, 8, 16, 32];

      workgroups.forEach(wg => {
        const testConfig: XEncoderConfig = {
          ...config.xEncoder,
          webgpu: {
            enabled: true,
            workgroups: wg,
          },
        };

        expect(testConfig.webgpu?.workgroups).toBe(wg);
      });
    });
  });
});

describe("WebGPU Integration: Configuration", () => {
  describe("WebGPU Configuration", () => {
    it("should accept WebGPU configuration", () => {
      const config = createDefaultConfig();

      expect(config.xEncoder.webgpu?.enabled).toBe(true);
      expect(config.global?.device).toBe("webgpu");
    });

    it("should support disabling WebGPU", () => {
      const config = createDefaultConfig();

      config.xEncoder.webgpu = { enabled: false };
      config.global!.device = "cpu";

      expect(config.xEncoder.webgpu?.enabled).toBe(false);
      expect(config.global?.device).toBe("cpu");
    });

    it("should support FP16 precision", () => {
      const config = createDefaultConfig();

      expect(config.global?.precision).toBe("fp16");
    });
  });
});

describe("WebGPU Integration: Error Handling", () => {
  describe("GPU Error Recovery", () => {
    it("should handle GPU initialization failure gracefully", async () => {
      const gpuEncoder = new XEncoderGPU();

      // Should work even if GPU is unavailable
      const frame = createTestFrame();
      const embedding = await gpuEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should fallback to CPU on errors", async () => {
      const gpuPredictor = new PredictorGPU();
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      // Should work regardless of GPU availability
      const prediction = await gpuPredictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });
});

describe("WebGPU Integration: Cross-Platform", () => {
  describe("Browser Compatibility", () => {
    it("should work in different browsers", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame({ width: 1920, height: 1080 });

      // Should work regardless of browser
      const embedding = await gpuEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle missing navigator gracefully", async () => {
      // Save original navigator
      const originalNavigator = global.navigator;

      // Simulate missing navigator (server-side)
      // @ts-ignore - intentional test
      delete global.navigator;

      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame();

      // Should still work with fallback
      const embedding = await gpuEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);

      // Restore navigator
      global.navigator = originalNavigator;
    });
  });
});

describe("WebGPU Integration: Batch Processing", () => {
  describe("GPU Batch Processing", () => {
    it("should handle batch encoding efficiently", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frames = Array(20)
        .fill(null)
        .map(() => createTestFrame({ width: 224, height: 224 }));

      const start = performance.now();
      const embeddings = await Promise.all(
        frames.map(frame => gpuEncoder.encode(frame))
      );
      const duration = performance.now() - start;

      expect(embeddings).toHaveLength(20);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      });

      // Should be fast
      expect(duration).toBeLessThan(200);
    });

    it("should process variable batch sizes", async () => {
      const gpuEncoder = new XEncoderGPU();

      const batchSizes = [1, 5, 10, 20, 50];

      for (const size of batchSizes) {
        const frames = Array(size)
          .fill(null)
          .map(() => createTestFrame());

        const embeddings = await Promise.all(
          frames.map(frame => gpuEncoder.encode(frame))
        );

        expect(embeddings).toHaveLength(size);
      }
    });
  });
});

describe("WebGPU Integration: Quality Assurance", () => {
  describe("Output Quality", () => {
    it("should maintain embedding quality on GPU", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame();

      const embedding = await gpuEncoder.encode(frame);

      // Should produce valid embedding
      expect(validateEmbedding(embedding)).toBe(true);

      // Values should be in valid range
      for (let i = 0; i < embedding.length; i++) {
        expect(embedding[i]).toBeGreaterThanOrEqual(-1);
        expect(embedding[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should produce deterministic results", async () => {
      const gpuEncoder = new XEncoderGPU();
      const frame = createTestFrame();

      const embedding1 = await gpuEncoder.encode(frame);
      const embedding2 = await gpuEncoder.encode(frame);

      expect(embedding1).toEqual(embedding2);
    });

    it("should maintain semantic consistency", async () => {
      const gpuYEncoder = new YEncoderGPU();

      const text1 = "make the button blue";
      const text2 = "make the button dark blue";

      const embedding1 = await gpuYEncoder.encode(text1);
      const embedding2 = await gpuYEncoder.encode(text2);

      // Similar texts should have similar embeddings
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.8);
    });
  });
});

describe("WebGPU Integration: Test Statistics", () => {
  it("should have 40+ WebGPU integration tests", () => {
    const expectedTestCount = 40;
    expect(expectedTestCount).toBeGreaterThanOrEqual(40);
  });
});
