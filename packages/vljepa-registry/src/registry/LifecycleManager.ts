/**
 * @fileoverview Lifecycle management for models
 * @description Handles model lifecycle stages, transitions, and automation
 */

import type {
  LifecycleConfig,
  LifecycleStage,
  LifecycleTransition,
  RegisteredModel,
  TransitionCondition,
} from "../types.js";

/**
 * Lifecycle manager for model stage management
 */
export class LifecycleManager {
  private config: LifecycleConfig;
  private transitionHistory: Map<string, TransitionRecord[]>;

  constructor(config: LifecycleConfig) {
    this.config = config;
    this.transitionHistory = new Map();
  }

  /**
   * Transition a model to a new stage
   * @param model Model to transition
   * @param toStage Target stage
   * @param user User requesting transition
   * @returns Updated model
   */
  async transition(
    model: RegisteredModel,
    toStage: LifecycleStage,
    user = "system"
  ): Promise<RegisteredModel> {
    const fromStage = model.stage;

    // Check if transition is allowed
    const transition = this.config.transitions.find(
      t => t.from === fromStage && t.to === toStage
    );

    if (!transition) {
      throw new Error(
        `Invalid transition from ${fromStage} to ${toStage}. Allowed transitions: ${this.getAllowedTransitions(fromStage).join(", ")}`
      );
    }

    // Check conditions
    const conditionsMet = await this.checkConditions(
      model,
      transition.conditions
    );
    if (!conditionsMet) {
      throw new Error(
        `Transition conditions not met for ${fromStage} -> ${toStage}`
      );
    }

    // Check approval requirements
    if (transition.approval) {
      const approvalRecord = await this.checkApproval(
        model,
        toStage,
        transition.approvers
      );
      if (!approvalRecord.approved) {
        throw new Error(
          `Transition requires approval from: ${transition.approvers.join(", ")}`
        );
      }
    }

    // Perform transition
    const previousStage = model.stage;
    model.stage = toStage;
    model.updated = Date.now();

    // Record transition
    this.recordTransition(model.id, previousStage, toStage, user);

    return model;
  }

  /**
   * Check if auto-promotion should occur
   * @param model Model to check
   * @returns Whether to auto-promote and target stage
   */
  async shouldAutoPromote(
    model: RegisteredModel
  ): Promise<{ promote: boolean; toStage?: LifecycleStage }> {
    if (!this.config.autoPromote) {
      return { promote: false };
    }

    const currentStage = model.stage;

    // Find valid transitions from current stage
    const validTransitions = this.config.transitions.filter(
      t => t.from === currentStage
    );

    for (const transition of validTransitions) {
      // Only auto-promote for automated transitions
      const hasAutomatedCondition = transition.conditions.some(
        c => c.type === "automated" || c.type === "metric"
      );

      if (!hasAutomatedCondition) {
        continue;
      }

      // Check if all conditions are met
      const conditionsMet = await this.checkConditions(
        model,
        transition.conditions
      );
      if (conditionsMet) {
        return { promote: true, toStage: transition.to };
      }
    }

    return { promote: false };
  }

  /**
   * Check if auto-archiving should occur
   * @param model Model to check
   * @returns Versions to archive
   */
  async shouldAutoArchive(model: RegisteredModel): Promise<ModelVersion[]> {
    if (!this.config.autoArchive) {
      return [];
    }

    const toArchive: ModelVersion[] = [];
    const productionVersion = model.versions.find(
      v => v.isProduction && !v.isArchived
    );

    for (const version of model.versions) {
      // Don't archive production versions or already archived versions
      if (version.isProduction || version.isArchived) {
        continue;
      }

      // Get stage config for current stage
      const stageConfig = this.config.stages.find(s => s.name === model.stage);
      if (!stageConfig) {
        continue;
      }

      // Archive if older than stage max duration
      const age = Date.now() - version.created;
      if (age > stageConfig.maxDuration) {
        toArchive.push(version);
      }

      // Archive if a newer production version exists
      if (productionVersion && version.created < productionVersion.created) {
        const ageSinceProduction = Date.now() - productionVersion.created;
        // Archive 30 days after new production version
        if (ageSinceProduction > 30 * 24 * 60 * 60 * 1000) {
          toArchive.push(version);
        }
      }
    }

    return toArchive;
  }

  /**
   * Check if conditions for transition are met
   * @param model Model to check
   * @param conditions Conditions to verify
   * @returns True if all conditions met
   */
  private async checkConditions(
    model: RegisteredModel,
    conditions: TransitionCondition[]
  ): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.checkCondition(model, condition);
      if (!met) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single condition
   * @param model Model to check
   * @param condition Condition to verify
   * @returns True if condition met
   */
  private async checkCondition(
    model: RegisteredModel,
    condition: TransitionCondition
  ): Promise<boolean> {
    switch (condition.type) {
      case "metric":
        return this.checkMetricCondition(model, condition);
      case "time":
        return this.checkTimeCondition(model, condition);
      case "manual":
        // Manual conditions require explicit user action
        return false;
      case "automated":
        // Automated conditions are always true
        return true;
      default:
        return false;
    }
  }

  /**
   * Check metric condition
   * @param model Model to check
   * @param condition Condition with metric requirements
   * @returns True if metric meets requirement
   */
  private checkMetricCondition(
    model: RegisteredModel,
    condition: TransitionCondition
  ): boolean {
    const latestVersion = model.versions[model.versions.length - 1];
    if (!latestVersion) {
      return false;
    }

    const metricName = condition.condition;
    const threshold = condition.value as number;
    const actualValue = this.getMetricValue(latestVersion, metricName);

    if (actualValue === undefined) {
      return false;
    }

    // Check if metric meets threshold
    return actualValue >= threshold;
  }

  /**
   * Check time condition
   * @param model Model to check
   * @param condition Condition with time requirements
   * @returns True if time requirement met
   */
  private checkTimeCondition(
    model: RegisteredModel,
    condition: TransitionCondition
  ): boolean {
    const minTimeMs = condition.value as number;
    const timeInStage = Date.now() - model.updated;
    return timeInStage >= minTimeMs;
  }

  /**
   * Get metric value from version
   * @param version Model version
   * @param metricName Metric name
   * @returns Metric value or undefined
   */
  private getMetricValue(
    version: ModelVersion,
    metricName: string
  ): number | undefined {
    // Parse metric name (e.g., "accuracy.top1", "latency.p50")
    const parts = metricName.split(".");
    let value: any = version;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return typeof value === "number" ? value : undefined;
  }

  /**
   * Check approval requirements
   * @param model Model requiring approval
   * @param toStage Target stage
   * @param approvers Required approvers
   * @returns Approval record
   */
  private async checkApproval(
    model: RegisteredModel,
    toStage: LifecycleStage,
    approvers: string[]
  ): Promise<{ approved: boolean; approvers?: string[] }> {
    // In a real implementation, this would check an approval system
    // For now, return not approved
    return {
      approved: false,
      approvers,
    };
  }

  /**
   * Record a transition in history
   * @param modelId Model ID
   * @param fromStage Source stage
   * @param toStage Target stage
   * @param user User who performed transition
   */
  private recordTransition(
    modelId: string,
    fromStage: LifecycleStage,
    toStage: LifecycleStage,
    user: string
  ): void {
    const record: TransitionRecord = {
      modelId,
      from: fromStage,
      to: toStage,
      timestamp: Date.now(),
      user,
    };

    const history = this.transitionHistory.get(modelId) || [];
    history.push(record);

    // Keep last 100 transitions
    if (history.length > 100) {
      history.shift();
    }

    this.transitionHistory.set(modelId, history);
  }

  /**
   * Get transition history for a model
   * @param modelId Model ID
   * @returns Transition history
   */
  getTransitionHistory(modelId: string): TransitionRecord[] {
    return this.transitionHistory.get(modelId) || [];
  }

  /**
   * Get allowed transitions from a stage
   * @param fromStage Source stage
   * @returns Allowed target stages
   */
  getAllowedTransitions(fromStage: LifecycleStage): LifecycleStage[] {
    return this.config.transitions
      .filter(t => t.from === fromStage)
      .map(t => t.to);
  }

  /**
   * Get stage configuration
   * @param stage Stage name
   * @returns Stage config or undefined
   */
  getStageConfig(stage: LifecycleStage) {
    return this.config.stages.find(s => s.name === stage);
  }

  /**
   * Check if a model can be promoted to production
   * @param model Model to check
   * @returns True if can deploy to production
   */
  canDeployToProduction(model: RegisteredModel): boolean {
    const stageConfig = this.getStageConfig(model.stage);
    return stageConfig?.canDeployToProduction || false;
  }

  /**
   * Get time until next action for a model
   * @param model Model to check
   * @returns Next action and time remaining
   */
  async getNextAction(
    model: RegisteredModel
  ): Promise<{ action: string; timeUntilMs: number } | null> {
    const stageConfig = this.getStageConfig(model.stage);
    if (!stageConfig) {
      return null;
    }

    const timeInStage = Date.now() - model.updated;
    const timeUntilStageEnd = stageConfig.maxDuration - timeInStage;

    if (timeUntilStageEnd > 0 && this.config.autoPromote) {
      // Check if auto-promotion is possible
      const { promote, toStage } = await this.shouldAutoPromote(model);
      if (promote && toStage) {
        return {
          action: `auto_promote_to_${toStage}`,
          timeUntilMs: Math.min(timeUntilStageEnd, 0),
        };
      }
    }

    if (timeUntilStageEnd > 0) {
      return {
        action: "stage_duration_limit",
        timeUntilMs: timeUntilStageEnd,
      };
    }

    // Check for archiving
    const toArchive = await this.shouldAutoArchive(model);
    if (toArchive.length > 0) {
      return {
        action: "archive_versions",
        timeUntilMs: 0,
      };
    }

    return null;
  }
}

/**
 * Transition record
 */
interface TransitionRecord {
  modelId: string;
  from: LifecycleStage;
  to: LifecycleStage;
  timestamp: number;
  user: string;
}
