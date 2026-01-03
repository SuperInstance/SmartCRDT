/**
 * Federation Integration Tests
 * End-to-end tests for module federation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FederationHost,
  FederationRemote,
  HotSwapper,
  ModuleLoader,
  VersionManager,
  SharedDeps,
  CacheManager,
  createHost,
  createRemote,
} from "../src/index.js";

describe("Federation Integration", () => {
  describe("host-remote communication", () => {
    let host: FederationHost;
    let remote: FederationRemote;

    beforeEach(() => {
      // Setup remote
      remote = new FederationRemote({
        name: "test-remote",
        filename: "remoteEntry.js",
        exposes: [
          { name: "./Button", import: "./src/Button.tsx" },
          { name: "./Card", import: "./src/Card.tsx" },
        ],
        remotes: [],
        shared: [],
        version: "1.0.0",
      });

      // Setup host
      host = new FederationHost({
        name: "test-host",
        filename: "host.js",
        exposes: [],
        remotes: [
          {
            name: "test-remote",
            entry: "http://localhost:3001/remoteEntry.js",
            entryGlobal: "testRemote",
            scope: "test-remote",
            version: "1.0.0",
          },
        ],
        shared: [],
        version: "1.0.0",
      });

      // Mock globals
      (globalThis as any).testRemote = {
        init: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(() => ({ default: {} })),
      };
    });

    it("should initialize both host and remote", async () => {
      await remote.initialize();
      await host.initialize();

      expect(remote.isInitialized()).toBe(true);
      expect(host.isInitialized()).toBe(true);
    });

    it("should expose modules from remote", () => {
      remote.exposeModule("./Button", { Button: () => null });

      const module = remote.getExposedModule("./Button");
      expect(module).toBeDefined();
    });

    it("should get remote manifest entry", () => {
      const entry = remote.createManifestEntry("/");
      expect(entry.name).toBe("test-remote");
      expect(entry.exposes).toContain("./Button");
    });
  });

  describe("hot swapping integration", () => {
    let swapper: HotSwapper;
    let loader: ModuleLoader;

    beforeEach(() => {
      swapper = new HotSwapper({
        preserveState: true,
        transition: "fade",
      });

      loader = new ModuleLoader({
        strategy: "eager",
      });
    });

    it("should hot swap loaded module", async () => {
      const oldModule = {
        id: "test-module",
        name: "TestModule",
        version: "1.0.0",
        url: "http://localhost:3000/module.js",
        loaded: true,
        timestamp: Date.now(),
      };

      const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });

      const result = await swapper.swapModule(oldModule, newFactory);
      expect(result.success).toBe(true);
      expect(result.newModule.version).toBe("2.0.0");
    });

    it("should integrate with module loader", async () => {
      const factory = vi.fn().mockResolvedValue({ version: "1.0.0" });
      const info = { id: "test", name: "Test", version: "1.0.0" };

      const loaded = await loader.loadModule(factory, info);
      expect(loaded.module).toBeDefined();
    });
  });

  describe("version management integration", () => {
    let versionManager: VersionManager;

    beforeEach(() => {
      versionManager = new VersionManager();
      versionManager.registerVersions("test-module", [
        "1.0.0",
        "1.1.0",
        "2.0.0",
      ]);
    });

    it("should resolve compatible versions", () => {
      const resolution = versionManager.resolve({
        current: "test-module",
        available: ["1.0.0", "2.0.0"],
        range: "^1.0.0",
        strategy: "compatible",
      });

      expect(resolution.compatible).toBe(true);
      expect(resolution.selected).toBe("1.1.0");
    });

    it("should check constraint satisfaction", () => {
      versionManager.setConstraint("test-module", "^1.0.0");
      expect(versionManager.satisfiesConstraint("test-module", "1.5.0")).toBe(true);
      expect(versionManager.satisfiesConstraint("test-module", "2.0.0")).toBe(false);
    });
  });

  describe("shared dependencies integration", () => {
    let sharedDeps: SharedDeps;

    beforeEach(() => {
      sharedDeps = new SharedDeps({
        dependencies: {
          react: {
            requiredVersion: "^18.0.0",
            strictVersion: false,
            singleton: true,
          },
        },
        singleton: true,
        strictVersion: false,
        requiredVersion: "*",
      });
    });

    it("should initialize and share dependencies", async () => {
      await sharedDeps.init();
      expect(sharedDeps.isReady()).toBe(true);
    });

    it("should register singleton instances", () => {
      const reactInstance = { createElement: () => null };
      sharedDeps.register("react", reactInstance, "18.0.0");

      const singleton = sharedDeps.getSingleton("react");
      expect(singleton?.instance).toBe(reactInstance);
    });
  });

  describe("cache integration", () => {
    let cache: CacheManager;

    beforeEach(() => {
      cache = new CacheManager(10, 60000);
    });

    it("should cache and retrieve modules", () => {
      cache.set("test", { value: 42 });
      expect(cache.has("test")).toBe(true);

      const retrieved = cache.get("test");
      expect(retrieved).toEqual({ value: 42 });
    });

    it("should handle cache expiration", () => {
      cache.setWithTTL("test", { value: 1 }, 100);
      expect(cache.has("test")).toBe(true);

      // After expiration
      cache.setWithTTL("test2", { value: 2 }, 1);
      setTimeout(() => {
        expect(cache.has("test2")).toBe(false);
      }, 10);
    });

    it("should clear expired entries", () => {
      cache.setWithTTL("test", { value: 1 }, 1);
      setTimeout(() => {
        const cleared = cache.clearExpired();
        expect(cleared).toBeGreaterThan(0);
      }, 10);
    });
  });
});

describe("utility functions", () => {
  describe("createHost", () => {
    it("should create host with options", () => {
      const host = createHost({
        name: "my-host",
        remotes: [
          { name: "remote1", entry: "http://localhost:3001/entry.js" },
        ],
        shared: {
          react: { requiredVersion: "^18.0.0", singleton: true },
        },
      });

      expect(host).toBeDefined();
      expect(host.getConfig().name).toBe("my-host");
    });

    it("should handle empty remotes", () => {
      const host = createHost({
        name: "standalone-host",
        remotes: [],
      });

      expect(host).toBeDefined();
      expect(host.getAllRemotes().length).toBe(0);
    });
  });

  describe("createRemote", () => {
    it("should create remote with options", () => {
      const remote = createRemote({
        name: "my-remote",
        exposes: {
          "./Component": "./src/Component.tsx",
          "./Button": "./src/Button.tsx",
        },
        shared: {
          react: { requiredVersion: "^18.0.0", singleton: true },
        },
      });

      expect(remote).toBeDefined();
      expect(remote.getConfig().name).toBe("my-remote");
    });

    it("should handle empty exposes", () => {
      const remote = createRemote({
        name: "empty-remote",
        exposes: {},
      });

      expect(remote).toBeDefined();
      expect(remote.getExposes().length).toBe(0);
    });
  });
});

describe("end-to-end scenarios", () => {
  it("should load remote module with caching", async () => {
    const loader = new ModuleLoader({ strategy: "eager" });
    const cache = new CacheManager(10, 60000);

    const factory = vi.fn().mockResolvedValue({ version: "1.0.0" });
    const info = { id: "cached-module", name: "CachedModule", version: "1.0.0" };

    // First load
    const result1 = await loader.loadModule(factory, info);
    cache.set("cached-module", result1.module, info);

    // Second load - should be cached
    const cached = cache.getCached("cached-module");
    expect(cached).toBeDefined();

    // Load again
    const result2 = await loader.loadModule(factory, info);
    expect(result2.module).toBeDefined();
  });

  it("should handle version upgrade with migration", async () => {
    const versionManager = new VersionManager();
    const swapper = new HotSwapper();

    versionManager.registerVersions("upgradable", ["1.0.0", "2.0.0"]);
    versionManager.setCurrentVersion("upgradable", "1.0.0");

    versionManager.registerMigration("upgradable", "1.0.0", "2.0.0", [
      {
        description: "Migrate state",
        transform: (data) => ({ ...data, upgraded: true }),
      },
    ]);

    const resolution = versionManager.resolve({
      current: "upgradable",
      available: ["2.0.0"],
      range: "*",
      strategy: "latest",
    });

    expect(resolution.migrations.length).toBeGreaterThan(0);
  });

  it("should handle shared dependencies across modules", async () => {
    const sharedDeps = new SharedDeps();

    const reactInstance = { createElement: () => null };

    sharedDeps.register("react", reactInstance, "18.0.0");

    // Multiple modules should get same instance
    const instance1 = sharedDeps.get("react", "module1");
    const instance2 = sharedDeps.get("react", "module2");

    expect(instance1).toBe(reactInstance);
    expect(instance2).toBe(reactInstance);
  });

  it("should handle hot swap with state preservation", async () => {
    const swapper = new HotSwapper({ preserveState: true });

    const container = document.createElement("div");
    container.setAttribute("data-module", "stateful");
    container.innerHTML = '<input name="test" value="preserved" />';
    document.body.appendChild(container);

    const oldModule = {
      id: "stateful",
      name: "Stateful",
      version: "1.0.0",
      url: "http://localhost:3000/stateful.js",
      loaded: true,
      timestamp: Date.now(),
    };

    const newFactory = vi.fn().mockResolvedValue({ version: "2.0.0" });

    const result = await swapper.swapModule(oldModule, newFactory, container);

    expect(result.success).toBe(true);
    expect(result.statePreserved).toBe(true);

    document.body.removeChild(container);
  });
});

describe("error scenarios", () => {
  it("should handle remote load failure gracefully", async () => {
    const host = new FederationHost({
      name: "error-host",
      filename: "host.js",
      exposes: [],
      remotes: [{
        name: "bad-remote",
        entry: "http://invalid:9999/entry.js",
        entryGlobal: "badRemote",
        scope: "bad-remote",
      }],
      shared: [],
      version: "1.0.0",
    });

    // Should handle error without throwing
    try {
      await host.initialize();
    } catch (e) {
      // Expected to fail or handle gracefully
    }

    expect(host).toBeDefined();
  });

  it("should handle hot swap rollback", async () => {
    const swapper = new HotSwapper({ rollbackOnError: true });

    const module = {
      id: "unstable",
      name: "Unstable",
      version: "1.0.0",
      url: "http://localhost:3000/unstable.js",
      loaded: true,
      timestamp: Date.now(),
    };

    const failingFactory = vi.fn().mockRejectedValue(new Error("Load failed"));

    try {
      await swapper.swapModule(module, failingFactory);
    } catch (e) {
      // Expected to fail
    }

    const history = swapper.getSwapHistory();
    expect(history[history.length - 1].success).toBe(false);
  });

  it("should handle version conflicts", () => {
    const versionManager = new VersionManager();

    versionManager.registerVersions("conflict", ["1.0.0", "2.0.0"]);
    versionManager.setConstraint("conflict", "^3.0.0");

    const conflicts = versionManager.checkConflicts();
    const conflictConflicts = conflicts.filter((c) => c.module === "conflict");

    expect(conflictConflicts.length).toBeGreaterThan(0);
  });
});
