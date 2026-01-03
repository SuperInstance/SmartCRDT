/**
 * Error handling module for Aequor Cognitive Orchestration Platform
 *
 * This module provides a comprehensive error handling framework with:
 * - Typed error classes for different error scenarios
 * - Structured error context for debugging
 * - Recovery strategies for automatic error handling
 * - Clear error messages for production debugging
 *
 * @packageDocumentation
 */
// Base error class
export { AdapterError, ErrorSeverity, RecoveryStrategy, } from "./AdapterError";
// Adapter-specific errors
export { OllamaAdapterError, OllamaErrorCode } from "./OllamaAdapterError";
export { OpenAIAdapterError, OpenAIErrorCode } from "./OpenAIAdapterError";
export { EmbeddingError, EmbeddingErrorCode } from "./EmbeddingError";
// Other errors
export { ValidationError, ValidationErrorCode } from "./ValidationError";
export { RateLimitError, RateLimitErrorCode } from "./RateLimitError";
// Utility functions
export * from "./utils";
//# sourceMappingURL=index.js.map