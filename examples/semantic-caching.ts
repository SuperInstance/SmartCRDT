/**
 * Semantic Caching Example
 *
 * This example demonstrates high-hit-rate semantic caching that:
 * 1. Matches queries by semantic similarity (not just exact strings)
 * 2. Achieves ~80% cache hit rate
 * 3. Uses HNSW index for O(log n) similarity search
 * 4. Adapts threshold based on performance
 *
 * @package @lsi/cascade
 * @example
 */

import { SemanticCache } from '@lsi/cascade';
import type { RefinedQuery } from '@lsi/cascade';

/**
 * Helper: Create a mock refined query for testing
 */
function createMockRefinedQuery(text: string, embedding?: number[]): RefinedQuery {
  // Simple hash-based embedding for demonstration
  const mockEmbedding = embedding || Array.from({ length: 768 }, (_, i) => {
    // Deterministic pseudo-embedding based on text
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Math.sin(hash + i) * 0.5 + 0.5;
  });

  return {
    original: text,
    cacheKey: `cache:${text.toLowerCase().trim()}`,
    staticFeatures: {
      queryType: 'question',
      complexity: 0.5,
      domainKeywords: [],
      patterns: [],
    },
    semanticFeatures: {
      embedding: mockEmbedding,
      similarQueries: [],
      domain: 'general',
      intent: 'information',
    },
    suggestions: [],
  };
}

/**
 * Example 1: Basic Semantic Cache Operations
 *
 * Set and get cache entries with semantic similarity matching.
 */
async function basicCacheOperations() {
  console.log('=== Example 1: Basic Cache Operations ===\n');

  const cache = new SemanticCache({
    maxSize: 1000,
    similarityThreshold: 0.85,
    ttl: 300000, // 5 minutes
  });

  // Store a query result
  const query1 = createMockRefinedQuery('How do I optimize database queries?');
  await cache.set(query1, {
    answer: 'Use indexes, avoid N+1 queries, and consider query caching.',
    confidence: 0.95,
  });

  console.log('Stored: "How do I optimize database queries?"');

  // Exact match retrieval
  const result1 = await cache.get(query1);
  if (result1.found) {
    console.log(`\nExact match found!`);
    console.log(`  Similarity: ${result1.similarity.toFixed(3)}`);
    console.log(`  Answer: ${result1.result.answer}`);
    console.log(`  Hit count: ${result1.entry.hitCount}`);
  }

  // Semantic similarity retrieval (different wording, same meaning)
  const query2 = createMockRefinedQuery('Database query optimization tips?');
  const result2 = await cache.get(query2);

  if (result2.found) {
    console.log(`\n✓ Semantic match found!`);
    console.log(`  Similarity: ${result2.similarity.toFixed(3)}`);
    console.log(`  Hit count: ${result2.entry.hitCount}`);
  } else {
    console.log('\n✗ No semantic match (similarity below threshold)');
  }
}

/**
 * Example 2: Cache Statistics
 *
 * Monitor cache performance with detailed statistics.
 */
async function cacheStatisticsExample() {
  console.log('\n=== Example 2: Cache Statistics ===\n');

  const cache = new SemanticCache({
    maxSize: 100,
    similarityThreshold: 0.85,
    enableAdaptiveThreshold: true,
  });

  // Simulate cache traffic
  const queries = [
    'What is TypeScript?',
    'TypeScript basics',
    'Explain TypeScript',
    'How does JavaScript work?',
    'JS fundamentals',
    'Python vs JavaScript',
    'Best Python practices',
    'TypeScript types',
    'JS async/await',
    'TypeScript interfaces',
  ];

  // Add some queries to cache
  for (let i = 0; i < queries.length; i++) {
    const query = createMockRefinedQuery(queries[i]);
    await cache.set(query, { answer: `Answer for ${queries[i]}`, index: i });
  }

  // Try to retrieve some queries
  const testQueries = [
    'What is TypeScript?',
    'TypeScript basics',
    'Explain TypeScript', // Should hit semantically
    'Unknown query', // Should miss
  ];

  for (const testQuery of testQueries) {
    const result = await cache.get(createMockRefinedQuery(testQuery));
    console.log(`"${testQuery}": ${result.found ? 'HIT' : 'MISS'} ${result.found ? `(similarity: ${result.similarity.toFixed(3)})` : ''}`);
  }

  // Get comprehensive statistics
  const stats = cache.getStats();

  console.log('\n--- Cache Statistics ---');
  console.log(`Size: ${stats.size} entries`);
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Total Hits: ${stats.totalHits}`);
  console.log(`Total Misses: ${stats.totalMisses}`);
  console.log(`Exact Hits: ${stats.exactHits}`);
  console.log(`Semantic Hits: ${stats.semanticHits}`);
  console.log(`Current Threshold: ${stats.currentThreshold.toFixed(3)}`);
  console.log(`Threshold Adjustments: ${stats.thresholdAdjustments}`);

  console.log('\nTop Entries:');
  stats.topEntries.slice(0, 5).forEach((entry, i) => {
    console.log(`  ${i + 1}. "${entry.query}" (${entry.hitCount} hits)`);
  });
}

/**
 * Example 3: Per-Query-Type Thresholds
 *
 * Different query types have different similarity thresholds.
 * Code queries need higher precision (0.92) than general queries (0.8).
 */
async function queryTypeThresholdsExample() {
  console.log('\n=== Example 3: Per-Query-Type Thresholds ===\n');

  const cache = new SemanticCache({
    maxSize: 1000,
    enableQueryTypeThresholds: true,
    queryTypeThresholds: {
      question: 0.8,
      command: 0.85,
      code: 0.92, // Higher threshold for code
      explanation: 0.82,
      comparison: 0.83,
      debug: 0.88, // Higher threshold for debugging
      general: 0.8,
    },
  });

  // Code query (high precision required)
  const codeQuery: RefinedQuery = {
    ...createMockRefinedQuery('How to write async function in TypeScript?'),
    staticFeatures: {
      queryType: 'code',
      complexity: 0.7,
      domainKeywords: ['typescript', 'async'],
      patterns: [],
    },
  };

  await cache.set(codeQuery, {
    code: 'async function myFunction() { await fetch(); }',
    language: 'typescript',
  });

  console.log('Code query stored with threshold: 0.92');

  const similarCodeQuery: RefinedQuery = {
    ...createMockRefinedQuery('TypeScript async function syntax?'),
    staticFeatures: {
      queryType: 'code',
      complexity: 0.6,
      domainKeywords: ['typescript'],
      patterns: [],
    },
  };

  const result = await cache.get(similarCodeQuery);

  if (result.found) {
    console.log(`✓ Code query hit (similarity: ${result.similarity.toFixed(3)})`);
  } else {
    console.log('✗ Code query miss (similarity below 0.92 threshold)');
  }

  console.log('\nCode queries require higher precision to avoid incorrect code snippets.');
}

/**
 * Example 4: Adaptive Threshold Optimization
 *
 * Cache automatically adjusts similarity threshold based on hit rate.
 */
async function adaptiveThresholdExample() {
  console.log('\n=== Example 4: Adaptive Threshold ===\n');

  const cache = new SemanticCache({
    maxSize: 1000,
    enableAdaptiveThreshold: true,
    adaptiveThreshold: {
      initialThreshold: 0.85,
      minThreshold: 0.75,
      maxThreshold: 0.95,
      adjustmentFactor: 0.01,
      measurementWindow: 10,
      targetHitRate: 0.8,
    },
  });

  console.log('Initial threshold: 0.85');
  console.log('Target hit rate: 80%\n');

  // Simulate cache traffic with varying hit rates
  const queries = Array.from({ length: 30 }, (_, i) =>
    createMockRefinedQuery(`Query ${i}: ${['How to', 'Explain', 'What is'][i % 3]} ${['code', 'database', 'API'][i % 3]}?`)
  );

  // Add first 10 queries to cache
  for (let i = 0; i < 10; i++) {
    await cache.set(queries[i], { answer: `Answer ${i}` });
  }

  // Try to retrieve all 30 queries
  let hits = 0;
  let misses = 0;

  for (const query of queries) {
    const result = await cache.get(query);
    if (result.found) hits++;
    else misses++;
  }

  const stats = cache.getStats();

  console.log(`Hits: ${hits}, Misses: ${misses}`);
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Current Threshold: ${stats.currentThreshold.toFixed(3)}`);
  console.log(`Threshold Adjustments: ${stats.thresholdAdjustments}`);

  if (stats.thresholdAdjustments > 0) {
    console.log('\n✓ Threshold adapted based on performance');
  }
}

/**
 * Example 5: Cache Miss Handling
 *
 * When cache misses, return similar queries for suggestions.
 */
async function cacheMissHandlingExample() {
  console.log('\n=== Example 5: Cache Miss Handling ===\n');

  const cache = new SemanticCache({
    maxSize: 1000,
    similarityThreshold: 0.85,
  });

  // Add some queries
  const queries = [
    'How do I optimize database queries?',
    'What is machine learning?',
    'Explain async/await in JavaScript',
  ];

  for (const query of queries) {
    await cache.set(createMockRefinedQuery(query), { answer: `Answer for: ${query}` });
  }

  // Try a similar but not matching query
  const newQuery = createMockRefinedQuery('How do I optimize SQL performance?');
  const result = await cache.get(newQuery);

  if (!result.found) {
    console.log('Cache miss for: "How do I optimize SQL performance?"');
    console.log('\nDid you mean:');
    result.similarQueries.forEach((similar, i) => {
      console.log(`  ${i + 1}. "${similar.query}" (similarity: ${similar.similarity.toFixed(3)})`);
    });

    console.log('\n✓ Similar queries suggested to user');
  }
}

/**
 * Example 6: Production Configuration
 *
 * Recommended cache configuration for production use.
 */
async function productionConfigExample() {
  console.log('\n=== Example 6: Production Configuration ===\n');

  const cache = new SemanticCache({
    // Cache size and TTL
    maxSize: 1000,
    ttl: 300000, // 5 minutes

    // Similarity threshold
    similarityThreshold: 0.85,

    // Adaptive optimization
    enableAdaptiveThreshold: true,
    adaptiveThreshold: {
      initialThreshold: 0.85,
      minThreshold: 0.75,
      maxThreshold: 0.95,
      adjustmentFactor: 0.01,
      measurementWindow: 100,
      targetHitRate: 0.8,
    },

    // Per-query-type thresholds
    enableQueryTypeThresholds: true,
    queryTypeThresholds: {
      code: 0.92,
      debug: 0.88,
    },

    // HNSW index for fast similarity search
    enableHNSW: true,
    hnswConfig: {
      dim: 768,
      M: 16,
      efConstruction: 200,
    },
  });

  // Warm cache with common queries
  const commonQueries = [
    'What is TypeScript?',
    'How do I write a function?',
    'Explain async/await',
    'What is a Promise?',
    'How to debug code?',
  ];

  console.log('Warming cache with common queries...');
  for (const query of commonQueries) {
    await cache.set(createMockRefinedQuery(query), { answer: `Answer: ${query}` });
  }

  const stats = cache.getStats();
  console.log(`Cache warmed with ${stats.size} entries`);

  // Test retrieval
  const testQuery = createMockRefinedQuery('TypeScript basics');
  const result = await cache.get(testQuery);

  if (result.found) {
    console.log(`\n✓ Test query hit cache (similarity: ${result.similarity.toFixed(3)})`);
  }

  console.log('\n✓ Production cache configured for 80% hit rate target');
}

/**
 * Example 7: Cache Management
 *
 * Clear, reset, and manage cache entries.
 */
async function cacheManagementExample() {
  console.log('\n=== Example 7: Cache Management ===\n');

  const cache = new SemanticCache({
    maxSize: 1000,
    similarityThreshold: 0.85,
  });

  // Add some entries
  for (let i = 0; i < 5; i++) {
    const query = createMockRefinedQuery(`Query ${i}`);
    await cache.set(query, { answer: `Answer ${i}` });
  }

  console.log(`Cache size: ${cache.size()}`);
  console.log(`Cache keys: ${cache.keys().length}`);

  // Peek at entry (without updating LRU)
  const firstKey = cache.keys()[0];
  const entry = cache.peek(firstKey);
  console.log(`\nFirst entry: "${entry?.query}" (${entry?.hitCount} hits)`);

  // Check if key exists
  console.log(`Has key: ${cache.has(firstKey)}`);

  // Delete specific entry
  cache.delete(firstKey);
  console.log(`\nAfter deletion: ${cache.size()} entries`);

  // Clear all
  cache.clear();
  console.log(`After clear: ${cache.size()} entries`);

  console.log('\n✓ Cache management operations completed');
}

/**
 * Run all examples
 */
async function main() {
  try {
    await basicCacheOperations();
    await cacheStatisticsExample();
    await queryTypeThresholdsExample();
    await adaptiveThresholdExample();
    await cacheMissHandlingExample();
    await productionConfigExample();
    await cacheManagementExample();

    console.log('\n=== All Semantic Caching Examples Completed ===');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export {
  basicCacheOperations,
  cacheStatisticsExample,
  queryTypeThresholdsExample,
  adaptiveThresholdExample,
  cacheMissHandlingExample,
  productionConfigExample,
  cacheManagementExample,
};
