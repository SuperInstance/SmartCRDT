/**
 * @lsi/swarm - NegotiationServer Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NegotiationServer } from "./NegotiationServer.js";
import type {
  NegotiationCartridgeVersion,
  VersionNegotiationRequest,
} from "@lsi/protocol";

describe("NegotiationServer", () => {
  let server: NegotiationServer;

  beforeEach(() => {
    server = new NegotiationServer();
  });

  describe("constructor", () => {
    it("should create server with empty registry", () => {
      expect(server.getRegistrySize()).toBe(0);
    });
  });

  describe("registerVersion", () => {
    it("should register a new version", () => {
      const version: NegotiationCartridgeVersion = {
        cartridgeId: "test-cartridge",
        version: "1.0.0",
        protocolVersion: "1.0.0",
        releasedAt: Date.now(),
        deprecated: false,
        breaking: false,
        compatibleWith: ["1.0.0"],
        features: [],
        downloadUrl: "http://example.com/download",
        checksum: "abc123",
        sizeBytes: 1000,
      };

      server.registerVersion(version);
      expect(server.getRegistrySize()).toBe(1);
    });

    it("should throw error when registering duplicate version", () => {
      const version: NegotiationCartridgeVersion = {
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
      };

      server.registerVersion(version);

      expect(() => server.registerVersion(version)).toThrow(
        "already registered"
      );
    });

    it("should register multiple versions for same cartridge", () => {
      const version1: NegotiationCartridgeVersion = {
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
      };

      const version2: NegotiationCartridgeVersion = {
        cartridgeId: "test-cartridge",
        version: "2.0.0",
        protocolVersion: "1.0.0",
        releasedAt: Date.now(),
        deprecated: false,
        breaking: true,
        compatibleWith: ["2.0.0"],
        features: [],
        downloadUrl: "",
        checksum: "def456",
        sizeBytes: 2000,
      };

      server.registerVersion(version1);
      server.registerVersion(version2);

      const versions = server.getVersions("test-cartridge");
      expect(versions).toHaveLength(2);
    });
  });

  describe("getVersions", () => {
    it("should return empty array for unknown cartridge", () => {
      const versions = server.getVersions("unknown-cartridge");
      expect(versions).toEqual([]);
    });

    it("should return all versions for cartridge", () => {
      const version: CartridgeVersion = {
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
      };

      server.registerVersion(version);
      const versions = server.getVersions("test-cartridge");

      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe("1.0.0");
    });
  });

  describe("deprecateVersion", () => {
    it("should mark version as deprecated", () => {
      const version: CartridgeVersion = {
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
      };

      server.registerVersion(version);
      server.deprecateVersion("test-cartridge", "1.0.0");

      const versions = server.getVersions("test-cartridge");
      expect(versions[0].deprecated).toBe(true);
    });

    it("should throw error for unknown cartridge", () => {
      expect(() => server.deprecateVersion("unknown", "1.0.0")).toThrow(
        "No versions found"
      );
    });

    it("should throw error for unknown version", () => {
      const version: CartridgeVersion = {
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
      };

      server.registerVersion(version);

      expect(() => server.deprecateVersion("test-cartridge", "2.0.0")).toThrow(
        "not found"
      );
    });
  });

  describe("getLatestVersion", () => {
    it("should return undefined for unknown cartridge", () => {
      const latest = server.getLatestVersion("unknown");
      expect(latest).toBeUndefined();
    });

    it("should return latest version by release time", () => {
      const now = Date.now();

      const version1: CartridgeVersion = {
        cartridgeId: "test-cartridge",
        version: "1.0.0",
        protocolVersion: "1.0.0",
        releasedAt: now - 10000,
        deprecated: false,
        breaking: false,
        compatibleWith: ["1.0.0"],
        features: [],
        downloadUrl: "",
        checksum: "abc123",
        sizeBytes: 1000,
      };

      const version2: CartridgeVersion = {
        cartridgeId: "test-cartridge",
        version: "2.0.0",
        protocolVersion: "1.0.0",
        releasedAt: now,
        deprecated: false,
        breaking: false,
        compatibleWith: ["2.0.0"],
        features: [],
        downloadUrl: "",
        checksum: "def456",
        sizeBytes: 2000,
      };

      server.registerVersion(version1);
      server.registerVersion(version2);

      const latest = server.getLatestVersion("test-cartridge");
      expect(latest?.version).toBe("2.0.0");
    });
  });

  describe("getActiveVersions", () => {
    it("should filter out deprecated versions", () => {
      const version1: CartridgeVersion = {
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
      };

      const version2: CartridgeVersion = {
        cartridgeId: "test-cartridge",
        version: "2.0.0",
        protocolVersion: "1.0.0",
        releasedAt: Date.now(),
        deprecated: false,
        breaking: false,
        compatibleWith: ["2.0.0"],
        features: [],
        downloadUrl: "",
        checksum: "def456",
        sizeBytes: 2000,
      };

      server.registerVersion(version1);
      server.registerVersion(version2);

      const active = server.getActiveVersions("test-cartridge");
      expect(active).toHaveLength(1);
      expect(active[0].version).toBe("2.0.0");
    });
  });

  describe("negotiate", () => {
    beforeEach(() => {
      // Register test versions
      const versions: NegotiationCartridgeVersion[] = [
        {
          cartridgeId: "test-cartridge",
          version: "1.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 30000,
          deprecated: false,
          breaking: false,
          compatibleWith: ["1.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "abc123",
          sizeBytes: 1000,
        },
        {
          cartridgeId: "test-cartridge",
          version: "1.5.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 20000,
          deprecated: false,
          breaking: false,
          compatibleWith: ["1.0.0", "1.5.0"],
          features: [],
          downloadUrl: "",
          checksum: "def456",
          sizeBytes: 1500,
        },
        {
          cartridgeId: "test-cartridge",
          version: "2.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 10000,
          deprecated: false,
          breaking: true,
          compatibleWith: ["2.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "ghi789",
          sizeBytes: 2000,
        },
      ];

      versions.forEach(v => server.registerVersion(v));
    });

    it("should return exact match when client version is available", async () => {
      const request: VersionNegotiationRequest = {
        clientId: "test-client",
        cartridgeId: "test-cartridge",
        clientVersion: "1.5.0",
        supportedVersions: ["1.0.0", "1.5.0", "2.0.0"],
        capabilities: {
          protocolVersion: "1.0.0",
          features: [],
          constraints: {},
        },
      };

      const response = await server.negotiate(request);

      expect(response.selectedVersion).toBe("1.5.0");
      expect(response.reason).toBe("exact_match");
      expect(response.requiresUpgrade).toBe(false);
    });

    it("should select latest compatible version", async () => {
      const request: VersionNegotiationRequest = {
        clientId: "test-client",
        cartridgeId: "test-cartridge",
        clientVersion: "0.9.0", // Not in registry
        supportedVersions: ["1.0.0", "1.5.0"],
        capabilities: {
          protocolVersion: "1.0.0",
          features: [],
          constraints: {},
        },
      };

      const response = await server.negotiate(request);

      expect(response.selectedVersion).toBe("1.5.0");
      expect(response.reason).toBe("latest_compatible");
    });

    it("should detect breaking changes", async () => {
      const request: VersionNegotiationRequest = {
        clientId: "test-client",
        cartridgeId: "test-cartridge",
        clientVersion: "0.9.0", // Starting from version before all
        supportedVersions: ["1.0.0", "2.0.0"],
        capabilities: {
          protocolVersion: "1.0.0",
          features: [],
          constraints: {},
        },
      };

      const response = await server.negotiate(request);

      // 2.0.0 should be selected (latest compatible)
      // Since we're going from 0.9.0 to 2.0.0, we pass through 1.5.0 which has breaking changes
      expect(response.breakingChanges).not.toHaveLength(0);
      expect(response.migrationRequired).toBe(true);
      expect(response.migrationPath).toBeDefined();
    });

    it("should handle empty registry", async () => {
      const emptyServer = new NegotiationServer();

      const request: VersionNegotiationRequest = {
        clientId: "test-client",
        cartridgeId: "unknown-cartridge",
        clientVersion: "1.0.0",
        supportedVersions: ["1.0.0"],
        capabilities: {
          protocolVersion: "1.0.0",
          features: [],
          constraints: {},
        },
      };

      const response = await emptyServer.negotiate(request);

      expect(response.reason).toBe("no_compatible_version");
      expect(response.selectedVersion).toBe("1.0.0");
    });
  });

  describe("generateMigrationPath", () => {
    beforeEach(() => {
      const versions: NegotiationCartridgeVersion[] = [
        {
          cartridgeId: "test-cartridge",
          version: "1.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 30000,
          deprecated: false,
          breaking: false,
          compatibleWith: ["1.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "abc123",
          sizeBytes: 1000,
        },
        {
          cartridgeId: "test-cartridge",
          version: "1.5.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 20000,
          deprecated: false,
          breaking: true,
          compatibleWith: ["1.5.0"],
          features: [],
          downloadUrl: "",
          checksum: "def456",
          sizeBytes: 1500,
        },
        {
          cartridgeId: "test-cartridge",
          version: "2.0.0",
          protocolVersion: "1.0.0",
          releasedAt: Date.now() - 10000,
          deprecated: false,
          breaking: false,
          compatibleWith: ["2.0.0"],
          features: [],
          downloadUrl: "",
          checksum: "ghi789",
          sizeBytes: 2000,
        },
      ];

      versions.forEach(v => server.registerVersion(v));
    });

    it("should generate migration path with steps", () => {
      const path = server.generateMigrationPath(
        "1.0.0",
        "2.0.0",
        "test-cartridge"
      );

      expect(path.from).toBe("1.0.0");
      expect(path.to).toBe("2.0.0");
      expect(path.steps.length).toBeGreaterThan(0);
    });

    it("should include upgrade step", () => {
      const path = server.generateMigrationPath(
        "1.0.0",
        "2.0.0",
        "test-cartridge"
      );

      const upgradeStep = path.steps.find(s => s.action === "upgrade");
      expect(upgradeStep).toBeDefined();
    });

    it("should include migrate_data step for breaking changes", () => {
      const path = server.generateMigrationPath(
        "1.0.0",
        "2.0.0",
        "test-cartridge"
      );

      const migrateStep = path.steps.find(s => s.action === "migrate_data");
      expect(migrateStep).toBeDefined();
    });

    it("should include reload step", () => {
      const path = server.generateMigrationPath(
        "1.0.0",
        "2.0.0",
        "test-cartridge"
      );

      const reloadStep = path.steps.find(s => s.action === "reload");
      expect(reloadStep).toBeDefined();
    });

    it("should handle invalid versions", () => {
      const path = server.generateMigrationPath(
        "invalid",
        "also-invalid",
        "test-cartridge"
      );

      expect(path.from).toBe("invalid");
      expect(path.to).toBe("also-invalid");
      expect(path.steps).toEqual([]);
    });
  });

  describe("clearRegistry", () => {
    it("should clear all registered versions", () => {
      const version: CartridgeVersion = {
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
      };

      server.registerVersion(version);
      expect(server.getRegistrySize()).toBe(1);

      server.clearRegistry();
      expect(server.getRegistrySize()).toBe(0);
    });
  });
});
