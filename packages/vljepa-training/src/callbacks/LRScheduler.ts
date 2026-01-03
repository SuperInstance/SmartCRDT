/**
 * @fileoverview Learning rate scheduler callback for training
 * @package @lsi/vljepa-training
 */

import type {
  LRSchedulerConfig,
  LRScheduleConfig,
} from '../types.js';

/**
 * Learning rate scheduler
 *
 * Adjusts learning rate during training according to schedule:
 * - Step decay: Decay by gamma every N epochs
 * - Cosine annealing: Cosine decay to min LR
 * - Warmup + cosine: Warmup then cosine decay
 * - One cycle: Rise then fall
 * - Reduce on plateau: Reduce when metric plateaus
 */
export class LRScheduler {
  private config: LRSchedulerConfig;
  private currentLR: number;
  private initialLR: number;
  private epoch = 0;
  private bestValue: number | null = null;
  private wait = 0;

  constructor(config: LRSchedulerConfig) {
    this.config = config;
    const settings = config.settings;

    this.initialLR = settings.initialLR ?? settings.maxLR ?? 0.001;
    this.currentLR = this.initialLR;
  }

  /**
   * Get learning rate for current epoch
   */
  getLR(epoch: number): number {
    const settings = this.config.settings;

    switch (settings.type) {
      case 'step':
        return this.stepLR(epoch, settings);
      case 'cosine':
        return this.cosineLR(epoch, settings);
      case 'warmup_cosine':
        return this.warmupCosineLR(epoch, settings);
      case 'one_cycle':
        return this.oneCycleLR(epoch, settings);
      case 'reduce_on_plateau':
        return this.reduceOnPlateauLR(epoch, settings);
      default:
        return this.initialLR;
    }
  }

  /**
   * Step to next epoch and get learning rate
   */
  step(epoch: number): number {
    this.epoch = epoch;
    this.currentLR = this.getLR(epoch);
    return this.currentLR;
  }

  /**
   * Step decay: LR * gamma^(epoch // step_size)
   */
  private stepLR(epoch: number, settings: LRScheduleConfig): number {
    const stepSize = settings.stepSize ?? 10;
    const gamma = settings.gamma ?? 0.1;

    return this.initialLR * Math.pow(gamma, Math.floor(epoch / stepSize));
  }

  /**
   * Cosine annealing: min_lr + 0.5 * (lr - min_lr) * (1 + cos(pi * epoch / total))
   */
  private cosineLR(epoch: number, settings: LRScheduleConfig): number {
    const minLR = settings.minLR ?? 0;
    const totalEpochs = settings.totalEpochs;

    return minLR + 0.5 * (this.initialLR - minLR) *
      (1 + Math.cos(Math.PI * epoch / totalEpochs));
  }

  /**
   * Warmup + cosine annealing
   */
  private warmupCosineLR(epoch: number, settings: LRScheduleConfig): number {
    const warmupEpochs = settings.warmupEpochs ?? 5;
    const minLR = settings.minLR ?? 0;
    const totalEpochs = settings.totalEpochs;
    const maxLR = settings.maxLR ?? this.initialLR;

    if (epoch < warmupEpochs) {
      // Linear warmup
      return this.initialLR + (maxLR - this.initialLR) * (epoch / warmupEpochs);
    } else {
      // Cosine decay from warmup end
      const remainingEpochs = totalEpochs - warmupEpochs;
      const currentEpoch = epoch - warmupEpochs;

      return minLR + 0.5 * (maxLR - minLR) *
        (1 + Math.cos(Math.PI * currentEpoch / remainingEpochs));
    }
  }

  /**
   * One cycle: Rise to max LR then decay to min LR
   */
  private oneCycleLR(epoch: number, settings: LRScheduleConfig): number {
    const totalEpochs = settings.totalEpochs;
    const maxLR = settings.maxLR ?? this.initialLR * 10;
    const minLR = settings.minLR ?? this.initialLR / 10;
    const cycleLength = settings.cycleLength ?? Math.floor(totalEpochs / 2);

    if (epoch < cycleLength) {
      // Rise phase
      return minLR + (maxLR - minLR) * (epoch / cycleLength);
    } else {
      // Decay phase
      const remainingEpochs = totalEpochs - cycleLength;
      const currentEpoch = epoch - cycleLength;

      return maxLR - (maxLR - minLR) * (currentEpoch / remainingEpochs);
    }
  }

  /**
   * Reduce on plateau: Reduce LR when metric stops improving
   */
  private reduceOnPlateauLR(epoch: number, settings: LRScheduleConfig): number {
    // This needs to be called with actual metric value
    // For now, return current LR
    return this.currentLR;
  }

  /**
   * Update for reduce on plateau with actual metric value
   */
  updateReduceOnPlateau(value: number): number {
    const settings = this.config.settings;
    const gamma = settings.gamma ?? 0.1;
    const patience = 5;

    if (this.bestValue === null) {
      this.bestValue = value;
      return this.currentLR;
    }

    // Check if improved
    if (value > this.bestValue) {
      this.bestValue = value;
      this.wait = 0;
    } else {
      this.wait++;

      if (this.wait >= patience) {
        this.currentLR *= gamma;
        this.wait = 0;
        this.bestValue = null;
        console.log(`[LRScheduler] Reducing LR to ${this.currentLR:.6f}`);
      }
    }

    return this.currentLR;
  }

  /**
   * Get current learning rate
   */
  getCurrentLR(): number {
    return this.currentLR;
  }

  /**
   * Set learning rate manually
   */
  setLR(lr: number): void {
    this.currentLR = lr;
    console.log(`[LRScheduler] Set LR to ${lr:.6f}`);
  }

  /**
   * Reset scheduler state
   */
  reset(): void {
    this.currentLR = this.initialLR;
    this.epoch = 0;
    this.bestValue = null;
    this.wait = 0;
    console.log('[LRScheduler] Reset state');
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.config.enabled;
  }

  /**
   * Get schedule type
   */
  getScheduleType(): string {
    return this.config.settings.type;
  }
}
