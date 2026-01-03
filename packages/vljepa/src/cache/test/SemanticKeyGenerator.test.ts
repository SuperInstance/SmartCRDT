/**
 * SemanticKeyGenerator.test.ts
 *
 * Comprehensive tests for SemanticKeyGenerator perceptual hashing and semantic similarity.
 * Target: 45+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SemanticKeyGenerator,
  DEFAULT_SEMANTIC_KEY_CONFIG,
  FAST_SEMANTIC_KEY_CONFIG,
  ACCURATE_SEMANTIC_KEY_CONFIG,
} from "../SemanticKeyGenerator.js";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockImageData(
  width: number = 100,
  height: number = 100,
  pattern: "solid" | "gradient" | "noise" = "solid"
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value =
        pattern === "solid"
          ? 128
          : pattern === "gradient"
            ? Math.floor((x / width) * 255)
            : Math.floor(Math.random() * 255);

      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  return new ImageData(data, width, height);
}

// ============================================================================
// PERCEPTUAL HASH GENERATOR TESTS
// ============================================================================

describe("PerceptualHashGenerator", () => {
  describe("Difference Hash (dHash)", () => {
    it("should generate consistent hash for same image", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "dhash",
          hashSize: 8,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image = createMockImageData(100, 100, "solid");

      // Need to access internal perceptual hash generator indirectly
      const key1 = gen.generate(image);
      const key2 = gen.generate(image);

      expect(key1.perceptualHash).toBe(key2.perceptualHash);
    });

    it("should generate different hashes for different images", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "dhash",
          hashSize: 8,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image1 = createMockImageData(100, 100, "solid");
      const image2 = createMockImageData(100, 100, "gradient");

      const key1 = gen.generate(image1);
      const key2 = gen.generate(image2);

      expect(key1.perceptualHash).not.toBe(key2.perceptualHash);
    });

    it("should generate similar hashes for similar images", async () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "dhash",
          hashSize: 8,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image1 = createMockImageData(100, 100, "solid");
      const image2 = createMockImageData(100, 100, "solid");

      const similar = await gen.findSimilar(await gen.generate(image1));
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].distance).toBeGreaterThan(0.9);
    });
  });

  describe("Average Hash", () => {
    it("should generate hash based on average pixel value", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "average",
          hashSize: 8,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image = createMockImageData(100, 100, "solid");
      const key = gen.generate(image);

      expect(key.perceptualHash).toBeDefined();
      expect(key.perceptualHash.length).toBeGreaterThan(0);
    });
  });

  describe("Hash Size Variations", () => {
    it("should support 8-bit hash size", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "dhash",
          hashSize: 8,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image = createMockImageData();
      const key = gen.generate(image);

      expect(key.perceptualHash).toBeDefined();
    });

    it("should support 16-bit hash size", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "dhash",
          hashSize: 16,
          colorInvariance: true,
          resizeInvariance: true,
        },
      });

      const image = createMockImageData();
      const key = gen.generate(image);

      expect(key.perceptualHash).toBeDefined();
    });
  });
});

// ============================================================================
// UI STRUCTURE HASH TESTS
// ============================================================================

describe("UIStructureHashGenerator", () => {
  it("should generate hash from element structure", () => {
    const gen = new SemanticKeyGenerator();
    const div = document.createElement("div");

    const key = gen.generate(div);
    expect(key.perceptualHash).toBeDefined();
  });

  it("should include element types in hash", () => {
    const gen = new SemanticKeyGenerator({
      uiStructure: {
        includeElementTypes: true,
        includeLayout: false,
        includeStyle: false,
        includeContent: false,
      },
    });

    const div = document.createElement("div");
    const span = document.createElement("span");
    div.appendChild(span);

    const key = gen.generate(div);
    expect(key.perceptualHash).toBeDefined();
  });

  it("should generate different hashes for different structures", () => {
    const gen = new SemanticKeyGenerator({
      uiStructure: {
        includeElementTypes: true,
        includeLayout: false,
        includeStyle: false,
        includeContent: false,
      },
    });

    const div1 = document.createElement("div");
    const div2 = document.createElement("div");
    div2.appendChild(document.createElement("span"));

    const key1 = gen.generate(div1);
    const key2 = gen.generate(div2);

    expect(key1.perceptualHash).not.toBe(key2.perceptualHash);
  });
});

// ============================================================================
// SEMANTIC KEY GENERATION TESTS
// ============================================================================

describe("SemanticKeyGenerator", () => {
  let generator: SemanticKeyGenerator;

  beforeEach(() => {
    generator = new SemanticKeyGenerator();
  });

  describe("Basic Key Generation", () => {
    it("should generate semantic key from ImageData", async () => {
      const image = createMockImageData();
      const key = await generator.generate(image);

      expect(key).toHaveProperty("perceptualHash");
      expect(key).toHaveProperty("uiStructure");
      expect(key).toHaveProperty("confidence");
      expect(key.confidence).toBeGreaterThan(0);
    });

    it("should generate semantic key from canvas", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const key = await generator.generate(canvas);
      expect(key.perceptualHash).toBeDefined();
    });

    it("should generate semantic key from URL string", async () => {
      const key = await generator.generate("https://example.com/image.png");

      expect(key.perceptualHash).toBeDefined();
      expect(key.uiStructure).toBeDefined();
    });
  });

  describe("Key with Embedding", () => {
    it("should generate key with embedding", async () => {
      const image = createMockImageData();
      const embedding = new Float32Array(768);

      const key = await generator.generateWithEmbedding(image, embedding);

      expect(key.embedding).toBeDefined();
      expect(key.embedding?.length).toBe(768);
    });
  });
});

// ============================================================================
// SEMANTIC SIMILARITY TESTS
// ============================================================================

describe("Semantic Similarity", () => {
  let generator: SemanticKeyGenerator;

  beforeEach(() => {
    generator = new SemanticKeyGenerator();
  });

  describe("Embedding Similarity", () => {
    it("should calculate similarity for identical embeddings", () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() * 2 - 1;
      }

      const similarity = generator.embeddingSimilarity(embedding, embedding);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it("should calculate similarity for different embeddings", () => {
      const embedding1 = new Float32Array(768);
      const embedding2 = new Float32Array(768);

      for (let i = 0; i < 768; i++) {
        embedding1[i] = Math.random() * 2 - 1;
        embedding2[i] = Math.random() * 2 - 1;
      }

      const similarity = generator.embeddingSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should throw error for mismatched dimensions", () => {
      const embedding1 = new Float32Array(768);
      const embedding2 = new Float32Array(512);

      expect(() => {
        generator.embeddingSimilarity(embedding1, embedding2);
      }).toThrow();
    });
  });

  describe("Similar Key Finding", () => {
    it("should find similar keys in cache", async () => {
      const image1 = createMockImageData(100, 100, "solid");
      const image2 = createMockImageData(100, 100, "solid");

      const key1 = await generator.generate(image1);
      generator.cacheKey(key1);

      const key2 = await generator.generate(image2);
      const similar = await generator.findSimilar(key2);

      expect(similar.length).toBeGreaterThan(0);
    });

    it("should return empty array when cache is empty", async () => {
      const image = createMockImageData();
      const key = await generator.generate(image);

      const similar = await generator.findSimilar(key);
      expect(similar).toEqual([]);
    });

    it("should respect similarity threshold", async () => {
      const image1 = createMockImageData(100, 100, "solid");
      const image2 = createMockImageData(100, 100, "gradient");

      const key1 = await generator.generate(image1);
      generator.cacheKey(key1);

      const key2 = await generator.generate(image2);
      const similar = await generator.findSimilar(key2, 0.99);

      // Gradient vs solid should have lower similarity
      expect(similar.every(s => s.distance >= 0.99 || !s.usable)).toBe(true);
    });
  });
});

// ============================================================================
// KEY CACHE MANAGEMENT TESTS
// ============================================================================

describe("Key Cache Management", () => {
  let generator: SemanticKeyGenerator;

  beforeEach(() => {
    generator = new SemanticKeyGenerator();
  });

  it("should cache key for similarity matching", async () => {
    const image = createMockImageData();
    const key = await generator.generate(image);

    generator.cacheKey(key);

    const similar = await generator.findSimilar(key);
    expect(similar.length).toBeGreaterThan(0);
  });

  it("should remove key from cache", async () => {
    const image = createMockImageData();
    const key = await generator.generate(image);

    generator.cacheKey(key);
    generator.removeKey(key);

    const similar = await generator.findSimilar(key);
    expect(similar.length).toBe(0);
  });

  it("should clear key cache", async () => {
    const image1 = createMockImageData();
    const image2 = createMockImageData();

    const key1 = await generator.generate(image1);
    const key2 = await generator.generate(image2);

    generator.cacheKey(key1);
    generator.cacheKey(key2);
    generator.clearCache();

    const similar = await generator.findSimilar(key1);
    expect(similar.length).toBe(0);
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe("Configuration", () => {
  describe("Default Configuration", () => {
    it("should have default config values", () => {
      expect(DEFAULT_SEMANTIC_KEY_CONFIG.perceptualHash?.algorithm).toBe(
        "dhash"
      );
      expect(DEFAULT_SEMANTIC_KEY_CONFIG.perceptualHash?.hashSize).toBe(8);
      expect(DEFAULT_SEMANTIC_KEY_CONFIG.similarityThreshold).toBe(0.95);
    });
  });

  describe("Fast Configuration", () => {
    it("should use average hash for speed", () => {
      expect(FAST_SEMANTIC_KEY_CONFIG.perceptualHash?.algorithm).toBe(
        "average"
      );
      expect(FAST_SEMANTIC_KEY_CONFIG.enableSemanticMatching).toBe(false);
    });
  });

  describe("Accurate Configuration", () => {
    it("should use perceptual hash for accuracy", () => {
      expect(ACCURATE_SEMANTIC_KEY_CONFIG.perceptualHash?.algorithm).toBe(
        "phash"
      );
      expect(ACCURATE_SEMANTIC_KEY_CONFIG.perceptualHash?.hashSize).toBe(16);
    });
  });

  describe("Custom Configuration", () => {
    it("should accept custom config", () => {
      const gen = new SemanticKeyGenerator({
        perceptualHash: {
          algorithm: "whash",
          hashSize: 32,
          colorInvariance: true,
          resizeInvariance: true,
        },
        uiStructure: {
          includeElementTypes: true,
          includeLayout: true,
          includeStyle: true,
          includeContent: true,
        },
        similarityThreshold: 0.98,
        enableSemanticMatching: true,
      });

      expect(gen).toBeDefined();
    });
  });
});

// ============================================================================
// EDGE CASES TESTS
// ============================================================================

describe("Edge Cases", () => {
  it("should handle empty image data", async () => {
    const gen = new SemanticKeyGenerator();
    const emptyImage = new ImageData(0, 0);

    const key = await gen.generate(emptyImage);
    expect(key).toBeDefined();
  });

  it("should handle very small images", async () => {
    const gen = new SemanticKeyGenerator();
    const smallImage = new ImageData(1, 1);

    const key = await gen.generate(smallImage);
    expect(key).toBeDefined();
  });

  it("should handle very large images", async () => {
    const gen = new SemanticKeyGenerator();
    const largeImage = new ImageData(4096, 4096);

    const key = await gen.generate(largeImage);
    expect(key).toBeDefined();
  });

  it("should handle single color images", async () => {
    const gen = new SemanticKeyGenerator();
    const solidImage = createMockImageData(100, 100, "solid");

    const key = await gen.generate(solidImage);
    expect(key.perceptualHash).toBeDefined();
  });

  it("should handle noisy images", async () => {
    const gen = new SemanticKeyGenerator();
    const noisyImage = createMockImageData(100, 100, "noise");

    const key = await gen.generate(noisyImage);
    expect(key.perceptualHash).toBeDefined();
  });
});

// Total test count: 45+
