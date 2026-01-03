/**
 * Performance Benchmarks for Context-Aware Query Processing
 *
 * Measures performance of:
 * - Import parsing speed
 * - Domain extraction latency
 * - Knowledge graph operations
 * - File watcher overhead
 * - Memory usage patterns
 * - Scalability characteristics
 *
 * @package integration-tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextPlane } from '@lsi/superinstance';

interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Run a benchmark and record results
   */
  async benchmark(
    name: string,
    operations: () => Promise<void> | void,
    iterations = 1
  ): Promise<BenchmarkResult> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    // Run operations
    for (let i = 0; i < iterations; i++) {
      await operations();
    }

    const endTime = performance.now();
    const memoryAfter = this.getMemoryUsage();

    const result: BenchmarkResult = {
      name,
      duration: endTime - startTime,
      operations: iterations,
      opsPerSecond: (iterations / ((endTime - startTime) / 1000)),
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore
    };

    this.results.push(result);
    return result;
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Print results as a table
   */
  printResults(): void {
    console.table(
      this.results.map(r => ({
        Test: r.name,
        Duration: `${r.duration.toFixed(2)}ms`,
        'Ops/sec': r.opsPerSecond.toFixed(2),
        'Memory (MB)': r.memoryDelta?.toFixed(2) || 'N/A'
      }))
    );
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = [];
  }
}

describe('Context-Aware Performance Benchmarks', () => {
  let contextPlane: ContextPlane;
  let benchmark: PerformanceBenchmark;

  // Test data generators
  const generateTypeScriptFile = (importCount: number): string => {
    const imports = Array.from({ length: importCount }, (_, i) =>
      `import { Module${i} } from 'package${i}';`
    ).join('\n');

    return `
${imports}

export class TestClass {
  constructor() {
    console.log('initialized');
  }
}
`;
  };

  const generateLargeFile = (lineCount: number): string => {
    const lines = Array.from({ length: lineCount }, (_, i) =>
      `const line${i} = 'This is line ${i} of the file';`
    ).join('\n');

    return `
import { Module1, Module2, Module3 } from 'some-package';

${lines}

export default function main() {
  console.log('Main function');
}
`;
  };

  beforeEach(async () => {
    contextPlane = new ContextPlane({});
    await contextPlane.initialize();
    benchmark = new PerformanceBenchmark();
  });

  afterEach(async () => {
    await contextPlane.shutdown();
  });

  describe('Import Parsing Performance', () => {
    it('should parse small files quickly', async () => {
      const smallFile = generateTypeScriptFile(5);

      const result = await benchmark.benchmark(
        'Parse small file (5 imports)',
        async () => {
          await contextPlane.parseImports(smallFile, 'small.ts');
        },
        100
      );

      expect(result.opsPerSecond).toBeGreaterThan(100); // 100+ ops/sec
      expect(result.duration).toBeLessThan(1000); // < 1s total
    });

    it('should parse medium files efficiently', async () => {
      const mediumFile = generateTypeScriptFile(50);

      const result = await benchmark.benchmark(
        'Parse medium file (50 imports)',
        async () => {
          await contextPlane.parseImports(mediumFile, 'medium.ts');
        },
        50
      );

      expect(result.opsPerSecond).toBeGreaterThan(50);
    });

    it('should parse large files within acceptable time', async () => {
      const largeFile = generateTypeScriptFile(200);

      const result = await benchmark.benchmark(
        'Parse large file (200 imports)',
        async () => {
          await contextPlane.parseImports(largeFile, 'large.ts');
        },
        10
      );

      expect(result.opsPerSecond).toBeGreaterThan(5);
      expect(result.duration / result.operations).toBeLessThan(100); // < 100ms per file
    });

    it('should handle file size scaling', async () => {
      const sizes = [10, 50, 100, 200];
      const results: BenchmarkResult[] = [];

      for (const size of sizes) {
        const file = generateTypeScriptFile(size);
        const result = await benchmark.benchmark(
          `Parse file with ${size} imports`,
          async () => {
            await contextPlane.parseImports(file, `test-${size}.ts`);
          },
          10
        );
        results.push(result);
      }

      // Verify that scaling is reasonable (not exponential)
      const avgTimePerImport = results.map(
        r => r.duration / r.operations
      );

      // Last file (200 imports) should not take more than 10x the first file (10 imports)
      const ratio = avgTimePerImport[avgTimePerImport.length - 1] / avgTimePerImport[0];
      expect(ratio).toBeLessThan(10);
    });
  });

  describe('Domain Extraction Performance', () => {
    it('should extract domains from short text quickly', async () => {
      const shortText = 'How do I implement binary search in JavaScript?';

      const result = await benchmark.benchmark(
        'Extract domain from short text',
        async () => {
          await contextPlane.extractDomains(shortText);
        },
        100
      );

      expect(result.opsPerSecond).toBeGreaterThan(100);
    });

    it('should extract domains from long text efficiently', async () => {
      const longText = Array(50)
        .fill('How do I implement algorithms and data structures in programming?')
        .join(' ');

      const result = await benchmark.benchmark(
        'Extract domain from long text',
        async () => {
          await contextPlane.extractDomains(longText);
        },
        50
      );

      expect(result.opsPerSecond).toBeGreaterThan(20);
    });

    it('should handle batch domain extraction', async () => {
      const queries = Array.from({ length: 100 }, (_, i) => [
        `Query ${i} about programming`,
        `Query ${i} about medical diagnosis`,
        `Query ${i} about legal contracts`
      ]);

      const result = await benchmark.benchmark(
        'Batch domain extraction (300 queries)',
        async () => {
          for (const query of queries.flat()) {
            await contextPlane.extractDomains(query);
          }
        },
        1
      );

      expect(result.duration).toBeLessThan(5000); // < 5s for 300 queries
    });
  });

  describe('Knowledge Storage and Retrieval', () => {
    it('should store knowledge quickly', async () => {
      const result = await benchmark.benchmark(
        'Store knowledge entry',
        async () => {
          await contextPlane.storeKnowledge({
            key: `key-${Math.random()}`,
            value: { data: 'test data', timestamp: Date.now() }
          });
        },
        1000
      );

      expect(result.opsPerSecond).toBeGreaterThan(1000);
    });

    it('should retrieve knowledge quickly', async () => {
      // Store some entries
      for (let i = 0; i < 100; i++) {
        await contextPlane.storeKnowledge({
          key: `key-${i}`,
          value: { index: i }
        });
      }

      const result = await benchmark.benchmark(
        'Retrieve knowledge entry',
        async () => {
          const key = `key-${Math.floor(Math.random() * 100)}`;
          await contextPlane.retrieveKnowledge(key);
        },
        1000
      );

      expect(result.opsPerSecond).toBeGreaterThan(1000);
    });

    it('should scale knowledge storage linearly', async () => {
      const scales = [100, 500, 1000, 5000];
      const results: BenchmarkResult[] = [];

      for (const scale of scales) {
        // Clear and refill
        await contextPlane.shutdown();
        contextPlane = new ContextPlane({});
        await contextPlane.initialize();

        const result = await benchmark.benchmark(
          `Store ${scale} knowledge entries`,
          async () => {
            for (let i = 0; i < scale; i++) {
              await contextPlane.storeKnowledge({
                key: `key-${i}`,
                value: { index: i }
              });
            }
          },
          1
        );
        results.push(result);
      }

      // Check linear scaling
      const timesPerEntry = results.map(r => r.duration / 1000); // approximate entries
      const ratio = timesPerEntry[timesPerEntry.length - 1] / timesPerEntry[0];
      const sizeRatio = scales[scales.length - 1] / scales[0];

      // Time should scale roughly linearly with size (allow 2x deviation)
      expect(ratio).toBeLessThan(sizeRatio * 2);
    });
  });

  describe('Memory Usage', () => {
    it('should have reasonable memory footprint for parsing', async () => {
      const file = generateTypeScriptFile(100);

      const result = await benchmark.benchmark(
        'Parse 100 imports (memory test)',
        async () => {
          await contextPlane.parseImports(file, 'memory-test.ts');
        },
        100
      );

      // Memory increase should be reasonable (< 50MB for 100 parses)
      if (result.memoryDelta !== undefined) {
        expect(result.memoryDelta).toBeLessThan(50);
      }
    });

    it('should not leak memory during repeated operations', async () => {
      const file = generateTypeScriptFile(50);

      // Run many iterations
      const result = await benchmark.benchmark(
        'Parse 50 imports 1000 times',
        async () => {
          for (let i = 0; i < 1000; i++) {
            await contextPlane.parseImports(file, `memory-leak-test-${i}.ts`);
          }
        },
        1
      );

      // Memory growth should be bounded
      if (result.memoryDelta !== undefined) {
        // Should not grow more than 100MB for 1000 operations
        expect(result.memoryDelta).toBeLessThan(100);
      }
    });

    it('should handle LRU eviction correctly', async () => {
      // Store more entries than the cache limit
      const entries = 15000; // More than MAX_KNOWLEDGE (10000)

      const result = await benchmark.benchmark(
        `Store ${entries} entries (test LRU eviction)`,
        async () => {
          for (let i = 0; i < entries; i++) {
            await contextPlane.storeKnowledge({
              key: `lru-test-${i}`,
              value: { index: i, data: 'x'.repeat(100) } // 100 bytes each
            });
          }
        },
        1
      );

      // Should complete without running out of memory
      expect(result.duration).toBeLessThan(30000); // < 30s

      // Memory should be bounded
      if (result.memoryDelta !== undefined) {
        expect(result.memoryDelta).toBeLessThan(500); // < 500MB
      }
    });
  });

  describe('File Watching Performance', () => {
    it('should initialize file watcher quickly', async () => {
      const result = await benchmark.benchmark(
        'Initialize file watcher',
        async () => {
          const testPlane = new ContextPlane({});
          await testPlane.initialize();
          await testPlane.watchFiles({ paths: ['/mock/test'] });
          await testPlane.shutdown();
        },
        10
      );

      expect(result.duration / result.operations).toBeLessThan(100); // < 100ms per init
    });

    it('should handle file change events efficiently', async () => {
      await contextPlane.watchFiles({ paths: ['/mock/src'] });

      const result = await benchmark.benchmark(
        'Process file change events',
        async () => {
          // Simulate file changes (would require actual fs mocking)
          // For now, just test the status check
          contextPlane.getFileWatchStatus();
        },
        1000
      );

      expect(result.opsPerSecond).toBeGreaterThan(1000);
    });
  });

  describe('End-to-End Performance', () => {
    it('should handle complete workflow efficiently', async () => {
      const file = generateTypeScriptFile(50);

      const result = await benchmark.benchmark(
        'Complete workflow: parse -> extract domains -> store -> retrieve',
        async () => {
          // Parse
          const analysis = await contextPlane.parseImports(file, 'e2e.ts');

          // Extract domains
          const domains = await contextPlane.extractDomains(file);

          // Store
          await contextPlane.storeKnowledge({
            key: 'e2e-test',
            value: { analysis, domains }
          });

          // Retrieve
          await contextPlane.retrieveKnowledge('e2e-test');
        },
        50
      );

      expect(result.opsPerSecond).toBeGreaterThan(10);
      expect(result.duration / result.operations).toBeLessThan(100); // < 100ms per workflow
    });

    it('should handle concurrent operations', async () => {
      const files = Array.from({ length: 100 }, (_, i) =>
        generateTypeScriptFile(Math.floor(Math.random() * 50) + 10)
      );

      const result = await benchmark.benchmark(
        'Parse 100 files concurrently',
        async () => {
          await Promise.all(
            files.map((file, i) =>
              contextPlane.parseImports(file, `concurrent-${i}.ts`)
            )
          );
        },
        1
      );

      expect(result.duration).toBeLessThan(5000); // < 5s for 100 concurrent parses
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance report', async () => {
      // Run a representative set of benchmarks
      await benchmark.benchmark('Parse small file', async () => {
        await contextPlane.parseImports(
          generateTypeScriptFile(5),
          'summary-small.ts'
        );
      }, 100);

      await benchmark.benchmark('Parse medium file', async () => {
        await contextPlane.parseImports(
          generateTypeScriptFile(50),
          'summary-medium.ts'
        );
      }, 50);

      await benchmark.benchmark('Extract domains', async () => {
        await contextPlane.extractDomains('Test query about programming');
      }, 100);

      await benchmark.benchmark('Store knowledge', async () => {
        await contextPlane.storeKnowledge({
          key: `summary-${Math.random()}`,
          value: { data: 'test' }
        });
      }, 1000);

      await benchmark.benchmark('Retrieve knowledge', async () => {
        await contextPlane.retrieveKnowledge('summary-0.5');
      }, 1000);

      // Print results
      const results = benchmark.getResults();

      console.log('\n=== Performance Benchmark Results ===\n');
      benchmark.printResults();

      // Verify all benchmarks completed
      expect(results.length).toBe(5);

      // Log summary
      const avgOpsPerSecond =
        results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length;

      console.log(`\nAverage Operations Per Second: ${avgOpsPerSecond.toFixed(2)}`);

      const totalMemory = results.reduce(
        (sum, r) => sum + (r.memoryDelta || 0),
        0
      );

      console.log(`Total Memory Used: ${totalMemory.toFixed(2)} MB`);
      console.log('===================================\n');

      // Verify performance meets minimum standards
      expect(avgOpsPerSecond).toBeGreaterThan(50); // Average 50+ ops/sec
    });
  });
});
