/**
 * SwiftUI Adapter - Convert React components to SwiftUI
 * Supports iOS and macOS targets with SwiftUI framework
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  SwiftUICode,
  SwiftUIAdapterConfig,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// SwiftUI Adapter Configuration
// ============================================================================

const DEFAULT_SWIFTUI_CONFIG: SwiftUIAdapterConfig = {
  version: "5.0",
  iosTarget: "15.0",
  macosTarget: "12.0",
  swiftui: true,
};

// ============================================================================
// SwiftUI Adapter Implementation
// ============================================================================

export class SwiftUIAdapter extends BaseFrameworkAdapter {
  name = "SwiftUIAdapter";
  framework: UIFramework = "swiftui";
  config: SwiftUIAdapterConfig;

  constructor(config: Partial<SwiftUIAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SWIFTUI_CONFIG, ...config };
    this.initializeSupportedComponents();
  }

  private initializeSupportedComponents(): void {
    const components = [
      "Button",
      "TextButton",
      "Link",
      "TextField",
      "TextEditor",
      "SecureField",
      "Picker",
      "Toggle",
      "Slider",
      "Stepper",
      "Card",
      "Alert",
      "Sheet",
      "FullScreenCover",
      "Badge",
      "Label",
      "Menu",
      "ContextMenu",
      "List",
      "Grid",
      "LazyVGrid",
      "LazyHGrid",
      "ScrollView",
      "VStack",
      "HStack",
      "ZStack",
      "Text",
      "Image",
      "Icon",
      "Circle",
      "RoundedRectangle",
      "Divider",
      "ProgressView",
      "Spinner",
      "Tooltip",
      "Popover",
      "MenuBarExtra",
      "Toolbar",
      "NavigationStack",
      "TabView",
      "GroupBox",
      "Form",
      "DisclosureGroup",
    ];

    components.forEach(comp => this.supportedComponents.add(comp));
  }

  // ------------------------------------------------------------------------
  // Parsing Methods
  // ------------------------------------------------------------------------

  async parseUI(ui: string): Promise<ParsedUI> {
    const components = this.extractSwiftUIViews(ui);
    const styles = this.extractSwiftUIStyles(ui);

    return {
      framework: "swiftui",
      components,
      styles,
      imports: [],
      exports: [],
      metadata: {
        version: this.config.version,
        language: "swift",
        features: this.detectSwiftUIFeatures(ui),
        dependencies: ["SwiftUI"],
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractViewName(component);
    const type = this.extractViewType(component);
    const props = this.parseSwiftUIProps(component);
    const state = this.parseSwiftUIState(component);

    return {
      name,
      type,
      props,
      state,
      events: [],
      children: [],
      script: component,
    };
  }

  // ------------------------------------------------------------------------
  // React to SwiftUI Conversion
  // ------------------------------------------------------------------------

  async convertFromReact(
    reactCode: string,
    componentName: string
  ): Promise<SwiftUICode> {
    const view = this.convertReactToSwiftUIView(reactCode, componentName);
    const viewmodel = this.convertReactStateToViewModel(reactCode);
    const imports = this.generateSwiftUIImports();

    return {
      view,
      viewmodel,
      imports,
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
      const swiftuiCode = this.generateSwiftUIView(spec);
      const metadata: ConversionMetadata = {
        fromFramework: spec.framework,
        toFramework: "swiftui",
        componentsConverted: 1,
        linesOfCode: swiftuiCode.view.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: swiftuiCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "swiftui",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: { language: "swift", features: [], dependencies: [] },
      });
    }
  }

  async generateStyle(spec: StyleSpec): Promise<any> {
    const { properties } = spec;

    const modifiers: string[] = [];

    if (properties.padding) {
      modifiers.push(`.padding(${properties.padding})`);
    }

    if (properties.background) {
      modifiers.push(
        `.background(Color.${this.swiftUIColor(properties.background)})`
      );
    }

    if (properties.cornerRadius) {
      modifiers.push(`.cornerRadius(${properties.cornerRadius})`);
    }

    if (properties.shadow) {
      modifiers.push(`.shadow(radius: ${properties.shadow})`);
    }

    if (properties.opacity) {
      modifiers.push(`.opacity(${properties.opacity})`);
    }

    if (properties.frameWidth || properties.frameHeight) {
      const width = properties.frameWidth || "nil";
      const height = properties.frameHeight || "nil";
      modifiers.push(`.frame(width: ${width}, height: ${height})`);
    }

    return {
      modifiers: modifiers.join("\n    "),
      framework: "swiftui",
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
      return this.swiftuiToReact(component);
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
  // Private Helper Methods - SwiftUI Parsing
  // ------------------------------------------------------------------------

  private extractSwiftUIViews(code: string): ParsedComponent[] {
    const views: ParsedComponent[] = [];

    // Match struct conforming to View
    const viewRegex = /struct\s+(\w+)\s*:\s*View\s*{([^}]*(?:{[^}]*}[^}]*)*)}/g;
    let match;

    while ((match = viewRegex.exec(code)) !== null) {
      const [, viewName, body] = match;
      const viewCode = this.extractViewStruct(code, match.index);

      views.push({
        name: viewName,
        type: this.viewNameToType(viewName),
        props: this.parseSwiftUIProps(viewCode),
        state: this.parseSwiftUIState(viewCode),
        events: [],
        children: [],
        script: viewCode,
      });
    }

    return views;
  }

  private extractSwiftUIStyles(code: string): any[] {
    const styles: any[] = [];

    // Extract view modifiers
    const modifierRegex = /\.(\w+)\(([^)]+)\)/g;
    let match;

    while ((match = modifierRegex.exec(code)) !== null) {
      const [, modifier, args] = match;
      styles.push({
        type: "modifier",
        name: modifier,
        arguments: args,
      });
    }

    return styles;
  }

  private extractViewName(view: string): string {
    const match = view.match(/struct\s+(\w+)\s*:/);
    return match ? match[1] : "Unknown";
  }

  private extractViewType(view: string): string {
    const name = this.extractViewName(view);
    return this.viewNameToType(name);
  }

  private viewNameToType(name: string): string {
    // Remove View suffix and convert to lowercase
    return name
      .replace(/View$/, "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();
  }

  private parseSwiftUIProps(view: string): any[] {
    const props: any[] = [];

    // Match @Published properties in ViewModels
    const publishedRegex =
      /@Published\s+var\s+(\w+)(?::\s*(\w+))?(?:\s*=\s*([^;]+))?;/g;
    let match;

    while ((match = publishedRegex.exec(view)) !== null) {
      const [, name, type, initial] = match;
      props.push({
        name,
        type: type || "String",
        required: true,
        default: initial?.trim(),
        isPublished: true,
      });
    }

    // Match @Binding properties
    const bindingRegex = /@Binding\s+var\s+(\w+)(?::\s*(\w+))/g;
    while ((match = bindingRegex.exec(view)) !== null) {
      const [, name, type] = match;
      props.push({
        name,
        type,
        required: true,
        isBinding: true,
      });
    }

    // Match @State properties
    const stateRegex =
      /@State\s+var\s+(\w+)(?::\s*(\w+))?(?:\s*=\s*([^;]+))?;/g;
    while ((match = stateRegex.exec(view)) !== null) {
      const [, name, type, initial] = match;
      props.push({
        name,
        type: type || "String",
        required: true,
        default: initial?.trim(),
        isState: true,
      });
    }

    return props;
  }

  private parseSwiftUIState(view: string): any[] {
    const state: any[] = [];

    // @State is already parsed as props in SwiftUI
    // This can extract @StateObject, @ObservedObject, @EnvironmentObject
    const stateObjectRegex =
      /@(?:StateObject|ObservedObject|EnvironmentObject)\s+var\s+(\w+)(?::\s*(\w+))?/g;
    let match;

    while ((match = stateObjectRegex.exec(view)) !== null) {
      const [, name, type] = match;
      state.push({
        name,
        type: type || "ObservableObject",
        reactive: true,
        isObject: true,
      });
    }

    return state;
  }

  private extractViewStruct(code: string, startIndex: number): string {
    const afterStart = code.substring(startIndex);
    let braceCount = 0;
    let startIndexBrace = -1;
    let endIndex = -1;

    for (let i = 0; i < afterStart.length; i++) {
      const char = afterStart[i];
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

  private detectSwiftUIFeatures(code: string): string[] {
    const features: string[] = [];

    if (code.includes("@State")) features.push("state");
    if (code.includes("@Binding")) features.push("binding");
    if (code.includes("@Published")) features.push("published");
    if (code.includes("@StateObject")) features.push("state-object");
    if (code.includes("@ObservedObject")) features.push("observed-object");
    if (code.includes("@EnvironmentObject"))
      features.push("environment-object");
    if (code.includes("@Environment")) features.push("environment");
    if (code.includes("@FetchRequest")) features.push("core-data");
    if (code.includes("@AppStorage")) features.push("app-storage");
    if (code.includes("@SceneStorage")) features.push("scene-storage");
    if (code.includes("@ViewBuilder")) features.push("view-builder");
    if (code.includes("@ToolbarContent")) features.push("toolbar");
    if (code.includes("@Commands")) features.push("commands");
    if (code.includes("NavigationStack")) features.push("navigation");
    if (code.includes("TabView")) features.push("tabs");
    if (code.includes("Sheet")) features.push("sheets");
    if (code.includes("Alert")) features.push("alerts");
    if (code.includes("ContextMenu")) features.push("context-menu");
    if (code.includes("DragGesture")) features.push("gestures");
    if (code.includes("Animation")) features.push("animations");
    if (code.includes("Transition")) features.push("transitions");

    return features;
  }

  // ------------------------------------------------------------------------
  // React to SwiftUI Conversion
  // ------------------------------------------------------------------------

  private convertReactToSwiftUIView(
    reactCode: string,
    componentName: string
  ): string {
    const imports = this.generateSwiftUIImports();
    const viewName = `${componentName}View`;
    const properties = this.parseReactPropsForSwiftUI(reactCode);
    const body = this.convertJSXToSwiftUIBody(reactCode);

    const lines: string[] = [];

    lines.push(...imports);
    lines.push("");
    lines.push(`struct ${viewName}: View {`);
    lines.push("");

    // Add properties
    for (const prop of properties) {
      if (prop.isBinding) {
        lines.push(`    @Binding var ${prop.name}: ${prop.type}`);
      } else {
        lines.push(`    let ${prop.name}: ${prop.type}`);
      }
    }

    if (properties.length > 0) {
      lines.push("");
    }

    lines.push("    var body: some View {");
    lines.push(`        ${body}`);
    lines.push("    }");
    lines.push("}");

    return lines.join("\n");
  }

  private convertReactStateToViewModel(reactCode: string): string | undefined {
    const hasState = this.hasReactState(reactCode);

    if (!hasState) {
      return undefined;
    }

    const viewModelName = this.extractViewModelName(reactCode);
    const properties = this.parseReactStateForSwiftUI(reactCode);

    const lines: string[] = [];

    lines.push("");
    lines.push("import Foundation");
    lines.push("import SwiftUI");
    lines.push("");
    lines.push(`@MainActor`);
    lines.push(`class ${viewModelName}: ObservableObject {`);
    lines.push("");

    for (const prop of properties) {
      lines.push(
        `    @Published var ${prop.name}: ${prop.type} = ${prop.initial}`
      );
    }

    lines.push("");
    lines.push("    init() {");
    lines.push("        // Initialize properties");
    lines.push("    }");
    lines.push("}");

    return lines.join("\n");
  }

  private convertJSXToSwiftUIBody(jsx: string): string {
    let body = jsx;

    // Convert basic JSX to SwiftUI
    body = body.replace(/<Button[^>]*>([^<]*)<\/Button>/g, 'Button("$1") { }');
    body = body.replace(/<Text[^>]*>([^<]*)<\/Text>/g, 'Text("$1")');
    body = body.replace(/<Input[^>]*>/g, 'TextField("", text: $binding)');
    body = body.replace(/<div[^>]*>/g, "VStack {");
    body = body.replace(/<\/div>/g, "}");

    // Convert className to modifiers
    body = body.replace(/className=\{[^}]*\}/g, "");

    // Convert onClick
    body = body.replace(/onClick=\{([^}]+)\}/g, ".onTapGesture { $1 }");

    return body.trim();
  }

  private generateSwiftUIImports(): string[] {
    return ["import SwiftUI"];
  }

  private parseReactPropsForSwiftUI(reactCode: string): any[] {
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
            type: this.mapReactTypeToSwift(type),
            required: !optional,
            isBinding: name.startsWith("on"),
          });
        }
      }
    }

    return props;
  }

  private parseReactStateForSwiftUI(reactCode: string): any[] {
    const state: any[] = [];

    const useStateRegex =
      /const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState<([^>]*)>\s*\(([^)]*)\)/g;
    let match;

    while ((match = useStateRegex.exec(reactCode)) !== null) {
      const [, name, type, initial] = match;
      state.push({
        name,
        type: this.mapReactTypeToSwift(type),
        initial: initial || this.swiftDefaultValue(type),
      });
    }

    return state;
  }

  private hasReactState(code: string): boolean {
    return code.includes("useState") || code.includes("useReducer");
  }

  private extractViewModelName(reactCode: string): string {
    const componentNameMatch = reactCode.match(/(?:const|function)\s+(\w+)/);
    const componentName = componentNameMatch
      ? componentNameMatch[1]
      : "Component";
    return `${componentName}ViewModel`;
  }

  private mapReactTypeToSwift(reactType: string): string {
    const typeMap: Record<string, string> = {
      string: "String",
      number: "Double",
      boolean: "Bool",
      object: "[String: Any]",
      array: "[Any]",
      function: "() -> Void",
      any: "Any",
      void: "Void",
    };

    return typeMap[reactType] || reactType;
  }

  private swiftDefaultValue(type: string): string {
    const defaults: Record<string, string> = {
      String: '""',
      Double: "0.0",
      Bool: "false",
      "[String: Any]": "[:]",
      "[Any]": "[]",
      Any: "()",
    };

    return defaults[this.mapReactTypeToSwift(type)] || '""';
  }

  private swiftuiToReact(component: ParsedComponent): any {
    const props = component.props.map((p: any) => ({
      name: p.name,
      type: this.mapSwiftTypeToReact(p.type),
      required: p.required,
    }));

    return {
      name: component.name,
      type: component.type,
      props,
      state: component.state,
      events: [],
    };
  }

  private mapSwiftTypeToReact(swiftType: string): string {
    const typeMap: Record<string, string> = {
      String: "string",
      Int: "number",
      Double: "number",
      Float: "number",
      Bool: "boolean",
      "[String: Any]": "object",
      "[Any]": "array",
      "() -> Void": "function",
      Any: "any",
      Void: "void",
    };

    return typeMap[swiftType] || swiftType.toLowerCase();
  }

  // ------------------------------------------------------------------------
  // SwiftUI View Generation
  // ------------------------------------------------------------------------

  private generateSwiftUIView(spec: ComponentSpec): SwiftUICode {
    const viewName = `${spec.name}View`;
    const view = this.generateViewStruct(spec);
    const imports = this.generateSwiftUIImports();

    return {
      view,
      imports,
    };
  }

  private generateViewStruct(spec: ComponentSpec): string {
    const lines: string[] = [];
    const viewName = `${spec.name}View`;

    lines.push(`struct ${viewName}: View {`);
    lines.push("");

    // Add properties
    for (const [key, value] of Object.entries(spec.props)) {
      const type = this.inferSwiftType(value);
      lines.push(`    let ${key}: ${type}`);
    }

    if (Object.keys(spec.props).length > 0) {
      lines.push("");
    }

    lines.push("    var body: some View {");
    lines.push(`        ${this.generateViewBody(spec)}`);
    lines.push("    }");
    lines.push("}");

    return lines.join("\n");
  }

  private generateViewBody(spec: ComponentSpec): string {
    const view = this.mapComponentToSwiftUIView(spec.type);

    if (spec.children && spec.children.length > 0) {
      const childrenViews = spec.children
        .map(child => this.mapComponentToSwiftUIView(child.type))
        .join("\n            ");
      return `${view} {\n            ${childrenViews}\n        }`;
    }

    return view;
  }

  private mapComponentToSwiftUIView(componentType: string): string {
    const viewMap: Record<string, string> = {
      button: 'Button("Button") { }',
      text: 'Text("Text")',
      "text-field": 'TextField("Placeholder", text: $binding)',
      "text-editor": "TextEditor(text: $binding)",
      "secure-field": 'SecureField("Placeholder", text: $binding)',
      picker: 'Picker("Label", selection: $selection) { }',
      toggle: 'Toggle("Label", isOn: $isOn)',
      slider: "Slider(value: $value, in: 0...100)",
      stepper: 'Stepper("Label", value: $value, in: 0...100)',
      image: 'Image("image-name")',
      "progress-bar": "ProgressView()",
      spinner: "ProgressView()",
      divider: "Divider()",
      "v-stack": "VStack { }",
      "h-stack": "HStack { }",
      "z-stack": "ZStack { }",
      "scroll-view": "ScrollView { }",
      list: "List { }",
      grid: "LazyVGrid(columns: []) { }",
      card: "VStack { }.padding().background(Color.gray)",
      alert: 'Alert("Title", isPresented: $showAlert) { }',
      sheet: "Sheet(isPresented: $showSheet) { }",
      menu: 'Menu("Label") { }',
      "context-menu": ".contextMenu { }",
    };

    return viewMap[componentType] || 'Text("Unknown")';
  }

  private inferSwiftType(value: any): string {
    if (typeof value === "string") return "String";
    if (typeof value === "number") {
      return Number.isInteger(value) ? "Int" : "Double";
    }
    if (typeof value === "boolean") return "Bool";
    if (Array.isArray(value)) return "[Any]";
    if (typeof value === "object") return "[String: Any]";
    return "Any";
  }

  private swiftUIColor(color: string): string {
    const namedColors: Record<string, string> = {
      red: "red",
      green: "green",
      blue: "blue",
      yellow: "yellow",
      orange: "orange",
      purple: "purple",
      pink: "pink",
      black: "black",
      white: "white",
      gray: "gray",
      primary: "primary",
      secondary: "secondary",
    };

    return namedColors[color.toLowerCase()] || "blue";
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }
}
