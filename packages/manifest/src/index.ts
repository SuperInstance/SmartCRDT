/**
 * Component Manifest Package
 * @version 1.0.0
 *
 * Main entry point for the manifest package.
 * Exports validation, loading, and utility functions.
 */

export {
  validateManifest,
  ValidationResult,
  ValidationError,
} from './validate';

export {
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
  MergeOptions,
  TEST_FRAMEWORKS,
  COMMON_LICENSES,
  PATTERNS,
  LANGUAGE_RUNTIMES,
  NATIVE_TYPES,
  DEFAULTS,
} from './types';

import * as YAML from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import type { ValidationResult } from './types';
import { validateManifest } from './validate';
import type { ComponentManifest, MergeOptions, ComponentType, Language } from './types';

/**
 * Load and validate a manifest from a file
 */
export function loadManifest(filePath: string): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = YAML.load(content);

    // Validate the manifest
    const result = validateManifest(data);

    // Add file path to result if valid
    if (result.valid && result.manifest) {
      // Store the file path for reference
      (result.manifest as any)._filePath = filePath;
      (result.manifest as any)._dir = path.dirname(filePath);
    }

    return result;
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          code: 'LOAD_ERROR',
          path: '',
          message: `Failed to load manifest from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: 'Ensure file exists and contains valid YAML',
        },
      ],
    };
  }
}

/**
 * Load and validate multiple manifests
 */
export function loadManifests(filePaths: string[]): ValidationResult[] {
  return filePaths.map(loadManifest);
}

/**
 * Save a manifest to a file
 */
export function saveManifest(manifest: ComponentManifest, filePath: string): void {
  const yaml = YAML.dump(manifest, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(filePath, yaml, 'utf-8');
}

/**
 * Merge multiple manifests
 */
export function mergeManifests(
  base: ComponentManifest,
  override: Partial<ComponentManifest>,
  options: MergeOptions = {}
): ComponentManifest {
  const {
    override: overrideValues = false,
    mergeArrays = false,
    mergeObjects = true,
  } = options;

  const merged: any = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;

    if (key === 'metadata' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else if (key === 'configuration' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else if (key === 'dependencies' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else if (key === 'hardware' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else if (key === 'performance' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else if (key === 'interface' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else if (key === 'tests' && mergeObjects && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...merged[key], ...value };
    } else if (Array.isArray(value) && mergeArrays && Array.isArray(merged[key])) {
      // Merge arrays (concatenate)
      merged[key] = [...merged[key], ...value];
    } else if (overrideValues || merged[key] === undefined) {
      // Override or set if not exists
      merged[key] = value;
    }
  }

  return merged as ComponentManifest;
}

/**
 * Create a minimal manifest template
 */
export function createManifestTemplate(options: {
  name: string;
  type: ComponentType;
  language: Language;
  description: string;
}): ComponentManifest {
  return {
    apiVersion: 'v1',
    kind: 'Component',
    metadata: {
      name: options.name,
      version: '1.0.0',
      description: options.description,
      license: 'Apache-2.0',
    },
    type: options.type,
    language: options.language,
    runtime: options.language === 'typescript' || options.language === 'javascript' ? 'nodejs' : undefined,
    dependencies: {},
    configuration: {
      properties: {
        example_config: {
          type: 'string',
          default: 'default_value',
          description: 'Example configuration property',
        },
      },
      additionalProperties: false,
    },
    interface: {
      main: './dist/index.js',
      exports: ['ExampleComponent'],
    },
    tests: {
      framework: 'vitest',
      command: 'npm test',
      coverage_threshold: 80,
    },
  };
}

/**
 * Find all manifest files in a directory
 */
export function findManifests(dir: string, recursive: boolean = true): string[] {
  const manifests: string[] = [];

  const traverse = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && recursive) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        // Check for manifest.yaml or manifest.yml
        if (entry.name === 'manifest.yaml' || entry.name === 'manifest.yml') {
          manifests.push(fullPath);
        }
      }
    }
  };

  try {
    traverse(dir);
  } catch (error) {
    // Directory might not exist or be inaccessible
  }

  return manifests;
}

/**
 * Validate a configuration value against a property schema
 */
export function validateConfigValue(
  schema: ComponentManifest,
  config: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const properties = schema.configuration.properties;

  // Check required properties
  const required = schema.configuration.required || [];
  for (const propName of required) {
    if (!(propName in config)) {
      errors.push(`Missing required property: ${propName}`);
    }
  }

  // Validate each provided property
  for (const [propName, value] of Object.entries(config)) {
    const propSchema = properties[propName];

    if (!propSchema) {
      if (!schema.configuration.additionalProperties) {
        errors.push(`Unknown property: ${propName}`);
      }
      continue;
    }

    // Type validation
    const typeErrors = validateValueType(propName, value, propSchema);
    errors.push(...typeErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a value against a property schema
 */
function validateValueType(
  propName: string,
  value: any,
  schema: any
): string[] {
  const errors: string[] = [];

  // Check null/undefined
  if (value === null || value === undefined) {
    if (!('default' in schema)) {
      errors.push(`Property "${propName}" is required`);
    }
    return errors;
  }

  // Type checking
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`Property "${propName}" must be a string`);
      } else {
        // Pattern validation
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push(`Property "${propName}" does not match pattern: ${schema.pattern}`);
        }
        // Length validation
        if (schema.minLength && value.length < schema.minLength) {
          errors.push(`Property "${propName}" must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          errors.push(`Property "${propName}" must be at most ${schema.maxLength} characters`);
        }
      }
      break;

    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        errors.push(`Property "${propName}" must be a number`);
      } else {
        if (schema.type === 'integer' && !Number.isInteger(value)) {
          errors.push(`Property "${propName}" must be an integer`);
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push(`Property "${propName}" must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push(`Property "${propName}" must be at most ${schema.maximum}`);
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`Property "${propName}" must be a boolean`);
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`Property "${propName}" must be an array`);
      } else {
        if (schema.minItems && value.length < schema.minItems) {
          errors.push(`Property "${propName}" must have at least ${schema.minItems} items`);
        }
        if (schema.maxItems && value.length > schema.maxItems) {
          errors.push(`Property "${propName}" must have at most ${schema.maxItems} items`);
        }
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`Property "${propName}" must be an object`);
      }
      break;
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`Property "${propName}" must be one of: ${schema.enum.join(', ')}`);
  }

  return errors;
}

/**
 * Extract component name from manifest file path
 */
export function extractComponentName(filePath: string): string {
  const basename = path.basename(path.dirname(filePath));
  return basename;
}

/**
 * Get manifest dependencies as a flat list
 */
export function getFlatDependencies(manifest: ComponentManifest): string[] {
  const deps: string[] = [];

  if (manifest.dependencies?.components) {
    deps.push(...Object.keys(manifest.dependencies.components));
  }

  return deps;
}

/**
 * Check if manifest has a specific dependency
 */
export function hasDependency(manifest: ComponentManifest, componentName: string): boolean {
  return getFlatDependencies(manifest).includes(componentName);
}

/**
 * Get all component types
 */
export function getComponentTypes(): ComponentType[] {
  return ['core', 'routing', 'privacy', 'cache', 'embeddings', 'adapters', 'monitoring', 'testing', 'cli', 'native'];
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Language[] {
  return ['typescript', 'javascript', 'python', 'rust', 'go', 'c', 'cpp', 'java', 'csharp'];
}
