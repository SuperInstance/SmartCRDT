/**
 * Vue Adapter - Convert React components to Vue
 * Supports Vue 2 and Vue 3 with Options API and Composition API
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  VueCode,
  VueAdapterConfig,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// Vue Adapter Configuration
// ============================================================================

const DEFAULT_VUE_CONFIG: VueAdapterConfig = {
  version: "vue3",
  script: "composition",
  style: "scoped",
  typescript: true,
};

// ============================================================================
// Vue Adapter Implementation
// ============================================================================

export class VueAdapter extends BaseFrameworkAdapter {
  name = "VueAdapter";
  framework: UIFramework = "vue";
  config: VueAdapterConfig;

  constructor(config: Partial<VueAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_VUE_CONFIG, ...config };
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
    // Parse Vue SFC (Single File Component)
    const template = this.extractTemplate(ui);
    const script = this.extractScript(ui);
    const style = this.extractStyle(ui);

    const components = this.extractComponentsFromTemplate(template);
    const styles = this.parseStyleBlock(style);

    return {
      framework: "vue",
      components,
      styles,
      imports: [],
      exports: [],
      metadata: {
        version: this.config.version,
        language: this.config.typescript ? "typescript" : "javascript",
        features: this.detectVueFeatures(script),
        dependencies: [],
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractComponentName(component);
    const type = this.extractComponentType(component);
    const props = this.parseVueProps(component);
    const state = this.parseVueState(component);
    const events = this.parseVueEvents(component);

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
  // React to Vue Conversion
  // ------------------------------------------------------------------------

  async convertFromReact(
    reactCode: string,
    componentName: string
  ): Promise<VueCode> {
    // Parse React code
    const props = this.parseReactProps(reactCode);
    const state = this.parseReactState(reactCode);
    const template = this.convertJSXToVueTemplate(reactCode);
    const script = this.convertReactToVueScript(reactCode, props, state);
    const style = this.extractStylesFromReact(reactCode);

    return {
      template,
      script,
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
      const vueCode = this.generateVueComponent(spec);
      const metadata: ConversionMetadata = {
        fromFramework: spec.framework,
        toFramework: "vue",
        componentsConverted: 1,
        linesOfCode:
          vueCode.template.split("\n").length +
          vueCode.script.split("\n").length +
          vueCode.style.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: vueCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "vue",
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
      scss: `.${selector} {\n${cssRules}\n}`,
      framework: "vue",
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
      return this.vueToReact(component);
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
  // Private Helper Methods - Vue SFC Parsing
  // ------------------------------------------------------------------------

  private extractTemplate(sfc: string): string {
    const match = sfc.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    return match ? match[1].trim() : "";
  }

  private extractScript(sfc: string): string {
    const match = sfc.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return match ? match[1].trim() : "";
  }

  private extractStyle(sfc: string): string {
    const match = sfc.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return match ? match[1].trim() : "";
  }

  private extractComponentsFromTemplate(template: string): ParsedComponent[] {
    const components: ParsedComponent[] = [];

    // Match component tags
    const componentRegex =
      /<([A-Z][a-zA-Z0-9]*)(?:\s+([^>]*?))?(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;
    let match;

    while ((match = componentRegex.exec(template)) !== null) {
      const [, name, attrs, content] = match;

      components.push({
        name,
        type: this.kebabCase(name),
        props: this.parseProps(attrs),
        state: [],
        events: this.parseEvents(attrs),
        children: content ? this.extractComponentsFromTemplate(content) : [],
        template: match[0],
      });
    }

    return components;
  }

  private parseStyleBlock(style: string): any[] {
    if (!style) return [];

    const styles: any[] = [];

    // Match CSS rules
    const ruleRegex = /\.([^{]+)\s*{([^}]+)}/g;
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
    const match = component.match(
      /(?:export\s+default\s+)?(?:const|function)\s+(\w+)/
    );
    return match ? match[1] : "Unknown";
  }

  private extractComponentType(component: string): string {
    const name = this.extractComponentName(component);
    return this.kebabCase(name);
  }

  private parseVueProps(component: string): any[] {
    const props: any[] = [];

    // Parse props definition in Options API
    const optionsMatch = component.match(/props:\s*{([^}]+)}/);
    if (optionsMatch) {
      const propsBlock = optionsMatch[1];
      const propLines = propsBlock.split(",").filter(line => line.trim());

      for (const line of propLines) {
        const match = line.match(/(\w+)(?::\s*(\w+))?(?:\s*=\s*([^,]+))?/);
        if (match) {
          const [, name, type, defaultValue] = match;
          props.push({
            name,
            type: type || "String",
            required: !defaultValue,
            default: defaultValue,
          });
        }
      }
    }

    // Parse withDefaults in Composition API
    const composeMatch = component.match(
      /(?:const\s+props\s*=\s*)?defineProps<([^>]+)>\(\)/
    );
    if (composeMatch) {
      const interfaceBlock = composeMatch[1];
      // Parse TypeScript interface for props
      const propMatches = interfaceBlock.match(/(\w+)(\?)?:\s*(\w+)/g);
      if (propMatches) {
        for (const propMatch of propMatches) {
          const [, name, optional, type] =
            propMatch.match(/(\w+)(\?)?:\s*(\w+)/) || [];
          props.push({
            name,
            type: type || "any",
            required: !optional,
          });
        }
      }
    }

    return props;
  }

  private parseVueState(component: string): any[] {
    const state: any[] = [];

    // Parse data in Options API
    const dataMatch = component.match(/data\(\)\s*{[\s\S]*?return\s*{([^}]+)}/);
    if (dataMatch) {
      const dataBlock = dataMatch[1];
      const properties = dataBlock.split(",").filter(p => p.trim());

      for (const prop of properties) {
        const match = prop.match(/(\w+)\s*(?::\s*=)?\s*(.*)/);
        if (match) {
          const [, name, initial] = match;
          state.push({
            name,
            type: this.inferTypeFromValue(initial),
            initial,
            reactive: true,
          });
        }
      }
    }

    // Parse ref/reactive in Composition API
    const refMatches = component.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(ref|reactive|computed)\s*<([^>]+)>\s*\(([^)]*)\)/g
    );
    for (const match of refMatches) {
      const [, name, api, type, initial] = match;
      state.push({
        name,
        type,
        initial,
        computed: api === "computed",
        reactive: true,
      });
    }

    return state;
  }

  private parseVueEvents(component: string): any[] {
    const events: any[] = [];

    // Parse emits in Options API
    const emitsMatch = component.match(/emits:\s*\[([^\]]+)\]/);
    if (emitsMatch) {
      const emitsBlock = emitsMatch[1];
      const eventNames = emitsBlock
        .split(",")
        .map(e => e.trim().replace(/['"]/g, ""));

      for (const name of eventNames) {
        events.push({
          name,
          type: "Event",
          payload: "any",
        });
      }
    }

    // Parse defineEmits in Composition API
    const defineEmitsMatch = component.match(
      /const\s+emit\s*=\s*defineEmits<\{([^}]+)\}>/
    );
    if (defineEmitsMatch) {
      const emitsBlock = defineEmitsMatch[1];
      const eventMatches = emitsBlock.match(/(\w+):\s*\(([^)]*)\)/g);

      if (eventMatches) {
        for (const eventMatch of eventMatches) {
          const [, name, payload] =
            eventMatch.match(/(\w+):\s*\(([^)]*)\)/) || [];
          events.push({
            name,
            type: "Event",
            payload: payload || "void",
          });
        }
      }
    }

    return events;
  }

  private detectVueFeatures(script: string): string[] {
    const features: string[] = [];

    if (script.includes("defineProps")) features.push("composition-api");
    if (script.includes("defineEmits")) features.push("composition-api");
    if (script.includes("ref")) features.push("reactivity");
    if (script.includes("reactive")) features.push("reactivity");
    if (script.includes("computed")) features.push("computed");
    if (script.includes("watch")) features.push("watchers");
    if (script.includes("watchEffect")) features.push("watchers");
    if (script.includes("onMounted")) features.push("lifecycle-hooks");
    if (script.includes("provide")) features.push("dependency-injection");
    if (script.includes("inject")) features.push("dependency-injection");
    if (script.includes("<Suspense>")) features.push("suspense");
    if (script.includes("Teleport")) features.push("teleport");
    if (script.includes("Transition")) features.push("transitions");
    if (script.includes("KeepAlive")) features.push("keep-alive");

    return features;
  }

  // ------------------------------------------------------------------------
  // React to Vue Conversion Methods
  // ------------------------------------------------------------------------

  private parseReactProps(reactCode: string): any[] {
    const props: any[] = [];

    // Extract interface definition
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
            type: this.mapReactTypeToVue(type),
            required: !optional,
          });
        }
      }
    }

    return props;
  }

  private parseReactState(reactCode: string): any[] {
    const state: any[] = [];

    // Parse useState hooks
    const useStateMatches = reactCode.matchAll(
      /const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState<([^>]*)>\s*\(([^)]*)\)/g
    );

    for (const match of useStateMatches) {
      const [, name, type, initial] = match;
      state.push({
        name,
        type,
        initial,
        reactive: true,
      });
    }

    return state;
  }

  private convertJSXToVueTemplate(jsx: string): string {
    let template = jsx;

    // Convert className to class
    template = template.replace(/className=/g, "class=");

    // Convert onClick to @click
    template = template.replace(/onClick=/g, "@click=");
    template = template.replace(/onChange=/g, "@change=");
    template = template.replace(/onInput=/g, "@input=");
    template = template.replace(/onSubmit=/g, "@submit=");

    // Convert self-closing tags
    template = template.replace(/<(\w+)([^>]*)\/>/g, (match, tag, attrs) => {
      return `<${tag}${attrs}></${tag}>`;
    });

    // Convert style object to string
    template = template.replace(/style=\{\{([^}]+)\}\}/g, (match, styleObj) => {
      return `style="${this.styleObjectToString(styleObj)}"`;
    });

    // Convert {variable} to {{ variable }}
    template = template.replace(/\{([^}]+)\}/g, (match, expression) => {
      if (!match.startsWith("{ ")) {
        return `{{ ${expression} }}`;
      }
      return match;
    });

    return template.trim();
  }

  private convertReactToVueScript(
    reactCode: string,
    props: any[],
    state: any[]
  ): string {
    const scriptLines: string[] = [];

    if (this.config.typescript) {
      scriptLines.push('<script setup lang="ts">');
    } else {
      scriptLines.push("<script setup>");
    }

    // Add imports
    scriptLines.push("");
    scriptLines.push("import { ref, reactive, computed } from 'vue';");
    scriptLines.push("");

    // Define props
    if (props.length > 0) {
      const propsInterface = this.generateVuePropsInterface(props);
      scriptLines.push(propsInterface);
      scriptLines.push("const props = defineProps<Props>();");
      scriptLines.push("");
    }

    // Define state
    for (const s of state) {
      if (s.computed) {
        scriptLines.push(`const ${s.name} = computed(() => ${s.initial});`);
      } else {
        scriptLines.push(
          `const ${s.name} = ref<${s.type}>(${s.initial || ""});`
        );
      }
    }

    // Copy over non-hook functions
    const functions = this.extractFunctions(reactCode);
    for (const func of functions) {
      scriptLines.push(func);
    }

    scriptLines.push("</script>");

    return scriptLines.join("\n");
  }

  private generateVuePropsInterface(props: any[]): string {
    const propsLines = props.map(p => {
      const optional = p.required ? "" : "?";
      return `  ${p.name}${optional}: ${p.type};`;
    });

    return `interface Props {\n${propsLines.join("\n")}\n}`;
  }

  private extractFunctions(code: string): string[] {
    const functions: string[] = [];

    // Match function definitions
    const functionRegex =
      /(?:const|function)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:\([^)]*\)\s*=>\s*{[\s\S]*?}|\([^)]*\)\s*{[\s\S]*?})/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const funcCode = match[0];
      // Exclude hooks
      if (
        !funcCode.includes("useState") &&
        !funcCode.includes("useEffect") &&
        !funcCode.includes("useCallback") &&
        !funcCode.includes("useMemo")
      ) {
        functions.push(funcCode);
      }
    }

    return functions;
  }

  private extractStylesFromReact(reactCode: string): string {
    // Extract styled-components or inline styles
    const styles: string[] = [];

    const styledRegex = /styled\.(\w+)\s*`([^`]*)`/g;
    let match;

    while ((match = styledRegex.exec(reactCode)) !== null) {
      const [, component, styleBlock] = match;
      styles.push(`.${component.toLowerCase()} {\n${styleBlock}\n}`);
    }

    return styles.join("\n\n");
  }

  private vueToReact(component: ParsedComponent): any {
    // Convert Vue component back to React
    const props = component.props.map(p => ({
      name: p.name,
      type: this.mapVueTypeToReact(p.type),
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
  // Vue Component Generation
  // ------------------------------------------------------------------------

  private generateVueComponent(spec: ComponentSpec): VueCode {
    const { type, name, props, children } = spec;

    const template = this.generateVueTemplate(type, props, children || []);
    const script = this.generateVueScriptSection(name, props);
    const style = this.generateVueStyleSection(name);

    return {
      template,
      script,
      style,
    };
  }

  private generateVueTemplate(
    type: string,
    props: Record<string, any>,
    children: ComponentSpec[]
  ): string {
    const tag = this.kebabCase(type);
    const attrs = Object.entries(props)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");

    let template = `<template>\n`;
    template += `  <${tag}${attrs ? " " + attrs : ""}`;

    if (children.length === 0) {
      template += ` />\n`;
    } else {
      template += `>\n`;
      for (const child of children) {
        template += `    <${this.kebabCase(child.type)} />\n`;
      }
      template += `  </${tag}>\n`;
    }

    template += `</template>`;

    return template;
  }

  private generateVueScriptSection(
    componentName: string,
    props: Record<string, any>
  ): string {
    const scriptLines: string[] = [];

    if (this.config.typescript) {
      scriptLines.push(`<script setup lang="ts">`);
    } else {
      scriptLines.push(`<script setup>`);
    }

    scriptLines.push("");
    scriptLines.push(`// ${componentName} component`);
    scriptLines.push("");

    if (Object.keys(props).length > 0) {
      scriptLines.push("const props = defineProps<{");
      Object.entries(props).forEach(([key, value]) => {
        const type = this.inferPropType(value);
        scriptLines.push(`  ${key}: ${type},`);
      });
      scriptLines.push("}>();");
      scriptLines.push("");
    }

    scriptLines.push("</script>");

    return scriptLines.join("\n");
  }

  private generateVueStyleSection(componentName: string): string {
    const scopedAttr = this.config.style === "scoped" ? " scoped" : "";
    return `<style${scopedAttr}>\n/* ${componentName} styles */\n</style>`;
  }

  // ------------------------------------------------------------------------
  // Type Mapping Helpers
  // ------------------------------------------------------------------------

  private mapReactTypeToVue(reactType: string): string {
    const typeMap: Record<string, string> = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      object: "Object",
      array: "Array",
      function: "Function",
      any: "any",
      void: "undefined",
    };

    return typeMap[reactType] || reactType;
  }

  private mapVueTypeToReact(vueType: string): string {
    const typeMap: Record<string, string> = {
      String: "string",
      Number: "number",
      Boolean: "boolean",
      Object: "object",
      Array: "array",
      Function: "function",
    };

    return typeMap[vueType] || vueType.toLowerCase();
  }

  private inferTypeFromValue(value: string): string {
    value = value.trim();
    if (value.startsWith("'") || value.startsWith('"')) return "string";
    if (!isNaN(Number(value))) return "number";
    if (value === "true" || value === "false") return "boolean";
    if (value.startsWith("[")) return "array";
    if (value.startsWith("{")) return "object";
    return "any";
  }

  private inferPropType(value: any): string {
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return "any";
  }

  private styleObjectToString(styleObj: string): string {
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

  private parseProps(attrs: string): any[] {
    const props: any[] = [];

    if (!attrs) return props;

    const attrPairs = attrs.split(/\s+/);
    for (const pair of attrPairs) {
      const [name, value] = pair.split("=");
      if (name && value) {
        props.push({
          name,
          value: value.replace(/['"]/g, ""),
        });
      }
    }

    return props;
  }

  private parseEvents(attrs: string): any[] {
    const events: any[] = [];

    if (!attrs) return events;

    const eventMatches = attrs.matchAll(
      /@(\w+)=(?:["']([^"']+)["']|{([^}]+)})/g
    );
    for (const match of eventMatches) {
      const [, name, , handler] = match;
      events.push({
        name,
        type: "Event",
        handler: handler || name,
      });
    }

    return events;
  }
}
