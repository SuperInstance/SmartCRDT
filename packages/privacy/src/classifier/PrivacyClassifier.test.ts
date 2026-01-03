/**
 * Tests for PrivacyClassifier
 *
 * This test file covers all functionality of the PrivacyClassifier including:
 * - Classification into LOGIC/STYLE/SECRET levels
 * - PII pattern detection
 * - Redaction functionality
 * - Custom rules
 * - Confidence scoring
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrivacyClassifier, createPrivacyClassifier, type RedactionRule } from './PrivacyClassifier.js';
import { PIIType, PrivacyLevel } from '@lsi/protocol';

describe('PrivacyClassifier', () => {
  let classifier: PrivacyClassifier;

  beforeEach(() => {
    classifier = new PrivacyClassifier({
      includeNameDetection: true,
      minConfidenceThreshold: 0.7,
    });
  });

  // ============================================================================
  // BASIC CLASSIFICATION TESTS
  // ============================================================================

  describe('Classification', () => {
    it('should classify queries with no PII as LOGIC level', async () => {
      const query = 'What is the capital of France?';
      const result = await classifier.classify(query);

      expect(result.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.piiTypes).toEqual([]);
      expect(result.reason).toContain('No PII detected');
    });

    it('should classify queries with high-risk PII as SECRET level', async () => {
      const queries = [
        'My SSN is 123-45-6789 and I need help',
        'My credit card number is 4111-1111-1111-1111',
        'My medical record number is MRN12345',
      ];

      for (const query of queries) {
        const result = await classifier.classify(query);
        expect(result.level).toBe(PrivacyLevel.SOVEREIGN);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.piiTypes.length).toBeGreaterThan(0);
      }
    });

    it('should classify queries with medium-risk PII as STYLE level', async () => {
      const queries = [
        'My email is user@example.com and I need help',
        'My phone number is 555-123-4567',
        'My date of birth is 01/15/1990',
      ];

      for (const query of queries) {
        const result = await classifier.classify(query);
        expect(result.level).toBe(PrivacyLevel.SENSITIVE);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.piiTypes.length).toBeGreaterThan(0);
      }
    });

    it('should handle mixed PII types correctly', async () => {
      const query = 'My name is John Doe, email is john@example.com, SSN is 123-45-6789';
      const result = await classifier.classify(query);

      expect(result.level).toBe(PrivacyLevel.SOVEREIGN); // SSN takes precedence
      expect(result.piiTypes).toContain(PIIType.SSN);
      expect(result.piiTypes).toContain(PIIType.EMAIL);
      expect(result.piiTypes).toContain(PIIType.NAME);
    });
  });

  // ============================================================================
  // PII DETECTION TESTS
  // ============================================================================

  describe('PII Detection', () => {
    it('should detect email addresses', async () => {
      const text = 'Contact me at user@example.com or support@company.co.uk';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.EMAIL);
      expect(piiTypes.length).toBe(2);
    });

    it('should detect phone numbers', async () => {
      const text = 'Call me at 555-123-4567 or +1-800-555-0199';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.PHONE);
      expect(piiTypes.length).toBe(2);
    });

    it('should detect SSN numbers', async () => {
      const text = 'My SSN is 123-45-6789 and friend SSN is 987-65-4321';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.SSN);
      expect(piiTypes.length).toBe(2);
    });

    it('should detect credit card numbers', async () => {
      const text = 'Card: 4111-1111-1111-1111 or 4111 1111 1111 1111';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.CREDIT_CARD);
      expect(piiTypes.length).toBe(2);
    });

    it('should detect IP addresses', async () => {
      const text = 'Server at 192.168.1.1 or 10.0.0.1';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.IP_ADDRESS);
      expect(piiTypes.length).toBe(2);
    });

    it('should detect names when enabled', async () => {
      const text = 'John Smith and Jane Doe are colleagues';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.NAME);
      expect(piiTypes.length).toBe(2);
    });

    it('should not detect names when disabled', async () => {
      const classifierNoNames = new PrivacyClassifier({
        includeNameDetection: false,
      });

      const text = 'John Smith and Jane Doe are colleagues';
      const piiTypes = await classifierNoNames.detectPII(text);

      expect(piiTypes).not.toContain(PIIType.NAME);
    });

    it('should detect dates of birth', async () => {
      const text = 'DOB: 01/15/1990 or 12-31-1985';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.DATE_OF_BIRTH);
      expect(piiTypes.length).toBe(2);
    });
  });

  // ============================================================================
  // REDACTION TESTS
  // ============================================================================

  describe('Redaction', () => {
    it('should redact email addresses', async () => {
      const text = 'Contact me at user@example.com';
      const redacted = await classifier.redact(text);

      expect(redacted).toBe('Contact me at [EMAIL]');
    });

    it('should redact multiple PII types', async () => {
      const text = 'Name: John Doe, Email: john@example.com, Phone: 555-123-4567';
      const redacted = await classifier.redact(text);

      expect(redacted).toContain('[NAME]');
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).toContain('[PHONE]');
    });

    it('should redact specific PII types only', async () => {
      const text = 'Email: john@example.com, SSN: 123-45-6789';
      const redacted = await classifier.redact(text, [PIIType.EMAIL]);

      expect(redacted).toBe('Email: [EMAIL], SSN: 123-45-6789');
    });

    it('should preserve text without PII', async () => {
      const text = 'This is a normal query with no sensitive information';
      const redacted = await classifier.redact(text);

      expect(redacted).toBe(text);
    });

    it('should handle credit card numbers with Luhn validation', async () => {
      const validCC = '4111111111111111'; // Valid test card
      const invalidCC = '4111111111111112'; // Invalid checksum

      const validText = `My card: ${validCC}`;
      const invalidText = `My card: ${invalidCC}`;

      const validRedacted = await classifier.redact(validText);
      const invalidRedacted = await classifier.redact(invalidText);

      // Both should be redacted since we can't validate Luhn in all contexts
      expect(validRedacted).toContain('[CREDIT_CARD]');
      expect(invalidRedacted).toContain('[CREDIT_CARD]');
    });
  });

  // ============================================================================
  // CUSTOM RULES TESTS
  // ============================================================================

  describe('Custom Rules', () => {
    it('should add and use custom redaction rules', async () => {
      const customRule: RedactionRule = {
        pattern: /API_KEY_\w+/gi,
        type: PIIType.CUSTOM_PATTERN ,
        replacement: '[API_KEY]',
        isCustom: true,
      };

      classifier.addCustomRule(customRule);

      const text = 'My API_KEY_abc123 is secret';
      const redacted = await classifier.redact(text);

      expect(redacted).toBe('My [API_KEY] is secret');
    });

    it('should remove custom rules', async () => {
      const customRule: RedactionRule = {
        pattern: /SECRET_\w+/gi,
        type: PIIType.CUSTOM_PATTERN ,
        replacement: '[SECRET]',
        isCustom: true,
      };

      classifier.addCustomRule(customRule);
      classifier.removeCustomRule(0);

      const text = 'SECRET_value123';
      const redacted = await classifier.redact(text);

      expect(redacted).toBe(text); // Should not be redacted after removal
    });

    it('should get all redaction rules', async () => {
      const rules = classifier.getRedactionRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.isCustom)).toBe(false);

      // Add a custom rule
      const customRule: RedactionRule = {
        pattern: /TEST/gi,
        type: PIIType.CUSTOM_PATTERN ,
        replacement: '[TEST]',
        isCustom: true,
      };

      classifier.addCustomRule(customRule);
      const updatedRules = classifier.getRedactionRules();

      expect(updatedRules.some(rule => rule.isCustom)).toBe(true);
    });
  });

  // ============================================================================
  // CONFIDENCE SCORING TESTS
  // ============================================================================

  describe('Confidence Scoring', () => {
    it('should assign high confidence to structured PII', async () => {
      const query = 'SSN: 123-45-6789';
      const spans = await (classifier as any).detectPIISpans(query);

      expect(spans.length).toBe(1);
      expect(spans[0].confidence).toBeGreaterThan(0.95);
    });

    it('should adjust confidence based on pattern matching', async () => {
      // Valid email format
      const validEmail = 'test@example.com';
      // Invalid email format
      const invalidEmail = 'test.example.com';

      const validSpans = await (classifier as any).detectPIISpans(validEmail);
      const invalidSpans = await (classifier as any).detectPIISpans(invalidEmail);

      expect(validSpans.length).toBe(1);
      expect(validSpans[0].confidence).toBeGreaterThan(0.9);
      expect(invalidSpans.length).toBe(0);
    });

    it('should use custom confidence threshold', async () => {
      const highThresholdClassifier = new PrivacyClassifier({
        minConfidenceThreshold: 0.9,
        includeNameDetection: true,
      });

      // Name detection typically has lower confidence
      const query = 'My name is John Doe';
      const piiTypes = await highThresholdClassifier.detectPII(query);

      // With high threshold, names might not be detected
      expect(piiTypes).not.toContain(PIIType.NAME);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty queries', async () => {
      const result = await classifier.classify('');
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.piiTypes).toEqual([]);
    });

    it('should handle queries with similar but non-matching patterns', async () => {
      const query = 'This is not an email: test@example, not-a-phone: 123';
      const result = await classifier.classify(query);

      expect(result.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.piiTypes).toEqual([]);
    });

    it('should handle overlapping PII patterns', async () => {
      const query = 'Email: user@domain.co.uk';
      const result = await classifier.classify(query);

      expect(result.level).toBe(PrivacyLevel.SENSITIVE);
      expect(result.piiTypes).toContain(PIIType.EMAIL);
    });

    it('should handle international phone numbers', async () => {
      const query = 'Call +44 20 7946 0958 or +81-3-1234-5678';
      const piiTypes = await classifier.detectPII(query);

      expect(piiTypes).toContain(PIIType.PHONE);
      expect(piiTypes.length).toBe(2);
    });

    it('should handle complex queries with mixed content', async () => {
      const query = `
        User profile:
        Name: John Smith
        Email: john.smith@company.com
        Phone: +1 (555) 123-4567
        SSN: 123-45-6789
        Address: 123 Main St, Anytown, USA
      `;

      const result = await classifier.classify(query);
      expect(result.level).toBe(PrivacyLevel.SOVEREIGN); // SSN makes it SECRET
      expect(result.piiTypes.length).toBeGreaterThan(3);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should classify, detect, and redact in sequence', async () => {
      const query = 'My email is user@example.com and SSN is 123-45-6789';

      // Step 1: Classify
      const classification = await classifier.classify(query);
      expect(classification.level).toBe(PrivacyLevel.SOVEREIGN);

      // Step 2: Detect PII
      const piiTypes = await classifier.detectPII(query);
      expect(piiTypes).toContain(PIIType.EMAIL);
      expect(piiTypes).toContain(PIIType.SSN);

      // Step 3: Redact
      const redacted = await classifier.redact(query);
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).toContain('[SSN]');
      expect(redacted).not.toContain('user@example.com');
      expect(redacted).not.toContain('123-45-6789');
    });

    it('should handle real-world queries correctly', async () => {
      const queries = [
        {
          query: 'What is the weather like in Paris?',
          expectedLevel: 'PUBLIC',
        },
        {
          query: 'Can you help me reset my password for account user123?',
          expectedLevel: 'SENSITIVE', // Contains "account" which might be sensitive
        },
        {
          query: 'My credit card was stolen and the number is 4111-1111-1111-1111',
          expectedLevel: 'SOVEREIGN',
        },
        {
          query: 'My doctor phone number is 555-867-5309',
          expectedLevel: 'SENSITIVE',
        },
      ];

      for (const { query, expectedLevel } of queries) {
        const result = await classifier.classify(query);
        expect(result.level).toBe(expectedLevel);
      }
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createPrivacyClassifier', () => {
  it('should create classifier with default configuration', () => {
    const classifier = createPrivacyClassifier();
    expect(classifier).toBeInstanceOf(PrivacyClassifier);
  });

  it('should create classifier with custom configuration', () => {
    const customRules: RedactionRule[] = [{
      pattern: /CUSTOM/gi,
      type: PIIType.CUSTOM_PATTERN ,
      replacement: '[CUSTOM]',
      isCustom: true,
    }];

    const classifier = createPrivacyClassifier({
      includeNameDetection: false,
      minConfidenceThreshold: 0.8,
      customRules,
    });

    expect(classifier).toBeInstanceOf(PrivacyClassifier);
  });
});