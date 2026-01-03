/**
 * CacheBuster - Cache busting for module updates
 * Ensure fresh modules are loaded
 */

import type { CacheBusterConfig } from "../types.js";

export class CacheBuster {
  private config: CacheBusterConfig;
  private version: string = Date.now().toString();
  private hashes: Map<string, string> = new Map();

  constructor(config: Partial<CacheBusterConfig> = {}) {
    this.config = {
      strategy: config.strategy || "query",
      versionParam: config.versionParam || "v",
    };
  }

  /**
   * Bust cache for a URL
   */
  bust(url: string, customVersion?: string): string {
    const version = customVersion || this.generateVersion();

    switch (this.config.strategy) {
      case "query":
        return this.bustWithQuery(url, version);
      case "filename":
        return this.bustWithFilename(url, version);
      case "etag":
        return this.bustWithETag(url);
      default:
        return url;
    }
  }

  /**
   * Bust cache with query parameter
   */
  private bustWithQuery(url: string, version: string): string {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${this.config.versionParam}=${version}`;
  }

  /**
   * Bust cache with filename modification
   */
  private bustWithFilename(url: string, version: string): string {
    const parts = url.split(".");
    if (parts.length < 2) {
      return url;
    }

    const ext = parts.pop()!;
    const base = parts.join(".");

    return `${base}.${version}.${ext}`;
  }

  /**
   * Bust cache with ETag
   */
  private bustWithETag(url: string): string {
    const hash = this.hashes.get(url);
    if (hash) {
      return this.bustWithQuery(url, hash.substring(0, 8));
    }
    return url;
  }

  /**
   * Generate cache busting version
   */
  generateVersion(): string {
    return Date.now().toString();
  }

  /**
   * Set hash for a URL
   */
  setHash(url: string, hash: string): void {
    this.hashes.set(url, hash);
  }

  /**
   * Get hash for a URL
   */
  getHash(url: string): string | undefined {
    return this.hashes.get(url);
  }

  /**
   * Clear all hashes
   */
  clearHashes(): void {
    this.hashes.clear();
  }

  /**
   * Set global version
   */
  setVersion(version: string): void {
    this.version = version;
  }

  /**
   * Get global version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Bust cache for all modules
   */
  bustAll(urls: string[]): Map<string, string> {
    const result = new Map<string, string>();

    for (const url of urls) {
      result.set(url, this.bust(url));
    }

    return result;
  }

  /**
   * Create cache buster URL pattern
   */
  createPattern(pattern: string): string {
    return this.bust(pattern);
  }

  /**
   * Extract original URL from busted URL
   */
  extractOriginal(bustedUrl: string): string {
    switch (this.config.strategy) {
      case "query":
        return this.extractFromQuery(bustedUrl);
      case "filename":
        return this.extractFromFilename(bustedUrl);
      case "etag":
        return this.extractFromQuery(bustedUrl);
      default:
        return bustedUrl;
    }
  }

  /**
   * Extract from query parameter
   */
  private extractFromQuery(url: string): string {
    const regex = new RegExp(`[?&]${this.config.versionParam}=[^&]+`);
    return url.replace(regex, "").replace("?&", "?").replace(/&$/, "");
  }

  /**
   * Extract from filename
   */
  private extractFromFilename(url: string): string {
    return url.replace(/\.[a-f0-9]+\.(js|css|json)$/, ".$1");
  }

  /**
   * Check if URL is busted
   */
  isBusted(url: string): boolean {
    switch (this.config.strategy) {
      case "query":
        return url.includes(`${this.config.versionParam}=`);
      case "filename":
        return /\.[a-f0-9]+\.(js|css|json)$/.test(url);
      case "etag":
        return url.includes(`${this.config.versionParam}=`);
      default:
        return false;
    }
  }

  /**
   * Get strategy
   */
  getStrategy(): CacheBusterConfig["strategy"] {
    return this.config.strategy;
  }

  /**
   * Set strategy
   */
  setStrategy(strategy: CacheBusterConfig["strategy"]): void {
    this.config.strategy = strategy;
  }

  /**
   * Get version parameter name
   */
  getVersionParam(): string {
    return this.config.versionParam;
  }

  /**
   * Set version parameter name
   */
  setVersionParam(param: string): void {
    this.config.versionParam = param;
  }
}
