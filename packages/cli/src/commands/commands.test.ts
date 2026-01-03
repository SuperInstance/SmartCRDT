/**
 * Tests for CLI commands
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import {
  createQueryCommand,
  createChatCommand,
  createStatusCommand,
  createConfigCommand,
  createModelsCommand,
  createCostCommand,
  createCacheCommand,
  createTestCommand,
  createPrivacyCommand,
  createTrainCommand,
} from "./index.js";

describe("CLI Commands", () => {
  describe("createQueryCommand", () => {
    it("should create query command", () => {
      const cmd = createQueryCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("query");
      expect(cmd.description()).toContain("query");
    });

    it("should have expected _options", () => {
      const cmd = createQueryCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--model");
      expect(_options).toContain("--local");
      expect(_options).toContain("--cloud");
      expect(_options).toContain("--format");
      expect(_options).toContain("--no-stream");
      expect(_options).toContain("--_verbose");
    });
  });

  describe("createChatCommand", () => {
    it("should create chat command", () => {
      const cmd = createChatCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("chat");
      expect(cmd.description()).toContain("chat");
    });

    it("should have model option", () => {
      const cmd = createChatCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--model");
    });
  });

  describe("createStatusCommand", () => {
    it("should create status command", () => {
      const cmd = createStatusCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("status");
      expect(cmd.description()).toContain("status");
    });

    it("should have format and health _options", () => {
      const cmd = createStatusCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--format");
      expect(_options).toContain("--health");
    });
  });

  describe("createConfigCommand", () => {
    it("should create _config command", () => {
      const cmd = createConfigCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("_config");
      expect(cmd.description()).toContain("_config");
    });
  });

  describe("createModelsCommand", () => {
    it("should create models command", () => {
      const cmd = createModelsCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("models");
      expect(cmd.description()).toContain("models");
    });

    it("should have format and _verbose _options", () => {
      const cmd = createModelsCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--format");
      expect(_options).toContain("--_verbose");
      expect(_options).toContain("--refresh");
    });
  });

  describe("createCostCommand", () => {
    it("should create cost command", () => {
      const cmd = createCostCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("cost");
      expect(cmd.description()).toContain("cost");
    });

    it("should have _period and format _options", () => {
      const cmd = createCostCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--_period");
      expect(_options).toContain("--format");
      expect(_options).toContain("--budget");
      expect(_options).toContain("--set");
    });
  });

  describe("createCacheCommand", () => {
    it("should create cache command", () => {
      const cmd = createCacheCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("cache");
      expect(cmd.description()).toContain("cache");
    });

    it("should have clear and stats _options", () => {
      const cmd = createCacheCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--format");
      expect(_options).toContain("--clear");
      expect(_options).toContain("--stats");
    });
  });

  describe("createTestCommand", () => {
    it("should create test command", () => {
      const cmd = createTestCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("test");
      expect(cmd.description()).toContain("diagnostic");
    });

    it("should have test, _verbose, and format _options", () => {
      const cmd = createTestCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--test");
      expect(_options).toContain("--_verbose");
      expect(_options).toContain("--format");
    });
  });

  describe("createPrivacyCommand", () => {
    it("should create privacy command", () => {
      const cmd = createPrivacyCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("privacy");
      expect(cmd.description()).toContain("privacy");
    });

    it("should have encode, epsilon, detailed, classify, and format _options", () => {
      const cmd = createPrivacyCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--encode");
      expect(_options).toContain("--epsilon");
      expect(_options).toContain("--detailed");
      expect(_options).toContain("--classify");
      expect(_options).toContain("--format");
    });
  });

  describe("createTrainCommand", () => {
    it("should create train command", () => {
      const cmd = createTrainCommand();

      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe("train");
      expect(cmd.description()).toContain("ORPO");
    });

    it("should have output, min-quality, balance, format, and stats _options", () => {
      const cmd = createTrainCommand();
      const _options = cmd._options.map(opt => opt.long);

      expect(_options).toContain("--output");
      expect(_options).toContain("--min-quality");
      expect(_options).toContain("--balance");
      expect(_options).toContain("--format");
      expect(_options).toContain("--stats");
    });
  });
});
