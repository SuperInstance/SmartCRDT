/**
 * @lsi/swarm/rollback - Rollback Protocol Module
 *
 * Exports RollbackProtocol, ConsensusManager, and related types
 * for distributed rollback operations.
 */

// Consensus Manager
export { ConsensusManager, DEFAULT_CONSENSUS_CONFIG } from "./Consensus.js";

// Rollback Protocol
export {
  RollbackProtocol,
  DEFAULT_ROLLBACK_CONFIG,
} from "./RollbackProtocol.js";

// Rollback Executor
export { RollbackExecutor } from "./RollbackExecutor.js";

// Health Verifier
export { HealthVerifier } from "./HealthVerifier.js";

// Metrics Collector
export { MetricsCollector } from "./MetricsCollector.js";

// Re-export types
export type {
  ConnectionState,
  RollbackExecutionOptions,
  ComponentVersion,
} from "./RollbackExecutor.js";

export type {
  HealthCheckConfig,
  SystemHealthStatus,
  VerificationOptions,
  HealthThresholds,
} from "./HealthVerifier.js";

export type {
  MetricsUpdate,
  AggregateMetrics,
  MetricsCollectionConfig,
} from "./MetricsCollector.js";
