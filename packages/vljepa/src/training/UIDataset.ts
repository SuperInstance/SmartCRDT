/**
 * @lsi/vljepa - UI Dataset for JEPA Fine-Tuning
 *
 * Dataset design for UI-specific JEPA fine-tuning.
 * JEPA requires video + text data with contextual masking.
 *
 * UI Data Types:
 * 1. UI Screenshots: Web-sourced, synthetic, user-contributed
 * 2. UI Pairs: Before/after states with instructions
 * 3. UI Videos: 30fps screen recordings with interactions
 * 4. UI Code: HTML/CSS pairs with rendered output
 *
 * @module training
 */

import { promises as fs } from "fs";
import { join } from "path";
import {
  UIDataEntry,
  UIVideoClip,
  UIVideoFrame,
  UserInteraction,
  UIComponent,
  CurriculumStage,
} from "./types.js";

/**
 * UI Dataset Configuration
 */
export interface UIDatasetConfig {
  /** Dataset name */
  name: string;

  /** Dataset version */
  version: string;

  /** Dataset source */
  source: "web-scraped" | "synthetic" | "user-contributed" | "mixed";

  /** Data storage directory */
  storageDir: string;

  /** Image format */
  imageFormat: "PNG" | "JPEG";

  /** Image dimensions */
  imageSize: {
    width: number;
    height: number;
  };

  /** Frame rate for video clips */
  frameRate: number;

  /** Metadata format */
  metadataFormat: "JSON" | "JSONL";
}

/**
 * UI Dataset Manager
 *
 * Manages UI-specific datasets for JEPA fine-tuning.
 * Handles data collection, processing, and augmentation.
 */
export class UIDataset {
  private config: UIDatasetConfig;
  private data: Map<string, UIDataEntry> = new Map();
  private clips: Map<string, UIVideoClip> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<UIDatasetConfig> = {}) {
    this.config = {
      name: "aequor-ui-dataset",
      version: "1.0.0",
      source: "mixed",
      storageDir: "./data/vljepa/ui",
      imageFormat: "PNG",
      imageSize: { width: 1920, height: 1080 },
      frameRate: 30,
      metadataFormat: "JSONL",
      ...config,
    };
  }

  /**
   * Initialize dataset
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create storage directories
    await fs.mkdir(this.config.storageDir, { recursive: true });
    await fs.mkdir(join(this.config.storageDir, "screenshots"), {
      recursive: true,
    });
    await fs.mkdir(join(this.config.storageDir, "clips"), { recursive: true });
    await fs.mkdir(join(this.config.storageDir, "metadata"), {
      recursive: true,
    });
    await fs.mkdir(join(this.config.storageDir, "augmented"), {
      recursive: true,
    });

    // Load existing data
    await this.loadData();

    this.initialized = true;
    console.log("UIDataset initialized:", {
      config: this.config,
      numEntries: this.data.size,
      numClips: this.clips.size,
    });
  }

  /**
   * Add UI screenshot entry
   */
  async addEntry(entry: UIDataEntry): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate entry
    this.validateEntry(entry);

    // Store entry
    this.data.set(entry.id, entry);

    // Save to disk
    await this.saveEntry(entry);

    console.log("Added UI entry:", entry.id);
  }

  /**
   * Add UI video clip
   */
  async addClip(clip: UIVideoClip): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate clip
    this.validateClip(clip);

    // Store clip
    this.clips.set(clip.id, clip);

    // Save to disk
    await this.saveClip(clip);

    console.log("Added UI clip:", clip.id, {
      frames: clip.frames.length,
      duration: clip.frames.length / clip.frameRate,
    });
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): UIDataEntry | undefined {
    return this.data.get(id);
  }

  /**
   * Get clip by ID
   */
  getClip(id: string): UIVideoClip | undefined {
    return this.clips.get(id);
  }

  /**
   * Get all entries
   */
  getAllEntries(): UIDataEntry[] {
    return Array.from(this.data.values());
  }

  /**
   * Get all clips
   */
  getAllClips(): UIVideoClip[] {
    return Array.from(this.clips.values());
  }

  /**
   * Filter entries by curriculum stage
   */
  filterByStage(stage: CurriculumStage): UIDataEntry[] {
    return this.getAllEntries().filter(stage.datasetFilter);
  }

  /**
   * Generate synthetic UI data
   *
   * Creates synthetic UI screenshots and videos for training.
   * This is important for augmenting real data.
   */
  async generateSyntheticData(options: {
    numSamples: number;
    variations: "layout" | "style" | "content" | "all";
  }): Promise<void> {
    console.log("Generating synthetic UI data:", options);

    for (let i = 0; i < options.numSamples; i++) {
      const entry = this.createSyntheticEntry(i, options.variations);
      await this.addEntry(entry);
    }

    console.log(`Generated ${options.numSamples} synthetic UI entries`);
  }

  /**
   * Create synthetic UI entry
   */
  private createSyntheticEntry(index: number, variation: string): UIDataEntry {
    const id = `synthetic-${Date.now()}-${index}`;

    // Create synthetic image data
    const beforeImage = this.createSyntheticImage();
    const afterImage = this.createSyntheticImage();

    // Create synthetic instruction
    const instruction = this.createSyntheticInstruction(variation);

    // Create synthetic metadata
    const metadata = {
      framework: this.randomChoice([
        "React",
        "Vue",
        "Angular",
        "Svelte",
      ]) as UIDataEntry["metadata"]["framework"],
      componentLib: this.randomChoice(["shadcn", "MUI", "Chakra", "Tailwind"]),
      layout: this.randomChoice([
        "grid",
        "flex",
        "absolute",
      ]) as UIDataEntry["metadata"]["layout"],
      responsive: Math.random() > 0.5,
      theme: this.randomChoice([
        "light",
        "dark",
        "auto",
      ]) as UIDataEntry["metadata"]["theme"],
    };

    // Create synthetic components
    const components = this.createSyntheticComponents(5);

    return {
      id,
      beforeImage,
      afterImage,
      instruction,
      metadata,
      components,
      interactions: [],
    };
  }

  /**
   * Create synthetic image data
   */
  private createSyntheticImage(): ImageData {
    // Create synthetic 1920x1080 image
    const width = 1920;
    const height = 1080;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill with random colors
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.floor(Math.random() * 256); // R
      data[i + 1] = Math.floor(Math.random() * 256); // G
      data[i + 2] = Math.floor(Math.random() * 256); // B
      data[i + 3] = 255; // A
    }

    return new ImageData(data, width, height);
  }

  /**
   * Create synthetic instruction
   */
  private createSyntheticInstruction(variation: string): string {
    const instructions = {
      layout: [
        "Center this button",
        "Move this to the left",
        "Align these items vertically",
        "Make this grid responsive",
        "Adjust the spacing",
      ],
      style: [
        "Change the color to blue",
        "Make this larger",
        "Add a shadow effect",
        "Use a rounded border",
        "Apply dark theme",
      ],
      content: [
        "Update the text",
        "Add an icon",
        "Include an image",
        "Remove this element",
        "Replace with new content",
      ],
    };

    const pool =
      variation === "all"
        ? [
            ...instructions.layout,
            ...instructions.style,
            ...instructions.content,
          ]
        : instructions[variation as keyof typeof instructions] ||
          instructions.layout;

    return this.randomChoice(pool);
  }

  /**
   * Create synthetic UI components
   */
  private createSyntheticComponents(count: number): UIComponent[] {
    const components: UIComponent[] = [];
    const types: UIComponent["type"][] = [
      "button",
      "input",
      "text",
      "image",
      "container",
      "navigation",
      "form",
    ];

    for (let i = 0; i < count; i++) {
      components.push({
        type: this.randomChoice(types),
        bbox: {
          x: Math.floor(Math.random() * 1800),
          y: Math.floor(Math.random() * 1000),
          width: Math.floor(Math.random() * 200) + 50,
          height: Math.floor(Math.random() * 100) + 30,
        },
        attributes: {
          id: `component-${i}`,
          class: `component-${types[i % types.length]}`,
        },
        text: Math.random() > 0.5 ? `Component ${i}` : undefined,
      });
    }

    return components;
  }

  /**
   * Validate UI entry
   */
  private validateEntry(entry: UIDataEntry): void {
    if (!entry.id) {
      throw new Error("Entry ID is required");
    }
    if (!entry.beforeImage) {
      throw new Error("Before image is required");
    }
    if (!entry.instruction) {
      throw new Error("Instruction is required");
    }
    if (!entry.metadata) {
      throw new Error("Metadata is required");
    }
  }

  /**
   * Validate UI clip
   */
  private validateClip(clip: UIVideoClip): void {
    if (!clip.id) {
      throw new Error("Clip ID is required");
    }
    if (!clip.frames || clip.frames.length === 0) {
      throw new Error("Clip must have at least one frame");
    }
    if (clip.frameRate <= 0) {
      throw new Error("Frame rate must be positive");
    }
  }

  /**
   * Save entry to disk
   */
  private async saveEntry(entry: UIDataEntry): Promise<void> {
    // Save image data
    const imagePath = join(
      this.config.storageDir,
      "screenshots",
      `${entry.id}.png`
    );
    // Note: In production, would save actual image data
    // await fs.writeFile(imagePath, imageBuffer);

    // Save metadata
    const metadataPath = join(
      this.config.storageDir,
      "metadata",
      `${entry.id}.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(entry, null, 2));
  }

  /**
   * Save clip to disk
   */
  private async saveClip(clip: UIVideoClip): Promise<void> {
    // Save clip metadata
    const clipPath = join(this.config.storageDir, "clips", `${clip.id}.json`);
    await fs.writeFile(clipPath, JSON.stringify(clip, null, 2));

    // Save frames
    const framesDir = join(this.config.storageDir, "clips", clip.id, "frames");
    await fs.mkdir(framesDir, { recursive: true });

    for (const frame of clip.frames) {
      const framePath = join(framesDir, `frame-${frame.frameNumber}.png`);
      // Note: In production, would save actual frame data
      // await fs.writeFile(framePath, frameBuffer);
    }
  }

  /**
   * Load data from disk
   */
  private async loadData(): Promise<void> {
    try {
      // Load entries
      const metadataDir = join(this.config.storageDir, "metadata");
      const metadataFiles = await fs.readdir(metadataDir);

      for (const file of metadataFiles) {
        if (file.endsWith(".json")) {
          const filePath = join(metadataDir, file);
          const data = await fs.readFile(filePath, "utf8");
          const entry: UIDataEntry = JSON.parse(data);
          this.data.set(entry.id, entry);
        }
      }

      // Load clips
      const clipsDir = join(this.config.storageDir, "clips");
      const clipFiles = await fs.readdir(clipsDir);

      for (const file of clipFiles) {
        if (file.endsWith(".json")) {
          const filePath = join(clipsDir, file);
          const data = await fs.readFile(filePath, "utf8");
          const clip: UIVideoClip = JSON.parse(data);
          this.clips.set(clip.id, clip);
        }
      }

      console.log(
        `Loaded ${this.data.size} entries and ${this.clips.size} clips from disk`
      );
    } catch (error) {
      console.log("No existing data found, starting fresh");
    }
  }

  /**
   * Data augmentation
   * Augments UI data with random transformations
   */
  async augmentData(options: {
    flip?: boolean;
    rotate?: number;
    crop?: boolean;
    colorJitter?: boolean;
  }): Promise<void> {
    console.log("Augmenting UI data:", options);

    const augmentedEntries: UIDataEntry[] = [];

    for (const entry of this.getAllEntries()) {
      // Create augmented versions
      if (options.flip) {
        augmentedEntries.push(this.flipEntry(entry));
      }
      if (options.rotate) {
        augmentedEntries.push(this.rotateEntry(entry, options.rotate));
      }
      if (options.crop) {
        augmentedEntries.push(this.cropEntry(entry));
      }
      if (options.colorJitter) {
        augmentedEntries.push(this.jitterEntryColors(entry));
      }
    }

    // Add augmented entries
    for (const entry of augmentedEntries) {
      await this.addEntry(entry);
    }

    console.log(`Augmented ${augmentedEntries.length} entries`);
  }

  /**
   * Flip entry horizontally
   */
  private flipEntry(entry: UIDataEntry): UIDataEntry {
    return {
      ...entry,
      id: `${entry.id}-flipped`,
      beforeImage: this.flipImage(entry.beforeImage),
      afterImage: entry.afterImage
        ? this.flipImage(entry.afterImage)
        : undefined,
    };
  }

  /**
   * Rotate entry
   */
  private rotateEntry(entry: UIDataEntry, angle: number): UIDataEntry {
    return {
      ...entry,
      id: `${entry.id}-rotated-${angle}`,
      beforeImage: this.rotateImage(entry.beforeImage, angle),
      afterImage: entry.afterImage
        ? this.rotateImage(entry.afterImage, angle)
        : undefined,
    };
  }

  /**
   * Crop entry
   */
  private cropEntry(entry: UIDataEntry): UIDataEntry {
    return {
      ...entry,
      id: `${entry.id}-cropped`,
      beforeImage: this.cropImage(entry.beforeImage),
      afterImage: entry.afterImage
        ? this.cropImage(entry.afterImage)
        : undefined,
    };
  }

  /**
   * Jitter entry colors
   */
  private jitterEntryColors(entry: UIDataEntry): UIDataEntry {
    return {
      ...entry,
      id: `${entry.id}-jittered`,
      beforeImage: this.jitterImageColors(entry.beforeImage),
      afterImage: entry.afterImage
        ? this.jitterImageColors(entry.afterImage)
        : undefined,
    };
  }

  /**
   * Flip image horizontally
   */
  private flipImage(image: ImageData): ImageData {
    const { width, height, data } = image;
    const flippedData = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * 4;
        const dstIndex = (y * width + (width - 1 - x)) * 4;
        flippedData[dstIndex] = data[srcIndex];
        flippedData[dstIndex + 1] = data[srcIndex + 1];
        flippedData[dstIndex + 2] = data[srcIndex + 2];
        flippedData[dstIndex + 3] = data[srcIndex + 3];
      }
    }

    return new ImageData(flippedData, width, height);
  }

  /**
   * Rotate image
   */
  private rotateImage(image: ImageData, angle: number): ImageData {
    // Simplified rotation (just returns original for now)
    // PHASE 4: Implement actual rotation
    return image;
  }

  /**
   * Crop image
   */
  private cropImage(image: ImageData): ImageData {
    // Simplified cropping (just returns original for now)
    // PHASE 4: Implement actual cropping
    return image;
  }

  /**
   * Jitter image colors
   */
  private jitterImageColors(image: ImageData): ImageData {
    const { data } = image;
    const jitteredData = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i += 4) {
      const jitter = () => Math.floor((Math.random() - 0.5) * 20);
      jitteredData[i] = Math.max(0, Math.min(255, data[i] + jitter())); // R
      jitteredData[i + 1] = Math.max(0, Math.min(255, data[i + 1] + jitter())); // G
      jitteredData[i + 2] = Math.max(0, Math.min(255, data[i + 2] + jitter())); // B
      jitteredData[i + 3] = data[i + 3]; // A
    }

    return new ImageData(jitteredData, image.width, image.height);
  }

  /**
   * Split dataset into train/val/test
   */
  splitData(ratios: { train: number; val: number; test: number }): {
    train: UIDataEntry[];
    val: UIDataEntry[];
    test: UIDataEntry[];
  } {
    const entries = this.getAllEntries();
    const shuffled = [...entries].sort(() => Math.random() - 0.5);

    const trainSplit = Math.floor(shuffled.length * ratios.train);
    const valSplit = trainSplit + Math.floor(shuffled.length * ratios.val);

    return {
      train: shuffled.slice(0, trainSplit),
      val: shuffled.slice(trainSplit, valSplit),
      test: shuffled.slice(valSplit),
    };
  }

  /**
   * Get dataset statistics
   */
  getStatistics(): {
    totalEntries: number;
    totalClips: number;
    totalFrames: number;
    frameworkDistribution: Record<string, number>;
    componentTypeDistribution: Record<string, number>;
  } {
    const entries = this.getAllEntries();
    const clips = this.getAllClips();

    const frameworkDistribution: Record<string, number> = {};
    const componentTypeDistribution: Record<string, number> = {};

    for (const entry of entries) {
      frameworkDistribution[entry.metadata.framework] =
        (frameworkDistribution[entry.metadata.framework] || 0) + 1;

      for (const component of entry.components || []) {
        componentTypeDistribution[component.type] =
          (componentTypeDistribution[component.type] || 0) + 1;
      }
    }

    const totalFrames = clips.reduce(
      (sum, clip) => sum + clip.frames.length,
      0
    );

    return {
      totalEntries: entries.length,
      totalClips: clips.length,
      totalFrames,
      frameworkDistribution,
      componentTypeDistribution,
    };
  }

  /**
   * Random choice helper
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Shutdown dataset
   */
  async shutdown(): Promise<void> {
    console.log("UIDataset shutdown complete");
  }

  /**
   * Export dataset to JSONL format for training
   */
  async exportToJSONL(outputPath: string): Promise<void> {
    const entries = this.getAllEntries();
    const lines = entries.map(entry => JSON.stringify(entry));

    await fs.writeFile(outputPath, lines.join("\n"), "utf8");
    console.log(`Exported ${entries.length} entries to ${outputPath}`);
  }

  /**
   * Import dataset from JSONL format
   */
  async importFromJSONL(inputPath: string): Promise<void> {
    const data = await fs.readFile(inputPath, "utf8");
    const lines = data.split("\n").filter(line => line.trim());

    for (const line of lines) {
      const entry: UIDataEntry = JSON.parse(line);
      await this.addEntry(entry);
    }

    console.log(`Imported ${lines.length} entries from ${inputPath}`);
  }
}

/**
 * Create UI dataset with default configuration
 */
export async function createUIDataset(
  config?: Partial<UIDatasetConfig>
): Promise<UIDataset> {
  const dataset = new UIDataset(config);
  await dataset.initialize();
  return dataset;
}
