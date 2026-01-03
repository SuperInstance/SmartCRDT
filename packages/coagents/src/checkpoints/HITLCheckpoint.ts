/**
 * @fileoverview Human-in-the-Loop (HITL) Checkpoint System for VL-JEPA + CoAgents
 *
 * ================================================================================
 * VISUAL HITL CHECKPOINT SYSTEM
 * ================================================================================
 *
 * This module provides checkpoint management for visual reasoning actions that
 * require human approval before execution. It integrates with VL-JEPA for
 * visual understanding and CoAgents for workflow orchestration.
 *
 * ================================================================================
 * USE CASES
 * ================================================================================
 *
 * 1. VISUAL CONFIRMATION
 *    - User must approve visual changes before execution
 *    - Shows before/after preview with diff highlights
 *    - Example: "Move button to top-right corner"
 *
 * 2. DESTRUCTIVE ACTIONS
 *    - Irreversible operations require explicit approval
 *    - Blocks execution until approved
 *    - Example: "Delete all user data"
 *
 * 3. LOW CONFIDENCE
 *    - Actions with confidence below threshold need review
 *    - Allows model to learn from corrections
 *    - Example: Confidence < 0.7
 *
 * 4. BATCH ACTIONS
 *    - Multiple similar actions grouped for approval
 *    - Approve all or reject all
 *    - Example: "Update 50 component colors"
 *
 * 5. USER REQUIRED
 *    - Explicit user-requested checkpoints
 *    - For sensitive operations
 *    - Example: "Send email to all users"
 *
 * ================================================================================
 * CHECKPOINT FLOW
 * ================================================================================
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ 1. VL-JEPA Node: Visual reasoning generates actions              │
 * │    Output: VLJEPAAction[] with confidence scores                 │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │ 2. HITLCheckpointManager.createCheckpoint()                     │
 * │    - Check if actions require approval                          │
 * │    - Generate visual diff data                                  │
 * │    - Store checkpoint with expiry                               │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │ 3. Checkpoint Triggered                                        │
 * │    - Execution paused                                          │
 * │    - State saved (for rollback)                                │
 * │    - Checkpoint info sent to frontend                          │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │ 4. CoAgents Frontend: Show checkpoint UI                        │
 * │    - Display before/after preview                              │
 * │    - Show diff highlights                                      │
 * │    - Present approve/reject/modify options                     │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │ 5. User Decision                                               │
 * │    ├─ approve → Execution continues                           │
 * │    ├─ reject → Execution stops, state reverted                 │
 * │    └─ modify → Actions edited, then approved                   │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │ 6. Resume or Terminate                                          │
 * │    - If approved: Actions execute, workflow continues           │
 * │    - If rejected: Workflow stops with error                    │
 * │    - If modified: Modified actions execute                     │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ================================================================================
 * VISUAL DIFF GENERATION
 * ================================================================================
 *
 * The visual diff system shows what will change:
 *
 * ```typescript
 * interface VisualDiffData {
 *   before: {
 *     src: 'data:image/...',      // Current UI state
 *     elements: [...],            // Current element positions
 *     dimensions: { width, height }
 *   },
 *   after: {
 *     elements: [...],            // Predicted element positions
 *     dimensions: { width, height }
 *   },
 *   highlights: [
 *     {
 *       elementId: 'btn-123',
 *       type: 'move',
 *       before: { bbox: { x: 10, y: 10, ... } },
 *       after: { bbox: { x: 100, y: 10, ... } },
 *       color: '#ff0000'          // Highlight color
 *     }
 *   ]
 * }
 * ```
 *
 * ================================================================================
 * ACTION MODIFICATION
 * ================================================================================
 *
 * Users can modify actions before approval:
 *
 * 1. User selects "modify" option
 * 2. Frontend shows action editor
 * 3. User changes parameters (position, color, size, etc.)
 * 4. Modified actions sent to backend
 * 5. Checkpoint status updated to 'modified'
 * 6. Modified actions execute instead of original
 *
 * This enables:
 * - Learning from user corrections
 * - Fine-tuning model predictions
 * - Iterative refinement
 *
 * ================================================================================
 * INTEGRATION POINTS
 * ================================================================================
 *
 * - VL-JEPA Node: Generates visual actions requiring approval
 * - VisualReasoningNode: Detects low-confidence actions
 * - LangGraph: Pauses execution at checkpoint nodes
 * - CoAgents Frontend: Displays checkpoint UI
 * - CheckpointManager: Stores and retrieves checkpoints
 *
 * @see packages/coagents/src/langgraph/VLJEPANode.ts for action generation
 * @see packages/coagents/src/langgraph/VisualReasoningNode.ts for confidence detection
 * @see packages/coagents/src/checkpoints/VisualApproval.ts for approval UI
 *
 * ================================================================================
 * STORAGE OPTIONS
 * ================================================================================
 *
 * - memory: In-memory storage (default, lost on refresh)
 * - indexeddb: Browser persistent storage
 * - remote: Server-side storage (sync across devices)
 */

import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";
import type { VLJEPAAgentState } from "../state/VLJEPAAgentState.js";
import type { VisualUIElement } from "../state/VisualState.js";

// ============================================================================
// CHECKPOINT TYPES
// ============================================================================

/**
 * Checkpoint type
 */
export type CheckpointType =
  | "visual_confirmation"
  | "destructive_action"
  | "low_confidence"
  | "batch_action"
  | "user_required";

/**
 * Checkpoint status
 */
export type CheckpointStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "modified"
  | "expired";

/**
 * Checkpoint configuration
 */
export interface HITLCheckpointConfig {
  /** Checkpoint ID */
  id: string;

  /** Checkpoint type */
  type: CheckpointType;

  /** Checkpoint status */
  status: CheckpointStatus;

  /** Message to display to user */
  message: string;

  /** Actions requiring approval */
  actions: VLJEPAAction[];

  /** Whether approval is required (blocks execution) */
  required: boolean;

  /** Timeout in milliseconds (optional) */
  timeout?: number;

  /** Created timestamp */
  createdAt: number;

  /** Expires timestamp */
  expiresAt?: number;

  /** User decision timestamp */
  decidedAt?: number;

  /** User decision */
  decision?: "approve" | "reject" | "modify";

  /** User feedback */
  feedback?: string;

  /** Modified actions (if user modified) */
  modifiedActions?: VLJEPAAction[];

  /** Visual diff data */
  visualDiff?: VisualDiffData;

  /** Metadata */
  metadata?: {
    /** Session ID */
    sessionId: string;

    /** User ID */
    userId?: string;

    /** Confidence score */
    confidence?: number;

    /** Associated node IDs */
    nodeIds?: string[];

    /** Checkpoint source */
    source?: "vljepa" | "visual_reasoning" | "action_planning" | "manual";
  };
}

/**
 * Visual diff data
 */
export interface VisualDiffData {
  /** Before state (image URL or rendering) */
  before: {
    /** Image data URL or path */
    src: string;

    /** Element states */
    elements: VisualUIElement[];

    /** Dimensions */
    dimensions: { width: number; height: number };
  };

  /** After state (predicted) */
  after: {
    /** Predicted rendering */
    src?: string;

    /** Predicted element states */
    elements: VisualUIElement[];

    /** Dimensions */
    dimensions: { width: number; height: number };
  };

  /** Diff highlights */
  highlights: DiffHighlight[];
}

/**
 * Diff highlight
 */
export interface DiffHighlight {
  /** Element ID */
  elementId: string;

  /** Highlight type */
  type: "add" | "remove" | "modify" | "move" | "resize";

  /** Before state (if applicable) */
  before?: {
    /** Bounding box */
    bbox: { x: number; y: number; width: number; height: number };

    /** Styles */
    styles: Record<string, string>;
  };

  /** After state (if applicable) */
  after?: {
    /** Bounding box */
    bbox: { x: number; y: number; width: number; height: number };

    /** Styles */
    styles: Record<string, string>;
  };

  /** Highlight color (for visualization) */
  color?: string;
}

/**
 * Checkpoint manager configuration
 */
export interface HITLCheckpointManagerConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;

  /** Maximum pending checkpoints */
  maxPending?: number;

  /** Enable visual diff generation */
  enableVisualDiff?: boolean;

  /** Enable action modification */
  enableModification?: boolean;

  /** Enable batch approval */
  enableBatchApproval?: boolean;

  /** Storage backend */
  storage?: "memory" | "indexeddb" | "remote";
}

/**
 * Checkpoint filter options
 */
export interface CheckpointFilterOptions {
  /** Filter by status */
  status?: CheckpointStatus[];

  /** Filter by type */
  type?: CheckpointType[];

  /** Filter by session ID */
  sessionId?: string;

  /** Filter by required flag */
  required?: boolean;

  /** Filter by date range */
  dateRange?: {
    start: number;
    end: number;
  };

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

// ============================================================================
// CHECKPOINT MANAGER
// ============================================================================

/**
 * Human-in-the-Loop Checkpoint Manager
 *
 * Manages checkpoints for visual actions requiring user approval.
 */
export class HITLCheckpointManager {
  private config: Required<HITLCheckpointManagerConfig>;
  private checkpoints: Map<string, HITLCheckpointConfig>;
  private sessionCheckpoints: Map<string, Set<string>>;

  constructor(config: HITLCheckpointManagerConfig = {}) {
    this.config = {
      defaultTimeout: 60000, // 1 minute
      maxPending: 50,
      enableVisualDiff: true,
      enableModification: true,
      enableBatchApproval: true,
      storage: "memory",
      ...config,
    };
    this.checkpoints = new Map();
    this.sessionCheckpoints = new Map();

    // Start cleanup interval
    setInterval(() => this.cleanupExpired(), 30000); // Every 30 seconds
  }

  // ========================================================================
  // CHECKPOINT CREATION
  // ========================================================================

  /**
   * Create a new checkpoint
   *
   * @param type - Checkpoint type
   * @param actions - Actions requiring approval
   * @param message - Message to display
   * @param options - Additional options
   * @returns Checkpoint ID
   */
  async createCheckpoint(
    type: CheckpointType,
    actions: VLJEPAAction[],
    message: string,
    options: {
      required?: boolean;
      timeout?: number;
      sessionId: string;
      visualDiff?: VisualDiffData;
      metadata?: Omit<HITLCheckpointConfig["metadata"], "sessionId">;
    }
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const timeout = options.timeout ?? this.config.defaultTimeout;

    const checkpoint: HITLCheckpointConfig = {
      id,
      type,
      status: "pending",
      message,
      actions,
      required: options.required ?? this.isRequiredByType(type),
      timeout,
      createdAt: now,
      expiresAt: now + timeout,
      visualDiff: options.visualDiff,
      metadata: {
        sessionId: options.sessionId,
        ...options.metadata,
      },
    };

    // Store checkpoint
    this.checkpoints.set(id, checkpoint);

    // Add to session checkpoints
    const sessionSet =
      this.sessionCheckpoints.get(options.sessionId) ?? new Set();
    sessionSet.add(id);
    this.sessionCheckpoints.set(options.sessionId, sessionSet);

    // Enforce max pending limit
    await this.enforceMaxPending();

    return id;
  }

  /**
   * Create visual confirmation checkpoint
   *
   * @param actions - Actions to confirm
   * @param visualDiff - Visual diff data
   * @param sessionId - Session ID
   * @returns Checkpoint ID
   */
  async createVisualCheckpoint(
    actions: VLJEPAAction[],
    visualDiff: VisualDiffData,
    sessionId: string
  ): Promise<string> {
    return await this.createCheckpoint(
      "visual_confirmation",
      actions,
      `Review ${actions.length} visual action(s) before execution`,
      {
        required: false,
        sessionId,
        visualDiff,
        metadata: { source: "vljepa" },
      }
    );
  }

  /**
   * Create destructive action checkpoint
   *
   * @param actions - Destructive actions (delete, remove)
   * @param sessionId - Session ID
   * @returns Checkpoint ID
   */
  async createDestructiveCheckpoint(
    actions: VLJEPAAction[],
    sessionId: string
  ): Promise<string> {
    return await this.createCheckpoint(
      "destructive_action",
      actions,
      `${actions.length} destructive action(s) require approval`,
      {
        required: true,
        sessionId,
        metadata: { source: "vljepa" },
      }
    );
  }

  /**
   * Create low confidence checkpoint
   *
   * @param actions - Low confidence actions
   * @param sessionId - Session ID
   * @param threshold - Confidence threshold
   * @returns Checkpoint ID
   */
  async createLowConfidenceCheckpoint(
    actions: VLJEPAAction[],
    sessionId: string,
    threshold: number = 0.7
  ): Promise<string> {
    const lowConfidence = actions.filter(a => a.confidence < threshold);

    return await this.createCheckpoint(
      "low_confidence",
      lowConfidence,
      `${lowConfidence.length} low-confidence action(s) require approval`,
      {
        required: true,
        sessionId,
        metadata: { source: "vljepa", confidence: threshold },
      }
    );
  }

  // ========================================================================
  // CHECKPOINT APPROVAL
  // ========================================================================

  /**
   * Approve a checkpoint
   *
   * @param checkpointId - Checkpoint ID
   * @param feedback - Optional user feedback
   * @returns Updated checkpoint
   */
  async approveCheckpoint(
    checkpointId: string,
    feedback?: string
  ): Promise<HITLCheckpointConfig> {
    const checkpoint = this.getCheckpoint(checkpointId);

    if (checkpoint.status !== "pending") {
      throw new Error(
        `Checkpoint ${checkpointId} is not pending (status: ${checkpoint.status})`
      );
    }

    if (checkpoint.expiresAt && checkpoint.expiresAt < Date.now()) {
      throw new Error(`Checkpoint ${checkpointId} has expired`);
    }

    checkpoint.status = "approved";
    checkpoint.decision = "approve";
    checkpoint.feedback = feedback;
    checkpoint.decidedAt = Date.now();

    return checkpoint;
  }

  /**
   * Reject a checkpoint
   *
   * @param checkpointId - Checkpoint ID
   * @param reason - Rejection reason
   * @returns Updated checkpoint
   */
  async rejectCheckpoint(
    checkpointId: string,
    reason: string
  ): Promise<HITLCheckpointConfig> {
    const checkpoint = this.getCheckpoint(checkpointId);

    if (checkpoint.status !== "pending") {
      throw new Error(
        `Checkpoint ${checkpointId} is not pending (status: ${checkpoint.status})`
      );
    }

    checkpoint.status = "rejected";
    checkpoint.decision = "reject";
    checkpoint.feedback = reason;
    checkpoint.decidedAt = Date.now();

    return checkpoint;
  }

  /**
   * Modify and approve a checkpoint
   *
   * @param checkpointId - Checkpoint ID
   * @param modifiedActions - Modified actions
   * @param feedback - Optional user feedback
   * @returns Updated checkpoint
   */
  async modifyCheckpoint(
    checkpointId: string,
    modifiedActions: VLJEPAAction[],
    feedback?: string
  ): Promise<HITLCheckpointConfig> {
    if (!this.config.enableModification) {
      throw new Error("Action modification is disabled");
    }

    const checkpoint = this.getCheckpoint(checkpointId);

    if (checkpoint.status !== "pending") {
      throw new Error(
        `Checkpoint ${checkpointId} is not pending (status: ${checkpoint.status})`
      );
    }

    checkpoint.status = "modified";
    checkpoint.decision = "modify";
    checkpoint.modifiedActions = modifiedActions;
    checkpoint.feedback = feedback;
    checkpoint.decidedAt = Date.now();

    return checkpoint;
  }

  /**
   * Batch approve checkpoints
   *
   * @param checkpointIds - Checkpoint IDs to approve
   * @param feedback - Optional feedback for all
   * @returns Approved checkpoints
   */
  async batchApprove(
    checkpointIds: string[],
    feedback?: string
  ): Promise<HITLCheckpointConfig[]> {
    if (!this.config.enableBatchApproval) {
      throw new Error("Batch approval is disabled");
    }

    const approved: HITLCheckpointConfig[] = [];

    for (const id of checkpointIds) {
      try {
        const checkpoint = await this.approveCheckpoint(id, feedback);
        approved.push(checkpoint);
      } catch (error) {
        console.error(`Failed to approve checkpoint ${id}:`, error);
      }
    }

    return approved;
  }

  // ========================================================================
  // CHECKPOINT QUERY
  // ========================================================================

  /**
   * Get checkpoint by ID
   *
   * @param checkpointId - Checkpoint ID
   * @returns Checkpoint
   */
  getCheckpoint(checkpointId: string): HITLCheckpointConfig {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
    return checkpoint;
  }

  /**
   * Get checkpoints by session
   *
   * @param sessionId - Session ID
   * @returns Checkpoint IDs
   */
  getSessionCheckpoints(sessionId: string): string[] {
    const sessionSet = this.sessionCheckpoints.get(sessionId);
    return sessionSet ? Array.from(sessionSet) : [];
  }

  /**
   * Filter checkpoints
   *
   * @param options - Filter options
   * @returns Filtered checkpoints
   */
  filterCheckpoints(options: CheckpointFilterOptions): HITLCheckpointConfig[] {
    let results = Array.from(this.checkpoints.values());

    // Filter by status
    if (options.status && options.status.length > 0) {
      results = results.filter(c => options.status!.includes(c.status));
    }

    // Filter by type
    if (options.type && options.type.length > 0) {
      results = results.filter(c => options.type!.includes(c.type));
    }

    // Filter by session
    if (options.sessionId) {
      results = results.filter(
        c => c.metadata?.sessionId === options.sessionId
      );
    }

    // Filter by required
    if (options.required !== undefined) {
      results = results.filter(c => c.required === options.required);
    }

    // Filter by date range
    if (options.dateRange) {
      results = results.filter(
        c =>
          c.createdAt >= options.dateRange!.start &&
          c.createdAt <= options.dateRange!.end
      );
    }

    // Sort by creation time (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit and offset
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get pending checkpoints
   *
   * @param sessionId - Optional session ID
   * @returns Pending checkpoints
   */
  getPendingCheckpoints(sessionId?: string): HITLCheckpointConfig[] {
    return this.filterCheckpoints({
      status: ["pending"],
      sessionId,
    });
  }

  /**
   * Get required checkpoints (blocking execution)
   *
   * @param sessionId - Session ID
   * @returns Required pending checkpoints
   */
  getRequiredCheckpoints(sessionId: string): HITLCheckpointConfig[] {
    return this.filterCheckpoints({
      status: ["pending"],
      required: true,
      sessionId,
    });
  }

  /**
   * Check if session has blocking checkpoints
   *
   * @param sessionId - Session ID
   * @returns Whether session is blocked
   */
  isSessionBlocked(sessionId: string): boolean {
    const required = this.getRequiredCheckpoints(sessionId);
    return required.length > 0;
  }

  // ========================================================================
  // CHECKPOINT MANAGEMENT
  // ========================================================================

  /**
   * Delete checkpoint
   *
   * @param checkpointId - Checkpoint ID
   */
  deleteCheckpoint(checkpointId: string): void {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      // Remove from session checkpoints
      const sessionSet = this.sessionCheckpoints.get(
        checkpoint.metadata?.sessionId ?? ""
      );
      sessionSet?.delete(checkpointId);

      // Remove checkpoint
      this.checkpoints.delete(checkpointId);
    }
  }

  /**
   * Delete all checkpoints for a session
   *
   * @param sessionId - Session ID
   */
  deleteSessionCheckpoints(sessionId: string): void {
    const checkpointIds = this.getSessionCheckpoints(sessionId);

    for (const id of checkpointIds) {
      this.checkpoints.delete(id);
    }

    this.sessionCheckpoints.delete(sessionId);
  }

  /**
   * Clear all checkpoints
   */
  clearAllCheckpoints(): void {
    this.checkpoints.clear();
    this.sessionCheckpoints.clear();
  }

  /**
   * Cleanup expired checkpoints
   */
  private cleanupExpired(): void {
    const now = Date.now();

    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (checkpoint.expiresAt && checkpoint.expiresAt < now) {
        if (checkpoint.status === "pending") {
          checkpoint.status = "expired";
        }
      }
    }
  }

  /**
   * Enforce max pending limit
   */
  private async enforceMaxPending(): Promise<void> {
    const pending = Array.from(this.checkpoints.values()).filter(
      c => c.status === "pending"
    );

    if (pending.length > this.config.maxPending) {
      // Sort by creation time (oldest first)
      pending.sort((a, b) => a.createdAt - b.createdAt);

      // Mark oldest as expired
      const toExpire = pending.slice(
        0,
        pending.length - this.config.maxPending
      );
      for (const checkpoint of toExpire) {
        checkpoint.status = "expired";
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Determine if checkpoint type is required
   */
  private isRequiredByType(type: CheckpointType): boolean {
    return type === "destructive_action" || type === "user_required";
  }

  /**
   * Get checkpoint statistics
   */
  getStats(sessionId?: string): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    expired: number;
  } {
    const checkpoints = sessionId
      ? this.getSessionCheckpoints(sessionId).map(
          id => this.checkpoints.get(id)!
        )
      : Array.from(this.checkpoints.values());

    return {
      total: checkpoints.length,
      pending: checkpoints.filter(c => c.status === "pending").length,
      approved: checkpoints.filter(c => c.status === "approved").length,
      rejected: checkpoints.filter(c => c.status === "rejected").length,
      modified: checkpoints.filter(c => c.status === "modified").length,
      expired: checkpoints.filter(c => c.status === "expired").length,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): Required<HITLCheckpointManagerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HITLCheckpointManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create HITL checkpoint manager
 *
 * @param config - Manager configuration
 * @returns Checkpoint manager instance
 */
export function createHITLCheckpointManager(
  config?: HITLCheckpointManagerConfig
): HITLCheckpointManager {
  return new HITLCheckpointManager(config);
}

export default HITLCheckpointManager;
