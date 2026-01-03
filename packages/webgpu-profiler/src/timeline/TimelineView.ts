/**
 * TimelineView - Visual timeline representation of GPU work
 *
 * Creates timeline data for visualization of GPU operations
 */

import type {
  TimelineEvent,
  FrameProfile,
  KernelExecution,
  MemoryAllocation,
  TransferRecord,
} from "../types.js";

/**
 * Timeline configuration
 */
interface TimelineConfig {
  /** Whether to show kernels */
  showKernels: boolean;
  /** Whether to show memory operations */
  showMemory: boolean;
  /** Whether to show transfers */
  showTransfers: boolean;
  /** Whether to show synchronization */
  showSync: boolean;
  /** Color scheme */
  colorScheme: "default" | "dark" | "vibrant";
}

/**
 * Color scheme definitions
 */
const COLOR_SCHEMES: Record<
  TimelineConfig["colorScheme"],
  Record<string, string>
> = {
  default: {
    kernel: "#4a90e2",
    memory: "#50c878",
    transfer: "#f39c12",
    synchronization: "#9b59b6",
  },
  dark: {
    kernel: "#5dade2",
    memory: "#58d68d",
    transfer: "#f5b041",
    synchronization: "#af7ac5",
  },
  vibrant: {
    kernel: "#e74c3c",
    memory: "#2ecc71",
    transfer: "#f39c12",
    synchronization: "#9b59b6",
  },
};

/**
 * Timeline aggregation level
 */
type AggregationLevel = "none" | "frame" | "millisecond" | "second";

/**
 * TimelineView - Creates timeline visualizations for GPU operations
 *
 * @example
 * ```typescript
 * const timelineView = new TimelineView();
 *
 * const events = timelineView.createTimeline(report.frames);
 * const json = timelineView.exportAsJSON(events);
 * const html = timelineView.exportAsHTML(events);
 * ```
 */
export class TimelineView {
  /** Configuration */
  private config: TimelineConfig;

  /**
   * Create a new timeline view
   *
   * @param config - Timeline configuration
   */
  constructor(config?: Partial<TimelineConfig>) {
    this.config = {
      showKernels: true,
      showMemory: true,
      showTransfers: true,
      showSync: false,
      colorScheme: "default",
      ...config,
    };
  }

  /**
   * Create timeline events from frame profiles
   *
   * @param frames - Frame profiles
   * @returns Timeline events
   */
  createTimeline(frames: FrameProfile[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const frame of frames) {
      // Frame event
      if (this.config.showSync) {
        events.push({
          type: "synchronization",
          id: `frame-${frame.frameNumber}`,
          name: `Frame ${frame.frameNumber}`,
          startTime: frame.startTime,
          endTime: frame.endTime,
          duration: frame.duration,
          color: COLOR_SCHEMES[this.config.colorScheme].synchronization,
          metadata: {
            frameNumber: frame.frameNumber,
            kernelCount: frame.kernels.length,
            allocationCount: frame.allocations.length,
            transferCount: frame.transfers.length,
          },
        });
      }

      // Kernel events
      if (this.config.showKernels) {
        for (const kernel of frame.kernels) {
          events.push({
            type: "kernel",
            id: kernel.id,
            name: kernel.name,
            startTime: kernel.startTime,
            endTime: kernel.endTime,
            duration: kernel.duration,
            color: COLOR_SCHEMES[this.config.colorScheme].kernel,
            metadata: {
              workgroupSize: kernel.workgroupSize,
              dispatchSize: kernel.dispatchSize,
              gpuTimestamp: kernel.gpuTimestamp,
            },
          });
        }
      }

      // Memory events
      if (this.config.showMemory) {
        for (const alloc of frame.allocations) {
          const duration =
            alloc.freed && alloc.freeTimestamp
              ? alloc.freeTimestamp - alloc.timestamp
              : (frame.endTime ?? alloc.timestamp) - alloc.timestamp;

          events.push({
            type: "memory",
            id: alloc.id,
            name: `${alloc.type} allocation`,
            startTime: alloc.timestamp,
            endTime:
              alloc.freed && alloc.freeTimestamp
                ? alloc.freeTimestamp
                : frame.endTime,
            duration,
            color: COLOR_SCHEMES[this.config.colorScheme].memory,
            metadata: {
              size: alloc.size,
              usage: alloc.usage,
              freed: alloc.freed,
              type: alloc.type,
            },
          });
        }
      }

      // Transfer events
      if (this.config.showTransfers) {
        for (const transfer of frame.transfers) {
          events.push({
            type: "transfer",
            id: transfer.id,
            name: `${transfer.direction} transfer`,
            startTime: transfer.startTime,
            endTime: transfer.endTime,
            duration: transfer.duration,
            color: COLOR_SCHEMES[this.config.colorScheme].transfer,
            metadata: {
              size: transfer.size,
              bandwidth: transfer.bandwidth,
              direction: transfer.direction,
              async: transfer.async,
            },
          });
        }
      }
    }

    // Sort by start time
    events.sort((a, b) => a.startTime - b.startTime);

    return events;
  }

  /**
   * Aggregate timeline events
   *
   * @param events - Timeline events
   * @param level - Aggregation level
   * @returns Aggregated events
   */
  aggregateEvents(
    events: TimelineEvent[],
    level: AggregationLevel
  ): TimelineEvent[] {
    if (level === "none") return events;

    const aggregated: TimelineEvent[] = [];
    const aggregationWindow = this.getAggregationWindow(level);

    // Group events by time window
    const windows = new Map<number, TimelineEvent[]>();

    for (const event of events) {
      const windowKey = Math.floor(event.startTime / aggregationWindow);
      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }
      windows.get(windowKey)!.push(event);
    }

    // Create aggregated events
    for (const [windowKey, windowEvents] of windows) {
      const startTime = windowKey * aggregationWindow;
      const endTime = startTime + aggregationWindow;

      // Count events by type
      const typeCounts = new Map<string, number>();
      for (const event of windowEvents) {
        typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
      }

      // Create summary event
      const typeLabels = Array.from(typeCounts.entries())
        .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
        .join(", ");

      aggregated.push({
        type: "synchronization",
        id: `aggregate-${windowKey}`,
        name: `Window ${windowKey}`,
        startTime,
        endTime,
        duration: aggregationWindow,
        color: COLOR_SCHEMES[this.config.colorScheme].synchronization,
        metadata: {
          eventCount: windowEvents.length,
          typeBreakdown: Array.from(typeCounts.entries()),
          label: typeLabels,
        },
      });
    }

    return aggregated;
  }

  /**
   * Get aggregation window size in milliseconds
   */
  private getAggregationWindow(level: AggregationLevel): number {
    switch (level) {
      case "frame":
        return 16.67; // 60 FPS
      case "millisecond":
        return 1;
      case "second":
        return 1000;
      default:
        return 1;
    }
  }

  /**
   * Filter timeline events
   *
   * @param events - Timeline events
   * @param filter - Filter function
   * @returns Filtered events
   */
  filterEvents(
    events: TimelineEvent[],
    filter: (event: TimelineEvent) => boolean
  ): TimelineEvent[] {
    return events.filter(filter);
  }

  /**
   * Get events by type
   *
   * @param events - Timeline events
   * @param type - Event type
   * @returns Filtered events
   */
  getEventsByType(
    events: TimelineEvent[],
    type: TimelineEvent["type"]
  ): TimelineEvent[] {
    return events.filter(e => e.type === type);
  }

  /**
   * Get events by time range
   *
   * @param events - Timeline events
   * @param startTime - Start time
   * @param endTime - End time
   * @returns Filtered events
   */
  getEventsByTimeRange(
    events: TimelineEvent[],
    startTime: number,
    endTime: number
  ): TimelineEvent[] {
    return events.filter(e => e.startTime >= startTime && e.endTime <= endTime);
  }

  /**
   * Find overlapping events
   *
   * @param events - Timeline events
   * @returns Array of overlapping event groups
   */
  findOverlappingEvents(events: TimelineEvent[]): TimelineEvent[][] {
    const overlaps: TimelineEvent[][] = [];
    const processed = new Set<string>();

    for (const event of events) {
      if (processed.has(event.id)) continue;

      const group: TimelineEvent[] = [event];
      processed.add(event.id);

      for (const other of events) {
        if (processed.has(other.id)) continue;

        if (this.eventsOverlap(event, other)) {
          group.push(other);
          processed.add(other.id);
        }
      }

      if (group.length > 1) {
        overlaps.push(group);
      }
    }

    return overlaps;
  }

  /**
   * Check if two events overlap
   */
  private eventsOverlap(a: TimelineEvent, b: TimelineEvent): boolean {
    return a.startTime < b.endTime && b.startTime < a.endTime;
  }

  /**
   * Calculate parallelism metrics
   *
   * @param events - Timeline events
   * @returns Parallelism statistics
   */
  calculateParallelism(events: TimelineEvent[]): {
    maxConcurrentEvents: number;
    avgConcurrentEvents: number;
    totalParallelTime: number;
    parallelismRatio: number;
  } {
    if (events.length === 0) {
      return {
        maxConcurrentEvents: 0,
        avgConcurrentEvents: 0,
        totalParallelTime: 0,
        parallelismRatio: 0,
      };
    }

    const startTime = Math.min(...events.map(e => e.startTime));
    const endTime = Math.max(...events.map(e => e.endTime));
    const totalDuration = endTime - startTime;

    // Sample at 1ms intervals
    const sampleInterval = 1;
    const samples: number[] = [];

    for (let t = startTime; t < endTime; t += sampleInterval) {
      const concurrent = events.filter(
        e => e.startTime <= t && e.endTime >= t
      ).length;
      samples.push(concurrent);
    }

    const maxConcurrentEvents = Math.max(...samples);
    const avgConcurrentEvents =
      samples.reduce((a, b) => a + b, 0) / samples.length;
    const totalParallelTime =
      samples.filter(s => s > 1).length * sampleInterval;
    const parallelismRatio = totalParallelTime / totalDuration;

    return {
      maxConcurrentEvents,
      avgConcurrentEvents,
      totalParallelTime,
      parallelismRatio,
    };
  }

  /**
   * Export timeline as JSON
   *
   * @param events - Timeline events
   * @returns JSON string
   */
  exportAsJSON(events: TimelineEvent[]): string {
    return JSON.stringify(events, null, 2);
  }

  /**
   * Export timeline as HTML visualization
   *
   * @param events - Timeline events
   * @param options - Export options
   * @returns HTML string
   */
  exportAsHTML(
    events: TimelineEvent[],
    options: { title?: string; width?: number } = {}
  ): string {
    const { title = "GPU Timeline", width = 1200 } = options;

    if (events.length === 0) {
      return "<html><body>No events to display</body></html>";
    }

    const startTime = Math.min(...events.map(e => e.startTime));
    const endTime = Math.max(...events.map(e => e.endTime));
    const totalDuration = endTime - startTime;

    // Generate HTML
    const lines: string[] = [
      "<!DOCTYPE html>",
      "<html>",
      "<head>",
      "  <title>" + title + "</title>",
      "  <style>",
      "    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #fff; }",
      "    .timeline { position: relative; width: " +
        width +
        "px; height: " +
        (events.length * 30 + 50) +
        "px; }",
      "    .event { position: absolute; height: 20px; border-radius: 3px; overflow: hidden; }",
      "    .event-label { position: absolute; white-space: nowrap; font-size: 11px; pointer-events: none; }",
      "    .axis { position: absolute; bottom: 0; width: 100%; height: 30px; border-top: 1px solid #444; }",
      "    .tick { position: absolute; height: 10px; border-left: 1px solid #666; }",
      "    .tick-label { position: absolute; font-size: 10px; color: #888; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <h1>" + title + "</h1>",
      '  <div class="timeline">',
    ];

    // Render events
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const left = ((event.startTime - startTime) / totalDuration) * width;
      const eventWidth = (event.duration / totalDuration) * width;
      const top = i * 30;

      lines.push(
        `    <div class="event" style="left: ${left}px; width: ${eventWidth}px; top: ${top}px; background: ${event.color};">`
      );
      lines.push(
        `      <span class="event-label" style="left: 5px; top: 2px;">${this.escapeHtml(event.name)}</span>`
      );
      lines.push("    </div>");
    }

    // Render time axis
    lines.push('    <div class="axis">');
    const tickCount = 10;
    for (let i = 0; i <= tickCount; i++) {
      const t = startTime + (totalDuration * i) / tickCount;
      const left = (width * i) / tickCount;
      lines.push(`      <div class="tick" style="left: ${left}px;"></div>`);
      lines.push(
        `      <span class="tick-label" style="left: ${left + 3}px;">${this.formatTime(t - startTime)}</span>`
      );
    }
    lines.push("    </div>");
    lines.push("  </div>");
    lines.push("</body>");
    lines.push("</html>");

    return lines.join("\n");
  }

  /**
   * Export timeline as CSV
   *
   * @param events - Timeline events
   * @returns CSV string
   */
  exportAsCSV(events: TimelineEvent[]): string {
    const lines: string[] = [
      "ID,Type,Name,StartTime,EndTime,Duration,Color,Metadata",
    ];

    for (const event of events) {
      const metadata = JSON.stringify(event.metadata).replace(/"/g, '""');
      lines.push(
        `${event.id},${event.type},"${event.name}",${event.startTime},${event.endTime},${event.duration},${event.color},"${metadata}"`
      );
    }

    return lines.join("\n");
  }

  /**
   * Format time for display
   */
  private formatTime(ms: number): string {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(0)}μs`;
    } else if (ms < 1000) {
      return `${ms.toFixed(1)}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  }

  /**
   * Escape HTML special characters
   */
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

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  setConfig(config: Partial<TimelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TimelineConfig {
    return { ...this.config };
  }
}
