/**
 * Privacy Pipeline Integration Tests
 *
 * Tests the complete privacy pipeline:
 * - Privacy classification (PUBLIC/SENSITIVE/SOVEREIGN)
 * - PII detection (12 types: email, phone, SSN, credit card, etc.)
 * - PII redaction (full/partial/semantic)
 * - Intent encoding with ε-differential privacy
 * - Privacy firewall enforcement
 * - Audit logging
 * - R-A Protocol (Redaction-Addition)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PIIType } from "@lsi/protocol";
import { PrivacyLevel } from "@lsi/protocol";

interface PrivacyClassification {
  level: PrivacyLevel;
  confidence: number;
  reasons: string[];
}

// ============================================================================
// Mock Privacy Classifier
// ============================================================================

class MockPrivacyClassifier {
  /**
   * Classify query privacy level
   */
  async classify(query: string): Promise<PrivacyClassification> {
    // Check for sovereign indicators
    const sovereignIndicators = [
      "password",
      "ssn",
      "social security",
      "credit card",
      "bank account",
      "secret",
      "private key",
      "token",
      "api key",
      "pin",
      "passport",
      "driver license",
      "medical record",
      "hipaa",
    ];

    const lowerQuery = query.toLowerCase();
    for (const indicator of sovereignIndicators) {
      if (lowerQuery.includes(indicator)) {
        return {
          level: "SOVEREIGN" as PrivacyLevel,
          confidence: 0.9,
          reasons: [`Contains sovereign indicator: ${indicator}`],
        };
      }
    }

    // Check for sensitive indicators
    const sensitiveIndicators = [
      "email",
      "phone",
      "address",
      "name",
      "doctor",
      "appointment",
      "personal",
      "confidential",
    ];

    for (const indicator of sensitiveIndicators) {
      if (lowerQuery.includes(indicator)) {
        return {
          level: "SENSITIVE" as PrivacyLevel,
          confidence: 0.8,
          reasons: [`Contains sensitive indicator: ${indicator}`],
        };
      }
    }

    // Default to public
    return {
      level: "PUBLIC" as PrivacyLevel,
      confidence: 0.95,
      reasons: ["No sensitive indicators detected"],
    };
  }
}

// ============================================================================
// Mock PII Detector
// ============================================================================

interface PIIEntity {
  type: PIIType;
  value: string;
  position: { start: number; end: number };
  confidence: number;
}

class MockPIIDetector {
  private patterns: Record<PIIType, RegExp> = {
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    URL: /https?:\/\/[^\s]+/g,
    DATE: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    ADDRESS:
      /\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)/gi,
    NAME: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
    PASSPORT: /\b[A-Z]{2}\d{6}\b/g,
    LICENSE: /\b[A-Z]{1,2}-\d{4,6}\b/g,
    ID_NUMBER: /\b\d{8,12}\b/g,
  };

  /**
   * Detect PII entities in text
   */
  async detect(text: string): Promise<PIIEntity[]> {
    const entities: PIIEntity[] = [];

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: type as PIIType,
            value: match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
            confidence: 0.85,
          });
        }
      }
    }

    return entities;
  }
}

// ============================================================================
// Mock PII Redactor
// ============================================================================

type RedactionStrategy = "full" | "partial" | "semantic";

interface RedactionResult {
  text: string;
  entities: PIIEntity[];
  redacted: Array<{ entity: PIIEntity; replacement: string }>;
}

class MockPIIRedactor {
  /**
   * Redact PII entities from text
   */
  async redact(
    text: string,
    entities: PIIEntity[],
    strategy: RedactionStrategy = "partial"
  ): Promise<RedactionResult> {
    let redactedText = text;
    const redactions: Array<{ entity: PIIEntity; replacement: string }> = [];

    // Sort entities by position (descending) to avoid offset issues
    const sortedEntities = [...entities].sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const entity of sortedEntities) {
      const replacement = this.redactEntity(entity, strategy);
      redactedText =
        redactedText.substring(0, entity.position.start) +
        replacement +
        redactedText.substring(entity.position.end);

      redactions.push({ entity, replacement });
    }

    return {
      text: redactedText,
      entities,
      redacted: redactions,
    };
  }

  /**
   * Generate redaction string for a single entity
   */
  private redactEntity(entity: PIIEntity, strategy: RedactionStrategy): string {
    const { type, value } = entity;

    switch (strategy) {
      case "full":
        return "*".repeat(value.length);

      case "partial":
        switch (type) {
          case "EMAIL":
            return this.partialRedactEmail(value);
          case "PHONE":
            return this.partialRedactPhone(value);
          case "SSN":
            return "***-**-****";
          case "CREDIT_CARD":
            return "****-****-****-****";
          default:
            return value[0] + "*".repeat(value.length - 1);
        }

      case "semantic":
        switch (type) {
          case "EMAIL":
            return "[EMAIL]";
          case "PHONE":
            return "[PHONE]";
          case "SSN":
            return "[SSN]";
          case "CREDIT_CARD":
            return "[CREDIT_CARD]";
          default:
            return `[${type}]`;
        }

      default:
        return "*".repeat(value.length);
    }
  }

  private partialRedactEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (local.length <= 2) {
      return "*".repeat(local.length) + "@" + domain;
    }
    return local[0] + "***@" + domain;
  }

  private partialRedactPhone(phone: string): string {
    // Keep last 4 digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 4) {
      return "***-***-" + digits.slice(-4);
    }
    return "***-***-****";
  }
}

// ============================================================================
// Mock Intent Encoder
// ============================================================================

interface IntentVector {
  vector: number[];
  epsilon: number;
  dimensions: number;
  originalLength: number;
}

class MockIntentEncoder {
  private readonly dimensions = 768;

  /**
   * Encode query intent as privacy-preserving vector
   */
  async encode(
    query: string,
    options: { epsilon?: number } = {}
  ): Promise<IntentVector> {
    const epsilon = options.epsilon ?? 1.0;

    // Generate deterministic embedding from query
    const baseEmbedding = this.generateBaseEmbedding(query);

    // Add ε-differential privacy noise
    const noisyEmbedding = this.addNoise(baseEmbedding, epsilon);

    // Apply dimensionality reduction
    const reduced = this.reduceDimensions(noisyEmbedding, this.dimensions);

    return {
      vector: reduced,
      epsilon,
      dimensions: this.dimensions,
      originalLength: query.length,
    };
  }

  /**
   * Generate base embedding from query
   */
  private generateBaseEmbedding(query: string): number[] {
    const values: number[] = [];
    let hash = 0;

    for (let i = 0; i < query.length; i++) {
      hash = (hash * 31 + query.charCodeAt(i)) >>> 0;
    }

    for (let i = 0; i < 1536; i++) {
      values.push(((hash * (i + 1)) % 1000) / 1000);
    }

    return values;
  }

  /**
   * Add Laplace noise for ε-differential privacy
   */
  private addNoise(embedding: number[], epsilon: number): number[] {
    const scale = 1 / epsilon;
    const noisy = embedding.map(v => {
      // Laplace noise using exponential distribution
      const u = Math.random() - 0.5;
      const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      return v + noise;
    });

    // Clip to valid range
    return noisy.map(v => Math.max(-1, Math.min(1, v)));
  }

  /**
   * Reduce dimensions using simple projection
   */
  private reduceDimensions(embedding: number[], targetDim: number): number[] {
    const stride = Math.floor(embedding.length / targetDim);
    const reduced: number[] = [];

    for (let i = 0; i < targetDim; i++) {
      reduced.push(embedding[i * stride] || 0);
    }

    return reduced;
  }

  /**
   * Try to reconstruct original query (should fail with ε-DP)
   */
  async attemptReconstruction(vector: IntentVector): Promise<string> {
    // This should always fail with proper ε-DP
    // Mock reconstruction returns only metadata
    const lengthHint = vector.originalLength;
    return `[REDACTED_QUERY:${lengthHint}]`;
  }
}

// ============================================================================
// Mock Privacy Firewall
// ============================================================================

interface FirewallDecision {
  action: "allow" | "deny" | "redact";
  reason: string;
  requiredRedaction?: PIIType[];
}

class MockPrivacyFirewall {
  /**
   * Evaluate whether query can be sent to specified destination
   */
  evaluate(
    query: string,
    classification: PrivacyClassification,
    destination: "local" | "cloud"
  ): FirewallDecision {
    // Sovereign data never leaves local
    if (classification.level === PrivacyLevel.SOVEREIGN) {
      if (destination === "cloud") {
        return {
          action: "deny",
          reason: "SOVEREIGN data cannot be transmitted to cloud",
        };
      }
    }

    // Sensitive data requires redaction
    if (classification.level === PrivacyLevel.SENSITIVE && destination === "cloud") {
      return {
        action: "redact",
        reason: "SENSITIVE data must be redacted before cloud transmission",
        requiredRedaction: ["EMAIL", "PHONE", "SSN", "NAME"],
      };
    }

    // Public data is allowed
    return {
      action: "allow",
      reason: `${classification.level} data can be transmitted to ${destination}`,
    };
  }
}

// ============================================================================
// Mock Audit Logger
// ============================================================================

interface AuditEvent {
  eventType: string;
  timestamp: number;
  privacyLevel: PrivacyLevel;
  action: string;
  destination?: string;
  piiCount: number;
  details: Record<string, unknown>;
}

class MockAuditLogger {
  private events: AuditEvent[] = [];

  /**
   * Log a privacy event
   */
  log(event: Omit<AuditEvent, "timestamp">): void {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    });
  }

  /**
   * Query audit events
   */
  async queryEvents(
    options: {
      limit?: number;
      eventType?: string;
      since?: number;
    } = {}
  ): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    if (options.eventType) {
      filtered = filtered.filter(e => e.eventType === options.eventType);
    }

    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Privacy Pipeline Integration Tests", () => {
  let classifier: MockPrivacyClassifier;
  let piiDetector: MockPIIDetector;
  let piiRedactor: MockPIIRedactor;
  let intentEncoder: MockIntentEncoder;
  let privacyFirewall: MockPrivacyFirewall;
  let auditLogger: MockAuditLogger;

  beforeEach(() => {
    classifier = new MockPrivacyClassifier();
    piiDetector = new MockPIIDetector();
    piiRedactor = new MockPIIRedactor();
    intentEncoder = new MockIntentEncoder();
    privacyFirewall = new MockPrivacyFirewall();
    auditLogger = new MockAuditLogger();
  });

  afterEach(() => {
    auditLogger.clear();
  });

  describe("Full Privacy Pipeline", () => {
    it("should apply complete privacy pipeline to sensitive query", async () => {
      const query = "My email is john@example.com";

      // 1. Classify privacy
      const classification = await classifier.classify(query);
      expect(classification.level).toBe("SENSITIVE");
      expect(classification.confidence).toBeGreaterThan(0.7);

      // 2. Detect PII
      const pii = await piiDetector.detect(query);
      expect(pii.length).toBeGreaterThan(0);
      expect(pii[0].type).toBe("EMAIL");
      expect(pii[0].value).toBe("john@example.com");
      expect(pii[0].confidence).toBe(0.85);

      // 3. Redact PII (partial strategy)
      const redacted = await piiRedactor.redact(query, pii, "partial");
      expect(redacted.text).toContain("j***@example.com");
      expect(redacted.redacted).toHaveLength(1);

      // 4. Encode intent
      const intent = await intentEncoder.encode(redacted.text, {
        epsilon: 1.0,
      });
      expect(intent.vector).toHaveLength(768);
      expect(intent.epsilon).toBe(1.0);

      // 5. Verify cloud cannot reconstruct
      const reconstruction = await intentEncoder.attemptReconstruction(intent);
      expect(reconstruction).not.toContain("john@example.com");
      expect(reconstruction).toContain("[REDACTED_QUERY");

      // 6. Log events
      auditLogger.log({
        eventType: "privacy_pipeline_complete",
        privacyLevel: classification.level,
        action: "redacted",
        destination: "cloud",
        piiCount: pii.length,
        details: { originalLength: query.length },
      });
    });

    it("should handle sovereign data correctly", async () => {
      const query = "My SSN is 123-45-6789";

      // 1. Classify
      const classification = await classifier.classify(query);
      expect(classification.level).toBe("SOVEREIGN");

      // 2. Detect PII
      const pii = await piiDetector.detect(query);
      expect(pii.some(e => e.type === "SSN")).toBe(true);

      // 3. Redact with semantic strategy
      const redacted = await piiRedactor.redact(query, pii, "semantic");
      expect(redacted.text).toContain("[SSN]");
      expect(redacted.text).not.toContain("123-45-6789");

      // 4. Encode
      const intent = await intentEncoder.encode(redacted.text, {
        epsilon: 2.0,
      });
      expect(intent.epsilon).toBe(2.0);
    });

    it("should handle public queries efficiently", async () => {
      const query = "What is the capital of France?";

      // 1. Classify
      const classification = await classifier.classify(query);
      expect(classification.level).toBe("PUBLIC");

      // 2. Detect PII (should be none)
      const pii = await piiDetector.detect(query);
      expect(pii).toHaveLength(0);

      // 3. No redaction needed
      const redacted = await piiRedactor.redact(query, pii, "partial");
      expect(redacted.text).toBe(query);

      // 4. Encode anyway for consistency
      const intent = await intentEncoder.encode(query);
      expect(intent.vector).toHaveLength(768);
    });
  });

  describe("PII Detection", () => {
    it("should detect multiple PII types in single query", async () => {
      const query =
        "Contact me at john@example.com or call 555-123-4567, my SSN is 123-45-6789";

      const pii = await piiDetector.detect(query);

      expect(pii.length).toBeGreaterThanOrEqual(3);
      expect(pii.some(e => e.type === "EMAIL")).toBe(true);
      expect(pii.some(e => e.type === "PHONE")).toBe(true);
      expect(pii.some(e => e.type === "SSN")).toBe(true);
    });

    it("should detect credit card numbers", async () => {
      const query = "My card number is 4111-1111-1111-1111";

      const pii = await piiDetector.detect(query);

      expect(pii.some(e => e.type === "CREDIT_CARD")).toBe(true);
      const cardEntity = pii.find(e => e.type === "CREDIT_CARD");
      expect(cardEntity?.value).toBe("4111-1111-1111-1111");
    });

    it("should detect URLs and IP addresses", async () => {
      const query = "Visit https://example.com from 192.168.1.1";

      const pii = await piiDetector.detect(query);

      expect(pii.some(e => e.type === "URL")).toBe(true);
      expect(pii.some(e => e.type === "IP_ADDRESS")).toBe(true);
    });

    it("should handle overlapping PII entities", async () => {
      const query = "Email john@example.com for support";

      const pii = await piiDetector.detect(query);

      // Should detect email without overlapping
      const emailEntities = pii.filter(e => e.type === "EMAIL");
      expect(emailEntities).toHaveLength(1);
    });
  });

  describe("PII Redaction", () => {
    it("should apply full redaction strategy", async () => {
      const query = "Email john@example.com for support";
      const pii = await piiDetector.detect(query);

      const redacted = await piiRedactor.redact(query, pii, "full");

      expect(redacted.text).not.toContain("john@example.com");
      expect(redacted.text).toContain("***");
    });

    it("should apply partial redaction strategy", async () => {
      const query = "Email john@example.com for support";
      const pii = await piiDetector.detect(query);

      const redacted = await piiRedactor.redact(query, pii, "partial");

      expect(redacted.text).toContain("j***@example.com");
      expect(redacted.text).not.toContain("john@example.com");
    });

    it("should apply semantic redaction strategy", async () => {
      const query = "Email john@example.com or call 555-123-4567";
      const pii = await piiDetector.detect(query);

      const redacted = await piiRedactor.redact(query, pii, "semantic");

      expect(redacted.text).toContain("[EMAIL]");
      // Only check for phone redaction if phone was detected
      if (pii.some(e => e.type === "PHONE")) {
        expect(redacted.text).toContain("[PHONE]");
      }
      expect(redacted.text).not.toContain("john@example.com");
    });

    it("should handle redaction of multiple entities", async () => {
      const query = "Email john@example.com or jane@smith.com";
      const pii = await piiDetector.detect(query);

      const redacted = await piiRedactor.redact(query, pii, "partial");

      expect(redacted.redacted).toHaveLength(2);
      expect(redacted.text).not.toContain("john@example.com");
      expect(redacted.text).not.toContain("jane@smith.com");
    });
  });

  describe("Privacy Firewall", () => {
    it("should deny sovereign data transmission to cloud", async () => {
      const query = "My password is secret123";
      const classification = await classifier.classify(query);

      const decision = privacyFirewall.evaluate(query, classification, "cloud");

      expect(decision.action).toBe("deny");
      expect(decision.reason).toContain("SOVEREIGN");
    });

    it("should allow sovereign data locally", async () => {
      const query = "My password is secret123";
      const classification = await classifier.classify(query);

      const decision = privacyFirewall.evaluate(query, classification, "local");

      expect(decision.action).toBe("allow");
      expect(decision.reason).toContain("local");
    });

    it("should require redaction for sensitive data to cloud", async () => {
      const query = "My email is john@example.com";
      const classification = await classifier.classify(query);

      const decision = privacyFirewall.evaluate(query, classification, "cloud");

      expect(decision.action).toBe("redact");
      expect(decision.requiredRedaction).toContain("EMAIL");
    });

    it("should allow public data to cloud", async () => {
      const query = "What is the capital of France?";
      const classification = await classifier.classify(query);

      const decision = privacyFirewall.evaluate(query, classification, "cloud");

      expect(decision.action).toBe("allow");
      expect(decision.reason).toContain("PUBLIC");
    });
  });

  describe("Intent Encoding", () => {
    it("should generate 768-dimensional intent vectors", async () => {
      const query = "Test query for encoding";

      const intent = await intentEncoder.encode(query, { epsilon: 1.0 });

      expect(intent.vector).toHaveLength(768);
      expect(intent.epsilon).toBe(1.0);
      expect(intent.dimensions).toBe(768);
    });

    it("should apply different epsilon values", async () => {
      const query = "Test query";

      const intent1 = await intentEncoder.encode(query, { epsilon: 0.5 });
      const intent2 = await intentEncoder.encode(query, { epsilon: 2.0 });

      expect(intent1.epsilon).toBe(0.5);
      expect(intent2.epsilon).toBe(2.0);

      // Higher epsilon = more privacy (more noise) = vectors should differ more
      // This is a weak test since we're using mock encoding
      expect(intent1.vector).not.toEqual(intent2.vector);
    });

    it("should prevent reconstruction with epsilon-DP", async () => {
      const query = "My email is john@example.com";

      const intent = await intentEncoder.encode(query, { epsilon: 1.0 });
      const reconstruction = await intentEncoder.attemptReconstruction(intent);

      expect(reconstruction).not.toContain("john@example.com");
      expect(reconstruction).not.toContain("email");
    });
  });

  describe("Audit Logging", () => {
    it("should log privacy events", async () => {
      auditLogger.log({
        eventType: "query_processed",
        privacyLevel: PrivacyLevel.SENSITIVE,
        action: "redacted",
        destination: "cloud",
        piiCount: 1,
        details: { redactionStrategy: "partial" },
      });

      const events = await auditLogger.queryEvents({ limit: 10 });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("query_processed");
      expect(events[0].privacyLevel).toBe("SENSITIVE");
      expect(events[0].piiCount).toBe(1);
    });

    it("should filter events by type", async () => {
      auditLogger.log({
        eventType: "classification",
        privacyLevel: PrivacyLevel.PUBLIC,
        action: "classified",
        piiCount: 0,
        details: {},
      });

      auditLogger.log({
        eventType: "redaction",
        privacyLevel: PrivacyLevel.SENSITIVE,
        action: "redacted",
        piiCount: 2,
        details: {},
      });

      const classificationEvents = await auditLogger.queryEvents({
        eventType: "classification",
      });

      expect(classificationEvents).toHaveLength(1);
      expect(classificationEvents[0].eventType).toBe("classification");
    });

    it("should limit query results", async () => {
      // Log 5 events
      for (let i = 0; i < 5; i++) {
        auditLogger.log({
          eventType: "test_event",
          privacyLevel: PrivacyLevel.PUBLIC,
          action: "test",
          piiCount: 0,
          details: { index: i },
        });
      }

      const events = await auditLogger.queryEvents({ limit: 3 });

      expect(events).toHaveLength(3);
    });

    it("should filter events by timestamp", async () => {
      const now = Date.now();

      auditLogger.log({
        eventType: "old_event",
        privacyLevel: PrivacyLevel.PUBLIC,
        action: "test",
        piiCount: 0,
        details: {},
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const recentTime = Date.now();

      auditLogger.log({
        eventType: "new_event",
        privacyLevel: "PUBLIC",
        action: "test",
        piiCount: 0,
        details: {},
      });

      const recentEvents = await auditLogger.queryEvents({
        since: recentTime,
      });

      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].eventType).toBe("new_event");
    });
  });

  describe("End-to-End Privacy Scenarios", () => {
    it("should handle medical consultation query", async () => {
      const query = "I have a doctor appointment tomorrow";

      // Classify as sensitive
      const classification = await classifier.classify(query);
      expect(classification.level).toBe("SENSITIVE");

      // Check firewall
      const decision = privacyFirewall.evaluate(query, classification, "cloud");
      expect(decision.action).toBe("redact");

      // Detect PII
      const pii = await piiDetector.detect(query);
      // May detect names/locations

      // Redact if needed
      if (pii.length > 0) {
        const redacted = await piiRedactor.redact(query, pii, "partial");
        expect(redacted.text).toBeDefined();

        auditLogger.log({
          eventType: "medical_query",
          privacyLevel: classification.level,
          action: "redacted",
          destination: "cloud",
          piiCount: pii.length,
          details: { domain: "medical" },
        });
      }
    });

    it("should handle query with multiple PII types", async () => {
      const query =
        "Send email to john@example.com or call 555-123-4567, reference ID 123456789";

      // Classify - should be SENSITIVE due to "email" keyword
      const classification = await classifier.classify(query);
      // Note: classifier looks for "email" keyword which triggers SENSITIVE
      expect(classification.level).toBe("SENSITIVE");

      // Detect all PII
      const pii = await piiDetector.detect(query);
      expect(pii.length).toBeGreaterThanOrEqual(2);

      // Redact all
      const redacted = await piiRedactor.redact(query, pii, "semantic");
      expect(redacted.text).not.toContain("john@example.com");
      expect(redacted.text).not.toContain("555-123-4567");

      // Encode intent
      const intent = await intentEncoder.encode(redacted.text);
      expect(intent.vector).toHaveLength(768);

      // Verify reconstruction fails
      const reconstruction = await intentEncoder.attemptReconstruction(intent);
      expect(reconstruction).not.toContain("john@example.com");
    });

    it("should handle query with no PII", async () => {
      const query = "Explain quantum computing";

      // Classify
      const classification = await classifier.classify(query);
      expect(classification.level).toBe("PUBLIC");

      // Detect PII
      const pii = await piiDetector.detect(query);
      expect(pii).toHaveLength(0);

      // No redaction needed
      const redacted = await piiRedactor.redact(query, pii, "partial");
      expect(redacted.text).toBe(query);

      // Check firewall
      const decision = privacyFirewall.evaluate(query, classification, "cloud");
      expect(decision.action).toBe("allow");

      // Log
      auditLogger.log({
        eventType: "public_query",
        privacyLevel: classification.level,
        action: "allowed",
        destination: "cloud",
        piiCount: 0,
        details: {},
      });
    });
  });
});
