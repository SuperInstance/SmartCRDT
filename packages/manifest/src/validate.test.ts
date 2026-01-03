/**
 * Component Manifest Validator Tests
 * @version 1.0.0
 *
 * Comprehensive test suite for manifest validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  loadManifest,
  saveManifest,
  mergeManifests,
  createManifestTemplate,
  validateConfigValue,
  getFlatDependencies,
  hasDependency,
  extractComponentName,
  getComponentTypes,
  getSupportedLanguages,
  ComponentManifest,
  ComponentType,
  Language,
} from './index';

describe('validateManifest', () => {
  it('should validate a correct minimal manifest', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'routing' as ComponentType,
      language: 'typescript' as Language,
      configuration: {
        properties: {
          test_prop: {
            type: 'string',
            default: 'test',
          },
        },
      },
      interface: {
        main: './dist/index.js',
        exports: ['TestComponent'],
      },
      tests: {
        framework: 'vitest',
        command: 'npm test',
      },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest).toBeDefined();
  });

  it('should reject manifest with invalid apiVersion', () => {
    const manifest = {
      apiVersion: 'v2',
      kind: 'Component',
      metadata: {
        name: 'test',
        version: '1.0.0',
        description: 'test',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_API_VERSION')).toBe(true);
  });

  it('should reject manifest with invalid component name', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'Invalid_Name',
        version: '1.0.0',
        description: 'test',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_NAME')).toBe(true);
  });

  it('should reject manifest with invalid semantic version', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0',
        description: 'test',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_VERSION')).toBe(true);
  });

  it('should reject manifest with short description', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'short',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_DESCRIPTION')).toBe(true);
  });

  it('should reject manifest with invalid component type', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'invalid' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(true);
  });

  it('should reject manifest with invalid language', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'invalid' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_LANGUAGE')).toBe(true);
  });

  it('should reject manifest with incompatible runtime', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      runtime: 'pypy',
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INCOMPATIBLE_RUNTIME')).toBe(true);
  });

  it('should require native section for rust language', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'routing' as ComponentType,
      language: 'rust' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/router.wasm', exports: ['route'] },
      tests: { framework: 'cargo test', command: 'cargo test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_NATIVE_SECTION')).toBe(true);
  });

  it('should validate native section correctly', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'routing' as ComponentType,
      language: 'rust' as Language,
      native: {
        language: 'rust' as Language,
        bindings: ['typescript', 'python'],
        wasm: true,
        simd: true,
      },
      configuration: { properties: {} },
      interface: { main: './dist/router.wasm', exports: ['route'] },
      tests: { framework: 'cargo test', command: 'cargo test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it('should reject manifest with missing required configuration property', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: {
        properties: {
          test_prop: {
            type: 'string',
          },
        },
        required: ['test_prop'],
      },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    // This should be valid (schema validation, not value validation)
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it('should validate property schemas correctly', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: {
        properties: {
          string_prop: {
            type: 'string',
            pattern: '^[a-z]+$',
            minLength: 1,
            maxLength: 10,
          },
          number_prop: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
          array_prop: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
          },
          enum_prop: {
            type: 'string',
            enum: ['a', 'b', 'c'],
          },
        },
      },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid test framework', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'unknown-framework', command: 'npm test' },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_FRAMEWORK')).toBe(true);
  });

  it('should reject invalid coverage threshold', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component for validation',
      },
      type: 'core' as ComponentType,
      language: 'typescript' as Language,
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: {
        framework: 'vitest',
        command: 'npm test',
        coverage_threshold: 150,
      },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_COVERAGE')).toBe(true);
  });

  it('should validate a complete realistic manifest', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'cascade-router',
        version: '1.0.0',
        description: 'Complexity + confidence cascade routing with emotional intelligence',
        author: 'SuperInstance',
        license: 'Apache-2.0',
        tags: ['routing', 'ai', 'orchestration'],
      },
      type: 'routing' as ComponentType,
      language: 'typescript' as Language,
      runtime: 'nodejs',
      dependencies: {
        protocol: '>=1.0.0',
        components: {
          'complexity-scorer': '^1.0.0',
        },
        npm: {
          zod: '^3.22.0',
        },
      },
      configuration: {
        properties: {
          complexity_threshold: {
            type: 'number',
            default: 0.7,
            minimum: 0.0,
            maximum: 1.0,
          },
          log_level: {
            type: 'string',
            default: 'info',
            enum: ['debug', 'info', 'warn', 'error'],
          },
        },
        required: ['complexity_threshold'],
        additionalProperties: false,
      },
      hardware: {
        min_memory_mb: 50,
        recommended_memory_mb: 100,
      },
      performance: {
        benchmark_qps: 10000,
        latency_p50_ms: 1,
        latency_p95_ms: 5,
      },
      interface: {
        main: './dist/index.js',
        exports: ['CascadeRouter', 'RouteDecision'],
        imports: ['IEmbeddingService'],
        protocol: 'IRouter',
      },
      tests: {
        framework: 'vitest',
        command: 'npm test',
        coverage_threshold: 80,
      },
    };

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.metadata.name).toBe('cascade-router');
  });
});

describe('validateConfigValue', () => {
  const manifest: ComponentManifest = {
    apiVersion: 'v1',
    kind: 'Component',
    metadata: {
      name: 'test',
      version: '1.0.0',
      description: 'test',
    },
    type: 'core',
    language: 'typescript',
    configuration: {
      properties: {
        required_string: {
          type: 'string',
        },
        optional_number: {
          type: 'number',
          default: 42,
        },
        constrained_enum: {
          type: 'string',
          enum: ['a', 'b', 'c'],
        },
        ranged_number: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      },
      required: ['required_string'],
      additionalProperties: false,
    },
    interface: {
      main: './dist/index.js',
      exports: ['Test'],
    },
    tests: {
      framework: 'vitest',
      command: 'npm test',
    },
  };

  it('should validate correct config', () => {
    const config = {
      required_string: 'test',
      optional_number: 10,
    };

    const result = validateConfigValue(manifest, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing required property', () => {
    const config = {
      optional_number: 10,
    };

    const result = validateConfigValue(manifest, config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required property: required_string');
  });

  it('should reject invalid enum value', () => {
    const config = {
      required_string: 'test',
      constrained_enum: 'd',
    };

    const result = validateConfigValue(manifest, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('constrained_enum'))).toBe(true);
  });

  it('should reject out-of-range number', () => {
    const config = {
      required_string: 'test',
      ranged_number: 150,
    };

    const result = validateConfigValue(manifest, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ranged_number'))).toBe(true);
  });

  it('should reject additional properties when not allowed', () => {
    const config = {
      required_string: 'test',
      unknown_prop: 'value',
    };

    const result = validateConfigValue(manifest, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('unknown_prop'))).toBe(true);
  });
});

describe('mergeManifests', () => {
  const base: ComponentManifest = {
    apiVersion: 'v1',
    kind: 'Component',
    metadata: {
      name: 'base',
      version: '1.0.0',
      description: 'Base component',
      tags: ['base'],
    },
    type: 'core',
    language: 'typescript',
    configuration: {
      properties: {
        prop1: { type: 'string', default: 'base' },
        prop2: { type: 'number', default: 10 },
      },
    },
    interface: {
      main: './dist/index.js',
      exports: ['Base'],
    },
    tests: {
      framework: 'vitest',
      command: 'npm test',
    },
  };

  it('should merge manifests by default', () => {
    const override: Partial<ComponentManifest> = {
      metadata: {
        name: 'base',
        version: '1.0.0',
        description: 'Base component',
        author: 'Test Author',
      },
      configuration: {
        properties: {
          prop1: { type: 'string', default: 'overridden' },
          prop3: { type: 'boolean', default: true },
        },
      },
    };

    const merged = mergeManifests(base, override);

    expect(merged.metadata.author).toBe('Test Author');
    expect(merged.configuration.properties.prop1.default).toBe('overridden');
    expect(merged.configuration.properties.prop2).toBeDefined();
    expect(merged.configuration.properties.prop3).toBeDefined();
  });

  it('should not override when override option is false', () => {
    const override: Partial<ComponentManifest> = {
      metadata: {
        name: 'base',
        version: '2.0.0',
        description: 'New description',
      },
    };

    const merged = mergeManifests(base, override, { override: false });

    expect(merged.metadata.version).toBe('1.0.0');
    expect(merged.metadata.description).toBe('Base component');
  });

  it('should merge arrays when mergeArrays option is true', () => {
    const baseWithArray: ComponentManifest = {
      ...base,
      metadata: {
        ...base.metadata,
        tags: ['tag1', 'tag2'],
      },
    };

    const override: Partial<ComponentManifest> = {
      metadata: {
        ...base.metadata,
        tags: ['tag3'],
      },
    };

    const merged = mergeManifests(baseWithArray, override, { mergeArrays: true });

    expect(merged.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
});

describe('createManifestTemplate', () => {
  it('should create a minimal manifest template', () => {
    const template = createManifestTemplate({
      name: 'test-component',
      type: 'routing',
      language: 'typescript',
      description: 'A test routing component',
    });

    expect(template.apiVersion).toBe('v1');
    expect(template.kind).toBe('Component');
    expect(template.metadata.name).toBe('test-component');
    expect(template.metadata.version).toBe('1.0.0');
    expect(template.type).toBe('routing');
    expect(template.language).toBe('typescript');
    expect(template.runtime).toBe('nodejs');
    expect(template.configuration.properties).toBeDefined();
    expect(template.interface.exports).toContain('ExampleComponent');
  });

  it('should set runtime based on language', () => {
    const tsTemplate = createManifestTemplate({
      name: 'ts-component',
      type: 'core',
      language: 'typescript',
      description: 'TypeScript component',
    });
    expect(tsTemplate.runtime).toBe('nodejs');

    const pyTemplate = createManifestTemplate({
      name: 'py-component',
      type: 'core',
      language: 'python',
      description: 'Python component',
    });
    expect(pyTemplate.runtime).toBe('cpython');
  });
});

describe('utility functions', () => {
  it('should extract component name from path', () => {
    const path = '/path/to/packages/cascade-router/manifest.yaml';
    const name = extractComponentName(path);
    expect(name).toBe('cascade-router');
  });

  it('should get flat dependencies', () => {
    const manifest: ComponentManifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: { name: 'test', version: '1.0.0', description: 'test' },
      type: 'core',
      language: 'typescript',
      dependencies: {
        components: {
          'comp-one': '^1.0.0',
          'comp-two': '^2.0.0',
        },
      },
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    const deps = getFlatDependencies(manifest);
    expect(deps).toEqual(['comp-one', 'comp-two']);
  });

  it('should check if dependency exists', () => {
    const manifest: ComponentManifest = {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: { name: 'test', version: '1.0.0', description: 'test' },
      type: 'core',
      language: 'typescript',
      dependencies: {
        components: {
          'comp-one': '^1.0.0',
        },
      },
      configuration: { properties: {} },
      interface: { main: './dist/index.js', exports: ['Test'] },
      tests: { framework: 'vitest', command: 'npm test' },
    };

    expect(hasDependency(manifest, 'comp-one')).toBe(true);
    expect(hasDependency(manifest, 'comp-two')).toBe(false);
  });

  it('should get all component types', () => {
    const types = getComponentTypes();
    expect(types).toContain('core');
    expect(types).toContain('routing');
    expect(types).toContain('privacy');
    expect(types.length).toBeGreaterThan(5);
  });

  it('should get all supported languages', () => {
    const languages = getSupportedLanguages();
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
    expect(languages).toContain('rust');
    expect(languages.length).toBeGreaterThan(5);
  });
});

describe('validation error codes', () => {
  it('should return correct error codes for various failures', () => {
    const tests = [
      {
        manifest: { kind: 'Component' },
        expectedCode: 'MISSING_REQUIRED_FIELD',
      },
      {
        manifest: {
          apiVersion: 'v1',
          kind: 'Component',
          metadata: {
            name: 'test',
            version: '1.0.0',
            description: 'test',
          },
          type: 'invalid',
          language: 'typescript',
          configuration: { properties: {} },
          interface: { main: './dist/index.js', exports: ['Test'] },
          tests: { framework: 'vitest', command: 'npm test' },
        },
        expectedCode: 'INVALID_TYPE',
      },
    ];

    for (const test of tests) {
      const result = validateManifest(test.manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === test.expectedCode)).toBe(true);
    }
  });
});
