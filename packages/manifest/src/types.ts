/**
 * Component Manifest Types
 * @version 1.0.0
 *
 * TypeScript type definitions for the Component Manifest Schema.
 * Provides type-safe manifest validation and processing.
 */

/**
 * Supported component types
 */
export type ComponentType =
  | 'core'
  | 'routing'
  | 'privacy'
  | 'cache'
  | 'embeddings'
  | 'adapters'
  | 'monitoring'
  | 'testing'
  | 'cli'
  | 'native';

/**
 * Supported programming languages
 */
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'c'
  | 'cpp'
  | 'java'
  | 'csharp';

/**
 * Runtime environments
 */
export type Runtime =
  | 'nodejs'
  | 'deno'
  | 'bun'
  | 'cpython'
  | 'pypy'
  | 'native'
  | 'wasm'
  | 'jvm'
  | 'dotnet';

/**
 * Native module information
 */
export interface NativeInfo {
  /** Native implementation language */
  language: Language;
  /** Language bindings available */
  bindings: string[];
  /** WASM support available */
  wasm?: boolean;
  /** SIMD optimizations available */
  simd?: boolean;
}

/**
 * Component metadata
 */
export interface ComponentMetadata {
  /** Component name (kebab-case) */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author or organization */
  author?: string;
  /** SPDX license identifier */
  license?: string;
  /** Project homepage URL */
  homepage?: string;
  /** Git repository URL */
  repository?: string;
  /** Category tags */
  tags?: string[];
  /** Search keywords */
  keywords?: string[];
}

/**
 * Property schema for configuration
 */
export interface PropertySchema {
  /** Property type */
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** Default value */
  default?: any;
  /** Human-readable description */
  description?: string;
  /** Allowed values */
  enum?: (string | number)[];
  /** Regex pattern (for strings) */
  pattern?: string;
  /** Minimum value (for numbers) */
  minimum?: number;
  /** Maximum value (for numbers) */
  maximum?: number;
  /** Exclusive minimum */
  exclusiveMinimum?: number;
  /** Exclusive maximum */
  exclusiveMaximum?: number;
  /** Minimum length (for strings/arrays) */
  minLength?: number;
  /** Maximum length (for strings/arrays) */
  maxLength?: number;
  /** Minimum items (for arrays) */
  minItems?: number;
  /** Maximum items (for arrays) */
  maxItems?: number;
  /** Require unique items (for arrays) */
  uniqueItems?: boolean;
  /** Format validation */
  format?: 'uri' | 'email' | 'uuid' | 'date-time' | 'hostname';
  /** Array item schema */
  items?: PropertySchema;
  /** Object properties */
  properties?: Record<string, PropertySchema>;
  /** Required nested properties */
  required?: string[];
}

/**
 * Configuration schema
 */
export interface ConfigurationSchema {
  /** Configuration properties */
  properties: Record<string, PropertySchema>;
  /** Required property names */
  required?: string[];
  /** Allow additional properties */
  additionalProperties?: boolean;
}

/**
 * Hardware specification (guidance only)
 */
export interface HardwareSpec {
  /** Minimum memory in MB */
  min_memory_mb?: number;
  /** Recommended memory in MB */
  recommended_memory_mb?: number;
  /** Minimum CPU cores */
  min_cpu_cores?: number;
  /** Recommended CPU cores */
  recommended_cpu_cores?: number;
  /** GPU required */
  gpu_required?: boolean;
  /** GPU can be used */
  gpu_optional?: boolean;
  /** GPU memory in MB */
  gpu_memory_mb?: number;
  /** Storage requirements in MB */
  storage_mb?: number;
  /** Network access required */
  network?: boolean;
}

/**
 * Performance characteristics
 */
export interface PerformanceSpec {
  /** Queries per second (synthetic benchmark) */
  benchmark_qps?: number;
  /** Median latency in milliseconds */
  latency_p50_ms?: number;
  /** 95th percentile latency */
  latency_p95_ms?: number;
  /** 99th percentile latency */
  latency_p99_ms?: number;
  /** Data throughput in MB/s */
  throughput_mb_per_sec?: number;
  /** Max concurrent connections */
  concurrent_connections?: number;
  /** Cold start time in milliseconds */
  cold_start_ms?: number;
}

/**
 * Interface specification
 */
export interface InterfaceSpec {
  /** Main entry point */
  main: string;
  /** Exported symbols */
  exports: string[];
  /** Imported symbols (optional) */
  imports?: string[];
  /** Protocol interface implemented */
  protocol?: string;
}

/**
 * Test specification
 */
export interface TestSpec {
  /** Test framework */
  framework: string;
  /** Test command */
  command: string;
  /** Minimum coverage percentage (0-100) */
  coverage_threshold?: number;
  /** Unit test pattern */
  unit_tests?: string;
  /** Integration test pattern */
  integration_tests?: string;
  /** E2E test pattern */
  e2e_tests?: string;
}

/**
 * Dependencies
 */
export interface Dependencies {
  /** Protocol version constraint */
  protocol?: string;
  /** Component dependencies */
  components?: Record<string, string>;
  /** NPM dependencies */
  npm?: Record<string, string>;
  /** Python dependencies */
  python?: Record<string, string>;
  /** System dependencies */
  system?: string[];
}

/**
 * Complete component manifest
 */
export interface ComponentManifest {
  /** API version */
  apiVersion: string;
  /** Resource kind */
  kind: string;
  /** Metadata */
  metadata: ComponentMetadata;
  /** Component type */
  type: ComponentType;
  /** Implementation language */
  language: Language;
  /** Runtime environment */
  runtime?: Runtime;
  /** Native module info (if applicable) */
  native?: NativeInfo;
  /** Dependencies */
  dependencies?: Dependencies;
  /** Configuration schema */
  configuration: ConfigurationSchema;
  /** Hardware requirements */
  hardware?: HardwareSpec;
  /** Performance characteristics */
  performance?: PerformanceSpec;
  /** Interface specification */
  interface: InterfaceSpec;
  /** Testing specification */
  tests: TestSpec;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Field path (dot notation) */
  path: string;
  /** Error message */
  message: string;
  /** Suggestion (optional) */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors (if any) */
  errors: ValidationError[];
  /** Validated manifest (if valid) */
  manifest?: ComponentManifest;
}

/**
 * Manifest merge options
 */
export interface MergeOptions {
  /** Override existing values */
  override?: boolean;
  /** Merge arrays instead of replacing */
  mergeArrays?: boolean;
  /** Merge nested objects */
  mergeObjects?: boolean;
}

/**
 * Supported test frameworks
 */
export const TEST_FRAMEWORKS = [
  'vitest',
  'jest',
  'mocha',
  'pytest',
  'unittest',
  'go test',
] as const;

/**
 * SPDX license identifiers (common ones)
 */
export const COMMON_LICENSES = [
  'Apache-2.0',
  'MIT',
  'GPL-3.0',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'LGPL-3.0',
  'AGPL-3.0',
] as const;

/**
 * Regex patterns for validation
 */
export const PATTERNS = {
  /** Component name (kebab-case) */
  NAME: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,

  /** Semantic version */
  SEMVER: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,

  /** Email address */
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  /** UUID */
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  /** URI */
  URI: /^[a-zA-Z][a-zA-Z0-9+.-]*:/,

  /** Memory size (e.g., 100MB, 1GB) */
  MEMORY_SIZE: /^[0-9]+(KB|MB|GB|TB)$/i,
} as const;

/**
 * Language to compatible runtimes mapping
 */
export const LANGUAGE_RUNTIMES: Record<Language, Runtime[]> = {
  typescript: ['nodejs', 'deno', 'bun'],
  javascript: ['nodejs', 'deno', 'bun'],
  python: ['cpython', 'pypy'],
  rust: ['native', 'wasm'],
  go: ['native'],
  c: ['native'],
  cpp: ['native'],
  java: ['jvm'],
  csharp: ['dotnet'],
};

/**
 * Component types that require native module info
 */
export const NATIVE_TYPES: Language[] = ['rust', 'go', 'c', 'cpp'];

/**
 * Default values for optional fields
 */
export const DEFAULTS = {
  apiVersion: 'v1',
  kind: 'Component',
  runtime: {
    typescript: 'nodejs' as Runtime,
    javascript: 'nodejs' as Runtime,
    python: 'cpython' as Runtime,
    rust: 'native' as Runtime,
    go: 'native' as Runtime,
  },
  configuration: {
    additionalProperties: false,
  },
  tests: {
    framework: 'vitest',
    command: 'npm test',
    coverage_threshold: 80,
  },
} as const;
