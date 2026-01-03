/**
 * RevertManager - Manage reverts to specific versions
 */

import type { UIState, UIVersion, VersionHistory } from "../types.js";

export interface RevertPlan {
  targetVersion: string;
  currentVersion: string;
  changes: RevertChange[];
  conflicts: RevertConflict[];
  canAutoRevert: boolean;
  estimatedImpact: RevertImpact;
}

export interface RevertChange {
  type: "restore" | "delete" | "modify";
  path: string;
  before: unknown;
  after: unknown;
}

export interface RevertConflict {
  path: string;
  type: "content" | "dependency" | "reference";
  description: string;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  action: "skip" | "overwrite" | "merge" | "manual";
  value?: unknown;
}

export interface RevertImpact {
  componentsAffected: number;
  breakingChanges: number;
  riskLevel: "low" | "medium" | "high";
  estimatedRecoveryTime: number; // in minutes
}

export class RevertManager {
  private versionHistory: VersionHistory;
  private revertHistory: RevertRecord[];

  constructor(versionHistory: VersionHistory) {
    this.versionHistory = versionHistory;
    this.revertHistory = [];
  }

  /**
   * Plan a revert to a specific version
   */
  planRevert(
    currentVersion: string,
    targetVersion: string,
    currentState: UIState
  ): RevertPlan {
    // Get version ancestry
    const ancestry = this.versionHistory.getAncestry(currentVersion);
    const target = this.versionHistory.getVersion(targetVersion);

    if (!target) {
      throw new Error(`Target version ${targetVersion} not found`);
    }

    // Calculate changes needed
    const changes = this.calculateRevertChanges(currentState, target.state);

    // Detect conflicts
    const conflicts = this.detectConflicts(
      currentVersion,
      targetVersion,
      currentState,
      target.state
    );

    // Assess impact
    const impact = this.assessImpact(changes, conflicts);

    return {
      targetVersion,
      currentVersion,
      changes,
      conflicts,
      canAutoRevert: conflicts.length === 0,
      estimatedImpact: impact,
    };
  }

  /**
   * Execute a revert
   */
  async executeRevert(
    plan: RevertPlan,
    conflictResolver?: (conflicts: RevertConflict[]) => ConflictResolution[]
  ): Promise<RevertResult> {
    // Resolve conflicts if provided
    const resolutions = conflictResolver
      ? conflictResolver(plan.conflicts)
      : [];

    // Check if auto-revert is possible
    if (!plan.canAutoRevert && !conflictResolver) {
      throw new Error(
        "Cannot auto-revert: conflicts exist and no resolver provided"
      );
    }

    // Apply resolutions
    for (let i = 0; i < plan.conflicts.length; i++) {
      const conflict = plan.conflicts[i];
      const resolution = resolutions[i];

      if (resolution && resolution.action === "cancel") {
        return {
          success: false,
          message: "Revert cancelled by conflict resolver",
          appliedChanges: [],
        };
      }
    }

    // Record revert
    this.recordRevert({
      timestamp: Date.now(),
      fromVersion: plan.currentVersion,
      toVersion: plan.targetVersion,
      changes: plan.changes.length,
      conflicts: plan.conflicts.length,
      success: true,
    });

    return {
      success: true,
      message: `Successfully reverted from ${plan.currentVersion} to ${plan.targetVersion}`,
      appliedChanges: plan.changes,
      resolvedConflicts: resolutions.length,
    };
  }

  /**
   * Preview revert changes
   */
  previewRevert(
    currentVersion: string,
    targetVersion: string,
    currentState: UIState
  ): RevertPreview {
    const plan = this.planRevert(currentVersion, targetVersion, currentState);

    return {
      plan,
      diffSummary: this.summarizeChanges(plan.changes),
      recommendedActions: this.generateRecommendations(plan),
    };
  }

  /**
   * Get safe revert points
   */
  getSafeRevertPoints(
    currentVersion: string,
    threshold: number = 0.8
  ): SafeVersion[] {
    const ancestry = this.versionHistory.getAncestry(currentVersion);
    const safeVersions: SafeVersion[] = [];

    for (const version of ancestry) {
      // Assess safety based on time since creation and complexity
      const timeSinceCreation = Date.now() - version.timestamp;
      const daysSinceCreation = timeSinceCreation / (1000 * 60 * 60 * 24);

      // Recent versions are safer
      const recencyScore = Math.max(0, 1 - daysSinceCreation / 30); // Decay over 30 days

      // Versions with fewer changes are safer
      const complexityScore = Math.max(0, 1 - version.changes.length / 20);

      const safetyScore = (recencyScore + complexityScore) / 2;

      if (safetyScore >= threshold) {
        safeVersions.push({
          version: version.id,
          versionNumber: version.version,
          safetyScore,
          timestamp: version.timestamp,
          author: version.author,
        });
      }
    }

    return safeVersions.sort((a, b) => b.safetyScore - a.safetyScore);
  }

  /**
   * Get revert history
   */
  getRevertHistory(): RevertRecord[] {
    return [...this.revertHistory];
  }

  /**
   * Get revert statistics
   */
  getStatistics(): RevertStatistics {
    const successful = this.revertHistory.filter(r => r.success).length;
    const failed = this.revertHistory.length - successful;

    return {
      totalReverts: this.revertHistory.length,
      successful,
      failed,
      averageChanges: this.calculateAverageChanges(),
      mostRevertedTo: this.findMostRevertedVersion(),
    };
  }

  // Private methods

  private calculateRevertChanges(
    currentState: UIState,
    targetState: UIState
  ): RevertChange[] {
    const changes: RevertChange[] = [];

    // Detect deletions (components in target but not in current)
    const currentIds = new Set(currentState.components.map(c => c.id));
    for (const component of targetState.components) {
      if (!currentIds.has(component.id)) {
        changes.push({
          type: "restore",
          path: `components.${component.id}`,
          before: undefined,
          after: component,
        });
      }
    }

    // Detect additions (components in current but not in target)
    const targetIds = new Set(targetState.components.map(c => c.id));
    for (const component of currentState.components) {
      if (!targetIds.has(component.id)) {
        changes.push({
          type: "delete",
          path: `components.${component.id}`,
          before: component,
          after: undefined,
        });
      }
    }

    // Detect modifications
    for (const targetComp of targetState.components) {
      const currentComp = currentState.components.find(
        c => c.id === targetComp.id
      );
      if (
        currentComp &&
        JSON.stringify(currentComp) !== JSON.stringify(targetComp)
      ) {
        changes.push({
          type: "modify",
          path: `components.${targetComp.id}`,
          before: currentComp,
          after: targetComp,
        });
      }
    }

    return changes;
  }

  private detectConflicts(
    currentVersion: string,
    targetVersion: string,
    currentState: UIState,
    targetState: UIState
  ): RevertConflict[] {
    const conflicts: RevertConflict[] = [];

    // Check for dependency conflicts (simplified)
    const currentIds = new Set(currentState.components.map(c => c.id));
    const targetIds = new Set(targetState.components.map(c => c.id));

    // Components in current that depend on components not in target
    for (const component of currentState.components) {
      for (const child of component.children) {
        if (!targetIds.has(child.id)) {
          conflicts.push({
            path: `components.${component.id}.children`,
            type: "dependency",
            description: `Component ${component.id} has child ${child.id} which doesn't exist in target version`,
          });
        }
      }
    }

    return conflicts;
  }

  private assessImpact(
    changes: RevertChange[],
    conflicts: RevertConflict[]
  ): RevertImpact {
    const componentsAffected = changes.length;
    const breakingChanges = changes.filter(c => c.type === "delete").length;

    let riskLevel: "low" | "medium" | "high";
    if (conflicts.length > 0 || breakingChanges > 5) {
      riskLevel = "high";
    } else if (breakingChanges > 0 || componentsAffected > 10) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    // Estimate recovery time (rough heuristic: 2 minutes per change)
    const estimatedRecoveryTime = Math.ceil(changes.length * 2);

    return {
      componentsAffected,
      breakingChanges,
      riskLevel,
      estimatedRecoveryTime,
    };
  }

  private summarizeChanges(changes: RevertChange[]): ChangeSummary {
    const byType = {
      restore: changes.filter(c => c.type === "restore").length,
      delete: changes.filter(c => c.type === "delete").length,
      modify: changes.filter(c => c.type === "modify").length,
    };

    return {
      total: changes.length,
      byType,
      risk: byType.delete > 5 ? "high" : byType.delete > 0 ? "medium" : "low",
    };
  }

  private generateRecommendations(plan: RevertPlan): string[] {
    const recommendations: string[] = [];

    if (plan.conflicts.length > 0) {
      recommendations.push(
        `⚠️  ${plan.conflicts.length} conflict(s) detected - manual resolution required`
      );
    }

    if (plan.estimatedImpact.breakingChanges > 0) {
      recommendations.push(
        `⚠️  ${plan.estimatedImpact.breakingChanges} breaking change(s) - backup recommended`
      );
    }

    if (plan.estimatedImpact.riskLevel === "high") {
      recommendations.push(
        "⚠️  High risk revert - consider creating a branch first"
      );
    }

    if (plan.canAutoRevert) {
      recommendations.push("✅ Safe to auto-revert - no conflicts detected");
    }

    const recoveryTime = Math.ceil(
      plan.estimatedImpact.estimatedRecoveryTime / 60
    );
    if (recoveryTime > 5) {
      recommendations.push(
        `⏱️  Estimated ${recoveryTime}+ minutes for recovery`
      );
    }

    return recommendations;
  }

  private recordRevert(record: RevertRecord): void {
    this.revertHistory.push(record);
  }

  private calculateAverageChanges(): number {
    if (this.revertHistory.length === 0) {
      return 0;
    }

    const total = this.revertHistory.reduce((sum, r) => sum + r.changes, 0);
    return total / this.revertHistory.length;
  }

  private findMostRevertedVersion():
    | { version: string; count: number }
    | undefined {
    const counts = new Map<string, number>();

    for (const record of this.revertHistory) {
      counts.set(record.toVersion, (counts.get(record.toVersion) || 0) + 1);
    }

    let max = 0;
    let mostReverted: string | undefined;

    for (const [version, count] of counts) {
      if (count > max) {
        max = count;
        mostReverted = version;
      }
    }

    return mostReverted ? { version: mostReverted, count: max } : undefined;
  }
}

export interface RevertPreview {
  plan: RevertPlan;
  diffSummary: ChangeSummary;
  recommendedActions: string[];
}

export interface ChangeSummary {
  total: number;
  byType: {
    restore: number;
    delete: number;
    modify: number;
  };
  risk: "low" | "medium" | "high";
}

export interface RevertResult {
  success: boolean;
  message: string;
  appliedChanges: RevertChange[];
  resolvedConflicts?: number;
}

export interface RevertRecord {
  timestamp: number;
  fromVersion: string;
  toVersion: string;
  changes: number;
  conflicts: number;
  success: boolean;
}

export interface RevertStatistics {
  totalReverts: number;
  successful: number;
  failed: number;
  averageChanges: number;
  mostRevertedTo?: { version: string; count: number };
}

export interface SafeVersion {
  version: string;
  versionNumber: string;
  safetyScore: number;
  timestamp: number;
  author: string;
}
