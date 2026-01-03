/**
 * @fileoverview Model registry for tracking model versions and metadata
 * @package @lsi/vljepa-training
 */

import type { ModelConfig, TrainingConfig, CheckpointInfo } from "../types.js";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Model version information
 */
interface ModelVersion {
  id: string;
  version: string;
  modelConfig: ModelConfig;
  trainingConfig: TrainingConfig;
  checkpointPath: string;
  metrics: {
    accuracy?: number;
    loss?: number;
    [key: string]: number | undefined;
  };
  tags: string[];
  metadata: {
    createdAt: number;
    createdBy?: string;
    description?: string;
    framework?: string;
    [key: string]: unknown;
  };
  parent?: string; // Parent model version for transfer learning
}

/**
 * Model registry entry
 */
interface RegistryEntry {
  modelId: string;
  versions: ModelVersion[];
  latestVersion?: string;
}

/**
 * Model registry for tracking model versions
 *
 * Features:
 * - Version tracking for models
 * - Metadata storage
 * - Model lineage
 * - Tag-based organization
 * - Model search and filtering
 */
export class ModelRegistry {
  private registry: Map<string, RegistryEntry> = new Map();
  private registryPath: string;
  private isEnabled: boolean;

  constructor(registryPath: string = "./model_registry.json") {
    this.registryPath = registryPath;
    this.isEnabled = true;
  }

  /**
   * Initialize registry
   */
  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    if (existsSync(this.registryPath)) {
      await this.load();
    } else {
      await this.save();
    }
  }

  /**
   * Register a new model version
   */
  async register(params: {
    modelId: string;
    version: string;
    modelConfig: ModelConfig;
    trainingConfig: TrainingConfig;
    checkpointPath: string;
    metrics?: Record<string, number>;
    tags?: string[];
    metadata?: Record<string, unknown>;
    parent?: string;
  }): Promise<ModelVersion> {
    const {
      modelId,
      version,
      modelConfig,
      trainingConfig,
      checkpointPath,
      metrics = {},
      tags = [],
      metadata = {},
      parent,
    } = params;

    // Create version
    const modelVersion: ModelVersion = {
      id: `${modelId}:${version}`,
      version,
      modelConfig,
      trainingConfig,
      checkpointPath,
      metrics,
      tags,
      metadata: {
        createdAt: Date.now(),
        ...metadata,
      },
      parent,
    };

    // Get or create registry entry
    let entry = this.registry.get(modelId);
    if (!entry) {
      entry = {
        modelId,
        versions: [],
      };
      this.registry.set(modelId, entry);
    }

    // Add version
    entry.versions.push(modelVersion);
    entry.latestVersion = version;

    // Save registry
    await this.save();

    console.log(`[ModelRegistry] Registered ${modelVersion.id}`);

    return modelVersion;
  }

  /**
   * Get a model version
   */
  get(modelId: string, version?: string): ModelVersion | null {
    const entry = this.registry.get(modelId);
    if (!entry) {
      return null;
    }

    if (!version) {
      version = entry.latestVersion;
    }

    return entry.versions.find(v => v.version === version) || null;
  }

  /**
   * Get latest version of a model
   */
  getLatest(modelId: string): ModelVersion | null {
    return this.get(modelId);
  }

  /**
   * List all models
   */
  listModels(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List versions of a model
   */
  listVersions(modelId: string): ModelVersion[] {
    const entry = this.registry.get(modelId);
    return entry?.versions || [];
  }

  /**
   * Search models by tags
   */
  searchByTags(tags: string[]): ModelVersion[] {
    const results: ModelVersion[] = [];

    for (const entry of this.registry.values()) {
      for (const version of entry.versions) {
        if (tags.every(tag => version.tags.includes(tag))) {
          results.push(version);
        }
      }
    }

    return results;
  }

  /**
   * Search models by metadata
   */
  searchByMetadata(query: Record<string, unknown>): ModelVersion[] {
    const results: ModelVersion[] = [];

    for (const entry of this.registry.values()) {
      for (const version of entry.versions) {
        let match = true;

        for (const [key, value] of Object.entries(query)) {
          if (version.metadata[key] !== value) {
            match = false;
            break;
          }
        }

        if (match) {
          results.push(version);
        }
      }
    }

    return results;
  }

  /**
   * Add tags to a model version
   */
  async addTags(
    modelId: string,
    version: string,
    tags: string[]
  ): Promise<void> {
    const modelVersion = this.get(modelId, version);
    if (!modelVersion) {
      throw new Error(`Model ${modelId}:${version} not found`);
    }

    for (const tag of tags) {
      if (!modelVersion.tags.includes(tag)) {
        modelVersion.tags.push(tag);
      }
    }

    await this.save();
  }

  /**
   * Remove tags from a model version
   */
  async removeTags(
    modelId: string,
    version: string,
    tags: string[]
  ): Promise<void> {
    const modelVersion = this.get(modelId, version);
    if (!modelVersion) {
      throw new Error(`Model ${modelId}:${version} not found`);
    }

    modelVersion.tags = modelVersion.tags.filter(t => !tags.includes(t));
    await this.save();
  }

  /**
   * Update model metadata
   */
  async updateMetadata(
    modelId: string,
    version: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const modelVersion = this.get(modelId, version);
    if (!modelVersion) {
      throw new Error(`Model ${modelId}:${version} not found`);
    }

    Object.assign(modelVersion.metadata, metadata);
    await this.save();
  }

  /**
   * Delete a model version
   */
  async delete(modelId: string, version?: string): Promise<void> {
    const entry = this.registry.get(modelId);
    if (!entry) {
      return;
    }

    if (version) {
      // Delete specific version
      entry.versions = entry.versions.filter(v => v.version !== version);

      // Update latest version
      if (entry.latestVersion === version) {
        const latest = entry.versions[entry.versions.length - 1];
        entry.latestVersion = latest?.version;
      }

      // Delete entry if no versions left
      if (entry.versions.length === 0) {
        this.registry.delete(modelId);
      }
    } else {
      // Delete all versions
      this.registry.delete(modelId);
    }

    await this.save();
  }

  /**
   * Get model lineage
   */
  getLineage(modelId: string, version: string): ModelVersion[] {
    const lineage: ModelVersion[] = [];
    let current: ModelVersion | null = this.get(modelId, version);

    while (current) {
      lineage.unshift(current);

      if (current.parent) {
        const [parentId, parentVersion] = current.parent.split(":");
        current = this.get(parentId, parentVersion);
      } else {
        break;
      }
    }

    return lineage;
  }

  /**
   * Compare two model versions
   */
  compare(
    modelId1: string,
    version1: string,
    modelId2: string,
    version2: string
  ): {
    model1: ModelVersion;
    model2: ModelVersion;
    metricsDiff: Record<string, number>;
  } | null {
    const model1 = this.get(modelId1, version1);
    const model2 = this.get(modelId2, version2);

    if (!model1 || !model2) {
      return null;
    }

    const metricsDiff: Record<string, number> = {};

    // Compare metrics
    const allKeys = new Set([
      ...Object.keys(model1.metrics),
      ...Object.keys(model2.metrics),
    ]);

    for (const key of allKeys) {
      const val1 = model1.metrics[key] || 0;
      const val2 = model2.metrics[key] || 0;
      metricsDiff[key] = val2 - val1;
    }

    return {
      model1,
      model2,
      metricsDiff,
    };
  }

  /**
   * Save registry to disk
   */
  async save(): Promise<void> {
    const data = Array.from(this.registry.entries());
    await writeFile(this.registryPath, JSON.stringify(data, null, 2));
  }

  /**
   * Load registry from disk
   */
  async load(): Promise<void> {
    const content = await readFile(this.registryPath, "utf-8");
    const data = JSON.parse(content) as [string, RegistryEntry][];
    this.registry = new Map(data);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalModels: number;
    totalVersions: number;
    tagsDistribution: Record<string, number>;
  } {
    let totalVersions = 0;
    const tagsDistribution: Record<string, number> = {};

    for (const entry of this.registry.values()) {
      totalVersions += entry.versions.length;

      for (const version of entry.versions) {
        for (const tag of version.tags) {
          tagsDistribution[tag] = (tagsDistribution[tag] || 0) + 1;
        }
      }
    }

    return {
      totalModels: this.registry.size,
      totalVersions,
      tagsDistribution,
    };
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
