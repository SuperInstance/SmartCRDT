/**
 * @lsi/llamaindex - LlamaIndex integration for Aequor
 *
 * This package provides seamless integration between Aequor's cognitive orchestration
 * and LlamaIndex's RAG framework.
 *
 * Features:
 * - Automatic complexity-based routing (local/cloud)
 * - Semantic caching with 80%+ hit rate
 * - High-performance embeddings with HNSW indexing
 * - Cost-aware routing with budget control
 * - Privacy-preserving RAG
 *
 * @example
 * ```ts
 * import { AequorLLM } from '@lsi/llamaindex/llm';
 * import { AequorEmbedding } from '@lsi/llamaindex/embeddings';
 * import { AequorCache } from '@lsi/llamaindex/cache';
 * import { Settings } from 'llamaindex';
 *
 * // Configure LlamaIndex with Aequor
 * Settings.llm = new AequorLLM({ enableCache: true });
 * Settings.embedModel = new AequorEmbedding({ enableCache: true });
 * Settings.llmCache = new AequorCache({ similarityThreshold: 0.85 });
 *
 * // Use LlamaIndex as normal - Aequor handles routing & caching
 * const index = await VectorStoreIndex.fromDocuments(documents);
 * const queryEngine = index.asQueryEngine();
 * const response = await queryEngine.query("What is Aequor?");
 * ```
 */

// LLM adapter
export { AequorLLM, createAequorLLM } from "./llm/AequorLLM.js";
export type {
  AequorLLMConfig,
  AequorCompletionResult,
} from "./llm/AequorLLM.js";

// Embedding adapter
export {
  AequorEmbedding,
  createAequorEmbedding,
  DEFAULT_AEQUOR_EMBEDDING_CONFIG,
} from "./embeddings/AequorEmbedding.js";
export type {
  AequorEmbeddingConfig,
  EmbeddingCacheEntry,
} from "./embeddings/AequorEmbedding.js";

// Cache adapter
export {
  AequorCache,
  createAequorCache,
  DEFAULT_AEQUOR_CACHE_CONFIG,
} from "./cache/AequorCache.js";
export type {
  AequorCacheConfig,
  CachedResult,
} from "./cache/AequorCache.js";

// Re-export commonly used types
export type { RouterConfig } from "@lsi/cascade";
