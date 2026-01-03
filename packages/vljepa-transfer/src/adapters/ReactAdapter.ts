/**
 * React Adapter - Base adapter for React components
 * Serves as the foundation for transfer learning to other frameworks
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ParsedStyle,
  ParsedImport,
  ComponentSpec,
  StyleSpec,
  ReactCode,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// React Adapter Implementation
// ============================================================================

export class ReactAdapter extends BaseFrameworkAdapter {
  name = "ReactAdapter";
  framework: UIFramework = "react";

  constructor() {
    super();
    this.initializeSupportedComponents();
  }

  private initializeSupportedComponents(): void {
    // Common React components
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
      "Box",
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
      "Backdrop",
      "CircularProgress",
      "LinearProgress",
    ];

    components.forEach(comp => this.supportedComponents.add(comp));
  }

  // ------------------------------------------------------------------------
  // Parsing Methods
  // ------------------------------------------------------------------------

  async parseUI(ui: string): Promise<ParsedUI> {
    const components = this.extractComponents(ui);
    const styles = this.extractStyles(ui);
    const imports = this.extractImportsFromCode(ui);
    const exports = this.extractExportsFromCode(ui);

    return {
      framework: "react",
      components,
      styles,
      imports,
      exports,
      metadata: {
        language: "typescript",
        features: this.detectFeatures(ui),
        dependencies: imports.map(imp => imp.module),
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractComponentName(component);
    const type = this.extractComponentType(component);
    const props = this.parseProps(component);
    const state = this.parseState(component);
    const events = this.parseEvents(component);

    return {
      name,
      type,
      props,
      state,
      events,
      children: [],
      template: component,
      script: component,
      styles: [],
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
      if (!this.isSupported(spec.type)) {
        errors.push(`Component type '${spec.type}' is not supported`);
        return this.createErrorResult(errors, {
          framework: "react",
          components: [],
          styles: [],
          imports: [],
          exports: [],
          metadata: { language: "typescript", features: [], dependencies: [] },
        });
      }

      const code = this.generateReactComponent(spec);
      const imports = this.generateImports(spec);

      const metadata: ConversionMetadata = {
        fromFramework: "react",
        toFramework: "react",
        componentsConverted: 1,
        linesOfCode: code.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: { component: code, imports } as ReactCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "react",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: { language: "typescript", features: [], dependencies: [] },
      });
    }
  }

  async generateStyle(spec: StyleSpec): Promise<any> {
    const properties = spec.properties;
    const cssRules = Object.entries(properties)
      .map(([prop, value]) => `  ${this.kebabCase(prop)}: ${value};`)
      .join("\n");

    return {
      css: `.${spec.selector} {\n${cssRules}\n}`,
      framework: "react",
    };
  }

  // ------------------------------------------------------------------------
  // Protected Helper Methods
  // ------------------------------------------------------------------------

  protected canConvertTo(targetFramework: UIFramework): boolean {
    const convertibleFrameworks: UIFramework[] = [
      "vue",
      "angular",
      "svelte",
      "flutter",
      "swiftui",
    ];
    return convertibleFrameworks.includes(targetFramework);
  }

  protected async convertComponent(
    component: ParsedComponent,
    targetFramework: UIFramework
  ): Promise<any> {
    // This would be implemented by the target adapter
    return component;
  }

  protected async convertStyle(
    style: ParsedStyle,
    targetFramework: UIFramework
  ): Promise<any> {
    // This would be implemented by the target adapter
    return style;
  }

  protected async combineCode(
    components: any[],
    styles: any[],
    targetFramework: UIFramework
  ): Promise<any> {
    // This would be implemented by the target adapter
    return { components, styles };
  }

  // ------------------------------------------------------------------------
  // Private Helper Methods
  // ------------------------------------------------------------------------

  private extractComponents(code: string): ParsedComponent[] {
    const components: ParsedComponent[] = [];

    // Match functional components
    const functionComponentRegex =
      /(?:export\s+)?(?:const|function)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:async\s+)?\(\s*{?\s*([^)}]*)\s*}?\s*\)\s*[:=>]\s*{/g;
    let match;

    while ((match = functionComponentRegex.exec(code)) !== null) {
      const componentName = match[1];
      const propsParam = match[2];

      // Skip non-component functions
      if (componentName[0].toLowerCase() === componentName[0]) {
        continue;
      }

      const componentCode = this.extractFunctionBody(code, match.index);
      const component = await this.parseComponent(componentCode);
      components.push(component);
    }

    return components;
  }

  private extractStyles(code: string): ParsedStyle[] {
    const styles: ParsedStyle[] = [];

    // Extract styled-components or inline styles
    const styledRegex = /styled\.(\w+)\s*`([^`]*)`/g;
    let match;

    while ((match = styledRegex.exec(code)) !== null) {
      const component = match[1];
      const styleBlock = match[2];

      const properties = this.parseStyleProperties(styleBlock);
      styles.push({
        selector: component,
        properties,
      });
    }

    return styles;
  }

  private extractImportsFromCode(code: string): ParsedImport[] {
    const imports: ParsedImport[] = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const importRegex =
        /import\s+(?:(\w+)\s*,?\s*)?(?:{\s*([^}]*)\s*})?\s*(?:as\s+(\w+))?\s+from\s+['"]([^'"]+)['"]/;
      const match = line.match(importRegex);

      if (match) {
        const [, defaultImport, namedImports, , module] = match;
        const importList: string[] = [];

        if (defaultImport) {
          importList.push(defaultImport);
        }

        if (namedImports) {
          const named = namedImports
            .split(",")
            .map(s => s.trim().split(/\s+as\s+/)[0]);
          importList.push(...named);
        }

        imports.push({
          module,
          imports: importList,
          isDefault: !!defaultImport,
          line: i + 1,
        });
      }
    }

    return imports;
  }

  private extractExportsFromCode(code: string): any[] {
    const exports: any[] = [];

    // Default exports
    const defaultExportRegex = /export\s+default\s+(\w+)/g;
    let match;

    while ((match = defaultExportRegex.exec(code)) !== null) {
      exports.push({
        name: match[1],
        type: "default",
        line: code.substring(0, match.index).split("\n").length,
      });
    }

    // Named exports
    const namedExportRegex = /export\s+(?:const|function|class)\s+(\w+)/g;
    while ((match = namedExportRegex.exec(code)) !== null) {
      exports.push({
        name: match[1],
        type: "named",
        line: code.substring(0, match.index).split("\n").length,
      });
    }

    return exports;
  }

  private extractComponentName(component: string): string {
    const nameMatch = component.match(/(?:const|function)\s+(\w+)/);
    return nameMatch ? nameMatch[1] : "Unknown";
  }

  private extractComponentType(component: string): string {
    // Try to infer the component type from its name or usage
    const name = this.extractComponentName(component);

    const typeMap: Record<string, string> = {
      Button: "button",
      Input: "input",
      TextField: "text-field",
      Select: "select",
      Checkbox: "checkbox",
      Card: "card",
      Modal: "modal",
      Table: "table",
      List: "list",
      Grid: "grid",
    };

    for (const [key, type] of Object.entries(typeMap)) {
      if (name.includes(key)) {
        return type;
      }
    }

    return "component";
  }

  private extractFunctionBody(code: string, startIndex: number): string {
    const afterStart = code.substring(startIndex);
    const openBraceIndex = afterStart.indexOf("{");

    if (openBraceIndex === -1) {
      return "";
    }

    let braceCount = 0;
    let endIndex = openBraceIndex;

    for (let i = openBraceIndex; i < afterStart.length; i++) {
      if (afterStart[i] === "{") {
        braceCount++;
      } else if (afterStart[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    return code.substring(startIndex, startIndex + endIndex);
  }

  private parseStyleProperties(styleBlock: string): Record<string, string> {
    const properties: Record<string, string> = {};

    const lines = styleBlock.split(";").filter(line => line.trim());
    for (const line of lines) {
      const [prop, value] = line.split(":").map(s => s.trim());
      if (prop && value) {
        properties[prop] = value;
      }
    }

    return properties;
  }

  private detectFeatures(code: string): string[] {
    const features: string[] = [];

    if (code.includes("useState")) features.push("hooks");
    if (code.includes("useEffect")) features.push("side-effects");
    if (code.includes("useContext")) features.push("context");
    if (code.includes("useReducer")) features.push("reducer");
    if (code.includes("useMemo")) features.push("memoization");
    if (code.includes("useCallback")) features.push("callbacks");
    if (code.includes("useRef")) features.push("refs");
    if (code.includes("useImperativeHandle")) features.push("imperative");
    if (code.includes("useLayoutEffect")) features.push("layout-effects");
    if (code.includes("useDeferredValue")) features.push("concurrency");
    if (code.includes("useTransition")) features.push("concurrency");
    if (code.includes("Suspense")) features.push("suspense");
    if (code.includes("lazy")) features.push("code-splitting");
    if (code.includes("ErrorBoundary")) features.push("error-boundary");

    return features;
  }

  private generateReactComponent(spec: ComponentSpec): string {
    const { type, name, props, children } = spec;

    // Generate props interface
    const propsInterface = this.generatePropsInterface(name, props);

    // Generate component function
    const componentFunction = this.generateComponentFunction(
      name,
      props,
      children || []
    );

    return `${propsInterface}\n\n${componentFunction}`;
  }

  private generatePropsInterface(
    componentName: string,
    props: Record<string, any>
  ): string {
    const propEntries = Object.entries(props);
    if (propEntries.length === 0) {
      return `interface ${componentName}Props {}`;
    }

    const propsCode = propEntries
      .map(([name, value]) => {
        const type = this.inferPropType(value);
        const optional = value === undefined ? "?" : "";
        return `  ${name}${optional}: ${type};`;
      })
      .join("\n");

    return `interface ${componentName}Props {\n${propsCode}\n}`;
  }

  private inferPropType(value: any): string {
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "any[]";
    if (typeof value === "object" && value !== null)
      return "Record<string, any>";
    return "any";
  }

  private generateComponentFunction(
    name: string,
    props: Record<string, any>,
    children: ComponentSpec[]
  ): string {
    const propNames = Object.keys(props);
    const propsParam =
      propNames.length > 0 ? `{ ${propNames.join(", ")} }` : "";

    let body = `  return (\n    <${name} />\n  );`;

    if (children.length > 0) {
      const childrenCode = children
        .map(child => `      <${child.type} />`)
        .join("\n");
      body = `  return (\n    <${name}>\n${childrenCode}\n    </${name}>\n  );`;
    }

    return `export function ${name}(${propsParam}: ${name}Props) {\n${body}\n}`;
  }

  private generateImports(spec: ComponentSpec): string[] {
    const imports: string[] = ["import React from 'react';"];

    // Add framework-specific imports based on component type
    if (spec.type === "Button" || spec.type === "Input") {
      imports.push("import { Box } from '@mui/material';");
    }

    return imports;
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }
}
