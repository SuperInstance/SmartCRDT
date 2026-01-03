/**
 * @lsi/vljepa/planning/EmbeddingDeltaCalculator - Zero-Shot Planning Component
 *
 * Calculates the difference between current and goal visual states for "vibe coding."
 * This is the foundation of zero-shot planning from VL-JEPA embeddings.
 *
 * Key Concepts:
 * - Embedding Delta: Goal - Current = Direction vector (768-dim)
 * - Semantic Decomposition: Break delta into meaningful UI changes
 * - Complexity Estimation: How difficult is the change?
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (Section on Zero-Shot Planning)
 */

import {
  euclideanDistance,
  normalizeEmbedding,
  cosineSimilarity,
  DEFAULT_EMBEDDING_DIM,
} from "../index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Visual State - Current state of the UI
 *
 * Represents the current visual state from X-Encoder.
 */
export interface VisualState {
  /** 768-dim semantic embedding from X-Encoder */
  embedding: Float32Array;

  /** Raw frame data (optional, for debugging) */
  frame?: ImageData;

  /** Timestamp when this state was captured */
  timestamp: number;

  /** UI context (e.g., page URL, component path) */
  uiContext: string;

  /** Additional metadata */
  metadata?: {
    /** Page structure */
    structure?: string;
    /** Available UI elements */
    elements?: string[];
    /** Current focus */
    focus?: string;
  };
}

/**
 * Goal State - Desired state from user
 *
 * Represents the goal state from user input (goal image or description).
 */
export interface GoalState {
  /** 768-dim semantic embedding from goal image/encoding */
  embedding: Float32Array;

  /** Goal frame (reference image) */
  frame?: ImageData;

  /** User's goal description */
  description: string;

  /** Confidence in this goal (0-1) */
  confidence: number;

  /** Goal constraints */
  constraints?: {
    /** Maximum time allowed (ms) */
    maxTime?: number;
    /** Maximum actions allowed */
    maxActions?: number;
    /** Required elements */
    requiredElements?: string[];
    /** Forbidden elements */
    forbiddenElements?: string[];
  };
}

/**
 * Semantic Change - Decomposed change type
 *
 * Represents a specific type of change detected in the delta.
 */
export interface SemanticChange {
  /** Change type */
  type: "layout" | "style" | "content" | "structure" | "interaction";

  /** Target element (CSS selector or component) */
  element: string;

  /** Human-readable description */
  description: string;

  /** Confidence in this change (0-1) */
  confidence: number;

  /** Magnitude of this change (0-1) */
  magnitude: number;

  /** Estimated difficulty (0-1, higher = harder) */
  difficulty: number;

  /** Related dimensions in embedding space */
  relatedDimensions?: {
    /** Start index in 768-dim embedding */
    start: number;
    /** End index in 768-dim embedding */
    end: number;
    /** Influence weight (0-1) */
    weight: number;
  }[];
}

/**
 * Embedding Delta - Difference between current and goal
 *
 * Represents the vector difference between current and goal states.
 */
export interface EmbeddingDelta {
  /** Current visual state */
  current: VisualState;

  /** Goal state */
  goal: GoalState;

  /** Delta vector: Goal - Current (768-dim) */
  vector: Float32Array;

  /** Euclidean distance (magnitude of change) */
  magnitude: number;

  /** Normalized direction vector (unit length) */
  direction: Float32Array;

  /** Semantic decomposition of changes */
  semanticChanges: SemanticChange[];

  /** Overall complexity (0-1, higher = more complex) */
  complexity: number;

  /** Estimated number of actions needed */
  estimatedActions: number;

  /** Estimated time to complete (ms) */
  estimatedTime: number;

  /** Confidence in delta analysis (0-1) */
  confidence: number;
}

/**
 * Dimension Analysis - Per-dimension contribution
 *
 * Analyzes contribution of each dimension to the delta.
 */
export interface DimensionAnalysis {
  /** Dimension index (0-767) */
  dimension: number;

  /** Absolute value of delta at this dimension */
  value: number;

  /** Percentage of total magnitude */
  contribution: number;

  /** Semantic meaning (inferred) */
  meaning?: string;

  /** Change type inferred from this dimension */
  changeType?: "layout" | "style" | "content" | "structure" | "interaction";
}

/**
 * Delta Calculator Configuration
 */
export interface DeltaCalculatorConfig {
  /** Threshold for considering a dimension "changed" (0-1) */
  changeThreshold: number;

  /** Number of top dimensions to analyze */
  topDimensions: number;

  /** Whether to use weighted magnitude (sqrt) */
  useWeightedMagnitude: boolean;

  /** Complexity weights */
  complexityWeights: {
    layout: number;
    style: number;
    content: number;
    structure: number;
    interaction: number;
  };

  /** Time estimates per action type (ms) */
  actionTimeEstimates: {
    navigate: number;
    click: number;
    input: number;
    wait: number;
    modify: number;
    create: number;
    delete: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration for delta calculator
 */
export const DEFAULT_DELTA_CONFIG: DeltaCalculatorConfig = {
  changeThreshold: 0.1,
  topDimensions: 50,
  useWeightedMagnitude: true,
  complexityWeights: {
    layout: 0.8,
    style: 0.3,
    content: 0.5,
    structure: 0.9,
    interaction: 0.6,
  },
  actionTimeEstimates: {
    navigate: 100,
    click: 50,
    input: 200,
    wait: 1000,
    modify: 150,
    create: 300,
    delete: 100,
  },
};

// ============================================================================
// EMBEDDING DELTA CALCULATOR
// ============================================================================

/**
 * Embedding Delta Calculator
 *
 * Calculates the difference between current and goal visual states
 * for zero-shot planning in "vibe coding."
 *
 * @example
 * ```typescript
 * const calculator = new EmbeddingDeltaCalculator();
 *
 * const current: VisualState = {
 *   embedding: await xEncoder.encode(uiFrame),
 *   timestamp: Date.now(),
 *   uiContext: "/dashboard"
 * };
 *
 * const goal: GoalState = {
 *   embedding: await xEncoder.encode(goalImage),
 *   description: "Make this button pop",
 *   confidence: 0.9
 * };
 *
 * const delta = await calculator.calculate(current, goal);
 * console.log(delta.complexity); // 0.65
 * console.log(delta.semanticChanges); // [{ type: "style", element: "#submit-btn", ... }]
 * ```
 */
export class EmbeddingDeltaCalculator {
  private config: DeltaCalculatorConfig;

  // Dimension semantic mappings (learned from training)
  private dimensionSemantics: Map<number, string>;

  constructor(config: Partial<DeltaCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_DELTA_CONFIG, ...config };
    this.dimensionSemantics = this.initializeDimensionSemantics();
  }

  /**
   * Calculate embedding delta between current and goal states
   *
   * @param current - Current visual state
   * @param goal - Goal state
   * @returns Embedding delta with analysis
   */
  async calculate(
    current: VisualState,
    goal: GoalState
  ): Promise<EmbeddingDelta> {
    // Validate embeddings
    this.validateEmbeddings(current.embedding, goal.embedding);

    // Calculate delta vector: Goal - Current
    const vector = this.subtractEmbeddings(goal.embedding, current.embedding);

    // Calculate magnitude (Euclidean distance)
    const magnitude = euclideanDistance(current.embedding, goal.embedding);

    // Normalize direction
    const direction = normalizeEmbedding(vector);

    // Analyze dimensions
    const dimensionAnalysis = this.analyzeDimensions(vector, magnitude);

    // Decompose into semantic changes
    const semanticChanges = this.decomposeSemanticChanges(
      dimensionAnalysis,
      current,
      goal
    );

    // Calculate overall complexity
    const complexity = this.calculateComplexity(semanticChanges, magnitude);

    // Estimate actions and time
    const { estimatedActions, estimatedTime } = this.estimateEffort(
      semanticChanges,
      complexity
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(magnitude, semanticChanges);

    return {
      current,
      goal,
      vector,
      magnitude,
      direction,
      semanticChanges,
      complexity,
      estimatedActions,
      estimatedTime,
      confidence,
    };
  }

  /**
   * Batch calculate deltas
   *
   * @param pairs - Array of [current, goal] pairs
   * @returns Array of deltas
   */
  async calculateBatch(
    pairs: Array<{ current: VisualState; goal: GoalState }>
  ): Promise<EmbeddingDelta[]> {
    return Promise.all(
      pairs.map(pair => this.calculate(pair.current, pair.goal))
    );
  }

  /**
   * Calculate incremental delta (partial progress)
   *
   * @param originalDelta - Original delta from start to goal
   * @param currentState - Current state after some actions
   * @returns Updated delta
   */
  async calculateIncrementalDelta(
    originalDelta: EmbeddingDelta,
    currentState: VisualState
  ): Promise<EmbeddingDelta> {
    // Recalculate from current state to original goal
    return this.calculate(currentState, originalDelta.goal);
  }

  /**
   * Validate embeddings
   */
  private validateEmbeddings(current: Float32Array, goal: Float32Array): void {
    if (current.length !== DEFAULT_EMBEDDING_DIM) {
      throw new Error(
        `Current embedding has wrong dimension: ${current.length}, expected ${DEFAULT_EMBEDDING_DIM}`
      );
    }
    if (goal.length !== DEFAULT_EMBEDDING_DIM) {
      throw new Error(
        `Goal embedding has wrong dimension: ${goal.length}, expected ${DEFAULT_EMBEDDING_DIM}`
      );
    }
  }

  /**
   * Subtract embeddings: Goal - Current
   */
  private subtractEmbeddings(
    goal: Float32Array,
    current: Float32Array
  ): Float32Array {
    const delta = new Float32Array(DEFAULT_EMBEDDING_DIM);
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      delta[i] = goal[i] - current[i];
    }
    return delta;
  }

  /**
   * Analyze per-dimension contributions
   */
  private analyzeDimensions(
    vector: Float32Array,
    totalMagnitude: number
  ): DimensionAnalysis[] {
    const analysis: DimensionAnalysis[] = [];

    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      const value = Math.abs(vector[i]);
      const contribution =
        totalMagnitude > 0 ? (value / totalMagnitude) * 100 : 0;

      analysis.push({
        dimension: i,
        value,
        contribution,
        meaning: this.dimensionSemantics.get(i),
        changeType: this.inferChangeType(i, value),
      });
    }

    // Sort by contribution (descending)
    analysis.sort((a, b) => b.contribution - a.contribution);

    // Return top N dimensions
    return analysis.slice(0, this.config.topDimensions);
  }

  /**
   * Infer change type from dimension index and value
   */
  private inferChangeType(
    dimension: number,
    value: number
  ): "layout" | "style" | "content" | "structure" | "interaction" {
    // Simplified mapping based on dimension regions
    // In practice, this would be learned from training data

    if (dimension < 150) {
      return "structure"; // Early dimensions often capture structure
    } else if (dimension < 300) {
      return "layout"; // Layout information
    } else if (dimension < 450) {
      return "style"; // Style and appearance
    } else if (dimension < 600) {
      return "content"; // Content and text
    } else {
      return "interaction"; // Interactive elements
    }
  }

  /**
   * Decompose delta into semantic changes
   */
  private decomposeSemanticChanges(
    dimensionAnalysis: DimensionAnalysis[],
    current: VisualState,
    goal: GoalState
  ): SemanticChange[] {
    // Group by change type
    const groupedChanges = new Map<
      "layout" | "style" | "content" | "structure" | "interaction",
      DimensionAnalysis[]
    >();

    dimensionAnalysis.forEach(dim => {
      if (dim.value >= this.config.changeThreshold) {
        const changeType = dim.changeType || "style";
        if (!groupedChanges.has(changeType)) {
          groupedChanges.set(changeType, []);
        }
        groupedChanges.get(changeType)!.push(dim);
      }
    });

    // Convert to semantic changes
    const changes: SemanticChange[] = [];

    groupedChanges.forEach((dimensions, changeType) => {
      if (dimensions.length === 0) return;

      const avgMagnitude =
        dimensions.reduce((sum, d) => sum + d.value, 0) / dimensions.length;
      const avgContribution =
        dimensions.reduce((sum, d) => sum + d.contribution, 0) /
        dimensions.length;

      changes.push({
        type: changeType,
        element: this.inferTargetElement(changeType, current, goal),
        description: this.generateChangeDescription(
          changeType,
          dimensions,
          avgMagnitude
        ),
        confidence: Math.min(1, avgContribution / 10),
        magnitude: avgMagnitude,
        difficulty: this.config.complexityWeights[changeType],
        relatedDimensions: dimensions.map(d => ({
          start: d.dimension,
          end: d.dimension + 1,
          weight: d.contribution / 100,
        })),
      });
    });

    // Sort by magnitude (descending)
    changes.sort((a, b) => b.magnitude - a.magnitude);

    return changes;
  }

  /**
   * Infer target element for change
   */
  private inferTargetElement(
    changeType: string,
    current: VisualState,
    goal: GoalState
  ): string {
    // Try to extract from goal description
    const description = goal.description.toLowerCase();

    // Simple pattern matching (in practice, use NLP)
    if (description.includes("button")) {
      return "button";
    } else if (description.includes("header")) {
      return "header";
    } else if (description.includes("sidebar")) {
      return "aside";
    } else if (description.includes("main")) {
      return "main";
    } else if (description.includes("container")) {
      return ".container";
    }

    // Use current context
    if (current.metadata?.focus) {
      return current.metadata.focus;
    }

    return "body"; // Default to body
  }

  /**
   * Generate human-readable change description
   */
  private generateChangeDescription(
    changeType: string,
    dimensions: DimensionAnalysis[],
    magnitude: number
  ): string {
    const intensity =
      magnitude > 0.5 ? "significant" : magnitude > 0.2 ? "moderate" : "minor";

    const descriptions: Record<string, string> = {
      layout: `Adjust layout positioning (${intensity} change)`,
      style: `Update visual styling (${intensity} change)`,
      content: `Modify content or text (${intensity} change)`,
      structure: `Restructure layout hierarchy (${intensity} change)`,
      interaction: `Change interactive behavior (${intensity} change)`,
    };

    return (
      descriptions[changeType] || `Apply ${intensity} ${changeType} change`
    );
  }

  /**
   * Calculate overall complexity
   */
  private calculateComplexity(
    semanticChanges: SemanticChange[],
    magnitude: number
  ): number {
    if (semanticChanges.length === 0) {
      return 0;
    }

    // Weighted sum of change difficulties
    const changeComplexity =
      semanticChanges.reduce((sum, change) => {
        return sum + change.difficulty * change.magnitude;
      }, 0) / semanticChanges.length;

    // Normalize by magnitude
    const magnitudeFactor = Math.min(1, magnitude / 10);

    // Combine: 70% from changes, 30% from magnitude
    return Math.min(1, changeComplexity * 0.7 + magnitudeFactor * 0.3);
  }

  /**
   * Estimate effort (actions and time)
   */
  private estimateEffort(
    semanticChanges: SemanticChange[],
    complexity: number
  ): { estimatedActions: number; estimatedTime: number } {
    // Estimate actions based on change count and complexity
    const baseActions = semanticChanges.length;
    const complexityMultiplier = 1 + complexity * 2;
    const estimatedActions = Math.ceil(baseActions * complexityMultiplier);

    // Estimate time based on actions and complexity
    const avgTimePerAction = 200; // ms
    const estimatedTime = Math.ceil(
      estimatedActions * avgTimePerAction * complexityMultiplier
    );

    return { estimatedActions, estimatedTime };
  }

  /**
   * Calculate confidence in delta analysis
   */
  private calculateConfidence(
    magnitude: number,
    semanticChanges: SemanticChange[]
  ): number {
    // Higher confidence for:
    // - Clear, large-magnitude changes
    // - Well-defined semantic changes
    // - Fewer ambiguous changes

    if (semanticChanges.length === 0) {
      return magnitude > 0.01 ? 0.5 : 1.0; // No change = high confidence
    }

    const magnitudeConfidence = Math.min(1, magnitude / 5);
    const semanticConfidence =
      semanticChanges.reduce((sum, change) => {
        return sum + change.confidence;
      }, 0) / semanticChanges.length;

    return magnitudeConfidence * 0.4 + semanticConfidence * 0.6;
  }

  /**
   * Initialize dimension semantic mappings
   * In practice, this would be learned from training data
   */
  private initializeDimensionSemantics(): Map<number, string> {
    const semantics = new Map<number, string>();

    // Simplified mappings (in practice, learned from data)
    semantics.set(0, "background-color");
    semantics.set(1, "text-color");
    semantics.set(2, "font-size");
    semantics.set(3, "spacing");
    semantics.set(4, "border-radius");
    // ... (would have 768 mappings in practice)

    return semantics;
  }

  /**
   * Get configuration
   */
  getConfig(): DeltaCalculatorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DeltaCalculatorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get dimension semantics
   */
  getDimensionSemantics(): Map<number, string> {
    return new Map(this.dimensionSemantics);
  }

  /**
   * Set dimension semantics (for learning from data)
   */
  setDimensionSemantics(semantics: Map<number, string>): void {
    this.dimensionSemantics = new Map(semantics);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create delta calculator with default config
 */
export function createDeltaCalculator(
  config?: Partial<DeltaCalculatorConfig>
): EmbeddingDeltaCalculator {
  return new EmbeddingDeltaCalculator(config);
}

/**
 * Calculate delta without instantiating
 */
export async function calculateDelta(
  current: VisualState,
  goal: GoalState,
  config?: Partial<DeltaCalculatorConfig>
): Promise<EmbeddingDelta> {
  const calculator = new EmbeddingDeltaCalculator(config);
  return calculator.calculate(current, goal);
}
