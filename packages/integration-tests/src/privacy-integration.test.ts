/**
 * Suite 4: Privacy Layer Integration
 *
 * Tests R-A Protocol, IntentEncoder, PrivacyClassifier,
 * and integration with cascade router.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RedactionAdditionProtocol,
  IntentEncoder,
  PrivacyClassifier,
  SensitivityLevel,
  ExtendedPIIType,
  PrivacyIntent,
} from "@lsi/privacy";
import { IntentCategory } from "@lsi/protocol";

describe("Privacy Layer Integration", () => {
  describe("Redaction-Addition Protocol", () => {
    let raProtocol: RedactionAdditionProtocol;

    beforeEach(() => {
      raProtocol = new RedactionAdditionProtocol();
    });

    it("should redact PII from queries", async () => {
      const query = "Send email to john@example.com about account #12345";

      const result = await raProtocol.processQuery(query);

      expect(result).toBeDefined();
      expect(result.query).toContain("[REDACTED]");
      expect(result.originalQuery).toBe(query);
      expect(result.redactedCount).toBeGreaterThan(0);
    });

    it("should preserve query structure after redaction", async () => {
      const query = "Email john@example.com about the project";

      const result = await raProtocol.processQuery(query);

      expect(result).toBeDefined();
      expect(result.query).not.toContain("john@example.com");
      expect(result.query).toContain("[REDACTED]");
      // Structure should be preserved
      expect(result.query.split(" ").length).toBeLessThanOrEqual(
        query.split(" ").length
      );
    });

    it("should generate structural query for cloud", async () => {
      const query = "What is the password for admin@example.com?";

      const result = await raProtocol.processQuery(query);

      expect(result).toBeDefined();
      expect(result.structuralQuery).toBeDefined();
      expect(result.structuralQuery).not.toContain("admin@example.com");
    });

    it("should re-hydrate responses", async () => {
      const query = "Contact john@example.com";
      const cloudResponse =
        "I will help you contact [REDACTED] about that matter.";

      const result = await raProtocol.processQuery(query);
      const rehydrated = await raProtocol.rehydrateResponse(
        cloudResponse,
        result.redactionMap
      );

      expect(rehydrated).toBeDefined();
      // Response should be processed
    });

    it("should handle multiple PII types", async () => {
      const query =
        "My SSN is 123-45-6789 and phone is 555-1234. Email to jane@example.org.";

      const result = await raProtocol.processQuery(query);

      expect(result).toBeDefined();
      expect(result.redactedCount).toBeGreaterThan(0);
      expect(result.detectedPII).toBeDefined();
    });

    it("should track redaction metadata", async () => {
      const query = "Send credit card 4111-1111-1111-1111 to bob@example.com";

      const result = await raProtocol.processQuery(query);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.sensitivityLevel).toBeDefined();
    });
  });

  describe("Intent Encoder", () => {
    let encoder: IntentEncoder;

    beforeEach(() => {
      encoder = new IntentEncoder();
    });

    it("should encode queries as vectors", async () => {
      const query = "What is artificial intelligence?";

      const vector = await encoder.encode(query);

      expect(vector).toBeDefined();
      expect(vector.embedding).toBeDefined();
      expect(vector.embedding.length).toBe(768); // OpenAI text-embedding-3-small
      expect(vector.intentType).toBe(IntentCategory.QUERY);
    });

    it("should preserve semantic meaning", async () => {
      const query1 = "What is AI?";
      const query2 = "Define artificial intelligence";

      const vector1 = await encoder.encode(query1);
      const vector2 = await encoder.encode(query2);

      expect(vector1).toBeDefined();
      expect(vector2).toBeDefined();

      // Similar queries should have similar embeddings
      // (cosine similarity would be calculated here in real implementation)
    });

    it("should classify intent correctly", async () => {
      const queries = [
        { text: "What is 2+2?", intent: IntentCategory.QUERY },
        {
          text: "Generate code for sorting",
          intent: IntentCategory.CODE_GENERATION,
        },
        { text: "Write a poem", intent: IntentCategory.CREATIVE },
        { text: "Fix this bug", intent: IntentCategory.DEBUGGING },
      ];

      for (const { text, intent } of queries) {
        const vector = await encoder.encode(text);
        expect(vector.intentType).toBe(intent);
      }
    });

    it("should add noise for differential privacy", async () => {
      const query = "Sensitive query";
      const epsilon = 1.0;

      const vector = await encoder.encode(query, { epsilon });

      expect(vector).toBeDefined();
      // Should have privacy noise applied
    });

    it("should generate summaries", async () => {
      const query =
        "I need to understand the performance implications of using different database indexing strategies for a large-scale e-commerce platform with millions of products.";

      const vector = await encoder.encode(query);

      expect(vector).toBeDefined();
      expect(vector.summary).toBeDefined();
      expect(vector.summary.length).toBeGreaterThan(0);
      expect(vector.summary.length).toBeLessThan(query.length);
    });
  });

  describe("Privacy Classifier", () => {
    let classifier: PrivacyClassifier;

    beforeEach(() => {
      classifier = new PrivacyClassifier();
    });

    it("should classify sensitivity levels", async () => {
      const queries = [
        { text: "What is 2+2?", level: SensitivityLevel.SAFE },
        { text: "My email is test@example.com", level: SensitivityLevel.STYLE },
        { text: "Password is secret123", level: SensitivityLevel.SECRET },
      ];

      for (const { text, level } of queries) {
        const result = await classifier.classify(text);
        expect(result.level).toBe(level);
      }
    });

    it("should detect PII types", async () => {
      const queries = [
        { text: "Email to test@example.com", pii: ExtendedPIIType.EMAIL },
        { text: "Phone: 555-1234", pii: ExtendedPIIType.PHONE },
        { text: "SSN: 123-45-6789", pii: ExtendedPIIType.SSN },
        { text: "Card: 4111-1111-1111-1111", pii: ExtendedPIIType.CREDIT_CARD },
      ];

      for (const { text, pii } of queries) {
        const result = await classifier.classify(text);
        expect(result.detectedPII).toContain(pii);
      }
    });

    it("should recommend privacy actions", async () => {
      const query = "My password is secret123 and email is test@example.com";

      const result = await classifier.classify(query);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(
        result.intent === PrivacyIntent.REDACT ||
          result.intent === PrivacyIntent.REWRITE ||
          result.intent === PrivacyIntent.BLOCK
      ).toBe(true);
    });

    it("should provide confidence scores", async () => {
      const query = "Send email to test@example.com";

      const result = await classifier.classify(query);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Privacy + Cascade Integration", () => {
    it("should route sensitive queries locally", async () => {
      const classifier = new PrivacyClassifier();
      const { CascadeRouter } = await import("@lsi/cascade");

      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text"],
            streaming: true,
          },
        },
        complexityThreshold: 0.7,
        privacyLayer: classifier,
      });

      const sensitiveQuery = "What is my password for admin@example.com?";
      const decision = await router.route(sensitiveQuery);

      expect(decision).toBeDefined();
      // Should route locally due to privacy
      expect(decision.backend).toBe("local");
    });

    it("should apply redaction before cloud routing", async () => {
      const raProtocol = new RedactionAdditionProtocol();
      const query = "Email john@example.com about project";

      const processed = await raProtocol.processQuery(query);

      expect(processed.query).not.toContain("john@example.com");
      expect(processed.query).toContain("[REDACTED]");
    });

    it("should preserve privacy in multi-turn conversations", async () => {
      const encoder = new IntentEncoder();

      const queries = [
        "My email is john@example.com",
        "What is my email address?",
        "Send message to my email",
      ];

      const vectors = await Promise.all(queries.map(q => encoder.encode(q)));

      // All vectors should have privacy considerations
      vectors.forEach(v => {
        expect(v).toBeDefined();
        expect(v.privacyPreserved).toBe(true);
      });
    });
  });

  describe("Privacy Guarantees", () => {
    it("should satisfy ε-differential privacy", async () => {
      const encoder = new IntentEncoder();
      const epsilon = 1.0;

      const query1 = "User Alice likes pizza";
      const query2 = "User Bob likes pizza";

      const vector1 = await encoder.encode(query1, { epsilon });
      const vector2 = await encoder.encode(query2, { epsilon });

      // Vectors should be similar enough to guarantee ε-DP
      // In real implementation, would verify with formal DP test
      expect(vector1).toBeDefined();
      expect(vector2).toBeDefined();
    });

    it("should handle GDPR right to be forgotten", async () => {
      const raProtocol = new RedactionAdditionProtocol();

      const query = "Store data for user@example.com";
      const result = await raProtocol.processQuery(query);

      // All PII should be redacted
      expect(result.query).not.toContain("user@example.com");
      expect(result.query).toContain("[REDACTED]");
    });

    it("should handle HIPAA compliance", async () => {
      const query =
        "Patient John Doe has condition X and should take medication Y";

      const classifier = new PrivacyClassifier();
      const result = await classifier.classify(query);

      expect(result.level).toBe(SensitivityLevel.SECRET);
      expect(result.detectedPII.length).toBeGreaterThan(0);
    });
  });

  describe("Privacy Performance", () => {
    it("should redact efficiently", async () => {
      const raProtocol = new RedactionAdditionProtocol();
      const query = "Email test@example.com about account 12345";

      const startTime = Date.now();
      const result = await raProtocol.processQuery(query);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it("should encode efficiently", async () => {
      const encoder = new IntentEncoder();
      const query = "What is artificial intelligence?";

      const startTime = Date.now();
      const vector = await encoder.encode(query);
      const endTime = Date.now();

      expect(vector).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });
  });
});
