/**
 * SemanticPIIRedactor - Advanced PII detection and redaction
 *
 * This module implements semantic PII (Personally Identifiable Information) redaction
 * that can identify and redact sensitive information in queries before they are sent
 * to cloud models.
 *
 * Features:
 * - Detects 12 PII types with regex patterns and context-aware analysis
 * - Three redaction strategies: full replacement, partial masking, token-based
 * - Preserves query semantics while redacting sensitive content
 * - Restore/roundtrip support for re-hydrating responses
 *
 * @packageDocumentation
 */

import { PIIType } from "@lsi/protocol";

/**
 * PII instance detected in text
 *
 * Represents a single occurrence of PII with its location and metadata.
 */
export interface PIIInstance {
  /** Type of PII detected */
  type: PIIType;
  /** Start position in the original text */
  start: number;
  /** End position in the original text */
  end: number;
  /** The actual PII value */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Unique ID for this instance (for restore) */
  id: string;
}

/**
 * Redaction strategy
 *
 * Determines how PII is redacted in the output.
 */
export enum RedactionStrategy {
  /** Replace entire PII with placeholder: "[REDACTED_EMAIL]" */
  FULL = "full",
  /** Partially mask PII: "j***@example.com" */
  PARTIAL = "partial",
  /** Replace with token marker: "[EMAIL:abc123]" */
  TOKEN = "token",
}

/**
 * Redacted query result
 *
 * Contains the redacted text and metadata needed for restoration.
 */
export interface RedactedQuery {
  /** The query with PII redacted */
  redacted: string;
  /** All PII instances that were detected */
  piiInstances: PIIInstance[];
  /** Number of redactions performed */
  redactionCount: number;
  /** Strategy used for redaction */
  strategy: RedactionStrategy;
}

/**
 * SemanticPIIRedactor configuration
 */
export interface SemanticPIIRedactorConfig {
  /** Custom PII patterns (overrides defaults) */
  customPatterns?: Partial<Record<PIIType, RegExp[]>>;
  /** Default redaction strategy */
  defaultStrategy?: RedactionStrategy;
  /** Minimum confidence threshold for detection (0-1) */
  confidenceThreshold?: number;
  /** Whether to use context-aware detection */
  useContextAwareDetection?: boolean;
  /** Custom placeholder format (for FULL strategy) */
  placeholderFormat?: string;
}

/**
 * SemanticPIIRedactor - Detect and redact PII in text
 *
 * This class provides comprehensive PII detection and redaction capabilities:
 * - 12 PII types with regex patterns
 * - Context-aware detection to reduce false positives
 * - Three redaction strategies
 * - Roundtrip support (redact + restore)
 */
export class SemanticPIIRedactor {
  private patterns: Map<PIIType, RegExp[]>;
  private config: Required<SemanticPIIRedactorConfig>;
  private idCounter = 0;

  /**
   * Default PII detection patterns
   *
   * Comprehensive regex patterns for detecting 12 PII types.
   * Patterns are designed to minimize false positives while catching real PII.
   */
  private static readonly DEFAULT_PATTERNS: Record<PIIType, RegExp[]> = {
    // Email addresses: user@domain.tld
    [PIIType.EMAIL]: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi],

    // Phone numbers: (123) 456-7890, 123-456-7890, +1-123-456-7890
    [PIIType.PHONE]: [
      /\b\+?1[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      /\b\+?[0-9]{1,3}[-.\s]?\(?[0-9]{3,4}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4,6}\b/g,
    ],

    // Social Security Numbers: 123-45-6789, 123 45 6789, 123456789
    [PIIType.SSN]: [/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g],

    // Credit card numbers: 4111-1111-1111-1111, 4111111111111111, 3782-822463-10005 (Amex)
    [PIIType.CREDIT_CARD]: [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      /\b\d{4}[-\s]?\d{6}[-\s]?\d{5}\b/g, // Amex format
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    ],

    // IP addresses: 192.168.1.1, 10.0.0.1
    [PIIType.IP_ADDRESS]: [
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ],

    // Physical addresses: 123 Main St, Springfield, IL 62701
    [PIIType.ADDRESS]: [
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}\b/g,
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}\b/g,
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+[A-Z]{2}\s+\d{5}\b/g,
    ],

    // Person names (capitalized words - probabilistic)
    [PIIType.NAME]: [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
      /\b[A-Z][a-z]+\s+[A-Z][a-z.]+\s+[A-Z][a-z]+\b/g,
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
    ],

    // Date of birth: DOB: 01/15/1980, born 1980-01-15
    [PIIType.DATE_OF_BIRTH]: [
      /\b(dob|date\s+of\s+birth|birth\s+date|born)\s*[:=]?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
      /\b(dob|date\s+of\s+birth|birth\s+date|born)\s*[:=]?\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/gi,
      /\b(dob|date\s+of\s+birth|birth\s+date|born)\s+(is|=|:)\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    ],

    // Passport numbers: Passport # AB1234567
    [PIIType.PASSPORT]: [
      /\b(passport\s+(num(ber|#?)?|#?)\s*[:=]?\s*|passport\s*)[A-Z0-9]{6,9}\b/gi,
    ],

    // Driver's license: DL# 12345678, Driver's License: AB123456789
    [PIIType.DRIVERS_LICENSE]: [
      /\b(driver'?s?\s+license|dl|driver'?s?\s+lic)\s*(num(ber|#?)?|#?)\s*[:=]?\s*[A-Z0-9]{6,13}\b/gi,
    ],

    // Bank account numbers: Account# 123456789
    [PIIType.BANK_ACCOUNT]: [
      /\b(account\s*(num(ber|#?)?|#?)\s*[:=]?\s*|bank\s+account\s*(num(ber|#?)?|#?)\s*[:=]?\s*)\d{8,17}\b/gi,
    ],

    // Medical record numbers: MRN 12345678, Medical Record #12345678
    [PIIType.MEDICAL_RECORD]: [
      /\b(medical\s+record\s*(num(ber|#?)?|#?)\s*[:#]?\s*|mrn\s*[:#]?\s*)[A-Z0-9]{6,12}\b/gi,
      /\bMedical\s+Record\s*#?\s*[A-Z0-9]{6,12}\b/gi,
      /\bMRN\s*#?\s*[A-Z0-9]{6,12}\b/gi,
    ],

    // Health ID: Patient ID: 12345, Health ID 12345
    [PIIType.HEALTH_ID]: [
      /\b(patient\s+(id|num)|health\s+id|medical\s+id)\s*[:#]?\s*\d{5,12}\b/gi,
      /\bPID\s*#?\s*\d{5,12}\b/gi,
    ],

    // Passwords: Password: secret123
    [PIIType.PASSWORD]: [
      /\b(password|pwd|pass|secret|token)\s*[:=]?\s*[A-Za-z0-9_\-!@#$%^&*()+=]{6,20}\b/gi,
    ],

    // License plates: License: ABC123
    [PIIType.LICENSE_PLATE]: [
      /\b(license\s+(plate|num)|plate\s+num)\s*[:#]?\s*[A-Z]{1,3}[0-9]{1,4}[A-Z]{0,3}\b/gi,
      /\b[A-Z]{1,3}[0-9]{1,4}[A-Z]{0,3}\b/gi,
    ],

    // API keys: API_KEY: abc123def456
    [PIIType.API_KEY]: [
      /\b(api[_-]?key|apikey|api[_-]secret|access[_-]?token)\s*[:=]?\s*[a-zA-Z0-9_\-]{20,64}\b/gi,
    ],

    // URLs: https://api.example.com
    [PIIType.URL]: [
      /\b(?:https?:\/\/)?[\w\-]+(\.[\w\-]+)+[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#]?\b/gi,
    ],

    // Custom patterns: User-defined regex patterns
    [PIIType.CUSTOM_PATTERN]: [],
  };

  /**
   * Context patterns that indicate PII is present (not a false positive)
   *
   * These patterns help distinguish "email me at..." (real PII) from
   * "email me the report" (not PII).
   */
  private static readonly CONTEXT_PATTERNS = {
    [PIIType.EMAIL]: [/\b(email\s+(me|to|at)|send\s+(to|email)|contact)\b/i],
    [PIIType.PHONE]: [/\b(call\s+(me|at)|phone|text|mobile|cell)\b/i],
    [PIIType.SSN]: [/\b(ssn|social\s+security|tax\s+id)\b/i],
    [PIIType.CREDIT_CARD]: [/\b(card|credit\s+card|debit\s+card|payment)\b/i],
    [PIIType.IP_ADDRESS]: [/\b(ip\s*(address)?|server|host|connect\s+to)\b/i],
    [PIIType.ADDRESS]: [/\b(address|location|reside|live|home)\b/i],
    [PIIType.NAME]: [/\b(name|named|called)\b/i],
    [PIIType.DATE_OF_BIRTH]: [/\b(birth|birthday|born)\b/i],
    [PIIType.MEDICAL_RECORD]: [/\b(record|medical|health|clinical)\b/i],
    [PIIType.HEALTH_ID]: [/\b(patient|id\s+number|medical\s+id)\b/i],
    [PIIType.PASSWORD]: [/\b(password|pwd|pass)\b/i],
    [PIIType.LICENSE_PLATE]: [/\b(vehicle|car|license)\b/i],
    [PIIType.PASSPORT]: [/\b(passport|passport\s+number|passport\s+id)\b/i],
    [PIIType.DRIVERS_LICENSE]: [/\b(driver'?s\s*license|dl|license\s*number)\b/i],
  };

  constructor(config: SemanticPIIRedactorConfig = {}) {
    this.config = {
      customPatterns: config.customPatterns || {},
      defaultStrategy: config.defaultStrategy || RedactionStrategy.FULL,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      useContextAwareDetection: config.useContextAwareDetection ?? true,
      placeholderFormat: config.placeholderFormat || "[REDACTED_{type}]",
    };

    // Initialize patterns map with defaults
    this.patterns = new Map();
    for (const [type, regexList] of Object.entries(
      SemanticPIIRedactor.DEFAULT_PATTERNS
    )) {
      this.patterns.set(type as PIIType, [...regexList]);
    }

    // Apply custom patterns
    for (const [type, regexList] of Object.entries(
      this.config.customPatterns
    )) {
      if (regexList && regexList.length > 0) {
        this.patterns.set(type as PIIType, [...regexList]);
      }
    }
  }

  /**
   * Detect all PII instances in text
   *
   * Scans text for all 12 PII types and returns detailed instances with positions.
   * Overlapping detections are resolved by keeping the highest-confidence match.
   *
   * @param query - Text to scan for PII
   * @returns Array of detected PII instances, sorted by position
   */
  detect(query: string): PIIInstance[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const instances: PIIInstance[] = [];

    for (const [type, patterns] of this.patterns.entries()) {
      for (const pattern of patterns) {
        // Clone the pattern to avoid state issues
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        freshPattern.lastIndex = 0;

        let match;
        while ((match = freshPattern.exec(query)) !== null) {
          const value = match[0];
          const start = match.index;
          const end = start + value.length;

          // Check context if enabled
          const confidence = this.config.useContextAwareDetection
            ? this.calculateConfidence(type, query, match)
            : 0.75;

          // Filter by confidence threshold
          if (confidence < this.config.confidenceThreshold) {
            continue;
          }

          instances.push({
            type,
            start,
            end,
            value,
            confidence,
            id: this.generateId(),
          });
        }
      }
    }

    // Remove overlaps and sort by position
    return this.removeOverlaps(instances).sort((a, b) => a.start - b.start);
  }

  /**
   * Redact PII from text
   *
   * Applies the specified redaction strategy to all detected PII instances.
   *
   * @param query - Text to redact
   * @param strategy - Redaction strategy to use (default: from config)
   * @returns Redacted query with metadata
   */
  redact(query: string, strategy?: RedactionStrategy): RedactedQuery {
    const selectedStrategy = strategy || this.config.defaultStrategy;
    const piiInstances = this.detect(query);

    if (piiInstances.length === 0) {
      return {
        redacted: query,
        piiInstances: [],
        redactionCount: 0,
        strategy: selectedStrategy,
      };
    }

    // Apply redaction from right to left to preserve positions
    let redacted = query;
    for (let i = piiInstances.length - 1; i >= 0; i--) {
      const instance = piiInstances[i];
      const replacement = this.getReplacement(instance, selectedStrategy);

      redacted =
        redacted.substring(0, instance.start) +
        replacement +
        redacted.substring(instance.end);
    }

    return {
      redacted,
      piiInstances,
      redactionCount: piiInstances.length,
      strategy: selectedStrategy,
    };
  }

  /**
   * Restore original text from redacted text
   *
   * Re-hydrates a redacted query with the original PII values.
   * This enables the R-A Protocol (redact locally, process cloud, restore locally).
   *
   * @param redacted - Redacted text
   * @param metadata - PII instances from the redaction operation
   * @param strategy - Strategy used for redaction (default: FULL)
   * @returns Original text with PII restored
   */
  restore(
    redacted: string,
    metadata: PIIInstance[],
    strategy: RedactionStrategy = RedactionStrategy.FULL
  ): string {
    if (!redacted || !metadata || metadata.length === 0) {
      return redacted;
    }

    // Restore from right to left to preserve positions
    let restored = redacted;

    for (let i = metadata.length - 1; i >= 0; i--) {
      const instance = metadata[i];
      const placeholder = this.getReplacement(instance, strategy);

      // Find the placeholder in the redacted text
      const placeholderIndex = restored.lastIndexOf(placeholder);

      if (placeholderIndex !== -1) {
        restored =
          restored.substring(0, placeholderIndex) +
          instance.value +
          restored.substring(placeholderIndex + placeholder.length);
      }
    }

    return restored;
  }

  /**
   * Calculate confidence score for a PII detection
   *
   * Uses context patterns to distinguish real PII from false positives.
   *
   * @param type - PII type
   * @param text - Full text
   * @param match - Regex match
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    type: PIIType,
    text: string,
    match: RegExpExecArray
  ): number {
    // Default confidence
    let confidence = 0.85;

    // Check for context patterns
    const contextPatterns = SemanticPIIRedactor.CONTEXT_PATTERNS[type as keyof typeof SemanticPIIRedactor.CONTEXT_PATTERNS];
    if (contextPatterns) {
      const textLower = text.toLowerCase();
      const hasContext = contextPatterns.some((pattern: RegExp) =>
        pattern.test(textLower)
      );

      if (hasContext) {
        confidence = 0.95; // High confidence with context
      } else {
        confidence = 0.75; // Moderate confidence without context
      }
    }

    // Adjust confidence based on PII type
    const highRiskTypes = [
      PIIType.SSN,
      PIIType.CREDIT_CARD,
      PIIType.PASSPORT,
      PIIType.DRIVERS_LICENSE,
      PIIType.DATE_OF_BIRTH,
    ];

    if (highRiskTypes.includes(type)) {
      confidence = Math.min(0.98, confidence + 0.1);
    }

    return confidence;
  }

  /**
   * Get replacement string for a PII instance
   *
   * Generates the appropriate replacement based on the redaction strategy.
   *
   * @param instance - PII instance
   * @param strategy - Redaction strategy
   * @returns Replacement string
   */
  private getReplacement(
    instance: PIIInstance,
    strategy: RedactionStrategy
  ): string {
    switch (strategy) {
      case RedactionStrategy.FULL:
        return this.config.placeholderFormat.replace(
          "{type}",
          instance.type.toUpperCase()
        );

      case RedactionStrategy.PARTIAL:
        return this.partialMask(instance);

      case RedactionStrategy.TOKEN:
        return `[${instance.type.toUpperCase()}:${instance.id}]`;

      default:
        return "[REDACTED]";
    }
  }

  /**
   * Generate partial mask for PII value
   *
   * Shows first and last characters, masks the middle.
   * Adapted based on PII type for better readability.
   *
   * @param instance - PII instance
   * @returns Partially masked string
   */
  private partialMask(instance: PIIInstance): string {
    const value = instance.value;

    switch (instance.type) {
      case PIIType.EMAIL:
        // j***@example.com
        const emailParts = value.split("@");
        if (emailParts.length === 2) {
          const local = emailParts[0];
          const domain = emailParts[1];
          const maskedLocal =
            local.charAt(0) + "*".repeat(Math.max(3, local.length - 1));
          return `${maskedLocal}@${domain}`;
        }
        return value.charAt(0) + "*".repeat(value.length - 1);

      case PIIType.PHONE:
        // Mask all digits except last 4
        const phoneDigits = value.replace(/\D/g, "");
        if (phoneDigits.length >= 7) {
          const visibleLast4 = phoneDigits.slice(-4);
          const maskedPart = "*".repeat(phoneDigits.length - 4);
          const fullDigits = maskedPart + visibleLast4;
          // Replace all digit sequences with the masked version
          let result = value;
          let digitIndex = 0;
          result = result.replace(/\d/g, () => fullDigits[digitIndex++]);
          return result;
        }
        // Simple fallback: mask all but last 4 digits
        return value.replace(/\d(?=.*\d{4})/g, "*");

      case PIIType.CREDIT_CARD:
        // 4111-****-****-1111
        const groups = value.replace(/\D/g, "").match(/.{1,4}/g) || [];
        if (groups.length === 4) {
          return `${groups[0]}-****-****-${groups[3]}`;
        }
        return value.replace(/\d(?=.{4})/g, "*");

      case PIIType.SSN:
        // ***-**-6789
        const ssnParts = value.replace(/\D/g, "");
        if (ssnParts.length === 9) {
          return `***-**-${ssnParts.substring(5)}`;
        }
        return "*".repeat(value.length);

      case PIIType.IP_ADDRESS:
        // 192.***.*.1
        const octets = value.split(".");
        if (octets.length === 4) {
          return `${octets[0]}.***.*.${octets[3]}`;
        }
        return value;

      default:
        // Generic: first 2 chars + asterisks
        if (value.length <= 4) {
          return "*".repeat(value.length);
        }
        return value.substring(0, 2) + "*".repeat(value.length - 2);
    }
  }

  /**
   * Remove overlapping PII instances
   *
   * When multiple detections overlap, keep the one with highest confidence.
   *
   * @param instances - All detected instances
   * @returns Non-overlapping instances
   */
  private removeOverlaps(instances: PIIInstance[]): PIIInstance[] {
    if (instances.length === 0) {
      return [];
    }

    // Sort by start position, then by confidence (descending)
    const sorted = [...instances].sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return b.confidence - a.confidence;
    });

    const nonOverlapping: PIIInstance[] = [];

    for (const instance of sorted) {
      const overlaps = nonOverlapping.some(
        existing =>
          instance.start < existing.end && instance.end > existing.start
      );

      if (!overlaps) {
        nonOverlapping.push(instance);
      }
    }

    return nonOverlapping;
  }

  /**
   * Generate unique ID for PII instance
   *
   * @returns Unique ID string
   */
  private generateId(): string {
    return `pii_${Date.now()}_${this.idCounter++}`;
  }

  /**
   * Add custom PII detection pattern
   *
   * @param type - PII type
   * @param pattern - Regex pattern
   */
  addPattern(type: PIIType, pattern: RegExp): void {
    const existing = this.patterns.get(type) || [];
    this.patterns.set(type, [...existing, pattern]);
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration update
   */
  updateConfig(config: Partial<SemanticPIIRedactorConfig>): void {
    Object.assign(this.config, config);

    if (config.customPatterns) {
      for (const [type, regexList] of Object.entries(config.customPatterns)) {
        if (regexList && regexList.length > 0) {
          this.patterns.set(type as PIIType, [...regexList]);
        }
      }
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): Required<SemanticPIIRedactorConfig> {
    return { ...this.config };
  }
}
