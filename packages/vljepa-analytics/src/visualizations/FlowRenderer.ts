/**
 * FlowRenderer - Renders user flow diagrams (Sankey)
 */

import type { UserFlow, FlowNode, FlowConnection } from "../types.js";

export interface FlowConfig {
  data: UserFlow;
  options: FlowOptions;
}

export interface FlowOptions {
  nodeWidth: number;
  nodePadding: number;
  showLabels: boolean;
  showPercentages: boolean;
  animated: boolean;
  colorScheme: string[];
}

export interface RenderedFlow {
  type: "sankey";
  data: UserFlow;
  options: FlowOptions;
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    label: string;
  }>;
  links: Array<{
    source: { x: number; y: number };
    target: { x: number; y: number };
    value: number;
    color: string;
    opacity: number;
  }>;
  renderTime: number;
}

export class FlowRenderer {
  private defaultColors = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];

  /**
   * Render flow diagram
   */
  render(config: FlowConfig): RenderedFlow {
    const startTime = Date.now();

    const { data, options } = config;

    // Calculate node positions
    const nodePositions = this.calculateNodePositions(
      data.nodes,
      data.connections
    );

    // Calculate link paths
    const links = this.calculateLinkPaths(nodePositions, data.connections);

    // Render nodes
    const nodes = this.renderNodes(nodePositions, options);

    return {
      type: "sankey",
      data,
      options,
      nodes,
      links,
      renderTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate node positions
   */
  private calculateNodePositions(
    nodes: FlowNode[],
    connections: FlowConnection[]
  ): Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  > {
    const positions = new Map();
    const columns = this.groupNodesByColumn(nodes, connections);
    const columnWidth = 200;

    for (const [colIndex, columnNodes] of columns.entries()) {
      const columnHeight = columnNodes.reduce((sum, n) => sum + n.count, 0);
      let yOffset = 0;

      for (const node of columnNodes) {
        const nodeHeight = (node.count / columnHeight) * 500;
        const nodeWidth = 100;

        positions.set(node.id, {
          x: colIndex * columnWidth,
          y: yOffset,
          width: nodeWidth,
          height: nodeHeight,
        });

        yOffset += nodeHeight + 10;
      }
    }

    return positions;
  }

  /**
   * Group nodes by column (layer)
   */
  private groupNodesByColumn(
    nodes: FlowNode[],
    connections: FlowConnection[]
  ): FlowNode[][] {
    const layers: FlowNode[][] = [];
    const visited = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Find source nodes (no incoming connections)
    const sources = nodes.filter(
      node => !connections.some(c => c.target === node.id)
    );

    // Build layers using BFS
    const queue = [...sources];
    while (queue.length > 0) {
      const layer = [...queue];
      layers.push(layer);
      queue.length = 0;

      for (const node of layer) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        // Find outgoing connections
        const outgoing = connections.filter(c => c.source === node.id);
        for (const conn of outgoing) {
          const targetNode = nodeMap.get(conn.target);
          if (targetNode && !visited.has(targetNode.id)) {
            queue.push(targetNode);
          }
        }
      }
    }

    return layers;
  }

  /**
   * Calculate link paths
   */
  private calculateLinkPaths(
    nodePositions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    >,
    connections: FlowConnection[]
  ): Array<{
    source: { x: number; y: number };
    target: { x: number; y: number };
    value: number;
    color: string;
    opacity: number;
  }> {
    return connections.map(conn => {
      const sourcePos = nodePositions.get(conn.source);
      const targetPos = nodePositions.get(conn.target);

      if (!sourcePos || !targetPos) {
        throw new Error(
          `Node position not found for ${conn.source} or ${conn.target}`
        );
      }

      return {
        source: {
          x: sourcePos.x + sourcePos.width,
          y: sourcePos.y + sourcePos.height / 2,
        },
        target: {
          x: targetPos.x,
          y: targetPos.y + targetPos.height / 2,
        },
        value: conn.count,
        color:
          this.defaultColors[
            Math.floor(Math.random() * this.defaultColors.length)
          ],
        opacity: Math.min(1, conn.percentage / 100),
      };
    });
  }

  /**
   * Render nodes
   */
  private renderNodes(
    nodePositions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    >,
    options: FlowOptions
  ): Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    label: string;
  }> {
    const result = [];

    for (const [id, pos] of nodePositions) {
      result.push({
        id,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        color: this.defaultColors[result.length % this.defaultColors.length],
        label: id,
      });
    }

    return result;
  }

  /**
   * Get dropoff points
   */
  getDropoffPoints(data: UserFlow): FlowNode[] {
    // Find nodes with significant dropoff
    const dropoffThreshold = 0.3; // 30% dropoff

    return data.nodes.filter(node => {
      const incoming = data.connections
        .filter(c => c.target === node.id)
        .reduce((sum, c) => sum + c.count, 0);

      const outgoing = data.connections
        .filter(c => c.source === node.id)
        .reduce((sum, c) => sum + c.count, 0);

      return (
        incoming > 0 && (incoming - outgoing) / incoming > dropoffThreshold
      );
    });
  }

  /**
   * Calculate flow metrics
   */
  calculateFlowMetrics(data: UserFlow): {
    totalDropoff: number;
    averageFlowTime: number;
    criticalPath: string[];
  } {
    let totalDropoff = 0;
    let flowTimeSum = 0;
    let flowTimeCount = 0;

    for (const conn of data.connections) {
      totalDropoff += conn.percentage;
      flowTimeSum += conn.averageTime;
      flowTimeCount++;
    }

    // Find critical path (most traveled path)
    const criticalPath = this.findCriticalPath(data);

    return {
      totalDropoff,
      averageFlowTime: flowTimeCount > 0 ? flowTimeSum / flowTimeCount : 0,
      criticalPath,
    };
  }

  /**
   * Find critical path
   */
  private findCriticalPath(data: UserFlow): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    // Start from source node
    const sourceNode = data.nodes.find(
      n => !data.connections.some(c => c.target === n.id)
    );

    if (!sourceNode) return path;

    path.push(sourceNode.id);
    visited.add(sourceNode.id);

    // Follow highest value connections
    let currentNode = sourceNode;
    while (true) {
      const outgoing = data.connections
        .filter(c => c.source === currentNode.id && !visited.has(c.target))
        .sort((a, b) => b.count - a.count);

      if (outgoing.length === 0) break;

      const best = outgoing[0];
      path.push(best.target);
      visited.add(best.target);

      const nextNode = data.nodes.find(n => n.id === best.target);
      if (!nextNode) break;

      currentNode = nextNode;
    }

    return path;
  }
}
