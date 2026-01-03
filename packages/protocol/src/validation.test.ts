/**
 * Protocol Validation System Tests
 *
 * Comprehensive tests for ProtocolValidator including:
 * - ATPacket validation
 * - ACPHandshake validation
 * - Required field validation
 * - Type validation
 * - Enum validation
 * - Range validation
 * - Timestamp validation
 * - Array validation
 * - Multiple error reporting
 */

import { describe, it, expect } from "vitest";
import {
  ProtocolValidator,
  ValidationErrorCode,
  createValidationResult,
  formatValidationErrors,
} from "./validation.js";
import {
  ATPacket,
  IntentCategory,
  Urgency,
  CollaborationMode,
} from "./atp-acp.js";
import type { ACPHandshakeRequest } from "./handshake.js";

describe("ProtocolValidator", () => {
  describe("ATPacket Validation", () => {
    const validator = new ProtocolValidator();

    it("should validate a correct ATPacket", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is the capital of France?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should reject packet with missing required field", () => {
      const packet = {
        id: "req-123",
        query: "What is AI?",
        // missing: intent
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("intent");
      expect(result.errors[0].code).toBe(
        ValidationErrorCode.REQUIRED_FIELD_MISSING
      );
    });

    it("should reject packet with wrong type for id", () => {
      const packet = {
        id: 123, // should be string
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "id")).toBe(true);
      expect(
        result.errors.some(e => e.code === ValidationErrorCode.INVALID_TYPE)
      ).toBe(true);
    });

    it("should reject packet with empty id", () => {
      const packet: ATPacket = {
        id: "   ", // whitespace only
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "id")).toBe(true);
    });

    it("should reject packet with empty query", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e => e.field === "query" && e.message.includes("empty")
        )
      ).toBe(true);
    });

    it("should reject packet with query too long", () => {
      const longQuery = "x".repeat(10001);
      const packet: ATPacket = {
        id: "req-123",
        query: longQuery,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "query" &&
            e.code === ValidationErrorCode.STRING_TOO_LONG
        )
      ).toBe(true);
    });

    it("should reject packet with invalid intent enum", () => {
      const packet = {
        id: "req-123",
        query: "What is AI?",
        intent: "invalid_intent",
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "intent" &&
            e.code === ValidationErrorCode.INVALID_ENUM_VALUE
        )
      ).toBe(true);
    });

    it("should reject packet with invalid urgency enum", () => {
      const packet = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: "invalid_urgency",
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "urgency" &&
            e.code === ValidationErrorCode.INVALID_ENUM_VALUE
        )
      ).toBe(true);
    });

    it("should reject packet with timestamp in the future", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now() + 100000, // 100 seconds in future
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "timestamp" &&
            e.code === ValidationErrorCode.INVALID_TIMESTAMP
        )
      ).toBe(true);
    });

    it("should reject packet with timestamp too old", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now() - 61 * 60 * 1000, // 61 minutes ago (default max is 1 hour)
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e => e.field === "timestamp" && e.message.includes("too old")
        )
      ).toBe(true);
    });

    it("should reject packet with non-numeric timestamp", () => {
      const packet = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: "not-a-number",
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "timestamp" &&
            e.code === ValidationErrorCode.NOT_A_NUMBER
        )
      ).toBe(true);
    });

    it("should reject packet with NaN timestamp", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: NaN,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "timestamp")).toBe(true);
    });

    it("should accept valid context object", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: { userId: "user-456", sessionId: "session-789" },
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(true);
    });

    it("should reject invalid context type (array)", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: ["invalid"] as any,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "context")).toBe(true);
    });

    it("should warn for large context", () => {
      const largeContext: Record<string, string> = {};
      for (let i = 0; i < 101; i++) {
        largeContext[`key${i}`] = `value${i}`;
      }

      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: largeContext,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(
          w => w.field === "context" && w.code === "LARGE_CONTEXT"
        )
      ).toBe(true);
    });

    it("should report multiple errors", () => {
      const packet = {
        id: 123,
        query: "",
        intent: "invalid",
        urgency: "invalid",
        timestamp: "invalid",
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });

    it("should reject non-object packet", () => {
      const result = validator.validateATPacket(null);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("packet");
    });

    it("should reject array packet", () => {
      const result = validator.validateATPacket([] as any);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("packet");
    });
  });

  describe("ACPHandshake Validation", () => {
    const validator = new ProtocolValidator();

    it("should validate a correct ACPHandshakeRequest", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a secure authentication system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4", "codellama", "mistral"],
        preferences: {
          maxLatency: 2000,
          maxCost: 0.05,
          minQuality: 0.8,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject request with missing id", () => {
      const request = {
        // missing: id
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {},
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "id" &&
            e.code === ValidationErrorCode.REQUIRED_FIELD_MISSING
        )
      ).toBe(true);
    });

    it("should reject request with empty models array", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: [], // empty
        preferences: {},
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "models" &&
            e.code === ValidationErrorCode.INVALID_ARRAY_LENGTH
        )
      ).toBe(true);
    });

    it("should reject request with too many models", () => {
      const manyModels = Array(101).fill("gpt-4");
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.PARALLEL,
        models: manyModels,
        preferences: {},
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "models" &&
            e.code === ValidationErrorCode.INVALID_ARRAY_LENGTH
        )
      ).toBe(true);
    });

    it("should reject request with invalid model name (empty string)", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4", "", "mistral"],
        preferences: {},
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "models[1]")).toBe(true);
    });

    it("should reject request with invalid collaboration mode", () => {
      const request = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: "invalid_mode",
        models: ["gpt-4"],
        preferences: {},
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "collaborationMode" &&
            e.code === ValidationErrorCode.INVALID_ENUM_VALUE
        )
      ).toBe(true);
    });

    it("should reject request with negative maxLatency", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          maxLatency: -100,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "preferences.maxLatency" &&
            e.code === ValidationErrorCode.VALUE_OUT_OF_RANGE
        )
      ).toBe(true);
    });

    it("should reject request with negative maxCost", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          maxCost: -0.01,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "preferences.maxCost" &&
            e.code === ValidationErrorCode.VALUE_OUT_OF_RANGE
        )
      ).toBe(true);
    });

    it("should reject request with minQuality > 1", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          minQuality: 1.5,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "preferences.minQuality" &&
            e.code === ValidationErrorCode.VALUE_OUT_OF_RANGE
        )
      ).toBe(true);
    });

    it("should reject request with minQuality < 0", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          minQuality: -0.1,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.field === "preferences.minQuality")
      ).toBe(true);
    });

    it("should reject request with invalid priority", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          priority: "invalid_priority" as any,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "preferences.priority" &&
            e.code === ValidationErrorCode.INVALID_ENUM_VALUE
        )
      ).toBe(true);
    });

    it("should reject request with invalid preferences type", () => {
      const request = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: ["invalid"], // should be object
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "preferences")).toBe(true);
    });

    it("should accept valid priority", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          priority: Urgency.HIGH,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(true);
    });

    it("should reject request with NaN maxLatency", () => {
      const request: ACPHandshakeRequest = {
        id: "acp-123",
        query: "Design a system",
        intent: IntentCategory.CODE_GENERATION,
        collaborationMode: CollaborationMode.CASCADE,
        models: ["gpt-4"],
        preferences: {
          maxLatency: NaN,
        },
        timestamp: Date.now(),
      };

      const result = validator.validateACPHandshake(request);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "preferences.maxLatency" &&
            e.code === ValidationErrorCode.NOT_A_NUMBER
        )
      ).toBe(true);
    });
  });

  describe("Validation Options", () => {
    it("should respect allowFutureTimestamps option", () => {
      const validator = new ProtocolValidator({ allowFutureTimestamps: true });
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now() + 100000,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(true);
    });

    it("should respect maxTimestampAge option", () => {
      const validator = new ProtocolValidator({ maxTimestampAge: 2000 }); // 2 seconds
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now() - 3000, // 3 seconds ago
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e => e.field === "timestamp" && e.message.includes("too old")
        )
      ).toBe(true);
    });

    it("should respect maxStringLength option", () => {
      const validator = new ProtocolValidator({ maxStringLength: 100 });
      const packet: ATPacket = {
        id: "req-123",
        query: "x".repeat(101),
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e =>
            e.field === "query" &&
            e.code === ValidationErrorCode.STRING_TOO_LONG
        )
      ).toBe(true);
    });

    it("should allow updating options after construction", () => {
      const validator = new ProtocolValidator();

      // First validation should fail with default options
      const packet1: ATPacket = {
        id: "req-123",
        query: "x".repeat(10001),
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      let result = validator.validateATPacket(packet1);
      expect(result.valid).toBe(false);

      // Update options
      validator.setOptions({ maxStringLength: 20000 });

      // Same packet should now pass
      result = validator.validateATPacket(packet1);
      expect(result.valid).toBe(true);
    });

    it("should get current options", () => {
      const validator = new ProtocolValidator({ maxStringLength: 5000 });
      const options = validator.getOptions();

      expect(options.maxStringLength).toBe(5000);
    });
  });

  describe("Helper Functions", () => {
    it("should create validation result with errors", () => {
      const result = createValidationResult([
        {
          field: "test",
          message: "Test error",
          code: ValidationErrorCode.INVALID_TYPE,
        },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it("should create validation result with warnings", () => {
      const result = createValidationResult(
        [],
        [
          {
            field: "test",
            message: "Test warning",
            code: "TEST_WARNING",
          },
        ]
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("should format validation errors correctly", () => {
      const result = createValidationResult(
        [
          {
            field: "id",
            message: "ID is required",
            code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
          },
          {
            field: "timestamp",
            message: "Invalid timestamp",
            code: ValidationErrorCode.INVALID_TIMESTAMP,
          },
        ],
        [
          {
            field: "context",
            message: "Large context",
            code: "LARGE_CONTEXT",
          },
        ]
      );

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain("ID is required");
      expect(formatted).toContain("Invalid timestamp");
      expect(formatted).toContain("Large context");
      expect(formatted).toContain("2 error(s)");
    });

    it('should format valid result as "Validation passed"', () => {
      const result = createValidationResult([]);
      const formatted = formatValidationErrors(result);

      expect(formatted).toBe("Validation passed");
    });
  });

  describe("Edge Cases", () => {
    const validator = new ProtocolValidator();

    it("should handle whitespace-only id", () => {
      const packet: ATPacket = {
        id: "\t\n  ",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "id")).toBe(true);
    });

    it("should handle zero timestamp", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: 0,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e => e.field === "timestamp" && e.message.includes("too old")
        )
      ).toBe(true);
    });

    it("should handle negative timestamp", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: -1000,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "timestamp")).toBe(true);
    });

    it("should handle undefined optional context", () => {
      const packet: ATPacket = {
        id: "req-123",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: undefined,
      };

      const result = validator.validateATPacket(packet);

      expect(result.valid).toBe(true);
    });

    it("should handle all collaboration modes", () => {
      const modes = [
        CollaborationMode.SEQUENTIAL,
        CollaborationMode.PARALLEL,
        CollaborationMode.CASCADE,
        CollaborationMode.ENSEMBLE,
      ];

      modes.forEach(mode => {
        const request: ACPHandshakeRequest = {
          id: "acp-123",
          query: "Design a system",
          intent: IntentCategory.CODE_GENERATION,
          collaborationMode: mode,
          models: ["gpt-4"],
          preferences: {},
          timestamp: Date.now(),
        };

        const result = validator.validateACPHandshake(request);
        expect(result.valid).toBe(true);
      });
    });

    it("should handle all intent categories", () => {
      const intents = [
        IntentCategory.QUERY,
        IntentCategory.COMMAND,
        IntentCategory.CONVERSATION,
        IntentCategory.CODE_GENERATION,
        IntentCategory.ANALYSIS,
        IntentCategory.CREATIVE,
        IntentCategory.DEBUGGING,
        IntentCategory.SYSTEM,
        IntentCategory.UNKNOWN,
      ];

      intents.forEach(intent => {
        const packet: ATPacket = {
          id: "req-123",
          query: "Test query",
          intent,
          urgency: Urgency.NORMAL,
          timestamp: Date.now(),
        };

        const result = validator.validateATPacket(packet);
        expect(result.valid).toBe(true);
      });
    });

    it("should handle all urgency levels", () => {
      const urgencies = [
        Urgency.LOW,
        Urgency.NORMAL,
        Urgency.HIGH,
        Urgency.CRITICAL,
      ];

      urgencies.forEach(urgency => {
        const packet: ATPacket = {
          id: "req-123",
          query: "Test query",
          intent: IntentCategory.QUERY,
          urgency,
          timestamp: Date.now(),
        };

        const result = validator.validateATPacket(packet);
        expect(result.valid).toBe(true);
      });
    });
  });
});
