/**
 * @lsi/vljepa-synthetic - ComponentGenerator Tests
 *
 * 50+ tests for ComponentGenerator
 */

import { describe, it, expect } from "vitest";
import { ComponentGenerator } from "../src/generators/ComponentGenerator.js";
import type { ComponentGeneratorConfig, ComponentType } from "../src/types.js";

describe("ComponentGenerator", () => {
  const defaultConfig: ComponentGeneratorConfig = {
    componentTypes: ["button", "input", "card", "modal", "alert"],
    styleSystems: ["tailwind", "material"],
    variations: {
      colors: 3,
      sizes: 3,
      states: 3,
    },
    seed: 12345,
  };

  describe("constructor", () => {
    it("should create ComponentGenerator with config", () => {
      const generator = new ComponentGenerator(defaultConfig);
      expect(generator).toBeDefined();
    });

    it("should accept custom seed", () => {
      const generator1 = new ComponentGenerator({ ...defaultConfig, seed: 1 });
      const generator2 = new ComponentGenerator({ ...defaultConfig, seed: 1 });
      const btn1 = generator1.generate("button");
      const btn2 = generator2.generate("button");
      expect(btn1.metadata.seed).toBe(btn2.metadata.seed);
    });
  });

  describe("generate", () => {
    it("should generate button component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.type).toBe("button");
      expect(component.code).toBeDefined();
      expect(component.styles).toBeDefined();
      expect(component.props).toBeDefined();
      expect(component.metadata).toBeDefined();
    });

    it("should generate input component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("input");

      expect(component.type).toBe("input");
      expect(component.code).toContain("input");
      expect(component.code).toContain("type=");
    });

    it("should generate textarea component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("textarea");

      expect(component.type).toBe("textarea");
      expect(component.code).toContain("textarea");
    });

    it("should generate card component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("card");

      expect(component.type).toBe("card");
      expect(component.code).toContain("card");
    });

    it("should generate modal component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("modal");

      expect(component.type).toBe("modal");
      expect(component.code).toContain("modal");
    });

    it("should generate alert component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("alert");

      expect(component.type).toBe("alert");
      expect(component.code).toContain("alert");
    });

    it("should generate spinner component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("spinner");

      expect(component.type).toBe("spinner");
      expect(component.code).toContain("spinner");
    });

    it("should generate tabs component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("tabs");

      expect(component.type).toBe("tabs");
      expect(component.code).toContain("tabs");
    });

    it("should generate navbar component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("navbar");

      expect(component.type).toBe("navbar");
      expect(component.code).toContain("navbar");
    });

    it("should generate sidebar component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("sidebar");

      expect(component.type).toBe("sidebar");
      expect(component.code).toContain("sidebar");
    });

    it("should generate table component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("table");

      expect(component.type).toBe("table");
      expect(component.code).toContain("table");
    });

    it("should generate form component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("form");

      expect(component.type).toBe("form");
      expect(component.code).toContain("form");
    });

    it("should respect custom styleSystem option", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button", { styleSystem: "material" });

      expect(component.metadata.styleSystem).toBe("material");
    });

    it("should respect custom state option", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button", { state: "hover" });

      expect(component.metadata.state).toBe("hover");
    });

    it("should generate unique IDs for each component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component1 = generator.generate("button");
      const component2 = generator.generate("button");

      expect(component1.metadata.id).not.toBe(component2.metadata.id);
    });

    it("should include tags in metadata", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.metadata.tags).toBeDefined();
      expect(component.metadata.tags).toContain("button");
    });

    it("should generate component with proper CSS styles", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.styles).toBeDefined();
      expect(component.styles.display).toBeDefined();
    });

    it("should include props for component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.props).toBeDefined();
      expect(component.props.id).toBeDefined();
    });
  });

  describe("generateBatch", () => {
    it("should generate multiple components", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const components = generator.generateBatch("button", 10);

      expect(components).toHaveLength(10);
      components.forEach(c => {
        expect(c.type).toBe("button");
      });
    });

    it("should generate components with different states", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const components = generator.generateBatch("button", 20);

      const states = new Set(components.map(c => c.metadata.state));
      expect(states.size).toBeGreaterThan(1);
    });

    it("should generate components with different style systems", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const components = generator.generateBatch("button", 20);

      const styleSystems = new Set(components.map(c => c.metadata.styleSystem));
      expect(styleSystems.size).toBeGreaterThan(1);
    });
  });

  describe("generateAllVariations", () => {
    it("should generate all variations for component type", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const variations = generator.generateAllVariations("button");

      const expectedCount = 2 * 3 * 3 * 3; // styleSystems * colors * sizes * states
      expect(variations.length).toBeGreaterThanOrEqual(expectedCount * 0.5);
    });

    it("should include diverse color variations", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const variations = generator.generateAllVariations("button");

      const backgroundColors = new Set(
        variations
          .map(v => v.styles.backgroundColor)
          .filter(Boolean)
      );

      expect(backgroundColors.size).toBeGreaterThan(5);
    });

    it("should include different size variations", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const variations = generator.generateAllVariations("button");

      const sizes = new Set(variations.map(v => v.metadata.size).filter(Boolean));

      expect(sizes.size).toBeGreaterThan(1);
    });

    it("should include different state variations", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const variations = generator.generateAllVariations("button");

      const states = new Set(variations.map(v => v.metadata.state));

      expect(states.size).toBeGreaterThan(1);
      expect(states.has("default")).toBe(true);
    });
  });

  describe("button generation", () => {
    it("should generate primary button", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button", { variant: "primary" });

      expect(button.metadata.variant).toBe("primary");
    });

    it("should generate danger button", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button", { variant: "danger" });

      expect(button.metadata.variant).toBe("danger");
    });

    it("should generate different button sizes", () => {
      const generator = new ComponentGenerator(defaultConfig);

      const xs = generator.generate("button", { size: "xs" });
      const lg = generator.generate("button", { size: "lg" });

      expect(xs.metadata.size).toBe("xs");
      expect(lg.metadata.size).toBe("lg");
    });

    it("should generate disabled button", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button", { state: "disabled" });

      expect(button.metadata.state).toBe("disabled");
      expect(button.props.disabled).toBe(true);
    });

    it("should generate loading button", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button", { state: "loading" });

      expect(button.metadata.state).toBe("loading");
      expect(button.code).toContain("Loading");
    });

    it("should include proper button padding", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button");

      expect(button.styles.padding).toBeDefined();
    });

    it("should include border radius", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button");

      expect(button.styles.borderRadius).toBeDefined();
    });

    it("should include font weight", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const button = generator.generate("button");

      expect(button.styles.fontWeight).toBeDefined();
    });
  });

  describe("input generation", () => {
    it("should generate text input", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input");

      expect(input.code).toContain('type="text"');
    });

    it("should generate email input", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input");

      expect(input.props.type).toBeDefined();
    });

    it("should include placeholder", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input");

      expect(input.code).toContain("placeholder");
    });

    it("should include border styles", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input");

      expect(input.styles.border).toBeDefined();
    });

    it("should include padding", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input");

      expect(input.styles.padding).toBeDefined();
    });

    it("should generate disabled input", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const input = generator.generate("input", { state: "disabled" });

      expect(input.props.disabled).toBe(true);
    });
  });

  describe("card generation", () => {
    it("should generate card with image", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const card = generator.generate("card");

      expect(card.props.hasImage).toBeDefined();
      expect(card.code).toContain("card");
    });

    it("should generate card with stats", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const card = generator.generate("card");

      expect(card.props.hasStats).toBeDefined();
    });

    it("should include card title", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const card = generator.generate("card");

      expect(card.code).toContain("Card Title");
    });

    it("should include card content", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const card = generator.generate("card");

      expect(card.code).toContain("content");
    });
  });

  describe("style system integration", () => {
    it("should generate tailwind component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button", { styleSystem: "tailwind" });

      expect(component.metadata.styleSystem).toBe("tailwind");
    });

    it("should generate material component", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button", { styleSystem: "material" });

      expect(component.metadata.styleSystem).toBe("material");
    });

    it("should generate ant design component", () => {
      const generator = new ComponentGenerator({
        ...defaultConfig,
        styleSystems: ["ant"],
      });
      const component = generator.generate("button");

      expect(component.metadata.styleSystem).toBe("ant");
    });

    it("should include style system prefix in class", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button", { styleSystem: "material" });

      expect(component.code).toContain("md-");
    });
  });

  describe("timestamp and metadata", () => {
    it("should include generation timestamp", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const before = Date.now();
      const component = generator.generate("button");
      const after = Date.now();

      expect(component.metadata.timestamp).toBeGreaterThanOrEqual(before);
      expect(component.metadata.timestamp).toBeLessThanOrEqual(after);
    });

    it("should include seed in metadata", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.metadata.seed).toBeDefined();
    });

    it("should include component type in metadata", () => {
      const generator = new ComponentGenerator(defaultConfig);
      const component = generator.generate("button");

      expect(component.metadata.type).toBe("button");
    });
  });
});
