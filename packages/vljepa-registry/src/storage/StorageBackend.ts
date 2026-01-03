/**
 * @fileoverview Abstract storage backend interface
 * @description Defines the contract for all storage backends
 */

import type { RegisteredModel, ModelArtifact } from "../types.js";

/**
 * Abstract storage backend interface
 * All storage implementations must extend this
 */
export abstract class StorageBackend {
  /**
   * Save a model to storage
   * @param model Model to save
   */
  abstract saveModel(model: RegisteredModel): Promise<void>;

  /**
   * Load a model from storage
   * @param modelId Model ID
   * @returns Model or undefined if not found
   */
  abstract loadModel(modelId: string): Promise<RegisteredModel | undefined>;

  /**
   * Delete a model from storage
   * @param modelId Model ID
   */
  abstract deleteModel(modelId: string): Promise<void>;

  /**
   * List all models in storage
   * @returns Array of models
   */
  abstract listModels(): Promise<RegisteredModel[]>;

  /**
   * Save an artifact
   * @param artifact Artifact to save
   * @param data Artifact data
   */
  abstract saveArtifact(artifact: ModelArtifact, data: Buffer): Promise<string>;

  /**
   * Load an artifact
   * @param location Artifact location
   * @returns Artifact data
   */
  abstract loadArtifact(location: string): Promise<Buffer>;

  /**
   * Delete an artifact
   * @param location Artifact location
   */
  abstract deleteArtifact(location: string): Promise<void>;

  /**
   * Get artifact URL for downloading
   * @param location Artifact location
   * @param expiresIn Expiry time in seconds
   * @returns Signed URL or local path
   */
  abstract getArtifactUrl(
    location: string,
    expiresIn?: number
  ): Promise<string>;

  /**
   * Check if an artifact exists
   * @param location Artifact location
   */
  abstract artifactExists(location: string): Promise<boolean>;

  /**
   * Get storage statistics
   * @returns Storage usage info
   */
  abstract getStorageInfo(): Promise<{ usedBytes: number; totalBytes: number }>;
}
