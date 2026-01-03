/**
 * Query command - Execute a query through Aequor
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import {
  formatDuration,
  formatCost,
  getStatusBadge,
} from "../utils/formatting.js";
import { configManager } from "../config/manager.js";
import { CascadeRouter } from "@lsi/cascade";
import { createOllamaAdapter } from "@lsi/cascade";

/**
 * Query command _options
 */
export interface QueryOptions {
  /** Model to use */
  model?: string;
  /** Force local backend */
  local?: boolean;
  /** Force cloud backend */
  cloud?: boolean;
  /** Output format */
  format?: "text" | "json";
  /** Enable streaming */
  stream?: boolean;
  /** Show routing details */
  _verbose?: boolean;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
}

/**
 * Create query command
 */
export function createQueryCommand(): Command {
  const cmd = new Command("query");

  cmd
    .description("Execute a query through Aequor")
    .argument("[text...]", "Query text (can be multiple words)")
    .option("-m, --model <model>", "Model to use")
    .option("--local", "Force local backend")
    .option("--cloud", "Force cloud backend")
    .option("-f, --format <format>", "Output format", "text")
    .option("--no-stream", "Disable streaming")
    .option("-v, --_verbose", "Show routing details")
    .option("-t, --temperature <temp>", "Temperature (0-2)", "0.7")
    .option("--max-tokens <tokens>", "Maximum tokens to generate", "2048")
    .action(async (args: string[], _options: QueryOptions) => {
      await executeQuery(args.join(" "), _options);
    });

  return cmd;
}

/**
 * Execute query
 */
async function executeQuery(
  query: string,
  _options: QueryOptions
): Promise<void> {
  if (!query || query.trim().length === 0) {
    logger.error("Query text is required");
    process.exit(1);
  }

  try {
    // Load configuration
    const _config = await configManager.getAll();
    const model = _options.model || _config.defaultModel;

    // Determine backend
    let backend: "local" | "cloud" = "local";
    if (_options.local) {
      backend = "local";
    } else if (_options.cloud) {
      backend = "cloud";
    } else {
      // Use router to decide
      const router = new CascadeRouter({
        complexityThreshold: _config.routing.complexityThreshold,
        maxLatency: _config.routing.timeout,
      });

      const decision = await router.route(query);
      backend = decision.route === "local" ? "local" : "cloud";

      if (_options._verbose) {
        logger.blank();
        logger.info(`Route Decision: ${getStatusBadge(backend)}`);
        logger.info(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
        logger.info(`Reason: ${decision.notes?.join(", ") || "N/A"}`);
        if (decision.estimatedLatency) {
          logger.info(
            `Est. Latency: ${formatDuration(decision.estimatedLatency)}`
          );
        }
        if (decision.estimatedCost) {
          logger.info(`Est. Cost: ${formatCost(decision.estimatedCost * 100)}`);
        }
        logger.blank();
      }
    }

    // Execute query based on backend
    const startTime = Date.now();

    if (backend === "local") {
      await executeLocalQuery(query, model, _options);
    } else {
      await executeCloudQuery(query, model, _options);
    }

    const latency = Date.now() - startTime;

    if (_options._verbose) {
      logger.info(`Completed in ${formatDuration(latency)}`);
    }
  } catch (error) {
    logger.error(`Query failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute local query via Ollama
 */
async function executeLocalQuery(
  query: string,
  model: string,
  _options: QueryOptions
): Promise<void> {
  const _config = await configManager.getBackendConfig();
  const adapter = createOllamaAdapter(
    _config.localUrl || "http://localhost:11434",
    model,
    {
      timeout: 30000,
      maxRetries: 3,
      stream: _options.stream !== false,
    }
  );

  // Check health
  const health = await adapter.checkHealth();
  if (!health.healthy) {
    logger.error(`Local backend unhealthy: ${health.error || "Unknown error"}`);
    logger.info("Available models: " + (health.models?.join(", ") || "None"));
    process.exit(1);
  }

  // Generate response
  const result = await adapter.process(query, model);

  // Output result
  outputResult(result, _options);
}

/**
 * Execute cloud query (placeholder for OpenAI integration)
 */
async function executeCloudQuery(
  query: string,
  model: string,
  _options: QueryOptions
): Promise<void> {
  const _config = await configManager.getBackendConfig();
  const apiKey = _config.cloud?.apiKey;

  if (!apiKey) {
    logger.error(
      "Cloud backend requires API key. Set it with: aequor _config set backend.cloud.apiKey <key>"
    );
    process.exit(1);
  }

  // TODO: Implement OpenAI adapter integration
  logger.warn("Cloud backend not yet implemented");
  logger.info(
    "API key is configured, but OpenAI adapter integration is pending"
  );

  // For now, output the query as-is
  if (_options.format === "json") {
    console.log(
      JSON.stringify(
        {
          query,
          model,
          backend: "cloud",
          content: "Cloud backend integration pending",
          latency: 0,
          tokensUsed: 0,
        },
        null,
        2
      )
    );
  } else {
    console.log("\nCloud backend integration is pending. Query received:");
    console.log(`  Model: ${model}`);
    console.log(`  Query: ${query}`);
  }
}

/**
 * Output query result
 */
function outputResult(
  result: {
    content: string;
    model: string;
    latency?: number;
    tokensUsed?: number;
    metadata?: Record<string, unknown>;
  },
  _options: QueryOptions
): void {
  if (_options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("\n" + result.content);
    if (_options._verbose) {
      console.log(`\n---`);
      if (result.tokensUsed) {
        console.log(`Tokens: ${result.tokensUsed}`);
      }
      if (result.latency) {
        console.log(`Latency: ${formatDuration(result.latency)}`);
      }
      console.log(`Model: ${result.model}`);
    }
  }
}
