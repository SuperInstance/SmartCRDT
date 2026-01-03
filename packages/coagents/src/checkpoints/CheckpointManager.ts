/**
 * @fileoverview Checkpoint Manager - Human-in-the-loop checkpoint system
 *
 * Manages checkpoints where the agent pauses and waits for human intervention.
 * Supports multiple checkpoint types: confirmation, input, approval, correction.
 *
 * Features:
 * - Checkpoint registration
 * - Trigger checkpoints
 * - Wait for human input
 * - Resume after checkpoint
 * - Timeout handling
 */

import type {
  AgentState,
  CheckpointConfig,
  CheckpointResult,
  HumanInput,
} from "../state/index.js";

/**
 * Checkpoint status
 */
export type CheckpointStatus = "pending" | "approved" | "rejected" | "timeout";

/**
 * Active checkpoint with status
 */
export interface ActiveCheckpoint extends CheckpointResult {
  /** Checkpoint status */
  status: CheckpointStatus;
  /** Human input if received */
  input?: HumanInput;
  /** Timestamp when checkpoint was resolved */
  resolvedAt?: number;
}

/**
 * Checkpoint manager configuration
 */
export interface CheckpointManagerConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Auto-reject on timeout */
  autoRejectOnTimeout?: boolean;
  /** Maximum active checkpoints */
  maxActiveCheckpoints?: number;
}

/**
 * Checkpoint Manager class
 *
 * Manages the lifecycle of human-in-the-loop checkpoints.
 */
export class CheckpointManager {
  private config: Required<CheckpointManagerConfig>;
  private checkpoints: Map<string, CheckpointConfig> = new Map();
  private activeCheckpoints: Map<string, ActiveCheckpoint> = new Map();
  private waiters: Map<string, (input: HumanInput) => void> = new Map();

  constructor(config: CheckpointManagerConfig = {}) {
    this.config = {
      defaultTimeout: 30000,
      autoRejectOnTimeout: false,
      maxActiveCheckpoints: 10,
      ...config,
    };
  }

  /**
   * Register a checkpoint configuration
   */
  registerCheckpoint(checkpoint: CheckpointConfig): void {
    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  /**
   * Unregister a checkpoint
   */
  unregisterCheckpoint(id: string): void {
    this.checkpoints.delete(id);
  }

  /**
   * Trigger a checkpoint
   */
  async triggerCheckpoint(
    id: string,
    state: AgentState
  ): Promise<CheckpointResult> {
    const config = this.checkpoints.get(id);
    if (!config) {
      throw new Error(`Checkpoint not registered: ${id}`);
    }

    // Check max active checkpoints
    if (this.activeCheckpoints.size >= this.config.maxActiveCheckpoints) {
      throw new Error("Maximum active checkpoints reached");
    }

    // Create active checkpoint
    const active: ActiveCheckpoint = {
      id,
      type: config.type,
      message: config.message,
      state,
      timestamp: Date.now(),
      required: config.required ?? false,
      timeout: config.timeout ?? this.config.defaultTimeout,
      status: "pending",
    };

    this.activeCheckpoints.set(id, active);

    // Wait for human input
    try {
      const input = await this.waitForHumanInput(id);
      active.input = input;
      active.status = input.decision === "approve" ? "approved" : "rejected";
      active.resolvedAt = Date.now();

      return active;
    } catch (error) {
      active.status = "timeout";
      active.resolvedAt = Date.now();
      throw error;
    } finally {
      // Cleanup after resolution
      setTimeout(() => this.activeCheckpoints.delete(id), 60000); // Keep for 1 minute
    }
  }

  /**
   * Wait for human input on a checkpoint
   */
  private async waitForHumanInput(checkpointId: string): Promise<HumanInput> {
    return new Promise((resolve, reject) => {
      const checkpoint = this.activeCheckpoints.get(checkpointId);
      if (!checkpoint) {
        reject(new Error(`Checkpoint not found: ${checkpointId}`));
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.waiters.delete(checkpointId);
        if (this.config.autoRejectOnTimeout) {
          resolve({
            checkpointId,
            decision: "reject",
            feedback: "Auto-rejected due to timeout",
          });
        } else {
          reject(new Error("Checkpoint timeout"));
        }
      }, checkpoint.timeout ?? this.config.defaultTimeout);

      // Store waiter
      this.waiters.set(checkpointId, input => {
        clearTimeout(timeout);
        resolve(input);
      });
    });
  }

  /**
   * Submit human input for a checkpoint
   */
  async submitInput(input: HumanInput): Promise<void> {
    const waiter = this.waiters.get(input.checkpointId);
    if (!waiter) {
      throw new Error(`No pending checkpoint: ${input.checkpointId}`);
    }

    waiter(input);
  }

  /**
   * Approve a checkpoint
   */
  async approveCheckpoint(
    checkpointId: string,
    feedback?: string
  ): Promise<void> {
    await this.submitInput({
      checkpointId,
      decision: "approve",
      feedback,
    });
  }

  /**
   * Reject a checkpoint
   */
  async rejectCheckpoint(checkpointId: string, reason: string): Promise<void> {
    await this.submitInput({
      checkpointId,
      decision: "reject",
      feedback: reason,
    });
  }

  /**
   * Modify checkpoint state (for correction type)
   */
  async modifyCheckpoint(
    checkpointId: string,
    modifications: Partial<AgentState>,
    feedback?: string
  ): Promise<void> {
    await this.submitInput({
      checkpointId,
      decision: "modify",
      feedback,
      modifiedState: modifications,
    });
  }

  /**
   * Get active checkpoint
   */
  getActiveCheckpoint(checkpointId: string): ActiveCheckpoint | undefined {
    return this.activeCheckpoints.get(checkpointId);
  }

  /**
   * Get all active checkpoints
   */
  getActiveCheckpoints(): ActiveCheckpoint[] {
    return Array.from(this.activeCheckpoints.values());
  }

  /**
   * Get checkpoint configuration
   */
  getCheckpointConfig(checkpointId: string): CheckpointConfig | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Check if checkpoint is pending
   */
  isPending(checkpointId: string): boolean {
    const checkpoint = this.activeCheckpoints.get(checkpointId);
    return checkpoint?.status === "pending";
  }

  /**
   * Cancel a pending checkpoint
   */
  cancelCheckpoint(checkpointId: string): void {
    const waiter = this.waiters.get(checkpointId);
    if (waiter) {
      this.waiters.delete(checkpointId);
      const active = this.activeCheckpoints.get(checkpointId);
      if (active) {
        active.status = "rejected";
        active.resolvedAt = Date.now();
      }
    }
  }

  /**
   * Cancel all pending checkpoints
   */
  cancelAllCheckpoints(): void {
    for (const id of this.waiters.keys()) {
      this.cancelCheckpoint(id);
    }
  }

  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints.clear();
    this.activeCheckpoints.clear();
    this.waiters.clear();
  }
}

/**
 * Create default checkpoint configurations for Aequor
 */
export function createAequorCheckpoints(): CheckpointConfig[] {
  return [
    {
      id: "privacy-approval",
      type: "confirmation",
      message:
        "Your query contains sensitive information. Do you want to proceed with cloud processing?",
      nodeId: "route_query",
      required: true,
      timeout: 30000,
    },
    {
      id: "route-confirmation",
      type: "approval",
      message:
        "Query will be routed to cloud model. This may incur costs. Proceed?",
      nodeId: "route_query",
      required: false,
      timeout: 15000,
    },
    {
      id: "response-review",
      type: "correction",
      message: "Please review the generated response before finalizing.",
      nodeId: "generate_response",
      required: false,
      timeout: 60000,
    },
    {
      id: "tool-approval",
      type: "confirmation",
      message: "Agent requests to use external tool. Approve?",
      nodeId: "generate_response",
      required: true,
      timeout: 20000,
    },
  ];
}

export default CheckpointManager;
