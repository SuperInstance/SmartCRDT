/**
 * Flutter Adapter - Convert React components to Flutter widgets
 * Supports Flutter 2.x and 3.x with null safety
 */

import type {
  UIFramework,
  ParsedUI,
  ParsedComponent,
  ComponentSpec,
  StyleSpec,
  FlutterCode,
  FlutterAdapterConfig,
  ConversionResult,
  ConversionMetadata,
} from "../types.js";
import { BaseFrameworkAdapter } from "./FrameworkAdapter.js";

// ============================================================================
// Flutter Adapter Configuration
// ============================================================================

const DEFAULT_FLUTTER_CONFIG: FlutterAdapterConfig = {
  version: "3.x",
  nullSafety: true,
  material: true,
};

// ============================================================================
// Flutter Adapter Implementation
// ============================================================================

export class FlutterAdapter extends BaseFrameworkAdapter {
  name = "FlutterAdapter";
  framework: UIFramework = "flutter";
  config: FlutterAdapterConfig;

  constructor(config: Partial<FlutterAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FLUTTER_CONFIG, ...config };
    this.initializeSupportedComponents();
  }

  private initializeSupportedComponents(): void {
    const components = [
      "Button",
      "ElevatedButton",
      "TextButton",
      "OutlinedButton",
      "IconButton",
      "TextField",
      "TextFormField",
      "TextInput",
      "DropdownButton",
      "Checkbox",
      "Radio",
      "Switch",
      "Slider",
      "Card",
      "Dialog",
      "AlertDialog",
      "BottomSheet",
      "Badge",
      "Chip",
      "DataTable",
      "ListView",
      "GridView",
      "Container",
      "Row",
      "Column",
      "Stack",
      "Text",
      "Image",
      "Icon",
      "CircleAvatar",
      "Divider",
      "LinearProgressIndicator",
      "CircularProgressIndicator",
      "Tooltip",
      "PopupMenu",
      "AppBar",
      "Toolbar",
      "Drawer",
      "SnackBar",
      "Scaffold",
    ];

    components.forEach(comp => this.supportedComponents.add(comp));
  }

  // ------------------------------------------------------------------------
  // Parsing Methods
  // ------------------------------------------------------------------------

  async parseUI(ui: string): Promise<ParsedUI> {
    const components = this.extractFlutterWidgets(ui);
    const styles = this.extractFlutterStyles(ui);

    return {
      framework: "flutter",
      components,
      styles,
      imports: [],
      exports: [],
      metadata: {
        version: this.config.version,
        language: "dart",
        features: this.detectFlutterFeatures(ui),
        dependencies: [],
      },
    };
  }

  async parseComponent(component: string): Promise<ParsedComponent> {
    const name = this.extractWidgetName(component);
    const type = this.extractWidgetType(component);
    const props = this.parseFlutterProps(component);
    const state = this.parseFlutterState(component);

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
  // React to Flutter Conversion
  // ------------------------------------------------------------------------

  async convertFromReact(
    reactCode: string,
    componentName: string
  ): Promise<FlutterCode> {
    const widget = this.convertReactToFlutterWidget(reactCode, componentName);
    const state = this.convertReactStateToFlutterState(reactCode);
    const build = this.convertJSXToFlutterBuild(reactCode);
    const imports = this.generateFlutterImports();

    return {
      widget,
      state,
      build,
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
      const flutterCode = this.generateFlutterWidget(spec);
      const metadata: ConversionMetadata = {
        fromFramework: spec.framework,
        toFramework: "flutter",
        componentsConverted: 1,
        linesOfCode:
          flutterCode.widget.split("\n").length +
          flutterCode.build.split("\n").length,
        conversionTime: Date.now() - startTime,
      };

      return {
        success: true,
        code: flutterCode,
        warnings,
        errors,
        metadata,
      };
    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createErrorResult(errors, {
        framework: "flutter",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: { language: "dart", features: [], dependencies: [] },
      });
    }
  }

  async generateStyle(spec: StyleSpec): Promise<any> {
    // Flutter styles are typically inline, but we can generate a BoxDecoration
    const { properties } = spec;

    const decorations: string[] = [];

    if (properties.color) {
      decorations.push(`color: ${this.dartColor(properties.color)},`);
    }

    if (properties.borderRadius) {
      decorations.push(
        `borderRadius: BorderRadius.circular(${properties.borderRadius}),`
      );
    }

    if (properties.padding) {
      decorations.push(`padding: EdgeInsets.all(${properties.padding}),`);
    }

    if (properties.margin) {
      decorations.push(`margin: EdgeInsets.all(${properties.margin}),`);
    }

    if (properties.boxShadow) {
      decorations.push(`boxShadow: [`);
      decorations.push(`  BoxShadow(`);
      decorations.push(`    color: Colors.black26,`);
      decorations.push(`    blurRadius: 4,`);
      decorations.push(`    offset: Offset(0, 2),`);
      decorations.push(`  ),`);
      decorations.push(`],`);
    }

    return {
      decoration: `BoxDecoration(\n${decorations.join("\n")}\n)`,
      framework: "flutter",
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
      return this.flutterToReact(component);
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
  // Private Helper Methods - Flutter Parsing
  // ------------------------------------------------------------------------

  private extractFlutterWidgets(code: string): ParsedComponent[] {
    const widgets: ParsedComponent[] = [];

    // Match widget classes
    const widgetRegex =
      /class\s+(\w+)\s+extends\s+(?:StatefulWidget|StatelessWidget)[\s\S]*?class\s+\w+State<[^>]*>\s*(?:extends\s+State<[^>]+>)?\s*{([^}]+)}/g;
    let match;

    while ((match = widgetRegex.exec(code)) !== null) {
      const [, className, stateBlock] = match;
      const widgetCode = this.extractWidgetClass(code, match.index);

      widgets.push({
        name: className,
        type: this.widgetNameToType(className),
        props: this.parseFlutterProps(widgetCode),
        state: this.parseFlutterState(stateBlock),
        events: [],
        children: [],
        script: widgetCode,
      });
    }

    return widgets;
  }

  private extractFlutterStyles(code: string): any[] {
    const styles: any[] = [];

    // Extract BoxDecoration
    const decorationRegex = /BoxDecoration\(([\s\S]*?)\)/g;
    let match;

    while ((match = decorationRegex.exec(code)) !== null) {
      const decorationBlock = match[1];
      styles.push({
        type: "decoration",
        code: decorationBlock.trim(),
      });
    }

    return styles;
  }

  private extractWidgetName(widget: string): string {
    const match = widget.match(/class\s+(\w+)\s+extends/);
    return match ? match[1] : "Unknown";
  }

  private extractWidgetType(widget: string): string {
    const name = this.extractWidgetName(widget);
    return this.widgetNameToType(name);
  }

  private widgetNameToType(name: string): string {
    // Remove Widget suffix and convert to camelCase
    return name
      .replace(/Widget$/, "")
      .replace(/([A-Z])/g, " $1")
      .trim()
      .toLowerCase();
  }

  private parseFlutterProps(widget: string): any[] {
    const props: any[] = [];

    // Match constructor parameters
    const constructorRegex = /const\s+${this.className}[\s\S]*?\{([^}]*)\}/;
    const match = widget.match(constructorRegex);

    if (match) {
      const propsBlock = match[1];
      const propLines = propsBlock.split(",").filter(line => line.trim());

      for (const line of propLines) {
        const propMatch = line.match(
          /(?:final\s+)?(?:this\.)?(\w+)(?:\?:\s*(\w+))?(?:\s*=\s*([^,]+))?/
        );
        if (propMatch) {
          const [, name, type, defaultValue] = propMatch;
          props.push({
            name,
            type: type || "dynamic",
            required: !defaultValue && !line.includes("?"),
            default: defaultValue?.trim(),
          });
        }
      }
    }

    return props;
  }

  private parseFlutterState(stateBlock: string): any[] {
    const state: any[] = [];

    // Match state variables
    const stateRegex =
      /(?:late\s+)?(?:final\s+)?(\w+)\??\s+(\w+)(?:\s*=\s*([^;]+))?;/g;
    let match;

    while ((match = stateRegex.exec(stateBlock)) !== null) {
      const [, type, name, initial] = match;
      state.push({
        name,
        type,
        initial,
        reactive: true,
      });
    }

    return state;
  }

  private extractWidgetClass(code: string, startIndex: number): string {
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

  private detectFlutterFeatures(code: string): string[] {
    const features: string[] = [];

    if (code.includes("StatefulWidget")) features.push("stateful");
    if (code.includes("StatelessWidget")) features.push("stateless");
    if (code.includes("InheritedWidget")) features.push("inherited");
    if (code.includes("setState")) features.push("state-management");
    if (code.includes("Riverpod")) features.push("riverpod");
    if (code.includes("Provider")) features.push("provider");
    if (code.includes("Bloc")) features.push("bloc");
    if (code.includes("GetX")) features.push("getx");
    if (code.includes("FutureBuilder")) features.push("async");
    if (code.includes("StreamBuilder")) features.push("streams");
    if (code.includes("AnimationController")) features.push("animations");
    if (code.includes("Hero")) features.push("hero-animations");
    if (code.includes("Navigator")) features.push("navigation");
    if (code.includes("Routes")) features.push("routing");

    return features;
  }

  // ------------------------------------------------------------------------
  // React to Flutter Conversion
  // ------------------------------------------------------------------------

  private convertReactToFlutterWidget(
    reactCode: string,
    componentName: string
  ): string {
    const imports = this.generateFlutterImports();
    const className = `${componentName}Widget`;
    const isStateful = this.hasReactState(reactCode);

    const lines: string[] = [];

    lines.push(...imports);
    lines.push("");
    lines.push(
      `class ${className} extends ${isStateful ? "StatefulWidget" : "StatelessWidget"} {`
    );
    lines.push(`  const ${className}({`);
    lines.push(`    super.key,`);
    lines.push("");
    lines.push(`    // Add your constructor parameters here`);
    lines.push(`  });`);
    lines.push("");
    lines.push(`  @override`);
    if (isStateful) {
      lines.push(
        `  State<${className}> createState() => _${className}State();`
      );
    } else {
      lines.push(`  Widget build(BuildContext context) {`);
      lines.push(`    return Container();`);
      lines.push(`  }`);
    }
    lines.push("}");
    lines.push("");
    if (isStateful) {
      lines.push(`class _${className}State extends State<${className}> {`);
      lines.push("");
      lines.push(`  @override`);
      lines.push(`  Widget build(BuildContext context) {`);
      lines.push(`    return Container();`);
      lines.push(`  }`);
      lines.push("}");
    }

    return lines.join("\n");
  }

  private convertReactStateToFlutterState(reactCode: string): string {
    const stateVars: string[] = [];

    const useStateRegex =
      /const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState<([^>]*)>\s*\(([^)]*)\)/g;
    let match;

    while ((match = useStateRegex.exec(reactCode)) !== null) {
      const [, name, type, initial] = match;
      const dartType = this.mapReactTypeToDart(type);
      stateVars.push(`  ${dartType} ${name} = ${initial};`);
    }

    if (stateVars.length === 0) {
      return "";
    }

    return "\n  // State\n" + stateVars.join("\n") + "\n";
  }

  private convertJSXToFlutterBuild(jsx: string): string {
    let build = "";

    // Convert JSX to Flutter widget tree
    build = this.convertJsxElement(jsx);

    return build;
  }

  private convertJsxElement(jsx: string): string {
    // Simple conversion - this would need more sophisticated parsing
    let result = jsx;

    // Convert className to Container/DecoratedBox
    result = result.replace(/<div[^>]*>/g, "Container(");
    result = result.replace(/<\/div>/g, ")");

    // Convert Button to ElevatedButton
    result = result.replace(/<Button[^>]*>/g, "ElevatedButton(");
    result = result.replace(/<\/Button>/g, ")");

    // Convert Input to TextField
    result = result.replace(/<Input[^>]*>/g, "TextField(");
    result = result.replace(/<\/Input>/g, ")");

    // Convert Text
    result = result.replace(/<Text[^>]*>([^<]*)<\/Text>/g, "Text('$1')");

    // Convert style={{}} to BoxDecoration
    result = result.replace(
      /style=\{\{\s*([^}]+)\s*\}\}/g,
      "decoration: BoxDecoration($1)"
    );

    // Convert onClick to onPressed
    result = result.replace(/onClick=\{([^}]+)\}/g, "onPressed: $1");

    return result;
  }

  private generateFlutterImports(): string[] {
    const imports: string[] = [];

    imports.push("import 'package:flutter/material.dart';");

    if (this.config.nullSafety) {
      // Null safety is default in Flutter 2.12+
    }

    return imports;
  }

  private hasReactState(code: string): boolean {
    return code.includes("useState") || code.includes("useReducer");
  }

  private mapReactTypeToDart(reactType: string): string {
    const typeMap: Record<string, string> = {
      string: "String",
      number: "double",
      boolean: "bool",
      object: "Map<String, dynamic>",
      array: "List",
      function: "Function",
      any: "dynamic",
      void: "void",
    };

    return typeMap[reactType] || reactType;
  }

  private flutterToReact(component: ParsedComponent): any {
    // Convert Flutter widget back to React
    const props = component.props.map((p: any) => ({
      name: p.name,
      type: this.mapDartTypeToReact(p.type),
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

  private mapDartTypeToReact(dartType: string): string {
    const typeMap: Record<string, string> = {
      String: "string",
      int: "number",
      double: "number",
      bool: "boolean",
      Map: "object",
      List: "array",
      Function: "function",
      dynamic: "any",
      void: "void",
    };

    return typeMap[dartType] || dartType.toLowerCase();
  }

  // ------------------------------------------------------------------------
  // Flutter Widget Generation
  // ------------------------------------------------------------------------

  private generateFlutterWidget(spec: ComponentSpec): FlutterCode {
    const widgetName = `${spec.name}Widget`;
    const widget = this.generateWidgetClass(spec);
    const state = this.generateStateSection(spec);
    const build = this.generateBuildMethod(spec);
    const imports = this.generateFlutterImports();

    return {
      widget,
      state,
      build,
      imports,
    };
  }

  private generateWidgetClass(spec: ComponentSpec): string {
    const lines: string[] = [];
    const widgetName = `${spec.name}Widget`;
    const isStateful = Object.keys(spec.props).length > 0;

    lines.push(
      `class ${widgetName} extends ${isStateful ? "StatefulWidget" : "StatelessWidget"} {`
    );
    lines.push(`  const ${widgetName}({`);
    lines.push(`    super.key,`);
    lines.push("");

    // Add constructor parameters
    for (const [key, value] of Object.entries(spec.props)) {
      const type = this.inferDartType(value);
      lines.push(`    required this.${key},`);
    }

    lines.push(`  });`);
    lines.push("");

    // Add final fields
    for (const [key, value] of Object.entries(spec.props)) {
      const type = this.inferDartType(value);
      lines.push(`  final ${type} ${key};`);
    }

    lines.push("");
    lines.push(`  @override`);
    if (isStateful) {
      lines.push(
        `  State<${widgetName}> createState() => _${widgetName}State();`
      );
    } else {
      lines.push(`  Widget build(BuildContext context) {`);
      lines.push(`    return _buildWidget();`);
      lines.push(`  }`);
    }
    lines.push("}");

    return lines.join("\n");
  }

  private generateStateSection(spec: ComponentSpec): string {
    const widgetName = `${spec.name}Widget`;

    return `class _${widgetName}State extends State<${widgetName}> {
  @override
  Widget build(BuildContext context) {
    return _buildWidget();
  }
}`;
  }

  private generateBuildMethod(spec: ComponentSpec): string {
    const widgetType = this.mapComponentToFlutterWidget(spec.type);

    return `  Widget _buildWidget() {
    return ${widgetType}();
  }`;
  }

  private mapComponentToFlutterWidget(componentType: string): string {
    const widgetMap: Record<string, string> = {
      button: "ElevatedButton",
      "text-button": "TextButton",
      "outlined-button": "OutlinedButton",
      icon: "Icon",
      "icon-button": "IconButton",
      input: "TextField",
      "text-field": "TextField",
      select: "DropdownButton",
      checkbox: "Checkbox",
      radio: "Radio",
      switch: "Switch",
      slider: "Slider",
      card: "Card",
      dialog: "Dialog",
      alert: "AlertDialog",
      "progress-bar": "LinearProgressIndicator",
      spinner: "CircularProgressIndicator",
      container: "Container",
      row: "Row",
      column: "Column",
      stack: "Stack",
      text: "Text",
      image: "Image",
      divider: "Divider",
      badge: "Badge",
      chip: "Chip",
      list: "ListView",
      grid: "GridView",
      table: "DataTable",
    };

    return widgetMap[componentType] || "Container";
  }

  private inferDartType(value: any): string {
    if (typeof value === "string") return "String";
    if (typeof value === "number") {
      return Number.isInteger(value) ? "int" : "double";
    }
    if (typeof value === "boolean") return "bool";
    if (Array.isArray(value)) return "List";
    if (typeof value === "object") return "Map<String, dynamic>";
    return "dynamic";
  }

  private className: string = ""; // Helper for regex

  private dartColor(color: string): string {
    // Convert CSS color to Flutter Color
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `Color(0xFF${hex.toUpperCase()})`;
      }
    }

    const namedColors: Record<string, string> = {
      red: "Colors.red",
      green: "Colors.green",
      blue: "Colors.blue",
      yellow: "Colors.yellow",
      orange: "Colors.orange",
      purple: "Colors.purple",
      pink: "Colors.pink",
      black: "Colors.black",
      white: "Colors.white",
      gray: "Colors.grey",
      transparent: "Colors.transparent",
    };

    return namedColors[color.toLowerCase()] || "Colors.black";
  }
}
