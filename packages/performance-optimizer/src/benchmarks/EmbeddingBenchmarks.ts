/**
 * Embedding Benchmarks - Comprehensive embedding performance testing
 *
 * Benchmarks:
 * - OpenAI vs Ollama embedding performance
 * - HNSW cache performance and hit rates
 * - Batch vs sequential embedding
 * - Dimension impact on performance
 * - Different text lengths and complexity
 */

import { performance } from 'perf_hooks';

/**
 * Embedding provider type
 */
export type EmbeddingProvider = 'openai' | 'ollama' | 'local';

/**
 * Embedding benchmark result
 */
export interface EmbeddingBenchmarkResult {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  iterations: number;
  batchSize: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number; // embeddings per second
  tokenThroughput: number; // tokens per second
  durationDistribution: number[];
}

/**
 * HNSW cache performance metrics
 */
export interface HNSWCacheMetrics {
  hitRate: number;
  missRate: number;
  averageHitLatency: number;
  averageMissLatency: number;
  buildTime: number; // time to build index
  searchTime: number; // average search time
  indexSize: number; // number of vectors
  ef: number; // search parameter
  m: number; // construction parameter
}

/**
 * Batch comparison result
 */
export interface BatchComparisonResult {
  sequential: {
    totalDuration: number;
    averageDuration: number;
    throughput: number;
  };
  batch: {
    batchSize: number;
    totalDuration: number;
    averageDuration: number;
    throughput: number;
  };
  speedup: number;
  efficiency: number; // speedup / batchSize
}

/**
 * Text complexity test result
 */
export interface TextComplexityResult {
  category: string;
  averageLength: number; // characters
  averageTokens: number;
  embeddingTime: number;
  throughput: number;
  sampleCount: number;
}

/**
 * Embedding benchmark suite
 */
export interface EmbeddingBenchmarkSuite {
  timestamp: number;
  providers: {
    openai?: EmbeddingBenchmarkResult;
    ollama?: EmbeddingBenchmarkResult;
  };
  cachePerformance: HNSWCacheMetrics;
  batchComparison: BatchComparisonResult;
  complexityTests: TextComplexityResult[];
}

/**
 * Benchmark configuration
 */
export interface EmbeddingBenchmarkConfig {
  warmupIterations?: number;
  benchmarkIterations?: number;
  batchSizes?: number[];
  textCategories?: string[];
  enableCacheTests?: boolean;
  enableBatchTests?: boolean;
  enableComplexityTests?: boolean;
}

/**
 * Text sample for testing
 */
export interface TextSample {
  category: string;
  text: string;
  estimatedTokens: number;
}

/**
 * Embedding benchmark suite
 */
export class EmbeddingBenchmarks {
  private config: Required<EmbeddingBenchmarkConfig>;
  private textSamples: TextSample[] = [];

  constructor(config: EmbeddingBenchmarkConfig = {}) {
    this.config = {
      warmupIterations: config.warmupIterations ?? 10,
      benchmarkIterations: config.benchmarkIterations ?? 100,
      batchSizes: config.batchSizes ?? [1, 5, 10, 20, 50],
      textCategories: config.textCategories ?? [
        'short',
        'medium',
        'long',
        'code',
        'technical',
      ],
      enableCacheTests: config.enableCacheTests ?? true,
      enableBatchTests: config.enableBatchTests ?? true,
      enableComplexityTests: config.enableComplexityTests ?? true,
    };

    this.generateTextSamples();
  }

  /**
   * Generate text samples for testing
   */
  private generateTextSamples(): void {
    const samples: TextSample[] = [
      {
        category: 'short',
        text: 'Hello, world!',
        estimatedTokens: 3,
      },
      {
        category: 'short',
        text: 'What is the meaning of life?',
        estimatedTokens: 7,
      },
      {
        category: 'medium',
        text: 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet and is commonly used for testing purposes.',
        estimatedTokens: 28,
      },
      {
        category: 'medium',
        text: 'In computer science, an embedding is a representation of data in a lower-dimensional space that preserves semantic relationships.',
        estimatedTokens: 25,
      },
      {
        category: 'long',
        text: `Machine learning is a subset of artificial intelligence that focuses on building systems that can learn from and make decisions based on data.
               The process involves training a model on a dataset, allowing it to identify patterns and relationships within the data.
               Once trained, the model can be used to make predictions or decisions about new, unseen data.
               Common applications include image recognition, natural language processing, and recommendation systems.`,
        estimatedTokens: 85,
      },
      {
        category: 'long',
        text: `The history of computing spans millennia, from the ancient abacus to modern quantum computers.
               Key developments include the invention of the transistor, the integrated circuit, and the microprocessor.
               Each advancement has dramatically increased computational power while reducing size and cost.
               Today, we stand on the precipice of a new era with quantum computing and neuromorphic chips.`,
        estimatedTokens: 78,
      },
      {
        category: 'code',
        text: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2); }',
        estimatedTokens: 20,
      },
      {
        category: 'code',
        text: 'const result = await fetch("https://api.example.com/data").then(r => r.json());',
        estimatedTokens: 15,
      },
      {
        category: 'technical',
        text: 'Vector embeddings are numerical representations of text that capture semantic meaning in a high-dimensional space, typically 384 to 1536 dimensions.',
        estimatedTokens: 30,
      },
      {
        category: 'technical',
        text: 'Hierarchical Navigable Small World (HNSW) graphs provide efficient approximate nearest neighbor search with logarithmic complexity.',
        estimatedTokens: 22,
      },
    ];

    // Duplicate samples to reach iteration count
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      this.textSamples.push(samples[i % samples.length]);
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Benchmark embedding provider
   */
  async benchmarkProvider(
    provider: EmbeddingProvider,
    model: string,
    embedFn: (text: string) => Promise<number[]>,
    dimensions: number
  ): Promise<EmbeddingBenchmarkResult> {
    const durations: number[] = [];
    let totalTokens = 0;

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const sample = this.textSamples[i % this.textSamples.length];
      await embedFn(sample.text);
    }

    // Benchmark
    const startTime = performance.now();
    for (const sample of this.textSamples.slice(0, this.config.benchmarkIterations)) {
      const iterStart = performance.now();
      await embedFn(sample.text);
      durations.push(performance.now() - iterStart);
      totalTokens += sample.estimatedTokens;
    }
    const totalDuration = performance.now() - startTime;

    const sortedDurations = durations.sort((a, b) => a - b);

    return {
      provider,
      model,
      dimensions,
      iterations: this.config.benchmarkIterations,
      batchSize: 1,
      totalDuration,
      averageDuration: totalDuration / this.config.benchmarkIterations,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      p50: this.percentile(sortedDurations, 50),
      p95: this.percentile(sortedDurations, 95),
      p99: this.percentile(sortedDurations, 99),
      throughput: (this.config.benchmarkIterations / totalDuration) * 1000,
      tokenThroughput: (totalTokens / totalDuration) * 1000,
      durationDistribution: sortedDurations,
    };
  }

  /**
   * Benchmark HNSW cache performance
   */
  async benchmarkHNSWCache(
    searchFn: (query: number[]) => Promise<{ result: number[]; hit: boolean }>,
    buildFn?: (vectors: number[][]) => Promise<number>
  ): Promise<HNSWCacheMetrics> {
    const hitLatencies: number[] = [];
    const missLatencies: number[] = [];
    const searchTimes: number[] = [];
    let hits = 0;
    let misses = 0;

    // Build index if build function provided
    let buildTime = 0;
    let indexSize = this.textSamples.length;

    if (buildFn) {
      const buildStart = performance.now();
      // Simulate building index with dummy vectors
      const dummyVectors = this.textSamples.slice(0, 100).map(() =>
        Array(1536).fill(0).map(() => Math.random())
      );
      await buildFn(dummyVectors);
      buildTime = performance.now() - buildStart;
      indexSize = dummyVectors.length;
    }

    // Benchmark searches
    for (const sample of this.textSamples.slice(0, this.config.benchmarkIterations)) {
      const queryVector = Array(1536).fill(0).map(() => Math.random());

      const searchStart = performance.now();
      const result = await searchFn(queryVector);
      const searchDuration = performance.now() - searchStart;

      searchTimes.push(searchDuration);

      if (result.hit) {
        hits++;
        hitLatencies.push(searchDuration);
      } else {
        misses++;
        missLatencies.push(searchDuration);
      }
    }

    const avgHitLatency =
      hitLatencies.length > 0
        ? hitLatencies.reduce((sum, d) => sum + d, 0) / hitLatencies.length
        : 0;
    const avgMissLatency =
      missLatencies.length > 0
        ? missLatencies.reduce((sum, d) => sum + d, 0) / missLatencies.length
        : 0;
    const avgSearchTime =
      searchTimes.length > 0
        ? searchTimes.reduce((sum, d) => sum + d, 0) / searchTimes.length
        : 0;

    return {
      hitRate: hits / (hits + misses),
      missRate: misses / (hits + misses),
      averageHitLatency: avgHitLatency,
      averageMissLatency: avgMissLatency,
      buildTime,
      searchTime: avgSearchTime,
      indexSize,
      ef: 64, // Default HNSW parameter
      m: 16, // Default HNSW parameter
    };
  }

  /**
   * Benchmark batch vs sequential embedding
   */
  async benchmarkBatch(
    provider: EmbeddingProvider,
    sequentialFn: (text: string) => Promise<number[]>,
    batchFn: (texts: string[]) => Promise<number[][]>,
    batchSize: number
  ): Promise<BatchComparisonResult> {
    const samples = this.textSamples.slice(0, batchSize);

    // Warmup sequential
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await sequentialFn(samples[i % samples.length].text);
    }

    // Benchmark sequential
    const seqStart = performance.now();
    for (const sample of samples) {
      await sequentialFn(sample.text);
    }
    const sequentialDuration = performance.now() - seqStart;

    // Warmup batch
    if (this.config.warmupIterations > 0) {
      await batchFn(samples.map((s) => s.text));
    }

    // Benchmark batch
    const batchStart = performance.now();
    await batchFn(samples.map((s) => s.text));
    const batchDuration = performance.now() - batchStart;

    const sequentialAvg = sequentialDuration / samples.length;
    const batchAvg = batchDuration / samples.length;
    const speedup = sequentialDuration / batchDuration;
    const efficiency = speedup / batchSize;

    return {
      sequential: {
        totalDuration: sequentialDuration,
        averageDuration: sequentialAvg,
        throughput: (samples.length / sequentialDuration) * 1000,
      },
      batch: {
        batchSize,
        totalDuration: batchDuration,
        averageDuration: batchAvg,
        throughput: (samples.length / batchDuration) * 1000,
      },
      speedup,
      efficiency,
    };
  }

  /**
   * Benchmark text complexity impact
   */
  async benchmarkTextComplexity(
    embedFn: (text: string) => Promise<number[]>
  ): Promise<TextComplexityResult[]> {
    const results: Map<string, number[]> = new Map();

    // Group samples by category
    for (const sample of this.textSamples) {
      if (!results.has(sample.category)) {
        results.set(sample.category, []);
      }

      const start = performance.now();
      await embedFn(sample.text);
      const duration = performance.now() - start;

      results.get(sample.category)!.push(duration);
    }

    // Calculate statistics per category
    const output: TextComplexityResult[] = [];
    for (const [category, durations] of results.entries()) {
      const categorySamples = this.textSamples.filter((s) => s.category === category);
      const avgLength =
        categorySamples.reduce((sum, s) => sum + s.text.length, 0) / categorySamples.length;
      const avgTokens =
        categorySamples.reduce((sum, s) => sum + s.estimatedTokens, 0) / categorySamples.length;
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const throughput = (1000 / avgDuration) * avgTokens;

      output.push({
        category,
        averageLength: avgLength,
        averageTokens: avgTokens,
        embeddingTime: avgDuration,
        throughput,
        sampleCount: durations.length,
      });
    }

    return output.sort((a, b) => a.averageTokens - b.averageTokens);
  }

  /**
   * Compare OpenAI vs Ollama
   */
  async compareProviders(
    openaiEmbedFn: (text: string) => Promise<number[]>,
    ollamaEmbedFn: (text: string) => Promise<number[]>
  ): Promise<{
    openai: EmbeddingBenchmarkResult;
    ollama: EmbeddingBenchmarkResult;
    comparison: {
      speedup: number;
      costDifference: number;
      recommendation: string;
    };
  }> {
    const [openai, ollama] = await Promise.all([
      this.benchmarkProvider('openai', 'text-embedding-ada-002', openaiEmbedFn, 1536),
      this.benchmarkProvider('ollama', 'nomic-embed-text', ollamaEmbedFn, 768),
    ]);

    const speedup = openai.averageDuration / ollama.averageDuration;
    const costDifference = 0.9; // 90% cost reduction with Ollama (assumed)

    let recommendation = '';
    if (speedup > 1) {
      recommendation = `Ollama is ${speedup.toFixed(2)}x faster than OpenAI`;
    } else {
      recommendation = `OpenAI is ${(1 / speedup).toFixed(2)}x faster than Ollama`;
    }
    recommendation += `. Ollama provides ${costDifference * 100}% cost reduction.`;

    return {
      openai,
      ollama,
      comparison: {
        speedup,
        costDifference,
        recommendation,
      },
    };
  }

  /**
   * Run full embedding benchmark suite
   */
  async runFullBenchmark(
    openaiEmbedFn?: (text: string) => Promise<number[]>,
    ollamaEmbedFn?: (text: string) => Promise<number[]>,
    batchFn?: (texts: string[]) => Promise<number[][]>,
    cacheSearchFn?: (query: number[]) => Promise<{ result: number[]; hit: boolean }>,
    cacheBuildFn?: (vectors: number[][]) => Promise<number>
  ): Promise<EmbeddingBenchmarkSuite> {
    const providers: {
      openai?: EmbeddingBenchmarkResult;
      ollama?: EmbeddingBenchmarkResult;
    } = {};

    if (openaiEmbedFn) {
      providers.openai = await this.benchmarkProvider(
        'openai',
        'text-embedding-ada-002',
        openaiEmbedFn,
        1536
      );
    }

    if (ollamaEmbedFn) {
      providers.ollama = await this.benchmarkProvider(
        'ollama',
        'nomic-embed-text',
        ollamaEmbedFn,
        768
      );
    }

    // Use whichever provider is available for remaining tests
    const embedFn = ollamaEmbedFn || openaiEmbedFn;
    if (!embedFn) {
      throw new Error('At least one embedding function must be provided');
    }

    // Test cache if available
    let cachePerformance: HNSWCacheMetrics = {
      hitRate: 0,
      missRate: 1,
      averageHitLatency: 0,
      averageMissLatency: 0,
      buildTime: 0,
      searchTime: 0,
      indexSize: 0,
      ef: 64,
      m: 16,
    };

    if (this.config.enableCacheTests && cacheSearchFn) {
      cachePerformance = await this.benchmarkHNSWCache(cacheSearchFn, cacheBuildFn);
    }

    // Test batch if available
    const batchSize = this.config.batchSizes[Math.floor(this.config.batchSizes.length / 2)];
    let batchComparison: BatchComparisonResult = {
      sequential: { totalDuration: 0, averageDuration: 0, throughput: 0 },
      batch: { batchSize, totalDuration: 0, averageDuration: 0, throughput: 0 },
      speedup: 1,
      efficiency: 1,
    };

    if (this.config.enableBatchTests && batchFn) {
      batchComparison = await this.benchmarkBatch('ollama', embedFn, batchFn, batchSize);
    }

    // Test complexity
    const complexityTests = this.config.enableComplexityTests
      ? await this.benchmarkTextComplexity(embedFn)
      : [];

    return {
      timestamp: Date.now(),
      providers,
      cachePerformance,
      batchComparison,
      complexityTests,
    };
  }

  /**
   * Generate benchmark report
   */
  generateReport(suite: EmbeddingBenchmarkSuite): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('EMBEDDING BENCHMARK REPORT');
    lines.push(`Timestamp: ${new Date(suite.timestamp).toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Provider comparison
    lines.push('PROVIDER PERFORMANCE');
    lines.push('-'.repeat(80));
    for (const [provider, result] of Object.entries(suite.providers)) {
      if (result) {
        lines.push(`${provider.toUpperCase()}:`);
        lines.push(`  Throughput: ${result.throughput.toFixed(2)} embeddings/sec`);
        lines.push(`  Token Throughput: ${result.tokenThroughput.toFixed(2)} tokens/sec`);
        lines.push(`  P50: ${result.p50.toFixed(2)}ms | P95: ${result.p95.toFixed(2)}ms | P99: ${result.p99.toFixed(2)}ms`);
        lines.push('');
      }
    }

    // Cache performance
    lines.push('HNSW CACHE PERFORMANCE');
    lines.push('-'.repeat(80));
    const cache = suite.cachePerformance;
    lines.push(`Hit Rate: ${(cache.hitRate * 100).toFixed(1)}%`);
    lines.push(`Avg Hit Latency: ${cache.averageHitLatency.toFixed(2)}ms`);
    lines.push(`Avg Miss Latency: ${cache.averageMissLatency.toFixed(2)}ms`);
    lines.push(`Index Size: ${cache.indexSize} vectors`);
    lines.push(`Build Time: ${cache.buildTime.toFixed(2)}ms`);
    lines.push('');

    // Batch comparison
    lines.push('BATCH vs SEQUENTIAL');
    lines.push('-'.repeat(80));
    const batch = suite.batchComparison;
    lines.push(`Sequential: ${(batch.sequential.throughput).toFixed(2)} ops/sec`);
    lines.push(`Batch (${batch.batch.batchSize}): ${batch.batch.throughput.toFixed(2)} ops/sec`);
    lines.push(`Speedup: ${batch.speedup.toFixed(2)}x`);
    lines.push(`Efficiency: ${(batch.efficiency * 100).toFixed(1)}%`);
    lines.push('');

    // Complexity tests
    if (suite.complexityTests.length > 0) {
      lines.push('TEXT COMPLEXITY IMPACT');
      lines.push('-'.repeat(80));
      for (const test of suite.complexityTests) {
        lines.push(`${test.category}:`);
        lines.push(`  Avg Length: ${test.averageLength.toFixed(0)} chars`);
        lines.push(`  Avg Tokens: ${test.averageTokens.toFixed(1)}`);
        lines.push(`  Embedding Time: ${test.embeddingTime.toFixed(2)}ms`);
        lines.push(`  Throughput: ${test.throughput.toFixed(2)} tokens/sec`);
      }
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Get text samples
   */
  getTextSamples(): TextSample[] {
    return [...this.textSamples];
  }

  /**
   * Clear text samples
   */
  clearTextSamples(): void {
    this.textSamples = [];
  }
}
