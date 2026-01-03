/**
 * Redaction-Addition Protocol Implementation
 *
 * Implements functional privacy by:
 * 1. Redacting sensitive data locally
 * 2. Sending structural query to cloud
 * 3. Re-hydrating response with redacted data
 */

import {
  PIIType,
} from "@lsi/protocol";
import type {
  RedactionResult,
  RedactionContext,
} from "@lsi/protocol";

/**
 * Configuration for RedactionAdditionProtocol
 */
export interface RedactionAdditionProtocolConfig {
  /** Enable automatic redaction */
  enableRedaction?: boolean;
  /** PII types to redact */
  redactTypes?: PIIType[];
  /** Preserve format of redacted data */
  preserveFormat?: boolean;
  /** Redaction token */
  redactionToken?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_RAP_CONFIG: RedactionAdditionProtocolConfig = {
  enableRedaction: true,
  redactTypes: [
    PIIType.EMAIL,
    PIIType.PHONE,
    PIIType.SSN,
    PIIType.CREDIT_CARD,
    PIIType.ADDRESS,
  ],
  preserveFormat: true,
  redactionToken: "[REDACTED]",
};

/**
 * RedactionAdditionProtocol - Functional privacy implementation
 *
 * Provides privacy-preserving query processing by redacting sensitive
 * data locally before sending to cloud models, then re-hydrating responses.
 */
export class RedactionAdditionProtocol {
  private config: RedactionAdditionProtocolConfig;

  constructor(config?: Partial<RedactionAdditionProtocolConfig>) {
    this.config = {
      ...DEFAULT_RAP_CONFIG,
      ...config,
    };
  }

  /**
   * Apply redaction to a query
   *
   * @param query - Query text to redact
   * @returns Redaction result with redacted query and context
   */
  async redact(query: string): Promise<RedactionResult> {
    if (!this.config.enableRedaction) {
      return {
        redactedQuery: query,
        context: {
          redactions: new Map(),
          piiTypes: [],
          timestamp: Date.now(),
        },
        redactionCount: 0,
      };
    }

    const redactions = new Map<string, string>();
    const piiTypes: PIIType[] = [];
    let redactedQuery = query;

    // Simple redaction patterns for common PII types
    const patterns = this.getRedactionPatterns();

    for (const pattern of patterns) {
      if (!this.config.redactTypes!.includes(pattern.type)) {
        continue;
      }

      const matches = redactedQuery.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          const marker = this.generateMarker(redactions.size);
          redactions.set(marker, match);
          piiTypes.push(pattern.type);

          // Replace with redaction token
          const redacted = this.config.preserveFormat
            ? this.preserveFormat(match, this.config.redactionToken!)
            : this.config.redactionToken!;

          redactedQuery = redactedQuery.replace(match, redacted);
        }
      }
    }

    return {
      redactedQuery,
      context: {
        redactions,
        piiTypes,
        timestamp: Date.now(),
      },
      redactionCount: redactions.size,
    };
  }

  /**
   * Re-hydrate a response with redacted data
   *
   * @param response - Response text from cloud model
   * @param redactionContext - Redaction context from original query
   * @returns Re-hydrated response with original data restored
   */
  async rehydrate(
    response: string,
    redactionContext: RedactionContext
  ): Promise<string> {
    let rehydrated = response;

    // Restore redacted values
    for (const [marker, originalValue] of redactionContext.redactions.entries()) {
      const token = this.config.preserveFormat
        ? this.preserveFormat(originalValue, this.config.redactionToken!)
        : this.config.redactionToken!;

      rehydrated = rehydrated.replace(token, originalValue);
      rehydrated = rehydrated.replace(marker, originalValue);
    }

    return rehydrated;
  }

  /**
   * Get redaction patterns for common PII types
   */
  private getRedactionPatterns(): Array<{ type: PIIType; regex: RegExp }> {
    return [
      {
        type: PIIType.EMAIL,
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      },
      {
        type: PIIType.PHONE,
        regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      },
      {
        type: PIIType.SSN,
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      },
      {
        type: PIIType.CREDIT_CARD,
        regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      },
    ];
  }

  /**
   * Generate a unique marker for redaction
   */
  private generateMarker(index: number): string {
    return `__REDACTED_${index}__`;
  }

  /**
   * Preserve format of redacted data
   */
  private preserveFormat(value: string, token: string): string {
    // Simple format preservation: keep same length
    if (value.length <= token.length) {
      return token;
    }

    // Return token repeated to match length
    return token.padEnd(value.length, token[token.length - 1]);
  }

  /**
   * Check if a query is safe to process (no sensitive data)
   */
  async isSafeToProcess(query: string): Promise<boolean> {
    const result = await this.redact(query);
    return result.redactionCount === 0;
  }

  /**
   * Get statistics about redaction
   */
  getStats(): {
    totalRedactions: number;
    byType: Record<string, number>;
  } {
    // This would be tracked in a real implementation
    return {
      totalRedactions: 0,
      byType: {},
    };
  }
}
