/**
 * @lsi/performance-tests
 *
 * Performance benchmarks for @lsi/privacy package.
 *
 * Tests:
 * - PII classification speed
 * - Intent encoding performance
 * - Redaction-Addition Protocol
 * - Privacy decision making
 */

import { describe, bench, beforeEach } from "vitest";
import { PrivacyClassifier } from "@lsi/privacy/classifier";
import { IntentEncoder } from "@lsi/privacy/encoder";
import { RedactionAdditionProtocol } from "@lsi/privacy/protocol";

describe("@lsi/privacy Benchmarks", () => {
  let classifier: PrivacyClassifier;
  let encoder: IntentEncoder;
  let rap: RedactionAdditionProtocol;

  beforeEach(() => {
    classifier = new PrivacyClassifier();
    encoder = new IntentEncoder();
    rap = new RedactionAdditionProtocol();
  });

  describe("PII Classification", () => {
    bench("classify - simple text (no PII)", () => {
      return classifier.classify("What is the weather today?");
    });

    bench("classify - text with email", () => {
      return classifier.classify("Contact me at user@example.com for details.");
    });

    bench("classify - text with phone number", () => {
      return classifier.classify("Call me at 555-123-4567 for assistance.");
    });

    bench("classify - text with SSN", () => {
      return classifier.classify("My social security number is 123-45-6789.");
    });

    bench("classify - text with credit card", () => {
      return classifier.classify(
        "My credit card number is 4532-1234-5678-9010."
      );
    });

    bench("classify - text with multiple PII types", () => {
      return classifier.classify(
        "John Smith (email: john@example.com, phone: 555-010-9988) lives at 123 Main St, Anytown, CA 12345. SSN: 987-65-4321"
      );
    });

    bench("classify - long text (500 chars)", () => {
      const longText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        Contact: test@example.com or call 555-123-4567 for more information about our services.`;
      return classifier.classify(longText);
    });
  });

  describe("Intent Encoding", () => {
    bench("encode - simple query", () => {
      return encoder.encode("What is AI?");
    });

    bench("encode - moderate query", () => {
      return encoder.encode(
        "Explain the difference between supervised and unsupervised learning"
      );
    });

    bench("encode - complex query", () => {
      return encoder.encode(
        "Analyze the security implications of using intent vectors for privacy-preserving computation in distributed AI systems"
      );
    });

    bench("encode - query with PII (should redact first)", () => {
      return encoder.encode(
        "My email is john@example.com, what is my account status?"
      );
    });
  });

  describe("Redaction-Addition Protocol", () => {
    bench("redact - simple query", () => {
      return rap.redact("What is the capital of France?");
    });

    bench("redact - query with email", () => {
      return rap.redact("Contact support at support@example.com");
    });

    bench("redact - query with multiple PII", () => {
      return rap.redact(
        "John Doe (555-123-4567, john@company.com) at 123 Business Ave needs help with account 987-65-4321"
      );
    });

    bench("hydrate - simple structural query", () => {
      return rap.hydrate(
        "QUERY_TYPE: general, ENTITIES: [capital, france], INTENT: question"
      );
    });

    bench("full R-A flow (redact + hydrate)", async () => {
      const original =
        "My email is user@example.com, what is my account balance?";
      const redacted = await rap.redact(original);
      return await rap.hydrate(redacted.structuralQuery);
    });
  });

  describe("Batch Processing", () => {
    const queries = [
      "What is the weather?",
      "Contact me at user@example.com",
      "My phone is 555-123-4567",
      "Explain machine learning",
      "My SSN is 123-45-6789, help me",
      "What is 2+2?",
      "Email: admin@test.org, call 555-999-8888",
      "How does CRDT work?",
      "Credit card: 4532-1234-5678-9010",
      "What is quantum computing?",
    ];

    bench("batch classify 10 queries", async () => {
      const results = [];
      for (const query of queries) {
        results.push(await classifier.classify(query));
      }
      return results;
    });

    bench("batch encode 10 queries", async () => {
      const results = [];
      for (const query of queries) {
        results.push(await encoder.encode(query));
      }
      return results;
    });

    bench("batch redact 10 queries", async () => {
      const results = [];
      for (const query of queries) {
        results.push(await rap.redact(query));
      }
      return results;
    });
  });

  describe("Pattern Matching Performance", () => {
    bench("email detection regex", () => {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const text =
        "Contact us at support@example.com or sales@test.org for help";
      return text.match(emailRegex);
    });

    bench("phone detection regex", () => {
      const phoneRegex = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
      const text = "Call 555-123-4567 or 555.987.6543 or 555 555 5555";
      return text.match(phoneRegex);
    });

    bench("SSN detection regex", () => {
      const ssnRegex = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
      const text = "SSN: 123-45-6789 or 987.65.4321 or 555 44 3333";
      return text.match(ssnRegex);
    });
  });
});
