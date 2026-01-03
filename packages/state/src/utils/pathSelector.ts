/**
 * Path selector utilities for immutable updates by path
 * Uses dot notation: "user.profile.name"
 */

/**
 * Get a value from an object by path
 */
export function getByPath<T = unknown>(
  obj: Record<string, unknown>,
  path: string
): T {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return undefined as T;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current as T;
}

/**
 * Set a value in an object by path (immutable)
 * Returns a new object with the updated value
 */
export function setByPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  if (!lastKey) {
    return obj;
  }

  // Create a deep copy of the object
  const result: Record<string, unknown> = deepClone(obj);

  // Navigate to the parent of the target key
  let current = result;
  for (const key of keys) {
    const next = current[key];

    if (next == null || typeof next !== "object") {
      // Create missing intermediate objects
      current[key] = {};
      current = current[key] as Record<string, unknown>;
    } else {
      // Clone the intermediate object
      current[key] = deepClone(next);
      current = current[key] as Record<string, unknown>;
    }
  }

  // Set the value
  current[lastKey] = value;

  return result as T;
}

/**
 * Update a value in an object by path using a function (immutable)
 */
export function updateByPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  updater: (current: unknown) => unknown
): T {
  const currentValue = getByPath(obj, path);
  const newValue = updater(currentValue);
  return setByPath(obj, path, newValue);
}

/**
 * Delete a key from an object by path (immutable)
 */
export function deleteByPath<T extends Record<string, unknown>>(
  obj: T,
  path: string
): T {
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  if (!lastKey) {
    return obj;
  }

  // Create a deep copy of the object
  const result: Record<string, unknown> = deepClone(obj);

  // Navigate to the parent of the target key
  let current = result;
  for (const key of keys) {
    const next = current[key];

    if (next == null || typeof next !== "object") {
      // Path doesn't exist, return original
      return obj;
    }

    current[key] = deepClone(next);
    current = current[key] as Record<string, unknown>;
  }

  // Delete the key
  delete current[lastKey];

  return result as T;
}

/**
 * Check if a path exists in an object
 */
export function hasPath(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return false;
    }
    if (!(key in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

/**
 * Get all paths from an object
 */
export function getPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...getPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

// Import deepClone from sibling module
import { deepClone } from "./deepClone.js";
