/**
 * @lsi/app-manager - App Lifecycle Management Types
 *
 * Type definitions for managing complete app lifecycles
 */

// ============================================================================
// APP MANIFEST TYPES
// ============================================================================

/**
 * App metadata
 */
export interface AppMetadata {
  /** App name (kebab-case) */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author or organization */
  author?: string;
  /** SPDX license identifier */
  license?: string;
  /** Project homepage URL */
  homepage?: string;
  /** Git repository URL */
  repository?: string;
  /** Category tags */
  tags?: string[];
  /** Search keywords */
  keywords?: string[];
  /** App icon URL */
  icon?: string;
}

/**
 * App category
 */
export type AppCategory =
  | "ai-assistant"
  | "data-processing"
  | "search"
  | "monitoring"
  | "automation"
  | "integration"
  | "development"
  | "infrastructure";

/**
 * Component reference in app
 */
export interface AppComponentReference {
  /** Component name */
  name: string;
  /** Version constraint */
  version: string;
  /** Whether component is required */
  required: boolean;
  /** Component-specific configuration */
  configuration?: Record<string, unknown>;
}

/**
 * Global app configuration
 */
export interface AppConfiguration {
  /** Environment name */
  environment?: string;
  /** Global log level */
  log_level?: string;
  /** Enable metrics collection */
  enable_metrics?: boolean;
  /** Enable distributed tracing */
  enable_tracing?: boolean;
}

/**
 * Networking configuration
 */
export interface AppNetworking {
  /** Host to bind to */
  host?: string;
  /** Port to bind to */
  port?: number;
  /** Exposed ports */
  expose?: string[];
  /** Enable TLS */
  tls_enabled?: boolean;
  /** TLS certificate path */
  tls_cert_path?: string;
  /** TLS private key path */
  tls_key_path?: string;
}

/**
 * Storage configuration
 */
export interface AppStorage {
  /** Data storage path */
  data_path?: string;
  /** Cache storage path */
  cache_path?: string;
  /** Enable persistence */
  persistence_enabled?: boolean;
  /** Enable backups */
  backup_enabled?: boolean;
  /** Backup schedule (cron) */
  backup_schedule?: string;
  /** Backup retention days */
  backup_retention_days?: number;
}

/**
 * Scaling configuration
 */
export interface AppScaling {
  /** Scaling mode */
  mode?: "standalone" | "horizontal" | "vertical";
  /** Number of instances */
  instances?: number;
  /** Minimum instances */
  min_instances?: number;
  /** Maximum instances */
  max_instances?: number;
  /** CPU limit */
  cpu_limit?: string;
  /** Memory limit */
  memory_limit?: string;
}

/**
 * Health check configuration
 */
export interface AppHealthCheck {
  /** Enable health checks */
  enabled?: boolean;
  /** Check interval in seconds */
  interval_seconds?: number;
  /** Check timeout in seconds */
  timeout_seconds?: number;
  /** Failure threshold */
  failure_threshold?: number;
  /** Health check endpoints */
  endpoints?: HealthCheckEndpoint[];
}

/**
 * Health check endpoint
 */
export interface HealthCheckEndpoint {
  /** Endpoint path */
  path: string;
  /** HTTP method */
  method: string;
  /** Expected status code */
  expected_status: number;
}

/**
 * Telemetry configuration
 */
export interface AppTelemetry {
  /** Enable telemetry */
  enabled?: boolean;
  /** Telemetry endpoint URL */
  endpoint?: string;
  /** Sampling rate (0.0-1.0) */
  sampled?: number;
}

/**
 * Complete app manifest
 */
export interface AppManifest {
  /** API version */
  apiVersion: string;
  /** Resource kind */
  kind: string;
  /** App metadata */
  metadata: AppMetadata;
  /** App category */
  category: AppCategory;
  /** Required components */
  components: AppComponentReference[];
  /** Advanced components (optional) */
  advanced_components?: AppComponentReference[];
  /** Global configuration */
  configuration?: AppConfiguration;
  /** Environment variables */
  environment_vars?: Record<string, string>;
  /** Networking configuration */
  networking?: AppNetworking;
  /** Storage configuration */
  storage?: AppStorage;
  /** Scaling configuration */
  scaling?: AppScaling;
  /** Health check configuration */
  health_checks?: AppHealthCheck;
  /** Telemetry configuration */
  telemetry?: AppTelemetry;
}

// ============================================================================
// APP STATE TYPES
// ============================================================================

/**
 * App lifecycle status
 */
export type AppStatus =
  | "remote"           // Available in registry only
  | "pulling"          // Downloading metadata
  | "resolved"         // Dependencies resolved
  | "downloaded"       // Components downloaded
  | "configured"       // Configuration applied
  | "running"          // Currently running
  | "stopped"          // Stopped but configured
  | "failed";          // Operation failed

/**
 * App state information
 */
export interface AppState {
  /** App name */
  name: string;
  /** App version */
  version: string;
  /** Current status */
  status: AppStatus;
  /** Installation path */
  path: string;
  /** Component states */
  components: ComponentAppState[];
  /** Status timestamp */
  updated_at: Date;
  /** Error message if failed */
  error?: string;
  /** Process ID if running */
  pid?: number;
  /** Health status */
  health?: AppHealthStatus;
}

/**
 * Component state within app
 */
export interface ComponentAppState {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Component status */
  status: AppStatus;
  /** Is advanced component */
  advanced: boolean;
  /** Installation path */
  path: string;
  /** Error message if failed */
  error?: string;
}

/**
 * App health status
 */
export interface AppHealthStatus {
  /** Overall health */
  healthy: boolean;
  /** Component health */
  components: Record<string, boolean>;
  /** Last check timestamp */
  last_check: Date;
  /** Health check results */
  results: HealthCheckResult[];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Endpoint path */
  path: string;
  /** Healthy status */
  healthy: boolean;
  /** Response time in milliseconds */
  response_time_ms: number;
  /** Status code */
  status_code?: number;
  /** Error message */
  error?: string;
}

// ============================================================================
// APP INFO TYPES
// ============================================================================

/**
 * App information (lightweight)
 */
export interface AppInfo {
  /** App name */
  name: string;
  /** Latest version */
  latest_version: string;
  /** Available versions */
  versions: string[];
  /** App category */
  category: string;
  /** App description */
  description: string;
  /** Search keywords */
  keywords: string[];
  /** Is installed */
  installed: boolean;
  /** Current version (if installed) */
  current_version?: string;
  /** Update available */
  update_available: boolean;
  /** Number of components */
  component_count: number;
  /** Number of advanced components */
  advanced_component_count: number;
}

/**
 * Installed app details
 */
export interface InstalledApp {
  /** App name */
  name: string;
  /** App version */
  version: string;
  /** Installation path */
  path: string;
  /** Installation timestamp */
  installed_at: Date;
  /** App manifest */
  manifest: AppManifest;
  /** Component states */
  components: ComponentAppState[];
  /** Is running */
  running: boolean;
  /** Process ID */
  pid?: number;
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

/**
 * Pull options
 */
export interface PullOptions {
  /** Target version */
  version?: string;
  /** Include advanced components */
  includeAdvanced?: boolean;
  /** Force re-download */
  force?: boolean;
  /** Dry run (don't actually download) */
  dryRun?: boolean;
  /** Skip dependencies */
  skipDependencies?: boolean;
  /** Progress callback */
  onProgress?: (progress: PullProgress) => void;
}

/**
 * Pull progress information
 */
export interface PullProgress {
  /** App name */
  app: string;
  /** Current operation */
  operation: "resolving" | "downloading" | "configuring" | "complete";
  /** Current component being processed */
  component?: string;
  /** Components downloaded */
  downloaded: number;
  /** Total components */
  total: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
}

/**
 * Run options
 */
export interface RunOptions {
  /** Environment override */
  environment?: string;
  /** Custom configuration file */
  config?: string;
  /** Detach from terminal */
  detached?: boolean;
  /** Port override */
  port?: number;
  /** Log level override */
  logLevel?: string;
  /** Enable metrics override */
  enableMetrics?: boolean;
  /** Enable tracing override */
  enableTracing?: boolean;
}

/**
 * Enhance options
 */
export interface EnhanceOptions {
  /** Components to add */
  components: string[];
  /** Dry run (preview changes) */
  dryRun?: boolean;
  /** Skip dependency checks */
  skipDependencies?: boolean;
}

/**
 * App search query
 */
export interface AppSearchQuery {
  /** Search query */
  query: string;
  /** Filter by category */
  category?: AppCategory;
  /** Offset for pagination */
  offset?: number;
  /** Limit for pagination */
  limit?: number;
}

/**
 * App search result
 */
export interface AppSearchResult {
  /** App name */
  name: string;
  /** App description */
  description: string;
  /** App category */
  category: string;
  /** Relevance score (0-1) */
  score: number;
  /** Matched fields */
  matched_fields: ("name" | "description" | "keywords" | "category")[];
  /** Is installed */
  installed: boolean;
  /** Latest version */
  latest_version: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * App manager error codes
 */
export type AppManagerErrorCode =
  | "APP_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "COMPONENT_NOT_FOUND"
  | "COMPONENT_RESOLUTION_FAILED"
  | "CIRCULAR_DEPENDENCY"
  | "INVALID_MANIFEST"
  | "INVALID_CONFIGURATION"
  | "PORT_IN_USE"
  | "PATH_NOT_WRITABLE"
  | "ALREADY_RUNNING"
  | "NOT_RUNNING"
  | "HEALTH_CHECK_FAILED"
  | "ENHANCE_FAILED";

/**
 * App manager error
 */
export class AppManagerError extends Error {
  constructor(
    public code: AppManagerErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppManagerError";
  }
}
