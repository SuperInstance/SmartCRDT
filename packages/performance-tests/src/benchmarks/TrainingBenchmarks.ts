/**
 * @lsi/performance-tests
 *
 * Training benchmarks for shadow logging, preference pair generation,
 * ORPO training (mini-batch), and adapter deployment.
 */

import { createTracker, type BenchmarkResult } from "../Runner.js";

/**
 * Shadow log entry type
 */
interface ShadowLogEntry {
  queryId: string;
  query: string;
  response: string;
  privacyLevel: "SOVEREIGN" | "SENSITIVE" | "PUBLIC";
  timestamp: number;
  userId: string;
  embedding?: number[];
}

/**
 * Preference pair type for ORPO training
 */
interface PreferencePair {
  query: string;
  chosen: string;
  rejected: string;
  margin: number;
  timestamp: number;
}

/**
 * Adapter metadata type
 */
interface AdapterMetadata {
  id: string;
  version: string;
  baseModel: string;
  timestamp: number;
  trainingSamples: number;
  metrics: {
    loss: number;
    accuracy: number;
    latency: number;
  };
}

/**
 * Run training-related benchmarks
 */
export async function runTrainingBenchmarks(): Promise<BenchmarkResult> {
  const tracker = createTracker({
    time: 2000,
    iterations: 100,
    warmup: true,
    warmupIterations: 20,
  });

  // Create test shadow log data
  const shadowLog = Array.from({ length: 10000 }, (_, i) => ({
    queryId: crypto.randomUUID(),
    query: `Query ${i}: What is the meaning of life?`,
    response: `Response ${i}: The meaning of life is 42.`,
    privacyLevel:
      i % 3 === 0 ? "SOVEREIGN" : i % 2 === 0 ? "SENSITIVE" : "PUBLIC",
    timestamp: Date.now() - i * 1000,
    userId: `user-${i % 100}`,
    embedding: Array.from({ length: 768 }, () => Math.random() - 0.5),
  })) as ShadowLogEntry[];

  // Create preference pairs
  const preferencePairs = Array.from({ length: 1000 }, (_, i) => ({
    query: `Query ${i}`,
    chosen: `Better response ${i}`,
    rejected: `Worse response ${i}`,
    margin: Math.random(),
    timestamp: Date.now() - i * 1000,
  })) as PreferencePair[];

  // Create adapter metadata
  const adapterMetadata: AdapterMetadata = {
    id: "adapter-123",
    version: "1.0.0",
    baseModel: "llama2-7b",
    timestamp: Date.now(),
    trainingSamples: 10000,
    metrics: {
      loss: 0.35,
      accuracy: 0.85,
      latency: 150,
    },
  };

  // Create mini-batch data
  const miniBatch = Array.from({ length: 32 }, (_, i) => ({
    input: Array.from({ length: 512 }, () => Math.floor(Math.random() * 50000)),
    attentionMask: Array.from({ length: 512 }, () => 1),
    labels: Array.from({ length: 512 }, () =>
      Math.floor(Math.random() * 50000)
    ),
  }));

  // Run benchmarks
  return await tracker.runBenchmark("Training Operations", {
    // Shadow Logging Operations
    "Shadow log entry creation": () => {
      const entry: ShadowLogEntry = {
        queryId: crypto.randomUUID(),
        query: "What is AI?",
        response: "AI is artificial intelligence.",
        privacyLevel: "PUBLIC",
        timestamp: Date.now(),
        userId: "user-123",
        embedding: Array.from({ length: 768 }, () => Math.random() - 0.5),
      };
      return entry;
    },

    "Shadow log privacy filtering": () => {
      return shadowLog.filter(entry => entry.privacyLevel !== "SOVEREIGN");
    },

    "Shadow log anonymization (redact user IDs)": () => {
      return shadowLog.map(entry => ({
        ...entry,
        userId: "ANONYMIZED",
      }));
    },

    "Shadow log aggregation (by user)": () => {
      const aggregated = new Map<string, ShadowLogEntry[]>();
      for (const entry of shadowLog) {
        const entries = aggregated.get(entry.userId) || [];
        entries.push(entry);
        aggregated.set(entry.userId, entries);
      }
      return aggregated.size;
    },

    "Shadow log export (10000 entries to JSON)": () => {
      return JSON.stringify(shadowLog.slice(0, 10000));
    },

    "Shadow log compression simulation": () => {
      const json = JSON.stringify(shadowLog.slice(0, 1000));
      return Buffer.from(json).toString("base64");
    },

    // Preference Pair Generation Operations
    "Preference pair creation": () => {
      const pair: PreferencePair = {
        query: "Test query",
        chosen: "Good response",
        rejected: "Bad response",
        margin: 0.8,
        timestamp: Date.now(),
      };
      return pair;
    },

    "Preference pair generation from shadow log": () => {
      const pairs: PreferencePair[] = [];
      for (let i = 0; i < shadowLog.length - 1; i += 2) {
        pairs.push({
          query: shadowLog[i].query,
          chosen: shadowLog[i].response,
          rejected: shadowLog[i + 1].response,
          margin: Math.random(),
          timestamp: Date.now(),
        });
      }
      return pairs.length;
    },

    "Preference pair quality filtering (margin > 0.5)": () => {
      return preferencePairs.filter(pair => pair.margin > 0.5);
    },

    "Preference pair deduplication": () => {
      const seen = new Set<string>();
      const unique: PreferencePair[] = [];
      for (const pair of preferencePairs) {
        const key = `${pair.query}:${pair.chosen}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(pair);
        }
      }
      return unique.length;
    },

    "Preference pair shuffling": () => {
      const shuffled = [...preferencePairs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },

    // ORPO Training Operations (Simulation)
    "Mini-batch creation (batch size 32)": () => {
      return miniBatch;
    },

    "Mini-batch padding simulation": () => {
      const maxLength = 512;
      const padded = miniBatch.map(sample => ({
        ...sample,
        input: [...sample.input, ...Array.from({ length: 50 }, () => 0)].slice(
          0,
          maxLength
        ),
      }));
      return padded;
    },

    "Loss calculation simulation (cross-entropy)": () => {
      const logits = Array.from({ length: 50000 }, () => Math.random());
      const labels = Array.from({ length: 50000 }, () => Math.random());
      const loss = -logits.reduce(
        (sum, logit, i) => sum + labels[i] * Math.log(logit + 1e-10),
        0
      );
      return loss;
    },

    "Gradient calculation simulation": () => {
      const weights = Array.from({ length: 1000 }, () => Math.random());
      const gradients = weights.map(w => w * 0.01); // Simplified gradient
      return gradients;
    },

    "Optimizer step simulation (Adam)": () => {
      const params = Array.from({ length: 1000 }, () => Math.random());
      const gradients = Array.from({ length: 1000 }, () => Math.random() - 0.5);
      const m = Array.from({ length: 1000 }, () => 0); // First moment
      const v = Array.from({ length: 1000 }, () => 0); // Second moment
      const beta1 = 0.9;
      const beta2 = 0.999;
      const lr = 0.001;
      const epsilon = 1e-8;

      const newParams = params.map((param, i) => {
        m[i] = beta1 * m[i] + (1 - beta1) * gradients[i];
        v[i] = beta2 * v[i] + (1 - beta2) * gradients[i] ** 2;
        const mHat = m[i] / (1 - beta1);
        const vHat = v[i] / (1 - beta2);
        return param - (lr * mHat) / (Math.sqrt(vHat) + epsilon);
      });

      return newParams;
    },

    "Learning rate scheduling (cosine decay)": () => {
      const initialLr = 0.001;
      const step = 100;
      const totalSteps = 1000;
      const lr =
        initialLr * 0.5 * (1 + Math.cos((Math.PI * step) / totalSteps));
      return lr;
    },

    // Adapter Management Operations
    "Adapter metadata serialization": () => {
      return JSON.stringify(adapterMetadata);
    },

    "Adapter metadata deserialization": () => {
      const json = JSON.stringify(adapterMetadata);
      return JSON.parse(json);
    },

    "Adapter compatibility check": () => {
      const adapterVersion = adapterMetadata.version;
      const baseModel = adapterMetadata.baseModel;
      const supportedVersions = ["1.0.0", "1.1.0", "2.0.0"];
      const supportedModels = ["llama2-7b", "llama2-13b"];
      return (
        supportedVersions.includes(adapterVersion) &&
        supportedModels.includes(baseModel)
      );
    },

    "Adapter deployment preparation": () => {
      const deployment = {
        adapter: adapterMetadata,
        timestamp: Date.now(),
        status: "deploying",
        rollbackVersion: "0.9.0",
      };
      return deployment;
    },

    "Adapter rollback preparation": () => {
      const rollback = {
        currentAdapter: adapterMetadata,
        previousVersion: "0.9.0",
        reason: "Performance degradation",
        timestamp: Date.now(),
      };
      return rollback;
    },

    // Advanced Training Operations
    "Training checkpoint creation": () => {
      const checkpoint = {
        step: 1000,
        epoch: 1,
        modelParams: Array.from({ length: 1000 }, () => Math.random()),
        optimizerState: {
          m: Array.from({ length: 1000 }, () => Math.random()),
          v: Array.from({ length: 1000 }, () => Math.random()),
        },
        metrics: {
          loss: 0.35,
          accuracy: 0.85,
        },
        timestamp: Date.now(),
      };
      return checkpoint;
    },

    "Training checkpoint resumption": () => {
      const checkpoint = {
        step: 1000,
        params: Array.from({ length: 1000 }, () => Math.random()),
      };
      return checkpoint.step;
    },

    "Early stopping condition check": () => {
      const losses = [0.5, 0.45, 0.4, 0.38, 0.37, 0.37, 0.37];
      const patience = 3;
      const minDelta = 0.01;

      let noImprovement = 0;
      for (let i = 1; i < losses.length; i++) {
        if (losses[i - 1] - losses[i] < minDelta) {
          noImprovement++;
        } else {
          noImprovement = 0;
        }
      }

      return noImprovement >= patience;
    },

    "Training metrics aggregation": () => {
      const metrics = Array.from({ length: 100 }, () => ({
        loss: Math.random(),
        accuracy: Math.random(),
        latency: Math.random() * 1000,
      }));

      const avgLoss =
        metrics.reduce((sum, m) => sum + m.loss, 0) / metrics.length;
      const avgAccuracy =
        metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length;
      const avgLatency =
        metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;

      return { avgLoss, avgAccuracy, avgLatency };
    },

    "LoRA adapter weight merging": () => {
      const baseWeights = Array.from({ length: 1000 }, () => Math.random());
      const loraWeights = Array.from(
        { length: 1000 },
        () => Math.random() * 0.1
      );
      const alpha = 0.5;

      const merged = baseWeights.map(
        (base, i) => base + alpha * loraWeights[i]
      );

      return merged;
    },

    "Training data augmentation (text simulation)": () => {
      const original = "This is a test query.";
      const augmented = [
        original,
        original.toUpperCase(),
        original.split("").reverse().join(""),
        original.replace(/\s+/g, "  "),
      ];
      return augmented;
    },
  });
}

/**
 * Run benchmarks and export results
 */
export async function runAndExport(): Promise<void> {
  const result = await runTrainingBenchmarks();

  console.log("\n" + "=".repeat(80));
  console.log("TRAINING BENCHMARK RESULTS");
  console.log("=".repeat(80));
  console.log(result);

  const tracker = createTracker();
  await tracker.saveToFile("./benchmark-results-training.json", result);

  const markdown = tracker.exportMarkdown(result);
  console.log("\n" + markdown);
}
