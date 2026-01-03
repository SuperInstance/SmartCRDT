/**
 * NUMA-Aware Task Scheduler
 *
 * Schedules tasks for optimal memory locality on NUMA systems.
 * Implements various scheduling strategies to balance load and minimize remote memory access.
 */

import type {
  NUMATopology,
  NUMATask,
  NUMASchedulingDecision,
  NUMASchedulingStrategy,
  NUMASchedulerConfig,
  NUMAStatistics,
  NUMAWorkloadDistribution,
  NUMAOptimizationRecommendation,
  NUMAMemoryMigration,
  NUMANodeId,
  CPUId,
  INUMAScheduler,
  NUMAMemoryPolicy,
} from '@lsi/protocol';
import { NUMADetector } from './NUMADetector.js';

/**
 * Task execution tracking
 */
interface TaskExecution {
  task: NUMATask;
  nodeId: NUMANodeId;
  startTime: number;
  endTime?: number;
  memoryAllocated: number;
}

/**
 * NUMA Scheduler Implementation
 */
export class NUMAScheduler implements INUMAScheduler {
  private detector: NUMADetector;
  private config: NUMASchedulerConfig;
  private topology?: NUMATopology;
  private tasks: Map<string, TaskExecution>;
  private migrations: Map<string, NUMAMemoryMigration>;
  private history: Array<{ nodeId: NUMANodeId; completionTime: number; timestamp: number }>;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    detector: NUMADetector,
    config: Partial<NUMASchedulerConfig> = {}
  ) {
    this.detector = detector;
    this.config = this.createDefaultConfig(config);
    this.tasks = new Map();
    this.migrations = new Map();
    this.history = [];
  }

  /**
   * Get current topology
   */
  async getTopology(): Promise<NUMATopology> {
    if (!this.topology) {
      const result = await this.detector.detect();
      this.topology = result.topology;
    }
    return this.topology!;
  }

  /**
   * Schedule a task
   */
  async scheduleTask(task: NUMATask): Promise<NUMASchedulingDecision> {
    const topology = await this.getTopology();

    if (!topology.numaAvailable) {
      // UMA system - schedule on node 0
      return this.scheduleOnNode(task, 0, topology);
    }

    // Apply scheduling strategy
    switch (this.config.strategy) {
      case 'local_first':
        return this.scheduleLocalFirst(task, topology);
      case 'load_balance':
        return this.scheduleLoadBalance(task, topology);
      case 'minimize_remote':
        return this.scheduleMinimizeRemote(task, topology);
      case 'maximize_free_memory':
        return this.scheduleMaximizeFreeMemory(task, topology);
      case 'adaptive':
        return this.scheduleAdaptive(task, topology);
      default:
        return this.scheduleLocalFirst(task, topology);
    }
  }

  /**
   * Migrate a task to different node
   */
  async migrateTask(taskId: string, targetNode: NUMANodeId): Promise<NUMAMemoryMigration> {
    const execution = this.tasks.get(taskId);
    if (!execution) {
      throw new Error(`Task ${taskId} not found`);
    }

    const sourceNode = execution.nodeId;
    if (sourceNode === targetNode) {
      throw new Error('Task is already on target node');
    }

    const migrationId = `${taskId}_migration_${Date.now()}`;
    const task = execution.task;

    // Estimate migration cost
    const migrationCost = this.estimateMigrationCost(task, sourceNode, targetNode);

    if (migrationCost > this.config.migrationCostThreshold) {
      throw new Error(`Migration cost ${migrationCost}ms exceeds threshold ${this.config.migrationCostThreshold}ms`);
    }

    const migration: NUMAMemoryMigration = {
      migrationId,
      taskId,
      sourceNode,
      targetNode,
      size: task.memoryRequirement,
      progress: 0,
      status: 'pending',
      estimatedTimeRemaining: migrationCost,
    };

    this.migrations.set(migrationId, migration);

    // Simulate migration (in real implementation, this would be async)
    migration.status = 'in_progress';
    migration.progress = 0.5;

    // Update task node
    execution.nodeId = targetNode;
    task.currentNode = targetNode;
    task.state = 'migrating';

    // Complete migration
    setTimeout(() => {
      migration.status = 'completed';
      migration.progress = 1;
      migration.actualTime = migrationCost;
      task.state = 'running';
    }, migrationCost);

    return migration;
  }

  /**
   * Get current statistics
   */
  async getStatistics(): Promise<NUMAStatistics> {
    const topology = await this.getTopology();

    const tasksPerNode = new Map<NUMANodeId, number>();
    const memoryPerNode = new Map<NUMANodeId, number>();
    const avgCompletionTime = new Map<NUMANodeId, number>();
    const completionTimes = new Map<NUMANodeId, number[]>();

    // Initialize maps
    for (const nodeId of topology.nodes.keys()) {
      tasksPerNode.set(nodeId, 0);
      memoryPerNode.set(nodeId, 0);
      completionTimes.set(nodeId, []);
    }

    // Aggregate task data
    let totalLocalAccess = 0;
    let totalRemoteAccess = 0;

    for (const execution of this.tasks.values()) {
      const nodeId = execution.nodeId;
      tasksPerNode.set(nodeId, (tasksPerNode.get(nodeId) || 0) + 1);
      memoryPerNode.set(nodeId, (memoryPerNode.get(nodeId) || 0) + execution.memoryAllocated);

      // Count local vs remote access
      if (execution.task.preferredNode === nodeId) {
        totalLocalAccess++;
      } else {
        totalRemoteAccess++;
      }

      // Track completion times
      if (execution.endTime) {
        const duration = execution.endTime - execution.startTime;
        completionTimes.get(nodeId)!.push(duration);
      }
    }

    // Calculate averages
    for (const [nodeId, times] of completionTimes.entries()) {
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        avgCompletionTime.set(nodeId, avg);
      }
    }

    // Calculate scores
    const localityRatio = totalLocalAccess / (totalLocalAccess + totalRemoteAccess || 1);
    const loadBalanceScore = this.calculateLoadBalanceScore(topology);
    const memoryLocalityScore = localityRatio;
    const efficiencyScore = (loadBalanceScore + memoryLocalityScore) / 2;

    // Count migrations
    let migrationsPerformed = 0;
    let migrationsInProgress = 0;
    for (const migration of this.migrations.values()) {
      if (migration.status === 'completed') {
        migrationsPerformed++;
      } else if (migration.status === 'in_progress') {
        migrationsInProgress++;
      }
    }

    return {
      timestamp: Date.now(),
      tasksPerNode,
      memoryPerNode,
      localityRatio,
      avgCompletionTime,
      migrationsPerformed,
      migrationsInProgress,
      loadBalanceScore,
      memoryLocalityScore,
      efficiencyScore,
    };
  }

  /**
   * Get workload distribution
   */
  async getWorkloadDistribution(): Promise<NUMAWorkloadDistribution[]> {
    const topology = await this.getTopology();
    const distribution: NUMAWorkloadDistribution[] = [];

    for (const [nodeId, node] of topology.nodes.entries()) {
      let taskCount = 0;
      let memoryUsed = 0;

      for (const execution of this.tasks.values()) {
        if (execution.nodeId === nodeId) {
          taskCount++;
          memoryUsed += execution.memoryAllocated;
        }
      }

      const cpuUtilization = taskCount / this.config.maxTasksPerNode;
      const memoryUtilization = memoryUsed / node.totalMemory;
      const loadScore = (cpuUtilization + memoryUtilization) / 2;

      distribution.push({
        nodeId,
        taskCount,
        memoryUsed: memoryUsed as number,
        cpuUtilization,
        memoryUtilization,
        loadScore,
      });
    }

    return distribution;
  }

  /**
   * Get optimization recommendations
   */
  async getRecommendations(): Promise<NUMAOptimizationRecommendation[]> {
    const recommendations: NUMAOptimizationRecommendation[] = [];
    const topology = await this.getTopology();

    if (!topology.numaAvailable) {
      return recommendations;
    }

    const distribution = await this.getWorkloadDistribution();
    const stats = await this.getStatistics();

    // Check for load imbalance
    const avgLoad = distribution.reduce((sum, d) => sum + d.loadScore, 0) / distribution.length;
    const overloaded = distribution.filter(d => d.loadScore > avgLoad * 1.5);
    const underloaded = distribution.filter(d => d.loadScore < avgLoad * 0.5);

    if (overloaded.length > 0 && underloaded.length > 0) {
      // Find tasks to migrate
      for (const overloadedNode of overloaded) {
        for (const execution of this.tasks.values()) {
          if (execution.nodeId === overloadedNode.nodeId) {
            const targetNode = underloaded[0].nodeId;
            const migrationCost = this.estimateMigrationCost(
              execution.task,
              overloadedNode.nodeId,
              targetNode
            );

            recommendations.push({
              type: 'migrate',
              priority: Math.round((overloadedNode.loadScore - avgLoad) * 100),
              taskIds: [execution.task.taskId],
              currentNode: overloadedNode.nodeId,
              recommendedNode: targetNode,
              expectedBenefit: {
                performanceImprovement: (overloadedNode.loadScore - avgLoad),
                latencyReduction: migrationCost * 0.5,
                cost: migrationCost,
              },
              reason: `Node ${overloadedNode.nodeId} is overloaded (${(overloadedNode.loadScore * 100).toFixed(0)}% vs avg ${(avgLoad * 100).toFixed(0)}%)`,
              steps: [
                `Initiate migration of task ${execution.task.taskId}`,
                `Monitor migration progress`,
                `Verify performance improvement`,
              ],
            });
            break; // One recommendation per overloaded node
          }
        }
      }
    }

    // Check for poor locality
    if (stats.localityRatio < 0.7) {
      for (const execution of this.tasks.values()) {
        if (execution.task.preferredNode !== undefined && execution.nodeId !== execution.task.preferredNode) {
          recommendations.push({
            type: 'migrate',
            priority: Math.round((1 - stats.localityRatio) * 100),
            taskIds: [execution.task.taskId],
            currentNode: execution.nodeId,
            recommendedNode: execution.task.preferredNode!,
            expectedBenefit: {
              performanceImprovement: (1 - stats.localityRatio) * 0.3,
              latencyReduction: 50,
              cost: 100,
            },
            reason: `Task has preference for node ${execution.task.preferredNode} but running on ${execution.nodeId}`,
            steps: [
              'Update task memory policy',
              'Migrate to preferred node',
              'Verify locality improvement',
            ],
          });
        }
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Update scheduler configuration
   */
  async updateConfig(config: Partial<NUMASchedulerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  /**
   * Schedule using local-first strategy
   */
  private scheduleLocalFirst(task: NUMATask, topology: NUMATopology): NUMASchedulingDecision {
    let targetNode = task.preferredNode ?? 0;

    // Check if preferred node has capacity
    const node = topology.nodes.get(targetNode);
    if (!node || node.activeTasks >= this.config.maxTasksPerNode) {
      // Find alternative node with capacity
      targetNode = this.findBestNode(task, topology);
    }

    return this.createSchedulingDecision(task, targetNode, topology);
  }

  /**
   * Schedule using load-balance strategy
   */
  private scheduleLoadBalance(task: NUMATask, topology: NUMATopology): NUMASchedulingDecision {
    const targetNode = this.findLeastLoadedNode(topology);
    return this.createSchedulingDecision(task, targetNode, topology);
  }

  /**
   * Schedule using minimize-remote strategy
   */
  private scheduleMinimizeRemote(task: NUMATask, topology: NUMATopology): NUMASchedulingDecision {
    let targetNode = task.preferredNode ?? 0;

    if (task.preferredNode !== undefined) {
      const node = topology.nodes.get(task.preferredNode);
      if (node && node.activeTasks < this.config.maxTasksPerNode) {
        targetNode = task.preferredNode;
      }
    }

    return this.createSchedulingDecision(task, targetNode, topology);
  }

  /**
   * Schedule using maximize-free-memory strategy
   */
  private scheduleMaximizeFreeMemory(task: NUMATask, topology: NUMATopology): NUMASchedulingDecision {
    let bestNode = 0;
    let maxFreeMemory = 0;

    for (const [nodeId, node] of topology.nodes.entries()) {
      if (node.freeMemory > maxFreeMemory && node.activeTasks < this.config.maxTasksPerNode) {
        maxFreeMemory = node.freeMemory;
        bestNode = nodeId;
      }
    }

    return this.createSchedulingDecision(task, bestNode, topology);
  }

  /**
   * Schedule using adaptive strategy
   */
  private scheduleAdaptive(task: NUMATask, topology: NUMATopology): NUMASchedulingDecision {
    const stats = this.getStatisticsSync();

    // If locality is good, focus on load balancing
    if (stats.localityRatio > 0.8) {
      return this.scheduleLoadBalance(task, topology);
    }

    // Otherwise, prioritize locality
    return this.scheduleLocalFirst(task, topology);
  }

  /**
   * Create scheduling decision
   */
  private createSchedulingDecision(
    task: NUMATask,
    targetNode: NUMANodeId,
    topology: NUMATopology
  ): NUMASchedulingDecision {
    const node = topology.nodes.get(targetNode)!;
    const confidence = this.calculateConfidence(task, targetNode, topology);
    const expectedImpact = this.calculateExpectedImpact(task, targetNode, topology);

    // Track task
    const execution: TaskExecution = {
      task,
      nodeId: targetNode,
      startTime: Date.now(),
      memoryAllocated: task.memoryRequirement,
    };
    this.tasks.set(task.taskId, execution);
    node.activeTasks++;

    // Calculate alternatives
    const alternatives = topology.nodes.keys()
      .filter(id => id !== targetNode)
      .map(nodeId => ({
        nodeId,
        score: this.calculateNodeScore(task, nodeId, topology),
        reason: this.getNodeScoreReason(task, nodeId, topology),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      taskId: task.taskId,
      targetNode,
      cpuAffinity: node.cpus.slice(0, Math.min(node.cpus.length, 4)),
      memoryPolicy: task.memoryPolicy,
      confidence,
      reason: this.getSchedulingReason(task, targetNode, topology),
      expectedImpact,
      alternatives,
    };
  }

  /**
   * Find best node for task
   */
  private findBestNode(task: NUMATask, topology: NUMATopology): NUMANodeId {
    let bestNode = 0;
    let bestScore = -Infinity;

    for (const [nodeId, node] of topology.nodes.entries()) {
      if (node.activeTasks >= this.config.maxTasksPerNode) continue;

      const score = this.calculateNodeScore(task, nodeId, topology);
      if (score > bestScore) {
        bestScore = score;
        bestNode = nodeId;
      }
    }

    return bestNode;
  }

  /**
   * Find least loaded node
   */
  private findLeastLoadedNode(topology: NUMATopology): NUMANodeId {
    let leastLoaded = 0;
    let minTasks = Infinity;

    for (const [nodeId, node] of topology.nodes.entries()) {
      if (node.activeTasks < minTasks) {
        minTasks = node.activeTasks;
        leastLoaded = nodeId;
      }
    }

    return leastLoaded;
  }

  /**
   * Calculate node score for task
   */
  private calculateNodeScore(task: NUMATask, nodeId: NUMANodeId, topology: NUMATopology): number {
    const node = topology.nodes.get(nodeId)!;
    let score = 0;

    // Prefer preferred node
    if (task.preferredNode === nodeId) {
      score += 100;
    }

    // Consider available memory
    const memoryScore = (node.freeMemory / node.totalMemory) * 50;
    score += memoryScore;

    // Consider CPU availability
    const cpuScore = ((this.config.maxTasksPerNode - node.activeTasks) / this.config.maxTasksPerNode) * 30;
    score += cpuScore;

    // Consider distance (if preferred node is set)
    if (task.preferredNode !== undefined) {
      const distance = topology.distances.get(task.preferredNode)?.get(nodeId) ?? 20;
      score -= distance;
    }

    return score;
  }

  /**
   * Calculate confidence in scheduling decision
   */
  private calculateConfidence(task: NUMATask, targetNode: NUMANodeId, topology: NUMATopology): number {
    const node = topology.nodes.get(targetNode)!;

    // High confidence if preferred node matches
    if (task.preferredNode === targetNode) {
      return 0.95;
    }

    // Lower confidence if node is loaded
    const loadRatio = node.activeTasks / this.config.maxTasksPerNode;
    return Math.max(0.5, 1 - loadRatio);
  }

  /**
   * Calculate expected impact
   */
  private calculateExpectedImpact(task: NUMATask, targetNode: NUMANodeId, topology: NUMATopology): number {
    const node = topology.nodes.get(targetNode)!;

    // Higher impact if using preferred node
    if (task.preferredNode === targetNode) {
      return 0.9;
    }

    // Lower impact if node is loaded
    return 1 - (node.activeTasks / this.config.maxTasksPerNode) * 0.5;
  }

  /**
   * Get scheduling reason
   */
  private getSchedulingReason(task: NUMATask, targetNode: NUMANodeId, topology: NUMATopology): string {
    const node = topology.nodes.get(targetNode)!;
    const reasons = [];

    if (task.preferredNode === targetNode) {
      reasons.push('matches preferred node');
    }

    reasons.push(`${node.activeTasks}/${this.config.maxTasksPerNode} tasks`);
    reasons.push(`${((node.freeMemory / node.totalMemory) * 100).toFixed(0)}% free memory`);

    return `Scheduled on node ${targetNode} (${reasons.join(', ')})`;
  }

  /**
   * Get node score reason
   */
  private getNodeScoreReason(task: NUMATask, nodeId: NUMANodeId, topology: NUMATopology): string {
    const node = topology.nodes.get(nodeId)!;
    return `Node ${nodeId}: ${node.activeTasks} tasks, ${((node.freeMemory / node.totalMemory) * 100).toFixed(0)}% free`;
  }

  /**
   * Estimate migration cost
   */
  private estimateMigrationCost(task: NUMATask, sourceNode: NUMANodeId, targetNode: NUMANodeId): number {
    // Base cost: 1ms per MB
    const baseCost = (task.memoryRequirement / (1024 * 1024)) * 1;

    // Distance penalty
    const topology = this.topology!;
    const distance = topology.distances.get(sourceNode)?.get(targetNode) ?? 20;
    const distancePenalty = (distance / 10) * 50;

    return Math.ceil(baseCost + distancePenalty);
  }

  /**
   * Calculate load balance score
   */
  private calculateLoadBalanceScore(topology: NUMATopology): number {
    const loads: number[] = [];

    for (const node of topology.nodes.values()) {
      loads.push(node.activeTasks);
    }

    if (loads.length === 0) return 1;

    const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avg, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    // Score is 1 - (normalized std dev)
    return Math.max(0, 1 - (stdDev / avg));
  }

  /**
   * Schedule on specific node
   */
  private scheduleOnNode(task: NUMATask, nodeId: NUMANodeId, topology: NUMATopology): NUMASchedulingDecision {
    const node = topology.nodes.get(nodeId)!;

    return {
      taskId: task.taskId,
      targetNode: nodeId,
      cpuAffinity: node.cpus.slice(0, Math.min(node.cpus.length, 4)),
      memoryPolicy: task.memoryPolicy,
      confidence: 0.8,
      reason: `UMA system - scheduling on node ${nodeId}`,
      expectedImpact: 0.7,
      alternatives: [],
    };
  }

  /**
   * Get statistics synchronously (for internal use)
   */
  private getStatisticsSync(): NUMAStatistics {
    // Simplified version for internal use
    return {
      timestamp: Date.now(),
      tasksPerNode: new Map(),
      memoryPerNode: new Map(),
      localityRatio: 0.8,
      avgCompletionTime: new Map(),
      migrationsPerformed: 0,
      migrationsInProgress: 0,
      loadBalanceScore: 0.8,
      memoryLocalityScore: 0.8,
      efficiencyScore: 0.8,
    };
  }

  /**
   * Create default config
   */
  private createDefaultConfig(config: Partial<NUMASchedulerConfig>): NUMASchedulerConfig {
    return {
      strategy: 'adaptive',
      maxTasksPerNode: 10,
      memoryPressureThreshold: 0.8,
      cpuPressureThreshold: 0.8,
      enableMigration: true,
      migrationCostThreshold: 1000,
      loadBalanceWindow: 60000,
      monitoringInterval: 5000,
      ...config,
    };
  }

  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      // Refresh topology
      const detection = await this.detector.detect();
      if (detection.topology) {
        this.topology = detection.topology;
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Clean up completed tasks
   */
  cleanupCompletedTasks(olderThan: number = 3600000): void {
    const now = Date.now();

    for (const [taskId, execution] of this.tasks.entries()) {
      if (execution.endTime && (now - execution.endTime) > olderThan) {
        this.tasks.delete(taskId);
      }
    }
  }
}
