/**
 * @lsi/semver - Semantic Versioning Utilities Tests
 *
 * Comprehensive test suite for semver parsing, comparison,
 * constraint satisfaction, and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  parse,
  parseConstraint,
  compare,
  compareStrings,
  greaterThan,
  lessThan,
  equals,
  greaterThanOrEqual,
  lessThanOrEqual,
  increment,
  incrementMajor,
  incrementMinor,
  incrementPatch,
  satisfies,
  maxSatisfying,
  minSatisfying,
  valid,
  validConstraint,
  format,
  clean,
  rsort,
  sort,
  unique,
  isPrerelease,
  getPrerelease,
  compareIdentifiers,
} from './index';

describe('@lsi/semver', () => {
  describe('parse', () => {
    it('should parse basic versions', () => {
      const v = parse('1.2.3');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
      expect(v.prerelease).toEqual([]);
      expect(v.build).toEqual([]);
    });

    it('should parse versions with prerelease', () => {
      const v = parse('1.2.3-alpha.1');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
      expect(v.prerelease).toEqual(['alpha', '1']);
      expect(v.build).toEqual([]);
    });

    it('should parse versions with build metadata', () => {
      const v = parse('1.2.3+build.123');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
      expect(v.prerelease).toEqual([]);
      expect(v.build).toEqual(['build', '123']);
    });

    it('should parse versions with prerelease and build', () => {
      const v = parse('1.2.3-alpha.1+build.123');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
      expect(v.prerelease).toEqual(['alpha', '1']);
      expect(v.build).toEqual(['build', '123']);
    });

    it('should parse versions with v prefix', () => {
      const v = parse('v1.2.3');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
    });

    it('should reject invalid versions', () => {
      expect(() => parse('invalid')).toThrow();
      expect(() => parse('1.2')).toThrow();
      expect(() => parse('1')).toThrow();
    });
  });

  describe('parseConstraint', () => {
    it('should parse exact versions', () => {
      const c = parseConstraint('1.2.3');
      expect(c.ranges).toHaveLength(1);
      expect(c.ranges[0].operator).toBe('exact');
      expect(c.ranges[0].version.major).toBe(1);
    });

    it('should parse caret ranges', () => {
      const c = parseConstraint('^1.2.3');
      expect(c.ranges).toHaveLength(1);
      expect(c.ranges[0].operator).toBe('caret');
    });

    it('should parse tilde ranges', () => {
      const c = parseConstraint('~1.2.3');
      expect(c.ranges).toHaveLength(1);
      expect(c.ranges[0].operator).toBe('tilde');
    });

    it('should parse comparison operators', () => {
      let c = parseConstraint('>=1.2.3');
      expect(c.ranges[0].operator).toBe('>=');

      c = parseConstraint('>1.2.3');
      expect(c.ranges[0].operator).toBe('>');

      c = parseConstraint('<=1.2.3');
      expect(c.ranges[0].operator).toBe('<=');

      c = parseConstraint('<1.2.3');
      expect(c.ranges[0].operator).toBe('<');
    });

    it('should parse OR ranges', () => {
      const c = parseConstraint('^1.0.0 || ^2.0.0');
      expect(c.ranges).toHaveLength(2);
      expect(c.ranges[0].operator).toBe('caret');
      expect(c.ranges[1].operator).toBe('caret');
    });

    it('should parse wildcard ranges', () => {
      const c = parseConstraint('1.*');
      expect(c.ranges[0].operator).toBe('wildcard');
    });
  });

  describe('compare', () => {
    it('should compare major versions', () => {
      const v1 = parse('1.0.0');
      const v2 = parse('2.0.0');
      expect(compare(v1, v2)).toBe(-1);
      expect(compare(v2, v1)).toBe(1);
    });

    it('should compare minor versions', () => {
      const v1 = parse('1.0.0');
      const v2 = parse('1.1.0');
      expect(compare(v1, v2)).toBe(-1);
      expect(compare(v2, v1)).toBe(1);
    });

    it('should compare patch versions', () => {
      const v1 = parse('1.0.0');
      const v2 = parse('1.0.1');
      expect(compare(v1, v2)).toBe(-1);
      expect(compare(v2, v1)).toBe(1);
    });

    it('should compare prerelease versions', () => {
      const v1 = parse('1.0.0-alpha.1');
      const v2 = parse('1.0.0');
      expect(compare(v1, v2)).toBe(-1);
      expect(compare(v2, v1)).toBe(1);
    });

    it('should compare equal versions', () => {
      const v1 = parse('1.2.3');
      const v2 = parse('1.2.3');
      expect(compare(v1, v2)).toBe(0);
    });

    it('should ignore build metadata', () => {
      const v1 = parse('1.2.3+build.123');
      const v2 = parse('1.2.3+build.456');
      expect(compare(v1, v2)).toBe(0);
    });
  });

  describe('compareStrings', () => {
    it('should compare version strings', () => {
      expect(compareStrings('1.0.0', '2.0.0')).toBe(-1);
      expect(compareStrings('2.0.0', '1.0.0')).toBe(1);
      expect(compareStrings('1.0.0', '1.0.0')).toBe(0);
    });
  });

  describe('greaterThan', () => {
    it('should return true for greater versions', () => {
      expect(greaterThan('2.0.0', '1.0.0')).toBe(true);
      expect(greaterThan('1.2.0', '1.1.0')).toBe(true);
      expect(greaterThan('1.2.3', '1.2.2')).toBe(true);
    });

    it('should return false for equal or lesser versions', () => {
      expect(greaterThan('1.0.0', '1.0.0')).toBe(false);
      expect(greaterThan('1.0.0', '2.0.0')).toBe(false);
    });
  });

  describe('lessThan', () => {
    it('should return true for lesser versions', () => {
      expect(lessThan('1.0.0', '2.0.0')).toBe(true);
      expect(lessThan('1.1.0', '1.2.0')).toBe(true);
      expect(lessThan('1.2.2', '1.2.3')).toBe(true);
    });

    it('should return false for equal or greater versions', () => {
      expect(lessThan('1.0.0', '1.0.0')).toBe(false);
      expect(lessThan('2.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal versions', () => {
      expect(equals('1.0.0', '1.0.0')).toBe(true);
      expect(equals('1.2.3-alpha.1', '1.2.3-alpha.1')).toBe(true);
    });

    it('should return false for different versions', () => {
      expect(equals('1.0.0', '2.0.0')).toBe(false);
    });

    it('should ignore build metadata', () => {
      expect(equals('1.2.3+build.123', '1.2.3+build.456')).toBe(true);
    });
  });

  describe('increment', () => {
    it('should increment major version', () => {
      expect(increment('1.2.3', 'major')).toBe('2.0.0');
    });

    it('should increment minor version', () => {
      expect(increment('1.2.3', 'minor')).toBe('1.3.0');
    });

    it('should increment patch version', () => {
      expect(increment('1.2.3', 'patch')).toBe('1.2.4');
    });
  });

  describe('incrementMajor', () => {
    it('should increment major version', () => {
      expect(incrementMajor('1.2.3')).toBe('2.0.0');
    });
  });

  describe('incrementMinor', () => {
    it('should increment minor version', () => {
      expect(incrementMinor('1.2.3')).toBe('1.3.0');
    });
  });

  describe('incrementPatch', () => {
    it('should increment patch version', () => {
      expect(incrementPatch('1.2.3')).toBe('1.2.4');
    });
  });

  describe('satisfies', () => {
    describe('caret ranges', () => {
      it('should match ^1.0.0 correctly', () => {
        expect(satisfies('1.0.0', '^1.0.0')).toBe(true);
        expect(satisfies('1.2.3', '^1.0.0')).toBe(true);
        expect(satisfies('2.0.0', '^1.0.0')).toBe(false);
      });

      it('should match ^1.2.3 correctly', () => {
        expect(satisfies('1.2.3', '^1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '^1.2.3')).toBe(true);
        expect(satisfies('1.3.0', '^1.2.3')).toBe(true);
        expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
      });

      it('should handle ^0.x.y correctly', () => {
        expect(satisfies('0.1.0', '^0.1.0')).toBe(true);
        expect(satisfies('0.1.1', '^0.1.0')).toBe(true);
        expect(satisfies('0.2.0', '^0.1.0')).toBe(false);
      });
    });

    describe('tilde ranges', () => {
      it('should match ~1.0.0 correctly', () => {
        expect(satisfies('1.0.0', '~1.0.0')).toBe(true);
        expect(satisfies('1.0.1', '~1.0.0')).toBe(true);
        expect(satisfies('1.1.0', '~1.0.0')).toBe(false);
      });

      it('should match ~1.2.0 correctly', () => {
        expect(satisfies('1.2.0', '~1.2.0')).toBe(true);
        expect(satisfies('1.2.1', '~1.2.0')).toBe(true);
        expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
      });
    });

    describe('comparison operators', () => {
      it('should match >= correctly', () => {
        expect(satisfies('1.2.3', '>=1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '>=1.2.3')).toBe(true);
        expect(satisfies('1.2.2', '>=1.2.3')).toBe(false);
      });

      it('should match > correctly', () => {
        expect(satisfies('1.2.4', '>1.2.3')).toBe(true);
        expect(satisfies('1.2.3', '>1.2.3')).toBe(false);
      });

      it('should match <= correctly', () => {
        expect(satisfies('1.2.3', '<=1.2.3')).toBe(true);
        expect(satisfies('1.2.2', '<=1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '<=1.2.3')).toBe(false);
      });

      it('should match < correctly', () => {
        expect(satisfies('1.2.2', '<1.2.3')).toBe(true);
        expect(satisfies('1.2.3', '<1.2.3')).toBe(false);
      });
    });

    describe('exact versions', () => {
      it('should match exact versions', () => {
        expect(satisfies('1.2.3', '1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '1.2.3')).toBe(false);
      });
    });

    describe('OR ranges', () => {
      it('should match OR ranges', () => {
        expect(satisfies('1.2.3', '^1.0.0 || ^2.0.0')).toBe(true);
        expect(satisfies('2.0.0', '^1.0.0 || ^2.0.0')).toBe(true);
        expect(satisfies('3.0.0', '^1.0.0 || ^2.0.0')).toBe(false);
      });
    });
  });

  describe('maxSatisfying', () => {
    it('should return max satisfying version', () => {
      const versions = ['1.0.0', '1.2.0', '2.0.0'];
      expect(maxSatisfying(versions, '^1.0.0')).toBe('1.2.0');
      expect(maxSatisfying(versions, '^2.0.0')).toBe('2.0.0');
    });

    it('should return null if no version satisfies', () => {
      const versions = ['1.0.0', '1.2.0'];
      expect(maxSatisfying(versions, '^2.0.0')).toBeNull();
    });
  });

  describe('minSatisfying', () => {
    it('should return min satisfying version', () => {
      const versions = ['1.0.0', '1.2.0', '2.0.0'];
      expect(minSatisfying(versions, '^1.0.0')).toBe('1.0.0');
      expect(minSatisfying(versions, '^2.0.0')).toBe('2.0.0');
    });

    it('should return null if no version satisfies', () => {
      const versions = ['1.0.0', '1.2.0'];
      expect(minSatisfying(versions, '^2.0.0')).toBeNull();
    });
  });

  describe('valid', () => {
    it('should validate correct versions', () => {
      expect(valid('1.2.3')).toBe(true);
      expect(valid('1.2.3-alpha.1')).toBe(true);
      expect(valid('1.2.3+build.123')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(valid('invalid')).toBe(false);
      expect(valid('1.2')).toBe(false);
      expect(valid('1')).toBe(false);
    });
  });

  describe('validConstraint', () => {
    it('should validate correct constraints', () => {
      expect(validConstraint('^1.0.0')).toBe(true);
      expect(validConstraint('~1.2.3')).toBe(true);
      expect(validConstraint('>=1.0.0')).toBe(true);
    });

    it('should reject invalid constraints', () => {
      expect(validConstraint('invalid')).toBe(false);
    });
  });

  describe('format', () => {
    it('should format basic version', () => {
      const v: any = { major: 1, minor: 2, patch: 3, prerelease: [], build: [], raw: '' };
      expect(format(v)).toBe('1.2.3');
    });

    it('should format version with prerelease', () => {
      const v: any = { major: 1, minor: 2, patch: 3, prerelease: ['alpha', '1'], build: [], raw: '' };
      expect(format(v)).toBe('1.2.3-alpha.1');
    });
  });

  describe('clean', () => {
    it('should remove prerelease and build', () => {
      expect(clean('1.2.3-alpha.1+build.123')).toBe('1.2.3');
      expect(clean('1.2.3+build.123')).toBe('1.2.3');
    });
  });

  describe('rsort', () => {
    it('should sort in descending order', () => {
      const versions = ['1.0.0', '1.2.3', '2.0.0', '1.2.0'];
      const sorted = rsort(versions);
      expect(sorted).toEqual(['2.0.0', '1.2.3', '1.2.0', '1.0.0']);
    });
  });

  describe('sort', () => {
    it('should sort in ascending order', () => {
      const versions = ['1.2.3', '1.0.0', '2.0.0', '1.2.0'];
      const sorted = sort(versions);
      expect(sorted).toEqual(['1.0.0', '1.2.0', '1.2.3', '2.0.0']);
    });
  });

  describe('unique', () => {
    it('should deduplicate and keep highest', () => {
      const versions = ['1.2.3', '1.0.0', '2.0.0', '1.2.3', '1.0.0'];
      const uniqueVersions = unique(versions);
      expect(uniqueVersions).toEqual(['2.0.0', '1.2.3', '1.0.0']);
    });
  });

  describe('isPrerelease', () => {
    it('should detect prerelease versions', () => {
      expect(isPrerelease('1.2.3-alpha.1')).toBe(true);
      expect(isPrerelease('1.2.3')).toBe(false);
    });
  });

  describe('getPrerelease', () => {
    it('should return prerelease identifier', () => {
      expect(getPrerelease('1.2.3-alpha.1')).toBe('alpha.1');
      expect(getPrerelease('1.2.3')).toBe('');
    });
  });

  describe('compareIdentifiers', () => {
    it('should compare numeric identifiers', () => {
      expect(compareIdentifiers('1', '2')).toBeLessThan(0);
      expect(compareIdentifiers('2', '1')).toBeGreaterThan(0);
      expect(compareIdentifiers('1', '1')).toBe(0);
    });

    it('should compare string identifiers', () => {
      expect(compareIdentifiers('alpha', 'beta')).toBeLessThan(0);
      expect(compareIdentifiers('beta', 'alpha')).toBeGreaterThan(0);
      expect(compareIdentifiers('alpha', 'alpha')).toBe(0);
    });

    it('should treat numbers as less than strings', () => {
      expect(compareIdentifiers('1', 'alpha')).toBeLessThan(0);
      expect(compareIdentifiers('alpha', '1')).toBeGreaterThan(0);
    });
  });
});
