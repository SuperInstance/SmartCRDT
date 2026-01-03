/**
 * @fileoverview VL-JEPA LangGraph Node
 *
 * LangGraph node that processes visual input through VL-JEPA and produces
 * structured actions for A2UI rendering.
 *
 * @version 1.0.0
 */

import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  VLJEPAPrediction,
  VLJEPAAction,
  VLJEPABridge as IVLJEPABridge,
} from "@lsi/vljepa/src/protocol.js";
import type { VLJEPAAgentState } from "../state/VLJEPAAgentState.js";
import type { VLJEPABridge } from "../state/VLJEPABridge.js";
import type { VisualStateManager } from "../state/VisualState.js";

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * VL-JEPA node configuration
 */
export interface VLJEPANodeConfig {
  /** VL-JEPA bridge instance */
  vljepaBridge: IVLJEPABridge;

  /** VL-JEPA to CoAgents bridge */
  coagentsBridge: VLJEPABridge;

  /** Visual state manager */
  visualManager: VisualStateManager;

  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Maximum number of actions */
  maxActions?: number;

  /** Enable caching */
  enableCache?: boolean;

  /** Node metadata */
  metadata?: {
    description?: string;
    version?: string;
    tags?: string[];
  };
}

/**
 * VL-JEPA node input
 */
export interface VLJEPANodeInput {
  /** Visual input (image data URL, canvas, or file path) */
  visualInput: string;

  /** User intent text */
  userIntent: string;

  /** Session ID */
  sessionId: string;

  /** Optional context */
  context?: {
    /** Previous visual state */
    previousFrame?: string;

    /** User preferences */
    preferences?: {
      autoApprovalThreshold?: number;
      preferredActionTypes?: string[];
    };
  };
}

/**
 * VL-JEPA node output
 */
export interface VLJEPANodeOutput {
  /** VL-JEPA prediction */
  prediction: VLJEPAPrediction;

  /** Filtered actions */
  actions: VLJEPAAction[];

  /** Visual state */
  visualState: VLJEPAAgentState["visual"];

  /** Updated agent state */
  agentState: Partial<VLJEPAAgentState>;

  /** Processing metadata */
  metadata: {
    /** Processing time */
    processingTime: number;

    /** Number of actions generated */
    actionCount: number;

    /** Average confidence */
    avgConfidence: number;

    /** Cache hit */
    cached: boolean;

    /** Device used */
    device?: "cpu" | "gpu" | "webgpu";
  };
}

// ============================================================================
// VL-JEPA LANGGRAPH NODE
// ============================================================================

/**
 * VL-JEPA LangGraph Node
 *
 * Processes visual input through VL-JEPA pipeline:
 * 1. Encode visual frame (X-Encoder)
 * 2. Encode user intent (Y-Encoder)
 * 3. Predict goal state (Predictor)
 * 4. Extract actions
 * 5. Create visual state
 * 6. Return augmented agent state
 */
export class VLJEPANode {
  private config: Required<VLJEPANodeConfig>;
  private cache: Map<string, { output: VLJEPANodeOutput; expiry: number }>;

  constructor(config: VLJEPANodeConfig) {
    this.config = {
      minConfidence: 0.5,
      maxActions: 10,
      enableCache: true,
      metadata: {
        description: "VL-JEPA visual reasoning node",
        version: "1.0.0",
        tags: ["visual", "vljepa", "encoding"],
      },
      ...config,
    };
    this.cache = new Map();
  }

  /**
   * Process input through VL-JEPA node
   *
   * LangGraph node handler function.
   *
   * @param state - Current agent state
   * @param config - Runnable config
   * @returns Updated agent state
   */
  async invoke(
    state: VLJEPAAgentState,
    config?: RunnableConfig
  ): Promise<Partial<VLJEPAAgentState>> {
    const startTime = Date.now();

    // Extract input from state
    const input: VLJEPANodeInput = {
      visualInput: state.visualContext?.currentFrame.src ?? "",
      userIntent: state.query,
      sessionId: state.sessionId,
      context: {
        previousFrame: state.visualContext?.previousFrame?.src,
        preferences: state.preferences,
      },
    };

    // Check cache
    const cacheKey = this.getCacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.output.agentState;
    }

    // Process through VL-JEPA
    const output = await this.process(input);

    // Cache output
    if (this.config.enableCache) {
      this.cache.set(cacheKey, {
        output,
        expiry: Date.now() + 300000, // 5 minutes
      });
    }

    return output.agentState;
  }

  /**
   * Process VL-JEPA input
   */
  private async process(input: VLJEPANodeInput): Promise<VLJEPANodeOutput> {
    const startTime = Date.now();

    // Step 1: Encode visual input
    const visualEmbedding = await this.config.vljepaBridge.encodeVision(
      input.visualInput
    );

    // Step 2: Encode user intent
    const intentEmbedding = await this.config.vljepaBridge.encodeLanguage(
      input.userIntent
    );

    // Step 3: Predict goal state and actions
    const prediction = await this.config.vljepaBridge.predict(
      visualEmbedding,
      intentEmbedding
    );

    // Step 4: Filter actions
    const actions = this.filterActions(prediction.actions);

    // Step 5: Create visual state
    const visualState = this.config.visualManager.createVisualState(
      visualEmbedding,
      actions
    );

    // Step 6: Create bridge state
    const bridgeState =
      this.config.coagentsBridge.predictionToBridgeState(prediction);
    bridgeState.visualEmbedding = visualEmbedding;
    bridgeState.intentEmbedding = intentEmbedding;

    // Step 7: Create embedding state
    const embeddingState = this.config.coagentsBridge.createEmbeddingState(
      visualEmbedding,
      intentEmbedding,
      prediction.goalEmbedding
    );

    // Step 8: Create updated agent state
    const agentState: Partial<VLJEPAAgentState> = {
      vljepa: bridgeState,
      visual: visualState,
      embeddings: embeddingState,
      pendingActions: actions,
      actionHistory: [],
      status: "complete",
      metadata: {
        ...prediction.metadata,
        visualInput: input.visualInput,
        userIntent: input.userIntent,
      },
    };

    const processingTime = Date.now() - startTime;

    return {
      prediction,
      actions,
      visualState,
      agentState,
      metadata: {
        processingTime,
        actionCount: actions.length,
        avgConfidence: this.averageConfidence(actions),
        cached: false,
        device: prediction.metadata.device,
      },
    };
  }

  /**
   * Filter actions by confidence and type
   */
  private filterActions(actions: VLJEPAAction[]): VLJEPAAction[] {
    let filtered = actions.filter(
      a => a.confidence >= this.config.minConfidence
    );
    filtered = filtered.sort((a, b) => b.confidence - a.confidence);
    return filtered.slice(0, this.config.maxActions);
  }

  /**
   * Calculate average confidence of actions
   */
  private averageConfidence(actions: VLJEPAAction[]): number {
    if (actions.length === 0) return 0;
    return actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(input: VLJEPANodeInput): string {
    return `${input.visualInput}:${input.userIntent}:${input.sessionId}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return this.config.metadata;
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

// ============================================================================
// NODE FACTORY
// ============================================================================

/**
 * Create VL-JEPA LangGraph node
 *
 * @param config - Node configuration
 * @returns VL-JEPA node instance
 */
export function createVLJEPANode(config: VLJEPANodeConfig): VLJEPANode {
  return new VLJEPANode(config);
}

/**
 * Create VL-JEPA node handler for LangGraph
 *
 * Returns a function compatible with LangGraph's addNode API.
 *
 * @param config - Node configuration
 * @returns Node handler function
 */
export function createVLJEPANodeHandler(config: VLJEPANodeConfig) {
  const node = new VLJEPANode(config);

  return async (state: VLJEPAAgentState, runnableConfig?: RunnableConfig) => {
    return await node.invoke(state, runnableConfig);
  };
}

export default VLJEPANode;
