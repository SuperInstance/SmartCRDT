/**
 * @lsi/vljepa-quantization - Types
 *
 * Type definitions for INT8 quantization of VL-JEPA models.
 * Target: 2x speedup, 4x size reduction, <2% accuracy drop.
 *
 * @module types
 */

// ============================================================================
// QUANTIZATION CONFIGURATION
// ============================================================================

/**
 * INT8 quantizer configuration
 */
export interface INT8QuantizerConfig {
  /** Quantization mode */
  mode: "symmetric" | "asymmetric";

  /** Calibration method */
  calibration: "min_max" | "kld" | "percentile";

  /** Quantization granularity */
  granularity: "per_tensor" | "per_channel";

  /** Whether to fuse layers for speed */
  fuseLayers: boolean;

  /** Target device */
  target: "cpu" | "gpu" | "webgpu";

  /** Preserve accuracy (slower quantization) */
  preserveAccuracy: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Model information before/after quantization
 */
export interface ModelInfo {
  /** Model name/identifier */
  name: string;

  /** Model version */
  version: string;

  /** Number of parameters */
  parameters: number;

  /** Model size in bytes */
  sizeBytes: number;

  /** Precision format */
  precision: "fp32" | "fp16" | "int8" | "mixed";

  /** Layer information */
  layers: LayerInfo[];

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual layer information
 */
export interface LayerInfo {
  /** Layer name */
  name: string;

  /** Layer type */
  type: string;

  /** Input shape */
  inputShape: number[];

  /** Output shape */
  outputShape: number[];

  /** Number of parameters */
  parameters: number;

  /** Layer size in bytes */
  sizeBytes: number;

  /** Whether layer is quantized */
  quantized: boolean;
}

// ============================================================================
// QUANTIZATION RESULT
// ============================================================================

/**
 * Result of quantization process
 */
export interface QuantizationResult {
  /** Original model information */
  originalModel: ModelInfo;

  /** Quantized model information */
  quantizedModel: ModelInfo;

  /** Quantization scales (per tensor or per channel) */
  scale: Float32Array;

  /** Zero points (for asymmetric quantization) */
  zeroPoint: Int8Array;

  /** Quantization metrics */
  metrics: QuantizationMetrics;

  /** Quantization time in milliseconds */
  quantizationTime: number;

  /** Warnings generated during quantization */
  warnings: string[];

  /** Whether quantization was successful */
  success: boolean;
}

/**
 * Quantization performance metrics
 */
export interface QuantizationMetrics {
  /** Size reduction ratio (target: 4x) */
  sizeReduction: number;

  /** Accuracy drop percentage (target: <2%) */
  accuracyDrop: number;

  /** Speedup ratio (target: 2x) */
  speedup: number;

  /** Calibration error (lower is better) */
  calibrationError: number;

  /** Mean squared error of quantized weights */
  mse: number;

  /** Signal-to-quantization-noise ratio */
  sqnr: number;

  /** Percentage of layers successfully quantized */
  layersQuantized: number;

  /** Memory saved in bytes */
  memorySaved: number;
}

// ============================================================================
// CALIBRATION TYPES
// ============================================================================

/**
 * Calibration configuration
 */
export interface CalibrationConfig {
  /** Number of samples for calibration */
  samples: number;

  /** Batch size for calibration */
  batchSize: number;

  /** Calibration method */
  method: "min_max" | "kld" | "percentile";

  /** Percentile for percentile method (default: 99.9) */
  percentile?: number;

  /** Number of bins for histogram (KLD) */
  histogramBins?: number;

  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Calibration result
 */
export interface CalibrationResult {
  /** Computed scales */
  scale: Float32Array;

  /** Computed zero points */
  zeroPoint: Int8Array;

  /** Calibration metrics */
  metrics: CalibrationMetrics;

  /** Calibration time in milliseconds */
  calibrationTime: number;
}

/**
 * Calibration metrics
 */
export interface CalibrationMetrics {
  /** Minimum activation value */
  minVal: number;

  /** Maximum activation value */
  maxVal: number;

  /** Mean activation value */
  mean: number;

  /** Standard deviation */
  stdDev: number;

  /** KL divergence score (for KLD method) */
  kldScore?: number;

  /** Percentile values */
  percentiles?: Record<number, number>;
}

// ============================================================================
// LAYER FUSION TYPES
// ============================================================================

/**
 * Fusion configuration
 */
export interface FusionConfig {
  /** Fusion patterns to apply */
  patterns: FusionPattern[];

  /** Whether to preserve accuracy */
  preserveAccuracy: boolean;

  /** Benchmark before fusion */
  benchmarkBefore: boolean;

  /** Maximum number of operations to fuse */
  maxFusionDepth: number;
}

/**
 * Fusion pattern definition
 */
export interface FusionPattern {
  /** Pattern type */
  type: "conv_bn_relu" | "linear_relu" | "matmul_add" | "concat" | "custom";

  /** Layer types to fuse (in order) */
  layers: string[];

  /** Name of fused layer */
  fusedLayer: string;

  /** Custom fusion function (for custom patterns) */
  customFunction?: string;
}

/**
 * Fusion result
 */
export interface FusionResult {
  /** Fusion patterns applied */
  appliedPatterns: FusionPattern[];

  /** Number of layers fused */
  layersFused: number;

  /** Expected speedup */
  speedup: number;

  /** Fusion time in milliseconds */
  fusionTime: number;

  /** Whether fusion was successful */
  success: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Dataset to use for validation */
  dataset: string;

  /** Metrics to validate */
  metrics: ("cosine" | "top1" | "top5" | "preference" | "mse")[];

  /** Maximum acceptable accuracy drop */
  tolerance: number;

  /** Number of samples to validate */
  samples: number;

  /** Batch size for validation */
  batchSize: number;

  /** Whether to generate detailed report */
  detailed: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;

  /** FP32 model metrics */
  fp32Metrics: ModelMetrics;

  /** INT8 model metrics */
  int8Metrics: ModelMetrics;

  /** Metric differences */
  differences: MetricDifference[];

  /** Recommendations */
  recommendations: string[];

  /** Validation time in milliseconds */
  validationTime: number;
}

/**
 * Model metrics for validation
 */
export interface ModelMetrics {
  /** Cosine similarity (for embeddings) */
  cosineSimilarity?: number;

  /** Top-1 accuracy */
  top1Accuracy?: number;

  /** Top-5 accuracy */
  top5Accuracy?: number;

  /** Preference accuracy (for ORPO) */
  preferenceAccuracy?: number;

  /** Mean squared error */
  mse?: number;

  /** Inference time per sample */
  inferenceTime?: number;

  /** Memory usage */
  memoryUsage?: number;
}

/**
 * Metric difference between FP32 and INT8
 */
export interface MetricDifference {
  /** Metric name */
  metric: string;

  /** FP32 value */
  fp32Value: number;

  /** INT8 value */
  int8Value: number;

  /** Absolute difference */
  absoluteDiff: number;

  /** Percentage difference */
  percentageDiff: number;

  /** Whether difference is within tolerance */
  withinTolerance: boolean;
}

// ============================================================================
// WEBGPU OPTIMIZATION TYPES
// ============================================================================

/**
 * WebGPU optimization configuration
 */
export interface WebGPUConfig {
  /** Whether to optimize shaders */
  shaderOptimization: boolean;

  /** Memory packing strategy */
  memoryPacking: "packed" | "plain" | "tiled";

  /** Batch size for WebGPU */
  batchSize: number;

  /** Workgroup size [x, y, z] */
  workgroupSize: [number, number, number];

  /** Whether to use shared memory */
  useSharedMemory: boolean;

  /** Shared memory size in bytes */
  sharedMemorySize?: number;

  /** Whether to use subgroup operations */
  useSubgroups: boolean;
}

/**
 * WebGPU optimization result
 */
export interface WebGPUResult {
  /** Generated WGSL shader code */
  shader: string;

  /** Memory layout information */
  memoryLayout: MemoryLayout;

  /** Benchmark results */
  benchmark: GPUBenchmark;

  /** Compilation time in milliseconds */
  compilationTime: number;

  /** Whether compilation was successful */
  success: boolean;
}

/**
 * Memory layout for GPU
 */
export interface MemoryLayout {
  /** Buffer size in bytes */
  bufferSize: number;

  /** Memory alignment */
  alignment: number;

  /** Stride between elements */
  stride: number;

  /** Memory layout description */
  description: string;
}

/**
 * GPU benchmark results
 */
export interface GPUBenchmark {
  /** Average inference time in milliseconds */
  avgInferenceTime: number;

  /** Minimum inference time */
  minInferenceTime: number;

  /** Maximum inference time */
  maxInferenceTime: number;

  /** Throughput (samples per second) */
  throughput: number;

  /** GPU memory usage in bytes */
  memoryUsage: number;

  /** GPU utilization percentage */
  utilization: number;

  /** Number of benchmark iterations */
  iterations: number;
}

// ============================================================================
// EDGE PACKAGE TYPES
// ============================================================================

/**
 * Edge package configuration
 */
export interface EdgePackageConfig {
  /** Package format */
  format: "webllm" | "onnx" | "custom";

  /** Compression method */
  compression: "gzip" | "brotli" | "none";

  /** Whether to include runtime */
  includeRuntime: boolean;

  /** Target platform */
  target: "browser" | "node" | "both";

  /** Optimization level */
  optimization: "size" | "speed" | "balanced";

  /** Whether to include shaders */
  includeShaders: boolean;

  /** Package version */
  version: string;
}

/**
 * Edge deployment package
 */
export interface EdgePackage {
  /** Package version */
  version: string;

  /** Model weights (INT8 quantized) */
  model: {
    weights: Uint8Array;
    config: ModelConfig;
  };

  /** WebGPU shaders (if applicable) */
  shaders?: Record<string, string>;

  /** Minimal inference runtime (if included) */
  runtime?: string;

  /** Package metadata */
  metadata: PackageMetadata;
}

/**
 * Model configuration for edge deployment
 */
export interface ModelConfig {
  /** Model name */
  name: string;

  /** Model architecture */
  architecture: string;

  /** Input shape */
  inputShape: number[];

  /** Output shape */
  outputShape: number[];

  /** Quantization information */
  quantization: {
    mode: "symmetric" | "asymmetric";
    scale: Float32Array;
    zeroPoint: Int8Array;
  };

  /** Layer information */
  layers: LayerConfig[];
}

/**
 * Individual layer configuration
 */
export interface LayerConfig {
  /** Layer name */
  name: string;

  /** Layer type */
  type: string;

  /** Layer-specific configuration */
  config: Record<string, unknown>;

  /** Whether layer is fused */
  fused?: boolean;

  /** Fused with which layers */
  fusedWith?: string[];
}

/**
 * Package metadata
 */
export interface PackageMetadata {
  /** Package creation timestamp */
  created: number;

  /** Package size in bytes (before compression) */
  size: number;

  /** Compressed size in bytes */
  compressedSize?: number;

  /** Compression ratio */
  compressionRatio?: number;

  /** Target platforms */
  platforms: string[];

  /** Required features */
  requirements: string[];

  /** Performance estimates */
  performance: {
    estimatedInferenceTime: number;
    estimatedMemoryUsage: number;
    expectedSpeedup: number;
  };

  /** Package checksums */
  checksums: {
    sha256: string;
    md5?: string;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Quantization error base class
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
 * Calibration error
 */
export class CalibrationError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "CALIBRATION_ERROR", details);
    this.name = "CalibrationError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/**
 * Conversion error
 */
export class ConversionError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "CONVERSION_ERROR", details);
    this.name = "ConversionError";
  }
}

/**
 * WebGPU compilation error
 */
export class WebGPUError extends QuantizationError {
  constructor(message: string, details?: unknown) {
    super(message, "WEBGPU_ERROR", details);
    this.name = "WebGPUError";
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Quantization statistics
 */
export interface QuantizationStats {
  /** Number of layers quantized */
  layersQuantized: number;

  /** Total number of layers */
  totalLayers: number;

  /** Number of parameters quantized */
  parametersQuantized: number;

  /** Total parameters */
  totalParameters: number;

  /** Quantization progress (0-1) */
  progress: number;

  /** Current layer being quantized */
  currentLayer?: string;

  /** Estimated time remaining (milliseconds) */
  estimatedTimeRemaining?: number;
}

/**
 * Progress callback for quantization
 */
export type QuantizationProgressCallback = (stats: QuantizationStats) => void;

/**
 * Comparison result between two models
 */
export interface ModelComparison {
  /** Model A information */
  modelA: ModelInfo;

  /** Model B information */
  modelB: ModelInfo;

  /** Size comparison */
  sizeComparison: {
    modelA: number;
    modelB: number;
    ratio: number;
    winner: "modelA" | "modelB" | "tie";
  };

  /** Speed comparison */
  speedComparison?: {
    modelA: number;
    modelB: number;
    ratio: number;
    winner: "modelA" | "modelB" | "tie";
  };

  /** Accuracy comparison */
  accuracyComparison?: {
    modelA: number;
    modelB: number;
    difference: number;
    winner: "modelA" | "modelB" | "tie";
  };
}
