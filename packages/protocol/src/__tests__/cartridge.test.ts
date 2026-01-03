/**
 * Cartridge Protocol Tests
 *
 * Tests for cartridge manifest, metadata, validation, and lifecycle.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  CartridgeManifest,
  CartridgeFileEntry,
  CartridgeCapabilities,
  CartridgeNegotiation,
  CartridgeVersion,
  CompatibilityResult,
  CartridgeState,
  CartridgeLifecycle,
  ValidationResult,
  DependencyNode,
  CartridgeRegistryEntry,
  CartridgeLoadOptions,
  CartridgeLoadProgress,
  DependencyResolutionResult,
  VersionConstraint,
  CartridgeStats,
  QueryType,
} from "../cartridge.js";

describe("Cartridge Protocol", () => {
  describe("CartridgeManifest", () => {
    it("should create a valid cartridge manifest", () => {
      const manifest: CartridgeManifest = {
        id: "@lsi/cartridge-medical",
        version: "1.0.0",
        name: "Medical Knowledge Cartridge",
        description: "Medical terminology and diagnosis knowledge",
        author: "LSI Team",
        license: "MIT",
        homepage: "https://aequor.io/cartridges/medical",
        repository: "https://github.com/lsi/medical-cartridge",
        dependencies: ["@lsi/core@^2.0.0"],
        conflicts: [],
        capabilities: {
          domains: ["medical", "diagnosis", "terminology"],
          queryTypes: ["question", "explanation"],
          embeddingModel: "text-embedding-3-small",
          sizeBytes: 1024 * 1024 * 100, // 100MB
          loadTimeMs: 5000,
          privacyLevel: "sensitive",
        },
        metadata: {
          category: "healthcare",
          languages: ["en"],
          lastUpdated: "2024-01-01",
        },
        checksum: "sha256:abc123def456...",
        files: [
          {
            path: "data/embeddings.bin",
            checksum: "sha256:123...",
            sizeBytes: 50 * 1024 * 1024,
          },
          {
            path: "data/metadata.json",
            checksum: "sha256:456...",
            sizeBytes: 1024,
          },
        ],
      };

      expect(manifest.id).toBe("@lsi/cartridge-medical");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.capabilities.domains).toContain("medical");
      expect(manifest.capabilities.privacyLevel).toBe("sensitive");
    });

    it("should support optional fields", () => {
      const manifest: CartridgeManifest = {
        id: "@lsi/cartridge-simple",
        version: "1.0.0",
        name: "Simple Cartridge",
        description: "A simple cartridge",
        dependencies: [],
        conflicts: [],
        capabilities: {
          domains: ["general"],
          queryTypes: ["general"],
          sizeBytes: 1024 * 1024,
          loadTimeMs: 1000,
          privacyLevel: "public",
        },
        metadata: {},
        checksum: "sha256:...",
      };

      expect(manifest.author).toBeUndefined();
      expect(manifest.license).toBeUndefined();
      expect(manifest.signature).toBeUndefined();
    });

    it("should include cryptographic signature", () => {
      const manifest: CartridgeManifest = {
        id: "@lsi/cartridge-signed",
        version: "1.0.0",
        name: "Signed Cartridge",
        description: "Cartridge with signature",
        dependencies: [],
        conflicts: [],
        capabilities: {
          domains: ["general"],
          queryTypes: ["general"],
          sizeBytes: 1024 * 1024,
          loadTimeMs: 1000,
          privacyLevel: "public",
        },
        metadata: {},
        checksum: "sha256:...",
        signature: "-----BEGIN SIGNATURE-----\nMIIB...",
      };

      expect(manifest.signature).toBeDefined();
      expect(manifest.signature?.startsWith("-----BEGIN")).toBe(true);
    });
  });

  describe("CartridgeCapabilities", () => {
    it("should describe all query types", () => {
      const queryTypes: QueryType[] = [
        "question",
        "command",
        "code",
        "explanation",
        "comparison",
        "debug",
        "general",
      ];

      const capabilities: CartridgeCapabilities = {
        domains: ["programming"],
        queryTypes,
        embeddingModel: "text-embedding-3-large",
        sizeBytes: 1024 * 1024 * 200,
        loadTimeMs: 8000,
        privacyLevel: "public",
      };

      expect(capabilities.queryTypes).toHaveLength(7);
      expect(capabilities.queryTypes).toContain("code");
      expect(capabilities.queryTypes).toContain("debug");
    });

    it("should support all privacy levels", () => {
      const privacyLevels: Array<CartridgeCapabilities["privacyLevel"]> = [
        "public",
        "sensitive",
        "sovereign",
      ];

      privacyLevels.forEach(level => {
        const capabilities: CartridgeCapabilities = {
          domains: ["test"],
          queryTypes: ["general"],
          sizeBytes: 1024,
          loadTimeMs: 100,
          privacyLevel: level,
        };

        expect(capabilities.privacyLevel).toBe(level);
      });
    });
  });

  describe("CartridgeNegotiation", () => {
    it("should negotiate compatible version", () => {
      const negotiation: CartridgeNegotiation = {
        requestedId: "@lsi/cartridge-medical",
        requestedVersion: "^1.0.0",
        availableVersions: [
          {
            version: "1.0.0",
            status: "compatible",
          },
          {
            version: "1.1.0",
            status: "compatible",
          },
          {
            version: "2.0.0",
            status: "upgrade_required",
          },
        ],
        selectedVersion: "1.1.0",
        compatibility: {
          isCompatible: true,
          selectedVersion: "1.1.0",
          requires: [],
          conflicts: [],
          warnings: [],
        },
      };

      expect(negotiation.selectedVersion).toBe("1.1.0");
      expect(negotiation.compatibility.isCompatible).toBe(true);
    });

    it("should handle incompatibility", () => {
      const negotiation: CartridgeNegotiation = {
        requestedId: "@lsi/cartridge-old",
        requestedVersion: "1.0.0",
        availableVersions: [
          {
            version: "2.0.0",
            status: "incompatible",
            reason: "Breaking changes in API",
          },
        ],
        selectedVersion: "",
        compatibility: {
          isCompatible: false,
          selectedVersion: "",
          requires: [],
          conflicts: ["@lsi/core@2.0.0"],
          warnings: [],
        },
      };

      expect(negotiation.compatibility.isCompatible).toBe(false);
      expect(negotiation.compatibility.conflicts).toHaveLength(1);
    });
  });

  describe("CartridgeVersion", () => {
    it("should represent all version statuses", () => {
      const statuses: Array<CartridgeVersion["status"]> = [
        "compatible",
        "upgrade_required",
        "downgrade_required",
        "incompatible",
      ];

      statuses.forEach(status => {
        const version: CartridgeVersion = {
          version: "1.0.0",
          status,
          reason: `Status is ${status}`,
        };

        expect(version.status).toBe(status);
      });
    });
  });

  describe("CompatibilityResult", () => {
    it("should indicate compatible result", () => {
      const result: CompatibilityResult = {
        isCompatible: true,
        selectedVersion: "1.5.0",
        requires: ["@lsi/core@^2.0.0"],
        conflicts: [],
        warnings: ["New version available: 2.0.0"],
      };

      expect(result.isCompatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it("should list missing dependencies", () => {
      const result: CompatibilityResult = {
        isCompatible: false,
        selectedVersion: "1.0.0",
        requires: ["@lsi/missing@1.0.0"],
        conflicts: [],
        warnings: [],
      };

      expect(result.isCompatible).toBe(false);
      expect(result.requires).toContain("@lsi/missing@1.0.0");
    });

    it("should detect version conflicts", () => {
      const result: CompatibilityResult = {
        isCompatible: false,
        selectedVersion: "",
        requires: [],
        conflicts: ["@lsi/other-cartridge@1.0.0"],
        warnings: ["Conflict with installed cartridge"],
      };

      expect(result.isCompatible).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("CartridgeState", () => {
    it("should represent all lifecycle states", () => {
      const states: CartridgeState[] = [
        CartridgeState.UNLOADED,
        CartridgeState.LOADING,
        CartridgeState.LOADED,
        CartridgeState.UNLOADING,
        CartridgeState.ERROR,
      ];

      expect(states).toHaveLength(5);
      expect(states[0]).toBe("unloaded");
      expect(states[4]).toBe("error");
    });
  });

  describe("CartridgeLifecycle", () => {
    it("should track lifecycle state", () => {
      const lifecycle: CartridgeLifecycle = {
        state: CartridgeState.LOADED,
        loadedAt: Date.now(),
      };

      expect(lifecycle.state).toBe(CartridgeState.LOADED);
      expect(lifecycle.loadedAt).toBeDefined();
    });

    it("should track error state", () => {
      const lifecycle: CartridgeLifecycle = {
        state: CartridgeState.ERROR,
        error: "Failed to load cartridge: insufficient memory",
      };

      expect(lifecycle.state).toBe(CartridgeState.ERROR);
      expect(lifecycle.error).toBeDefined();
    });
  });

  describe("ValidationResult", () => {
    it("should represent successful validation", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should include validation errors", () => {
      const result: ValidationResult = {
        valid: false,
        errors: [
          "Missing required field: name",
          "Invalid version format",
          "Checksum mismatch for data/embeddings.bin",
        ],
        warnings: ["Deprecated API usage"],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe("DependencyNode", () => {
    it("should represent dependency graph node", () => {
      const node: DependencyNode = {
        id: "@lsi/cartridge-a",
        version: "1.0.0",
        manifest: {
          id: "@lsi/cartridge-a",
          version: "1.0.0",
          name: "Cartridge A",
          description: "Test cartridge",
          dependencies: ["@lsi/cartridge-b@^1.0.0"],
          conflicts: [],
          capabilities: {
            domains: ["test"],
            queryTypes: ["general"],
            sizeBytes: 1024,
            loadTimeMs: 100,
            privacyLevel: "public",
          },
          metadata: {},
          checksum: "sha256:...",
        },
        dependencies: ["@lsi/cartridge-b"],
        conflicts: [],
        visited: false,
        inStack: false,
      };

      expect(node.id).toBe("@lsi/cartridge-a");
      expect(node.dependencies).toContain("@lsi/cartridge-b");
      expect(node.visited).toBe(false);
    });
  });

  describe("CartridgeRegistryEntry", () => {
    it("should represent registry entry", () => {
      const entry: CartridgeRegistryEntry = {
        manifest: {
          id: "@lsi/cartridge-registered",
          version: "1.0.0",
          name: "Registered Cartridge",
          description: "In registry",
          dependencies: [],
          conflicts: [],
          capabilities: {
            domains: ["registry"],
            queryTypes: ["general"],
            sizeBytes: 1024,
            loadTimeMs: 100,
            privacyLevel: "public",
          },
          metadata: {},
          checksum: "sha256:...",
        },
        path: "/var/lib/aequor/cartridges/registered",
        loaded: true,
        loadCount: 5,
        lastModified: Date.now(),
      };

      expect(entry.loaded).toBe(true);
      expect(entry.loadCount).toBe(5);
    });
  });

  describe("CartridgeLoadOptions", () => {
    it("should configure load options", () => {
      const options: CartridgeLoadOptions = {
        autoloadDependencies: true,
        failOnConflicts: false,
        timeout: 30000,
        onProgress: progress => {
          console.log(`Loading: ${progress.progress}% - ${progress.operation}`);
        },
      };

      expect(options.autoloadDependencies).toBe(true);
      expect(options.failOnConflicts).toBe(false);
      expect(options.timeout).toBe(30000);
      expect(options.onProgress).toBeDefined();
    });
  });

  describe("CartridgeLoadProgress", () => {
    it("should track loading progress", () => {
      const progress: CartridgeLoadProgress = {
        cartridgeId: "@lsi/cartridge-loading",
        progress: 50,
        operation: "loading",
        message: "Loading embeddings into memory",
      };

      expect(progress.progress).toBe(50);
      expect(progress.operation).toBe("loading");
    });

    it("should support all operations", () => {
      const operations: Array<CartridgeLoadProgress["operation"]> = [
        "resolving",
        "loading",
        "validating",
        "complete",
      ];

      operations.forEach(operation => {
        const progress: CartridgeLoadProgress = {
          cartridgeId: "test",
          progress: 0,
          operation,
        };

        expect(progress.operation).toBe(operation);
      });
    });
  });

  describe("DependencyResolutionResult", () => {
    it("should represent successful resolution", () => {
      const result: DependencyResolutionResult = {
        success: true,
        loadOrder: ["@lsi/core", "@lsi/cartridge-b", "@lsi/cartridge-a"],
        missing: [],
        circular: [],
        conflicts: [],
      };

      expect(result.success).toBe(true);
      expect(result.loadOrder).toHaveLength(3);
      expect(result.loadOrder[0]).toBe("@lsi/core");
    });

    it("should detect missing dependencies", () => {
      const result: DependencyResolutionResult = {
        success: false,
        loadOrder: [],
        missing: ["@lsi/missing-dep@^1.0.0"],
        circular: [],
        conflicts: [],
      };

      expect(result.success).toBe(false);
      expect(result.missing).toHaveLength(1);
    });

    it("should detect circular dependencies", () => {
      const result: DependencyResolutionResult = {
        success: false,
        loadOrder: [],
        missing: [],
        circular: [
          ["@lsi/cartridge-a", "@lsi/cartridge-b"],
          ["@lsi/cartridge-b", "@lsi/cartridge-a"],
        ],
        conflicts: [],
      };

      expect(result.success).toBe(false);
      expect(result.circular).toHaveLength(2);
    });

    it("should detect conflicts", () => {
      const result: DependencyResolutionResult = {
        success: false,
        loadOrder: [],
        missing: [],
        circular: [],
        conflicts: [["@lsi/cartridge-a@1.0.0", "@lsi/cartridge-a@2.0.0"]],
      };

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("VersionConstraint", () => {
    it("should parse semantic version constraints", () => {
      const constraints: Array<VersionConstraint["operator"]> = [
        "=",
        "^",
        "~",
        ">",
        ">=",
        "<",
        "<=",
        "*",
      ];

      constraints.forEach(operator => {
        const constraint: VersionConstraint = {
          raw: `${operator}1.0.0`,
          major: 1,
          minor: 0,
          patch: 0,
          operator,
        };

        expect(constraint.operator).toBe(operator);
      });
    });

    it("should support pre-release versions", () => {
      const constraint: VersionConstraint = {
        raw: "^1.0.0-beta.1",
        major: 1,
        minor: 0,
        patch: 0,
        operator: "^",
        prerelease: "beta.1",
      };

      expect(constraint.prerelease).toBe("beta.1");
    });

    it("should support build metadata", () => {
      const constraint: VersionConstraint = {
        raw: "1.0.0+20240101",
        major: 1,
        minor: 0,
        patch: 0,
        operator: "=",
        build: "20240101",
      };

      expect(constraint.build).toBe("20240101");
    });
  });

  describe("CartridgeStats", () => {
    it("should track cartridge statistics", () => {
      const stats: CartridgeStats = {
        id: "@lsi/cartridge-stats",
        loadCount: 100,
        totalLoadTime: 500000, // 500 seconds total
        averageLoadTime: 5000, // 5 seconds average
        queryCount: 10000,
        lastQueryAt: Date.now(),
        memoryUsage: 1024 * 1024 * 100, // 100MB
      };

      expect(stats.loadCount).toBe(100);
      expect(stats.averageLoadTime).toBe(5000);
      expect(stats.queryCount).toBe(10000);
      expect(stats.memoryUsage).toBe(100 * 1024 * 1024);
    });
  });

  describe("CartridgeFileEntry", () => {
    it("should list cartridge files with checksums", () => {
      const files: CartridgeFileEntry[] = [
        {
          path: "data/embeddings.bin",
          checksum: "sha256:a1b2c3d4...",
          sizeBytes: 50 * 1024 * 1024,
        },
        {
          path: "data/metadata.json",
          checksum: "sha256:e5f6g7h8...",
          sizeBytes: 1024,
        },
        {
          path: "index.js",
          checksum: "sha256:i9j0k1l2...",
        },
      ];

      expect(files).toHaveLength(3);
      expect(files[0].sizeBytes).toBe(50 * 1024 * 1024);
      expect(files[2].sizeBytes).toBeUndefined();
    });
  });

  describe("Dependency Graph Traversal", () => {
    it("should handle simple dependency tree", () => {
      // A depends on B, B depends on C
      const nodes = new Map<string, DependencyNode>();

      nodes.set("a", {
        id: "a",
        version: "1.0.0",
        dependencies: ["b"],
        conflicts: [],
        visited: false,
        inStack: false,
      });

      nodes.set("b", {
        id: "b",
        version: "1.0.0",
        dependencies: ["c"],
        conflicts: [],
        visited: false,
        inStack: false,
      });

      nodes.set("c", {
        id: "c",
        version: "1.0.0",
        dependencies: [],
        conflicts: [],
        visited: false,
        inStack: false,
      });

      // Simulate topological sort
      const loadOrder: string[] = [];
      const visited = new Set<string>();

      const visit = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);

        const node = nodes.get(id);
        if (node) {
          node.dependencies.forEach(dep => visit(dep));
          loadOrder.push(id);
        }
      };

      visit("a");

      expect(loadOrder).toEqual(["c", "b", "a"]);
    });

    it("should detect circular dependency", () => {
      const nodes = new Map<string, DependencyNode>();

      nodes.set("a", {
        id: "a",
        version: "1.0.0",
        dependencies: ["b"],
        conflicts: [],
        visited: false,
        inStack: false,
      });

      nodes.set("b", {
        id: "b",
        version: "1.0.0",
        dependencies: ["a"], // Circular!
        conflicts: [],
        visited: false,
        inStack: false,
      });

      // Track visited nodes to detect cycle
      const inStack = new Set<string>();
      const hasCycle = (id: string): boolean => {
        if (inStack.has(id)) return true;

        const node = nodes.get(id);
        if (!node) return false;

        inStack.add(id);
        for (const dep of node.dependencies) {
          if (hasCycle(dep)) return true;
        }
        inStack.delete(id);

        return false;
      };

      expect(hasCycle("a")).toBe(true);
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize manifest", () => {
      const original: CartridgeManifest = {
        id: "@lsi/cartridge-serialize",
        version: "1.0.0",
        name: "Serialize Test",
        description: "Testing serialization",
        dependencies: [],
        conflicts: [],
        capabilities: {
          domains: ["test"],
          queryTypes: ["general"],
          sizeBytes: 1024,
          loadTimeMs: 100,
          privacyLevel: "public",
        },
        metadata: {
          testKey: "testValue",
          testNumber: 42,
        },
        checksum: "sha256:test",
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as CartridgeManifest;

      expect(deserialized.id).toBe(original.id);
      expect(deserialized.metadata?.testKey).toBe("testValue");
      expect(deserialized.metadata?.testNumber).toBe(42);
    });
  });
});
