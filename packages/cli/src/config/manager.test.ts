/**
 * Tests for configuration manager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigManager } from "./manager.js";
import type { AequorConfig } from "./types.js";

describe("ConfigManager", () => {
  let tempDir: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = join(tmpdir(), `aequor-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Create a test config manager with temp directory
    manager = new (class extends ConfigManager {
      override getConfigPath(): string {
        return join(tempDir, "config.json");
      }

      override getCacheDir(): string {
        return join(tempDir, "cache");
      }
    })();
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("should create default config if none exists", async () => {
      const config = await manager.load();

      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.backend).toBeDefined();
      expect(config.routing).toBeDefined();
    });

    it("should load existing config", async () => {
      // First load creates default
      await manager.load();

      // Second load should read the file
      const config2 = await manager.load();
      expect(config2).toBeDefined();
    });
  });

  describe("get", () => {
    it("should get nested config values", async () => {
      const type = await manager.get("backend.type");
      expect(type).toBe("hybrid"); // default value

      const threshold = await manager.get("routing.complexityThreshold");
      expect(threshold).toBe(0.7); // default value
    });

    it("should return undefined for non-existent keys", async () => {
      const value = await manager.get("nonexistent.key");
      expect(value).toBeUndefined();
    });
  });

  describe("set", () => {
    it("should set config values", async () => {
      await manager.set("backend.type", "local");

      const type = await manager.get("backend.type");
      expect(type).toBe("local");
    });

    it("should set nested config values", async () => {
      await manager.set("routing.complexityThreshold", 0.8);

      const threshold = await manager.get("routing.complexityThreshold");
      expect(threshold).toBe(0.8);
    });

    it("should persist changes", async () => {
      await manager.set("backend.type", "cloud");

      // Create new manager instance to test persistence
      const manager2 = new (class extends ConfigManager {
        override getConfigPath(): string {
          return join(tempDir, "config.json");
        }

        override getCacheDir(): string {
          return join(tempDir, "cache");
        }
      })();

      const type = await manager2.get("backend.type");
      expect(type).toBe("cloud");
    });
  });

  describe("has", () => {
    it("should return true for existing keys", async () => {
      const hasBackend = await manager.has("backend.type");
      expect(hasBackend).toBe(true);
    });

    it("should return false for non-existent keys", async () => {
      const hasNonExistent = await manager.has("nonexistent.key");
      expect(hasNonExistent).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete config values", async () => {
      await manager.set("test.key", "test-value");
      expect(await manager.has("test.key")).toBe(true);

      await manager.delete("test.key");
      expect(await manager.has("test.key")).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset to defaults", async () => {
      await manager.set("backend.type", "cloud");
      expect(await manager.get("backend.type")).toBe("cloud");

      await manager.reset();
      expect(await manager.get("backend.type")).toBe("hybrid"); // default
    });
  });

  describe("cache management", () => {
    it("should initialize cache directory", async () => {
      await manager.initCacheDir();

      // Should not throw
      const size = await manager.getCacheSize();
      expect(size).toBeGreaterThanOrEqual(0);
    });

    it("should clear cache", async () => {
      await manager.initCacheDir();
      await manager.clearCache();

      const size = await manager.getCacheSize();
      expect(size).toBe(0);
    });
  });

  describe("convenience methods", () => {
    it("should get and set API key", async () => {
      await manager.setApiKey("test-api-key");
      const key = await manager.getApiKey();

      expect(key).toBe("test-api-key");
    });

    it("should get and set default model", async () => {
      await manager.setDefaultModel("gpt-4");
      const model = await manager.getDefaultModel();

      expect(model).toBe("gpt-4");
    });
  });
});
