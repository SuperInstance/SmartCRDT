/**
 * @file Federated Learning Client
 *
 * Client-side implementation for federated learning participation.
 * Handles local training, model update submission, and state synchronization.
 *
 * @module federated-learning/client
 */

import {
  ClientTraining,
  ClientState,
  ClientConfig,
  ClientStatus,
  ModelUpdate,
  ModelParameters,
  PrivacyBudget,
  PrivacyCost,
  TrainingRequest,
  TrainingResponse,
  TrainingMetrics,
  ClientHeartbeat,
  HeartbeatAck,
  RegistrationRequest,
  RegistrationResponse,
  RoundCompletionNotification,
  ClientCapabilities,
  FLEvent,
  FLEventType,
  EventCallback,
  FLLogger,
  isPrivacyBudgetExhausted,
  isValidTrainingRequest,
  type ClientId,
  type RoundId,
} from "../protocol.js";
import { DifferentialPrivacy, PrivateGradient, PrivateGradientConfig } from "@lsi/privacy";

/**
 * Default client configuration
 */
export const DEFAULT_CLIENT_CONFIG = {
  max_local_epochs: 5,
  local_batch_size: 32,
  local_learning_rate: 0.01,
  heartbeat_interval_ms: 30000, // 30 seconds
  request_timeout_ms: 60000, // 1 minute
  total_epsilon: 5.0,
  total_delta: 1e-6,
  clipping_norm: 1.0,
  noise_multiplier: 1.0,
} as const;

/**
 * Client configuration type
 */
export type ClientConfigType = Partial<typeof DEFAULT_CLIENT_CONFIG>;

/**
 * Training data interface
 */
export interface TrainingData {
  /** Input features */
  features: number[][];
  /** Target labels/values */
  targets: number[];
}

/**
 * Simple model interface for local training
 */
export interface LocalModel {
  /** Get model parameters */
  getParameters(): ModelParameters;
  /** Set model parameters */
  setParameters(params: ModelParameters): void;
  /** Train on local data */
  train(data: TrainingData, epochs: number, learning_rate: number): TrainingMetrics;
  /** Compute gradient */
  computeGradient(data: TrainingData): ModelParameters;
  /** Compute loss */
  computeLoss(data: TrainingData): number;
}

/**
 * Communication interface for server interaction
 */
export interface Communication {
  /** Send training request to server */
  sendTrainingRequest(request: TrainingRequest): Promise<TrainingResponse>;
  /** Send heartbeat to server */
  sendHeartbeat(heartbeat: ClientHeartbeat): Promise<HeartbeatAck>;
  /** Register with server */
  register(request: RegistrationRequest): Promise<RegistrationResponse>;
}

/**
 * Federated Learning Client
 *
 * Implements client-side federated learning with:
 * - Local training with differential privacy
 * - Model update submission
 * - Privacy budget tracking
 * - Heartbeat and state synchronization
 * - Event emission for monitoring
 */
export class FLClient implements ClientTraining {
  private readonly config: typeof DEFAULT_CLIENT_CONFIG;
  private readonly logger: FLLogger;
  private readonly model: LocalModel;
  private readonly communication: Communication;

  // Client state
  private state: ClientState;
  private initialized: boolean = false;
  private connected: boolean = false;
  private shutdown_flag: boolean = false;

  // Event callbacks
  private event_callbacks: Map<FLEventType, EventCallback[]> = new Map();

  // Timers
  private heartbeat_interval: ReturnType<typeof setInterval> | null = null;

  // Differential privacy
  private dp: DifferentialPrivacy;
  private private_gradient: PrivateGradient;

  // Local training data
  private training_data: TrainingData | null = null;

  /**
   * Create a federated learning client
   *
   * @param config - Client configuration
   * @param model - Local model for training
   * @param communication - Communication interface
   * @param logger - Logger instance
   */
  constructor(
    config: ClientConfigType = {},
    model: LocalModel,
    communication: Communication,
    logger?: FLLogger
  ) {
    this.config = { ...DEFAULT_CLIENT_CONFIG, ...config };
    this.logger = logger ?? this.createDefaultLogger();
    this.model = model;
    this.communication = communication;

    // Initialize differential privacy
    this.dp = new DifferentialPrivacy({
      epsilon: this.config.total_epsilon,
      delta: this.config.total_delta,
      warnOnExhaustion: true,
      throwOnExhaustion: false,
    });

    const gradient_config: PrivateGradientConfig = {
      clipping_norm: this.config.clipping_norm,
      noise_multiplier: this.config.noise_multiplier,
    };
    this.private_gradient = new PrivateGradient(this.dp, gradient_config);

    // Initialize client state
    const client_id = this.generateId("client") as ClientId;
    this.state = {
      config: {
        client_id,
        max_local_epochs: this.config.max_local_epochs,
        local_batch_size: this.config.local_batch_size,
        local_learning_rate: this.config.local_learning_rate,
        privacy_budget: {
          epsilon_remaining: this.config.total_epsilon,
          delta_remaining: this.config.total_delta,
          epsilon_spent: 0,
          delta_spent: 0,
          epsilon_total: this.config.total_epsilon,
          delta_total: this.config.total_delta,
        },
        capabilities: {
          compute_capacity: 1.0,
          memory_capacity: 1.0,
          network_bandwidth_mbps: 100,
          data_quality: 0.8,
          num_examples: 0,
          supported_strategies: ["fedavg", "adaptive_fedavg"] as const,
          max_model_size_bytes: 1024 * 1024 * 1024,
          latency_tolerance_ms: 5000,
        },
      },
      local_model: model.getParameters(),
      status: ClientStatus.IDLE,
      privacy_budget: {
        epsilon_remaining: this.config.total_epsilon,
        delta_remaining: this.config.total_delta,
        epsilon_spent: 0,
        delta_spent: 0,
        epsilon_total: this.config.total_epsilon,
        delta_total: this.config.total_delta,
      },
      metrics: {
        loss: 0,
        epochs_completed: 0,
        batches_processed: 0,
        training_duration_ms: 0,
      },
    };
  }

  // ============================================================================
  // INITIALIZATION AND CONNECTION
  // ============================================================================

  /**
   * Initialize the client
   */
  async initialize(config: Partial<ClientConfig>): Promise<void> {
    if (this.initialized) {
      this.logger.warn("Client already initialized");
      return;
    }

    this.logger.info("Initializing federated learning client");

    // Update config if provided
    if (config) {
      Object.assign(this.state.config, config);
    }

    this.initialized = true;
    this.state.status = ClientStatus.IDLE;

    this.emitEvent({
      type: FLEventType.CLIENT_REGISTERED,
      data: { client_id: this.state.config.client_id },
      timestamp: Date.now(),
    });

    this.logger.info("Federated learning client initialized");
  }

  /**
   * Connect to the federated learning server
   */
  async connect(server_url: string): Promise<void> {
    if (!this.initialized) {
      throw new Error("Client not initialized");
    }

    this.logger.info("Connecting to server", { server_url });

    try {
      // Register with server
      const request: RegistrationRequest = {
        client_id: this.state.config.client_id,
        capabilities: this.state.config.capabilities,
        preferences: {
          max_local_epochs: this.config.max_local_epochs,
        },
        timestamp: Date.now(),
      };

      const response = await this.communication.register(request);

      if (!response.success) {
        throw new Error(response.error ?? "Registration failed");
      }

      this.connected = true;
      this.state.config.privacy_budget = response.privacy_budget;
      this.state.privacy_budget = response.privacy_budget;

      // Start heartbeat
      this.startHeartbeat();

      this.logger.info("Connected to server successfully");
    } catch (error) {
      this.logger.error("Failed to connect to server", { error });
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.logger.info("Disconnecting from server");

    this.connected = false;

    // Stop heartbeat
    if (this.heartbeat_interval) {
      clearInterval(this.heartbeat_interval);
      this.heartbeat_interval = null;
    }

    this.state.status = ClientStatus.IDLE;
    this.logger.info("Disconnected from server");
  }

  // ============================================================================
  // TRAINING REQUEST HANDLING
  // ============================================================================

  /**
   * Handle training request from server
   */
  async handleTrainingRequest(request: TrainingRequest): Promise<TrainingResponse> {
    if (!this.initialized || !this.connected) {
      throw new Error("Client not ready");
    }

    if (!isValidTrainingRequest(request)) {
      throw new Error("Invalid training request");
    }

    const { round_config, global_model, privacy_allocation } = request;

    this.logger.info("Received training request", {
      round_id: round_config.round_id,
      local_epochs: round_config.max_local_epochs,
    });

    // Check if request is expired
    if (Date.now() > request.expires_at) {
      return {
        request_id: request.request_id,
        client_id: this.state.config.client_id,
        round_id: round_config.round_id,
        update: this.createEmptyUpdate(round_config.round_id),
        success: false,
        error: "Request expired",
        timestamp: Date.now(),
      };
    }

    // Check privacy budget
    if (!isPrivacySufficient(this.state.privacy_budget, privacy_allocation)) {
      return {
        request_id: request.request_id,
        client_id: this.state.config.client_id,
        round_id: round_config.round_id,
        update: this.createEmptyUpdate(round_config.round_id),
        success: false,
        error: "Insufficient privacy budget",
        timestamp: Date.now(),
      };
    }

    this.state.status = ClientStatus.TRAINING;
    this.state.current_round_id = round_config.round_id;

    try {
      // Update local model with global model
      this.model.setParameters(global_model);
      this.state.local_model = global_model;

      // Train locally
      const update = await this.trainLocally(
        global_model,
        round_config.max_local_epochs,
        privacy_allocation
      );

      this.state.status = ClientStatus.COMPLETED;
      this.state.last_update = update;

      this.logger.info("Training completed successfully", {
        round_id: round_config.round_id,
        loss: update.metrics.loss,
      });

      return {
        request_id: request.request_id,
        client_id: this.state.config.client_id,
        round_id: round_config.round_id,
        update,
        success: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.state.status = ClientStatus.FAILED;
      this.logger.error("Training failed", { error });

      return {
        request_id: request.request_id,
        client_id: this.state.config.client_id,
        round_id: round_config.round_id,
        update: this.createEmptyUpdate(round_config.round_id),
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Train locally on client data
   */
  async trainLocally(
    global_model: ModelParameters,
    local_epochs: number,
    privacy_budget: PrivacyCost
  ): Promise<ModelUpdate> {
    if (!this.training_data) {
      throw new Error("No training data available");
    }

    const start_time = Date.now();

    this.logger.info("Starting local training", {
      local_epochs,
      num_examples: this.training_data.features.length,
    });

    // Set initial model
    this.model.setParameters(global_model);

    const initial_parameters = global_model.slice();

    // Train locally
    const metrics = this.model.train(
      this.training_data,
      local_epochs,
      this.config.local_learning_rate
    );

    const final_parameters = this.model.getParameters();

    // Compute update (difference from global model)
    const update = new Float32Array(initial_parameters.length);
    for (let i = 0; i < initial_parameters.length; i++) {
      update[i] = final_parameters[i] - initial_parameters[i];
    }

    // Apply differential privacy to update
    const private_update = this.applyPrivacyToUpdate(update, privacy_budget);

    const training_duration = Date.now() - start_time;

    // Create model update
    const model_update: ModelUpdate = {
      client_id: this.state.config.client_id,
      round_id: this.state.current_round_id ?? "unknown",
      update: private_update,
      num_examples: this.training_data.targets.length,
      metrics: {
        ...metrics,
        training_duration_ms: training_duration,
      },
      privacy_cost: privacy_budget,
      timestamp: Date.now(),
      local_epochs,
      capabilities: this.state.config.capabilities,
    };

    // Update privacy budget
    this.state.privacy_budget.epsilon_remaining -= privacy_budget.epsilon;
    this.state.privacy_budget.delta_remaining -= privacy_budget.delta;
    this.state.privacy_budget.epsilon_spent += privacy_budget.epsilon;
    this.state.privacy_budget.delta_spent += privacy_budget.delta;

    // Update state metrics
    this.state.metrics = metrics;

    this.logger.info("Local training completed", {
      loss: metrics.loss,
      duration_ms: training_duration,
      privacy_spent: privacy_budget,
    });

    return model_update;
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat(): Promise<void> {
    if (!this.connected) {
      return;
    }

    const heartbeat: ClientHeartbeat = {
      client_id: this.state.config.client_id,
      status: this.state.status,
      capabilities: this.state.config.capabilities,
      privacy_remaining: {
        epsilon: this.state.privacy_budget.epsilon_remaining,
        delta: this.state.privacy_budget.delta_remaining,
      },
      current_round_id: this.state.current_round_id,
      timestamp: Date.now(),
    };

    try {
      const ack = await this.communication.sendHeartbeat(heartbeat);

      // Handle server action
      if (ack.action === "disconnect") {
        this.logger.info("Server requested disconnect");
        await this.disconnect();
      } else if (ack.action === "update_capabilities") {
        // Update capabilities based on server feedback
        this.state.config.capabilities.compute_capacity = Math.max(
          0.1,
          this.state.config.capabilities.compute_capacity * 0.9
        );
      }
    } catch (error) {
      this.logger.error("Heartbeat failed", { error });
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeat_interval) {
      clearInterval(this.heartbeat_interval);
    }

    this.heartbeat_interval = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        this.logger.error("Heartbeat error", { error });
      });
    }, this.config.heartbeat_interval_ms);
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /**
   * Get client state
   */
  async getClientState(): Promise<ClientState> {
    return { ...this.state };
  }

  /**
   * Get privacy budget
   */
  async getPrivacyBudget(): Promise<PrivacyBudget> {
    return { ...this.state.privacy_budget };
  }

  /**
   * Set local training data
   */
  setTrainingData(data: TrainingData): void {
    this.training_data = data;
    this.state.config.capabilities.num_examples = data.targets.length;
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
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down federated learning client");
    this.shutdown_flag = true;

    // Disconnect if connected
    if (this.connected) {
      await this.disconnect();
    }

    // Stop heartbeat
    if (this.heartbeat_interval) {
      clearInterval(this.heartbeat_interval);
      this.heartbeat_interval = null;
    }

    this.initialized = false;
    this.logger.info("Federated learning client shut down");
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Apply differential privacy to model update
   */
  private applyPrivacyToUpdate(
    update: ModelParameters,
    privacy_cost: PrivacyCost
  ): ModelParameters {
    // Clip and add noise using private gradient
    const result = this.private_gradient.compute_private_gradient(
      Array.from(update),
      this.config.clipping_norm
    );

    // Update privacy cost
    privacy_cost.epsilon = result.privacy_cost.epsilon;
    privacy_cost.delta = result.privacy_cost.delta;

    return new Float32Array(result.gradient);
  }

  /**
   * Create empty model update for failed training
   */
  private createEmptyUpdate(round_id: RoundId): ModelUpdate {
    return {
      client_id: this.state.config.client_id,
      round_id,
      update: new Float32Array(0),
      num_examples: 0,
      metrics: {
        loss: 0,
        epochs_completed: 0,
        batches_processed: 0,
        training_duration_ms: 0,
      },
      privacy_cost: { epsilon: 0, delta: 0 },
      timestamp: Date.now(),
      local_epochs: 0,
      capabilities: this.state.config.capabilities,
    };
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
