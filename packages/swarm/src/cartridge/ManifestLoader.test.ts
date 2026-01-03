/**
 * Unit tests for ManifestLoader
 *
 * Tests cover:
 * - Schema validation
 * - Loading manifests from files
 * - Checksum verification
 * - Signature verification
 * - Manifest creation from directories
 * - Manifest writing
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { ManifestLoader, type ManifestLoadResult } from "./ManifestLoader.js";
import type { CartridgeManifest } from "@lsi/protocol";
import { CARTRIDGE_MANIFEST_SCHEMA } from "@lsi/protocol";

describe("ManifestLoader", () => {
  let loader: ManifestLoader;
  let tempDir: string;
  let cartridgeDir: string;
  let manifestPath: string;

  // Valid manifest fixture
  const validManifest: CartridgeManifest = {
    id: "@lsi/test-cartridge",
    version: "1.0.0",
    name: "Test Cartridge",
    description: "A test cartridge for unit testing",
    author: "Test Author",
    license: "MIT",
    dependencies: [],
    conflicts: [],
    capabilities: {
      domains: ["test", "testing"],
      queryTypes: ["QUESTION", "CONVERSATION"],
      embeddingModel: "text-embedding-3-small",
      sizeBytes: 1024000,
      loadTimeMs: 1000,
      privacyLevel: "public",
    },
    metadata: {
      test: true,
    },
    checksum: "a".repeat(64),
    files: [],
  };

  beforeEach(async () => {
    loader = new ManifestLoader();
    // Set schema for validation
    loader.setSchema(CARTRIDGE_MANIFEST_SCHEMA);

    // Create temporary directory
    tempDir = join(tmpdir(), `manifest-loader-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    cartridgeDir = join(tempDir, "cartridge");
    await mkdir(cartridgeDir, { recursive: true });

    manifestPath = join(cartridgeDir, "cartridge.json");
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Schema Validation", () => {
    it("should validate a correct manifest", async () => {
      const result = await loader.validate(validManifest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.manifest).toEqual(validManifest);
    });

    it("should reject manifest with missing required fields", async () => {
      const invalidManifest = {
        id: "@lsi/test",
        // Missing version, name, description, capabilities, checksum
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject manifest with invalid ID format", async () => {
      const invalidManifest = {
        ...validManifest,
        id: "Invalid-ID_Format",
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("id"))).toBe(true);
    });

    it("should reject manifest with invalid version format", async () => {
      const invalidManifest = {
        ...validManifest,
        version: "1.0", // Missing patch version
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("version"))).toBe(true);
    });

    it("should accept semantic version with pre-release", async () => {
      const validPrerelease = {
        ...validManifest,
        version: "1.0.0-beta.1",
      };

      const result = await loader.validate(validPrerelease);

      expect(result.isValid).toBe(true);
    });

    it("should reject manifest with invalid privacy level", async () => {
      const invalidManifest = {
        ...validManifest,
        capabilities: {
          ...validManifest.capabilities,
          privacyLevel: "invalid" as any,
        },
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
    });

    it("should reject manifest with invalid query type", async () => {
      const invalidManifest = {
        ...validManifest,
        capabilities: {
          ...validManifest.capabilities,
          queryTypes: ["INVALID_TYPE" as any],
        },
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
    });

    it("should reject manifest with negative size", async () => {
      const invalidManifest = {
        ...validManifest,
        capabilities: {
          ...validManifest.capabilities,
          sizeBytes: -100,
        },
      };

      const result = await loader.validate(invalidManifest);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("sizeBytes"))).toBe(true);
    });

    it("should warn about missing optional fields", async () => {
      const minimalManifest = {
        ...validManifest,
        author: undefined,
        license: undefined,
      };

      const result = await loader.validate(minimalManifest);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes("author"))).toBe(true);
    });
  });

  describe("Loading Manifests", () => {
    it("should load manifest from file", async () => {
      await writeFile(manifestPath, JSON.stringify(validManifest, null, 2));

      const result = await loader.load(manifestPath);

      expect(result.isValid).toBe(true);
      expect(result.manifest).toEqual(validManifest);
    });

    it("should return error for non-existent file", async () => {
      const result = await loader.load("/non/existent/path.json");

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error for invalid JSON", async () => {
      await writeFile(manifestPath, "invalid json {");

      const result = await loader.load(manifestPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate manifest when loading", async () => {
      const invalidManifest = { ...validManifest, version: "invalid" };
      await writeFile(manifestPath, JSON.stringify(invalidManifest, null, 2));

      const result = await loader.load(manifestPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Checksum Verification", () => {
    it("should verify matching checksums", async () => {
      // Create test files
      const dataDir = join(cartridgeDir, "data");
      await mkdir(dataDir, { recursive: true });

      const file1Path = join(dataDir, "test1.txt");
      const file2Path = join(dataDir, "test2.txt");

      await writeFile(file1Path, "test content 1");
      await writeFile(file2Path, "test content 2");

      // Calculate checksums
      const crypto = await import("crypto");
      const checksum1 = crypto
        .createHash("sha256")
        .update("test content 1")
        .digest("hex");
      const checksum2 = crypto
        .createHash("sha256")
        .update("test content 2")
        .digest("hex");

      const manifestWithFiles: CartridgeManifest = {
        ...validManifest,
        files: [
          {
            path: "data/test1.txt",
            checksum: checksum1,
            size: 14,
          },
          {
            path: "data/test2.txt",
            checksum: checksum2,
            size: 14,
          },
        ],
      };

      const result = await loader.verifyChecksums(
        manifestWithFiles,
        cartridgeDir
      );

      expect(result).toBe(true);
    });

    it("should detect mismatched checksums", async () => {
      const dataDir = join(cartridgeDir, "data");
      await mkdir(dataDir, { recursive: true });

      const file1Path = join(dataDir, "test1.txt");
      await writeFile(file1Path, "test content 1");

      const manifestWithBadChecksum: CartridgeManifest = {
        ...validManifest,
        files: [
          {
            path: "data/test1.txt",
            checksum: "b".repeat(64), // Wrong checksum
            size: 13,
          },
        ],
      };

      const result = await loader.verifyChecksums(
        manifestWithBadChecksum,
        cartridgeDir
      );

      expect(result).toBe(false);
    });

    it("should detect missing files", async () => {
      const manifestWithMissingFile: CartridgeManifest = {
        ...validManifest,
        files: [
          {
            path: "data/nonexistent.txt",
            checksum: "a".repeat(64),
            size: 100,
          },
        ],
      };

      const result = await loader.verifyChecksums(
        manifestWithMissingFile,
        cartridgeDir
      );

      expect(result).toBe(false);
    });

    it("should handle empty file list", async () => {
      const manifestWithoutFiles: CartridgeManifest = {
        ...validManifest,
        files: [],
      };

      const result = await loader.verifyChecksums(
        manifestWithoutFiles,
        cartridgeDir
      );

      expect(result).toBe(true);
    });
  });

  describe("Signature Verification", () => {
    it("should return false for unsigned manifest", async () => {
      const unsignedManifest = { ...validManifest };

      const result = await loader.verifySignature(unsignedManifest);

      expect(result).toBe(false);
    });

    it("should validate signature format", async () => {
      const signedManifest = {
        ...validManifest,
        signature: "a1b2c3d4e5f6",
      };

      const result = await loader.verifySignature(signedManifest);

      expect(result).toBe(true);
    });

    it("should reject invalid signature format", async () => {
      const invalidSignatureManifest = {
        ...validManifest,
        signature: "not-hex!!!",
      };

      const result = await loader.verifySignature(invalidSignatureManifest);

      expect(result).toBe(false);
    });
  });

  describe("Manifest Creation", () => {
    it("should create manifest from directory", async () => {
      // Create test files
      await writeFile(join(cartridgeDir, "file1.txt"), "content 1");
      await writeFile(join(cartridgeDir, "file2.txt"), "content 2");

      const dataDir = join(cartridgeDir, "data");
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, "file3.txt"), "content 3");

      const manifest = await loader.create(
        cartridgeDir,
        "@lsi/test-cartridge",
        "1.0.0",
        "Test Cartridge",
        "A test cartridge",
        {
          author: "Test Author",
          license: "MIT",
          domains: ["test"],
        }
      );

      expect(manifest.id).toBe("@lsi/test-cartridge");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.name).toBe("Test Cartridge");
      expect(manifest.files.length).toBe(3);
      expect(manifest.capabilities.sizeBytes).toBeGreaterThan(0);
      expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should respect ignore patterns when creating manifest", async () => {
      // Create files that should be ignored
      const nodeModulesDir = join(cartridgeDir, "node_modules");
      await mkdir(nodeModulesDir, { recursive: true });
      await writeFile(join(nodeModulesDir, "package.json"), "{}");

      const hiddenDir = join(cartridgeDir, ".hidden");
      await mkdir(hiddenDir, { recursive: true });
      await writeFile(join(hiddenDir, "secret.txt"), "secret");

      // Create files that should be included
      await writeFile(join(cartridgeDir, "include.txt"), "include this");

      const manifest = await loader.create(
        cartridgeDir,
        "@lsi/test-cartridge",
        "1.0.0",
        "Test Cartridge",
        "A test cartridge"
      );

      // Should not include node_modules or hidden files
      expect(manifest.files.length).toBe(1);
      expect(manifest.files[0].path).toBe("include.txt");
    });

    it("should calculate correct checksums for files", async () => {
      await writeFile(join(cartridgeDir, "test.txt"), "test content");

      const manifest = await loader.create(
        cartridgeDir,
        "@lsi/test-cartridge",
        "1.0.0",
        "Test Cartridge",
        "A test cartridge"
      );

      expect(manifest.files.length).toBe(1);
      expect(manifest.files[0].checksum).toHaveLength(64);
      expect(manifest.files[0].size).toBe(12); // 'test content' length
    });
  });

  describe("Manifest Writing", () => {
    it("should write manifest to file", async () => {
      const outputPath = join(tempDir, "output.json");

      await loader.write(validManifest, outputPath);

      // Read back and verify
      const fs = await import("fs/promises");
      const content = await fs.readFile(outputPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(validManifest);
    });

    it("should write formatted JSON", async () => {
      const outputPath = join(tempDir, "output.json");

      await loader.write(validManifest, outputPath);

      const fs = await import("fs/promises");
      const content = await fs.readFile(outputPath, "utf-8");

      // Check that it's formatted (contains newlines and indentation)
      expect(content).toContain("\n");
      expect(content).toContain("  ");
    });
  });

  describe("Directory Validation", () => {
    it("should validate existing directory with manifest", async () => {
      await writeFile(manifestPath, JSON.stringify(validManifest));

      const result = await loader.validateDirectory(cartridgeDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for non-existent directory", async () => {
      const result = await loader.validateDirectory("/non/existent/path");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should fail validation for missing manifest file", async () => {
      const result = await loader.validateDirectory(cartridgeDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("cartridge.json"))).toBe(true);
    });

    it("should warn about missing optional directories", async () => {
      await writeFile(manifestPath, JSON.stringify(validManifest));

      const result = await loader.validateDirectory(cartridgeDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("data"))).toBe(true);
    });
  });

  describe("fromDirectory Convenience Method", () => {
    it("should load manifest from directory", async () => {
      await writeFile(manifestPath, JSON.stringify(validManifest, null, 2));

      const result = await loader.fromDirectory(cartridgeDir);

      expect(result.isValid).toBe(true);
      expect(result.manifest).toEqual(validManifest);
    });

    it("should validate checksums when requested", async () => {
      // Create a test file
      const dataDir = join(cartridgeDir, "data");
      await mkdir(dataDir, { recursive: true });
      const testFile = join(dataDir, "test.txt");
      await writeFile(testFile, "test");

      const crypto = await import("crypto");
      const checksum = crypto.createHash("sha256").update("test").digest("hex");

      const manifestWithFiles: CartridgeManifest = {
        ...validManifest,
        files: [
          {
            path: "data/test.txt",
            checksum,
            size: 4,
          },
        ],
      };

      await writeFile(manifestPath, JSON.stringify(manifestWithFiles, null, 2));

      const result = await loader.fromDirectory(cartridgeDir, {
        validateChecksum: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.checksumValid).toBe(true);
    });
  });

  describe("Schema Loading", () => {
    it("should load schema from file", async () => {
      const schemaPath = join(tempDir, "schema.json");
      const schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        required: [
          "id",
          "version",
          "name",
          "description",
          "capabilities",
          "checksum",
        ],
        properties: {
          id: { type: "string" },
          version: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          capabilities: {
            type: "object",
            required: ["domains", "queryTypes", "sizeBytes"],
            properties: {
              domains: { type: "array" },
              queryTypes: { type: "array" },
              sizeBytes: { type: "number" },
            },
          },
          checksum: { type: "string" },
        },
      };

      await writeFile(schemaPath, JSON.stringify(schema));

      const loaderWithSchema = new ManifestLoader(schemaPath);

      const result = await loaderWithSchema.validate({
        id: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test description",
        capabilities: {
          domains: ["test"],
          queryTypes: ["QUESTION"],
          sizeBytes: 1000,
        },
        checksum: "a".repeat(64),
      });

      expect(result.isValid).toBe(true);
    });

    it("should set schema directly", async () => {
      const newLoader = new ManifestLoader();
      const schema = {
        type: "object",
        required: [
          "id",
          "version",
          "name",
          "description",
          "capabilities",
          "checksum",
        ],
        properties: {
          id: { type: "string" },
          version: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          capabilities: {
            type: "object",
            required: ["domains", "queryTypes", "sizeBytes"],
            properties: {
              domains: { type: "array" },
              queryTypes: { type: "array" },
              sizeBytes: { type: "number" },
            },
          },
          checksum: { type: "string" },
        },
      };

      newLoader.setSchema(schema);

      const result = await newLoader.validate({
        id: "test-id",
        version: "1.0.0",
        name: "Test",
        description: "Test description",
        capabilities: {
          domains: ["test"],
          queryTypes: ["QUESTION"],
          sizeBytes: 100,
        },
        checksum: "a".repeat(64),
      });

      // Should not throw and should be valid
      expect(result.isValid).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle manifest with no files", async () => {
      const manifestNoFiles: CartridgeManifest = {
        ...validManifest,
        files: [],
      };

      const result = await loader.validate(manifestNoFiles);

      expect(result.isValid).toBe(true);
    });

    it("should handle large manifest", async () => {
      const largeManifest: CartridgeManifest = {
        ...validManifest,
        files: Array.from({ length: 1000 }, (_, i) => ({
          path: `file${i}.txt`,
          checksum: "a".repeat(64),
          size: 100,
        })),
      };

      const result = await loader.validate(largeManifest);

      expect(result.isValid).toBe(true);
    });

    it("should handle special characters in metadata", async () => {
      const manifestWithSpecialChars: CartridgeManifest = {
        ...validManifest,
        metadata: {
          "test-key": "test-value with spaces",
          unicode: "你好世界",
          emoji: "🎉",
        },
      };

      const result = await loader.validate(manifestWithSpecialChars);

      expect(result.isValid).toBe(true);
    });
  });
});
