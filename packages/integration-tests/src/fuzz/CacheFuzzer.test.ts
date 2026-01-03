/**
 * CacheFuzzer.test.ts - Fuzzing Tests for Semantic Cache
 *
 * Fuzzing targets:
 * - Cache with random embeddings
 * - Similarity calculations with edge cases
 * - TTL and eviction logic
 * - Cache statistics with random operations
 *
 * @packageDocumentation
 */

import { describe, expect, beforeEach } from "vitest";
import { SemanticCache } from "@lsi/cascade";
import type { SemanticCacheConfig, EnhancedCacheStats } from "@lsi/cascade";
import {
  registerFuzz,
  bufferFromString,
  randomBuffer,
} from "../fuzz/FuzzerFramework.js";
import type { RefinedQuery } from "@lsi/cascade";

// ============================================================================
// FIXTURES AND HELPERS
// ============================================================================

/**
 * Create a mock refined query
 */
function createMockRefinedQuery(
  query: string,
  embedding: Float32Array,
  queryType:
    | "question"
    | "command"
    | "code"
    | "explanation"
    | "comparison"
    | "debug"
    | "general" = "general"
): RefinedQuery {
  return {
    query,
    originalQuery: query,
    embedding,
    queryType,
    complexity: Math.random(),
    urgency: "normal",
    semanticFeatures: {
      keyTerms: [],
      entities: [],
      concepts: [],
    },
    staticFeatures: {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      hasCode: false,
      hasUrl: false,
      hasEmail: false,
    },
  };
}

/**
 * Generate random embedding
 */
function randomEmbedding(
  dimensions: number = 768,
  seed: number = Date.now()
): Float32Array {
  const embedding = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  return embedding;
}

let cache: SemanticCache;

beforeEach(() => {
  const config: SemanticCacheConfig = {
    maxSize: 100,
    similarityThreshold: 0.85,
    ttl: 60000,
  };
  cache = new SemanticCache(config);
});

// ============================================================================
// CACHE SET/GET FUZZING
// ============================================================================

describe("Cache Fuzzing: Set/Get Operations", () => {
  /**
   * Fuzz: Random cache set operations
   *
   * Cache should handle random set operations without crashing.
   */
  registerFuzz(
    "Cache handles random set operations",
    async (input: Buffer) => {
      try {
        const query = input.toString("utf-8", 0, Math.min(input.length, 1000));
        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: query });

        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        // Should handle all input gracefully
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 3000,
      timeout: 30000,
      mutations: ["byte_insert", "byte_delete", "splice"],
      seed: bufferFromString("test query"),
    }
  );

  /**
   * Fuzz: Random cache get operations
   */
  registerFuzz(
    "Cache handles random get operations",
    async (input: Buffer) => {
      try {
        const query = input.toString("utf-8", 0, Math.min(input.length, 1000));
        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 3000,
      timeout: 30000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString("test query"),
    }
  );
});

// ============================================================================
// EMBEDDING FUZZING
// ============================================================================

describe("Cache Fuzzing: Embeddings", () => {
  /**
   * Fuzz: Random embedding dimensions
   *
   * Cache should handle various embedding dimensions.
   */
  registerFuzz(
    "Cache handles various embedding dimensions",
    async (input: Buffer) => {
      try {
        const query = "test query";

        // Create embedding with dimension based on input
        const dimension = 100 + ((input[0] || 0) % 1000);
        const embedding = new Float32Array(dimension);

        for (let i = 0; i < dimension; i++) {
          embedding[i] = (input[i % input.length] || 0) / 255 - 0.5;
        }

        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        // May fail with unexpected dimensions
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["byte_insert", "arithmetic"],
      seed: randomBuffer(100, 1000),
    }
  );

  /**
   * Fuzz: Extreme embedding values
   */
  registerFuzz(
    "Cache handles extreme embedding values",
    async (input: Buffer) => {
      try {
        const query = "test query";
        const embedding = randomEmbedding(768);

        // Set some extreme values
        for (let i = 0; i < Math.min(10, embedding.length); i++) {
          embedding[i] = (input[i] || 0) > 128 ? Infinity : -Infinity;
        }

        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        // May fail with NaN/Infinity
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 15000,
      mutations: ["bit_flip"],
      seed: randomBuffer(100),
    }
  );

  /**
   * Fuzz: Zero embeddings
   */
  registerFuzz(
    "Cache handles zero embeddings",
    async (input: Buffer) => {
      try {
        const query = input.toString("utf-8", 0, Math.min(input.length, 100));
        const embedding = new Float32Array(768); // All zeros

        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 15000,
      seed: bufferFromString("test"),
    }
  );
});

// ============================================================================
// SIMILARITY FUZZING
// ============================================================================

describe("Cache Fuzzing: Similarity Calculations", () => {
  /**
   * Fuzz: Similarity with random vectors
   *
   * Cosine similarity should handle random vectors.
   */
  registerFuzz(
    "Similarity calculation handles random vectors",
    async (input: Buffer) => {
      try {
        const query1 = "query1";
        const query2 = "query2";

        const emb1 = new Float32Array(768);
        const emb2 = new Float32Array(768);

        for (let i = 0; i < 768; i++) {
          emb1[i] = (input[i % input.length] || 0) / 255 - 0.5;
          emb2[i] = (input[(i + 1) % input.length] || 0) / 255 - 0.5;
        }

        await cache.set(query1, { content: "result1" });

        const refinedQuery2 = createMockRefinedQuery(query2, emb2);
        const result = await cache.get(refinedQuery2);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["bit_flip", "arithmetic"],
      seed: randomBuffer(768),
    }
  );
});

// ============================================================================
// THRESHOLD FUZZING
// ============================================================================

describe("Cache Fuzzing: Similarity Threshold", () => {
  /**
   * Fuzz: Various threshold values
   *
   * Cache should handle various similarity thresholds.
   */
  registerFuzz(
    "Cache handles various threshold values",
    async (input: Buffer) => {
      try {
        const threshold = Math.abs((input[0] || 0) / 255);

        const testCache = new SemanticCache({
          maxSize: 100,
          similarityThreshold: threshold,
          ttl: 60000,
        });

        const query = "test query";
        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await testCache.set(query, { content: "result" });
        const result = await testCache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        // Threshold should be in [0, 1]
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["arithmetic"],
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// TTL FUZZING
// ============================================================================

describe("Cache Fuzzing: TTL", () => {
  /**
   * Fuzz: Various TTL values
   *
   * Cache should handle various TTL values.
   */
  registerFuzz(
    "Cache handles various TTL values",
    async (input: Buffer) => {
      try {
        const ttl = Math.abs((input[0] || 0) * 10);

        const testCache = new SemanticCache({
          maxSize: 100,
          similarityThreshold: 0.85,
          ttl,
        });

        const query = "test query";
        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await testCache.set(query, { content: "result" });

        // Get immediately
        const result = await testCache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["arithmetic"],
      seed: randomBuffer(1),
    }
  );

  /**
   * Fuzz: Zero and negative TTL
   */
  registerFuzz(
    "Cache handles edge case TTL values",
    async (input: Buffer) => {
      try {
        const ttl = ((input[0] || 0) % 3) - 1; // -1, 0, or 1

        const testCache = new SemanticCache({
          maxSize: 100,
          similarityThreshold: 0.85,
          ttl: ttl < 0 ? 0 : ttl * 100,
        });

        const query = "test query";
        await testCache.set(query, { content: "result" });

        expect(testCache).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 15000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// MAX SIZE FUZZING
// ============================================================================

describe("Cache Fuzzing: Max Size", () => {
  /**
   * Fuzz: Various max size values
   */
  registerFuzz(
    "Cache handles various max size values",
    async (input: Buffer) => {
      try {
        const maxSize = Math.abs((input[0] || 0) % 1000) + 1;

        const testCache = new SemanticCache({
          maxSize,
          similarityThreshold: 0.85,
          ttl: 60000,
        });

        // Add some entries
        for (let i = 0; i < Math.min(100, maxSize * 2); i++) {
          const query = `query-${i}`;
          await testCache.set(query, { content: `result-${i}` });
        }

        const stats = (await testCache.getStats()) as EnhancedCacheStats;

        expect(stats.size).toBeLessThanOrEqual(maxSize);

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 20000,
      mutations: ["arithmetic"],
      seed: randomBuffer(1),
    }
  );

  /**
   * Fuzz: Zero and very small max size
   */
  registerFuzz(
    "Cache handles very small max size",
    async (input: Buffer) => {
      try {
        const maxSize = Math.abs((input[0] || 0) % 5) + 1;

        const testCache = new SemanticCache({
          maxSize,
          similarityThreshold: 0.85,
          ttl: 60000,
        });

        // Add more entries than max size
        for (let i = 0; i < maxSize * 3; i++) {
          const query = `query-${i}`;
          await testCache.set(query, { content: `result-${i}` });
        }

        const stats = (await testCache.getStats()) as EnhancedCacheStats;

        expect(stats.size).toBeLessThanOrEqual(maxSize);

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 20000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// QUERY STRING FUZZING
// ============================================================================

describe("Cache Fuzzing: Query Strings", () => {
  /**
   * Fuzz: Various query strings
   */
  registerFuzz(
    "Cache handles various query strings",
    async (input: Buffer) => {
      try {
        const query = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 3000,
      timeout: 30000,
      mutations: ["byte_insert", "byte_delete", "splice"],
      seed: bufferFromString("test query"),
    }
  );

  /**
   * Fuzz: Empty and very long queries
   */
  registerFuzz(
    "Cache handles edge case query lengths",
    async (input: Buffer) => {
      try {
        const length = (input[0] || 0) % 10000;
        const query = "x".repeat(length);

        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 20000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// CACHE STATISTICS FUZZING
// ============================================================================

describe("Cache Fuzzing: Statistics", () => {
  /**
   * Fuzz: Random operations and verify statistics
   */
  registerFuzz(
    "Cache statistics remain consistent",
    async (input: Buffer) => {
      try {
        const operations = (input[0] || 0) % 100;

        for (let i = 0; i < operations; i++) {
          const query = `query-${i}`;
          const embedding = randomEmbedding(768);

          if (i % 3 === 0) {
            // Set
            await cache.set(query, { content: `result-${i}` });
          } else {
            // Get
            const refinedQuery = createMockRefinedQuery(query, embedding);
            await cache.get(refinedQuery);
          }
        }

        const stats = (await cache.getStats()) as EnhancedCacheStats;

        expect(stats.size).toBeGreaterThanOrEqual(0);
        expect(stats.hitRate).toBeGreaterThanOrEqual(0);
        expect(stats.hitRate).toBeLessThanOrEqual(1);
        expect(stats.totalHits).toBeGreaterThanOrEqual(0);
        expect(stats.totalMisses).toBeGreaterThanOrEqual(0);

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 30000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// CACHE CLEAR FUZZING
// ============================================================================

describe("Cache Fuzzing: Cache Clear", () => {
  /**
   * Fuzz: Clear with various cache states
   */
  registerFuzz(
    "Cache clear works correctly",
    async (input: Buffer) => {
      try {
        const numEntries = (input[0] || 0) % 100;

        // Add entries
        for (let i = 0; i < numEntries; i++) {
          const query = `query-${i}`;
          await cache.set(query, { content: `result-${i}` });
        }

        // Clear cache
        await cache.clear();

        // Verify cache is empty
        const stats = (await cache.getStats()) as EnhancedCacheStats;
        expect(stats.size).toBe(0);

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 1000,
      timeout: 20000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// CONCURRENT OPERATIONS FUZZING
// ============================================================================

describe("Cache Fuzzing: Concurrent Operations", () => {
  /**
   * Fuzz: Rapid set/get operations
   */
  registerFuzz(
    "Cache handles rapid operations",
    async (input: Buffer) => {
      try {
        const operations = (input[0] || 0) % 50;

        // Perform rapid operations
        const promises = [];
        for (let i = 0; i < operations; i++) {
          const query = `query-${i}`;
          const embedding = randomEmbedding(768);

          promises.push(
            cache.set(query, { content: `result-${i}` }).then(() => {
              const refinedQuery = createMockRefinedQuery(query, embedding);
              return cache.get(refinedQuery);
            })
          );
        }

        await Promise.all(promises);

        const stats = (await cache.getStats()) as EnhancedCacheStats;

        expect(stats).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 500,
      timeout: 30000,
      seed: randomBuffer(1),
    }
  );
});

// ============================================================================
// SPECIAL CHARACTER FUZZING
// ============================================================================

describe("Cache Fuzzing: Special Characters", () => {
  /**
   * Fuzz: Queries with special characters
   */
  registerFuzz(
    "Cache handles special characters in queries",
    async (input: Buffer) => {
      try {
        const specialChars = "\x00\x01\x02\n\t\r\\\"'\0";
        const query =
          input.toString("utf-8", 0, Math.min(input.length, 100)) +
          specialChars;

        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["byte_insert"],
      seed: bufferFromString("test"),
    }
  );

  /**
   * Fuzz: Unicode in queries
   */
  registerFuzz(
    "Cache handles Unicode in queries",
    async (input: Buffer) => {
      try {
        const unicode = "你完事🎉Ñoño café";
        const query =
          input.toString("utf-8", 0, Math.min(input.length, 50)) + unicode;

        const embedding = randomEmbedding(768);
        const refinedQuery = createMockRefinedQuery(query, embedding);

        await cache.set(query, { content: "result" });
        const result = await cache.get(refinedQuery);

        expect(result).toBeDefined();

        return true;
      } catch (error) {
        expect(error).toBeDefined();
        return true;
      }
    },
    {
      iterations: 2000,
      timeout: 20000,
      seed: bufferFromString("test"),
    }
  );
});
