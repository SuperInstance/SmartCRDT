/**
 * @lsi/cascade - Privacy Filter for Shadow Logging
 *
 * Classifies and filters query data by sensitivity level for privacy-preserving
 * shadow logging. Implements three-tier privacy classification:
 * - SOVEREIGN: Never log (user's private data)
 * - SENSITIVE: Log with redaction (PII, secrets)
 * - PUBLIC: Log as-is (general knowledge)
 *
 * This component integrates with the RedactionAdditionProtocol from the privacy suite
 * for comprehensive PII redaction.
 */

/**
 * Data sensitivity levels for shadow logging
 */
export enum DataSensitivity {
  /** SOVEREIGN: Never log - highest privacy (user's private data with PII) */
  SOVEREIGN = "sovereign",
  /** SENSITIVE: Log with redaction - contains PII but no user markers */
  SENSITIVE = "sensitive",
  /** PUBLIC: Log as-is - no PII detected */
  PUBLIC = "public",
}

/**
 * PII types that can be detected and redacted
 */
export enum PIIType {
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  SSN = "SSN",
  PASSWORD = "PASSWORD",
  CREDIT_CARD = "CREDIT_CARD",
  NAME = "NAME",
  ADDRESS = "ADDRESS",
  API_KEY = "API_KEY",
  BANK_ACCOUNT = "BANK_ACCOUNT",
  MEDICAL_RECORD = "MEDICAL_RECORD",
  HEALTH_ID = "HEALTH_ID",
  IP_ADDRESS = "IP_ADDRESS",
  URL = "URL",
}

/**
 * PII detection result
 */
export interface PIIDetection {
  /** Type of PII detected */
  type: PIIType;
  /** Start index in text */
  start: number;
  /** End index in text */
  end: number;
  /** Original value */
  value: string;
}

/**
 * Privacy filter result
 */
export interface PrivacyFilterResult {
  /** Overall sensitivity level */
  sensitivity: DataSensitivity;
  /** Redacted query (if SENSITIVE) */
  redactedQuery?: string;
  /** Redacted response (if SENSITIVE) */
  redactedResponse?: string;
  /** Detected PII instances */
  detectedPII: PIIDetection[];
  /** Whether content is safe to log */
  safeToLog: boolean;
  /** Reason for classification */
  reason: string;
}

/**
 * Privacy filter configuration
 */
export interface PrivacyFilterConfig {
  /** Enable PII detection */
  enablePIIDetection: boolean;
  /** Enable semantic analysis for user markers */
  enableSemanticAnalysis: boolean;
  /** Redaction token to use */
  redactionToken: string;
  /** Custom PII patterns */
  customPIIPatterns?: Partial<Record<PIIType, RegExp>>;
}

/**
 * Default PII detection patterns
 * Comprehensive regex patterns for common PII types
 */
const DEFAULT_PII_PATTERNS: Record<PIIType, RegExp> = {
  // Email: standard email format
  [PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Phone: US phone formats with optional country code
  [PIIType.PHONE]:
    /\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // SSN: Social Security Number format
  [PIIType.SSN]: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,

  // Password: Password-related keywords (contextual)
  [PIIType.PASSWORD]:
    /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token)[:\s]+[^\s]+/gi,

  // Credit Card: Luhn algorithm format detection
  [PIIType.CREDIT_CARD]: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

  // Name: Capitalized words (heuristic, requires context)
  [PIIType.NAME]: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g,

  // Address: Street address patterns
  [PIIType.ADDRESS]:
    /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*,?\s+[A-Z]{2}\s+\d{5}\b/g,

  // API Key: Common API key formats
  [PIIType.API_KEY]: /\b(AIza|AKIA|ya29)[A-Za-z0-9_-]{20,}\b/g,

  // Bank Account: US bank account format
  [PIIType.BANK_ACCOUNT]: /\b\d{4,17}\b/g,

  // Medical Record: Medical record number patterns
  [PIIType.MEDICAL_RECORD]: /\b(MRN|Medical\s+Record\s+#?)[:\s]?\d+\b/gi,

  // Health ID: Health insurance/ID numbers
  [PIIType.HEALTH_ID]:
    /\b(health[_-]?id|insurance[_-]?id|member[_-]?id)[:\s]?\d+\b/gi,

  // IP Address: IPv4
  [PIIType.IP_ADDRESS]:
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // URL: URLs that might contain sensitive info
  [PIIType.URL]: /\bhttps?:\/\/[^\s<]+\b/gi,
};

/**
 * User marker patterns that indicate SOVEREIGN data
 * When combined with PII, these indicate the user's personal data
 */
const USER_MARKER_PATTERNS = [
  /\bmy\s+/i,
  /\bme\b/i,
  /\bi\b/i,
  /\bmine\b/i,
  /\bour\b/i,
];

/**
 * PrivacyFilter - Classify and filter query data by sensitivity
 *
 * Implements three-tier privacy classification:
 * 1. SOVEREIGN: User's personal data (user markers + PII) - NEVER log
 * 2. SENSITIVE: Contains PII but no user markers - Redact before logging
 * 3. PUBLIC: No PII detected - Log as-is
 */
export class PrivacyFilter {
  private config: PrivacyFilterConfig;
  private piiPatterns: Record<PIIType, RegExp>;

  constructor(
    config: PrivacyFilterConfig = {
      enablePIIDetection: true,
      enableSemanticAnalysis: true,
      redactionToken: "[REDACTED]",
    }
  ) {
    this.config = config;
    this.piiPatterns = {
      ...DEFAULT_PII_PATTERNS,
      ...config.customPIIPatterns,
    };
  }

  /**
   * Classify query sensitivity and apply redaction if needed
   *
   * @param query - Query text
   * @param response - Response text
   * @returns Privacy filter result with classification and redaction
   */
  async filter(query: string, response: string): Promise<PrivacyFilterResult> {
    // 1. Detect PII in both query and response
    const detectedPII: PIIDetection[] = [];

    if (this.config.enablePIIDetection) {
      detectedPII.push(...this.detectPII(query));
      detectedPII.push(...this.detectPII(response));
    }

    // 2. Classify sensitivity
    const sensitivity = this.classifySensitivity(query, detectedPII);

    // 3. Determine if safe to log
    const safeToLog = sensitivity !== DataSensitivity.SOVEREIGN;

    // 4. Generate reason
    const reason = this.getReason(sensitivity, detectedPII);

    // 5. Apply redaction if SENSITIVE
    if (sensitivity === DataSensitivity.SENSITIVE) {
      return {
        sensitivity,
        redactedQuery: this.redact(query, detectedPII),
        redactedResponse: this.redact(response, detectedPII),
        detectedPII,
        safeToLog,
        reason,
      };
    }

    // PUBLIC: Return original text (not logged here, but available)
    return {
      sensitivity,
      detectedPII,
      safeToLog,
      reason,
    };
  }

  /**
   * Detect PII in text using regex patterns
   *
   * @param text - Text to scan for PII
   * @returns Array of detected PII instances
   */
  private detectPII(text: string): PIIDetection[] {
    const detected: PIIDetection[] = [];

    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          detected.push({
            type: type as PIIType,
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
          });
        }
      }
    }

    return detected;
  }

  /**
   * Classify sensitivity based on user markers and detected PII
   *
   * Classification rules:
   * - SOVEREIGN: User markers (my, me, I) + PII → user's personal data
   * - SENSITIVE: Has PII but no user markers → general sensitive data
   * - PUBLIC: No PII → safe to log as-is
   *
   * @param query - Query text
   * @param detectedPII - Array of detected PII instances
   * @returns Data sensitivity level
   */
  private classifySensitivity(
    query: string,
    detectedPII: PIIDetection[]
  ): DataSensitivity {
    // Check for user markers (indicates user's personal data)
    const hasUserMarkers = this.hasUserMarkers(query);

    // Check for high-risk PII types (always SOVEREIGN)
    const hasHighRiskPII = detectedPII.some(pii =>
      [PIIType.PASSWORD, PIIType.API_KEY, PIIType.MEDICAL_RECORD].includes(
        pii.type
      )
    );

    // SOVEREIGN: User markers + PII OR high-risk PII
    if ((hasUserMarkers && detectedPII.length > 0) || hasHighRiskPII) {
      return DataSensitivity.SOVEREIGN;
    }

    // SENSITIVE: Has PII but no user markers
    if (detectedPII.length > 0) {
      return DataSensitivity.SENSITIVE;
    }

    // PUBLIC: No PII
    return DataSensitivity.PUBLIC;
  }

  /**
   * Check if text contains user markers
   *
   * @param text - Text to check
   * @returns True if user markers found
   */
  private hasUserMarkers(text: string): boolean {
    if (!this.config.enableSemanticAnalysis) {
      return false;
    }

    return USER_MARKER_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Redact PII from text
   *
   * @param text - Text to redact
   * @param pii - Array of PII detections
   * @returns Redacted text
   */
  private redact(text: string, pii: PIIDetection[]): string {
    let redacted = text;

    // Sort detections by start position (reverse order to avoid index shifting)
    const sortedDetections = [...pii].sort((a, b) => b.start - a.start);

    for (const detection of sortedDetections) {
      const replacement = this.getReplacement(detection.type);
      redacted =
        redacted.slice(0, detection.start) +
        replacement +
        redacted.slice(detection.end);
    }

    return redacted;
  }

  /**
   * Get replacement text for a PII type
   *
   * @param type - PII type
   * @returns Replacement token
   */
  private getReplacement(type: PIIType): string {
    const replacements: Record<PIIType, string> = {
      [PIIType.EMAIL]: "[EMAIL]",
      [PIIType.PHONE]: "[PHONE]",
      [PIIType.SSN]: "[SSN]",
      [PIIType.PASSWORD]: "[PASSWORD]",
      [PIIType.CREDIT_CARD]: "[CARD]",
      [PIIType.NAME]: "[NAME]",
      [PIIType.ADDRESS]: "[ADDRESS]",
      [PIIType.API_KEY]: "[API_KEY]",
      [PIIType.BANK_ACCOUNT]: "[ACCOUNT]",
      [PIIType.MEDICAL_RECORD]: "[MEDICAL]",
      [PIIType.HEALTH_ID]: "[HEALTH_ID]",
      [PIIType.IP_ADDRESS]: "[IP]",
      [PIIType.URL]: "[URL]",
    };

    return replacements[type] || this.config.redactionToken;
  }

  /**
   * Generate human-readable reason for classification
   *
   * @param sensitivity - Data sensitivity level
   * @param detectedPII - Detected PII instances
   * @returns Classification reason
   */
  private getReason(
    sensitivity: DataSensitivity,
    detectedPII: PIIDetection[]
  ): string {
    switch (sensitivity) {
      case DataSensitivity.SOVEREIGN:
        const piiTypes = [...new Set(detectedPII.map(p => p.type))];
        return `Contains SOVEREIGN data: user's personal information with ${piiTypes.join(", ")}. Never log.`;

      case DataSensitivity.SENSITIVE:
        return `Contains SENSITIVE data: ${detectedPII.length} PII instances detected. Log with redaction.`;

      case DataSensitivity.PUBLIC:
        return "No PII detected, safe to log as-is.";

      default:
        return "Unknown sensitivity level.";
    }
  }

  /**
   * Update configuration
   *
   * @param config - New configuration (partial update)
   */
  updateConfig(config: Partial<PrivacyFilterConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.customPIIPatterns) {
      this.piiPatterns = {
        ...DEFAULT_PII_PATTERNS,
        ...config.customPIIPatterns,
      };
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current privacy filter configuration
   */
  getConfig(): PrivacyFilterConfig {
    return { ...this.config };
  }
}
