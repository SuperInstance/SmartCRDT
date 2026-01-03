/**
 * @file Federated Learning Server
 *
 * Server-side implementation for federated learning coordination.
 * Handles client selection, model aggregation, and round management.
 *
 * @module federated-learning/server
 */

import {
  FederatedCoordination,
  ServerState,
  RoundState,
  RoundConfig,
  ClientConfig,
  ModelUpdate,
  ModelParameters,
  PrivacyBudget,
  PrivacyCost,
  TrainingRequest,
  TrainingResponse,
  RegistrationRequest,
  RegistrationResponse,
  ClientHeartbeat,
  HeartbeatAck,
  RoundHistoryEntry,
  TrainingStatistics,
  ParticipationStatistics,
  ClientCapabilities,
  ServerCapabilities,
  AggregationStrategy,
  ClientSelectionStrategy,
  RoundPhase,
  ClientStatus,
  FLEvent,
  FLEventType,
  EventCallback,
  FLLogger,
  isPrivacySufficient,
  isPrivacyBudgetExhausted,
  isValidModelUpdate,
  type RoundId,
  type ClientId,
  type ModelId,
} from "../protocol.js";
import { DifferentialPrivacy } from "@lsi/privacy";

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG = {
  max_rounds: 100,
  target_clients_per_round: 10,
  min_clients_per_round: 3,
  max_local_epochs: 5,
  local_batch_size: 32,
  local_learning_rate: 0.01,
  aggregation_strategy: AggregationStrategy.FEDAVG,
  selection_strategy: ClientSelectionStrategy.QUALITY_BASED,
  training_timeout_ms: 300000, // 5 minutes
  aggregation_timeout_ms: 60000, // 1 minute
  heartbeat_timeout_ms: 60000, // 1 minute
  total_epsilon: 10.0,
  total_delta: 1e-5,
  client_epsilon: 0.5,
  client_delta: 1e-6,
  noise_multiplier: 1.0,
  clipping_norm: 1.0,
  secure_aggregation: false,
} as const;

/**
 * Server configuration type
 */
export type ServerConfig = Partial<typeof DEFAULT_SERVER_CONFIG>;

/**
 * Federated Learning Server
 *
 * Implements server-side coordination for federated learning with:
 * - Client registration and management
 * - Round-based training coordination
 * - Model aggregation (FedAvg, FedProx, adaptive)
 * - Privacy budget tracking with epsilon-differential privacy
 * - Client selection strategies
 * - Event emission for monitoring
 */
export class FLServer implements FederatedCoordination {
  private readonly config: typeof DEFAULT_SERVER_CONFIG;
  private readonly logger: FLLogger;

  // Server state
  private state: ServerState;
  private initialized: boolean = false;
  private shutdown_flag: boolean = false;

  // Event callbacks
  private event_callbacks: Map<FLEventType, EventCallback[]> = new Map();

  // Timers
  private heartbeat_timer: Map<ClientId, ReturnType<typeof setTimeout>> = new Map();
  private round_timer: ReturnType<typeof setTimeout> | null = null;

  // Differential privacy instance
  private dp: DifferentialPrivacy;

  /**
   * Create a federated learning server
   *
   * @param config - Server configuration
   * @param logger - Logger instance
   * @param initial_model - Initial global model parameters
   */
  constructor(
    config: ServerConfig = {},
    logger?: FLLogger,
    initial_model?: ModelParameters
  ) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config };
    this.logger = logger ?? this.createDefaultLogger();

    // Initialize differential privacy
    this.dp = new DifferentialPrivacy({
      epsilon: this.config.total_epsilon,
      delta: this.config.total_delta,
      warnOnExhaustion: true,
      throwOnExhaustion: false,
    });

    // Initialize server state
    const model_id = this.generateId("model") as ModelId;
    this.state = {
      global_model: initial_model ?? new Float32Array(),
      model_id,
      current_round: 0,
      clients: new Map(),
      round_history: [],
      privacy_budget: {
        epsilon_remaining: this.config.total_epsilon,
        delta_remaining: this.config.total_delta,
        epsilon_spent: 0,
        delta_spent: 0,
        epsilon_total: this.config.total_epsilon,
        delta_total: this.config.total_delta,
      },
      capabilities: {
        supported_strategies: [
          AggregationStrategy.FEDAVG,
          AggregationStrategy.FEDPROX,
          AggregationStrategy.ADAPTIVE_FEDAVG,
        ],
        max_concurrent_clients: 1000,
        max_rounds: this.config.max_rounds,
        secure_aggregation: this.config.secure_aggregation,
        compression_enabled: true,
        max_model_size_bytes: 1024 * 1024 * 1024, // 1GB
      },
      statistics: {
        total_rounds: 0,
        total_clients: 0,
        total_privacy_spent: { epsilon: 0, delta: 0 },
        average_loss: 0,
        average_accuracy: 0,
        average_round_duration_ms: 0,
        participation_stats: {
          unique_clients: 0,
          average_clients_per_round: 0,
          participation_frequency: new Map(),
          average_completion_rate: 0,
        },
      },
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the federated learning server
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn("Server already initialized");
      return;
    }

    this.logger.info("Initializing federated learning server", {
      config: this.config,
    });

    this.initialized = true;
    this.emitEvent({
      type: FLEventType.ROUND_STARTED,
      data: { message: "Server initialized" },
      timestamp: Date.now(),
    });

    this.logger.info("Federated learning server initialized successfully");
  }

  // ============================================================================
  // CLIENT MANAGEMENT
  // ============================================================================

  /**
   * Register a new client
   */
  async registerClient(
    request: RegistrationRequest
  ): Promise<RegistrationResponse> {
    if (!this.initialized) {
      throw new Error("Server not initialized");
    }

    const client_id: ClientId =
      request.client_id ?? this.generateId("client") as ClientId;

    this.logger.info("Registering client", { client_id });

    // Check if client already exists
    if (this.state.clients.has(client_id)) {
      this.logger.warn("Client already registered", { client_id });
      return {
        client_id,
        success: false,
        server_capabilities: this.state.capabilities,
        privacy_budget: this.getEmptyBudget(),
        error: "Client already registered",
        timestamp: Date.now(),
      };
    }

    // Create client config
    const client_config: ClientConfig = {
      client_id,
      max_local_epochs: request.preferences?.max_local_epochs ?? this.config.max_local_epochs,
      local_batch_size: this.config.local_batch_size,
      local_learning_rate: this.config.local_learning_rate,
      privacy_budget: {
        epsilon_remaining: this.config.client_epsilon,
        delta_remaining: this.config.client_delta,
        epsilon_spent: 0,
        delta_spent: 0,
        epsilon_total: this.config.client_epsilon,
        delta_total: this.config.client_delta,
      },
      capabilities: request.capabilities,
      preferred_aggregation: request.preferences?.preferred_aggregation,
    };

    // Register client
    this.state.clients.set(client_id, client_config);
    this.state.statistics.total_clients++;

    // Emit event
    this.emitEvent({
      type: FLEventType.CLIENT_REGISTERED,
      data: { client_id, capabilities: request.capabilities },
      timestamp: Date.now(),
      client_id,
    });

    this.logger.info("Client registered successfully", { client_id });

    return {
      client_id,
      success: true,
      server_capabilities: this.state.capabilities,
      privacy_budget: client_config.privacy_budget,
      timestamp: Date.now(),
    };
  }

  /**
   * Unregister a client
   */
  async unregisterClient(client_id: ClientId): Promise<boolean> {
    this.logger.info("Unregistering client", { client_id });

    const removed = this.state.clients.delete(client_id);

    // Clear heartbeat timer
    const timer = this.heartbeat_timer.get(client_id);
    if (timer) {
      clearTimeout(timer);
      this.heartbeat_timer.delete(client_id);
    }

    if (removed) {
      this.emitEvent({
        type: FLEventType.CLIENT_UNREGISTERED,
        data: { client_id },
        timestamp: Date.now(),
        client_id,
      });
    }

    return removed;
  }

  // ============================================================================
  // ROUND MANAGEMENT
  // ============================================================================

  /**
   * Start a new training round
   */
  async startRound(
    config_override: Partial<RoundConfig> = {}
  ): Promise<RoundState> {
    if (!this.initialized) {
      throw new Error("Server not initialized");
    }

    if (this.shutdown_flag) {
      throw new Error("Server is shutting down");
    }

    // Check privacy budget
    if (isPrivacyBudgetExhausted(this.state.privacy_budget)) {
      throw new Error("Privacy budget exhausted");
    }

    // Check if max rounds reached
    if (this.state.current_round >= this.config.max_rounds) {
      throw new Error("Maximum rounds reached");
    }

    const round_id = this.generateId("round") as RoundId;
    this.state.current_round++;

    this.logger.info("Starting training round", {
      round_id,
      round_number: this.state.current_round,
    });

    // Create round configuration
    const round_config: RoundConfig = {
      round_id,
      model_id: this.state.model_id,
      round_number: this.state.current_round,
      target_clients: config_override.target_clients ?? this.config.target_clients_per_round,
      min_clients: config_override.min_clients ?? this.config.min_clients_per_round,
      max_local_epochs: config_override.max_local_epochs ?? this.config.max_local_epochs,
      local_batch_size: config_override.local_batch_size ?? this.config.local_batch_size,
      local_learning_rate: config_override.local_learning_rate ?? this.config.local_learning_rate,
      aggregation_strategy: config_override.aggregation_strategy ?? this.config.aggregation_strategy,
      selection_strategy: config_override.selection_strategy ?? this.config.selection_strategy,
      privacy: {
        total_epsilon: this.config.total_epsilon,
        total_delta: this.config.total_delta,
        client_epsilon: this.config.client_epsilon,
        client_delta: this.config.client_delta,
        noise_multiplier: this.config.noise_multiplier,
        clipping_norm: this.config.clipping_norm,
        secure_aggregation: this.config.secure_aggregation,
      },
      training_timeout_ms: this.config.training_timeout_ms,
      aggregation_timeout_ms: this.config.aggregation_timeout_ms,
    };

    // Select clients for this round
    const selected_clients = this.selectClients(
      round_config.selection_strategy,
      round_config.target_clients
    );

    this.logger.info("Selected clients for round", {
      round_id,
      num_clients: selected_clients.length,
      client_ids: selected_clients,
    });

    // Create round state
    const round_state: RoundState = {
      config: round_config,
      phase: RoundPhase.SELECTING_CLIENTS,
      selected_clients,
      completed_clients: [],
      failed_clients: [],
      updates: [],
      privacy_spent: { epsilon: 0, delta: 0 },
      start_time: Date.now(),
    };

    this.state.active_round = round_state;

    // Emit event
    this.emitEvent({
      type: FLEventType.ROUND_STARTED,
      data: {
        round_id,
        round_number: this.state.current_round,
        selected_clients: selected_clients.length,
      },
      timestamp: Date.now(),
      round_id,
    });

    // Move to training phase
    round_state.phase = RoundPhase.TRAINING;

    // Set round timeout
    this.setRoundTimeout(round_id);

    return round_state;
  }

  /**
   * Get current round state
   */
  async getRoundState(round_id: RoundId): Promise<RoundState | null> {
    if (this.state.active_round?.config.round_id === round_id) {
      return this.state.active_round;
    }
    return null;
  }

  // ============================================================================
  // MODEL UPDATE HANDLING
  // ============================================================================

  /**
   * Submit client model update
   */
  async submitUpdate(update: ModelUpdate): Promise<void> {
    if (!this.initialized) {
      throw new Error("Server not initialized");
    }

    // Validate update
    if (!isValidModelUpdate(update)) {
      throw new Error("Invalid model update");
    }

    const { client_id, round_id } = update;

    this.logger.debug("Received model update", { client_id, round_id });

    // Check if there's an active round
    const active_round = this.state.active_round;
    if (!active_round || active_round.config.round_id !== round_id) {
      throw new Error(`No active round ${round_id}`);
    }

    // Check if client was selected
    if (!active_round.selected_clients.includes(client_id)) {
      throw new Error(`Client ${client_id} not selected for round ${round_id}`);
    }

    // Check if client already submitted
    if (active_round.completed_clients.includes(client_id)) {
      this.logger.warn("Client already submitted update", { client_id, round_id });
      return;
    }

    // Add update to round state
    active_round.updates.push(update);
    active_round.completed_clients.push(client_id);
    active_round.privacy_spent.epsilon += update.privacy_cost.epsilon;
    active_round.privacy_spent.delta += update.privacy_cost.delta;

    // Emit event
    this.emitEvent({
      type: FLEventType.UPDATE_RECEIVED,
      data: {
        client_id,
        round_id,
        num_examples: update.num_examples,
        loss: update.metrics.loss,
      },
      timestamp: Date.now(),
      round_id,
      client_id,
    });

    // Check if we should aggregate
    const completed = active_round.completed_clients.length;
    const target = active_round.config.min_clients;

    if (completed >= target) {
      this.logger.info("Minimum clients reached, triggering aggregation", {
        round_id,
        completed,
        target,
      });
      await this.aggregateUpdates(round_id);
    }
  }

  /**
   * Aggregate model updates for current round
   */
  async aggregateUpdates(round_id: RoundId): Promise<ModelParameters> {
    const active_round = this.state.active_round;

    if (!active_round || active_round.config.round_id !== round_id) {
      throw new Error(`No active round ${round_id}`);
    }

    if (active_round.updates.length === 0) {
      throw new Error(`No updates to aggregate for round ${round_id}`);
    }

    this.logger.info("Aggregating model updates", {
      round_id,
      num_updates: active_round.updates.length,
    });

    active_round.phase = RoundPhase.AGGREGATING;

    try {
      // Aggregate based on strategy
      const aggregated = await this.performAggregation(
        active_round.updates,
        active_round.config.aggregation_strategy
      );

      // Update global model
      this.state.global_model = this.addModels(
        this.state.global_model,
        aggregated
      );

      active_round.aggregated_model = this.state.global_model;
      active_round.phase = RoundPhase.COMPLETED;
      active_round.end_time = Date.now();

      // Update privacy budget
      this.state.privacy_budget.epsilon_remaining -= active_round.privacy_spent.epsilon;
      this.state.privacy_budget.delta_remaining -= active_round.privacy_spent.delta;
      this.state.privacy_budget.epsilon_spent += active_round.privacy_spent.epsilon;
      this.state.privacy_budget.delta_spent += active_round.privacy_spent.delta;

      // Record round history
      const duration = active_round.end_time - active_round.start_time;
      const avg_loss =
        active_round.updates.reduce((sum, u) => sum + u.metrics.loss, 0) /
        active_round.updates.length;

      const history_entry: RoundHistoryEntry = {
        round_number: active_round.config.round_number,
        round_id,
        num_clients: active_round.completed_clients.length,
        strategy: active_round.config.aggregation_strategy,
        privacy_cost: active_round.privacy_spent,
        loss: avg_loss,
        duration_ms: duration,
        timestamp: active_round.start_time,
        result: "success",
      };

      this.state.round_history.push(history_entry);
      this.state.statistics.total_rounds++;
      this.state.statistics.average_loss =
        (this.state.statistics.average_loss *
          (this.state.statistics.total_rounds - 1) +
          avg_loss) /
        this.state.statistics.total_rounds;
      this.state.statistics.average_round_duration_ms =
        (this.state.statistics.average_round_duration_ms *
          (this.state.statistics.total_rounds - 1) +
          duration) /
        this.state.statistics.total_rounds;

      // Emit event
      this.emitEvent({
        type: FLEventType.MODEL_AGGREGATED,
        data: {
          round_id,
          num_updates: active_round.updates.length,
          loss: avg_loss,
          duration_ms: duration,
        },
        timestamp: Date.now(),
        round_id,
      });

      this.emitEvent({
        type: FLEventType.ROUND_COMPLETED,
        data: {
          round_id,
          round_number: active_round.config.round_number,
          num_clients: active_round.completed_clients.length,
          loss: avg_loss,
          duration_ms: duration,
        },
        timestamp: Date.now(),
        round_id,
      });

      // Clear round timer
      if (this.round_timer) {
        clearTimeout(this.round_timer);
        this.round_timer = null;
      }

      this.logger.info("Round completed successfully", {
        round_id,
        num_clients: active_round.completed_clients.length,
        loss: avg_loss,
        duration_ms: duration,
      });

      return this.state.global_model;
    } catch (error) {
      active_round.phase = RoundPhase.FAILED;
      active_round.error = error instanceof Error ? error.message : String(error);
      active_round.end_time = Date.now();

      this.emitEvent({
        type: FLEventType.ROUND_FAILED,
        data: {
          round_id,
          error: active_round.error,
        },
        timestamp: Date.now(),
        round_id,
      });

      throw error;
    }
  }

  // ============================================================================
  // SERVER QUERIES
  // ============================================================================

  /**
   * Get current global model
   */
  async getGlobalModel(): Promise<ModelParameters> {
    return this.state.global_model;
  }

  /**
   * Get server state
   */
  async getServerState(): Promise<ServerState> {
    return {
      ...this.state,
      clients: new Map(this.state.clients),
    };
  }

  /**
   * Get privacy budget
   */
  async getPrivacyBudget(): Promise<PrivacyBudget> {
    return { ...this.state.privacy_budget };
  }

  // ============================================================================
  // HEARTBEAT HANDLING
  // ============================================================================

  /**
   * Process client heartbeat
   */
  async processHeartbeat(heartbeat: ClientHeartbeat): Promise<HeartbeatAck> {
    const { client_id, status, capabilities } = heartbeat;

    // Update client capabilities
    const client = this.state.clients.get(client_id);
    if (client) {
      client.capabilities = capabilities;
    }

    // Reset heartbeat timer
    const timer = this.heartbeat_timer.get(client_id);
    if (timer) {
      clearTimeout(timer);
    }
    this.heartbeat_timer.set(
      client_id,
      setTimeout(() => this.handleHeartbeatTimeout(client_id), this.config.heartbeat_timeout_ms)
    );

    // Determine action
    let action: HeartbeatAck["action"] = "continue";

    if (isPrivacyBudgetExhausted(this.state.privacy_budget)) {
      action = "disconnect";
    }

    return {
      client_id,
      server_status: {
        current_round: this.state.active_round?.config.round_id,
        server_load: this.calculateServerLoad(),
      },
      action,
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to events
   */
  on(event_type: FLEventType, callback: EventCallback): void {
    if (!this.event_callbacks.has(event_type)) {
      this.event_callbacks.set(event_type, []);
    }
    this.event_callbacks.get(event_type)!.push(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event_type: FLEventType, callback: EventCallback): void {
    const callbacks = this.event_callbacks.get(event_type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all subscribers
   */
  private emitEvent(event: FLEvent): void {
    const callbacks = this.event_callbacks.get(event.type);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(event);
        } catch (error) {
          this.logger.error("Event callback error", {
            event_type: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // ============================================================================
  // SHUTDOWN
  // ============================================================================

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down federated learning server");
    this.shutdown_flag = true;

    // Clear all timers
    for (const timer of this.heartbeat_timer.values()) {
      clearTimeout(timer);
    }
    this.heartbeat_timer.clear();

    if (this.round_timer) {
      clearTimeout(this.round_timer);
      this.round_timer = null;
    }

    this.initialized = false;
    this.logger.info("Federated learning server shut down");
  }

  // ============================================================================
  // PRIVATE METHODS - CLIENT SELECTION
  // ============================================================================

  /**
   * Select clients for training round
   */
  private selectClients(
    strategy: ClientSelectionStrategy,
    target_count: number
  ): ClientId[] {
    const available_clients = Array.from(this.state.clients.entries()).filter(
      ([_, config]) => config.capabilities.compute_capacity > 0.1
    );

    if (available_clients.length === 0) {
      return [];
    }

    let selected: ClientId[] = [];

    switch (strategy) {
      case ClientSelectionStrategy.RANDOM:
        selected = this.selectRandom(available_clients, target_count);
        break;

      case ClientSelectionStrategy.QUALITY_BASED:
        selected = this.selectByQuality(available_clients, target_count);
        break;

      case ClientSelectionStrategy.RESOURCE_BASED:
        selected = this.selectByResource(available_clients, target_count);
        break;

      case ClientSelectionStrategy.CYCLIC:
        selected = this.selectCyclic(available_clients, target_count);
        break;

      case ClientSelectionStrategy.PRIORITY:
        selected = this.selectByPriority(available_clients, target_count);
        break;

      default:
        selected = this.selectRandom(available_clients, target_count);
    }

    // Emit selection events
    for (const client_id of selected) {
      this.emitEvent({
        type: FLEventType.CLIENT_SELECTED,
        data: { client_id },
        timestamp: Date.now(),
        client_id,
      });
    }

    return selected;
  }

  /**
   * Random selection
   */
  private selectRandom(
    clients: [ClientId, ClientConfig][],
    count: number
  ): ClientId[] {
    const shuffled = clients.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(([id]) => id);
  }

  /**
   * Quality-based selection
   */
  private selectByQuality(
    clients: [ClientId, ClientConfig][],
    count: number
  ): ClientId[] {
    const sorted = clients.sort(
      (a, b) => b[1].capabilities.data_quality - a[1].capabilities.data_quality
    );
    return sorted.slice(0, count).map(([id]) => id);
  }

  /**
   * Resource-based selection
   */
  private selectByResource(
    clients: [ClientId, ClientConfig][],
    count: number
  ): ClientId[] {
    const sorted = clients.sort(
      (a, b) =>
        b[1].capabilities.compute_capacity - a[1].capabilities.compute_capacity
    );
    return sorted.slice(0, count).map(([id]) => id);
  }

  /**
   * Cyclic selection for fairness
   */
  private selectCyclic(
    clients: [ClientId, ClientConfig][],
    count: number
  ): ClientId[] {
    const round_num = this.state.current_round;
    const start = (round_num * count) % clients.length;
    const selected: ClientId[] = [];

    for (let i = 0; i < count && i < clients.length; i++) {
      const idx = (start + i) % clients.length;
      selected.push(clients[idx][0]);
    }

    return selected;
  }

  /**
   * Priority-based selection
   */
  private selectByPriority(
    clients: [ClientId, ClientConfig][],
    count: number
  ): ClientId[] {
    // Combine quality and resources for priority score
    const scored = clients.map(([id, config]) => [
      id,
      config.capabilities.data_quality * 0.6 +
        config.capabilities.compute_capacity * 0.4,
    ] as const);

    const sorted = scored.sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, count).map(([id]) => id);
  }

  // ============================================================================
  // PRIVATE METHODS - AGGREGATION
  // ============================================================================

  /**
   * Perform model aggregation
   */
  private async performAggregation(
    updates: ModelUpdate[],
    strategy: AggregationStrategy
  ): Promise<ModelParameters> {
    if (updates.length === 0) {
      return new Float32Array();
    }

    switch (strategy) {
      case AggregationStrategy.FEDAVG:
        return this.federatedAveraging(updates);

      case AggregationStrategy.FEDPROX:
        return this.federatedProximal(updates);

      case AggregationStrategy.ADAPTIVE_FEDAVG:
        return this.adaptiveFederatedAveraging(updates);

      case AggregationStrategy.SECURE_AGGREGATION:
        return this.secureAggregation(updates);

      default:
        return this.federatedAveraging(updates);
    }
  }

  /**
   * Federated Averaging (FedAvg)
   *
   * Weighted average of model updates based on number of examples.
   */
  private federatedAveraging(updates: ModelUpdate[]): ModelParameters {
    const dim = updates[0].update.length;
    const aggregated = new Float32Array(dim);

    // Calculate total examples
    const total_examples = updates.reduce(
      (sum, u) => sum + u.num_examples,
      0
    );

    // Weighted average
    for (const update of updates) {
      const weight = update.num_examples / total_examples;
      for (let i = 0; i < dim; i++) {
        aggregated[i] += update.update[i] * weight;
      }
    }

    return aggregated;
  }

  /**
   * Federated Proximal (FedProx)
   *
   * Adds proximal term to FedAvg to handle heterogeneity.
   */
  private federatedProximal(updates: ModelUpdate[]): ModelParameters {
    // Start with FedAvg
    const fedavg = this.federatedAveraging(updates);

    // Apply proximal term (simplified - in practice would use mu parameter)
    const mu = 0.01;
    const proximal = fedavg.map((v, i) => v * (1 - mu));

    return new Float32Array(proximal);
  }

  /**
   * Adaptive Federated Averaging
   *
   * Weights updates by both example count and client quality.
   */
  private adaptiveFederatedAveraging(updates: ModelUpdate[]): ModelParameters {
    const dim = updates[0].update.length;
    const aggregated = new Float32Array(dim);

    // Calculate adaptive weights
    let total_weight = 0;
    const weights = updates.map(u => {
      const quality_weight = u.capabilities.data_quality;
      const size_weight = u.num_examples;
      return quality_weight * size_weight;
    });

    total_weight = weights.reduce((sum, w) => sum + w, 0);

    // Weighted average
    for (let i = 0; i < updates.length; i++) {
      const weight = weights[i] / total_weight;
      const update = updates[i];
      for (let j = 0; j < dim; j++) {
        aggregated[j] += update.update[j] * weight;
      }
    }

    return aggregated;
  }

  /**
   * Secure Aggregation
   *
   * Uses cryptographic protocols for privacy-preserving aggregation.
   * Simplified implementation - production would use full secure aggregation.
   */
  private secureAggregation(updates: ModelUpdate[]): ModelParameters {
    // Start with FedAvg
    const fedavg = this.federatedAveraging(updates);

    // Add noise for privacy (using differential privacy)
    const noisy = fedavg.map(v =>
      this.dp.add_gaussian_noise(v, this.config.clipping_norm)
    );

    return new Float32Array(noisy);
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  /**
   * Add two models element-wise
   */
  private addModels(a: ModelParameters, b: ModelParameters): ModelParameters {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + (b[i] ?? 0);
    }
    return result;
  }

  /**
   * Calculate server load (0-1)
   */
  private calculateServerLoad(): number {
    const active_clients = this.state.active_round?.selected_clients.length ?? 0;
    return Math.min(1, active_clients / this.state.capabilities.max_concurrent_clients);
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(client_id: ClientId): void {
    this.logger.warn("Client heartbeat timeout", { client_id });
    this.state.clients.delete(client_id);
    this.heartbeat_timer.delete(client_id);
  }

  /**
   * Set round timeout
   */
  private setRoundTimeout(round_id: RoundId): void {
    if (this.round_timer) {
      clearTimeout(this.round_timer);
    }

    this.round_timer = setTimeout(() => {
      const active_round = this.state.active_round;
      if (active_round && active_round.config.round_id === round_id) {
        if (active_round.phase === RoundPhase.TRAINING) {
          this.logger.warn("Round training timeout", { round_id });
          // Try to aggregate with what we have
          if (active_round.updates.length >= active_round.config.min_clients) {
            this.aggregateUpdates(round_id).catch(error => {
              this.logger.error("Aggregation after timeout failed", { error });
            });
          } else {
            active_round.phase = RoundPhase.FAILED;
            active_round.error = "Training timeout";
            active_round.end_time = Date.now();
          }
        }
      }
    }, this.config.training_timeout_ms);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Get empty privacy budget
   */
  private getEmptyBudget(): PrivacyBudget {
    return {
      epsilon_remaining: 0,
      delta_remaining: 0,
      epsilon_spent: 0,
      delta_spent: 0,
      epsilon_total: 0,
      delta_total: 0,
    };
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): FLLogger {
    return {
      info: (message, meta) => console.log(`[INFO] ${message}`, meta ?? ""),
      warn: (message, meta) => console.warn(`[WARN] ${message}`, meta ?? ""),
      error: (message, meta) => console.error(`[ERROR] ${message}`, meta ?? ""),
      debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta ?? ""),
    };
  }
}
