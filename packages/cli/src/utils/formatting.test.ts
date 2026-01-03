/**
 * Tests for CLI formatting utilities
 */

import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatNumber,
  formatBytes,
  formatPercentage,
  truncate,
  formatRelativeTime,
  formatModelName,
  createProgressBar,
  formatCost,
  getStatusBadge,
} from "./formatting.js";

describe("formatting", () => {
  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(5500)).toBe("5.5s");
      expect(formatDuration(59999)).toBe("60.0s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(125000)).toBe("2m 5s");
      expect(formatDuration(3600000)).toBe("60m 0s");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with thousand separators", () => {
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(999)).toBe("999");
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1234567)).toBe("1,234,567");
      expect(formatNumber(1234567890)).toBe("1,234,567,890");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
  });

  describe("formatPercentage", () => {
    it("should format percentages with color coding", () => {
      const low = formatPercentage(70, 100);
      const medium = formatPercentage(75, 100);
      const high = formatPercentage(95, 100);

      expect(low).toContain("70.0%");
      expect(medium).toContain("75.0%");
      expect(high).toContain("95.0%");
    });
  });

  describe("truncate", () => {
    it("should truncate text to fit within width", () => {
      expect(truncate("hello", 10)).toBe("hello");
      expect(truncate("hello world", 8)).toBe("hello...");
      expect(truncate("hello world", 10)).toBe("hello wor...");
    });

    it("should use custom suffix", () => {
      expect(truncate("hello world", 8, "***")).toBe("hello***");
    });
  });

  describe("formatRelativeTime", () => {
    it("should format relative time", () => {
      const now = Date.now();

      expect(formatRelativeTime(now - 30000)).toBe("30s ago");
      expect(formatRelativeTime(now - 3600000)).toBe("1h ago");
      expect(formatRelativeTime(now - 86400000)).toBe("1d ago");
    });
  });

  describe("formatModelName", () => {
    it("should shorten common model names", () => {
      expect(formatModelName("gpt-4")).toBe("GPT-4");
      expect(formatModelName("gpt-3.5-turbo")).toBe("GPT-3.5 Turbo");
      expect(formatModelName("llama2:7b")).toBe("Llama 2 7B");
      expect(formatModelName("unknown-model")).toBe("unknown-model");
    });
  });

  describe("createProgressBar", () => {
    it("should create progress bar string", () => {
      const bar = createProgressBar(5, 10, 10);
      expect(bar).toContain("50.0%");
    });

    it("should handle edge cases", () => {
      expect(createProgressBar(0, 10, 10)).toContain("0.0%");
      expect(createProgressBar(10, 10, 10)).toContain("100.0%");
    });
  });

  describe("formatCost", () => {
    it("should format cost in USD", () => {
      expect(formatCost(0)).toBe("$0.00");
      expect(formatCost(100)).toBe("$1.00");
      expect(formatCost(150)).toBe("$1.50");
      expect(formatCost(12345)).toBe("$123.45");
    });
  });

  describe("getStatusBadge", () => {
    it("should return colored badges for different statuses", () => {
      expect(getStatusBadge("healthy")).toContain("HEALTHY");
      expect(getStatusBadge("online")).toContain("ONLINE");
      expect(getStatusBadge("unhealthy")).toContain("UNHEALTHY");
      expect(getStatusBadge("warning")).toContain("WARNING");
      expect(getStatusBadge("loading")).toContain("LOADING");
    });
  });
});
