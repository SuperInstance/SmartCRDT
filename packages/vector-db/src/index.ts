/**
 * @lsi/vector-db - Distributed Vector Database with Multiple Backend Support
 *
 * This package provides:
 * - In-memory HNSW vector database
 * - Pinecone adapter for cloud vector search
 * - Weaviate adapter for flexible semantic search
 * - Migration utilities for backend switching
 * - Performance benchmarking tools
 *
 * @packageDocumentation
 */

// Core in-memory vector database
export {
  VectorDatabase,
  createVectorDatabase,
  DEFAULT_VECTOR_DB_CONFIG,
  HIGH_PERFORMANCE_CONFIG,
  LOW_MEMORY_CONFIG,
} from "./VectorDatabase.js";
export type {
  VectorDatabaseConfig,
  VectorSearchResult,
} from "./VectorDatabase.js";

// Vector database adapters
export {
  PineconeAdapter,
  createPineconeAdapter,
} from "./adapters/PineconeAdapter.js";
export {
  WeaviateAdapter,
  createWeaviateAdapter,
} from "./adapters/WeaviateAdapter.js";

// Vector database factory
export {
  VectorDBFactory,
  createVectorDBFactory,
  createAdapter,
  createAdapterFromEnv,
} from "./VectorDBFactory.js";

// Migration utilities
export {
  migrateFromHNSW,
  migrateAdapters,
  exportToJSON,
  importFromJSON,
  MigrationProgressBar,
} from "./migration.js";
export type {
  MigrationConfig,
  MigrationProgress,
  MigrationResult,
} from "./migration.js";

// Re-export protocol types for convenience
export type {
  VectorId,
  NamespaceId,
  EmbeddingVector,
  DistanceMetric,
  VectorRecord,
  VectorMatch,
  MetadataFilter,
  VectorQueryOptions,
  BatchOperationResult,
  VectorDatabaseStats,
  VectorDatabaseHealth,
  VectorDatabaseConfig,
  PineconeConfig,
  WeaviateConfig,
  QdrantConfig,
  MilvusConfig,
  MemoryConfig,
  IVectorDatabaseAdapter,
} from "@lsi/protocol";

// Version info
export const VERSION = "2.0.0";
