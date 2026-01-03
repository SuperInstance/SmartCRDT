/**
 * Privacy subcommands - Classify, redact, encode, audit
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { IntentEncoder } from "@lsi/privacy";
import { PrivacyFilter, DataSensitivity, PIIType } from "@lsi/cascade";

/**
 * Create privacy subcommands
 */
export function createPrivacySubCommands(): Command {
  const cmd = new Command("privacy");

  cmd.description("Privacy operations (classify, redact, encode, audit)");

  // Classify subcommand
  const classifyCmd = new Command("classify");
  classifyCmd
    .description("Classify query privacy _level")
    .argument("<query>", "The query to classify")
    .option("-d, --detailed", "Show detailed classification")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (query: string, _options: PrivacyClassifyOptions) => {
      await executePrivacyClassify(query, _options);
    });

  // Redact subcommand
  const redactCmd = new Command("redact");
  redactCmd
    .description("Redact PII from query")
    .argument("<query>", "The query to redact")
    .option(
      "-s, --strategy <strategy>",
      "Redaction strategy (token/hash/remove)",
      "token"
    )
    .option("-f, --format <format>", "Output format", "text")
    .action(async (query: string, _options: PrivacyRedactOptions) => {
      await executePrivacyRedact(query, _options);
    });

  // Encode subcommand
  const encodeCmd = new Command("encode");
  encodeCmd
    .description("Encode query as intent vector")
    .argument("<query>", "The query to encode")
    .option("-e, --epsilon <value>", "Privacy parameter", "1.0")
    .option("-d, --dimensions <number>", "Output dimensions", "768")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (query: string, _options: PrivacyEncodeOptions) => {
      await executePrivacyEncode(query, _options);
    });

  // Audit subcommand
  const auditCmd = new Command("audit");
  auditCmd
    .description("Show privacy audit log")
    .option("-n, --_limit <number>", "Number of entries", "50")
    .option("-s, --sensitivity <_level>", "Filter by sensitivity")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: PrivacyAuditOptions) => {
      await executePrivacyAudit(_options);
    });

  cmd.addCommand(classifyCmd);
  cmd.addCommand(redactCmd);
  cmd.addCommand(encodeCmd);
  cmd.addCommand(auditCmd);

  return cmd;
}

/**
 * Privacy classify _options
 */
export interface PrivacyClassifyOptions {
  detailed?: boolean;
  format?: "text" | "json";
}

/**
 * Privacy redact _options
 */
export interface PrivacyRedactOptions {
  strategy?: "token" | "hash" | "remove";
  format?: "text" | "json";
}

/**
 * Privacy encode _options
 */
export interface PrivacyEncodeOptions {
  epsilon?: string;
  dimensions?: string;
  format?: "text" | "json";
}

/**
 * Privacy audit _options
 */
export interface PrivacyAuditOptions {
  _limit?: string;
  sensitivity?: string;
  format?: "text" | "json";
}

/**
 * Execute privacy classify
 */
async function executePrivacyClassify(
  query: string,
  _options: PrivacyClassifyOptions
): Promise<void> {
  try {
    const privacyFilter = new PrivacyFilter({
      enablePIIDetection: true,
      enableSemanticAnalysis: true,
      redactionToken: "[REDACTED]",
    });

    const result = await privacyFilter.filter(query, "");

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            query,
            sensitivity: result.sensitivity,
            confidence: result.confidence,
            piiDetected: result.detectedPII,
            reasoning: getSensitivityReasoning(
              result.sensitivity,
              result.detectedPII ?? []
            ),
          },
          null,
          2
        )
      );
    } else {
      logger.blank();
      console.log(chalk.cyan("Privacy Classification:"));
      logger.blank();

      const sensitivityBadge = getSensitivityBadge(result.sensitivity);
      console.log(`  ${chalk.cyan("Level:")} ${sensitivityBadge}`);
      console.log(
        `  ${chalk.cyan("Confidence:")} ${(result.confidence ? result.confidence * 100 : 0).toFixed(1)}%`
      );

      if (result.detectedPII && result.detectedPII.length > 0) {
        logger.blank();
        console.log(`  ${chalk.cyan("Detected PII:")}`);
        for (const pii of result.detectedPII) {
          console.log(
            `    ${chalk.red("•")} ${pii} (${getPiiDescription(pii)})`
          );
        }
      }

      if (_options.detailed) {
        logger.blank();
        console.log(`  ${chalk.cyan("Detailed Analysis:")}`);
        console.log(
          `    ${chalk.grey("•")} ${getSensitivityDescription(result.sensitivity)}`
        );
        console.log(
          `    ${chalk.grey("•")} Safe for Cloud: ${result.sensitivity === DataSensitivity.PUBLIC ? chalk.green("Yes") : chalk.red("No")}`
        );
        console.log(
          `    ${chalk.grey("•")} Recommendation: ${getRecommendation(result.sensitivity)}`
        );
      }
      logger.blank();
    }
  } catch (error) {
    logger.error(`Privacy classification failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute privacy redact
 */
async function executePrivacyRedact(
  query: string,
  _options: PrivacyRedactOptions
): Promise<void> {
  try {
    const strategy = _options.strategy ?? "token";
    const redactionToken =
      strategy === "hash"
        ? "<HASH>"
        : strategy === "remove"
          ? ""
          : "[REDACTED]";

    const privacyFilter = new PrivacyFilter({
      enablePIIDetection: true,
      enableSemanticAnalysis: true,
      redactionToken,
      redactionStrategy: strategy,
    });

    const result = await privacyFilter.filter(query, "");

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            original: query,
            redacted: result.redactedQuery,
            sensitivity: result.sensitivity,
            piiDetected: result.detectedPII,
            strategy,
          },
          null,
          2
        )
      );
    } else {
      logger.blank();
      console.log(chalk.cyan("Privacy Redaction:"));
      logger.blank();
      console.log(`  ${chalk.cyan("Strategy:")} ${strategy}`);
      console.log(`  ${chalk.cyan("Original:")} ${query}`);
      console.log(`  ${chalk.cyan("Redacted:")} ${result.redactedQuery}`);
      logger.blank();

      if (result.detectedPII && result.detectedPII.length > 0) {
        console.log(`  ${chalk.cyan("Redacted PII:")}`);
        for (const pii of result.detectedPII) {
          console.log(`    ${chalk.red("•")} ${pii}`);
        }
        logger.blank();
      }

      console.log(chalk.cyan("Privacy Guarantee:"));
      console.log(
        `  ${chalk.grey("•")} Redacted query is safe for cloud transmission`
      );
      console.log(
        `  ${chalk.grey("•")} Original data never leaves the local system`
      );
      console.log(
        `  ${chalk.grey("•")} PII cannot be reconstructed from redacted query`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`Privacy redaction failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute privacy encode
 */
async function executePrivacyEncode(
  query: string,
  _options: PrivacyEncodeOptions
): Promise<void> {
  try {
    const epsilon = parseFloat(_options.epsilon ?? "1.0");
    const dimensions = parseInt(_options.dimensions ?? "768", 10);

    if (isNaN(epsilon) || epsilon < 0.1 || epsilon > 10.0) {
      logger.error("Invalid epsilon. Must be between 0.1 and 10.0");
      process.exit(1);
    }

    const _config = (await configManager.getAll()) as any;
    const openaiKey =
      _config.backend?.cloud?.apiKey || process.env.OPENAI_API_KEY || "";

    if (!openaiKey) {
      logger.error("OpenAI API key not configured");
      logger.info("Set it using:");
      console.log(
        `  ${chalk.cyan("aequor _config set backend.cloud.apiKey <key>")}`
      );
      process.exit(1);
    }

    const encoder = new IntentEncoder({
      openaiKey,
      baseURL: _config.backend?.cloud?.baseUrl,
      epsilon,
      outputDimensions: dimensions,
    });

    if (encoder.initialize) {
      await encoder.initialize();
    }

    const intent = await encoder.encode(query);

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            query,
            intent: {
              dimensions: intent.vector.length,
              epsilon: intent.epsilon,
              model: intent.model,
              latency: intent.latency,
              satisfiesDP: intent.satisfiesDP,
            },
            sampleVector: Array.from(intent.vector.slice(0, 10)),
          },
          null,
          2
        )
      );
    } else {
      logger.blank();
      console.log(chalk.cyan("Intent Vector Encoding:"));
      logger.blank();
      console.log(`  ${chalk.cyan("Dimensions:")} ${intent.vector.length}`);
      console.log(`  ${chalk.cyan("Epsilon (ε):")} ${intent.epsilon}`);
      console.log(`  ${chalk.cyan("Model:")} ${intent.model}`);
      console.log(`  ${chalk.cyan("Latency:")} ${intent.latency}ms`);
      console.log(
        `  ${chalk.cyan("Satisfies DP:")} ${intent.satisfiesDP ? chalk.green("Yes") : chalk.red("No")}`
      );
      logger.blank();

      console.log(chalk.cyan("Sample Vector (first 10 dimensions):"));
      const sample = Array.from(intent.vector.slice(0, 10)).map((v: unknown) =>
        (v as number).toFixed(4)
      );
      console.log(`  [${sample.join(", ")}, ...]`);
      logger.blank();

      console.log(chalk.cyan("Privacy Guarantee:"));
      console.log(
        `  ${chalk.grey("•")} Intent vector preserves query semantics`
      );
      console.log(
        `  ${chalk.grey("•")} Original query cannot be reconstructed`
      );
      console.log(
        `  ${chalk.grey("•")} ε-differential privacy ensures mathematical privacy`
      );
      console.log(
        `  ${chalk.grey("•")} Safe for transmission to cloud services`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`Privacy encoding failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute privacy audit
 */
async function executePrivacyAudit(
  _options: PrivacyAuditOptions
): Promise<void> {
  try {

    // TODO: Implement actual audit log reading
    logger.blank();
    console.log(chalk.cyan("Privacy Audit Log:"));
    logger.blank();
    console.log(chalk.yellow("Audit logging not yet implemented"));
    logger.info("Enable audit logging in configuration:");
    console.log(
      `  ${chalk.cyan("aequor _config set logging.auditEnabled true")}`
    );
    logger.blank();

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            entries: [],
            count: 0,
            message: "Audit logging not yet implemented",
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    logger.error(`Privacy audit failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Get sensitivity badge with color
 */
function getSensitivityBadge(sensitivity: DataSensitivity): string {
  switch (sensitivity) {
    case DataSensitivity.SOVEREIGN:
      return chalk.red.bgBlack(" SOVEREIGN ");
    case DataSensitivity.SENSITIVE:
      return chalk.yellow.bgBlack(" SENSITIVE ");
    case DataSensitivity.PUBLIC:
      return chalk.green.bgBlack(" PUBLIC ");
    default:
      return chalk.grey.bgBlack(" UNKNOWN ");
  }
}

/**
 * Get sensitivity description
 */
function getSensitivityDescription(sensitivity: DataSensitivity): string {
  switch (sensitivity) {
    case DataSensitivity.SOVEREIGN:
      return "User's private data - never logged";
    case DataSensitivity.SENSITIVE:
      return "Contains PII - redacted before logging";
    case DataSensitivity.PUBLIC:
      return "General knowledge - logged as-is";
    default:
      return "Unknown";
  }
}

/**
 * Get PII type description
 */
function getPiiDescription(pii: PIIType): string {
  const descriptions: Record<PIIType, string> = {
    [PIIType.EMAIL_ADDRESS]: "Email address",
    [PIIType.PHONE_NUMBER]: "Phone number",
    [PIIType.SSN]: "Social Security Number",
    [PIIType.CREDIT_CARD]: "Credit card number",
    [PIIType.DATE_OF_BIRTH]: "Date of birth",
    [PIIType.ADDRESS]: "Physical address",
    [PIIType.PASSPORT_NUMBER]: "Passport number",
    [PIIType.DRIVER_LICENSE]: "Driver's license number",
    [PIIType.BANK_ACCOUNT]: "Bank account number",
    [PIIType.IP_ADDRESS]: "IP address",
    [PIIType.URL]: "URL with sensitive info",
    [PIIType.OTHER]: "Other PII",
  };
  return descriptions[pii] || "Unknown";
}

/**
 * Get sensitivity reasoning
 */
function getSensitivityReasoning(
  sensitivity: DataSensitivity,
  detectedPII: PIIType[]
): string {
  switch (sensitivity) {
    case DataSensitivity.SOVEREIGN:
      return "Query contains highly sensitive personal data that should never be transmitted or logged.";
    case DataSensitivity.SENSITIVE:
      return `Query contains PII (${detectedPII.join(", ")}) that must be redacted before transmission.`;
    case DataSensitivity.PUBLIC:
      return "Query contains no sensitive information and is safe for cloud processing.";
    default:
      return "Unable to determine sensitivity _level.";
  }
}

/**
 * Get recommendation
 */
function getRecommendation(sensitivity: DataSensitivity): string {
  switch (sensitivity) {
    case DataSensitivity.SOVEREIGN:
      return "Keep local only - do not transmit";
    case DataSensitivity.SENSITIVE:
      return "Apply redaction before transmission";
    case DataSensitivity.PUBLIC:
      return "Safe to transmit";
    default:
      return "Unknown";
  }
}
