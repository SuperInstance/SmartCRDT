/**
 * AutoScaler - Test automatic scaling behavior
 * Validates that auto-scaling works correctly under varying load.
 */

import type { TestRequest, ResourceLimits, PerformanceMetrics } from '../types.js';

export interface AutoScaleConfig {
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number; // CPU/Load percentage
  scaleDownThreshold: number;
  cooldownPeriod: number;
  targetLoad: number;
  scaleTestDuration: number;
}

export interface AutoScaleResult {
  scalingEvents: ScalingEvent[];
  scaleUpCount: number;
  scaleDownCount: number;
  avgResponseTime: number;
  scaleUpLatency: number;
  scaleDownLatency: number;
  overshoots: number;
  undershoots: number;
  stable: boolean;
  recommendation: string;
}

export interface ScalingEvent {
  type: 'up' | 'down';
  timestamp: number;
  fromInstances: number;
  toInstances: number;
  trigger: string;
  latency: number;
  loadBeforeScale: number;
  loadAfterScale: number;
}

export interface AutoScaleExecutor {
  execute(request: TestRequest): Promise<{ success: boolean; latency: number; error?: string }>;
  getInstanceCount(): Promise<number>;
  getCurrentLoad(): Promise<number>;
  waitForScaling(targetInstances: number): Promise<number>;
  setAutoScalingPolicy(policy: AutoScaleConfig): Promise<boolean>;
}

export class AutoScaler {
  /**
   * Execute auto-scaling test
   */
  async execute(
    config: AutoScaleConfig,
    executor: AutoScaleExecutor
  ): Promise<AutoScaleResult> {
    // Set auto-scaling policy
    await executor.setAutoScalingPolicy(config);

    const scalingEvents: ScalingEvent[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < config.scaleTestDuration) {
      // Get current state
      const instancesBefore = await executor.getInstanceCount();
      const loadBefore = await executor.getCurrentLoad();

      // Apply load
      await this.applyLoad(executor, config.targetLoad);

      // Check if scaling occurred
      await this.sleep(5000); // Wait for scaling decision

      const instancesAfter = await executor.getInstanceCount();

      // Detect scaling event
      if (instancesAfter !== instancesBefore) {
        const scaleLatency = await this.measureScaleLatency(executor, instancesAfter);
        const loadAfter = await executor.getCurrentLoad();

        const event: ScalingEvent = {
          type: instancesAfter > instancesBefore ? 'up' : 'down',
          timestamp: Date.now(),
          fromInstances: instancesBefore,
          toInstances: instancesAfter,
          trigger: instancesAfter > instancesBefore ? 'high_load' : 'low_load',
          latency: scaleLatency,
          loadBeforeScale: loadBefore,
          loadAfterScale: loadAfter
        };

        scalingEvents.push(event);

        // Wait for cooldown
        await this.sleep(config.cooldownPeriod);
      }
    }

    // Analyze results
    const scaleUpCount = scalingEvents.filter(e => e.type === 'up').length;
    const scaleDownCount = scalingEvents.filter(e => e.type === 'down').length;
    const avgResponseTime = await this.measureAvgResponseTime(executor);
    const scaleUpLatency = this.getAvgScaleLatency(scalingEvents, 'up');
    const scaleDownLatency = this.getAvgScaleLatency(scalingEvents, 'down');
    const overshoots = this.countOvershoots(scalingEvents, config);
    const undershoots = this.countUndershoots(scalingEvents, config);
    const stable = this.isStable(scalingEvents, config);

    const recommendation = this.generateRecommendation(
      scaleUpLatency,
      scaleDownLatency,
      overshoots,
      undershoots,
      stable
    );

    return {
      scalingEvents,
      scaleUpCount,
      scaleDownCount,
      avgResponseTime,
      scaleUpLatency,
      scaleDownLatency,
      overshoots,
      undershoots,
      stable,
      recommendation
    };
  }

  /**
   * Apply load to trigger scaling
   */
  private async applyLoad(executor: AutoScaleExecutor, targetLoad: number): Promise<void> {
    const requestCount = Math.ceil(targetLoad / 10);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < requestCount; i++) {
      promises.push(
        (async () => {
          const request = this.generateRequest(i);
          await executor.execute(request);
        })()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Measure scaling latency
   */
  private async measureScaleLatency(
    executor: AutoScaleExecutor,
    targetInstances: number
  ): Promise<number> {
    const startTime = Date.now();

    try {
      await executor.waitForScaling(targetInstances);
      return Date.now() - startTime;
    } catch {
      return -1; // Failed to scale
    }
  }

  /**
   * Measure average response time
   */
  private async measureAvgResponseTime(executor: AutoScaleExecutor): Promise<number> {
    const latencies: number[] = [];
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const request = this.generateRequest(i);
      const start = performance.now();

      try {
        await executor.execute(request);
        latencies.push(performance.now() - start);
      } catch {
        // Ignore errors
      }
    }

    return latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
  }

  /**
   * Get average scale latency for direction
   */
  private getAvgScaleLatency(events: ScalingEvent[], type: 'up' | 'down'): number {
    const filtered = events.filter(e => e.type === type);

    if (filtered.length === 0) return 0;

    return filtered.reduce((sum, e) => sum + e.latency, 0) / filtered.length;
  }

  /**
   * Count overshoots (scaled too much)
   */
  private countOvershoots(events: ScalingEvent[], config: AutoScaleConfig): number {
    let overshoots = 0;

    for (const event of events) {
      if (event.type === 'up' && event.toInstances === config.maxInstances) {
        // Check if load dropped significantly after max scale
        if (event.loadAfterScale < config.scaleUpThreshold * 0.5) {
          overshoots++;
        }
      }
    }

    return overshoots;
  }

  /**
   * Count undershoots (didn't scale enough)
   */
  private countUndershoots(events: ScalingEvent[], config: AutoScaleConfig): number {
    let undershoots = 0;

    for (const event of events) {
      if (event.type === 'up' && event.loadAfterScale > config.scaleUpThreshold * 1.1) {
        undershoots++;
      }
    }

    return undershoots;
  }

  /**
   * Check if auto-scaling is stable
   */
  private isStable(events: ScalingEvent[], config: AutoScaleConfig): boolean {
    // Stable if:
    // 1. No rapid up-down oscillations
    // 2. Scaling latency is reasonable
    // 3. No excessive overshoots/undershoots

    // Check for oscillations (rapid up-down)
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];

      if (prev.type === 'up' && curr.type === 'down') {
        const timeBetween = curr.timestamp - prev.timestamp;
        if (timeBetween < config.cooldownPeriod * 2) {
          return false; // Oscillating
        }
      }
    }

    // Check scaling latency
    const avgScaleUpLatency = this.getAvgScaleLatency(events, 'up');
    if (avgScaleUpLatency > 60000) { // More than 1 minute
      return false;
    }

    return true;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    scaleUpLatency: number,
    scaleDownLatency: number,
    overshoots: number,
    undershoots: number,
    stable: boolean
  ): string {
    const parts: string[] = [];

    if (stable && overshoots === 0 && undershoots === 0) {
      parts.push('EXCELLENT: Auto-scaling is working correctly.');
      parts.push(`- Scale up latency: ${scaleUpLatency / 1000.toFixed(1)}s`);
      parts.push(`- Scale down latency: ${scaleDownLatency / 1000.toFixed(1)}s`);
      return parts.join('\n');
    }

    if (!stable) {
      parts.push('UNSTABLE: Auto-scaling is oscillating.');
      parts.push('- Consider increasing cooldown period');
      parts.push('- Adjust scaling thresholds to reduce flapping');
    }

    if (overshoots > 0) {
      parts.push(`OVERSHOOTS: Detected ${overshoots} overshoot events.`);
      parts.push('- Consider reducing max instances or adjusting scale-up threshold');
    }

    if (undershoots > 0) {
      parts.push(`UNDERSHOOTS: Detected ${undershoots} undershoot events.`);
      parts.push('- Increase max instances or adjust scale-up increment');
    }

    if (scaleUpLatency > 60000) {
      parts.push('SLOW SCALE UP: Scale-up latency is too high.');
      parts.push('- Optimize instance provisioning time');
      parts.push('- Consider using warm standby instances');
    }

    if (parts.length === 0) {
      parts.push('Auto-scaling is acceptable but could be optimized.');
    }

    return parts.join('\n');
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `autoscale-req-${Date.now()}-${id}`,
      type: 'autoscale_test',
      payload: { autoscale: true },
      timestamp: Date.now(),
      timeout: 30000
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
