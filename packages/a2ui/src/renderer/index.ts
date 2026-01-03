/**
 * A2UI Renderer - Main export
 */

export {
  A2UIRenderer,
  A2UIStreamingRenderer,
  A2UIErrorBoundary,
} from "./A2UIRenderer.js";
export { useA2UIRender, useA2UIStreaming } from "./A2UIRenderer.js";
export {
  createComponentCatalog,
  extendCatalog,
  getComponentEntry,
  isComponentTypeValid,
  getComponentsByCategory,
  STANDARD_COMPONENTS,
  DEFAULT_SECURITY_POLICY,
  PropSchemas,
} from "./ComponentCatalog.js";
export { DefaultComponents } from "./DefaultComponents.js";

export type {
  A2UIRendererProps,
  A2UIStreamingRendererProps,
  UseA2UIRenderOptions,
} from "./A2UIRenderer.js";
