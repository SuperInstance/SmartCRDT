/**
 * SuperInstance WebAssembly Bindings
 *
 * High-performance WebAssembly bindings for browser and edge deployment.
 *
 * @module @lsi/wasm
 */

// Re-export all types
export type {
  Vector,
  SearchResult,
  CacheHit,
  SearchOptions,
} from './types';

// Re-export all functions and classes
export {
  ensureFloat32Array,
} from './types';

export {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  batchCosineSimilarity,
  normalize,
} from './similarity';

export {
  HNSWIndex,
} from './hnsw';

export {
  GCounter,
} from './crdt';

export {
  SemanticCache,
} from './cache';

// Convenience exports
export { default as SemanticSearch } from './hnsw';
export { default as CollaborativeCounter } from './crdt';
