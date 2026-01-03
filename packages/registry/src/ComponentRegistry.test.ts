/**
 * @lsi/registry - Component Registry Tests
 *
 * Comprehensive test suite for the Component Registry system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import {
  ComponentRegistry,
  createComponentRegistry,
} from "./ComponentRegistry.js";
import {
  ComponentManifest,
  RegistryErrorCode,
  RegistryError,
  ComponentType,
  ComponentStability,
} from "./types.js";
import yaml from "js-yaml";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TEST_MANIFESTS: Record<string, ComponentManifest> = {
  "cascade-router": {
    name: "cascade-router",
    version: "1.0.0",
    description: "Complexity + confidence cascade routing",
    type: "routing" as ComponentType,
    language: "typescript",
    category: "intelligence",
    stability: "stable" as ComponentStability,
    keywords: ["routing", "intelligence", "performance"],
    dependencies: [
      {
        name: "protocol",
        version: ">=1.0.0 <2.0.0",
        type: "protocol",
        required: true,
      },
      {
        name: "embeddings",
        version: ">=1.0.0",
        type: "component",
        required: true,
      },
    ],
    compatibility: {
      node: ">=18.0.0",
      platforms: ["linux", "darwin", "win32"],
      arch: ["x64", "arm64"],
    },
    performance: {
      benchmark_qps: 10000,
      latency_p50_ms: 1,
      memory_mb: 50,
    },
    download: {
      archive: {
        url: "https://example.com/cascade-router-1.0.0.tar.gz",
        sha256: "abc123def456",
        size_mb: 2,
      },
    },
  },

  "semantic-cache": {
    name: "semantic-cache",
    version: "1.0.0",
    description: "High-hit-rate semantic caching",
    type: "cache" as ComponentType,
    language: "typescript",
    category: "infrastructure",
    stability: "stable" as ComponentStability,
    keywords: ["cache", "performance", "embeddings"],
    dependencies: [
      {
        name: "embeddings",
        version: ">=1.0.0",
        type: "component",
        required: true,
      },
    ],
    performance: {
      benchmark_qps: 50000,
      latency_p50_ms: 0.5,
      memory_mb: 100,
    },
  },

  protocol: {
    name: "protocol",
    version: "1.0.0",
    description: "Core protocol types",
    type: "infrastructure" as ComponentType,
    language: "typescript",
    category: "infrastructure",
    stability: "stable" as ComponentStability,
    keywords: ["protocol", "types", "core"],
    dependencies: [],
  },

  embeddings: {
    name: "embeddings",
    version: "1.0.0",
    description: "Embedding generation",
    type: "embeddings" as ComponentType,
    language: "typescript",
    category: "infrastructure",
    stability: "stable" as ComponentStability,
    keywords: ["embeddings", "vectors"],
    dependencies: [
      {
        name: "protocol",
        version: ">=1.0.0",
        type: "protocol",
        required: true,
      },
    ],
  },
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

async function createTestRegistry(): Promise<{
  registry: ComponentRegistry;
  tempDir: string;
}> {
  const tempDir = path.join(tmpdir(), `aequor-registry-test-${Date.now()}`);

  const registry = new ComponentRegistry({
    local_path: tempDir,
    registries: [
      {
        name: "test",
        url: "https://test.example.com",
        priority: 1,
        enabled: true,
      },
    ],
  });

  await registry.initialize();

  // Initialize test index
  const indexPath = path.join(tempDir, "registry", "index.json");
  const index = {
    version: "1.0.0",
    last_updated: new Date().toISOString(),
    components: [
      {
        name: "cascade-router",
        latest_version: "1.0.0",
        versions: ["1.0.0", "0.9.0"],
        type: "routing" as ComponentType,
        description: "Complexity + confidence cascade routing",
        keywords: ["routing", "intelligence", "performance"],
        stability: "stable" as ComponentStability,
        category: "intelligence",
      },
      {
        name: "semantic-cache",
        latest_version: "1.0.0",
        versions: ["1.0.0"],
        type: "cache" as ComponentType,
        description: "High-hit-rate semantic caching",
        keywords: ["cache", "performance", "embeddings"],
        stability: "stable" as ComponentStability,
        category: "infrastructure",
      },
      {
        name: "protocol",
        latest_version: "1.0.0",
        versions: ["1.0.0"],
        type: "infrastructure" as ComponentType,
        description: "Core protocol types",
        keywords: ["protocol", "types", "core"],
        stability: "stable" as ComponentStability,
        category: "infrastructure",
      },
      {
        name: "embeddings",
        latest_version: "1.0.0",
        versions: ["1.0.0"],
        type: "embeddings" as ComponentType,
        description: "Embedding generation",
        keywords: ["embeddings", "vectors"],
        stability: "stable" as ComponentStability,
        category: "infrastructure",
      },
    ],
  };

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");

  // Cache manifests
  const manifestsDir = path.join(tempDir, "registry", "manifests");

  for (const [name, manifest] of Object.entries(TEST_MANIFESTS)) {
    const manifestPath = path.join(manifestsDir, `${name}@${manifest.version}.yaml`);
    await fs.writeFile(manifestPath, yaml.dump(manifest), "utf-8");
  }

  return { registry, tempDir };
}

async function cleanupTestRegistry(tempDir: string): Promise<void> {
  await fs.rm(tempDir, { recursive: true, force: true });
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("ComponentRegistry", () => {
  let registry: ComponentRegistry;
  let tempDir: string;

  beforeEach(async () => {
    const setup = await createTestRegistry();
    registry = setup.registry;
    tempDir = setup.tempDir;
  });

  afterEach(async () => {
    await cleanupTestRegistry(tempDir);
  });

  // ========================================================================
  // INITIALIZATION TESTS
  // ========================================================================

  describe("initialization", () => {
    it("should initialize registry directory structure", async () => {
      const expectedDirs = [
        path.join(tempDir, "registry"),
        path.join(tempDir, "registry", "manifests"),
        path.join(tempDir, "registry", "archives"),
        path.join(tempDir, "components"),
        path.join(tempDir, "components", "active"),
        path.join(tempDir, "config"),
      ];

      for (const dir of expectedDirs) {
        const stat = await fs.stat(dir);
        expect(stat.isDirectory()).toBe(true);
      }
    });

    it("should create empty index if not exists", async () => {
      const newTempDir = path.join(tmpdir(), `aequor-registry-test-${Date.now()}`);
      const newRegistry = new ComponentRegistry({ local_path: newTempDir });

      await newRegistry.initialize();

      const indexPath = path.join(newTempDir, "registry", "index.json");
      const content = await fs.readFile(indexPath, "utf-8");
      const index = JSON.parse(content);

      expect(index.version).toBe("1.0.0");
      expect(index.components).toEqual([]);

      await cleanupTestRegistry(newTempDir);
    });
  });

  // ========================================================================
  // LISTING TESTS
  // ========================================================================

  describe("list", () => {
    it("should list all components", async () => {
      const components = await registry.list();

      expect(components).toHaveLength(4);
      expect(components[0]).toHaveProperty("name");
      expect(components[0]).toHaveProperty("latest_version");
      expect(components[0]).toHaveProperty("type");
    });

    it("should filter components by type", async () => {
      const components = await registry.list({ type: "routing" });

      expect(components).toHaveLength(1);
      expect(components[0].name).toBe("cascade-router");
      expect(components[0].type).toBe("routing");
    });

    it("should filter components by stability", async () => {
      const components = await registry.list({ stability: "stable" });

      expect(components.length).toBeGreaterThan(0);
      components.forEach((c) => {
        expect(c.stability).toBe("stable");
      });
    });

    it("should include installation status", async () => {
      const components = await registry.list({ include_installed: true });

      expect(components[0]).toHaveProperty("installed");
      expect(components[0]).toHaveProperty("current_version");
      expect(components[0]).toHaveProperty("update_available");
    });
  });

  describe("listInstalled", () => {
    it("should return empty array when no components installed", async () => {
      const installed = await registry.listInstalled();

      expect(installed).toEqual([]);
    });

    it("should list installed components", async () => {
      // Install a component (mock install by creating directory)
      const componentPath = path.join(tempDir, "components", "cascade-router@1.0.0");
      await fs.mkdir(componentPath, { recursive: true });

      const manifestPath = path.join(componentPath, "manifest.yaml");
      await fs.writeFile(
        manifestPath,
        yaml.dump(TEST_MANIFESTS["cascade-router"]),
        "utf-8"
      );

      const installed = await registry.listInstalled();

      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe("cascade-router");
      expect(installed[0].version).toBe("1.0.0");
      expect(installed[0].manifest).toBeDefined();
    });
  });

  // ========================================================================
  // SEARCH TESTS
  // ========================================================================

  describe("search", () => {
    it("should search by component name", async () => {
      const results = await registry.search({
        query: "cascade",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain("cascade");
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].matched_fields).toContain("name");
    });

    it("should search by description", async () => {
      const results = await registry.search({
        query: "routing",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched_fields).toContain("description");
    });

    it("should search by keywords", async () => {
      const results = await registry.search({
        query: "performance",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.matched_fields.includes("keywords"))).toBe(
        true
      );
    });

    it("should sort results by relevance", async () => {
      const results = await registry.search({
        query: "cache",
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it("should filter search results by type", async () => {
      const results = await registry.search({
        query: "router",
        type: "routing",
      });

      expect(results.every((r) => r.type === "routing")).toBe(true);
    });

    it("should apply pagination", async () => {
      const results1 = await registry.search({
        query: "component",
        limit: 2,
        offset: 0,
      });

      const results2 = await registry.search({
        query: "component",
        limit: 2,
        offset: 2,
      });

      expect(results1.length).toBeLessThanOrEqual(2);
      expect(results2.length).toBeLessThanOrEqual(2);

      if (results1.length === 2 && results2.length === 2) {
        expect(results1[0].name).not.toBe(results2[0].name);
      }
    });
  });

  // ========================================================================
  // COMPONENT INFO TESTS
  // ========================================================================

  describe("get", () => {
    it("should get component manifest", async () => {
      const manifest = await registry.get("cascade-router", "1.0.0");

      expect(manifest.name).toBe("cascade-router");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.type).toBe("routing");
      expect(manifest.description).toBeDefined();
    });

    it("should get latest version if not specified", async () => {
      const manifest = await registry.get("cascade-router");

      expect(manifest.version).toBe("1.0.0");
    });

    it("should throw error for non-existent component", async () => {
      await expect(registry.get("non-existent")).rejects.toThrow(
        RegistryError
      );
    });

    it("should throw error for non-existent version", async () => {
      await expect(registry.get("cascade-router", "2.0.0")).rejects.toThrow(
        RegistryError
      );
    });
  });

  describe("info", () => {
    it("should get component info", async () => {
      const info = await registry.info("cascade-router");

      expect(info.name).toBe("cascade-router");
      expect(info.latest_version).toBe("1.0.0");
      expect(info.type).toBe("routing");
      expect(info.keywords).toBeDefined();
    });

    it("should include installation status", async () => {
      const info = await registry.info("cascade-router");

      expect(info).toHaveProperty("installed");
      expect(info).toHaveProperty("current_version");
      expect(info).toHaveProperty("update_available");
    });
  });

  // ========================================================================
  // COMPATIBILITY TESTS
  // ========================================================================

  describe("checkCompatibility", () => {
    it("should check platform compatibility", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.checkCompatibility(manifest);

      expect(result).toHaveProperty("compatible");
      expect(result).toHaveProperty("platform");
      expect(result.platform?.platform).toBe(process.platform);
    });

    it("should check architecture compatibility", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.checkCompatibility(manifest);

      expect(result).toHaveProperty("arch");
      expect(result.arch?.arch).toBe(process.arch);
    });

    it("should report incompatibility for unsupported platforms", async () => {
      const manifest: ComponentManifest = {
        ...TEST_MANIFESTS["cascade-router"],
        compatibility: {
          platforms: ["fake-platform"],
        },
      };

      const result = await registry.checkCompatibility(manifest);

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain("Platform fake-platform not supported");
    });

    it("should check Node.js compatibility", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.checkCompatibility(manifest);

      expect(result).toHaveProperty("compatible");
      if (!result.compatible) {
        expect(result.issues.some((i) => i.includes("Node.js"))).toBe(true);
      }
    });
  });

  // ========================================================================
  // DEPENDENCY RESOLUTION TESTS
  // ========================================================================

  describe("resolveDependencies", () => {
    it("should resolve component dependencies", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.resolveDependencies(manifest);

      expect(result.success).toBe(true);
      expect(result.components.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should resolve transitive dependencies", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.resolveDependencies(manifest);

      const componentNames = result.components.map((c) => c.name);

      expect(componentNames).toContain("protocol");
      expect(componentNames).toContain("embeddings");
    });

    it("should handle missing dependencies", async () => {
      const manifest: ComponentManifest = {
        name: "test-component",
        version: "1.0.0",
        description: "Test component",
        type: "routing",
        language: "typescript",
        dependencies: [
          {
            name: "non-existent",
            version: ">=1.0.0",
            type: "component",
            required: true,
          },
        ],
      };

      const result = await registry.resolveDependencies(manifest);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe("not_found");
    });

    it("should resolve dependencies in correct order", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.resolveDependencies(manifest);

      // Check that protocol comes before embeddings (if both present)
      const protocolIndex = result.components.findIndex(
        (c) => c.name === "protocol"
      );
      const embeddingsIndex = result.components.findIndex(
        (c) => c.name === "embeddings"
      );

      if (protocolIndex >= 0 && embeddingsIndex >= 0) {
        expect(protocolIndex).toBeLessThan(embeddingsIndex);
      }
    });
  });

  // ========================================================================
  // VERIFICATION TESTS
  // ========================================================================

  describe("verify", () => {
    it("should verify valid manifest", async () => {
      const manifest = TEST_MANIFESTS["cascade-router"];
      const result = await registry.verify(manifest);

      expect(result.verified).toBe(true);
      expect(result.manifest?.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required fields", async () => {
      const manifest: ComponentManifest = {
        name: "",
        version: "",
        description: "",
        type: "routing",
        language: "typescript",
      };

      const result = await registry.verify(manifest);

      expect(result.verified).toBe(false);
      expect(result.manifest?.errors.length).toBeGreaterThan(0);
    });

    it("should validate semver format", async () => {
      const manifest: ComponentManifest = {
        name: "test",
        version: "invalid-version",
        description: "Test",
        type: "routing",
        language: "typescript",
      };

      const result = await registry.verify(manifest);

      expect(result.verified).toBe(false);
      expect(result.manifest?.errors.some((e) => e.includes("semver"))).toBe(
        true
      );
    });
  });

  // ========================================================================
  // UPDATE MANAGEMENT TESTS
  // ========================================================================

  describe("checkUpdates", () => {
    it("should return empty array when no updates available", async () => {
      const updates = await registry.checkUpdates();

      expect(Array.isArray(updates)).toBe(true);
    });

    it("should check updates for specific component", async () => {
      const updates = await registry.checkUpdates("cascade-router");

      expect(Array.isArray(updates)).toBe(true);
    });
  });

  // ========================================================================
  // STATISTICS TESTS
  // ========================================================================

  describe("getStatistics", () => {
    it("should return registry statistics", async () => {
      const stats = await registry.getStatistics();

      expect(stats).toHaveProperty("total_components");
      expect(stats).toHaveProperty("installed_components");
      expect(stats).toHaveProperty("available_updates");
      expect(stats).toHaveProperty("components_by_type");
      expect(stats).toHaveProperty("components_by_stability");
    });

    it("should count components by type", async () => {
      const stats = await registry.getStatistics();

      expect(stats.components_by_type).toHaveProperty("routing");
      expect(stats.components_by_type).toHaveProperty("cache");
      expect(stats.components_by_type.routing).toBe(1);
    });

    it("should count components by stability", async () => {
      const stats = await registry.getStatistics();

      expect(stats.components_by_stability).toHaveProperty("stable");
      expect(stats.components_by_stability.stable).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // HEALTH CHECK TESTS
  // ========================================================================

  describe("healthCheck", () => {
    it("should check registry health", async () => {
      const results = await registry.healthCheck();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("registry");
      expect(results[0]).toHaveProperty("healthy");
    });

    it("should include response time", async () => {
      const results = await registry.healthCheck();

      if (results[0].healthy) {
        expect(results[0]).toHaveProperty("response_time_ms");
        expect(results[0].response_time_ms).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ========================================================================
  // ERROR HANDLING TESTS
  // ========================================================================

  describe("error handling", () => {
    it("should throw RegistryError for missing component", async () => {
      await expect(registry.get("missing")).rejects.toThrow(RegistryError);
    });

    it("should include error code in RegistryError", async () => {
      try {
        await registry.get("missing");
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).code).toBe(
          RegistryErrorCode.COMPONENT_NOT_FOUND
        );
      }
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe("factory functions", () => {
  it("should create registry with createComponentRegistry", async () => {
    const tempDir = path.join(tmpdir(), `aequor-registry-test-${Date.now()}`);
    const registry = await createComponentRegistry({ local_path: tempDir });

    expect(registry).toBeInstanceOf(ComponentRegistry);

    await cleanupTestRegistry(tempDir);
  });

  it("should initialize registry on creation", async () => {
    const tempDir = path.join(tmpdir(), `aequor-registry-test-${Date.now()}`);
    const registry = await createComponentRegistry({ local_path: tempDir });

    const indexPath = path.join(tempDir, "registry", "index.json");
    const exists = await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);

    await cleanupTestRegistry(tempDir);
  });
});
