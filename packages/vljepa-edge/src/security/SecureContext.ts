/**
 * @fileoverview Security Module for VL-JEPA Edge Deployment
 *
 * Provides security utilities for safe on-device inference:
 * - Secure context validation (HTTPS)
 * - Sandbox execution
 * - Data isolation and partitioning
 * - Origin validation
 *
 * @package @lsi/vljepa-edge
 */

import type { SecureContextConfig, SandboxConfig } from "../types.js";
import { SecurityError } from "../types.js";

/**
 * Secure Context Manager for VL-JEPA edge deployment
 *
 * Validates and enforces security policies for on-device inference.
 */
export class SecureContextManager {
  private config: SecureContextConfig;
  private allowedOrigins: Set<string>;

  constructor(config: SecureContextConfig) {
    this.config = config;
    this.allowedOrigins = new Set(config.allowedOrigins);
  }

  /**
   * Validate secure context
   */
  validateSecureContext(): boolean {
    // Check if running in secure context (HTTPS or localhost)
    if (this.config.requireHTTPS && !this.isSecureContext()) {
      throw new SecurityError("Insecure context detected. HTTPS is required.");
    }

    // Validate origin if enabled
    if (this.config.validateOrigins) {
      this.validateOrigin();
    }

    return true;
  }

  /**
   * Check if current context is secure
   */
  isSecureContext(): boolean {
    return window.isSecureContext;
  }

  /**
   * Validate origin
   */
  validateOrigin(): void {
    const origin = window.location.origin;

    if (!this.isOriginAllowed(origin)) {
      throw new SecurityError(`Origin "${origin}" is not allowed.`);
    }
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    // Check exact matches
    if (this.allowedOrigins.has(origin)) {
      return true;
    }

    // Check wildcard patterns
    for (const allowed of this.allowedOrigins) {
      if (allowed.includes("*")) {
        const pattern = allowed.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(origin)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin: string): void {
    this.allowedOrigins.add(origin);
  }

  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin: string): void {
    this.allowedOrigins.delete(origin);
  }

  /**
   * Get allowed origins
   */
  getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }

  /**
   * Get CSP header value
   */
  getCSPHeader(): string | undefined {
    return this.config.contentSecurityPolicy;
  }
}

/**
 * Sandbox for isolated model execution
 *
 * Provides sandboxed execution environment for model inference.
 */
export class Sandbox {
  private config: SandboxConfig;
  private sandboxedWorkers: Map<string, Worker> = new Map();
  private dataPartitions: Map<string, Map<string, unknown>> = new Map();

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  /**
   * Execute code in sandbox
   */
  async execute<T>(
    code: string,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      throw new SecurityError("Sandbox is disabled");
    }

    // Create isolated worker
    const worker = await this.createSandboxedWorker();
    const workerId = crypto.randomUUID();

    try {
      this.sandboxedWorkers.set(workerId, worker);

      // Execute code in worker
      const result = await this.executeInWorker<T>(worker, code, context);

      return result;
    } finally {
      // Clean up worker
      worker.terminate();
      this.sandboxedWorkers.delete(workerId);
    }
  }

  /**
   * Create sandboxed worker
   */
  private async createSandboxedWorker(): Promise<Worker> {
    // Create worker with restricted capabilities
    const workerCode = `
      "use strict";
      self.onmessage = async (e) => {
        const { code, context, id } = e.data;

        try {
          // Create isolated context
          const sandbox = Object.create(null);
          Object.assign(sandbox, context);

          // Execute code with restricted access
          const fn = new Function(...Object.keys(context), code);
          const result = fn(...Object.values(context));

          self.postMessage({ id, result });
        } catch (error) {
          self.postMessage({ id, error: error.message });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    const worker = new Worker(workerUrl, {
      type: "module",
    });

    return worker;
  }

  /**
   * Execute code in worker
   */
  private async executeInWorker<T>(
    worker: Worker,
    code: string,
    context: Record<string, unknown>
  ): Promise<T> {
    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new SecurityError("Sandbox execution timeout"));
      }, this.config.cpuLimit);

      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);

          if (e.data.error) {
            reject(new SecurityError(e.data.error));
          } else {
            resolve(e.data.result as T);
          }
        }
      };

      worker.addEventListener("message", handler);
      worker.postMessage({ id, code, context });
    });
  }

  /**
   * Create data partition for isolation
   */
  createPartition(partitionId: string): void {
    if (!this.dataPartitions.has(partitionId)) {
      this.dataPartitions.set(partitionId, new Map());
    }
  }

  /**
   * Store data in partition
   */
  storeInPartition(partitionId: string, key: string, value: unknown): void {
    const partition = this.dataPartitions.get(partitionId);
    if (!partition) {
      throw new SecurityError(`Partition "${partitionId}" does not exist`);
    }
    partition.set(key, value);
  }

  /**
   * Get data from partition
   */
  getFromPartition(partitionId: string, key: string): unknown {
    const partition = this.dataPartitions.get(partitionId);
    if (!partition) {
      throw new SecurityError(`Partition "${partitionId}" does not exist`);
    }
    return partition.get(key);
  }

  /**
   * Delete partition
   */
  deletePartition(partitionId: string): void {
    this.dataPartitions.delete(partitionId);
  }

  /**
   * Clear all partitions
   */
  clearAllPartitions(): void {
    this.dataPartitions.clear();
  }

  /**
   * Dispose of sandbox resources
   */
  dispose(): void {
    for (const worker of this.sandboxedWorkers.values()) {
      worker.terminate();
    }
    this.sandboxedWorkers.clear();
    this.dataPartitions.clear();
  }
}

/**
 * Data Partitioning for isolation
 *
 * Provides data isolation between different contexts.
 */
export class DataPartitioning {
  private partitions: Map<string, Map<string, unknown>> = new Map();
  private currentPartition: string | null = null;

  /**
   * Create a new partition
   */
  createPartition(partitionId: string): void {
    if (!this.partitions.has(partitionId)) {
      this.partitions.set(partitionId, new Map());
    }
  }

  /**
   * Set current partition
   */
  setCurrentPartition(partitionId: string): void {
    if (!this.partitions.has(partitionId)) {
      throw new SecurityError(`Partition "${partitionId}" does not exist`);
    }
    this.currentPartition = partitionId;
  }

  /**
   * Get current partition
   */
  getCurrentPartition(): string | null {
    return this.currentPartition;
  }

  /**
   * Store data in current partition
   */
  set(key: string, value: unknown): void {
    if (!this.currentPartition) {
      throw new SecurityError("No partition selected");
    }
    const partition = this.partitions.get(this.currentPartition)!;
    partition.set(key, value);
  }

  /**
   * Get data from current partition
   */
  get(key: string): unknown {
    if (!this.currentPartition) {
      throw new SecurityError("No partition selected");
    }
    const partition = this.partitions.get(this.currentPartition)!;
    return partition.get(key);
  }

  /**
   * Check if key exists in current partition
   */
  has(key: string): boolean {
    if (!this.currentPartition) {
      return false;
    }
    const partition = this.partitions.get(this.currentPartition)!;
    return partition.has(key);
  }

  /**
   * Delete key from current partition
   */
  delete(key: string): void {
    if (!this.currentPartition) {
      return;
    }
    const partition = this.partitions.get(this.currentPartition)!;
    partition.delete(key);
  }

  /**
   * Clear current partition
   */
  clear(): void {
    if (!this.currentPartition) {
      return;
    }
    const partition = this.partitions.get(this.currentPartition)!;
    partition.clear();
  }

  /**
   * Delete partition
   */
  deletePartition(partitionId: string): void {
    this.partitions.delete(partitionId);
    if (this.currentPartition === partitionId) {
      this.currentPartition = null;
    }
  }

  /**
   * Get all partition IDs
   */
  getPartitionIds(): string[] {
    return Array.from(this.partitions.keys());
  }

  /**
   * Get partition size
   */
  getPartitionSize(partitionId?: string): number {
    const id = partitionId || this.currentPartition;
    if (!id) {
      return 0;
    }
    const partition = this.partitions.get(id);
    return partition ? partition.size : 0;
  }
}

/**
 * Create a secure context manager
 */
export function createSecureContextManager(
  config: SecureContextConfig
): SecureContextManager {
  return new SecureContextManager(config);
}

/**
 * Create a sandbox
 */
export function createSandbox(config: SandboxConfig): Sandbox {
  return new Sandbox(config);
}

/**
 * Create data partitioning
 */
export function createDataPartitioning(): DataPartitioning {
  return new DataPartitioning();
}

/**
 * Default secure context configuration
 */
export function getDefaultSecureContextConfig(): SecureContextConfig {
  return {
    requireHTTPS: true,
    allowedOrigins: ["https://localhost:*", "https://127.0.0.1:*"],
    validateOrigins: false,
    contentSecurityPolicy: undefined,
  };
}

/**
 * Default sandbox configuration
 */
export function getDefaultSandboxConfig(): SandboxConfig {
  return {
    enabled: true,
    memoryLimit: 256, // 256MB
    cpuLimit: 5000, // 5 seconds
    allowedOps: ["inference", "embedding"],
    blockedDomains: [],
    isolateWorkers: true,
  };
}
