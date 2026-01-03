/**
 * @fileoverview Visual Approval Checkpoint System
 *
 * Specialized checkpoint system for visual action approval with
 * before/after preview, action modification, and rollback support.
 *
 * @version 1.0.0
 */

import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";
import type { VisualUIElement } from "../state/VisualState.js";
import type { VLJEPAAgentState } from "../state/VLJEPAAgentState.js";
import type {
  HITLCheckpointManager,
  HITLCheckpointConfig,
  VisualDiffData,
  CheckpointType,
} from "./HITLCheckpoint.js";

// ============================================================================
// VISUAL APPROVAL TYPES
// ============================================================================

/**
 * Visual approval state
 */
export interface VisualApprovalState {
  /** Approval ID */
  id: string;

  /** Approval status */
  status: "pending" | "approved" | "rejected" | "modified";

  /** Original actions */
  originalActions: VLJEPAAction[];

  /** Modified actions (if any) */
  modifiedActions?: VLJEPAAction[];

  /** Current visual state (before) */
  beforeState: VisualStateSnapshot;

  /** Predicted visual state (after) */
  afterState: VisualStateSnapshot;

  /** User selections */
  userSelections: UserSelection[];

  /** Timestamps */
  createdAt: number;
  expiresAt?: number;
  decidedAt?: number;
}

/**
 * Visual state snapshot
 */
export interface VisualStateSnapshot {
  /** Elements in state */
  elements: VisualUIElement[];

  /** Image data URL or path */
  imageSrc?: string;

  /** Dimensions */
  dimensions: {
    width: number;
    height: number;
  };

  /** Timestamp */
  timestamp: number;

  /** State hash (for comparison) */
  hash: string;
}

/**
 * User selection on approval
 */
export interface UserSelection {
  /** Selection type */
  type: "approve_all" | "approve_some" | "reject_all" | "modify" | "defer";

  /** Selected action IDs */
  actionIds: string[];

  /** Modified actions (if modifying) */
  modifiedActions?: VLJEPAAction[];

  /** User feedback */
  feedback?: string;

  /** Confidence in decision */
  confidence?: number;
}

/**
 * Visual approval options
 */
export interface VisualApprovalOptions {
  /** Enable before/after preview */
  enablePreview?: boolean;

  /** Enable individual action approval */
  enableGranularApproval?: boolean;

  /** Enable action modification */
  enableModification?: boolean;

  /** Enable defer (skip for now) */
  enableDefer?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Show visual diff */
  showDiff?: boolean;

  /** Diff overlay opacity */
  diffOpacity?: number;
}

// ============================================================================
// VISUAL APPROVAL MANAGER
// ============================================================================

/**
 * Visual Approval Manager
 *
 * Manages visual approval workflow for VL-JEPA actions.
 */
export class VisualApprovalManager {
  private checkpointManager: HITLCheckpointManager;
  private approvals: Map<string, VisualApprovalState>;
  private history: VisualApprovalHistoryEntry[];
  private config: Required<VisualApprovalOptions>;

  constructor(
    checkpointManager: HITLCheckpointManager,
    options: VisualApprovalOptions = {}
  ) {
    this.checkpointManager = checkpointManager;
    this.approvals = new Map();
    this.history = [];
    this.config = {
      enablePreview: true,
      enableGranularApproval: true,
      enableModification: true,
      enableDefer: true,
      timeout: 60000,
      showDiff: true,
      diffOpacity: 0.3,
      ...options,
    };
  }

  // ========================================================================
  // APPROVAL CREATION
  // ========================================================================

  /**
   * Create visual approval for actions
   *
   * @param actions - Actions to approve
   * @param beforeState - Current visual state
   * @param afterState - Predicted visual state
   * @param sessionId - Session ID
   * @returns Approval ID
   */
  async createApproval(
    actions: VLJEPAAction[],
    beforeState: VisualStateSnapshot,
    afterState: VisualStateSnapshot,
    sessionId: string
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const approval: VisualApprovalState = {
      id,
      status: "pending",
      originalActions: actions,
      beforeState,
      afterState,
      userSelections: [],
      createdAt: now,
      expiresAt: now + this.config.timeout,
    };

    this.approvals.set(id, approval);

    // Create corresponding checkpoint
    const visualDiff: VisualDiffData = {
      before: {
        src: beforeState.imageSrc ?? "",
        elements: beforeState.elements,
        dimensions: beforeState.dimensions,
      },
      after: {
        src: afterState.imageSrc,
        elements: afterState.elements,
        dimensions: afterState.dimensions,
      },
      highlights: this.generateDiffHighlights(beforeState, afterState, actions),
    };

    await this.checkpointManager.createCheckpoint(
      "visual_confirmation",
      actions,
      `Review ${actions.length} visual action(s)`,
      {
        required: false,
        sessionId,
        visualDiff,
        metadata: { source: "visual_approval" },
      }
    );

    return id;
  }

  /**
   * Approve all actions
   *
   * @param approvalId - Approval ID
   * @param feedback - Optional feedback
   * @returns Updated approval
   */
  async approveAll(
    approvalId: string,
    feedback?: string
  ): Promise<VisualApprovalState> {
    const approval = this.getApproval(approvalId);

    if (approval.status !== "pending") {
      throw new Error(`Approval ${approvalId} is not pending`);
    }

    approval.status = "approved";
    approval.userSelections.push({
      type: "approve_all",
      actionIds: approval.originalActions.map(a => a.target),
      feedback,
    });
    approval.decidedAt = Date.now();

    // Add to history
    this.addToHistory(approval);

    return approval;
  }

  /**
   * Approve specific actions
   *
   * @param approvalId - Approval ID
   * @param actionIds - Action IDs to approve
   * @param feedback - Optional feedback
   * @returns Updated approval
   */
  async approveSome(
    approvalId: string,
    actionIds: string[],
    feedback?: string
  ): Promise<VisualApprovalState> {
    const approval = this.getApproval(approvalId);

    if (approval.status !== "pending") {
      throw new Error(`Approval ${approvalId} is not pending`);
    }

    if (!this.config.enableGranularApproval) {
      throw new Error("Granular approval is disabled");
    }

    approval.status = "approved";
    approval.modifiedActions = approval.originalActions.filter(a =>
      actionIds.includes(a.target)
    );
    approval.userSelections.push({
      type: "approve_some",
      actionIds,
      feedback,
    });
    approval.decidedAt = Date.now();

    this.addToHistory(approval);

    return approval;
  }

  /**
   * Reject all actions
   *
   * @param approvalId - Approval ID
   * @param reason - Rejection reason
   * @returns Updated approval
   */
  async rejectAll(
    approvalId: string,
    reason: string
  ): Promise<VisualApprovalState> {
    const approval = this.getApproval(approvalId);

    if (approval.status !== "pending") {
      throw new Error(`Approval ${approvalId} is not pending`);
    }

    approval.status = "rejected";
    approval.userSelections.push({
      type: "reject_all",
      actionIds: approval.originalActions.map(a => a.target),
      feedback: reason,
    });
    approval.decidedAt = Date.now();

    this.addToHistory(approval);

    return approval;
  }

  /**
   * Modify and approve actions
   *
   * @param approvalId - Approval ID
   * @param modifiedActions - Modified actions
   * @param feedback - Optional feedback
   * @returns Updated approval
   */
  async modifyActions(
    approvalId: string,
    modifiedActions: VLJEPAAction[],
    feedback?: string
  ): Promise<VisualApprovalState> {
    const approval = this.getApproval(approvalId);

    if (approval.status !== "pending") {
      throw new Error(`Approval ${approvalId} is not pending`);
    }

    if (!this.config.enableModification) {
      throw new Error("Action modification is disabled");
    }

    approval.status = "modified";
    approval.modifiedActions = modifiedActions;
    approval.userSelections.push({
      type: "modify",
      actionIds: modifiedActions.map(a => a.target),
      modifiedActions,
      feedback,
    });
    approval.decidedAt = Date.now();

    this.addToHistory(approval);

    return approval;
  }

  /**
   * Defer approval (skip for now)
   *
   * @param approvalId - Approval ID
   * @param feedback - Optional feedback
   * @returns Updated approval
   */
  async defer(
    approvalId: string,
    feedback?: string
  ): Promise<VisualApprovalState> {
    const approval = this.getApproval(approvalId);

    if (approval.status !== "pending") {
      throw new Error(`Approval ${approvalId} is not pending`);
    }

    if (!this.config.enableDefer) {
      throw new Error("Defer is disabled");
    }

    approval.status = "rejected"; // Treat rejection as defer
    approval.userSelections.push({
      type: "defer",
      actionIds: [],
      feedback: feedback ?? "Deferred for later",
    });
    approval.decidedAt = Date.now();

    return approval;
  }

  // ========================================================================
  // APPROVAL QUERY
  // ========================================================================

  /**
   * Get approval by ID
   *
   * @param approvalId - Approval ID
   * @returns Approval state
   */
  getApproval(approvalId: string): VisualApprovalState {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    return approval;
  }

  /**
   * Get pending approvals
   *
   * @returns Pending approvals
   */
  getPendingApprovals(): VisualApprovalState[] {
    return Array.from(this.approvals.values()).filter(
      a => a.status === "pending"
    );
  }

  /**
   * Check if there are blocking approvals
   *
   * @returns Whether any approvals are blocking
   */
  hasBlockingApprovals(): boolean {
    // Visual approvals are typically non-blocking
    return false;
  }

  // ========================================================================
  // VISUAL DIFF
  // ========================================================================

  /**
   * Generate diff highlights
   *
   * @param before - Before state
   * @param after - After state
   * @param actions - Actions to highlight
   * @returns Diff highlights
   */
  private generateDiffHighlights(
    before: VisualStateSnapshot,
    after: VisualStateSnapshot,
    actions: VLJEPAAction[]
  ): VisualDiffData["highlights"] {
    const highlights: VisualDiffData["highlights"] = [];

    for (const action of actions) {
      const beforeElement = before.elements.find(
        e => e.selector === action.target
      );
      const afterElement = after.elements.find(
        e => e.selector === action.target
      );

      const highlight: VisualDiffData["highlights"][number] = {
        elementId: action.target,
        type: this.actionToDiffType(action.type),
        before: beforeElement
          ? {
              bbox: beforeElement.bbox,
              styles: beforeElement.styles,
            }
          : undefined,
        after: afterElement
          ? {
              bbox: afterElement.bbox,
              styles: afterElement.styles,
            }
          : undefined,
        color: this.getDiffColor(action.type),
      };

      highlights.push(highlight);
    }

    return highlights;
  }

  /**
   * Convert action type to diff type
   */
  private actionToDiffType(
    actionType: VLJEPAAction["type"]
  ): VisualDiffData["highlights"][number]["type"] {
    switch (actionType) {
      case "create":
        return "add";
      case "delete":
        return "remove";
      case "move":
        return "move";
      case "resize":
        return "resize";
      default:
        return "modify";
    }
  }

  /**
   * Get diff color for action type
   */
  private getDiffColor(actionType: VLJEPAAction["type"]): string {
    switch (actionType) {
      case "create":
        return "#4ade80"; // Green
      case "delete":
        return "#f87171"; // Red
      case "modify":
        return "#60a5fa"; // Blue
      case "move":
        return "#fbbf24"; // Yellow
      case "resize":
        return "#c084fc"; // Purple
      case "restyle":
        return "#2dd4bf"; // Teal
      default:
        return "#9ca3af"; // Gray
    }
  }

  // ========================================================================
  // SNAPSHOT CREATION
  // ========================================================================

  /**
   * Create visual state snapshot
   *
   * @param state - Agent state
   * @returns Visual state snapshot
   */
  createSnapshot(state: VLJEPAAgentState): VisualStateSnapshot {
    return {
      elements: state.visual.elements,
      imageSrc: state.visualContext?.currentFrame.src,
      dimensions: state.visual.dimensions,
      timestamp: Date.now(),
      hash: this.computeStateHash(state),
    };
  }

  /**
   * Compute hash of visual state
   *
   * @param state - Agent state
   * @returns State hash
   */
  private computeStateHash(state: VLJEPAAgentState): string {
    // Simple hash based on elements
    const elementsStr = JSON.stringify(
      state.visual.elements.map(e => ({
        id: e.id,
        type: e.type,
        bbox: e.bbox,
        styles: e.styles,
      }))
    );

    let hash = 0;
    for (let i = 0; i < elementsStr.length; i++) {
      const char = elementsStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  // ========================================================================
  // HISTORY MANAGEMENT
  // ========================================================================

  /**
   * Add approval to history
   *
   * @param approval - Approval to add
   */
  private addToHistory(approval: VisualApprovalState): void {
    const entry: VisualApprovalHistoryEntry = {
      id: approval.id,
      status: approval.status,
      actionCount: approval.originalActions.length,
      approvedActionCount:
        approval.modifiedActions?.length ?? approval.originalActions.length,
      createdAt: approval.createdAt,
      decidedAt: approval.decidedAt!,
      decisionTime: approval.decidedAt! - approval.createdAt,
      userFeedback:
        approval.userSelections[approval.userSelections.length - 1]?.feedback,
    };

    this.history.push(entry);

    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Get approval history
   *
   * @param limit - Maximum entries to return
   * @returns History entries
   */
  getHistory(limit: number = 50): VisualApprovalHistoryEntry[] {
    return this.history.slice(-limit);
  }

  /**
   * Get approval statistics
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    avgDecisionTime: number;
    approvalRate: number;
  } {
    const approvals = Array.from(this.approvals.values());

    const approved = approvals.filter(a => a.status === "approved");
    const rejected = approvals.filter(a => a.status === "rejected");
    const modified = approvals.filter(a => a.status === "modified");

    const avgDecisionTime =
      this.history.length > 0
        ? this.history.reduce((sum, h) => sum + h.decisionTime, 0) /
          this.history.length
        : 0;

    const totalDecisions = approved.length + rejected.length + modified.length;
    const approvalRate =
      totalDecisions > 0
        ? (approved.length + modified.length) / totalDecisions
        : 0;

    return {
      total: approvals.length,
      pending: approvals.filter(a => a.status === "pending").length,
      approved: approved.length,
      rejected: rejected.length,
      modified: modified.length,
      avgDecisionTime,
      approvalRate,
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Cleanup expired approvals
   */
  cleanupExpired(): void {
    const now = Date.now();

    for (const [id, approval] of this.approvals.entries()) {
      if (
        approval.expiresAt &&
        approval.expiresAt < now &&
        approval.status === "pending"
      ) {
        // Mark as rejected (expired)
        approval.status = "rejected";
        approval.userSelections.push({
          type: "reject_all",
          actionIds: [],
          feedback: "Approval expired",
        });
      }
    }
  }

  /**
   * Clear all approvals
   */
  clearAll(): void {
    this.approvals.clear();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get configuration
   */
  getConfig(): Required<VisualApprovalOptions> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VisualApprovalOptions>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// HISTORY ENTRY TYPE
// ============================================================================

/**
 * Visual approval history entry
 */
export interface VisualApprovalHistoryEntry {
  /** Approval ID */
  id: string;

  /** Final status */
  status: VisualApprovalState["status"];

  /** Number of actions */
  actionCount: number;

  /** Number of actions approved */
  approvedActionCount: number;

  /** Creation timestamp */
  createdAt: number;

  /** Decision timestamp */
  decidedAt: number;

  /** Time to decision (ms) */
  decisionTime: number;

  /** User feedback */
  userFeedback?: string;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create visual approval manager
 *
 * @param checkpointManager - Checkpoint manager
 * @param options - Approval options
 * @returns Visual approval manager
 */
export function createVisualApprovalManager(
  checkpointManager: HITLCheckpointManager,
  options?: VisualApprovalOptions
): VisualApprovalManager {
  return new VisualApprovalManager(checkpointManager, options);
}

export default VisualApprovalManager;
