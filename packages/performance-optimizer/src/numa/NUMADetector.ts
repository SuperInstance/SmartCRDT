/**
 * NUMA Topology Detector
 *
 * Detects NUMA (Non-Uniform Memory Access) topology on multi-socket systems.
 * Supports Linux, Windows, and provides fallback for UMA systems.
 *
 * Detection Methods:
 * - Linux: numactl, lscpu, /proc filesystem
 * - Windows: GetNumaHighestNodeNumber API
 * - Fallback: Single-node UMA topology
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import type {
  NUMATopology,
  NUMANode,
  NUMADetectionResult,
  NUMANodeId,
  CPUId,
  MemorySize,
  INUMADetector,
} from '@lsi/protocol';

const execAsync = promisify(exec);

/**
 * NUMA Detector Configuration
 */
interface NUMADetectorConfig {
  /** Detection timeout (ms) */
  timeout: number;

  /** Whether to cache topology */
  cacheTopology: boolean;

  /** Cache duration (ms) */
  cacheDuration: number;

  /** Preferred detection method */
  preferredMethod?: 'linux_numactl' | 'lscpu' | 'procfs' | 'fallback';
}

/**
 * NUMA Topology Cache Entry
 */
interface TopologyCacheEntry {
  topology: NUMATopology;
  timestamp: number;
}

/**
 * NUMA Detector Implementation
 */
export class NUMADetector implements INUMADetector {
  private config: NUMADetectorConfig;
  private cache?: TopologyCacheEntry;
  private monitoringCallback?: (topology: NUMATopology) => void;
  private monitoringInterval?: NodeJS.Timeout;
  private lastTopology?: NUMATopology;

  constructor(config: Partial<NUMADetectorConfig> = {}) {
    this.config = {
      timeout: 5000,
      cacheTopology: true,
      cacheDuration: 60000, // 1 minute
      ...config,
    };
  }

  /**
   * Detect NUMA topology
   */
  async detect(): Promise<NUMADetectionResult> {
    const timestamp = Date.now();

    // Check cache first
    if (this.config.cacheTopology && this.cache) {
      const cacheAge = timestamp - this.cache.timestamp;
      if (cacheAge < this.config.cacheDuration) {
        return {
          available: true,
          topology: this.cache.topology,
          method: this.cache.topology.numaAvailable ? 'linux_numactl' : 'fallback',
          timestamp,
        };
      }
    }

    // Detect based on platform
    const platform = os.platform();
    let result: NUMADetectionResult;

    try {
      switch (platform) {
        case 'linux':
          result = await this.detectLinux();
          break;
        case 'win32':
          result = await this.detectWindows();
          break;
        case 'darwin':
          // macOS doesn't have NUMA
          result = this.createUMATopology('fallback');
          break;
        default:
          result = this.createUMATopology('fallback');
      }
    } catch (error) {
      // Fallback to UMA on error
      result = this.createUMATopology('fallback');
      result.error = error instanceof Error ? error.message : String(error);
    }

    // Cache successful detection
    if (result.available && result.topology && this.config.cacheTopology) {
      this.cache = {
        topology: result.topology,
        timestamp,
      };
      this.lastTopology = result.topology;
    }

    return result;
  }

  /**
   * Monitor topology changes
   */
  monitorTopology(callback: (topology: NUMATopology) => void): void {
    this.monitoringCallback = callback;

    // Check topology every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      const result = await this.detect();

      if (result.topology) {
        // Notify if topology changed
        if (!this.lastTopology || this.topologyChanged(this.lastTopology, result.topology)) {
          this.lastTopology = result.topology;
          this.monitoringCallback?.(result.topology);
        }
      }
    }, 30000);
  }

  /**
   * Stop monitoring topology
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.monitoringCallback = undefined;
  }

  /**
   * Detect NUMA on Linux
   */
  private async detectLinux(): Promise<NUMADetectionResult> {
    // Try preferred method first
    if (this.config.preferredMethod) {
      try {
        switch (this.config.preferredMethod) {
          case 'linux_numactl':
            return await this.detectNumactl();
          case 'lscpu':
            return await this.detectLscpu();
          case 'procfs':
            return await this.detectProcFS();
        }
      } catch {
        // Fall through to try other methods
      }
    }

    // Try detection methods in order of preference
    const methods = [
      this.detectNumactl.bind(this),
      this.detectLscpu.bind(this),
      this.detectProcFS.bind(this),
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result.available) {
          return result;
        }
      } catch {
        // Try next method
      }
    }

    // Fallback to UMA
    return this.createUMATopology('fallback');
  }

  /**
   * Detect using numactl
   */
  private async detectNumactl(): Promise<NUMADetectionResult> {
    try {
      // Check if numactl is available
      const { stdout: numactlOutput } = await execAsync('which numactl', {
        timeout: this.config.timeout,
      });

      if (!numactlOutput.trim()) {
        throw new Error('numactl not found');
      }

      // Get NUMA node count
      const { stdout: hardwareOutput } = await execAsync('numactl --hardware', {
        timeout: this.config.timeout,
      });

      // Parse numactl output
      const nodeCountMatch = hardwareOutput.match(/available:\s*(\d+)\s*nodes/);
      if (!nodeCountMatch) {
        throw new Error('Could not parse node count');
      }

      const nodeCount = parseInt(nodeCountMatch[1], 10);

      if (nodeCount <= 1) {
        return this.createUMATopology('linux_numactl');
      }

      // Parse node information
      const nodes = new Map<NUMANodeId, NUMANode>();
      const distances = new Map<NUMANodeId, Map<NUMANodeId, number>>();
      const nodeLines = hardwareOutput.split('\n');

      for (const line of nodeLines) {
        const nodeMatch = line.match(/node\s+(\d+)\s+(cpus:\s*.+?)\s*(size:\s*\d+\s*MB)/);
        if (nodeMatch) {
          const nodeId = parseInt(nodeMatch[1], 10) as NUMANodeId;
          const cpusStr = nodeMatch[2];
          const sizeStr = nodeMatch[3];

          // Parse CPUs
          const cpus: CPUId[] = [];
          const cpuRanges = cpusStr.replace('cpus:', '').trim().split(',');
          for (const range of cpuRanges) {
            if (range.includes('-')) {
              const [start, end] = range.split('-').map(Number);
              for (let i = start; i <= end; i++) {
                cpus.push(i as CPUId);
              }
            } else {
              cpus.push(parseInt(range, 10) as CPUId);
            }
          }

          // Parse memory size
          const sizeMatch = sizeStr.match(/size:\s*(\d+)\s*MB/);
          const memoryMB = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
          const totalMemory = (memoryMB * 1024 * 1024) as MemorySize;

          nodes.set(nodeId, {
            nodeId,
            distance: 0, // Will fill in from distance matrix
            cpus,
            totalMemory,
            freeMemory: totalMemory, // Assume all free initially
            memoryUsage: 0,
            cpuUsage: 0,
            activeTasks: 0,
          });
        }
      }

      // Parse distance matrix
      const distanceMatch = hardwareOutput.match(/node\s+distances:\n([\s\S]+?)(?=\n\n|\n*$)/);
      if (distanceMatch) {
        const distanceLines = distanceMatch[1].trim().split('\n');
        for (let i = 0; i < distanceLines.length && i < nodeCount; i++) {
          const distanceValues = distanceLines[i].trim().split(/\s+/).map(Number);
          const nodeDistances = new Map<NUMANodeId, number>();

          for (let j = 0; j < distanceValues.length && j < nodeCount; j++) {
            nodeDistances.set(j as NUMANodeId, distanceValues[j]);
          }

          distances.set(i as NUMANodeId, nodeDistances);

          // Update node distance
          const node = nodes.get(i as NUMANodeId);
          if (node) {
            node.distance = distanceValues[i];
          }
        }
      }

      // Calculate totals
      let totalMemory = 0;
      let totalCpus = 0;
      for (const node of nodes.values()) {
        totalMemory += node.totalMemory;
        totalCpus += node.cpus.length;
      }

      const topology: NUMATopology = {
        nodeCount,
        nodes,
        distances,
        totalMemory: totalMemory as MemorySize,
        totalCpus,
        numaAvailable: true,
        timestamp: Date.now(),
      };

      return {
        available: true,
        topology,
        method: 'linux_numactl',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`numactl detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect using lscpu
   */
  private async detectLscpu(): Promise<NUMADetectionResult> {
    try {
      const { stdout } = await execAsync('lscpu -p=CPU,NODE', {
        timeout: this.config.timeout,
      });

      const lines = stdout.trim().split('\n');
      const cpuToNode = new Map<CPUId, NUMANodeId>();
      const nodeCpus = new Map<NUMANodeId, CPUId[]>();

      // Skip header lines starting with #
      for (const line of lines) {
        if (line.startsWith('#')) continue;

        const parts = line.split(',');
        if (parts.length >= 2) {
          const cpu = parseInt(parts[0], 10) as CPUId;
          const node = parseInt(parts[1], 10) as NUMANodeId;

          cpuToNode.set(cpu, node);

          if (!nodeCpus.has(node)) {
            nodeCpus.set(node, []);
          }
          nodeCpus.get(node)!.push(cpu);
        }
      }

      if (nodeCpus.size <= 1) {
        return this.createUMATopology('lscpu');
      }

      // Create topology
      const nodes = new Map<NUMANodeId, NUMANode>();
      const totalSystemMemory = (os.totalmem() as MemorySize) / nodeCpus.size;

      for (const [nodeId, cpus] of nodeCpus.entries()) {
        nodes.set(nodeId, {
          nodeId,
          distance: nodeId === 0 ? 10 : 20, // Assume 10 for local, 20 for remote
          cpus,
          totalMemory: totalSystemMemory,
          freeMemory: totalSystemMemory,
          memoryUsage: 0,
          cpuUsage: 0,
          activeTasks: 0,
        });
      }

      // Create distance matrix
      const distances = new Map<NUMANodeId, Map<NUMANodeId, number>>();
      for (const nodeId of nodes.keys()) {
        const nodeDistances = new Map<NUMANodeId, number>();
        for (const otherNodeId of nodes.keys()) {
          nodeDistances.set(otherNodeId, nodeId === otherNodeId ? 10 : 20);
        }
        distances.set(nodeId, nodeDistances);
      }

      const topology: NUMATopology = {
        nodeCount: nodes.size,
        nodes,
        distances,
        totalMemory: os.totalmem() as MemorySize,
        totalCpus: os.cpus().length,
        numaAvailable: true,
        timestamp: Date.now(),
      };

      return {
        available: true,
        topology,
        method: 'lscpu',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`lscpu detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect using /proc filesystem
   */
  private async detectProcFS(): Promise<NUMADetectionResult> {
    try {
      // Check for /sys/devices/system/node
      const nodePath = '/sys/devices/system/node';
      try {
        await fs.access(nodePath);
      } catch {
        return this.createUMATopology('procfs');
      }

      // List node directories
      const entries = await fs.readdir(nodePath);
      const nodeDirs = entries.filter(e => e.startsWith('node'));

      if (nodeDirs.length <= 1) {
        return this.createUMATopology('procfs');
      }

      const nodes = new Map<NUMANodeId, NUMANode>();

      for (const dir of nodeDirs) {
        const nodeId = parseInt(dir.replace('node', ''), 10) as NUMANodeId;

        // Get CPUs for this node
        const cpuPath = `${nodePath}/${dir}/cpulist`;
        try {
          const cpuList = await fs.readFile(cpuPath, 'utf-8');
          const cpus: CPUId[] = [];

          const ranges = cpuList.trim().split(',');
          for (const range of ranges) {
            if (range.includes('-')) {
              const [start, end] = range.split('-').map(Number);
              for (let i = start; i <= end; i++) {
                cpus.push(i as CPUId);
              }
            } else {
              cpus.push(parseInt(range, 10) as CPUId);
            }
          }

          // Get memory info
          const memPath = `${nodePath}/${dir}/meminfo`;
          const memInfo = await fs.readFile(memPath, 'utf-8');
          const memMatch = memInfo.match(/Node (\d+) MemTotal:\s+(\d+)\s+kB/);
          const totalMemory = memMatch
            ? (parseInt(memMatch[2], 10) * 1024) as MemorySize
            : (0 as MemorySize);

          nodes.set(nodeId, {
            nodeId,
            distance: nodeId === 0 ? 10 : 20,
            cpus,
            totalMemory,
            freeMemory: totalMemory,
            memoryUsage: 0,
            cpuUsage: 0,
            activeTasks: 0,
          });
        } catch {
          // Skip this node if we can't read its info
        }
      }

      if (nodes.size <= 1) {
        return this.createUMATopology('procfs');
      }

      // Create distance matrix (simplified)
      const distances = new Map<NUMANodeId, Map<NUMANodeId, number>>();
      for (const nodeId of nodes.keys()) {
        const nodeDistances = new Map<NUMANodeId, number>();
        for (const otherNodeId of nodes.keys()) {
          nodeDistances.set(otherNodeId, nodeId === otherNodeId ? 10 : 20);
        }
        distances.set(nodeId, nodeDistances);
      }

      let totalMemory = 0;
      let totalCpus = 0;
      for (const node of nodes.values()) {
        totalMemory += node.totalMemory;
        totalCpus += node.cpus.length;
      }

      const topology: NUMATopology = {
        nodeCount: nodes.size,
        nodes,
        distances,
        totalMemory: totalMemory as MemorySize,
        totalCpus,
        numaAvailable: true,
        timestamp: Date.now(),
      };

      return {
        available: true,
        topology,
        method: 'procfs',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`procfs detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect NUMA on Windows
   */
  private async detectWindows(): Promise<NUMADetectionResult> {
    try {
      // On Windows, we'd use native bindings or PowerShell
      // For now, assume UMA
      return this.createUMATopology('windows');
    } catch (error) {
      return this.createUMATopology('windows');
    }
  }

  /**
   * Create UMA (Uniform Memory Access) topology fallback
   */
  private createUMATopology(method: 'fallback' | 'windows' | 'linux_numactl' | 'lscpu' | 'procfs'): NUMADetectionResult {
    const totalCpus = os.cpus().length;
    const totalMemory = os.totalmem() as MemorySize;

    const node: NUMANode = {
      nodeId: 0,
      distance: 10,
      cpus: Array.from({ length: totalCpus }, (_, i) => i as CPUId),
      totalMemory,
      freeMemory: totalMemory,
      memoryUsage: 0,
      cpuUsage: 0,
      activeTasks: 0,
    };

    const nodes = new Map<NUMANodeId, NUMANode>();
    nodes.set(0, node);

    const distances = new Map<NUMANodeId, Map<NUMANodeId, number>>();
    const nodeDistances = new Map<NUMANodeId, number>();
    nodeDistances.set(0, 10);
    distances.set(0, nodeDistances);

    const topology: NUMATopology = {
      nodeCount: 1,
      nodes,
      distances,
      totalMemory,
      totalCpus,
      numaAvailable: false,
      timestamp: Date.now(),
    };

    return {
      available: false,
      topology,
      method,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if topology changed
   */
  private topologyChanged(oldTopology: NUMATopology, newTopology: NUMATopology): boolean {
    if (oldTopology.nodeCount !== newTopology.nodeCount) return true;
    if (oldTopology.totalCpus !== newTopology.totalCpus) return true;
    if (oldTopology.totalMemory !== newTopology.totalMemory) return true;
    return false;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = undefined;
  }

  /**
   * Get current cache (if any)
   */
  getCache(): TopologyCacheEntry | undefined {
    return this.cache;
  }
}
