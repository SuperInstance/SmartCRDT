/**
 * Memory Profiling Tools for Semantic Cache
 *
 * Provides comprehensive memory analysis:
 * - Heap usage tracking
 * - Memory leak detection
 * - Per-entry memory estimation
 * - Growth pattern analysis
 * - Memory pressure simulation
 * - GC behavior monitoring
 *
 * @packageDocumentation
 */

import { SemanticCache } from "@lsi/cascade";
import type { RefinedQuery, QueryType } from "@lsi/cascade";
import { performance } from "perf_hooks";

// ============================================================================
// Type Definitions
// ============================================================================

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryProfile {
  baseline: MemorySnapshot;
  snapshots: MemorySnapshot[];
  growth: {
    totalDelta: number;
    avgDelta: number;
    maxDelta: number;
    growthRate: number; // bytes per second
  };
  leaks: {
    suspected: boolean;
    evidence: string[];
  };
}

export interface MemoryPressureTestResult {
  maxEntries: number;
  memoryLimit: number;
  actualMemoryMB: number;
  passed: boolean;
  breakdown: {
    perEntryBytes: number;
    overheadBytes: number;
    efficiency: number; // actual / theoretical
  };
}

export interface GCMetrics {
  collections: number;
  duration: number;
  before: MemorySnapshot;
  after: MemorySnapshot;
  freed: number;
}

// ============================================================================
// Memory Profiling
// ============================================================================

/**
 * Memory Profiler
 */
export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private baseline: MemorySnapshot | null = null;

  /**
   * Start profiling
   */
  start(): void {
    this.snapshots = [];
    this.baseline = this.takeSnapshot();
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    };
  }

  /**
   * Record a snapshot
   */
  record(label?: string): MemorySnapshot {
    const snapshot = this.takeSnapshot();
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get memory profile
   */
  getProfile(): MemoryProfile {
    if (!this.baseline) {
      throw new Error("Profiling not started. Call start() first.");
    }

    const deltas = this.snapshots.map(s => s.heapUsed - this.baseline.heapUsed);
    const totalDelta = deltas.length > 0 ? deltas[deltas.length - 1] : 0;
    const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const maxDelta = deltas.length > 0 ? Math.max(...deltas) : 0;

    // Calculate growth rate
    const duration = this.snapshots[this.snapshots.length - 1].timestamp - this.baseline.timestamp;
    const growthRate = duration > 0 ? (totalDelta / duration) * 1000 : 0; // bytes per second

    // Detect potential leaks
    const suspectedLeaks = this.detectLeaks();

    return {
      baseline: this.baseline,
      snapshots: this.snapshots,
      growth: {
        totalDelta,
        avgDelta,
        maxDelta,
        growthRate
      },
      leaks: suspectedLeaks
    };
  }

  /**
   * Detect memory leaks
   */
  private detectLeaks(): { suspected: boolean; evidence: string[] } {
    const evidence: string[] = [];
    let suspected = false;

    if (this.snapshots.length < 3) {
      return { suspected: false, evidence: [] };
    }

    // Check for monotonic growth
    const deltas = this.snapshots.map(s => s.heapUsed - this.baseline!.heapUsed);
    const growing = deltas.every((d, i) => i === 0 || d >= deltas[i - 1] * 0.95);

    if (growing && deltas[deltas.length - 1] > 10 * 1024 * 1024) {
      suspected = true;
      evidence.push("Memory shows monotonic growth pattern");
    }

    // Check if growth rate is high
    const profile = this.getProfile();
    if (profile.growth.growthRate > 1024 * 1024) { // > 1MB/s
      suspected = true;
      evidence.push(`High growth rate: ${(profile.growth.growthRate / 1024 / 1024).toFixed(2)} MB/s`);
    }

    // Check if memory not released after operations
    const lastFew = deltas.slice(-5);
    const stillGrowing = lastFew.every((d, i) => i === 0 || d >= lastFew[i - 1] * 0.98);

    if (stillGrowing && lastFew[lastFew.length - 1] > 5 * 1024 * 1024) {
      suspected = true;
      evidence.push("Memory not released after operations complete");
    }

    return { suspected, evidence };
  }

  /**
   * Format memory size for display
   */
  static formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Print memory profile summary
   */
  printProfile(): void {
    const profile = this.getProfile();

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("              MEMORY PROFILE SUMMARY");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log("Baseline:");
    console.log(`  Heap Used:   ${MemoryProfiler.formatBytes(profile.baseline.heapUsed)}`);
    console.log(`  Heap Total:  ${MemoryProfiler.formatBytes(profile.baseline.heapTotal)}`);
    console.log(`  RSS:         ${MemoryProfiler.formatBytes(profile.baseline.rss)}`);

    console.log("\nGrowth:");
    console.log(`  Total Delta:    ${MemoryProfiler.formatBytes(profile.growth.totalDelta)}`);
    console.log(`  Avg Delta:      ${MemoryProfiler.formatBytes(profile.growth.avgDelta)}`);
    console.log(`  Max Delta:      ${MemoryProfiler.formatBytes(profile.growth.maxDelta)}`);
    console.log(`  Growth Rate:    ${MemoryProfiler.formatBytes(profile.growth.growthRate)}/s`);

    console.log("\nLeak Detection:");
    console.log(`  Suspected:  ${profile.leaks.suspected ? "⚠️  YES" : "✅ No"}`);
    if (profile.leaks.evidence.length > 0) {
      console.log("  Evidence:");
      for (const evidence of profile.leaks.evidence) {
        console.log(`    - ${evidence}`);
      }
    }

    console.log("\n═══════════════════════════════════════════════════════════\n");
  }
}

// ============================================================================
// Memory Pressure Testing
// ============================================================================

/**
 * Generate synthetic embedding
 */
function generateEmbedding(seed: string): number[] {
  const dimensions = 1536;
  const embedding: number[] = [];
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  for (let i = 0; i < dimensions; i++) {
    const value = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
    embedding.push(value);
  }

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

/**
 * Create refined query
 */
function createRefinedQuery(query: string, queryType: QueryType): RefinedQuery {
  return {
    cacheKey: `query:${queryType}:${query}`,
    original: query,
    semanticFeatures: {
      embedding: generateEmbedding(query),
      complexity: 0.5,
      confidence: 0.9,
      keywords: []
    },
    staticFeatures: {
      queryType,
      length: query.length,
      wordCount: query.split(" ").length,
      hasCode: false,
      hasNumbers: /\d/.test(query)
    }
  };
}

/**
 * Memory Pressure Test
 */
export class MemoryPressureTest {
  /**
   * Test memory usage with large number of entries
   */
  async testMemoryPressure(
    entryCount: number,
    memoryLimitMB: number
  ): Promise<MemoryPressureTestResult> {
    const profiler = new MemoryProfiler();
    profiler.start();

    const cache = new SemanticCache({
      maxSize: entryCount * 2, // Allow room
      similarityThreshold: 0.85,
      enableHNSW: true
    });

    console.log(`\nTesting ${entryCount.toLocaleString()} entries with ${memoryLimitMB}MB limit...\n`);

    // Add entries
    for (let i = 0; i < entryCount; i++) {
      const query = `Query ${i}: How do I implement feature X in language Y?`;
      const refinedQuery = createRefinedQuery(query, "code");
      await cache.set(refinedQuery, `Response ${i}: This is a detailed response to the query about implementing feature X in language Y.`);

      // Progress update
      if (i > 0 && i % 10000 === 0) {
        profiler.record();
        const currentProfile = profiler.getProfile();
        const currentMB = currentProfile.growth.totalDelta / (1024 * 1024);
        console.log(`  ${i.toLocaleString()} entries - ${currentMB.toFixed(2)} MB used`);
      }
    }

    profiler.record();
    const profile = profiler.getProfile();
    const actualMemoryMB = profile.growth.totalDelta / (1024 * 1024);

    // Calculate per-entry memory
    const perEntryBytes = profile.growth.totalDelta / entryCount;

    // Estimate overhead (theoretical vs actual)
    // Theoretical: 1536 * 4 bytes (float32) + metadata (~100 bytes)
    const theoreticalPerEntry = 1536 * 4 + 100;
    const overheadBytes = perEntryBytes - theoreticalPerEntry;
    const efficiency = perEntryBytes / theoreticalPerEntry;

    const result: MemoryPressureTestResult = {
      maxEntries: entryCount,
      memoryLimit: memoryLimitMB * 1024 * 1024,
      actualMemoryMB,
      passed: actualMemoryMB < memoryLimitMB,
      breakdown: {
        perEntryBytes,
        overheadBytes,
        efficiency
      }
    };

    // Print results
    console.log("\nMemory Pressure Test Results:");
    console.log(`  Entries:           ${entryCount.toLocaleString()}`);
    console.log(`  Memory Used:       ${actualMemoryMB.toFixed(2)} MB`);
    console.log(`  Memory Limit:      ${memoryLimitMB} MB`);
    console.log(`  Status:            ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
    console.log("\nPer-Entry Breakdown:");
    console.log(`  Actual:            ${MemoryProfiler.formatBytes(perEntryBytes)}`);
    console.log(`  Theoretical:       ${MemoryProfiler.formatBytes(theoreticalPerEntry)}`);
    console.log(`  Overhead:          ${MemoryProfiler.formatBytes(overheadBytes)}`);
    console.log(`  Efficiency:        ${efficiency.toFixed(2)}x`);

    return result;
  }

  /**
   * Test memory scalability
   */
  async testScalability(): Promise<void> {
    console.log("\n╔═══════════════════════════════════════════════════════════╗");
    console.log("║           MEMORY SCALABILITY TEST                         ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    const scales = [
      { entries: 100, limit: 10 },
      { entries: 1000, limit: 50 },
      { entries: 10000, limit: 200 },
      { entries: 50000, limit: 800 },
      { entries: 100000, limit: 1500 }
    ];

    const results: Array<{ entries: number; memoryMB: number; perEntryKB: number }> = [];

    for (const scale of scales) {
      const result = await this.testMemoryPressure(scale.entries, scale.limit);
      results.push({
        entries: scale.entries,
        memoryMB: result.actualMemoryMB,
        perEntryKB: result.breakdown.perEntryBytes / 1024
      });

      // Force GC between tests
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Print scalability summary
    console.log("\nScalability Summary:");
    console.log("───────────────────────────────────────────────────────────");
    console.log("Entries     Memory (MB)   Per-Entry (KB)   Linear Growth");
    console.log("───────────────────────────────────────────────────────────");

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const expected = results[0].perEntryKB * (r.entries / results[0].entries);
      const actual = r.perEntryKB;
      const ratio = actual / expected;
      const status = ratio < 1.2 ? "✅" : ratio < 1.5 ? "⚠️" : "❌";

      console.log(
        `${r.entries.toString().padStart(8)}   ` +
        `${r.memoryMB.toFixed(2).padStart(9)}   ` +
        `${r.perEntryKB.toFixed(2).padStart(12)}   ` +
        `${status} ${ratio.toFixed(2)}x`
      );
    }

    console.log("───────────────────────────────────────────────────────────\n");
  }

  /**
   * Test memory leak detection
   */
  async testMemoryLeak(): Promise<void> {
    console.log("\n╔═══════════════════════════════════════════════════════════╗");
    console.log("║           MEMORY LEAK DETECTION TEST                     ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    const profiler = new MemoryProfiler();
    profiler.start();

    const cache = new SemanticCache({
      maxSize: 10000,
      similarityThreshold: 0.85
    });

    console.log("Phase 1: Add 1000 entries...");
    for (let i = 0; i < 1000; i++) {
      const query = `Query ${i}`;
      const refinedQuery = createRefinedQuery(query, "question");
      await cache.set(refinedQuery, `Response ${i}`);
    }
    profiler.record();

    console.log("Phase 2: Access entries 10 times each...");
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 1000; i++) {
        const query = `Query ${i}`;
        const refinedQuery = createRefinedQuery(query, "question");
        await cache.get(refinedQuery);
      }
      if (round % 3 === 0) profiler.record();
    }
    profiler.record();

    console.log("Phase 3: Clear cache...");
    cache.clear();
    profiler.record();

    console.log("Phase 4: Run GC...");
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    profiler.record();

    profiler.printProfile();

    const profile = profiler.getProfile();
    if (profile.leaks.suspected) {
      console.warn("⚠️  Potential memory leak detected!");
      for (const evidence of profile.leaks.evidence) {
        console.warn(`    ${evidence}`);
      }
    } else {
      console.log("✅ No memory leaks detected");
    }
  }
}

// ============================================================================
// GC Monitoring
// ============================================================================

/**
 * GC Monitor
 */
export class GCMonitor {
  private metrics: GCMetrics[] = [];

  /**
   * Monitor GC during operation
   */
  async monitor<T>(fn: () => Promise<T>): Promise<{ result: T; metrics: GCMetrics[] }> {
    const before = this.takeSnapshot();
    const startTime = performance.now();
    let collections = 0;

    // Hook into GC if available (Node.js with --expose-gc)
    if (global.gc) {
      // Force GC before
      global.gc();
    }

    const result = await fn();

    if (global.gc) {
      // Force GC after
      global.gc();
      collections++;
    }

    const after = this.takeSnapshot();
    const duration = performance.now() - startTime;

    const metric: GCMetrics = {
      collections,
      duration,
      before,
      after,
      freed: before.heapUsed - after.heapUsed
    };

    this.metrics.push(metric);

    return { result, metrics: this.metrics };
  }

  /**
   * Take memory snapshot
   */
  private takeSnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    };
  }

  /**
   * Print GC metrics
   */
  printMetrics(): void {
    console.log("\nGC Metrics:");
    for (const metric of this.metrics) {
      console.log(`  Collections:  ${metric.collections}`);
      console.log(`  Duration:     ${metric.duration.toFixed(2)}ms`);
      console.log(`  Memory Freed: ${MemoryProfiler.formatBytes(metric.freed)}`);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate per-entry memory usage
 */
export function estimatePerEntryMemory(): number {
  // Embedding: 1536 dimensions * 4 bytes (Float32) = 6144 bytes
  const embeddingSize = 1536 * 4;

  // Metadata: query string, result, timestamps, etc.
  const metadataSize = 200;

  // HNSW index overhead: connections, levels, etc.
  const indexOverhead = 100;

  return embeddingSize + metadataSize + indexOverhead;
}

/**
 * Calculate expected memory for N entries
 */
export function calculateExpectedMemory(entryCount: number): number {
  return entryCount * estimatePerEntryMemory();
}

/**
 * Run comprehensive memory analysis
 */
export async function runMemoryAnalysis(): Promise<void> {
  const test = new MemoryPressureTest();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║        COMPREHENSIVE MEMORY ANALYSIS                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  // Test 1: 100K entries
  console.log("\n[Test 1] 100K entries memory test");
  await test.testMemoryPressure(100000, 2000);

  // Force GC
  if (global.gc) {
    global.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Scalability
  console.log("\n[Test 2] Scalability test");
  await test.testScalability();

  // Force GC
  if (global.gc) {
    global.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Leak detection
  console.log("\n[Test 3] Memory leak detection");
  await test.testMemoryLeak();

  console.log("\n✅ Memory analysis complete\n");
}
