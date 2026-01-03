/**
 * @fileoverview Apply Privacy Node - LangGraph node for privacy application
 *
 * Node that applies privacy transformations using the Redaction-Addition Protocol.
 */

import type { AequorState } from "../state/index.js";

/**
 * Apply privacy node handler
 *
 * Applies privacy transformations based on privacy level:
 * - Public: No transformation
 * - Sensitive: Redact PII
 * - Sovereign: Redact + Intent encoding only
 */
export async function applyPrivacyNode(
  state: AequorState
): Promise<Partial<AequorState>> {
  try {
    let processedQuery = state.query;

    switch (state.privacy) {
      case "public":
        // No transformation
        processedQuery = state.query;
        break;

      case "sensitive":
        // Redact PII
        processedQuery = redactPII(state.query);
        break;

      case "sovereign":
        // Only send intent vector, no query content
        processedQuery = "[INTENT_ONLY]";
        break;
    }

    return {
      processedQuery,
      status: "processing",
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to apply privacy",
    };
  }
}

/**
 * Redact PII from query
 */
function redactPII(query: string): string {
  // Simple PII patterns (should use actual PII detector)
  const patterns = [
    { regex: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: "[EMAIL]" },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
    { regex: /\b\d{3}-\d{3}-\d{4}\b/g, replacement: "[PHONE]" },
    { regex: /\b\d{16}\b/g, replacement: "[CREDIT_CARD]" },
  ];

  let redacted = query;
  for (const { regex, replacement } of patterns) {
    redacted = redacted.replace(regex, replacement);
  }

  return redacted;
}

export default applyPrivacyNode;
