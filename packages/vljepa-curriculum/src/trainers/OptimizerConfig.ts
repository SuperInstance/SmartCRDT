/**
 * Optimizer Configuration
 *
 * Manages optimizer settings and learning rate schedules
 */

import type { OptimizerConfig as IOptimizerConfig } from "../types.js";

export class OptimizerConfig {
  private config: IOptimizerConfig;
  private step: number = 0;

  constructor(config: IOptimizerConfig) {
    this.config = config;
  }

  /**
   * Get optimizer configuration
   */
  getConfig(): IOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Get current learning rate
   */
  getLearningRate(): number {
    return this.config.learningRate;
  }

  /**
   * Update learning rate
   */
  setLearningRate(lr: number): void {
    this.config.learningRate = lr;
  }

  /**
   * Increment step
   */
  incrementStep(): void {
    this.step++;
  }

  /**
   * Get current step
   */
  getStep(): number {
    return this.step;
  }

  /**
   * Reset step counter
   */
  resetStep(): void {
    this.step = 0;
  }

  /**
   * Create optimizer state for serialization
   */
  exportState(): {
    config: IOptimizerConfig;
    step: number;
  } {
    return {
      config: { ...this.config },
      step: this.step,
    };
  }

  /**
   * Import optimizer state
   */
  importState(state: { config: IOptimizerConfig; step: number }): void {
    this.config = state.config;
    this.step = state.step;
  }
}
