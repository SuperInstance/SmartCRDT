/**
 * FunnelRenderer - Specialized renderer for conversion funnels
 */

import type { FunnelMetrics, FunnelStep } from "../types.js";

export interface FunnelConfig {
  data: FunnelMetrics;
  options: FunnelOptions;
}

export interface FunnelOptions {
  orientation: "horizontal" | "vertical";
  showLabels: boolean;
  showPercentages: boolean;
  showValues: boolean;
  showDropoff: boolean;
  animated: boolean;
  colorScale: string[];
}

export interface RenderedFunnel {
  type: "funnel";
  data: FunnelMetrics;
  options: FunnelOptions;
  steps: Array<{
    name: string;
    count: number;
    percentage: number;
    dropoff: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  conversionPath: Array<{ x: number; y: number }>;
  renderTime: number;
}

export class FunnelRenderer {
  private defaultColors = [
    "#1f77b4",
    "#4292c6",
    "#6baed6",
    "#9ecae1",
    "#c6dbef",
  ];

  /**
   * Render funnel
   */
  render(config: FunnelConfig): RenderedFunnel {
    const startTime = Date.now();

    const { data, options } = config;

    // Calculate step positions
    const steps = this.calculateStepPositions(data.steps, options);

    // Calculate conversion path
    const conversionPath = this.calculateConversionPath(steps, options);

    return {
      type: "funnel",
      data,
      options,
      steps,
      conversionPath,
      renderTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate step positions
   */
  private calculateStepPositions(
    steps: FunnelStep[],
    options: FunnelOptions
  ): Array<{
    name: string;
    count: number;
    percentage: number;
    dropoff: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }> {
    const isVertical = options.orientation === "vertical";
    const totalWidth = 800;
    const totalHeight = 500;

    const maxCount = steps[0]?.count || 1;
    const stepSpacing = isVertical
      ? totalHeight / steps.length
      : totalWidth / steps.length;
    const funnelHeight = isVertical ? 400 : 300;

    return steps.map((step, index) => {
      const widthRatio = step.count / maxCount;
      const stepWidth = isVertical
        ? widthRatio * totalWidth
        : stepSpacing * 0.8;
      const stepHeight = isVertical
        ? stepSpacing * 0.8
        : widthRatio * funnelHeight;

      const x = isVertical
        ? (totalWidth - stepWidth) / 2
        : index * stepSpacing + stepSpacing * 0.1;

      const y = isVertical
        ? index * stepSpacing + stepSpacing * 0.1
        : (totalHeight - stepHeight) / 2;

      return {
        name: step.name,
        count: step.count,
        percentage: step.percentage,
        dropoff: step.dropoff,
        x,
        y,
        width: stepWidth,
        height: stepHeight,
        color: this.defaultColors[index % this.defaultColors.length],
      };
    });
  }

  /**
   * Calculate conversion path
   */
  private calculateConversionPath(
    steps: Array<{ x: number; y: number; width: number; height: number }>,
    options: FunnelOptions
  ): Array<{ x: number; y: number }> {
    if (steps.length < 2) return [];

    const path: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < steps.length - 1; i++) {
      const current = steps[i];
      const next = steps[i + 1];

      if (options.orientation === "vertical") {
        // Vertical path
        path.push({
          x: current.x + current.width / 2,
          y: current.y + current.height,
        });
        path.push({ x: next.x + next.width / 2, y: next.y });
      } else {
        // Horizontal path
        path.push({
          x: current.x + current.width,
          y: current.y + current.height / 2,
        });
        path.push({ x: next.x, y: next.y + next.height / 2 });
      }
    }

    return path;
  }

  /**
   * Get dropoff segments
   */
  getDropoffSegments(data: FunnelMetrics): Array<{
    from: string;
    to: string;
    dropoff: number;
    dropoffRate: number;
  }> {
    const segments = [];

    for (let i = 0; i < data.steps.length - 1; i++) {
      const from = data.steps[i];
      const to = data.steps[i + 1];

      segments.push({
        from: from.name,
        to: to.name,
        dropoff: from.count - to.count,
        dropoffRate:
          from.count > 0 ? ((from.count - to.count) / from.count) * 100 : 0,
      });
    }

    return segments;
  }

  /**
   * Get bottleneck step
   */
  getBottleneck(data: FunnelMetrics): {
    step: FunnelStep;
    reason: string;
  } | null {
    if (data.steps.length < 2) return null;

    let maxDropoffRate = 0;
    let bottleneckIndex = 0;

    for (let i = 0; i < data.steps.length - 1; i++) {
      const dropoffRate =
        data.steps[i].count > 0
          ? ((data.steps[i].count - data.steps[i + 1].count) /
              data.steps[i].count) *
            100
          : 0;

      if (dropoffRate > maxDropoffRate) {
        maxDropoffRate = dropoffRate;
        bottleneckIndex = i;
      }
    }

    if (maxDropoffRate < 20) return null; // Less than 20% dropoff is not a bottleneck

    return {
      step: data.steps[bottleneckIndex],
      reason: `Highest dropoff rate: ${maxDropoffRate.toFixed(1)}%`,
    };
  }

  /**
   * Calculate funnel improvement suggestions
   */
  getImprovementSuggestions(data: FunnelMetrics): string[] {
    const suggestions = [];
    const bottleneck = this.getBottleneck(data);

    if (bottleneck) {
      suggestions.push(
        `Focus optimization on "${bottleneck.step.name}" - ${bottleneck.reason}`
      );
      suggestions.push("Consider A/B testing variations at this step");
      suggestions.push(
        "Analyze user behavior at this step for friction points"
      );
    }

    if (data.completionRate < 50) {
      suggestions.push(
        "Overall completion rate is low - consider simplifying the funnel"
      );
      suggestions.push("Reduce number of steps or make each step clearer");
    }

    const avgDropoff = data.averageDropoffRate;
    if (avgDropoff > 30) {
      suggestions.push("High average dropoff rate - review entire user flow");
      suggestions.push("Consider offering progress indicators");
      suggestions.push("Add reassurance messages at key steps");
    }

    return suggestions;
  }

  /**
   * Calculate projected improvement
   */
  calculateProjectedImprovement(
    data: FunnelMetrics,
    stepIndex: number,
    improvementPercent: number
  ): {
    originalCompletions: number;
    projectedCompletions: number;
    uplift: number;
  } {
    const step = data.steps[stepIndex];
    if (!step || stepIndex === data.steps.length - 1) {
      return {
        originalCompletions: data.steps[data.steps.length - 1]?.count || 0,
        projectedCompletions: data.steps[data.steps.length - 1]?.count || 0,
        uplift: 0,
      };
    }

    const originalCompletions = data.steps[data.steps.length - 1]?.count || 0;
    const projectedStepCount = step.count * (1 + improvementPercent / 100);

    // Assume same percentage carries through rest of funnel
    const remainingRate = data.steps[data.steps.length - 1]!.count / step.count;
    const projectedCompletions = projectedStepCount * remainingRate;

    return {
      originalCompletions,
      projectedCompletions,
      uplift:
        originalCompletions > 0
          ? ((projectedCompletions - originalCompletions) /
              originalCompletions) *
            100
          : 0,
    };
  }
}
