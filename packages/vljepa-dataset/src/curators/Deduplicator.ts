/**
 * @fileoverview Deduplicator - Remove duplicate or near-duplicate samples
 * @description Uses perceptual hashing and similarity scoring to deduplicate datasets
 */

// @ts-ignore - Sharp is optional
import type sharp from "sharp";
import type { CollectedScreenshot, DatasetError } from "../types.js";

/**
 * Deduplicator configuration
 */
export interface DeduplicatorConfig {
  similarityThreshold: number;
  hashMethod: "perceptual" | "average" | "difference";
  maxSize: number;
}

/**
 * Deduplicator class
 */
export class Deduplicator {
  private config: DeduplicatorConfig;
  private sharpInstance: typeof sharp | null = null;
  private hashes: Map<string, string> = new Map();
  private groups: Map<string, string[]> = new Map();

  constructor(config?: Partial<DeduplicatorConfig>) {
    this.config = {
      similarityThreshold: config?.similarityThreshold ?? 0.95,
      hashMethod: config?.hashMethod ?? "perceptual",
      maxSize: config?.maxSize ?? 10000,
    };
  }

  /**
   * Initialize Sharp
   */
  private async getSharp(): Promise<typeof sharp> {
    if (!this.sharpInstance) {
      try {
        this.sharpInstance = (await import("sharp")).default;
      } catch (error) {
        throw new Error(
          "Sharp library not available. Install it with: npm install sharp"
        );
      }
    }
    return this.sharpInstance;
  }

  /**
   * Deduplicate screenshots
   */
  async deduplicate(screenshots: CollectedScreenshot[]): Promise<{
    unique: CollectedScreenshot[];
    duplicates: Map<string, string>;
    groups: Map<string, string[]>;
  }> {
    // Calculate hashes
    const hashes = await this.calculateHashes(screenshots);

    // Find duplicates
    const duplicates = new Map<string, string>();
    const groups = new Map<string, string[]>();

    for (let i = 0; i < screenshots.length; i++) {
      const id1 = screenshots[i].id;
      const hash1 = hashes.get(id1)!;

      if (duplicates.has(id1)) continue;

      const group: string[] = [id1];

      for (let j = i + 1; j < screenshots.length; j++) {
        const id2 = screenshots[j].id;
        const hash2 = hashes.get(id2)!;

        if (duplicates.has(id2)) continue;

        const similarity = this.calculateHashSimilarity(hash1, hash2);

        if (similarity >= this.config.similarityThreshold) {
          duplicates.set(id2, id1);
          group.push(id2);
        }
      }

      if (group.length > 1) {
        groups.set(id1, group);
      }
    }

    // Filter unique screenshots
    const unique = screenshots.filter(s => !duplicates.has(s.id));

    this.hashes = hashes;
    this.groups = groups;

    return { unique, duplicates, groups };
  }

  /**
   * Calculate hashes for all screenshots
   */
  private async calculateHashes(
    screenshots: CollectedScreenshot[]
  ): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();

    for (const screenshot of screenshots) {
      const hash = await this.calculateHash(screenshot.image);
      hashes.set(screenshot.id, hash);
    }

    return hashes;
  }

  /**
   * Calculate perceptual hash of image
   */
  private async calculateHash(image: Buffer): Promise<string> {
    const sharp = await this.getSharp();

    try {
      switch (this.config.hashMethod) {
        case "perceptual":
          return await this.perceptualHash(sharp, image);
        case "average":
          return await this.averageHash(sharp, image);
        case "difference":
          return await this.differenceHash(sharp, image);
        default:
          return await this.perceptualHash(sharp, image);
      }
    } catch {
      // Fallback to simple hash
      return image.toString("base64").slice(0, 64);
    }
  }

  /**
   * Perceptual hash (pHash)
   */
  private async perceptualHash(
    sharp: typeof sharp,
    image: Buffer
  ): Promise<string> {
    // Resize to 32x32 and convert to grayscale
    const grayscale = await sharp(image)
      .resize(32, 32, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    // Calculate DCT (simplified - just use average hash)
    let sum = 0;
    for (let i = 0; i < grayscale.length; i++) {
      sum += grayscale[i];
    }
    const avg = sum / grayscale.length;

    // Create binary hash
    let hash = "";
    for (let i = 0; i < grayscale.length; i++) {
      hash += grayscale[i] > avg ? "1" : "0";
    }

    return hash;
  }

  /**
   * Average hash
   */
  private async averageHash(
    sharp: typeof sharp,
    image: Buffer
  ): Promise<string> {
    const grayscale = await sharp(image)
      .resize(8, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    let sum = 0;
    for (let i = 0; i < grayscale.length; i++) {
      sum += grayscale[i];
    }
    const avg = sum / grayscale.length;

    let hash = "";
    for (let i = 0; i < grayscale.length; i++) {
      hash += grayscale[i] > avg ? "1" : "0";
    }

    return hash;
  }

  /**
   * Difference hash
   */
  private async differenceHash(
    sharp: typeof sharp,
    image: Buffer
  ): Promise<string> {
    const grayscale = await sharp(image)
      .resize(9, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    let hash = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = grayscale[y * 9 + x];
        const right = grayscale[y * 9 + x + 1];
        hash += left > right ? "1" : "0";
      }
    }

    return hash;
  }

  /**
   * Calculate similarity between two hashes
   */
  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0;
    }

    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    return 1 - differences / hash1.length;
  }

  /**
   * Find near-duplicates within threshold
   */
  async findNearDuplicates(
    screenshots: CollectedScreenshot[],
    minSimilarity: number
  ): Promise<Array<[string, string, number]>> {
    const hashes = await this.calculateHashes(screenshots);
    const results: Array<[string, string, number]> = [];

    for (let i = 0; i < screenshots.length; i++) {
      for (let j = i + 1; j < screenshots.length; j++) {
        const similarity = this.calculateHashSimilarity(
          hashes.get(screenshots[i].id)!,
          hashes.get(screenshots[j].id)!
        );

        if (similarity >= minSimilarity) {
          results.push([screenshots[i].id, screenshots[j].id, similarity]);
        }
      }
    }

    return results.sort((a, b) => b[2] - a[2]);
  }

  /**
   * Get hash groups
   */
  getGroups(): Map<string, string[]> {
    return new Map(this.groups);
  }

  /**
   * Clear stored hashes and groups
   */
  clear(): void {
    this.hashes.clear();
    this.groups.clear();
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
