/**
 * ManifestLoader - Cartridge manifest loader and validator
 *
 * This module provides functionality to:
 * - Load cartridge manifests from JSON files
 * - Validate manifests against JSON Schema
 * - Verify file checksums
 * - Verify cryptographic signatures
 * - Create manifests from cartridge directories
 * - Write manifests to files
 *
 * Design Principles:
 * - Strict validation for security
 * - Clear error messages for debugging
 * - Graceful handling of optional features (signatures)
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "fs";
import { readFile, writeFile } from "fs/promises";
import { join, relative } from "path";
import { createHash } from "crypto";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { CartridgeManifest, CartridgeCapabilities } from "@lsi/protocol";

type ValidateFunction = ReturnType<typeof Ajv.prototype["compile"]>;

/**
 * Options for loading manifests
 */
export interface ManifestLoadOptions {
  /** Verify file checksums against manifest */
  validateChecksum?: boolean;

  /** Verify cryptographic signature */
  validateSignature?: boolean;

  /** Allow cartridges without signatures */
  allowUnsigned?: boolean;

  /** Base path for resolving relative file paths */
  basePath?: string;
}

/**
 * Result of loading a manifest
 */
export interface ManifestLoadResult {
  /** The loaded and validated manifest */
  manifest: CartridgeManifest;

  /** Whether the manifest is valid */
  isValid: boolean;

  /** Validation errors (empty if valid) */
  errors: string[];

  /** Validation warnings (non-blocking) */
  warnings: string[];

  /** Whether checksums are valid (if validated) */
  checksumValid?: boolean;

  /** Whether signature is valid (if validated) */
  signatureValid?: boolean;
}

/**
 * Options for creating manifests
 */
export interface CreateManifestOptions {
  /** Author name or organization */
  author?: string;

  /** License identifier */
  license?: string;

  /** Homepage URL */
  homepage?: string;

  /** Repository URL */
  repository?: string;

  /** Embedding model used */
  embeddingModel?: string;

  /** Privacy level */
  privacyLevel?: "public" | "sensitive" | "sovereign";

  /** Generate cryptographic signature */
  sign?: boolean;

  /** Domains this cartridge specializes in */
  domains?: string[];

  /** Query types this cartridge handles */
  queryTypes?: string[];
}

/**
 * File entry in manifest
 */
interface FileEntry {
  /** Relative path to file */
  path: string;

  /** SHA-256 checksum */
  checksum: string;

  /** File size in bytes */
  size: number;
}

/**
 * Local validation result type
 */
interface LocalValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Errors that prevent loading (empty if valid) */
  errors: string[];

  /** Warnings that don't prevent loading */
  warnings: string[];
}

/**
 * ManifestLoader - Load, validate, and create cartridge manifests
 */
export class ManifestLoader {
  private ajv: InstanceType<typeof Ajv>;
  private validateFn: ReturnType<typeof Ajv.prototype["compile"]> | null = null;
  private schema: object | null = null;

  constructor(private schemaPath?: string) {
    // Initialize AJV with formats
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      strictSchema: false,
    });
    addFormats(this.ajv);

    // Load schema if path provided
    if (schemaPath) {
      this.loadSchema(schemaPath);
    }
  }

  /**
   * Load JSON Schema from file
   */
  private loadSchema(path: string): void {
    try {
      const schemaContent = readFileSync(path, "utf-8");
      this.schema = JSON.parse(schemaContent);
      if (this.schema) {
        this.validateFn = this.ajv.compile(this.schema);
      }
    } catch (error) {
      throw new Error(
        `Failed to load schema from ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Set schema directly (for testing or inline usage)
   */
  public setSchema(schema: object): void {
    this.schema = schema;
    this.validateFn = this.ajv.compile(schema);
  }

  /**
   * Load manifest from file
   *
   * @param manifestPath - Path to manifest JSON file
   * @param options - Loading options
   * @returns Load result with validation status
   */
  public async load(
    manifestPath: string,
    options?: ManifestLoadOptions
  ): Promise<ManifestLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let checksumValid: boolean | undefined;
    let signatureValid: boolean | undefined;

    try {
      // Read manifest file
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content) as unknown;

      // Validate against schema
      const validationResult = await this.validate(manifest);

      if (!validationResult.isValid) {
        return {
          manifest: manifest as CartridgeManifest,
          isValid: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        };
      }

      const validManifest = validationResult.manifest;

      // Validate checksums if requested
      if (options?.validateChecksum) {
        const basePath =
          options.basePath || manifestPath.replace(/\/[^/]+\.json$/, "");
        checksumValid = await this.verifyChecksums(validManifest, basePath);

        if (!checksumValid) {
          errors.push("File checksums do not match manifest");
        }
      }

      // Validate signature if requested
      if (options?.validateSignature) {
        signatureValid = await this.verifySignature(validManifest);

        if (!signatureValid && !options.allowUnsigned) {
          errors.push("Signature validation failed");
        } else if (
          !signatureValid &&
          options.allowUnsigned &&
          validManifest.signature
        ) {
          warnings.push(
            "Signature validation failed but unsigned cartridges are allowed"
          );
        } else if (!validManifest.signature) {
          warnings.push("No signature present (unsigned cartridge)");
        }
      }

      return {
        manifest: validManifest,
        isValid: errors.length === 0,
        errors,
        warnings,
        checksumValid,
        signatureValid,
      };
    } catch (error) {
      return {
        manifest: {} as CartridgeManifest,
        isValid: false,
        errors: [
          `Failed to load manifest: ${error instanceof Error ? error.message : String(error)}`,
        ],
        warnings,
      };
    }
  }

  /**
   * Validate manifest against schema
   *
   * @param manifest - Manifest to validate
   * @returns Validation result
   */
  public async validate(manifest: unknown): Promise<ManifestLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if validator is loaded
    if (!this.validateFn) {
      return {
        manifest: manifest as CartridgeManifest,
        isValid: false,
        errors: [
          "No schema loaded. Call setSchema() or provide schemaPath to constructor.",
        ],
        warnings,
      };
    }

    // Validate against schema
    const valid = this.validateFn(manifest);

    if (!valid && this.validateFn.errors) {
      for (const error of this.validateFn.errors) {
        errors.push(
          `${error.instancePath} ${error.message || ""}. ${error.params ? JSON.stringify(error.params) : ""}`.trim()
        );
      }
    }

    // Additional checks
    if (valid) {
      const m = manifest as CartridgeManifest;

      // Check version format
      if (!/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(m.version)) {
        errors.push(`Invalid version format: ${m.version}`);
      }

      // Check capabilities size is reasonable
      if (m.capabilities.sizeBytes < 0) {
        errors.push("sizeBytes must be non-negative");
      }

      // Check load time is reasonable
      if (m.capabilities.loadTimeMs < 0) {
        errors.push("loadTimeMs must be non-negative");
      }

      // Warn if missing optional fields
      if (!m.author) {
        warnings.push("No author specified");
      }

      if (!m.license) {
        warnings.push("No license specified");
      }
    }

    return {
      manifest: manifest as CartridgeManifest,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify checksums of files listed in manifest
   *
   * @param manifest - Cartridge manifest
   * @param cartridgeDir - Directory containing cartridge files
   * @returns True if all checksums match
   */
  public async verifyChecksums(
    manifest: CartridgeManifest,
    cartridgeDir: string
  ): Promise<boolean> {
    if (!manifest.files || manifest.files.length === 0) {
      // No files to verify
      return true;
    }

    for (const file of manifest.files) {
      const filePath = join(cartridgeDir, file.path);

      try {
        const content = await readFile(filePath);
        const hash = createHash("sha256").update(content).digest("hex");

        if (hash !== file.checksum) {
          return false;
        }

        // Verify size if specified
        if (file.size !== undefined && content.length !== file.size) {
          return false;
        }
      } catch (error) {
        // File not found or not readable
        return false;
      }
    }

    return true;
  }

  /**
   * Verify cryptographic signature
   *
   * Note: This is a skeleton implementation. A full implementation would:
   * - Use a proper crypto library (e.g., node-forge, crypto)
   * - Support multiple signature algorithms (RSA, Ed25519)
   * - Load public keys from a trusted keyring
   * - Handle signature metadata (key ID, timestamp)
   *
   * @param manifest - Cartridge manifest
   * @returns True if signature is valid
   */
  public async verifySignature(manifest: CartridgeManifest): Promise<boolean> {
    if (!manifest.signature) {
      // No signature to verify
      return false;
    }

    // Skeleton: Check signature exists and is not empty
    // In a real implementation, this would:
    // 1. Extract the signature from the manifest
    // 2. Load the public key for the cartridge ID
    // 3. Verify the signature against the manifest content
    // 4. Return true if signature is valid

    // For now, just check format (hex string)
    const signature = manifest.signature;
    const isValidFormat = /^[a-f0-9]+$/.test(signature) && signature.length > 0;

    return isValidFormat;
  }

  /**
   * Create a manifest from a cartridge directory
   *
   * Scans the directory, computes checksums, and generates a manifest.
   *
   * @param cartridgeDir - Directory containing cartridge files
   * @param id - Cartridge ID (e.g., @lsi/cartridge-medical)
   * @param version - Semantic version
   * @param name - Human-readable name
   * @param description - Description
   * @param options - Additional options
   * @returns Generated manifest
   */
  public async create(
    cartridgeDir: string,
    id: string,
    version: string,
    name: string,
    description: string,
    options?: CreateManifestOptions
  ): Promise<CartridgeManifest> {
    const files: FileEntry[] = [];
    let totalSize = 0;

    // Scan directory and compute checksums
    await this.scanDirectory(cartridgeDir, cartridgeDir, files);

    // Calculate total size
    totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Calculate overall checksum (hash of all file hashes concatenated)
    const overallChecksum = this.calculateOverallChecksum(files);

    // Build capabilities
    const capabilities: CartridgeCapabilities = {
      domains: options?.domains || [],
      queryTypes: (options?.queryTypes as any) || ["QUESTION"],
      embeddingModel: options?.embeddingModel,
      sizeBytes: totalSize,
      loadTimeMs: 1000, // Default estimate
      privacyLevel: options?.privacyLevel || "public",
    };

    // Build manifest
    const manifest: CartridgeManifest = {
      id,
      version,
      name,
      description,
      author: options?.author || "",
      license: options?.license || "MIT",
      homepage: options?.homepage,
      repository: options?.repository,
      dependencies: [],
      conflicts: [],
      capabilities,
      metadata: {
        generatedAt: new Date().toISOString(),
        fileCount: files.length,
      },
      checksum: overallChecksum,
      ...(options?.sign && { signature: "placeholder-signature" }),
      files,
    };

    return manifest;
  }

  /**
   * Recursively scan directory and compute checksums
   */
  private async scanDirectory(
    baseDir: string,
    currentDir: string,
    files: FileEntry[]
  ): Promise<void> {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relPath = relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
          await this.scanDirectory(baseDir, fullPath, files);
        }
      } else if (entry.isFile()) {
        // Compute checksum for file
        const content = readFileSync(fullPath);
        const checksum = createHash("sha256").update(content).digest("hex");
        const size = content.length;

        files.push({
          path: relPath,
          checksum,
          size,
        });
      }
    }
  }

  /**
   * Calculate overall checksum from file entries
   */
  private calculateOverallChecksum(files: FileEntry[]): string {
    // Sort files by path for deterministic ordering
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    // Concatenate all checksums
    const combined = sortedFiles.map(f => f.checksum).join("");

    // Hash the combined string
    return createHash("sha256").update(combined).digest("hex");
  }

  /**
   * Write manifest to file
   *
   * @param manifest - Manifest to write
   * @param outputPath - Path to write manifest JSON
   */
  public async write(
    manifest: CartridgeManifest,
    outputPath: string
  ): Promise<void> {
    try {
      const content = JSON.stringify(manifest, null, 2);
      await writeFile(outputPath, content, "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write manifest to ${outputPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate cartridge directory structure
   *
   * Checks that required files exist and structure is valid.
   *
   * @param cartridgeDir - Cartridge directory
   * @returns Validation result
   */
  public async validateDirectory(
    cartridgeDir: string
  ): Promise<LocalValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check directory exists
    if (!existsSync(cartridgeDir)) {
      errors.push(`Cartridge directory does not exist: ${cartridgeDir}`);
      return { valid: false, errors, warnings };
    }

    // Check for manifest file
    const manifestPath = join(cartridgeDir, "cartridge.json");
    if (!existsSync(manifestPath)) {
      errors.push("cartridge.json not found in directory");
    }

    // Check for data directory (optional but common)
    const dataDir = join(cartridgeDir, "data");
    if (!existsSync(dataDir)) {
      warnings.push("data/ directory not found (optional but recommended)");
    }

    // Check for metadata file (optional)
    const metadataPath = join(cartridgeDir, "metadata.json");
    if (!existsSync(metadataPath)) {
      warnings.push("metadata.json not found (optional)");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get cartridge manifest from directory
   *
   * Convenience method that loads manifest from cartridge directory.
   *
   * @param cartridgeDir - Cartridge directory
   * @param options - Load options
   * @returns Load result
   */
  public async fromDirectory(
    cartridgeDir: string,
    options?: ManifestLoadOptions
  ): Promise<ManifestLoadResult> {
    const manifestPath = join(cartridgeDir, "cartridge.json");
    const loadOptions = {
      ...options,
      basePath: cartridgeDir,
    };

    return this.load(manifestPath, loadOptions);
  }
}

/**
 * Default singleton instance
 */
let defaultLoader: ManifestLoader | null = null;

/**
 * Get or create default manifest loader
 *
 * @param schemaPath - Optional path to schema file
 * @returns ManifestLoader instance
 */
export function getManifestLoader(schemaPath?: string): ManifestLoader {
  if (!defaultLoader || schemaPath) {
    defaultLoader = new ManifestLoader(schemaPath);
  }
  return defaultLoader;
}

/**
 * Convenience function to load a manifest
 *
 * @param manifestPath - Path to manifest file
 * @param options - Load options
 * @returns Load result
 */
export async function loadManifest(
  manifestPath: string,
  options?: ManifestLoadOptions
): Promise<ManifestLoadResult> {
  const loader = getManifestLoader();
  return loader.load(manifestPath, options);
}

/**
 * Convenience function to create a manifest
 *
 * @param cartridgeDir - Cartridge directory
 * @param id - Cartridge ID
 * @param version - Version
 * @param name - Name
 * @param description - Description
 * @param options - Create options
 * @returns Generated manifest
 */
export async function createManifest(
  cartridgeDir: string,
  id: string,
  version: string,
  name: string,
  description: string,
  options?: CreateManifestOptions
): Promise<CartridgeManifest> {
  const loader = getManifestLoader();
  return loader.create(cartridgeDir, id, version, name, description, options);
}

/**
 * Convenience function to write a manifest
 *
 * @param manifest - Manifest to write
 * @param outputPath - Output path
 */
export async function writeManifest(
  manifest: CartridgeManifest,
  outputPath: string
): Promise<void> {
  const loader = getManifestLoader();
  return loader.write(manifest, outputPath);
}
