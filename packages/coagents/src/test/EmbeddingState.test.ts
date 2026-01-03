/**
 * @fileoverview Embedding State Tests
 * @coverage 30+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingStateManager,
  createEmbeddingStateManager,
} from "../state/EmbeddingState.js";

describe("EmbeddingStateManager", () => {
  let manager: EmbeddingStateManager;

  beforeEach(() => {
    manager = createEmbeddingStateManager({
      enableHistory: true,
      maxHistorySize: 10,
      enableCache: true,
    });
  });

  describe("Constructor", () => {
    it("should create with default config", () => {
      const defaultManager = createEmbeddingStateManager();
      expect(defaultManager).toBeDefined();
    });

    it("should create with custom config", () => {
      const customManager = createEmbeddingStateManager({
        maxHistorySize: 50,
        cacheTTL: 120000,
      });
      const config = customManager.getConfig();
      expect(config.maxHistorySize).toBe(50);
      expect(config.cacheTTL).toBe(120000);
    });
  });

  describe("Embedding Creation", () => {
    it("should create embedding from array", () => {
      const values = [1, 2, 3, 4, 5];
      const embedding = manager.createEmbedding(values, "x-encoder");

      expect(embedding.values).toEqual(new Float32Array(values));
      expect(embedding.dimension).toBe(5);
      expect(embedding.source).toBe("x-encoder");
      expect(embedding.isNormalized).toBe(false);
    });

    it("should create embedding from Float32Array", () => {
      const values = new Float32Array([1, 2, 3]);
      const embedding = manager.createEmbedding(values, "y-encoder");

      expect(embedding.values).toEqual(values);
      expect(embedding.dimension).toBe(3);
    });

    it("should create normalized embedding", () => {
      const values = [3, 4];
      const embedding = manager.createNormalizedEmbedding(values, "predictor");

      expect(embedding.isNormalized).toBe(true);

      const norm = Math.sqrt(
        embedding.values[0] ** 2 + embedding.values[1] ** 2
      );
      expect(norm).toBeCloseTo(1, 5);
    });

    it("should handle model version", () => {
      const embedding = manager.createEmbedding(
        [1, 2, 3],
        "x-encoder",
        "1.0.0"
      );

      expect(embedding.modelVersion).toBe("1.0.0");
    });
  });

  describe("Embedding Fusion", () => {
    it("should fuse two embeddings with equal weights", () => {
      const a = manager.createEmbedding([2, 4, 6], "x-encoder");
      const b = manager.createEmbedding([4, 6, 8], "y-encoder");

      const fused = manager.fuseEmbeddings([
        { embedding: a, weight: 1 },
        { embedding: b, weight: 1 },
      ]);

      expect(fused.values[0]).toBeCloseTo(3, 1);
      expect(fused.values[1]).toBeCloseTo(5, 1);
      expect(fused.isNormalized).toBe(true);
    });

    it("should fuse with custom weights", () => {
      const a = manager.createEmbedding([10, 10], "x-encoder");
      const b = manager.createEmbedding([0, 0], "y-encoder");

      const fused = manager.fuseEmbeddings([
        { embedding: a, weight: 0.7 },
        { embedding: b, weight: 0.3 },
      ]);

      expect(fused.values[0]).toBeCloseTo(7, 1);
    });

    it("should fuse visual and intent", () => {
      const visual = manager.createEmbedding([1, 2], "x-encoder");
      const intent = manager.createEmbedding([3, 4], "y-encoder");

      const fused = manager.fuseVisualIntent(visual, intent);

      expect(fused.values.length).toBe(2);
      expect(fused.source).toBe("fusion");
    });

    it("should throw on dimension mismatch", () => {
      const a = manager.createEmbedding([1, 2], "x-encoder");
      const b = manager.createEmbedding([1, 2, 3], "y-encoder");

      expect(() =>
        manager.fuseEmbeddings([
          { embedding: a, weight: 1 },
          { embedding: b, weight: 1 },
        ])
      ).toThrow();
    });

    it("should throw on empty embeddings array", () => {
      expect(() => manager.fuseEmbeddings([])).toThrow();
    });

    it("should update fusion weights", () => {
      manager.updateFusionWeights({ visual: 0.8, intent: 0.2 });

      const config = manager.getConfig();
      expect(config.fusionWeights.visual).toBe(0.8);
      expect(config.fusionWeights.intent).toBe(0.2);
    });

    it("should normalize fusion weights", () => {
      manager.updateFusionWeights({ visual: 5, intent: 5 });

      const config = manager.getConfig();
      expect(
        config.fusionWeights.visual + config.fusionWeights.intent
      ).toBeCloseTo(1, 5);
    });
  });

  describe("Similarity Computation", () => {
    it("should compute cosine similarity", () => {
      const a = manager.createEmbedding([1, 0, 0], "x-encoder");
      const b = manager.createEmbedding([1, 0, 0], "y-encoder");

      const similarity = manager.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it("should compute cosine similarity for different vectors", () => {
      const a = manager.createEmbedding([1, 0], "x-encoder");
      const b = manager.createEmbedding([0, 1], "y-encoder");

      const similarity = manager.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it("should compute similarity matrix", () => {
      const visual = manager.createEmbedding([1, 0], "x-encoder");
      const intent = manager.createEmbedding([0, 1], "y-encoder");
      const goal = manager.createEmbedding([1, 1], "predictor");

      // Normalize goal
      goal.values = manager.normalize(goal.values);

      const matrix = manager.similarityMatrix(visual, intent, goal);

      expect(matrix.visualIntent).toBeDefined();
      expect(matrix.visualGoal).toBeDefined();
      expect(matrix.intentGoal).toBeDefined();
      expect(matrix.coherence).toBeDefined();
    });

    it("should cache similarity results", () => {
      const a = manager.createEmbedding([1, 2], "x-encoder");
      const b = manager.createEmbedding([1, 2], "y-encoder");

      const sim1 = manager.cosineSimilarity(a, b);
      const sim2 = manager.cosineSimilarity(a, b);

      expect(sim1).toBe(sim2);
    });

    it("should compute Euclidean distance", () => {
      const a = manager.createEmbedding([0, 0], "x-encoder");
      const b = manager.createEmbedding([3, 4], "y-encoder");

      const distance = manager.euclideanDistance(a, b);

      expect(distance).toBeCloseTo(5, 5);
    });

    it("should compute Manhattan distance", () => {
      const a = manager.createEmbedding([0, 0], "x-encoder");
      const b = manager.createEmbedding([3, 4], "y-encoder");

      const distance = manager.manhattanDistance(a, b);

      expect(distance).toBe(7);
    });

    it("should throw on dimension mismatch for similarity", () => {
      const a = manager.createEmbedding([1, 2], "x-encoder");
      const b = manager.createEmbedding([1, 2, 3], "y-encoder");

      expect(() => manager.cosineSimilarity(a, b)).toThrow();
    });
  });

  describe("Normalization", () => {
    it("should normalize vector", () => {
      const vec = new Float32Array([3, 4]);
      const normalized = manager.normalize(vec);

      const norm = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
      expect(norm).toBeCloseTo(1, 5);
    });

    it("should handle zero vector", () => {
      const vec = new Float32Array([0, 0, 0]);
      const normalized = manager.normalize(vec);

      expect(normalized).toEqual(vec);
    });

    it("should normalize embedding vector", () => {
      const embedding = manager.createEmbedding([5, 12], "x-encoder");
      const normalized = manager.normalizeVector(embedding);

      expect(normalized.isNormalized).toBe(true);

      const norm = Math.sqrt(
        normalized.values[0] ** 2 + normalized.values[1] ** 2
      );
      expect(norm).toBeCloseTo(1, 5);
    });
  });

  describe("History Tracking", () => {
    it("should add entry to history", () => {
      const visual = manager.createEmbedding([1], "x-encoder");
      const intent = manager.createEmbedding([2], "y-encoder");
      const goal = manager.createEmbedding([3], "predictor");
      const fused = manager.createEmbedding([2.5], "fusion");

      const id = manager.addToHistory(visual, intent, goal, fused, 3);

      expect(id).toBeDefined();
      expect(manager.getHistoryEntry(id)).toBeDefined();
    });

    it("should limit history size", () => {
      for (let i = 0; i < 20; i++) {
        manager.addToHistory(
          manager.createEmbedding([i], "x-encoder"),
          manager.createEmbedding([i], "y-encoder"),
          manager.createEmbedding([i], "predictor"),
          manager.createEmbedding([i], "fusion"),
          1
        );
      }

      const history = manager.getAllHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it("should get history entry", () => {
      const visual = manager.createEmbedding([1], "x-encoder");
      const intent = manager.createEmbedding([2], "y-encoder");
      const goal = manager.createEmbedding([3], "predictor");
      const fused = manager.createEmbedding([2.5], "fusion");

      const id = manager.addToHistory(visual, intent, goal, fused, 0);

      const entry = manager.getHistoryEntry(id);

      expect(entry).toBeDefined();
      expect(entry!.actionCount).toBe(0);
    });

    it("should get recent history", () => {
      for (let i = 0; i < 5; i++) {
        manager.addToHistory(
          manager.createEmbedding([i], "x-encoder"),
          manager.createEmbedding([i], "y-encoder"),
          manager.createEmbedding([i], "predictor"),
          manager.createEmbedding([i], "fusion"),
          i
        );
      }

      const recent = manager.getRecentHistory(3);

      expect(recent.length).toBe(3);
    });

    it("should clear history", () => {
      manager.addToHistory(
        manager.createEmbedding([1], "x-encoder"),
        manager.createEmbedding([2], "y-encoder"),
        manager.createEmbedding([3], "predictor"),
        manager.createEmbedding([4], "fusion"),
        1
      );

      manager.clearHistory();

      expect(manager.getAllHistory().length).toBe(0);
    });

    it("should update history result", () => {
      const visual = manager.createEmbedding([1], "x-encoder");
      const intent = manager.createEmbedding([2], "y-encoder");
      const goal = manager.createEmbedding([3], "predictor");
      const fused = manager.createEmbedding([2.5], "fusion");

      const id = manager.addToHistory(visual, intent, goal, fused, 1);

      manager.updateHistoryResult(id, "approve");

      const entry = manager.getHistoryEntry(id);
      expect(entry!.result).toBe("approve");
    });

    it("should return null for non-existent entry", () => {
      const entry = manager.getHistoryEntry("nonexistent");
      expect(entry).toBeNull();
    });
  });

  describe("Cache Management", () => {
    it("should clear expired cache", () => {
      // Cache some similarities
      const a = manager.createEmbedding([1, 2], "x-encoder");
      const b = manager.createEmbedding([3, 4], "y-encoder");
      manager.cosineSimilarity(a, b);

      // Clear expired (none should be expired immediately)
      manager.clearExpiredCache();

      const stats = manager.getStats();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });

    it("should clear all cache", () => {
      const a = manager.createEmbedding([1, 2], "x-encoder");
      const b = manager.createEmbedding([3, 4], "y-encoder");
      manager.cosineSimilarity(a, b);

      manager.clearCache();

      const stats = manager.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should get stats", () => {
      manager.addToHistory(
        manager.createEmbedding([1], "x-encoder"),
        manager.createEmbedding([1], "y-encoder"),
        manager.createEmbedding([1], "predictor"),
        manager.createEmbedding([1], "fusion"),
        1
      );

      const stats = manager.getStats();

      expect(stats.historySize).toBe(1);
      expect(stats.avgCoherence).toBeDefined();
    });

    it("should handle empty history for stats", () => {
      const manager = createEmbeddingStateManager();
      const stats = manager.getStats();

      expect(stats.historySize).toBe(0);
      expect(stats.avgCoherence).toBe(0);
    });
  });
});
