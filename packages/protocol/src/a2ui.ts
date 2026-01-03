/**
 * @lsi/protocol - A2UI Protocol Type Definitions
 *
 * A2UI (Agent-to-User Interface) Protocol v0.8
 * Based on Google's open-source protocol for agent-driven UI generation
 *
 * This protocol enables:
 * - Declarative JSON format for safe, LLM-friendly UI generation
 * - Streaming via SSE for progressive rendering
 * - Component catalog with security policies
 * - Intent-aware UI generation
 *
 * @see https://github.com/google/a2ui
 * @version 0.8
 * @license Apache 2.0
 */

// ============================================================================
// CORE A2UI RESPONSE TYPES
// ============================================================================

/**
 * Surface types for where UI can be rendered
 */
export type A2UISurface = "main" | "sidebar" | "modal" | "inline" | "overlay";

/**
 * Main A2UI Response - complete UI specification
 *
 * @example
 * const response: A2UIResponse = {
 *   version: '0.8',
 *   surface: 'main',
 *   components: [
 *     { type: 'button', id: 'submit-btn', props: { label: 'Submit' } }
 *   ]
 * };
 */
export interface A2UIResponse {
  /** Protocol version (must be '0.8') */
  version: string;
  /** Where to render this UI */
  surface: A2UISurface;
  /** Components to render */
  components: A2UIComponent[];
  /** Layout configuration */
  layout?: A2UILayout;
  /** Data bindings for components */
  data?: Record<string, unknown>;
  /** Available actions */
  actions?: A2UIAction[];
  /** Metadata about generation */
  metadata?: A2UIMetadata;
}

// ============================================================================
// COMPONENT TYPES
// ============================================================================

/**
 * Standard component types available in A2UI
 */
export type A2UIComponentType =
  | "container"
  | "text"
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "slider"
  | "switch"
  | "date"
  | "image"
  | "video"
  | "list"
  | "table"
  | "card"
  | "tabs"
  | "accordion"
  | "modal"
  | "dropdown"
  | "tooltip"
  | "progress"
  | "spinner"
  | "alert"
  | "badge"
  | "divider"
  | "spacer"
  | "chart"
  | "form"
  | "custom";

/**
 * Event handler type for component interactions
 */
export type ComponentEventHandler =
  | string
  | ((event: ComponentEvent) => void | Promise<void>);

/**
 * Component event definition
 */
export interface ComponentEvent {
  /** Event name (click, change, submit, etc.) */
  name: string;
  /** Handler function or identifier */
  handler: ComponentEventHandler;
  /** Parameters to pass to handler */
  params?: Record<string, unknown>;
}

/**
 * Component style definition
 */
export interface ComponentStyle {
  /** CSS properties */
  [property: string]: string | number | undefined;
}

/**
 * A2UI Component - single UI element definition
 *
 * @example
 * const button: A2UIComponent = {
 *   type: 'button',
 *   id: 'submit',
 *   props: { label: 'Submit', variant: 'primary' },
 *   events: [{ name: 'click', handler: 'handleSubmit' }]
 * };
 */
export interface A2UIComponent {
  /** Component type (must be in catalog) */
  type: A2UIComponentType | string;
  /** Unique identifier for this component */
  id: string;
  /** Component properties */
  props?: Record<string, unknown>;
  /** Child components (for containers) */
  children?: A2UIComponent[];
  /** Inline styles */
  style?: ComponentStyle;
  /** Event handlers */
  events?: ComponentEvent[];
  /** Accessibility attributes */
  a11y?: A2UIAccessibility;
  /** Whether component is visible */
  visible?: boolean;
  /** Whether component is disabled */
  disabled?: boolean;
}

/**
 * Accessibility attributes for components
 */
export interface A2UIAccessibility {
  /** ARIA label */
  label?: string;
  /** ARIA description */
  description?: string;
  /** ARIA role */
  role?: string;
  /** Accessibility level (AA, AAA) */
  level?: "A" | "AA" | "AAA";
  /** Screen reader text */
  srOnly?: string;
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

/**
 * Layout type for component arrangement
 */
export type A2UILayoutType =
  | "vertical"
  | "horizontal"
  | "grid"
  | "flex"
  | "stack"
  | "absolute";

/**
 * Alignment options
 */
export type A2UIAlignment =
  | "start"
  | "center"
  | "end"
  | "stretch"
  | "baseline"
  | "space-between"
  | "space-around";

/**
 * A2UI Layout - defines component arrangement
 *
 * @example
 * const layout: A2UILayout = {
 *   type: 'flex',
 *   direction: 'row',
 *   spacing: 16,
 *   alignment: 'center',
 *   responsive: {
 *     mobile: { type: 'vertical', spacing: 8 }
 *   }
 * };
 */
export interface A2UILayout {
  /** Layout type */
  type: A2UILayoutType;
  /** Direction (for flex layout) */
  direction?: "row" | "column";
  /** Spacing between items (px) */
  spacing?: number;
  /** Alignment */
  alignment?: A2UIAlignment;
  /** Responsive breakpoints */
  responsive?: ResponsiveBreakpoints;
  /** Padding (px or CSS string) */
  padding?: number | string;
  /** Margin (px or CSS string) */
  margin?: number | string;
  /** Grid columns (for grid layout) */
  columns?: number;
  /** Grid rows (for grid layout) */
  rows?: number;
  /** Gap (for grid layout) */
  gap?: number;
  /** Width constraints */
  width?: string | number;
  /** Height constraints */
  height?: string | number;
  /** Max width */
  maxWidth?: string | number;
  /** Max height */
  maxHeight?: string | number;
}

/**
 * Responsive breakpoint configuration
 */
export interface ResponsiveBreakpoints {
  /** Mobile layout (< 768px) */
  mobile?: A2UILayout;
  /** Tablet layout (768px - 1024px) */
  tablet?: A2UILayout;
  /** Desktop layout (> 1024px) */
  desktop?: A2UILayout;
  /** Wide desktop (> 1440px) */
  wide?: A2UILayout;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * Action types available in A2UI
 */
export type A2UIActionType =
  | "navigate"
  | "submit"
  | "cancel"
  | "delete"
  | "update"
  | "create"
  | "search"
  | "filter"
  | "sort"
  | "export"
  | "import"
  | "refresh"
  | "custom";

/**
 * A2UI Action - user interaction handler
 *
 * @example
 * const action: A2UIAction = {
 *   id: 'submit-form',
 *   type: 'submit',
 *   handler: 'handleSubmit',
 *   params: { formId: 'main-form' },
 *   confirm: true
 * };
 */
export interface A2UIAction {
  /** Unique action identifier */
  id: string;
  /** Action type */
  type: A2UIActionType | string;
  /** Handler function or identifier */
  handler:
    | string
    | ((params?: Record<string, unknown>) => void | Promise<void>);
  /** Parameters to pass to handler */
  params?: Record<string, unknown>;
  /** Whether to confirm before executing */
  confirm?: boolean;
  /** Confirmation message */
  confirmMessage?: string;
  /** Whether action is enabled */
  enabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * A2UI Metadata - generation and tracking information
 */
export interface A2UIMetadata {
  /** Generation timestamp */
  timestamp: Date;
  /** Session identifier */
  sessionId: string;
  /** Agent identifier */
  agentId: string;
  /** Generation time (ms) */
  generationTime: number;
  /** Tokens used for generation */
  tokensUsed?: number;
  /** Model used for generation */
  model?: string;
  /** Confidence in this UI (0-1) */
  confidence?: number;
  /** Intent vector (if applicable) */
  intentVector?: number[];
  /** User preferences applied */
  userPreferences?: string[];
  /** Cache hit */
  fromCache?: boolean;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Streaming update types
 */
export type A2UIUpdateType =
  | "component"
  | "layout"
  | "data"
  | "remove"
  | "done"
  | "error";

/**
 * A2UI Streaming Update - for progressive rendering via SSE
 *
 * @example
 * const update: A2UIUpdate = {
 *   type: 'component',
 *   componentId: 'result-list',
 *   data: { type: 'list', id: 'result-list', items: [...] }
 * };
 */
export interface A2UIUpdate {
  /** Update type */
  type: A2UIUpdateType;
  /** Component ID being updated */
  componentId?: string;
  /** New component or layout data */
  data?: A2UIComponent | A2UILayout | Record<string, unknown>;
  /** IDs of components to remove */
  removalIds?: string[];
  /** Error message (if type is 'error') */
  error?: string;
  /** Update index (for ordering) */
  index?: number;
  /** Total updates (for progress) */
  total?: number;
  /** Done flag (for type 'done') */
  done?: boolean;
}

/**
 * SSE event format for streaming
 */
export interface A2UISSEEvent {
  /** Event type */
  event: "update" | "error" | "done";
  /** Event ID */
  id?: string;
  /** Event data */
  data: A2UIUpdate | string;
  /** Retry delay (ms) */
  retry?: number;
}

// ============================================================================
// COMPONENT CATALOG TYPES
// ============================================================================

/**
 * Prop schema type
 */
export type PropSchemaType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "function"
  | "enum";

/**
 * Component property schema
 */
export interface ComponentPropSchema {
  /** Property name */
  name: string;
  /** Property type */
  type: PropSchemaType;
  /** Whether property is required */
  required: boolean;
  /** Default value */
  default?: unknown;
  /** Validation function */
  validation?: (value: unknown) => boolean | Promise<boolean>;
  /** Sanitization function */
  sanitize?: (value: unknown) => unknown;
  /** Enum values (if type is 'enum') */
  enum?: unknown[];
  /** Property description */
  description?: string;
}

/**
 * Security policy for components
 */
export interface SecurityPolicy {
  /** Maximum nesting depth */
  maxNestingDepth?: number;
  /** Allowed data sources */
  allowedDataSources?: string[];
  /** Whether to sanitize input */
  sanitizeInput?: boolean;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Maximum components allowed */
  maxComponents?: number;
  /** Allowed event handlers */
  allowedHandlers?: string[];
  /** Blocked URLs (for images, etc.) */
  blockedUrls?: string[];
}

/**
 * Component catalog entry
 */
export interface ComponentCatalogEntry {
  /** Component type identifier */
  type: string;
  /** React component name (for renderer) */
  component: string;
  /** Property schema */
  props: ComponentPropSchema[];
  /** Security policy */
  security: SecurityPolicy;
  /** Whether component can have children */
  allowChildren?: boolean;
  /** Allowed child types */
  allowedChildren?: string[];
  /** Component description */
  description?: string;
  /** Component category */
  category?:
    | "layout"
    | "input"
    | "display"
    | "feedback"
    | "navigation"
    | "custom";
}

/**
 * Component catalog - registry of available components
 */
export interface ComponentCatalog {
  /** Catalog version */
  version: string;
  /** Component entries */
  components: Map<string, ComponentCatalogEntry>;
  /** Default security policy */
  defaultSecurity: SecurityPolicy;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Path to error (dot notation) */
  path?: string;
  /** Invalid value */
  value?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Path to warning */
  path?: string;
}

// ============================================================================
// INTENT-TO-UI MAPPING TYPES
// ============================================================================

/**
 * UI requirements derived from intent
 */
export interface UIRequirements {
  /** Required component types */
  components: string[];
  /** Layout configuration */
  layout: A2UILayout;
  /** Data bindings */
  dataBindings: Record<string, string>;
  /** Action requirements */
  actions: ActionRequirement[];
  /** Style requirements */
  style?: StyleRequirement;
  /** Accessibility requirements */
  accessibility?: AccessibilityRequirement;
}

/**
 * Action requirement
 */
export interface ActionRequirement {
  /** Action ID */
  id: string;
  /** Action type */
  type: A2UIActionType;
  /** Handler requirement */
  handler: string;
  /** Required parameters */
  params?: Record<string, unknown>;
}

/**
 * Style requirement
 */
export interface StyleRequirement {
  /** Theme */
  theme?: "light" | "dark" | "auto";
  /** Primary color */
  primaryColor?: string;
  /** Font family */
  fontFamily?: string;
  /** Custom CSS */
  customCSS?: Record<string, string>;
}

/**
 * Accessibility requirement
 */
export interface AccessibilityRequirement {
  /** Minimum level */
  level: "A" | "AA" | "AAA";
  /** Screen reader support */
  screenReader?: boolean;
  /** Keyboard navigation */
  keyboardNav?: boolean;
  /** High contrast mode */
  highContrast?: boolean;
}

// ============================================================================
// FEEDBACK TYPES
// ============================================================================

/**
 * User feedback on UI
 */
export interface UIFeedback {
  /** Session ID */
  sessionId: string;
  /** UI version/ID */
  uiId: string;
  /** Feedback type */
  type: "rating" | "correction" | "preference" | "issue";
  /** Feedback data */
  data: FeedbackData;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Feedback data
 */
export interface FeedbackData {
  /** Rating (1-5) */
  rating?: number;
  /** What user changed */
  corrections?: ComponentCorrection[];
  /** User preferences */
  preferences?: UserPreference[];
  /** Reported issues */
  issues?: IssueReport[];
}

/**
 * Component correction - user modification
 */
export interface ComponentCorrection {
  /** Component ID */
  componentId: string;
  /** What was changed */
  change: "props" | "layout" | "style" | "removed";
  /** New value */
  newValue: unknown;
}

/**
 * User preference
 */
export interface UserPreference {
  /** Preference key */
  key: string;
  /** Preference value */
  value: unknown;
  /** Confidence (0-1) */
  confidence?: number;
}

/**
 * Issue report
 */
export interface IssueReport {
  /** Issue type */
  type: "bug" | "usability" | "accessibility" | "performance";
  /** Issue description */
  description: string;
  /** Severity */
  severity: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Context for UI generation
 */
export interface A2UIContext {
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId: string;
  /** User preferences */
  preferences?: UserPreference[];
  /** Available data sources */
  dataSources?: string[];
  /** Device capabilities */
  device?: DeviceCapabilities;
  /** Application context */
  app?: AppContext;
}

/**
 * Device capabilities
 */
export interface DeviceCapabilities {
  /** Device type */
  type: "mobile" | "tablet" | "desktop";
  /** Screen size */
  screenSize: { width: number; height: number };
  /** Touch support */
  touch: boolean;
  /** High DPI */
  highDPI: boolean;
}

/**
 * Application context
 */
export interface AppContext {
  /** Application ID */
  appId: string;
  /** Current route */
  route?: string;
  /** Application state */
  state?: Record<string, unknown>;
  /** Available actions */
  actions?: string[];
}

// ============================================================================
// AGENT CONFIGURATION TYPES
// ============================================================================

/**
 * A2UI Agent configuration
 */
export interface A2UIAgentConfig {
  /** Agent ID */
  agentId: string;
  /** Model to use for generation */
  model: string;
  /** Component catalog */
  catalog: ComponentCatalog;
  /** Security policy */
  security: SecurityPolicy;
  /** Streaming enabled */
  streaming: boolean;
  /** Cache enabled */
  cache: boolean;
  /** Personalization enabled */
  personalization: boolean;
  /** Maximum components per response */
  maxComponents: number;
  /** Timeout (ms) */
  timeout: number;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate A2UI Response
 *
 * @param response - Response to validate
 * @returns Validation result
 */
export function validateA2UIResponse(response: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!response || typeof response !== "object") {
    errors.push({
      code: "INVALID_TYPE",
      message: "Response must be an object",
      value: response,
    });
    return { valid: false, errors, warnings };
  }

  const r = response as Record<string, unknown>;

  // Validate version
  if (r.version !== "0.8") {
    errors.push({
      code: "INVALID_VERSION",
      message: "Version must be 0.8",
      path: "version",
      value: r.version,
    });
  }

  // Validate surface
  const validSurfaces: A2UISurface[] = [
    "main",
    "sidebar",
    "modal",
    "inline",
    "overlay",
  ];
  if (!r.surface || !validSurfaces.includes(r.surface as A2UISurface)) {
    errors.push({
      code: "INVALID_SURFACE",
      message: `Surface must be one of: ${validSurfaces.join(", ")}`,
      path: "surface",
      value: r.surface,
    });
  }

  // Validate components
  if (!Array.isArray(r.components)) {
    errors.push({
      code: "INVALID_COMPONENTS",
      message: "Components must be an array",
      path: "components",
      value: r.components,
    });
  } else {
    r.components.forEach((component, index) => {
      const compResult = validateA2UIComponent(component);
      if (!compResult.valid) {
        errors.push(
          ...compResult.errors.map(e => ({
            ...e,
            path: `components[${index}]${e.path ? "." + e.path : ""}`,
          }))
        );
      }
      warnings.push(
        ...compResult.warnings.map(w => ({
          ...w,
          path: `components[${index}]${w.path ? "." + w.path : ""}`,
        }))
      );
    });
  }

  // Validate layout if present
  if (r.layout !== undefined) {
    const layoutResult = validateA2UILayout(r.layout);
    if (!layoutResult.valid) {
      errors.push(
        ...layoutResult.errors.map(e => ({
          ...e,
          path: `layout${e.path ? "." + e.path : ""}`,
        }))
      );
    }
  }

  // Validate actions if present
  if (r.actions !== undefined) {
    if (!Array.isArray(r.actions)) {
      errors.push({
        code: "INVALID_ACTIONS",
        message: "Actions must be an array",
        path: "actions",
        value: r.actions,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate A2UI Component
 *
 * @param component - Component to validate
 * @returns Validation result
 */
export function validateA2UIComponent(component: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!component || typeof component !== "object") {
    errors.push({
      code: "INVALID_TYPE",
      message: "Component must be an object",
      value: component,
    });
    return { valid: false, errors, warnings };
  }

  const c = component as Record<string, unknown>;

  // Validate type
  if (!c.type || typeof c.type !== "string") {
    errors.push({
      code: "MISSING_TYPE",
      message: "Component must have a type",
      path: "type",
    });
  }

  // Validate id
  if (!c.id || typeof c.id !== "string") {
    errors.push({
      code: "MISSING_ID",
      message: "Component must have an id",
      path: "id",
    });
  }

  // Validate children if present
  if (c.children !== undefined) {
    if (!Array.isArray(c.children)) {
      errors.push({
        code: "INVALID_CHILDREN",
        message: "Children must be an array",
        path: "children",
      });
    } else {
      c.children.forEach((child, index) => {
        const childResult = validateA2UIComponent(child);
        if (!childResult.valid) {
          errors.push(
            ...childResult.errors.map(e => ({
              ...e,
              path: `children[${index}]${e.path ? "." + e.path : ""}`,
            }))
          );
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate A2UI Layout
 *
 * @param layout - Layout to validate
 * @returns Validation result
 */
export function validateA2UILayout(layout: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!layout || typeof layout !== "object") {
    errors.push({
      code: "INVALID_TYPE",
      message: "Layout must be an object",
      value: layout,
    });
    return { valid: false, errors, warnings };
  }

  const l = layout as Record<string, unknown>;

  const validTypes: A2UILayoutType[] = [
    "vertical",
    "horizontal",
    "grid",
    "flex",
    "stack",
    "absolute",
  ];
  if (!l.type || !validTypes.includes(l.type as A2UILayoutType)) {
    errors.push({
      code: "INVALID_TYPE",
      message: `Layout type must be one of: ${validTypes.join(", ")}`,
      path: "type",
      value: l.type,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize A2UI component props according to schema
 *
 * @param props - Props to sanitize
 * @param schema - Prop schema
 * @returns Sanitized props
 */
export function sanitizeA2UIProps(
  props: Record<string, unknown>,
  schema: ComponentPropSchema[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const propSchema of schema) {
    const value = props[propSchema.name];

    // Skip undefined values
    if (value === undefined) {
      if (propSchema.required) {
        console.warn(`Missing required prop: ${propSchema.name}`);
      }
      if (propSchema.default !== undefined) {
        sanitized[propSchema.name] = propSchema.default;
      }
      continue;
    }

    // Type validation
    let isValid = true;
    switch (propSchema.type) {
      case "string":
        isValid = typeof value === "string";
        break;
      case "number":
        isValid = typeof value === "number";
        break;
      case "boolean":
        isValid = typeof value === "boolean";
        break;
      case "array":
        isValid = Array.isArray(value);
        break;
      case "object":
        isValid =
          typeof value === "object" && value !== null && !Array.isArray(value);
        break;
      case "function":
        isValid = typeof value === "function";
        break;
      case "enum":
        isValid = propSchema.enum?.includes(value) ?? false;
        break;
    }

    if (!isValid) {
      console.warn(
        `Invalid type for prop ${propSchema.name}: expected ${propSchema.type}`
      );
      if (propSchema.default !== undefined) {
        sanitized[propSchema.name] = propSchema.default;
      }
      continue;
    }

    // Custom validation
    if (propSchema.validation) {
      try {
        const valid = propSchema.validation(value);
        if (valid instanceof Promise) {
          // Skip async validation in sanitization
          sanitized[propSchema.name] = value;
        } else if (!valid) {
          console.warn(`Validation failed for prop: ${propSchema.name}`);
          if (propSchema.default !== undefined) {
            sanitized[propSchema.name] = propSchema.default;
          }
          continue;
        }
      } catch (e) {
        console.warn(`Validation error for prop ${propSchema.name}:`, e);
        if (propSchema.default !== undefined) {
          sanitized[propSchema.name] = propSchema.default;
        }
        continue;
      }
    }

    // Sanitization
    if (propSchema.sanitize) {
      try {
        sanitized[propSchema.name] = propSchema.sanitize(value);
      } catch (e) {
        console.warn(`Sanitization error for prop ${propSchema.name}:`, e);
        if (propSchema.default !== undefined) {
          sanitized[propSchema.name] = propSchema.default;
        } else {
          sanitized[propSchema.name] = value;
        }
      }
    } else {
      sanitized[propSchema.name] = value;
    }
  }

  return sanitized;
}

/**
 * Create default security policy
 *
 * @returns Default security policy
 */
export function createDefaultSecurityPolicy(): SecurityPolicy {
  return {
    maxNestingDepth: 10,
    allowedDataSources: ["*"],
    sanitizeInput: true,
    rateLimit: 60,
    maxComponents: 100,
    allowedHandlers: ["*"],
    blockedUrls: [],
  };
}

/**
 * Create component catalog entry
 *
 * @param entry - Entry configuration
 * @returns Component catalog entry
 */
export function createCatalogEntry(
  entry: Omit<ComponentCatalogEntry, "security">
): ComponentCatalogEntry {
  return {
    ...entry,
    security: createDefaultSecurityPolicy(),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if component type is valid
 *
 * @param type - Component type
 * @param catalog - Component catalog
 * @returns Whether type is valid
 */
export function isValidComponentType(
  type: string,
  catalog: ComponentCatalog
): boolean {
  return catalog.components.has(type);
}

/**
 * Get component schema from catalog
 *
 * @param type - Component type
 * @param catalog - Component catalog
 * @returns Component schema or undefined
 */
export function getComponentSchema(
  type: string,
  catalog: ComponentCatalog
): ComponentCatalogEntry | undefined {
  return catalog.components.get(type);
}

/**
 * Format validation errors for display
 *
 * @param result - Validation result
 * @returns Formatted error string
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of result.errors) {
      const path = error.path ? ` at ${error.path}` : "";
      lines.push(`  - [${error.code}] ${error.message}${path}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      const path = warning.path ? ` at ${warning.path}` : "";
      lines.push(`  - [${warning.code}] ${warning.message}${path}`);
    }
  }

  return lines.join("\n");
}
