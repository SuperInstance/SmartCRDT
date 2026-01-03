/**
 * Module Federation Types for VL-JEPA
 * Core type definitions for hot-swappable UI components
 */

// ============================================================================
// Federation Core Types
// ============================================================================

/**
 * Federation configuration for host or remote
 */
export interface FederationConfig {
  name: string;
  filename: string;
  exposes: Expose[];
  remotes: Remote[];
  shared: SharedDependency[];
  version: string;
}

/**
 * Remote module configuration
 */
export interface Remote {
  name: string;
  entry: string;
  entryGlobal: string;
  scope: string;
  version?: string;
}

/**
 * Module exposure configuration
 */
export interface Expose {
  name: string;
  import: string;
}

/**
 * Shared dependency configuration
 */
export interface SharedDependency {
  key: string;
  requiredVersion: string;
  strictVersion: boolean;
  singleton: boolean;
  eager?: boolean;
}

// ============================================================================
// Module Loading Types
// ============================================================================

/**
 * Module information
 */
export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  url: string;
  loaded: boolean;
  timestamp: number;
  size?: number;
}

/**
 * Module load result
 */
export interface ModuleLoadResult {
  module: any;
  version: string;
  loadTime: number;
  cached: boolean;
}

/**
 * Loader configuration
 */
export interface LoaderConfig {
  strategy: "eager" | "lazy" | "prefetch" | "priority";
  timeout: number;
  retries: number;
  fallback: string;
}

/**
 * Loading strategy
 */
export type LoadingStrategy = "eager" | "lazy" | "prefetch" | "priority";

// ============================================================================
// Hot Swap Types
// ============================================================================

/**
 * Hot swap configuration
 */
export interface HotSwapConfig {
  watchFiles: boolean;
  checkInterval: number;
  preserveState: boolean;
  transition: "instant" | "fade" | "slide";
  rollbackOnError: boolean;
}

/**
 * Hot swap result
 */
export interface HotSwapResult {
  success: boolean;
  oldModule: ModuleInfo;
  newModule: ModuleInfo;
  statePreserved: boolean;
  transitionTime: number;
}

/**
 * Swap strategy
 */
export type SwapStrategy = "immediate" | "graceful" | "rollback";

/**
 * State container for hot swapping
 */
export interface StateContainer {
  module: string;
  state: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Version Management Types
// ============================================================================

/**
 * Version configuration
 */
export interface VersionConfig {
  current: string;
  available: string[];
  range: string;
  strategy: "latest" | "compatible" | "exact";
}

/**
 * Version resolution result
 */
export interface VersionResolution {
  selected: string;
  conflicts: VersionConflict[];
  migrations: Migration[];
  compatible: boolean;
}

/**
 * Version conflict
 */
export interface VersionConflict {
  module: string;
  requested: string;
  required: string;
  severity: "error" | "warning";
}

/**
 * Migration plan
 */
export interface Migration {
  from: string;
  to: string;
  steps: MigrationStep[];
}

/**
 * Migration step
 */
export interface MigrationStep {
  description: string;
  transform: (data: any) => any;
}

// ============================================================================
// Manifest Types
// ============================================================================

/**
 * Module manifest
 */
export interface ModuleManifest {
  name: string;
  version: string;
  modules: ManifestModule[];
  dependencies: Record<string, string>;
  timestamp: number;
}

/**
 * Module in manifest
 */
export interface ManifestModule {
  name: string;
  url: string;
  version: string;
  hash: string;
  size: number;
}

/**
 * Version manifest
 */
export interface VersionManifest {
  versions: Record<string, ModuleManifest>;
  latest: string;
  compatible: string[];
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Runtime loader configuration
 */
export interface RuntimeConfig {
  cacheSize: number;
  preloadModules: string[];
  maxRetries: number;
  timeout: number;
}

/**
 * Module registry entry
 */
export interface RegistryEntry {
  module: ModuleInfo;
  instance: any;
  loadedAt: number;
  accessedAt: number;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  module: any;
  version: string;
  timestamp: number;
  expiresAt: number;
}

// ============================================================================
// Sharing Types
// ============================================================================

/**
 * Shared dependencies configuration
 */
export interface SharedConfig {
  dependencies: Record<string, SharedDep>;
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
}

/**
 * Shared dependency
 */
export interface SharedDep {
  requiredVersion: string;
  strictVersion: boolean;
  singleton: boolean;
}

/**
 * Singleton scope
 */
export interface SingletonScope {
  instance: any;
  version: string;
  module: string;
}

// ============================================================================
// Negotiation Types
// ============================================================================

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  suggestions: string[];
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  type: "version" | "api" | "dependency";
  severity: "error" | "warning" | "info";
  message: string;
  affected: string[];
}

/**
 * Fallback provider configuration
 */
export interface FallbackConfig {
  fallbackUrl?: string;
  fallbackVersion?: string;
  gracefulDegradation: boolean;
}

// ============================================================================
// DevTools Types
// ============================================================================

/**
 * Dev server configuration
 */
export interface DevServerConfig {
  port: number;
  hot: boolean;
  allowedHosts: string[];
  headers: Record<string, string>;
}

/**
 * HMR handler configuration
 */
export interface HMRConfig {
  enabled: boolean;
  overlay: boolean;
  port: number;
}

/**
 * Cache buster configuration
 */
export interface CacheBusterConfig {
  strategy: "query" | "filename" | "etag";
  versionParam: string;
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Vite plugin configuration
 */
export interface PluginConfig {
  viteConfig: any;
  federationConfig: FederationConfig;
  devMode: boolean;
  cacheDir: string;
}

/**
 * Federation plugin options
 */
export interface FederationPluginOptions {
  name: string;
  filename?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, SharedDep>;
  version?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Federation error base class
 */
export class FederationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "FederationError";
  }
}

/**
 * Module loading error
 */
export class ModuleLoadError extends FederationError {
  constructor(
    message: string,
    public module: string,
    public version: string
  ) {
    super(message, "MODULE_LOAD_ERROR");
    this.name = "ModuleLoadError";
  }
}

/**
 * Version conflict error
 */
export class VersionConflictError extends FederationError {
  constructor(
    message: string,
    public conflicts: VersionConflict[]
  ) {
    super(message, "VERSION_CONFLICT");
    this.name = "VersionConflictError";
  }
}

/**
 * Hot swap error
 */
export class HotSwapError extends FederationError {
  constructor(
    message: string,
    public module: string,
    public rollback: boolean
  ) {
    super(message, "HOT_SWAP_ERROR");
    this.name = "HotSwapError";
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Module factory
 */
export type ModuleFactory = () => Promise<any>;

/**
 * Module scope
 */
export interface ModuleScope {
  [key: string]: any;
}

/**
 * Federation container
 */
export interface FederationContainer {
  init: (shareScope: string) => Promise<void>;
  get: (module: string) => Promise<any>;
}
