/**
 * @lsi/registry - Component Registry Type Definitions
 *
 * Type definitions for the Aequor Component Registry system.
 * Manages modular, pullable AI infrastructure components.
 */

// ============================================================================
// CORE COMPONENT TYPES
// ============================================================================

/**
 * Component type categories
 */
export type ComponentType =
  | "routing"
  | "privacy"
  | "cache"
  | "embeddings"
  | "adapter"
  | "native"
  | "security"
  | "federated"
  | "training";

/**
 * Component category for grouping
 */
export type ComponentCategory = "intelligence" | "infrastructure" | "integration";

/**
 * Programming language
 */
export type ComponentLanguage =
  | "typescript"
  | "python"
  | "rust"
  | "cpp"
  | "javascript"
  | "go";

/**
 * Component stability level
 */
export type ComponentStability =
  | "stable"
  | "beta"
  | "alpha"
  | "experimental"
  | "deprecated";

/**
 * Semantic version (strict SemVer 2.0.0)
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string | null;
  build?: string | null;
}

/**
 * Version constraint operator
 */
export type VersionOperator =
  | "=" // Exact version
  | ">" // Greater than
  | ">=" // Greater than or equal
  | "<" // Less than
  | "<=" // Less than or equal
  | "~" // Patch updates (>=1.0.0 <1.1.0)
  | "^" // Minor updates (>=1.0.0 <2.0.0)
  | "*" // Any version
  | "x" // Any version (same as *)
  | "||"; // OR operator

/**
 * Version constraint
 */
export interface VersionConstraint {
  operator: VersionOperator;
  version: string;
}

/**
 * Dependency specification
 */
export interface ComponentDependency {
  /** Dependency name */
  name: string;
  /** Version constraint */
  version: string;
  /** Dependency type */
  type: "protocol" | "component" | "library";
  /** Whether required or optional */
  required: boolean;
  /** Reason for dependency (optional) */
  reason?: string;
  /** Compatibility notes */
  compatibility_reason?: string;
}

/**
 * Language-specific configuration
 */
export interface LanguageConfig {
  typescript?: {
    target: string;
    module: string;
    strict: boolean;
    jsx?: string;
  };
  python?: {
    version: string;
    type_checking?: "strict" | "basic" | "none";
  };
  rust?: {
    edition: string;
    features: string[];
  };
  cpp?: {
    standard: string;
    modules?: boolean;
  };
}

/**
 * Native module configuration
 */
export interface NativeConfig {
  /** Whether component has native implementation */
  has_native: boolean;
  /** Rust native module */
  rust?: {
    crate: string;
    edition?: string;
    features?: string[];
    bindings?: NativeBinding[];
  };
  /** C++ native module */
  cpp?: {
    library: string;
    bindings?: NativeBinding[];
  };
}

/**
 * Native FFI binding specification
 */
export interface NativeBinding {
  language: ComponentLanguage;
  ffi: "wasm-bindgen" | "pyo3" | "node-addon-api" | "pybind11" | "cffi";
  package: string;
}

/**
 * Platform compatibility
 */
export interface CompatibilitySpec {
  /** Node.js version constraint */
  node?: string;
  /** Python version constraint */
  python?: string;
  /** Supported platforms */
  platforms?: string[];
  /** Supported architectures */
  arch?: string[];
  /** Runtime constraints */
  runtimes?: RuntimeConstraint[];
}

/**
 * Runtime constraint
 */
export interface RuntimeConstraint {
  name: "node" | "deno" | "bun" | "python";
  version: string;
  optional?: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceSpec {
  /** Queries per second */
  benchmark_qps?: number;
  /** Throughput */
  benchmark_throughput?: number;
  /** Requests per second */
  benchmark_rps?: number;
  /** Latency p50 (ms) */
  latency_p50_ms?: number;
  /** Latency p95 (ms) */
  latency_p95_ms?: number;
  /** Latency p99 (ms) */
  latency_p99_ms?: number;
  /** Memory usage (MB) */
  memory_mb?: number;
  /** Peak memory (MB) */
  memory_peak_mb?: number;
  /** CPU cores required */
  cpu_cores?: number;
  /** CPU percentage */
  cpu_percent?: number;
  /** Maximum memory (MB) */
  max_memory_mb?: number;
  /** Maximum CPU cores */
  max_cpu_cores?: number;
  /** Hardware acceleration */
  acceleration?: HardwareAcceleration[];
}

/**
 * Hardware acceleration support
 */
export interface HardwareAcceleration {
  type: "simd" | "gpu" | "npu" | "fpga";
  required: boolean;
  vendor?: string;
}

/**
 * Download specification
 */
export interface DownloadSpec {
  /** Git repository details */
  git?: {
    repository: string;
    branch: string;
    subdir: string;
  };
  /** Archive download details */
  archive?: {
    url: string;
    sha256: string;
    size_mb: number;
  };
  /** NPM package details */
  npm?: {
    package: string;
    version: string;
  };
  /** PyPI package details */
  pypi?: {
    package: string;
    version: string;
  };
  /** Cargo crate details */
  cargo?: {
    crate: string;
    version: string;
  };
}

/**
 * Installation specification
 */
export interface InstallSpec {
  /** Pre-install steps */
  pre_install?: string[];
  /** Install method */
  method: "git" | "archive" | "npm" | "cargo" | "pypi";
  /** Post-install steps */
  post_install?: string[];
  /** Installation paths */
  paths?: {
    binary: string;
    library: string;
    include?: string;
    config?: string;
  };
}

/**
 * Component capability
 */
export interface ComponentCapability {
  /** Feature name */
  name: string;
  /** Whether enabled */
  enabled: boolean;
  /** Feature version (optional) */
  version?: string;
}

/**
 * Capabilities specification
 */
export interface CapabilitiesSpec {
  /** Feature flags */
  features?: ComponentCapability[];
  /** Supported operations */
  operations?: string[];
  /** Input/output types */
  types?: {
    input?: string[];
    output?: string[];
  };
  /** Protocol support */
  protocols?: ProtocolSupport[];
}

/**
 * Protocol support
 */
export interface ProtocolSupport {
  name: string;
  version: string;
  optional?: boolean;
}

/**
 * Configuration schema (JSON Schema subset)
 */
export interface ConfigSchema {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  minimum?: number;
  maximum?: number;
  default?: any;
  enum?: any[];
  required?: string[];
  description?: string;
}

/**
 * Configuration specification
 */
export interface ConfigurationSpec {
  /** Default configuration values */
  defaults?: Record<string, any>;
  /** JSON Schema for validation */
  schema?: ConfigSchema;
  /** Environment variable mappings */
  env?: EnvironmentVariable[];
}

/**
 * Environment variable mapping
 */
export interface EnvironmentVariable {
  name: string;
  description: string;
  default?: string;
  required?: boolean;
}

/**
 * Test coverage metrics
 */
export interface TestCoverage {
  lines?: number;
  functions?: number;
  branches?: number;
  statements?: number;
}

/**
 * Testing specification
 */
export interface TestingSpec {
  /** Test coverage percentages */
  coverage?: TestCoverage;
  /** Test types */
  types?: string[];
  /** Test commands */
  commands?: {
    unit?: string;
    integration?: string;
    e2e?: string;
    performance?: string;
  };
  /** Validation settings */
  validation?: {
    manifest?: boolean;
    types?: boolean;
    lint?: boolean;
    security?: boolean;
  };
}

/**
 * Documentation specification
 */
export interface DocumentationSpec {
  /** README file */
  readme?: string;
  /** API documentation */
  api?: string[];
  /** Examples */
  examples?: string[];
  /** Guides */
  guides?: DocumentationGuide[];
  /** API reference */
  reference?: DocumentationReference[];
}

/**
 * Documentation guide
 */
export interface DocumentationGuide {
  title: string;
  url: string;
}

/**
 * Documentation reference
 */
export interface DocumentationReference {
  title: string;
  url: string;
}

/**
 * License specification
 */
export interface LicenseSpec {
  /** SPDX identifier */
  spdx: string;
  /** Full license text */
  text?: string;
  /** Copyright holders */
  copyright?: string[];
}

/**
 * Author or contributor
 */
export interface Author {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Repository specification
 */
export interface RepositorySpec {
  /** Repository URL */
  url: string;
  /** Repository type */
  type: "git" | "hg" | "svn";
  /** Component directory */
  directory?: string;
  /** Issue tracker URL */
  issues?: string;
  /** Bug report URL */
  bugs?: string;
  /** Feature request URL */
  features?: string;
}

/**
 * Component manifest metadata
 */
export interface ComponentMetadata {
  /** Manifest version */
  manifest_version: string;
  /** Creation timestamp */
  created_at: string;
  /** Last modified timestamp */
  updated_at: string;
  /** Schema version */
  schema_version: string;
  /** Unique component ID */
  id: string;
  /** Checksums */
  checksums?: {
    sha256?: string;
    sha512?: string;
  };
  /** Signatures */
  signatures?: ComponentSignature[];
}

/**
 * Component signature
 */
export interface ComponentSignature {
  type: "pgp" | "x509" | "jws";
  key_id: string;
  signature: string;
  public_key?: string;
}

/**
 * Component changelog entry
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/**
 * Security specification
 */
export interface SecuritySpec {
  /** Security policy file */
  policy?: string;
  /** Vulnerability reporting */
  report_vulnerabilities?: {
    email?: string;
    url?: string;
    pgp_key?: string;
  };
  /** Security audit status */
  audit?: {
    last_audit: string;
    auditor: string;
    report?: string;
  };
  /** Dependency vulnerabilities */
  dependencies?: DependencyVulnerability[];
}

/**
 * Dependency vulnerability status
 */
export interface DependencyVulnerability {
  name: string;
  vulnerabilities: number;
  last_checked: string;
}

// ============================================================================
// COMPLETE COMPONENT MANIFEST
// ============================================================================

/**
 * Complete component manifest
 *
 * This is the full manifest structure for a component.
 * All fields are optional except for required fields.
 */
export interface ComponentManifest {
  // ========================================================================
  // REQUIRED FIELDS
  // ========================================================================

  /** Component name (kebab-case) */
  name: string;
  /** Semantic version */
  version: string;
  /** Component description */
  description: string;
  /** Component type */
  type: ComponentType;
  /** Implementation language */
  language: ComponentLanguage;

  // ========================================================================
  // OPTIONAL FIELDS
  // ========================================================================

  /** Component category */
  category?: ComponentCategory;
  /** Semantic version details */
  semver?: SemVer;
  /** Stability level */
  stability?: ComponentStability;
  /** Language configuration */
  language_config?: LanguageConfig;
  /** Native module configuration */
  native?: NativeConfig;
  /** Dependencies */
  dependencies?: ComponentDependency[];
  /** Peer dependencies (optional) */
  peer_dependencies?: ComponentDependency[];
  /** Compatibility specification */
  compatibility?: CompatibilitySpec;
  /** Performance metrics */
  performance?: PerformanceSpec;
  /** Download specification */
  download?: DownloadSpec;
  /** Installation specification */
  install?: InstallSpec;
  /** Capabilities */
  capabilities?: CapabilitiesSpec;
  /** Configuration */
  configuration?: ConfigurationSpec;
  /** Testing */
  testing?: TestingSpec;
  /** Documentation */
  documentation?: DocumentationSpec;
  /** License */
  license?: LicenseSpec;
  /** Authors */
  authors?: Author[];
  /** Contributors */
  contributors?: Author[];
  /** Repository */
  repository?: RepositorySpec;
  /** Keywords */
  keywords?: string[];
  /** Tags */
  tags?: string[];
  /** Changelog file */
  changelog?: string;
  /** Recent changes */
  changes?: ChangelogEntry[];
  /** Security */
  security?: SecuritySpec;
  /** Metadata */
  metadata?: ComponentMetadata;
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Component registry entry (index)
 */
export interface ComponentRegistryEntry {
  /** Component name */
  name: string;
  /** Latest version */
  latest_version: string;
  /** Available versions */
  versions: string[];
  /** Component type */
  type: ComponentType;
  /** Component description */
  description: string;
  /** Search keywords */
  keywords: string[];
  /** Stability level */
  stability: ComponentStability;
  /** Category */
  category?: ComponentCategory;
}

/**
 * Registry index
 */
export interface RegistryIndex {
  /** Index version */
  version: string;
  /** Last update timestamp */
  last_updated: string;
  /** Component entries */
  components: ComponentRegistryEntry[];
}

/**
 * Component info (for listing/searching)
 */
export interface ComponentInfo {
  /** Component name */
  name: string;
  /** Latest version */
  latest_version: string;
  /** Available versions */
  versions: string[];
  /** Component type */
  type: ComponentType;
  /** Description */
  description: string;
  /** Keywords */
  keywords: string[];
  /** Stability */
  stability: ComponentStability;
  /** Category */
  category?: ComponentCategory;
  /** Installed locally */
  installed?: boolean;
  /** Update available */
  update_available?: boolean;
  /** Current installed version */
  current_version?: string;
}

/**
 * Installed component details
 */
export interface InstalledComponent {
  /** Component name */
  name: string;
  /** Installed version */
  version: string;
  /** Install path */
  path: string;
  /** Install date */
  installed_at: string;
  /** Manifest */
  manifest: ComponentManifest;
  /** Active (symlinked) */
  active: boolean;
}

/**
 * Component search result
 */
export interface SearchResult extends ComponentInfo {
  /** Relevance score (0-1) */
  score: number;
  /** Matched fields */
  matched_fields: ("name" | "description" | "keywords" | "type")[];
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
 * Registry configuration
 */
export interface RegistryConfig {
  /** Remote registries */
  registries: RemoteRegistryConfig[];
  /** Local registry path */
  local_path?: string;
  /** Cache size limit (MB) */
  cache_limit_mb?: number;
  /** Auto-update check interval (hours) */
  auto_update_interval_hours?: number;
  /** Verify signatures */
  verify_signatures?: boolean;
  /** Verify checksums */
  verify_checksums?: boolean;
}

// ============================================================================
// REGISTRY OPERATIONS
// ============================================================================

/**
 * Component download options
 */
export interface DownloadOptions {
  /** Specific version (optional) */
  version?: string;
  /** Force download even if exists */
  force?: boolean;
  /** Skip verification */
  skip_verify?: boolean;
  /** Progress callback */
  on_progress?: (progress: DownloadProgress) => void;
}

/**
 * Download progress
 */
export interface DownloadProgress {
  /** Bytes downloaded */
  downloaded: number;
  /** Total bytes */
  total: number;
  /** Percentage (0-100) */
  percentage: number;
  /** Current operation */
  operation: "downloading" | "extracting" | "installing" | "verifying";
}

/**
 * Component install options
 */
export interface InstallOptions extends DownloadOptions {
  /** Install as active (create symlink) */
  active?: boolean;
  /** Skip dependencies */
  skip_dependencies?: boolean;
  /** Dry run (don't actually install) */
  dry_run?: boolean;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
  /** Resolved components in dependency order */
  components: Array<{
    name: string;
    version: string;
    manifest: ComponentManifest;
  }>;
  /** Whether resolution was successful */
  success: boolean;
  /** Resolution errors (if any) */
  errors: ResolutionError[];
}

/**
 * Dependency resolution error
 */
export interface ResolutionError {
  /** Component name */
  component: string;
  /** Error type */
  type: "conflict" | "not_found" | "circular" | "constraint";
  /** Error message */
  message: string;
  /** Conflicting dependencies */
  conflicts?: Array<{
    name: string;
    requested: string;
    existing: string;
  }>;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether compatible */
  compatible: boolean;
  /** Platform compatibility */
  platform?: {
    compatible: boolean;
    platform: string;
  };
  /** Architecture compatibility */
  arch?: {
    compatible: boolean;
    arch: string;
  };
  /** Runtime compatibility */
  runtime?: {
    compatible: boolean;
    runtime: string;
    version: string;
    required: string;
  };
  /** Dependency compatibility */
  dependencies?: {
    compatible: boolean;
    issues: string[];
  };
  /** Compatibility issues */
  issues: string[];
}

/**
 * Component verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  verified: boolean;
  /** Checksum verification */
  checksum?: {
    passed: boolean;
    algorithm: "sha256" | "sha512";
    expected: string;
    actual: string;
  };
  /** Signature verification */
  signature?: {
    passed: boolean;
    key_id: string;
    signer?: string;
  };
  /** Manifest validation */
  manifest?: {
    passed: boolean;
    errors: string[];
  };
  /** Verification errors */
  errors: string[];
}

// ============================================================================
// REGISTRY STATISTICS
// ============================================================================

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  /** Total components */
  total_components: number;
  /** Installed components */
  installed_components: number;
  /** Available updates */
  available_updates: number;
  /** Total size (MB) */
  total_size_mb: number;
  /** Cache size (MB) */
  cache_size_mb: number;
  /** Components by type */
  components_by_type: Record<ComponentType, number>;
  /** Components by stability */
  components_by_stability: Record<ComponentStability, number>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Registry error codes
 */
export enum RegistryErrorCode {
  COMPONENT_NOT_FOUND = "REGISTRY_001",
  VERSION_NOT_FOUND = "REGISTRY_002",
  DEPENDENCY_CONFLICT = "REGISTRY_003",
  CHECKSUM_MISMATCH = "REGISTRY_004",
  SIGNATURE_VERIFICATION_FAILED = "REGISTRY_005",
  INCOMPATIBLE_PLATFORM = "REGISTRY_006",
  DOWNLOAD_FAILED = "REGISTRY_007",
  EXTRACTION_FAILED = "REGISTRY_008",
  INSTALL_FAILED = "REGISTRY_009",
  UNINSTALL_FAILED = "REGISTRY_010",
  INVALID_MANIFEST = "REGISTRY_011",
  NETWORK_ERROR = "REGISTRY_012",
  PERMISSION_DENIED = "REGISTRY_013",
  DISK_SPACE_INSUFFICIENT = "REGISTRY_014",
  REGISTRY_CORRUPTED = "REGISTRY_015",
}

/**
 * Registry error
 */
export class RegistryError extends Error {
  constructor(
    public code: RegistryErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type (all properties optional recursively)
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Component manifest with optional fields (for updates)
 */
export type PartialComponentManifest = DeepPartial<ComponentManifest>;

/**
 * Component search query
 */
export interface ComponentSearchQuery {
  /** Search term */
  query: string;
  /** Filter by type */
  type?: ComponentType;
  /** Filter by stability */
  stability?: ComponentStability;
  /** Filter by category */
  category?: ComponentCategory;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Component update info
 */
export interface ComponentUpdateInfo {
  /** Component name */
  name: string;
  /** Current version */
  current_version: string;
  /** Latest version */
  latest_version: string;
  /** Update available */
  update_available: boolean;
  /** Changelog */
  changelog?: ChangelogEntry[];
}

/**
 * Registry health check result
 */
export interface RegistryHealthResult {
  /** Registry name */
  registry: string;
  /** Whether healthy */
  healthy: boolean;
  /** Response time (ms) */
  response_time_ms?: number;
  /** Last sync timestamp */
  last_sync?: string;
  /** Error message (if unhealthy) */
  error?: string;
}
