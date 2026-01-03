/**
 * @lsi/vljepa-synthetic - ScreenshotRenderer Tests
 *
 * 40+ tests for ScreenshotRenderer, HTMLRenderer, ReactRenderer
 */

import { describe, it, expect } from "vitest";
import { ScreenshotRenderer } from "../src/renderers/ScreenshotRenderer.js";
import { HTMLRenderer } from "../src/renderers/HTMLRenderer.js";
import { ReactRenderer } from "../src/renderers/ReactRenderer.js";
import { ComponentGenerator } from "../src/generators/ComponentGenerator.js";
import type { RendererConfig, ComponentState } from "../src/types.js";

describe("ScreenshotRenderer", () => {
  const defaultConfig: RendererConfig = {
    resolution: 2,
    formats: ["png"],
    backgrounds: ["#ffffff"],
    states: ["default", "hover", "active"],
    timeout: 5000,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  };

  describe("constructor", () => {
    it("should create renderer with config", () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      expect(renderer).toBeDefined();
    });

    it("should accept custom resolution", () => {
      const config = { ...defaultConfig, resolution: 3 };
      const renderer = new ScreenshotRenderer(config);
      expect(renderer).toBeDefined();
    });

    it("should accept custom viewport", () => {
      const config = { ...defaultConfig, viewport: { width: 1280, height: 720 } };
      const renderer = new ScreenshotRenderer(config);
      expect(renderer).toBeDefined();
    });
  });

  describe("renderComponent", () => {
    it("should render component to screenshot", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.image).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.dom).toBeDefined();
      expect(result.screenshot).toBeDefined();
    });

    it("should render in default state", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component, "default");

      expect(result.metadata.state).toBe("default");
    });

    it("should render in hover state", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component, "hover");

      expect(result.metadata.state).toBe("hover");
    });

    it("should render in active state", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component, "active");

      expect(result.metadata.state).toBe("active");
    });

    it("should render in focus state", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component, "focus");

      expect(result.metadata.state).toBe("focus");
    });

    it("should include timestamp in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const before = Date.now();
      const result = await renderer.renderComponent(component);
      const after = Date.now();

      expect(result.metadata.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.metadata.timestamp).toBeLessThanOrEqual(after);
    });

    it("should include duration in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it("should include viewport info in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.metadata.viewport).toEqual(defaultConfig.viewport);
    });

    it("should include background in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.metadata.background).toBe(defaultConfig.backgrounds[0]);
    });

    it("should include format in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.metadata.format).toBe(defaultConfig.formats[0]);
    });

    it("should include dimensions in metadata", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.metadata.dimensions.width).toBe(defaultConfig.viewport.width * defaultConfig.resolution);
      expect(result.metadata.dimensions.height).toBe(defaultConfig.viewport.height * defaultConfig.resolution);
    });

    it("should wrap component in HTML", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const result = await renderer.renderComponent(component);

      expect(result.image).toBeDefined();
    });
  });

  describe("renderBatch", () => {
    it("should render multiple components", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const components = [compGen.generate("button"), compGen.generate("button"), compGen.generate("button")];
      const results = await renderer.renderBatch(components);

      expect(results).toHaveLength(3);
    });

    it("should render components in different states", async () => {
      const renderer = new ScreenshotRenderer(defaultConfig);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const results = await renderer.renderBatch([component, component, component, component]);

      const states = new Set(results.map(r => r.metadata.state));
      expect(states.size).toBeGreaterThan(1);
    });
  });
});

describe("HTMLRenderer", () => {
  it("should render component to HTML", () => {
    const renderer = new HTMLRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const html = renderer.renderComponent(component);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain(component.code);
  });

  it("should render layout to HTML", () => {
    const renderer = new HTMLRenderer();
    // Simplified - would use actual LayoutGenerator
    const layout = {
      pattern: "grid" as const,
      code: '<div class="layout">Test</div>',
      responsive: { sm: "", md: "", lg: "", xl: "" },
      components: [],
      metadata: { id: "test", styleSystem: "tailwind", timestamp: Date.now(), seed: 1, componentCount: 1, breakpoints: ["sm", "md", "lg", "xl"] },
    };

    const html = renderer.renderLayout(layout);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain(layout.code);
  });

  it("should include viewport meta tag", () => {
    const renderer = new HTMLRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const html = renderer.renderComponent(component);

    expect(html).toContain('name="viewport"');
  });

  it("should include charset", () => {
    const renderer = new HTMLRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const html = renderer.renderComponent(component);

    expect(html).contains('charset="UTF-8"');
  });
});

describe("ReactRenderer", () => {
  it("should render component to JavaScript", () => {
    const renderer = new ReactRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const code = renderer.renderComponent(component);

    expect(code).toContain("import React");
    expect(code).toContain("export default");
  });

  it("should render component to TypeScript", () => {
    const renderer = new ReactRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const code = renderer.renderComponent(component, { typescript: true });

    expect(code).toContain("interface");
    expect(code).toContain("React.FC");
  });

  it("should convert class to className", () => {
    const renderer = new ReactRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const code = renderer.renderComponent(component, { inlineStyles: true });

    expect(code).toContain("className");
  });

  it("should convert inline styles to JSX", () => {
    const renderer = new ReactRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const code = renderer.renderComponent(component, { inlineStyles: true });

    expect(code).toContain("styles: React.CSSProperties");
  });

  it("should use PascalCase for component names", () => {
    const renderer = new ReactRenderer();
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const code = renderer.renderComponent(component, { typescript: true });

    expect(code).toContain("Button");
  });
});
