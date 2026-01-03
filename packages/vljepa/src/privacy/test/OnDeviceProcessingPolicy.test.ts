/**
 * OnDeviceProcessingPolicy Tests
 *
 * Comprehensive test suite for on-device processing policy enforcement.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OnDeviceProcessingPolicy,
  PrivacyMode,
  createStrictPolicy,
  createStandardPolicy,
  createPermissivePolicy,
  type PrivacyAuditEntry,
  type VisualPrivacyClassification,
  type PrivacyElement,
} from "../OnDeviceProcessingPolicy";
import { ProcessingLocation, VisualDataType } from "../VisualPrivacyAnalyzer";

describe("OnDeviceProcessingPolicy", () => {
  let policy: OnDeviceProcessingPolicy;
  let testEmbedding: Float32Array;
  let testClassification: VisualPrivacyClassification;

  beforeEach(() => {
    policy = new OnDeviceProcessingPolicy({
      privacyMode: PrivacyMode.STANDARD,
      processingLocation: ProcessingLocation.EDGE_ONLY,
      dataLeavingDevice: "redacted_embeddings",
    });

    testEmbedding = createTestEmbedding();
    testClassification = createTestClassification("SAFE", []);
  });

  describe("Construction", () => {
    it("should create with default config", () => {
      const p = new OnDeviceProcessingPolicy();
      expect(p).toBeDefined();
    });

    it("should create strict policy", () => {
      const p = createStrictPolicy();
      expect(p).toBeDefined();
      expect(p.getPolicy().privacyMode).toBe(PrivacyMode.STRICT);
    });

    it("should create standard policy", () => {
      const p = createStandardPolicy();
      expect(p).toBeDefined();
      expect(p.getPolicy().privacyMode).toBe(PrivacyMode.STANDARD);
    });

    it("should create permissive policy", () => {
      const p = createPermissivePolicy();
      expect(p).toBeDefined();
      expect(p.getPolicy().privacyMode).toBe(PrivacyMode.OFF);
    });
  });

  describe("Validation - SAFE Data", () => {
    it("should allow SAFE classification", () => {
      const validation = policy.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.canProceed).toBe(true);
      expect(validation.requiresRedaction).toBe(false);
      expect(validation.requiresConsent).toBe(false);
      expect(validation.valid).toBe(true);
    });

    it("should allow data transmission for SAFE", () => {
      const validation = policy.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.dataLeavingDevice).toBe(true);
    });
  });

  describe("Validation - SENSITIVE Data", () => {
    it("should require redaction for SENSITIVE in standard mode", () => {
      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("text"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        sensitiveClassification
      );

      expect(validation.canProceed).toBe(true);
      expect(validation.requiresRedaction).toBe(true);
    });

    it("should not require consent for SENSITIVE", () => {
      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("text"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        sensitiveClassification
      );

      expect(validation.requiresConsent).toBe(false);
    });
  });

  describe("Validation - PII Data", () => {
    it("should require redaction for PII", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        piiClassification
      );

      expect(validation.requiresRedaction).toBe(true);
    });

    it("should require consent for PII when requireConsent is true", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        piiClassification
      );

      expect(validation.requiresConsent).toBe(true);
    });

    it("should allow processing with redaction for PII", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        piiClassification
      );

      expect(validation.canProceed).toBe(true);
    });
  });

  describe("Validation - SECRET Data", () => {
    it("should block SECRET classification", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        secretClassification
      );

      expect(validation.canProceed).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should not allow data leaving device for SECRET", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        secretClassification
      );

      expect(validation.dataLeavingDevice).toBe(false);
    });

    it("should require redaction and consent for SECRET", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        secretClassification
      );

      expect(validation.requiresRedaction).toBe(true);
      expect(validation.requiresConsent).toBe(true);
    });
  });

  describe("Processing Location Validation", () => {
    it("should warn for non-EDGE_ONLY location", () => {
      const p = new OnDeviceProcessingPolicy({
        processingLocation: ProcessingLocation.HYBRID,
      });

      const validation = p.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it("should accept EDGE_ONLY location", () => {
      const p = new OnDeviceProcessingPolicy({
        processingLocation: ProcessingLocation.EDGE_ONLY,
      });

      const validation = p.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.canProceed).toBe(true);
    });
  });

  describe("Data Leaving Device Policy", () => {
    it("should block transmission when dataLeavingDevice is none", () => {
      const p = new OnDeviceProcessingPolicy({
        dataLeavingDevice: "none",
      });

      const validation = p.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.dataLeavingDevice).toBe(false);
    });

    it("should allow redacted embeddings when policy is redacted_embeddings", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        piiClassification
      );

      expect(validation.dataLeavingDevice).toBe(true);
    });

    it("should allow embeddings when policy is embeddings_only", () => {
      const p = new OnDeviceProcessingPolicy({
        dataLeavingDevice: "embeddings_only",
      });

      const validation = p.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.dataLeavingDevice).toBe(true);
    });
  });

  describe("Privacy Modes", () => {
    it("strict mode should have stronger warnings", () => {
      const p = new OnDeviceProcessingPolicy({
        privacyMode: PrivacyMode.STRICT,
      });

      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("text"),
      ]);

      const validation = p.validateProcessing(
        testEmbedding,
        sensitiveClassification
      );

      expect(validation.recommendations.length).toBeGreaterThan(0);
    });

    it("off mode should have warnings about minimal protection", () => {
      const p = new OnDeviceProcessingPolicy({
        privacyMode: PrivacyMode.OFF,
      });

      const validation = p.validateProcessing(
        testEmbedding,
        testClassification
      );

      expect(validation.warnings.some(w => w.includes("minimal"))).toBe(true);
    });
  });

  describe("Process with Audit", () => {
    it("should create audit entry for successful processing", async () => {
      const result = await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      expect(result.success).toBe(true);
      expect(result.auditEntry).toBeDefined();
      expect(result.auditEntry.id).toBeDefined();
    });

    it("should block processing when validation fails", async () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const result = await policy.processWithAudit(
        testEmbedding,
        secretClassification,
        VisualDataType.SCREENSHOT
      );

      expect(result.success).toBe(false);
      expect(result.canTransmit).toBe(false);
    });

    it("should track processing duration in audit", async () => {
      const result = await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      expect(result.auditEntry.duration).toBeGreaterThanOrEqual(0);
    });

    it("should include classification in audit entry", async () => {
      const result = await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      expect(result.auditEntry.classification).toBe(testClassification);
    });

    it("should include data type in audit entry", async () => {
      const result = await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.CAMERA
      );

      expect(result.auditEntry.dataType).toBe(VisualDataType.CAMERA);
    });
  });

  describe("Audit Log", () => {
    it("should store audit entries", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const log = policy.getAuditLog();
      expect(log.length).toBe(1);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await policy.processWithAudit(
          testEmbedding,
          testClassification,
          VisualDataType.UI_FRAME
        );
      }

      const log = policy.getAuditLog(5);
      expect(log.length).toBe(5);
    });

    it("should filter audit entries", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const log = policy.getAuditLog(
        undefined,
        entry => entry.dataType === VisualDataType.UI_FRAME
      );

      expect(log.length).toBe(1);
    });

    it("should clear audit log", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      policy.clearAuditLog();

      const log = policy.getAuditLog();
      expect(log.length).toBe(0);
    });

    it("should export audit log as JSON", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const json = policy.exportAuditLog();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    });
  });

  describe("Audit Statistics", () => {
    it("should calculate total entries", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const stats = policy.getAuditStats();
      expect(stats.totalEntries).toBe(2);
    });

    it("should count by classification", async () => {
      const safeClassification = createTestClassification("SAFE", []);
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      await policy.processWithAudit(
        testEmbedding,
        safeClassification,
        VisualDataType.UI_FRAME
      );
      await policy.processWithAudit(
        testEmbedding,
        piiClassification,
        VisualDataType.UI_FRAME
      );

      const stats = policy.getAuditStats();
      expect(stats.byClassification["SAFE"]).toBe(1);
      expect(stats.byClassification["PII"]).toBe(1);
    });

    it("should count by data type", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.SCREENSHOT
      );

      const stats = policy.getAuditStats();
      expect(stats.byDataType[VisualDataType.UI_FRAME]).toBe(1);
      expect(stats.byDataType[VisualDataType.SCREENSHOT]).toBe(1);
    });

    it("should count data leaving device", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const stats = policy.getAuditStats();
      expect(stats.dataLeftDeviceCount).toBe(1);
    });

    it("should calculate average processing time", async () => {
      await policy.processWithAudit(
        testEmbedding,
        testClassification,
        VisualDataType.UI_FRAME
      );

      const stats = policy.getAuditStats();
      expect(stats.avgProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Policy Updates", () => {
    it("should update policy configuration", () => {
      policy.updatePolicy({
        privacyMode: PrivacyMode.STRICT,
      });

      const config = policy.getPolicy();
      expect(config.privacyMode).toBe(PrivacyMode.STRICT);
    });

    it("should reject invalid updates", () => {
      expect(() => {
        policy.updatePolicy({
          dataLeavingDevice: "none",
          processingLocation: ProcessingLocation.CLOUD_ONLY,
        });
      }).toThrow();
    });

    it("should validate maxRetentionTime", () => {
      policy.updatePolicy({
        maxRetentionTime: 30000,
      });

      const config = policy.getPolicy();
      expect(config.maxRetentionTime).toBe(30000);
    });
  });

  describe("Get Policy", () => {
    it("should return current policy configuration", () => {
      const config = policy.getPolicy();

      expect(config).toBeDefined();
      expect(config.privacyMode).toBe(PrivacyMode.STANDARD);
      expect(config.processingLocation).toBe(ProcessingLocation.EDGE_ONLY);
      expect(config.dataLeavingDevice).toBe("redacted_embeddings");
    });

    it("should return a copy of the configuration", () => {
      const config1 = policy.getPolicy();
      const config2 = policy.getPolicy();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty detected elements", () => {
      const classification = createTestClassification("SAFE", []);
      const validation = policy.validateProcessing(
        testEmbedding,
        classification
      );

      expect(validation.canProceed).toBe(true);
    });

    it("should handle multiple privacy elements", () => {
      const classification = createTestClassification("SENSITIVE", [
        createPrivacyElement("face"),
        createPrivacyElement("text"),
        createPrivacyElement("document"),
      ]);

      const validation = policy.validateProcessing(
        testEmbedding,
        classification
      );

      expect(validation).toBeDefined();
    });

    it("should enforce max audit log size", async () => {
      const p = new OnDeviceProcessingPolicy({
        maxAuditLogSize: 5,
      });

      // Add more entries than max
      for (let i = 0; i < 10; i++) {
        await p.processWithAudit(
          testEmbedding,
          testClassification,
          VisualDataType.UI_FRAME
        );
      }

      const stats = p.getAuditStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5);
    });
  });
});

// Helper functions

function createTestEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.5;
  }
  return embedding;
}

function createTestClassification(
  classification: VisualPrivacyClassification["classification"],
  detectedElements: PrivacyElement[]
): VisualPrivacyClassification {
  return {
    version: "1.0",
    embedding: createTestEmbedding(),
    classification,
    confidence: 0.8,
    detectedElements,
    redactionNeeded: classification !== "SAFE",
    privacyScore: detectedElements.length > 0 ? 0.7 : 0,
    timestamp: Date.now(),
  };
}

function createPrivacyElement(type: PrivacyElement["type"]): PrivacyElement {
  return {
    type,
    boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    confidence: 0.8,
    semanticRegion: {
      startDim: 0,
      endDim: 100,
      activationStrength: 0.8,
    },
  };
}
