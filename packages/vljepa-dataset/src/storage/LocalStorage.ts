/**
 * @fileoverview Local Storage - File system storage for datasets
 * @description Manages local storage of collected datasets
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import type {
  CollectedScreenshot,
  UIStatePair,
  VideoSegment,
  StorageConfig,
  DatasetStatistics,
  DatasetError,
} from "../types.js";

/**
 * Local Storage class
 */
export class LocalStorage {
  private config: StorageConfig;
  private basePath: string;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      type: "local",
      basePath: config.basePath ?? "./data/vljepa-dataset",
      maxCacheSize: config.maxCacheSize ?? 10 * 1024 * 1024 * 1024, // 10GB
      compressionLevel: config.compressionLevel ?? 6,
      metadataFormat: config.metadataFormat ?? "json",
    };
    this.basePath = this.config.basePath;
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    try {
      const dirs = [
        this.basePath,
        join(this.basePath, "screenshots"),
        join(this.basePath, "videos"),
        join(this.basePath, "pairs"),
        join(this.basePath, "metadata"),
        join(this.basePath, "cache"),
      ];

      for (const dir of dirs) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }
    } catch (error) {
      throw this.createError("storage-failed", "Failed to initialize storage", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save screenshot
   */
  async saveScreenshot(screenshot: CollectedScreenshot): Promise<string> {
    const filename = `${screenshot.id}.${screenshot.metadata.format}`;
    const imagePath = join(this.basePath, "screenshots", filename);
    const metadataPath = join(
      this.basePath,
      "metadata",
      `${screenshot.id}.json`
    );

    try {
      // Save image
      writeFileSync(imagePath, screenshot.image);

      // Save metadata
      writeFileSync(metadataPath, JSON.stringify(screenshot.metadata, null, 2));

      return imagePath;
    } catch (error) {
      throw this.createError(
        "storage-failed",
        `Failed to save screenshot ${screenshot.id}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Save multiple screenshots
   */
  async saveScreenshots(screenshots: CollectedScreenshot[]): Promise<string[]> {
    const paths: string[] = [];

    for (const screenshot of screenshots) {
      const path = await this.saveScreenshot(screenshot);
      paths.push(path);
    }

    return paths;
  }

  /**
   * Load screenshot
   */
  async loadScreenshot(id: string): Promise<CollectedScreenshot | null> {
    try {
      const metadataPath = join(this.basePath, "metadata", `${id}.json`);

      if (!existsSync(metadataPath)) {
        return null;
      }

      const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));

      // Find image file
      const screenshotDir = join(this.basePath, "screenshots");
      const files = readdirSync(screenshotDir);
      const imageFile = files.find(f => f.startsWith(id));

      if (!imageFile) {
        return null;
      }

      const imagePath = join(screenshotDir, imageFile);
      const image = readFileSync(imagePath);

      return {
        id,
        url: metadata.url,
        image,
        metadata,
        timestamp: metadata.timestamp,
      };
    } catch (error) {
      console.error(`Failed to load screenshot ${id}:`, error);
      return null;
    }
  }

  /**
   * Save video segment
   */
  async saveVideo(video: VideoSegment): Promise<string> {
    const videoDir = join(this.basePath, "videos", video.id);
    mkdirSync(videoDir, { recursive: true });

    try {
      // Save frames
      for (let i = 0; i < video.frames.length; i++) {
        const framePath = join(
          videoDir,
          `frame_${i.toString().padStart(6, "0")}.png`
        );
        writeFileSync(framePath, video.frames[i].image);
      }

      // Save metadata
      const metadataPath = join(videoDir, "metadata.json");
      writeFileSync(
        metadataPath,
        JSON.stringify(
          {
            ...video.metadata,
            frameCount: video.frames.length,
            actions: video.actions,
          },
          null,
          2
        )
      );

      return videoDir;
    } catch (error) {
      throw this.createError(
        "storage-failed",
        `Failed to save video ${video.id}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Save UI state pair
   */
  async savePair(pair: UIStatePair): Promise<string> {
    const pairPath = join(this.basePath, "pairs", `${pair.id}.json`);

    try {
      // Save pair data (without image buffers for JSON)
      const pairData = {
        id: pair.id,
        changeType: pair.changeType,
        changeDescription: pair.changeDescription,
        diff: pair.diff,
        metadata: pair.metadata,
        beforeScreenshotPath: join(
          this.basePath,
          "screenshots",
          `${pair.before.screenshot.id}.${pair.before.screenshot.metadata.format}`
        ),
        afterScreenshotPath: join(
          this.basePath,
          "screenshots",
          `${pair.after.screenshot.id}.${pair.after.screenshot.metadata.format}`
        ),
      };

      writeFileSync(pairPath, JSON.stringify(pairData, null, 2));

      return pairPath;
    } catch (error) {
      throw this.createError(
        "storage-failed",
        `Failed to save pair ${pair.id}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Save statistics
   */
  async saveStatistics(stats: DatasetStatistics): Promise<string> {
    const statsPath = join(this.basePath, "statistics.json");

    try {
      writeFileSync(statsPath, JSON.stringify(stats, null, 2));
      return statsPath;
    } catch (error) {
      throw this.createError("storage-failed", "Failed to save statistics", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load statistics
   */
  async loadStatistics(): Promise<DatasetStatistics | null> {
    const statsPath = join(this.basePath, "statistics.json");

    if (!existsSync(statsPath)) {
      return null;
    }

    try {
      const data = readFileSync(statsPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Calculate storage usage
   */
  async getStorageUsage(): Promise<{
    totalBytes: number;
    screenshots: number;
    videos: number;
    pairs: number;
  }> {
    let totalBytes = 0;
    let screenshots = 0;
    let videos = 0;
    let pairs = 0;

    try {
      const screenshotDir = join(this.basePath, "screenshots");
      if (existsSync(screenshotDir)) {
        const files = readdirSync(screenshotDir);
        screenshots = files.length;
        for (const file of files) {
          const stat = statSync(join(screenshotDir, file));
          totalBytes += stat.size;
        }
      }

      const videoDir = join(this.basePath, "videos");
      if (existsSync(videoDir)) {
        const subdirs = readdirSync(videoDir);
        videos = subdirs.length;
        for (const subdir of subdirs) {
          const subdirPath = join(videoDir, subdir);
          const files = readdirSync(subdirPath);
          for (const file of files) {
            const stat = statSync(join(subdirPath, file));
            totalBytes += stat.size;
          }
        }
      }

      const pairDir = join(this.basePath, "pairs");
      if (existsSync(pairDir)) {
        const files = readdirSync(pairDir);
        pairs = files.length;
        for (const file of files) {
          const stat = statSync(join(pairDir, file));
          totalBytes += stat.size;
        }
      }
    } catch (error) {
      console.error("Failed to calculate storage usage:", error);
    }

    return { totalBytes, screenshots, videos, pairs };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    // This would delete all data - implement carefully
    console.warn("Clear operation not implemented for safety");
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}
