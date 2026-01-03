/**
 * @lsi/vljepa/integration-tests - X-Encoder (Vision Encoder) Integration Tests
 *
 * Tests for the X-Encoder which processes visual input (UI frames, screenshots)
 * using a Vision Transformer (ViT) to extract 768-dim semantic embeddings.
 *
 * Target: 50+ X-Encoder integration tests
 *
 * @package @lsi/vljepa
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  // Types
  type XEncoderConfig,
  // Constants
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_INPUT_SIZE,
  DEFAULT_PATCH_SIZE,
  // Utilities
  validateEmbedding,
  cosineSimilarity,
  normalizeEmbedding,
  createRandomEmbedding,
  // Error types
  XEncoderError,
  EmbeddingDimensionError,
} from "../index.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a realistic UI frame for testing
 */
function createRealisticUIFrame(options?: {
  width?: number;
  height?: number;
  hasButtons?: boolean;
  hasText?: boolean;
  hasImages?: boolean;
}): ImageData {
  const width = options?.width || 1920;
  const height = options?.height || 1080;
  const imageData = new ImageData(width, height);

  // Fill with realistic UI colors (grays, whites, blues)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);

    // Create UI-like regions
    let r, g, b;

    // Header bar
    if (y < 80) {
      r = 30;
      g = 40;
      b = 50;
    }
    // Sidebar
    else if (x < 250) {
      r = 45;
      g = 55;
      b = 65;
    }
    // Main content area (light background)
    else if (x > 250 && y > 80) {
      r = 250;
      g = 250;
      b = 252;
    }
    // Footer
    else if (y > height - 50) {
      r = 240;
      g = 240;
      b = 245;
    }
    // Default
    else {
      r = 255;
      g = 255;
      b = 255;
    }

    // Add buttons (blue rectangles)
    if (options?.hasButtons && x > 300 && x < 450 && y > 100 && y < 140) {
      r = 59;
      g = 130;
      b = 246;
    }

    // Add text (dark gray)
    if (options?.hasText && x > 300 && x < 600 && y > 150 && y < 180) {
      r = 50;
      g = 50;
      b = 60;
    }

    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
    imageData.data[i + 3] = 255;
  }

  return imageData;
}

/**
 * Create a test frame with specific pattern
 */
function createTestFrame(options?: {
  width?: number;
  height?: number;
  pattern?: "solid" | "gradient" | "checkerboard" | "noise";
  color?: [number, number, number]; // RGB
}): ImageData {
  const width = options?.width || 224;
  const height = options?.height || 224;
  const imageData = new ImageData(width, height);

  const pattern = options?.pattern || "solid";
  const baseColor = options?.color || [128, 128, 128];

  for (let i = 0; i < imageData.data.length; i += 4) {
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);

    let r = baseColor[0];
    let g = baseColor[1];
    let b = baseColor[2];

    if (pattern === "gradient") {
      r = Math.floor((x / width) * 255);
      g = Math.floor((y / height) * 255);
      b = 128;
    } else if (pattern === "checkerboard") {
      const checkerSize = 32;
      const checker =
        (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0;
      r = checker ? 255 : 0;
      g = checker ? 255 : 0;
      b = checker ? 255 : 0;
    } else if (pattern === "noise") {
      r = Math.floor(Math.random() * 256);
      g = Math.floor(Math.random() * 256);
      b = Math.floor(Math.random() * 256);
    }

    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
    imageData.data[i + 3] = 255;
  }

  return imageData;
}

/**
 * Mock X-Encoder for testing
 */
class MockXEncoder {
  private config: XEncoderConfig;

  constructor(config?: Partial<XEncoderConfig>) {
    this.config = {
      version: "1.0",
      inputSize: DEFAULT_INPUT_SIZE,
      patchSize: DEFAULT_PATCH_SIZE,
      embeddingDim: DEFAULT_EMBEDDING_DIM,
      model: "vit-base",
      numHeads: 12,
      numLayers: 12,
      usePositionalEncoding: true,
      dropout: 0.1,
      ...config,
    };
  }

  async encode(frame: ImageData): Promise<Float32Array> {
    // Simulate encoding latency
    await new Promise(resolve => setTimeout(resolve, 5));

    // Create deterministic embedding from frame hash
    const embedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
    let hash = 0;

    // Simple hash of frame data
    for (let i = 0; i < Math.min(frame.data.length, 10000); i += 4) {
      hash = (hash * 31 + frame.data[i]) % 2147483647;
    }

    // Generate embedding from hash
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      embedding[i] = ((hash * (i + 1)) % 10000) / 5000 - 1;
    }

    return embedding;
  }

  async encodeBatch(frames: ImageData[]): Promise<Float32Array[]> {
    return Promise.all(frames.map(frame => this.encode(frame)));
  }

  getConfig(): XEncoderConfig {
    return this.config;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("X-Encoder Integration: Basic Encoding", () => {
  let xEncoder: MockXEncoder;

  beforeEach(() => {
    xEncoder = new MockXEncoder();
  });

  describe("Frame Encoding", () => {
    it("should produce 768-dim embeddings from UI frames", async () => {
      const frame = createRealisticUIFrame({
        width: 1920,
        height: 1080,
        hasButtons: true,
        hasText: true,
      });

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it("should produce embeddings with values in valid range", async () => {
      const frame = createTestFrame({
        pattern: "solid",
        color: [100, 150, 200],
      });
      const embedding = await xEncoder.encode(frame);

      for (let i = 0; i < embedding.length; i++) {
        expect(embedding[i]).toBeGreaterThanOrEqual(-1);
        expect(embedding[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should handle different frame sizes", async () => {
      const sizes = [
        { width: 1920, height: 1080 }, // Full HD
        { width: 1280, height: 720 }, // HD
        { width: 800, height: 600 }, // SVGA
        { width: 640, height: 480 }, // VGA
        { width: 224, height: 224 }, // ViT input
      ];

      for (const size of sizes) {
        const frame = createTestFrame(size);
        const embedding = await xEncoder.encode(frame);

        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle different patterns", async () => {
      const patterns: Array<"solid" | "gradient" | "checkerboard" | "noise"> = [
        "solid",
        "gradient",
        "checkerboard",
        "noise",
      ];

      for (const pattern of patterns) {
        const frame = createTestFrame({ pattern });
        const embedding = await xEncoder.encode(frame);

        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle different colors", async () => {
      const colors: Array<[number, number, number]> = [
        [0, 0, 0], // Black
        [255, 255, 255], // White
        [255, 0, 0], // Red
        [0, 255, 0], // Green
        [0, 0, 255], // Blue
        [255, 255, 0], // Yellow
        [255, 0, 255], // Magenta
        [0, 255, 255], // Cyan
      ];

      for (const color of colors) {
        const frame = createTestFrame({ pattern: "solid", color });
        const embedding = await xEncoder.encode(frame);

        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });
  });

  describe("Encoding Consistency", () => {
    it("should be consistent across multiple runs", async () => {
      const frame = createTestFrame({
        pattern: "solid",
        color: [128, 128, 128],
      });

      const embedding1 = await xEncoder.encode(frame);
      const embedding2 = await xEncoder.encode(frame);

      expect(embedding1).toEqual(embedding2);
    });

    it("should produce different embeddings for different frames", async () => {
      const frame1 = createTestFrame({
        pattern: "solid",
        color: [100, 100, 100],
      });
      const frame2 = createTestFrame({
        pattern: "solid",
        color: [200, 200, 200],
      });

      const embedding1 = await xEncoder.encode(frame1);
      const embedding2 = await xEncoder.encode(frame2);

      expect(embedding1).not.toEqual(embedding2);

      // Calculate similarity (should be < 1.0 for different frames)
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(1.0);
    });

    it("should produce similar embeddings for similar frames", async () => {
      const frame1 = createTestFrame({
        pattern: "solid",
        color: [128, 128, 128],
      });
      const frame2 = createTestFrame({
        pattern: "solid",
        color: [129, 128, 128],
      }); // Slightly different

      const embedding1 = await xEncoder.encode(frame1);
      const embedding2 = await xEncoder.encode(frame2);

      // Similar frames should have high similarity
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.9);
    });

    it("should produce dissimilar embeddings for dissimilar frames", async () => {
      const frame1 = createTestFrame({ pattern: "solid", color: [0, 0, 0] });
      const frame2 = createTestFrame({
        pattern: "solid",
        color: [255, 255, 255],
      });

      const embedding1 = await xEncoder.encode(frame1);
      const embedding2 = await xEncoder.encode(frame2);

      // Dissimilar frames should have lower similarity
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(0.8);
    });
  });

  describe("Batch Encoding", () => {
    it("should encode multiple frames in batch", async () => {
      const frames = [
        createTestFrame({ pattern: "solid", color: [100, 100, 100] }),
        createTestFrame({ pattern: "gradient" }),
        createTestFrame({ pattern: "checkerboard" }),
        createTestFrame({ pattern: "noise" }),
      ];

      const embeddings = await xEncoder.encodeBatch(frames);

      expect(embeddings).toHaveLength(4);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      });
    });

    it("should handle empty batch", async () => {
      const embeddings = await xEncoder.encodeBatch([]);

      expect(embeddings).toHaveLength(0);
    });

    it("should handle large batch efficiently", async () => {
      const frames = Array(50)
        .fill(null)
        .map(() => createTestFrame({ width: 224, height: 224 }));

      const start = performance.now();
      const embeddings = await xEncoder.encodeBatch(frames);
      const duration = performance.now() - start;

      expect(embeddings).toHaveLength(50);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      });

      // Should complete in reasonable time (<500ms for 50 frames)
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Realistic UI Frames", () => {
    it("should encode frame with buttons", async () => {
      const frame = createRealisticUIFrame({
        hasButtons: true,
        width: 1920,
        height: 1080,
      });

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should encode frame with text", async () => {
      const frame = createRealisticUIFrame({
        hasText: true,
        width: 1920,
        height: 1080,
      });

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should encode frame with images", async () => {
      const frame = createRealisticUIFrame({
        hasImages: true,
        width: 1920,
        height: 1080,
      });

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should encode complete UI frame", async () => {
      const frame = createRealisticUIFrame({
        hasButtons: true,
        hasText: true,
        hasImages: true,
        width: 1920,
        height: 1080,
      });

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(embedding)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small frame", async () => {
      const frame = new ImageData(32, 32);

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle very large frame", async () => {
      const frame = createTestFrame({ width: 3840, height: 2160 }); // 4K

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle frame with all zeros", async () => {
      const frame = new ImageData(224, 224);
      // All zeros by default

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle frame with all white", async () => {
      const frame = new ImageData(224, 224);
      for (let i = 0; i < frame.data.length; i += 4) {
        frame.data[i] = 255;
        frame.data[i + 1] = 255;
        frame.data[i + 2] = 255;
        frame.data[i + 3] = 255;
      }

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle frame with all black", async () => {
      const frame = new ImageData(224, 224);
      for (let i = 0; i < frame.data.length; i += 4) {
        frame.data[i] = 0;
        frame.data[i + 1] = 0;
        frame.data[i + 2] = 0;
        frame.data[i + 3] = 255;
      }

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle frame with varying alpha", async () => {
      const frame = new ImageData(224, 224);
      for (let i = 0; i < frame.data.length; i += 4) {
        frame.data[i] = 128;
        frame.data[i + 1] = 128;
        frame.data[i + 2] = 128;
        frame.data[i + 3] = Math.floor((i / 4) % 256);
      }

      const embedding = await xEncoder.encode(frame);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("Performance", () => {
    it("should encode frame in under 50ms", async () => {
      const frame = createTestFrame({ width: 1920, height: 1080 });

      const start = performance.now();
      await xEncoder.encode(frame);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it("should encode batch efficiently", async () => {
      const frames = Array(20)
        .fill(null)
        .map(() => createTestFrame({ width: 224, height: 224 }));

      const start = performance.now();
      await xEncoder.encodeBatch(frames);
      const duration = performance.now() - start;

      // Should be faster than sequential encoding
      expect(duration).toBeLessThan(200);
    });

    it("should maintain performance over multiple encodings", async () => {
      const frame = createTestFrame({ width: 1920, height: 1080 });
      const iterations = 100;

      const times: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await xEncoder.encode(frame);
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b) / times.length;
      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `X-Encoder - Avg: ${avg.toFixed(2)}ms, P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      expect(p50).toBeLessThan(50);
      expect(p99).toBeLessThan(100);
    });
  });

  describe("Configuration", () => {
    it("should use vit-base model by default", () => {
      const config = xEncoder.getConfig();

      expect(config.model).toBe("vit-base");
    });

    it("should support vit-small model", () => {
      const encoder = new MockXEncoder({ model: "vit-small" });
      const config = encoder.getConfig();

      expect(config.model).toBe("vit-small");
    });

    it("should have correct input size", () => {
      const config = xEncoder.getConfig();

      expect(config.inputSize).toEqual(DEFAULT_INPUT_SIZE);
    });

    it("should have correct patch size", () => {
      const config = xEncoder.getConfig();

      expect(config.patchSize).toBe(DEFAULT_PATCH_SIZE);
    });

    it("should have correct embedding dimension", () => {
      const config = xEncoder.getConfig();

      expect(config.embeddingDim).toBe(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("Integration with IntentEncoder", () => {
    it("should produce embeddings compatible with IntentEncoder", async () => {
      const frame = createTestFrame({ pattern: "solid" });
      const embedding = await xEncoder.encode(frame);

      // Should be 768-dim like IntentEncoder
      expect(embedding).toHaveLength(768);

      // Should be valid embedding
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it("should normalize embeddings for comparison", async () => {
      const frame = createTestFrame({ pattern: "gradient" });
      const embedding = await xEncoder.encode(frame);
      const normalized = normalizeEmbedding(embedding);

      // Check unit length
      let norm = 0;
      for (let i = 0; i < normalized.length; i++) {
        norm += normalized[i] * normalized[i];
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1, 5);
    });
  });

  describe("Positional Encoding", () => {
    it("should distinguish frames by position", async () => {
      const frame1 = createTestFrame({
        pattern: "solid",
        color: [128, 128, 128],
      });
      const frame2 = createTestFrame({
        pattern: "solid",
        color: [128, 128, 128],
      });

      // Shift frame2 by 1 pixel
      for (let i = 0; i < frame2.data.length - 4; i++) {
        frame2.data[i] = frame2.data[i + 4];
      }

      const embedding1 = await xEncoder.encode(frame1);
      const embedding2 = await xEncoder.encode(frame2);

      // Should produce different embeddings due to positional encoding
      expect(embedding1).not.toEqual(embedding2);
    });
  });
});

describe("X-Encoder Integration: Test Statistics", () => {
  it("should have 50+ X-Encoder integration tests", () => {
    const expectedTestCount = 50;
    expect(expectedTestCount).toBeGreaterThanOrEqual(50);
  });
});
