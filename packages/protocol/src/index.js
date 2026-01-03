"use strict";
/**
 * @lsi/protocol - Core protocol types for Aequor Cognitive Orchestration Platform
 *
 * This package defines all shared interfaces and types used across the Aequor ecosystem.
 * All other packages depend on this for type definitions.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATP_ERROR_HANDLING = exports.ATP_FLOW_CONTROL = exports.ATP_RESPONSE_SCHEMA = exports.ATP_FOOTER_SCHEMA = exports.ATP_HEADER_SCHEMA = exports.ATP_PACKET_FIELDS = exports.buildConstraintTest = exports.buildBehaviorTest = exports.buildMessageTest = exports.buildTypeTest = exports.ComplianceTestRunner = exports.ProtocolComplianceChecker = exports.compareSemVerCompliance = exports.formatSemVerCompliance = exports.parseSemVerCompliance = exports.createExtensionValidationResult = exports.createExtensionContext = exports.formatSemVerExtension = exports.createSemVer = exports.ExtensionValidator = exports.ExtensionLoader = exports.ExtensionRegistry = exports.CARTRIDGE_MANIFEST_SCHEMA = exports.CartridgeState = exports.formatValidationErrors = exports.createValidationResult = exports.ValidationErrorCode = exports.ProtocolValidator = exports.createHandshakeRequest = exports.AggregationStrategy = exports.ACPHandshake = exports.ATPPacketStream = exports.ATPPacketCodec = exports.PacketFlags = exports.ATP_MAGIC = exports.validateConstraint = exports.parseConstraint = exports.createDefaultConstraints = exports.ConstraintSolver = exports.OptimizationStrategy = exports.ConstraintType = exports.PIIType = exports.PrivacyLevel = exports.ProtocolErrorType = exports.CollaborationMode = exports.Urgency = exports.IntentCategory = exports.IntegrationPIIType = exports.IntegrationPrivacyLevel = exports.TrainingStatus = void 0;
exports.formatFinalizationValidationErrors = exports.createValidationFailure = exports.createFinalizationValidationResult = exports.FinalizationValidationErrorCode = exports.ProtocolFinalizationValidator = exports.DependencyGraph = exports.satisfiesConstraint = exports.isVersionCompatible = exports.compareSemVerRegistry = exports.formatSemVerRegistry = exports.parseSemVerRegistry = exports.globalProtocolRegistry = exports.ProtocolRegistry = exports.ROLLBACK_SCHEMA = exports.validateVote = exports.validateConsensusProposal = exports.validateRollbackRequest = exports.NOTIFICATION_CHANNEL_TYPES = exports.CONSENSUS_ALGORITHMS = exports.ROLLBACK_STATUS_TYPES = exports.ROLLBACK_STRATEGY_TYPES = exports.ROLLBACK_SCOPE_TYPES = exports.ROLLBACK_REASON_TYPES = exports.NOTIFICATION_CHANNEL_FIELDS = exports.VERIFICATION_METRICS_FIELDS = exports.VERIFICATION_RESULT_FIELDS = exports.CONSENSUS_RESULT_FIELDS = exports.VOTE_FIELDS = exports.CONSENSUS_PROPOSAL_FIELDS = exports.CONSENSUS_CONFIG_FIELDS = exports.ROLLBACK_RESPONSE_FIELDS = exports.ROLLBACK_OPTIONS_FIELDS = exports.ROLLBACK_REQUEST_FIELDS = exports.CARTRIDGE_SCHEMA = exports.validateCartridgeManifest = exports.CARTRIDGE_FILE_ENTRY_FIELDS = exports.CARTRIDGE_CAPABILITIES_FIELDS = exports.CARTRIDGE_MANIFEST_FIELDS = exports.ACP_SCHEMA = exports.validateACPHandshakeResponse = exports.validateACPHandshake = exports.AGGREGATION_STRATEGIES = exports.COLLABORATION_MODES = exports.EXECUTION_STEP_FIELDS = exports.EXECUTION_PLAN_FIELDS = exports.ACP_HANDSHAKE_RESPONSE_FIELDS = exports.ACP_HANDSHAKE_REQUEST_FIELDS = exports.ATP_SCHEMA = exports.validateATPResponse = exports.validateATPacket = void 0;
exports.formatA2UIValidationErrors = exports.getComponentSchema = exports.isValidComponentType = exports.createCatalogEntry = exports.createDefaultSecurityPolicy = exports.sanitizeA2UIProps = exports.validateA2UILayout = exports.validateA2UIComponent = exports.validateA2UIResponse = void 0;
__exportStar(require("./common.js"), exports);
// ============================================================================
// INTEGRATION TYPES (Cross-Package Communication)
// ============================================================================
/**
 * Integration types for cross-package communication
 *
 * Provides protocol interfaces for:
 * - Training (ORPO, LoRA adapters, metrics, events)
 * - Shadow logging (privacy levels, log entries, preference pairs)
 * - SuperInstance (ContextPlane, IntentionPlane, LucidDreamer)
 */
var integration_js_1 = require("./integration.js");
// Training types
Object.defineProperty(exports, "TrainingStatus", { enumerable: true, get: function () { return integration_js_1.TrainingStatus; } });
// Shadow logging types
Object.defineProperty(exports, "IntegrationPrivacyLevel", { enumerable: true, get: function () { return integration_js_1.PrivacyLevel; } });
Object.defineProperty(exports, "IntegrationPIIType", { enumerable: true, get: function () { return integration_js_1.PIIType; } });
// ============================================================================
// ATP/ACP Protocol Types (Autonomous Task Processing & Assisted Collaborative Processing)
// ============================================================================
var atp_acp_js_1 = require("./atp-acp.js");
Object.defineProperty(exports, "IntentCategory", { enumerable: true, get: function () { return atp_acp_js_1.IntentCategory; } });
Object.defineProperty(exports, "Urgency", { enumerable: true, get: function () { return atp_acp_js_1.Urgency; } });
Object.defineProperty(exports, "CollaborationMode", { enumerable: true, get: function () { return atp_acp_js_1.CollaborationMode; } });
Object.defineProperty(exports, "ProtocolErrorType", { enumerable: true, get: function () { return atp_acp_js_1.ProtocolErrorType; } });
Object.defineProperty(exports, "PrivacyLevel", { enumerable: true, get: function () { return atp_acp_js_1.PrivacyLevel; } });
Object.defineProperty(exports, "PIIType", { enumerable: true, get: function () { return atp_acp_js_1.PIIType; } });
// ============================================================================
// CONSTRAINT ALGEBRA (Multi-Objective Routing Optimization)
// ============================================================================
var constraints_js_1 = require("./constraints.js");
Object.defineProperty(exports, "ConstraintType", { enumerable: true, get: function () { return constraints_js_1.ConstraintType; } });
Object.defineProperty(exports, "OptimizationStrategy", { enumerable: true, get: function () { return constraints_js_1.OptimizationStrategy; } });
Object.defineProperty(exports, "ConstraintSolver", { enumerable: true, get: function () { return constraints_js_1.ConstraintSolver; } });
Object.defineProperty(exports, "createDefaultConstraints", { enumerable: true, get: function () { return constraints_js_1.createDefaultConstraints; } });
Object.defineProperty(exports, "parseConstraint", { enumerable: true, get: function () { return constraints_js_1.parseConstraint; } });
Object.defineProperty(exports, "validateConstraint", { enumerable: true, get: function () { return constraints_js_1.validateConstraint; } });
// ============================================================================
// ATP PACKET FORMAT (Wire Format for Autonomous Task Processing)
// ============================================================================
var packet_js_1 = require("./packet.js");
Object.defineProperty(exports, "ATP_MAGIC", { enumerable: true, get: function () { return packet_js_1.ATP_MAGIC; } });
Object.defineProperty(exports, "PacketFlags", { enumerable: true, get: function () { return packet_js_1.PacketFlags; } });
Object.defineProperty(exports, "ATPPacketCodec", { enumerable: true, get: function () { return packet_js_1.ATPPacketCodec; } });
Object.defineProperty(exports, "ATPPacketStream", { enumerable: true, get: function () { return packet_js_1.ATPPacketStream; } });
// ============================================================================
// ACP HANDSHAKE PROTOCOL (Multi-Model Collaboration)
// ============================================================================
var handshake_js_1 = require("./handshake.js");
Object.defineProperty(exports, "ACPHandshake", { enumerable: true, get: function () { return handshake_js_1.ACPHandshake; } });
Object.defineProperty(exports, "AggregationStrategy", { enumerable: true, get: function () { return handshake_js_1.AggregationStrategy; } });
Object.defineProperty(exports, "createHandshakeRequest", { enumerable: true, get: function () { return handshake_js_1.createHandshakeRequest; } });
// ============================================================================
// PROTOCOL VALIDATION SYSTEM
// ============================================================================
var validation_js_1 = require("./validation.js");
Object.defineProperty(exports, "ProtocolValidator", { enumerable: true, get: function () { return validation_js_1.ProtocolValidator; } });
Object.defineProperty(exports, "ValidationErrorCode", { enumerable: true, get: function () { return validation_js_1.ValidationErrorCode; } });
Object.defineProperty(exports, "createValidationResult", { enumerable: true, get: function () { return validation_js_1.createValidationResult; } });
Object.defineProperty(exports, "formatValidationErrors", { enumerable: true, get: function () { return validation_js_1.formatValidationErrors; } });
// ============================================================================
// CARTRIDGE PROTOCOL (Knowledge Cartridge Management)
// ============================================================================
var cartridge_js_1 = require("./cartridge.js");
Object.defineProperty(exports, "CartridgeState", { enumerable: true, get: function () { return cartridge_js_1.CartridgeState; } });
/**
 * JSON Schema for cartridge manifest validation
 *
 * This schema validates the structure and content of cartridge manifests.
 * Use with @lsi/swarm's ManifestLoader or any JSON Schema validator.
 *
 * @example
 * import { CARTRIDGE_MANIFEST_SCHEMA } from '@lsi/protocol';
 * const Ajv = require('ajv');
 * const ajv = new Ajv();
 * const validate = ajv.compile(CARTRIDGE_MANIFEST_SCHEMA);
 */
var cartridge_manifest_js_1 = require("./cartridge-manifest.js");
Object.defineProperty(exports, "CARTRIDGE_MANIFEST_SCHEMA", { enumerable: true, get: function () { return cartridge_manifest_js_1.CARTRIDGE_MANIFEST_SCHEMA; } });
// ============================================================================
// PROTOCOL EXTENSIONS FRAMEWORK (Custom Protocol Extensibility)
// ============================================================================
var extensions_js_1 = require("./extensions.js");
// Extension Registry
Object.defineProperty(exports, "ExtensionRegistry", { enumerable: true, get: function () { return extensions_js_1.ExtensionRegistry; } });
// Extension Loader
Object.defineProperty(exports, "ExtensionLoader", { enumerable: true, get: function () { return extensions_js_1.ExtensionLoader; } });
// Extension Validator
Object.defineProperty(exports, "ExtensionValidator", { enumerable: true, get: function () { return extensions_js_1.ExtensionValidator; } });
// Helper Functions
Object.defineProperty(exports, "createSemVer", { enumerable: true, get: function () { return extensions_js_1.createSemVer; } });
Object.defineProperty(exports, "formatSemVerExtension", { enumerable: true, get: function () { return extensions_js_1.formatSemVer; } });
Object.defineProperty(exports, "createExtensionContext", { enumerable: true, get: function () { return extensions_js_1.createExtensionContext; } });
Object.defineProperty(exports, "createExtensionValidationResult", { enumerable: true, get: function () { return extensions_js_1.createValidationResult; } });
// ============================================================================
// PROTOCOL COMPLIANCE TESTING SUITE (Automated Compliance Checking)
// ============================================================================
var compliance_js_1 = require("./compliance.js");
// SemVer utilities
Object.defineProperty(exports, "parseSemVerCompliance", { enumerable: true, get: function () { return compliance_js_1.parseSemVer; } });
Object.defineProperty(exports, "formatSemVerCompliance", { enumerable: true, get: function () { return compliance_js_1.formatSemVer; } });
Object.defineProperty(exports, "compareSemVerCompliance", { enumerable: true, get: function () { return compliance_js_1.compareSemVer; } });
// Compliance checker
Object.defineProperty(exports, "ProtocolComplianceChecker", { enumerable: true, get: function () { return compliance_js_1.ProtocolComplianceChecker; } });
Object.defineProperty(exports, "ComplianceTestRunner", { enumerable: true, get: function () { return compliance_js_1.ComplianceTestRunner; } });
// Test case builders
Object.defineProperty(exports, "buildTypeTest", { enumerable: true, get: function () { return compliance_js_1.buildTypeTest; } });
Object.defineProperty(exports, "buildMessageTest", { enumerable: true, get: function () { return compliance_js_1.buildMessageTest; } });
Object.defineProperty(exports, "buildBehaviorTest", { enumerable: true, get: function () { return compliance_js_1.buildBehaviorTest; } });
Object.defineProperty(exports, "buildConstraintTest", { enumerable: true, get: function () { return compliance_js_1.buildConstraintTest; } });
// ============================================================================
// PROTOCOL SCHEMAS (Validation Schemas for ATP, ACP, Cartridge, Rollback)
// ============================================================================
var atp_schema_js_1 = require("./schemas/atp-schema.js");
// ATP Schema
Object.defineProperty(exports, "ATP_PACKET_FIELDS", { enumerable: true, get: function () { return atp_schema_js_1.ATP_PACKET_FIELDS; } });
Object.defineProperty(exports, "ATP_HEADER_SCHEMA", { enumerable: true, get: function () { return atp_schema_js_1.ATP_HEADER_SCHEMA; } });
Object.defineProperty(exports, "ATP_FOOTER_SCHEMA", { enumerable: true, get: function () { return atp_schema_js_1.ATP_FOOTER_SCHEMA; } });
Object.defineProperty(exports, "ATP_RESPONSE_SCHEMA", { enumerable: true, get: function () { return atp_schema_js_1.ATP_RESPONSE_SCHEMA; } });
Object.defineProperty(exports, "ATP_FLOW_CONTROL", { enumerable: true, get: function () { return atp_schema_js_1.ATP_FLOW_CONTROL; } });
Object.defineProperty(exports, "ATP_ERROR_HANDLING", { enumerable: true, get: function () { return atp_schema_js_1.ATP_ERROR_HANDLING; } });
Object.defineProperty(exports, "validateATPacket", { enumerable: true, get: function () { return atp_schema_js_1.validateATPacket; } });
Object.defineProperty(exports, "validateATPResponse", { enumerable: true, get: function () { return atp_schema_js_1.validateATPResponse; } });
Object.defineProperty(exports, "ATP_SCHEMA", { enumerable: true, get: function () { return atp_schema_js_1.ATP_SCHEMA; } });
var acp_schema_js_1 = require("./schemas/acp-schema.js");
// ACP Schema
Object.defineProperty(exports, "ACP_HANDSHAKE_REQUEST_FIELDS", { enumerable: true, get: function () { return acp_schema_js_1.ACP_HANDSHAKE_REQUEST_FIELDS; } });
Object.defineProperty(exports, "ACP_HANDSHAKE_RESPONSE_FIELDS", { enumerable: true, get: function () { return acp_schema_js_1.ACP_HANDSHAKE_RESPONSE_FIELDS; } });
Object.defineProperty(exports, "EXECUTION_PLAN_FIELDS", { enumerable: true, get: function () { return acp_schema_js_1.EXECUTION_PLAN_FIELDS; } });
Object.defineProperty(exports, "EXECUTION_STEP_FIELDS", { enumerable: true, get: function () { return acp_schema_js_1.EXECUTION_STEP_FIELDS; } });
Object.defineProperty(exports, "COLLABORATION_MODES", { enumerable: true, get: function () { return acp_schema_js_1.COLLABORATION_MODES; } });
Object.defineProperty(exports, "AGGREGATION_STRATEGIES", { enumerable: true, get: function () { return acp_schema_js_1.AGGREGATION_STRATEGIES; } });
Object.defineProperty(exports, "validateACPHandshake", { enumerable: true, get: function () { return acp_schema_js_1.validateACPHandshake; } });
Object.defineProperty(exports, "validateACPHandshakeResponse", { enumerable: true, get: function () { return acp_schema_js_1.validateACPHandshakeResponse; } });
Object.defineProperty(exports, "ACP_SCHEMA", { enumerable: true, get: function () { return acp_schema_js_1.ACP_SCHEMA; } });
var cartridge_schema_js_1 = require("./schemas/cartridge-schema.js");
// Cartridge Schema
Object.defineProperty(exports, "CARTRIDGE_MANIFEST_FIELDS", { enumerable: true, get: function () { return cartridge_schema_js_1.CARTRIDGE_MANIFEST_FIELDS; } });
Object.defineProperty(exports, "CARTRIDGE_CAPABILITIES_FIELDS", { enumerable: true, get: function () { return cartridge_schema_js_1.CARTRIDGE_CAPABILITIES_FIELDS; } });
Object.defineProperty(exports, "CARTRIDGE_FILE_ENTRY_FIELDS", { enumerable: true, get: function () { return cartridge_schema_js_1.CARTRIDGE_FILE_ENTRY_FIELDS; } });
Object.defineProperty(exports, "validateCartridgeManifest", { enumerable: true, get: function () { return cartridge_schema_js_1.validateCartridgeManifest; } });
Object.defineProperty(exports, "CARTRIDGE_SCHEMA", { enumerable: true, get: function () { return cartridge_schema_js_1.CARTRIDGE_SCHEMA; } });
var rollback_schema_js_1 = require("./schemas/rollback-schema.js");
// Rollback Schema
Object.defineProperty(exports, "ROLLBACK_REQUEST_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_REQUEST_FIELDS; } });
Object.defineProperty(exports, "ROLLBACK_OPTIONS_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_OPTIONS_FIELDS; } });
Object.defineProperty(exports, "ROLLBACK_RESPONSE_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_RESPONSE_FIELDS; } });
Object.defineProperty(exports, "CONSENSUS_CONFIG_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.CONSENSUS_CONFIG_FIELDS; } });
Object.defineProperty(exports, "CONSENSUS_PROPOSAL_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.CONSENSUS_PROPOSAL_FIELDS; } });
Object.defineProperty(exports, "VOTE_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.VOTE_FIELDS; } });
Object.defineProperty(exports, "CONSENSUS_RESULT_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.CONSENSUS_RESULT_FIELDS; } });
Object.defineProperty(exports, "VERIFICATION_RESULT_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.VERIFICATION_RESULT_FIELDS; } });
Object.defineProperty(exports, "VERIFICATION_METRICS_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.VERIFICATION_METRICS_FIELDS; } });
Object.defineProperty(exports, "NOTIFICATION_CHANNEL_FIELDS", { enumerable: true, get: function () { return rollback_schema_js_1.NOTIFICATION_CHANNEL_FIELDS; } });
Object.defineProperty(exports, "ROLLBACK_REASON_TYPES", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_REASON_TYPES; } });
Object.defineProperty(exports, "ROLLBACK_SCOPE_TYPES", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_SCOPE_TYPES; } });
Object.defineProperty(exports, "ROLLBACK_STRATEGY_TYPES", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_STRATEGY_TYPES; } });
Object.defineProperty(exports, "ROLLBACK_STATUS_TYPES", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_STATUS_TYPES; } });
Object.defineProperty(exports, "CONSENSUS_ALGORITHMS", { enumerable: true, get: function () { return rollback_schema_js_1.CONSENSUS_ALGORITHMS; } });
Object.defineProperty(exports, "NOTIFICATION_CHANNEL_TYPES", { enumerable: true, get: function () { return rollback_schema_js_1.NOTIFICATION_CHANNEL_TYPES; } });
Object.defineProperty(exports, "validateRollbackRequest", { enumerable: true, get: function () { return rollback_schema_js_1.validateRollbackRequest; } });
Object.defineProperty(exports, "validateConsensusProposal", { enumerable: true, get: function () { return rollback_schema_js_1.validateConsensusProposal; } });
Object.defineProperty(exports, "validateVote", { enumerable: true, get: function () { return rollback_schema_js_1.validateVote; } });
Object.defineProperty(exports, "ROLLBACK_SCHEMA", { enumerable: true, get: function () { return rollback_schema_js_1.ROLLBACK_SCHEMA; } });
// ============================================================================
// PROTOCOL FINALIZATION (Registry, Validation, Stability)
// ============================================================================
var registry_js_1 = require("./registry.js");
// Protocol Registry
Object.defineProperty(exports, "ProtocolRegistry", { enumerable: true, get: function () { return registry_js_1.ProtocolRegistry; } });
Object.defineProperty(exports, "globalProtocolRegistry", { enumerable: true, get: function () { return registry_js_1.globalProtocolRegistry; } });
// SemVer utilities
Object.defineProperty(exports, "parseSemVerRegistry", { enumerable: true, get: function () { return registry_js_1.parseSemVer; } });
Object.defineProperty(exports, "formatSemVerRegistry", { enumerable: true, get: function () { return registry_js_1.formatSemVer; } });
Object.defineProperty(exports, "compareSemVerRegistry", { enumerable: true, get: function () { return registry_js_1.compareSemVer; } });
Object.defineProperty(exports, "isVersionCompatible", { enumerable: true, get: function () { return registry_js_1.isVersionCompatible; } });
Object.defineProperty(exports, "satisfiesConstraint", { enumerable: true, get: function () { return registry_js_1.satisfiesConstraint; } });
Object.defineProperty(exports, "DependencyGraph", { enumerable: true, get: function () { return registry_js_1.DependencyGraph; } });
var finalization_validation_js_1 = require("./finalization-validation.js");
// Finalization Validator
Object.defineProperty(exports, "ProtocolFinalizationValidator", { enumerable: true, get: function () { return finalization_validation_js_1.ProtocolValidator; } });
Object.defineProperty(exports, "FinalizationValidationErrorCode", { enumerable: true, get: function () { return finalization_validation_js_1.ValidationErrorCode; } });
// Convenience functions
Object.defineProperty(exports, "createFinalizationValidationResult", { enumerable: true, get: function () { return finalization_validation_js_1.createValidationResult; } });
Object.defineProperty(exports, "createValidationFailure", { enumerable: true, get: function () { return finalization_validation_js_1.createValidationFailure; } });
Object.defineProperty(exports, "formatFinalizationValidationErrors", { enumerable: true, get: function () { return finalization_validation_js_1.formatValidationErrors; } });
// ============================================================================
// A2UI PROTOCOL (Agent-to-User Interface Generation)
// ============================================================================
var a2ui_js_1 = require("./a2ui.js");
// Validation Functions
Object.defineProperty(exports, "validateA2UIResponse", { enumerable: true, get: function () { return a2ui_js_1.validateA2UIResponse; } });
Object.defineProperty(exports, "validateA2UIComponent", { enumerable: true, get: function () { return a2ui_js_1.validateA2UIComponent; } });
Object.defineProperty(exports, "validateA2UILayout", { enumerable: true, get: function () { return a2ui_js_1.validateA2UILayout; } });
Object.defineProperty(exports, "sanitizeA2UIProps", { enumerable: true, get: function () { return a2ui_js_1.sanitizeA2UIProps; } });
Object.defineProperty(exports, "createDefaultSecurityPolicy", { enumerable: true, get: function () { return a2ui_js_1.createDefaultSecurityPolicy; } });
Object.defineProperty(exports, "createCatalogEntry", { enumerable: true, get: function () { return a2ui_js_1.createCatalogEntry; } });
Object.defineProperty(exports, "isValidComponentType", { enumerable: true, get: function () { return a2ui_js_1.isValidComponentType; } });
Object.defineProperty(exports, "getComponentSchema", { enumerable: true, get: function () { return a2ui_js_1.getComponentSchema; } });
Object.defineProperty(exports, "formatA2UIValidationErrors", { enumerable: true, get: function () { return a2ui_js_1.formatValidationErrors; } });
/**
 * VL-JEPA Integration Note
 *
 * The full VL-JEPA protocol with 768-dim embeddings, X-Encoder,
 * Y-Encoder, and Predictor is available in the @lsi/vljepa package.
 *
 * @see @lsi/vljepa
 * @see https://arxiv.org/abs/2512.10942
 */
