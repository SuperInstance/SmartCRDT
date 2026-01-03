"use strict";
/**
 * @lsi/protocol - Integration Types for Cross-Package Communication
 *
 * This module defines protocol interfaces for cross-package integration,
 * particularly for training, shadow logging, and superinstance components.
 *
 * @module integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIIType = exports.PrivacyLevel = exports.TrainingStatus = void 0;
// ============================================================================
// TRAINING INTEGRATION TYPES
// ============================================================================
/**
 * Training status
 */
var TrainingStatus;
(function (TrainingStatus) {
    TrainingStatus["IDLE"] = "idle";
    TrainingStatus["PREPARING"] = "preparing";
    TrainingStatus["TRAINING"] = "training";
    TrainingStatus["EVALUATING"] = "evaluating";
    TrainingStatus["COMPLETED"] = "completed";
    TrainingStatus["FAILED"] = "failed";
    TrainingStatus["CANCELLED"] = "cancelled";
})(TrainingStatus || (exports.TrainingStatus = TrainingStatus = {}));
// ============================================================================
// SHADOW LOGGING INTEGRATION TYPES
// ============================================================================
/**
 * Privacy classification levels
 */
var PrivacyLevel;
(function (PrivacyLevel) {
    /** SOVEREIGN: Never log, never process - highest privacy */
    PrivacyLevel["SOVEREIGN"] = "SOVEREIGN";
    /** SENSITIVE: Log with redaction - PII, personal info */
    PrivacyLevel["SENSITIVE"] = "SENSITIVE";
    /** PUBLIC: Safe to log - no PII or sensitive info */
    PrivacyLevel["PUBLIC"] = "PUBLIC";
})(PrivacyLevel || (exports.PrivacyLevel = PrivacyLevel = {}));
/**
 * PII types
 */
var PIIType;
(function (PIIType) {
    PIIType["EMAIL"] = "EMAIL";
    PIIType["PHONE"] = "PHONE";
    PIIType["SSN"] = "SSN";
    PIIType["PASSWORD"] = "PASSWORD";
    PIIType["CREDIT_CARD"] = "CREDIT_CARD";
    PIIType["NAME"] = "NAME";
    PIIType["ADDRESS"] = "ADDRESS";
    PIIType["API_KEY"] = "API_KEY";
    PIIType["BANK_ACCOUNT"] = "BANK_ACCOUNT";
    PIIType["MEDICAL_RECORD"] = "MEDICAL_RECORD";
    PIIType["HEALTH_ID"] = "HEALTH_ID";
    PIIType["IP_ADDRESS"] = "IP_ADDRESS";
    PIIType["URL"] = "URL";
    PIIType["CUSTOM_PATTERN"] = "CUSTOM_PATTERN";
})(PIIType || (exports.PIIType = PIIType = {}));
