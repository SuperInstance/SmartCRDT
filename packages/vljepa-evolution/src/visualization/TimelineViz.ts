/**
 * TimelineViz - Visualize timeline data
 */

import type { TimelineEvent } from "../history/Timeline.js";

export class TimelineViz {
  /**
   * Render timeline as text
   */
  renderText(events: TimelineEvent[]): string {
    const lines: string[] = [];

    lines.push("=== TIMELINE ===\n");

    for (const event of events) {
      const date = new Date(event.timestamp).toISOString();
      lines.push(`[${date}] ${event.type.toUpperCase()}`);

      if (event.metadata?.message) {
        lines.push(`  ${event.metadata.message}`);
      }

      if (event.metadata?.branch) {
        lines.push(`  Branch: ${event.metadata.branch}`);
      }

      if (event.metadata?.author) {
        lines.push(`  Author: ${event.metadata.author}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Render timeline as HTML
   */
  renderHTML(events: TimelineEvent[]): string {
    const lines: string[] = [];

    lines.push('<div class="timeline-container">');
    lines.push('  <div class="timeline-line">');

    for (const event of events) {
      const date = new Date(event.timestamp).toISOString();
      lines.push(`    <div class="timeline-event timeline-${event.type}">`);
      lines.push(
        `      <div class="timeline-date">${this.escapeHtml(date)}</div>`
      );
      lines.push(`      <div class="timeline-type">${event.type}</div>`);

      if (event.metadata?.message) {
        lines.push(
          `      <div class="timeline-message">${this.escapeHtml(event.metadata.message)}</div>`
        );
      }

      if (event.metadata?.branch) {
        lines.push(
          `      <div class="timeline-branch">${this.escapeHtml(event.metadata.branch)}</div>`
        );
      }

      lines.push("    </div>");
    }

    lines.push("  </div>");
    lines.push("</div>");

    return lines.join("\n");
  }

  /**
   * Render timeline as graph (ASCII)
   */
  renderGraph(events: TimelineEvent[]): string {
    const lines: string[] = [];

    // Group by branch
    const branches = new Map<string, TimelineEvent[]>();

    for (const event of events) {
      const branch = event.metadata?.branch ?? "main";
      if (!branches.has(branch)) {
        branches.set(branch, []);
      }
      branches.get(branch)!.push(event);
    }

    // Render each branch
    for (const [branch, branchEvents] of branches) {
      lines.push(`${branch}:`);
      lines.push("  " + "─".repeat(50));

      for (const event of branchEvents) {
        const time = new Date(event.timestamp)
          .toISOString()
          .split("T")[1]
          .split(".")[0];
        const marker =
          event.type === "version" ? "●" : event.type === "merge" ? "◆" : "○";

        lines.push(
          `  ${marker} ${time} - ${event.metadata?.message || event.type}`
        );
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate timeline visualization data for charts
   */
  generateChartData(events: TimelineEvent[]): TimelineChartData {
    const dataPoints: TimelineDataPoint[] = [];

    // Group by day
    const dailyCounts = new Map<string, number>();

    for (const event of events) {
      const day = new Date(event.timestamp).toISOString().split("T")[0];
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }

    for (const [day, count] of dailyCounts) {
      dataPoints.push({ date: day, count });
    }

    // Group by type
    const typeCounts = new Map<string, number>();

    for (const event of events) {
      typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
    }

    return {
      dataPoints,
      typeDistribution: Array.from(typeCounts.entries()).map(
        ([type, count]) => ({ type, count })
      ),
      totalEvents: events.length,
    };
  }

  /**
   * Generate heatmap data
   */
  generateHeatmap(
    events: TimelineEvent[],
    granularity: "day" | "week" | "hour" = "day"
  ): HeatmapData {
    const heatmap = new Map<string, number>();

    for (const event of events) {
      const date = new Date(event.timestamp);
      let key: string;

      switch (granularity) {
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "hour":
          key = `${date.toISOString().split("T")[0]} ${date.getHours().toString().padStart(2, "0")}:00`;
          break;
      }

      heatmap.set(key, (heatmap.get(key) || 0) + 1);
    }

    const data = Array.from(heatmap.entries()).map(([key, count]) => ({
      key,
      count,
      intensity: Math.min(count / 10, 1), // Max intensity at 10 events
    }));

    return { data, granularity };
  }

  /**
   * Generate stream graph data
   */
  generateStreamGraph(events: TimelineEvent[]): StreamGraphData {
    const branchSeries = new Map<string, { date: string; count: number }[]>();

    for (const event of events) {
      const branch = event.metadata?.branch ?? "main";
      const day = new Date(event.timestamp).toISOString().split("T")[0];

      if (!branchSeries.has(branch)) {
        branchSeries.set(branch, []);
      }

      branchSeries.get(branch)!.push({ date: day, count: 1 });
    }

    // Aggregate by date for each branch
    const series: StreamSeries[] = [];

    for (const [branch, data] of branchSeries) {
      const dailyData = new Map<string, number>();

      for (const point of data) {
        dailyData.set(
          point.date,
          (dailyData.get(point.date) || 0) + point.count
        );
      }

      series.push({
        branch,
        data: Array.from(dailyData.entries()).map(([date, count]) => ({
          date,
          count,
        })),
      });
    }

    return { series };
  }

  // Private methods

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

export interface TimelineChartData {
  dataPoints: TimelineDataPoint[];
  typeDistribution: TypeDistribution[];
  totalEvents: number;
}

export interface TimelineDataPoint {
  date: string;
  count: number;
}

export interface TypeDistribution {
  type: string;
  count: number;
}

export interface HeatmapData {
  data: HeatmapPoint[];
  granularity: string;
}

export interface HeatmapPoint {
  key: string;
  count: number;
  intensity: number;
}

export interface StreamGraphData {
  series: StreamSeries[];
}

export interface StreamSeries {
  branch: string;
  data: { date: string; count: number }[];
}
