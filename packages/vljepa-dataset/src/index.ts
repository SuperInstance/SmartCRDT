/**
 * @fileoverview Main entry point for VL-JEPA Dataset Collection System
 * @description Complete dataset collection and curation system for VL-JEPA fine-tuning
 *
 * This package provides tools for:
 * - Collecting UI screenshots and videos from web sources
 * - Extracting DOM structure and component information
 * - Filtering and validating data quality
 * - Creating before/after state pairs for training
 * - Formatting data for JEPA model training
 *
 * @module @lsi/vljepa-dataset
 */

// Import classes for DatasetManager
import { ScreenshotCollector } from "./collectors/ScreenshotCollector.js";
import {
  VideoCollector,
  type VideoCollectorConfig,
} from "./collectors/VideoCollector.js";
import {
  DOMExtractor,
  type DOMExtractorConfig,
} from "./collectors/DOMExtractor.js";
import {
  MetadataCollector,
  type MetadataCollectorConfig,
  type ExtendedMetadata,
  type PerformanceMetrics,
  type InteractionMetrics,
  type AccessibilityMetrics,
  type SEOMetrics,
  type FrameworkInfo,
} from "./collectors/MetadataCollector.js";
import { QualityFilter } from "./curators/QualityFilter.js";
import {
  Deduplicator,
  type DeduplicatorConfig,
} from "./curators/Deduplicator.js";
import {
  LabelValidator,
  type ValidationIssue,
  type ValidationResult,
  type ValidationStatistics,
} from "./curators/LabelValidator.js";
import {
  DiversitySampler,
  type DiversityConfig,
} from "./curators/DiversitySampler.js";
import {
  PairCreator,
  type PairCreatorConfig,
} from "./formatters/PairCreator.js";
import { JEPAFormatter } from "./formatters/JEPAFormatter.js";
import { LocalStorage } from "./storage/LocalStorage.js";
import { CacheManager } from "./storage/CacheManager.js";
import type {
  ScreenshotConfig,
  QualityFilterConfig,
  QualityReport,
  QualityIssue,
  QualityIssueType,
  QualityMetrics,
  StorageConfig,
  JEPAFormatterConfig,
} from "./types.js";

// Re-export all types
export * from "./types.js";

// Re-export collectors
export { ScreenshotCollector } from "./collectors/ScreenshotCollector.js";
export { VideoCollector } from "./collectors/VideoCollector.js";
export { DOMExtractor } from "./collectors/DOMExtractor.js";
export { MetadataCollector } from "./collectors/MetadataCollector.js";
export type { VideoCollectorConfig } from "./collectors/VideoCollector.js";
export type { DOMExtractorConfig } from "./collectors/DOMExtractor.js";
export type {
  MetadataCollectorConfig,
  ExtendedMetadata,
  PerformanceMetrics,
  InteractionMetrics,
  AccessibilityMetrics,
  SEOMetrics,
  FrameworkInfo,
} from "./collectors/MetadataCollector.js";

// Re-export curators
export { QualityFilter } from "./curators/QualityFilter.js";
export { Deduplicator } from "./curators/Deduplicator.js";
export { LabelValidator } from "./curators/LabelValidator.js";
export { DiversitySampler } from "./curators/DiversitySampler.js";
export type {
  QualityFilterConfig,
  QualityReport,
  QualityIssue,
  QualityIssueType,
  QualityMetrics,
} from "./types.js";
export type { DeduplicatorConfig } from "./curators/Deduplicator.js";
export type {
  ValidationIssue,
  ValidationResult,
  ValidationStatistics,
} from "./curators/LabelValidator.js";
export type { DiversityConfig } from "./curators/DiversitySampler.js";

// Re-export formatters
export { PairCreator } from "./formatters/PairCreator.js";
export { JEPAFormatter } from "./formatters/JEPAFormatter.js";
export type { PairCreatorConfig } from "./formatters/PairCreator.js";
export type { JEPAFormatterConfig } from "./types.js";

// Re-export storage
export { LocalStorage } from "./storage/LocalStorage.js";
export { CacheManager } from "./storage/CacheManager.js";

/**
 * Dataset manager - orchestrates the entire pipeline
 */
export class DatasetManager {
  private screenshotCollector: ScreenshotCollector;
  private videoCollector: VideoCollector;
  private domExtractor: DOMExtractor;
  private qualityFilter: QualityFilter;
  private deduplicator: Deduplicator;
  private pairCreator: PairCreator;
  private storage: LocalStorage;

  constructor(config?: {
    screenshot?: Partial<ScreenshotConfig>;
    video?: Partial<VideoCollectorConfig>;
    quality?: Partial<QualityFilterConfig>;
    storage?: Partial<StorageConfig>;
  }) {
    this.screenshotCollector = new ScreenshotCollector(config?.screenshot);
    this.videoCollector = new VideoCollector(config?.video);
    this.domExtractor = new DOMExtractor();
    this.qualityFilter = new QualityFilter(config?.quality);
    this.deduplicator = new Deduplicator();
    this.pairCreator = new PairCreator();
    this.storage = new LocalStorage(config?.storage);
  }

  /**
   * Collect complete dataset
   */
  async collect(options?: {
    targetScreenshots?: number;
    targetVideos?: number;
    targetPairs?: number;
  }): Promise<{
    screenshots: number;
    videos: number;
    pairs: number;
  }> {
    await this.screenshotCollector.initialize();
    await this.videoCollector.initialize();
    await this.storage.initialize();

    // Collect screenshots
    const screenshots = await this.screenshotCollector.collect();

    // Collect videos
    const videos = await this.videoCollector.recordFromURL(
      "https://example.com"
    );

    // Create pairs
    const pairs = await this.pairCreator.createPairs(screenshots);

    return {
      screenshots: screenshots.length,
      videos: videos.frames.length,
      pairs: pairs.length,
    };
  }

  /**
   * Close all resources
   */
  async close(): Promise<void> {
    await this.screenshotCollector.close();
    await this.videoCollector.close();
  }
}

// Default export
export default DatasetManager;
