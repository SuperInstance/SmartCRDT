/**
 * Svelte Adapter - Convert React components to Svelte
 * Supports Svelte 3, 4, and 5 with runes syntax
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  SvelteCode,
  SvelteAdapterConfig,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// Svelte Adapter Configuration
// ============================================================================

const DEFAULT_SVELTE_CONFIG: SvelteAdapterConfig = {
  version: "4",
  typescript: true,
};

// ============================================================================
// Svelte Adapter Implementation
// ============================================================================

export class SvelteAdapter extends BaseFrameworkAdapter {
  name = "SvelteAdapter";
  framework: UIFramework = "svelte";
  config: SvelteAdapterConfig;

  constructor(config: Partial<SvelteAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SVELTE_CONFIG, ...config };
    this.initializeSupportedComponents();
  }

  private initializeSupportedComponents(): void {
    const components = [
      "Button",
      "Input",
      "TextField",
      "Select",
      "Checkbox",
      "Radio",
      "Switch",
      "Slider",
      "Card",
      "Dialog",
      "Modal",
      "Alert",
      "Badge",
      "Breadcrumb",
      "Accordion",
      "Tabs",
      "Table",
      "List",
      "Grid",
      "Container",
      "Typography",
      "Image",
      "Icon",
      "Avatar",
      "Chip",
      "Divider",
      "Progress",
      "Skeleton",
      "Tooltip",
      "Popover",
      "Menu",
      "AppBar",
      "Toolbar",
      "Drawer",
      "Snackbar",
    ];

    components.forEach(comp => this.supportedComponents.add(comp));
  }

  // ------------------------------------------------------------------------
  // Parsing Methods
  // ------------------------------------------------------------------------

  async parseUI(ui: string): Promise<ParsedUI> {
    const script = this.extractScript(ui);
    const template = this.extractTemplate(ui);
    const style = this.extractStyle(ui);

    const components = this.extractComponentsFromSvelte(script, template);
    const styles = this.parseSvelteStyles(style);

    return {
      framework: "svelte",
      components,
      styles,
      imports: [],
      exports: [],
      metadata: {
        version: this.config.version,
        language: this.config.typescript ? "typescript" : "javascript",
        features: this.detectSvelteFeatures(script),
        dependencies: [],
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractComponentName(component);
    const type = this.extractComponentType(component);
    const props = this.parseSvelteProps(component);
    const state = this.parseSvelteState(component);
    const events = this.parseSvelteEvents(component);

    return {
      name,
      type,
      props,
      state,
      events,
      children: [],
      template: this.extractTemplate(component),
      script: this.extractScript(component),
      styles: [this.extractStyle(component)],
    };
  }

  // ------------------------------------------------------------------------
  // React to Svelte Conversion
  // ------------------------------------------------------------------------

  async convertFromReact(
    reactCode: string,
    componentName: string
  ): Promise<SvelteCode> {
    const script = this.convertReactToSvelteScript(reactCode);
    const template = this.convertJSXToSvelteTemplate(reactCode);
    const style = this.extractStylesFromReact(reactCode);

    return {
      script,
      template,
      style,
    };
  }

  // ------------------------------------------------------------------------
  // Generation Methods
  // ------------------------------------------------------------------------

  async generateComponent(spec: ComponentSpec): Promise<ConversionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const svelteCode = this.generateSvelteComponent(spec);
      const metadata: ConversionMetadata = {
        fromFramework: spec.framework,
        toFramework: "svelte",
        componentsConverted: 1,
        linesOfCode:
          svelteCode.script.split("\n").length +
          svelteCode.template.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: svelteCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "svelte",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: { language: "typescript", features: [], dependencies: [] },
      });
    }
  }

  async generateStyle(spec: StyleSpec): Promise<any> {
    const { selector, properties } = spec;
    const cssRules = Object.entries(properties)
      .map(([prop, value]) => `  ${this.kebabCase(prop)}: ${value};`)
      .join("\n");

    return {
      css: `.${selector} {\n${cssRules}\n}`,
      framework: "svelte",
    };
  }

  // ------------------------------------------------------------------------
  // Protected Helper Methods
  // ------------------------------------------------------------------------

  protected canConvertTo(targetFramework: UIFramework): boolean {
    return targetFramework === "react";
  }

  protected async convertComponent(
    component: ParsedComponent,
    targetFramework: UIFramework
  ): Promise<any> {
    if (targetFramework === "react") {
      return this.svelteToReact(component);
    }
    return component;
  }

  protected async convertStyle(
    style: any,
    targetFramework: UIFramework
  ): Promise<any> {
    return style;
  }

  protected async combineCode(
    components: any[],
    styles: any[],
    targetFramework: UIFramework
  ): Promise<any> {
    return { components, styles };
  }

  // ------------------------------------------------------------------------
  // Private Helper Methods - Svelte Parsing
  // ------------------------------------------------------------------------

  private extractScript(sfc: string): string {
    const match = sfc.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return match ? match[1].trim() : "";
  }

  private extractTemplate(sfc: string): string {
    // Everything outside of script and style tags
    let template = sfc;
    template = template.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
    template = template.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    return template.trim();
  }

  private extractStyle(sfc: string): string {
    const match = sfc.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return match ? match[1].trim() : "";
  }

  private extractComponentsFromSvelte(
    script: string,
    template: string
  ): ParsedComponent[] {
    const components: ParsedComponent[] = [];

    // Extract imported components
    const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(script)) !== null) {
      const [, name, module] = match;
      if (module.startsWith("./") || module.startsWith("../")) {
        // Local component
        components.push({
          name,
          type: this.kebabCase(name),
          props: [],
          state: [],
          events: [],
          children: [],
        });
      }
    }

    return components;
  }

  private parseSvelteStyles(style: string): any[] {
    if (!style) return [];

    const styles: any[] = [];

    // Match CSS rules
    const ruleRegex = /([^{}]+)\s*{([^}]+)}/g;
    let match;

    while ((match = ruleRegex.exec(style)) !== null) {
      const [, selector, properties] = match;
      const propsMap: Record<string, string> = {};

      const propPairs = properties.split(";").filter(p => p.trim());
      for (const pair of propPairs) {
        const [prop, value] = pair.split(":").map(s => s.trim());
        if (prop && value) {
          propsMap[prop] = value;
        }
      }

      styles.push({
        selector: selector.trim(),
        properties: propsMap,
      });
    }

    return styles;
  }

  private extractComponentName(component: string): string {
    const match = component.match(/export\s+let\s+(\w+)/);
    return match ? match[1] : "Unknown";
  }

  private extractComponentType(component: string): string {
    const name = this.extractComponentName(component);
    return this.kebabCase(name);
  }

  private parseSvelteProps(component: string): any[] {
    const props: any[] = [];

    // Match export let declarations (Svelte 5)
    const letRegex = /export\s+let\s+(\w+)(?::\s*(\w+))?(?:\s*=\s*([^,;]+))?/g;
    let match;

    while ((match = letRegex.exec(component)) !== null) {
      const [, name, type, defaultValue] = match;
      props.push({
        name,
        type: type || "any",
        required: !defaultValue,
        default: defaultValue?.trim(),
      });
    }

    return props;
  }

  private parseSvelteState(component: string): any[] {
    const state: any[] = [];

    // Svelte 5 runes
    if (this.config.version === "5") {
      const stateRegex = /let\s+(\w+)\s*=\s*\$state\(([^)]*)\)/g;
      let match;

      while ((match = stateRegex.exec(component)) !== null) {
        const [, name, initial] = match;
        state.push({
          name,
          type: "any",
          initial,
          reactive: true,
          isRune: true,
        });
      }

      const derivedRegex = /let\s+(\w+)\s*=\s*\$derived\(([^)]*)\)/g;
      while ((match = derivedRegex.exec(component)) !== null) {
        const [, name, computation] = match;
        state.push({
          name,
          type: "Computed",
          computed: true,
          isRune: true,
          computation: computation.trim(),
        });
      }
    } else {
      // Svelte 3/4 reactive statements
      const reactiveRegex = /\$:\s*(\w+)\s*=\s*([^;]+)/g;
      let match;

      while ((match = reactiveRegex.exec(component)) !== null) {
        const [, name, value] = match;
        state.push({
          name,
          type: "any",
          initial: value.trim(),
          reactive: true,
        });
      }
    }

    return state;
  }

  private parseSvelteEvents(component: string): any[] {
    const events: any[] = [];

    // Match createEventDispatcher
    if (component.includes("createEventDispatcher")) {
      const dispatchMatch = component.match(
        /const\s+dispatch\s*=\s*createEventDispatcher<(\w+)>\(\)/
      );
      if (dispatchMatch) {
        events.push({
          name: "dispatch",
          type: dispatchMatch[1],
          payload: "any",
        });
      }
    }

    // Svelte 5 event runes
    const eventRegex = /const\s+(\w+)\s*=\s*\$event\(([^)]*)\)/g;
    let match;

    while ((match = eventRegex.exec(component)) !== null) {
      const [, name, detailType] = match;
      events.push({
        name,
        type: "CustomEvent",
        payload: detailType || "void",
        isRune: true,
      });
    }

    return events;
  }

  private detectSvelteFeatures(script: string): string[] {
    const features: string[] = [];

    if (this.config.version === "5") {
      if (script.includes("$state")) features.push("runes");
      if (script.includes("$derived")) features.push("runes");
      if (script.includes("$effect")) features.push("runes");
    } else {
      if (script.includes("$:")) features.push("reactive-statements");
    }

    if (script.includes("createEventDispatcher")) features.push("events");
    if (script.includes("spring")) features.push("transitions");
    if (script.includes("tweened")) features.push("transitions");
    if (script.includes("onMount")) features.push("lifecycle");
    if (script.includes("onDestroy")) features.push("lifecycle");
    if (script.includes("tick")) features.push("tick");
    if (script.includes("setContext")) features.push("context");
    if (script.includes("getContext")) features.push("context");
    if (script.includes("<svelte:component>"))
      features.push("dynamic-components");
    if (script.includes("<svelte:self>")) features.push("recursive");
    if (script.includes("<slot>")) features.push("slots");

    return features;
  }

  // ------------------------------------------------------------------------
  // React to Svelte Conversion
  // ------------------------------------------------------------------------

  private convertReactToSvelteScript(reactCode: string): string {
    const scriptLines: string[] = [];

    if (this.config.typescript) {
      scriptLines.push('<script lang="ts">');
    } else {
      scriptLines.push("<script>");
    }

    scriptLines.push("");

    // Convert props
    const props = this.parseReactProps(reactCode);
    for (const prop of props) {
      const optional = prop.required ? "" : " = undefined";
      scriptLines.push(`export let ${prop.name}${optional};`);
    }

    if (props.length > 0) scriptLines.push("");

    // Convert state
    const state = this.parseReactState(reactCode);
    if (this.config.version === "5") {
      // Use runes
      for (const s of state) {
        if (s.computed) {
          scriptLines.push(`let ${s.name} = $derived(${s.initial});`);
        } else {
          scriptLines.push(`let ${s.name} = $state(${s.initial || ""});`);
        }
      }
    } else {
      // Traditional Svelte
      for (const s of state) {
        scriptLines.push(`let ${s.name} = ${s.initial || ""};`);
      }
    }

    if (state.length > 0) scriptLines.push("");

    // Convert functions
    const functions = this.extractFunctions(reactCode);
    for (const func of functions) {
      scriptLines.push(func);
    }

    scriptLines.push("");
    scriptLines.push("</script>");

    return scriptLines.join("\n");
  }

  private convertJSXToSvelteTemplate(jsx: string): string {
    let template = jsx;

    // Convert className to class
    template = template.replace(/className=/g, "class=");

    // Convert onClick to on:click
    template = template.replace(/onClick=/g, "on:click=");
    template = template.replace(/onChange=/g, "on:change=");
    template = template.replace(/onInput=/g, "on:input=");
    template = template.replace(/onSubmit=/g, "on:submit=");

    // Convert {variable} (keep as is, Svelte uses same syntax)
    // No changes needed for variable interpolation

    // Convert self-closing tags
    template = template.replace(/<(\w+)([^>]*)\/>/g, "<$1$2 />");

    // Convert style={{}} to style=""
    template = template.replace(
      /style=\{\{\s*([^}]+)\s*\}\}/g,
      (match, styleObj) => {
        return `style="${this.styleObjectToCss(styleObj)}"`;
      }
    );

    return template.trim();
  }

  private extractStylesFromReact(reactCode: string): string {
    const styles: string[] = [];

    const styledRegex = /styled\.(\w+)\s*`([^`]*)`/g;
    let match;

    while ((match = styledRegex.exec(reactCode)) !== null) {
      const [, component, styleBlock] = match;
      styles.push(`.${component.toLowerCase()} {\n${styleBlock}\n}`);
    }

    return styles.join("\n\n");
  }

  private parseReactProps(reactCode: string): any[] {
    const props: any[] = [];

    const interfaceMatch = reactCode.match(
      /interface\s+(\w+Props)\s*{([^}]+)}/
    );
    if (interfaceMatch) {
      const propsBlock = interfaceMatch[2];
      const propLines = propsBlock.split(";").filter(line => line.trim());

      for (const line of propLines) {
        const match = line.match(/(\w+)(\?)?:\s*(\w+)/);
        if (match) {
          const [, name, optional, type] = match;
          props.push({
            name,
            type,
            required: !optional,
          });
        }
      }
    }

    return props;
  }

  private parseReactState(reactCode: string): any[] {
    const state: any[] = [];

    const useStateRegex =
      /const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState<([^>]*)>\s*\(([^)]*)\)/g;
    let match;

    while ((match = useStateRegex.exec(reactCode)) !== null) {
      const [, name, type, initial] = match;
      state.push({
        name,
        type,
        initial,
      });
    }

    return state;
  }

  private extractFunctions(code: string): string[] {
    const functions: string[] = [];

    const functionRegex =
      /(?:const|function)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:\([^)]*\)\s*=>|function)/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const funcName = match[1];
      // Skip hooks
      if (!funcName.startsWith("use")) {
        const funcCode = this.extractFunctionCode(code, match.index);
        functions.push(funcCode);
      }
    }

    return functions;
  }

  private extractFunctionCode(code: string, startIndex: number): string {
    const afterStart = code.substring(startIndex);
    let braceCount = 0;
    let startIndexBrace = -1;
    let endIndex = -1;
    let foundArrow = false;

    for (let i = 0; i < afterStart.length; i++) {
      const char = afterStart[i];
      if (char === "=" && !foundArrow) {
        continue;
      }
      if (char === "{" && !foundArrow) {
        foundArrow = true;
      }
      if (char === "{") {
        if (startIndexBrace === -1) {
          startIndexBrace = i;
        }
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && startIndexBrace !== -1) {
          endIndex = i + 1;
          break;
        }
      }
    }

    return afterStart.substring(0, endIndex);
  }

  private svelteToReact(component: ParsedComponent): any {
    const props = component.props.map((p: any) => ({
      name: p.name,
      type: p.type,
      required: p.required,
    }));

    return {
      name: component.name,
      type: component.type,
      props,
      state: component.state,
      events: component.events,
    };
  }

  // ------------------------------------------------------------------------
  // Svelte Component Generation
  // ------------------------------------------------------------------------

  private generateSvelteComponent(spec: ComponentSpec): SvelteCode {
    const script = this.generateSvelteScriptSection(spec);
    const template = this.generateSvelteTemplateSection(spec);
    const style = this.generateSvelteStyleSection(spec.name);

    return {
      script,
      template,
      style,
    };
  }

  private generateSvelteScriptSection(spec: ComponentSpec): string {
    const lines: string[] = [];

    if (this.config.typescript) {
      lines.push('<script lang="ts">');
    } else {
      lines.push("<script>");
    }

    lines.push("");
    lines.push(`// ${spec.name} component`);
    lines.push("");

    // Add props
    for (const [key, value] of Object.entries(spec.props)) {
      const type = this.inferPropType(value);
      lines.push(`export let ${key}: ${type};`);
    }

    if (Object.keys(spec.props).length > 0) {
      lines.push("");
    }

    lines.push("</script>");

    return lines.join("\n");
  }

  private generateSvelteTemplateSection(spec: ComponentSpec): string {
    const tag = this.kebabCase(spec.type);
    const attrs = Object.entries(spec.props)
      .map(([key, value]) => `${key}={${key}}`)
      .join(" ");

    let template = "";

    if (spec.children && spec.children.length > 0) {
      template = `<${tag}${attrs ? " " + attrs : ""}>\n`;
      for (const child of spec.children) {
        template += `  <${this.kebabCase(child.type)} />\n`;
      }
      template += `</${tag}>`;
    } else {
      template = `<${tag}${attrs ? " " + attrs : ""} />`;
    }

    return template;
  }

  private generateSvelteStyleSection(componentName: string): string {
    return `<style>
/* ${componentName} styles */
</style>`;
  }

  private inferPropType(value: any): string {
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "any[]";
    if (typeof value === "object") return "Record<string, any>";
    return "any";
  }

  private styleObjectToCss(styleObj: string): string {
    try {
      const obj = eval(`(${styleObj})`);
      return Object.entries(obj)
        .map(([key, value]) => `${this.kebabCase(key)}: ${value}`)
        .join("; ");
    } catch {
      return styleObj;
    }
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }
}
