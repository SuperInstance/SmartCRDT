/**
 * @fileoverview VL-JEPA Bridge for CoAgents - Connect visual embeddings to agent state
 *
 * This bridge converts VL-JEPA (Vision-Language Joint Embedding Predictive Architecture)
 * visual embeddings into CoAgents state format, enabling visual understanding in
 * human-in-the-loop agent workflows.
 *
 * Architecture:
 * - VL-JEPA X-Encoder → 768-dim visual embedding
 * - VL-JEPA Y-Encoder → 768-dim intent embedding
 * - VL-JEPA Predictor → Goal embedding + actions
 * - Bridge → CoAgents state + LangGraph nodes
 *
 * Integration Points:
 * - @lsi/vljepa: Visual and language encoders
 * - @lsi/coagents: State management and LangGraph integration
 * - @lsi/a2ui: UI generation from actions
 *
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper
 * @version 1.0.0
 */

import type {
  VLJEPAPrediction,
  VLJEPAAction,
  VLJEPABridge as IVLJEPABridge,
} from "@lsi/vljepa/src/protocol.js";
import type { AgentState } from "./SharedStateManager.js";

// ============================================================================
// VL-JEPA BRIDGE STATE TYPES
// ============================================================================

/**
 * VL-JEPA Bridge State
 *
 * Complete state representation from VL-JEPA processing.
 * Contains visual, intent, and goal embeddings with derived actions.
 */
export interface VLJEPABridgeState {
  /** Protocol version */
  version: "1.0";

  /** Visual embedding from X-Encoder (768-dim) */
  visualEmbedding: Float32Array;

  /** Intent embedding from Y-Encoder (768-dim) */
  intentEmbedding: Float32Array;

  /** Goal embedding from Predictor (768-dim) */
  goalEmbedding: Float32Array;

  /** Overall prediction confidence (0-1) */
  confidence: number;

  /** Timestamp of prediction */
  timestamp: number;

  /** Derived actions from goal embedding */
  actions: VLJEPAAction[];

  /** Semantic distance between current and goal states */
  semanticDistance?: number;

  /** Processing metadata */
  metadata: {
    /** Processing time in milliseconds */
    processingTime: number;

    /** X-Encoder inference time */
    xEncoderTime?: number;

    /** Y-Encoder inference time */
    yEncoderTime?: number;

    /** Predictor inference time */
    predictorTime?: number;

    /** Device used for inference */
    device?: "cpu" | "gpu" | "webgpu";

    /** Model version */
    modelVersion?: string;

    /** Whether cache was used */
    usedCache?: boolean;
  };
}

/**
 * Visual State Representation
 *
 * Encapsulates visual understanding from VL-JEPA.
 * Used for visual reasoning and UI manipulation.
 */
export interface VisualState {
  /** Visual embedding (768-dim) */
  embedding: Float32Array;

  /** Detected UI elements */
  elements: VisualUIElement[];

  /** Visual features */
  features: {
    /** Dominant colors */
    colors: string[];

    /** Layout type */
    layout: "grid" | "flex" | "absolute" | "table" | "unknown";

    /** Spacing information */
    spacing: {
      /** Average gap between elements */
      averageGap: number;

      /** Padding estimates */
      padding: { top: number; right: number; bottom: number; left: number };
    };

    /** Typography info */
    typography: {
      /** Font families detected */
      families: string[];

      /** Font sizes */
      sizes: number[];
    };
  };

  /** Confidence in visual understanding */
  confidence: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Visual UI Element
 *
 * Represents a detected UI element from visual analysis.
 */
export interface VisualUIElement {
  /** Element ID (auto-generated or detected) */
  id: string;

  /** Element type */
  type:
    | "button"
    | "input"
    | "text"
    | "image"
    | "container"
    | "list"
    | "unknown";

  /** Bounding box (normalized 0-1) */
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Element description */
  description: string;

  /** Confidence in detection */
  confidence: number;

  /** CSS selector approximation */
  selector?: string;

  /** Current styles (inferred) */
  styles?: Record<string, string>;

  /** Text content (if any) */
  text?: string;
}

/**
 * Embedding State
 *
 * Combined state from multiple embedding sources.
 * Fuses visual, intent, and goal embeddings.
 */
export interface EmbeddingState {
  /** Fused embedding (768-dim) */
  fused: Float32Array;

  /** Individual embeddings */
  visual: Float32Array;
  intent: Float32Array;
  goal: Float32Array;

  /** Fusion weights */
  weights: {
    visual: number;
    intent: number;
  };

  /** Semantic similarities */
  similarities: {
    /** Visual-intent similarity */
    visualIntent: number;

    /** Visual-goal similarity */
    visualGoal: number;

    /** Intent-goal similarity */
    intentGoal: number;
  };

  /** Timestamp */
  timestamp: number;
}

/**
 * Combined Agent State with VL-JEPA
 *
 * Augments standard AgentState with VL-JEPA visual understanding.
 */
export interface VLJEPAAgentState extends AgentState {
  /** VL-JEPA bridge state */
  vljepa: VLJEPABridgeState;

  /** Visual state */
  visual: VisualState;

  /** Embedding state */
  embeddings: EmbeddingState;

  /** Pending visual actions */
  pendingActions: VLJEPAAction[];

  /** Action history */
  actionHistory: VLJEPAActionHistoryEntry[];
}

/**
 * Action history entry
 */
export interface VLJEPAActionHistoryEntry {
  /** Action */
  action: VLJEPAAction;

  /** Timestamp */
  timestamp: number;

  /** Result (success/failure/pending) */
  result: "success" | "failure" | "pending";

  /** Error message if failed */
  error?: string;

  /** User feedback */
  userFeedback?: "approve" | "reject" | "modify";
}

// ============================================================================
// BRIDGE CONFIGURATION
// ============================================================================

/**
 * VL-JEPA Bridge Configuration
 */
export interface VLJEPABridgeConfig {
  /** Minimum confidence threshold for actions */
  minConfidence?: number;

  /** Maximum number of actions to extract */
  maxActions?: number;

  /** Enable visual element detection */
  enableElementDetection?: boolean;

  /** Enable semantic caching */
  enableCaching?: boolean;

  /** Cache TTL in milliseconds */
  cacheTTL?: number;

  /** Fusion weights for embeddings */
  fusionWeights?: {
    visual: number;
    intent: number;
  };

  /** Enable action filtering */
  enableActionFiltering?: boolean;

  /** Action type whitelist */
  allowedActionTypes?: VLJEPAAction["type"][];
}

// ============================================================================
// MAIN BRIDGE CLASS
// ============================================================================

/**
 * VL-JEPA Bridge for CoAgents
 *
 * Converts VL-JEPA predictions to CoAgents state format.
 * Handles embedding fusion, action extraction, and state synchronization.
 */
export class VLJEPABridge {
  private config: Required<VLJEPABridgeConfig>;
  private cache: Map<string, { state: VLJEPABridgeState; expiry: number }>;
  private vljepaBridge?: IVLJEPABridge;

  constructor(config: VLJEPABridgeConfig = {}) {
    this.config = {
      minConfidence: 0.5,
      maxActions: 10,
      enableElementDetection: true,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes
      fusionWeights: { visual: 0.5, intent: 0.5 },
      enableActionFiltering: true,
      allowedActionTypes: [
        "modify",
        "create",
        "delete",
        "move",
        "resize",
        "restyle",
      ],
      ...config,
    };
    this.cache = new Map();
  }

  /**
   * Set VL-JEPA bridge instance
   */
  setVLJEPABridge(bridge: IVLJEPABridge): void {
    this.vljepaBridge = bridge;
  }

  // ========================================================================
  // EMBEDDING TO STATE CONVERSION
  // ========================================================================

  /**
   * Convert VL-JEPA prediction to bridge state
   *
   * @param prediction - VL-JEPA prediction result
   * @returns VL-JEPA bridge state
   */
  predictionToBridgeState(prediction: VLJEPAPrediction): VLJEPABridgeState {
    return {
      version: "1.0",
      visualEmbedding: new Float32Array(768), // Will be filled by X-Encoder output
      intentEmbedding: new Float32Array(768), // Will be filled by Y-Encoder output
      goalEmbedding: prediction.goalEmbedding,
      confidence: prediction.confidence,
      timestamp: Date.now(),
      actions: this.filterActions(prediction.actions),
      semanticDistance: prediction.semanticDistance,
      metadata: {
        processingTime: prediction.metadata.processingTime,
        xEncoderTime: prediction.metadata.xEncoderTime,
        yEncoderTime: prediction.metadata.yEncoderTime,
        predictorTime: prediction.metadata.predictorTime,
        device: prediction.metadata.device,
        modelVersion: prediction.metadata.modelVersion,
        usedCache: prediction.metadata.usedCache,
      },
    };
  }

  /**
   * Create visual state from embedding and actions
   *
   * @param visualEmbedding - Visual embedding (768-dim)
   * @param actions - VL-JEPA actions
   * @returns Visual state
   */
  createVisualState(
    visualEmbedding: Float32Array,
    actions: VLJEPAAction[]
  ): VisualState {
    const elements = this.config.enableElementDetection
      ? this.detectUIElements(actions)
      : [];

    return {
      embedding: visualEmbedding,
      elements,
      features: this.extractVisualFeatures(elements, actions),
      confidence: this.calculateVisualConfidence(elements, actions),
      timestamp: Date.now(),
    };
  }

  /**
   * Create embedding state from individual embeddings
   *
   * @param visual - Visual embedding
   * @param intent - Intent embedding
   * @param goal - Goal embedding
   * @returns Combined embedding state
   */
  createEmbeddingState(
    visual: Float32Array,
    intent: Float32Array,
    goal: Float32Array
  ): EmbeddingState {
    const fused = this.fuseEmbeddings(visual, intent);

    return {
      fused,
      visual,
      intent,
      goal,
      weights: this.config.fusionWeights,
      similarities: {
        visualIntent: this.cosineSimilarity(visual, intent),
        visualGoal: this.cosineSimilarity(visual, goal),
        intentGoal: this.cosineSimilarity(intent, goal),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Augment agent state with VL-JEPA data
   *
   * @param agentState - Base agent state
   * @param vljepaState - VL-JEPA bridge state
   * @param visualState - Visual state
   * @param embeddingState - Embedding state
   * @returns Augmented agent state
   */
  augmentAgentState(
    agentState: AgentState,
    vljepaState: VLJEPABridgeState,
    visualState: VisualState,
    embeddingState: EmbeddingState
  ): VLJEPAAgentState {
    return {
      ...agentState,
      vljepa: vljepaState,
      visual: visualState,
      embeddings: embeddingState,
      pendingActions: vljepaState.actions,
      actionHistory: [],
    };
  }

  // ========================================================================
  // EMBEDDING FUSION
  // ========================================================================

  /**
   * Fuse visual and intent embeddings
   *
   * Uses weighted combination with normalization.
   *
   * @param visual - Visual embedding
   * @param intent - Intent embedding
   * @returns Fused embedding
   */
  fuseEmbeddings(visual: Float32Array, intent: Float32Array): Float32Array {
    if (visual.length !== intent.length) {
      throw new Error(
        `Embedding dimension mismatch: visual=${visual.length}, intent=${intent.length}`
      );
    }

    const fused = new Float32Array(visual.length);
    const { visual: visualWeight, intent: intentWeight } =
      this.config.fusionWeights;
    const totalWeight = visualWeight + intentWeight;

    for (let i = 0; i < visual.length; i++) {
      fused[i] =
        (visual[i] * visualWeight + intent[i] * intentWeight) / totalWeight;
    }

    // Normalize to unit length
    return this.normalizeEmbedding(fused);
  }

  /**
   * Normalize embedding to unit length
   *
   * @param embedding - Embedding to normalize
   * @returns Normalized embedding
   */
  normalizeEmbedding(embedding: Float32Array): Float32Array {
    const norm = Math.sqrt(
      Array.from(embedding).reduce((sum, val) => sum + val * val, 0)
    );
    if (norm === 0) return embedding;

    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / norm;
    }
    return normalized;
  }

  /**
   * Compute cosine similarity between embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Cosine similarity (-1 to 1)
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(
        `Embedding dimension mismatch: a=${a.length}, b=${b.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  // ========================================================================
  // ACTION EXTRACTION AND FILTERING
  // ========================================================================

  /**
   * Filter actions by confidence and type
   *
   * @param actions - All actions from prediction
   * @returns Filtered actions
   */
  filterActions(actions: VLJEPAAction[]): VLJEPAAction[] {
    let filtered = actions;

    // Filter by confidence
    if (this.config.enableActionFiltering) {
      filtered = filtered.filter(
        a => a.confidence >= this.config.minConfidence
      );
    }

    // Filter by type
    if (this.config.allowedActionTypes) {
      filtered = filtered.filter(a =>
        this.config.allowedActionTypes!.includes(a.type)
      );
    }

    // Sort by confidence and limit
    filtered = filtered
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxActions);

    return filtered;
  }

  /**
   * Extract high-confidence actions from prediction
   *
   * @param prediction - VL-JEPA prediction
   * @param threshold - Minimum confidence (default: config.minConfidence)
   * @returns High-confidence actions
   */
  extractActions(
    prediction: VLJEPAPrediction,
    threshold?: number
  ): VLJEPAAction[] {
    const minConf = threshold ?? this.config.minConfidence;
    return prediction.actions.filter(a => a.confidence >= minConf);
  }

  /**
   * Group actions by target element
   *
   * @param actions - Actions to group
   * @returns Grouped actions map
   */
  groupActionsByTarget(actions: VLJEPAAction[]): Map<string, VLJEPAAction[]> {
    const grouped = new Map<string, VLJEPAAction[]>();

    for (const action of actions) {
      const existing = grouped.get(action.target) ?? [];
      existing.push(action);
      grouped.set(action.target, existing);
    }

    return grouped;
  }

  // ========================================================================
  // UI ELEMENT DETECTION
  // ========================================================================

  /**
   * Detect UI elements from actions
   *
   * Infers UI elements based on action targets and parameters.
   *
   * @param actions - VL-JEPA actions
   * @returns Detected UI elements
   */
  detectUIElements(actions: VLJEPAAction[]): VisualUIElement[] {
    const elements: VisualUIElement[] = [];
    const seenTargets = new Set<string>();

    for (const action of actions) {
      if (seenTargets.has(action.target)) continue;

      const element = this.inferElementFromAction(action);
      if (element) {
        elements.push(element);
        seenTargets.add(action.target);
      }
    }

    return elements;
  }

  /**
   * Infer UI element from action
   *
   * @param action - VL-JEPA action
   * @returns Inferred UI element
   */
  private inferElementFromAction(action: VLJEPAAction): VisualUIElement | null {
    const type = this.inferElementType(action);
    const selector = this.inferSelector(action.target);

    return {
      id: crypto.randomUUID(),
      type,
      bbox: { x: 0, y: 0, width: 0, height: 0 }, // Unknown from embedding alone
      description: action.reasoning ?? `${action.type} on ${action.target}`,
      confidence: action.confidence,
      selector,
      styles: this.inferStyles(action.params),
      text: this.extractText(action.params),
    };
  }

  /**
   * Infer element type from action
   */
  private inferElementType(action: VLJEPAAction): VisualUIElement["type"] {
    const target = action.target.toLowerCase();
    const params = action.params;

    if (target.includes("button") || params["onClick"]) return "button";
    if (target.includes("input") || params["value"] !== undefined)
      return "input";
    if (target.includes("img") || params["src"]) return "image";
    if (target.includes("list") || target.includes("item")) return "list";
    if (
      params["display"]?.includes("flex") ||
      params["display"]?.includes("grid")
    ) {
      return "container";
    }
    return "unknown";
  }

  /**
   * Infer CSS selector from target
   */
  private inferSelector(target: string): string {
    if (target.startsWith("#") || target.startsWith(".")) {
      return target;
    }
    if (target.includes(">") || target.includes(" ")) {
      return target;
    }
    return `#${target}`;
  }

  /**
   * Infer styles from action parameters
   */
  private inferStyles(params: Record<string, unknown>): Record<string, string> {
    const styles: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number") {
        styles[key] = String(value);
      }
    }

    return styles;
  }

  /**
   * Extract text content from parameters
   */
  private extractText(params: Record<string, unknown>): string | undefined {
    return (
      (params["text"] as string) ??
      (params["content"] as string) ??
      (params["label"] as string)
    );
  }

  // ========================================================================
  // VISUAL FEATURE EXTRACTION
  // ========================================================================

  /**
   * Extract visual features from elements and actions
   *
   * @param elements - UI elements
   * @param actions - VL-JEPA actions
   * @returns Visual features
   */
  extractVisualFeatures(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): VisualState["features"] {
    return {
      colors: this.extractColors(actions),
      layout: this.inferLayout(actions),
      spacing: this.estimateSpacing(elements),
      typography: this.extractTypography(actions),
    };
  }

  /**
   * Extract dominant colors from actions
   */
  private extractColors(actions: VLJEPAAction[]): string[] {
    const colors = new Set<string>();

    for (const action of actions) {
      const params = action.params;
      for (const [key, value] of Object.entries(params)) {
        if (
          (key === "color" ||
            key === "backgroundColor" ||
            key === "borderColor") &&
          typeof value === "string"
        ) {
          colors.add(value);
        }
      }
    }

    return Array.from(colors);
  }

  /**
   * Infer layout type from actions
   */
  private inferLayout(
    actions: VLJEPAAction[]
  ): VisualState["features"]["layout"] {
    for (const action of actions) {
      const display = action.params["display"];
      if (typeof display === "string") {
        if (display.includes("flex")) return "flex";
        if (display.includes("grid")) return "grid";
        if (display.includes("table")) return "table";
        if (display.includes("absolute")) return "absolute";
      }
    }
    return "unknown";
  }

  /**
   * Estimate spacing from elements
   */
  private estimateSpacing(
    elements: VisualUIElement[]
  ): VisualState["features"]["spacing"] {
    return {
      averageGap: 16, // Default estimate
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    };
  }

  /**
   * Extract typography info from actions
   */
  private extractTypography(
    actions: VLJEPAAction[]
  ): VisualState["features"]["typography"] {
    const families = new Set<string>();
    const sizes = new Set<number>();

    for (const action of actions) {
      const fontFamily = action.params["fontFamily"];
      if (typeof fontFamily === "string") {
        families.add(fontFamily);
      }

      const fontSize = action.params["fontSize"];
      if (typeof fontSize === "number") {
        sizes.add(fontSize);
      } else if (typeof fontSize === "string") {
        const parsed = parseInt(fontSize.replace("px", ""));
        if (!isNaN(parsed)) {
          sizes.add(parsed);
        }
      }
    }

    return {
      families: Array.from(families),
      sizes: Array.from(sizes),
    };
  }

  /**
   * Calculate visual confidence
   */
  private calculateVisualConfidence(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): number {
    if (elements.length === 0) return 0;

    const elementConfidence =
      elements.reduce((sum, e) => sum + e.confidence, 0) / elements.length;

    const actionConfidence =
      actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;

    return (elementConfidence + actionConfidence) / 2;
  }

  // ========================================================================
  // STATE SYNC
  // ========================================================================

  /**
   * Synchronize VL-JEPA state with CoAgents state
   *
   * @param prediction - VL-JEPA prediction
   * @param agentState - Current agent state
   * @returns Updated agent state
   */
  async syncState(
    prediction: VLJEPAPrediction,
    agentState: AgentState
  ): Promise<VLJEPAAgentState> {
    // Convert prediction to bridge state
    const bridgeState = this.predictionToBridgeState(prediction);

    // Create visual state
    const visualState = this.createVisualState(
      bridgeState.visualEmbedding,
      bridgeState.actions
    );

    // Create embedding state
    const embeddingState = this.createEmbeddingState(
      bridgeState.visualEmbedding,
      bridgeState.intentEmbedding,
      bridgeState.goalEmbedding
    );

    // Augment agent state
    return this.augmentAgentState(
      agentState,
      bridgeState,
      visualState,
      embeddingState
    );
  }

  // ========================================================================
  // CACHING
  // ========================================================================

  /**
   * Generate cache key for prediction
   */
  private cacheKey(visionInput: string, intent: string): string {
    return `${visionInput}:${intent}`;
  }

  /**
   * Get cached bridge state
   */
  getCachedState(
    visionInput: string,
    intent: string
  ): VLJEPABridgeState | null {
    if (!this.config.enableCaching) return null;

    const key = this.cacheKey(visionInput, intent);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.state;
    }

    this.cache.delete(key);
    return null;
  }

  /**
   * Cache bridge state
   */
  setCachedState(
    visionInput: string,
    intent: string,
    state: VLJEPABridgeState
  ): void {
    if (!this.config.enableCaching) return;

    const key = this.cacheKey(visionInput, intent);
    this.cache.set(key, {
      state,
      expiry: Date.now() + this.config.cacheTTL,
    });
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
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Validate embedding dimension
   *
   * @param embedding - Embedding to validate
   * @param expectedDim - Expected dimension (default: 768)
   * @returns Whether embedding is valid
   */
  validateEmbedding(
    embedding: Float32Array,
    expectedDim: number = 768
  ): boolean {
    return embedding.length === expectedDim;
  }

  /**
   * Clone bridge state
   *
   * @param state - State to clone
   * @returns Cloned state
   */
  cloneBridgeState(state: VLJEPABridgeState): VLJEPABridgeState {
    return {
      ...state,
      visualEmbedding: new Float32Array(state.visualEmbedding),
      intentEmbedding: new Float32Array(state.intentEmbedding),
      goalEmbedding: new Float32Array(state.goalEmbedding),
      actions: state.actions.map(a => ({ ...a })),
    };
  }

  /**
   * Serialize bridge state for transmission
   *
   * @param state - State to serialize
   * @returns Serialized state
   */
  serializeBridgeState(state: VLJEPABridgeState): string {
    return JSON.stringify({
      ...state,
      visualEmbedding: Array.from(state.visualEmbedding),
      intentEmbedding: Array.from(state.intentEmbedding),
      goalEmbedding: Array.from(state.goalEmbedding),
    });
  }

  /**
   * Deserialize bridge state
   *
   * @param serialized - Serialized state
   * @returns Deserialized state
   */
  deserializeBridgeState(serialized: string): VLJEPABridgeState {
    const parsed = JSON.parse(serialized);
    return {
      ...parsed,
      visualEmbedding: new Float32Array(parsed.visualEmbedding),
      intentEmbedding: new Float32Array(parsed.intentEmbedding),
      goalEmbedding: new Float32Array(parsed.goalEmbedding),
    };
  }

  /**
   * Get bridge configuration
   */
  getConfig(): Required<VLJEPABridgeConfig> {
    return { ...this.config };
  }

  /**
   * Update bridge configuration
   */
  updateConfig(updates: Partial<VLJEPABridgeConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create VL-JEPA bridge for CoAgents
 *
 * @param config - Bridge configuration
 * @returns VL-JEPA bridge instance
 */
export function createVLJEPABridge(config?: VLJEPABridgeConfig): VLJEPABridge {
  return new VLJEPABridge(config);
}

export default VLJEPABridge;
