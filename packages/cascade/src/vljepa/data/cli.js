#!/usr/bin/env node
/**
 * CLI Tool for Synthetic Query Data Generation
 *
 * Generates training data for intent classification models.
 *
 * Usage:
 *   node cli.js [count] [outputDir] [options]
 *
 * Examples:
 *   node cli.js 1000 ./data
 *   node cli.js 5000 ./data --seed 42 --unbalanced
 *
 * @package vljepa/data
 */
import { QueryDataGenerator } from "./generator";
import { DataExporter } from "./exporter";
/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        count: 1000,
        outputDir: "./data",
        balanced: true,
        formats: ["jsonl", "csv"],
        generateStats: true,
        stratified: true,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        }
        if (arg === "--seed" || arg === "-s") {
            options.seed = parseInt(args[++i]);
            continue;
        }
        if (arg === "--unbalanced") {
            options.balanced = false;
            continue;
        }
        if (arg === "--no-stats") {
            options.generateStats = false;
            continue;
        }
        if (arg === "--no-stratify") {
            options.stratified = false;
            continue;
        }
        if (arg === "--format" || arg === "-f") {
            const format = args[++i];
            if (format === "jsonl" || format === "json" || format === "csv") {
                options.formats = [format];
            }
            continue;
        }
        if (arg === "--all-formats") {
            options.formats = ["jsonl", "json", "csv"];
            continue;
        }
        // Positional arguments
        if (!isNaN(parseInt(arg))) {
            if (i === 0) {
                options.count = parseInt(arg);
            }
            else if (i === 1) {
                options.outputDir = arg;
            }
        }
    }
    return options;
}
/**
 * Print help message
 */
function printHelp() {
    console.log(`
CLI Tool for Synthetic Query Data Generation

Usage:
  node cli.js [count] [outputDir] [options]

Arguments:
  count          Number of queries to generate (default: 1000)
  outputDir      Output directory for generated files (default: ./data)

Options:
  -h, --help             Show this help message
  -s, --seed <number>    Random seed for reproducibility
  --unbalanced           Generate without balancing intent distribution
  --no-stats             Skip statistics generation
  --no-stratify          Don't stratify train/val/test splits
  -f, --format <format>  Output format: jsonl, json, or csv (default: jsonl)
  --all-formats          Export all formats (jsonl, json, csv)

Examples:
  # Generate 1000 queries with default settings
  node cli.js 1000 ./data

  # Generate 5000 queries with seed for reproducibility
  node cli.js 5000 ./data --seed 42

  # Generate unbalanced dataset
  node cli.js 2000 ./data --unbalanced

  # Generate all export formats
  node cli.js 1000 ./data --all-formats

  # Generate JSON format only
  node cli.js 1000 ./data --format json
`);
}
/**
 * Create output directory if it doesn't exist
 */
async function ensureDir(dir) {
    try {
        // Try Deno
        // @ts-ignore
        if (typeof Deno !== "undefined" && Deno.mkdir) {
            // @ts-ignore
            await Deno.mkdir(dir, { recursive: true });
            return;
        }
    }
    catch (e) {
        // Fall through to Node.js
    }
    // Node.js fallback
    try {
        const fs = await import("fs/promises");
        await fs.mkdir(dir, { recursive: true });
    }
    catch (e) {
        // Directory might already exist, ignore error
    }
}
/**
 * Main CLI execution
 */
async function main() {
    console.log("🔮 Synthetic Query Data Generator\n");
    const options = parseArgs();
    console.log("Configuration:");
    console.log(`  Count: ${options.count}`);
    console.log(`  Output: ${options.outputDir}`);
    console.log(`  Balanced: ${options.balanced}`);
    console.log(`  Stratified: ${options.stratified}`);
    console.log(`  Formats: ${options.formats.join(", ")}`);
    if (options.seed !== undefined) {
        console.log(`  Seed: ${options.seed}`);
    }
    console.log();
    // Create output directory
    await ensureDir(options.outputDir);
    console.log(`✓ Created output directory: ${options.outputDir}`);
    // Initialize generator
    console.log(`\n⚙️  Initializing generator...`);
    const generator = new QueryDataGenerator(options.seed);
    const templateStats = generator.getTemplateStats();
    console.log(`✓ Generator initialized with ${Object.values(templateStats).reduce((a, b) => a + b, 0)} templates`);
    // Generate queries
    console.log(`\n🎲 Generating ${options.count} queries...`);
    const startTime = Date.now();
    const queries = generator.generate(options.count, options.balanced);
    const duration = Date.now() - startTime;
    console.log(`✓ Generated ${queries.length} queries in ${duration}ms`);
    // Initialize exporter
    const exporter = new DataExporter();
    // Export full dataset
    console.log(`\n📦 Exporting datasets...`);
    if (options.formats.includes("jsonl")) {
        await exporter.exportToJSONL(queries, `${options.outputDir}/training.jsonl`);
        console.log(`✓ Exported ${options.outputDir}/training.jsonl`);
    }
    if (options.formats.includes("json")) {
        await exporter.exportToJSON(queries, `${options.outputDir}/training.json`);
        console.log(`✓ Exported ${options.outputDir}/training.json`);
    }
    if (options.formats.includes("csv")) {
        await exporter.exportToCSV(queries, `${options.outputDir}/training.csv`);
        console.log(`✓ Exported ${options.outputDir}/training.csv`);
    }
    // Create train/val/test split
    console.log(`\n✂️  Creating train/val/test split...`);
    const splits = exporter.splitTrainValTest(queries, 0.8, 0.1, 0.1, options.stratified);
    console.log(`✓ Train: ${splits.train.length} queries`);
    console.log(`✓ Validation: ${splits.validation.length} queries`);
    console.log(`✓ Test: ${splits.test.length} queries`);
    // Export splits
    const format = options.formats.includes("jsonl") ? "jsonl" : "json";
    await exporter.exportSplits(splits, options.outputDir, format);
    console.log(`✓ Exported splits to ${options.outputDir}/train.${format}`);
    console.log(`✓ Exported splits to ${options.outputDir}/val.${format}`);
    console.log(`✓ Exported splits to ${options.outputDir}/test.${format}`);
    // Generate statistics
    if (options.generateStats) {
        console.log(`\n📊 Generating statistics...`);
        const stats = exporter.generateStats(queries);
        console.log(`✓ Total queries: ${stats.total}`);
        console.log(`✓ Balance: ${stats.balance}`);
        console.log(`✓ Avg length: ${stats.avgQueryLength} chars`);
        console.log(`✓ Intents: ${Object.keys(stats.intents).length}`);
        console.log(`✓ Domains: ${Object.keys(stats.domains).length}`);
        console.log(`✓ Variations: ${Object.keys(stats.variations).length}`);
        // Save statistics report
        const report = exporter.generateStatsReport(stats);
        await exporter["writeFile"](`${options.outputDir}/STATISTICS.md`, report);
        console.log(`✓ Exported ${options.outputDir}/STATISTICS.md`);
        // Save statistics as JSON
        await exporter.exportToJSON([{ data: stats }], `${options.outputDir}/statistics.json`);
        console.log(`✓ Exported ${options.outputDir}/statistics.json`);
    }
    console.log(`\n✅ Done! Generated ${options.count} synthetic queries.\n`);
    // Print sample queries
    console.log("📝 Sample queries:");
    const sampleSize = Math.min(5, queries.length);
    for (let i = 0; i < sampleSize; i++) {
        const q = queries[i];
        console.log(`\n  [${q.intent}]`);
        console.log(`  ${q.query}`);
        console.log(`  (${q.metadata.difficulty}, ${q.metadata.variation})`);
    }
    console.log();
}
// Run CLI
main().catch(error => {
    console.error("❌ Error:", error.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map