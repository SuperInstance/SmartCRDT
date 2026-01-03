/**
 * SemanticCache Benchmark Suite
 *
 * Measures performance of semantic caching operations:
 * - Cache hits (exact and semantic)
 * - Cache misses
 * - Similarity search
 * - Cache operations (set, get, eviction)
 */

import { describe, bench } from 'vitest';
import { SemanticCache } from '../src/refiner/SemanticCache.js';
import type { RefinedQuery, QueryType } from '../src/types.js';

/**
 * Create a mock refined query for testing
 */
function createMockRefinedQuery(
  query: string,
  queryType: QueryType = 'question',
  embedding?: number[]
): RefinedQuery {
  // Generate a fake embedding if not provided
  // In production, this would come from an actual embedding model
  const mockEmbedding = embedding || Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

  return {
    original: query,
    normalized: query.toLowerCase().trim(),
    staticFeatures: {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      queryType,
      complexity: 0.5,
      hasCode: false,
      hasSQL: false,
      hasUrl: false,
      hasEmail: false,
      questionMark: query.includes('?'),
      exclamationCount: (query.match(/!/g) || []).length,
      ellipsisCount: (query.match(/\.\.\./g) || []).length,
      capitalizationRatio: (query.match(/[A-Z]/g) || []).length / query.length,
      punctuationDensity: (query.match(/[.,;:!]/g) || []).length / query.split(/\s+/).length,
      technicalTerms: [],
      domainKeywords: [],
    },
    semanticFeatures: {
      embedding: mockEmbedding,
      embeddingDim: mockEmbedding.length,
      similarQueries: [],
      cluster: null,
      semanticComplexity: 0.5,
    },
    cacheKey: `${queryType}:${query.toLowerCase().trim()}`,
    suggestions: [],
    timestamp: Date.now(),
  };
}

/**
 * Generate similar embeddings for testing semantic similarity
 * Creates embeddings that are cosine-similar to a base embedding
 */
function generateSimilarEmbedding(baseEmbedding: number[], similarity: number): number[] {
  // Add noise to create similar embedding
  const noise = baseEmbedding.map((v) => v * (1 - similarity) + (Math.random() * 2 - 1) * similarity);
  return noise;
}

describe('SemanticCache Benchmarks', () => {
  // Sample queries for benchmarking
  const programmingQueries = [
    'What is JavaScript?',
    'Explain recursion in programming',
    'How do I parse JSON in JavaScript?',
    'What is a closure in JavaScript?',
    'Define async/await in JavaScript',
    'What is TypeScript?',
    'How do I write a for loop?',
    'What are arrow functions?',
    'Explain prototype inheritance',
    'What is the difference between let and const?',
  ];

  const generalQueries = [
    'What is the capital of France?',
    'Who wrote Romeo and Juliet?',
    'What is the speed of light?',
    'When was World War II?',
    'What is photosynthesis?',
    'Who painted the Mona Lisa?',
    'What is the largest ocean?',
    'What is the meaning of life?',
    'How do you bake a cake?',
    'What is democracy?',
  ];

  const allQueries = [...programmingQueries, ...generalQueries];

  // Caches for benchmarking
  const smallCache = new SemanticCache({
    maxSize: 100,
    ttl: 300000,
    similarityThreshold: 0.85,
  });

  const mediumCache = new SemanticCache({
    maxSize: 1000,
    ttl: 300000,
    similarityThreshold: 0.85,
  });

  const largeCache = new SemanticCache({
    maxSize: 10000,
    ttl: 300000,
    similarityThreshold: 0.85,
  });

  // Pre-populate caches
  beforeAll(async () => {
    // Populate with all queries
    for (const query of allQueries) {
      const category = programmingQueries.includes(query) ? 'programming' : 'general';
      const queryType: QueryType = category === 'programming' ? 'question' : 'general';
      const refinedQuery = createMockRefinedQuery(query, queryType);
      await smallCache.set(refinedQuery, { answer: `${category} answer`, category });
      await mediumCache.set(refinedQuery, { answer: `${category} answer`, category });
      await largeCache.set(refinedQuery, { answer: `${category} answer`, category });
    }
  });

  describe('Cache Get Operations', () => {
    bench('cache get - exact hit (small cache)', async () => {
      const query = programmingQueries[0];
      const refinedQuery = createMockRefinedQuery(query, 'question');
      await smallCache.get(refinedQuery);
    });

    bench('cache get - exact hit (medium cache)', async () => {
      const query = programmingQueries[0];
      const refinedQuery = createMockRefinedQuery(query, 'question');
      await mediumCache.get(refinedQuery);
    });

    bench('cache get - exact hit (large cache)', async () => {
      const query = programmingQueries[0];
      const refinedQuery = createMockRefinedQuery(query, 'question');
      await largeCache.get(refinedQuery);
    });

    bench('cache get - miss', async () => {
      const refinedQuery = createMockRefinedQuery('never seen before query about quantum physics', 'question');
      await smallCache.get(refinedQuery);
    });
  });

  describe('Cache Set Operations', () => {
    bench('cache set (empty cache)', async () => {
      const cache = new SemanticCache({ maxSize: 1000, ttl: 300000 });
      const refinedQuery = createMockRefinedQuery('benchmark query for testing', 'question');
      await cache.set(refinedQuery, { data: 'test data' });
    });

    bench('cache set (populated cache)', async () => {
      const refinedQuery = createMockRefinedQuery(`unique query ${Date.now()}`, 'question');
      await mediumCache.set(refinedQuery, { data: 'test data' });
    });
  });

  describe('Similarity Search', () => {
    bench('similarity search - high similarity (0.95+)', async () => {
      // Create a query with high similarity to an existing one
      const baseQuery = programmingQueries[0];
      const baseRefined = createMockRefinedQuery(baseQuery, 'question');
      const similarEmbedding = generateSimilarEmbedding(baseRefined.semanticFeatures!.embedding, 0.95);
      const similarQuery = createMockRefinedQuery('What is JS?', 'question', similarEmbedding);
      await smallCache.get(similarQuery);
    });

    bench('similarity search - medium similarity (0.85-0.95)', async () => {
      const baseQuery = programmingQueries[0];
      const baseRefined = createMockRefinedQuery(baseQuery, 'question');
      const similarEmbedding = generateSimilarEmbedding(baseRefined.semanticFeatures!.embedding, 0.90);
      const similarQuery = createMockRefinedQuery('Explain JavaScript programming', 'question', similarEmbedding);
      await smallCache.get(similarQuery);
    });

    bench('similarity search - low similarity (<0.85)', async () => {
      const baseQuery = programmingQueries[0];
      const baseRefined = createMockRefinedQuery(baseQuery, 'question');
      const similarEmbedding = generateSimilarEmbedding(baseRefined.semanticFeatures!.embedding, 0.75);
      const similarQuery = createMockRefinedQuery('Tell me about programming', 'question', similarEmbedding);
      await smallCache.get(similarQuery);
    });
  });

  describe('Cache Statistics', () => {
    bench('getStats - small cache', () => {
      smallCache.getStats();
    });

    bench('getStats - medium cache', () => {
      mediumCache.getStats();
    });

    bench('getStats - large cache', () => {
      largeCache.getStats();
    });
  });

  describe('Cache Eviction', () => {
    bench('LRU eviction - trigger eviction', async () => {
      const cache = new SemanticCache({ maxSize: 10, ttl: 300000 });

      // Fill cache beyond max size
      for (let i = 0; i < 20; i++) {
        const refinedQuery = createMockRefinedQuery(`query ${i}`, 'question');
        await cache.set(refinedQuery, { index: i });
      }

      // Verify size is maintained
      cache.size();
    });
  });

  describe('Throughput Tests', () => {
    bench('sequential read workload (100 queries)', async () => {
      for (let i = 0; i < 100; i++) {
        const query = allQueries[i % allQueries.length];
        const refinedQuery = createMockRefinedQuery(query, 'question');
        await mediumCache.get(refinedQuery);
      }
    });

    bench('mixed read/write workload', async () => {
      const cache = new SemanticCache({ maxSize: 1000, ttl: 300000 });

      // Mix of reads and writes
      for (let i = 0; i < 50; i++) {
        // Write
        const writeQuery = createMockRefinedQuery(`new query ${i}`, 'question');
        await cache.set(writeQuery, { index: i });

        // Read
        const query = allQueries[i % allQueries.length];
        const readQuery = createMockRefinedQuery(query, 'question');
        await cache.get(readQuery);
      }
    });
  });

  describe('Memory Efficiency', () => {
    bench('cache clear operation', () => {
      const cache = new SemanticCache({ maxSize: 1000, ttl: 300000 });
      cache.clear();
    });

    bench('cache reset stats operation', () => {
      const cache = new SemanticCache({ maxSize: 1000, ttl: 300000 });
      cache.resetStats();
    });
  });

  describe('Adaptive Threshold', () => {
    bench('adaptive threshold adjustment', async () => {
      const cache = new SemanticCache({
        maxSize: 1000,
        ttl: 300000,
        enableAdaptiveThreshold: true,
        adaptiveThreshold: {
          initialThreshold: 0.85,
          minThreshold: 0.70,
          maxThreshold: 0.95,
          adjustmentFactor: 0.01,
          measurementWindow: 10,
          targetHitRate: 0.80,
        },
      });

      // Generate enough operations to trigger threshold adjustment
      for (let i = 0; i < 20; i++) {
        const query = allQueries[i % allQueries.length];
        const refinedQuery = createMockRefinedQuery(query, 'question');
        await cache.get(refinedQuery);
      }

      // Stats will include threshold adjustments
      cache.getStats();
    });
  });
});
