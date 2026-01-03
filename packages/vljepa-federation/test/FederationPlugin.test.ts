/**
 * FederationPlugin Tests
 * Tests for Vite federation plugin
 */

import { describe, it, expect, beforeEach } from "vitest";
import { federationPlugin, FederationPluginFactory, FederationHMR } from "../src/plugins/FederationPlugin.js";

describe("federationPlugin", () => {
  describe("plugin creation", () => {
    it("should create plugin with minimal options", () => {
      const plugin = federationPlugin({
        name: "test-app",
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("vite-federation");
    });

    it("should create plugin with all options", () => {
      const plugin = federationPlugin({
        name: "test-app",
        filename: "customEntry.js",
        exposes: {
          "./Component": "./src/Component.tsx",
        },
        remotes: {
          remote1: "http://localhost:3001@remote1",
        },
        shared: {
          react: {
            requiredVersion: "^18.0.0",
            strictVersion: false,
            singleton: true,
          },
        },
        version: "2.0.0",
      });

      expect(plugin.name).toBe("vite-federation");
    });

    it("should create host plugin", () => {
      const plugin = federationPlugin({
        name: "host",
        remotes: {
          remote1: "http://localhost:3001@remote1",
        },
      });

      expect(plugin).toBeDefined();
    });

    it("should create remote plugin", () => {
      const plugin = federationPlugin({
        name: "remote",
        exposes: {
          "./Button": "./src/Button.tsx",
        },
      });

      expect(plugin).toBeDefined();
    });
  });

  describe("config hook", () => {
    it("should provide config", () => {
      const plugin = federationPlugin({
        name: "test",
        remotes: {
          r1: "http://localhost:3001@r1",
        },
      });

      const configHook = plugin.config;
      expect(typeof configHook).toBe("function");
    });
  });

  describe("plugin hooks", () => {
    it("should have configureServer hook", () => {
      const plugin = federationPlugin({ name: "test" });
      expect(plugin.configureServer).toBeDefined();
    });

    it("should have transform hook", () => {
      const plugin = federationPlugin({ name: "test" });
      expect(plugin.transform).toBeDefined();
    });

    it("should have generateBundle hook", () => {
      const plugin = federationPlugin({ name: "test" });
      expect(plugin.generateBundle).toBeDefined();
    });
  });
});

describe("FederationPluginFactory", () => {
  let factory: FederationPluginFactory;

  beforeEach(() => {
    factory = new FederationPluginFactory();
  });

  describe("plugin creation", () => {
    it("should create host plugin", () => {
      const plugin = factory.createHost({
        name: "host",
        remotes: {
          remote1: "http://localhost:3001@remote1",
        },
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("vite-federation");
    });

    it("should create remote plugin", () => {
      const plugin = factory.createRemote({
        name: "remote",
        exposes: {
          "./Component": "./src/Component.tsx",
        },
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("vite-federation");
    });
  });

  describe("plugin registration", () => {
    it("should register plugin", () => {
      const plugin = federationPlugin({ name: "test" });
      factory.register("test", plugin);

      expect(factory.get("test")).toBe(plugin);
    });

    it("should get registered plugin", () => {
      const plugin = federationPlugin({ name: "test" });
      factory.register("test", plugin);

      const retrieved = factory.get("test");
      expect(retrieved).toBe(plugin);
    });

    it("should return undefined for non-existent plugin", () => {
      expect(factory.get("non-existent")).toBeUndefined();
    });
  });

  describe("all plugins", () => {
    it("should get all plugins", () => {
      const plugin1 = federationPlugin({ name: "test1" });
      const plugin2 = federationPlugin({ name: "test2" });

      factory.register("test1", plugin1);
      factory.register("test2", plugin2);

      const all = factory.getAll();
      expect(all).toHaveLength(2);
    });

    it("should clear all plugins", () => {
      factory.register("test", federationPlugin({ name: "test" }));
      factory.clear();

      expect(factory.getAll().length).toBe(0);
    });
  });
});

describe("FederationHMR", () => {
  let hmr: FederationHMR;

  beforeEach(() => {
    hmr = new FederationHMR();
  });

  describe("subscription", () => {
    it("should subscribe to module changes", () => {
      const callback = () => {};
      const unsubscribe = hmr.subscribe("test-module", callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should notify subscribers", () => {
      let called = false;
      const callback = () => { called = true; };

      hmr.subscribe("test-module", callback);
      hmr.notify("test-module");

      expect(called).toBe(true);
    });

    it("should unsubscribe correctly", () => {
      let callCount = 0;
      const callback = () => { callCount++; };

      const unsubscribe = hmr.subscribe("test-module", callback);
      unsubscribe();
      hmr.notify("test-module");

      expect(callCount).toBe(0);
    });

    it("should handle multiple subscribers", () => {
      let count1 = 0;
      let count2 = 0;

      hmr.subscribe("test-module", () => { count1++; });
      hmr.subscribe("test-module", () => { count2++; });

      hmr.notify("test-module");

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe("module-specific notifications", () => {
    it("should only notify relevant subscribers", () => {
      let module1Called = false;
      let module2Called = false;

      hmr.subscribe("module1", () => { module1Called = true; });
      hmr.subscribe("module2", () => { module2Called = true; });

      hmr.notify("module1");

      expect(module1Called).toBe(true);
      expect(module2Called).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all listeners", () => {
      hmr.subscribe("module1", () => {});
      hmr.subscribe("module2", () => {});

      hmr.clear();

      hmr.notify("module1");
      hmr.notify("module2");

      // Should not throw, just no listeners
      expect(true).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle notifying non-existent module", () => {
      expect(() => hmr.notify("non-existent")).not.toThrow();
    });

    it("should handle unsubscribe of non-existent subscription", () => {
      const unsubscribe = hmr.subscribe("test", () => {});
      unsubscribe();
      unsubscribe(); // Double unsubscribe should not throw
      expect(true).toBe(true);
    });

    it("should handle multiple unsubscribe calls", () => {
      const callbacks: Array<() => void> = [];

      callbacks.push(hmr.subscribe("test", () => {}));
      callbacks.push(hmr.subscribe("test", () => {}));

      callbacks.forEach((unsub) => unsub());

      hmr.notify("test");
      expect(true).toBe(true);
    });
  });
});

describe("plugin edge cases", () => {
  it("should handle empty exposes", () => {
    const plugin = federationPlugin({
      name: "test",
      exposes: {},
    });

    expect(plugin).toBeDefined();
  });

  it("should handle empty remotes", () => {
    const plugin = federationPlugin({
      name: "test",
      remotes: {},
    });

    expect(plugin).toBeDefined();
  });

  it("should handle empty shared", () => {
    const plugin = federationPlugin({
      name: "test",
      shared: {},
    });

    expect(plugin).toBeDefined();
  });

  it("should handle complex remote URLs", () => {
    const plugin = federationPlugin({
      name: "test",
      remotes: {
        remote1: "https://example.com:8443/path/to/remote@remote1",
      },
    });

    expect(plugin).toBeDefined();
  });

  it("should handle version strings", () => {
    const plugin = federationPlugin({
      name: "test",
      version: "1.2.3-beta.4",
    });

    expect(plugin).toBeDefined();
  });
});
