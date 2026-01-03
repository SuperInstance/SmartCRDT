/**
 * Standalone Data Generation Script (Node.js compatible)
 *
 * Run with: npx tsx generate.ts [count] [outputDir]
 *
 * @package vljepa/data
 */

import { QueryDataGenerator } from "./generator";
import { DataExporter } from "./exporter";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Create output directory if it doesn't exist
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

/**
 * Main generation function
 */
async function generateDataset(): Promise<void> {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1000;
  const outputDir =
    args[1] || path.join(process.cwd(), "packages/cascade/data");

  console.log("🔮 Synthetic Query Data Generator\n");
  console.log(`Configuration:`);
  console.log(`  Count: ${count}`);
  console.log(`  Output: ${outputDir}\n`);

  // Create output directory
  await ensureDir(outputDir);
  console.log(`✓ Created output directory: ${outputDir}`);

  // Initialize generator
  console.log(`\n⚙️  Initializing generator...`);
  const generator = new QueryDataGenerator();
  const templateStats = generator.getTemplateStats();
  console.log(`✓ Generator initialized`);

  // Generate queries
  console.log(`\n🎲 Generating ${count} queries...`);
  const startTime = Date.now();
  const queries = generator.generate(count, true);
  const duration = Date.now() - startTime;
  console.log(
    `✓ Generated ${queries.length} queries in ${duration}ms (${(duration / count).toFixed(2)}ms per query)`
  );

  // Initialize exporter
  const exporter = new DataExporter() as any;

  // Add writeFile method to exporter for Node.js
  exporter.writeFile = async (filePath: string, content: string) => {
    await fs.writeFile(filePath, content, "utf-8");
  };

  // Export full dataset
  console.log(`\n📦 Exporting datasets...`);

  await exporter.exportToJSONL(queries, path.join(outputDir, "training.jsonl"));
  console.log(`✓ Exported training.jsonl`);

  await exporter.exportToJSON(queries, path.join(outputDir, "training.json"));
  console.log(`✓ Exported training.json`);

  await exporter.exportToCSV(queries, path.join(outputDir, "training.csv"));
  console.log(`✓ Exported training.csv`);

  // Create train/val/test split
  console.log(`\n✂️  Creating train/val/test split...`);
  const splits = exporter.splitTrainValTest(queries, 0.8, 0.1, 0.1, true);
  console.log(`✓ Train: ${splits.train.length} queries`);
  console.log(`✓ Validation: ${splits.validation.length} queries`);
  console.log(`✓ Test: ${splits.test.length} queries`);

  // Export splits
  await exporter.exportSplits(splits, outputDir, "jsonl");
  console.log(`✓ Exported train/val/test splits`);

  // Generate statistics
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
  await exporter.writeFile(path.join(outputDir, "STATISTICS.md"), report);
  console.log(`✓ Exported STATISTICS.md`);

  // Save statistics as JSON
  await fs.writeFile(
    path.join(outputDir, "statistics.json"),
    JSON.stringify(stats, null, 2),
    "utf-8"
  );
  console.log(`✓ Exported statistics.json`);

  console.log(`\n✅ Done! Generated ${count} synthetic queries.\n`);

  // Print intent distribution
  console.log("📊 Intent Distribution:");
  for (const [intent, count] of Object.entries(stats.intents)) {
    const countNum = Number(count);
    const percentage = ((countNum / stats.total) * 100).toFixed(1);
    console.log(
      `  ${intent.padEnd(20)} ${countNum.toString().padStart(5)} (${percentage}%)`
    );
  }
  console.log();

  // Print sample queries
  console.log("📝 Sample queries (first 5):");
  const sampleSize = Math.min(5, queries.length);
  for (let i = 0; i < sampleSize; i++) {
    const q = queries[i];
    console.log(`\n  [${q.intent}]`);
    console.log(`  ${q.query}`);
    console.log(`  (${q.metadata.difficulty}, ${q.metadata.variation})`);
  }
  console.log();
}

// Run the generator
generateDataset().catch(error => {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
