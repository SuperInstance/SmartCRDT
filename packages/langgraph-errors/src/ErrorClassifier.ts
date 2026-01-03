/**
 * @file ErrorClassifier.ts - Error classification and severity assessment
 * @package @lsi/langgraph-errors
 */

import type {
  Error,
  ErrorCategory,
  ErrorSeverity,
  ErrorClassification,
  RecoveryStrategy,
} from "./types.js";

/**
 * Error classifier for categorizing and assessing errors
 */
export class ErrorClassifier {
  private customClassifiers: Array<(error: Error) => ErrorCategory | null> = [];

  /**
   * Register a custom error classifier
   */
  registerClassifier(classifier: (error: Error) => ErrorCategory | null): void {
    this.customClassifiers.push(classifier);
  }

  /**
   * Classify an error into category, severity, and recovery strategy
   */
  classify(error: Error): ErrorClassification {
    const category = this.categorize(error);
    const severity = this.assessSeverity(error, category);
    const retryable = this.isRetryable(error, category);
    const recoveryStrategy = this.suggestRecovery(
      error,
      category,
      severity,
      retryable
    );
    const confidence = this.calculateConfidence(error, category);

    return {
      category,
      severity,
      retryable,
      recovery_strategy: recoveryStrategy,
      confidence,
    };
  }

  /**
   * Categorize error by type and message
   */
  private categorize(error: Error): ErrorCategory {
    // Try custom classifiers first
    for (const classifier of this.customClassifiers) {
      const category = classifier(error);
      if (category) return category;
    }

    // Check error name/type
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    // Timeout errors
    if (
      name.includes("timeout") ||
      message.includes("timeout") ||
      message.includes("timed out")
    ) {
      return "timeout";
    }

    // Network errors
    if (
      name.includes("network") ||
      name.includes("fetch") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("connection")
    ) {
      return "network";
    }

    // Authentication errors
    if (
      name.includes("authentication") ||
      name.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("unauthorized") ||
      message.includes("401")
    ) {
      return "authentication";
    }

    // Authorization errors
    if (
      name.includes("authorization") ||
      name.includes("forbidden") ||
      message.includes("authorization") ||
      message.includes("forbidden") ||
      message.includes("403")
    ) {
      return "authorization";
    }

    // Rate limit errors
    if (
      name.includes("rate") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    ) {
      return "rate_limit";
    }

    // Validation errors
    if (
      name.includes("validation") ||
      name.includes("schema") ||
      message.includes("validation") ||
      message.includes("invalid") ||
      message.includes("schema")
    ) {
      return "validation";
    }

    // Resource errors
    if (
      name.includes("memory") ||
      name.includes("disk") ||
      message.includes("out of memory") ||
      message.includes("no space") ||
      message.includes("resource")
    ) {
      return "resource";
    }

    // Dependency errors
    if (
      name.includes("dependency") ||
      message.includes("dependency") ||
      message.includes("missing dependency")
    ) {
      return "dependency";
    }

    // Default to unknown
    return "unknown";
  }

  /**
   * Assess error severity
   */
  private assessSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase();

    // Fatal errors
    if (
      message.includes("fatal") ||
      message.includes("panic") ||
      category === "resource" ||
      (category === "network" && message.includes("unreachable"))
    ) {
      return "fatal";
    }

    // Critical errors
    if (
      category === "authentication" ||
      category === "authorization" ||
      message.includes("critical") ||
      message.includes("corrupt")
    ) {
      return "critical";
    }

    // Error level
    if (
      category === "execution" ||
      category === "timeout" ||
      message.includes("failed") ||
      message.includes("error")
    ) {
      return "error";
    }

    // Warning level
    if (
      category === "rate_limit" ||
      category === "dependency" ||
      message.includes("deprecated") ||
      message.includes("warning")
    ) {
      return "warning";
    }

    // Default to info
    return "info";
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: Error, category: ErrorCategory): boolean {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    if (
      message.includes("authentication") ||
      message.includes("authorization") ||
      message.includes("forbidden") ||
      message.includes("invalid token") ||
      message.includes("validation failed") ||
      message.includes("not found")
    ) {
      return false;
    }

    // Retryable by category
    const retryableCategories: ErrorCategory[] = [
      "timeout",
      "network",
      "rate_limit",
      "resource",
    ];

    return retryableCategories.includes(category);
  }

  /**
   * Suggest recovery strategy
   */
  private suggestRecovery(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    retryable: boolean
  ): RecoveryStrategy {
    // Fatal and critical errors should abort
    if (severity === "fatal" || severity === "critical") {
      return "abort";
    }

    // Authentication/authorization errors should abort
    if (category === "authentication" || category === "authorization") {
      return "abort";
    }

    // Retryable errors should retry
    if (retryable) {
      return "retry";
    }

    // Validation errors should skip
    if (category === "validation") {
      return "skip";
    }

    // Default to fallback
    return "fallback";
  }

  /**
   * Calculate classification confidence
   */
  private calculateConfidence(error: Error, category: ErrorCategory): number {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    let confidence = 0.5;

    // High confidence for explicit error names
    if (
      name.includes("timeout") ||
      name.includes("network") ||
      name.includes("validation")
    ) {
      confidence += 0.3;
    }

    // High confidence for explicit error messages
    if (
      message.includes("timeout") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("rate limit")
    ) {
      confidence += 0.3;
    }

    // Lower confidence for unknown category
    if (category === "unknown") {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Batch classify multiple errors
   */
  classifyBatch(errors: Error[]): ErrorClassification[] {
    return errors.map(error => this.classify(error));
  }

  /**
   * Get error statistics for a batch
   */
  getBatchStatistics(classifications: ErrorClassification[]): {
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byStrategy: Record<string, number>;
    avgConfidence: number;
  } {
    const stats = {
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byStrategy: {} as Record<string, number>,
      avgConfidence: 0,
    };

    let totalConfidence = 0;

    for (const classification of classifications) {
      stats.byCategory[classification.category] =
        (stats.byCategory[classification.category] || 0) + 1;
      stats.bySeverity[classification.severity] =
        (stats.bySeverity[classification.severity] || 0) + 1;
      stats.byStrategy[classification.recovery_strategy] =
        (stats.byStrategy[classification.recovery_strategy] || 0) + 1;
      totalConfidence += classification.confidence;
    }

    stats.avgConfidence =
      classifications.length > 0 ? totalConfidence / classifications.length : 0;

    return stats;
  }
}

/**
 * Singleton instance
 */
export const errorClassifier = new ErrorClassifier();

/**
 * Convenience function to classify an error
 */
export function classifyError(error: Error): ErrorClassification {
  return errorClassifier.classify(error);
}

/**
 * Convenience function to classify multiple errors
 */
export function classifyErrors(errors: Error[]): ErrorClassification[] {
  return errorClassifier.classifyBatch(errors);
}
