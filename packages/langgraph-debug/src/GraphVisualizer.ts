/**
 * Graph Visualizer for LangGraph
 *
 * Generates various visualization formats (Mermaid, Graphviz, HTML, SVG)
 * for LangGraph agent workflows with execution path highlighting.
 */

import type {
  GraphStructure,
  GraphNode,
  GraphEdge,
  GraphVisualizationOptions,
  ExecutionTrace,
  VisualizationFormat,
} from "./types.js";

/**
 * Graph Visualizer Class
 *
 * Converts graph structures and execution traces into visual representations.
 */
export class GraphVisualizer {
  private colorSchemes = {
    default: {
      agent: "#4299e1",
      router: "#ed8936",
      conditional: "#9f7aea",
      action: "#48bb78",
      start: "#38a169",
      end: "#e53e3e",
      highlighted: "#ecc94b",
    },
    pastel: {
      agent: "#bee3f8",
      router: "#fbd38d",
      conditional: "#d6bcfa",
      action: "#c6f6d5",
      start: "#9ae6b4",
      end: "#fc8181",
      highlighted: "#fefcbf",
    },
    vibrant: {
      agent: "#0066cc",
      router: "#ff6600",
      conditional: "#9933ff",
      action: "#00cc66",
      start: "#009933",
      end: "#cc0000",
      highlighted: "#ffcc00",
    },
    monochrome: {
      agent: "#4a5568",
      router: "#4a5568",
      conditional: "#4a5568",
      action: "#4a5568",
      start: "#1a202c",
      end: "#1a202c",
      highlighted: "#000000",
    },
  };

  /**
   * Generate a graph visualization
   */
  generateVisualization(
    graph: GraphStructure,
    options: Partial<GraphVisualizationOptions> = {}
  ): string {
    const opts: GraphVisualizationOptions = {
      format: options.format ?? "mermaid",
      show_labels: options.show_labels ?? true,
      show_edge_labels: options.show_edge_labels ?? true,
      show_timing: options.show_timing ?? false,
      show_state: options.show_state ?? false,
      layout: options.layout ?? "top-down",
      color_scheme: options.color_scheme ?? "default",
      node_size: options.node_size ?? "medium",
      font_size: options.font_size ?? 12,
      include_timestamps: options.include_timestamps ?? false,
      highlight_path: options.highlight_path,
    };

    switch (opts.format) {
      case "mermaid":
        return this.generateMermaid(graph, opts);
      case "graphviz":
        return this.generateGraphviz(graph, opts);
      case "json":
        return this.generateJSON(graph, opts);
      case "html":
        return this.generateHTML(graph, opts);
      case "svg":
        return this.generateSVG(graph, opts);
      default:
        throw new Error(`Unsupported format: ${opts.format}`);
    }
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaid(
    graph: GraphStructure,
    options: GraphVisualizationOptions
  ): string {
    const direction = options.layout === "left-right" ? "LR" : "TD";
    let mermaid = `graph ${direction}\n`;

    // Add nodes
    for (const node of graph.nodes) {
      const label = options.show_labels
        ? this.escapeMermaidLabel(node.name)
        : node.id;
      const shape = this.getMermaidShape(node.type);
      const style = this.getMermaidStyle(node, options);

      if (style) {
        mermaid += `  ${node.id}${shape}["${label}"]${style}\n`;
      } else {
        mermaid += `  ${node.id}${shape}["${label}"]\n`;
      }

      // Add timing info if requested
      if (options.show_timing && node.total_time_ms !== undefined) {
        mermaid += `  ${node.id}_time[ "${node.total_time_ms.toFixed(2)}ms" ]\n`;
      }
    }

    // Add edges
    for (const edge of graph.edges) {
      let edgeLabel = "";
      if (options.show_edge_labels && edge.condition) {
        edgeLabel = `|${this.escapeMermaidLabel(edge.condition)}|`;
      }

      const style = this.getEdgeStyle(edge, options);
      mermaid += `  ${edge.source} -->${edgeLabel}${style} ${edge.target}\n`;
    }

    // Add subgraphs for entry/exit points
    if (graph.entry_points.length > 0) {
      mermaid += `  class entry start,end\n`;
    }
    if (graph.exit_points.length > 0) {
      mermaid += `  class exit start,end\n`;
    }

    return mermaid;
  }

  /**
   * Get Mermaid node shape based on type
   */
  private getMermaidShape(type: GraphNode["type"]): string {
    switch (type) {
      case "start":
      case "end":
        return "(("; // Rounded
      case "conditional":
      case "router":
        return "{"; // Diamond
      default:
        return "["; // Rectangle
    }
  }

  /**
   * Get Mermaid style for a node
   */
  private getMermaidStyle(
    node: GraphNode,
    options: GraphVisualizationOptions
  ): string {
    const colors = this.colorSchemes[options.color_scheme ?? "default"];
    const isHighlighted = options.highlight_path?.includes(node.id);

    let style = "";
    if (isHighlighted) {
      style = `:::highlighted`;
    } else if (node.type === "start") {
      style = `:::start`;
    } else if (node.type === "end") {
      style = `:::end`;
    } else if (node.execution_count && node.execution_count === 0) {
      style = `:::unexecuted`;
    }

    return style;
  }

  /**
   * Get Mermaid edge style
   */
  private getEdgeStyle(
    edge: GraphEdge,
    options: GraphVisualizationOptions
  ): string {
    const isHighlighted =
      options.highlight_path &&
      options.highlight_path.length > 1 &&
      options.highlight_path.some((id, i) => {
        if (i === 0) return false;
        const prevId = options.highlight_path![i - 1];
        return edge.source === prevId && edge.target === id;
      });

    return isHighlighted ? ":::highlighted" : "";
  }

  /**
   * Escape Mermaid label
   */
  private escapeMermaidLabel(label: string): string {
    return label.replace(/"/g, "#quot;");
  }

  /**
   * Generate Graphviz DOT file
   */
  private generateGraphviz(
    graph: GraphStructure,
    options: GraphVisualizationOptions
  ): string {
    const direction = options.layout === "left-right" ? "LR" : "TB";
    let dot = `digraph G {\n`;
    dot += `  rankdir=${direction};\n`;
    dot += `  fontname="Arial";\n`;
    dot += `  fontsize=${options.font_size};\n\n`;

    // Define node styles
    const colors = this.colorSchemes[options.color_scheme ?? "default"];

    // Add nodes
    for (const node of graph.nodes) {
      dot += `  ${node.id} [`;

      const shape = this.getGraphvizShape(node.type);
      const fillColor = this.getNodeFillColor(node, colors, options);
      const label = options.show_labels ? node.name : node.id;

      dot += `shape=${shape}, `;
      dot += `label="${label}", `;
      dot += `style="filled", `;
      dot += `fillcolor="${fillColor}", `;
      dot += `fontname="Arial", `;
      dot += `fontsize=${options.font_size}`;

      if (options.show_timing && node.total_time_ms !== undefined) {
        dot += `, tooltip="${node.total_time_ms.toFixed(2)}ms"`;
      }

      dot += `];\n`;
    }

    // Add edges
    for (const edge of graph.edges) {
      dot += `  ${edge.source} -> ${edge.target} [`;

      const attrs: string[] = [];
      if (options.show_edge_labels && edge.condition) {
        attrs.push(`label="${edge.condition}"`);
      }
      if (edge.traversal_count !== undefined) {
        attrs.push(`penwidth=${Math.min(1 + edge.traversal_count * 0.5, 5)}`);
      }
      attrs.push('fontname="Arial"');
      attrs.push(`fontsize=${options.font_size - 2}`);

      dot += attrs.join(", ");
      dot += `];\n`;
    }

    dot += `}\n`;
    return dot;
  }

  /**
   * Get Graphviz node shape
   */
  private getGraphvizShape(type: GraphNode["type"]): string {
    switch (type) {
      case "start":
      case "end":
        return "doublecircle";
      case "conditional":
      case "router":
        return "diamond";
      default:
        return "box";
    }
  }

  /**
   * Get node fill color
   */
  private getNodeFillColor(
    node: GraphNode,
    colors: Record<string, string>,
    options: GraphVisualizationOptions
  ): string {
    if (options.highlight_path?.includes(node.id)) {
      return colors.highlighted;
    }
    return colors[node.type] ?? colors.agent;
  }

  /**
   * Generate JSON representation
   */
  private generateJSON(
    graph: GraphStructure,
    options: GraphVisualizationOptions
  ): string {
    const data = {
      graph_id: graph.graph_id,
      nodes: graph.nodes.map(node => ({
        ...node,
        highlighted: options.highlight_path?.includes(node.id) ?? false,
      })),
      edges: graph.edges,
      entry_points: graph.entry_points,
      exit_points: graph.exit_points,
      options,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate HTML interactive visualization
   */
  private generateHTML(
    graph: GraphStructure,
    options: GraphVisualizationOptions
  ): string {
    const colors = this.colorSchemes[options.color_scheme ?? "default"];

    const nodesHTML = graph.nodes
      .map(node => {
        const isHighlighted = options.highlight_path?.includes(node.id);
        const bgColor = isHighlighted
          ? colors.highlighted
          : (colors[node.type] ?? colors.agent);

        return `
          <div class="node ${node.type} ${isHighlighted ? "highlighted" : ""}"
               data-id="${node.id}"
               style="background-color: ${bgColor};">
            <div class="node-label">${node.name}</div>
            ${
              options.show_timing && node.total_time_ms !== undefined
                ? `<div class="node-timing">${node.total_time_ms.toFixed(2)}ms</div>`
                : ""
            }
            ${
              node.execution_count !== undefined
                ? `<div class="node-count">${node.execution_count} executions</div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    const edgesHTML = graph.edges
      .map(edge => {
        const isHighlighted =
          options.highlight_path &&
          options.highlight_path.length > 1 &&
          options.highlight_path.some((id, i) => {
            if (i === 0) return false;
            return (
              edge.source === options.highlight_path![i - 1] &&
              edge.target === id
            );
          });

        return `
          <div class="edge ${isHighlighted ? "highlighted" : ""}"
               data-source="${edge.source}"
               data-target="${edge.target}">
            ${edge.condition ? `<span class="edge-label">${edge.condition}</span>` : ""}
            ${
              edge.traversal_count !== undefined
                ? `<span class="edge-count">${edge.traversal_count}</span>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Graph Visualization: ${graph.graph_id}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 20px;
              background-color: #f7fafc;
            }
            .graph-container {
              display: flex;
              flex-wrap: wrap;
              gap: 20px;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .node {
              padding: 12px 16px;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
              min-width: 120px;
              text-align: center;
            }
            .node:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            .node.highlighted {
              box-shadow: 0 0 0 3px #ffd700, 0 4px 8px rgba(0,0,0,0.2);
            }
            .node-label {
              font-size: 14px;
            }
            .node-timing {
              font-size: 11px;
              margin-top: 4px;
              opacity: 0.9;
            }
            .node-count {
              font-size: 10px;
              margin-top: 2px;
              opacity: 0.8;
            }
            .legend {
              margin-top: 20px;
              padding: 15px;
              background-color: white;
              border-radius: 8px;
            }
            .legend-item {
              display: inline-block;
              margin-right: 15px;
              margin-bottom: 8px;
            }
            .legend-color {
              display: inline-block;
              width: 16px;
              height: 16px;
              border-radius: 3px;
              margin-right: 5px;
              vertical-align: middle;
            }
          </style>
        </head>
        <body>
          <h1>Graph: ${graph.graph_id}</h1>
          <div class="graph-container">
            ${nodesHTML}
          </div>
          <div class="legend">
            <h3>Legend</h3>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.agent}"></span>
              Agent
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.router}"></span>
              Router
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.conditional}"></span>
              Conditional
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.action}"></span>
              Action
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.start}"></span>
              Start
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: ${colors.end}"></span>
              End
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate SVG visualization
   */
  private generateSVG(
    graph: GraphStructure,
    options: GraphVisualizationOptions
  ): string {
    const colors = this.colorSchemes[options.color_scheme ?? "default"];

    // Simple layout: arrange nodes in a grid
    const gridSize = Math.ceil(Math.sqrt(graph.nodes.length));
    const nodeSize = 120;
    const gap = 50;

    const nodePositions = new Map<string, { x: number; y: number }>();

    graph.nodes.forEach((node, i) => {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      nodePositions.set(node.id, {
        x: col * (nodeSize + gap) + nodeSize / 2,
        y: row * (nodeSize + gap) + nodeSize / 2,
      });
    });

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridSize * (nodeSize + gap)} ${Math.ceil(graph.nodes.length / gridSize) * (nodeSize + gap)}">\n`;
    svg += `  <style>\n`;
    svg += `    .node { cursor: pointer; transition: opacity 0.2s; }\n`;
    svg += `    .node:hover { opacity: 0.8; }\n`;
    svg += `    .node-label { font-family: Arial, sans-serif; font-size: 12px; fill: white; text-anchor: middle; }\n`;
    svg += `    .edge { stroke: #cbd5e0; stroke-width: 2; }\n`;
    svg += `  </style>\n\n`;

    // Draw edges first (behind nodes)
    for (const edge of graph.edges) {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (sourcePos && targetPos) {
        const isHighlighted =
          options.highlight_path &&
          options.highlight_path.length > 1 &&
          options.highlight_path.some((id, i) => {
            if (i === 0) return false;
            return (
              edge.source === options.highlight_path![i - 1] &&
              edge.target === id
            );
          });

        svg += `  <line class="edge" x1="${sourcePos.x}" y1="${sourcePos.y}" x2="${targetPos.x}" y2="${targetPos.y}"`;
        if (isHighlighted) {
          svg += ` stroke="${colors.highlighted}" stroke-width="3"`;
        }
        if (edge.traversal_count) {
          svg += ` stroke-width="${1 + edge.traversal_count * 0.5}"`;
        }
        svg += `/>\n`;
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const pos = nodePositions.get(node.id) ?? { x: 0, y: 0 };
      const isHighlighted = options.highlight_path?.includes(node.id);
      const fillColor = isHighlighted
        ? colors.highlighted
        : (colors[node.type] ?? colors.agent);

      let shape = "";
      if (node.type === "start" || node.type === "end") {
        shape = 'rx="50%" ry="50%"';
      } else if (node.type === "conditional" || node.type === "router") {
        // Diamond approximation
        shape = 'transform="rotate(45)"';
      }

      svg += `  <g class="node" transform="translate(${pos.x - nodeSize / 2}, ${pos.y - nodeSize / 2})">\n`;
      svg += `    <rect width="${nodeSize}" height="${nodeSize}" fill="${fillColor}" rx="8" ${shape}/>\n`;
      svg += `    <text class="node-label" x="${nodeSize / 2}" y="${nodeSize / 2}">${node.name}</text>\n`;

      if (options.show_timing && node.total_time_ms !== undefined) {
        svg += `    <text class="node-label" x="${nodeSize / 2}" y="${nodeSize / 2 + 20}" font-size="10">${node.total_time_ms.toFixed(2)}ms</text>\n`;
      }

      svg += `  </g>\n`;
    }

    svg += `</svg>`;
    return svg;
  }

  /**
   * Highlight execution path from a trace
   */
  highlightExecutionPath(
    graph: GraphStructure,
    trace: ExecutionTrace
  ): string[] {
    const path: string[] = [];
    const nodeOrder = new Map<string, number>();

    // Extract node execution order from trace events
    let order = 0;
    for (const event of trace.events) {
      if (event.event_type === "node_start" && event.node_name) {
        if (!nodeOrder.has(event.node_name)) {
          nodeOrder.set(event.node_name, order++);
        }
      }
    }

    // Sort nodes by execution order
    const sortedNodes = Array.from(nodeOrder.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([nodeId]) => nodeId);

    return sortedNodes;
  }

  /**
   * Create graph structure from execution trace
   */
  graphFromTrace(trace: ExecutionTrace): GraphStructure {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const entryPoints: string[] = [];
    const exitPoints: string[] = [];

    let previousNode: string | undefined;
    let edgeId = 0;

    for (const event of trace.events) {
      if (event.event_type === "node_start" && event.node_name) {
        const nodeName = event.node_name;

        if (!nodes.has(nodeName)) {
          nodes.set(nodeName, {
            id: nodeName,
            name: nodeName,
            type: "agent",
            execution_count: 0,
            total_time_ms: 0,
          });
        }

        // Track execution path
        if (previousNode) {
          edges.push({
            id: `edge_${edgeId++}`,
            source: previousNode,
            target: nodeName,
            traversal_count: 1,
          });
        } else {
          entryPoints.push(nodeName);
        }

        previousNode = nodeName;
      } else if (event.event_type === "node_end" && event.node_name) {
        const node = nodes.get(event.node_name);
        if (node) {
          node.execution_count = (node.execution_count ?? 0) + 1;
        }
      }
    }

    // Mark last node as exit point
    if (previousNode) {
      exitPoints.push(previousNode);
    }

    return {
      graph_id: trace.graph_id,
      nodes: Array.from(nodes.values()),
      edges,
      entry_points: entryPoints,
      exit_points: exitPoints,
    };
  }

  /**
   * Get node statistics from execution trace
   */
  getNodeStatistics(
    trace: ExecutionTrace
  ): Map<string, { count: number; totalTime: number; avgTime: number }> {
    const stats = new Map<string, { count: number; totalTime: number }>();

    const nodeStartTimes = new Map<string, number>();

    for (const event of trace.events) {
      if (event.event_type === "node_start" && event.node_name) {
        nodeStartTimes.set(event.node_name, event.timestamp);
      } else if (event.event_type === "node_end" && event.node_name) {
        const startTime = nodeStartTimes.get(event.node_name);
        if (startTime !== undefined) {
          const duration = event.timestamp - startTime;
          const stat = stats.get(event.node_name) ?? { count: 0, totalTime: 0 };
          stat.count++;
          stat.totalTime += duration;
          stats.set(event.node_name, stat);
          nodeStartTimes.delete(event.node_name);
        }
      }
    }

    // Calculate averages
    const result = new Map();
    for (const [node, stat] of stats.entries()) {
      result.set(node, {
        count: stat.count,
        totalTime: stat.totalTime,
        avgTime: stat.totalTime / stat.count,
      });
    }

    return result;
  }
}
