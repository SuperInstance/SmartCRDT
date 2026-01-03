/**
 * @lsi/embeddings - Production-ready embedding services for Aequor
 *
 * This package provides unified embedding services supporting:
 * - OpenAI API (text-embedding-3-small, text-embedding-3-large)
 * - Ollama local models (nomic-embed-text, mxbai-embed-large)
 * - Automatic fallback mechanisms
 * - Batch processing for efficiency
 *
 * @packageDocumentation
 */

// Export OpenAI embedding service
export {
  OpenAIEmbeddingService,
  type EmbeddingServiceConfig,
  type EmbeddingResult,
  type EmbeddingError,
} from "./OpenAIEmbeddingService.js";
