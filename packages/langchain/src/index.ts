/**
 * @fileoverview Main entry point for @lsi/langchain package
 *
 * This package provides comprehensive LangChain integration for Aequor Cognitive Orchestration Platform.
 *
 * @example
 * ```ts
 * import { AequorLLM, AequorEmbeddings, AequorMemory } from '@lsi/langchain';
 *
 * const llm = new AequorLLM();
 * const embeddings = new AequorEmbeddings();
 * const memory = new AequorMemory();
 * ```
 */

// ============================================================================
// LLM ADAPTER
// ============================================================================

export {
  AequorLLM,
  createAequorLLM,
  type AequorLLMConfig,
  type AequorLLMInput,
  type RoutingMetadata,
  type AequorLLMResult,
} from "./llm/index.js";

// ============================================================================
// EMBEDDINGS ADAPTER
// ============================================================================

export {
  AequorEmbeddings,
  createAequorEmbeddings,
  type AequorEmbeddingsConfig,
  type EmbeddingResult,
} from "./embeddings/index.js";

// ============================================================================
// TOOLS
// ============================================================================

export {
  AequorQueryTool,
  AequorSemanticSearchTool,
  AequorPrivacyTool,
  AequorIntentTool,
  AequorCacheStatsTool,
  AequorComplexityTool,
  createAequorTools,
  type AequorToolsConfig,
} from "./tools/index.js";

// ============================================================================
// MEMORY
// ============================================================================

export {
  AequorMemory,
  createAequorMemory,
  type AequorMemoryConfig,
  type ConversationTurn,
} from "./memory/index.js";

// ============================================================================
// UTILITIES
// ============================================================================

export {
  formatRoutingResult,
  estimateTokenCount,
  calculateComplexity,
  type RoutingSummary,
} from "./utils/index.js";

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0" as const;
export const PACKAGE_NAME = "@lsi/langchain" as const;
