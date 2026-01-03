/**
 * Privacy Classifier for Aequor Cognitive Orchestration Platform
 *
 * This module implements a privacy classification system that categorizes
 * queries into sensitivity levels: LOGIC, STYLE, and SECRET.
 *
 * The classifier detects PII patterns and assigns appropriate privacy handling
 * strategies based on the sensitivity level detected.
 */

import type {
  PrivacyLevel as PrivacyLevelEnum,
  PrivacyClassification as PrivacyClassificationType,
  PrivacyClassifier as PrivacyClassifierInterface
} from '@lsi/protocol';
import { PIIType } from '@lsi/protocol';

// ============================================================================
// TYPE DEFINITIONS (Internal to classifier)
// ============================================================================

/**
 * Extended privacy levels for internal classification
 */
export enum InternalPrivacyLevel {
  /** Safe to share - structural queries, patterns */
  LOGIC = 'LOGIC',

  /** Moderate - rewrite for privacy (names, identifiers) */
  STYLE = 'STYLE',

  /** High - apply R-A Protocol (SSN, credit card, medical) */
  SECRET = 'SECRET',
}

/**
 * Sensitive span with location information
 */
export interface SensitiveSpan {
  /** Type of PII detected */
  type: typeof PIIType[keyof typeof PIIType];
  /** Start index in text */
  start: number;
  /** End index in text */
  end: number;
  /** Original value (for redaction) */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Redaction rule for custom PII patterns
 */
export interface RedactionRule {
  /** Pattern to match */
  pattern: RegExp;
  /** Type of PII */
  type: typeof PIIType[keyof typeof PIIType];
  /** Replacement text */
  replacement: string;
  /** Whether this is a custom rule (user-defined) */
  isCustom: boolean;
}

/**
 * Internal privacy classification result
 */
export interface InternalPrivacyClassification {
  level: InternalPrivacyLevel;
  confidence: number;
  sensitiveSpans: SensitiveSpan[];
  redactionRules: RedactionRule[];
  reason: string;
}

// ============================================================================
// PII PATTERN DEFINITIONS
// ============================================================================

/**
 * PII pattern definitions with regular expressions
 */
const PII_PATTERNS = {
  ['EMAIL']: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    description: 'Email addresses',
  },
  ['PHONE']: {
    pattern: /\b(?:\+?1[-.\s]?)?\(?[2-9][0-9]{2}\)?[-.\s]?[2-9][0-9]{2}[-.\s]?[0-9]{4}\b/g,
    description: 'Phone numbers',
  },
  ['SSN']: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    description: 'Social Security Numbers',
  },
  ['CREDIT_CARD']: {
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    description: 'Credit card numbers',
  },
  ['IP_ADDRESS']: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    description: 'IP addresses',
  },
  ['NAME']: {
    pattern: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
    description: 'Person names (probabilistic)',
  },
  ['DATE_OF_BIRTH']: {
    pattern: /\b(?:0?[1-9]|1[0-2])[-/\s](?:0?[1-9]|[12][0-9]|3[01])[-/\s](?:19|20)?\d{2}\b/g,
    description: 'Dates of birth',
  },
  ['PASSPORT']: {
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    description: 'Passport numbers',
  },
  ['DRIVERS_LICENSE']: {
    pattern: /\b[A-Z]{1,2}\d{6,8}\b/g,
    description: "Driver's license numbers",
  },
  ['BANK_ACCOUNT']: {
    pattern: /\b\d{8,17}\b/g,
    description: 'Bank account numbers',
  },
  ['MEDICAL_RECORD']: {
    pattern: /\b(?:MRN|HN|ID|PAT)\s*\d{5,10}\b/gi,
    description: 'Medical record numbers',
  },
} as const;

/**
 * Mapping from internal levels to protocol levels
 */
const INTERNAL_TO_PROTOCOL_LEVEL: Record<InternalPrivacyLevel, PrivacyLevelEnum> = {
  [InternalPrivacyLevel.LOGIC]: 'PUBLIC' as PrivacyLevelEnum,
  [InternalPrivacyLevel.STYLE]: 'SENSITIVE' as PrivacyLevelEnum,
  [InternalPrivacyLevel.SECRET]: 'SOVEREIGN' as PrivacyLevelEnum,
};

// ============================================================================
// PRIVACY CLASSIFIER IMPLEMENTATION
// ============================================================================

/**
 * PrivacyClassifier implementation for Aequor Privacy Suite
 */
export class PrivacyClassifier implements PrivacyClassifierInterface {
  /** Custom redaction rules */
  private customRules: RedactionRule[] = [];

  /** Whether to include name detection (can be noisy) */
  private includeNameDetection: boolean = false;

  /** Minimum confidence threshold for PII detection */
  private minConfidenceThreshold: number = 0.7;

  /**
   * Create a new PrivacyClassifier
   */
  constructor(config: {
    includeNameDetection?: boolean;
    minConfidenceThreshold?: number;
    customRules?: RedactionRule[];
  } = {}) {
    this.includeNameDetection = config.includeNameDetection ?? false;
    this.minConfidenceThreshold = config.minConfidenceThreshold ?? 0.7;
    this.customRules = config.customRules ?? [];
  }

  /**
   * Classify query sensitivity into LOGIC/STYLE/SECRET levels
   */
  async classify(query: string): Promise<PrivacyClassificationType> {
    const internalClass = await this.classifyInternal(query);

    return {
      level: INTERNAL_TO_PROTOCOL_LEVEL[internalClass.level],
      confidence: internalClass.confidence,
      piiTypes: internalClass.sensitiveSpans.map(span => span.type),
      reason: internalClass.reason,
    };
  }

  /**
   * Detect PII in text
   */
  async detectPII(text: string): Promise<typeof PIIType[keyof typeof PIIType][]> {
    const spans = await this.detectPIISpans(text);
    return spans.map(span => span.type);
  }

  /**
   * Redact PII from text
   */
  async redact(text: string, types?: typeof PIIType[keyof typeof PIIType][]): Promise<string> {
    let redactedText = text;
    const allRules = [...this.customRules, ...this.createDefaultRules()];

    // Filter rules by specified types or use all
    const rulesToApply = types
      ? allRules.filter(rule => types.includes(rule.type))
      : allRules;

    // Apply each redaction rule
    for (const rule of rulesToApply) {
      redactedText = redactedText.replace(rule.pattern, rule.replacement);
    }

    return redactedText;
  }

  /**
   * Internal classification logic
   */
  private async classifyInternal(query: string): Promise<InternalPrivacyClassification> {
    const spans = await this.detectPIISpans(query);

    // Classification logic based on detected PII
    if (spans.length === 0) {
      return {
        level: InternalPrivacyLevel.LOGIC,
        confidence: 0.95,
        sensitiveSpans: [],
        redactionRules: [],
        reason: 'No PII detected - safe to share',
      };
    }

    // Count PII by type and assess severity
    const piiCounts = new Map<typeof PIIType[keyof typeof PIIType], number>();
    let hasHighRiskPII = false;
    let hasMediumRiskPII = false;

    for (const span of spans) {
      const count = piiCounts.get(span.type) || 0;
      piiCounts.set(span.type, count + 1);

      // High-risk PII types
      if (['SSN', 'CREDIT_CARD', 'MEDICAL_RECORD'].includes(span.type)) {
        hasHighRiskPII = true;
      }
      // Medium-risk PII types
      else if (['EMAIL', 'PHONE', 'DATE_OF_BIRTH'].includes(span.type)) {
        hasMediumRiskPII = true;
      }
    }

    // Determine classification level
    if (hasHighRiskPII) {
      return {
        level: InternalPrivacyLevel.SECRET,
        confidence: 0.98,
        sensitiveSpans: spans,
        redactionRules: this.createDefaultRules(),
        reason: 'High-risk PII detected - apply R-A Protocol',
      };
    }

    if (hasMediumRiskPII) {
      return {
        level: InternalPrivacyLevel.STYLE,
        confidence: 0.85,
        sensitiveSpans: spans,
        redactionRules: this.createDefaultRules(),
        reason: 'Medium-risk PII detected - rewrite for privacy',
      };
    }

    // Low-risk PII (mostly names if enabled)
    return {
      level: InternalPrivacyLevel.STYLE,
      confidence: 0.7,
      sensitiveSpans: spans,
      redactionRules: this.createDefaultRules(),
      reason: 'Low-risk PII detected - minor privacy concerns',
    };
  }

  /**
   * Detect PII spans with location information
   */
  private async detectPIISpans(text: string): Promise<SensitiveSpan[]> {
    const spans: SensitiveSpan[] = [];

    // Skip name detection if not enabled (it can be noisy)
    const patternsToCheck = this.includeNameDetection
      ? PII_PATTERNS
      : Object.fromEntries(
          Object.entries(PII_PATTERNS).filter(([key]) => key !== 'NAME')
        );

    for (const [type, patternInfo] of Object.entries(patternsToCheck)) {
      const piitype = type as typeof PIIType[keyof typeof PIIType];
      const matches = Array.from(text.matchAll(patternInfo.pattern));

      for (const match of matches) {
        if (match && match[0]) {
          const span: SensitiveSpan = {
            type: piitype,
            start: match.index!,
            end: match.index! + match[0].length,
            value: match[0],
            confidence: this.calculateConfidence(piitype, match[0]),
          };

          // Only include spans that meet confidence threshold
          if (span.confidence >= this.minConfidenceThreshold) {
            spans.push(span);
          }
        }
      }
    }

    // Sort spans by start position
    return spans.sort((a, b) => a.start - b.start);
  }

  /**
   * Calculate confidence score for detected PII
   */
  private calculateConfidence(type: typeof PIIType[keyof typeof PIIType], value: string): number {
    // Higher confidence for structured patterns
    switch (type) {
      case PIIType.EMAIL:
        return 0.95; // Very reliable pattern

      case PIIType.SSN:
        return 0.98; // Very reliable pattern

      case PIIType.CREDIT_CARD:
        // Check for valid credit card checksum (Luhn algorithm)
        if (this.isValidCreditCard(value)) {
          return 0.95;
        }
        return 0.8;

      case PIIType.PHONE:
        // More reliable if it has specific format
        if (value.match(/\+\d/)) {
          return 0.9;
        }
        return 0.7;

      case PIIType.DATE_OF_BIRTH:
        // Check for reasonable date ranges
        const dobMatch = value.match(/(\d{4})/);
        if (dobMatch) {
          const year = parseInt(dobMatch[1]);
          if (year >= 1900 && year <= new Date().getFullYear()) {
            return 0.8;
          }
        }
        return 0.6;

      case PIIType.NAME:
        // Name detection is probabilistic
        return this.includeNameDetection ? 0.5 : 0;

      default:
        return 0.7; // Default confidence for other types
    }
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  private isValidCreditCard(number: string): boolean {
    // Remove spaces and dashes
    const clean = number.replace(/[-\s]/g, '');

    // Check if it's all digits and correct length
    if (!/^\d+$/.test(clean) || (clean.length !== 13 && clean.length !== 15 && clean.length !== 16)) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let shouldDouble = false;

    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean[i]);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  /**
   * Create default redaction rules
   */
  private createDefaultRules(): RedactionRule[] {
    const rules: RedactionRule[] = [];

    for (const [type, patternInfo] of Object.entries(PII_PATTERNS)) {
      const piitype = type as typeof PIIType[keyof typeof PIIType];

      // Use appropriate replacement based on PII type
      let replacement = '[REDACTED]';
      switch (piitype) {
        case PIIType.EMAIL:
          replacement = '[EMAIL]';
          break;
        case PIIType.PHONE:
          replacement = '[PHONE]';
          break;
        case PIIType.SSN:
          replacement = '[SSN]';
          break;
        case PIIType.CREDIT_CARD:
          replacement = '[CREDIT_CARD]';
          break;
        case PIIType.NAME:
          replacement = '[NAME]';
          break;
        case PIIType.DATE_OF_BIRTH:
          replacement = '[DOB]';
          break;
        default:
          replacement = `[${piitype.toUpperCase()}]`;
      }

      rules.push({
        pattern: patternInfo.pattern,
        type: piitype,
        replacement,
        isCustom: false,
      });
    }

    return rules;
  }

  /**
   * Add custom redaction rule
   */
  addCustomRule(rule: RedactionRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom redaction rule
   */
  removeCustomRule(ruleIndex: number): void {
    if (ruleIndex >= 0 && ruleIndex < this.customRules.length) {
      this.customRules.splice(ruleIndex, 1);
    }
  }

  /**
   * Get all current redaction rules
   */
  getRedactionRules(): RedactionRule[] {
    return [...this.customRules, ...this.createDefaultRules()];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new PrivacyClassifier with default configuration
 */
export function createPrivacyClassifier(config?: {
  includeNameDetection?: boolean;
  minConfidenceThreshold?: number;
  customRules?: RedactionRule[];
}): PrivacyClassifier {
  return new PrivacyClassifier(config);
}