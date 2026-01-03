/**
 * HNSW Index for fast approximate nearest neighbor search
 */

import type { Vector, SearchResult, SearchOptions } from './types';
import { ensureFloat32Array } from './types';

let wasmModule: any = null;

async function initWasm(): Promise<any> {
  if (wasmModule) {
    return wasmModule;
  }

  try {
    const module = await import('../../native/wasm/pkg/superinstance_wasm.js');
    wasmModule = await module.default();
    return wasmModule;
  } catch (error) {
    throw new Error(`Failed to load WASM module: ${error}`);
  }
}

/**
 * HNSW (Hierarchical Navigable Small World) index
 *
 * Provides fast approximate nearest neighbor search for high-dimensional vectors.
 *
 * @example
 * ```ts
 * const index = new HNSWIndex(768, 10000);
 * await index.insert(1, embedding1);
 * await index.insert(2, embedding2);
 * const results = await index.search(queryEmbedding, { k: 5 });
 * ```
 */
export class HNSWIndex {
  private inner: any = null;
  private dimensions: number;
  private maxElements: number;

  /**
   * Create a new HNSW index
   *
   * @param dimensions - Vector dimensionality (e.g., 768 for OpenAI embeddings)
   * @param maxElements - Maximum number of vectors to store
   */
  constructor(dimensions: number, maxElements: number = 10000) {
    this.dimensions = dimensions;
    this.maxElements = maxElements;
  }

  /**
   * Initialize the WASM index
   */
  private async ensureInitialized(): Promise<void> {
    if (this.inner) {
      return;
    }

    const wasm = await initWasm();
    this.inner = new wasm.HNSWIndex(this.dimensions, this.maxElements);
  }

  /**
   * Insert a vector into the index
   *
   * @param id - Unique identifier for this vector
   * @param vector - Vector to insert
   * @throws Error if dimensions don't match or index is full
   */
  async insert(id: number, vector: Vector): Promise<void> {
    await this.ensureInitialized();
    const v = ensureFloat32Array(vector);
    this.inner.insert(id, v);
  }

  /**
   * Search for the k nearest neighbors
   *
   * @param query - Query vector
   * @param options - Search options
   * @returns Array of search results sorted by similarity (descending)
   */
  async search(query: Vector, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();
    const q = ensureFloat32Array(query);
    const k = options.k ?? 10;

    const results = this.inner.search(q, k);

    // Convert from [id, score] pairs to SearchResult objects
    return Array.from(results, (pair: any) => ({
      id: pair[0],
      score: pair[1],
    }));
  }

  /**
   * Get the number of vectors in the index
   */
  async size(): Promise<number> {
    await this.ensureInitialized();
    return this.inner.size();
  }

  /**
   * Clear all vectors from the index
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    this.inner.clear();
  }

  /**
   * Check if the index is empty
   */
  async isEmpty(): Promise<boolean> {
    const size = await this.size();
    return size === 0;
  }
}
