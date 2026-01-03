/**
 * @fileoverview Model Capability Discovery Protocol Types
 *
 * Defines types for automatic model capability discovery, fingerprinting,
 * and caching. This enables the platform to auto-discover model capabilities
 * without hardcoding profiles.
 *
 * @module @lsi/protocol/capability
 */

// ============================================================================
// MODEL CAPABILITY TYPES
// ============================================================================

/**
 * Intent types that models can support
 */
export type ModelIntentType =
  | "chat"           // Conversational dialogue
  | "completion"     // Text completion
  | "embedding"      // Text-to-vector embeddings
  | "classification" // Text classification
  | "summarization"  // Text summarization
  | "extraction"     // Information extraction
  | "translation"    // Language translation
  | "code-generation" // Code generation and completion
  | "reasoning";     // Complex reasoning tasks

/**
 * Capability profile for a model
 *
 * Describes what a model can do, its limits, and performance characteristics.
 */
export interface ModelCapability {
  /** Model identifier (e.g., "llama3:8b", "mistral:7b") */
  modelId: string;

  /** Display name */
  name: string;

  /** Model family (e.g., "llama", "mistral", "qwen") */
  family: string;

  /** Parameter size (e.g., "7B", "13B", "70B") */
  parameterSize: string;

  /** Quantization level (e.g., "Q4_K_M", "Q5_K_M", "Q8_0") */
  quantizationLevel?: string;

  /** Maximum context window in tokens */
  maxContextLength: number;

  /** Supported intent types */
  supportedIntents: ModelIntentType[];

  /** Quality score (0-1, estimated via benchmarks) */
  qualityScore: number;

  /** Average latency in milliseconds (for 100-token generation) */
  averageLatencyMs: number;

  /** Token throughput (tokens/second) */
  tokensPerSecond: number;

  /** Embedding dimension (if model supports embeddings) */
  embeddingDimension?: number;

  /** Whether model supports streaming responses */
  supportsStreaming: boolean;

  /** Whether model supports function calling */
  supportsFunctionCalling: boolean;

  /** Whether model supports vision/multimodal input */
  supportsVision: boolean;

  /** Recommended use cases */
  recommendedUseCases: string[];

  /** Limitations and known issues */
  limitations: string[];

  /** Hardware requirements (min VRAM in GB) */
  minVRAM?: number;

  /** When this capability was discovered */
  discoveredAt: number;

  /** Last time this was verified */
  verifiedAt?: number;

  /** Capability fingerprint version */
  version: string;
}

/**
 * Result of a capability discovery operation
 */
export interface CapabilityDiscoveryResult {
  /** Whether discovery was successful */
  success: boolean;

  /** Discovered capabilities (if successful) */
  capabilities?: ModelCapability[];

  /** Any errors that occurred */
  errors?: Array<{
    modelId: string;
    error: string;
  }>;

  /** Number of models discovered */
  discoveredCount: number;

  /** Number of models that failed */
  failedCount: number;

  /** Discovery timestamp */
  timestamp: number;

  /** Time taken for discovery (ms) */
  duration: number;
}

/**
 * Benchmark result for quality assessment
 */
export interface BenchmarkResult {
  /** Model being benchmarked */
  modelId: string;

  /** Benchmark name */
  benchmarkName: string;

  /** Score (0-1) */
  score: number;

  /** Benchmark duration (ms) */
  duration: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Latency measurement
 */
export interface LatencyMeasurement {
  /** Model being measured */
  modelId: string;

  /** Prompt length (tokens) */
  promptTokens: number;

  /** Generation length (tokens) */
  generatedTokens: number;

  /** Time to first token (ms) */
  timeToFirstToken: number;

  /** Total generation time (ms) */
  totalTime: number;

  /** Tokens per second */
  tokensPerSecond: number;

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// CAPABILITY CACHE TYPES
// ============================================================================

/**
 * Cache entry for discovered capabilities
 */
export interface CapabilityCacheEntry {
  /** Cached capability */
  capability: ModelCapability;

  /** When cached */
  cachedAt: number;

  /** Cache TTL (ms) */
  ttl: number;

  /** Number of times accessed */
  hitCount: number;

  /** Last access time */
  lastAccessed: number;
}

/**
 * Capability cache configuration
 */
export interface CapabilityCacheConfig {
  /** Enable/disable caching */
  enabled?: boolean;

  /** Default TTL for cache entries (ms, default: 24 hours) */
  ttl?: number;

  /** Maximum cache size */
  maxSize?: number;

  /** Cache storage backend */
  storage?: "memory" | "file" | "redis";

  /** Storage path (for file backend) */
  storagePath?: string;

  /** Redis connection string (for redis backend) */
  redisUrl?: string;
}

// ============================================================================
// DISCOVERY SERVICE TYPES
// ============================================================================

/**
 * Configuration for capability discovery service
 */
export interface CapabilityDiscoveryConfig {
  /** Cache configuration */
  cache?: CapabilityCacheConfig;

  /** Whether to run benchmarks on discovery */
  runBenchmarks?: boolean;

  /** Number of benchmark samples to take */
  benchmarkSamples?: number;

  /** Benchmark timeout (ms) */
  benchmarkTimeout?: number;

  /** Whether to verify cached capabilities */
  verifyOnLoad?: boolean;

  /** Discovery timeout (ms) */
  discoveryTimeout?: number;

  /** Logging configuration */
  logging?: {
    level?: "debug" | "info" | "warn" | "error";
    enabled?: boolean;
  };
}

/**
 * Discovery progress callback
 */
export type DiscoveryProgressCallback = (progress: {
  /** Current model being discovered */
  currentModel: string;

  /** Number of models discovered so far */
  discovered: number;

  /** Total models to discover */
  total: number;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current operation */
  operation: string;
}) => void;

// ============================================================================
// MODEL FINGERPRINT TYPES
// ============================================================================

/**
 * Model fingerprint for capability identification
 */
export interface ModelFingerprint {
  /** Model identifier */
  modelId: string;

  /** Model family detected from name */
  family: string;

  /** Parameter size extracted from name */
  parameterSize: string;

  /** Quantization level extracted from name */
  quantizationLevel?: string;

  /** Hash of model metadata */
  metadataHash: string;

  /** Fingerprint version */
  version: string;
}

/**
 * Fingerprint match result
 */
export interface FingerprintMatch {
  /** Whether a match was found */
  matched: boolean;

  /** Matched capability (if found) */
  capability?: ModelCapability;

  /** Match confidence (0-1) */
  confidence: number;

  /** Reason for match/no-match */
  reason: string;
}

// ============================================================================
// WELL-KNOWN MODEL PROFILES
// ============================================================================

/**
 * Well-known model capability profiles
 *
 * These serve as fallback when auto-discovery fails or for quick lookups.
 */
export interface WellKnownModelProfile {
  /** Model name pattern (regex or glob) */
  pattern: string;

  /** Base capability profile */
  capability: Partial<ModelCapability>;

  /** Expected capabilities */
  expectedIntents: ModelIntentType[];

  /** Known good configuration */
  recommendedConfig: Record<string, unknown>;
}

/**
 * Registry of well-known models
 */
export type WellKnownModelRegistry = Record<string, WellKnownModelProfile>;

// ============================================================================
// EXPORTS
// ============================================================================

// All types are already exported above with their declarations
// This section is reserved for any re-exports or utility functions if needed
