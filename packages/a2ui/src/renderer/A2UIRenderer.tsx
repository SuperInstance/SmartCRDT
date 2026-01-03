/**
 * A2UI Renderer - React 19 component for rendering A2UI responses
 *
 * Main renderer that takes A2UI protocol responses and renders them
 * using the component catalog. Supports progressive updates and streaming.
 */

import React, { useMemo, useCallback, useOptimistic } from "react";
import type {
  A2UIResponse,
  A2UIComponent,
  A2UILayout,
  A2UIAction,
  A2UIUpdate,
  ComponentCatalog,
  ComponentEventHandler,
} from "@lsi/protocol";
import {
  validateA2UIResponse,
  validateA2UIComponent,
  sanitizeA2UIProps,
  getComponentSchema,
} from "@lsi/protocol";
import { createComponentCatalog } from "./ComponentCatalog.js";
import { DefaultComponents } from "./DefaultComponents.js";

// ============================================================================
// TYPES
// ============================================================================

export interface A2UIRendererProps {
  /** A2UI response to render */
  response: A2UIResponse;
  /** Component catalog (uses default if not provided) */
  catalog?: ComponentCatalog;
  /** Custom component map */
  customComponents?: Record<string, React.ComponentType<any>>;
  /** Action handler */
  onAction?: (action: A2UIAction) => void | Promise<void>;
  /** Update handler for streaming */
  onUpdate?: (update: A2UIUpdate) => void;
  /** Error handler */
  onError?: (error: Error) => void;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Whether to enable debug mode */
  debug?: boolean;
}

interface RenderContext {
  catalog: ComponentCatalog;
  customComponents: Record<string, React.ComponentType<any>>;
  onAction?: (action: A2UIAction) => void | Promise<void>;
  onError?: (error: Error) => void;
  debug?: boolean;
}

// ============================================================================
// LAYOUT RENDERER
// ============================================================================

function applyLayoutStyles(
  children: React.ReactNode,
  layout: A2UILayout
): React.ReactNode {
  const style: React.CSSProperties = {};

  switch (layout.type) {
    case "vertical":
      style.display = "flex";
      style.flexDirection = "column";
      style.gap = layout.spacing;
      style.alignItems = layout.alignment === "center" ? "center" : undefined;
      break;
    case "horizontal":
      style.display = "flex";
      style.flexDirection = "row";
      style.gap = layout.spacing;
      style.alignItems = layout.alignment === "center" ? "center" : undefined;
      break;
    case "flex":
      style.display = "flex";
      style.flexDirection = layout.direction === "row" ? "row" : "column";
      style.gap = layout.spacing;
      style.alignItems = layout.alignment;
      break;
    case "grid":
      style.display = "grid";
      style.gridTemplateColumns = `repeat(${layout.columns || "auto"}, 1fr)`;
      style.gridTemplateRows = `repeat(${layout.rows || "auto"}, 1fr)`;
      style.gap = layout.gap || layout.spacing;
      break;
    case "stack":
      style.position = "relative";
      break;
    case "absolute":
      style.position = "absolute";
      break;
  }

  if (layout.padding) {
    style.padding =
      typeof layout.padding === "number"
        ? `${layout.padding}px`
        : layout.padding;
  }

  if (layout.margin) {
    style.margin =
      typeof layout.margin === "number" ? `${layout.margin}px` : layout.margin;
  }

  if (layout.width) {
    style.width =
      typeof layout.width === "number" ? `${layout.width}px` : layout.width;
  }

  if (layout.height) {
    style.height =
      typeof layout.height === "number" ? `${layout.height}px` : layout.height;
  }

  if (layout.maxWidth) {
    style.maxWidth =
      typeof layout.maxWidth === "number"
        ? `${layout.maxWidth}px`
        : layout.maxWidth;
  }

  if (layout.maxHeight) {
    style.maxHeight =
      typeof layout.maxHeight === "number"
        ? `${layout.maxHeight}px`
        : layout.maxHeight;
  }

  return <div style={style}>{children}</div>;
}

// ============================================================================
// COMPONENT RENDERER
// ============================================================================

function renderComponent(
  component: A2UIComponent,
  context: RenderContext,
  key?: string
): React.ReactNode {
  const { catalog, customComponents, onAction, onError, debug } = context;

  // Validate component
  const validation = validateA2UIComponent(component);
  if (!validation.valid) {
    if (debug) {
      console.warn("Invalid component:", component, validation.errors);
    }
    if (onError) {
      onError(
        new Error(
          `Invalid component: ${validation.errors.map(e => e.message).join(", ")}`
        )
      );
    }
    return null;
  }

  // Skip if not visible
  if (component.visible === false) {
    return null;
  }

  // Get component schema
  const schema = getComponentSchema(component.type, catalog);
  if (!schema && !customComponents[component.type]) {
    if (debug) {
      console.warn(`Unknown component type: ${component.type}`);
    }
    return null;
  }

  // Sanitize props
  const sanitizedProps = schema
    ? sanitizeA2UIProps(component.props || {}, schema.props)
    : component.props || {};

  // Apply disabled state
  if (component.disabled) {
    sanitizedProps.disabled = true;
  }

  // Convert style to CSS
  const style: React.CSSProperties = {};
  if (component.style) {
    Object.assign(style, component.style);
  }

  // Handle events
  const eventHandlers: Record<string, (e?: any) => void> = {};
  if (component.events) {
    for (const event of component.events) {
      eventHandlers[event.name] = (e?: any) => {
        if (typeof event.handler === "string") {
          if (onAction) {
            onAction({
              id: `${component.id}-${event.name}`,
              type: event.name as any,
              handler: event.handler,
              params: event.params,
            });
          }
        } else if (typeof event.handler === "function") {
          event.handler({ name: event.name, ...e });
        }
      };
    }
  }

  // Get React component
  let Component: React.ComponentType<any>;
  if (customComponents[component.type]) {
    Component = customComponents[component.type];
  } else if (
    DefaultComponents[schema!.component as keyof typeof DefaultComponents]
  ) {
    Component = DefaultComponents[
      schema!.component as keyof typeof DefaultComponents
    ] as React.ComponentType<any>;
  } else {
    // Fallback to div
    Component = "div" as any;
  }

  // Render children
  const children = component.children?.map((child, index) =>
    renderComponent(child, context, `${key}-${component.id}-${index}`)
  );

  // Render component
  const props = {
    id: component.id,
    key,
    ...sanitizedProps,
    ...eventHandlers,
    style,
    a11y: component.a11y,
    children,
  };

  return React.createElement(Component, props);
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

export const A2UIRenderer: React.FC<A2UIRendererProps> = React.memo(
  ({
    response,
    catalog: customCatalog,
    customComponents = {},
    onAction,
    onUpdate,
    onError,
    className,
    style,
    debug = false,
  }) => {
    // Create or use catalog
    const catalog = useMemo(() => {
      return customCatalog || createComponentCatalog();
    }, [customCatalog]);

    // Validate response
    const validation = useMemo(() => {
      return validateA2UIResponse(response);
    }, [response]);

    // Handle validation errors
    if (!validation.valid) {
      if (debug) {
        console.error("Invalid A2UI response:", response, validation.errors);
      }
      if (onError) {
        onError(
          new Error(
            `Invalid A2UI response: ${validation.errors.map(e => e.message).join(", ")}`
          )
        );
      }
      return (
        <div
          style={{
            padding: 16,
            border: "1px solid #ef4444",
            borderRadius: 4,
            color: "#ef4444",
          }}
        >
          <strong>Invalid A2UI Response</strong>
          <ul>
            {validation.errors.map((error, index) => (
              <li key={index}>
                {error.message} {error.path && `(${error.path})`}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Create render context
    const context: RenderContext = useMemo(
      () => ({
        catalog,
        customComponents,
        onAction,
        onError,
        debug,
      }),
      [catalog, customComponents, onAction, onError, debug]
    );

    // Render components
    const renderedComponents = useMemo(() => {
      return response.components.map((component, index) =>
        renderComponent(
          component,
          context,
          `${response.metadata?.sessionId || "a2ui"}-${index}`
        )
      );
    }, [response.components, context, response.metadata?.sessionId]);

    // Apply layout if present
    const content = response.layout
      ? applyLayoutStyles(renderedComponents, response.layout)
      : renderedComponents;

    // Render container
    const containerStyle: React.CSSProperties = {
      ...style,
      // Add accessibility attributes
      ...(response.metadata?.agentId && {
        "data-agent-id": response.metadata.agentId,
      }),
      ...(response.metadata?.sessionId && {
        "data-session-id": response.metadata.sessionId,
      }),
    };

    return (
      <div
        className={`a2ui-surface-${response.surface} ${className || ""}`}
        style={containerStyle}
        data-a2ui-version={response.version}
      >
        {content}
      </div>
    );
  }
);

A2UIRenderer.displayName = "A2UIRenderer";

// ============================================================================
// STREAMING RENDERER
// ============================================================================

export interface A2UIStreamingRendererProps extends Omit<
  A2UIRendererProps,
  "response"
> {
  /** Initial response */
  initialResponse: A2UIResponse;
  /** Whether to enable streaming */
  streaming?: boolean;
}

export const A2UIStreamingRenderer: React.FC<A2UIStreamingRendererProps> = ({
  initialResponse,
  catalog,
  customComponents,
  onAction,
  onError,
  className,
  style,
  debug = false,
  streaming = true,
}) => {
  // Use optimistic updates for streaming
  const [optimisticResponse, addUpdate] = useOptimistic(
    initialResponse,
    (state, update: A2UIUpdate) => {
      if (!streaming) return state;

      switch (update.type) {
        case "component":
          if (
            update.data &&
            typeof update.data === "object" &&
            "type" in update.data
          ) {
            return {
              ...state,
              components: [...state.components, update.data as A2UIComponent],
            };
          }
          return state;

        case "remove":
          if (update.removalIds) {
            const removalSet = new Set(update.removalIds);
            return {
              ...state,
              components: state.components.filter(c => !removalSet.has(c.id)),
            };
          }
          return state;

        case "layout":
          // Layout updates would be more complex
          return state;

        case "data":
          // Data updates would be applied to component props
          return state;

        default:
          return state;
      }
    }
  );

  return (
    <A2UIRenderer
      response={optimisticResponse}
      catalog={catalog}
      customComponents={customComponents}
      onAction={onAction}
      onError={onError}
      className={className}
      style={style}
      debug={debug}
    />
  );
};

A2UIStreamingRenderer.displayName = "A2UIStreamingRenderer";

// ============================================================================
// HOOKS
// ============================================================================()

export interface UseA2UIRenderOptions {
  catalog?: ComponentCatalog;
  customComponents?: Record<string, React.ComponentType<any>>;
  onAction?: (action: A2UIAction) => void | Promise<void>;
  onError?: (error: Error) => void;
  debug?: boolean;
}

export function useA2UIRender(options: UseA2UIRenderOptions = {}) {
  const { catalog, customComponents, onAction, onError, debug } = options;

  const render = useCallback(
    (response: A2UIResponse) => {
      return (
        <A2UIRenderer
          response={response}
          catalog={catalog}
          customComponents={customComponents}
          onAction={onAction}
          onError={onError}
          debug={debug}
        />
      );
    },
    [catalog, customComponents, onAction, onError, debug]
  );

  return { render };
}

/**
 * Hook for streaming A2UI updates
 */
export function useA2UIStreaming(
  initialResponse: A2UIResponse,
  options: UseA2UIRenderOptions = {}
) {
  const { catalog, customComponents, onAction, onError, debug } = options;

  const [response, setResponse] = React.useState<A2UIResponse>(initialResponse);

  const applyUpdate = useCallback((update: A2UIUpdate) => {
    setResponse(prev => {
      switch (update.type) {
        case "component":
          if (
            update.data &&
            typeof update.data === "object" &&
            "type" in update.data
          ) {
            return {
              ...prev,
              components: [...prev.components, update.data as A2UIComponent],
            };
          }
          return prev;

        case "remove":
          if (update.removalIds) {
            const removalSet = new Set(update.removalIds);
            return {
              ...prev,
              components: prev.components.filter(c => !removalSet.has(c.id)),
            };
          }
          return prev;

        default:
          return prev;
      }
    });
  }, []);

  const reset = useCallback(() => {
    setResponse(initialResponse);
  }, [initialResponse]);

  const render = useCallback(() => {
    return (
      <A2UIRenderer
        response={response}
        catalog={catalog}
        customComponents={customComponents}
        onAction={onAction}
        onError={onError}
        debug={debug}
      />
    );
  }, [response, catalog, customComponents, onAction, onError, debug]);

  return { response, applyUpdate, reset, render };
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================()

interface A2UIErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface A2UIErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class A2UIErrorBoundary extends React.Component<
  A2UIErrorBoundaryProps,
  A2UIErrorBoundaryState
> {
  constructor(props: A2UIErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): A2UIErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("A2UI Error Boundary caught:", error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return <Fallback error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "#fef2f2",
        border: "1px solid #ef4444",
        borderRadius: 8,
        color: "#b91c1c",
      }}
    >
      <h3>A2UI Rendering Error</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { createComponentCatalog } from "./ComponentCatalog.js";
export { DefaultComponents } from "./DefaultComponents.js";
export type { RenderContext };
