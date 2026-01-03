/**
 * Data Exporter
 *
 * Exports generated queries to various formats (JSONL, CSV)
 * and creates train/val/test splits.
 *
 * @package vljepa/data
 */
// Local IntentCategory enum to avoid module resolution issues
// TODO: Use @lsi/protocol import when package is properly set up
var IntentCategory;
(function (IntentCategory) {
    IntentCategory["QUERY"] = "query";
    IntentCategory["COMMAND"] = "command";
    IntentCategory["CONVERSATION"] = "conversation";
    IntentCategory["CODE_GENERATION"] = "code_generation";
    IntentCategory["ANALYSIS"] = "analysis";
    IntentCategory["CREATIVE"] = "creative";
    IntentCategory["DEBUGGING"] = "debugging";
    IntentCategory["SYSTEM"] = "system";
    IntentCategory["UNKNOWN"] = "unknown";
})(IntentCategory || (IntentCategory = {}));
/**
 * Data Exporter Class
 *
 * Handles exporting generated queries to various formats
 * and creating train/validation/test splits.
 */
export class DataExporter {
    /**
     * Export queries to JSONL format (for training)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    async exportToJSONL(queries, outputPath) {
        const lines = queries.map(q => JSON.stringify({
            query: q.query,
            intent: q.intent,
            metadata: q.metadata,
        }));
        const content = lines.join("\n");
        await this.writeFile(outputPath, content);
    }
    /**
     * Export queries to CSV format (for analysis)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    async exportToCSV(queries, outputPath) {
        const header = "query,intent,difficulty,domain,variation,length\n";
        const rows = queries
            .map(q => {
            const escapedQuery = `"${q.query.replace(/"/g, '""')}"`;
            const length = q.query.length;
            return `${escapedQuery},"${q.intent}","${q.metadata.difficulty}","${q.metadata.domain}","${q.metadata.variation}",${length}`;
        })
            .join("\n");
        const content = header + rows;
        await this.writeFile(outputPath, content);
    }
    /**
     * Export queries to JSON format (for programmatic access)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    async exportToJSON(queries, outputPath) {
        const content = JSON.stringify(queries, null, 2);
        await this.writeFile(outputPath, content);
    }
    /**
     * Split dataset into train/validation/test sets
     *
     * @param queries - Array of generated queries
     * @param trainRatio - Ratio for training set (default: 0.8)
     * @param valRatio - Ratio for validation set (default: 0.1)
     * @param testRatio - Ratio for test set (default: 0.1)
     * @param stratify - Whether to stratify by intent (default: true)
     * @returns Dataset split
     */
    splitTrainValTest(queries, trainRatio = 0.8, valRatio = 0.1, testRatio = 0.1, stratify = true) {
        if (Math.abs(trainRatio + valRatio + testRatio - 1.0) > 0.001) {
            throw new Error("Train, validation, and test ratios must sum to 1.0");
        }
        if (stratify) {
            return this.stratifiedSplit(queries, trainRatio, valRatio, testRatio);
        }
        else {
            return this.randomSplit(queries, trainRatio, valRatio, testRatio);
        }
    }
    /**
     * Stratified split maintaining intent distribution
     */
    stratifiedSplit(queries, trainRatio, valRatio, testRatio) {
        // Group queries by intent
        const byIntent = new Map();
        for (const query of queries) {
            const intent = query.intent;
            if (!byIntent.has(intent)) {
                byIntent.set(intent, []);
            }
            byIntent.get(intent).push(query);
        }
        const train = [];
        const validation = [];
        const test = [];
        // Split each intent group
        for (const [intent, intentQueries] of byIntent) {
            const shuffled = this.shuffle(intentQueries);
            const total = shuffled.length;
            const trainSize = Math.floor(total * trainRatio);
            const valSize = Math.floor(total * valRatio);
            train.push(...shuffled.slice(0, trainSize));
            validation.push(...shuffled.slice(trainSize, trainSize + valSize));
            test.push(...shuffled.slice(trainSize + valSize));
        }
        return {
            train: this.shuffle(train),
            validation: this.shuffle(validation),
            test: this.shuffle(test),
        };
    }
    /**
     * Random split without stratification
     */
    randomSplit(queries, trainRatio, valRatio, testRatio) {
        const shuffled = this.shuffle(queries);
        const total = shuffled.length;
        const trainSize = Math.floor(total * trainRatio);
        const valSize = Math.floor(total * valRatio);
        return {
            train: shuffled.slice(0, trainSize),
            validation: shuffled.slice(trainSize, trainSize + valSize),
            test: shuffled.slice(trainSize + valSize),
        };
    }
    /**
     * Generate comprehensive statistics about the dataset
     *
     * @param queries - Array of generated queries
     * @returns Dataset statistics
     */
    generateStats(queries) {
        const intentCounts = new Map();
        const domainCounts = new Map();
        const difficultyCounts = new Map();
        const variationCounts = new Map();
        const queryLengths = [];
        for (const q of queries) {
            // Count intents
            intentCounts.set(q.intent, (intentCounts.get(q.intent) || 0) + 1);
            // Count domains
            const domain = q.metadata.domain;
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
            // Count difficulties
            const difficulty = q.metadata.difficulty;
            difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1);
            // Count variations
            const variation = q.metadata.variation;
            variationCounts.set(variation, (variationCounts.get(variation) || 0) + 1);
            // Track query lengths
            queryLengths.push(q.query.length);
        }
        // Calculate balance
        const balance = this.checkBalance(intentCounts);
        // Calculate query length statistics
        const avgQueryLength = queryLengths.reduce((a, b) => a + b, 0) / queryLengths.length;
        const minQueryLength = Math.min(...queryLengths);
        const maxQueryLength = Math.max(...queryLengths);
        return {
            total: queries.length,
            intents: Object.fromEntries(intentCounts),
            domains: Object.fromEntries(domainCounts),
            difficulties: Object.fromEntries(difficultyCounts),
            variations: Object.fromEntries(variationCounts),
            balance,
            avgQueryLength: Math.round(avgQueryLength * 100) / 100,
            minQueryLength,
            maxQueryLength,
        };
    }
    /**
     * Check if intent distribution is balanced
     */
    checkBalance(counts) {
        const values = Array.from(counts.values());
        if (values.length === 0) {
            return "balanced";
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        // Consider balanced if max/min ratio < 2 (within 2x)
        return max / min < 2.0 ? "balanced" : "imbalanced";
    }
    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    /**
     * Write content to file (works in both Node.js and Deno)
     */
    async writeFile(path, content) {
        try {
            // Try Deno first
            // @ts-ignore - Deno API
            if (typeof Deno !== "undefined" && Deno.writeTextFile) {
                // @ts-ignore
                await Deno.writeTextFile(path, content);
                return;
            }
        }
        catch (e) {
            // Fall through to Node.js
        }
        // Node.js fallback
        try {
            const fs = await import("fs/promises");
            await fs.writeFile(path, content, "utf-8");
        }
        catch (e) {
            throw new Error(`Failed to write file: ${path}. Error: ${e}`);
        }
    }
    /**
     * Export split datasets to files
     *
     * @param splits - Dataset split
     * @param outputDir - Output directory
     * @param format - Output format ('jsonl' or 'json')
     */
    async exportSplits(splits, outputDir, format = "jsonl") {
        const extension = format === "jsonl" ? "jsonl" : "json";
        await this.exportToJSONL(splits.train, `${outputDir}/train.${extension}`);
        await this.exportToJSONL(splits.validation, `${outputDir}/val.${extension}`);
        await this.exportToJSONL(splits.test, `${outputDir}/test.${extension}`);
    }
    /**
     * Generate statistics report as markdown
     *
     * @param stats - Dataset statistics
     * @returns Markdown report
     */
    generateStatsReport(stats) {
        const lines = [];
        lines.push("# Dataset Statistics\n");
        lines.push(`**Total Queries:** ${stats.total}\n`);
        lines.push(`**Balance:** ${stats.balance}\n`);
        lines.push(`**Avg Query Length:** ${stats.avgQueryLength} chars\n`);
        lines.push(`**Query Length Range:** ${stats.minQueryLength} - ${stats.maxQueryLength} chars\n`);
        lines.push("## Intent Distribution\n");
        lines.push("| Intent | Count | Percentage |");
        lines.push("|--------|-------|------------|");
        for (const [intent, count] of Object.entries(stats.intents)) {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            lines.push(`| ${intent} | ${count} | ${percentage}% |`);
        }
        lines.push("\n## Difficulty Distribution\n");
        lines.push("| Difficulty | Count | Percentage |");
        lines.push("|------------|-------|------------|");
        for (const [difficulty, count] of Object.entries(stats.difficulties)) {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            lines.push(`| ${difficulty} | ${count} | ${percentage}% |`);
        }
        lines.push("\n## Domain Distribution (Top 10)\n");
        lines.push("| Domain | Count | Percentage |");
        lines.push("|--------|-------|------------|");
        const sortedDomains = Object.entries(stats.domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        for (const [domain, count] of sortedDomains) {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            lines.push(`| ${domain} | ${count} | ${percentage}% |`);
        }
        lines.push("\n## Variation Distribution\n");
        lines.push("| Variation | Count | Percentage |");
        lines.push("|-----------|-------|------------|");
        for (const [variation, count] of Object.entries(stats.variations)) {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            lines.push(`| ${variation} | ${count} | ${percentage}% |`);
        }
        return lines.join("\n");
    }
}
//# sourceMappingURL=exporter.js.map