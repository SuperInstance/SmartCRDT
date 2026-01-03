/**
 * Privacy command - Analyze query privacy and classification
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { IntentEncoder } from "@lsi/privacy";
import { PrivacyFilter, DataSensitivity, PIIType } from "@lsi/cascade";

/**
 * Privacy command _options
 */
export interface PrivacyOptions {
  /** Generate intent vector */
  encode?: boolean;
  /** Privacy parameter for encoding */
  epsilon?: string;
  /** Show detailed analysis */
  detailed?: boolean;
  /** Show classification */
  classify?: boolean;
  /** Output format */
  format?: "text" | "json";
}

/**
 * Create privacy command
 */
export function createPrivacyCommand(): Command {
  const cmd = new Command("privacy");

  cmd
    .description("Analyze query privacy and classification")
    .argument("<query>", "The query to analyze")
    .option("-e, --encode", "Generate intent vector")
    .option("--epsilon <value>", "Privacy parameter for encoding", "1.0")
    .option("-d, --detailed", "Show detailed analysis")
    .option("-c, --classify", "Show classification")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (query: string, _options: PrivacyOptions) => {
      await executePrivacy(query, _options);
    });

  return cmd;
}

/**
 * Execute privacy command
 */
async function executePrivacy(
  query: string,
  _options: PrivacyOptions
): Promise<void> {
  if (!query || query.trim().length === 0) {
    logger.error("Query is required");
    process.exit(1);
  }

  try {
    // Validate epsilon
    const epsilon = parseFloat(_options.epsilon ?? "1.0");
    if (isNaN(epsilon) || epsilon < 0.1 || epsilon > 10.0) {
      logger.error(
        "Invalid epsilon value. Must be a number between 0.1 and 10.0"
      );
      process.exit(1);
    }

    // Initialize privacy filter
    const privacyFilter = new PrivacyFilter({
      enablePIIDetection: true,
      enableSemanticAnalysis: true,
      redactionToken: "[REDACTED]",
    });

    // Analyze query
    const filterResult = await privacyFilter.filter(query, "");
    const sensitivity = filterResult.sensitivity;

    if (_options.format === "json") {
      // JSON output
      const result: Record<string, unknown> = {
        query,
        sensitivity,
        confidence: filterResult.confidence ?? 0,
        piiDetected: filterResult.detectedPII ?? [],
      };

      if (_options.encode) {
        // Try to encode (may fail if no OpenAI key)
        try {
          const intent = await encodeQuery(query, epsilon);
          result.intentVector = {
            dimensions: intent.vector.length,
            epsilon: intent.epsilon,
            model: intent.model,
            latency: intent.latency,
            satisfiesDP: intent.satisfiesDP,
          };
        } catch (encodeError) {
          result.encodeError = (encodeError as Error).message;
        }
      }

      console.log(JSON.stringify(result, null, 2));
    } else {
      // Text output
      logger.blank();

      // Privacy classification
      const sensitivityBadge = getSensitivityBadge(sensitivity);
      console.log(
        `${chalk.cyan("Privacy Classification:")} ${sensitivityBadge}`
      );
      console.log(
        `${chalk.cyan("Confidence:")} ${(filterResult.confidence ? filterResult.confidence * 100 : 0).toFixed(1)}%`
      );
      logger.blank();

      // PII detection
      if (filterResult.detectedPII && filterResult.detectedPII.length > 0) {
        console.log(chalk.yellow("Detected PII:"));
        for (const pii of filterResult.detectedPII) {
          console.log(`  ${chalk.red("•")} ${pii} (${getPiiDescription(pii)})`);
        }
        logger.blank();
      }

      // Recommendation
      const recommendation = getRecommendation(
        sensitivity,
        filterResult.detectedPII ?? []
      );
      console.log(
        `${chalk.cyan("Recommendation:")} ${chalk.bold(recommendation.strategy)}`
      );
      console.log(`  ${recommendation.reason}`);
      logger.blank();

      // Detailed analysis
      if (_options.detailed) {
        console.log(chalk.cyan("Detailed Analysis:"));
        console.log(
          `  ${chalk.grey("•")} Sensitivity Level: ${getSensitivityDescription(sensitivity)}`
        );
        console.log(
          `  ${chalk.grey("•")} Privacy Guarantee: ${sensitivity === DataSensitivity.PUBLIC ? "None needed" : "Redaction applied"}`
        );
        console.log(
          `  ${chalk.grey("•")} Safe for Cloud: ${sensitivity === DataSensitivity.PUBLIC ? chalk.green("Yes") : chalk.red("No")}`
        );
        logger.blank();
      }

      // Intent encoding
      if (_options.encode) {
        console.log(chalk.cyan("Intent Vector Encoding:"));
        try {
          const spinner = logger.createSpinner(
            "encode",
            "Generating intent vector..."
          );
          spinner.start();

          const intent = await encodeQuery(query, epsilon);
          spinner.succeed(
            `Generated ${intent.vector.length}-dim intent vector`
          );

          console.log(
            `  ${chalk.grey("•")} Dimensions: ${intent.vector.length}`
          );
          console.log(`  ${chalk.grey("•")} Epsilon (ε): ${intent.epsilon}`);
          console.log(`  ${chalk.grey("•")} Model: ${intent.model}`);
          console.log(`  ${chalk.grey("•")} Latency: ${intent.latency}ms`);
          console.log(
            `  ${chalk.grey("•")} Satisfies DP: ${intent.satisfiesDP ? chalk.green("Yes") : chalk.red("No")}`
          );
          console.log(
            `  ${chalk.grey("•")} Privacy Level: ${getEpsilonLevel(intent.epsilon)}`
          );
          logger.blank();

          // First 5 dimensions (sample)
          console.log(chalk.cyan("Sample Dimensions (first 5 of 768):"));
          const sample = Array.from(intent.vector.slice(0, 5)).map((v: unknown) =>
            (v as number).toFixed(4)
          );
          console.log(`  [${sample.join(", ")}, ...]`);
        } catch (encodeError) {
          logger.warn(`Encoding failed: ${(encodeError as Error).message}`);
          logger.info("Intent encoding requires OpenAI API key. Set it with:");
          console.log(
            `  ${chalk.cyan("aequor _config --set backend.cloud.apiKey <key>")}`
          );
        }
        logger.blank();
      }

      // Privacy tips
      console.log(chalk.cyan("Privacy Tips:"));
      console.log(`  ${chalk.grey("•")} SOVEREIGN data: Never logged`);
      console.log(
        `  ${chalk.grey("•")} SENSITIVE data: Redacted before logging`
      );
      console.log(
        `  ${chalk.grey("•")} PUBLIC data: Logged as-is for training`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`Privacy analysis failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Encode query as intent vector
 */
async function encodeQuery(
  query: string,
  epsilon: number
): Promise<ReturnType<IntentEncoder["encode"]>> {
  const _config = (await configManager.getAll()) as any;
  const openaiKey =
    _config.backend?.cloud?.apiKey || process.env.OPENAI_API_KEY || "";

  if (!openaiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const encoder = new IntentEncoder({
    openaiKey,
    baseURL: _config.backend?.cloud?.baseUrl,
    epsilon,
  });

  // Initialize if method exists (lazy loading)
  if (encoder.initialize) {
    await encoder.initialize();
  }

  const intent = await encoder.encode(query);
  return intent;
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
 * Get recommendation based on sensitivity
 */
function getRecommendation(
  sensitivity: DataSensitivity,
  detectedPII: PIIType[]
): {
  strategy: string;
  reason: string;
} {
  switch (sensitivity) {
    case DataSensitivity.SOVEREIGN:
      return {
        strategy: chalk.red("DO NOT TRANSMIT"),
        reason:
          "Query contains highly sensitive personal data. Keep local only.",
      };
    case DataSensitivity.SENSITIVE:
      return {
        strategy: chalk.yellow("REDACT"),
        reason: `Query contains PII (${detectedPII.join(", ")}). Apply redaction before cloud transmission.`,
      };
    case DataSensitivity.PUBLIC:
      return {
        strategy: chalk.green("SAFE TO TRANSMIT"),
        reason:
          "Query contains no sensitive information. Safe for cloud processing.",
      };
    default:
      return {
        strategy: chalk.grey("UNKNOWN"),
        reason: "Unable to classify privacy _level.",
      };
  }
}

/**
 * Get epsilon _level description
 */
function getEpsilonLevel(epsilon: number): string {
  if (epsilon <= 0.1) {
    return chalk.red("Strong Privacy (ε=0.1)");
  } else if (epsilon <= 0.5) {
    return chalk.yellow("Moderate Privacy (ε=0.5)");
  } else if (epsilon <= 1.0) {
    return chalk.green("Balanced (ε=1.0)");
  } else if (epsilon <= 2.0) {
    return chalk.blue("Weak Privacy (ε=2.0)");
  } else {
    return chalk.magenta("Very Weak Privacy (ε=" + epsilon + ")");
  }
}
