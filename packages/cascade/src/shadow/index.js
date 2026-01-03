/**
 * @lsi/cascade - Shadow Logging Module
 *
 * Privacy-preserving shadow logging for collecting training data.
 * Implements three-tier privacy classification:
 * - SOVEREIGN: Never log (user's private data)
 * - SENSITIVE: Log with redaction (PII, personal info)
 * - PUBLIC: Log as-is (general knowledge)
 *
 * This module is part of the cascade router's learning infrastructure,
 * designed to collect (query, response) pairs for ORPO training while
 * respecting user privacy.
 */
// PrivacyFilter exports
export { PrivacyFilter } from "./PrivacyFilter";
export { DataSensitivity, PIIType } from "./PrivacyFilter";
// ShadowLogger exports
export { ShadowLogger, createShadowLogger } from "./ShadowLogger";
// PreferencePairGenerator exports
export { PreferencePairGenerator, generatePreferencePairs, exportForORPO, } from "./PreferencePairGenerator";
//# sourceMappingURL=index.js.map