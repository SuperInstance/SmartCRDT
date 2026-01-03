/**
 * Framework Adapter - Base adapter for UI framework conversion
 * Provides interface and common functionality for framework-specific adapters
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  GeneratedCode,
  GeneratedStyle,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";

// ============================================================================
// Framework Adapter Interface
// ============================================================================

export interface FrameworkAdapter {
  /** Adapter name */
  name: string;

  /** Framework this adapter handles */
  framework: UIFramework;

  /** Parse UI code into structured representation */
  parseUI(ui: string): Promise<ParsedUI>;

  /** Parse component code */
  parseComponent(component: string): Promise<ParsedComponent>;

  /** Convert parsed UI to target framework */
  convertTo(
    ui: ParsedUI,
    targetFramework: UIFramework
  ): Promise<ConversionResult>;

  /** Generate component from specification */
  generateComponent(spec: ComponentSpec): Promise<ConversionResult>;

  /** Generate style from specification */
  generateStyle(spec: StyleSpec): Promise<GeneratedStyle>;

  /** Check if component is supported */
  isSupported(componentType: string): boolean;

  /** Get supported components */
  getSupportedComponents(): string[];

  /** Validate generated code */
  validate(code: string): Promise<boolean>;
}

// ============================================================================
// Abstract Base Adapter
// ============================================================================

export abstract class BaseFrameworkAdapter implements FrameworkAdapter {
  abstract name: string;
  abstract framework: UIFramework;

  protected supportedComponents: Set<string> = new Set();

  // ------------------------------------------------------------------------
  // Abstract methods (must be implemented by subclasses)
  // ------------------------------------------------------------------------

  abstract parseUI(ui: string): Promise<ParsedUI>;
  abstract parseComponent(component: string): Promise<ParsedComponent>;
  abstract generateComponent(spec: ComponentSpec): Promise<ConversionResult>;
  abstract generateStyle(spec: StyleSpec): Promise<GeneratedStyle>;

  // ------------------------------------------------------------------------
  // Common implementations
  // ------------------------------------------------------------------------

  async convertTo(
    ui: ParsedUI,
    targetFramework: UIFramework
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Check if we can convert to target framework
      if (!this.canConvertTo(targetFramework)) {
        errors.push(
          `Cannot convert from ${this.framework} to ${targetFramework}`
        );
        return this.createErrorResult(errors, ui);
      }

      // Convert components
      const convertedComponents = await Promise.all(
        ui.components.map(comp => this.convertComponent(comp, targetFramework))
      );

      // Convert styles
      const convertedStyles = await Promise.all(
        ui.styles.map(style => this.convertStyle(style, targetFramework))
      );

      // Combine into final code
      const code = await this.combineCode(
        convertedComponents,
        convertedStyles,
        targetFramework
      );

      const metadata: ConversionMetadata = {
        fromFramework: this.framework,
        toFramework: targetFramework,
        componentsConverted: convertedComponents.length,
        linesOfCode: code.toString().split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Conversion failed: ${error}`);
      return this.createErrorResult(errors, ui);
    }
  }

  isSupported(componentType: string): boolean {
    return this.supportedComponents.has(componentType);
  }

  getSupportedComponents(): string[] {
    return Array.from(this.supportedComponents);
  }

  async validate(code: string): Promise<boolean> {
    try {
      // Basic validation: check for syntax errors
      if (!code || code.trim().length === 0) {
        return false;
      }

      // Check for balanced braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        return false;
      }

      // Check for balanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------------
  // Protected helper methods
  // ------------------------------------------------------------------------

  protected abstract canConvertTo(targetFramework: UIFramework): boolean;

  protected abstract convertComponent(
    component: ParsedComponent,
    targetFramework: UIFramework
  ): Promise<any>;

  protected abstract convertStyle(
    style: any,
    targetFramework: UIFramework
  ): Promise<any>;

  protected abstract combineCode(
    components: any[],
    styles: any[],
    targetFramework: UIFramework
  ): Promise<GeneratedCode>;

  protected createErrorResult(
    errors: string[],
    ui: ParsedUI
  ): ConversionResult {
    return {
      success: false,
      code: "" as any,
      warnings: [],
      errors,
      metadata: {
        fromFramework: this.framework,
        toFramework: this.framework,
        componentsConverted: 0,
        linesOfCode: 0,
        conversionTime: 0,
      },
    };
  }

  protected extractImports(code: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  protected extractExports(code: string): string[] {
    const exports: string[] = [];

    // Default exports
    const defaultExportRegex = /export\s+default\s+(\w+)/g;
    let match;
    while ((match = defaultExportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }

    // Named exports
    const namedExportRegex = /export\s+(?:const|function|class)\s+(\w+)/g;
    while ((match = namedExportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  protected parseProps(componentCode: string): Array<{
    name: string;
    type: string;
    required: boolean;
  }> {
    const props: Array<{ name: string; type: string; required: boolean }> = [];

    // Match interface or type definitions
    const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
    let match;

    while ((match = interfaceRegex.exec(componentCode)) !== null) {
      const propsBlock = match[2];
      const propLines = propsBlock.split(";").filter(line => line.trim());

      for (const line of propLines) {
        const [name, type] = line.split(":").map(s => s.trim());
        if (name && type) {
          props.push({
            name,
            type,
            required: !type.includes("| undefined"),
          });
        }
      }
    }

    return props;
  }

  protected parseState(componentCode: string): Array<{
    name: string;
    type: string;
    initial?: any;
  }> {
    const state: Array<{ name: string; type: string; initial?: any }> = [];

    // Match useState hooks
    const useStateRegex = /useState<([^>]+)>\(\s*(.*?)\s*\)/g;
    let match;

    while ((match = useStateRegex.exec(componentCode)) !== null) {
      const type = match[1];
      const initial = match[2];

      // Find the variable name by looking backwards from useState
      const useStateIndex = match.index;
      const beforeUseState = componentCode.substring(
        Math.max(0, useStateIndex - 100),
        useStateIndex
      );
      const constMatch = beforeUseState.match(/const\s+\[\s*(\w+)\s*,/);

      if (constMatch) {
        state.push({
          name: constMatch[1],
          type,
          initial: initial || undefined,
        });
      }
    }

    return state;
  }

  protected parseEvents(componentCode: string): Array<{
    name: string;
    type: string;
    handler: string;
  }> {
    const events: Array<{ name: string; type: string; handler: string }> = [];

    // Match event handlers (onClick, onChange, etc.)
    const eventHandlerRegex =
      /on(\w+)\s*=\s*{\s*(\w+|\([^)]*\)\s*=>\s*{[^}]*})\s*}/g;
    let match;

    while ((match = eventHandlerRegex.exec(componentCode)) !== null) {
      const eventName = match[1];
      const handler = match[2];

      events.push({
        name: eventName,
        type: this.inferEventType(eventName),
        handler,
      });
    }

    return events;
  }

  protected inferEventType(eventName: string): string {
    const eventTypes: Record<string, string> = {
      click: "MouseEvent",
      change: "ChangeEvent",
      submit: "FormEvent",
      focus: "FocusEvent",
      blur: "FocusEvent",
      keydown: "KeyboardEvent",
      keyup: "KeyboardEvent",
      mousemove: "MouseEvent",
      mouseenter: "MouseEvent",
      mouseleave: "MouseEvent",
    };

    return eventTypes[eventName.toLowerCase()] || "Event";
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

export class AdapterRegistry {
  private static adapters: Map<UIFramework, FrameworkAdapter> = new Map();

  static register(adapter: FrameworkAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  static get(framework: UIFramework): FrameworkAdapter | undefined {
    return this.adapters.get(framework);
  }

  static has(framework: UIFramework): boolean {
    return this.adapters.has(framework);
  }

  static list(): UIFramework[] {
    return Array.from(this.adapters.keys());
  }

  static listAdapters(): FrameworkAdapter[] {
    return Array.from(this.adapters.values());
  }
}
