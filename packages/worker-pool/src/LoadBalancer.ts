/**
 * Load Balancer
 *
 * Distributes requests across workers using various strategies
 * including round-robin, least-connections, and least-latency.
 */

import type {
  Worker,
  WorkerMetrics,
  LoadBalancingStrategy,
  WorkerState,
} from "./types.js";
import { WorkerLifecycle } from "./WorkerLifecycle.js";

/**
 * Load balancer for distributing work across workers
 */
export class LoadBalancer {
  private lifecycle: WorkerLifecycle;
  private strategy: LoadBalancingStrategy;
  private roundRobinIndex: number;
  private affinityMap: Map<string, string>; // Request key -> worker ID
  private backpressureEnabled: boolean;
  private maxConnectionsPerWorker: number;

  /**
   * Create a new load balancer
   */
  constructor(
    lifecycle: WorkerLifecycle,
    strategy: LoadBalancingStrategy = "least-connections",
    options: {
      enableBackpressure?: boolean;
      maxConnectionsPerWorker?: number;
    } = {}
  ) {
    this.lifecycle = lifecycle;
    this.strategy = strategy;
    this.roundRobinIndex = 0;
    this.affinityMap = new Map();
    this.backpressureEnabled = options.enableBackpressure !== false;
    this.maxConnectionsPerWorker = options.maxConnectionsPerWorker || 100;
  }

  /**
   * Select a worker for a request
   */
  selectWorker(requestKey?: string): Worker | null {
    const workers = this.lifecycle.getWorkersByState("idle");

    if (workers.length === 0) {
      return null;
    }

    // Check affinity first
    if (requestKey) {
      const affinityWorkerId = this.affinityMap.get(requestKey);
      if (affinityWorkerId) {
        const worker = this.lifecycle.getWorker(affinityWorkerId);
        if (
          worker &&
          this.lifecycle.getWorkerState(affinityWorkerId) === "idle"
        ) {
          return worker;
        }
      }
    }

    // Apply backpressure check
    if (this.backpressureEnabled) {
      workers.sort((a, b) => {
        const metricsA = this.getWorkerMetrics(a);
        const metricsB = this.getWorkerMetrics(b);

        return (
          (metricsA?.activeConnections || 0) -
          (metricsB?.activeConnections || 0)
        );
      });

      // Filter out workers at max capacity
      const availableWorkers = workers.filter(w => {
        const metrics = this.getWorkerMetrics(w);
        return (metrics?.activeConnections || 0) < this.maxConnectionsPerWorker;
      });

      if (availableWorkers.length === 0) {
        return null; // Backpressure: all workers at capacity
      }
    }

    // Select based on strategy
    switch (this.strategy) {
      case "round-robin":
        return this.selectRoundRobin(workers);

      case "least-connections":
        return this.selectLeastConnections(workers);

      case "least-latency":
        return this.selectLeastLatency(workers);

      default:
        return workers[0];
    }
  }

  /**
   * Select multiple workers for a request
   */
  selectWorkers(count: number, requestKey?: string): Worker[] {
    const selected: Worker[] = [];

    for (let i = 0; i < count; i++) {
      const worker = this.selectWorker(requestKey);
      if (!worker) {
        break;
      }
      selected.push(worker);
    }

    return selected;
  }

  /**
   * Set affinity for a request key to a specific worker
   */
  setAffinity(requestKey: string, workerId: string): void {
    this.affinityMap.set(requestKey, workerId);
  }

  /**
   * Remove affinity for a request key
   */
  removeAffinity(requestKey: string): void {
    this.affinityMap.delete(requestKey);
  }

  /**
   * Clear all affinities
   */
  clearAffinity(): void {
    this.affinityMap.clear();
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this.strategy;
  }

  /**
   * Enable or disable backpressure
   */
  setBackpressureEnabled(enabled: boolean): void {
    this.backpressureEnabled = enabled;
  }

  /**
   * Set max connections per worker
   */
  setMaxConnectionsPerWorker(max: number): void {
    this.maxConnectionsPerWorker = max;
  }

  /**
   * Check if a worker is at capacity
   */
  isWorkerAtCapacity(workerId: string): boolean {
    const metrics = this.lifecycle.getWorkerMetrics(workerId);
    if (!metrics) {
      return true;
    }

    return metrics.activeConnections >= this.maxConnectionsPerWorker;
  }

  /**
   * Get available worker count
   */
  getAvailableWorkerCount(): number {
    return this.lifecycle.getWorkersByState("idle").length;
  }

  /**
   * Get total worker count
   */
  getTotalWorkerCount(): number {
    return this.lifecycle.getWorkerCount();
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(workers: Worker[]): Worker {
    const worker = workers[this.roundRobinIndex % workers.length];
    this.roundRobinIndex++;
    return worker;
  }

  /**
   * Least-connections selection
   */
  private selectLeastConnections(workers: Worker[]): Worker {
    let selected = workers[0];
    let minConnections = Infinity;

    for (const worker of workers) {
      const metrics = this.getWorkerMetrics(worker);
      const connections = metrics?.activeConnections || 0;

      if (connections < minConnections) {
        minConnections = connections;
        selected = worker;
      }
    }

    return selected;
  }

  /**
   * Least-latency selection
   */
  private selectLeastLatency(workers: Worker[]): Worker {
    let selected = workers[0];
    let minLatency = Infinity;

    for (const worker of workers) {
      const metrics = this.getWorkerMetrics(worker);
      const latency = metrics?.avgLatency || Infinity;

      // Also consider connection count as a tiebreaker
      const connections = metrics?.activeConnections || 0;
      const score = latency + connections * 10;

      if (score < minLatency) {
        minLatency = score;
        selected = worker;
      }
    }

    return selected;
  }

  /**
   * Get worker metrics helper
   */
  private getWorkerMetrics(worker: Worker): WorkerMetrics | null {
    // Try to get worker ID from the worker object
    // This is a simplified approach - real implementation would track this better
    const allMetrics = this.lifecycle.getAllWorkerMetrics();

    for (const metrics of allMetrics) {
      const w = this.lifecycle.getWorker(metrics.workerId);
      if (w === worker) {
        return metrics;
      }
    }

    return null;
  }

  /**
   * Get load balancer statistics
   */
  getStats(): {
    strategy: LoadBalancingStrategy;
    availableWorkers: number;
    totalWorkers: number;
    backpressureEnabled: boolean;
    maxConnectionsPerWorker: number;
    affinityCount: number;
  } {
    return {
      strategy: this.strategy,
      availableWorkers: this.getAvailableWorkerCount(),
      totalWorkers: this.getTotalWorkerCount(),
      backpressureEnabled: this.backpressureEnabled,
      maxConnectionsPerWorker: this.maxConnectionsPerWorker,
      affinityCount: this.affinityMap.size,
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.affinityMap.clear();
    this.roundRobinIndex = 0;
  }
}
