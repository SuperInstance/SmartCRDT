/**
 * @lsi/vector-db/quantization - Product Quantization Types
 *
 * Type definitions for Product Quantization (PQ) and Optimized Product Quantization (OPQ).
 * Provides up to 64x compression with <2% accuracy loss for embedding vectors.
 *
 * @module types
 */

// ============================================================================
// PRODUCT QUANTIZATION CONFIGURATION
// ============================================================================

/**
 * Product Quantization configuration
 *
 * Product Quantization splits a high-dimensional vector into subvectors,
 * each quantized independently using k-means clustering.
 */
export interface ProductQuantizationConfig {
  /** Number of subspaces (M) - divides vector dimension */
  numSubspaces: number;

  /** Number of centroids per subspace (K) - typically 256 for 8-bit codes */
  numCentroids: number;

  /** Vector dimensionality (must be divisible by numSubspaces) */
  dimension: number;

  /** Maximum training iterations */
  maxIterations: number;

  /** Convergence threshold */
  convergenceThreshold: number;

  /** Number of training samples */
  trainingSamples?: number;

  /** Random seed for reproducibility */
  seed?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Optimized Product Quantization configuration
 *
 * OPQ applies a rotation matrix before PQ to minimize quantization error.
 */
export interface OPQConfig extends ProductQuantizationConfig {
  /** Number of OPQ optimization iterations */
  opqIterations: number;

  /** Whether to use GPU acceleration */
  useGPU: boolean;

  /** Batch size for training */
  batchSize: number;
}

// ============================================================================
// QUANTIZATION RESULT TYPES
// ============================================================================

/**
 * Result of training a Product Quantization model
 */
export interface PQTrainingResult {
  /** Trained codebook - shape: [numSubspaces, numCentroids, subspaceDim] */
  codebook: Float32Array[];

  /** Centroid indices for each training vector */
  codes: Uint8Array;

  /** Subspace dimension (dimension / numSubspaces) */
  subspaceDim: number;

  /** Training metrics */
  metrics: PQMetrics;

  /** Training time in milliseconds */
  trainingTime: number;

  /** Whether training converged */
  converged: boolean;

  /** Final iteration count */
  iterations: number;
}

/**
 * OPQ training result extends PQ with rotation matrix
 */
export interface OPQTrainingResult extends PQTrainingResult {
  /** Rotation matrix for OPQ - shape: [dimension, dimension] */
  rotationMatrix: Float32Array;

  /** OPQ-specific metrics */
  opqMetrics: OPQMetrics;
}

/**
 * Product Quantization metrics
 */
export interface PQMetrics {
  /** Quantization error (MSE) */
  quantizationError: number;

  /** Reconstruction error */
  reconstructionError: number;

  /** Signal-to-quantization-noise ratio */
  sqnr: number;

  /** Average distance to nearest centroid */
  avgDistanceToCentroid: number;

  /** Compression ratio */
  compressionRatio: number;

  /** Memory saved (bytes) */
  memorySaved: number;
}

/**
 * OPQ-specific metrics
 */
export interface OPQMetrics extends PQMetrics {
  /** Rotation quality improvement */
  rotationImprovement: number;

  /** Condition number of rotation matrix */
  rotationConditionNumber: number;

  /** Orthogonality error (should be near 0) */
  orthogonalityError: number;
}

// ============================================================================
// ENCODING/DECODING TYPES
// ============================================================================

/**
 * Encoded vector using Product Quantization
 *
 * Instead of storing full float vectors, we store:
 * - 8-bit codes (one per subspace)
 * - Shared codebook (centroids)
 */
export interface PQEncodedVector {
  /** Quantized codes - one byte per subspace */
  codes: Uint8Array;

  /** Original vector ID */
  id: string | number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch of encoded vectors
 */
export interface PQEncodedBatch {
  /** Packed codes - shape: [numVectors, numSubspaces] */
  codes: Uint8Array;

  /** Vector IDs */
  ids: Array<string | number>;

  /** Number of vectors */
  numVectors: number;
}

// ============================================================================
// DISTANCE CALCULATION TYPES
// ============================================================================

/**
 * Asymmetric distance calculator result
 *
 * In asymmetric distance calculation (ADC):
 * - Query vector: kept in original form (float)
 * - Database vectors: stored as compressed codes
 * - Distance: query to centroid (approximated)
 */
export interface ADCCResult {
  /** Distances to all database vectors */
  distances: Float32Array;

  /** Indices of nearest neighbors */
  indices: Uint32Array;

  /** Query time in milliseconds */
  queryTime: number;

  /** Number of distance calculations */
  distanceCalculations: number;
}

/**
 * Symmetric distance calculator result
 *
 * In symmetric distance calculation (SDC):
 * - Both query and database vectors are compressed
 * - Distance: centroid to centroid (faster but less accurate)
 */
export interface SDCResult {
  /** Distances to all database vectors */
  distances: Float32Array;

  /** Indices of nearest neighbors */
  indices: Uint32Array;

  /** Query time in milliseconds */
  queryTime: number;
}

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

/**
 * Nearest neighbor search result
 */
export interface NNResult {
  /** Nearest neighbor IDs */
  ids: Array<string | number>;

  /** Distances to query */
  distances: Float32Array;

  /** Query vector */
  query: Float32Array;

  /** Number of results returned */
  k: number;

  /** Search time in milliseconds */
  searchTime: number;

  /** Whether results are exact or approximate */
  exact: boolean;
}

/**
 * Approximate nearest neighbor result with recall metrics
 */
export interface ANNResult extends NNResult {
  /** Recall rate (if ground truth available) */
  recall?: number;

  /** Precision */
  precision?: number;

  /** Approximation error */
  approximationError?: number;
}

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

/**
 * PQ benchmark configuration
 */
export interface PQBenchmarkConfig {
  /** Number of vectors to index */
  numVectors: number;

  /** Number of queries */
  numQueries: number;

  /** Number of neighbors to retrieve */
  k: number;

  /** Vector dimensions to test */
  dimensions: number[];

  /** Number of subspaces to test */
  numSubspaces: number[];

  /** Number of centroids to test */
  numCentroids: number[];

  /** Whether to test OPQ */
  testOPQ: boolean;

  /** Whether to measure recall */
  measureRecall: boolean;
}

/**
 * PQ benchmark results
 */
export interface PQBenchmarkResults {
  /** Dataset information */
  dataset: {
    numVectors: number;
    numQueries: number;
    dimension: number;
    trainingSamples: number;
  };

  /** Compression metrics */
  compression: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    memorySaved: number;
  };

  /** Accuracy metrics */
  accuracy: {
    recall: number;
    precision: number;
    quantizationError: number;
    sqnr: number;
  };

  /** Performance metrics */
  performance: {
    trainingTime: number;
    encodingTime: number;
    queryTime: number;
    throughput: number;
  };

  /** Comparison to baseline (exact search) */
  baseline: {
    baselineTime: number;
    speedup: number;
    accuracyRetention: number;
  };

  /** OPQ vs PQ comparison (if applicable) */
  comparison?: {
    pqError: number;
    opqError: number;
    improvement: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error for quantization operations
 */
export class QuantizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "QuantizationError";
  }
}

/**
 * Training error
 */
export class TrainingError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "TRAINING_ERROR", details);
    this.name = "TrainingError";
  }
}

/**
 * Encoding error
 */
export class EncodingError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "ENCODING_ERROR", details);
    this.name = "EncodingError";
  }
}

/**
 * Decoding error
 */
export class DecodingError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "DECODING_ERROR", details);
    this.name = "DecodingError";
  }
}

/**
 * Invalid configuration error
 */
export class ConfigError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIG_ERROR", details);
    this.name = "ConfigError";
  }
}
