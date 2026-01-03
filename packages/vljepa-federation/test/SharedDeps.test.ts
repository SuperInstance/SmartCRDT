/**
 * SharedDeps Tests
 * Tests for shared dependencies management
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SharedDeps, createDefaultSharedDeps } from "../src/sharing/SharedDeps.js";

describe("SharedDeps", () => {
  let sharedDeps: SharedDeps;

  beforeEach(() => {
    sharedDeps = new SharedDeps({
      dependencies: {
        react: {
          requiredVersion: "^18.0.0",
          strictVersion: false,
          singleton: true,
        },
        "react-dom": {
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

  describe("initialization", () => {
    it("should create with default config", () => {
      const defaultDeps = new SharedDeps();
      expect(defaultDeps).toBeDefined();
    });

    it("should create with custom config", () => {
      const customDeps = new SharedDeps({
        singleton: false,
        strictVersion: true,
      });
      expect(customDeps.getConfig().singleton).toBe(false);
    });

    it("should get config", () => {
      const config = sharedDeps.getConfig();
      expect(config.singleton).toBe(true);
      expect(config.dependencies).toHaveProperty("react");
    });
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await sharedDeps.init();
      expect(sharedDeps.isReady()).toBe(true);
    });

    it("should initialize only once", async () => {
      await sharedDeps.init();
      await sharedDeps.init();
      expect(sharedDeps.isReady()).toBe(true);
    });

    it("should initialize with custom scope", async () => {
      await sharedDeps.init("custom");
      expect(sharedDeps.isReady()).toBe(true);
    });
  });

  describe("dependency registration", () => {
    it("should register dependency", () => {
      sharedDeps.addShared("lodash", {
        requiredVersion: "^4.0.0",
        strictVersion: false,
        singleton: false,
      });

      const all = sharedDeps.getAllShared();
      expect(all).toHaveProperty("lodash");
    });

    it("should remove shared dependency", () => {
      sharedDeps.addShared("temp", {
        requiredVersion: "1.0.0",
        strictVersion: false,
        singleton: false,
      });

      sharedDeps.removeShared("temp");

      const all = sharedDeps.getAllShared();
      expect(all).not.toHaveProperty("temp");
    });

    it("should get all shared dependencies", () => {
      const all = sharedDeps.getAllShared();
      expect(Object.keys(all)).toContain("react");
      expect(Object.keys(all)).toContain("react-dom");
    });
  });

  describe("singleton management", () => {
    it("should register singleton", () => {
      const instance = { render: () => null };
      sharedDeps.register("react", instance, "18.0.0");

      const singleton = sharedDeps.getSingleton("react");
      expect(singleton).toBeDefined();
      expect(singleton?.instance).toBe(instance);
    });

    it("should get singleton", () => {
      const instance = { createElement: () => null };
      sharedDeps.register("react", instance, "18.0.0");

      const retrieved = sharedDeps.get("react");
      expect(retrieved).toBe(instance);
    });

    it("should check if dependency is shared", () => {
      expect(sharedDeps.isShared("react")).toBe(true);
      expect(sharedDeps.isShared("non-existent")).toBe(false);
    });

    it("should check if dependency is singleton", () => {
      expect(sharedDeps.isSingleton("react")).toBe(true);
    });

    it("should get all singletons", () => {
      const instance1 = { foo: () => null };
      const instance2 = { bar: () => null };

      sharedDeps.register("dep1", instance1, "1.0.0");
      sharedDeps.register("dep2", instance2, "1.0.0");

      const all = sharedDeps.getAllSingletons();
      expect(all.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("scope management", () => {
    it("should create scope", () => {
      sharedDeps.createScope("custom");
      const scope = sharedDeps.getScope("custom");
      expect(scope).toBeDefined();
    });

    it("should get scope names", () => {
      sharedDeps.createScope("scope1");
      sharedDeps.createScope("scope2");

      const names = sharedDeps.getScopeNames();
      expect(names).toContain("scope1");
      expect(names).toContain("scope2");
    });

    it("should share module between scopes", () => {
      sharedDeps.createScope("scope1");
      sharedDeps.createScope("scope2");

      const instance = { shared: true };
      sharedDeps.register("shared", instance, "1.0.0");

      sharedDeps.shareModule("shared", instance, "default", "scope2");

      const fromScope2 = sharedDeps.get("shared", "scope2");
      expect(fromScope2).toBe(instance);
    });
  });

  describe("config management", () => {
    it("should export config", () => {
      const config = sharedDeps.exportConfig();
      expect(config.dependencies).toHaveProperty("react");
      expect(config.singleton).toBe(true);
    });

    it("should import config", () => {
      const newConfig = {
        dependencies: {
          vue: {
            requiredVersion: "^3.0.0",
            strictVersion: false,
            singleton: true,
          },
        },
        singleton: true,
        strictVersion: false,
        requiredVersion: "*",
      };

      sharedDeps.importConfig(newConfig);

      const all = sharedDeps.getAllShared();
      expect(all).toHaveProperty("vue");
    });

    it("should update config", () => {
      sharedDeps.importConfig({
        dependencies: {},
        singleton: false,
        strictVersion: true,
        requiredVersion: "1.0.0",
      });

      const config = sharedDeps.getConfig();
      expect(config.singleton).toBe(false);
      expect(config.strictVersion).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset state", async () => {
      await sharedDeps.init();
      sharedDeps.register("test", {}, "1.0.0");

      sharedDeps.reset();

      expect(sharedDeps.isReady()).toBe(false);
    });
  });
});

describe("createDefaultSharedDeps", () => {
  it("should create default shared deps config", () => {
    const config = createDefaultSharedDeps();

    expect(config.dependencies).toHaveProperty("react");
    expect(config.dependencies).toHaveProperty("react-dom");
    expect(config.dependencies).toHaveProperty("@lsi/vljepa");
    expect(config.dependencies).toHaveProperty("@lsi/protocol");
  });

  it("should have correct React config", () => {
    const config = createDefaultSharedDeps();
    const react = config.dependencies.react;

    expect(react.requiredVersion).toBe("^18.0.0");
    expect(react.singleton).toBe(true);
    expect(react.strictVersion).toBe(false);
  });

  it("should have correct protocol config", () => {
    const config = createDefaultSharedDeps();
    const protocol = config.dependencies["@lsi/protocol"];

    expect(protocol.requiredVersion).toBe("^1.0.0");
    expect(protocol.singleton).toBe(true);
    expect(protocol.strictVersion).toBe(true);
  });

  it("should have non-singleton VL-JEPA", () => {
    const config = createDefaultSharedDeps();
    const vljepa = config.dependencies["@lsi/vljepa"];

    expect(vljepa.singleton).toBe(false);
    expect(vljepa.strictVersion).toBe(false);
  });
});

describe("SharedDeps edge cases", () => {
  it("should handle empty dependencies", async () => {
    const deps = new SharedDeps({
      dependencies: {},
      singleton: true,
      strictVersion: false,
      requiredVersion: "*",
    });

    await deps.init();
    expect(deps.isReady()).toBe(true);
  });

  it("should handle missing singleton", () => {
    const deps = new SharedDeps();
    const singleton = deps.getSingleton("non-existent");
    expect(singleton).toBeUndefined();
  });

  it("should handle multiple scopes", () => {
    const deps = new SharedDeps();
    deps.createScope("scope1");
    deps.createScope("scope2");
    deps.createScope("scope3");

    expect(deps.getScopeNames().length).toBe(3);
  });

  it("should handle non-existent scope", () => {
    const deps = new SharedDeps();
    const scope = deps.getScope("non-existent");
    expect(scope).toBeUndefined();
  });
});
