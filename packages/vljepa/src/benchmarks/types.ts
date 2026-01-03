/**
 * VL-JEPA Benchmark Types
 *
 * Comprehensive benchmarking framework for VL-JEPA (Vision-Language Joint Embedding Predictive Architecture)
 * based on Meta AI's research: https://arxiv.org/abs/2512.10942
 *
 * Key Claims to Validate:
 * - 2.85x faster decoding than traditional VLMs
 * - 50% fewer parameters (1.6B vs 3B+)
 * - Real-time inference on edge devices (<100ms)
 * - Sub-50ms encoding on WebGPU
 */

/**
 * VL-JEPA Benchmark Result
 * Complete performance metrics for a VL-JEPA benchmark run
 */
export interface VLJEPABenchmarkResult {
  // Test identification
  testName: string;
  timestamp: number;
  configuration: BenchmarkConfiguration;

  // Latency metrics (milliseconds)
  encodingLatency: {
    xEncoder: number; // Vision → Embedding (UI frame → 768-dim vector)
    yEncoder: number; // Language → Embedding (user intent → 768-dim vector)
    predictor: number; // Embedding prediction (X → Y prediction)
    total: number; // End-to-end latency
  };

  // Memory metrics (megabytes)
  memoryUsage: {
    peak: number; // Peak memory during inference
    modelSize: number; // Model size in RAM
    embeddingSize: number; // 768 * 4 bytes (float32) = 3KB per embedding
    workingSet: number; // GPU working set size
  };

  // Accuracy/quality metrics
  accuracy: {
    embeddingQuality: number; // Cosine similarity with ground truth (0-1)
    taskSuccess: number; // UI task completion rate (0-1)
    semanticPreservation: number; // Semantic similarity (0-1)
    predictionConfidence: number; // Model confidence score (0-1)
  };

  // Comparison vs traditional VLMs
  comparison: {
    speedup: number; // Speedup factor vs baseline (claim: 2.85x)
    parameterReduction: number; // Parameter reduction % (claim: 50%)
    qualityRetention: number; // Quality retention % (should be >90%)
    costEfficiency: number; // Cost per 1K queries
  };

  // Deployment comparison
  deployment: {
    webgpu: {
      latency: number;
      memory: number;
      fps: number; // Frames per second for real-time
    };
    cpu: {
      latency: number;
      memory: number;
      fps: number;
    };
    cloud: {
      latency: number;
      memory: number;
      cost: number; // Cost per 1K queries
    };
  };
}

/**
 * Benchmark Configuration
 */
export interface BenchmarkConfiguration {
  // Model configuration
  model: {
    embeddingDim: number; // Default: 768
    xEncoderLayers: number; // Vision encoder depth
    yEncoderLayers: number; // Language encoder depth
    predictorLayers: number; // Predictor depth
    parameters: number; // Total parameter count
  };

  // Hardware configuration
  hardware: {
    device: "webgpu" | "cpu" | "cloud";
    gpu?: {
      vendor: string;
      model: string;
      memory: number; // GPU memory in MB
      computeUnits: number;
    };
    cpu?: {
      cores: number;
      frequency: number; // GHz
      threads: number;
    };
  };

  // Input configuration
  input: {
    imageResolution: [number, number]; // [width, height]
    textLength: number; // Average text length
    batchSize: number; // Batch size for inference
  };

  // Optimization flags
  optimizations: {
    useCaching: boolean;
    useQuantization: boolean;
    useTensorRT: boolean; // GPU optimization
    useONNX: boolean; // ONNX runtime
  };
}

/**
 * UI Frame Understanding Benchmark
 * Tests VL-JEPA's ability to understand UI screenshots
 */
export interface UIFrameBenchmark {
  frame: {
    width: number;
    height: number;
    elements: number; // Number of UI elements
  };
  task: "classify" | "localize" | "caption" | "edit";
  groundTruthEmbedding: Float32Array;
  predictedEmbedding: Float32Array;
  latency: number;
  memoryUsed: number;
}

/**
 * User Intent Encoding Benchmark
 * Tests language encoder for user commands
 */
export interface UserIntentBenchmark {
  intent: string;
  category: "style" | "layout" | "content" | "interaction";
  groundTruthEmbedding: Float32Array;
  predictedEmbedding: Float32Array;
  latency: number;
  semanticSimilarity: number;
}

/**
 * Goal Prediction Benchmark
 * Tests predictor: current UI + user intent → goal state
 */
export interface GoalPredictionBenchmark {
  currentUI: Float32Array; // Current UI embedding
  userIntent: Float32Array; // User intent embedding
  goalState: Float32Array; // Predicted goal state
  groundTruthGoal: Float32Array; // Actual desired state
  predictionError: number; // Cosine distance
  confidence: number;
  latency: number;
}

/**
 * Real-time Interaction Benchmark
 * Tests continuous inference at 30fps
 */
export interface RealtimeBenchmark {
  duration: number; // Test duration in seconds
  targetFPS: number; // Target frames per second (30)
  frameTimes: number[]; // Per-frame latency in ms
  droppedFrames: number; // Frames that missed deadline
  avgLatency: number;
  p95Latency: number; // 95th percentile
  p99Latency: number; // 99th percentile
  memoryGrowth: number; // Memory leak detection
}

/**
 * WebGPU Performance Metrics
 * Detailed GPU performance analysis
 */
export interface WebGPUMetrics {
  // Shader compilation
  shaderCompilationTime: number;

  // Memory transfer (CPU ↔ GPU)
  uploadTime: number; // CPU → GPU upload
  downloadTime: number; // GPU → CPU download
  transferOverhead: number; // Transfer overhead as % of total

  // Compute operations
  computeTime: number; // Actual computation time
  flops: number; // Floating point operations per second

  // Memory utilization
  gpuMemoryUsed: number;
  gpuMemoryTotal: number;
  memoryFragmentation: number;

  // Cache effectiveness
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;

  // Tensor operations
  matmulTime: number; // Matrix multiplication time
  attentionTime: number; // Attention computation time
  activationTime: number; // Activation function time
}

/**
 * Caching Strategy Metrics
 */
export interface CachingMetrics {
  strategy: "lru" | "lfu" | "fifo" | "smart";
  cacheSize: number; // Number of cached embeddings
  cacheMemoryMB: number; // Memory used by cache

  // Effectiveness
  hits: number;
  misses: number;
  hitRate: number; // Target: >80%

  // Invalidation
  invalidations: number;
  invalidationReason: {
    uiChange: number;
    ttlExpiry: number;
    manual: number;
  };

  // Performance impact
  avgHitLatency: number; // Latency when cache hit
  avgMissLatency: number; // Latency when cache miss
  latencySaved: number; // Total latency saved by caching
}

/**
 * Comparison Benchmark vs Traditional VLMs
 */
export interface VLMComparisonResult {
  model: string; // Model name (e.g., "GPT-4V", "Claude 3.5")
  latency: number;
  cost: number; // Cost per 1K queries
  quality: number; // Quality score (0-1)

  // Specific advantages
  advantages: string[];
  disadvantages: string[];

  // Use case fit
  bestFor: string[];
  worstFor: string[];
}

/**
 * Benchmark Suite Results
 * Aggregated results from all benchmarks
 */
export interface BenchmarkSuiteResults {
  summary: {
    totalBenchmarks: number;
    passedBenchmarks: number;
    failedBenchmarks: number;
    totalTime: number;
  };

  // Individual benchmark results
  uiFrame: UIFrameBenchmark[];
  userIntent: UserIntentBenchmark[];
  goalPrediction: GoalPredictionBenchmark[];
  realtime: RealtimeBenchmark;

  // Performance summaries
  webgpu: WebGPUMetrics;
  caching: CachingMetrics;
  comparisons: VLMComparisonResult[];

  // Meta's claims validation
  claimsValidation: {
    speedup2_85x: boolean; // Is 2.85x speedup achieved?
    paramReduction50: boolean; // Is 50% param reduction achieved?
    realtimeEdge: boolean; // Is <100ms achieved?
    qualityRetention: boolean; // Is >90% quality retained?
  };
}

/**
 * Performance Report
 * Final formatted report for stakeholders
 */
export interface PerformanceReport {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];

  metrics: BenchmarkSuiteResults;
  charts: {
    latencyChart: string; // URL or data
    memoryChart: string;
    accuracyChart: string;
    comparisonChart: string;
  };

  conclusion: string;
  nextSteps: string[];
}
