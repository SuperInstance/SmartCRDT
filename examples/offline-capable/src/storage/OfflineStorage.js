/**
 * Offline Storage
 *
 * IndexedDB-based storage for offline data persistence.
 */

class OfflineStorage {
  constructor(config = {}) {
    this.dbName = config.dbName || 'offline-app-db';
    this.dbVersion = config.dbVersion || 1;
    this.db = null;
  }

  /**
   * Initialize database
   * @returns {Promise<void>}
   */
  async initialize() {
    // Simple in-memory storage for demo
    // In production, use IndexedDB via idb package
    this.documents = new Map();
    this.settings = new Map();
    this.syncQueue = [];

    console.log('✓ Offline storage initialized');
  }

  /**
   * Store settings
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    this.settings.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Get setting
   * @param {string} key - Setting key
   * @returns {Promise<*>} Setting value
   */
  async getSetting(key) {
    const item = this.settings.get(key);
    return item?.value;
  }

  /**
   * Store document
   * @param {Object} document - Document to store
   * @returns {Promise<Object>} Stored document
   */
  async storeDocument(document) {
    const doc = {
      ...document,
      id: document.id || this.generateId(),
      created: document.created || Date.now(),
      modified: Date.now(),
      synced: false
    };

    this.documents.set(doc.id, doc);
    return doc;
  }

  /**
   * Get document
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Document
   */
  async getDocument(id) {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   * @returns {Promise<Array>} All documents
   */
  async getAllDocuments() {
    return Array.from(this.documents.values());
  }

  /**
   * Get unsynced documents
   * @returns {Promise<Array>} Unsynced documents
   */
  async getUnsyncedDocuments() {
    return Array.from(this.documents.values()).filter(doc => !doc.synced);
  }

  /**
   * Mark document as synced
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  async markSynced(id) {
    const doc = this.documents.get(id);
    if (doc) {
      doc.synced = true;
      doc.syncedAt = Date.now();
    }
  }

  /**
   * Add to sync queue
   * @param {Object} item - Queue item
   * @returns {Promise<Object>} Queued item
   */
  async addToSyncQueue(item) {
    const syncItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0
    };

    this.syncQueue.push(syncItem);
    return syncItem;
  }

  /**
   * Get sync queue
   * @returns {Promise<Array>} Sync queue
   */
  async getSyncQueue() {
    return this.syncQueue;
  }

  /**
   * Remove from sync queue
   * @param {string} id - Queue item ID
   * @returns {Promise<void>}
   */
  async removeFromSyncQueue(id) {
    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    this.documents.clear();
    this.settings.clear();
    this.syncQueue = [];
  }
}

module.exports = OfflineStorage;
