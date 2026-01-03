/**
 * VectorIndex - Vector similarity index
 *
 * Approximate nearest neighbor search for embeddings.
 */

import type { MultiModalState, SimilarityMetric } from "../types.js";

/**
 * Vector index entry
 */
interface VectorEntry {
  id: string;
  vector: Float32Array;
  state: MultiModalState;
}

/**
 * Vector index manager (simplified HNSW-like structure)
 */
export class VectorIndex {
  private vectors: VectorEntry[] = [];
  private dimension: number = 768;
  private metric: SimilarityMetric = "cosine";
  private built: boolean = false;

  constructor(dimension: number = 768, metric: SimilarityMetric = "cosine") {
    this.dimension = dimension;
    this.metric = metric;
  }

  /**
   * Add vector to index
   */
  add(state: MultiModalState): void {
    this.vectors.push({
      id: state.id,
      vector: state.embedding.vector,
      state,
    });
    this.built = false;
  }

  /**
   * Build index (pre-compute distances)
   */
  build(): void {
    // In a real implementation, this would build HNSW graph
    // For simplicity, we just mark as built
    this.built = true;
  }

  /**
   * Search k nearest neighbors
   */
  search(
    query: Float32Array,
    k: number = 10
  ): Array<{
    id: string;
    similarity: number;
    state: MultiModalState;
  }> {
    if (!this.built) {
      this.build();
    }

    const results: Array<{
      id: string;
      similarity: number;
      state: MultiModalState;
    }> = [];

    for (const entry of this.vectors) {
      const similarity = this.computeSimilarity(query, entry.vector);
      results.push({
        id: entry.id,
        similarity,
        state: entry.state,
      });
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, k);
  }

  /**
   * Search with threshold
   */
  searchThreshold(
    query: Float32Array,
    threshold: number
  ): Array<{
    id: string;
    similarity: number;
    state: MultiModalState;
  }> {
    if (!this.built) {
      this.build();
    }

    const results: Array<{
      id: string;
      similarity: number;
      state: MultiModalState;
    }> = [];

    for (const entry of this.vectors) {
      const similarity = this.computeSimilarity(query, entry.vector);
      if (similarity >= threshold) {
        results.push({
          id: entry.id,
          similarity,
          state: entry.state,
        });
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Batch search
   */
  searchBatch(
    queries: Float32Array[],
    k: number = 10
  ): Array<
    Array<{
      id: string;
      similarity: number;
      state: MultiModalState;
    }>
  > {
    return queries.map(query => this.search(query, k));
  }

  /**
   * Compute similarity
   */
  private computeSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== this.dimension || b.length !== this.dimension) {
      return 0;
    }

    switch (this.metric) {
      case "cosine":
        return this.cosineSimilarity(a, b);
      case "euclidean":
        return this.euclideanSimilarity(a, b);
      case "dot":
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Euclidean similarity
   */
  private euclideanSimilarity(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    return 1 / (1 + distance);
  }

  /**
   * Dot product
   */
  private dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Remove vector
   */
  remove(id: string): boolean {
    const index = this.vectors.findIndex(v => v.id === id);
    if (index < 0) {
      return false;
    }

    this.vectors.splice(index, 1);
    this.built = false;
    return true;
  }

  /**
   * Clear index
   */
  clear(): void {
    this.vectors = [];
    this.built = false;
  }

  /**
   * Get index size
   */
  size(): number {
    return this.vectors.length;
  }

  /**
   * Check if index is built
   */
  isBuilt(): boolean {
    return this.built;
  }
}
