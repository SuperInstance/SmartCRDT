/**
 * Vector Operations with SIMD Optimization
 *
 * High-performance vector operations using SIMD instructions where available.
 * Provides common linear algebra operations for embedding computations.
 *
 * @packageDocumentation
 */

import { SIMDOptimizer, SIMDOperation } from "./SIMDOptimizer.js";

/**
 * Batch comparison result
 */
export interface BatchCompareResult {
  index: number;
  similarity: number;
}

/**
 * Vector operations with SIMD optimization
 */
export class VectorOps {
  private optimizer: SIMDOptimizer;

  constructor(optimizer?: SIMDOptimizer) {
    this.optimizer = optimizer || new SIMDOptimizer();
  }

  /**
   * Initialize the optimizer (detect capabilities)
   */
  async init(): Promise<void> {
    await this.optimizer.detectCapabilities();
  }

  // ==================== Basic Operations ====================

  /**
   * Vector addition (a + b)
   */
  add(a: Float32Array, b: Float32Array): Float32Array {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    const result = this.optimizer.optimizeVectorOp("add", [
      a,
      b,
    ]) as Float32Array;

    return result;
  }

  /**
   * Vector subtraction (a - b)
   */
  sub(a: Float32Array, b: Float32Array): Float32Array {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    const result = this.optimizer.optimizeVectorOp("sub", [
      a,
      b,
    ]) as Float32Array;

    return result;
  }

  /**
   * Element-wise multiplication (a * b)
   */
  mul(a: Float32Array, b: Float32Array): Float32Array {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    const result = this.optimizer.optimizeVectorOp("mul", [
      a,
      b,
    ]) as Float32Array;

    return result;
  }

  /**
   * Dot product (Σ a[i] * b[i])
   */
  dot(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    return this.optimizer.optimizeVectorOp("dot", [a, b]) as number;
  }

  /**
   * Cosine similarity (a · b / (||a|| * ||b||))
   */
  cosine(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    return this.optimizer.optimizeVectorOp("cosine", [a, b]) as number;
  }

  /**
   * Euclidean distance (sqrt(Σ (a[i] - b[i])²))
   */
  euclidean(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    return this.optimizer.optimizeVectorOp("euclidean", [a, b]) as number;
  }

  /**
   * L2 norm squared (Σ a[i]²)
   */
  normSquared(a: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * a[i];
    }
    return sum;
  }

  /**
   * L2 norm (sqrt(Σ a[i]²))
   */
  norm(a: Float32Array): number {
    return Math.sqrt(this.normSquared(a));
  }

  /**
   * Normalize (a / ||a||)
   */
  normalize(a: Float32Array): Float32Array {
    const result = this.optimizer.optimizeVectorOp("normalize", [
      a,
    ]) as Float32Array;

    return result;
  }

  /**
   * Scale vector by scalar
   */
  scale(a: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * scalar;
    }
    return result;
  }

  /**
   * Add scalar to vector
   */
  addScalar(a: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + scalar;
    }
    return result;
  }

  // ==================== Batch Operations ====================

  /**
   * Batch addition - add scalar to all vectors
   */
  batchAdd(vectors: Float32Array[], scalar: Float32Array): Float32Array[] {
    return vectors.map(v => this.add(v, scalar));
  }

  /**
   * Batch subtraction - subtract scalar from all vectors
   */
  batchSub(vectors: Float32Array[], scalar: Float32Array): Float32Array[] {
    return vectors.map(v => this.sub(v, scalar));
  }

  /**
   * Batch multiplication - multiply all vectors by scalar
   */
  batchMul(vectors: Float32Array[], scalar: Float32Array): Float32Array[] {
    return vectors.map(v => this.mul(v, scalar));
  }

  /**
   * Element-wise sum of multiple vectors
   */
  sum(vectors: Float32Array[]): Float32Array {
    if (vectors.length === 0) {
      throw new Error("Cannot sum empty array");
    }

    const dim = vectors[0].length;
    const result = new Float32Array(dim);

    for (const v of vectors) {
      if (v.length !== dim) {
        throw new Error("All vectors must have the same dimension");
      }
      for (let i = 0; i < dim; i++) {
        result[i] += v[i];
      }
    }

    return result;
  }

  /**
   * Element-wise mean of multiple vectors
   */
  mean(vectors: Float32Array[]): Float32Array {
    const sum = this.sum(vectors);
    return this.scale(sum, 1.0 / vectors.length);
  }

  /**
   * Element-wise maximum of multiple vectors
   */
  max(vectors: Float32Array[]): Float32Array {
    if (vectors.length === 0) {
      throw new Error("Cannot find max of empty array");
    }

    const dim = vectors[0].length;
    const result = new Float32Array(vectors[0]);

    for (let j = 1; j < vectors.length; j++) {
      const v = vectors[j];
      if (v.length !== dim) {
        throw new Error("All vectors must have the same dimension");
      }
      for (let i = 0; i < dim; i++) {
        if (v[i] > result[i]) {
          result[i] = v[i];
        }
      }
    }

    return result;
  }

  /**
   * Element-wise minimum of multiple vectors
   */
  min(vectors: Float32Array[]): Float32Array {
    if (vectors.length === 0) {
      throw new Error("Cannot find min of empty array");
    }

    const dim = vectors[0].length;
    const result = new Float32Array(vectors[0]);

    for (let j = 1; j < vectors.length; j++) {
      const v = vectors[j];
      if (v.length !== dim) {
        throw new Error("All vectors must have the same dimension");
      }
      for (let i = 0; i < dim; i++) {
        if (v[i] < result[i]) {
          result[i] = v[i];
        }
      }
    }

    return result;
  }

  // ==================== Distance/Similarity Operations ====================

  /**
   * Manhattan distance (L1)
   */
  manhattan(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum;
  }

  /**
   * Minkowski distance (Lp)
   */
  minkowski(a: Float32Array, b: Float32Array, p: number): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = Math.abs(a[i] - b[i]);
      sum += Math.pow(diff, p);
    }
    return Math.pow(sum, 1.0 / p);
  }

  /**
   * Chebyshev distance (L-infinity)
   */
  chebyshev(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    let maxDiff = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = Math.abs(a[i] - b[i]);
      if (diff > maxDiff) {
        maxDiff = diff;
      }
    }
    return maxDiff;
  }

  /**
   * Hamming distance (for binary vectors)
   */
  hamming(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions must match");
    }

    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        distance++;
      }
    }
    return distance;
  }

  // ==================== Batch Comparison ====================

  /**
   * Compare query against multiple candidates
   * Returns top K most similar vectors
   */
  batchCompare(
    query: Float32Array,
    candidates: Float32Array[],
    topK: number,
    metric: "cosine" | "euclidean" | "dot" = "cosine"
  ): BatchCompareResult[] {
    const results: BatchCompareResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      let similarity: number;

      switch (metric) {
        case "cosine":
          similarity = this.cosine(query, candidates[i]);
          break;
        case "euclidean":
          // For euclidean, lower is better, so negate for sorting
          similarity = -this.euclidean(query, candidates[i]);
          break;
        case "dot":
          similarity = this.dot(query, candidates[i]);
          break;
        default:
          similarity = this.cosine(query, candidates[i]);
      }

      results.push({ index: i, similarity });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    return results.slice(0, Math.min(topK, results.length));
  }

  /**
   * Find all vectors within a radius (using euclidean distance)
   */
  rangeSearch(
    query: Float32Array,
    candidates: Float32Array[],
    radius: number
  ): BatchCompareResult[] {
    const results: BatchCompareResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const distance = this.euclidean(query, candidates[i]);

      if (distance <= radius) {
        // Use negative distance for similarity (lower is better)
        results.push({ index: i, similarity: -distance });
      }
    }

    // Sort by distance (ascending, so descending by negative)
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Approximate nearest neighbors using cosine similarity
   * Faster than exact search but may miss some results
   */
  approxNN(
    query: Float32Array,
    candidates: Float32Array[],
    topK: number,
    sampleSize?: number
  ): BatchCompareResult[] {
    const effectiveSampleSize = sampleSize || Math.min(candidates.length, 1000);

    // Sample candidates if fewer than all
    const sampled =
      effectiveSampleSize < candidates.length
        ? this._sampleCandidates(candidates, effectiveSampleSize)
        : candidates.map((c, i) => ({ vector: c, index: i }));

    const results: BatchCompareResult[] = [];

    for (const { vector, index } of sampled) {
      const similarity = this.cosine(query, vector);
      results.push({ index, similarity });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    return results.slice(0, Math.min(topK, results.length));
  }

  // ==================== Vector Utilities ====================

  /**
   * Clone a vector
   */
  clone(a: Float32Array): Float32Array {
    return new Float32Array(a);
  }

  /**
   * Concatenate vectors
   */
  concat(...vectors: Float32Array[]): Float32Array {
    const totalLength = vectors.reduce((sum, v) => sum + v.length, 0);
    const result = new Float32Array(totalLength);

    let offset = 0;
    for (const v of vectors) {
      result.set(v, offset);
      offset += v.length;
    }

    return result;
  }

  /**
   * Slice a vector
   */
  slice(a: Float32Array, start: number, end?: number): Float32Array {
    return new Float32Array(a.slice(start, end));
  }

  /**
   * Clamp vector values to range
   */
  clamp(a: Float32Array, min: number, max: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = Math.max(min, Math.min(max, a[i]));
    }
    return result;
  }

  /**
   * Apply function to each element
   */
  map(a: Float32Array, fn: (x: number, i: number) => number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = fn(a[i], i);
    }
    return result;
  }

  /**
   * Reduce vector to single value
   */
  reduce(
    a: Float32Array,
    fn: (acc: number, x: number, i: number) => number,
    initial: number
  ): number {
    let acc = initial;
    for (let i = 0; i < a.length; i++) {
      acc = fn(acc, a[i], i);
    }
    return acc;
  }

  /**
   * Check if all elements pass predicate
   */
  every(
    a: Float32Array,
    predicate: (x: number, i: number) => boolean
  ): boolean {
    for (let i = 0; i < a.length; i++) {
      if (!predicate(a[i], i)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if any element passes predicate
   */
  some(a: Float32Array, predicate: (x: number, i: number) => boolean): boolean {
    for (let i = 0; i < a.length; i++) {
      if (predicate(a[i], i)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find index of element
   */
  findIndex(
    a: Float32Array,
    predicate: (x: number, i: number) => boolean
  ): number {
    for (let i = 0; i < a.length; i++) {
      if (predicate(a[i], i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Convert to regular array
   */
  toArray(a: Float32Array): number[] {
    return Array.from(a);
  }

  /**
   * Create from regular array
   */
  static fromArray(arr: number[]): Float32Array {
    return new Float32Array(arr);
  }

  /**
   * Create zero vector
   */
  static zeros(dim: number): Float32Array {
    return new Float32Array(dim);
  }

  /**
   * Create ones vector
   */
  static ones(dim: number): Float32Array {
    const result = new Float32Array(dim);
    result.fill(1);
    return result;
  }

  /**
   * Create random vector (uniform [0, 1))
   */
  static random(dim: number): Float32Array {
    const result = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      result[i] = Math.random();
    }
    return result;
  }

  /**
   * Create random normal vector
   */
  static randomNormal(
    dim: number,
    mean: number = 0,
    std: number = 1
  ): Float32Array {
    const result = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      // Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      result[i] = mean + std * z;
    }
    return result;
  }

  // ==================== Private Helpers ====================

  /**
   * Sample candidates for approximate search
   */
  private _sampleCandidates(
    candidates: Float32Array[],
    sampleSize: number
  ): { vector: Float32Array; index: number }[] {
    const sampled: { vector: Float32Array; index: number }[] = [];
    const indices = new Set<number>();

    while (indices.size < sampleSize && indices.size < candidates.length) {
      const idx = Math.floor(Math.random() * candidates.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        sampled.push({ vector: candidates[idx], index: idx });
      }
    }

    return sampled;
  }

  /**
   * Get the underlying optimizer
   */
  getOptimizer(): SIMDOptimizer {
    return this.optimizer;
  }
}
