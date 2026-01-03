/**
 * @lsi/swarm - NegotiationClient Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NegotiationClient } from "./NegotiationClient.js";
import type { NegotiationCartridgeVersion } from "@lsi/protocol";

describe("NegotiationClient", () => {
  let client: NegotiationClient;

  beforeEach(() => {
    client = new NegotiationClient("test-client", "1.0.0");
  });

  describe("constructor", () => {
    it("should create client with correct ID and version", () => {
      expect(client.getClientId()).toBe("test-client");
      expect(client.getClientVersion()).toBe("1.0.0");
    });
  });

  describe("checkLocalCompatibility", () => {
    it("should return compatible for valid version without available versions", async () => {
      const result = await client.checkLocalCompatibility(
        "test-cartridge",
        "1.2.3"
      );

      expect(result.compatible).toBe(true);
      expect(result.selectedVersion).toBe("1.2.3");
      expect(result.breakingChanges).toEqual([]);
    });

    it("should return incompatible for invalid version format", async () => {
      const result = await client.checkLocalCompatibility(
        "test-cartridge",
        "invalid"
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain("Invalid version format");
    });

    it("should detect deprecated versions", async () => {
      const availableVersions: NegotiationCartridgeVersion[] = [
        {
          cartridgeId: "test-cartridge",
          version: "1.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now(),
          deprecated: true,
          breaking: false,
          compatibleWith: ["1.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "abc123",
          sizeBytes: 1000,
        },
      ];

      const result = await client.checkLocalCompatibility(
        "test-cartridge",
        "1.0.0",
        availableVersions
      );

      expect(result.compatible).toBe(true);
      expect(result.reason).toContain("deprecated");
    });

    it("should return incompatible for version not in available list", async () => {
      const availableVersions: NegotiationCartridgeVersion[] = [
        {
          cartridgeId: "test-cartridge",
          version: "2.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now(),
          deprecated: false,
          breaking: false,
          compatibleWith: ["2.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "abc123",
          sizeBytes: 1000,
        },
      ];

      const result = await client.checkLocalCompatibility(
        "test-cartridge",
        "1.0.0",
        availableVersions
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain("not found");
    });
  });

  describe("upgrade", () => {
    it("should perform successful upgrade", async () => {
      const result = await client.upgrade(
        "test-cartridge",
        "2.0.0",
        "http://example.com/download",
        {
          backup: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe("1.0.0");
      expect(result.newVersion).toBe("2.0.0");
      expect(result.backupCreated).toBe(true);
      expect(result.migrated).toBe(true);
    });

    it("should perform upgrade without backup", async () => {
      const result = await client.upgrade(
        "test-cartridge",
        "2.0.0",
        "http://example.com/download",
        {
          backup: false,
        }
      );

      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(false);
    });

    it("should skip migration when requested", async () => {
      const result = await client.upgrade(
        "test-cartridge",
        "2.0.0",
        "http://example.com/download",
        {
          skipMigration: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(false);
    });

    it("should call download callback with progress", async () => {
      const callback = vi.fn();
      await client.upgrade(
        "test-cartridge",
        "2.0.0",
        "http://example.com/download",
        {
          downloadCallback: callback,
        }
      );

      expect(callback).toHaveBeenCalled();
      // Check that progress values were reported (0 to 100)
      const progressValues = callback.mock.calls.map(call => call[0]);
      expect(progressValues).toContain(0);
      expect(progressValues).toContain(100);
    });
  });

  describe("getAvailableVersions", () => {
    it("should return empty array on fetch error", async () => {
      // Mock fetch to reject
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("Network error")))
      );

      const result = await client.getAvailableVersions(
        "test-cartridge",
        "http://invalid-url"
      );

      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it("should return versions from server", async () => {
      // Mock fetch to return versions
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                versions: [
                  {
                    cartridgeId: "test-cartridge",
                    version: "1.0.0",
                    protocolVersion: "1.0.0",
                    releasedAt: Date.now(),
                    deprecated: false,
                    breaking: false,
                    compatibleWith: ["1.0.0"],
                    features: [],
                    downloadUrl: "",
                    checksum: "abc123",
                    sizeBytes: 1000,
                  },
                ],
              }),
          } as Response)
        )
      );

      const result = await client.getAvailableVersions(
        "test-cartridge",
        "http://example.com"
      );

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe("1.0.0");

      vi.unstubAllGlobals();
    });
  });

  describe("negotiate", () => {
    it("should handle server error gracefully", async () => {
      // Mock fetch to fail
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("Network error")))
      );

      const result = await client.negotiate(
        "test-cartridge",
        "http://invalid-url",
        ["1.0.0", "2.0.0"]
      );

      // Should fall back to local check
      expect(result.compatible).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);

      vi.unstubAllGlobals();
    });

    it("should negotiate with server successfully", async () => {
      // Mock fetch to return successful negotiation
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                selectedVersion: "1.5.0",
                reason: "latest_compatible",
                requiresUpgrade: false,
                breakingChanges: [],
                migrationRequired: false,
              }),
          } as Response)
        )
      );

      const result = await client.negotiate(
        "test-cartridge",
        "http://example.com",
        ["1.0.0", "1.5.0"]
      );

      expect(result.selectedVersion).toBe("1.5.0");
      expect(result.compatible).toBe(true);
      expect(result.breakingChanges).toEqual([]);

      vi.unstubAllGlobals();
    });

    it("should handle timeout", async () => {
      // Mock fetch to timeout
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 200)
            )
        )
      );

      const result = await client.negotiate(
        "test-cartridge",
        "http://example.com",
        ["1.0.0"],
        { timeout: 100 }
      );

      // Should fall back to local check
      expect(result.confidence).toBeLessThan(1.0);

      vi.unstubAllGlobals();
    });
  });
});
