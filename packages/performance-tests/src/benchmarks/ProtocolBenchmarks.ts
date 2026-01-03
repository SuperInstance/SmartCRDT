/**
 * @lsi/performance-tests
 *
 * Protocol benchmarks for ATP/ACP packet operations.
 * Tests serialization, version negotiation, cartridge loading, and rollback operations.
 */

import { createTracker, type BenchmarkResult } from "../Runner.js";
import {
  ATPacket,
  ACPHandshake,
  ACPResponse,
  VersionNegotiation,
  CartridgeManifest,
  RollbackProtocol,
} from "@lsi/protocol";

/**
 * Run protocol-related benchmarks
 */
export async function runProtocolBenchmarks(): Promise<BenchmarkResult> {
  const tracker = createTracker({
    time: 2000,
    iterations: 100,
    warmup: true,
    warmupIterations: 20,
  });

  // Create test data
  const testPacket: ATPacket = {
    version: "1.0.0",
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    query: "What is the capital of France?",
    context: {
      sessionId: "session-123",
      userId: "user-456",
    },
  };

  const testHandshake: ACPHandshake = {
    version: "1.0.0",
    supportedVersions: ["1.0.0", "1.1.0", "2.0.0"],
    capabilities: ["streaming", "batch", "priority"],
    sessionId: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  const testManifest: CartridgeManifest = {
    id: "test-cartridge",
    name: "Test Knowledge Cartridge",
    version: "1.0.0",
    description: "Test cartridge for benchmarking",
    author: "LSI Team",
    dependencies: [],
    capabilities: ["semantic-search", "knowledge-retrieval"],
    size: 1024000,
    checksum: "abc123",
    entries: 100,
  };

  const testRollbackData = {
    version: "1.0.0",
    previousVersion: "0.9.0",
    rollbackPoint: Date.now(),
    reason: "Performance degradation detected",
    metadata: {
      adapterId: "adapter-123",
      trainingRunId: "run-456",
    },
  };

  // Run benchmarks
  return await tracker.runBenchmark("Protocol Operations", {
    // ATP Packet Operations
    "ATP packet serialization": () => {
      const json = JSON.stringify(testPacket);
      return json;
    },

    "ATP packet deserialization": () => {
      const json = JSON.stringify(testPacket);
      const parsed = JSON.parse(json);
      return parsed;
    },

    "ATP packet validation": () => {
      const packet = { ...testPacket };
      const isValid =
        packet.version !== undefined &&
        packet.id !== undefined &&
        packet.query !== undefined &&
        packet.timestamp !== undefined &&
        Date.now() - packet.timestamp < 60000; // Within 60 seconds
      return isValid;
    },

    "Batch ATP packet serialization (10 packets)": () => {
      const packets = Array.from({ length: 10 }, (_, i) => ({
        ...testPacket,
        id: crypto.randomUUID(),
        query: `Query ${i}`,
      }));
      return JSON.stringify(packets);
    },

    // ACP Handshake Operations
    "ACP handshake serialization": () => {
      const json = JSON.stringify(testHandshake);
      return json;
    },

    "ACP handshake deserialization": () => {
      const json = JSON.stringify(testHandshake);
      const parsed = JSON.parse(json);
      return parsed;
    },

    "Version negotiation comparison": () => {
      const clientVersion = "1.0.0";
      const serverVersions = ["1.0.0", "1.1.0", "2.0.0"];
      const compatible = serverVersions.includes(clientVersion);
      return compatible;
    },

    "Version range matching": () => {
      const clientRange = "^1.0.0";
      const serverVersion = "1.2.3";
      // Simplified semver matching
      const majorMatch = serverVersion.split(".")[0] === "1";
      return majorMatch;
    },

    // Cartridge Operations
    "Cartridge manifest serialization": () => {
      const json = JSON.stringify(testManifest);
      return json;
    },

    "Cartridge manifest parsing": () => {
      const json = JSON.stringify(testManifest);
      const parsed = JSON.parse(json);
      return parsed;
    },

    "Cartridge dependency resolution (5 deps)": () => {
      const cartridges = [
        { id: "a", dependencies: ["b", "c"] },
        { id: "b", dependencies: ["d"] },
        { id: "c", dependencies: ["d"] },
        { id: "d", dependencies: [] },
        { id: "e", dependencies: ["a"] },
      ];

      // Simple dependency check
      const resolved = new Set<string>();
      const toCheck = ["e"];

      while (toCheck.length > 0) {
        const current = toCheck.shift()!;
        if (resolved.has(current)) continue;

        const cartridge = cartridges.find(c => c.id === current);
        if (cartridge) {
          resolved.add(current);
          toCheck.push(...cartridge.dependencies);
        }
      }

      return resolved.size;
    },

    "Cartridge checksum validation (SHA256 simulation)": () => {
      const data = JSON.stringify(testManifest);
      // Simple hash simulation
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16);
    },

    // Rollback Protocol Operations
    "Rollback state serialization": () => {
      const json = JSON.stringify(testRollbackData);
      return json;
    },

    "Rollback state deserialization": () => {
      const json = JSON.stringify(testRollbackData);
      const parsed = JSON.parse(json);
      return parsed;
    },

    "Rollback eligibility check": () => {
      const currentVersion = "1.0.0";
      const rollbackWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
      const rollbackPoint = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      const withinWindow = Date.now() - rollbackPoint < rollbackWindow;
      return withinWindow;
    },

    "Rollback point creation (1000 snapshots)": () => {
      const snapshots = Array.from({ length: 1000 }, (_, i) => ({
        version: `1.0.${i}`,
        timestamp: Date.now() - i * 60000,
        state: { value: i },
      }));
      return snapshots;
    },

    "Rollback point search": () => {
      const snapshots = Array.from({ length: 1000 }, (_, i) => ({
        version: `1.0.${i}`,
        timestamp: Date.now() - i * 60000,
        state: { value: i },
      }));

      const targetTime = Date.now() - 500 * 60000;
      const found = snapshots.find(s => s.timestamp <= targetTime);
      return found?.version;
    },

    // Mixed Operations
    "End-to-end packet roundtrip": () => {
      const original = { ...testPacket };
      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized);
      return deserialized.id === original.id;
    },

    "Packet compression simulation (gzip)": () => {
      const data = JSON.stringify(testPacket);
      // Simulate compression with simple encoding
      const compressed = Buffer.from(data).toString("base64");
      return compressed;
    },

    "Packet decompression simulation": () => {
      const data = JSON.stringify(testPacket);
      const compressed = Buffer.from(data).toString("base64");
      const decompressed = Buffer.from(compressed, "base64").toString("utf-8");
      return decompressed;
    },
  });
}

/**
 * Run benchmarks and export results
 */
export async function runAndExport(): Promise<void> {
  const result = await runProtocolBenchmarks();

  console.log("\n" + "=".repeat(80));
  console.log("PROTOCOL BENCHMARK RESULTS");
  console.log("=".repeat(80));
  console.log(result);

  const tracker = createTracker();
  await tracker.saveToFile("./benchmark-results-protocol.json", result);

  const markdown = tracker.exportMarkdown(result);
  console.log("\n" + markdown);
}
