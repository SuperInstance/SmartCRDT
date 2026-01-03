/**
 * @lsi/performance-tests
 *
 * Baseline tracker for comparing benchmark results over time.
 * Detects performance regressions and generates comparison reports.
 */

import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { BenchmarkResult, BenchmarkStats } from "./Runner.js";

/**
 * Baseline tracker configuration
 */
export interface BaselineConfig {
  /** Directory to store baseline files */
  baselineDir?: string;
  /** Threshold for regression detection (percentage) */
  regressionThreshold?: number;
  /** Number of baseline results to keep */
  maxHistory?: number;
  /** Whether to fail on significant regression */
  failOnRegression?: boolean;
}

/**
 * Comparison between current and baseline results
 */
export interface TaskComparison {
  /** Task name */
  name: string;
  /** Current mean time */
  currentMean: number;
  /** Baseline mean time */
  baselineMean: number;
  /** Percentage difference */
  diffPercent: number;
  /** Whether this is a regression */
  isRegression: boolean;
  /** Whether this is an improvement */
  isImprovement: boolean;
  /** Significance of the difference */
  significance: "insignificant" | "minor" | "moderate" | "major";
}

/**
 * Comparison report for a benchmark suite
 */
export interface ComparisonReport {
  /** Benchmark suite name */
  suiteName: string;
  /** Timestamp of comparison */
  timestamp: Date;
  /** Current results */
  current: BenchmarkResult;
  /** Baseline results */
  baseline: BenchmarkResult;
  /** Task comparisons */
  comparisons: TaskComparison[];
  /** Overall regression status */
  hasRegression: boolean;
  /** Overall improvement status */
  hasImprovement: boolean;
  /** Summary statistics */
  summary: {
    totalTasks: number;
    regressionCount: number;
    improvementCount: number;
    neutralCount: number;
    avgChangePercent: number;
  };
}

/**
 * Regression report item
 */
export interface RegressionReport {
  /** Task name */
  task: string;
  /** Severity of regression */
  severity: "minor" | "moderate" | "major" | "critical";
  /** Percentage slower */
  percentSlower: number;
  /** Current time */
  currentMean: number;
  /** Baseline time */
  baselineMean: number;
  /** Recommendation */
  recommendation: string;
}

/**
 * Baseline tracker for performance regression detection
 */
export class BaselineTracker {
  private config: Required<BaselineConfig>;
  private baselines: Map<string, BenchmarkResult[]> = new Map();

  constructor(config: BaselineConfig = {}) {
    this.config = {
      baselineDir: config.baselineDir || "./benchmarks/baselines",
      regressionThreshold: config.regressionThreshold || 10, // 10%
      maxHistory: config.maxHistory || 10,
      failOnRegression: config.failOnRegression || false,
    };
  }

  /**
   * Load all baselines from disk
   */
  async loadBaselines(): Promise<void> {
    if (!existsSync(this.config.baselineDir)) {
      return;
    }

    try {
      const files = await readdir(this.config.baselineDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filepath = join(this.config.baselineDir, file);
          const content = await readFile(filepath, "utf-8");
          const results = JSON.parse(content) as BenchmarkResult[];

          // Parse timestamps
          for (const result of results) {
            result.timestamp = new Date(result.timestamp);
          }

          const suiteName = file.replace(".json", "");
          this.baselines.set(suiteName, results);
        }
      }
    } catch (error) {
      console.error("Error loading baselines:", error);
    }
  }

  /**
   * Save benchmark results as new baseline
   */
  async saveBaseline(result: BenchmarkResult): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.config.baselineDir)) {
      await mkdir(this.config.baselineDir, { recursive: true });
    }

    // Get existing baselines for this suite
    let suiteBaselines = this.baselines.get(result.name) || [];

    // Add new baseline
    suiteBaselines.push(result);

    // Trim to max history
    if (suiteBaselines.length > this.config.maxHistory) {
      suiteBaselines = suiteBaselines.slice(-this.config.maxHistory);
    }

    this.baselines.set(result.name, suiteBaselines);

    // Save to disk
    const filepath = join(this.config.baselineDir, `${result.name}.json`);
    await writeFile(filepath, JSON.stringify(suiteBaselines, null, 2), "utf-8");
  }

  /**
   * Get baseline for a specific suite
   */
  getBaseline(suiteName: string): BenchmarkResult | undefined {
    const baselines = this.baselines.get(suiteName);
    return baselines && baselines.length > 0
      ? baselines[baselines.length - 1]
      : undefined;
  }

  /**
   * Compare current results to baseline
   */
  compareToBaseline(current: BenchmarkResult): ComparisonReport | null {
    const baseline = this.getBaseline(current.name);

    if (!baseline) {
      console.warn(`No baseline found for ${current.name}`);
      return null;
    }

    // Compare each task
    const comparisons: TaskComparison[] = current.tasks.map(task => {
      const baselineTask = baseline.tasks.find(t => t.name === task.name);

      if (!baselineTask) {
        return {
          name: task.name,
          currentMean: task.mean,
          baselineMean: 0,
          diffPercent: 0,
          isRegression: false,
          isImprovement: false,
          significance: "insignificant",
        };
      }

      const diffPercent =
        ((task.mean - baselineTask.mean) / baselineTask.mean) * 100;
      const threshold = this.config.regressionThreshold;

      let significance: "insignificant" | "minor" | "moderate" | "major";
      if (Math.abs(diffPercent) < threshold) {
        significance = "insignificant";
      } else if (Math.abs(diffPercent) < threshold * 2) {
        significance = "minor";
      } else if (Math.abs(diffPercent) < threshold * 3) {
        significance = "moderate";
      } else {
        significance = "major";
      }

      return {
        name: task.name,
        currentMean: task.mean,
        baselineMean: baselineTask.mean,
        diffPercent,
        isRegression: diffPercent > threshold,
        isImprovement: diffPercent < -threshold,
        significance,
      };
    });

    // Calculate summary
    const regressionCount = comparisons.filter(c => c.isRegression).length;
    const improvementCount = comparisons.filter(c => c.isImprovement).length;
    const neutralCount =
      comparisons.length - regressionCount - improvementCount;
    const avgChangePercent =
      comparisons.reduce((sum, c) => sum + c.diffPercent, 0) /
      comparisons.length;

    return {
      suiteName: current.name,
      timestamp: new Date(),
      current,
      baseline,
      comparisons,
      hasRegression: regressionCount > 0,
      hasImprovement: improvementCount > 0,
      summary: {
        totalTasks: comparisons.length,
        regressionCount,
        improvementCount,
        neutralCount,
        avgChangePercent,
      },
    };
  }

  /**
   * Detect regressions in comparison report
   */
  detectRegressions(comparison: ComparisonReport): RegressionReport[] {
    const regressions: RegressionReport[] = [];

    for (const comp of comparison.comparisons) {
      if (comp.isRegression) {
        let severity: "minor" | "moderate" | "major" | "critical";
        let recommendation: string;

        if (comp.diffPercent < this.config.regressionThreshold * 2) {
          severity = "minor";
          recommendation = "Monitor this metric in future runs.";
        } else if (comp.diffPercent < this.config.regressionThreshold * 3) {
          severity = "moderate";
          recommendation =
            "Investigate recent changes that may affect this operation.";
        } else if (comp.diffPercent < this.config.regressionThreshold * 5) {
          severity = "major";
          recommendation =
            "Priority: Review and optimize this operation immediately.";
        } else {
          severity = "critical";
          recommendation =
            "URGENT: This is a significant regression requiring immediate attention.";
        }

        regressions.push({
          task: comp.name,
          severity,
          percentSlower: comp.diffPercent,
          currentMean: comp.currentMean,
          baselineMean: comp.baselineMean,
          recommendation,
        });
      }
    }

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, major: 1, moderate: 2, minor: 3 };
    regressions.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    return regressions;
  }

  /**
   * Check if regression is significant
   */
  isRegressionSignificant(delta: number): boolean {
    return delta > this.config.regressionThreshold;
  }

  /**
   * Generate markdown report for comparison
   */
  generateMarkdownReport(comparison: ComparisonReport): string {
    const lines: string[] = [];

    lines.push("# Performance Comparison Report");
    lines.push("");
    lines.push(`**Suite:** ${comparison.suiteName}`);
    lines.push(`**Timestamp:** ${comparison.timestamp.toISOString()}`);
    lines.push(`**Baseline:** ${comparison.baseline.timestamp.toISOString()}`);
    lines.push("");

    // Summary
    lines.push("## Summary");
    lines.push("");
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Tasks | ${comparison.summary.totalTasks} |`);
    lines.push(`| Regressions | ${comparison.summary.regressionCount} |`);
    lines.push(`| Improvements | ${comparison.summary.improvementCount} |`);
    lines.push(`| Neutral | ${comparison.summary.neutralCount} |`);
    lines.push(
      `| Avg Change | ${comparison.summary.avgChangePercent >= 0 ? "+" : ""}${comparison.summary.avgChangePercent.toFixed(2)}% |`
    );
    lines.push("");

    // Status badge
    if (comparison.hasRegression) {
      lines.push("> [!WARNING]");
      lines.push("> Performance regressions detected. See details below.");
      lines.push("");
    } else if (comparison.hasImprovement) {
      lines.push("> [!TIP]");
      lines.push("> Performance improvements detected!");
      lines.push("");
    }

    // Detailed comparisons
    lines.push("## Detailed Comparisons");
    lines.push("");
    lines.push("| Task | Current (ms) | Baseline (ms) | Change | Status |");
    lines.push("|------|--------------|---------------|--------|--------|");

    for (const comp of comparison.comparisons) {
      const status = comp.isRegression
        ? "🔴 Regression"
        : comp.isImprovement
          ? "🟢 Improvement"
          : comp.significance === "insignificant"
            ? "⚪ Neutral"
            : comp.significance === "minor"
              ? "🟡 Minor"
              : comp.significance === "moderate"
                ? "🟠 Moderate"
                : "🔴 Major";

      const change = comp.diffPercent >= 0 ? "+" : "";
      lines.push(
        `| ${comp.name} | ${comp.currentMean.toFixed(4)} | ${comp.baselineMean.toFixed(4)} | ` +
          `${change}${comp.diffPercent.toFixed(2)}% | ${status} |`
      );
    }

    lines.push("");

    // Regressions
    const regressions = this.detectRegressions(comparison);
    if (regressions.length > 0) {
      lines.push("## Regressions");
      lines.push("");
      lines.push("| Task | Severity | Slower | Current | Baseline |");
      lines.push("|------|----------|--------|---------|----------|");

      for (const reg of regressions) {
        lines.push(
          `| ${reg.task} | ${reg.severity} | ${reg.percentSlower.toFixed(2)}% | ` +
            `${reg.currentMean.toFixed(4)} | ${reg.baselineMean.toFixed(4)} |`
        );
      }

      lines.push("");
      lines.push("### Recommendations");
      lines.push("");
      for (const reg of regressions) {
        lines.push(`**${reg.task}** (${reg.severity}): ${reg.recommendation}`);
        lines.push("");
      }
    }

    // Environment info
    lines.push("## Environment");
    lines.push("");
    lines.push(`**Node Version:** ${comparison.current.nodeVersion}`);
    lines.push(
      `**Platform:** ${comparison.current.platform} (${comparison.current.arch})`
    );
    lines.push(`**CPU:** ${comparison.current.cpuCount} cores`);
    lines.push(`**Memory:** ${comparison.current.totalMemory.toFixed(2)} GB`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Generate JSON report for comparison
   */
  generateJSONReport(comparison: ComparisonReport): string {
    return JSON.stringify(
      {
        suiteName: comparison.suiteName,
        timestamp: comparison.timestamp.toISOString(),
        summary: comparison.summary,
        comparisons: comparison.comparisons,
        regressions: this.detectRegressions(comparison),
      },
      null,
      2
    );
  }

  /**
   * Save comparison report to file
   */
  async saveComparisonReport(
    comparison: ComparisonReport,
    format: "markdown" | "json" = "markdown"
  ): Promise<string> {
    const extension = format === "markdown" ? "md" : "json";
    const filename = `${comparison.suiteName}-comparison-${Date.now()}.${extension}`;
    const filepath = join(this.config.baselineDir, filename);

    const content =
      format === "markdown"
        ? this.generateMarkdownReport(comparison)
        : this.generateJSONReport(comparison);

    await writeFile(filepath, content, "utf-8");
    return filepath;
  }
}

// Helper function for reading directory
async function readdir(path: string): Promise<string[]> {
  try {
    const fs = await import("fs/promises");
    return await fs.readdir(path);
  } catch {
    return [];
  }
}

/**
 * Create a baseline tracker with default configuration
 */
export function createBaselineTracker(
  config?: BaselineConfig
): BaselineTracker {
  return new BaselineTracker(config);
}
