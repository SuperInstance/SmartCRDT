/**
 * Version Negotiation Protocol Tests
 *
 * Tests for version negotiation types, compatibility checking, and selection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  VersionRange,
  ClientCapabilities,
  VersionNegotiationRequest,
  VersionNegotiationResponse,
  SelectionReason,
  BreakingChange,
  MigrationStep,
  MigrationPath,
  NegotiationCartridgeVersion,
  VersionSelection,
  NegotiationCompatibilityResult,
  NegotiationOptions,
  NegotiationResult,
  UpgradeOptions,
  UpgradeResult,
  SemVer,
  NegotiationVersionConstraint,
} from "../version-negotiation.js";

describe("Version Negotiation Protocol", () => {
  describe("VersionRange", () => {
    it("should define version range with min and max", () => {
      const range: VersionRange = {
        min: "1.0.0",
        max: "2.0.0",
        preferred: "1.5.0",
      };

      expect(range.min).toBe("1.0.0");
      expect(range.max).toBe("2.0.0");
      expect(range.preferred).toBe("1.5.0");
    });

    it("should define unbounded version range", () => {
      const range: VersionRange = {
        min: "1.0.0",
        preferred: "latest",
      };

      expect(range.min).toBe("1.0.0");
      expect(range.max).toBeUndefined();
      expect(range.preferred).toBe("latest");
    });
  });

  describe("ClientCapabilities", () => {
    it("should describe client capabilities", () => {
      const capabilities: ClientCapabilities = {
        protocolVersion: "2.1.0",
        features: ["simd", "cache", "privacy"],
        constraints: {
          maxMemory: 1024 * 1024 * 1024, // 1GB
          maxLatency: 1000,
        },
      };

      expect(capabilities.protocolVersion).toBe("2.1.0");
      expect(capabilities.features).toContain("simd");
      expect(capabilities.constraints.maxMemory).toBe(1024 * 1024 * 1024);
    });

    it("should support empty capabilities", () => {
      const capabilities: ClientCapabilities = {
        protocolVersion: "1.0.0",
        features: [],
        constraints: {},
      };

      expect(capabilities.features).toHaveLength(0);
      expect(Object.keys(capabilities.constraints)).toHaveLength(0);
    });
  });

  describe("VersionNegotiationRequest", () => {
    it("should create negotiation request", () => {
      const request: VersionNegotiationRequest = {
        clientId: "client-123",
        cartridgeId: "medical-knowledge",
        clientVersion: "1.0.0",
        supportedVersions: ["1.0.0", "1.1.0", "2.0.0"],
        capabilities: {
          protocolVersion: "2.0.0",
          features: ["embeddings"],
          constraints: {},
        },
      };

      expect(request.clientId).toBe("client-123");
      expect(request.cartridgeId).toBe("medical-knowledge");
      expect(request.supportedVersions).toHaveLength(3);
    });

    it("should support single version client", () => {
      const request: VersionNegotiationRequest = {
        clientId: "client-456",
        cartridgeId: "legal-knowledge",
        clientVersion: "2.0.0",
        supportedVersions: ["2.0.0"],
        capabilities: {
          protocolVersion: "2.0.0",
          features: [],
          constraints: {},
        },
      };

      expect(request.supportedVersions).toHaveLength(1);
      expect(request.supportedVersions[0]).toBe("2.0.0");
    });
  });

  describe("VersionNegotiationResponse", () => {
    it("should return exact match", () => {
      const response: VersionNegotiationResponse = {
        selectedVersion: "1.0.0",
        reason: "exact_match",
        requiresUpgrade: false,
        breakingChanges: [],
        migrationRequired: false,
      };

      expect(response.reason).toBe("exact_match");
      expect(response.requiresUpgrade).toBe(false);
      expect(response.breakingChanges).toHaveLength(0);
    });

    it("should return compatible version", () => {
      const response: VersionNegotiationResponse = {
        selectedVersion: "1.5.0",
        reason: "compatible_version",
        requiresUpgrade: true,
        breakingChanges: [],
        migrationRequired: false,
      };

      expect(response.reason).toBe("compatible_version");
      expect(response.requiresUpgrade).toBe(true);
    });

    it("should include breaking changes", () => {
      const response: VersionNegotiationResponse = {
        selectedVersion: "2.0.0",
        reason: "upgrade_required",
        requiresUpgrade: true,
        breakingChanges: [
          {
            version: "2.0.0",
            description: "API signature changed for query() method",
            impact: "high",
            mitigations: [
              "Update all query() calls to use new parameter format",
              "Run migration script to transform stored queries",
            ],
          },
        ],
        migrationRequired: true,
        migrationPath: {
          from: "1.0.0",
          to: "2.0.0",
          steps: [
            {
              version: "2.0.0",
              action: "upgrade",
              description: "Upgrade to version 2.0.0",
              estimatedTimeMs: 5000,
            },
          ],
        },
      };

      expect(response.breakingChanges).toHaveLength(1);
      expect(response.breakingChanges[0].impact).toBe("high");
      expect(response.migrationRequired).toBe(true);
      expect(response.migrationPath).toBeDefined();
    });

    it("should indicate no compatible version", () => {
      const response: VersionNegotiationResponse = {
        selectedVersion: "",
        reason: "no_compatible_version",
        requiresUpgrade: false,
        breakingChanges: [],
        migrationRequired: false,
      };

      expect(response.reason).toBe("no_compatible_version");
      expect(response.selectedVersion).toBe("");
    });

    it("should validate all selection reasons", () => {
      const reasons: SelectionReason[] = [
        "exact_match",
        "compatible_version",
        "preferred_version",
        "latest_compatible",
        "upgrade_required",
        "no_compatible_version",
      ];

      reasons.forEach(reason => {
        const response: VersionNegotiationResponse = {
          selectedVersion: "1.0.0",
          reason,
          requiresUpgrade: false,
          breakingChanges: [],
          migrationRequired: false,
        };

        expect(response.reason).toBe(reason);
      });
    });
  });

  describe("BreakingChange", () => {
    it("should describe breaking change details", () => {
      const breakingChange: BreakingChange = {
        version: "3.0.0",
        description: "Removed deprecated API endpoints",
        impact: "medium",
        mitigations: ["Use new API endpoints", "Update integration code"],
      };

      expect(breakingChange.version).toBe("3.0.0");
      expect(breakingChange.impact).toBe("medium");
      expect(breakingChange.mitigations).toHaveLength(2);
    });

    it("should assess impact levels", () => {
      const impacts: Array<BreakingChange["impact"]> = [
        "low",
        "medium",
        "high",
      ];

      impacts.forEach(impact => {
        const change: BreakingChange = {
          version: "1.0.0",
          description: `Change with ${impact} impact`,
          impact,
          mitigations: [],
        };

        expect(change.impact).toBe(impact);
      });
    });
  });

  describe("MigrationPath", () => {
    it("should define migration steps", () => {
      const path: MigrationPath = {
        from: "1.0.0",
        to: "3.0.0",
        steps: [
          {
            version: "2.0.0",
            action: "upgrade",
            description: "Upgrade to version 2.0.0",
            estimatedTimeMs: 10000,
          },
          {
            version: "2.0.0",
            action: "migrate_data",
            description: "Migrate data to new format",
            estimatedTimeMs: 30000,
          },
          {
            version: "3.0.0",
            action: "upgrade",
            description: "Upgrade to version 3.0.0",
            estimatedTimeMs: 15000,
          },
        ],
      };

      expect(path.from).toBe("1.0.0");
      expect(path.to).toBe("3.0.0");
      expect(path.steps).toHaveLength(3);
      expect(path.steps[1].action).toBe("migrate_data");
    });

    it("should support all migration actions", () => {
      const actions: Array<MigrationStep["action"]> = [
        "upgrade",
        "migrate_data",
        "reindex",
        "reload",
      ];

      actions.forEach(action => {
        const step: MigrationStep = {
          version: "2.0.0",
          action,
          description: `Perform ${action}`,
          estimatedTimeMs: 5000,
        };

        expect(step.action).toBe(action);
      });
    });
  });

  describe("NegotiationCartridgeVersion", () => {
    it("should describe cartridge version metadata", () => {
      const version: NegotiationCartridgeVersion = {
        cartridgeId: "medical-knowledge",
        version: "2.1.0",
        protocolVersion: "2.0.0",
        releasedAt: Date.now(),
        deprecated: false,
        breaking: false,
        compatibleWith: ["2.0.0", "2.1.0"],
        features: ["embeddings", "semantic-search"],
        downloadUrl:
          "https://registry.aequor.io/cartridges/medical-knowledge-2.1.0.tgz",
        checksum: "sha256:abc123...",
        sizeBytes: 1024 * 1024 * 50, // 50MB
      };

      expect(version.cartridgeId).toBe("medical-knowledge");
      expect(version.deprecated).toBe(false);
      expect(version.breaking).toBe(false);
      expect(version.compatibleWith).toContain("2.0.0");
      expect(version.sizeBytes).toBe(50 * 1024 * 1024);
    });

    it("should mark deprecated versions", () => {
      const version: NegotiationCartridgeVersion = {
        cartridgeId: "old-cartridge",
        version: "1.0.0",
        protocolVersion: "1.0.0",
        releasedAt: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        deprecated: true,
        breaking: false,
        compatibleWith: ["1.0.0"],
        features: [],
        downloadUrl: "https://registry.aequor.io/cartridges/old-1.0.0.tgz",
        checksum: "sha256:def456...",
        sizeBytes: 1024 * 1024 * 10,
      };

      expect(version.deprecated).toBe(true);
    });
  });

  describe("VersionSelection", () => {
    it("should represent version selection", () => {
      const selection: VersionSelection = {
        version: "2.0.0",
        reason: "latest_compatible",
        confidence: 0.95,
        requiresUpgrade: true,
      };

      expect(selection.version).toBe("2.0.0");
      expect(selection.reason).toBe("latest_compatible");
      expect(selection.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("NegotiationCompatibilityResult", () => {
    it("should indicate compatible result", () => {
      const result: NegotiationCompatibilityResult = {
        compatible: true,
        selectedVersion: "1.5.0",
        reason: "Version 1.5.0 is compatible with client constraints",
        breakingChanges: [],
      };

      expect(result.compatible).toBe(true);
      expect(result.selectedVersion).toBe("1.5.0");
      expect(result.breakingChanges).toHaveLength(0);
    });

    it("should list required dependencies", () => {
      const result: NegotiationCompatibilityResult = {
        compatible: true,
        selectedVersion: "2.0.0",
        reason: "Compatible with additional dependencies",
        requires: ["@lsi/core@2.0.0", "@lsi/protocol@1.5.0"],
        conflicts: [],
        warnings: ["Dependency @lsi/old is deprecated"],
      };

      expect(result.requires).toHaveLength(2);
      expect(result.requires).toContain("@lsi/core@2.0.0");
      expect(result.warnings).toHaveLength(1);
    });

    it("should detect conflicts", () => {
      const result: NegotiationCompatibilityResult = {
        compatible: false,
        selectedVersion: "",
        reason: "Conflicts with installed cartridge",
        requires: [],
        conflicts: ["legal-knowledge@1.0.0"],
        breakingChanges: [],
        warnings: [],
      };

      expect(result.compatible).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("NegotiationOptions", () => {
    it("should configure negotiation options", () => {
      const options: NegotiationOptions = {
        preferredVersion: "2.0.0",
        allowDeprecated: false,
        timeout: 5000,
        headers: {
          "User-Agent": "Aequor/2.0.0",
          Accept: "application/json",
        },
      };

      expect(options.preferredVersion).toBe("2.0.0");
      expect(options.allowDeprecated).toBe(false);
      expect(options.timeout).toBe(5000);
      expect(options.headers["User-Agent"]).toBeDefined();
    });
  });

  describe("NegotiationResult", () => {
    it("should represent successful negotiation", () => {
      const result: NegotiationResult = {
        selectedVersion: "2.1.0",
        compatible: true,
        breakingChanges: [],
        migrationRequired: false,
        confidence: 0.98,
      };

      expect(result.compatible).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it("should require migration", () => {
      const result: NegotiationResult = {
        selectedVersion: "3.0.0",
        compatible: true,
        breakingChanges: [
          {
            version: "3.0.0",
            description: "API change",
            impact: "medium",
            mitigations: ["Update code"],
          },
        ],
        migrationRequired: true,
        confidence: 0.85,
        migrationPath: {
          from: "2.0.0",
          to: "3.0.0",
          steps: [
            {
              version: "3.0.0",
              action: "upgrade",
              description: "Upgrade",
              estimatedTimeMs: 10000,
            },
          ],
        },
      };

      expect(result.migrationRequired).toBe(true);
      expect(result.migrationPath).toBeDefined();
    });
  });

  describe("UpgradeOptions", () => {
    it("should configure upgrade options", () => {
      const options: UpgradeOptions = {
        backup: true,
        force: false,
        downloadCallback: progress => {
          console.log(`Download progress: ${progress}%`);
        },
        skipMigration: false,
      };

      expect(options.backup).toBe(true);
      expect(options.force).toBe(false);
      expect(options.downloadCallback).toBeDefined();
    });
  });

  describe("UpgradeResult", () => {
    it("should represent successful upgrade", () => {
      const result: UpgradeResult = {
        success: true,
        previousVersion: "1.0.0",
        newVersion: "2.0.0",
        backupCreated: true,
        migrated: true,
        durationMs: 15000,
      };

      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(result.migrated).toBe(true);
    });

    it("should represent failed upgrade", () => {
      const result: UpgradeResult = {
        success: false,
        previousVersion: "2.0.0",
        newVersion: "3.0.0",
        migrated: false,
        durationMs: 5000,
        error: "Insufficient disk space",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("SemVer", () => {
    it("should parse semantic version", () => {
      const semver: SemVer = {
        major: 2,
        minor: 1,
        patch: 0,
        prerelease: "beta.1",
        build: "20240101",
      };

      expect(semver.major).toBe(2);
      expect(semver.minor).toBe(1);
      expect(semver.patch).toBe(0);
      expect(semver.prerelease).toBe("beta.1");
      expect(semver.build).toBe("20240101");
    });

    it("should handle stable versions", () => {
      const semver: SemVer = {
        major: 1,
        minor: 0,
        patch: 0,
      };

      expect(semver.prerelease).toBeUndefined();
      expect(semver.build).toBeUndefined();
    });
  });

  describe("NegotiationVersionConstraint", () => {
    it("should define version constraints", () => {
      const constraint: NegotiationVersionConstraint = {
        cartridgeId: "medical-knowledge",
        constraint: "^2.0.0",
        required: true,
      };

      expect(constraint.cartridgeId).toBe("medical-knowledge");
      expect(constraint.constraint).toBe("^2.0.0");
      expect(constraint.required).toBe(true);
    });

    it("should support optional dependencies", () => {
      const constraint: NegotiationVersionConstraint = {
        cartridgeId: "optional-cartridge",
        constraint: "~1.5.0",
        required: false,
      };

      expect(constraint.required).toBe(false);
    });
  });

  describe("Version Compatibility Matrix", () => {
    it("should check compatibility across versions", () => {
      const clientVersions = ["1.0.0", "1.1.0", "2.0.0"];
      const serverVersions = ["1.0.0", "1.1.0", "2.0.0", "2.1.0"];

      // Simulate compatibility checks
      clientVersions.forEach(clientVer => {
        const compatible = serverVersions.filter(serverVer => {
          // Simple compatibility logic: major version must match
          const clientMajor = clientVer.split(".")[0];
          const serverMajor = serverVer.split(".")[0];
          return clientMajor === serverMajor;
        });

        expect(compatible.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize negotiation request", () => {
      const original: VersionNegotiationRequest = {
        clientId: "client-serialize",
        cartridgeId: "test-cartridge",
        clientVersion: "1.0.0",
        supportedVersions: ["1.0.0", "1.1.0", "2.0.0"],
        capabilities: {
          protocolVersion: "2.0.0",
          features: ["test", "feature"],
          constraints: {
            maxMemory: 1024,
          },
        },
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as VersionNegotiationRequest;

      expect(deserialized.clientId).toBe(original.clientId);
      expect(deserialized.supportedVersions).toEqual(
        original.supportedVersions
      );
      expect(deserialized.capabilities.features).toEqual(
        original.capabilities.features
      );
    });
  });
});
