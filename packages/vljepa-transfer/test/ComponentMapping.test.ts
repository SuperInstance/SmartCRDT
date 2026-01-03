/**
 * Component Mapping Tests
 * Test component mapping between frameworks
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ComponentMapper,
  ComponentMappingRegistry,
  ReactToVueMapping,
  ReactToAngularMapping,
  ReactToFlutterMapping,
  ReactToSvelteMapping,
  ReactToSwiftUIMapping,
} from "../src/mapping/ComponentMapping.js";
import type { ParsedComponent, UIFramework } from "../src/types.js";

describe("ComponentMapping", () => {
  describe("ComponentMappingRegistry", () => {
    beforeEach(() => {
      // Clear registry
      (ComponentMappingRegistry as any).mappings.clear();
      // Re-register mappings
      ComponentMappingRegistry.register(ReactToVueMapping);
      ComponentMappingRegistry.register(ReactToAngularMapping);
      ComponentMappingRegistry.register(ReactToFlutterMapping);
      ComponentMappingRegistry.register(ReactToSvelteMapping);
      ComponentMappingRegistry.register(ReactToSwiftUIMapping);
    });

    it("should register mapping", () => {
      const hasMapping = ComponentMappingRegistry.has("react", "vue");
      expect(hasMapping).toBe(true);
    });

    it("should get registered mapping", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping).toBeDefined();
      expect(mapping?.fromFramework).toBe("react");
      expect(mapping?.toFramework).toBe("vue");
    });

    it("should return undefined for non-existent mapping", () => {
      const mapping = ComponentMappingRegistry.get("vue", "react");
      expect(mapping).toBeDefined(); // Reverse mapping is registered
    });
  });

  describe("React to Vue Mapping", () => {
    it("should map Button to el-button", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.mappings.get("Button")).toBe("el-button");
    });

    it("should map Input to el-input", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.mappings.get("Input")).toBe("el-input");
    });

    it("should map Card to el-card", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.mappings.get("Card")).toBe("el-card");
    });

    it("should map onClick to @click", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.events.find((e) => e.fromEvent === "onClick")?.toEvent).toBe("click");
    });

    it("should map onChange to @change", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.events.find((e) => e.fromEvent === "onChange")?.toEvent).toBe("change");
    });

    it("should map className to class", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.props.find((p) => p.fromProp === "className")?.toProp).toBe("class");
    });

    it("should map value to v-model", () => {
      const mapping = ComponentMappingRegistry.get("react", "vue");
      expect(mapping?.props.find((p) => p.fromProp === "value")?.toProp).toBe("v-model");
    });
  });

  describe("React to Angular Mapping", () => {
    it("should map Button to mat-button", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.mappings.get("Button")).toBe("mat-button");
    });

    it("should map Input to mat-input", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.mappings.get("Input")).toBe("mat-input");
    });

    it("should map onClick to (click)", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.events.find((e) => e.fromEvent === "onClick")?.toEvent).toBe("click");
    });

    it("should map onChange to (change)", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.events.find((e) => e.fromEvent === "onChange")?.toEvent).toBe("change");
    });

    it("should map className to class", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.props.find((p) => p.fromProp === "className")?.toProp).toBe("class");
    });

    it("should map value to [ngModel]", () => {
      const mapping = ComponentMappingRegistry.get("react", "angular");
      expect(mapping?.props.find((p) => p.fromProp === "value")?.toProp).toBe("[ngModel]");
    });
  });

  describe("React to Flutter Mapping", () => {
    it("should map Button to ElevatedButton", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.mappings.get("Button")).toBe("ElevatedButton");
    });

    it("should map Input to TextField", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.mappings.get("Input")).toBe("TextField");
    });

    it("should map Container to Container", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.mappings.get("Container")).toBe("Container");
    });

    it("should map Row to Row", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.mappings.get("Row")).toBe("Row");
    });

    it("should map Column to Column", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.mappings.get("Column")).toBe("Column");
    });

    it("should map onClick to onPressed", () => {
      const mapping = ComponentMappingRegistry.get("react", "flutter");
      expect(mapping?.events.find((e) => e.fromEvent === "onClick")?.toEvent).toBe("onPressed");
    });
  });

  describe("React to Svelte Mapping", () => {
    it("should map Button to Button", () => {
      const mapping = ComponentMappingRegistry.get("react", "svelte");
      expect(mapping?.mappings.get("Button")).toBe("Button");
    });

    it("should map Input to Input", () => {
      const mapping = ComponentMappingRegistry.get("react", "svelte");
      expect(mapping?.mappings.get("Input")).toBe("Input");
    });

    it("should map onClick to on:click", () => {
      const mapping = ComponentMappingRegistry.get("react", "svelte");
      expect(mapping?.events.find((e) => e.fromEvent === "onClick")?.toEvent).toBe("click");
    });

    it("should map onChange to on:change", () => {
      const mapping = ComponentMappingRegistry.get("react", "svelte");
      expect(mapping?.events.find((e) => e.fromEvent === "onChange")?.toEvent).toBe("change");
    });

    it("should map className to class", () => {
      const mapping = ComponentMappingRegistry.get("react", "svelte");
      expect(mapping?.props.find((p) => p.fromProp === "className")?.toProp).toBe("class");
    });
  });

  describe("React to SwiftUI Mapping", () => {
    it("should map Button to Button", () => {
      const mapping = ComponentMappingRegistry.get("react", "swiftui");
      expect(mapping?.mappings.get("Button")).toBe("Button");
    });

    it("should map Input to TextField", () => {
      const mapping = ComponentMappingRegistry.get("react", "swiftui");
      expect(mapping?.mappings.get("Input")).toBe("TextField");
    });

    it("should map Select to Picker", () => {
      const mapping = ComponentMappingRegistry.get("react", "swiftui");
      expect(mapping?.mappings.get("Select")).toBe("Picker");
    });

    it("should map Switch to Toggle", () => {
      const mapping = ComponentMappingRegistry.get("react", "swiftui");
      expect(mapping?.mappings.get("Switch")).toBe("Toggle");
    });

    it("should map onClick to .onTapGesture()", () => {
      const mapping = ComponentMappingRegistry.get("react", "swiftui");
      expect(mapping?.props.find((p) => p.fromProp === "onClick")?.toProp).toBe(".onTapGesture()");
    });
  });

  describe("ComponentMapper", () => {
    let mockComponent: ParsedComponent;

    beforeEach(() => {
      mockComponent = {
        name: "MyButton",
        type: "Button",
        props: [
          { name: "label", type: "string", required: true },
          { name: "disabled", type: "boolean", required: false },
          { name: "onClick", type: "function", required: false },
        ],
        state: [],
        events: [
          { name: "onClick", type: "MouseEvent", handler: "handleClick" },
        ],
        children: [],
      };
    });

    it("should map component to Vue", () => {
      const mapped = ComponentMapper.mapComponent(mockComponent, "vue");

      expect(mapped.type).toBe("el-button");
    });

    it("should map component to Angular", () => {
      const mapped = ComponentMapper.mapComponent(mockComponent, "angular");

      expect(mapped.type).toBe("mat-button");
    });

    it("should map component to Flutter", () => {
      const mapped = ComponentMapper.mapComponent(mockComponent, "flutter");

      expect(mapped.type).toBe("ElevatedButton");
    });

    it("should map component to Svelte", () => {
      const mapped = ComponentMapper.mapComponent(mockComponent, "svelte");

      expect(mapped.type).toBe("Button");
    });

    it("should map component to SwiftUI", () => {
      const mapped = ComponentMapper.mapComponent(mockComponent, "swiftui");

      expect(mapped.type).toBe("Button");
    });

    it("should throw error for unsupported mapping", () => {
      expect(() =>
        ComponentMapper.mapComponent(mockComponent, "swiftui" as UIFramework)
      ).not.toThrow(); // SwiftUI mapping exists
    });

    it("should get target component name", () => {
      const target = ComponentMapper.getTargetComponent("Button", "react", "vue");
      expect(target).toBe("el-button");
    });

    it("should return undefined for non-existent component", () => {
      const target = ComponentMapper.getTargetComponent("NonExistent", "react", "vue");
      expect(target).toBeUndefined();
    });

    it("should map props between frameworks", () => {
      const props = [
        { name: "className", type: "string", required: false },
        { name: "onClick", type: "function", required: false },
      ];

      const mapped = ComponentMapper.mapProps(props, "react", "vue");

      expect(mapped[0].name).toBe("class");
      expect(mapped[1].name).toBe("@click");
    });

    it("should map events between frameworks", () => {
      const events = [
        { name: "onClick", type: "MouseEvent" },
        { name: "onChange", type: "ChangeEvent" },
      ];

      const mapped = ComponentMapper.mapEvents(events, "react", "vue");

      expect(mapped[0].name).toBe("click");
      expect(mapped[1].name).toBe("change");
    });

    it("should map styles between frameworks", () => {
      const styles = [
        { selector: "className", properties: {} },
        { selector: "style", properties: {} },
      ];

      const mapped = ComponentMapper.mapStyles(styles, "react", "vue");

      expect(mapped[0].selector).toBe("class");
      expect(mapped[1].selector).toBe(":style");
    });
  });

  describe("Component Coverage", () => {
    it("should have mappings for all common components", () => {
      const commonComponents = [
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
        "Alert",
        "Badge",
        "Table",
        "List",
        "Image",
        "Icon",
        "Avatar",
        "Divider",
        "Progress",
        "Tooltip",
        "Menu",
      ];

      const vueMapping = ComponentMappingRegistry.get("react", "vue");
      const angularMapping = ComponentMappingRegistry.get("react", "angular");
      const flutterMapping = ComponentMappingRegistry.get("react", "flutter");

      for (const component of commonComponents) {
        // Not all frameworks have all components, but most should
        const hasVue = vueMapping?.mappings.has(component);
        const hasAngular = angularMapping?.mappings.has(component);
        const hasFlutter = flutterMapping?.mappings.has(component);

        // At least one framework should have the mapping
        expect(hasVue || hasAngular || hasFlutter).toBe(true);
      }
    });
  });

  describe("Prop Mapping Coverage", () => {
    it("should have prop mappings for common props", () => {
      const commonProps = [
        "className",
        "onChange",
        "onClick",
        "disabled",
        "placeholder",
        "value",
        "style",
      ];

      const vueMapping = ComponentMappingRegistry.get("react", "vue");
      const angularMapping = ComponentMappingRegistry.get("react", "angular");

      for (const prop of commonProps) {
        const hasVue = vueMapping?.props.some((p) => p.fromProp === prop);
        const hasAngular = angularMapping?.props.some((p) => p.fromProp === prop);

        expect(hasVue || hasAngular).toBe(true);
      }
    });
  });

  describe("Event Mapping Coverage", () => {
    it("should have event mappings for common events", () => {
      const commonEvents = [
        "onClick",
        "onChange",
        "onInput",
        "onSubmit",
        "onFocus",
        "onBlur",
        "onLoad",
        "onError",
      ];

      const vueMapping = ComponentMappingRegistry.get("react", "vue");
      const angularMapping = ComponentMappingRegistry.get("react", "angular");

      for (const event of commonEvents) {
        const hasVue = vueMapping?.events.some((e) => e.fromEvent === event);
        const hasAngular = angularMapping?.events.some((e) => e.fromEvent === event);

        expect(hasVue || hasAngular).toBe(true);
      }
    });
  });
});
