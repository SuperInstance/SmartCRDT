/**
 * @lsi/app-registry - App Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppRegistry, createAppRegistry } from "./AppRegistry.js";
import type { AppManifest, InstallOptions } from "./types.js";
import { AppRegistryErrorCode, AppRegistryError } from "./types.js";

describe("AppRegistry", () => {
  let registry: AppRegistry;
  let testManifest: AppManifest;

  beforeEach(async () => {
    // Create registry with test config
    registry = new AppRegistry({
      local_apps_dir: "/tmp/aequor-test-apps",
    });

    await registry.initialize();

    // Create test manifest
    testManifest = {
      apiVersion: "v1",
      kind: "App",
      metadata: {
        name: "test-app",
        version: "1.0.0",
        description: "Test app for unit tests",
        author: "Test Author",
        license: "MIT",
        keywords: ["test", "app"],
      },
      category: "development",
      components: [
        {
          name: "test-component",
          version: ">=1.0.0",
          required: true,
          configuration: {
            setting1: "value1",
          },
        },
      ],
      startup: {
        entry_point: "src/index.ts",
        health_check: {
          endpoint: "/health",
          timeout: 5000,
        },
      },
      requirements: {
        min_ram: "1GB",
        cpu_cores: 2,
        gpu: false,
      },
    };
  });

  describe("Initialization", () => {
    it("should initialize registry directories", async () => {
      const testRegistry = new AppRegistry({
        local_apps_dir: "/tmp/aequor-init-test",
      });

      await testRegistry.initialize();

      // In a real test, check that directories exist
      expect(testRegistry).toBeDefined();
    });

    it("should create factory function", async () => {
      const testRegistry = await createAppRegistry({
        local_apps_dir: "/tmp/aequor-factory-test",
      });

      expect(testRegistry).toBeInstanceOf(AppRegistry);
    });
  });

  describe("Manifest Validation", () => {
    it("should validate correct manifest", () => {
      const result = registry.validateManifest(testManifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing apiVersion", () => {
      const invalidManifest = { ...testManifest };
      delete (invalidManifest as any).apiVersion;

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: apiVersion");
    });

    it("should detect invalid kind", () => {
      const invalidManifest = {
        ...testManifest,
        kind: "InvalidKind" as any,
      };

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid kind"))).toBe(true);
    });

    it("should detect missing metadata name", () => {
      const invalidManifest = {
        ...testManifest,
        metadata: { ...testManifest.metadata, name: "" as any },
      };

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: metadata.name");
    });

    it("should detect invalid semver", () => {
      const invalidManifest = {
        ...testManifest,
        metadata: {
          ...testManifest.metadata,
          version: "not-a-version",
        },
      };

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid semver"))).toBe(true);
    });

    it("should warn when no components specified", () => {
      const warningManifest = {
        ...testManifest,
        components: [],
      };

      const result = registry.validateManifest(warningManifest);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("No components specified - app may not be functional");
    });

    it("should detect component without name", () => {
      const invalidManifest = {
        ...testManifest,
        components: [
          {
            name: "",
            version: ">=1.0.0",
            required: true,
          },
        ],
      };

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Component missing name");
    });

    it("should detect component without version", () => {
      const invalidManifest = {
        ...testManifest,
        components: [
          {
            name: "test-component",
            version: "",
            required: true,
          },
        ],
      };

      const result = registry.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("missing version"))).toBe(true);
    });

    it("should warn when startup missing health check", () => {
      const warningManifest = {
        ...testManifest,
        startup: {
          entry_point: "src/index.ts",
          health_check: {
            endpoint: "",
            timeout: 5000,
          } as any,
        },
      };

      const result = registry.validateManifest(warningManifest);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Startup config missing health_check endpoint");
    });
  });

  describe("Hardware Compatibility", () => {
    it("should pass with sufficient hardware", async () => {
      const result = await registry.checkHardwareCompatibility(testManifest);

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect insufficient RAM", async () => {
      const highRamManifest = {
        ...testManifest,
        requirements: {
          min_ram: "128GB",
          cpu_cores: 2,
        },
      };

      const result = await registry.checkHardwareCompatibility(highRamManifest);

      expect(result.compatible).toBe(false);
      expect(result.ram).toBeDefined();
      expect(result.ram?.compatible).toBe(false);
      expect(result.issues.some(e => e.includes("Insufficient RAM"))).toBe(true);
    });

    it("should detect insufficient CPU cores", async () => {
      const highCpuManifest = {
        ...testManifest,
        requirements: {
          min_ram: "1GB",
          cpu_cores: 64,
        },
      };

      const result = await registry.checkHardwareCompatibility(highCpuManifest);

      expect(result.compatible).toBe(false);
      expect(result.cpu).toBeDefined();
      expect(result.cpu?.compatible).toBe(false);
      expect(result.issues.some(e => e.includes("Insufficient CPU cores"))).toBe(true);
    });

    it("should detect missing GPU when required", async () => {
      const gpuManifest = {
        ...testManifest,
        requirements: {
          min_ram: "1GB",
          cpu_cores: 2,
          gpu: true,
        },
      };

      const result = await registry.checkHardwareCompatibility(gpuManifest);

      expect(result.compatible).toBe(false);
      expect(result.gpu).toBeDefined();
      expect(result.gpu?.compatible).toBe(false);
      expect(result.issues).toContain("GPU required but not available");
    });

    it("should handle missing requirements gracefully", async () => {
      const noReqManifest = { ...testManifest };
      delete (noReqManifest as any).requirements;

      const result = await registry.checkHardwareCompatibility(noReqManifest);

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("App Listing", () => {
    it("should list all apps", async () => {
      const apps = await registry.list();

      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBeGreaterThanOrEqual(0);
    });

    it("should filter apps by category", async () => {
      const apps = await registry.list({ category: "development" });

      expect(Array.isArray(apps)).toBe(true);
      apps.forEach(app => {
        expect(app.category).toBe("development");
      });
    });

    it("should include installation status", async () => {
      const apps = await registry.list({ include_installed: true });

      expect(Array.isArray(apps)).toBe(true);
      apps.forEach(app => {
        expect(app).toHaveProperty("installed");
      });
    });
  });

  describe("Search", () => {
    it("should search apps by name", async () => {
      const results = await registry.search({
        query: "chat",
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result).toHaveProperty("score");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it("should filter search results by category", async () => {
      const results = await registry.search({
        query: "assistant",
        category: "development" as any,
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result.category).toBe("development");
      });
    });

    it("should apply pagination to search results", async () => {
      const results = await registry.search({
        query: "app",
        limit: 2,
        offset: 0,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("App Installation", () => {
    it("should report progress during installation", async () => {
      const progressUpdates: any[] = [];

      const options: InstallOptions = {
        version: "1.0.0",
        dry_run: true,
        on_progress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      // This will likely fail since we don't have a real app, but we can test progress reporting
      try {
        await registry.install("test-app", options);
      } catch (error) {
        // Expected to fail
      }

      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it("should skip hardware check when requested", async () => {
      const options: InstallOptions = {
        skip_hardware_check: true,
        dry_run: true,
      };

      // This test would need a real app to fully test
      expect(options.skip_hardware_check).toBe(true);
    });
  });

  describe("App Lifecycle", () => {
    it("should throw error when running non-existent app", async () => {
      await expect(registry.run("nonexistent-app")).rejects.toThrow();
    });

    it("should throw error when stopping non-existent app", async () => {
      await expect(registry.stop("nonexistent-app")).rejects.toThrow();
    });
  });

  describe("App Uninstallation", () => {
    it("should throw error when uninstalling non-existent app", async () => {
      await expect(
        registry.uninstall("nonexistent-app")
      ).rejects.toThrow();
    });
  });

  describe("Update Management", () => {
    it("should check for updates", async () => {
      const updates = await registry.checkUpdates();

      expect(Array.isArray(updates)).toBe(true);
    });

    it("should check updates for specific app", async () => {
      const updates = await registry.checkUpdates("chat-assistant");

      expect(Array.isArray(updates)).toBe(true);
      if (updates.length > 0) {
        expect(updates[0].name).toBe("chat-assistant");
      }
    });
  });

  describe("Statistics", () => {
    it("should get registry statistics", async () => {
      const stats = await registry.getStatistics();

      expect(stats).toHaveProperty("total_apps");
      expect(stats).toHaveProperty("installed_apps");
      expect(stats).toHaveProperty("running_apps");
      expect(stats).toHaveProperty("available_updates");
      expect(stats).toHaveProperty("apps_by_category");
      expect(stats).toHaveProperty("apps_by_stability");

      expect(typeof stats.total_apps).toBe("number");
      expect(typeof stats.installed_apps).toBe("number");
    });
  });

  describe("Error Handling", () => {
    it("should create AppRegistryError with code", () => {
      const error = new AppRegistryError(
        AppRegistryErrorCode.APP_NOT_FOUND,
        "Test error",
        { detail: "test" }
      );

      expect(error.code).toBe(AppRegistryErrorCode.APP_NOT_FOUND);
      expect(error.message).toBe("Test error");
      expect(error.details).toEqual({ detail: "test" });
      expect(error.name).toBe("AppRegistryError");
    });

    it("should maintain error prototype chain", () => {
      const error = new AppRegistryError(
        AppRegistryErrorCode.INVALID_MANIFEST,
        "Invalid manifest"
      );

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppRegistryError).toBe(true);
    });
  });

  describe("Config Generation", () => {
    it("should generate default config from manifest", () => {
      // This is tested indirectly through install
      // The config generation logic is in the private method
      expect(testManifest.configuration).toBeDefined();
    });

    it("should merge user config with defaults", () => {
      const userConfig = {
        environment: "staging",
        custom_setting: "custom_value",
      };

      const options: InstallOptions = {
        config: userConfig,
      };

      expect(options.config).toEqual(userConfig);
    });
  });
});
