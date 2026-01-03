/**
 * HybridIndex - Hybrid indexing for multi-modal states
 *
 * Combines vector similarity search with traditional indexing
 * for fast multi-modal queries.
 */

import type {
  MultiModalState,
  IndexConfig,
  IndexStats,
  ModalityType,
} from "../types.js";

/**
 * Hybrid index manager
 */
export class HybridIndex {
  private config: IndexConfig;
  private textIndex: Map<string, Set<string>> = new Map();
  private visualIndex: Map<number, Set<string>> = new Map(); // Bucket-based
  private vectorIndex: Float32Array[] = [];
  private stateIds: string[] = [];
  private built: boolean = false;

  constructor(config?: Partial<IndexConfig>) {
    this.config = {
      type: "hybrid",
      dimension: 768,
      metric: "cosine",
      quantized: false,
      M: 16,
      efConstruction: 200,
      ...config,
    };
  }

  /**
   * Index states for fast querying
   */
  indexStates(states: MultiModalState[]): void {
    this.clear();

    for (const state of states) {
      this.addState(state);
    }

    this.built = true;
  }

  /**
   * Add state to index
   */
  addState(state: MultiModalState): void {
    const id = state.id;

    // Text index (inverted index on input text)
    const words = state.text.input.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (!this.textIndex.has(word)) {
        this.textIndex.set(word, new Set());
      }
      this.textIndex.get(word)!.add(id);
    }

    // Visual index (bucket-based on first dimension)
    const visualBucket = Math.floor(state.visual.embedding[0] * 100);
    if (!this.visualIndex.has(visualBucket)) {
      this.visualIndex.set(visualBucket, new Set());
    }
    this.visualIndex.get(visualBucket)!.add(id);

    // Vector index
    this.vectorIndex.push(state.embedding.vector);
    this.stateIds.push(id);
  }

  /**
   * Search by text
   */
  searchText(query: string): Set<string> {
    const results = new Set<string>();
    const words = query.toLowerCase().split(/\s+/);

    for (const word of words) {
      const matches = this.textIndex.get(word);
      if (matches) {
        for (const id of matches) {
          results.add(id);
        }
      }
    }

    return results;
  }

  /**
   * Search by vector similarity
   */
  searchVector(
    query: Float32Array,
    k: number = 10
  ): Array<{ id: string; similarity: number }> {
    if (this.vectorIndex.length === 0) {
      return [];
    }

    const results: Array<{ id: string; similarity: number }> = [];

    for (let i = 0; i < this.vectorIndex.length; i++) {
      const similarity = this.cosineSimilarity(query, this.vectorIndex[i]);
      results.push({ id: this.stateIds[i], similarity });
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, k);
  }

  /**
   * Hybrid search combining text and vector
   */
  searchHybrid(
    textQuery: string,
    vectorQuery: Float32Array,
    k: number = 10,
    textWeight: number = 0.5,
    vectorWeight: number = 0.5
  ): Array<{ id: string; score: number }> {
    const textResults = this.searchText(textQuery);
    const vectorResults = this.searchVector(vectorQuery, k * 2);

    // Combine scores
    const combined = new Map<string, number>();

    for (const id of textResults) {
      combined.set(id, (combined.get(id) || 0) + textWeight);
    }

    for (const { id, similarity } of vectorResults) {
      combined.set(id, (combined.get(id) || 0) + similarity * vectorWeight);
    }

    // Convert to array and sort
    const results = Array.from(combined.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);

    return results.slice(0, k);
  }

  /**
   * Get state by ID
   */
  getState(id: string): number | undefined {
    return this.stateIds.indexOf(id);
  }

  /**
   * Remove state from index
   */
  removeState(id: string): boolean {
    const index = this.getState(id);
    if (index < 0) {
      return false;
    }

    this.vectorIndex.splice(index, 1);
    this.stateIds.splice(index, 1);

    // Remove from text and visual indexes (simplified - full removal would be more complex)
    return true;
  }

  /**
   * Clear index
   */
  clear(): void {
    this.textIndex.clear();
    this.visualIndex.clear();
    this.vectorIndex = [];
    this.stateIds = [];
    this.built = false;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalStates: number;
    indexedModalities: ModalityType[];
    indexSize: number;
  } {
    return {
      totalStates: this.stateIds.length,
      indexedModalities: ["text", "visual", "embedding"],
      indexSize: this.vectorIndex.length * 768 * 4, // 4 bytes per float
    };
  }

  /**
   * Check if index is built
   */
  isBuilt(): boolean {
    return this.built;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

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
   * Update index configuration
   */
  updateConfig(config: Partial<IndexConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): IndexConfig {
    return { ...this.config };
  }
}
