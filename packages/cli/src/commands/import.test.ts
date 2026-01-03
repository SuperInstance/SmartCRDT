/**
 * Import command tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createImportCommand } from "./import.js";
import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";
import configManager from "../config/manager.js";

// Mock dependencies
vi.mock("../config/manager.js");
vi.mock("fs");

describe("Import Command", () => {
  let mockConfig: any;
  let mockFs: any;

  beforeEach(() => {
    mockConfig = {
      knowledge: { directory: "./knowledge" },
      cache: { directory: "./cache" },
      logging: { directory: "./logs" },
    };

    (configManager.getAll as any).mockResolvedValue(mockConfig);
    (configManager.save as any).mockResolvedValue(undefined);

    mockFs = {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      appendFile: vi.fn(),
    };

    (fs.access as any).mockImplementation(mockFs.access);
    (fs.readFile as any).mockImplementation(mockFs.readFile);
    (fs.writeFile as any).mockImplementation(mockFs.writeFile);
    (fs.mkdir as any).mockImplementation(mockFs.mkdir);
    (fs.appendFile as any).mockImplementation(mockFs.appendFile);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("command creation", () => {
    it("should create import command with correct options", () => {
      const cmd = createImportCommand();
      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("import");
      expect(cmd.argumentCount()).toBe(1);
    });
  });

  describe("format detection", () => {
    it("should detect JSON format", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json"]);

      expect(fs.readFile).toHaveBeenCalledWith("test.json", "utf8");
    });

    it("should detect JSONL format", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"data":{}}

{"data":{}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.jsonl"]);

      expect(fs.readFile).toHaveBeenCalledWith("test.jsonl", "utf8");
    });

    it("should detect cartridge format", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-cartridge","data":{}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.cartridge"]);

      expect(fs.readFile).toHaveBeenCalledWith("test.cartridge", "utf8");
    });
  });

  describe("import validation", () => {
    it("should validate file structure", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "--validate"]);

      expect(fs.readFile).toHaveBeenCalledWith("test.json", "utf8");
    });

    it("should reject invalid cartridges", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"data":{}}');

      await expect(async () => {
        await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "--validate"]);
      }).rejects.toThrow("Invalid cartridge format");
    });

    it("should reject invalid JSONL", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"valid": true}\nnot-json');

      await expect(async () => {
        await cmdObj.parseAsync(["node", "aequor", "import", "test.jsonl", "--validate"]);
      }).rejects.toThrow("Failed to parse line");
    });
  });

  describe("dry run functionality", () => {
    it("should preview import without executing", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{"knowledge":{"entries":[{"id":"1"}]}}}');

      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation();

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "--dry-run"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Previewing import"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("1 items"));
      expect(fs.writeFile).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("import modes", () => {
    it("should skip existing files in skip mode", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access
        .mockResolvedValueOnce(undefined) // File exists
        .mockResolvedValueOnce(new Error("ENOENT")); // File doesn't exist

      mockFs.readFile.mockResolvedValue('{"test": "data"}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-m", "skip"]);

      // Should write only the second file
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
    });

    it("should replace existing files in replace mode", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"test": "data"}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-m", "replace"]);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("type filtering", () => {
    it("should import only knowledge", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{"knowledge":{"entries":[{"id":"1"}]}}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-t", "knowledge"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".json"),
        expect.stringContaining('"id":"1"')
      );
    });

    it("should import only cache", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{"cache":{"entries":[{"query":"test"}]}}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-t", "cache"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("cache_"),
        expect.stringContaining('"query":"test"')
      );
    });

    it("should import configuration", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{"config":{"cache":{"enabled":true}}}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-t", "config"]);

      expect(configManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: expect.objectContaining({ enabled: true }),
        })
      );
    });

    it("should import logs", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"type":"aequor-export","data":{"logs":{"entries":[{"timestamp":"2025-01-01"}]}}}');

      await cmdObj.parseAsync(["node", "aequor", "import", "test.json", "-t", "logs"]);

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining("imported.log"),
        expect.stringContaining('"timestamp":"2025-01-01"')
      );
    });
  });

  describe("error handling", () => {
    it("should handle file not found", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      await expect(async () => {
        await cmdObj.parseAsync(["node", "aequor", "import", "nonexistent.json"]);
      }).rejects.toThrow("File not found");
    });

    it("should handle parse errors", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error("Parse error"));

      await expect(async () => {
        await cmdObj.parseAsync(["node", "aequor", "import", "bad.json"]);
      }).rejects.toThrow("Import failed");
    });

    it("should ignore errors when requested", async () => {
      const cmd = createImportCommand();
      const cmdObj = new Command().addCommand(cmd);

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error("Parse error"));

      await cmdObj.parseAsync(["node", "aequor", "import", "bad.json", "-i"]);

      expect(fs.readFile).toHaveBeenCalled();
      // Should not exit with error
    });
  });
});