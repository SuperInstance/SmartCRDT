/**
 * NUMA Topology Detection
 *
 * Detects NUMA (Non-Uniform Memory Access) topology on multi-socket systems.
 * Reads from /sys/devices/system/node/ on Linux, falls back to lscpu or mock.
 *
 * NUMA awareness is critical for:
 * - Memory locality optimization
 * - CPU placement decisions
 * - Cross-node traffic reduction
 * - Load balancing across nodes
 *
 * @module hardware/NUMATopology
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Represents a single NUMA node
 */
export interface NUMANode {
  /** Node identifier (0-based) */
  nodeId: number;

  /** CPU IDs belonging to this node */
  cpus: number[];

  /** Memory information for this node */
  memory: {
    /** Total memory in bytes */
    total: number;
    /** Free memory in bytes */
    free: number;
    /** Used memory in bytes */
    used: number;
  };

  /** Distance to other nodes (normalized 10-20) */
  distances: number[];

  /** CPUs that are local to this node */
  localCPUs: number[];

  /** Optional: GPU IDs local to this node */
  localGPUs?: number[];
}

/**
 * Complete NUMA topology of the system
 */
export interface NUMATopology {
  /** Total number of NUMA nodes */
  numNodes: number;

  /** All NUMA nodes */
  nodes: NUMANode[];

  /** Total CPU count across all nodes */
  totalCPUs: number;

  /** Total memory across all nodes in bytes */
  totalMemory: number;

  /** Topology type */
  type: "UMA" | "NUMA";

  /**
   * Get CPUs for a specific node
   * @param nodeId Node identifier
   * @returns Array of CPU IDs
   */
  getCPUs(nodeId: number): number[];

  /**
   * Get preferred node for a CPU
   * @param cpuId CPU identifier
   * @returns Node ID or -1 if not found
   */
  getPreferredNode(cpuId: number): number;

  /**
   * Get distance between two nodes
   * @param fromNode Source node ID
   * @param toNode Destination node ID
   * @returns Distance (10 = local, 20 = remote)
   */
  getDistance(fromNode: number, toNode: number): number;
}

/**
 * NUMA statistics and performance metrics
 */
export interface NUMAStats {
  /** Per-node statistics */
  nodeStats: {
    /** Node identifier */
    nodeId: number;
    /** Memory usage ratio (0-1) */
    memoryUsage: number;
    /** CPU usage ratio (0-1) */
    cpuUsage: number;
    /** Ratio of local memory accesses (0-1) */
    localAccessRatio: number;
  }[];

  /** Cross-node traffic in bytes/second */
  crossNodeTraffic: number;

  /** Average local access ratio across all nodes */
  avgLocalAccessRatio: number;

  /** Load balance score (0-1, higher is better) */
  loadBalanceScore: number;
}

/**
 * NUMA topology detector
 *
 * Automatically detects NUMA topology using:
 * 1. /sys/devices/system/node/ (Linux, most accurate)
 * 2. lscpu command (Linux fallback)
 * 3. Mock topology (non-Linux or detection failure)
 */
export class NUMATopologyDetector {
  private cachedTopology: NUMATopology | null = null;
  private cacheExpiry: number | null = null;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Detect NUMA topology
   * @returns Promise<NUMATopology> Detected topology
   */
  async detect(): Promise<NUMATopology> {
    // Check cache
    if (
      this.cachedTopology &&
      this.cacheExpiry &&
      Date.now() < this.cacheExpiry
    ) {
      return this.cachedTopology;
    }

    let topology: NUMATopology;

    // Try detection methods in order
    if (process.platform === "linux") {
      try {
        topology = await this.detectLinux();
      } catch (error) {
        console.warn("Linux NUMA detection failed, trying lscpu:", error);
        try {
          topology = await this.detectUsingLscpu();
        } catch (lscpuError) {
          console.warn("lscpu detection failed, using mock:", lscpuError);
          topology = await this.detectMock();
        }
      }
    } else {
      topology = await this.detectMock();
    }

    // Cache the result
    this.cachedTopology = topology;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return topology;
  }

  /**
   * Detect NUMA topology from /sys/devices/system/node/
   * @returns Promise<NUMATopology> Linux-detected topology
   */
  private async detectLinux(): Promise<NUMATopology> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const basePath = "/sys/devices/system/node";
    const nodes: NUMANode[] = [];

    try {
      // List all node directories (node0, node1, etc.)
      const entries = await fs.readdir(basePath);
      const nodeDirs = entries.filter(
        e => e.startsWith("node") && e.length > 4
      );

      if (nodeDirs.length === 0) {
        // No NUMA nodes detected, assume UMA
        return this.createUMATopology();
      }

      for (const nodeDir of nodeDirs) {
        const nodeId = parseInt(nodeDir.substring(4), 10);
        const nodePath = path.join(basePath, nodeDir);

        // Read CPUs for this node
        const cpus = await this.readNodeCPUs(nodePath);

        // Read memory info
        const memory = await this.readNodeMemory(nodePath);

        // Read distance info
        const distances = await this.readNodeDistances(
          nodePath,
          nodeId,
          nodeDirs.length
        );

        nodes.push({
          nodeId,
          cpus,
          memory,
          distances,
          localCPUs: cpus,
        });
      }

      // Calculate distance matrix
      const distanceMatrix = this.calculateDistances(nodes);

      // Update nodes with accurate distances
      nodes.forEach((node, i) => {
        node.distances = distanceMatrix[i];
      });

      return this.createTopologyObject(nodes, "NUMA");
    } catch (error) {
      console.error("Error reading NUMA topology from /sys:", error);
      throw error;
    }
  }

  /**
   * Read CPU list for a node from /sys
   * @param nodePath Path to node directory
   * @returns Array of CPU IDs
   */
  private async readNodeCPUs(nodePath: string): Promise<number[]> {
    const fs = await import("fs/promises");

    try {
      const cpumapPath = `${nodePath}/cpumap`;
      const cpulistPath = `${nodePath}/cpulist`;

      // Try cpulist first (more readable)
      try {
        const content = await fs.readFile(cpulistPath, "utf-8");
        return this.parseCPUList(content.trim());
      } catch {
        // Fall back to cpumap (hex bitmap)
        const content = await fs.readFile(cpumapPath, "utf-8");
        return this.parseCPUMap(content.trim());
      }
    } catch (error) {
      console.warn(`Could not read CPUs for ${nodePath}:`, error);
      return [];
    }
  }

  /**
   * Parse CPU list format (e.g., "0-7,16-23")
   * @param content CPU list string
   * @returns Array of CPU IDs
   */
  private parseCPUList(content: string): number[] {
    const cpus: number[] = [];
    const ranges = content.split(",");

    for (const range of ranges) {
      const parts = range.trim().split("-");
      if (parts.length === 1) {
        cpus.push(parseInt(parts[0], 10));
      } else if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        for (let i = start; i <= end; i++) {
          cpus.push(i);
        }
      }
    }

    return cpus.sort((a, b) => a - b);
  }

  /**
   * Parse CPU bitmap format (hexadecimal)
   * @param content Hex bitmap string
   * @returns Array of CPU IDs
   */
  private parseCPUMap(content: string): number[] {
    const cpus: number[][] = [[]];
    let hexIndex = 0;

    // Parse hex string in reverse (little-endian)
    for (let i = content.length - 1; i >= 0; i--) {
      const char = content[i];
      const value = parseInt(char, 16);

      for (let bit = 0; bit < 4; bit++) {
        const cpuId = hexIndex * 4 + bit;
        if (value & (1 << bit)) {
          // Find which array to add to
          while (cpus.length <= Math.floor(cpuId / 64)) {
            cpus.push([]);
          }
          cpus[Math.floor(cpuId / 64)].push(cpuId % 64);
        }
      }
      hexIndex++;
    }

    // Flatten and return
    return cpus.flat().sort((a, b) => a - b);
  }

  /**
   * Read memory info for a node
   * @param nodePath Path to node directory
   * @returns Memory statistics
   */
  private async readNodeMemory(nodePath: string): Promise<{
    total: number;
    free: number;
    used: number;
  }> {
    const fs = await import("fs/promises");

    try {
      const meminfoPath = `${nodePath}/meminfo`;
      const content = await fs.readFile(meminfoPath, "utf-8");

      const lines = content.split("\n");
      const info: Record<string, number> = {};

      for (const line of lines) {
        const match = line.match(/(\w+):\s+(\d+)\s+(\w+)/);
        if (match) {
          const [, key, value, unit] = match;
          let numValue = parseInt(value, 10);
          if (unit === "kB") {
            numValue *= 1024;
          }
          info[key] = numValue;
        }
      }

      const total = info["MemTotal"] || 0;
      const free = info["MemFree"] || 0;
      const used = total - free;

      return { total, free, used };
    } catch (error) {
      console.warn(`Could not read memory for ${nodePath}:`, error);
      return { total: 0, free: 0, used: 0 };
    }
  }

  /**
   * Read distance info for a node
   * @param nodePath Path to node directory
   * @param nodeId Current node ID
   * @param numNodes Total number of nodes
   * @returns Array of distances to all nodes
   */
  private async readNodeDistances(
    nodePath: string,
    nodeId: number,
    numNodes: number
  ): Promise<number[]> {
    const fs = await import("fs/promises");

    try {
      const distancePath = `${nodePath}/distance`;
      const content = await fs.readFile(distancePath, "utf-8");

      const distances = content
        .trim()
        .split(/\s+/)
        .map(d => parseInt(d, 10));
      return distances;
    } catch (error) {
      // Default distances: 10 for local, 20 for remote
      const distances: number[] = [];
      for (let i = 0; i < numNodes; i++) {
        distances.push(i === nodeId ? 10 : 20);
      }
      return distances;
    }
  }

  /**
   * Calculate distance matrix between all nodes
   * @param nodes NUMA nodes
   * @returns Distance matrix
   */
  private calculateDistances(nodes: NUMANode[]): number[][] {
    const numNodes = nodes.length;
    const matrix: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      matrix[i] = [];
      for (let j = 0; j < numNodes; j++) {
        if (i === j) {
          matrix[i][j] = 10; // Local
        } else if (nodes[i].distances[j] !== undefined) {
          matrix[i][j] = nodes[i].distances[j];
        } else {
          matrix[i][j] = 20; // Remote default
        }
      }
    }

    return matrix;
  }

  /**
   * Detect NUMA topology using lscpu command
   * @returns Promise<NUMATopology> lscpu-detected topology
   */
  private async detectUsingLscpu(): Promise<NUMATopology> {
    try {
      const { stdout } = await execAsync("lscpu -p=CPU,NODE");
      const lines = stdout.trim().split("\n");

      const nodeCPUs: Map<number, number[]> = new Map();

      for (const line of lines) {
        if (line.startsWith("#")) continue;

        const parts = line.split(",");
        if (parts.length >= 2) {
          const cpuId = parseInt(parts[0], 10);
          const nodeId = parseInt(parts[1], 10);

          if (!isNaN(cpuId) && !isNaN(nodeId)) {
            if (!nodeCPUs.has(nodeId)) {
              nodeCPUs.set(nodeId, []);
            }
            nodeCPUs.get(nodeId)!.push(cpuId);
          }
        }
      }

      if (nodeCPUs.size === 0) {
        return this.createUMATopology();
      }

      // Create nodes from CPU mapping
      const nodes: NUMANode[] = [];
      const numNodes = nodeCPUs.size;

      for (const [nodeId, cpus] of nodeCPUs.entries()) {
        // Estimate memory (assume equal distribution)
        const os = await import("os");
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        const distances: number[] = [];
        for (let i = 0; i < numNodes; i++) {
          distances.push(i === nodeId ? 10 : 20);
        }

        nodes.push({
          nodeId,
          cpus: cpus.sort((a, b) => a - b),
          memory: {
            total: Math.floor(totalMem / numNodes),
            free: Math.floor(freeMem / numNodes),
            used: Math.floor((totalMem - freeMem) / numNodes),
          },
          distances,
          localCPUs: cpus,
        });
      }

      return this.createTopologyObject(nodes, "NUMA");
    } catch (error) {
      console.error("lscpu detection failed:", error);
      throw error;
    }
  }

  /**
   * Create a mock UMA topology for non-Linux systems
   * @returns Promise<NUMATopology> Mock UMA topology
   */
  private async detectMock(): Promise<NUMATopology> {
    return this.createUMATopology();
  }

  /**
   * Create UMA (Uniform Memory Access) topology
   * Single-node system
   * @returns UMA topology
   */
  private createUMATopology(): NUMATopology {
    const os = require("os");
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const node: NUMANode = {
      nodeId: 0,
      cpus: cpus.map((_: any, i: number) => i),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
      },
      distances: [10],
      localCPUs: cpus.map((_: any, i: number) => i),
    };

    return this.createTopologyObject([node], "UMA");
  }

  /**
   * Create NUMATopology object from nodes
   * @param nodes NUMA nodes
   * @param type Topology type
   * @returns NUMATopology object
   */
  private createTopologyObject(
    nodes: NUMANode[],
    type: "UMA" | "NUMA"
  ): NUMATopology {
    const totalCPUs = nodes.reduce((sum, node) => sum + node.cpus.length, 0);
    const totalMemory = nodes.reduce((sum, node) => sum + node.memory.total, 0);

    // Create CPU-to-node mapping
    const cpuToNode = new Map<number, number>();
    nodes.forEach(node => {
      node.cpus.forEach(cpu => {
        cpuToNode.set(cpu, node.nodeId);
      });
    });

    return {
      numNodes: nodes.length,
      nodes,
      totalCPUs,
      totalMemory,
      type,

      getCPUs(nodeId: number): number[] {
        const node = this.nodes.find(n => n.nodeId === nodeId);
        return node ? node.cpus : [];
      },

      getPreferredNode(cpuId: number): number {
        return cpuToNode.get(cpuId) ?? -1;
      },

      getDistance(fromNode: number, toNode: number): number {
        if (fromNode < 0 || fromNode >= this.numNodes) return 20;
        if (toNode < 0 || toNode >= this.numNodes) return 20;

        const fromNodeObj = this.nodes[fromNode];
        return fromNodeObj?.distances[toNode] ?? 20;
      },
    };
  }

  /**
   * Clear cached topology
   */
  clearCache(): void {
    this.cachedTopology = null;
    this.cacheExpiry = null;
  }
}

/**
 * Get NUMA statistics from topology
 * @param topology NUMA topology
 * @returns NUMA statistics
 */
export function getNUMAStats(topology: NUMATopology): NUMAStats {
  const nodeStats = topology.nodes.map(node => ({
    nodeId: node.nodeId,
    memoryUsage:
      node.memory.total > 0 ? node.memory.used / node.memory.total : 0,
    cpuUsage: 0, // Would need real-time monitoring
    localAccessRatio: 1.0, // Assume perfect locality
  }));

  // For single-node systems, load balance is always perfect
  if (topology.numNodes === 1) {
    return {
      nodeStats,
      crossNodeTraffic: 0,
      avgLocalAccessRatio: 1.0,
      loadBalanceScore: 1.0,
    };
  }

  const avgMemoryUsage =
    nodeStats.reduce((sum, stat) => sum + stat.memoryUsage, 0) /
    nodeStats.length;

  // Calculate load balance score (1 = perfectly balanced, 0 = completely imbalanced)
  // For multi-node systems, balance is based on even distribution of memory usage
  const variance =
    nodeStats.reduce(
      (sum, stat) => sum + Math.pow(stat.memoryUsage - avgMemoryUsage, 2),
      0
    ) / nodeStats.length;

  const cv = avgMemoryUsage > 0 ? Math.sqrt(variance) / avgMemoryUsage : 0;
  const loadBalanceScore = Math.max(0, 1 - cv);

  return {
    nodeStats,
    crossNodeTraffic: 0,
    avgLocalAccessRatio: 1.0,
    loadBalanceScore,
  };
}

/**
 * Create a singleton NUMA topology detector instance
 */
export const numaTopologyDetector = new NUMATopologyDetector();
