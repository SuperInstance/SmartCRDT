/**
 * Federated Learning Protocol Types
 *
 * Comprehensive types for privacy-preserving distributed machine learning including:
 * - Federated training configuration and orchestration
 * - Model updates and gradient sharing
 * - Aggregation strategies (FedAvg, FedAvgM, FedProx)
 * - Privacy mechanisms (ε-DP, secure aggregation)
 * - Byzantine resilience and validation
 *
 * Federated learning enables collaborative model training without centralizing data,
 * a core principle of Aequor's sovereign AI philosophy.
 *
 * @module federated
 */

// Import and re-export enums from other modules
import { AggregationStrategy } from "./handshake.js";
import { NoiseMechanismType } from "./differential-privacy.js";

export { AggregationStrategy, NoiseMechanismType };

// ============================================================================
// CORE CONFIGURATION TYPES
// ============================================================================

/**
 * Federated learning configuration
 *
 * Defines how federated training rounds are orchestrated, including
 * participation requirements, aggregation strategy, and privacy parameters.
 */
export interface FederatedConfig {
  /** Number of training rounds to execute */
  rounds: number;
  /** Minimum number of clients required per round */
  minClients: number;
  /** Maximum number of clients to select per round */
  maxClients: number;
  /** Fraction of clients to sample each round (0-1) */
  clientFraction: number;
  /** Number of local training epochs per client */
  localEpochs: number;
  /** Local batch size for training */
  localBatchSize: number;
  /** Learning rate for local training */
  learningRate: number;
  /** Aggregation strategy to use */
  aggregation: AggregationStrategy;
  /** Privacy configuration */
  privacy?: FederatedPrivacyConfig;
  /** Client selection strategy */
  clientSelection: ClientSelectionStrategy;
  /** Validation configuration */
  validation?: FederatedValidationConfig;
  /** Communication configuration */
  communication?: CommunicationConfig;
}

/**
 * Privacy configuration for federated learning
 *
 * Defines differential privacy parameters and secure aggregation settings.
 */
export interface FederatedPrivacyConfig {
  /** Enable differential privacy for model updates */
  enableDP: boolean;
  /** Privacy parameter ε (lower = more private) */
  epsilon?: number;
  /** Failure probability δ (for Gaussian DP) */
  delta?: number;
  /** Noise mechanism type */
  noiseMechanism?: NoiseMechanismType;
  /** Client-level privacy (vs sample-level) */
  clientLevelDP: boolean;
  /** Enable secure aggregation (prevent server from seeing individual updates) */
  enableSecureAggregation: boolean;
  /** Gradient compression ratio (0-1, 1 = no compression) */
  compressionRatio: number;
  /** Clipping threshold for gradient norms */
  clippingNorm?: number;
}

/**
 * Client selection strategy
 *
 * Defines how clients are chosen for each training round.
 */
export enum ClientSelectionStrategy {
  /** Random uniform sampling */
  RANDOM = "random",
  /** Sample based on data quality/quantity */
  WEIGHTED = "weighted",
  /** Cyclic selection for fairness */
  CYCLIC = "cyclic",
  /** Prefer clients with recent updates */
  TEMPORAL = "temporal",
  /** Stratified sampling for data distribution */
  STRATIFIED = "stratified",
}

/**
 * Validation configuration for federated learning
 *
 * Defines how to validate client updates and detect Byzantine failures.
 */
export interface FederatedValidationConfig {
  /** Enable Byzantine resilience */
  enableByzantineResilience: boolean;
  /** Maximum allowed update norm (for outlier rejection) */
  maxUpdateNorm: number;
  /** Minimum allowed update norm */
  minUpdateNorm: number;
  /** Number of standard deviations for outlier detection */
  outlierStdDevThreshold: number;
  /** Robust aggregation method */
  robustMethod?: RobustAggregationMethod;
  /** Enable update similarity check */
  enableSimilarityCheck: boolean;
  /** Minimum cosine similarity threshold */
  minCosineSimilarity: number;
}

/**
 * Robust aggregation methods for Byzantine resilience
 */
export enum RobustAggregationMethod {
  /** Krum - distance-based outlier detection */
  KRUM = "krum",
  /** Multi-Krum - multiple updates from Krum */
  MULTI_KRUM = "multi_krum",
  /** Trimmed Mean - remove largest and smallest updates */
  TRIMMED_MEAN = "trimmed_mean",
  /** Median - use median instead of mean */
  MEDIAN = "median",
  /** Coordinate-wise Median - median per parameter */
  COORDINATE_MEDIAN = "coordinate_median",
  /** Federated Averaging with Byzantine-Robust Aggregation */
  FEDBAR = "fedbar",
}

/**
 * Communication configuration
 *
 * Defines how clients communicate with the server.
 */
export interface CommunicationConfig {
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Communication timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable gradient compression */
  enableCompression: boolean;
  /** Compression method */
  compressionMethod?: CompressionMethod;
  /** Compression ratio (0-1) */
  compressionRatio: number;
}

/**
 * Gradient compression methods
 */
export enum CompressionMethod {
  /** Top-k sparsification */
  TOPK = "topk",
  /** Random sparsification */
  RANDOM = "random",
  /** Quantization */
  QUANTIZATION = "quantization",
  /** Lossy compression (e.g., Golomb encoding) */
  LOSSY = "lossy",
}

// ============================================================================
// MODEL UPDATE TYPES
// ============================================================================

/**
 * Model update from a client
 *
 * Contains the parameter updates (gradients or weight deltas) generated
 * by local training on private data.
 */
export interface ModelUpdate {
  /** Unique client identifier */
  clientId: string;
  /** Round identifier */
  roundId: string;
  /** Timestamp of update generation */
  timestamp: number;
  /** Number of local training examples */
  numExamples: number;
  /** Number of local epochs performed */
  numEpochs: number;
  /** Weight deltas/updates (flattened or structured) */
  weightDeltas: number[] | Float32Array;
  /** Weight deltas structure info (for reshaping) */
  weightShape?: number[][];
  /** Gradients (optional, if not using weight deltas) */
  gradients?: number[] | Float32Array;
  /** Local training metrics */
  metrics: ClientMetrics;
  /** Privacy metadata */
  privacy?: UpdatePrivacyMetadata;
  /** Update signature (for verification) */
  signature?: string;
  /** Compression metadata */
  compression?: CompressionMetadata;
}

/**
 * Client training metrics
 *
 * Performance metrics from local training.
 */
export interface ClientMetrics {
  /** Training loss */
  loss: number;
  /** Training accuracy (if applicable) */
  accuracy?: number;
  /** Number of batches processed */
  numBatches: number;
  /** Training time in milliseconds */
  trainingTime: number;
  /** Validation loss (if validation performed) */
  valLoss?: number;
  /** Validation accuracy */
  valAccuracy?: number;
  /** Additional custom metrics */
  customMetrics?: Record<string, number>;
}

/**
 * Privacy metadata for model updates
 *
 * Records the privacy budget consumed and mechanisms applied.
 */
export interface UpdatePrivacyMetadata {
  /** ε consumed for this update */
  epsilonSpent: number;
  /** δ consumed (for Gaussian DP) */
  deltaSpent: number;
  /** Noise mechanism used */
  noiseMechanism: NoiseMechanismType;
  /** Whether clipping was applied */
  clipped: boolean;
  /** Clipping threshold used */
  clippingNorm?: number;
  /** Noise multiplier applied */
  noiseMultiplier?: number;
  /** Whether secure aggregation was used */
  secureAggregation: boolean;
}

/**
 * Compression metadata
 *
 * Records compression parameters for decompression.
 */
export interface CompressionMetadata {
  /** Compression method used */
  method: CompressionMethod;
  /** Compression ratio achieved */
  ratio: number;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Sparsity (for sparsification methods) */
  sparsity?: number;
  /** Quantization bits (for quantization) */
  quantizationBits?: number;
}

// ============================================================================
// AGGREGATION RESULT TYPES
// ============================================================================

/**
 * Aggregation result from server
 *
 * Contains the aggregated model update and contribution scores.
 */
export interface AggregationResult {
  /** Round identifier */
  roundId: string;
  /** Timestamp of aggregation */
  timestamp: number;
  /** Number of clients that participated */
  numClients: number;
  /** Number of clients selected (may differ from participated) */
  numClientsSelected: number;
  /** Aggregated weight updates */
  aggregatedWeights: number[] | Float32Array;
  /** Weight structure info */
  weightShape?: number[][];
  /** Global model weights after aggregation */
  globalWeights: number[] | Float32Array;
  /** Contribution scores per client */
  contributionScores: Map<string, number>;
  /** Aggregation metrics */
  metrics: AggregationMetrics;
  /** Validation results */
  validation?: AggregationValidation;
  /** Privacy budget consumed this round */
  privacyConsumed?: PrivacyConsumption;
}

/**
 * Aggregation metrics
 *
 * Performance and quality metrics for the aggregation process.
 */
export interface AggregationMetrics {
  /** Total aggregation time in milliseconds */
  aggregationTime: number;
  /** Average communication time per client */
  avgCommunicationTime: number;
  /** Maximum update norm across clients */
  maxUpdateNorm: number;
  /** Minimum update norm across clients */
  minUpdateNorm: number;
  /** Average update norm */
  avgUpdateNorm: number;
  /** Standard deviation of update norms */
  stdUpdateNorm: number;
  /** Number of updates rejected */
  numRejected: number;
  /** Number of updates accepted */
  numAccepted: number;
  /** Convergence metric (e.g., change in loss) */
  convergenceMetric?: number;
}

/**
 * Aggregation validation results
 *
 * Results from validating client updates.
 */
export interface AggregationValidation {
  /** Number of outliers detected */
  numOutliers: number;
  /** List of rejected client IDs */
  rejectedClients: string[];
  /** Rejection reasons per client */
  rejectionReasons: Map<string, RejectionReason>;
  /** Average cosine similarity of updates */
  avgCosineSimilarity: number;
  /** Robust aggregation used */
  robustMethod?: RobustAggregationMethod;
}

/**
 * Reason for rejecting a client update
 */
export enum RejectionReason {
  /** Update norm too large */
  NORM_TOO_LARGE = "norm_too_large",
  /** Update norm too small */
  NORM_TOO_SMALL = "norm_too_small",
  /** Outlier detected by robust method */
  OUTLIER = "outlier",
  /** Low similarity with other updates */
  LOW_SIMILARITY = "low_similarity",
  /** Signature verification failed */
  SIGNATURE_INVALID = "signature_invalid",
  /** Timeout */
  TIMEOUT = "timeout",
  /** Communication error */
  COMMUNICATION_ERROR = "communication_error",
  /** Malicious behavior detected */
  MALICIOUS = "malicious",
}

/**
 * Privacy consumption tracking
 *
 * Tracks privacy budget consumption across rounds.
 */
export interface PrivacyConsumption {
  /** Total ε spent this round */
  epsilonSpent: number;
  /** Total δ spent this round */
  deltaSpent: number;
  /** Cumulative ε spent across all rounds */
  cumulativeEpsilon: number;
  /** Cumulative δ spent across all rounds */
  cumulativeDelta: number;
  /** ε remaining */
  epsilonRemaining: number;
  /** δ remaining */
  deltaRemaining: number;
}

// ============================================================================
// FEDERATED ROUND TYPES
// ============================================================================

/**
 * Federated training round
 *
 * Represents a single round of federated training, including
 * client selection, update collection, and aggregation.
 */
export interface FederatedRound {
  /** Round identifier */
  roundId: string;
  /** Round number (1-indexed) */
  roundNumber: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp (0 if not completed) */
  endTime: number;
  /** Round status */
  status: RoundStatus;
  /** Clients selected for this round */
  selectedClients: string[];
  /** Clients that submitted updates */
  participatingClients: string[];
  /** Client updates received */
  updates: ModelUpdate[];
  /** Aggregation result (if completed) */
  result?: AggregationResult;
  /** Round configuration */
  config: FederatedConfig;
  /** Global model version before this round */
  modelVersionBefore: string;
  /** Global model version after this round */
  modelVersionAfter?: string;
  /** Round metrics */
  metrics: RoundMetrics;
}

/**
 * Round status
 */
export enum RoundStatus {
  /** Round is pending (not started) */
  PENDING = "pending",
  /** Round is in progress (collecting updates) */
  IN_PROGRESS = "in_progress",
  /** Round completed successfully */
  COMPLETED = "completed",
  /** Round failed (e.g., not enough clients) */
  FAILED = "failed",
  /** Round was cancelled */
  CANCELLED = "cancelled",
}

/**
 * Round metrics
 *
 * Performance metrics for a single training round.
 */
export interface RoundMetrics {
  /** Number of clients selected */
  numClientsSelected: number;
  /** Number of clients that participated */
  numClientsParticipated: number;
  /** Total number of training examples */
  totalExamples: number;
  /** Round duration in milliseconds */
  duration: number;
  /** Average client training time */
  avgClientTrainingTime: number;
  /** Average communication time */
  avgCommunicationTime: number;
  /** Aggregation time */
  aggregationTime: number;
  /** Total communication cost in bytes */
  communicationCost: number;
  /** Training loss */
  loss: number;
  /** Validation loss (if available) */
  valLoss?: number;
  /** Accuracy (if available) */
  accuracy?: number;
  /** Convergence rate */
  convergenceRate?: number;
}

// ============================================================================
// CLIENT STATE TYPES
// ============================================================================

/**
 * Federated client state
 *
 * Represents the state of a federated learning client.
 */
export interface FederatedClientState {
  /** Client identifier */
  clientId: string;
  /** Current round number */
  currentRound: number;
  /** Local model weights */
  localWeights: number[] | Float32Array;
  /** Local model version */
  modelVersion: string;
  /** Number of training examples available */
  numExamples: number;
  /** Last update timestamp */
  lastUpdateTimestamp: number;
  /** Client status */
  status: ClientStatus;
  /** Training statistics */
  statistics: ClientStatistics;
  /** Privacy budget state */
  privacyBudget?: ClientPrivacyBudget;
}

/**
 * Client status
 */
export enum ClientStatus {
  /** Client is idle (not participating) */
  IDLE = "idle",
  /** Client is training locally */
  TRAINING = "training",
  /** Client is uploading update */
  UPLOADING = "uploading",
  /** Client is downloading global model */
  DOWNLOADING = "downloading",
  /** Client is unavailable (offline) */
  UNAVAILABLE = "unavailable",
}

/**
 * Client training statistics
 *
 * Aggregated statistics for a client across rounds.
 */
export interface ClientStatistics {
  /** Total number of rounds participated */
  totalRounds: number;
  /** Total number of training examples contributed */
  totalExamples: number;
  /** Average training time per round */
  avgTrainingTime: number;
  /** Total communication cost in bytes */
  totalCommunicationCost: number;
  /** Average loss per round */
  avgLoss: number;
  /** Best accuracy achieved */
  bestAccuracy?: number;
}

/**
 * Client privacy budget
 *
 * Tracks privacy budget for a client.
 */
export interface ClientPrivacyBudget {
  /** Total ε allocated */
  totalEpsilon: number;
  /** Total δ allocated */
  totalDelta: number;
  /** ε spent so far */
  epsilonSpent: number;
  /** δ spent so far */
  deltaSpent: number;
  /** Number of rounds participated */
  roundsParticipated: number;
}

// ============================================================================
// SERVER STATE TYPES
// ============================================================================

/**
 * Federated server state
 *
 * Represents the state of the federated learning server.
 */
export interface FederatedServerState {
  /** Server identifier */
  serverId: string;
  /** Current round number */
  currentRound: number;
  /** Total number of rounds configured */
  totalRounds: number;
  /** Global model weights */
  globalWeights: number[] | Float32Array;
  /** Global model version */
  modelVersion: string;
  /** Connected clients */
  clients: Map<string, FederatedClientState>;
  /** Training history */
  history: FederatedRound[];
  /** Server status */
  status: ServerStatus;
  /** Server configuration */
  config: FederatedConfig;
  /** Privacy budget tracker */
  privacyBudget?: ServerPrivacyBudget;
  /** Server statistics */
  statistics: ServerStatistics;
}

/**
 * Server status
 */
export enum ServerStatus {
  /** Server is idle (between rounds) */
  IDLE = "idle",
  /** Server is running a round */
  RUNNING = "running",
  /** Server is aggregating updates */
  AGGREGATING = "aggregating",
  /** Server is stopped */
  STOPPED = "stopped",
  /** Server encountered an error */
  ERROR = "error",
}

/**
 * Server privacy budget
 *
 * Tracks privacy budget across all clients and rounds.
 */
export interface ServerPrivacyBudget {
  /** Total ε allocated across all clients */
  totalEpsilon: number;
  /** Total δ allocated across all clients */
  totalDelta: number;
  /** ε spent so far */
  epsilonSpent: number;
  /** δ spent so far */
  deltaSpent: number;
  /** Number of rounds completed */
  roundsCompleted: number;
  /** ε per round limit */
  epsilonPerRound: number;
  /** δ per round limit */
  deltaPerRound: number;
}

/**
 * Server statistics
 *
 * Aggregated statistics for the server across all rounds.
 */
export interface ServerStatistics {
  /** Total number of rounds completed */
  totalRoundsCompleted: number;
  /** Total number of client participations */
  totalClientParticipations: number;
  /** Average clients per round */
  avgClientsPerRound: number;
  /** Total communication cost in bytes */
  totalCommunicationCost: number;
  /** Average round duration */
  avgRoundDuration: number;
  /** Final training loss */
  finalLoss?: number;
  /** Best validation loss */
  bestValLoss?: number;
  /** Best validation accuracy */
  bestValAccuracy?: number;
  /** Total training time in milliseconds */
  totalTrainingTime: number;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Federated learning message types
 *
 * Messages exchanged between server and clients.
 */
export type FederatedMessage =
  | TrainRequest
  | TrainResponse
  | UpdateSubmission
  | UpdateAcknowledgment
  | RoundComplete
  | ErrorMessage;

/**
 * Request for client to participate in training round
 */
export interface TrainRequest {
  /** Message type */
  type: "train_request";
  /** Round identifier */
  roundId: string;
  /** Round number */
  roundNumber: number;
  /** Global model weights */
  globalWeights: number[] | Float32Array;
  /** Model version */
  modelVersion: string;
  /** Training configuration */
  config: FederatedConfig;
  /** Server signature */
  serverSignature?: string;
}

/**
 * Response from client acknowledging training request
 */
export interface TrainResponse {
  /** Message type */
  type: "train_response";
  /** Client identifier */
  clientId: string;
  /** Round identifier */
  roundId: string;
  /** Accepted training request */
  accepted: boolean;
  /** Rejection reason (if not accepted) */
  rejectionReason?: string;
  /** Estimated training time */
  estimatedTime?: number;
  /** Client signature */
  clientSignature?: string;
}

/**
 * Submission of model update from client to server
 */
export interface UpdateSubmission {
  /** Message type */
  type: "update_submission";
  /** Client identifier */
  clientId: string;
  /** Round identifier */
  roundId: string;
  /** Model update */
  update: ModelUpdate;
  /** Client signature */
  clientSignature?: string;
}

/**
 * Acknowledgment from server for received update
 */
export interface UpdateAcknowledgment {
  /** Message type */
  type: "update_acknowledgment";
  /** Client identifier */
  clientId: string;
  /** Round identifier */
  roundId: string;
  /** Update received successfully */
  received: boolean;
  /** Update accepted (passed validation) */
  accepted: boolean;
  /** Rejection reason (if not accepted) */
  rejectionReason?: RejectionReason;
  /** Contribution score */
  contributionScore?: number;
  /** Server signature */
  serverSignature?: string;
}

/**
 * Notification that round is complete
 */
export interface RoundComplete {
  /** Message type */
  type: "round_complete";
  /** Round identifier */
  roundId: string;
  /** Round number */
  roundNumber: number;
  /** Aggregation result */
  result: AggregationResult;
  /** New global model weights */
  newGlobalWeights: number[] | Float32Array;
  /** New model version */
  newModelVersion: string;
  /** Whether training is complete */
  trainingComplete: boolean;
  /** Server signature */
  serverSignature?: string;
}

/**
 * Error message
 */
export interface ErrorMessage {
  /** Message type */
  type: "error";
  /** Error code */
  errorCode: number;
  /** Error message */
  errorMessage: string;
  /** Round identifier (if applicable) */
  roundId?: string;
  /** Client identifier (if applicable) */
  clientId?: string;
  /** Server signature */
  serverSignature?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Federated training result
 *
 * Final result after completing all training rounds.
 */
export interface FederatedTrainingResult {
  /** Whether training completed successfully */
  success: boolean;
  /** Total number of rounds completed */
  roundsCompleted: number;
  /** Total number of rounds configured */
  totalRounds: number;
  /** Final global model weights */
  finalWeights: number[] | Float32Array;
  /** Final model version */
  finalModelVersion: string;
  /** Training history */
  history: FederatedRound[];
  /** Server statistics */
  statistics: ServerStatistics;
  /** Total privacy budget consumed */
  privacyConsumed: PrivacyConsumption;
  /** Training duration in milliseconds */
  trainingDuration: number;
  /** Final loss */
  finalLoss: number;
  /** Final accuracy (if available) */
  finalAccuracy?: number;
  /** Error message (if training failed) */
  errorMessage?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Weight structure information
 *
 * Describes the shape/structure of model weights for reshaping.
 */
export interface WeightStructure {
  /** Layer names */
  layerNames: string[];
  /** Shapes per layer */
  shapes: number[][];
  /** Total number of parameters */
  totalParams: number;
}

/**
 * Client eligibility criteria
 *
 * Defines requirements for clients to participate in training.
 */
export interface ClientEligibility {
  /** Minimum number of training examples */
  minExamples: number;
  /** Maximum latency allowed (ms) */
  maxLatency: number;
  /** Required compute capability */
  minComputeCapability?: number;
  /** Required battery level (for mobile) */
  minBatteryLevel?: number;
  /** Required network bandwidth (bytes/s) */
  minBandwidth?: number;
}

/**
 * Secure aggregation protocol
 *
 * Defines parameters for secure aggregation.
 */
export interface SecureAggregationProtocol {
  /** Protocol type */
  protocol: SecureAggregationType;
  /** Number of clients for pairwise masking */
  numPairs?: number;
  /** Encryption scheme */
  encryption?: EncryptionScheme;
  /** Threshold for reconstruction */
  threshold?: number;
}

/**
 * Secure aggregation types
 */
export enum SecureAggregationType {
  /** Pairwise masking */
  PAIRWISE_MASKING = "pairwise_masking",
  /** Secret sharing */
  SECRET_SHARING = "secret_sharing",
  /** Homomorphic encryption */
  HOMOMORPHIC = "homomorphic",
}

/**
 * Encryption schemes for secure aggregation
 */
export enum EncryptionScheme {
  /** Paillier encryption */
  PAILLIER = "paillier",
  /** ElGamal encryption */
  ELGAMAL = "elgamal",
  /** EC-ElGamal encryption */
  EC_ELGAMAL = "ec_elgamal",
}
