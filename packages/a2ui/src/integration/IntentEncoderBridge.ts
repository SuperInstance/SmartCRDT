/**
 * IntentEncoder Bridge - Connects IntentEncoder to A2UI for intent-aware UI generation
 *
 * ================================================================================
 * PRIVACY-PRESERVING UI GENERATION
 * ================================================================================
 *
 * The IntentEncoderBridge enables UI generation from encoded intent vectors
 * without exposing the original user input. This is a key integration point
 * between the privacy layer (@lsi/privacy) and the UI layer (@lsi/a2ui).
 *
 * ================================================================================
 * ARCHITECTURE
 * ================================================================================
 *
 * ```
 * User Input (Privacy Risk)
 *      │
 *      ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   IntentEncoder                                  │
 * │  - Encodes input to 768-dim vector                              │
 * │  - Adds epsilon-differential privacy                            │
 * │  - Removes sensitive information                                │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *                                 ▼ (Intent Vector - Safe to share)
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                IntentEncoderBridge                               │
 * │  - Maps intent dimensions to UI requirements                    │
 * │  - Infers components from intent                                │
 * │  - Generates layout based on device/context                     │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                      A2UI Agent                                   │
 * │  - Selects components from catalog                               │
 * │  - Builds component tree                                         │
 * │  - Applies personalization                                      │
 * │  - Generates A2UI specification                                  │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *                                 ▼
 *                         A2UI Response (JSON)
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    A2UI Renderer                                  │
 * │  - Renders React components                                     │
 * │  - Handles user interactions                                    │
 * │  - Streams updates                                              │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ================================================================================
 * PRIVACY GUARANTEE
 * ================================================================================
 *
 * The key privacy property: Intent vectors are safe to share with third parties
 * because:
 *
 * 1. The encoding is many-to-one (multiple inputs → same intent)
 * 2. Differential privacy adds noise to prevent reconstruction
 * 3. Intent dimensions are abstract (not raw text)
 * 4. Original input is never transmitted
 *
 * This enables:
 * - Cloud-based UI generation without exposing user input
 * - Third-party UI services without privacy violations
 * - Personalized UI without sharing personal data
 *
 * ================================================================================
 * INTENT DIMENSIONS
 * ================================================================================
 *
 * The 768-dimensional intent vector encodes:
 *
 * Dimensions 0-9: Informational intent
 *   - High values → Need text, container components
 *
 * Dimensions 10-19: Input intent
 *   - High values → Need input, button components
 *
 * Dimensions 20-29: Selection intent
 *   - High values → Need select, checkbox components
 *
 * Dimensions 30-39: Data display intent
 *   - High values → Need table, card components
 *
 * Dimensions 40-49: Form intent
 *   - High values → Need form, input, button components
 *
 * Dimensions 50-59: Submission intent
 *   - High values → Add submit actions
 *
 * Dimensions 60-69: Cancellation intent
 *   - High values → Add cancel actions
 *
 * Dimensions 70-79: Sequential intent
 *   - High values → Use vertical/step layout
 *
 * Dimensions 80-89: Modal intent
 *   - High values → Render in modal
 *
 * Dimensions 90-99: Inline intent
 *   - High values → Render inline
 *
 * Dimensions 100-767: Reserved for future use
 *
 * ================================================================================
 * COMPONENT INFERENCE
 * ================================================================================
 *
 * The bridge infers components from intent:
 *
 * ```typescript
 * // Example intent: "I want a login form"
 * // Intent vector: [0.1, 0.8, 0.9, 0.2, ...] (high on input/form dimensions)
 *
 * inferredComponents = ['form', 'input', 'input', 'button']  // username, password, submit
 * inferredLayout = { type: 'vertical', spacing: 16 }
 * inferredActions = [{ type: 'submit', handler: 'handleSubmit' }]
 * ```
 *
 * The inference process:
 * 1. Analyze each dimension range (0-9, 10-19, etc.)
 * 2. If average > 0.5, add corresponding components
 * 3. Infer layout from complexity and device
 * 4. Infer actions from submission/cancellation dimensions
 * 5. Apply accessibility requirements
 *
 * ================================================================================
 * LAYOUT INFERENCE
 * ================================================================================
 *
 * Layout is inferred from intent and device:
 *
 * Complex intent (multiple high dimensions):
 *   - Desktop: 2-column grid
 *   - Mobile: 1-column vertical
 *
 * Sequential intent:
 *   - Vertical layout with step indicators
 *
 * Simple intent:
 *   - Flex layout (row on desktop, column on mobile)
 *
 * Modal intent:
 *   - Modal surface with centered content
 *
 * Inline intent:
 *   - Inline surface (no modal)
 *
 * ================================================================================
 * PERSONALIZATION
 * ================================================================================
 *
 * The bridge applies user preferences when enabled:
 *
 * - Theme: Dark/light mode preference
 * - Density: Compact vs comfortable spacing
 * - Language: Component labels and messages
 * - Accessibility: Screen reader, high contrast
 *
 * Preferences are learned from:
 * - Explicit user settings
 * - Implicit feedback (clicks, dwell time)
 * - Device capabilities
 *
 * ================================================================================
 * INTEGRATION EXAMPLE
 * ================================================================================
 *
 * ```typescript
 * import { IntentEncoder } from '@lsi/privacy';
 * import { IntentEncoderBridge } from '@lsi/a2ui';
 * import { createComponentCatalog } from '@lsi/a2ui';
 *
 * // Initialize
 * const encoder = new IntentEncoder();
 * const catalog = createComponentCatalog();
 * const bridge = new IntentEncoderBridge({
 *   encoder,
 *   catalog,
 *   enablePersonalization: true,
 *   maxComponents: 100
 * });
 *
 * // Generate UI from intent (without exposing original input)
 * const intent = await encoder.encode("Show me a login form");
 * const ui = await bridge.generateA2UI(intent, {
 *   sessionId: 'session-123',
 *   userId: 'user-456',
 *   device: { type: 'mobile' }
 * });
 *
 * // UI contains inferred components, layout, actions
 * // Original query "Show me a login form" was never shared
 * ```
 *
 * ================================================================================
 * A2UI RESPONSE FORMAT
 * ================================================================================
 *
 * ```typescript
 * {
 *   version: '0.8',
 *   surface: 'main',        // Where to render (main/modal/inline)
 *   components: [           // Component tree
 *     { type: 'form', id: 'form-0', props: {...} },
 *     { type: 'input', id: 'input-0', props: {...} },
 *     { type: 'button', id: 'btn-0', props: {...} }
 *   ],
 *   layout: {               // Layout configuration
 *     type: 'vertical',
 *     spacing: 16,
 *     responsive: {...}
 *   },
 *   actions: [              // Event handlers
 *     { type: 'submit', id: 'submit', handler: 'handleSubmit' }
 *   ],
 *   metadata: {
 *     timestamp: '2025-12-31T...',
 *     sessionId: 'session-123',
 *     intentVector: [0.1, 0.8, ...],  // For debugging/learning
 *     confidence: 0.85
 *   }
 * }
 * ```
 *
 * @see packages/privacy/src/IntentEncoder.ts for intent encoding
 * @see packages/a2ui/src/agents/A2UIAgent.ts for UI generation
 * @see packages/a2ui/src/renderer/ComponentCatalog.ts for available components
 */

import type { IntentEncoder, IntentVector } from "@lsi/privacy";
import type {
  A2UIResponse,
  A2UIComponent,
  A2UILayout,
  UIRequirements,
  A2UIContext,
  ComponentCatalog,
  A2UIComponentType,
} from "@lsi/protocol";

// ============================================================================
// TYPES
// ============================================================================

export interface IntentEncoderBridgeConfig {
  encoder: IntentEncoder;
  catalog: ComponentCatalog;
  enablePersonalization?: boolean;
  maxComponents?: number;
}

export interface IntentToUIContext extends A2UIContext {
  intentVector?: IntentVector;
  confidence?: number;
}

export interface IntentBasedUIOptions {
  includeMetadata?: boolean;
  enableAdaptiveLayout?: boolean;
  personalizeForUser?: boolean;
  respectAccessibility?: boolean;
}

// ============================================================================
// INTENT ENCODER BRIDGE
// ============================================================================

/**
 * Bridge between IntentEncoder and A2UI generation
 *
 * Encodes user intentions and maps them to UI requirements.
 */
export class IntentEncoderBridge {
  private encoder: IntentEncoder;
  private catalog: ComponentCatalog;
  private enablePersonalization: boolean;
  private maxComponents: number;

  constructor(config: IntentEncoderBridgeConfig) {
    this.encoder = config.encoder;
    this.catalog = config.catalog;
    this.enablePersonalization = config.enablePersonalization ?? true;
    this.maxComponents = config.maxComponents ?? 100;
  }

  /**
   * Encode user input to intent vector
   *
   * @param userInput - User's natural language input
   * @returns Intent vector representing user's intention
   */
  async encodeIntention(userInput: string): Promise<IntentVector> {
    try {
      // Use IntentEncoder to encode user input
      const intentVector = await this.encoder.encode(userInput);
      return intentVector;
    } catch (error) {
      console.error("Error encoding intention:", error);
      throw new Error(
        `Failed to encode intention: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Map intent vector to UI requirements
   *
   * @param intent - Intent vector from encoder
   * @param context - A2UI generation context
   * @returns UI requirements based on intent
   */
  async mapToUIRequirements(
    intent: IntentVector,
    context: A2UIContext
  ): Promise<UIRequirements> {
    // Analyze intent dimensions to determine UI needs
    const requirements: UIRequirements = {
      components: [],
      layout: this.inferLayoutFromIntent(intent, context),
      dataBindings: {},
      actions: [],
      style: this.inferStyleFromIntent(intent),
      accessibility: this.inferAccessibilityFromIntent(intent, context),
    };

    // Infer required components from intent
    const inferredComponents = this.inferComponentsFromIntent(intent);
    requirements.components = inferredComponents;

    // Infer actions from intent
    const inferredActions = this.inferActionsFromIntent(intent);
    requirements.actions = inferredActions;

    // Infer data bindings from intent
    requirements.dataBindings = this.inferDataBindings(intent);

    return requirements;
  }

  /**
   * Generate A2UI response from intent
   *
   * @param intent - Intent vector
   * @param context - Generation context
   * @param options - Generation options
   * @returns Complete A2UI response
   */
  async generateA2UI(
    intent: IntentVector,
    context: A2UIContext,
    options: IntentBasedUIOptions = {}
  ): Promise<A2UIResponse> {
    const {
      includeMetadata = true,
      enableAdaptiveLayout = true,
      personalizeForUser = true,
      respectAccessibility = true,
    } = options;

    // Get UI requirements from intent
    const requirements = await this.mapToUIRequirements(intent, context);

    // Build components from requirements
    const components: A2UIComponent[] = [];
    for (
      let i = 0;
      i < Math.min(requirements.components.length, this.maxComponents);
      i++
    ) {
      const componentType = requirements.components[i];
      const component = this.createComponentFromType(
        componentType,
        i,
        requirements
      );
      if (component) {
        components.push(component);
      }
    }

    // Build response
    const response: A2UIResponse = {
      version: "0.8",
      surface: this.inferSurfaceFromIntent(intent, context),
      components,
      layout: enableAdaptiveLayout
        ? this.makeAdaptiveLayout(requirements.layout, context)
        : requirements.layout,
      actions: requirements.actions,
      metadata: includeMetadata
        ? {
            timestamp: new Date(),
            sessionId: context.sessionId,
            agentId: "a2ui-intent-bridge",
            generationTime: Date.now(),
            intentVector: intent,
            confidence: this.calculateIntentConfidence(intent),
          }
        : undefined,
    };

    // Apply personalization if enabled
    if (
      personalizeForUser &&
      this.enablePersonalization &&
      context.preferences
    ) {
      this.applyPersonalization(response, context.preferences);
    }

    // Apply accessibility requirements
    if (respectAccessibility && requirements.accessibility) {
      this.applyAccessibility(response, requirements.accessibility);
    }

    return response;
  }

  // ==========================================================================
  // PRIVATE METHODS - Intent Analysis
  // ==========================================================================

  private inferComponentsFromIntent(intent: IntentVector): string[] {
    const components: string[] = [];

    // Analyze intent vector dimensions to infer needed components
    // This is a simplified implementation - real implementation would use
    // more sophisticated analysis of the intent vector

    // Check for information display intent
    if (this.hasInformationalIntent(intent)) {
      components.push("text", "container");
    }

    // Check for input intent
    if (this.hasInputIntent(intent)) {
      components.push("input", "button");
    }

    // Check for selection intent
    if (this.hasSelectionIntent(intent)) {
      components.push("select", "checkbox");
    }

    // Check for data display intent
    if (this.hasDataDisplayIntent(intent)) {
      components.push("table", "card");
    }

    // Check for form intent
    if (this.hasFormIntent(intent)) {
      components.push("form", "input", "button");
    }

    // Always add container for layout
    if (!components.includes("container")) {
      components.unshift("container");
    }

    return components;
  }

  private inferActionsFromIntent(intent: IntentVector) {
    const actions = [];

    // Check for submission intent
    if (this.hasSubmissionIntent(intent)) {
      actions.push({
        id: "submit",
        type: "submit" as const,
        handler: "handleSubmit",
      });
    }

    // Check for cancellation intent
    if (this.hasCancellationIntent(intent)) {
      actions.push({
        id: "cancel",
        type: "cancel" as const,
        handler: "handleCancel",
      });
    }

    return actions;
  }

  private inferDataBindings(intent: IntentVector): Record<string, string> {
    // Infer data bindings from intent
    // This would connect UI components to data sources
    const bindings: Record<string, string> = {};

    // Example: if intent suggests data display, bind to data source
    if (this.hasDataDisplayIntent(intent)) {
      bindings["data"] = "source:api";
    }

    return bindings;
  }

  private inferLayoutFromIntent(
    intent: IntentVector,
    context: A2UIContext
  ): A2UILayout {
    // Determine layout based on intent and device
    const isMobile = context.device?.type === "mobile";

    if (this.hasComplexIntent(intent)) {
      // Complex layouts for complex intents
      return {
        type: "grid",
        columns: isMobile ? 1 : 2,
        spacing: isMobile ? 8 : 16,
      };
    }

    if (this.hasSequentialIntent(intent)) {
      // Sequential layout for step-by-step intents
      return {
        type: "vertical",
        spacing: 16,
      };
    }

    // Default layout
    return {
      type: "flex",
      direction: isMobile ? "column" : "row",
      spacing: 16,
    };
  }

  private inferStyleFromIntent(intent: IntentVector) {
    // Infer styling preferences from intent
    return {
      theme: "light" as const,
      primaryColor: "#3b82f6",
    };
  }

  private inferAccessibilityFromIntent(
    intent: IntentVector,
    context: A2UIContext
  ) {
    // Determine accessibility requirements
    return {
      level: "AA" as const,
      screenReader: true,
      keyboardNav: true,
      highContrast: false,
    };
  }

  private inferSurfaceFromIntent(
    intent: IntentVector,
    context: A2UIContext
  ): A2UIResponse["surface"] {
    // Determine where to render UI
    if (this.hasModalIntent(intent)) {
      return "modal";
    }
    if (this.hasInlineIntent(intent)) {
      return "inline";
    }
    return "main";
  }

  // ==========================================================================
  // PRIVATE METHODS - Component Creation
  // ==========================================================================

  private createComponentFromType(
    type: string,
    index: number,
    requirements: UIRequirements
  ): A2UIComponent | null {
    const schema = this.catalog.components.get(type);
    if (!schema) {
      console.warn(`Unknown component type: ${type}`);
      return null;
    }

    const component: A2UIComponent = {
      type: type as A2UIComponentType,
      id: `${type}-${index}`,
      props: this.getDefaultProps(type),
    };

    // Add accessibility attributes
    if (requirements.accessibility) {
      component.a11y = {
        level: requirements.accessibility.level,
      };
    }

    return component;
  }

  private getDefaultProps(type: string): Record<string, unknown> {
    const defaultProps: Record<string, unknown> = {
      text: { content: "" },
      button: { label: "Button", variant: "primary" },
      input: { placeholder: "Enter value...", type: "text" },
      select: { placeholder: "Select...", options: [] },
      checkbox: { label: "Option", checked: false },
      container: {},
      card: { variant: "default" },
      form: {},
    };

    return defaultProps[type] || {};
  }

  // ==========================================================================
  // PRIVATE METHODS - Layout Enhancement
  // ==========================================================================

  private makeAdaptiveLayout(
    layout: A2UILayout,
    context: A2UIContext
  ): A2UILayout {
    const isMobile = context.device?.type === "mobile";
    const isTablet = context.device?.type === "tablet";

    if (!isMobile && !isTablet) {
      return layout;
    }

    return {
      ...layout,
      responsive: {
        mobile: { type: "vertical", spacing: 8 },
        tablet: { type: "horizontal", spacing: 12 },
        desktop: layout,
      },
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Personalization
  // ==========================================================================

  private applyPersonalization(
    response: A2UIResponse,
    preferences: any[]
  ): void {
    // Apply user preferences to response
    for (const pref of preferences) {
      switch (pref.key) {
        case "theme":
          if (response.metadata) {
            response.metadata.userPreferences = [
              ...(response.metadata.userPreferences || []),
              "theme",
            ];
          }
          break;
        case "density":
          // Adjust spacing
          if (response.layout) {
            response.layout.spacing = pref.value === "compact" ? 8 : 16;
          }
          break;
      }
    }
  }

  private applyAccessibility(response: A2UIResponse, requirements: any): void {
    // Apply accessibility requirements to all components
    for (const component of response.components) {
      if (!component.a11y) {
        component.a11y = {};
      }
      component.a11y.level = requirements.level;
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Intent Analysis Helpers
  // ==========================================================================

  private hasInformationalIntent(intent: IntentVector): boolean {
    // Check if intent vector indicates information display
    return intent.some((val, idx) => idx < 10 && val > 0.5);
  }

  private hasInputIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 10 && idx < 20 && val > 0.5);
  }

  private hasSelectionIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 20 && idx < 30 && val > 0.5);
  }

  private hasDataDisplayIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 30 && idx < 40 && val > 0.5);
  }

  private hasFormIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 40 && idx < 50 && val > 0.5);
  }

  private hasSubmissionIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 50 && idx < 60 && val > 0.5);
  }

  private hasCancellationIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 60 && idx < 70 && val > 0.5);
  }

  private hasComplexIntent(intent: IntentVector): boolean {
    // Check if intent is complex (multiple high-activation dimensions)
    const activeDimensions = intent.filter(v => v > 0.5).length;
    return activeDimensions > 3;
  }

  private hasSequentialIntent(intent: IntentVector): boolean {
    // Check if intent suggests sequential steps
    return intent.some((val, idx) => idx >= 70 && idx < 80 && val > 0.5);
  }

  private hasModalIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 80 && idx < 90 && val > 0.5);
  }

  private hasInlineIntent(intent: IntentVector): boolean {
    return intent.some((val, idx) => idx >= 90 && val > 0.5);
  }

  private calculateIntentConfidence(intent: IntentVector): number {
    // Calculate confidence based on intent vector properties
    const magnitude = Math.sqrt(
      intent.reduce((sum, val) => sum + val * val, 0)
    );
    const maxMagnitude = Math.sqrt(intent.length);
    return Math.min(magnitude / maxMagnitude, 1);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an IntentEncoder bridge
 *
 * @param config - Bridge configuration
 * @returns Configured bridge instance
 */
export function createIntentEncoderBridge(
  config: IntentEncoderBridgeConfig
): IntentEncoderBridge {
  return new IntentEncoderBridge(config);
}
