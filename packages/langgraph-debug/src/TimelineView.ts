/**
 * Timeline View for LangGraph Debugging
 *
 * Visualizes execution timeline with parallel execution,
 * agent interactions, and state changes over time.
 */

import type {
  TimelineEntry,
  ExecutionTrace,
  TraceEvent,
  StateSnapshot,
  GraphStructure,
} from "./types.js";

/**
 * Timeline segment for visualization
 */
interface TimelineSegment {
  id: string;
  startTime: number;
  endTime: number;
  level: number;
  entry: TimelineEntry;
}

/**
 * Timeline statistics
 */
interface TimelineStats {
  totalDuration: number;
  parallelism: number;
  bottleneckNodes: string[];
  idleTime: number;
}

/**
 * Agent interaction
 */
interface AgentInteraction {
  from: string;
  to: string;
  timestamp: number;
  type: "handoff" | "parallel" | "sequential";
}

/**
 * Timeline View Class
 *
 * Generates timeline visualizations for execution traces.
 */
export class TimelineView {
  private segments: Map<string, TimelineSegment[]> = new Map();
  private interactions: Map<string, AgentInteraction[]> = new Map();

  /**
   * Generate timeline entries from execution trace
   */
  generateTimeline(trace: ExecutionTrace): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    const nodeStartTimes = new Map<string, number>();
    const activeNodes = new Set<string>();

    for (const event of trace.events) {
      if (event.event_type === "node_start" && event.node_name) {
        const nodeId = event.node_name;
        nodeStartTimes.set(nodeId, event.timestamp);
        activeNodes.add(nodeId);

        entries.push({
          id: `entry_${event.event_id}`,
          start_time: event.timestamp,
          end_time: event.timestamp, // Will be updated on node_end
          duration_ms: 0,
          agent_id: event.agent_id ?? nodeId,
          node_name: nodeId,
          type: "execution",
          status: "running",
          related_entries:
            activeNodes.size > 1 ? Array.from(activeNodes) : undefined,
          metadata: {
            event_id: event.event_id,
            parallel: activeNodes.size > 1,
          },
        });
      } else if (event.event_type === "node_end" && event.node_name) {
        const nodeId = event.node_name;
        activeNodes.delete(nodeId);

        // Find and update the corresponding entry
        const entry = entries.find(
          e => e.node_name === nodeId && e.status === "running"
        );
        if (entry) {
          entry.end_time = event.timestamp;
          entry.duration_ms = event.timestamp - entry.start_time;
          entry.status = "completed";
        }
      } else if (event.event_type === "error") {
        // Mark running entries as failed
        for (const entry of entries) {
          if (
            entry.status === "running" &&
            entry.start_time <= event.timestamp
          ) {
            entry.status = "failed";
            entry.end_time = event.timestamp;
            entry.duration_ms = event.timestamp - entry.start_time;
          }
        }
      }
    }

    // Sort by start time
    entries.sort((a, b) => a.start_time - b.start_time);

    return entries;
  }

  /**
   * Calculate timeline segments for visualization
   */
  calculateSegments(entries: TimelineEntry[]): TimelineSegment[] {
    const segments: TimelineSegment[] = [];
    const levels: Map<string, number> = new Map();
    let maxLevel = 0;

    // Sort entries by start time
    const sorted = [...entries].sort((a, b) => a.start_time - b.start_time);

    for (const entry of sorted) {
      // Find the first available level
      let level = 0;
      while (true) {
        let levelAvailable = true;
        for (const segment of segments) {
          if (
            segment.level === level &&
            !(
              entry.end_time <= segment.startTime ||
              entry.start_time >= segment.endTime
            )
          ) {
            levelAvailable = false;
            break;
          }
        }
        if (levelAvailable) {
          break;
        }
        level++;
      }

      if (level > maxLevel) {
        maxLevel = level;
      }

      segments.push({
        id: entry.id,
        startTime: entry.start_time,
        endTime: entry.end_time,
        level,
        entry,
      });

      levels.set(entry.agent_id, level);
    }

    this.segments.set("default", segments);
    return segments;
  }

  /**
   * Detect parallel execution
   */
  detectParallelExecution(entries: TimelineEntry[]): Map<string, string[]> {
    const parallelGroups = new Map<string, string[]>();
    const activeAtTime = new Map<number, Set<string>>();

    // Sample time points
    const timePoints = new Set<number>();
    for (const entry of entries) {
      timePoints.add(entry.start_time);
      timePoints.add(entry.end_time);
    }

    const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

    for (const time of sortedTimes) {
      const active = new Set<string>();

      for (const entry of entries) {
        if (entry.start_time <= time && entry.end_time >= time) {
          active.add(entry.agent_id);
        }
      }

      if (active.size > 1) {
        const groupId = `parallel_${time}`;
        parallelGroups.set(groupId, Array.from(active));
      }

      activeAtTime.set(time, active);
    }

    return parallelGroups;
  }

  /**
   * Extract agent interactions from timeline
   */
  extractInteractions(
    entries: TimelineEntry[],
    trace: ExecutionTrace
  ): AgentInteraction[] {
    const interactions: AgentInteraction[] = [];
    const handoffs = new Map<string, string>();

    // Detect handoffs from edge traversals
    for (const event of trace.events) {
      if (event.event_type === "edge_traversal" && event.data) {
        const from = event.data.source as string;
        const to = event.data.target as string;

        if (from && to && from !== to) {
          interactions.push({
            from,
            to,
            timestamp: event.timestamp,
            type: "sequential",
          });

          handoffs.set(to, from);
        }
      }
    }

    // Detect parallel execution interactions
    const parallelGroups = this.detectParallelExecution(entries);
    for (const [groupId, agents] of parallelGroups.entries()) {
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          interactions.push({
            from: agents[i],
            to: agents[j],
            timestamp: parseInt(groupId.split("_")[1], 10),
            type: "parallel",
          });
        }
      }
    }

    this.interactions.set("default", interactions);
    return interactions;
  }

  /**
   * Generate Mermaid timeline (Gantt chart)
   */
  generateMermaidTimeline(
    entries: TimelineEntry[],
    title = "Execution Timeline"
  ): string {
    let mermaid = "gantt\n";
    mermaid += `    title ${title}\n`;
    mermaid += `    dateFormat X\n`;
    mermaid += `    axisFormat %L\n\n`;

    // Get unique agents
    const agents = Array.from(new Set(entries.map(e => e.agent_id)));

    for (const agent of agents) {
      const agentEntries = entries.filter(e => e.agent_id === agent);
      mermaid += `    section ${agent}\n`;

      for (const entry of agentEntries) {
        const status = entry.status === "completed" ? "done" : entry.status;
        mermaid += `    ${entry.node_name ?? entry.id} :${status}, ${entry.start_time}, ${entry.duration_ms}ms\n`;
      }
    }

    return mermaid;
  }

  /**
   * Generate HTML timeline visualization
   */
  generateHTMLTimeline(
    entries: TimelineEntry[],
    width = 1200,
    height = 400
  ): string {
    const segments = this.calculateSegments(entries);

    if (segments.length === 0) {
      return "<div>No timeline entries</div>";
    }

    const minTime = Math.min(...segments.map(s => s.startTime));
    const maxTime = Math.max(...segments.map(s => s.endTime));
    const totalTime = maxTime - minTime;
    const maxLevel = Math.max(...segments.map(s => s.level));

    const rowHeight = 40;
    const headerHeight = 40;
    const totalHeight = headerHeight + (maxLevel + 1) * rowHeight + 20;

    const scale = (width - 200) / totalTime; // Reserve 200px for labels

    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Execution Timeline</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background-color: #f7fafc;
            }
            .timeline-container {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow-x: auto;
            }
            .timeline-svg {
              display: block;
              margin: 0 auto;
            }
            .segment {
              cursor: pointer;
              transition: opacity 0.2s;
            }
            .segment:hover {
              opacity: 0.8;
            }
            .legend {
              margin-top: 20px;
              display: flex;
              gap: 20px;
              justify-content: center;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .legend-color {
              width: 20px;
              height: 20px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <h1>Execution Timeline</h1>
          <div class="timeline-container">
    `;

    // Create SVG
    html += `<svg class="timeline-svg" width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

    // Draw time axis
    html += `<line x1="200" y1="${headerHeight}" x2="${width}" y2="${headerHeight}" stroke="#cbd5e0" stroke-width="1"/>`;

    // Draw time labels
    for (let i = 0; i <= 10; i++) {
      const time = minTime + (totalTime * i) / 10;
      const x = 200 + (time - minTime) * scale;
      html += `<line x1="${x}" y1="${headerHeight}" x2="${x}" y2="${totalHeight}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="5,5"/>`;
      html += `<text x="${x}" y="${headerHeight - 10}" text-anchor="middle" font-size="12" fill="#718096">${time.toFixed(0)}ms</text>`;
    }

    // Draw segments
    for (const segment of segments) {
      const x = 200 + (segment.startTime - minTime) * scale;
      const y = headerHeight + segment.level * rowHeight + 5;
      const w = Math.max(segment.endTime - segment.startTime, 1) * scale;
      const h = rowHeight - 10;

      const color = this.getSegmentColor(segment.entry);
      const rx = segment.entry.type === "error" ? 0 : 6;

      html += `
        <rect class="segment"
              x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"
              fill="${color}"
              data-id="${segment.id}"
              data-node="${segment.entry.node_name}"
              data-duration="${segment.entry.duration_ms}">
          <title>${segment.entry.node_name}: ${segment.entry.duration_ms.toFixed(2)}ms</title>
        </rect>
      `;

      // Add label if wide enough
      if (w > 50) {
        html += `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="11" fill="white" style="pointer-events: none;">${segment.entry.node_name ?? ""}</text>`;
      }
    }

    // Add row labels
    for (let i = 0; i <= maxLevel; i++) {
      const y = headerHeight + i * rowHeight + rowHeight / 2 + 5;
      html += `<text x="180" y="${y}" text-anchor="end" font-size="12" fill="#4a5568">Level ${i}</text>`;
    }

    html += "</svg>";

    // Add legend
    html += `
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #48bb78;"></div>
          <span>Completed</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #ecc94b;"></div>
          <span>Running</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #f56565;"></div>
          <span>Failed</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #a0aec0;"></div>
          <span>Waiting</span>
        </div>
      </div>
    `;

    html += `
          </div>
        </body>
      </html>
    `;

    return html;
  }

  /**
   * Get segment color based on status
   */
  private getSegmentColor(entry: TimelineEntry): string {
    switch (entry.status) {
      case "completed":
        return "#48bb78";
      case "failed":
        return "#f56565";
      case "running":
        return "#ecc94b";
      case "cancelled":
        return "#a0aec0";
      default:
        return "#4299e1";
    }
  }

  /**
   * Calculate timeline statistics
   */
  calculateStatistics(
    entries: TimelineEntry[],
    trace: ExecutionTrace
  ): TimelineStats {
    if (entries.length === 0) {
      return {
        totalDuration: 0,
        parallelism: 0,
        bottleneckNodes: [],
        idleTime: 0,
      };
    }

    const totalDuration =
      Math.max(...entries.map(e => e.end_time)) -
      Math.min(...entries.map(e => e.start_time));

    // Calculate parallelism (max concurrent nodes)
    let maxParallelism = 0;
    const timePoints = new Set<number>();
    for (const entry of entries) {
      timePoints.add(entry.start_time);
      timePoints.add(entry.end_time);
    }

    for (const time of timePoints) {
      const concurrent = entries.filter(
        e => e.start_time <= time && e.end_time >= time
      ).length;
      maxParallelism = Math.max(maxParallelism, concurrent);
    }

    // Find bottleneck nodes (slowest nodes)
    const nodeTimes = new Map<string, number>();
    for (const entry of entries) {
      const nodeName = entry.node_name ?? entry.agent_id;
      const current = nodeTimes.get(nodeName) ?? 0;
      nodeTimes.set(nodeName, current + entry.duration_ms);
    }

    const sortedNodes = Array.from(nodeTimes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([node]) => node);

    // Calculate idle time (gaps between executions)
    const sortedEntries = [...entries].sort(
      (a, b) => a.start_time - b.start_time
    );
    let idleTime = 0;
    for (let i = 1; i < sortedEntries.length; i++) {
      const gap = sortedEntries[i].start_time - sortedEntries[i - 1].end_time;
      if (gap > 0) {
        idleTime += gap;
      }
    }

    return {
      totalDuration,
      parallelism: maxParallelism,
      bottleneckNodes: sortedNodes,
      idleTime,
    };
  }

  /**
   * Generate timeline report
   */
  generateReport(entries: TimelineEntry[], trace: ExecutionTrace): string {
    const stats = this.calculateStatistics(entries, trace);
    const interactions = this.extractInteractions(entries, trace);

    const lines: string[] = [];
    lines.push("# Execution Timeline Report");
    lines.push("");
    lines.push("## Statistics");
    lines.push(`- Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
    lines.push(`- Max Parallelism: ${stats.parallelism}`);
    lines.push(
      `- Idle Time: ${stats.idleTime.toFixed(2)}ms (${((stats.idleTime / stats.totalDuration) * 100).toFixed(1)}%)`
    );
    lines.push("");
    lines.push("## Bottleneck Nodes");
    for (const node of stats.bottleneckNodes) {
      const nodeEntries = entries.filter(
        e => (e.node_name ?? e.agent_id) === node
      );
      const totalTime = nodeEntries.reduce((sum, e) => sum + e.duration_ms, 0);
      lines.push(
        `- ${node}: ${totalTime.toFixed(2)}ms (${nodeEntries.length} executions)`
      );
    }
    lines.push("");
    lines.push("## Agent Interactions");
    lines.push(`Total interactions: ${interactions.length}`);
    lines.push(
      `- Handoffs: ${interactions.filter(i => i.type === "sequential").length}`
    );
    lines.push(
      `- Parallel: ${interactions.filter(i => i.type === "parallel").length}`
    );
    lines.push("");
    lines.push("## Execution Details");

    const sortedEntries = [...entries].sort(
      (a, b) => a.start_time - b.start_time
    );
    for (const entry of sortedEntries) {
      lines.push(
        `- [${entry.start_time.toFixed(0)}ms - ${entry.end_time.toFixed(0)}ms] ${entry.node_name ?? entry.agent_id}: ${entry.duration_ms.toFixed(2)}ms (${entry.status})`
      );
    }

    return lines.join("\n");
  }

  /**
   * Export timeline as JSON
   */
  exportTimeline(entries: TimelineEntry[]): string {
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Import timeline from JSON
   */
  importTimeline(jsonData: string): TimelineEntry[] {
    return JSON.parse(jsonData) as TimelineEntry[];
  }

  /**
   * Get state changes at time points
   */
  getStateChangesAtTime(
    snapshots: StateSnapshot[],
    timestamp: number
  ): StateSnapshot | null {
    // Find the snapshot closest to but not after the timestamp
    const before = snapshots
      .filter(s => s.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    return before.length > 0 ? before[0] : null;
  }

  /**
   * Animate timeline playback
   */
  *animateTimeline(
    entries: TimelineEntry[],
    interval = 100
  ): Generator<{
    time: number;
    active: TimelineEntry[];
    completed: TimelineEntry[];
  }> {
    const sorted = [...entries].sort((a, b) => a.start_time - b.start_time);
    const minTime = sorted[0]?.start_time ?? 0;
    const maxTime = Math.max(...sorted.map(e => e.end_time));

    for (let time = minTime; time <= maxTime; time += interval) {
      const active = sorted.filter(
        e => e.start_time <= time && e.end_time >= time
      );
      const completed = sorted.filter(e => e.end_time < time);

      yield { time, active, completed };
    }
  }

  /**
   * Get timeline for a specific agent
   */
  getAgentTimeline(entries: TimelineEntry[], agentId: string): TimelineEntry[] {
    return entries.filter(e => e.agent_id === agentId);
  }

  /**
   * Get overlapping segments
   */
  getOverlappingSegments(
    entry: TimelineEntry,
    allEntries: TimelineEntry[]
  ): TimelineEntry[] {
    return allEntries.filter(
      e =>
        e.id !== entry.id &&
        !(e.end_time <= entry.start_time || e.start_time >= entry.end_time)
    );
  }

  /**
   * Compress timeline (merge consecutive entries from same agent)
   */
  compressTimeline(entries: TimelineEntry[]): TimelineEntry[] {
    const compressed: TimelineEntry[] = [];
    const byAgent = new Map<string, TimelineEntry[]>();

    // Group by agent
    for (const entry of entries) {
      const agentEntries = byAgent.get(entry.agent_id) ?? [];
      agentEntries.push(entry);
      byAgent.set(entry.agent_id, agentEntries);
    }

    // Merge consecutive entries
    for (const [agentId, agentEntries] of byAgent.entries()) {
      const sorted = agentEntries.sort((a, b) => a.start_time - b.start_time);

      let current: TimelineEntry | null = null;
      for (const entry of sorted) {
        if (!current) {
          current = { ...entry };
        } else if (
          current.end_time === entry.start_time &&
          current.status === entry.status
        ) {
          // Merge
          current.end_time = entry.end_time;
          current.duration_ms += entry.duration_ms;
        } else {
          compressed.push(current);
          current = { ...entry };
        }
      }

      if (current) {
        compressed.push(current);
      }
    }

    return compressed;
  }

  /**
   * Get segments for a trace
   */
  getSegments(traceId?: string): TimelineSegment[] {
    if (traceId) {
      return this.segments.get(traceId) ?? [];
    }
    return this.segments.get("default") ?? [];
  }

  /**
   * Clear cached data
   */
  clear(): void {
    this.segments.clear();
    this.interactions.clear();
  }
}
