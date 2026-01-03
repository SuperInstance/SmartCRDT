/**
 * A2UI Integration - Main export
 */

export {
  IntentEncoderBridge,
  createIntentEncoderBridge,
} from "./IntentEncoderBridge.js";
export {
  IntentToUIMapper,
  createIntentToUIMapper,
  INTENT_DIMENSIONS,
  INTENT_PATTERNS,
} from "./IntentToUIMapper.js";

export type {
  IntentEncoderBridgeConfig,
  IntentToUIContext,
  IntentBasedUIOptions,
  IntentDimension,
  IntentPattern,
  MappingContext,
  UIRequirementHistory,
  UserProfile,
  UserPreference,
};
