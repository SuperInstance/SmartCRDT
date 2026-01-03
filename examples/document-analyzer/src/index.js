/**
 * Document Analysis Tool CLI
 *
 * Command-line interface for document analysis.
 */

const { LSIClient } = require('@lsi/sdk');
const DocumentAnalyzer = require('./analyzer');
const fs = require('fs');

class DocumentAnalysisTool {
  constructor() {
    this.lsi = new LSIClient({ modelPath: './models' });
    this.analyzer = null;
  }

  /**
   * Initialize the tool
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.lsi.initialize();
    this.analyzer = new DocumentAnalyzer(this.lsi);
    console.log('✓ Document analyzer initialized');
  }

  /**
   * Analyze a document
   * @param {string} filePath - Path to document
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyze(filePath, options = {}) {
    if (!this.analyzer) {
      throw new Error('Analyzer not initialized');
    }

    return await this.analyzer.analyze(filePath, options);
  }

  /**
   * Summarize a document
   * @param {string} filePath - Path to document
   * @param {number} sentenceCount - Number of sentences
   * @returns {Promise<Object>} Summary
   */
  async summarize(filePath, sentenceCount = 3) {
    if (!this.analyzer) {
      throw new Error('Analyzer not initialized');
    }

    const document = await this.analyzer.parser.parse(filePath);
    return await this.analyzer.summarizer.summarize(document, { sentenceCount });
  }

  /**
   * Extract entities from document
   * @param {string} filePath - Path to document
   * @returns {Promise<Object>} Extracted entities
   */
  async extractEntities(filePath) {
    if (!this.analyzer) {
      throw new Error('Analyzer not initialized');
    }

    const document = await this.analyzer.parser.parse(filePath);
    return await this.analyzer.entityExtractor.extractEntities(document);
  }

  /**
   * Search within document
   * @param {string} filePath - Path to document
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(filePath, query, options = {}) {
    if (!this.analyzer) {
      throw new Error('Analyzer not initialized');
    }

    return await this.analyzer.search(filePath, query, options);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  if (!command || !filePath) {
    console.log('LSI Document Analyzer');
    console.log('Usage: node src/index.js <command> <file> [options]');
    console.log('\nCommands:');
    console.log('  analyze <file>        - Full document analysis');
    console.log('  summarize <file> [n]  - Summarize document (n sentences)');
    console.log('  entities <file>       - Extract entities');
    console.log('  search <file> <query> - Search within document');
    console.log('\nExamples:');
    console.log('  node src/index.js analyze document.pdf');
    console.log('  node src/index.js summarize document.txt 5');
    console.log('  node src/index.js search document.pdf "security settings"');
    process.exit(1);
  }

  const tool = new DocumentAnalysisTool();
  await tool.initialize();

  try {
    switch (command) {
      case 'analyze':
        const analysis = await tool.analyze(filePath);
        console.log(JSON.stringify(analysis, null, 2));
        break;

      case 'summarize':
        const sentenceCount = parseInt(args[2]) || 3;
        const summary = await tool.summarize(filePath, sentenceCount);
        console.log('Summary:', summary.summary);
        console.log('\nCompression ratio:', (summary.compressionRatio * 100).toFixed(1) + '%');
        break;

      case 'entities':
        const entities = await tool.extractEntities(filePath);
        console.log('Pattern-based entities:');
        console.log(JSON.stringify(entities.patterns, null, 2));
        console.log('\nSemantic entities:');
        console.log(JSON.stringify(entities.semantic, null, 2));
        break;

      case 'search':
        const query = args[2];
        if (!query) {
          console.error('Search query required');
          process.exit(1);
        }
        const results = await tool.search(filePath, query);
        console.log(`Found ${results.length} relevant sections:\n`);
        results.forEach((r, i) => {
          console.log(`${i + 1}. [Similarity: ${(r.similarity * 100).toFixed(1)}%]`);
          console.log(r.preview);
          console.log();
        });
        break;

      default:
        console.error('Unknown command:', command);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DocumentAnalysisTool;
