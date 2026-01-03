/**
 * @fileoverview REST API for model registry
 * @description Express-based REST API for model registry operations
 */

import express, { Request, Response, NextFunction } from "express";
import { ModelRegistry } from "../registry/ModelRegistry.js";
import { LifecycleManager } from "../registry/LifecycleManager.js";
import { DeploymentTracker } from "../deployment/DeploymentTracker.js";
import { LineageTracker } from "../lineage/LineageTracker.js";
import { ComparisonMetrics } from "../metrics/ComparisonMetrics.js";
import { DriftDetector } from "../metrics/DriftDetector.js";
import type {
  ModelRegistryConfig,
  RegisteredModel,
  APIResponse,
} from "../types.js";

/**
 * Request handler type
 */
type RequestHandler = (req: Request, res: Response) => void | Promise<void>;

/**
 * REST API for model registry
 */
export class RegistryAPI {
  private app: express.Express;
  private registry: ModelRegistry;
  private lifecycleManager: LifecycleManager;
  private deploymentTracker: DeploymentTracker;
  private lineageTracker: LineageTracker;
  private comparisonMetrics: ComparisonMetrics;

  constructor(registryConfig: ModelRegistryConfig, lifecycleConfig: any) {
    this.app = express();
    this.registry = new ModelRegistry(registryConfig);
    this.lifecycleManager = new LifecycleManager(lifecycleConfig);
    this.deploymentTracker = new DeploymentTracker();
    this.lineageTracker = new LineageTracker();
    this.comparisonMetrics = new ComparisonMetrics();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", this.asyncHandler(this.healthCheck.bind(this)));

    // Model CRUD operations
    this.app.post("/models", this.asyncHandler(this.registerModel.bind(this)));
    this.app.get("/models", this.asyncHandler(this.listModels.bind(this)));
    this.app.get("/models/:id", this.asyncHandler(this.getModel.bind(this)));
    this.app.put("/models/:id", this.asyncHandler(this.updateModel.bind(this)));
    this.app.delete(
      "/models/:id",
      this.asyncHandler(this.deleteModel.bind(this))
    );
    this.app.get(
      "/models/:id/versions",
      this.asyncHandler(this.listVersions.bind(this))
    );
    this.app.post(
      "/models/:id/versions",
      this.asyncHandler(this.addVersion.bind(this))
    );
    this.app.get(
      "/models/:id/versions/:version",
      this.asyncHandler(this.getVersion.bind(this))
    );
    this.app.delete(
      "/models/:id/versions/:version",
      this.asyncHandler(this.deleteVersion.bind(this))
    );
    this.app.put(
      "/models/:id/versions/:version/production",
      this.asyncHandler(this.setProductionVersion.bind(this))
    );

    // Lifecycle management
    this.app.put(
      "/models/:id/lifecycle",
      this.asyncHandler(this.transitionLifecycle.bind(this))
    );
    this.app.get(
      "/models/:id/lifecycle/history",
      this.asyncHandler(this.getLifecycleHistory.bind(this))
    );

    // Deployment operations
    this.app.post(
      "/models/:id/deploy",
      this.asyncHandler(this.createDeployment.bind(this))
    );
    this.app.get(
      "/deployments/:id",
      this.asyncHandler(this.getDeployment.bind(this))
    );
    this.app.put(
      "/deployments/:id/start",
      this.asyncHandler(this.startDeployment.bind(this))
    );
    this.app.put(
      "/deployments/:id/complete",
      this.asyncHandler(this.completeDeployment.bind(this))
    );
    this.app.put(
      "/deployments/:id/fail",
      this.asyncHandler(this.failDeployment.bind(this))
    );
    this.app.post(
      "/deployments/:id/rollback",
      this.asyncHandler(this.rollbackDeployment.bind(this))
    );
    this.app.get(
      "/models/:id/deployments",
      this.asyncHandler(this.getModelDeployments.bind(this))
    );
    this.app.get(
      "/deployments",
      this.asyncHandler(this.listDeployments.bind(this))
    );

    // Lineage operations
    this.app.get(
      "/models/:id/lineage",
      this.asyncHandler(this.getLineage.bind(this))
    );
    this.app.get(
      "/models/:id/lineage/ancestry",
      this.asyncHandler(this.getAncestry.bind(this))
    );
    this.app.get(
      "/models/:id/lineage/descendants",
      this.asyncHandler(this.getDescendants.bind(this))
    );
    this.app.get(
      "/lineage/compare",
      this.asyncHandler(this.compareLineages.bind(this))
    );

    // Model comparison
    this.app.post(
      "/models/compare",
      this.asyncHandler(this.compareModels.bind(this))
    );
    this.app.post(
      "/models/rank",
      this.asyncHandler(this.rankModels.bind(this))
    );

    // Drift detection
    this.app.post(
      "/models/:id/drift/detect",
      this.asyncHandler(this.detectDrift.bind(this))
    );
    this.app.get(
      "/models/:id/drift/history",
      this.asyncHandler(this.getDriftHistory.bind(this))
    );

    // Registry statistics
    this.app.get(
      "/statistics",
      this.asyncHandler(this.getStatistics.bind(this))
    );
    this.app.get(
      "/activity",
      this.asyncHandler(this.getRecentActivity.bind(this))
    );

    // Search
    this.app.get("/search", this.asyncHandler(this.searchModels.bind(this)));
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("API Error:", err);
        res.status(500).json({
          success: false,
          error: err.message,
          requestId: this.generateRequestId(),
        });
      }
    );

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Not found",
        requestId: this.generateRequestId(),
      });
    });
  }

  /**
   * Wrap async handlers
   * @param fn Request handler
   * @returns Wrapped handler
   */
  private asyncHandler(fn: RequestHandler): RequestHandler {
    return (req, res, next) => {
      Promise.resolve(fn(req, res)).catch(next);
    };
  }

  /**
   * Generate request ID
   * @returns Request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send success response
   * @param res Response
   * @param data Response data
   */
  private sendSuccess<T>(res: Response, data: T): void {
    res.json({
      success: true,
      data,
      requestId: this.generateRequestId(),
    } as APIResponse<T>);
  }

  /**
   * Send error response
   * @param res Response
   * @param message Error message
   * @param status HTTP status code
   */
  private sendError(res: Response, message: string, status = 400): void {
    res.status(status).json({
      success: false,
      error: message,
      requestId: this.generateRequestId(),
    } as APIResponse<never>);
  }

  // ==================== Health Check ====================

  /**
   * Health check endpoint
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    this.sendSuccess(res, { status: "healthy", timestamp: Date.now() });
  }

  // ==================== Model CRUD ====================

  /**
   * Register a new model
   * POST /models
   */
  private async registerModel(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, metadata, tags } = req.body;
      const model = await this.registry.registerModel(
        name,
        description,
        metadata,
        tags
      );
      this.sendSuccess(res, model);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * List all models
   * GET /models
   */
  private async listModels(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query.filters
        ? JSON.parse(req.query.filters as string)
        : undefined;
      const sort = req.query.sort
        ? JSON.parse(req.query.sort as string)
        : undefined;
      const pagination = req.query.pagination
        ? JSON.parse(req.query.pagination as string)
        : undefined;

      const result = await this.registry.listModels(filters, sort, pagination);
      this.sendSuccess(res, result);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get a model
   * GET /models/:id
   */
  private async getModel(req: Request, res: Response): Promise<void> {
    try {
      const model = await this.registry.getModel(req.params.id);
      if (!model) {
        return this.sendError(res, "Model not found", 404);
      }
      this.sendSuccess(res, model);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Update a model
   * PUT /models/:id
   */
  private async updateModel(req: Request, res: Response): Promise<void> {
    try {
      const model = await this.registry.updateModel(req.params.id, req.body);
      this.sendSuccess(res, model);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Delete a model
   * DELETE /models/:id
   */
  private async deleteModel(req: Request, res: Response): Promise<void> {
    try {
      const deleteArtifacts = req.query.deleteArtifacts === "true";
      await this.registry.deleteModel(req.params.id, deleteArtifacts);
      this.sendSuccess(res, { deleted: true });
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Versions ====================

  /**
   * List versions
   * GET /models/:id/versions
   */
  private async listVersions(req: Request, res: Response): Promise<void> {
    try {
      const model = await this.registry.getModel(req.params.id);
      if (!model) {
        return this.sendError(res, "Model not found", 404);
      }
      this.sendSuccess(res, model.versions);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Add a version
   * POST /models/:id/versions
   */
  private async addVersion(req: Request, res: Response): Promise<void> {
    try {
      const model = await this.registry.addVersion(req.params.id, req.body);
      this.sendSuccess(res, model);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get a version
   * GET /models/:id/versions/:version
   */
  private async getVersion(req: Request, res: Response): Promise<void> {
    try {
      const version = await this.registry.getVersion(
        req.params.id,
        req.params.version
      );
      if (!version) {
        return this.sendError(res, "Version not found", 404);
      }
      this.sendSuccess(res, version);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Delete a version
   * DELETE /models/:id/versions/:version
   */
  private async deleteVersion(req: Request, res: Response): Promise<void> {
    try {
      const deleteArtifacts = req.query.deleteArtifacts === "true";
      await this.registry.deleteVersion(
        req.params.id,
        req.params.version,
        deleteArtifacts
      );
      this.sendSuccess(res, { deleted: true });
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Set production version
   * PUT /models/:id/versions/:version/production
   */
  private async setProductionVersion(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const model = await this.registry.setProductionVersion(
        req.params.id,
        req.params.version
      );
      this.sendSuccess(res, model);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Lifecycle ====================

  /**
   * Transition lifecycle stage
   * PUT /models/:id/lifecycle
   */
  private async transitionLifecycle(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const model = await this.registry.getModel(req.params.id);
      if (!model) {
        return this.sendError(res, "Model not found", 404);
      }

      const { stage, user = "api" } = req.body;
      const updated = await this.lifecycleManager.transition(
        model,
        stage,
        user
      );
      this.sendSuccess(res, updated);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get lifecycle history
   * GET /models/:id/lifecycle/history
   */
  private async getLifecycleHistory(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const history = this.lifecycleManager.getTransitionHistory(req.params.id);
      this.sendSuccess(res, history);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Deployments ====================

  /**
   * Create a deployment
   * POST /models/:id/deploy
   */
  private async createDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { version, environment, config, deployedBy = "api" } = req.body;
      const deployment = await this.deploymentTracker.createDeployment(
        req.params.id,
        version,
        environment,
        config,
        deployedBy
      );
      this.sendSuccess(res, deployment);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get a deployment
   * GET /deployments/:id
   */
  private async getDeployment(req: Request, res: Response): Promise<void> {
    try {
      const deployment = this.deploymentTracker.getDeployment(req.params.id);
      if (!deployment) {
        return this.sendError(res, "Deployment not found", 404);
      }
      this.sendSuccess(res, deployment);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Start a deployment
   * PUT /deployments/:id/start
   */
  private async startDeployment(req: Request, res: Response): Promise<void> {
    try {
      const deployment = await this.deploymentTracker.startDeployment(
        req.params.id
      );
      this.sendSuccess(res, deployment);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Complete a deployment
   * PUT /deployments/:id/complete
   */
  private async completeDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { metrics } = req.body;
      const deployment = await this.deploymentTracker.markDeploymentSuccess(
        req.params.id,
        metrics
      );
      this.sendSuccess(res, deployment);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Fail a deployment
   * PUT /deployments/:id/fail
   */
  private async failDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const deployment = await this.deploymentTracker.markDeploymentFailed(
        req.params.id,
        reason
      );
      this.sendSuccess(res, deployment);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Rollback a deployment
   * POST /deployments/:id/rollback
   */
  private async rollbackDeployment(req: Request, res: Response): Promise<void> {
    try {
      const {
        targetVersion,
        reason,
        triggeredBy = "api",
        method = "immediate",
      } = req.body;
      const rollback = await this.deploymentTracker.rollbackDeployment(
        req.params.id,
        targetVersion,
        reason,
        triggeredBy,
        method
      );
      this.sendSuccess(res, rollback);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get deployments for a model
   * GET /models/:id/deployments
   */
  private async getModelDeployments(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const deployments = this.deploymentTracker.getDeploymentsByModel(
        req.params.id
      );
      this.sendSuccess(res, deployments);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * List all deployments
   * GET /deployments
   */
  private async listDeployments(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query.filters
        ? JSON.parse(req.query.filters as string)
        : undefined;
      const deployments = this.deploymentTracker.listDeployments(filters);
      this.sendSuccess(res, deployments);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Lineage ====================

  /**
   * Get model lineage
   * GET /models/:id/lineage
   */
  private async getLineage(req: Request, res: Response): Promise<void> {
    try {
      const version = req.query.version as string;
      const lineage = this.lineageTracker.getLineage(req.params.id, version);
      if (!lineage) {
        return this.sendError(res, "Lineage not found", 404);
      }
      this.sendSuccess(res, lineage);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get ancestry chain
   * GET /models/:id/lineage/ancestry
   */
  private async getAncestry(req: Request, res: Response): Promise<void> {
    try {
      const version = req.query.version as string;
      const ancestry = this.lineageTracker.getAncestryChain(
        req.params.id,
        version
      );
      this.sendSuccess(res, ancestry);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get descendants
   * GET /models/:id/lineage/descendants
   */
  private async getDescendants(req: Request, res: Response): Promise<void> {
    try {
      const version = req.query.version as string;
      const descendants = this.lineageTracker.getDescendants(
        req.params.id,
        version
      );
      this.sendSuccess(res, descendants);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Compare lineages
   * GET /lineage/compare
   */
  private async compareLineages(req: Request, res: Response): Promise<void> {
    try {
      const { modelA, modelB } = req.query;
      if (typeof modelA !== "string" || typeof modelB !== "string") {
        return this.sendError(res, "Invalid model parameters");
      }

      const [idA, versionA] = modelA.split(":");
      const [idB, versionB] = modelB.split(":");

      const comparison = this.lineageTracker.compareLineages(
        { id: idA, version: versionA },
        { id: idB, version: versionB }
      );
      this.sendSuccess(res, comparison);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Model Comparison ====================

  /**
   * Compare models
   * POST /models/compare
   */
  private async compareModels(req: Request, res: Response): Promise<void> {
    try {
      const { modelA, modelB } = req.body;

      const modelRefA = await this.registry.getModel(modelA.id);
      const modelRefB = await this.registry.getModel(modelB.id);

      if (!modelRefA || !modelRefB) {
        return this.sendError(res, "One or both models not found", 404);
      }

      const metricsA = modelRefA.versions.find(
        v => v.version === modelA.version
      )?.metrics;
      const metricsB = modelRefB.versions.find(
        v => v.version === modelB.version
      )?.metrics;

      if (!metricsA || !metricsB) {
        return this.sendError(res, "One or both model versions not found");
      }

      const comparison = this.comparisonMetrics.compareModels(
        { id: modelA.id, version: modelA.version, name: modelRefA.name },
        metricsA,
        { id: modelB.id, version: modelB.version, name: modelRefB.name },
        metricsB
      );

      this.sendSuccess(res, comparison);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Rank models
   * POST /models/rank
   */
  private async rankModels(req: Request, res: Response): Promise<void> {
    try {
      const { modelIds } = req.body;

      const candidates = [];
      for (const id of modelIds) {
        const model = await this.registry.getModel(id);
        if (model) {
          const latestVersion = await this.registry.getLatestVersion(id);
          if (latestVersion) {
            candidates.push({
              reference: {
                id,
                version: latestVersion.version,
                name: model.name,
              },
              metrics: latestVersion.metrics,
            });
          }
        }
      }

      const rankings = this.comparisonMetrics.rankModels(candidates);
      this.sendSuccess(res, rankings);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Drift Detection ====================

  /**
   * Detect drift
   * POST /models/:id/drift/detect
   */
  private async detectDrift(req: Request, res: Response): Promise<void> {
    try {
      const { config } = req.body;
      const detector = new DriftDetector(config);
      const report = await detector.detectDrift(
        req.params.id,
        req.query.version as string
      );
      this.sendSuccess(res, report);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get drift history
   * GET /models/:id/drift/history
   */
  private async getDriftHistory(req: Request, res: Response): Promise<void> {
    try {
      // This would need to be tracked separately
      this.sendSuccess(res, []);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Statistics ====================

  /**
   * Get registry statistics
   * GET /statistics
   */
  private async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.registry.getStatistics();
      this.sendSuccess(res, stats);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  /**
   * Get recent activity
   * GET /activity
   */
  private async getRecentActivity(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const activity = this.registry.getRecentActivity(limit);
      this.sendSuccess(res, activity);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Search ====================

  /**
   * Search models
   * GET /search
   */
  private async searchModels(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query) {
        return this.sendError(res, "Query parameter required");
      }

      const filters = req.query.filters
        ? JSON.parse(req.query.filters as string)
        : undefined;
      const pagination = req.query.pagination
        ? JSON.parse(req.query.pagination as string)
        : undefined;

      const results = await this.registry.searchModels(
        query,
        filters,
        pagination
      );
      this.sendSuccess(res, results);
    } catch (error: any) {
      this.sendError(res, error.message);
    }
  }

  // ==================== Server Control ====================

  /**
   * Start the API server
   * @param port Port number
   * @param callback Callback when server starts
   */
  start(port: number, callback?: () => void): void {
    this.app.listen(port, callback);
  }

  /**
   * Get Express app (for testing)
   * @returns Express app
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get registry instance
   * @returns Model registry
   */
  getRegistry(): ModelRegistry {
    return this.registry;
  }

  /**
   * Get deployment tracker instance
   * @returns Deployment tracker
   */
  getDeploymentTracker(): DeploymentTracker {
    return this.deploymentTracker;
  }

  /**
   * Get lineage tracker instance
   * @returns Lineage tracker
   */
  getLineageTracker(): LineageTracker {
    return this.lineageTracker;
  }
}
