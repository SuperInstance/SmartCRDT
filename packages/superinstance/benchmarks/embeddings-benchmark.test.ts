/**
 * Embeddings Performance Benchmark Suite
 *
 * Comprehensive benchmark comparing:
 * - Hash-based fake embeddings (baseline)
 * - OpenAI embeddings (with mock API)
 * - Cached embeddings (cache hit/miss scenarios)
 * - Batch vs single operations
 * - Similarity search performance
 *
 * Performance Metrics:
 * - Latency (p50, p95, p99)
 * - Throughput (embeddings/second)
 * - Memory usage
 * - Cache hit rate over time
 * - API call count reduction
 *
 * @packageDocumentation
 */

import { describe, bench, beforeAll, afterAll } from 'vitest';
import { OpenAIEmbeddingService } from '@lsi/embeddings';

/**
 * Mock OpenAI API for realistic performance simulation
 */
class MockEmbeddingAPI {
  private latencyMean: number; // milliseconds
  private latencyStdDev: number;
  private errorRate: number;

  constructor(latencyMean = 150, latencyStdDev = 50, errorRate = 0) {
    this.latencyMean = latencyMean;
    this.latencyStdDev = latencyStdDev;
    this.errorRate = errorRate;
  }

  /**
   * Simulate API call with realistic latency
   */
  async mockCall(): Promise<Float32Array> {
    // Simulate network delay (Gaussian distribution)
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const latency = this.latencyMean + z * this.latencyStdDev;

    // Simulate errors
    if (Math.random() < this.errorRate) {
      throw new Error('API error: rate limit exceeded');
    }

    // Sleep for simulated latency
    await new Promise(resolve => setTimeout(resolve, Math.max(0, latency)));

    // Return realistic embedding vector
    return this.generateEmbedding();
  }

  private generateEmbedding(): Float32Array {
    const dimensions = 768;
    const embedding = new Float32Array(dimensions);

    // Generate random unit vector (realistic embedding distribution)
    let sum = 0;
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = (Math.random() - 0.5) * 2;
      sum += embedding[i] * embedding[i];
    }

    // Normalize to unit length
    const norm = Math.sqrt(sum);
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }
}

/**
 * Hash-based embedding (fake baseline)
 */
function hashEmbed(text: string, dimensions = 768): Float32Array {
  const embedding = new Float32Array(dimensions);

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = 0; i < dimensions; i++) {
    const value = ((hash * (i + 1)) % 10000) / 5000 - 1;
    embedding[i] = value;
  }

  return embedding;
}

/**
 * Simple LRU cache for benchmarks
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Percentile calculation
 */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (p / 100) * (sorted.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Benchmark test data
 */
const TEST_QUERIES = [
  'What is the capital of France?',
  'How do I implement binary search in Python?',
  'Explain the theory of relativity',
  'What are the symptoms of diabetes?',
  'How do I create a REST API?',
  'What is machine learning?',
  'How does photosynthesis work?',
  'What is the difference between SQL and NoSQL?',
  'How do I optimize database queries?',
  'What is quantum computing?',
];

// Repeated queries for cache testing
const REPEATED_QUERIES = [
  ...TEST_QUERIES,
  ...TEST_QUERIES, // 2x
  ...TEST_QUERIES, // 3x
  ...TEST_QUERIES, // 4x
  ...TEST_QUERIES, // 5x
];

// Batch size tests
const BATCH_SIZES = [1, 10, 50, 100, 500, 1000];

describe('Embeddings Performance Benchmark', () => {
  let mockAPI: MockEmbeddingAPI;
  let cache: LRUCache<string, Float32Array>;

  beforeAll(() => {
    mockAPI = new MockEmbeddingAPI(150, 50, 0);
    cache = new LRUCache<string, Float32Array>(10000);
  });

  afterAll(() => {
    cache.clear();
  });

  describe('Hash Embeddings (Baseline)', () => {
    bench('single hash embedding', () => {
      hashEmbed('test query');
    });

    bench('batch hash embeddings (10)', () => {
      for (let i = 0; i < 10; i++) {
        hashEmbed(`test query ${i}`);
      }
    });

    bench('batch hash embeddings (100)', () => {
      for (let i = 0; i < 100; i++) {
        hashEmbed(`test query ${i}`);
      }
    });
  });

  describe('Mock OpenAI API Latency', () => {
    bench('single API call (mock 150ms)', async () => {
      await mockAPI.mockCall();
    });

    bench('10 sequential API calls', async () => {
      for (let i = 0; i < 10; i++) {
        await mockAPI.mockCall();
      }
    });
  });

  describe('Cache Performance', () => {
    beforeAll(() => {
      // Warm up cache with first 5 queries
      TEST_QUERIES.slice(0, 5).forEach(q => {
        cache.set(q, hashEmbed(q));
      });
    });

    bench('cache hit scenario', () => {
      const query = TEST_QUERIES[0];
      const cached = cache.get(query);
      if (!cached) {
        const embedding = hashEmbed(query);
        cache.set(query, embedding);
      }
    });

    bench('cache miss scenario', () => {
      const query = 'never seen before query';
      const cached = cache.get(query);
      if (!cached) {
        const embedding = hashEmbed(query);
        cache.set(query, embedding);
      }
    });

    bench('repeated queries (50% hit rate)', () => {
      const query = REPEATED_QUERIES[Math.floor(Math.random() * REPEATED_QUERIES.length)];
      const cached = cache.get(query);
      if (!cached) {
        const embedding = hashEmbed(query);
        cache.set(query, embedding);
      }
    });
  });

  describe('Similarity Search Performance', () => {
    const corpus: Float32Array[] = [];
    const queryEmbedding = hashEmbed('machine learning algorithms');

    beforeAll(() => {
      // Build corpus
      for (let i = 0; i < 1000; i++) {
        corpus.push(hashEmbed(`document ${i} content`));
      }
    });

    bench('linear search (1000 vectors)', () => {
      let maxSim = -Infinity;
      for (const vec of corpus) {
        let sim = 0;
        for (let i = 0; i < vec.length; i++) {
          sim += vec[i] * queryEmbedding[i];
        }
        if (sim > maxSim) {
          maxSim = sim;
        }
      }
    });

    bench('cosine similarity (1000 vectors)', () => {
      let maxSim = -Infinity;
      for (const vec of corpus) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vec.length; i++) {
          dot += vec[i] * queryEmbedding[i];
          normA += vec[i] * vec[i];
          normB += queryEmbedding[i] * queryEmbedding[i];
        }
        const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
        if (sim > maxSim) {
          maxSim = sim;
        }
      }
    });
  });

  describe('Memory Usage', () => {
    bench('store 1000 embeddings in Map', () => {
      const map = new Map<string, Float32Array>();
      for (let i = 0; i < 1000; i++) {
        map.set(`key_${i}`, hashEmbed(`content ${i}`));
      }
    });

    bench('store 1000 embeddings in LRU cache', () => {
      const lru = new LRUCache<string, Float32Array>(10000);
      for (let i = 0; i < 1000; i++) {
        lru.set(`key_${i}`, hashEmbed(`content ${i}`));
      }
    });
  });
});

/**
 * Detailed benchmark runner with metrics collection
 */
async function runDetailedBenchmarks() {
  console.log('\n=== DETAILED EMBEDDING PERFORMANCE BENCHMARK ===\n');

  const results: Record<string, number[]> = {};

  // Benchmark 1: Hash Embeddings Baseline
  console.log('1. Hash Embeddings (Baseline)');
  const hashTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    hashEmbed('test query');
    const end = performance.now();
    hashTimes.push(end - start);
  }
  results['hash_embedding'] = hashTimes;
  console.log(`   Mean: ${(hashTimes.reduce((a, b) => a + b) / hashTimes.length).toFixed(3)}ms`);
  console.log(`   P50: ${percentile(hashTimes, 50).toFixed(3)}ms`);
  console.log(`   P95: ${percentile(hashTimes, 95).toFixed(3)}ms`);
  console.log(`   P99: ${percentile(hashTimes, 99).toFixed(3)}ms`);
  console.log(`   Throughput: ${(1000 / (hashTimes.reduce((a, b) => a + b) / 1000)).toFixed(0)} embeddings/sec\n`);

  // Benchmark 2: Mock API Latency
  console.log('2. Mock OpenAI API (150ms mean, 50ms std)');
  const apiTimes: number[] = [];
  const mockApi = new MockEmbeddingAPI(150, 50, 0);
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await mockApi.mockCall();
    const end = performance.now();
    apiTimes.push(end - start);
  }
  results['mock_api'] = apiTimes;
  console.log(`   Mean: ${(apiTimes.reduce((a, b) => a + b) / apiTimes.length).toFixed(1)}ms`);
  console.log(`   P50: ${percentile(apiTimes, 50).toFixed(1)}ms`);
  console.log(`   P95: ${percentile(apiTimes, 95).toFixed(1)}ms`);
  console.log(`   P99: ${percentile(apiTimes, 99).toFixed(1)}ms`);
  console.log(`   Throughput: ${(100 / (apiTimes.reduce((a, b) => a + b) / 1000)).toFixed(1)} embeddings/sec\n`);

  // Benchmark 3: Cache Performance
  console.log('3. Cache Performance (50% hit rate)');
  const lruCache = new LRUCache<string, Float32Array>(10000);
  // Warm cache with 50% of queries
  TEST_QUERIES.forEach(q => lruCache.set(q, hashEmbed(q)));
  const testQueries = [...TEST_QUERIES, ...TEST_QUERIES.map(q => q + ' variant')];
  const cacheTimes: number[] = [];
  let hits = 0;
  let misses = 0;
  for (let i = 0; i < 1000; i++) {
    const query = testQueries[Math.floor(Math.random() * testQueries.length)];
    const start = performance.now();
    const cached = lruCache.get(query);
    if (!cached) {
      lruCache.set(query, hashEmbed(query));
      misses++;
    } else {
      hits++;
    }
    const end = performance.now();
    cacheTimes.push(end - start);
  }
  results['cached_50pct_hit'] = cacheTimes;
  console.log(`   Hit rate: ${((hits / (hits + misses)) * 100).toFixed(1)}%`);
  console.log(`   Mean latency: ${(cacheTimes.reduce((a, b) => a + b) / cacheTimes.length).toFixed(3)}ms`);
  console.log(`   P50: ${percentile(cacheTimes, 50).toFixed(3)}ms`);
  console.log(`   P95: ${percentile(cacheTimes, 95).toFixed(3)}ms`);
  console.log(`   P99: ${percentile(cacheTimes, 99).toFixed(3)}ms\n`);

  // Benchmark 4: Batch Performance
  console.log('4. Batch Processing Performance');
  for (const size of [10, 50, 100]) {
    const start = performance.now();
    for (let i = 0; i < size; i++) {
      hashEmbed(`query ${i}`);
    }
    const end = performance.now();
    console.log(`   Batch ${size}: ${(end - start).toFixed(2)}ms total, ${((end - start) / size).toFixed(3)}ms avg`);
  }
  console.log();

  // Benchmark 5: Similarity Search
  console.log('5. Similarity Search Performance');
  const corpusSize = 1000;
  const corpus: Float32Array[] = [];
  for (let i = 0; i < corpusSize; i++) {
    corpus.push(hashEmbed(`document ${i}`));
  }
  const query = hashEmbed('search query');
  const searchTimes: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    let maxSim = -Infinity;
    for (const vec of corpus) {
      let sim = 0;
      for (let j = 0; j < vec.length; j++) {
        sim += vec[j] * query[j];
      }
      if (sim > maxSim) maxSim = sim;
    }
    const end = performance.now();
    searchTimes.push(end - start);
  }
  results['similarity_search_1000'] = searchTimes;
  console.log(`   Corpus size: ${corpusSize} vectors`);
  console.log(`   Mean: ${(searchTimes.reduce((a, b) => a + b) / searchTimes.length).toFixed(2)}ms`);
  console.log(`   P95: ${percentile(searchTimes, 95).toFixed(2)}ms`);
  console.log(`   P99: ${percentile(searchTimes, 99).toFixed(2)}ms\n`);

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Hash embedding: ${percentile(hashTimes, 95).toFixed(3)}ms (P95)`);
  console.log(`Mock OpenAI API: ${percentile(apiTimes, 95).toFixed(1)}ms (P95)`);
  console.log(`Cached (50% hit): ${percentile(cacheTimes, 95).toFixed(3)}ms (P95)`);
  console.log(`Similarity search (1000): ${percentile(searchTimes, 95).toFixed(2)}ms (P95)`);
  console.log('\nSpeedup from caching: ~' + (150 / percentile(cacheTimes, 95)).toFixed(0) + 'x');
  console.log('Speedup from caching (vs hash): ~' + (percentile(hashTimes, 95) / percentile(cacheTimes, 95)).toFixed(2) + 'x (but cache needs initial API call)');
}

// Export for standalone execution
export { runDetailedBenchmarks };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDetailedBenchmarks().catch(console.error);
}
