/**
 * Component Manifest Validator
 * @version 1.0.0
 *
 * Validates component manifests against the schema.
 * Provides detailed error messages and suggestions.
 */

import type {
  ComponentManifest,
  ComponentMetadata,
  ComponentType,
  ConfigurationSchema,
  Dependencies,
  HardwareSpec,
  InterfaceSpec,
  Language,
  NativeInfo,
  PerformanceSpec,
  PropertySchema,
  Runtime,
  TestSpec,
  ValidationResult,
  ValidationError,
} from './types';

import {
  PATTERNS,
  TEST_FRAMEWORKS,
  LANGUAGE_RUNTIMES,
  NATIVE_TYPES,
  DEFAULTS,
} from './types';

/**
 * Validate a component manifest
 */
export function validateManifest(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if data is an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_TYPE',
          path: '',
          message: 'Manifest must be an object',
          suggestion: 'Ensure manifest is a valid YAML/JSON object',
        },
      ],
    };
  }

  const manifest = data as Record<string, any>;

  // Validate apiVersion
  if (!manifest.apiVersion) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'apiVersion',
      message: 'apiVersion is required',
      suggestion: 'Add: apiVersion: "v1"',
    });
  } else if (manifest.apiVersion !== 'v1') {
    errors.push({
      code: 'INVALID_API_VERSION',
      path: 'apiVersion',
      message: `Unsupported apiVersion: ${manifest.apiVersion}`,
      suggestion: 'Use: apiVersion: "v1"',
    });
  }

  // Validate kind
  if (!manifest.kind) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'kind',
      message: 'kind is required',
      suggestion: 'Add: kind: "Component"',
    });
  } else if (manifest.kind !== 'Component') {
    errors.push({
      code: 'INVALID_KIND',
      path: 'kind',
      message: `Unsupported kind: ${manifest.kind}`,
      suggestion: 'Use: kind: "Component"',
    });
  }

  // Validate metadata
  const metadataResult = validateMetadata(manifest.metadata);
  errors.push(...metadataResult);

  // Validate type
  if (!manifest.type) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'type',
      message: 'Component type is required',
      suggestion: 'Specify one of: core, routing, privacy, cache, embeddings, adapters, monitoring, testing, cli, native',
    });
  } else if (!isValidComponentType(manifest.type)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'type',
      message: `Invalid component type: ${manifest.type}`,
      suggestion: 'Use one of: core, routing, privacy, cache, embeddings, adapters, monitoring, testing, cli, native',
    });
  }

  // Validate language
  if (!manifest.language) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'language',
      message: 'Language is required',
      suggestion: 'Specify one of: typescript, javascript, python, rust, go, c, cpp, java, csharp',
    });
  } else if (!isValidLanguage(manifest.language)) {
    errors.push({
      code: 'INVALID_LANGUAGE',
      path: 'language',
      message: `Invalid language: ${manifest.language}`,
      suggestion: 'Use one of: typescript, javascript, python, rust, go, c, cpp, java, csharp',
    });
  } else {
    // Validate runtime compatibility
    if (manifest.runtime) {
      const compatibleRuntimes = LANGUAGE_RUNTIMES[manifest.language as Language] || [];
      if (!compatibleRuntimes.includes(manifest.runtime)) {
        errors.push({
          code: 'INCOMPATIBLE_RUNTIME',
          path: 'runtime',
          message: `Runtime "${manifest.runtime}" is not compatible with language "${manifest.language}"`,
          suggestion: `Use one of: ${compatibleRuntimes.join(', ')}`,
        });
      }
    }

    // Validate native section for native languages
    if (NATIVE_TYPES.includes(manifest.language as Language)) {
      if (!manifest.native) {
        errors.push({
          code: 'MISSING_NATIVE_SECTION',
          path: 'native',
          message: `Native language "${manifest.language}" requires native section`,
          suggestion: 'Add native section with language and bindings',
        });
      } else {
        const nativeResult = validateNative(manifest.native);
        errors.push(...nativeResult.map(e => ({ ...e, path: `native.${e.path}` })));
      }
    }
  }

  // Validate dependencies
  if (manifest.dependencies) {
    const depsResult = validateDependencies(manifest.dependencies, manifest.type);
    errors.push(...depsResult.map(e => ({ ...e, path: `dependencies.${e.path}` })));
  }

  // Validate configuration
  if (!manifest.configuration) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'configuration',
      message: 'Configuration schema is required',
      suggestion: 'Add configuration section with properties',
    });
  } else {
    const configResult = validateConfiguration(manifest.configuration);
    errors.push(...configResult.map(e => ({ ...e, path: `configuration.${e.path}` })));
  }

  // Validate hardware (optional)
  if (manifest.hardware) {
    const hwResult = validateHardware(manifest.hardware);
    errors.push(...hwResult.map(e => ({ ...e, path: `hardware.${e.path}` })));
  }

  // Validate performance (optional)
  if (manifest.performance) {
    const perfResult = validatePerformance(manifest.performance);
    errors.push(...perfResult.map(e => ({ ...e, path: `performance.${e.path}` })));
  }

  // Validate interface
  if (!manifest.interface) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'interface',
      message: 'Interface specification is required',
      suggestion: 'Add interface section with main and exports',
    });
  } else {
    const ifaceResult = validateInterface(manifest.interface);
    errors.push(...ifaceResult.map(e => ({ ...e, path: `interface.${e.path}` })));
  }

  // Validate tests
  if (!manifest.tests) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'tests',
      message: 'Test specification is required',
      suggestion: 'Add tests section with framework and command',
    });
  } else {
    const testResult = validateTests(manifest.tests);
    errors.push(...testResult.map(e => ({ ...e, path: `tests.${e.path}` })));
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: errors.length === 0 ? manifest as ComponentManifest : undefined,
  };
}

/**
 * Validate metadata section
 */
function validateMetadata(metadata: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!metadata) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'metadata',
      message: 'Metadata is required',
      suggestion: 'Add metadata section with name, version, and description',
    });
    return errors;
  }

  // Validate name
  if (!metadata.name) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'metadata.name',
      message: 'Component name is required',
      suggestion: 'Add a kebab-case name (e.g., cascade-router)',
    });
  } else if (!PATTERNS.NAME.test(metadata.name)) {
    errors.push({
      code: 'INVALID_NAME',
      path: 'metadata.name',
      message: `Invalid component name: ${metadata.name}`,
      suggestion: 'Use kebab-case (lowercase letters, numbers, hyphens; cannot start/end with hyphen)',
    });
  }

  // Validate version
  if (!metadata.version) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'metadata.version',
      message: 'Version is required',
      suggestion: 'Add a semantic version (e.g., 1.0.0)',
    });
  } else if (!PATTERNS.SEMVER.test(metadata.version)) {
    errors.push({
      code: 'INVALID_VERSION',
      path: 'metadata.version',
      message: `Invalid semantic version: ${metadata.version}`,
      suggestion: 'Use semantic versioning (e.g., 1.0.0, 2.1.3-beta)',
    });
  }

  // Validate description
  if (!metadata.description) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'metadata.description',
      message: 'Description is required',
      suggestion: 'Add a human-readable description',
    });
  } else if (typeof metadata.description !== 'string' || metadata.description.length < 10) {
    errors.push({
      code: 'INVALID_DESCRIPTION',
      path: 'metadata.description',
      message: 'Description must be at least 10 characters',
      suggestion: 'Provide a meaningful description (10+ characters)',
    });
  }

  // Validate homepage (if provided)
  if (metadata.homepage && !PATTERNS.URI.test(metadata.homepage)) {
    errors.push({
      code: 'INVALID_URI',
      path: 'metadata.homepage',
      message: `Invalid URI: ${metadata.homepage}`,
      suggestion: 'Use a valid URL (e.g., https://example.com)',
    });
  }

  // Validate repository (if provided)
  if (metadata.repository && !PATTERNS.URI.test(metadata.repository)) {
    errors.push({
      code: 'INVALID_URI',
      path: 'metadata.repository',
      message: `Invalid URI: ${metadata.repository}`,
      suggestion: 'Use a valid git URL (e.g., https://github.com/user/repo)',
    });
  }

  // Validate tags (if provided)
  if (metadata.tags && !Array.isArray(metadata.tags)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'metadata.tags',
      message: 'Tags must be an array',
      suggestion: 'Use array format: tags: [routing, ai]',
    });
  }

  // Validate keywords (if provided)
  if (metadata.keywords && !Array.isArray(metadata.keywords)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'metadata.keywords',
      message: 'Keywords must be an array',
      suggestion: 'Use array format: keywords: [cascade, complexity]',
    });
  }

  return errors;
}

/**
 * Validate native section
 */
function validateNative(native: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!native.language) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'language',
      message: 'Native language is required',
      suggestion: 'Specify the native implementation language',
    });
  }

  if (!native.bindings) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'bindings',
      message: 'Native bindings are required',
      suggestion: 'Specify available language bindings (e.g., [typescript, python])',
    });
  } else if (!Array.isArray(native.bindings) || native.bindings.length === 0) {
    errors.push({
      code: 'INVALID_BINDINGS',
      path: 'bindings',
      message: 'Bindings must be a non-empty array',
      suggestion: 'Specify at least one binding (e.g., [typescript])',
    });
  }

  return errors;
}

/**
 * Validate dependencies
 */
function validateDependencies(deps: any, componentType: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Non-core components should have protocol dependency
  if (componentType !== 'core' && !deps.protocol) {
    errors.push({
      code: 'MISSING_PROTOCOL_DEPENDENCY',
      path: 'protocol',
      message: 'Non-core components should depend on protocol',
      suggestion: 'Add: protocol: ">=1.0.0"',
    });
  }

  // Validate component dependencies
  if (deps.components) {
    if (typeof deps.components !== 'object' || Array.isArray(deps.components)) {
      errors.push({
        code: 'INVALID_TYPE',
        path: 'components',
        message: 'Component dependencies must be an object',
        suggestion: 'Use object format: components: { "name": "^1.0.0" }',
      });
    } else {
      for (const [name, version] of Object.entries(deps.components)) {
        if (typeof version !== 'string') {
          errors.push({
            code: 'INVALID_VERSION',
            path: `components.${name}`,
            message: `Version must be a string: ${version}`,
            suggestion: 'Use a semantic version constraint (e.g., "^1.0.0")',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate configuration schema
 */
function validateConfiguration(config: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.properties) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'properties',
      message: 'Configuration properties are required',
      suggestion: 'Add properties object with at least one property',
    });
    return errors;
  }

  if (typeof config.properties !== 'object' || Array.isArray(config.properties)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'properties',
      message: 'Properties must be an object',
      suggestion: 'Use object format: properties: { name: {...} }',
    });
    return errors;
  }

  // Validate each property
  for (const [name, schema] of Object.entries(config.properties)) {
    const propErrors = validatePropertySchema(name, schema as PropertySchema);
    errors.push(...propErrors);
  }

  // Validate required array
  if (config.required && !Array.isArray(config.required)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'required',
      message: 'Required must be an array',
      suggestion: 'Use array format: required: ["prop1", "prop2"]',
    });
  }

  // Validate additionalProperties
  if (config.additionalProperties !== undefined && typeof config.additionalProperties !== 'boolean') {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'additionalProperties',
      message: 'additionalProperties must be a boolean',
      suggestion: 'Use: additionalProperties: true or false',
    });
  }

  return errors;
}

/**
 * Validate a property schema
 */
function validatePropertySchema(name: string, schema: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `properties.${name}`;

  if (!schema.type) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path,
      message: `Property "${name}" missing type`,
      suggestion: 'Add type: string|number|integer|boolean|array|object',
    });
    return errors;
  }

  const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
  if (!validTypes.includes(schema.type)) {
    errors.push({
      code: 'INVALID_TYPE',
      path,
      message: `Invalid property type: ${schema.type}`,
      suggestion: `Use one of: ${validTypes.join(', ')}`,
    });
  }

  // Validate pattern (for strings)
  if (schema.pattern && schema.type !== 'string') {
    errors.push({
      code: 'INVALID_PATTERN',
      path,
      message: 'Pattern is only valid for string properties',
      suggestion: 'Remove pattern or change type to string',
    });
  }

  // Validate min/max for numbers
  if ((schema.minimum !== undefined || schema.maximum !== undefined) &&
      schema.type !== 'number' && schema.type !== 'integer') {
    errors.push({
      code: 'INVALID_CONSTRAINT',
      path,
      message: 'Minimum/maximum only valid for number/integer properties',
      suggestion: 'Remove these constraints or change type to number/integer',
    });
  }

  // Validate min/max length
  if ((schema.minLength !== undefined || schema.maxLength !== undefined) &&
      schema.type !== 'string' && schema.type !== 'array') {
    errors.push({
      code: 'INVALID_CONSTRAINT',
      path,
      message: 'MinLength/maxLength only valid for string/array properties',
      suggestion: 'Remove these constraints or change type to string/array',
    });
  }

  // Validate enum
  if (schema.enum && !Array.isArray(schema.enum)) {
    errors.push({
      code: 'INVALID_TYPE',
      path,
      message: 'Enum must be an array',
      suggestion: 'Use: enum: ["value1", "value2"]',
    });
  }

  // Validate items (for arrays)
  if (schema.type === 'array' && schema.items) {
    const itemErrors = validatePropertySchema(`${name}[items]`, schema.items);
    errors.push(...itemErrors);
  }

  // Validate nested properties (for objects)
  if (schema.type === 'object' && schema.properties) {
    for (const [nestedName, nestedSchema] of Object.entries(schema.properties)) {
      const nestedErrors = validatePropertySchema(`${name}.${nestedName}`, nestedSchema as PropertySchema);
      errors.push(...nestedErrors);
    }
  }

  return errors;
}

/**
 * Validate hardware specification
 */
function validateHardware(hw: any): ValidationError[] {
  const errors: ValidationError[] = [];

  const numericFields = [
    'min_memory_mb',
    'recommended_memory_mb',
    'min_cpu_cores',
    'recommended_cpu_cores',
    'gpu_memory_mb',
    'storage_mb',
  ];

  for (const field of numericFields) {
    if (hw[field] !== undefined) {
      if (typeof hw[field] !== 'number' || hw[field] < 0) {
        errors.push({
          code: 'INVALID_VALUE',
          path: field,
          message: `${field} must be a positive number`,
          suggestion: 'Use a positive numeric value (e.g., 100)',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate performance characteristics
 */
function validatePerformance(perf: any): ValidationError[] {
  const errors: ValidationError[] = [];

  const numericFields = [
    'benchmark_qps',
    'latency_p50_ms',
    'latency_p95_ms',
    'latency_p99_ms',
    'throughput_mb_per_sec',
    'concurrent_connections',
    'cold_start_ms',
  ];

  for (const field of numericFields) {
    if (perf[field] !== undefined) {
      if (typeof perf[field] !== 'number' || perf[field] < 0) {
        errors.push({
          code: 'INVALID_VALUE',
          path: field,
          message: `${field} must be a positive number`,
          suggestion: 'Use a positive numeric value',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate interface specification
 */
function validateInterface(iface: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!iface.main) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'main',
      message: 'Main entry point is required',
      suggestion: 'Add: main: ./dist/index.js',
    });
  } else if (typeof iface.main !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'main',
      message: 'Main must be a string',
      suggestion: 'Use: main: "./relative/path/to/file"',
    });
  }

  if (!iface.exports) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'exports',
      message: 'Exports are required',
      suggestion: 'Add: exports: [ExportName]',
    });
  } else if (!Array.isArray(iface.exports) || iface.exports.length === 0) {
    errors.push({
      code: 'INVALID_EXPORTS',
      path: 'exports',
      message: 'Exports must be a non-empty array',
      suggestion: 'Use: exports: [ExportName1, ExportName2]',
    });
  }

  if (iface.imports && !Array.isArray(iface.imports)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'imports',
      message: 'Imports must be an array',
      suggestion: 'Use: imports: [InterfaceName]',
    });
  }

  return errors;
}

/**
 * Validate test specification
 */
function validateTests(tests: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!tests.framework) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'framework',
      message: 'Test framework is required',
      suggestion: 'Add: framework: vitest',
    });
  } else if (!TEST_FRAMEWORKS.includes(tests.framework)) {
    errors.push({
      code: 'INVALID_FRAMEWORK',
      path: 'framework',
      message: `Unsupported test framework: ${tests.framework}`,
      suggestion: `Use one of: ${TEST_FRAMEWORKS.join(', ')}`,
    });
  }

  if (!tests.command) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      path: 'command',
      message: 'Test command is required',
      suggestion: 'Add: command: npm test',
    });
  } else if (typeof tests.command !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      path: 'command',
      message: 'Command must be a string',
      suggestion: 'Use: command: "npm test"',
    });
  }

  if (tests.coverage_threshold !== undefined) {
    if (typeof tests.coverage_threshold !== 'number' ||
        tests.coverage_threshold < 0 ||
        tests.coverage_threshold > 100) {
      errors.push({
        code: 'INVALID_COVERAGE',
        path: 'coverage_threshold',
        message: 'Coverage threshold must be a number between 0 and 100',
        suggestion: 'Use: coverage_threshold: 80',
      });
    }
  }

  return errors;
}

/**
 * Check if value is valid component type
 */
export function isValidComponentType(value: string): value is ComponentType {
  return ['core', 'routing', 'privacy', 'cache', 'embeddings', 'adapters', 'monitoring', 'testing', 'cli', 'native']
    .includes(value);
}

/**
 * Check if value is valid language
 */
export function isValidLanguage(value: string): value is Language {
  return ['typescript', 'javascript', 'python', 'rust', 'go', 'c', 'cpp', 'java', 'csharp']
    .includes(value);
}
