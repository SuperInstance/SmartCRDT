/**
 * @lsi/vljepa-federation
 *
 * Module Federation System for VL-JEPA
 * Hot-swapping UI components with state preservation
 *
 * @version 1.0.0
 */

// ============================================================================
// Error Classes
// ============================================================================

export {
  FederationError,
  ModuleLoadError,
  VersionConflictError,
  HotSwapError,
} from "./types.js";

// ============================================================================
// Federation Core
// ============================================================================

export { FederationHost } from "./federation/FederationHost.js";
export { FederationRemote } from "./federation/FederationRemote.js";
export { ModuleLoader } from "./federation/ModuleLoader.js";
export { VersionResolver } from "./federation/VersionResolver.js";

// ============================================================================
// Hot Swap
// ============================================================================

export { HotSwapper } from "./hotswap/HotSwapper.js";
export {
  SwapStrategy,
  ImmediateSwapStrategy,
  GracefulSwapStrategy,
  RollbackSwapStrategy,
  SwapStrategyFactory,
} from "./hotswap/SwapStrategy.js";
export {
  StatePreserver,
  FormStateSerializer,
  ScrollStateSerializer,
  InputStateSerializer,
  CustomDataSerializer,
} from "./hotswap/StatePreserver.js";
export { DependencyManager } from "./hotswap/DependencyManager.js";

// ============================================================================
// Runtime
// ============================================================================

export { RuntimeLoader } from "./runtime/RuntimeLoader.js";
export { ModuleRegistry } from "./runtime/ModuleRegistry.js";
export { VersionManager } from "./runtime/VersionManager.js";
export { CacheManager } from "./runtime/CacheManager.js";

// ============================================================================
// Manifest
// ============================================================================

export { ManifestGenerator } from "./manifest/ManifestGenerator.js";
export { ManifestLoader } from "./manifest/ManifestLoader.js";
export { VersionManifestManager } from "./manifest/VersionManifest.js";

// ============================================================================
// Sharing
// ============================================================================

export { SharedDeps, createDefaultSharedDeps } from "./sharing/SharedDeps.js";
export { DepOptimizer } from "./sharing/DepOptimizer.js";
export { SingletonManager } from "./sharing/SingletonManager.js";

// ============================================================================
// Negotiation
// ============================================================================

export { VersionNegotiator } from "./negotiation/VersionNegotiator.js";
export { CompatibilityChecker } from "./negotiation/CompabilityChecker.js";
export { FallbackProvider, type FallbackModule } from "./negotiation/FallbackProvider.js";

// ============================================================================
// DevTools
// ============================================================================

export { FederationDevServer } from "./devtools/DevServer.js";
export { HMRHandler } from "./devtools/HMRHandler.js";
export { CacheBuster } from "./devtools/CacheBuster.js";

// ============================================================================
// Plugins
// ============================================================================

export {
  federationPlugin,
  FederationPluginFactory,
  FederationHMR,
  type FederationPluginOptions,
} from "./plugins/FederationPlugin.js";

export {
  vljepaFederationPlugin,
  type VLJEPAPPluginOptions,
} from "./plugins/VLJEPAPPlugin.js";

export {
  a2uiFederationPlugin,
  type A2UIPluginOptions,
} from "./plugins/A2UIPlugin.js";

// ============================================================================
// Types
// ============================================================================

export type {
  // Core Types
  FederationConfig,
  Remote,
  Expose,
  SharedDependency,
  ModuleInfo,
  ModuleLoadResult,
  FederationContainer,

  // Loading Types
  LoaderConfig,
  LoadingStrategy,
  ModuleFactory,
  RuntimeConfig,
  RegistryEntry,
  CacheEntry,

  // Hot Swap Types
  HotSwapConfig,
  HotSwapResult,
  SwapStrategy as SwapStrategyType,
  StateContainer,

  // Version Types
  VersionConfig,
  VersionResolution,
  VersionConflict,
  Migration,
  MigrationStep,

  // Manifest Types
  ModuleManifest,
  ManifestModule,
  VersionManifest,

  // Sharing Types
  SharedConfig,
  SharedDep,
  SingletonScope,

  // Compatibility Types
  CompatibilityResult,
  CompatibilityIssue,
  FallbackConfig,

  // DevTools Types
  DevServerConfig,
  HMRConfig,
  CacheBusterConfig,

  // Plugin Types
  PluginConfig,

  // Error Types
  FederationError,
  ModuleLoadError,
  VersionConflictError,
  HotSwapError,
} from "./types.js";

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create a federation host instance
 */
export function createHost(config: {
  name: string;
  remotes: Array<{ name: string; entry: string }>;
  shared?: Record<string, { requiredVersion: string; singleton?: boolean }>;
}) {
  return new FederationHost({
    name: config.name,
    filename: "host.js",
    exposes: [],
    remotes: config.remotes.map((r) => ({
      name: r.name,
      entry: r.entry,
      entryGlobal: `${r.name}Remote`,
      scope: r.name,
    })),
    shared: Object.entries(config.shared || {}).map(([key, dep]) => ({
      key,
      requiredVersion: dep.requiredVersion,
      strictVersion: false,
      singleton: dep.singleton ?? false,
    })),
    version: "1.0.0",
  });
}

/**
 * Create a federation remote instance
 */
export function createRemote(config: {
  name: string;
  exposes: Record<string, string>;
  shared?: Record<string, { requiredVersion: string; singleton?: boolean }>;
}) {
  return new FederationRemote({
    name: config.name,
    filename: "remoteEntry.js",
    exposes: Object.entries(config.exposes).map(([name, import]) => ({
      name,
      import,
    })),
    remotes: [],
    shared: Object.entries(config.shared || {}).map(([key, dep]) => ({
      key,
      requiredVersion: dep.requiredVersion,
      strictVersion: false,
      singleton: dep.singleton ?? false,
    })),
    version: "1.0.0",
  });
}
