/**
 * Tests for AuditExporter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { AuditExporter, EXPORT_FORMATS } from "./AuditExporter.js";
import { PrivacyAuditEvent, PIIType, PrivacyLevel } from "@lsi/protocol";

describe("AuditExporter", () => {
  let exporter: AuditExporter;
  let testEvents: PrivacyAuditEvent[];
  const testOutputDir = "./test-exports";

  beforeEach(() => {
    exporter = new AuditExporter();

    testEvents = [
      {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "abc123",
        queryLength: 50,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test event",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      },
      {
        timestamp: Date.now() + 1000,
        eventType: "query_redacted",
        queryHash: "def456",
        queryLength: 75,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.85,
          piiTypes: [PIIType.EMAIL, PIIType.PHONE],
          reason: "Test event with PII",
        },
        piiDetected: [PIIType.EMAIL, PIIType.PHONE],
        decision: {
          action: "redact",
          matchedRules: ["rule1"],
          confidence: 0.85,
        },
        destination: "cloud",
        sessionId: "session2",
        metadata: {},
      },
      {
        timestamp: Date.now() + 2000,
        eventType: "query_blocked",
        queryHash: "ghi789",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.95,
          piiTypes: [PIIType.SSN, PIIType.CREDIT_CARD],
          reason: "Test secret event",
        },
        piiDetected: [PIIType.SSN, PIIType.CREDIT_CARD],
        decision: {
          action: "deny",
          matchedRules: ["rule1", "rule2"],
          confidence: 0.95,
        },
        destination: "local",
        sessionId: "session3",
        metadata: {},
      },
    ];
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe("Export Formats", () => {
    it("should export to JSON format", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        outputDir: testOutputDir,
      });

      expect(result.format).toBe("json");
      expect(result.recordCount).toBe(3);
      expect(result.filePaths.length).toBe(1);
      expect(result.filePaths[0]).toMatch(/\.json$/);

      // Verify file exists and contains valid JSON
      const content = await fs.readFile(result.filePaths[0], "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty("metadata");
      expect(parsed).toHaveProperty("events");
      expect(parsed.events).toHaveLength(3);
    });

    it("should export to CSV format", async () => {
      const result = await exporter.export(testEvents, {
        format: "CSV",
        outputDir: testOutputDir,
      });

      expect(result.format).toBe("csv");
      expect(result.filePaths[0]).toMatch(/\.csv$/);

      const content = await fs.readFile(result.filePaths[0], "utf-8");

      // Verify CSV headers (no spaces after commas)
      expect(content).toContain("timestamp,eventType,queryHash");
      expect(content).toContain("query_allowed");
      expect(content).toContain("query_redacted");
      expect(content).toContain("query_blocked");
    });

    it("should export to XML format", async () => {
      const result = await exporter.export(testEvents, {
        format: "XML",
        outputDir: testOutputDir,
      });

      expect(result.format).toBe("xml");
      expect(result.filePaths[0]).toMatch(/\.xml$/);

      const content = await fs.readFile(result.filePaths[0], "utf-8");

      // Verify XML structure
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain("<AuditExport>");
      expect(content).toContain("<Metadata>");
      expect(content).toContain("<Events>");
      expect(content).toContain("</AuditExport>");
    });

    it("should export to PDF format", async () => {
      const result = await exporter.export(testEvents, {
        format: "PDF",
        outputDir: testOutputDir,
      });

      expect(result.format).toBe("pdf");
      expect(result.filePaths[0]).toMatch(/\.pdf$/);

      // Verify file was created
      const content = await fs.readFile(result.filePaths[0]);
      expect(content.length).toBeGreaterThan(0);
    });

    it("should export to Parquet format", async () => {
      const result = await exporter.export(testEvents, {
        format: "PARQUET",
        outputDir: testOutputDir,
      });

      expect(result.format).toBe("parquet");
      expect(result.filePaths[0]).toMatch(/\.parquet$/);

      // Verify file was created
      const content = await fs.readFile(result.filePaths[0]);
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe("Compression", () => {
    it("should compress output with gzip", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        compress: true,
        outputDir: testOutputDir,
      });

      expect(result.compressed).toBe(true);
      expect(result.filePaths[0]).toMatch(/\.json\.gz$/);

      // Verify file exists and is compressed
      const exists = await fs
        .access(result.filePaths[0])
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("File Splitting", () => {
    it("should split large exports into multiple files", async () => {
      // Create a large dataset
      const largeEvents: PrivacyAuditEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEvents.push({
          ...testEvents[0],
          timestamp: Date.now() + i,
          queryHash: `hash${i}`.repeat(10), // Make entries larger
        });
      }

      const result = await exporter.export(largeEvents, {
        format: "JSON",
        split: true,
        splitSize: 1024, // Very small to force splitting
        outputDir: testOutputDir,
      });

      expect(result.filePaths.length).toBeGreaterThan(1);
      expect(result.recordCount).toBe(1000);

      // Verify all files exist
      for (const filepath of result.filePaths) {
        const exists = await fs
          .access(filepath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it("should not split when split option is false", async () => {
      const largeEvents: PrivacyAuditEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEvents.push({
          ...testEvents[0],
          timestamp: Date.now() + i,
        });
      }

      const result = await exporter.export(largeEvents, {
        format: "JSON",
        split: false,
        outputDir: testOutputDir,
      });

      expect(result.filePaths.length).toBe(1);
    });
  });

  describe("Anonymization", () => {
    it("should anonymize events beyond hashing", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        anonymize: true,
        outputDir: testOutputDir,
      });

      const content = await fs.readFile(result.filePaths[0], "utf-8");
      const parsed = JSON.parse(content);

      // Query hashes should be randomized (not original values)
      const originalHashes = testEvents.map(e => e.queryHash);
      const exportedHashes = parsed.events.map(
        (e: PrivacyAuditEvent) => e.queryHash
      );

      // Hashes should be different and longer (random bytes)
      expect(exportedHashes).not.toEqual(originalHashes);
      expect(exportedHashes[0]).toHaveLength(64); // 32 bytes * 2 (hex)
    });

    it("should anonymize session IDs", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        anonymize: true,
        outputDir: testOutputDir,
      });

      const content = await fs.readFile(result.filePaths[0], "utf-8");
      const parsed = JSON.parse(content);

      const sessionIds = parsed.events.map(
        (e: PrivacyAuditEvent) => e.sessionId
      );

      // All session IDs should be randomized
      sessionIds.forEach((id: string) => {
        expect(id).toHaveLength(32); // 16 bytes * 2 (hex)
      });
    });
  });

  describe("Aggregation", () => {
    it("should aggregate events by classification", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        aggregate: true,
        outputDir: testOutputDir,
      });

      expect(result.recordCount).toBeLessThanOrEqual(testEvents.length);

      const content = await fs.readFile(result.filePaths[0], "utf-8");
      const parsed = JSON.parse(content);

      // Should have aggregated events with count metadata
      expect(parsed.events.length).toBeGreaterThan(0);
      expect(parsed.events[0]).toHaveProperty("metadata");
    });
  });

  describe("Filtering", () => {
    it("should filter events by classification", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        filter: {
          classification: ["PUBLIC"],
        },
        outputDir: testOutputDir,
      });

      expect(result.recordCount).toBe(1);

      const content = await fs.readFile(result.filePaths[0], "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.events[0].classification?.level).toBe(PrivacyLevel.PUBLIC);
    });

    it("should filter events by destination", async () => {
      const result = await exporter.export(testEvents, {
        format: "JSON",
        filter: {
          destination: ["cloud"],
        },
        outputDir: testOutputDir,
      });

      expect(result.recordCount).toBe(1);
    });

    it("should filter events by time range", async () => {
      const now = Date.now();
      const result = await exporter.export(testEvents, {
        format: "JSON",
        filter: {
          timeRange: {
            start: now,
            end: now + 1500,
          },
        },
        outputDir: testOutputDir,
      });

      expect(result.recordCount).toBe(2); // First two events
    });
  });

  describe("Export to File", () => {
    it("should export to specific file path", async () => {
      const filepath = `${testOutputDir}/custom-export.json`;

      const result = await exporter.exportToFile(testEvents, filepath, {
        format: "JSON",
      });

      // Should handle the extension correctly
      expect(result.filePaths[0]).toMatch(/custom-export\.json$/);

      // Verify file exists
      const exists = await fs
        .access(result.filePaths[0])
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for unsupported format", async () => {
      await expect(
        exporter.export(testEvents, {
          format: "UNSUPPORTED" as any,
          outputDir: testOutputDir,
        })
      ).rejects.toThrow("Unsupported export format");
    });

    it("should handle empty events array", async () => {
      const result = await exporter.export([], {
        format: "JSON",
        outputDir: testOutputDir,
      });

      expect(result.recordCount).toBe(0);
      expect(result.filePaths.length).toBe(1);
    });
  });

  describe("Export Format Constants", () => {
    it("should define all expected export formats", () => {
      expect(EXPORT_FORMATS).toHaveProperty("JSON");
      expect(EXPORT_FORMATS).toHaveProperty("CSV");
      expect(EXPORT_FORMATS).toHaveProperty("XML");
      expect(EXPORT_FORMATS).toHaveProperty("PDF");
      expect(EXPORT_FORMATS).toHaveProperty("PARQUET");
    });

    it("should have correct format metadata", () => {
      expect(EXPORT_FORMATS.JSON.extension).toBe(".json");
      expect(EXPORT_FORMATS.JSON.mimeType).toBe("application/json");

      expect(EXPORT_FORMATS.CSV.extension).toBe(".csv");
      expect(EXPORT_FORMATS.CSV.mimeType).toBe("text/csv");
    });
  });
});
