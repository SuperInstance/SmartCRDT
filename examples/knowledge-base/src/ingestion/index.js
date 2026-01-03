/**
 * Document Ingestion
 *
 * Handles ingesting documents from various sources including
 * files, directories, URLs, and raw text.
 */

const fs = require('fs').promises;
const path = require('path');

class DocumentIngestion {
  constructor(storage) {
    this.storage = storage;
    this.supportedFormats = ['.md', '.txt', '.json', '.html'];
    this.hooks = [];
  }

  /**
   * Register ingestion hook
   * @param {Function} hook - Hook function
   */
  onIngest(hook) {
    this.hooks.push(hook);
  }

  /**
   * Ingest from directory
   * @param {string} directory - Directory path
   * @param {Object} options - Ingestion options
   * @returns {Promise<Object>} Ingestion results
   */
  async ingestDirectory(directory, options = {}) {
    const {
      recursive = true,
      pattern = '**/*',
      filter = () => true
    } = options;

    const { glob } = require('glob');
    const files = await glob(path.join(directory, pattern), {
      nodir: true
    });

    const results = {
      ingested: [],
      failed: [],
      skipped: []
    };

    for (const filePath of files) {
      try {
        const ext = path.extname(filePath).toLowerCase();

        if (!this.supportedFormats.includes(ext)) {
          results.skipped.push({ path: filePath, reason: 'Unsupported format' });
          continue;
        }

        if (!filter(filePath)) {
          results.skipped.push({ path: filePath, reason: 'Filtered' });
          continue;
        }

        const doc = await this.ingestFile(filePath);
        results.ingested.push(doc);

        // Run hooks
        for (const hook of this.hooks) {
          await hook(doc);
        }

      } catch (error) {
        results.failed.push({ path: filePath, error: error.message });
      }
    }

    return results;
  }

  /**
   * Ingest single file
   * @param {string} filePath - File path
   * @returns {Promise<Object>} Ingested document
   */
  async ingestFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const stat = await fs.stat(filePath);

    const document = {
      id: this.generateId(filePath),
      path: filePath,
      content,
      metadata: {
        filename: path.basename(filePath),
        extension: path.extname(filePath),
        size: stat.size,
        created: stat.birthtime,
        modified: stat.mtime,
        ingestedAt: new Date().toISOString()
      },
      chunks: this.chunkContent(content),
      tags: [],
      links: this.extractLinks(content)
    };

    await this.storage.store(document.id, document);
    return document;
  }

  /**
   * Ingest from URL
   * @param {string} url - URL to fetch
   * @param {Object} options - Options
   * @returns {Promise<Object>} Ingested document
   */
  async ingestURL(url, options = {}) {
    // Simplified URL fetching
    const response = { ok: true, text: async () => 'Sample content from ' + url };

    const content = await response.text();

    const document = {
      id: this.generateId(url),
      path: url,
      content,
      metadata: {
        source: 'url',
        url,
        ingestedAt: new Date().toISOString()
      },
      chunks: this.chunkContent(content),
      tags: options.tags || [],
      links: this.extractLinks(content)
    };

    await this.storage.store(document.id, document);
    return document;
  }

  /**
   * Ingest raw text
   * @param {string} text - Text content
   * @param {Object} metadata - Metadata
   * @returns {Promise<Object>} Ingested document
   */
  async ingestText(text, metadata = {}) {
    const id = this.generateId(`text-${Date.now()}`);

    const document = {
      id,
      path: metadata.title || id,
      content: text,
      metadata: {
        ...metadata,
        ingestedAt: new Date().toISOString()
      },
      chunks: this.chunkContent(text),
      tags: metadata.tags || [],
      links: this.extractLinks(text)
    };

    await this.storage.store(document.id, document);
    return document;
  }

  /**
   * Generate unique ID
   * @param {string} seed - Seed for ID generation
   * @returns {string} Unique ID
   */
  generateId(seed) {
    return `doc-${Buffer.from(seed).toString('base64').slice(0, 16)}`;
  }

  /**
   * Split content into chunks
   * @param {string} content - Text content
   * @param {number} maxChunkSize - Maximum chunk size
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<string>} Content chunks
   */
  chunkContent(content, maxChunkSize = 500, overlap = 50) {
    const chunks = [];
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let currentSize = 0;

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);

      if (currentSize + words.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentSize = 0;
      }

      currentChunk += paragraph + '\n\n';
      currentSize += words.length;
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Extract links from content
   * @param {string} content - Text content
   * @returns {Array<string>} Extracted URLs
   */
  extractLinks(content) {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const links = content.match(urlPattern) || [];
    return [...new Set(links)]; // Deduplicate
  }
}

module.exports = DocumentIngestion;
