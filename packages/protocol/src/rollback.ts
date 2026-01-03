/**
 * @lsi/protocol - Rollback Protocol Types
 *
 * Defines types and interfaces for distributed rollback operations across Aequor nodes.
 * Supports consensus mechanisms (Raft, Paxos, 2PC) and automatic rollback triggers.
 *
 * @version 1.0.0
 * @module rollback
 */

// ============================================================================
// ROLLBACK REQUEST TYPES
// ============================================================================

/**
 * Reason for initiating a rollback
 */
export type RollbackReason =
  | "degradation" // Performance/quality degradation detected
  | "error" // High error rate detected
  | "security" // Security vulnerability discovered
  | "bug" // Bug discovered in deployment
  | "incompatibility" // Incompatible with other components
  | "manual"; // Manual rollback request

/**
 * Scope of rollback operation
 */
export type RollbackScope =
  | "local" // Single node only
  | "cluster" // All nodes in cluster
  | "global"; // All nodes globally

/**
 * Rollback strategy
 */
export type RollbackStrategy =
  | "immediate" // Execute immediately without draining
  | "graceful" // Drain existing requests first
  | "scheduled"; // Schedule for later time

/**
 * Rollback status throughout lifecycle
 */
export type RollbackStatus =
  | "pending" // Awaiting approval
  | "approved" // Approved, ready to execute
  | "in_progress" // Currently executing
  | "completed" // Successfully completed
  | "partial" // Some nodes failed
  | "failed" // Failed completely
  | "cancelled"; // Cancelled before completion

/**
 * Notification channel types
 */
export type NotificationChannelType =
  | "webhook"
  | "email"
  | "slack"
  | "pagerduty"
  | "console";

/**
 * Rollback request structure
 */
export interface RollbackRequest {
  /** Unique identifier for this rollback */
  rollbackId: string;

  /** Timestamp when request was created */
  timestamp: number;

  // Target Information
  /** Component type to rollback */
  targetComponent: "adapter" | "cartridge" | "config" | "model" | "protocol";
  /** Version to rollback to */
  targetVersion: string;
  /** Current version being rolled back from */
  currentVersion: string;
  /** Specific nodes to target (empty = all nodes in scope) */
  targetNodes?: string[];

  // Reason
  /** Why this rollback is being initiated */
  reason: RollbackReason;
  /** Human-readable description */
  description: string;

  // Scope
  /** Scope of this rollback */
  scope: RollbackScope;

  // Approval
  /** User or system initiating the rollback */
  initiatedBy: string;
  /** Whether this rollback requires approval */
  requiresApproval: boolean;
  /** User IDs who have approved (if requiresApproval=true) */
  approvals?: string[];
  /** Required number of approvals */
  requiredApprovals?: number;

  // Options
  /** Rollback execution options */
  options: RollbackOptions;

  // Metadata
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Rollback execution options
 */
export interface RollbackOptions {
  /** Rollback strategy */
  strategy: RollbackStrategy;

  /** For scheduled rollback - Unix timestamp */
  scheduledTime?: number;

  /** For graceful rollback - ms to drain existing requests (default: 30000) */
  drainTimeout?: number;

  /** Create backup before rollback */
  createBackup: boolean;

  /** Verify rollback success after completion */
  verifyAfterRollback: boolean;

  /** Notification channels */
  notifyStakeholders: boolean;
  notificationChannels?: NotificationChannel[];

  /** Timeout for rollback operation (ms) */
  timeout?: number;
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  /** Channel type */
  type: NotificationChannelType;
  /** Channel endpoint/identifier */
  endpoint: string;
  /** Notification template */
  template?: string;
}

// ============================================================================
// ROLLBACK RESPONSE TYPES
// ============================================================================

/**
 * Health status after verification
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Verification result for a single node
 */
export interface VerificationResult {
  /** Node identifier */
  nodeId: string;
  /** Component version after rollback */
  componentVersion: string;
  /** Health status */
  healthStatus: HealthStatus;
  /** Performance metrics */
  metrics: VerificationMetrics;
  /** Timestamp of verification */
  timestamp: number;
}

/**
 * Metrics collected during verification
 */
export interface VerificationMetrics {
  /** Error rate (0-1) */
  errorRate: number;
  /** Average latency in ms */
  latency: number;
  /** Requests per second */
  throughput: number;
  /** Quality score (0-1) */
  qualityScore?: number;
}

/**
 * Error during rollback execution
 */
export interface RollbackError {
  /** Node identifier where error occurred */
  nodeId: string;
  /** Error code */
  errorCode: string;
  /** Error message */
  message: string;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Stack trace (if available) */
  stack?: string;
}

/**
 * Rollback response
 */
export interface RollbackResponse {
  /** Rollback identifier */
  rollbackId: string;
  /** Current status */
  status: RollbackStatus;
  /** Timestamp of last update */
  timestamp: number;

  // Execution Information
  /** Number of nodes completed */
  nodesCompleted: number;
  /** Total nodes in scope */
  nodesTotal: number;
  /** Estimated completion timestamp (ms) */
  estimatedCompletion?: number;
  /** Progress percentage (0-100) */
  progress: number;

  // Verification
  /** Verification results (if completed) */
  verificationResults?: VerificationResult[];

  // Errors
  /** Any errors that occurred */
  errors: RollbackError[];

  // Metadata
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONSENSUS TYPES
// ============================================================================

/**
 * Consensus algorithm to use
 */
export type ConsensusAlgorithm = "raft" | "paxos" | "two_phase_commit";

/**
 * Vote decision
 */
export type VoteDecision = "approve" | "reject" | "abstain";

/**
 * Proposal type for consensus
 */
export type ProposalType =
  | "rollback"
  | "deployment"
  | "config_change"
  | "emergency";

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  /** Consensus algorithm */
  algorithm: ConsensusAlgorithm;

  /** Quorum requirements */
  quorumSize: number;
  /** Timeout for consensus in ms */
  timeout: number;

  /** Retry configuration */
  maxRetries: number;
  retryDelay: number;

  /** Election timeout (for Raft) in ms */
  electionTimeout?: number;
  /** Heartbeat interval (for Raft) in ms */
  heartbeatInterval?: number;
}

/**
 * Consensus proposal
 */
export interface ConsensusProposal {
  /** Unique proposal identifier */
  proposalId: string;

  /** Proposal type */
  type: ProposalType;

  /** Proposal payload (RollbackRequest, deployment config, etc.) */
  payload: unknown;

  /** Who proposed this */
  proposedBy: string;
  /** When proposed */
  proposedAt: number;

  /** Voting */
  votes: Vote[];
  /** Required votes for quorum */
  requiredVotes: number;

  /** Proposal status */
  status: "pending" | "approved" | "rejected" | "expired";

  /** Expiration timestamp */
  expiresAt: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Vote on a proposal
 */
export interface Vote {
  /** Node ID of voter */
  nodeId: string;
  /** Vote decision */
  decision: VoteDecision;
  /** Timestamp of vote */
  timestamp: number;
  /** Reason for decision (optional) */
  reason?: string;
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  /** Whether proposal was approved */
  approved: boolean;
  /** Votes in favor */
  votesFor: number;
  /** Votes against */
  votesAgainst: number;
  /** Abstentions */
  votesAbstain: number;
  /** Total votes cast */
  totalVotes: number;
  /** Whether quorum was reached */
  quorumReached: boolean;
  /** Consensus algorithm used */
  algorithm: ConsensusAlgorithm;
  /** Time to reach consensus (ms) */
  duration: number;
}

// ============================================================================
// ROLLBACK CONFIGURATION
// ============================================================================

/**
 * Automatic rollback trigger configuration
 */
export interface AutoRollbackConfig {
  /** Enable automatic rollback */
  enabled: boolean;

  /** Error rate threshold (0-1) */
  errorRateThreshold: number;
  /** Latency threshold in ms */
  latencyThreshold: number;
  /** Evaluation window in ms */
  evaluationWindow: number;

  /** Minimum samples before triggering */
  minSamples: number;
  /** Consecutive violations required */
  consecutiveViolations: number;
}

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  /** Default strategy */
  defaultStrategy: RollbackStrategy;
  /** Default timeout in ms */
  defaultTimeout: number;

  /** Automatic rollback triggers */
  autoRollback: AutoRollbackConfig;

  /** Rollback history retention */
  retainHistoryDays: number;

  /** Default notification channels */
  notificationChannels: NotificationChannel[];

  /** Backup configuration */
  backup: {
    /** Enable automatic backups */
    enabled: boolean;
    /** Backup retention days */
    retainDays: number;
    /** Backup location */
    location: string;
  };
}

// ============================================================================
// ROLLBACK REPORT TYPES
// ============================================================================

/**
 * Single step in rollback execution
 */
export interface RollbackStep {
  /** Step number */
  step: number;
  /** Step name */
  name: string;
  /** Step description */
  description: string;
  /** Step status */
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  /** Start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Duration in ms */
  duration?: number;
  /** Nodes involved in this step */
  nodes?: string[];
}

/**
 * Metrics snapshot for comparison
 */
export interface MetricsSnapshot {
  /** Timestamp of snapshot */
  timestamp: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average latency in ms */
  avgLatency: number;
  /** 95th percentile latency */
  p95Latency: number;
  /** 99th percentile latency */
  p99Latency: number;
  /** Throughput (requests/sec) */
  throughput: number;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Resource utilization */
  resourceUtilization?: {
    cpu: number;
    memory: number;
  };
}

/**
 * Metrics comparison before/after
 */
export interface MetricsComparison {
  /** Metrics before rollback */
  before: MetricsSnapshot;
  /** Metrics after rollback */
  after: MetricsSnapshot;
  /** Percentage improvement (positive = better) */
  improvement: number;
}

/**
 * Rollback execution report
 */
export interface RollbackReport {
  /** Rollback identifier */
  rollbackId: string;
  /** Report generation timestamp */
  timestamp: number;
  /** Rollback duration in ms */
  duration: number;

  // Summary
  /** Total nodes in scope */
  nodesTotal: number;
  /** Successfully completed nodes */
  nodesSuccessful: number;
  /** Failed nodes */
  nodesFailed: number;

  // Details
  /** Execution steps */
  steps: RollbackStep[];
  /** Errors encountered */
  errors: RollbackError[];
  /** Metrics comparison */
  metrics: MetricsComparison;

  // Recommendations
  /** Recommendations based on results */
  recommendations: string[];

  // Metadata
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

/**
 * Filters for listing rollbacks
 */
export interface RollbackFilters {
  /** Filter by status */
  status?: RollbackStatus[];
  /** Filter by component */
  targetComponent?: string[];
  /** Filter by initiated by */
  initiatedBy?: string[];
  /** Filter by reason */
  reason?: RollbackReason[];
  /** Filter by scope */
  scope?: RollbackScope[];
  /** Time range */
  timeRange?: {
    start: number;
    end: number;
  };
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Rollback history entry
 */
export interface RollbackHistoryEntry {
  /** Rollback request */
  request: RollbackRequest;
  /** Rollback response */
  response: RollbackResponse;
  /** Rollback report (if available) */
  report?: RollbackReport;
}

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Node information for distributed operations
 */
export interface Node {
  /** Unique node identifier */
  id: string;
  /** Node address */
  address: string;
  /** Node port */
  port: number;
  /** Node role */
  role: "leader" | "follower" | "candidate" | "observer";
  /** Node status */
  status: "online" | "offline" | "degraded";
  /** Last heartbeat timestamp */
  lastHeartbeat?: number;
  /** Node capabilities */
  capabilities?: string[];
  /** Current component versions */
  versions?: Record<string, string>;
}

/**
 * Result from operation on a single node
 */
export interface NodeResult {
  /** Node identifier */
  nodeId: string;
  /** Operation success */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error if failed */
  error?: string;
  /** Timestamp of completion */
  timestamp: number;
}

// ============================================================================
// EMERGENCY ROLLBACK TYPES
// ============================================================================

/**
 * Emergency rollback trigger
 */
export interface EmergencyTrigger {
  /** Trigger identifier */
  triggerId: string;
  /** Trigger type */
  type: "error_rate" | "latency" | "security" | "manual";
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** Threshold that was exceeded */
  threshold: number;
  /** Actual value observed */
  actualValue: number;
  /** Timestamp trigger fired */
  timestamp: number;
  /** Description */
  description: string;
}

/**
 * Emergency rollback configuration
 */
export interface EmergencyRollbackConfig {
  /** Enable emergency rollback */
  enabled: boolean;
  /** Auto-approve emergency rollbacks */
  autoApprove: boolean;
  /** Triggers for emergency rollback */
  triggers: EmergencyTrigger[];
  /** Target version for emergency rollback */
  fallbackVersion: string;
  /** Notification channels for emergencies */
  emergencyChannels: NotificationChannel[];
}
