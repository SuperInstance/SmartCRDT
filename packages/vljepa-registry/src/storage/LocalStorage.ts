/**
 * @fileoverview Local file system storage backend
 * @description Stores models and artifacts on local filesystem
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { StorageBackend } from "./StorageBackend.js";
import type { RegisteredModel, ModelArtifact } from "../types.js";

/**
 * Local filesystem storage backend
 */
export class LocalStorage extends StorageBackend {
  private basePath: string;
  private cache: Map<string, RegisteredModel>;

  constructor(basePath: string) {
    super();
    this.basePath = path.resolve(basePath);
    this.cache = new Map();
  }

  /**
   * Ensure directory exists
   * @param dirPath Directory path
   */
  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Get model metadata file path
   * @param modelId Model ID
   * @returns File path
   */
  private getModelPath(modelId: string): string {
    return path.join(this.basePath, "models", `${modelId}.json`);
  }

  /**
   * Get artifact file path
   * @param location Artifact location
   * @returns File path
   */
  private getArtifactPath(location: string): string {
    return path.join(this.basePath, "artifacts", location);
  }

  /**
   * Calculate checksum for data
   * @param data Data buffer
   * @returns SHA256 checksum
   */
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async saveModel(model: RegisteredModel): Promise<void> {
    await this.ensureDir(path.join(this.basePath, "models"));
    const modelPath = this.getModelPath(model.id);
    await fs.writeFile(modelPath, JSON.stringify(model, null, 2), "utf-8");
    this.cache.set(model.id, model);
  }

  async loadModel(modelId: string): Promise<RegisteredModel | undefined> {
    // Check cache first
    if (this.cache.has(modelId)) {
      return this.cache.get(modelId);
    }

    const modelPath = this.getModelPath(modelId);
    try {
      const data = await fs.readFile(modelPath, "utf-8");
      const model: RegisteredModel = JSON.parse(data);
      this.cache.set(modelId, model);
      return model;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const modelPath = this.getModelPath(modelId);
    try {
      await fs.unlink(modelPath);
      this.cache.delete(modelId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async listModels(): Promise<RegisteredModel[]> {
    await this.ensureDir(path.join(this.basePath, "models"));
    const modelsDir = path.join(this.basePath, "models");
    const files = await fs.readdir(modelsDir);
    const models: RegisteredModel[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }
      const modelId = file.replace(".json", "");
      const model = await this.loadModel(modelId);
      if (model) {
        models.push(model);
      }
    }

    return models;
  }

  async saveArtifact(artifact: ModelArtifact, data: Buffer): Promise<string> {
    await this.ensureDir(path.join(this.basePath, "artifacts"));

    // Verify checksum if provided
    if (artifact.checksum) {
      const calculatedChecksum = this.calculateChecksum(data);
      if (calculatedChecksum !== artifact.checksum) {
        throw new Error(`Checksum mismatch for artifact ${artifact.name}`);
      }
    } else {
      // Calculate and set checksum
      artifact.checksum = this.calculateChecksum(data);
    }

    const artifactPath = this.getArtifactPath(artifact.location);
    await this.ensureDir(path.dirname(artifactPath));
    await fs.writeFile(artifactPath, data);

    return artifact.location;
  }

  async loadArtifact(location: string): Promise<Buffer> {
    const artifactPath = this.getArtifactPath(location);
    return await fs.readFile(artifactPath);
  }

  async deleteArtifact(location: string): Promise<void> {
    const artifactPath = this.getArtifactPath(location);
    try {
      await fs.unlink(artifactPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async getArtifactUrl(location: string, expiresIn?: number): Promise<string> {
    // For local storage, return file:// URL
    const artifactPath = this.getArtifactPath(location);
    return `file://${artifactPath}`;
  }

  async artifactExists(location: string): Promise<boolean> {
    const artifactPath = this.getArtifactPath(location);
    try {
      await fs.access(artifactPath);
      return true;
    } catch {
      return false;
    }
  }

  async getStorageInfo(): Promise<{ usedBytes: number; totalBytes: number }> {
    let usedBytes = 0;

    const calculateSize = async (dirPath: string): Promise<void> => {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          await calculateSize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          usedBytes += stats.size;
        }
      }
    };

    try {
      await calculateSize(this.basePath);
    } catch {
      // Directory might not exist yet
    }

    return {
      usedBytes,
      totalBytes: -1, // Unknown for local filesystem
    };
  }
}
