/**
 * @lsi/app-registry - App Registry
 *
 * Application manifest, dependency management, and distribution system.
 */

// Export types
export * from "./types.js";

// Export AppRegistry
export {
  AppRegistry,
  createAppRegistry,
  getGlobalRegistry,
} from "./AppRegistry.js";
