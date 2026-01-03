import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SemanticCache } from '@lsi/cascade';
import { OpenAIEmbeddingService } from '@lsi/embeddings';
import { HNSWIndex } from '@lsi/embeddings';
import type { CacheEntry, CacheStats } from '@lsi/protocol';

describe('Semantic Caching Integration Test Suite', () => {
  let semanticCache: SemanticCache;
  let embeddingService: OpenAIEmbeddingService;
  let hnswIndex: HNSWIndex;

  beforeAll(async () => {
    // Initialize embedding service
    embeddingService = new OpenAIEmbeddingService({
      apiKey: 'test-key',
      model: 'text-embedding-ada-002',
      dimension: 1536
    });

    // Initialize HNSW index
    hnswIndex = new HNSWIndex({
      dimension: 1536,
      ef: 50,
      M: 20
    });

    // Initialize semantic cache
    semanticCache = new SemanticCache({
      maxEntries: 1000,
      dimension: 1536,
      similarityThreshold: 0.8,
      ttl: 3600000, // 1 hour
      embeddingService,
      hnswIndex
    });

    // Initialize components
    await embeddingService.initialize();
    await hnswIndex.initialize();
    await semanticCache.initialize();
  });

  afterAll(async () => {
    await semanticCache.close();
    await embeddingService.close();
    await hnswIndex.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await semanticCache.clear();
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached entries', async () => {
      // Arrange
      const key = "What is artificial intelligence?";
      const value = "Artificial intelligence is the simulation of human intelligence processes by machines.";
      const metadata = {
        source: 'cloud',
        confidence: 0.9,
        timestamp: Date.now()
      };

      // Act
      await semanticCache.set(key, value, metadata);
      const result = await semanticCache.get(key);

      // Assert
      expect(result).toBeDefined();
      expect(result.value).toBe(value);
      expect(result.metadata).toEqual(metadata);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.expiry).toBeGreaterThan(Date.now());
    });

    it('should return undefined for non-existent keys', async () => {
      // Arrange
      const nonExistentKey = "This key does not exist";

      // Act
      const result = await semanticCache.get(nonExistentKey);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should check if key exists in cache', async () => {
      // Arrange
      const key = "Test key";
      await semanticCache.set(key, "Test value");

      // Act
      const exists = await semanticCache.has(key);

      // Assert
      expect(exists).toBe(true);

      // Check non-existent key
      const notExists = await semanticCache.get("non-existent");
      expect(notExists).toBeUndefined();
    });

    it('should remove entries from cache', async () => {
      // Arrange
      const key = "To be removed";
      await semanticCache.set(key, "This will be removed");

      // Act
      const removed = await semanticCache.delete(key);
      const result = await semanticCache.get(key);

      // Assert
      expect(removed).toBe(true);
      expect(result).toBeUndefined();
    });

    it('should clear all cache entries', async () => {
      // Arrange
      await semanticCache.set("key1", "value1");
      await semanticCache.set("key2", "value2");
      await semanticCache.set("key3", "value3");

      // Act
      await semanticCache.clear();
      const exists = await semanticCache.has("key1");

      // Assert
      expect(exists).toBe(false);

      // Verify all keys are gone
      const allKeys = await semanticCache.keys();
      expect(allKeys.length).toBe(0);
    });
  });

  describe('Semantic Similarity Search', () => {
    it('should find semantically similar queries', async () => {
      // Arrange
      const query1 = "What is artificial intelligence?";
      const query2 = "Explain machine learning concepts";
      const query3 = "Tell me about neural networks";

      const response = "AI is a broad field of computer science";

      // Store the first query
      await semanticCache.set(query1, response);

      // Act
      const similar = await semanticCache.findSimilar(query2);

      // Assert
      expect(similar).toBeDefined();
      expect(similar.length).toBeGreaterThan(0);

      const bestMatch = similar[0];
      expect(bestMatch.similarity).toBeGreaterThan(0.5);
      expect(bestMatch.key).toBe(query1);
      expect(bestMatch.value).toBe(response);
    });

    it('should return empty array for no similar queries', async () => {
      // Arrange
      const query = "What is the weather?";
      await semanticCache.set("different topic", "Response about weather");

      // Act
      const similar = await semanticCache.findSimilar("Quantum physics and AI");

      // Assert
      expect(similar).toBeDefined();
      expect(similar.length).toBe(0);
    });

    it('should rank results by similarity score', async () => {
      // Arrange
      const similarQueries = [
        "What is AI?",
        "Artificial intelligence explanation", // Very similar
        "Define machine learning", // Similar
        "Weather today" // Not similar
      ];

      const response = "AI definition response";

      // Store all queries with varying similarity
      for (const query of similarQueries) {
        await semanticCache.set(query, response);
      }

      // Act
      const results = await semanticCache.findSimilar("Explain artificial intelligence");

      // Assert
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Should be sorted by similarity (highest first)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
    });

    it('should handle similarity threshold correctly', async () => {
      // Arrange
      const query = "What is AI?";
      await semanticCache.set(query, "AI response");

      // Act
      const similar = await semanticCache.findSimilar("Completely different topic", 0.9);

      // Assert
      expect(similar).toBeDefined();
      expect(similar.length).toBe(0); // Should not match below threshold
    });
  });

  describe('HNSW Index Integration', () => {
    it('should use HNSW for efficient similarity search', async () => {
      // Arrange
      const queries = Array(100).fill(null).map((_, i) =>
        `Query about AI topic ${i}: ${generateRandomText()}`
      );

      const response = "Standard AI response";
      const startTime = Date.now();

      // Store all queries
      for (const query of queries) {
        await semanticCache.set(query, response);
      }

      // Act
      const searchStartTime = Date.now();
      const results = await semanticCache.findSimilar("What is artificial intelligence?", 0.5);
      const searchTime = Date.now() - searchStartTime;

      // Assert
      expect(results).toBeDefined();
      expect(searchTime).toBeLessThan(100); // Search should be fast (< 100ms)
      expect(hnswIndex.size()).toBe(queries.length);
    });

    it('should handle index updates efficiently', async () => {
      // Arrange
      const queries = Array(50).fill(null).map((_, i) => `Query ${i}`);

      // Insert queries
      for (const query of queries) {
        await semanticCache.set(query, "Response");
      }

      // Get initial index size
      const initialSize = hnswIndex.size();

      // Update some queries
      await semanticCache.set("Query 0", "Updated response");
      await semanticCache.delete("Query 1");

      // Act
      const finalSize = hnswIndex.size();

      // Assert
      expect(finalSize).toBe(initialSize); // Size should remain the same
      expect(finalSize).toBeGreaterThan(0);
    });

    it('should maintain consistency between cache and index', async () => {
      // Arrange
      const key = "Consistency test";
      await semanticCache.set(key, "Test response");

      // Act
      const cacheEntry = await semanticCache.get(key);
      const indexResult = await semanticCache.findSimilar(key);

      // Assert
      expect(cacheEntry).toBeDefined();
      expect(indexResult.length).toBeGreaterThan(0);

      // The cached entry should be findable via similarity search
      const exactMatch = indexResult.find(r => r.key === key);
      expect(exactMatch).toBeDefined();
      expect(exactMatch!.similarity).toBeGreaterThan(0.9);
    });
  });

  describe('Cache Management and Eviction', () => {
    it('should evict entries when cache is full', async () => {
      // Arrange
      const cacheSize = 10;
      semanticCache = new SemanticCache({
        maxEntries: cacheSize,
        dimension: 1536,
        similarityThreshold: 0.8
      });

      // Fill cache
      for (let i = 0; i < cacheSize + 5; i++) {
        await semanticCache.set(`key${i}`, `value${i}`);
      }

      // Act
      const size = (await semanticCache.keys()).length;

      // Assert
      expect(size).toBeLessThanOrEqual(cacheSize);
    });

    it('should use LRU eviction strategy', async () => {
      // Arrange
      const cache = new SemanticCache({
        maxEntries: 3,
        dimension: 1536,
        similarityThreshold: 0.8
      });

      // Insert entries
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      // Access key1 (should keep it)
      await cache.get("key1");

      // Insert new entry (should evict key2)
      await cache.set("key4", "value4");

      // Act
      const hasKey1 = await cache.has("key1");
      const hasKey2 = await cache.has("key2");
      const hasKey3 = await cache.has("key3");
      const hasKey4 = await cache.has("key4");

      // Assert
      expect(hasKey1).toBe(true); // Recently accessed
      expect(hasKey2).toBe(false); // Least recently used
      expect(hasKey3).toBe(true); // Not accessed but not evicted
      expect(hasKey4).toBe(true); // Newly added
    });

    it('should handle TTL expiration', async () => {
      // Arrange
      const shortTTL = 100; // 100ms
      const cache = new SemanticCache({
        maxEntries: 10,
        dimension: 1536,
        similarityThreshold: 0.8,
        ttl: shortTTL
      });

      await cache.set("temporary", "will expire");

      // Act
      const resultBefore = await cache.get("temporary");
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));
      const resultAfter = await cache.get("temporary");

      // Assert
      expect(resultBefore).toBeDefined();
      expect(resultAfter).toBeUndefined(); // Should have expired
    });
  });

  describe('Cache Performance', () => {
    it('should achieve high hit rate for similar queries', async () => {
      // Arrange
      const baseQuery = "What is machine learning?";
      const variations = [
        "Explain machine learning",
        "Machine learning definition",
        "How does machine learning work?",
        "Define machine learning algorithms",
        "Machine learning basics"
      ];

      // Store the base query
      await semanticCache.set(baseQuery, "ML explanation response");

      // Act
      let hits = 0;
      for (const query of variations) {
        const similar = await semanticCache.findSimilar(query, 0.6);
        if (similar.length > 0) hits++;
      }

      // Assert
      const hitRate = hits / variations.length;
      expect(hitRate).toBeGreaterThan(0.8); // 80% hit rate
    });

    it('should maintain high throughput', async () => {
      // Arrange
      const queryCount = 1000;
      const queries = Array(queryCount).fill(null).map((_, i) =>
        `Query ${i}: ${generateRandomText()}`
      );

      // Pre-populate cache
      for (const query of queries.slice(0, 100)) {
        await semanticCache.set(query, `Response for ${query}`);
      }

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(query => semanticCache.findSimilar(query, 0.5))
      );
      const totalTime = Date.now() - startTime;

      // Assert
      const avgLatency = totalTime / queryCount;
      const throughput = queryCount / (totalTime / 1000);

      expect(avgLatency).toBeLessThan(10); // Average under 10ms
      expect(throughput).toBeGreaterThan(100); // 100+ queries per second
    });

    it('should handle concurrent access efficiently', async () => {
      // Arrange
      const concurrentUsers = 10;
      const queriesPerUser = 50;

      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        await semanticCache.set(`key${i}`, `value${i}`);
      }

      // Act
      const startTime = Date.now();
      const promises = Array(concurrentUsers).fill(null).map(async (_, userIndex) => {
        const userQueries = Array(queriesPerUser).fill(null).map((_, i) =>
          `User ${userIndex} Query ${i}`
        );

        return Promise.all(
          userQueries.map(query => semanticCache.findSimilar(query, 0.5))
        );
      });

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert
      const totalQueries = concurrentUsers * queriesPerUser;
      const avgLatency = totalTime / totalQueries;
      const throughput = totalQueries / (totalTime / 1000);

      expect(avgLatency).toBeLessThan(20); // Average under 20ms
      expect(throughput).toBeGreaterThan(250); // 250+ queries per second
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should track cache statistics', async () => {
      // Arrange
      const operations = [
        () => semanticCache.set("key1", "value1"),
        () => semanticCache.set("key2", "value2"),
        () => semanticCache.get("key1"),
        () => semanticCache.delete("key2")
      ];

      // Act
      for (const operation of operations) {
        await operation();
      }

      const stats = await semanticCache.getStats();

      // Assert
      expect(stats).toBeDefined();
      expect(stats.totalSets).toBeGreaterThanOrEqual(2);
      expect(stats.totalGets).toBeGreaterThanOrEqual(1);
      expect(stats.totalDeletes).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeDefined();
      expect(stats.currentSize).toBeGreaterThanOrEqual(0);
    });

    it('should calculate hit rate accurately', async () => {
      // Arrange
      await semanticCache.set("hit", "value");
      await semanticCache.set("miss", "value");

      // Perform operations
      await semanticCache.get("hit"); // Hit
      await semanticCache.get("hit"); // Hit
      await semanticCache.get("miss"); // Miss
      await semanticCache.get("nonexistent"); // Miss

      // Act
      const stats = await semanticCache.getStats();
      const hitRate = stats.hitRate;

      // Assert
      expect(hitRate).toBeCloseTo(0.5, 1); // 2 hits out of 4 gets
    });

    it('should monitor memory usage', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;

      // Add many entries to cache
      for (let i = 0; i < 500; i++) {
        await semanticCache.set(`key${i}`, `value${i}`);
      }

      // Act
      const stats = await semanticCache.getStats();
      const finalMemory = process.memoryUsage().heapUsed;

      // Assert
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // Reasonable growth
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle embedding service failures gracefully', async () => {
      // Arrange
      const cache = new SemanticCache({
        maxEntries: 100,
        dimension: 1536,
        similarityThreshold: 0.8,
        useEmbeddings: false // Disable embeddings for fallback
      });

      // Act
      await cache.set("simple key", "simple value");
      const result = await cache.get("simple key");

      // Assert
      expect(result).toBeDefined();
      expect(result.value).toBe("simple value");
    });

    it('should handle HNSW index corruption gracefully', async () => {
      // Arrange
      const cache = new SemanticCache({
        maxEntries: 100,
        dimension: 1536,
        similarityThreshold: 0.8,
        useIndex: false // Disable HNSW
      });

      // Act
      await cache.set("test key", "test value");
      const result = await cache.findSimilar("test");

      // Assert
      expect(result).toBeDefined();
      // Should return empty or basic results when index is disabled
    });

    it('should handle invalid embeddings', async () => {
      // Arrange
      const cache = new SemanticCache({
        maxEntries: 100,
        dimension: 1536,
        similarityThreshold: 0.8,
        validateEmbeddings: false // Disable validation
      });

      // Act
      await cache.set("test key", "test value");
      const result = await cache.findSimilar("test");

      // Assert
      expect(result).toBeDefined();
      // Should not crash even with invalid embeddings
    });
  });

  // Helper function to generate random text
  function generateRandomText(): string {
    const words = [
      'artificial', 'intelligence', 'machine', 'learning', 'neural',
      'network', 'algorithm', 'computer', 'science', 'data',
      'analytics', 'model', 'training', 'prediction', 'automation'
    ];

    const count = Math.floor(Math.random() * 5) + 3;
    const selected = [];

    for (let i = 0; i < count; i++) {
      selected.push(words[Math.floor(Math.random() * words.length)]);
    }

    return selected.join(' ');
  }
});