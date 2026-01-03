/**
 * @lsi/webgpu-multi - Work Distributor
 *
 * Distributes work across multiple GPU devices using various strategies.
 */

import type {
  GPUDevice,
  WorkTask,
  TaskAssignment,
  WorkDistribution,
  PipelineStage,
  PipelineConfig,
} from "./types.js";

/**
 * Work Distributor for multi-GPU task distribution
 */
export class WorkDistributor {
  private currentStrategy: WorkDistribution;
  private roundRobinIndex: number = 0;

  constructor(strategy: WorkDistribution = "round-robin") {
    this.currentStrategy = strategy;
  }

  /**
   * Set the distribution strategy
   */
  setStrategy(strategy: WorkDistribution): void {
    this.currentStrategy = strategy;
  }

  /**
   * Get the current strategy
   */
  getStrategy(): WorkDistribution {
    return this.currentStrategy;
  }

  /**
   * Distribute tasks across devices
   */
  distributeTasks(
    tasks: WorkTask[],
    devices: GPUDevice[],
    strategy?: WorkDistribution
  ): TaskAssignment[] {
    const strat = strategy ?? this.currentStrategy;

    switch (strat) {
      case "round-robin":
        return this.roundRobinDistribute(tasks, devices);
      case "split-by-task":
        return this.splitByTaskDistribute(tasks, devices);
      case "data-parallel":
        return this.dataParallelDistribute(tasks, devices);
      case "pipeline":
        return this.pipelineDistribute(tasks, devices);
      case "model-parallel":
        return this.modelParallelDistribute(tasks, devices);
      case "hybrid":
        return this.hybridDistribute(tasks, devices);
      default:
        return this.roundRobinDistribute(tasks, devices);
    }
  }

  /**
   * Round-robin distribution
   */
  private roundRobinDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const device = devices[this.roundRobinIndex % devices.length];
      const task = tasks[i];

      assignments.push({
        task,
        device,
        index: i,
        expectedCompletion: Date.now() + (task.estimatedTime || 100),
        status: "pending",
      });

      this.roundRobinIndex++;
    }

    return assignments;
  }

  /**
   * Split by task distribution
   */
  private splitByTaskDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const sortedTasks = [...tasks].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    // Group tasks by priority ranges
    const highPriority = sortedTasks.filter(t => (t.priority || 0) > 0.7);
    const mediumPriority = sortedTasks.filter(
      t => (t.priority || 0) > 0.3 && (t.priority || 0) <= 0.7
    );
    const lowPriority = sortedTasks.filter(t => (t.priority || 0) <= 0.3);

    // Assign to different devices
    let taskIndex = 0;
    for (const task of highPriority) {
      const device = devices[taskIndex % devices.length];
      assignments.push({
        task,
        device,
        index: taskIndex++,
        expectedCompletion: Date.now() + (task.estimatedTime || 100),
        status: "pending",
      });
    }

    for (const task of mediumPriority) {
      const device = devices[(taskIndex + 1) % devices.length];
      assignments.push({
        task,
        device,
        index: taskIndex++,
        expectedCompletion: Date.now() + (task.estimatedTime || 100),
        status: "pending",
      });
    }

    for (const task of lowPriority) {
      const device = devices[(taskIndex + 2) % devices.length];
      assignments.push({
        task,
        device,
        index: taskIndex++,
        expectedCompletion: Date.now() + (task.estimatedTime || 100),
        status: "pending",
      });
    }

    return assignments;
  }

  /**
   * Data parallel distribution
   */
  private dataParallelDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    // For data parallelism, all devices get the same task type
    // but different data chunks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // Assign task to all devices (data parallelism)
      for (let j = 0; j < devices.length; j++) {
        assignments.push({
          task: {
            ...task,
            taskId: `${task.taskId}-device-${j}`,
          },
          device: devices[j],
          index: i * devices.length + j,
          expectedCompletion: Date.now() + (task.estimatedTime || 100),
          status: "pending",
        });
      }
    }

    return assignments;
  }

  /**
   * Pipeline distribution
   */
  private pipelineDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    // Create pipeline stages
    const stages = this.createPipelineStages(tasks, devices);
    const stagePerDevice = Math.ceil(stages.length / devices.length);

    for (let i = 0; i < stages.length; i++) {
      const deviceIndex = Math.floor(i / stagePerDevice) % devices.length;
      const stage = stages[i];

      for (const task of stage.tasks) {
        assignments.push({
          task,
          device: stage.device,
          index: assignments.length,
          expectedCompletion: Date.now() + stage.estimatedTime,
          status: "pending",
        });
      }
    }

    return assignments;
  }

  /**
   * Model parallel distribution
   */
  private modelParallelDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    // Split model layers across devices
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const deviceIndex = i % devices.length;

      assignments.push({
        task,
        device: devices[deviceIndex],
        index: i,
        expectedCompletion: Date.now() + (task.estimatedTime || 100),
        status: "pending",
      });
    }

    return assignments;
  }

  /**
   * Hybrid distribution (combines multiple strategies)
   */
  private hybridDistribute(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    // Use different strategies based on task characteristics
    const dataParallelTasks = tasks.filter(t => t.type === "data-parallel");
    const pipelineTasks = tasks.filter(t => t.type === "pipeline");
    const otherTasks = tasks.filter(
      t => t.type !== "data-parallel" && t.type !== "pipeline"
    );

    // Data parallel for compatible tasks
    assignments.push(
      ...this.dataParallelDistribute(dataParallelTasks, devices)
    );

    // Pipeline for sequential tasks
    assignments.push(...this.pipelineDistribute(pipelineTasks, devices));

    // Round-robin for others
    assignments.push(...this.roundRobinDistribute(otherTasks, devices));

    return assignments;
  }

  /**
   * Create pipeline stages from tasks
   */
  createPipelineStages(
    tasks: WorkTask[],
    devices: GPUDevice[]
  ): PipelineStage[] {
    const stages: PipelineStage[] = [];

    // Group tasks by dependencies to create stages
    const taskMap = new Map<string, WorkTask>();
    for (const task of tasks) {
      taskMap.set(task.taskId, task);
    }

    const processed = new Set<string>();
    let stageIndex = 0;

    while (processed.size < tasks.length) {
      const stageTasks: WorkTask[] = [];

      // Find tasks whose dependencies are satisfied
      for (const task of tasks) {
        if (processed.has(task.taskId)) continue;

        const depsSatisfied = task.dependencies.every(dep =>
          processed.has(dep)
        );
        if (depsSatisfied || task.dependencies.length === 0) {
          stageTasks.push(task);
        }
      }

      if (stageTasks.length === 0) {
        // Circular dependency or no progress - break
        break;
      }

      // Assign stage to a device
      const device = devices[stageIndex % devices.length];
      const estimatedTime = Math.max(
        ...stageTasks.map(t => t.estimatedTime || 100)
      );

      stages.push({
        stageId: `stage-${stageIndex}`,
        name: `Pipeline Stage ${stageIndex}`,
        device,
        tasks: stageTasks,
        inputFrom: stageIndex > 0 ? `stage-${stageIndex - 1}` : undefined,
        outputTo:
          stageIndex < devices.length - 1
            ? `stage-${stageIndex + 1}`
            : undefined,
        estimatedTime,
      });

      for (const task of stageTasks) {
        processed.add(task.taskId);
      }

      stageIndex++;
    }

    return stages;
  }

  /**
   * Create a pipeline configuration
   */
  createPipelineConfig(
    stages: PipelineStage[],
    enableOverlapping: boolean = true
  ): PipelineConfig {
    const bufferSize = Math.max(
      ...stages.map(s => s.tasks.length * 1024 * 1024)
    ); // 1MB per task default

    return {
      stages,
      enableOverlapping,
      bufferSize,
    };
  }

  /**
   * Rebalance assignments based on device utilization
   */
  rebalanceAssignments(assignments: TaskAssignment[]): TaskAssignment[] {
    // Group by device
    const deviceAssignments = new Map<GPUDevice, TaskAssignment[]>();
    for (const assignment of assignments) {
      const existing = deviceAssignments.get(assignment.device) || [];
      existing.push(assignment);
      deviceAssignments.set(assignment.device, existing);
    }

    // Calculate load per device
    const deviceLoads = new Map<GPUDevice, number>();
    for (const [device, tasks] of deviceAssignments) {
      const totalLoad = tasks.reduce(
        (sum, t) => sum + (t.task.estimatedTime || 100),
        0
      );
      deviceLoads.set(device, totalLoad);
    }

    // Find most and least loaded devices
    let maxLoad = 0;
    let minLoad = Infinity;
    let mostLoaded: GPUDevice | null = null;
    let leastLoaded: GPUDevice | null = null;

    for (const [device, load] of deviceLoads) {
      if (load > maxLoad) {
        maxLoad = load;
        mostLoaded = device;
      }
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = device;
      }
    }

    // Move some tasks from most to least loaded
    if (mostLoaded && leastLoaded && mostLoaded !== leastLoaded) {
      const tasksToMove = deviceAssignments.get(mostLoaded) || [];
      const tasks = tasksToMove.slice(0, Math.floor(tasksToMove.length / 4));

      for (const task of tasks) {
        task.device = leastLoaded!;
      }
    }

    return assignments;
  }

  /**
   * Get device utilization from assignments
   */
  getDeviceUtilization(assignments: TaskAssignment[]): Map<GPUDevice, number> {
    const utilization = new Map<GPUDevice, number>();
    const deviceTasks = new Map<GPUDevice, TaskAssignment[]>();

    // Group by device
    for (const assignment of assignments) {
      const tasks = deviceTasks.get(assignment.device) || [];
      tasks.push(assignment);
      deviceTasks.set(assignment.device, tasks);
    }

    // Calculate utilization
    for (const [device, tasks] of deviceTasks) {
      const totalTime = tasks.reduce(
        (sum, t) => sum + (t.task.estimatedTime || 100),
        0
      );
      const activeTasks = tasks.filter(t => t.status === "running").length;
      utilization.set(device, activeTasks / Math.max(1, tasks.length));
    }

    return utilization;
  }

  /**
   * Reset round-robin index
   */
  resetRoundRobin(): void {
    this.roundRobinIndex = 0;
  }
}

/**
 * Default work distributor instance
 */
export const defaultWorkDistributor = new WorkDistributor();
