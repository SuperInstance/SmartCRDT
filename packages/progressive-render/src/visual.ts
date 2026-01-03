/**
 * @lsi/progressive-render - Visual Feedback
 *
 * Visual effects and feedback for progressive rendering
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type {
  VisualEffect,
  VisualEffectType,
  VisualFeedbackState,
  SkeletonConfig,
  RenderPhase,
} from "./types.js";

// ============================================================================
// VISUAL FEEDBACK MANAGER
// ============================================================================

/**
 * VisualFeedbackManager - Manages visual feedback during rendering
 *
 * Handles:
 * - Skeleton screens
 * - Loading indicators
 * - Shimmer effects
 * - Progressive enhancement
 * - Fade-in animations
 */
export class VisualFeedbackManager {
  private activeEffects: Map<string, VisualFeedbackState> = new Map();
  private effectQueue: Map<string, VisualEffect[]> = new Map();

  // ========================================================================
  // SKELETON SCREENS
  // ========================================================================

  /**
   * Create skeleton configuration for component type
   *
   * @param componentType - Component type
   * @param options - Additional options
   * @returns Skeleton configuration
   */
  createSkeletonConfig(
    componentType: string,
    options?: Partial<SkeletonConfig>
  ): SkeletonConfig {
    const baseConfig: SkeletonConfig = {
      type: "rect",
      animation: "shimmer",
      className: `skeleton-${componentType}`,
    };

    switch (componentType) {
      case "text":
        return {
          ...baseConfig,
          type: "text",
          lines: options?.lines || 3,
          height: options?.height || 16,
        };

      case "heading":
        return {
          ...baseConfig,
          type: "rect",
          width: options?.width || "60%",
          height: options?.height || 32,
          radius: 4,
        };

      case "button":
        return {
          ...baseConfig,
          type: "rect",
          width: options?.width || 120,
          height: options?.height || 40,
          radius: options?.radius || 4,
        };

      case "input":
        return {
          ...baseConfig,
          type: "rect",
          width: "100%",
          height: options?.height || 40,
          radius: options?.radius || 4,
        };

      case "textarea":
        return {
          ...baseConfig,
          type: "rect",
          width: "100%",
          height: options?.height || 120,
          radius: options?.radius || 4,
        };

      case "avatar":
      case "circle":
        return {
          ...baseConfig,
          type: "circle",
          width: options?.width || 40,
          height: options?.height || options?.width || 40,
        };

      case "image":
        return {
          ...baseConfig,
          type: "rect",
          width: options?.width || 200,
          height: options?.height || 200,
          radius: options?.radius || 4,
        };

      case "card":
        return {
          ...baseConfig,
          type: "rect",
          width: "100%",
          height: options?.height || 200,
          radius: options?.radius || 8,
        };

      case "list":
        return {
          ...baseConfig,
          type: "custom",
          className: "skeleton-list",
          lines: options?.lines || 5,
        };

      case "table":
        return {
          ...baseConfig,
          type: "custom",
          className: "skeleton-table",
          lines: options?.lines || 10,
        };

      default:
        return {
          ...baseConfig,
          width: options?.width || "100%",
          height: options?.height || 40,
          radius: options?.radius || 4,
        };
    }
  }

  /**
   * Generate CSS for skeleton
   *
   * @param config - Skeleton configuration
   * @returns CSS string
   */
  generateSkeletonCSS(config: SkeletonConfig): string {
    const animations = this.getSkeletonAnimations();
    let css = `
      .${config.className || "skeleton"} {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        border-radius: ${config.radius || 4}px;
        ${config.width ? `width: ${typeof config.width === "number" ? `${config.width}px` : config.width};` : ""}
        ${config.height ? `height: ${typeof config.height === "number" ? `${config.height}px` : config.height};` : ""}
      }
    `;

    // Add animation
    if (config.animation && config.animation !== "none") {
      css += `
        .${config.className || "skeleton"} {
          animation: skeleton-${config.animation} 1.5s infinite;
        }
      `;
    }

    return css + animations;
  }

  /**
   * Get skeleton animation CSS
   *
   * @returns CSS animations string
   */
  private getSkeletonAnimations(): string {
    return `
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      @keyframes skeleton-wave {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      @keyframes skeleton-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      .progressive-skeleton {
        display: inline-block;
      }

      .progressive-skeleton-text {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .progressive-skeleton-line {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        border-radius: 4px;
      }

      .progressive-skeleton-circle {
        border-radius: 50%;
      }
    `;
  }

  // ========================================================================
  // VISUAL EFFECTS
  // ========================================================================

  /**
   * Create visual effect
   *
   * @param type - Effect type
   * @param options - Effect options
   * @returns Visual effect configuration
   */
  createEffect(
    type: VisualEffectType,
    options?: Partial<VisualEffect>
  ): VisualEffect {
    return {
      type,
      duration: options?.duration || 300,
      delay: options?.delay || 0,
      easing: options?.easing || "ease-in-out",
      className: options?.className,
    };
  }

  /**
   * Get CSS for visual effect
   *
   * @param effect - Visual effect
   * @returns CSS string
   */
  generateEffectCSS(effect: VisualEffect): string {
    const className = effect.className || `effect-${effect.type}`;
    let css = "";

    switch (effect.type) {
      case "fade-in":
        css = `
          .${className} {
            opacity: 0;
            transition: opacity ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          .${className}.progressive-effect-active {
            opacity: 1;
          }
        `;
        break;

      case "fade-out":
        css = `
          .${className} {
            opacity: 1;
            transition: opacity ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          .${className}.progressive-effect-active {
            opacity: 0;
          }
        `;
        break;

      case "slide-in":
        css = `
          .${className} {
            transform: translateY(-20px);
            opacity: 0;
            transition: transform ${effect.duration}ms ${effect.easing} ${effect.delay}ms,
                        opacity ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          .${className}.progressive-effect-active {
            transform: translateY(0);
            opacity: 1;
          }
        `;
        break;

      case "slide-out":
        css = `
          .${className} {
            transform: translateY(0);
            opacity: 1;
            transition: transform ${effect.duration}ms ${effect.easing} ${effect.delay}ms,
                        opacity ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          .${className}.progressive-effect-active {
            transform: translateY(-20px);
            opacity: 0;
          }
        `;
        break;

      case "scale":
        css = `
          .${className} {
            transform: scale(0.9);
            opacity: 0;
            transition: transform ${effect.duration}ms ${effect.easing} ${effect.delay}ms,
                        opacity ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          .${className}.progressive-effect-active {
            transform: scale(1);
            opacity: 1;
          }
        `;
        break;

      case "shimmer":
        css = `
          .${className} {
            position: relative;
            overflow: hidden;
          }

          .${className}::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer ${effect.duration}ms ${effect.easing} ${effect.delay}ms;
          }

          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `;
        break;

      case "pulse":
        css = `
          .${className} {
            animation: pulse ${effect.duration}ms ${effect.easing} ${effect.delay}ms infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `;
        break;

      case "spin":
        css = `
          .${className} {
            animation: spin ${effect.duration}ms linear ${effect.delay}ms infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        break;
    }

    return css;
  }

  /**
   * Get all visual effect CSS
   *
   * @returns Combined CSS string
   */
  getAllEffectCSS(): string {
    const effectTypes: VisualEffectType[] = [
      "fade-in",
      "fade-out",
      "slide-in",
      "slide-out",
      "scale",
      "shimmer",
      "pulse",
      "spin",
    ];
    return effectTypes
      .map(type => this.generateEffectCSS(this.createEffect(type)))
      .join("\n\n");
  }

  // ========================================================================
  // PHASE-BASED FEEDBACK
  // ========================================================================

  /**
   * Get visual feedback for render phase
   *
   * @param phase - Current render phase
   * @returns Visual effect
   */
  getPhaseFeedback(phase: RenderPhase): VisualEffect {
    switch (phase) {
      case "skeleton":
        return this.createEffect("fade-in", { duration: 200 });
      case "content":
        return this.createEffect("fade-in", { duration: 300, delay: 100 });
      case "interactive":
        return this.createEffect("scale", { duration: 200 });
      case "complete":
        return this.createEffect("shimmer", { duration: 500 });
      default:
        return this.createEffect("fade-in", { duration: 300 });
    }
  }

  // ========================================================================
  // LOADING INDICATORS
  // ========================================================================

  /**
   * Generate loading indicator HTML
   *
   * @param type - Loading indicator type
   * @param size - Size of indicator
   * @returns HTML string
   */
  generateLoadingIndicator(
    type: "spinner" | "dots" | "bar" = "spinner",
    size: "small" | "medium" | "large" = "medium"
  ): string {
    const sizeMap = {
      small: 16,
      medium: 24,
      large: 32,
    };

    const sizePx = sizeMap[size];

    switch (type) {
      case "spinner":
        return `
          <div class="progressive-loading-spinner" style="width: ${sizePx * 2}px; height: ${sizePx * 2}px;">
            <svg viewBox="0 0 50 50" class="progressive-spinner-svg">
              <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4">
                <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
        `;

      case "dots":
        return `
          <div class="progressive-loading-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        `;

      case "bar":
        return `
          <div class="progressive-loading-bar">
            <div class="progressive-loading-bar-fill"></div>
          </div>
        `;
    }
  }

  /**
   * Get loading indicator CSS
   *
   * @returns CSS string
   */
  getLoadingIndicatorCSS(): string {
    return `
      .progressive-loading-spinner {
        display: inline-block;
      }

      .progressive-spinner-svg circle {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: 0;
        stroke-linecap: round;
        animation: progressive-spinner-dash 1.5s ease-in-out infinite;
      }

      @keyframes progressive-spinner-dash {
        0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
        100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
      }

      .progressive-loading-dots {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }

      .progressive-loading-dots .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        animation: progressive-dot-bounce 1.4s ease-in-out infinite both;
      }

      .progressive-loading-dots .dot:nth-child(1) { animation-delay: -0.32s; }
      .progressive-loading-dots .dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes progressive-dot-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      .progressive-loading-bar {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
      }

      .progressive-loading-bar-fill {
        height: 100%;
        background: currentColor;
        animation: progressive-bar-slide 1.5s ease-in-out infinite;
      }

      @keyframes progressive-bar-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
  }

  // ========================================================================
  // PROGRESSIVE ENHANCEMENT
  // ========================================================================

  /**
   * Apply progressive enhancement to element
   *
   * @param element - DOM element
   * @param phase - Current phase
   */
  applyProgressiveEnhancement(element: HTMLElement, phase: RenderPhase): void {
    // Add phase class
    element.classList.add(`progressive-phase-${phase}`);

    // Remove previous phase classes
    const phases: RenderPhase[] = [
      "skeleton",
      "content",
      "interactive",
      "complete",
    ];
    for (const p of phases) {
      if (p !== phase) {
        element.classList.remove(`progressive-phase-${p}`);
      }
    }

    // Apply visual effect
    const effect = this.getPhaseFeedback(phase);
    element.style.transition = `all ${effect.duration}ms ${effect.easing}`;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get complete CSS bundle
   *
   * @returns All CSS for visual feedback
   */
  getCompleteCSS(): string {
    return `
      /* Skeleton Animations */
      ${this.getSkeletonAnimations()}

      /* Visual Effects */
      ${this.getAllEffectCSS()}

      /* Loading Indicators */
      ${this.getLoadingIndicatorCSS()}

      /* Progressive Enhancement */
      .progressive-phase-skeleton {
        opacity: 0.7;
      }

      .progressive-phase-content {
        opacity: 0.9;
      }

      .progressive-phase-interactive {
        opacity: 1;
      }

      .progressive-phase-complete {
        opacity: 1;
      }
    `;
  }

  /**
   * Clear all active effects
   */
  clearEffects(): void {
    this.activeEffects.clear();
    this.effectQueue.clear();
  }

  /**
   * Get active effect for element
   *
   * @param elementId - Element identifier
   * @returns Active effect or null
   */
  getActiveEffect(elementId: string): VisualFeedbackState | null {
    return this.activeEffects.get(elementId) || null;
  }
}
