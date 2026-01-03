/**
 * @lsi/a2ui - Agent-to-User Interface Protocol Implementation
 *
 * A2UI enables AI agents to generate safe, declarative UIs using:
 * - React 19 renderer with streaming support
 * - Intent-aware UI generation via IntentEncoder
 * - Component catalog with security policies
 * - Personalized interfaces based on user feedback
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

// ============================================================================
// RENDERER EXPORTS
// ============================================================================

export {
  A2UIRenderer,
  A2UIStreamingRenderer,
  A2UIErrorBoundary,
  useA2UIRender,
  useA2UIStreaming,
} from "./renderer/index.js";

export {
  createComponentCatalog,
  extendCatalog,
  getComponentEntry,
  isComponentTypeValid,
  getComponentsByCategory,
  STANDARD_COMPONENTS,
  DEFAULT_SECURITY_POLICY,
  PropSchemas,
} from "./renderer/ComponentCatalog.js";

export { DefaultComponents } from "./renderer/DefaultComponents.js";

// ============================================================================
// INTEGRATION EXPORTS
// ============================================================================

export {
  IntentEncoderBridge,
  createIntentEncoderBridge,
} from "./integration/IntentEncoderBridge.js";

export {
  IntentToUIMapper,
  createIntentToUIMapper,
  INTENT_DIMENSIONS,
  INTENT_PATTERNS,
} from "./integration/IntentToUIMapper.js";

// ============================================================================
// AGENT EXPORTS
// ============================================================================

export { A2UIAgent, createA2UIAgent } from "./agents/A2UIAgent.js";

export { UIRequirementAnalyzer } from "./agents/UIRequirementAnalyzer.js";

export {
  ComponentSelector,
  createComponentSelector,
} from "./agents/ComponentSelector.js";

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Renderer types
  A2UIRendererProps,
  A2UIStreamingRendererProps,
  UseA2UIRenderOptions,
  RenderContext,
  // Integration types
  IntentEncoderBridgeConfig,
  IntentToUIContext,
  IntentBasedUIOptions,
  IntentDimension,
  IntentPattern,
  MappingContext,
  UIRequirementHistory,
  UserProfile,
  // Agent types
  A2UIAgentConfig,
  GenerationOptions,
  StreamingContext,
  UIRequirementAnalyzerConfig,
  ComponentSelectorConfig,
};

// Re-export from @lsi/protocol
export type {
  A2UIResponse,
  A2UIComponent,
  A2UILayout,
  A2UIAction,
  A2UIUpdate,
  ComponentCatalog,
  ComponentCatalogEntry,
  UIRequirements,
  UIFeedback,
  A2UIContext,
} from "@lsi/protocol";
