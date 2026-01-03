/**
 * @lsi/webgpu-multi - GPU Selector
 *
 * Selects optimal GPU devices based on various heuristics.
 */

import type {
  GPUDevice,
  GPUSelectionCriteria,
  DeviceSelection,
  WorkTask,
} from "./types.js";

/**
 * Device score with metadata
 */
interface DeviceScore {
  device: GPUDevice;
  score: number;
  reasons: string[];
}

/**
 * GPU Selector for intelligent device selection
 */
export class GPUSelector {
  private performanceHistory: Map<string, number[]> = new Map();
  private thermalHistory: Map<string, number[]> = new Map();
  private powerHistory: Map<string, number[]> = new Map();

  /**
   * Select best device based on criteria
   */
  async selectDevice(
    devices: GPUDevice[],
    criteria?: GPUSelectionCriteria
  ): Promise<GPUDevice | null> {
    if (devices.length === 0) return null;
    if (devices.length === 1) return devices[0];

    const scores = await this.scoreDevices(devices, criteria);

    if (scores.length === 0) return null;

    return scores[0].device;
  }

  /**
   * Select multiple devices sorted by suitability
   */
  async selectDevices(
    devices: GPUDevice[],
    count: number,
    criteria?: GPUSelectionCriteria
  ): Promise<GPUDevice[]> {
    const scores = await this.scoreDevices(devices, criteria);
    return scores.slice(0, count).map(s => s.device);
  }

  /**
   * Score devices based on criteria
   */
  async scoreDevices(
    devices: GPUDevice[],
    criteria?: GPUSelectionCriteria
  ): Promise<DeviceScore[]> {
    const scored: DeviceScore[] = [];

    for (const device of devices) {
      const score = await this.scoreDevice(device, criteria);
      scored.push(score);
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  /**
   * Score a single device
   */
  async scoreDevice(
    device: GPUDevice,
    criteria?: GPUSelectionCriteria
  ): Promise<DeviceScore> {
    let score = 0;
    const reasons: string[] = [];

    // Type preference
    const typeScore = this.scoreByType(device, criteria?.type);
    score += typeScore.score;
    reasons.push(...typeScore.reasons);

    // Memory check
    const memoryScore = this.scoreByMemory(device, criteria?.minMemory);
    score += memoryScore.score;
    reasons.push(...memoryScore.reasons);

    // Features check
    const featuresScore = this.scoreByFeatures(device, criteria);
    score += featuresScore.score;
    reasons.push(...featuresScore.reasons);

    // Performance check
    const performanceScore = this.scoreByPerformance(
      device,
      criteria?.minPerformance
    );
    score += performanceScore.score;
    reasons.push(...performanceScore.reasons);

    // Thermal check
    const thermalScore = this.scoreByThermal(device, criteria?.considerThermal);
    score += thermalScore.score;
    reasons.push(...thermalScore.reasons);

    // Power check
    const powerScore = this.scoreByPower(
      device,
      criteria?.considerPower,
      criteria?.maxPower
    );
    score += powerScore.score;
    reasons.push(...powerScore.reasons);

    // Utilization check
    const utilizationScore = this.scoreByUtilization(device);
    score += utilizationScore.score;
    reasons.push(...utilizationScore.reasons);

    return { device, score, reasons };
  }

  /**
   * Score by device type
   */
  private scoreByType(
    device: GPUDevice,
    preference?: DeviceSelection
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    switch (preference) {
      case "discrete":
        if (device.type === "discrete") {
          score += 100;
          reasons.push("Discrete GPU matches preference");
        } else if (device.type === "integrated") {
          score += 25;
        }
        break;
      case "integrated":
        if (device.type === "integrated") {
          score += 100;
          reasons.push("Integrated GPU matches preference");
        } else if (device.type === "discrete") {
          score += 50;
        }
        break;
      case "cpu":
        if (device.type === "cpu") {
          score += 100;
          reasons.push("CPU device matches preference");
        }
        break;
      case "auto":
      default:
        if (device.type === "discrete") {
          score += 50;
          reasons.push("Discrete GPU preferred for performance");
        } else if (device.type === "integrated") {
          score += 25;
          reasons.push("Integrated GPU acceptable");
        }
        break;
    }

    return { score, reasons };
  }

  /**
   * Score by memory capacity
   */
  private scoreByMemory(
    device: GPUDevice,
    minMemory?: number
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (minMemory && device.memorySize >= minMemory) {
      score += 50;
      reasons.push(`Has ${device.memorySize} bytes >= ${minMemory} required`);
    }

    // Bonus for more memory
    score += Math.log10(device.memorySize + 1) * 5;
    reasons.push(`Memory capacity: ${device.memorySize} bytes`);

    return { score, reasons };
  }

  /**
   * Score by features
   */
  private scoreByFeatures(
    device: GPUDevice,
    criteria?: GPUSelectionCriteria
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Required features
    if (criteria?.requiredFeatures) {
      const missing = criteria.requiredFeatures.filter(
        f => !device.features.includes(f)
      );

      if (missing.length > 0) {
        score -= 1000; // Disqualify
        reasons.push(`Missing required features: ${missing.join(", ")}`);
      } else {
        score += 30;
        reasons.push(
          `Has all ${criteria.requiredFeatures.length} required features`
        );
      }
    }

    // Preferred features
    if (criteria?.preferredFeatures) {
      const hasCount = criteria.preferredFeatures.filter(f =>
        device.features.includes(f)
      ).length;

      score += (hasCount / criteria.preferredFeatures.length) * 20;
      reasons.push(
        `Has ${hasCount}/${criteria.preferredFeatures.length} preferred features`
      );
    }

    // Bonus for feature count
    score += device.features.length * 0.5;

    return { score, reasons };
  }

  /**
   * Score by historical performance
   */
  private scoreByPerformance(
    device: GPUDevice,
    minPerformance?: number
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const history = this.performanceHistory.get(device.device_id);
    if (history && history.length > 0) {
      const avgPerf = history.reduce((a, b) => a + b, 0) / history.length;

      if (minPerformance && avgPerf >= minPerformance) {
        score += 40;
        reasons.push(
          `Historical performance ${avgPerf.toFixed(2)} >= ${minPerformance}`
        );
      }

      score += avgPerf * 30;
      reasons.push(`Average performance: ${avgPerf.toFixed(2)}`);
    } else {
      // No history - neutral score
      score += 20;
      reasons.push("No performance history - assuming average");
    }

    return { score, reasons };
  }

  /**
   * Score by thermal state
   */
  private scoreByThermal(
    device: GPUDevice,
    enabled?: boolean
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (!enabled || device.temperature === undefined) {
      return { score, reasons };
    }

    const temp = device.temperature;

    // Below 60C is excellent
    if (temp < 60) {
      score += 20;
      reasons.push(`Excellent thermal state: ${temp}C`);
    }
    // 60-75C is good
    else if (temp < 75) {
      score += 10;
      reasons.push(`Good thermal state: ${temp}C`);
    }
    // 75-85C is acceptable
    else if (temp < 85) {
      score += 0;
      reasons.push(`Acceptable thermal state: ${temp}C`);
    }
    // Above 85C is poor
    else {
      score -= 30;
      reasons.push(`Poor thermal state: ${temp}C - may throttle`);
    }

    return { score, reasons };
  }

  /**
   * Score by power efficiency
   */
  private scoreByPower(
    device: GPUDevice,
    enabled?: boolean,
    maxPower?: number
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (!enabled || device.powerUsage === undefined) {
      return { score, reasons };
    }

    const power = device.powerUsage;

    // Check max power constraint
    if (maxPower && power > maxPower) {
      score -= 50;
      reasons.push(`Exceeds power budget: ${power}W > ${maxPower}W`);
    }

    // Bonus for low power
    if (power < 50) {
      score += 15;
      reasons.push(`Power efficient: ${power}W`);
    } else if (power < 100) {
      score += 10;
      reasons.push(`Moderate power: ${power}W`);
    } else if (power < 200) {
      score += 5;
      reasons.push(`High power: ${power}W`);
    } else {
      score -= 10;
      reasons.push(`Very high power: ${power}W`);
    }

    return { score, reasons };
  }

  /**
   * Score by current utilization
   */
  private scoreByUtilization(device: GPUDevice): {
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    const util = device.utilization;

    if (util < 0.3) {
      score += 30;
      reasons.push(`Low utilization (${(util * 100).toFixed(0)}%) - available`);
    } else if (util < 0.6) {
      score += 15;
      reasons.push(`Moderate utilization (${(util * 100).toFixed(0)}%)`);
    } else if (util < 0.9) {
      score += 0;
      reasons.push(`High utilization (${(util * 100).toFixed(0)}%)`);
    } else {
      score -= 20;
      reasons.push(
        `Very high utilization (${(util * 100).toFixed(0)}%) - busy`
      );
    }

    return { score, reasons };
  }

  /**
   * Record performance for a device
   */
  recordPerformance(deviceId: string, performance: number): void {
    const history = this.performanceHistory.get(deviceId) || [];
    history.push(performance);

    // Keep last 100 samples
    if (history.length > 100) {
      history.shift();
    }

    this.performanceHistory.set(deviceId, history);
  }

  /**
   * Record thermal reading for a device
   */
  recordThermal(deviceId: string, temperature: number): void {
    const history = this.thermalHistory.get(deviceId) || [];
    history.push(temperature);

    if (history.length > 100) {
      history.shift();
    }

    this.thermalHistory.set(deviceId, history);
  }

  /**
   * Record power reading for a device
   */
  recordPower(deviceId: string, power: number): void {
    const history = this.powerHistory.get(deviceId) || [];
    history.push(power);

    if (history.length > 100) {
      history.shift();
    }

    this.powerHistory.set(deviceId, history);
  }

  /**
   * Get device for specific task
   */
  async selectDeviceForTask(
    devices: GPUDevice[],
    task: WorkTask,
    criteria?: GPUSelectionCriteria
  ): Promise<GPUDevice | null> {
    // Estimate memory requirements
    const memoryRequired = task.memoryRequired || 1024 * 1024 * 100; // 100MB default

    const taskCriteria: GPUSelectionCriteria = {
      ...criteria,
      minMemory: Math.max(memoryRequired, criteria?.minMemory || 0),
    };

    return this.selectDevice(devices, taskCriteria);
  }

  /**
   * Select devices for pipeline stages
   */
  async selectDevicesForPipeline(
    devices: GPUDevice[],
    stageCount: number,
    criteria?: GPUSelectionCriteria
  ): Promise<GPUDevice[]> {
    // Select best devices for each stage
    const selected: GPUDevice[] = [];

    for (let i = 0; i < stageCount; i++) {
      const remaining = devices.filter(d => !selected.includes(d));
      if (remaining.length === 0) break;

      const device = await this.selectDevice(remaining, criteria);
      if (device) {
        selected.push(device);
      }
    }

    return selected;
  }

  /**
   * Get recommendation explanation
   */
  async explainSelection(
    devices: GPUDevice[],
    criteria?: GPUSelectionCriteria
  ): Promise<string> {
    const scores = await this.scoreDevices(devices, criteria);

    if (scores.length === 0) {
      return "No devices available";
    }

    const best = scores[0];
    const lines: string[] = [];

    lines.push(`Selected: ${best.device.vendor} ${best.device.architecture}`);
    lines.push(`Score: ${best.score.toFixed(2)}`);
    lines.push("Reasons:");
    for (const reason of best.reasons) {
      lines.push(`  - ${reason}`);
    }

    if (scores.length > 1) {
      lines.push("\nAlternatives:");
      for (let i = 1; i < Math.min(4, scores.length); i++) {
        lines.push(
          `  ${i + 1}. ${scores[i].device.vendor} ${scores[i].device.architecture}: ${scores[i].score.toFixed(2)}`
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.performanceHistory.clear();
    this.thermalHistory.clear();
    this.powerHistory.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    devicesTracked: number;
    performanceSamples: number;
    thermalSamples: number;
    powerSamples: number;
  } {
    return {
      devicesTracked: new Set([
        ...this.performanceHistory.keys(),
        ...this.thermalHistory.keys(),
        ...this.powerHistory.keys(),
      ]).size,
      performanceSamples: Array.from(this.performanceHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      thermalSamples: Array.from(this.thermalHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      powerSamples: Array.from(this.powerHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };
  }
}

/**
 * Default GPU selector instance
 */
export const defaultGPUSelector = new GPUSelector();
