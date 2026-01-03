/**
 * AdaptiveThrottler - Adaptive rate throttling for SSE streams
 *
 * Dynamically adjusts throttle rates based on client performance,
 * latency, and throughput feedback.
 */

import type { ThrottleStats, ThrottleParams, SSEEvent } from "./types.js";
import { DEFAULT_THROTTLE_PARAMS } from "./types.js";

/**
 * Client throttle state
 */
interface ClientThrottleState {
  /** Client identifier */
  clientId: string;
  /** Current throttle rate (events/second) */
  currentRate: number;
  /** Original/unthrottled rate */
  originalRate: number;
  /** Target rate */
  targetRate: number;
  /** Last adjustment timestamp */
  lastAdjustment: number;
  /** Throttled event count */
  throttledCount: number;
  /** Delivered event count */
  deliveredCount: number;
  /** Latency samples */
  latencySamples: Array<{
    latency: number;
    timestamp: number;
  }>;
  /** Average latency */
  averageLatency: number;
  /** Throughput samples */
  throughputSamples: Array<{
    events: number;
    duration: number;
    timestamp: number;
  }>;
  /** Current throughput */
  currentThroughput: number;
  /** Adjustment history */
  adjustmentHistory: Array<{
    from: number;
    to: number;
    timestamp: number;
    reason: string;
  }>;
  /** Whether throttling is active */
  isActive: boolean;
}

/**
 * AdaptiveThrottler - Main class
 */
export class AdaptiveThrottler {
  private clientStates: Map<string, ClientThrottleState>;
  private params: ThrottleParams;
  private globalCounter: number;

  constructor(params?: Partial<ThrottleParams>) {
    this.clientStates = new Map();
    this.params = { ...DEFAULT_THROTTLE_PARAMS, ...params };
    this.globalCounter = 0;
  }

  /**
   * Calculate optimal throttle rate for a client
   */
  calculateThrottleRate(clientId: string): number {
    const state = this.getOrCreateState(clientId);
    const now = Date.now();

    // Calculate based on recent latency
    const recentLatency = this.getRecentAverageLatency(state, 5000); // Last 5 seconds
    const recentThroughput = this.getRecentThroughput(state, 5000);

    let targetRate = state.currentRate;

    // If latency is high, decrease rate
    if (
      recentLatency >
      this.params.target_latency + this.params.latency_tolerance
    ) {
      const excessLatency = recentLatency - this.params.target_latency;
      const decreaseFactor =
        1 - excessLatency / (this.params.target_latency * 2);
      targetRate = state.currentRate * Math.max(0.5, decreaseFactor);
    }
    // If latency is low and auto-increase is enabled, increase rate
    else if (
      this.params.auto_increase &&
      recentLatency <
        this.params.target_latency - this.params.latency_tolerance &&
      state.currentRate < state.originalRate
    ) {
      const increaseFactor = 1 + this.params.adjustment_step;
      targetRate = state.currentRate * increaseFactor;
    }

    // Clamp to min/max
    targetRate = Math.max(
      this.params.min_rate,
      Math.min(this.params.max_rate, targetRate)
    );

    // Update state
    state.targetRate = targetRate;
    state.lastAdjustment = now;

    return targetRate;
  }

  /**
   * Adjust throttle based on feedback
   */
  adjustThrottle(clientId: string, currentRate: number): number {
    const state = this.getOrCreateState(clientId);
    const previousRate = state.currentRate;
    let newRate = currentRate;

    // Clamp to limits
    newRate = Math.max(
      this.params.min_rate,
      Math.min(this.params.max_rate, newRate)
    );

    // Record adjustment
    if (previousRate !== newRate) {
      state.adjustmentHistory.push({
        from: previousRate,
        to: newRate,
        timestamp: Date.now(),
        reason: "manual_adjustment",
      });

      // Keep history limited
      if (state.adjustmentHistory.length > 100) {
        state.adjustmentHistory = state.adjustmentHistory.slice(-100);
      }
    }

    state.currentRate = newRate;
    state.lastAdjustment = Date.now();

    return newRate;
  }

  /**
   * Get throttle statistics for a client
   */
  getThrottleStats(clientId: string): ThrottleStats | null {
    const state = this.clientStates.get(clientId);
    if (!state) {
      return null;
    }

    const throttlePercent =
      state.originalRate > 0
        ? ((state.originalRate - state.currentRate) / state.originalRate) * 100
        : 0;

    return {
      current_rate: state.currentRate,
      original_rate: state.originalRate,
      throttle_percent: Math.max(0, throttlePercent),
      throttled_count: state.throttledCount,
      delivered_count: state.deliveredCount,
      avg_latency: state.averageLatency,
      last_adjustment: state.lastAdjustment,
    };
  }

  /**
   * Record a latency sample
   */
  recordLatency(clientId: string, latency: number): void {
    const state = this.getOrCreateState(clientId);

    state.latencySamples.push({
      latency,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 100;
    if (state.latencySamples.length > maxSamples) {
      state.latencySamples = state.latencySamples.slice(-maxSamples);
    }

    // Update average
    state.averageLatency = this.getRecentAverageLatency(state, 10000);
  }

  /**
   * Record a throughput sample
   */
  recordThroughput(clientId: string, events: number, duration: number): void {
    const state = this.getOrCreateState(clientId);

    state.throughputSamples.push({
      events,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 50;
    if (state.throughputSamples.length > maxSamples) {
      state.throughputSamples = state.throughputSamples.slice(-maxSamples);
    }

    // Update current throughput
    state.currentThroughput = this.getRecentThroughput(state, 10000);
  }

  /**
   * Record event delivery
   */
  recordDelivery(clientId: string, throttled: boolean): void {
    const state = this.getOrCreateState(clientId);

    if (throttled) {
      state.throttledCount++;
    } else {
      state.deliveredCount++;
    }
  }

  /**
   * Check if event should be throttled based on current rate
   */
  shouldThrottle(clientId: string, event?: SSEEvent): boolean {
    const state = this.getOrCreateState(clientId);

    if (!state.isActive) {
      return false;
    }

    // Critical events are never throttled
    if (event?.priority === "critical") {
      return false;
    }

    // Simple rate limiting based on time since last delivery
    const now = Date.now();
    const timeSinceLastAdjustment = now - state.lastAdjustment;
    const minInterval = 1000 / state.currentRate;

    return timeSinceLastAdjustment < minInterval;
  }

  /**
   * Set throttle rate for a client
   */
  setThrottleRate(clientId: string, rate: number): void {
    const state = this.getOrCreateState(clientId);
    state.currentRate = Math.max(
      this.params.min_rate,
      Math.min(this.params.max_rate, rate)
    );
    state.originalRate = Math.max(state.originalRate, state.currentRate);
    state.isActive = rate < this.params.max_rate;
  }

  /**
   * Enable/disable throttling for a client
   */
  setThrottlingActive(clientId: string, active: boolean): void {
    const state = this.getOrCreateState(clientId);
    state.isActive = active;
  }

  /**
   * Get current throttle rate
   */
  getCurrentRate(clientId: string): number {
    const state = this.clientStates.get(clientId);
    return state?.currentRate || this.params.max_rate;
  }

  /**
   * Reset throttle to original rate
   */
  resetThrottle(clientId: string): void {
    const state = this.clientStates.get(clientId);
    if (state) {
      state.currentRate = state.originalRate;
      state.isActive = false;
      state.throttledCount = 0;
    }
  }

  /**
   * Get or create client state
   */
  private getOrCreateState(clientId: string): ClientThrottleState {
    if (!this.clientStates.has(clientId)) {
      this.clientStates.set(clientId, {
        clientId,
        currentRate: this.params.max_rate,
        originalRate: this.params.max_rate,
        targetRate: this.params.max_rate,
        lastAdjustment: Date.now(),
        throttledCount: 0,
        deliveredCount: 0,
        latencySamples: [],
        averageLatency: 0,
        throughputSamples: [],
        currentThroughput: 0,
        adjustmentHistory: [],
        isActive: false,
      });
    }
    return this.clientStates.get(clientId)!;
  }

  /**
   * Get recent average latency
   */
  private getRecentAverageLatency(
    state: ClientThrottleState,
    windowMs: number
  ): number {
    const now = Date.now();
    const recentSamples = state.latencySamples.filter(
      s => now - s.timestamp < windowMs
    );

    if (recentSamples.length === 0) {
      return state.averageLatency;
    }

    const sum = recentSamples.reduce((total, s) => total + s.latency, 0);
    return sum / recentSamples.length;
  }

  /**
   * Get recent throughput
   */
  private getRecentThroughput(
    state: ClientThrottleState,
    windowMs: number
  ): number {
    const now = Date.now();
    const recentSamples = state.throughputSamples.filter(
      s => now - s.timestamp < windowMs
    );

    if (recentSamples.length === 0) {
      return state.currentThroughput;
    }

    const totalEvents = recentSamples.reduce((sum, s) => sum + s.events, 0);
    const totalDuration = recentSamples.reduce((sum, s) => sum + s.duration, 0);

    return totalDuration > 0 ? (totalEvents / totalDuration) * 1000 : 0;
  }

  /**
   * Remove client state
   */
  removeClient(clientId: string): void {
    this.clientStates.delete(clientId);
  }

  /**
   * Clear all client states
   */
  clear(): void {
    this.clientStates.clear();
  }

  /**
   * Update parameters
   */
  updateParams(params: Partial<ThrottleParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Get current parameters
   */
  getParams(): ThrottleParams {
    return { ...this.params };
  }

  /**
   * Get all client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clientStates.keys());
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalClients: number;
    activeClients: number;
    averageThrottlePercent: number;
    totalThrottled: number;
    totalDelivered: number;
    averageLatency: number;
  } {
    const states = Array.from(this.clientStates.values());
    const activeStates = states.filter(s => s.isActive);

    const throttlePercents = activeStates.map(s => {
      const stats = this.getThrottleStats(s.clientId);
      return stats?.throttle_percent || 0;
    });

    const averageThrottlePercent =
      throttlePercents.length > 0
        ? throttlePercents.reduce((sum, p) => sum + p, 0) /
          throttlePercents.length
        : 0;

    const totalThrottled = states.reduce((sum, s) => sum + s.throttledCount, 0);
    const totalDelivered = states.reduce((sum, s) => sum + s.deliveredCount, 0);

    const averageLatency =
      states.length > 0
        ? states.reduce((sum, s) => sum + s.averageLatency, 0) / states.length
        : 0;

    return {
      totalClients: states.length,
      activeClients: activeStates.length,
      averageThrottlePercent,
      totalThrottled,
      totalDelivered,
      averageLatency,
    };
  }

  /**
   * Get adjustment history for a client
   */
  getAdjustmentHistory(clientId: string): Array<{
    from: number;
    to: number;
    timestamp: number;
    reason: string;
  }> {
    const state = this.clientStates.get(clientId);
    return state?.adjustmentHistory || [];
  }

  /**
   * Auto-adjust all clients
   */
  autoAdjustAll(): Map<string, number> {
    const results = new Map<string, number>();

    for (const clientId of this.clientStates.keys()) {
      const newRate = this.calculateThrottleRate(clientId);
      this.adjustThrottle(clientId, newRate);
      results.set(clientId, newRate);
    }

    return results;
  }

  /**
   * Get recommended rate for a client based on conditions
   */
  getRecommendedRate(
    clientId: string,
    conditions: {
      latency: number;
      throughput: number;
      bufferUsage: number;
    }
  ): number {
    let rate = this.params.max_rate;

    // Decrease rate based on latency
    if (conditions.latency > this.params.target_latency) {
      const latencyFactor = this.params.target_latency / conditions.latency;
      rate *= latencyFactor;
    }

    // Decrease rate based on buffer usage
    if (conditions.bufferUsage > 0.7) {
      const bufferFactor = 1 - (conditions.bufferUsage - 0.7) / 0.3;
      rate *= Math.max(0.1, bufferFactor);
    }

    return Math.max(this.params.min_rate, Math.min(this.params.max_rate, rate));
  }
}
