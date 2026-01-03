/**
 * @lsi/protocol - Vector Database Adapter Interface
 *
 * Defines the universal interface for vector database adapters.
 * Supports multiple backends: Pinecone, Weaviate, Qdrant, Milvus, etc.
 *
 * @packageDocumentation
 */

import type { BaseResult, BaseConfig } from "./common.js";

// ============================================================================
// VECTOR DATABASE PROTOCOL TYPES
// ============================================================================

/**
 * Vector identifier
 */
export type VectorId = string & { __brand: "VectorId" };

/**
 * Namespace/collection identifier for multi-tenancy
 */
export type NamespaceId = string & { __brand: "NamespaceId" };

/**
 * Embedding vector (Float32Array for efficiency)
 */
export type EmbeddingVector = Float32Array;

/**
 * Distance metric for similarity search
 */
export enum DistanceMetric {
  /** Cosine similarity (default for normalized vectors) */
  COSINE = "cosine",
  /** Euclidean distance (L2) */
  EUCLIDEAN = "euclidean",
  /** Dot product (faster for normalized vectors) */
  DOTPRODUCT = "dotproduct",
  /** Manhattan distance (L1) */
  MANHATTAN = "manhattan",
}

/**
 * Vector record with metadata
 */
export interface VectorRecord {
  /** Unique identifier */
  id: VectorId;
  /** Embedding vector */
  vector: EmbeddingVector;
  /** Optional metadata for filtering */
  metadata?: Record<string, string | number | boolean | string[]>;
  /** Optional namespace/collection */
  namespace?: NamespaceId;
}

/**
 * Similarity search result with score
 */
export interface VectorMatch {
  /** Vector identifier */
  id: VectorId;
  /** Similarity score (higher = more similar) */
  score: number;
  /** Distance value (lower = closer, depends on metric) */
  distance?: number;
  /** Associated metadata */
  metadata?: Record<string, string | number | boolean | string[]>;
}

/**
 * Filter expression for metadata filtering
 */
export interface MetadataFilter {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";
  /** Value(s) to compare */
  value: string | number | boolean | string[] | number[];
}

/**
 * Vector query options
 */
export interface VectorQueryOptions {
  /** Number of results to return */
  topK: number;
  /** Distance metric to use */
  metric?: DistanceMetric;
  /** Namespace to search within */
  namespace?: NamespaceId;
  /** Optional metadata filters */
  filter?: MetadataFilter | MetadataFilter[];
  /** Include vector values in results (default: false) */
  includeVectors?: boolean;
  /** Include metadata in results (default: true) */
  includeMetadata?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Number of successful operations */
  succeeded: number;
  /** Number of failed operations */
  failed: number;
  /** Error messages for failed operations */
  errors: Array<{ id: VectorId; error: string }>;
}

/**
 * Vector database statistics
 */
export interface VectorDatabaseStats {
  /** Total number of vectors */
  totalVectors: number;
  /** Number of namespaces/collections */
  totalNamespaces: number;
  /** Dimension of vectors */
  dimension: number;
  /** Index type (e.g., "hnsw", "ivf", "flat") */
  indexType: string;
  /** Database size in bytes (if available) */
  sizeBytes?: number;
  /** Additional backend-specific stats */
  backendStats?: Record<string, unknown>;
}

/**
 * Vector database health status
 */
export interface VectorDatabaseHealth {
  /** Whether the database is healthy */
  healthy: boolean;
  /** Latency in milliseconds */
  latency: number;
  /** Additional status information */
  status?: string;
  /** Error message if unhealthy */
  error?: string;
}

// ============================================================================
// VECTOR DATABASE CONFIGURATION
// ============================================================================

/**
 * Base configuration for vector database adapters
 */
export interface VectorDatabaseConfig extends BaseConfig {
  /** Backend type */
  backend: "pinecone" | "weaviate" | "qdrant" | "milvus" | "memory" | "hnsw";
  /** Vector dimension */
  dimension: number;
  /** API key/credentials */
  credentials?: {
    apiKey?: string;
    /** Endpoint URL (for self-hosted) */
    endpoint?: string;
    /** Username for basic auth */
    username?: string;
    /** Password for basic auth */
    password?: string;
  };
  /** Connection settings */
  connection?: {
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Retry delay in milliseconds */
    retryDelay?: number;
    /** Connection pool size */
    poolSize?: number;
  };
  /** Default namespace/collection */
  defaultNamespace?: NamespaceId;
  /** Distance metric */
  metric?: DistanceMetric;
  /** Whether to enable TLS/SSL */
  tls?: boolean;
}

/**
 * Pinecone-specific configuration
 */
export interface PineconeConfig extends VectorDatabaseConfig {
  backend: "pinecone";
  /** Pinecone API key */
  credentials: {
    apiKey: string;
  };
  /** Pinecone environment (e.g., "us-east-1-aws") */
  environment?: string;
  /** Pinecone project ID */
  projectId?: string;
  /** Index name */
  indexName: string;
  /** Replication factor */
  replicationFactor?: number;
  /** Shard count */
  shards?: number;
  /** Pod type */
  podType?: "p1.x1" | "p1.x2" | "p2.x1" | "s1.x1" | "s1.x2";
}

/**
 * Weaviate-specific configuration
 */
export interface WeaviateConfig extends VectorDatabaseConfig {
  backend: "weaviate";
  /** Weaviate endpoint URL */
  credentials: {
    endpoint: string;
    apiKey?: string;
  };
  /** Class/collection name */
  className: string;
  /** Vectorizer module (e.g., "text2vec-openai") */
  vectorizer?: string;
  /** Module configuration */
  moduleConfig?: Record<string, unknown>;
  /** Replication factor */
  replicationFactor?: number;
}

/**
 * Qdrant-specific configuration
 */
export interface QdrantConfig extends VectorDatabaseConfig {
  backend: "qdrant";
  /** Qdrant endpoint URL */
  credentials: {
    endpoint: string;
    apiKey?: string;
  };
  /** Collection name */
  collectionName: string;
  /** HNSW configuration */
  hnswConfig?: {
    /** Number of connections per node */
    m?: number;
    /** Number of candidate neighbors */
    efConstruct?: number;
    /** Search depth */
    ef?: number;
  };
  /** Payload indexing */
  payloadIndex?: Array<{
    fieldName: string;
    fieldType: "keyword" | "integer" | "float" | "bool";
  }>;
}

/**
 * Milvus-specific configuration
 */
export interface MilvusConfig extends VectorDatabaseConfig {
  backend: "milvus";
  /** Milvus endpoint URL */
  credentials: {
    endpoint: string;
    username?: string;
    password?: string;
    token?: string;
  };
  /** Collection name */
  collectionName: string;
  /** Index type */
  indexType?: "IVF_FLAT" | "IVF_SQ8" | "IVF_PQ" | "HNSW" | "ANNOY";
  /** Index parameters */
  indexParams?: Record<string, number | string>;
  /** Consistency level */
  consistencyLevel?: "Strong" | "Session" | "Bounded" | "Eventually";
}

/**
 * In-memory HNSW configuration
 */
export interface MemoryConfig extends VectorDatabaseConfig {
  backend: "memory" | "hnsw";
  /** Maximum number of vectors */
  maxVectors?: number;
  /** HNSW parameters */
  hnsw?: {
    /** Number of bidirectional links */
    M?: number;
    /** Construction-time pruning */
    efConstruction?: number;
    /** Search-time pruning */
    ef?: number;
  };
}

// ============================================================================
// VECTOR DATABASE ADAPTER INTERFACE
// ============================================================================

/**
 * Universal vector database adapter interface
 *
 * All vector database backends must implement this interface.
 * Provides a consistent API for vector operations regardless of backend.
 */
export interface IVectorDatabaseAdapter {
  /**
   * Initialize the adapter and establish connection
   */
  initialize(): Promise<void>;

  /**
   * Check if the adapter is healthy and responsive
   */
  healthCheck(): Promise<VectorDatabaseHealth>;

  /**
   * Get database statistics
   */
  getStats(): Promise<VectorDatabaseStats>;

  /**
   * Create or configure a namespace/collection
   */
  createNamespace(namespace: NamespaceId, config?: Record<string, unknown>): Promise<void>;

  /**
   * Delete a namespace/collection
   */
  deleteNamespace(namespace: NamespaceId): Promise<void>;

  /**
   * List all namespaces/collections
   */
  listNamespaces(): Promise<NamespaceId[]>;

  /**
   * Check if a namespace exists
   */
  namespaceExists(namespace: NamespaceId): Promise<boolean>;

  /**
   * Insert or update a single vector
   */
  upsert(record: VectorRecord): Promise<void>;

  /**
   * Insert or update multiple vectors
   */
  upsertBatch(records: VectorRecord[]): Promise<BatchOperationResult>;

  /**
   * Get a vector by ID
   */
  get(id: VectorId, namespace?: NamespaceId): Promise<VectorRecord | null>;

  /**
   * Get multiple vectors by IDs
   */
  getBatch(ids: VectorId[], namespace?: NamespaceId): Promise<VectorRecord[]>;

  /**
   * Delete a vector by ID
   */
  delete(id: VectorId, namespace?: NamespaceId): Promise<boolean>;

  /**
   * Delete multiple vectors by IDs
   */
  deleteBatch(ids: VectorId[], namespace?: NamespaceId): Promise<BatchOperationResult>;

  /**
   * Search for similar vectors
   */
  search(
    query: EmbeddingVector,
    options: VectorQueryOptions
  ): Promise<VectorMatch[]>;

  /**
   * Batch search for multiple queries
   */
  searchBatch(
    queries: EmbeddingVector[],
    options: VectorQueryOptions
  ): Promise<VectorMatch[][]>;

  /**
   * Delete all vectors in a namespace
   */
  clearNamespace(namespace: NamespaceId): Promise<void>;

  /**
   * Close the adapter and release resources
   */
  close(): Promise<void>;

  /**
   * Get adapter configuration (without sensitive credentials)
   */
  getConfig(): Omit<VectorDatabaseConfig, "credentials">;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result of a vector database operation
 */
export type VectorDatabaseResult<T = void> = BaseResult<T>;

/**
 * Result of a vector search operation
 */
export interface VectorSearchResult extends BaseResult<{
  /** Search results */
  matches: VectorMatch[];
  /** Search latency in milliseconds */
  latency: number;
  /** Number of vectors searched */
  vectorsSearched: number;
}> {
  /** Query namespace */
  namespace?: NamespaceId;
}

/**
 * Result of a batch upsert operation
 */
export interface BatchUpsertResult extends BaseResult<{
  /** Number of vectors upserted */
  count: number;
  /** Operation latency in milliseconds */
  latency: number;
}> {
  /** Failed records with errors */
  errors?: Array<{ id: VectorId; error: string }>;
}

// ============================================================================
// FACTORY TYPES
// ============================================================================

/**
 * Vector database adapter factory configuration
 */
export interface VectorDatabaseFactoryConfig {
  /** Default adapter to use */
  defaultAdapter?: VectorDatabaseConfig["backend"];
  /** Configured adapters */
  adapters: Array<Omit<VectorDatabaseConfig, "credentials"> & {
    /** Unique name for this adapter configuration */
    name: string;
    /** Priority for selection (higher = preferred) */
    priority?: number;
  }>;
  /** Fallback adapters in order of preference */
  fallbackOrder?: VectorDatabaseConfig["backend"][];
}

/**
 * Adapter selection result
 */
export interface AdapterSelection {
  /** Selected adapter */
  adapter: IVectorDatabaseAdapter;
  /** Adapter name/identifier */
  name: string;
  /** Selection reason */
  reason: string;
  /** Confidence in selection */
  confidence: number;
}
