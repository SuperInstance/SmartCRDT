/**
 * DepOptimizer - Optimize shared dependencies
 * Deduplicate and minimize shared dependency bundles
 */

import type { SharedDep } from "../types.js";

export class DepOptimizer {
  private dependencies: Map<string, SharedDepInfo> = new Map();
  private usage: Map<string, Set<string>> = new Map();

  /**
   * Register a dependency
   */
  register(key: string, dep: SharedDep, consumer: string): void {
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, {
        key,
        version: dep.requiredVersion,
        singleton: dep.singleton,
        strictVersion: dep.strictVersion,
        size: 0,
      });
    }

    if (!this.usage.has(key)) {
      this.usage.set(key, new Set());
    }

    this.usage.get(key)!.add(consumer);
  }

  /**
   * Analyze dependencies for optimization
   */
  analyze(): OptimizationAnalysis {
    const duplicates: DuplicateDep[] = [];
    const unused: string[] = [];
    const singletons: string[] = [];
    const conflicts: VersionConflict[] = [];

    // Find duplicates
    for (const [key, info] of this.dependencies) {
      const consumers = this.usage.get(key) || new Set();

      if (consumers.size === 0) {
        unused.push(key);
      } else if (info.singleton && consumers.size > 1) {
        singletons.push(key);
      }
    }

    // Find version conflicts
    const byKey = this.groupByKey();
    for (const [key, versions] of byKey) {
      if (versions.size > 1) {
        conflicts.push({
          key,
          versions: Array.from(versions),
        });
      }
    }

    return {
      duplicates,
      unused,
      singletons,
      conflicts,
      totalSize: this.calculateTotalSize(),
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const analysis = this.analyze();

    // Recommend sharing for unused duplicates
    for (const conflict of analysis.conflicts) {
      const latest = this.getLatestVersion(conflict.versions);
      recommendations.push({
        type: "share",
        key: conflict.key,
        recommendation: `Share ${conflict.key} at version ${latest}`,
        impact: "high",
        savings: this.estimateSavings(conflict.key),
      });
    }

    // Recommend removing unused
    for (const key of analysis.unused) {
      recommendations.push({
        type: "remove",
        key,
        recommendation: `Remove unused dependency ${key}`,
        impact: "low",
        savings: this.dependencies.get(key)?.size || 0,
      });
    }

    // Recommend singleton enforcement
    for (const key of analysis.singletons) {
      recommendations.push({
        type: "enforce-singleton",
        key,
        recommendation: `Enforce singleton for ${key}`,
        impact: "medium",
        savings: this.estimateSavings(key),
      });
    }

    return recommendations.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  /**
   * Optimize dependencies
   */
  optimize(options: OptimizationOptions = {}): OptimizedDeps {
    const analysis = this.analyze();
    const optimized: Record<string, SharedDep> = {};

    // Keep singletons
    for (const key of analysis.singletons) {
      const info = this.dependencies.get(key);
      if (info) {
        optimized[key] = {
          requiredVersion: info.version,
          singleton: true,
          strictVersion: info.strictVersion,
        };
      }
    }

    // Resolve conflicts
    for (const conflict of analysis.conflicts) {
      const version = options.preferLatest
        ? this.getLatestVersion(conflict.versions)
        : conflict.versions[0];

      const info = this.dependencies.get(conflict.key);
      if (info) {
        optimized[conflict.key] = {
          requiredVersion: version,
          singleton: info.singleton || options.forceSingleton,
          strictVersion: info.strictVersion,
        };
      }
    }

    // Keep non-conflicting deps
    for (const [key, info] of this.dependencies) {
      if (!optimized[key]) {
        optimized[key] = {
          requiredVersion: info.version,
          singleton: info.singleton,
          strictVersion: info.strictVersion,
        };
      }
    }

    // Remove unused if requested
    if (options.removeUnused) {
      for (const key of analysis.unused) {
        delete optimized[key];
      }
    }

    return {
      dependencies: optimized,
      savings: analysis.totalSize - this.calculateOptimizedSize(optimized),
      removed: analysis.unused.length,
      merged: analysis.conflicts.length,
    };
  }

  /**
   * Get dependency info
   */
  getDependencyInfo(key: string): SharedDepInfo | undefined {
    return this.dependencies.get(key);
  }

  /**
   * Get consumers of a dependency
   */
  getConsumers(key: string): string[] {
    return Array.from(this.usage.get(key) || []);
  }

  /**
   * Set dependency size
   */
  setDependencySize(key: string, size: number): void {
    const info = this.dependencies.get(key);
    if (info) {
      info.size = size;
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.dependencies.clear();
    this.usage.clear();
  }

  /**
   * Group dependencies by key
   */
  private groupByKey(): Map<string, Set<string>> {
    const grouped = new Map<string, Set<string>>();

    for (const [key, info] of this.dependencies) {
      if (!grouped.has(key)) {
        grouped.set(key, new Set());
      }
      grouped.get(key)!.add(info.version);
    }

    return grouped;
  }

  /**
   * Get latest version from set
   */
  private getLatestVersion(versions: string[]): string {
    return versions.sort((a, b) => {
      const partsA = a.split(".").map(Number);
      const partsB = b.split(".").map(Number);

      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const pa = partsA[i] || 0;
        const pb = partsB[i] || 0;
        if (pa !== pb) return pb - pa;
      }

      return 0;
    })[0];
  }

  /**
   * Calculate total size
   */
  private calculateTotalSize(): number {
    let total = 0;
    for (const info of this.dependencies.values()) {
      total += info.size;
    }
    return total;
  }

  /**
   * Calculate optimized size
   */
  private calculateOptimizedSize(optimized: Record<string, SharedDep>): number {
    let total = 0;
    for (const [key] of Object.entries(optimized)) {
      const info = this.dependencies.get(key);
      if (info) {
        total += info.size;
      }
    }
    return total;
  }

  /**
   * Estimate savings for a dependency
   */
  private estimateSavings(key: string): number {
    const info = this.dependencies.get(key);
    const consumers = this.usage.get(key)?.size || 0;

    if (!info || consumers <= 1) {
      return 0;
    }

    // If shared, only load once instead of per consumer
    return info.size * (consumers - 1);
  }
}

/**
 * Shared dependency info
 */
interface SharedDepInfo {
  key: string;
  version: string;
  singleton: boolean;
  strictVersion: boolean;
  size: number;
}

/**
 * Optimization analysis result
 */
interface OptimizationAnalysis {
  duplicates: DuplicateDep[];
  unused: string[];
  singletons: string[];
  conflicts: VersionConflict[];
  totalSize: number;
}

/**
 * Duplicate dependency
 */
interface DuplicateDep {
  key: string;
  versions: string[];
  consumers: string[];
}

/**
 * Version conflict
 */
interface VersionConflict {
  key: string;
  versions: string[];
}

/**
 * Optimization recommendation
 */
interface OptimizationRecommendation {
  type: "share" | "remove" | "enforce-singleton";
  key: string;
  recommendation: string;
  impact: "high" | "medium" | "low";
  savings: number;
}

/**
 * Optimization options
 */
interface OptimizationOptions {
  preferLatest?: boolean;
  forceSingleton?: boolean;
  removeUnused?: boolean;
}

/**
 * Optimized dependencies result
 */
interface OptimizedDeps {
  dependencies: Record<string, SharedDep>;
  savings: number;
  removed: number;
  merged: number;
}
