/**
 * Knowledge Base
 *
 * Main API for the private knowledge base system.
 */

const { LSIClient } = require('@lsi/sdk');
const level = require('level');
const DocumentIngestion = require('./ingestion');
const VectorIndex = require('./indexing');
const KnowledgeGraph = require('./graph');
const SearchEngine = require('./search');
const StorageAdapter = require('./storage');

class KnowledgeBase {
  constructor(options = {}) {
    this.options = {
      dbPath: options.dbPath || './data/kb',
      modelPath: options.modelPath || './models',
      ...options
    };

    this.lsi = new LSIClient({ modelPath: this.options.modelPath });
    this.db = level(this.options.dbPath);
    this.initialized = false;
  }

  /**
   * Create storage adapter
   * @param {Object} db - LevelDB instance
   * @returns {StorageAdapter} Storage adapter
   */
  createStorageAdapter(db) {
    return new StorageAdapter(db);
  }

  /**
   * Initialize knowledge base
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    await this.lsi.initialize();

    const storage = this.createStorageAdapter(this.db);

    this.ingestion = new DocumentIngestion(storage);
    this.index = new VectorIndex(this.lsi, storage);
    this.graph = new KnowledgeGraph(storage);
    this.search = new SearchEngine(this.index, this.graph);

    await this.index.initialize();

    // Load existing data
    await this.loadFromStorage(storage);

    this.initialized = true;
    console.log('✓ Knowledge base initialized');
  }

  /**
   * Load existing data from storage
   * @param {StorageAdapter} storage - Storage adapter
   * @returns {Promise<void>}
   */
  async loadFromStorage(storage) {
    for await (const [key, value] of storage.entries()) {
      if (key.startsWith('doc-')) {
        await this.index.indexDocument(value);
        await this.graph.buildFromDocument(value, this.lsi);
      }
    }
  }

  /**
   * Add document to knowledge base
   * @param {string|Object} source - File path, URL, or text object
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Added document
   */
  async addDocument(source, metadata = {}) {
    let document;

    if (typeof source === 'string' && source.startsWith('http')) {
      document = await this.ingestion.ingestURL(source, metadata);
    } else if (typeof source === 'string') {
      document = await this.ingestion.ingestFile(source);
    } else if (typeof source === 'object') {
      document = await this.ingestion.ingestText(source.text, source.metadata);
    } else {
      throw new Error('Invalid source type');
    }

    await this.index.indexDocument(document);
    await this.graph.buildFromDocument(document, this.lsi);

    return document;
  }

  /**
   * Search knowledge base
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    return await this.search.hybridSearch(query, options);
  }

  /**
   * Get document by ID
   * @param {string} docId - Document ID
   * @returns {Promise<Object>} Document
   */
  async getDocument(docId) {
    const storage = this.createStorageAdapter(this.db);
    return await storage.get(docId);
  }

  /**
   * Get statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    const indexStats = this.index.getStats();
    const graphStats = this.graph.getStats();

    return {
      documents: indexStats.documents,
      chunks: indexStats.chunks,
      nodes: graphStats.nodes,
      edges: graphStats.edges,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Export knowledge base
   * @returns {Promise<Object>} Export data
   */
  async export() {
    return {
      graph: this.graph.export(),
      stats: await this.getStats()
    };
  }

  /**
   * Close knowledge base
   * @returns {Promise<void>}
   */
  async close() {
    await this.db.close();
  }
}

module.exports = KnowledgeBase;
