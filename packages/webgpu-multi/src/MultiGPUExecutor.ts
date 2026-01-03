/**
 * @lsi/webgpu-multi - Multi-GPU Executor
 *
 * Executes compute operations across multiple GPU devices.
 */

import type {
  GPUDevice,
  WorkTask,
  TaskAssignment,
  MultiGPUResult,
  MultiGPUStats,
  CollectiveConfig,
  CollectiveOperation,
} from "./types.js";
import { SyncManager } from "./SyncManager.js";
import { DataDistributor } from "./DataDistributor.js";

/**
 * Multi-GPU Executor for parallel compute operations
 */
export class MultiGPUExecutor {
  private devices: GPUDevice[] = [];
  private syncManager: SyncManager;
  private dataDistributor: DataDistributor;
  private activeTasks: Map<string, TaskAssignment> = new Map();
  private results: Map<string, MultiGPUResult> = new Map();
  private stats: MultiGPUStats;

  constructor(devices: GPUDevice[] = []) {
    this.devices = devices;
    this.syncManager = new SyncManager();
    this.dataDistributor = new DataDistributor();
    this.stats = {
      totalDevices: devices.length,
      activeDevices: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgTaskTime: 0,
      avgUtilization: 0,
      totalDataTransferred: 0,
      totalComputeTime: 0,
      totalSyncTime: 0,
      efficiency: 0,
      speedup: 1,
    };
  }

  /**
   * Set devices for execution
   */
  setDevices(devices: GPUDevice[]): void {
    this.devices = devices;
    this.stats.totalDevices = devices.length;
  }

  /**
   * Execute a single task on a device
   */
  async executeTask(
    task: WorkTask,
    device: GPUDevice
  ): Promise<MultiGPUResult> {
    const startTime = Date.now();
    const computeStartTime = performance.now();

    const result: MultiGPUResult = {
      taskId: task.taskId,
      success: false,
      deviceResults: new Map(),
      executionTime: 0,
      transferTime: 0,
      computeTime: 0,
      syncTime: 0,
      memoryUsed: 0,
    };

    try {
      // Upload input data
      const uploadStart = performance.now();

      // Create input buffer
      const inputBuffers = await this.uploadInputData(device, task.inputData);

      const uploadEnd = performance.now();
      result.transferTime = uploadEnd - uploadStart;

      // Execute compute
      const computeEnd = await this.executeCompute(device, task, inputBuffers);
      result.computeTime = computeEnd - computeStartTime;

      // Download results
      const downloadStart = performance.now();
      const outputData = await this.downloadOutputData(device);

      result.deviceResults.set(device.device_id, outputData);
      const downloadEnd = performance.now();

      result.transferTime += downloadEnd - downloadStart;
      result.executionTime = Date.now() - startTime;
      result.success = true;

      this.updateStats(result, true);
    } catch (error) {
      result.error = error as Error;
      result.executionTime = Date.now() - startTime;
      this.updateStats(result, false);
    }

    return result;
  }

  /**
   * Execute tasks across multiple devices
   */
  async executeTasks(assignments: TaskAssignment[]): Promise<MultiGPUResult[]> {
    const results: MultiGPUResult[] = [];

    // Group by device
    const deviceTasks = new Map<GPUDevice, TaskAssignment[]>();
    for (const assignment of assignments) {
      const tasks = deviceTasks.get(assignment.device) || [];
      tasks.push(assignment);
      deviceTasks.set(assignment.device, tasks);
    }

    // Execute on each device in parallel
    const devicePromises = Array.from(deviceTasks.entries()).map(
      async ([device, tasks]) => {
        const deviceResults: MultiGPUResult[] = [];

        for (const assignment of tasks) {
          this.activeTasks.set(assignment.task.taskId, assignment);

          const result = await this.executeTask(assignment.task, device);
          deviceResults.push(result);

          this.results.set(assignment.task.taskId, result);
          this.activeTasks.delete(assignment.task.taskId);
        }

        return deviceResults;
      }
    );

    const allResults = await Promise.all(devicePromises);
    results.push(...allResults.flat());

    return results;
  }

  /**
   * Execute with collective operations
   */
  async executeCollective(config: CollectiveConfig): Promise<MultiGPUResult> {
    const startTime = Date.now();
    const syncStart = performance.now();

    const result: MultiGPUResult = {
      taskId: `collective-${config.operation}-${Date.now()}`,
      success: false,
      deviceResults: new Map(),
      executionTime: 0,
      transferTime: 0,
      computeTime: 0,
      syncTime: 0,
      memoryUsed: 0,
    };

    try {
      // Create sync point for collective operation
      const syncPoint = this.syncManager.createSyncPoint(
        config.devices,
        [],
        "barrier"
      );

      const syncEnd = performance.now();
      result.syncTime = syncEnd - syncStart;

      // Execute collective operation
      const computeStart = performance.now();

      switch (config.operation) {
        case "reduce":
          await this.collectiveReduce(config, result);
          break;
        case "allreduce":
          await this.collectiveAllReduce(config, result);
          break;
        case "broadcast":
          await this.collectiveBroadcast(config, result);
          break;
        case "scatter":
          await this.collectiveScatter(config, result);
          break;
        case "gather":
          await this.collectiveGather(config, result);
          break;
        case "alltoall":
          await this.collectiveAllToAll(config, result);
          break;
      }

      const computeEnd = performance.now();
      result.computeTime = computeEnd - computeStart;
      result.success = true;
      result.executionTime = Date.now() - startTime;

      this.syncManager.completeSync(syncPoint.syncId);
    } catch (error) {
      result.error = error as Error;
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Reduce operation (root gets sum of all data)
   */
  private async collectiveReduce(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    if (!config.root) {
      throw new Error("Reduce operation requires a root device");
    }

    // Gather data from all devices
    const gathered = await this.dataDistributor.gatherFromDevices(
      config.devices,
      new Map(config.devices.map(d => [d.device_id, null as any]))
    );

    // Perform reduction
    const data = new Float32Array(gathered);
    const chunkSize = Math.floor(data.length / config.devices.length);
    const reduced = new Float32Array(chunkSize);

    for (let i = 0; i < chunkSize; i++) {
      let sum = 0;
      for (let d = 0; d < config.devices.length; d++) {
        sum += data[i + d * chunkSize] || 0;
      }
      reduced[i] = sum;
    }

    // Store on root device
    result.deviceResults.set(config.root.device_id, reduced.buffer);
  }

  /**
   * All-reduce operation (all devices get sum)
   */
  private async collectiveAllReduce(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    // First reduce to device 0
    const reduceConfig = { ...config, root: config.devices[0] };
    await this.collectiveReduce(reduceConfig, result);

    // Then broadcast to all
    const broadcastConfig = {
      ...config,
      root: config.devices[0],
      inputData: result.deviceResults.get(config.devices[0].device_id)!,
    };
    await this.collectiveBroadcast(broadcastConfig, result);
  }

  /**
   * Broadcast operation (root sends to all)
   */
  private async collectiveBroadcast(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    if (!config.root || !config.inputData) {
      throw new Error("Broadcast operation requires root and input data");
    }

    const buffers = await this.dataDistributor.broadcastToAll(
      config.inputData,
      config.devices
    );

    for (const device of config.devices) {
      result.deviceResults.set(device.device_id, config.inputData);
    }
  }

  /**
   * Scatter operation (root splits data to all)
   */
  private async collectiveScatter(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    if (!config.root || !config.inputData) {
      throw new Error("Scatter operation requires root and input data");
    }

    const chunks = this.dataDistributor.splitData(
      config.inputData,
      config.devices.length
    );

    for (let i = 0; i < config.devices.length; i++) {
      result.deviceResults.set(config.devices[i].device_id, chunks[i]);
    }
  }

  /**
   * Gather operation (root collects from all)
   */
  private async collectiveGather(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    if (!config.root) {
      throw new Error("Gather operation requires a root device");
    }

    const gathered: ArrayBuffer[] = [];

    for (const device of config.devices) {
      const data = config.inputData?.[config.devices.indexOf(device)];
      if (data) {
        gathered.push(data);
      }
    }

    // Concatenate
    const totalSize = gathered.reduce((sum, arr) => sum + arr.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const arr of gathered) {
      combined.set(new Uint8Array(arr), offset);
      offset += arr.byteLength;
    }

    result.deviceResults.set(config.root.device_id, combined.buffer);
  }

  /**
   * All-to-all operation (each device sends to all)
   */
  private async collectiveAllToAll(
    config: CollectiveConfig,
    result: MultiGPUResult
  ): Promise<void> {
    const deviceCount = config.devices.length;

    for (let i = 0; i < deviceCount; i++) {
      const device = config.devices[i];
      const chunks: ArrayBuffer[] = [];

      for (let j = 0; j < deviceCount; j++) {
        const data = config.inputData?.[j];
        if (data) {
          const chunkSize = Math.floor(data.byteLength / deviceCount);
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, data.byteLength);
          chunks.push(data.slice(start, end));
        }
      }

      // Combine chunks for this device
      const totalSize = chunks.reduce((sum, arr) => sum + arr.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      result.deviceResults.set(device.device_id, combined.buffer);
    }
  }

  /**
   * Upload input data to device
   */
  private async uploadInputData(
    device: GPUDevice,
    data: ArrayBuffer | ArrayBuffer[]
  ): Promise<GPUBuffer[]> {
    const buffers: GPUBuffer[] = [];
    const dataArray = Array.isArray(data) ? data : [data];

    for (const chunk of dataArray) {
      const buffer = device.device.createBuffer({
        size: chunk.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(chunk));
      buffer.unmap();

      buffers.push(buffer);
    }

    return buffers;
  }

  /**
   * Execute compute on device
   */
  private async executeCompute(
    device: GPUDevice,
    task: WorkTask,
    buffers: GPUBuffer[]
  ): Promise<number> {
    // Create bind groups
    const bindGroups = buffers.map((buffer, i) =>
      device.device.createBindGroup({
        layout: task.layouts[i] || task.pipeline.getBindGroupLayout(0),
        entries: [{ binding: i, resource: { buffer } }],
      })
    );

    // Create command encoder
    const commandEncoder = device.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(task.pipeline);
    bindGroups.forEach((group, i) => passEncoder.setBindGroup(i, group));
    passEncoder.dispatchWorkgroups(
      task.dispatchSizes[0],
      task.dispatchSizes[1],
      task.dispatchSizes[2]
    );
    passEncoder.end();

    // Submit commands
    device.device.queue.submit([commandEncoder.finish()]);

    // Wait for completion
    await device.device.queue.onSubmittedWorkDone();

    return performance.now();
  }

  /**
   * Download output data from device
   */
  private async downloadOutputData(device: GPUDevice): Promise<ArrayBuffer> {
    // This would need actual buffer reference - simplified
    return new ArrayBuffer(0);
  }

  /**
   * Update statistics
   */
  private updateStats(result: MultiGPUResult, success: boolean): void {
    this.stats.totalTasks++;

    if (success) {
      this.stats.completedTasks++;
      this.stats.totalComputeTime += result.computeTime;
      this.stats.totalSyncTime += result.syncTime;
      this.stats.avgTaskTime =
        (this.stats.avgTaskTime * (this.stats.completedTasks - 1) +
          result.executionTime) /
        this.stats.completedTasks;
    } else {
      this.stats.failedTasks++;
    }

    // Calculate efficiency
    if (this.stats.totalDevices > 1) {
      const totalTime = result.computeTime + result.syncTime;
      const idealTime = result.computeTime / this.stats.totalDevices;
      this.stats.efficiency = idealTime / totalTime;
      this.stats.speedup = totalTime / idealTime;
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): MultiGPUStats {
    return { ...this.stats };
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskAssignment[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get result for a task
   */
  getResult(taskId: string): MultiGPUResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (task) {
      this.activeTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active tasks
   */
  cancelAll(): void {
    this.activeTasks.clear();
  }

  /**
   * Reset executor state
   */
  reset(): void {
    this.activeTasks.clear();
    this.results.clear();
    this.stats = {
      totalDevices: this.devices.length,
      activeDevices: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgTaskTime: 0,
      avgUtilization: 0,
      totalDataTransferred: 0,
      totalComputeTime: 0,
      totalSyncTime: 0,
      efficiency: 0,
      speedup: 1,
    };
  }
}

/**
 * Default multi-GPU executor instance
 */
export const defaultMultiGPUExecutor = new MultiGPUExecutor();
