/**
 * @lsi/registry - Component Registry
 *
 * Manages modular, pullable AI infrastructure components.
 * Inspired by Ollama's model registry, npm, and Docker.
 */

export {
  ComponentRegistry,
  createComponentRegistry,
  getGlobalRegistry,
} from "./ComponentRegistry.js";

export * from "./types.js";
