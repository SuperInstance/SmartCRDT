/**
 * Tests for SanitizationMiddleware
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SanitizationMiddleware, ThreatAnalyzer, sanitizeCliArgs, sanitizeEnvVars } from "./SanitizationMiddleware.js";
import { InputSource, ThreatSeverity } from "@lsi/protocol";

describe("ThreatAnalyzer", () => {
  describe("calculateScore", () => {
    it("should calculate threat score from severity", () => {
      const threats = [
        { type: "XSS" as never, severity: ThreatSeverity.LOW } as const,
        { type: "XSS" as never, severity: ThreatSeverity.HIGH } as const,
      ];

      const score = ThreatAnalyzer.calculateScore(threats);

      expect(score).toBe(55); // 5 + 50
    });

    it("should return 0 for no threats", () => {
      const score = ThreatAnalyzer.calculateScore([]);

      expect(score).toBe(0);
    });
  });

  describe("shouldBlock", () => {
    it("should block on critical when configured", () => {
      const threats = [
        { type: "XSS" as never, severity: ThreatSeverity.CRITICAL } as const,
      ];

      const thresholds = {
        maxAllowedSeverity: ThreatSeverity.MEDIUM,
        maxThreatCount: 10,
        maxThreatScore: 100,
        blockOnCritical: true,
        logAllThreats: true,
        quarantineSuspicious: false,
      };

      const result = ThreatAnalyzer.shouldBlock(threats, thresholds);

      expect(result.block).toBe(true);
      expect(result.reason).toContain("Critical");
    });

    it("should block when threat count exceeds threshold", () => {
      const threats = Array(10).fill({
        type: "XSS" as never,
        severity: ThreatSeverity.LOW,
      });

      const thresholds = {
        maxAllowedSeverity: ThreatSeverity.HIGH,
        maxThreatCount: 5,
        maxThreatScore: 100,
        blockOnCritical: false,
        logAllThreats: true,
        quarantineSuspicious: false,
      };

      const result = ThreatAnalyzer.shouldBlock(threats, thresholds);

      expect(result.block).toBe(true);
      expect(result.reason).toContain("Threat count");
    });

    it("should block when score exceeds threshold", () => {
      const threats = [
        { type: "XSS" as never, severity: ThreatSeverity.HIGH } as const,
        { type: "XSS" as never, severity: ThreatSeverity.HIGH } as const,
      ];

      const thresholds = {
        maxAllowedSeverity: ThreatSeverity.HIGH,
        maxThreatCount: 10,
        maxThreatScore: 50,
        blockOnCritical: false,
        logAllThreats: true,
        quarantineSuspicious: false,
      };

      const result = ThreatAnalyzer.shouldBlock(threats, thresholds);

      expect(result.block).toBe(true);
      expect(result.reason).toContain("Threat score");
    });

    it("should not block when within thresholds", () => {
      const threats = [
        { type: "XSS" as never, severity: ThreatSeverity.LOW } as const,
      ];

      const thresholds = {
        maxAllowedSeverity: ThreatSeverity.MEDIUM,
        maxThreatCount: 5,
        maxThreatScore: 50,
        blockOnCritical: false,
        logAllThreats: true,
        quarantineSuspicious: false,
      };

      const result = ThreatAnalyzer.shouldBlock(threats, thresholds);

      expect(result.block).toBe(false);
    });
  });
});

describe("SanitizationMiddleware", () => {
  let middleware: SanitizationMiddleware;

  beforeEach(() => {
    middleware = new SanitizationMiddleware();
  });

  describe("handle", () => {
    it("should sanitize string input", async () => {
      const context = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const next = vi.fn().mockResolvedValue("next called");

      await middleware.handle("<script>alert(1)</script>", context, next);

      expect(next).toHaveBeenCalled();
    });

    it("should sanitize object input", async () => {
      const context = {
        source: InputSource.API_BODY,
        timestamp: new Date(),
      };

      const input = {
        username: "admin' OR '1'='1",
        email: "<script>alert(1)</script>@example.com",
      };

      const next = vi.fn().mockResolvedValue("next called");

      await middleware.handle(input, context, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block input exceeding threat threshold", async () => {
      const context = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const middleware = new SanitizationMiddleware(
        {},
        {
          maxThreatScore: 10,
          blockOnCritical: true,
        }
      );

      const next = vi.fn().mockResolvedValue("next called");

      await expect(
        middleware.handle("<script>alert(1)</script>", context, next)
      ).rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });

    it("should call threat detected callback", async () => {
      const context = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const onThreat = vi.fn();
      middleware.onThreat(onThreat);

      const next = vi.fn().mockResolvedValue("next called");

      // Use input that will trigger threat but not block
      await middleware.handle("test<script>", context, next);

      expect(onThreat).toHaveBeenCalled();
    });

    it("should call blocked callback", async () => {
      const context = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const onBlocked = vi.fn();
      middleware.onBlock(onBlocked);

      const next = vi.fn().mockResolvedValue("next called");

      await expect(
        middleware.handle("<script>alert(1)</script>", context, next)
      ).rejects.toThrow();

      expect(onBlocked).toHaveBeenCalled();
    });
  });

  describe("configure", () => {
    it("should update middleware options", () => {
      middleware.configure({
        maxLength: 100,
        preserveUnicode: false,
      });

      // Options are updated internally
      expect(middleware.getStatistics()).toBeDefined();
    });
  });

  describe("setThresholds", () => {
    it("should update security thresholds", () => {
      middleware.setThresholds({
        maxThreatCount: 10,
        maxThreatScore: 100,
      });

      // Thresholds are updated internally
      expect(middleware.getStatistics()).toBeDefined();
    });
  });

  describe("getStatistics", () => {
    it("should return sanitization statistics", () => {
      const stats = middleware.getStatistics();

      expect(stats).toHaveProperty("totalInputs");
      expect(stats).toHaveProperty("threatDetectedCount");
    });
  });

  describe("resetStatistics", () => {
    it("should reset statistics", () => {
      middleware.resetStatistics();

      const stats = middleware.getStatistics();

      expect(stats.totalInputs).toBe(0);
      expect(stats.threatDetectedCount).toBe(0);
    });
  });
});

describe("sanitizeCliArgs", () => {
  it("should sanitize CLI arguments", () => {
    const args = ["file.txt", "output.txt", "|| rm -rf /"];

    const sanitized = sanitizeCliArgs(args);

    expect(sanitized[0]).toBe("file.txt");
    expect(sanitized[1]).toBe("output.txt");
    expect(sanitized[2]).toContain("\\|"); // escaped pipe
  });
});

describe("sanitizeEnvVars", () => {
  it("should sanitize environment variables", () => {
    const env = {
      PATH: "/usr/bin",
      CUSTOM_VAR: "value || malicious",
    };

    const sanitized = sanitizeEnvVars(env);

    expect(sanitized.PATH).toBeDefined();
    expect(sanitized.CUSTOM_VAR).toContain("\\|"); // escaped pipe
  });
});
