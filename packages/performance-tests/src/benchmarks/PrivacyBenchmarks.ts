/**
 * @lsi/performance-tests
 *
 * Privacy benchmarks for intent encoding, PII redaction,
 * Byzantine ensemble inference, and audit log operations.
 */

import { createTracker, type BenchmarkResult } from "../Runner.js";

/**
 * PII entity type
 */
interface PIISpan {
  type: string;
  start: number;
  end: number;
  value: string;
  confidence: number;
}

/**
 * Intent vector type
 */
interface IntentVector {
  vector: number[];
  confidence: number;
  categories: string[];
}

/**
 * Run privacy-related benchmarks
 */
export async function runPrivacyBenchmarks(): Promise<BenchmarkResult> {
  const tracker = createTracker({
    time: 2000,
    iterations: 100,
    warmup: true,
    warmupIterations: 20,
  });

  // Create test data
  const testQuery =
    "My email is john.doe@example.com and my SSN is 123-45-6789. Please send the report to jane.smith@company.org.";

  const testPIIEntities: PIISpan[] = [
    {
      type: "EMAIL",
      start: 12,
      end: 30,
      value: "john.doe@example.com",
      confidence: 0.98,
    },
    { type: "SSN", start: 45, end: 57, value: "123-45-6789", confidence: 0.95 },
    {
      type: "EMAIL",
      start: 88,
      end: 108,
      value: "jane.smith@company.org",
      confidence: 0.97,
    },
  ];

  // Create test intent vector (768-dim for real embeddings, using smaller for benchmark)
  const testIntentVector: IntentVector = {
    vector: Array.from({ length: 768 }, () => Math.random() - 0.5),
    confidence: 0.85,
    categories: ["question", "factual", "personal"],
  };

  // Byzantine ensemble test data
  const ensembleResponses = [
    {
      model: "model-1",
      response: "Response 1",
      confidence: 0.8,
      timestamp: Date.now(),
    },
    {
      model: "model-2",
      response: "Response 2",
      confidence: 0.9,
      timestamp: Date.now(),
    },
    {
      model: "model-3",
      response: "Response 3",
      confidence: 0.7,
      timestamp: Date.now(),
    },
    {
      model: "model-4",
      response: "Response 4",
      confidence: 0.85,
      timestamp: Date.now(),
    },
    {
      model: "model-5",
      response: "Response 5",
      confidence: 0.75,
      timestamp: Date.now(),
    },
  ];

  // Audit log entries
  const auditLog = Array.from({ length: 1000 }, (_, i) => ({
    timestamp: Date.now() - i * 1000,
    action: "query",
    userId: `user-${i % 100}`,
    queryId: crypto.randomUUID(),
    privacyLevel:
      i % 3 === 0 ? "SENSITIVE" : i % 2 === 0 ? "SOVEREIGN" : "PUBLIC",
    redacted: i % 3 === 0,
  }));

  // Run benchmarks
  return await tracker.runBenchmark("Privacy Operations", {
    // Intent Encoding Operations
    "Intent vector creation (768-dim)": () => {
      const vector = Array.from({ length: 768 }, () => Math.random() - 0.5);
      return vector;
    },

    "Intent vector serialization": () => {
      const json = JSON.stringify(testIntentVector);
      return json;
    },

    "Intent vector deserialization": () => {
      const json = JSON.stringify(testIntentVector);
      const parsed = JSON.parse(json);
      return parsed;
    },

    "Intent similarity calculation (cosine)": () => {
      const v1 = Array.from({ length: 768 }, () => Math.random() - 0.5);
      const v2 = Array.from({ length: 768 }, () => Math.random() - 0.5);

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
      }

      return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    },

    "Intent clustering (k-means, 5 clusters, 100 points)": () => {
      const points = Array.from({ length: 100 }, () =>
        Array.from({ length: 50 }, () => Math.random())
      );

      // Simplified k-means (5 iterations)
      const k = 5;
      let centroids = points.slice(0, k);

      for (let iter = 0; iter < 5; iter++) {
        // Assign points to nearest centroid
        const clusters = Array.from({ length: k }, () => []);

        for (const point of points) {
          let minDist = Infinity;
          let nearest = 0;

          for (let i = 0; i < k; i++) {
            let dist = 0;
            for (let j = 0; j < point.length; j++) {
              dist += (point[j] - centroids[i][j]) ** 2;
            }
            if (dist < minDist) {
              minDist = dist;
              nearest = i;
            }
          }

          clusters[nearest].push(point);
        }

        // Update centroids
        for (let i = 0; i < k; i++) {
          if (clusters[i].length > 0) {
            const newCentroid = Array.from({ length: 50 }, () => 0);
            for (const point of clusters[i]) {
              for (let j = 0; j < point.length; j++) {
                newCentroid[j] += point[j];
              }
            }
            centroids[i] = newCentroid.map(v => v / clusters[i].length);
          }
        }
      }

      return centroids.length;
    },

    // PII Redaction Operations
    "PII detection (regex-based, 12 types)": () => {
      const patterns = {
        EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
        PHONE: /\b\d{3}-\d{3}-\d{4}\b/g,
        CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        DATE: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,
      };

      const detections: string[] = [];
      for (const [type, pattern] of Object.entries(patterns)) {
        const matches = testQuery.match(pattern);
        if (matches) {
          detections.push(...matches.map(m => `${type}:${m}`));
        }
      }
      return detections;
    },

    "PII redaction (simple replacement)": () => {
      let redacted = testQuery;
      for (const entity of testPIIEntities) {
        const prefix = redacted.substring(0, entity.start);
        const suffix = redacted.substring(entity.end);
        const placeholder = `[${entity.type}]`;
        redacted = prefix + placeholder + suffix;
      }
      return redacted;
    },

    "PII redaction with offset adjustment": () => {
      let redacted = testQuery;
      let offset = 0;

      // Sort by start position
      const sorted = [...testPIIEntities].sort((a, b) => a.start - b.start);

      for (const entity of sorted) {
        const start = entity.start + offset;
        const end = entity.end + offset;
        const prefix = redacted.substring(0, start);
        const suffix = redacted.substring(end);
        const placeholder = `[${entity.type}]`;
        redacted = prefix + placeholder + suffix;
        offset += placeholder.length - (entity.end - entity.start);
      }
      return redacted;
    },

    "PII redaction (10 entities)": () => {
      const largeText = Array.from(
        { length: 10 },
        (_, i) => `Email ${i}: user${i}@example.com, Phone: 555-010${i}`
      ).join(" ");

      return largeText
        .replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          "[EMAIL]"
        )
        .replace(/\b\d{3}-\d{3}-\d{4}\b/g, "[PHONE]");
    },

    // Byzantine Ensemble Operations
    "Byzantine ensemble aggregation (5 models)": () => {
      // Weighted average based on confidence
      const weights = ensembleResponses.map(r => r.confidence);
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      const aggregated = ensembleResponses.reduce((acc, response, i) => {
        const weight = weights[i] / totalWeight;
        return acc + response.confidence * weight;
      }, 0);

      return aggregated;
    },

    "Byzantine fault detection (z-score)": () => {
      const values = ensembleResponses.map(r => r.confidence);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);

      const outliers = values.filter(v => Math.abs((v - mean) / std) > 2);
      return outliers.length;
    },

    "Byzantine response ranking": () => {
      const ranked = [...ensembleResponses].sort(
        (a, b) => b.confidence - a.confidence
      );
      return ranked[0].model;
    },

    "Byzantine consensus calculation": () => {
      const threshold = 0.8;
      const consensus = ensembleResponses.filter(
        r => r.confidence >= threshold
      );
      return consensus.length;
    },

    // Audit Log Operations
    "Audit log entry creation": () => {
      const entry = {
        timestamp: Date.now(),
        action: "query",
        userId: "user-123",
        queryId: crypto.randomUUID(),
        privacyLevel: "SENSITIVE",
        redacted: true,
      };
      return entry;
    },

    "Audit log filtering (by user)": () => {
      return auditLog.filter(entry => entry.userId === "user-42");
    },

    "Audit log filtering (by privacy level)": () => {
      return auditLog.filter(entry => entry.privacyLevel === "SENSITIVE");
    },

    "Audit log aggregation (count by user)": () => {
      const counts = new Map<string, number>();
      for (const entry of auditLog) {
        counts.set(entry.userId, (counts.get(entry.userId) || 0) + 1);
      }
      return counts.size;
    },

    "Audit log export (JSON)": () => {
      return JSON.stringify(auditLog);
    },

    "Audit log export (CSV)": () => {
      const headers = "timestamp,action,userId,queryId,privacyLevel,redacted";
      const rows = auditLog.map(
        e =>
          `${e.timestamp},${e.action},${e.userId},${e.queryId},${e.privacyLevel},${e.redacted}`
      );
      return [headers, ...rows].join("\n");
    },

    // Differential Privacy Operations
    "Noise injection (Laplace, ε=1.0)": () => {
      const epsilon = 1.0;
      const sensitivity = 1.0;
      const scale = sensitivity / epsilon;

      // Box-Muller transform for Laplace
      const u = Math.random() - 0.5;
      const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      return noise;
    },

    "ε-differential privacy application": () => {
      const value = 100;
      const epsilon = 0.5;
      const sensitivity = 1.0;
      const scale = sensitivity / epsilon;

      const u = Math.random() - 0.5;
      const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      return value + noise;
    },

    "Privacy budget tracking": () => {
      const budgets = new Map<string, number>();
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      for (const user of users) {
        const current = budgets.get(user) || 1.0;
        const spent = 0.1;
        budgets.set(user, Math.max(0, current - spent));
      }

      return budgets.size;
    },
  });
}

/**
 * Run benchmarks and export results
 */
export async function runAndExport(): Promise<void> {
  const result = await runPrivacyBenchmarks();

  console.log("\n" + "=".repeat(80));
  console.log("PRIVACY BENCHMARK RESULTS");
  console.log("=".repeat(80));
  console.log(result);

  const tracker = createTracker();
  await tracker.saveToFile("./benchmark-results-privacy.json", result);

  const markdown = tracker.exportMarkdown(result);
  console.log("\n" + markdown);
}
