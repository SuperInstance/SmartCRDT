/**
 * Offline-Capable Application
 *
 * Main application demonstrating offline capabilities.
 */

const { LSIClient } = require('@lsi/sdk');
const OfflineStorage = require('./storage/OfflineStorage');
const SyncManager = require('./sync/SyncManager');
const NetworkManager = require('./network/NetworkManager');

class OfflineApp {
  constructor(config = {}) {
    this.config = config;

    this.lsi = new LSIClient({
      modelPath: config.modelPath || './models',
      localOnly: true
    });

    this.storage = new OfflineStorage({
      dbName: config.dbName || 'offline-app'
    });

    this.sync = new SyncManager(this.storage, {
      syncInterval: config.syncInterval || 30000
    });

    this.network = new NetworkManager();
  }

  /**
   * Initialize application
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.lsi.initialize();
    await this.storage.initialize();
    await this.sync.initialize();
    this.network.initialize();

    console.log('✓ Offline-capable application initialized');
  }

  /**
   * Store data (with sync)
   * @param {Object} data - Data to store
   * @returns {Promise<Object>} Stored document
   */
  async store(data) {
    const document = await this.storage.storeDocument(data);

    await this.sync.queue('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    return document;
  }

  /**
   * Fetch data (offline-capable)
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Response
   */
  async fetchData(url, options = {}) {
    return await this.network.fetch(url, {
      ...options,
      useCache: true
    });
  }

  /**
   * Get offline status
   * @returns {Object} Offline status
   */
  getOfflineStatus() {
    return {
      online: this.network.online(),
      syncStatus: this.sync.getSyncStatus()
    };
  }
}

module.exports = OfflineApp;
