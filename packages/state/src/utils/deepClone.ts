/**
 * Deep clone utility for immutable state updates
 * Uses structuredClone for optimal performance
 */

/**
 * Deep clone a value
 * Uses structuredClone when available (browser/node >= 17)
 * Falls back to JSON parse/stringify for basic types
 */
export function deepClone<T>(value: T): T {
  // Use structuredClone for best performance and broad type support
  if (typeof structuredClone !== "undefined") {
    return structuredClone(value);
  }

  // Fallback for older environments
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Check if a value is deeply immutable (primitive or frozen)
 */
export function isImmutable(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  const type = typeof value;
  if (type !== "object") {
    return true;
  }

  // Check if object is frozen
  try {
    return Object.isFrozen(value);
  } catch {
    return false;
  }
}

/**
 * Freeze an object recursively to make it immutable
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  const type = typeof obj;
  if (type !== "object") {
    return obj;
  }

  // Don't freeze Date, RegExp, etc.
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj;
  }

  // Freeze arrays and objects
  Object.freeze(obj);

  // Recursively freeze nested properties
  for (const value of Object.values(obj)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
