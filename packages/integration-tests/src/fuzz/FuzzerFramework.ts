/**
 * FuzzerFramework - Fuzzing Framework for Aequor
 *
 * This framework provides fuzzing capabilities to find bugs through randomized input mutation.
 * Fuzzing is particularly useful for finding edge cases in parsers, serializers, and input validators.
 *
 * Key Features:
 * - Multiple mutation strategies (bit flip, byte insert, byte delete, duplicate, splice)
 * - Corpus management for interesting test cases
 * - Crash detection and reporting
 * - Counterexample minimization
 * - Integration with vitest
 *
 * @packageDocumentation
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Mutation strategy type
 */
export type MutationStrategy =
  | "bit_flip" // Flip random bits
  | "byte_insert" // Insert random bytes
  | "byte_delete" // Delete random bytes
  | "duplicate" // Duplicate random bytes
  | "splice" // Splice byte sequences
  | "arithmetic" // Apply arithmetic to integers
  | "dictionary" // Replace with dictionary values
  | "random"; // Random combination of above

/**
 * Fuzzing configuration
 */
export interface FuzzConfig {
  /** Number of fuzzing iterations (default: 10000) */
  iterations?: number;
  /** Maximum time to run in ms (default: 30000) */
  timeout?: number;
  /** Mutation strategies to use (default: all) */
  mutations?: MutationStrategy[];
  /** Initial seed corpus */
  seed?: Buffer | string | (Buffer | string)[];
  /** Path to corpus directory for persistence */
  corpusPath?: string;
  /** Path to crashes directory */
  crashesPath?: string;
  /** Maximum size of generated inputs */
  maxInputSize?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/**
 * Fuzzing result
 */
export interface FuzzResult {
  /** Number of iterations run */
  iterations: number;
  /** Number of unique crashes found */
  crashes: number;
  /** Number of unique hangs (timeouts) */
  hangs: number;
  /** Coverage achieved (if measurable) */
  coverage?: number;
  /** Time taken in milliseconds */
  duration: number;
  /** List of crash inputs */
  crashInputs: Buffer[];
  /** List of hang inputs */
  hangInputs: Buffer[];
}

/**
 * Crash information
 */
export interface CrashInfo {
  /** Input that caused the crash */
  input: Buffer;
  /** Error that occurred */
  error: Error;
  /** Timestamp when crash was found */
  timestamp: number;
  /** Mutation strategy used */
  strategy: MutationStrategy;
}

/**
 * Corpus entry
 */
export interface CorpusEntry {
  /** Input data */
  input: Buffer;
  /** Whether this input caused a crash */
  isCrash: boolean;
  /** Timestamp when added */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Fuzzing target function
 */
export type FuzzTargetFn = (input: Buffer) => void | Promise<void>;

// ============================================================================
// RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Seeded random number generator (reused from PropertyTestFramework)
 */
class SeededRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 0x80000000;
    return this.state;
  }

  nextFloat(): number {
    return this.next() / 0x80000000;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  nextBytes(length: number): Buffer {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = this.nextInt(0, 255);
    }
    return bytes;
  }

  fork(): SeededRNG {
    return new SeededRNG(this.next());
  }
}

// ============================================================================
// MUTATION STRATEGIES
// ============================================================================

/**
 * Mutate a buffer using a specific strategy
 */
export function mutate(
  input: Buffer,
  strategy: MutationStrategy,
  seed: number
): Buffer {
  const rng = new SeededRNG(seed);

  switch (strategy) {
    case "bit_flip":
      return mutateBitFlip(input, rng);
    case "byte_insert":
      return mutateByteInsert(input, rng);
    case "byte_delete":
      return mutateByteDelete(input, rng);
    case "duplicate":
      return mutateDuplicate(input, rng);
    case "splice":
      return mutateSplice(input, rng);
    case "arithmetic":
      return mutateArithmetic(input, rng);
    case "dictionary":
      return mutateDictionary(input, rng);
    case "random":
      return mutateRandom(input, rng);
    default:
      return input;
  }
}

/**
 * Bit flip mutation - flip random bits in the buffer
 */
function mutateBitFlip(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length === 0) return input;
  const output = Buffer.from(input);
  const numFlips = rng.nextInt(1, Math.min(10, output.length * 8));

  for (let i = 0; i < numFlips; i++) {
    const byteIndex = rng.nextInt(0, output.length - 1);
    const bitIndex = rng.nextInt(0, 7);
    output[byteIndex] ^= 1 << bitIndex;
  }

  return output;
}

/**
 * Byte insert mutation - insert random bytes
 */
function mutateByteInsert(input: Buffer, rng: SeededRNG): Buffer {
  const insertPosition = rng.nextInt(0, input.length);
  const numBytes = rng.nextInt(1, 16);
  const insertData = rng.nextBytes(numBytes);

  return Buffer.concat([
    input.subarray(0, insertPosition),
    insertData,
    input.subarray(insertPosition),
  ]);
}

/**
 * Byte delete mutation - delete random bytes
 */
function mutateByteDelete(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length <= 1) return input;
  const deletePosition = rng.nextInt(0, input.length - 1);
  const deleteLength = rng.nextInt(
    1,
    Math.min(16, input.length - deletePosition)
  );

  return Buffer.concat([
    input.subarray(0, deletePosition),
    input.subarray(deletePosition + deleteLength),
  ]);
}

/**
 * Duplicate mutation - duplicate random bytes
 */
function mutateDuplicate(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length === 0) return input;
  const copyPosition = rng.nextInt(0, input.length - 1);
  const copyLength = rng.nextInt(1, Math.min(16, input.length - copyPosition));
  const insertPosition = rng.nextInt(0, input.length);
  const copyData = input.subarray(copyPosition, copyPosition + copyLength);

  return Buffer.concat([
    input.subarray(0, insertPosition),
    copyData,
    input.subarray(insertPosition),
  ]);
}

/**
 * Splice mutation - move byte sequences around
 */
function mutateSplice(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length < 2) return input;

  const cutPosition = rng.nextInt(0, input.length - 1);
  const cutLength = rng.nextInt(1, Math.min(input.length - cutPosition, 16));
  const pastePosition = rng.nextInt(0, input.length - cutLength);

  const cutData = input.subarray(cutPosition, cutPosition + cutLength);
  const withoutCut = Buffer.concat([
    input.subarray(0, cutPosition),
    input.subarray(cutPosition + cutLength),
  ]);

  return Buffer.concat([
    withoutCut.subarray(0, pastePosition),
    cutData,
    withoutCut.subarray(pastePosition),
  ]);
}

/**
 * Arithmetic mutation - apply arithmetic to integers
 */
function mutateArithmetic(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length < 4) return input;
  const output = Buffer.from(input);

  // Treat as 32-bit little-endian integers
  const position = rng.nextInt(0, Math.floor(output.length / 4) - 1) * 4;
  const value = output.readInt32LE(position);

  // Apply random arithmetic operation
  const operations = [
    (v: number) => v + 1,
    (v: number) => v - 1,
    (v: number) => v + 0x10,
    (v: number) => v - 0x10,
    (v: number) => v ^ 0xff,
    (v: number) => ~v,
    (v: number) => v << 1,
    (v: number) => v >> 1,
  ];

  const operation = rng.nextElement(operations);
  output.writeInt32LE(operation(value) | 0, position);

  return output;
}

/**
 * Dictionary mutation - replace with dictionary values
 */
const DICTIONARY: Buffer[] = [
  Buffer.from(""),
  Buffer.from("0"),
  Buffer.from("1"),
  Buffer.from("true"),
  Buffer.from("false"),
  Buffer.from("null"),
  Buffer.from("{}"),
  Buffer.from("[]"),
  Buffer.from('""'),
  Buffer.from("\x00"),
  Buffer.from("\xff"),
  Buffer.from("\x00".repeat(256)),
  Buffer.from("\xff".repeat(256)),
  Buffer.from("-1"),
  Buffer.from("2147483647"),
  Buffer.from("-2147483648"),
  Buffer.from("3.14159"),
  Buffer.from("SELECT * FROM"),
  Buffer.from("<script>"),
  Buffer.from("../../etc/passwd"),
];

function mutateDictionary(input: Buffer, rng: SeededRNG): Buffer {
  if (input.length === 0) {
    return rng.nextElement(DICTIONARY);
  }

  const replacePosition = rng.nextInt(0, input.length - 1);
  const dictValue = rng.nextElement(DICTIONARY);

  return Buffer.concat([
    input.subarray(0, replacePosition),
    dictValue,
    input.subarray(replacePosition + 1),
  ]);
}

/**
 * Random mutation - apply random strategy
 */
function mutateRandom(input: Buffer, rng: SeededRNG): Buffer {
  const strategies: MutationStrategy[] = [
    "bit_flip",
    "byte_insert",
    "byte_delete",
    "duplicate",
    "splice",
    "arithmetic",
    "dictionary",
  ];
  const strategy = rng.nextElement(strategies);
  return mutate(input, strategy, rng.next());
}

// ============================================================================
// CORPUS MANAGEMENT
// ============================================================================

/**
 * Load corpus from directory
 */
export function loadCorpus(path: string): Buffer[] {
  if (!existsSync(path)) {
    return [];
  }

  const files = readdirSync(path);
  const corpus: Buffer[] = [];

  for (const file of files) {
    try {
      const filePath = join(path, file);
      const data = readFileSync(filePath);
      corpus.push(data);
    } catch {
      // Skip files that can't be read
    }
  }

  return corpus;
}

/**
 * Save corpus to directory
 */
export function saveCorpus(corpus: Buffer[], path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }

  for (let i = 0; i < corpus.length; i++) {
    const filePath = join(path, `crash_${i}.bin`);
    writeFileSync(filePath, corpus[i]);
  }
}

/**
 * Generate initial corpus from seed inputs
 */
export function generateCorpus(...seeds: (Buffer | string)[]): Buffer[] {
  return seeds.map(seed => {
    if (typeof seed === "string") {
      return Buffer.from(seed);
    }
    return seed;
  });
}

/**
 * Save crash to file
 */
export function saveCrash(
  input: Buffer,
  path: string,
  metadata?: Record<string, unknown>
): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }

  const timestamp = Date.now();
  const filename = `crash_${timestamp}_${input.slice(0, 8).toString("hex")}.bin`;
  const filePath = join(path, filename);

  writeFileSync(filePath, input);

  // Also save metadata
  if (metadata) {
    const metaPath = join(path, `${filename}.meta.json`);
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  }
}

// ============================================================================
// CRASH DETECTION
// ============================================================================

/**
 * Detect if an error represents a crash
 */
export function detectCrash(error: Error): boolean {
  // Most errors are crashes, but some are expected
  const expectedPatterns = ["Assertion failed", "Expected", "Property failed"];

  const message = error.message;
  for (const pattern of expectedPatterns) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  // Any error is generally a crash in fuzzing
  return true;
}

/**
 * Detect if a timeout occurred
 */
export function detectTimeout(duration: number, timeout: number): boolean {
  return duration >= timeout;
}

// ============================================================================
// COUNTEREXAMPLE MINIMIZATION
// ============================================================================

/**
 * Minimize a crashing input to find the smallest failing case
 */
export async function minimizeCrash(
  input: Buffer,
  testFn: FuzzTargetFn,
  options: { maxIterations?: number; timeout?: number } = {}
): Promise<Buffer> {
  const maxIterations = options.maxIterations ?? 1000;
  const timeout = options.timeout ?? 1000;
  let current = input;

  // Binary search for minimal prefix
  let left = 0;
  let right = current.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const testInput = current.subarray(0, mid);

    try {
      await withTimeout(() => testFn(testInput), timeout);
      // Test passed, so we need more bytes
      left = mid + 1;
    } catch {
      // Test failed, so we can try fewer bytes
      right = mid;
      current = testInput;
    }
  }

  // Try removing individual bytes
  for (let i = 0; i < current.length && i < maxIterations; i++) {
    const testInput = Buffer.concat([
      current.subarray(0, i),
      current.subarray(i + 1),
    ]);

    try {
      await withTimeout(() => testFn(testInput), timeout);
    } catch {
      // Removal still causes crash, so keep it
      current = testInput;
      i--; // Re-test this position
    }
  }

  return current;
}

/**
 * Run a function with a timeout
 */
async function withTimeout<T>(
  fn: () => T | Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    ),
  ]);
}

// ============================================================================
// FUZZING ENGINE
// ============================================================================

/**
 * Run a fuzzing session
 */
export async function fuzz(
  name: string,
  targetFn: FuzzTargetFn,
  config: FuzzConfig = {}
): Promise<FuzzResult> {
  const startTime = Date.now();
  const iterations = config.iterations ?? 10000;
  const timeout = config.timeout ?? 30000;
  const maxInputSize = config.maxInputSize ?? 4096;
  const seed = config.seed ?? Date.now();
  const verbose = config.verbose ?? false;

  const mutations = config.mutations ?? [
    "bit_flip",
    "byte_insert",
    "byte_delete",
    "duplicate",
    "splice",
    "arithmetic",
    "dictionary",
  ];

  // Load or generate corpus
  let corpus: Buffer[] = [];
  if (config.corpusPath && existsSync(config.corpusPath)) {
    corpus = loadCorpus(config.corpusPath);
  }
  if (config.seed) {
    corpus.push(...generateCorpus(config.seed));
  }

  // If no corpus, generate some initial inputs
  if (corpus.length === 0) {
    const rng = new SeededRNG(seed);
    for (let i = 0; i < 10; i++) {
      corpus.push(rng.nextBytes(rng.nextInt(0, 256)));
    }
  }

  const crashes: Buffer[] = [];
  const hangs: Buffer[] = [];
  const rng = new SeededRNG(seed);

  // Limit input size
  corpus = corpus.map(input => {
    if (input.length > maxInputSize) {
      return input.subarray(0, maxInputSize);
    }
    return input;
  });

  for (let i = 0; i < iterations; i++) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      if (verbose) {
        console.log(`Fuzzer "${name}" reached timeout after ${i} iterations`);
      }
      break;
    }

    // Select input from corpus
    const baseInput = rng.nextElement(corpus);

    // Apply mutation
    const strategy = rng.nextElement(mutations);
    const mutatedInput = mutate(baseInput, strategy, rng.next());

    // Ensure size limit
    const testInput =
      mutatedInput.length > maxInputSize
        ? mutatedInput.subarray(0, maxInputSize)
        : mutatedInput;

    // Run test
    const testStart = Date.now();
    try {
      await withTimeout(() => targetFn(testInput), 100);
    } catch (error) {
      const testDuration = Date.now() - testStart;

      if (detectTimeout(testDuration, 100)) {
        hangs.push(testInput);
        if (config.crashesPath) {
          saveCrash(testInput, config.crashesPath, { type: "hang", strategy });
        }
        if (verbose) {
          console.log(`Hang found at iteration ${i}`);
        }
      } else if (detectCrash(error as Error)) {
        crashes.push(testInput);
        if (config.crashesPath) {
          saveCrash(testInput, config.crashesPath, {
            type: "crash",
            strategy,
            error: (error as Error).message,
          });
        }
        if (verbose) {
          console.log(
            `Crash found at iteration ${i}: ${(error as Error).message}`
          );
        }
      }

      // Add to corpus if interesting
      if (!corpus.some(c => c.equals(testInput))) {
        corpus.push(testInput);
      }
    }
  }

  const duration = Date.now() - startTime;

  // Save corpus
  if (config.corpusPath) {
    saveCorpus(corpus, config.corpusPath);
  }

  return {
    iterations,
    crashes: crashes.length,
    hangs: hangs.length,
    duration,
    crashInputs: crashes,
    hangInputs: hangs,
  };
}

// ============================================================================
// INTEGRATION WITH VITEST
// ============================================================================

/**
 * Register a fuzz test with vitest
 */
export function registerFuzz(
  name: string,
  targetFn: FuzzTargetFn,
  config: FuzzConfig = {}
): void {
  const { test } = require("vitest");

  test(`Fuzz: ${name}`, async () => {
    const result = await fuzz(name, targetFn, config);

    // Fail test if crashes or hangs were found
    if (result.crashes > 0 || result.hangs > 0) {
      const message = [
        `Fuzzing found ${result.crashes} crashes and ${result.hangs} hangs`,
        `in ${result.iterations} iterations (${result.duration}ms).`,
      ].join(" ");

      if (config.crashesPath) {
        throw new Error(`${message} Crashes saved to ${config.crashesPath}`);
      } else {
        throw new Error(message);
      }
    }

    if (config.verbose) {
      console.log(
        `Fuzzing "${name}" completed: ${result.iterations} iterations, ` +
          `${result.crashes} crashes, ${result.hangs} hangs (${result.duration}ms)`
      );
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a buffer from a string
 */
export function bufferFromString(str: string): Buffer {
  return Buffer.from(str, "utf-8");
}

/**
 * Create random buffer
 */
export function randomBuffer(
  minLength: number = 0,
  maxLength: number = 1024,
  seed?: number
): Buffer {
  const rng = new SeededRNG(seed ?? Date.now());
  const length = rng.nextInt(minLength, maxLength);
  return rng.nextBytes(length);
}

/**
 * Create buffer from hex string
 */
export function bufferFromHex(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s/g, ""), "hex");
}

/**
 * Convert buffer to hex string
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/**
 * Pretty print buffer (show both ASCII and hex)
 */
export function prettyPrintBuffer(
  buffer: Buffer,
  maxLength: number = 64
): string {
  const displayBuffer =
    buffer.length > maxLength ? buffer.subarray(0, maxLength) : buffer;
  const hex = displayBuffer.toString("hex").match(/.{2}/g)?.join(" ") ?? "";
  const ascii = displayBuffer
    .toString("ascii", 0, displayBuffer.length)
    .replace(/[^\x20-\x7E]/g, ".");

  let result = `Length: ${buffer.length}\n`;
  result += `Hex: ${hex}${buffer.length > maxLength ? "..." : ""}\n`;
  result += `ASCII: ${ascii}${buffer.length > maxLength ? "..." : ""}`;

  return result;
}
