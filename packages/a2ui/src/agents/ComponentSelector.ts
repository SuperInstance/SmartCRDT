/**
 * Component Selector - Selects and configures UI components based on requirements
 *
 * This module is responsible for selecting appropriate components from the
 * catalog and configuring them based on analyzed requirements and context.
 */

import type {
  A2UIComponent,
  A2UIComponentType,
  ComponentCatalog,
  UIRequirements,
  A2UIContext,
} from "@lsi/protocol";

// ============================================================================
// TYPES
// ============================================================================

export interface ComponentSelectorConfig {
  catalog: ComponentCatalog;
  enableLearning?: boolean;
}

export interface ComponentSelectionStrategy {
  select(
    componentTypes: string[],
    requirements: UIRequirements,
    context: A2UIContext
  ): Promise<string[]>;
}

export interface ComponentConfigurationStrategy {
  configure(
    componentType: string,
    requirements: UIRequirements,
    context: A2UIContext
  ): Promise<Record<string, unknown>>;
}

// ============================================================================
// COMPONENT SELECTOR
// ============================================================================

export class ComponentSelector {
  private config: ComponentSelectorConfig;
  private selectionStrategies: Map<string, ComponentSelectionStrategy>;
  private configurationStrategies: Map<string, ComponentConfigurationStrategy>;
  private componentUsage: Map<string, number>;

  constructor(config: ComponentSelectorConfig) {
    this.config = config;
    this.selectionStrategies = new Map();
    this.configurationStrategies = new Map();
    this.componentUsage = new Map();

    // Register default strategies
    this.registerDefaultStrategies();
  }

  /**
   * Select components based on requirements
   *
   * @param requirements - UI requirements
   * @param context - Generation context
   * @returns Selected component types
   */
  async selectComponents(
    requirements: UIRequirements,
    context: A2UIContext
  ): Promise<A2UIComponent[]> {
    // Select component types
    const selectedTypes = await this.select(
      requirements.components,
      requirements,
      context
    );

    // Build components
    const components: A2UIComponent[] = [];
    for (let i = 0; i < selectedTypes.length; i++) {
      const component = await this.createComponent(
        selectedTypes[i],
        i,
        requirements
      );
      if (component) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Create a single component
   *
   * @param componentType - Type of component
   * @param index - Component index
   * @param requirements - UI requirements
   * @returns Component or null if invalid
   */
  async createComponent(
    componentType: string,
    index: number,
    requirements: UIRequirements
  ): Promise<A2UIComponent | null> {
    const schema = this.config.catalog.components.get(componentType);
    if (!schema) {
      console.warn(`Unknown component type: ${componentType}`);
      return null;
    }

    // Track usage for learning
    this.trackUsage(componentType);

    // Configure component props
    const props = await this.configure(
      componentType,
      requirements,
      {} as A2UIContext
    );

    return {
      type: componentType as A2UIComponentType,
      id: `${componentType}-${index}`,
      props,
      a11y: requirements.accessibility
        ? {
            level: requirements.accessibility.level,
          }
        : undefined,
    };
  }

  /**
   * Select component types from requirements
   *
   * @param componentTypes - Requested component types
   * @param requirements - UI requirements
   * @param context - Generation context
   * @returns Selected and filtered component types
   */
  async select(
    componentTypes: string[],
    requirements: UIRequirements,
    context: A2UIContext
  ): Promise<string[]> {
    const selected: string[] = [];

    for (const type of componentTypes) {
      // Check if component exists in catalog
      if (!this.config.catalog.components.has(type)) {
        console.warn(`Component type not in catalog: ${type}`);
        continue;
      }

      // Check security policy
      const schema = this.config.catalog.components.get(type)!;
      if (!this.checkSecurityPolicy(schema, context)) {
        console.warn(`Component blocked by security policy: ${type}`);
        continue;
      }

      selected.push(type);
    }

    return selected;
  }

  /**
   * Configure component props
   *
   * @param componentType - Component type
   * @param requirements - UI requirements
   * @param context - Generation context
   * @returns Component props
   */
  async configure(
    componentType: string,
    requirements: UIRequirements,
    context: A2UIContext
  ): Promise<Record<string, unknown>> {
    // Get default props for component type
    const defaultProps = this.getDefaultProps(componentType);

    // Apply style if available
    if (requirements.style) {
      return this.applyStyleToProps(defaultProps, requirements.style);
    }

    return defaultProps;
  }

  /**
   * Register custom selection strategy
   *
   * @param name - Strategy name
   * @param strategy - Selection strategy
   */
  registerSelectionStrategy(
    name: string,
    strategy: ComponentSelectionStrategy
  ): void {
    this.selectionStrategies.set(name, strategy);
  }

  /**
   * Register custom configuration strategy
   *
   * @param name - Strategy name
   * @param strategy - Configuration strategy
   */
  registerConfigurationStrategy(
    name: string,
    strategy: ComponentConfigurationStrategy
  ): void {
    this.configurationStrategies.set(name, strategy);
  }

  /**
   * Get component usage statistics
   *
   * @returns Usage statistics
   */
  getUsageStats(): Record<string, number> {
    return Object.fromEntries(this.componentUsage);
  }

  /**
   * Clear usage statistics
   */
  clearUsageStats(): void {
    this.componentUsage.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS - Default Props
  // ==========================================================================

  private getDefaultProps(componentType: string): Record<string, unknown> {
    const defaultProps: Record<string, Record<string, unknown>> = {
      // Layout
      container: { className: "a2ui-container" },
      spacer: { size: "md" },
      divider: { orientation: "horizontal" },

      // Text
      text: { content: "", variant: "body", align: "left" },

      // Input
      button: {
        label: "Button",
        variant: "primary",
        size: "md",
        disabled: false,
        loading: false,
      },
      input: {
        placeholder: "Enter value...",
        type: "text",
        disabled: false,
        required: false,
      },
      textarea: {
        placeholder: "Enter text...",
        rows: 4,
        disabled: false,
      },
      select: {
        placeholder: "Select...",
        options: [],
        disabled: false,
      },
      checkbox: {
        label: "Option",
        checked: false,
        disabled: false,
      },
      switch: {
        checked: false,
        disabled: false,
        size: "md",
      },
      slider: {
        value: 0,
        min: 0,
        max: 100,
        step: 1,
      },

      // Display
      image: {
        src: "",
        alt: "",
        fit: "cover",
      },
      video: {
        src: "",
        controls: true,
      },
      list: {
        items: [],
        variant: "bullet",
        compact: false,
      },
      table: {
        columns: [],
        rows: [],
        striped: false,
      },
      card: {
        variant: "default",
      },

      // Navigation
      tabs: {
        tabs: [],
        activeTab: 0,
        position: "top",
      },
      accordion: {
        items: [],
        multiple: false,
      },
      modal: {
        open: false,
        size: "md",
        closable: true,
      },

      // Feedback
      progress: {
        value: 0,
        max: 100,
        variant: "bar",
      },
      spinner: {
        size: "md",
      },
      alert: {
        variant: "info",
        message: "",
      },
      badge: {
        variant: "default",
        size: "md",
      },

      // Form
      form: {
        id: "form",
        validateOnChange: true,
      },
    };

    return defaultProps[componentType] || {};
  }

  // ==========================================================================
  // PRIVATE METHODS - Style Application
  // ==========================================================================

  private applyStyleToProps(
    props: Record<string, unknown>,
    style: NonNullable<UIRequirements["style"]>
  ): Record<string, unknown> {
    const styled = { ...props };

    // Apply theme
    if (style.theme) {
      (styled as any).theme = style.theme;
    }

    // Apply primary color
    if (style.primaryColor) {
      (styled as any).color = style.primaryColor;
    }

    // Apply custom CSS
    if (style.customCSS) {
      (styled as any).style = {
        ...(styled as any).style,
        ...style.customCSS,
      };
    }

    return styled;
  }

  // ==========================================================================
  // PRIVATE METHODS - Security
  // ==========================================================================

  private checkSecurityPolicy(
    schema: { security: { allowedHandlers?: string[] } },
    context: A2UIContext
  ): boolean {
    // Check if handler is allowed
    if (schema.security.allowedHandlers) {
      if (schema.security.allowedHandlers[0] !== "*") {
        // Would check against available handlers in context
        return true; // Placeholder
      }
    }

    return true;
  }

  // ==========================================================================
  // PRIVATE METHODS - Usage Tracking
  // ==========================================================================

  private trackUsage(componentType: string): void {
    const current = this.componentUsage.get(componentType) || 0;
    this.componentUsage.set(componentType, current + 1);
  }

  // ==========================================================================
  // PRIVATE METHODS - Strategy Registration
  // ==========================================================================

  private registerDefaultStrategies(): void {
    // Register default selection strategy
    this.selectionStrategies.set("default", {
      select: async (types, req, ctx) => {
        return this.filterByAvailability(types);
      },
    });

    // Register default configuration strategy
    this.configurationStrategies.set("default", {
      configure: async (type, req, ctx) => {
        return this.getDefaultProps(type);
      },
    });
  }

  private filterByAvailability(types: string[]): string[] {
    return types.filter(type => this.config.catalog.components.has(type));
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createComponentSelector(
  config: ComponentSelectorConfig
): ComponentSelector {
  return new ComponentSelector(config);
}
