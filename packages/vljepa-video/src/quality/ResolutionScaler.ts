/**
 * @lsi/vljepa-video/quality/ResolutionScaler
 *
 * Resolution scaler for scaling video resolution dynamically.
 *
 * @version 1.0.0
 */

import type { ResolutionScalerConfig } from "../types.js";

/**
 * Resolution level
 */
export interface ResolutionLevel {
  /** Width */
  width: number;

  /** Height */
  height: number;

  /** Quality score */
  quality: number;
}

/**
 * Resolution scaler
 *
 * Dynamically scales video resolution based on conditions.
 */
export class ResolutionScaler {
  private config: ResolutionScalerConfig;
  private currentResolution: { width: number; height: number };
  private resolutionLevels: ResolutionLevel[] = [];
  private currentLevel: number = 0;

  constructor(config: ResolutionScalerConfig) {
    this.config = {
      targetResolution: config.targetResolution || {
        width: 1920,
        height: 1080,
      },
      minResolution: config.minResolution || { width: 640, height: 360 },
      maxResolution: config.maxResolution || { width: 3840, height: 2160 },
      scalingStep: config.scalingStep || 0.25,
      scalingMethod: config.scalingMethod || "bilinear",
    };

    this.currentResolution = this.config.targetResolution;
    this.generateResolutionLevels();
  }

  /**
   * Generate resolution levels
   */
  private generateResolutionLevels(): void {
    this.resolutionLevels = [];

    const { minResolution, maxResolution, targetResolution, scalingStep } =
      this.config;

    // Calculate number of levels
    const minWidthRatio = minResolution.width / maxResolution.width;
    const levels = Math.ceil(
      Math.log(1 / minWidthRatio) / Math.log(1 + scalingStep)
    );

    // Generate levels from max to min
    for (let i = 0; i <= levels; i++) {
      const scale = Math.pow(1 - scalingStep, i);
      const width = Math.floor(maxResolution.width * scale);
      const height = Math.floor(maxResolution.height * scale);

      // Ensure minimum resolution
      const clampedWidth = Math.max(minResolution.width, width);
      const clampedHeight = Math.max(minResolution.height, height);

      // Calculate quality score
      const targetScore = 1.0;
      const quality =
        (clampedWidth / targetResolution.width +
          clampedHeight / targetResolution.height) /
        2;

      this.resolutionLevels.push({
        width: clampedWidth,
        height: clampedHeight,
        quality: Math.min(1.0, quality),
      });
    }

    // Find current level
    this.updateCurrentLevel();
  }

  /**
   * Update current level index
   */
  private updateCurrentLevel(): void {
    let bestMatch = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < this.resolutionLevels.length; i++) {
      const level = this.resolutionLevels[i];
      const diff =
        Math.abs(level.width - this.currentResolution.width) +
        Math.abs(level.height - this.currentResolution.height);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = i;
      }
    }

    this.currentLevel = bestMatch;
  }

  /**
   * Scale resolution based on quality factor
   */
  scale(qualityFactor: number): {
    newResolution: { width: number; height: number };
    oldResolution: { width: number; height: number };
    direction: "up" | "down" | "none";
  } {
    const oldResolution = { ...this.currentResolution };

    // Calculate target level based on quality factor
    let targetLevel = this.currentLevel;

    if (qualityFactor > 1.1) {
      // Increase resolution
      targetLevel = Math.max(0, this.currentLevel - 1);
    } else if (qualityFactor < 0.9) {
      // Decrease resolution
      targetLevel = Math.min(
        this.resolutionLevels.length - 1,
        this.currentLevel + 1
      );
    }

    // Apply new resolution
    const newResolution = {
      width: this.resolutionLevels[targetLevel].width,
      height: this.resolutionLevels[targetLevel].height,
    };

    this.currentResolution = newResolution;
    this.currentLevel = targetLevel;

    let direction: "up" | "down" | "none" = "none";

    if (newResolution.width > oldResolution.width) {
      direction = "up";
    } else if (newResolution.width < oldResolution.width) {
      direction = "down";
    }

    return {
      newResolution,
      oldResolution,
      direction,
    };
  }

  /**
   * Set resolution directly
   */
  setResolution(resolution: { width: number; height: number }): void {
    this.currentResolution = {
      width: Math.max(
        this.config.minResolution.width,
        Math.min(this.config.maxResolution.width, resolution.width)
      ),
      height: Math.max(
        this.config.minResolution.height,
        Math.min(this.config.maxResolution.height, resolution.height)
      ),
    };

    this.updateCurrentLevel();
  }

  /**
   * Get current resolution
   */
  getCurrentResolution(): { width: number; height: number } {
    return { ...this.currentResolution };
  }

  /**
   * Get current resolution level
   */
  getCurrentLevel(): ResolutionLevel {
    return this.resolutionLevels[this.currentLevel];
  }

  /**
   * Get all resolution levels
   */
  getResolutionLevels(): ResolutionLevel[] {
    return [...this.resolutionLevels];
  }

  /**
   * Get scaling statistics
   */
  getStats(): {
    currentResolution: { width: number; height: number };
    currentLevel: number;
    totalLevels: number;
    quality: number;
    scalingMethod: string;
  } {
    return {
      currentResolution: { ...this.currentResolution },
      currentLevel: this.currentLevel,
      totalLevels: this.resolutionLevels.length,
      quality: this.resolutionLevels[this.currentLevel].quality,
      scalingMethod: this.config.scalingMethod,
    };
  }

  /**
   * Reset to target resolution
   */
  reset(): void {
    this.currentResolution = this.config.targetResolution;
    this.updateCurrentLevel();
  }
}
