/**
 * Semantic Cache for storing and retrieving similar queries
 */

import type { Vector, CacheHit } from './types';
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
 * Semantic Cache
 *
 * High-performance cache that stores queries with their embeddings
 * and retrieves similar queries based on semantic similarity.
 *
 * @example
 * ```ts
 * const cache = new SemanticCache(0.85, 1000);
 *
 * // Insert a query-response pair
 * await cache.insert("What is AI?", "AI stands for Artificial Intelligence", embedding);
 *
 * // Search for similar queries
 * const hits = await cache.search(queryEmbedding);
 * if (hits.length > 0) {
 *   console.log("Found similar query:", hits[0].key);
 *   console.log("Cached response:", hits[0].value);
 * }
 * ```
 */
export class SemanticCache {
  private inner: any = null;
  private threshold: number;
  private maxSize: number;

  /**
   * Create a new semantic cache
   *
   * @param threshold - Minimum similarity threshold (0.0 to 1.0)
   * @param maxSize - Maximum number of entries
   */
  constructor(threshold: number = 0.85, maxSize: number = 1000) {
    this.threshold = threshold;
    this.maxSize = maxSize;
  }

  /**
   * Initialize the WASM cache
   */
  private async ensureInitialized(): Promise<void> {
    if (this.inner) {
      return;
    }

    const wasm = await initWasm();
    this.inner = new wasm.SemanticCache(this.threshold, this.maxSize);
  }

  /**
   * Insert a value into the cache
   *
   * @param key - Cache key (e.g., query text)
   * @param value - Value to store (e.g., response text)
   * @param embedding - Semantic embedding vector
   * @returns true if inserted, false if similar entry exists
   */
  async insert(key: string, value: string, embedding: Vector): Promise<boolean> {
    await this.ensureInitialized();
    const emb = ensureFloat32Array(embedding);
    return this.inner.insert(key, value, emb);
  }

  /**
   * Search for similar entries
   *
   * @param embedding - Query embedding
   * @returns Array of cache hits (key, value, score)
   */
  async search(embedding: Vector): Promise<CacheHit[]> {
    await this.ensureInitialized();
    const emb = ensureFloat32Array(embedding);
    const results = this.inner.search(emb);
    return Array.from(results);
  }

  /**
   * Check if a similar entry exists
   *
   * @param embedding - Query embedding
   * @returns First matching cache hit, or undefined if none found
   */
  async get(embedding: Vector): Promise<CacheHit | undefined> {
    const hits = await this.search(embedding);
    return hits[0];
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    this.inner.clear();
  }

  /**
   * Get the number of entries
   */
  async size(): Promise<number> {
    await this.ensureInitialized();
    return this.inner.size();
  }

  /**
   * Check if the cache is empty
   */
  async isEmpty(): Promise<boolean> {
    const size = await this.size();
    return size === 0;
  }

  /**
   * Get or insert pattern
   *
   * Search for a similar entry, and if not found, insert the new entry.
   *
   * @param key - Cache key
   * @param value - Value to store if not found
   * @param embedding - Query embedding
   * @returns Cache hit if found, undefined if inserted
   */
  async getOrInsert(
    key: string,
    value: string,
    embedding: Vector
  ): Promise<CacheHit | undefined> {
    const hit = await this.get(embedding);
    if (hit) {
      return hit;
    }

    await this.insert(key, value, embedding);
    return undefined;
  }
}
