/**
 * Type definitions for SuperInstance WASM bindings
 */

/**
 * Similarity search result
 */
export interface SearchResult {
  /** Document ID */
  id: number;
  /** Similarity score (0-1) */
  score: number;
}

/**
 * Cache hit result
 */
export interface CacheHit {
  /** Cache key */
  key: string;
  /** Cached value */
  value: string;
  /** Similarity score */
  score: number;
}

/**
 * Semantic search options
 */
export interface SearchOptions {
  /** Number of results to return */
  k?: number;
  /** Minimum similarity threshold */
  threshold?: number;
}

/**
 * Vector type (can be a typed array or regular array)
 */
export type Vector = Float32Array | number[];

/**
 * Ensure input is a Float32Array
 */
export function ensureFloat32Array(vector: Vector): Float32Array {
  if (vector instanceof Float32Array) {
    return vector;
  }
  return new Float32Array(vector);
}
