/**
 * Export command tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createExportCommand } from "./export.js";
import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";
import configManager from "../config/manager.js";

// Mock dependencies
vi.mock("../config/manager.js");
vi.mock("fs");
vi.mock("node:zlib", () => ({
  gzipSync: vi.fn(() => Buffer.from("compressed")),
}));

describe("Export Command", () => {
  let mockConfig: any;
  let mockFs: any;

  beforeEach(() => {
    mockConfig = {
      knowledge: { directory: "./knowledge" },
      cache: { directory: "./cache" },
      logging: { directory: "./logs" },
      apiKeys: { openai: "test-key" },
      database: { password: "test-password" },
    };

    (configManager.getAll as any).mockResolvedValue(mockConfig);
    (configManager.clearCache as any).mockResolvedValue(undefined);

    mockFs = {
      readdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn(),
      mkdir: vi.fn(),
    };

    (fs.readdir as any).mockImplementation(mockFs.readdir);
    (fs.readFile as any).mockImplementation(mockFs.readFile);
    (fs.writeFile as any).mockImplementation(mockFs.writeFile);
    (fs.access as any).mockImplementation(mockFs.access);
    (fs.mkdir as any).mockImplementation(mockFs.mkdir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("command creation", () => {
    it("should create export command with correct options", () => {
      const cmd = createExportCommand();
      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("export");
      expect(cmd.description()).toContain("Export knowledge");
    });
  });

  describe("export functionality", () => {
    it("should export all data by default", async () => {
      mockFs.readdir.mockResolvedValue(["file1.json", "file2.json"]);
      mockFs.readFile.mockResolvedValue('{"test": "data"}');

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export"]);

      expect(fs.readdir).toHaveBeenCalledWith("./knowledge");
      expect(fs.readdir).toHaveBeenCalledWith("./cache");
      expect(fs.writeFile).toHaveBeenCalledWith("export.json", expect.any(String));
    });

    it("should export knowledge only", async () => {
      mockFs.readdir.mockResolvedValue(["entry1.json", "entry2.json"]);
      mockFs.readFile.mockResolvedValue('{"id": "test", "text": "test content"}');

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-w", "knowledge"]);

      expect(fs.readdir).toHaveBeenCalledWith("./knowledge");
      expect(fs.readdir).not.toHaveBeenCalledWith("./cache");
    });

    it("should export cache only", async () => {
      mockFs.readdir.mockResolvedValue(["cache1.json"]);
      mockFs.readFile.mockResolvedValue('{"query": "test", "response": "response"}');

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-w", "cache"]);

      expect(fs.readdir).toHaveBeenCalledWith("./cache");
      expect(fs.readdir).not.toHaveBeenCalledWith("./knowledge");
    });

    it("should filter by pattern", async () => {
      mockFs.readdir.mockResolvedValue(["entry1.json", "entry2.json"]);
      mockFs.readFile
        .mockResolvedValueOnce('{"id": "1", "text": "AI is great"}')
        .mockResolvedValueOnce('{"id": "2", "text": "Machine learning"}');

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-w", "knowledge", "-p", "AI"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".json"),
        expect.stringContaining("AI is great")
      );
    });

    it("should handle JSONL format", async () => {
      mockFs.readdir.mockResolvedValue(["file1.json"]);
      mockFs.readFile.mockResolvedValue('{"test": "data"}');

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-f", "jsonl"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        "export.jsonl",
        '{"type":"knowledge","data":{"entries":[],"metadata":undefined}}\n{"type":"cache","data":{"entries":[],"metadata":undefined}}\n{"type":"config","data":{"config":{...},"metadata":undefined}}\n{"type":"logs","data":{"entries":[],"metadata":undefined}}'
      );
    });

    it("should handle cartridge format", async () => {
      mockFs.readdir.mockResolvedValue([]);
      mockFs.readFile.mockResolvedValue("{}");

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-f", "cartridge"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        "export.cartridge",
        expect.stringContaining('"type":"aequor-cartridge"')
      );
    });

    it("should compress output when requested", async () => {
      const { gzipSync } = await import("node:zlib");

      mockFs.readdir.mockResolvedValue([]);
      mockFs.readFile.mockResolvedValue("{}");

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-c"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        "export.json.gz",
        Buffer.from("compressed")
      );
      expect(gzipSync).toHaveBeenCalled();
    });

    it("should handle missing directories gracefully", async () => {
      const error = new Error("ENOENT");
      (error as any).code = "ENOENT";

      mockFs.readdir.mockRejectedValue(error);

      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export"]);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("should sanitize sensitive configuration data", async () => {
      const cmd = createExportCommand();
      const cmdObj = new Command().addCommand(cmd);

      await cmdObj.parseAsync(["node", "aequor", "export", "-w", "config"]);

      const writtenData = fs.writeFile.mock.calls[0][1];
      expect(writtenData).not.toContain("test-key");
      expect(writtenData).not.toContain("test-password");
    });
  });
});