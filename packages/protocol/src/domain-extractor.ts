/**
 * @fileoverview Domain Extraction Protocol Types
 *
 * Defines interfaces and types for extracting domain knowledge from code structure,
 * imports, naming patterns, and file organization.
 *
 * @module @lsi/protocol/domain-extractor
 */

import type { ImportAnalysis } from "./common.js";

// ============================================================================
// DOMAIN EXTRACTION CORE TYPES
// ============================================================================

/**
 * Domain categories that can be inferred from code structure
 *
 * These represent technical domains that codebases typically operate within.
 */
export type CodeDomain =
  | "database"        // Database operations, ORM, queries
  | "http-api"        // HTTP servers, clients, REST/GraphQL APIs
  | "crypto"          // Cryptography, hashing, encryption
  | "filesystem"      // File I/O, path operations, directory management
  | "ai-ml"           // Machine learning, AI, neural networks
  | "auth"            // Authentication, authorization, identity
  | "testing"         // Testing frameworks, test utilities
  | "validation"      // Schema validation, data validation
  | "logging"         // Logging, monitoring, observability
  | "messaging"       // Message queues, event systems, pub/sub
  | "storage"         // Object storage, blob storage, caching
  | "networking"      // Network protocols, sockets, WebRTC
  | "ui-framework"    // Frontend frameworks, component libraries
  | "cli"             // Command-line interfaces, terminal tools
  | "utility"         // Utility libraries, helper functions
  | "config"          // Configuration management, environment variables
  | "scheduling"      // Task scheduling, cron jobs, job queues
  | "data-processing" // Data transformation, ETL, streaming
  | "security"        // Security utilities, CSRF, XSS protection
  | "devops"          // DevOps tools, CI/CD, deployment
  | "unknown";        // Unable to determine domain

/**
 * Domain detection result with confidence scoring
 */
export interface DomainDetection {
  /** Detected domain */
  domain: CodeDomain;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence that led to this detection */
  evidence: DomainEvidence[];
  /** Primary imports that suggest this domain */
  primaryImports: string[];
}

/**
 * Evidence for domain detection
 */
export interface DomainEvidence {
  /** Type of evidence */
  type: "import" | "filename" | "directory" | "naming-pattern" | "content";
  /** Specific evidence value */
  value: string;
  /** Strength of this evidence (0-1) */
  strength: number;
  /** Additional context */
  context?: string;
}

/**
 * Complete domain extraction result
 */
export interface DomainExtractionResult {
  /** All detected domains with scores */
  domains: DomainDetection[];
  /** Primary domain (highest confidence) */
  primaryDomain?: CodeDomain;
  /** Overall confidence in classification */
  confidence: number;
  /** Import analysis that informed this extraction */
  importAnalysis: ImportAnalysis;
  /** Processing metadata */
  metadata: {
    timestamp: number;
    extractorVersion: string;
    processingTime: number;
    method: "heuristic" | "embedding" | "hybrid";
  };
}

// ============================================================================
// DOMAIN EXTRACTOR INTERFACE
// ============================================================================

/**
 * Domain extractor configuration
 */
export interface DomainExtractorConfig {
  /** Minimum confidence threshold for including a domain */
  minConfidence?: number;
  /** Maximum number of domains to return */
  maxDomains?: number;
  /** Whether to use hybrid approach (keywords + embeddings) */
  useHybrid?: boolean;
  /** Custom domain mappings (override defaults) */
  customMappings?: Record<string, CodeDomain[]>;
  /** Domain weights for scoring (higher = more important) */
  domainWeights?: Partial<Record<CodeDomain, number>>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Domain extractor interface
 *
 * Implementations analyze code structure to determine what domains the code operates within.
 */
export interface DomainExtractor {
  /** Extractor name */
  readonly name: string;
  /** Extractor version */
  readonly version: string;

  /**
   * Extract domains from import analysis
   *
   * @param importAnalysis - Analyzed import statements
   * @param config - Optional configuration
   * @returns Promise<DomainExtractionResult>
   */
  extractFromImports(
    importAnalysis: ImportAnalysis,
    config?: DomainExtractorConfig
  ): Promise<DomainExtractionResult>;

  /**
   * Extract domains from raw code
   *
   * @param code - Source code to analyze
   * @param config - Optional configuration
   * @returns Promise<DomainExtractionResult>
   */
  extractFromCode(
    code: string,
    config?: DomainExtractorConfig
  ): Promise<DomainExtractionResult>;

  /**
   * Extract domains from file path and name
   *
   * @param filePath - Full file path
   * @param config - Optional configuration
   * @returns Promise<DomainDetection[]>
   */
  extractFromPath(
    filePath: string,
    config?: DomainExtractorConfig
  ): Promise<DomainDetection[]>;

  /**
   * Get domain mapping table (import -> domains)
   *
   * @returns Record of import patterns to domains
   */
  getDomainMappings(): Record<string, CodeDomain[]>;

  /**
   * Add custom domain mapping
   *
   * @param importPattern - Import pattern (regex or string)
   * @param domains - Domains to map to this pattern
   */
  addDomainMapping(
    importPattern: string,
    domains: CodeDomain[]
  ): void;
}

// ============================================================================
// IMPORT-TO-DOMAIN MAPPINGS
// ============================================================================

/**
 * Default import-to-domain mappings
 *
 * Maps common package names and imports to their likely domains.
 * These patterns are used by heuristic-based domain extractors.
 */
export const DEFAULT_DOMAIN_MAPPINGS: Record<string, CodeDomain[]> = {
  // === DATABASE ===
  "pg": ["database"],
  "postgres": ["database"],
  "postgresql": ["database"],
  "mysql": ["database"],
  "mysql2": ["database"],
  "mongoose": ["database"],
  "mongodb": ["database"],
  "redis": ["storage", "database"],
  "ioredis": ["storage", "database"],
  "sqlite": ["database"],
  "sqlite3": ["database"],
  "better-sqlite3": ["database"],
  "prisma": ["database"],
  "@prisma": ["database"],
  "typeorm": ["database"],
  "sequelize": ["database"],
  "knex": ["database"],
  "mikro-orm": ["database"],
  "drizzle-orm": ["database"],

  // === HTTP/API ===
  "fetch": ["http-api"],
  "node-fetch": ["http-api"],
  "got": ["http-api"],
  "superagent": ["http-api"],
  "request": ["http-api"],
  "express": ["http-api"],
  "fastify": ["http-api"],
  "koa": ["http-api"],
  "hapi": ["http-api"],
  "restify": ["http-api"],
  "nest": ["http-api"],
  "@nestjs": ["http-api"],
  "nextjs": ["http-api", "ui-framework"],
  "nuxt": ["http-api", "ui-framework"],
  "remix": ["http-api", "ui-framework"],
  "sveltekit": ["http-api", "ui-framework"],
  "graphql": ["http-api"],
  "apollo": ["http-api"],
  "@apollo": ["http-api"],
  "graphql-yoga": ["http-api"],
  "gql": ["http-api"],
  "openapi": ["http-api"],
  "swagger": ["http-api"],
  "@swagger": ["http-api"],
  "grpc": ["http-api"],
  "@grpc": ["http-api"],

  // === CRYPTO ===
  "crypto": ["crypto"],
  "bcrypt": ["crypto", "auth"],
  "bcryptjs": ["crypto", "auth"],
  "argon2": ["crypto", "auth"],
  "scrypt": ["crypto"],
  "jose": ["crypto", "auth"],
  "crypto-js": ["crypto"],
  "node-forge": ["crypto"],
  "tweetnacl": ["crypto"],
  "libsodium": ["crypto"],
  "uuid": ["crypto"],

  // === FILESYSTEM ===
  "fs": ["filesystem"],
  "fs/promises": ["filesystem"],
  "path": ["filesystem"],
  "glob": ["filesystem"],
  "fast-glob": ["filesystem"],
  "walk": ["filesystem"],
  "chokidar": ["filesystem"],
  "graceful-fs": ["filesystem"],
  "fs-extra": ["filesystem"],
  "rimraf": ["filesystem"],
  "mkdirp": ["filesystem"],
  "temp": ["filesystem"],
  "tmp": ["filesystem"],
  "os": ["filesystem"],

  // === AI/ML ===
  "tensorflow": ["ai-ml"],
  "@tensorflow": ["ai-ml"],
  "torch": ["ai-ml"],
  "pytorch": ["ai-ml"],
  "transformers": ["ai-ml"],
  "@huggingface": ["ai-ml"],
  "langchain": ["ai-ml"],
  "openai": ["ai-ml"],
  "@openai": ["ai-ml"],
  "anthropic": ["ai-ml"],
  "@anthropic-ai": ["ai-ml"],
  "ollama": ["ai-ml"],
  "ai": ["ai-ml"],

  // === AUTH ===
  "passport": ["auth"],
  "@passport": ["auth"],
  "auth0": ["auth"],
  "@auth0": ["auth"],
  "clerk": ["auth"],
  "@clerk": ["auth"],
  "next-auth": ["auth"],
  "lucia": ["auth"],
  "supertokens": ["auth"],
  "keycloak": ["auth"],
  "oauth": ["auth"],
  "oauth2": ["auth"],
  "oidc": ["auth"],
  "jsonwebtoken": ["auth"],
  "jwt": ["auth"],

  // === TESTING ===
  "vitest": ["testing"],
  "jest": ["testing"],
  "@jest": ["testing"],
  "mocha": ["testing"],
  "chai": ["testing"],
  "jasmine": ["testing"],
  "karma": ["testing"],
  "cypress": ["testing"],
  "@cypress": ["testing"],
  "playwright": ["testing"],
  "puppeteer": ["testing"],
  "selenium": ["testing"],
  "supertest": ["testing"],
  "msw": ["testing"],
  "@testing-library": ["testing"],
  "sinon": ["testing"],
  "test": ["testing"],
  "tap": ["testing"],
  "ava": ["testing"],
  "uvu": ["testing"],
  "node:test": ["testing"],

  // === VALIDATION ===
  "zod": ["validation"],
  "joi": ["validation"],
  "yup": ["validation"],
  "ajv": ["validation"],
  "class-validator": ["validation"],
  "validator": ["validation"],
  "isomorphic-validator": ["validation"],
  "validate.js": ["validation"],
  "prop-types": ["validation"],

  // === LOGGING ===
  "winston": ["logging"],
  "pino": ["logging"],
  "bunyan": ["logging"],
  "log4js": ["logging"],
  "morgan": ["logging"],
  "debug": ["logging"],
  "console": ["logging"],
  "@opentelemetry": ["logging"],
  "opentelemetry": ["logging"],
  "datadog": ["logging"],
  "@datadog": ["logging"],
  "newrelic": ["logging"],
  "sentry": ["logging"],
  "@sentry": ["logging"],

  // === MESSAGING ===
  "amqplib": ["messaging"],
  "kafkajs": ["messaging"],
  "kafka-node": ["messaging"],
  "nats": ["messaging"],
  "rabbitmq": ["messaging"],
  "bull": ["messaging", "scheduling"],
  "bullmq": ["messaging", "scheduling"],
  "kue": ["messaging"],
  "agenda": ["messaging", "scheduling"],
  "mqtt": ["messaging"],
  "socket.io": ["messaging", "networking"],
  "ws": ["networking"],
  "uws": ["networking"],
  "eventemitter": ["messaging"],
  "rxjs": ["messaging"],
  "eventsource": ["messaging"],

  // === STORAGE ===
  "aws-sdk": ["storage"],
  "@aws-sdk": ["storage"],
  "aws-s3": ["storage"],
  "aws-lambda": ["storage"],
  "azure-storage": ["storage"],
  "@azure": ["storage"],
  "gcs": ["storage"],
  "@google-cloud": ["storage"],
  "cloudflare": ["storage"],
  "minio": ["storage"],
  "firebase": ["storage"],
  "@firebase": ["storage"],
  "multer": ["storage"],
  "formidable": ["storage"],
  "busboy": ["storage"],

  // === UI FRAMEWORKS ===
  "react": ["ui-framework"],
  "react-dom": ["ui-framework"],
  "@react": ["ui-framework"],
  "next": ["ui-framework"],
  "vue": ["ui-framework"],
  "svelte": ["ui-framework"],
  "angular": ["ui-framework"],
  "@angular": ["ui-framework"],
  "solid-js": ["ui-framework"],
  "preact": ["ui-framework"],
  "@emotion": ["ui-framework"],
  "styled-components": ["ui-framework"],
  "tailwind": ["ui-framework"],
  "@tanstack": ["ui-framework"],
  "@mui": ["ui-framework"],
  "antd": ["ui-framework"],
  "chakra-ui": ["ui-framework"],
  "d3": ["ui-framework"],

  // === CLI ===
  "commander": ["cli"],
  "yargs": ["cli"],
  "inquirer": ["cli"],
  "ora": ["cli"],
  "chalk": ["cli"],
  "cli-table": ["cli"],
  "meow": ["cli"],
  "cac": ["cli"],
  "oclif": ["cli"],
  "@oclif": ["cli"],
  "ink": ["cli"],
  "gluegun": ["cli"],

  // === UTILITY ===
  "lodash": ["utility"],
  "underscore": ["utility"],
  "ramda": ["utility"],
  "immutable": ["utility"],
  "date-fns": ["utility"],
  "moment": ["utility"],
  "dayjs": ["utility"],
  "luxon": ["utility"],
  "axios": ["utility", "http-api"],
  "numeral": ["utility"],
  "mathjs": ["utility"],

  // === CONFIG ===
  "dotenv": ["config"],
  "config": ["config"],
  "convict": ["config"],
  "nconf": ["config"],
  "rc": ["config"],
  "node-config": ["config"],
  "cosmiconfig": ["config"],

  // === SCHEDULING ===
  "node-cron": ["scheduling"],
  "cron": ["scheduling"],
  "later": ["scheduling"],
  "node-schedule": ["scheduling"],

  // === DATA PROCESSING ===
  "stream": ["data-processing"],
  "csv": ["data-processing"],
  "xlsx": ["data-processing"],
  "json2csv": ["data-processing"],
  "fast-csv": ["data-processing"],
  "papaparse": ["data-processing"],
  "etl": ["data-processing"],

  // === SECURITY ===
  "helmet": ["security"],
  "cors": ["security"],
  "csurf": ["security"],
  "express-rate-limit": ["security"],
  "rate-limiter": ["security"],
  "hpp": ["security"],
  "xss": ["security"],
  "sanitize": ["security"],

  // === DEVOPS ===
  "dockerode": ["devops"],
  "kubernetes": ["devops"],
  "@kubernetes": ["devops"],
  "jenkins": ["devops"],
  "github": ["devops"],
  "@actions": ["devops"],
  "gitlab": ["devops"],
  "terraform": ["devops"],
  "pulumi": ["devops"],
  "ansible": ["devops"],
};

/**
 * Domain keywords for content-based detection
 *
 * Used when imports alone aren't sufficient.
 */
export const DOMAIN_KEYWORDS: Partial<Record<CodeDomain, string[]>> = {
  "database": [
    "query", "select", "insert", "update", "delete", "migration",
    "schema", "transaction", "connection", "pool", "orm"
  ],
  "http-api": [
    "request", "response", "endpoint", "route", "middleware",
    "controller", "api", "rest", "graphql", "webhook"
  ],
  "crypto": [
    "encrypt", "decrypt", "hash", "cipher", "signature",
    "certificate", "key", "salt", "nonce", "aes", "rsa"
  ],
  "filesystem": [
    "file", "directory", "path", "readfile", "writefile",
    "mkdir", "rmdir", "readdir", "stat", "stream"
  ],
  "ai-ml": [
    "model", "training", "inference", "prediction", "neural",
    "embedding", "tensor", "transformer", "llm", "agent"
  ],
  "auth": [
    "login", "logout", "session", "token", "authentication",
    "authorization", "permission", "role", "user", "identity"
  ],
  "testing": [
    "test", "spec", "mock", "stub", "assert", "expect",
    "describe", "it", "before", "after", "suite"
  ],
  "validation": [
    "validate", "schema", "sanitize", "verify", "check",
    "constraint", "required", "optional", "format"
  ],
  "logging": [
    "log", "logger", "info", "debug", "warn", "error",
    "trace", "metric", "monitor", "observe", "telemetry"
  ],
  "messaging": [
    "message", "queue", "topic", "subscribe", "publish",
    "event", "emitter", "channel", "broker", "consumer"
  ],
  "storage": [
    "bucket", "object", "blob", "upload", "download",
    "s3", "storage", "cdn", "asset", "media"
  ],
  "networking": [
    "socket", "connection", "protocol", "packet", "handshake",
    "websocket", "tcp", "udp", "http", "tls"
  ],
  "ui-framework": [
    "component", "render", "props", "state", "hook",
    "element", "view", "template", "jsx", "tsx"
  ],
  "cli": [
    "command", "argument", "option", "flag", "terminal",
    "console", "stdin", "stdout", "stderr", "prompt"
  ],
  "utility": [
    "helper", "util", "format", "parse", "stringify",
    "transform", "map", "filter", "reduce", "clone"
  ],
  "config": [
    "config", "setting", "env", "environment", "option",
    "parameter", "preference", "profile", "mode"
  ],
  "scheduling": [
    "schedule", "cron", "job", "task", "worker",
    "queue", "delay", "interval", "timeout", "timer"
  ],
  "data-processing": [
    "transform", "map", "reduce", "filter", "stream",
    "parse", "serialize", "encode", "decode", "convert"
  ],
  "security": [
    "sanitize", "escape", "csrf", "xss", "injection",
    "protection", "security", "vulnerability", "attack"
  ],
  "devops": [
    "deploy", "build", "pipeline", "ci", "cd",
    "docker", "kubernetes", "container", "orchestration", "infrastructure"
  ],
};

/**
 * Filename pattern to domain mappings
 *
 * Maps filename patterns to likely domains.
 */
export const FILENAME_PATTERNS: Record<string, CodeDomain[]> = {
  // Database
  "*database*": ["database"],
  "*db*": ["database"],
  "*migration*": ["database"],
  "*schema*": ["database"],
  "*seed*": ["database"],
  "*repository*": ["database"],
  "*model*": ["database"],

  // HTTP/API
  "*controller*": ["http-api"],
  "*route*": ["http-api"],
  "*handler*": ["http-api"],
  "*endpoint*": ["http-api"],
  "*api*": ["http-api"],
  "*middleware*": ["http-api"],
  "*server*": ["http-api"],

  // Auth
  "*auth*": ["auth"],
  "*login*": ["auth"],
  "*user*": ["auth"],
  "*session*": ["auth"],
  "*permission*": ["auth"],
  "*role*": ["auth"],

  // Testing
  "*.test.*": ["testing"],
  "*.spec.*": ["testing"],
  "*test*": ["testing"],
  "*spec*": ["testing"],
  "*mock*": ["testing"],
  "*fixture*": ["testing"],

  // Config
  "*config*": ["config"],
  "*.config.*": ["config"],
  ".*rc*": ["config"],
  "*env*": ["config"],
  "*setting*": ["config"],

  // CLI
  "*cli*": ["cli"],
  "*command*": ["cli"],
  "*cmd*": ["cli"],

  // Utility
  "*util*": ["utility"],
  "*helper*": ["utility"],
  "*lib*": ["utility"],

  // Types
  "*.d.ts": ["utility"],
  "*type*": ["utility"],
  "*interface*": ["utility"],
};
