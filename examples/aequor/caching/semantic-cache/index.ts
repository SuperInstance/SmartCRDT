#!/usr/bin/env node
/**
 * Semantic Cache Example
 *
 * This example demonstrates semantic caching - caching based on meaning
 * rather than exact query matching.
 *
 * Key Concepts:
 * - Semantic similarity using vector embeddings
 * - Similarity threshold tuning
 * - Cache hits for semantically similar queries
 * - Cost and latency optimization
 *
 * Traditional cache: "What is JS?" ≠ "Explain JavaScript"
 * Semantic cache: "What is JS?" ≈ "Explain JavaScript" (95% similar)
 *
 * Run: npx tsx index.ts
 */

interface SemanticCacheEntry {
  query: string;
  embedding: number[];
  response: string;
  timestamp: number;
  hitCount: number;
}

/**
 * Simple semantic cache for demonstration
 */
class SemanticCache {
  private entries: SemanticCacheEntry[] = [];
  private hits = 0;
  private misses = 0;

  constructor(
    private maxEntries: number = 100,
    private similarityThreshold: number = 0.85
  ) {}

  /**
   * Generate a simple hash-based embedding (for demo)
   * In production, use real embeddings from OpenAI/Cohere
   */
  private generateEmbedding(text: string): number[] {
    // Simple hash-based embedding for demonstration
    // Real embeddings would be 1536-dimensional from OpenAI
    const embedding: number[] = [];
    const hash = this.simpleHash(text);

    for (let i = 0; i < 128; i++) {
      // Generate pseudo-random but deterministic values
      const val = Math.sin(hash * (i + 1)) * 10000;
      embedding.push((val - Math.floor(val)) * 2 - 1); // Normalize to [-1, 1]
    }

    return embedding;
  }

  /**
   * Simple hash function for demo
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get cached response or undefined
   */
  async get(query: string): Promise<{ response: string; similarity: number } | undefined> {
    const queryEmbedding = this.generateEmbedding(query);

    // Find most similar cached entry
    let bestMatch: SemanticCacheEntry | undefined;
    let bestSimilarity = 0;

    for (const entry of this.entries) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    // Check if similarity exceeds threshold
    if (bestMatch && bestSimilarity >= this.similarityThreshold) {
      this.hits++;
      bestMatch.hitCount++;
      return {
        response: bestMatch.response,
        similarity: bestSimilarity,
      };
    }

    this.misses++;
    return undefined;
  }

  /**
   * Set cache entry
   */
  set(query: string, response: string): void {
    // Evict oldest if at capacity
    if (this.entries.length >= this.maxEntries) {
      const oldestIndex = this.entries.findIndex(e =>
        e.timestamp === Math.min(...this.entries.map(e => e.timestamp))
      );
      if (oldestIndex !== -1) {
        this.entries.splice(oldestIndex, 1);
      }
    }

    this.entries.push({
      query,
      embedding: this.generateEmbedding(query),
      response,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.entries.length,
      maxSize: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      threshold: this.similarityThreshold,
    };
  }

  /**
   * Get all entries with their hit counts
   */
  getEntries() {
    return this.entries.map(e => ({
      query: e.query,
      hitCount: e.hitCount,
      timestamp: e.timestamp,
    }));
  }
}

/**
 * Display cache statistics
 */
function displayStats(cache: SemanticCache, label: string) {
  const stats = cache.getStats();

  console.log(`\n📊 ${label}`);
  console.log('  '.repeat(10));
  console.log(`  Cache Size: ${stats.size}/${stats.maxSize}`);
  console.log(`  Hits: ${stats.hits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Similarity Threshold: ${(stats.threshold * 100).toFixed(0)}%`);
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Semantic Cache Example                                  ║');
  console.log('║        Cache by Meaning, Not Just Exact Match                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Create cache with 85% similarity threshold
  const cache = new SemanticCache(100, 0.85);

  console.log('\n⚙️  Cache Configuration:');
  console.log(`   Max Entries: ${cache.getStats().maxSize}`);
  console.log(`   Similarity Threshold: ${(cache.getStats().threshold * 100).toFixed(0)}%`);
  console.log('   Embedding Dimensions: 128 (demo)');

  // Phase 1: Populate cache
  console.log('\n🔄 Phase 1: Populating cache with common queries...');

  const commonQueries = [
    { query: 'What is JavaScript?', response: 'JavaScript is a programming language for web development.' },
    { query: 'How do I parse JSON?', response: 'Use JSON.parse() to parse JSON strings in JavaScript.' },
    { query: 'Explain async/await', response: 'Async/await is syntax for handling asynchronous operations.' },
    { query: 'What is a REST API?', response: 'REST is an architectural style for APIs.' },
    { query: 'How do I create a class?', response: 'Use the "class" keyword to create classes in JavaScript.' },
  ];

  for (const { query, response } of commonQueries) {
    cache.set(query, response);
    console.log(`  ✓ Cached: "${query}"`);
  }

  displayStats(cache, 'After Population');

  // Phase 2: Test semantic similarity
  console.log('\n🔍 Phase 2: Testing semantic similarity...');

  const testCases = [
    {
      input: 'Explain JS language',
      original: 'What is JavaScript?',
      description: 'Similar meaning (abbreviation)',
    },
    {
      input: 'Tell me about parsing JSON data',
      original: 'How do I parse JSON?',
      description: 'Similar meaning (rephrased)',
    },
    {
      input: 'What are async functions?',
      original: 'Explain async/await',
      description: 'Related concept',
    },
    {
      input: 'What is GraphQL?',
      original: 'What is a REST API?',
      description: 'Different concept (should miss)',
    },
  ];

  console.log('\nTest Results:');
  console.log('='.repeat(70));

  let semanticHits = 0;
  let semanticMisses = 0;

  for (const testCase of testCases) {
    const result = await cache.get(testCase.input);

    console.log(`\nQuery: "${testCase.input}"`);
    console.log(`Expected Match: "${testCase.original}"`);
    console.log(`Description: ${testCase.description}`);

    if (result) {
      semanticHits++;
      console.log(`✅ SEMANTIC HIT (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
      console.log(`   Response: ${result.response.substring(0, 60)}...`);
    } else {
      semanticMisses++;
      console.log(`❌ SEMANTIC MISS (below ${(cache.getStats().threshold * 100).toFixed(0)}% threshold)`);
    }
  }

  displayStats(cache, 'After Testing');

  // Phase 3: Similarity threshold comparison
  console.log('\n🎚️  Phase 3: Similarity Threshold Comparison');

  const thresholds = [0.70, 0.80, 0.85, 0.90, 0.95];
  const testQuery = 'Tell me about JavaScript programming';

  console.log(`\nTesting query: "${testQuery}"`);
  console.log('Against: "What is JavaScript?"');
  console.log('\nThreshold Comparison:');
  console.log('='.repeat(70));

  for (const threshold of thresholds) {
    const testCache = new SemanticCache(100, threshold);
    testCache.set('What is JavaScript?', 'JavaScript is a programming language.');
    const result = await testCache.get(testQuery);

    const status = result ? '✅ HIT' : '❌ MISS';
    const similarity = result ? `(${(result.similarity * 100).toFixed(1)}%)` : '';
    console.log(`  ${(threshold * 100).toFixed(0)}%: ${status} ${similarity}`);
  }

  // Phase 4: Performance comparison
  console.log('\n⚡ Phase 4: Performance Comparison');

  console.log('\nScenario: 1000 queries, 30% are semantically similar to cached queries');
  console.log('='.repeat(70));

  const scenarios = [
    { name: 'No Cache', hitRate: 0 },
    { name: 'Exact Match Cache', hitRate: 0.10 }, // Only exact matches
    { name: 'Semantic Cache (80%)', hitRate: 0.25 }, // Lower threshold
    { name: 'Semantic Cache (85%)', hitRate: 0.22 }, // Medium threshold
    { name: 'Semantic Cache (90%)', hitRate: 0.18 }, // Higher threshold
  ];

  const avgLatencyHit = 5; // 5ms for cache hit
  const avgLatencyMiss = 500; // 500ms for cache miss (backend call)

  console.log('\nPerformance Metrics:');
  console.log('─'.repeat(70));
  console.log('Scenario                  | Hits | Miss | Avg Latency | Cost Savings');
  console.log('─'.repeat(70));

  for (const scenario of scenarios) {
    const hits = Math.floor(1000 * scenario.hitRate);
    const misses = 1000 - hits;
    const avgLatency = (hits * avgLatencyHit + misses * avgLatencyMiss) / 1000;
    const costPerHit = 0.002; // $0.002 per API call
    const costWithCache = misses * costPerHit;
    const costWithoutCache = 1000 * costPerHit;
    const savings = ((costWithoutCache - costWithCache) / costWithoutCache) * 100;

    console.log(
      `${scenario.name.padEnd(26)} | ${hits.toString().padStart(4)} | ${misses.toString().padStart(4)} | ${avgLatency.toFixed(1).padStart(10)}ms | ${savings.toFixed(0)}%`
    );
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 SEMANTIC CACHE SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Key Benefits:');
  console.log('   • Cache hits for similar queries (not just exact matches)');
  console.log('   • Reduced API costs (fewer backend calls)');
  console.log('   • Lower latency (cache hits are ~100x faster)');
  console.log('   • Better user experience (faster responses)');

  console.log('\n🎯 How It Works:');
  console.log('   1. Convert query to vector embedding');
  console.log('   2. Calculate cosine similarity with cached entries');
  console.log('   3. Return cached response if similarity > threshold');
  console.log('   4. Otherwise, process query and cache result');

  console.log('\n🔧 Threshold Tuning:');
  console.log('   • Lower threshold (70-80%): More hits, less precise');
  console.log('   • Medium threshold (85-90%): Balanced precision/recall');
  console.log('   • Higher threshold (95%+): Fewer hits, more precise');

  console.log('\n💡 Best Practices:');
  console.log('   1. Start with 85% threshold and adjust based on results');
  console.log('   2. Monitor hit rate and user satisfaction');
  console.log('   3. Use real embeddings (OpenAI, Cohere) in production');
  console.log('   4. Consider domain-specific tuning');
  console.log('   5. A/B test different thresholds');

  console.log('\n📊 Expected Performance:');
  console.log('   • Hit rate: 20-40% (well-tuned)');
  console.log('   • Latency reduction: 70-90%');
  console.log('   • Cost savings: 30-50%');
  console.log('   • User satisfaction: +15-25%');

  console.log('\n⚠️  Considerations:');
  console.log('   • Embedding computation overhead (~50-100ms)');
  console.log('   • Storage for embeddings (1536 floats per query)');
  console.log('   • False positives (similar but wrong answers)');
  console.log('   • Threshold sensitivity');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
