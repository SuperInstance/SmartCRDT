/**
 * @fileoverview Variant Generator - Generate UI variants for A/B testing
 * @author Aequor Project - Round 18 Agent 2
 * @version 1.0.0
 */

import type { A2UIResponse, A2UIComponent, A2UILayout } from "@lsi/protocol";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Variant generation strategy
 */
export type VariantStrategy =
  | "layout"
  | "component"
  | "style"
  | "content"
  | "interaction"
  | "comprehensive";

/**
 * Layout variation type
 */
export type LayoutVariation =
  | "spacing"
  | "arrangement"
  | "density"
  | "alignment"
  | "direction";

/**
 * Style variation type
 */
export type StyleVariation =
  | "color"
  | "typography"
  | "size"
  | "border"
  | "shadow"
  | "animation";

/**
 * Content variation type
 */
export type ContentVariation =
  | "tone"
  | "length"
  | "formatting"
  | "ordering"
  | "emphasis";

/**
 * Variant template
 */
export interface VariantTemplate {
  id: string;
  name: string;
  description: string;
  strategy: VariantStrategy;
  variations: VariantDefinition[];
}

/**
 * Variant definition
 */
export interface VariantDefinition {
  type: LayoutVariation | StyleVariation | ContentVariation;
  scope: "global" | "local" | "component";
  target?: string; // Component ID or type
  transform: (ui: A2UIResponse) => A2UIResponse;
  metadata?: Record<string, unknown>;
}

/**
 * Generated variant
 */
export interface GeneratedVariant {
  id: string;
  name: string;
  description: string;
  ui: A2UIResponse;
  changes: VariantChange[];
  template?: string;
}

/**
 * Individual change made to generate variant
 */
export interface VariantChange {
  type: string;
  scope: string;
  target?: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Generation options
 */
export interface VariantGeneratorOptions {
  maxVariants?: number;
  strategies?: VariantStrategy[];
  excludeStrategies?: VariantStrategy[];
  preserveAccessibility?: boolean;
  validateOutput?: boolean;
}

/**
 * Configuration for VariantGenerator
 */
export interface VariantGeneratorConfig {
  defaultTemplates?: VariantTemplate[];
  customTemplates?: VariantTemplate[];
  options?: VariantGeneratorOptions;
}

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const BUILT_IN_TEMPLATES: VariantTemplate[] = [
  {
    id: "layout-density-variants",
    name: "Layout Density Variants",
    description: "Generate variants with different spacing densities",
    strategy: "layout",
    variations: [
      {
        type: "spacing",
        scope: "global",
        transform: ui => applySpacing(ui, 8, 8), // Compact
        metadata: { density: "compact" },
      },
      {
        type: "spacing",
        scope: "global",
        transform: ui => applySpacing(ui, 16, 16), // Comfortable
        metadata: { density: "comfortable" },
      },
      {
        type: "spacing",
        scope: "global",
        transform: ui => applySpacing(ui, 24, 24), // Spacious
        metadata: { density: "spacious" },
      },
    ],
  },
  {
    id: "component-ordering-variants",
    name: "Component Ordering Variants",
    description: "Generate variants with different component arrangements",
    strategy: "component",
    variations: [
      {
        type: "ordering",
        scope: "global",
        transform: ui => reorderComponents(ui, "importance"),
        metadata: { ordering: "importance" },
      },
      {
        type: "ordering",
        scope: "global",
        transform: ui => reorderComponents(ui, "type"),
        metadata: { ordering: "type" },
      },
      {
        type: "ordering",
        scope: "global",
        transform: ui => reorderComponents(ui, "reverse"),
        metadata: { ordering: "reverse" },
      },
    ],
  },
  {
    id: "color-scheme-variants",
    name: "Color Scheme Variants",
    description: "Generate variants with different color schemes",
    strategy: "style",
    variations: [
      {
        type: "color",
        scope: "global",
        transform: ui => applyColorScheme(ui, "light"),
        metadata: { scheme: "light" },
      },
      {
        type: "color",
        scope: "global",
        transform: ui => applyColorScheme(ui, "dark"),
        metadata: { scheme: "dark" },
      },
      {
        type: "color",
        scope: "global",
        transform: ui => applyColorScheme(ui, "high-contrast"),
        metadata: { scheme: "high-contrast" },
      },
    ],
  },
  {
    id: "button-size-variants",
    name: "Button Size Variants",
    description: "Generate variants with different button sizes",
    strategy: "style",
    variations: [
      {
        type: "size",
        scope: "component",
        target: "button",
        transform: ui => applyComponentSize(ui, "button", "small"),
        metadata: { size: "small" },
      },
      {
        type: "size",
        scope: "component",
        target: "button",
        transform: ui => applyComponentSize(ui, "button", "medium"),
        metadata: { size: "medium" },
      },
      {
        type: "size",
        scope: "component",
        target: "button",
        transform: ui => applyComponentSize(ui, "button", "large"),
        metadata: { size: "large" },
      },
    ],
  },
];

// ============================================================================
// VARIANT GENERATOR
// ============================================================================

/**
 * VariantGenerator - Generate UI variants for A/B testing
 *
 * Takes a base UI and generates variants based on different strategies.
 * Supports built-in templates and custom transformations.
 */
export class VariantGenerator {
  private templates: Map<string, VariantTemplate>;
  private options: Required<VariantGeneratorOptions>;

  constructor(config?: VariantGeneratorConfig) {
    this.templates = new Map();

    // Register built-in templates
    for (const template of BUILT_IN_TEMPLATES) {
      this.templates.set(template.id, template);
    }

    // Register custom templates
    if (config?.customTemplates) {
      for (const template of config.customTemplates) {
        this.templates.set(template.id, template);
      }
    }

    this.options = {
      maxVariants: 10,
      strategies: ["layout", "component", "style", "content"],
      excludeStrategies: [],
      preserveAccessibility: true,
      validateOutput: true,
      ...config?.options,
    };
  }

  /**
   * Generate variants from a base UI
   */
  generateVariants(
    baseUI: A2UIResponse,
    options?: VariantGeneratorOptions
  ): GeneratedVariant[] {
    const opts = { ...this.options, ...options };
    const variants: GeneratedVariant[] = [];

    // Generate control variant (original)
    variants.push({
      id: "control",
      name: "Original",
      description: "Original UI without modifications",
      ui: JSON.parse(JSON.stringify(baseUI)),
      changes: [],
    });

    // Apply enabled strategies
    for (const strategy of opts.strategies) {
      if (opts.excludeStrategies.includes(strategy)) {
        continue;
      }

      const strategyVariants = this.generateByStrategy(baseUI, strategy, opts);
      variants.push(...strategyVariants);
    }

    // Limit to max variants
    return variants.slice(0, opts.maxVariants);
  }

  /**
   * Generate variants using a specific template
   */
  generateByTemplate(
    baseUI: A2UIResponse,
    templateId: string
  ): GeneratedVariant[] {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const variants: GeneratedVariant[] = [];

    for (const variation of template.variations) {
      const ui = variation.transform(JSON.parse(JSON.stringify(baseUI)));
      variants.push({
        id: `${template.id}-${variation.type}`,
        name: `${template.name} - ${variation.type}`,
        description:
          (variation.metadata?.description as string) || template.description,
        ui,
        changes: [
          {
            type: variation.type,
            scope: variation.scope,
            target: variation.target,
            description: `Applied ${variation.type} variation`,
          },
        ],
        template: template.id,
      });
    }

    return variants;
  }

  /**
   * Generate a single variant with custom transformation
   */
  generateCustomVariant(
    baseUI: A2UIResponse,
    transform: (ui: A2UIResponse) => A2UIResponse,
    metadata: {
      id: string;
      name: string;
      description: string;
      changes: VariantChange[];
    }
  ): GeneratedVariant {
    const ui = transform(JSON.parse(JSON.stringify(baseUI)));

    return {
      ...metadata,
      ui,
    };
  }

  /**
   * Register a custom template
   */
  registerTemplate(template: VariantTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Unregister a template
   */
  unregisterTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  /**
   * Get all registered templates
   */
  getTemplates(): VariantTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template
   */
  getTemplate(templateId: string): VariantTemplate | undefined {
    return this.templates.get(templateId);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Generate variants by strategy
   */
  private generateByStrategy(
    baseUI: A2UIResponse,
    strategy: VariantStrategy,
    options: Required<VariantGeneratorOptions>
  ): GeneratedVariant[] {
    const variants: GeneratedVariant[] = [];

    for (const template of this.templates.values()) {
      if (template.strategy !== strategy) {
        continue;
      }

      for (const variation of template.variations) {
        if (variants.length >= options.maxVariants - 1) {
          break;
        }

        try {
          const ui = variation.transform(JSON.parse(JSON.stringify(baseUI)));

          if (options.validateOutput && !this.isValidUI(ui)) {
            continue;
          }

          variants.push({
            id: `${strategy}-${variation.type}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${template.name} - ${variation.type}`,
            description: template.description,
            ui,
            changes: [
              {
                type: variation.type,
                scope: variation.scope,
                target: variation.target,
                description: `Applied ${variation.type} variation`,
              },
            ],
            template: template.id,
          });
        } catch (error) {
          console.warn(`Failed to generate variant: ${error}`);
        }
      }
    }

    return variants;
  }

  /**
   * Validate generated UI
   */
  private isValidUI(ui: A2UIResponse): boolean {
    // Basic validation
    if (!ui.version || !ui.layout || !Array.isArray(ui.components)) {
      return false;
    }

    // Check component IDs are unique
    const ids = new Set<string>();
    for (const component of ui.components) {
      if (!component.id) {
        return false;
      }
      if (ids.has(component.id)) {
        return false;
      }
      ids.add(component.id);
    }

    return true;
  }
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Apply spacing to layout
 */
function applySpacing(
  ui: A2UIResponse,
  gap: number,
  padding: number
): A2UIResponse {
  if (ui.layout) {
    ui.layout = { ...ui.layout, gap, padding };
  }
  return ui;
}

/**
 * Reorder components
 */
function reorderComponents(
  ui: A2UIResponse,
  strategy: "importance" | "type" | "reverse"
): A2UIResponse {
  if (!ui.components || ui.components.length === 0) {
    return ui;
  }

  const sorted = [...ui.components];

  switch (strategy) {
    case "reverse":
      sorted.reverse();
      break;

    case "type":
      sorted.sort((a, b) => a.type.localeCompare(b.type));
      break;

    case "importance":
      // Simple heuristic: action components first, then input, then display
      const importance: Record<string, number> = {
        button: 3,
        submit: 3,
        input: 2,
        select: 2,
        text: 1,
        image: 1,
      };
      sorted.sort((a, b) => {
        const aImp = importance[a.type] || 0;
        const bImp = importance[b.type] || 0;
        return bImp - aImp;
      });
      break;
  }

  ui.components = sorted;
  return ui;
}

/**
 * Apply color scheme
 */
function applyColorScheme(
  ui: A2UIResponse,
  scheme: "light" | "dark" | "high-contrast"
): A2UIResponse {
  const themes: Record<
    string,
    { background: string; foreground: string; primary: string }
  > = {
    light: {
      background: "#ffffff",
      foreground: "#000000",
      primary: "#0066cc",
    },
    dark: {
      background: "#1a1a1a",
      foreground: "#ffffff",
      primary: "#4da6ff",
    },
    "high-contrast": {
      background: "#000000",
      foreground: "#ffffff",
      primary: "#ffff00",
    },
  };

  const theme = themes[scheme];

  // Apply to layout
  if (ui.layout) {
    ui.layout.style = {
      ...ui.layout.style,
      backgroundColor: theme.background,
      color: theme.foreground,
    };
  }

  // Apply to components
  if (ui.components) {
    for (const component of ui.components) {
      component.props = {
        ...component.props,
        style: {
          ...(component.props as any)?.style,
          color: theme.foreground,
        },
      };

      if (component.type === "button") {
        component.props = {
          ...component.props,
          style: {
            ...(component.props as any)?.style,
            backgroundColor: theme.primary,
            color: scheme === "light" ? "#ffffff" : "#000000",
          },
        };
      }
    }
  }

  return ui;
}

/**
 * Apply component size
 */
function applyComponentSize(
  ui: A2UIResponse,
  componentType: string,
  size: "small" | "medium" | "large"
): A2UIResponse {
  const sizes: Record<string, { padding: string; fontSize: number }> = {
    small: { padding: "4px 8px", fontSize: 12 },
    medium: { padding: "8px 16px", fontSize: 14 },
    large: { padding: "12px 24px", fontSize: 16 },
  };

  const sizeConfig = sizes[size];

  if (ui.components) {
    for (const component of ui.components) {
      if (component.type === componentType) {
        component.props = {
          ...component.props,
          style: {
            ...(component.props as any)?.style,
            padding: sizeConfig.padding,
            fontSize: `${sizeConfig.fontSize}px`,
          },
        };
      }
    }
  }

  return ui;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a variant generator with default configuration
 */
export function createVariantGenerator(
  config?: VariantGeneratorConfig
): VariantGenerator {
  return new VariantGenerator(config);
}

/**
 * Generate quick variants for common scenarios
 */
export function generateQuickVariants(
  baseUI: A2UIResponse,
  scenario: "ecommerce" | "saas" | "content" | "form"
): GeneratedVariant[] {
  const generator = new VariantGenerator();

  switch (scenario) {
    case "ecommerce":
      return generator.generateVariants(baseUI, {
        strategies: ["layout", "style"],
        maxVariants: 5,
      });

    case "saas":
      return generator.generateVariants(baseUI, {
        strategies: ["component", "layout"],
        maxVariants: 4,
      });

    case "content":
      return generator.generateVariants(baseUI, {
        strategies: ["layout", "content"],
        maxVariants: 3,
      });

    case "form":
      return generator.generateVariants(baseUI, {
        strategies: ["component", "style"],
        maxVariants: 6,
      });

    default:
      return generator.generateVariants(baseUI);
  }
}
