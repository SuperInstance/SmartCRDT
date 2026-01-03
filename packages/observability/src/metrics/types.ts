/**
 * Comprehensive metrics types for Aequor Cognitive Orchestration Platform
 *
 * Provides observability for:
 * - Request routing and latency (Cascade Router)
 * - Cache performance (Semantic Cache)
 * - Privacy events (Intent Encoder, R-A Protocol)
 * - Hardware utilization (Performance Optimizer)
 * - Security events (Security Audit)
 * - Business metrics (Cost, Usage)
 * - Training metrics (ORPO, LucidDreamer)
 */

/**
 * Metric types (Prometheus-compatible)
 */
export type MetricType = "counter" | "gauge" | "histogram" | "summary";

/**
 * Metric namespace for organization
 */
export enum MetricNamespace {
  CASCADE = "cascade",
  CACHE = "cache",
  PRIVACY = "privacy",
  HARDWARE = "hardware",
  SECURITY = "security",
  BUSINESS = "business",
  TRAINING = "training",
  SUPERINSTANCE = "superinstance",
}

/**
 * Service component labels
 */
export enum ServiceComponent {
  CASCADE_ROUTER = "cascade_router",
  INTENTION_PLANE = "intention_plane",
  CONTEXT_PLANE = "context_plane",
  LUCID_DREAMER = "lucid_dreamer",
  SEMANTIC_CACHE = "semantic_cache",
  INTENT_ENCODER = "intent_encoder",
  PRIVACY_CLASSIFIER = "privacy_classifier",
  HARDWARE_DISPATCHER = "hardware_dispatcher",
  SECURITY_AUDITOR = "security_auditor",
}

/**
 * Request routing labels
 */
export interface RoutingLabels {
  component: ServiceComponent;
  backend: "local" | "cloud" | "hybrid" | "fallback";
  model: string;
  query_type: string;
  complexity_tier: "simple" | "medium" | "complex";
  session_id?: string;
  user_id?: string;
}

/**
 * Cache performance labels
 */
export interface CacheLabels {
  cache_type: "semantic" | "embedding" | "lru" | "bloom";
  result: "hit" | "miss";
  eviction_policy?: string;
  size_tier?: string;
}

/**
 * Privacy event labels
 */
export interface PrivacyLabels {
  event_type: "intent_encoded" | "redaction_applied" | "query_sanitized" | "epsilon_dp_applied";
  privacy_level: "public" | "logic" | "style" | "secret";
  sensitivity_score: string;
  classification: "public" | "pii" | "financial" | "health" | "confidential";
  epsilon?: string;
}

/**
 * Hardware metrics labels
 */
export interface HardwareLabels {
  device_type: "cpu" | "gpu" | "npu" | "tpu";
  device_id: string;
  numa_node?: string;
  thermal_zone?: string;
  power_state: "active" | "idle" | "sleep" | "shutdown";
}

/**
 * Security event labels
 */
export interface SecurityLabels {
  event_type: "vulnerability_detected" | "sanitization_applied" | "auth_failed" | "access_denied";
  severity: "low" | "medium" | "high" | "critical";
  rule_id?: string;
  attack_vector?: string;
  cwe_id?: string;
}

/**
 * Business metrics labels
 */
export interface BusinessLabels {
  metric_type: "cost" | "usage" | "savings";
  backend: "local" | "cloud" | "hybrid";
  model: string;
  tier?: string;
  currency?: string;
}

/**
 * Training metrics labels
 */
export interface TrainingLabels {
  model_name: string;
  training_phase: "pretraining" | "finetuning" | "orpo" | "evaluation";
  epoch?: string;
  dataset?: string;
  technique: "orpo" | "vljepa" | "shadow_logging";
}

/**
 * Complete metric definition
 */
export interface MetricDefinition<T = Record<string, string>> {
  name: string;
  type: MetricType;
  namespace: MetricNamespace;
  help: string;
  labels?: T;
  buckets?: number[]; // For histograms
  quantiles?: Array<{ quantile: number; error: number }>; // For summaries
  unit?: string;
}

/**
 * Request metrics
 */
export interface RequestMetrics {
  total_requests: number;
  requests_by_backend: {
    local: number;
    cloud: number;
    hybrid: number;
    fallback: number;
  };
  requests_by_complexity: {
    simple: number;
    medium: number;
    complex: number;
  };
  error_rate: number;
  avg_latency: number;
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  miss_rate: number;
  avg_lookup_time: number;
  eviction_count: number;
  size_bytes: number;
  entry_count: number;
  false_positive_rate?: number; // For bloom filters
}

/**
 * Privacy metrics
 */
export interface PrivacyMetrics {
  queries_processed: number;
  queries_redacted: number;
  avg_epsilon: number;
  privacy_level_distribution: {
    public: number;
    logic: number;
    style: number;
    secret: number;
  };
  classification_accuracy: number;
  false_negative_rate: number; // Missed sensitive data
  redaction_overhead: number; // Time in ms
}

/**
 * Hardware metrics
 */
export interface HardwareMetrics {
  cpu_utilization: number;
  memory_utilization: number;
  gpu_utilization: number;
  gpu_memory_used: number;
  gpu_memory_total: number;
  temperature_celsius: number;
  power_draw_watts: number;
  thermal_throttling: boolean;
  numa_locality: number; // % of memory accesses to local NUMA node
}

/**
 * Security metrics
 */
export interface SecurityMetrics {
  vulnerabilities_detected: number;
  vulnerabilities_fixed: number;
  sanitizations_applied: number;
  auth_failures: number;
  auth_successes: number;
  access_denied: number;
  avg_scan_time: number;
  false_positives: number;
}

/**
 * Business metrics
 */
export interface BusinessMetrics {
  total_cost: number;
  cost_by_backend: {
    local: number;
    cloud: number;
    hybrid: number;
  };
  cost_savings: number; // From caching + local routing
  cost_per_1k_requests: number;
  estimated_monthly_cost: number;
  active_users: number;
  requests_per_user: number;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  epochs_completed: number;
  current_loss: number;
  current_accuracy: number;
  learning_rate: number;
  gradient_norm: number;
  training_samples: number;
  validation_samples: number;
  orpo_odds_ratio: number;
  shadow_log_size: number;
  model_convergence: number; // 0-1 score
}

/**
 * Comprehensive health status
 */
export interface HealthStatus {
  healthy: boolean;
  uptime_seconds: number;
  last_check: number;
  components: {
    [key: string]: {
      healthy: boolean;
      latency_ms: number;
      error?: string;
    };
  };
  resource_usage: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
}

/**
 * Alert rule definition
 */
export interface AlertRule {
  id: string;
  name: string;
  namespace: MetricNamespace;
  metric: string;
  condition: ">" | "<" | ">=" | "<=" | "==" | "!=";
  threshold: number;
  duration: number; // milliseconds
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  labels?: Record<string, string>;
  annotations: {
    summary: string;
    description: string;
    runbook_url?: string;
  };
}

/**
 * Metrics configuration
 */
export interface ObservabilityConfig {
  enabled: boolean;
  prometheus: {
    enabled: boolean;
    port: number;
    endpoint: string;
  };
  tracing: {
    enabled: boolean;
    exporter: "jaeger" | "otlp" | "zipkin";
    endpoint: string;
    sampleRate: number; // 0-1
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text";
  };
  retention: {
    metrics_hours: number;
    traces_hours: number;
    logs_hours: number;
  };
}
