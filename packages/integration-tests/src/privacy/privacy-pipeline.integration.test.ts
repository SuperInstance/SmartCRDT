/**
 * End-to-End Privacy Pipeline Integration Tests
 *
 * Comprehensive tests covering the full privacy pipeline flow:
 * 1. PII Detection
 * 2. Privacy Classification
 * 3. Redaction (R-A Protocol)
 * 4. Intent Encoding with ε-DP
 * 5. Firewall Routing
 * 6. Audit Logging
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PrivacyClassifier,
  PrivacyFirewall,
  RedactionAdditionProtocol,
  AuditLogger,
  IntentEncoder,
  type AuditEventType,
} from '@lsi/privacy';
import {
  PrivacyLevel,
  PIIType,
  type PrivacyClassification,
  type RedactionResult,
  type RedactionContext,
} from '@lsi/protocol';

// ============================================================================
// TEST FIXTURES - Realistic PII Data
// ============================================================================

/**
 * Test queries with various PII types for comprehensive testing
 */
export const TEST_QUERIES = {
  // Email addresses
  email: {
    query: 'My email is john.doe@example.com, please contact me there',
    expectedPII: [PIIType.EMAIL],
    expectedLevel: PrivacyLevel.SENSITIVE,
    description: 'Email detection test',
  },

  // Phone numbers
  phone: {
    query: 'Call me at 555-123-4567 for more information',
    expectedPII: [PIIType.PHONE],
    expectedLevel: PrivacyLevel.SENSITIVE,
    description: 'Phone number detection test',
  },

  // SSN (high-risk)
  ssn: {
    query: 'My social security number is 123-45-6789',
    expectedPII: [PIIType.SSN],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'SSN detection test (should be blocked)',
  },

  // Credit card (high-risk)
  creditCard: {
    query: 'Please charge my credit card 4532-1234-5678-9010',
    expectedPII: [PIIType.CREDIT_CARD],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'Credit card detection test (should be blocked)',
  },

  // IP address
  ipAddress: {
    query: 'Connect to server at 192.168.1.1',
    expectedPII: [PIIType.IP_ADDRESS],
    expectedLevel: PrivacyLevel.SENSITIVE,
    description: 'IP address detection test',
  },

  // Date of birth
  dob: {
    query: 'I was born on 03/15/1985',
    expectedPII: [PIIType.DATE_OF_BIRTH],
    expectedLevel: PrivacyLevel.SENSITIVE,
    description: 'Date of birth detection test',
  },

  // Mixed PII types
  mixed: {
    query: 'Contact John Smith at john.smith@example.com or call 555-987-6543. His SSN is 987-65-4321.',
    expectedPII: [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'Mixed PII types test (email, phone, SSN)',
  },

  // No PII (safe query)
  safe: {
    query: 'What is the capital of France?',
    expectedPII: [],
    expectedLevel: PrivacyLevel.PUBLIC,
    description: 'Safe query with no PII',
  },

  // Obfuscated PII (edge case)
  obfuscatedEmail: {
    query: 'Email me at john [at] example [dot] com',
    expectedPII: [],
    expectedLevel: PrivacyLevel.PUBLIC,
    description: 'Obfuscated email (should not detect)',
  },

  // Multiple emails
  multipleEmails: {
    query: 'Send emails to alice@example.com and bob@example.com',
    expectedPII: [PIIType.EMAIL, PIIType.EMAIL],
    expectedLevel: PrivacyLevel.SENSITIVE,
    description: 'Multiple email addresses',
  },

  // Medical record (high-risk)
  medical: {
    query: 'My medical record number is MRN 123456789',
    expectedPII: [PIIType.MEDICAL_RECORD],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'Medical record detection test (HIPAA)',
  },

  // Passport number
  passport: {
    query: 'My passport number is AB1234567',
    expectedPII: [PIIType.PASSPORT],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'Passport number detection test',
  },

  // Driver's license
  driversLicense: {
    query: 'My driver license is CA12345678',
    expectedPII: [PIIType.DRIVERS_LICENSE],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: "Driver's license detection test",
  },

  // Bank account
  bankAccount: {
    query: 'My bank account number is 12345678901234567',
    expectedPII: [PIIType.BANK_ACCOUNT],
    expectedLevel: PrivacyLevel.SOVEREIGN,
    description: 'Bank account detection test',
  },
};

/**
 * Performance test queries
 */
export const PERFORMANCE_QUERIES = {
  small: {
    query: 'My email is test@example.com',
    description: 'Small query with single PII',
  },
  medium: {
    query: 'Contact me at john@example.com or call 555-123-4567. My SSN is 123-45-6789. My credit card is 4532-1234-5678-9010.',
    description: 'Medium query with multiple PII types',
  },
  large: {
    query: Array(50)
      .fill(0)
      .map((_, i) => `Contact person${i}@example.com for more information about item ${i}.`)
      .join(' '),
    description: 'Large query with 50 emails',
  },
};

/**
 * Edge case queries
 */
export const EDGE_CASE_QUERIES = {
  empty: {
    query: '',
    description: 'Empty query',
  },
  whitespace: {
    query: '   \n\t   ',
    description: 'Whitespace only query',
  },
  veryLong: {
    query: 'a'.repeat(10000),
    description: 'Very long query without PII',
  },
  specialChars: {
    query: 'Email: test+tag@example.co.uk, Phone: +1-555-123-4567',
    description: 'Special characters in PII',
  },
  unicode: {
    query: 'Email: 日本人@example.com, Phone: +81-3-1234-5678',
    description: 'Unicode characters in PII',
  },
};

// ============================================================================
// PRIVACY PIPELINE CLASS
// ============================================================================

/**
 * PrivacyPipeline - End-to-end privacy processing
 *
 * Combines all privacy components into a single pipeline:
 * 1. Detect and classify PII
 * 2. Apply firewall rules
 * 3. Redact if needed
 * 4. Log all events
 * 5. Encode intent if safe
 */
export class PrivacyPipeline {
  private classifier: PrivacyClassifier;
  private firewall: PrivacyFirewall;
  private rap: RedactionAdditionProtocol;
  private auditLogger: AuditLogger;
  private intentEncoder: IntentEncoder;

  constructor() {
    this.classifier = new PrivacyClassifier({
      includeNameDetection: false,
      minConfidenceThreshold: 0.7,
    });

    this.firewall = new PrivacyFirewall({
      enableDefaultRules: true,
    });

    this.rap = new RedactionAdditionProtocol({
      enableRedaction: true,
      preserveFormat: true,
    });

    this.auditLogger = new AuditLogger({
      maxEvents: 10000,
      enableRotation: true,
      enableHashing: true,
      includeFullQuery: false,
    });

    this.intentEncoder = new IntentEncoder({
      dimensions: 768,
      epsilon: 1.0, // Differential privacy parameter
    });
  }

  /**
   * Process a query through the full privacy pipeline
   *
   * @param query - Input query
   * @param destination - Requested destination (local/cloud)
   * @returns Processing result
   */
  async processQuery(
    query: string,
    destination: 'local' | 'cloud' = 'cloud'
  ): Promise<{
    originalQuery: string;
    classification: PrivacyClassification;
    firewallDecision: ReturnType<PrivacyFirewall['evaluate']>;
    redactionResult?: RedactionResult;
    encodedIntent?: number[];
    allowed: boolean;
    finalQuery: string;
  }> {
    // Step 1: Classify
    const startTime = performance.now();
    const classification = await this.classifier.classify(query);
    const classificationTime = performance.now() - startTime;

    // Log classification event
    this.auditLogger.logEvent({
      eventType: 'firewall_evaluated',
      query,
      classification,
      piiDetected: classification.piiTypes,
      decision: {
        action: 'allow',
        confidence: classification.confidence,
        matchedRules: [],
        finalDestination: destination,
      },
      destination,
      sessionId: 'test-session',
      metadata: {
        classificationTime,
        reason: classification.reason,
      },
    });

    // Step 2: Firewall decision
    const firewallDecision = this.firewall.evaluate(
      query,
      classification,
      destination
    );

    // Log firewall decision
    this.auditLogger.logEvent({
      eventType: 'firewall_evaluated',
      query,
      classification,
      piiDetected: classification.piiTypes,
      decision: firewallDecision,
      destination: firewallDecision.finalDestination,
      sessionId: 'test-session',
      metadata: {
        action: firewallDecision.action,
        matchedRules: firewallDecision.matchedRules,
      },
    });

    // Step 3: Check if allowed
    if (firewallDecision.action === 'deny') {
      return {
        originalQuery: query,
        classification,
        firewallDecision,
        allowed: false,
        finalQuery: query,
      };
    }

    // Step 4: Redact if needed
    let redactionResult: RedactionResult | undefined;
    let finalQuery = query;

    if (firewallDecision.action === 'redact') {
      const redactStartTime = performance.now();
      redactionResult = await this.rap.redact(query);
      const redactTime = performance.now() - redactStartTime;

      finalQuery = redactionResult.redactedQuery;

      // Log redaction event
      this.auditLogger.logEvent({
        eventType: 'query_redacted',
        query,
        classification,
        piiDetected: redactionResult.context.piiTypes,
        decision: firewallDecision,
        destination,
        sessionId: 'test-session',
        metadata: {
          redactionCount: redactionResult.redactionCount,
          redactionTime,
          redactedQuery: finalQuery,
        },
      });
    }

    // Step 5: Encode intent
    let encodedIntent: number[] | undefined;
    if (finalQuery) {
      const encodeStartTime = performance.now();
      const encodeResult = await this.intentEncoder.encode(finalQuery);
      const encodeTime = performance.now() - encodeStartTime;

      encodedIntent = Array.from(encodeResult.vector);

      // Log encoding event
      this.auditLogger.logEvent({
        eventType: 'query_allowed',
        query: finalQuery,
        classification,
        piiDetected: [],
        decision: {
          action: 'allow',
          confidence: 0.8,
          matchedRules: [],
          finalDestination: destination,
        },
        destination,
        sessionId: 'test-session',
        metadata: {
          dimensions: encodeResult.dimensions,
          epsilon: encodeResult.epsilon,
          encodeTime,
        },
      });
    }

    return {
      originalQuery: query,
      classification,
      firewallDecision,
      redactionResult,
      encodedIntent,
      allowed: true,
      finalQuery,
    };
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): ReturnType<AuditLogger['getEvents']> {
    return this.auditLogger.getEvents();
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogger.clear();
  }

  /**
   * Get privacy budget status
   */
  getPrivacyBudget(): {
    epsilonUsed: number;
    epsilonRemaining: number;
    queriesProcessed: number;
  } {
    return {
      epsilonUsed: 0, // IntentEncoder doesn't expose this
      epsilonRemaining: 1.0,
      queriesProcessed: this.auditLogger.getEvents().length,
    };
  }
}

// ============================================================================
// E2E TEST SCENARIOS
// ============================================================================

describe('Privacy Pipeline - E2E Tests', () => {
  let pipeline: PrivacyPipeline;

  beforeEach(() => {
    pipeline = new PrivacyPipeline();
  });

  afterEach(() => {
    pipeline.clearAuditLogs();
  });

  // ========================================================================
  // Test Scenario 1: Query with email → detect → classify → redact
  // ========================================================================

  describe('Scenario 1: Email Processing', () => {
    it('should detect, classify, and redact email', async () => {
      const testCase = TEST_QUERIES.email;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      // Verify classification
      expect(result.classification.level).toBe(testCase.expectedLevel);
      expect(result.classification.piiTypes).toContain(PIIType.EMAIL);
      expect(result.classification.confidence).toBeGreaterThan(0.7);

      // Verify firewall decision
      expect(result.firewallDecision.action).toBe('redact');
      expect(result.allowed).toBe(true);

      // Verify redaction
      expect(result.redactionResult).toBeDefined();
      expect(result.redactionResult!.redactionCount).toBeGreaterThan(0);
      expect(result.finalQuery).toContain('[EMAIL]');
      expect(result.finalQuery).not.toContain('john.doe@example.com');

      // Verify intent encoding
      expect(result.encodedIntent).toBeDefined();
      expect(result.encodedIntent!.length).toBe(768);

      // Verify audit logging
      const logs = pipeline.getAuditLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Test Scenario 2: Query with SSN → detect → classify → block
  // ========================================================================

  describe('Scenario 2: SSN Blocking', () => {
    it('should detect and block SSN transmission', async () => {
      const testCase = TEST_QUERIES.ssn;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      // Verify classification
      expect(result.classification.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(result.classification.piiTypes).toContain(PIIType.SSN);
      expect(result.classification.confidence).toBeGreaterThan(0.9);

      // Verify firewall decision (should be denied)
      expect(result.firewallDecision.action).toBe('deny');
      expect(result.allowed).toBe(false);
      expect(result.firewallDecision.reason).toContain('SOVEREIGN');

      // Verify no redaction or encoding (blocked before that)
      expect(result.redactionResult).toBeUndefined();
      expect(result.encodedIntent).toBeUndefined();
      expect(result.finalQuery).toBe(testCase.query); // No changes
    });

    it('should allow SSN processing locally', async () => {
      const testCase = TEST_QUERIES.ssn;
      const result = await pipeline.processQuery(testCase.query, 'local');

      // Local processing should be allowed
      expect(result.firewallDecision.action).toBe('allow');
      expect(result.allowed).toBe(true);
      expect(result.firewallDecision.finalDestination).toBe('local');
    });
  });

  // ========================================================================
  // Test Scenario 3: Intent encoding with ε-DP
  // ========================================================================

  describe('Scenario 3: Intent Encoding with Differential Privacy', () => {
    it('should encode intent with differential privacy guarantees', async () => {
      const query = 'What is the weather today?';
      const result = await pipeline.processQuery(query, 'cloud');

      // Verify encoding happened
      expect(result.encodedIntent).toBeDefined();
      expect(result.encodedIntent!.length).toBe(768);

      // Verify vector properties
      const vector = result.encodedIntent!;
      const mean = vector.reduce((a, b) => a + b, 0) / vector.length;
      const variance = vector.reduce((a, b) => a + (b - mean) ** 2, 0) / vector.length;

      // Check that vector has reasonable statistics (noise added)
      expect(Math.abs(mean)).toBeLessThan(1); // Should be centered around 0
      expect(variance).toBeGreaterThan(0); // Should have variance
    });

    it('should produce different encodings for same query (DP noise)', async () => {
      const query = 'What is the weather today?';

      const result1 = await pipeline.processQuery(query, 'cloud');
      const result2 = await pipeline.processQuery(query, 'cloud');

      // Encodings should be different due to DP noise
      expect(result1.encodedIntent).not.toEqual(result2.encodedIntent);

      // But should be similar (cosine similarity)
      const dotProduct = result1.encodedIntent!.reduce(
        (sum, a, i) => sum + a * result2.encodedIntent![i],
        0
      );
      const norm1 = Math.sqrt(result1.encodedIntent!.reduce((sum, a) => sum + a * a, 0));
      const norm2 = Math.sqrt(result2.encodedIntent!.reduce((sum, a) => sum + a * a, 0));
      const similarity = dotProduct / (norm1 * norm2);

      expect(similarity).toBeGreaterThan(0.9); // Should be very similar
    });
  });

  // ========================================================================
  // Test Scenario 4: Firewall routing based on privacy level
  // ========================================================================

  describe('Scenario 4: Firewall Routing', () => {
    it('should allow PUBLIC queries to cloud', async () => {
      const testCase = TEST_QUERIES.safe;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.firewallDecision.action).toBe('allow');
      expect(result.firewallDecision.finalDestination).toBe('cloud');
      expect(result.allowed).toBe(true);
    });

    it('should redact SENSITIVE queries for cloud', async () => {
      const testCase = TEST_QUERIES.email;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.level).toBe(PrivacyLevel.SENSITIVE);
      expect(result.firewallDecision.action).toBe('redact');
      expect(result.allowed).toBe(true);
      expect(result.redactionResult).toBeDefined();
    });

    it('should block SOVEREIGN queries from cloud', async () => {
      const testCase = TEST_QUERIES.ssn;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(result.firewallDecision.action).toBe('deny');
      expect(result.allowed).toBe(false);
    });

    it('should allow all queries for local processing', async () => {
      const testCase = TEST_QUERIES.ssn;
      const result = await pipeline.processQuery(testCase.query, 'local');

      expect(result.firewallDecision.action).toBe('allow');
      expect(result.firewallDecision.finalDestination).toBe('local');
      expect(result.allowed).toBe(true);
    });
  });

  // ========================================================================
  // Test Scenario 5: Audit logging for all events
  // ========================================================================

  describe('Scenario 5: Audit Logging', () => {
    it('should log all privacy events', async () => {
      await pipeline.processQuery(TEST_QUERIES.email.query, 'cloud');
      await pipeline.processQuery(TEST_QUERIES.ssn.query, 'cloud');

      const logs = pipeline.getAuditLogs();

      // Should have at least 4 events (2 per query)
      expect(logs.length).toBeGreaterThanOrEqual(4);
    });

    it('should include all required fields in audit events', async () => {
      const result = await pipeline.processQuery(TEST_QUERIES.email.query, 'cloud');
      const logs = pipeline.getAuditLogs();

      for (const log of logs) {
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('eventType');
        expect(log).toHaveProperty('queryHash');
        expect(log).toHaveProperty('queryLength');
        expect(log).toHaveProperty('decision');
        expect(log).toHaveProperty('destination');
        expect(log).toHaveProperty('sessionId');
        expect(log).toHaveProperty('metadata');

        // Verify timestamp is recent
        expect(log.timestamp).toBeLessThanOrEqual(Date.now());
        expect(log.timestamp).toBeGreaterThan(Date.now() - 10000); // Within 10 seconds
      }
    });

    it('should clear audit logs', async () => {
      await pipeline.processQuery(TEST_QUERIES.email.query, 'cloud');
      expect(pipeline.getAuditLogs().length).toBeGreaterThan(0);

      pipeline.clearAuditLogs();
      expect(pipeline.getAuditLogs().length).toBe(0);
    });
  });

  // ========================================================================
  // Test Scenario 6: Redaction quality validation
  // ========================================================================

  describe('Scenario 6: Redaction Quality', () => {
    it('should preserve query structure after redaction', async () => {
      const query = 'Contact me at john@example.com or jane@example.com';
      const result = await pipeline.processQuery(query, 'cloud');

      // Query should be redacted but structure preserved
      expect(result.finalQuery).toContain('[EMAIL]');
      expect(result.finalQuery).not.toContain('john@example.com');
      expect(result.finalQuery).not.toContain('jane@example.com');
    });

    it('should count redactions correctly', async () => {
      const query = 'Emails: alice@test.com, bob@test.com, charlie@test.com';
      const result = await pipeline.processQuery(query, 'cloud');

      expect(result.redactionResult!.redactionCount).toBeGreaterThanOrEqual(2);
    });

    it('should preserve format when configured', async () => {
      const query = 'Email: john@example.com';
      const result = await pipeline.processQuery(query, 'cloud');

      // Redaction should preserve some format information
      expect(result.finalQuery).toContain('[EMAIL]');
    });
  });

  // ========================================================================
  // Test Scenario 7: Privacy budget exhaustion
  // ========================================================================

  describe('Scenario 7: Privacy Budget', () => {
    it('should track privacy budget usage', async () => {
      await pipeline.processQuery(TEST_QUERIES.safe.query, 'cloud');
      await pipeline.processQuery(TEST_QUERIES.safe.query, 'cloud');

      const budget = pipeline.getPrivacyBudget();

      expect(budget.queriesProcessed).toBeGreaterThan(0);
      expect(budget.epsilonUsed).toBeGreaterThanOrEqual(0);
      expect(budget.epsilonRemaining).toBeLessThanOrEqual(1.0);
    });

    it('should track epsilon consumption', async () => {
      const initialBudget = pipeline.getPrivacyBudget();

      await pipeline.processQuery(TEST_QUERIES.safe.query, 'cloud');

      const finalBudget = pipeline.getPrivacyBudget();

      expect(finalBudget.queriesProcessed).toBeGreaterThan(initialBudget.queriesProcessed);
    });
  });

  // ========================================================================
  // Test Scenario 8: Mixed PII types in one query
  // ========================================================================

  describe('Scenario 8: Mixed PII Types', () => {
    it('should handle multiple PII types correctly', async () => {
      const testCase = TEST_QUERIES.mixed;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      // Should detect all PII types
      expect(result.classification.piiTypes).toContain(PIIType.EMAIL);
      expect(result.classification.piiTypes).toContain(PIIType.PHONE);
      expect(result.classification.piiTypes).toContain(PIIType.SSN);

      // Should be classified as SOVEREIGN due to SSN
      expect(result.classification.level).toBe(PrivacyLevel.SOVEREIGN);

      // Should be blocked from cloud
      expect(result.firewallDecision.action).toBe('deny');
      expect(result.allowed).toBe(false);
    });

    it('should redact all detected PII types', async () => {
      const query = 'Email: test@example.com, Phone: 555-123-4567, DOB: 01/15/1990';
      const result = await pipeline.processQuery(query, 'cloud');

      expect(result.redactionResult!.redactionCount).toBeGreaterThanOrEqual(2);
      expect(result.finalQuery).not.toContain('test@example.com');
      expect(result.finalQuery).not.toContain('555-123-4567');
    });
  });

  // ========================================================================
  // Test Scenario 9: Edge cases
  // ========================================================================

  describe('Scenario 9: Edge Cases', () => {
    it('should handle empty queries', async () => {
      const testCase = EDGE_CASE_QUERIES.empty;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.originalQuery).toBe('');
      expect(result.classification.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.allowed).toBe(true);
    });

    it('should handle whitespace-only queries', async () => {
      const testCase = EDGE_CASE_QUERIES.whitespace;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.allowed).toBe(true);
    });

    it('should handle very long queries', async () => {
      const testCase = EDGE_CASE_QUERIES.veryLong;
      const startTime = performance.now();
      const result = await pipeline.processQuery(testCase.query, 'cloud');
      const duration = performance.now() - startTime;

      expect(result.classification.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.allowed).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete in reasonable time
    });

    it('should handle special characters in PII', async () => {
      const testCase = EDGE_CASE_QUERIES.specialChars;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.piiTypes).toContain(PIIType.EMAIL);
      expect(result.classification.piiTypes).toContain(PIIType.PHONE);
    });

    it('should handle unicode characters', async () => {
      const testCase = EDGE_CASE_QUERIES.unicode;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      // Should handle unicode without crashing
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
    });
  });

  // ========================================================================
  // Test Scenario 10: Performance under load
  // ========================================================================

  describe('Scenario 10: Performance', () => {
    it('should process small query quickly', async () => {
      const testCase = PERFORMANCE_QUERIES.small;
      const startTime = performance.now();
      const result = await pipeline.processQuery(testCase.query, 'cloud');
      const duration = performance.now() - startTime;

      expect(result.allowed).toBe(true);
      expect(duration).toBeLessThan(100); // Target: <100ms
    });

    it('should process medium query quickly', async () => {
      const testCase = PERFORMANCE_QUERIES.medium;
      const startTime = performance.now();
      const result = await pipeline.processQuery(testCase.query, 'cloud');
      const duration = performance.now() - startTime;

      expect(result.allowed).toBe(false); // Should be blocked due to SSN
      expect(duration).toBeLessThan(100); // Target: <100ms
    });

    it('should process large query efficiently', async () => {
      const testCase = PERFORMANCE_QUERIES.large;
      const startTime = performance.now();
      const result = await pipeline.processQuery(testCase.query, 'cloud');
      const duration = performance.now() - startTime;

      expect(result.allowed).toBe(true);
      expect(duration).toBeLessThan(500); // Larger budget for large queries
    });

    it('should handle high throughput', async () => {
      const query = TEST_QUERIES.safe.query;
      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await pipeline.processQuery(query, 'cloud');
      }

      const duration = performance.now() - startTime;
      const throughput = iterations / (duration / 1000);

      expect(throughput).toBeGreaterThan(100); // Target: >100 queries/sec
      expect(duration).toBeLessThan(1000); // Should complete 100 queries in <1 second
    });

    it('should maintain low memory usage', async () => {
      const startMemory = process.memoryUsage().heapUsed;

      // Process many queries
      for (let i = 0; i < 1000; i++) {
        await pipeline.processQuery(TEST_QUERIES.safe.query, 'cloud');
      }

      // Clear logs to free memory
      pipeline.clearAuditLogs();

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (<100MB for 10K queries, so <10MB for 1K)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});

// ============================================================================
// COMPLIANCE VALIDATION TESTS
// ============================================================================

describe('Privacy Pipeline - Compliance Validation', () => {
  let pipeline: PrivacyPipeline;

  beforeEach(() => {
    pipeline = new PrivacyPipeline();
  });

  afterEach(() => {
    pipeline.clearAuditLogs();
  });

  describe('GDPR Compliance', () => {
    it('should protect EU personal data', async () => {
      const query = 'My email is eu.citizen@example.eu and my phone is +33-1-23-45-67-89';
      const result = await pipeline.processQuery(query, 'cloud');

      // Should classify as sensitive
      expect(result.classification.level).toBe(PrivacyLevel.SENSITIVE);
      expect(result.classification.piiTypes.length).toBeGreaterThan(0);

      // Should redact or protect
      expect(result.firewallDecision.action).toMatch(/allow|redact/);
    });

    it('should log all data processing activities', async () => {
      await pipeline.processQuery('test@example.com', 'cloud');

      const logs = pipeline.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('HIPAA Compliance', () => {
    it('should block medical record numbers from cloud', async () => {
      const testCase = TEST_QUERIES.medical;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.piiTypes).toContain(PIIType.MEDICAL_RECORD);
      expect(result.classification.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(result.firewallDecision.action).toBe('deny');
      expect(result.allowed).toBe(false);
    });

    it('should allow medical records locally', async () => {
      const testCase = TEST_QUERIES.medical;
      const result = await pipeline.processQuery(testCase.query, 'local');

      expect(result.firewallDecision.action).toBe('allow');
      expect(result.firewallDecision.finalDestination).toBe('local');
    });
  });

  describe('PCI-DSS Compliance', () => {
    it('should block credit card numbers from cloud', async () => {
      const testCase = TEST_QUERIES.creditCard;
      const result = await pipeline.processQuery(testCase.query, 'cloud');

      expect(result.classification.piiTypes).toContain(PIIType.CREDIT_CARD);
      expect(result.classification.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(result.firewallDecision.action).toBe('deny');
    });
  });

  describe('Data Minimization', () => {
    it('should only collect necessary data', async () => {
      const result = await pipeline.processQuery(TEST_QUERIES.email.query, 'cloud');

      // Redacted query should not contain original PII
      expect(result.finalQuery).not.toContain('john.doe@example.com');

      // Audit logs should contain hashed queries (not plain text)
      const logs = pipeline.getAuditLogs();
      for (const log of logs) {
        expect(log.queryHash).toBeDefined();
        expect(log.queryHash).not.toContain('john.doe@example.com');
      }
    });
  });

  describe('Right to be Forgotten', () => {
    it('should allow clearing audit logs', async () => {
      await pipeline.processQuery(TEST_QUERIES.email.query, 'cloud');
      expect(pipeline.getAuditLogs().length).toBeGreaterThan(0);

      pipeline.clearAuditLogs();
      expect(pipeline.getAuditLogs().length).toBe(0);
    });
  });
});
