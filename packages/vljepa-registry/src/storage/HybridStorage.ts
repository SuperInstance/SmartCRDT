/**
 * @fileoverview Hybrid storage backend combining local and S3
 * @description Uses local for fast access, S3 for persistence and backup
 */

import { StorageBackend } from "./StorageBackend.js";
import { LocalStorage } from "./LocalStorage.js";
import { S3Storage } from "./S3Storage.js";
import type { RegisteredModel, ModelArtifact, S3Config } from "../types.js";

/**
 * Hybrid storage configuration
 */
export interface HybridStorageConfig {
  localPath: string;
  s3Config: S3Config;
  syncOnWrite?: boolean;
  preferLocal?: boolean;
}

/**
 * Hybrid storage backend
 * Combines local storage for fast access with S3 for persistence
 */
export class HybridStorage extends StorageBackend {
  private local: LocalStorage;
  private s3: S3Storage;
  private syncOnWrite: boolean;
  private preferLocal: boolean;
  private syncQueue: Set<string>;

  constructor(config: HybridStorageConfig) {
    super();
    this.local = new LocalStorage(config.localPath);
    this.s3 = new S3Storage(config.s3Config);
    this.syncOnWrite = config.syncOnWrite !== false;
    this.preferLocal = config.preferLocal !== false;
    this.syncQueue = new Set();
  }

  async saveModel(model: RegisteredModel): Promise<void> {
    await this.local.saveModel(model);
    if (this.syncOnWrite) {
      try {
        await this.s3.saveModel(model);
      } catch (error) {
        console.error(`Failed to sync model ${model.id} to S3:`, error);
        this.syncQueue.add(model.id);
      }
    }
  }

  async loadModel(modelId: string): Promise<RegisteredModel | undefined> {
    if (this.preferLocal) {
      const localModel = await this.local.loadModel(modelId);
      if (localModel) return localModel;
    }
    const s3Model = await this.s3.loadModel(modelId);
    if (s3Model) {
      try {
        await this.local.saveModel(s3Model);
      } catch (error) {
        console.error(`Failed to cache model ${modelId} locally:`, error);
      }
      return s3Model;
    }
    return undefined;
  }

  async deleteModel(modelId: string): Promise<void> {
    await Promise.all([
      this.local.deleteModel(modelId),
      this.s3.deleteModel(modelId),
    ]);
    this.syncQueue.delete(modelId);
  }

  async listModels(): Promise<RegisteredModel[]> {
    const localModels = await this.local.listModels();
    if (localModels.length === 0) {
      const s3Models = await this.s3.listModels();
      for (const model of s3Models) {
        try {
          await this.local.saveModel(model);
        } catch (error) {
          console.error(`Failed to cache model ${model.id} locally:`, error);
        }
      }
      return s3Models;
    }
    return localModels;
  }

  async saveArtifact(artifact: ModelArtifact, data: Buffer): Promise<string> {
    await this.local.saveArtifact(artifact, data);
    if (this.syncOnWrite) {
      try {
        await this.s3.saveArtifact(artifact, data);
      } catch (error) {
        console.error(`Failed to sync artifact ${artifact.name} to S3:`, error);
      }
    }
    return artifact.location;
  }

  async loadArtifact(location: string): Promise<Buffer> {
    const localExists = await this.local.artifactExists(location);
    if (localExists) return await this.local.loadArtifact(location);

    const data = await this.s3.loadArtifact(location);
    try {
      const artifact: ModelArtifact = {
        type: "other",
        name: location,
        location,
        size: data.length,
        checksum: "",
        metadata: {},
      };
      await this.local.saveArtifact(artifact, data);
    } catch (error) {
      console.error(`Failed to cache artifact ${location} locally:`, error);
    }
    return data;
  }

  async deleteArtifact(location: string): Promise<void> {
    await Promise.all([
      this.local.deleteArtifact(location),
      this.s3.deleteArtifact(location),
    ]);
  }

  async getArtifactUrl(location: string, expiresIn?: number): Promise<string> {
    const localExists = await this.local.artifactExists(location);
    if (localExists)
      return await this.local.getArtifactUrl(location, expiresIn);
    return await this.s3.getArtifactUrl(location, expiresIn);
  }

  async artifactExists(location: string): Promise<boolean> {
    const localExists = await this.local.artifactExists(location);
    if (localExists) return true;
    return await this.s3.artifactExists(location);
  }

  async getStorageInfo(): Promise<{ usedBytes: number; totalBytes: number }> {
    const [localInfo, s3Info] = await Promise.all([
      this.local.getStorageInfo(),
      this.s3.getStorageInfo(),
    ]);
    return {
      usedBytes: localInfo.usedBytes + s3Info.usedBytes,
      totalBytes: -1,
    };
  }

  async syncToS3(): Promise<void> {
    for (const modelId of this.syncQueue) {
      try {
        const model = await this.local.loadModel(modelId);
        if (model) {
          await this.s3.saveModel(model);
          this.syncQueue.delete(modelId);
        }
      } catch (error) {
        console.error(`Failed to sync model ${modelId}:`, error);
      }
    }
  }

  async syncFromS3(): Promise<void> {
    const s3Models = await this.s3.listModels();
    for (const model of s3Models) {
      try {
        await this.local.saveModel(model);
      } catch (error) {
        console.error(`Failed to sync model ${model.id} from S3:`, error);
      }
    }
  }

  async clearLocalCache(): Promise<void> {
    this.syncQueue.clear();
  }
}
