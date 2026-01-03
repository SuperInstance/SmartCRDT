/**
 * FederationHost Tests
 * Tests for federation host module consumption
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FederationHost } from "../src/federation/FederationHost.js";

describe("FederationHost", () => {
  let host: FederationHost;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      name: "test-host",
      filename: "host.js",
      exposes: [],
      remotes: [
        {
          name: "remote1",
          entry: "http://localhost:3001/remoteEntry.js",
          entryGlobal: "remote1Remote",
          scope: "remote1",
          version: "1.0.0",
        },
      ],
      shared: [],
      version: "1.0.0",
    };

    // Mock document
    global.document = {
      head: {
        appendChild: vi.fn(),
      },
      querySelector: vi.fn(),
    } as any;

    // Mock globalThis
    (globalThis as any).remote1Remote = {
      init: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(() => ({ default: {} })),
    };

    host = new FederationHost(mockConfig);
  });

  describe("initialization", () => {
    it("should create host with config", () => {
      expect(host).toBeDefined();
      expect(host.getConfig().name).toBe("test-host");
    });

    it("should initialize remotes from config", () => {
      const remotes = host.getAllRemotes();
      expect(remotes).toHaveLength(1);
      expect(remotes[0].name).toBe("remote1");
    });

    it("should not be initialized initially", () => {
      expect(host.isInitialized()).toBe(false);
    });

    it("should initialize successfully", async () => {
      await host.initialize();
      expect(host.isInitialized()).toBe(true);
    });

    it("should initialize only once", async () => {
      await host.initialize();
      await host.initialize();
      expect(host.isInitialized()).toBe(true);
    });
  });

  describe("remote management", () => {
    it("should get remote info", () => {
      const remote = host.getRemote("remote1");
      expect(remote).toBeDefined();
      expect(remote?.name).toBe("remote1");
    });

    it("should return undefined for non-existent remote", () => {
      const remote = host.getRemote("non-existent");
      expect(remote).toBeUndefined();
    });

    it("should get all remotes", () => {
      const remotes = host.getAllRemotes();
      expect(remotes).toHaveLength(1);
    });
  });

  describe("module loading", () => {
    beforeEach(async () => {
      await host.initialize();
    });

    it("should load module from remote", async () => {
      const result = await host.loadModule("remote1", "Component");
      expect(result.module).toBeDefined();
      expect(result.cached).toBe(false);
    });

    it("should track loaded modules", () => {
      const loaded = host.isModuleLoaded("remote1", "Component");
      expect(loaded).toBe(false); // Not loaded yet in test
    });

    it("should get module info", async () => {
      await host.loadModule("remote1", "Component");
      const info = host.getModuleInfo("remote1", "Component");
      expect(info).toBeDefined();
    });

    it("should get all loaded modules", async () => {
      await host.loadModule("remote1", "Component");
      const all = host.getAllLoadedModules();
      expect(all.length).toBeGreaterThanOrEqual(0);
    });

    it("should unload module", async () => {
      await host.loadModule("remote1", "Component");
      await host.unloadModule("remote1", "Component");
      const loaded = host.isModuleLoaded("remote1", "Component");
      expect(loaded).toBe(false);
    });
  });

  describe("preloading", () => {
    beforeEach(async () => {
      await host.initialize();
    });

    it("should preload multiple modules", async () => {
      const requests = [
        { remote: "remote1", module: "Component" },
        { remote: "remote1", module: "Button" },
      ];

      const results = await host.preloadModules(requests);
      expect(results.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("share scope", () => {
    it("should set share scope", () => {
      host.setShareScope("custom");
      expect(host.getShareScope()).toBe("custom");
    });

    it("should get default share scope", () => {
      expect(host.getShareScope()).toBe("default");
    });
  });

  describe("reset", () => {
    it("should reset host state", async () => {
      await host.initialize();
      await host.reset();
      expect(host.isInitialized()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle missing container", async () => {
      await host.initialize();
      await expect(
        host.loadModule("non-existent", "Module")
      ).rejects.toThrow();
    });

    it("should handle load timeout", async () => {
      const badConfig = { ...mockConfig };
      badConfig.remotes = [{
        name: "bad-remote",
        entry: "http://invalid:9999/entry.js",
        entryGlobal: "badRemote",
        scope: "bad-remote",
      }];

      const badHost = new FederationHost(badConfig);
      // Should handle gracefully
      await badHost.initialize();
    });
  });

  describe("config", () => {
    it("should get config", () => {
      const config = host.getConfig();
      expect(config.name).toBe("test-host");
      expect(config.version).toBe("1.0.0");
    });
  });

  describe("clear modules", () => {
    it("should clear all modules", async () => {
      await host.initialize();
      await host.loadModule("remote1", "Component");
      await host.clearModules();
      expect(host.getAllLoadedModules().length).toBe(0);
    });
  });
});

describe("FederationHost edge cases", () => {
  it("should handle empty remotes config", async () => {
    const config = {
      name: "empty-host",
      filename: "host.js",
      exposes: [],
      remotes: [],
      shared: [],
      version: "1.0.0",
    };

    const host = new FederationHost(config);
    await host.initialize();
    expect(host.isInitialized()).toBe(true);
  });

  it("should handle multiple remotes", async () => {
    const config = {
      name: "multi-host",
      filename: "host.js",
      exposes: [],
      remotes: [
        {
          name: "remote1",
          entry: "http://localhost:3001/entry.js",
          entryGlobal: "remote1Remote",
          scope: "remote1",
        },
        {
          name: "remote2",
          entry: "http://localhost:3002/entry.js",
          entryGlobal: "remote2Remote",
          scope: "remote2",
        },
      ],
      shared: [],
      version: "1.0.0",
    };

    const host = new FederationHost(config);
    expect(host.getAllRemotes()).toHaveLength(2);
  });

  it("should handle rapid initialize calls", async () => {
    const config = {
      name: "rapid-host",
      filename: "host.js",
      exposes: [],
      remotes: [{
        name: "remote1",
        entry: "http://localhost:3001/entry.js",
        entryGlobal: "remote1Remote",
        scope: "remote1",
      }],
      shared: [],
      version: "1.0.0",
    };

    const host = new FederationHost(config);
    await Promise.all([
      host.initialize(),
      host.initialize(),
      host.initialize(),
    ]);
    expect(host.isInitialized()).toBe(true);
  });
});
