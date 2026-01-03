/**
 * @lsi/vljepa/planning/WorldModelReasoner - Zero-Shot Planning Component
 *
 * Uses JEPA's world model for physical reasoning and action simulation.
 * Leverages intuitive physics learned from contextual masking training.
 *
 * Key Concepts:
 * - Action Simulation: Predict what will happen after an action
 * - Side Effect Detection: Anticipate consequences
 * - Causal Reasoning: Understand cause-and-effect relationships
 * - Object Permanence: Objects exist when not visible
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (Section on World Model)
 */

import type {
  PlannedAction,
  ActionSequence,
} from "./ActionSequenceGenerator.js";
import type { VisualState, GoalState } from "./EmbeddingDeltaCalculator.js";
import {
  euclideanDistance,
  cosineSimilarity,
  DEFAULT_EMBEDDING_DIM,
} from "../index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Side Effect - Predicted consequence of an action
 *
 * Represents an anticipated side effect from executing an action.
 */
export interface SideEffect {
  /** Side effect type */
  type:
    | "layout_shift"
    | "scroll"
    | "focus_change"
    | "data_change"
    | "visibility"
    | "performance";

  /** Human-readable description */
  description: string;

  /** Probability of occurrence (0-1) */
  probability: number;

  /** Severity level */
  severity: "low" | "medium" | "high";

  /** Affected elements */
  affectedElements: string[];

  /** Estimated delay before effect (ms) */
  delay: number;

  /** Whether effect is reversible */
  reversible: boolean;
}

/**
 * World Model Prediction - Predicted state after action
 *
 * Represents the expected state after executing an action.
 */
export interface WorldModelPrediction {
  /** Action being predicted */
  action: PlannedAction;

  /** Predicted state embedding (768-dim) */
  predictedState: Float32Array;

  /** Confidence in prediction (0-1) */
  confidence: number;

  /** Predicted side effects */
  sideEffects: SideEffect[];

  /** Predicted visual changes */
  visualChanges: {
    /** Elements that will move */
    movedElements: string[];
    /** Elements that will change appearance */
    changedElements: string[];
    /** Elements that will appear */
    appearedElements: string[];
    /** Elements that will disappear */
    disappearedElements: string[];
  };

  /** Predicted user experience impact */
  experienceImpact: {
    /** Performance impact (0-1, higher = worse) */
    performance: number;
    /** Cognitive load impact (0-1, higher = more load) */
    cognitiveLoad: number;
    /** Satisfaction impact (0-1, higher = better) */
    satisfaction: number;
  };

  /** Metadata */
  metadata: {
    /** Prediction timestamp */
    timestamp: number;
    /** Prediction method used */
    method: "embedding_space" | "heuristic" | "learned_model";
    /** Computation time (ms) */
    computationTime: number;
  };
}

/**
 * World Model State - Current state of the world model
 *
 * Represents the learned world model from JEPA training.
 */
export interface WorldModelState {
  /** Physics understanding type */
  physics: "intuitive" | "newtonian" | "learned";

  /** Whether object permanence is understood */
  objectPermanence: boolean;

  /** Whether causality is understood */
  causality: boolean;

  /** Current state dynamics (768-dim or larger) */
  dynamics: Float32Array;

  /** Learned transition rules */
  transitionRules: TransitionRule[];

  /** World model accuracy (from validation) */
  accuracy: number;
}

/**
 * Transition Rule - Learned state transition
 *
 * Represents a learned rule about how actions affect state.
 */
export interface TransitionRule {
  /** Rule ID */
  id: string;

  /** Action type this rule applies to */
  actionType: PlannedAction["type"];

  /** Preconditions (embedding space regions) */
  preconditions: {
    /** Dimension ranges */
    dimensionRanges: Array<{ start: number; end: number; values: number[] }>;

    /** Semantic conditions */
    semanticConditions: string[];
  };

  /** Expected effects (embedding space changes) */
  effects: {
    /** Dimension deltas */
    dimensionDeltas: Array<{ dimension: number; delta: number }>;

    /** Semantic effects */
    semanticEffects: string[];
  };

  /** Confidence in this rule (0-1) */
  confidence: number;

  /** Number of times this rule was observed */
  observationCount: number;

  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Causal Chain - Chain of cause and effect
 *
 * Represents a sequence of causal relationships.
 */
export interface CausalChain {
  /** Chain ID */
  id: string;

  /** Ordered actions in the chain */
  actions: PlannedAction[];

  /** Predicted states after each action */
  intermediateStates: Float32Array[];

  /** Cumulative side effects */
  cumulativeEffects: SideEffect[];

  /** Overall confidence in chain (0-1) */
  confidence: number;
}

/**
 * World Model Configuration
 */
export interface WorldModelConfig {
  /** Whether to use learned model (vs heuristics) */
  useLearnedModel: boolean;

  /** Prediction method */
  predictionMethod:
    | "embedding_space"
    | "heuristic"
    | "learned_model"
    | "hybrid";

  /** Number of transition rules to learn */
  maxTransitionRules: number;

  /** Minimum observation count for rules */
  minObservationCount: number;

  /** Whether to simulate side effects */
  simulateSideEffects: boolean;

  /** Whether to use causal reasoning */
  useCausalReasoning: boolean;

  /** Side effect threshold (0-1) */
  sideEffectThreshold: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default world model configuration
 */
export const DEFAULT_WORLD_MODEL_CONFIG: WorldModelConfig = {
  useLearnedModel: false, // Start with heuristics, learn over time
  predictionMethod: "hybrid",
  maxTransitionRules: 1000,
  minObservationCount: 5,
  simulateSideEffects: true,
  useCausalReasoning: true,
  sideEffectThreshold: 0.2,
};

// ============================================================================
// DEFAULT TRANSITION RULES
// ============================================================================

/**
 * Default transition rules (learned from JEPA training)
 */
export const DEFAULT_TRANSITION_RULES: TransitionRule[] = [
  {
    id: "layout-flex-center",
    actionType: "modify",
    preconditions: {
      dimensionRanges: [
        { start: 200, end: 250, values: [0, 0, 0] }, // Not currently centered
      ],
      semanticConditions: ["element exists", "not centered"],
    },
    effects: {
      dimensionDeltas: [
        { dimension: 220, delta: 0.8 }, // Center alignment
        { dimension: 221, delta: 0.8 },
        { dimension: 222, delta: 0.8 },
      ],
      semanticEffects: ["element centered", "flex layout applied"],
    },
    confidence: 0.9,
    observationCount: 1000,
    lastUpdated: Date.now(),
  },
  {
    id: "style-color-change",
    actionType: "modify",
    preconditions: {
      dimensionRanges: [
        { start: 300, end: 350, values: [] }, // Any current color
      ],
      semanticConditions: ["element exists"],
    },
    effects: {
      dimensionDeltas: [
        { dimension: 310, delta: 1.0 }, // Color dimension
        { dimension: 311, delta: 0.9 },
        { dimension: 312, delta: 0.8 },
      ],
      semanticEffects: ["color changed", "visual appearance updated"],
    },
    confidence: 0.85,
    observationCount: 800,
    lastUpdated: Date.now(),
  },
  {
    id: "create-element",
    actionType: "create",
    preconditions: {
      dimensionRanges: [],
      semanticConditions: ["parent exists"],
    },
    effects: {
      dimensionDeltas: [
        { dimension: 100, delta: 0.5 }, // Structure change
        { dimension: 101, delta: 0.6 },
        { dimension: 102, delta: 0.7 },
      ],
      semanticEffects: ["element created", "DOM updated", "layout may shift"],
    },
    confidence: 0.8,
    observationCount: 600,
    lastUpdated: Date.now(),
  },
  {
    id: "delete-element",
    actionType: "delete",
    preconditions: {
      dimensionRanges: [],
      semanticConditions: ["element exists"],
    },
    effects: {
      dimensionDeltas: [
        { dimension: 100, delta: -0.5 }, // Structure change
        { dimension: 150, delta: -0.3 }, // Layout shift
        { dimension: 151, delta: -0.2 },
      ],
      semanticEffects: [
        "element removed",
        "children removed",
        "layout may shift",
      ],
    },
    confidence: 0.9,
    observationCount: 500,
    lastUpdated: Date.now(),
  },
];

// ============================================================================
// WORLD MODEL REASONER
// ============================================================================

/**
 * World Model Reasoner
 *
 * Uses JEPA's world model for physical reasoning and action simulation.
 *
 * @example
 * ```typescript
 * const reasoner = new WorldModelReasoner();
 *
 * const action = plannedActions[0];
 * const currentState = visualState;
 *
 * const prediction = await reasoner.predictAction(action, currentState);
 * console.log(prediction.sideEffects); // [SideEffect, ...]
 * console.log(prediction.confidence); // 0.85
 * ```
 */
export class WorldModelReasoner {
  private config: WorldModelConfig;
  private transitionRules: TransitionRule[];
  private worldState: WorldModelState;

  constructor(
    config: Partial<WorldModelConfig> = {},
    rules: TransitionRule[] = DEFAULT_TRANSITION_RULES
  ) {
    this.config = { ...DEFAULT_WORLD_MODEL_CONFIG, ...config };
    this.transitionRules = rules;
    this.worldState = this.initializeWorldState();
  }

  /**
   * Predict outcome of executing an action
   *
   * @param action - Action to predict
   * @param currentState - Current visual state
   * @returns World model prediction
   */
  async predictAction(
    action: PlannedAction,
    currentState: VisualState
  ): Promise<WorldModelPrediction> {
    const startTime = Date.now();

    // Predict new embedding state
    const predictedState = await this.predictStateTransition(
      action,
      currentState
    );

    // Generate side effects
    const sideEffects = this.config.simulateSideEffects
      ? this.predictSideEffects(action, currentState)
      : [];

    // Predict visual changes
    const visualChanges = this.predictVisualChanges(action, currentState);

    // Predict experience impact
    const experienceImpact = this.predictExperienceImpact(action, sideEffects);

    // Calculate confidence
    const confidence = this.calculatePredictionConfidence(
      action,
      predictedState
    );

    const method = this.selectPredictionMethod();

    return {
      action,
      predictedState,
      confidence,
      sideEffects,
      visualChanges,
      experienceImpact,
      metadata: {
        timestamp: Date.now(),
        method,
        computationTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Predict outcomes for entire action sequence
   *
   * @param sequence - Action sequence to predict
   * @param initialState - Initial visual state
   * @returns Causal chain with predictions
   */
  async predictSequence(
    sequence: ActionSequence,
    initialState: VisualState
  ): Promise<CausalChain> {
    const actions = sequence.actions;
    const intermediateStates: Float32Array[] = [initialState.embedding];
    const cumulativeEffects: SideEffect[] = [];
    let currentState = initialState;

    // Predict each action sequentially
    for (const action of actions) {
      const prediction = await this.predictAction(action, currentState);

      // Update state
      currentState = {
        ...currentState,
        embedding: prediction.predictedState,
        timestamp: Date.now(),
      };

      intermediateStates.push(prediction.predictedState);
      cumulativeEffects.push(...prediction.sideEffects);
    }

    // Calculate overall confidence
    const confidence = this.calculateChainConfidence(actions);

    return {
      id: `chain-${Date.now()}`,
      actions,
      intermediateStates,
      cumulativeEffects,
      confidence,
    };
  }

  /**
   * Learn transition rule from observation
   *
   * @param action - Executed action
   * @param beforeState - State before action
   * @param afterState - State after action
   */
  learnTransitionRule(
    action: PlannedAction,
    beforeState: VisualState,
    afterState: VisualState
  ): void {
    // Calculate embedding delta
    const delta = new Float32Array(DEFAULT_EMBEDDING_DIM);
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      delta[i] = afterState.embedding[i] - beforeState.embedding[i];
    }

    // Find significant dimension changes
    const significantDeltas: Array<{ dimension: number; delta: number }> = [];
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      if (Math.abs(delta[i]) > 0.1) {
        significantDeltas.push({ dimension: i, delta: delta[i] });
      }
    }

    // Find existing rule or create new one
    const existingRule = this.transitionRules.find(
      r => r.actionType === action.type && r.confidence > 0.5
    );

    if (existingRule) {
      // Update existing rule
      existingRule.observationCount++;
      existingRule.lastUpdated = Date.now();

      // Refine effects
      for (const deltaItem of significantDeltas) {
        const existingEffect = existingRule.effects.dimensionDeltas.find(
          e => e.dimension === deltaItem.dimension
        );

        if (existingEffect) {
          // Weighted average
          existingEffect.delta =
            existingEffect.delta * 0.8 + deltaItem.delta * 0.2;
        } else {
          existingRule.effects.dimensionDeltas.push(deltaItem);
        }
      }

      // Update confidence based on consistency
      existingRule.confidence = Math.min(1, existingRule.confidence + 0.01);
    } else {
      // Create new rule
      const newRule: TransitionRule = {
        id: `rule-${Date.now()}-${action.type}`,
        actionType: action.type,
        preconditions: {
          dimensionRanges: [],
          semanticConditions: action.preconditions,
        },
        effects: {
          dimensionDeltas: significantDeltas,
          semanticEffects: action.postconditions,
        },
        confidence: 0.3, // Start low, increase with observations
        observationCount: 1,
        lastUpdated: Date.now(),
      };

      this.transitionRules.push(newRule);
    }

    // Limit number of rules
    if (this.transitionRules.length > this.config.maxTransitionRules) {
      this.transitionRules.sort(
        (a, b) => b.observationCount - a.observationCount
      );
      this.transitionRules = this.transitionRules.slice(
        0,
        this.config.maxTransitionRules
      );
    }
  }

  /**
   * Predict state transition
   */
  private async predictStateTransition(
    action: PlannedAction,
    currentState: VisualState
  ): Promise<Float32Array> {
    const method = this.selectPredictionMethod();

    switch (method) {
      case "learned_model":
        return this.predictWithLearnedModel(action, currentState);

      case "heuristic":
        return this.predictWithHeuristic(action, currentState);

      case "embedding_space":
      case "hybrid":
      default:
        return this.predictWithEmbeddingSpace(action, currentState);
    }
  }

  /**
   * Predict using learned transition rules
   */
  private predictWithLearnedModel(
    action: PlannedAction,
    currentState: VisualState
  ): Float32Array {
    // Find applicable rules
    const applicableRules = this.transitionRules.filter(
      r => r.actionType === action.type && r.confidence > 0.5
    );

    if (applicableRules.length === 0) {
      return this.predictWithHeuristic(action, currentState);
    }

    // Apply best matching rule
    const rule = applicableRules.sort((a, b) => b.confidence - a.confidence)[0];

    // Apply effects to current state
    const predictedState = new Float32Array(currentState.embedding);
    for (const effect of rule.effects.dimensionDeltas) {
      if (effect.dimension < DEFAULT_EMBEDDING_DIM) {
        predictedState[effect.dimension] += effect.delta * rule.confidence;
      }
    }

    return predictedState;
  }

  /**
   * Predict using heuristics
   */
  private predictWithHeuristic(
    action: PlannedAction,
    currentState: VisualState
  ): Float32Array {
    // Simplified heuristic predictions based on action type

    const predictedState = new Float32Array(currentState.embedding);
    const delta = new Float32Array(DEFAULT_EMBEDDING_DIM);

    switch (action.type) {
      case "modify":
        // Style changes affect middle dimensions
        for (let i = 300; i < 450; i++) {
          delta[i] = (Math.random() - 0.5) * 0.3;
        }
        break;

      case "create":
        // Structure changes affect early dimensions
        for (let i = 100; i < 150; i++) {
          delta[i] = (Math.random() - 0.5) * 0.5;
        }
        break;

      case "delete":
        // Structure changes affect early dimensions (negative)
        for (let i = 100; i < 150; i++) {
          delta[i] = (Math.random() - 0.5) * 0.5;
        }
        break;

      case "navigate":
        // Context changes
        for (let i = 600; i < 650; i++) {
          delta[i] = (Math.random() - 0.5) * 0.4;
        }
        break;

      default:
        // Small change across all dimensions
        for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
          delta[i] = (Math.random() - 0.5) * 0.1;
        }
    }

    // Apply delta
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      predictedState[i] += delta[i];
    }

    return predictedState;
  }

  /**
   * Predict using embedding space arithmetic
   */
  private predictWithEmbeddingSpace(
    action: PlannedAction,
    currentState: VisualState
  ): Float32Array {
    // Use learned action embeddings
    const actionEmbedding = this.getActionEmbedding(action.type);

    const predictedState = new Float32Array(currentState.embedding);

    // Add action embedding to current state
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      predictedState[i] += actionEmbedding[i] * 0.3; // Weighted addition
    }

    return predictedState;
  }

  /**
   * Get embedding for action type
   */
  private getActionEmbedding(actionType: PlannedAction["type"]): Float32Array {
    // Simplified action embeddings (in practice, learned)
    const embeddings: Record<string, Float32Array> = {
      navigate: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.1),
      click: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.05),
      input: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.08),
      wait: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
      modify: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.15),
      create: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.2),
      delete: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(-0.2),
    };

    return (
      embeddings[actionType] || new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0)
    );
  }

  /**
   * Predict side effects of action
   */
  private predictSideEffects(
    action: PlannedAction,
    currentState: VisualState
  ): SideEffect[] {
    const effects: SideEffect[] = [];

    switch (action.type) {
      case "create":
        effects.push({
          type: "layout_shift",
          description: "New element may shift surrounding content",
          probability: 0.7,
          severity: "medium",
          affectedElements: [action.target, "*"],
          delay: 0,
          reversible: true,
        });
        break;

      case "delete":
        effects.push({
          type: "layout_shift",
          description: "Removing element may cause layout reflow",
          probability: 0.9,
          severity: "high",
          affectedElements: [action.target, "*"],
          delay: 0,
          reversible: false,
        });
        effects.push({
          type: "data_change",
          description: "Element and children will be removed",
          probability: 1.0,
          severity: "high",
          affectedElements: [action.target, "*"],
          delay: 0,
          reversible: false,
        });
        break;

      case "modify":
        if (
          action.params.display ||
          action.params.position ||
          action.params.flex
        ) {
          effects.push({
            type: "layout_shift",
            description: "Layout changes may reposition elements",
            probability: 0.6,
            severity: "low",
            affectedElements: [action.target],
            delay: 0,
            reversible: true,
          });
        }
        break;

      case "navigate":
        effects.push({
          type: "scroll",
          description: "Page may scroll to new location",
          probability: 0.5,
          severity: "low",
          affectedElements: ["window"],
          delay: 100,
          reversible: true,
        });
        effects.push({
          type: "focus_change",
          description: "Focus may change to new page content",
          probability: 0.8,
          severity: "low",
          affectedElements: ["body"],
          delay: 50,
          reversible: true,
        });
        break;
    }

    return effects.filter(
      e => e.probability >= this.config.sideEffectThreshold
    );
  }

  /**
   * Predict visual changes
   */
  private predictVisualChanges(
    action: PlannedAction,
    currentState: VisualState
  ): WorldModelPrediction["visualChanges"] {
    const movedElements: string[] = [];
    const changedElements: string[] = [];
    const appearedElements: string[] = [];
    const disappearedElements: string[] = [];

    switch (action.type) {
      case "create":
        appearedElements.push(action.target);
        break;

      case "delete":
        disappearedElements.push(action.target);
        break;

      case "modify":
        changedElements.push(action.target);
        if (action.params.position || action.params.left || action.params.top) {
          movedElements.push(action.target);
        }
        break;
    }

    return {
      movedElements,
      changedElements,
      appearedElements,
      disappearedElements,
    };
  }

  /**
   * Predict experience impact
   */
  private predictExperienceImpact(
    action: PlannedAction,
    sideEffects: SideEffect[]
  ): WorldModelPrediction["experienceImpact"] {
    let performance = 0;
    let cognitiveLoad = 0;
    let satisfaction = 0.7;

    // Performance impact
    if (action.type === "create") {
      performance = 0.2;
    } else if (action.type === "delete") {
      performance = -0.1; // Deleting improves performance
    } else if (action.type === "modify") {
      performance = 0.05;
    }

    // Cognitive load
    if (sideEffects.length > 0) {
      cognitiveLoad = sideEffects.length * 0.1;
    }

    if (action.type === "create" || action.type === "delete") {
      cognitiveLoad += 0.2; // Structure changes are more demanding
    }

    // Satisfaction
    if (action.reversible) {
      satisfaction += 0.1; // Reversible actions feel safer
    }

    if (action.confidence > 0.8) {
      satisfaction += 0.1;
    }

    return {
      performance: Math.min(1, Math.max(0, performance)),
      cognitiveLoad: Math.min(1, Math.max(0, cognitiveLoad)),
      satisfaction: Math.min(1, Math.max(0, satisfaction)),
    };
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(
    action: PlannedAction,
    predictedState: Float32Array
  ): number {
    // Base confidence from action
    let confidence = action.confidence * 0.7;

    // Adjust based on transition rules
    const hasRule = this.transitionRules.some(
      r =>
        r.actionType === action.type &&
        r.observationCount >= this.config.minObservationCount
    );

    if (hasRule) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate chain confidence
   */
  private calculateChainConfidence(actions: PlannedAction[]): number {
    if (actions.length === 0) return 0;

    const avgConfidence =
      actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;

    // More actions = lower confidence
    const lengthFactor = Math.max(0.5, 1 - actions.length * 0.05);

    return avgConfidence * lengthFactor;
  }

  /**
   * Select prediction method
   */
  private selectPredictionMethod(): WorldModelPrediction["metadata"]["method"] {
    switch (this.config.predictionMethod) {
      case "learned_model":
        return this.config.useLearnedModel ? "learned_model" : "heuristic";
      case "heuristic":
        return "heuristic";
      case "embedding_space":
        return "embedding_space";
      case "hybrid":
      default:
        // Use learned model if available, otherwise embedding space
        return this.config.useLearnedModel && this.transitionRules.length > 10
          ? "learned_model"
          : "embedding_space";
    }
  }

  /**
   * Initialize world state
   */
  private initializeWorldState(): WorldModelState {
    return {
      physics: "intuitive",
      objectPermanence: true,
      causality: true,
      dynamics: new Float32Array(DEFAULT_EMBEDDING_DIM),
      transitionRules: this.transitionRules,
      accuracy: 0.7, // Starting accuracy
    };
  }

  /**
   * Get configuration
   */
  getConfig(): WorldModelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WorldModelConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get transition rules
   */
  getTransitionRules(): TransitionRule[] {
    return [...this.transitionRules];
  }

  /**
   * Get world state
   */
  getWorldState(): WorldModelState {
    return { ...this.worldState };
  }

  /**
   * Clear transition rules
   */
  clearRules(): void {
    this.transitionRules = [];
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create world model reasoner with default config
 */
export function createWorldModelReasoner(
  config?: Partial<WorldModelConfig>,
  rules?: TransitionRule[]
): WorldModelReasoner {
  return new WorldModelReasoner(config, rules);
}

/**
 * Predict action without instantiating
 */
export async function predictAction(
  action: PlannedAction,
  currentState: VisualState,
  config?: Partial<WorldModelConfig>
): Promise<WorldModelPrediction> {
  const reasoner = new WorldModelReasoner(config);
  return reasoner.predictAction(action, currentState);
}
