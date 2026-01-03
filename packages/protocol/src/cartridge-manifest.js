"use strict";
/**
 * Cartridge Manifest JSON Schema
 *
 * This is the JSON Schema for validating cartridge manifests.
 * Import and use with AJV or any JSON Schema validator.
 *
 * @example
 * import { CARTRIDGE_MANIFEST_SCHEMA } from '@lsi/protocol';
 * import Ajv from 'ajv';
 * const ajv = new Ajv();
 * const validate = ajv.compile(CARTRIDGE_MANIFEST_SCHEMA);
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARTRIDGE_MANIFEST_SCHEMA = void 0;
/**
 * JSON Schema for cartridge manifest validation
 */
exports.CARTRIDGE_MANIFEST_SCHEMA = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://lsi.dev/schemas/cartridge-manifest.json",
    title: "Cartridge Manifest",
    description: "Metadata and capabilities for a knowledge cartridge in the Aequor Cognitive Orchestration Platform",
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
        id: {
            type: "string",
            pattern: "^@[a-z0-9-]+/[a-z0-9-]+$",
            description: "Unique identifier (e.g., @lsi/cartridge-medical)",
        },
        version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-[a-z0-9.]+)?$",
            description: "Semantic version (e.g., 1.2.0 or 1.2.0-beta.1)",
        },
        name: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            description: "Human-readable name of the cartridge",
        },
        description: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            description: "Detailed description of the cartridge's purpose and contents",
        },
        author: {
            type: "string",
            minLength: 1,
            description: "Author or organization name",
        },
        license: {
            type: "string",
            enum: ["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause", "proprietary"],
            description: "License identifier",
        },
        homepage: {
            type: "string",
            format: "uri",
            description: "Homepage URL for the cartridge",
        },
        repository: {
            type: "string",
            format: "uri",
            description: "Repository URL",
        },
        dependencies: {
            type: "array",
            items: {
                type: "string",
                pattern: "^[a-z0-9-]+(\\^?[0-9]+\\.[0-9]+\\.[0-9]+(-[a-z0-9.]+)?)?$",
            },
            default: [],
            description: "Other cartridges required by this one",
        },
        conflicts: {
            type: "array",
            items: {
                type: "string",
            },
            default: [],
            description: "Cartridges that conflict with this one",
        },
        capabilities: {
            type: "object",
            required: ["domains", "queryTypes", "sizeBytes"],
            properties: {
                domains: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                    minItems: 1,
                    description: "Domains this cartridge specializes in",
                },
                queryTypes: {
                    type: "array",
                    items: {
                        enum: [
                            "QUESTION",
                            "INSTRUCTION",
                            "ANALYSIS",
                            "CREATIVE",
                            "CONVERSATION",
                            "CODE",
                        ],
                    },
                    minItems: 1,
                    description: "Which query types this cartridge can handle",
                },
                embeddingModel: {
                    type: "string",
                    description: "Embedding model used for this cartridge",
                },
                sizeBytes: {
                    type: "number",
                    minimum: 0,
                    description: "Estimated size in bytes when loaded into memory",
                },
                loadTimeMs: {
                    type: "number",
                    minimum: 0,
                    default: 1000,
                    description: "Estimated load time in milliseconds",
                },
                privacyLevel: {
                    type: "string",
                    enum: ["public", "sensitive", "sovereign"],
                    default: "public",
                    description: "Privacy level required for this cartridge",
                },
            },
            additionalProperties: false,
        },
        metadata: {
            type: "object",
            additionalProperties: true,
            description: "Additional metadata as key-value pairs",
        },
        checksum: {
            type: "string",
            pattern: "^[a-f0-9]{64}$",
            description: "SHA-256 checksum of cartridge contents (hex-encoded)",
        },
        signature: {
            type: "string",
            description: "Optional cryptographic signature for verification",
        },
        files: {
            type: "array",
            items: {
                type: "object",
                required: ["path", "checksum"],
                properties: {
                    path: {
                        type: "string",
                        description: "Relative path to file within cartridge",
                    },
                    checksum: {
                        type: "string",
                        pattern: "^[a-f0-9]{64}$",
                        description: "SHA-256 checksum of this file",
                    },
                    size: {
                        type: "number",
                        minimum: 0,
                        description: "File size in bytes",
                    },
                },
                additionalProperties: false,
            },
            description: "List of files in the cartridge with their checksums",
        },
    },
    additionalProperties: false,
};
