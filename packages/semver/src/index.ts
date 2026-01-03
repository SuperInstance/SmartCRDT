/**
 * @lsi/semver - Semantic Versioning Utilities
 *
 * Provides comprehensive SemVer 2.0.0 support for the Aequor platform.
 * Includes parsing, comparison, constraint satisfaction, and range matching.
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Semantic version structure
 *
 * Format: MAJOR.MINOR.PATCH-PRERELEASE+BUILD
 * Example: 1.2.3-alpha.1+build.123
 */
export interface Semver {
  /** Major version (incompatible API changes) */
  major: number;
  /** Minor version (backwards-compatible functionality) */
  minor: number;
  /** Patch version (backwards-compatible bug fixes) */
  patch: number;
  /** Prerelease identifier (e.g., "alpha.1", "beta.2") */
  prerelease: string[];
  /** Build metadata (ignored for comparisons) */
  build: string[];
  /** Original version string */
  raw: string;
}

/**
 * Range operators for version constraints
 */
export type RangeOperator =
  | 'exact'        // 1.2.3
  | 'caret'        // ^1.2.3
  | 'tilde'        // ~1.2.3
  | '>='           // >=1.2.3
  | '>'            // >1.2.3
  | '<='           // <=1.2.3
  | '<'            // <1.2.3
  | 'wildcard';    // 1.*, 1.x, *

/**
 * Single version range
 */
export interface SemverRange {
  operator: RangeOperator;
  version: Semver;
}

/**
 * Version constraint (disjunction of ranges)
 *
 * Example: "^1.0.0 || ^2.0.0"
 */
export interface VersionConstraint {
  ranges: SemverRange[];
  raw: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum safe integer in JavaScript */
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/** Regex for parsing semantic versions */
const SEMVER_REGEX =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** Regex for parsing range operators */
const OPERATOR_REGEX = /^(?:[\^~]|>=|>|<=|<|=)?\s*v?(\d+(?:\.\d+)*(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?)?(?:\.\*)?$/;

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse a semantic version string into a Semver object
 *
 * @param version - Version string to parse (e.g., "1.2.3-alpha.1+build.123")
 * @returns Parsed Semver object
 * @throws {Error} If version string is invalid
 *
 * @example
 * ```typescript
 * parse("1.2.3");
 * // { major: 1, minor: 2, patch: 3, prerelease: [], build: [], raw: "1.2.3" }
 *
 * parse("2.0.0-alpha.1+build.123");
 * // { major: 2, minor: 0, patch: 0, prerelease: ["alpha", "1"], build: ["build", "123"], raw: "2.0.0-alpha.1+build.123" }
 * ```
 */
export function parse(version: string): Semver {
  if (!version || typeof version !== 'string') {
    throw new Error(`Invalid version string: ${version}`);
  }

  const match = version.trim().match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid semver string: ${version}`);
  }

  const [, major, minor, patch, prerelease, build] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split('.') : [],
    build: build ? build.split('.') : [],
    raw: version.trim(),
  };
}

/**
 * Parse a version constraint string
 *
 * @param constraint - Constraint string (e.g., "^1.2.3", "~1.2.3", ">=1.0.0")
 * @returns Parsed VersionConstraint object
 * @throws {Error} If constraint string is invalid
 *
 * @example
 * ```typescript
 * parseConstraint("^1.2.3");
 * // { ranges: [{ operator: 'caret', version: { major: 1, minor: 2, patch: 3, ... } }], raw: "^1.2.3" }
 *
 * parseConstraint("^1.0.0 || ^2.0.0");
 * // { ranges: [...], raw: "^1.0.0 || ^2.0.0" }
 * ```
 */
export function parseConstraint(constraint: string): VersionConstraint {
  if (!constraint || typeof constraint !== 'string') {
    throw new Error(`Invalid constraint string: ${constraint}`);
  }

  const trimmed = constraint.trim();

  // Handle OR (||) operator
  const orParts = trimmed.split('||').map(s => s.trim());
  const ranges: SemverRange[] = [];

  for (const part of orParts) {
    ranges.push(parseRange(part));
  }

  return { ranges, raw: trimmed };
}

/**
 * Parse a single version range
 *
 * @param range - Range string (e.g., "^1.2.3", ">=1.0.0")
 * @returns Parsed SemverRange object
 * @throws {Error} If range string is invalid
 *
 * @example
 * ```typescript
 * parseRange("^1.2.3");
 * // { operator: 'caret', version: { major: 1, minor: 2, patch: 3, ... } }
 *
 * parseRange(">=1.0.0");
 * // { operator: '>=', version: { major: 1, minor: 0, patch: 0, ... } }
 * ```
 */
function parseRange(range: string): SemverRange {
  const trimmed = range.trim();

  // Handle caret (^)
  if (trimmed.startsWith('^')) {
    const versionStr = trimmed.slice(1);
    const version = parse(versionStr);
    return { operator: 'caret', version };
  }

  // Handle tilde (~)
  if (trimmed.startsWith('~')) {
    const versionStr = trimmed.slice(1);
    const version = parse(versionStr);
    return { operator: 'tilde', version };
  }

  // Handle comparison operators (>=, >, <=, <, =)
  const comparisonMatch = trimmed.match(/^([><=!]+)\s*(.+)$/);
  if (comparisonMatch) {
    const [, operator, versionStr] = comparisonMatch;
    const version = parse(versionStr);

    // Normalize operator
    let normalizedOperator: RangeOperator;
    switch (operator) {
      case '>=':
      case '>':
      case '<=':
      case '<':
      case '=':
        normalizedOperator = operator as RangeOperator;
        break;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }

    return { operator: normalizedOperator, version };
  }

  // Handle wildcard (1.*, 1.x)
  const wildcardMatch = trimmed.match(/^(\d+)\.([x*])$/);
  if (wildcardMatch) {
    const version = parse(`${wildcardMatch[1]}.0.0`);
    return { operator: 'wildcard', version };
  }

  const wildcardMatchMinor = trimmed.match(/^(\d+)\.(\d+)\.([x*])$/);
  if (wildcardMatchMinor) {
    const version = parse(`${wildcardMatchMinor[1]}.${wildcardMatchMinor[2]}.0`);
    return { operator: 'wildcard', version };
  }

  // Handle exact version (no operator)
  const version = parse(trimmed);
  return { operator: 'exact', version };
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Compare two semantic versions
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 *
 * @example
 * ```typescript
 * compare(parse("1.2.3"), parse("1.2.4")); // -1
 * compare(parse("1.2.3"), parse("1.2.3")); // 0
 * compare(parse("2.0.0"), parse("1.9.9")); // 1
 * ```
 */
export function compare(v1: Semver, v2: Semver): number {
  // Compare major
  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }

  // Compare minor
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }

  // Compare patch
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }

  // Compare prerelease
  const v1HasPrerelease = v1.prerelease.length > 0;
  const v2HasPrerelease = v2.prerelease.length > 0;

  // Versions with prerelease are lower than without
  if (v1HasPrerelease && !v2HasPrerelease) {
    return -1;
  }
  if (!v1HasPrerelease && v2HasPrerelease) {
    return 1;
  }

  // Compare prerelease identifiers
  const maxLength = Math.max(v1.prerelease.length, v2.prerelease.length);
  for (let i = 0; i < maxLength; i++) {
    const p1 = v1.prerelease[i];
    const p2 = v2.prerelease[i];

    // Missing identifiers are lower
    if (p1 === undefined && p2 === undefined) {
      break;
    }
    if (p1 === undefined) {
      return -1;
    }
    if (p2 === undefined) {
      return 1;
    }

    // Numeric identifiers compare numerically
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    if (!isNaN(n1) && !isNaN(n2)) {
      if (n1 !== n2) {
        return n1 > n2 ? 1 : -1;
      }
    } else {
      // String identifiers compare lexicographically
      if (p1 !== p2) {
        return p1 > p2 ? 1 : -1;
      }
    }
  }

  // Versions are equal (build metadata is ignored)
  return 0;
}

/**
 * Compare two version strings
 *
 * @param v1 - First version string
 * @param v2 - Second version string
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 *
 * @example
 * ```typescript
 * compareStrings("1.2.3", "1.2.4"); // -1
 * compareStrings("2.0.0", "1.9.9"); // 1
 * ```
 */
export function compareStrings(v1: string, v2: string): number {
  return compare(parse(v1), parse(v2));
}

/**
 * Check if version v1 is greater than v2
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 > v2
 */
export function greaterThan(v1: Semver | string, v2: Semver | string): boolean {
  const s1 = typeof v1 === 'string' ? parse(v1) : v1;
  const s2 = typeof v2 === 'string' ? parse(v2) : v2;
  return compare(s1, s2) > 0;
}

/**
 * Check if version v1 is less than v2
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 < v2
 */
export function lessThan(v1: Semver | string, v2: Semver | string): boolean {
  const s1 = typeof v1 === 'string' ? parse(v1) : v1;
  const s2 = typeof v2 === 'string' ? parse(v2) : v2;
  return compare(s1, s2) < 0;
}

/**
 * Check if version v1 equals v2
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 === v2
 */
export function equals(v1: Semver | string, v2: Semver | string): boolean {
  const s1 = typeof v1 === 'string' ? parse(v1) : v1;
  const s2 = typeof v2 === 'string' ? parse(v2) : v2;
  return compare(s1, s2) === 0;
}

/**
 * Check if version v1 is greater than or equal to v2
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 >= v2
 */
export function greaterThanOrEqual(v1: Semver | string, v2: Semver | string): boolean {
  const s1 = typeof v1 === 'string' ? parse(v1) : v1;
  const s2 = typeof v2 === 'string' ? parse(v2) : v2;
  return compare(s1, s2) >= 0;
}

/**
 * Check if version v1 is less than or equal to v2
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 <= v2
 */
export function lessThanOrEqual(v1: Semver | string, v2: Semver | string): boolean {
  const s1 = typeof v1 === 'string' ? parse(v1) : v1;
  const s2 = typeof v2 === 'string' ? parse(v2) : v2;
  return compare(s1, s2) <= 0;
}

// ============================================================================
// INCREMENTING
// ============================================================================

/**
 * Increment a version by the specified part
 *
 * @param version - Version to increment
 * @param part - Part to increment ('major', 'minor', or 'patch')
 * @returns Incremented version string
 *
 * @example
 * ```typescript
 * increment("1.2.3", "patch");   // "1.2.4"
 * increment("1.2.3", "minor");   // "1.3.0"
 * increment("1.2.3", "major");   // "2.0.0"
 * ```
 */
export function increment(version: string | Semver, part: 'major' | 'minor' | 'patch'): string {
  const v = typeof version === 'string' ? parse(version) : version;

  const incremented: Semver = {
    major: v.major,
    minor: v.minor,
    patch: v.patch,
    prerelease: [],
    build: [],
    raw: '',
  };

  switch (part) {
    case 'major':
      incremented.major = v.major + 1;
      incremented.minor = 0;
      incremented.patch = 0;
      break;
    case 'minor':
      incremented.minor = v.minor + 1;
      incremented.patch = 0;
      break;
    case 'patch':
      incremented.patch = v.patch + 1;
      break;
  }

  incremented.raw = format(incremented);
  return incremented.raw;
}

/**
 * Increment the major version and reset minor/patch to 0
 *
 * @param version - Version to increment
 * @returns Next major version string
 *
 * @example
 * ```typescript
 * incrementMajor("1.2.3"); // "2.0.0"
 * ```
 */
export function incrementMajor(version: string | Semver): string {
  return increment(version, 'major');
}

/**
 * Increment the minor version and reset patch to 0
 *
 * @param version - Version to increment
 * @returns Next minor version string
 *
 * @example
 * ```typescript
 * incrementMinor("1.2.3"); // "1.3.0"
 * ```
 */
export function incrementMinor(version: string | Semver): string {
  return increment(version, 'minor');
}

/**
 * Increment the patch version
 *
 * @param version - Version to increment
 * @returns Next patch version string
 *
 * @example
 * ```typescript
 * incrementPatch("1.2.3"); // "1.2.4"
 * ```
 */
export function incrementPatch(version: string | Semver): string {
  return increment(version, 'patch');
}

// ============================================================================
// SATISFACTION
// ============================================================================

/**
 * Check if a version satisfies a constraint
 *
 * @param version - Version string to check
 * @param constraint - Constraint string
 * @returns true if version satisfies constraint
 *
 * @example
 * ```typescript
 * satisfies("1.2.3", "^1.0.0"); // true
 * satisfies("2.0.0", "^1.0.0"); // false
 * satisfies("1.2.3", "~1.2.0"); // true
 * satisfies("1.3.0", "~1.2.0"); // false
 * satisfies("1.2.3", ">=1.0.0"); // true
 * satisfies("0.9.0", ">=1.0.0"); // false
 * ```
 */
export function satisfies(version: string, constraint: string): boolean {
  const v = parse(version);
  const c = parseConstraint(constraint);

  // Check if version satisfies ANY range (OR logic)
  return c.ranges.some(range => satisfiesRange(v, range));
}

/**
 * Check if a version satisfies a single range
 *
 * @param version - Version to check
 * @param range - Range to check against
 * @returns true if version satisfies range
 */
function satisfiesRange(version: Semver, range: SemverRange): boolean {
  switch (range.operator) {
    case 'exact':
      return compare(version, range.version) === 0;

    case 'caret': {
      // ^1.2.3 -> >=1.2.3 <2.0.0
      // ^0.2.3 -> >=0.2.3 <0.3.0
      // ^0.0.3 -> >=0.0.3 <0.0.4
      const base = range.version;

      if (compare(version, base) < 0) {
        return false;
      }

      // If major is 0, caret behaves like tilde
      if (base.major === 0) {
        if (base.minor === 0) {
          // ^0.0.x -> >=0.0.x <0.0.(x+1)
          return version.major === 0 && version.minor === 0 && version.patch === base.patch;
        } else {
          // ^0.x.y -> >=0.x.y <0.(x+1).0
          return version.major === 0 && version.minor === base.minor;
        }
      }

      // Normal case: ^1.2.3 -> <2.0.0
      return version.major === base.major;
    }

    case 'tilde': {
      // ~1.2.3 -> >=1.2.3 <1.3.0
      // ~1.2 -> >=1.2.0 <1.3.0
      // ~1 -> >=1.0.0 <2.0.0
      const base = range.version;

      if (compare(version, base) < 0) {
        return false;
      }

      if (base.minor === 0 && base.patch === 0) {
        // ~1 -> >=1.0.0 <2.0.0
        return version.major === base.major;
      }

      return version.major === base.major && version.minor === base.minor;
    }

    case '>=':
      return compare(version, range.version) >= 0;

    case '>':
      return compare(version, range.version) > 0;

    case '<=':
      return compare(version, range.version) <= 0;

    case '<':
      return compare(version, range.version) < 0;

    case 'wildcard': {
      // 1.* -> >=1.0.0 <2.0.0
      // 1.2.* -> >=1.2.0 <1.3.0
      const base = range.version;

      if (base.minor === 0 && base.patch === 0) {
        // 1.* -> <2.0.0
        return version.major === base.major;
      }

      // 1.2.* -> <1.3.0
      return version.major === base.major && version.minor === base.minor;
    }

    default:
      throw new Error(`Unknown operator: ${(range as any).operator}`);
  }
}

/**
 * Find the maximum version that satisfies a constraint
 *
 * @param versions - Array of version strings
 * @param constraint - Constraint string
 * @returns Maximum satisfying version, or null if none
 *
 * @example
 * ```typescript
 * maxSatisfying(["1.0.0", "1.2.0", "2.0.0"], "^1.0.0"); // "1.2.0"
 * maxSatisfying(["1.0.0", "1.2.0", "2.0.0"], "^2.0.0"); // "2.0.0"
 * maxSatisfying(["1.0.0", "1.2.0", "2.0.0"], "^3.0.0"); // null
 * ```
 */
export function maxSatisfying(versions: string[], constraint: string): string | null {
  const satisfying = versions.filter(v => satisfies(v, constraint));

  if (satisfying.length === 0) {
    return null;
  }

  // Sort descending and return first
  satisfying.sort((a, b) => compareStrings(b, a));
  return satisfying[0];
}

/**
 * Find the minimum version that satisfies a constraint
 *
 * @param versions - Array of version strings
 * @param constraint - Constraint string
 * @returns Minimum satisfying version, or null if none
 *
 * @example
 * ```typescript
 * minSatisfying(["1.0.0", "1.2.0", "2.0.0"], "^1.0.0"); // "1.0.0"
 * minSatisfying(["1.0.0", "1.2.0", "2.0.0"], "^2.0.0"); // "2.0.0"
 * ```
 */
export function minSatisfying(versions: string[], constraint: string): string | null {
  const satisfying = versions.filter(v => satisfies(v, constraint));

  if (satisfying.length === 0) {
    return null;
  }

  // Sort ascending and return first
  satisfying.sort((a, b) => compareStrings(a, b));
  return satisfying[0];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if a string is a valid semantic version
 *
 * @param version - String to validate
 * @returns true if valid semver string
 *
 * @example
 * ```typescript
 * valid("1.2.3");           // true
 * valid("2.0.0-alpha.1");   // true
 * valid("invalid");         // false
 * valid("1.2");             // false
 * ```
 */
export function valid(version: string): boolean {
  try {
    parse(version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid version constraint
 *
 * @param constraint - String to validate
 * @returns true if valid constraint string
 *
 * @example
 * ```typescript
 * validConstraint("^1.0.0");     // true
 * validConstraint("~1.2.3");     // true
 * validConstraint(">=1.0.0");    // true
 * validConstraint("invalid");    // false
 * ```
 */
export function validConstraint(constraint: string): boolean {
  try {
    parseConstraint(constraint);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format a Semver object as a string
 *
 * @param version - Semver object
 * @returns Version string
 *
 * @example
 * ```typescript
 * format({ major: 1, minor: 2, patch: 3, prerelease: [], build: [], raw: "" });
 * // "1.2.3"
 *
 * format({ major: 2, minor: 0, patch: 0, prerelease: ["alpha", "1"], build: ["build"], raw: "" });
 * // "2.0.0-alpha.1"
 * ```
 */
export function format(version: Semver): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;

  if (version.prerelease.length > 0) {
    result += `-${version.prerelease.join('.')}`;
  }

  // Build metadata is typically excluded from formatted output
  // (it's ignored for comparisons per SemVer spec)

  return result;
}

/**
 * Clean a version string by removing build metadata and prerelease
 *
 * @param version - Version string to clean
 * @returns Cleaned version string
 *
 * @example
 * ```typescript
 * clean("1.2.3-alpha.1+build.123"); // "1.2.3"
 * clean("2.0.0+build.456");          // "2.0.0"
 * ```
 */
export function clean(version: string): string {
  const v = parse(version);
  return format({ ...v, prerelease: [], build: [] });
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort an array of version strings in descending order (newest first)
 *
 * @param versions - Array of version strings
 * @returns Sorted array (descending)
 *
 * @example
 * ```typescript
 * rsort(["1.2.3", "1.0.0", "2.0.0", "1.2.0"]);
 * // ["2.0.0", "1.2.3", "1.2.0", "1.0.0"]
 * ```
 */
export function rsort(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareStrings(b, a));
}

/**
 * Sort an array of version strings in ascending order (oldest first)
 *
 * @param versions - Array of version strings
 * @returns Sorted array (ascending)
 *
 * @example
 * ```typescript
 * sort(["1.2.3", "1.0.0", "2.0.0", "1.2.0"]);
 * // ["1.0.0", "1.2.0", "1.2.3", "2.0.0"]
 * ```
 */
export function sort(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareStrings(a, b));
}

/**
 * Deduplicate an array of version strings, keeping the highest version
 *
 * @param versions - Array of version strings
 * @returns Deduplicated array (descending)
 *
 * @example
 * ```typescript
 * unique(["1.2.3", "1.0.0", "2.0.0", "1.2.3", "1.0.0"]);
 * // ["2.0.0", "1.2.3", "1.0.0"]
 * ```
 */
export function unique(versions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const version of rsort(versions)) {
    // Use major.minor.patch as key (ignore prerelease/build)
    const v = parse(version);
    const key = `${v.major}.${v.minor}.${v.patch}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(version);
    }
  }

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a version is a prerelease
 *
 * @param version - Version string
 * @returns true if version has prerelease identifiers
 *
 * @example
 * ```typescript
 * isPrerelease("1.2.3-alpha.1"); // true
 * isPrerelease("1.2.3");         // false
 * ```
 */
export function isPrerelease(version: string): boolean {
  try {
    const v = parse(version);
    return v.prerelease.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the prerelease identifier from a version
 *
 * @param version - Version string
 * @returns Prerelease identifier, or empty string if none
 *
 * @example
 * ```typescript
 * getPrerelease("1.2.3-alpha.1"); // "alpha.1"
 * getPrerelease("1.2.3");         // ""
 * ```
 */
export function getPrerelease(version: string): string {
  try {
    const v = parse(version);
    return v.prerelease.join('.');
  } catch {
    return '';
  }
}

/**
 * Compare two version identifiers (for prerelease comparison)
 *
 * @param a - First identifier
 * @param b - Second identifier
 * @returns Comparison result
 *
 * @example
 * ```typescript
 * compareIdentifiers("alpha", "beta");  // -1 (alpha < beta)
 * compareIdentifiers("1", "2");        // -1 (1 < 2)
 * compareIdentifiers("alpha", "1");    // 1  (strings > numbers)
 * ```
 */
export function compareIdentifiers(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);

  const aIsNum = !isNaN(na);
  const bIsNum = !isNaN(nb);

  if (aIsNum && bIsNum) {
    return na - nb;
  }

  if (aIsNum && !bIsNum) {
    return -1;
  }

  if (!aIsNum && bIsNum) {
    return 1;
  }

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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
};
