"use strict";
/**
 * ATP and ACP Protocol Types for Aequor Cognitive Orchestration Platform
 *
 * This module defines the core protocol types for inter-model communication:
 * - ATP (Autonomous Task Processing): Single-model query protocol
 * - ACP (Assisted Collaborative Processing): Multi-model query protocol
 *
 * These protocols enable universal AI orchestration by standardizing how requests
 * are structured, routed, and processed across different models and backends.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIIType = exports.PrivacyLevel = exports.ProtocolErrorType = exports.CollaborationMode = exports.Urgency = exports.IntentCategory = void 0;
/**
 * Intent categories for classifying user queries
 *
 * These categories help the routing system understand the nature of a request
 * and select the appropriate model and processing strategy.
 */
var IntentCategory;
(function (IntentCategory) {
    /** Simple informational query */
    IntentCategory["QUERY"] = "query";
    /** Command or instruction to execute */
    IntentCategory["COMMAND"] = "command";
    /** Conversational response */
    IntentCategory["CONVERSATION"] = "conversation";
    /** Code generation request */
    IntentCategory["CODE_GENERATION"] = "code_generation";
    /** Analytical task */
    IntentCategory["ANALYSIS"] = "analysis";
    /** Creative content generation */
    IntentCategory["CREATIVE"] = "creative";
    /** Debugging task */
    IntentCategory["DEBUGGING"] = "debugging";
    /** System-level operation */
    IntentCategory["SYSTEM"] = "system";
    /** Unknown or unclassified intent */
    IntentCategory["UNKNOWN"] = "unknown";
})(IntentCategory || (exports.IntentCategory = IntentCategory = {}));
/**
 * Urgency levels for requests
 *
 * Urgency affects routing decisions, priority queuing, and resource allocation.
 * Higher urgency requests may be routed to faster (more expensive) models.
 */
var Urgency;
(function (Urgency) {
    /** Low priority - can be delayed or batched */
    Urgency["LOW"] = "low";
    /** Normal priority - standard processing */
    Urgency["NORMAL"] = "normal";
    /** High priority - expedited processing */
    Urgency["HIGH"] = "high";
    /** Critical priority - immediate processing required */
    Urgency["CRITICAL"] = "critical";
})(Urgency || (exports.Urgency = Urgency = {}));
/**
 * Collaboration modes for multi-model processing
 *
 * These modes define how multiple models work together in ACP to process a request.
 */
var CollaborationMode;
(function (CollaborationMode) {
    /** Models process one after another, with each model building on the previous output */
    CollaborationMode["SEQUENTIAL"] = "sequential";
    /** Models process simultaneously, with results aggregated */
    CollaborationMode["PARALLEL"] = "parallel";
    /** Output of one model feeds into the next as input */
    CollaborationMode["CASCADE"] = "cascade";
    /** Multiple models process independently, outputs are combined (voting, averaging) */
    CollaborationMode["ENSEMBLE"] = "ensemble";
})(CollaborationMode || (exports.CollaborationMode = CollaborationMode = {}));
/**
 * Protocol error types
 *
 * Standardized error types for ATP/ACP protocol violations and failures.
 */
var ProtocolErrorType;
(function (ProtocolErrorType) {
    /** Invalid packet format */
    ProtocolErrorType["INVALID_PACKET"] = "invalid_packet";
    /** Unknown or unsupported model */
    ProtocolErrorType["UNKNOWN_MODEL"] = "unknown_model";
    /** Collaboration timeout */
    ProtocolErrorType["TIMEOUT"] = "timeout";
    /** Model failure during processing */
    ProtocolErrorType["MODEL_FAILURE"] = "model_failure";
    /** Insufficient permissions */
    ProtocolErrorType["ACCESS_DENIED"] = "access_denied";
    /** Rate limit exceeded */
    ProtocolErrorType["RATE_LIMITED"] = "rate_limited";
})(ProtocolErrorType || (exports.ProtocolErrorType = ProtocolErrorType = {}));
/**
 * Privacy classification levels
 *
 * Determines how queries should be handled with respect to
 * data transmission and storage.
 */
var PrivacyLevel;
(function (PrivacyLevel) {
    /** Safe to transmit to cloud without redaction */
    PrivacyLevel["PUBLIC"] = "public";
    /** Requires selective redaction before cloud transmission */
    PrivacyLevel["SENSITIVE"] = "sensitive";
    /** Must never leave local device */
    PrivacyLevel["SOVEREIGN"] = "sovereign";
})(PrivacyLevel || (exports.PrivacyLevel = PrivacyLevel = {}));
/**
 * PII types supported for detection
 *
 * Supported Personally Identifiable Information types for
 * detection and redaction.
 */
var PIIType;
(function (PIIType) {
    /** Email addresses (e.g., user@example.com) */
    PIIType["EMAIL"] = "email";
    /** Phone numbers (e.g., +1-555-123-4567) */
    PIIType["PHONE"] = "phone";
    /** Social Security Numbers (e.g., 123-45-6789) */
    PIIType["SSN"] = "ssn";
    /** Credit card numbers (e.g., 4111-1111-1111-1111) */
    PIIType["CREDIT_CARD"] = "credit_card";
    /** IP addresses (e.g., 192.168.1.1) */
    PIIType["IP_ADDRESS"] = "ip_address";
    /** Physical addresses */
    PIIType["ADDRESS"] = "address";
    /** Person names (probabilistic) */
    PIIType["NAME"] = "name";
    /** Dates of birth */
    PIIType["DATE_OF_BIRTH"] = "date_of_birth";
    /** Passport numbers */
    PIIType["PASSPORT"] = "passport";
    /** Driver's license numbers */
    PIIType["DRIVERS_LICENSE"] = "drivers_license";
    /** Bank account numbers */
    PIIType["BANK_ACCOUNT"] = "bank_account";
    /** Medical record numbers */
    PIIType["MEDICAL_RECORD"] = "medical_record";
})(PIIType || (exports.PIIType = PIIType = {}));
