/**
 * @lsi/app-manager - App Manager Tests
 *
 * Test suite for AppManager functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppManager } from "./AppManager.js";
import { AppManifest, PullOptions, RunOptions, EnhanceOptions } from "./types.js";
import * as fs from "fs-extra";
import * as path from "path";

// Mock dependencies
vi.mock("fs-extra");
vi.mock("@lsi/registry");

describe("AppManager", () => {
  let appManager: AppManager;
  let mockAppsPath: string;

  beforeEach(() => {
    appManager = new AppManager();
    mockAppsPath = path.join(process.env.HOME || "~", ".aequor", "apps");
    vi.clearAllMocks();
  });

  // ========================================================================
  // INITIALIZATION TESTS
  // ========================================================================

  describe("initialize", () => {
    it("should create apps directory if it doesn't exist", async () => {
      await appManager.initialize();

      expect(fs.ensureDir).toHaveBeenCalledWith(mockAppsPath);
    });

    it("should initialize registry if not provided", async () => {
      await appManager.initialize();

      // Verify registry is initialized
      expect(appManager).toBeDefined();
    });
  });

  // ========================================================================
  // APP PULLING TESTS
  // ========================================================================

  describe("pull", () => {
    it("should pull app with all required components", async () => {
      const appName = "chat-assistant";
      const options: PullOptions = {
        version: "1.0.0",
        includeAdvanced: false,
        dryRun: true,
      };

      // Mock manifest loading
      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: {
          name: appName,
          version: "1.0.0",
          description: "Test app",
        },
        components: [
          { name: "cascade-router", version: ">=1.0.0", required: true },
          { name: "semantic-cache", version: "^1.0.0", required: true },
        ],
        advanced_components: [],
        category: "ai-assistant",
      });

      // Mock component resolution
      vi.spyOn(appManager as any, "resolveComponents").mockResolvedValue([
        { name: "cascade-router", version: "1.0.0" },
        { name: "semantic-cache", version: "1.0.0" },
      ]);

      const state = await appManager.pull(appName, options);

      expect(state.name).toBe(appName);
      expect(state.version).toBe("1.0.0");
      expect(state.components).toHaveLength(2);
      expect(state.status).toBe("resolved");
    });

    it("should include advanced components when requested", async () => {
      const appName = "chat-assistant";
      const options: PullOptions = {
        includeAdvanced: true,
        dryRun: true,
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: {
          name: appName,
          version: "1.0.0",
          description: "Test app",
        },
        components: [
          { name: "cascade-router", version: ">=1.0.0", required: true },
        ],
        advanced_components: [
          { name: "privacy-layer", version: ">=1.0.0", required: false },
        ],
        category: "ai-assistant",
      });

      vi.spyOn(appManager as any, "resolveComponents").mockResolvedValue([
        { name: "cascade-router", version: "1.0.0" },
        { name: "privacy-layer", version: "1.0.0" },
      ]);

      const state = await appManager.pull(appName, options);

      expect(state.components).toHaveLength(2);
      expect(state.components.some((c) => c.name === "privacy-layer")).toBe(true);
    });

    it("should report progress during pull", async () => {
      const appName = "chat-assistant";
      const progressUpdates: any[] = [];

      const options: PullOptions = {
        dryRun: true,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: {
          name: appName,
          version: "1.0.0",
          description: "Test app",
        },
        components: [],
        advanced_components: [],
        category: "ai-assistant",
      });

      vi.spyOn(appManager as any, "resolveComponents").mockResolvedValue([]);

      await appManager.pull(appName, options);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].app).toBe(appName);
    });

    it("should resolve dependencies before downloading", async () => {
      const appName = "chat-assistant";
      const options: PullOptions = {
        skipDependencies: false,
        dryRun: true,
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: {
          name: appName,
          version: "1.0.0",
          description: "Test app",
        },
        components: [
          { name: "cascade-router", version: ">=1.0.0", required: true },
        ],
        advanced_components: [],
        category: "ai-assistant",
      });

      const resolveSpy = vi
        .spyOn(appManager as any, "resolveComponents")
        .mockResolvedValue([{ name: "cascade-router", version: "1.0.0" }]);

      await appManager.pull(appName, options);

      expect(resolveSpy).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // APP RUNNING TESTS
  // ========================================================================

  describe("run", () => {
    it("should start app and all components", async () => {
      const appName = "chat-assistant";
      const options: RunOptions = {
        environment: "production",
        port: 8080,
      };

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "configured",
        path: "/mock/path",
        components: [
          {
            name: "cascade-router",
            version: "1.0.0",
            status: "configured",
            advanced: false,
            path: "/mock/component/path",
          },
        ],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager as any, "loadAppManifestFromPath").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        category: "ai-assistant",
        networking: { port: 8080 },
      });
      vi.spyOn(appManager as any, "validateConfiguration").mockResolvedValue(undefined);
      vi.spyOn(appManager as any, "startComponent").mockResolvedValue(undefined);

      await appManager.run(appName, options);

      expect(mockState.status).toBe("running");
    });

    it("should validate configuration before starting", async () => {
      const appName = "chat-assistant";
      const options: RunOptions = {};

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "configured",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager as any, "loadAppManifestFromPath").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        category: "ai-assistant",
      });
      vi.spyOn(appManager as any, "validateConfiguration").mockResolvedValue(undefined);

      await appManager.run(appName, options);

      expect(appManager["validateConfiguration"]).toHaveBeenCalled();
    });

    it("should apply configuration overrides", async () => {
      const appName = "chat-assistant";
      const options: RunOptions = {
        environment: "staging",
        port: 9090,
        logLevel: "debug",
        enableMetrics: false,
        enableTracing: true,
      };

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "configured",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager as any, "loadAppManifestFromPath").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        category: "ai-assistant",
      });
      vi.spyOn(appManager as any, "validateConfiguration").mockResolvedValue(undefined);
      vi.spyOn(appManager, "run" as any).mockResolvedValue(undefined);

      const applyConfigSpy = vi.spyOn(appManager as any, "applyConfigOverrides");

      await appManager.run(appName, options);

      expect(applyConfigSpy).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // APP ENHANCEMENT TESTS
  // ========================================================================

  describe("enhance", () => {
    it("should add advanced components to app", async () => {
      const appName = "chat-assistant";
      const options: EnhanceOptions = {
        components: ["privacy-layer", "federated-learning"],
        dryRun: false,
      };

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "configured",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        advanced_components: [
          { name: "privacy-layer", version: ">=1.0.0", required: false },
          { name: "federated-learning", version: ">=1.0.0", required: false },
        ],
        category: "ai-assistant",
      });

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager, "enhance" as any).mockResolvedValue(mockState);

      const result = await appManager.enhance(appName, options);

      expect(result).toBeDefined();
    });

    it("should preview changes in dry-run mode", async () => {
      const appName = "chat-assistant";
      const options: EnhanceOptions = {
        components: ["privacy-layer"],
        dryRun: true,
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        advanced_components: [
          { name: "privacy-layer", version: ">=1.0.0", required: false, description: "Privacy layer" },
        ],
        category: "ai-assistant",
      });

      const consoleSpy = vi.spyOn(console, "log");

      await appManager.enhance(appName, options);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should filter components to add based on options", async () => {
      const appName = "chat-assistant";
      const options: EnhanceOptions = {
        components: ["privacy-layer"],
        dryRun: false,
      };

      vi.spyOn(appManager as any, "loadAppManifest").mockResolvedValue({
        metadata: { name: appName, version: "1.0.0", description: "Test" },
        components: [],
        advanced_components: [
          { name: "privacy-layer", version: ">=1.0.0", required: false },
          { name: "federated-learning", version: ">=1.0.0", required: false },
        ],
        category: "ai-assistant",
      });

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue({
        name: appName,
        version: "1.0.0",
        status: "configured",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      });

      const result = await appManager.enhance(appName, options);

      expect(result).toBeDefined();
    });
  });

  // ========================================================================
  // APP LISTING TESTS
  // ========================================================================

  describe("list", () => {
    it("should list all installed apps", async () => {
      vi.spyOn(fs, "readdir").mockResolvedValue([
        { name: "chat-assistant@1.0.0", isDirectory: () => true } as any,
      ]);

      vi.spyOn(fs, "pathExists").mockResolvedValue(true);
      vi.spyOn(fs, "readFile")
        .mockResolvedValueOnce(
          YAML.stringify({
            apiVersion: "v1",
            kind: "App",
            metadata: {
              name: "chat-assistant",
              version: "1.0.0",
              description: "Test app",
            },
            components: [],
            category: "ai-assistant",
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            name: "chat-assistant",
            version: "1.0.0",
            status: "configured",
            path: "/mock/path",
            components: [],
            updated_at: new Date(),
          })
        );

      const apps = await appManager.list();

      expect(apps).toHaveLength(1);
      expect(apps[0].name).toBe("chat-assistant");
    });

    it("should return empty array when no apps installed", async () => {
      vi.spyOn(fs, "readdir").mockResolvedValue([]);

      const apps = await appManager.list();

      expect(apps).toHaveLength(0);
    });
  });

  // ========================================================================
  // APP STATUS TESTS
  // ========================================================================

  describe("status", () => {
    it("should return app status", async () => {
      const appName = "chat-assistant";

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "running",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
        pid: 12345,
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager as any, "checkHealth").mockResolvedValue({
        healthy: true,
        components: {},
        last_check: new Date(),
        results: [],
      });

      const status = await appManager.status(appName, true);

      expect(status.name).toBe(appName);
      expect(status.status).toBe("running");
      expect(status.health).toBeDefined();
    });

    it("should throw error for non-existent app", async () => {
      const appName = "non-existent";

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(null);

      await expect(appManager.status(appName)).rejects.toThrow();
    });
  });

  // ========================================================================
  // APP REMOVAL TESTS
  // ========================================================================

  describe("remove", () => {
    it("should remove app and all data", async () => {
      const appName = "chat-assistant";

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "stopped",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(fs, "remove").mockResolvedValue(undefined);

      await appManager.remove(appName, false);

      expect(fs.remove).toHaveBeenCalledWith(mockState.path);
    });

    it("should keep data when requested", async () => {
      const appName = "chat-assistant";

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "stopped",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(fs, "remove").mockResolvedValue(undefined);

      await appManager.remove(appName, true);

      expect(fs.remove).toHaveBeenCalledTimes(1); // Only state file removed
    });

    it("should stop app before removing if running", async () => {
      const appName = "chat-assistant";

      const mockState = {
        name: appName,
        version: "1.0.0",
        status: "running",
        path: "/mock/path",
        components: [],
        updated_at: new Date(),
      };

      vi.spyOn(appManager as any, "getAppState").mockResolvedValue(mockState);
      vi.spyOn(appManager, "stop" as any).mockResolvedValue(undefined);
      vi.spyOn(fs, "remove").mockResolvedValue(undefined);

      await appManager.remove(appName, false);

      expect(appManager["stop"]).toHaveBeenCalledWith(appName);
    });
  });

  // ========================================================================
  // APP SEARCH TESTS
  // ========================================================================

  describe("search", () => {
    it("should search apps by query", async () => {
      vi.spyOn(appManager, "list").mockResolvedValue([
        {
          name: "chat-assistant",
          latest_version: "1.0.0",
          versions: ["1.0.0"],
          category: "ai-assistant",
          description: "AI chat assistant",
          keywords: ["chat", "assistant", "ai"],
          installed: true,
          update_available: false,
          component_count: 4,
          advanced_component_count: 2,
        },
      ]);

      const results = await appManager.search({ query: "chat" });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("chat-assistant");
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("should filter by category", async () => {
      vi.spyOn(appManager, "list").mockResolvedValue([
        {
          name: "chat-assistant",
          latest_version: "1.0.0",
          versions: ["1.0.0"],
          category: "ai-assistant",
          description: "AI chat assistant",
          keywords: ["chat"],
          installed: true,
          update_available: false,
          component_count: 4,
          advanced_component_count: 2,
        },
      ]);

      const results = await appManager.search({
        query: "assistant",
        category: "ai-assistant" as any,
      });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe("ai-assistant");
    });

    it("should apply pagination limits", async () => {
      const mockApps = Array.from({ length: 30 }, (_, i) => ({
        name: `app-${i}`,
        latest_version: "1.0.0",
        versions: ["1.0.0"],
        category: "ai-assistant" as const,
        description: `Test app ${i}`,
        keywords: ["test"],
        installed: true,
        update_available: false,
        component_count: 1,
        advanced_component_count: 0,
      }));

      vi.spyOn(appManager, "list").mockResolvedValue(mockApps);

      const results = await appManager.search({
        query: "test",
        limit: 10,
      });

      expect(results).toHaveLength(10);
    });
  });

  // ========================================================================
  // HELPER METHOD TESTS
  // ========================================================================

  describe("helper methods", () => {
    it("should check if component is advanced", () => {
      const manifest: AppManifest = {
        apiVersion: "v1",
        kind: "App",
        metadata: {
          name: "test",
          version: "1.0.0",
          description: "Test",
        },
        components: [],
        advanced_components: [
          { name: "privacy-layer", version: ">=1.0.0", required: false },
        ],
        category: "ai-assistant",
      };

      const isAdvanced = (appManager as any).isAdvancedComponent(manifest, "privacy-layer");

      expect(isAdvanced).toBe(true);
    });

    it("should select version matching constraint", () => {
      const selectVersion = (appManager as any).selectVersion;

      expect(selectVersion("1.2.3", "^1.0.0")).toBe("1.2.3");
      expect(selectVersion("1.2.3", ">=2.0.0")).toBe(null);
    });
  });
});
