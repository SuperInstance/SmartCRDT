/**
 * @fileoverview Quality Filter - Filter and validate UI screenshots
 * @description Applies quality checks to ensure high-quality training data
 */

// @ts-ignore - Sharp is optional
import type sharp from "sharp";
import type { CollectedScreenshot, DatasetError } from "../types.js";

// Re-export types
export type {
  QualityFilterConfig,
  QualityReport,
  QualityIssue,
  QualityIssueType,
  QualityMetrics,
} from "../types.js";

/**
 * Quality Filter class
 */
export class QualityFilter {
  private config: QualityFilterConfig;
  private sharpInstance: typeof sharp | null = null;

  constructor(config?: Partial<QualityFilterConfig>) {
    this.config = {
      minResolution: config?.minResolution ?? { width: 1024, height: 768 },
      maxBlurScore: config?.maxBlurScore ?? 100,
      minContrast: config?.minContrast ?? 4.5,
      minContentCoverage: config?.minContentCoverage ?? 0.3,
      deduplicationThreshold: config?.deduplicationThreshold ?? 0.95,
      allowedFormats: config?.allowedFormats ?? ["png", "jpg", "webp"],
      maxFileSize: config?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
    };
  }

  /**
   * Initialize Sharp for image processing
   */
  private async getSharp(): Promise<typeof sharp> {
    if (!this.sharpInstance) {
      try {
        this.sharpInstance = (await import("sharp")).default;
      } catch (error) {
        throw new Error(
          "Sharp library not available. Install it with: npm install sharp"
        );
      }
    }
    return this.sharpInstance;
  }

  /**
   * Filter a single screenshot
   */
  async filter(screenshot: CollectedScreenshot): Promise<QualityReport> {
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];
    let passed = true;

    try {
      // Check resolution
      const resolutionCheck = this.checkResolution(screenshot);
      if (!resolutionCheck.passed) {
        passed = false;
        issues.push(...resolutionCheck.issues);
      }

      // Check file size
      const sizeCheck = this.checkFileSize(screenshot);
      if (!sizeCheck.passed) {
        passed = false;
        issues.push(...sizeCheck.issues);
      }

      // Check format
      const formatCheck = this.checkFormat(screenshot);
      if (!formatCheck.passed) {
        passed = false;
        issues.push(...formatCheck.issues);
      }

      // Get image metrics
      const metrics = await this.calculateMetrics(screenshot);

      // Check blur
      const blurCheck = this.checkBlur(metrics);
      if (!blurCheck.passed) {
        passed = false;
        issues.push(...blurCheck.issues);
        suggestions.push("Recapture with better focus or use image sharpening");
      }

      // Check contrast
      const contrastCheck = this.checkContrast(metrics);
      if (!contrastCheck.passed) {
        issues.push(...contrastCheck.issues);
        suggestions.push("Increase contrast for better visibility");
      }

      // Check brightness
      const brightnessCheck = this.checkBrightness(metrics);
      if (!brightnessCheck.passed) {
        issues.push(...brightnessCheck.issues);
        suggestions.push("Adjust brightness for better visibility");
      }

      // Check content coverage
      const coverageCheck = await this.checkContentCoverage(
        screenshot,
        metrics
      );
      if (!coverageCheck.passed) {
        passed = false;
        issues.push(...coverageCheck.issues);
        suggestions.push("Ensure UI content fills the frame properly");
      }

      // Calculate overall score
      const score = this.calculateScore(issues, metrics);

      return {
        passed,
        score,
        issues,
        suggestions,
        metrics,
      };
    } catch (error) {
      throw this.createError("quality-failed", "Failed to filter screenshot", {
        id: screenshot.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Filter multiple screenshots
   */
  async filterBatch(
    screenshots: CollectedScreenshot[]
  ): Promise<Map<string, QualityReport>> {
    const reports = new Map<string, QualityReport>();

    for (const screenshot of screenshots) {
      const report = await this.filter(screenshot);
      reports.set(screenshot.id, report);
    }

    // Check for duplicates
    const duplicates = await this.findDuplicates(screenshots);
    for (const [id1, id2] of duplicates) {
      const report = reports.get(id1);
      if (report) {
        report.passed = false;
        report.issues.push({
          type: "duplicate",
          severity: "high",
          message: `Duplicate of ${id2}`,
        });
        report.score *= 0.5;
      }
    }

    return reports;
  }

  /**
   * Check resolution requirements
   */
  private checkResolution(screenshot: CollectedScreenshot): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];
    let passed = true;

    const { width, height } = screenshot.metadata;
    const { minResolution } = this.config;

    if (width < minResolution.width) {
      passed = false;
      issues.push({
        type: "low-resolution",
        severity: "high",
        message: `Width ${width}px is below minimum ${minResolution.width}px`,
        location: { x: 0, y: 0, width, height },
      });
    }

    if (height < minResolution.height) {
      passed = false;
      issues.push({
        type: "low-resolution",
        severity: "high",
        message: `Height ${height}px is below minimum ${minResolution.height}px`,
        location: { x: 0, y: 0, width, height },
      });
    }

    return { passed, issues };
  }

  /**
   * Check file size
   */
  private checkFileSize(screenshot: CollectedScreenshot): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    if (screenshot.metadata.fileSize > this.config.maxFileSize!) {
      return {
        passed: false,
        issues: [
          {
            type: "low-resolution",
            severity: "medium",
            message: `File size ${(screenshot.metadata.fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Check file format
   */
  private checkFormat(screenshot: CollectedScreenshot): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    if (!this.config.allowedFormats!.includes(screenshot.metadata.format)) {
      return {
        passed: false,
        issues: [
          {
            type: "low-resolution",
            severity: "medium",
            message: `Format ${screenshot.metadata.format} not allowed`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Calculate image quality metrics
   */
  async calculateMetrics(
    screenshot: CollectedScreenshot
  ): Promise<QualityMetrics> {
    const sharp = await this.getSharp();
    const image = sharp(screenshot.image);
    const metadata = await image.metadata();

    // Get image statistics
    const stats = await image.stats();

    // Calculate brightness from mean values
    const brightness =
      (stats.channels[0].mean +
        stats.channels[1].mean +
        stats.channels[2].mean) /
      3 /
      255;

    // Calculate contrast using standard deviation
    const contrast =
      (stats.channels[0].stdev +
        stats.channels[1].stdev +
        stats.channels[2].stdev) /
      3 /
      128;

    // Estimate blur using Laplacian variance (simplified)
    const blurScore = await this.estimateBlur(image);

    // Calculate sharpness (inverse of blur)
    const sharpness = Math.max(0, 1 - blurScore / 100);

    // Calculate colorfulness
    const colorfulness = await this.calculateColorfulness(image);

    // Content coverage estimation
    const contentCoverage = await this.estimateContentCoverage(image);

    return {
      resolution: {
        width: metadata.width!,
        height: metadata.height!,
      },
      blurScore,
      contrast: contrast * 10, // Scale to 0-10 range
      brightness,
      sharpness,
      colorfulness,
      contentCoverage,
    };
  }

  /**
   * Estimate image blur using edge detection
   */
  private async estimateBlur(image: sharp.Sharp): Promise<number> {
    try {
      // Convert to grayscale
      const grayscale = image.clone().greyscale();

      // Apply Laplacian filter for edge detection
      const edges = await grayscale
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0],
        })
        .raw()
        .toBuffer();

      // Calculate variance (simplified)
      let sum = 0;
      const len = Math.min(edges.length, 10000); // Sample for performance
      for (let i = 0; i < len; i++) {
        sum += edges[i] * edges[i];
      }
      const variance = sum / len;

      // Lower variance = more blurry
      return Math.max(0, 100 - variance / 100);
    } catch {
      return 50; // Default middle value
    }
  }

  /**
   * Calculate colorfulness metric
   */
  private async calculateColorfulness(image: sharp.Sharp): Promise<number> {
    try {
      const stats = await image.stats();

      // Calculate colorfulness based on standard deviation of RGB
      const rStd = stats.channels[0].stdev;
      const gStd = stats.channels[1].stdev;
      const bStd = stats.channels[2].stdev;

      const colorfulness =
        Math.sqrt(rStd * rStd + gStd * gStd + bStd * bStd) / 128;

      return Math.min(1, colorfulness);
    } catch {
      return 0.5; // Default middle value
    }
  }

  /**
   * Estimate content coverage (how much of image contains content)
   */
  private async estimateContentCoverage(image: sharp.Sharp): Promise<number> {
    try {
      // Resize to small size for faster processing
      const small = image.clone().resize(100, 100, { fit: "cover" });
      const stats = await small.stats();

      // Count non-background pixels (assuming white/gray backgrounds)
      let contentPixels = 0;
      const totalPixels = 100 * 100;

      // Sample pixels
      const buffer = await small.raw().toBuffer();
      for (let i = 0; i < Math.min(buffer.length, 10000); i += 4) {
        const r = buffer[i];
        const g = buffer[i + 1];
        const b = buffer[i + 2];

        // Check if not white/gray background
        const isBackground = r > 240 && g > 240 && b > 240;
        if (!isBackground) {
          contentPixels++;
        }
      }

      return contentPixels / totalPixels;
    } catch {
      return 0.5; // Default middle value
    }
  }

  /**
   * Check blur levels
   */
  private checkBlur(metrics: QualityMetrics): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    if (metrics.blurScore > this.config.maxBlurScore) {
      return {
        passed: false,
        issues: [
          {
            type: "blurry",
            severity: "high",
            message: `Image is too blurry (blur score: ${metrics.blurScore.toFixed(2)})`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Check contrast levels
   */
  private checkContrast(metrics: QualityMetrics): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    if (metrics.contrast < this.config.minContrast) {
      return {
        passed: false,
        issues: [
          {
            type: "low-contrast",
            severity: "medium",
            message: `Low contrast detected (${metrics.contrast.toFixed(2)} < ${this.config.minContrast})`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Check brightness levels
   */
  private checkBrightness(metrics: QualityMetrics): {
    passed: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    if (metrics.brightness < 0.2) {
      return {
        passed: false,
        issues: [
          {
            type: "low-contrast",
            severity: "medium",
            message: `Image too dark (brightness: ${metrics.brightness.toFixed(2)})`,
          },
        ],
      };
    }

    if (metrics.brightness > 0.9) {
      return {
        passed: false,
        issues: [
          {
            type: "low-contrast",
            severity: "low",
            message: `Image too bright (brightness: ${metrics.brightness.toFixed(2)})`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Check content coverage
   */
  private async checkContentCoverage(
    screenshot: CollectedScreenshot,
    metrics: QualityMetrics
  ): Promise<{ passed: boolean; issues: QualityIssue[] }> {
    const issues: QualityIssue[] = [];

    if (metrics.contentCoverage < this.config.minContentCoverage) {
      return {
        passed: false,
        issues: [
          {
            type: "empty-content",
            severity: "high",
            message: `Insufficient content coverage (${(metrics.contentCoverage * 100).toFixed(1)}%)`,
          },
        ],
      };
    }

    return { passed: true, issues: [] };
  }

  /**
   * Find duplicate or near-duplicate images
   */
  async findDuplicates(
    screenshots: CollectedScreenshot[]
  ): Promise<Array<[string, string]>> {
    const duplicates: Array<[string, string]> = [];
    const hashes = new Map<string, string[]>();

    // Calculate perceptual hashes for all screenshots
    for (const screenshot of screenshots) {
      const hash = await this.calculatePerceptualHash(screenshot.image);
      if (!hashes.has(hash)) {
        hashes.set(hash, []);
      }
      hashes.get(hash)!.push(screenshot.id);
    }

    // Find near-duplicates using Hamming distance
    const screenshotArray = Array.from(screenshots);
    for (let i = 0; i < screenshotArray.length; i++) {
      for (let j = i + 1; j < screenshotArray.length; j++) {
        const similarity = await this.calculateSimilarity(
          screenshotArray[i].image,
          screenshotArray[j].image
        );

        if (similarity > this.config.deduplicationThreshold) {
          duplicates.push([screenshotArray[i].id, screenshotArray[j].id]);
        }
      }
    }

    return duplicates;
  }

  /**
   * Calculate perceptual hash of image
   */
  private async calculatePerceptualHash(image: Buffer): Promise<string> {
    const sharp = await this.getSharp();

    try {
      // Resize to small thumbnail and calculate average hash
      const hash = await sharp(image)
        .resize(8, 8, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer();

      // Convert to binary string
      const avg = hash.reduce((a, b) => a + b, 0) / hash.length;
      let binaryHash = "";
      for (let i = 0; i < hash.length; i++) {
        binaryHash += hash[i] > avg ? "1" : "0";
      }

      return binaryHash;
    } catch {
      // Fallback to simple hash
      return image.toString("base64").slice(0, 64);
    }
  }

  /**
   * Calculate similarity between two images
   */
  private async calculateSimilarity(
    image1: Buffer,
    image2: Buffer
  ): Promise<number> {
    const sharp = await this.getSharp();

    try {
      // Calculate structural similarity index (simplified)
      const stats1 = await sharp(image1).stats();
      const stats2 = await sharp(image2).stats();

      let similarity = 0;
      for (let i = 0; i < 3; i++) {
        const meanDiff = Math.abs(
          stats1.channels[i].mean - stats2.channels[i].mean
        );
        const stdevDiff = Math.abs(
          stats1.channels[i].stdev - stats2.channels[i].stdev
        );
        similarity += 1 - (meanDiff + stdevDiff) / 512;
      }

      return similarity / 3;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateScore(
    issues: QualityIssue[],
    metrics: QualityMetrics
  ): number {
    let score = 1.0;

    // Penalize for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case "high":
          score -= 0.3;
          break;
        case "medium":
          score -= 0.15;
          break;
        case "low":
          score -= 0.05;
          break;
      }
    }

    // Factor in metrics
    score *= metrics.sharpness;
    score *= Math.min(1, metrics.contrast / this.config.minContrast);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Filter screenshots by minimum score
   */
  async filterByScore(
    screenshots: CollectedScreenshot[],
    minScore: number
  ): Promise<CollectedScreenshot[]> {
    const filtered: CollectedScreenshot[] = [];

    for (const screenshot of screenshots) {
      const report = await this.filter(screenshot);
      if (report.score >= minScore) {
        filtered.push(screenshot);
      }
    }

    return filtered;
  }

  /**
   * Get statistics about quality issues
   */
  getIssueStatistics(reports: QualityReport[]): Map<QualityIssueType, number> {
    const stats = new Map<QualityIssueType, number>();

    for (const report of reports) {
      for (const issue of report.issues) {
        const count = stats.get(issue.type) ?? 0;
        stats.set(issue.type, count + 1);
      }
    }

    return stats;
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}
