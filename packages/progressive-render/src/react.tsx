/**
 * @lsi/progressive-render - React Integration
 *
 * React components and hooks for progressive rendering
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import * as React from "react";
import type { A2UIComponent } from "@lsi/protocol";

import type {
  ProgressiveChunk,
  RenderPhase,
  RenderStrategy,
  RenderStats,
  RenderError,
  ProgressiveRenderOptions,
  UseProgressiveRenderReturn,
  SkeletonConfig,
  VisualEffect,
} from "./types.js";

import { ProgressiveRenderer } from "./ProgressiveRenderer.js";
import { SSEStreamer } from "./SSEStreamer.js";

// ============================================================================
// PROGRESSIVE COMPONENT
// ============================================================================

/**
 * ProgressiveRender - Component wrapper for progressive rendering
 *
 * Wraps A2UI components for streaming progressive rendering with:
 * - Automatic skeleton/placeholder display
 * - Phase-based rendering (skeleton -> content -> interactive -> complete)
 * - Error boundary integration
 * - Suspense integration
 */
export const ProgressiveRender: React.FC<ProgressiveRenderProps> = ({
  componentId,
  children,
  strategy = "critical-first",
  showSkeleton = true,
  skeletonConfig,
  errorFallback: ErrorFallback,
  loadingIndicator: LoadingIndicator,
  onComplete,
  onError,
  onPhaseChange,
}) => {
  const [phase, setPhase] = React.useState<RenderPhase>("skeleton");
  const [progress, setProgress] = React.useState(0);
  const [stats, setStats] = React.useState<RenderStats | null>(null);
  const [error, setError] = React.useState<RenderError | null>(null);

  // Create renderer instance
  const renderer = React.useMemo(() => new ProgressiveRenderer(), []);

  React.useEffect(() => {
    // Start rendering
    renderer.startStream(componentId, strategy);

    // Register event handlers
    renderer.on("phase:change", (data: any) => {
      setPhase(data.phase);
      onPhaseChange?.(data.phase);
    });

    renderer.on("stream:complete", (data: any) => {
      setStats(data.stats);
      onComplete?.(data.stats);
    });

    renderer.on("stream:error", (data: any) => {
      setError(data.error);
      onError?.(data.error);
    });

    // Cleanup
    return () => {
      renderer.destroy();
    };
  }, [componentId, strategy]);

  // Render based on phase
  if (error && ErrorFallback) {
    return <ErrorFallback error={new Error(error.message)} />;
  }

  if (phase === "skeleton" && showSkeleton) {
    return <Skeleton config={skeletonConfig} />;
  }

  if (phase === "content" && LoadingIndicator) {
    return <LoadingIndicator />;
  }

  return <>{children}</>;
};

// ============================================================================
// USE PROGRESSIVE RENDER HOOK
// ============================================================================

/**
 * useProgressiveRender - Hook for progressive rendering
 *
 * Returns:
 * - phase: Current render phase
 * - progress: Progress percentage (0-100)
 * - stats: Render statistics
 * - loading: Whether currently loading
 * - error: Any render error
 * - start/pause/resume/abort: Control functions
 */
export function useProgressiveRender(
  componentId: string,
  options?: Partial<ProgressiveRenderOptions>
): UseProgressiveRenderReturn {
  const [phase, setPhase] = React.useState<RenderPhase>("skeleton");
  const [progress, setProgress] = React.useState(0);
  const [stats, setStats] = React.useState<RenderStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<RenderError | null>(null);

  const rendererRef = React.useRef<ProgressiveRenderer | null>(null);
  const streamRef = React.useRef<string | null>(null);

  // Initialize renderer
  React.useEffect(() => {
    rendererRef.current = new ProgressiveRenderer();
    return () => {
      rendererRef.current?.destroy();
    };
  }, []);

  // Start rendering
  const start = React.useCallback(() => {
    if (!rendererRef.current) return;

    const strategy = options?.strategy || "critical-first";
    streamRef.current = rendererRef.current.startStream(componentId, strategy);
    setLoading(true);
    setError(null);
  }, [componentId, options?.strategy]);

  // Pause rendering
  const pause = React.useCallback(() => {
    rendererRef.current?.pause();
  }, []);

  // Resume rendering
  const resume = React.useCallback(() => {
    rendererRef.current?.resume();
  }, []);

  // Abort rendering
  const abort = React.useCallback(() => {
    if (streamRef.current) {
      rendererRef.current?.abortStream(componentId);
      streamRef.current = null;
    }
    setLoading(false);
  }, [componentId]);

  // Listen to stats updates
  React.useEffect(() => {
    if (!rendererRef.current) return;

    const updateStats = () => {
      const newStats = rendererRef.current?.getRenderStats(componentId);
      if (newStats) {
        setStats(newStats);
        setProgress(newStats.progress);
        setPhase(newStats.current_phase);
        setLoading(newStats.end_time === null);

        if (newStats.end_time) {
          setLoading(false);
        }
      }
    };

    const interval = setInterval(updateStats, 100);
    return () => clearInterval(interval);
  }, [componentId]);

  return {
    phase,
    progress,
    stats,
    loading,
    error,
    start,
    pause,
    resume,
    abort,
  };
}

// ============================================================================
// USE SSE STREAM HOOK
// ============================================================================

/**
 * useSSEStream - Hook for SSE streaming
 *
 * Connects to SSE endpoint and receives progressive chunks:
 * - Auto-reconnection on disconnect
 * - Event-based updates
 * - Progress tracking
 */
export function useSSEStream(url: string) {
  const [connected, setConnected] = React.useState(false);
  const [chunks, setChunks] = React.useState<ProgressiveChunk[]>([]);
  const [phase, setPhase] = React.useState<RenderPhase>("skeleton");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const streamerRef = React.useRef<SSEStreamer | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  // Connect to SSE stream
  React.useEffect(() => {
    streamerRef.current = new SSEStreamer();
    eventSourceRef.current = streamerRef.current.connect(url);

    // Register event handlers
    streamerRef.current.on("chunk", (_, data) => {
      if (data.type === "chunk") {
        setChunks(prev => [...prev, data.chunk]);
      }
    });

    streamerRef.current.on("phase", (_, data) => {
      if (data.type === "phase") {
        setPhase(data.phase);
      }
    });

    streamerRef.current.on("progress", (_, data) => {
      if (data.type === "progress") {
        setProgress(data.progress);
      }
    });

    streamerRef.current.on("error", (_, data) => {
      if (data.type === "error") {
        setError(data.error.message);
      }
    });

    setConnected(true);

    return () => {
      streamerRef.current?.disconnect();
    };
  }, [url]);

  return {
    connected,
    chunks,
    phase,
    progress,
    error,
  };
}

// ============================================================================
// SUSPENSE INTEGRATION
// ============================================================================

/**
 * ProgressiveSuspense - Suspense boundary for progressive rendering
 *
 * Works with React Suspense for streaming UI:
 * - Shows fallback while content is loading
 * - Handles progressive enhancement
 * - Error boundary integration
 */
export const ProgressiveSuspense: React.FC<ProgressiveSuspenseProps> = ({
  children,
  fallback,
  skeletonConfig,
  errorFallback: ErrorFallback,
}) => {
  return (
    <React.Suspense fallback={fallback || <Skeleton config={skeletonConfig} />}>
      <ProgressiveErrorBoundary fallback={ErrorFallback}>
        {children}
      </ProgressiveErrorBoundary>
    </React.Suspense>
  );
};

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

/**
 * ProgressiveErrorBoundary - Error boundary for progressive rendering
 *
 * Catches and handles rendering errors:
 * - Displays error fallback UI
 * - Logs errors for debugging
 * - Supports error recovery
 */
export class ProgressiveErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Progressive rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return React.createElement(this.props.fallback, {
          error: this.state.error || new Error("Unknown error"),
        });
      }

      return (
        <div className="progressive-error">
          <h3>Something went wrong</h3>
          <p>
            {this.state.error?.message || "An error occurred while rendering"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

/**
 * Skeleton - Loading placeholder component
 *
 * Displays animated skeleton placeholders:
 * - Text lines
 * - Circle avatars
 * - Rectangular blocks
 * - Shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ config }) => {
  const defaultConfig: SkeletonConfig = {
    type: "rect",
    animation: "shimmer",
    width: "100%",
    height: 40,
    className: "",
  };

  const mergedConfig = { ...defaultConfig, ...config };

  const baseClassName =
    `progressive-skeleton progressive-skeleton-${mergedConfig.type} progressive-animation-${mergedConfig.animation} ${mergedConfig.className || ""}`.trim();

  const style: React.CSSProperties = {
    width: mergedConfig.width,
    height: mergedConfig.height,
    borderRadius: mergedConfig.radius,
  };

  if (mergedConfig.type === "text" && mergedConfig.lines) {
    return (
      <div className={baseClassName}>
        {Array.from({ length: mergedConfig.lines }).map((_, i) => (
          <div
            key={i}
            className="progressive-skeleton-line"
            style={{
              width: i === mergedConfig.lines! - 1 ? "60%" : "100%",
              height: mergedConfig.height || 16,
            }}
          />
        ))}
      </div>
    );
  }

  if (mergedConfig.type === "circle") {
    return (
      <div
        className={baseClassName}
        style={{
          ...style,
          borderRadius: "50%",
          width: mergedConfig.width || 40,
          height: mergedConfig.height || mergedConfig.width || 40,
        }}
      />
    );
  }

  return <div className={baseClassName} style={style} />;
};

// ============================================================================
// VISUAL EFFECT COMPONENT
// ============================================================================

/**
 * VisualEffect - Animated visual effects
 *
 * Applies visual effects for progressive enhancement:
 * - Fade in/out
 * - Slide in/out
 * - Scale
 * - Shimmer
 * - Pulse
 */
export const VisualEffectComponent: React.FC<VisualEffectProps> = ({
  children,
  effect,
  delay = 0,
}) => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const effectClassName = `progressive-effect progressive-effect-${effect.type} ${visible ? "progressive-effect-active" : ""}`;

  const style: React.CSSProperties = {
    "--effect-duration": `${effect.duration}ms`,
    "--effect-delay": `${effect.delay}ms`,
    "--effect-easing": effect.easing,
  } as React.CSSProperties;

  return (
    <div className={effectClassName} style={style}>
      {children}
    </div>
  );
};

// ============================================================================
// CHUNK RENDERER
// ============================================================================

/**
 * ChunkRenderer - Renders individual progressive chunks
 *
 * Renders A2UI components from chunks:
 * - Handles chunk phases
 * - Applies visual effects
 * - Updates DOM incrementally
 */
export const ChunkRenderer: React.FC<ChunkRendererProps> = ({
  chunk,
  onComplete,
}) => {
  const [rendered, setRendered] = React.useState(false);

  React.useEffect(() => {
    // Simulate rendering delay for progressive effect
    const timer = setTimeout(() => {
      setRendered(true);
      onComplete?.(chunk);
    }, 50);

    return () => clearTimeout(timer);
  }, [chunk, onComplete]);

  if (chunk.phase === "skeleton") {
    if (chunk.content.type === "skeleton") {
      return <Skeleton config={chunk.content.data} />;
    }
    return <Skeleton />;
  }

  if (chunk.content.type === "component") {
    const component = chunk.content.data;
    return renderA2UIComponent(component);
  }

  if (chunk.content.type === "text") {
    return <span>{chunk.content.data}</span>;
  }

  if (chunk.content.type === "html") {
    return <div dangerouslySetInnerHTML={{ __html: chunk.content.data }} />;
  }

  return null;
};

/**
 * Render A2UI component to React
 */
function renderA2UIComponent(component: A2UIComponent): React.ReactNode {
  const props = {
    ...component.props,
    id: component.id,
    style: component.style,
    className: `a2ui-${component.type}`,
  };

  const children = component.children?.map(child => renderA2UIComponent(child));

  // Map A2UI types to HTML elements
  const typeMap: Record<string, string> = {
    text: "span",
    button: "button",
    input: "input",
    textarea: "textarea",
    select: "select",
    checkbox: "input",
    radio: "input",
    slider: "input",
    switch: "input",
    date: "input",
    image: "img",
    video: "video",
    list: "ul",
    table: "table",
    card: "div",
    tabs: "div",
    accordion: "div",
    modal: "div",
    dropdown: "div",
    container: "div",
    divider: "hr",
    progress: "progress",
    spinner: "div",
  };

  const elementType = typeMap[component.type] || "div";

  if (component.type === "text") {
    return React.createElement(
      elementType,
      props,
      component.props?.text || component.props?.label
    );
  }

  if (component.type === "image") {
    return React.createElement("img", {
      ...props,
      src: component.props?.src,
      alt: component.props?.alt,
    });
  }

  if (component.children && component.children.length > 0) {
    return React.createElement(elementType, props, ...children);
  }

  return React.createElement(elementType, props);
}

// ============================================================================
// PROP TYPES
// ============================================================================

interface ProgressiveRenderProps {
  componentId: string;
  children: React.ReactNode;
  strategy?: RenderStrategy;
  showSkeleton?: boolean;
  skeletonConfig?: SkeletonConfig;
  errorFallback?: React.ComponentType<{ error: Error }>;
  loadingIndicator?: React.ComponentType;
  onComplete?: (stats: RenderStats) => void;
  onError?: (error: RenderError) => void;
  onPhaseChange?: (phase: RenderPhase) => void;
}

interface ProgressiveSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  skeletonConfig?: SkeletonConfig;
  errorFallback?: React.ComponentType<{ error: Error }>;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface SkeletonProps {
  config?: SkeletonConfig;
}

interface VisualEffectProps {
  children: React.ReactNode;
  effect: VisualEffect;
  delay?: number;
}

interface ChunkRendererProps {
  chunk: ProgressiveChunk;
  onComplete?: (chunk: ProgressiveChunk) => void;
}
