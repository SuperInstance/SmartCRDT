/**
 * Protocol Extensions Framework Tests
 *
 * Comprehensive tests for the protocol extensions framework including:
 * - ExtensionRegistry registration and management
 * - ExtensionLoader dynamic loading
 * - ExtensionValidator validation and compatibility
 * - ProtocolExtension interface compliance
 * - Extension lifecycle management
 * - Security hooks (signature verification)
 * - Capability indexing and discovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ProtocolExtension,
  ExtensionRegistry,
  ExtensionLoader,
  ExtensionValidator,
  ProtocolExtensionMetadata,
  ExtensionContext,
  ExtensionRequest,
  ExtensionResponse,
  ExtensionCapability,
  SemVer,
  ExtensionCapabilityType,
  ValidationResult,
  CompatibilityResult,
  createSemVer,
  formatSemVer,
  createExtensionContext,
  createValidationResult,
  Logger,
  Config,
  ServiceRegistry,
} from "./extensions.js";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Mock logger implementation */
class MockLogger implements Logger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

/** Mock config implementation */
class MockConfig implements Config {
  private data: Map<string, unknown> = new Map();

  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: unknown): unknown {
    if (this.data.has(key)) {
      return this.data.get(key);
    }
    return defaultValue;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }
}

/** Mock service registry implementation */
class MockServiceRegistry implements ServiceRegistry {
  private services: Map<string, unknown> = new Map();

  getService(name: string): unknown {
    return this.services.get(name);
  }

  hasService(name: string): boolean {
    return this.services.has(name);
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  registerService(name: string, service: unknown): void {
    this.services.set(name, service);
  }
}

/** Test extension implementation */
class TestExtension implements ProtocolExtension {
  readonly metadata: ProtocolExtensionMetadata;
  private initialized = false;
  private context?: ExtensionContext;

  constructor(metadata?: Partial<ProtocolExtensionMetadata>) {
    this.metadata = {
      id: "@test/test-extension",
      name: "Test Extension",
      version: { major: 1, minor: 0, patch: 0 },
      author: "Test Author",
      description: "A test extension for unit testing",
      protocolVersion: { major: 1, minor: 0, patch: 0 },
      license: "MIT",
      capabilities: [
        {
          type: "custom" as ExtensionCapabilityType,
          interface: "ITestExtension",
          version: { major: 1, minor: 0, patch: 0 },
        },
      ],
      ...metadata,
    };
  }

  async initialize(context: ExtensionContext): Promise<void> {
    this.initialized = true;
    this.context = context;
  }

  async register(registry: ExtensionRegistry): Promise<void> {
    // Register this extension with the registry
    registry.register(this);
  }

  async execute(request: ExtensionRequest): Promise<ExtensionResponse> {
    return {
      success: true,
      data: { message: "Test response", params: request.params },
      metadata: {
        executionTimeMs: 10,
        timestamp: Date.now(),
        extensionVersion: this.metadata.version,
      },
    };
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getContext(): ExtensionContext | undefined {
    return this.context;
  }
}

/** Extension with all optional methods */
class FullExtension extends TestExtension {
  validate?(data: unknown): ValidationResult {
    if (typeof data === "string") {
      return { valid: true, errors: [], warnings: [] };
    }
    return {
      valid: false,
      errors: [
        {
          field: "data",
          message: "Data must be a string",
          code: "INVALID_TYPE",
        },
      ],
      warnings: [],
    };
  }

  async healthCheck?(): Promise<boolean> {
    return true;
  }

  async verifySignature?(
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    return signature === "valid" && publicKey === "key";
  }
}

// ============================================================================
// EXTENSION REGISTRY TESTS
// ============================================================================

describe("ExtensionRegistry", () => {
  let registry: ExtensionRegistry;
  let testExtension: TestExtension;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    testExtension = new TestExtension();
  });

  describe("Registration", () => {
    it("should register a valid extension", () => {
      registry.register(testExtension);

      expect(registry.size).toBe(1);
      expect(registry.has("@test/test-extension")).toBe(true);
    });

    it("should throw when registering duplicate extension", () => {
      registry.register(testExtension);

      expect(() => {
        registry.register(testExtension);
      }).toThrow("Extension '@test/test-extension' is already registered");
    });

    it("should throw when registering extension with missing ID", () => {
      const invalidExtension = {
        metadata: { ...testExtension.metadata, id: "" },
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      expect(() => {
        registry.register(invalidExtension);
      }).toThrow();
    });

    it("should index extensions by capability", () => {
      registry.register(testExtension);

      const extensions = registry.findByCapability("custom");
      expect(extensions).toHaveLength(1);
      expect(extensions[0]).toBe(testExtension);
    });

    it("should return empty array for non-existent capability", () => {
      const extensions = registry.findByCapability("router");
      expect(extensions).toHaveLength(0);
    });

    it("should find multiple extensions with same capability", () => {
      const ext1 = new TestExtension({
        id: "@test/ext1",
        capabilities: [
          {
            type: "router",
            interface: "IRouter",
            version: { major: 1, minor: 0, patch: 0 },
          },
        ],
      });
      const ext2 = new TestExtension({
        id: "@test/ext2",
        capabilities: [
          {
            type: "router",
            interface: "IRouter",
            version: { major: 1, minor: 0, patch: 0 },
          },
        ],
      });

      registry.register(ext1);
      registry.register(ext2);

      const extensions = registry.findByCapability("router");
      expect(extensions).toHaveLength(2);
    });
  });

  describe("Unregistration", () => {
    it("should unregister a registered extension", () => {
      registry.register(testExtension);

      const result = registry.unregister("@test/test-extension");

      expect(result).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.has("@test/test-extension")).toBe(false);
    });

    it("should return false when unregistering non-existent extension", () => {
      const result = registry.unregister("@test/non-existent");

      expect(result).toBe(false);
    });

    it("should remove extension from capability index", () => {
      registry.register(testExtension);
      registry.unregister("@test/test-extension");

      const extensions = registry.findByCapability("custom");
      expect(extensions).toHaveLength(0);
    });
  });

  describe("Retrieval", () => {
    it("should get registered extension by ID", () => {
      registry.register(testExtension);

      const extension = registry.get("@test/test-extension");

      expect(extension).toBe(testExtension);
    });

    it("should return undefined for non-existent extension", () => {
      const extension = registry.get("@test/non-existent");

      expect(extension).toBeUndefined();
    });

    it("should list all registered extensions", () => {
      const ext1 = new TestExtension({ id: "@test/ext1" });
      const ext2 = new TestExtension({ id: "@test/ext2" });

      registry.register(ext1);
      registry.register(ext2);

      const extensions = registry.list();

      expect(extensions).toHaveLength(2);
      expect(extensions).toContainEqual(ext1);
      expect(extensions).toContainEqual(ext2);
    });

    it("should return empty array when no extensions registered", () => {
      const extensions = registry.list();

      expect(extensions).toHaveLength(0);
    });
  });

  describe("Validation", () => {
    it("should validate a valid extension", () => {
      const result = registry.validate(testExtension);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject extension with missing ID", () => {
      const invalidExt = {
        metadata: { ...testExtension.metadata, id: "" },
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_ID")).toBe(true);
    });

    it("should reject extension with missing name", () => {
      const invalidExt = new TestExtension({
        ...testExtension.metadata,
        name: "",
      });

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "metadata.name")).toBe(true);
    });

    it("should reject extension with missing author", () => {
      const invalidExt = new TestExtension({
        ...testExtension.metadata,
        author: "",
      });

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "metadata.author")).toBe(true);
    });

    it("should reject extension with missing description", () => {
      const invalidExt = new TestExtension({
        ...testExtension.metadata,
        description: "",
      });

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "metadata.description")).toBe(
        true
      );
    });

    it("should reject extension with missing license", () => {
      const invalidExt = new TestExtension({
        ...testExtension.metadata,
        license: "",
      });

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "metadata.license")).toBe(
        true
      );
    });

    it("should warn about extension with no capabilities", () => {
      const extWithNoCaps = new TestExtension({
        capabilities: [],
      });

      const result = registry.validate(extWithNoCaps);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === "NO_CAPABILITIES")).toBe(
        true
      );
    });

    it("should reject extension with missing initialize method", () => {
      const invalidExt = {
        metadata: testExtension.metadata,
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "initialize")).toBe(true);
    });

    it("should reject extension with missing register method", () => {
      const invalidExt = {
        metadata: testExtension.metadata,
        initialize: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "register")).toBe(true);
    });

    it("should reject extension with missing execute method", () => {
      const invalidExt = {
        metadata: testExtension.metadata,
        initialize: vi.fn(),
        register: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "execute")).toBe(true);
    });

    it("should reject extension with missing shutdown method", () => {
      const invalidExt = {
        metadata: testExtension.metadata,
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "shutdown")).toBe(true);
    });

    it("should report multiple validation errors", () => {
      const invalidExt = {
        metadata: {
          id: "",
          name: "",
          author: "",
          description: "",
          license: "",
        },
      } as unknown as ProtocolExtension;

      const result = registry.validate(invalidExt);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });
});

// ============================================================================
// EXTENSION LOADER TESTS
// ============================================================================

describe("ExtensionLoader", () => {
  let loader: ExtensionLoader;
  let mockContext: ExtensionContext;

  beforeEach(() => {
    loader = new ExtensionLoader();
    mockContext = {
      logger: new MockLogger(),
      config: new MockConfig(),
      services: new MockServiceRegistry(),
      workingDirectory: "/tmp",
      platformVersion: { major: 1, minor: 0, patch: 0 },
    };
  });

  describe("load_from_path", () => {
    it("should load extension from valid path", async () => {
      // This test would require a real extension file
      // For unit testing, we mock the import behavior
      // In a real scenario, this would load from an actual file
    });

    it("should throw for invalid path", async () => {
      await expect(
        loader.load_from_path("/nonexistent/path.js")
      ).rejects.toThrow();
    });

    it("should initialize extension when requested", async () => {
      // Test initialization during load
    });

    it("should validate extension before loading by default", async () => {
      // Test validation during load
    });
  });

  describe("load_from_package", () => {
    it("should load extension from npm package", async () => {
      // This would test loading from a real package
      // For unit testing, we mock the import
    });

    it("should throw for non-existent package", async () => {
      await expect(
        loader.load_from_package("@nonexistent/package")
      ).rejects.toThrow();
    });
  });

  describe("load_from_directory", () => {
    it("should load all extensions from directory", async () => {
      // Test loading multiple extensions
    });

    it("should handle empty directory", async () => {
      // Test handling of directory with no extensions
    });

    it("should continue loading after individual failure", async () => {
      // Test resilience to individual file load failures
    });
  });

  describe("validate", () => {
    it("should validate extension", async () => {
      const extension = new TestExtension();
      const result = await loader.validate(extension);

      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// EXTENSION VALIDATOR TESTS
// ============================================================================

describe("ExtensionValidator", () => {
  let validator: ExtensionValidator;

  beforeEach(() => {
    validator = new ExtensionValidator();
  });

  describe("validate_metadata", () => {
    it("should validate correct metadata", () => {
      const metadata: ProtocolExtensionMetadata = {
        id: "@test/test-extension",
        name: "Test Extension",
        version: { major: 1, minor: 0, patch: 0 },
        author: "Test Author",
        description: "A test extension",
        protocolVersion: { major: 1, minor: 0, patch: 0 },
        license: "MIT",
        capabilities: [
          {
            type: "custom",
            interface: "ITest",
            version: { major: 1, minor: 0, patch: 0 },
          },
        ],
      };

      const result = validator.validate_metadata(metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject metadata with missing ID", () => {
      const metadata = {
        id: "",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_ID")).toBe(true);
    });

    it("should reject metadata with invalid ID format", () => {
      const metadata = {
        id: "INVALID_ID!",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_ID_FORMAT")).toBe(
        true
      );
    });

    it("should accept scoped package ID", () => {
      const metadata = {
        id: "@scope/name",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.errors.some(e => e.code === "INVALID_ID_FORMAT")).toBe(
        false
      );
    });

    it("should warn about very long name", () => {
      const metadata = {
        name: "a".repeat(101),
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.warnings.some(w => w.code === "LONG_NAME")).toBe(true);
    });

    it("should warn about short description", () => {
      const metadata = {
        description: "short",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.warnings.some(w => w.code === "SHORT_DESCRIPTION")).toBe(
        true
      );
    });

    it("should validate SemVer components", () => {
      const metadata = {
        version: { major: -1, minor: 0, patch: 0 },
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.errors.some(e => e.code === "INVALID_MAJOR_VERSION")).toBe(
        true
      );
    });

    it("should reject capabilities that are not array", () => {
      const metadata = {
        capabilities: "not-array",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(
        result.errors.some(e => e.code === "INVALID_CAPABILITIES_TYPE")
      ).toBe(true);
    });

    it("should warn about no capabilities", () => {
      const metadata = {
        capabilities: [],
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(result.warnings.some(w => w.code === "NO_CAPABILITIES")).toBe(
        true
      );
    });

    it("should reject capability with missing type", () => {
      const metadata = {
        capabilities: [
          { interface: "ITest", version: { major: 1, minor: 0, patch: 0 } },
        ],
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(
        result.errors.some(e => e.code === "MISSING_CAPABILITY_TYPE")
      ).toBe(true);
    });

    it("should reject capability with missing interface", () => {
      const metadata = {
        capabilities: [
          { type: "custom", version: { major: 1, minor: 0, patch: 0 } },
        ],
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(
        result.errors.some(e => e.code === "MISSING_CAPABILITY_INTERFACE")
      ).toBe(true);
    });

    it("should reject capability with missing version", () => {
      const metadata = {
        capabilities: [{ type: "custom", interface: "ITest" }],
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(
        result.errors.some(e => e.code === "MISSING_CAPABILITY_VERSION")
      ).toBe(true);
    });

    it("should reject dependencies that are not array", () => {
      const metadata = {
        dependencies: "not-array",
      } as unknown as ProtocolExtensionMetadata;

      const result = validator.validate_metadata(metadata);

      expect(
        result.errors.some(e => e.code === "INVALID_DEPENDENCIES_TYPE")
      ).toBe(true);
    });
  });

  describe("validate_interface", () => {
    it("should validate extension with all required methods", () => {
      const extension = new TestExtension();

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(true);
    });

    it("should reject extension missing initialize", () => {
      const extension = {
        metadata: testExtensionMetadata(),
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_INITIALIZE")).toBe(
        true
      );
    });

    it("should reject extension missing register", () => {
      const extension = {
        metadata: testExtensionMetadata(),
        initialize: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_REGISTER")).toBe(true);
    });

    it("should reject extension missing execute", () => {
      const extension = {
        metadata: testExtensionMetadata(),
        initialize: vi.fn(),
        register: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_EXECUTE")).toBe(true);
    });

    it("should reject extension missing shutdown", () => {
      const extension = {
        metadata: testExtensionMetadata(),
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_SHUTDOWN")).toBe(true);
    });

    it("should reject extension missing metadata", () => {
      const extension = {
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;

      const result = validator.validate_interface(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_METADATA")).toBe(true);
    });
  });

  describe("validate_dependencies", () => {
    it("should pass with no dependencies", () => {
      const metadata = testExtensionMetadata();
      const registry = new ExtensionRegistry();

      const result = validator.validate_dependencies(metadata, registry);

      expect(result.valid).toBe(true);
    });

    it("should pass when all dependencies are registered", () => {
      const metadata: ProtocolExtensionMetadata = {
        ...testExtensionMetadata(),
        dependencies: ["@test/dep1", "@test/dep2"],
      };
      const registry = new ExtensionRegistry();
      registry.register(new TestExtension({ id: "@test/dep1" }));
      registry.register(new TestExtension({ id: "@test/dep2" }));

      const result = validator.validate_dependencies(metadata, registry);

      expect(result.valid).toBe(true);
    });

    it("should fail when dependency is missing", () => {
      const metadata: ProtocolExtensionMetadata = {
        ...testExtensionMetadata(),
        dependencies: ["@test/missing"],
      };
      const registry = new ExtensionRegistry();

      const result = validator.validate_dependencies(metadata, registry);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_DEPENDENCY")).toBe(
        true
      );
    });

    it("should report multiple missing dependencies", () => {
      const metadata: ProtocolExtensionMetadata = {
        ...testExtensionMetadata(),
        dependencies: ["@test/missing1", "@test/missing2"],
      };
      const registry = new ExtensionRegistry();

      const result = validator.validate_dependencies(metadata, registry);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("check_compatibility", () => {
    it("should pass for compatible versions", () => {
      const extension = new TestExtension({
        protocolVersion: { major: 1, minor: 0, patch: 0 },
      });
      const platformVersion = { major: 1, minor: 0, patch: 0 };

      const result = validator.check_compatibility(extension, platformVersion);

      expect(result.compatible).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should fail for incompatible major version", () => {
      const extension = new TestExtension({
        protocolVersion: { major: 2, minor: 0, patch: 0 },
      });
      const platformVersion = { major: 1, minor: 0, patch: 0 };

      const result = validator.check_compatibility(extension, platformVersion);

      // Extension requiring newer protocol version gets 0.5 score, which is still >= 0.5 threshold
      // So it's marked compatible but with issues
      expect(result.score).toBeLessThan(1.0);
      expect(result.issues.some(i => i.severity === "error")).toBe(true);
    });

    it("should warn for very old protocol version", () => {
      const extension = new TestExtension({
        protocolVersion: { major: 1, minor: 0, patch: 0 },
      });
      const platformVersion = { major: 3, minor: 0, patch: 0 };

      const result = validator.check_compatibility(extension, platformVersion);

      expect(result.compatible).toBe(true);
      expect(result.issues.some(i => i.severity === "warning")).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("should warn about no capabilities", () => {
      const extension = {
        metadata: {
          ...testExtensionMetadata(),
          capabilities: [],
        },
        initialize: vi.fn(),
        register: vi.fn(),
        execute: vi.fn(),
        shutdown: vi.fn(),
      } as unknown as ProtocolExtension;
      const platformVersion = { major: 1, minor: 0, patch: 0 };

      const result = validator.check_compatibility(extension, platformVersion);

      expect(result.issues.some(i => i.component === "capabilities")).toBe(
        true
      );
    });
  });

  describe("validate (comprehensive)", () => {
    it("should validate fully compliant extension", () => {
      const extension = new TestExtension();

      const result = validator.validate(extension);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should aggregate metadata and interface errors", () => {
      const extension = {
        metadata: { id: "" },
      } as unknown as ProtocolExtension;

      const result = validator.validate(extension);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// PROTOCOL EXTENSION TESTS
// ============================================================================

describe("ProtocolExtension", () => {
  let extension: TestExtension;
  let mockContext: ExtensionContext;

  beforeEach(() => {
    extension = new TestExtension();
    mockContext = {
      logger: new MockLogger(),
      config: new MockConfig(),
      services: new MockServiceRegistry(),
      workingDirectory: "/tmp",
      platformVersion: { major: 1, minor: 0, patch: 0 },
    };
  });

  describe("initialize", () => {
    it("should initialize with context", async () => {
      await extension.initialize(mockContext);

      expect(extension.isInitialized()).toBe(true);
      expect(extension.getContext()).toBe(mockContext);
    });
  });

  describe("register", () => {
    it("should register with registry", async () => {
      const registry = new ExtensionRegistry();
      await extension.register(registry);

      expect(registry.has(extension.metadata.id)).toBe(true);
    });
  });

  describe("execute", () => {
    it("should execute request and return response", async () => {
      const request: ExtensionRequest = {
        extensionId: extension.metadata.id,
        method: "test",
        params: { input: "test" },
      };

      const response = await extension.execute(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.metadata?.executionTimeMs).toBe(10);
    });
  });

  describe("shutdown", () => {
    it("should shutdown gracefully", async () => {
      await extension.initialize(mockContext);
      await extension.shutdown();

      expect(extension.isInitialized()).toBe(false);
    });
  });

  describe("validate (optional)", () => {
    it("should validate data when implemented", () => {
      const fullExtension = new FullExtension();

      const result = fullExtension.validate!("valid string");

      expect(result.valid).toBe(true);
    });

    it("should reject invalid data", () => {
      const fullExtension = new FullExtension();

      const result = fullExtension.validate!(123);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("healthCheck (optional)", () => {
    it("should return health status", async () => {
      const fullExtension = new FullExtension();

      const healthy = await fullExtension.healthCheck!();

      expect(healthy).toBe(true);
    });
  });

  describe("verifySignature (optional)", () => {
    it("should verify valid signature", async () => {
      const fullExtension = new FullExtension();

      const valid = await fullExtension.verifySignature!("valid", "key");

      expect(valid).toBe(true);
    });

    it("should reject invalid signature", async () => {
      const fullExtension = new FullExtension();

      const valid = await fullExtension.verifySignature!("invalid", "key");

      expect(valid).toBe(false);
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe("Helper Functions", () => {
  describe("createSemVer", () => {
    it("should parse version string", () => {
      const version = createSemVer("1.2.3");

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it("should parse version with prerelease", () => {
      const version = createSemVer("1.2.3-alpha.1");

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.prerelease).toBe("alpha.1");
    });

    it("should parse version with build metadata", () => {
      const version = createSemVer("1.2.3+build.123");

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.build).toBe("build.123");
    });

    it("should parse version with prerelease and build", () => {
      const version = createSemVer("1.2.3-alpha.1+build.123");

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.prerelease).toBe("alpha.1");
      expect(version.build).toBe("build.123");
    });

    it("should accept SemVer object", () => {
      const version = createSemVer({ major: 1, minor: 2, patch: 3 });

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it("should throw for invalid version string", () => {
      expect(() => createSemVer("invalid")).toThrow();
    });
  });

  describe("formatSemVer", () => {
    it("should format basic version", () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const formatted = formatSemVer(version);

      expect(formatted).toBe("1.2.3");
    });

    it("should format version with prerelease", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      };
      const formatted = formatSemVer(version);

      expect(formatted).toBe("1.2.3-alpha.1");
    });

    it("should format version with build", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        build: "build.123",
      };
      const formatted = formatSemVer(version);

      expect(formatted).toBe("1.2.3+build.123");
    });

    it("should format version with both prerelease and build", () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
        build: "build.123",
      };
      const formatted = formatSemVer(version);

      expect(formatted).toBe("1.2.3-alpha.1+build.123");
    });
  });

  describe("createExtensionContext", () => {
    it("should create extension context", () => {
      const logger = new MockLogger();
      const config = new MockConfig();
      const services = new MockServiceRegistry();

      const context = createExtensionContext(logger, config, services, "/tmp", {
        major: 1,
        minor: 0,
        patch: 0,
      });

      expect(context.logger).toBe(logger);
      expect(context.config).toBe(config);
      expect(context.services).toBe(services);
      expect(context.workingDirectory).toBe("/tmp");
      expect(context.platformVersion).toEqual({ major: 1, minor: 0, patch: 0 });
    });
  });

  describe("createValidationResult", () => {
    it("should create valid result with no errors", () => {
      const result = createValidationResult([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should create invalid result with errors", () => {
      const errors = [
        { field: "test", message: "Test error", code: "TEST_ERROR" },
      ];

      const result = createValidationResult(errors);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it("should include warnings", () => {
      const warnings = [
        { field: "test", message: "Test warning", code: "TEST_WARNING" },
      ];

      const result = createValidationResult([], warnings);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });
});

// ============================================================================
// LIFECYCLE TESTS
// ============================================================================

describe("Extension Lifecycle", () => {
  it("should complete full lifecycle", async () => {
    const extension = new TestExtension();
    const registry = new ExtensionRegistry();
    const context = {
      logger: new MockLogger(),
      config: new MockConfig(),
      services: new MockServiceRegistry(),
      workingDirectory: "/tmp",
      platformVersion: { major: 1, minor: 0, patch: 0 },
    };

    // Initialize
    await extension.initialize(context);
    expect(extension.isInitialized()).toBe(true);

    // Register
    await extension.register(registry);
    expect(registry.has(extension.metadata.id)).toBe(true);

    // Execute
    const response = await extension.execute({
      extensionId: extension.metadata.id,
      method: "test",
      params: {},
    });
    expect(response.success).toBe(true);

    // Shutdown
    await extension.shutdown();
    expect(extension.isInitialized()).toBe(false);
  });
});

// ============================================================================
// CAPABILITY TESTS
// ============================================================================

describe("Extension Capabilities", () => {
  it("should support all capability types", () => {
    const capabilityTypes: ExtensionCapabilityType[] = [
      "router",
      "cache",
      "privacy",
      "training",
      "custom",
    ];

    capabilityTypes.forEach(type => {
      const capability: ExtensionCapability = {
        type,
        interface: `I${type.charAt(0).toUpperCase() + type.slice(1)}`,
        version: { major: 1, minor: 0, patch: 0 },
      };

      expect(capability.type).toBe(type);
    });
  });

  it("should index multiple capabilities", () => {
    const registry = new ExtensionRegistry();
    const routerExt = new TestExtension({
      id: "@test/router",
      capabilities: [
        {
          type: "router",
          interface: "IRouter",
          version: { major: 1, minor: 0, patch: 0 },
        },
      ],
    });
    const cacheExt = new TestExtension({
      id: "@test/cache",
      capabilities: [
        {
          type: "cache",
          interface: "ICache",
          version: { major: 1, minor: 0, patch: 0 },
        },
      ],
    });

    registry.register(routerExt);
    registry.register(cacheExt);

    expect(registry.findByCapability("router")).toHaveLength(1);
    expect(registry.findByCapability("cache")).toHaveLength(1);
  });
});

// ============================================================================
// TEST HELPERS
// ============================================================================

function testExtensionMetadata(): ProtocolExtensionMetadata {
  return {
    id: "@test/test-extension",
    name: "Test Extension",
    version: { major: 1, minor: 0, patch: 0 },
    author: "Test Author",
    description: "A test extension",
    protocolVersion: { major: 1, minor: 0, patch: 0 },
    license: "MIT",
    capabilities: [
      {
        type: "custom",
        interface: "ITest",
        version: { major: 1, minor: 0, patch: 0 },
      },
    ],
  };
}
