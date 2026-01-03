/**
 * QuantizationBenchmark - Benchmark PQ and OPQ performance
 *
 * Provides comprehensive benchmarking for:
 * - Compression ratio
 * - Accuracy retention (recall, precision)
 * - Query speedup vs exact search
 * - Training time
 * - Memory usage
 *
 * @module quantization
 */

import type {
  PQBenchmarkConfig,
  PQBenchmarkResults,
  ProductQuantizationConfig,
  OPQConfig,
  NNResult,
} from "./types.js";
import { ProductQuantization } from "./ProductQuantization.js";
import { OptimizedProductQuantization } from "./OptimizedProductQuantization.js";
import { DistanceCalculator } from "./DistanceCalculator.js";

/**
 * QuantizationBenchmark - Performance benchmarking
 */
export class QuantizationBenchmark {
  private config: PQBenchmarkConfig;

  constructor(config: PQBenchmarkConfig) {
    this.config = config;
  }

  /**
   * Run comprehensive benchmark
   *
   * @param vectors - Dataset vectors [N, D]
   * @param queries - Query vectors [Q, D]
   * @returns Benchmark results
   */
  async run(
    vectors: Float32Array[],
    queries: Float32Array[]
  ): Promise<PQBenchmarkResults> {
    console.log("Starting PQ/OPQ Benchmark...");
    console.log(`Dataset: ${vectors.length} vectors x ${vectors[0].length} dimensions`);
    console.log(`Queries: ${queries.length} vectors`);

    const dimension = vectors[0].length;
    const numSubspaces = this.config.numSubspaces[0];
    const numCentroids = this.config.numCentroids[0];

    // Validate dimensions
    if (dimension % numSubspaces !== 0) {
      throw new Error(
        `Dimension ${dimension} must be divisible by numSubspaces ${numSubspaces}`
      );
    }

    // =========================================================================
    // Phase 1: Train PQ
    // =========================================================================
    console.log("\n[Phase 1] Training Product Quantization...");
    const pqConfig: ProductQuantizationConfig = {
      numSubspaces,
      numCentroids,
      dimension,
      maxIterations: 50,
      convergenceThreshold: 1e-4,
      trainingSamples: this.config.numVectors,
      verbose: false,
    };

    const pq = new ProductQuantization(pqConfig);
    const pqTrainStart = Date.now();
    const pqResult = await pq.train(vectors);
    const pqTrainTime = Date.now() - pqTrainStart;

    console.log(`  PQ training time: ${pqTrainTime}ms`);
    console.log(`  PQ quantization error: ${pqResult.metrics.quantizationError.toExponential(4)}`);
    console.log(`  PQ SQNR: ${pqResult.metrics.sqnr.toFixed(2)} dB`);

    // =========================================================================
    // Phase 2: Train OPQ (if enabled)
    // =========================================================================
    let opqResult: typeof pqResult & { rotationMatrix: Float32Array } | null = null;
    let opqTrainTime = 0;

    if (this.config.testOPQ) {
      console.log("\n[Phase 2] Training Optimized Product Quantization...");
      const opqConfig: OPQConfig = {
        ...pqConfig,
        opqIterations: 10,
        useGPU: false,
        batchSize: 256,
      };

      const opq = new OptimizedProductQuantization(opqConfig);
      const opqTrainStart = Date.now();
      const trainedOPQ = await opq.train(vectors);
      opqTrainTime = Date.now() - opqTrainStart;
      opqResult = trainedOPQ;

      console.log(`  OPQ training time: ${opqTrainTime}ms`);
      console.log(`  OPQ quantization error: ${trainedOPQ.opqMetrics.quantizationError.toExponential(4)}`);
      console.log(`  OPQ improvement: ${((1 - trainedOPQ.opqMetrics.quantizationError / pqResult.metrics.quantizationError) * 100).toFixed(1)}%`);
    }

    // =========================================================================
    // Phase 3: Encode database
    // =========================================================================
    console.log("\n[Phase 3] Encoding vectors...");
    const encodeStart = Date.now();
    const pqEncoded = pq.encodeBatch(vectors);
    const pqEncodeTime = Date.now() - encodeStart;

    let opqEncoded: typeof pqEncoded | null = null;
    let opqEncodeTime = 0;

    if (opqResult) {
      const opqEncodeStart = Date.now();
      const opq = new OptimizedProductQuantization({
        ...pqConfig,
        opqIterations: 10,
        useGPU: false,
        batchSize: 256,
      });
      // Re-create OPQ with trained result
      opqEncoded = pqEncoded; // Placeholder - same encoding size
      opqEncodeTime = Date.now() - opqEncodeStart;
    }

    console.log(`  PQ encode time: ${pqEncodeTime}ms`);
    console.log(`  PQ throughput: ${((vectors.length / pqEncodeTime) * 1000).toFixed(0)} vectors/sec`);

    // =========================================================================
    // Phase 4: Query performance
    // =========================================================================
    console.log("\n[Phase 4] Query performance...");

    // Exact search baseline
    const exactStart = Date.now();
    const exactResults: NNResult[] = [];
    for (const query of queries) {
      const ids = vectors.map((_, i) => i);
      const result = this.findExactNearestNeighbors(query, vectors, ids, this.config.k);
      exactResults.push(result);
    }
    const exactTime = Date.now() - exactStart;
    const avgExactTime = exactTime / queries.length;

    console.log(`  Exact search time: ${avgExactTime.toFixed(2)}ms per query`);

    // PQ search
    const calculator = new DistanceCalculator(
      pqResult.codebook,
      numSubspaces,
      numCentroids,
      Math.floor(dimension / numSubspaces)
    );

    const pqQueryStart = Date.now();
    const pqResults: NNResult[] = [];
    for (const query of queries) {
      const ids = vectors.map((_, i) => i);
      const result = calculator.findNearestNeighbors(query, pqEncoded.codes, ids, this.config.k);
      pqResults.push(result);
    }
    const pqQueryTime = Date.now() - pqQueryStart;
    const avgPQQueryTime = pqQueryTime / queries.length;

    console.log(`  PQ search time: ${avgPQQueryTime.toFixed(2)}ms per query`);
    console.log(`  PQ speedup: ${(avgExactTime / avgPQQueryTime).toFixed(2)}x`);

    // =========================================================================
    // Phase 5: Accuracy evaluation
    // =========================================================================
    console.log("\n[Phase 5] Accuracy evaluation...");

    let totalRecall = 0;
    for (let i = 0; i < queries.length; i++) {
      const recall = this.computeRecall(exactResults[i], pqResults[i]);
      totalRecall += recall;
    }
    const avgRecall = totalRecall / queries.length;

    console.log(`  PQ recall@${this.config.k}: ${(avgRecall * 100).toFixed(1)}%`);

    // =========================================================================
    // Phase 6: Compression metrics
    // =========================================================================
    console.log("\n[Phase 6] Compression metrics...");

    const originalBytes = vectors.length * dimension * 4; // float32
    const compressedBytes = vectors.length * numSubspaces; // 1 byte per subspace
    const compressionRatio = originalBytes / compressedBytes;

    console.log(`  Original size: ${(originalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compressed size: ${(compressedBytes / 1024).toFixed(2)} KB`);
    console.log(`  Compression ratio: ${compressionRatio.toFixed(1)}x`);
    console.log(`  Memory saved: ${((originalBytes - compressedBytes) / 1024 / 1024).toFixed(2)} MB`);

    // =========================================================================
    // Compile results
    // =========================================================================
    const results: PQBenchmarkResults = {
      dataset: {
        numVectors: vectors.length,
        numQueries: queries.length,
        dimension,
        trainingSamples: vectors.length,
      },
      compression: {
        originalSize: originalBytes,
        compressedSize: compressedBytes,
        ratio: compressionRatio,
        memorySaved: originalBytes - compressedBytes,
      },
      accuracy: {
        recall: avgRecall,
        precision: avgRecall, // Approximated as same for NN search
        quantizationError: pqResult.metrics.quantizationError,
        sqnr: pqResult.metrics.sqnr,
      },
      performance: {
        trainingTime: pqTrainTime,
        encodingTime: pqEncodeTime,
        queryTime: avgPQQueryTime,
        throughput: vectors.length / (pqEncodeTime / 1000),
      },
      baseline: {
        baselineTime: avgExactTime,
        speedup: avgExactTime / avgPQQueryTime,
        accuracyRetention: avgRecall,
      },
    };

    if (opqResult && this.config.testOPQ) {
      results.comparison = {
        pqError: pqResult.metrics.quantizationError,
        opqError: opqResult.opqMetrics.quantizationError,
        improvement: 1 - opqResult.opqMetrics.quantizationError / pqResult.metrics.quantizationError,
      };
    }

    return results;
  }

  /**
   * Run quick benchmark (subset of data)
   */
  async runQuick(
    vectors: Float32Array[],
    queries: Float32Array[]
  ): Promise<PQBenchmarkResults> {
    const numVectors = Math.min(vectors.length, 10000);
    const numQueries = Math.min(queries.length, 100);

    const sampledVectors = vectors.slice(0, numVectors);
    const sampledQueries = queries.slice(0, numQueries);

    return this.run(sampledVectors, sampledQueries);
  }

  /**
   * Find exact nearest neighbors
   */
  private findExactNearestNeighbors(
    query: Float32Array,
    vectors: Float32Array[],
    ids: Array<string | number>,
    k: number
  ): NNResult {
    const startTime = Date.now();
    const distances = new Float32Array(vectors.length);

    for (let i = 0; i < vectors.length; i++) {
      distances[i] = this.squaredEuclidean(query, vectors[i]);
    }

    // Find top-k
    const topK = Math.min(k, vectors.length);
    const topIndices = new Uint32Array(topK);
    const topDistances = new Float32Array(topK);

    for (let i = 0; i < topK; i++) {
      let minIdx = i;
      let minDist = distances[i];

      for (let j = i + 1; j < vectors.length; j++) {
        if (distances[j] < minDist) {
          minIdx = j;
          minDist = distances[j];
        }
      }

      topIndices[i] = minIdx;
      topDistances[i] = minDist;
      distances[minIdx] = Infinity; // Mark as visited
    }

    return {
      ids: Array.from(topIndices).map((i) => ids[i]),
      distances: topDistances,
      query,
      k: topK,
      searchTime: Date.now() - startTime,
      exact: true,
    };
  }

  /**
   * Compute recall
   */
  private computeRecall(exact: NNResult, approx: NNResult): number {
    const exactSet = new Set(exact.ids);
    let overlap = 0;

    for (const id of approx.ids) {
      if (exactSet.has(id)) {
        overlap++;
      }
    }

    return overlap / approx.k;
  }

  /**
   * Squared Euclidean distance
   */
  private squaredEuclidean(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }
}
