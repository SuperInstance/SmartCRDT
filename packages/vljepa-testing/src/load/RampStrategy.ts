/**
 * RampStrategy - Defines how load is ramped up and down during tests
 * Supports various ramp patterns for different testing scenarios.
 */

import type { LoadTestConfig } from "../types.js";

export type RampType = "linear" | "exponential" | "step" | "custom";

export interface RampStrategy {
  type: RampType;
  getCurrentLoad(elapsedTime: number, config: LoadTestConfig): number;
  getTotalRampTime(config: LoadTestConfig): number;
}

/**
 * Linear ramp strategy - increases load at a constant rate
 */
export class LinearRampStrategy implements RampStrategy {
  type: RampType = "linear";

  getCurrentLoad(elapsedTime: number, config: LoadTestConfig): number {
    const rampUpDuration = config.rampUpDuration;
    const sustainDuration = config.sustainDuration;
    const rampDownDuration = config.rampDownDuration;
    const totalRampTime = rampUpDuration + sustainDuration + rampDownDuration;

    if (elapsedTime < 0) {
      return 0;
    } else if (elapsedTime < rampUpDuration) {
      // Ramping up
      return (elapsedTime / rampUpDuration) * config.concurrentUsers;
    } else if (elapsedTime < rampUpDuration + sustainDuration) {
      // Sustaining
      return config.concurrentUsers;
    } else if (elapsedTime < totalRampTime) {
      // Ramping down
      const rampDownElapsed = elapsedTime - rampUpDuration - sustainDuration;
      return config.concurrentUsers * (1 - rampDownElapsed / rampDownDuration);
    } else {
      return 0;
    }
  }

  getTotalRampTime(config: LoadTestConfig): number {
    return (
      config.rampUpDuration + config.sustainDuration + config.rampDownDuration
    );
  }
}

/**
 * Exponential ramp strategy - increases load exponentially
 * Useful for finding breaking points quickly
 */
export class ExponentialRampStrategy implements RampStrategy {
  type: RampType = "exponential";
  base: number;

  constructor(base: number = 2) {
    this.base = base;
  }

  getCurrentLoad(elapsedTime: number, config: LoadTestConfig): number {
    const rampUpDuration = config.rampUpDuration;
    const sustainDuration = config.sustainDuration;
    const rampDownDuration = config.rampDownDuration;

    if (elapsedTime < 0) {
      return 0;
    } else if (elapsedTime < rampUpDuration) {
      // Exponential ramp up
      const progress = elapsedTime / rampUpDuration;
      const factor = Math.pow(this.base, progress) - 1;
      const normalized = factor / (this.base - 1);
      return Math.min(
        normalized * config.concurrentUsers,
        config.concurrentUsers
      );
    } else if (elapsedTime < rampUpDuration + sustainDuration) {
      // Sustaining
      return config.concurrentUsers;
    } else if (
      elapsedTime <
      rampUpDuration + sustainDuration + rampDownDuration
    ) {
      // Linear ramp down (exponential down is too aggressive)
      const rampDownElapsed = elapsedTime - rampUpDuration - sustainDuration;
      return config.concurrentUsers * (1 - rampDownElapsed / rampDownDuration);
    } else {
      return 0;
    }
  }

  getTotalRampTime(config: LoadTestConfig): number {
    return (
      config.rampUpDuration + config.sustainDuration + config.rampDownDuration
    );
  }
}

/**
 * Step ramp strategy - increases load in discrete steps
 * Good for testing stability at specific load levels
 */
export class StepRampStrategy implements RampStrategy {
  type: RampType = "step";
  steps: number;

  constructor(steps: number = 5) {
    this.steps = steps;
  }

  getCurrentLoad(elapsedTime: number, config: LoadTestConfig): number {
    const rampUpDuration = config.rampUpDuration;
    const sustainDuration = config.sustainDuration;
    const rampDownDuration = config.rampDownDuration;

    if (elapsedTime < 0) {
      return 0;
    } else if (elapsedTime < rampUpDuration) {
      // Step ramp up
      const stepSize = rampUpDuration / this.steps;
      const currentStep = Math.floor(elapsedTime / stepSize);
      const loadPerStep = config.concurrentUsers / this.steps;
      return Math.min((currentStep + 1) * loadPerStep, config.concurrentUsers);
    } else if (elapsedTime < rampUpDuration + sustainDuration) {
      // Sustaining
      return config.concurrentUsers;
    } else if (
      elapsedTime <
      rampUpDuration + sustainDuration + rampDownDuration
    ) {
      // Step ramp down
      const stepSize = rampDownDuration / this.steps;
      const rampDownElapsed = elapsedTime - rampUpDuration - sustainDuration;
      const currentStep = Math.floor(rampDownElapsed / stepSize);
      const loadPerStep = config.concurrentUsers / this.steps;
      return Math.max(
        config.concurrentUsers - (currentStep + 1) * loadPerStep,
        0
      );
    } else {
      return 0;
    }
  }

  getTotalRampTime(config: LoadTestConfig): number {
    return (
      config.rampUpDuration + config.sustainDuration + config.rampDownDuration
    );
  }
}

/**
 * Custom ramp strategy - uses a user-defined function
 * Maximum flexibility for custom scenarios
 */
export class CustomRampStrategy implements RampStrategy {
  type: RampType = "custom";
  loadFunction: (elapsedTime: number, config: LoadTestConfig) => number;

  constructor(
    loadFunction: (elapsedTime: number, config: LoadTestConfig) => number
  ) {
    this.loadFunction = loadFunction;
  }

  getCurrentLoad(elapsedTime: number, config: LoadTestConfig): number {
    return Math.max(
      0,
      Math.min(this.loadFunction(elapsedTime, config), config.concurrentUsers)
    );
  }

  getTotalRampTime(config: LoadTestConfig): number {
    return (
      config.rampUpDuration + config.sustainDuration + config.rampDownDuration
    );
  }
}

/**
 * Factory function to create ramp strategies
 */
export function createRampStrategy(
  type: RampType,
  options?: Record<string, unknown>
): RampStrategy {
  switch (type) {
    case "linear":
      return new LinearRampStrategy();
    case "exponential":
      return new ExponentialRampStrategy((options?.base as number) ?? 2);
    case "step":
      return new StepRampStrategy((options?.steps as number) ?? 5);
    case "custom":
      if (
        !options?.loadFunction ||
        typeof options.loadFunction !== "function"
      ) {
        throw new Error("Custom ramp strategy requires a loadFunction");
      }
      return new CustomRampStrategy(
        options.loadFunction as (
          elapsedTime: number,
          config: LoadTestConfig
        ) => number
      );
    default:
      return new LinearRampStrategy();
  }
}
