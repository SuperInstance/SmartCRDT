/**
 * @lsi/privacy/redaction - Semantic PII Redaction
 *
 * This module provides comprehensive PII detection and redaction capabilities
 * for the Aequor Cognitive Orchestration Platform.
 *
 * Features:
 * - Detects 12 PII types with regex patterns and context-aware analysis
 * - Three redaction strategies: full replacement, partial masking, token-based
 * - Preserves query semantics while redacting sensitive content
 * - Restore/roundtrip support for re-hydrating responses
 *
 * @packageDocumentation
 */

// Main export
export {
  SemanticPIIRedactor,
  RedactionStrategy,
} from "./SemanticPIIRedactor.js";

// Type exports
export type {
  PIIInstance,
  RedactedQuery,
  SemanticPIIRedactorConfig,
} from "./SemanticPIIRedactor.js";
