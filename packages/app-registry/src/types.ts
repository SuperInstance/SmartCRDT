/**
 * @lsi/app-registry - App Registry Type Definitions
 *
 * Type definitions for the Aequor App Registry system.
 * Manages application manifests, dependencies, and distribution.
 */

// ============================================================================
// APP MANIFEST TYPES
// ============================================================================

/**
 * App categories
 */
export type AppCategory =
  | "ai-assistant"
  | "development"
  | "analytics"
  | "education"
  | "productivity"
  | "integration"
  | "infrastructure";

/**
 * App stability level
 */
export type AppStability = "stable" | "beta" | "alpha" | "experimental";

/**
 * License type
 */
export type AppLicense =
  | "MIT"
  | "Apache-2.0"
  | "GPL-3.0"
  | "BSD-3-Clause"
  | "ISC"
  | "MPL-2.0"
  | "UNLICENSED"
  | "SEE LICENSE IN FILE";

/**
 * Component dependency with configuration
 */
export interface AppComponentDependency {
  /** Component name */
  name: string;
  /** Version constraint */
  version: string;
  /** Whether required or optional */
  required: boolean;
  /** Component-specific configuration */
  configuration?: Record<string, unknown>;
  /** Reason for dependency */
  reason?: string;
}

/**
 * Hardware requirements
 */
export interface HardwareRequirements {
  /** Minimum RAM (e.g., "2GB", "4Gi") */
  min_ram: string;
  /** Minimum storage (e.g., "500MB", "1Gi") */
  min_storage?: string;
  /** CPU cores required */
  cpu_cores?: number;
  /** GPU required */
  gpu?: boolean;
  /** GPU memory if GPU required */
  gpu_memory_mb?: number;
  /** Specific hardware requirements */
  requirements?: string[];
}

/**
 * Configuration schema property
 */
export interface ConfigSchemaProperty {
  /** Property type */
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  /** Default value */
  default?: unknown;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Allowed values */
  enum?: unknown[];
  /** Description */
  description?: string;
  /** Whether required */
  required?: boolean;
  /** Nested properties (for objects) */
  properties?: Record<string, ConfigSchemaProperty>;
  /** Item schema (for arrays) */
  items?: ConfigSchemaProperty;
}

/**
 * Environment variable definition
 */
export interface EnvironmentVariable {
  /** Variable name */
  name: string;
  /** Description */
  description?: string;
  /** Whether required */
  required?: boolean;
  /** Default value */
  default?: string;
  /** Whether to expand (e.g., ${VAR}) */
  expand?: boolean;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Health check endpoint */
  endpoint: string;
  /** HTTP method */
  method?: "GET" | "POST";
  /** Expected status code */
  expected_status?: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Interval in seconds */
  interval_seconds?: number;
  /** Failure threshold before unhealthy */
  failure_threshold?: number;
}

/**
 * Startup configuration
 */
export interface StartupConfig {
  /** Entry point file */
  entry_point: string;
  /** Startup dependencies */
  dependencies?: string[];
  /** Commands to run before start */
  pre_start?: string[];
  /** Commands to run after start */
  post_start?: string[];
  /** Health check configuration */
  health_check: HealthCheckConfig;
  /** Working directory */
  working_dir?: string;
}

/**
 * Networking configuration
 */
export interface NetworkingConfig {
  /** Host to bind to */
  host: string;
  /** Port to bind to */
  port: number;
  /** Exposed ports */
  expose?: string[];
  /** TLS enabled */
  tls_enabled?: boolean;
  /** TLS certificate path */
  tls_cert_path?: string;
  /** TLS key path */
  tls_key_path?: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Data directory path */
  data_path: string;
  /** Cache directory path */
  cache_path?: string;
  /** Persistence enabled */
  persistence_enabled: boolean;
  /** Backup enabled */
  backup_enabled?: boolean;
  /** Backup directory */
  backup_path?: string;
}

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  /** Scaling mode */
  mode: "standalone" | "clustered" | "serverless";
  /** Number of instances */
  instances?: number;
  /** CPU limit */
  cpu_limit?: string;
  /** Memory limit */
  memory_limit?: string;
  /** Auto-scaling enabled */
  auto_scaling?: boolean;
  /** Min instances for auto-scaling */
  min_instances?: number;
  /** Max instances for auto-scaling */
  max_instances?: number;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Telemetry enabled */
  enabled: boolean;
  /** Sample rate (0-1) */
  sampled?: number;
  /** Endpoint URL */
  endpoint?: string;
  /** Metrics to collect */
  metrics?: string[];
}

/**
 * App metadata
 */
export interface AppMetadata {
  /** App name */
  name: string;
  /** App version */
  version: string;
  /** App description */
  description: string;
  /** Author */
  author: string;
  /** License */
  license: AppLicense;
  /** Tags */
  tags?: string[];
  /** Keywords for search */
  keywords?: string[];
  /** Icon URL */
  icon?: string;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** Bug tracker URL */
  bugs?: string;
  /** Created date */
  created_at?: string;
  /** Updated date */
  updated_at?: string;
}

/**
 * Complete app manifest
 */
export interface AppManifest {
  // ========================================================================
  // REQUIRED FIELDS
  // ========================================================================

  /** API version */
  apiVersion: string;
  /** Resource kind */
  kind: "App";
  /** App metadata */
  metadata: AppMetadata;
  /** App category */
  category: AppCategory;

  // ========================================================================
  // COMPONENT DEPENDENCIES
  // ========================================================================

  /** Required components */
  components: AppComponentDependency[];
  /** Optional advanced components */
  advanced_components?: AppComponentDependency[];

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  /** App configuration */
  configuration?: Record<string, unknown>;
  /** Environment variables */
  environment_vars?: Record<string, string>;
  /** Configuration schema for user overrides */
  config_schema?: Record<string, ConfigSchemaProperty>;

  // ========================================================================
  // INFRASTRUCTURE
  // ========================================================================

  /** Networking configuration */
  networking?: NetworkingConfig;
  /** Storage configuration */
  storage?: StorageConfig;
  /** Scaling configuration */
  scaling?: ScalingConfig;
  /** Hardware requirements */
  requirements?: HardwareRequirements;

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /** Startup configuration */
  startup?: StartupConfig;
  /** Health checks */
  health_checks?: {
    enabled: boolean;
    interval_seconds?: number;
    timeout_seconds?: number;
    failure_threshold?: number;
    endpoints?: HealthCheckConfig[];
  };

  // ========================================================================
  // OPERATIONS
  // ========================================================================

  /** Telemetry configuration */
  telemetry?: TelemetryConfig;
  /** Stability level */
  stability?: AppStability;
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * App registry entry (for index)
 */
export interface AppRegistryEntry {
  /** App name */
  name: string;
  /** Latest version */
  latest_version: string;
  /** Available versions */
  versions: string[];
  /** App description */
  description: string;
  /** App category */
  category: AppCategory;
  /** Search keywords */
  keywords: string[];
  /** Download count */
  downloads?: number;
  /** Rating (0-5) */
  rating?: number;
  /** Stability level */
  stability: AppStability;
  /** Icon URL */
  icon?: string;
}

/**
 * App info (for listing/searching)
 */
export interface AppInfo {
  /** App name */
  name: string;
  /** Latest version */
  latest_version: string;
  /** Available versions */
  versions: string[];
  /** Description */
  description: string;
  /** Category */
  category: AppCategory;
  /** Keywords */
  keywords: string[];
  /** Stability */
  stability: AppStability;
  /** Downloads */
  downloads?: number;
  /** Rating */
  rating?: number;
  /** Icon */
  icon?: string;
  /** Installed locally */
  installed?: boolean;
  /** Current installed version */
  current_version?: string;
  /** Update available */
  update_available?: boolean;
  /** Health status (if installed and running) */
  health?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

/**
 * Registry index
 */
export interface AppRegistryIndex {
  /** Index version */
  version: string;
  /** Last update timestamp */
  last_updated: string;
  /** Total apps */
  total_apps: number;
  /** App entries */
  apps: AppRegistryEntry[];
  /** Available categories */
  categories: AppCategory[];
}

// ============================================================================
// APP INSTALLATION TYPES
// ============================================================================

/**
 * App installation options
 */
export interface InstallOptions {
  /** Specific version to install */
  version?: string;
  /** Include advanced components */
  include_advanced?: boolean[];
  /** Force reinstall */
  force?: boolean;
  /** Skip dependency checks */
  skip_dependencies?: boolean;
  /** Skip hardware checks */
  skip_hardware_check?: boolean;
  /** Custom configuration */
  config?: Record<string, unknown>;
  /** Custom environment variables */
  env?: Record<string, string>;
  /** Dry run (don't actually install) */
  dry_run?: boolean;
  /** Progress callback */
  on_progress?: (progress: InstallProgress) => void;
}

/**
 * Installation progress
 */
export interface InstallProgress {
  /** Current stage */
  stage: "resolving" | "downloading" | "installing_components" | "configuring" | "complete";
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current operation message */
  message: string;
  /** Bytes downloaded (if downloading) */
  downloaded?: number;
  /** Total bytes (if downloading) */
  total?: number;
}

/**
 * Installation result
 */
export interface InstallResult {
  /** App name */
  app: string;
  /** Installed version */
  version: string;
  /** Install path */
  path: string;
  /** Components that were installed */
  componentsInstalled: string[];
  /** Configuration file path */
  configPath: string;
  /** Whether installation was successful */
  success: boolean;
  /** Installation errors (if any) */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Installed app details
 */
export interface InstalledApp {
  /** App name */
  name: string;
  /** Installed version */
  version: string;
  /** Install path */
  path: string;
  /** Install date */
  installed_at: string;
  /** App manifest */
  manifest: AppManifest;
  /** Whether app is running */
  running: boolean;
  /** Process ID (if running) */
  pid?: number;
  /** Port (if running) */
  port?: number;
  /** Health status */
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

// ============================================================================
// APP LIFECYCLE TYPES
// ============================================================================

/**
 * App run options
 */
export interface RunOptions {
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Arguments to pass */
  args?: string[];
  /** Detach from terminal */
  detached?: boolean;
  /** Log file path */
  log_file?: string;
  /** Stdio mode */
  stdio?: 'inherit' | 'pipe' | 'ignore';
}

/**
 * App health status
 */
export interface AppHealth {
  /** App name */
  name: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Uptime in seconds */
  uptime: number;
  /** Process ID */
  pid?: number;
  /** Port */
  port?: number;
  /** Component health status */
  components: ComponentHealthStatus[];
  /** Last check timestamp */
  last_check: string;
  /** Health issues (if any) */
  issues: string[];
}

/**
 * Component health status
 */
export interface ComponentHealthStatus {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Health status */
  status: 'healthy' | 'unhealthy' | 'unknown';
  /** Response time (ms) */
  response_time_ms?: number;
  /** Error message (if unhealthy) */
  error?: string;
}

/**
 * App uninstall options
 */
export interface UninstallOptions {
  /** Remove all app data */
  purge?: boolean;
  /** Stop if running */
  stop?: boolean;
  /** Force removal (ignore dependents) */
  force?: boolean;
  /** Skip confirmation */
  skip_confirmation?: boolean;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

/**
 * App search query
 */
export interface AppSearchQuery {
  /** Search term */
  query: string;
  /** Filter by category */
  category?: AppCategory;
  /** Filter by stability */
  stability?: AppStability;
  /** Filter by installed status */
  installed?: boolean;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Minimum rating */
  min_rating?: number;
  /** Minimum downloads */
  min_downloads?: number;
}

/**
 * App search result
 */
export interface SearchResult extends AppInfo {
  /** Relevance score (0-1) */
  score: number;
  /** Matched fields */
  matched_fields: ("name" | "description" | "keywords" | "category")[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * App registry error codes
 */
export enum AppRegistryErrorCode {
  APP_NOT_FOUND = "APP_REGISTRY_001",
  VERSION_NOT_FOUND = "APP_REGISTRY_002",
  DEPENDENCY_CONFLICT = "APP_REGISTRY_003",
  HARDWARE_INCOMPATIBLE = "APP_REGISTRY_004",
  DOWNLOAD_FAILED = "APP_REGISTRY_005",
  INSTALL_FAILED = "APP_REGISTRY_006",
  UNINSTALL_FAILED = "APP_REGISTRY_007",
  RUN_FAILED = "APP_REGISTRY_008",
  INVALID_MANIFEST = "APP_REGISTRY_009",
  ALREADY_INSTALLED = "APP_REGISTRY_010",
  NOT_INSTALLED = "APP_REGISTRY_011",
  ALREADY_RUNNING = "APP_REGISTRY_012",
  NOT_RUNNING = "APP_REGISTRY_013",
  CONFIG_INVALID = "APP_REGISTRY_014",
  NETWORK_ERROR = "APP_REGISTRY_015",
  PERMISSION_DENIED = "APP_REGISTRY_016",
  DISK_SPACE_INSUFFICIENT = "APP_REGISTRY_017",
}

/**
 * App registry error
 */
export class AppRegistryError extends Error {
  constructor(
    public code: AppRegistryErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppRegistryError";
  }
}

// ============================================================================
// REGISTRY CONFIGURATION
// ============================================================================

/**
 * Remote registry configuration
 */
export interface RemoteRegistryConfig {
  /** Registry name */
  name: string;
  /** Registry URL */
  url: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Whether enabled */
  enabled: boolean;
  /** Authentication (optional) */
  auth?: {
    type: "basic" | "bearer" | "token";
    token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * App registry configuration
 */
export interface AppRegistryConfig {
  /** Remote registries */
  registries: RemoteRegistryConfig[];
  /** Local registry path */
  local_path?: string;
  /** Local apps directory */
  local_apps_dir?: string;
  /** Cache size limit (MB) */
  cache_limit_mb?: number;
  /** Auto-update check interval (hours) */
  auto_update_interval_hours?: number;
  /** Verify manifests */
  verify_manifests?: boolean;
  /** Verify checksums */
  verify_checksums?: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Manifest validation result
 */
export interface ManifestValidationResult {
  /** Whether valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Hardware compatibility result
 */
export interface HardwareCompatibilityResult {
  /** Whether compatible */
  compatible: boolean;
  /** RAM check */
  ram?: {
    required: string;
    available: string;
    compatible: boolean;
  };
  /** CPU check */
  cpu?: {
    required: number;
    available: number;
    compatible: boolean;
  };
  /** GPU check */
  gpu?: {
    required: boolean;
    available: boolean;
    compatible: boolean;
  };
  /** Storage check */
  storage?: {
    required: string;
    available: string;
    compatible: boolean;
  };
  /** Compatibility issues */
  issues: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * App update info
 */
export interface AppUpdateInfo {
  /** App name */
  name: string;
  /** Current version */
  current_version: string;
  /** Latest version */
  latest_version: string;
  /** Update available */
  update_available: boolean;
  /** Changelog */
  changelog?: string[];
}

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  /** Total apps */
  total_apps: number;
  /** Installed apps */
  installed_apps: number;
  /** Running apps */
  running_apps: number;
  /** Available updates */
  available_updates: number;
  /** Total size (MB) */
  total_size_mb: number;
  /** Apps by category */
  apps_by_category: Record<AppCategory, number>;
  /** Apps by stability */
  apps_by_stability: Record<AppStability, number>;
}
