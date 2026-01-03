/**
 * Cartridge Lifecycle Integration Tests
 *
 * Tests the complete lifecycle of knowledge cartridges:
 * - Creation and manifest generation
 * - Registration and loading
 * - Dependency resolution
 * - Version negotiation
 * - Conflict detection
 * - Migration paths
 * - Unloading and cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  CartridgeManifest,
  CartridgeLifecycle,
  CartridgeLoadOptions,
  DependencyResolutionResult,
  CartridgeStats,
  QueryType,
} from "@lsi/protocol";
import { CartridgeState } from "@lsi/protocol";

// ============================================================================
// Mock Cartridge Manager for Testing
// ============================================================================

class MockCartridgeManager {
  private cartridges = new Map<string, CartridgeManifest>();
  private loaded = new Map<string, CartridgeLifecycle>();
  private stats = new Map<string, CartridgeStats>();

  /**
   * Create a test cartridge manifest
   */
  async createManifest(
    config: Partial<CartridgeManifest>
  ): Promise<CartridgeManifest> {
    const manifest: CartridgeManifest = {
      id: config.id || "@lsi/test-cartridge",
      version: config.version || "1.0.0",
      name: config.name || "Test Cartridge",
      description:
        config.description || "Test cartridge for integration testing",
      dependencies: config.dependencies || [],
      conflicts: config.conflicts || [],
      capabilities: config.capabilities || {
        domains: ["test"],
        queryTypes: ["question"] as QueryType[],
        sizeBytes: 1024,
        loadTimeMs: 100,
        privacyLevel: "public",
      },
      metadata: config.metadata || {},
      checksum: config.checksum || this.generateChecksum(config.id || "test"),
      files: config.files || [],
      author: config.author,
      license: config.license,
      homepage: config.homepage,
      repository: config.repository,
      signature: config.signature,
    };

    this.cartridges.set(manifest.id, manifest);
    return manifest;
  }

  /**
   * Register a cartridge in the registry
   */
  async register(manifest: CartridgeManifest): Promise<void> {
    if (!manifest.id || !manifest.version) {
      throw new Error("Invalid manifest: missing id or version");
    }

    const checksum = this.generateChecksum(manifest.id);
    if (
      manifest.checksum !== checksum &&
      !manifest.checksum.startsWith("test-")
    ) {
      throw new Error("Checksum mismatch");
    }

    this.cartridges.set(manifest.id, manifest);
  }

  /**
   * Load a cartridge
   */
  async load(
    cartridgeId: string,
    options: CartridgeLoadOptions = {}
  ): Promise<CartridgeLifecycle> {
    const manifest = this.cartridges.get(cartridgeId);
    if (!manifest) {
      throw new Error(`Cartridge not found: ${cartridgeId}`);
    }

    // Check for conflicts
    for (const conflictId of manifest.conflicts) {
      if (this.loaded.has(conflictId)) {
        throw new Error(
          `Conflict detected: ${cartridgeId} conflicts with ${conflictId}`
        );
      }
    }

    // Create lifecycle object
    const lifecycle: CartridgeLifecycle = {
      state: CartridgeState.LOADING,
      loadedAt: Date.now(),
      error: undefined,

      async load(): Promise<void> {
        // Already loading
      },

      async unload(): Promise<void> {
        lifecycle.state = CartridgeState.UNLOADING;
        await new Promise(resolve => setTimeout(resolve, 10));
        this.loaded.delete(cartridgeId);
        lifecycle.state = CartridgeState.UNLOADED;
      },

      async reload(): Promise<void> {
        await lifecycle.unload();
        await new Promise(resolve => setTimeout(resolve, 10));
        lifecycle.state = CartridgeState.LOADING;
        await new Promise(resolve => setTimeout(resolve, 10));
        lifecycle.state = CartridgeState.LOADED;
        lifecycle.loadedAt = Date.now();
      },

      validate(): { valid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!manifest.id) errors.push("Missing id");
        if (!manifest.version) errors.push("Missing version");
        if (!manifest.capabilities) errors.push("Missing capabilities");

        return {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      },
    };

    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 10));

    // Load dependencies if enabled
    if (options.autoloadDependencies !== false) {
      for (const depId of manifest.dependencies) {
        if (!this.loaded.has(depId)) {
          await this.load(depId, options);
        }
      }
    }

    lifecycle.state = CartridgeState.LOADED;
    this.loaded.set(cartridgeId, lifecycle);

    // Initialize stats
    this.stats.set(cartridgeId, {
      id: cartridgeId,
      loadCount: (this.stats.get(cartridgeId)?.loadCount || 0) + 1,
      totalLoadTime: 10,
      averageLoadTime: 10,
      queryCount: 0,
      memoryUsage: manifest.capabilities.sizeBytes,
    });

    return lifecycle;
  }

  /**
   * Check if cartridge is loaded
   */
  isLoaded(cartridgeId: string): boolean {
    return this.loaded.has(cartridgeId);
  }

  /**
   * Unload a cartridge
   */
  async unload(cartridgeId: string): Promise<void> {
    const lifecycle = this.loaded.get(cartridgeId);
    if (!lifecycle) {
      throw new Error(`Cartridge not loaded: ${cartridgeId}`);
    }

    await lifecycle.unload();
  }

  /**
   * Uninstall a cartridge
   */
  async uninstall(cartridgeId: string): Promise<void> {
    if (this.loaded.has(cartridgeId)) {
      await this.unload(cartridgeId);
    }
    this.cartridges.delete(cartridgeId);
    this.stats.delete(cartridgeId);
  }

  /**
   * Get cartridge stats
   */
  getStats(cartridgeId: string): CartridgeStats | undefined {
    return this.stats.get(cartridgeId);
  }

  /**
   * Resolve dependencies
   */
  resolveDependencies(cartridgeId: string): DependencyResolutionResult {
    const manifest = this.cartridges.get(cartridgeId);
    if (!manifest) {
      return {
        success: false,
        loadOrder: [],
        missing: [cartridgeId],
        circular: [],
        conflicts: [],
      };
    }

    const loadOrder: string[] = [];
    const missing: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const depManifest = this.cartridges.get(id);
      if (!depManifest) {
        missing.push(id);
        return;
      }

      // Visit dependencies first
      for (const depId of depManifest.dependencies) {
        visit(depId);
      }

      loadOrder.push(id);
    };

    visit(cartridgeId);

    return {
      success: missing.length === 0,
      loadOrder,
      missing,
      circular: [],
      conflicts: [],
    };
  }

  /**
   * Generate a test checksum
   */
  private generateChecksum(id: string): string {
    return `test-${id}-checksum`;
  }
}

// ============================================================================
// Version Negotiation Mock
// ============================================================================

class MockVersionNegotiationClient {
  async negotiate(
    cartridgeId: string,
    serverUrl: string,
    options: {
      supportedVersions?: string[];
      currentVersion?: string;
    } = {}
  ): Promise<{
    version: string;
    reason: string;
    compatible: boolean;
  }> {
    // Mock negotiation logic
    const availableVersions = ["1.0.0", "1.1.0", "2.0.0"];
    const supported = options.supportedVersions || availableVersions;

    // Find latest compatible version
    const latestCompatible = supported
      .filter(v => availableVersions.includes(v))
      .sort()
      .reverse()[0];

    return {
      version: latestCompatible || "1.0.0",
      reason: latestCompatible ? "latest_compatible" : "fallback",
      compatible: !!latestCompatible,
    };
  }
}

class MockVersionNegotiationServer {
  async generateMigrationPath(
    fromVersion: string,
    toVersion: string,
    cartridgeId: string
  ): Promise<{
    steps: Array<{
      version: string;
      breaking: boolean;
      migrationRequired: boolean;
    }>;
    totalSteps: number;
  }> {
    const steps: Array<{
      version: string;
      breaking: boolean;
      migrationRequired: boolean;
    }> = [];

    // Generate migration path for major versions
    const [fromMajor] = fromVersion.split(".").map(Number);
    const [toMajor] = toVersion.split(".").map(Number);

    for (let v = fromMajor; v <= toMajor; v++) {
      steps.push({
        version: `${v}.0.0`,
        breaking: v > fromMajor,
        migrationRequired: v > fromMajor,
      });
    }

    return {
      steps,
      totalSteps: steps.length,
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Cartridge Lifecycle Integration Tests", () => {
  let manager: MockCartridgeManager;
  let negotiationClient: MockVersionNegotiationClient;
  let negotiationServer: MockVersionNegotiationServer;

  beforeEach(() => {
    manager = new MockCartridgeManager();
    negotiationClient = new MockVersionNegotiationClient();
    negotiationServer = new MockVersionNegotiationServer();
  });

  afterEach(async () => {
    // Cleanup
    const loaded = Array.from((manager as any).loaded.keys());
    for (const cartridgeId of loaded) {
      try {
        await manager.unload(cartridgeId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Full Cartridge Lifecycle", () => {
    it("should complete full cartridge lifecycle", async () => {
      // 1. Create cartridge manifest
      const manifest = await manager.createManifest({
        id: "@lsi/test-cartridge",
        version: "1.0.0",
        name: "Test Cartridge",
        description: "A test cartridge for lifecycle testing",
        capabilities: {
          domains: ["test"],
          queryTypes: ["question"] as QueryType[],
          sizeBytes: 1024,
          loadTimeMs: 100,
          privacyLevel: "public",
        },
      });

      expect(manifest.id).toBe("@lsi/test-cartridge");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.capabilities.domains).toContain("test");

      // 2. Register cartridge
      await manager.register(manifest);

      // 3. Load cartridge
      const lifecycle = await manager.load("@lsi/test-cartridge");

      expect(lifecycle.state).toBe(CartridgeState.LOADED);
      expect(lifecycle.loadedAt).toBeDefined();
      expect(manager.isLoaded("@lsi/test-cartridge")).toBe(true);

      // 4. Use cartridge (simulate query)
      const stats = manager.getStats("@lsi/test-cartridge");
      expect(stats).toBeDefined();
      expect(stats?.loadCount).toBe(1);

      // 5. Unload cartridge
      await manager.unload("@lsi/test-cartridge");
      expect(manager.isLoaded("@lsi/test-cartridge")).toBe(false);

      // 6. Uninstall cartridge
      await manager.uninstall("@lsi/test-cartridge");
      const uninstalledStats = manager.getStats("@lsi/test-cartridge");
      expect(uninstalledStats).toBeUndefined();
    });

    it("should track cartridge statistics", async () => {
      // Create and load cartridge multiple times
      const manifest = await manager.createManifest({
        id: "@lsi/stats-cartridge",
        version: "1.0.0",
      });

      await manager.register(manifest);
      await manager.load("@lsi/stats-cartridge");
      await manager.unload("@lsi/stats-cartridge");

      await manager.load("@lsi/stats-cartridge");
      await manager.unload("@lsi/stats-cartridge");

      await manager.load("@lsi/stats-cartridge");

      const stats = manager.getStats("@lsi/stats-cartridge");
      expect(stats?.loadCount).toBe(3);
      expect(stats?.totalLoadTime).toBeGreaterThan(0);
      expect(stats?.memoryUsage).toBe(1024);
    });
  });

  describe("Dependency Resolution", () => {
    it("should resolve cartridge dependencies automatically", async () => {
      // Create base cartridge
      const base = await manager.createManifest({
        id: "@lsi/base-cartridge",
        version: "1.0.0",
        name: "Base Cartridge",
        description: "Base cartridge with common functionality",
      });

      // Create dependent cartridge
      const dependent = await manager.createManifest({
        id: "@lsi/dependent-cartridge",
        version: "1.0.0",
        name: "Dependent Cartridge",
        description: "Cartridge that depends on base",
        dependencies: ["@lsi/base-cartridge"],
      });

      await manager.register(base);
      await manager.register(dependent);

      // Load dependent cartridge (should load base automatically)
      await manager.load("@lsi/dependent-cartridge", {
        autoloadDependencies: true,
      });

      // Verify both loaded
      expect(manager.isLoaded("@lsi/dependent-cartridge")).toBe(true);
      expect(manager.isLoaded("@lsi/base-cartridge")).toBe(true);
    });

    it("should return correct load order for dependencies", async () => {
      // Create dependency chain: A -> B -> C
      const c = await manager.createManifest({
        id: "@lsi/cartridge-c",
        version: "1.0.0",
      });

      const b = await manager.createManifest({
        id: "@lsi/cartridge-b",
        version: "1.0.0",
        dependencies: ["@lsi/cartridge-c"],
      });

      const a = await manager.createManifest({
        id: "@lsi/cartridge-a",
        version: "1.0.0",
        dependencies: ["@lsi/cartridge-b"],
      });

      await manager.register(c);
      await manager.register(b);
      await manager.register(a);

      const result = manager.resolveDependencies("@lsi/cartridge-a");

      expect(result.success).toBe(true);
      expect(result.loadOrder).toEqual([
        "@lsi/cartridge-c",
        "@lsi/cartridge-b",
        "@lsi/cartridge-a",
      ]);
      expect(result.missing).toHaveLength(0);
    });

    it("should detect missing dependencies", async () => {
      const manifest = await manager.createManifest({
        id: "@lsi/missing-dep-cartridge",
        version: "1.0.0",
        dependencies: ["@lsi/non-existent-cartridge"],
      });

      await manager.register(manifest);

      const result = manager.resolveDependencies("@lsi/missing-dep-cartridge");

      expect(result.success).toBe(false);
      expect(result.missing).toContain("@lsi/non-existent-cartridge");
    });

    it("should handle complex dependency graphs", async () => {
      // Create diamond dependency:
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D

      const d = await manager.createManifest({
        id: "@lsi/cartridge-d",
        version: "1.0.0",
      });

      const b = await manager.createManifest({
        id: "@lsi/cartridge-b",
        version: "1.0.0",
        dependencies: ["@lsi/cartridge-d"],
      });

      const c = await manager.createManifest({
        id: "@lsi/cartridge-c",
        version: "1.0.0",
        dependencies: ["@lsi/cartridge-d"],
      });

      const a = await manager.createManifest({
        id: "@lsi/cartridge-a",
        version: "1.0.0",
        dependencies: ["@lsi/cartridge-b", "@lsi/cartridge-c"],
      });

      await manager.register(d);
      await manager.register(b);
      await manager.register(c);
      await manager.register(a);

      const result = manager.resolveDependencies("@lsi/cartridge-a");

      expect(result.success).toBe(true);
      // D should be loaded before B and C
      const dIndex = result.loadOrder.indexOf("@lsi/cartridge-d");
      const bIndex = result.loadOrder.indexOf("@lsi/cartridge-b");
      const cIndex = result.loadOrder.indexOf("@lsi/cartridge-c");

      expect(dIndex).toBeLessThan(bIndex);
      expect(dIndex).toBeLessThan(cIndex);
    });
  });

  describe("Version Negotiation", () => {
    it("should negotiate compatible version", async () => {
      const result = await negotiationClient.negotiate(
        "@lsi/test-cartridge",
        "https://example.com/registry",
        {
          supportedVersions: ["1.0.0", "1.1.0"],
        }
      );

      expect(result.version).toBe("1.1.0");
      expect(result.reason).toBe("latest_compatible");
      expect(result.compatible).toBe(true);
    });

    it("should fallback to earliest version if none compatible", async () => {
      const result = await negotiationClient.negotiate(
        "@lsi/test-cartridge",
        "https://example.com/registry",
        {
          supportedVersions: ["0.5.0"],
        }
      );

      expect(result.version).toBe("1.0.0"); // fallback
      expect(result.reason).toBe("fallback");
    });

    it("should generate migration path for breaking changes", async () => {
      const path = await negotiationServer.generateMigrationPath(
        "1.0.0",
        "3.0.0",
        "@lsi/test-cartridge"
      );

      expect(path.steps).toHaveLength(3);
      expect(path.steps[0].version).toBe("1.0.0");
      expect(path.steps[0].breaking).toBe(false);
      expect(path.steps[1].version).toBe("2.0.0");
      expect(path.steps[1].breaking).toBe(true);
      expect(path.steps[1].migrationRequired).toBe(true);
      expect(path.steps[2].version).toBe("3.0.0");
      expect(path.steps[2].breaking).toBe(true);
      expect(path.totalSteps).toBe(3);
    });

    it("should handle patch version upgrades", async () => {
      const path = await negotiationServer.generateMigrationPath(
        "1.0.0",
        "1.2.0",
        "@lsi/test-cartridge"
      );

      expect(path.steps).toHaveLength(1);
      expect(path.steps[0].version).toBe("1.0.0");
      expect(path.steps[0].breaking).toBe(false);
    });
  });

  describe("Conflict Detection", () => {
    it("should prevent loading conflicting cartridges", async () => {
      const cartridge1 = await manager.createManifest({
        id: "@lsi/cartridge-1",
        version: "1.0.0",
        conflicts: ["@lsi/cartridge-2"],
      });

      const cartridge2 = await manager.createManifest({
        id: "@lsi/cartridge-2",
        version: "1.0.0",
      });

      await manager.register(cartridge1);
      await manager.register(cartridge2);

      // Load first cartridge
      await manager.load("@lsi/cartridge-1");

      // Try to load conflicting cartridge
      await expect(manager.load("@lsi/cartridge-2")).rejects.toThrow(
        /conflict/i
      );
    });

    it("should detect mutual conflicts", async () => {
      const cartridge1 = await manager.createManifest({
        id: "@lsi/cartridge-x",
        version: "1.0.0",
        conflicts: ["@lsi/cartridge-y"],
      });

      const cartridge2 = await manager.createManifest({
        id: "@lsi/cartridge-y",
        version: "1.0.0",
        conflicts: ["@lsi/cartridge-x"],
      });

      await manager.register(cartridge1);
      await manager.register(cartridge2);

      await manager.load("@lsi/cartridge-x");
      await expect(manager.load("@lsi/cartridge-y")).rejects.toThrow(
        /conflict/i
      );
    });

    it("should allow loading non-conflicting cartridges", async () => {
      const cartridge1 = await manager.createManifest({
        id: "@lsi/compatible-1",
        version: "1.0.0",
      });

      const cartridge2 = await manager.createManifest({
        id: "@lsi/compatible-2",
        version: "1.0.0",
      });

      await manager.register(cartridge1);
      await manager.register(cartridge2);

      await manager.load("@lsi/compatible-1");
      await manager.load("@lsi/compatible-2");

      expect(manager.isLoaded("@lsi/compatible-1")).toBe(true);
      expect(manager.isLoaded("@lsi/compatible-2")).toBe(true);
    });
  });

  describe("Cartridge Validation", () => {
    it("should validate correct manifest", async () => {
      const manifest = await manager.createManifest({
        id: "@lsi/valid-cartridge",
        version: "1.0.0",
      });

      const lifecycle = await manager.load("@lsi/valid-cartridge");
      const validation = lifecycle.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid manifest", async () => {
      const invalidManifest: CartridgeManifest = {
        id: "",
        version: "",
        name: "Invalid",
        description: "Test",
        dependencies: [],
        conflicts: [],
        capabilities: {
          domains: [],
          queryTypes: [],
          sizeBytes: 0,
          loadTimeMs: 0,
          privacyLevel: "public",
        },
        metadata: {},
        checksum: "test",
      };

      await manager.register(invalidManifest);
      const lifecycle = await manager.load("");
      const validation = lifecycle.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Cartridge Reload", () => {
    it("should reload cartridge successfully", async () => {
      const manifest = await manager.createManifest({
        id: "@lsi/reload-cartridge",
        version: "1.0.0",
      });

      await manager.register(manifest);

      const lifecycle = await manager.load("@lsi/reload-cartridge");
      const firstLoadedAt = lifecycle.loadedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 20));

      // Reload
      await lifecycle.reload();

      expect(lifecycle.state).toBe(CartridgeState.LOADED);
      expect(lifecycle.loadedAt).toBeGreaterThan(firstLoadedAt!);
    });
  });

  describe("Load Options", () => {
    it("should respect autoloadDependencies option", async () => {
      const base = await manager.createManifest({
        id: "@lsi/base-autoload",
        version: "1.0.0",
      });

      const dependent = await manager.createManifest({
        id: "@lsi/dependent-autoload",
        version: "1.0.0",
        dependencies: ["@lsi/base-autoload"],
      });

      await manager.register(base);
      await manager.register(dependent);

      // Load with autoloadDependencies: false
      await manager.load("@lsi/dependent-autoload", {
        autoloadDependencies: false,
      });

      // Base should NOT be loaded
      expect(manager.isLoaded("@lsi/dependent-autoload")).toBe(true);
      expect(manager.isLoaded("@lsi/base-autoload")).toBe(false);
    });

    it("should load dependencies by default", async () => {
      const base = await manager.createManifest({
        id: "@lsi/base-default",
        version: "1.0.0",
      });

      const dependent = await manager.createManifest({
        id: "@lsi/dependent-default",
        version: "1.0.0",
        dependencies: ["@lsi/base-default"],
      });

      await manager.register(base);
      await manager.register(dependent);

      // Load without options (default: autoload)
      await manager.load("@lsi/dependent-default");

      // Base should be loaded
      expect(manager.isLoaded("@lsi/dependent-default")).toBe(true);
      expect(manager.isLoaded("@lsi/base-default")).toBe(true);
    });
  });
});
