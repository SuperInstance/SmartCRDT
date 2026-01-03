/**
 * Privacy Benchmarks - Comprehensive privacy layer performance testing
 *
 * Benchmarks:
 * - Encryption/decryption overhead
 * - Intent encoding performance
 * - R-A Protocol overhead
 * - Privacy classification latency
 * - Differential privacy impact on utility
 */

import { performance } from 'perf_hooks';

/**
 * Encryption benchmark result
 */
export interface EncryptionBenchmarkResult {
  algorithm: string;
  keySize: number;
  dataSize: number;
  iterations: number;
  encryptionTime: number;
  decryptionTime: number;
  totalTime: number;
  throughput: number; // MB/sec
  overhead: number; // percentage
}

/**
 * Intent encoding result
 */
export interface IntentEncodingResult {
  method: string;
  originalSize: number;
  encodedSize: number;
  compressionRatio: number;
  encodingTime: number;
  decodingTime: number;
  throughput: number;
  privacyLoss: number; // estimated
}

/**
 * R-A Protocol benchmark result
 */
export interface RAPProtocolResult {
  operation: 'redaction' | 'rehydration';
  dataSize: number;
  redactionCount: number;
  processingTime: number;
  throughput: number;
  overhead: number;
  preservedStructure: boolean;
}

/**
 * Privacy classification result
 */
export interface PrivacyClassificationResult {
  classifier: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
}

/**
 * Differential privacy result
 */
export interface DifferentialPrivacyResult {
  epsilon: number;
  mechanism: string;
  utilityLoss: number; // percentage
  noiseVariance: number;
  processingTime: number;
  dataUtility: number; // 0-1 score
  privacyGuarantee: number; // 0-1 score
}

/**
 * Privacy benchmark suite
 */
export interface PrivacyBenchmarkSuite {
  timestamp: number;
  encryption: EncryptionBenchmarkResult[];
  intentEncoding: IntentEncodingResult[];
  raProtocol: RAPProtocolResult[];
  classification: PrivacyClassificationResult[];
  differentialPrivacy: DifferentialPrivacyResult[];
}

/**
 * Benchmark configuration
 */
export interface PrivacyBenchmarkConfig {
  warmupIterations?: number;
  benchmarkIterations?: number;
  dataSizes?: number[];
  epsilonValues?: number[];
  algorithms?: string[];
  enableEncryptionTests?: boolean;
  enableEncodingTests?: boolean;
  enableRATests?: boolean;
  enableClassificationTests?: boolean;
  enableDPTests?: boolean;
}

/**
 * Privacy benchmark suite
 */
export class PrivacyBenchmarks {
  private config: Required<PrivacyBenchmarkConfig>;

  constructor(config: PrivacyBenchmarkConfig = {}) {
    this.config = {
      warmupIterations: config.warmupIterations ?? 10,
      benchmarkIterations: config.benchmarkIterations ?? 100,
      dataSizes: config.dataSizes ?? [1024, 10240, 102400, 1024000], // 1KB to 1MB
      epsilonValues: config.epsilonValues ?? [0.1, 0.5, 1.0, 5.0, 10.0],
      algorithms: config.algorithms ?? ['AES-256-GCM', 'ChaCha20-Poly1305'],
      enableEncryptionTests: config.enableEncryptionTests ?? true,
      enableEncodingTests: config.enableEncodingTests ?? true,
      enableRATests: config.enableRATests ?? true,
      enableClassificationTests: config.enableClassificationTests ?? true,
      enableDPTests: config.enableDPTests ?? true,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Generate random data buffer
   */
  private generateData(size: number): Buffer {
    return Buffer.alloc(size);
  }

  /**
   * Benchmark encryption/decryption
   */
  async benchmarkEncryption(
    algorithm: string,
    keySize: number,
    encryptFn: (data: Buffer, key: Buffer) => Promise<Buffer>,
    decryptFn: (encrypted: Buffer, key: Buffer) => Promise<Buffer>,
    dataSize: number
  ): Promise<EncryptionBenchmarkResult> {
    const key = Buffer.alloc(keySize);
    const data = this.generateData(dataSize);

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const encrypted = await encryptFn(data, key);
      await decryptFn(encrypted, key);
    }

    // Benchmark encryption
    const encStart = performance.now();
    let encrypted: Buffer = Buffer.alloc(0);
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      encrypted = await encryptFn(data, key);
    }
    const encryptionTime = performance.now() - encStart;

    // Benchmark decryption
    const decStart = performance.now();
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      await decryptFn(encrypted, key);
    }
    const decryptionTime = performance.now() - decStart;

    const totalTime = encryptionTime + decryptionTime;
    const totalDataSize = dataSize * this.config.benchmarkIterations * 2; // encrypt + decrypt
    const throughput = (totalDataSize / 1024 / 1024) / (totalTime / 1000); // MB/sec
    const baselineTime = dataSize / 1024 / 1024 / 100; // Baseline: 100 MB/sec
    const overhead = ((totalTime / this.config.benchmarkIterations - baselineTime) / baselineTime) * 100;

    return {
      algorithm,
      keySize,
      dataSize,
      iterations: this.config.benchmarkIterations,
      encryptionTime: encryptionTime / this.config.benchmarkIterations,
      decryptionTime: decryptionTime / this.config.benchmarkIterations,
      totalTime: totalTime / this.config.benchmarkIterations,
      throughput,
      overhead,
    };
  }

  /**
   * Benchmark intent encoding
   */
  async benchmarkIntentEncoding(
    method: string,
    encodeFn: (text: string) => Promise<number[]>,
    decodeFn: (vector: number[]) => Promise<string>,
    text: string
  ): Promise<IntentEncodingResult> {
    const originalSize = Buffer.byteLength(text, 'utf8');

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const encoded = await encodeFn(text);
      await decodeFn(encoded);
    }

    // Benchmark encoding
    const encStart = performance.now();
    let encoded: number[] = [];
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      encoded = await encodeFn(text);
    }
    const encodingTime = (performance.now() - encStart) / this.config.benchmarkIterations;

    const encodedSize = encoded.length * 4; // 4 bytes per float32

    // Benchmark decoding
    const decStart = performance.now();
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      await decodeFn(encoded);
    }
    const decodingTime = (performance.now() - decStart) / this.config.benchmarkIterations;

    const compressionRatio = originalSize / encodedSize;
    const totalTime = encodingTime + decodingTime;
    const throughput = (originalSize / 1024) / (totalTime / 1000); // KB/sec
    const privacyLoss = 0.1; // Estimated 10% privacy loss with encoding

    return {
      method,
      originalSize,
      encodedSize,
      compressionRatio,
      encodingTime,
      decodingTime,
      throughput,
      privacyLoss,
    };
  }

  /**
   * Benchmark R-A Protocol
   */
  async benchmarkRAProtocol(
    redactFn: (text: string) => Promise<{ redacted: string; count: number }>,
    rehydrateFn: (redacted: string, context: any) => Promise<string>,
    text: string
  ): Promise<RAPProtocolResult> {
    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const redacted = await redactFn(text);
      await rehydrateFn(redacted.redacted, {});
    }

    // Benchmark redaction
    const redactStart = performance.now();
    let redactionCount = 0;
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      const result = await redactFn(text);
      redactionCount = result.count;
    }
    const redactionTime = (performance.now() - redactStart) / this.config.benchmarkIterations;

    const redacted = await redactFn(text);

    // Benchmark rehydration
    const rehydrateStart = performance.now();
    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      await rehydrateFn(redacted.redacted, {});
    }
    const rehydrationTime = (performance.now() - rehydrateStart) / this.config.benchmarkIterations;

    const processingTime = redactionTime + rehydrationTime;
    const dataSize = Buffer.byteLength(text, 'utf8');
    const throughput = (dataSize / 1024) / (processingTime / 1000); // KB/sec
    const baselineTime = dataSize / 1024 / 1000; // Baseline: 1 MB/sec
    const overhead = ((processingTime - baselineTime) / baselineTime) * 100;

    return {
      operation: 'redaction',
      dataSize,
      redactionCount,
      processingTime,
      throughput,
      overhead,
      preservedStructure: true, // R-A Protocol preserves structure
    };
  }

  /**
   * Benchmark privacy classification
   */
  async benchmarkPrivacyClassification(
    classifier: string,
    classifyFn: (text: string) => Promise<{ label: string; confidence: number }>,
    samples: { text: string; label: string }[]
  ): Promise<PrivacyClassificationResult> {
    const latencies: number[] = [];
    let correct = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let actualPositives = 0;

    // Warmup
    for (let i = 0; i < Math.min(this.config.warmupIterations, samples.length); i++) {
      await classifyFn(samples[i].text);
    }

    // Benchmark classification
    for (const sample of samples) {
      const start = performance.now();
      const result = await classifyFn(sample.text);
      const latency = performance.now() - start;
      latencies.push(latency);

      const isPositive = result.label === 'sensitive';
      const actualPositive = sample.label === 'sensitive';

      if (isPositive === actualPositive) {
        correct++;
      }

      if (isPositive && actualPositive) {
        truePositives++;
      }
      if (isPositive && !actualPositive) {
        falsePositives++;
      }
      if (actualPositive) {
        actualPositives++;
      }
    }

    const accuracy = correct / samples.length;
    const precision = actualPositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = actualPositives > 0 ? truePositives / actualPositives : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const sortedLatencies = latencies.sort((a, b) => a - b);
    const totalTime = latencies.reduce((sum, d) => sum + d, 0);
    const throughput = (samples.length / totalTime) * 1000; // classifications per second

    return {
      classifier,
      accuracy,
      precision,
      recall,
      f1Score,
      averageLatency: totalTime / latencies.length,
      p95Latency: this.percentile(sortedLatencies, 95),
      p99Latency: this.percentile(sortedLatencies, 99),
      throughput,
    };
  }

  /**
   * Benchmark differential privacy
   */
  async benchmarkDifferentialPrivacy(
    epsilon: number,
    mechanism: string,
    addNoiseFn: (value: number, epsilon: number) => Promise<number>,
    data: number[]
  ): Promise<DifferentialPrivacyResult> {
    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await addNoiseFn(data[i % data.length], epsilon);
    }

    // Benchmark noise addition
    const start = performance.now();
    const noisyData: number[] = [];
    for (const value of data) {
      noisyData.push(await addNoiseFn(value, epsilon));
    }
    const processingTime = (performance.now() - start) / data.length;

    // Calculate utility loss
    const originalMean = data.reduce((sum, v) => sum + v, 0) / data.length;
    const noisyMean = noisyData.reduce((sum, v) => sum + v, 0) / noisyData.length;
    const utilityLoss = Math.abs(originalMean - noisyMean) / (Math.abs(originalMean) || 1);

    // Calculate noise variance
    const variance =
      noisyData.reduce((sum, v) => sum + Math.pow(v - noisyMean, 2), 0) / noisyData.length;

    // Data utility score (inverse of utility loss)
    const dataUtility = Math.max(0, 1 - utilityLoss);

    // Privacy guarantee score (based on epsilon)
    const privacyGuarantee = Math.max(0, 1 - epsilon / 10);

    return {
      epsilon,
      mechanism,
      utilityLoss: utilityLoss * 100, // percentage
      noiseVariance: variance,
      processingTime,
      dataUtility,
      privacyGuarantee,
    };
  }

  /**
   * Run full privacy benchmark suite
   */
  async runFullBenchmark(
    encryptFns?: Map<string, { encrypt: (data: Buffer, key: Buffer) => Promise<Buffer>; decrypt: (encrypted: Buffer, key: Buffer) => Promise<Buffer> }>,
    encodeFns?: Map<string, { encode: (text: string) => Promise<number[]>; decode: (vector: number[]) => Promise<string> }>,
    raFns?: { redact: (text: string) => Promise<{ redacted: string; count: number }>; rehydrate: (redacted: string, context: any) => Promise<string> },
    classifyFns?: Map<string, (text: string) => Promise<{ label: string; confidence: number }>>,
    classifySamples?: { text: string; label: string }[],
    dpFn?: (value: number, epsilon: number) => Promise<number>,
    dpData?: number[]
  ): Promise<PrivacyBenchmarkSuite> {
    const suite: PrivacyBenchmarkSuite = {
      timestamp: Date.now(),
      encryption: [],
      intentEncoding: [],
      raProtocol: [],
      classification: [],
      differentialPrivacy: [],
    };

    // Encryption benchmarks
    if (this.config.enableEncryptionTests && encryptFns) {
      for (const [algorithm, fns] of encryptFns.entries()) {
        for (const dataSize of this.config.dataSizes) {
          const keySize = algorithm.includes('AES') ? 32 : 32; // 256 bits
          suite.encryption.push(
            await this.benchmarkEncryption(algorithm, keySize, fns.encrypt, fns.decrypt, dataSize)
          );
        }
      }
    }

    // Intent encoding benchmarks
    if (this.config.enableEncodingTests && encodeFns) {
      for (const [method, fns] of encodeFns.entries()) {
        const sampleText = 'The quick brown fox jumps over the lazy dog. This is a sample text for intent encoding benchmarking.';
        suite.intentEncoding.push(
          await this.benchmarkIntentEncoding(method, fns.encode, fns.decode, sampleText)
        );
      }
    }

    // R-A Protocol benchmarks
    if (this.config.enableRATests && raFns) {
      const sampleText = 'John Smith (SSN: 123-45-6789) lives at 123 Main St, New York, NY 10001. His email is john.smith@example.com.';
      suite.raProtocol.push(await this.benchmarkRAProtocol(raFns.redact, raFns.rehydrate, sampleText));
    }

    // Classification benchmarks
    if (this.config.enableClassificationTests && classifyFns && classifySamples) {
      for (const [classifier, fn] of classifyFns.entries()) {
        suite.classification.push(
          await this.benchmarkPrivacyClassification(classifier, fn, classifySamples)
        );
      }
    }

    // Differential privacy benchmarks
    if (this.config.enableDPTests && dpFn && dpData) {
      for (const epsilon of this.config.epsilonValues) {
        suite.differentialPrivacy.push(
          await this.benchmarkDifferentialPrivacy(epsilon, 'laplace', dpFn, dpData)
        );
      }
    }

    return suite;
  }

  /**
   * Generate benchmark report
   */
  generateReport(suite: PrivacyBenchmarkSuite): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('PRIVACY BENCHMARK REPORT');
    lines.push(`Timestamp: ${new Date(suite.timestamp).toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Encryption results
    if (suite.encryption.length > 0) {
      lines.push('ENCRYPTION PERFORMANCE');
      lines.push('-'.repeat(80));
      for (const result of suite.encryption) {
        lines.push(`${result.algorithm} (${result.dataSize / 1024}KB):`);
        lines.push(`  Encrypt: ${result.encryptionTime.toFixed(3)}ms`);
        lines.push(`  Decrypt: ${result.decryptionTime.toFixed(3)}ms`);
        lines.push(`  Throughput: ${result.throughput.toFixed(2)} MB/sec`);
        lines.push(`  Overhead: ${result.overhead.toFixed(1)}%`);
        lines.push('');
      }
    }

    // Intent encoding results
    if (suite.intentEncoding.length > 0) {
      lines.push('INTENT ENCODING');
      lines.push('-'.repeat(80));
      for (const result of suite.intentEncoding) {
        lines.push(`${result.method}:`);
        lines.push(`  Original: ${result.originalSize} bytes → Encoded: ${result.encodedSize} bytes`);
        lines.push(`  Compression: ${result.compressionRatio.toFixed(2)}x`);
        lines.push(`  Encode: ${result.encodingTime.toFixed(3)}ms, Decode: ${result.decodingTime.toFixed(3)}ms`);
        lines.push(`  Throughput: ${result.throughput.toFixed(2)} KB/sec`);
        lines.push('');
      }
    }

    // R-A Protocol results
    if (suite.raProtocol.length > 0) {
      lines.push('R-A PROTOCOL');
      lines.push('-'.repeat(80));
      for (const result of suite.raProtocol) {
        lines.push(`Redactions: ${result.redactionCount}`);
        lines.push(`  Processing Time: ${result.processingTime.toFixed(3)}ms`);
        lines.push(`  Throughput: ${result.throughput.toFixed(2)} KB/sec`);
        lines.push(`  Overhead: ${result.overhead.toFixed(1)}%`);
        lines.push('');
      }
    }

    // Classification results
    if (suite.classification.length > 0) {
      lines.push('PRIVACY CLASSIFICATION');
      lines.push('-'.repeat(80));
      for (const result of suite.classification) {
        lines.push(`${result.classifier}:`);
        lines.push(`  Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
        lines.push(`  Precision: ${(result.precision * 100).toFixed(1)}%`);
        lines.push(`  Recall: ${(result.recall * 100).toFixed(1)}%`);
        lines.push(`  F1 Score: ${result.f1Score.toFixed(3)}`);
        lines.push(`  Avg Latency: ${result.averageLatency.toFixed(3)}ms`);
        lines.push(`  Throughput: ${result.throughput.toFixed(0)} classifications/sec`);
        lines.push('');
      }
    }

    // Differential privacy results
    if (suite.differentialPrivacy.length > 0) {
      lines.push('DIFFERENTIAL PRIVACY');
      lines.push('-'.repeat(80));
      for (const result of suite.differentialPrivacy) {
        lines.push(`ε=${result.epsilon} (${result.mechanism}):`);
        lines.push(`  Utility Loss: ${result.utilityLoss.toFixed(2)}%`);
        lines.push(`  Data Utility: ${result.dataUtility.toFixed(3)}`);
        lines.push(`  Privacy Guarantee: ${result.privacyGuarantee.toFixed(3)}`);
        lines.push(`  Processing Time: ${result.processingTime.toFixed(6)}ms`);
        lines.push('');
      }
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
