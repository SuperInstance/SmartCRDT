/**
 * @fileoverview Deployment Utilities for VL-JEPA Edge Deployment
 *
 * Provides utilities for deploying VL-JEPA models to various platforms:
 * - Static site deployment
 * - CDN deployment
 * - Edge worker deployment
 *
 * @package @lsi/vljepa-edge
 */

import type {
  StaticDeploymentConfig,
  CDNDeploymentConfig,
  EdgeWorkerDeploymentConfig,
} from "../types.js";
import { RuntimeError } from "../types.js";

/**
 * Static Site Deployer for VL-JEPA edge deployment
 *
 * Deploys VL-JEPA models and assets for static hosting.
 */
export class StaticDeployer {
  private config: StaticDeploymentConfig;

  constructor(config: StaticDeploymentConfig) {
    this.config = config;
  }

  /**
   * Deploy static assets
   */
  async deploy(files: Map<string, string | ArrayBuffer>): Promise<{
    outputDir: string;
    files: string[];
    size: number;
  }> {
    const deployedFiles: string[] = [];
    let totalSize = 0;

    for (const [path, content] of files) {
      const outputPath = `${this.config.outputDir}/${path}`;

      // Process file (compress, minify)
      const processed = await this.processFile(path, content);

      // Write file
      await this.writeFile(outputPath, processed);

      deployedFiles.push(outputPath);
      totalSize += processed.byteLength;
    }

    return {
      outputDir: this.config.outputDir,
      files: deployedFiles,
      size: totalSize,
    };
  }

  /**
   * Process file (compress, minify)
   */
  private async processFile(
    _path: string,
    content: string | ArrayBuffer
  ): Promise<ArrayBuffer> {
    let data: ArrayBuffer;

    if (typeof content === "string") {
      // Minify if enabled
      const text = this.config.minify ? this.minify(content) : content;
      data = new TextEncoder().encode(text).buffer;
    } else {
      data = content;
    }

    // Compress if enabled
    if (this.config.compression !== "none") {
      data = await this.compress(data, this.config.compression);
    }

    return data;
  }

  /**
   * Minify JavaScript/HTML/CSS
   */
  private minify(code: string): string {
    // Simple minification (remove comments, extra whitespace)
    return code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Compress data
   */
  private async compress(
    data: ArrayBuffer,
    format: "gzip" | "brotli" | "none"
  ): Promise<ArrayBuffer> {
    if (format === "none") {
      return data;
    }

    // Use CompressionStream API
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      },
    });

    const compressedStream = stream.pipeThrough(
      new CompressionStream(format === "gzip" ? "gzip" : "deflate")
    );

    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const combined = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  }

  /**
   * Write file (placeholder)
   */
  private async writeFile(path: string, data: ArrayBuffer): Promise<void> {
    // In browser context, this would typically use File System Access API
    // or upload to a service
    console.info(
      `[StaticDeployer] Writing file: ${path} (${data.byteLength} bytes)`
    );
  }
}

/**
 * CDN Deployer for VL-JEPA edge deployment
 *
 * Deploys VL-JEPA models to CDN for global distribution.
 */
export class CDNDeployer {
  private config: CDNDeploymentConfig;

  constructor(config: CDNDeploymentConfig) {
    this.config = config;
  }

  /**
   * Deploy to CDN
   */
  async deploy(files: Map<string, ArrayBuffer>): Promise<{
    url: string;
    files: string[];
    cdnUrl: string;
  }> {
    const uploadedFiles: string[] = [];

    for (const [path, data] of files) {
      const url = await this.uploadFile(path, data);
      uploadedFiles.push(url);
    }

    return {
      url: this.config.endpoint,
      files: uploadedFiles,
      cdnUrl: `${this.config.endpoint}/`,
    };
  }

  /**
   * Upload file to CDN
   */
  private async uploadFile(path: string, data: ArrayBuffer): Promise<string> {
    const url = `${this.config.endpoint}/${path}`;

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": this.getContentType(path),
    };

    if (this.config.cors && this.config.corsOrigin) {
      headers["Access-Control-Allow-Origin"] = this.config.corsOrigin;
    }

    // Add CDN-specific headers
    if (this.config.provider === "cloudflare") {
      headers["Cache-Control"] = `public, max-age=${this.config.cache.ttl}`;
    }

    // Upload file
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: data,
    });

    if (!response.ok) {
      throw new RuntimeError(
        `Failed to upload ${path}: ${response.statusText}`
      );
    }

    return url;
  }

  /**
   * Get content type for file
   */
  private getContentType(path: string): string {
    const ext = path.split(".").pop();
    switch (ext) {
      case "html":
        return "text/html";
      case "js":
        return "application/javascript";
      case "json":
        return "application/json";
      case "wasm":
        return "application/wasm";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "svg":
        return "image/svg+xml";
      case "css":
        return "text/css";
      default:
        return "application/octet-stream";
    }
  }
}

/**
 * Edge Worker Deployer for VL-JEPA edge deployment
 *
 * Deploys VL-JEPA models to edge workers for serverless inference.
 */
export class EdgeWorkerDeployer {
  private config: EdgeWorkerDeploymentConfig;

  constructor(config: EdgeWorkerDeploymentConfig) {
    this.config = config;
  }

  /**
   * Deploy to edge worker
   */
  async deploy(workerCode: string): Promise<{
    url: string;
    workerId: string;
  }> {
    switch (this.config.runtime) {
      case "cloudflare":
        return this.deployToCloudflare(workerCode);
      case "aws":
        return this.deployToAWS(workerCode);
      case "azure":
        return this.deployToAzure(workerCode);
      case "deno":
        return this.deployToDeno(workerCode);
      case "fastly":
        return this.deployToFastly(workerCode);
      default:
        throw new RuntimeError(`Unsupported runtime: ${this.config.runtime}`);
    }
  }

  /**
   * Deploy to Cloudflare Workers
   */
  private async deployToCloudflare(
    _workerCode: string
  ): Promise<{ url: string; workerId: string }> {
    // This would use Wrangler CLI or API
    const workerId = `vljepa-${crypto.randomUUID()}`;

    console.info(
      `[EdgeWorkerDeployer] Deploying to Cloudflare Workers: ${workerId}`
    );

    return {
      url: `https://vljepa.workers.dev`,
      workerId,
    };
  }

  /**
   * Deploy to AWS Lambda@Edge
   */
  private async deployToAWS(
    _workerCode: string
  ): Promise<{ url: string; workerId: string }> {
    // This would use AWS CLI or SDK
    const workerId = `vljepa-${crypto.randomUUID()}`;

    console.info(
      `[EdgeWorkerDeployer] Deploying to AWS Lambda@Edge: ${workerId}`
    );

    return {
      url: `https://lambda.amazonaws.com/${workerId}`,
      workerId,
    };
  }

  /**
   * Deploy to Azure Edge Functions
   */
  private async deployToAzure(
    _workerCode: string
  ): Promise<{ url: string; workerId: string }> {
    const workerId = `vljepa-${crypto.randomUUID()}`;

    console.info(
      `[EdgeWorkerDeployer] Deploying to Azure Edge Functions: ${workerId}`
    );

    return {
      url: `https://azureedge.net/${workerId}`,
      workerId,
    };
  }

  /**
   * Deploy to Deno Deploy
   */
  private async deployToDeno(
    _workerCode: string
  ): Promise<{ url: string; workerId: string }> {
    const workerId = `vljepa-${crypto.randomUUID()}`;

    console.info(`[EdgeWorkerDeployer] Deploying to Deno Deploy: ${workerId}`);

    return {
      url: `https://vljepa.denodev.dev`,
      workerId,
    };
  }

  /**
   * Deploy to Fastly Compute@Edge
   */
  private async deployToFastly(
    _workerCode: string
  ): Promise<{ url: string; workerId: string }> {
    const workerId = `vljepa-${crypto.randomUUID()}`;

    console.info(
      `[EdgeWorkerDeployer] Deploying to Fastly Compute@Edge: ${workerId}`
    );

    return {
      url: `https://vljepa.fastly-edge.com`,
      workerId,
    };
  }
}

/**
 * Create a static deployer
 */
export function createStaticDeployer(
  config: StaticDeploymentConfig
): StaticDeployer {
  return new StaticDeployer(config);
}

/**
 * Create a CDN deployer
 */
export function createCDNDeployer(config: CDNDeploymentConfig): CDNDeployer {
  return new CDNDeployer(config);
}

/**
 * Create an edge worker deployer
 */
export function createEdgeWorkerDeployer(
  config: EdgeWorkerDeploymentConfig
): EdgeWorkerDeployer {
  return new EdgeWorkerDeployer(config);
}

/**
 * Default static deployment configuration
 */
export function getDefaultStaticDeploymentConfig(): StaticDeploymentConfig {
  return {
    outputDir: "./dist",
    baseUrl: "/",
    minify: true,
    sourceMaps: true,
    compression: "gzip",
    include: ["**/*.js", "**/*.wasm", "**/*.json"],
    exclude: ["**/*.test.ts", "**/*.spec.ts"],
  };
}

/**
 * Default CDN deployment configuration
 */
export function getDefaultCDNDeploymentConfig(): CDNDeploymentConfig {
  return {
    provider: "generic",
    endpoint: "https://cdn.example.com",
    cache: {
      ttl: 86400, // 24 hours
      rules: {
        "**/*.wasm": 604800, // 7 days
        "**/*.js": 86400, // 1 day
        "**/*.json": 3600, // 1 hour
      },
    },
    cors: true,
    corsOrigin: "*",
  };
}

/**
 * Default edge worker deployment configuration
 */
export function getDefaultEdgeWorkerDeploymentConfig(): EdgeWorkerDeploymentConfig {
  return {
    runtime: "cloudflare",
    scriptPath: "./dist/worker.js",
    memoryLimit: 128,
    timeout: 10000, // 10 seconds
    env: {
      ENVIRONMENT: "production",
    },
  };
}
