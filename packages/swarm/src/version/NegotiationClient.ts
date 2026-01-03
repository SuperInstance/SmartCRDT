/**
 * @lsi/swarm - Negotiation Client
 *
 * Client-side version negotiation for cartridges.
 * Handles communication with negotiation server and local compatibility checks.
 */

import type {
  VersionNegotiationRequest,
  VersionNegotiationResponse,
  NegotiationCartridgeVersion,
  NegotiationResult,
  NegotiationCompatibilityResult,
  UpgradeResult,
  UpgradeOptions,
  NegotiationOptions,
  BreakingChange,
  MigrationPath,
} from "@lsi/protocol";
import { VersionSelector } from "./VersionSelector.js";

/**
 * Client-side version negotiation
 */
export class NegotiationClient {
  private selector: VersionSelector;
  private clientVersion: string;
  private clientId: string;

  constructor(clientId: string, clientVersion: string) {
    this.clientId = clientId;
    this.clientVersion = clientVersion;
    this.selector = new VersionSelector();
  }

  /**
   * Negotiate version with server
   *
   * @param cartridgeId - Cartridge identifier
   * @param serverUrl - Server URL for negotiation
   * @param supportedVersions - Versions client supports
   * @param options - Negotiation options
   * @returns Negotiation result
   */
  async negotiate(
    cartridgeId: string,
    serverUrl: string,
    supportedVersions: string[],
    options?: NegotiationOptions
  ): Promise<NegotiationResult> {
    const request: VersionNegotiationRequest = {
      clientId: this.clientId,
      cartridgeId,
      clientVersion: this.clientVersion,
      supportedVersions,
      capabilities: {
        protocolVersion: "1.0.0",
        features: [],
        constraints: {},
      },
    };

    try {
      const response = await this.sendRequest(serverUrl, request, options);

      return {
        selectedVersion: response.selectedVersion,
        compatible:
          response.reason !== "no_compatible_version" &&
          response.reason !== "upgrade_required",
        breakingChanges: response.breakingChanges,
        migrationRequired: response.migrationRequired,
        confidence: this.calculateConfidence(response),
        migrationPath: response.migrationPath,
      };
    } catch (error) {
      // Fall back to local compatibility check
      return this.fallbackToLocalCheck(cartridgeId, supportedVersions);
    }
  }

  /**
   * Check local compatibility without server
   *
   * @param cartridgeId - Cartridge identifier
   * @param version - Version to check
   * @param availableVersions - Locally known available versions
   * @returns Compatibility result
   */
  async checkLocalCompatibility(
    cartridgeId: string,
    version: string,
    availableVersions?: NegotiationCartridgeVersion[]
  ): Promise<NegotiationCompatibilityResult> {
    if (!availableVersions) {
      // If no versions provided, assume compatible if version parses
      const parsed = this.selector.parseSemVer(version);
      return {
        compatible: !!parsed,
        selectedVersion: version,
        reason: parsed
          ? "Version parsed successfully"
          : "Invalid version format",
        breakingChanges: [],
      };
    }

    const cartridgeVersions = availableVersions.filter(
      v => v.cartridgeId === cartridgeId
    );
    const versionInfo = cartridgeVersions.find(v => v.version === version);

    if (!versionInfo) {
      return {
        compatible: false,
        selectedVersion: version,
        reason: "Version not found in available versions",
        breakingChanges: [],
      };
    }

    // Check if version is deprecated
    if (versionInfo.deprecated) {
      return {
        compatible: true,
        selectedVersion: version,
        reason: "Version is deprecated but still compatible",
        breakingChanges: [],
      };
    }

    return {
      compatible: true,
      selectedVersion: version,
      reason: "Version is compatible",
      breakingChanges: [],
    };
  }

  /**
   * Upgrade to a new version
   *
   * @param cartridgeId - Cartridge identifier
   * @param toVersion - Target version
   * @param downloadUrl - URL to download new version
   * @param options - Upgrade options
   * @returns Upgrade result
   */
  async upgrade(
    cartridgeId: string,
    toVersion: string,
    downloadUrl: string,
    options?: UpgradeOptions
  ): Promise<UpgradeResult> {
    const startTime = Date.now();
    const previousVersion = this.clientVersion;

    try {
      // Backup if requested
      let backupCreated = false;
      if (options?.backup) {
        backupCreated = await this.createBackup(cartridgeId, previousVersion);
      }

      // Download new version
      await this.downloadVersion(downloadUrl, options?.downloadCallback);

      // Perform migration if needed
      let migrated = false;
      if (!options?.skipMigration) {
        migrated = await this.performMigration(
          cartridgeId,
          previousVersion,
          toVersion
        );
      }

      // Update client version
      this.clientVersion = toVersion;

      const duration = Date.now() - startTime;

      return {
        success: true,
        previousVersion,
        newVersion: toVersion,
        backupCreated,
        migrated,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        previousVersion,
        newVersion: previousVersion,
        migrated: false,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get available versions from server
   *
   * @param cartridgeId - Cartridge identifier
   * @param serverUrl - Server URL
   * @returns List of available versions
   */
  async getAvailableVersions(
    cartridgeId: string,
    serverUrl: string
  ): Promise<NegotiationCartridgeVersion[]> {
    try {
      const url = new URL(`/api/cartridges/${cartridgeId}/versions`, serverUrl);
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        versions?: NegotiationCartridgeVersion[];
      };
      return data.versions || [];
    } catch (error) {
      console.error("Failed to fetch available versions:", error);
      return [];
    }
  }

  /**
   * Send negotiation request to server
   *
   * @param serverUrl - Server URL
   * @param request - Negotiation request
   * @param options - Request options
   * @returns Negotiation response
   */
  private async sendRequest(
    serverUrl: string,
    request: VersionNegotiationRequest,
    options?: NegotiationOptions
  ): Promise<VersionNegotiationResponse> {
    const url = new URL("/api/negotiate", serverUrl);
    const timeout = options?.timeout || 5000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as VersionNegotiationResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Fall back to local compatibility check when server is unavailable
   *
   * @param cartridgeId - Cartridge identifier
   * @param supportedVersions - Supported versions
   * @returns Fallback negotiation result
   */
  private fallbackToLocalCheck(
    cartridgeId: string,
    supportedVersions: string[]
  ): NegotiationResult {
    // When server is unavailable, pick the latest supported version
    // and assume compatibility (since we can't verify)
    const latestSupported = this.getLatestSupportedVersion(supportedVersions);

    return {
      selectedVersion: latestSupported,
      compatible: true, // Assume compatible when we can't verify
      breakingChanges: [],
      migrationRequired: false,
      confidence: 0.5, // Lower confidence without server
    };
  }

  /**
   * Get latest version from supported versions list
   *
   * @param supportedVersions - List of supported versions
   * @returns Latest version
   */
  private getLatestSupportedVersion(supportedVersions: string[]): string {
    return (
      supportedVersions
        .map(v => ({ version: v, parsed: this.selector.parseSemVer(v) }))
        .filter(v => v.parsed !== undefined)
        .sort((a, b) => {
          return this.selector["compareVersions"](b.parsed!, a.parsed!);
        })[0]?.version ||
      supportedVersions[0] ||
      "1.0.0"
    );
  }

  /**
   * Calculate confidence score from response
   *
   * @param response - Negotiation response
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(response: VersionNegotiationResponse): number {
    switch (response.reason) {
      case "exact_match":
      case "preferred_version":
        return 1.0;
      case "latest_compatible":
        return 0.9;
      case "compatible_version":
        return 0.7;
      case "upgrade_required":
        return 0.5;
      case "no_compatible_version":
        return 0.0;
      default:
        return 0.5;
    }
  }

  /**
   * Create backup before upgrade
   *
   * @param cartridgeId - Cartridge identifier
   * @param version - Current version
   * @returns True if backup created
   */
  private async createBackup(
    cartridgeId: string,
    version: string
  ): Promise<boolean> {
    // In a real implementation, this would create a backup of the cartridge
    // For now, we just return true
    console.log(`Creating backup of ${cartridgeId}@${version}`);
    return true;
  }

  /**
   * Download new version
   *
   * @param downloadUrl - URL to download from
   * @param callback - Progress callback
   */
  private async downloadVersion(
    downloadUrl: string,
    callback?: (progress: number) => void
  ): Promise<void> {
    // In a real implementation, this would download the cartridge package
    // and report progress via callback
    console.log(`Downloading from ${downloadUrl}`);
    callback?.(0);
    // Simulate download progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      callback?.(i);
    }
    callback?.(100);
  }

  /**
   * Perform migration between versions
   *
   * @param cartridgeId - Cartridge identifier
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns True if migration performed
   */
  private async performMigration(
    cartridgeId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<boolean> {
    // In a real implementation, this would perform data migration
    console.log(`Migrating ${cartridgeId} from ${fromVersion} to ${toVersion}`);
    return true;
  }

  /**
   * Get current client version
   */
  getClientVersion(): string {
    return this.clientVersion;
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.clientId;
  }
}
