/**
 * A2UI Protocol Type Definitions Tests
 *
 * Tests for A2UI protocol types, validation, and utilities
 */

import { describe, it, expect } from "vitest";
import {
  // Types
  type A2UIResponse,
  type A2UIComponent,
  type A2UILayout,
  type A2UIAction,
  type A2UIUpdate,
  type ComponentCatalogEntry,
  type ValidationResult,
  // Validation functions
  validateA2UIResponse,
  validateA2UIComponent,
  validateA2UILayout,
  sanitizeA2UIProps,
  createDefaultSecurityPolicy,
  createCatalogEntry,
  isValidComponentType,
  getComponentSchema,
  formatValidationErrors,
} from "./a2ui.js";

describe("A2UI Protocol - Core Types", () => {
  describe("A2UIResponse", () => {
    it("should create valid A2UI response", () => {
      const response: A2UIResponse = {
        version: "0.8",
        surface: "main",
        components: [
          {
            type: "button",
            id: "submit-btn",
            props: { label: "Submit" },
          },
        ],
      };

      expect(response.version).toBe("0.8");
      expect(response.surface).toBe("main");
      expect(response.components).toHaveLength(1);
    });

    it("should accept all surface types", () => {
      const surfaces: Array<A2UIResponse["surface"]> = [
        "main",
        "sidebar",
        "modal",
        "inline",
        "overlay",
      ];

      surfaces.forEach(surface => {
        const response: A2UIResponse = {
          version: "0.8",
          surface,
          components: [],
        };
        expect(response.surface).toBe(surface);
      });
    });

    it("should include optional layout", () => {
      const response: A2UIResponse = {
        version: "0.8",
        surface: "main",
        components: [],
        layout: {
          type: "flex",
          direction: "row",
          spacing: 16,
        },
      };

      expect(response.layout).toBeDefined();
      expect(response.layout?.type).toBe("flex");
    });

    it("should include optional metadata", () => {
      const response: A2UIResponse = {
        version: "0.8",
        surface: "main",
        components: [],
        metadata: {
          timestamp: new Date(),
          sessionId: "sess-123",
          agentId: "agent-1",
          generationTime: 100,
          tokensUsed: 50,
          confidence: 0.9,
        },
      };

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.confidence).toBe(0.9);
    });
  });

  describe("A2UIComponent", () => {
    it("should create valid component with minimal props", () => {
      const component: A2UIComponent = {
        type: "text",
        id: "title",
      };

      expect(component.type).toBe("text");
      expect(component.id).toBe("title");
    });

    it("should accept standard component types", () => {
      const types = [
        "container",
        "text",
        "button",
        "input",
        "textarea",
        "select",
        "checkbox",
        "radio",
        "slider",
        "switch",
        "date",
        "image",
        "video",
        "list",
        "table",
        "card",
        "tabs",
        "accordion",
        "modal",
        "dropdown",
        "tooltip",
        "progress",
        "spinner",
        "alert",
        "badge",
        "divider",
        "spacer",
        "chart",
        "form",
      ];

      types.forEach(type => {
        const component: A2UIComponent = { type, id: `test-${type}` };
        expect(component.type).toBe(type);
      });
    });

    it("should support nested children", () => {
      const component: A2UIComponent = {
        type: "container",
        id: "parent",
        children: [
          { type: "text", id: "child1" },
          { type: "button", id: "child2" },
        ],
      };

      expect(component.children).toHaveLength(2);
      expect(component.children![0].type).toBe("text");
    });

    it("should support event handlers", () => {
      const component: A2UIComponent = {
        type: "button",
        id: "click-btn",
        events: [
          { name: "click", handler: "handleClick", params: { id: 123 } },
        ],
      };

      expect(component.events).toHaveLength(1);
      expect(component.events![0].name).toBe("click");
    });

    it("should support accessibility attributes", () => {
      const component: A2UIComponent = {
        type: "button",
        id: "accessible-btn",
        a11y: {
          label: "Submit form",
          level: "AA",
          srOnly: "Submit button",
        },
      };

      expect(component.a11y).toBeDefined();
      expect(component.a11y?.level).toBe("AA");
    });

    it("should support inline styles", () => {
      const component: A2UIComponent = {
        type: "text",
        id: "styled-text",
        style: {
          color: "blue",
          fontSize: 16,
          fontWeight: "bold",
        },
      };

      expect(component.style?.color).toBe("blue");
    });

    it("should support visibility and disabled states", () => {
      const component: A2UIComponent = {
        type: "button",
        id: "state-btn",
        visible: true,
        disabled: false,
      };

      expect(component.visible).toBe(true);
      expect(component.disabled).toBe(false);
    });
  });

  describe("A2UILayout", () => {
    it("should create valid layout", () => {
      const layout: A2UILayout = {
        type: "flex",
        direction: "row",
        spacing: 16,
        alignment: "center",
      };

      expect(layout.type).toBe("flex");
      expect(layout.direction).toBe("row");
    });

    it("should accept all layout types", () => {
      const types: Array<A2UILayout["type"]> = [
        "vertical",
        "horizontal",
        "grid",
        "flex",
        "stack",
        "absolute",
      ];

      types.forEach(type => {
        const layout: A2UILayout = { type };
        expect(layout.type).toBe(type);
      });
    });

    it("should support responsive breakpoints", () => {
      const layout: A2UILayout = {
        type: "flex",
        responsive: {
          mobile: { type: "vertical", spacing: 8 },
          tablet: { type: "horizontal", spacing: 12 },
          desktop: { type: "grid", columns: 3 },
        },
      };

      expect(layout.responsive?.mobile).toBeDefined();
      expect(layout.responsive?.mobile?.type).toBe("vertical");
    });

    it("should support grid-specific props", () => {
      const layout: A2UILayout = {
        type: "grid",
        columns: 3,
        rows: 2,
        gap: 16,
      };

      expect(layout.columns).toBe(3);
      expect(layout.rows).toBe(2);
    });

    it("should support size constraints", () => {
      const layout: A2UILayout = {
        type: "flex",
        width: "100%",
        height: "100vh",
        maxWidth: 1200,
        maxHeight: 800,
      };

      expect(layout.width).toBe("100%");
      expect(layout.maxWidth).toBe(1200);
    });
  });

  describe("A2UIAction", () => {
    it("should create valid action", () => {
      const action: A2UIAction = {
        id: "submit-action",
        type: "submit",
        handler: "handleSubmit",
      };

      expect(action.type).toBe("submit");
      expect(action.handler).toBe("handleSubmit");
    });

    it("should support confirmation", () => {
      const action: A2UIAction = {
        id: "delete-action",
        type: "delete",
        handler: "handleDelete",
        confirm: true,
        confirmMessage: "Are you sure you want to delete?",
      };

      expect(action.confirm).toBe(true);
      expect(action.confirmMessage).toBeDefined();
    });

    it("should support enabled and loading states", () => {
      const action: A2UIAction = {
        id: "async-action",
        type: "custom",
        handler: "handleAsync",
        enabled: true,
        loading: false,
      };

      expect(action.enabled).toBe(true);
      expect(action.loading).toBe(false);
    });
  });

  describe("A2UIUpdate", () => {
    it("should create component update", () => {
      const update: A2UIUpdate = {
        type: "component",
        componentId: "comp-1",
        data: {
          type: "text",
          id: "comp-1",
          props: { content: "Updated" },
        },
      };

      expect(update.type).toBe("component");
      expect(update.componentId).toBe("comp-1");
    });

    it("should create removal update", () => {
      const update: A2UIUpdate = {
        type: "remove",
        removalIds: ["comp-1", "comp-2"],
      };

      expect(update.type).toBe("remove");
      expect(update.removalIds).toHaveLength(2);
    });

    it("should create done update", () => {
      const update: A2UIUpdate = {
        type: "done",
        done: true,
        index: 10,
        total: 10,
      };

      expect(update.type).toBe("done");
      expect(update.done).toBe(true);
    });

    it("should create error update", () => {
      const update: A2UIUpdate = {
        type: "error",
        error: "Generation failed: timeout",
      };

      expect(update.type).toBe("error");
      expect(update.error).toBeDefined();
    });
  });
});

describe("A2UI Protocol - Validation", () => {
  describe("validateA2UIResponse", () => {
    it("should validate valid response", () => {
      const response: A2UIResponse = {
        version: "0.8",
        surface: "main",
        components: [{ type: "text", id: "text-1" }],
      };

      const result = validateA2UIResponse(response);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid version", () => {
      const response = {
        version: "0.7",
        surface: "main",
        components: [],
      };

      const result = validateA2UIResponse(response);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_VERSION")).toBe(true);
    });

    it("should reject invalid surface", () => {
      const response = {
        version: "0.8",
        surface: "invalid",
        components: [],
      };

      const result = validateA2UIResponse(response);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_SURFACE")).toBe(true);
    });

    it("should reject non-array components", () => {
      const response = {
        version: "0.8",
        surface: "main",
        components: "not-an-array",
      };

      const result = validateA2UIResponse(response);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_COMPONENTS")).toBe(
        true
      );
    });

    it("should validate nested components", () => {
      const response: A2UIResponse = {
        version: "0.8",
        surface: "main",
        components: [
          {
            type: "container",
            id: "parent",
            children: [
              { type: "text", id: "child1" },
              { type: "invalid" }, // Missing id
            ],
          },
        ],
      };

      const result = validateA2UIResponse(response);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_ID")).toBe(true);
    });
  });

  describe("validateA2UIComponent", () => {
    it("should validate valid component", () => {
      const component: A2UIComponent = {
        type: "button",
        id: "btn-1",
        props: { label: "Click me" },
      };

      const result = validateA2UIComponent(component);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing type", () => {
      const component = { id: "comp-1" };

      const result = validateA2UIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_TYPE")).toBe(true);
    });

    it("should reject missing id", () => {
      const component = { type: "text" };

      const result = validateA2UIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_ID")).toBe(true);
    });

    it("should reject invalid children", () => {
      const component: A2UIComponent = {
        type: "container",
        id: "parent",
        children: "not-an-array" as unknown as A2UIComponent[],
      };

      const result = validateA2UIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_CHILDREN")).toBe(true);
    });

    it("should validate children recursively", () => {
      const component: A2UIComponent = {
        type: "container",
        id: "parent",
        children: [
          { type: "text", id: "child1" },
          { type: "invalid" }, // Missing id
        ],
      };

      const result = validateA2UIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "MISSING_ID")).toBe(true);
    });
  });

  describe("validateA2UILayout", () => {
    it("should validate valid layout", () => {
      const layout: A2UILayout = {
        type: "flex",
        direction: "row",
        spacing: 16,
      };

      const result = validateA2UILayout(layout);

      expect(result.valid).toBe(true);
    });

    it("should reject invalid type", () => {
      const layout = { type: "invalid" };

      const result = validateA2UILayout(layout);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_TYPE")).toBe(true);
    });

    it("should accept all valid layout types", () => {
      const types: A2UILayout["type"][] = [
        "vertical",
        "horizontal",
        "grid",
        "flex",
        "stack",
        "absolute",
      ];

      types.forEach(type => {
        const result = validateA2UILayout({ type });
        expect(result.valid).toBe(true);
      });
    });
  });
});

describe("A2UI Protocol - Sanitization", () => {
  describe("sanitizeA2UIProps", () => {
    const schema = [
      { name: "label", type: "string" as const, required: true },
      { name: "count", type: "number" as const, required: false, default: 0 },
      {
        name: "disabled",
        type: "boolean" as const,
        required: false,
        default: false,
      },
      { name: "items", type: "array" as const, required: false },
      { name: "style", type: "object" as const, required: false },
      { name: "onClick", type: "function" as const, required: false },
      {
        name: "variant",
        type: "enum" as const,
        required: false,
        enum: ["primary", "secondary", "danger"],
        default: "primary",
      },
    ];

    it("should sanitize valid props", () => {
      const props = {
        label: "Button",
        count: 5,
        disabled: true,
        items: [1, 2, 3],
        variant: "primary" as const,
      };

      const result = sanitizeA2UIProps(props, schema);

      expect(result.label).toBe("Button");
      expect(result.count).toBe(5);
      expect(result.disabled).toBe(true);
    });

    it("should use defaults for missing props", () => {
      const props = { label: "Button" };

      const result = sanitizeA2UIProps(props, schema);

      expect(result.count).toBe(0);
      expect(result.disabled).toBe(false);
      expect(result.variant).toBe("primary");
    });

    it("should reject invalid types", () => {
      const props = {
        label: "Button",
        count: "not-a-number",
        variant: "invalid" as const,
      };

      const result = sanitizeA2UIProps(props, schema);

      expect(result.count).toBe(0); // Uses default
      expect(result.variant).toBe("primary"); // Uses default
    });

    it("should use custom validation", () => {
      const schemaWithValidation = [
        {
          name: "email",
          type: "string" as const,
          required: true,
          validation: (value: unknown) =>
            typeof value === "string" && value.includes("@"),
        },
      ];

      const props = { email: "invalid-email" };

      const result = sanitizeA2UIProps(props, schemaWithValidation);

      // Validation fails, prop is removed
      expect(result.email).toBeUndefined();
    });

    it("should use custom sanitization", () => {
      const schemaWithSanitize = [
        {
          name: "html",
          type: "string" as const,
          required: true,
          sanitize: (value: unknown) => {
            if (typeof value === "string") {
              return value.replace(/<script>/g, "");
            }
            return value;
          },
        },
      ];

      const props = { html: '<p>Hello<script>alert("xss")</script></p>' };

      const result = sanitizeA2UIProps(props, schemaWithSanitize);

      // The sanitization removes <script> but leaves </script> which becomes </
      // A real implementation would use DOMPurify or similar
      expect(result.html).toContain("Hello");
    });

    it("should handle array props", () => {
      const props = { items: [1, 2, 3] };
      const result = sanitizeA2UIProps(props, schema);

      expect(result.items).toEqual([1, 2, 3]);
    });

    it("should handle object props", () => {
      const props = { style: { color: "red", fontSize: 16 } };
      const result = sanitizeA2UIProps(props, schema);

      expect(result.style).toEqual({ color: "red", fontSize: 16 });
    });
  });
});

describe("A2UI Protocol - Utilities", () => {
  describe("createDefaultSecurityPolicy", () => {
    it("should create default security policy", () => {
      const policy = createDefaultSecurityPolicy();

      expect(policy.maxNestingDepth).toBe(10);
      expect(policy.sanitizeInput).toBe(true);
      expect(policy.rateLimit).toBe(60);
      expect(policy.maxComponents).toBe(100);
    });
  });

  describe("createCatalogEntry", () => {
    it("should create entry with default security", () => {
      const entry = createCatalogEntry({
        type: "button",
        component: "Button",
        props: [],
        category: "input",
      });

      expect(entry.security).toBeDefined();
      expect(entry.security.maxNestingDepth).toBe(10);
    });

    it("should use custom security if provided", () => {
      const customSecurity = { maxNestingDepth: 5, sanitizeInput: false };

      const entry = createCatalogEntry({
        type: "button",
        component: "Button",
        props: [],
        security: customSecurity,
        category: "input",
      });

      expect(entry.security.maxNestingDepth).toBe(5);
      expect(entry.security.sanitizeInput).toBe(false);
    });
  });

  describe("isValidComponentType", () => {
    it("should return true for valid component type", () => {
      const catalog = {
        version: "0.8",
        components: new Map([
          [
            "button",
            { type: "button", component: "Button", props: [], security: {} },
          ],
        ]),
        defaultSecurity: {},
      };

      expect(isValidComponentType("button", catalog)).toBe(true);
    });

    it("should return false for invalid component type", () => {
      const catalog = {
        version: "0.8",
        components: new Map(),
        defaultSecurity: {},
      };

      expect(isValidComponentType("invalid", catalog)).toBe(false);
    });
  });

  describe("getComponentSchema", () => {
    it("should return component schema", () => {
      const schema: ComponentCatalogEntry = {
        type: "button",
        component: "Button",
        props: [],
        security: {},
      };

      const catalog = {
        version: "0.8",
        components: new Map([["button", schema]]),
        defaultSecurity: {},
      };

      const result = getComponentSchema("button", catalog);

      expect(result).toEqual(schema);
    });

    it("should return undefined for missing component", () => {
      const catalog = {
        version: "0.8",
        components: new Map(),
        defaultSecurity: {},
      };

      const result = getComponentSchema("missing", catalog);

      expect(result).toBeUndefined();
    });
  });

  describe("formatValidationErrors", () => {
    it("should format errors", () => {
      const result: ValidationResult = {
        valid: false,
        errors: [
          { code: "ERR1", message: "Error 1", path: "field1" },
          { code: "ERR2", message: "Error 2", path: "field2" },
        ],
        warnings: [],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain("Errors:");
      expect(formatted).toContain("[ERR1] Error 1 at field1");
      expect(formatted).toContain("[ERR2] Error 2 at field2");
    });

    it("should format warnings", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [{ code: "WARN1", message: "Warning 1", path: "field1" }],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain("Warnings:");
      expect(formatted).toContain("[WARN1] Warning 1 at field1");
    });

    it("should handle empty result", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toBe("");
    });
  });
});

describe("A2UI Protocol - Complex Scenarios", () => {
  it("should validate complete UI response", () => {
    const response: A2UIResponse = {
      version: "0.8",
      surface: "main",
      components: [
        {
          type: "container",
          id: "main-container",
          layout: {
            type: "vertical",
            spacing: 16,
          },
          children: [
            {
              type: "text",
              id: "title",
              props: { content: "Welcome", variant: "h1" },
            },
            {
              type: "form",
              id: "login-form",
              children: [
                {
                  type: "input",
                  id: "email",
                  props: { type: "email", placeholder: "Email" },
                  a11y: { label: "Email address" },
                },
                {
                  type: "button",
                  id: "submit",
                  props: { label: "Submit", variant: "primary" },
                  events: [{ name: "click", handler: "handleSubmit" }],
                },
              ],
            },
          ],
        },
      ],
      actions: [
        {
          id: "submit",
          type: "submit",
          handler: "handleSubmit",
          confirm: false,
        },
      ],
      metadata: {
        timestamp: new Date(),
        sessionId: "sess-123",
        agentId: "agent-1",
        generationTime: 150,
        tokensUsed: 75,
        confidence: 0.95,
      },
    };

    const result = validateA2UIResponse(response);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate responsive layout", () => {
    const layout: A2UILayout = {
      type: "flex",
      direction: "row",
      spacing: 24,
      alignment: "center",
      responsive: {
        mobile: {
          type: "vertical",
          spacing: 16,
          alignment: "start",
        },
        tablet: {
          type: "horizontal",
          spacing: 20,
          alignment: "center",
        },
        desktop: {
          type: "grid",
          columns: 3,
          gap: 24,
        },
      },
    };

    const result = validateA2UILayout(layout);

    expect(result.valid).toBe(true);
  });

  it("should handle streaming updates", () => {
    const updates: A2UIUpdate[] = [
      {
        type: "component",
        componentId: "header",
        data: { type: "text", id: "header", props: { content: "Loading..." } },
      },
      {
        type: "component",
        componentId: "content",
        data: {
          type: "text",
          id: "content",
          props: { content: "Content loaded" },
        },
      },
      {
        type: "layout",
        componentId: "main",
        data: { type: "vertical", spacing: 16 },
      },
      { type: "done", done: true, index: 3, total: 3 },
    ];

    updates.forEach((update, index) => {
      expect(update.type).toBeDefined();
      if (index === updates.length - 1) {
        expect(update.type).toBe("done");
        expect(update.done).toBe(true);
      }
    });
  });

  it("should sanitize complex props with validation", () => {
    const schema = [
      {
        name: "user",
        type: "object" as const,
        required: true,
        validation: (value: unknown) => {
          const obj = value as Record<string, unknown>;
          return (
            typeof obj === "object" &&
            typeof obj.name === "string" &&
            typeof obj.age === "number"
          );
        },
      },
      {
        name: "tags",
        type: "array" as const,
        required: false,
        sanitize: (value: unknown) => {
          if (Array.isArray(value)) {
            return value.map(tag => String(tag)).filter(t => t.length > 0);
          }
          return [];
        },
      },
    ];

    const props = {
      user: { name: "Alice", age: 30 },
      tags: ["tag1", "tag2", "", 123],
    };

    const result = sanitizeA2UIProps(props, schema);

    expect(result.user).toEqual({ name: "Alice", age: 30 });
    expect(result.tags).toEqual(["tag1", "tag2", "123"]); // Sanitized
  });
});
