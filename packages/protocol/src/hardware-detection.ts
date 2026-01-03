/**
 * @fileoverview Hardware Detection and Routing Protocol
 *
 * This module defines types and interfaces for hardware-aware routing:
 * - GPU detection (CUDA, Metal, WebGPU)
 * - CPU profiling (cores, frequency, SIMD)
 * - Memory monitoring (total, available, fragmentation)
 * - NPU/TPU detection
 * - Thermal state tracking
 * - Hardware capability scoring
 * - Intelligent routing decisions
 *
 * @module @lsi/protocol/hardware-detection
 */

// ============================================================================
// HARDWARE DETECTION TYPES
// ============================================================================

/**
 * GPU type enum
 */
export enum GPUType {
  /** NVIDIA GPU with CUDA support */
  CUDA = "cuda",
  /** Apple Silicon GPU with Metal support */
  METAL = "metal",
  /** WebGPU (browser/Node.js with WebGPU) */
  WEBGPU = "webgpu",
  /** OpenCL-compatible GPU */
  OPENCL = "opencl",
  /** Vulkan-compatible GPU */
  VULKAN = "vulkan",
  /** Unknown or unsupported GPU */
  UNKNOWN = "unknown",
  /** No GPU available */
  NONE = "none",
}

/**
 * GPU information
 */
export interface GPUInfo {
  /** GPU type */
  type: GPUType;
  /** GPU device name (e.g., "NVIDIA GeForce RTX 4090") */
  name: string;
  /** VRAM in MB */
  vramMB: number;
  /** Available VRAM in MB */
  availableVRAMMB: number;
  /** Compute capability (CUDA) or Metal version */
  computeCapability?: string;
  /** Driver version */
  driverVersion?: string;
  /** CUDA toolkit version (if applicable) */
  cudaVersion?: string;
  /** Metal version (if applicable) */
  metalVersion?: string;
  /** Number of compute units */
  computeUnits?: number;
  /** Clock speed in MHz */
  clockSpeedMHz?: number;
  /** Supported features */
  features: string[];
  /** Whether GPU is available for compute */
  available: boolean;
}

/**
 * CPU information
 */
export interface CPUInfo {
  /** CPU architecture */
  architecture: "x64" | "arm64" | "x86" | "arm" | "unknown";
  /** Number of physical cores */
  physicalCores: number;
  /** Number of logical cores (threads) */
  logicalCores: number;
  /** Base clock speed in MHz */
  baseClockMHz: number;
  /** Maximum clock speed in MHz */
  maxClockMHz: number;
  /** CPU model name */
  model: string;
  /** Vendor */
  vendor: "Intel" | "AMD" | "Apple" | "ARM" | "Unknown";
  /** SIMD support */
  simd: {
    /** SSE support */
    sse: boolean;
    /** SSE2 support */
    sse2: boolean;
    /** SSE3 support */
    sse3: boolean;
    /** SSE4.1 support */
    sse4_1: boolean;
    /** SSE4.2 support */
    sse4_2: boolean;
    /** AVX support */
    avx: boolean;
    /** AVX2 support */
    avx2: boolean;
    /** AVX-512 support */
    avx512: boolean;
    /** NEON support (ARM) */
    neon: boolean;
  };
  /** Cache sizes */
  cache: {
    /** L1 cache per core (KB) */
    l1KB: number;
    /** L2 cache (KB) */
    l2KB: number;
    /** L3 cache (KB) */
    l3KB: number;
  };
  /** Current CPU usage (0-100) */
  currentUsage?: number;
}

/**
 * Memory information
 */
export interface MemoryInfo {
  /** Total system memory in MB */
  totalMB: number;
  /** Available memory in MB */
  availableMB: number;
  /** Used memory in MB */
  usedMB: number;
  /** Memory usage percentage (0-100) */
  usagePercent: number;
  /** Memory fragmentation percentage (0-100) */
  fragmentationPercent?: number;
  /** Swap total in MB */
  swapTotalMB?: number;
  /** Swap used in MB */
  swapUsedMB?: number;
  /** Memory type (DDR4, DDR5, LPDDR5, etc.) */
  memoryType?: string;
  /** Memory speed in MT/s */
  memorySpeedMTps?: number;
}

/**
 * NPU (Neural Processing Unit) information
 */
export interface NPUInfo {
  /** NPU available */
  available: boolean;
  /** NPU name */
  name?: string;
  /** Vendor (Apple, Intel, Qualcomm, etc.) */
  vendor?: string;
  /** TOPS (Trillions of Operations Per Second) */
  tops?: number;
  /** Supported precision (int8, fp16, etc.) */
  supportedPrecision: string[];
  /** NPU available for compute */
  computeAvailable: boolean;
}

/**
 * Thermal state
 */
export enum ThermalState {
  /** Normal operation (0-60°C) */
  NORMAL = "normal",
  /** Elevated temperature (60-75°C) */
  ELEVATED = "elevated",
  /** High temperature (75-85°C) */
  HIGH = "high",
  /** Critical temperature (85-95°C) */
  CRITICAL = "critical",
  /** Unknown state */
  UNKNOWN = "unknown",
}

/**
 * Thermal information
 */
export interface ThermalInfo {
  /** Current thermal state */
  state: ThermalState;
  /** CPU temperature in Celsius */
  cpuTempC?: number;
  /** GPU temperature in Celsius */
  gpuTempC?: number;
  /** Thermal throttling active */
  throttling: boolean;
  /** Temperature trend (rising, stable, falling) */
  trend?: "rising" | "stable" | "falling";
}

/**
 * Complete hardware profile
 */
export interface HardwareProfile {
  /** Timestamp of detection */
  timestamp: number;
  /** GPU information */
  gpu: GPUInfo;
  /** CPU information */
  cpu: CPUInfo;
  /** Memory information */
  memory: MemoryInfo;
  /** NPU information */
  npu: NPUInfo;
  /** Thermal information */
  thermal: ThermalInfo;
  /** Overall capability score (0-100) */
  capabilityScore: number;
  /** Hardware capabilities */
  capabilities: HardwareCapabilities;
}

/**
 * Hardware capabilities
 */
export interface HardwareCapabilities {
  /** GPU compute capability score (0-100) */
  gpuScore: number;
  /** CPU compute capability score (0-100) */
  cpuScore: number;
  /** Memory capability score (0-100) */
  memoryScore: number;
  /** NPU capability score (0-100) */
  npuScore: number;
  /** Supported operations */
  supportedOperations: {
    /** Can run ML inference */
    mlInference: boolean;
    /** Can run ML training */
    mlTraining: boolean;
    /** Can run vector operations */
    vectorOps: boolean;
    /** Can run matrix multiplication */
    matrixMul: boolean;
    /** Can run video encoding */
    videoEncode: boolean;
    /** Can run video decoding */
    videoDecode: boolean;
  };
}

// ============================================================================
// HARDWARE ROUTING TYPES
// ============================================================================

/**
 * Hardware target for routing
 */
export type HardwareTarget =
  | "gpu-cuda"
  | "gpu-metal"
  | "gpu-webgpu"
  | "npu"
  | "cpu"
  | "cpu-simd"
  | "cloud";

/**
 * Routing priority
 */
export enum RoutingPriority {
  /** Low priority (can be delayed) */
  LOW = 1,
  /** Normal priority (default) */
  NORMAL = 2,
  /** High priority (should be executed soon) */
  HIGH = 3,
  /** Critical priority (must execute immediately) */
  CRITICAL = 4,
}

/**
 * Operation type for routing decisions
 */
export enum OperationType {
  /** Simple query (CPU is fine) */
  SIMPLE_QUERY = "simple_query",
  /** Complex reasoning (better hardware helps) */
  COMPLEX_REASONING = "complex_reasoning",
  /** ML inference (GPU/NPU preferred) */
  ML_INFERENCE = "ml_inference",
  /** ML training (GPU required) */
  ML_TRAINING = "ml_training",
  /** Vector operations (SIMD/GPU preferred) */
  VECTOR_OPS = "vector_ops",
  /** Matrix operations (GPU preferred) */
  MATRIX_OPS = "matrix_ops",
  /** Video processing (GPU required) */
  VIDEO_PROCESSING = "video_processing",
  /** Embedding generation (GPU/NPU preferred) */
  EMBEDDING_GEN = "embedding_gen",
  /** Embedding search (CPU with SIMD is fine) */
  EMBEDDING_SEARCH = "embedding_search",
  /** General computation (CPU is fine) */
  GENERAL_COMPUTE = "general_compute",
}

/**
 * Hardware routing decision
 */
export interface HardwareRoutingDecision {
  /** Selected hardware target */
  target: HardwareTarget;
  /** Confidence in decision (0-1) */
  confidence: number;
  /** Reasoning for decision */
  reasoning: string[];
  /** Estimated execution time in ms */
  estimatedLatency: number;
  /** Estimated cost (0 for local, >0 for cloud) */
  estimatedCost: number;
  /** Fallback targets if primary fails */
  fallbackTargets: HardwareTarget[];
  /** Whether to use cloud if local hardware insufficient */
  useCloud: boolean;
}

/**
 * Hardware routing constraints
 */
export interface HardwareRoutingConstraints {
  /** Maximum latency tolerance in ms */
  maxLatency?: number;
  /** Maximum cost tolerance in USD */
  maxCost?: number;
  /** Require local processing (privacy) */
  requireLocal?: boolean;
  /** Prefer local for speed */
  preferLocal?: boolean;
  /** Minimum capability score */
  minCapabilityScore?: number;
  /** Thermal limit (don't route if thermal state is worse) */
  thermalLimit?: ThermalState;
  /** Memory requirement in MB */
  memoryRequirementMB?: number;
  /** VRAM requirement in MB */
  vramRequirementMB?: number;
}

/**
 * Hardware detection result
 */
export interface HardwareDetectionResult {
  /** Success flag */
  success: boolean;
  /** Hardware profile (if successful) */
  profile?: HardwareProfile;
  /** Error message (if failed) */
  error?: string;
  /** Detection duration in ms */
  detectionTime: number;
}

/**
 * Capability scoring result
 */
export interface CapabilityScoringResult {
  /** Overall capability score (0-100) */
  overallScore: number;
  /** Individual component scores */
  componentScores: {
    /** GPU compute score */
    gpu: number;
    /** CPU compute score */
    cpu: number;
    /** Memory score */
    memory: number;
    /** NPU score */
    npu: number;
  };
  /** Capability categories */
  categories: {
    /** Can run simple queries */
    simpleQuery: boolean;
    /** Can run complex reasoning */
    complexReasoning: boolean;
    /** Can run ML inference */
    mlInference: boolean;
    /** Can run ML training */
    mlTraining: boolean;
    /** Can run vector operations */
    vectorOps: boolean;
    /** Can run matrix operations */
    matrixOps: boolean;
    /** Can run video processing */
    videoProcessing: boolean;
  };
}

// ============================================================================
// HARDWARE DETECTOR INTERFACE
// ============================================================================

/**
 * Hardware detector configuration
 */
export interface HardwareDetectorConfig {
  /** Enable/disable GPU detection */
  detectGPU?: boolean;
  /** Enable/disable CPU profiling */
  profileCPU?: boolean;
  /** Enable/disable memory monitoring */
  monitorMemory?: boolean;
  /** Enable/disable NPU detection */
  detectNPU?: boolean;
  /** Enable/disable thermal monitoring */
  monitorThermal?: boolean;
  /** Detection cache TTL in ms */
  cacheTTL?: number;
  /** Custom detection timeout in ms */
  detectionTimeout?: number;
  /** Path to nvidia-smi (for CUDA detection) */
  nvidiaSmiPath?: string;
  /** Path to system_profiler (for macOS Metal detection) */
  systemProfilerPath?: string;
}

/**
 * Hardware detector interface
 */
export interface IHardwareDetector {
  /**
   * Detect all hardware
   */
  detect(): Promise<HardwareDetectionResult>;

  /**
   * Get cached hardware profile
   */
  getProfile(): HardwareProfile | null;

  /**
   * Check if GPU is available
   */
  hasGPU(): boolean;

  /**
   * Check if NPU is available
   */
  hasNPU(): boolean;

  /**
   * Get thermal state
   */
  getThermalState(): ThermalState;

  /**
   * Clear hardware detection cache
   */
  clearCache(): void;
}

// ============================================================================
// CAPABILITY PROFILER INTERFACE
// ============================================================================

/**
 * Capability profiler configuration
 */
export interface CapabilityProfilerConfig {
  /** Weight for GPU score in overall capability */
  gpuWeight?: number;
  /** Weight for CPU score in overall capability */
  cpuWeight?: number;
  /** Weight for memory score in overall capability */
  memoryWeight?: number;
  /** Weight for NPU score in overall capability */
  npuWeight?: number;
  /** Thermal throttling threshold (reduce score if above this) */
  thermalThreshold?: ThermalState;
  /** Memory pressure threshold */
  memoryPressureThreshold?: number;
}

/**
 * Capability profiler interface
 */
export interface ICapabilityProfiler {
  /**
   * Profile hardware capabilities
   */
  profile(profile: HardwareProfile): CapabilityScoringResult;

  /**
   * Score operation suitability for hardware
   */
  scoreOperation(
    operation: OperationType,
    hardwareProfile: HardwareProfile
  ): number;

  /**
   * Get recommended hardware for operation
   */
  getRecommendedHardware(
    operation: OperationType,
    hardwareProfile: HardwareProfile
  ): HardwareTarget[];
}

// ============================================================================
// HARDWARE ROUTER INTERFACE
// ============================================================================

/**
 * Hardware router configuration
 */
export interface HardwareRouterConfig {
  /** Default fallback to cloud if local insufficient */
  defaultToCloud?: boolean;
  /** Cloud provider (for fallback) */
  cloudProvider?: string;
  /** Maximum number of fallback attempts */
  maxFallbackAttempts?: number;
  /** Routing strategy */
  routingStrategy?: "capability-first" | "cost-first" | "latency-first" | "balanced";
}

/**
 * Hardware router interface
 */
export interface IHardwareRouter {
  /**
   * Route operation to optimal hardware
   */
  route(
    operation: OperationType,
    constraints?: HardwareRoutingConstraints
  ): Promise<HardwareRoutingDecision>;

  /**
   * Route with explicit priority
   */
  routeWithPriority(
    operation: OperationType,
    priority: RoutingPriority,
    constraints?: HardwareRoutingConstraints
  ): Promise<HardwareRoutingDecision>;

  /**
   * Get current routing statistics
   */
  getStatistics(): {
    totalRoutes: number;
    routesByTarget: Record<HardwareTarget, number>;
    routesByOperation: Record<OperationType, number>;
    averageLatency: number;
    cloudFallbackRate: number;
  };

  /**
   * Clear routing statistics
   */
  clearStatistics(): void;
}

// ============================================================================
// HARDWARE EVENT TYPES
// ============================================================================

/**
 * Hardware event types
 */
export enum HardwareEventType {
  /** Hardware detected */
  HARDWARE_DETECTED = "hardware_detected",
  /** Hardware capability changed */
  CAPABILITY_CHANGED = "capability_changed",
  /** Thermal state changed */
  THERMAL_CHANGED = "thermal_changed",
  /** Memory pressure changed */
  MEMORY_PRESSURE_CHANGED = "memory_pressure_changed",
  /** GPU became available */
  GPU_AVAILABLE = "gpu_available",
  /** GPU became unavailable */
  GPU_UNAVAILABLE = "gpu_unavailable",
  /** Routing decision made */
  ROUTING_DECISION = "routing_decision",
  /** Fallback to cloud triggered */
  CLOUD_FALLBACK = "cloud_fallback",
}

/**
 * Hardware event
 */
export interface HardwareEvent {
  /** Event type */
  type: HardwareEventType;
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data: unknown;
}

/**
 * Hardware event listener
 */
export type HardwareEventListener = (event: HardwareEvent) => void;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if hardware target is local
 */
export function isLocalTarget(target: HardwareTarget): boolean {
  return target !== "cloud";
}

/**
 * Check if hardware target uses GPU
 */
export function isGPUTarget(target: HardwareTarget): boolean {
  return target.startsWith("gpu-");
}

/**
 * Check if hardware target is accelerator
 */
export function isAcceleratorTarget(target: HardwareTarget): boolean {
  return isGPUTarget(target) || target === "npu";
}

/**
 * Get default hardware routing decision
 */
export function getDefaultRoutingDecision(): HardwareRoutingDecision {
  return {
    target: "cpu",
    confidence: 0.5,
    reasoning: ["Defaulting to CPU"],
    estimatedLatency: 100,
    estimatedCost: 0,
    fallbackTargets: ["cloud"],
    useCloud: false,
  };
}

/**
 * Validate hardware routing constraints
 */
export function validateConstraints(
  constraints: HardwareRoutingConstraints
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (constraints.maxLatency !== undefined && constraints.maxLatency < 0) {
    errors.push("maxLatency must be non-negative");
  }

  if (constraints.maxCost !== undefined && constraints.maxCost < 0) {
    errors.push("maxCost must be non-negative");
  }

  if (
    constraints.minCapabilityScore !== undefined &&
    (constraints.minCapabilityScore < 0 || constraints.minCapabilityScore > 100)
  ) {
    errors.push("minCapabilityScore must be between 0 and 100");
  }

  if (
    constraints.memoryRequirementMB !== undefined &&
    constraints.memoryRequirementMB < 0
  ) {
    errors.push("memoryRequirementMB must be non-negative");
  }

  if (
    constraints.vramRequirementMB !== undefined &&
    constraints.vramRequirementMB < 0
  ) {
    errors.push("vramRequirementMB must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
