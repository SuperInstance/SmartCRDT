/**
 * @lsi/vljepa-video/realtime/RealTimeScheduler
 *
 * Real-time scheduler for 30fps video processing.
 *
 * @version 1.0.0
 */

import type {
  SchedulerConfig,
  ScheduleResult,
  ScheduleDecision,
  VideoFrame,
} from "../types.js";

/**
 * Scheduling queue item
 */
interface QueueItem {
  frame: VideoFrame;
  priority: number;
  enqueueTime: number;
  deadline: number;
}

/**
 * Real-time scheduler
 *
 * Schedules frame processing to maintain 30fps target.
 */
export class RealTimeScheduler {
  private config: SchedulerConfig;
  private queue: QueueItem[] = [];
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private droppedCount: number = 0;
  private consecutiveDrops: number = 0;
  private totalLatency: number = 0;
  private latencies: number[] = [];
  private lastScheduleTime: number = 0;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Scheduler already running");
    }

    this.isRunning = true;
    this.processedCount = 0;
    this.droppedCount = 0;
    this.consecutiveDrops = 0;
    this.totalLatency = 0;
    this.latencies = [];
    this.lastScheduleTime = performance.now();
  }

  /**
   * Stop scheduler
   */
  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Schedule frame for processing
   */
  schedule(frame: VideoFrame): ScheduleDecision {
    if (!this.isRunning) {
      return {
        process: false,
        priority: 0,
        reason: "scheduler_not_running",
      };
    }

    const now = performance.now();
    const deadline = now + this.config.maxLatency;

    // Make scheduling decision based on strategy
    const decision = this.makeSchedulingDecision(frame, now, deadline);

    if (decision.process) {
      // Add to queue
      this.queue.push({
        frame,
        priority: decision.priority,
        enqueueTime: now,
        deadline,
      });

      // Sort by priority
      this.queue.sort((a, b) => b.priority - a.priority);
    } else {
      this.droppedCount++;
      this.consecutiveDrops++;

      if (this.consecutiveDrops > this.config.maxDrops) {
        // Force process to catch up
        this.consecutiveDrops = 0;
        return {
          process: true,
          priority: 100,
          qualityAdjustment: -0.2,
          reason: "force_process_catchup",
        };
      }
    }

    return decision;
  }

  /**
   * Process next frame from queue
   */
  async processNext(
    processor: (frame: VideoFrame) => Promise<number>
  ): Promise<number> {
    if (this.queue.length === 0) {
      return 0;
    }

    const item = this.queue.shift()!;
    const startTime = performance.now();

    // Process frame
    const result = await processor(item.frame);

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Record latency
    this.latencies.push(latency);
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }

    this.totalLatency += latency;
    this.processedCount++;
    this.consecutiveDrops = 0;

    return result;
  }

  /**
   * Process all queued frames
   */
  async processAll(
    processor: (frame: VideoFrame) => Promise<number>
  ): Promise<ScheduleResult> {
    const startTime = performance.now();

    let processed = 0;
    let dropped = 0;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      // Check deadline
      const now = performance.now();
      if (now > item.deadline) {
        // Drop frame
        this.queue.shift();
        dropped++;
        this.droppedCount++;
        continue;
      }

      // Process frame
      await this.processNext(processor);
      processed++;
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const avgLatency =
      this.processedCount > 0 ? this.totalLatency / this.processedCount : 0;

    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p95Latency =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const maxLatency = sortedLatencies[sortedLatencies.length - 1] || 0;

    const actualFPS = totalTime > 0 ? (processed / totalTime) * 1000 : 0;

    return {
      processed,
      dropped,
      actualFPS,
      avgLatency,
      maxLatency,
      p95Latency,
      timestamp: startTime,
    };
  }

  /**
   * Make scheduling decision
   */
  private makeSchedulingDecision(
    frame: VideoFrame,
    now: number,
    deadline: number
  ): ScheduleDecision {
    const timeSinceLastSchedule = now - this.lastScheduleTime;
    const targetFrameTime = 1000 / this.config.targetFPS;

    switch (this.config.strategy) {
      case "frame":
        return this.frameBasedDecision(
          frame,
          timeSinceLastSchedule,
          targetFrameTime
        );
      case "skip":
        return this.skipBasedDecision(
          frame,
          timeSinceLastSchedule,
          targetFrameTime
        );
      case "quality":
        return this.qualityBasedDecision(
          frame,
          timeSinceLastSchedule,
          targetFrameTime
        );
      default:
        return {
          process: true,
          priority: 50,
          reason: "default",
        };
    }
  }

  /**
   * Frame-based scheduling decision
   */
  private frameBasedDecision(
    frame: VideoFrame,
    timeSinceLast: number,
    targetFrameTime: number
  ): ScheduleDecision {
    // Process every frame
    return {
      process: true,
      priority: 50,
      reason: "frame_based_process_all",
    };
  }

  /**
   * Skip-based scheduling decision
   */
  private skipBasedDecision(
    frame: VideoFrame,
    timeSinceLast: number,
    targetFrameTime: number
  ): ScheduleDecision {
    // Skip frames if we're behind
    if (timeSinceLast < targetFrameTime * 0.8) {
      // Too soon, skip this frame
      return {
        process: false,
        priority: 0,
        reason: "skip_too_soon",
      };
    }

    // Process this frame
    return {
      process: true,
      priority: 50,
      reason: "skip_based_process",
    };
  }

  /**
   * Quality-based scheduling decision
   */
  private qualityBasedDecision(
    frame: VideoFrame,
    timeSinceLast: number,
    targetFrameTime: number
  ): ScheduleDecision {
    // Check if we're behind schedule
    const behind = timeSinceLast > targetFrameTime;

    if (behind) {
      // Reduce quality to maintain FPS
      return {
        process: true,
        priority: 50,
        qualityAdjustment: -0.2,
        reason: "quality_based_catchup",
      };
    }

    // Normal quality
    return {
      process: true,
      priority: 50,
      reason: "quality_based_normal",
    };
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    isRunning: boolean;
    queueSize: number;
    processedCount: number;
    droppedCount: number;
    dropRate: number;
    avgLatency: number;
    p95Latency: number;
    maxLatency: number;
    consecutiveDrops: number;
  } {
    const total = this.processedCount + this.droppedCount;

    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p95Latency =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const maxLatency = sortedLatencies[sortedLatencies.length - 1] || 0;

    return {
      isRunning: this.isRunning,
      queueSize: this.queue.length,
      processedCount: this.processedCount,
      droppedCount: this.droppedCount,
      dropRate: total > 0 ? this.droppedCount / total : 0,
      avgLatency:
        this.processedCount > 0 ? this.totalLatency / this.processedCount : 0,
      p95Latency,
      maxLatency,
      consecutiveDrops: this.consecutiveDrops,
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.processedCount = 0;
    this.droppedCount = 0;
    this.consecutiveDrops = 0;
    this.totalLatency = 0;
    this.latencies = [];
  }

  /**
   * Set adaptive scheduling
   */
  setAdaptive(adaptive: boolean): void {
    this.config.adaptive = adaptive;
  }

  /**
   * Get current target FPS
   */
  getTargetFPS(): number {
    return this.config.targetFPS;
  }

  /**
   * Set target FPS
   */
  setTargetFPS(fps: number): void {
    this.config.targetFPS = fps;
    this.config.frameTime = 1000 / fps;
  }
}
