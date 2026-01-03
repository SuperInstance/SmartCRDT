/**
 * @lsi/swarm/rollback - Rollback Executor
 *
 * Executes rollback operations on distributed nodes with support for
 * immediate, graceful, and scheduled rollback strategies.
 *
 * @module RollbackExecutor
 */

import type {
  Node,
  NodeResult,
  RollbackRequest,
  RollbackResponse,
  RollbackStrategy,
} from "@lsi/protocol";

/**
 * Connection state for graceful draining
 */
export interface ConnectionState {
  nodeId: string;
  activeConnections: number;
  draining: boolean;
  drainStartTime: number;
}

/**
 * Rollback execution options
 */
export interface RollbackExecutionOptions {
  /** Maximum time to wait for graceful drain (ms) */
  drainTimeout?: number;
  /** Timeout for individual node operations (ms) */
  nodeTimeout?: number;
  /** Maximum concurrent node operations */
  concurrency?: number;
  /** Callback for progress updates */
  onProgress?: (progress: number, nodeId?: string) => void;
  /** Callback for completion */
  onComplete?: (result: NodeResult) => void;
  /** Callback for errors */
  onError?: (error: Error, nodeId: string) => void;
}

/**
 * Component version information
 */
export interface ComponentVersion {
  component: string;
  version: string;
  previousVersion?: string;
  rollbackAvailable: boolean;
}

/**
 * Rollback Executor - Executes rollback operations on distributed nodes
 */
export class RollbackExecutor {
  private connectionStates: Map<string, ConnectionState>;
  private activeRollbacks: Map<string, AbortController>;
  private scheduledRollbacks: Map<string, NodeJS.Timeout>;

  constructor() {
    this.connectionStates = new Map();
    this.activeRollbacks = new Map();
    this.scheduledRollbacks = new Map();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Execute rollback on all nodes
   */
  async executeRollback(
    request: RollbackRequest,
    nodes: Node[],
    options?: RollbackExecutionOptions
  ): Promise<RollbackResponse> {
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeRollbacks.set(request.rollbackId, abortController);

    // Create initial response
    const response: RollbackResponse = {
      rollbackId: request.rollbackId,
      status: "in_progress",
      timestamp: startTime,
      nodesCompleted: 0,
      nodesTotal: nodes.length,
      progress: 0,
      errors: [],
    };

    try {
      // Execute based on strategy
      switch (request.options.strategy) {
        case "immediate":
          await this.executeImmediate(request, nodes, response, options);
          break;
        case "graceful":
          await this.executeGraceful(request, nodes, response, options);
          break;
        case "scheduled":
          await this.executeScheduled(request, nodes, response, options);
          break;
        default:
          throw new Error(
            `Unknown rollback strategy: ${request.options.strategy}`
          );
      }

      // Update final status
      if (response.nodesCompleted === response.nodesTotal) {
        response.status = "completed";
      } else if (response.nodesCompleted > 0) {
        response.status = "partial";
      } else {
        response.status = "failed";
      }

      response.estimatedCompletion = Date.now();
      return response;
    } catch (error) {
      response.status = "failed";
      response.errors.push({
        nodeId: "executor",
        errorCode: "EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return response;
    } finally {
      this.activeRollbacks.delete(request.rollbackId);
    }
  }

  /**
   * Cancel an active rollback
   */
  cancelRollback(rollbackId: string): void {
    const abortController = this.activeRollbacks.get(rollbackId);
    if (abortController) {
      abortController.abort();
      this.activeRollbacks.delete(rollbackId);
    }

    const scheduled = this.scheduledRollbacks.get(rollbackId);
    if (scheduled) {
      clearTimeout(scheduled);
      this.scheduledRollbacks.delete(rollbackId);
    }
  }

  /**
   * Get active rollback IDs
   */
  getActiveRollbacks(): string[] {
    return Array.from(this.activeRollbacks.keys());
  }

  /**
   * Get scheduled rollback IDs
   */
  getScheduledRollbacks(): string[] {
    return Array.from(this.scheduledRollbacks.keys());
  }

  // ==========================================================================
  // EXECUTION STRATEGIES
  // ==========================================================================

  /**
   * Execute immediate rollback (no drain)
   */
  private async executeImmediate(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse,
    options?: RollbackExecutionOptions
  ): Promise<void> {
    const concurrency = options?.concurrency || 5;
    const nodeTimeout = options?.nodeTimeout || 60000;

    // Execute with concurrency limit
    const chunks = this.chunkArray(nodes, concurrency);

    for (const chunk of chunks) {
      // Check if aborted
      if (this.activeRollbacks.get(request.rollbackId)?.signal.aborted) {
        throw new Error("Rollback aborted");
      }

      const results = await Promise.allSettled(
        chunk.map(node =>
          this.executeOnNode(node, request, nodeTimeout, options)
        )
      );

      this.processResults(results, chunk, response, options);
    }
  }

  /**
   * Execute graceful rollback (with connection draining)
   */
  private async executeGraceful(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse,
    options?: RollbackExecutionOptions
  ): Promise<void> {
    const drainTimeout =
      options?.drainTimeout || request.options.drainTimeout || 30000;

    // Initialize draining state
    for (const node of nodes) {
      this.connectionStates.set(node.id, {
        nodeId: node.id,
        activeConnections: this.getActiveConnectionCount(node),
        draining: false,
        drainStartTime: 0,
      });
    }

    // Drain connections
    await this.drainConnections(nodes, drainTimeout, options);

    // Execute immediate after drain
    await this.executeImmediate(request, nodes, response, options);
  }

  /**
   * Execute scheduled rollback
   */
  private async executeScheduled(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse,
    options?: RollbackExecutionOptions
  ): Promise<void> {
    const scheduledTime = request.options.scheduledTime || 0;
    const delay = scheduledTime - Date.now();

    if (delay > 0) {
      // Schedule the rollback
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(async () => {
          this.scheduledRollbacks.delete(request.rollbackId);
          try {
            await this.executeImmediate(request, nodes, response, options);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, delay);

        this.scheduledRollbacks.set(request.rollbackId, timeout);
      });
    } else {
      // Scheduled time has passed, execute immediately
      await this.executeImmediate(request, nodes, response, options);
    }
  }

  // ==========================================================================
  // NODE EXECUTION
  // ==========================================================================

  /**
   * Execute rollback on a single node
   */
  private async executeOnNode(
    node: Node,
    request: RollbackRequest,
    timeout: number,
    options?: RollbackExecutionOptions
  ): Promise<NodeResult> {
    const startTime = Date.now();

    try {
      // Check node status
      if (node.status !== "online") {
        throw new Error(`Node is ${node.status}`);
      }

      // Create backup if enabled
      if (request.options.createBackup) {
        await this.createBackup(node, request);
      }

      // Execute component-specific rollback
      switch (request.targetComponent) {
        case "adapter":
          await this.rollbackAdapter(node, request.targetVersion);
          break;
        case "cartridge":
          await this.rollbackCartridge(node, request.targetVersion);
          break;
        case "config":
          await this.rollbackConfig(
            node,
            (request.metadata?.config as Record<string, unknown>) || {}
          );
          break;
        case "model":
          await this.rollbackModel(node, request.targetVersion);
          break;
        case "protocol":
          await this.rollbackProtocol(node, request.targetVersion);
          break;
        default:
          throw new Error(`Unknown component type: ${request.targetComponent}`);
      }

      const result: NodeResult = {
        nodeId: node.id,
        success: true,
        timestamp: Date.now(),
        data: {
          component: request.targetComponent,
          version: request.targetVersion,
          previousVersion: request.currentVersion,
          duration: Date.now() - startTime,
        },
      };

      options?.onComplete?.(result);
      return result;
    } catch (error) {
      const result: NodeResult = {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      };

      options?.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        node.id
      );
      return result;
    }
  }

  // ==========================================================================
  // COMPONENT ROLLBACKS
  // ==========================================================================

  /**
   * Rollback adapter component
   */
  private async rollbackAdapter(node: Node, version: string): Promise<void> {
    // Simulate adapter rollback
    // In real implementation, would:
    // 1. Check if version exists
    // 2. Stop current adapter
    // 3. Install previous version
    // 4. Restart adapter
    // 5. Verify adapter is running

    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 90% success rate
    if (Math.random() > 0.1) {
      return;
    }

    throw new Error(`Failed to rollback adapter to version ${version}`);
  }

  /**
   * Rollback cartridge component
   */
  private async rollbackCartridge(node: Node, version: string): Promise<void> {
    // Simulate cartridge rollback
    // In real implementation, would:
    // 1. Unload current cartridge
    // 2. Load previous version
    // 3. Verify cartridge integrity

    const delay = Math.random() * 1500 + 300; // 300-1800ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return;
    }

    throw new Error(`Failed to rollback cartridge to version ${version}`);
  }

  /**
   * Rollback configuration
   */
  private async rollbackConfig(
    node: Node,
    config: Record<string, unknown>
  ): Promise<void> {
    // Simulate config rollback
    // In real implementation, would:
    // 1. Validate configuration
    // 2. Apply configuration
    // 3. Restart affected services

    const delay = Math.random() * 1000 + 200; // 200-1200ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 98% success rate
    if (Math.random() > 0.02) {
      return;
    }

    throw new Error("Failed to rollback configuration");
  }

  /**
   * Rollback model component
   */
  private async rollbackModel(node: Node, version: string): Promise<void> {
    // Simulate model rollback
    // In real implementation, would:
    // 1. Download model if not cached
    // 2. Switch model reference
    // 3. Verify model availability

    const delay = Math.random() * 5000 + 1000; // 1000-6000ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 85% success rate (models can be large)
    if (Math.random() > 0.15) {
      return;
    }

    throw new Error(`Failed to rollback model to version ${version}`);
  }

  /**
   * Rollback protocol component
   */
  private async rollbackProtocol(node: Node, version: string): Promise<void> {
    // Simulate protocol rollback
    // In real implementation, would:
    // 1. Update protocol definitions
    // 2. Update serialization formats

    const delay = Math.random() * 800 + 200; // 200-1000ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return;
    }

    throw new Error(`Failed to rollback protocol to version ${version}`);
  }

  // ==========================================================================
  // CONNECTION DRAINING
  // ==========================================================================

  /**
   * Drain existing connections from nodes
   */
  private async drainConnections(
    nodes: Node[],
    timeout: number,
    options?: RollbackExecutionOptions
  ): Promise<void> {
    const startTime = Date.now();

    // Start draining
    for (const node of nodes) {
      const state = this.connectionStates.get(node.id);
      if (state) {
        state.draining = true;
        state.drainStartTime = startTime;
      }
    }

    // Wait for all connections to drain or timeout
    while (Date.now() - startTime < timeout) {
      const totalConnections = Array.from(
        this.connectionStates.values()
      ).reduce((sum, state) => sum + state.activeConnections, 0);

      if (totalConnections === 0) {
        break;
      }

      options?.onProgress?.(
        Math.round(
          (1 - totalConnections / this.getInitialTotalConnections(nodes)) * 100
        )
      );

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Force drain if timeout exceeded
    if (Date.now() - startTime >= timeout) {
      const remaining = Array.from(this.connectionStates.entries())
        .filter(([_, state]) => state.activeConnections > 0)
        .map(([nodeId, _]) => nodeId);

      if (remaining.length > 0) {
        console.warn(
          `Drain timeout exceeded, force-draining nodes: ${remaining.join(", ")}`
        );
      }

      for (const nodeId of remaining) {
        const state = this.connectionStates.get(nodeId);
        if (state) {
          state.activeConnections = 0;
        }
      }
    }
  }

  /**
   * Get active connection count for a node
   */
  private getActiveConnectionCount(node: Node): number {
    // Simulate connection count
    // In real implementation, would query actual connection metrics
    return Math.floor(Math.random() * 50) + 10;
  }

  /**
   * Get initial total connections across all nodes
   */
  private getInitialTotalConnections(nodes: Node[]): number {
    return Array.from(this.connectionStates.values()).reduce(
      (sum, state) => sum + state.activeConnections,
      0
    );
  }

  // ==========================================================================
  // BACKUP OPERATIONS
  // ==========================================================================

  /**
   * Create backup before rollback
   */
  private async createBackup(
    node: Node,
    request: RollbackRequest
  ): Promise<void> {
    // Simulate backup creation
    // In real implementation, would:
    // 1. Collect current state
    // 2. Create backup archive
    // 3. Store backup in configured location

    const delay = Math.random() * 1000 + 200;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 99% success rate
    if (Math.random() > 0.01) {
      return;
    }

    throw new Error(`Failed to create backup for node ${node.id}`);
  }

  // ==========================================================================
  // RESULT PROCESSING
  // ==========================================================================

  /**
   * Process execution results
   */
  private processResults(
    results: PromiseSettledResult<NodeResult>[],
    nodes: Node[],
    response: RollbackResponse,
    options?: RollbackExecutionOptions
  ): void {
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value.success) {
        response.nodesCompleted++;
      } else {
        const error =
          result.status === "rejected"
            ? result.reason
            : result.value.error || "Unknown error";

        response.errors.push({
          nodeId: nodes[idx].id,
          errorCode: "NODE_FAILED",
          message: String(error),
          timestamp: Date.now(),
        });
      }

      response.progress = Math.round(
        (response.nodesCompleted / response.nodesTotal) * 100
      );

      options?.onProgress?.(response.progress, nodes[idx].id);
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get rollback strategy display name
   */
  getStrategyName(strategy: RollbackStrategy): string {
    const names: Record<RollbackStrategy, string> = {
      immediate: "Immediate",
      graceful: "Graceful",
      scheduled: "Scheduled",
    };
    return names[strategy] || strategy;
  }

  /**
   * Get rollback status for all nodes
   */
  getConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values());
  }

  /**
   * Clear connection states
   */
  clearConnectionStates(): void {
    this.connectionStates.clear();
  }
}
