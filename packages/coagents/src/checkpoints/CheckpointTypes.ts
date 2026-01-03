/**
 * @fileoverview Checkpoint Type Definitions
 *
 * Shared type definitions for the checkpoint system.
 */

import type { AgentState } from "../state/SharedStateManager.js";

/**
 * Checkpoint types
 */
export enum CheckpointType {
  /** Simple yes/no confirmation */
  CONFIRMATION = "confirmation",
  /** Requires user input */
  INPUT = "input",
  /** Requires approval before proceeding */
  APPROVAL = "approval",
  /** Allows correction of agent state */
  CORRECTION = "correction",
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Unique checkpoint identifier */
  id: string;
  /** Type of checkpoint */
  type: CheckpointType;
  /** Message to display to user */
  message: string;
  /** Node that triggers this checkpoint */
  nodeId: string;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Whether checkpoint is required to proceed */
  required?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint result
 */
export interface CheckpointResult {
  /** Checkpoint ID */
  id: string;
  /** Checkpoint type */
  type: CheckpointType;
  /** Message displayed to user */
  message: string;
  /** Agent state at checkpoint */
  state: AgentState;
  /** When checkpoint was triggered */
  timestamp: number;
  /** Whether checkpoint is required */
  required: boolean;
  /** Timeout if applicable */
  timeout?: number;
}

/**
 * Human input for checkpoint
 */
export interface HumanInput {
  /** Checkpoint ID */
  checkpointId: string;
  /** User decision */
  decision: "approve" | "reject" | "modify";
  /** Optional feedback */
  feedback?: string;
  /** Modified state (for correction type) */
  modifiedState?: Partial<AgentState>;
}

/**
 * Checkpoint status
 */
export enum CheckpointStatus {
  /** Checkpoint is pending human input */
  PENDING = "pending",
  /** Checkpoint was approved */
  APPROVED = "approved",
  /** Checkpoint was rejected */
  REJECTED = "rejected",
  /** Checkpoint timed out */
  TIMEOUT = "timeout",
}

/**
 * Active checkpoint with status
 */
export interface ActiveCheckpoint extends CheckpointResult {
  /** Current status */
  status: CheckpointStatus;
  /** Human input if received */
  input?: HumanInput;
  /** When checkpoint was resolved */
  resolvedAt?: number;
}

/**
 * Checkpoint event
 */
export interface CheckpointEvent {
  /** Event type */
  type: "triggered" | "approved" | "rejected" | "timeout" | "cancelled";
  /** Checkpoint ID */
  checkpointId: string;
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data?: Record<string, unknown>;
}

export default {
  CheckpointType,
  CheckpointStatus,
};
