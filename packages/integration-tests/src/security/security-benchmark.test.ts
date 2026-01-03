/**
 * Security Benchmarking Suite for Aequor Platform
 *
 * Comprehensive performance and effectiveness metrics for security components.
 * Establishes baseline measurements for detection rates, false positives,
 * processing time, and resource utilization.
 *
 * Benchmark Categories:
 * - Detection effectiveness
 * - False positive analysis
 * - Performance metrics
 * - Scalability testing
 * - Resource utilization
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from "vitest";
// Using source imports due to build issues in privacy package
import {
  PrivacyFirewall
} from "@lsi/privacy/src/firewall/index.js";
import {
  PrivacyClassifier
} from "@lsi/privacy/src/classifier/index.js";
import {
  SemanticPIIRedactor,
  RedactionStrategy
} from "@lsi/privacy/src/redaction/index.js";
import {
  PIIType,
  PrivacyLevel,
} from "@lsi/protocol";

/**
 * Benchmark datasets
 */
const BENCHMARK_DATA = {
  /**
   * High-value PII dataset
   *
   * Curated examples of real PII for testing detection accuracy
   */
  highValuePII: [
    { query: "My SSN is 123-45-6789", types: [PIIType.SSN] },
    { query: "Credit card: 4111-1111-1111-1111", types: [PIIType.CREDIT_CARD] },
    { query: "Email: john.doe@example.com", types: [PIIType.EMAIL] },
    { query: "Call me at 555-123-4567", types: [PIIType.PHONE] },
    { query: "Born on January 15, 1980", types: [PIIType.DATE_OF_BIRTH] },
    { query: "Passport # AB1234567", types: [PIIType.PASSPORT] },
    { query: "Driver's license: CA1234567", types: [PIIType.DRIVERS_LICENSE] },
    { query: "Address: 123 Main St, Springfield, IL 62701", types: [PIIType.ADDRESS] },
    { query: "IP: 192.168.1.1", types: [PIIType.IP_ADDRESS] },
    { query: "John Smith", types: [PIIType.NAME] },
  ],

  /**
   * False positive dataset
   *
   * Legitimate queries that should NOT be flagged
   */
  falsePositiveCandidates: [
    "What is the capital of France?",
    "How do I write a SQL SELECT statement?",
    "Show me the HTML <div> element",
    "What is a regular expression?",
    "Explain the concept of recursion",
    "How do I create an email template?",
    "What is a phone number format?",
    "Show me how to validate a credit card",
    "What is an IP address?",
    "How do I format a date?",
  ],

  /**
   * Edge cases and boundary conditions
   */
  edgeCases: [
    "", // Empty string
    " ", // Single space
    "a", // Single character
    "a".repeat(10000), // Very long string
    "!@#$%^&*()", // Special characters only
    "1234567890", // Digits only
    "test@example.com" + "@".repeat(100), // Invalid format
    "SSN: 123-45-6789" + " and ".repeat(100) + "email: test@test.com", // Multiple PII
    "My email is", // Incomplete PII
    "Email is", // No actual value
  ],

  /**
   * Performance test datasets
   */
  performanceQueries: [
    // Simple queries
    "What is the capital of France?",
    "How do I write a function?",
    "Explain recursion",
    // Medium complexity
    "My email is john@example.com and my phone is 555-123-4567",
    "Update the user profile with name John Smith",
    // High complexity
    "My SSN is 123-45-6789, DOB is 01/15/1980, and I live at 123 Main St, Springfield, IL 62701",
    "Contact me at john@example.com or call 555-123-4567 or 555-987-6543",
  ],
};

/**
 * Benchmark metrics
 */
interface BenchmarkMetrics {
  detectionRate: number;
  falsePositiveRate: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgProcessingTime: number;
  throughput: number;
}

/**
 * Benchmark utilities
 */
class BenchmarkUtils {
  /**
   * Measure detection accuracy
   */
  static async measureDetectionAccuracy(
    classifier: PrivacyClassifier,
    testData: Array<{ query: string; types: PIIType[] }>
  ): Promise<{
    correct: number;
    total: number;
    accuracy: number;
    confusionMatrix: Map<PIIType, { tp: number; fp: number; fn: number }>;
  }> {
    let correct = 0;
    let total = 0;
    const confusionMatrix = new Map<PIIType, { tp: number; fp: number; fn: number }>();

    for (const { query, types } of testData) {
      total++;

      const result = await classifier.classify(query);
      const detected = result.detectedPII;

      // Initialize confusion matrix entries
      for (const type of types) {
        if (!confusionMatrix.has(type)) {
          confusionMatrix.set(type, { tp: 0, fp: 0, fn: 0 });
        }
      }
      for (const type of detected) {
        if (!confusionMatrix.has(type)) {
          confusionMatrix.set(type, { tp: 0, fp: 0, fn: 0 });
        }
      }

      // Calculate true positives, false positives, false negatives
      for (const type of types) {
        const entry = confusionMatrix.get(type)!;
        if (detected.includes(type)) {
          entry.tp++;
          correct++;
        } else {
          entry.fn++;
        }
      }

      for (const type of detected) {
        if (!types.includes(type)) {
          const entry = confusionMatrix.get(type)!;
          entry.fp++;
        }
      }
    }

    return {
      correct,
      total,
      accuracy: correct / total,
      confusionMatrix,
    };
  }

  /**
   * Measure false positive rate
   */
  static async measureFalsePositiveRate(
    classifier: PrivacyClassifier,
    safeQueries: string[]
  ): Promise<{
    falsePositives: number;
    total: number;
    rate: number;
  }> {
    let falsePositives = 0;

    for (const query of safeQueries) {
      const result = await classifier.classify(query);
      if (result.level !== PrivacyLevel.PUBLIC) {
        falsePositives++;
      }
    }

    return {
      falsePositives,
      total: safeQueries.length,
      rate: falsePositives / safeQueries.length,
    };
  }

  /**
   * Measure processing time
   */
  static measureProcessingTime(
    fn: () => void | Promise<void>,
    iterations = 100
  ): Promise<{
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50: number;
    p95: number;
    p99: number;
  }> {
    return new Promise(async (resolve) => {
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await fn();
        times.push(Date.now() - start);
      }

      times.sort((a, b) => a - b);

      resolve({
        totalTime: times.reduce((a, b) => a + b, 0),
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: times[0],
        maxTime: times[times.length - 1],
        p50: times[Math.floor(times.length * 0.5)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)],
      });
    });
  }

  /**
   * Measure throughput
   */
  static async measureThroughput(
    fn: () => void | Promise<void>,
    duration = 5000
  ): Promise<number> {
    const start = Date.now();
    let count = 0;

    while (Date.now() - start < duration) {
      await fn();
      count++;
    }

    // Return queries per second
    return (count / (Date.now() - start)) * 1000;
  }

  /**
   * Calculate F1 score
   */
  static calculateF1(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return 2 * ((precision * recall) / (precision + recall));
  }
}

describe("Security Benchmarks", () => {
  let firewall: PrivacyFirewall;
  let classifier: PrivacyClassifier;
  let redactor: SemanticPIIRedactor;

  beforeEach(() => {
    firewall = new PrivacyFirewall({ enableDefaultRules: true });
    classifier = new PrivacyClassifier();
    redactor = new SemanticPIIRedactor();
  });

  describe("Detection Effectiveness", () => {
    it("should achieve >90% detection rate for high-value PII", async () => {
      const result = await BenchmarkUtils.measureDetectionAccuracy(
        classifier,
        BENCHMARK_DATA.highValuePII
      );

      expect(result.accuracy).toBeGreaterThan(0.9);
    });

    it("should achieve >85% detection rate for all PII types", async () => {
      const result = await BenchmarkUtils.measureDetectionAccuracy(
        classifier,
        BENCHMARK_DATA.highValuePII
      );

      // Check per-type accuracy
      for (const [type, metrics] of result.confusionMatrix.entries()) {
        const typeAccuracy = metrics.tp / (metrics.tp + metrics.fn);
        expect(typeAccuracy).toBeGreaterThan(0.85);
      }
    });

    it("should handle multiple PII instances in single query", async () => {
      const multiPIIQuery =
        "My SSN is 123-45-6789, email is john@example.com, and phone is 555-123-4567";
      const result = await classifier.classify(multiPIIQuery);

      expect(result.detectedPII).toContain(PIIType.SSN);
      expect(result.detectedPII).toContain(PIIType.EMAIL);
      expect(result.detectedPII).toContain(PIIType.PHONE);
    });
  });

  describe("False Positive Analysis", () => {
    it("should maintain <5% false positive rate on safe queries", async () => {
      const result = await BenchmarkUtils.measureFalsePositiveRate(
        classifier,
        BENCHMARK_DATA.falsePositiveCandidates
      );

      expect(result.rate).toBeLessThan(0.05);
    });

    it("should not flag technical documentation as sensitive", async () => {
      const techQueries = [
        "How do I use the <script> tag in HTML?",
        "What is the format for SQL INSERT statements?",
        "How do I validate email addresses in JavaScript?",
        "What is a regular expression pattern?",
      ];

      for (const query of techQueries) {
        const result = await classifier.classify(query);
        expect(result.level).toBe(PrivacyLevel.PUBLIC);
      }
    });
  });

  describe("Precision and Recall", () => {
    it("should achieve precision >0.9 on high-value PII", async () => {
      const result = await BenchmarkUtils.measureDetectionAccuracy(
        piiDetector,
        BENCHMARK_DATA.highValuePII
      );

      // Calculate precision: TP / (TP + FP)
      let totalTp = 0;
      let totalFp = 0;

      for (const metrics of result.confusionMatrix.values()) {
        totalTp += metrics.tp;
        totalFp += metrics.fp;
      }

      const precision = totalTp / (totalTp + totalFp);
      expect(precision).toBeGreaterThan(0.9);
    });

    it("should achieve recall >0.85 on high-value PII", async () => {
      const result = await BenchmarkUtils.measureDetectionAccuracy(
        piiDetector,
        BENCHMARK_DATA.highValuePII
      );

      // Calculate recall: TP / (TP + FN)
      let totalTp = 0;
      let totalFn = 0;

      for (const metrics of result.confusionMatrix.values()) {
        totalTp += metrics.tp;
        totalFn += metrics.fn;
      }

      const recall = totalTp / (totalTp + totalFn);
      expect(recall).toBeGreaterThan(0.85);
    });

    it("should achieve F1 score >0.87", async () => {
      const result = await BenchmarkUtils.measureDetectionAccuracy(
        piiDetector,
        BENCHMARK_DATA.highValuePII
      );

      let totalTp = 0;
      let totalFp = 0;
      let totalFn = 0;

      for (const metrics of result.confusionMatrix.values()) {
        totalTp += metrics.tp;
        totalFp += metrics.fp;
        totalFn += metrics.fn;
      }

      const precision = totalTp / (totalTp + totalFp);
      const recall = totalTp / (totalTp + totalFn);
      const f1 = BenchmarkUtils.calculateF1(precision, recall);

      expect(f1).toBeGreaterThan(0.87);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should complete PII detection in <50ms (avg)", async () => {
      const query = "My email is john@example.com";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => piiDetector.detect(query),
        100
      );

      expect(result.avgTime).toBeLessThan(50);
    });

    it("should complete classification in <100ms (avg)", async () => {
      const query = "My SSN is 123-45-6789";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => classifier.classify(query),
        100
      );

      expect(result.avgTime).toBeLessThan(100);
    });

    it("should complete redaction in <50ms (avg)", async () => {
      const query = "My email is john@example.com";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => redactor.redact(query),
        100
      );

      expect(result.avgTime).toBeLessThan(50);
    });

    it("should maintain p95 latency <200ms for classification", async () => {
      const query = "My SSN is 123-45-6789 and I was born on 01/15/1980";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => classifier.classify(query),
        100
      );

      expect(result.p95).toBeLessThan(200);
    });
  });

  describe("Throughput Benchmarks", () => {
    it("should achieve >1000 PII detections per second", async () => {
      const query = "Email: test@example.com";
      const throughput = await BenchmarkUtils.measureThroughput(
        () => classifier.classify(query),
        5000
      );

      expect(throughput).toBeGreaterThan(1000);
    });

    it("should achieve >500 classifications per second", async () => {
      const query = "My email is john@example.com";
      const throughput = await BenchmarkUtils.measureThroughput(
        () => classifier.classify(query),
        5000
      );

      expect(throughput).toBeGreaterThan(500);
    });

    it("should achieve >1000 redactions per second", async () => {
      const query = "Email: test@example.com";
      const throughput = await BenchmarkUtils.measureThroughput(
        () => redactor.redact(query),
        5000
      );

      expect(throughput).toBeGreaterThan(1000);
    });
  });

  describe("Scalability Tests", () => {
    it("should handle queries with 100+ PII instances", () => {
      const largeQuery = Array(100)
        .fill("Email: test@example.com, ")
        .join("");
      const result = redactor.redact(largeQuery);

      expect(result.redactionCount).toBe(100);
      expect(result.redacted).not.toContain("test@example.com");
    });

    it("should handle very long queries (10k+ chars)", () => {
      const longQuery = "a".repeat(10000) + " Email: test@example.com";
      const result = redactor.redact(longQuery);

      expect(result.redacted).not.toContain("test@example.com");
    });

    it("should maintain performance with concurrent load", async () => {
      const query = "My SSN is 123-45-6789";
      const concurrent = 100;

      const start = Date.now();
      await Promise.all(Array(concurrent).fill(null).map(() => classifier.classify(query)));
      const time = Date.now() - start;

      // Should complete in <5 seconds total
      expect(time).toBeLessThan(5000);
    });
  });

  describe("Memory Efficiency", () => {
    it("should not leak memory during repeated operations", async () => {
      const query = "My email is john@example.com";
      const iterations = 1000;

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await classifier.classify(query);
        redactor.redact(query);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be <10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it("should efficiently handle large batches", async () => {
      const queries = Array(1000)
        .fill("Email: test@example.com")
        .map((q, i) => `${q} #${i}`);

      const start = Date.now();
      const results = await Promise.all(
        queries.map((q) => classifier.classify(q))
      );
      const time = Date.now() - start;

      expect(results.length).toBe(1000);
      expect(time).toBeLessThan(5000);
    });
  });

  describe("Redaction Strategy Performance", () => {
    it("should measure FULL strategy performance", async () => {
      const query = "My email is john@example.com";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => redactor.redact(query, RedactionStrategy.FULL),
        100
      );

      expect(result.avgTime).toBeLessThan(50);
    });

    it("should measure PARTIAL strategy performance", async () => {
      const query = "My email is john@example.com";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => redactor.redact(query, RedactionStrategy.PARTIAL),
        100
      );

      expect(result.avgTime).toBeLessThan(50);
    });

    it("should measure TOKEN strategy performance", async () => {
      const query = "My email is john@example.com";
      const result = await BenchmarkUtils.measureProcessingTime(
        () => redactor.redact(query, RedactionStrategy.TOKEN),
        100
      );

      expect(result.avgTime).toBeLessThan(50);
    });
  });

  describe("Firewall Performance", () => {
    it("should evaluate firewall rules in <10ms", async () => {
      const query = "My SSN is 123-45-6789";
      const result = await BenchmarkUtils.measureProcessingTime(
        () =>
          firewall.evaluate(
            query,
            {
              level: PrivacyLevel.SOVEREIGN,
              confidence: 0.95,
              piiTypes: [PIIType.SSN],
              reason: "Contains SSN",
            },
            "cloud"
          ),
        100
      );

      expect(result.avgTime).toBeLessThan(10);
    });

    it("should handle large rule sets efficiently", async () => {
      // Add many custom rules
      for (let i = 0; i < 100; i++) {
        firewall.addRule({
          id: `custom-rule-${i}`,
          name: `Custom Rule ${i}`,
          description: `Test rule ${i}`,
          condition: { type: "classification", value: PrivacyLevel.PUBLIC },
          action: { type: "allow" },
          priority: 50 + i,
          enabled: true,
        });
      }

      const query = "Test query";
      const result = await BenchmarkUtils.measureProcessingTime(
        () =>
          firewall.evaluate(
            query,
            {
              level: PrivacyLevel.PUBLIC,
              confidence: 0.9,
              piiTypes: [],
              reason: "Test",
            },
            "cloud"
          ),
        100
      );

      // Should still be fast even with 100+ rules
      expect(result.avgTime).toBeLessThan(20);
    });
  });

  describe("Edge Case Handling", () => {
    it("should handle empty strings gracefully", async () => {
      const result = await classifier.classify("");
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
    });

    it("should handle very long strings", async () => {
      const longString = "a".repeat(100000);
      const result = await classifier.classify(longString);
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
    });

    it("should handle special characters", async () => {
      const specialString = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
      const result = await classifier.classify(specialString);
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
    });

    it("should handle unicode characters", async () => {
      const unicodeString = "你好世界 🌍 🎉";
      const result = await classifier.classify(unicodeString);
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe("Comprehensive Benchmark Report", () => {
    it("should generate complete benchmark metrics", async () => {
      const metrics: Partial<BenchmarkMetrics> = {};

      // Detection accuracy
      const accuracyResult = await BenchmarkUtils.measureDetectionAccuracy(
        classifier,
        BENCHMARK_DATA.highValuePII
      );
      metrics.detectionRate = accuracyResult.accuracy;

      // False positive rate
      const fpResult = await BenchmarkUtils.measureFalsePositiveRate(
        classifier,
        BENCHMARK_DATA.falsePositiveCandidates
      );
      metrics.falsePositiveRate = fpResult.rate;

      // Processing time
      const timeResult = await BenchmarkUtils.measureProcessingTime(
        () => classifier.classify("My SSN is 123-45-6789"),
        100
      );
      metrics.avgProcessingTime = timeResult.avgTime;

      // Throughput
      const throughput = await BenchmarkUtils.measureThroughput(
        () => classifier.classify("Email: test@example.com"),
        5000
      );
      metrics.throughput = throughput;

      // Verify all metrics meet baseline requirements
      expect(metrics.detectionRate).toBeGreaterThan(0.9);
      expect(metrics.falsePositiveRate).toBeLessThan(0.05);
      expect(metrics.avgProcessingTime).toBeLessThan(100);
      expect(metrics.throughput).toBeGreaterThan(1000);

      // Log metrics for reporting
      console.log("Security Benchmark Metrics:", JSON.stringify(metrics, null, 2));
    });
  });
});
