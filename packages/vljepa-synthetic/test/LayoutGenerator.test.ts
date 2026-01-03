/**
 * @lsi/vljepa-synthetic - LayoutGenerator Tests
 *
 * 45+ tests for LayoutGenerator
 */

import { describe, it, expect } from "vitest";
import { LayoutGenerator } from "../src/generators/LayoutGenerator.js";
import type { LayoutGeneratorConfig, LayoutPattern } from "../src/types.js";

describe("LayoutGenerator", () => {
  const defaultConfig: LayoutGeneratorConfig = {
    patterns: ["grid", "flex-row", "flex-column", "sidebar-main"],
    minColumns: 2,
    maxColumns: 4,
    breakpoints: ["sm", "md", "lg", "xl"],
    spacing: { min: 4, max: 32, step: 4 },
    seed: 12345,
  };

  describe("constructor", () => {
    it("should create LayoutGenerator with config", () => {
      const generator = new LayoutGenerator(defaultConfig);
      expect(generator).toBeDefined();
    });

    it("should accept custom seed", () => {
      const config = { ...defaultConfig, seed: 42 };
      const generator = new LayoutGenerator(config);
      expect(generator).toBeDefined();
    });
  });

  describe("generate", () => {
    it("should generate grid layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.pattern).toBe("grid");
      expect(layout.code).toBeDefined();
      expect(layout.components).toBeDefined();
      expect(layout.responsive).toBeDefined();
    });

    it("should generate flex-row layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("flex-row");

      expect(layout.pattern).toBe("flex-row");
    });

    it("should generate flex-column layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("flex-column");

      expect(layout.pattern).toBe("flex-column");
    });

    it("should generate sidebar-main layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("sidebar-main");

      expect(layout.pattern).toBe("sidebar-main");
    });

    it("should generate header-content layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("header-content");

      expect(layout.pattern).toBe("header-content");
    });

    it("should generate header-sidebar-content layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("header-sidebar-content");

      expect(layout.pattern).toBe("header-sidebar-content");
    });

    it("should generate card-grid layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("card-grid");

      expect(layout.pattern).toBe("card-grid");
    });

    it("should generate bento layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("bento");

      expect(layout.pattern).toBe("bento");
    });

    it("should generate holy-grail layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("holy-grail");

      expect(layout.pattern).toBe("holy-grail");
    });

    it("should generate fluid layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("fluid");

      expect(layout.pattern).toBe("fluid");
    });

    it("should generate responsive-grid layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("responsive-grid");

      expect(layout.pattern).toBe("responsive-grid");
    });

    it("should respect custom component count", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid", { componentCount: 8 });

      expect(layout.components).toHaveLength(8);
    });

    it("should respect custom columns", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid", { columns: 3 });

      expect(layout.metadata.componentCount).toBeDefined();
    });

    it("should generate component placements", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.components.length).toBeGreaterThan(0);
      layout.components.forEach(comp => {
        expect(comp.componentId).toBeDefined();
        expect(comp.position).toBeDefined();
        expect(comp.size).toBeDefined();
        expect(comp.spacing).toBeDefined();
        expect(comp.alignment).toBeDefined();
      });
    });

    it("should include unique component IDs", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      const ids = layout.components.map(c => c.componentId);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should generate responsive styles for all breakpoints", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.responsive.sm).toBeDefined();
      expect(layout.responsive.md).toBeDefined();
      expect(layout.responsive.lg).toBeDefined();
      expect(layout.responsive.xl).toBeDefined();
    });

    it("should include metadata", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.metadata.id).toBeDefined();
      expect(layout.metadata.timestamp).toBeDefined();
      expect(layout.metadata.seed).toBeDefined();
      expect(layout.metadata.styleSystem).toBeDefined();
    });
  });

  describe("generateBatch", () => {
    it("should generate multiple layouts", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layouts = generator.generateBatch(10);

      expect(layouts).toHaveLength(10);
    });

    it("should generate layouts with different patterns", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layouts = generator.generateBatch(20);

      const patterns = new Set(layouts.map(l => l.pattern));
      expect(patterns.size).toBeGreaterThan(1);
    });

    it("should generate unique layout IDs", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layouts = generator.generateBatch(10);

      const ids = layouts.map(l => l.metadata.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("grid layouts", () => {
    it("should generate grid with column spans", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      const hasColumnSpan = layout.components.some(c => c.position.columnSpan && c.position.columnSpan > 1);
      expect(hasColumnSpan).toBe(true);
    });

    it("should generate grid with row spans", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      const hasRowSpan = layout.components.some(c => c.position.rowSpan && c.position.rowSpan > 1);
      expect(hasRowSpan).toBe(true);
    });

    it("should include grid template columns in code", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.code).toContain("grid");
    });
  });

  describe("flex layouts", () => {
    it("should generate flex-row with flexDirection", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("flex-row");

      expect(layout.code).toContain("flex");
    });

    it("should generate flex-column with flexDirection", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("flex-column");

      expect(layout.code).toContain("flex");
    });

    it("should include gap in flex layouts", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("flex-row");

      expect(layout.code).toContain("gap");
    });
  });

  describe("component placement", () => {
    it("should generate positions for all components", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      layout.components.forEach(comp => {
        expect(comp.position).toBeDefined();
      });
    });

    it("should generate sizes for all components", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      layout.components.forEach(comp => {
        expect(comp.size).toBeDefined();
      });
    });

    it("should generate spacing for all components", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      layout.components.forEach(comp => {
        expect(comp.spacing).toBeDefined();
      });
    });

    it("should generate alignment for all components", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      layout.components.forEach(comp => {
        expect(comp.alignment).toBeDefined();
        expect(comp.alignment.justify).toBeDefined();
        expect(comp.alignment.align).toBeDefined();
      });
    });

    it("should include width in size", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      layout.components.forEach(comp => {
        expect(comp.size.width).toBeDefined();
      });
    });
  });

  describe("responsive styles", () => {
    it("should generate different styles for xs breakpoint", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.responsive.xs).toBeDefined();
      expect(typeof layout.responsive.xs).toBe("string");
    });

    it("should generate different styles for lg breakpoint", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.responsive.lg).toBeDefined();
    });

    it("should include media queries in responsive styles", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      Object.values(layout.responsive).forEach(style => {
        expect(style).toContain("@media");
      });
    });
  });

  describe("layout code generation", () => {
    it("should generate valid HTML", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.code).toContain("<div");
      expect(layout.code).toContain("</div>");
    });

    it("should include layout class", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.code).toContain("layout");
    });

    it("should include component elements", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.code).toContain("Component");
    });
  });

  describe("metadata", () => {
    it("should include generation timestamp", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const before = Date.now();
      const layout = generator.generate("grid");
      const after = Date.now();

      expect(layout.metadata.timestamp).toBeGreaterThanOrEqual(before);
      expect(layout.metadata.timestamp).toBeLessThanOrEqual(after);
    });

    it("should include seed", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.metadata.seed).toBeDefined();
    });

    it("should include component count", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.metadata.componentCount).toBe(layout.components.length);
    });

    it("should include breakpoints used", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid");

      expect(layout.metadata.breakpoints).toEqual(defaultConfig.breakpoints);
    });
  });

  describe("edge cases", () => {
    it("should handle single component layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid", { componentCount: 1 });

      expect(layout.components).toHaveLength(1);
    });

    it("should handle many component layout", () => {
      const generator = new LayoutGenerator(defaultConfig);
      const layout = generator.generate("grid", { componentCount: 20 });

      expect(layout.components.length).toBeGreaterThan(0);
    });

    it("should handle min column configuration", () => {
      const generator = new LayoutGenerator({
        ...defaultConfig,
        minColumns: 3,
      });
      const layout = generator.generate("grid");

      expect(layout).toBeDefined();
    });

    it("should handle max column configuration", () => {
      const generator = new LayoutGenerator({
        ...defaultConfig,
        maxColumns: 6,
      });
      const layout = generator.generate("grid");

      expect(layout).toBeDefined();
    });
  });
});
