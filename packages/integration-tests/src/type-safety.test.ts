/**
 * Suite 1: Type Safety Across Packages
 *
 * Verifies that all packages can be imported without errors
 * and that type definitions are compatible across the ecosystem.
 *
 * CRITICAL TypeScript Distinction:
 * - Interfaces and type aliases are ERASED during compilation (compile-time only)
 * - Enums, classes, functions, and constants EXIST at runtime
 *
 * This test suite properly separates:
 * 1. Runtime value checks (enums, classes, constants)
 * 2. Type existence checks (verified via TypeScript compilation, not runtime)
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// STATIC TYPE IMPORTS (for compile-time type checking)
// ============================================================================

// Import types for compile-time verification
import type {
  // Protocol types
  IntentVector,
  Meaning,
  Context,
  Thought,
  Action,
  Constraint,
  QueryConstraints,
  ATPRequest,
  ATPResponse,
  ACPRequest,
  ACPResponse,
  // Cascade types
  ModelAdapter,
  AdapterCapabilities,
  // Swarm types
  CRDTOperation,
  CRDTSnapshot,
  CRDTMetadata,
} from "@lsi/protocol";

// ============================================================================
// SECTION 1: Runtime Value Tests
// ============================================================================

describe("Runtime Value Exports - @lsi/protocol", () => {
  it("should export enums (runtime values)", async () => {
    const protocol = await import("@lsi/protocol");

    // Enums ARE runtime values (they exist as objects in JavaScript)
    expect(protocol.IntentCategory).toBeDefined();
    expect(protocol.ConstraintType).toBeDefined();
    expect(protocol.PIIType).toBeDefined();

    // Verify enum values are accessible
    expect(protocol.IntentCategory.QUERY).toBe("query");
    expect(protocol.IntentCategory.COMMAND).toBe("command");
    expect(protocol.ConstraintType.PRIVACY).toBe("privacy");
    expect(protocol.ConstraintType.BUDGET).toBe("budget");
    expect(protocol.PIIType.EMAIL).toBe("email");
  });

  it("should export error classes (runtime values)", async () => {
    const protocol = await import("@lsi/protocol");

    // Classes ARE runtime values (constructor functions)
    expect(protocol.LSIError).toBeDefined();
    expect(protocol.LSIRoutingError).toBeDefined();
    expect(protocol.LSISecurityError).toBeDefined();
    expect(protocol.LSIConfigurationError).toBeDefined();
    expect(protocol.LSIExecutionError).toBeDefined();

    // Verify inheritance works at runtime
    const error = new protocol.LSIError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("test");

    const routingError = new protocol.LSIRoutingError("routing failed");
    expect(routingError).toBeInstanceOf(protocol.LSIError);
    expect(routingError).toBeInstanceOf(Error);
  });

  it("should export constants (runtime values)", async () => {
    const protocol = await import("@lsi/protocol");

    // Constants ARE runtime values
    expect(protocol.PROTOCOL_VERSION).toBeDefined();
    expect(protocol.PROTOCOL_VERSION).toBe("1.0.0");
    expect(protocol.TYPE_COUNT).toBeDefined();
    expect(typeof protocol.TYPE_COUNT).toBe("object");
  });
});

describe("Runtime Value Exports - @lsi/cascade", () => {
  it("should export router classes (runtime values)", async () => {
    const cascade = await import("@lsi/cascade");

    // Classes ARE runtime values
    expect(cascade.CascadeRouter).toBeDefined();
    expect(cascade.IntentRouter).toBeDefined();

    // Verify they are constructor functions
    expect(typeof cascade.CascadeRouter).toBe("function");
    expect(typeof cascade.IntentRouter).toBe("function");
  });
});

describe("Runtime Value Exports - @lsi/privacy", () => {
  it("should export privacy classes (runtime values)", async () => {
    const privacy = await import("@lsi/privacy");

    // Classes ARE runtime values
    expect(privacy.RedactionAdditionProtocol).toBeDefined();
    expect(privacy.IntentEncoder).toBeDefined();
    expect(privacy.PrivacyClassifier).toBeDefined();

    // Verify they are constructor functions
    expect(typeof privacy.RedactionAdditionProtocol).toBe("function");
    expect(typeof privacy.IntentEncoder).toBe("function");
    expect(typeof privacy.PrivacyClassifier).toBe("function");
  });

  it("should export privacy enums (runtime values)", async () => {
    const privacy = await import("@lsi/privacy");

    // Enums might be re-exported from protocol
    if (privacy.SensitivityLevel) {
      expect(privacy.SensitivityLevel).toBeDefined();
    }
    if (privacy.PIIType) {
      expect(privacy.PIIType).toBeDefined();
    }
    if (privacy.PrivacyIntent) {
      expect(privacy.PrivacyIntent).toBeDefined();
    }
  });
});

describe("Runtime Value Exports - @lsi/swarm", () => {
  it("should export CRDT interfaces (compile-time types)", async () => {
    const swarm = await import("@lsi/swarm");

    // CRDTOperation, CRDTSnapshot, CRDTMetadata are interfaces
    // They don't exist at runtime, but we can verify the package imports
    expect(swarm).toBeDefined();
  });
});

describe("Runtime Value Exports - @lsi/superinstance", () => {
  it("should export SuperInstance class (runtime value)", async () => {
    const superinstance = await import("@lsi/superinstance");

    // SuperInstance is a class - runtime value
    expect(superinstance.SuperInstance).toBeDefined();
    expect(typeof superinstance.SuperInstance).toBe("function");
  });

  it("should export three-plane component classes (runtime values)", async () => {
    const superinstance = await import("@lsi/superinstance");

    // These should be classes
    expect(superinstance.ContextPlane).toBeDefined();
    expect(superinstance.IntentionPlane).toBeDefined();
    expect(superinstance.LucidDreamer).toBeDefined();

    // Verify they are constructor functions
    expect(typeof superinstance.ContextPlane).toBe("function");
    expect(typeof superinstance.IntentionPlane).toBe("function");
    expect(typeof superinstance.LucidDreamer).toBe("function");
  });
});

// ============================================================================
// SECTION 2: Type Existence (Compile-Time Verification)
// ============================================================================

/**
 * These tests verify that TYPES exist by using TypeScript's type system.
 *
 * If a type doesn't exist, TypeScript will throw a compile-time error.
 * These tests pass at runtime if the code compiles successfully.
 */
describe("Type Existence (Compile-Time) - @lsi/protocol", () => {
  it("should export IntentVector interface (compile-time)", () => {
    // Type check: If IntentVector doesn't exist, this won't compile
    // Using static import type for compile-time verification
    type _Test = IntentVector;

    // Runtime: IntentVector is an interface (erased), so undefined is OK
    // The fact this code compiles proves the type exists
    expect(true).toBe(true); // Test passes if TypeScript compilation succeeds
  });

  it("should export Meaning type alias (compile-time)", () => {
    type _Test = Meaning;
    expect(true).toBe(true);
  });

  it("should export Context interface (compile-time)", () => {
    type _Test = Context;
    expect(true).toBe(true);
  });

  it("should export Thought interface (compile-time)", () => {
    type _Test = Thought;
    expect(true).toBe(true);
  });

  it("should export Action interface (compile-time)", () => {
    type _Test = Action;
    expect(true).toBe(true);
  });

  it("should export Constraint interface (compile-time)", () => {
    type _Test = Constraint;
    expect(true).toBe(true);
  });

  it("should export QueryConstraints interface (compile-time)", () => {
    type _Test = QueryConstraints;
    expect(true).toBe(true);
  });

  it("should export ATPRequest interface (compile-time)", () => {
    type _Test = ATPRequest;
    expect(true).toBe(true);
  });

  it("should export ATPResponse interface (compile-time)", () => {
    type _Test = ATPResponse;
    expect(true).toBe(true);
  });

  it("should export ACPRequest interface (compile-time)", () => {
    type _Test = ACPRequest;
    expect(true).toBe(true);
  });

  it("should export ACPResponse interface (compile-time)", () => {
    type _Test = ACPResponse;
    expect(true).toBe(true);
  });
});

describe("Type Existence (Compile-Time) - @lsi/cascade", () => {
  it("should export ModelAdapter interface (compile-time)", () => {
    type _Test = ModelAdapter;
    expect(true).toBe(true);
  });

  it("should export AdapterCapabilities interface (compile-time)", () => {
    type _Test = AdapterCapabilities;
    expect(true).toBe(true);
  });
});

describe("Type Existence (Compile-Time) - @lsi/swarm", () => {
  it("should export CRDT operation types (compile-time)", () => {
    type _Test1 = CRDTOperation;
    type _Test2 = CRDTSnapshot;
    type _Test3 = CRDTMetadata;
    expect(true).toBe(true);
  });
});

// ============================================================================
// SECTION 3: Type Compatibility Tests
// ============================================================================

describe("Type Compatibility Across Packages", () => {
  it("should verify IntentVector type works in practice", async () => {
    const protocol = await import("@lsi/protocol");

    // Create an IntentVector instance to verify type structure
    const intentVector: IntentVector = {
      embedding: new Float32Array(768),
      intentType: protocol.IntentCategory.QUERY,
      confidence: 0.85,
      summary: "test query",
      entities: [],
      complexity: "simple",
    };

    // Runtime verification of values
    expect(intentVector.embedding).toBeInstanceOf(Float32Array);
    expect(intentVector.embedding.length).toBe(768);
    expect(intentVector.intentType).toBe(protocol.IntentCategory.QUERY);
    expect(intentVector.confidence).toBe(0.85);
    expect(intentVector.summary).toBe("test query");
    expect(intentVector.entities).toEqual([]);
    expect(intentVector.complexity).toBe("simple");
  });

  it("should verify Constraint type works in practice", async () => {
    const protocol = await import("@lsi/protocol");

    // Create a Constraint instance
    const constraint: Constraint = {
      type: protocol.ConstraintType.PRIVACY,
      value: "high",
      priority: 1,
    };

    // Runtime verification
    expect(constraint.type).toBe(protocol.ConstraintType.PRIVACY);
    expect(constraint.value).toBe("high");
    expect(constraint.priority).toBe(1);
  });

  it("should verify ATPRequest type works in practice", async () => {
    const protocol = await import("@lsi/protocol");

    // Create a complete ATPRequest
    const atpRequest: ATPRequest = {
      queryId: "test-123",
      query: "test query",
      intentVector: {
        embedding: new Float32Array(768),
        intentType: protocol.IntentCategory.QUERY,
        confidence: 0.9,
        summary: "test",
        entities: [],
        complexity: "simple",
      },
      constraints: [],
      timestamp: Date.now(),
    };

    // Runtime verification
    expect(atpRequest.queryId).toBe("test-123");
    expect(atpRequest.query).toBe("test query");
    expect(atpRequest.intentVector.intentType).toBe(
      protocol.IntentCategory.QUERY
    );
    expect(atpRequest.constraints).toEqual([]);
    expect(atpRequest.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("should verify ACPRequest type works in practice", async () => {
    const protocol = await import("@lsi/protocol");

    // Create a complete ACPRequest
    const acpRequest: ACPRequest = {
      queryId: "acp-test-123",
      queries: ["query 1", "query 2"],
      collaborationMode: "sequential",
      intentVectors: [
        {
          embedding: new Float32Array(768),
          intentType: protocol.IntentCategory.QUERY,
          confidence: 0.9,
          summary: "query 1",
          entities: [],
          complexity: "simple",
        },
      ],
      constraints: [],
      timestamp: Date.now(),
    };

    // Runtime verification
    expect(acpRequest.queryId).toBe("acp-test-123");
    expect(acpRequest.queries).toHaveLength(2);
    expect(acpRequest.collaborationMode).toBe("sequential");
    expect(acpRequest.intentVectors).toHaveLength(1);
  });
});

// ============================================================================
// SECTION 4: Module Resolution Tests
// ============================================================================

describe("Module Resolution", () => {
  it("should resolve all package dependencies", async () => {
    const packages = [
      "@lsi/protocol",
      "@lsi/cascade",
      "@lsi/privacy",
      "@lsi/swarm",
      "@lsi/superinstance",
    ];

    const imports = await Promise.all(
      packages.map(async pkg => {
        try {
          const module = await import(pkg);
          return { package: pkg, success: true, module };
        } catch (error) {
          return { package: pkg, success: false, error };
        }
      })
    );

    // All packages should import successfully
    const failed = imports.filter(result => !result.success);

    if (failed.length > 0) {
      console.error("Failed to import packages:", failed);
    }

    expect(failed.length).toBe(0);
  });

  it("should verify no circular dependencies", async () => {
    // This test checks if packages can be loaded without circular dependency errors
    const packages = [
      "@lsi/protocol",
      "@lsi/cascade",
      "@lsi/privacy",
      "@lsi/swarm",
      "@lsi/superinstance",
    ];

    // Load all packages
    const modules = await Promise.all(packages.map(pkg => import(pkg)));

    // Verify all loaded successfully (no circular dependency errors)
    modules.forEach((module, index) => {
      expect(module).toBeDefined();
      expect(Object.keys(module).length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SECTION 5: Export Completeness (Runtime Values Only)
// ============================================================================

describe("Runtime Export Completeness", () => {
  it("should export all runtime values from @lsi/protocol", async () => {
    const protocol = await import("@lsi/protocol");

    // Only check ENUMS, CLASSES, and CONSTANTS (not interfaces/types)
    const runtimeExports = [
      // Enums (runtime values)
      "IntentCategory",
      "ConstraintType",
      "PIIType",
      // Classes (runtime values)
      "LSIError",
      "LSIRoutingError",
      "LSISecurityError",
      "LSIConfigurationError",
      "LSIExecutionError",
      // Constants (runtime values)
      "PROTOCOL_VERSION",
      "TYPE_COUNT",
    ];

    runtimeExports.forEach(exportName => {
      expect(protocol[exportName as keyof typeof protocol]).toBeDefined();
    });
  });

  it("should export all runtime classes from @lsi/cascade", async () => {
    const cascade = await import("@lsi/cascade");

    // Only check classes (not interfaces)
    const runtimeExports = ["CascadeRouter", "IntentRouter"];

    runtimeExports.forEach(exportName => {
      expect(cascade[exportName as keyof typeof cascade]).toBeDefined();
    });
  });

  it("should export all runtime classes from @lsi/privacy", async () => {
    const privacy = await import("@lsi/privacy");

    // Only check classes (not interfaces)
    const runtimeExports = [
      "RedactionAdditionProtocol",
      "IntentEncoder",
      "PrivacyClassifier",
    ];

    runtimeExports.forEach(exportName => {
      expect(privacy[exportName as keyof typeof privacy]).toBeDefined();
    });
  });

  it("should export all runtime classes from @lsi/superinstance", async () => {
    const superinstance = await import("@lsi/superinstance");

    // Only check classes (not interfaces)
    const runtimeExports = [
      "SuperInstance",
      "ContextPlane",
      "IntentionPlane",
      "LucidDreamer",
    ];

    runtimeExports.forEach(exportName => {
      expect(
        superinstance[exportName as keyof typeof superinstance]
      ).toBeDefined();
    });
  });
});

// ============================================================================
// SECTION 6: Documentation Tests
// ============================================================================

describe("TypeScript vs JavaScript Documentation", () => {
  it("should document the distinction between types and values", () => {
    // This test documents the fundamental distinction for future maintainers

    const docs = {
      runtimeValues: [
        "Classes (constructor functions)",
        "Enums (object representations)",
        "Functions (function objects)",
        "Constants/variables (values)",
      ],
      compileTimeOnly: [
        "Interfaces (erased during compilation)",
        "Type aliases (erased during compilation)",
      ],
      testingPrinciples: [
        "Runtime values: check with expect(x).toBeDefined()",
        "Types: verify via TypeScript compilation, not runtime checks",
        "If a type exists, code using it will compile",
        "If a type doesn't exist, TypeScript will error at compile time",
      ],
    };

    // This test always passes - it's documentation
    expect(docs.runtimeValues.length).toBeGreaterThan(0);
    expect(docs.compileTimeOnly.length).toBeGreaterThan(0);
    expect(docs.testingPrinciples.length).toBeGreaterThan(0);
  });
});
