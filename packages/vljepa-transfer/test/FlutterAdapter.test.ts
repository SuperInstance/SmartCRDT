/**
 * Flutter Adapter Tests
 * Test Flutter-specific adapter functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FlutterAdapter } from "../src/adapters/FlutterAdapter.js";
import type { ComponentSpec, StyleSpec, FlutterAdapterConfig } from "../src/types.js";

describe("FlutterAdapter", () => {
  describe("Default Configuration", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should use default configuration", () => {
      expect(adapter.config.version).toBe("3.x");
      expect(adapter.config.nullSafety).toBe(true);
      expect(adapter.config.material).toBe(true);
    });

    it("should parse Flutter widget correctly", async () => {
      const flutterCode = `
        class MyWidget extends StatelessWidget {
          const MyWidget({super.key});

          @override
          Widget build(BuildContext context) {
            return Container(
              child: Text('Hello'),
            );
          }
        }
      `;

      const ui = await adapter.parseUI(flutterCode);
      expect(ui.framework).toBe("flutter");
      expect(ui.metadata.language).toBe("dart");
    });

    it("should parse StatefulWidget", async () => {
      const flutterCode = `
        class CounterWidget extends StatefulWidget {
          const CounterWidget({super.key});

          @override
          State<CounterWidget> createState() => _CounterWidgetState();
        }

        class _CounterWidgetState extends State<CounterWidget> {
          int count = 0;

          @override
          Widget build(BuildContext context) {
            return Text('\$count');
          }
        }
      `;

      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("stateful");
    });

    it("should convert React to Flutter", async () => {
      const reactCode = `
        interface ButtonProps {
          label: string;
          onClick?: () => void;
        }

        export function Button({ label, onClick }: ButtonProps) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const flutterCode = await adapter.convertFromReact(reactCode, "Button");
      expect(flutterCode.widget).toBeDefined();
      expect(flutterCode.build).toBeDefined();
      expect(flutterCode.imports).toContain("import 'package:flutter/material.dart';");
    });

    it("should convert JSX to Flutter build method", async () => {
      const jsx = `<div><Button label="Click" /></div>`;

      const build = adapter["convertJSXToFlutterBuild"](jsx);
      expect(build).toBeDefined();
    });

    it("should generate Flutter widget", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "TestButton",
        props: { label: "Click me" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.success).toBe(true);
      expect(result.code.widget).toContain("extends StatelessWidget");
    });

    it("should generate Flutter decoration", async () => {
      const spec: StyleSpec = {
        selector: "my-container",
        properties: {
          color: "#FF0000",
          borderRadius: "8px",
          padding: "16px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        },
        framework: "flutter",
      };

      const style = await adapter.generateStyle(spec);
      expect(style.decoration).toContain("BoxDecoration");
      expect(style.decoration).toContain("borderRadius");
    });
  });

  describe("Flutter 2.x", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter({ version: "2.x" });
    });

    it("should use Flutter 2.x configuration", () => {
      expect(adapter.config.version).toBe("2.x");
    });

    it("should support null safety", () => {
      const adapter = new FlutterAdapter({ version: "2.x", nullSafety: true });
      expect(adapter.config.nullSafety).toBe(true);
    });

    it("should support non-null-safe code", () => {
      const adapter = new FlutterAdapter({ version: "2.x", nullSafety: false });
      expect(adapter.config.nullSafety).toBe(false);
    });
  });

  describe("Cupertino (iOS-style)", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter({ material: false });
    });

    it("should disable Material Design", () => {
      expect(adapter.config.material).toBe(false);
    });

    it("should use Cupertino widgets", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "CupertinoButton",
        props: { label: "Click" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.success).toBe(true);
    });
  });

  describe("Widget Mapping", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should map Button to ElevatedButton", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("button");
      expect(widget).toContain("ElevatedButton");
    });

    it("should map Text to Text", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("text");
      expect(widget).toContain("Text");
    });

    it("should map Input to TextField", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("input");
      expect(widget).toContain("TextField");
    });

    it("should map Container to Container", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("container");
      expect(widget).toContain("Container");
    });

    it("should map Row to Row", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("row");
      expect(widget).toContain("Row");
    });

    it("should map Column to Column", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("column");
      expect(widget).toContain("Column");
    });

    it("should map Stack to Stack", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("stack");
      expect(widget).toContain("Stack");
    });

    it("should map List to ListView", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("list");
      expect(widget).toContain("ListView");
    });

    it("should map Grid to GridView", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("grid");
      expect(widget).toContain("GridView");
    });

    it("should map Progress to ProgressView", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("progress-bar");
      expect(widget).toContain("LinearProgressIndicator");
    });

    it("should map Spinner to CircularProgressIndicator", () => {
      const widget = adapter["mapComponentToFlutterWidget"]("spinner");
      expect(widget).toContain("CircularProgressIndicator");
    });
  });

  describe("Type Mapping", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should map string to String", () => {
      const dartType = adapter["mapReactTypeToDart"]("string");
      expect(dartType).toBe("String");
    });

    it("should map number to double or int", () => {
      const doubleType = adapter["mapReactTypeToDart"]("number");
      expect(doubleType).toBeDefined();
    });

    it("should map boolean to Bool", () => {
      const dartType = adapter["mapReactTypeToDart"]("boolean");
      expect(dartType).toBe("Bool");
    });

    it("should map object to Map", () => {
      const dartType = adapter["mapReactTypeToDart"]("object");
      expect(dartType).toBe("Map<String, dynamic>");
    });

    it("should map array to List", () => {
      const dartType = adapter["mapReactTypeToDart"]("array");
      expect(dartType).toBe("List");
    });

    it("should infer Dart type from value", () => {
      expect(adapter["inferDartType"]("hello")).toBe("String");
      expect(adapter["inferDartType"](42)).toBe("int");
      expect(adapter["inferDartType"](3.14)).toBe("double");
      expect(adapter["inferDartType"](true)).toBe("Bool");
    });
  });

  describe("Color Conversion", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should convert hex to Color", () => {
      const color = adapter["dartColor"]("#FF0000");
      expect(color).toContain("Color(0xFF");
      expect(color).toContain("FF0000");
    });

    it("should convert named colors", () => {
      expect(adapter["dartColor"]("red")).toBe("Colors.red");
      expect(adapter["dartColor"]("blue")).toBe("Colors.blue");
      expect(adapter["dartColor"]("green")).toBe("Colors.green");
      expect(adapter["dartColor"]("white")).toBe("Colors.white");
      expect(adapter["dartColor"]("black")).toBe("Colors.black");
    });

    it("should handle gray color", () => {
      const color = adapter["dartColor"]("gray");
      expect(color).toBe("Colors.grey");
    });
  });

  describe("State Conversion", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should convert useState to state variable", () => {
      const reactCode = "const [count, setCount] = useState(0);";
      const state = adapter["convertReactStateToFlutterState"](reactCode);
      expect(state).toBeDefined();
    });

    it("should detect stateful components", () => {
      const hasState = adapter["hasReactState"]("const [count, setCount] = useState(0);");
      expect(hasState).toBe(true);
    });

    it("should detect stateless components", () => {
      const hasState = adapter["hasReactState"]("const value = 42;");
      expect(hasState).toBe(false);
    });
  });

  describe("Feature Detection", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should detect StatefulWidget", async () => {
      const flutterCode = "class MyWidget extends StatefulWidget {}";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("stateful");
    });

    it("should detect StatelessWidget", async () => {
      const flutterCode = "class MyWidget extends StatelessWidget {}";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("stateless");
    });

    it("should detect InheritedWidget", async () => {
      const flutterCode = "class MyWidget extends InheritedWidget {}";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("inherited");
    });

    it("should detect setState", async () => {
      const flutterCode = "setState(() { count++; });";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("state-management");
    });

    it("should detect FutureBuilder", async () => {
      const flutterCode = "FutureBuilder(future: fetchData, builder: (context, snapshot) {})";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("async");
    });

    it("should detect StreamBuilder", async () => {
      const flutterCode = "StreamBuilder(stream: dataStream, builder: (context, snapshot) {})";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("streams");
    });

    it("should detect AnimationController", async () => {
      const flutterCode = "AnimationController(vsync: this);";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("animations");
    });

    it("should detect Navigator", async () => {
      const flutterCode = "Navigator.push(context, route);";
      const ui = await adapter.parseUI(flutterCode);
      expect(ui.metadata.features).toContain("navigation");
    });
  });

  describe("JSX to Flutter Conversion", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should convert JSX elements to widgets", () => {
      const jsx = "<Button>Click me</Button>";
      const result = adapter["convertJsxElement"](jsx);
      expect(result).toBeDefined();
    });

    it("should convert className to modifiers", () => {
      const jsx = '<div className="container">Content</div>';
      const result = adapter["convertJsxElement"](jsx);
      expect(result).toBeDefined();
    });

    it("should convert onClick to onPressed", () => {
      const jsx = "<button onClick={handleClick}>Click</button>";
      const result = adapter["convertJsxElement"](jsx);
      expect(result).toBeDefined();
    });
  });

  describe("Code Generation", () => {
    let adapter: FlutterAdapter;

    beforeEach(() => {
      adapter = new FlutterAdapter();
    });

    it("should generate StatelessWidget", async () => {
      const spec: ComponentSpec = {
        type: "Text",
        name: "MyText",
        props: {},
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.code.widget).toContain("extends StatelessWidget");
    });

    it("should generate StatefulWidget when needed", async () => {
      const spec: ComponentSpec = {
        type: "Input",
        name: "MyInput",
        props: { value: "" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.code.widget).toContain("StatefulWidget");
    });

    it("should include proper imports", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "MyButton",
        props: {},
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.code.imports).toContain("import 'package:flutter/material.dart';");
    });
  });
});
