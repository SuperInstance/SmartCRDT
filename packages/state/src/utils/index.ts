/**
 * @lsi/state - Utilities
 *
 * Utility functions for state management
 */

export { deepClone, isImmutable, deepFreeze } from "./deepClone.js";
export { deepMerge, deepMergeMany, deepEqual } from "./deepMerge.js";
export {
  getByPath,
  setByPath,
  updateByPath,
  deleteByPath,
  hasPath,
  getPaths,
} from "./pathSelector.js";
