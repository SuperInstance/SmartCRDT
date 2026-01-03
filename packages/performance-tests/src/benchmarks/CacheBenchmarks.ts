/**
 * @lsi/performance-tests
 *
 * Cache benchmarks for semantic cache lookup, multi-level cache operations,
 * embedding operations, and cache eviction.
 */

import { createTracker, type BenchmarkResult } from "../Runner.js";

/**
 * Cache entry type
 */
interface CacheEntry {
  key: string;
  value: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Multi-level cache entry
 */
interface MultiLevelEntry {
  l1?: CacheEntry;
  l2?: CacheEntry;
  l3?: CacheEntry;
}

/**
 * Run cache-related benchmarks
 */
export async function runCacheBenchmarks(): Promise<BenchmarkResult> {
  const tracker = createTracker({
    time: 2000,
    iterations: 100,
    warmup: true,
    warmupIterations: 20,
  });

  // Create test data
  const testEmbedding = Array.from({ length: 1536 }, () => Math.random() - 0.5);

  // Create cache entries
  const cacheEntries = Array.from({ length: 1000 }, (_, i) => ({
    key: `query-${i}`,
    value: `Response for query ${i}`,
    embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
    timestamp: Date.now() - i * 1000,
    ttl: 3600000,
    hits: Math.floor(Math.random() * 100),
  }));

  // Create LRU cache simulation
  class LRUCache {
    private cache = new Map<string, CacheEntry>();
    private maxSize: number;

    constructor(maxSize: number) {
      this.maxSize = maxSize;
    }

    get(key: string): CacheEntry | undefined {
      const entry = this.cache.get(key);
      if (entry) {
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        entry.hits++;
      }
      return entry;
    }

    set(key: string, value: CacheEntry): void {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.maxSize) {
        // Remove least recently used (first item)
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
    }

    size(): number {
      return this.cache.size;
    }
  }

  // Create caches for multi-level benchmark
  const l1Cache = new LRUCache(100);
  const l2Cache = new LRUCache(1000);
  const l3Cache = new LRUCache(10000);

  // Populate caches
  for (const entry of cacheEntries.slice(0, 100)) {
    l1Cache.set(entry.key, entry);
  }
  for (const entry of cacheEntries.slice(0, 500)) {
    l2Cache.set(entry.key, entry);
  }
  for (const entry of cacheEntries) {
    l3Cache.set(entry.key, entry);
  }

  // Run benchmarks
  return await tracker.runBenchmark("Cache Operations", {
    // Semantic Cache Operations
    "Cache lookup (Map, 1000 entries)": () => {
      const map = new Map(cacheEntries.map(e => [e.key, e]));
      const key = `query-${Math.floor(Math.random() * 1000)}`;
      return map.get(key);
    },

    "Cache lookup (Object, 1000 entries)": () => {
      const obj: Record<string, CacheEntry> = {};
      for (const entry of cacheEntries) {
        obj[entry.key] = entry;
      }
      const key = `query-${Math.floor(Math.random() * 1000)}`;
      return obj[key];
    },

    "Cache insertion (Map)": () => {
      const map = new Map<string, CacheEntry>();
      for (const entry of cacheEntries) {
        map.set(entry.key, entry);
      }
      return map.size;
    },

    "Cache deletion (Map)": () => {
      const map = new Map(cacheEntries.map(e => [e.key, e]));
      for (let i = 0; i < 100; i++) {
        map.delete(`query-${i}`);
      }
      return map.size;
    },

    "Cache hit rate calculation": () => {
      const hits = cacheEntries.reduce((sum, e) => sum + e.hits, 0);
      const total = cacheEntries.length * 10; // Assume 10 queries per entry
      return hits / total;
    },

    // Embedding Operations
    "Embedding generation simulation (1536-dim)": () => {
      return Array.from({ length: 1536 }, () => Math.random() - 0.5);
    },

    "Embedding serialization (1536-dim to JSON)": () => {
      return JSON.stringify(testEmbedding);
    },

    "Embedding deserialization (JSON to array)": () => {
      const json = JSON.stringify(testEmbedding);
      return JSON.parse(json);
    },

    "Cosine similarity calculation (1536-dim)": () => {
      const v1 = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      const v2 = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
      }

      return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    },

    "Batch similarity search (compare to 100 embeddings)": () => {
      const query = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      const candidates = Array.from({ length: 100 }, () =>
        Array.from({ length: 1536 }, () => Math.random() - 0.5)
      );

      const similarities = candidates.map(candidate => {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < query.length; i++) {
          dotProduct += query[i] * candidate[i];
          norm1 += query[i] * query[i];
          norm2 += candidate[i] * candidate[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      });

      return Math.max(...similarities);
    },

    // Multi-Level Cache Operations
    "L1 cache lookup (100 entries)": () => {
      const key = `query-${Math.floor(Math.random() * 100)}`;
      return l1Cache.get(key);
    },

    "L2 cache lookup (500 entries)": () => {
      const key = `query-${Math.floor(Math.random() * 500)}`;
      return l2Cache.get(key);
    },

    "L3 cache lookup (1000 entries)": () => {
      const key = `query-${Math.floor(Math.random() * 1000)}`;
      return l3Cache.get(key);
    },

    "Multi-level cache cascade lookup": () => {
      const key = `query-${Math.floor(Math.random() * 1000)}`;
      return l1Cache.get(key) || l2Cache.get(key) || l3Cache.get(key);
    },

    "Multi-level cache population": () => {
      const entry: CacheEntry = {
        key: "new-query",
        value: "New response",
        embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
        timestamp: Date.now(),
        ttl: 3600000,
        hits: 0,
      };

      l1Cache.set(entry.key, entry);
      l2Cache.set(entry.key, entry);
      l3Cache.set(entry.key, entry);

      return entry.key;
    },

    // Cache Eviction Operations
    "LRU eviction (evict 10 from 100)": () => {
      const cache = new LRUCache(100);
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, {
          key: `key-${i}`,
          value: `value-${i}`,
          embedding: [],
          timestamp: Date.now(),
          ttl: 3600000,
          hits: 0,
        });
      }

      // Add 10 more to trigger eviction
      for (let i = 100; i < 110; i++) {
        cache.set(`key-${i}`, {
          key: `key-${i}`,
          value: `value-${i}`,
          embedding: [],
          timestamp: Date.now(),
          ttl: 3600000,
          hits: 0,
        });
      }

      return cache.size();
    },

    "TTL-based eviction (check 1000 entries)": () => {
      const now = Date.now();
      const validEntries = cacheEntries.filter(e => now - e.timestamp < e.ttl);
      return validEntries.length;
    },

    "Cache invalidation by pattern": () => {
      const pattern = /^query-[0-9]$/;
      const invalidKeys = cacheEntries.filter(e => pattern.test(e.key));
      return invalidKeys.length;
    },

    "Cache clear operation": () => {
      const cache = new LRUCache(1000);
      for (const entry of cacheEntries.slice(0, 1000)) {
        cache.set(entry.key, entry);
      }
      // Simulate clear by creating new cache
      const newCache = new LRUCache(1000);
      return newCache.size();
    },

    // Cache Statistics
    "Cache size calculation": () => {
      const sizeInBytes = cacheEntries.reduce((sum, entry) => {
        const keySize = entry.key.length * 2; // UTF-16
        const valueSize = entry.value.length * 2;
        const embeddingSize = entry.embedding.length * 8; // Float64
        return sum + keySize + valueSize + embeddingSize;
      }, 0);
      return sizeInBytes;
    },

    "Cache compression ratio estimation": () => {
      const originalSize = JSON.stringify(cacheEntries).length;
      const compressedSize = originalSize * 0.4; // Assume 60% compression
      return compressedSize / originalSize;
    },

    "Cache priority scoring": () => {
      const scores = cacheEntries.map(entry => {
        const recency = 1 - (Date.now() - entry.timestamp) / (1000 * 60 * 60); // Decay over 1 hour
        const frequency = Math.min(entry.hits / 100, 1); // Cap at 100 hits
        return recency * 0.5 + frequency * 0.5;
      });
      return scores;
    },

    // Advanced Cache Operations
    "Cache warming (pre-load 100 entries)": () => {
      const warmCache = new LRUCache(100);
      for (let i = 0; i < 100; i++) {
        warmCache.set(`warm-key-${i}`, {
          key: `warm-key-${i}`,
          value: `warm-value-${i}`,
          embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
          timestamp: Date.now(),
          ttl: 3600000,
          hits: 0,
        });
      }
      return warmCache.size();
    },

    "Cache partitioning (by query type)": () => {
      const partitions = new Map<string, CacheEntry[]>();
      for (const entry of cacheEntries) {
        const type = entry.key.includes("0") ? "frequent" : "infrequent";
        const entries = partitions.get(type) || [];
        entries.push(entry);
        partitions.set(type, entries);
      }
      return partitions.size;
    },

    "Distributed cache key generation": () => {
      const key = "query-123";
      const numShards = 10;
      const shard =
        Math.abs(key.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) %
        numShards;
      return `shard-${shard}:${key}`;
    },

    "Cache hit ratio tracking (sliding window)": () => {
      const windowSize = 100;
      const hits = Array.from(
        { length: windowSize },
        () => Math.random() > 0.5
      );
      const hitRatio = hits.filter(h => h).length / hits.length;
      return hitRatio;
    },
  });
}

/**
 * Run benchmarks and export results
 */
export async function runAndExport(): Promise<void> {
  const result = await runCacheBenchmarks();

  console.log("\n" + "=".repeat(80));
  console.log("CACHE BENCHMARK RESULTS");
  console.log("=".repeat(80));
  console.log(result);

  const tracker = createTracker();
  await tracker.saveToFile("./benchmark-results-cache.json", result);

  const markdown = tracker.exportMarkdown(result);
  console.log("\n" + markdown);
}
