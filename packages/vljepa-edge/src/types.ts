/**
 * @fileoverview Core types for VL-JEPA Edge Deployment
 * @package @lsi/vljepa-edge
 */

// Extend Web API types for browser-specific features
declare global {
  interface Navigator {
    gpu?: any;
  }

  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      usedJSHeapSize: number;
      totalJSHeapSize: number;
    };
  }
}

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

/**
 * Browser runtime configuration for on-device VL-JEPA inference
 */
export interface BrowserRuntimeConfig {
  /** Model path or URL for loading weights */
  modelPath: string;

  /** Whether to use WebGPU acceleration */
  useWebGPU: boolean;

  /** Whether to use Web Workers for parallel processing */
  useWebWorkers: boolean;

  /** Cache strategy for model storage */
  cacheStrategy: "memory" | "indexeddb" | "service_worker" | "hybrid";

  /** Memory limit in MB */
  memoryLimit: number;

  /** Maximum batch size for inference */
  maxBatchSize: number;

  /** Whether to preload models on initialization */
  preloadModels: boolean;

  /** Logging configuration */
  logging?: {
    enabled: boolean;
    level?: "debug" | "info" | "warn" | "error";
  };
}

/**
 * WebGPU runtime configuration
 */
export interface WebGPURuntimeConfig {
  /** GPU device preference */
  devicePreference: "discrete" | "integrated" | "any";

  /** Whether to cache shader pipelines */
  shaderCache: boolean;

  /** Buffer manager configuration */
  bufferManager: BufferManagerConfig;

  /** Workgroup size for compute shaders [x, y, z] */
  workgroupSize: [number, number, number];

  /** Maximum buffer size in MB */
  maxBufferSize: number;

  /** Whether to use async compilation */
  asyncCompilation: boolean;
}

/**
 * Buffer manager configuration for WebGPU
 */
export interface BufferManagerConfig {
  /** Initial buffer pool size in MB */
  initialPoolSize: number;

  /** Maximum buffer pool size in MB */
  maxPoolSize: number;

  /** Buffer alignment in bytes */
  alignment: number;

  /** Whether to reuse buffers */
  reuse: boolean;

  /** Whether to map buffers asynchronously */
  asyncMap: boolean;
}

/**
 * WebAssembly runtime configuration
 */
export interface WASMRuntimeConfig {
  /** Memory page size (64KB per page) */
  memoryPageSize: number;

  /** Maximum memory pages */
  maxMemoryPages: number;

  /** Whether to use SIMD instructions */
  useSIMD: boolean;

  /** Whether to use multi-threading */
  useMultiThreading: number;

  /** Whether to enable bulk memory operations */
  useBulkMemory: boolean;

  /** Whether to use saturated float to integer */
  useSaturatedFloatToInt: boolean;
}

/**
 * Hybrid runtime configuration (WebGPU + WASM fallback)
 */
export interface HybridRuntimeConfig {
  /** WebGPU configuration */
  webgpu: WebGPURuntimeConfig;

  /** WASM configuration */
  wasm: WASMRuntimeConfig;

  /** Fallback threshold (switch to WASM if below this score) */
  fallbackThreshold: number;

  /** Auto-fallback enabled */
  autoFallback: boolean;

  /** Fallback cooldown in milliseconds */
  fallbackCooldown: number;
}

// ============================================================================
// DEVICE CAPABILITIES
// ============================================================================

/**
 * Device capabilities detected by capability detector
 */
export interface DeviceCapabilities {
  /** WebGPU support */
  webGPU: boolean;

  /** WebAssembly support */
  webAssembly: boolean;

  /** Web Worker support */
  workers: boolean;

  /** Service Worker support */
  serviceWorkers: boolean;

  /** IndexedDB support */
  indexedDB: boolean;

  /** GPU information (if available) */
  gpu?: GPUInfo;

  /** Available memory in MB */
  memory: number;

  /** Number of CPU cores */
  cores: number;

  /** Device profile based on capabilities */
  profile: DeviceProfile;

  /** User agent string */
  userAgent: string;

  /** Platform */
  platform: string;

  /** Hardware concurrency */
  hardwareConcurrency: number;
}

/**
 * GPU information
 */
export interface GPUInfo {
  /** GPU vendor */
  vendor: string;

  /** GPU renderer/model */
  renderer: string;

  /** WebGPU adapter info (if available) */
  adapter?: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
  };

  /** Estimated VRAM in MB */
  vram?: number;

  /** Supported features */
  features?: string[];

  /** Limits */
  limits?: any;
}

/**
 * Device profile for capability-based optimization
 */
export interface DeviceProfile {
  /** Profile name */
  name: string;

  /** Performance tier */
  tier: "high" | "medium" | "low";

  /** Recommended runtime */
  recommendedRuntime: "webgpu" | "wasm" | "hybrid";

  /** Recommended batch size */
  batchSize: number;

  /** Recommended quantization */
  quantization: "int8" | "fp16" | "fp32";

  /** Recommended model size */
  modelSize: "small" | "medium" | "large";

  /** Estimated performance score (0-100) */
  performanceScore: number;
}

// ============================================================================
// MODEL MANAGEMENT
// ============================================================================

/**
 * Model manager configuration
 */
export interface ModelManagerConfig {
  /** Maximum number of models to keep loaded */
  maxModels: number;

  /** Cache size in MB */
  cacheSize: number;

  /** Models to preload on initialization */
  preload: string[];

  /** Update strategy */
  updateStrategy: "auto" | "manual" | "never";

  /** Version check interval in milliseconds */
  versionCheckInterval: number;

  /** Whether to verify model integrity */
  verifyIntegrity: boolean;

  /** Maximum concurrent downloads */
  maxConcurrentDownloads: number;
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Unique model identifier */
  id: string;

  /** Model version */
  version: string;

  /** Model size in MB */
  size: number;

  /** Quantization type */
  quantization: "int8" | "fp16" | "fp32";

  /** Whether model is currently loaded */
  loaded: boolean;

  /** Whether model is cached */
  cached: boolean;

  /** Model URL/path */
  url: string;

  /** Checksum for integrity verification */
  checksum?: string;

  /** Compatible runtimes */
  compatibleRuntimes: ("webgpu" | "wasm")[];

  /** Metadata */
  metadata?: {
    description?: string;
    author?: string;
    created?: number;
    tags?: string[];
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Cache manager configuration
 */
export interface CacheManagerConfig {
  /** IndexedDB configuration */
  indexedDB: {
    enabled: boolean;
    dbName: string;
    storeName: string;
    version: number;
  };

  /** Service Worker configuration */
  serviceWorker: {
    enabled: boolean;
    scriptPath: string;
    scope: string;
  };

  /** Memory cache configuration */
  memoryCache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };

  /** Maximum total cache size in MB */
  maxCacheSize: number;

  /** Whether to enable versioning */
  versioning: boolean;

  /** Cache compression */
  compression: boolean;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  /** Entry key */
  key: string;

  /** Model version */
  version: string;

  /** Cached data */
  data: ArrayBuffer;

  /** Entry size in bytes */
  size: number;

  /** Timestamp when cached */
  timestamp: number;

  /** Time to live in milliseconds */
  ttl: number;

  /** Compression type */
  compression?: "gzip" | "brotli" | "none";

  /** Checksum */
  checksum?: string;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Performance monitor configuration
 */
export interface PerformanceMonitorConfig {
  /** Metrics collection interval in milliseconds */
  collectionInterval: number;

  /** Number of samples to keep for percentile calculation */
  sampleSize: number;

  /** Whether to enable automatic profiling */
  autoProfiling: boolean;

  /** Alert thresholds */
  alerts: {
    /** Latency threshold in milliseconds */
    latencyThreshold: number;
    /** Memory threshold in MB */
    memoryThreshold: number;
    /** Error rate threshold (0-1) */
    errorRateThreshold: number;
  };

  /** Whether to export metrics */
  exportMetrics: boolean;

  /** Export endpoint */
  exportEndpoint?: string;

  /** Export format */
  exportFormat?: "json" | "prometheus";
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Latency metrics */
  latency: {
    /** Median (P50) latency in milliseconds */
    p50: number;
    /** 95th percentile latency */
    p95: number;
    /** 99th percentile latency */
    p99: number;
    /** Average latency */
    average: number;
    /** Minimum latency */
    min: number;
    /** Maximum latency */
    max: number;
  };

  /** Memory metrics */
  memory: {
    /** Current memory usage in MB */
    current: number;
    /** Peak memory usage in MB */
    peak: number;
    /** Average memory usage in MB */
    average: number;
    /** Memory limit in MB */
    limit: number;
  };

  /** GPU metrics (if available) */
  gpu?: {
    /** GPU utilization percentage */
    utilization: number;
    /** GPU memory usage in MB */
    memory: number;
    /** GPU memory limit in MB */
    memoryLimit: number;
    /** Power usage in watts (if available) */
    power?: number;
    /** Temperature in Celsius (if available) */
    temperature?: number;
  };

  /** Error metrics */
  errors: {
    /** Error rate (0-1) */
    rate: number;
    /** Total errors */
    total: number;
    /** Total requests */
    totalRequests: number;
    /** Error types and counts */
    types: Record<string, number>;
  };

  /** Throughput metrics */
  throughput: {
    /** Requests per second */
    rps: number;
    /** Average batch size */
    avgBatchSize: number;
  };

  /** Model-specific metrics */
  model: {
    /** Load time in milliseconds */
    loadTime: number;
    /** Inference time in milliseconds */
    inferenceTime: number;
    /** Cache hit rate (0-1) */
    cacheHitRate: number;
  };

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// INFERENCE RESULT
// ============================================================================

/**
 * Inference result from edge runtime
 */
export interface InferenceResult {
  /** Output embedding (768-dim for VL-JEPA) */
  embedding: Float32Array;

  /** Confidence score (0-1) */
  confidence: number;

  /** Inference latency in milliseconds */
  latency: number;

  /** Memory used in MB */
  memory: number;

  /** Device information */
  device: {
    /** Runtime used */
    runtime: "webgpu" | "wasm" | "hybrid";
    /** Device tier */
    tier: "high" | "medium" | "low";
    /** GPU info (if used) */
    gpu?: string;
  };

  /** Metadata */
  metadata: {
    /** Timestamp */
    timestamp: number;
    /** Model version */
    modelVersion: string;
    /** Quantization type */
    quantization: "int8" | "fp16" | "fp32";
    /** Whether result was cached */
    cached: boolean;
    /** Batch size */
    batchSize: number;
  };
}

// ============================================================================
// DEPLOYMENT CONFIGURATION
// ============================================================================

/**
 * Static deployment configuration
 */
export interface StaticDeploymentConfig {
  /** Output directory */
  outputDir: string;

  /** Base URL for assets */
  baseUrl: string;

  /** Whether to minify */
  minify: boolean;

  /** Whether to generate source maps */
  sourceMaps: boolean;

  /** Compression format */
  compression: "gzip" | "brotli" | "none";

  /** Files to include */
  include: string[];

  /** Files to exclude */
  exclude: string[];
}

/**
 * CDN deployment configuration
 */
export interface CDNDeploymentConfig {
  /** CDN provider */
  provider: "cloudflare" | "aws" | "azure" | "fastly" | "generic";

  /** CDN endpoint URL */
  endpoint: string;

  /** Access credentials */
  credentials?: {
    apiKey?: string;
    secretKey?: string;
    bucket?: string;
    region?: string;
  };

  /** Cache configuration */
  cache: {
    /** TTL in seconds */
    ttl: number;
    /** Cache rules */
    rules: Record<string, number>;
  };

  /** Whether to enable CORS */
  cors: boolean;

  /** CORS origin */
  corsOrigin?: string;
}

/**
 * Edge worker deployment configuration
 */
export interface EdgeWorkerDeploymentConfig {
  /** Worker runtime */
  runtime: "cloudflare" | "aws" | "azure" | "deno" | "fastly";

  /** Worker script path */
  scriptPath: string;

  /** Memory limit in MB */
  memoryLimit: number;

  /** CPU timeout in milliseconds */
  timeout: number;

  /** Environment variables */
  env: Record<string, string>;

  /** Bindings */
  bindings?: {
    kv?: string[];
    durableObjects?: string[];
    r2?: string[];
  };
}

// ============================================================================
// SECURITY
// ============================================================================

/**
 * Secure context configuration
 */
export interface SecureContextConfig {
  /** Whether to require HTTPS */
  requireHTTPS: boolean;

  /** Allowed origins */
  allowedOrigins: string[];

  /** CSP header */
  contentSecurityPolicy?: string;

  /** Whether to validate origins */
  validateOrigins: boolean;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Whether sandbox is enabled */
  enabled: boolean;

  /** Memory limit in MB */
  memoryLimit: number;

  /** CPU time limit in milliseconds */
  cpuLimit: number;

  /** Allowed operations */
  allowedOps: string[];

  /** Blocked domains */
  blockedDomains: string[];

  /** Whether to isolate workers */
  isolateWorkers: boolean;
}

// ============================================================================
// DEVICE PROFILES (PRECONFIGURED)
// ============================================================================

/**
 * Predefined device profiles
 */
export type PredefinedDeviceProfile =
  | "desktop-high-end"
  | "desktop-mid-range"
  | "desktop-low-end"
  | "mobile-flagship"
  | "mobile-mid-range"
  | "mobile-budget"
  | "tablet"
  | "auto";

/**
 * Device profile configuration
 */
export interface DeviceProfileConfig {
  /** Profile name or "auto" for detection */
  profile: PredefinedDeviceProfile;

  /** Custom overrides */
  overrides?: Partial<DeviceProfile>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Edge deployment error types
 */
export class EdgeDeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "EdgeDeploymentError";
  }
}

export class RuntimeError extends EdgeDeploymentError {
  constructor(message: string, details?: unknown) {
    super(message, "RUNTIME_ERROR", details);
    this.name = "RuntimeError";
  }
}

export class ModelLoadError extends EdgeDeploymentError {
  constructor(message: string, details?: unknown) {
    super(message, "MODEL_LOAD_ERROR", details);
    this.name = "ModelLoadError";
  }
}

export class CacheError extends EdgeDeploymentError {
  constructor(message: string, details?: unknown) {
    super(message, "CACHE_ERROR", details);
    this.name = "CacheError";
  }
}

export class CapabilityError extends EdgeDeploymentError {
  constructor(message: string, details?: unknown) {
    super(message, "CAPABILITY_ERROR", details);
    this.name = "CapabilityError";
  }
}

export class SecurityError extends EdgeDeploymentError {
  constructor(message: string, details?: unknown) {
    super(message, "SECURITY_ERROR", details);
    this.name = "SecurityError";
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
  stage: string;
}) => void;

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;

  /** Runtime status */
  runtime: {
    available: boolean;
    type?: string;
    message?: string;
  };

  /** Model status */
  model: {
    loaded: boolean;
    version?: string;
    message?: string;
  };

  /** Cache status */
  cache: {
    available: boolean;
    size?: number;
    message?: string;
  };

  /** Memory status */
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };

  /** Errors if any */
  errors?: string[];
}
