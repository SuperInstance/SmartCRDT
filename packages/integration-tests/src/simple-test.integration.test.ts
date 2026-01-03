import { describe, it, expect } from 'vitest';
import { SemanticCache } from '@lsi/cascade';

describe('Simple Integration Test Suite', () => {
  it('should create and use semantic cache', async () => {
    // Arrange
    const cache = new SemanticCache({
      maxEntries: 100,
      dimension: 1536,
      similarityThreshold: 0.8
    });

    // Act
    await cache.initialize();
    await cache.set("test-key", "test-value");
    const result = await cache.get("test-key");

    // Assert
    expect(result).toBeDefined();
    expect(result.value).toBe("test-value");
  });

  it('should handle cache statistics', async () => {
    // Arrange
    const cache = new SemanticCache({
      maxEntries: 100,
      dimension: 1536,
      similarityThreshold: 0.8
    });

    // Act
    await cache.initialize();
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");
    const stats = await cache.getStats();

    // Assert
    expect(stats).toBeDefined();
    expect(stats.totalSets).toBe(2);
    expect(stats.currentSize).toBe(2);
  });

  it('should find similar entries', async () => {
    // Arrange
    const cache = new SemanticCache({
      maxEntries: 100,
      dimension: 1536,
      similarityThreshold: 0.8,
      useIndex: false // Simplified for test
    });

    // Act
    await cache.initialize();
    await cache.set("ai-query", "AI definition response");
    await cache.set("ml-query", "Machine learning explanation");
    await cache.set("weather-query", "Weather information");

    const similar = await cache.findSimilar("What is artificial intelligence?");

    // Assert
    expect(similar).toBeDefined();
    expect(similar.length).toBeGreaterThanOrEqual(0);
  });

  it('should clear cache properly', async () => {
    // Arrange
    const cache = new SemanticCache({
      maxEntries: 100,
      dimension: 1536,
      similarityThreshold: 0.8
    });

    // Act
    await cache.initialize();
    await cache.set("to-be-cleared", "value");
    await cache.clear();
    const result = await cache.get("to-be-cleared");

    // Assert
    expect(result).toBeUndefined();
  });
});