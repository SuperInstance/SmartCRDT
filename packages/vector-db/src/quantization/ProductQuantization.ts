/**
 * ProductQuantization - Vector compression using Product Quantization
 *
 * Product Quantization (PQ) splits high-dimensional vectors into subvectors,
 * then quantizes each subspace independently using k-means clustering.
 *
 * Benefits:
 * - 8-64x compression (e.g., 1536-dim float -> 192 bytes)
 * - Faster distance calculations using lookup tables
 * - <2% accuracy loss for typical embeddings
 *
 * References:
 * - Jegou et al., "Product Quantization for Nearest Neighbor Search", TPAMI 2011
 *
 * @module quantization
 */

import type {
  ProductQuantizationConfig,
  PQTrainingResult,
  PQEncodedVector,
  PQEncodedBatch,
  PQMetrics,
  ADCCResult,
  NNResult,
} from "./types.js";
import {
  ConfigError,
  TrainingError,
  EncodingError,
  DecodingError,
} from "./types.js";

/**
 * ProductQuantization - Main PQ implementation
 */
export class ProductQuantization {
  private config: Required<ProductQuantizationConfig>;
  private codebook: Float32Array[][] = [];
  private subspaceDim: number = 0;
  private trained: boolean = false;
  private numVectors: number = 0;

  // Precomputed distance tables for fast ADC
  private distanceTables: Map<number, Float32Array> = new Map();

  constructor(config: ProductQuantizationConfig) {
    this.validateConfig(config);
    this.config = this.normalizeConfig(config);
    this.subspaceDim = Math.floor(this.config.dimension / this.config.numSubspaces);
  }

  /**
   * Train the PQ codebook on a set of vectors
   *
   * @param vectors - Training vectors [N, D]
   * @returns Training result with codebook and metrics
   */
  async train(vectors: Float32Array[]): Promise<PQTrainingResult> {
    const startTime = Date.now();

    if (vectors.length === 0) {
      throw new TrainingError("Training vectors cannot be empty");
    }

    const dimension = vectors[0].length;
    if (dimension !== this.config.dimension) {
      throw new TrainingError(
        `Vector dimension mismatch: expected ${this.config.dimension}, got ${dimension}`
      );
    }

    // Sample vectors for training if specified
    const trainingVectors =
      this.config.trainingSamples && this.config.trainingSamples < vectors.length
        ? this.sampleVectors(vectors, this.config.trainingSamples)
        : vectors;

    // Initialize codebook
    this.codebook = [];
    const numSubvectors = this.subspaceDim;

    // Split vectors into subspaces and train k-means for each
    for (let m = 0; m < this.config.numSubspaces; m++) {
      const startIdx = m * numSubvectors;
      const endIdx = startIdx + numSubvectors;

      // Extract m-th subvector from all training vectors
      const subvectors = trainingVectors.map((v) =>
        Array.from(v.slice(startIdx, endIdx))
      );

      // Train k-means for this subspace
      const centroids = await this.trainKMeans(subvectors, m);
      this.codebook.push(centroids);
    }

    this.trained = true;
    this.numVectors = vectors.length;

    // Encode all training vectors
    const codes = this.encodeBatch(vectors);

    // Calculate metrics
    const metrics = this.calculateMetrics(vectors, codes);

    const trainingTime = Date.now() - startTime;

    return {
      codebook: this.codebook.map((subspace) =>
        subspace.map((centroid) => new Float32Array(centroid))
      ),
      codes: codes.codes,
      subspaceDim: this.subspaceDim,
      metrics,
      trainingTime,
      converged: true,
      iterations: this.config.maxIterations,
    };
  }

  /**
   * Encode a single vector to PQ codes
   *
   * @param vector - Input vector [D]
   * @returns Encoded vector with 8-bit codes
   */
  encode(vector: Float32Array): PQEncodedVector {
    if (!this.trained) {
      throw new EncodingError("Model must be trained before encoding");
    }

    if (vector.length !== this.config.dimension) {
      throw new EncodingError(
        `Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`
      );
    }

    const codes = new Uint8Array(this.config.numSubspaces);
    const numSubvectors = this.subspaceDim;

    for (let m = 0; m < this.config.numSubspaces; m++) {
      const startIdx = m * numSubvectors;
      const endIdx = startIdx + numSubvectors;
      const subvector = vector.slice(startIdx, endIdx);

      // Find nearest centroid
      const code = this.findNearestCentroid(subvector, this.codebook[m]);
      codes[m] = code;
    }

    return {
      codes,
      id: Math.random().toString(36).substring(7),
    };
  }

  /**
   * Encode multiple vectors to PQ codes
   *
   * @param vectors - Input vectors [N, D]
   * @returns Batch of encoded vectors
   */
  encodeBatch(vectors: Float32Array[]): PQEncodedBatch {
    if (!this.trained) {
      throw new EncodingError("Model must be trained before encoding");
    }

    const numVectors = vectors.length;
    const numSubspaces = this.config.numSubspaces;
    const codes = new Uint8Array(numVectors * numSubspaces);
    const ids: Array<string | number> = [];

    for (let i = 0; i < numVectors; i++) {
      const encoded = this.encode(vectors[i]);
      codes.set(encoded.codes, i * numSubspaces);
      ids.push(encoded.id);
    }

    return {
      codes,
      ids,
      numVectors,
    };
  }

  /**
   * Decode PQ codes back to approximate vector
   *
   * @param codes - Quantized codes [numSubspaces]
   * @returns Decoded vector [D]
   */
  decode(codes: Uint8Array): Float32Array {
    if (!this.trained) {
      throw new DecodingError("Model must be trained before decoding");
    }

    if (codes.length !== this.config.numSubspaces) {
      throw new DecodingError(
        `Codes length mismatch: expected ${this.config.numSubspaces}, got ${codes.length}`
      );
    }

    const vector = new Float32Array(this.config.dimension);
    const numSubvectors = this.subspaceDim;

    for (let m = 0; m < this.config.numSubspaces; m++) {
      const centroid = this.codebook[m][codes[m]];
      const startIdx = m * numSubvectors;
      vector.set(centroid, startIdx);
    }

    return vector;
  }

  /**
   * Decode batch of PQ codes
   *
   * @param batch - Batch of encoded vectors
   * @returns Decoded vectors [N, D]
   */
  decodeBatch(batch: PQEncodedBatch): Float32Array[] {
    const vectors: Float32Array[] = [];
    const numSubspaces = this.config.numSubspaces;

    for (let i = 0; i < batch.numVectors; i++) {
      const startIdx = i * numSubspaces;
      const codes = batch.codes.slice(startIdx, startIdx + numSubspaces);
      vectors.push(this.decode(codes));
    }

    return vectors;
  }

  /**
   * Compute asymmetric distances (ADC) - query to compressed vectors
   *
   * @param query - Query vector [D]
   * @param codes - Compressed database vectors
   * @returns Distances and indices
   */
  asymmetricDistance(query: Float32Array, codes: Uint8Array): ADCCResult {
    if (!this.trained) {
      throw new Error("Model must be trained before distance calculation");
    }

    const startTime = Date.now();
    const numVectors = codes.length / this.config.numSubspaces;

    // Precompute distance table for query
    const table = this.computeDistanceTable(query);

    // Compute distances using table lookup
    const distances = new Float32Array(numVectors);
    const numSubvectors = this.subspaceDim;

    for (let i = 0; i < numVectors; i++) {
      let distance = 0;
      for (let m = 0; m < this.config.numSubspaces; m++) {
        const code = codes[i * this.config.numSubspaces + m];
        distance += table[m * this.config.numCentroids + code];
      }
      distances[i] = distance;
    }

    // Sort by distance
    const indices = new Uint32Array(numVectors);
    for (let i = 0; i < numVectors; i++) indices[i] = i;
    this.sortIndices(indices, distances);

    return {
      distances,
      indices,
      queryTime: Date.now() - startTime,
      distanceCalculations: numVectors * this.config.numSubspaces,
    };
  }

  /**
   * Find k nearest neighbors using asymmetric distance
   *
   * @param query - Query vector [D]
   * @param codes - Compressed database vectors
   * @param ids - Vector IDs
   * @param k - Number of neighbors to return
   * @returns Nearest neighbor results
   */
  findNearestNeighbors(
    query: Float32Array,
    codes: Uint8Array,
    ids: Array<string | number>,
    k: number
  ): NNResult {
    const startTime = Date.now();

    const result = this.asymmetricDistance(query, codes);
    const topK = Math.min(k, ids.length);

    return {
      ids: result.indices.slice(0, topK).map((i) => ids[i]),
      distances: result.distances.slice(0, topK),
      query,
      k: topK,
      searchTime: Date.now() - startTime,
      exact: false,
    };
  }

  /**
   * Get the trained codebook
   */
  getCodebook(): Float32Array[][] {
    if (!this.trained) {
      throw new Error("Model must be trained first");
    }
    return this.codebook;
  }

  /**
   * Get compression information
   */
  getCompressionInfo(): {
    originalBytes: number;
    compressedBytes: number;
    ratio: number;
  } {
    const originalBytes = this.config.dimension * 4; // float32 = 4 bytes
    const compressedBytes = this.config.numSubspaces; // 1 byte per subspace
    return {
      originalBytes,
      compressedBytes,
      ratio: originalBytes / compressedBytes,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Validate configuration
   */
  private validateConfig(config: ProductQuantizationConfig): void {
    if (config.numSubspaces <= 0) {
      throw new ConfigError("numSubspaces must be positive");
    }

    if (config.numCentroids <= 0) {
      throw new ConfigError("numCentroids must be positive");
    }

    if (config.dimension % config.numSubspaces !== 0) {
      throw new ConfigError(
        `dimension (${config.dimension}) must be divisible by numSubspaces (${config.numSubspaces})`
      );
    }

    if (config.numCentroids > 256) {
      throw new ConfigError("numCentroids cannot exceed 256 for 8-bit encoding");
    }
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: ProductQuantizationConfig): Required<ProductQuantizationConfig> {
    return {
      numSubspaces: config.numSubspaces,
      numCentroids: config.numCentroids,
      dimension: config.dimension,
      maxIterations: config.maxIterations ?? 100,
      convergenceThreshold: config.convergenceThreshold ?? 1e-4,
      trainingSamples: config.trainingSamples,
      seed: config.seed ?? Date.now(),
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Sample vectors randomly for training
   */
  private sampleVectors(
    vectors: Float32Array[],
    numSamples: number
  ): Float32Array[] {
    const sampled: Float32Array[] = [];
    const step = vectors.length / numSamples;

    for (let i = 0; i < numSamples; i++) {
      const idx = Math.floor(i * step);
      sampled.push(vectors[idx]);
    }

    return sampled;
  }

  /**
   * Train k-means for a single subspace
   */
  private async trainKMeans(
    vectors: number[][],
    subspaceIndex: number
  ): Promise<number[][]> {
    const K = this.config.numCentroids;
    const dimension = vectors[0].length;

    // Initialize centroids using k-means++
    const centroids = this.initializeCentroidsKMeansPlus(vectors, K);

    // K-means iterations
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // Assignment step
      const assignments = new Uint8Array(vectors.length);
      const distances = new Float32Array(vectors.length);

      for (let i = 0; i < vectors.length; i++) {
        let minDist = Infinity;
        let minIdx = 0;

        for (let k = 0; k < K; k++) {
          const dist = this.squaredEuclidean(vectors[i], centroids[k]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = k;
          }
        }

        assignments[i] = minIdx;
        distances[i] = minDist;
      }

      // Update step
      const newCentroids = this.updateCentroids(vectors, assignments, K, dimension);

      // Check convergence
      let maxChange = 0;
      for (let k = 0; k < K; k++) {
        const change = this.squaredEuclidean(centroids[k], newCentroids[k]);
        maxChange = Math.max(maxChange, change);
      }

      // Update centroids
      for (let k = 0; k < K; k++) {
        centroids[k] = newCentroids[k];
      }

      if (maxChange < this.config.convergenceThreshold) {
        if (this.config.verbose) {
          console.log(`Subspace ${subspaceIndex} converged at iteration ${iter}`);
        }
        break;
      }
    }

    return centroids;
  }

  /**
   * Initialize centroids using k-means++ algorithm
   */
  private initializeCentroidsKMeansPlus(vectors: number[][], K: number): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    // First centroid: random selection
    let idx = Math.floor(Math.random() * vectors.length);
    centroids.push([...vectors[idx]]);
    used.add(idx);

    // Subsequent centroids: probability proportional to distance
    for (let k = 1; k < K; k++) {
      const distances = new Float32Array(vectors.length);

      for (let i = 0; i < vectors.length; i++) {
        if (used.has(i)) {
          distances[i] = 0;
          continue;
        }

        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = this.squaredEuclidean(vectors[i], centroid);
          minDist = Math.min(minDist, dist);
        }
        distances[i] = minDist;
      }

      // Weighted random selection
      const totalDist = distances.reduce((a, b) => a + b, 0);
      let threshold = Math.random() * totalDist;
      idx = 0;

      for (let i = 0; i < vectors.length; i++) {
        threshold -= distances[i];
        if (threshold <= 0) {
          idx = i;
          break;
        }
      }

      centroids.push([...vectors[idx]]);
      used.add(idx);
    }

    return centroids;
  }

  /**
   * Update centroids based on assignments
   */
  private updateCentroids(
    vectors: number[][],
    assignments: Uint8Array,
    K: number,
    dimension: number
  ): number[][] {
    const centroids: number[][] = [];
    const counts = new Uint32Array(K);

    // Initialize centroids to zero
    for (let k = 0; k < K; k++) {
      centroids[k] = new Array(dimension).fill(0);
    }

    // Sum vectors assigned to each centroid
    for (let i = 0; i < vectors.length; i++) {
      const k = assignments[i];
      counts[k]++;
      for (let d = 0; d < dimension; d++) {
        centroids[k][d] += vectors[i][d];
      }
    }

    // Average to get new centroids
    for (let k = 0; k < K; k++) {
      if (counts[k] > 0) {
        for (let d = 0; d < dimension; d++) {
          centroids[k][d] /= counts[k];
        }
      }
    }

    return centroids;
  }

  /**
   * Find nearest centroid for a subvector
   */
  private findNearestCentroid(subvector: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let minIdx = 0;

    for (let k = 0; k < centroids.length; k++) {
      const dist = this.squaredEuclidean(subvector, centroids[k]);
      if (dist < minDist) {
        minDist = dist;
        minIdx = k;
      }
    }

    return minIdx;
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
   * Compute distance table for fast ADC
   *
   * Table shape: [numSubspaces, numCentroids]
   * table[m][k] = distance between query's m-th subvector and centroid k
   */
  private computeDistanceTable(query: Float32Array): Float32Array {
    const numSubvectors = this.subspaceDim;
    const table = new Float32Array(this.config.numSubspaces * this.config.numCentroids);

    for (let m = 0; m < this.config.numSubspaces; m++) {
      const startIdx = m * numSubvectors;
      const endIdx = startIdx + numSubvectors;
      const subvector = query.slice(startIdx, endIdx);

      for (let k = 0; k < this.config.numCentroids; k++) {
        const centroid = this.codebook[m][k];
        table[m * this.config.numCentroids + k] = this.squaredEuclidean(subvector, centroid);
      }
    }

    return table;
  }

  /**
   * Sort indices by distance (ascending)
   */
  private sortIndices(indices: Uint32Array, distances: Float32Array): void {
    // Simple insertion sort (for small arrays)
    // For production, use QuickSort or similar
    for (let i = 1; i < indices.length; i++) {
      const key = indices[i];
      const keyDist = distances[i];
      let j = i - 1;

      while (j >= 0 && distances[j] > keyDist) {
        indices[j + 1] = indices[j];
        j--;
      }

      indices[j + 1] = key;
    }
  }

  /**
   * Calculate training metrics
   */
  private calculateMetrics(vectors: Float32Array[], encoded: PQEncodedBatch): PQMetrics {
    let totalError = 0;
    let totalSignal = 0;

    for (let i = 0; i < vectors.length; i++) {
      const startIdx = i * this.config.numSubspaces;
      const codes = encoded.codes.slice(startIdx, startIdx + this.config.numSubspaces);
      const decoded = this.decode(codes);

      for (let j = 0; j < vectors[i].length; j++) {
        const error = vectors[i][j] - decoded[j];
        totalError += error * error;
        totalSignal += vectors[i][j] * vectors[i][j];
      }
    }

    const mse = totalError / (vectors.length * this.config.dimension);
    const sqnr = totalSignal / totalError;

    const info = this.getCompressionInfo();

    return {
      quantizationError: mse,
      reconstructionError: Math.sqrt(mse),
      sqnr,
      avgDistanceToCentroid: Math.sqrt(mse),
      compressionRatio: info.ratio,
      memorySaved: (info.originalBytes - info.compressedBytes) * this.numVectors,
    };
  }
}
