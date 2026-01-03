/**
 * @lsi/vljepa-video/quality/BitrateAdapter
 *
 * Bitrate adapter for adapting video bitrate dynamically.
 *
 * @version 1.0.0
 */

import type { BitrateAdapterConfig } from "../types.js";

/**
 * Bitrate adapter
 *
 * Dynamically adapts video bitrate based on network conditions.
 */
export class BitrateAdapter {
  private config: BitrateAdapterConfig;
  private currentBitrate: number;
  private bitrateHistory: Array<{ bitrate: number; timestamp: number }> = [];
  private lastAdaptation: number = 0;

  constructor(config: BitrateAdapterConfig) {
    this.config = {
      targetBitrate: config.targetBitrate || 5,
      minBitrate: config.minBitrate || 1,
      maxBitrate: config.maxBitrate || 10,
      adaptationInterval: config.adaptationInterval || 1000,
      useVBR: config.useVBR !== false,
    };

    this.currentBitrate = this.config.targetBitrate;
  }

  /**
   * Adapt bitrate based on conditions
   */
  adapt(conditions: {
    bandwidth?: number;
    packetLoss?: number;
    rtt?: number;
    bufferLevel?: number;
  }): {
    newBitrate: number;
    oldBitrate: number;
    reason: string;
    direction: "up" | "down" | "none";
  } {
    const now = performance.now();

    // Check adaptation interval
    if (now - this.lastAdaptation < this.config.adaptationInterval) {
      return {
        newBitrate: this.currentBitrate,
        oldBitrate: this.currentBitrate,
        reason: "too_soon",
        direction: "none",
      };
    }

    const oldBitrate = this.currentBitrate;
    let newBitrate = oldBitrate;
    let direction: "up" | "down" | "none" = "none";
    let reason = "no_change";

    // Bandwidth-based adaptation
    if (conditions.bandwidth !== undefined) {
      const targetBitrate = conditions.bandwidth * 0.8; // Use 80% of available bandwidth

      if (targetBitrate > this.currentBitrate * 1.2) {
        // Can increase
        newBitrate = Math.min(
          this.config.maxBitrate,
          this.currentBitrate * 1.2
        );
        direction = "up";
        reason = "bandwidth_available";
      } else if (targetBitrate < this.currentBitrate * 0.8) {
        // Need to decrease
        newBitrate = Math.max(
          this.config.minBitrate,
          this.currentBitrate * 0.8
        );
        direction = "down";
        reason = "bandwidth_limited";
      }
    }

    // Packet loss-based adaptation
    if (conditions.packetLoss !== undefined && conditions.packetLoss > 0.05) {
      // High packet loss, reduce bitrate
      newBitrate = Math.max(
        this.config.minBitrate,
        this.currentBitrate * (1 - conditions.packetLoss)
      );
      direction = "down";
      reason = "packet_loss";
    }

    // RTT-based adaptation
    if (conditions.rtt !== undefined && conditions.rtt > 200) {
      // High RTT, reduce bitrate
      newBitrate = Math.max(this.config.minBitrate, this.currentBitrate * 0.9);
      direction = "down";
      reason = "high_rtt";
    }

    // Buffer-based adaptation
    if (conditions.bufferLevel !== undefined) {
      if (conditions.bufferLevel < 2) {
        // Low buffer, reduce bitrate
        newBitrate = Math.max(
          this.config.minBitrate,
          this.currentBitrate * 0.8
        );
        direction = "down";
        reason = "low_buffer";
      } else if (conditions.bufferLevel > 10) {
        // High buffer, can increase bitrate
        newBitrate = Math.min(
          this.config.maxBitrate,
          this.currentBitrate * 1.1
        );
        direction = "up";
        reason = "high_buffer";
      }
    }

    // Clamp to min/max
    newBitrate = Math.max(
      this.config.minBitrate,
      Math.min(this.config.maxBitrate, newBitrate)
    );

    // Apply change
    if (newBitrate !== oldBitrate) {
      this.currentBitrate = newBitrate;
      this.lastAdaptation = now;

      this.bitrateHistory.push({
        bitrate: newBitrate,
        timestamp: now,
      });

      // Trim history
      if (this.bitrateHistory.length > 100) {
        this.bitrateHistory.shift();
      }
    }

    return {
      newBitrate,
      oldBitrate,
      reason,
      direction,
    };
  }

  /**
   * Get current bitrate
   */
  getCurrentBitrate(): number {
    return this.currentBitrate;
  }

  /**
   * Set current bitrate
   */
  setCurrentBitrate(bitrate: number): void {
    this.currentBitrate = Math.max(
      this.config.minBitrate,
      Math.min(this.config.maxBitrate, bitrate)
    );
  }

  /**
   * Get bitrate statistics
   */
  getStats(): {
    currentBitrate: number;
    targetBitrate: number;
    minBitrate: number;
    maxBitrate: number;
    avgBitrate: number;
    adaptationCount: number;
    useVBR: boolean;
  } {
    const avgBitrate =
      this.bitrateHistory.length > 0
        ? this.bitrateHistory.reduce((sum, h) => sum + h.bitrate, 0) /
          this.bitrateHistory.length
        : this.currentBitrate;

    return {
      currentBitrate: this.currentBitrate,
      targetBitrate: this.config.targetBitrate,
      minBitrate: this.config.minBitrate,
      maxBitrate: this.config.maxBitrate,
      avgBitrate,
      adaptationCount: this.bitrateHistory.length,
      useVBR: this.config.useVBR,
    };
  }

  /**
   * Reset adapter
   */
  reset(): void {
    this.currentBitrate = this.config.targetBitrate;
    this.bitrateHistory = [];
    this.lastAdaptation = 0;
  }
}
