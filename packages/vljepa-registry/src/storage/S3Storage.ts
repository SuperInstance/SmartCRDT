/**
 * @fileoverview AWS S3 storage backend
 * @description Stores models and artifacts in AWS S3
 */

import {
  S3,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { StorageBackend } from "./StorageBackend.js";
import type { RegisteredModel, ModelArtifact, S3Config } from "../types.js";

/**
 * S3 storage backend
 */
export class S3Storage extends StorageBackend {
  private s3: S3;
  private bucket: string;
  private prefix: string;
  private cache: Map<string, RegisteredModel>;

  constructor(config: S3Config) {
    super();
    this.s3 = new S3({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
    this.prefix = config.prefix || "vljepa-registry";
    this.cache = new Map();
  }

  /**
   * Get S3 key for model metadata
   * @param modelId Model ID
   * @returns S3 key
   */
  private getModelKey(modelId: string): string {
    return `${this.prefix}/models/${modelId}.json`;
  }

  /**
   * Get S3 key for artifact
   * @param location Artifact location
   * @returns S3 key
   */
  private getArtifactKey(location: string): string {
    return `${this.prefix}/artifacts/${location}`;
  }

  /**
   * Convert stream to buffer
   * @param stream Readable stream
   * @returns Buffer
   */
  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  async saveModel(model: RegisteredModel): Promise<void> {
    const key = this.getModelKey(model.id);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(model, null, 2),
      ContentType: "application/json",
    });
    await this.s3.send(command);
    this.cache.set(model.id, model);
  }

  async loadModel(modelId: string): Promise<RegisteredModel | undefined> {
    // Check cache first
    if (this.cache.has(modelId)) {
      return this.cache.get(modelId);
    }

    const key = this.getModelKey(modelId);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      const response = await this.s3.send(command);
      const body = response.Body;
      if (!body) {
        return undefined;
      }

      const buffer = await this.streamToBuffer(body as Readable);
      const model: RegisteredModel = JSON.parse(buffer.toString("utf-8"));
      this.cache.set(modelId, model);
      return model;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return undefined;
      }
      throw error;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const key = this.getModelKey(modelId);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3.send(command);
    this.cache.delete(modelId);
  }

  async listModels(): Promise<RegisteredModel[]> {
    const models: RegisteredModel[] = [];
    const prefix = `${this.prefix}/models/`;

    let continuationToken: string | undefined = undefined;

    do {
      const response = await this.s3.listObjectsV2({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key.endsWith(".json")) {
            const modelId = object.Key.replace(prefix, "").replace(".json", "");
            const model = await this.loadModel(modelId);
            if (model) {
              models.push(model);
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return models;
  }

  async saveArtifact(artifact: ModelArtifact, data: Buffer): Promise<string> {
    const key = this.getArtifactKey(artifact.location);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: this.getContentType(artifact.type),
    });
    await this.s3.send(command);

    // Update artifact size if not set
    if (!artifact.size) {
      artifact.size = data.length;
    }

    return artifact.location;
  }

  /**
   * Get content type for artifact
   * @param type Artifact type
   * @returns Content type string
   */
  private getContentType(type: string): string {
    const contentTypes: Record<string, string> = {
      weights: "application/octet-stream",
      config: "application/json",
      optimizer_state: "application/octet-stream",
      training_data: "application/octet-stream",
      evaluation: "application/json",
      docker_image: "application/vnd.docker.distribution.manifest.v2+json",
      onnx: "application/octet-stream",
      quantized: "application/octet-stream",
    };
    return contentTypes[type] || "application/octet-stream";
  }

  async loadArtifact(location: string): Promise<Buffer> {
    const key = this.getArtifactKey(location);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);
    const body = response.Body;
    if (!body) {
      throw new Error(`Empty response for artifact: ${location}`);
    }

    return this.streamToBuffer(body as Readable);
  }

  async deleteArtifact(location: string): Promise<void> {
    const key = this.getArtifactKey(location);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3.send(command);
  }

  async getArtifactUrl(location: string, expiresIn = 3600): Promise<string> {
    const key = this.getArtifactKey(location);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

  async artifactExists(location: string): Promise<boolean> {
    const key = this.getArtifactKey(location);
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async getStorageInfo(): Promise<{ usedBytes: number; totalBytes: number }> {
    let usedBytes = 0;

    let continuationToken: string | undefined = undefined;

    do {
      const response = await this.s3.listObjectsV2({
        Bucket: this.bucket,
        Prefix: this.prefix,
        ContinuationToken: continuationToken,
      });

      if (response.Contents) {
        for (const object of response.Contents) {
          usedBytes += object.Size || 0;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      usedBytes,
      totalBytes: -1, // Unknown for S3
    };
  }
}
