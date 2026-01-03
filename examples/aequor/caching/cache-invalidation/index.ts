#!/usr/bin/env node
/**
 * Cache Invalidation Example
 *
 * This example demonstrates various cache invalidation strategies.
 * "Cache invalidation is one of the hardest problems in computer science."
 *
 * Strategies demonstrated:
 * - TTL (Time-To-Live) - Expire after fixed duration
 * - LRU (Least Recently Used) - Evict oldest entries
 * - LFU (Least Frequently Used) - Evict entries with fewest hits
 * - Sliding Expiration - Reset TTL on access
 * - Manual/Pattern-based - Evict by query pattern
 * - Tag-based - Group and invalidate by tag
 * - Adaptive - Dynamic strategy based on metrics
 *
 * Run: npx tsx index.ts
 */

// Mock cache entry for demonstration
interface MockCacheEntry {
  query: string;
  response: string;
  createdAt: number;
  lastAccessedAt: number;
  hitCount: number;
  tags?: string[];
  ttl?: number;
}

/**
 * Mock Cache for demonstration
 */
class MockCache {
  private entries = new Map<string, MockCacheEntry>();

  set(query: string, response: string, tags?: string[], ttl?: number) {
    const now = Date.now();
    this.entries.set(query, {
      query,
      response,
      createdAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      tags,
      ttl,
    });
  }

  get(query: string): MockCacheEntry | undefined {
    const entry = this.entries.get(query);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.hitCount++;
      return entry;
    }
    return undefined;
  }

  delete(query: string): boolean {
    return this.entries.delete(query);
  }

  size(): number {
    return this.entries.size;
  }

  getAllEntries(): MockCacheEntry[] {
    return Array.from(this.entries.values());
  }

  clear() {
    this.entries.clear();
  }
}

/**
 * Invalidation Strategy
 */
type InvalidationStrategy = 'ttl' | 'lru' | 'lfu' | 'sliding' | 'pattern' | 'tag' | 'adaptive';

/**
 * Invalidation Result
 */
interface InvalidationResult {
  strategy: InvalidationStrategy;
  count: number;
  entries: string[];
  duration: number;
}

/**
 * Cache Invalidator
 */
class CacheInvalidator {
  constructor(private cache: MockCache) {}

  /**
   * Invalidate by TTL (Time-To-Live)
   */
  invalidateTTL(maxAge: number): InvalidationResult {
    const startTime = Date.now();
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const entry of this.cache.getAllEntries()) {
      const age = now - entry.createdAt;
      if (age > maxAge) {
        entriesToDelete.push(entry.query);
      }
    }

    entriesToDelete.forEach(query => this.cache.delete(query));

    return {
      strategy: 'ttl',
      count: entriesToDelete.length,
      entries: entriesToDelete,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Invalidate by LRU (Least Recently Used)
   */
  invalidateLRU(count: number): InvalidationResult {
    const startTime = Date.now();
    const entries = this.cache.getAllEntries();
    const now = Date.now();

    // Sort by last accessed time (oldest first)
    const sorted = entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const toDelete = sorted.slice(0, count);

    toDelete.forEach(entry => this.cache.delete(entry.query));

    return {
      strategy: 'lru',
      count: toDelete.length,
      entries: toDelete.map(e => e.query),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Invalidate by LFU (Least Frequently Used)
   */
  invalidateLFU(count: number): InvalidationResult {
    const startTime = Date.now();
    const entries = this.cache.getAllEntries();

    // Sort by hit count (lowest first)
    const sorted = entries.sort((a, b) => a.hitCount - b.hitCount);
    const toDelete = sorted.slice(0, count);

    toDelete.forEach(entry => this.cache.delete(entry.query));

    return {
      strategy: 'lfu',
      count: toDelete.length,
      entries: toDelete.map(e => e.query),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Invalidate by sliding expiration (reset TTL on access)
   */
  invalidateSliding(ttl: number): InvalidationResult {
    const startTime = Date.now();
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const entry of this.cache.getAllEntries()) {
      const timeSinceAccess = now - entry.lastAccessedAt;
      if (timeSinceAccess > ttl) {
        entriesToDelete.push(entry.query);
      }
    }

    entriesToDelete.forEach(query => this.cache.delete(query));

    return {
      strategy: 'sliding',
      count: entriesToDelete.length,
      entries: entriesToDelete,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Invalidate by pattern (regex matching)
   */
  invalidatePattern(pattern: RegExp): InvalidationResult {
    const startTime = Date.now();
    const entriesToDelete: string[] = [];

    for (const entry of this.cache.getAllEntries()) {
      if (pattern.test(entry.query)) {
        entriesToDelete.push(entry.query);
      }
    }

    entriesToDelete.forEach(query => this.cache.delete(query));

    return {
      strategy: 'pattern',
      count: entriesToDelete.length,
      entries: entriesToDelete,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Invalidate by tag
   */
  invalidateTag(tag: string): InvalidationResult {
    const startTime = Date.now();
    const entriesToDelete: string[] = [];

    for (const entry of this.cache.getAllEntries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        entriesToDelete.push(entry.query);
      }
    }

    entriesToDelete.forEach(query => this.cache.delete(query));

    return {
      strategy: 'tag',
      count: entriesToDelete.length,
      entries: entriesToDelete,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Adaptive invalidation based on cache metrics
   */
  invalidateAdaptive(maxSize: number, targetHitRate: number): InvalidationResult {
    const startTime = Date.now();
    const entries = this.cache.getAllEntries();

    // Calculate current hit rate
    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
    const avgHitRate = totalHits / entries.length;

    let strategy: InvalidationStrategy = 'lru';
    let toDelete: MockCacheEntry[] = [];

    if (entries.length > maxSize) {
      // Over capacity: use LRU
      strategy = 'lru';
      const excess = entries.length - maxSize;
      toDelete = entries
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        .slice(0, excess);
    } else if (avgHitRate < targetHitRate) {
      // Low hit rate: use LFU to remove unpopular entries
      strategy = 'lfu';
      const removalCount = Math.floor(entries.length * 0.1); // Remove 10%
      toDelete = entries
        .sort((a, b) => a.hitCount - b.hitCount)
        .slice(0, removalCount);
    }

    toDelete.forEach(entry => this.cache.delete(entry.query));

    return {
      strategy: 'adaptive',
      count: toDelete.length,
      entries: toDelete.map(e => e.query),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Display invalidation result
 */
function displayInvalidationResult(result: InvalidationResult, cacheSize: number) {
  const emoji: Record<InvalidationStrategy, string> = {
    ttl: '⏰',
    lru: '📅',
    lfu: '📊',
    sliding: '🔄',
    pattern: '🔍',
    tag: '🏷️ ',
    adaptive: '🧠',
  };

  console.log(`\n${emoji[result.strategy]} ${result.strategy.toUpperCase()} Invalidation`);
  console.log('  '.repeat(10));
  console.log(`  Entries Invalidated: ${result.count}`);
  console.log(`  Cache Size After: ${cacheSize}`);
  console.log(`  Duration: ${result.duration}ms`);

  if (result.entries.length > 0) {
    console.log(`  Invalidated Queries:`);
    for (const query of result.entries.slice(0, 5)) {
      const truncated = query.length > 50 ? query.substring(0, 47) + '...' : query;
      console.log(`    - ${truncated}`);
    }
    if (result.entries.length > 5) {
      console.log(`    ... and ${result.entries.length - 5} more`);
    }
  }
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Cache Invalidation Example                              ║');
  console.log('║        "Cache invalidation is one of the hardest problems"            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const cache = new MockCache();
  const invalidator = new CacheInvalidator(cache);

  // Populate cache with sample data
  console.log('\n📦 Populating cache with sample data...');

  const now = Date.now();

  // Add entries with different ages
  cache.set('What is JavaScript?', 'JavaScript is a programming language.', ['programming'], 60000);
  cache.set('How do I write a for loop?', 'Use: for (let i = 0; i < n; i++) {}', ['programming'], 60000);

  // Simulate some entries being older
  const oldEntry1 = cache.get('What is JavaScript?');
  if (oldEntry1) {
    (oldEntry1 as any).createdAt = now - 100000; // 100 seconds ago
    (oldEntry1 as any).lastAccessedAt = now - 90000;
  }

  // Add more entries with varying hit counts
  cache.set('What is the capital of France?', 'Paris', ['geography'], 60000);
  cache.set('Explain async/await', 'Async/await is syntax for promises', ['programming'], 60000);
  cache.set('What is a REST API?', 'REST is an API architecture', ['programming', 'api'], 60000);

  // Simulate some entries being accessed more
  for (let i = 0; i < 10; i++) {
    cache.get('What is JavaScript?');
  }
  for (let i = 0; i < 5; i++) {
    cache.get('Explain async/await');
  }
  for (let i = 0; i < 2; i++) {
    cache.get('What is a REST API?');
  }

  // Add tagged entries
  cache.set('How do I create a React component?', 'Use function components or class components', ['react', 'programming'], 60000);
  cache.set('What is Redux?', 'Redux is a state management library', ['react', 'state'], 60000);
  cache.set('Explain React hooks', 'Hooks are functions that let you use state', ['react', 'hooks'], 60000);

  console.log(`✓ Cache populated with ${cache.size()} entries`);

  // Display initial cache state
  console.log('\n' + '='.repeat(70));
  console.log('📊 Initial Cache State');
  console.log('='.repeat(70));

  for (const entry of cache.getAllEntries()) {
    const age = Math.floor((Date.now() - entry.createdAt) / 1000);
    const truncated = entry.query.length > 40 ? entry.query.substring(0, 37) + '...' : entry.query;
    console.log(`  Query: "${truncated}"`);
    console.log(`    Age: ${age}s, Hits: ${entry.hitCount}, Tags: [${entry.tags?.join(', ') || 'none'}]`);
  }

  // Strategy 1: TTL Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('⏰ STRATEGY 1: TTL (Time-To-Live) Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Remove entries older than specified duration');
  console.log('Use Case: Time-sensitive data (news, stock prices, etc.)');

  const result1 = invalidator.invalidateTTL(60000); // 60 seconds
  displayInvalidationResult(result1, cache.size());

  // Strategy 2: LRU Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('📅 STRATEGY 2: LRU (Least Recently Used) Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Remove entries that haven\'t been accessed recently');
  console.log('Use Case: Limited cache space, prefer active entries');

  const result2 = invalidator.invalidateLRU(2);
  displayInvalidationResult(result2, cache.size());

  // Strategy 3: LFU Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('📊 STRATEGY 3: LFU (Least Frequently Used) Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Remove entries with lowest hit counts');
  console.log('Use Case: Keep popular entries, remove unpopular ones');

  const result3 = invalidator.invalidateLFU(1);
  displayInvalidationResult(result3, cache.size());

  // Strategy 4: Pattern-based Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('🔍 STRATEGY 4: Pattern-Based Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Remove entries matching a regex pattern');
  console.log('Use Case: Invalidate by query type or topic');

  const result4 = invalidator.invalidatePattern(/React|redux/i);
  displayInvalidationResult(result4, cache.size());

  // Strategy 5: Tag-based Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('🏷️  STRATEGY 5: Tag-Based Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Remove entries with specific tags');
  console.log('Use Case: Invalidate by category or topic group');

  const result5 = invalidator.invalidateTag('programming');
  displayInvalidationResult(result5, cache.size());

  // Strategy 6: Sliding Expiration
  console.log('\n' + '='.repeat(70));
  console.log('🔄 STRATEGY 6: Sliding Expiration');
  console.log('='.repeat(70));
  console.log('Description: Remove entries not accessed within TTL window');
  console.log('Use Case: Keep active entries, expire inactive ones');

  const result6 = invalidator.invalidateSliding(120000); // 2 minutes
  displayInvalidationResult(result6, cache.size());

  // Strategy 7: Adaptive Invalidation
  console.log('\n' + '='.repeat(70));
  console.log('🧠 STRATEGY 7: Adaptive Invalidation');
  console.log('='.repeat(70));
  console.log('Description: Dynamic strategy based on cache metrics');
  console.log('Use Case: Automatically optimize based on performance');

  const result7 = invalidator.invalidateAdaptive(10, 0.5); // Max 10 entries, target 50% hit rate
  displayInvalidationResult(result7, cache.size());

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 CACHE INVALIDATION SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Strategies Demonstrated:');
  console.log('   1. TTL (Time-To-Live) - Age-based expiration');
  console.log('   2. LRU (Least Recently Used) - Access time-based');
  console.log('   3. LFU (Least Frequently Used) - Popularity-based');
  console.log('   4. Pattern-based - Regex matching');
  console.log('   5. Tag-based - Category grouping');
  console.log('   6. Sliding Expiration - Activity-based');
  console.log('   7. Adaptive - Dynamic/metric-based');

  console.log('\n💡 When to Use Each Strategy:');
  console.log('');
  console.log('   TTL:');
  console.log('   • Time-sensitive data (news, prices, weather)');
  console.log('   • Data with known expiration times');
  console.log('   • Compliance requirements (data retention)');
  console.log('');
  console.log('   LRU:');
  console.log('   • Limited cache space');
  console.log('   • Temporal locality (recently accessed = likely to be accessed again)');
  console.log('   • Simple and effective for most cases');
  console.log('');
  console.log('   LFU:');
  console.log('   • Keep popular items');
  console.log('   • Remove rarely-accessed items');
  console.log('   • Good for stable access patterns');
  console.log('');
  console.log('   Pattern-based:');
  console.log('   • Invalidate by query type');
  console.log('   • Topic-based invalidation');
  console.log('   • Fine-grained control');
  console.log('');
  console.log('   Tag-based:');
  console.log('   • Group-related entries');
  console.log('   • Bulk invalidation by category');
  console.log('   • Hierarchical organization');
  console.log('');
  console.log('   Sliding Expiration:');
  console.log('   • Keep active entries fresh');
  console.log('   • Expire inactive entries');
  console.log('   • Good for session data');
  console.log('');
  console.log('   Adaptive:');
  console.log('   • Automatic optimization');
  console.log('   • Response to changing patterns');
  console.log('   • Best for dynamic workloads');

  console.log('\n🎯 Best Practices:');
  console.log('   1. Use TTL for time-sensitive data');
  console.log('   2. Use LRU for general-purpose caching');
  console.log('   3. Use LFU for stable access patterns');
  console.log('   4. Use tags for organized invalidation');
  console.log('   5. Monitor cache metrics to tune strategies');
  console.log('   6. Combine multiple strategies for complex scenarios');
  console.log('   7. Test invalidation impact on performance');

  console.log('\n⚠️  Common Pitfalls:');
  console.log('   • Too aggressive: Frequent cache misses');
  console.log('   • Too passive: Stale data, memory bloat');
  console.log('   • Wrong strategy: Mismatched to access pattern');
  console.log('   • No monitoring: Can\'t tell if it\'s working');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
