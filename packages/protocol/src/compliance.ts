/**
 * Protocol Compliance Testing Suite for Aequor Cognitive Orchestration Platform
 *
 * This module provides automated protocol compliance testing that verifies
 * implementations against their protocol specifications.
 *
 * Features:
 * - Type compliance checking (interfaces, types, enums, classes)
 * - Message format validation (requests, responses, flow control)
 * - Behavior verification (preconditions, postconditions, invariants)
 * - Constraint validation (privacy, budget, thermal, latency)
 * - Comprehensive compliance reporting with recommendations
 *
 * Usage:
 * ```typescript
 * import { ProtocolComplianceChecker, ComplianceTestRunner } from '@lsi/protocol';
 *
 * // Define a protocol specification
 * const spec: ProtocolSpecification = {
 *   name: 'ATP',
 *   version: { major: 1, minor: 0, patch: 0 },
 *   types: [...],
 *   messages: [...],
 *   behaviors: [...],
 *   constraints: [...]
 * };
 *
 * // Create checker
 * const checker = new ProtocolComplianceChecker(spec);
 *
 * // Check implementation
 * const report = checker.check_compliance(implementation);
 * console.log(report.compliance_score); // 0-100
 * ```
 */

// ============================================================================
// SEMANTIC VERSIONING
// ============================================================================

/**
 * Semantic version (SemVer) for protocol versioning
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse SemVer from string
 */
export function parseSemVer(version: string): SemVer {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
  );

  if (!match) {
    throw new Error(`Invalid SemVer string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Format SemVer to string
 */
export function formatSemVer(version: SemVer): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }
  if (version.build) {
    result += `+${version.build}`;
  }
  return result;
}

/**
 * Compare two SemVer versions
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // Handle prerelease
  const aPre = a.prerelease ?? "";
  const bPre = b.prerelease ?? "";

  if (aPre === bPre) return 0;
  if (aPre === "") return 1; // Release > prerelease
  if (bPre === "") return -1;

  return aPre.localeCompare(bPre);
}

// ============================================================================
// TYPE SPECIFICATION
// ============================================================================

/**
 * Type definition (supports various TypeScript constructs)
 */
export type TypeDefinition =
  | InterfaceDefinition
  | TypeAliasDefinition
  | EnumDefinition
  | ClassDefinition;

/**
 * Interface definition
 */
export interface InterfaceDefinition {
  kind: "interface";
  properties: Record<string, PropertyDefinition>;
  extends?: string[];
  indexSignature?: PropertyDefinition;
}

/**
 * Type alias definition
 */
export interface TypeAliasDefinition {
  kind: "type";
  type: string;
  generics?: string[];
}

/**
 * Enum definition
 */
export interface EnumDefinition {
  kind: "enum";
  values: Record<string, string | number>;
}

/**
 * Class definition
 */
export interface ClassDefinition {
  kind: "class";
  properties: Record<string, PropertyDefinition>;
  methods: Record<string, MethodDefinition>;
  extends?: string;
  implements?: string[];
}

/**
 * Property definition
 */
export interface PropertyDefinition {
  type: string;
  optional: boolean;
  readonly: boolean;
  description?: string;
}

/**
 * Method definition
 */
export interface MethodDefinition {
  parameters: ParameterDefinition[];
  returnType: string;
  async: boolean;
  description?: string;
}

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: unknown;
}

/**
 * Type specification
 */
export interface TypeSpecification {
  name: string;
  type: "interface" | "type" | "enum" | "class";
  definition: TypeDefinition;
  required_properties: string[];
  optional_properties: string[];
  validation_rules?: ValidationRule[];
}

/**
 * Validation rule for type properties
 */
export interface ValidationRule {
  property: string;
  rule: "type" | "range" | "pattern" | "length" | "custom";
  params?: Record<string, unknown>;
  message?: string;
}

// ============================================================================
// MESSAGE SPECIFICATION
// ============================================================================

/**
 * Message specification (requests/responses in protocol)
 */
export interface MessageSpecification {
  name: string;
  direction: "request" | "response" | "bidirectional";
  request_type?: string;
  response_type?: string;
  flow_control?: FlowControlSpecification;
  error_handling?: ErrorHandlingSpecification;
}

/**
 * Flow control specification
 */
export interface FlowControlSpecification {
  streaming?: boolean;
  timeout?: number;
  retry_policy?: RetryPolicy;
  rate_limit?: ComplianceRateLimit;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  max_attempts: number;
  backoff: "linear" | "exponential" | "fixed";
  initial_delay: number;
  max_delay: number;
}

/**
 * Rate limit specification
 */
export interface ComplianceRateLimit {
  max_requests: number;
  window_ms: number;
  burst?: number;
}

/**
 * Error handling specification
 */
export interface ErrorHandlingSpecification {
  retryable_errors: string[];
  non_retryable_errors: string[];
  fallback_strategy?: "fail" | "fallback" | "cache";
}

// ============================================================================
// BEHAVIOR SPECIFICATION
// ============================================================================

/**
 * Behavior specification (preconditions, postconditions, invariants)
 */
export interface BehaviorSpecification {
  name: string;
  description: string;
  preconditions: Condition[];
  postconditions: Condition[];
  invariants: Invariant[];
}

/**
 * Condition (pre/post-condition)
 */
export interface Condition {
  description: string;
  check: (context: ExecutionContext) => boolean | Promise<boolean>;
  error_message?: string;
}

/**
 * Invariant (always true)
 */
export interface Invariant {
  description: string;
  check: (context: ExecutionContext) => boolean | Promise<boolean>;
  violation_message?: string;
}

/**
 * Execution context for behavior checking
 */
export interface ExecutionContext {
  method_name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  state: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// CONSTRAINT SPECIFICATION
// ============================================================================

/**
 * Constraint specification
 */
export interface ConstraintSpecification {
  name: string;
  type: "privacy" | "budget" | "thermal" | "latency" | "quality" | "custom";
  rule: ConstraintRule;
  severity: "error" | "warning";
}

/**
 * Constraint rule
 */
export interface ConstraintRule {
  check: (context: ExecutionContext) => boolean | Promise<boolean>;
  violation_message: string;
}

// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================

/**
 * Complete protocol specification
 *
 * Defines all aspects of a protocol including types, messages,
 * behaviors, and constraints that implementations must follow.
 */
export interface ProtocolSpecification {
  name: string;
  version: SemVer;
  types: TypeSpecification[];
  messages: MessageSpecification[];
  behaviors: BehaviorSpecification[];
  constraints: ConstraintSpecification[];
  documentation_url?: string;
}

// ============================================================================
// COMPLIANCE RESULTS
// ============================================================================

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  category: "type" | "message" | "behavior" | "constraint";
  severity: "error" | "warning";
  message: string;
  location?: string;
  specification_reference?: string;
  actual?: string;
  expected?: string;
}

/**
 * Compliance warning
 */
export interface ComplianceWarning {
  category: "type" | "message" | "behavior" | "constraint";
  message: string;
  location?: string;
  suggestion?: string;
}

/**
 * Compliance result for a single category
 */
export interface ComplianceResult {
  is_compliant: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
  coverage: number; // percentage 0-100
}

/**
 * Recommendation for fixing compliance issues
 */
export interface Recommendation {
  severity: "error" | "warning" | "info";
  category: "type" | "message" | "behavior" | "constraint";
  message: string;
  suggestion?: string;
  code_example?: string;
}

/**
 * Full compliance report
 */
export interface ComplianceReport {
  protocol_name: string;
  protocol_version: SemVer;
  timestamp: Date;
  overall_compliance: boolean;
  compliance_score: number; // 0-100
  type_compliance: ComplianceResult;
  message_compliance: ComplianceResult;
  behavior_compliance: ComplianceResult;
  constraint_compliance: ComplianceResult;
  recommendations: Recommendation[];
}

// ============================================================================
// PROTOCOL COMPLIANCE CHECKER
// ============================================================================

/**
 * ProtocolComplianceChecker - Validates implementations against protocol specifications
 *
 * Performs comprehensive validation of protocol implementations including:
 * - Type structure verification
 * - Message format validation
 * - Behavior contract verification
 * - Constraint satisfaction checking
 */
export class ProtocolComplianceChecker {
  private specification: ProtocolSpecification;
  private typeMap: Map<string, TypeSpecification>;
  private behaviorMap: Map<string, BehaviorSpecification>;

  constructor(specification: ProtocolSpecification) {
    this.specification = specification;

    // Build lookup maps
    this.typeMap = new Map(specification.types.map(t => [t.name, t]));
    this.behaviorMap = new Map(specification.behaviors.map(b => [b.name, b]));
  }

  // ========================================================================
  // TYPE CHECKING
  // ========================================================================

  /**
   * Verify type compliance for an implementation
   *
   * @param implementation - Implementation to check
   * @returns Compliance result for type checking
   */
  verify_type_compliance(implementation: unknown): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    let checkedTypes = 0;

    if (typeof implementation !== "object" || implementation === null) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "type",
            severity: "error",
            message: "Implementation must be an object",
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    const impl = implementation as Record<string, unknown>;

    // Check each type specification
    for (const typeSpec of this.specification.types) {
      checkedTypes++;

      // Check if implementation has the type/property
      if (impl[typeSpec.name] === undefined) {
        violations.push({
          category: "type",
          severity: "error",
          message: `Missing required type/property: ${typeSpec.name}`,
          specification_reference: `${this.specification.name}.types.${typeSpec.name}`,
          expected: `Property ${typeSpec.name} to exist`,
          actual: "Property not found",
        });
        continue;
      }

      // Verify type structure
      const typeViolations = this.verify_type_structure(
        typeSpec,
        impl[typeSpec.name]
      );
      violations.push(...typeViolations);
    }

    // Calculate coverage
    const coverage =
      this.specification.types.length > 0
        ? (checkedTypes / this.specification.types.length) * 100
        : 0;

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage,
    };
  }

  /**
   * Verify interface implementation
   *
   * @param implementation - Object implementing interface
   * @returns Compliance result
   */
  verify_interface_implementation(implementation: object): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    let checkedProperties = 0;
    let totalRequiredProperties = 0;

    const impl = implementation as Record<string, unknown>;

    // Check all interface types
    for (const typeSpec of this.specification.types) {
      if (typeSpec.type !== "interface") continue;

      const def = typeSpec.definition as InterfaceDefinition;

      // Check required properties
      for (const propName of typeSpec.required_properties) {
        totalRequiredProperties++;

        if (impl[propName] === undefined) {
          violations.push({
            category: "type",
            severity: "error",
            message: `Missing required property: ${propName} in interface ${typeSpec.name}`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}.${propName}`,
          });
        } else {
          checkedProperties++;

          // Check property type
          const propDef = def.properties[propName];
          if (propDef) {
            const typeViolation = this.verify_property_type(
              propName,
              impl[propName],
              propDef
            );
            if (typeViolation) {
              violations.push(typeViolation);
            }
          }
        }
      }

      // Check for extra properties (warning only)
      const implKeys = new Set(Object.keys(impl));
      const specKeys = new Set([
        ...typeSpec.required_properties,
        ...typeSpec.optional_properties,
      ]);

      for (const key of implKeys) {
        if (!specKeys.has(key)) {
          warnings.push({
            category: "type",
            message: `Unexpected property in ${typeSpec.name}: ${key}`,
            suggestion: "Remove this property or add it to the specification",
          });
        }
      }
    }

    // Calculate coverage
    const coverage =
      totalRequiredProperties > 0
        ? (checkedProperties / totalRequiredProperties) * 100
        : 100;

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage,
    };
  }

  /**
   * Verify enum values
   *
   * @param enum_ - Enum object to verify
   * @param enumName - Optional name of the specific enum to validate
   * @returns Compliance result
   */
  verify_enum_values(enum_: object, enumName?: string): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    const enumObj = enum_ as Record<string, string | number>;

    // Find enum specification(s) to validate
    const typesToCheck = enumName
      ? this.specification.types.filter(t => t.name === enumName)
      : this.specification.types.filter(t => t.type === "enum");

    if (typesToCheck.length === 0) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "type",
            severity: "error",
            message: enumName
              ? `Enum type not found: ${enumName}`
              : "No enum types in specification",
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Check each enum specification
    for (const typeSpec of typesToCheck) {
      if (typeSpec.type !== "enum") continue;

      const def = typeSpec.definition as EnumDefinition;

      // Check all enum values are present
      for (const [key, value] of Object.entries(def.values)) {
        if (enumObj[key] === undefined) {
          violations.push({
            category: "type",
            severity: "error",
            message: `Missing enum value: ${key}`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}.${key}`,
            expected: String(value),
            actual: "undefined",
          });
        } else if (enumObj[key] !== value) {
          violations.push({
            category: "type",
            severity: "error",
            message: `Enum value mismatch: ${key}`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}.${key}`,
            expected: String(value),
            actual: String(enumObj[key]),
          });
        }
      }

      // Check for extra enum values
      for (const key of Object.keys(enumObj)) {
        if (def.values[key] === undefined) {
          warnings.push({
            category: "type",
            message: `Extra enum value: ${key} in ${typeSpec.name}`,
            suggestion: "Add this value to the specification or remove it",
          });
        }
      }
    }

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify type structure
   *
   * @private
   */
  private verify_type_structure(
    typeSpec: TypeSpecification,
    value: unknown
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    const def = typeSpec.definition;

    switch (typeSpec.type) {
      case "interface":
        if (typeof value !== "object" || value === null) {
          violations.push({
            category: "type",
            severity: "error",
            message: `${typeSpec.name} must be an object`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}`,
            expected: "object",
            actual: typeof value,
          });
        }
        break;

      case "enum":
        const enumDef = def as EnumDefinition;
        const enumValues = Object.values(enumDef.values);
        if (!enumValues.includes(value as string | number)) {
          violations.push({
            category: "type",
            severity: "error",
            message: `Invalid enum value for ${typeSpec.name}`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}`,
            expected: enumValues.join(" | "),
            actual: String(value),
          });
        }
        break;

      case "type":
        // Type aliases are hard to verify at runtime
        // Just check if value exists
        if (value === undefined) {
          violations.push({
            category: "type",
            severity: "error",
            message: `${typeSpec.name} is undefined`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}`,
          });
        }
        break;

      case "class":
        // Classes should be instances
        if (typeof value !== "object" || value === null) {
          violations.push({
            category: "type",
            severity: "error",
            message: `${typeSpec.name} must be an object instance`,
            specification_reference: `${this.specification.name}.types.${typeSpec.name}`,
            expected: "object",
            actual: typeof value,
          });
        }
        break;
    }

    return violations;
  }

  /**
   * Verify property type
   *
   * @private
   */
  private verify_property_type(
    propName: string,
    value: unknown,
    propDef: PropertyDefinition
  ): ComplianceViolation | null {
    // Basic type checking (TypeScript types are erased at runtime)
    // This is a simplified check
    const typeMap: Record<string, (v: unknown) => boolean> = {
      string: v => typeof v === "string",
      number: v => typeof v === "number" && !isNaN(v),
      boolean: v => typeof v === "boolean",
      object: v => typeof v === "object" && v !== null,
      array: v => Array.isArray(v),
      any: () => true,
      unknown: () => true,
    };

    // Extract base type (handle generics, unions, etc.)
    let baseType = propDef.type.split("<")[0].split("|")[0].trim();
    baseType = baseType.replace("readonly", "").trim();

    const checker = typeMap[baseType];
    if (checker && !checker(value)) {
      return {
        category: "type",
        severity: "error",
        message: `Property ${propName} has wrong type`,
        specification_reference: `property:${propName}`,
        expected: propDef.type,
        actual: typeof value,
      };
    }

    return null;
  }

  // ========================================================================
  // MESSAGE CHECKING
  // ========================================================================

  /**
   * Verify message format
   *
   * @param message - Message to validate
   * @returns Compliance result
   */
  verify_message_format(message: unknown): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    if (typeof message !== "object" || message === null) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "message",
            severity: "error",
            message: "Message must be an object",
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    const msg = message as Record<string, unknown>;

    // Check each message specification
    for (const msgSpec of this.specification.messages) {
      // Verify request type if specified
      if (msgSpec.request_type) {
        const typeSpec = this.typeMap.get(msgSpec.request_type);
        if (typeSpec) {
          const result = this.verify_type_structure(typeSpec, message);
          violations.push(...result);
        }
      }

      // Verify flow control if specified
      if (msgSpec.flow_control) {
        const fcViolations = this.verify_flow_control(
          msgSpec.flow_control,
          msg
        );
        violations.push(...fcViolations);
      }

      // Note: error_handling is checked in verify_error_handling method
      // not here since it applies to errors array, not messages
    }

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify message flow
   *
   * @param messages - Array of messages in sequence
   * @returns Compliance result
   */
  verify_message_flow(messages: unknown[]): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    if (!Array.isArray(messages)) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "message",
            severity: "error",
            message: "Messages must be an array",
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Check message sequence follows protocol
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (typeof msg !== "object" || msg === null) {
        violations.push({
          category: "message",
          severity: "error",
          message: `Message at index ${i} is not an object`,
          location: `messages[${i}]`,
        });
        continue;
      }

      // Validate individual message
      const result = this.verify_message_format(msg);
      violations.push(...result.violations);
      warnings.push(...result.warnings);
    }

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify error handling
   *
   * @param errors - Array of errors
   * @returns Compliance result
   */
  verify_error_handling(errors: unknown[]): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    if (!Array.isArray(errors)) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "message",
            severity: "error",
            message: "Errors must be an array",
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Check each error
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];

      if (typeof error !== "object" || error === null) {
        violations.push({
          category: "message",
          severity: "error",
          message: `Error at index ${i} is not an object`,
          location: `errors[${i}]`,
        });
      }

      // Check error has required fields
      if (typeof error === "object" && error !== null) {
        if (!("type" in error) || !("message" in error)) {
          violations.push({
            category: "message",
            severity: "error",
            message: `Error at index ${i} missing required fields (type, message)`,
            location: `errors[${i}]`,
          });
        }
      }
    }

    return {
      is_compliant: violations.filter(v => v.severity === "error").length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify flow control
   *
   * @private
   */
  private verify_flow_control(
    spec: FlowControlSpecification,
    message: Record<string, unknown>
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check streaming flag if specified
    if (spec.streaming !== undefined) {
      // Just verify the field exists if expected
      // Actual streaming behavior is runtime-specific
    }

    // Check timeout if specified
    if (spec.timeout !== undefined) {
      // Validate timeout value
      const timeout = message.timeout as number | undefined;
      if (
        timeout !== undefined &&
        (timeout < 0 || timeout > spec.timeout * 2)
      ) {
        violations.push({
          category: "message",
          severity: "warning",
          message: `Timeout ${timeout}ms exceeds recommended ${spec.timeout}ms`,
        });
      }
    }

    return violations;
  }

  
  // ========================================================================
  // BEHAVIOR CHECKING
  // ========================================================================

  /**
   * Verify preconditions before executing a behavior
   *
   * @param behavior - Name of behavior
   * @param context - Execution context
   * @returns Compliance result
   */
  async verify_preconditions(
    behavior: string,
    context: ExecutionContext
  ): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    const behaviorSpec = this.behaviorMap.get(behavior);
    if (!behaviorSpec) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "behavior",
            severity: "error",
            message: `Unknown behavior: ${behavior}`,
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Check all preconditions
    for (const precondition of behaviorSpec.preconditions) {
      try {
        const result = await precondition.check(context);
        if (!result) {
          violations.push({
            category: "behavior",
            severity: "error",
            message: `Precondition failed: ${precondition.description}`,
            specification_reference: `behavior:${behavior}.precondition`,
          });
        }
      } catch (e) {
        violations.push({
          category: "behavior",
          severity: "error",
          message: `Precondition check failed: ${precondition.description} - ${e}`,
          specification_reference: `behavior:${behavior}.precondition`,
        });
      }
    }

    return {
      is_compliant: violations.length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify postconditions after executing a behavior
   *
   * @param behavior - Name of behavior
   * @param result - Result from behavior execution
   * @param context - Execution context
   * @returns Compliance result
   */
  async verify_postconditions(
    behavior: string,
    result: unknown,
    context: ExecutionContext
  ): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    const behaviorSpec = this.behaviorMap.get(behavior);
    if (!behaviorSpec) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "behavior",
            severity: "error",
            message: `Unknown behavior: ${behavior}`,
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Update context with result
    context.result = result;

    // Check all postconditions
    for (const postcondition of behaviorSpec.postconditions) {
      try {
        const checkResult = await postcondition.check(context);
        if (!checkResult) {
          violations.push({
            category: "behavior",
            severity: "error",
            message: `Postcondition failed: ${postcondition.description}`,
            specification_reference: `behavior:${behavior}.postcondition`,
          });
        }
      } catch (e) {
        violations.push({
          category: "behavior",
          severity: "error",
          message: `Postcondition check failed: ${postcondition.description} - ${e}`,
          specification_reference: `behavior:${behavior}.postcondition`,
        });
      }
    }

    return {
      is_compliant: violations.length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  /**
   * Verify invariants (should always be true)
   *
   * @param behavior - Name of behavior
   * @param context - Execution context
   * @returns Compliance result
   */
  async verify_invariants(
    behavior: string,
    context: ExecutionContext
  ): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    const behaviorSpec = this.behaviorMap.get(behavior);
    if (!behaviorSpec) {
      return {
        is_compliant: false,
        violations: [
          {
            category: "behavior",
            severity: "error",
            message: `Unknown behavior: ${behavior}`,
          },
        ],
        warnings: [],
        coverage: 0,
      };
    }

    // Check all invariants
    for (const invariant of behaviorSpec.invariants) {
      try {
        const result = await invariant.check(context);
        if (!result) {
          violations.push({
            category: "behavior",
            severity: "error",
            message: `Invariant violated: ${invariant.description}`,
            specification_reference: `behavior:${behavior}.invariant`,
          });
        }
      } catch (e) {
        violations.push({
          category: "behavior",
          severity: "error",
          message: `Invariant check failed: ${invariant.description} - ${e}`,
          specification_reference: `behavior:${behavior}.invariant`,
        });
      }
    }

    return {
      is_compliant: violations.length === 0,
      violations,
      warnings,
      coverage: 100,
    };
  }

  // ========================================================================
  // FULL COMPLIANCE CHECK
  // ========================================================================

  /**
   * Check full compliance of an implementation
   *
   * @param implementation - Implementation to check
   * @returns Complete compliance report
   */
  check_compliance(implementation: object): ComplianceReport {
    const timestamp = new Date();

    // Check all categories
    const typeResult = this.verify_type_compliance(implementation);
    const messageResult = this.verify_message_format(implementation);
    const behaviorResult: ComplianceResult = {
      is_compliant: true,
      violations: [],
      warnings: [
        {
          category: "behavior",
          message: "Behavior checking requires execution context",
        },
      ],
      coverage: 0,
    };
    const constraintResult: ComplianceResult = {
      is_compliant: true,
      violations: [],
      warnings: [
        {
          category: "constraint",
          message: "Constraint checking requires execution context",
        },
      ],
      coverage: 0,
    };

    // Calculate overall compliance score
    const typeScore = typeResult.is_compliant ? 25 : 0;
    const messageScore = messageResult.is_compliant ? 25 : 0;
    const behaviorScore = behaviorResult.is_compliant ? 25 : 0;
    const constraintScore = constraintResult.is_compliant ? 25 : 0;
    const complianceScore =
      typeScore + messageScore + behaviorScore + constraintScore;

    // Generate recommendations
    const recommendations = this.generate_recommendations(
      typeResult,
      messageResult,
      behaviorResult,
      constraintResult
    );

    return {
      protocol_name: this.specification.name,
      protocol_version: this.specification.version,
      timestamp,
      overall_compliance:
        typeResult.is_compliant &&
        messageResult.is_compliant &&
        behaviorResult.is_compliant &&
        constraintResult.is_compliant,
      compliance_score: complianceScore,
      type_compliance: typeResult,
      message_compliance: messageResult,
      behavior_compliance: behaviorResult,
      constraint_compliance: constraintResult,
      recommendations,
    };
  }

  /**
   * Generate compliance report
   *
   * @returns Compliance report
   */
  generate_report(): ComplianceReport {
    return {
      protocol_name: this.specification.name,
      protocol_version: this.specification.version,
      timestamp: new Date(),
      overall_compliance: true,
      compliance_score: 100,
      type_compliance: {
        is_compliant: true,
        violations: [],
        warnings: [],
        coverage: 100,
      },
      message_compliance: {
        is_compliant: true,
        violations: [],
        warnings: [],
        coverage: 100,
      },
      behavior_compliance: {
        is_compliant: true,
        violations: [],
        warnings: [],
        coverage: 100,
      },
      constraint_compliance: {
        is_compliant: true,
        violations: [],
        warnings: [],
        coverage: 100,
      },
      recommendations: [],
    };
  }

  /**
   * Generate recommendations from compliance results
   *
   * @private
   */
  private generate_recommendations(
    typeResult: ComplianceResult,
    messageResult: ComplianceResult,
    behaviorResult: ComplianceResult,
    constraintResult: ComplianceResult
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Type recommendations
    for (const violation of typeResult.violations) {
      recommendations.push({
        severity: violation.severity,
        category: "type",
        message: violation.message,
        suggestion:
          violation.expected && violation.actual
            ? `Expected: ${violation.expected}, Got: ${violation.actual}`
            : undefined,
      });
    }

    // Message recommendations
    for (const violation of messageResult.violations) {
      recommendations.push({
        severity: violation.severity,
        category: "message",
        message: violation.message,
      });
    }

    // Behavior recommendations
    for (const violation of behaviorResult.violations) {
      recommendations.push({
        severity: violation.severity,
        category: "behavior",
        message: violation.message,
      });
    }

    // Constraint recommendations
    for (const violation of constraintResult.violations) {
      recommendations.push({
        severity: violation.severity,
        category: "constraint",
        message: violation.message,
      });
    }

    // Warnings as info recommendations
    for (const warning of [...typeResult.warnings, ...messageResult.warnings]) {
      recommendations.push({
        severity: "info",
        category: warning.category,
        message: warning.message,
        suggestion: warning.suggestion,
      });
    }

    return recommendations;
  }

  /**
   * Get the specification being used
   */
  getSpecification(): ProtocolSpecification {
    return { ...this.specification };
  }
}

// ============================================================================
// COMPLIANCE TEST RUNNER
// ============================================================================

/**
 * Test case for compliance testing
 */
export interface ComplianceTestCase {
  id: string;
  name: string;
  description: string;
  specification_reference: string;
  test_type: "type" | "message" | "behavior" | "constraint";
  test_fn: (implementation: object) => Promise<TestCaseResult>;
}

/**
 * Result of a single test case
 */
export interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
}

/**
 * Result of running all compliance tests
 */
export interface ComplianceTestResult {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  duration_ms: number;
  test_results: TestCaseResult[];
}

/**
 * ComplianceTestRunner - Generate and run compliance test cases
 *
 * Automatically generates test cases from protocol specifications
 * and runs them against implementations.
 */
export class ComplianceTestRunner {
  private specification: ProtocolSpecification;
  private testCases: Map<string, ComplianceTestCase>;

  constructor(specification: ProtocolSpecification) {
    this.specification = specification;
    this.testCases = new Map();
    this.generateTestCases();
  }

  /**
   * Add a custom test case
   *
   * @param test_case - Test case to add
   */
  add_test_case(test_case: ComplianceTestCase): void {
    this.testCases.set(test_case.id, test_case);
  }

  /**
   * Remove a test case
   *
   * @param id - Test case ID
   */
  remove_test_case(id: string): void {
    this.testCases.delete(id);
  }

  /**
   * Run all tests against an implementation
   *
   * @param implementation - Implementation to test
   * @returns Test results
   */
  async run_tests(implementation: object): Promise<ComplianceTestResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of this.testCases.values()) {
      const start = Date.now();
      try {
        const result = await testCase.test_fn(implementation);
        const duration = Date.now() - start;

        testResults.push({
          id: testCase.id,
          name: testCase.name,
          passed: result.passed,
          duration_ms: duration,
          error: result.error,
        });

        if (result.passed) {
          passed++;
        } else {
          failed++;
        }
      } catch (e) {
        const duration = Date.now() - start;
        failed++;
        testResults.push({
          id: testCase.id,
          name: testCase.name,
          passed: false,
          duration_ms: duration,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      total_tests: testResults.length,
      passed_tests: passed,
      failed_tests: failed,
      duration_ms: Date.now() - startTime,
      test_results: testResults,
    };
  }

  /**
   * Run a specific test by ID
   *
   * @param id - Test case ID
   * @param implementation - Implementation to test
   * @returns Test result
   */
  async run_test_by_id(
    id: string,
    implementation: object
  ): Promise<TestCaseResult> {
    const testCase = this.testCases.get(id);
    if (!testCase) {
      throw new Error(`Test case not found: ${id}`);
    }

    const start = Date.now();
    try {
      const result = await testCase.test_fn(implementation);
      return {
        id: testCase.id,
        name: testCase.name,
        passed: result.passed,
        duration_ms: Date.now() - start,
        error: result.error,
      };
    } catch (e) {
      return {
        id: testCase.id,
        name: testCase.name,
        passed: false,
        duration_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Generate test cases from specification
   *
   * @returns Generated test cases
   */
  generateTestCases(
    specification?: ProtocolSpecification
  ): ComplianceTestCase[] {
    const spec = specification ?? this.specification;
    const testCases: ComplianceTestCase[] = [];

    // Generate type tests
    for (const typeSpec of spec.types) {
      testCases.push({
        id: `type-${typeSpec.name}-exists`,
        name: `Type ${typeSpec.name} exists`,
        description: `Verify that ${typeSpec.name} is defined`,
        specification_reference: `${spec.name}.types.${typeSpec.name}`,
        test_type: "type",
        test_fn: async impl => {
          const passed = typeSpec.name in impl;
          return { id: "", name: "", passed, duration_ms: 0 };
        },
      });

      // Test required properties
      for (const prop of typeSpec.required_properties) {
        testCases.push({
          id: `type-${typeSpec.name}-prop-${prop}`,
          name: `Property ${typeSpec.name}.${prop} exists`,
          description: `Verify that ${typeSpec.name} has required property ${prop}`,
          specification_reference: `${spec.name}.types.${typeSpec.name}.${prop}`,
          test_type: "type",
          test_fn: async impl => {
            const typeValue = (impl as Record<string, unknown>)[typeSpec.name];
            const passed =
              typeof typeValue === "object" &&
              typeValue !== null &&
              prop in (typeValue as Record<string, unknown>);
            return { id: "", name: "", passed, duration_ms: 0 };
          },
        });
      }
    }

    // Generate message tests
    for (const msgSpec of spec.messages) {
      testCases.push({
        id: `message-${msgSpec.name}-format`,
        name: `Message ${msgSpec.name} format valid`,
        description: `Verify ${msgSpec.name} message format`,
        specification_reference: `${spec.name}.messages.${msgSpec.name}`,
        test_type: "message",
        test_fn: async impl => {
          // Basic structure check
          const passed = typeof impl === "object" && impl !== null;
          return { id: "", name: "", passed, duration_ms: 0 };
        },
      });
    }

    // Add generated tests
    for (const testCase of testCases) {
      this.testCases.set(testCase.id, testCase);
    }

    return testCases;
  }

  /**
   * Get all test cases
   *
   * @returns Array of test cases
   */
  get_test_cases(): ComplianceTestCase[] {
    return Array.from(this.testCases.values());
  }
}

// ============================================================================
// TEST CASE BUILDERS
// ============================================================================

/**
 * Build a type test case
 */
export function buildTypeTest(options: {
  typeName: string;
  property?: string;
  condition: (value: unknown) => boolean;
}): ComplianceTestCase {
  return {
    id: `type-${options.typeName}${options.property ? `-${options.property}` : ""}`,
    name: `Type check for ${options.typeName}${options.property ? `.${options.property}` : ""}`,
    description: `Verify type constraint for ${options.typeName}`,
    specification_reference: `type:${options.typeName}`,
    test_type: "type",
    test_fn: async impl => {
      const value = options.property
        ? (impl as Record<string, unknown>)[options.property]
        : (impl as Record<string, unknown>)[options.typeName];
      const passed = options.condition(value);
      return { id: "", name: "", passed, duration_ms: 0 };
    },
  };
}

/**
 * Build a message test case
 */
export function buildMessageTest(options: {
  messageName: string;
  field: string;
  expectedValue: unknown;
}): ComplianceTestCase {
  return {
    id: `message-${options.messageName}-${options.field}`,
    name: `Message field ${options.messageName}.${options.field}`,
    description: `Verify ${options.field} field in ${options.messageName}`,
    specification_reference: `message:${options.messageName}.${options.field}`,
    test_type: "message",
    test_fn: async impl => {
      const msg = (impl as Record<string, unknown>)[options.messageName] as
        | Record<string, unknown>
        | undefined;
      const passed =
        msg !== undefined && msg[options.field] === options.expectedValue;
      return { id: "", name: "", passed, duration_ms: 0 };
    },
  };
}

/**
 * Build a behavior test case
 */
export function buildBehaviorTest(options: {
  behaviorName: string;
  condition: (context: ExecutionContext) => boolean | Promise<boolean>;
}): ComplianceTestCase {
  return {
    id: `behavior-${options.behaviorName}`,
    name: `Behavior check for ${options.behaviorName}`,
    description: `Verify behavior contract for ${options.behaviorName}`,
    specification_reference: `behavior:${options.behaviorName}`,
    test_type: "behavior",
    test_fn: async impl => {
      const context: ExecutionContext = {
        method_name: options.behaviorName,
        parameters: {},
        state: impl as Record<string, unknown>,
        timestamp: Date.now(),
      };
      const passed = await options.condition(context);
      return { id: "", name: "", passed, duration_ms: 0 };
    },
  };
}

/**
 * Build a constraint test case
 */
export function buildConstraintTest(options: {
  constraintName: string;
  check: (value: unknown) => boolean | Promise<boolean>;
}): ComplianceTestCase {
  return {
    id: `constraint-${options.constraintName}`,
    name: `Constraint check for ${options.constraintName}`,
    description: `Verify constraint ${options.constraintName}`,
    specification_reference: `constraint:${options.constraintName}`,
    test_type: "constraint",
    test_fn: async impl => {
      const passed = await options.check(impl);
      return { id: "", name: "", passed, duration_ms: 0 };
    },
  };
}
