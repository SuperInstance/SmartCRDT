#!/usr/bin/env node
/**
 * Multi-Level Cache Example
 *
 * This example demonstrates a multi-level cache hierarchy (L1/L2/L3)
 * for optimal performance and cost-efficiency.
 *
 * Cache Levels:
 * - L1 (Memory): Fastest, smallest, ~1ms latency
 * - L2 (Redis/Network): Fast, medium size, ~10ms latency
 * - L3 (Database/Disk): Slower, largest, ~100ms latency
 *
 * Features demonstrated:
 * - Hierarchical cache lookup (L1 → L2 → L3 → Backend)
 * - Cache promotion (L3 → L2 → L1)
 * - Cache eviction and size limits
 * - Hit rate tracking per level
 * - Performance comparison
 *
 * Run: npx tsx index.ts
 */

interface CacheEntry {
  key: string;
  value: string;
  timestamp: number;
  hits: number;
}

/**
 * Cache Level
 */
class CacheLevel {
  private entries = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(
    public name: string,
    public maxSize: number,
    public latency: number
  ) {}

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.hits++;
      entry.hits++;
      return entry;
    }
    this.misses++;
    return undefined;
  }

  set(key: string, value: string): void {
    // Evict if at capacity
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      // Evict least recently used (simple FIFO for demo)
      const firstKey = this.entries.keys().next().value;
      this.entries.delete(firstKey);
    }

    this.entries.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.entries.size;
  }

  getStats() {
    return {
      name: this.name,
      size: this.entries.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
    };
  }
}

/**
 * Multi-Level Cache
 */
class MultiLevelCache {
  private l1: CacheLevel;
  private l2: CacheLevel;
  private l3: CacheLevel;

  constructor() {
    this.l1 = new CacheLevel('L1-Memory', 10, 1);
    this.l2 = new CacheLevel('L2-Redis', 50, 10);
    this.l3 = new CacheLevel('L3-Database', 200, 100);
  }

  /**
   * Get value from cache hierarchy
   */
  async get(key: string): Promise<{ value: string; level: string; latency: number } | null> {
    const startTime = Date.now();

    // Try L1 first
    let entry = this.l1.get(key);
    if (entry) {
      return { value: entry.value, level: 'L1', latency: Date.now() - startTime + this.l1.latency };
    }

    // Try L2
    entry = this.l2.get(key);
    if (entry) {
      // Promote to L1
      this.l1.set(key, entry.value);
      return { value: entry.value, level: 'L2', latency: Date.now() - startTime + this.l2.latency };
    }

    // Try L3
    entry = this.l3.get(key);
    if (entry) {
      // Promote to L2 and L1
      this.l2.set(key, entry.value);
      this.l1.set(key, entry.value);
      return { value: entry.value, level: 'L3', latency: Date.now() - startTime + this.l3.latency };
    }

    return null;
  }

  /**
   * Set value in all cache levels
   */
  set(key: string, value: string): void {
    this.l1.set(key, value);
    this.l2.set(key, value);
    this.l3.set(key, value);
  }

  /**
   * Get combined statistics
   */
  getStats() {
    return {
      l1: this.l1.getStats(),
      l2: this.l2.getStats(),
      l3: this.l3.getStats(),
    };
  }

  clear(): void {
    this.l1.clear();
    this.l2.clear();
    this.l3.clear();
  }
}

/**
 * Display cache statistics
 */
function displayStats(cache: MultiLevelCache) {
  const stats = cache.getStats();

  console.log('\n' + '='.repeat(70));
  console.log('📊 Multi-Level Cache Statistics');
  console.log('='.repeat(70));

  for (const level of ['l1', 'l2', 'l3'] as const) {
    const s = stats[level];
    console.log(`\n${s.name}:`);
    console.log(`  Size: ${s.size}/${s.maxSize}`);
    console.log(`  Hits: ${s.hits}`);
    console.log(`  Misses: ${s.misses}`);
    console.log(`  Hit Rate: ${(s.hitRate * 100).toFixed(1)}%`);
  }

  console.log('='.repeat(70));
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Multi-Level Cache Example                              ║');
  console.log('║        Hierarchical Caching (L1 → L2 → L3)                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const cache = new MultiLevelCache();

  console.log('\n📚 Cache Configuration:');
  console.log(`   L1 (Memory):   ${cache.getStats().l1.maxSize} entries, ~1ms latency`);
  console.log(`   L2 (Redis):    ${cache.getStats().l2.maxSize} entries, ~10ms latency`);
  console.log(`   L3 (Database): ${cache.getStats().l3.maxSize} entries, ~100ms latency`);

  // Phase 1: Populate cache
  console.log('\n🔄 Phase 1: Populating cache...');
  const queries = [
    'What is JavaScript?',
    'How do I parse JSON?',
    'Explain async/await',
    'What is a closure?',
    'How do I create a class?',
    'What is TypeScript?',
    'Explain map/filter/reduce',
    'How do I handle errors?',
    'What is a Promise?',
    'How do I make HTTP requests?',
    // Add more queries to fill L1 and spill to L2/L3
    'What is the DOM?',
    'Explain event bubbling',
    'What is localStorage?',
    'How do I debug code?',
    'What is npm?',
    // More queries to fill L2 and spill to L3
    'What is React?',
    'Explain virtual DOM',
    'What are React hooks?',
    'How do I manage state?',
    'What is Redux?',
    'Explain component lifecycle',
    'What is JSX?',
    'How do I fetch data in React?',
    'What is Next.js?',
    'How do I deploy React apps?',
  ];

  for (const query of queries) {
    cache.set(query, `Answer to: ${query}`);
  }

  console.log(`✓ Populated ${queries.length} queries`);

  // Display stats after population
  displayStats(cache);

  // Phase 2: Read queries and measure hits
  console.log('\n🔍 Phase 2: Reading queries...');

  const readQueries = [
    'What is JavaScript?',
    'How do I parse JSON?',
    'Explain async/await',
    'What is the DOM?',
    'What is React?',
    'How do I manage state?',
  ];

  const results: Array<{ query: string; level: string; latency: number }> = [];

  for (const query of readQueries) {
    const result = await cache.get(query);
    if (result) {
      results.push({ query, level: result.level, latency: result.latency });
      console.log(`  ✓ "${query.substring(0, 30)}..." → ${result.level} (${result.latency}ms)`);
    } else {
      console.log(`  ✗ "${query.substring(0, 30)}..." → MISS`);
    }
  }

  // Display updated stats
  displayStats(cache);

  // Phase 3: Performance comparison
  console.log('\n📊 Phase 3: Performance Analysis');

  const byLevel = new Map<string, number[]>();
  for (const r of results) {
    if (!byLevel.has(r.level)) {
      byLevel.set(r.level, []);
    }
    byLevel.get(r.level)!.push(r.latency);
  }

  console.log('\n⏱️  Latency by Level:');
  for (const [level, latencies] of byLevel.entries()) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`  ${level}: avg ${avg.toFixed(2)}ms (${latencies.length} requests)`);
  }

  // Phase 4: Hit rate calculation
  console.log('\n🎯 Phase 4: Overall Hit Rate');
  const stats = cache.getStats();
  const totalHits = stats.l1.hits + stats.l2.hits + stats.l3.hits;
  const totalMisses = stats.l1.misses + stats.l2.misses + stats.l3.misses;
  const totalRequests = totalHits + totalMisses;

  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  L1 Hits: ${stats.l1.hits} (${((stats.l1.hits / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  L2 Hits: ${stats.l2.hits} (${((stats.l2.hits / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  L3 Hits: ${stats.l3.hits} (${((stats.l3.hits / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Overall Hit Rate: ${((totalHits / totalRequests) * 100).toFixed(1)}%`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 MULTI-LEVEL CACHE SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Benefits of Multi-Level Caching:');
  console.log('   • L1 provides fastest access for hot data (~1ms)');
  console.log('   • L2 provides medium-speed access for warm data (~10ms)');
  console.log('   • L3 provides large storage for cold data (~100ms)');
  console.log('   • Automatic promotion: L3 → L2 → L1');
  console.log('   • Hierarchical eviction preserves important data');

  console.log('\n🎯 Performance Characteristics:');
  console.log('   • L1 hit: ~1ms (fastest)');
  console.log('   • L2 hit: ~10ms (fast)');
  console.log('   • L3 hit: ~100ms (acceptable)');
  console.log('   • Cache miss: Backend call (slowest, >1000ms)');

  console.log('\n💡 Design Considerations:');
  console.log('   • L1 size: Keep small for CPU cache efficiency');
  console.log('   • L2 size: Medium for network/memory balance');
  console.log('   • L3 size: Large for comprehensive coverage');
  console.log('   • Latency: Each level adds lookup cost');
  console.log('   • Promotion: Hot data automatically moves to faster levels');

  console.log('\n🔧 Configuration Tuning:');
  console.log('   • Adjust sizes based on access patterns');
  console.log('   • Monitor hit rates per level');
  console.log('   • Use L1 for very hot queries (< 10% of data)');
  console.log('   • Use L2 for warm queries (< 30% of data)');
  console.log('   • Use L3 for everything else');

  console.log('\n📈 Expected Hit Rates:');
  console.log('   • Well-tuned: L1: 60-80%, L2: 15-30%, L3: 5-10%');
  console.log('   • Good: L1: 40-60%, L2: 25-40%, L3: 10-20%');
  console.log('   • Needs tuning: L1: < 40%, L2: varies, L3: > 20%');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
