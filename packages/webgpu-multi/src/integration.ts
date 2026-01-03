/**
 * @lsi/webgpu-multi - Integration Layer
 *
 * Integration with VL-JEPA and other Aequor components for multi-GPU inference.
 */

import type {
  GPUDevice,
  MultiGPUConfig,
  WorkTask,
  MultiGPUResult,
  WorkDistribution,
} from "./types.js";
import { DeviceManager } from "./DeviceManager.js";
import { WorkDistributor } from "./WorkDistributor.js";
import { SyncManager } from "./SyncManager.js";
import { DataDistributor } from "./DataDistributor.js";
import { LoadBalancer } from "./LoadBalancer.js";
import { MultiGPUExecutor } from "./MultiGPUExecutor.js";
import { GPUSelector } from "./GPUSelector.js";

/**
 * Multi-GPU inference configuration
 */
export interface MultiGPUInferenceConfig {
  /** Number of GPUs to use (0 = all available) */
  gpuCount?: number;
  /** Work distribution strategy */
  distribution?: WorkDistribution;
  /** Batch size per GPU */
  batchSize?: number;
  /** Whether to enable pipeline parallelism */
  enablePipeline?: boolean;
  /** Whether to enable data parallelism */
  enableDataParallel?: boolean;
}

/**
 * VL-JEPA multi-GPU inference wrapper
 */
export class MultiGPUVLJEPAInference {
  private deviceManager: DeviceManager;
  private workDistributor: WorkDistributor;
  private syncManager: SyncManager;
  private dataDistributor: DataDistributor;
  private loadBalancer: LoadBalancer;
  private executor: MultiGPUExecutor;
  private gpuSelector: GPUSelector;
  private devices: GPUDevice[] = [];
  private config: MultiGPUConfig;

  constructor(config: MultiGPUConfig) {
    this.deviceManager = new DeviceManager();
    this.workDistributor = new WorkDistributor(config.workDistribution);
    this.syncManager = new SyncManager();
    this.dataDistributor = new DataDistributor();
    this.loadBalancer = new LoadBalancer();
    this.executor = new MultiGPUExecutor();
    this.gpuSelector = new GPUSelector();
    this.config = config;
  }

  /**
   * Initialize multi-GPU system
   */
  async initialize(): Promise<void> {
    // Enumerate and create devices
    this.devices = await this.deviceManager.createAllDevices();

    // Limit to max devices if specified
    if (this.config.maxDevices && this.config.maxDevices > 0) {
      const selected = await this.gpuSelector.selectDevices(
        this.devices,
        this.config.maxDevices
      );
      this.devices = selected;
    }

    // Initialize executor with devices
    this.executor.setDevices(this.devices);

    // Initialize load balancer
    if (this.config.enableLoadBalancing) {
      this.loadBalancer.initializeDevices(this.devices);
    }
  }

  /**
   * Run VL-JEPA inference on multiple GPUs
   */
  async runInference(
    frames: ArrayBuffer[],
    inferenceFn: (frame: ArrayBuffer, device: GPUDevice) => Promise<ArrayBuffer>
  ): Promise<ArrayBuffer[]> {
    if (this.devices.length === 0) {
      throw new Error("No devices available. Call initialize() first.");
    }

    // Distribute frames across devices
    const distribution = this.dataDistributor.createDistribution(
      frames[0], // Use first frame as template
      this.devices,
      false // No replication for inference
    );

    // Create tasks
    const tasks: WorkTask[] = frames.map((frame, i) => ({
      taskId: `inference-${i}`,
      type: "inference",
      inputData: frame,
      kernel: "", // Not used for inference
      layouts: [],
      pipelineLayout: null as any,
      pipeline: null as any,
      workgroupSizes: [1, 1, 1],
      dispatchSizes: [1, 1, 1],
      priority: 0.5,
      dependencies: [],
    }));

    // Assign tasks to devices
    const assignments = this.workDistributor.distributeTasks(
      tasks,
      this.devices
    );

    // Execute inference
    const results: ArrayBuffer[] = [];

    for (const assignment of assignments) {
      try {
        const result = await inferenceFn(
          assignment.task.inputData,
          assignment.device
        );
        results.push(result);
      } catch (error) {
        console.error(
          `Inference failed for task ${assignment.task.taskId}:`,
          error
        );
        results.push(new ArrayBuffer(0));
      }
    }

    return results;
  }

  /**
   * Run batch inference
   */
  async runBatchInference(
    batches: ArrayBuffer[][],
    inferenceFn: (
      batch: ArrayBuffer[],
      device: GPUDevice
    ) => Promise<ArrayBuffer[]>
  ): Promise<ArrayBuffer[][]> {
    // Assign each batch to a device
    const assignments: Array<{ batch: ArrayBuffer[]; device: GPUDevice }> = [];

    for (let i = 0; i < batches.length; i++) {
      const device = this.devices[i % this.devices.length];
      assignments.push({ batch: batches[i], device });
    }

    // Execute in parallel
    const results = await Promise.all(
      assignments.map(async ({ batch, device }) => {
        return inferenceFn(batch, device);
      })
    );

    return results;
  }

  /**
   * Run pipeline inference
   */
  async runPipelineInference(
    frames: ArrayBuffer[],
    pipelineFn: (
      frame: ArrayBuffer,
      stage: number,
      device: GPUDevice
    ) => Promise<ArrayBuffer>,
    stages: number
  ): Promise<ArrayBuffer[]> {
    // Create pipeline stages
    const stageDevices = await this.gpuSelector.selectDevicesForPipeline(
      this.devices,
      Math.min(stages, this.devices.length)
    );

    // Process frames through pipeline
    let currentData = frames;

    for (let stage = 0; stage < stages; stage++) {
      const device = stageDevices[stage % stageDevices.length];
      const stageResults: ArrayBuffer[] = [];

      for (const frame of currentData) {
        const result = await pipelineFn(frame, stage, device);
        stageResults.push(result);
      }

      currentData = stageResults;
    }

    return currentData;
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      devices: this.devices.length,
      executor: this.executor.getStats(),
      balancer: this.loadBalancer.getBalancerStats(),
      sync: this.syncManager.getStats(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.deviceManager.destroyAllDevices();
    this.executor.reset();
    this.loadBalancer.reset();
    this.syncManager.reset();
  }
}

/**
 * Batch processing utilities
 */
export class MultiGPUBatchProcessor {
  private devices: GPUDevice[] = [];
  private dataDistributor: DataDistributor;
  private executor: MultiGPUExecutor;

  constructor(devices: GPUDevice[]) {
    this.devices = devices;
    this.dataDistributor = new DataDistributor();
    this.executor = new MultiGPUExecutor();
    this.executor.setDevices(devices);
  }

  /**
   * Process batch across multiple GPUs
   */
  async processBatch<T>(
    items: T[],
    processFn: (item: T, device: GPUDevice) => Promise<T>,
    strategy: WorkDistribution = "round-robin"
  ): Promise<T[]> {
    // Distribute items
    const chunks = this.splitBatch(items, this.devices.length);

    // Process each chunk on a device
    const results = await Promise.all(
      chunks.map(async (chunk, i) => {
        const device = this.devices[i % this.devices.length];
        const processed = await Promise.all(
          chunk.map(item => processFn(item, device))
        );
        return processed;
      })
    );

    // Combine results
    return results.flat();
  }

  /**
   * Split batch into chunks
   */
  private splitBatch<T>(items: T[], chunkCount: number): T[][] {
    const chunks: T[][] = [];
    const chunkSize = Math.ceil(items.length / chunkCount);

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    return chunks;
  }
}

/**
 * Model parallelism utilities
 */
export class ModelParallelProcessor {
  private devices: GPUDevice[] = [];
  private syncManager: SyncManager;

  constructor(devices: GPUDevice[]) {
    this.devices = devices;
    this.syncManager = new SyncManager();
  }

  /**
   * Split model across devices
   */
  async splitAndExecute(
    input: ArrayBuffer,
    layers: Array<
      (data: ArrayBuffer, device: GPUDevice) => Promise<ArrayBuffer>
    >
  ): Promise<ArrayBuffer> {
    let currentData = input;

    // Assign layers to devices in round-robin
    for (let i = 0; i < layers.length; i++) {
      const device = this.devices[i % this.devices.length];
      const layer = layers[i];

      currentData = await layer(currentData, device);
    }

    return currentData;
  }
}

/**
 * Create multi-GPU inference system
 */
export async function createMultiGPUInference(
  config: MultiGPUInferenceConfig = {}
): Promise<MultiGPUVLJEPAInference> {
  const multiGPUConfig: MultiGPUConfig = {
    devices: [],
    workDistribution: config.distribution || "data-parallel",
    syncStrategy: "barrier",
    maxDevices: config.gpuCount || 0,
    enableLoadBalancing: true,
    enableWorkStealing: true,
  };

  const inference = new MultiGPUVLJEPAInference(multiGPUConfig);
  await inference.initialize();

  return inference;
}

/**
 * Quick inference with auto device selection
 */
export async function quickMultiGPUInference(
  frames: ArrayBuffer[],
  inferenceFn: (frame: ArrayBuffer, device: GPUDevice) => Promise<ArrayBuffer>,
  config: MultiGPUInferenceConfig = {}
): Promise<ArrayBuffer[]> {
  const inference = await createMultiGPUInference(config);

  try {
    const results = await inference.runInference(frames, inferenceFn);
    return results;
  } finally {
    inference.cleanup();
  }
}
