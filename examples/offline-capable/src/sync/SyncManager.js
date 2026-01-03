/**
 * Sync Manager
 *
 * Manages background synchronization of offline changes.
 */

class SyncManager {
  constructor(storage, config = {}) {
    this.storage = storage;
    this.config = {
      syncInterval: config.syncInterval || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      ...config
    };

    this.isOnline = navigator.onLine;
    this.syncInterval = null;
    this.syncInProgress = false;
  }

  /**
   * Initialize sync manager
   * @returns {Promise<void>}
   */
  async initialize() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }

    // Start periodic sync
    this.startPeriodicSync();

    console.log('✓ Sync manager initialized');
  }

  /**
   * Handle coming online
   * @returns {Promise<void>}
   */
  async handleOnline() {
    console.log('[Sync] Connection restored');
    this.isOnline = true;
    await this.sync();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('[Sync] Connection lost');
    this.isOnline = false;
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    if (typeof setInterval !== 'undefined') {
      this.syncInterval = setInterval(() => {
        if (this.isOnline && !this.syncInProgress) {
          this.sync();
        }
      }, this.config.syncInterval);
    }
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform sync
   * @returns {Promise<void>}
   */
  async sync() {
    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress');
      return;
    }

    this.syncInProgress = true;
    console.log('[Sync] Starting sync...');

    try {
      await this.syncQueue();
      await this.syncDocuments();
      console.log('[Sync] Sync completed');
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync queued items
   * @returns {Promise<void>}
   */
  async syncQueue() {
    const queue = await this.storage.getSyncQueue();

    for (const item of queue) {
      try {
        await this.syncItem(item);
        await this.storage.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error('[Sync] Item sync failed:', error);

        item.retries++;

        if (item.retries >= this.config.maxRetries) {
          await this.storage.removeFromSyncQueue(item.id);
          console.error('[Sync] Max retries reached for item:', item.id);
        } else {
          await this.delay(this.config.retryDelay);
        }
      }
    }
  }

  /**
   * Sync individual item
   * @param {Object} item - Item to sync
   * @returns {Promise<Object>} Sync result
   */
  async syncItem(item) {
    // Simulated sync - in production, make actual HTTP request
    console.log('[Sync] Syncing item:', item.id);
    return { success: true };
  }

  /**
   * Sync documents
   * @returns {Promise<void>}
   */
  async syncDocuments() {
    const unsynced = await this.storage.getUnsyncedDocuments();

    for (const doc of unsynced) {
      try {
        await this.syncDocument(doc);
        await this.storage.markSynced(doc.id);
      } catch (error) {
        console.error('[Sync] Document sync failed:', doc.id, error);
      }
    }
  }

  /**
   * Sync individual document
   * @param {Object} document - Document to sync
   * @returns {Promise<Object>} Sync result
   */
  async syncDocument(document) {
    // Simulated sync - in production, make actual HTTP request
    console.log('[Sync] Syncing document:', document.id);
    return { success: true };
  }

  /**
   * Queue item for sync
   * @param {string} url - URL to sync to
   * @param {Object} options - Request options
   * @returns {Promise<void>}
   */
  async queue(url, options = {}) {
    const item = {
      url,
      method: options.method || 'POST',
      headers: options.headers || {},
      body: options.body
    };

    await this.storage.addToSyncQueue(item);

    if (this.isOnline) {
      await this.sync();
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get sync status
   * @returns {Object} Sync status
   */
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      queueLength: this.storage.syncQueue?.length || 0,
      lastSync: new Date().toISOString()
    };
  }
}

module.exports = SyncManager;
