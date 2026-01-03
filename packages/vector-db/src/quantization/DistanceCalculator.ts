/**
 * DistanceCalculator - Fast distance computation for PQ-encoded vectors
 *
 * Provides optimized distance calculations for Product Quantization:
 * - Asymmetric Distance Computation (ADC): query (float) vs database (codes)
 * - Symmetric Distance Computation (SDC): both query and database are codes
 *
 * ADC is more accurate but slower. SDC is faster but less accurate.
 *
 * Performance optimizations:
 * - Precomputed distance tables for queries
 * - SIMD-friendly memory layouts
 * - Batch processing for multiple queries
 *
 * @module quantization
 */

import type {
  ADCCResult,
  SDCResult,
  NNResult,
  ANNResult,
} from "./types.js";

/**
 * Distance calculator configuration
 */
export interface DistanceCalculatorConfig {
  /** Use SIMD optimizations (if available) */
  useSIMD?: boolean;

  /** Preallocate distance tables for batch queries */
  preallocateTables?: boolean;

  /** Number of threads for parallel processing */
  numThreads?: number;
}

/**
 * DistanceCalculator - Optimized distance computation
 */
export class DistanceCalculator {
  private config: Required<DistanceCalculatorConfig>;
  private codebook: Float32Array[][];
  private numSubspaces: number;
  private numCentroids: number;
  private subspaceDim: number;

  // Cached distance tables
  private tableCache: Map<string, Float32Array> = new Map();

  constructor(
    codebook: Float32Array[][],
    numSubspaces: number,
    numCentroids: number,
    subspaceDim: number,
    config: DistanceCalculatorConfig = {}
  ) {
    this.codebook = codebook;
    this.numSubspaces = numSubspaces;
    this.numCentroids = numCentroids;
    this.subspaceDim = subspaceDim;
    this.config = this.normalizeConfig(config);
  }

  /**
   * Compute asymmetric distances (ADC)
   *
   * Query is kept in original form, database vectors are compressed.
   * Distance = sum over subspaces of ||query_sub - centroid[code_sub]||^2
   *
   * @param query - Query vector [D]
   * @param codes - Database codes [N, M]
   * @param precomputedTable - Optional precomputed distance table
   * @returns ADC result
   */
  asymmetricDistance(
    query: Float32Array,
    codes: Uint8Array,
    precomputedTable?: Float32Array
  ): ADCCResult {
    const startTime = Date.now();
    const numVectors = codes.length / this.numSubspaces;

    // Compute or use precomputed distance table
    const table =
      precomputedTable || this.computeDistanceTable(query);

    // Compute distances using table lookup
    const distances = new Float32Array(numVectors);
    const indices = new Uint32Array(numVectors);

    for (let i = 0; i < numVectors; i++) {
      let distance = 0;
      for (let m = 0; m < this.numSubspaces; m++) {
        const code = codes[i * this.numSubspaces + m];
        distance += table[m * this.numCentroids + code];
      }
      distances[i] = distance;
      indices[i] = i;
    }

    // Sort by distance
    this.sortIndices(indices, distances);

    return {
      distances,
      indices,
      queryTime: Date.now() - startTime,
      distanceCalculations: numVectors * this.numSubspaces,
    };
  }

  /**
   * Compute symmetric distances (SDC)
   *
   * Both query and database vectors are compressed.
   * Distance = sum over subspaces of ||centroid[query_sub] - centroid[code_sub]||^2
   *
   * Faster than ADC but less accurate.
   *
   * @param queryCodes - Query codes [M]
   * @param databaseCodes - Database codes [N, M]
   * @returns SDC result
   */
  symmetricDistance(queryCodes: Uint8Array, databaseCodes: Uint8Array): SDCResult {
    const startTime = Date.now();
    const numVectors = databaseCodes.length / this.numSubspaces;

    // Precompute centroid-to-centroid distances
    const centroidDistances = this.computeCentroidDistances();

    // Compute distances using precomputed centroid distances
    const distances = new Float32Array(numVectors);
    const indices = new Uint32Array(numVectors);

    for (let i = 0; i < numVectors; i++) {
      let distance = 0;
      for (let m = 0; m < this.numSubspaces; m++) {
        const queryCode = queryCodes[m];
        const dbCode = databaseCodes[i * this.numSubspaces + m];
        distance += centroidDistances[m][queryCode * this.numCentroids + dbCode];
      }
      distances[i] = distance;
      indices[i] = i;
    }

    // Sort by distance
    this.sortIndices(indices, distances);

    return {
      distances,
      indices,
      queryTime: Date.now() - startTime,
    };
  }

  /**
   * Batch ADC for multiple queries
   *
   * @param queries - Query vectors [Q, D]
   * @param codes - Database codes [N, M]
   * @param k - Number of neighbors per query
   * @returns Batch nearest neighbor results
   */
  batchAsymmetricDistance(
    queries: Float32Array[],
    codes: Uint8Array,
    k: number
  ): NNResult[] {
    const results: NNResult[] = [];

    for (const query of queries) {
      const adcResult = this.asymmetricDistance(query, codes);
      const topK = Math.min(k, adcResult.indices.length);

      results.push({
        ids: adcResult.indices.slice(0, topK).map((i) => i),
        distances: adcResult.distances.slice(0, topK),
        query,
        k: topK,
        searchTime: adcResult.queryTime,
        exact: false,
      });
    }

    return results;
  }

  /**
   * Find k nearest neighbors using ADC
   *
   * @param query - Query vector [D]
   * @param codes - Database codes [N, M]
   * @param ids - Vector IDs
   * @param k - Number of neighbors
   * @returns Nearest neighbors
   */
  findNearestNeighbors(
    query: Float32Array,
    codes: Uint8Array,
    ids: Array<string | number>,
    k: number
  ): NNResult {
    const adcResult = this.asymmetricDistance(query, codes);
    const topK = Math.min(k, ids.length);

    return {
      ids: Array.from(adcResult.indices.slice(0, topK)).map((i) => ids[i]),
      distances: adcResult.distances.slice(0, topK),
      query,
      k: topK,
      searchTime: adcResult.queryTime,
      exact: false,
    };
  }

  /**
   * Compute exact distances (for baseline comparison)
   *
   * @param query - Query vector [D]
   * @param vectors - Database vectors [N, D]
   * @param k - Number of neighbors
   * @returns Exact nearest neighbors
   */
  findExactNearestNeighbors(
    query: Float32Array,
    vectors: Float32Array[],
    ids: Array<string | number>,
    k: number
  ): NNResult {
    const startTime = Date.now();
    const distances = new Float32Array(vectors.length);
    const indices = new Uint32Array(vectors.length);

    for (let i = 0; i < vectors.length; i++) {
      distances[i] = this.squaredEuclidean(query, vectors[i]);
      indices[i] = i;
    }

    this.sortIndices(indices, distances);
    const topK = Math.min(k, ids.length);

    return {
      ids: Array.from(indices.slice(0, topK)).map((i) => ids[i]),
      distances: distances.slice(0, topK),
      query,
      k: topK,
      searchTime: Date.now() - startTime,
      exact: true,
    };
  }

  /**
   * Compute recall for approximate results
   *
   * @param approx - Approximate results
   * @param exact - Exact results
   * @returns Recall rate (0-1)
   */
  computeRecall(approx: NNResult, exact: NNResult): number {
    const approxSet = new Set(approx.ids);
    const exactSet = new Set(exact.ids.slice(0, approx.k));

    let overlap = 0;
    for (const id of approxSet) {
      if (exactSet.has(id)) {
        overlap++;
      }
    }

    return overlap / approx.k;
  }

  /**
   * Precompute distance table for a query
   *
   * Table shape: [numSubspaces, numCentroids]
   * Allows O(1) distance lookup per subspace
   *
   * @param query - Query vector [D]
   * @returns Distance table
   */
  computeDistanceTable(query: Float32Array): Float32Array {
    const table = new Float32Array(this.numSubspaces * this.numCentroids);

    for (let m = 0; m < this.numSubspaces; m++) {
      const startIdx = m * this.subspaceDim;
      const endIdx = startIdx + this.subspaceDim;
      const subvector = query.slice(startIdx, endIdx);

      for (let k = 0; k < this.numCentroids; k++) {
        const centroid = this.codebook[m][k];
        table[m * this.numCentroids + k] = this.squaredEuclidean(subvector, centroid);
      }
    }

    return table;
  }

  /**
   * Precompute centroid-to-centroid distances for SDC
   *
   * Returns array of tables, one per subspace.
   * Each table: [numCentroids, numCentroids]
   */
  computeCentroidDistances(): Float32Array[] {
    const tables: Float32Array[] = [];

    for (let m = 0; m < this.numSubspaces; m++) {
      const table = new Float32Array(this.numCentroids * this.numCentroids);

      for (let i = 0; i < this.numCentroids; i++) {
        for (let j = 0; j < this.numCentroids; j++) {
          table[i * this.numCentroids + j] = this.squaredEuclidean(
            this.codebook[m][i],
            this.codebook[m][j]
          );
        }
      }

      tables.push(table);
    }

    return tables;
  }

  /**
   * Cache a distance table for reuse
   *
   * @param key - Cache key (e.g., query ID)
   * @param table - Distance table to cache
   */
  cacheTable(key: string, table: Float32Array): void {
    if (this.tableCache.size >= 100) {
      // Evict oldest entry (simple FIFO)
      const firstKey = this.tableCache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        this.tableCache.delete(firstKey);
      }
    }
    this.tableCache.set(key, table);
  }

  /**
   * Get cached distance table
   *
   * @param key - Cache key
   * @returns Cached table or undefined
   */
  getCachedTable(key: string): Float32Array | undefined {
    return this.tableCache.get(key);
  }

  /**
   * Clear table cache
   */
  clearCache(): void {
    this.tableCache.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Normalize configuration
   */
  private normalizeConfig(config: DistanceCalculatorConfig): Required<DistanceCalculatorConfig> {
    return {
      useSIMD: config.useSIMD ?? false,
      preallocateTables: config.preallocateTables ?? true,
      numThreads: config.numThreads ?? 1,
    };
  }

  /**
   * Compute squared Euclidean distance
   */
  private squaredEuclidean(a: number[] | Float32Array, b: number[] | Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }

  /**
   * Sort indices by distance (ascending)
   */
  private sortIndices(indices: Uint32Array, distances: Float32Array): void {
    // QuickSort implementation
    this.quickSort(indices, distances, 0, indices.length - 1);
  }

  /**
   * QuickSort helper
   */
  private quickSort(
    indices: Uint32Array,
    distances: Float32Array,
    left: number,
    right: number
  ): void {
    if (left >= right) return;

    const pivotIndex = this.partition(indices, distances, left, right);
    this.quickSort(indices, distances, left, pivotIndex - 1);
    this.quickSort(indices, distances, pivotIndex + 1, right);
  }

  /**
   * Partition for QuickSort
   */
  private partition(
    indices: Uint32Array,
    distances: Float32Array,
    left: number,
    right: number
  ): number {
    const pivot = distances[right];
    let i = left - 1;

    for (let j = left; j < right; j++) {
      if (distances[j] <= pivot) {
        i++;
        // Swap indices
        [indices[i], indices[j]] = [indices[j], indices[i]];
        // Swap distances
        const tempDist = distances[i];
        distances[i] = distances[j];
        distances[j] = tempDist;
      }
    }

    // Swap pivot to correct position
    [indices[i + 1], indices[right]] = [indices[right], indices[i + 1]];
    const tempDist = distances[i + 1];
    distances[i + 1] = distances[right];
    distances[right] = tempDist;

    return i + 1;
  }
}
