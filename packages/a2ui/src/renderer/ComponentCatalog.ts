/**
 * Component Catalog - Registry of available UI components
 *
 * Defines which components can be used in A2UI and their properties,
 * validation rules, and security policies.
 */

import type {
  ComponentCatalog,
  ComponentCatalogEntry,
  ComponentPropSchema,
  SecurityPolicy,
  A2UIComponentType,
} from "@lsi/protocol";

/**
 * Default security policy for components
 */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxNestingDepth: 10,
  allowedDataSources: ["*"],
  sanitizeInput: true,
  rateLimit: 60,
  maxComponents: 100,
  allowedHandlers: ["*"],
  blockedUrls: [],
};

/**
 * Prop schema builders
 */
export const PropSchemas = {
  string: (
    name: string,
    required = false,
    defaultValue?: string
  ): ComponentPropSchema => ({
    name,
    type: "string",
    required,
    default: defaultValue,
  }),

  number: (
    name: string,
    required = false,
    defaultValue?: number
  ): ComponentPropSchema => ({
    name,
    type: "number",
    required,
    default: defaultValue,
  }),

  boolean: (
    name: string,
    required = false,
    defaultValue?: boolean
  ): ComponentPropSchema => ({
    name,
    type: "boolean",
    required,
    default: defaultValue,
  }),

  array: (name: string, required = false): ComponentPropSchema => ({
    name,
    type: "array",
    required,
  }),

  object: (name: string, required = false): ComponentPropSchema => ({
    name,
    type: "object",
    required,
  }),

  enum: (
    name: string,
    values: unknown[],
    required = false,
    defaultValue?: unknown
  ): ComponentPropSchema => ({
    name,
    type: "enum",
    required,
    enum: values,
    default: defaultValue,
  }),
};

/**
 * Standard component catalog entries
 */
export const STANDARD_COMPONENTS: Record<
  A2UIComponentType,
  Omit<ComponentCatalogEntry, "security"> & {
    security?: Partial<SecurityPolicy>;
  }
> = {
  // Layout components
  container: {
    type: "container",
    component: "Container",
    props: [
      PropSchemas.string("id", true),
      PropSchemas.object("style", false),
      PropSchemas.string("className", false),
    ],
    allowChildren: true,
    category: "layout",
    description: "Container for grouping other components",
  },

  // Text components
  text: {
    type: "text",
    component: "Text",
    props: [
      PropSchemas.string("content", false, ""),
      PropSchemas.enum(
        "variant",
        ["h1", "h2", "h3", "h4", "h5", "h6", "body", "caption"],
        false,
        "body"
      ),
      PropSchemas.enum("align", ["left", "center", "right"], false, "left"),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "display",
    description: "Text display component",
  },

  // Input components
  button: {
    type: "button",
    component: "Button",
    props: [
      PropSchemas.string("label", true),
      PropSchemas.enum(
        "variant",
        ["primary", "secondary", "danger", "ghost", "link"],
        false,
        "primary"
      ),
      PropSchemas.enum("size", ["sm", "md", "lg"], false, "md"),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.boolean("loading", false, false),
      PropSchemas.string("icon", false),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "input",
    description: "Button component",
  },

  input: {
    type: "input",
    component: "Input",
    props: [
      PropSchemas.string("placeholder", false),
      PropSchemas.enum(
        "type",
        ["text", "email", "password", "number", "tel", "url"],
        false,
        "text"
      ),
      PropSchemas.string("value", false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.boolean("required", false, false),
      PropSchemas.string("error", false),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "input",
    description: "Text input component",
  },

  textarea: {
    type: "textarea",
    component: "Textarea",
    props: [
      PropSchemas.string("placeholder", false),
      PropSchemas.string("value", false),
      PropSchemas.number("rows", false, 4),
      PropSchemas.number("minRows", false),
      PropSchemas.number("maxRows", false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.boolean("required", false, false),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "input",
    description: "Multiline text input",
  },

  select: {
    type: "select",
    component: "Select",
    props: [
      PropSchemas.array("options", false),
      PropSchemas.string("placeholder", false, "Select..."),
      PropSchemas.string("value", false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.boolean("required", false, false),
      PropSchemas.boolean("multiple", false, false),
    ],
    allowChildren: false,
    category: "input",
    description: "Select dropdown component",
  },

  checkbox: {
    type: "checkbox",
    component: "Checkbox",
    props: [
      PropSchemas.string("label", false),
      PropSchemas.boolean("checked", false, false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.boolean("required", false, false),
    ],
    allowChildren: false,
    category: "input",
    description: "Checkbox input",
  },

  radio: {
    type: "radio",
    component: "Radio",
    props: [
      PropSchemas.string("label", false),
      PropSchemas.string("value", true),
      PropSchemas.string("name", true),
      PropSchemas.boolean("checked", false, false),
      PropSchemas.boolean("disabled", false, false),
    ],
    allowChildren: false,
    category: "input",
    description: "Radio button input",
  },

  slider: {
    type: "slider",
    component: "Slider",
    props: [
      PropSchemas.number("value", false, 0),
      PropSchemas.number("min", false, 0),
      PropSchemas.number("max", false, 100),
      PropSchemas.number("step", false, 1),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.array("marks", false),
    ],
    allowChildren: false,
    category: "input",
    description: "Slider input for numeric values",
  },

  switch: {
    type: "switch",
    component: "Switch",
    props: [
      PropSchemas.boolean("checked", false, false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.string("label", false),
      PropSchemas.enum("size", ["sm", "md", "lg"], false, "md"),
    ],
    allowChildren: false,
    category: "input",
    description: "Toggle switch component",
  },

  date: {
    type: "date",
    component: "DatePicker",
    props: [
      PropSchemas.string("value", false),
      PropSchemas.boolean("disabled", false, false),
      PropSchemas.string("placeholder", false),
      PropSchemas.enum(
        "format",
        ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"],
        false,
        "YYYY-MM-DD"
      ),
    ],
    allowChildren: false,
    category: "input",
    description: "Date picker component",
  },

  // Display components
  image: {
    type: "image",
    component: "Image",
    props: [
      PropSchemas.string("src", true),
      PropSchemas.string("alt", false),
      PropSchemas.enum(
        "fit",
        ["cover", "contain", "fill", "none", "scale-down"],
        false,
        "cover"
      ),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "display",
    description: "Image display component",
    security: {
      ...DEFAULT_SECURITY_POLICY,
      blockedUrls: ["javascript:", "data:", "vbscript:"],
    },
  },

  video: {
    type: "video",
    component: "Video",
    props: [
      PropSchemas.string("src", true),
      PropSchemas.boolean("controls", false, true),
      PropSchemas.boolean("autoplay", false, false),
      PropSchemas.boolean("loop", false, false),
      PropSchemas.object("style", false),
    ],
    allowChildren: false,
    category: "display",
    description: "Video player component",
  },

  list: {
    type: "list",
    component: "List",
    props: [
      PropSchemas.array("items", false),
      PropSchemas.enum(
        "variant",
        ["bullet", "numbered", "none"],
        false,
        "bullet"
      ),
      PropSchemas.boolean("compact", false, false),
    ],
    allowChildren: true,
    category: "display",
    description: "List display component",
  },

  table: {
    type: "table",
    component: "Table",
    props: [
      PropSchemas.array("columns", false),
      PropSchemas.array("rows", false),
      PropSchemas.boolean("striped", false, false),
      PropSchemas.boolean("hoverable", false, false),
      PropSchemas.boolean("bordered", false, false),
    ],
    allowChildren: true,
    category: "display",
    description: "Table display component",
  },

  card: {
    type: "card",
    component: "Card",
    props: [
      PropSchemas.string("title", false),
      PropSchemas.string("subtitle", false),
      PropSchemas.enum(
        "variant",
        ["default", "outlined", "elevated"],
        false,
        "default"
      ),
      PropSchemas.object("style", false),
    ],
    allowChildren: true,
    category: "display",
    description: "Card container component",
  },

  // Navigation components
  tabs: {
    type: "tabs",
    component: "Tabs",
    props: [
      PropSchemas.array("tabs", false),
      PropSchemas.string("activeTab", false),
      PropSchemas.enum(
        "position",
        ["top", "bottom", "left", "right"],
        false,
        "top"
      ),
    ],
    allowChildren: true,
    category: "navigation",
    description: "Tab navigation component",
  },

  accordion: {
    type: "accordion",
    component: "Accordion",
    props: [
      PropSchemas.array("items", false),
      PropSchemas.boolean("multiple", false, false),
      PropSchemas.string("defaultOpen", false),
    ],
    allowChildren: true,
    category: "navigation",
    description: "Accordion/collapse component",
  },

  modal: {
    type: "modal",
    component: "Modal",
    props: [
      PropSchemas.boolean("open", false, false),
      PropSchemas.string("title", false),
      PropSchemas.enum("size", ["sm", "md", "lg", "xl", "full"], false, "md"),
      PropSchemas.boolean("closable", false, true),
      PropSchemas.boolean("backdrop", false, true),
    ],
    allowChildren: true,
    category: "navigation",
    description: "Modal dialog component",
  },

  dropdown: {
    type: "dropdown",
    component: "Dropdown",
    props: [
      PropSchemas.array("items", false),
      PropSchemas.string("trigger", false),
      PropSchemas.enum(
        "placement",
        ["top", "bottom", "left", "right"],
        false,
        "bottom"
      ),
    ],
    allowChildren: true,
    category: "navigation",
    description: "Dropdown menu component",
  },

  tooltip: {
    type: "tooltip",
    component: "Tooltip",
    props: [
      PropSchemas.string("content", true),
      PropSchemas.enum(
        "placement",
        ["top", "bottom", "left", "right"],
        false,
        "top"
      ),
    ],
    allowChildren: true,
    category: "navigation",
    description: "Tooltip component",
  },

  // Feedback components
  progress: {
    type: "progress",
    component: "Progress",
    props: [
      PropSchemas.number("value", false, 0),
      PropSchemas.number("max", false, 100),
      PropSchemas.boolean("indeterminate", false, false),
      PropSchemas.enum("variant", ["bar", "circular", "spinner"], false, "bar"),
      PropSchemas.string("color", false),
    ],
    allowChildren: false,
    category: "feedback",
    description: "Progress indicator component",
  },

  spinner: {
    type: "spinner",
    component: "Spinner",
    props: [
      PropSchemas.enum("size", ["sm", "md", "lg", "xl"], false, "md"),
      PropSchemas.string("color", false),
    ],
    allowChildren: false,
    category: "feedback",
    description: "Loading spinner component",
  },

  alert: {
    type: "alert",
    component: "Alert",
    props: [
      PropSchemas.enum(
        "variant",
        ["info", "success", "warning", "error"],
        false,
        "info"
      ),
      PropSchemas.string("title", false),
      PropSchemas.string("message", false),
      PropSchemas.boolean("closable", false, false),
      PropSchemas.enum("size", ["sm", "md", "lg"], false, "md"),
    ],
    allowChildren: true,
    category: "feedback",
    description: "Alert/banner component",
  },

  badge: {
    type: "badge",
    component: "Badge",
    props: [
      PropSchemas.string("content", false),
      PropSchemas.enum(
        "variant",
        ["default", "primary", "success", "warning", "danger"],
        false,
        "default"
      ),
      PropSchemas.enum("size", ["sm", "md", "lg"], false, "md"),
      PropSchemas.boolean("dot", false, false),
    ],
    allowChildren: true,
    category: "feedback",
    description: "Badge/count indicator component",
  },

  // Utility components
  divider: {
    type: "divider",
    component: "Divider",
    props: [
      PropSchemas.enum(
        "orientation",
        ["horizontal", "vertical"],
        false,
        "horizontal"
      ),
      PropSchemas.string("label", false),
      PropSchemas.enum(
        "variant",
        ["solid", "dashed", "dotted"],
        false,
        "solid"
      ),
    ],
    allowChildren: false,
    category: "display",
    description: "Divider/separator component",
  },

  spacer: {
    type: "spacer",
    component: "Spacer",
    props: [
      PropSchemas.enum("size", ["xs", "sm", "md", "lg", "xl"], false, "md"),
    ],
    allowChildren: false,
    category: "display",
    description: "Space filler component",
  },

  chart: {
    type: "chart",
    component: "Chart",
    props: [
      PropSchemas.enum(
        "type",
        ["line", "bar", "pie", "area", "scatter"],
        false,
        "line"
      ),
      PropSchemas.array("data", false),
      PropSchemas.object("options", false),
      PropSchemas.enum("size", ["sm", "md", "lg", "xl", "full"], false, "md"),
    ],
    allowChildren: false,
    category: "display",
    description: "Chart visualization component",
  },

  form: {
    type: "form",
    component: "Form",
    props: [
      PropSchemas.string("id", true),
      PropSchemas.object("values", false),
      PropSchemas.object("errors", false),
      PropSchemas.boolean("validateOnChange", false, true),
    ],
    allowChildren: true,
    category: "input",
    description: "Form container component",
  },

  // Custom component placeholder
  custom: {
    type: "custom",
    component: "Custom",
    props: [
      PropSchemas.string("component", true),
      PropSchemas.object("props", false),
    ],
    allowChildren: true,
    category: "custom",
    description: "Custom component wrapper",
  },
};

/**
 * Create a component catalog
 *
 * @param customComponents - Additional custom components
 * @returns Component catalog
 */
export function createComponentCatalog(
  customComponents?: Partial<
    Record<
      string,
      Omit<ComponentCatalogEntry, "security"> & {
        security?: Partial<SecurityPolicy>;
      }
    >
  >
): ComponentCatalog {
  const components = new Map<string, ComponentCatalogEntry>();

  // Add standard components
  for (const [type, entry] of Object.entries(STANDARD_COMPONENTS)) {
    components.set(type, {
      ...entry,
      security: { ...DEFAULT_SECURITY_POLICY, ...entry.security },
    });
  }

  // Add custom components
  if (customComponents) {
    for (const [type, entry] of Object.entries(customComponents)) {
      components.set(type, {
        ...entry,
        security: { ...DEFAULT_SECURITY_POLICY, ...entry.security },
      });
    }
  }

  return {
    version: "0.8",
    components,
    defaultSecurity: DEFAULT_SECURITY_POLICY,
  };
}

/**
 * Get component schema from catalog
 *
 * @param catalog - Component catalog
 * @param type - Component type
 * @returns Component schema or undefined
 */
export function getComponentEntry(
  catalog: ComponentCatalog,
  type: string
): ComponentCatalogEntry | undefined {
  return catalog.components.get(type);
}

/**
 * Check if component type is valid
 *
 * @param catalog - Component catalog
 * @param type - Component type
 * @returns Whether type is valid
 */
export function isComponentTypeValid(
  catalog: ComponentCatalog,
  type: string
): boolean {
  return catalog.components.has(type);
}

/**
 * Get all component types by category
 *
 * @param catalog - Component catalog
 * @param category - Component category
 * @returns Array of component types
 */
export function getComponentsByCategory(
  catalog: ComponentCatalog,
  category: string
): string[] {
  const types: string[] = [];
  for (const [type, entry] of catalog.components) {
    if (entry.category === category) {
      types.push(type);
    }
  }
  return types;
}

/**
 * Extend catalog with custom components
 *
 * @param catalog - Base catalog
 * @param customComponents - Custom components to add
 * @returns Extended catalog
 */
export function extendCatalog(
  catalog: ComponentCatalog,
  customComponents: Record<
    string,
    Omit<ComponentCatalogEntry, "security"> & {
      security?: Partial<SecurityPolicy>;
    }
  >
): ComponentCatalog {
  const newCatalog: ComponentCatalog = {
    ...catalog,
    components: new Map(catalog.components),
  };

  for (const [type, entry] of Object.entries(customComponents)) {
    newCatalog.components.set(type, {
      ...entry,
      security: { ...catalog.defaultSecurity, ...entry.security },
    });
  }

  return newCatalog;
}
