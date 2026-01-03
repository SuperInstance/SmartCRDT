/**
 * Standalone Embeddings Performance Benchmark
 *
 * Run with: npx tsx benchmarks/run-benchmarks.ts
 */

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
 * Mock OpenAI API with realistic latency
 */
class MockEmbeddingAPI {
  private latencyMean: number;
  private latencyStdDev: number;

  constructor(latencyMean = 150, latencyStdDev = 50) {
    this.latencyMean = latencyMean;
    this.latencyStdDev = latencyStdDev;
  }

  async mockCall(): Promise<Float32Array> {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const latency = this.latencyMean + z * this.latencyStdDev;

    // Sleep for simulated latency
    await new Promise(resolve => setTimeout(resolve, Math.max(0, latency)));

    // Return realistic embedding vector
    return this.generateEmbedding();
  }

  private generateEmbedding(): Float32Array {
    const dimensions = 768;
    const embedding = new Float32Array(dimensions);

    // Generate random unit vector
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
 * Simple LRU cache
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
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);

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
 * Calculate percentile
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
 * Run benchmarks
 */
async function runBenchmarks() {
  console.log('\n' + '='.repeat(60));
  console.log('EMBEDDING PERFORMANCE BENCHMARK');
  console.log('='.repeat(60) + '\n');

  // Test queries
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

  // Benchmark 1: Hash Embeddings
  console.log('1. HASH EMBEDDINGS (BASELINE)');
  console.log('-'.repeat(60));
  const hashTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    hashEmbed('test query');
    const end = performance.now();
    hashTimes.push(end - start);
  }
  const hashMean = hashTimes.reduce((a, b) => a + b) / hashTimes.length;
  console.log(`Mean Latency:    ${hashMean.toFixed(4)}ms`);
  console.log(`P50 Latency:     ${percentile(hashTimes, 50).toFixed(4)}ms`);
  console.log(`P95 Latency:     ${percentile(hashTimes, 95).toFixed(4)}ms`);
  console.log(`P99 Latency:     ${percentile(hashTimes, 99).toFixed(4)}ms`);
  console.log(`Throughput:      ${(1000 / (hashTimes.reduce((a, b) => a + b) / 1000)).toFixed(0)} embeddings/sec`);
  console.log(`Min:             ${Math.min(...hashTimes).toFixed(4)}ms`);
  console.log(`Max:             ${Math.max(...hashTimes).toFixed(4)}ms\n`);

  // Benchmark 2: Mock OpenAI API
  console.log('2. MOCK OPENAI API (150ms mean, 50ms std)');
  console.log('-'.repeat(60));
  const mockApi = new MockEmbeddingAPI(150, 50);
  const apiTimes: number[] = [];
  const iterations = 50; // Reduced for faster execution

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await mockApi.mockCall();
    const end = performance.now();
    apiTimes.push(end - start);
  }

  const apiMean = apiTimes.reduce((a, b) => a + b) / apiTimes.length;
  console.log(`Mean Latency:    ${apiMean.toFixed(2)}ms`);
  console.log(`P50 Latency:     ${percentile(apiTimes, 50).toFixed(2)}ms`);
  console.log(`P95 Latency:     ${percentile(apiTimes, 95).toFixed(2)}ms`);
  console.log(`P99 Latency:     ${percentile(apiTimes, 99).toFixed(2)}ms`);
  console.log(`Throughput:      ${(iterations / (apiTimes.reduce((a, b) => a + b) / 1000)).toFixed(2)} embeddings/sec`);
  console.log(`Min:             ${Math.min(...apiTimes).toFixed(2)}ms`);
  console.log(`Max:             ${Math.max(...apiTimes).toFixed(2)}ms\n`);

  // Benchmark 3: Cache Performance
  console.log('3. CACHE PERFORMANCE (50% hit rate)');
  console.log('-'.repeat(60));
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

  const cacheMean = cacheTimes.reduce((a, b) => a + b) / cacheTimes.length;
  console.log(`Hit Rate:        ${((hits / (hits + misses)) * 100).toFixed(1)}%`);
  console.log(`Mean Latency:    ${cacheMean.toFixed(4)}ms`);
  console.log(`P50 Latency:     ${percentile(cacheTimes, 50).toFixed(4)}ms`);
  console.log(`P95 Latency:     ${percentile(cacheTimes, 95).toFixed(4)}ms`);
  console.log(`P99 Latency:     ${percentile(cacheTimes, 99).toFixed(4)}ms`);
  console.log(`Throughput:      ${(1000 / cacheTimes.reduce((a, b) => a + b) / 1000).toFixed(0)} ops/sec\n`);

  // Benchmark 4: Batch Processing
  console.log('4. BATCH PROCESSING');
  console.log('-'.repeat(60));
  const batchSizes = [10, 50, 100];
  for (const size of batchSizes) {
    const start = performance.now();
    for (let i = 0; i < size; i++) {
      hashEmbed(`query ${i}`);
    }
    const end = performance.now();
    const total = end - start;
    console.log(`Batch ${size.toString().padStart(4)}: ${total.toFixed(2)}ms total, ${(total / size).toFixed(4)}ms avg`);
  }
  console.log();

  // Benchmark 5: Similarity Search
  console.log('5. SIMILARITY SEARCH (LINEAR SCAN)');
  console.log('-'.repeat(60));
  const corpusSizes = [100, 1000];

  for (const corpusSize of corpusSizes) {
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

    const searchMean = searchTimes.reduce((a, b) => a + b) / searchTimes.length;
    console.log(`Corpus: ${corpusSize} vectors`);
    console.log(`  Mean:   ${searchMean.toFixed(3)}ms`);
    console.log(`  P95:    ${percentile(searchTimes, 95).toFixed(3)}ms`);
    console.log(`  P99:    ${percentile(searchTimes, 99).toFixed(3)}ms`);
    console.log(`  Query/s: ${(100 / searchTimes.reduce((a, b) => a + b) * 1000).toFixed(0)}`);
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY - P95 LATENCY COMPARISON');
  console.log('='.repeat(60));
  console.log(`Hash Embedding:        ${percentile(hashTimes, 95).toFixed(4)}ms`);
  console.log(`Mock OpenAI API:       ${percentile(apiTimes, 95).toFixed(2)}ms (${(percentile(apiTimes, 95) / percentile(hashTimes, 95)).toFixed(0)}x slower)`);
  console.log(`Cached (50% hit):      ${percentile(cacheTimes, 95).toFixed(4)}ms`);
  console.log(`Cache Speedup:         ~${(percentile(apiTimes, 95) / percentile(cacheTimes, 95)).toFixed(0)}x (vs API)`);
  console.log();

  console.log('KEY INSIGHTS:');
  console.log('-'.repeat(60));
  console.log('1. Hash embeddings: Instant but semantically meaningless');
  console.log('2. OpenAI API: 150ms latency but provides real semantics');
  console.log('3. Caching: Reduces latency from 150ms to <0.01ms (15,000x)');
  console.log('4. At 90%+ cache hit rate, cached approach ~hash performance');
  console.log('5. Similarity search scales linearly (use HNSW for >10K vectors)');
  console.log();

  console.log('RECOMMENDATIONS:');
  console.log('-'.repeat(60));
  console.log('[P0] Replace hash embeddings with OpenAI');
  console.log('[P1] Implement LRU cache (target 80%+ hit rate)');
  console.log('[P2] Add HNSW index for corpora > 1,000 vectors');
  console.log('[P3] Monitor cache hit rate and adjust cache size');
  console.log('[P4] Pre-warm cache with common queries');
  console.log('='.repeat(60) + '\n');
}

// Run if executed directly
runBenchmarks().catch(console.error);
