/**
 * ManifestLoader - Load module manifests
 * Fetch and parse manifests from remote sources
 */

import type { ModuleManifest } from "../types.js";

export class ManifestLoader {
  private cache: Map<string, { manifest: ModuleManifest; timestamp: number }> =
    new Map();
  private cacheTimeout: number;

  constructor(cacheTimeout: number = 300000) {
    this.cacheTimeout = cacheTimeout;
  }

  /**
   * Load manifest from URL
   */
  async load(url: string): Promise<ModuleManifest> {
    // Check cache first
    const cached = this.getCached(url);
    if (cached) {
      return cached;
    }

    // Fetch manifest
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load manifest from ${url}: ${response.statusText}`
      );
    }

    const manifest = (await response.json()) as ModuleManifest;

    // Cache manifest
    this.setCached(url, manifest);

    return manifest;
  }

  /**
   * Load manifest with timeout
   */
  async loadWithTimeout(
    url: string,
    timeout: number = 5000
  ): Promise<ModuleManifest> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const manifest = await this.load(url);
      clearTimeout(timeoutId);
      return manifest;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Load multiple manifests
   */
  async loadMultiple(urls: string[]): Promise<Map<string, ModuleManifest>> {
    const results = new Map<string, ModuleManifest>();

    await Promise.all(
      urls.map(async url => {
        try {
          const manifest = await this.load(url);
          results.set(url, manifest);
        } catch (error) {
          console.warn(`Failed to load manifest from ${url}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Load manifest with retries
   */
  async loadWithRetry(
    url: string,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<ModuleManifest> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.loadWithTimeout(url);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await this.delay(delay * (attempt + 1));
      }
    }
    throw new Error(`Failed to load manifest after ${maxRetries} attempts`);
  }

  /**
   * Preload manifests
   */
  async preload(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.map(url => this.load(url)));
  }

  /**
   * Get cached manifest
   */
  private getCached(url: string): ModuleManifest | null {
    const cached = this.cache.get(url);
    if (!cached) {
      return null;
    }

    // Check if cache expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(url);
      return null;
    }

    return cached.manifest;
  }

  /**
   * Set cached manifest
   */
  private setCached(url: string, manifest: ModuleManifest): void {
    this.cache.set(url, {
      manifest,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for URL
   */
  clearCache(url?: string): void {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();

    for (const [url, entry] of this.cache) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(url);
      }
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache entries
   */
  getCacheEntries(): Array<{
    url: string;
    manifest: ModuleManifest;
    age: number;
  }> {
    const now = Date.now();
    const entries: Array<{
      url: string;
      manifest: ModuleManifest;
      age: number;
    }> = [];

    for (const [url, entry] of this.cache) {
      entries.push({
        url,
        manifest: entry.manifest,
        age: now - entry.timestamp,
      });
    }

    return entries;
  }

  /**
   * Validate manifest
   */
  validate(manifest: ModuleManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.name) {
      errors.push("Manifest name is required");
    }

    if (!manifest.version) {
      errors.push("Manifest version is required");
    }

    if (!Array.isArray(manifest.modules)) {
      errors.push("Modules must be an array");
    }

    if (typeof manifest.timestamp !== "number") {
      errors.push("Timestamp must be a number");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load and validate manifest
   */
  async loadAndValidate(url: string): Promise<{
    manifest: ModuleManifest;
    validation: ReturnType<typeof this.validate>;
  }> {
    const manifest = await this.load(url);
    const validation = this.validate(manifest);

    return { manifest, validation };
  }

  /**
   * Get manifest URL pattern
   */
  getManifestUrl(baseUrl: string, name: string, version: string): string {
    const cleanBase = baseUrl.replace(/\/$/, "");
    return `${cleanBase}/${name}/${version}/manifest.json`;
  }

  /**
   * Parse manifest URL
   */
  parseManifestUrl(url: string): {
    baseUrl: string;
    name: string;
    version: string;
  } | null {
    const match = url.match(/^(.*)\/([^/]+)\/([^/]+)\/manifest\.json$/);
    if (!match) {
      return null;
    }

    return {
      baseUrl: match[1],
      name: match[2],
      version: match[3],
    };
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }

  /**
   * Get cache timeout
   */
  getCacheTimeout(): number {
    return this.cacheTimeout;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
