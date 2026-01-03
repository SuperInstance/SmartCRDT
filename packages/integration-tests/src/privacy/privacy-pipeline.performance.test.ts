/**
 * Privacy Pipeline Performance Benchmarks
 *
 * Comprehensive performance testing for the privacy pipeline:
 * - Latency measurements (target: <100ms)
 * - Throughput testing (target: >100 queries/sec)
 * - Memory usage profiling (target: <500MB for 10K queries)
 * - Scalability testing
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PrivacyClassifier,
  PrivacyFirewall,
  RedactionAdditionProtocol,
  AuditLogger,
  IntentEncoder,
} from '@lsi/privacy';
import { PrivacyLevel, PIIType } from '@lsi/protocol';

// ============================================================================
// PERFORMANCE METRICS TYPES
// ============================================================================

interface PerformanceMetrics {
  /** Total execution time in milliseconds */
  totalTime: number;
  /** Average latency per query in milliseconds */
  avgLatency: number;
  /** Minimum latency in milliseconds */
  minLatency: number;
  /** Maximum latency in milliseconds */
  maxLatency: number;
  /** Percentiles (p50, p95, p99) in milliseconds */
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  /** Throughput in queries per second */
  throughput: number;
  /** Memory usage in MB */
  memoryUsage: {
    start: number;
    end: number;
    delta: number;
    peak: number;
  };
}

interface BenchmarkResult {
  name: string;
  iterations: number;
  metrics: PerformanceMetrics;
  success: boolean;
  errors: string[];
}

// ============================================================================
// PERFORMANCE TARGETS
// ============================================================================

const PERFORMANCE_TARGETS = {
  /** End-to-end latency target in milliseconds */
  MAX_LATENCY_MS: 100,

  /** Throughput target in queries per second */
  MIN_THROUGHPUT_QPS: 100,

  /** Memory target for 10K queries in MB */
  MAX_MEMORY_10K_MB: 500,

  /** P99 latency target in milliseconds */
  MAX_P99_LATENCY_MS: 200,
};

// ============================================================================
// TEST DATA
// ============================================================================

const BENCHMARK_QUERIES = {
  public: {
    query: 'What is the capital of France?',
    expectedLevel: PrivacyLevel.PUBLIC,
  },
  sensitive: {
    query: 'My email is john.doe@example.com',
    expectedLevel: PrivacyLevel.SENSITIVE,
  },
  sovereign: {
    query: 'My social security number is 123-45-6789',
    expectedLevel: PrivacyLevel.SOVEREIGN,
  },
  mixed: {
    query: 'Contact me at john@example.com or call 555-123-4567. SSN: 987-65-4321.',
    expectedLevel: PrivacyLevel.SOVEREIGN,
  },
};

// ============================================================================
// PERFORMANCE TEST UTILITIES
// ============================================================================

class PerformanceTester {
  private classifier: PrivacyClassifier;
  private firewall: PrivacyFirewall;
  private rap: RedactionAdditionProtocol;
  private intentEncoder: IntentEncoder;

  constructor() {
    this.classifier = new PrivacyClassifier();
    this.firewall = new PrivacyFirewall();
    this.rap = new RedactionAdditionProtocol();
    this.intentEncoder = new IntentEncoder();
  }

  /**
   * Run a full privacy pipeline benchmark
   */
  async benchmarkPipeline(
    query: string,
    iterations: number
  ): Promise<BenchmarkResult> {
    const errors: string[] = [];
    const latencies: number[] = [];

    const startMemory = process.memoryUsage().heapUsed;
    let peakMemory = startMemory;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      try {
        const iterStartTime = performance.now();

        // Full pipeline: classify → firewall → redact → encode
        const classification = await this.classifier.classify(query);
        const firewallDecision = this.firewall.evaluate(
          query,
          classification,
          'cloud'
        );

        let finalQuery = query;
        if (firewallDecision.action === 'redact') {
          const redactionResult = await this.rap.redact(query);
          finalQuery = redactionResult.redactedQuery;
        }

        if (firewallDecision.action !== 'deny') {
          await this.intentEncoder.encode(finalQuery);
        }

        const iterEndTime = performance.now();
        const latency = iterEndTime - iterStartTime;
        latencies.push(latency);

        // Track peak memory
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory;
        }
      } catch (error) {
        errors.push(`Iteration ${i}: ${error}`);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const endMemory = process.memoryUsage().heapUsed;

    // Calculate metrics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const metrics: PerformanceMetrics = {
      totalTime,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatency: sortedLatencies[0],
      maxLatency: sortedLatencies[sortedLatencies.length - 1],
      percentiles: {
        p50: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)],
        p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
        p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
      },
      throughput: (iterations / totalTime) * 1000,
      memoryUsage: {
        start: startMemory / 1024 / 1024,
        end: endMemory / 1024 / 1024,
        delta: (endMemory - startMemory) / 1024 / 1024,
        peak: peakMemory / 1024 / 1024,
      },
    };

    return {
      name: 'Privacy Pipeline Benchmark',
      iterations,
      metrics,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Benchmark individual components
   */
  async benchmarkComponents(iterations: number = 1000): Promise<{
    classifier: BenchmarkResult;
    firewall: BenchmarkResult;
    redaction: BenchmarkResult;
    encoding: BenchmarkResult;
  }> {
    const query = BENCHMARK_QUERIES.sensitive.query;

    // Benchmark classifier
    const classifierTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.classifier.classify(query);
      classifierTimes.push(performance.now() - start);
    }

    // Benchmark firewall
    const classification = await this.classifier.classify(query);
    const firewallTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      this.firewall.evaluate(query, classification, 'cloud');
      firewallTimes.push(performance.now() - start);
    }

    // Benchmark redaction
    const redactionTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.rap.redact(query);
      redactionTimes.push(performance.now() - start);
    }

    // Benchmark encoding
    const encodingTimes: number[] = [];
    const safeQuery = BENCHMARK_QUERIES.public.query;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.intentEncoder.encode(safeQuery);
      encodingTimes.push(performance.now() - start);
    }

    const createResult = (name: string, times: number[]): BenchmarkResult => ({
      name,
      iterations,
      metrics: {
        totalTime: times.reduce((a, b) => a + b, 0),
        avgLatency: times.reduce((a, b) => a + b, 0) / times.length,
        minLatency: Math.min(...times),
        maxLatency: Math.max(...times),
        percentiles: {
          p50: times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)],
          p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
          p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)],
        },
        throughput: (iterations / times.reduce((a, b) => a + b, 0)) * 1000,
        memoryUsage: { start: 0, end: 0, delta: 0, peak: 0 },
      },
      success: true,
      errors: [],
    });

    return {
      classifier: createResult('Classifier', classifierTimes),
      firewall: createResult('Firewall', firewallTimes),
      redaction: createResult('Redaction', redactionTimes),
      encoding: createResult('Encoding', encodingTimes),
    };
  }
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

describe('Privacy Pipeline - Performance Benchmarks', () => {
  let tester: PerformanceTester;

  beforeAll(() => {
    tester = new PerformanceTester();
  });

  describe('Latency Benchmarks', () => {
    it('should process PUBLIC queries in <100ms', async () => {
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.public.query,
        100
      );

      console.log('PUBLIC Query Performance:', {
        avgLatency: `${result.metrics.avgLatency.toFixed(2)}ms`,
        p95: `${result.metrics.percentiles.p95.toFixed(2)}ms`,
        p99: `${result.metrics.percentiles.p99.toFixed(2)}ms`,
      });

      expect(result.success).toBe(true);
      expect(result.metrics.avgLatency).toBeLessThan(PERFORMANCE_TARGETS.MAX_LATENCY_MS);
      expect(result.metrics.percentiles.p95).toBeLessThan(PERFORMANCE_TARGETS.MAX_LATENCY_MS);
      expect(result.metrics.percentiles.p99).toBeLessThan(PERFORMANCE_TARGETS.MAX_P99_LATENCY_MS);
    });

    it('should process SENSITIVE queries in <100ms', async () => {
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.sensitive.query,
        100
      );

      console.log('SENSITIVE Query Performance:', {
        avgLatency: `${result.metrics.avgLatency.toFixed(2)}ms`,
        p95: `${result.metrics.percentiles.p95.toFixed(2)}ms`,
        p99: `${result.metrics.percentiles.p99.toFixed(2)}ms`,
      });

      expect(result.success).toBe(true);
      expect(result.metrics.avgLatency).toBeLessThan(PERFORMANCE_TARGETS.MAX_LATENCY_MS);
    });

    it('should process SOVEREIGN queries quickly (blocked early)', async () => {
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.sovereign.query,
        100
      );

      console.log('SOVEREIGN Query Performance:', {
        avgLatency: `${result.metrics.avgLatency.toFixed(2)}ms`,
        p95: `${result.metrics.percentiles.p95.toFixed(2)}ms`,
      });

      expect(result.success).toBe(true);
      // SOVEREIGN queries should be faster since they're blocked early
      expect(result.metrics.avgLatency).toBeLessThan(PERFORMANCE_TARGETS.MAX_LATENCY_MS);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve >100 queries/sec for PUBLIC queries', async () => {
      const iterations = 1000;
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.public.query,
        iterations
      );

      console.log('PUBLIC Query Throughput:', {
        qps: result.metrics.throughput.toFixed(2),
        target: PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS,
      });

      expect(result.metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS);
    });

    it('should achieve >100 queries/sec for SENSITIVE queries', async () => {
      const iterations = 1000;
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.sensitive.query,
        iterations
      );

      console.log('SENSITIVE Query Throughput:', {
        qps: result.metrics.throughput.toFixed(2),
        target: PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS,
      });

      expect(result.metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS);
    });

    it('should achieve >100 queries/sec for SOVEREIGN queries', async () => {
      const iterations = 1000;
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.sovereign.query,
        iterations
      );

      console.log('SOVEREIGN Query Throughput:', {
        qps: result.metrics.throughput.toFixed(2),
        target: PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS,
      });

      expect(result.metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS);
    });
  });

  describe('Memory Benchmarks', () => {
    it('should use <500MB for 10K queries', async () => {
      const iterations = 10000;
      const result = await tester.benchmarkPipeline(
        BENCHMARK_QUERIES.public.query,
        iterations
      );

      console.log('Memory Usage for 10K queries:', {
        startMemory: `${result.metrics.memoryUsage.start.toFixed(2)}MB`,
        endMemory: `${result.metrics.memoryUsage.end.toFixed(2)}MB`,
        delta: `${result.metrics.memoryUsage.delta.toFixed(2)}MB`,
        peak: `${result.metrics.memoryUsage.peak.toFixed(2)}MB`,
        target: `${PERFORMANCE_TARGETS.MAX_MEMORY_10K_MB}MB`,
      });

      expect(result.metrics.memoryUsage.delta).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_10K_MB);
    });

    it('should maintain stable memory usage over time', async () => {
      const iterations = 5000;
      const query = BENCHMARK_QUERIES.public.query;

      // Measure memory at different points
      const measurements: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startMem = process.memoryUsage().heapUsed;

        await tester.benchmarkPipeline(query, iterations / 5);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const endMem = process.memoryUsage().heapUsed;
        measurements.push((endMem - startMem) / 1024 / 1024);
      }

      console.log('Memory Stability:', {
        measurements: measurements.map(m => `${m.toFixed(2)}MB`),
        avg: `${(measurements.reduce((a, b) => a + b, 0) / measurements.length).toFixed(2)}MB`,
        stdDev: `${calculateStdDev(measurements).toFixed(2)}MB`,
      });

      // Standard deviation should be relatively low (<50MB)
      expect(calculateStdDev(measurements)).toBeLessThan(50);
    });
  });

  describe('Component-Level Benchmarks', () => {
    it('should benchmark all components', async () => {
      const results = await tester.benchmarkComponents(1000);

      console.log('Component Performance:');
      console.table({
        Classifier: {
          'Avg Latency': `${results.classifier.metrics.avgLatency.toFixed(2)}ms`,
          Throughput: `${results.classifier.metrics.throughput.toFixed(2)} qps`,
        },
        Firewall: {
          'Avg Latency': `${results.firewall.metrics.avgLatency.toFixed(2)}ms`,
          Throughput: `${results.firewall.metrics.throughput.toFixed(2)} qps`,
        },
        Redaction: {
          'Avg Latency': `${results.redaction.metrics.avgLatency.toFixed(2)}ms`,
          Throughput: `${results.redaction.metrics.throughput.toFixed(2)} qps`,
        },
        Encoding: {
          'Avg Latency': `${results.encoding.metrics.avgLatency.toFixed(2)}ms`,
          Throughput: `${results.encoding.metrics.throughput.toFixed(2)} qps`,
        },
      });

      // Each component should be fast
      expect(results.classifier.metrics.avgLatency).toBeLessThan(50);
      expect(results.firewall.metrics.avgLatency).toBeLessThan(10); // Firewall should be very fast
      expect(results.redaction.metrics.avgLatency).toBeLessThan(50);
      expect(results.encoding.metrics.avgLatency).toBeLessThan(50);
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should handle increasing query complexity', async () => {
      const complexities = [
        'Simple query',
        'Query with email: test@example.com',
        'Query with email: test@example.com and phone: 555-123-4567',
        'Query with email: test@example.com, phone: 555-123-4567, DOB: 01/15/1990, SSN: 123-45-6789',
      ];

      const results: Array<{ query: string; latency: number }> = [];

      for (const query of complexities) {
        const start = performance.now();
        await tester.benchmarkPipeline(query, 10);
        const latency = (performance.now() - start) / 10; // Average latency

        results.push({ query, latency });
      }

      console.log('Scalability Results:');
      console.table(
        results.map(r => ({
          Query: r.query.substring(0, 50) + '...',
          'Avg Latency': `${r.latency.toFixed(2)}ms`,
        }))
      );

      // Latency should scale reasonably with complexity
      expect(results[0].latency).toBeLessThan(results[results.length - 1].latency);
      expect(results[results.length - 1].latency).toBeLessThan(200); // Even complex queries should be fast
    });

    it('should handle concurrent load', async () => {
      const query = BENCHMARK_QUERIES.public.query;
      const concurrency = 10;
      const iterationsPerWorker = 100;

      const startTime = performance.now();

      // Run concurrent "workers" (in series since JS is single-threaded)
      const workers = Array(concurrency).fill(null).map(async () => {
        return tester.benchmarkPipeline(query, iterationsPerWorker);
      });

      await Promise.all(workers);

      const totalTime = performance.now() - startTime;
      const totalQueries = concurrency * iterationsPerWorker;
      const throughput = (totalQueries / totalTime) * 1000;

      console.log('Concurrent Load Test:', {
        concurrency,
        totalQueries,
        totalTime: `${totalTime.toFixed(2)}ms`,
        throughput: `${throughput.toFixed(2)} qps`,
      });

      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_QPS);
    });
  });

  describe('Stress Tests', () => {
    it('should handle sustained load without degradation', async () => {
      const query = BENCHMARK_QUERIES.public.query;
      const batches = 10;
      const queriesPerBatch = 100;

      const batchTimes: number[] = [];

      for (let i = 0; i < batches; i++) {
        const start = performance.now();
        await tester.benchmarkPipeline(query, queriesPerBatch);
        const batchTime = performance.now() - start;
        batchTimes.push(batchTime);
      }

      // Check for degradation (last batch should not be significantly slower)
      const firstBatchAvg = batchTimes[0] / queriesPerBatch;
      const lastBatchAvg = batchTimes[batchTimes.length - 1] / queriesPerBatch;
      const degradationPercent = ((lastBatchAvg - firstBatchAvg) / firstBatchAvg) * 100;

      console.log('Sustained Load Test:', {
        firstBatchAvg: `${firstBatchAvg.toFixed(2)}ms`,
        lastBatchAvg: `${lastBatchAvg.toFixed(2)}ms`,
        degradationPercent: `${degradationPercent.toFixed(2)}%`,
      });

      // Degradation should be less than 50%
      expect(degradationPercent).toBeLessThan(50);
    });

    it('should handle rapid bursts of queries', async () => {
      const query = BENCHMARK_QUERIES.mixed.query;
      const burstSize = 50;
      const numBursts = 5;

      const burstTimes: number[] = [];

      for (let i = 0; i < numBursts; i++) {
        const start = performance.now();
        await tester.benchmarkPipeline(query, burstSize);
        burstTimes.push(performance.now() - start);
      }

      const avgBurstTime = burstTimes.reduce((a, b) => a + b, 0) / burstTimes.length;

      console.log('Burst Test Results:', {
        burstSize,
        numBursts,
        avgBurstTime: `${avgBurstTime.toFixed(2)}ms`,
        avgPerQuery: `${(avgBurstTime / burstSize).toFixed(2)}ms`,
      });

      expect(avgBurstTime / burstSize).toBeLessThan(PERFORMANCE_TARGETS.MAX_LATENCY_MS);
    });
  });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate percentiles
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = Math.floor(sortedValues.length * percentile);
  return sortedValues[index];
}
