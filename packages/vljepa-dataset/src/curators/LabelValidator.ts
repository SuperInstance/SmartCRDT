/**
 * @fileoverview Label Validator - Validate dataset labels and annotations
 * @description Ensures labels are consistent and valid for training
 */

import type {
  UIStatePair,
  CollectedScreenshot,
  ChangeType,
  DatasetError,
} from "../types.js";

/**
 * Validation issue
 */
export interface ValidationIssue {
  type:
    | "missing-label"
    | "invalid-label"
    | "inconsistent-label"
    | "low-confidence";
  severity: "low" | "medium" | "high";
  message: string;
  sampleId: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  statistics: ValidationStatistics;
}

/**
 * Validation statistics
 */
export interface ValidationStatistics {
  totalSamples: number;
  validLabels: number;
  missingLabels: number;
  invalidLabels: number;
  inconsistentLabels: number;
  labelDistribution: Record<string, number>;
}

/**
 * Valid labels
 */
const VALID_CHANGE_TYPES: ChangeType[] = [
  "style",
  "layout",
  "content",
  "interaction",
  "state",
  "multi",
];
const VALID_CATEGORIES = [
  "general",
  "developer-tools",
  "design",
  "component-library",
  "payment",
  "saas",
  "ecommerce",
  "dashboard",
  "form",
  "navigation",
];
const VALID_DIFFICULTY = ["easy", "medium", "hard"];

/**
 * Label Validator class
 */
export class LabelValidator {
  private validChangeTypes: Set<ChangeType>;
  private validCategories: Set<string>;
  private validDifficulty: Set<string>;

  constructor() {
    this.validChangeTypes = new Set(VALID_CHANGE_TYPES);
    this.validCategories = new Set(VALID_CATEGORIES);
    this.validDifficulty = new Set(VALID_DIFFICULTY);
  }

  /**
   * Validate UI state pair labels
   */
  async validatePairs(pairs: UIStatePair[]): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const stats: ValidationStatistics = {
      totalSamples: pairs.length,
      validLabels: 0,
      missingLabels: 0,
      invalidLabels: 0,
      inconsistentLabels: 0,
      labelDistribution: {},
    };

    for (const pair of pairs) {
      const pairIssues = this.validatePair(pair);
      issues.push(...pairIssues);

      if (pairIssues.length === 0) {
        stats.validLabels++;
      }

      // Update distribution
      const changeType = pair.changeType;
      stats.labelDistribution[changeType] =
        (stats.labelDistribution[changeType] || 0) + 1;
    }

    // Count issue types
    for (const issue of issues) {
      switch (issue.type) {
        case "missing-label":
          stats.missingLabels++;
          break;
        case "invalid-label":
          stats.invalidLabels++;
          break;
        case "inconsistent-label":
          stats.inconsistentLabels++;
          break;
      }
    }

    return {
      passed: issues.filter(i => i.severity === "high").length === 0,
      issues,
      statistics: stats,
    };
  }

  /**
   * Validate single pair
   */
  private validatePair(pair: UIStatePair): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate change type
    if (!this.validChangeTypes.has(pair.changeType)) {
      issues.push({
        type: "invalid-label",
        severity: "high",
        message: `Invalid change type: ${pair.changeType}`,
        sampleId: pair.id,
      });
    }

    // Validate category
    if (!this.validCategories.has(pair.metadata.category)) {
      issues.push({
        type: "invalid-label",
        severity: "medium",
        message: `Invalid category: ${pair.metadata.category}`,
        sampleId: pair.id,
      });
    }

    // Validate difficulty
    if (!this.validDifficulty.has(pair.metadata.difficulty)) {
      issues.push({
        type: "invalid-label",
        severity: "medium",
        message: `Invalid difficulty: ${pair.metadata.difficulty}`,
        sampleId: pair.id,
      });
    }

    // Validate change description
    if (!pair.changeDescription || pair.changeDescription.length === 0) {
      issues.push({
        type: "missing-label",
        severity: "low",
        message: "Missing change description",
        sampleId: pair.id,
      });
    }

    // Validate consistency
    if (pair.changeType === "multi" && pair.diff.styleChanges.length === 0) {
      issues.push({
        type: "inconsistent-label",
        severity: "medium",
        message: 'Change type is "multi" but no style changes detected',
        sampleId: pair.id,
      });
    }

    return issues;
  }

  /**
   * Validate screenshot metadata
   */
  validateScreenshot(screenshot: CollectedScreenshot): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!screenshot.metadata.title) {
      issues.push({
        type: "missing-label",
        severity: "low",
        message: "Missing title",
        sampleId: screenshot.id,
      });
    }

    if (!screenshot.metadata.category) {
      issues.push({
        type: "missing-label",
        severity: "medium",
        message: "Missing category",
        sampleId: screenshot.id,
      });
    }

    return issues;
  }

  /**
   * Add custom valid category
   */
  addCategory(category: string): void {
    this.validCategories.add(category);
  }

  /**
   * Add custom valid change type
   */
  addChangeType(changeType: ChangeType): void {
    this.validChangeTypes.add(changeType);
  }

  /**
   * Get label distribution
   */
  getLabelDistribution(pairs: UIStatePair[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const pair of pairs) {
      distribution[pair.changeType] = (distribution[pair.changeType] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Check for class imbalance
   */
  checkClassImbalance(pairs: UIStatePair[], threshold: number = 0.1): boolean {
    const distribution = this.getLabelDistribution(pairs);
    const total = pairs.length;

    for (const count of Object.values(distribution)) {
      const ratio = count / total;
      if (ratio < threshold) {
        return true;
      }
    }

    return false;
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
