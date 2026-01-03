/**
 * HeatmapRenderer - Specialized renderer for heatmaps
 */

import type { ChartData, ChartOptions } from "../types.js";

export interface HeatmapData {
  xLabels: string[];
  yLabels: string[];
  data: number[][];
  minValue?: number;
  maxValue?: number;
}

export interface HeatmapConfig {
  data: HeatmapData;
  options: HeatmapOptions;
}

export interface HeatmapOptions extends ChartOptions {
  colorScale: "sequential" | "diverging" | "categorical";
  showLabels: boolean;
  showValues: boolean;
  cellPadding?: number;
  legendPosition?: "top" | "right" | "bottom" | "left";
}

export interface RenderedHeatmap {
  type: "heatmap";
  data: HeatmapData;
  options: HeatmapOptions;
  renderTime: number;
}

export class HeatmapRenderer {
  private defaultColorScales = {
    sequential: [
      "#f7fbff",
      "#deebf7",
      "#c6dbef",
      "#9ecae1",
      "#6baed6",
      "#4292c6",
      "#2171b5",
      "#08519c",
      "#08306b",
    ],
    diverging: [
      "#b2182b",
      "#d6604d",
      "#f4a582",
      "#fddbc7",
      "#f7f7f7",
      "#d1e5f0",
      "#92c5de",
      "#4393c3",
      "#2166ac",
    ],
    categorical: [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
    ],
  };

  /**
   * Render heatmap
   */
  render(config: HeatmapConfig): RenderedHeatmap {
    const startTime = Date.now();

    const { data, options } = config;

    // Calculate min/max if not provided
    const minValue = data.minValue ?? this.calculateMinValue(data.data);
    const maxValue = data.maxValue ?? this.calculateMaxValue(data.data);

    // Generate color for each cell
    const coloredData = this.applyColorScale(
      data.data,
      minValue,
      maxValue,
      options.colorScale
    );

    return {
      type: "heatmap",
      data: {
        ...data,
        minValue,
        maxValue,
      },
      options: {
        ...options,
        colors: this.defaultColorScales[options.colorScale],
      },
      renderTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate minimum value
   */
  private calculateMinValue(data: number[][]): number {
    let min = Infinity;
    for (const row of data) {
      for (const val of row) {
        if (val < min) min = val;
      }
    }
    return min === Infinity ? 0 : min;
  }

  /**
   * Calculate maximum value
   */
  private calculateMaxValue(data: number[][]): number {
    let max = -Infinity;
    for (const row of data) {
      for (const val of row) {
        if (val > max) max = val;
      }
    }
    return max === -Infinity ? 0 : max;
  }

  /**
   * Apply color scale to data
   */
  private applyColorScale(
    data: number[][],
    minValue: number,
    maxValue: number,
    scaleType: string
  ): Array<{ value: number; color: string; x: number; y: number }> {
    const colors =
      this.defaultColorScales[
        scaleType as keyof typeof this.defaultColorScales
      ];
    const result: Array<{
      value: number;
      color: string;
      x: number;
      y: number;
    }> = [];

    const range = maxValue - minValue;

    for (let y = 0; y < data.length; y++) {
      for (let x = 0; x < data[y].length; x++) {
        const value = data[y][x];
        const normalized = range > 0 ? (value - minValue) / range : 0.5;
        const colorIndex = Math.floor(normalized * (colors.length - 1));

        result.push({
          value,
          color: colors[colorIndex],
          x,
          y,
        });
      }
    }

    return result;
  }

  /**
   * Get color for value
   */
  getColorForValue(
    value: number,
    minValue: number,
    maxValue: number,
    scaleType: string
  ): string {
    const colors =
      this.defaultColorScales[
        scaleType as keyof typeof this.defaultColorScales
      ];
    const range = maxValue - minValue;
    const normalized = range > 0 ? (value - minValue) / range : 0.5;
    const colorIndex = Math.floor(normalized * (colors.length - 1));

    return colors[colorIndex];
  }

  /**
   * Generate tooltip data
   */
  getTooltipData(
    x: number,
    y: number,
    data: HeatmapData
  ): {
    xLabel: string;
    yLabel: string;
    value: number;
    color: string;
  } | null {
    if (
      x < 0 ||
      x >= data.xLabels.length ||
      y < 0 ||
      y >= data.yLabels.length
    ) {
      return null;
    }

    const value = data.data[y]?.[x];
    const minValue = data.minValue ?? this.calculateMinValue(data.data);
    const maxValue = data.maxValue ?? this.calculateMaxValue(data.data);

    return {
      xLabel: data.xLabels[x],
      yLabel: data.yLabels[y],
      value,
      color: this.getColorForValue(value, minValue, maxValue, "sequential"),
    };
  }
}
