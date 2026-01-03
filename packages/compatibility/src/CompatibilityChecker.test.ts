/**
 * Tests for CompatibilityChecker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CompatibilityChecker,
  createCompatibilityChecker,
  type ComponentMatrix,
  type ComponentConstraint,
} from './CompatibilityChecker.js';

describe('CompatibilityChecker', () => {
  let checker: CompatibilityChecker;
  let mockMatrix: ComponentMatrix;

  beforeEach(() => {
    // Create mock compatibility matrix
    mockMatrix = {
      component: '@lsi/test-component',
      metadata: {
        displayName: 'Test Component',
        description: 'A test component',
        stability: 'stable',
        license: 'MIT',
      },
      versions: {
        '1.0.0': {
          api_version: '1.0',
          release: {
            date: '2025-01-01',
            changelog: 'Initial release',
          },
          dependencies: {
            '@lsi/protocol': {
              version: '^1.0.0',
              required: true,
              reason: 'Core protocol types',
            },
          },
          compatible_with: [
            {
              component: '@lsi/protocol',
              versions: ['1.x'],
              tested: true,
            },
          ],
          breaking_changes: [],
        },
        '1.1.0': {
          api_version: '1.1',
          release: {
            date: '2025-02-01',
            changelog: 'Add new features',
          },
          dependencies: {
            '@lsi/protocol': {
              version: '^1.1.0',
              required: true,
            },
          },
          compatible_with: [
            {
              component: '@lsi/protocol',
              versions: ['1.x'],
              tested: true,
            },
          ],
          breaking_changes: [],
        },
        '2.0.0': {
          api_version: '2.0',
          release: {
            date: '2025-03-01',
            changelog: 'Major redesign',
          },
          dependencies: {
            '@lsi/protocol': {
              version: '^2.0.0',
              required: true,
            },
          },
          compatible_with: [
            {
              component: '@lsi/protocol',
              versions: ['2.x'],
              tested: true,
            },
            {
              component: '@lsi/protocol',
              versions: ['1.x'],
              compatible: false,
              reason: 'Protocol API changed',
            },
          ],
          breaking_changes: [
            {
              id: 'BC-001',
              type: 'removed',
              severity: 'major',
              description: 'Removed legacy API',
              affected_api: {
                interface: 'LegacyAPI',
              },
              migration: {
                from: '1.x',
                to: '2.0.0',
                steps: [
                  'Update API calls',
                  'Run migration script',
                  'Test thoroughly',
                ],
              },
              examples: {
                before: 'legacyAPI.call()',
                after: 'newAPI.call()',
              },
            },
          ],
          migration_guide: 'MIGRATION_1_TO_2.md',
        },
      },
      current: '2.0.0',
      supported: ['2.0.0', '1.1.0'],
      unsupported: ['1.0.0'],
    };

    // Mock file system
    vi.mock('fs', () => ({
      readFileSync: vi.fn((path: string) => {
        if (path.includes('test-component')) {
          return YAML.stringify(mockMatrix);
        }
        throw new Error('File not found');
      }),
      existsSync: vi.fn((path: string) => {
        return path.includes('test-component');
      }),
    }));

    checker = new CompatibilityChecker('/mock/matrix');
  });

  describe('checkCompatibility', () => {
    it('should return compatible for valid version and constraints', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '2.0.0' },
      ];

      const report = await checker.checkCompatibility(
        '@lsi/test-component',
        '2.0.0',
        constraints
      );

      expect(report.compatible).toBe(true);
      expect(report.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect incompatible versions', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const report = await checker.checkCompatibility(
        '@lsi/test-component',
        '2.0.0',
        constraints
      );

      expect(report.compatible).toBe(false);
      expect(report.issues.some(i => i.type === 'incompatible_api')).toBe(true);
    });

    it('should detect missing dependencies', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/missing', version: '1.0.0' },
      ];

      const report = await checker.checkCompatibility(
        '@lsi/test-component',
        '1.0.0',
        constraints
      );

      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it('should return error for unknown component', async () => {
      const constraints: ComponentConstraint[] = [];

      const report = await checker.checkCompatibility(
        '@lsi/unknown',
        '1.0.0',
        constraints
      );

      expect(report.compatible).toBe(false);
      expect(report.issues.some(i => i.severity === 'error')).toBe(true);
    });

    it('should return error for unknown version', async () => {
      const constraints: ComponentConstraint[] = [];

      const report = await checker.checkCompatibility(
        '@lsi/test-component',
        '99.0.0',
        constraints
      );

      expect(report.compatible).toBe(false);
      expect(report.issues.some(i => i.type === 'version_mismatch')).toBe(true);
    });

    it('should include migration path for incompatible versions', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const report = await checker.checkCompatibility(
        '@lsi/test-component',
        '2.0.0',
        constraints
      );

      expect(report.migration_path).toBeDefined();
      expect(report.migration_path?.from).toBe('2.0.0');
      expect(report.migration_path?.breaking_changes.length).toBeGreaterThan(0);
    });
  });

  describe('findCompatibleVersions', () => {
    it('should return all compatible versions', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const versions = await checker.findCompatibleVersions(
        '@lsi/test-component',
        constraints
      );

      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
      expect(versions).not.toContain('2.0.0');
    });

    it('should return empty array for unknown component', async () => {
      const constraints: ComponentConstraint[] = [];

      const versions = await checker.findCompatibleVersions(
        '@lsi/unknown',
        constraints
      );

      expect(versions).toHaveLength(0);
    });

    it('should sort versions in descending order', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const versions = await checker.findCompatibleVersions(
        '@lsi/test-component',
        constraints
      );

      expect(versions).toEqual(['1.1.0', '1.0.0']);
    });
  });

  describe('findLatestCompatible', () => {
    it('should return latest compatible version', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const latest = await checker.findLatestCompatible(
        '@lsi/test-component',
        constraints
      );

      expect(latest).toBe('1.1.0');
    });

    it('should return null if no compatible versions', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '0.0.1' },
      ];

      const latest = await checker.findLatestCompatible(
        '@lsi/test-component',
        constraints
      );

      expect(latest).toBeNull();
    });
  });

  describe('getVersionRange', () => {
    it('should return version range information', async () => {
      const constraints: ComponentConstraint[] = [
        { component: '@lsi/protocol', version: '1.0.0' },
      ];

      const range = await checker.getVersionRange(
        '@lsi/test-component',
        constraints
      );

      expect(range.all_versions.length).toBeGreaterThan(0);
      expect(range.compatible_versions.length).toBeGreaterThan(0);
      expect(range.latest_compatible).toBe('1.1.0');
      expect(range.latest_stable).toBe('2.0.0');
    });

    it('should handle unknown component', async () => {
      const constraints: ComponentConstraint[] = [];

      const range = await checker.getVersionRange(
        '@lsi/unknown',
        constraints
      );

      expect(range.all_versions).toHaveLength(0);
      expect(range.compatible_versions).toHaveLength(0);
      expect(range.latest_compatible).toBeNull();
      expect(range.latest_stable).toBeNull();
    });
  });

  describe('hasBreakingChanges', () => {
    it('should detect breaking changes between versions', async () => {
      const hasBreaking = await checker.hasBreakingChanges(
        '@lsi/test-component',
        '1.0.0',
        '2.0.0'
      );

      expect(hasBreaking).toBe(true);
    });

    it('should return false for compatible versions', async () => {
      const hasBreaking = await checker.hasBreakingChanges(
        '@lsi/test-component',
        '1.0.0',
        '1.1.0'
      );

      expect(hasBreaking).toBe(false);
    });

    it('should return false for unknown component', async () => {
      const hasBreaking = await checker.hasBreakingChanges(
        '@lsi/unknown',
        '1.0.0',
        '2.0.0'
      );

      expect(hasBreaking).toBe(false);
    });
  });

  describe('generateMigration', () => {
    it('should generate migration path', async () => {
      const migration = await checker.generateMigration(
        '@lsi/test-component',
        '1.0.0',
        '2.0.0'
      );

      expect(migration.from).toBe('1.0.0');
      expect(migration.to).toBe('2.0.0');
      expect(migration.breaking_changes.length).toBeGreaterThan(0);
      expect(migration.steps.length).toBeGreaterThan(0);
      expect(migration.difficulty).toBe('medium');
      expect(migration.estimated_time).toBeDefined();
    });

    it('should throw error for unknown component', async () => {
      await expect(
        checker.generateMigration('@lsi/unknown', '1.0.0', '2.0.0')
      ).rejects.toThrow();
    });

    it('should throw error for unknown version', async () => {
      await expect(
        checker.generateMigration('@lsi/test-component', '99.0.0', '100.0.0')
      ).rejects.toThrow();
    });

    it('should estimate difficulty correctly', async () => {
      const migration = await checker.generateMigration(
        '@lsi/test-component',
        '1.1.0',
        '2.0.0'
      );

      expect(migration.difficulty).toBe('medium');
      expect(migration.breaking_changes.length).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should cache loaded matrices', async () => {
      const cached = checker.getCachedComponents();
      expect(Array.isArray(cached)).toBe(true);
    });

    it('should clear cache', () => {
      expect(() => checker.clearCache()).not.toThrow();
      const cached = checker.getCachedComponents();
      expect(cached.length).toBe(0);
    });
  });

  describe('createCompatibilityChecker', () => {
    it('should create checker with default directory', () => {
      const newChecker = createCompatibilityChecker();
      expect(newChecker).toBeInstanceOf(CompatibilityChecker);
    });

    it('should create checker with custom directory', () => {
      const newChecker = createCompatibilityChecker('/custom/path');
      expect(newChecker).toBeInstanceOf(CompatibilityChecker);
    });
  });
});

// Import YAML for mocking
import * as YAML from 'yaml';
