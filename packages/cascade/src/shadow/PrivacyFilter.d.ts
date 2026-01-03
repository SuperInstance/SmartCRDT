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
export declare enum DataSensitivity {
    /** SOVEREIGN: Never log - highest privacy (user's private data with PII) */
    SOVEREIGN = "sovereign",
    /** SENSITIVE: Log with redaction - contains PII but no user markers */
    SENSITIVE = "sensitive",
    /** PUBLIC: Log as-is - no PII detected */
    PUBLIC = "public"
}
/**
 * PII types that can be detected and redacted
 */
export declare enum PIIType {
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
    URL = "URL"
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
 * PrivacyFilter - Classify and filter query data by sensitivity
 *
 * Implements three-tier privacy classification:
 * 1. SOVEREIGN: User's personal data (user markers + PII) - NEVER log
 * 2. SENSITIVE: Contains PII but no user markers - Redact before logging
 * 3. PUBLIC: No PII detected - Log as-is
 */
export declare class PrivacyFilter {
    private config;
    private piiPatterns;
    constructor(config?: PrivacyFilterConfig);
    /**
     * Classify query sensitivity and apply redaction if needed
     *
     * @param query - Query text
     * @param response - Response text
     * @returns Privacy filter result with classification and redaction
     */
    filter(query: string, response: string): Promise<PrivacyFilterResult>;
    /**
     * Detect PII in text using regex patterns
     *
     * @param text - Text to scan for PII
     * @returns Array of detected PII instances
     */
    private detectPII;
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
    private classifySensitivity;
    /**
     * Check if text contains user markers
     *
     * @param text - Text to check
     * @returns True if user markers found
     */
    private hasUserMarkers;
    /**
     * Redact PII from text
     *
     * @param text - Text to redact
     * @param pii - Array of PII detections
     * @returns Redacted text
     */
    private redact;
    /**
     * Get replacement text for a PII type
     *
     * @param type - PII type
     * @returns Replacement token
     */
    private getReplacement;
    /**
     * Generate human-readable reason for classification
     *
     * @param sensitivity - Data sensitivity level
     * @param detectedPII - Detected PII instances
     * @returns Classification reason
     */
    private getReason;
    /**
     * Update configuration
     *
     * @param config - New configuration (partial update)
     */
    updateConfig(config: Partial<PrivacyFilterConfig>): void;
    /**
     * Get current configuration
     *
     * @returns Current privacy filter configuration
     */
    getConfig(): PrivacyFilterConfig;
}
//# sourceMappingURL=PrivacyFilter.d.ts.map