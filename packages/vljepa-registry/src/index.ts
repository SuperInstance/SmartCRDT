/**
 * @fileoverview Main entry point for @lsi/vljepa-registry
 * @description Exports all public APIs for the model registry package
 */

// Core types
export * from "./types.js";

// Registry
export { ModelRegistry } from "./registry/ModelRegistry.js";
export { VersionManager } from "./registry/VersionManager.js";
export { LifecycleManager } from "./registry/LifecycleManager.js";

// Storage
export { StorageBackend } from "./storage/StorageBackend.js";
export { LocalStorage } from "./storage/LocalStorage.js";
export { S3Storage } from "./storage/S3Storage.js";
export { HybridStorage } from "./storage/HybridStorage.js";

// Deployment
export { DeploymentTracker } from "./deployment/DeploymentTracker.js";
export type {
  DeploymentFilters,
  DeploymentStatistics,
} from "./deployment/DeploymentTracker.js";

// Lineage
export { LineageTracker } from "./lineage/LineageTracker.js";
export type {
  AncestryChain,
  AncestryNode,
  DataProvenance,
  LineageComparison,
  TrainingDifference,
  DataDifference,
  LineageStatistics,
} from "./lineage/LineageTracker.js";

// Metrics
export { ComparisonMetrics } from "./metrics/ComparisonMetrics.js";
export type { ModelRanking } from "./metrics/ComparisonMetrics.js";
export { DriftDetector } from "./metrics/DriftDetector.js";

// API
export { RegistryAPI } from "./api/RegistryAPI.js";
