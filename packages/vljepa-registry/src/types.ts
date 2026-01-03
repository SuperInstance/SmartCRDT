/**
 * @fileoverview Core type definitions for VL-JEPA Model Registry
 * @description Comprehensive type system for model registry, lifecycle management, deployment tracking, and lineage
 */

/**
 * Registry configuration options
 */
export interface ModelRegistryConfig {
  /** Storage backend configuration */
  storage: StorageConfig;
  /** Enable metadata validation */
  metadataValidation: boolean;
  /** Version strategy */
  versioningStrategy: VersioningStrategy;
  /** Enable auto-archiving of old versions */
  autoArchive: boolean;
  /** Maximum versions to keep per model */
  maxVersions: number;
}

/**
 * Storage backend configuration
 */
export interface StorageConfig {
  /** Storage backend type */
  type: "local" | "s3" | "hybrid";
  /** Local storage path (for local/hybrid) */
  localPath?: string;
  /** S3 configuration (for s3/hybrid) */
  s3Config?: S3Config;
  /** Enable caching */
  enableCache: boolean;
  /** Cache size in MB */
  cacheSize?: number;
}

/**
 * S3 storage configuration
 */
export interface S3Config {
  /** AWS region */
  region: string;
  /** Bucket name */
  bucket: string;
  /** Access key ID */
  accessKeyId: string;
  /** Secret access key */
  secretAccessKey: string;
  /** Key prefix */
  prefix?: string;
}

/**
 * Versioning strategy
 */
export type VersioningStrategy = "semantic" | "timestamp" | "git_hash";

/**
 * Registered model in the registry
 */
export interface RegisteredModel {
  /** Unique model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Model description */
  description: string;
  /** All versions of this model */
  versions: ModelVersion[];
  /** Model metadata */
  metadata: ModelMetadata;
  /** Creation timestamp */
  created: number;
  /** Last update timestamp */
  updated: number;
  /** Current lifecycle stage */
  stage: LifecycleStage;
  /** Tags for organization */
  tags: string[];
}

/**
 * Model version information
 */
export interface ModelVersion {
  /** Semantic version string */
  version: string;
  /** Version artifacts (weights, configs, etc.) */
  artifacts: ModelArtifact[];
  /** Performance metrics */
  metrics: ModelMetrics;
  /** Version-specific metadata */
  metadata: VersionMetadata;
  /** Creation timestamp */
  created: number;
  /** Created by (user/system) */
  createdBy: string;
  /** Is this version production-ready */
  isProduction: boolean;
  /** Is this version archived */
  isArchived: boolean;
}

/**
 * Model artifact (files associated with a version)
 */
export interface ModelArtifact {
  /** Artifact type */
  type: ArtifactType;
  /** Artifact name/path */
  name: string;
  /** Storage location */
  location: string;
  /** File size in bytes */
  size: number;
  /** Checksum for integrity */
  checksum: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Artifact types
 */
export type ArtifactType =
  | "weights"
  | "config"
  | "optimizer_state"
  | "training_data"
  | "evaluation"
  | "docker_image"
  | "onnx"
  | "quantized"
  | "other";

/**
 * Model metadata
 */
export interface ModelMetadata {
  /** Model type */
  type: ModelType;
  /** Model architecture */
  architecture: string;
  /** Framework used */
  framework: string;
  /** Input shape/dimensions */
  inputShape: number[];
  /** Output shape/dimensions */
  outputShape: number[];
  /** Parameter count */
  parameters: number;
  /** Model size in MB */
  size: number;
  /** Training dataset */
  dataset: string;
  /** Additional custom metadata */
  custom: Record<string, unknown>;
}

/**
 * Model types
 */
export type ModelType =
  | "vl_jepa"
  | "vision_transformer"
  | "language_transformer"
  | "predictor"
  | "encoder"
  | "decoder"
  | "classifier"
  | "regressor"
  | "custom";

/**
 * Version metadata
 */
export interface VersionMetadata {
  /** Training configuration */
  trainingConfig: TrainingConfig;
  /** Git commit hash */
  gitCommit?: string;
  /** Training run ID */
  runId?: string;
  /** Parent model (if fine-tuned) */
  parentModel?: ParentModel;
  /** Changelog */
  changelog: string;
  /** Performance benchmarks */
  benchmarks: Benchmark[];
  /** Additional metadata */
  custom: Record<string, unknown>;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  /** Training algorithm */
  algorithm: string;
  /** Hyperparameters */
  hyperparameters: Record<string, unknown>;
  /** Number of epochs */
  epochs: number;
  /** Batch size */
  batchSize: number;
  /** Learning rate */
  learningRate: number;
  /** Optimizer */
  optimizer: string;
  /** Loss function */
  lossFunction: string;
  /** Training duration in seconds */
  duration: number;
  /** Hardware used */
  hardware: string;
}

/**
 * Parent model (for fine-tuned models)
 */
export interface ParentModel {
  /** Parent model ID */
  id: string;
  /** Parent version */
  version: string;
  /** Fine-tuning method */
  method: string;
}

/**
 * Performance benchmark
 */
export interface Benchmark {
  /** Benchmark name */
  name: string;
  /** Benchmark value */
  value: number;
  /** Unit */
  unit: string;
  /** Dataset used */
  dataset?: string;
}

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  /** Accuracy metrics */
  accuracy: AccuracyMetrics;
  /** Latency metrics */
  latency: LatencyMetrics;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
  /** Quality metrics */
  quality: QualityMetrics;
}

/**
 * Accuracy metrics
 */
export interface AccuracyMetrics {
  /** Top-1 accuracy */
  top1: number;
  /** Top-5 accuracy */
  top5?: number;
  /** Preference accuracy (for JEPA) */
  preference?: number;
  /** Additional accuracy metrics */
  custom: Record<string, number>;
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  /** P50 latency in ms */
  p50: number;
  /** P95 latency in ms */
  p95: number;
  /** P99 latency in ms */
  p99: number;
  /** Average latency in ms */
  avg: number;
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  /** Model size in MB */
  modelSize: number;
  /** Runtime memory in MB */
  runtime: number;
  /** Peak memory in MB */
  peak: number;
  /** GPU memory in MB (if applicable) */
  gpu?: number;
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
  /** Requests per second */
  rps: number;
  /** Samples per second */
  sps?: number;
  /** Batch throughput */
  batch?: number;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  /** F1 score */
  f1?: number;
  /** Precision */
  precision?: number;
  /** Recall */
  recall?: number;
  /** AUC-ROC */
  auc?: number;
  /** Custom quality metrics */
  custom: Record<string, number>;
}

/**
 * Lifecycle stages
 */
export type LifecycleStage =
  | "development"
  | "staging"
  | "production"
  | "archived"
  | "deprecated";

/**
 * Lifecycle configuration
 */
export interface LifecycleConfig {
  /** Defined stages */
  stages: LifecycleStageConfig[];
  /** Allowed transitions */
  transitions: LifecycleTransition[];
  /** Auto-promote to next stage */
  autoPromote: boolean;
  /** Auto-archive old versions */
  autoArchive: boolean;
  /** Required approvals */
  approvals: ApprovalConfig;
}

/**
 * Lifecycle stage configuration
 */
export interface LifecycleStageConfig {
  /** Stage name */
  name: LifecycleStage;
  /** Maximum duration in stage (ms) */
  maxDuration: number;
  /** Required metrics thresholds */
  requirements: MetricRequirement[];
  /** Can deploy to production from this stage */
  canDeployToProduction: boolean;
}

/**
 * Metric requirement for stage transition
 */
export interface MetricRequirement {
  /** Metric name */
  metric: string;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max?: number;
}

/**
 * Lifecycle transition rules
 */
export interface LifecycleTransition {
  /** Source stage */
  from: LifecycleStage;
  /** Target stage */
  to: LifecycleStage;
  /** Conditions for transition */
  conditions: TransitionCondition[];
  /** Requires approval */
  approval: boolean;
  /** Approvers (empty = any admin) */
  approvers: string[];
}

/**
 * Transition condition
 */
export interface TransitionCondition {
  /** Condition type */
  type: "metric" | "time" | "manual" | "automated";
  /** Condition expression */
  condition: string;
  /** Required value */
  value: unknown;
}

/**
 * Approval configuration
 */
export interface ApprovalConfig {
  /** Enable approval system */
  enabled: boolean;
  /** Required approvers by stage */
  requiredApprovers: Record<string, number>;
  /** Approval timeout in ms */
  timeout: number;
}

/**
 * Deployment information
 */
export interface Deployment {
  /** Unique deployment ID */
  id: string;
  /** Model being deployed */
  model: string;
  /** Model version */
  version: string;
  /** Deployment environment */
  environment: DeploymentEnvironment;
  /** Deployment region */
  region?: string;
  /** Deployment timestamp */
  deployedAt: number;
  /** Deployed by (user/system) */
  deployedBy: string;
  /** Deployment status */
  status: DeploymentStatus;
  /** Post-deployment metrics */
  metrics?: DeploymentMetrics;
  /** Rollback information */
  rollback?: RollbackInfo;
  /** Deployment configuration */
  config: DeploymentConfig;
}

/**
 * Deployment environment
 */
export type DeploymentEnvironment = "development" | "staging" | "production";

/**
 * Deployment status
 */
export type DeploymentStatus =
  | "pending"
  | "deploying"
  | "success"
  | "failed"
  | "rolled_back"
  | "terminated";

/**
 * Deployment metrics (post-deployment performance)
 */
export interface DeploymentMetrics {
  /** Average latency in ms */
  latency: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Requests per second */
  throughput: number;
  /** User satisfaction (0-1) */
  userSatisfaction?: number;
  /** Cost per request */
  costPerRequest?: number;
  /** Uptime percentage */
  uptime?: number;
  /** Collected timestamp */
  collectedAt: number;
}

/**
 * Rollback information
 */
export interface RollbackInfo {
  /** Rollback timestamp */
  timestamp: number;
  /** Previous version rolled back to */
  previousVersion: string;
  /** Reason for rollback */
  reason: string;
  /** Triggered by */
  triggeredBy: string;
  /** Rollback method */
  method: "immediate" | "canary" | "blue_green";
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /** Deployment strategy */
  strategy: DeploymentStrategy;
  /** Replicas */
  replicas: number;
  /** Resource allocation */
  resources: ResourceAllocation;
  /** Autoscaling config */
  autoscaling?: AutoscalingConfig;
  /** Canary config (for canary deployments) */
  canary?: CanaryConfig;
}

/**
 * Deployment strategy
 */
export type DeploymentStrategy =
  | "rolling"
  | "blue_green"
  | "canary"
  | "immediate";

/**
 * Resource allocation
 */
export interface ResourceAllocation {
  /** CPU cores */
  cpu: number;
  /** Memory in GB */
  memory: number;
  /** GPU memory in GB */
  gpu?: number;
  /** Storage in GB */
  storage: number;
}

/**
 * Autoscaling configuration
 */
export interface AutoscalingConfig {
  /** Enable autoscaling */
  enabled: boolean;
  /** Minimum replicas */
  minReplicas: number;
  /** Maximum replicas */
  maxReplicas: number;
  /** Target CPU percentage */
  targetCPU: number;
  /** Target memory percentage */
  targetMemory: number;
}

/**
 * Canary deployment configuration
 */
export interface CanaryConfig {
  /** Initial traffic percentage (0-100) */
  initialTraffic: number;
  /** Increment step percentage */
  incrementStep: number;
  /** Increment interval in ms */
  incrementInterval: number;
  /** Success threshold */
  successThreshold: number;
}

/**
 * Model lineage information
 */
export interface ModelLineage {
  /** Model ID */
  modelId: string;
  /** Model version */
  version: string;
  /** Parent models (what this was derived from) */
  parents: ParentModel[];
  /** Child models (what was derived from this) */
  children: ChildModel[];
  /** Training information */
  training: TrainingInfo;
  /** Data information */
  data: DataInfo;
  /** Complete lineage graph */
  graph: LineageGraph;
}

/**
 * Child model (derived from this model)
 */
export interface ChildModel {
  /** Child model ID */
  id: string;
  /** Child version */
  version: string;
  /** Derivation method */
  method: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Training information for lineage
 */
export interface TrainingInfo {
  /** Training algorithm */
  algorithm: string;
  /** Hyperparameters used */
  hyperparameters: Record<string, unknown>;
  /** Dataset used */
  dataset: string;
  /** Number of epochs */
  epochs: number;
  /** Training metrics */
  metrics: TrainingMetrics;
  /** Training environment */
  environment: string;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  /** Final training loss */
  trainLoss: number;
  /** Final validation loss */
  valLoss: number;
  /** Best epoch */
  bestEpoch: number;
  /** Training time in seconds */
  trainingTime: number;
  /** Convergence epoch */
  convergenceEpoch?: number;
}

/**
 * Data information for lineage
 */
export interface DataInfo {
  /** Dataset name/version */
  dataset: string;
  /** Version */
  version: string;
  /** Number of samples */
  samples: number;
  /** Data split */
  split: "train" | "val" | "test" | "all";
  /** Preprocessing steps */
  preprocessing: PreprocessingStep[];
  /** Data sources */
  sources: DataSource[];
}

/**
 * Preprocessing step
 */
export interface PreprocessingStep {
  /** Step name */
  name: string;
  /** Step parameters */
  parameters: Record<string, unknown>;
  /** Order */
  order: number;
}

/**
 * Data source
 */
export interface DataSource {
  /** Source type */
  type: "file" | "database" | "api" | "synthetic";
  /** Source URI */
  uri: string;
  /** Version */
  version?: string;
  /** Sample count */
  samples: number;
}

/**
 * Lineage graph
 */
export interface LineageGraph {
  /** Nodes (models) */
  nodes: LineageNode[];
  /** Edges (relationships) */
  edges: LineageEdge[];
}

/**
 * Lineage graph node
 */
export interface LineageNode {
  /** Node ID (model:version) */
  id: string;
  /** Model ID */
  modelId: string;
  /** Version */
  version: string;
  /** Node type */
  type: "model" | "data" | "training";
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Lineage graph edge
 */
export interface LineageEdge {
  /** Edge ID */
  id: string;
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge type */
  type: "derived_from" | "trained_on" | "fine_tuned" | "pruned";
  /** Edge weight (confidence) */
  weight?: number;
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  /** Model A reference */
  modelA: ModelReference;
  /** Model B reference */
  modelB: ModelReference;
  /** Comparison metrics */
  metrics: ComparisonMetric[];
  /** Overall winner */
  winner: "A" | "B" | "tie";
  /** Confidence in result (0-1) */
  confidence: number;
  /** Statistical significance */
  significance: StatisticalSignificance;
  /** Recommendation */
  recommendation: string;
}

/**
 * Model reference
 */
export interface ModelReference {
  /** Model ID */
  id: string;
  /** Version */
  version: string;
  /** Display name */
  name: string;
}

/**
 * Comparison metric
 */
export interface ComparisonMetric {
  /** Metric name */
  name: string;
  /** Value for model A */
  valueA: number;
  /** Value for model B */
  valueB: number;
  /** Absolute difference */
  difference: number;
  /** Relative difference (percentage) */
  relativeDifference: number;
  /** Statistically significant */
  significant: boolean;
  /** P-value (if statistical test performed) */
  pValue?: number;
  /** Effect size */
  effectSize?: number;
  /** Better value indicates 'A' or 'B' */
  better: "A" | "B" | "tie";
}

/**
 * Statistical significance
 */
export interface StatisticalSignificance {
  /** Test performed */
  test: string;
  /** P-value */
  pValue: number;
  /** Significant at alpha=0.05 */
  significant: boolean;
  /** Effect size */
  effectSize: number;
  /** Confidence interval */
  confidenceInterval: [number, number];
}

/**
 * Drift detector configuration
 */
export interface DriftDetectorConfig {
  /** Metric to monitor */
  metric: string;
  /** Drift threshold (0-1) */
  threshold: number;
  /** Window size for comparison */
  windowSize: number;
  /** Alert on drift detection */
  alertOnDrift: boolean;
  /** Alert webhook URL */
  alertWebhook?: string;
  /** Detection method */
  method: DriftDetectionMethod;
  /** Minimum samples before detection */
  minSamples: number;
}

/**
 * Drift detection method
 */
export type DriftDetectionMethod =
  | "ks_test"
  | "chi_square"
  | "psi"
  | "kl_divergence"
  | "adaptive";

/**
 * Drift detection report
 */
export interface DriftReport {
  /** Model being monitored */
  model: string;
  /** Model version */
  version: string;
  /** Drift detected */
  detected: boolean;
  /** Type of drift */
  driftType: DriftType;
  /** Severity level */
  severity: DriftSeverity;
  /** Baseline metric value */
  baseline: number;
  /** Current metric value */
  current: number;
  /** Drift magnitude (0-1) */
  drift: number;
  /** P-value */
  pValue?: number;
  /** Timestamp of detection */
  detectedAt: number;
  /** Affected features/metrics */
  affected: string[];
  /** Recommendation */
  recommendation: DriftRecommendation;
  /** Statistical test results */
  statistics: DriftStatistics;
}

/**
 * Drift types
 */
export type DriftType = "accuracy" | "data" | "concept" | "prediction";

/**
 * Drift severity
 */
export type DriftSeverity = "low" | "medium" | "high" | "critical";

/**
 * Drift recommendation
 */
export type DriftRecommendation =
  | "monitor"
  | "retrain"
  | "rollback"
  | "investigate"
  | "replace";

/**
 * Drift statistics
 */
export interface DriftStatistics {
  /** Test statistic value */
  statistic: number;
  /** P-value */
  pValue: number;
  /** Confidence interval */
  confidenceInterval: [number, number];
  /** Effect size */
  effectSize: number;
  /** Sample size */
  sampleSize: number;
}

/**
 * Search filters for model registry
 */
export interface ModelSearchFilters {
  /** Model name (partial match) */
  name?: string;
  /** Model type */
  type?: ModelType;
  /** Lifecycle stage */
  stage?: LifecycleStage;
  /** Tags (must match all) */
  tags?: string[];
  /** Architecture */
  architecture?: string;
  /** Framework */
  framework?: string;
  /** Created after timestamp */
  createdAfter?: number;
  /** Created before timestamp */
  createdBefore?: number;
  /** Min parameter count */
  minParameters?: number;
  /** Max parameter count */
  maxParameters?: number;
  /** Has production version */
  isProduction?: boolean;
}

/**
 * Sort options for model listing
 */
export interface ModelSortOptions {
  /** Sort field */
  field: SortField;
  /** Sort order */
  order: "asc" | "desc";
}

/**
 * Sort fields
 */
export type SortField =
  | "name"
  | "created"
  | "updated"
  | "parameters"
  | "size"
  | "accuracy"
  | "latency";

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Result items */
  items: T[];
  /** Total items */
  total: number;
  /** Current page */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrevious: boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  /** Total models */
  totalModels: number;
  /** Total versions */
  totalVersions: number;
  /** Models by stage */
  modelsByStage: Record<LifecycleStage, number>;
  /** Models by type */
  modelsByType: Record<ModelType, number>;
  /** Total storage used (bytes) */
  totalStorage: number;
  /** Total deployments */
  totalDeployments: number;
  /** Active deployments */
  activeDeployments: number;
  /** Recent activity */
  recentActivity: ActivityEntry[];
}

/**
 * Activity entry
 */
export interface ActivityEntry {
  /** Activity type */
  type: "model_created" | "model_updated" | "model_deployed" | "model_rollback";
  /** Model ID */
  modelId: string;
  /** Version */
  version?: string;
  /** User */
  user: string;
  /** Timestamp */
  timestamp: number;
  /** Details */
  details: string;
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "model.registered"
  | "model.version_added"
  | "model.lifecycle_changed"
  | "model.deployed"
  | "model.rolled_back"
  | "drift.detected";

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook ID */
  id: string;
  /** Webhook URL */
  url: string;
  /** Event types to subscribe to */
  events: WebhookEventType[];
  /** Secret for signature verification */
  secret?: string;
  /** Active status */
  active: boolean;
  /** Created timestamp */
  created: number;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  /** Event type */
  type: WebhookEventType;
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Model ID */
  modelId: string;
  /** Version */
  version?: string;
  /** Event data */
  data: Record<string, unknown>;
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message */
  error?: string;
  /** Request ID for tracing */
  requestId: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Total operations */
  total: number;
  /** Successful operations */
  succeeded: number;
  /** Failed operations */
  failed: number;
  /** Errors */
  errors: BulkOperationError[];
}

/**
 * Bulk operation error
 */
export interface BulkOperationError {
  /** Operation index */
  index: number;
  /** Error message */
  error: string;
  /** Item ID */
  itemId?: string;
}
