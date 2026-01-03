/**
 * ChartRenderer - Renders various chart types for analytics data
 */

import type {
  ChartConfig,
  ChartType,
  ChartData,
  ChartOptions,
  RenderedChart,
} from "../types.js";

export class ChartRenderer {
  private renderCache: Map<string, RenderedChart> = new Map();

  /**
   * Render a chart
   */
  render(config: ChartConfig): RenderedChart {
    const startTime = Date.now();

    let rendered: RenderedChart;

    switch (config.type) {
      case "line":
        rendered = this.renderLineChart(config);
        break;
      case "bar":
        rendered = this.renderBarChart(config);
        break;
      case "pie":
        rendered = this.renderPieChart(config);
        break;
      case "heatmap":
        rendered = this.renderHeatmap(config);
        break;
      case "funnel":
        rendered = this.renderFunnel(config);
        break;
      case "sankey":
        rendered = this.renderSankey(config);
        break;
      case "scatter":
        rendered = this.renderScatter(config);
        break;
      case "area":
        rendered = this.renderAreaChart(config);
        break;
      default:
        throw new Error(`Unsupported chart type: ${config.type}`);
    }

    rendered.renderTime = Date.now() - startTime;

    if (config.elementId) {
      this.renderCache.set(config.elementId, rendered);
    }

    return rendered;
  }

  /**
   * Render line chart
   */
  private renderLineChart(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "line",
      data: this.formatLineData(data),
      options: {
        ...options,
        chartType: "line",
        showPoints: options.interactive ?? true,
        smoothLines: true,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render bar chart
   */
  private renderBarChart(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "bar",
      data: this.formatBarData(data),
      options: {
        ...options,
        chartType: "bar",
        horizontal: false,
        stacked: false,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render pie chart
   */
  private renderPieChart(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "pie",
      data: this.formatPieData(data),
      options: {
        ...options,
        chartType: "pie",
        showLabels: true,
        showPercentages: true,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render heatmap
   */
  private renderHeatmap(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "heatmap",
      data: this.formatHeatmapData(data),
      options: {
        ...options,
        chartType: "heatmap",
        colorScale: "sequential",
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render funnel
   */
  private renderFunnel(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "funnel",
      data: this.formatFunnelData(data),
      options: {
        ...options,
        chartType: "funnel",
        showLabels: true,
        showPercentages: true,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render sankey diagram
   */
  private renderSankey(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "sankey",
      data: this.formatSankeyData(data),
      options: {
        ...options,
        chartType: "sankey",
        nodeWidth: 20,
        nodePadding: 10,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render scatter chart
   */
  private renderScatter(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "scatter",
      data: this.formatScatterData(data),
      options: {
        ...options,
        chartType: "scatter",
        showTrendline: false,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Render area chart
   */
  private renderAreaChart(config: ChartConfig): RenderedChart {
    const { data, options, elementId } = config;

    return {
      type: "area",
      data: this.formatLineData(data),
      options: {
        ...options,
        chartType: "area",
        filled: true,
      },
      element: elementId,
      renderTime: 0,
    };
  }

  /**
   * Format line chart data
   */
  private formatLineData(data: ChartData): unknown {
    return {
      labels: data.labels,
      datasets: data.datasets.map(ds => ({
        ...ds,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
      })),
    };
  }

  /**
   * Format bar chart data
   */
  private formatBarData(data: ChartData): unknown {
    return {
      labels: data.labels,
      datasets: data.datasets.map(ds => ({
        ...ds,
        borderRadius: 4,
      })),
    };
  }

  /**
   * Format pie chart data
   */
  private formatPieData(data: ChartData): unknown {
    const total =
      data.datasets[0]?.data.reduce((a: number, b: number) => a + b, 0) || 1;

    return {
      labels: data.labels,
      datasets: data.datasets.map(ds => ({
        ...ds,
        data: (ds.data as number[]).map(v => ({
          value: v,
          percentage: (v / total) * 100,
        })),
      })),
    };
  }

  /**
   * Format heatmap data
   */
  private formatHeatmapData(data: ChartData): unknown {
    return {
      xLabels: data.labels,
      yLabels: data.datasets.map(ds => ds.label),
      data: data.datasets.map(ds => ds.data as number[][]),
    };
  }

  /**
   * Format funnel data
   */
  private formatFunnelData(data: ChartData): unknown {
    const values = data.datasets[0]?.data as number[];
    let cumulative = values?.[0] || 100;

    return {
      labels: data.labels,
      values: values?.map(v => {
        const percentage = (v / cumulative) * 100;
        cumulative = v;
        return { value: v, percentage };
      }),
    };
  }

  /**
   * Format sankey data
   */
  private formatSankeyData(data: ChartData): unknown {
    return {
      nodes: data.labels?.map((label, i) => ({ id: i, name: label })) || [],
      links: data.datasets[0]?.data || [],
    };
  }

  /**
   * Format scatter data
   */
  private formatScatterData(data: ChartData): unknown {
    return {
      datasets: data.datasets.map(ds => ({
        ...ds,
        pointRadius: 6,
        pointHoverRadius: 8,
      })),
    };
  }

  /**
   * Get cached render
   */
  getCached(elementId: string): RenderedChart | undefined {
    return this.renderCache.get(elementId);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.renderCache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(elementId: string): void {
    this.renderCache.delete(elementId);
  }
}
