/**
 * PropertyTestFramework - Property-Based Testing Framework for Aequor
 *
 * This framework provides property-based testing capabilities inspired by QuickCheck and fast-check.
 * It enables testing invariant properties across randomly generated inputs, helping find edge cases
 * and bugs that traditional example-based testing might miss.
 *
 * Key Features:
 * - Random value generators with configurable distributions
 * - Property testing with configurable iterations
 * - Shrinking for minimizing counterexamples
 * - Integration with vitest
 * - Comprehensive statistics reporting
 *
 * @packageDocumentation
 */

import { describe, it } from "vitest";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Random seed for reproducible tests
 */
export type RandomSeed = number;

/**
 * Generator function type
 *
 * A generator produces a random value from a seed.
 */
export interface Generator<T> {
  /** Generate a value from a random seed */
  generate(seed: RandomSeed): T;
  /** Shrink a value to a simpler counterexample (optional) */
  shrink?(value: T): Generator<T>[];
}

/**
 * Property test configuration
 */
export interface PropertyConfig {
  /** Number of test cases to run (default: 100) */
  numCases?: number;
  /** Random seed for reproducibility (default: random) */
  seed?: RandomSeed;
  /** Maximum number of shrinking steps (default: 100) */
  maxShrinks?: number;
  /** Whether to run in verbose mode */
  verbose?: boolean;
  /** Custom name for the property */
  name?: string;
}

/**
 * Property test result
 */
export interface PropertyResult {
  /** Whether all cases passed */
  passed: boolean;
  /** Number of cases run */
  casesRun: number;
  /** Number of cases that passed */
  casesPassed: number;
  /** Counterexample if found */
  counterexample?: unknown;
  /** Error if one occurred */
  error?: Error;
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Property function type
 */
export type PropertyFn = (
  input: Record<string, unknown>
) => boolean | Promise<boolean>;

/**
 * Generator configuration
 */
export type GeneratorConfig<T> = Record<string, Generator<T>>;

// ============================================================================
// RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Seeded random number generator
 *
 * Uses a simple Linear Congruential Generator (LCG) for reproducible randomness.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  /**
   * Get next random integer in [0, 2^31)
   */
  next(): number {
    // LCG parameters from Numerical Recipes
    this.state = (this.state * 1664525 + 1013904223) % 0x80000000;
    return this.state;
  }

  /**
   * Get next random float in [0, 1)
   */
  nextFloat(): number {
    return this.next() / 0x80000000;
  }

  /**
   * Get next random integer in [min, max]
   */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /**
   * Get next random float in [min, max]
   */
  nextFloatRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Get random element from array
   */
  nextElement<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Create a new independent RNG
   */
  fork(): SeededRNG {
    return new SeededRNG(this.next());
  }
}

// ============================================================================
// PRIMITIVE GENERATORS
// ============================================================================

/**
 * Integer generator
 */
export function integer(
  min: number = -1000,
  max: number = 1000
): Generator<number> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.nextInt(min, max);
    },
    shrink: (value: number) => {
      const shrinks: Generator<number>[] = [];
      // Shrink towards zero
      if (value !== 0) {
        shrinks.push(integer(0, 0));
        shrinks.push(integer(Math.min(0, value), Math.max(0, value)));
        shrinks.push(integer(Math.min(0, value / 2), Math.max(0, value / 2)));
      }
      return shrinks;
    },
  };
}

/**
 * Float generator
 */
export function float(
  min: number = -1000,
  max: number = 1000
): Generator<number> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.nextFloatRange(min, max);
    },
    shrink: (value: number) => {
      const shrinks: Generator<number>[] = [];
      // Shrink towards zero
      if (Math.abs(value) > 0.001) {
        shrinks.push(float(0, 0));
        shrinks.push(float(-Math.abs(value) / 2, Math.abs(value) / 2));
      }
      return shrinks;
    },
  };
}

/**
 * Boolean generator
 */
export function boolean(): Generator<boolean> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.next() % 2 === 0;
    },
  };
}

/**
 * String generator
 */
export function string(
  minLength: number = 0,
  maxLength: number = 100
): Generator<string> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.!?-";
      const length = rng.nextInt(minLength, maxLength);
      let result = "";
      for (let i = 0; i < length; i++) {
        result += rng.nextElement(chars.split(""));
      }
      return result;
    },
    shrink: (value: string) => {
      const shrinks: Generator<string>[] = [];
      if (value.length > 0) {
        // Empty string
        shrinks.push(string(0, 0));
        // Half length
        shrinks.push(string(0, Math.floor(value.length / 2)));
        // Remove last character
        shrinks.push(string(0, value.length - 1));
      }
      return shrinks;
    },
  };
}

/**
 * Character generator
 */
export function char(charSet?: string): Generator<string> {
  const defaultChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const chars = charSet ?? defaultChars;
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.nextElement(chars.split(""));
    },
  };
}

/**
 * Constant generator (always returns the same value)
 */
export function constant<T>(value: T): Generator<T> {
  return {
    generate: () => value,
  };
}

/**
 * One-of generator (randomly selects from given values)
 */
export function oneOf<T>(...values: T[]): Generator<T> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.nextElement(values);
    },
  };
}

/**
 * Array generator
 */
export function array<T>(
  itemGen: Generator<T>,
  minLength: number = 0,
  maxLength: number = 10
): Generator<T[]> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const length = rng.nextInt(minLength, maxLength);
      const result: T[] = [];
      for (let i = 0; i < length; i++) {
        result.push(itemGen.generate(rng.next()));
      }
      return result;
    },
    shrink: (value: T[]) => {
      const shrinks: Generator<T[]>[] = [];
      if (value.length > 0) {
        // Empty array
        shrinks.push(array(itemGen, 0, 0));
        // Half length
        shrinks.push(array(itemGen, 0, Math.floor(value.length / 2)));
        // Remove first element
        shrinks.push(array(itemGen, 0, value.length - 1));
      }
      return shrinks;
    },
  };
}

/**
 * Set generator (array with unique elements)
 */
export function set<T>(
  itemGen: Generator<T>,
  minLength: number = 0,
  maxLength: number = 10
): Generator<T[]> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const maxLengthAdjusted = Math.min(maxLength, 100); // Prevent infinite loops
      const targetLength = rng.nextInt(minLength, maxLengthAdjusted);
      const result = new Set<T>();
      let attempts = 0;
      const maxAttempts = targetLength * 10;

      while (result.size < targetLength && attempts < maxAttempts) {
        result.add(itemGen.generate(rng.next()));
        attempts++;
      }
      return Array.from(result);
    },
  };
}

/**
 * Subset generator (random subset of a set)
 */
export function subsetOf<T>(sourceSet: T[]): Generator<T[]> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const size = rng.nextInt(0, sourceSet.length);
      const shuffled = [...sourceSet].sort(() => rng.nextFloat() - 0.5);
      return shuffled.slice(0, size);
    },
  };
}

/**
 * Record/Dictionary generator
 */
export function record<T>(
  schema: Record<string, Generator<T>>
): Generator<Record<string, T>> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const result: Record<string, T> = {};
      for (const [key, gen] of Object.entries(schema)) {
        result[key] = gen.generate(rng.next());
      }
      return result;
    },
  };
}

/**
 * Optional/Nullable generator
 */
export function nullable<T>(
  itemGen: Generator<T>,
  nullProbability: number = 0.1
): Generator<T | null> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      if (rng.nextFloat() < nullProbability) {
        return null;
      }
      return itemGen.generate(rng.next());
    },
  };
}

/**
 * Tuple generator
 */
export function tuple<T extends unknown[]>(
  ...generators: { [K in keyof T]: Generator<T[K]> }
): Generator<T> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return generators.map(gen => gen.generate(rng.next())) as T;
    },
  };
}

/**
 * Weighted generator (combines multiple generators with probabilities)
 */
export function weighted<T>(
  ...weights: { weight: number; generator: Generator<T> }[]
): Generator<T> {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      let threshold = rng.nextFloat() * totalWeight;
      for (const { weight, generator } of weights) {
        threshold -= weight;
        if (threshold <= 0) {
          return generator.generate(rng.next());
        }
      }
      return weights[weights.length - 1].generator.generate(rng.next());
    },
  };
}

/**
 * Frequency generator (named version of weighted)
 */
export function frequency<T>(
  ...freqs: { freq: number; generator: Generator<T> }[]
): Generator<T> {
  return weighted(
    ...freqs.map(f => ({ weight: f.freq, generator: f.generator }))
  );
}

// ============================================================================
// PROPERTY TESTING FUNCTIONS
// ============================================================================

/**
 * Run a property test with generated inputs
 *
 * @param name - Property name/description
 * @param forall - Generator configuration
 * @param propertyFn - Property function to test
 * @param config - Test configuration
 */
export async function property(
  name: string,
  forall: GeneratorConfig<unknown>,
  propertyFn: PropertyFn,
  config: PropertyConfig = {}
): Promise<PropertyResult> {
  const startTime = Date.now();
  const numCases = config.numCases ?? 100;
  const seed = config.seed ?? Date.now();
  const maxShrinks = config.maxShrinks ?? 100;

  let casesPassed = 0;
  let counterexample: Record<string, unknown> | undefined;
  let error: Error | undefined;

  for (let i = 0; i < numCases; i++) {
    const caseSeed = seed + i;
    const input: Record<string, unknown> = {};

    // Generate input for each configured generator
    for (const [key, generator] of Object.entries(forall)) {
      input[key] = generator.generate(caseSeed);
    }

    try {
      const result = await propertyFn(input);
      if (!result) {
        counterexample = input;
        break;
      }
      casesPassed++;
    } catch (e) {
      counterexample = input;
      error = e as Error;
      break;
    }
  }

  const duration = Date.now() - startTime;
  const passed = !counterexample && !error;

  return {
    passed,
    casesRun: counterexample || error ? casesPassed + 1 : numCases,
    casesPassed,
    counterexample,
    error,
    duration,
  };
}

/**
 * Property test builder for fluent API
 */
export class PropertyBuilder {
  private config: PropertyConfig = {};
  private generators: GeneratorConfig<unknown> = {};
  private name = "";

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Set the number of test cases
   */
  withCases(numCases: number): this {
    this.config.numCases = numCases;
    return this;
  }

  /**
   * Set the random seed
   */
  withSeed(seed: number): this {
    this.config.seed = seed;
    return this;
  }

  /**
   * Enable verbose mode
   */
  withVerbose(): this {
    this.config.verbose = true;
    return this;
  }

  /**
   * Configure generators
   */
  forall<T>(generators: GeneratorConfig<T>): this {
    this.generators = generators;
    return this;
  }

  /**
   * Run the property test
   */
  async test(propertyFn: PropertyFn): Promise<PropertyResult> {
    return property(this.name, this.generators, propertyFn, this.config);
  }
}

/**
 * Create a new property builder
 */
export function defineProperty(name: string): PropertyBuilder {
  return new PropertyBuilder(name);
}

/**
 * Helper function to define a property directly
 */
export function forall<T>(generators: GeneratorConfig<T>): PropertyBuilder {
  const builder = new PropertyBuilder("");
  (builder as any).generators = generators;
  return builder;
}

// ============================================================================
// INTEGRATION WITH VITEST
// ============================================================================

/**
 * Register a property test with vitest
 *
 * Usage:
 * ```typescript
 * describe('MyComponent', () => {
 *   registerProperty('round-trip serialization', {
 *     input: generate.atp_packet()
 *   }, async ({ input }) => {
 *     const serialized = serialize(input);
 *     const deserialized = deserialize(serialized);
 *     return deepEqual(input, deserialized);
 *   });
 * });
 * ```
 */
export function registerProperty(
  name: string,
  generators: GeneratorConfig<unknown>,
  propertyFn: PropertyFn,
  config: PropertyConfig = {}
): void {
  it(`Property: ${name}`, async () => {
    const result = await property(name, generators, propertyFn, config);

    if (!result.passed) {
      const message = result.error
        ? `Property failed with error: ${result.error.message}`
        : `Property failed for input: ${JSON.stringify(result.counterexample)}`;
      throw new Error(message);
    }

    if (config.verbose) {
      console.log(
        `Property "${name}" passed: ${result.casesPassed}/${result.casesRun} cases in ${result.duration}ms`
      );
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an arbitrary generator (alias for compatibility)
 */
export const arbitrary = {
  integer,
  float,
  boolean,
  string,
  char,
  constant,
  oneOf,
  array,
  set,
  subsetOf,
  record,
  nullable,
  tuple,
  weighted,
  frequency,
};

/**
 * Create generators (alias for compatibility)
 */
export const generate = arbitrary;

/**
 * Run all registered properties (for manual test running)
 */
export async function runProperties(): Promise<void> {
  // Properties are registered via vitest, so this is a no-op
  // unless we want to add custom test discovery
}

// ============================================================================
// COMMON GENERATOR HELPERS
// ============================================================================

/**
 * Generate a random UUID
 */
export function uuid(): Generator<string> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (rng.next() % 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  };
}

/**
 * Generate a random date
 */
export function date(
  min: Date = new Date(2000, 0, 1),
  max: Date = new Date(2030, 11, 31)
): Generator<Date> {
  const minTime = min.getTime();
  const maxTime = max.getTime();
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      return new Date(rng.nextInt(minTime, maxTime));
    },
  };
}

/**
 * Generate a random URL
 */
export function url(): Generator<string> {
  const protocols = ["http://", "https://"];
  const domains = ["example.com", "test.org", "demo.net", "sample.io"];
  const paths = ["", "/api", "/v1/resource", "/path/to/resource"];

  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const protocol = rng.nextElement(protocols);
      const domain = rng.nextElement(domains);
      const path = rng.nextElement(paths);
      return `${protocol}${domain}${path}`;
    },
  };
}

/**
 * Generate a random email
 */
export function email(): Generator<string> {
  const usernames = ["user", "test", "admin", "demo", "sample"];
  const domains = ["example.com", "test.org", "demo.net"];

  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const username = rng.nextElement(usernames) + rng.nextInt(1, 999);
      const domain = rng.nextElement(domains);
      return `${username}@${domain}`;
    },
  };
}

/**
 * Generate a random integer array (useful for embeddings)
 */
export function embedding(dimensions: number = 768): Generator<Float32Array> {
  return {
    generate: (seed: number) => {
      const rng = new SeededRNG(seed);
      const embedding = new Float32Array(dimensions);
      for (let i = 0; i < dimensions; i++) {
        embedding[i] = rng.nextFloatRange(-1, 1);
      }
      return embedding;
    },
  };
}

/**
 * Generate a random JSON object
 */
export function jsonObject(maxDepth: number = 3): Generator<unknown> {
  const valueGen = (depth: number): Generator<unknown> => {
    if (depth >= maxDepth) {
      return weighted(
        { weight: 3, generator: integer(-100, 100) },
        { weight: 3, generator: float(-100, 100) },
        { weight: 3, generator: string(0, 20) },
        { weight: 1, generator: constant(null) },
        { weight: 1, generator: boolean() }
      );
    }

    return weighted(
      { weight: 2, generator: integer(-100, 100) },
      { weight: 2, generator: float(-100, 100) },
      { weight: 2, generator: string(0, 20) },
      { weight: 1, generator: boolean() },
      { weight: 1, generator: array(valueGen(depth + 1), 0, 5) },
      {
        weight: 1,
        generator: nullable(
          record({ [string(1, 5).generate(Date.now())]: valueGen(depth + 1) })
        ),
      }
    );
  };

  return valueGen(0);
}
