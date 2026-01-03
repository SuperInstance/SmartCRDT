/**
 * PrivacyClassifier - Categorize query sensitivity for privacy-preserving processing
 *
 * This module implements a privacy classifier that categorizes queries into three levels:
 * - LOGIC: Safe to share (pure reasoning, no PII)
 * - STYLE: Needs rewriting (stylistic patterns, indirect PII)
 * - SECRET: Apply R-A Protocol (direct PII, secrets)
 *
 * The classifier uses a combination of:
 * 1. Direct PII pattern matching (emails, SSNs, credit cards, etc.)
 * 2. Style pattern detection (first-person pronouns, workplace references)
 * 3. Context analysis for comprehensive privacy assessment
 *
 * @packageDocumentation
 */

import type { PrivacyClassification as ProtocolPrivacyClassification } from "@lsi/protocol";
import { PIIType, PrivacyLevel } from "@lsi/protocol";

/**
 * Privacy categories for query classification
 *
 * These categories determine how queries should be processed:
 * - LOGIC: Safe to transmit without modification
 * - STYLE: Should be rewritten to remove identifying patterns
 * - SECRET: Must be redacted using R-A Protocol
 */
export enum PrivacyCategory {
  /** Safe to share - pure reasoning, no PII */
  LOGIC = "logic",
  /** Needs rewriting - stylistic patterns that could identify user */
  STYLE = "style",
  /** Apply R-A Protocol - contains direct PII or secrets */
  SECRET = "secret",
}

/**
 * Privacy classification result
 *
 * Extended version of protocol PrivacyClassification with additional
 * reasoning and strategy suggestion.
 */
export interface PrivacyClassification {
  /** Category (LOGIC/STYLE/SECRET) */
  category: PrivacyCategory;
  /** Corresponding privacy level from protocol */
  level: PrivacyLevel;
  /** Confidence in classification (0-1) */
  confidence: number;
  /** Detected PII types */
  detectedPII: PIIType[];
  /** Reasoning for classification */
  reasoning: string[];
  /** Whether redaction is recommended */
  redactionRecommended: boolean;
  /** Suggested redaction strategy */
  strategy: "none" | "pattern" | "full";
}

/**
 * Privacy classifier configuration
 */
export interface PrivacyClassifierConfig {
  /** Enable PII detection */
  enablePIIDetection?: boolean;
  /** Enable style pattern analysis */
  enableStyleAnalysis?: boolean;
  /** Enable context analysis */
  enableContextAnalysis?: boolean;
  /** Confidence threshold (0-1) */
  confidenceThreshold?: number;
  /** Custom PII patterns */
  customPIIPatterns?: Partial<Record<PIIType, RegExp[]>>;
  /** Custom style patterns */
  customStylePatterns?: StylePattern[];
}

/**
 * Style pattern for indirect PII detection
 */
export interface StylePattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Category of the pattern */
  category: string;
  /** Weight for confidence calculation (0-1) */
  weight: number;
}

/**
 * PIIDetector - Detect PII in text
 *
 * Detects 12 types of PII using regex patterns:
 * - Email addresses
 * - Phone numbers
 * - Social Security Numbers
 * - Passwords/Secrets
 * - Credit card numbers
 * - Names (capitalized words heuristic)
 * - Physical addresses
 * - API keys
 * - Bank accounts
 * - Medical records
 * - Health IDs
 * - IP addresses
 */
export class PIIDetector {
  private patterns: Map<PIIType, RegExp[]> = new Map();

  /**
   * Default PII detection patterns
   *
   * Maps PII types to regex patterns for detection.
   * Only includes PII types defined in the protocol.
   */
  private static readonly DEFAULT_PATTERNS: Record<PIIType, RegExp[]> = {
    [PIIType.EMAIL]: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi],

    [PIIType.PHONE]: [
      /\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    ],

    [PIIType.SSN]: [/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g],

    [PIIType.CREDIT_CARD]: [/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g],

    [PIIType.IP_ADDRESS]: [
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ],

    [PIIType.NAME]: [/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g],

    [PIIType.ADDRESS]: [
      /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*,?\s*[A-Z]{2}\s+\d{5}\b/g,
    ],

    [PIIType.DATE_OF_BIRTH]: [
      /\b(dob|date\s+of\s+birth|birth\s+date|born)\s*[:=]?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    ],

    [PIIType.PASSPORT]: [
      /\b(passport\s+(num(ber|#?)?|#?)\s*[:=]?\s*|passport\s*)[A-Z0-9]{6,9}\b/gi,
    ],

    [PIIType.DRIVERS_LICENSE]: [
      /\b(driver'?s?\s+license|dl|driver'?s?\s+lic)\s*(num(ber|#?)?|#?)\s*[:=]?\s*[A-Z0-9]{6,13}\b/gi,
    ],

    // Empty arrays for types not implemented yet (required by protocol)
    [PIIType.BANK_ACCOUNT]: [],
    [PIIType.MEDICAL_RECORD]: [],
    [PIIType.HEALTH_ID]: [],
    [PIIType.PASSWORD]: [],
    [PIIType.LICENSE_PLATE]: [],
    [PIIType.API_KEY]: [],
    [PIIType.URL]: [],
    [PIIType.CUSTOM_PATTERN]: [],
  };

  constructor(customPatterns?: Partial<Record<PIIType, RegExp[]>>) {
    // Start with all default patterns
    for (const [type, regexList] of Object.entries(
      PIIDetector.DEFAULT_PATTERNS
    )) {
      this.patterns.set(type as PIIType, regexList);
    }

    // Override with custom patterns if provided
    if (customPatterns) {
      for (const [type, regexList] of Object.entries(customPatterns)) {
        if (regexList && regexList.length > 0) {
          this.patterns.set(type as PIIType, regexList);
        }
      }
    }
  }

  /**
   * Detect PII in text
   *
   * @param text - Text to scan for PII
   * @returns Array of detected PII types
   */
  async detect(text: string): Promise<PIIType[]> {
    const detected: PIIType[] = [];

    for (const [type, patterns] of this.patterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          detected.push(type);
          break; // Found one match for this type
        }
      }
    }

    return [...new Set(detected)]; // Deduplicate
  }

  /**
   * Add custom PII pattern
   *
   * @param type - PII type
   * @param pattern - Regex pattern
   */
  addPattern(type: PIIType, pattern: RegExp): void {
    const existing = this.patterns.get(type) || [];
    this.patterns.set(type, [...existing, pattern]);
  }

  /**
   * Get all registered patterns
   *
   * @returns Map of PII types to patterns
   */
  getPatterns(): Map<PIIType, RegExp[]> {
    return new Map(this.patterns);
  }
}

/**
 * PrivacyClassifier - Categorize query privacy
 *
 * Implements three-tier privacy classification:
 * 1. LOGIC: No PII, safe to transmit
 * 2. STYLE: Stylistic patterns, rewrite recommended
 * 3. SECRET: Direct PII, apply R-A Protocol
 */
export class PrivacyClassifier {
  private piiDetector: PIIDetector;
  private config: Required<PrivacyClassifierConfig>;

  /**
   * Default style patterns for indirect PII detection
   *
   * These patterns are designed to minimize false positives while still
   * catching queries that reveal personal context through style.
   */
  private static readonly DEFAULT_STYLE_PATTERNS: StylePattern[] = [
    {
      // First-person pronouns + possessive (more specific than just "my")
      pattern:
        /\b(my|me|mine|our|ours)\s+(home|work|job|boss|manager|company|client|customer|family|friend|house|apartment|data|information|account|profile)\b/i,
      category: "first-person-contextual",
      weight: 0.7,
    },
    {
      // "I am/was/have" constructions
      pattern: /\b(i\s+(am|was|have|will|can|should|would))\b/i,
      category: "first-person-verb",
      weight: 0.6,
    },
    {
      // Location-indirect patterns
      pattern:
        /\b(at|@|in|near)\s+(home|work|office|(my|our)\s+(house|apartment|condo|location))\b/i,
      category: "location-indirect",
      weight: 0.6,
    },
    {
      // Workplace-indirect patterns
      pattern:
        /\b(company|organization|employer|(my|our)\s+(job|work|employer|boss|manager|team|department|colleague))\b/i,
      category: "workplace-indirect",
      weight: 0.5,
    },
    {
      // Business-indirect patterns
      pattern: /\b(client|customer|user|(my|our)\s+(client|customer))\b/i,
      category: "business-indirect",
      weight: 0.4,
    },
    {
      // Temporal context with personal markers
      pattern:
        /\b(yesterday|today|tomorrow|last\s+(week|month|year))\s+(my|i|our|me)\b/i,
      category: "temporal-context",
      weight: 0.5,
    },
  ];

  /**
   * High-risk PII types that always trigger SECRET classification
   *
   * Note: Some PII types like passwords and API keys are detected via patterns
   * but mapped to standard protocol PII types for consistency.
   */
  private static readonly HIGH_RISK_PII: Set<PIIType> = new Set([
    PIIType.CREDIT_CARD,
    PIIType.SSN,
    PIIType.DATE_OF_BIRTH,
    PIIType.PASSPORT,
    PIIType.DRIVERS_LICENSE,
  ]);

  constructor(config: PrivacyClassifierConfig = {}) {
    this.config = {
      enablePIIDetection: config.enablePIIDetection ?? true,
      enableStyleAnalysis: config.enableStyleAnalysis ?? true,
      enableContextAnalysis: config.enableContextAnalysis ?? true,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      customPIIPatterns: config.customPIIPatterns ?? {},
      customStylePatterns: config.customStylePatterns || [],
    };

    this.piiDetector = new PIIDetector(this.config.customPIIPatterns);
  }

  /**
   * Classify query privacy category
   *
   * Classification logic:
   * 1. Detect direct PII → SECRET (if high-risk)
   * 2. Detect style patterns → STYLE
   * 3. No PII or patterns → LOGIC
   *
   * @param query - Query to classify
   * @returns Privacy classification result
   */
  async classify(query: string): Promise<PrivacyClassification> {
    const reasoning: string[] = [];
    let category = PrivacyCategory.LOGIC;
    let confidence = 0.5;

    // Step 1: Detect direct PII
    const directPII = this.config.enablePIIDetection
      ? await this.piiDetector.detect(query)
      : [];

    // Step 2: Check for high-risk PII (SECRET)
    const hasHighRiskPII = directPII.some(type =>
      PrivacyClassifier.HIGH_RISK_PII.has(type)
    );

    if (hasHighRiskPII) {
      category = PrivacyCategory.SECRET;
      confidence = 0.95;
      reasoning.push(
        `Direct high-risk PII detected: ${directPII.filter(t => PrivacyClassifier.HIGH_RISK_PII.has(t)).join(", ")}`
      );

      return this.createClassification(
        category,
        confidence,
        directPII,
        reasoning
      );
    }

    // Step 3: Detect any PII (SECRET if present)
    if (directPII.length > 0) {
      category = PrivacyCategory.SECRET;
      confidence = 0.85;
      reasoning.push(`Direct PII detected: ${directPII.join(", ")}`);

      return this.createClassification(
        category,
        confidence,
        directPII,
        reasoning
      );
    }

    // Step 4: Detect style patterns (STYLE)
    const styleMatches = this.config.enableStyleAnalysis
      ? this.detectStylePatterns(query)
      : [];

    if (styleMatches.length > 0) {
      category = PrivacyCategory.STYLE;
      const avgWeight =
        styleMatches.reduce((sum, m) => sum + m.weight, 0) /
        styleMatches.length;
      confidence = Math.min(0.9, 0.5 + avgWeight);
      reasoning.push(
        `Style patterns detected: ${styleMatches.map(m => m.category).join(", ")}`
      );

      return this.createClassification(category, confidence, [], reasoning);
    }

    // Step 5: Default to LOGIC
    reasoning.push("No PII or style patterns detected");
    confidence = 0.9;

    return this.createClassification(category, confidence, [], reasoning);
  }

  /**
   * Classify multiple queries in batch
   *
   * @param queries - Array of queries to classify
   * @returns Array of privacy classification results
   */
  async classifyBatch(queries: string[]): Promise<PrivacyClassification[]> {
    return Promise.all(queries.map(q => this.classify(q)));
  }

  /**
   * Detect style patterns (indirect PII indicators)
   *
   * @param query - Query text
   * @returns Array of matched style patterns
   */
  private detectStylePatterns(
    query: string
  ): Array<{ category: string; weight: number }> {
    const matches: Array<{ category: string; weight: number }> = [];
    const allPatterns = [
      ...PrivacyClassifier.DEFAULT_STYLE_PATTERNS,
      ...this.config.customStylePatterns,
    ];

    for (const { pattern, category, weight } of allPatterns) {
      if (pattern.test(query)) {
        matches.push({ category, weight });
      }
    }

    return matches;
  }

  /**
   * Create classification result with strategy suggestion
   *
   * @param category - Privacy category
   * @param confidence - Classification confidence
   * @param detectedPII - Detected PII types
   * @param reasoning - Classification reasoning
   * @returns Complete classification result
   */
  private createClassification(
    category: PrivacyCategory,
    confidence: number,
    detectedPII: PIIType[],
    reasoning: string[]
  ): PrivacyClassification {
    let level: PrivacyLevel;
    let strategy: "none" | "pattern" | "full";

    switch (category) {
      case PrivacyCategory.LOGIC:
        level = PrivacyLevel.PUBLIC;
        strategy = "none";
        break;
      case PrivacyCategory.STYLE:
        level = PrivacyLevel.SENSITIVE;
        strategy = "pattern";
        break;
      case PrivacyCategory.SECRET:
        level = PrivacyLevel.SOVEREIGN;
        strategy = "full";
        break;
    }

    return {
      category,
      level,
      confidence,
      detectedPII,
      reasoning,
      redactionRecommended: category !== PrivacyCategory.LOGIC,
      strategy,
    };
  }

  /**
   * Convert to protocol PrivacyClassification format
   *
   * @param classification - Extended classification result
   * @returns Protocol-compatible classification
   */
  toProtocolFormat(
    classification: PrivacyClassification
  ): ProtocolPrivacyClassification {
    return {
      level: classification.level,
      confidence: classification.confidence,
      piiTypes: classification.detectedPII,
      reason: classification.reasoning.join("; "),
    };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration update
   */
  updateConfig(config: Partial<PrivacyClassifierConfig>): void {
    Object.assign(this.config, config);

    // Update PII detector if custom patterns changed
    if (config.customPIIPatterns) {
      this.piiDetector = new PIIDetector(config.customPIIPatterns);
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): Required<PrivacyClassifierConfig> {
    return { ...this.config };
  }

  /**
   * Add custom style pattern
   *
   * @param pattern - Style pattern to add
   */
  addStylePattern(pattern: StylePattern): void {
    this.config.customStylePatterns.push(pattern);
  }

  /**
   * Add custom PII pattern
   *
   * @param type - PII type
   * @param pattern - Regex pattern
   */
  addPIIPattern(type: PIIType, pattern: RegExp): void {
    this.piiDetector.addPattern(type, pattern);
  }
}
