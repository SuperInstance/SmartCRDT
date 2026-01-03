/**
 * VersionManager Tests
 * Tests for version management and resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VersionManager } from "../src/runtime/VersionManager.js";

describe("VersionManager", () => {
  let manager: VersionManager;

  beforeEach(() => {
    manager = new VersionManager();
  });

  describe("version registration", () => {
    it("should register version for module", () => {
      manager.registerVersion("test-module", "1.0.0");
      const versions = manager.getVersions("test-module");
      expect(versions).toContain("1.0.0");
    });

    it("should register multiple versions", () => {
      manager.registerVersions("test-module", ["1.0.0", "1.1.0", "2.0.0"]);
      const versions = manager.getVersions("test-module");
      expect(versions).toHaveLength(3);
    });

    it("should not duplicate versions", () => {
      manager.registerVersion("test-module", "1.0.0");
      manager.registerVersion("test-module", "1.0.0");
      const versions = manager.getVersions("test-module");
      expect(versions).toHaveLength(1);
    });

    it("should sort versions newest first", () => {
      manager.registerVersions("test-module", ["1.0.0", "2.0.0", "1.1.0"]);
      const versions = manager.getVersions("test-module");
      expect(versions[0]).toBe("2.0.0");
      expect(versions[2]).toBe("1.0.0");
    });
  });

  describe("version queries", () => {
    beforeEach(() => {
      manager.registerVersions("test-module", ["1.0.0", "1.1.0", "2.0.0", "2.1.0"]);
    });

    it("should get all versions", () => {
      const versions = manager.getVersions("test-module");
      expect(versions).toHaveLength(4);
    });

    it("should get latest version", () => {
      const latest = manager.getLatestVersion("test-module");
      expect(latest).toBe("2.1.0");
    });

    it("should return undefined for non-existent module", () => {
      const versions = manager.getVersions("non-existent");
      expect(versions).toHaveLength(0);
    });

    it("should return undefined for latest of non-existent", () => {
      const latest = manager.getLatestVersion("non-existent");
      expect(latest).toBeUndefined();
    });
  });

  describe("current version tracking", () => {
    it("should set current version", () => {
      manager.setCurrentVersion("test-module", "1.0.0");
      expect(manager.getCurrentVersion("test-module")).toBe("1.0.0");
    });

    it("should get current version", () => {
      manager.setCurrentVersion("test-module", "2.0.0");
      expect(manager.getCurrentVersion("test-module")).toBe("2.0.0");
    });

    it("should return undefined for non-existent current", () => {
      expect(manager.getCurrentVersion("non-existent")).toBeUndefined();
    });
  });

  describe("version resolution", () => {
    beforeEach(() => {
      manager.registerVersions("test-module", ["1.0.0", "1.1.0", "2.0.0"]);
    });

    it("should resolve to latest version", () => {
      const resolution = manager.resolve({
        current: "test-module",
        available: ["1.0.0", "2.0.0"],
        range: "*",
        strategy: "latest",
      });

      expect(resolution.selected).toBe("2.0.0");
      expect(resolution.compatible).toBe(true);
    });

    it("should resolve compatible version", () => {
      const resolution = manager.resolve({
        current: "test-module",
        available: ["1.0.0", "2.0.0"],
        range: "^1.0.0",
        strategy: "compatible",
      });

      expect(resolution.selected).toBe("1.1.0");
      expect(resolution.compatible).toBe(true);
    });

    it("should resolve exact version", () => {
      const resolution = manager.resolve({
        current: "test-module",
        available: ["1.0.0", "2.0.0"],
        range: "1.0.0",
        strategy: "exact",
      });

      expect(resolution.selected).toBe("1.0.0");
    });

    it("should detect conflicts", () => {
      const resolution = manager.resolve({
        current: "test-module",
        available: ["2.0.0"],
        range: "^3.0.0",
        strategy: "compatible",
      });

      expect(resolution.compatible).toBe(false);
      expect(resolution.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe("migrations", () => {
    it("should register migration", () => {
      manager.registerMigration("test-module", "1.0.0", "2.0.0", [
        {
          description: "Test migration",
          transform: (data) => data,
        },
      ]);

      expect(manager.getMigration("test-module", "1.0.0", "2.0.0")).toBeDefined();
    });

    it("should handle migration in resolution", () => {
      manager.registerMigration("test-module", "1.0.0", "2.0.0", [
        { description: "Upgrade", transform: (d) => d },
      ]);

      manager.setCurrentVersion("test-module", "1.0.0");

      const resolution = manager.resolve({
        current: "test-module",
        available: ["1.0.0", "2.0.0"],
        range: "*",
        strategy: "latest",
      });

      // Migration should be included
      expect(resolution.migrations).toBeDefined();
    });
  });

  describe("version constraints", () => {
    it("should set constraint", () => {
      manager.setConstraint("test-module", "^1.0.0");
      expect(manager.getConstraint("test-module")).toBe("^1.0.0");
    });

    it("should get constraint", () => {
      manager.setConstraint("test-module", "~2.0.0");
      expect(manager.getConstraint("test-module")).toBe("~2.0.0");
    });

    it("should check if version satisfies constraint", () => {
      manager.setConstraint("test-module", "^1.0.0");
      expect(manager.satisfiesConstraint("test-module", "1.5.0")).toBe(true);
      expect(manager.satisfiesConstraint("test-module", "2.0.0")).toBe(false);
    });

    it("should return true when no constraint", () => {
      expect(manager.satisfiesConstraint("test-module", "99.0.0")).toBe(true);
    });
  });

  describe("version comparison", () => {
    it("should compare versions", () => {
      expect(manager.compare("2.0.0", "1.0.0")).toBeGreaterThan(0);
      expect(manager.compare("1.0.0", "2.0.0")).toBeLessThan(0);
      expect(manager.compare("1.0.0", "1.0.0")).toBe(0);
    });

    it("should get version diff", () => {
      expect(manager.diff("2.0.0", "1.0.0")).toBe("major");
      expect(manager.diff("1.1.0", "1.0.0")).toBe("minor");
      expect(manager.diff("1.0.1", "1.0.0")).toBe("patch");
      expect(manager.diff("1.0.0", "1.0.0")).toBeNull();
    });

    it("should increment version", () => {
      expect(manager.increment("1.0.0", "major")).toBe("2.0.0");
      expect(manager.increment("1.0.0", "minor")).toBe("1.1.0");
      expect(manager.increment("1.0.0", "patch")).toBe("1.0.1");
    });
  });

  describe("version validation", () => {
    it("should validate correct version", () => {
      expect(manager.isValid("1.0.0")).toBe(true);
      expect(manager.isValid("2.1.3")).toBe(true);
    });

    it("should validate incorrect version", () => {
      expect(manager.isValid("invalid")).toBe(false);
      expect(manager.isValid("1.0")).toBe(false);
    });

    it("should clean version string", () => {
      expect(manager.clean("v1.0.0")).toBe("1.0.0");
      expect(manager.clean(" =v1.0.0 ")).toBe("1.0.0");
      expect(manager.clean("invalid")).toBeNull();
    });
  });

  describe("conflict detection", () => {
    beforeEach(() => {
      manager.registerVersions("module-a", ["1.0.0", "2.0.0"]);
      manager.setConstraint("module-a", "^1.0.0");
    });

    it("should check for conflicts", () => {
      const conflicts = manager.checkConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it("should identify constraint conflicts", () => {
      manager.setConstraint("module-a", "^3.0.0");
      const conflicts = manager.checkConflicts();

      // Should have conflicts since no v3 exists
      const moduleConflicts = conflicts.filter((c) => c.module === "module-a");
      expect(moduleConflicts.length).toBeGreaterThan(0);
    });
  });

  describe("module listing", () => {
    beforeEach(() => {
      manager.registerVersions("module-a", ["1.0.0"]);
      manager.registerVersions("module-b", ["1.0.0"]);
      manager.registerVersions("module-c", ["1.0.0"]);
    });

    it("should get all modules", () => {
      const modules = manager.getModules();
      expect(modules).toHaveLength(3);
      expect(modules).toContain("module-a");
      expect(modules).toContain("module-b");
      expect(modules).toContain("module-c");
    });
  });

  describe("clear operations", () => {
    it("should clear all data", () => {
      manager.registerVersion("test", "1.0.0");
      manager.setCurrentVersion("test", "1.0.0");
      manager.setConstraint("test", "^1.0.0");

      manager.clear();

      expect(manager.getVersions("test")).toHaveLength(0);
      expect(manager.getCurrentVersion("test")).toBeUndefined();
      expect(manager.getConstraint("test")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty versions array", () => {
      manager.registerVersions("empty", []);
      expect(manager.getVersions("empty")).toHaveLength(0);
    });

    it("should handle semver versions", () => {
      manager.registerVersions("test", ["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
      const versions = manager.getVersions("test");
      expect(versions).toContain("1.0.0");
    });

    it("should handle prerelease versions", () => {
      manager.registerVersion("test", "1.0.0-rc.1");
      const versions = manager.getVersions("test");
      expect(versions).toContain("1.0.0-rc.1");
    });
  });
});

describe("VersionManager edge cases", () => {
  it("should handle very large version numbers", () => {
    const manager = new VersionManager();
    manager.registerVersion("test", "999.999.999");
    expect(manager.getVersions("test")).toContain("999.999.999");
  });

  it("should handle zero versions", () => {
    const manager = new VersionManager();
    manager.registerVersions("test", ["0.0.1", "0.1.0", "1.0.0"]);
    const versions = manager.getVersions("test");
    expect(versions[0]).toBe("1.0.0");
    expect(versions[2]).toBe("0.0.1");
  });

  it("should handle same version registration", () => {
    const manager = new VersionManager();
    manager.registerVersion("test", "1.0.0");
    manager.registerVersion("test", "1.0.0");
    manager.registerVersion("test", "1.0.0");
    expect(manager.getVersions("test")).toHaveLength(1);
  });
});
