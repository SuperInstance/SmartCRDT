/**
 * @fileoverview VL-JEPA Enhanced Agent State
 *
 * Combines standard AgentState with VL-JEPA visual understanding for
 * comprehensive agent state management with visual capabilities.
 *
 * @version 1.0.0
 */

import type { AgentState } from "./SharedStateManager.js";
import type {
  VLJEPABridgeState,
  VisualState,
  EmbeddingState,
  VLJEPAActionHistoryEntry,
} from "./VLJEPABridge.js";
import type {
  EmbeddingVector,
  EmbeddingHistoryEntry,
} from "./EmbeddingState.js";
import type { VisualUIElement } from "./VisualState.js";

// ============================================================================
// VL-JEPA ENHANCED AGENT STATE
// ============================================================================

/**
 * VL-JEPA enhanced agent state
 *
 * Extends standard AgentState with visual understanding capabilities.
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

  /** Visual context */
  visualContext?: VisualContext;

  /** User preferences */
  preferences?: UserPreferences;
}

/**
 * Visual context for agent
 */
export interface VisualContext {
  /** Current UI frame */
  currentFrame: {
    /** Frame data URL or path */
    src: string;

    /** Frame dimensions */
    dimensions: {
      width: number;
      height: number;
    };

    /** Timestamp */
    timestamp: number;
  };

  /** Previous UI frame (for change detection) */
  previousFrame?: {
    src: string;
    dimensions: { width: number; height: number };
    timestamp: number;
  };

  /** Frame changes detected */
  changes?: FrameChange[];

  /** User's gaze/focus point */
  focusPoint?: {
    x: number; // Normalized 0-1
    y: number; // Normalized 0-1
    timestamp: number;
  };
}

/**
 * Frame change between UI states
 */
export interface FrameChange {
  /** Change type */
  type: "add" | "remove" | "modify" | "move" | "resize";

  /** Element affected */
  elementId: string;

  /** Change description */
  description: string;

  /** Confidence */
  confidence: number;

  /** Visual diff */
  visualDiff?: {
    /** Bounding box before */
    before?: { x: number; y: number; width: number; height: number };

    /** Bounding box after */
    after?: { x: number; y: number; width: number; height: number };
  };
}

/**
 * User preferences for visual interaction
 */
export interface UserPreferences {
  /** Preferred action types */
  preferredActionTypes: string[];

  /** Confidence threshold for auto-approval */
  autoApprovalThreshold: number;

  /** Require confirmation for destructive actions */
  requireDestructiveConfirmation: boolean;

  /** Preferred action grouping */
  groupActions: boolean;

  /** Show visual diff */
  showVisualDiff: boolean;

  /** Animation preferences */
  animations: {
    /** Enable animations */
    enabled: boolean;

    /** Animation duration */
    duration: number;
  };
}

/**
 * VL-JEPA action (re-exported for convenience)
 */
export interface VLJEPAAction {
  type: "modify" | "create" | "delete" | "move" | "resize" | "restyle";
  target: string;
  params: Record<string, unknown>;
  confidence: number;
  reasoning?: string;
  expectedOutcome?: {
    visualChange?: string;
    functionalChange?: string;
  };
}

// ============================================================================
// AGENT STATE MANAGER
// ============================================================================

/**
 * VL-JEPA Agent State Manager
 *
 * Manages combined agent state with visual understanding.
 */
export class VLJEPAAgentStateManager {
  private state: VLJEPAAgentState;
  private history: VLJEPAAgentState[];
  private maxHistorySize: number;

  constructor(initialState: Partial<VLJEPAAgentState> = {}) {
    this.state = this.createInitialState(initialState);
    this.history = [];
    this.maxHistorySize = 50;
  }

  /**
   * Get current state
   */
  getState(): VLJEPAAgentState {
    return { ...this.state };
  }

  /**
   * Update state partially
   */
  setState(update: Partial<VLJEPAAgentState>): void {
    // Save to history before update
    this.addToHistory(this.state);

    // Apply update
    this.state = { ...this.state, ...update };
  }

  /**
   * Update visual context
   */
  updateVisualContext(context: Partial<VisualContext>): void {
    this.state.visualContext = {
      ...this.state.visualContext,
      ...context,
    } as VisualContext;
  }

  /**
   * Add action to history
   */
  addActionToHistory(
    action: VLJEPAAction,
    result: "success" | "failure" | "pending" = "pending",
    error?: string
  ): void {
    const entry: VLJEPAActionHistoryEntry = {
      action,
      timestamp: Date.now(),
      result,
      error,
    };

    this.state.actionHistory.push(entry);
  }

  /**
   * Update action result in history
   */
  updateActionResult(
    actionIndex: number,
    result: "success" | "failure" | "pending",
    error?: string
  ): void {
    if (actionIndex >= 0 && actionIndex < this.state.actionHistory.length) {
      this.state.actionHistory[actionIndex].result = result;
      this.state.actionHistory[actionIndex].error = error;
    }
  }

  /**
   * Get pending actions
   */
  getPendingActions(): VLJEPAAction[] {
    return this.state.actionHistory
      .filter(entry => entry.result === "pending")
      .map(entry => entry.action);
  }

  /**
   * Clear pending actions
   */
  clearPendingActions(): void {
    this.state.actionHistory = this.state.actionHistory.map(entry => {
      if (entry.result === "pending") {
        return { ...entry, result: "success" as const };
      }
      return entry;
    });
  }

  /**
   * Get action history
   */
  getActionHistory(): VLJEPAActionHistoryEntry[] {
    return [...this.state.actionHistory];
  }

  /**
   * Get visual elements
   */
  getVisualElements(): VisualUIElement[] {
    return this.state.visual.elements ?? [];
  }

  /**
   * Get element by ID
   */
  getElementById(id: string): VisualUIElement | undefined {
    return this.state.visual.elements.find(e => e.id === id);
  }

  /**
   * Get element by selector
   */
  getElementBySelector(selector: string): VisualUIElement | undefined {
    return this.state.visual.elements.find(e => e.selector === selector);
  }

  /**
   * Search elements by type
   */
  getElementsByType(type: VisualUIElement["type"]): VisualUIElement[] {
    return this.state.visual.elements.filter(e => e.type === type);
  }

  /**
   * Get state history
   */
  getHistory(): VLJEPAAgentState[] {
    return [...this.history];
  }

  /**
   * Restore state from history
   */
  restoreFromHistory(index: number): boolean {
    if (index >= 0 && index < this.history.length) {
      this.state = this.history[index];
      this.history = this.history.slice(0, index);
      return true;
    }
    return false;
  }

  /**
   * Undo last state change
   */
  undo(): boolean {
    if (this.history.length > 0) {
      const previous = this.history.pop()!;
      this.state = previous;
      return true;
    }
    return false;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Reset state to initial
   */
  reset(): void {
    this.state = this.createInitialState();
    this.history = [];
  }

  /**
   * Create initial state
   */
  private createInitialState(
    partial: Partial<VLJEPAAgentState> = {}
  ): VLJEPAAgentState {
    return {
      query: "",
      intent: [],
      route: "local",
      privacy: "public",
      status: "idle",
      sessionId: crypto.randomUUID(),
      complexity: 0,
      vljepa: partial.vljepa ?? this.createInitialVLJEPABridgeState(),
      visual: partial.visual ?? this.createInitialVisualState(),
      embeddings: partial.embeddings ?? this.createInitialEmbeddingState(),
      pendingActions: [],
      actionHistory: [],
      ...partial,
    };
  }

  /**
   * Create initial VL-JEPA bridge state
   */
  private createInitialVLJEPABridgeState(): VLJEPABridgeState {
    return {
      version: "1.0",
      visualEmbedding: new Float32Array(768),
      intentEmbedding: new Float32Array(768),
      goalEmbedding: new Float32Array(768),
      confidence: 0,
      timestamp: Date.now(),
      actions: [],
      metadata: {
        processingTime: 0,
      },
    };
  }

  /**
   * Create initial visual state
   */
  private createInitialVisualState(): VisualState {
    return {
      embedding: {
        values: new Float32Array(768),
        dimension: 768,
        source: "x-encoder",
        timestamp: Date.now(),
        isNormalized: false,
      },
      elements: [],
      features: {
        colors: [],
        layout: {
          type: "unknown",
          confidence: 0,
        },
        spacing: {
          averageGap: 16,
          padding: { top: 16, right: 16, bottom: 16, left: 16 },
          margin: { top: 16, right: 16, bottom: 16, left: 16 },
          whitespaceRatio: 0.3,
        },
        typography: {
          families: [],
          sizes: [],
          weights: [],
          lineHeights: [],
          contrastScores: [],
          headingHierarchy: {},
        },
        hierarchy: {
          tree: { id: "root", type: "container", weight: 0, children: [] },
          depth: 0,
          focusPoints: [],
        },
        components: [],
      },
      confidence: 0,
      timestamp: Date.now(),
      dimensions: { width: 1920, height: 1080 },
    };
  }

  /**
   * Create initial embedding state
   */
  private createInitialEmbeddingState(): EmbeddingState {
    return {
      fused: new Float32Array(768),
      visual: new Float32Array(768),
      intent: new Float32Array(768),
      goal: new Float32Array(768),
      weights: { visual: 0.5, intent: 0.5 },
      similarities: {
        visualIntent: 0,
        visualGoal: 0,
        intentGoal: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Add state to history
   */
  private addToHistory(state: VLJEPAAgentState): void {
    this.history.push({ ...state });

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}

// ============================================================================
// STATE SERIALIZATION
// ============================================================================

/**
 * Serialize agent state for transmission
 *
 * @param state - State to serialize
 * @returns Serialized state
 */
export function serializeAgentState(state: VLJEPAAgentState): string {
  return JSON.stringify({
    ...state,
    vljepa: {
      ...state.vljepa,
      visualEmbedding: Array.from(state.vljepa.visualEmbedding),
      intentEmbedding: Array.from(state.vljepa.intentEmbedding),
      goalEmbedding: Array.from(state.vljepa.goalEmbedding),
    },
    visual: {
      ...state.visual,
      embedding: {
        ...state.visual.embedding,
        values: Array.from(state.visual.embedding.values),
      },
    },
    embeddings: {
      ...state.embeddings,
      fused: Array.from(state.embeddings.fused),
      visual: Array.from(state.embeddings.visual),
      intent: Array.from(state.embeddings.intent),
      goal: Array.from(state.embeddings.goal),
    },
  });
}

/**
 * Deserialize agent state
 *
 * @param serialized - Serialized state
 * @returns Deserialized state
 */
export function deserializeAgentState(serialized: string): VLJEPAAgentState {
  const parsed = JSON.parse(serialized);

  return {
    ...parsed,
    vljepa: {
      ...parsed.vljepa,
      visualEmbedding: new Float32Array(parsed.vljepa.visualEmbedding),
      intentEmbedding: new Float32Array(parsed.vljepa.intentEmbedding),
      goalEmbedding: new Float32Array(parsed.vljepa.goalEmbedding),
    },
    visual: {
      ...parsed.visual,
      embedding: {
        ...parsed.visual.embedding,
        values: new Float32Array(parsed.visual.embedding.values),
      },
    },
    embeddings: {
      ...parsed.embeddings,
      fused: new Float32Array(parsed.embeddings.fused),
      visual: new Float32Array(parsed.embeddings.visual),
      intent: new Float32Array(parsed.embeddings.intent),
      goal: new Float32Array(parsed.embeddings.goal),
    },
  };
}

/**
 * Create state diff
 *
 * @param before - State before
 * @param after - State after
 * @returns State changes
 */
export function createStateDiff(
  before: VLJEPAAgentState,
  after: VLJEPAAgentState
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  // Compare basic fields
  const fields: (keyof VLJEPAAgentState)[] = [
    "query",
    "route",
    "privacy",
    "status",
    "response",
    "complexity",
  ];

  for (const field of fields) {
    if (before[field] !== after[field]) {
      diff[field] = { before: before[field], after: after[field] };
    }
  }

  // Compare actions count
  if (before.pendingActions.length !== after.pendingActions.length) {
    diff["pendingActions"] = {
      before: before.pendingActions.length,
      after: after.pendingActions.length,
    };
  }

  // Compare visual elements count
  if (before.visual.elements.length !== after.visual.elements.length) {
    diff["visualElements"] = {
      before: before.visual.elements.length,
      after: after.visual.elements.length,
    };
  }

  return diff;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate agent state
 *
 * @param state - State to validate
 * @returns Validation result
 */
export function validateAgentState(state: VLJEPAAgentState): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!state.sessionId) {
    errors.push("Missing sessionId");
  }

  if (!state.query && state.status === "processing") {
    warnings.push("Processing state but no query");
  }

  // Check embedding dimensions
  if (state.vljepa.visualEmbedding.length !== 768) {
    errors.push(
      `Invalid visual embedding dimension: ${state.vljepa.visualEmbedding.length}`
    );
  }

  if (state.vljepa.intentEmbedding.length !== 768) {
    errors.push(
      `Invalid intent embedding dimension: ${state.vljepa.intentEmbedding.length}`
    );
  }

  if (state.vljepa.goalEmbedding.length !== 768) {
    errors.push(
      `Invalid goal embedding dimension: ${state.vljepa.goalEmbedding.length}`
    );
  }

  // Check confidence range
  if (state.vljepa.confidence < 0 || state.vljepa.confidence > 1) {
    warnings.push(`Invalid confidence: ${state.vljepa.confidence}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create VL-JEPA agent state manager
 *
 * @param initialState - Initial state
 * @returns Agent state manager
 */
export function createVLJEPAAgentStateManager(
  initialState?: Partial<VLJEPAAgentState>
): VLJEPAAgentStateManager {
  return new VLJEPAAgentStateManager(initialState);
}

export default VLJEPAAgentStateManager;
