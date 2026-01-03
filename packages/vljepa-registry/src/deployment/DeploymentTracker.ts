/**
 * @fileoverview Deployment tracking and management
 * @description Tracks model deployments, performance, and provides rollback capability
 */

import { v4 as uuidv4 } from "uuid";
import type {
  Deployment,
  DeploymentEnvironment,
  DeploymentStatus,
  DeploymentConfig,
  DeploymentStrategy,
  DeploymentMetrics,
  RollbackInfo,
} from "../types.js";

/**
 * Deployment tracker for managing model deployments
 */
export class DeploymentTracker {
  private deployments: Map<string, Deployment>;
  private deploymentsByModel: Map<string, string[]>; // modelId -> deployment IDs
  private deploymentsByEnvironment: Map<DeploymentEnvironment, string[]>;

  constructor() {
    this.deployments = new Map();
    this.deploymentsByModel = new Map();
    this.deploymentsByEnvironment = new Map();
  }

  /**
   * Create a new deployment
   * @param modelId Model ID
   * @param version Model version
   * @param environment Target environment
   * @param config Deployment configuration
   * @param deployedBy User deploying the model
   * @returns Created deployment
   */
  async createDeployment(
    modelId: string,
    version: string,
    environment: DeploymentEnvironment,
    config: DeploymentConfig,
    deployedBy: string
  ): Promise<Deployment> {
    const deployment: Deployment = {
      id: uuidv4(),
      model: modelId,
      version,
      environment,
      deployedAt: Date.now(),
      deployedBy,
      status: "pending",
      config,
    };

    this.deployments.set(deployment.id, deployment);

    // Update indexes
    const modelDeployments = this.deploymentsByModel.get(modelId) || [];
    modelDeployments.push(deployment.id);
    this.deploymentsByModel.set(modelId, modelDeployments);

    const envDeployments = this.deploymentsByEnvironment.get(environment) || [];
    envDeployments.push(deployment.id);
    this.deploymentsByEnvironment.set(environment, envDeployments);

    return deployment;
  }

  /**
   * Start a deployment
   * @param deploymentId Deployment ID
   */
  async startDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = "deploying";
    return deployment;
  }

  /**
   * Mark deployment as successful
   * @param deploymentId Deployment ID
   * @param metrics Optional initial metrics
   */
  async markDeploymentSuccess(
    deploymentId: string,
    metrics?: DeploymentMetrics
  ): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = "success";
    if (metrics) {
      deployment.metrics = metrics;
    }

    return deployment;
  }

  /**
   * Mark deployment as failed
   * @param deploymentId Deployment ID
   * @param reason Failure reason
   */
  async markDeploymentFailed(
    deploymentId: string,
    reason: string
  ): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = "failed";
    return deployment;
  }

  /**
   * Rollback a deployment
   * @param deploymentId Deployment ID to rollback
   * @param targetVersion Version to rollback to
   * @param reason Rollback reason
   * @param triggeredBy User initiating rollback
   * @param method Rollback method
   * @returns Rollback info
   */
  async rollbackDeployment(
    deploymentId: string,
    targetVersion: string,
    reason: string,
    triggeredBy: string,
    method: RollbackInfo["method"] = "immediate"
  ): Promise<RollbackInfo> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const rollback: RollbackInfo = {
      timestamp: Date.now(),
      previousVersion: targetVersion,
      reason,
      triggeredBy,
      method,
    };

    deployment.rollback = rollback;
    deployment.status = "rolled_back";

    return rollback;
  }

  /**
   * Get deployment by ID
   * @param deploymentId Deployment ID
   * @returns Deployment or undefined
   */
  getDeployment(deploymentId: string): Deployment | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get all deployments for a model
   * @param modelId Model ID
   * @returns Array of deployments
   */
  getDeploymentsByModel(modelId: string): Deployment[] {
    const deploymentIds = this.deploymentsByModel.get(modelId) || [];
    return deploymentIds
      .map(id => this.deployments.get(id))
      .filter((d): d is Deployment => d !== undefined);
  }

  /**
   * Get deployments for a model in a specific environment
   * @param modelId Model ID
   * @param environment Environment
   * @returns Array of deployments
   */
  getDeploymentsByModelAndEnvironment(
    modelId: string,
    environment: DeploymentEnvironment
  ): Deployment[] {
    return this.getDeploymentsByModel(modelId).filter(
      d => d.environment === environment
    );
  }

  /**
   * Get current deployment for a model in an environment
   * @param modelId Model ID
   * @param environment Environment
   * @returns Current deployment or undefined
   */
  getCurrentDeployment(
    modelId: string,
    environment: DeploymentEnvironment
  ): Deployment | undefined {
    const deployments = this.getDeploymentsByModelAndEnvironment(
      modelId,
      environment
    );
    return deployments
      .filter(d => d.status === "success")
      .sort((a, b) => b.deployedAt - a.deployedAt)[0];
  }

  /**
   * Get all deployments in an environment
   * @param environment Environment
   * @returns Array of deployments
   */
  getDeploymentsByEnvironment(
    environment: DeploymentEnvironment
  ): Deployment[] {
    const deploymentIds = this.deploymentsByEnvironment.get(environment) || [];
    return deploymentIds
      .map(id => this.deployments.get(id))
      .filter((d): d is Deployment => d !== undefined);
  }

  /**
   * Update deployment metrics
   * @param deploymentId Deployment ID
   * @param metrics New metrics
   */
  async updateDeploymentMetrics(
    deploymentId: string,
    metrics: DeploymentMetrics
  ): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.metrics = metrics;
    return deployment;
  }

  /**
   * Get deployment history for a model
   * @param modelId Model ID
   * @param limit Maximum number of deployments to return
   * @returns Deployment history
   */
  getDeploymentHistory(modelId: string, limit = 50): Deployment[] {
    return this.getDeploymentsByModel(modelId)
      .sort((a, b) => b.deployedAt - a.deployedAt)
      .slice(0, limit);
  }

  /**
   * Get deployment statistics
   * @param modelId Optional model ID to filter by
   * @returns Deployment statistics
   */
  getDeploymentStatistics(modelId?: string): DeploymentStatistics {
    let deployments: Deployment[];

    if (modelId) {
      deployments = this.getDeploymentsByModel(modelId);
    } else {
      deployments = Array.from(this.deployments.values());
    }

    const stats: DeploymentStatistics = {
      total: deployments.length,
      byStatus: {
        pending: 0,
        deploying: 0,
        success: 0,
        failed: 0,
        rolled_back: 0,
        terminated: 0,
      },
      byEnvironment: {
        development: 0,
        staging: 0,
        production: 0,
      },
      byStrategy: {
        rolling: 0,
        blue_green: 0,
        canary: 0,
        immediate: 0,
      },
      avgDeploymentTime: 0,
      successRate: 0,
      rollbackRate: 0,
    };

    let totalDeploymentTime = 0;
    let deploymentTimeCount = 0;

    for (const deployment of deployments) {
      stats.byStatus[deployment.status]++;
      stats.byEnvironment[deployment.environment]++;
      stats.byStrategy[deployment.config.strategy]++;

      // Calculate deployment time (if metrics available)
      if (deployment.metrics && deployment.metrics.collectedAt) {
        const deploymentTime =
          deployment.metrics.collectedAt - deployment.deployedAt;
        totalDeploymentTime += deploymentTime;
        deploymentTimeCount++;
      }
    }

    if (deploymentTimeCount > 0) {
      stats.avgDeploymentTime = totalDeploymentTime / deploymentTimeCount;
    }

    const successfulDeployments = stats.byStatus.success;
    const totalCompletedDeployments =
      stats.byStatus.success +
      stats.byStatus.failed +
      stats.byStatus.rolled_back;

    if (totalCompletedDeployments > 0) {
      stats.successRate = successfulDeployments / totalCompletedDeployments;
      stats.rollbackRate =
        stats.byStatus.rolled_back / totalCompletedDeployments;
    }

    return stats;
  }

  /**
   * Check if canary deployment should proceed
   * @param deploymentId Canary deployment ID
   * @param successThreshold Success threshold (0-1)
   * @returns Whether to proceed and current metrics
   */
  async evaluateCanaryDeployment(
    deploymentId: string,
    successThreshold = 0.95
  ): Promise<{ proceed: boolean; metrics: DeploymentMetrics | undefined }> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.config.strategy !== "canary") {
      throw new Error(`Deployment ${deploymentId} is not a canary deployment`);
    }

    const metrics = deployment.metrics;
    if (!metrics) {
      return { proceed: false, metrics: undefined };
    }

    // Evaluate success based on error rate
    const successRate = 1 - metrics.errorRate;
    const proceed = successRate >= successThreshold;

    return { proceed, metrics };
  }

  /**
   * Increment canary deployment traffic
   * @param deploymentId Canary deployment ID
   * @param currentTraffic Current traffic percentage
   * @returns New traffic percentage
   */
  async incrementCanaryTraffic(
    deploymentId: string,
    currentTraffic: number
  ): Promise<number> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.config.strategy !== "canary") {
      throw new Error(`Deployment ${deploymentId} is not a canary deployment`);
    }

    const canaryConfig = deployment.config.canary;
    if (!canaryConfig) {
      throw new Error(
        `Canary configuration not found for deployment ${deploymentId}`
      );
    }

    // Increment by configured step
    const newTraffic = Math.min(
      currentTraffic + canaryConfig.incrementStep,
      100
    );

    return newTraffic;
  }

  /**
   * Get previous deployment for rollback
   * @param modelId Model ID
   * @param environment Environment
   * @returns Previous successful deployment or undefined
   */
  getPreviousDeployment(
    modelId: string,
    environment: DeploymentEnvironment
  ): Deployment | undefined {
    const deployments = this.getDeploymentsByModelAndEnvironment(
      modelId,
      environment
    )
      .filter(d => d.status === "success")
      .sort((a, b) => b.deployedAt - a.deployedAt);

    // Return second most recent (skip current)
    return deployments.length > 1 ? deployments[1] : undefined;
  }

  /**
   * List all deployments
   * @param filters Optional filters
   * @returns Array of deployments
   */
  listDeployments(filters?: DeploymentFilters): Deployment[] {
    let deployments = Array.from(this.deployments.values());

    if (filters) {
      if (filters.modelId) {
        deployments = deployments.filter(d => d.model === filters.modelId);
      }
      if (filters.environment) {
        deployments = deployments.filter(
          d => d.environment === filters.environment
        );
      }
      if (filters.status) {
        deployments = deployments.filter(d => d.status === filters.status);
      }
      if (filters.version) {
        deployments = deployments.filter(d => d.version === filters.version);
      }
      if (filters.deployedBy) {
        deployments = deployments.filter(
          d => d.deployedBy === filters.deployedBy
        );
      }
      if (filters.after) {
        deployments = deployments.filter(d => d.deployedAt >= filters.after!);
      }
      if (filters.before) {
        deployments = deployments.filter(d => d.deployedAt <= filters.before!);
      }
    }

    return deployments.sort((a, b) => b.deployedAt - a.deployedAt);
  }

  /**
   * Delete a deployment record
   * @param deploymentId Deployment ID
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    this.deployments.delete(deploymentId);

    // Update indexes
    const modelDeployments =
      this.deploymentsByModel.get(deployment.model) || [];
    const filteredModel = modelDeployments.filter(id => id !== deploymentId);
    if (filteredModel.length > 0) {
      this.deploymentsByModel.set(deployment.model, filteredModel);
    } else {
      this.deploymentsByModel.delete(deployment.model);
    }

    const envDeployments =
      this.deploymentsByEnvironment.get(deployment.environment) || [];
    const filteredEnv = envDeployments.filter(id => id !== deploymentId);
    if (filteredEnv.length > 0) {
      this.deploymentsByEnvironment.set(deployment.environment, filteredEnv);
    } else {
      this.deploymentsByEnvironment.delete(deployment.environment);
    }
  }

  /**
   * Clean up old deployment records
   * @param retentionDays Days to keep deployments
   * @returns Number of deployments deleted
   */
  async cleanupOldDeployments(retentionDays = 90): Promise<number> {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [id, deployment] of this.deployments.entries()) {
      if (
        deployment.deployedAt < cutoffTime &&
        deployment.status !== "success"
      ) {
        await this.deleteDeployment(id);
        deleted++;
      }
    }

    return deleted;
  }
}

/**
 * Deployment filters
 */
export interface DeploymentFilters {
  modelId?: string;
  environment?: DeploymentEnvironment;
  status?: DeploymentStatus;
  version?: string;
  deployedBy?: string;
  after?: number;
  before?: number;
}

/**
 * Deployment statistics
 */
export interface DeploymentStatistics {
  total: number;
  byStatus: Record<DeploymentStatus, number>;
  byEnvironment: Record<DeploymentEnvironment, number>;
  byStrategy: Record<DeploymentStrategy, number>;
  avgDeploymentTime: number;
  successRate: number;
  rollbackRate: number;
}
