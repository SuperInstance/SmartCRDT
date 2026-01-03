/**
 * Angular Adapter - Convert React components to Angular
 * Supports Angular 15-18 with standalone components and signals
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  AngularCode,
  AngularAdapterConfig,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// Angular Adapter Configuration
// ============================================================================

const DEFAULT_ANGULAR_CONFIG: AngularAdapterConfig = {
  version: "17",
  standalone: true,
  signals: true,
  typescript: true,
};

// ============================================================================
// Angular Adapter Implementation
// ============================================================================

export class AngularAdapter extends BaseFrameworkAdapter {
  name = "AngularAdapter";
  framework: UIFramework = "angular";
  config: AngularAdapterConfig;

  constructor(config: Partial<AngularAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ANGULAR_CONFIG, ...config };
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
    const components = this.extractAngularComponents(ui);
    const styles = this.extractAngularStyles(ui);
    const imports = this.extractAngularImports(ui);

    return {
      framework: "angular",
      components,
      styles,
      imports,
      exports: [],
      metadata: {
        version: this.config.version,
        language: this.config.typescript ? "typescript" : "javascript",
        features: this.detectAngularFeatures(ui),
        dependencies: imports.map(imp => imp.module),
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractComponentName(component);
    const type = this.extractComponentType(component);
    const props = this.parseAngularInputs(component);
    const events = this.parseAngularOutputs(component);
    const state = this.parseAngularState(component);

    return {
      name,
      type,
      props,
      state,
      events,
      children: [],
      template: this.extractTemplate(component),
      script: component,
      styles: [this.extractInlineStyles(component)],
    };
  }

  // ------------------------------------------------------------------------
  // React to Angular Conversion
  // ------------------------------------------------------------------------

  async convertFromReact(
    reactCode: string,
    componentName: string
  ): Promise<AngularCode> {
    const component = this.convertReactToAngularComponent(
      reactCode,
      componentName
    );
    const template = this.convertJSXToAngularTemplate(reactCode);
    const service = this.convertReactHooksToService(reactCode);
    const module = this.config.standalone ? undefined : this.generateNgModule();

    return {
      component,
      template,
      service,
      module,
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
      const angularCode = this.generateAngularComponent(spec);
      const metadata: ConversionMetadata = {
        fromFramework: spec.framework,
        toFramework: "angular",
        componentsConverted: 1,
        linesOfCode:
          angularCode.component.split("\n").length +
          angularCode.template.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: angularCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "angular",
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
      framework: "angular",
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
      return this.angularToReact(component);
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
  // Private Helper Methods - Angular Parsing
  // ------------------------------------------------------------------------

  private extractAngularComponents(code: string): ParsedComponent[] {
    const components: ParsedComponent[] = [];

    // Match @Component decorators
    const componentRegex =
      /@Component\(\s*{\s*selector:\s*['"]([^'"]+)['"][\s\S]*?}\s*\)\s*export\s+class\s+(\w+)/g;
    let match;

    while ((match = componentRegex.exec(code)) !== null) {
      const [, selector, className] = match;
      const componentCode = this.extractClassCode(code, match.index, className);

      components.push({
        name: className,
        type: this.componentNameToType(className),
        props: this.parseAngularInputs(componentCode),
        state: this.parseAngularState(componentCode),
        events: this.parseAngularOutputs(componentCode),
        children: [],
        template: this.extractTemplate(componentCode),
        script: componentCode,
        styles: [this.extractInlineStyles(componentCode)],
      });
    }

    return components;
  }

  private extractAngularStyles(code: string): any[] {
    const styles: any[] = [];

    // Match styleUrls or inline styles
    const styleUrlsMatch = code.match(/styleUrls:\s*\[\s*['"]([^'"]+)['"]/);
    if (styleUrlsMatch) {
      styles.push({
        type: "external",
        url: styleUrlsMatch[1],
      });
    }

    const inlineStylesMatch = code.match(/styles:\s*\[\s*`([^`]*)`\s*\]/);
    if (inlineStylesMatch) {
      const styleBlock = inlineStylesMatch[1];
      styles.push(...this.parseStyleBlock(styleBlock));
    }

    return styles;
  }

  private extractAngularImports(code: string): any[] {
    const imports: any[] = [];
    const importRegex =
      /import\s+{\s*([^}]+)\s*}\s+from\s+['"]@angular\/([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      const [, symbols, module] = match;
      imports.push({
        module: `@angular/${module}`,
        imports: symbols.split(",").map(s => s.trim()),
      });
    }

    return imports;
  }

  private extractComponentName(component: string): string {
    const match = component.match(/export\s+class\s+(\w+)/);
    return match ? match[1] : "Unknown";
  }

  private extractComponentType(component: string): string {
    const name = this.extractComponentName(component);
    return this.componentNameToType(name);
  }

  private componentNameToType(name: string): string {
    // Remove Component suffix and convert to kebab-case
    return name
      .replace(/Component$/, "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();
  }

  private parseAngularInputs(component: string): any[] {
    const inputs: any[] = [];

    // Match @Input decorators
    const inputRegex =
      /@Input\(\)\s+(?:readonly\s+)?(\w+)(?::\s*(\w+))?(?:\s*=\s*([^;]+))?;/g;
    let match;

    while ((match = inputRegex.exec(component)) !== null) {
      const [, name, type, defaultValue] = match;
      inputs.push({
        name,
        type: type || "any",
        required: !defaultValue,
        default: defaultValue?.trim(),
      });
    }

    // Parse signals for Angular 16+
    if (this.config.signals) {
      const signalRegex = /readonly\s+(\w+)\s*=\s+input<([^>]+)>\(\);/g;
      while ((match = signalRegex.exec(component)) !== null) {
        const [, name, type] = match;
        inputs.push({
          name,
          type,
          required: true,
          isSignal: true,
        });
      }

      const optionalSignalRegex =
        /readonly\s+(\w+)\s*=\s+input\.required<([^>]+)>\(\);/g;
      while ((match = optionalSignalRegex.exec(component)) !== null) {
        const [, name, type] = match;
        inputs.push({
          name,
          type,
          required: true,
          isSignal: true,
        });
      }
    }

    return inputs;
  }

  private parseAngularOutputs(component: string): any[] {
    const outputs: any[] = [];

    // Match @Output decorators
    const outputRegex =
      /@Output\(\)\s+(\w+)\s*=\s+new\s+EventEmitter<([^>]*)>\(\);/g;
    let match;

    while ((match = outputRegex.exec(component)) !== null) {
      const [, name, type] = match;
      outputs.push({
        name,
        type,
        payload: type || "void",
      });
    }

    // Parse output signals for Angular 16+
    if (this.config.signals) {
      const outputSignalRegex = /readonly\s+(\w+)\s*=\s+output<([^>]+)>\(\);/g;
      while ((match = outputSignalRegex.exec(component)) !== null) {
        const [, name, type] = match;
        outputs.push({
          name,
          type,
          payload: type || "void",
          isSignal: true,
        });
      }
    }

    return outputs;
  }

  private parseAngularState(component: string): any[] {
    const state: any[] = [];

    // Parse signals
    if (this.config.signals) {
      const signalRegex =
        /(?:readonly\s+)?(\w+)\s*=\s+signal<([^>]+)>\(([^)]*)\);/g;
      let match;

      while ((match = signalRegex.exec(component)) !== null) {
        const [, name, type, initial] = match;
        state.push({
          name,
          type,
          initial,
          reactive: true,
          isSignal: true,
        });
      }

      // Parse computed signals
      const computedRegex =
        /(?:readonly\s+)?(\w+)\s*=\s+computed\(\(\)\s*=>\s*([^)]+)\);/g;
      while ((match = computedRegex.exec(component)) !== null) {
        const [, name, computation] = match;
        state.push({
          name,
          type: "ComputedSignal",
          computed: true,
          isSignal: true,
          computation: computation.trim(),
        });
      }
    }

    // Parse traditional properties
    const propertyRegex = /(\w+)(\?)?:\s*(\w+)(?:\s*=\s*([^;]+))?;/g;
    let propMatch;

    while ((propMatch = propertyRegex.exec(component)) !== null) {
      const [, name, optional, type, initial] = propMatch;
      // Skip inputs and outputs
      if (
        !component.includes(`@Input() ${name}`) &&
        !component.includes(`@Output() ${name}`)
      ) {
        state.push({
          name,
          type,
          initial,
          reactive: false,
        });
      }
    }

    return state;
  }

  private extractTemplate(component: string): string {
    // Match templateUrl or inline template
    const templateUrlMatch = component.match(/templateUrl:\s*['"]([^'"]+)['"]/);
    if (templateUrlMatch) {
      return `[External: ${templateUrlMatch[1]}]`;
    }

    const inlineTemplateMatch = component.match(/template:\s*`([^`]*)`/);
    if (inlineTemplateMatch) {
      return inlineTemplateMatch[1].trim();
    }

    return "";
  }

  private extractInlineStyles(component: string): string {
    const stylesMatch = component.match(/styles:\s*\[\s*`([^`]*)`\s*\]/);
    return stylesMatch ? stylesMatch[1] : "";
  }

  private extractClassCode(
    code: string,
    startIndex: number,
    className: string
  ): string {
    const afterStart = code.substring(startIndex);
    const classIndex = afterStart.indexOf(`class ${className}`);

    if (classIndex === -1) {
      return "";
    }

    let braceCount = 0;
    let startBrace = false;
    let endIndex = classIndex;

    for (let i = classIndex; i < afterStart.length; i++) {
      const char = afterStart[i];
      if (char === "{") {
        braceCount++;
        startBrace = true;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && startBrace) {
          endIndex = i + 1;
          break;
        }
      }
    }

    return afterStart.substring(classIndex, endIndex);
  }

  private detectAngularFeatures(code: string): string[] {
    const features: string[] = [];

    if (code.includes("standalone: true")) features.push("standalone");
    if (code.includes("signal(")) features.push("signals");
    if (code.includes("computed(")) features.push("computed-signals");
    if (code.includes("effect(")) features.push("effects");
    if (code.includes("input(")) features.push("input-signals");
    if (code.includes("output(")) features.push("output-signals");
    if (code.includes("@Inject")) features.push("dependency-injection");
    if (code.includes("RxJS")) features.push("rxjs");
    if (code.includes("async pipe")) features.push("async-pipe");
    if (code.includes("*ngFor")) features.push("structural-directives");
    if (code.includes("*ngIf")) features.push("structural-directives");
    if (code.includes("[formGroup]")) features.push("reactive-forms");
    if (code.includes("ngModel")) features.push("template-driven-forms");
    if (code.includes("@HostListener")) features.push("host-listener");
    if (code.includes("@HostBinding")) features.push("host-binding");
    if (code.includes("OnPush")) features.push("on-push");

    return features;
  }

  // ------------------------------------------------------------------------
  // React to Angular Conversion
  // ------------------------------------------------------------------------

  private convertReactToAngularComponent(
    reactCode: string,
    componentName: string
  ): string {
    const imports = this.convertReactImportsToAngular(reactCode);
    const inputs = this.convertReactPropsToAngularInputs(reactCode);
    const outputs = this.convertReactEventsToAngularOutputs(reactCode);
    const state = this.convertReactStateToAngularSignals(reactCode);
    const methods = this.extractReactMethods(reactCode);

    const lines: string[] = [];

    // Add imports
    lines.push(...imports);
    lines.push("");

    // Component decorator
    lines.push(`@Component({`);
    lines.push(`  selector: 'app-${this.kebabCase(componentName)}',`);
    lines.push(`  standalone: ${this.config.standalone},`);
    lines.push(`  imports: [CommonModule],`);
    lines.push(
      `  templateUrl: './${this.kebabCase(componentName)}.component.html',`
    );
    lines.push(
      `  styleUrl: './${this.kebabCase(componentName)}.component.css'`
    );
    lines.push(`})`);
    lines.push(`export class ${componentName}Component {`);
    lines.push("");

    // Add inputs
    for (const input of inputs) {
      if (this.config.signals) {
        lines.push(`  ${input.name} = input<${input.type}>();`);
      } else {
        lines.push(
          `  @Input() ${input.name}${input.required ? "" : "?"}: ${input.type};`
        );
      }
    }

    if (inputs.length > 0) lines.push("");

    // Add outputs
    for (const output of outputs) {
      if (this.config.signals) {
        lines.push(`  ${output.name} = output<${output.payload}>();`);
      } else {
        lines.push(
          `  @Output() ${output.name} = new EventEmitter<${output.payload}>();`
        );
      }
    }

    if (outputs.length > 0) lines.push("");

    // Add state
    for (const s of state) {
      if (s.isSignal) {
        lines.push(`  ${s.name} = signal<${s.type}>(${s.initial});`);
      } else {
        lines.push(`  ${s.name}: ${s.type} = ${s.initial};`);
      }
    }

    if (state.length > 0) lines.push("");

    // Add methods
    for (const method of methods) {
      lines.push(`  ${method}`);
    }

    lines.push("");
    lines.push("}");

    return lines.join("\n");
  }

  private convertJSXToAngularTemplate(jsx: string): string {
    let template = jsx;

    // Convert className to class
    template = template.replace(/className=/g, "class=");

    // Convert onClick to (click)
    template = template.replace(/onClick=/g, "(click)=");
    template = template.replace(/onChange=/g, "(change)=");
    template = template.replace(/onInput=/g, "(input)=");
    template = template.replace(/onSubmit=/g, "(submit)=");

    // Convert {variable} to {{ variable }}
    template = template.replace(/\{([^}]+)\}/g, "{{$1}}");

    // Convert self-closing tags
    template = template.replace(/<(\w+)([^>]*)\/>/g, "<$1$2></$1>");

    // Convert * structural directives
    // Convert Array.map to *ngFor
    template = template.replace(
      /\{([^}]+)\.map\((\w+)\s*=>\s*\(/g,
      '*ngFor="let $2 of $1"'
    );

    // Convert conditional && to *ngIf
    template = template.replace(
      /\{([^}]+)\s*&&\s*<([^>]+)>/g,
      '<$2 *ngIf="$1">'
    );

    // Convert ternary to ngIf/else
    template = template.replace(
      /\{([^?]+)\s*\?\s*([^:]+)\s*:\s*([^}]+)\}/g,
      '<ng-container *ngIf="$1; then $2Template; else $3Template"></ng-container>'
    );

    return template.trim();
  }

  private convertReactHooksToService(reactCode: string): string | undefined {
    const hasStateManagement =
      reactCode.includes("useState") ||
      reactCode.includes("useReducer") ||
      reactCode.includes("useContext");

    if (!hasStateManagement) {
      return undefined;
    }

    const serviceName = this.extractServiceName(reactCode);
    const lines: string[] = [];

    lines.push(`import { Injectable } from '@angular/core';`);
    if (this.config.signals) {
      lines.push(`import { signal, computed } from '@angular/core';`);
    }
    lines.push("");
    lines.push(`@Injectable({`);
    lines.push(`  providedIn: 'root'`);
    lines.push(`})`);
    lines.push(`export class ${serviceName} {`);
    lines.push("");
    lines.push(`  constructor() {}`);
    lines.push("");
    lines.push(`}`);

    return lines.join("\n");
  }

  private generateNgModule(): string {
    return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [],
  imports: [CommonModule],
  exports: []
})
export class AppModule { }`;
  }

  private convertReactImportsToAngular(reactCode: string): string[] {
    const imports: string[] = [];

    imports.push(
      "import { Component, Input, Output, EventEmitter } from '@angular/core';"
    );
    imports.push("import { CommonModule } from '@angular/common';");

    if (this.config.signals) {
      imports.push(
        "import { signal, computed, input, output } from '@angular/core';"
      );
    }

    return imports;
  }

  private convertReactPropsToAngularInputs(reactCode: string): any[] {
    const inputs: any[] = [];

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
          inputs.push({
            name,
            type: this.mapReactTypeToAngular(type),
            required: !optional,
          });
        }
      }
    }

    return inputs;
  }

  private convertReactEventsToAngularOutputs(reactCode: string): any[] {
    const outputs: any[] = [];

    const eventHandlerRegex = /on(\w+)\s*=\s*{\s*(\w+|\([^)]*\)\s*=>)/g;
    let match;

    while ((match = eventHandlerRegex.exec(reactCode)) !== null) {
      const [, eventName] = match;
      outputs.push({
        name: eventName,
        type: "EventEmitter",
        payload: "any",
      });
    }

    return outputs;
  }

  private convertReactStateToAngularSignals(reactCode: string): any[] {
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
        isSignal: this.config.signals,
        reactive: true,
      });
    }

    return state;
  }

  private extractReactMethods(reactCode: string): string[] {
    const methods: string[] = [];

    // Match function definitions in component
    const functionRegex =
      /(?:const|function)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:\([^)]*\)\s*=>\s*{[\s\S]*?}|\([^)]*\)\s*{[\s\S]*?})/g;
    let match;

    while ((match = functionRegex.exec(reactCode)) !== null) {
      const funcCode = match[0];
      // Exclude hooks and event handlers
      if (
        !funcCode.includes("useState") &&
        !funcCode.includes("useEffect") &&
        !funcCode.includes("useCallback") &&
        !funcCode.includes("useMemo") &&
        !funcCode.includes("set")
      ) {
        methods.push(funcCode + ";");
      }
    }

    return methods;
  }

  private extractServiceName(reactCode: string): string {
    const componentNameMatch = reactCode.match(/(?:const|function)\s+(\w+)/);
    const componentName = componentNameMatch
      ? componentNameMatch[1]
      : "Component";
    return `${componentName}Service`;
  }

  private angularToReact(component: ParsedComponent): any {
    // Convert Angular component back to React
    const props = component.props.map((p: any) => ({
      name: p.name,
      type: this.mapAngularTypeToReact(p.type),
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
  // Angular Component Generation
  // ------------------------------------------------------------------------

  private generateAngularComponent(spec: ComponentSpec): AngularCode {
    const componentName = `${spec.name}Component`;
    const component = this.generateComponentClass(spec);
    const template = this.generateComponentTemplate(spec);

    return {
      component,
      template,
    };
  }

  private generateComponentClass(spec: ComponentSpec): string {
    const lines: string[] = [];

    lines.push(
      "import { Component, Input, Output, EventEmitter } from '@angular/core';"
    );
    lines.push("import { CommonModule } from '@angular/common';");
    if (this.config.signals) {
      lines.push(
        "import { signal, computed, input, output } from '@angular/core';"
      );
    }
    lines.push("");
    lines.push("@Component({");
    lines.push(`  selector: 'app-${this.kebabCase(spec.name)}',`);
    lines.push(`  standalone: ${this.config.standalone},`);
    lines.push("  imports: [CommonModule],");
    lines.push(
      `  templateUrl: './${this.kebabCase(spec.name)}.component.html',`
    );
    lines.push(`  styleUrl: './${this.kebabCase(spec.name)}.component.css'`);
    lines.push("})");
    lines.push(`export class ${spec.name}Component {`);
    lines.push("");
    lines.push("}");

    return lines.join("\n");
  }

  private generateComponentTemplate(spec: ComponentSpec): string {
    const tag = this.kebabCase(spec.type);
    return `<app-${tag}></app-${tag}>`;
  }

  // ------------------------------------------------------------------------
  // Type Mapping Helpers
  // ------------------------------------------------------------------------

  private mapReactTypeToAngular(reactType: string): string {
    // React and Angular mostly use the same TypeScript types
    return reactType;
  }

  private mapAngularTypeToReact(angularType: string): string {
    return angularType;
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }

  private parseStyleBlock(style: string): any[] {
    const styles: any[] = [];

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
}
