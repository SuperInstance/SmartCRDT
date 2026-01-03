/**
 * @lsi/privacy - Byzantine Ensemble Module
 *
 * This module provides Byzantine-resilient ensemble capabilities for
 * privacy-preserving inference with multiple models.
 */

// Main ensemble class
export {
  ByzantineEnsemble,
  type EnsembleConfig,
  type EnsembleRequest,
  type EnsembleResponse,
  type ModelAdapter,
  type VotingMechanismType,
} from "./ByzantineEnsemble.js";

// Voting mechanisms
export {
  VotingMechanism,
  type IndividualResponse,
  type Vote,
  type VotingResult,
  type ReputationScore,
} from "./VotingMechanism.js";

// Fault detection
export {
  FaultDetector,
  type FaultDetectionConfig,
  type FaultReport,
  type FaultReason,
  type OutlierMethod,
} from "./FaultDetector.js";
