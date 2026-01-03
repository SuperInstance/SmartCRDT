/**
 * @lsi/webgpu-multi - Load Balancer
 *
 * Balances work across multiple GPU devices with dynamic adjustment.
 */

import type {
  GPUDevice,
  TaskAssignment,
  LoadBalancerConfig,
  WorkTask,
} from "./types.js";

/**
 * Device load tracking
 */
interface DeviceLoad {
  device: GPUDevice;
  currentTasks: number;
  totalTasks: number;
  estimatedCompletionTime: number;
  utilization: number;
  queueDepth: number;
}

/**
 * Load Balancer for multi-GPU work distribution
 */
export class LoadBalancer {
  private deviceLoads: Map<string, DeviceLoad> = new Map();
  private loadHistory: Map<string, number[]> = new Map();
  private config: LoadBalancerConfig;
  private balanceInterval: NodeJS.Timeout | null = null;
  private workStealAttempts: Map<string, number> = new Map();

  constructor(config: LoadBalancerConfig = {}) {
    this.config = {
      enablePredictive: config.enablePredictive ?? false,
      balanceInterval: config.balanceInterval ?? 1000,
      loadSmoothing: config.loadSmoothing ?? 0.5,
      enableWorkStealing: config.enableWorkStealing ?? true,
      stealThreshold: config.stealThreshold ?? 0.7,
      maxStealAttempts: config.maxStealAttempts ?? 3,
    };
  }

  /**
   * Initialize load tracking for devices
   */
  initializeDevices(devices: GPUDevice[]): void {
    for (const device of devices) {
      this.deviceLoads.set(device.device_id, {
        device,
        currentTasks: 0,
        totalTasks: 0,
        estimatedCompletionTime: Date.now(),
        utilization: 0,
        queueDepth: 0,
      });

      this.loadHistory.set(device.device_id, []);
      this.workStealAttempts.set(device.device_id, 0);
    }
  }

  /**
   * Start automatic load balancing
   */
  startBalancing(devices: GPUDevice[], callback?: () => void): void {
    this.stopBalancing();

    this.balanceInterval = setInterval(() => {
      this.rebalance(devices);
      if (callback) callback();
    }, this.config.balanceInterval);
  }

  /**
   * Stop automatic load balancing
   */
  stopBalancing(): void {
    if (this.balanceInterval) {
      clearInterval(this.balanceInterval);
      this.balanceInterval = null;
    }
  }

  /**
   * Assign task to least loaded device
   */
  assignToLeastLoaded(task: WorkTask, devices: GPUDevice[]): GPUDevice {
    if (devices.length === 0) {
      throw new Error("No devices available");
    }

    let leastLoaded = devices[0];
    let minLoad = Infinity;

    for (const device of devices) {
      const load = this.deviceLoads.get(device.device_id);
      const effectiveLoad = load ? this.calculateEffectiveLoad(load) : 0;

      if (effectiveLoad < minLoad) {
        minLoad = effectiveLoad;
        leastLoaded = device;
      }
    }

    this.incrementLoad(leastLoaded.device_id, task);

    return leastLoaded;
  }

  /**
   * Assign tasks using greedy bin packing
   */
  assignGreedy(tasks: WorkTask[], devices: GPUDevice[]): TaskAssignment[] {
    // Sort tasks by estimated time (largest first)
    const sortedTasks = [...tasks].sort(
      (a, b) => (b.estimatedTime || 100) - (a.estimatedTime || 100)
    );

    const assignments: TaskAssignment[] = [];

    for (const task of sortedTasks) {
      const device = this.assignToLeastLoaded(task, devices);
      assignments.push({
        task,
        device,
        index: assignments.length,
        expectedCompletion: this.calculateExpectedCompletion(
          device.device_id,
          task
        ),
        status: "pending",
      });
    }

    return assignments;
  }

  /**
   * Rebalance work across devices
   */
  rebalance(devices: GPUDevice[]): TaskAssignment[] {
    const allAssignments: TaskAssignment[] = [];
    const movedTasks: TaskAssignment[] = [];

    // Get current loads
    const loads = Array.from(this.deviceLoads.values());
    if (loads.length === 0) return [];

    // Calculate average load
    const avgLoad =
      loads.reduce((sum, load) => sum + this.calculateEffectiveLoad(load), 0) /
      loads.length;

    // Find overloaded and underloaded devices
    const overloaded = loads.filter(
      load => this.calculateEffectiveLoad(load) > avgLoad * 1.2
    );
    const underloaded = loads.filter(
      load => this.calculateEffectiveLoad(load) < avgLoad * 0.8
    );

    // Move tasks from overloaded to underloaded
    for (const over of overloaded) {
      for (const under of underloaded) {
        const tasksToMove = Math.floor(
          (this.calculateEffectiveLoad(over) - avgLoad) /
            (over.currentTasks || 1)
        );

        if (tasksToMove > 0) {
          // Simulate task movement (would need actual task tracking)
          movedTasks.push({
            task: {
              taskId: `moved-${over.device.device_id}-${under.device.device_id}`,
              type: "rebalance",
              inputData: new ArrayBuffer(0),
              kernel: "",
              layouts: [],
              pipelineLayout: null as any,
              pipeline: null as any,
              workgroupSizes: [1, 1, 1],
              dispatchSizes: [1, 1, 1],
              priority: 0.5,
              dependencies: [],
            },
            device: under.device,
            index: 0,
            expectedCompletion: Date.now() + 100,
            status: "pending",
          });

          this.decrementLoad(over.device.device_id);
          this.incrementLoad(under.device.device_id, {
            taskId: "rebalance",
            type: "",
            inputData: new ArrayBuffer(0),
            kernel: "",
            layouts: [],
            pipelineLayout: null as any,
            pipeline: null as any,
            workgroupSizes: [1, 1, 1],
            dispatchSizes: [1, 1, 1],
            priority: 0.5,
            dependencies: [],
          });
        }
      }
    }

    return movedTasks;
  }

  /**
   * Attempt to steal work from busy devices
   */
  async stealWork(
    fromDevice: GPUDevice,
    toDevice: GPUDevice,
    assignments: TaskAssignment[]
  ): Promise<TaskAssignment | null> {
    const fromLoad = this.deviceLoads.get(fromDevice.device_id);
    const toLoad = this.deviceLoads.get(toDevice.device_id);

    if (!fromLoad || !toLoad) return null;

    // Check if theft is warranted
    const fromEffective = this.calculateEffectiveLoad(fromLoad);
    const toEffective = this.calculateEffectiveLoad(toLoad);

    if (fromEffective < this.config.stealThreshold! || toEffective > 0.5) {
      return null;
    }

    // Check steal attempt count
    const attempts = this.workStealAttempts.get(toDevice.device_id) || 0;
    if (attempts >= this.config.maxStealAttempts!) {
      return null;
    }

    // Find a stealable task (not yet started)
    const stealable = assignments.find(
      a => a.device.device_id === fromDevice.device_id && a.status === "pending"
    );

    if (stealable) {
      this.workStealAttempts.set(toDevice.device_id, attempts + 1);

      // Update assignment
      const stolen = { ...stealable, device: toDevice };

      this.decrementLoad(fromDevice.device_id);
      this.incrementLoad(toDevice.device_id, stolen.task);

      return stolen;
    }

    return null;
  }

  /**
   * Increment load for a device
   */
  incrementLoad(deviceId: string, task: WorkTask): void {
    const load = this.deviceLoads.get(deviceId);
    if (load) {
      load.currentTasks++;
      load.totalTasks++;
      load.queueDepth++;
      load.estimatedCompletionTime = Date.now() + (task.estimatedTime || 100);

      this.recordLoadHistory(deviceId, this.calculateEffectiveLoad(load));
    }
  }

  /**
   * Decrement load for a device
   */
  decrementLoad(deviceId: string): void {
    const load = this.deviceLoads.get(deviceId);
    if (load && load.currentTasks > 0) {
      load.currentTasks--;
      if (load.queueDepth > 0) load.queueDepth--;
    }
  }

  /**
   * Update utilization for a device
   */
  updateUtilization(deviceId: string, utilization: number): void {
    const load = this.deviceLoads.get(deviceId);
    if (load) {
      // Apply smoothing
      load.utilization =
        this.config.loadSmoothing! * utilization +
        (1 - this.config.loadSmoothing!) * load.utilization;
    }
  }

  /**
   * Calculate effective load score
   */
  private calculateEffectiveLoad(load: DeviceLoad): number {
    // Combine multiple factors
    const taskWeight = 0.4;
    const queueWeight = 0.3;
    const utilWeight = 0.3;

    const normalizedTasks = Math.min(1, load.currentTasks / 10);
    const normalizedQueue = Math.min(1, load.queueDepth / 20);
    const utilization = load.utilization;

    return (
      taskWeight * normalizedTasks +
      queueWeight * normalizedQueue +
      utilWeight * utilization
    );
  }

  /**
   * Calculate expected completion time
   */
  private calculateExpectedCompletion(
    deviceId: string,
    task: WorkTask
  ): number {
    const load = this.deviceLoads.get(deviceId);
    const baseTime = Date.now();

    if (!load) {
      return baseTime + (task.estimatedTime || 100);
    }

    const queueDelay = load.queueDepth * 10; // 10ms per queued task
    const estimatedTaskTime = task.estimatedTime || 100;

    return baseTime + queueDelay + estimatedTaskTime;
  }

  /**
   * Record load history for predictive balancing
   */
  private recordLoadHistory(deviceId: string, load: number): void {
    const history = this.loadHistory.get(deviceId) || [];
    history.push(load);

    // Keep last 100 samples
    if (history.length > 100) {
      history.shift();
    }

    this.loadHistory.set(deviceId, history);
  }

  /**
   * Predict future load (if enabled)
   */
  predictLoad(deviceId: string, lookAhead: number = 1000): number {
    if (!this.config.enablePredictive) {
      const load = this.deviceLoads.get(deviceId);
      return load ? this.calculateEffectiveLoad(load) : 0;
    }

    const history = this.loadHistory.get(deviceId);
    if (!history || history.length < 10) {
      const load = this.deviceLoads.get(deviceId);
      return load ? this.calculateEffectiveLoad(load) : 0;
    }

    // Simple linear regression for prediction
    const n = Math.min(50, history.length);
    const recent = history.slice(-n);

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < recent.length; i++) {
      sumX += i;
      sumY += recent[i];
      sumXY += i * recent[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictedLoad = slope * recent.length + intercept;
    return Math.max(0, Math.min(1, predictedLoad));
  }

  /**
   * Get device statistics
   */
  getDeviceStats(deviceId: string): DeviceLoad | undefined {
    return this.deviceLoads.get(deviceId);
  }

  /**
   * Get all device statistics
   */
  getAllStats(): Map<string, DeviceLoad> {
    return new Map(this.deviceLoads);
  }

  /**
   * Get load balancer statistics
   */
  getBalancerStats(): {
    totalDevices: number;
    avgLoad: number;
    maxLoad: number;
    minLoad: number;
    loadVariance: number;
    workStealAttempts: number;
  } {
    const loads = Array.from(this.deviceLoads.values());
    const effectiveLoads = loads.map(l => this.calculateEffectiveLoad(l));

    const avgLoad =
      effectiveLoads.reduce((sum, load) => sum + load, 0) /
      effectiveLoads.length;
    const maxLoad = Math.max(...effectiveLoads);
    const minLoad = Math.min(...effectiveLoads);

    const variance =
      effectiveLoads.reduce(
        (sum, load) => sum + Math.pow(load - avgLoad, 2),
        0
      ) / effectiveLoads.length;

    const totalStealAttempts = Array.from(
      this.workStealAttempts.values()
    ).reduce((sum, attempts) => sum + attempts, 0);

    return {
      totalDevices: loads.length,
      avgLoad,
      maxLoad,
      minLoad,
      loadVariance: variance,
      workStealAttempts: totalStealAttempts,
    };
  }

  /**
   * Reset load tracking
   */
  reset(): void {
    this.deviceLoads.clear();
    this.loadHistory.clear();
    this.workStealAttempts.clear();
    this.stopBalancing();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart balancing if interval changed
    if (this.balanceInterval && config.balanceInterval) {
      const devices = Array.from(this.deviceLoads.values()).map(l => l.device);
      this.startBalancing(devices);
    }
  }
}

/**
 * Default load balancer instance
 */
export const defaultLoadBalancer = new LoadBalancer();
