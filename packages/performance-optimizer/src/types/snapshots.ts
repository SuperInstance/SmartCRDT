/**
 * Snapshot types for performance profiling
 */

export interface MemorySnapshot {
  /** Timestamp of the snapshot */
  timestamp: number;
  /** Heap memory used in MB */
  heapUsed: number;
  /** Heap memory total allocated in MB */
  heapTotal: number;
  /** External memory in MB */
  external: number;
  /** RSS memory in MB */
  rss: number;
  /** Node.js version */
  nodeVersion: string;
  /** Process uptime in seconds */
  uptime: number;
  /** Operation name */
  operationName: string;
}

export interface CpuSnapshot {
  /** Timestamp of the snapshot */
  timestamp: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** User CPU time in seconds */
  userCpu: number;
  /** System CPU time in seconds */
  systemCpu: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Operation name */
  operationName: string;
  /** System load average */
  loadAverage: number[];
  /** Process uptime in seconds */
  uptime: number;
}

export interface LatencySnapshot {
  /** Timestamp of the measurement */
  timestamp: number;
  /** Total latency in milliseconds */
  latency: number;
  /** Breakdown of latency components */
  breakdown?: {
    queue?: number;
    processing?: number;
    io?: number;
    network?: number;
  };
  /** Operation name */
  operationName: string;
}