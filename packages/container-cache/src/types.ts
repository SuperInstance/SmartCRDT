/**
 * Container image representation
 */
export interface ContainerImage {
  /** Image repository (e.g., 'library/python') */
  repository: string;
  /** Image tag (e.g., '3.11-slim') */
  tag: string;
  /** Image digest (SHA256) */
  digest: string;
  /** Image size in bytes */
  size: number;
  /** Image layers (ordered from base to top) */
  layers: ImageLayer[];
  /** Full image reference */
  ref: string;
  /** Creation timestamp */
  created_at: Date;
  /** Architecture (e.g., 'amd64', 'arm64') */
  architecture: string;
  /** OS (e.g., 'linux') */
  os: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Command to run */
  cmd?: string[];
  /** Entry point */
  entrypoint?: string[];
}

/**
 * Single image layer
 */
export interface ImageLayer {
  /** Layer digest (SHA256) */
  digest: string;
  /** Compressed size in bytes */
  compressed_size: number;
  /** Uncompressed size in bytes */
  uncompressed_size: number;
  /** Layer media type */
  media_type: string;
  /** Layer index in image */
  index: number;
}

/**
 * Cache strategy type
 */
export type CacheStrategy = "eager" | "lazy" | "predictive" | "on-demand";

/**
 * Cache entry for a container image
 */
export interface CacheEntry {
  /** Unique cache entry ID */
  id: string;
  /** Image reference */
  image_ref: string;
  /** Image data */
  image: ContainerImage;
  /** When the image was cached */
  cached_at: Date;
  /** Last access time */
  last_used: Date;
  /** Number of times accessed */
  access_count: number;
  /** Total size in bytes */
  size_bytes: number;
  /** Cache strategy used */
  strategy: CacheStrategy;
  /** Preload priority (0-100, higher = more important) */
  priority: number;
  /** Whether image is verified */
  verified: boolean;
}

/**
 * Layer cache entry
 */
export interface LayerCache {
  /** Layer digest */
  digest: string;
  /** Compressed size */
  compressed_size: number;
  /** Uncompressed size */
  uncompressed_size: number;
  /** Number of cache hits */
  cache_hits: number;
  /** Images using this layer */
  referenced_by: string[];
  /** When cached */
  cached_at: Date;
  /** Last access */
  last_used: Date;
  /** Layer data location */
  location: string;
  /** Whether layer is verified */
  verified: boolean;
}

/**
 * Cache statistics
 */
export interface CacheMetrics {
  /** Cache hit rate (0-1) */
  hit_rate: number;
  /** Cache miss rate (0-1) */
  miss_rate: number;
  /** Total cache hits */
  total_hits: number;
  /** Total cache misses */
  total_misses: number;
  /** Current total size in bytes */
  total_size: number;
  /** Maximum cache size in bytes */
  max_size: number;
  /** Number of cached images */
  image_count: number;
  /** Number of cached layers */
  layer_count: number;
  /** Eviction rate (0-1) */
  eviction_rate: number;
  /** Total evictions */
  total_evictions: number;
  /** Average access time in ms */
  avg_access_time: number;
  /** Compression ratio (saved/original) */
  compression_ratio: number;
}

/**
 * Preload prediction
 */
export interface PreloadPrediction {
  /** Image reference */
  image_ref: string;
  /** Predicted probability of use (0-1) */
  probability: number;
  /** Predicted time of use */
  predicted_time: Date;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for prediction */
  reason: string;
}

/**
 * Usage pattern for prediction
 */
export interface UsagePattern {
  /** Image reference */
  image_ref: string;
  /** Usage count in time window */
  usage_count: number;
  /** Time window start */
  window_start: Date;
  /** Time window end */
  window_end: Date;
  /** Average time between uses (ms) */
  avg_interval: number;
  /** Standard deviation of intervals */
  interval_stddev: number;
  /** Peak usage hours (0-23) */
  peak_hours: number[];
  /** Day of week patterns (0-6, 0=Sunday) */
  day_patterns: number[];
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  max_size: number;
  /** Maximum number of images */
  max_images: number;
  /** Default cache strategy */
  default_strategy: CacheStrategy;
  /** LRU eviction enabled */
  lru_eviction: boolean;
  /** Size-based eviction enabled */
  size_eviction: boolean;
  /** Layer deduplication enabled */
  layer_deduplication: boolean;
  /** Cache directory path */
  cache_dir: string;
  /** Verify image integrity */
  verify_integrity: boolean;
  /** Compress cached layers */
  compress_layers: boolean;
  /** Predictive preloading enabled */
  predictive_preloading: boolean;
  /** Preload prediction window (hours) */
  prediction_window: number;
  /** Minimum probability for preload */
  min_preload_probability: number;
  /** Preload check interval (ms) */
  preload_check_interval: number;
}

/**
 * Image pull progress
 */
export interface PullProgress {
  /** Image reference */
  image_ref: string;
  /** Current layer being pulled */
  current_layer?: string;
  /** Layers completed */
  layers_completed: number;
  /** Total layers */
  total_layers: number;
  /** Bytes downloaded */
  bytes_downloaded: number;
  /** Total bytes */
  total_bytes: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Pull status */
  status: "pulling" | "verifying" | "extracting" | "complete" | "failed";
  /** Error message if failed */
  error?: string;
}

/**
 * Docker client options
 */
export interface DockerOptions {
  /** Docker socket path */
  socketPath?: string;
  /** Docker host URL */
  host?: string;
  /** Docker API version */
  version?: string;
  /** TLS options */
  tls?: any;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Kubernetes client options
 */
export interface KubernetesOptions {
  /** Kubeconfig path */
  kubeconfig?: string;
  /** Context name */
  context?: string;
  /** Cluster name */
  cluster?: string;
  /** Namespace */
  namespace?: string;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Pod template for pre-warming
 */
export interface PodTemplate {
  /** Pod name template */
  name: string;
  /** Namespace */
  namespace: string;
  /** Container specifications */
  containers: ContainerSpec[];
  /** Node selector */
  node_selector?: Record<string, string>;
  /** Node affinity */
  node_affinity?: any;
  /** Resource requirements */
  resources?: ResourceRequirements;
}

/**
 * Container specification
 */
export interface ContainerSpec {
  /** Container name */
  name: string;
  /** Image reference */
  image: string;
  /** Command to run */
  command?: string[];
  /** Arguments */
  args?: string[];
  /** Environment variables */
  env?: Array<{ name: string; value: string }>;
  /** Resource limits */
  resources?: ResourceRequirements;
  /** Volume mounts */
  volume_mounts?: any[];
}

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  /** CPU request */
  cpu_request?: string;
  /** CPU limit */
  cpu_limit?: string;
  /** Memory request */
  memory_request?: string;
  /** Memory limit */
  memory_limit?: string;
}

/**
 * Cache warming result
 */
export interface WarmupResult {
  /** Images successfully warmed */
  warmed: string[];
  /** Images that failed */
  failed: Array<{ image: string; error: string }>;
  /** Images already cached */
  cached: string[];
  /** Total time in ms */
  duration_ms: number;
  /** Bytes downloaded */
  bytes_downloaded: number;
}

/**
 * Eviction result
 */
export interface EvictionResult {
  /** Images evicted */
  evicted_images: string[];
  /** Layers evicted */
  evicted_layers: string[];
  /** Bytes freed */
  bytes_freed: number;
  /** Eviction duration in ms */
  duration_ms: number;
}
