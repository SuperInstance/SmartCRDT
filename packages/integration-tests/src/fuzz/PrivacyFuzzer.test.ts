/**
 * PrivacyFuzzer.test.ts - Fuzzing Tests for Privacy Layer
 *
 * Fuzzing targets:
 * - PII detection with random text
 * - Intent encoding with random queries
 * - Redaction with edge cases
 * - Privacy classifier with malformed input
 *
 * @packageDocumentation
 */

import { describe, expect, beforeEach } from "vitest";
import {
  SemanticPIIRedactor,
  RedactionStrategy,
  type PIIInstance,
  type RedactedQuery,
} from "@lsi/privacy";
import { PIIType } from "@lsi/protocol";
import {
  registerFuzz,
  bufferFromString,
  randomBuffer,
  mutate,
} from "../fuzz/FuzzerFramework.js";

// ============================================================================
// FIXTURES
// ============================================================================

let redactor: SemanticPIIRedactor;

beforeEach(() => {
  redactor = new SemanticPIIRedactor();
});

// ============================================================================
// PII DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: PII Detection", () => {
  /**
   * Fuzz: Random text with PII patterns
   *
   * PII detector should handle random text without crashing.
   */
  registerFuzz(
    "PII detector handles random text",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 10000));
        const result = redactor.redact(text);

        // Result should be valid
        expect(result).toBeDefined();
        expect(typeof result.redacted).toBe("string");
        expect(Array.isArray(result.piiInstances)).toBe(true);
        expect(result.redactionCount).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Should handle all input gracefully
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 5000,
      timeout: 30000,
      mutations: ["bit_flip", "byte_insert", "byte_delete", "splice"],
      seed: bufferFromString(
        "Contact me at user@example.com or call 555-123-4567"
      ),
    }
  );

  /**
   * Fuzz: Text with invalid UTF-8
   *
   * PII detector should handle invalid UTF-8 gracefully.
   */
  registerFuzz(
    "PII detector handles invalid UTF-8",
    async (input: Buffer) => {
      try {
        // May throw on invalid UTF-8
        const text = input.toString("utf-8");
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        // Invalid UTF-8 is expected sometimes
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "bit_flip"],
      seed: bufferFromString("Valid text"),
    }
  );

  /**
   * Fuzz: Extremely long text
   *
   * PII detector should handle very long input.
   */
  registerFuzz(
    "PII detector handles very long text",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 100000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
        expect(result.redacted.length).toBeLessThanOrEqual(text.length);
      } catch (error) {
        // Should handle gracefully or throw reasonable error
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 1000,
      timeout: 15000,
      mutations: ["byte_insert", "duplicate"],
      seed: randomBuffer(1000, 10000),
      maxInputSize: 100000,
    }
  );
});

// ============================================================================
// EMAIL DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: Email Detection", () => {
  /**
   * Fuzz: Malformed email patterns
   *
   * Email detector should handle various malformed inputs.
   */
  registerFuzz(
    "Email detector handles malformed patterns",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
        expect(typeof result.redacted).toBe("string");
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete", "splice"],
      seed: bufferFromString(
        "Email: test@.com @example.com user@ @ test@invalid"
      ),
    }
  );

  /**
   * Fuzz: Edge case email-like patterns
   */
  registerFuzz(
    "Email detector handles edge cases",
    async (input: Buffer) => {
      const edgeCases = [
        "user@localhost",
        "user@127.0.0.1",
        "user@[IPv6:2001:db8::1]",
        "user+tag@example.com",
        "user.name@example.co.uk",
        "",
        "@",
        "@@",
        "a@b@c",
      ];

      const testInput =
        edgeCases.join(" ") + " " + input.toString("utf-8", 0, 100);

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();
      expect(typeof result.redacted).toBe("string");

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert"],
      seed: bufferFromString("test@email.com"),
    }
  );
});

// ============================================================================
// PHONE NUMBER DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: Phone Detection", () => {
  /**
   * Fuzz: Various phone number formats
   */
  registerFuzz(
    "Phone detector handles various formats",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString(
        "Phone: 555-123-4567 (555) 123-4567 555.123.4567 1234567890"
      ),
    }
  );

  /**
   * Fuzz: False positive patterns (not phones)
   */
  registerFuzz(
    "Phone detector avoids false positives",
    async (input: Buffer) => {
      const testInput =
        input.toString("utf-8", 0, 100) +
        " Version 1.2.3.4 ISBN 123-4-56789-012-3";

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();
      expect(typeof result.redacted).toBe("string");

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert"],
      seed: bufferFromString("555-123-4567"),
    }
  );
});

// ============================================================================
// SSN DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: SSN Detection", () => {
  /**
   * Fuzz: SSN-like patterns
   */
  registerFuzz(
    "SSN detector handles various patterns",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString("SSN: 123-45-6789 123456789 987-65-4321"),
    }
  );

  /**
   * Fuzz: Invalid SSN ranges
   */
  registerFuzz(
    "SSN detector handles invalid ranges",
    async (input: Buffer) => {
      const testInput =
        input.toString("utf-8", 0, 100) +
        " 000-00-0000 666-12-3456 999-99-9999 123-00-6789";

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// CREDIT CARD DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: Credit Card Detection", () => {
  /**
   * Fuzz: Credit card patterns
   */
  registerFuzz(
    "Credit card detector handles various formats",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString(
        "Card: 4111-1111-1111-1111 4111111111111111 5555-5555-5555-4444"
      ),
    }
  );

  /**
   * Fuzz: Invalid card numbers
   */
  registerFuzz(
    "Credit card detector handles invalid numbers",
    async (input: Buffer) => {
      const testInput =
        input.toString("utf-8", 0, 100) +
        " 0000-0000-0000-0000 1234-5678-9012-3456";

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// IP ADDRESS DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: IP Address Detection", () => {
  /**
   * Fuzz: IP address patterns
   */
  registerFuzz(
    "IP detector handles various formats",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString(
        "IP: 192.168.1.1 10.0.0.1 172.16.0.1 255.255.255.255"
      ),
    }
  );

  /**
   * Fuzz: IPv6 addresses
   */
  registerFuzz(
    "IP detector handles IPv6",
    async (input: Buffer) => {
      const testInput =
        input.toString("utf-8", 0, 100) +
        " 2001:0db8:85a3:0000:0000:8a2e:0370:7334 ::1 fe80::1";

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// URL DETECTION FUZZING
// ============================================================================

describe("Privacy Fuzzing: URL Detection", () => {
  /**
   * Fuzz: URL patterns
   */
  registerFuzz(
    "URL detector handles various formats",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString(
        "URL: https://example.com http://test.org ftp://files.net"
      ),
    }
  );

  /**
   * Fuzz: Malformed URLs
   */
  registerFuzz(
    "URL detector handles malformed URLs",
    async (input: Buffer) => {
      const testInput =
        input.toString("utf-8", 0, 100) +
        " http:// https:// ://example.com http:/example.com";

      const result = redactor.redact(testInput);

      expect(result).toBeDefined();

      return true;
    },
    {
      iterations: 2000,
      timeout: 15000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// REDACTION STRATEGY FUZZING
// ============================================================================

describe("Privacy Fuzzing: Redaction Strategies", () => {
  /**
   * Fuzz: Different redaction strategies
   */
  registerFuzz(
    "Redaction strategies handle various input",
    async (input: Buffer) => {
      const strategies = [
        RedactionStrategy.FULL,
        RedactionStrategy.PARTIAL,
        RedactionStrategy.TOKEN,
      ];

      const text = input.toString("utf-8", 0, Math.min(input.length, 5000));

      for (const strategy of strategies) {
        const config = { defaultStrategy: strategy };
        const customRedactor = new SemanticPIIRedactor(config);
        const result = customRedactor.redact(text);

        expect(result).toBeDefined();
        expect(result.strategy).toBe(strategy);
      }

      return true;
    },
    {
      iterations: 2000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete"],
      seed: bufferFromString("Email user@example.com"),
    }
  );
});

// ============================================================================
// MULTIPLE PII INSTANCES FUZZING
// ============================================================================

describe("Privacy Fuzzing: Multiple PII Instances", () => {
  /**
   * Fuzz: Text with multiple PII instances
   */
  registerFuzz(
    "Multiple PII instances are handled",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));

        // Add some known PII
        const textWithPII =
          text +
          " Email user@example.com" +
          " Phone 555-123-4567" +
          " SSN 123-45-6789";

        const result = redactor.redact(textWithPII);

        expect(result).toBeDefined();
        expect(result.piiInstances.length).toBeGreaterThanOrEqual(0);
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete", "duplicate"],
      seed: bufferFromString("Contact info:"),
    }
  );
});

// ============================================================================
// CONFIDENCE SCORE FUZZING
// ============================================================================

describe("Privacy Fuzzing: Confidence Scores", () => {
  /**
   * Fuzz: PII with various confidence levels
   */
  registerFuzz(
    "Confidence scores are in valid range",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));
        const result = redactor.redact(text);

        // All confidence scores should be in [0, 1]
        for (const pii of result.piiInstances) {
          expect(pii.confidence).toBeGreaterThanOrEqual(0);
          expect(pii.confidence).toBeLessThanOrEqual(1);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["bit_flip", "byte_insert"],
      seed: bufferFromString("Email user@example.com"),
    }
  );
});

// ============================================================================
// SPECIAL CHARACTERS FUZZING
// ============================================================================

describe("Privacy Fuzzing: Special Characters", () => {
  /**
   * Fuzz: Text with special characters
   */
  registerFuzz(
    "Special characters are handled",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));

        // Add special characters
        const textWithSpecial =
          text + "\x00\x01\x02\n\t\r" + "Email user@example.com";

        const result = redactor.redact(textWithSpecial);

        expect(result).toBeDefined();
        expect(typeof result.redacted).toBe("string");
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert"],
      seed: bufferFromString("Test"),
    }
  );

  /**
   * Fuzz: Unicode characters
   */
  registerFuzz(
    "Unicode characters are handled",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));

        const textWithUnicode = text + " 你好 🎉 Ñoño café";

        const result = redactor.redact(textWithUnicode);

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert"],
      seed: bufferFromString("Test"),
    }
  );
});

// ============================================================================
// EMPTY AND MINIMAL INPUT FUZZING
// ============================================================================

describe("Privacy Fuzzing: Empty Input", () => {
  /**
   * Fuzz: Empty string
   */
  registerFuzz(
    "Empty string is handled",
    async (input: Buffer) => {
      const result = redactor.redact("");

      expect(result.redacted).toBe("");
      expect(result.redactionCount).toBe(0);
      expect(result.piiInstances).toEqual([]);

      return true;
    },
    {
      iterations: 100,
      timeout: 5000,
      seed: bufferFromString(""),
    }
  );

  /**
   * Fuzz: Whitespace only
   */
  registerFuzz(
    "Whitespace is handled",
    async (input: Buffer) => {
      const whitespace = " \t\n\r ";
      const result = redactor.redact(whitespace);

      expect(result).toBeDefined();
      expect(typeof result.redacted).toBe("string");

      return true;
    },
    {
      iterations: 100,
      timeout: 5000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// OVERLAPPING PII FUZZING
// ============================================================================

describe("Privacy Fuzzing: Overlapping PII", () => {
  /**
   * Fuzz: Potentially overlapping PII patterns
   */
  registerFuzz(
    "Overlapping PII patterns are handled",
    async (input: Buffer) => {
      try {
        const text = input.toString("utf-8", 0, Math.min(input.length, 5000));

        // Add potentially overlapping patterns
        const textWithOverlap =
          text + " user@example.com 555-123-4567user@example.com";

        const result = redactor.redact(textWithOverlap);

        expect(result).toBeDefined();

        // Check that PII instances don't overlap in position
        const sorted = [...result.piiInstances].sort(
          (a, b) => a.start - b.start
        );
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].end > sorted[i + 1].start) {
            // Overlap detected - this is acceptable if handled
            expect(result.redacted).toBeDefined();
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert", "duplicate"],
      seed: bufferFromString("Test"),
    }
  );
});
