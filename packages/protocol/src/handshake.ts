/**
 * ACP Handshake Protocol
 *
 * Multi-model collaboration handshake for Assisted Collaborative Processing (ACP).
 *
 * This module implements the handshake protocol that coordinates multiple models
 * to work together on complex requests. The handshake process:
 * 1. Client sends ACPHandshakeRequest with desired models and collaboration mode
 * 2. Server validates request, checks model availability, filters by preferences
 * 3. Server generates execution plan with steps and aggregation strategy
 * 4. Server returns ACPHandshakeResponse with selected models and estimates
 * 5. Models coordinate based on collaboration mode and execute the plan
 * 6. Results are aggregated and returned to client
 *
 * Collaboration Modes:
 * - SEQUENTIAL: Models process one after another, each building on previous output
 * - PARALLEL: Models process simultaneously, results aggregated
 * - CASCADE: Output of one model feeds into the next as input
 * - ENSEMBLE: Multiple models process independently, outputs combined (voting/averaging)
 */

import { CollaborationMode, IntentCategory, Urgency } from "./atp-acp.js";
import type { ValidationResult } from "./validation.js";

/**
 * ACP Handshake Request
 *
 * Initiates a multi-model collaboration session. The client specifies
 * which models to use, how they should collaborate, and any constraints.
 */
export interface ACPHandshakeRequest {
  /** Unique identifier for this handshake session */
  id: string;

  /** The user's query or request text */
  query: string;

  /** Classified intent category for strategy selection */
  intent: IntentCategory;

  /** How models should collaborate */
  collaborationMode: CollaborationMode;

  /** Ordered list of requested model identifiers */
  models: string[];

  /** Optional preferences and constraints */
  preferences: {
    /** Maximum acceptable latency in milliseconds */
    maxLatency?: number;
    /** Maximum acceptable cost in USD */
    maxCost?: number;
    /** Minimum acceptable quality score (0-1) */
    minQuality?: number;
    /** Processing priority */
    priority?: Urgency;
  };

  /** Unix timestamp (ms) when request was created */
  timestamp: number;
}

/**
 * ACP Handshake Response
 *
 * Server response to handshake request. Contains selected models,
 * execution plan, and resource estimates.
 */
export interface ACPHandshakeResponse {
  /** Request ID matching the handshake request */
  requestId: string;

  /** Whether request was accepted, rejected, or partially accepted */
  status: "accepted" | "rejected" | "partial";

  /** Models selected for collaboration (subset of requested) */
  selectedModels: string[];

  /** Human-readable reason for status (especially for rejections) */
  reason?: string;

  /** Execution plan with steps and aggregation strategy */
  executionPlan: ExecutionPlan;

  /** Estimated total latency in milliseconds */
  estimatedLatency: number;

  /** Estimated total cost in USD */
  estimatedCost: number;
}

/**
 * Execution Plan
 *
 * Defines how multiple models will collaborate to process the request.
 * Contains ordered steps and aggregation strategy.
 */
export interface ExecutionPlan {
  /** Collaboration mode for this execution */
  mode: CollaborationMode;

  /** Ordered steps for model execution */
  steps: ExecutionStep[];

  /** How to combine outputs from multiple models */
  aggregationStrategy: AggregationStrategy;
}

/**
 * Execution Step
 *
 * Single step in the execution plan. Defines input/output flow
 * and resource estimates for one model invocation.
 */
export interface ExecutionStep {
  /** Step number in execution sequence (1-indexed) */
  stepNumber: number;

  /** Model identifier for this step */
  model: string;

  /** Where this step gets its input */
  inputSource: "original" | "previous" | "aggregated";

  /** Where this step's output goes */
  outputTarget: "final" | "next" | "aggregator";

  /** Estimated latency for this step in milliseconds */
  estimatedLatency: number;
}

/**
 * Aggregation Strategy
 *
 * Defines how outputs from multiple models are combined.
 */
export enum AggregationStrategy {
  /** Return the first response received */
  FIRST = "first",

  /** Return the last response received (for sequential/cascade) */
  LAST = "last",

  /** Majority voting across models */
  MAJORITY_VOTE = "majority_vote",

  /** Weighted average based on confidence scores */
  WEIGHTED_AVERAGE = "weighted_average",

  /** Return the response with highest confidence */
  BEST = "best",

  /** Concatenate all responses */
  CONCATENATE = "concatenate",

  /** Return all responses (let client decide) */
  ALL = "all",

  // Federated Learning Aggregation Strategies
  /** Federated Averaging - simple weighted average of client updates */
  FEDAVG = "fedavg",

  /** Federated Averaging with Momentum - accelerates convergence */
  FEDAVGM = "fedavgm",

  /** Federated Proximal - adds proximal term for straggler robustness */
  FEDPROX = "fedprox",

  /** FedBuff - buffered asynchronous aggregation */
  FEDBUFF = "fedbuff",

  /** FedAvg with Secure Aggregation - cryptographic privacy */
  FEDAVG_SECURE = "fedavg_secure",

  /** Robust Aggregation - Krum or Multi-Krum for Byzantine resilience */
  ROBUST = "robust",
}

/**
 * Model metadata for availability and capability checking
 */
interface ModelMetadata {
  /** Model identifier */
  id: string;

  /** Whether model is currently available */
  available: boolean;

  /** Average latency in milliseconds */
  avgLatency: number;

  /** Cost per 1K tokens in USD */
  costPer1kTokens: number;

  /** Quality score (0-1) */
  quality: number;
}

/**
 * ACPHandshake - Multi-model collaboration coordinator
 *
 * Processes handshake requests and generates execution plans for
 * multi-model collaboration.
 */
export class ACPHandshake {
  /** Model registry with metadata (in production, this would be dynamic) */
  private modelRegistry: Map<string, ModelMetadata>;

  constructor() {
    this.modelRegistry = new Map([
      [
        "gpt-4",
        {
          id: "gpt-4",
          available: true,
          avgLatency: 800,
          costPer1kTokens: 0.03,
          quality: 0.95,
        },
      ],
      [
        "gpt-3.5-turbo",
        {
          id: "gpt-3.5-turbo",
          available: true,
          avgLatency: 300,
          costPer1kTokens: 0.002,
          quality: 0.85,
        },
      ],
      [
        "claude-3",
        {
          id: "claude-3",
          available: true,
          avgLatency: 600,
          costPer1kTokens: 0.015,
          quality: 0.92,
        },
      ],
      [
        "llama-3.1-8b",
        {
          id: "llama-3.1-8b",
          available: true,
          avgLatency: 200,
          costPer1kTokens: 0,
          quality: 0.75,
        },
      ],
      [
        "mistral",
        {
          id: "mistral",
          available: true,
          avgLatency: 250,
          costPer1kTokens: 0.001,
          quality: 0.8,
        },
      ],
      [
        "codellama",
        {
          id: "codellama",
          available: true,
          avgLatency: 350,
          costPer1kTokens: 0,
          quality: 0.78,
        },
      ],
    ]);
  }

  /**
   * Process handshake request and generate response
   *
   * Validates request, checks model availability, filters by preferences,
   * creates execution plan, and estimates resources.
   *
   * @param request - Handshake request from client
   * @returns Handshake response with execution plan
   *
   * @example
   * ```typescript
   * const handshake = new ACPHandshake();
   * const response = await handshake.processHandshake({
   *   id: 'acp-123',
   *   query: 'Design a secure authentication system',
   *   intent: IntentCategory.CODE_GENERATION,
   *   collaborationMode: CollaborationMode.CASCADE,
   *   models: ['gpt-4', 'codellama', 'mistral'],
   *   preferences: { maxLatency: 2000, maxCost: 0.05 },
   *   timestamp: Date.now()
   * });
   * ```
   */
  async processHandshake(
    request: ACPHandshakeRequest
  ): Promise<ACPHandshakeResponse> {
    // 1. Validate request
    this.validateRequest(request);

    // 2. Check model availability
    const availableModels = await this.checkAvailability(request.models);

    if (availableModels.length === 0) {
      return {
        requestId: request.id,
        status: "rejected",
        selectedModels: [],
        reason: "No requested models available",
        executionPlan: this.createEmptyPlan(),
        estimatedLatency: 0,
        estimatedCost: 0,
      };
    }

    // 3. Filter by preferences
    const selectedModels = this.filterByPreferences(
      availableModels,
      request.preferences
    );

    if (selectedModels.length === 0) {
      return {
        requestId: request.id,
        status: "rejected",
        selectedModels: availableModels,
        reason: "No models match preferences (cost/latency constraints)",
        executionPlan: this.createEmptyPlan(),
        estimatedLatency: 0,
        estimatedCost: 0,
      };
    }

    // 4. Create execution plan
    const executionPlan = this.createExecutionPlan(
      request.collaborationMode,
      selectedModels
    );

    // 5. Estimate metrics
    const estimatedLatency = this.estimateLatency(executionPlan);
    const estimatedCost = this.estimateCost(executionPlan);

    // 6. Check constraints
    if (
      request.preferences.maxLatency &&
      estimatedLatency > request.preferences.maxLatency
    ) {
      return {
        requestId: request.id,
        status: "rejected",
        selectedModels,
        reason: `Estimated latency (${estimatedLatency}ms) exceeds maximum (${request.preferences.maxLatency}ms)`,
        executionPlan,
        estimatedLatency,
        estimatedCost,
      };
    }

    if (
      request.preferences.maxCost &&
      estimatedCost > request.preferences.maxCost
    ) {
      return {
        requestId: request.id,
        status: "rejected",
        selectedModels,
        reason: `Estimated cost ($${estimatedCost.toFixed(4)}) exceeds maximum ($${request.preferences.maxCost.toFixed(4)})`,
        executionPlan,
        estimatedLatency,
        estimatedCost,
      };
    }

    // Check minimum quality
    if (request.preferences.minQuality) {
      const minModelQuality = Math.min(
        ...selectedModels.map(m => this.modelRegistry.get(m)?.quality ?? 0)
      );
      if (minModelQuality < request.preferences.minQuality) {
        return {
          requestId: request.id,
          status: "rejected",
          selectedModels,
          reason: `Model quality (${minModelQuality.toFixed(2)}) below minimum (${request.preferences.minQuality.toFixed(2)})`,
          executionPlan,
          estimatedLatency,
          estimatedCost,
        };
      }
    }

    return {
      requestId: request.id,
      status: "accepted",
      selectedModels,
      executionPlan,
      estimatedLatency,
      estimatedCost,
    };
  }

  /**
   * Validate handshake request
   *
   * Ensures all required fields are present and valid.
   *
   * @param request - Request to validate
   * @throws Error if validation fails
   *
   * @private
   */
  private validateRequest(request: ACPHandshakeRequest): void {
    if (!request.id) {
      throw new Error("Request ID is required");
    }
    if (!request.query) {
      throw new Error("Query is required");
    }
    if (request.models.length === 0) {
      throw new Error("At least one model must be specified");
    }
    if (!Object.values(CollaborationMode).includes(request.collaborationMode)) {
      throw new Error(
        `Invalid collaboration mode: ${request.collaborationMode}`
      );
    }
  }

  /**
   * Check model availability
   *
   * Filters requested models to only those available in the registry.
   *
   * @param models - Requested model identifiers
   * @returns Array of available model identifiers
   *
   * @private
   */
  private async checkAvailability(models: string[]): Promise<string[]> {
    return models.filter(model => {
      const metadata = this.modelRegistry.get(model);
      return metadata?.available ?? false;
    });
  }

  /**
   * Filter models by preferences
   *
   * Applies cost, latency, and quality filters based on preferences.
   *
   * @param models - Available model identifiers
   * @param preferences - User preferences
   * @returns Filtered model identifiers
   *
   * @private
   */
  private filterByPreferences(
    models: string[],
    preferences: ACPHandshakeRequest["preferences"]
  ): string[] {
    let filtered = [...models];

    // Filter by max cost
    if (preferences.maxCost) {
      filtered = filtered.filter(model => {
        const metadata = this.modelRegistry.get(model);
        // Assume average 1K tokens per query
        return (metadata?.costPer1kTokens ?? 0) <= preferences.maxCost!;
      });
    }

    // Filter by priority (prefer faster models)
    if (
      preferences.priority === Urgency.HIGH ||
      preferences.priority === Urgency.CRITICAL
    ) {
      // Sort by latency (fastest first) and take top 2
      filtered = filtered
        .sort((a, b) => {
          const latencyA = this.modelRegistry.get(a)?.avgLatency ?? Infinity;
          const latencyB = this.modelRegistry.get(b)?.avgLatency ?? Infinity;
          return latencyA - latencyB;
        })
        .slice(0, 2);
    }

    return filtered;
  }

  /**
   * Create execution plan based on collaboration mode
   *
   * Generates ordered steps and selects aggregation strategy.
   *
   * @param mode - Collaboration mode
   * @param models - Selected models
   * @returns Execution plan
   *
   * @private
   */
  private createExecutionPlan(
    mode: CollaborationMode,
    models: string[]
  ): ExecutionPlan {
    switch (mode) {
      case CollaborationMode.SEQUENTIAL:
        return this.createSequentialPlan(models);

      case CollaborationMode.PARALLEL:
        return this.createParallelPlan(models);

      case CollaborationMode.CASCADE:
        return this.createCascadePlan(models);

      case CollaborationMode.ENSEMBLE:
        return this.createEnsemblePlan(models);

      default:
        // Fallback to sequential
        return this.createSequentialPlan(models);
    }
  }

  /**
   * Create sequential execution plan
   *
   * Models process one after another, each building on previous output.
   *
   * @param models - Models to use
   * @returns Sequential execution plan
   *
   * @private
   */
  private createSequentialPlan(models: string[]): ExecutionPlan {
    return {
      mode: CollaborationMode.SEQUENTIAL,
      steps: models.map((model, i) => ({
        stepNumber: i + 1,
        model,
        inputSource: i === 0 ? "original" : "previous",
        outputTarget: i === models.length - 1 ? "final" : "next",
        estimatedLatency: this.modelRegistry.get(model)?.avgLatency ?? 500,
      })),
      aggregationStrategy: AggregationStrategy.LAST,
    };
  }

  /**
   * Create parallel execution plan
   *
   * Models process simultaneously with original query, results aggregated.
   *
   * @param models - Models to use
   * @returns Parallel execution plan
   *
   * @private
   */
  private createParallelPlan(models: string[]): ExecutionPlan {
    const maxLatency = Math.max(
      ...models.map(m => this.modelRegistry.get(m)?.avgLatency ?? 300)
    );

    return {
      mode: CollaborationMode.PARALLEL,
      steps: models.map((model, i) => ({
        stepNumber: i + 1,
        model,
        inputSource: "original",
        outputTarget: "aggregator",
        estimatedLatency: maxLatency, // All run in parallel, so max latency
      })),
      aggregationStrategy: AggregationStrategy.BEST,
    };
  }

  /**
   * Create cascade execution plan
   *
   * Output of each model feeds into the next as input.
   * Similar to sequential but with explicit refinement focus.
   *
   * @param models - Models to use
   * @returns Cascade execution plan
   *
   * @private
   */
  private createCascadePlan(models: string[]): ExecutionPlan {
    return {
      mode: CollaborationMode.CASCADE,
      steps: models.map((model, i) => ({
        stepNumber: i + 1,
        model,
        inputSource: i === 0 ? "original" : "previous",
        outputTarget: i === models.length - 1 ? "final" : "next",
        estimatedLatency: this.modelRegistry.get(model)?.avgLatency ?? 400,
      })),
      aggregationStrategy: AggregationStrategy.LAST,
    };
  }

  /**
   * Create ensemble execution plan
   *
   * Multiple models process independently, outputs combined via voting/averaging.
   *
   * @param models - Models to use
   * @returns Ensemble execution plan
   *
   * @private
   */
  private createEnsemblePlan(models: string[]): ExecutionPlan {
    const maxLatency = Math.max(
      ...models.map(m => this.modelRegistry.get(m)?.avgLatency ?? 350)
    );

    return {
      mode: CollaborationMode.ENSEMBLE,
      steps: models.map((model, i) => ({
        stepNumber: i + 1,
        model,
        inputSource: "original",
        outputTarget: "aggregator",
        estimatedLatency: maxLatency,
      })),
      aggregationStrategy: AggregationStrategy.WEIGHTED_AVERAGE,
    };
  }

  /**
   * Create empty execution plan
   *
   * Used for rejected requests.
   *
   * @returns Empty execution plan
   *
   * @private
   */
  private createEmptyPlan(): ExecutionPlan {
    return {
      mode: CollaborationMode.SEQUENTIAL,
      steps: [],
      aggregationStrategy: AggregationStrategy.FIRST,
    };
  }

  /**
   * Estimate total latency for execution plan
   *
   * For parallel/ensemble: returns max step latency (all run concurrently)
   * For sequential/cascade: returns sum of step latencies
   *
   * @param plan - Execution plan
   * @returns Estimated latency in milliseconds
   *
   * @private
   */
  private estimateLatency(plan: ExecutionPlan): number {
    if (
      plan.mode === CollaborationMode.PARALLEL ||
      plan.mode === CollaborationMode.ENSEMBLE
    ) {
      // Parallel execution: max of step latencies
      return Math.max(...plan.steps.map(s => s.estimatedLatency), 0);
    } else {
      // Sequential execution: sum of step latencies
      return plan.steps.reduce((sum, step) => sum + step.estimatedLatency, 0);
    }
  }

  /**
   * Estimate total cost for execution plan
   *
   * Sum of model costs (all models incur cost regardless of mode).
   *
   * @param plan - Execution plan
   * @returns Estimated cost in USD
   *
   * @private
   */
  private estimateCost(plan: ExecutionPlan): number {
    // Assume average 1K tokens per model invocation
    const tokensPerInvocation = 1;

    return plan.steps.reduce((sum, step) => {
      const metadata = this.modelRegistry.get(step.model);
      const costPerInvocation =
        (metadata?.costPer1kTokens ?? 0.01) * tokensPerInvocation;
      return sum + costPerInvocation;
    }, 0);
  }

  /**
   * Register or update model metadata
   *
   * Allows dynamic model registration (useful for testing).
   *
   * @param metadata - Model metadata to register
   */
  registerModel(metadata: ModelMetadata): void {
    this.modelRegistry.set(metadata.id, metadata);
  }

  /**
   * Get metadata for a model
   *
   * @param modelId - Model identifier
   * @returns Model metadata or undefined
   */
  getModelMetadata(modelId: string): ModelMetadata | undefined {
    return this.modelRegistry.get(modelId);
  }

  /**
   * Get all registered models
   *
   * @returns Array of all registered model identifiers
   */
  getRegisteredModels(): string[] {
    return Array.from(this.modelRegistry.keys());
  }

  /**
   * Validate an ACPHandshakeRequest
   *
   * Performs comprehensive validation of an ACP handshake request to ensure
   * it conforms to the protocol specification. This includes checking required
   * fields, types, enum values, ranges, arrays, and preferences.
   *
   * Note: This method dynamically imports the ProtocolValidator to avoid
   * circular dependencies. For better performance in hot loops, create
   * a ProtocolValidator instance separately.
   *
   * @param request - ACPHandshakeRequest to validate
   * @returns Validation result with errors and warnings
   * @throws Error if validation module is not available
   *
   * @example
   * ```typescript
   * const handshake = new ACPHandshake();
   * const result = await handshake.validate(handshakeRequest);
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   *   for (const error of result.errors) {
   *     console.error(`  ${error.field}: ${error.message}`);
   *   }
   * }
   * ```
   */
  async validate(request: ACPHandshakeRequest): Promise<ValidationResult> {
    // Dynamic import to avoid circular dependency
    const { ProtocolValidator } = await import("./validation.js");
    const validator = new ProtocolValidator();
    return validator.validateACPHandshake(request);
  }
}

/**
 * Create handshake request
 *
 * Helper function to create a properly formatted handshake request.
 *
 * @param query - User query text
 * @param models - Models to use
 * @param mode - Collaboration mode
 * @param preferences - Optional preferences
 * @returns Formatted handshake request
 *
 * @example
 * ```typescript
 * const request = createHandshakeRequest(
 *   'Explain quantum computing',
 *   ['gpt-4', 'claude-3'],
 *   CollaborationMode.PARALLEL,
 *   { maxLatency: 1000, maxCost: 0.05 }
 * );
 * ```
 */
export function createHandshakeRequest(
  query: string,
  models: string[],
  mode: CollaborationMode,
  preferences?: ACPHandshakeRequest["preferences"]
): ACPHandshakeRequest {
  return {
    id: `acp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    query,
    intent: IntentCategory.QUERY,
    collaborationMode: mode,
    models,
    preferences: preferences ?? {},
    timestamp: Date.now(),
  };
}
