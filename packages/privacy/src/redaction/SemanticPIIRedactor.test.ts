/**
 * Tests for SemanticPIIRedactor
 *
 * Comprehensive test suite covering:
 * - PII detection for all 12 types
 * - Redaction strategies (full, partial, token)
 * - Multiple PII in same query
 * - Edge cases (empty, unicode, malformed)
 * - Restore/roundtrip functionality
 * - Context-aware detection
 * - Configuration and customization
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SemanticPIIRedactor,
  RedactionStrategy,
  type PIIInstance,
  type RedactedQuery,
  type SemanticPIIRedactorConfig,
} from "./SemanticPIIRedactor.js";
import { PIIType } from "@lsi/protocol";

describe("SemanticPIIRedactor", () => {
  let redactor: SemanticPIIRedactor;

  beforeEach(() => {
    redactor = new SemanticPIIRedactor();
  });

  describe("EMAIL Detection", () => {
    it("should detect email addresses", () => {
      const query = "Send the report to john.doe@example.com";
      const instances = redactor.detect(query);

      const emailInstances = instances.filter(i => i.type === PIIType.EMAIL);
      expect(emailInstances.length).toBeGreaterThan(0);
      expect(emailInstances[0].value).toBe("john.doe@example.com");
    });

    it("should detect multiple email addresses", () => {
      const query = "Email me at john@example.com or jane@example.org";
      const instances = redactor.detect(query);

      const emailInstances = instances.filter(i => i.type === PIIType.EMAIL);
      expect(emailInstances.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect email with subdomains", () => {
      const query = "Contact support@mail.example.com";
      const instances = redactor.detect(query);

      const emailInstances = instances.filter(i => i.type === PIIType.EMAIL);
      expect(emailInstances.length).toBeGreaterThan(0);
    });

    it("should detect email with special characters", () => {
      const query = "Email user+tag@example.com";
      const instances = redactor.detect(query);

      const emailInstances = instances.filter(i => i.type === PIIType.EMAIL);
      expect(emailInstances.length).toBeGreaterThan(0);
    });

    it("should detect mixed case email", () => {
      const query = "Email JOHN.DOE@EXAMPLE.COM";
      const instances = redactor.detect(query);

      const emailInstances = instances.filter(i => i.type === PIIType.EMAIL);
      expect(emailInstances.length).toBeGreaterThan(0);
    });
  });

  describe("PHONE Detection", () => {
    it("should detect phone number with dashes", () => {
      const query = "Call me at 555-123-4567";
      const instances = redactor.detect(query);

      const phoneInstances = instances.filter(i => i.type === PIIType.PHONE);
      expect(phoneInstances.length).toBeGreaterThan(0);
    });

    it("should detect phone number with parentheses", () => {
      const query = "Call (555) 123-4567 for help";
      const instances = redactor.detect(query);

      const phoneInstances = instances.filter(i => i.type === PIIType.PHONE);
      expect(phoneInstances.length).toBeGreaterThan(0);
    });

    it("should detect phone number with spaces", () => {
      const query = "Call 555 123 4567";
      const instances = redactor.detect(query);

      const phoneInstances = instances.filter(i => i.type === PIIType.PHONE);
      expect(phoneInstances.length).toBeGreaterThan(0);
    });

    it("should detect international phone number", () => {
      const query = "Call +1-555-123-4567";
      const instances = redactor.detect(query);

      const phoneInstances = instances.filter(i => i.type === PIIType.PHONE);
      expect(phoneInstances.length).toBeGreaterThan(0);
    });

    it("should detect 10-digit phone", () => {
      const query = "5551234567 is my number";
      const instances = redactor.detect(query);

      const phoneInstances = instances.filter(i => i.type === PIIType.PHONE);
      expect(phoneInstances.length).toBeGreaterThan(0);
    });
  });

  describe("SSN Detection", () => {
    it("should detect SSN with dashes", () => {
      const query = "My SSN is 123-45-6789";
      const instances = redactor.detect(query);

      const ssnInstances = instances.filter(i => i.type === PIIType.SSN);
      expect(ssnInstances.length).toBeGreaterThan(0);
      expect(ssnInstances[0].value).toBe("123-45-6789");
    });

    it("should detect SSN with spaces", () => {
      const query = "SSN: 123 45 6789";
      const instances = redactor.detect(query);

      const ssnInstances = instances.filter(i => i.type === PIIType.SSN);
      expect(ssnInstances.length).toBeGreaterThan(0);
    });

    it("should detect 9-digit SSN without separators", () => {
      const query = "123456789";
      const instances = redactor.detect(query);

      const ssnInstances = instances.filter(i => i.type === PIIType.SSN);
      expect(ssnInstances.length).toBeGreaterThan(0);
    });

    it("should assign high confidence to SSN", () => {
      const query = "My social security number is 123-45-6789";
      const instances = redactor.detect(query);

      const ssnInstance = instances.find(i => i.type === PIIType.SSN);
      expect(ssnInstance).toBeDefined();
      expect(ssnInstance!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("CREDIT_CARD Detection", () => {
    it("should detect Visa card number", () => {
      const query = "Charge it to 4111-1111-1111-1111";
      const instances = redactor.detect(query);

      const ccInstances = instances.filter(i => i.type === PIIType.CREDIT_CARD);
      expect(ccInstances.length).toBeGreaterThan(0);
    });

    it("should detect MasterCard number", () => {
      const query = "Card: 5111-1111-1111-1111";
      const instances = redactor.detect(query);

      const ccInstances = instances.filter(i => i.type === PIIType.CREDIT_CARD);
      expect(ccInstances.length).toBeGreaterThan(0);
    });

    it("should detect Amex card number", () => {
      const query = "Pay with 3782-822463-10005";
      const instances = redactor.detect(query);

      const ccInstances = instances.filter(i => i.type === PIIType.CREDIT_CARD);
      expect(ccInstances.length).toBeGreaterThan(0);
    });

    it("should detect card without separators", () => {
      const query = "4111111111111111";
      const instances = redactor.detect(query);

      const ccInstances = instances.filter(i => i.type === PIIType.CREDIT_CARD);
      expect(ccInstances.length).toBeGreaterThan(0);
    });

    it("should assign high confidence to credit card", () => {
      const query = "My credit card is 4111-1111-1111-1111";
      const instances = redactor.detect(query);

      const ccInstance = instances.find(i => i.type === PIIType.CREDIT_CARD);
      expect(ccInstance).toBeDefined();
      expect(ccInstance!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("IP_ADDRESS Detection", () => {
    it("should detect IPv4 address", () => {
      const query = "Connect to 192.168.1.1";
      const instances = redactor.detect(query);

      const ipInstances = instances.filter(i => i.type === PIIType.IP_ADDRESS);
      expect(ipInstances.length).toBeGreaterThan(0);
    });

    it("should detect local IP address", () => {
      const query = "Server IP: 10.0.0.1";
      const instances = redactor.detect(query);

      const ipInstances = instances.filter(i => i.type === PIIType.IP_ADDRESS);
      expect(ipInstances.length).toBeGreaterThan(0);
    });

    it("should detect IP with leading zeros", () => {
      const query = "IP: 192.168.001.001";
      const instances = redactor.detect(query);

      const ipInstances = instances.filter(i => i.type === PIIType.IP_ADDRESS);
      expect(ipInstances.length).toBeGreaterThan(0);
    });

    it("should not detect invalid IP", () => {
      const query = "This is not an IP 256.256.256.256";
      const instances = redactor.detect(query);

      const ipInstances = instances.filter(i => i.type === PIIType.IP_ADDRESS);
      expect(ipInstances.length).toBe(0);
    });
  });

  describe("ADDRESS Detection", () => {
    it("should detect street address with ZIP", () => {
      const query = "Ship to 123 Main St, Springfield, IL 62701";
      const instances = redactor.detect(query);

      const addrInstances = instances.filter(i => i.type === PIIType.ADDRESS);
      expect(addrInstances.length).toBeGreaterThan(0);
    });

    it("should detect address without comma", () => {
      const query = "123 Main St Springfield IL 62701";
      const instances = redactor.detect(query);

      const addrInstances = instances.filter(i => i.type === PIIType.ADDRESS);
      expect(addrInstances.length).toBeGreaterThan(0);
    });

    it("should detect multi-word street name", () => {
      const query = "123 Main Street Drive, Springfield, IL 62701";
      const instances = redactor.detect(query);

      const addrInstances = instances.filter(i => i.type === PIIType.ADDRESS);
      expect(addrInstances.length).toBeGreaterThan(0);
    });
  });

  describe("NAME Detection", () => {
    it("should detect two-word name", () => {
      const query = "John Smith submitted the request";
      const instances = redactor.detect(query);

      const nameInstances = instances.filter(i => i.type === PIIType.NAME);
      expect(nameInstances.length).toBeGreaterThan(0);
    });

    it("should detect three-word name", () => {
      const query = "John A. Smith is here";
      const instances = redactor.detect(query);

      const nameInstances = instances.filter(i => i.type === PIIType.NAME);
      expect(nameInstances.length).toBeGreaterThan(0);
    });

    it("should not detect lowercase words as names", () => {
      const query = "the quick brown fox";
      const instances = redactor.detect(query);

      const nameInstances = instances.filter(i => i.type === PIIType.NAME);
      expect(nameInstances.length).toBe(0);
    });
  });

  describe("DATE_OF_BIRTH Detection", () => {
    it("should detect DOB with label", () => {
      const query = "DOB: 01/15/1980";
      const instances = redactor.detect(query);

      const dobInstances = instances.filter(
        i => i.type === PIIType.DATE_OF_BIRTH
      );
      expect(dobInstances.length).toBeGreaterThan(0);
    });

    it("should detect date of birth phrase", () => {
      const query = "date of birth: 1980-01-15";
      const instances = redactor.detect(query);

      const dobInstances = instances.filter(
        i => i.type === PIIType.DATE_OF_BIRTH
      );
      expect(dobInstances.length).toBeGreaterThan(0);
    });

    it("should detect birth date phrase", () => {
      const query = "birth date = 01-15-1980";
      const instances = redactor.detect(query);

      const dobInstances = instances.filter(
        i => i.type === PIIType.DATE_OF_BIRTH
      );
      expect(dobInstances.length).toBeGreaterThan(0);
    });

    it("should assign high confidence to DOB", () => {
      const query = "My date of birth is 01/15/1980";
      const instances = redactor.detect(query);

      const dobInstance = instances.find(i => i.type === PIIType.DATE_OF_BIRTH);
      expect(dobInstance).toBeDefined();
      expect(dobInstance!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("PASSPORT Detection", () => {
    it("should detect passport with label", () => {
      const query = "Passport number is AB1234567";
      const instances = redactor.detect(query);

      const passportInstances = instances.filter(
        i => i.type === PIIType.PASSPORT
      );
      expect(passportInstances.length).toBeGreaterThan(0);
    });

    it("should detect passport abbreviation", () => {
      const query = "Passport # US1234567";
      const instances = redactor.detect(query);

      const passportInstances = instances.filter(
        i => i.type === PIIType.PASSPORT
      );
      expect(passportInstances.length).toBeGreaterThan(0);
    });

    it("should assign high confidence to passport", () => {
      const query = "My passport number is AB1234567";
      const instances = redactor.detect(query);

      const passportInstance = instances.find(i => i.type === PIIType.PASSPORT);
      expect(passportInstance).toBeDefined();
      expect(passportInstance!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("DRIVERS_LICENSE Detection", () => {
    it("should detect drivers license phrase", () => {
      const query = "Driver license: DL12345678";
      const instances = redactor.detect(query);

      const dlInstances = instances.filter(
        i => i.type === PIIType.DRIVERS_LICENSE
      );
      expect(dlInstances.length).toBeGreaterThan(0);
    });

    it("should detect DL abbreviation", () => {
      const query = "DL# 12345678";
      const instances = redactor.detect(query);

      const dlInstances = instances.filter(
        i => i.type === PIIType.DRIVERS_LICENSE
      );
      expect(dlInstances.length).toBeGreaterThan(0);
    });

    it("should assign high confidence to drivers license", () => {
      const query = "My driver license is DL12345678";
      const instances = redactor.detect(query);

      const dlInstance = instances.find(
        i => i.type === PIIType.DRIVERS_LICENSE
      );
      expect(dlInstance).toBeDefined();
      expect(dlInstance!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("BANK_ACCOUNT Detection", () => {
    it("should detect account with label", () => {
      const query = "Account# 123456789";
      const instances = redactor.detect(query);

      const baInstances = instances.filter(
        i => i.type === PIIType.BANK_ACCOUNT
      );
      expect(baInstances.length).toBeGreaterThan(0);
    });

    it("should detect bank account phrase", () => {
      const query = "bank account number 1234567890123";
      const instances = redactor.detect(query);

      const baInstances = instances.filter(
        i => i.type === PIIType.BANK_ACCOUNT
      );
      expect(baInstances.length).toBeGreaterThan(0);
    });
  });

  describe("MEDICAL_RECORD Detection", () => {
    it("should detect MRN abbreviation", () => {
      const query = "MRN: 12345678";
      const instances = redactor.detect(query);

      const mrInstances = instances.filter(
        i => i.type === PIIType.MEDICAL_RECORD
      );
      expect(mrInstances.length).toBeGreaterThan(0);
    });

    it("should detect medical record phrase", () => {
      const query = "Medical Record #12345678";
      const instances = redactor.detect(query);

      const mrInstances = instances.filter(
        i => i.type === PIIType.MEDICAL_RECORD
      );
      expect(mrInstances.length).toBeGreaterThan(0);
    });
  });

  describe("Multiple PII Detection", () => {
    it("should detect email and phone in same query", () => {
      const query = "Email me at john@example.com or call 555-123-4567";
      const instances = redactor.detect(query);

      const hasEmail = instances.some(i => i.type === PIIType.EMAIL);
      const hasPhone = instances.some(i => i.type === PIIType.PHONE);

      expect(hasEmail).toBe(true);
      expect(hasPhone).toBe(true);
    });

    it("should detect three different PII types", () => {
      const query =
        "Email john@example.com, call 555-123-4567, SSN 123-45-6789";
      const instances = redactor.detect(query);

      const types = new Set(instances.map(i => i.type));
      expect(types.size).toBeGreaterThanOrEqual(3);
    });

    it("should remove overlapping detections", () => {
      const query = "John Smith has SSN 123-45-6789";
      const instances = redactor.detect(query);

      // Check no overlapping instances
      for (let i = 0; i < instances.length; i++) {
        for (let j = i + 1; j < instances.length; j++) {
          const a = instances[i];
          const b = instances[j];

          // No overlap if one ends before the other starts
          const overlap = a.start < b.end && a.end > b.start;

          if (overlap) {
            // If overlap exists, higher confidence should win
            expect(a.confidence).not.toBe(b.confidence);
          }
        }
      }
    });

    it("should sort instances by position", () => {
      const query = "Call 555-123-4567 or email john@example.com";
      const instances = redactor.detect(query);

      for (let i = 1; i < instances.length; i++) {
        expect(instances[i].start).toBeGreaterThanOrEqual(
          instances[i - 1].start
        );
      }
    });
  });

  describe("Redaction - FULL Strategy", () => {
    it("should redact email with FULL strategy", () => {
      const query = "Email me at john@example.com";
      const result = redactor.redact(query, RedactionStrategy.FULL);

      expect(result.redacted).toContain("[REDACTED_EMAIL]");
      expect(result.redactionCount).toBe(1);
      expect(result.strategy).toBe(RedactionStrategy.FULL);
    });

    it("should redact multiple PII with FULL strategy", () => {
      const query = "Email john@example.com or call 555-123-4567";
      const result = redactor.redact(query, RedactionStrategy.FULL);

      expect(result.redacted).toContain("[REDACTED_EMAIL]");
      expect(result.redacted).toContain("[REDACTED_PHONE]");
      expect(result.redactionCount).toBeGreaterThanOrEqual(2);
    });

    it("should preserve non-PII text", () => {
      const query = "Please email john@example.com for help";
      const result = redactor.redact(query, RedactionStrategy.FULL);

      expect(result.redacted).toContain("Please");
      expect(result.redacted).toContain("for help");
    });
  });

  describe("Redaction - PARTIAL Strategy", () => {
    it("should partially mask email", () => {
      const query = "Email me at john@example.com";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      expect(result.redacted).toContain("@example.com");
      expect(result.redacted).toMatch(/j\*{3,}@example\.com/);
    });

    it("should partially mask phone", () => {
      const query = "Call me at 555-123-4567";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      // Last 4 digits should be visible
      expect(result.redacted).toContain("4567");
      // Earlier digits should be masked
      expect(result.redacted).toMatch(/\*+/);
    });

    it("should partially mask SSN", () => {
      const query = "My SSN is 123-45-6789";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      // Last 4 digits visible, rest masked
      expect(result.redacted).toContain("6789");
      expect(result.redacted).toContain("***");
    });

    it("should partially mask credit card", () => {
      const query = "Card: 4111-1111-1111-1111";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      // First and last groups visible, middle masked
      expect(result.redacted).toContain("4111");
      expect(result.redacted).toContain("1111");
      expect(result.redacted).toContain("****");
    });

    it("should partially mask IP address", () => {
      const query = "Connect to 192.168.1.1";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      // First and last octets visible
      expect(result.redacted).toContain("192");
      expect(result.redacted).toContain("1");
    });
  });

  describe("Redaction - TOKEN Strategy", () => {
    it("should replace PII with token", () => {
      const query = "Email john@example.com";
      const result = redactor.redact(query, RedactionStrategy.TOKEN);

      expect(result.redacted).toMatch(/\[EMAIL:pii_\d+_\d+\]/);
    });

    it("should include unique ID in token", () => {
      const query = "Email john@example.com or jane@example.org";
      const result = redactor.redact(query, RedactionStrategy.TOKEN);

      const tokens = result.redacted.match(/\[EMAIL:pii_\d+_\d+\]/g);
      expect(tokens).toBeDefined();
      expect(tokens!.length).toBeGreaterThanOrEqual(2);

      // IDs should be unique
      const ids = tokens!.map(t => t.match(/pii_\d+_\d+/)![0]);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("Restore/Roundtrip", () => {
    it("should restore email after redaction", () => {
      const query = "Email john@example.com";
      const redacted = redactor.redact(query, RedactionStrategy.FULL);

      const restored = redactor.restore(
        redacted.redacted,
        redacted.piiInstances,
        RedactionStrategy.FULL
      );

      expect(restored).toBe(query);
    });

    it("should restore multiple PII", () => {
      const query = "Email john@example.com or call 555-123-4567";
      const redacted = redactor.redact(query, RedactionStrategy.FULL);

      const restored = redactor.restore(
        redacted.redacted,
        redacted.piiInstances,
        RedactionStrategy.FULL
      );

      expect(restored).toBe(query);
    });

    it("should handle roundtrip with TOKEN strategy", () => {
      const query = "Email john@example.com";
      const redacted = redactor.redact(query, RedactionStrategy.TOKEN);

      const restored = redactor.restore(
        redacted.redacted,
        redacted.piiInstances,
        RedactionStrategy.TOKEN
      );

      expect(restored).toBe(query);
    });

    it("should return original if no PII to restore", () => {
      const query = "No PII here";
      const restored = redactor.restore(query, []);

      expect(restored).toBe(query);
    });

    it("should handle empty metadata", () => {
      const query = "Some text";
      const restored = redactor.restore(query, undefined as any);

      expect(restored).toBe(query);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query", () => {
      const instances = redactor.detect("");
      expect(instances).toHaveLength(0);
    });

    it("should handle whitespace-only query", () => {
      const instances = redactor.detect("   ");
      expect(instances).toHaveLength(0);
    });

    it("should handle query with no PII", () => {
      const query = "What is the capital of France?";
      const instances = redactor.detect(query);

      expect(instances.length).toBe(0);
    });

    it("should handle very long query", () => {
      const longQuery = "Email john@example.com ".repeat(1000);
      const instances = redactor.detect(longQuery);

      expect(instances.length).toBeGreaterThan(0);
    });

    it("should handle special characters", () => {
      const query = "Contact: john@example.com! #";
      const instances = redactor.detect(query);

      expect(instances.some(i => i.type === PIIType.EMAIL)).toBe(true);
    });

    it("should handle unicode characters", () => {
      const query = "Email john@example.com for 在中文 help";
      const instances = redactor.detect(query);

      expect(instances.some(i => i.type === PIIType.EMAIL)).toBe(true);
    });

    it("should handle malformed PII patterns", () => {
      const query = "Not a real email: @example.com";
      const instances = redactor.detect(query);

      // Should not detect partial email as valid
      expect(instances.filter(i => i.type === PIIType.EMAIL).length).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should use custom placeholder format", () => {
      const customRedactor = new SemanticPIIRedactor({
        placeholderFormat: "***{type}***",
      });

      const query = "Email john@example.com";
      const result = customRedactor.redact(query, RedactionStrategy.FULL);

      expect(result.redacted).toContain("***EMAIL***");
    });

    it("should respect confidence threshold", () => {
      const customRedactor = new SemanticPIIRedactor({
        confidenceThreshold: 0.95,
      });

      const query = "Email john@example.com";
      const instances = customRedactor.detect(query);

      // All instances should have confidence >= 0.95
      instances.forEach(instance => {
        expect(instance.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });

    it("should allow custom patterns", () => {
      const customRedactor = new SemanticPIIRedactor({
        customPatterns: {
          [PIIType.EMAIL]: [/\btest@example\.com\b/gi],
        },
      });

      const query = "test@example.com";
      const instances = customRedactor.detect(query);

      expect(
        instances.filter(i => i.type === PIIType.EMAIL).length
      ).toBeGreaterThan(0);
    });

    it("should add custom patterns dynamically", () => {
      redactor.addPattern(PIIType.PHONE, /\b\d{10}\b/g);

      const query = "Call 5551234567";
      const instances = redactor.detect(query);

      expect(
        instances.filter(i => i.type === PIIType.PHONE).length
      ).toBeGreaterThan(0);
    });

    it("should update configuration", () => {
      redactor.updateConfig({
        confidenceThreshold: 0.99,
      });

      const config = redactor.getConfig();
      expect(config.confidenceThreshold).toBe(0.99);
    });

    it("should retrieve current configuration", () => {
      const config = redactor.getConfig();

      expect(config).toHaveProperty("defaultStrategy");
      expect(config).toHaveProperty("confidenceThreshold");
      expect(config).toHaveProperty("useContextAwareDetection");
      expect(config).toHaveProperty("placeholderFormat");
    });
  });

  describe("Context-Aware Detection", () => {
    it("should increase confidence with context", () => {
      const queryWithContext = "Email me at john@example.com";
      const queryWithoutContext = "john@example.com";

      const instancesWithContext = redactor.detect(queryWithContext);
      const instancesWithoutContext = redactor.detect(queryWithoutContext);

      const withContext = instancesWithContext.find(
        i => i.type === PIIType.EMAIL
      );
      const withoutContext = instancesWithoutContext.find(
        i => i.type === PIIType.EMAIL
      );

      if (withContext && withoutContext) {
        expect(withContext.confidence).toBeGreaterThan(
          withoutContext.confidence
        );
      }
    });

    it("should disable context-aware detection", () => {
      const customRedactor = new SemanticPIIRedactor({
        useContextAwareDetection: false,
      });

      const query = "john@example.com";
      const instances = customRedactor.detect(query);

      // Confidence should be default without context analysis (0.75)
      instances.forEach(instance => {
        expect(instance.confidence).toBe(0.75);
      });
    });
  });

  describe("PIIInstance Properties", () => {
    it("should include all required properties", () => {
      const query = "Email john@example.com";
      const instances = redactor.detect(query);

      const instance = instances[0];

      expect(instance).toHaveProperty("type");
      expect(instance).toHaveProperty("start");
      expect(instance).toHaveProperty("end");
      expect(instance).toHaveProperty("value");
      expect(instance).toHaveProperty("confidence");
      expect(instance).toHaveProperty("id");

      expect(instance.start).toBeLessThan(instance.end);
      expect(instance.confidence).toBeGreaterThan(0);
      expect(instance.confidence).toBeLessThanOrEqual(1);
      expect(instance.id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs for each instance", () => {
      const query = "Email john@example.com or jane@example.org";
      const instances = redactor.detect(query);

      const ids = instances.map(i => i.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("RedactedQuery Properties", () => {
    it("should include all required properties", () => {
      const query = "Email john@example.com";
      const result = redactor.redact(query);

      expect(result).toHaveProperty("redacted");
      expect(result).toHaveProperty("piiInstances");
      expect(result).toHaveProperty("redactionCount");
      expect(result).toHaveProperty("strategy");

      expect(Array.isArray(result.piiInstances)).toBe(true);
      expect(typeof result.redactionCount).toBe("number");
    });

    it("should report zero redactions for clean query", () => {
      const query = "No PII here";
      const result = redactor.redact(query);

      expect(result.redacted).toBe(query);
      expect(result.redactionCount).toBe(0);
      expect(result.piiInstances).toHaveLength(0);
    });
  });

  describe("Integration with PrivacyClassifier", () => {
    it("should work with detected PII from classifier", () => {
      // Simulate classifier-detected PII
      const query = "Send report to john@example.com";
      const instances = redactor.detect(query);

      expect(instances.length).toBeGreaterThan(0);

      // Redact based on detected PII
      const result = redactor.redact(query);
      expect(result.redactionCount).toBeGreaterThan(0);
    });
  });
});
