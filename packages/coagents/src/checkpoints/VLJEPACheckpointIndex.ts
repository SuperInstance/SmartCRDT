/**
 * @fileoverview Checkpoint module exports for VL-JEPA
 */

// HITL Checkpoint Manager
export {
  HITLCheckpointManager,
  createHITLCheckpointManager,
} from "./HITLCheckpoint.js";

export type {
  HITLCheckpointConfig,
  CheckpointType,
  CheckpointStatus,
  VisualDiffData,
  DiffHighlight,
  HITLCheckpointManagerConfig,
  CheckpointFilterOptions,
} from "./HITLCheckpoint.js";

// Visual Approval Manager
export {
  VisualApprovalManager,
  createVisualApprovalManager,
} from "./VisualApproval.js";

export type {
  VisualApprovalState,
  VisualStateSnapshot,
  UserSelection,
  VisualApprovalOptions,
  VisualApprovalHistoryEntry,
} from "./VisualApproval.js";
