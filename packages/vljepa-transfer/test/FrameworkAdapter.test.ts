/**
 * Framework Adapter Tests
 * Test base adapter functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BaseFrameworkAdapter,
  AdapterRegistry,
  type ParsedUI,
  type UIFramework,
} from "../src/adapters/FrameworkAdapter.js";
import type { ComponentSpec, StyleSpec } from "../src/types.js";

// Test adapter implementation
class TestAdapter extends BaseFrameworkAdapter {
  name = "TestAdapter";
  framework: UIFramework = "react";

  async parseUI(ui: string): Promise<ParsedUI> {
    return {
      framework: "react",
      components: [],
      styles: [],
      imports: [],
      exports: [],
      metadata: {
        language: "typescript",
        features: [],
        dependencies: [],
      },
    };
  }

  async parseComponent(component: string): Promise<any> {
    return {
      name: "TestComponent",
      type: "test",
      props: [],
      state: [],
      events: [],
      children: [],
    };
  }

  async generateComponent(spec: ComponentSpec): Promise<any> {
    return {
      success: true,
      code: "test code",
      warnings: [],
      errors: [],
      metadata: {
        fromFramework: "react",
        toFramework: "react",
        componentsConverted: 1,
        linesOfCode: 1,
        conversionTime: 0,
      },
    };
  }

  async generateStyle(spec: StyleSpec): Promise<any> {
    return {
      css: ".test { color: red; }",
      framework: "react",
    };
  }

  protected canConvertTo(targetFramework: UIFramework): boolean {
    return targetFramework === "vue";
  }

  protected async convertComponent(component: any, targetFramework: UIFramework): Promise<any> {
    return component;
  }

  protected async convertStyle(style: any, targetFramework: UIFramework): Promise<any> {
    return style;
  }

  protected async combineCode(components: any[], styles: any[], targetFramework: UIFramework): Promise<any> {
    return { components, styles };
  }
}

describe("FrameworkAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe("BaseFrameworkAdapter", () => {
    it("should create adapter with name and framework", () => {
      expect(adapter.name).toBe("TestAdapter");
      expect(adapter.framework).toBe("react");
    });

    it("should parse UI correctly", async () => {
      const ui = await adapter.parseUI("<div>Test</div>");
      expect(ui.framework).toBe("react");
      expect(ui.components).toEqual([]);
    });

    it("should parse component correctly", async () => {
      const component = await adapter.parseComponent("const Test = () => <div />");
      expect(component.name).toBe("TestComponent");
      expect(component.type).toBe("test");
    });

    it("should generate component correctly", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "TestButton",
        props: { label: "Click me" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
    });

    it("should generate style correctly", async () => {
      const spec: StyleSpec = {
        selector: "test-class",
        properties: { color: "red", fontSize: "14px" },
        framework: "react",
      };

      const style = await adapter.generateStyle(spec);
      expect(style.css).toContain("color: red");
      expect(style.css).toContain("font-size: 14px");
    });

    it("should check if component is supported", () => {
      expect(adapter.isSupported("Button")).toBe(false);
    });

    it("should get supported components", () => {
      const supported = adapter.getSupportedComponents();
      expect(Array.isArray(supported)).toBe(true);
    });

    it("should validate code correctly", async () => {
      expect(await adapter.validate("valid code")).toBe(true);
      expect(await adapter.validate("")).toBe(false);
      expect(await adapter.validate("{ unbalanced }")).toBe(false);
    });

    it("should convert to target framework", async () => {
      const ui: ParsedUI = {
        framework: "react",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: {
          language: "typescript",
          features: [],
          dependencies: [],
        },
      };

      const result = await adapter.convertTo(ui, "vue");
      expect(result.success).toBe(true);
    });

    it("should fail conversion for unsupported framework", async () => {
      const ui: ParsedUI = {
        framework: "react",
        components: [],
        styles: [],
        imports: [],
        exports: [],
        metadata: {
          language: "typescript",
          features: [],
          dependencies: [],
        },
      };

      const result = await adapter.convertTo(ui, "flutter");
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("AdapterRegistry", () => {
    it("should register adapter", () => {
      AdapterRegistry.register(adapter);
      expect(AdapterRegistry.has("react")).toBe(true);
    });

    it("should get registered adapter", () => {
      AdapterRegistry.register(adapter);
      const retrieved = AdapterRegistry.get("react");
      expect(retrieved).toBeDefined();
    });

    it("should list all frameworks", () => {
      AdapterRegistry.register(adapter);
      const frameworks = AdapterRegistry.list();
      expect(frameworks).toContain("react");
    });

    it("should list all adapters", () => {
      AdapterRegistry.register(adapter);
      const adapters = AdapterRegistry.listAdapters();
      expect(adapters.length).toBeGreaterThan(0);
    });
  });
});
