/**
 * @file Federated Learning Protocol
 * 
 * Protocol types and interfaces for federated learning coordination between
 * server and clients. Supports privacy-preserving distributed training with
 * epsilon-differential privacy.
 * 
 * Key Concepts:
 * - FederatedCoordination: Server-side coordination of training rounds
 * - ClientConfig: Client configuration and capabilities
 * - ModelUpdate: Client model updates sent to server
 * - PrivacyBudget: Epsilon-differential privacy tracking
 * 
 * @module federated-learning
 */

// ============================================================================
// CORE FEDERATED LEARNING TYPES
// ============================================================================

/**
 * Federated learning round identifier
 */
export type RoundId = string;

/**
 * Client identifier
 */
export type ClientId = string;

/**
 * Model identifier
 */
export type ModelId = string;

/**
 * Training round phase
 */
export enum RoundPhase {
  /** Round is initializing */
  INITIALIZING = "initializing",
  /** Selecting clients for training */
  SELECTING_CLIENTS = "selecting_clients",
  /** Clients are training locally */
  TRAINING = "training",
  /** Aggregating model updates */
  AGGREGATING = "aggregating",
  /** Round completed successfully */
  COMPLETED = "completed",
  /** Round failed */
  FAILED = "failed",
}

/**
 * Client training status
 */
export enum ClientStatus {
  /** Client is idle, available for training */
  IDLE = "idle",
  /** Client is currently training */
  TRAINING = "training",
  /** Client has completed training */
  COMPLETED = "completed",
  /** Client training failed */
  FAILED = "failed",
  /** Client is disconnected */
  DISCONNECTED = "disconnected",
}

/**
 * Aggregation strategy for combining model updates
 */
export enum AggregationStrategy {
  /** Federated Averaging (FedAvg) - weighted average of updates */
  FEDAVG = "fedavg",
  /** Federated Proximal (FedProx) - proximal term added to FedAvg */
  FEDPROX = "fedprox",
  /** FedAvg with adaptive weighting based on client quality */
  ADAPTIVE_FEDAVG = "adaptive_fedavg",
  /** Secure aggregation with cryptographic protocols */
  SECURE_AGGREGATION = "secure_aggregation",
}

/**
 * Client selection strategy
 */
export enum ClientSelectionStrategy {
  /** Random uniform selection */
  RANDOM = "random",
  /** Selection based on data quality */
  QUALITY_BASED = "quality_based",
  /** Selection based on resource availability */
  RESOURCE_BASED = "resource_based",
  /** Cyclic selection for fairness */
  CYCLIC = "cyclic",
  /** Priority-based selection */
  PRIORITY = "priority",
}

/**
 * Privacy budget tracking for federated learning
 */
export interface PrivacyBudget {
  /** Remaining epsilon budget */
  epsilon_remaining: number;
  /** Remaining delta budget */
  delta_remaining: number;
  /** Epsilon spent so far */
  epsilon_spent: number;
  /** Delta spent so far */
  delta_spent: number;
  /** Total allocated epsilon */
  epsilon_total: number;
  /** Total allocated delta */
  delta_total: number;
}

/**
 * Privacy cost of a training operation
 */
export interface PrivacyCost {
  /** Epsilon consumed */
  epsilon: number;
  /** Delta consumed */
  delta: number;
}

/**
 * Differential privacy configuration for federated learning
 */
export interface DifferentialPrivacyConfig {
  /** Total epsilon budget for the entire training process */
  total_epsilon: number;
  /** Total delta budget for the entire training process */
  total_delta: number;
  /** Client-wise epsilon allocation */
  client_epsilon: number;
  /** Client-wise delta allocation */
  client_delta: number;
  /** Noise multiplier for gradients */
  noise_multiplier: number;
  /** Gradient clipping norm */
  clipping_norm: number;
  /** Enable secure aggregation */
  secure_aggregation?: boolean;
  /** Enable adaptive noise based on client contribution */
  adaptive_noise?: boolean;
}

/**
 * Model parameters as a flat array
 */
export type ModelParameters = Float32Array | Float64Array | number[];

/**
 * Model update from a client
 */
export interface ModelUpdate {
  /** Client ID */
  client_id: ClientId;
  /** Round ID */
  round_id: RoundId;
  /** Model parameters update (difference from global model) */
  update: ModelParameters;
  /** Number of training examples used */
  num_examples: number;
  /** Training metrics */
  metrics: TrainingMetrics;
  /** Privacy cost incurred */
  privacy_cost: PrivacyCost;
  /** Timestamp when training completed */
  timestamp: number;
  /** Local training epochs */
  local_epochs: number;
  /** Client capabilities snapshot */
  capabilities: ClientCapabilities;
}

/**
 * Training metrics from client
 */
export interface TrainingMetrics {
  /** Training loss */
  loss: number;
  /** Training accuracy (for classification) */
  accuracy?: number;
  /** Validation loss */
  validation_loss?: number;
  /** Validation accuracy */
  validation_accuracy?: number;
  /** Number of local epochs completed */
  epochs_completed: number;
  /** Number of batches processed */
  batches_processed: number;
  /** Training duration in milliseconds */
  training_duration_ms: number;
  /** Additional metrics */
  additional?: Record<string, number>;
}

/**
 * Client configuration for federated learning
 */
export interface ClientConfig {
  /** Client ID */
  client_id: ClientId;
  /** Maximum number of local epochs */
  max_local_epochs: number;
  /** Local batch size */
  local_batch_size: number;
  /** Local learning rate */
  local_learning_rate: number;
  /** Privacy budget for this client */
  privacy_budget: PrivacyBudget;
  /** Client capabilities */
  capabilities: ClientCapabilities;
  /** Preferred aggregation strategy */
  preferred_aggregation?: AggregationStrategy;
}

/**
 * Client capabilities and resources
 */
export interface ClientCapabilities {
  /** Available compute resource (0-1) */
  compute_capacity: number;
  /** Available memory resource (0-1) */
  memory_capacity: number;
  /** Network bandwidth estimate (MB/s) */
  network_bandwidth_mbps: number;
  /** Battery level (0-1) for mobile devices */
  battery_level?: number;
  /** Is device charging */
  is_charging?: boolean;
  /** Data quality estimate (0-1) */
  data_quality: number;
  /** Number of training examples available */
  num_examples: number;
  /** Supported aggregation strategies */
  supported_strategies: AggregationStrategy[];
  /** Maximum supported model size */
  max_model_size_bytes: number;
  /** Latency tolerance (ms) */
  latency_tolerance_ms: number;
}

/**
 * Federated learning round configuration
 */
export interface RoundConfig {
  /** Round ID */
  round_id: RoundId;
  /** Global model ID */
  model_id: ModelId;
  /** Round number */
  round_number: number;
  /** Target number of clients to select */
  target_clients: number;
  /** Minimum clients required to proceed */
  min_clients: number;
  /** Maximum number of local epochs per client */
  max_local_epochs: number;
  /** Local batch size */
  local_batch_size: number;
  /** Local learning rate */
  local_learning_rate: number;
  /** Aggregation strategy */
  aggregation_strategy: AggregationStrategy;
  /** Client selection strategy */
  selection_strategy: ClientSelectionStrategy;
  /** Differential privacy configuration */
  privacy: DifferentialPrivacyConfig;
  /** Timeout for client training (ms) */
  training_timeout_ms: number;
  /** Timeout for aggregation (ms) */
  aggregation_timeout_ms: number;
}

/**
 * Round state and progress
 */
export interface RoundState {
  /** Round configuration */
  config: RoundConfig;
  /** Current phase */
  phase: RoundPhase;
  /** Selected clients */
  selected_clients: ClientId[];
  /** Clients that completed training */
  completed_clients: ClientId[];
  /** Clients that failed */
  failed_clients: ClientId[];
  /** Model updates received */
  updates: ModelUpdate[];
  /** Aggregated model */
  aggregated_model?: ModelParameters;
  /** Privacy budget spent this round */
  privacy_spent: PrivacyCost;
  /** Round start time */
  start_time: number;
  /** Round end time */
  end_time?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Server state for federated coordination
 */
export interface ServerState {
  /** Current global model */
  global_model: ModelParameters;
  /** Current model ID */
  model_id: ModelId;
  /** Current round number */
  current_round: number;
  /** Active round state */
  active_round?: RoundState;
  /** Registered clients */
  clients: Map<ClientId, ClientConfig>;
  /** Round history */
  round_history: RoundHistoryEntry[];
  /** Total privacy budget */
  privacy_budget: PrivacyBudget;
  /** Server capabilities */
  capabilities: ServerCapabilities;
  /** Training statistics */
  statistics: TrainingStatistics;
}

/**
 * Server capabilities
 */
export interface ServerCapabilities {
  /** Supported aggregation strategies */
  supported_strategies: AggregationStrategy[];
  /** Maximum concurrent clients */
  max_concurrent_clients: number;
  /** Maximum rounds before model reset */
  max_rounds: number;
  /** Secure aggregation enabled */
  secure_aggregation: boolean;
  /** Compression enabled for model updates */
  compression_enabled: boolean;
  /** Maximum model size */
  max_model_size_bytes: number;
}

/**
 * Round history entry
 */
export interface RoundHistoryEntry {
  /** Round number */
  round_number: number;
  /** Round ID */
  round_id: RoundId;
  /** Number of clients participated */
  num_clients: number;
  /** Aggregation strategy used */
  strategy: AggregationStrategy;
  /** Privacy cost */
  privacy_cost: PrivacyCost;
  /** Training loss */
  loss: number;
  /** Training accuracy */
  accuracy?: number;
  /** Round duration (ms) */
  duration_ms: number;
  /** Timestamp */
  timestamp: number;
  /** Round result */
  result: "success" | "partial" | "failed";
}

/**
 * Training statistics across rounds
 */
export interface TrainingStatistics {
  /** Total rounds completed */
  total_rounds: number;
  /** Total clients participated */
  total_clients: number;
  /** Total privacy spent */
  total_privacy_spent: PrivacyCost;
  /** Average training loss per round */
  average_loss: number;
  /** Average accuracy per round */
  average_accuracy?: number;
  /** Average round duration (ms) */
  average_round_duration_ms: number;
  /** Client participation statistics */
  participation_stats: ParticipationStatistics;
}

/**
 * Client participation statistics
 */
export interface ParticipationStatistics {
  /** Number of unique clients that participated */
  unique_clients: number;
  /** Average clients per round */
  average_clients_per_round: number;
  /** Client participation frequency */
  participation_frequency: Map<ClientId, number>;
  /** Average client completion rate */
  average_completion_rate: number;
}

/**
 * Client state for local training
 */
export interface ClientState {
  /** Client configuration */
  config: ClientConfig;
  /** Current local model */
  local_model: ModelParameters;
  /** Current round ID */
  current_round_id?: RoundId;
  /** Training status */
  status: ClientStatus;
  /** Privacy budget */
  privacy_budget: PrivacyBudget;
  /** Local training metrics */
  metrics: TrainingMetrics;
  /** Last update sent */
  last_update?: ModelUpdate;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Server to client: Training request
 */
export interface TrainingRequest {
  /** Request ID */
  request_id: string;
  /** Round configuration */
  round_config: RoundConfig;
  /** Current global model */
  global_model: ModelParameters;
  /** Privacy allocation for this round */
  privacy_allocation: PrivacyCost;
  /** Timestamp */
  timestamp: number;
  /** Request expiration time */
  expires_at: number;
}

/**
 * Client to server: Training response (model update)
 */
export interface TrainingResponse {
  /** Request ID being responded to */
  request_id: string;
  /** Client ID */
  client_id: ClientId;
  /** Round ID */
  round_id: RoundId;
  /** Model update */
  update: ModelUpdate;
  /** Success flag */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Server to client: Round completion notification
 */
export interface RoundCompletionNotification {
  /** Round ID */
  round_id: RoundId;
  /** Round number */
  round_number: number;
  /** Whether round was successful */
  success: boolean;
  /** Aggregated model (if client was selected) */
  aggregated_model?: ModelParameters;
  /** Global model update */
  global_model?: ModelParameters;
  /** Privacy spent by all clients */
  total_privacy_spent: PrivacyCost;
  /** Timestamp */
  timestamp: number;
}

/**
 * Client to server: Registration request
 */
export interface RegistrationRequest {
  /** Client ID (generated if not provided) */
  client_id?: ClientId;
  /** Client capabilities */
  capabilities: ClientCapabilities;
  /** Preferred configuration */
  preferences?: {
    max_local_epochs?: number;
    preferred_aggregation?: AggregationStrategy;
  };
  /** Timestamp */
  timestamp: number;
}

/**
 * Server to client: Registration response
 */
export interface RegistrationResponse {
  /** Assigned client ID */
  client_id: ClientId;
  /** Success flag */
  success: boolean;
  /** Server capabilities */
  server_capabilities: ServerCapabilities;
  /** Initial privacy budget */
  privacy_budget: PrivacyBudget;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Heartbeat from client to server
 */
export interface ClientHeartbeat {
  /** Client ID */
  client_id: ClientId;
  /** Current status */
  status: ClientStatus;
  /** Current capabilities */
  capabilities: ClientCapabilities;
  /** Privacy budget remaining */
  privacy_remaining: PrivacyCost;
  /** Current round if training */
  current_round_id?: RoundId;
  /** Timestamp */
  timestamp: number;
}

/**
 * Heartbeat acknowledgment from server
 */
export interface HeartbeatAck {
  /** Client ID */
  client_id: ClientId;
  /** Server status */
  server_status: {
    /** Current round */
    current_round?: RoundId;
    /** Server load (0-1) */
    server_load: number;
  };
  /** Action requested from client */
  action:
    /** Wait for training request */
    | "wait"
    /** Disconnect (e.g., privacy budget exhausted) */
    | "disconnect"
    /** Update capabilities */
    | "update_capabilities";
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// FEDERATED COORDINATION INTERFACE
// ============================================================================

/**
 * Federated coordination interface
 * 
 * Defines server-side operations for federated learning coordination.
 */
export interface FederatedCoordination {
  /**
   * Initialize the federated learning server
   */
  initialize(): Promise<void>;

  /**
   * Register a new client
   */
  registerClient(request: RegistrationRequest): Promise<RegistrationResponse>;

  /**
   * Unregister a client
   */
  unregisterClient(client_id: ClientId): Promise<boolean>;

  /**
   * Start a new training round
   */
  startRound(config: Partial<RoundConfig>): Promise<RoundState>;

  /**
   * Get current round state
   */
  getRoundState(round_id: RoundId): Promise<RoundState | null>;

  /**
   * Submit client model update
   */
  submitUpdate(update: ModelUpdate): Promise<void>;

  /**
   * Aggregate model updates for current round
   */
  aggregateUpdates(round_id: RoundId): Promise<ModelParameters>;

  /**
   * Get current global model
   */
  getGlobalModel(): Promise<ModelParameters>;

  /**
   * Get server state
   */
  getServerState(): Promise<ServerState>;

  /**
   * Process client heartbeat
   */
  processHeartbeat(heartbeat: ClientHeartbeat): Promise<HeartbeatAck>;

  /**
   * Get privacy budget
   */
  getPrivacyBudget(): Promise<PrivacyBudget>;

  /**
   * Shutdown the server
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// CLIENT TRAINING INTERFACE
// ============================================================================

/**
 * Client training interface
 * 
 * Defines client-side operations for federated learning participation.
 */
export interface ClientTraining {
  /**
   * Initialize the client
   */
  initialize(config: ClientConfig): Promise<void>;

  /**
   * Connect to the federated learning server
   */
  connect(server_url: string): Promise<void>;

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>;

  /**
   * Handle training request from server
   */
  handleTrainingRequest(request: TrainingRequest): Promise<TrainingResponse>;

  /**
   * Train locally on client data
   */
  trainLocally(
    global_model: ModelParameters,
    local_epochs: number,
    privacy_budget: PrivacyCost
  ): Promise<ModelUpdate>;

  /**
   * Send heartbeat to server
   */
  sendHeartbeat(): Promise<void>;

  /**
   * Get client state
   */
  getClientState(): Promise<ClientState>;

  /**
   * Get privacy budget
   */
  getPrivacyBudget(): Promise<PrivacyBudget>;

  /**
   * Shutdown the client
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result for model updates
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Relevant field */
  field?: string;
  /** Severity */
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Relevant field */
  field?: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Federated learning event type
 */
export enum FLEventType {
  /** Client registered */
  CLIENT_REGISTERED = "client_registered",
  /** Client unregistered */
  CLIENT_UNREGISTERED = "client_unregistered",
  /** Round started */
  ROUND_STARTED = "round_started",
  /** Round completed */
  ROUND_COMPLETED = "round_completed",
  /** Round failed */
  ROUND_FAILED = "round_failed",
  /** Client selected for training */
  CLIENT_SELECTED = "client_selected",
  /** Client update received */
  UPDATE_RECEIVED = "update_received",
  /** Model aggregated */
  MODEL_AGGREGATED = "model_aggregated",
  /** Privacy budget warning */
  PRIVACY_WARNING = "privacy_warning",
  /** Privacy budget exhausted */
  PRIVACY_EXHAUSTED = "privacy_exhausted",
}

/**
 * Federated learning event
 */
export interface FLEvent {
  /** Event type */
  type: FLEventType;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
  /** Round ID if applicable */
  round_id?: RoundId;
  /** Client ID if applicable */
  client_id?: ClientId;
}

/**
 * Event callback type
 */
export type EventCallback = (event: FLEvent) => void | Promise<void>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Compression configuration for model updates
 */
export interface CompressionConfig {
  /** Enable compression */
  enabled: boolean;
  /** Compression algorithm */
  algorithm: "gzip" | "lz4" | "quantization" | "sparse";
  /** Compression level (0-9) */
  level: number;
  /** Quantization bits (if using quantization) */
  quantization_bits?: 8 | 16 | 32;
  /** Sparsity threshold (if using sparse) */
  sparsity_threshold?: number;
}

/**
 * Communication configuration
 */
export interface CommunicationConfig {
  /** Server URL */
  server_url: string;
  /** Request timeout (ms) */
  request_timeout_ms: number;
  /** Retry attempts */
  retry_attempts: number;
  /** Retry delay (ms) */
  retry_delay_ms: number;
  /** Enable keep-alive */
  keep_alive: boolean;
  /** Heartbeat interval (ms) */
  heartbeat_interval_ms: number;
  /** Compression configuration */
  compression: CompressionConfig;
  /** Enable TLS */
  enable_tls: boolean;
}

/**
 * Logger interface for federated learning
 */
export interface FLLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid model update
 */
export function isValidModelUpdate(update: unknown): update is ModelUpdate {
  if (typeof update !== "object" || update === null) {
    return false;
  }
  const u = update as Partial<ModelUpdate>;
  return (
    typeof u.client_id === "string" &&
    typeof u.round_id === "string" &&
    Array.isArray(u.update) &&
    typeof u.num_examples === "number" &&
    typeof u.metrics === "object" &&
    typeof u.privacy_cost === "object" &&
    typeof u.timestamp === "number"
  );
}

/**
 * Check if a value is a valid training request
 */
export function isValidTrainingRequest(request: unknown): request is TrainingRequest {
  if (typeof request !== "object" || request === null) {
    return false;
  }
  const r = request as Partial<TrainingRequest>;
  return (
    typeof r.request_id === "string" &&
    typeof r.round_config === "object" &&
    Array.isArray(r.global_model) &&
    typeof r.privacy_allocation === "object" &&
    typeof r.timestamp === "number" &&
    typeof r.expires_at === "number"
  );
}

/**
 * Check if privacy budget is sufficient
 */
export function isPrivacySufficient(
  budget: PrivacyBudget,
  required: PrivacyCost
): boolean {
  return (
    budget.epsilon_remaining >= required.epsilon &&
    budget.delta_remaining >= required.delta
  );
}

/**
 * Calculate remaining privacy budget ratio
 */
export function privacyBudgetRatio(budget: PrivacyBudget): number {
  return budget.epsilon_remaining / budget.epsilon_total;
}

/**
 * Check if privacy budget is low (less than 20%)
 */
export function isPrivacyBudgetLow(budget: PrivacyBudget): boolean {
  return privacyBudgetRatio(budget) < 0.2;
}

/**
 * Check if privacy budget is exhausted
 */
export function isPrivacyBudgetExhausted(budget: PrivacyBudget): boolean {
  return budget.epsilon_remaining <= 0 || budget.delta_remaining <= 0;
}
