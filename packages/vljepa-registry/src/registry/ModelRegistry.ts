/**
 * @fileoverview Main Model Registry for VL-JEPA model management
 * @description Central registry for tracking models, versions, metadata, and lifecycle
 */

import { v4 as uuidv4 } from "uuid";
import * as semver from "semver";
import type {
  ModelRegistryConfig,
  RegisteredModel,
  ModelVersion,
  ModelMetadata,
  ModelSearchFilters,
  ModelSortOptions,
  PaginationOptions,
  PaginatedResult,
  RegistryStatistics,
  ActivityEntry,
  LifecycleStage,
} from "../types.js";
import { StorageBackend } from "../storage/StorageBackend.js";
import { LocalStorage } from "../storage/LocalStorage.js";
import { S3Storage } from "../storage/S3Storage.js";
import { HybridStorage } from "../storage/HybridStorage.js";

/**
 * Main Model Registry class
 * Provides CRUD operations for models and version management
 */
export class ModelRegistry {
  private config: ModelRegistryConfig;
  private storage: StorageBackend;
  private models: Map<string, RegisteredModel>;
  private activity: ActivityEntry[];

  /**
   * Create a new ModelRegistry
   * @param config Registry configuration
   */
  constructor(config: ModelRegistryConfig) {
    this.config = config;
    this.models = new Map();
    this.activity = [];

    // Initialize storage backend
    switch (config.storage.type) {
      case "local":
        this.storage = new LocalStorage(config.storage.localPath || "./models");
        break;
      case "s3":
        this.storage = new S3Storage(config.storage.s3Config!);
        break;
      case "hybrid":
        this.storage = new HybridStorage(
          config.storage.localPath || "./models",
          config.storage.s3Config!
        );
        break;
      default:
        throw new Error(`Unsupported storage type: ${config.storage.type}`);
    }
  }

  /**
   * Register a new model in the registry
   * @param name Model name
   * @param description Model description
   * @param metadata Model metadata
   * @param tags Optional tags
   * @returns Registered model
   */
  async registerModel(
    name: string,
    description: string,
    metadata: ModelMetadata,
    tags: string[] = []
  ): Promise<RegisteredModel> {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error("Model name cannot be empty");
    }

    if (this.config.metadataValidation) {
      this.validateMetadata(metadata);
    }

    // Check if model already exists
    const existing = Array.from(this.models.values()).find(
      m => m.name === name
    );
    if (existing) {
      throw new Error(
        `Model with name '${name}' already exists: ${existing.id}`
      );
    }

    // Create new model
    const model: RegisteredModel = {
      id: uuidv4(),
      name,
      description,
      versions: [],
      metadata,
      created: Date.now(),
      updated: Date.now(),
      stage: "development",
      tags,
    };

    this.models.set(model.id, model);
    this.recordActivity(
      "model_created",
      model.id,
      undefined,
      `Registered model: ${name}`
    );

    // Persist to storage
    await this.storage.saveModel(model);

    return model;
  }

  /**
   * Get a model by ID
   * @param modelId Model ID
   * @returns Model or undefined if not found
   */
  async getModel(modelId: string): Promise<RegisteredModel | undefined> {
    const model = this.models.get(modelId);
    if (!model) {
      // Try loading from storage
      const loaded = await this.storage.loadModel(modelId);
      if (loaded) {
        this.models.set(modelId, loaded);
        return loaded;
      }
      return undefined;
    }
    return model;
  }

  /**
   * Get a model by name
   * @param name Model name
   * @returns Model or undefined if not found
   */
  async getModelByName(name: string): Promise<RegisteredModel | undefined> {
    const model = Array.from(this.models.values()).find(m => m.name === name);
    if (model) {
      return model;
    }

    // Search in storage
    for (const [id, m] of this.models.entries()) {
      if (m.name === name) {
        return m;
      }
    }
    return undefined;
  }

  /**
   * List all models with optional filtering and pagination
   * @param filters Optional search filters
   * @param sort Optional sort options
   * @param pagination Optional pagination
   * @returns Paginated list of models
   */
  async listModels(
    filters?: ModelSearchFilters,
    sort?: ModelSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<RegisteredModel>> {
    let models = Array.from(this.models.values());

    // Apply filters
    if (filters) {
      models = this.applyFilters(models, filters);
    }

    // Apply sorting
    if (sort) {
      models = this.applySort(models, sort);
    }

    // Apply pagination
    const total = models.length;
    let page = 1;
    let pageSize = models.length;

    if (pagination) {
      page = Math.max(1, pagination.page);
      pageSize = Math.max(1, pagination.pageSize);
    }

    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = models.slice(startIndex, endIndex);

    return {
      items,
      total,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Update a model
   * @param modelId Model ID
   * @param updates Fields to update
   * @returns Updated model
   */
  async updateModel(
    modelId: string,
    updates: Partial<
      Pick<RegisteredModel, "name" | "description" | "tags" | "stage">
    >
  ): Promise<RegisteredModel> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Apply updates
    if (updates.name) model.name = updates.name;
    if (updates.description !== undefined)
      model.description = updates.description;
    if (updates.tags) model.tags = updates.tags;
    if (updates.stage) model.stage = updates.stage;

    model.updated = Date.now();
    this.recordActivity(
      "model_updated",
      modelId,
      undefined,
      "Model metadata updated"
    );

    await this.storage.saveModel(model);
    return model;
  }

  /**
   * Delete a model
   * @param modelId Model ID
   * @param deleteArtifacts Whether to delete artifacts from storage
   */
  async deleteModel(modelId: string, deleteArtifacts = false): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Delete artifacts if requested
    if (deleteArtifacts) {
      for (const version of model.versions) {
        for (const artifact of version.artifacts) {
          await this.storage.deleteArtifact(artifact.location);
        }
      }
    }

    this.models.delete(modelId);
    await this.storage.deleteModel(modelId);
    this.recordActivity(
      "model_created",
      modelId,
      undefined,
      `Deleted model: ${model.name}`
    );
  }

  /**
   * Add a version to a model
   * @param modelId Model ID
   * @param version Version object
   * @returns Updated model
   */
  async addVersion(
    modelId: string,
    version: ModelVersion
  ): Promise<RegisteredModel> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Validate version string
    if (!semver.valid(version.version)) {
      throw new Error(`Invalid semantic version: ${version.version}`);
    }

    // Check if version already exists
    const existing = model.versions.find(v => v.version === version.version);
    if (existing) {
      throw new Error(
        `Version ${version.version} already exists for model ${modelId}`
      );
    }

    // Auto-archive old versions if enabled
    if (
      this.config.autoArchive &&
      model.versions.length >= this.config.maxVersions
    ) {
      const nonProductionVersions = model.versions.filter(
        v => !v.isProduction && !v.isArchived
      );
      const toArchive = nonProductionVersions.slice(
        0,
        nonProductionVersions.length - this.config.maxVersions + 1
      );
      for (const v of toArchive) {
        v.isArchived = true;
      }
    }

    model.versions.push(version);
    model.updated = Date.now();

    // Sort versions by semantic version
    model.versions.sort((a, b) => semver.compare(a.version, b.version));

    await this.storage.saveModel(model);
    this.recordActivity(
      "model_created",
      modelId,
      version.version,
      `Added version ${version.version}`
    );

    return model;
  }

  /**
   * Get a specific version of a model
   * @param modelId Model ID
   * @param version Version string
   * @returns Version or undefined if not found
   */
  async getVersion(
    modelId: string,
    version: string
  ): Promise<ModelVersion | undefined> {
    const model = await this.getModel(modelId);
    if (!model) {
      return undefined;
    }
    return model.versions.find(v => v.version === version);
  }

  /**
   * Get the latest version of a model
   * @param modelId Model ID
   * @returns Latest version or undefined if no versions
   */
  async getLatestVersion(modelId: string): Promise<ModelVersion | undefined> {
    const model = await this.getModel(modelId);
    if (!model || model.versions.length === 0) {
      return undefined;
    }
    // Versions are sorted, so last is latest
    return model.versions[model.versions.length - 1];
  }

  /**
   * Get the production version of a model
   * @param modelId Model ID
   * @returns Production version or undefined if none marked as production
   */
  async getProductionVersion(
    modelId: string
  ): Promise<ModelVersion | undefined> {
    const model = await this.getModel(modelId);
    if (!model) {
      return undefined;
    }
    return model.versions.find(v => v.isProduction && !v.isArchived);
  }

  /**
   * Set a version as production
   * @param modelId Model ID
   * @param version Version string
   * @returns Updated model
   */
  async setProductionVersion(
    modelId: string,
    version: string
  ): Promise<RegisteredModel> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const targetVersion = model.versions.find(v => v.version === version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for model ${modelId}`);
    }

    // Unset all other production versions
    for (const v of model.versions) {
      v.isProduction = v.version === version;
    }

    model.updated = Date.now();
    await this.storage.saveModel(model);

    this.recordActivity(
      "model_created",
      modelId,
      version,
      `Set version ${version} as production`
    );

    return model;
  }

  /**
   * Delete a version
   * @param modelId Model ID
   * @param version Version string
   * @param deleteArtifacts Whether to delete artifacts from storage
   */
  async deleteVersion(
    modelId: string,
    version: string,
    deleteArtifacts = false
  ): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const versionIndex = model.versions.findIndex(v => v.version === version);
    if (versionIndex === -1) {
      throw new Error(`Version ${version} not found for model ${modelId}`);
    }

    const targetVersion = model.versions[versionIndex];

    // Delete artifacts if requested
    if (deleteArtifacts) {
      for (const artifact of targetVersion.artifacts) {
        await this.storage.deleteArtifact(artifact.location);
      }
    }

    model.versions.splice(versionIndex, 1);
    model.updated = Date.now();

    await this.storage.saveModel(model);
    this.recordActivity(
      "model_created",
      modelId,
      version,
      `Deleted version ${version}`
    );
  }

  /**
   * Search models by query string
   * @param query Search query
   * @param filters Optional filters
   * @param pagination Optional pagination
   * @returns Search results
   */
  async searchModels(
    query: string,
    filters?: ModelSearchFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<RegisteredModel>> {
    const lowerQuery = query.toLowerCase();
    let models = Array.from(this.models.values()).filter(
      m =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery) ||
        m.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );

    if (filters) {
      models = this.applyFilters(models, filters);
    }

    const total = models.length;
    let page = 1;
    let pageSize = models.length;

    if (pagination) {
      page = Math.max(1, pagination.page);
      pageSize = Math.max(1, pagination.pageSize);
    }

    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      items: models.slice(startIndex, endIndex),
      total,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  async getStatistics(): Promise<RegistryStatistics> {
    const models = Array.from(this.models.values());

    const modelsByStage: Record<LifecycleStage, number> = {
      development: 0,
      staging: 0,
      production: 0,
      archived: 0,
      deprecated: 0,
    };

    const modelsByType: Record<string, number> = {};

    let totalVersions = 0;
    let totalStorage = 0;

    for (const model of models) {
      modelsByStage[model.stage]++;
      modelsByType[model.metadata.type] =
        (modelsByType[model.metadata.type] || 0) + 1;
      totalVersions += model.versions.length;

      for (const version of model.versions) {
        for (const artifact of version.artifacts) {
          totalStorage += artifact.size;
        }
      }
    }

    return {
      totalModels: models.length,
      totalVersions,
      modelsByStage,
      modelsByType: modelsByType as any,
      totalStorage,
      totalDeployments: 0, // Tracked by DeploymentTracker
      activeDeployments: 0,
      recentActivity: this.activity.slice(-100),
    };
  }

  /**
   * Validate model metadata
   * @param metadata Metadata to validate
   */
  private validateMetadata(metadata: ModelMetadata): void {
    if (!metadata.type) {
      throw new Error("Model metadata must specify type");
    }
    if (!metadata.architecture) {
      throw new Error("Model metadata must specify architecture");
    }
    if (!metadata.framework) {
      throw new Error("Model metadata must specify framework");
    }
    if (!metadata.inputShape || metadata.inputShape.length === 0) {
      throw new Error("Model metadata must specify inputShape");
    }
    if (!metadata.outputShape || metadata.outputShape.length === 0) {
      throw new Error("Model metadata must specify outputShape");
    }
    if (metadata.parameters <= 0) {
      throw new Error("Model metadata must specify valid parameters count");
    }
  }

  /**
   * Apply filters to model list
   * @param models Models to filter
   * @param filters Filter criteria
   * @returns Filtered models
   */
  private applyFilters(
    models: RegisteredModel[],
    filters: ModelSearchFilters
  ): RegisteredModel[] {
    return models.filter(model => {
      if (
        filters.name &&
        !model.name.toLowerCase().includes(filters.name.toLowerCase())
      ) {
        return false;
      }
      if (filters.type && model.metadata.type !== filters.type) {
        return false;
      }
      if (filters.stage && model.stage !== filters.stage) {
        return false;
      }
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.every(tag => model.tags.includes(tag))) {
          return false;
        }
      }
      if (
        filters.architecture &&
        model.metadata.architecture !== filters.architecture
      ) {
        return false;
      }
      if (filters.framework && model.metadata.framework !== filters.framework) {
        return false;
      }
      if (filters.createdAfter && model.created < filters.createdAfter) {
        return false;
      }
      if (filters.createdBefore && model.created > filters.createdBefore) {
        return false;
      }
      if (
        filters.minParameters &&
        model.metadata.parameters < filters.minParameters
      ) {
        return false;
      }
      if (
        filters.maxParameters &&
        model.metadata.parameters > filters.maxParameters
      ) {
        return false;
      }
      if (filters.isProduction !== undefined) {
        const hasProduction = model.versions.some(
          v => v.isProduction && !v.isArchived
        );
        if (filters.isProduction && !hasProduction) {
          return false;
        }
        if (!filters.isProduction && hasProduction) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Apply sorting to model list
   * @param models Models to sort
   * @param sort Sort options
   * @returns Sorted models
   */
  private applySort(
    models: RegisteredModel[],
    sort: ModelSortOptions
  ): RegisteredModel[] {
    return [...models].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "created":
          comparison = a.created - b.created;
          break;
        case "updated":
          comparison = a.updated - b.updated;
          break;
        case "parameters":
          comparison = a.metadata.parameters - b.metadata.parameters;
          break;
        case "size":
          comparison = a.metadata.size - b.metadata.size;
          break;
        case "accuracy":
          const accA =
            a.versions.length > 0 ? a.versions[0].metrics.accuracy.top1 : 0;
          const accB =
            b.versions.length > 0 ? b.versions[0].metrics.accuracy.top1 : 0;
          comparison = accA - accB;
          break;
        case "latency":
          const latA =
            a.versions.length > 0 ? a.versions[0].metrics.latency.avg : 0;
          const latB =
            b.versions.length > 0 ? b.versions[0].metrics.latency.avg : 0;
          comparison = latA - latB;
          break;
        default:
          comparison = 0;
      }

      return sort.order === "asc" ? comparison : -comparison;
    });
  }

  /**
   * Record an activity entry
   * @param type Activity type
   * @param modelId Model ID
   * @param version Optional version
   * @param details Activity details
   * @param user User who performed action (default: 'system')
   */
  private recordActivity(
    type: ActivityEntry["type"],
    modelId: string,
    version: string | undefined,
    details: string,
    user = "system"
  ): void {
    const entry: ActivityEntry = {
      type,
      modelId,
      version,
      user,
      timestamp: Date.now(),
      details,
    };
    this.activity.push(entry);

    // Keep only last 1000 activities
    if (this.activity.length > 1000) {
      this.activity = this.activity.slice(-1000);
    }
  }

  /**
   * Get recent activity
   * @param limit Number of entries to return
   * @returns Recent activity entries
   */
  getRecentActivity(limit = 100): ActivityEntry[] {
    return this.activity.slice(-limit).reverse();
  }

  /**
   * Load models from storage on startup
   */
  async loadFromStorage(): Promise<void> {
    const models = await this.storage.listModels();
    for (const model of models) {
      this.models.set(model.id, model);
    }
  }
}
