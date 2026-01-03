/**
 * @lsi/protocol - Hypothesis Protocol Types
 *
 * Protocol types for distributed hypothesis generation, testing, and validation.
 * This enables LucidDreamer to distribute hypotheses across multiple nodes,
 * collect validation results, and make evidence-based decisions.
 *
 * Phase 4 implementation (Weeks 13-20)
 */

/**
 * Hypothesis packet for distribution across nodes
 */
export interface HypothesisPacket {
  // Header
  /** Protocol version */
  version: string;
  /** Unique hypothesis identifier */
  hypothesisId: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Node ID that generated this hypothesis */
  sourceNodeId: string;

  // Hypothesis content
  /** Type of hypothesis */
  type: HypothesisType;
  /** Brief title */
  title: string;
  /** Detailed description */
  description: string;

  // Expected impact
  /** Expected improvements */
  expectedImpact: ExpectedImpact;

  // Actionability
  /** How actionable this hypothesis is */
  actionability: Actionability;

  // Evidence
  /** Supporting evidence */
  evidence: EvidencePacket[];

  // Distribution
  /** Distribution scope */
  distributionScope: HypothesisScope;
  /** Specific target nodes (if selective) */
  targetNodes?: string[];

  // Testing requirements
  /** How to validate this hypothesis */
  testingConfig: TestingConfig;

  // Validation
  /** Whether validation is required before deployment */
  validationRequired: boolean;
  /** Minimum confidence threshold for acceptance */
  minConfidence: number;
}

/**
 * Types of hypotheses for system improvements
 */
export type HypothesisType =
  | "cache_optimization" // Adjust cache parameters
  | "routing_rule" // Add/modify routing rule
  | "privacy_threshold" // Adjust privacy threshold
  | "query_refinement" // Refine query type classification
  | "adapter_config" // Adjust adapter configuration
  | "resource_allocation" // Change resource allocation
  | "cartridge_selection"; // Select different cartridge

/**
 * Expected impact from hypothesis
 */
export interface ExpectedImpact {
  /** Expected latency improvement (0-1) */
  latency: number;
  /** Expected quality improvement (0-1) */
  quality: number;
  /** Expected cost reduction (0-1) */
  cost: number;
  /** Confidence in estimate (0-1) */
  confidence: number;
}

/**
 * Actionability assessment for hypothesis
 */
export interface Actionability {
  /** Overall actionability level */
  level: "high" | "medium" | "low";
  /** Implementation difficulty */
  difficulty: "trivial" | "easy" | "medium" | "hard";
  /** Estimated implementation time (hours) */
  estimatedTime: number;
  /** Required changes (files/components) */
  requiredChanges: string[];
  /** Potential risks */
  risks: string[];
  /** Rollback complexity */
  rollbackComplexity: "trivial" | "easy" | "medium" | "hard";
}

/**
 * Evidence packet supporting a hypothesis
 */
export interface EvidencePacket {
  /** Type of evidence */
  type: EvidenceType;
  /** Source of evidence */
  source: string;
  /** Unix timestamp (ms) */
  timestamp: number;

  // Pattern data
  /** Pattern statistics */
  pattern?: {
    /** Support count */
    support: number;
    /** Confidence level */
    confidence: number;
    /** Lift factor */
    lift: number;
  };

  // Correlation data
  /** Correlation statistics */
  correlation?: {
    /** First variable */
    variable1: string;
    /** Second variable */
    variable2: string;
    /** Correlation coefficient */
    coefficient: number;
    /** P-value for significance */
    pValue: number;
  };

  // Anomaly data
  /** Anomaly statistics */
  anomaly?: {
    /** Metric name */
    metric: string;
    /** Observed value */
    value: number;
    /** Z-score */
    zScore: number;
  };

  // User feedback
  /** User feedback data */
  feedback?: {
    /** User ID */
    userId: string;
    /** Rating (1-5) */
    rating: number;
    /** Comment */
    comment: string;
  };
}

/**
 * Evidence types
 */
export type EvidenceType =
  | "pattern" // Repeated pattern observed
  | "correlation" // Correlation between variables
  | "anomaly" // Anomaly detected
  | "user_feedback" // Direct user feedback
  | "comparison"; // A/B test result

/**
 * Hypothesis distribution scope
 */
export interface HypothesisScope {
  /** Scope type */
  type: "local" | "cluster" | "global" | "selective";
  /** Specific node IDs (for selective) */
  nodes?: string[];
  /** Selection criteria (for cluster/selective) */
  criteria?: {
    /** Geographic region */
    region?: string;
    /** Workload type */
    workload?: WorkloadType;
    /** Capacity requirements */
    capacity?: {
      /** Minimum memory (MB) */
      minMemoryMB: number;
      /** Minimum CPU cores */
      minCPUCores: number;
    };
  };
}

/**
 * Workload types for hypothesis targeting
 */
export type WorkloadType =
  | "read_heavy"
  | "write_heavy"
  | "compute_heavy"
  | "memory_heavy"
  | "mixed";

/**
 * Testing configuration for hypothesis validation
 */
export interface TestingConfig {
  // Test design
  /** Type of test to run */
  testType: "ab_test" | "multivariate" | "sequential";

  // Duration
  /** Minimum test duration (ms) */
  minDuration: number;
  /** Maximum test duration (ms) */
  maxDuration: number;

  // Sample size
  /** Minimum sample size */
  minSampleSize: number;
  /** Target sample size */
  targetSampleSize: number;

  // Success criteria
  /** Primary metric to optimize */
  primaryMetric: string;
  /** Minimum improvement to accept (0-1) */
  targetImprovement: number;
  /** Maximum acceptable regression (0-1) */
  maxRegression: number;

  // Stopping rules
  /** Stop early on clear success */
  earlyStopOnSuccess: boolean;
  /** Stop early on clear failure */
  earlyStopOnFailure: boolean;
}

/**
 * Result from hypothesis testing on a single node
 */
export interface HypothesisResult {
  /** Hypothesis ID */
  hypothesisId: string;
  /** Node ID that ran the test */
  nodeId: string;

  // Test results
  /** Type of test that was run */
  testType: TestingConfig["testType"];
  /** Test duration (ms) */
  duration: number;
  /** Sample size */
  sampleSize: number;

  // Metrics
  /** Baseline metrics (before) */
  metricsBefore: MetricsSnapshot;
  /** Treatment metrics (after) */
  metricsAfter: MetricsSnapshot;

  // Outcome
  /** Final decision */
  decision: "accept" | "reject" | "inconclusive";
  /** Confidence in decision (0-1) */
  confidence: number;

  // Improvement
  /** Measured improvements */
  improvement: {
    latency: number;
    quality: number;
    cost: number;
  };

  // Errors
  /** Any errors encountered */
  errors: string[];

  // Timestamp
  /** Unix timestamp (ms) */
  completedAt: number;
}

/**
 * Metrics snapshot for performance measurement
 */
export interface MetricsSnapshot {
  // Latency
  /** Average latency (ms) */
  avgLatency: number;
  /** P50 latency (ms) */
  p50Latency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** P99 latency (ms) */
  p99Latency: number;

  // Quality
  /** Average quality score (0-1) */
  avgQuality: number;
  /** User satisfaction (0-1) */
  userSatisfaction: number;

  // Cost
  /** Average cost per request */
  avgCost: number;
  /** Total cost during measurement period */
  totalCost: number;

  // Cache
  /** Cache hit rate (if applicable) */
  cacheHitRate?: number;

  // Timestamp
  /** Unix timestamp (ms) */
  timestamp: number;
}

/**
 * Distribution status for a hypothesis
 */
export interface HypothesisDistribution {
  /** Hypothesis ID */
  hypothesisId: string;

  // Distribution status
  /** Current status */
  status: "distributing" | "distributed" | "testing" | "completed" | "failed";

  // Nodes
  /** Target nodes for testing */
  targetNodes: string[];
  /** Nodes that completed testing */
  completedNodes: string[];
  /** Nodes that failed to test */
  failedNodes: string[];

  // Aggregated results
  /** Results from all nodes */
  results: HypothesisResult[];

  // Final decision
  /** Final aggregated decision */
  finalDecision?: "accept" | "reject";
  /** Final confidence level */
  finalConfidence?: number;
}

/**
 * Aggregated result from multiple nodes
 */
export interface AggregatedResult {
  /** Hypothesis ID */
  hypothesisId: string;

  // By decision
  /** Count of accept decisions */
  acceptCount: number;
  /** Count of reject decisions */
  rejectCount: number;
  /** Count of inconclusive decisions */
  inconclusiveCount: number;

  // Average improvements
  /** Average improvement across nodes */
  avgImprovement: {
    latency: number;
    quality: number;
    cost: number;
  };

  // Statistical significance
  /** P-value for significance test */
  significance: number;

  // Recommendation
  /** Aggregated recommendation */
  recommendation: "accept" | "reject" | "need_more_data";
}

/**
 * Hypothesis validation metrics
 */
export interface ValidationMetrics {
  /** Total hypotheses tested */
  totalHypotheses: number;
  /** Hypotheses accepted */
  acceptedHypotheses: number;
  /** Hypotheses rejected */
  rejectedHypotheses: number;
  /** Inconclusive results */
  inconclusiveHypotheses: number;
  /** Average testing time (ms) */
  avgTestingTime: number;
  /** Average improvement across accepted hypotheses */
  avgImprovement: {
    latency: number;
    quality: number;
    cost: number;
  };
}

/**
 * Node capabilities for hypothesis testing
 */
export interface NodeCapabilities {
  /** Node ID */
  nodeId: string;
  /** Available memory (MB) */
  memoryMB: number;
  /** Available CPU cores */
  cpuCores: number;
  /** Current workload type */
  workload: WorkloadType;
  /** Whether node can test hypotheses */
  canTest: boolean;
  /** Supported hypothesis types */
  supportedHypothesisTypes: HypothesisType[];
}

/**
 * Hypothesis distribution request
 */
export interface HypothesisDistributionRequest {
  /** Hypothesis to distribute */
  hypothesis: HypothesisPacket;
  /** Target nodes (optional, auto-selected if not provided) */
  targetNodes?: string[];
  /** Priority (0-1) */
  priority: number;
  /** Timeout (ms) */
  timeout: number;
}

/**
 * Hypothesis distribution response
 */
export interface HypothesisDistributionResponse {
  /** Distribution ID */
  distributionId: string;
  /** Hypothesis ID */
  hypothesisId: string;
  /** Nodes selected for testing */
  selectedNodes: string[];
  /** Estimated completion time (ms) */
  estimatedCompletionTime: number;
  /** Status */
  status: "accepted" | "rejected" | "pending";
  /** Reason if rejected */
  rejectionReason?: string;
}
