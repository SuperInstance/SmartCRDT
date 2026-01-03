/**
 * Protocol Compliance Testing Suite Tests
 *
 * Comprehensive tests for the protocol compliance checker and test runner.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ProtocolComplianceChecker,
  ComplianceTestRunner,
  type ProtocolSpecification,
  type TypeSpecification,
  type MessageSpecification,
  type BehaviorSpecification,
  type ConstraintSpecification,
  type SemVer,
  type ExecutionContext,
  parseSemVer,
  formatSemVer,
  compareSemVer,
  buildTypeTest,
  buildMessageTest,
  buildBehaviorTest,
  buildConstraintTest,
} from "./compliance.js";

// ============================================================================
// FIXTURES
// ============================================================================

/** Sample ATP protocol specification for testing */
const ATP_SPECIFICATION: ProtocolSpecification = {
  name: "ATP",
  version: { major: 1, minor: 0, patch: 0 },
  types: [
    {
      name: "ATPacket",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          id: { type: "string", optional: false, readonly: false },
          query: { type: "string", optional: false, readonly: false },
          intent: { type: "string", optional: false, readonly: false },
          urgency: { type: "string", optional: false, readonly: false },
          timestamp: { type: "number", optional: false, readonly: false },
          context: { type: "object", optional: true, readonly: false },
        },
      },
      required_properties: ["id", "query", "intent", "urgency", "timestamp"],
      optional_properties: ["context"],
    },
    {
      name: "IntentCategory",
      type: "enum",
      definition: {
        kind: "enum",
        values: {
          QUERY: "query",
          COMMAND: "command",
          CONVERSATION: "conversation",
        },
      },
      required_properties: [],
      optional_properties: [],
    },
    {
      name: "Urgency",
      type: "enum",
      definition: {
        kind: "enum",
        values: {
          LOW: "low",
          NORMAL: "normal",
          HIGH: "high",
          CRITICAL: "critical",
        },
      },
      required_properties: [],
      optional_properties: [],
    },
  ],
  messages: [
    {
      name: "ATPRequest",
      direction: "request",
      request_type: "ATPacket",
      response_type: "AequorResponse",
      flow_control: {
        streaming: false,
        timeout: 30000,
        retry_policy: {
          max_attempts: 3,
          backoff: "exponential",
          initial_delay: 1000,
          max_delay: 10000,
        },
      },
      error_handling: {
        retryable_errors: ["timeout", "rate_limited"],
        non_retryable_errors: ["invalid_packet", "access_denied"],
      },
    },
  ],
  behaviors: [
    {
      name: "validate_packet",
      description: "Validate ATP packet before processing",
      preconditions: [
        {
          description: "Packet must be an object",
          check: (ctx: ExecutionContext) =>
            typeof ctx.parameters.packet === "object",
        },
        {
          description: "Packet must have id",
          check: (ctx: ExecutionContext) =>
            typeof (ctx.parameters.packet as Record<string, unknown>).id ===
            "string",
        },
      ],
      postconditions: [
        {
          description: "Result must be valid",
          check: (ctx: ExecutionContext) => ctx.result === true,
        },
      ],
      invariants: [
        {
          description: "Validation is deterministic",
          check: () => true, // Simplified invariant
        },
      ],
    },
  ],
  constraints: [
    {
      name: "max_packet_size",
      type: "custom",
      rule: {
        check: (ctx: ExecutionContext) => {
          const size = JSON.stringify(ctx.parameters).length;
          return size < 10000;
        },
        violation_message: "Packet exceeds maximum size",
      },
      severity: "error",
    },
  ],
};

/** Sample ACP protocol specification for testing */
const ACP_SPECIFICATION: ProtocolSpecification = {
  name: "ACP",
  version: { major: 1, minor: 0, patch: 0 },
  types: [
    {
      name: "ACPHandshakeRequest",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          id: { type: "string", optional: false, readonly: false },
          query: { type: "string", optional: false, readonly: false },
          intent: { type: "string", optional: false, readonly: false },
          collaborationMode: {
            type: "string",
            optional: false,
            readonly: false,
          },
          models: { type: "array", optional: false, readonly: false },
          preferences: { type: "object", optional: false, readonly: false },
          timestamp: { type: "number", optional: false, readonly: false },
        },
      },
      required_properties: [
        "id",
        "query",
        "intent",
        "collaborationMode",
        "models",
        "preferences",
        "timestamp",
      ],
      optional_properties: [],
    },
  ],
  messages: [],
  behaviors: [],
  constraints: [],
};

// ============================================================================
// SEMVER TESTS
// ============================================================================

describe("SemVer", () => {
  describe("parseSemVer", () => {
    it("should parse basic version", () => {
      const version = parseSemVer("1.2.3");
      expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it("should parse version with prerelease", () => {
      const version = parseSemVer("1.2.3-alpha.1");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      });
    });

    it("should parse version with build metadata", () => {
      const version = parseSemVer("1.2.3+build.123");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        build: "build.123",
      });
    });

    it("should parse version with prerelease and build", () => {
      const version = parseSemVer("1.2.3-alpha.1+build.123");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
        build: "build.123",
      });
    });

    it("should throw on invalid version", () => {
      expect(() => parseSemVer("invalid")).toThrow("Invalid SemVer string");
    });

    it("should throw on incomplete version", () => {
      expect(() => parseSemVer("1.2")).toThrow("Invalid SemVer string");
    });
  });

  describe("formatSemVer", () => {
    it("should format basic version", () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      expect(formatSemVer(version)).toBe("1.2.3");
    });

    it("should format version with prerelease", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      };
      expect(formatSemVer(version)).toBe("1.2.3-alpha.1");
    });

    it("should format version with build", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        build: "build.123",
      };
      expect(formatSemVer(version)).toBe("1.2.3+build.123");
    });

    it("should format version with prerelease and build", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
        build: "build.123",
      };
      expect(formatSemVer(version)).toBe("1.2.3-alpha.1+build.123");
    });
  });

  describe("compareSemVer", () => {
    it("should return negative for older version", () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 2, minor: 0, patch: 0 };
      expect(compareSemVer(a, b)).toBeLessThan(0);
    });

    it("should return positive for newer version", () => {
      const a: SemVer = { major: 2, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 2, patch: 3 };
      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });

    it("should return zero for equal versions", () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 3 };
      expect(compareSemVer(a, b)).toBe(0);
    });

    it("should compare minor versions", () => {
      const a: SemVer = { major: 1, minor: 2, patch: 0 };
      const b: SemVer = { major: 1, minor: 3, patch: 0 };
      expect(compareSemVer(a, b)).toBeLessThan(0);
    });

    it("should compare patch versions", () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 4 };
      expect(compareSemVer(a, b)).toBeLessThan(0);
    });

    it("should consider release > prerelease", () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      };
      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });

    it("should compare prerelease versions lexicographically", () => {
      const a: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      };
      const b: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "beta.1",
      };
      expect(compareSemVer(a, b)).toBeLessThan(0);
    });
  });
});

// ============================================================================
// PROTOCOL COMPLIANCE CHECKER TESTS
// ============================================================================

describe("ProtocolComplianceChecker", () => {
  let checker: ProtocolComplianceChecker;

  beforeEach(() => {
    checker = new ProtocolComplianceChecker(ATP_SPECIFICATION);
  });

  describe("constructor", () => {
    it("should create checker with specification", () => {
      expect(checker).toBeDefined();
      expect(checker.getSpecification()).toEqual(ATP_SPECIFICATION);
    });
  });

  describe("verify_type_compliance", () => {
    it("should pass for compliant implementation", () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
          context: {},
        },
      };

      const result = checker.verify_type_compliance(impl);
      expect(result.is_compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should fail for missing required type", () => {
      const impl = {};

      const result = checker.verify_type_compliance(impl);
      expect(result.is_compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].message).toContain("Missing required type");
    });

    it("should detect type mismatch", () => {
      const impl = {
        ATPacket: "not an object",
      };

      const result = checker.verify_type_compliance(impl);
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("must be an object"))
      ).toBe(true);
    });

    it("should handle null implementation", () => {
      const result = checker.verify_type_compliance(null);
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an object");
    });

    it("should handle primitive implementation", () => {
      const result = checker.verify_type_compliance("string");
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an object");
    });

    it("should calculate coverage correctly", () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      };

      const result = checker.verify_type_compliance(impl);
      expect(result.coverage).toBeGreaterThan(0);
      expect(result.coverage).toBeLessThanOrEqual(100);
    });
  });

  describe("verify_interface_implementation", () => {
    it("should pass for complete interface implementation", () => {
      const impl = {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
      };

      const result = checker.verify_interface_implementation(impl);
      expect(result.is_compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should fail for missing required property", () => {
      const impl = {
        id: "req-123",
        query: "test query",
        intent: "query",
        // Missing urgency and timestamp
      };

      const result = checker.verify_interface_implementation(impl);
      expect(result.is_compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should warn about extra properties", () => {
      const impl = {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
        extraProp: "not in spec",
      };

      const result = checker.verify_interface_implementation(impl);
      expect(result.is_compliant).toBe(true);
      expect(
        result.warnings.some(w => w.message.includes("Unexpected property"))
      ).toBe(true);
    });

    it("should verify property types", () => {
      const impl = {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: "not a number", // Wrong type
      };

      const result = checker.verify_interface_implementation(impl);
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("wrong type"))
      ).toBe(true);
    });
  });

  describe("verify_enum_values", () => {
    it("should pass for correct enum values", () => {
      const enumImpl = {
        QUERY: "query",
        COMMAND: "command",
        CONVERSATION: "conversation",
      };

      const result = checker.verify_enum_values(enumImpl, "IntentCategory");
      expect(result.is_compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should fail for missing enum value", () => {
      const enumImpl = {
        QUERY: "query",
        COMMAND: "command",
        // Missing CONVERSATION
      };

      const result = checker.verify_enum_values(enumImpl, "IntentCategory");
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("Missing enum value"))
      ).toBe(true);
    });

    it("should fail for incorrect enum value", () => {
      const enumImpl = {
        QUERY: "wrong value",
        COMMAND: "command",
        CONVERSATION: "conversation",
      };

      const result = checker.verify_enum_values(enumImpl, "IntentCategory");
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("value mismatch"))
      ).toBe(true);
    });

    it("should warn about extra enum values", () => {
      const enumImpl = {
        QUERY: "query",
        COMMAND: "command",
        CONVERSATION: "conversation",
        EXTRA: "extra value",
      };

      const result = checker.verify_enum_values(enumImpl, "IntentCategory");
      expect(result.is_compliant).toBe(true);
      expect(
        result.warnings.some(w => w.message.includes("Extra enum value"))
      ).toBe(true);
    });
  });

  describe("verify_message_format", () => {
    it("should pass for valid message", () => {
      const message = {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
      };

      const result = checker.verify_message_format(message);
      expect(result.is_compliant).toBe(true);
    });

    it("should fail for invalid message type", () => {
      const result = checker.verify_message_format("not an object");
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an object");
    });

    it("should fail for null message", () => {
      const result = checker.verify_message_format(null);
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an object");
    });

    it("should check timeout constraints", () => {
      const message = {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
        timeout: 100000, // Way over spec
      };

      const result = checker.verify_message_format(message);
      // Should have warning about timeout
      expect(result.violations.length + result.warnings.length).toBeGreaterThan(
        0
      );
    });
  });

  describe("verify_message_flow", () => {
    it("should pass for valid message sequence", () => {
      const messages = [
        {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      ];

      const result = checker.verify_message_flow(messages);
      expect(result.is_compliant).toBe(true);
    });

    it("should fail for non-array input", () => {
      const result = checker.verify_message_flow("not an array" as unknown[]);
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an array");
    });

    it("should fail for invalid message in sequence", () => {
      const messages = [
        {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
        "invalid message",
      ];

      const result = checker.verify_message_flow(messages);
      expect(result.is_compliant).toBe(false);
    });

    it("should handle empty message array", () => {
      const result = checker.verify_message_flow([]);
      expect(result.is_compliant).toBe(true);
    });
  });

  describe("verify_error_handling", () => {
    it("should pass for valid error array", () => {
      const errors = [
        { type: "timeout", message: "Request timed out" },
        { type: "rate_limited", message: "Too many requests" },
      ];

      const result = checker.verify_error_handling(errors);
      expect(result.is_compliant).toBe(true);
    });

    it("should fail for non-array input", () => {
      const result = checker.verify_error_handling("not an array" as unknown[]);
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("must be an array");
    });

    it("should fail for error without required fields", () => {
      const errors = [{ message: "Missing type field" }];

      const result = checker.verify_error_handling(errors);
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v =>
          v.message.includes("missing required fields")
        )
      ).toBe(true);
    });

    it("should warn about unknown error types", () => {
      const errors = [{ type: "unknown_error", message: "Unknown error type" }];

      const result = checker.verify_error_handling(errors);
      expect(
        result.warnings.some(w => w.message.includes("Unknown error type"))
      ).toBe(true);
    });
  });

  describe("verify_preconditions", () => {
    it("should pass when all preconditions are met", async () => {
      const context: ExecutionContext = {
        method_name: "validate_packet",
        parameters: {
          packet: {
            id: "req-123",
            query: "test",
          },
        },
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_preconditions(
        "validate_packet",
        context
      );
      expect(result.is_compliant).toBe(true);
    });

    it("should fail when precondition is not met", async () => {
      const context: ExecutionContext = {
        method_name: "validate_packet",
        parameters: {
          packet: null, // Invalid: not an object
        },
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_preconditions(
        "validate_packet",
        context
      );
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("Precondition failed"))
      ).toBe(true);
    });

    it("should fail for unknown behavior", async () => {
      const context: ExecutionContext = {
        method_name: "unknown_behavior",
        parameters: {},
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_preconditions(
        "unknown_behavior",
        context
      );
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("Unknown behavior");
    });
  });

  describe("verify_postconditions", () => {
    it("should pass when all postconditions are met", async () => {
      const context: ExecutionContext = {
        method_name: "validate_packet",
        parameters: {},
        state: {},
        timestamp: Date.now(),
        result: true, // Valid result
      };

      const result = await checker.verify_postconditions(
        "validate_packet",
        true,
        context
      );
      expect(result.is_compliant).toBe(true);
    });

    it("should fail when postcondition is not met", async () => {
      const context: ExecutionContext = {
        method_name: "validate_packet",
        parameters: {},
        state: {},
        timestamp: Date.now(),
        result: false, // Invalid result
      };

      const result = await checker.verify_postconditions(
        "validate_packet",
        false,
        context
      );
      expect(result.is_compliant).toBe(false);
      expect(
        result.violations.some(v => v.message.includes("Postcondition failed"))
      ).toBe(true);
    });

    it("should fail for unknown behavior", async () => {
      const context: ExecutionContext = {
        method_name: "unknown_behavior",
        parameters: {},
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_postconditions(
        "unknown_behavior",
        null,
        context
      );
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("Unknown behavior");
    });
  });

  describe("verify_invariants", () => {
    it("should pass when all invariants hold", async () => {
      const context: ExecutionContext = {
        method_name: "validate_packet",
        parameters: {},
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_invariants(
        "validate_packet",
        context
      );
      expect(result.is_compliant).toBe(true);
    });

    it("should fail for unknown behavior", async () => {
      const context: ExecutionContext = {
        method_name: "unknown_behavior",
        parameters: {},
        state: {},
        timestamp: Date.now(),
      };

      const result = await checker.verify_invariants(
        "unknown_behavior",
        context
      );
      expect(result.is_compliant).toBe(false);
      expect(result.violations[0].message).toContain("Unknown behavior");
    });
  });

  describe("check_compliance", () => {
    it("should generate full compliance report", () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      };

      const report = checker.check_compliance(impl);

      expect(report.protocol_name).toBe("ATP");
      expect(report.protocol_version).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("overall_compliance");
      expect(report).toHaveProperty("compliance_score");
      expect(report).toHaveProperty("type_compliance");
      expect(report).toHaveProperty("message_compliance");
      expect(report).toHaveProperty("behavior_compliance");
      expect(report).toHaveProperty("constraint_compliance");
      expect(report).toHaveProperty("recommendations");
    });

    it("should calculate compliance score correctly", () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      };

      const report = checker.check_compliance(impl);
      expect(report.compliance_score).toBeGreaterThanOrEqual(0);
      expect(report.compliance_score).toBeLessThanOrEqual(100);
    });

    it("should include recommendations for violations", () => {
      const impl = {}; // Missing all required types

      const report = checker.check_compliance(impl);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toHaveProperty("severity");
      expect(report.recommendations[0]).toHaveProperty("category");
      expect(report.recommendations[0]).toHaveProperty("message");
    });
  });

  describe("generate_report", () => {
    it("should generate empty compliance report", () => {
      const report = checker.generate_report();

      expect(report.protocol_name).toBe("ATP");
      expect(report.overall_compliance).toBe(true);
      expect(report.compliance_score).toBe(100);
      expect(report.type_compliance.is_compliant).toBe(true);
      expect(report.message_compliance.is_compliant).toBe(true);
      expect(report.behavior_compliance.is_compliant).toBe(true);
      expect(report.constraint_compliance.is_compliant).toBe(true);
    });
  });

  describe("getSpecification", () => {
    it("should return a copy of the specification", () => {
      const spec = checker.getSpecification();
      expect(spec).toEqual(ATP_SPECIFICATION);

      // Verify it's a copy, not the same reference
      expect(spec).not.toBe(ATP_SPECIFICATION);
    });
  });
});

// ============================================================================
// COMPLIANCE TEST RUNNER TESTS
// ============================================================================

describe("ComplianceTestRunner", () => {
  let runner: ComplianceTestRunner;

  beforeEach(() => {
    runner = new ComplianceTestRunner(ATP_SPECIFICATION);
  });

  describe("constructor", () => {
    it("should create runner with specification", () => {
      expect(runner).toBeDefined();
    });

    it("should auto-generate test cases", () => {
      const testCases = runner.get_test_cases();
      expect(testCases.length).toBeGreaterThan(0);
    });
  });

  describe("add_test_case", () => {
    it("should add custom test case", () => {
      const customTest = {
        id: "custom-test",
        name: "Custom Test",
        description: "A custom test",
        specification_reference: "custom",
        test_type: "type" as const,
        test_fn: async () => ({
          id: "",
          name: "",
          passed: true,
          duration_ms: 0,
        }),
      };

      runner.add_test_case(customTest);

      const testCases = runner.get_test_cases();
      expect(testCases.some(t => t.id === "custom-test")).toBe(true);
    });

    it("should replace existing test with same ID", () => {
      const test1 = {
        id: "test-1",
        name: "Test 1",
        description: "First test",
        specification_reference: "test",
        test_type: "type" as const,
        test_fn: async () => ({
          id: "",
          name: "",
          passed: true,
          duration_ms: 0,
        }),
      };

      const test2 = {
        id: "test-1",
        name: "Test 2",
        description: "Second test",
        specification_reference: "test",
        test_type: "type" as const,
        test_fn: async () => ({
          id: "",
          name: "",
          passed: false,
          duration_ms: 0,
        }),
      };

      runner.add_test_case(test1);
      runner.add_test_case(test2);

      const testCases = runner.get_test_cases();
      const matchingTests = testCases.filter(t => t.id === "test-1");
      expect(matchingTests).toHaveLength(1);
      expect(matchingTests[0].name).toBe("Test 2");
    });
  });

  describe("remove_test_case", () => {
    it("should remove test case by ID", () => {
      const test = {
        id: "to-remove",
        name: "To Remove",
        description: "Will be removed",
        specification_reference: "test",
        test_type: "type" as const,
        test_fn: async () => ({
          id: "",
          name: "",
          passed: true,
          duration_ms: 0,
        }),
      };

      runner.add_test_case(test);
      expect(runner.get_test_cases().some(t => t.id === "to-remove")).toBe(
        true
      );

      runner.remove_test_case("to-remove");
      expect(runner.get_test_cases().some(t => t.id === "to-remove")).toBe(
        false
      );
    });

    it("should handle removing non-existent test", () => {
      expect(() => runner.remove_test_case("non-existent")).not.toThrow();
    });
  });

  describe("run_tests", () => {
    it("should run all tests against implementation", async () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test query",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      };

      const results = await runner.run_tests(impl);

      expect(results).toHaveProperty("total_tests");
      expect(results).toHaveProperty("passed_tests");
      expect(results).toHaveProperty("failed_tests");
      expect(results).toHaveProperty("duration_ms");
      expect(results).toHaveProperty("test_results");
      expect(results.total_tests).toBe(results.test_results.length);
      expect(results.passed_tests + results.failed_tests).toBe(
        results.total_tests
      );
    });

    it("should track test duration", async () => {
      const impl = {};

      const results = await runner.run_tests(impl);

      for (const result of results.test_results) {
        expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle test failures gracefully", async () => {
      const failingTest = {
        id: "failing-test",
        name: "Failing Test",
        description: "This test throws an error",
        specification_reference: "test",
        test_type: "type" as const,
        test_fn: async () => {
          throw new Error("Test error");
        },
      };

      runner.add_test_case(failingTest);

      const results = await runner.run_tests({});
      expect(results.failed_tests).toBeGreaterThan(0);
    });
  });

  describe("run_test_by_id", () => {
    it("should run specific test by ID", async () => {
      const impl = {
        ATPacket: {
          id: "req-123",
          query: "test",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        },
      };

      const testCases = runner.get_test_cases();
      const firstTest = testCases[0];

      const result = await runner.run_test_by_id(firstTest.id, impl);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("duration_ms");
      expect(result.id).toBe(firstTest.id);
      expect(result.name).toBe(firstTest.name);
    });

    it("should throw for non-existent test ID", async () => {
      await expect(runner.run_test_by_id("non-existent", {})).rejects.toThrow(
        "Test case not found"
      );
    });
  });

  describe("generateTestCases", () => {
    it("should generate test cases from specification", () => {
      const testCases = runner.generateTestCases();

      expect(testCases.length).toBeGreaterThan(0);

      for (const testCase of testCases) {
        expect(testCase).toHaveProperty("id");
        expect(testCase).toHaveProperty("name");
        expect(testCase).toHaveProperty("description");
        expect(testCase).toHaveProperty("specification_reference");
        expect(testCase).toHaveProperty("test_type");
        expect(testCase).toHaveProperty("test_fn");
      }
    });

    it("should generate type tests", () => {
      const testCases = runner.generateTestCases();
      const typeTests = testCases.filter(t => t.test_type === "type");

      expect(typeTests.length).toBeGreaterThan(0);
    });

    it("should generate message tests", () => {
      const testCases = runner.generateTestCases();
      const messageTests = testCases.filter(t => t.test_type === "message");

      expect(messageTests.length).toBeGreaterThan(0);
    });

    it("should generate tests for custom specification", () => {
      const customSpec: ProtocolSpecification = {
        name: "Custom",
        version: { major: 1, minor: 0, patch: 0 },
        types: [
          {
            name: "CustomType",
            type: "interface",
            definition: {
              kind: "interface",
              properties: {
                id: { type: "string", optional: false, readonly: false },
              },
            },
            required_properties: ["id"],
            optional_properties: [],
          },
        ],
        messages: [],
        behaviors: [],
        constraints: [],
      };

      const testCases = runner.generateTestCases(customSpec);

      expect(testCases.some(t => t.id.includes("CustomType"))).toBe(true);
    });
  });

  describe("get_test_cases", () => {
    it("should return all test cases", () => {
      const testCases = runner.get_test_cases();

      expect(Array.isArray(testCases)).toBe(true);
      expect(testCases.length).toBeGreaterThan(0);
    });

    it("should return copy of test cases", () => {
      const testCases1 = runner.get_test_cases();
      const testCases2 = runner.get_test_cases();

      expect(testCases1).not.toBe(testCases2);
      expect(testCases1).toEqual(testCases2);
    });
  });
});

// ============================================================================
// TEST CASE BUILDERS TESTS
// ============================================================================

describe("Test Case Builders", () => {
  describe("buildTypeTest", () => {
    it("should build type test case", () => {
      const test = buildTypeTest({
        typeName: "TestType",
        condition: value => typeof value === "string",
      });

      expect(test.id).toBe("type-TestType");
      expect(test.name).toContain("TestType");
      expect(test.test_type).toBe("type");
    });

    it("should build property type test", () => {
      const test = buildTypeTest({
        typeName: "TestType",
        property: "testProp",
        condition: value => typeof value === "number",
      });

      expect(test.id).toBe("type-TestType-testProp");
      expect(test.name).toContain("testProp");
    });

    it("should execute test function", async () => {
      const test = buildTypeTest({
        typeName: "TestType",
        condition: value => value === "expected",
      });

      const impl = { TestType: "expected" };
      const result = await test.test_fn(impl);

      expect(result.passed).toBe(true);
    });
  });

  describe("buildMessageTest", () => {
    it("should build message test case", () => {
      const test = buildMessageTest({
        messageName: "TestMessage",
        field: "testField",
        expectedValue: "expected",
      });

      expect(test.id).toBe("message-TestMessage-testField");
      expect(test.name).toContain("TestMessage");
      expect(test.name).toContain("testField");
      expect(test.test_type).toBe("message");
    });

    it("should execute test function", async () => {
      const test = buildMessageTest({
        messageName: "TestMessage",
        field: "testField",
        expectedValue: "expected",
      });

      const impl = {
        TestMessage: {
          testField: "expected",
        },
      };

      const result = await test.test_fn(impl);
      expect(result.passed).toBe(true);
    });
  });

  describe("buildBehaviorTest", () => {
    it("should build behavior test case", () => {
      const test = buildBehaviorTest({
        behaviorName: "testBehavior",
        condition: ctx => ctx.parameters.input === "expected",
      });

      expect(test.id).toBe("behavior-testBehavior");
      expect(test.name).toContain("testBehavior");
      expect(test.test_type).toBe("behavior");
    });

    it("should execute test function", async () => {
      const test = buildBehaviorTest({
        behaviorName: "testBehavior",
        condition: ctx => ctx.parameters.input === "expected",
      });

      const impl = { input: "expected" };
      const result = await test.test_fn(impl);

      expect(result.passed).toBe(true);
    });
  });

  describe("buildConstraintTest", () => {
    it("should build constraint test case", () => {
      const test = buildConstraintTest({
        constraintName: "testConstraint",
        check: value => typeof value === "string",
      });

      expect(test.id).toBe("constraint-testConstraint");
      expect(test.name).toContain("testConstraint");
      expect(test.test_type).toBe("constraint");
    });

    it("should execute test function", async () => {
      const test = buildConstraintTest({
        constraintName: "testConstraint",
        check: value => value === "valid",
      });

      const impl = "valid";
      const result = await test.test_fn(impl);

      expect(result.passed).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration Tests", () => {
  it("should run full compliance check workflow", () => {
    const checker = new ProtocolComplianceChecker(ATP_SPECIFICATION);

    const impl = {
      ATPacket: {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
      },
      IntentCategory: {
        QUERY: "query",
        COMMAND: "command",
        CONVERSATION: "conversation",
      },
      Urgency: {
        LOW: "low",
        NORMAL: "normal",
        HIGH: "high",
        CRITICAL: "critical",
      },
    };

    const report = checker.check_compliance(impl);

    expect(report.protocol_name).toBe("ATP");
    expect(report.overall_compliance).toBe(true);
    expect(report.compliance_score).toBeGreaterThan(50);
  });

  it("should run full test runner workflow", async () => {
    const runner = new ComplianceTestRunner(ATP_SPECIFICATION);

    const impl = {
      ATPacket: {
        id: "req-123",
        query: "test query",
        intent: "query",
        urgency: "normal",
        timestamp: Date.now(),
      },
    };

    const results = await runner.run_tests(impl);

    expect(results.total_tests).toBeGreaterThan(0);
    expect(results.duration_ms).toBeGreaterThanOrEqual(0);
    expect(results.test_results.length).toBe(results.total_tests);
  });

  it("should handle ACP specification", () => {
    const checker = new ProtocolComplianceChecker(ACP_SPECIFICATION);

    const impl = {
      ACPHandshakeRequest: {
        id: "acp-123",
        query: "test query",
        intent: "query",
        collaborationMode: "cascade",
        models: ["gpt-4", "claude-3"],
        preferences: { maxLatency: 2000 },
        timestamp: Date.now(),
      },
    };

    const report = checker.check_compliance(impl);

    expect(report.protocol_name).toBe("ACP");
    expect(report.compliance_score).toBeGreaterThanOrEqual(0);
  });
});
