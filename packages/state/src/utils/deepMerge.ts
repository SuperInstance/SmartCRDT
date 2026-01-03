/**
 * Deep merge utility for combining state objects
 */

/**
 * Deep merge two objects
 * Arrays are replaced (not merged) to avoid ambiguity
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  update: Partial<T>
): T {
  const result = { ...base };

  for (const [key, value] of Object.entries(update)) {
    const baseValue = result[key];

    // If both are objects (non-null, non-array), merge recursively
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        value as Partial<Record<string, unknown>>
      ) as T[Extract<keyof T, string>];
    } else {
      // Otherwise, just replace
      result[key] = value as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Deep merge multiple objects
 */
export function deepMergeMany<T extends Record<string, unknown>>(
  base: T,
  ...updates: Array<Partial<T>>
): T {
  return updates.reduce((acc, update) => deepMerge(acc, update), base);
}

/**
 * Check if two values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Fast path for primitives
  if (a === b) {
    return true;
  }

  // Handle null/undefined
  if (a == null || b == null) {
    return a === b;
  }

  // Check types match
  if (typeof a !== typeof b) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every(key =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}
