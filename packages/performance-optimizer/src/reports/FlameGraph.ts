/**
 * Flame Graph Generator - Call stack visualization and hot path identification
 *
 * Features:
 * - Flame graph generation from call stacks
 * - Hot path identification
 * - SVG and JSON export
 * - Interactive flame graph visualization
 * - Call tree analysis
 */

/**
 * Frame in the flame graph
 */
export interface Frame {
  name: string;
  value: number; // Duration in milliseconds
  children: Frame[];
  depth: number;
  startTime: number;
  selfTime: number; // Time spent in this frame only (not children)
}

/**
 * Call stack entry
 */
export interface CallStackEntry {
  name: string;
  startTime: number;
  endTime: number;
  depth: number;
}

/**
 * Flame graph options
 */
export interface FlameGraphOptions {
  maxDepth?: number;
  minDuration?: number; // Minimum duration to include (ms)
  collapseRecursive?: boolean;
  aggregateByName?: boolean;
}

/**
 * Hot path result
 */
export interface HotPath {
  path: string[];
  totalTime: number;
  selfTime: number;
  percentage: number;
}

/**
 * Flame graph statistics
 */
export interface FlameGraphStatistics {
  totalFrames: number;
  maxDepth: number;
  totalTime: number;
  averageFrameTime: number;
  longestPath: string[];
  slowestFrame: { name: string; duration: number };
}

/**
 * Flame graph generator
 */
export class FlameGraph {
  private root: Frame;
  private options: Required<FlameGraphOptions>;

  constructor(options: FlameGraphOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 50,
      minDuration: options.minDuration ?? 0,
      collapseRecursive: options.collapseRecursive ?? true,
      aggregateByName: options.aggregateByName ?? true,
    };

    this.root = {
      name: 'root',
      value: 0,
      children: [],
      depth: 0,
      startTime: 0,
      selfTime: 0,
    };
  }

  /**
   * Add call stack to flame graph
   */
  addCallStack(stack: CallStackEntry[]): void {
    if (stack.length === 0) return;

    // Update root value
    const totalTime = stack[stack.length - 1].endTime - stack[0].startTime;
    this.root.value = Math.max(this.root.value, totalTime);
    this.root.startTime = Math.min(this.root.startTime, stack[0].startTime);

    let currentFrame = this.root;

    for (let i = 0; i < stack.length; i++) {
      const entry = stack[i];

      // Check depth limit
      if (entry.depth > this.options.maxDepth) break;

      // Check duration filter
      const duration = entry.endTime - entry.startTime;
      if (duration < this.options.minDuration) continue;

      // Find or create child frame
      let childFrame = currentFrame.children.find((f) => f.name === entry.name);

      if (!childFrame) {
        childFrame = {
          name: entry.name,
          value: duration,
          children: [],
          depth: entry.depth,
          startTime: entry.startTime,
          selfTime: 0,
        };
        currentFrame.children.push(childFrame);
      } else {
        // Aggregate by name
        if (this.options.aggregateByName) {
          childFrame.value = Math.max(childFrame.value, duration);
        }
      }

      // Collapse recursive calls
      if (this.options.collapseRecursive && childFrame.name === currentFrame.name) {
        currentFrame = currentFrame.children[currentFrame.children.length - 1];
        continue;
      }

      currentFrame = childFrame;
    }

    this.calculateSelfTimes(this.root);
  }

  /**
   * Calculate self time for all frames
   */
  private calculateSelfTimes(frame: Frame): void {
    const childrenTime = frame.children.reduce((sum, child) => sum + child.value, 0);
    frame.selfTime = frame.value - childrenTime;

    for (const child of frame.children) {
      this.calculateSelfTimes(child);
    }
  }

  /**
   * Get the flame graph tree
   */
  getTree(): Frame {
    return this.root;
  }

  /**
   * Generate SVG flame graph
   */
  generateSVG(width: number = 1200, height: number = 600): string {
    const lines: string[] = [];

    // Calculate scale
    const maxTime = this.root.value;
    const scale = width / maxTime;
    const frameHeight = 20;
    const colors = this.generateColors();

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1">');
    lines.push(`  <rect width="${width}" height="${height}" fill="#ffffff"/>`);

    // Generate frames
    this.generateSVGFrames(this.root, lines, scale, frameHeight, colors, 0);

    lines.push('</svg>');

    return lines.join('\n');
  }

  /**
   * Generate SVG frames recursively
   */
  private generateSVGFrames(
    frame: Frame,
    lines: string[],
    scale: number,
    frameHeight: number,
    colors: Map<string, string>,
    yOffset: number
  ): void {
    const x = (frame.startTime - this.root.startTime) * scale;
    const w = frame.value * scale;
    const y = yOffset + frame.depth * frameHeight;
    const color = this.getColor(frame.name, colors);

    lines.push(
      `  <rect x="${x}" y="${y}" width="${w}" height="${frameHeight}" ` +
        `fill="${color}" stroke="#ffffff" stroke-width="1">` +
        `<title>${frame.name}: ${frame.value.toFixed(2)}ms (self: ${frame.selfTime.toFixed(2)}ms)</title>` +
        `</rect>`
    );

    // Add text if wide enough
    if (w > 30) {
      const textLength = Math.floor((w - 4) / 7); // Approximate
      const displayName =
        frame.name.length > textLength ? frame.name.substring(0, textLength) + '...' : frame.name;
      lines.push(
        `  <text x="${x + 4}" y="${y + 14}" font-family="monospace" font-size="12" ` +
          `fill="#000000">${displayName}</text>`
      );
    }

    // Recursively render children
    for (const child of frame.children) {
      this.generateSVGFrames(child, lines, scale, frameHeight, colors, yOffset);
    }
  }

  /**
   * Generate colors for frames
   */
  private generateColors(): Map<string, string> {
    const colors = new Map<string, string>();
    const frameNames = this.getAllFrameNames(this.root);

    // Generate warm colors (orange, red, yellow) for flame graph
    for (let i = 0; i < frameNames.length; i++) {
      const hue = 20 + (i * 30) % 40; // Orange to yellow range
      const saturation = 70 + (i % 3) * 10;
      const lightness = 50 + (i % 5) * 5;
      colors.set(frameNames[i], `hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return colors;
  }

  /**
   * Get color for frame name
   */
  private getColor(name: string, colors: Map<string, string>): string {
    if (!colors.has(name)) {
      // Generate hash-based color
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash % 50); // Warm colors
      colors.set(name, `hsl(${hue}, 70%, 55%)`);
    }
    return colors.get(name)!;
  }

  /**
   * Get all unique frame names
   */
  private getAllFrameNames(frame: Frame): string[] {
    const names = [frame.name];
    for (const child of frame.children) {
      names.push(...this.getAllFrameNames(child));
    }
    return [...new Set(names)];
  }

  /**
   * Export flame graph as JSON
   */
  toJSON(): object {
    return {
      name: this.root.name,
      value: this.root.value,
      children: this.root.children,
    };
  }

  /**
   * Import flame graph from JSON
   */
  static fromJSON(json: any): FlameGraph {
    const graph = new FlameGraph();
    graph.root = json;
    return graph;
  }

  /**
   * Identify hot paths
   */
  identifyHotPaths(limit: number = 10): HotPath[] {
    const paths: HotPath[] = [];

    this.findHotPaths(this.root, [], paths);

    // Sort by total time
    paths.sort((a, b) => b.totalTime - a.totalTime);

    // Calculate percentages
    const totalTime = this.root.value;
    for (const path of paths) {
      path.percentage = (path.totalTime / totalTime) * 100;
    }

    return paths.slice(0, limit);
  }

  /**
   * Find hot paths recursively
   */
  private findHotPaths(
    frame: Frame,
    currentPath: string[],
    paths: HotPath[]
  ): void {
    const newPath = [...currentPath, frame.name];

    // Add path if it has significant self time
    if (frame.selfTime > 0) {
      paths.push({
        path: newPath,
        totalTime: frame.value,
        selfTime: frame.selfTime,
        percentage: 0,
      });
    }

    // Recursively process children
    for (const child of frame.children) {
      this.findHotPaths(child, newPath, paths);
    }
  }

  /**
   * Get flame graph statistics
   */
  getStatistics(): FlameGraphStatistics {
    let totalFrames = 0;
    let maxDepth = 0;
    let longestPath: string[] = [];
    let slowestFrame = { name: '', duration: 0 };

    const traverse = (frame: Frame, path: string[]) => {
      totalFrames++;
      maxDepth = Math.max(maxDepth, frame.depth);

      if (path.length > longestPath.length) {
        longestPath = path;
      }

      if (frame.value > slowestFrame.duration) {
        slowestFrame = { name: frame.name, duration: frame.value };
      }

      for (const child of frame.children) {
        traverse(child, [...path, child.name]);
      }
    };

    traverse(this.root, []);

    return {
      totalFrames,
      maxDepth,
      totalTime: this.root.value,
      averageFrameTime: this.root.value / totalFrames,
      longestPath,
      slowestFrame,
    };
  }

  /**
   * Find frames by name
   */
  findFrames(name: string): Frame[] {
    const results: Frame[] = [];

    const traverse = (frame: Frame) => {
      if (frame.name === name) {
        results.push(frame);
      }
      for (const child of frame.children) {
        traverse(child);
      }
    };

    traverse(this.root);
    return results;
  }

  /**
   * Get top frames by self time
   */
  getTopFramesBySelfTime(limit: number = 10): Array<{ name: string; selfTime: number; percentage: number }> {
    const frames: Array<{ name: string; selfTime: number }> = [];

    const traverse = (frame: Frame) => {
      if (frame.selfTime > 0) {
        frames.push({ name: frame.name, selfTime: frame.selfTime });
      }
      for (const child of frame.children) {
        traverse(child);
      }
    };

    traverse(this.root);

    // Sort by self time
    frames.sort((a, b) => b.selfTime - a.selfTime);

    // Calculate percentages
    const totalTime = this.root.value;
    return frames.slice(0, limit).map((frame) => ({
      ...frame,
      percentage: (frame.selfTime / totalTime) * 100,
    }));
  }

  /**
   * Merge multiple flame graphs
   */
  static merge(graphs: FlameGraph[]): FlameGraph {
    const merged = new FlameGraph();

    for (const graph of graphs) {
      // Merge logic would go here
      // For now, just use the first graph's data
      if (graph.root.value > merged.root.value) {
        merged.root = graph.root;
      }
    }

    return merged;
  }

  /**
   * Clear flame graph
   */
  clear(): void {
    this.root = {
      name: 'root',
      value: 0,
      children: [],
      depth: 0,
      startTime: 0,
      selfTime: 0,
    };
  }

  /**
   * Generate text-based flame graph
   */
  generateText(): string {
    const lines: string[] = [];

    this.generateTextFrame(this.root, lines, 0);

    return lines.join('\n');
  }

  /**
   * Generate text frame recursively
   */
  private generateTextFrame(frame: Frame, lines: string[], indent: number): void {
    const prefix = '  '.repeat(indent);
    const percentage = ((frame.value / this.root.value) * 100).toFixed(1);

    lines.push(
      `${prefix}${frame.name} (${frame.value.toFixed(2)}ms, ${percentage}%, self: ${frame.selfTime.toFixed(2)}ms)`
    );

    // Sort children by value
    const sortedChildren = [...frame.children].sort((a, b) => b.value - a.value);

    for (const child of sortedChildren) {
      this.generateTextFrame(child, lines, indent + 1);
    }
  }
}

/**
 * Flame graph builder utility
 */
export class FlameGraphBuilder {
  private callStacks: CallStackEntry[][] = [];
  private stack: CallStackEntry[] = [];
  private graph = new FlameGraph();

  /**
   * Start a new frame
   */
  startFrame(name: string): void {
    this.stack.push({
      name,
      startTime: performance.now(),
      endTime: 0,
      depth: this.stack.length,
    });
  }

  /**
   * End the current frame
   */
  endFrame(): void {
    if (this.stack.length === 0) return;

    const frame = this.stack.pop();
    if (frame) {
      frame.endTime = performance.now();

      if (this.stack.length === 0) {
        // This is a root-level frame, add to call stacks
        this.callStacks.push([frame]);
        this.graph.addCallStack([frame]);
      } else {
        // Add to parent stack
        // In a real implementation, you'd track the full call stack
      }
    }
  }

  /**
   * Execute a function with profiling
   */
  async profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startFrame(name);
    try {
      return await fn();
    } finally {
      this.endFrame();
    }
  }

  /**
   * Execute a synchronous function with profiling
   */
  profileSync<T>(name: string, fn: () => T): T {
    this.startFrame(name);
    try {
      return fn();
    } finally {
      this.endFrame();
    }
  }

  /**
   * Get the flame graph
   */
  getGraph(): FlameGraph {
    return this.graph;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.callStacks = [];
    this.stack = [];
    this.graph.clear();
  }
}

/**
 * Decorator for profiling functions
 */
export function Profile(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = performance.now();

    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;

      // In a real implementation, you'd add this to a flame graph
      console.log(`${propertyKey} took ${duration.toFixed(2)}ms`);

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${propertyKey} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  };

  return descriptor;
}
