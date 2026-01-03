/**
 * Tests for CLI main entry point
 */

import { describe, it, expect } from "vitest";
import { createProgram } from "./index.js";

describe("CLI", () => {
  describe("createProgram", () => {
    it("should create a commander program", () => {
      const program = createProgram();

      expect(program).toBeDefined();
      expect(program.name()).toBe("aequor");
    });

    it("should have all expected commands", () => {
      const program = createProgram();
      const commands = program.commands.map(cmd => cmd.name());

      expect(commands).toContain("query");
      expect(commands).toContain("chat");
      expect(commands).toContain("status");
      expect(commands).toContain("config");
      expect(commands).toContain("models");
      expect(commands).toContain("cost");
      expect(commands).toContain("cache");
      expect(commands).toContain("test");
    });

    it("should have version option", () => {
      const program = createProgram();

      expect(program.options().some(opt => opt.long === "--version")).toBe(
        true
      );
    });

    it("should have help option", () => {
      const program = createProgram();

      expect(program.options().some(opt => opt.long === "--help")).toBe(true);
    });
  });
});
